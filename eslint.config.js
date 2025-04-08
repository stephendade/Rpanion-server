const react = require('eslint-plugin-react');
const globals = require('globals');
const mochaPlugin = require('eslint-plugin-mocha');

module.exports = [
  {
    files: ["src/*.jsx"],
    ...react.configs.flat.recommended,
  },
  {
    files: ["server/*.js", "mavlink/*.js"],
    ...mochaPlugin.configs.flat.recommended,
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        ...globals.node, ...globals.mocha
      },
    },
  },
  {
    ignores : [
      "node_modules/",
      "build/",
      "coverage/",
    ],
  },
  {
    plugins: {
      react
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser, ...globals.node
      },
    },
    rules: {
      // ... any rules you want
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
     },
    settings: {
      react: {
        version: "detect",
      },
    },
  }
];