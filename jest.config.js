module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.form-scaffold/", "<rootDir>/.worktrees/", "<rootDir>/.expo/review/", "<rootDir>/website/"],
  modulePathIgnorePatterns: ["<rootDir>/.worktrees/", "<rootDir>/.expo/review/"],
  moduleNameMapper: {
    "^@/components/anatomy-model$": "<rootDir>/src/components/anatomy-model.tsx",
  },
};
