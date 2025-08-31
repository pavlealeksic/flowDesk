module.exports = {
  extends: ['../.eslintrc.js'],
  env: {
    node: true,
    browser: true,
  },
  rules: {
    'no-console': 'off', // Allow console in shared utilities
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
