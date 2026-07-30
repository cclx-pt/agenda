import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, __APP_VERSION__: 'readonly', __BUILD_TIME__: 'readonly', __APP_ENV__: 'readonly', __GIT_BRANCH__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['vite.config.js', 'server.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    files: ['src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
  {
    // Testes E2E (Playwright) + config: correm em Node, com código de browser
    // dentro de page.evaluate → dá-lhes globais de node e de browser. As regras
    // do React não se aplicam (ex.: o parâmetro `use` das fixtures não é um hook).
    files: ['e2e/**/*.{js,mjs}', 'playwright.config.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  prettier,
]
