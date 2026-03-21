import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

export async function POST(req: Request) {
  const s = db()
  const formData = await req.formData()
  const file = formData.get('file') as File
  const shopId = formData.get('shop_id') as string

  if (!file || !shopId) return NextResponse.json({ error: 'file and shop_id required' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'png'
  const path = `${shopId}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload to storage
  const { error: uploadError } = await s.storage.from('shop-logos').upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Get public URL
  const { data: urlData } = s.storage.from('shop-logos').getPublicUrl(path)
  const logo_url = urlData.publicUrl

  // Update shop
  await s.from('shops').update({ logo_url }).eq('id', shopId)

  return NextResponse.json({ logo_url })
}
