/**
 * 基础设施层 — 全局共享类型
 *
 * 跨域通用类型定义，供 Engine 编排层和 UI 层使用
 *
 * 规则：零 engine/ 依赖，所有基础类型在本文件中定义
 */

// ─────────────────────────────────────────────
// 0. 资源域基础类型（与 engine/resource/resource.types.ts 保持同步）
// ─────────────────────────────────────────────

/** 四种核心资源类型 */
export type ResourceType = 'grain' | 'gold' | 'troops' | 'mandate';

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
  gold: null;
  troops: number;
  mandate: null;
}

/** 容量警告等级 */
export type CapWarningLevel = 'safe' | 'notice' | 'warning' | 'urgent' | 'full';

/** 容量警告信息 */
export interface CapWarning {
  resourceType: ResourceType;
  level: CapWarningLevel;
  current: number;
  cap: number | null;
  percentage: number;
}

/** 离线收益时段配置 */
export interface OfflineTier {
  /** 时段起始秒数 */
  startSeconds: number;
  /** 时段结束秒数（Infinity 表示无上限） */
  endSeconds: number;
  /** 效率系数 0~1 */
  efficiency: number;
}

/** 离线收益时段明细 */
export interface OfflineTierBreakdown {
  tier: OfflineTier;
  /** 该时段秒数 */
  seconds: number;
  /** 该时段各资源产出 */
  earned: Resources;
}

/** 离线收益计算结果 */
export interface OfflineEarnings {
  offlineSeconds: number;
  earned: Resources;
  isCapped: boolean;
  /** 各时段明细（可选，用于展示） */
  tierBreakdown?: OfflineTierBreakdown[];
}

/** 资源系统存档数据 */
export interface ResourceSaveData {
  resources: Resources;
  lastSaveTime: number;
  productionRates: ProductionRate;
  caps: ResourceCap;
  version: number;
}

// ─────────────────────────────────────────────
// 0. 建筑域基础类型（与 engine/building/building.types.ts 保持同步）
// ─────────────────────────────────────────────

/** 8 种建筑类型标识 */
export type BuildingType =
  | 'castle'
  | 'farmland'
  | 'market'
  | 'barracks'
  | 'smithy'
  | 'academy'
  | 'clinic'
  | 'wall';

/** 建筑升级状态 */
export type BuildingStatus = 'locked' | 'idle' | 'upgrading';

/** 单座建筑的运行时状态 */
export interface BuildingState {
  type: BuildingType;
  level: number;
  status: BuildingStatus;
  upgradeStartTime: number | null;
  upgradeEndTime: number | null;
}

/** 单级升级费用 */
export interface UpgradeCost {
  grain: number;
  gold: number;
  troops: number;
  timeSeconds: number;
}

/** 升级检查结果 */
export interface UpgradeCheckResult {
  canUpgrade: boolean;
  reasons: string[];
}

/** 建筑系统存档数据 */
export interface BuildingSaveData {
  buildings: Record<BuildingType, BuildingState>;
  version: number;
}

// ─────────────────────────────────────────────
// 1. 事件系统
// ─────────────────────────────────────────────

/** 引擎事件类型枚举 */
export type EngineEventType =
  | 'resource:changed'       // 资源数量变化
  | 'resource:rate-changed'  // 产出速率变化
  | 'resource:cap-warning'   // 容量警告
  | 'building:upgraded'      // 建筑升级完成
  | 'building:upgrade-start' // 建筑开始升级
  | 'building:unlocked'      // 建筑解锁
  | 'game:initialized'       // 游戏初始化完成
  | 'game:loaded'            // 读档完成
  | 'game:saved'             // 存档完成
  | 'game:offline-earnings'; // 离线收益

/** 事件载荷映射 */
export interface EngineEventMap {
  'resource:changed': { resources: Readonly<Resources> };
  'resource:rate-changed': { rates: Readonly<ProductionRate> };
  'resource:cap-warning': { warnings: CapWarning[] };
  'building:upgraded': { type: BuildingType; level: number };
  'building:upgrade-start': { type: BuildingType; cost: UpgradeCost };
  'building:unlocked': { types: BuildingType[] };
  'game:initialized': { isNewGame: boolean };
  'game:loaded': { offlineEarnings?: OfflineEarnings };
  'game:saved': { timestamp: number };
  'game:offline-earnings': OfflineEarnings;
}

/** 通用事件监听器 */
export type EventListener<T> = (payload: T) => void;

// ─────────────────────────────────────────────
// 2. 存档数据
// ─────────────────────────────────────────────

/** 引擎统一存档数据结构 */
export interface GameSaveData {
  /** 存档版本 */
  version: number;
  /** 保存时间戳（ms） */
  saveTime: number;
  /** 资源系统数据 */
  resource: ResourceSaveData;
  /** 建筑系统数据 */
  building: BuildingSaveData;
  /** 日历系统数据（可选，向后兼容旧存档） */
  calendar?: import('../engine/calendar/calendar.types').CalendarSaveData;
  /** 武将系统数据（可选，向后兼容旧存档） */
  hero?: import('../engine/hero/hero.types').HeroSaveData;
  /** 招募系统数据（可选，向后兼容旧存档） */
  recruit?: import('../engine/hero/HeroRecruitSystem').RecruitSaveData;
  /** 编队系统数据（可选，向后兼容旧存档） */
  formation?: import('../engine/hero/HeroFormation').FormationSaveData;
  /** 关卡进度数据（可选，向后兼容旧存档） */
  campaign?: import('../engine/campaign/campaign.types').CampaignSaveData;
  /** 科技系统数据（可选，向后兼容旧存档） */
  tech?: import('../engine/tech/tech.types').TechSaveData;
}

// ─────────────────────────────────────────────
// 3. 引擎状态快照（供 UI 消费）
// ─────────────────────────────────────────────

/** 引擎状态快照 */
export interface EngineSnapshot {
  /** 当前资源 */
  resources: Readonly<Resources>;
  /** 产出速率 */
  productionRates: Readonly<ProductionRate>;
  /** 资源上限 */
  caps: Readonly<ResourceCap>;
  /** 所有建筑状态 */
  buildings: Readonly<Record<BuildingType, BuildingState>>;
  /** 游戏在线时长（秒） */
  onlineSeconds: number;
  /** 日历状态 */
  calendar: import('../engine/calendar/calendar.types').CalendarState;
  /** 武将列表 */
  heroes: Readonly<import('../engine/hero/hero.types').GeneralData>[];
  /** 武将碎片 */
  heroFragments: Readonly<Record<string, number>>;
  /** 全体武将总战力 */
  totalPower: number;
  /** 所有编队 */
  formations: import('../engine/hero/HeroFormation').FormationData[];
  /** 当前激活编队ID */
  activeFormationId: string | null;
  /** 关卡进度 */
  campaignProgress: import('../engine/campaign/campaign.types').CampaignProgress;
  /** 科技系统状态 */
  techState: import('../engine/tech/tech.types').TechState;
  /** 地图状态（v5.0） */
  mapState?: import('../core/map/world-map.types').WorldMapState;
  /** 领土状态（v5.0） */
  territoryState?: import('../core/map/territory.types').TerritoryState;
  /** 攻城状态（v5.0） */
  siegeState?: import('../engine/map/SiegeSystem').SiegeState;
}
