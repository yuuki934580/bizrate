'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DiagnosisResult, CalculatedMetricsV3 } from '@/types'
import { SCORE_FORMULA_DISPLAY, SCORE_WEIGHTS_DEFAULT, FIVE_AXES, SCORE_LABELS, DISCLAIMER, CREDIT_COSTS, CREDIT_PLANS, SIGNUP_BONUS_CREDITS, BUSINESS_MODEL_OPTIONS } from '@/types'

// ========================================
// 定数
// ========================================
const CHANNEL_OPTIONS = ['SNS（Twitter/Instagram等）', 'LP（ランディングページ）', 'クラウドソーシング', 'YouTube', 'note/ブログ', 'メルマガ', '知人・口コミ', 'プラットフォーム（ストアカ等）']
const TIME_OPTIONS = ['週5時間未満', '週5〜10時間', '週10〜20時間', '週20時間以上']
const BUDGET_OPTIONS = ['0円（完全無料）', '〜1万円', '〜5万円', '10万円以上']

const AXIS_COLORS: Record<string, string> = {
  market: '#00ff88', competition: '#f97316', revenueStructure: '#38bdf8',
  executionDifficulty: '#a78bfa', aiResistance: '#fbbf24',
}
const IMP_COLORS: Record<string, string> = { high: '#00ff88', medium: '#fbbf24', low: '#555' }

function getScoreGrade(score: number) {
  if (score >= 80) return { label: '実行推奨',   color: '#00ff88', bg: '#00ff8815' }
  if (score >= 65) return { label: '改善余地あり', color: '#fbbf24', bg: '#fbbf2415' }
  if (score >= 50) return { label: '再設計推奨',  color: '#f97316', bg: '#f9731615' }
  return              { label: '撤退検討',   color: '#f87171', bg: '#f8717115' }
}

// 確率バーの色
function getProbColor(pct: number) {
  if (pct >= 60) return '#00ff88'
  if (pct >= 35) return '#fbbf24'
  if (pct >= 15) return '#f97316'
  return '#f87171'
}

// ========================================
// SVGレーダーチャート
// ========================================
function RadarChart({ scores, size = 260 }: { scores: DiagnosisResult['scores']; size?: number }) {
  const [animProgress, setAnimProgress] = useState(0)
  const rafRef = useRef<number>()
  useEffect(() => {
    let start: number | null = null
    const animate = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 900, 1)
      setAnimProgress(1 - Math.pow(1 - p, 3))
      if (p < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [scores])

  const cx = size / 2, cy = size / 2, maxR = size * 0.38
  const axes = FIVE_AXES
  const angle = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2
  const polarToXY = (r: number, i: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) })
  const dataPoints = axes.map((key, i) => {
    const r = ((scores[key as keyof typeof scores] as number) / 100) * maxR * animProgress
    return polarToXY(r, i)
  })
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {[20, 40, 60, 80, 100].map(lv => {
        const pts = axes.map((_, i) => polarToXY((lv / 100) * maxR, i))
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'
        return <path key={lv} d={path} fill="none" stroke={lv === 100 ? '#2a2a2a' : '#1a1a1a'} strokeWidth={lv === 100 ? 1.5 : 1} />
      })}
      {axes.map((_, i) => { const o = polarToXY(maxR, i); return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="#1a1a1a" strokeWidth={1} /> })}
      {/* 理想ライン（80点） */}
      {(() => {
        const idealR = (80 / 100) * maxR
        const idealPts = axes.map((_, i) => polarToXY(idealR, i))
        const idealPath = idealPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'
        return <path d={idealPath} fill="none" stroke="#ffffff18" strokeWidth={1.5} strokeDasharray="4 3" />
      })()}
      <path d={dataPath} fill="#00ff8818" stroke="#00ff88" strokeWidth={2} />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={AXIS_COLORS[axes[i]]} stroke="#050505" strokeWidth={1.5} />)}
      {axes.map((key, i) => {
        const pos = polarToXY(maxR + 22, i)
        return (
          <g key={key}>
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={AXIS_COLORS[key]} fontFamily="Space Mono, monospace">{SCORE_LABELS[key]}</text>
            <text x={pos.x} y={pos.y + 14} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill={AXIS_COLORS[key]} fontFamily="Space Mono, monospace" fontWeight="700">{scores[key as keyof typeof scores] as number}</text>
          </g>
        )
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={9} fill="#444" fontFamily="Space Mono, monospace">TOTAL</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={20} fontWeight="700" fill="#00ff88" fontFamily="Space Mono, monospace">{scores.total}</text>
      {/* 理想値凡例 */}
      <g transform={`translate(${size - 10}, ${size - 10})`}>
        <line x1={-72} y1={0} x2={-60} y2={0} stroke="#ffffff40" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={-56} y={0} textAnchor="start" dominantBaseline="middle" fontSize={9} fill="#555" fontFamily="Space Mono, monospace">理想的なバランス（参考値）</text>
      </g>
    </svg>
  )
}

// ========================================
// UI部品
// ========================================
function SectionLabel({ num, label, required, sub }: { num: string | number; label: string; required?: boolean; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#00ff8820', border: '1px solid #00ff8840', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#00ff88', fontFamily: 'Space Mono, monospace', fontWeight: 700, flexShrink: 0 }}>{num}</div>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#eaeaea' }}>{label}</span>
      {required && <span style={{ fontSize: 10, color: '#f43f5e', fontFamily: 'Space Mono, monospace' }}>必須</span>}
      {sub && <span style={{ fontSize: 11, color: '#555' }}>{sub}</span>}
    </div>
  )
}

function FormBlock({ label, sub, required, children, note }: { label: string; sub?: string; required?: boolean; children: React.ReactNode; note?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#eaeaea' }}>{label}</span>
        {required && <span style={{ fontSize: 10, color: '#f43f5e', fontFamily: 'Space Mono, monospace' }}>必須</span>}
        {sub && <span style={{ fontSize: 12, color: '#666' }}>{sub}</span>}
      </div>
      {note && <p style={{ fontSize: 11, color: '#555', marginBottom: 8, lineHeight: 1.5 }}>{note}</p>}
      {children}
    </div>
  )
}
function Textarea({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder: string; maxLength?: number }) {
  return (
    <div style={{ position: 'relative' }}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={3}
        style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 14px', color: '#eaeaea', fontSize: 15, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }} />
      {maxLength && <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: value.length > (maxLength * 0.9) ? '#f43f5e' : '#333', fontFamily: 'Space Mono, monospace' }}>{value.length}/{maxLength}</div>}
    </div>
  )
}
function Textinput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, padding: '11px 14px', color: '#eaeaea', fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
}
function Tag({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: selected ? '#00ff8818' : '#0d0d0d', border: `1px solid ${selected ? '#00ff88' : '#222'}`, borderRadius: 6, padding: '7px 13px', color: selected ? '#00ff88' : '#888', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
      {label}
    </button>
  )
}
function RadioOpt({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${selected ? '#00ff88' : '#2a2a2a'}`, background: selected ? '#00ff8818' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {selected && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88' }} />}
      </div>
      <span style={{ fontSize: 14, color: selected ? '#eaeaea' : '#888' }}>{label}</span>
    </label>
  )
}
function Toggle({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {(['可', '不可'] as const).map(opt => {
        const sel = opt === '可' ? value === true : value === false
        return <button key={opt} type="button" onClick={() => onChange(opt === '可')} style={{ background: sel ? '#00ff8818' : '#0d0d0d', border: `1px solid ${sel ? '#00ff88' : '#222'}`, borderRadius: 6, padding: '7px 20px', color: sel ? '#00ff88' : '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{opt}</button>
      })}
    </div>
  )
}
function CreditBadge({ credits, onBuy }: { credits: number | null; onBuy: () => void }) {
  if (credits === null) return null
  const low = credits <= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ background: low ? '#ff000015' : '#00ff8815', border: `1px solid ${low ? '#ff000040' : '#00ff8840'}`, borderRadius: 20, padding: '4px 12px' }}>
        <span style={{ fontSize: 10, color: low ? '#f87171' : '#00ff88', fontFamily: 'Space Mono, monospace' }}>⬡ {credits} CR</span>
      </div>
      {low && <button onClick={onBuy} style={{ fontSize: 11, color: '#fbbf24', background: 'none', border: '1px solid #fbbf2440', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>チャージ</button>}
    </div>
  )
}
function CreditModal({ remaining, onClose, onBuy }: { remaining: number; onClose: () => void; onBuy: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000dd', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 16, padding: '28px 24px', maxWidth: 400, width: '100%' }}>
        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 8 }}>⬡ CREDIT SHOP</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#eaeaea', marginBottom: 4 }}>追加診断クレジット</h3>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            1日1回の無料枠を超えた診断に使えます。<br />
            クレジットは有効期限なし。
          </p>
          {remaining > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', fontFamily: 'Space Mono, monospace' }}>
              現在の残高: {remaining} CR
            </div>
          )}
        </div>

        {/* プラン一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {CREDIT_PLANS.map(p => (
            <button key={p.id} onClick={() => onBuy(p.id)} style={{
              background: p.popular ? '#00ff8812' : '#111',
              border: `1px solid ${p.popular ? '#00ff8850' : '#222'}`,
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'relative', transition: 'border-color 0.15s',
            }}>
              {p.popular && (
                <div style={{ position: 'absolute', top: -1, right: 12, background: '#00ff88', color: '#000', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: '0 0 6px 6px', fontFamily: 'Space Mono, monospace' }}>
                  おすすめ
                </div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: p.popular ? '#00ff88' : '#eaeaea', marginBottom: 2 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{(p as any).desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24', fontFamily: 'Space Mono, monospace' }}>
                  ¥{p.price.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#444', fontFamily: 'Space Mono, monospace' }}>{p.credits}クレジット</div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, color: '#2a2a2a', textAlign: 'center', marginBottom: 12, fontFamily: 'Space Mono, monospace' }}>
          Stripe決済 ／ クレジットカード対応
        </p>
        <button onClick={onClose} style={{ width: '100%', background: 'none', border: '1px solid #1a1a1a', borderRadius: 8, padding: 10, color: '#444', fontSize: 13, cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>
          キャンセル
        </button>
      </div>
    </div>
  )
}
function ScoreBar({ axisKey, value, breakdown }: { axisKey: string; value: number; breakdown: any }) {
  const [open, setOpen] = useState(false)
  const color = AXIS_COLORS[axisKey] || '#888'
  const label = SCORE_LABELS[axisKey as keyof typeof SCORE_LABELS] || axisKey
  const w = SCORE_WEIGHTS_DEFAULT[axisKey as keyof typeof SCORE_WEIGHTS_DEFAULT]
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 13, color: '#b8b8b8', width: 100, flexShrink: 0 }}>{label}{w?.inverse ? ' ↓優' : ''}</span>
        <div style={{ flex: 1, height: 7, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 4, transition: 'width 1s ease' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Space Mono, monospace', width: 32, textAlign: 'right' }}>{value}</span>
        <span style={{ fontSize: 9, color: '#444', width: 56, fontFamily: 'Space Mono, monospace', textAlign: 'right' }}>重要度{w ? w.weight * 100 : '?'}%</span>
        <span style={{ fontSize: 10, color: '#333' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && breakdown && (
        <div style={{ background: '#080808', borderRadius: 8, padding: 14, marginLeft: 110, fontSize: 13, color: '#b8b8b8', lineHeight: 1.7, borderLeft: `2px solid ${color}40` }}>
          <div style={{ color: '#eaeaea', marginBottom: 6 }}>{breakdown.reasoning}</div>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 3 }}><span style={{ color: '#555' }}>評価軸：</span>{breakdown.evaluationAxes?.join(' / ')}</div>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 3 }}><span style={{ color: '#555' }}>推定要素：</span>{breakdown.estimatedFactors?.join('、')}</div>
          <div style={{ fontSize: 12, color: '#666' }}><span style={{ color: '#444' }}>データ根拠：</span>{breakdown.dataSource}</div>
        </div>
      )}
    </div>
  )
}
function ImpCard({ item, index }: { item: DiagnosisResult['improvements'][0]; index: number }) {
  const [open, setOpen] = useState(false)
  const c = IMP_COLORS[item.impact]
  const impactLabel = item.impact === 'high' ? '優先度：高' : item.impact === 'medium' ? '優先度：中' : '優先度：低'
  return (
    <div style={{ background: '#0a0a0a', border: `1px solid ${open ? c + '50' : '#1a1a1a'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div style={{ padding: '15px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }} onClick={() => setOpen(!open)}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: c + '20', border: `1px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: c, fontFamily: 'Space Mono, monospace', flexShrink: 0, marginTop: 1 }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 10, color: c, background: c + '15', border: `1px solid ${c}30`, borderRadius: 4, padding: '2px 8px', fontFamily: 'Space Mono, monospace', marginBottom: 6, display: 'inline-block' }}>{impactLabel}</span>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: '#eaeaea', lineHeight: 1.55 }}>{item.title}</p>
        </div>
        <span style={{ fontSize: 10, color: '#444', flexShrink: 0, marginTop: 4 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #141414', padding: '14px 18px 14px 54px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#b8b8b8', lineHeight: 1.7 }}>{item.detail}</p>
          <div style={{ background: '#111', borderRadius: 8, padding: 12, borderLeft: `3px solid ${c}60` }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 4, fontFamily: 'Space Mono, monospace' }}>▸ 今すぐやること</div>
            <p style={{ margin: 0, fontSize: 15, color: c, fontWeight: 700, lineHeight: 1.5 }}>→ {item.specificAction}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ========================================
// 月収達成確率ブロック
// ========================================
function AchievementBlock({ achievement, revenueEstimate }: {
  achievement: CalculatedMetricsV3['achievement']
  revenueEstimate?: any
}) {
  const items = [
    { label: '月3万円達成確率',  value: achievement.monthly30k,  sub: '副業スタートライン' },
    { label: '月10万円達成確率', value: achievement.monthly100k, sub: '本業超えの目安' },
    { label: '月30万円達成確率', value: achievement.monthly300k, sub: 'フリーランス水準' },
  ]
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #00ff8820', borderRadius: 14, padding: '22px 20px', marginBottom: 24 }}>
      <div style={{ fontSize: 10, color: '#00ff88', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 6 }}>📊 月収達成確率（3ヶ月以内）</div>

      {/* 計算内訳 */}
      {revenueEstimate && (
        <div style={{ background: '#111', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 11, fontFamily: 'Space Mono, monospace', lineHeight: 1.8 }}>
          <div style={{ color: '#444', marginBottom: 4 }}>▸ 算出根拠</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', color: '#555' }}>
            <span>想定月間流入数</span><span style={{ color: '#888' }}>{revenueEstimate.monthlyTraffic.toLocaleString()}人</span>
            <span>購入率</span><span style={{ color: '#888' }}>{revenueEstimate.convRate}%</span>
            <span>現実的な月間販売数</span><span style={{ color: revenueEstimate.realisticMonthlySales >= revenueEstimate.requiredFor30k ? '#00ff88' : '#f87171' }}>{revenueEstimate.realisticMonthlySales}件</span>
            <span>月3万に必要な販売数</span><span style={{ color: '#888' }}>{revenueEstimate.requiredFor30k}件</span>
            <span>想定月収</span><span style={{ color: '#fbbf24' }}>¥{revenueEstimate.realisticMonthlyRevenue.toLocaleString()}</span>
          </div>
        </div>
      )}
      {!revenueEstimate && (
        <p style={{ fontSize: 11, color: '#444', marginBottom: 14, fontFamily: 'Space Mono, monospace' }}>※市場性・競争密度・価格から流入数×購入率で算出</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(({ label, value, sub }) => {
          const color = getProbColor(value)
          return (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 14, color: '#eaeaea', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>{sub}</span>
                </div>
                <span style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>{value}%</span>
              </div>
              <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 4, transition: 'width 1.2s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ========================================
// 弱点ランキング
// ========================================
function WeaknessRankBlock({ weaknessRanking }: { weaknessRanking: CalculatedMetricsV3['weaknessRanking'] }) {
  const top3 = weaknessRanking.slice(0, 3)
  const rankColors = ['#f87171', '#f97316', '#fbbf24']
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #f8717120', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 10, color: '#f87171', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 14 }}>⚠ このビジネスの弱点</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {top3.map(({ rank, label, score, isInverse, rawScore }) => (
          <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: rankColors[rank - 1] + '20', border: `1px solid ${rankColors[rank - 1]}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: rankColors[rank - 1], fontFamily: 'Space Mono, monospace' }}>{rank}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#eaeaea', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 11, color: '#555', fontFamily: 'Space Mono, monospace' }}>
                スコア {rawScore}{isInverse ? ' ↑ 高いほど不利' : ''}　実効値 {score}
              </div>
            </div>
            <div style={{ height: 6, width: 80, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: '100%', width: `${score}%`, background: rankColors[rank - 1], borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ========================================
// 診断結果ビュー
// ========================================
function ResultView({ result, diagnosisId, userId, currentPrice, prevScore, onCreditShort, onReset, onRediagnose }: {
  result: DiagnosisResult
  diagnosisId: string | null
  userId: string | null
  currentPrice?: string
  prevScore?: number | null
  onCreditShort: (rem: number) => void
  onReset: () => void
  onRediagnose: () => void
}) {


  const grade = getScoreGrade(result.scores.total)
  const cm = result.calculatedMetrics as CalculatedMetricsV3 | undefined

  if (!cm) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555', fontFamily: 'Space Mono, monospace', fontSize: 13 }}>
        <p>⚠ キャッシュデータが古い形式です。</p>
        <button onClick={onRediagnose} style={{ marginTop: 16, background: 'linear-gradient(135deg,#00ff88,#00cc6a)', border: 'none', borderRadius: 8, padding: '12px 24px', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>再診断する</button>
      </div>
    )
  }

  const { salesModel: sm, improvements } = result

  return (
    <div>
      {/* ① 総合スコア */}
      <div style={{ background: '#0a0a0a', border: `2px solid ${grade.color}30`, borderRadius: 14, padding: '28px 24px', marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 10 }}>BIZRATE TOTAL SCORE</div>
        <div style={{ fontSize: 88, fontWeight: 700, color: grade.color, fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>{result.scores.total}</div>

        {/* 改善前後の比較 */}
        {prevScore != null && (() => {
          const diff = result.scores.total - prevScore
          const diffColor = diff > 0 ? '#00ff88' : diff < 0 ? '#f87171' : '#555'
          const diffLabel = diff > 0 ? `+${diff}` : `${diff}`
          return (
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 10, background: '#111', border: `1px solid ${diffColor}30`, borderRadius: 12, padding: '8px 20px' }}>
              <span style={{ fontSize: 12, color: '#555', fontFamily: 'Space Mono, monospace' }}>改善前</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#555', fontFamily: 'Space Mono, monospace' }}>{prevScore}</span>
              <span style={{ fontSize: 14, color: '#333' }}>→</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: grade.color, fontFamily: 'Space Mono, monospace' }}>{result.scores.total}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: diffColor, fontFamily: 'Space Mono, monospace', background: `${diffColor}15`, borderRadius: 6, padding: '2px 10px' }}>{diffLabel}</span>
            </div>
          )
        })()}
        <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: grade.bg, border: `1px solid ${grade.color}40`, borderRadius: 20, padding: '6px 18px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: grade.color, fontFamily: 'Space Mono, monospace' }}>{grade.label}</span>
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[{ range: '〜49', label: '撤退検討', color: '#f87171' }, { range: '50〜', label: '再設計推奨', color: '#f97316' }, { range: '65〜', label: '改善余地あり', color: '#fbbf24' }, { range: '80〜', label: '実行推奨', color: '#00ff88' }].map(g => (
            <div key={g.range} style={{ fontSize: 10, color: '#333', fontFamily: 'Space Mono, monospace', background: '#111', borderRadius: 4, padding: '3px 8px', border: `1px solid ${g.color}20` }}>{g.range} {g.label}</div>
          ))}
        </div>
        <p style={{ fontSize: 15, color: '#b8b8b8', lineHeight: 1.75, maxWidth: 520, margin: '16px auto 14px' }}>{result.summary}</p>
        <div style={{ display: 'inline-block', background: '#00ff8810', border: '1px solid #00ff8830', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#00ff88' }}>
          💪 {result.structuralStrength}
        </div>
      </div>

      {/* レーダーチャート */}
      <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 16px', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: '#555', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 16 }}>5軸レーダーチャート</div>
        <RadarChart scores={result.scores} size={280} />
        <div style={{ marginTop: 16, background: '#0a0a0a', borderRadius: 8, padding: '10px 16px', fontSize: 10, color: '#444', fontFamily: 'Space Mono, monospace', lineHeight: 1.7, textAlign: 'center' }}>{SCORE_FORMULA_DISPLAY}</div>
      </div>

      {/* スコア内訳 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 6, fontFamily: 'Space Mono, monospace' }}>▸ スコア内訳（タップで算出根拠を表示）</div>
        <p style={{ fontSize: 11, color: '#444', marginBottom: 14, lineHeight: 1.5 }}>※重要度は総合スコアへの影響度を示します。</p>
        {FIVE_AXES.map(key => <ScoreBar key={key} axisKey={key} value={result.scores[key]} breakdown={result.scoreBreakdown[key]} />)}
      </div>

      {/* ③ ボトルネック */}
      <div style={{ background: '#0a0a0a', border: '1px solid #f8717130', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#f87171', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 8 }}>⚠ BOTTLENECK</div>
        <p style={{ margin: 0, fontSize: 16, color: '#eaeaea', lineHeight: 1.65, fontWeight: 600 }}>{result.bottleneck}</p>
      </div>

      {/* 弱点ランキング削除済み */}

      {/* 推奨販売モデル */}
      <div style={{ background: '#0a0a0a', border: '1px solid #38bdf830', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#38bdf8', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 10 }}>📦 推奨販売モデル</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8', fontFamily: 'Space Mono, monospace' }}>{sm.primaryLabel}</span>
          <span style={{ fontSize: 11, background: '#38bdf815', border: '1px solid #38bdf830', borderRadius: 6, padding: '3px 10px', color: '#38bdf8', fontFamily: 'Space Mono, monospace' }}>推奨</span>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 15, color: '#b8b8b8', lineHeight: 1.65 }}>{sm.reason}</p>
        {sm.alternative && <p style={{ margin: 0, fontSize: 13, color: '#555' }}>代替案：{sm.alternative}（{sm.alternativeReason}）</p>}
      </div>

      {/* 改善提案 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 14, fontFamily: 'Space Mono, monospace' }}>▸ スコア改善のヒント（タップで詳細を表示）</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {improvements.length === 0
            ? <div style={{ background: '#0a1a0a', border: '1px solid #00ff8830', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#00ff88' }}>✓ 重大な構造問題は見つかりません</div>
            : improvements.map((item, i) => <ImpCard key={i} item={item} index={i} />)
          }
        </div>
      </div>

      {/* 収益化ヒント */}
      {result.revenueHints && result.revenueHints.length > 0 && (
        <div style={{ background: '#0a0a0a', border: '1px solid #00ff8820', borderRadius: 12, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: '#00ff88', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 14 }}>💡 収益化のヒント</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.revenueHints.map((hint, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#00ff8815', border: '1px solid #00ff8840', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#00ff88', fontFamily: 'Space Mono, monospace', flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                <p style={{ margin: 0, fontSize: 14, color: '#b8b8b8', lineHeight: 1.65 }}>{hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}



      <div style={{ background: '#080808', border: '1px solid #111', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: '#333', lineHeight: 1.7, fontFamily: 'Space Mono, monospace', margin: 0 }}>⚠ {DISCLAIMER}</p>
      </div>

      {/* 改善ヒント（改善する前に確認） */}
      {improvements.length > 0 && (
        <div style={{ background: '#0a1a0a', border: '1px solid #00ff8825', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#00ff88', fontFamily: 'Space Mono, monospace', marginBottom: 8 }}>💡 改善して再診断するには</div>
          <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.7 }}>
            上の改善方向を参考にフォームの内容を修正してから「このアイデアを改善する」を押してください。<br />
            <span style={{ color: '#333' }}>※同じ内容のまま再診断しても結果は変わりません。</span>
          </p>
        </div>
      )}

      {/* アクションボタン */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onRediagnose}
          style={{ background: 'linear-gradient(135deg,#00ff88,#00cc6a)', border: 'none', borderRadius: 10, padding: '15px', color: '#000', fontSize: 15, cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontWeight: 700, boxShadow: '0 0 24px #00ff8430' }}>
          ✏ 内容を修正して再診断する
        </button>
        <button onClick={onReset}
          style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 10, padding: '13px', color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>
          ↩ 別のビジネスを診断する
        </button>
      </div>
    </div>
  )
}

// ========================================
// メインアプリ
// ========================================
export default function Home() {
  const [businessSummary, setBusinessSummary] = useState('')
  const [whatToSell, setWhatToSell] = useState('')
  const [whoFor, setWhoFor] = useState('')
  const [differentiation, setDifferentiation] = useState('')
  const [salesChannel, setSalesChannel] = useState<string[]>([])
  const [businessModel, setBusinessModel] = useState<string[]>([])
  const [currentPrice, setCurrentPrice] = useState('')
  const [initialBudget, setInitialBudget] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [canShowFace, setCanShowFace] = useState<boolean | undefined>()
  const [canDoSales, setCanDoSales] = useState<boolean | undefined>()
  const [showOptional, setShowOptional] = useState(false)

  const [phase, setPhase] = useState<'input' | 'loading' | 'results'>('input')
  const [noCache, setNoCache] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [prevScore, setPrevScore] = useState<number | null>(null)
  const [diagnosisId, setDiagnosisId] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dailyLimitReached, setDailyLimitReached] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [userId] = useState<string | null>(null)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditShortAmt, setCreditShortAmt] = useState(0)

  // guest-init（初回アクセス時にguest_idを発行・取得）
  useEffect(() => {
    fetch('/api/guest-init')
      .then(r => r.json())
      .then(d => { if (d.guestId) setGuestId(d.guestId) })
      .catch(() => {})
  }, [])

  const valueProposition = [whatToSell, whoFor, differentiation].filter(Boolean).join(' / ')
  const isValid = businessSummary.trim().length >= 10 && whoFor.trim() && whatToSell.trim() && businessModel.length > 0

  const LOADING_STEPS = ['ビジネス構造を解析中...', '5軸スコアを算出中...', '競争環境を評価中...', '改善ヒントを生成中...', 'レポートを整理中...']

  // フォームデータを引数で受け取れる共通診断ロジック（通常 + 決済後自動実行の両方で使う）
  const runDiagnosisRef = useRef<(form: any, pfid?: string) => void>(() => {})

  const runDiagnosisWithForm = useCallback(async (form: {
    businessSummary: string; whoFor: string; whatToSell: string
    differentiation?: string; salesChannel: string[]; businessModel: string[]
    currentPrice?: string; initialBudget?: string; weeklyHours?: string
    canShowFace?: boolean; canDoSales?: boolean
  }, pfid?: string) => {
    setError(null); setPhase('loading')
    let step = 0; setLoadingMsg(LOADING_STEPS[0])
    const iv = setInterval(() => { step = Math.min(step + 1, LOADING_STEPS.length - 1); setLoadingMsg(LOADING_STEPS[step]) }, 1000)
    const vp = [form.whatToSell, form.whoFor, form.differentiation].filter(Boolean).join(' / ')
    try {
      const body: any = {
        businessSummary: form.businessSummary,
        valueProposition: vp,
        salesChannel: form.salesChannel.join('、'),
        businessModel: form.businessModel.join(','),
        ...(form.currentPrice  && { currentPrice: form.currentPrice }),
        ...(form.initialBudget && { initialBudget: form.initialBudget }),
        ...(form.weeklyHours   && { weeklyHours: form.weeklyHours }),
        ...(form.canShowFace !== undefined && { canShowFace: form.canShowFace }),
        ...(form.canDoSales  !== undefined && { canDoSales: form.canDoSales }),
        ...(userId && { userId }),
        ...(pfid && { pfid }),
        ...((form.guestId || guestId) && { guestId: form.guestId || guestId }),
        ...(noCache && { noCache: true }),
      }
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      clearInterval(iv)
      if (data.errorCode === 'DAILY_LIMIT_REACHED') { setPhase('input'); setDailyLimitReached(true); return }
      if (data.errorCode === 'INSUFFICIENT_CREDITS') { setPhase('input'); setCreditShortAmt(data.remainingCredits ?? 0); setShowCreditModal(true); return }
      if (!data.success) throw new Error(data.error || '診断に失敗しました')
      setResult(data.result); setDiagnosisId(data.diagnosisId); setFromCache(data.fromCache)
      setNoCache(false)
      setPhase('results')
    } catch (err) {
      clearInterval(iv)
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました')
      setPhase('input')
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // refを常に最新のrunDiagnosisWithFormに同期
  useEffect(() => { runDiagnosisRef.current = runDiagnosisWithForm }, [runDiagnosisWithForm])

  // 決済後の復元: ?pending=pfid でDBからフォームデータを取得して自動診断
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pfid = params.get('pending')
    if (!pfid) return
    const restore = async () => {
      try {
        const res  = await fetch(`/api/pending-form?id=${pfid}`)
        const data = await res.json()
        if (!data.form) return
        const form = data.form
        setBusinessSummary(form.businessSummary || '')
        setWhatToSell(form.whatToSell || '')
        setWhoFor(form.whoFor || '')
        setDifferentiation(form.differentiation || '')
        setSalesChannel(form.salesChannel || [])
        setBusinessModel(form.businessModel || [])
        setCurrentPrice(form.currentPrice || '')
        setInitialBudget(form.initialBudget || '')
        setWeeklyHours(form.weeklyHours || '')
        setCanShowFace(form.canShowFace)
        setCanDoSales(form.canDoSales)
        // フォーム取得・診断開始の後にURLを削除
        window.history.replaceState({}, '', '/')
        // 必須フィールドが揃っているか確認してから診断実行
        if (!form.businessSummary || !form.whoFor || !form.whatToSell || !form.businessModel?.length) {
          console.error('[bizrate] restore: missing required fields', form)
          return
        }
        runDiagnosisRef.current(form, pfid)
      } catch (err) {
        console.error('pending restore error', err)
      }
    }
    restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDiagnose = async () => {
    if (!isValid) return
    runDiagnosisWithForm({
      businessSummary, whoFor, whatToSell,
      differentiation, salesChannel, businessModel,
      currentPrice, initialBudget, weeklyHours,
      canShowFace, canDoSales,
    })
  }

  const handleBuyCredits = async (planId: string) => {
    try {
      // フォームデータをDBに一時保存（sessionStorageはStripe経由で消えるため）
      const formSnapshot = {
        businessSummary, whoFor, whatToSell,
        differentiation, salesChannel, businessModel,
        currentPrice, initialBudget, weeklyHours,
        canShowFace, canDoSales,
      }
      const saveRes = await fetch('/api/pending-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSnapshot),
      })
      const saveData = await saveRes.json()
      const pendingFormId = saveData.id || undefined

      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, userId: userId || undefined, guestId: undefined, pendingFormId }),
      })
      const data = await res.json()
      if (!data.success || !data.url) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) { setError(err instanceof Error ? err.message : '決済エラー') }
  }

  const handleReset = () => {
    setPhase('input'); setResult(null); setDiagnosisId(null); setPrevScore(null); setNoCache(false)
    setBusinessSummary(''); setWhoFor(''); setWhatToSell(''); setDifferentiation(''); setSalesChannel([]); setBusinessModel([]); setDailyLimitReached(false)
  }
  const handleRediagnose = () => { setNoCache(true); if (result) setPrevScore(result.scores.total); setPhase('input'); setResult(null); setDiagnosisId(null) }

  return (
    <>
      <div style={{ borderBottom: '1px solid #0f0f0f', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: '#050505', zIndex: 100 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88', animation: 'pulse 2s infinite' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 15, color: '#00ff88', fontWeight: 700, letterSpacing: 1 }}>ビジレート</span>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#444', letterSpacing: 1 }}>BizRate</span>
        </div>
        <span style={{ fontSize: 8, color: '#181818', fontFamily: 'Space Mono, monospace', letterSpacing: 2 }}>AI BUSINESS STRUCTURE RATING</span>
        <div style={{ marginLeft: 'auto' }}><CreditBadge credits={credits} onBuy={() => setShowCreditModal(true)} /></div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>

        {phase === 'input' && (
          <div style={{ animation: 'fadeUp 0.4s ease both' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 8, color: '#00cc6a', letterSpacing: 3, fontFamily: 'Space Mono, monospace', marginBottom: 16, opacity: 0.7 }}>AI BUSINESS STRUCTURE RATING</div>
              <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.35, marginBottom: 8, color: '#eaeaea' }}>
                そのビジネス、<span style={{ color: '#00ff88' }}>本当に売れますか？</span>
              </h1>
              <p style={{ fontSize: 15, color: '#777', marginBottom: 8 }}>AIがあなたのビジネスを分析します。</p>
              <p style={{ fontSize: 13, color: '#444', lineHeight: 1.7, marginBottom: 12 }}>アイデアを入力するだけで、市場性・競争・収益性を数値化します。</p>
              {/* 対象明示 */}
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                ⚠ この診断はオンラインビジネス（Webサービス・アプリ・情報サービス等）を対象に設計されています。
              </div>
              <div style={{ marginTop: 12, display: 'inline-block', background: '#00ff8815', border: '1px solid #00ff8840', borderRadius: 8, padding: '6px 18px', fontSize: 12, color: '#00ff88', fontFamily: 'Space Mono, monospace' }}>🎁 初回のみ無料</div>
            </div>

            {dailyLimitReached && (
              <div style={{ background: '#f8717115', border: '1px solid #f8717140', borderRadius: 10, padding: '16px 18px', marginBottom: 22 }}>
                <div style={{ fontSize: 12, color: '#f87171', fontFamily: 'Space Mono, monospace', marginBottom: 6 }}>⚠ 無料診断は使用済みです</div>
                <p style={{ fontSize: 14, color: '#b8b8b8', margin: '0 0 12px', lineHeight: 1.6 }}>初回の無料診断は使用済みです。<br />続けるにはクレジットが必要です。</p>
                <button onClick={() => setShowCreditModal(true)} style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>
                  クレジットを購入する →
                </button>
              </div>
            )}
            {error && <div style={{ background: '#ff000015', border: '1px solid #ff000040', borderRadius: 8, padding: 14, marginBottom: 22, fontSize: 14, color: '#ff6b6b' }}>⚠ {error}</div>}

            {/* ① ビジネス概要 — 必須 */}
            <SectionLabel num="1" label="ビジネス概要" required sub="最大1000文字" />
            <div style={{ marginBottom: 22 }}>
              <Textarea value={businessSummary} onChange={setBusinessSummary} maxLength={1000}
                placeholder="例：フリーランスのWebデザイナー向けに、提案書をAIで自動生成するSaaSツール。顧客情報を入力するだけで30秒でPDF完成..." />
            </div>

            {/* ② 何を売るか — 必須 */}
            <SectionLabel num="2" label="何を売りますか？" required />
            <div style={{ marginBottom: 22 }}>
              <Textinput value={whatToSell} onChange={setWhatToSell} placeholder="例：AIで提案書を自動作成するWebツール / 中古本を個人が売買できるマーケットプレイス" />
            </div>

            {/* ③ 収益モデル — 必須 */}
            <SectionLabel num="3" label="収益モデルは何ですか？" required />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
              {BUSINESS_MODEL_OPTIONS.map(opt => {
                const selected = businessModel.includes(opt.value)
                return (
                  <button key={opt.value} onClick={() => {
                    setBusinessModel(prev =>
                      prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                    )
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: selected ? '#00ff8820' : '#0a0a0a',
                    border: `1px solid ${selected ? '#00ff88' : '#1a1a1a'}`,
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    color: selected ? '#00ff88' : '#555', fontSize: 13,
                    fontFamily: 'Noto Sans JP, sans-serif',
                  }}>
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>

            {/* ④ 誰向けか — 必須 */}
            <SectionLabel num="4" label="誰向けですか？" required />
            <div style={{ marginBottom: 28 }}>
              <Textinput value={whoFor} onChange={setWhoFor} placeholder="例：提案書作成に時間がかかっているフリーランスのWebデザイナー" />
            </div>

            {/* ⑤ 競合との差別化 — 任意 */}
            <div style={{ borderTop: '1px solid #111', paddingTop: 24, marginBottom: 4 }}>
              <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, fontFamily: 'Space Mono, monospace', marginBottom: 16 }}>▸ 以下は任意です（入力すると診断精度が上がります）</div>
            </div>

            <SectionLabel num="5" label="競合との差別化・強み" sub="任意" />
            <div style={{ marginBottom: 22 }}>
              <Textinput value={differentiation} onChange={setDifferentiation}
                placeholder="例：AIが自動で価格査定する / 特定ジャンルに特化 / 手数料が他より安い" />
              <p style={{ fontSize: 11, color: '#2a2a2a', marginTop: 6, fontFamily: 'Space Mono, monospace' }}>
                ※未入力の場合はビジネス概要から一般的な流入経路を推定します
              </p>
            </div>

            {/* ⑤ 主な集客方法 — 任意 */}
            <SectionLabel num="6" label="主な集客方法は何ですか？" sub="任意・複数選択可" />
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CHANNEL_OPTIONS.map(ch => (
                  <Tag key={ch} label={ch} selected={salesChannel.includes(ch)} onClick={() => {
                    if (salesChannel.includes(ch)) setSalesChannel(salesChannel.filter(c => c !== ch))
                    else setSalesChannel([...salesChannel, ch])
                  }} />
                ))}
              </div>
            </div>

            {/* ⑥ 想定販売価格 — 任意 */}
            <SectionLabel num="7" label="想定販売価格はいくらですか？" sub="任意・利益率と必要顧客数の算出に使用" />
            <input
              type="text"
              value={currentPrice}
              onChange={e => setCurrentPrice(e.target.value)}
              placeholder="例：980（月額）/ 5000（買い切り）/ 3000（1件）"
              style={{
                width: '100%', background: '#0a0a0a', border: '1px solid #1a1a1a',
                borderRadius: 10, padding: '14px 16px', color: '#eaeaea', fontSize: 14,
                fontFamily: 'Noto Sans JP, sans-serif', outline: 'none', boxSizing: 'border-box',
                marginBottom: 24,
              }}
            />

            <button onClick={handleDiagnose} disabled={!isValid} style={{
              width: '100%', padding: '16px',
              background: isValid ? 'linear-gradient(135deg,#00ff88,#00cc6a)' : '#111',
              border: 'none', borderRadius: 10, color: isValid ? '#000' : '#333',
              fontSize: 16, fontWeight: 700, cursor: isValid ? 'pointer' : 'not-allowed',
              fontFamily: 'Space Mono, monospace', letterSpacing: 1,
              boxShadow: isValid ? '0 0 30px #00ff8835' : 'none', transition: 'all 0.3s',
            }}>
              {isValid ? '▶ ビジネスを診断する' : '▶ 必須項目をすべて入力してください'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 10, color: '#252525', marginTop: 10, lineHeight: 1.8, fontFamily: 'Space Mono, monospace' }}>
              ※本診断は「市場性・競争密度・収益構造・実行難易度・AI代替耐性」の5軸アルゴリズムに基づき算出されます。
            </p>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 32px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid #00ff8820' }} />
              <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '1px solid #00ff8830' }} />
              <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '1px solid #00ff8840' }} />
              <div style={{ position: 'absolute', inset: 0, animation: 'spin 1.4s linear infinite' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid transparent', borderTop: '3px solid #00ff88' }} />
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>📊</div>
            </div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#00ff88', marginBottom: 6 }}>{loadingMsg}</div>
            <p style={{ fontSize: 11, color: '#2a2a2a' }}>通常30〜60秒程度かかります</p>
          </div>
        )}

        {phase === 'results' && result && (
          <div style={{ animation: 'fadeUp 0.4s ease both' }}>
            {fromCache && (
              <div style={{ background: '#fbbf2415', border: '1px solid #fbbf2440', borderRadius: 8, padding: '9px 16px', marginBottom: 18, fontSize: 11, color: '#fbbf24', fontFamily: 'Space Mono, monospace' }}>
                ⚡ キャッシュ取得（クレジット消費なし）
              </div>
            )}
            <ResultView result={result} diagnosisId={diagnosisId} userId={userId}
              currentPrice={currentPrice}
              prevScore={prevScore}
              onCreditShort={(rem) => { setCreditShortAmt(rem); setShowCreditModal(true) }}
              onReset={handleReset} onRediagnose={handleRediagnose} />
          </div>
        )}

      </div>

      <div style={{ borderTop: '1px solid #0f0f0f', padding: '18px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#222', lineHeight: 1.7 }}>{DISCLAIMER}</p>
        <p style={{ fontSize: 11, color: '#333', marginTop: 8 }}>
          お問い合わせ：<a href="mailto:bizrate.ai@gmail.com" style={{ color: '#444', textDecoration: 'none' }}>bizrate.ai@gmail.com</a>
        </p>
      </div>

      {showCreditModal && (
        <CreditModal remaining={creditShortAmt} onClose={() => setShowCreditModal(false)} onBuy={(id) => { setShowCreditModal(false); handleBuyCredits(id) }} />
      )}
    </>
  )
}
