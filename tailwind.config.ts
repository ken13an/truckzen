import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        surface: '#1A1A1A',
        'surface-2': '#2A2A2A',
        'brand-border': '#2A2A2A',
        blue: '#0A84FF',
        teal: '#0A84FF',
        'text-primary': '#F5F5F7',
        'text-secondary': '#8E8E93',
        'text-tertiary': '#8E8E93',
        success: '#30D158',
        warning: '#FFD60A',
        error: '#FF453A',
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
    },
  },
  plugins: [],
}

export default config
