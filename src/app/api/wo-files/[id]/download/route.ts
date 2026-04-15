import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'

const PUBLIC_PREFIX = (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/storage/v1/object/public/uploads/'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
  const { id } = await params
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!

  const { data: file } = await ctx.admin.from('wo_files').select('id, wo_id, file_url, filename').eq('id', id).single()
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, file.wo_id, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url: string = file.file_url || ''
  const path = url.startsWith(PUBLIC_PREFIX) ? url.slice(PUBLIC_PREFIX.length) : null
  if (!path) return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 })

  const { data: signed, error } = await ctx.admin.storage.from('uploads').createSignedUrl(path, 60)
  if (error || !signed?.signedUrl) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })

  return NextResponse.redirect(signed.signedUrl, { status: 302 })
}
