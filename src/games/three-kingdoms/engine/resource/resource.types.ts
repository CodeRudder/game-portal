/**
 * 资源域 — 类型定义
 *
 * 规则：只有 interface/type，零逻辑
 */

// ─────────────────────────────────────────────
// 1. 资源枚举 & 基础类型
// ─────────────────────────────────────────────

/** 四种核心资源类型 */
export type ResourceType = 'grain' | 'gold' | 'troops' | 'mandate';

/** 所有资源类型的只读数组，便于遍历 */
export const RESOURCE_TYPES: readonly ResourceType[] = [
  'grain',
  'gold',
  'troops',
  'mandate',
] as const;

/** 资源中文名映射 */
export const RESOURCE_LABELS: Record<ResourceType, string> = {
  grain: '粮草',
  gold: '铜钱',
  troops: '兵力',
  mandate: '天命',
};

/** 资源颜色标识（用于 UI 展示） */
export const RESOURCE_COLORS: Record<ResourceType, string> = {
  grain: '#7EC850',
  gold: '#C9A84C',
  troops: '#B8423A',
  mandate: '#7B5EA7',
};

// ─────────────────────────────────────────────
// 2. 资源存储
// ─────────────────────────────────────────────

/** 资源数量集合 */
export interface Resources {
  grain: number;
  gold: number;
  troops: number;
  mandate: number;
}

/** 资源产出速率（每秒） */
export interface ProductionRate {
  grain: number;
  gold: number;
  troops: number;
  mandate: number;
}

/** 资源上限（null 表示无上限） */
export interface ResourceCap {
  grain: number;
  gold: null; // 铜钱无上限
  troops: number;
  mandate: null; // 天命无上限
}

// ─────────────────────────────────────────────
// 3. 产出配置
// ─────────────────────────────────────────────

/** 单个来源的产出配置 */
export interface ProductionSource {
  /** 来源标识 */
  id: string;
  /** 产出资源类型 */
  resourceType: ResourceType;
  /** 基础产出值（每秒） */
  baseRate: number;
  /** 等级系数（每级增加的产出） */
  levelFactor: number;
  /** 来源描述 */
  description: string;
}

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
}

/** 消耗检查结果 */
export interface CostCheckResult {
  /** 是否足够 */
  canAfford: boolean;
  /** 不足的资源列表 */
  shortages: Partial<Record<ResourceType, { required: number; current: number }>>;
}

// ─────────────────────────────────────────────
// 5. 容量警告
// ─────────────────────────────────────────────

/** 容量警告等级 */
export type CapWarningLevel = 'safe' | 'notice' | 'warning' | 'urgent' | 'full';

/** 容量警告信息 */
export interface CapWarning {
  resourceType: ResourceType;
  level: CapWarningLevel;
  /** 当前值 */
  current: number;
  /** 上限值（null 表示无上限） */
  cap: number | null;
  /** 百分比 0~1 */
  percentage: number;
}

// ─────────────────────────────────────────────
// 6. 离线收益
// ─────────────────────────────────────────────

/** 离线收益时段配置 */
export interface OfflineTier {
  /** 时段起始秒数 */
  startSeconds: number;
  /** 时段结束秒数（Infinity 表示无上限） */
  endSeconds: number;
  /** 效率系数 0~1 */
  efficiency: number;
}

/** 离线收益计算结果 */
export interface OfflineEarnings {
  /** 离线秒数 */
  offlineSeconds: number;
  /** 各资源获得的数量 */
  earned: Resources;
  /** 是否触发封顶（>72h） */
  isCapped: boolean;
  /** 各时段明细（可选，用于展示） */
  tierBreakdown?: OfflineTierBreakdown[];
}

/** 离线收益时段明细 */
export interface OfflineTierBreakdown {
  tier: OfflineTier;
  /** 该时段秒数 */
  seconds: number;
  /** 该时段各资源产出 */
  earned: Resources;
}

// ─────────────────────────────────────────────
// 7. 序列化
// ─────────────────────────────────────────────

/** 资源系统存档数据 */
export interface ResourceSaveData {
  /** 当前资源数量 */
  resources: Resources;
  /** 上次保存时间戳（ms） */
  lastSaveTime: number;
  /** 当前产出速率快照 */
  productionRates: ProductionRate;
  /** 当前上限快照 */
  caps: ResourceCap;
  /** 存档版本 */
  version: number;
}
