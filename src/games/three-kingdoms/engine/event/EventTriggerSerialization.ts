/**
 * 引擎层 — 事件触发系统序列化
 * 从 EventTriggerSystem 中提取的存档序列化/反序列化逻辑
 *
 * @module engine/event/EventTriggerSerialization
 */

import type {
  EventId, EventInstance, EventSystemSaveData,
} from '../../core/event';
import { EVENT_SAVE_VERSION } from '../../core/event';

// ─── 公共类型 ─────────────────────────────────

/** 序列化所需的系统状态快照 */
export interface EventTriggerStateSnapshot {
  activeEvents: Map<string, EventInstance>;
  completedEventIds: Set<EventId>;
  cooldowns: Map<EventId, number>;
}

// ─── 序列化 ───────────────────────────────────

/**
 * 将事件触发状态序列化为存档数据
 *
 * @param state - 当前系统状态快照
 * @returns 存档数据
 */
export function serializeEventTriggerState(
  state: EventTriggerStateSnapshot,
): EventSystemSaveData {
  return {
    activeEvents: Array.from(state.activeEvents.values()),
    completedEventIds: Array.from(state.completedEventIds),
    banners: [],
    cooldowns: Object.fromEntries(state.cooldowns),
    version: EVENT_SAVE_VERSION,
  };
}

/**
 * 从存档数据反序列化恢复事件触发状态
 *
 * @param data - 存档数据
 * @returns 恢复后的状态容器（空 Map/Set，需调用方赋值）
 */
export function deserializeEventTriggerState(
  data: EventSystemSaveData,
): EventTriggerStateSnapshot {
  const activeEvents = new Map<string, EventInstance>();
  for (const inst of data.activeEvents ?? []) {
    activeEvents.set(inst.instanceId, inst);
  }

  const completedEventIds = new Set<EventId>();
  for (const id of data.completedEventIds ?? []) {
    completedEventIds.add(id);
  }

  const cooldowns = new Map<EventId, number>();
  if (data.cooldowns) {
    for (const [eventId, turn] of Object.entries(data.cooldowns)) {
      cooldowns.set(eventId, turn);
    }
  }

  return { activeEvents, completedEventIds, cooldowns };
}
