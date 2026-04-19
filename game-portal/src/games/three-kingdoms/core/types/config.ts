/**
 * 核心接口 — 配置注册表
 *
 * 提供运行时配置的统一读写接口。
 * 子系统通过 IConfigRegistry 读取配置，而非直接 import 常量文件，
 * 支持配置热更新和运行时覆盖。
 *
 * @module core/types/config
 */

/**
 * 配置注册表接口
 *
 * 集中管理游戏运行时配置，支持从常量文件批量加载、
 * 按键读写、以及配置项的存在性检查。
 *
 * @example
 * ```ts
 * // 加载常量配置
 * config.loadFromConstants({ BUILDING_UPGRADE_BASE_COST: 100, MAX_LEVEL: 50 });
 *
 * // 读取配置
 * const baseCost = config.get<number>('BUILDING_UPGRADE_BASE_COST');
 *
 * // 运行时覆盖（如测试、调试）
 * config.set('BUILDING_UPGRADE_BASE_COST', 50);
 * ```
 */
export interface IConfigRegistry {
  /**
   * 获取配置值
   *
   * 按键读取配置，支持泛型以获得类型推断。
   * 如果键不存在，行为由实现决定（可返回 undefined 或抛出异常）。
   *
   * @template T - 配置值类型
   * @param key - 配置键名
   * @returns 配置值
   */
  get<T = unknown>(key: string): T;

  /**
   * 设置配置值
   *
   * 写入或覆盖指定键的配置值。
   * 设置后可通过事件总线通知相关子系统（由实现决定）。
   *
   * @param key - 配置键名
   * @param value - 配置值
   */
  set(key: string, value: unknown): void;

  /**
   * 检查配置项是否存在
   *
   * @param key - 配置键名
   * @returns 键是否存在
   */
  has(key: string): boolean;

  /**
   * 删除配置项
   *
   * 移除指定键的配置值。
   *
   * @param key - 配置键名
   */
  delete(key: string): void;

  /**
   * 从常量对象批量加载配置
   *
   * 将常量文件（如 constants.ts）中的键值对批量导入注册表。
   * 已存在的键会被覆盖。
   *
   * @param data - 键值对形式的配置数据
   *
   * @example
   * ```ts
   * import * as constants from '../config/constants';
   * config.loadFromConstants(constants);
   * ```
   */
  loadFromConstants(data: Record<string, unknown>): void;

  /**
   * 获取所有配置项
   *
   * 返回当前注册表中所有配置的浅拷贝快照。
   * 用于调试、序列化或状态导出。
   *
   * @returns 配置键值对的副本
   */
  getAll(): Record<string, unknown>;
}
