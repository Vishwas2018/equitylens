/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', '../../.eslintrc.cjs'],
  rules: {},
  overrides: [
    {
      // No raw hex colours in component source — use CSS custom properties via var(--token).
      // Mirrors the engine's no-entropy rule: same discipline, different domain.
      files: ['components/**/*.tsx', 'components/**/*.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
            message: 'No raw hex colours — use CSS custom properties via var(--token) instead.',
          },
        ],
      },
    },
  ],
};
