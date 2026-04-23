/**
 * 核心层 — 领土系统类型定义
 *
 * 定义领土管理的所有核心类型，供 Engine 层和 UI 层使用。
 * 零 engine/ 依赖，所有类型在本文件中定义。
 *
 * @module core/map/territory.types
 */

import type { GridPosition, RegionId, OwnershipStatus, LandmarkLevel, ResourceNodeType } from './world-map.types';

// ─────────────────────────────────────────────
// 1. 领土数据
// ─────────────────────────────────────────────

/** 领土产出配置 */
export interface TerritoryProduction {
  /** 粮食产出/秒 */
  grain: number;
  /** 金币产出/秒 */
  gold: number;
  /** 兵力产出/秒 */
  troops: number;
  /** 天命产出/秒 */
  mandate: number;
}

/** 领土数据 */
export interface TerritoryData {
  /** 领土唯一ID（与地标ID对应） */
  id: string;
  /** 领土名称 */
  name: string;
  /** 领土中心坐标 */
  position: GridPosition;
  /** 所属区域 */
  region: RegionId;
  /** 归属状态 */
  ownership: OwnershipStatus;
  /** 领土等级（1~5） */
  level: LandmarkLevel;
  /** 基础产出 */
  baseProduction: TerritoryProduction;
  /** 当前实际产出（含等级加成） */
  currentProduction: TerritoryProduction;
  /** 防御值 */
  defenseValue: number;
  /** 相邻领土ID列表 */
  adjacentIds: string[];
}

// ─────────────────────────────────────────────
// 2. 领土升级
// ─────────────────────────────────────────────

/** 领土升级消耗 */
export interface TerritoryUpgradeCost {
  /** 消耗粮食 */
  grain: number;
  /** 消耗金币 */
  gold: number;
}

/** 领土升级结果 */
export interface TerritoryUpgradeResult {
  /** 是否成功 */
  success: boolean;
  /** 升级前等级 */
  previousLevel: LandmarkLevel;
  /** 升级后等级 */
  newLevel: LandmarkLevel;
  /** 消耗资源 */
  cost: TerritoryUpgradeCost;
  /** 新产出 */
  newProduction: TerritoryProduction;
}

// ─────────────────────────────────────────────
// 3. 领土产出汇总
// ─────────────────────────────────────────────

/** 玩家领土产出汇总 */
export interface TerritoryProductionSummary {
  /** 领土总数 */
  totalTerritories: number;
  /** 各区域领土数量 */
  territoriesByRegion: Record<RegionId, number>;
  /** 总产出/秒 */
  totalProduction: TerritoryProduction;
  /** 总粮食产出（totalProduction.grain 的便捷访问） */
  totalGrain: number;
  /** 总金币产出（totalProduction.gold 的便捷访问） */
  totalCoins: number;
  /** 总兵力产出（totalProduction.troops 的便捷访问） */
  totalTroops: number;
  /** 各领土产出明细 */
  details: Array<{
    id: string;
    name: string;
    region: RegionId;
    level: LandmarkLevel;
    production: TerritoryProduction;
  }>;
}

// ─────────────────────────────────────────────
// 4. 领土系统状态
// ─────────────────────────────────────────────

/** 领土系统运行时状态 */
export interface TerritoryState {
  /** 所有领土数据 */
  territories: TerritoryData[];
  /** 玩家领土ID列表 */
  playerTerritoryIds: string[];
  /** 产出汇总 */
  productionSummary: TerritoryProductionSummary;
}

/** 领土存档数据 */
export interface TerritorySaveData {
  /** 地标归属状态 */
  owners: Record<string, OwnershipStatus>;
  /** 地标等级 */
  levels: Record<string, LandmarkLevel>;
  /** 版本号 */
  version: number;
}
