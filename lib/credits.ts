import { createServiceClient } from './supabase'
import { createHash } from 'crypto'

// ========================================
// クレジット管理（ログインユーザー用）
// ========================================

export async function getUserCredits(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('credits')
    .eq('id', userId)
    .single()
  return data?.credits ?? 0
}

export async function consumeCredits(
  userId: string,
  amount: number,
  reason: 'diagnose' | 'cache_hit'
): Promise<{ success: boolean; remainingCredits: number; error?: string }> {
  if (reason === 'cache_hit') {
    const current = await getUserCredits(userId)
    return { success: true, remainingCredits: current }
  }
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('user_profiles').select('credits').eq('id', userId).single()
  if (!profile || profile.credits < amount) {
    return { success: false, remainingCredits: profile?.credits ?? 0, error: 'クレジット不足' }
  }
  const newCredits = profile.credits - amount
  const { error } = await supabase
    .from('user_profiles')
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { success: false, remainingCredits: profile.credits, error: '処理失敗' }
  await supabase.from('credit_transactions')
    .insert({ user_id: userId, delta: -amount, reason })
  return { success: true, remainingCredits: newCredits }
}

export async function addCredits(
  userId: string, amount: number,
  reason: 'purchase' | 'refund', stripeSessionId?: string
): Promise<{ success: boolean; newTotal: number }> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('user_profiles').select('credits').eq('id', userId).single()
  const current = profile?.credits ?? 0
  const newTotal = current + amount
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, credits: newTotal, updated_at: new Date().toISOString() })
  if (error) return { success: false, newTotal: current }
  await supabase.from('credit_transactions')
    .insert({ user_id: userId, delta: amount, reason, stripe_session_id: stripeSessionId })
  return { success: true, newTotal }
}

// ========================================
// クレジット管理（ゲストユーザー用）
// guest_creditsテーブルで管理
// ========================================

export async function getGuestCredits(guestId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('guest_credits')
    .select('credits')
    .eq('guest_id', guestId)
    .single()
  return data?.credits ?? 0
}

export async function consumeGuestCredits(
  guestId: string, amount: number
): Promise<{ success: boolean; remainingCredits: number }> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('guest_credits')
    .select('credits')
    .eq('guest_id', guestId)
    .single()
  const current = data?.credits ?? 0
  if (current < amount) {
    return { success: false, remainingCredits: current }
  }
  const newCredits = current - amount
  await supabase.from('guest_credits')
    .upsert({ guest_id: guestId, credits: newCredits, updated_at: new Date().toISOString() })
  return { success: true, remainingCredits: newCredits }
}

export async function addGuestCredits(
  guestId: string, amount: number, stripeSessionId?: string
): Promise<{ success: boolean; newTotal: number }> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('guest_credits')
    .select('credits')
    .eq('guest_id', guestId)
    .single()
  const current = data?.credits ?? 0
  const newTotal = current + amount
  await supabase.from('guest_credits')
    .upsert({ guest_id: guestId, credits: newTotal, updated_at: new Date().toISOString() })
  if (stripeSessionId) {
    await supabase.from('guest_credit_transactions')
      .insert({ guest_id: guestId, delta: amount, reason: 'purchase', stripe_session_id: stripeSessionId })
  }
  return { success: true, newTotal }
}

// ========================================
// キャッシュ・ハッシュ
// ========================================

export async function findCachedDiagnosis(inputsHash: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('diagnoses')
    .select('id, result')
    .eq('inputs_hash', inputsHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data || null
}

export function hashInputs(inputs: object): string {
  const str = JSON.stringify(inputs, Object.keys(inputs).sort())
  return createHash('sha256').update(str).digest('hex').slice(0, 16)
}
