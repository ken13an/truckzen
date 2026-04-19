import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeRoute } from '@/lib/api-handler'
import { rateLimit } from '@/lib/ratelimit/core'
import { getRequestIp } from '@/lib/ratelimit/request-ip'
import { generateEstimatePdf } from '@/lib/pdf/generateEstimatePdf'

function db() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) }

type Params = { params: Promise<{ id: string }> }

async function _GET(req: Request, { params }: Params) {
  const { id } = await params
  const pdfLimit = await rateLimit('estimate-pdf-ip', getRequestIp(req))
  if (!pdfLimit.allowed) return NextResponse.json({ error: 'Too many estimate requests' }, { status: 429 })
  const s = db()

  const { data: est } = await s.from('estimates').select('id, approval_token, estimate_number').eq('id', id).single()
  if (!est) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cookieHeader = req.headers.get('cookie') || ''
  const hasSession = /(?:^|;\s*)(tz_session_token|sb-)/.test(cookieHeader)
  if (!hasSession) {
    const token = new URL(req.url).searchParams.get('token') || ''
    const expected = (est as any).approval_token || ''
    if (!token || !expected || token !== expected) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const result = await generateEstimatePdf(id)
  if (!result) return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })

  return new NextResponse(Buffer.from(result.pdfBytes) as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export const GET = safeRoute(_GET)
