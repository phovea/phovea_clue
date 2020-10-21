/**
 * Link to configuration options: https://prettier.io/docs/en/options.html
*/
module.exports = {
  printWidth: 100, // after how many characters line should wrapp
  tabWidth: 2,
  singleQuote: true, // replace
  useTabs: true, // use tabs instead of spaces --> big difference with current formatting
  semi: true, // add semicolon when formatting
  // quoteProps: 'as-needed|consistent|preserve' // default: "as-needed"
  // jsxSingleQuote: false  // default: false
  trailingComma: "none", // options: "<es5|none|all>" default: "es5"
  bracketSpacing: false, // default: true
  jsxBracketSameLine: false,
  arrowParens: "always",
  // requirePragma:true // when set to true will format only files with a /* @prettier */ comment
  // proseWrap: "never" // wrapp line .md files
  htmlWhitespaceSensitivity: "css" // fromat html tag depending on it's display property "inline", "block"
};
