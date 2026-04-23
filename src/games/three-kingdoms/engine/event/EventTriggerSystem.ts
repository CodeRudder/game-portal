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
   *
   * 检查所有事件是否满足触发条件，生成触发结果。
   *
   * @param currentTurn - 当前回合
   * @returns 触发的事件实例列表
   */
  checkAndTriggerEvents(currentTurn: number): EventInstance[] {
    this._currentTurn = currentTurn;
    const triggered: EventInstance[] = [];

    // 检查冷却
    this.tickCooldowns(currentTurn);

    // 1. 检查固定事件（条件触发）
    const fixedEvents = this.getEventDefsByType('fixed');
    for (const def of fixedEvents) {
      if (this.canTrigger(def.id, currentTurn)) {
        const result = this.triggerEvent(def.id, currentTurn);
        if (result.triggered && result.instance) {
          triggered.push(result.instance);
        }
      }
    }

    // 2. 检查连锁事件（前置事件完成触发）
    const chainEvents = this.getEventDefsByType('chain');
    for (const def of chainEvents) {
      if (this.canTrigger(def.id, currentTurn)) {
        const result = this.triggerEvent(def.id, currentTurn);
        if (result.triggered && result.instance) {
          triggered.push(result.instance);
        }
      }
    }

    // 3. 检查随机事件（概率触发）
    const randomEvents = this.getEventDefsByType('random');
    for (const def of randomEvents) {
      if (this.canTrigger(def.id, currentTurn)) {
        // 优先使用概率公式，否则回退到简单概率判定
        const probCondition = this.probabilityConditions.get(def.id);
        if (probCondition) {
          const probResult = this.calculateProbability(probCondition);
          if (!probResult.triggered) continue;
        } else {
          const probability = def.triggerProbability ?? this.config.randomEventProbability;
          if (Math.random() >= probability) continue;
        }

        const result = this.triggerEvent(def.id, currentTurn);
        if (result.triggered && result.instance) {
          triggered.push(result.instance);
        }
      }
    }

    return triggered;
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

  /**
   * 获取所有活跃事件
   */
  getActiveEvents(): EventInstance[] {
    return Array.from(this.activeEvents.values());
  }

  /**
   * 检查是否有活跃事件
   *
   * @param eventDefId - 事件定义ID
   */
  hasActiveEvent(eventDefId: EventId): boolean {
    for (const inst of this.activeEvents.values()) {
      if (inst.eventDefId === eventDefId) return true;
    }
    return false;
  }

  /**
   * 获取事件实例
   *
   * @param instanceId - 实例ID
   */
  getInstance(instanceId: string): EventInstance | undefined {
    return this.activeEvents.get(instanceId);
  }

  /**
   * 获取活跃事件数量
   */
  getActiveEventCount(): number {
    return this.activeEvents.size;
  }

  /**
   * 检查事件是否已完成
   *
   * @param eventId - 事件ID
   */
  isEventCompleted(eventId: EventId): boolean {
    return this.completedEventIds.has(eventId);
  }

  /**
   * 获取所有已完成事件ID
   */
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

  /** 触发事件 */
  private triggerEvent(eventId: EventId, currentTurn: number, force = false): EventTriggerResult {
    const def = this.eventDefs.get(eventId);
    if (!def) {
      return { triggered: false, reason: `事件 ${eventId} 不存在` };
    }

    // 已有同类型活跃事件时不可重复触发（即使 force）
    if (this.hasActiveEvent(eventId)) {
      return { triggered: false, reason: `事件 ${eventId} 已有活跃实例` };
    }

    if (!force && !this.canTrigger(eventId, currentTurn)) {
      return { triggered: false, reason: `事件 ${eventId} 不满足触发条件` };
    }

    // 创建实例
    const instance = this.createInstance(def, currentTurn);

    // 添加到活跃列表
    this.activeEvents.set(instance.instanceId, instance);

    // 发出事件
    this.deps?.eventBus.emit('event:triggered', {
      instanceId: instance.instanceId,
      eventDefId: def.id,
      title: def.title,
      urgency: def.urgency,
    });

    return { triggered: true, instance };
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

  /** 检查固定事件条件 — 委托给 EventTriggerConditions */
  private checkFixedConditions(def: EventDef, currentTurn: number): boolean {
    if (!def.triggerConditions || def.triggerConditions.length === 0) {
      return true;
    }

    // 所有条件必须满足（AND 逻辑）
    const completedChecker: CompletedEventChecker = (id) => this.completedEventIds.has(id);
    for (const cond of def.triggerConditions) {
      if (!evaluateCondition(cond, currentTurn, undefined, completedChecker)) {
        return false;
      }
    }

    return true;
  }

  /** 检查连锁事件前置条件 */
  private checkChainPrerequisites(def: EventDef): boolean {
    if (!def.prerequisiteEventIds || def.prerequisiteEventIds.length === 0) {
      return true;
    }

    return def.prerequisiteEventIds.every((id) => this.completedEventIds.has(id));
  }

  /** 处理冷却 */
  private tickCooldowns(_currentTurn: number): void {
    // 冷却检查在 canTrigger 中处理
  }

  /** 生成唯一ID */
  private generateInstanceId(): string {
    this.instanceCounter++;
    return `event-inst-${this.instanceCounter}`;
  }
}
