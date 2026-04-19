/**
 * 全局事件类型常量
 *
 * 集中定义 v1.0 范围内所有事件名称和载荷类型，
 * 避免事件字符串散落在各模块中导致拼写错误。
 *
 * 命名规范：`domain:action`（小写，冒号分隔）
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
 * bus.emit(EventTypes.ResourceEvents.CHANGED, {
 *   resource: 'gold',
 *   amount: 100,
 *   previous: 50,
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
}
