module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/.codex-tmp/", "<rootDir>/.form-scaffold/", "<rootDir>/.worktrees/", "<rootDir>/.expo/review/", "<rootDir>/website/"],
  modulePathIgnorePatterns: ["<rootDir>/.codex-tmp/", "<rootDir>/.worktrees/", "<rootDir>/.expo/review/"],
  moduleNameMapper: {
    "^@/components/anatomy-model$": "<rootDir>/src/components/anatomy-model.tsx",
  },
};
