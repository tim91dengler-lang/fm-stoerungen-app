import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      '*.config.js',
      '*.config.ts',
      '*.config.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Reuse-First (Skill `reuse-first`, Definition of Done §0): keine nativen
      // Eingabe-Controls — vorhandene gestylte Komponenten verwenden.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXOpeningElement[name.name='input'] JSXAttribute[name.name='type'][value.value='date']",
          message:
            'Natives <input type="date"> ist verboten — nutze die DatePicker-Komponente (Skill `reuse-first`).',
        },
        {
          selector: "JSXOpeningElement[name.name='select'] JSXAttribute[name.name='multiple']",
          message:
            'Natives <select multiple> ist verboten — nutze MultiSelectCombobox (Skill `reuse-first`).',
        },
      ],
    },
  },
  {
    // E2E-Tests dürfen console.log für Diagnose-Output nutzen.
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
);
