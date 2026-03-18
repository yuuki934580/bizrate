<<<<<<< HEAD
# NICHE RADAR — セットアップガイド

生成AIで稼げるニッチを、根拠付きで5つ提示するWebアプリのMVPです。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロント | Next.js 14 (App Router) + TypeScript |
| DB | Supabase (PostgreSQL + Auth + Storage) |
| 決済 | Stripe Checkout（買い切り） |
| LLM | OpenAI GPT-4o-mini |
| PDF生成 | @react-pdf/renderer（サーバーサイド） |

---

## ファイル構成

```
niche-radar/
├── app/
│   ├── layout.tsx                # ルートレイアウト
│   ├── page.tsx                  # メイン画面（入力→結果→購入）
│   ├── purchase/success/page.tsx # 決済完了・PDFダウンロード
│   └── api/
│       ├── generate/route.ts     # OpenAIでニッチ生成
│       ├── purchase/route.ts     # Stripe Checkoutセッション作成
│       ├── webhook/route.ts      # Stripe Webhook（PDF生成トリガー）
│       └── pdf/route.ts          # PDFダウンロードURL取得
├── lib/
│   ├── supabase.ts               # Supabaseクライアント
│   ├── stripe.ts                 # Stripe操作
│   ├── openai.ts                 # ニッチ生成・スコアリング・詳細レポート
│   ├── pdf.tsx                   # PDFレンダリング（React PDF）
│   ├── scoring.ts                # スコア計算ロジック（公開式と完全一致）
│   └── schema.sql                # SupabaseのSQLスキーマ
├── types/
│   └── index.ts                  # 全型定義 + スコア計算式定数
├── .env.local.example            # 環境変数テンプレート
└── package.json
```

---

## セットアップ手順

### 1. 依存関係インストール

```bash
npm install
```

### 2. Supabaseのセットアップ

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editorで `lib/schema.sql` を実行
3. Storage → New bucket → `pdf-reports`（Private）を作成
4. Project Settings → API からキーを取得

### 3. Stripeのセットアップ

1. [stripe.com](https://stripe.com) でアカウント作成
2. テストモードで秘密鍵・公開鍵を取得
3. Webhookエンドポイントを追加：
   - URL: `https://yourdomain.com/api/webhook`
   - イベント: `checkout.session.completed`
4. Webhook Secretをコピー

### 4. 環境変数設定

```bash
cp .env.local.example .env.local
# .env.local を編集して各APIキーを設定
```

### 5. ローカル起動

```bash
npm run dev
# http://localhost:3000
```

### 6. Stripeローカルテスト（Webhook）

```bash
# Stripe CLIインストール後
stripe listen --forward-to localhost:3000/api/webhook
```

---

## デプロイ（Vercel推奨）

```bash
# Vercel CLIでデプロイ
npx vercel --prod

# または vercel.com のダッシュボードからGitHubリポジトリを接続
# 環境変数は Vercel Dashboard → Settings → Environment Variables で設定
```

**重要：** デプロイ後に `.env.local.example` の `NEXT_PUBLIC_APP_URL` を本番URLに変更してください。

---

## スコア計算式（UI公開版と完全一致）

```
総合スコア = 需要温度×45% + (100-競合密度)×35% + (100-実装難易度)×20%
```

| スコア | 計算要素 |
|--------|---------|
| 需要温度 | Trendsの方向(上昇+40/横ばい+20/下降+5) + 検索量代理(0-30) + 悩みの強さ(0-30) |
| 競合密度 | 有料SaaS数 × 10 + 調整値（無料コンテンツ多→減点） |
| 実装難易度 | ベース20 + API依存(+25) + 法規制(+35) + MVP日数換算 |

計算ロジックの詳細は `lib/scoring.ts` を参照。

---

## 免責・法務注意事項

- スコア・売上推定はすべて**仮定ベースの推定値**。精度を保証しない。
- 「投資助言ではない」旨をPDFおよびUI上に明記済み。
- Google Trends等の利用はAPI/公開データのみ使用。スクレイピングは不使用。
- 競合情報は概算（最大10件）。網羅的ではない。
- PDFには出典・推定条件・免責が自動挿入される。

---

## β版（MVP後に追加予定）

- [ ] 候補の保存・比較（最大10件）
- [ ] 生成履歴
- [ ] 共有リンク（結果を友達に見せる）
- [ ] Supabase Auth（メールログイン）
- [ ] SerpAPI連携（競合密度の精度向上）

---

## トラブルシューティング

**Q: PDF生成が遅い**  
A: OpenAI APIの呼び出し + @react-pdf/renderer のレンダリングで30〜60秒かかります。成功ページでポーリング中です。

**Q: Webhookが届かない**  
A: StripeダッシュボードでWebhookのログを確認。ngrokやStripe CLIでローカルテスト可能。

**Q: `@react-pdf/renderer` ビルドエラー**  
A: `next.config.js` の `serverComponentsExternalPackages` に追加済みです。Node.js v18以上が必要。
=======
# bizrate
AIビジネス評価ツール
>>>>>>> 3e264068fff7516c974f6a8a4c21ab5b1bf121f8
