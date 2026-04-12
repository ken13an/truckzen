import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'
import { safeRoute } from '@/lib/api-handler'

type P = { params: Promise<{ id: string }> }

async function _GET(_req: Request, { params }: P) {
  const { id } = await params
  const result = await generateInvoicePdf(id)
  if (!result) return new Response('Not found', { status: 404 })

  return new Response(Buffer.from(result.pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export const GET = safeRoute(_GET)
