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
  borderAccent: string
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
  cardBorder: string
  sidebarBg: string
  sidebarBorder: string
  sidebarText: string
  sidebarTextActive: string
  sidebarActiveBg: string
  sidebarActiveBorder: string
  inputBg: string
  inputBorder: string
}

export const THEME: Record<ThemeMode, ThemeTokenShape> = {
  dark: {
    bg: '#0d1520',
    bgCard: '#131d2e',
    bgElevated: '#1a2740',
    bgHover: 'rgba(255,255,255,0.03)',
    bgActive: 'rgba(255,255,255,0.08)',
    bgInput: 'rgba(255,255,255,0.04)',
    text: '#e2e6ed',
    textSecondary: '#8494a7',
    textTertiary: '#4a5568',
    border: 'rgba(255,255,255,0.06)',
    borderAccent: 'rgba(27,110,230,0.18)',
    accent: '#1B6EE6',
    accentHover: '#3580ea',
    accentLight: '#4D9EFF',
    accentBg: 'rgba(27,110,230,0.08)',
    danger: '#d85656',
    dangerBg: 'rgba(216,86,86,0.06)',
    warning: '#e8a838',
    warningBg: 'rgba(232,168,56,0.06)',
    surfaceMuted: 'rgba(255,255,255,0.06)',
    surfaceMutedText: '#7C8BA0',
    bgAlt: '#0C0C12',
    bgLight: '#ffffff',
    borderLight: 'rgba(255,255,255,0.06)',
    borderCard: 'rgba(255,255,255,0.06)',
    textLight: '#e2e6ed',
    textLightSecondary: '#8494a7',
    success: '#5cb88a',
    successBg: 'rgba(92,184,138,0.06)',
    cardBorder: 'rgba(255,255,255,0.06)',
    sidebarBg: '#131d2e',
    sidebarBorder: 'rgba(255,255,255,0.06)',
    sidebarText: '#8494a7',
    sidebarTextActive: '#ffffff',
    sidebarActiveBg: 'rgba(27,110,230,0.08)',
    sidebarActiveBorder: 'rgba(27,110,230,0.18)',
    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(255,255,255,0.06)',
  },
  light: {
    bg: '#faf8f4',
    bgCard: '#ffffff',
    bgElevated: '#ffffff',
    bgHover: 'rgba(194,97,59,0.02)',
    bgActive: 'rgba(0,0,0,0.06)',
    bgInput: '#ffffff',
    text: '#2d2a26',
    textSecondary: '#6b6560',
    textTertiary: '#9a948a',
    border: '#e8e2d8',
    borderAccent: 'rgba(194,97,59,0.15)',
    accent: '#c2613b',
    accentHover: '#a8532f',
    accentLight: '#4D9EFF',
    accentBg: 'rgba(194,97,59,0.04)',
    danger: '#c2613b',
    dangerBg: 'rgba(194,97,59,0.06)',
    warning: '#b8860b',
    warningBg: 'rgba(184,134,11,0.06)',
    surfaceMuted: 'rgba(0,0,0,0.05)',
    surfaceMutedText: '#52525B',
    bgAlt: '#0C0C12',
    bgLight: '#ffffff',
    borderLight: '#e8e2d8',
    borderCard: '#e8e2d8',
    textLight: '#2d2a26',
    textLightSecondary: '#6b6560',
    success: '#3a7d5e',
    successBg: 'rgba(58,125,94,0.06)',
    cardBorder: '#e8e2d8',
    sidebarBg: '#ffffff',
    sidebarBorder: '#e8e2d8',
    sidebarText: '#6b6560',
    sidebarTextActive: '#c2613b',
    sidebarActiveBg: 'rgba(194,97,59,0.04)',
    sidebarActiveBorder: 'rgba(194,97,59,0.15)',
    inputBg: '#ffffff',
    inputBorder: '#e8e2d8',
  },
}

export type ThemeTokens = typeof THEME.dark

export function getTheme(mode: ThemeMode = 'dark'): ThemeTokens {
  return THEME[mode]
}
