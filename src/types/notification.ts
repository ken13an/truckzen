export interface Notification {
  id: string
  shop_id: string
  user_id: string | null
  title: string
  body: string
  type: string
  read: boolean
  data: Record<string, unknown> | null
  created_at: string
}
