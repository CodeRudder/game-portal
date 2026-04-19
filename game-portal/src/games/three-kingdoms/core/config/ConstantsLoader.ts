/**
 * 常量加载器
 *
 * 负责从硬编码常量将默认配置加载到 ConfigRegistry。
 * v1.0 范围：游戏全局配置、初始资源配置、建筑初始等级。
 *
 * 设计原则：
 * - 常量集中定义在此文件中，不依赖外部 constants.ts
 * - 通过 IConfigRegistry 接口写入，与具体实现解耦
 * - 加载方法按领域分组，便于后续扩展
 *
 * @module core/config/ConstantsLoader
 */

import type { IConfigRegistry } from '../types/config';

// ─── v1.0 默认常量 ────────────────────────────────────────────────

/**
 * 游戏全局配置常量
 *
 * tick 间隔、自动保存间隔、存档键名等。
 */
const GAME_CONSTANTS = {
  /** 游戏主循环 tick 间隔（毫秒） */
  TICK_INTERVAL_MS: 1000,

  /** 自动保存间隔（毫秒） */
  AUTO_SAVE_INTERVAL_MS: 30000,

  /** 建筑最大等级 */
  MAX_BUILDING_LEVEL: 30,

  /** localStorage 存档键名 */
  SAVE_KEY: 'three-kingdoms-save',

  /** 存档版本号，用于存档兼容性检查 */
  SAVE_VERSION: '1.0.0',
} as const;

/**
 * 初始资源配置
 *
 * 新游戏开始时各资源的初始数量。
 */
const INITIAL_RESOURCES = {
  /** 金币 */
  gold: 500,
  /** 粮食 */
  food: 300,
  /** 木材 */
  wood: 200,
  /** 铁矿 */
  iron: 100,
} as const;

/**
 * 建筑初始等级
 *
 * 新游戏开始时各建筑的等级。主城初始为 1，其余为 0（未建造）。
 */
const INITIAL_BUILDING_LEVELS = {
  /** 主城 — 初始等级 1 */
  castle: 1,
  /** 农场 — 初始等级 0 */
  farm: 0,
  /** 伐木场 — 初始等级 0 */
  lumberMill: 0,
  /** 矿场 — 初始等级 0 */
  mine: 0,
  /** 兵营 — 初始等级 0 */
  barracks: 0,
  /** 市场 — 初始等级 0 */
  market: 0,
} as const;

// ─── 配置键名前缀 ─────────────────────────────────────────────────

/**
 * 配置键名约定：
 * - 游戏全局配置：直接使用常量名（如 TICK_INTERVAL_MS）
 * - 资源配置：RESOURCE_<NAME>（如 RESOURCE_GOLD）
 * - 建筑配置：BUILDING_<NAME>_LEVEL（如 BUILDING_CASTLE_LEVEL）
 */
const RESOURCE_KEY_PREFIX = 'RESOURCE_';
const BUILDING_LEVEL_KEY_SUFFIX = '_INITIAL_LEVEL';

// ─── ConstantsLoader 类 ──────────────────────────────────────────

/**
 * 常量加载器
 *
 * 将硬编码的默认配置加载到 ConfigRegistry 中。
 * 按领域分组加载，便于后续扩展和选择性加载。
 *
 * @example
 * ```ts
 * const loader = new ConstantsLoader();
 * const registry = new ConfigRegistry();
 *
 * // 加载全部默认配置
 * loader.loadAll(registry);
 *
 * // 或按领域加载
 * loader.loadGameConfig(registry);
 * loader.loadResourceConfig(registry);
 * loader.loadBuildingConfig(registry);
 * ```
 */
export class ConstantsLoader {
  /**
   * 加载所有默认配置
   *
   * 依次加载游戏全局配置、资源配置和建筑初始等级。
   * 这是 v1.0 的完整加载入口。
   *
   * @param registry - 配置注册表实例
   */
  loadAll(registry: IConfigRegistry): void {
    this.loadGameConfig(registry);
    this.loadResourceConfig(registry);
    this.loadBuildingConfig(registry);
  }

  /**
   * 加载游戏全局配置
   *
   * 包括 tick 间隔、自动保存间隔、建筑最大等级、
   * 存档键名和存档版本号。
   *
   * @param registry - 配置注册表实例
   */
  loadGameConfig(registry: IConfigRegistry): void {
    registry.loadFromConstants({
      TICK_INTERVAL_MS: GAME_CONSTANTS.TICK_INTERVAL_MS,
      AUTO_SAVE_INTERVAL_MS: GAME_CONSTANTS.AUTO_SAVE_INTERVAL_MS,
      MAX_BUILDING_LEVEL: GAME_CONSTANTS.MAX_BUILDING_LEVEL,
      SAVE_KEY: GAME_CONSTANTS.SAVE_KEY,
      SAVE_VERSION: GAME_CONSTANTS.SAVE_VERSION,
    });
  }

  /**
   * 加载资源配置
   *
   * 将各资源的初始数量写入注册表。
   * 键名格式：RESOURCE_<NAME>（大写）。
   *
   * @param registry - 配置注册表实例
   *
   * @example
   * ```ts
   * // 加载后可通过以下方式读取：
   * registry.get<number>('RESOURCE_GOLD'); // 500
   * registry.get<number>('RESOURCE_FOOD'); // 300
   * ```
   */
  loadResourceConfig(registry: IConfigRegistry): void {
    const entries: Record<string, unknown> = {};

    for (const [name, amount] of Object.entries(INITIAL_RESOURCES)) {
      const key = `${RESOURCE_KEY_PREFIX}${name.toUpperCase()}`;
      entries[key] = amount;
    }

    // 额外存储完整的资源配置对象，便于批量读取
    entries['INITIAL_RESOURCES'] = { ...INITIAL_RESOURCES };

    registry.loadFromConstants(entries);
  }

  /**
   * 加载建筑初始等级配置
   *
   * 将各建筑的初始等级写入注册表。
   * 键名格式：BUILDING_<NAME>_INITIAL_LEVEL。
   *
   * @param registry - 配置注册表实例
   *
   * @example
   * ```ts
   * // 加载后可通过以下方式读取：
   * registry.get<number>('BUILDING_CASTLE_INITIAL_LEVEL'); // 1
   * registry.get<number>('BUILDING_FARM_INITIAL_LEVEL');   // 0
   * ```
   */
  loadBuildingConfig(registry: IConfigRegistry): void {
    const entries: Record<string, unknown> = {};

    for (const [name, level] of Object.entries(INITIAL_BUILDING_LEVELS)) {
      const key = `BUILDING_${name.toUpperCase()}${BUILDING_LEVEL_KEY_SUFFIX}`;
      entries[key] = level;
    }

    // 额外存储完整的建筑配置对象，便于批量读取
    entries['INITIAL_BUILDING_LEVELS'] = { ...INITIAL_BUILDING_LEVELS };

    registry.loadFromConstants(entries);
  }

  // ─── 静态访问器 ────────────────────────────────────────────────

  /**
   * 获取游戏全局常量的只读引用
   *
   * 用于在不通过注册表的场景下直接访问常量值。
   * 返回的是常量对象的浅拷贝，防止意外修改。
   *
   * @returns 游戏全局常量副本
   */
  static getGameConstants(): Readonly<typeof GAME_CONSTANTS> {
    return { ...GAME_CONSTANTS };
  }

  /**
   * 获取初始资源配置的只读引用
   *
   * @returns 初始资源配置副本
   */
  static getInitialResources(): Readonly<typeof INITIAL_RESOURCES> {
    return { ...INITIAL_RESOURCES };
  }

  /**
   * 获取建筑初始等级的只读引用
   *
   * @returns 建筑初始等级副本
   */
  static getInitialBuildingLevels(): Readonly<typeof INITIAL_BUILDING_LEVELS> {
    return { ...INITIAL_BUILDING_LEVELS };
  }
}
