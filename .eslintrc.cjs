module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
  },
  overrides: [
    {
      // vi.mocked(someObject.someMethod) extracts a method reference by
      // design — exactly the pattern this rule exists to flag outside of
      // tests, so it's a false positive here rather than a real risk.
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/unbound-method': 'off',
        // supertest's `res.body` is typed `any` (a library limitation, not
        // untyped code of ours) — asserting on raw JSON responses always
        // trips the no-unsafe-* family, so it's noise specifically here.
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage'],
};
