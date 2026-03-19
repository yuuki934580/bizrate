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

    // 譌｢蟄榔DF繝√ぉ繝・け・医Μ繝医Λ繧､蟇ｾ蠢懶ｼ・    const { data: existing } = await supabase.from('pdf_exports').select('file_url').eq('diagnosis_id', diagnosisId).single()
    if (existing?.file_url) {
      let url = existing.file_url
      if (!url.startsWith('http')) {
        const { data: signed } = await supabase.storage.from('pdf-reports').createSignedUrl(url, 3600)
        url = signed?.signedUrl || url
      }
      return NextResponse.json({ success: true, downloadUrl: url, creditsUsed: 0 })
    }

    // 繧ｯ繝ｬ繧ｸ繝・ヨ豸郁ｲｻ
    if (userId) {
      const cr = await consumeCredits(userId, CREDIT_COSTS.diagnose, 'pdf_generate')
      if (!cr.success) {
        return NextResponse.json({ success: false, errorCode: 'INSUFFICIENT_CREDITS', error: `PDF逕滓・縺ｫ縺ｯ${CREDIT_COSTS.diagnose}繧ｯ繝ｬ繧ｸ繝・ヨ蠢・ｦ√〒縺兪, remainingCredits: cr.remainingCredits }, { status: 402 })
      }
    }

    // 險ｺ譁ｭ繝・・繧ｿ蜿門ｾ・    const { data: diagnosis } = await supabase.from('diagnoses').select('inputs, result').eq('id', diagnosisId).single()
    if (!diagnosis) return NextResponse.json({ success: false, errorCode: 'NOT_FOUND', error: '險ｺ譁ｭ繝・・繧ｿ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ' }, { status: 404 })

    const input = diagnosis.inputs as DiagnosisInput
    const result = diagnosis.result as DiagnosisResult

    // 隧ｳ邏ｰ蛻・梵逕滓・
    const detail = await generatePdfDetailedAnalysis(input, result)

    // PDF逕滓・
    const pdfBuffer = await generateDiagnosisPdf(input, result, detail)

    // Storage 繧｢繝・・繝ｭ繝ｼ繝・    const fileName = `diagnoses/${diagnosisId}/report.pdf`
    const { error: uploadError } = await supabase.storage.from('pdf-reports').upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    let downloadUrl: string | null = null
    if (!uploadError) {
      const { data: urlData } = await supabase.storage.from('pdf-reports').createSignedUrl(fileName, 3600)
      downloadUrl = urlData?.signedUrl || null
    }

    await supabase.from('pdf_exports').insert({ user_id: userId || null, diagnosis_id: diagnosisId, file_url: downloadUrl || fileName })

    return NextResponse.json({ success: true, downloadUrl, creditsUsed: CREDIT_COSTS.diagnose })
  } catch (err) {
    console.error('PDF error:', err)
    return NextResponse.json({ success: false, errorCode: 'PDF_FAILED', error: err instanceof Error ? err.message : 'PDF逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆' }, { status: 500 })
  }
}
