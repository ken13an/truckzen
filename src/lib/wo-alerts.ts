// ============================================================
// TRUCKZEN — Workflow Alert Generator
// Derives notification targets from automation state
// Uses existing createNotification infrastructure
// ============================================================

import type { WOAutomation } from './wo-automation'

export interface WOAlert {
  type: string
  title: string
  body: string
  targetRoles: string[]
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

// Map exception → alert
const EXCEPTION_ALERTS: Record<string, Omit<WOAlert, 'body'>> = {
  waiting_estimate: {
    type: 'workflow_waiting_estimate',
    title: 'Estimate Needed',
    targetRoles: ['service_writer', 'service_advisor', 'owner', 'gm'],
    priority: 'high',
  },
  waiting_warranty: {
    type: 'workflow_waiting_warranty',
    title: 'Warranty Decision Needed',
    targetRoles: ['service_writer', 'shop_manager', 'owner', 'gm'],
    priority: 'high',
  },
  waiting_parts: {
    type: 'workflow_waiting_parts',
    title: 'Parts Attention Needed',
    targetRoles: ['parts_manager'],
    priority: 'normal',
  },
  waiting_assignment: {
    type: 'workflow_ready_for_assignment',
    title: 'Ready for Assignment',
    targetRoles: ['floor_manager', 'shop_manager'],
    priority: 'normal',
  },
  overdue_in_repair: {
    type: 'workflow_overdue_repair',
    title: 'Repair Overdue',
    targetRoles: ['floor_manager', 'shop_manager', 'owner'],
    priority: 'high',
  },
  ready_for_invoice: {
    type: 'workflow_ready_for_invoice',
    title: 'Ready for Invoice',
    targetRoles: ['service_writer', 'accountant', 'accounting_manager', 'office_admin'],
    priority: 'normal',
  },
  waiting_payment: {
    type: 'workflow_waiting_payment',
    title: 'Payment Overdue',
    targetRoles: ['accountant', 'accounting_manager', 'office_admin', 'owner'],
    priority: 'high',
  },
  blocked_other: {
    type: 'workflow_blocked',
    title: 'Work Order Blocked',
    targetRoles: ['shop_manager', 'owner', 'gm'],
    priority: 'normal',
  },
}

/**
 * Derive alerts from automation state for a WO.
 * Returns alert specs — does NOT create notifications (caller does that).
 */
export function deriveWOAlerts(
  automation: WOAutomation,
  wo: { so_number?: string; id?: string },
): WOAlert[] {
  const alerts: WOAlert[] = []
  const woLabel = wo.so_number || 'WO'

  // Exception-based alerts (only when overdue or exception is active)
  if (automation.exception) {
    const template = EXCEPTION_ALERTS[automation.exception]
    if (template) {
      alerts.push({
        ...template,
        body: `${woLabel}: ${automation.next_action}${automation.blocked_by ? ` — ${automation.blocked_by}` : ''}`,
      })
    }
  }

  return alerts
}

/**
 * Generate a dedup key for a WO alert to prevent duplicate notifications.
 */
export function alertDedupKey(woId: string, alertType: string): string {
  return `/work-orders/${woId}#${alertType}`
}
