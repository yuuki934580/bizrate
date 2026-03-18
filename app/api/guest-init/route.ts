import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateGuest, fingerprintHash } from '@/lib/guest'

// ========================================
// GET /api/guest-init
// 初回アクセス時にguest_idを発行してcookieにセット
// ========================================
export async function GET(req: NextRequest) {
  try {
    // IP取得（Vercel/Cloudflare対応）
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'
    const fingerprint = fingerprintHash(ip, ua)

    // cookieから既存のguest_idを取得
    const existingGuestId = req.cookies.get('bizrate_guest_id')?.value || null

    const { guestId, isNew } = await getOrCreateGuest(existingGuestId, fingerprint)

    const res = NextResponse.json({ success: true, guestId, isNew })

    // cookieにセット（1年間有効・httpOnly・SameSite=Lax）
    res.cookies.set('bizrate_guest_id', guestId, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    })

    return res
  } catch (err) {
    console.error('guest-init error:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
