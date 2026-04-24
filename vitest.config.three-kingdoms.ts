// 三国霸业 — 独立测试配置
// 用途: pnpm run test:tk / test:tk:watch / test:tk:coverage
// 覆盖范围: three-kingdoms engine tests + idle UI component tests
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // ── 测试文件匹配范围 ──
    include: [
      'src/games/three-kingdoms/**/*.test.ts',
      'src/components/idle/**/*.test.tsx',
    ],
    // 排除备份目录
    exclude: [
      'src/games/three-kingdoms/bak/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-three-kingdoms/**',
    ],

    // ── 测试环境 ──
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 15000,

    // ── 并行池配置 ──
    pool: 'forks',
    poolOptions: {
      forks: {
        // 单进程模式，配合 scripts/test.sh 分批运行避免OOM
        singleFork: true,
      },
    },

    // ── 覆盖率配置（独立于主项目） ──
    coverage: {
      provider: 'v8',
      include: [
        'src/games/three-kingdoms/**/*.ts',
        'src/components/idle/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/games/three-kingdoms/**/*.test.ts',
        'src/games/three-kingdoms/**/__tests__/**',
        'src/games/three-kingdoms/tests/**',
        'src/games/three-kingdoms/test-utils/**',
        'src/games/three-kingdoms/bak/**',
        'src/components/idle/**/*.test.tsx',
        'src/components/idle/**/__tests__/**',
      ],
      reportsDirectory: 'coverage-three-kingdoms',
    },
  },
});
