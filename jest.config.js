module.exports = {
  preset: "jest-expo",
  resolver: "react-native-worklets/jest/resolver.js",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.form-scaffold/"],
};
