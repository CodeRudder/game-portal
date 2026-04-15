/**
 * renderer/CivRenderStrategies.ts — 四大文明专属渲染策略
 *
 * 为每个古代文明游戏定义独特的渲染策略，包括：
 * - 颜色主题（反映文明特色）
 * - 布局参数（适配文明特有 UI）
 * - 建筑风格（程序化绘制的形状和颜色）
 *
 * 策略列表：
 *   - civ-china:  红金配色、古都风格
 *   - civ-egypt:  金沙配色、沙漠风格
 *   - civ-babylon: 青铜配色、城邦风格
 *   - civ-india:  翡翠配色、丛林风格
 *
 * @module renderer/CivRenderStrategies
 */

import type { RenderStrategy } from './types';

// ═══════════════════════════════════════════════════════════════
// 华夏文明策略 — 红金配色、古都风格
// ═══════════════════════════════════════════════════════════════

/** 华夏文明渲染策略 */
export const CIV_CHINA_STRATEGY: RenderStrategy = {
  name: 'civ-china',
  sceneType: 'idle',
  theme: {
    background: '#1a0a0a',
    panelBackground: '#2a1414',
    textPrimary: '#f0e0d0',
    textSecondary: '#b89878',
    accent: '#d4a017',
    success: '#c0392b',
    warning: '#e67e22',
    resourceBarBg: '#2a0f0f',
    buttonBg: '#4a1a1a',
    buttonHover: '#6a2a2a',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.45,
    upgradePanelHeight: 0.35,
    statsPanelWidth: 0.25,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 6,
  },
};

// ═══════════════════════════════════════════════════════════════
// 古埃及文明策略 — 金沙配色、沙漠风格
// ═══════════════════════════════════════════════════════════════

/** 古埃及文明渲染策略 */
export const CIV_EGYPT_STRATEGY: RenderStrategy = {
  name: 'civ-egypt',
  sceneType: 'idle',
  theme: {
    background: '#1a1408',
    panelBackground: '#2a2210',
    textPrimary: '#f0e8c8',
    textSecondary: '#a89868',
    accent: '#c8a832',
    success: '#2ecc71',
    warning: '#d4a017',
    resourceBarBg: '#221a08',
    buttonBg: '#3a3018',
    buttonHover: '#4a4028',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.3,
    statsPanelWidth: 0.22,
    gridColumns: 3,
    gridGap: 10,
    padding: 14,
    borderRadius: 8,
  },
};

// ═══════════════════════════════════════════════════════════════
// 巴比伦文明策略 — 青铜配色、城邦风格
// ═══════════════════════════════════════════════════════════════

/** 巴比伦文明渲染策略 */
export const CIV_BABYLON_STRATEGY: RenderStrategy = {
  name: 'civ-babylon',
  sceneType: 'idle',
  theme: {
    background: '#0a1218',
    panelBackground: '#141e28',
    textPrimary: '#d8d0c0',
    textSecondary: '#8a8070',
    accent: '#c8963e',
    success: '#27ae60',
    warning: '#e67e22',
    resourceBarBg: '#0e161e',
    buttonBg: '#1e2e3e',
    buttonHover: '#2e3e4e',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.48,
    upgradePanelHeight: 0.32,
    statsPanelWidth: 0.24,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 4,
  },
};

// ═══════════════════════════════════════════════════════════════
// 印度文明策略 — 翡翠配色、丛林风格
// ═══════════════════════════════════════════════════════════════

/** 印度文明渲染策略 */
export const CIV_INDIA_STRATEGY: RenderStrategy = {
  name: 'civ-india',
  sceneType: 'idle',
  theme: {
    background: '#0a1a0e',
    panelBackground: '#142a18',
    textPrimary: '#d8f0d8',
    textSecondary: '#78a878',
    accent: '#e8a030',
    success: '#2ecc71',
    warning: '#f39c12',
    resourceBarBg: '#0e1f12',
    buttonBg: '#1a3a20',
    buttonHover: '#2a4a30',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.3,
    statsPanelWidth: 0.22,
    gridColumns: 3,
    gridGap: 10,
    padding: 14,
    borderRadius: 10,
  },
};

// ═══════════════════════════════════════════════════════════════
// 策略注册辅助函数
// ═══════════════════════════════════════════════════════════════

/** 所有文明策略映射 */
export const CIV_STRATEGIES: Record<string, RenderStrategy> = {
  'civ-china': CIV_CHINA_STRATEGY,
  'civ-egypt': CIV_EGYPT_STRATEGY,
  'civ-babylon': CIV_BABYLON_STRATEGY,
  'civ-india': CIV_INDIA_STRATEGY,
};

/**
 * 将所有文明策略注册到 RenderStrategyRegistry
 *
 * 应在应用启动时调用一次。
 */
export async function registerCivStrategies(): Promise<void> {
  const { RenderStrategyRegistry } = await import('./RenderStrategyRegistry');

  for (const [name, strategy] of Object.entries(CIV_STRATEGIES)) {
    RenderStrategyRegistry.register(name, strategy);
    RenderStrategyRegistry.registerGameMapping(name, name);
  }
}
