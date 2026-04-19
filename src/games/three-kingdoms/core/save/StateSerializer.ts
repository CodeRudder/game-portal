/**
 * 状态序列化器
 *
 * 负责游戏状态的序列化/反序列化，包括：
 * - 版本号嵌入
 * - 数据完整性校验
 * - 版本迁移支持
 *
 * 设计原则：
 * - 序列化结果为 JSON 字符串，适配 localStorage
 * - 反序列化时自动校验数据结构完整性
 * - 版本不匹配时触发迁移链
 * - 所有操作无副作用，纯函数式
 *
 * @module core/save/StateSerializer
 */

import type { IGameState } from '../types/state';

// ─────────────────────────────────────────────
// 序列化格式
// ─────────────────────────────────────────────

/**
 * 序列化后的存档数据格式
 *
 * 包含版本号、校验和和序列化后的状态数据。
 */
interface SerializedData {
  /** 存档格式版本 */
  v: string;
  /** 数据校验和（简易 CRC） */
  checksum: number;
  /** 序列化后的游戏状态（JSON 字符串） */
  data: string;
}

// ─────────────────────────────────────────────
// 版本迁移器
// ─────────────────────────────────────────────

/**
 * 版本迁移函数签名
 *
 * 接收旧版本状态，返回迁移后的新版本状态。
 */
type MigrationFn = (state: Record<string, unknown>) => Record<string, unknown>;

/**
 * 版本迁移注册表
 *
 * key: 旧版本号 → value: 迁移到下一版本的函数。
 * 迁移链会按版本顺序依次执行。
 */
type MigrationRegistry = Map<string, MigrationFn>;

// ─────────────────────────────────────────────
// 序列化错误
// ─────────────────────────────────────────────

/**
 * 序列化错误
 *
 * 当序列化/反序列化/校验失败时抛出。
 */
export class SerializationError extends Error {
  constructor(message: string) {
    super(`[SerializationError] ${message}`);
    this.name = 'SerializationError';
  }
}

// ─────────────────────────────────────────────
// 状态序列化器
// ─────────────────────────────────────────────

/**
 * 状态序列化器
 *
 * 提供游戏状态的序列化、反序列化和校验能力。
 * 支持版本迁移，确保旧版本存档可以正确加载到新版本。
 *
 * @example
 * ```ts
 * const serializer = new StateSerializer('1.0.0');
 *
 * // 注册版本迁移
 * serializer.registerMigration('0.9.0', (state) => {
 *   state.metadata.migrationVersion = '1.0.0';
 *   return state;
 * });
 *
 * // 序列化
 * const json = serializer.serialize(gameState);
 *
 * // 反序列化（自动迁移 + 校验）
 * const state = serializer.deserialize(json);
 * ```
 */
export class StateSerializer {
  /** 当前存档版本号 */
  private readonly currentVersion: string;

  /** 版本迁移注册表 */
  private readonly migrations: MigrationRegistry = new Map();

  // ─── 构造函数 ──────────────────────────────────────────────────

  /**
   * @param currentVersion - 当前存档格式版本号（如 '1.0.0'）
   */
  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
  }

  // ─── 序列化/反序列化 ──────────────────────────────────────────

  /**
   * 序列化游戏状态
   *
   * 将 IGameState 转换为 JSON 字符串，嵌入版本号和校验和。
   *
   * @param state - 游戏状态
   * @returns JSON 字符串
   */
  serialize(state: IGameState): string {
    // 确保版本号正确
    const stateWithVersion: IGameState = {
      ...state,
      version: this.currentVersion,
      timestamp: Date.now(),
    };

    const dataStr = JSON.stringify(stateWithVersion);
    const checksum = this.computeChecksum(dataStr);

    const serialized: SerializedData = {
      v: this.currentVersion,
      checksum,
      data: dataStr,
    };

    return JSON.stringify(serialized);
  }

  /**
   * 反序列化游戏状态
   *
   * 从 JSON 字符串恢复 IGameState，包括：
   * 1. 解析外层结构
   * 2. 校验数据完整性（checksum）
   * 3. 版本迁移（如需要）
   * 4. 校验最终数据结构
   *
   * @param json - 序列化后的 JSON 字符串
   * @returns 游戏状态
   * @throws {SerializationError} 数据格式错误、校验失败或迁移失败时
   */
  deserialize(json: string): IGameState {
    // 1. 解析外层结构
    let serialized: SerializedData;
    try {
      serialized = JSON.parse(json) as SerializedData;
    } catch {
      throw new SerializationError('Invalid JSON format');
    }

    // 2. 校验数据完整性
    this.validateSerializedData(serialized);

    // 3. 解析内部状态
    let state: Record<string, unknown>;
    try {
      state = JSON.parse(serialized.data) as Record<string, unknown>;
    } catch {
      throw new SerializationError('Invalid inner state JSON');
    }

    // 4. 版本迁移
    const savedVersion = serialized.v;
    if (savedVersion !== this.currentVersion) {
      state = this.migrate(state, savedVersion);
    }

    // 5. 校验最终数据结构
    this.validateGameState(state);

    return state as unknown as IGameState;
  }

  // ─── 版本迁移 ──────────────────────────────────────────────────

  /**
   * 注册版本迁移函数
   *
   * 注册从 fromVersion 到下一版本的迁移逻辑。
   * 迁移链按版本注册顺序执行。
   *
   * @param fromVersion - 源版本号
   * @param migration - 迁移函数
   */
  registerMigration(fromVersion: string, migration: MigrationFn): void {
    this.migrations.set(fromVersion, migration);
  }

  /**
   * 获取当前版本号
   */
  getVersion(): string {
    return this.currentVersion;
  }

  // ─── 校验方法 ──────────────────────────────────────────────────

  /**
   * 校验游戏状态结构
   *
   * 检查 IGameState 必需字段是否存在且类型正确。
   *
   * @param state - 待校验的状态对象
   * @throws {SerializationError} 校验失败时
   */
  validateGameState(state: Record<string, unknown>): void {
    if (typeof state.version !== 'string') {
      throw new SerializationError('Missing or invalid "version" field');
    }
    if (typeof state.timestamp !== 'number') {
      throw new SerializationError('Missing or invalid "timestamp" field');
    }
    if (typeof state.subsystems !== 'object' || state.subsystems === null) {
      throw new SerializationError('Missing or invalid "subsystems" field');
    }
    if (typeof state.metadata !== 'object' || state.metadata === null) {
      throw new SerializationError('Missing or invalid "metadata" field');
    }

    const metadata = state.metadata as Record<string, unknown>;
    if (typeof metadata.totalPlayTime !== 'number') {
      throw new SerializationError('Missing or invalid "metadata.totalPlayTime"');
    }
    if (typeof metadata.saveCount !== 'number') {
      throw new SerializationError('Missing or invalid "metadata.saveCount"');
    }
    if (typeof metadata.lastVersion !== 'string') {
      throw new SerializationError('Missing or invalid "metadata.lastVersion"');
    }
  }

  // ─── 内部方法 ──────────────────────────────────────────────────

  /**
   * 校验序列化数据完整性
   *
   * 检查 SerializedData 结构和 checksum。
   */
  private validateSerializedData(data: SerializedData): void {
    if (typeof data.v !== 'string') {
      throw new SerializationError('Missing version field in serialized data');
    }
    if (typeof data.checksum !== 'number') {
      throw new SerializationError('Missing checksum field in serialized data');
    }
    if (typeof data.data !== 'string') {
      throw new SerializationError('Missing data field in serialized data');
    }

    // 校验 checksum
    const expectedChecksum = this.computeChecksum(data.data);
    if (data.checksum !== expectedChecksum) {
      throw new SerializationError(
        `Checksum mismatch: expected ${expectedChecksum}, got ${data.checksum}`,
      );
    }
  }

  /**
   * 执行版本迁移链
   *
   * 从 savedVersion 开始，依次执行迁移函数直到当前版本。
   * 如果没有注册迁移函数，直接返回原始状态。
   */
  private migrate(state: Record<string, unknown>, fromVersion: string): Record<string, unknown> {
    let current = { ...state };
    let version = fromVersion;
    const maxSteps = 20; // 防止无限循环

    for (let i = 0; i < maxSteps; i++) {
      const migration = this.migrations.get(version);
      if (!migration) break;

      try {
        current = migration(current);
        // 迁移函数应更新版本号
        version = (current.version as string) ?? version;
      } catch (err) {
        throw new SerializationError(
          `Migration from "${version}" failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return current;
  }

  /**
   * 计算简易校验和
   *
   * 基于 DJB2 哈希算法，用于检测数据损坏。
   * 注意：这不是加密哈希，仅用于完整性校验。
   */
  private computeChecksum(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return hash >>> 0; // 转为无符号整数
  }
}
