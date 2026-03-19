import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { DiagnosisInput, DiagnosisResult } from '@/types'
import { SCORE_FORMULA_DISPLAY, SCORE_WEIGHTS, SCORE_LABELS, DISCLAIMER } from '@/types'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, paddingTop: 40, paddingBottom: 50, paddingHorizontal: 44, backgroundColor: '#FAFAFA', color: '#1a1a1a' },
  header: { marginBottom: 22, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: '#00aa55' },
  tag: { fontSize: 8, color: '#00aa55', letterSpacing: 2, marginBottom: 6 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0d0d0d', lineHeight: 1.4, marginBottom: 6 },
  meta: { fontSize: 8, color: '#888' },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0d0d0d', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  infoBox: { backgroundColor: '#f0fff7', borderRadius: 4, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#00aa55' },
  infoText: { fontSize: 9, color: '#333', lineHeight: 1.6 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 6 },
  cellBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#222', paddingHorizontal: 6 },
  cell: { fontSize: 9, color: '#444', paddingHorizontal: 6, flex: 1 },
  listItem: { flexDirection: 'row', marginBottom: 6 },
  bullet: { width: 14, fontSize: 9, color: '#00aa55' },
  listText: { flex: 1, fontSize: 9, color: '#444', lineHeight: 1.5 },
  disclaimer: { marginTop: 20, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#ccc' },
  disclaimerText: { fontSize: 7.5, color: '#888', lineHeight: 1.6 },
  pageNum: { position: 'absolute', fontSize: 8, bottom: 24, left: 0, right: 0, textAlign: 'center', color: '#aaa' },
  scoreBox: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 4, padding: 10, alignItems: 'center', marginHorizontal: 3 },
  scoreRow: { flexDirection: 'row', marginBottom: 8 },
  roadmapItem: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  weekBox: { width: 58, backgroundColor: '#0d0d0d', borderRadius: 4, padding: 6, alignItems: 'center', justifyContent: 'center' },
  weekText: { fontSize: 8, color: '#fff', textAlign: 'center' },
})

const SCORE_COLORS_PDF: Record<string, string> = {
  market: '#00aa55',
  competition: '#f97316',
  entryBarrier: '#0ea5e9',
  monetizationDifficulty: '#7c3aed',
  aiReplacement: '#e11d48',
  growth: '#d97706',
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <View style={{ height: 6, backgroundColor: '#e5e5e5', borderRadius: 3, marginTop: 4 }}>
      <View style={{ height: 6, width: `${value}%` as any, backgroundColor: color, borderRadius: 3 }} />
    </View>
  )
}

export function generateDiagnosisPdf(
  input: DiagnosisInput,
  result: DiagnosisResult,
  detail: {
    competitorMap: Array<{ name: string; category: string; threat: string; note: string }>
    actionPlan: Array<{ week: string; title: string; tasks: string[] }>
    risks: Array<{ category: string; description: string; severity: string; mitigation: string }>
  }
): Promise<Buffer> {
  const generatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const scoreOrder = ['market', 'competition', 'entryBarrier', 'monetizationDifficulty', 'aiReplacement', 'growth'] as const

  const doc = (
    <Document>
      {/* PAGE 1: 概要・総合スコア・分解スコア */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.tag}>AIビジネス構造診断エンジン — 詳細レポート</Text>
          <Text style={styles.title}>ビジネス構造診断レポート</Text>
          <Text style={styles.meta}>生成日時：{generatedAt}　|　スコアはAI推定値（誤差含む）</Text>
        </View>

        {/* 入力概要 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 診断対象ビジネス</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{input.businessSummary}</Text>
          </View>
          {[['提供価値', input.valueProposition], ['希望価格', input.currentPrice || '未設定'], ['販売チャネル', input.salesChannel]].map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={[styles.cellBold, { width: 80 }]}>{k}</Text>
              <Text style={styles.cell}>{v}</Text>
            </View>
          ))}
        </View>

        {/* 総合スコア */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 総合構造スコア</Text>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 4 }}>総合スコア（0-100）</Text>
            <Text style={{ fontSize: 40, fontFamily: 'Helvetica-Bold', color: result.scores.total >= 70 ? '#00aa55' : result.scores.total >= 50 ? '#d97706' : '#e11d48' }}>
              {result.scores.total}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={{ fontSize: 9, color: '#333', marginBottom: 4, fontFamily: 'Helvetica-Bold' }}>総評</Text>
            <Text style={styles.infoText}>{result.summary}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#f0fff7', borderRadius: 4, padding: 8, borderLeftWidth: 2, borderLeftColor: '#00aa55' }}>
              <Text style={{ fontSize: 8, color: '#666', marginBottom: 3 }}>構造的強み</Text>
              <Text style={{ fontSize: 9, color: '#333' }}>{result.structuralStrength}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff5f5', borderRadius: 4, padding: 8, borderLeftWidth: 2, borderLeftColor: '#e11d48' }}>
              <Text style={{ fontSize: 8, color: '#666', marginBottom: 3 }}>構造的弱点</Text>
              <Text style={{ fontSize: 9, color: '#333' }}>{result.bottleneck}</Text>
            </View>
          </View>
          {/* 計算式 */}
          <View style={{ backgroundColor: '#0d0d0d', borderRadius: 4, padding: 8 }}>
            <Text style={{ fontSize: 7.5, color: '#00ff88', fontFamily: 'Helvetica-Bold' }}>{SCORE_FORMULA_DISPLAY}</Text>
          </View>
        </View>

        {/* 分解スコア */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 分解スコアと算出根拠</Text>
          {scoreOrder.map(key => {
            const bd = result.scoreBreakdown[key]
            const color = SCORE_COLORS_PDF[key] || '#888'
            const winfo = SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS]
            return (
              <View key={key} style={{ marginBottom: 12, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#222' }}>
                    {SCORE_LABELS[key] ?? key}{winfo?.inverse ? '（逆）' : ''}　重み: {winfo ? winfo.weight * 100 : '?'}%
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color }}>{result.scores[key]}</Text>
                </View>
                <Bar value={result.scores[key]} color={color} />
                <Text style={{ fontSize: 8, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{bd?.reasoning}</Text>
                <Text style={{ fontSize: 7.5, color: '#888', marginTop: 3 }}>評価軸：{bd?.evaluationAxes?.join(' / ')}</Text>
                <Text style={{ fontSize: 7.5, color: '#888', marginTop: 1 }}>推定要素：{bd?.estimatedFactors?.join('、')}</Text>
                <Text style={{ fontSize: 7.5, color: '#777', marginTop: 1 }}>データ根拠：{bd?.dataSource}</Text>
              </View>
            )
          })}
        </View>

        <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* PAGE 2: 金銭指標・改善提案・競合マップ */}
      <Page size="A4" style={styles.page}>
        {/* 金銭系指標 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. 金銭系指標</Text>
          <Text style={{ fontSize: 8, color: '#888', marginBottom: 8 }}>★少ない=達成しやすい。「確率」ではなく難易度の目安です。</Text>
          {[
            ['総合スコア', String(result.scores.total) + ' / 100', result.summary],
            ['ボトルネック', '', result.bottleneck],
            ['構造的強み', '', result.structuralStrength],
          ].map(([label, val, reason]) => (
            <View key={label} style={[styles.row, { paddingVertical: 8 }]}>
              <Text style={[styles.cellBold, { width: 90 }]}>{label}</Text>
              <Text style={[styles.cellBold, { width: 60, color: '#d97706' }]}>{val}</Text>
              <Text style={[styles.cell, { fontSize: 8.5 }]}>{reason}</Text>
            </View>
          ))}
        </View>

        {/* 改善提案 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. 改善提案</Text>
          {result.improvements.map((imp, i) => (
            <View key={i} style={{ marginBottom: 10, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: imp.impact === 'high' ? '#00aa55' : imp.impact === 'medium' ? '#d97706' : '#999' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0d0d0d', marginBottom: 4 }}>
                [{i + 1}] {imp.title}
              </Text>
              <Text style={{ fontSize: 8.5, color: '#555', lineHeight: 1.5, marginBottom: 4 }}>{imp.detail}</Text>
              <Text style={{ fontSize: 8.5, color: '#00aa55' }}>→ 今すぐやること：{imp.specificAction}</Text>
            </View>
          ))}
        </View>

        {/* 競合マップ */}
        {detail.competitorMap.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. 競合マップ</Text>
            <View style={{ backgroundColor: '#f5f5f5', paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row' }}>
              {['名前', '種別', '脅威度', 'メモ'].map((h, i) => (
                <Text key={h} style={[styles.cellBold, { flex: i === 3 ? 2 : 1 }]}>{h}</Text>
              ))}
            </View>
            {detail.competitorMap.slice(0, 8).map((c, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.cell, { flex: 1 }]}>{c.name}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{c.category}</Text>
                <Text style={[styles.cell, { flex: 1, color: c.threat === 'high' ? '#e11d48' : c.threat === 'medium' ? '#d97706' : '#666' }]}>{c.threat}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{c.note}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* PAGE 3: アクションプラン・リスク・免責 */}
      <Page size="A4" style={styles.page}>
        {/* 90日アクションプラン */}
        {detail.actionPlan.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. 90日アクションプラン</Text>
            {detail.actionPlan.map((week, i) => (
              <View key={i} style={styles.roadmapItem}>
                <View style={styles.weekBox}>
                  <Text style={styles.weekText}>{week.week}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0d0d0d', marginBottom: 4 }}>{week.title}</Text>
                  {week.tasks.map((t, j) => (
                    <View key={j} style={styles.listItem}>
                      <Text style={styles.bullet}>▸</Text>
                      <Text style={[styles.listText, { fontSize: 8.5 }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* リスク */}
        {detail.risks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. リスク分析</Text>
            {detail.risks.map((r, i) => (
              <View key={i} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: r.severity === 'high' ? '#e11d48' : r.severity === 'medium' ? '#d97706' : '#00aa55' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: r.severity === 'high' ? '#e11d48' : r.severity === 'medium' ? '#d97706' : '#00aa55' }}>
                    [{r.severity.toUpperCase()}] {r.category}
                  </Text>
                </View>
                <Text style={{ fontSize: 8.5, color: '#444', marginBottom: 3 }}>{r.description}</Text>
                <Text style={{ fontSize: 8, color: '#00aa55' }}>対策：{r.mitigation}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 免責 */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            【免責事項】{DISCLAIMER}{'\n'}
            スコア計算式：{SCORE_FORMULA_DISPLAY}{'\n'}
            生成日時：{generatedAt}
          </Text>
        </View>

        <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )

  return renderToBuffer(doc as any)
}
