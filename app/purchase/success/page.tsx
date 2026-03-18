'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function PurchaseSuccessInner() {
  const searchParams = useSearchParams()
  const sessionId  = searchParams.get('session_id')
  const pfid       = searchParams.get('pfid')

  const [status, setStatus]     = useState<'verifying' | 'done' | 'error'>('verifying')
  const [credits, setCredits]   = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!sessionId) { setErrorMsg('セッションIDが見つかりません。'); setStatus('error'); return }
    const verify = async (attempt = 0) => {
      try {
        const res  = await fetch(`/api/purchase/verify?session_id=${sessionId}`)
        const data = await res.json()
        if (data.success) { setCredits(data.creditsAdded); setStatus('done') }
        else if (attempt < 8) setTimeout(() => verify(attempt + 1), 2000)
        else setStatus('done')
      } catch {
        if (attempt < 3) setTimeout(() => verify(attempt + 1), 2000)
        else setStatus('done')
      }
    }
    verify()
  }, [sessionId])

  useEffect(() => {
    if (status !== 'done') return
    const redirect = () => {
      if (pfid) {
        window.location.href = `/?pending=${pfid}`
        return
      }
      window.location.href = '/'
    }
    const t = setTimeout(redirect, 2000)
    return () => clearTimeout(t)
  }, [status, pfid])

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      {status === 'verifying' && (
        <>
          <div style={{ width: 56, height: 56, border: '3px solid #00ff8830', borderTop: '3px solid #00ff88', borderRadius: '50%', margin: '0 auto 28px', animation: 'spin 1.2s linear infinite' }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#eaeaea', marginBottom: 10 }}>購入を確認中...</h2>
          <p style={{ fontSize: 13, color: '#555' }}>クレジットを付与しています。少々お待ちください。</p>
        </>
      )}
      {status === 'done' && (
        <>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🎉</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#00ff88', marginBottom: 10 }}>購入ありがとうございます！</h2>
          {credits !== null && (
            <div style={{ background: '#00ff8815', border: '1px solid #00ff8840', borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'inline-block' }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#00ff88', fontFamily: 'Space Mono, monospace' }}>{credits} CR</span>
              <span style={{ fontSize: 13, color: '#00ff88', marginLeft: 8 }}>が追加されました</span>
            </div>
          )}
          <p style={{ fontSize: 14, color: '#888', marginBottom: 16, lineHeight: 1.7 }}>
            このまま診断を続けます。<br />自動的に戻ります…
          </p>
          <div style={{ width: 40, height: 40, border: '3px solid #00ff8830', borderTop: '3px solid #00ff88', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f87171', marginBottom: 10 }}>エラーが発生しました</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{errorMsg}</p>
          <a href="/" style={{ display: 'inline-block', marginTop: 20, fontSize: 13, color: '#00ff88', fontFamily: 'Space Mono, monospace' }}>← トップに戻る</a>
        </>
      )}
    </div>
  )
}

export default function PurchaseSuccess() {
  return (
    <>
      <div style={{ borderBottom: '1px solid #0f0f0f', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10, background: '#050505' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88' }} />
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#00ff88', letterSpacing: 2 }}>ビジレート</span>
      </div>
      <Suspense fallback={
        <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, border: '3px solid #00ff8830', borderTop: '3px solid #00ff88', borderRadius: '50%', margin: '0 auto 28px', animation: 'spin 1.2s linear infinite' }} />
          <p style={{ color: '#555' }}>読み込み中...</p>
        </div>
      }>
        <PurchaseSuccessInner />
      </Suspense>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
