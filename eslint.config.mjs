import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import mochaPlugin from 'eslint-plugin-mocha';

export default [
  {
    files: ["src/*.js"],
    languageOptions: {
      sourceType: 'module',
    }
  },
  {
    files: ["server/*.js", "mavlink/*.js"], languageOptions: {
      sourceType: "commonjs",
    }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser, ...globals.node
      }
    }
  },
  {
    settings : {
      react: {
        version: 'detect', // Automatically detect the version of React
      },
    }
  },
  {
    ignores : [
      "node_modules/",
      "build/"
    ],
  },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  mochaPlugin.configs.flat.recommended
];