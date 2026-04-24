/**
 * 基础设施层 — 全局共享类型
 *
 * 跨域通用类型定义，供 Engine 编排层和 UI 层使用
 *
 * 规则：零 engine/ 依赖，所有基础类型在本文件中定义
 */

// ─────────────────────────────────────────────
// 0. 武将域基础类型（与 engine/hero/hero.types.ts 保持同步）
// ─────────────────────────────────────────────

/** 武将阵营 */
export type Faction = 'shu' | 'wei' | 'wu' | 'qun';

/** 武将四维属性 */
export interface GeneralStats {
  /** 攻击（武力） */
  attack: number;
  /** 防御（统率） */
  defense: number;
  /** 智力 */
  intelligence: number;
  /** 速度（政治） */
  speed: number;
}

// ─────────────────────────────────────────────
// 0. 战斗域基础类型（与 engine/battle/battle.types.ts 保持同步）
// ─────────────────────────────────────────────

/** 战斗行动 */
export interface BattleAction {
  /** 回合号 */
  turn: number;
  /** 行动方阵营 */
  side: 'ally' | 'enemy';
  /** 行动类型 */
  type: 'attack' | 'skill' | 'buff' | 'debuff' | 'move';
  /** 行动者ID */
  actorId: string;
  /** 目标ID列表 */
  targetIds: string[];
  /** 伤害/治疗数值 */
  value: number;
  /** 附加描述 */
  description: string;
}

/** 战斗状态 */
export interface BattleState {
  /** 战斗ID */
  battleId: string;
  /** 当前回合 */
  currentTurn: number;
  /** 最大回合 */
  maxTurns: number;
  /** 是否结束 */
  isOver: boolean;
  /** 行动日志 */
  actionLog: BattleAction[];
  /** 胜负结果 */
  result: BattleResult | null;
}

/** 战斗结果 */
export interface BattleResult {
  /** 是否胜利 */
  victory: boolean;
  /** 总回合数 */
  totalTurns: number;
  /** 评价星级 */
  stars: number;
  /** 获得经验 */
  expGained: number;
  /** 掉落物品 */
  drops: { itemId: string; count: number }[];
}

// ─────────────────────────────────────────────
// 0. 资源域基础类型（与 engine/resource/resource.types.ts 保持同步）
// ─────────────────────────────────────────────

/** 核心资源类型 */
export type ResourceType = 'grain' | 'gold' | 'troops' | 'mandate' | 'techPoint' | 'recruitToken';

/** 资源数量集合 */
export interface Resources {
  grain: number;
  gold: number;
  troops: number;
  mandate: number;
  techPoint: number;
  recruitToken: number;
}

/** 资源产出速率（每秒） */
export interface ProductionRate {
  grain: number;
  gold: number;
  troops: number;
  mandate: number;
  techPoint: number;
  recruitToken: number;
}

/** 资源上限（null 表示无上限） */
export interface ResourceCap {
  grain: number;
  gold: null;
  troops: number;
  mandate: null;
  techPoint: null;
  recruitToken: null;
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
  | 'game:offline-earnings'  // 离线收益
  | 'resource:overflow';     // 资源溢出

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
  'resource:overflow': { resource: string; overflow: number };
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
  recruit?: import('../engine/hero/recruit-types').RecruitSaveData;
  /** 编队系统数据（可选，向后兼容旧存档） */
  formation?: import('../engine/hero/formation-types').FormationSaveData;
  /** 关卡进度数据（可选，向后兼容旧存档） */
  campaign?: import('../engine/campaign/campaign.types').CampaignSaveData;
  /** 科技系统数据（可选，向后兼容旧存档） */
  tech?: import('../engine/tech/tech.types').TechSaveData;
  /** 装备系统数据（可选，v5.0+） */
  equipment?: import('../core/equipment/equipment.types').EquipmentSaveData;
  /** 装备炼制系统数据（可选，v10.0+） */
  equipmentForge?: import('../core/equipment/equipment-forge.types').ForgeSaveData;
  /** 装备强化系统数据（可选，v10.0+） */
  equipmentEnhance?: { protectionCount: number };
  /** 贸易系统数据（可选，v5.0+） */
  trade?: import('../core/trade/trade.types').TradeSaveData;
  /** 商店系统数据（可选，v5.0+） */
  shop?: import('../core/shop/shop.types').ShopSaveData;
  /** 声望系统数据（可选，v14.0+） */
  prestige?: import('../core/prestige').PrestigeSaveData;
  /** 传承系统数据（可选，v14.0+） */
  heritage?: import('../core/heritage').HeritageSaveData;
  /** 成就系统数据（可选，v14.0+） */
  achievement?: import('../core/achievement').AchievementSaveData;
  /** 竞技场存档数据（可选，v7.0+） */
  pvpArena?: import('../core/pvp/pvp.types').ArenaSaveData;
  /** 竞技商店存档数据（可选，v7.0+） */
  pvpArenaShop?: import('../engine/pvp/ArenaShopSystem').ArenaShopSaveData;
  /** 排行榜存档数据（可选，v7.0+） */
  pvpRanking?: import('../engine/pvp/RankingSystem').RankingSaveData;

  // ── 事件系统 v7.0+ ──
  /** 事件触发系统数据（可选，v7.0+） */
  eventTrigger?: import('../core/event').EventSystemSaveData;
  /** 事件通知系统数据（可选，v7.0+） */
  eventNotification?: import('../engine/event/EventNotificationSystem').EventNotificationSaveData;
  /** 事件UI通知数据（可选，v7.0+） */
  eventUI?: { expiredBanners: import('../core/events/event-system.types').EventBanner[] };
  /** 事件链系统数据（可选，v7.0+） */
  eventChain?: import('../engine/event/EventChainSystem').EventChainSaveData;
  /** 事件日志系统数据（可选，v7.0+） */
  eventLog?: import('../engine/event/EventLogSystem').EventLogSaveData;
  /** 离线事件系统数据（可选，v15.0+） */
  offlineEvent?: { version: number; offlineQueue: unknown[]; autoRules: unknown[] };
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
  formations: import('../engine/hero/formation-types').FormationData[];
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
