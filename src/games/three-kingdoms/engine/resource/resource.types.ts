/**
 * 资源域 — 类型定义
 *
 * 规则：只有 interface/type，零逻辑
 *
 * 基础类型（ResourceType, Resources, ProductionRate, ResourceCap,
 * CapWarningLevel, CapWarning, OfflineEarnings, ResourceSaveData）
 * 定义在 shared/types.ts，本文件通过 re-export 保持向后兼容。
 */

// ─────────────────────────────────────────────
// 0. 从 shared 层 re-export 基础类型
// ─────────────────────────────────────────────
export type {
  ResourceType,
  Resources,
  ProductionRate,
  ResourceCap,
  CapWarningLevel,
  CapWarning,
  OfflineEarnings,
  OfflineTierBreakdown,
  ResourceSaveData,
} from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 资源枚举 & 常量（引擎域专属）
// ─────────────────────────────────────────────

import type { ResourceType } from '../../shared/types';

/** 所有资源类型的只读数组，便于遍历 */
export const RESOURCE_TYPES: readonly ResourceType[] = [
  'grain',
  'gold',
  'troops',
  'mandate',
  'techPoint',
  'recruitToken',
] as const;

/** 资源中文名映射 */
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
  techPoint: '科技点',
  recruitToken: '招贤榜',
};

/** 资源颜色标识（用于 UI 展示） */
export const RESOURCE_COLORS: Record<ResourceType, string> = {
  grain: '#7EC850',
  gold: '#C9A84C',
  troops: '#B8423A',
  mandate: '#7B5EA7',
  techPoint: '#4A90D9',
  recruitToken: '#E8A030',
};

// ─────────────────────────────────────────────
// 2. 资源存储 — 基础类型已移至 shared/types.ts
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 3. 产出配置
// ─────────────────────────────────────────────

/**
 * ProductionSource 接口已删除（v1.0 废弃清理）
 * 产出计算已统一使用 building-config 的 levelTable 数据源，
 * 不再使用 baseRate + levelFactor 的线性公式。
 */

/** 加成类型 */
export type BonusType = 'tech' | 'castle' | 'hero' | 'rebirth' | 'vip';

/** 单项加成 */
export interface Bonus {
  type: BonusType;
  /** 加成百分比，如 0.15 表示 +15% */
  value: number;
}

/** 加成集合（按类型分组，同类取最高） */
export type Bonuses = Partial<Record<BonusType, number>>;

// ─────────────────────────────────────────────
// 4. 消耗
// ─────────────────────────────────────────────

/** 资源消耗项 */
export interface ResourceCost {
  grain?: number;
  gold?: number;
  troops?: number;
  mandate?: number;
  techPoint?: number;
  recruitToken?: number;
}

/** 消耗检查结果 */
export interface CostCheckResult {
  /** 是否足够 */
  canAfford: boolean;
  /** 不足的资源列表 */
  shortages: Partial<Record<ResourceType, { required: number; current: number }>>;
}

// ─────────────────────────────────────────────
// 5. 容量警告 — CapWarningLevel, CapWarning 已移至 shared/types.ts
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 6. 离线收益 — OfflineEarnings, OfflineTierBreakdown 已移至 shared/types.ts
// ─────────────────────────────────────────────

/** 离线收益时段配置（引擎域配置类型） */
export interface OfflineTier {
  /** 时段起始秒数 */
  startSeconds: number;
  /** 时段结束秒数（Infinity 表示无上限） */
  endSeconds: number;
  /** 效率系数 0~1 */
  efficiency: number;
}

// ─────────────────────────────────────────────
// 7. 序列化 — ResourceSaveData 已移至 shared/types.ts
// ─────────────────────────────────────────────
