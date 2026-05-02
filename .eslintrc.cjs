module.exports = {
  env: {
    browser: true,
    es2021: true,
    worker: true,
    serviceworker: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off",
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
    "no-var": "error",
    "prefer-const": "error",
    "no-multiple-empty-lines": ["error", { max: 1 }],
    semi: ["error", "always"],
    quotes: ["error", "double"],
  },
  ignorePatterns: ["dist/", "node_modules/"],
};
