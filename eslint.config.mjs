import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const reactAndImportOverrides = {
  'react-hooks/set-state-in-effect': 'warn',
  'react-hooks/immutability': 'warn',
  'react-hooks/purity': 'warn',
  'react-hooks/refs': 'warn',
  'react/no-unescaped-entities': 'warn',
  'import/no-anonymous-default-export': 'warn',
}

const nextOverrides = {
  '@next/next/no-html-link-for-pages': 'warn',
  '@next/next/no-page-custom-font': 'warn',
  '@next/next/no-assign-module-variable': 'warn',
}

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'supabase/.temp/**',
      'supabase/.branches/**',
      '**/*.d.ts',
    ],
  },
  ...nextCoreWebVitals.map((cfg) => {
    if (cfg.name === 'next' && cfg.rules) {
      return { ...cfg, rules: { ...cfg.rules, ...reactAndImportOverrides, ...nextOverrides } }
    }
    if (cfg.name === 'next/core-web-vitals' && cfg.rules) {
      return { ...cfg, rules: { ...cfg.rules, ...nextOverrides } }
    }
    return cfg
  }),
]

export default eslintConfig
