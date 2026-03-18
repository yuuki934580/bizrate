import type { DiagnosisScores } from '@/types'
import { SCORE_WEIGHTS_DEFAULT } from '@/types'

// ========================================
// 総合スコア計算
// ========================================
export function calcTotalScore(s: Omit<DiagnosisScores, 'total'>): number {
  const w = SCORE_WEIGHTS_DEFAULT
  const raw =
    s.market                       * w.market.weight +
    (100 - s.competition)          * w.competition.weight +
    s.revenueStructure             * w.revenueStructure.weight +
    (100 - s.executionDifficulty)  * w.executionDifficulty.weight +
    s.aiResistance                 * w.aiResistance.weight

  return Math.round(Math.min(100, Math.max(0, raw)))
}

// ========================================
// 価格算出ロジック（LLM不使用・確定的計算）
//
// 差別化度  = (aiResistance + revenueStructure) / 2
// 継続性    = revenueStructure
// 市場規模  = market
// ========================================

export interface PriceCalcResult {
  basePriceIndex: number       // 基礎価格指数
  priceRange: { min: number; max: number; label: string }
  midPrice: number             // レンジ中央値
  competitionCorrFactor: number // 価格補正係数
  finalPrice: number           // 最終価格（自然な数値に丸め済み）
  priceUnit: string
}

export function calcPrice(s: Omit<DiagnosisScores, 'total'>): PriceCalcResult {
  // 派生指数
  const differentiation = (s.aiResistance + s.revenueStructure) / 2
  const continuity      = s.revenueStructure
  const marketSize      = s.market

  // 基礎価格指数 = 市場規模×0.4 + 差別化度×0.3 + 継続性×0.3
  const basePriceIndex = Math.round(
    marketSize      * 0.4 +
    differentiation * 0.3 +
    continuity      * 0.3
  )

  // 価格レンジ割当
  let range: { min: number; max: number; label: string }
  if (basePriceIndex >= 80) {
    range = { min: 5000, max: 12000, label: '高価格帯' }
  } else if (basePriceIndex >= 65) {
    range = { min: 2000, max: 5000, label: '中価格帯' }
  } else if (basePriceIndex >= 50) {
    range = { min: 800,  max: 2000, label: '低中価格帯' }
  } else {
    range = { min: 200,  max: 800,  label: '低単価戦略' }
  }

  const midPrice = (range.min + range.max) / 2

  // 価格補正係数 = 競合スコア ÷ 15（高競合 = 低価格）
  // competition は高いほど競合強い → 補正で価格を下げる
  // 係数を 0.5〜1.5 にクランプして極端にならないよう制限
  const rawFactor = (100 - s.competition) / 50  // 競合0→2.0, 競合100→0
  const competitionCorrFactor = Math.min(1.5, Math.max(0.5, rawFactor))

  const rawFinalPrice = midPrice * competitionCorrFactor

  // 自然な価格に丸める
  const finalPrice = naturalRound(rawFinalPrice)

  // 価格単位推定（revenueStructureが高くサブスク向きならmonthly）
  const priceUnit = s.revenueStructure >= 60 ? '月額' : '1件'

  return {
    basePriceIndex,
    priceRange: range,
    midPrice,
    competitionCorrFactor: Math.round(competitionCorrFactor * 100) / 100,
    finalPrice,
    priceUnit,
  }
}

// ========================================
// 成約率算出ロジック
// ========================================
export interface ConversionCalcResult {
  conversionIndex: number
  baseConversionRate: number     // %（価格補正前）
  priceCorrection: number        // ±%
  finalConversionRate: number    // %（最終）
}

export function calcConversionRate(
  s: Omit<DiagnosisScores, 'total'>,
  priceResult: PriceCalcResult
): ConversionCalcResult {
  const differentiation  = (s.aiResistance + s.revenueStructure) / 2
  const competitionAdj   = 100 - s.competition   // 高競合 = 低成約
  const marketFit        = s.market

  // 成約率指数 = 差別化度×0.4 + 競合密度補正×0.3 + 市場適合度×0.3
  const conversionIndex = Math.round(
    differentiation * 0.4 +
    competitionAdj  * 0.3 +
    marketFit       * 0.3
  )

  // %変換（中央値を採用）
  let baseRate: number
  if (conversionIndex >= 80) {
    baseRate = 7.0   // 6〜8%の中央
  } else if (conversionIndex >= 65) {
    baseRate = 5.0   // 4〜6%の中央
  } else if (conversionIndex >= 50) {
    baseRate = 3.0   // 2〜4%の中央
  } else {
    baseRate = 1.25  // 0.5〜2%の中央
  }

  // 高価格帯なら成約率を−0.5〜−1.0%補正
  let priceCorrection = 0
  if (priceResult.priceRange.label === '高価格帯') {
    priceCorrection = -0.75
  } else if (priceResult.priceRange.label === '中価格帯') {
    priceCorrection = -0.25
  }

  const finalRate = Math.max(0.5, Math.round((baseRate + priceCorrection) * 10) / 10)

  return {
    conversionIndex,
    baseConversionRate: baseRate,
    priceCorrection,
    finalConversionRate: finalRate,
  }
}

// ========================================
// 月3万到達必要販売数
// 必要販売数 = ceil(30000 ÷ 価格)
// 一貫性チェック: 価格 × 販売数 >= 30000
// ========================================
export interface Monthly30kCalcResult {
  requiredSales: number
  unitPrice: number
  check: boolean    // 価格 × 販売数 >= 30000
}

export function calcMonthly30k(finalPrice: number): Monthly30kCalcResult {
  const price = Math.max(1, finalPrice)
  const requiredSales = Math.ceil(30000 / price)
  const check = price * requiredSales >= 30000

  return { requiredSales, unitPrice: price, check }
}

// ========================================
// 一貫性チェック（全体）
// ========================================
export interface ConsistencyCheck {
  priceTimesUnits: number
  meetsMontly30k: boolean
  conversionNotContradictory: boolean  // 超高価格 × 超高成約率 は矛盾とみなす
}

export function checkConsistency(
  price: PriceCalcResult,
  conv: ConversionCalcResult,
  m30k: Monthly30kCalcResult
): ConsistencyCheck {
  const priceTimesUnits = price.finalPrice * m30k.requiredSales
  const meetsMontly30k = priceTimesUnits >= 30000

  // 矛盾チェック: 高価格帯で成約率が7%超は矛盾
  const conversionNotContradictory = !(
    price.priceRange.label === '高価格帯' && conv.finalConversionRate > 7
  )

  return { priceTimesUnits, meetsMontly30k, conversionNotContradictory }
}

// ========================================
// ユーティリティ: 自然な価格丸め
// ========================================
function naturalRound(price: number): number {
  if (price < 500) {
    return Math.round(price / 50) * 50 || 50
  } else if (price < 2000) {
    // 980, 1280, 1480, 1980 のような心理的価格
    const base = Math.round(price / 100) * 100
    const lastTwo = base % 1000
    if (lastTwo >= 900) return base - base % 100 + 980
    if (lastTwo >= 700) return base - base % 100 + 780
    if (lastTwo >= 400) return base - base % 100 + 480
    return base - base % 100 + 280
  } else if (price < 5000) {
    const base = Math.round(price / 500) * 500
    return base - 20  // 2980, 3480, 4980 等
  } else if (price < 15000) {
    const base = Math.round(price / 1000) * 1000
    return base - 200 // 4800, 7800, 9800 等
  } else {
    return Math.round(price / 1000) * 1000
  }
}

// ========================================
// 月収達成確率（コード計算・AI不使用）
// 3ヶ月以内の達成確率
//
// 基礎確率指数 = total × 0.5 + (100-executionDifficulty) × 0.3 + revenueStructure × 0.2
// 月3万:  基礎指数をそのまま%変換（上限85%）
// 月10万: 月3万確率 × 係数（競争・実行難易度で補正）
// 月30万: 月10万確率 × 係数（さらに絞り込み）
// ========================================

export interface AchievementProbability {
  monthly30k: number    // %
  monthly100k: number   // %
  monthly300k: number   // %
}

export function calcAchievementProbability(
  s: Omit<DiagnosisScores, 'total'>,
  total: number
): AchievementProbability {
  // 基礎確率指数（0〜100）
  const baseIndex =
    total                         * 0.5 +
    (100 - s.executionDifficulty) * 0.3 +
    s.revenueStructure            * 0.2

  // 月3万達成確率（上限85%・下限3%）
  const raw30k = baseIndex * 0.85
  const monthly30k = Math.round(Math.min(85, Math.max(3, raw30k)))

  // 月10万達成確率：競争密度と実行難易度で補正
  const factor100k = ((100 - s.competition) / 100) * (s.revenueStructure / 100)
  const raw100k = monthly30k * factor100k * 0.7
  const monthly100k = Math.round(Math.min(monthly30k * 0.6, Math.max(1, raw100k)))

  // 月30万達成確率：さらに市場性と差別化で絞る
  const factor300k = (s.market / 100) * ((s.aiResistance / 100) * 0.7 + 0.3)
  const raw300k = monthly100k * factor300k * 0.5
  const monthly300k = Math.round(Math.min(monthly100k * 0.5, Math.max(0, raw300k)))

  return { monthly30k, monthly100k, monthly300k }
}

// ========================================
// 弱点ランキング（コード計算・AI不使用）
// スコアが低い順（逆転軸は補正済みで評価）
// ========================================

export interface WeaknessRank {
  rank: number
  axisKey: string
  label: string
  score: number          // 実効スコア（逆転軸は100-score）
  rawScore: number       // 元スコア
  isInverse: boolean
}

export function calcWeaknessRanking(s: Omit<DiagnosisScores, 'total'>): WeaknessRank[] {
  const axes: Array<{ key: keyof Omit<DiagnosisScores, 'total'>; label: string; inverse: boolean }> = [
    { key: 'market',              label: '市場性',       inverse: false },
    { key: 'competition',         label: '競争密度',     inverse: true  },
    { key: 'revenueStructure',    label: '収益構造',     inverse: false },
    { key: 'executionDifficulty', label: '実行難易度',   inverse: true  },
    { key: 'aiResistance',        label: 'AI代替耐性',   inverse: false },
  ]

  const scored = axes.map(ax => {
    const raw = s[ax.key]
    // 逆転軸（高いほど悪い）は100-scoreで「低いほど弱点」に統一
    const effective = ax.inverse ? 100 - raw : raw
    return { axisKey: ax.key, label: ax.label, score: effective, rawScore: raw, isInverse: ax.inverse }
  })

  // 実効スコアが低い順にソート → 弱点ランキング
  scored.sort((a, b) => a.score - b.score)

  return scored.map((item, i) => ({ rank: i + 1, ...item }))
}
