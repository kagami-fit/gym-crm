import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: ['.next/**', 'node_modules/**', '.data/**', 'next-env.d.ts'] },
  {
    rules: {
      // ロゴなどのSVGはそのまま表示する（next/image の最適化は不要）
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
