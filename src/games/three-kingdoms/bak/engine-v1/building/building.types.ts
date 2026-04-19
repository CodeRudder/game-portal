/**
 * 建筑域 — 类型定义
 *
 * 规则：只有 interface/type，零逻辑
 */

import type { ResourceType, Resources } from '../resource/resource.types';

// ─────────────────────────────────────────────
// 1. 建筑枚举 & 基础类型
// ─────────────────────────────────────────────

/** 8 种建筑类型标识 */
export type BuildingType =
  | 'castle'    // 🏛️ 主城
  | 'farmland'  // 🌾 农田
  | 'market'    // 💰 市集
  | 'barracks'  // ⚔️ 兵营
  | 'smithy'    // 🔨 铁匠铺
  | 'academy'   // 📚 书院
  | 'clinic'    // 🏥 医馆
  | 'wall';     // 🏯 城墙

/** 所有建筑类型的只读数组，便于遍历 */
export const BUILDING_TYPES: readonly BuildingType[] = [
  'castle',
  'farmland',
  'market',
  'barracks',
  'smithy',
  'academy',
  'clinic',
  'wall',
] as const;

/** 建筑中文名映射 */
export const BUILDING_LABELS: Record<BuildingType, string> = {
  castle: '主城',
  farmland: '农田',
  market: '市集',
  barracks: '兵营',
  smithy: '铁匠铺',
  academy: '书院',
  clinic: '医馆',
  wall: '城墙',
};

/** 建筑图标映射 */
export const BUILDING_ICONS: Record<BuildingType, string> = {
  castle: '🏛️',
  farmland: '🌾',
  market: '💰',
  barracks: '⚔️',
  smithy: '🔨',
  academy: '📚',
  clinic: '🏥',
  wall: '🏯',
};

/** 建筑分区 */
export type BuildingZone = 'core' | 'civilian' | 'military' | 'cultural' | 'defense';

/** 建筑分区映射 */
export const BUILDING_ZONES: Record<BuildingType, BuildingZone> = {
  castle: 'core',
  farmland: 'civilian',
  market: 'civilian',
  barracks: 'military',
  smithy: 'military',
  academy: 'cultural',
  clinic: 'cultural',
  wall: 'defense',
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

/** 根据等级获取外观阶段 */
export function getAppearanceStage(level: number): AppearanceStage {
  if (level <= 5) return 'humble';
  if (level <= 12) return 'orderly';
  if (level <= 20) return 'refined';
  return 'glorious';
}

// ─────────────────────────────────────────────
// 3. 升级费用
// ─────────────────────────────────────────────

/** 单级升级费用 */
export interface UpgradeCost {
  /** 升级所需粮草 */
  grain: number;
  /** 升级所需铜钱 */
  gold: number;
  /** 升级所需兵力（0 表示不需要） */
  troops: number;
  /** 升级所需时间（秒） */
  timeSeconds: number;
}

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
// 6. 建筑状态（运行时）
// ─────────────────────────────────────────────

/** 建筑升级状态 */
export type BuildingStatus = 'locked' | 'idle' | 'upgrading';

/** 单座建筑的运行时状态 */
export interface BuildingState {
  /** 建筑类型 */
  type: BuildingType;
  /** 当前等级 */
  level: number;
  /** 建筑状态 */
  status: BuildingStatus;
  /** 升级开始时间戳（ms），仅 upgrading 时有值 */
  upgradeStartTime: number | null;
  /** 升级预计完成时间戳（ms），仅 upgrading 时有值 */
  upgradeEndTime: number | null;
}

// ─────────────────────────────────────────────
// 7. 升级前置条件检查
// ─────────────────────────────────────────────

/** 升级检查结果 */
export interface UpgradeCheckResult {
  /** 是否可以升级 */
  canUpgrade: boolean;
  /** 失败原因列表 */
  reasons: string[];
}

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
// 9. 序列化
// ─────────────────────────────────────────────

/** 建筑系统存档数据 */
export interface BuildingSaveData {
  /** 各建筑状态 */
  buildings: Record<BuildingType, BuildingState>;
  /** 存档版本 */
  version: number;
}
