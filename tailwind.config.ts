import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08080C',
        surface: '#111117',
        'surface-2': '#1C1C24',
        'brand-border': '#28283A',
        teal: { DEFAULT: '#00E0B0', hover: '#00B892', active: '#00805F' },
        purple: { DEFAULT: '#7C6CF0', light: '#9D91F5', dark: '#5B4CC4' },
        'text-primary': '#EDEDF0',
        'text-secondary': '#9898A5',
        'text-tertiary': '#5A5A68',
        success: '#00D48E',
        warning: '#FFBE2E',
        error: '#FF6B6B',
        'light-bg': '#F4F4F6',
        'light-surface': '#FFFFFF',
        'light-border': '#E2E2E6',
        'light-text': '#1A1A22',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Courier', 'monospace'],
      },
      spacing: {
        'xs': '4px',
        'sm-space': '8px',
        'md-space': '12px',
        'lg-space': '16px',
        'xl-space': '24px',
        '2xl-space': '32px',
        '3xl-space': '48px',
        '4xl-space': '64px',
      },
    },
  },
  plugins: [],
}

export default config
