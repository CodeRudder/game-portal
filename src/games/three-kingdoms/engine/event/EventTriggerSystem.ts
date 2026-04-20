/**
 * 引擎层 — 事件触发系统
 *
 * 管理游戏事件的触发、生命周期和条件检查：
 *   - 事件类型矩阵（随机/固定/连锁）
 *   - 触发条件检查（概率/条件/前置事件）
 *   - 事件冷却管理
 *   - 活跃事件管理
 *   - 离线事件自动处理
 *
 * 功能覆盖：
 *   #21 事件类型矩阵
 *   #23 随机遭遇弹窗
 *   #24 离线事件处理
 *
 * @module engine/event/EventTriggerSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  GameEventId,
  GameEventDef,
  EventTriggerType,
  EventPriority,
  EventOption,
  EventOptionId,
  EventConsequence,
  ActiveGameEvent,
  OfflineEventResult,
  OfflineEventDetail,
  EventSystemState,
  EventSystemSaveData,
} from '../../core/events';
import {
  DEFAULT_EVENT_DEFS,
  GLOBAL_EVENT_COOLDOWN,
  MAX_EVENTS_PER_TURN,
  MAX_OFFLINE_EVENTS,
  EVENT_SYSTEM_SAVE_VERSION,
} from '../../core/events';

// ─────────────────────────────────────────────
// 事件触发系统
// ─────────────────────────────────────────────

/**
 * 事件触发系统
 *
 * 管理事件的触发条件检查和生命周期。
 * 支持随机/固定/连锁三种触发类型。
 */
export class EventTriggerSystem implements ISubsystem {
  readonly name = 'eventTrigger';

  private deps!: ISystemDeps;
  private eventDefs: Map<GameEventId, GameEventDef> = new Map();
  private activeEvents: Map<string, ActiveGameEvent> = new Map();
  private cooldowns: Map<GameEventId, number> = new Map();
  private completedEventIds: Set<GameEventId> = new Set();
  private instanceCounter = 0;
  private totalTriggered = 0;
  private totalCompleted = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadDefaultEvents();
  }

  update(_dt: number): void { /* 预留 */ }

  getState(): EventSystemState {
    return {
      activeEvents: this.getActiveEvents(),
      bannerQueue: {
        current: null,
        pending: [],
        expired: [],
      },
      cooldowns: this.getAllCooldowns(),
      totalTriggered: this.totalTriggered,
      totalCompleted: this.totalCompleted,
    };
  }

  reset(): void {
    this.activeEvents.clear();
    this.cooldowns.clear();
    this.completedEventIds.clear();
    this.instanceCounter = 0;
    this.totalTriggered = 0;
    this.totalCompleted = 0;
    this.loadDefaultEvents();
  }

  // ─── 事件定义管理 ──────────────────────────

  /** 加载默认事件定义 */
  private loadDefaultEvents(): void {
    this.eventDefs.clear();
    for (const [id, def] of Object.entries(DEFAULT_EVENT_DEFS)) {
      this.eventDefs.set(id, def);
    }
  }

  /** 注册自定义事件定义 */
  registerEventDef(def: GameEventDef): void {
    this.eventDefs.set(def.id, def);
  }

  /** 获取事件定义 */
  getEventDef(id: GameEventId): GameEventDef | null {
    return this.eventDefs.get(id) ?? null;
  }

  /** 获取所有事件定义 */
  getAllEventDefs(): GameEventDef[] {
    return Array.from(this.eventDefs.values());
  }

  /** 按触发类型获取事件定义 */
  getEventDefsByType(type: EventTriggerType): GameEventDef[] {
    return this.getAllEventDefs().filter(d => d.triggerType === type);
  }

  /** 按分类获取事件定义 */
  getEventDefsByCategory(category: string): GameEventDef[] {
    return this.getAllEventDefs().filter(d => d.category === category);
  }

  // ─── 事件触发（#21）──────────────────────────

  /**
   * 检查并触发本回合事件
   *
   * @param currentTurn - 当前回合
   * @param context - 触发上下文（用于条件检查）
   * @returns 触发的事件列表
   */
  checkAndTrigger(currentTurn: number, context?: EventTriggerContext): ActiveGameEvent[] {
    const triggered: ActiveGameEvent[] = [];
    let triggeredThisTurn = 0;

    // 检查全局冷却
    const lastGlobalTrigger = this.cooldowns.get('__global__') ?? 0;
    if (currentTurn - lastGlobalTrigger < GLOBAL_EVENT_COOLDOWN) {
      return triggered;
    }

    // 按优先级排序事件定义
    const sortedDefs = this.getSortedEventDefs();

    for (const def of sortedDefs) {
      if (triggeredThisTurn >= MAX_EVENTS_PER_TURN) break;
      if (!this.canTrigger(def, currentTurn, context)) continue;

      const event = this.createActiveEvent(def, currentTurn);
      if (event) {
        triggered.push(event);
        triggeredThisTurn++;

        // 设置冷却
        this.cooldowns.set(def.id, currentTurn + def.cooldownTurns);
        this.cooldowns.set('__global__', currentTurn + GLOBAL_EVENT_COOLDOWN);
        this.totalTriggered++;

        // 发出事件触发通知
        this.deps?.eventBus.emit('event:triggered', {
          eventId: def.id,
          eventName: def.name,
          instanceId: event.instanceId,
          category: def.category,
          priority: def.priority,
        });
      }
    }

    return triggered;
  }

  /**
   * 检查单个事件是否可以触发
   *
   * @param def - 事件定义
   * @param currentTurn - 当前回合
   * @param context - 触发上下文
   * @returns 是否可触发
   */
  canTrigger(def: GameEventDef, currentTurn: number, context?: EventTriggerContext): boolean {
    // 最低回合检查
    if (currentTurn < def.minTurn) return false;

    // 冷却检查
    const cooldownEnd = this.cooldowns.get(def.id) ?? 0;
    if (currentTurn < cooldownEnd) return false;

    // 已完成检查（固定事件只触发一次）
    if (def.triggerType === 'fixed' && this.completedEventIds.has(def.id)) return false;

    // 概率检查
    if (def.triggerType === 'random' && Math.random() > def.triggerProbability) return false;

    // 条件检查
    if (context) {
      if (!this.checkConditions(def, context)) return false;
    }

    // 持续事件检查（同类事件不可叠加）
    for (const active of this.activeEvents.values()) {
      if (active.eventId === def.id && active.status === 'active') return false;
    }

    return true;
  }

  // ─── 随机遭遇（#23）──────────────────────────

  /**
   * 选择事件选项
   *
   * @param instanceId - 事件实例ID
   * @param optionId - 选项ID
   * @returns 选择结果
   */
  selectOption(instanceId: string, optionId: EventOptionId): EventSelectResult {
    const event = this.activeEvents.get(instanceId);
    if (!event) {
      return { success: false, error: '事件实例不存在' };
    }

    if (event.status !== 'active') {
      return { success: false, error: '事件已处理' };
    }

    const option = event.options.find(o => o.id === optionId);
    if (!option) {
      return { success: false, error: '选项不存在' };
    }

    // 应用后果
    const consequences = [...option.consequences];
    event.selectedOptionId = optionId;
    event.appliedConsequences = consequences;
    event.status = 'completed';

    this.totalCompleted++;
    this.completedEventIds.add(event.eventId);

    // 发出事件完成通知
    this.deps?.eventBus.emit('event:completed', {
      eventId: event.eventId,
      eventName: event.name,
      instanceId,
      selectedOptionId: optionId,
      consequences,
    });

    return {
      success: true,
      consequences,
      event: { ...event },
    };
  }

  /**
   * 获取活跃事件
   */
  getActiveEvents(): ActiveGameEvent[] {
    return Array.from(this.activeEvents.values())
      .filter(e => e.status === 'active')
      .map(e => ({ ...e, options: [...e.options], appliedConsequences: [...e.appliedConsequences] }));
  }

  /**
   * 获取事件实例
   */
  getActiveEvent(instanceId: string): ActiveGameEvent | null {
    const event = this.activeEvents.get(instanceId);
    return event ? { ...event, options: [...event.options], appliedConsequences: [...event.appliedConsequences] } : null;
  }

  /**
   * 过期检查
   *
   * @param currentTurn - 当前回合
   * @returns 过期的事件列表
   */
  checkExpiry(currentTurn: number): ActiveGameEvent[] {
    const expired: ActiveGameEvent[] = [];

    for (const [id, event] of this.activeEvents) {
      if (event.status !== 'active') continue;
      if (event.expiresAtTurn > 0 && currentTurn >= event.expiresAtTurn) {
        event.status = 'expired';
        expired.push({ ...event });
      }
    }

    return expired;
  }

  // ─── 离线事件处理（#24）──────────────────────

  /**
   * 离线事件自动处理
   *
   * 对离线期间积累的事件进行自动处理：
   *   - 选择AI权重最高的选项
   *   - 应用后果
   *   - 生成处理报告
   *
   * @param offlineTurns - 离线回合数
   * @param currentTurn - 回归时的回合
   * @returns 离线处理结果
   */
  processOfflineEvents(offlineTurns: number, currentTurn: number): OfflineEventResult {
    const details: OfflineEventDetail[] = [];
    const totalResourceChanges: Record<string, number> = {};
    let processedCount = 0;

    // 模拟离线期间每回合的事件触发
    for (let i = 0; i < Math.min(offlineTurns, MAX_OFFLINE_EVENTS); i++) {
      const simTurn = currentTurn - offlineTurns + i;

      // 检查可触发事件
      const sortedDefs = this.getSortedEventDefs();
      for (const def of sortedDefs) {
        if (processedCount >= MAX_OFFLINE_EVENTS) break;
        if (!this.canTriggerForOffline(def, simTurn)) continue;

        // 选择AI权重最高的选项
        const bestOption = this.selectBestOptionForAI(def.options);
        if (!bestOption) continue;

        // 应用后果
        const consequences = [...bestOption.consequences];
        for (const c of consequences) {
          if (c.type === 'resource_change') {
            totalResourceChanges[c.target] = (totalResourceChanges[c.target] ?? 0) + c.value;
          }
        }

        details.push({
          eventName: def.name,
          selectedOptionText: bestOption.text,
          consequences,
        });

        processedCount++;
        this.cooldowns.set(def.id, simTurn + def.cooldownTurns);
        this.totalTriggered++;
        this.totalCompleted++;
        this.completedEventIds.add(def.id);

        break; // 每模拟回合最多处理1个事件
      }
    }

    return {
      processedCount,
      details,
      totalResourceChanges,
    };
  }

  // ─── 统计查询 ──────────────────────────────

  getTotalTriggered(): number { return this.totalTriggered; }
  getTotalCompleted(): number { return this.totalCompleted; }

  /** 获取所有冷却记录 */
  getAllCooldowns(): Record<GameEventId, number> {
    return Object.fromEntries(this.cooldowns);
  }

  /** 获取已完成事件ID列表 */
  getCompletedEventIds(): GameEventId[] {
    return Array.from(this.completedEventIds);
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): EventSystemSaveData {
    return {
      completedEventIds: Array.from(this.completedEventIds),
      cooldowns: Object.fromEntries(this.cooldowns),
      totalTriggered: this.totalTriggered,
      totalCompleted: this.totalCompleted,
      version: EVENT_SYSTEM_SAVE_VERSION,
    };
  }

  deserialize(data: EventSystemSaveData): void {
    this.completedEventIds = new Set(data.completedEventIds ?? []);
    this.cooldowns.clear();
    if (data.cooldowns) {
      for (const [id, turn] of Object.entries(data.cooldowns)) {
        this.cooldowns.set(id, turn);
      }
    }
    this.totalTriggered = data.totalTriggered ?? 0;
    this.totalCompleted = data.totalCompleted ?? 0;
    this.activeEvents.clear();
  }

  // ─── 内部方法 ──────────────────────────────

  /** 创建活跃事件实例 */
  private createActiveEvent(def: GameEventDef, currentTurn: number): ActiveGameEvent | null {
    this.instanceCounter++;
    const instanceId = `evt-instance-${this.instanceCounter}-${Date.now()}`;

    const event: ActiveGameEvent = {
      instanceId,
      eventId: def.id,
      name: def.name,
      description: def.description,
      triggerType: def.triggerType,
      category: def.category,
      priority: def.priority,
      status: 'active',
      options: def.options.map(o => ({ ...o, consequences: [...o.consequences] })),
      triggeredAtTurn: currentTurn,
      expiresAtTurn: def.durationTurns > 0 ? currentTurn + def.durationTurns : 0,
      selectedOptionId: null,
      appliedConsequences: [],
    };

    this.activeEvents.set(instanceId, event);
    return { ...event };
  }

  /** 按优先级排序事件定义 */
  private getSortedEventDefs(): GameEventDef[] {
    const priorityOrder: Record<EventPriority, number> = {
      urgent: 4, high: 3, normal: 2, low: 1,
    };
    return this.getAllEventDefs().sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority],
    );
  }

  /** 检查事件条件 */
  private checkConditions(def: GameEventDef, context: EventTriggerContext): boolean {
    // 固定事件需要特定条件
    if (def.triggerType === 'fixed') {
      if (def.id === 'evt-hulao-pass' && !context.territoriesOwned?.includes('pass-hulao-adjacent')) {
        return false;
      }
    }

    // 连锁事件需要前置事件完成
    if (def.triggerType === 'chain') {
      // 简化：连锁事件的前置条件通过 completedEventIds 检查
      // 实际可扩展为 def.prerequisiteEventId
    }

    return true;
  }

  /** 离线触发检查（简化版概率检查） */
  private canTriggerForOffline(def: GameEventDef, turn: number): boolean {
    if (turn < def.minTurn) return false;
    if (def.triggerType === 'fixed' && this.completedEventIds.has(def.id)) return false;
    if (!def.offlineProcessable) return false;

    const cooldownEnd = this.cooldowns.get(def.id) ?? 0;
    if (turn < cooldownEnd) return false;

    // 离线使用固定概率（不使用 Math.random）
    return def.triggerProbability >= 0.1;
  }

  /** AI选择最优选项 */
  private selectBestOptionForAI(options: EventOption[]): EventOption | null {
    if (options.length === 0) return null;

    // 优先选择默认选项
    const defaultOpt = options.find(o => o.isDefault);
    if (defaultOpt) return defaultOpt;

    // 按AI权重降序排列
    const sorted = [...options].sort((a, b) => b.aiWeight - a.aiWeight);
    return sorted[0] ?? null;
  }
}

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 事件触发上下文 */
export interface EventTriggerContext {
  /** 已占领领土列表 */
  territoriesOwned?: string[];
  /** 玩家等级 */
  playerLevel?: number;
  /** 当前资源 */
  resources?: Record<string, number>;
  /** 已完成事件ID列表 */
  completedEvents?: string[];
}

/** 事件选择结果 */
export interface EventSelectResult {
  success: boolean;
  consequences?: EventConsequence[];
  event?: ActiveGameEvent;
  error?: string;
}
