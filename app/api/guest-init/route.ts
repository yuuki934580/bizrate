export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateGuest, fingerprintHash } from '@/lib/guest'

// ========================================
// GET /api/guest-init
// 蛻晏屓繧｢繧ｯ繧ｻ繧ｹ譎ゅ↓guest_id繧堤匱陦後＠縺ｦcookie縺ｫ繧ｻ繝・ヨ
// ========================================
export async function GET(req: NextRequest) {
  try {
    // IP蜿門ｾ暦ｼ・ercel/Cloudflare蟇ｾ蠢懶ｼ・    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'
    const fingerprint = fingerprintHash(ip, ua)

    // cookie縺九ｉ譌｢蟄倥・guest_id繧貞叙蠕・    const existingGuestId = req.cookies.get('bizrate_guest_id')?.value || null

    const { guestId, isNew } = await getOrCreateGuest(existingGuestId, fingerprint)

    const res = NextResponse.json({ success: true, guestId, isNew })

    // cookie縺ｫ繧ｻ繝・ヨ・・蟷ｴ髢捺怏蜉ｹ繝ｻhttpOnly繝ｻSameSite=Lax・・    res.cookies.set('bizrate_guest_id', guestId, {
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

