/**
 * Offline snapshot - types
 *
 * Extracted from OfflineSnapshotSystem.ts.
 */

import type {
  Resources,
  ProductionRate,
  ResourceCap,
} from '../../shared/types';
import type { ISubsystem, ISystemDeps } from '../../core/types';
// ─────────────────────────────────────────────
// 1. 快照数据结构
// ─────────────────────────────────────────────

export interface SystemSnapshot {
  /** 资源快照 */
  resources: Resources;
  /** 产出速率快照 */
  productionRates: ProductionRate;
  /** 资源上限快照 */
  caps: ResourceCap;
  /** 建筑队列状态 */
  buildingQueue: BuildingQueueSnapshot[];
  /** 科技队列状态 */
  techQueue: TechQueueSnapshot[];
  /** 远征队列状态 */
  expeditionQueue: ExpeditionQueueSnapshot[];
  /** 商队运输状态 */
  tradeCaravans: TradeCaravanSnapshot[];
}

/** 建筑队列快照 */
export interface BuildingQueueSnapshot {
  /** 建筑类型 */
  buildingType: string;
  /** 开始时间戳 */
  startTime: number;
  /** 完成时间戳 */
  endTime: number;
}

/** 科技队列快照 */
export interface TechQueueSnapshot {
  /** 科技ID */
  techId: string;
  /** 开始时间戳 */
  startTime: number;
  /** 完成时间戳 */
  endTime: number;
}

/** 远征队列快照 */
export interface ExpeditionQueueSnapshot {
  /** 远征ID */
  expeditionId: string;
  /** 开始时间戳 */
  startTime: number;
  /** 完成时间戳 */
  endTime: number;
  /** 预估收益 */
  estimatedReward: Resources;
}

/** 商队运输快照 */
export interface TradeCaravanSnapshot {
  /** 商队ID */
  caravanId: string;
  /** 路线ID */
  routeId: string;
  /** 出发时间戳 */
  startTime: number;
  /** 到达时间戳 */
  endTime: number;
  /** 预估收益 */
  estimatedProfit: Resources;
}

// ─────────────────────────────────────────────
// 2. 快照管理器
// ─────────────────────────────────────────────

/** 快照存储键 */
export const SNAPSHOT_KEY = 'three-kingdoms-offline-snapshot';
export const SAVE_DATA_KEY = 'three-kingdoms-offline-save';

/**
 * 离线快照系统
 *
 * 管理下线快照的创建、存储、验证和过期清理
 */
