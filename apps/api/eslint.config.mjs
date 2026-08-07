import base from '../../packages/config/eslint/base.mjs';

/** Nest DI relies on runtime imports for constructor parameter types. */
export default [
  ...base,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
