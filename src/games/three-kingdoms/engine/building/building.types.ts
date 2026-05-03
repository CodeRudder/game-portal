/**
 * 建筑域 — 类型定义
 *
 * 规则：只有 interface/type，零逻辑
 *
 * 基础类型（BuildingType, BuildingStatus, BuildingState, UpgradeCost,
 * UpgradeCheckResult, BuildingSaveData）定义在 shared/types.ts，
 * 本文件通过 re-export 保持向后兼容。
 */

// ─────────────────────────────────────────────
// 0. 从 shared 层 re-export 基础类型
// ─────────────────────────────────────────────
export type {
  BuildingType,
  BuildingStatus,
  BuildingState,
  UpgradeCost,
  UpgradeCheckResult,
  BuildingSaveData,
} from '../../shared/types';

import type { ResourceType, Resources } from '../../shared/types';
import type { BuildingType, UpgradeCost } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 建筑枚举 & 常量（引擎域专属）
// ─────────────────────────────────────────────

/** 所有建筑类型的只读数组，便于遍历 */
export const BUILDING_TYPES: readonly BuildingType[] = [
  'castle',
  'farmland',
  'market',
  'mine',
  'lumberMill',
  'barracks',
  'workshop',
  'academy',
  'clinic',
  'wall',
  'tavern',
  'port',
] as const;

/** 建筑中文名映射 */
export const BUILDING_LABELS: Record<BuildingType, string> = {
  castle: '主城',
  farmland: '农田',
  market: '市集',
  mine: '矿场',
  lumberMill: '伐木场',
  barracks: '兵营',
  workshop: '工坊',
  academy: '书院',
  clinic: '医馆',
  wall: '城墙',
  tavern: '酒馆',
  port: '市舶司',
};

/** 建筑图标映射 */
export const BUILDING_ICONS: Record<BuildingType, string> = {
  castle: '🏛️',
  farmland: '🌾',
  market: '💰',
  mine: '⛏️',
  lumberMill: '🪓',
  barracks: '⚔️',
  workshop: '⚒️',
  academy: '📚',
  clinic: '🏥',
  wall: '🏯',
  tavern: '🍺',
  port: '🚢',
};

/** 建筑分区 */
export type BuildingZone = 'core' | 'resource' | 'military' | 'cultural' | 'defense';

/** 建筑分区映射 */
export const BUILDING_ZONES: Record<BuildingType, BuildingZone> = {
  castle: 'core',
  farmland: 'resource',
  market: 'resource',
  mine: 'resource',
  lumberMill: 'resource',
  barracks: 'military',
  workshop: 'military',
  academy: 'cultural',
  clinic: 'cultural',
  wall: 'defense',
  tavern: 'core',
  port: 'resource',
};

// ─────────────────────────────────────────────
// 2. 建筑外观演进
// ─────────────────────────────────────────────

/** 建筑外观风格阶段 */
export type AppearanceStage = 'humble' | 'orderly' | 'refined' | 'glorious';

/** 外观风格中文名 */
export const APPEARANCE_LABELS: Record<AppearanceStage, string> = {
  humble: '茅屋/木栅（简朴）',
  orderly: '瓦房/石墙（规整）',
  refined: '楼阁/砖墙（精美）',
  glorious: '宫殿/铜门（辉煌）',
};

/** 根据等级获取外观阶段（逻辑已移至 BuildingSystem.ts） */

// ─────────────────────────────────────────────
// 3. 升级费用 — UpgradeCost 已移至 shared/types.ts
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 4. 建筑产出配置
// ─────────────────────────────────────────────

/** 建筑产出条目 */
export interface BuildingProduction {
  /** 产出的资源类型 */
  resourceType: ResourceType;
  /** 基础产出值（Lv1 时的产出） */
  baseValue: number;
  /** 每级增量 */
  perLevel: number;
}

/** 建筑特殊属性（非资源产出类） */
export interface BuildingSpecialAttribute {
  /** 属性名 */
  name: string;
  /** 基础值 */
  baseValue: number;
  /** 每级增量 */
  perLevel: number;
}

// ─────────────────────────────────────────────
// 5. 建筑定义（静态配置）
// ─────────────────────────────────────────────

/** 单级详细数据（用于精确查表） */
export interface LevelData {
  /** 该等级的产出值（主要产出） */
  production: number;
  /** 升到下一级的费用 */
  upgradeCost: UpgradeCost;
  /** 特殊属性值（可选，如城防值、恢复速率） */
  specialValue?: number;
}

/** 建筑定义（配置层） */
export interface BuildingDef {
  /** 建筑类型 */
  type: BuildingType;
  /** 等级上限 */
  maxLevel: number;
  /** 解锁所需的主城等级（0 = 初始解锁） */
  unlockCastleLevel: number;
  /** 主要产出配置 */
  production?: BuildingProduction;
  /** 特殊属性配置（如主城加成、城防值等） */
  specialAttribute?: BuildingSpecialAttribute;
  /** 等级数据表（精确到每级） */
  levelTable: LevelData[];
}

// ─────────────────────────────────────────────
// 6. 建筑状态（运行时）— BuildingStatus, BuildingState 已移至 shared/types.ts
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 7. 升级前置条件检查 — UpgradeCheckResult 已移至 shared/types.ts
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 8. 建筑队列
// ─────────────────────────────────────────────

/** 队列槽位状态 */
export interface QueueSlot {
  /** 建筑类型 */
  buildingType: BuildingType;
  /** 开始时间戳（ms） */
  startTime: number;
  /** 预计完成时间戳（ms） */
  endTime: number;
  /** 铜钱加速已使用次数（最多3次） */
  copperSpeedUpCount?: number;
}

/** 建筑队列配置 */
export interface QueueConfig {
  /** 主城等级范围起始（含） */
  castleLevelMin: number;
  /** 主城等级范围结束（含） */
  castleLevelMax: number;
  /** 可用槽位数 */
  slots: number;
}

// ─────────────────────────────────────────────
// 9. 序列化 — BuildingSaveData 已移至 shared/types.ts
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 10. 建筑库存系统（Sprint 1 BLD-F26/BLD-F10）
// ─────────────────────────────────────────────

/** 建筑库存状态 */
export interface BuildingStorage {
  /** 建筑类型 */
  buildingType: BuildingType;
  /** 库存中累积的资源量 */
  amount: number;
  /** 库存容量上限 */
  capacity: number;
  /** 是否溢出（产出降速中） */
  isOverflowing: boolean;
}

/** 一键收取结果 */
export interface CollectResult {
  /** 各资源收取总量 */
  collected: Record<string, number>;
  /** 各建筑收取明细 */
  buildingDetails: Array<{
    buildingType: BuildingType;
    resourceType: string;
    amount: number;
  }>;
}
