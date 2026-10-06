const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**'],
  },
  {
    files: ['backend/**/*.js', 'backend/test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
    },
  },
  {
    files: ['frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'error',
      'no-unreachable': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
    },
  },
];
