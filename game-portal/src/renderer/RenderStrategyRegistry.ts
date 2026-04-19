/**
 * renderer/RenderStrategyRegistry.ts — 渲染策略注册表
 *
 * 为每种放置游戏类型注册对应的渲染策略。
 * 策略包括：颜色主题、布局参数、场景类型。
 *
 * 使用方式：
 * ```ts
 * const strategy = RenderStrategyRegistry.get('cookie-clicker');
 * // 或使用默认策略
 * const defaultStrategy = RenderStrategyRegistry.getDefault();
 * ```
 *
 * @module renderer/RenderStrategyRegistry
 */

import type { RenderStrategy } from './types';

// ═══════════════════════════════════════════════════════════════
// 默认策略
// ═══════════════════════════════════════════════════════════════

/** 通用放置游戏默认渲染策略 */
const DEFAULT_STRATEGY: RenderStrategy = {
  name: 'default',
  sceneType: 'idle',
  theme: {
    background: '#0f0f1a',
    panelBackground: '#1a1a2e',
    textPrimary: '#e0e0e0',
    textSecondary: '#8888aa',
    accent: '#ffd700',
    success: '#4ecdc4',
    warning: '#f39c12',
    resourceBarBg: '#16162a',
    buttonBg: '#2a2a4a',
    buttonHover: '#3a3a6a',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.3,
    statsPanelWidth: 0.2,
    gridColumns: 3,
    gridGap: 8,
    padding: 12,
    borderRadius: 8,
  },
};

// ═══════════════════════════════════════════════════════════════
// 预定义策略
// ═══════════════════════════════════════════════════════════════

/** Cookie Clicker 风格策略 — 温暖色调 */
const COOKIE_STRATEGY: RenderStrategy = {
  name: 'cookie-clicker',
  sceneType: 'idle',
  theme: {
    background: '#1a0f0a',
    panelBackground: '#2a1f14',
    textPrimary: '#f0e6d3',
    textSecondary: '#a89070',
    accent: '#ff9f43',
    success: '#6ab04c',
    warning: '#f0932b',
    resourceBarBg: '#2a1a0a',
    buttonBg: '#3a2a1a',
    buttonHover: '#5a3a2a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.55,
    upgradePanelHeight: 0.28,
    statsPanelWidth: 0.22,
    gridColumns: 3,
    gridGap: 10,
    padding: 14,
    borderRadius: 10,
  },
};

/** 文明建设风格策略 — 冷色调 */
const CIV_STRATEGY: RenderStrategy = {
  name: 'civilization',
  sceneType: 'idle',
  theme: {
    background: '#0a1a2a',
    panelBackground: '#0f2a3f',
    textPrimary: '#d0e8f0',
    textSecondary: '#6a98aa',
    accent: '#00b4d8',
    success: '#2ecc71',
    warning: '#e67e22',
    resourceBarBg: '#0a1a2a',
    buttonBg: '#1a3a5a',
    buttonHover: '#2a4a6a',
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

/** 奇幻 RPG 风格策略 — 紫色调 */
const FANTASY_STRATEGY: RenderStrategy = {
  name: 'fantasy',
  sceneType: 'idle',
  theme: {
    background: '#12061f',
    panelBackground: '#1a0a2e',
    textPrimary: '#e8d0f8',
    textSecondary: '#8a6aaa',
    accent: '#a855f7',
    success: '#34d399',
    warning: '#fbbf24',
    resourceBarBg: '#160828',
    buttonBg: '#2a1a4a',
    buttonHover: '#3a2a6a',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.3,
    statsPanelWidth: 0.2,
    gridColumns: 3,
    gridGap: 8,
    padding: 12,
    borderRadius: 12,
  },
};

/** 科幻风格策略 — 蓝绿霓虹 */
const SCIFI_STRATEGY: RenderStrategy = {
  name: 'scifi',
  sceneType: 'idle',
  theme: {
    background: '#020a14',
    panelBackground: '#041420',
    textPrimary: '#00ffcc',
    textSecondary: '#4a8a7a',
    accent: '#00ffff',
    success: '#00ff88',
    warning: '#ff6600',
    resourceBarBg: '#031018',
    buttonBg: '#0a2a3a',
    buttonHover: '#0a3a4a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.52,
    upgradePanelHeight: 0.32,
    statsPanelWidth: 0.2,
    gridColumns: 4,
    gridGap: 6,
    padding: 10,
    borderRadius: 4,
  },
};

/** 全面战争风格策略 — 钢铁灰+血红色军事主题 */
const TOTAL_WAR_STRATEGY: RenderStrategy = {
  name: 'total-war',
  sceneType: 'idle',
  theme: {
    background: '#1a1a1e',
    panelBackground: '#2a2a30',
    textPrimary: '#d0d0d8',
    textSecondary: '#7a7a8a',
    accent: '#c0392b',
    success: '#27ae60',
    warning: '#e67e22',
    resourceBarBg: '#1e1e24',
    buttonBg: '#3a2a2a',
    buttonHover: '#4a3a3a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.38,
    statsPanelWidth: 0.25,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 6,
  },
};

/** 英雄无敌风格策略 — 紫金奇幻主题 */
const HEROES_MIGHT_STRATEGY: RenderStrategy = {
  name: 'heroes-might',
  sceneType: 'idle',
  theme: {
    background: '#12061f',
    panelBackground: '#1a0a2e',
    textPrimary: '#e8d0f8',
    textSecondary: '#8a6aaa',
    accent: '#ffd700',
    success: '#34d399',
    warning: '#fbbf24',
    resourceBarBg: '#160828',
    buttonBg: '#2a1a4a',
    buttonHover: '#3a2a6a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.38,
    statsPanelWidth: 0.25,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 12,
  },
};

/** 帝国时代风格策略 — 棕金帝国主题 */
const AGE_OF_EMPIRES_STRATEGY: RenderStrategy = {
  name: 'age-of-empires',
  sceneType: 'idle',
  theme: {
    background: '#1a1408',
    panelBackground: '#2a2010',
    textPrimary: '#f0e6d3',
    textSecondary: '#a89070',
    accent: '#d4a017',
    success: '#6ab04c',
    warning: '#f0932b',
    resourceBarBg: '#1e1808',
    buttonBg: '#3a2a1a',
    buttonHover: '#4a3a2a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.38,
    statsPanelWidth: 0.25,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 8,
  },
};

/** 华夏文明策略 — 朱红+金色主题 */
const CIV_CHINA_STRATEGY: RenderStrategy = {
  name: 'civ-china',
  sceneType: 'idle',
  theme: {
    background: '#1a0a0a',
    panelBackground: '#2a1414',
    textPrimary: '#fff0d0',
    textSecondary: '#c8a080',
    accent: '#cc2936',
    success: '#ffd700',
    warning: '#f39c12',
    resourceBarBg: '#1e0e0e',
    buttonBg: '#3a1a1a',
    buttonHover: '#4a2a2a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.48,
    upgradePanelHeight: 0.32,
    statsPanelWidth: 0.22,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 6,
  },
};

/** 埃及文明策略 — 沙金+蓝色主题 */
const CIV_EGYPT_STRATEGY: RenderStrategy = {
  name: 'civ-egypt',
  sceneType: 'idle',
  theme: {
    background: '#1a1500',
    panelBackground: '#2a2008',
    textPrimary: '#f0e6d3',
    textSecondary: '#a89860',
    accent: '#daa520',
    success: '#1e90ff',
    warning: '#e67e22',
    resourceBarBg: '#1e1800',
    buttonBg: '#3a2a08',
    buttonHover: '#4a3a18',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.48,
    upgradePanelHeight: 0.32,
    statsPanelWidth: 0.22,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 4,
  },
};

/** 巴比伦文明策略 — 青铜+紫色主题 */
const CIV_BABYLON_STRATEGY: RenderStrategy = {
  name: 'civ-babylon',
  sceneType: 'idle',
  theme: {
    background: '#150a1a',
    panelBackground: '#200e28',
    textPrimary: '#e8d0c8',
    textSecondary: '#9a7a8a',
    accent: '#cd7f32',
    success: '#9370db',
    warning: '#fbbf24',
    resourceBarBg: '#18081e',
    buttonBg: '#2a1a3a',
    buttonHover: '#3a2a4a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.48,
    upgradePanelHeight: 0.32,
    statsPanelWidth: 0.22,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 8,
  },
};

/** 印度文明策略 — 翠绿+橙色主题 */
const CIV_INDIA_STRATEGY: RenderStrategy = {
  name: 'civ-india',
  sceneType: 'idle',
  theme: {
    background: '#0a1a0a',
    panelBackground: '#102a14',
    textPrimary: '#f0f8e8',
    textSecondary: '#7aaa6a',
    accent: '#2e8b57',
    success: '#ff8c00',
    warning: '#f39c12',
    resourceBarBg: '#0e1e0e',
    buttonBg: '#1a3a1a',
    buttonHover: '#2a4a2a',
  },
  layout: {
    resourceBarHeight: 0.08,
    buildingAreaHeight: 0.48,
    upgradePanelHeight: 0.32,
    statsPanelWidth: 0.22,
    gridColumns: 4,
    gridGap: 8,
    padding: 12,
    borderRadius: 10,
  },
};

/** 自然/农场风格策略 — 绿色暖调 */
const NATURE_STRATEGY: RenderStrategy = {
  name: 'nature',
  sceneType: 'idle',
  theme: {
    background: '#0a1a0a',
    panelBackground: '#142a14',
    textPrimary: '#d4e8c8',
    textSecondary: '#7aaa6a',
    accent: '#8bc34a',
    success: '#4caf50',
    warning: '#ff9800',
    resourceBarBg: '#0f1f0f',
    buttonBg: '#1a3a1a',
    buttonHover: '#2a4a2a',
  },
  layout: {
    resourceBarHeight: 0.1,
    buildingAreaHeight: 0.5,
    upgradePanelHeight: 0.3,
    statsPanelWidth: 0.2,
    gridColumns: 3,
    gridGap: 10,
    padding: 14,
    borderRadius: 8,
  },
};

// ═══════════════════════════════════════════════════════════════
// 游戏 ID → 策略映射
// ═══════════════════════════════════════════════════════════════

/**
 * 游戏 ID 到策略名称的映射
 *
 * 使用简单的关键词匹配来为游戏分配策略。
 * 未匹配的游戏使用 DEFAULT_STRATEGY。
 */
const GAME_STRATEGY_MAP: Record<string, string> = {
  // Cookie/点击类
  'cookie-clicker': 'cookie-clicker',
  'clicker-heroes': 'cookie-clicker',

  // 文明建设类 — 使用文明专属策略
  'civ-china': 'civ-china',
  'civ-egypt': 'civ-egypt',
  'civ-babylon': 'civ-babylon',
  'civ-india': 'civ-india',
  'age-of-empires': 'age-of-empires',
  'modern-city': 'civilization',

  // 奇幻 RPG 类
  'idle-xianxia': 'fantasy',
  'sect-rise': 'fantasy',
  'norse-valkyrie': 'fantasy',
  'greek-gods': 'fantasy',
  'yokai-night': 'fantasy',
  'egypt-myth': 'fantasy',
  'baldurs-gate': 'fantasy',
  'heroes-might': 'heroes-might',
  'final-fantasy': 'fantasy',

  // 科幻类
  'space-war': 'scifi',
  'space-drift': 'scifi',
  'space-dodge': 'scifi',

  // 自然/农场类
  'ant-kingdom': 'nature',
  'kittens-kingdom': 'nature',
  'dino-ranch': 'nature',
  'penguin-empire': 'nature',
  'fishing-master': 'nature',
  'wild-survival': 'nature',
  'doggo-home': 'nature',
  'island-drift': 'nature',

  // 三国使用默认策略（有专门的 MapScene）
  'three-kingdoms': 'default',

  // 其他放置游戏
  'clan-saga': 'fantasy',
  'alchemy-master': 'fantasy',
  'doodle-god': 'fantasy',

  // 专属策略游戏
  'total-war': 'total-war',
};

/**
 * 策略名称到策略实例的映射
 */
const STRATEGIES: Map<string, RenderStrategy> = new Map([
  ['default', DEFAULT_STRATEGY],
  ['cookie-clicker', COOKIE_STRATEGY],
  ['civilization', CIV_STRATEGY],
  ['fantasy', FANTASY_STRATEGY],
  ['scifi', SCIFI_STRATEGY],
  ['nature', NATURE_STRATEGY],
  ['total-war', TOTAL_WAR_STRATEGY],
  ['heroes-might', HEROES_MIGHT_STRATEGY],
  ['age-of-empires', AGE_OF_EMPIRES_STRATEGY],
  ['civ-china', CIV_CHINA_STRATEGY],
  ['civ-egypt', CIV_EGYPT_STRATEGY],
  ['civ-babylon', CIV_BABYLON_STRATEGY],
  ['civ-india', CIV_INDIA_STRATEGY],
]);

// ═══════════════════════════════════════════════════════════════
// 注册表 API
// ═══════════════════════════════════════════════════════════════

/**
 * 渲染策略注册表
 *
 * 提供：
 * - 根据游戏 ID 获取策略
 * - 注册自定义策略
 * - 列出所有可用策略
 */
export const RenderStrategyRegistry = {
  /**
   * 根据游戏 ID 获取渲染策略
   *
   * @param gameId - 游戏 ID（如 'cookie-clicker'）
   * @returns 匹配的渲染策略，未找到则返回默认策略
   */
  get(gameId: string): RenderStrategy {
    const strategyName = GAME_STRATEGY_MAP[gameId];
    if (strategyName) {
      return STRATEGIES.get(strategyName) ?? DEFAULT_STRATEGY;
    }
    return DEFAULT_STRATEGY;
  },

  /**
   * 获取默认渲染策略
   */
  getDefault(): RenderStrategy {
    return DEFAULT_STRATEGY;
  },

  /**
   * 注册自定义策略
   *
   * @param name - 策略名称
   * @param strategy - 策略实例
   */
  register(name: string, strategy: RenderStrategy): void {
    STRATEGIES.set(name, strategy);
  },

  /**
   * 注册游戏到策略的映射
   *
   * @param gameId - 游戏 ID
   * @param strategyName - 策略名称
   */
  registerGameMapping(gameId: string, strategyName: string): void {
    GAME_STRATEGY_MAP[gameId] = strategyName;
  },

  /**
   * 列出所有已注册的策略名称
   */
  listStrategies(): string[] {
    return Array.from(STRATEGIES.keys());
  },

  /**
   * 列出所有已注册的游戏映射
   */
  listGameMappings(): Record<string, string> {
    return { ...GAME_STRATEGY_MAP };
  },

  /**
   * 检查策略是否存在
   */
  hasStrategy(name: string): boolean {
    return STRATEGIES.has(name);
  },

  /**
   * 检查游戏映射是否存在
   */
  hasGameMapping(gameId: string): boolean {
    return gameId in GAME_STRATEGY_MAP;
  },

  /**
   * 移除游戏映射
   */
  removeGameMapping(gameId: string): boolean {
    if (gameId in GAME_STRATEGY_MAP) {
      delete GAME_STRATEGY_MAP[gameId];
      return true;
    }
    return false;
  },
};
