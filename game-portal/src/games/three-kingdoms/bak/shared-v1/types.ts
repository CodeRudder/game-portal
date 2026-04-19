/**
 * 基础设施层 — 全局共享类型
 *
 * 跨域通用类型定义，供 Engine 编排层和 UI 层使用
 */

import type { ResourceType, Resources, ProductionRate, ResourceCap } from '../engine/resource/resource.types';
import type {
  BuildingType,
  BuildingState,
  UpgradeCost,
  UpgradeCheckResult,
} from '../engine/building/building.types';

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
  'resource:cap-warning': { warnings: import('../engine/resource/resource.types').CapWarning[] };
  'building:upgraded': { type: BuildingType; level: number };
  'building:upgrade-start': { type: BuildingType; cost: UpgradeCost };
  'building:unlocked': { types: BuildingType[] };
  'game:initialized': { isNewGame: boolean };
  'game:loaded': { offlineEarnings?: import('../engine/resource/resource.types').OfflineEarnings };
  'game:saved': { timestamp: number };
  'game:offline-earnings': import('../engine/resource/resource.types').OfflineEarnings;
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
  resource: import('../engine/resource/resource.types').ResourceSaveData;
  /** 建筑系统数据 */
  building: import('../engine/building/building.types').BuildingSaveData;
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
}
