module.exports = {
  extends: ['../.eslintrc.js', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  plugins: ['react', 'react-hooks'],
  env: {
    browser: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
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
