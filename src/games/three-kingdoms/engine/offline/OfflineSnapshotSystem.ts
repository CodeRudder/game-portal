/**
 * 离线快照系统 — 快照管理
 *
 * 职责：
 *   - 下线时记录各系统状态快照
 *   - 快照有效期72h管理
 *   - 快照序列化/反序列化
 *   - 快照数据校验
 *
 * 规则：管理快照生命周期，不涉及具体收益计算
 *
 * @module engine/offline/OfflineSnapshotSystem
 */

import type {
  Resources,
  ProductionRate,
  ResourceCap,
} from '../../shared/types';
import type {
  OfflineSaveData,
  OfflineBoostItem,
  BoostUseResult,
  OfflineTradeEvent,
  ExpansionResult,
  WarehouseExpansion,
} from './offline.types';
import {
  MAX_OFFLINE_SECONDS,
  OFFLINE_SAVE_VERSION,
  DEFAULT_WAREHOUSE_EXPANSIONS,
} from './offline-config';

// ─────────────────────────────────────────────
// 1. 快照数据结构
// ─────────────────────────────────────────────

/** 系统状态快照（下线时记录） */
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
const SNAPSHOT_KEY = 'three-kingdoms-offline-snapshot';
const SAVE_DATA_KEY = 'three-kingdoms-offline-save';

/**
 * 离线快照系统
 *
 * 管理下线快照的创建、存储、验证和过期清理
 */
export class OfflineSnapshotSystem {
  private snapshot: SystemSnapshot | null = null;
  private saveData: OfflineSaveData;
  private storage: Storage | null = null;

  constructor(storage?: Storage) {
    this.storage = storage ?? null;
    this.saveData = this.createDefaultSaveData();
    this.loadSaveData();
  }

  // ── 快照创建 ──

  /**
   * 创建下线快照
   *
   * 玩家下线时立即调用，记录所有系统状态
   *
   * @param systemState 各系统当前状态
   * @returns 创建的快照
   */
  createSnapshot(systemState: {
    resources: Resources;
    productionRates: ProductionRate;
    caps: ResourceCap;
    buildingQueue?: BuildingQueueSnapshot[];
    techQueue?: TechQueueSnapshot[];
    expeditionQueue?: ExpeditionQueueSnapshot[];
    tradeCaravans?: TradeCaravanSnapshot[];
  }): SystemSnapshot {
    this.snapshot = {
      resources: { ...systemState.resources },
      productionRates: { ...systemState.productionRates },
      caps: { ...systemState.caps },
      buildingQueue: systemState.buildingQueue ?? [],
      techQueue: systemState.techQueue ?? [],
      expeditionQueue: systemState.expeditionQueue ?? [],
      tradeCaravans: systemState.tradeCaravans ?? [],
    };

    // 更新存档数据
    this.saveData.lastOfflineTime = Date.now();
    this.persistSaveData();

    return this.snapshot;
  }

  /**
   * 获取当前快照
   *
   * @returns 当前快照或null
   */
  getSnapshot(): SystemSnapshot | null {
    return this.snapshot;
  }

  /**
   * 验证快照是否有效
   *
   * 72h有效期，超过则快照失效
   *
   * @returns 快照是否有效
   */
  isSnapshotValid(): boolean {
    if (!this.snapshot) return false;
    const elapsed = (Date.now() - this.saveData.lastOfflineTime) / 1000;
    return elapsed <= MAX_OFFLINE_SECONDS;
  }

  // ── 离线时长计算 ──

  /**
   * 计算离线时长（秒）
   *
   * @returns 离线秒数，0表示无快照
   */
  getOfflineSeconds(): number {
    if (this.saveData.lastOfflineTime <= 0) return 0;
    const elapsed = (Date.now() - this.saveData.lastOfflineTime) / 1000;
    return Math.max(0, Math.floor(elapsed));
  }

  // ── 队列完成检测 ──

  /**
   * 检测离线期间完成的建筑升级
   *
   * @param now 当前时间戳（ms）
   * @returns 完成的建筑列表
   */
  getCompletedBuildings(now: number = Date.now()): BuildingQueueSnapshot[] {
    if (!this.snapshot) return [];
    return this.snapshot.buildingQueue.filter(b => b.endTime <= now);
  }

  /**
   * 检测离线期间完成的科技研究
   *
   * @param now 当前时间戳（ms）
   * @returns 完成的科技列表
   */
  getCompletedTech(now: number = Date.now()): TechQueueSnapshot[] {
    if (!this.snapshot) return [];
    return this.snapshot.techQueue.filter(t => t.endTime <= now);
  }

  /**
   * 检测离线期间完成的远征
   *
   * @param now 当前时间戳（ms）
   * @returns 完成的远征列表
   */
  getCompletedExpeditions(now: number = Date.now()): ExpeditionQueueSnapshot[] {
    if (!this.snapshot) return [];
    return this.snapshot.expeditionQueue.filter(e => e.endTime <= now);
  }

  /**
   * 检测离线期间完成的贸易
   *
   * @param now 当前时间戳（ms）
   * @returns 完成的贸易列表
   */
  getCompletedTrades(now: number = Date.now()): TradeCaravanSnapshot[] {
    if (!this.snapshot) return [];
    return this.snapshot.tradeCaravans.filter(t => t.endTime <= now);
  }

  // ── 加速道具管理 ──

  /**
   * 使用加速道具
   *
   * @param itemId 道具ID
   * @param items 道具库存
   * @param productionRates 当前产出速率
   * @param bonusSources 加成来源
   * @returns 使用结果
   */
  useBoostItem(
    itemId: string,
    items: OfflineBoostItem[],
    productionRates: ProductionRate,
    bonusSources?: { tech?: number; vip?: number; reputation?: number },
  ): BoostUseResult {
    const item = items.find(i => i.id === itemId);
    if (!item) {
      return { success: false, addedSeconds: 0, addedEarned: { grain: 0, gold: 0, troops: 0, mandate: 0 }, remainingCount: 0, reason: '道具不存在' };
    }
    if (item.count <= 0) {
      return { success: false, addedSeconds: 0, addedEarned: { grain: 0, gold: 0, troops: 0, mandate: 0 }, remainingCount: 0, reason: '道具数量不足' };
    }

    const addedSeconds = item.boostHours * 3600;
    const bonusMultiplier = 1 + Math.min(
      (bonusSources?.tech ?? 0) + (bonusSources?.vip ?? 0) + (bonusSources?.reputation ?? 0),
      1.0,
    );

    const addedEarned: Resources = {
      grain: Math.floor(productionRates.grain * addedSeconds * bonusMultiplier),
      gold: Math.floor(productionRates.gold * addedSeconds * bonusMultiplier),
      troops: Math.floor(productionRates.troops * addedSeconds * bonusMultiplier),
      mandate: Math.floor(productionRates.mandate * addedSeconds * bonusMultiplier),
    };

    return {
      success: true,
      addedSeconds,
      addedEarned,
      remainingCount: item.count - 1,
    };
  }

  // ── 仓库扩容 ──

  /**
   * 扩容仓库
   *
   * @param resourceType 资源类型
   * @param expansions 扩容配置（可选，默认使用配置）
   * @returns 扩容结果
   */
  expandWarehouse(
    resourceType: string,
    expansions: readonly WarehouseExpansion[] = DEFAULT_WAREHOUSE_EXPANSIONS,
  ): ExpansionResult {
    const expansion = expansions.find(e => e.resourceType === resourceType);
    if (!expansion) {
      return { success: false, newCapacity: 0, previousCapacity: 0, newLevel: 0, reason: '资源类型不支持扩容' };
    }

    if (expansion.currentLevel >= expansion.maxLevel) {
      return {
        success: false,
        newCapacity: expansion.baseCapacity + expansion.perLevelIncrease * expansion.currentLevel,
        previousCapacity: expansion.baseCapacity + expansion.perLevelIncrease * expansion.currentLevel,
        newLevel: expansion.currentLevel,
        reason: '已达最大等级',
      };
    }

    const previousCapacity = expansion.baseCapacity + expansion.perLevelIncrease * expansion.currentLevel;
    const newLevel = expansion.currentLevel + 1;
    const newCapacity = expansion.baseCapacity + expansion.perLevelIncrease * newLevel;

    return { success: true, newCapacity, previousCapacity, newLevel };
  }

  // ── 存档管理 ──

  /**
   * 获取存档数据
   */
  getSaveData(): OfflineSaveData {
    return { ...this.saveData };
  }

  /**
   * 更新广告翻倍使用次数
   */
  recordAdDouble(): void {
    this.saveData.vipDoubleUsedToday++;
    this.persistSaveData();
  }

  /**
   * 重置每日翻倍次数
   */
  resetDailyDoubles(): void {
    this.saveData.vipDoubleUsedToday = 0;
    this.saveData.vipDoubleResetDate = new Date().toISOString().slice(0, 10);
    this.persistSaveData();
  }

  /**
   * 检查是否需要重置每日次数
   */
  checkDailyReset(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.saveData.vipDoubleResetDate !== today) {
      this.resetDailyDoubles();
    }
  }

  /**
   * 清除快照（上线领取后调用）
   */
  clearSnapshot(): void {
    this.snapshot = null;
    this.saveData.lastOfflineTime = 0;
    this.persistSaveData();
  }

  /**
   * 重置系统状态
   *
   * 清除快照并恢复默认存档数据，用于重新开始游戏。
   */
  reset(): void {
    this.snapshot = null;
    this.saveData = this.createDefaultSaveData();
    if (this.storage) {
      try {
        this.storage.removeItem(SNAPSHOT_KEY);
        this.storage.removeItem(SAVE_DATA_KEY);
      } catch {
        // 清除失败静默处理
      }
    }
  }

  // ── 私有方法 ──

  private createDefaultSaveData(): OfflineSaveData {
    return {
      lastOfflineTime: 0,
      vipDoubleUsedToday: 0,
      vipDoubleResetDate: new Date().toISOString().slice(0, 10),
      boostItems: {},
      activeTradeEvents: [],
      warehouseLevels: {},
      version: OFFLINE_SAVE_VERSION,
    };
  }

  private loadSaveData(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(SAVE_DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OfflineSaveData;
        if (parsed.version === OFFLINE_SAVE_VERSION) {
          this.saveData = parsed;
        }
      }
    } catch {
      // 存档损坏，使用默认值
      this.saveData = this.createDefaultSaveData();
    }
  }

  private persistSaveData(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_DATA_KEY, JSON.stringify(this.saveData));
    } catch {
      // 存储失败静默处理
    }
  }
}
