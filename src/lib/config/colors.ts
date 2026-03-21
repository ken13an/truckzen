// ============================================================
// TRUCKZEN — SINGLE SOURCE OF TRUTH FOR ALL COLORS
// ============================================================

export const COLORS = {
  // Backgrounds
  bg: '#060708',
  bgCard: '#0D0F12',
  bgHeader: '#151520',
  bgDark: '#0C0C12',
  bgLight: '#ffffff',
  bgLightCard: '#f8fafc',

  // Text
  text: '#F0F4FF',
  textSecondary: '#7C8BA0',
  textDim: '#48536A',
  textLight: '#111827',
  textLightSecondary: '#6B7280',

  // Borders
  border: '#1A1D23',
  borderLight: '#E5E7EB',
  borderCard: 'rgba(255,255,255,0.08)',

  // Brand
  blue: '#1D6FE8',
  blueLight: '#4D9EFF',
  blueBg: 'rgba(29,111,232,0.08)',

  // Status
  green: '#22C55E',
  greenBg: 'rgba(34,197,94,0.15)',
  amber: '#F59E0B',
  amberBg: 'rgba(245,158,11,0.15)',
  red: '#EF4444',
  redBg: 'rgba(239,68,68,0.15)',

  // Role colors
  roleOwner: '#D94F4F',
  roleManager: '#D4882A',
  roleWriter: '#4D9EFF',
  roleTech: '#1DB870',
  roleParts: '#8B5CF6',
  roleFleet: '#0E9F8E',
  roleAccounting: '#E8692A',
  roleDriver: '#7C8BA0',
} as const

export type ColorKey = keyof typeof COLORS

// Font
export const FONT = "'Inter', -apple-system, sans-serif"
export const FONT_DISPLAY = "'Bebas Neue', sans-serif"
export const FONT_MONO = "'IBM Plex Mono', monospace"
export const FONT_KIOSK = "'Instrument Sans', sans-serif"
