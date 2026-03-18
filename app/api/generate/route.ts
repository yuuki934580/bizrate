import { NextRequest, NextResponse } from 'next/server'
import { runDiagnosis } from '@/lib/openai'
import { createServiceClient } from '@/lib/supabase'
import {
  consumeCredits, consumeGuestCredits,
  getGuestCredits, findCachedDiagnosis, hashInputs
} from '@/lib/credits'
import { checkFreeDiagnosis, consumeFreeDiagnosis, fingerprintHash, getOrCreateGuest } from '@/lib/guest'
import { CREDIT_COSTS, FIVE_AXES, SCORE_LABELS } from '@/types'
import { calcPrice, calcConversionRate, calcMonthly30k } from '@/lib/scoring'
import { z } from 'zod'

const Schema = z.object({
  businessSummary:  z.string().min(10).max(1000),
  valueProposition: z.string().min(2),
  salesChannel:     z.string().optional(),
  businessModel:    z.string().optional(),
  currentPrice:     z.string().optional(),
  initialBudget:    z.string().optional(),
  weeklyHours:      z.string().optional(),
  canShowFace:      z.boolean().optional(),
  canDoSales:       z.boolean().optional(),
  userId:           z.string().optional(),
  pfid:             z.string().optional(),
  guestId:          z.string().optional(),
  noCache:          z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, pfid, guestId: bodyGuestId, noCache, ...inputData } = Schema.parse(body)
    const input = inputData

    // ── guest_id 解決 ──
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip') || 'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'
    const fingerprint = fingerprintHash(ip, ua)
    const cookieGuestId = req.cookies.get('bizrate_guest_id')?.value || null
    const { guestId } = await getOrCreateGuest(cookieGuestId, fingerprint)

    const setCookie = (res: NextResponse) => {
      res.cookies.set('bizrate_guest_id', guestId, {
        maxAge: 60 * 60 * 24 * 365, httpOnly: true,
        sameSite: 'lax', path: '/',
        secure: process.env.NODE_ENV === 'production',
      })
      return res
    }

    // ── キャッシュチェック（無料・回数消費なし） ──
    const inputsHash = hashInputs(input)
    // ユーザー入力価格（キャッシュ時も使用）
    const userPriceRaw = input.currentPrice
      ? parseInt((input.currentPrice as string).replace(/[^0-9]/g, ''), 10)
      : null
    const cached = noCache ? null : await findCachedDiagnosis(inputsHash)
    if (cached) {
      const cs = (cached.result as any).scores
      const cPrice   = calcPrice(cs)
      const cConv    = calcConversionRate(cs, cPrice)
      const cUserPrice = userPriceRaw && userPriceRaw > 0 ? userPriceRaw : cPrice.finalPrice
      const cM30k    = calcMonthly30k(cUserPrice)
      const cBases: Record<string, number> = {
        'SNS': 300, 'Twitter': 300, 'Instagram': 300, 'YouTube': 500,
        'note': 150, 'ブログ': 150, 'メルマガ': 120, 'クラウドソーシング': 150,
        '口コミ': 100, '知人': 100, 'LP': 80, 'ランディング': 80,
        'プラットフォーム': 200, 'ストアカ': 200,
      }
      let cChannelTotal = 0
      for (const [key, val] of Object.entries(cBases)) {
        if (salesChannelStr.includes(key)) cChannelTotal += val
      }
      if (cChannelTotal === 0) cChannelTotal = 80
      const cAttr = (cs.market * 0.5 + cs.aiResistance * 0.3 + (100 - cs.competition) * 0.2) / 100
      const cAttrFactor = Math.min(1.5, Math.max(0.4, cAttr * 1.5))
      const cTraffic = Math.min(1500, Math.round(cChannelTotal * cAttrFactor))
      const cConvRate = cConv.finalConversionRate / 100
      const cRealSales = Math.round(cTraffic * cConvRate)
      const calcC = (target: number) => {
        const needed = Math.ceil(target / cUserPrice)
        if (needed === 0) return 95
        return Math.min(95, Math.max(2, Math.round((cRealSales / needed) * 70)))
      }
      const cAchieve = {
        monthly30k:  calcC(30000),
        monthly100k: calcC(100000),
        monthly300k: calcC(300000),
      }
      const cRevEst = {
        monthlyTraffic: cTraffic, convRate: cConv.finalConversionRate,
        realisticMonthlySales: cRealSales, actualPrice: cUserPrice,
        realisticMonthlyRevenue: Math.round(cRealSales * cUserPrice),
        requiredFor30k: Math.ceil(30000 / cUserPrice),
      }
      const cWeakness = (FIVE_AXES as string[]).map(key => ({
        key, label: (SCORE_LABELS as any)[key] || key, score: (cs as any)[key],
        isWeakness: key === 'competition' || key === 'executionDifficulty'
          ? (cs as any)[key] > 60 : (cs as any)[key] < 50,
      })).sort((a, b) => {
        const aScore = (a.key === 'competition' || a.key === 'executionDifficulty') ? a.score : (100 - a.score)
        const bScore = (b.key === 'competition' || b.key === 'executionDifficulty') ? b.score : (100 - b.score)
        return bScore - aScore
      })
      ;(cached.result as any).calculatedMetrics = {
        price: cPrice, conv: cConv, monthly30k: cM30k,
        achievement: cAchieve, weaknessRanking: cWeakness, revenueEstimate: cRevEst,
      }
      return setCookie(NextResponse.json({
        success: true, fromCache: true,
        diagnosisId: cached.id, result: cached.result, creditsUsed: 0,
        guestId,
      }))
    }

    // ── 無料枠チェック（1日1回・DBベース） ──
    const freeCheck = await checkFreeDiagnosis(
      userId ? null : guestId,
      userId || null
    )

    let usedFreeSlot = false
    let creditsUsed  = 0

    if (freeCheck.allowed) {
      usedFreeSlot = true

    } else if (userId) {
      // ログインユーザー → クレジット消費
      const cr = await consumeCredits(userId, CREDIT_COSTS.diagnose, 'diagnose')
      if (!cr.success) {
        return setCookie(NextResponse.json({
          success: false,
          errorCode: 'INSUFFICIENT_CREDITS',
          error: '本日の無料診断は使用済みです。続けるにはクレジットが必要です。',
          remainingCredits: cr.remainingCredits,
        }, { status: 402 }))
      }
      creditsUsed = CREDIT_COSTS.diagnose

    } else {
      // 未ログインゲスト → guest_credits を確認
      const guestCredits = await getGuestCredits(guestId)
      if (guestCredits < CREDIT_COSTS.diagnose) {
        return setCookie(NextResponse.json({
          success: false,
          errorCode: 'DAILY_LIMIT_REACHED',
          error: '無料診断は使用済みです。続けるにはクレジットが必要です。',
          remainingCredits: guestCredits,
          guestId,
        }, { status: 402 }))
      }
      const cr = await consumeGuestCredits(guestId, CREDIT_COSTS.diagnose)
      if (!cr.success) {
        return setCookie(NextResponse.json({
          success: false,
          errorCode: 'INSUFFICIENT_CREDITS',
          error: 'クレジットが不足しています。',
          remainingCredits: cr.remainingCredits,
          guestId,
        }, { status: 402 }))
      }
      creditsUsed = CREDIT_COSTS.diagnose
    }

    // ── 診断実行 ──
    const result = await runDiagnosis(input)

    // ── calculatedMetrics を計算してresultに付与 ──
    const s = result.scores
    const priceCalc      = calcPrice(s)
    const convCalc       = calcConversionRate(s, priceCalc)

    // ユーザー入力価格（あれば使う、なければpriceCalcのfinalPrice）
    const actualPrice = (userPriceRaw && userPriceRaw > 0) ? userPriceRaw : priceCalc.finalPrice

    const monthly30kCalc = calcMonthly30k(actualPrice)

    // ── 流入数をチャネル基礎値 × 魅力度係数で算出 ──
    const salesChannelStr = (input.salesChannel as string) || ''
    const channelBases: Record<string, number> = {
      'SNS': 300, 'Twitter': 300, 'Instagram': 300,
      'YouTube': 500,
      'note': 150, 'ブログ': 150,
      'メルマガ': 120,
      'クラウドソーシング': 150,
      '口コミ': 100, '知人': 100,
      'LP': 80, 'ランディング': 80,
      'プラットフォーム': 200, 'ストアカ': 200,
    }
    // チャネル基礎値を合算（複数選択対応）
    let channelTotal = 0
    for (const [key, val] of Object.entries(channelBases)) {
      if (salesChannelStr.includes(key)) channelTotal += val
    }
    if (channelTotal === 0) channelTotal = 80 // 未選択時のデフォルト

    // 魅力度係数：市場性・差別化（AI代替耐性）・ターゲット明確さから算出
    const attractiveness = (s.market * 0.5 + s.aiResistance * 0.3 + (100 - s.competition) * 0.2) / 100
    const attractivenessFactor = Math.min(1.5, Math.max(0.4, attractiveness * 1.5))

    // 流入数 = チャネル基礎値 × 魅力度係数（上限1500）
    const monthlyTraffic = Math.min(1500, Math.round(channelTotal * attractivenessFactor))

    // 購入率（成約率）= convCalcから取得
    const convRate = convCalc.finalConversionRate / 100

    // 現実的な月間販売数
    const realisticMonthlySales = Math.round(monthlyTraffic * convRate)

    // 月収達成可能性 = 現実販売数 / 必要販売数
    const calcAchievementRate = (targetRevenue: number) => {
      const needed = Math.ceil(targetRevenue / actualPrice)
      if (needed === 0) return 95
      const ratio = realisticMonthlySales / needed
      // ratio >= 1 → 達成可能、ratio < 1 → 難しい
      // 上限95%、下限2%
      return Math.min(95, Math.max(2, Math.round(ratio * 70)))
    }

    const achievement = {
      monthly30k:  calcAchievementRate(30000),
      monthly100k: calcAchievementRate(100000),
      monthly300k: calcAchievementRate(300000),
    }

    // UI表示用の内訳データも付与
    const revenueEstimate = {
      monthlyTraffic,
      convRate: convCalc.finalConversionRate,
      realisticMonthlySales,
      actualPrice,
      realisticMonthlyRevenue: Math.round(realisticMonthlySales * actualPrice),
      requiredFor30k: Math.ceil(30000 / actualPrice),
    }

    // 弱点ランキング（スコアが低い順）
    const weaknessRanking = (FIVE_AXES as string[]).map(key => ({
      key,
      label: (SCORE_LABELS as any)[key] || key,
      score: (s as any)[key] as number,
      isWeakness: key === 'competition' || key === 'executionDifficulty'
        ? (s as any)[key] > 60
        : (s as any)[key] < 50,
    })).sort((a, b) => {
      // competitionとexecutionDifficultyは高いほど弱点、他は低いほど弱点
      const aScore = (a.key === 'competition' || a.key === 'executionDifficulty')
        ? a.score : (100 - a.score)
      const bScore = (b.key === 'competition' || b.key === 'executionDifficulty')
        ? b.score : (100 - b.score)
      return bScore - aScore
    })

    ;(result as any).calculatedMetrics = {
      price: priceCalc,
      conv: convCalc,
      monthly30k: monthly30kCalc,
      achievement,
      weaknessRanking,
      revenueEstimate,
    }

    // ── 無料枠消費（診断成功後） ──
    if (usedFreeSlot) {
      await consumeFreeDiagnosis(userId ? null : guestId, userId || null)
    }

    // ── DB保存 ──
    let diagnosisId: string | null = null
    try {
      const supabase = createServiceClient()
      const { data } = await supabase.from('diagnoses')
        .insert({ user_id: userId || null, inputs: input, inputs_hash: inputsHash, result })
        .select('id').single()
      if (data) diagnosisId = data.id
    } catch (e) { console.error('DB save:', e) }

    // pending_forms を削除（診断成功後）
    if (pfid) {
      try {
        const supabase2 = createServiceClient()
        await supabase2.from('pending_forms').delete().eq('id', pfid)
      } catch (e) { console.error('pending_forms delete:', e) }
    }

    return setCookie(NextResponse.json({
      success: true, fromCache: false,
      diagnosisId, result, creditsUsed, freeUsed: usedFreeSlot, guestId,
    }))

  } catch (err) {
    console.error('Diagnosis error:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, errorCode: 'VALIDATION_ERROR', error: '入力値が不正です' }, { status: 400 })
    }
    return NextResponse.json({
      success: false, errorCode: 'DIAGNOSIS_FAILED',
      error: err instanceof Error ? err.message : '診断に失敗しました',
    }, { status: 500 })
  }
}
