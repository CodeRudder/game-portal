/**
 * 核心层 — 驻防系统类型定义
 *
 * 定义武将驻防领土的所有核心类型，供 Engine 层和 UI 层使用。
 * 零 engine/ 依赖，所有类型在本文件中定义。
 *
 * @module core/map/garrison.types
 */

import type { TerritoryProduction } from './territory.types';

// ─────────────────────────────────────────────
// 1. 驻防数据
// ─────────────────────────────────────────────

/**
 * 驻防记录
 *
 * 记录武将在领土上的驻防信息。
 * 每个己方领土最多派遣1名武将驻防。
 */
export interface GarrisonAssignment {
  /** 领土ID */
  territoryId: string;
  /** 驻防武将ID */
  generalId: string;
  /** 驻防开始时间戳（毫秒） */
  assignedAt: number;
}

/**
 * 驻防加成结果
 *
 * 武将驻防后对领土的防御和产出加成。
 */
export interface GarrisonBonus {
  /** 防御加成百分比（如 0.15 表示 +15%） */
  defenseBonus: number;
  /** 产出加成 */
  productionBonus: TerritoryProduction;
}

// ─────────────────────────────────────────────
// 2. 驻防操作结果
// ─────────────────────────────────────────────

/** 驻防操作错误码 */
export type GarrisonErrorCode =
  | 'TERRITORY_NOT_FOUND'
  | 'TERRITORY_NOT_OWNED'
  | 'GENERAL_NOT_FOUND'
  | 'GENERAL_ALREADY_GARRISONED'
  | 'GENERAL_IN_FORMATION'
  | 'TERRITORY_ALREADY_GARRISONED';

/** 驻防操作结果 */
export interface GarrisonResult {
  /** 是否成功 */
  success: boolean;
  /** 错误码（失败时） */
  errorCode?: GarrisonErrorCode;
  /** 错误信息（失败时） */
  errorMessage?: string;
  /** 驻防记录（成功时） */
  assignment?: GarrisonAssignment;
  /** 驻防加成（成功时） */
  bonus?: GarrisonBonus;
}

/** 撤防操作结果 */
export interface UngarrisonResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  errorMessage?: string;
  /** 撤回的领土ID */
  territoryId: string;
  /** 撤回的武将ID */
  generalId?: string;
}

// ─────────────────────────────────────────────
// 3. 驻防系统状态
// ─────────────────────────────────────────────

/** 驻防系统运行时状态 */
export interface GarrisonState {
  /** 所有驻防记录（territoryId → GarrisonAssignment） */
  assignments: Record<string, GarrisonAssignment>;
  /** 驻防总数 */
  totalGarrisons: number;
}

/** 驻防系统存档数据 */
export interface GarrisonSaveData {
  /** 驻防记录列表 */
  assignments: GarrisonAssignment[];
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 4. 驻防配置常量
// ─────────────────────────────────────────────

/**
 * 品质→产出加成百分比
 *
 * 不同品质的武将提供不同的产出加成：
 * - COMMON: +5%
 * - FINE: +10%
 * - RARE: +15%
 * - EPIC: +20%
 * - LEGENDARY: +30%
 */
export const QUALITY_PRODUCTION_BONUS: Record<string, number> = {
  COMMON: 0.05,
  FINE: 0.10,
  RARE: 0.15,
  EPIC: 0.20,
  LEGENDARY: 0.30,
} as const;

/**
 * 防御加成基础系数
 *
 * 防御加成 = 武将defense属性 × DEFENSE_BONUS_FACTOR
 */
export const DEFENSE_BONUS_FACTOR = 0.003;

/** 驻防存档版本 */
export const GARRISON_SAVE_VERSION = 1;
