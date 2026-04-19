/**
 * 全局事件类型常量
 *
 * 集中定义 v1.0 范围内所有事件名称和载荷类型，
 * 避免事件字符串散落在各模块中导致拼写错误。
 *
 * 命名规范：`domain:action`（小写，冒号分隔）
 *
 * 覆盖 11 个领域：
 *   Engine(引擎)、Resource(资源)、Building(建筑)、Save(存档)、
 *   Game(游戏兼容)、General(武将)、Campaign(战役)、Map(地图)、
 *   Economy(经济)、Social(社交事件)、Visual(视觉)
 *
 * @module core/events/EventTypes
 */

// ─────────────────────────────────────────────
// 引擎生命周期事件
// ─────────────────────────────────────────────

/** 引擎生命周期事件常量 */
export const EngineEvents = {
  /** 引擎初始化完成 */
  INIT: 'engine:init',
  /** 引擎启动（游戏循环开始） */
  START: 'engine:start',
  /** 引擎暂停 */
  PAUSE: 'engine:pause',
  /** 引擎从暂停恢复 */
  RESUME: 'engine:resume',
  /** 引擎重置到初始状态 */
  RESET: 'engine:reset',
  /** 引擎销毁，释放所有资源 */
  DESTROY: 'engine:destroy',
  /** 引擎运行时错误 */
  ERROR: 'engine:error',
  /** 游戏循环 tick */
  TICK: 'engine:tick',
} as const;

// ─────────────────────────────────────────────
// 资源事件
// ─────────────────────────────────────────────

/** 资源事件常量 */
export const ResourceEvents = {
  /** 资源数量变化 */
  CHANGED: 'resource:changed',
  /** 产出速率更新 */
  PRODUCTION_UPDATED: 'resource:production-updated',
  /** 资源达到上限 */
  CAP_REACHED: 'resource:cap-reached',
  /** 容量警告 */
  CAP_WARNING: 'resource:cap-warning',
  /** 离线收益计算完成 */
  OFFLINE_EARNINGS: 'resource:offline-earnings',
} as const;

// ─────────────────────────────────────────────
// 建筑事件
// ─────────────────────────────────────────────

/** 建筑事件常量 */
export const BuildingEvents = {
  /** 建筑升级开始 */
  UPGRADE_STARTED: 'building:upgrade-started',
  /** 建筑升级完成 */
  UPGRADE_COMPLETED: 'building:upgrade-completed',
  /** 建筑升级取消 */
  UPGRADE_CANCELLED: 'building:upgrade-cancelled',
  /** 建筑解锁 */
  UNLOCKED: 'building:unlocked',
  /** 建筑等级变化 */
  LEVEL_CHANGED: 'building:level-changed',
} as const;

// ─────────────────────────────────────────────
// 存档事件
// ─────────────────────────────────────────────

/** 存档事件常量 */
export const SaveEvents = {
  /** 存档保存成功 */
  SAVED: 'save:saved',
  /** 存档加载成功 */
  LOADED: 'save:loaded',
  /** 存档删除 */
  DELETED: 'save:deleted',
  /** 存档保存失败 */
  SAVE_FAILED: 'save:save-failed',
} as const;

// ─────────────────────────────────────────────
// 游戏事件（兼容旧事件名，过渡期使用）
// ─────────────────────────────────────────────

/** 游戏事件常量（v1.0 兼容层） */
export const GameEvents = {
  /** 游戏初始化完成 */
  INITIALIZED: 'game:initialized',
  /** 游戏加载完成 */
  LOADED: 'game:loaded',
  /** 游戏保存完成 */
  SAVED: 'game:saved',
  /** 离线收益 */
  OFFLINE_EARNINGS: 'game:offline-earnings',
} as const;

// ─────────────────────────────────────────────
// 武将事件
// ─────────────────────────────────────────────

/** 武将事件常量 */
export const GeneralEvents = {
  /** 武将招募 */
  RECRUITED: 'general:recruited',
  /** 武将升级 */
  LEVEL_UP: 'general:levelUp',
  /** 武将派遣 */
  DISPATCHED: 'general:dispatched',
  /** 武将召回 */
  RECALLED: 'general:recalled',
  /** 羁绊激活 */
  BOND_ACTIVATED: 'general:bondActivated',
  /** 技能升级 */
  SKILL_UPGRADED: 'general:skillUpgraded',
  /** 升星 */
  STAR_UP: 'general:starUp',
  /** 对话触发 */
  DIALOGUE_TRIGGERED: 'general:dialogueTriggered',
  /** 故事事件 */
  STORY_EVENT: 'general:storyEvent',
} as const;

// ─────────────────────────────────────────────
// 战役事件
// ─────────────────────────────────────────────

/** 战役事件常量 */
export const CampaignEvents = {
  /** 关卡开始 */
  STAGE_STARTED: 'campaign:stageStarted',
  /** 关卡完成 */
  STAGE_COMPLETED: 'campaign:stageCompleted',
  /** 关卡失败 */
  STAGE_FAILED: 'campaign:stageFailed',
  /** 星级评定 */
  STAGE_STAR_AWARDED: 'campaign:stageStarAwarded',
  /** 战斗开始 */
  BATTLE_START: 'campaign:battleStart',
  /** 战斗结束 */
  BATTLE_END: 'campaign:battleEnd',
  /** 扫荡完成 */
  SWEEP_COMPLETED: 'campaign:sweepCompleted',
  /** 章节解锁 */
  CHAPTER_UNLOCKED: 'campaign:chapterUnlocked',
} as const;

// ─────────────────────────────────────────────
// 地图事件
// ─────────────────────────────────────────────

/** 地图事件常量 */
export const MapEvents = {
  /** 领土扩张 */
  TERRITORY_EXPANDED: 'map:territoryExpanded',
  /** 城池占领 */
  CITY_CAPTURED: 'map:cityCaptured',
  /** 城池失守 */
  CITY_LOST: 'map:cityLost',
  /** 天气变化 */
  WEATHER_CHANGED: 'map:weatherChanged',
  /** 昼夜变化 */
  DAY_NIGHT_CHANGED: 'map:dayNightChanged',
  /** 资源点占领 */
  RESOURCE_POINT_CAPTURED: 'map:resourcePointCaptured',
} as const;

// ─────────────────────────────────────────────
// 经济事件
// ─────────────────────────────────────────────

/** 经济事件常量 */
export const EconomyEvents = {
  /** 商路开通 */
  TRADE_ROUTE_OPENED: 'economy:tradeRouteOpened',
  /** 商路关闭 */
  TRADE_ROUTE_CLOSED: 'economy:tradeRouteClosed',
  /** 贸易完成 */
  TRADE_COMPLETED: 'economy:tradeCompleted',
  /** 科技研究开始 */
  TECH_RESEARCHED: 'economy:techResearched',
  /** 科技研究完成 */
  TECH_COMPLETED: 'economy:techCompleted',
  /** 装备打造 */
  EQUIPMENT_CRAFTED: 'economy:equipmentCrafted',
  /** 装备强化 */
  EQUIPMENT_ENHANCED: 'economy:equipmentEnhanced',
} as const;

// ─────────────────────────────────────────────
// 社交事件
// ─────────────────────────────────────────────

/** 社交事件常量 */
export const SocialEvents = {
  /** 随机事件触发 */
  EVENT_TRIGGERED: 'social:eventTriggered',
  /** 事件选择 */
  EVENT_CHOICE_MADE: 'social:eventChoiceMade',
  /** 事件完成 */
  EVENT_COMPLETED: 'social:eventCompleted',
  /** 任务接受 */
  QUEST_ACCEPTED: 'social:questAccepted',
  /** 任务进度 */
  QUEST_PROGRESS: 'social:questProgress',
  /** 任务完成 */
  QUEST_COMPLETED: 'social:questCompleted',
  /** NPC交互 */
  NPC_INTERACTION: 'social:npcInteraction',
  /** NPC赠送 */
  NPC_GIFT_SENT: 'social:npcGiftSent',
  /** 日历日期变化 */
  CALENDAR_DAY_CHANGED: 'social:calendarDayChanged',
  /** 季节变化 */
  CALENDAR_SEASON_CHANGED: 'social:calendarSeasonChanged',
  /** 联盟创建 */
  ALLIANCE_CREATED: 'social:allianceCreated',
  /** 加入联盟 */
  ALLIANCE_JOINED: 'social:allianceJoined',
  /** 竞技场战斗开始 */
  ARENA_BATTLE_START: 'social:arenaBattleStart',
  /** 竞技场战斗结束 */
  ARENA_BATTLE_END: 'social:arenaBattleEnd',
} as const;

// ─────────────────────────────────────────────
// 视觉事件
// ─────────────────────────────────────────────

/** 视觉事件常量 */
export const VisualEvents = {
  /** 浮动文字 */
  FLOATING_TEXT: 'visual:floatingText',
  /** 粒子效果 */
  PARTICLE_EFFECT: 'visual:particleEffect',
  /** 屏幕震动 */
  SCREEN_SHAKE: 'visual:screenShake',
  /** 镜头移动 */
  CAMERA_MOVE: 'visual:cameraMove',
  /** 动画播放 */
  ANIMATION_PLAY: 'visual:animationPlay',
} as const;

// ─────────────────────────────────────────────
// 事件载荷类型映射
// ─────────────────────────────────────────────

/**
 * 事件载荷类型映射
 *
 * 提供事件名到载荷类型的强类型映射，
 * 配合 EventBus 使用可获得类型推断。
 *
 * @example
 * ```ts
 * // 类型安全地发布事件
 * bus.emit(GeneralEvents.RECRUITED, {
 *   generalId: 'guanyu',
 *   rarity: 'legendary',
 * });
 * ```
 */
export interface EventPayloadMap {
  // ── 引擎事件 ──
  [EngineEvents.INIT]: void;
  [EngineEvents.START]: void;
  [EngineEvents.PAUSE]: void;
  [EngineEvents.RESUME]: void;
  [EngineEvents.RESET]: void;
  [EngineEvents.DESTROY]: void;
  [EngineEvents.ERROR]: { error: Error; source?: string };
  [EngineEvents.TICK]: { dt: number; timestamp: number };

  // ── 资源事件 ──
  [ResourceEvents.CHANGED]: { resource: string; amount: number; previous: number };
  [ResourceEvents.PRODUCTION_UPDATED]: { resource: string; rate: number };
  [ResourceEvents.CAP_REACHED]: { resource: string; cap: number };
  [ResourceEvents.CAP_WARNING]: { resource: string; current: number; cap: number };
  [ResourceEvents.OFFLINE_EARNINGS]: { earnings: Record<string, number>; duration: number };

  // ── 建筑事件 ──
  [BuildingEvents.UPGRADE_STARTED]: { buildingType: string; cost: Record<string, number> };
  [BuildingEvents.UPGRADE_COMPLETED]: { buildingType: string; newLevel: number };
  [BuildingEvents.UPGRADE_CANCELLED]: { buildingType: string; reason?: string };
  [BuildingEvents.UNLOCKED]: { buildingTypes: string[] };
  [BuildingEvents.LEVEL_CHANGED]: { buildingType: string; oldLevel: number; newLevel: number };

  // ── 存档事件 ──
  [SaveEvents.SAVED]: { timestamp: number };
  [SaveEvents.LOADED]: { offlineEarnings?: unknown };
  [SaveEvents.DELETED]: void;
  [SaveEvents.SAVE_FAILED]: { error: Error };

  // ── 游戏事件（兼容旧事件名） ──
  [GameEvents.INITIALIZED]: { isNewGame: boolean };
  [GameEvents.LOADED]: { offlineEarnings?: unknown };
  [GameEvents.SAVED]: { timestamp: number };
  [GameEvents.OFFLINE_EARNINGS]: unknown;

  // ── 武将事件 ──
  [GeneralEvents.RECRUITED]: { generalId: string; rarity: string; source: string };
  [GeneralEvents.LEVEL_UP]: { generalId: string; oldLevel: number; newLevel: number };
  [GeneralEvents.DISPATCHED]: { generalId: string; target: string; task: string };
  [GeneralEvents.RECALLED]: { generalId: string; from: string };
  [GeneralEvents.BOND_ACTIVATED]: { generalIds: string[]; bondId: string; bonus: Record<string, number> };
  [GeneralEvents.SKILL_UPGRADED]: { generalId: string; skillId: string; newLevel: number };
  [GeneralEvents.STAR_UP]: { generalId: string; oldStar: number; newStar: number };
  [GeneralEvents.DIALOGUE_TRIGGERED]: { generalId: string; dialogueId: string };
  [GeneralEvents.STORY_EVENT]: { generalId: string; eventId: string; chapter: string };

  // ── 战役事件 ──
  [CampaignEvents.STAGE_STARTED]: { chapterId: string; stageId: string };
  [CampaignEvents.STAGE_COMPLETED]: { chapterId: string; stageId: string; stars: number; rewards: Record<string, number> };
  [CampaignEvents.STAGE_FAILED]: { chapterId: string; stageId: string; reason?: string };
  [CampaignEvents.STAGE_STAR_AWARDED]: { chapterId: string; stageId: string; stars: number };
  [CampaignEvents.BATTLE_START]: { stageId: string; lineup: string[]; enemies: string[] };
  [CampaignEvents.BATTLE_END]: { stageId: string; victory: boolean; duration: number };
  [CampaignEvents.SWEEP_COMPLETED]: { stageId: string; sweepCount: number; rewards: Record<string, number> };
  [CampaignEvents.CHAPTER_UNLOCKED]: { chapterId: string; chapterName: string };

  // ── 地图事件 ──
  [MapEvents.TERRITORY_EXPANDED]: { territoryId: string; owner: string };
  [MapEvents.CITY_CAPTURED]: { cityId: string; cityName: string; owner: string; previousOwner?: string };
  [MapEvents.CITY_LOST]: { cityId: string; cityName: string; newOwner: string };
  [MapEvents.WEATHER_CHANGED]: { previous: string; current: string };
  [MapEvents.DAY_NIGHT_CHANGED]: { isDaytime: boolean; hour: number };
  [MapEvents.RESOURCE_POINT_CAPTURED]: { pointId: string; resourceType: string; owner: string };

  // ── 经济事件 ──
  [EconomyEvents.TRADE_ROUTE_OPENED]: { routeId: string; from: string; to: string };
  [EconomyEvents.TRADE_ROUTE_CLOSED]: { routeId: string; reason?: string };
  [EconomyEvents.TRADE_COMPLETED]: { routeId: string; goods: Record<string, number>; profit: number };
  [EconomyEvents.TECH_RESEARCHED]: { techId: string; techName: string; duration: number };
  [EconomyEvents.TECH_COMPLETED]: { techId: string; techName: string; bonuses: Record<string, number> };
  [EconomyEvents.EQUIPMENT_CRAFTED]: { equipmentId: string; type: string; rarity: string; crafter?: string };
  [EconomyEvents.EQUIPMENT_ENHANCED]: { equipmentId: string; oldLevel: number; newLevel: number; materialCost: Record<string, number> };

  // ── 社交事件 ──
  [SocialEvents.EVENT_TRIGGERED]: { eventId: string; eventName: string; description: string };
  [SocialEvents.EVENT_CHOICE_MADE]: { eventId: string; choiceId: string; choiceText: string };
  [SocialEvents.EVENT_COMPLETED]: { eventId: string; outcome: string; rewards: Record<string, number> };
  [SocialEvents.QUEST_ACCEPTED]: { questId: string; questName: string; type: string };
  [SocialEvents.QUEST_PROGRESS]: { questId: string; current: number; target: number };
  [SocialEvents.QUEST_COMPLETED]: { questId: string; questName: string; rewards: Record<string, number> };
  [SocialEvents.NPC_INTERACTION]: { npcId: string; npcName: string; dialogueId: string };
  [SocialEvents.NPC_GIFT_SENT]: { npcId: string; giftId: string; favorabilityChange: number };
  [SocialEvents.CALENDAR_DAY_CHANGED]: { day: number; month: number; year: number };
  [SocialEvents.CALENDAR_SEASON_CHANGED]: { season: string; year: number };
  [SocialEvents.ALLIANCE_CREATED]: { allianceId: string; allianceName: string; creator: string };
  [SocialEvents.ALLIANCE_JOINED]: { allianceId: string; allianceName: string; member: string };
  [SocialEvents.ARENA_BATTLE_START]: { opponent: string; rank: number };
  [SocialEvents.ARENA_BATTLE_END]: { victory: boolean; rankChange: number; newRank: number };

  // ── 视觉事件 ──
  [VisualEvents.FLOATING_TEXT]: { text: string; x: number; y: number; color?: string; duration?: number };
  [VisualEvents.PARTICLE_EFFECT]: { effectId: string; x: number; y: number; scale?: number };
  [VisualEvents.SCREEN_SHAKE]: { intensity: number; duration: number };
  [VisualEvents.CAMERA_MOVE]: { x: number; y: number; duration: number; easing?: string };
  [VisualEvents.ANIMATION_PLAY]: { animationId: string; targetId: string; loop?: boolean };
}
