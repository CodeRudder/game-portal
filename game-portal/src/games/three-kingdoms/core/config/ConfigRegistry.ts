/**
 * 配置注册表实现
 *
 * 集中管理游戏运行时配置，支持从常量文件批量加载、
 * 按键读写、配置校验及安全默认值获取。
 *
 * 设计原则：
 * - 子系统通过 IConfigRegistry 读取配置，而非直接 import 常量文件
 * - 支持配置热更新和运行时覆盖
 * - 所有读取操作均为 O(1)（基于 Map）
 *
 * @module core/config/ConfigRegistry
 */

import type { IConfigRegistry } from '../types/config';

/**
 * 配置错误
 *
 * 当配置键不存在或校验失败时抛出。
 */
export class ConfigError extends Error {
  /** 关联的配置键名 */
  public readonly key: string;

  constructor(key: string, message: string) {
    super(`[ConfigError] key="${key}": ${message}`);
    this.name = 'ConfigError';
    this.key = key;
  }
}

/**
 * 配置注册表
 *
 * 实现 IConfigRegistry 接口，提供运行时配置的统一读写能力。
 *
 * @example
 * ```ts
 * const registry = new ConfigRegistry();
 * registry.loadFromConstants({ TICK_INTERVAL_MS: 1000, MAX_LEVEL: 30 });
 *
 * const tick = registry.get<number>('TICK_INTERVAL_MS'); // 1000
 * const safe = registry.getOrDefault('UNKNOWN_KEY', 42); // 42
 * ```
 */
export class ConfigRegistry implements IConfigRegistry {
  /** 内部存储，键为配置名，值为配置值 */
  private readonly store: Map<string, unknown>;

  constructor() {
    this.store = new Map();
  }

  // ─── IConfigRegistry 核心方法 ──────────────────────────────────

  /**
   * 获取配置值
   *
   * 按键读取配置。如果键不存在，抛出 ConfigError。
   *
   * @template T - 配置值类型
   * @param key - 配置键名
   * @returns 配置值
   * @throws {ConfigError} 键不存在时抛出
   */
  get<T = unknown>(key: string): T {
    if (!this.store.has(key)) {
      throw new ConfigError(key, 'Configuration key does not exist');
    }
    return this.store.get(key) as T;
  }

  /**
   * 设置配置值
   *
   * 写入或覆盖指定键的配置值。
   *
   * @param key - 配置键名
   * @param value - 配置值
   */
  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  /**
   * 检查配置项是否存在
   *
   * @param key - 配置键名
   * @returns 键是否存在
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * 删除配置项
   *
   * 移除指定键的配置值。如果键不存在，静默忽略。
   *
   * @param key - 配置键名
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * 从常量对象批量加载配置
   *
   * 将常量文件中的键值对批量导入注册表。
   * 已存在的键会被覆盖。
   *
   * @param data - 键值对形式的配置数据
   */
  loadFromConstants(data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      this.store.set(key, value);
    }
  }

  /**
   * 获取所有配置项
   *
   * 返回当前注册表中所有配置的浅拷贝快照。
   * 用于调试、序列化或状态导出。
   *
   * @returns 配置键值对的副本
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.store) {
      result[key] = value;
    }
    return result;
  }

  // ─── 扩展方法 ──────────────────────────────────────────────────

  /**
   * 安全获取配置值
   *
   * 如果键不存在，返回默认值而不抛出异常。
   * 适用于可选配置项或需要降级策略的场景。
   *
   * @template T - 配置值类型
   * @param key - 配置键名
   * @param defaultValue - 键不存在时的默认返回值
   * @returns 配置值或默认值
   *
   * @example
   * ```ts
   * const retryCount = registry.getOrDefault('RETRY_COUNT', 3);
   * ```
   */
  getOrDefault<T>(key: string, defaultValue: T): T {
    if (!this.store.has(key)) {
      return defaultValue;
    }
    return this.store.get(key) as T;
  }

  /**
   * 配置校验
   *
   * 使用自定义校验函数对指定配置项进行验证。
   * 键不存在时返回 false。
   *
   * @param key - 配置键名
   * @param validator - 校验函数，接收配置值，返回是否合法
   * @returns 校验是否通过
   *
   * @example
   * ```ts
   * const isValid = registry.validate('TICK_INTERVAL_MS', (v) => typeof v === 'number' && v > 0);
   * ```
   */
  validate(key: string, validator: (value: unknown) => boolean): boolean {
    if (!this.store.has(key)) {
      return false;
    }
    return validator(this.store.get(key));
  }

  /**
   * 清空所有配置
   *
   * 移除注册表中全部配置项。主要用于测试重置场景。
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 获取配置项数量
   *
   * @returns 当前注册的配置项总数
   */
  get size(): number {
    return this.store.size;
  }
}
