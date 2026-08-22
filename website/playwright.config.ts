import { defineConfig } from "@playwright/test";

const widths = [320, 375, 390, 768, 1024, 1440];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: process.env.CI ? 4 : 3,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: widths.map((width) => ({
    name: `responsive-${width}`,
    use: { viewport: { width, height: width <= 390 ? 844 : width <= 768 ? 1024 : 1000 } },
  })),
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
