import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServiceClient()
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('pending_forms')
    .insert({ id, form_data: body, created_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pending_forms')
    .select('form_data')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  // 削除はgenerate API側で行う（復元失敗時の再試行を考慮）
  return NextResponse.json({ form: data.form_data })
}
