/**
 * 引擎层 — 事件生命周期处理
 * 从 EventTriggerSystem 中提取的事件过期、选择处理逻辑
 *
 * @module engine/event/EventTriggerLifecycle
 */

import type { ISystemDeps } from '../../core/types';
import type {
  EventId, EventDef, EventInstance, EventChoiceResult,
} from '../../core/event';

// ─── 公共类型 ─────────────────────────────────

/** 事件生命周期操作所需的状态容器 */
export interface EventLifecycleState {
  activeEvents: Map<string, EventInstance>;
  completedEventIds: Set<EventId>;
  cooldowns: Map<EventId, number>;
  eventDefs: Map<EventId, EventDef>;
}

// ─── 事件选择处理 ──────────────────────────────

/**
 * 处理事件选择（resolveEvent）
 *
 * @param instanceId - 事件实例ID
 * @param optionId - 选择的选项ID
 * @param state - 事件状态容器
 * @param deps - 系统依赖（用于发出事件）
 * @returns 选择结果，失败返回null
 */
export function resolveEvent(
  instanceId: string,
  optionId: string,
  state: EventLifecycleState,
  deps?: ISystemDeps,
): EventChoiceResult | null {
  const instance = state.activeEvents.get(instanceId);
  if (!instance) return null;
  if (instance.status !== 'active') return null;

  const def = state.eventDefs.get(instance.eventDefId);
  if (!def) return null;

  const option = def.options.find((o) => o.id === optionId);
  if (!option) return null;

  // 更新实例状态
  instance.status = 'resolved';

  // 记录完成
  state.completedEventIds.add(instance.eventDefId);

  // 设置冷却
  if (def.cooldownTurns) {
    state.cooldowns.set(instance.eventDefId, instance.triggeredTurn + def.cooldownTurns);
  }

  // 从活跃列表移除
  state.activeEvents.delete(instanceId);

  // 发出事件
  deps?.eventBus.emit('event:resolved', {
    instanceId,
    eventDefId: instance.eventDefId,
    optionId,
    consequences: option.consequences,
  });

  return {
    instanceId,
    optionId,
    consequences: option.consequences,
    chainEventId: option.consequences.triggerEventId,
  };
}

// ─── 过期处理 ─────────────────────────────────

/**
 * 处理过期事件
 *
 * @param currentTurn - 当前回合
 * @param state - 事件状态容器
 * @param deps - 系统依赖（用于发出事件）
 * @returns 过期的事件实例列表
 */
export function expireEvents(
  currentTurn: number,
  state: EventLifecycleState,
  deps?: ISystemDeps,
): EventInstance[] {
  const expired: EventInstance[] = [];

  for (const [instanceId, instance] of state.activeEvents) {
    if (instance.expireTurn !== null && currentTurn >= instance.expireTurn) {
      instance.status = 'expired';
      expired.push(instance);
      state.activeEvents.delete(instanceId);

      deps?.eventBus.emit('event:expired', {
        instanceId,
        eventDefId: instance.eventDefId,
      });
    }
  }

  return expired;
}
