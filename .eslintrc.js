module.exports = {
    extends: [
      "airbnb-typescript",
      "airbnb/hooks",
      "plugin:@typescript-eslint/recommended",
      "plugin:jest/recommended",
      "prettier",
      "prettier/react",
      "prettier/@typescript-eslint",
      "plugin:prettier/recommended",
    ],
    plugins: ["react", "@typescript-eslint", "jest"],
    env: {
      browser: true,
      es6: true,
      jest: true,
    },
    globals: {
      Atomics: "readonly",
      SharedArrayBuffer: "readonly",
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 2018,
      sourceType: "module",
      project: "./tsconfig.json",
    },
    rules: {
      "linebreak-style": "off",
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
      "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
      "react/prop-types": "off",
      "react/jsx-props-no-spreading": "off",
      "import/prefer-default-export": "off"
    },
};