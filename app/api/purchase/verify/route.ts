import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

// GET /api/purchase/verify?session_id=cs_test_...
// Webhook処理済みか確認するエンドポイント
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'session_id is required' }, { status: 400 })
  }

  try {
    // Stripeでセッション状態を確認
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ success: false, reason: 'not_paid' })
    }

    // DBのpurchasesテーブルで付与済みか確認
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('purchases')
      .select('credits_purchased, status')
      .eq('stripe_session_id', sessionId)
      .eq('status', 'completed')
      .single()

    if (data) {
      return NextResponse.json({
        success: true,
        creditsAdded: data.credits_purchased,
      })
    }

    // Webhookまだ未処理
    return NextResponse.json({ success: false, reason: 'webhook_pending' })

  } catch (err) {
    console.error('verify error:', err)
    return NextResponse.json({ success: false, error: 'verification failed' }, { status: 500 })
  }
}
