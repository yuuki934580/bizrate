// ========================================
// 型定義 - ビジレート v1.1（5軸固定・数値計算確定版）
// ========================================

export interface DiagnosisInput {
  targetCustomer?: string
  businessSummary: string
  valueProposition: string
  salesChannel: string
  businessModel?: string[]   // 複数選択
  currentPrice?: string
  initialBudget?: string
  weeklyHours?: string
  canShowFace?: boolean
  canDoSales?: boolean
}

// 固定5軸スコア
export interface DiagnosisScores {
  market: number
  competition: number
  revenueStructure: number
  executionDifficulty: number
  aiResistance: number
  total: number
}

export interface ScoreDetail {
  score: number
  weight: number
  reasoning: string
  evaluationAxes: string[]
  estimatedFactors: string[]
  dataSource: string
}

export interface DiagnosisScoreBreakdown {
  market: ScoreDetail
  competition: ScoreDetail
  revenueStructure: ScoreDetail
  executionDifficulty: ScoreDetail
  aiResistance: ScoreDetail
}

// ── コード計算による数値（LLM不使用）──
export interface CalculatedMetrics {
  price: {
    basePriceIndex: number
    priceRangeLabel: string
    finalPrice: number
    priceUnit: string
    competitionCorrFactor: number
  }
  conversion: {
    conversionIndex: number
    finalConversionRate: number   // %
    priceCorrection: number
  }
  monthly30k: {
    requiredSales: number
    unitPrice: number
    check: boolean
  }
  consistency: {
    meetsMontly30k: boolean
    conversionNotContradictory: boolean
  }
}

// 推奨販売モデル（LLM生成）
export interface SalesModelRecommendation {
  primary: 'oneshot' | 'subscription' | 'hybrid'
  primaryLabel: string
  reason: string
  alternative?: string
  alternativeReason?: string
}

// 改善提案
export interface Improvement {
  title: string
  category: 'competition' | 'market' | 'monetization' | 'growth' | 'execution'
  impact: 'high' | 'medium' | 'low'
  detail: string
  specificAction: string
}

// 診断結果全体
export interface DiagnosisResult {
  id: string
  scores: DiagnosisScores
  scoreBreakdown: DiagnosisScoreBreakdown
  calculatedMetrics: CalculatedMetrics   // コード計算
  bottleneck: string
  salesModel: SalesModelRecommendation
  improvements: Improvement[]
  revenueHints: string[]
  summary: string
  structuralStrength: string
}

// クレジット
export const CREDIT_COSTS = {
  diagnose: 1,
} as const

export const CREDIT_PLANS = [
  { id: 'plan_1',  credits: 1,  price: 200,  label: '単発',     desc: '1回分',           popular: false },
  { id: 'plan_3',  credits: 3,  price: 480,  label: 'おすすめ', desc: '3回分 ¥160/回',   popular: true  },
  { id: 'plan_10', credits: 10, price: 1280, label: 'まとめ',   desc: '10回分 ¥128/回',  popular: false },
] as const

export const SIGNUP_BONUS_CREDITS = 0

// 5軸の重み
export const SCORE_WEIGHTS_DEFAULT = {
  market:               { weight: 0.25, label: '市場性',       inverse: false },
  competition:          { weight: 0.20, label: '競争密度',     inverse: true  },
  revenueStructure:     { weight: 0.25, label: '収益構造',     inverse: false },
  executionDifficulty:  { weight: 0.15, label: '実行難易度',   inverse: true  },
  aiResistance:         { weight: 0.15, label: 'AI代替耐性',   inverse: false },
} as const

export const SCORE_FORMULA_DISPLAY =
  '総合 = 市場性×25% + (100-競争密度)×20% + 収益構造×25% + (100-実行難易度)×15% + AI代替耐性×15%'

export const PRICE_FORMULA_DISPLAY =
  '基礎価格指数 = 市場規模×0.4 + 差別化度×0.3 + 継続性×0.3　→　価格補正係数 = (100-競争密度)÷50'

export const CONVERSION_FORMULA_DISPLAY =
  '成約率指数 = 差別化度×0.4 + (100-競争密度)×0.3 + 市場適合度×0.3'

export const FIVE_AXES = ['market', 'competition', 'revenueStructure', 'executionDifficulty', 'aiResistance'] as const
export type FiveAxis = typeof FIVE_AXES[number]

export const SCORE_LABELS: Record<FiveAxis, string> = {
  market:              '市場性',
  competition:         '競争密度',
  revenueStructure:    '収益構造',
  executionDifficulty: '実行難易度',
  aiResistance:        'AI代替耐性',
}

export const DISCLAIMER =
  '本ツールの出力は投資助言ではありません。収益を保証するものではなく、すべてのスコア・指標は推定値（AI生成および算出ロジックによる誤差含む）です。意思決定はご自身の責任で行ってください。'

// ========================================
// v3追加型
// ========================================

// ビジネスモデル選択
export type BusinessModel = 'subscription' | 'oneshot' | 'ecommerce' | 'advertising' | 'commission' | 'freemium' | 'other'

export const BUSINESS_MODEL_OPTIONS: Array<{ value: BusinessModel; label: string; desc: string; icon: string; primary?: boolean }> = [
  { value: 'subscription', label: 'サブスク',       desc: '月額・年額の継続課金',               icon: '🔄', primary: true },
  { value: 'oneshot',      label: '買い切り',       desc: '1回払いで永続利用',                   icon: '💳', primary: true },
  { value: 'ecommerce',    label: '物販（商品販売）', desc: '商品を販売して売上を得る（EC・D2C等）', icon: '🛒', primary: true },
  { value: 'advertising',  label: '広告収益',       desc: 'PV・クリックで収益',                  icon: '📢' },
  { value: 'commission',   label: '仲介手数料',     desc: '成約・取引に対する手数料',             icon: '🤝' },
  { value: 'freemium',     label: 'フリーミアム',   desc: '無料+有料プランの併用',               icon: '⬆️' },
  { value: 'other',        label: 'その他',         desc: 'コンサル・受託・ライセンス等',         icon: '📦' },
]

// 月収達成確率
export interface AchievementProbability {
  monthly30k: number
  monthly100k: number
  monthly300k: number
}

// 弱点ランキング
export interface WeaknessRank {
  rank: number
  axisKey: string
  label: string
  score: number
  rawScore: number
  isInverse: boolean
}

// CalculatedMetrics v3拡張
export interface CalculatedMetricsV3 extends CalculatedMetrics {
  achievement: AchievementProbability
  weaknessRanking: WeaknessRank[]
}
