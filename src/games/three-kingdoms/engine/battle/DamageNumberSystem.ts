/**
 * 战斗系统 — 伤害数字动画系统
 *
 * 职责：
 * - 管理伤害/治疗/暴击数字的生成与生命周期
 * - 数字飘出轨迹配置
 * - 批量伤害数字合并
 * - 纯逻辑层，不涉及实际渲染
 *
 * 类型与配置定义拆分至 DamageNumberConfig.ts
 *
 * @module engine/battle/DamageNumberSystem
 */

import {
  DamageNumberType,
  TrajectoryType,
  DEFAULT_TRAJECTORIES,
  DAMAGE_NUMBER_COLORS,
  DEFAULT_CONFIG,
} from './DamageNumberConfig';
import type {
  TrajectoryConfig,
  DamageNumber,
  DamageNumberConfig,
} from './DamageNumberConfig';

// Re-export for backward compatibility
export { DamageNumberType, TrajectoryType } from './DamageNumberConfig';
export type { TrajectoryConfig, DamageNumber, MergedDamageNumber, DamageNumberConfig } from './DamageNumberConfig';

// ─────────────────────────────────────────────
// DamageNumberSystem
// ─────────────────────────────────────────────

/**
 * 伤害数字动画系统
 *
 * 管理战斗中所有飘字数字的生成、合并和生命周期。
 * 纯逻辑层，输出数据供渲染层使用。
 */
export class DamageNumberSystem {
  /** 配置 */
  private config: DamageNumberConfig;

  /** 活跃的伤害数字列表 */
  private activeNumbers: DamageNumber[];

  /** ID 计数器 */
  private idCounter: number;

  /** 已解析的轨迹配置（合并默认值和覆盖值） */
  private resolvedTrajectories: Record<DamageNumberType, TrajectoryConfig>;

  /** 已解析的颜色配置 */
  private resolvedColors: Record<DamageNumberType, string>;

  constructor(config: Partial<DamageNumberConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.activeNumbers = [];
    this.idCounter = 0;
    this.resolvedTrajectories = this.resolveTrajectories();
    this.resolvedColors = this.resolveColors();
  }

  // ─────────────────────────────────────────
  // 数字生成
  // ─────────────────────────────────────────

  /**
   * 创建一个伤害数字
   *
   * @param type - 数字类型
   * @param value - 数值
   * @param targetUnitId - 目标单位 ID
   * @param timestamp - 创建时间戳
   * @returns 生成的伤害数字实例
   */
  createDamageNumber(
    type: DamageNumberType,
    value: number,
    targetUnitId: string,
    timestamp: number = Date.now(),
  ): DamageNumber {
    const id = `dmg_${++this.idCounter}`;
    const text = this.formatText(type, value);
    const trajectory = this.resolvedTrajectories[type];
    const color = this.resolvedColors[type];

    // 添加随机偏移避免重叠
    const randomizedTrajectory: TrajectoryConfig = {
      ...trajectory,
      offsetX: trajectory.offsetX + (Math.random() - 0.5) * 20,
      offsetY: trajectory.offsetY + (Math.random() - 0.5) * 10,
    };

    const number: DamageNumber = {
      id,
      type,
      value,
      text,
      targetUnitId,
      trajectory: randomizedTrajectory,
      createdAt: timestamp,
      color,
      merged: false,
      mergedFrom: [],
    };

    // 尝试合并
    if (this.config.enableMerge) {
      const merged = this.tryMerge(number);
      if (!merged) {
        this.addNumber(number);
      }
    } else {
      this.addNumber(number);
    }

    return number;
  }

  /**
   * 批量创建伤害数字（用于 AOE 技能）
   *
   * @param type - 数字类型
   * @param entries - 目标和数值列表
   * @param timestamp - 创建时间戳
   * @returns 生成的伤害数字列表
   */
  createBatchDamageNumbers(
    type: DamageNumberType,
    entries: Array<{ targetUnitId: string; value: number }>,
    timestamp: number = Date.now(),
  ): DamageNumber[] {
    return entries.map((entry) =>
      this.createDamageNumber(type, entry.value, entry.targetUnitId, timestamp),
    );
  }

  // ─────────────────────────────────────────
  // 合并逻辑
  // ─────────────────────────────────────────

  /**
   * 尝试将新数字合并到已有的同类型数字
   *
   * 合并条件：
   * 1. 同一目标单位
   * 2. 同一类型
   * 3. 在合并时间窗口内
   * 4. 已有数字未被合并过
   *
   * @param newNumber - 新数字
   * @returns 是否成功合并
   */
  tryMerge(newNumber: DamageNumber): boolean {
    const windowStart = newNumber.createdAt - this.config.mergeWindowMs;

    for (const existing of this.activeNumbers) {
      if (existing.merged) continue;
      if (existing.targetUnitId !== newNumber.targetUnitId) continue;
      if (existing.type !== newNumber.type) continue;
      if (existing.createdAt < windowStart) continue;

      // 合并：累加值，更新文本
      existing.value += newNumber.value;
      existing.text = this.formatText(existing.type, existing.value);
      existing.mergedFrom.push(newNumber.id);
      newNumber.merged = true;
      return true;
    }

    return false;
  }

  // ─────────────────────────────────────────
  // 生命周期管理
  // ─────────────────────────────────────────

  /**
   * 更新系统，移除过期的数字
   *
   * @param currentTime - 当前时间戳
   */
  update(currentTime: number): void {
    const maxLifetime = 2000; // 最长存活 2 秒
    this.activeNumbers = this.activeNumbers.filter(
      (num) => !num.merged && (currentTime - num.createdAt) < maxLifetime,
    );

    // 超过最大数量时移除最旧的
    while (this.activeNumbers.length > this.config.maxActiveNumbers) {
      this.activeNumbers.shift();
    }
  }

  /** 获取所有活跃数字 */
  getActiveNumbers(): DamageNumber[] {
    return this.activeNumbers.filter((n) => !n.merged);
  }

  /** 获取活跃数字数量 */
  getActiveCount(): number {
    return this.activeNumbers.filter((n) => !n.merged).length;
  }

  /** 清除所有数字 */
  clear(): void {
    this.activeNumbers = [];
  }

  // ─────────────────────────────────────────
  // 配置
  // ─────────────────────────────────────────

  /** 更新配置 */
  updateConfig(updates: Partial<DamageNumberConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.trajectoryOverrides) {
      this.resolvedTrajectories = this.resolveTrajectories();
    }
    if (updates.colorOverrides) {
      this.resolvedColors = this.resolveColors();
    }
  }

  /** 获取当前配置 */
  getConfig(): Readonly<DamageNumberConfig> {
    return this.config;
  }

  /** 获取指定类型的轨迹配置 */
  getTrajectory(type: DamageNumberType): TrajectoryConfig {
    return this.resolvedTrajectories[type];
  }

  /** 获取指定类型的颜色 */
  getColor(type: DamageNumberType): string {
    return this.resolvedColors[type];
  }

  // ─────────────────────────────────────────
  // 便捷方法
  // ─────────────────────────────────────────

  /** 创建普通伤害数字 */
  spawnDamage(value: number, targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.NORMAL, value, targetUnitId, timestamp);
  }

  /** 创建暴击伤害数字 */
  spawnCritical(value: number, targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.CRITICAL, value, targetUnitId, timestamp);
  }

  /** 创建治疗数字 */
  spawnHeal(value: number, targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.HEAL, value, targetUnitId, timestamp);
  }

  /** 创建护盾吸收数字 */
  spawnShield(value: number, targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.SHIELD, value, targetUnitId, timestamp);
  }

  /** 创建 DOT 数字 */
  spawnDOT(value: number, targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.DOT, value, targetUnitId, timestamp);
  }

  /** 创建闪避数字 */
  spawnDodge(targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.DODGE, 0, targetUnitId, timestamp);
  }

  /** 创建免疫数字 */
  spawnImmune(targetUnitId: string, timestamp?: number): DamageNumber {
    return this.createDamageNumber(DamageNumberType.IMMUNE, 0, targetUnitId, timestamp);
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 格式化数字文本 */
  private formatText(type: DamageNumberType, value: number): string {
    switch (type) {
      case DamageNumberType.NORMAL:
      case DamageNumberType.CRITICAL:
      case DamageNumberType.DOT:
        return `-${value}`;
      case DamageNumberType.HEAL:
        return `+${value}`;
      case DamageNumberType.SHIELD:
        return `🛡${value}`;
      case DamageNumberType.DODGE:
        return '闪避';
      case DamageNumberType.IMMUNE:
        return '免疫';
      default:
        return `${value}`;
    }
  }

  /** 添加数字到活跃列表 */
  private addNumber(number: DamageNumber): void {
    this.activeNumbers.push(number);

    // 超过最大数量时移除最旧的
    while (this.activeNumbers.length > this.config.maxActiveNumbers) {
      this.activeNumbers.shift();
    }
  }

  /** 解析轨迹配置（合并默认值和覆盖值） */
  private resolveTrajectories(): Record<DamageNumberType, TrajectoryConfig> {
    const result = { ...DEFAULT_TRAJECTORIES };
    for (const [type, override] of Object.entries(this.config.trajectoryOverrides)) {
      if (override && result[type as DamageNumberType]) {
        result[type as DamageNumberType] = {
          ...result[type as DamageNumberType],
          ...override,
        };
      }
    }
    return result;
  }

  /** 解析颜色配置 */
  private resolveColors(): Record<DamageNumberType, string> {
    return {
      ...DAMAGE_NUMBER_COLORS,
      ...this.config.colorOverrides,
    };
  }
}
