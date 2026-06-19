import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended,
  playwright.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
];
