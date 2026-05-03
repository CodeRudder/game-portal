/**
 * 离线事件系统 (MAP-F09)
 *
 * 玩家离线期间生成的事件:
 * - 资源自动积累
 * - 随机事件(山贼袭击/商队经过/流民涌入)
 * - 离线奖励计算
 * - 上线时事件队列处理
 *
 * @module engine/map/OfflineEventSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 离线事件类型 */
export type OfflineEventType =
  | 'resource_accumulate'  // 资源积累
  | 'bandit_raid'          // 山贼袭击
  | 'caravan_visit'        // 商队经过
  | 'refugee_arrival'      // 流民涌入
  | 'trade_complete'       // 贸易完成
  | 'morale_change';       // 士气变化

/** 离线事件 */
export interface OfflineEvent {
  /** 事件ID */
  id: string;
  /** 事件类型 */
  type: OfflineEventType;
  /** 关联城市ID */
  cityId: string;
  /** 发生时间戳 */
  timestamp: number;
  /** 事件描述 */
  description: string;
  /** 事件数据 */
  data: Record<string, unknown>;
  /** 是否已处理 */
  processed: boolean;
}

/** 离线奖励 */
export interface OfflineReward {
  /** 资源变化 */
  resources: Record<string, number>;
  /** 事件列表 */
  events: OfflineEvent[];
  /** 离线时长(秒) */
  offlineDuration: number;
}

/** 离线事件系统状态 */
export interface OfflineEventState {
  /** 最后在线时间 */
  lastOnlineTime: number;
  /** 待处理事件队列 */
  pendingEvents: OfflineEvent[];
}

/** 存档数据 */
export interface OfflineEventSaveData {
  lastOnlineTime: number;
  pendingEvents: OfflineEvent[];
  version: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大离线时长(秒) — 24小时 */
const MAX_OFFLINE_SECONDS = 86400;

/** 资源积累基础速率(每秒) */
const RESOURCE_RATE = {
  gold: 0.5,
  grain: 0.3,
  troops: 0.1,
};

/** 随机事件概率(每小时) */
const EVENT_PROBABILITY = {
  bandit_raid: 0.05,
  caravan_visit: 0.1,
  refugee_arrival: 0.08,
  trade_complete: 0.03,
  morale_change: 0.02,
};

/** 存档版本 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// OfflineEventSystem
// ─────────────────────────────────────────────

/**
 * 离线事件系统
 */
export class OfflineEventSystem implements ISubsystem {
  readonly name = 'offlineEvents';

  private deps!: ISystemDeps;
  private lastOnlineTime = Date.now();
  private pendingEvents: OfflineEvent[] = [];
  private cities: Map<string, { faction: string; level: number }> = new Map();

  // ── ISubsystem 接口 ──────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.lastOnlineTime = Date.now();
    this.pendingEvents = [];
  }

  update(_dt: number): void {
    // 离线事件系统不需要每帧更新
    // 仅在上线时调用 processOfflineTime()
  }

  getState(): OfflineEventState {
    return {
      lastOnlineTime: this.lastOnlineTime,
      pendingEvents: [...this.pendingEvents],
    };
  }

  reset(): void {
    this.lastOnlineTime = Date.now();
    this.pendingEvents = [];
    this.cities.clear();
  }

  // ── 城市数据注入 ─────────────────────────────

  /**
   * 设置城市数据(用于离线计算)
   */
  setCities(cities: Array<{ id: string; faction: string; level: number }>): void {
    this.cities.clear();
    for (const city of cities) {
      this.cities.set(city.id, { faction: city.faction, level: city.level });
    }
  }

  // ── 离线处理 ─────────────────────────────────

  /**
   * 处理离线时间(玩家上线时调用)
   */
  processOfflineTime(): OfflineReward {
    const now = Date.now();
    const offlineMs = now - this.lastOnlineTime;
    const offlineSeconds = Math.min(MAX_OFFLINE_SECONDS, offlineMs / 1000);

    if (offlineSeconds < 10) {
      // 离线时间太短，不处理
      return { resources: {}, events: [], offlineDuration: 0 };
    }

    const events: OfflineEvent[] = [];
    const resources: Record<string, number> = { gold: 0, grain: 0, troops: 0 };

    // 1. 资源积累
    for (const [cityId, city] of this.cities) {
      if (city.faction === 'player') {
        const levelMultiplier = 1 + (city.level - 1) * 0.2;
        for (const [resource, rate] of Object.entries(RESOURCE_RATE)) {
          const amount = Math.floor(rate * offlineSeconds * levelMultiplier);
          if (amount > 0) {
            resources[resource] = (resources[resource] || 0) + amount;
            events.push(this.createEvent('resource_accumulate', cityId, now, {
              resource,
              amount,
              duration: offlineSeconds,
            }));
          }
        }
      }
    }

    // 2. 随机事件(基于离线时长)
    const hours = offlineSeconds / 3600;
    for (const [cityId, city] of this.cities) {
      if (city.faction !== 'player') continue;

      for (const [eventType, probability] of Object.entries(EVENT_PROBABILITY)) {
        const expectedCount = probability * hours;
        // 使用泊松分布近似
        if (Math.random() < expectedCount) {
          const event = this.generateRandomEvent(eventType as OfflineEventType, cityId, now);
          if (event) {
            events.push(event);
          }
        }
      }
    }

    // 保存待处理事件
    this.pendingEvents.push(...events);
    this.lastOnlineTime = now;

    this.deps.eventBus.emit('offline:processed', {
      offlineDuration: offlineSeconds,
      eventCount: events.length,
      resources,
    });

    return {
      resources,
      events,
      offlineDuration: offlineSeconds,
    };
  }

  /**
   * 获取待处理事件
   */
  getPendingEvents(): OfflineEvent[] {
    return this.pendingEvents.filter(e => !e.processed);
  }

  /**
   * 标记事件已处理
   */
  markProcessed(eventId: string): void {
    const event = this.pendingEvents.find(e => e.id === eventId);
    if (event) {
      event.processed = true;
    }
  }

  /**
   * 清除已处理事件
   */
  clearProcessed(): void {
    this.pendingEvents = this.pendingEvents.filter(e => !e.processed);
  }

  /**
   * 更新最后在线时间(定期调用)
   */
  heartbeat(): void {
    this.lastOnlineTime = Date.now();
  }

  // ── 内部方法 ─────────────────────────────────

  private createEvent(
    type: OfflineEventType,
    cityId: string,
    timestamp: number,
    data: Record<string, unknown>,
  ): OfflineEvent {
    return {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      cityId,
      timestamp,
      description: this.getEventDescription(type, data),
      data,
      processed: false,
    };
  }

  private generateRandomEvent(
    type: OfflineEventType,
    cityId: string,
    timestamp: number,
  ): OfflineEvent | null {
    switch (type) {
      case 'bandit_raid':
        return this.createEvent(type, cityId, timestamp, {
          troopsLost: Math.floor(Math.random() * 100) + 50,
          goldLost: Math.floor(Math.random() * 200) + 100,
        });
      case 'caravan_visit':
        return this.createEvent(type, cityId, timestamp, {
          goldGained: Math.floor(Math.random() * 300) + 200,
        });
      case 'refugee_arrival':
        return this.createEvent(type, cityId, timestamp, {
          troopsGained: Math.floor(Math.random() * 50) + 20,
          grainCost: Math.floor(Math.random() * 100) + 50,
        });
      case 'trade_complete':
        return this.createEvent(type, cityId, timestamp, {
          goldGained: Math.floor(Math.random() * 500) + 300,
        });
      case 'morale_change':
        return this.createEvent(type, cityId, timestamp, {
          moraleChange: Math.floor(Math.random() * 20) - 10,
        });
      default:
        return null;
    }
  }

  private getEventDescription(type: OfflineEventType, data: Record<string, unknown>): string {
    switch (type) {
      case 'resource_accumulate':
        return `${data.resource} +${data.amount}`;
      case 'bandit_raid':
        return `山贼袭击! 损失${data.troopsLost}兵力, ${data.goldLost}金币`;
      case 'caravan_visit':
        return `商队经过, 获得${data.goldGained}金币`;
      case 'refugee_arrival':
        return `流民涌入, 获得${data.troopsGained}兵力, 消耗${data.grainCost}粮草`;
      case 'trade_complete':
        return `贸易完成, 获得${data.goldGained}金币`;
      case 'morale_change':
        return `士气变化 ${(data.moraleChange as number) > 0 ? '+' : ''}${data.moraleChange}`;
      default:
        return '未知事件';
    }
  }

  // ── 序列化 ───────────────────────────────────

  serialize(): OfflineEventSaveData {
    return {
      lastOnlineTime: this.lastOnlineTime,
      pendingEvents: this.pendingEvents,
      version: SAVE_VERSION,
    };
  }

  deserialize(data: OfflineEventSaveData): void {
    if (!data) return;
    this.lastOnlineTime = data.lastOnlineTime || Date.now();
    this.pendingEvents = data.pendingEvents || [];
  }
}
