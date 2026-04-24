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
         *
         * ┌──────────────────────────────────────────────────────────┐
         * │  Chunk 名称                │  内容                        │
         * ├──────────────────────────────────────────────────────────┤
         * │  pixi                      │  PixiJS 渲染引擎（~536KB）   │
         * │  gsap                      │  GSAP 动画库（~70KB）        │
         * │  react-vendor              │  React 生态库（~163KB）      │
         * │  game-engine-base          │  GameEngine 基类             │
         * │  renderer                  │  PixiJS 渲染适配层           │
         * │  idle-engines              │  放置游戏引擎框架             │
         * │  three-kingdoms            │  三国霸业 UI + 引擎主类       │
         * │  three-kingdoms-tech       │  科技子系统                  │
         * │  three-kingdoms-event      │  事件子系统                  │
         * │  three-kingdoms-campaign   │  关卡/战役子系统              │
         * │  three-kingdoms-social     │  社交/联盟子系统              │
         * │  three-kingdoms-npc        │  NPC 子系统                  │
         * │  three-kingdoms-map        │  地图子系统                  │
         * │  three-kingdoms-battle     │  战斗子系统                  │
         * │  three-kingdoms-equipment  │  装备子系统                  │
         * │  three-kingdoms-hero       │  武将子系统                  │
         * │  three-kingdoms-offline    │  离线收益子系统               │
         * │  three-kingdoms-expedition │  远征子系统                  │
         * │  three-kingdoms-unification│  统一子系统                  │
         * │  three-kingdoms-guide      │  新手引导子系统               │
         * │  three-kingdoms-trade      │  贸易子系统                  │
         * │  three-kingdoms-pvp        │  PVP 子系统                  │
         * │  three-kingdoms-calendar   │  历法子系统                  │
         * │  three-kingdoms-prestige   │  威望子系统                  │
         * │  three-kingdoms-quest      │  任务子系统                  │
         * │  three-kingdoms-mail       │  邮件子系统                  │
         * │  civ-china-pixi            │  华夏文明（独立 chunk）       │
         * │  civ-egypt-pixi            │  埃及文明（独立 chunk）       │
         * │  civ-babylon-pixi          │  巴比伦文明（独立 chunk）     │
         * │  civ-india-pixi            │  印度文明（独立 chunk）       │
         * │  total-war-pixi            │  全面战争（独立 chunk）       │
         * │  heroes-might-pixi         │  英雄无敌（独立 chunk）       │
         * │  age-of-empires-pixi       │  帝国时代（独立 chunk）       │
         * │  (auto)                    │  每个游戏引擎自动独立 chunk   │
         * └──────────────────────────────────────────────────────────┘
         *
         * 匹配顺序原则：
         * 1. 三方库（pixi / gsap / react）优先
         * 2. 三国霸业引擎子系统（最具体路径优先，避免被通用规则吞掉）
         * 3. 三国霸业核心基础设施（core/ 模块按子系统归并）
         * 4. 三国霸业主 chunk（UI 组件 + 引擎主类 + 小子系统）
         * 5. 通用框架（engines / renderer）
         * 6. 其他 PixiJS 游戏组件
         *
         * createEngine.ts 使用动态 import() 加载每个游戏引擎，
         * Vite/Rollup 会自动为每个动态 import 创建独立 chunk。
         */
        manualChunks(id) {
          // ── 1. 第三方库 ──

          // GameEngine 基类独立 chunk（打破循环依赖）
          if (id.includes('/src/core/GameEngine.ts')) {
            return 'game-engine-base';
          }

          // PixiJS 独立 chunk
          if (id.includes('pixi.js') || id.includes('@pixi')) {
            return 'pixi';
          }

          // GSAP 独立 chunk
          if (id.includes('node_modules/gsap')) {
            return 'gsap';
          }

          // React 相关库
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom')
          ) {
            return 'react-vendor';
          }

          // ── 2. 三国霸业 — 引擎子系统拆分（最具体路径优先匹配） ──

          // 科技子系统（~704KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/tech/')) {
            return 'three-kingdoms-tech';
          }
          // 事件子系统（~696KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/event/')) {
            return 'three-kingdoms-event';
          }
          // 关卡/战役子系统（~664KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/campaign/')) {
            return 'three-kingdoms-campaign';
          }
          // NPC 子系统（~508KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/npc/')) {
            return 'three-kingdoms-npc';
          }
          // 地图子系统（~508KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/map/')) {
            return 'three-kingdoms-map';
          }
          // 战斗子系统（~492KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/battle/')) {
            return 'three-kingdoms-battle';
          }
          // 离线收益子系统（~480KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/offline/')) {
            return 'three-kingdoms-offline';
          }
          // 武将子系统（~476KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/hero/')) {
            return 'three-kingdoms-hero';
          }
          // 远征子系统（~420KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/expedition/')) {
            return 'three-kingdoms-expedition';
          }
          // 装备子系统（~396KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/equipment/')) {
            return 'three-kingdoms-equipment';
          }
          // 设置子系统（~388KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/settings/')) {
            return 'three-kingdoms-settings';
          }
          // 新手引导子系统（~344KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/guide/')) {
            return 'three-kingdoms-guide';
          }
          // 响应式布局子系统（~320KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/responsive/')) {
            return 'three-kingdoms-responsive';
          }
          // 贸易子系统（~304KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/trade/')) {
            return 'three-kingdoms-trade';
          }
          // 社交 + 联盟子系统
          if (
            id.includes('/src/games/three-kingdoms/engine/social/') ||
            id.includes('/src/games/three-kingdoms/engine/alliance/')
          ) {
            return 'three-kingdoms-social';
          }
          // 历法子系统（~260KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/calendar/')) {
            return 'three-kingdoms-calendar';
          }
          // 统一子系统（~412KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/unification/')) {
            return 'three-kingdoms-unification';
          }
          // PVP 子系统（~204KB 源码）
          if (id.includes('/src/games/three-kingdoms/engine/pvp/')) {
            return 'three-kingdoms-pvp';
          }
          // 威望子系统
          if (id.includes('/src/games/three-kingdoms/engine/prestige/')) {
            return 'three-kingdoms-prestige';
          }
          // 任务子系统
          if (id.includes('/src/games/three-kingdoms/engine/quest/')) {
            return 'three-kingdoms-quest';
          }
          // 邮件子系统
          if (id.includes('/src/games/three-kingdoms/engine/mail/')) {
            return 'three-kingdoms-mail';
          }

          // ── 3. 三国霸业 — 核心基础设施（core/ 按子系统归并） ──

          if (id.includes('/src/games/three-kingdoms/core/prestige/')) {
            return 'three-kingdoms-prestige';
          }
          if (id.includes('/src/games/three-kingdoms/core/event/')) {
            return 'three-kingdoms-event';
          }
          if (id.includes('/src/games/three-kingdoms/core/map/')) {
            return 'three-kingdoms-map';
          }
          if (id.includes('/src/games/three-kingdoms/core/npc/')) {
            return 'three-kingdoms-npc';
          }
          if (id.includes('/src/games/three-kingdoms/core/unification/')) {
            return 'three-kingdoms-unification';
          }
          if (id.includes('/src/games/three-kingdoms/core/equipment/')) {
            return 'three-kingdoms-equipment';
          }
          if (id.includes('/src/games/three-kingdoms/core/guide/')) {
            return 'three-kingdoms-guide';
          }
          if (id.includes('/src/games/three-kingdoms/core/quest/')) {
            return 'three-kingdoms-quest';
          }
          if (id.includes('/src/games/three-kingdoms/core/trade/')) {
            return 'three-kingdoms-trade';
          }
          if (id.includes('/src/games/three-kingdoms/core/pvp/')) {
            return 'three-kingdoms-pvp';
          }
          if (id.includes('/src/games/three-kingdoms/core/offline/')) {
            return 'three-kingdoms-offline';
          }
          if (id.includes('/src/games/three-kingdoms/core/expedition/')) {
            return 'three-kingdoms-expedition';
          }
          if (id.includes('/src/games/three-kingdoms/core/tech/')) {
            return 'three-kingdoms-tech';
          }
          if (id.includes('/src/games/three-kingdoms/core/social/')) {
            return 'three-kingdoms-social';
          }
          if (id.includes('/src/games/three-kingdoms/core/alliance/')) {
            return 'three-kingdoms-social';
          }
          if (id.includes('/src/games/three-kingdoms/core/battle/')) {
            return 'three-kingdoms-battle';
          }
          if (id.includes('/src/games/three-kingdoms/core/hero/')) {
            return 'three-kingdoms-hero';
          }
          if (id.includes('/src/games/three-kingdoms/core/responsive/')) {
            return 'three-kingdoms-responsive';
          }
          if (id.includes('/src/games/three-kingdoms/core/settings/')) {
            return 'three-kingdoms-settings';
          }
          if (id.includes('/src/games/three-kingdoms/core/calendar/')) {
            return 'three-kingdoms-calendar';
          }
          if (id.includes('/src/games/three-kingdoms/core/mail/')) {
            return 'three-kingdoms-mail';
          }

          // ── 4. 三国霸业 — 主 chunk（UI 组件 + 引擎主类 + 小子系统） ──

          if (id.includes('/src/components/idle/ThreeKingdomsGame')) {
            return 'three-kingdoms';
          }
          if (id.includes('/src/components/idle/three-kingdoms/')) {
            return 'three-kingdoms';
          }
          if (id.includes('/src/games/three-kingdoms/')) {
            return 'three-kingdoms';
          }

          // ── 5. 通用框架 ──

          // 放置引擎框架代码 (src/engines/)
          if (id.includes('/src/engines/')) {
            return 'idle-engines';
          }

          // 渲染器代码 (src/renderer/)
          if (id.includes('/src/renderer/')) {
            return 'renderer';
          }

          // ── 6. 其他 PixiJS 游戏组件 — 各自独立 chunk ──

          if (id.includes('/src/components/idle/CivChinaPixiGame')) {
            return 'civ-china-pixi';
          }
          if (id.includes('/src/components/idle/CivEgyptPixiGame')) {
            return 'civ-egypt-pixi';
          }
          if (id.includes('/src/components/idle/CivBabylonPixiGame')) {
            return 'civ-babylon-pixi';
          }
          if (id.includes('/src/components/idle/CivIndiaPixiGame')) {
            return 'civ-india-pixi';
          }
          if (id.includes('/src/components/idle/TotalWarPixiGame')) {
            return 'total-war-pixi';
          }
          if (id.includes('/src/components/idle/HeroesMightPixiGame')) {
            return 'heroes-might-pixi';
          }
          if (id.includes('/src/components/idle/AgeOfEmpiresPixiGame')) {
            return 'age-of-empires-pixi';
          }
        },
      },
    },
  },
});
