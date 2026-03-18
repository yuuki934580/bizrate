import type { Metadata } from 'next'

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#050505;color:#f0f0f0;font-family:'Noto Sans JP',sans-serif}
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-thumb{background:#222;border-radius:3px}
`

export const metadata: Metadata = {
  title: 'ビジレート — あなたのビジネス、売れますか？',
  description: 'アイデアを入力するだけで、市場性・競争・収益性を数値化。弱点と改善方向まで提示するAIビジネス構造診断エンジン。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body style={{ margin: 0, background: '#050505', color: '#f0f0f0' }}>
        {children}
      </body>
    </html>
  )
}
