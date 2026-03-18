import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { addCredits, addGuestCredits } from '@/lib/credits'
import { createServiceClient } from '@/lib/supabase'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { planId, credits, userId, guestId } = session.metadata || {}
      const creditAmount = Number(credits) || 0

      console.log('[webhook] session completed:', { planId, credits, creditAmount, userId, guestId })

      const supabase = createServiceClient()

      const { error: upsertErr } = await supabase.from('purchases').upsert({
        user_id:           userId  || null,
        guest_id:          guestId || null,
        stripe_session_id: session.id,
        credits_purchased: creditAmount,
        amount_jpy:        session.amount_total || 0,
        status:            'completed',
      })
      if (upsertErr) console.error('[webhook] purchases upsert error:', upsertErr)

      if (userId) {
        const result = await addCredits(userId, creditAmount, 'purchase', session.id)
        console.log('[webhook] addCredits result:', result)
      } else if (guestId) {
        const result = await addGuestCredits(guestId, creditAmount, session.id)
        console.log('[webhook] addGuestCredits result:', result)
      } else {
        console.error('[webhook] no userId or guestId in metadata!')
      }
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
