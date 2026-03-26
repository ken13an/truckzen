import { NextResponse } from 'next/server'
import { requireRouteContext, getWorkOrderForActor } from '@/lib/api-route-auth'
import { getActorShopId } from '@/lib/server-auth'

const SUPABASE_STORAGE_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/storage/v1/object/public/'
const ALLOWED_BUCKETS = ['uploads']

function isValidFileUrl(url: string, shopId: string): boolean {
  if (typeof url !== 'string' || !url.startsWith(SUPABASE_STORAGE_BASE)) return false
  const afterBase = url.slice(SUPABASE_STORAGE_BASE.length)
  const bucket = afterBase.split('/')[0]
  if (!ALLOWED_BUCKETS.includes(bucket)) return false
  // Path must contain wo-files/ prefix (WO uploads use this convention)
  if (!afterBase.includes('wo-files/')) return false
  // Path must start with bucket/shopId/ (shop-scoped uploads)
  const afterBucket = afterBase.slice(bucket.length + 1)
  if (shopId && !afterBucket.startsWith(shopId + '/')) {
    // Also accept legacy paths without shop prefix (wo-files/woId/...)
    if (!afterBucket.startsWith('wo-files/')) return false
  }
  return true
}

export async function GET(req: Request) {
  const ctx = await requireRouteContext()
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const woId = new URL(req.url).searchParams.get('wo_id')
  if (!woId) return NextResponse.json({ error: 'wo_id required' }, { status: 400 })
  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_files').select('*').eq('wo_id', woId).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const ctx = await requireRouteContext(['owner', 'gm', 'it_person', 'shop_manager', 'service_writer', 'office_admin', 'parts_manager', 'parts_clerk', 'floor_manager', 'accountant', 'accounting_manager'])
  if (ctx.error || !ctx.admin || !ctx.actor) return ctx.error!
  const body = await req.json().catch(() => null)
  const woId = body?.wo_id
  const fileUrl = body?.file_url
  const filename = typeof body?.filename === 'string' ? body.filename.trim() : ''
  if (!woId || !fileUrl || !filename) return NextResponse.json({ error: 'wo_id, file_url, and filename required' }, { status: 400 })

  // Validate file_url: must be Supabase storage, correct bucket, correct path convention
  const shopId = getActorShopId(ctx.actor)
  if (!isValidFileUrl(fileUrl, shopId || '')) {
    return NextResponse.json({ error: 'Invalid file URL. Must be a Supabase storage URL from an allowed bucket.' }, { status: 400 })
  }

  const { data: wo } = await getWorkOrderForActor(ctx.admin, ctx.actor, woId, 'id')
  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await ctx.admin.from('wo_files').insert({ wo_id: woId, user_id: ctx.actor.id, file_url: fileUrl, filename, caption: body?.caption?.trim() || null, visible_to_customer: !!body?.visible_to_customer }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await ctx.admin.from('wo_activity_log').insert({ wo_id: woId, user_id: ctx.actor.id, action: `Uploaded file: ${filename}` })
  return NextResponse.json(data, { status: 201 })
}
