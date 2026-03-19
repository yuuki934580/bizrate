import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { consumeCredits } from '@/lib/credits'
import { generatePdfDetailedAnalysis } from '@/lib/openai'
import { generateDiagnosisPdf } from '@/lib/pdf'
import type { DiagnosisInput, DiagnosisResult } from '@/types'
import { CREDIT_COSTS } from '@/types'
import { z } from 'zod'

const Schema = z.object({
  diagnosisId: z.string().uuid(),
  userId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { diagnosisId, userId } = Schema.parse(await req.json())
    const supabase = createServiceClient()

    // 既存PDFチェック（リトライ対応）
    const { data: existing } = await supabase
      .from('pdf_exports')
      .select('file_url')
      .eq('diagnosis_id', diagnosisId)
      .single()
    if (existing?.file_url) {
      let url = existing.file_url
      if (!url.startsWith('http')) {
        const { data: signed } = await supabase.storage
          .from('pdf-reports')
          .createSignedUrl(url, 3600)
        url = signed?.signedUrl || url
      }
      return NextResponse.json({ success: true, downloadUrl: url, creditsUsed: 0 })
    }

    // クレジット消費
    if (userId) {
      const cr = await consumeCredits(userId, CREDIT_COSTS.diagnose, 'pdf_generate')
      if (!cr.success) {
        return NextResponse.json({
          success: false,
          errorCode: 'INSUFFICIENT_CREDITS',
          error: `PDF生成には${CREDIT_COSTS.diagnose}クレジット必要です`,
          remainingCredits: cr.remainingCredits,
        }, { status: 402 })
      }
    }

    // 診断データ取得
    const { data: diagnosis } = await supabase
      .from('diagnoses')
      .select('inputs, result')
      .eq('id', diagnosisId)
      .single()
    if (!diagnosis) {
      return NextResponse.json({ success: false, errorCode: 'NOT_FOUND', error: '診断データが見つかりません' }, { status: 404 })
    }

    const input = diagnosis.inputs as DiagnosisInput
    const result = diagnosis.result as DiagnosisResult

    // 詳細分析生成
    const detail = await generatePdfDetailedAnalysis(input, result)

    // PDF生成
    const pdfBuffer = await generateDiagnosisPdf(input, result, detail)

    // Storageアップロード
    const fileName = `diagnoses/${diagnosisId}/report.pdf`
    const { error: uploadError } = await supabase.storage
      .from('pdf-reports')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    let downloadUrl: string | null = null
    if (!uploadError) {
      const { data: urlData } = await supabase.storage
        .from('pdf-reports')
        .createSignedUrl(fileName, 3600)
      downloadUrl = urlData?.signedUrl || null
    }

    await supabase.from('pdf_exports').insert({
      user_id: userId || null,
      diagnosis_id: diagnosisId,
      file_url: downloadUrl || fileName,
    })

    return NextResponse.json({ success: true, downloadUrl, creditsUsed: CREDIT_COSTS.diagnose })
  } catch (err) {
    console.error('PDF error:', err)
    return NextResponse.json({
      success: false,
      errorCode: 'PDF_FAILED',
      error: err instanceof Error ? err.message : 'PDF生成に失敗しました',
    }, { status: 500 })
  }
}
