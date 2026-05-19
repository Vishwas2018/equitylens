/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../../.eslintrc.cjs'],
  overrides: [
    {
      // Critical financial-engine rules — wired now, enforced from Day 4.
      // These prevent non-determinism and forbidden math libraries in engine code.
      files: ['src/**/*.ts'],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            name: 'Date',
            message: 'Use explicit date parameters; Date is non-deterministic in engine code.',
          },
          { name: 'performance', message: 'Do not use performance in engine code.' },
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'Math',
            property: 'random',
            message: 'Math.random() is non-deterministic; forbidden in engine code.',
          },
        ],
        'no-restricted-imports': [
          'error',
          { name: 'decimal.js', message: 'Forbidden: use bigint cents arithmetic instead.' },
          { name: 'big.js', message: 'Forbidden: use bigint cents arithmetic instead.' },
          { name: 'bignumber.js', message: 'Forbidden: use bigint cents arithmetic instead.' },
          { name: 'mathjs', message: 'Forbidden: use bigint cents arithmetic instead.' },
          { name: 'lodash', message: 'Forbidden: use native TypeScript/ES2022 instead.' },
        ],
      },
    },
  ],
};
