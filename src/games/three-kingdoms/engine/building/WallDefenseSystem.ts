/**
 * 建筑域 — 城墙防御系统
 *
 * 职责：管理城墙等级对应的城防值、守城防御加成、守城属性Buff
 * 数据来源：building-config.ts 中的 WALL_LEVEL_TABLE
 *
 * @module engine/building/WallDefenseSystem
 */

import { BUILDING_DEFS } from './building-config';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 守城属性Buff */
export interface GarrisonBuff {
  /** 攻击加成百分比（wallLevel × 1%） */
  attackBonus: number;
  /** 防御加成百分比（wallLevel × 2%） */
  defenseBonus: number;
}

/** 城墙防御系统序列化数据 */
export interface WallDefenseSaveData {
  /** 城墙等级 */
  wallLevel: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 守城攻击加成系数：每级 1% */
const GARRISON_ATTACK_PER_LEVEL = 0.01;

/** 守城防御加成系数：每级 2% */
const GARRISON_DEFENSE_PER_LEVEL = 0.02;

/** 城墙建筑类型键 */
const WALL_BUILDING_TYPE = 'wall';

// ─────────────────────────────────────────────
// 城墙防御系统类
// ─────────────────────────────────────────────

/**
 * 城墙防御系统
 *
 * 负责根据城墙等级计算：
 * - 城防值（从 WALL_LEVEL_TABLE 的 specialValue 读取）
 * - 守城防御加成百分比（从 WALL_LEVEL_TABLE 的 production 读取）
 * - 守城属性Buff（攻击/防御，按等级线性计算）
 */
export class WallDefenseSystem {
  private wallLevel: number = 0;

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化城墙防御系统
   * @param wallLevel 当前城墙等级
   */
  init(wallLevel: number): void {
    this.wallLevel = Math.max(0, Math.floor(wallLevel));
  }

  // ─────────────────────────────────────────
  // 数值查询
  // ─────────────────────────────────────────

  /**
   * 获取城防值
   * 从 WALL_LEVEL_TABLE 的 specialValue 读取
   * 等级为 0 时返回 0
   */
  getDefenseValue(): number {
    if (this.wallLevel <= 0) return 0;
    const wallDef = BUILDING_DEFS[WALL_BUILDING_TYPE];
    const levelTable = wallDef.levelTable;
    const index = this.wallLevel - 1;
    if (index < 0 || index >= levelTable.length) return 0;
    return levelTable[index].specialValue ?? 0;
  }

  /**
   * 获取守城防御加成百分比
   * 从 WALL_LEVEL_TABLE 的 production 读取（即防御加成百分比）
   * 返回值如 12 表示 12%
   */
  getDefenseBonus(): number {
    if (this.wallLevel <= 0) return 0;
    const wallDef = BUILDING_DEFS[WALL_BUILDING_TYPE];
    const levelTable = wallDef.levelTable;
    const index = this.wallLevel - 1;
    if (index < 0 || index >= levelTable.length) return 0;
    return levelTable[index].production;
  }

  /**
   * 获取守城属性Buff
   * attackBonus = wallLevel × 1%
   * defenseBonus = wallLevel × 2%
   */
  getGarrisonBuff(): GarrisonBuff {
    return {
      attackBonus: this.wallLevel * GARRISON_ATTACK_PER_LEVEL,
      defenseBonus: this.wallLevel * GARRISON_DEFENSE_PER_LEVEL,
    };
  }

  /**
   * 获取当前城墙等级
   */
  getWallLevel(): number {
    return this.wallLevel;
  }

  // ─────────────────────────────────────────
  // 升级操作
  // ─────────────────────────────────────────

  /**
   * 升级城墙
   * 更新内部等级，后续查询将使用新等级计算
   * @param newLevel 新的城墙等级
   */
  upgradeWall(newLevel: number): void {
    if (newLevel < this.wallLevel) {
      return; // 不允许降级
    }
    const wallDef = BUILDING_DEFS[WALL_BUILDING_TYPE];
    const maxLevel = wallDef.maxLevel;
    this.wallLevel = Math.min(Math.floor(newLevel), maxLevel);
  }

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  /**
   * 序列化为可存储的数据
   */
  serialize(): WallDefenseSaveData {
    return {
      wallLevel: this.wallLevel,
    };
  }

  /**
   * 从序列化数据恢复
   * @param data 序列化数据
   */
  deserialize(data: WallDefenseSaveData): void {
    this.wallLevel = data.wallLevel ?? 0;
  }

  /**
   * 重置为初始状态
   */
  reset(): void {
    this.wallLevel = 0;
  }
}
