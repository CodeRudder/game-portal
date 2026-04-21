/**
 * 引擎层 — v15.0 事件引擎核心
 *
 * 统一管理事件触发、选项选择、权重计算、冷却管理。
 * 功能覆盖：
 *   - 5类事件分类（剧情/随机/触发/连锁/世界）
 *   - 事件权重与加权选择
 *   - 事件冷却管理
 *   - 条件触发评估
 *   - 多选项分支与概率加权
 *   - 选项结果处理
 *   - 活动事件绑定
 *   - 限时事件
 *
 * @module engine/event/EventEngine
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EventId,
  EventDef,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
  EventConsequence,
} from '../../core/event';
import type {
  EventCategory,
  EventWeight,
  EventWeightModifier,
  EventCooldown,
  ExtendedEventCondition,
  ConditionContext,
  WeightedSelectionResult,
  WeightedEventOption,
  OptionConsequence,
  OptionSelectionResult,
  ActivityEventBinding,
  TimedEventConfig,
  ActivityRewardLink,
  EventSaveDataV15,
} from '../../core/event/event-v15.types';

import { EVENT_CATEGORY_META } from '../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大活跃事件数 */
const MAX_ACTIVE_EVENTS = 20;

/** 默认权重 */
const DEFAULT_WEIGHT = 50;

/** 默认冷却回合 */
const DEFAULT_COOLDOWN_TURNS = 5;

// ─────────────────────────────────────────────
// 事件引擎核心
// ─────────────────────────────────────────────

/**
 * v15.0 事件引擎
 *
 * 统一管理事件分类、权重、冷却、触发和选项处理。
 */
export class EventEngine implements ISubsystem {
  readonly name = 'eventEngine';

  private deps!: ISystemDeps;
  private eventDefs: Map<EventId, EventDef> = new Map();
  private eventCategories: Map<EventId, EventCategory> = new Map();
  private eventWeights: Map<EventId, EventWeight> = new Map();
  private cooldowns: Map<EventId, EventCooldown> = new Map();
  private activeEvents: Map<string, EventInstance> = new Map();
  private completedEventIds: Set<EventId> = new Set();
  private activityBindings: Map<string, ActivityEventBinding> = new Map();
  private timedEvents: Map<EventId, TimedEventConfig> = new Map();
  private rewardLinks: Map<string, ActivityRewardLink> = new Map();
  private instanceCounter = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 事件引擎由 tick 驱动
  }

  getState() {
    return {
      eventDefs: new Map(this.eventDefs),
      categories: new Map(this.eventCategories),
      weights: new Map(this.eventWeights),
      cooldowns: new Map(this.cooldowns),
      activeEvents: this.getActiveEvents(),
      completedEventIds: new Set(this.completedEventIds),
      activityBindings: new Map(this.activityBindings),
      timedEvents: new Map(this.timedEvents),
    };
  }

  reset(): void {
    this.eventDefs.clear();
    this.eventCategories.clear();
    this.eventWeights.clear();
    this.cooldowns.clear();
    this.activeEvents.clear();
    this.completedEventIds.clear();
    this.activityBindings.clear();
    this.timedEvents.clear();
    this.rewardLinks.clear();
    this.instanceCounter = 0;
  }

  // ─── 事件注册 ────────────────────────────

  /**
   * 注册事件（带分类和权重）
   */
  registerEvent(def: EventDef, category: EventCategory, weight?: number): void {
    this.eventDefs.set(def.id, def);
    this.eventCategories.set(def.id, category);
    this.eventWeights.set(def.id, {
      eventDefId: def.id,
      baseWeight: weight ?? EVENT_CATEGORY_META[category].defaultWeight,
      currentWeight: weight ?? EVENT_CATEGORY_META[category].defaultWeight,
      modifiers: [],
    });
  }

  /** 批量注册 */
  registerEvents(events: Array<{ def: EventDef; category: EventCategory; weight?: number }>): void {
    for (const { def, category, weight } of events) {
      this.registerEvent(def, category, weight);
    }
  }

  /** 获取事件定义 */
  getEventDef(id: EventId): EventDef | undefined {
    return this.eventDefs.get(id);
  }

  /** 获取事件分类 */
  getEventCategory(id: EventId): EventCategory | undefined {
    return this.eventCategories.get(id);
  }

  /** 按分类获取事件 */
  getEventsByCategory(category: EventCategory): EventDef[] {
    const result: EventDef[] = [];
    for (const [id, cat] of this.eventCategories) {
      if (cat === category) {
        const def = this.eventDefs.get(id);
        if (def) result.push(def);
      }
    }
    return result;
  }

  /** 获取所有事件定义 */
  getAllEventDefs(): EventDef[] {
    return Array.from(this.eventDefs.values());
  }

  // ─── 权重管理 ──────────────────────────────

  /** 获取事件权重 */
  getEventWeight(eventDefId: EventId): EventWeight | undefined {
    return this.eventWeights.get(eventDefId);
  }

  /** 添加权重修正 */
  addWeightModifier(eventDefId: EventId, modifier: EventWeightModifier): void {
    const weight = this.eventWeights.get(eventDefId);
    if (!weight) return;

    weight.modifiers.push(modifier);
    this.recalculateWeight(weight);
  }

  /** 移除权重修正 */
  removeWeightModifier(eventDefId: EventId, source: string): void {
    const weight = this.eventWeights.get(eventDefId);
    if (!weight) return;

    weight.modifiers = weight.modifiers.filter(m => m.source !== source);
    this.recalculateWeight(weight);
  }

  /** 加权随机选择 */
  weightedSelect(eventDefIds: EventId[]): WeightedSelectionResult | null {
    if (eventDefIds.length === 0) return null;

    const candidates: Array<{ eventDefId: string; weight: number }> = [];
    let totalWeight = 0;

    for (const id of eventDefIds) {
      const w = this.eventWeights.get(id);
      const weight = w?.currentWeight ?? DEFAULT_WEIGHT;
      candidates.push({ eventDefId: id, weight });
      totalWeight += weight;
    }

    if (totalWeight <= 0) return null;

    let roll = Math.random() * totalWeight;
    let selectedId = candidates[0].eventDefId;

    for (const candidate of candidates) {
      roll -= candidate.weight;
      if (roll <= 0) {
        selectedId = candidate.eventDefId;
        break;
      }
    }

    return {
      eventDefId: selectedId,
      selectedWeight: candidates.find(c => c.eventDefId === selectedId)?.weight ?? 0,
      totalWeight,
      candidates,
    };
  }

  // ─── 冷却管理 ──────────────────────────────

  /** 检查是否在冷却中 */
  isOnCooldown(eventDefId: EventId, currentTurn: number): boolean {
    const cooldown = this.cooldowns.get(eventDefId);
    if (!cooldown) return false;
    return currentTurn < cooldown.endTurn;
  }

  /** 获取剩余冷却回合 */
  getCooldownRemaining(eventDefId: EventId, currentTurn: number): number {
    const cooldown = this.cooldowns.get(eventDefId);
    if (!cooldown) return 0;
    return Math.max(0, cooldown.endTurn - currentTurn);
  }

  /** 设置冷却 */
  setCooldown(eventDefId: EventId, startTurn: number, duration: number): void {
    this.cooldowns.set(eventDefId, {
      eventDefId,
      startTurn,
      endTurn: startTurn + duration,
      remainingTurns: duration,
    });
  }

  /** 清除冷却 */
  clearCooldown(eventDefId: EventId): void {
    this.cooldowns.delete(eventDefId);
  }

  /** 刷新所有冷却 */
  tickCooldowns(currentTurn: number): void {
    for (const [id, cooldown] of this.cooldowns) {
      cooldown.remainingTurns = Math.max(0, cooldown.endTurn - currentTurn);
      if (cooldown.remainingTurns <= 0) {
        this.cooldowns.delete(id);
      }
    }
  }

  // ─── 条件触发评估 ──────────────────────────

  /** 评估条件 */
  evaluateConditions(conditions: ExtendedEventCondition[], context: ConditionContext): boolean {
    if (conditions.length === 0) return true;

    for (const cond of conditions) {
      const result = this.evaluateSingleCondition(cond, context);
      if (result === (cond.negate ?? false)) {
        // 如果取反后与结果一致，说明条件不满足
        return false;
      }
    }
    return true;
  }

  // ─── 事件触发 ──────────────────────────────

  /** 检查是否可触发 */
  canTrigger(eventDefId: EventId, currentTurn: number, context?: ConditionContext): boolean {
    const def = this.eventDefs.get(eventDefId);
    if (!def) return false;
    if (this.completedEventIds.has(eventDefId)) return false;
    if (this.hasActiveEvent(eventDefId)) return false;
    if (this.isOnCooldown(eventDefId, currentTurn)) return false;
    if (this.activeEvents.size >= MAX_ACTIVE_EVENTS) return false;

    // 分类特定检查
    const category = this.eventCategories.get(eventDefId);
    if (category === 'triggered' && def.triggerConditions && context) {
      const extendedConds = def.triggerConditions as unknown as ExtendedEventCondition[];
      if (!this.evaluateConditions(extendedConds, context)) return false;
    }

    return true;
  }

  /** 触发事件 */
  triggerEvent(eventDefId: EventId, currentTurn: number, force = false): EventTriggerResult {
    const def = this.eventDefs.get(eventDefId);
    if (!def) return { triggered: false, reason: `事件 ${eventDefId} 不存在` };
    if (this.hasActiveEvent(eventDefId)) return { triggered: false, reason: '已有活跃实例' };
    if (!force && !this.canTrigger(eventDefId, currentTurn)) {
      return { triggered: false, reason: '不满足触发条件' };
    }

    const instance = this.createInstance(def, currentTurn);
    this.activeEvents.set(instance.instanceId, instance);

    this.deps?.eventBus.emit('event:triggered', {
      instanceId: instance.instanceId,
      eventDefId: def.id,
      category: this.eventCategories.get(def.id),
    });

    return { triggered: true, instance };
  }

  /** 按分类检查并触发 */
  checkAndTriggerByCategory(category: EventCategory, currentTurn: number, context?: ConditionContext): EventInstance[] {
    this.tickCooldowns(currentTurn);
    const triggered: EventInstance[] = [];
    const events = this.getEventsByCategory(category);

    for (const def of events) {
      if (this.canTrigger(def.id, currentTurn, context)) {
        if (category === 'random') {
          const probability = def.triggerProbability ?? 0.3;
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

  // ─── 选项处理 ──────────────────────────────

  /** 处理选项选择 */
  resolveEvent(instanceId: string, optionId: string): EventChoiceResult | null {
    const instance = this.activeEvents.get(instanceId);
    if (!instance || instance.status !== 'active') return null;

    const def = this.eventDefs.get(instance.eventDefId);
    if (!def) return null;

    const option = def.options.find(o => o.id === optionId);
    if (!option) return null;

    instance.status = 'resolved';
    this.completedEventIds.add(instance.eventDefId);

    // 设置冷却
    const cooldownTurns = def.cooldownTurns ?? DEFAULT_COOLDOWN_TURNS;
    this.setCooldown(instance.eventDefId, instance.triggeredTurn, cooldownTurns);

    this.activeEvents.delete(instanceId);

    // 检查活动奖励联动
    const enhancedConsequences = this.applyRewardLinks(
      instance.eventDefId, option.consequences,
    );

    this.deps?.eventBus.emit('event:resolved', {
      instanceId,
      eventDefId: instance.eventDefId,
      optionId,
      consequences: enhancedConsequences,
    });

    return {
      instanceId,
      optionId,
      consequences: enhancedConsequences,
      chainEventId: enhancedConsequences.triggerEventId,
    };
  }

  /** 按权重自动选择选项 */
  autoSelectOption(instanceId: string): OptionSelectionResult | null {
    const instance = this.activeEvents.get(instanceId);
    if (!instance) return null;

    const def = this.eventDefs.get(instance.eventDefId);
    if (!def) return null;

    // 将普通选项转为加权选项
    const weightedOptions: WeightedEventOption[] = def.options.map(o => ({
      id: o.id,
      text: o.text,
      description: o.description,
      weight: o.isDefault ? 60 : 40,
      consequences: {
        description: o.consequences.description,
        resourceChanges: o.consequences.resourceChanges,
        affinityChanges: o.consequences.affinityChanges,
        triggerEventId: o.consequences.triggerEventId,
        unlockIds: o.consequences.unlockIds,
      },
    }));

    if (weightedOptions.length === 0) return null;

    const selection = this.selectWeightedOption(weightedOptions);
    if (!selection) return null;

    const result = this.resolveEvent(instanceId, selection.id);
    if (!result) return null;

    return {
      optionId: selection.id,
      isAuto: true,
      consequences: {
        description: result.consequences.description,
        resourceChanges: result.consequences.resourceChanges,
        affinityChanges: result.consequences.affinityChanges,
        triggerEventId: result.consequences.triggerEventId,
        unlockIds: result.consequences.unlockIds,
      },
      nextEventId: result.consequences.triggerEventId,
    };
  }

  // ─── 活动事件绑定 ──────────────────────────

  /** 绑定活动与事件 */
  bindActivityEvent(binding: ActivityEventBinding): void {
    this.activityBindings.set(binding.id, binding);
  }

  /** 解绑 */
  unbindActivityEvent(bindingId: string): void {
    this.activityBindings.delete(bindingId);
  }

  /** 获取活动关联的事件 */
  getActivityEvents(activityId: string): EventDef[] {
    const result: EventDef[] = [];
    for (const binding of this.activityBindings.values()) {
      if (binding.activityId === activityId && binding.enabled) {
        for (const eventDefId of binding.eventDefIds) {
          const def = this.eventDefs.get(eventDefId);
          if (def) result.push(def);
        }
      }
    }
    return result;
  }

  /** 设置限时事件 */
  setTimedEvent(config: TimedEventConfig): void {
    this.timedEvents.set(config.eventDefId, config);
  }

  /** 检查限时事件是否在有效期内 */
  isTimedEventActive(eventDefId: EventId, currentTime: number): boolean {
    const config = this.timedEvents.get(eventDefId);
    if (!config) return true; // 非限时事件始终有效
    return currentTime >= config.startTime && currentTime <= config.endTime;
  }

  /** 获取限时事件奖励倍率 */
  getTimedEventMultiplier(eventDefId: EventId): number {
    const config = this.timedEvents.get(eventDefId);
    return config?.rewardMultiplier ?? 1.0;
  }

  /** 添加奖励联动 */
  addRewardLink(link: ActivityRewardLink): void {
    this.rewardLinks.set(link.id, link);
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

  /** 过期处理 */
  expireEvents(currentTurn: number): EventInstance[] {
    const expired: EventInstance[] = [];
    for (const [id, inst] of this.activeEvents) {
      if (inst.expireTurn !== null && currentTurn >= inst.expireTurn) {
        inst.status = 'expired';
        expired.push(inst);
        this.activeEvents.delete(id);
        this.deps?.eventBus.emit('event:expired', { instanceId: id });
      }
    }
    return expired;
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): EventSaveDataV15 {
    return {
      version: 15,
      eventWeights: Array.from(this.eventWeights.entries()).map(([id, w]) => ({
        eventDefId: id,
        baseWeight: w.baseWeight,
        currentWeight: w.currentWeight,
      })),
      cooldowns: Array.from(this.cooldowns.entries()).map(([id, c]) => ({
        eventDefId: id,
        startTurn: c.startTurn,
        endTurn: c.endTurn,
      })),
      chainProgresses: [],
      offlineQueue: [],
      activityBindings: Array.from(this.activityBindings.values()).map(b => ({
        id: b.id,
        activityId: b.activityId,
        eventDefIds: b.eventDefIds,
        bindingType: b.bindingType,
        enabled: b.enabled,
      })),
      timedEvents: Array.from(this.timedEvents.entries()).map(([id, t]) => ({
        eventDefId: id,
        startTime: t.startTime,
        endTime: t.endTime,
        rewardMultiplier: t.rewardMultiplier,
      })),
      autoProcessRules: [],
      activeEvents: Array.from(this.activeEvents.values()),
      completedEventIds: Array.from(this.completedEventIds),
      instanceCounter: this.instanceCounter,
    };
  }

  deserialize(data: EventSaveDataV15): void {
    this.cooldowns.clear();
    for (const c of data.cooldowns ?? []) {
      this.cooldowns.set(c.eventDefId, {
        eventDefId: c.eventDefId,
        startTurn: c.startTurn,
        endTurn: c.endTurn,
        remainingTurns: c.endTurn - c.startTurn,
      });
    }

    this.eventWeights.clear();
    for (const w of data.eventWeights ?? []) {
      this.eventWeights.set(w.eventDefId, {
        eventDefId: w.eventDefId,
        baseWeight: w.baseWeight,
        currentWeight: w.currentWeight,
        modifiers: [],
      });
    }

    this.activityBindings.clear();
    for (const b of data.activityBindings ?? []) {
      this.activityBindings.set(b.id, {
        id: b.id,
        activityId: b.activityId,
        eventDefIds: b.eventDefIds,
        bindingType: b.bindingType as ActivityEventBinding['bindingType'],
        enabled: b.enabled,
      });
    }

    this.timedEvents.clear();
    for (const t of data.timedEvents ?? []) {
      this.timedEvents.set(t.eventDefId, {
        eventDefId: t.eventDefId,
        startTime: t.startTime,
        endTime: t.endTime,
        rewardMultiplier: t.rewardMultiplier,
        isActivityExclusive: false,
      });
    }

    // 恢复活跃事件
    this.activeEvents.clear();
    for (const inst of data.activeEvents ?? []) {
      this.activeEvents.set(inst.instanceId, inst);
    }

    // 恢复已完成事件ID
    this.completedEventIds.clear();
    for (const id of data.completedEventIds ?? []) {
      this.completedEventIds.add(id);
    }

    // 恢复实例计数器
    this.instanceCounter = data.instanceCounter ?? 0;
  }

  // ─── 内部方法 ──────────────────────────────

  /** 重新计算权重 */
  private recalculateWeight(weight: EventWeight): void {
    let current = weight.baseWeight;
    for (const mod of weight.modifiers) {
      if (mod.type === 'additive') {
        current += mod.value;
      } else {
        current *= mod.value;
      }
    }
    weight.currentWeight = Math.max(0, Math.round(current));
  }

  /** 创建事件实例 */
  private createInstance(def: EventDef, currentTurn: number): EventInstance {
    this.instanceCounter++;
    return {
      instanceId: `ev15-inst-${this.instanceCounter}`,
      eventDefId: def.id,
      triggeredTurn: currentTurn,
      expireTurn: def.expireAfterTurns != null ? currentTurn + def.expireAfterTurns : null,
      status: 'active',
    };
  }

  /** 评估单个条件 */
  private evaluateSingleCondition(cond: ExtendedEventCondition, ctx: ConditionContext): boolean {
    // 处理子条件嵌套
    if (cond.subConditions && cond.subConditions.length > 0) {
      const operator = cond.operator ?? 'and';
      if (operator === 'and') {
        return cond.subConditions.every(sc => this.evaluateSingleCondition(sc, ctx));
      }
      return cond.subConditions.some(sc => this.evaluateSingleCondition(sc, ctx));
    }

    switch (cond.type) {
      case 'turn_range': {
        const min = (cond.params.minTurn as number) ?? 0;
        const max = cond.params.maxTurn as number | undefined;
        return ctx.currentTurn >= min && (max === undefined || ctx.currentTurn <= max);
      }
      case 'resource_threshold': {
        const res = cond.params.resource as string;
        const min = (cond.params.minAmount as number) ?? 0;
        return (ctx.resources?.[res] ?? 0) >= min;
      }
      case 'event_completed': {
        const eventId = cond.params.eventId as string;
        return ctx.completedEventIds?.has(eventId) ?? false;
      }
      case 'hero_recruited': {
        const heroId = cond.params.heroId as string;
        return ctx.recruitedHeroIds?.has(heroId) ?? false;
      }
      case 'territory_count': {
        const min = (cond.params.minCount as number) ?? 0;
        return (ctx.territoryCount ?? 0) >= min;
      }
      case 'battle_won': {
        const min = (cond.params.minWins as number) ?? 0;
        return (ctx.battlesWon ?? 0) >= min;
      }
      case 'activity_active': {
        const activityId = cond.params.activityId as string;
        return ctx.activeActivityIds?.has(activityId) ?? false;
      }
      default:
        return true;
    }
  }

  /** 加权选择选项 */
  private selectWeightedOption(options: WeightedEventOption[]): WeightedEventOption | null {
    if (options.length === 0) return null;
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    if (totalWeight <= 0) return options[0];

    let roll = Math.random() * totalWeight;
    for (const opt of options) {
      roll -= opt.weight;
      if (roll <= 0) return opt;
    }
    return options[options.length - 1];
  }

  /** 应用活动奖励联动 */
  private applyRewardLinks(eventDefId: EventId, consequences: EventConsequence): EventConsequence {
    const enhanced = { ...consequences, resourceChanges: { ...consequences.resourceChanges } };

    for (const link of this.rewardLinks.values()) {
      if (!link.enabled) continue;
      if (link.eventDefId !== eventDefId) continue;

      switch (link.linkType) {
        case 'bonus_multiplier': {
          const multiplier = (link.params.multiplier as number) ?? 1;
          if (enhanced.resourceChanges) {
            for (const key of Object.keys(enhanced.resourceChanges)) {
              enhanced.resourceChanges[key] = Math.round(enhanced.resourceChanges[key] * multiplier);
            }
          }
          break;
        }
        case 'extra_reward': {
          const extraRewards = link.params.rewards as Record<string, number> | undefined;
          if (extraRewards && enhanced.resourceChanges) {
            for (const [key, value] of Object.entries(extraRewards)) {
              enhanced.resourceChanges[key] = (enhanced.resourceChanges[key] ?? 0) + value;
            }
          }
          break;
        }
      }
    }

    return enhanced;
  }
}
