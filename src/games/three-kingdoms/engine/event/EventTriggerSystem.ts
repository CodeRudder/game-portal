/**
 * 引擎层 — 事件触发系统
 * 随机/固定/连锁三类事件的注册、触发、选择、过期、序列化
 * #21 事件类型矩阵 #23 随机遭遇弹窗(触发部分)
 * @module engine/event/EventTriggerSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EventId, EventDef, EventInstance, EventTriggerType,
  EventTriggerResult, EventChoiceResult, EventCondition,
  EventSystemSaveData, EventTriggerConfig,
} from '../../core/event';
import type {
  ProbabilityCondition, ProbabilityModifier, ProbabilityResult,
  TimeCondition, StateCondition,
} from '../../core/event/event-encounter.types';
import {
  DEFAULT_EVENT_TRIGGER_CONFIG, PREDEFINED_EVENTS,
} from '../../core/event';
import {
  evaluateCondition,
  type CompletedEventChecker,
} from './EventTriggerConditions';
import { calculateProbability } from './EventProbabilityCalculator';
import {
  serializeEventTriggerState,
  deserializeEventTriggerState,
} from './EventTriggerSerialization';
import {
  resolveEvent as resolveEventLifecycle,
  expireEvents as expireEventsLifecycle,
  type EventLifecycleState,
} from './EventTriggerLifecycle';
import {
  triggerEventLogic,
  checkFixedConditions as checkFixedConditionsHelper,
  checkChainPrerequisites as checkChainPrerequisitesHelper,
  checkAndTriggerEventsLogic,
} from './EventTriggerSystem.helpers';

const ABSOLUTE_MAX_EVENTS = 20;

/** 管理随机/固定/连锁三类事件的注册、触发和选择 */
export class EventTriggerSystem implements ISubsystem {
  readonly name = 'eventTrigger';

  private deps!: ISystemDeps;
  private config: EventTriggerConfig = { ...DEFAULT_EVENT_TRIGGER_CONFIG };
  private eventDefs: Map<EventId, EventDef> = new Map();
  private activeEvents: Map<string, EventInstance> = new Map();
  private completedEventIds: Set<EventId> = new Set();
  private cooldowns: Map<EventId, number> = new Map();
  private instanceCounter = 0;
  /** 概率条件注册表（v15 迁移） */
  private probabilityConditions: Map<EventId, ProbabilityCondition> = new Map();
  /** 当前游戏回合（供条件评估使用） */
  private _currentTurn = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadPredefinedEvents();
  }

  update(_dt: number): void {
    // 预留：回合更新在 tick 方法中执行
  }

  getState() {
    return {
      eventDefs: new Map(this.eventDefs),
      activeEvents: this.getActiveEvents(),
      completedEventIds: new Set(this.completedEventIds),
    };
  }

  reset(): void {
    this.activeEvents.clear();
    this.completedEventIds.clear();
    this.cooldowns.clear();
    this.probabilityConditions.clear();
    this._currentTurn = 0;
    this.instanceCounter = 0;
    this.config = { ...DEFAULT_EVENT_TRIGGER_CONFIG };
  }

  // ─── 事件注册 ────────────────────────────

  /**
   * 注册事件定义
   *
   * @param def - 事件定义
   */
  registerEvent(def: EventDef): void {
    this.eventDefs.set(def.id, def);
  }

  /**
   * 批量注册事件定义
   *
   * @param defs - 事件定义数组
   */
  registerEvents(defs: EventDef[]): void {
    for (const def of defs) {
      this.registerEvent(def);
    }
  }

  /**
   * 获取事件定义
   *
   * @param id - 事件ID
   * @returns 事件定义，不存在返回undefined
   */
  getEventDef(id: EventId): EventDef | undefined {
    return this.eventDefs.get(id);
  }

  /**
   * 获取所有事件定义
   *
   * @returns 事件定义列表
   */
  getAllEventDefs(): EventDef[] {
    return Array.from(this.eventDefs.values());
  }

  /**
   * 按触发类型获取事件定义
   *
   * @param triggerType - 触发类型
   * @returns 事件定义列表
   */
  getEventDefsByType(triggerType: EventTriggerType): EventDef[] {
    return this.getAllEventDefs().filter((d) => d.triggerType === triggerType);
  }

  // ─── 事件触发判定（#21）───────────────────────

  /**
   * 每回合事件触发检查
   */
  checkAndTriggerEvents(currentTurn: number): EventInstance[] {
    this._currentTurn = currentTurn;
    const counterRef = { value: this.instanceCounter };
    const result = checkAndTriggerEventsLogic({
      eventDefs: this.eventDefs,
      activeEvents: this.activeEvents,
      completedEventIds: this.completedEventIds,
      cooldowns: this.cooldowns,
      config: this.config,
      instanceCounter: counterRef,
      deps: this.deps,
      canTrigger: (id: EventId, turn: number) => this.canTrigger(id, turn),
      getEventDefsByType: (type: string) => this.getEventDefsByType(type as EventTriggerType),
      probabilityConditions: this.probabilityConditions,
      calculateProbability: (cond: ProbabilityCondition) => this.calculateProbability(cond),
      tickCooldowns: (turn: number) => this.tickCooldowns(turn),
    }, currentTurn);
    // 同步 counter：内部可能通过 triggerEventLogic 递增了 counterRef.value
    this.instanceCounter = counterRef.value;
    return result;
  }

  /**
   * 强制触发指定事件（测试用）
   *
   * @param eventId - 事件ID
   * @param currentTurn - 当前回合
   * @returns 触发结果
   */
  forceTriggerEvent(eventId: EventId, currentTurn: number): EventTriggerResult {
    return this.triggerEvent(eventId, currentTurn, true);
  }

  // ─── 概率计算（v15 迁移）──────────────────────

  /**
   * 计算最终触发概率
   * 公式：P = clamp(base + Σ(active_additive) × Π(active_multiplicative), 0, 1)
   *
   * @param probCondition - 概率条件（含基础概率和修正因子）
   * @returns 概率计算结果
   */
  calculateProbability(probCondition: ProbabilityCondition): ProbabilityResult {
    return calculateProbability(probCondition);
  }

  /**
   * 注册概率条件（为指定事件绑定高级概率公式）
   *
   * @param eventId - 事件ID
   * @param condition - 概率条件
   */
  registerProbabilityCondition(eventId: EventId, condition: ProbabilityCondition): void {
    this.probabilityConditions.set(eventId, condition);
  }

  /**
   * 获取指定事件的概率条件
   *
   * @param eventId - 事件ID
   */
  getProbabilityCondition(eventId: EventId): ProbabilityCondition | undefined {
    return this.probabilityConditions.get(eventId);
  }

  /**
   * 检查事件是否可以触发
   *
   * @param eventId - 事件ID
   * @param currentTurn - 当前回合
   * @returns 是否可以触发
   */
  canTrigger(eventId: EventId, currentTurn: number): boolean {
    const def = this.eventDefs.get(eventId);
    if (!def) return false;

    // 已完成的事件不再触发（除非有冷却）
    if (this.completedEventIds.has(eventId)) return false;

    // 已有同类型活跃事件
    if (this.hasActiveEvent(eventId)) return false;

    // 冷却检查
    const cooldownEnd = this.cooldowns.get(eventId);
    if (cooldownEnd !== undefined && currentTurn < cooldownEnd) return false;

    // 活跃事件数上限
    if (this.activeEvents.size >= this.config.maxActiveEvents) return false;

    // 按类型检查
    switch (def.triggerType) {
      case 'fixed':
        return this.checkFixedConditions(def, currentTurn);
      case 'chain':
        return this.checkChainPrerequisites(def);
      case 'random':
        return true; // 概率判定在 checkAndTriggerEvents 中执行
      default:
        return false;
    }
  }

  // ─── 事件选择处理（#23）───────────────────────

  /** 处理事件选择（#23）— 委托给 EventTriggerLifecycle */
  resolveEvent(instanceId: string, optionId: string): EventChoiceResult | null {
    return resolveEventLifecycle(instanceId, optionId, this.getLifecycleState(), this.deps);
  }

  // ─── 活跃事件管理 ──────────────────────────

  getActiveEvents(): EventInstance[] {
    return Array.from(this.activeEvents.values());
  }

  hasActiveEvent(eventDefId: EventId): boolean {
    for (const inst of this.activeEvents.values()) {
      if (inst.eventDefId === eventDefId) return true;
    }
    return false;
  }

  getInstance(instanceId: string): EventInstance | undefined {
    return this.activeEvents.get(instanceId);
  }

  getActiveEventCount(): number {
    return this.activeEvents.size;
  }

  isEventCompleted(eventId: EventId): boolean {
    return this.completedEventIds.has(eventId);
  }

  getCompletedEventIds(): EventId[] {
    return Array.from(this.completedEventIds);
  }

  // ─── 过期处理 ──────────────────────────────

  /** 处理过期事件 — 委托给 EventTriggerLifecycle */
  expireEvents(currentTurn: number): EventInstance[] {
    return expireEventsLifecycle(currentTurn, this.getLifecycleState(), this.deps);
  }

  // ─── 配置 ──────────────────────────────────

  /** 获取配置 */
  getConfig(): EventTriggerConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  setConfig(config: Partial<EventTriggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): EventSystemSaveData {
    return serializeEventTriggerState({
      activeEvents: this.activeEvents,
      completedEventIds: this.completedEventIds,
      cooldowns: this.cooldowns,
    });
  }

  deserialize(data: EventSystemSaveData): void {
    const restored = deserializeEventTriggerState(data);
    this.activeEvents.clear();
    for (const [k, v] of restored.activeEvents) {
      this.activeEvents.set(k, v);
    }

    this.completedEventIds.clear();
    for (const id of restored.completedEventIds) {
      this.completedEventIds.add(id);
    }

    this.cooldowns.clear();
    for (const [k, v] of restored.cooldowns) {
      this.cooldowns.set(k, v);
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /** 获取生命周期操作所需的状态引用 */
  private getLifecycleState(): EventLifecycleState {
    return {
      activeEvents: this.activeEvents,
      completedEventIds: this.completedEventIds,
      cooldowns: this.cooldowns,
      eventDefs: this.eventDefs,
    };
  }

  /** 加载预定义事件 */
  private loadPredefinedEvents(): void {
    for (const def of Object.values(PREDEFINED_EVENTS)) {
      this.eventDefs.set(def.id, def);
    }
  }

  /** 清理已过期的冷却 */
  private tickCooldowns(currentTurn: number): void {
    for (const [eventId, endTurn] of this.cooldowns) {
      if (currentTurn >= endTurn) {
        this.cooldowns.delete(eventId);
      }
    }
  }

  /** 触发事件 */
  private triggerEvent(eventId: EventId, currentTurn: number, force = false): EventTriggerResult {
    const counterRef = { value: this.instanceCounter };
    const result = triggerEventLogic(eventId, currentTurn, {
      eventDefs: this.eventDefs,
      activeEvents: this.activeEvents,
      completedEventIds: this.completedEventIds,
      cooldowns: this.cooldowns,
      config: this.config,
      instanceCounter: counterRef,
      deps: this.deps,
      canTrigger: (id, turn) => this.canTrigger(id, turn),
    }, force);
    // 同步 counter：triggerEventLogic 内部 createEventInstance 会递增 counterRef.value
    this.instanceCounter = counterRef.value;
    return result;
  }

  /** 创建事件实例 */
  private createInstance(def: EventDef, currentTurn: number): EventInstance {
    this.instanceCounter++;
    const expireTurn = def.expireAfterTurns != null
      ? currentTurn + def.expireAfterTurns
      : null;

    return {
      instanceId: `event-inst-${this.instanceCounter}`,
      eventDefId: def.id,
      triggeredTurn: currentTurn,
      expireTurn,
      status: 'active',
    };
  }

  /** 检查固定事件条件 */
  private checkFixedConditions(def: EventDef, currentTurn: number): boolean {
    return checkFixedConditionsHelper(def, currentTurn, this.completedEventIds);
  }

  /** 检查连锁事件前置条件 */
  private checkChainPrerequisites(def: EventDef): boolean {
    return checkChainPrerequisitesHelper(def, this.completedEventIds);
  }
}
