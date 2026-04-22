/**
 * 引擎层 — v15.0 事件引擎核心
 *
 * 统一管理事件触发、选项选择、权重计算、冷却管理。
 * @module engine/event/EventEngine
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  EventId, EventDef, EventInstance, EventTriggerResult, EventChoiceResult, EventConsequence,
} from '../../core/event';
import type {
  EventCategory, EventWeight, EventWeightModifier, EventCooldown,
  ExtendedEventCondition, ConditionContext, WeightedSelectionResult,
  WeightedEventOption, OptionSelectionResult, ActivityEventBinding,
  TimedEventConfig, ActivityRewardLink, EventSaveDataV15,
} from '../../core/event/event-v15.types';
import { EVENT_CATEGORY_META } from '../../core/event/event-v15.types';
import {
  serializeEventEngine,
  deserializeEventEngine,
  type SerializableEventEngine,
} from './EventEngineSerialization';

const MAX_ACTIVE_EVENTS = 20;
const DEFAULT_WEIGHT = 50;
const DEFAULT_COOLDOWN_TURNS = 5;

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

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}

  getState() {
    return {
      eventDefs: new Map(this.eventDefs), categories: new Map(this.eventCategories),
      weights: new Map(this.eventWeights), cooldowns: new Map(this.cooldowns),
      activeEvents: this.getActiveEvents(), completedEventIds: new Set(this.completedEventIds),
      activityBindings: new Map(this.activityBindings), timedEvents: new Map(this.timedEvents),
    };
  }

  reset(): void {
    this.eventDefs.clear(); this.eventCategories.clear(); this.eventWeights.clear();
    this.cooldowns.clear(); this.activeEvents.clear(); this.completedEventIds.clear();
    this.activityBindings.clear(); this.timedEvents.clear(); this.rewardLinks.clear();
    this.instanceCounter = 0;
  }

  // ─── 事件注册 ────────────────────────────

  registerEvent(def: EventDef, category: EventCategory, weight?: number): void {
    this.eventDefs.set(def.id, def);
    this.eventCategories.set(def.id, category);
    const w = weight ?? EVENT_CATEGORY_META[category].defaultWeight;
    this.eventWeights.set(def.id, { eventDefId: def.id, baseWeight: w, currentWeight: w, modifiers: [] });
  }

  registerEvents(events: Array<{ def: EventDef; category: EventCategory; weight?: number }>): void {
    for (const { def, category, weight } of events) this.registerEvent(def, category, weight);
  }

  getEventDef(id: EventId): EventDef | undefined { return this.eventDefs.get(id); }
  getEventCategory(id: EventId): EventCategory | undefined { return this.eventCategories.get(id); }

  getEventsByCategory(category: EventCategory): EventDef[] {
    const result: EventDef[] = [];
    for (const [id, cat] of this.eventCategories) { if (cat === category) { const def = this.eventDefs.get(id); if (def) result.push(def); } }
    return result;
  }

  getAllEventDefs(): EventDef[] { return Array.from(this.eventDefs.values()); }

  // ─── 权重管理 ──────────────────────────────

  getEventWeight(eventDefId: EventId): EventWeight | undefined { return this.eventWeights.get(eventDefId); }

  addWeightModifier(eventDefId: EventId, modifier: EventWeightModifier): void {
    const weight = this.eventWeights.get(eventDefId);
    if (!weight) return;
    weight.modifiers.push(modifier);
    this.recalculateWeight(weight);
  }

  removeWeightModifier(eventDefId: EventId, source: string): void {
    const weight = this.eventWeights.get(eventDefId);
    if (!weight) return;
    weight.modifiers = weight.modifiers.filter(m => m.source !== source);
    this.recalculateWeight(weight);
  }

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
    for (const c of candidates) { roll -= c.weight; if (roll <= 0) { selectedId = c.eventDefId; break; } }
    return { eventDefId: selectedId, selectedWeight: candidates.find(c => c.eventDefId === selectedId)?.weight ?? 0, totalWeight, candidates };
  }

  // ─── 冷却管理 ──────────────────────────────

  isOnCooldown(eventDefId: EventId, currentTurn: number): boolean {
    const cd = this.cooldowns.get(eventDefId);
    return cd ? currentTurn < cd.endTurn : false;
  }

  getCooldownRemaining(eventDefId: EventId, currentTurn: number): number {
    const cd = this.cooldowns.get(eventDefId);
    return cd ? Math.max(0, cd.endTurn - currentTurn) : 0;
  }

  setCooldown(eventDefId: EventId, startTurn: number, duration: number): void {
    this.cooldowns.set(eventDefId, { eventDefId, startTurn, endTurn: startTurn + duration, remainingTurns: duration });
  }

  clearCooldown(eventDefId: EventId): void { this.cooldowns.delete(eventDefId); }

  tickCooldowns(currentTurn: number): void {
    for (const [id, cd] of this.cooldowns) { cd.remainingTurns = Math.max(0, cd.endTurn - currentTurn); if (cd.remainingTurns <= 0) this.cooldowns.delete(id); }
  }

  // ─── 条件触发评估 ──────────────────────────

  evaluateConditions(conditions: ExtendedEventCondition[], context: ConditionContext): boolean {
    if (conditions.length === 0) return true;
    for (const cond of conditions) {
      const result = this.evaluateSingleCondition(cond, context);
      if (result === (cond.negate ?? false)) return false;
    }
    return true;
  }

  // ─── 事件触发 ──────────────────────────────

  canTrigger(eventDefId: EventId, currentTurn: number, context?: ConditionContext): boolean {
    const def = this.eventDefs.get(eventDefId);
    if (!def) return false;
    if (this.completedEventIds.has(eventDefId)) return false;
    if (this.hasActiveEvent(eventDefId)) return false;
    if (this.isOnCooldown(eventDefId, currentTurn)) return false;
    if (this.activeEvents.size >= MAX_ACTIVE_EVENTS) return false;
    const category = this.eventCategories.get(eventDefId);
    if (category === 'triggered' && def.triggerConditions && context) {
      if (!this.evaluateConditions(def.triggerConditions as unknown as ExtendedEventCondition[], context)) return false;
    }
    return true;
  }

  triggerEvent(eventDefId: EventId, currentTurn: number, force = false): EventTriggerResult {
    const def = this.eventDefs.get(eventDefId);
    if (!def) return { triggered: false, reason: `事件 ${eventDefId} 不存在` };
    if (this.hasActiveEvent(eventDefId)) return { triggered: false, reason: '已有活跃实例' };
    if (!force && !this.canTrigger(eventDefId, currentTurn)) return { triggered: false, reason: '不满足触发条件' };
    const instance = this.createInstance(def, currentTurn);
    this.activeEvents.set(instance.instanceId, instance);
    this.deps?.eventBus.emit('event:triggered', { instanceId: instance.instanceId, eventDefId: def.id, category: this.eventCategories.get(def.id) });
    return { triggered: true, instance };
  }

  checkAndTriggerByCategory(category: EventCategory, currentTurn: number, context?: ConditionContext): EventInstance[] {
    this.tickCooldowns(currentTurn);
    const triggered: EventInstance[] = [];
    for (const def of this.getEventsByCategory(category)) {
      if (this.canTrigger(def.id, currentTurn, context)) {
        if (category === 'random' && Math.random() >= (def.triggerProbability ?? 0.3)) continue;
        const result = this.triggerEvent(def.id, currentTurn);
        if (result.triggered && result.instance) triggered.push(result.instance);
      }
    }
    return triggered;
  }

  // ─── 选项处理 ──────────────────────────────

  resolveEvent(instanceId: string, optionId: string): EventChoiceResult | null {
    const instance = this.activeEvents.get(instanceId);
    if (!instance || instance.status !== 'active') return null;
    const def = this.eventDefs.get(instance.eventDefId);
    if (!def) return null;
    const option = def.options.find(o => o.id === optionId);
    if (!option) return null;
    instance.status = 'resolved';
    this.completedEventIds.add(instance.eventDefId);
    this.setCooldown(instance.eventDefId, instance.triggeredTurn, def.cooldownTurns ?? DEFAULT_COOLDOWN_TURNS);
    this.activeEvents.delete(instanceId);
    const enhancedConsequences = this.applyRewardLinks(instance.eventDefId, option.consequences);
    this.deps?.eventBus.emit('event:resolved', { instanceId, eventDefId: instance.eventDefId, optionId, consequences: enhancedConsequences });
    return { instanceId, optionId, consequences: enhancedConsequences, chainEventId: enhancedConsequences.triggerEventId };
  }

  autoSelectOption(instanceId: string): OptionSelectionResult | null {
    const instance = this.activeEvents.get(instanceId);
    if (!instance) return null;
    const def = this.eventDefs.get(instance.eventDefId);
    if (!def) return null;
    const weightedOptions: WeightedEventOption[] = def.options.map(o => ({
      id: o.id, text: o.text, description: o.description,
      weight: o.isDefault ? 60 : 40,
      consequences: { description: o.consequences.description, resourceChanges: o.consequences.resourceChanges, affinityChanges: o.consequences.affinityChanges, triggerEventId: o.consequences.triggerEventId, unlockIds: o.consequences.unlockIds },
    }));
    if (weightedOptions.length === 0) return null;
    const selection = this.selectWeightedOption(weightedOptions);
    if (!selection) return null;
    const result = this.resolveEvent(instanceId, selection.id);
    if (!result) return null;
    return { optionId: selection.id, isAuto: true, consequences: { description: result.consequences.description, resourceChanges: result.consequences.resourceChanges, affinityChanges: result.consequences.affinityChanges, triggerEventId: result.consequences.triggerEventId, unlockIds: result.consequences.unlockIds }, nextEventId: result.consequences.triggerEventId };
  }

  // ─── 活动事件绑定 ──────────────────────────

  bindActivityEvent(binding: ActivityEventBinding): void { this.activityBindings.set(binding.id, binding); }
  unbindActivityEvent(bindingId: string): void { this.activityBindings.delete(bindingId); }

  getActivityEvents(activityId: string): EventDef[] {
    const result: EventDef[] = [];
    for (const b of this.activityBindings.values()) {
      if (b.activityId === activityId && b.enabled) { for (const eid of b.eventDefIds) { const def = this.eventDefs.get(eid); if (def) result.push(def); } }
    }
    return result;
  }

  setTimedEvent(config: TimedEventConfig): void { this.timedEvents.set(config.eventDefId, config); }

  isTimedEventActive(eventDefId: EventId, currentTime: number): boolean {
    const config = this.timedEvents.get(eventDefId);
    return config ? currentTime >= config.startTime && currentTime <= config.endTime : true;
  }

  getTimedEventMultiplier(eventDefId: EventId): number { return this.timedEvents.get(eventDefId)?.rewardMultiplier ?? 1.0; }
  addRewardLink(link: ActivityRewardLink): void { this.rewardLinks.set(link.id, link); }

  // ─── 活跃事件管理 ──────────────────────────

  getActiveEvents(): EventInstance[] { return Array.from(this.activeEvents.values()); }

  hasActiveEvent(eventDefId: EventId): boolean {
    for (const inst of this.activeEvents.values()) { if (inst.eventDefId === eventDefId) return true; }
    return false;
  }

  getInstance(instanceId: string): EventInstance | undefined { return this.activeEvents.get(instanceId); }
  getActiveEventCount(): number { return this.activeEvents.size; }
  isEventCompleted(eventId: EventId): boolean { return this.completedEventIds.has(eventId); }
  getCompletedEventIds(): EventId[] { return Array.from(this.completedEventIds); }

  expireEvents(currentTurn: number): EventInstance[] {
    const expired: EventInstance[] = [];
    for (const [id, inst] of this.activeEvents) {
      if (inst.expireTurn !== null && currentTurn >= inst.expireTurn) { inst.status = 'expired'; expired.push(inst); this.activeEvents.delete(id); this.deps?.eventBus.emit('event:expired', { instanceId: id }); }
    }
    return expired;
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): EventSaveDataV15 {
    return {
      version: 15,
      eventWeights: Array.from(this.eventWeights.entries()).map(([id, w]) => ({ eventDefId: id, baseWeight: w.baseWeight, currentWeight: w.currentWeight })),
      cooldowns: Array.from(this.cooldowns.entries()).map(([id, c]) => ({ eventDefId: id, startTurn: c.startTurn, endTurn: c.endTurn })),
      chainProgresses: [], offlineQueue: [],
      activityBindings: Array.from(this.activityBindings.values()).map(b => ({ id: b.id, activityId: b.activityId, eventDefIds: b.eventDefIds, bindingType: b.bindingType, enabled: b.enabled })),
      timedEvents: Array.from(this.timedEvents.entries()).map(([id, t]) => ({ eventDefId: id, startTime: t.startTime, endTime: t.endTime, rewardMultiplier: t.rewardMultiplier })),
      autoProcessRules: [], activeEvents: Array.from(this.activeEvents.values()),
      completedEventIds: Array.from(this.completedEventIds), instanceCounter: this.instanceCounter,
    };
  }

  deserialize(data: EventSaveDataV15): void {
    this.cooldowns.clear();
    for (const c of data.cooldowns ?? []) this.cooldowns.set(c.eventDefId, { eventDefId: c.eventDefId, startTurn: c.startTurn, endTurn: c.endTurn, remainingTurns: c.endTurn - c.startTurn });
    this.eventWeights.clear();
    for (const w of data.eventWeights ?? []) this.eventWeights.set(w.eventDefId, { eventDefId: w.eventDefId, baseWeight: w.baseWeight, currentWeight: w.currentWeight, modifiers: [] });
    this.activityBindings.clear();
    for (const b of data.activityBindings ?? []) this.activityBindings.set(b.id, { id: b.id, activityId: b.activityId, eventDefIds: b.eventDefIds, bindingType: b.bindingType as ActivityEventBinding['bindingType'], enabled: b.enabled });
    this.timedEvents.clear();
    for (const t of data.timedEvents ?? []) this.timedEvents.set(t.eventDefId, { eventDefId: t.eventDefId, startTime: t.startTime, endTime: t.endTime, rewardMultiplier: t.rewardMultiplier, isActivityExclusive: false });
    this.activeEvents.clear();
    for (const inst of data.activeEvents ?? []) this.activeEvents.set(inst.instanceId, inst);
    this.completedEventIds.clear();
    for (const id of data.completedEventIds ?? []) this.completedEventIds.add(id);
    this.instanceCounter = data.instanceCounter ?? 0;
  }

  // ─── 内部方法 ──────────────────────────────

  private recalculateWeight(weight: EventWeight): void {
    let current = weight.baseWeight;
    for (const mod of weight.modifiers) current = mod.type === 'additive' ? current + mod.value : current * mod.value;
    weight.currentWeight = Math.max(0, Math.round(current));
  }

  private createInstance(def: EventDef, currentTurn: number): EventInstance {
    this.instanceCounter++;
    return { instanceId: `ev15-inst-${this.instanceCounter}`, eventDefId: def.id, triggeredTurn: currentTurn, expireTurn: def.expireAfterTurns != null ? currentTurn + def.expireAfterTurns : null, status: 'active' };
  }

  private evaluateSingleCondition(cond: ExtendedEventCondition, ctx: ConditionContext): boolean {
    if (cond.subConditions && cond.subConditions.length > 0) {
      return (cond.operator ?? 'and') === 'and'
        ? cond.subConditions.every(sc => this.evaluateSingleCondition(sc, ctx))
        : cond.subConditions.some(sc => this.evaluateSingleCondition(sc, ctx));
    }
    switch (cond.type) {
      case 'turn_range': { const min = (cond.params.minTurn as number) ?? 0; const max = cond.params.maxTurn as number | undefined; return ctx.currentTurn >= min && (max === undefined || ctx.currentTurn <= max); }
      case 'resource_threshold': { return (ctx.resources?.[cond.params.resource as string] ?? 0) >= ((cond.params.minAmount as number) ?? 0); }
      case 'event_completed': { return ctx.completedEventIds?.has(cond.params.eventId as string) ?? false; }
      case 'hero_recruited': { return ctx.recruitedHeroIds?.has(cond.params.heroId as string) ?? false; }
      case 'territory_count': { return (ctx.territoryCount ?? 0) >= ((cond.params.minCount as number) ?? 0); }
      case 'battle_won': { return (ctx.battlesWon ?? 0) >= ((cond.params.minWins as number) ?? 0); }
      case 'activity_active': { return ctx.activeActivityIds?.has(cond.params.activityId as string) ?? false; }
      default: return true;
    }
  }

  private selectWeightedOption(options: WeightedEventOption[]): WeightedEventOption | null {
    if (options.length === 0) return null;
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    if (totalWeight <= 0) return options[0];
    let roll = Math.random() * totalWeight;
    for (const opt of options) { roll -= opt.weight; if (roll <= 0) return opt; }
    return options[options.length - 1];
  }

  private applyRewardLinks(eventDefId: EventId, consequences: EventConsequence): EventConsequence {
    const enhanced = { ...consequences, resourceChanges: { ...consequences.resourceChanges } };
    for (const link of this.rewardLinks.values()) {
      if (!link.enabled || link.eventDefId !== eventDefId) continue;
      if (link.linkType === 'bonus_multiplier') {
        const multiplier = (link.params.multiplier as number) ?? 1;
        if (enhanced.resourceChanges) { for (const key of Object.keys(enhanced.resourceChanges)) enhanced.resourceChanges[key] = Math.round(enhanced.resourceChanges[key] * multiplier); }
      } else if (link.linkType === 'extra_reward') {
        const extraRewards = link.params.rewards as Record<string, number> | undefined;
        if (extraRewards && enhanced.resourceChanges) { for (const [key, value] of Object.entries(extraRewards)) enhanced.resourceChanges[key] = (enhanced.resourceChanges[key] ?? 0) + value; }
      }
    }
    return enhanced;
  }
}
