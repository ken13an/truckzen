import { redirect } from 'next/navigation'
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/work-orders/${id}`)
}
