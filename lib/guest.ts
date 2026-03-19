import { createServiceClient } from './supabase'
import { createHash } from 'crypto'

// ========================================
// ゲストID管理・1日1回無料判定
// ========================================

const FREE_TOTAL = 1  // 生涯の無料枠（初回のみ）

// IP + UA をSHA-256ハッシュ化（生IP不保存）
export function fingerprintHash(ip: string, ua: string): string {
  return createHash('sha256')
    .update(`${ip}::${ua}::bizrate_salt_v1`)
    .digest('hex')
    .slice(0, 32)  // 32文字に短縮
}

// JST基準の今日の日付文字列（YYYY-MM-DD）
export function todayJST(): string {
  const now = new Date()
  // UTC+9
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

// ゲストユーザーを取得 or 作成
// fingerprint が一致する既存ゲストがいれば再利用（cookie削除対策）
export async function getOrCreateGuest(
  guestId: string | null,
  fingerprint: string
): Promise<{ guestId: string; isNew: boolean }> {
  const supabase = createServiceClient()

  // 1. cookie の guest_id が有効か確認
  if (guestId) {
    const { data } = await supabase
      .from('guest_users')
      .select('guest_id')
      .eq('guest_id', guestId)
      .single()
    if (data) {
      // last_seen 更新
      await supabase
        .from('guest_users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('guest_id', guestId)
      return { guestId, isNew: false }
    }
  }

  // 2. fingerprint で既存ゲストを検索（cookie削除対策）
  //    同一フィンガープリントが当日すでに無料利用済みなら、
  //    新しい guest_id を発行しても当日分は消費済みとみなせる
  const { data: fpMatch } = await supabase
    .from('guest_users')
    .select('guest_id')
    .eq('fingerprint', fingerprint)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .single()

  if (fpMatch) {
    // fingerprint が一致する既存ゲストを再利用（cookie削除対策）
    await supabase
      .from('guest_users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('guest_id', fpMatch.guest_id)
    return { guestId: fpMatch.guest_id, isNew: false }
  }

  // 3. 新規ゲスト発行
  const newGuestId = crypto.randomUUID()
  await supabase.from('guest_users').insert({
    guest_id: newGuestId,
    fingerprint,
  })
  return { guestId: newGuestId, isNew: true }
}

// ========================================
// 1日1回無料判定
// ========================================

export interface FreeDiagnosisCheck {
  allowed: boolean        // 無料診断を使えるか
  usedToday: number       // 今日の使用回数
  remaining: number       // 残り無料回数
  date: string            // 判定日（JST）
}

export async function checkFreeDiagnosis(
  guestId: string | null,
  userId: string | null
): Promise<FreeDiagnosisCheck> {
  const supabase = createServiceClient()
  const date = todayJST()  // 記録用に残す

  // 全期間の合計使用回数を確認（初回のみ無料）
  let query = supabase
    .from('daily_free_usage')
    .select('used_count')

  let totalUsed = 0
  if (userId) {
    const { data } = await supabase
      .from('daily_free_usage')
      .select('used_count')
      .eq('user_id', userId)
    totalUsed = (data || []).reduce((sum, r) => sum + r.used_count, 0)
  } else if (guestId) {
    const { data } = await supabase
      .from('daily_free_usage')
      .select('used_count')
      .eq('guest_id', guestId)
    totalUsed = (data || []).reduce((sum, r) => sum + r.used_count, 0)
  } else {
    return { allowed: false, usedToday: FREE_TOTAL, remaining: 0, date }
  }

  const remaining = Math.max(0, FREE_TOTAL - totalUsed)
  return { allowed: remaining > 0, usedToday: totalUsed, remaining, date }
}

// 無料診断を1回消費（診断API成功後に呼ぶ）
export async function consumeFreeDiagnosis(
  guestId: string | null,
  userId: string | null
): Promise<void> {
  const supabase = createServiceClient()
  const date = todayJST()

  if (userId) {
    // upsert: レコードがあればused_count+1、なければ作成
    const { data: existing } = await supabase
      .from('daily_free_usage')
      .select('id, used_count')
      .eq('user_id', userId)
      .eq('date', date)
      .single()

    if (existing) {
      await supabase
        .from('daily_free_usage')
        .update({ used_count: existing.used_count + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('daily_free_usage')
        .insert({ user_id: userId, guest_id: null, date, used_count: 1 })
    }
  } else if (guestId) {
    const { data: existing } = await supabase
      .from('daily_free_usage')
      .select('id, used_count')
      .eq('guest_id', guestId)
      .eq('date', date)
      .single()

    if (existing) {
      await supabase
        .from('daily_free_usage')
        .update({ used_count: existing.used_count + 1, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('daily_free_usage')
        .insert({ guest_id: guestId, user_id: null, date, used_count: 1 })
    }
  }
}

// ========================================
// ゲストIDをユーザーIDに統合（ログイン後に呼ぶ）
// guest_id の daily_free_usage を user_id に付け替える
// ========================================
export async function mergeGuestToUser(
  guestId: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()
  const date = todayJST()

  // 今日のゲスト利用レコードを確認
  const { data: guestUsage } = await supabase
    .from('daily_free_usage')
    .select('id, used_count')
    .eq('guest_id', guestId)
    .eq('date', date)
    .single()

  if (!guestUsage) return

  // ユーザー側に今日のレコードがあるか確認
  const { data: userUsage } = await supabase
    .from('daily_free_usage')
    .select('id, used_count')
    .eq('user_id', userId)
    .eq('date', date)
    .single()

  if (userUsage) {
    // 両方あれば合算（上限はFREE_TOTAL）
    await supabase
      .from('daily_free_usage')
      .update({
        used_count: Math.min(FREE_TOTAL, userUsage.used_count + guestUsage.used_count),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userUsage.id)
    // ゲスト分は削除
    await supabase.from('daily_free_usage').delete().eq('id', guestUsage.id)
  } else {
    // ゲスト分をuser_idに付け替え
    await supabase
      .from('daily_free_usage')
      .update({ user_id: userId, guest_id: null, updated_at: new Date().toISOString() })
      .eq('id', guestUsage.id)
  }
}
