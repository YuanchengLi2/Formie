// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "website/test-results/**", "website/playwright-report/**"],
    // React Compiler's experimental lint rules treat the imperative mutation
    // APIs used by Reanimated, Gesture Handler, Expo Video, and native refs as
    // immutable render data. Those APIs are intentionally mutated from worklets,
    // event callbacks, and synchronization effects in React Native.
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
