export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createCreditCheckoutSession } from '@/lib/stripe'
import { z } from 'zod'

const PurchaseSchema = z.object({
  planId:        z.string(),
  userId:        z.string().optional(),
  guestId:       z.string().optional(),
  pendingFormId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planId, userId, guestId, pendingFormId } = PurchaseSchema.parse(body)

    const cookieGuestId = req.cookies.get('bizrate_guest_id')?.value
    const resolvedGuestId = guestId || cookieGuestId

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = pendingFormId
      ? `${appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}&pfid=${pendingFormId}`
      : `${appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`

    const checkoutUrl = await createCreditCheckoutSession({
      planId,
      userId,
      guestId: resolvedGuestId,
      successUrl,
      cancelUrl: `${appUrl}/`,
    })

    return NextResponse.json({ success: true, url: checkoutUrl })
  } catch (err) {
    console.error('Purchase error:', err)
    return NextResponse.json({ success: false, error: '決済の開始に失敗しました' }, { status: 500 })
  }
}

