/**
 * 三国霸业 — 独立构建配置
 *
 * 用途：
 *   pnpm run build:three-kingdoms
 *
 * 将三国霸业引擎层（src/games/three-kingdoms/）编译为独立产物，
 * 验证引擎层可以脱离主项目独立编译。
 *
 * 注意：此配置仅用于独立验证，不影响主项目构建。
 * 主项目仍通过 lazy import（createEngine.ts）引用三国霸业。
 */
import { defineConfig } from 'vite';
import path from 'path';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/games/three-kingdoms/engine/index.ts'),
      name: 'ThreeKingdomsEngine',
      formats: ['es'],
      fileName: () => 'three-kingdoms-engine.js',
    },
    outDir: 'dist-three-kingdoms',
    emptyOutDir: true,
    rollupOptions: {
      // 外部化运行时依赖（引擎层不直接依赖这些，但类型引用可能触发打包）
      external: ['react', 'react-dom', 'pixi.js', 'gsap'],
    },
    // 独立构建不需要 minify，节省时间
    minify: false,
    // 关闭 chunk 大小警告
    chunkSizeWarningLimit: 2000,
  },
});
