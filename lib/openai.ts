import OpenAI from 'openai'
import type { DiagnosisInput, DiagnosisResult } from '@/types'
import { calcTotalScore } from './scoring'
import { v4 as uuidv4 } from 'uuid'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function runDiagnosis(input: DiagnosisInput): Promise<DiagnosisResult> {
  const optional = [
    input.currentPrice  ? `現在考えている価格: ${input.currentPrice}` : '',
    input.initialBudget ? `初期資金: ${input.initialBudget}` : '',
    input.weeklyHours   ? `使える時間: ${input.weeklyHours}` : '',
    input.canShowFace !== undefined ? `顔出し: ${input.canShowFace ? '可' : '不可'}` : '',
    input.canDoSales  !== undefined ? `営業: ${input.canDoSales ? '可' : '不可'}` : '',
  ].filter(Boolean).join('\n- ')

  const prompt = `
あなたはビジネス構造分析の専門家です。
以下のビジネスを「5軸固定アルゴリズム」で評価・数値化してください。

【入力情報】
ビジネス概要: ${input.businessSummary}
想定顧客: ${input.targetCustomer}
提供価値: ${input.valueProposition}
販売チャネル: ${input.salesChannel}
${optional ? `\n任意情報:\n- ${optional}` : ''}

【5軸評価ルール】
1. 市場性（0-100）：市場規模・需要の強さ・顧客の痛みの深さ
2. 競争密度（0-100）：高いほど競合が強い。同じ顧客層への類似サービス数・強さ
3. 収益構造（0-100）：高いほど稼ぎやすい。LTV・継続性・単価・回収速度
4. 実行難易度（0-100）：高いほど難しい。技術・資金・時間・スキル要件
5. AI代替耐性（0-100）：高いほど代替されにくい。人間性・関係性・専門性

【出力ルール】
- 抽象表現禁止（「差別化が重要」等はNG）
- 数値化の根拠を具体的に明示
- 「確率」という言葉は使わない
- 改善提案は「◯◯を△△にすると〜」形式
- 価格は必ずAIが算出する（入力がなくても算出する）

以下のJSON形式で正確に出力（コードブロック不要）:
{
  "scores": {
    "market": 0〜100,
    "competition": 0〜100,
    "revenueStructure": 0〜100,
    "executionDifficulty": 0〜100,
    "aiResistance": 0〜100
  },
  "scoreBreakdown": {
    "market":              { "score": 数値, "reasoning": "具体的理由（2文）", "evaluationAxes": ["軸1","軸2","軸3"], "estimatedFactors": ["要素1","要素2"], "dataSource": "根拠" },
    "competition":         { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "..." },
    "revenueStructure":    { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "..." },
    "executionDifficulty": { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "..." },
    "aiResistance":        { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "..." }
  },
  "bottleneck": "最大のボトルネック（1文・具体的に）",
  "priceRecommendation": {
    "minPrice": 最低価格（整数・円）,
    "maxPrice": 最高価格（整数・円）,
    "recommendedPrice": 推奨価格（整数・円）,
    "priceUnit": "月額" または "1件" または "1回" または "年額",
    "reasoning": "算出理由（2〜3文・具体的に）",
    "marketAcceptanceRange": "市場許容価格レンジの説明",
    "competitionPressure": "競争圧力補正の説明",
    "differentiationFactor": "差別化係数の説明",
    "continuityScore": "継続性評価の説明"
  },
  "salesModel": {
    "primary": "oneshot" または "subscription" または "hybrid",
    "primaryLabel": "買い切り" または "月額サブスク" または "ハイブリッド",
    "reason": "推奨理由（2文）",
    "alternative": "代替モデル名（任意）",
    "alternativeReason": "代替モデルの説明（任意）"
  },
  "monthly30k": {
    "unitSales": 必要販売数（整数）,
    "unitPrice": 想定単価（整数・円）,
    "timeframe": "到達目安（例：3〜6ヶ月）",
    "bottleneck": "月3万到達の最大障壁（1文）",
    "firstStep": "今日やる最初の1アクション（超具体的）"
  },
  "improvements": [
    {
      "title": "◯◯を△△にすると〜（必ずこの形式）",
      "category": "competition" または "market" または "monetization" または "growth" または "execution",
      "impact": "high" または "medium" または "low",
      "detail": "詳細（2文・具体的）",
      "specificAction": "今すぐできる1アクション"
    }
  ],
  "summary": "総評（2〜3文。強み・弱点・判定）",
  "structuralStrength": "最大の構造的強み（1文）"
}

improvements は3〜5個必ず生成。`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 4000,
  })

  const content = response.choices[0].message.content || '{}'
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('診断結果のパースに失敗しました。再試行してください。')
  }

  const total = calcTotalScore({
    market: parsed.scores.market,
    competition: parsed.scores.competition,
    revenueStructure: parsed.scores.revenueStructure,
    executionDifficulty: parsed.scores.executionDifficulty,
    aiResistance: parsed.scores.aiResistance,
  })

  const bd = parsed.scoreBreakdown
  const withWeights = {
    market:              { ...bd.market,              weight: 25 },
    competition:         { ...bd.competition,         weight: 20 },
    revenueStructure:    { ...bd.revenueStructure,    weight: 25 },
    executionDifficulty: { ...bd.executionDifficulty, weight: 15 },
    aiResistance:        { ...bd.aiResistance,        weight: 15 },
  }

  return {
    id: uuidv4(),
    scores: { ...parsed.scores, total },
    scoreBreakdown: withWeights,
    calculatedMetrics: {} as any, // generate/route.tsで後から付与
    bottleneck: parsed.bottleneck,
    salesModel: parsed.salesModel,
    improvements: (parsed.improvements || []).slice(0, 5),
    revenueHints: parsed.revenueHints || [],
    summary: parsed.summary,
    structuralStrength: parsed.structuralStrength,
  }
}

export async function generatePdfDetailedAnalysis(
  input: DiagnosisInput,
  result: DiagnosisResult
): Promise<{
  competitorMap: Array<{ name: string; category: string; threat: string; note: string }>
  actionPlan: Array<{ week: string; title: string; tasks: string[] }>
  risks: Array<{ category: string; description: string; severity: string; mitigation: string }>
}> {
  const prompt = `
以下のビジネス診断結果をもとに詳細レポートを生成してください。

ビジネス概要: ${input.businessSummary}
顧客: ${input.targetCustomer}
総合スコア: ${result.scores.total}/100
ボトルネック: ${result.bottleneck}

以下のJSON形式で出力（コードブロック不要）:
{
  "competitorMap": [
    { "name": "競合名", "category": "saas|service|content|template", "threat": "high|medium|low", "note": "1文" }
  ],
  "actionPlan": [
    { "week": "1〜2週目", "title": "フェーズ名", "tasks": ["タスク1","タスク2","タスク3"] },
    { "week": "3〜4週目", "title": "...", "tasks": [...] },
    { "week": "5〜8週目", "title": "...", "tasks": [...] },
    { "week": "9〜12週目","title": "...", "tasks": [...] }
  ],
  "risks": [
    { "category": "market|competition|regulation|technical|platform", "description": "リスク", "severity": "high|medium|low", "mitigation": "対策" }
  ]
}
競合は最大8件、リスクは3〜5件。`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 3000,
  })
  const content = response.choices[0].message.content || '{}'
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try { return JSON.parse(cleaned) }
  catch { return { competitorMap: [], actionPlan: [], risks: [] } }
}
