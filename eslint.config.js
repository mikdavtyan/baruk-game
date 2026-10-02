// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // jest.mock factories are hoisted above imports, so they must require();
    // react-test-renderer has no type declarations here.
    files: ["**/*.test.ts", "**/*.test.tsx", "jest.setup.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
