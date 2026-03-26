import { NextResponse } from 'next/server'
import { createAdminSupabaseClient, getAuthenticatedUserProfile, getActorShopId, jsonError } from '@/lib/server-auth'

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(req: Request) {
  const actor = await getAuthenticatedUserProfile()
  if (!actor) return jsonError('Unauthorized', 401)

  const shopId = getActorShopId(actor)
  if (!shopId) return jsonError('No shop context', 400)

  const s = createAdminSupabaseClient()
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  // Size check
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 })
  }

  // Extension allowlist
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `Invalid file type .${ext}. Allowed: png, jpg, jpeg, webp` }, { status: 400 })
  }

  // MIME validation
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: `Invalid MIME type ${file.type}. Allowed: image/png, image/jpeg, image/webp` }, { status: 400 })
  }

  const path = `${shopId}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await s.storage.from('shop-logos').upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = s.storage.from('shop-logos').getPublicUrl(path)
  const logo_url = urlData.publicUrl

  await s.from('shops').update({ logo_url }).eq('id', shopId)

  return NextResponse.json({ logo_url })
}
