import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * 手动 chunk 拆分策略
         * - pixi: PixiJS 渲染引擎（~576KB）
         * - gsap: GSAP 动画库（~70KB）
         * - react-vendor: React 生态库（~163KB）
         * - game-engines: 所有游戏引擎代码（src/games/）
         * - renderer: PixiJS 渲染适配层（src/renderer/）
         * - idle-engines: 放置游戏引擎框架（src/engines/）
         */
        manualChunks(id) {
          // ── pixi.js 独立 chunk ──
          if (id.includes('node_modules/pixi.js') || id.includes('node_modules/@pixi/')) {
            return 'pixi';
          }
          // ── gsap 独立 chunk ──
          if (id.includes('node_modules/gsap')) {
            return 'gsap';
          }
          // ── React 相关库 ──
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          // ── 放置引擎代码 (src/engines/) — 需在 game-engines 之前判断 ──
          if (id.includes('/src/engines/')) {
            return 'idle-engines';
          }
          // ── 渲染器代码 (src/renderer/) ──
          if (id.includes('/src/renderer/')) {
            return 'renderer';
          }
          // ── 游戏引擎按类别拆分 (src/games/) ──
          if (id.includes('/src/games/')) {
            const match = id.match(/\/src\/games\/([^/]+)\//);
            if (match) {
              const gameId = match[1];
              // 放置游戏（继承 IdleGameEngine）
              const idleGames = ['age-of-empires','alchemy-master','ant-kingdom','baldurs-gate',
                'civ-babylon','civ-china','civ-egypt','civ-india','clan-saga','cookie-clicker',
                'dino-ranch','doggo-home','doomsday','dungeon-explore','egypt-myth',
                'final-fantasy','greek-gods','heroes-might','idle-xianxia','island-drift',
                'kittens-kingdom','modern-city','norse-valkyrie','penguin-empire','red-alert',
                'sect-rise','space-drift','three-kingdoms','total-war','tribulation',
                'wild-survival','yokai-night'];
              // 策略/战争游戏
              const strategyGames = ['battle-city','bloons','chess','chinese-chess','checkers',
                'connect-four','gomoku','hex','mini-go','othello','senet','tic-tac-toe',
                'backgammon','mancala','dots-and-boxes'];
              if (idleGames.includes(gameId)) return 'games-idle';
              if (strategyGames.includes(gameId)) return 'games-strategy';
              return 'games-arcade';
            }
            return 'games-arcade';
          }
        },
      },
    },
  },
});
