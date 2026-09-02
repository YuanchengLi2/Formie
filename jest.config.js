module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  testPathIgnorePatterns: [
    "<rootDir>/.codex-tmp/",
    "<rootDir>/.form-scaffold/",
    "<rootDir>/.worktrees/",
    "<rootDir>/.expo/review/",
    "<rootDir>/website/",
    "<rootDir>/scripts/app-store-policy-audit.test.js",
    "<rootDir>/scripts/app-store-submission-assets-audit.test.js",
    "<rootDir>/scripts/store-metadata.test.cjs",
    "<rootDir>/scripts/strict-eas-metadata-lint.test.js",
    "<rootDir>/scripts/configure-external-deletion-worker.test.js",
  ],
  modulePathIgnorePatterns: ["<rootDir>/.codex-tmp/", "<rootDir>/.worktrees/", "<rootDir>/.expo/review/"],
  moduleNameMapper: {
    "^@/components/anatomy-model$": "<rootDir>/src/components/anatomy-model.tsx",
  },
};
