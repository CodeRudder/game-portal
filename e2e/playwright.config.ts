/**
 * Playwright E2E 测试配置
 *
 * 支持：
 *   - 无头模式（CI 环境）
 *   - 有头模式（本地调试）
 *   - 截图（失败时自动截图）
 *   - 追踪（首次重试时记录）
 *   - Web Server 自动启动（preview 模式）
 *
 * 运行方式：
 *   npx playwright test e2e/ --config e2e/playwright.config.ts
 *   npx playwright test e2e/tab-smoke.spec.ts --config e2e/playwright.config.ts
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  // 测试文件目录
  testDir: '.',

  // 匹配模式 — .spec.ts 和 .test.ts 都支持
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],

  // 全局超时（单测试用例最大执行时间）
  timeout: 30_000,

  // expect 断言超时
  expect: {
    timeout: 5_000,
  },

  // 失败重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行 worker 数
  workers: process.env.CI ? 1 : undefined,

  // 测试报告
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/report' }],
  ],

  // 全局配置
  use: {
    // 基础 URL — 支持环境变量覆盖
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',

    // 无头模式
    headless: true,

    // 视口大小（模拟手机）
    viewport: { width: 390, height: 844 },

    // 截图策略：失败时截图
    screenshot: 'only-on-failure',

    // 追踪策略：首次重试时记录
    trace: 'on-first-retry',

    // 操作超时
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  // 项目配置 — 支持多浏览器
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // CI 环境下使用 sandbox 模式
        launchOptions: {
          args: process.env.CI
            ? ['--no-sandbox', '--disable-setuid-sandbox']
            : [],
        },
      },
    },
  ],

  // Web Server 配置 — 可选：自动启动 preview server
  // 取消注释以下配置后，运行测试时会自动启动 preview server
  // webServer: {
  //   command: 'npm run preview',
  //   port: 4173,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },
});
