import type { MechanicJob, JobStatus } from '@/types'

export async function getMechanicJobs(userId: string): Promise<MechanicJob[]> {
  const res = await fetch(`/api/mechanic/jobs?user_id=${userId}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : data.data || []
}

export async function performJobAction(assignmentId: string, action: 'accept' | 'decline' | 'start' | 'complete', userId: string, reason?: string): Promise<boolean> {
  const res = await fetch('/api/mechanic/accept-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignment_id: assignmentId, action, user_id: userId, reason }),
  })
  return res.ok
}
