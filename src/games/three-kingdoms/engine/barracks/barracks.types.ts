/**
 * BarracksFormation - types and constants
 *
 * 兵营编队系统类型定义。
 * 兵营编队与武将编队（HeroFormation）是平行关系：
 * - 武将编队管理武将上阵
 * - 兵营编队管理兵力分配和兵种配置
 *
 * @module engine/barracks/barracks.types
 */

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 编队1默认解锁 */
export const FORMATION_1_UNLOCK_LEVEL = 1;
/** 编队2需要兵营Lv10 */
export const FORMATION_2_UNLOCK_LEVEL = 10;
/** 编队3需要兵营Lv20 */
export const FORMATION_3_UNLOCK_LEVEL = 20;

/** 最大编队数量 */
export const MAX_BARRACKS_FORMATIONS = 3;

/** 默认编队名称 */
export const DEFAULT_FORMATION_NAMES: Record<string, string> = {
  '1': '第一营',
  '2': '第二营',
  '3': '第三营',
};

// ─────────────────────────────────────────────
// 兵种类型
// ─────────────────────────────────────────────

/** 兵种类型 */
export type TroopType = 'infantry' | 'cavalry' | 'archer';

/** 兵种中文名称映射 */
export const TROOP_TYPE_LABELS: Record<TroopType, string> = {
  infantry: '步兵',
  cavalry: '骑兵',
  archer: '弓兵',
};

// ─────────────────────────────────────────────
// 编队数据
// ─────────────────────────────────────────────

/** 兵营编队数据 */
export interface BarracksFormation {
  /** 编队ID（'1' | '2' | '3'） */
  id: string;
  /** 编队名称 */
  name: string;
  /** 主将ID */
  commander: string;
  /** 编队兵力数量 */
  troops: number;
  /** 兵种类型 */
  troopType: TroopType;
  /** 关联武将ID列表 */
  heroes: string[];
}

// ─────────────────────────────────────────────
// 训练模式
// ─────────────────────────────────────────────

/** 训练模式 */
export type TrainingMode = 'normal' | 'accelerated' | 'elite';

/** 训练结果 */
export interface TrainingResult {
  /** 获得的兵力数量 */
  troopsGained: number;
  /** 消耗的资源 */
  resourcesCost: Record<string, number>;
}

// ─────────────────────────────────────────────
// 系统状态 & 存档
// ─────────────────────────────────────────────

/** 兵营编队系统状态 */
export interface BarracksFormationState {
  /** 所有编队 */
  formations: Record<string, BarracksFormation>;
}

/** 兵营编队系统存档数据 */
export interface BarracksFormationSaveData {
  version: number;
  state: BarracksFormationState;
}
