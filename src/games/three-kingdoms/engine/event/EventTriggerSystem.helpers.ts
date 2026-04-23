/**
 * 引擎层 — 事件触发系统：查询与序列化辅助函数
 *
 * 从 EventTriggerSystem.ts 中提取的活跃事件查询、配置管理、
 * 序列化/反序列化和内部工厂方法。
 *
 * @module engine/event/EventTriggerSystem.helpers
 */

import type {
  EventId, EventDef, EventInstance, EventTriggerConfig,
  EventSystemSaveData, EventTriggerResult,
} from '../../core/event';
import {
  serializeEventTriggerState,
  deserializeEventTriggerState,
} from './EventTriggerSerialization';
import { PREDEFINED_EVENTS } from '../../core/event';

// ─── 活跃事件查询 ──────────────────────────────

/** 获取所有活跃事件 */
export function getActiveEvents(activeEvents: Map<string, EventInstance>): EventInstance[] {
  return Array.from(activeEvents.values());
}

/** 检查是否有活跃事件 */
export function hasActiveEvent(
  eventDefId: EventId,
  activeEvents: Map<string, EventInstance>,
): boolean {
  for (const inst of activeEvents.values()) {
    if (inst.eventDefId === eventDefId) return true;
  }
  return false;
}

/** 获取事件实例 */
export function getInstance(
  instanceId: string,
  activeEvents: Map<string, EventInstance>,
): EventInstance | undefined {
  return activeEvents.get(instanceId);
}

/** 获取活跃事件数量 */
export function getActiveEventCount(activeEvents: Map<string, EventInstance>): number {
  return activeEvents.size;
}

/** 检查事件是否已完成 */
export function isEventCompleted(eventId: EventId, completedEventIds: Set<EventId>): boolean {
  return completedEventIds.has(eventId);
}

/** 获取所有已完成事件ID */
export function getCompletedEventIds(completedEventIds: Set<EventId>): EventId[] {
  return Array.from(completedEventIds);
}

// ─── 配置管理 ──────────────────────────────────

/** 获取配置副本 */
export function getConfig(config: EventTriggerConfig): EventTriggerConfig {
  return { ...config };
}

/** 更新配置 */
export function updateConfig(
  config: EventTriggerConfig,
  partial: Partial<EventTriggerConfig>,
): EventTriggerConfig {
  return { ...config, ...partial };
}

// ─── 序列化 ────────────────────────────────────

/** 序列化事件触发状态 */
export function serializeState(
  activeEvents: Map<string, EventInstance>,
  completedEventIds: Set<EventId>,
  cooldowns: Map<EventId, number>,
): EventSystemSaveData {
  return serializeEventTriggerState({ activeEvents, completedEventIds, cooldowns });
}

/** 反序列化事件触发状态 */
export function deserializeState(
  data: EventSystemSaveData,
  activeEvents: Map<string, EventInstance>,
  completedEventIds: Set<EventId>,
  cooldowns: Map<EventId, number>,
): void {
  const restored = deserializeEventTriggerState(data);
  activeEvents.clear();
  for (const [k, v] of restored.activeEvents) {
    activeEvents.set(k, v);
  }

  completedEventIds.clear();
  for (const id of restored.completedEventIds) {
    completedEventIds.add(id);
  }

  cooldowns.clear();
  for (const [k, v] of restored.cooldowns) {
    cooldowns.set(k, v);
  }
}

// ─── 内部工厂 ──────────────────────────────────

/** 加载预定义事件到注册表 */
export function loadPredefinedEvents(eventDefs: Map<EventId, EventDef>): void {
  for (const def of Object.values(PREDEFINED_EVENTS)) {
    eventDefs.set(def.id, def);
  }
}

/** 创建事件实例 */
export function createEventInstance(
  def: EventDef,
  currentTurn: number,
  counter: { value: number },
): EventInstance {
  counter.value++;
  const expireTurn = def.expireAfterTurns != null
    ? currentTurn + def.expireAfterTurns
    : null;

  return {
    instanceId: `event-inst-${counter.value}`,
    eventDefId: def.id,
    triggeredTurn: currentTurn,
    expireTurn,
    status: 'active',
  };
}

// ─── 内部条件检查 ──────────────────────────────

import {
  evaluateCondition,
  type CompletedEventChecker,
} from './EventTriggerConditions';

/** 检查固定事件条件 */
export function checkFixedConditions(
  def: EventDef,
  currentTurn: number,
  completedEventIds: Set<EventId>,
): boolean {
  if (!def.triggerConditions || def.triggerConditions.length === 0) {
    return true;
  }

  const completedChecker: CompletedEventChecker = (id) => completedEventIds.has(id);
  for (const cond of def.triggerConditions) {
    if (!evaluateCondition(cond, currentTurn, undefined, completedChecker)) {
      return false;
    }
  }

  return true;
}

/** 检查连锁事件前置条件 */
export function checkChainPrerequisites(
  def: EventDef,
  completedEventIds: Set<EventId>,
): boolean {
  if (!def.prerequisiteEventIds || def.prerequisiteEventIds.length === 0) {
    return true;
  }

  return def.prerequisiteEventIds.every((id) => completedEventIds.has(id));
}

// ─── 触发事件逻辑 ──────────────────────────────

import type { ISystemDeps } from '../../core/types';

/** 触发事件上下文 */
export interface TriggerContext {
  eventDefs: Map<EventId, EventDef>;
  activeEvents: Map<string, EventInstance>;
  completedEventIds: Set<EventId>;
  cooldowns: Map<EventId, number>;
  config: EventTriggerConfig;
  instanceCounter: { value: number };
  deps: ISystemDeps | undefined;
  canTrigger: (eventId: EventId, currentTurn: number) => boolean;
}

/** 触发事件核心逻辑 */
export function triggerEventLogic(
  eventId: EventId,
  currentTurn: number,
  ctx: TriggerContext,
  force = false,
): EventTriggerResult {
  const def = ctx.eventDefs.get(eventId);
  if (!def) {
    return { triggered: false, reason: `事件 ${eventId} 不存在` };
  }

  // 已有同类型活跃事件时不可重复触发
  for (const inst of ctx.activeEvents.values()) {
    if (inst.eventDefId === eventId) {
      return { triggered: false, reason: `事件 ${eventId} 已有活跃实例` };
    }
  }

  if (!force && !ctx.canTrigger(eventId, currentTurn)) {
    return { triggered: false, reason: `事件 ${eventId} 不满足触发条件` };
  }

  const instance = createEventInstance(def, currentTurn, ctx.instanceCounter);
  ctx.activeEvents.set(instance.instanceId, instance);

  ctx.deps?.eventBus.emit('event:triggered', {
    instanceId: instance.instanceId,
    eventDefId: def.id,
    title: def.title,
    urgency: def.urgency,
  });

  return { triggered: true, instance };
}

// ─────────────────────────────────────────────
// 批量触发检查
// ─────────────────────────────────────────────

import type { ProbabilityCondition, ProbabilityResult } from '../../core/event/event-encounter.types';

/** 批量触发检查的上下文 */
export interface CheckTriggerContext extends TriggerContext {
  getEventDefsByType: (type: string) => EventDef[];
  probabilityConditions: Map<EventId, ProbabilityCondition>;
  config: EventTriggerConfig;
  calculateProbability: (cond: ProbabilityCondition) => ProbabilityResult;
  tickCooldowns: (turn: number) => void;
}

/** 每回合事件触发检查 */
export function checkAndTriggerEventsLogic(ctx: CheckTriggerContext, currentTurn: number): EventInstance[] {
  const triggered: EventInstance[] = [];

  ctx.tickCooldowns(currentTurn);

  // 1. 固定事件
  const fixedEvents = ctx.getEventDefsByType('fixed');
  for (const def of fixedEvents) {
    if (ctx.canTrigger(def.id, currentTurn)) {
      const result = triggerEventLogic(def.id, currentTurn, ctx);
      if (result.triggered && result.instance) {
        triggered.push(result.instance);
      }
    }
  }

  // 2. 连锁事件
  const chainEvents = ctx.getEventDefsByType('chain');
  for (const def of chainEvents) {
    if (ctx.canTrigger(def.id, currentTurn)) {
      const result = triggerEventLogic(def.id, currentTurn, ctx);
      if (result.triggered && result.instance) {
        triggered.push(result.instance);
      }
    }
  }

  // 3. 随机事件
  const randomEvents = ctx.getEventDefsByType('random');
  for (const def of randomEvents) {
    if (ctx.canTrigger(def.id, currentTurn)) {
      const probCondition = ctx.probabilityConditions.get(def.id);
      if (probCondition) {
        const probResult = ctx.calculateProbability(probCondition);
        if (!probResult.triggered) continue;
      } else {
        const probability = def.triggerProbability ?? ctx.config.randomEventProbability;
        if (Math.random() >= probability) continue;
      }

      const result = triggerEventLogic(def.id, currentTurn, ctx);
      if (result.triggered && result.instance) {
        triggered.push(result.instance);
      }
    }
  }

  return triggered;
}
