/**
 * 地图事件系统 — 引擎层核心逻辑
 *
 * 管理世界地图上的随机事件触发、选择分支和奖励发放。
 * 覆盖PRD MAP-5 §8.5 的引擎层功能：
 * - 事件触发（每小时10%概率，最多3个未处理事件）
 * - 事件类型（流寇入侵/商队经过/天灾降临/遗迹发现/阵营冲突）
 * - 选择分支（强攻/谈判/忽略）
 * - 战斗类事件可触发战斗结算
 * - 事件超时自动消失
 *
 * @module engine/map/MapEventSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import { EVENT_TYPE_CONFIGS } from './map-event-config';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 地图事件类型 */
export type MapEventType =
  | 'bandit'       // 流寇入侵
  | 'caravan'      // 商队经过
  | 'disaster'     // 天灾降临
  | 'ruins'        // 遗迹发现
  | 'conflict';    // 阵营冲突

/** 事件选择分支 */
export type MapEventChoice =
  | 'attack'       // 强攻
  | 'negotiate'    // 谈判
  | 'ignore';      // 忽略

/** 事件状态 */
export type MapEventStatus = 'active' | 'resolved' | 'expired';

/** 事件奖励 */
export interface MapEventReward {
  type: string;
  amount: number;
}

/** 地图事件实例 */
export interface MapEventInstance {
  /** 事件唯一ID */
  id: string;
  /** 事件类型 */
  eventType: MapEventType;
  /** 事件名称 */
  name: string;
  /** 事件描述 */
  description: string;
  /** 事件状态 */
  status: MapEventStatus;
  /** 可选分支 */
  choices: MapEventChoice[];
  /** 是否为战斗类事件 */
  isCombat: boolean;
  /** 创建时间戳(ms) */
  createdAt: number;
  /** 过期时间戳(ms)，null表示不过期 */
  expiresAt: number | null;
  /** 事件位置（地图坐标） */
  position: { x: number; y: number } | null;
}

/** 事件解决结果 */
export interface MapEventResolution {
  /** 事件ID */
  eventId: string;
  /** 选择分支 */
  choice: MapEventChoice;
  /** 是否成功 */
  success: boolean;
  /** 获得的奖励 */
  rewards: MapEventReward[];
  /** 是否触发了战斗（强攻战斗类事件时） */
  triggeredBattle: boolean;
}

/** 事件类型配置 */
export interface MapEventTypeConfig {
  type: MapEventType;
  name: string;
  description: string;
  isCombat: boolean;
  choices: MapEventChoice[];
  /** 触发概率权重 */
  weight: number;
  /** 持续时间(ms) */
  duration: number;
  /** 强攻奖励（高风险高回报） */
  attackRewards: MapEventReward[];
  /** 谈判奖励（低风险中等回报） */
  negotiateRewards: MapEventReward[];
  /** 忽略奖励（无风险无回报） */
  ignoreRewards: MapEventReward[];
}

/** 地图事件系统状态 */
export interface MapEventState {
  /** 当前活跃事件 */
  activeEvents: MapEventInstance[];
  /** 已解决事件数 */
  resolvedCount: number;
  /** 上次触发检查时间 */
  lastCheckTime: number;
}

/** 地图事件系统存档数据 */
export interface MapEventSaveData {
  version: number;
  activeEvents: MapEventInstance[];
  resolvedCount: number;
  lastCheckTime: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大未处理事件数 */
const MAX_ACTIVE_EVENTS = 3;

/** 触发检查间隔（模拟1小时 = 3600000ms，测试时可覆盖） */
const DEFAULT_CHECK_INTERVAL = 3600000;

/** 基础触发概率（10%） */
const BASE_TRIGGER_CHANCE = 0.1;

/** 存档版本号 */
const SAVE_VERSION = 1;

/** 事件ID计数器前缀 */
let eventIdCounter = 0;

// ─────────────────────────────────────────────
// MapEventSystem
// ─────────────────────────────────────────────

/**
 * 地图事件系统
 *
 * 管理世界地图上的随机事件触发、选择分支和奖励发放。
 * 事件每小时有10%概率触发，最多同时存在3个未处理事件。
 *
 * @example
 * ```ts
 * const eventSystem = new MapEventSystem();
 * eventSystem.init(deps);
 *
 * // 检查并触发新事件
 * eventSystem.checkAndTrigger(Date.now());
 *
 * // 获取活跃事件
 * const events = eventSystem.getActiveEvents();
 *
 * // 解决事件（强攻流寇）
 * const result = eventSystem.resolveEvent(events[0].id, 'attack');
 * ```
 */
export class MapEventSystem implements ISubsystem {
  readonly name = 'mapEventSystem' as const;
  private sysDeps: ISystemDeps | null = null;

  /** 活跃事件列表 */
  private activeEvents: MapEventInstance[];
  /** 已解决事件计数 */
  private resolvedCount: number;
  /** 上次检查时间 */
  private lastCheckTime: number;
  /** 随机数生成器 */
  private readonly rng: () => number;
  /** 检查间隔(ms) */
  private readonly checkInterval: number;

  constructor(options?: { rng?: () => number; checkInterval?: number }) {
    this.activeEvents = [];
    this.resolvedCount = 0;
    this.lastCheckTime = 0;
    this.rng = options?.rng ?? Math.random;
    this.checkInterval = options?.checkInterval ?? DEFAULT_CHECK_INTERVAL;
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  update(_dt: number): void {
    // 事件驱动，不需要每帧更新
  }

  getState(): MapEventState {
    return {
      activeEvents: [...this.activeEvents],
      resolvedCount: this.resolvedCount,
      lastCheckTime: this.lastCheckTime,
    };
  }

  reset(): void {
    this.activeEvents = [];
    this.resolvedCount = 0;
    this.lastCheckTime = 0;
    eventIdCounter = 0;
  }

  // ── 事件触发 ──

  /**
   * 检查并触发新事件
   * 每个检查间隔有10%概率触发一个新事件
   * @param now 当前时间戳
   * @returns 新触发的事件，或null
   */
  checkAndTrigger(now: number): MapEventInstance | null {
    // 清理过期事件
    this.cleanExpiredEvents(now);

    // 检查是否达到最大事件数
    if (this.activeEvents.length >= MAX_ACTIVE_EVENTS) {
      return null;
    }

    // 检查是否过了检查间隔
    if (this.lastCheckTime > 0 && now - this.lastCheckTime < this.checkInterval) {
      return null;
    }

    this.lastCheckTime = now;

    // 10%概率触发
    if (this.rng() > BASE_TRIGGER_CHANCE) {
      return null;
    }

    return this.createRandomEvent(now);
  }

  /**
   * 强制触发一个指定类型的事件（测试用）
   */
  forceTrigger(eventType: MapEventType, now: number = Date.now()): MapEventInstance {
    const config = EVENT_TYPE_CONFIGS.find(c => c.type === eventType);
    if (!config) throw new Error(`Unknown event type: ${eventType}`);
    // 清理过期事件
    this.cleanExpiredEvents(now);
    // 检查是否达到最大事件数，达到则返回最后一个事件（不创建新事件）
    if (this.activeEvents.length >= MAX_ACTIVE_EVENTS) {
      return this.activeEvents[this.activeEvents.length - 1];
    }
    return this.createEvent(config, now);
  }

  /**
   * 创建随机事件
   */
  private createRandomEvent(now: number): MapEventInstance {
    // 按权重随机选择事件类型
    const totalWeight = EVENT_TYPE_CONFIGS.reduce((sum, c) => sum + c.weight, 0);
    let roll = this.rng() * totalWeight;

    let selectedConfig = EVENT_TYPE_CONFIGS[0];
    for (const config of EVENT_TYPE_CONFIGS) {
      roll -= config.weight;
      if (roll <= 0) {
        selectedConfig = config;
        break;
      }
    }

    return this.createEvent(selectedConfig, now);
  }

  /**
   * 创建指定类型的事件实例
   */
  private createEvent(config: MapEventTypeConfig, now: number): MapEventInstance {
    eventIdCounter++;
    const event: MapEventInstance = {
      id: `map_event_${eventIdCounter}`,
      eventType: config.type,
      name: config.name,
      description: config.description,
      status: 'active',
      choices: [...config.choices],
      isCombat: config.isCombat,
      createdAt: now,
      expiresAt: config.duration > 0 ? now + config.duration : null,
      position: null,
    };

    this.activeEvents.push(event);
    return event;
  }

  // ── 事件查询 ──

  /** 获取所有活跃事件 */
  getActiveEvents(): MapEventInstance[] {
    return [...this.activeEvents];
  }

  /** 获取活跃事件数量 */
  getActiveEventCount(): number {
    return this.activeEvents.length;
  }

  /** 根据ID获取事件 */
  getEventById(id: string): MapEventInstance | undefined {
    return this.activeEvents.find(e => e.id === id);
  }

  /** 按类型过滤活跃事件 */
  getEventsByType(type: MapEventType): MapEventInstance[] {
    return this.activeEvents.filter(e => e.eventType === type);
  }

  /** 获取已解决事件总数 */
  getResolvedCount(): number {
    return this.resolvedCount;
  }

  /** 获取事件类型配置表 */
  static getEventTypeConfigs(): ReadonlyArray<MapEventTypeConfig> {
    return EVENT_TYPE_CONFIGS;
  }

  // ── 事件解决 ──

  /**
   * 解决事件
   * @param eventId 事件ID
   * @param choice 选择分支
   * @returns 解决结果
   */
  resolveEvent(eventId: string, choice: MapEventChoice): MapEventResolution {
    const eventIndex = this.activeEvents.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      return {
        eventId,
        choice,
        success: false,
        rewards: [],
        triggeredBattle: false,
      };
    }

    const event = this.activeEvents[eventIndex];
    const config = EVENT_TYPE_CONFIGS.find(c => c.type === event.eventType);

    // 从活跃列表中移除
    this.activeEvents.splice(eventIndex, 1);
    this.resolvedCount++;

    // 计算奖励
    let rewards: MapEventReward[] = [];
    let triggeredBattle = false;

    if (config) {
      switch (choice) {
        case 'attack':
          rewards = [...config.attackRewards];
          // 战斗类事件的强攻会触发战斗
          triggeredBattle = event.isCombat;
          break;
        case 'negotiate':
          rewards = [...config.negotiateRewards];
          break;
        case 'ignore':
          rewards = [...config.ignoreRewards];
          break;
      }
    }

    return {
      eventId,
      choice,
      success: true,
      rewards,
      triggeredBattle,
    };
  }

  // ── 过期处理 ──

  /**
   * 清理过期事件
   * 过期事件自动消失，无惩罚
   */
  cleanExpiredEvents(now: number): number {
    const before = this.activeEvents.length;
    this.activeEvents = this.activeEvents.filter(e => {
      if (e.expiresAt !== null && now >= e.expiresAt) {
        return false; // 过期移除
      }
      return true;
    });
    return before - this.activeEvents.length;
  }

  // ── 存档 ──

  /** 序列化 */
  serialize(): MapEventSaveData {
    return {
      version: SAVE_VERSION,
      activeEvents: [...this.activeEvents],
      resolvedCount: this.resolvedCount,
      lastCheckTime: this.lastCheckTime,
    };
  }

  /** 反序列化 */
  deserialize(data: MapEventSaveData): void {
    if (!data || data.version !== SAVE_VERSION) return;
    this.activeEvents = [...data.activeEvents];
    this.resolvedCount = data.resolvedCount;
    this.lastCheckTime = data.lastCheckTime;
  }
}
