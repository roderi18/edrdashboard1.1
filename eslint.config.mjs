import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.next/**', 'node_modules/**', 'tmp/**'] },
  {
    files: ['src/**/*.{js,jsx,mjs}', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: { ...js.configs.recommended.rules, 'react/jsx-uses-vars': 'error', ...reactHooks.configs.recommended.rules },
  },
];
