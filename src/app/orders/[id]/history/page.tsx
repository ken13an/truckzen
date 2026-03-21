import { redirect } from 'next/navigation'
export default async function OrderHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/work-orders/${id}`)
}
