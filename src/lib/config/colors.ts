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

// ============================================================
// THEME — Structured color tokens for dark/light mode
// ============================================================

export type ThemeMode = 'dark' | 'light'

type ThemeTokenShape = {
  bg: string
  bgCard: string
  bgElevated: string
  bgHover: string
  bgActive: string
  bgInput: string
  text: string
  textSecondary: string
  textTertiary: string
  border: string
  accent: string
  accentHover: string
  accentLight: string
  accentBg: string
  danger: string
  dangerBg: string
  warning: string
  warningBg: string
  surfaceMuted: string
  surfaceMutedText: string
  bgAlt: string
  bgLight: string
  borderLight: string
  borderCard: string
  textLight: string
  textLightSecondary: string
  success: string
  successBg: string
}

export const THEME: Record<ThemeMode, ThemeTokenShape> = {
  dark: {
    bg: '#060708',
    bgCard: '#0D0F12',
    bgElevated: '#151520',
    bgHover: 'rgba(255,255,255,0.04)',
    bgActive: 'rgba(255,255,255,0.08)',
    bgInput: '#0B0D11',
    text: '#F0F4FF',
    textSecondary: '#7C8BA0',
    textTertiary: '#48536A',
    border: 'rgba(255,255,255,0.06)',
    accent: '#1D6FE8',
    accentHover: '#1248B0',
    accentLight: '#4D9EFF',
    accentBg: 'rgba(29,111,232,0.12)',
    danger: '#D94F4F',
    dangerBg: 'rgba(217,79,79,0.12)',
    warning: '#D4882A',
    warningBg: 'rgba(212,136,42,0.12)',
    surfaceMuted: 'rgba(255,255,255,0.06)',
    surfaceMutedText: '#7C8BA0',
    bgAlt: '#0C0C12',
    bgLight: '#ffffff',
    borderLight: '#E5E7EB',
    borderCard: 'rgba(255,255,255,0.08)',
    textLight: '#111827',
    textLightSecondary: '#6B7280',
    success: '#22C55E',
    successBg: 'rgba(34,197,94,0.15)',
  },
  light: {
    bg: '#FFFFFF',
    bgCard: '#F8F8FA',
    bgElevated: '#FFFFFF',
    bgHover: 'rgba(0,0,0,0.03)',
    bgActive: 'rgba(0,0,0,0.06)',
    bgInput: '#F3F4F6',
    text: '#111113',
    textSecondary: '#52525B',
    textTertiary: '#A1A1AA',
    border: 'rgba(0,0,0,0.08)',
    accent: '#1D6FE8',
    accentHover: '#1248B0',
    accentLight: '#4D9EFF',
    accentBg: 'rgba(29,111,232,0.08)',
    danger: '#DC2626',
    dangerBg: 'rgba(220,38,38,0.08)',
    warning: '#D97706',
    warningBg: 'rgba(217,119,6,0.08)',
    surfaceMuted: 'rgba(0,0,0,0.05)',
    surfaceMutedText: '#52525B',
    bgAlt: '#0C0C12',
    bgLight: '#ffffff',
    borderLight: '#E5E7EB',
    borderCard: 'rgba(255,255,255,0.08)',
    textLight: '#111827',
    textLightSecondary: '#6B7280',
    success: '#22C55E',
    successBg: 'rgba(34,197,94,0.15)',
  },
}

export type ThemeTokens = typeof THEME.dark

export function getTheme(mode: ThemeMode = 'dark'): ThemeTokens {
  return THEME[mode]
}
