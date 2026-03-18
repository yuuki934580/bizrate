import Stripe from 'stripe'
import { CREDIT_PLANS } from '@/types'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function createCreditCheckoutSession(params: {
  planId: string
  userId?: string
  guestId?: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const plan = CREDIT_PLANS.find(p => p.id === params.planId)
  if (!plan) throw new Error(`Plan not found: ${params.planId}`)

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'jpy',
        product_data: {
          name: `ビジレート 診断クレジット【${plan.label}】`,
          description: `追加診断${plan.credits}回分（有効期限なし）`,
        },
        unit_amount: plan.price,
      },
      quantity: 1,
    }],
    metadata: {
      planId: plan.id,
      credits: String(plan.credits),
      userId:  params.userId  || '',
      guestId: params.guestId || '',
    },
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url:  params.cancelUrl,
    locale: 'ja',
  })

  return session.url!
}
