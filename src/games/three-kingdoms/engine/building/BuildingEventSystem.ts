/**
 * 建筑域 — 建筑事件系统
 *
 * 职责：建筑随机事件触发 + 结算 + 冷却管理
 * - 登录时首次100%触发，非首次30%概率触发
 * - 玩家选择即时收益或持续收益
 * - 24h冷却期内同一建筑不可再次触发
 * - 气泡状态：none / calm(0~2h) / urgent(2h+)
 *
 * 独立于现有 EventTriggerSystem
 *
 * @module engine/building/BuildingEventSystem
 */

import {
  BUILDING_EVENT_DEFS,
  getEventsByBuildingType,
  getEventBuildingTypes,
  type BuildingEventDef,
  type BuildingEventOption,
  type EventReward,
} from './building-event-config';

// ─────────────────────────────────────────────
// 运行时类型
// ─────────────────────────────────────────────

/** 持续加成实例 */
export interface SustainedBonus {
  buffType: string;
  multiplier: number;
  remainingMs: number;
  buildingType: string;
  eventId: string;
}

/** 活跃事件实例 */
export interface BuildingEvent {
  uid: string;
  eventId: string;
  buildingType: string;
  def: BuildingEventDef;
  triggeredAt: number;
}

/** 事件结算结果 */
export interface EventResolveResult {
  success: boolean;
  reward?: EventReward;
  reason?: string;
}

/** 气泡状态 */
export type BubbleState = 'none' | 'calm' | 'urgent';

/** 序列化数据 */
export interface BuildingEventSaveData {
  version: number;
  cooldowns: Record<string, number>;
  pendingEvent: BuildingEvent | null;
  sustainedBonuses: SustainedBonus[];
}

/** 获取建筑等级回调 */
export type GetBuildingLevelsFn = () => Record<string, number>;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24小时
const CALM_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2小时 — 平静→紧迫阈值
const NON_FIRST_LOGIN_RATE = 0.30; // 非首次登录30%概率

// ─────────────────────────────────────────────
// BuildingEventSystem 类
// ─────────────────────────────────────────────

export class BuildingEventSystem {
  private getBuildingLevels: GetBuildingLevelsFn | null = null;
  private cooldowns: Record<string, number> = {}; // buildingType → cooldownEndMs
  private pendingEvent: BuildingEvent | null = null;
  private sustainedBonuses: SustainedBonus[] = [];
  private uidCounter = 0;

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化系统
   * @param getBuildingLevels 返回所有建筑等级的回调
   */
  init(getBuildingLevels: GetBuildingLevelsFn): void {
    this.getBuildingLevels = getBuildingLevels;
  }

  // ─────────────────────────────────────────
  // 事件触发
  // ─────────────────────────────────────────

  /**
   * 登录时检查是否触发建筑事件
   *
   * @param isFirstLogin 是否首次登录 → 100%触发
   * @returns 触发的事件实例，或 null
   */
  checkTriggerOnLogin(isFirstLogin: boolean): BuildingEvent | null {
    if (!this.getBuildingLevels) return null;
    if (this.pendingEvent) return null;

    // 非首次登录：30%概率
    if (!isFirstLogin && Math.random() > NON_FIRST_LOGIN_RATE) {
      return null;
    }

    const levels = this.getBuildingLevels();
    const now = Date.now();

    // 筛选可用建筑：等级>0 且不在冷却中
    const available = getEventBuildingTypes().filter((type) => {
      const level = levels[type] ?? 0;
      if (level <= 0) return false;
      return now >= (this.cooldowns[type] ?? 0);
    });

    if (available.length === 0) return null;

    // 随机选建筑
    const buildingType = available[Math.floor(Math.random() * available.length)];

    // 随机选事件
    const pool = getEventsByBuildingType(buildingType);
    if (!pool || pool.length === 0) return null;
    const eventDef = pool[Math.floor(Math.random() * pool.length)];

    const event: BuildingEvent = {
      uid: `bld_evt_${++this.uidCounter}_${now}`,
      eventId: eventDef.id,
      buildingType,
      def: eventDef,
      triggeredAt: now,
    };

    this.pendingEvent = event;
    return event;
  }

  // ─────────────────────────────────────────
  // 事件结算
  // ─────────────────────────────────────────

  /**
   * 结算事件 — 玩家选择选项后调用
   *
   * @param eventId 事件实例 UID
   * @param optionId 选项 ID
   * @returns 结算结果
   */
  resolveEvent(eventId: string, optionId: string): EventResolveResult {
    if (!this.pendingEvent || this.pendingEvent.uid !== eventId) {
      return { success: false, reason: 'event_not_found' };
    }

    const option = this.pendingEvent.def.options.find((o) => o.id === optionId);
    if (!option) {
      return { success: false, reason: 'option_not_found' };
    }

    // 设置冷却
    const buildingType = this.pendingEvent.buildingType;
    this.cooldowns[buildingType] = Date.now() + COOLDOWN_MS;

    // 处理持续加成
    const reward = option.reward;
    if ('buffType' in reward) {
      const bonus: SustainedBonus = {
        buffType: reward.buffType,
        multiplier: reward.multiplier,
        remainingMs: reward.durationMs,
        buildingType,
        eventId: this.pendingEvent.eventId,
      };
      this.sustainedBonuses.push(bonus);
    }

    // 清除待处理事件
    this.pendingEvent = null;

    return { success: true, reward };
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /**
   * 获取当前活跃事件列表（含待处理事件）
   */
  getActiveEvents(): BuildingEvent[] {
    const events: BuildingEvent[] = [];
    if (this.pendingEvent) {
      events.push(this.pendingEvent);
    }
    return events;
  }

  /**
   * 获取各建筑冷却结束时间戳
   */
  getCooldowns(): Record<string, number> {
    return { ...this.cooldowns };
  }

  /**
   * 获取所有活跃持续加成
   */
  getActiveSustainedBonuses(): SustainedBonus[] {
    return this.sustainedBonuses.filter((b) => b.remainingMs > 0);
  }

  /**
   * 获取待处理事件
   */
  getPendingEvent(): BuildingEvent | null {
    return this.pendingEvent;
  }

  // ─────────────────────────────────────────
  // 冷却管理
  // ─────────────────────────────────────────

  /**
   * 推进冷却时间
   * @param deltaMs 毫秒增量
   */
  tickCooldowns(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const now = Date.now();
    for (const key of Object.keys(this.cooldowns)) {
      // 冷却时间戳不随tick变化，它们是绝对时间
      // 此方法用于测试中模拟时间流逝
      // 实际冷却判断基于 Date.now() 与 cooldowns[key] 比较
    }
  }

  /**
   * 检查建筑是否在冷却中
   */
  isOnCooldown(buildingType: string): boolean {
    const cooldownEnd = this.cooldowns[buildingType] ?? 0;
    return Date.now() < cooldownEnd;
  }

  /**
   * 获取冷却剩余时间（ms）
   */
  getCooldownRemaining(buildingType: string): number {
    const cooldownEnd = this.cooldowns[buildingType] ?? 0;
    return Math.max(0, cooldownEnd - Date.now());
  }

  // ─────────────────────────────────────────
  // 持续加成 tick
  // ─────────────────────────────────────────

  /**
   * 推进持续加成时间
   * @param deltaMs 毫秒增量
   */
  tickSustainedBonuses(deltaMs: number): void {
    if (deltaMs <= 0) return;
    for (let i = this.sustainedBonuses.length - 1; i >= 0; i--) {
      this.sustainedBonuses[i].remainingMs -= deltaMs;
      if (this.sustainedBonuses[i].remainingMs <= 0) {
        this.sustainedBonuses.splice(i, 1);
      }
    }
  }

  // ─────────────────────────────────────────
  // 气泡状态
  // ─────────────────────────────────────────

  /**
   * 获取建筑的气泡状态
   *
   * - none: 无事件 / 不在冷却中
   * - calm: 冷却中，0~2h（平静）
   * - urgent: 冷却中，2h+（紧迫）
   *
   * @param buildingType 建筑类型
   */
  getBubbleState(buildingType: string): BubbleState {
    const cooldownEnd = this.cooldowns[buildingType] ?? 0;
    const now = Date.now();

    if (now >= cooldownEnd) return 'none';

    const elapsed = cooldownEnd - now; // remaining cooldown
    const totalCooldown = COOLDOWN_MS;
    const elapsedSoFar = totalCooldown - elapsed;

    if (elapsedSoFar < CALM_THRESHOLD_MS) {
      return 'calm';
    }
    return 'urgent';
  }

  // ─────────────────────────────────────────
  // 事件池查询
  // ─────────────────────────────────────────

  /**
   * 获取建筑类型的事件池
   */
  getEventPool(buildingType: string): BuildingEventDef[] {
    return getEventsByBuildingType(buildingType);
  }

  /**
   * 获取所有支持事件的建筑类型
   */
  getEventBuildingTypes(): string[] {
    return getEventBuildingTypes();
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  serialize(): BuildingEventSaveData {
    return {
      version: 1,
      cooldowns: { ...this.cooldowns },
      pendingEvent: this.pendingEvent ? { ...this.pendingEvent } : null,
      sustainedBonuses: this.sustainedBonuses.map((b) => ({ ...b })),
    };
  }

  deserialize(data: BuildingEventSaveData): void {
    this.cooldowns = data.cooldowns ?? {};
    this.pendingEvent = data.pendingEvent ?? null;
    this.sustainedBonuses = (data.sustainedBonuses ?? []).map((b) => ({ ...b }));
  }

  reset(): void {
    this.cooldowns = {};
    this.pendingEvent = null;
    this.sustainedBonuses = [];
    this.uidCounter = 0;
    this.getBuildingLevels = null;
  }
}
