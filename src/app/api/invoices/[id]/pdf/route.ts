import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'

type P = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: P) {
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
