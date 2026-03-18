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

【スコア差別化ルール — 厳守】
スコアは必ずビジネスの実態に応じて大きく差をつけること。50〜70点台に集中させるのは禁止。
- 優れたビジネス（大市場・差別化明確・サブスク・実行可能）→ 各軸75〜90点
- 平均的なビジネス → 各軸50〜65点
- 弱いビジネス（狭小市場・差別化なし・低単価・高競争）→ 各軸20〜45点

【各軸のスコア基準】
市場性：
- 80以上：非常に広いニーズがある分野・急成長中の市場
- 60〜79：多くの企業・個人にニーズがある分野
- 40〜59：一定の需要はあるがニッチ寄り
- 40未満：地域限定・超ニッチ・需要が限定的

競争密度（高いほど競合強）：
- 80以上：大手が支配・レッドオーシャン
- 60〜79：競合多数・差別化が難しい
- 40〜59：競合はいるが差別化余地あり
- 40未満：競合少なく参入余地大

収益構造：
- 80以上：月額サブスク・高LTV・自動化可能
- 60〜79：継続性はあるが単価低め
- 40〜59：買い切り・低単価・リピート不明確
- 40未満：1回限り・超低単価・スケール不可

実行難易度（高いほど難しい）：
- 80以上：高度技術・大資金・長期間必要
- 60〜79：ある程度のスキル・資金が必要
- 40〜59：個人でも取り組める範囲
- 40未満：誰でも今日から始められる

AI代替耐性：
- 80以上：人間関係・専門知識・体験が核心
- 60〜79：一部AI代替されるが差別化要素あり
- 40〜59：AIに代替されやすい部分が多い
- 40未満：ほぼAIで代替可能

【スコア帯と評価の対応ルール — 厳守】
総合スコアに応じて summary・structuralStrength・reasoning の文章トーンを必ず一致させること。
スコアと文章が矛盾する場合は必ずスコアに合わせること：

- 80以上 → 「実行推奨」トーン。強みを前面に出した肯定的な文章。「有望」「強い」「実行可能」などの表現OK
- 65〜79 → 「改善余地あり」トーン。強みと課題を並記。楽観的すぎる表現禁止
- 50〜64 → 「再設計推奨」トーン。「このままでは成功は難しい」「課題が多い」など厳しめに。「需要はあるが〜に根本的な課題がある」形式で書く。「強い需要」「実行可能性も高い」「有望」などのポジティブ表現は絶対に使わない。各軸のreasoningも同様に厳しいトーンにする
- 49以下 → 「撤退検討」トーン。リスクと構造的欠陥を明確に指摘。励ます表現禁止。reasoningも否定的に書く

【reasoning（各軸の理由）のルール】
- summaryと同じトーンで書くこと。スコアが低い軸のreasoningは「〜が不足している」「〜が課題」「〜が弱い」など問題を明示する
- 「可能性がある」「期待できる」などの希望的表現は50点未満の軸では使わない

【市場性の数字表現ルール】
- 「〇〇万人以上が〜」「〇〇億円市場」などの具体的な数字は使わない（根拠がないため）
- 代わりに「多くの企業・個人にニーズがある分野」「需要が広い領域」など曖昧さを保った表現を使う

【改善ヒントルール（重要）】
- improvements はビジネス構造（市場・競争・収益モデル・実行難易度）に関するもののみ
- 命令形禁止。「〜してください」「〜する」は使わない
- 必ず「方向性＋その結果どうなるか」をセットで書く
- 例：NG「ターゲットを絞ってください」→ OK「ターゲットを絞ると、ユーザー獲得効率が上がります」
- 入力内容（ビジネス概要・競合・ターゲット）に基づいた具体的な内容にする
- 誰にでも当てはまる一般論は禁止
- 構造的問題がない場合は空配列[]でよい
- 生成する場合は1〜3個

【販売モデル判定ルール（重要）】
salesModelは以下の基準で判定すること。サブスクに偏重しないこと：
- 継続的・定期的に利用されるサービス（SaaS・コミュニティ・学習など）→ subscription
- 一回完結・単発利用（買い切りツール・単発サービス・物販）→ oneshot
- 両方の要素がある → hybrid
必ず「なぜこのビジネスにこのモデルが適しているか」をビジネス内容に基づいて説明すること

- 抽象表現禁止（「差別化が重要」等はNG）
- 数値化の根拠を具体的に明示
- 「確率」という言葉は使わない

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
    "market":              { "score": 数値, "reasoning": "具体的理由（2文）", "evaluationAxes": ["軸1","軸2","軸3"], "estimatedFactors": ["要素1","要素2"], "dataSource": "一般的なビジネス構造から推定" },
    "competition":         { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "一般的なビジネス構造から推定" },
    "revenueStructure":    { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "一般的なビジネス構造から推定" },
    "executionDifficulty": { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "一般的なビジネス構造から推定" },
    "aiResistance":        { "score": 数値, "reasoning": "...", "evaluationAxes": [...], "estimatedFactors": [...], "dataSource": "一般的なビジネス構造から推定" }
  },
  "bottleneck": "最大のボトルネック（1文）。抽象的な表現禁止。具体的な競合名・状況を含めること。例：『Notion AIやOtterなど既存ツールとの差別化が不明確で、初期ユーザー獲得の障壁が高い』",
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
    "reason": "このビジネスの内容・利用パターンに基づいた理由（2文）。一般論NG。継続利用型かどうかの判断根拠を含めること",
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
      "title": "◯◯になると〜（命令形禁止・方向性と結果をセットで書く）",
      "category": "competition" または "market" または "monetization" または "growth" または "execution",
      "impact": "high" または "medium" または "low",
      "detail": "このビジネスの入力内容に基づいた具体的な説明（2文）。一般論禁止",
      "specificAction": "ユーザーが自分で考えられる余地を残した、方向性レベルの示唆（命令形禁止）"
    }
  ],
  "summary": "総評（2〜3文。強み・弱点・判定）",
  "structuralStrength": "最大の構造的強み（1文）"
}

improvementsはビジネス構造の問題がある場合のみ1〜3個生成。問題がなければ空配列[]でよい。`

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
    bottleneck: parsed.bottleneck,
    priceRecommendation: parsed.priceRecommendation,
    salesModel: parsed.salesModel,
    monthly30k: parsed.monthly30k,
    improvements: (parsed.improvements || []).slice(0, 5),
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
