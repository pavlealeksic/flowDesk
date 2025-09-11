module.exports = {
  extends: ['../.eslintrc.js'],
  env: {
    browser: true,
    node: true,
  },
  overrides: [
    {
      files: ['src/main/**/*'],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['src/renderer/**/*', 'src/preload/**/*'],
      env: {
        browser: true,
        node: false,
      },
    },
  ],
}
