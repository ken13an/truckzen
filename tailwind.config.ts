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
        'surface-2': '#1A1A24',
        elevated: '#1A1A24',
        'brand-border': '#1A1A24',
        teal: '#00E0B0',
        snow: '#EDEDF0',
        mist: '#9D9DA1',
        'text-primary': '#EDEDF0',
        'text-secondary': '#9D9DA1',
        'text-tertiary': '#9D9DA1',
        success: '#00E0B0',
        warning: '#FFB84D',
        error: '#FF5C5C',
        info: '#4D9EFF',
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
