/**
 * 引擎层 — EventEngine 序列化辅助
 *
 * 从 EventEngine.ts 中拆分出的序列化/反序列化逻辑。
 *
 * @module engine/event/EventEngineSerialization
 */

import type { EventId, EventInstance } from '../../core/event';
import type {
  EventWeight,
  EventCooldown,
  ActivityEventBinding,
  TimedEventConfig,
  EventSaveDataV15,
} from '../../core/event/event-v15.types';

// ─────────────────────────────────────────────
// 序列化辅助函数
// ─────────────────────────────────────────────

/** 序列化接口 — 由 EventEngine 实现 */
export interface SerializableEventEngine {
  readonly eventWeights: Map<EventId, EventWeight>;
  readonly cooldowns: Map<EventId, EventCooldown>;
  readonly activityBindings: Map<string, ActivityEventBinding>;
  readonly timedEvents: Map<EventId, TimedEventConfig>;
  readonly activeEvents: Map<string, EventInstance>;
  readonly completedEventIds: Set<EventId>;
  instanceCounter: number;
}

/**
 * 从引擎状态构建存档数据
 */
export function serializeEventEngine(engine: SerializableEventEngine): EventSaveDataV15 {
  return {
    version: 15,
    eventWeights: Array.from(engine.eventWeights.entries()).map(([id, w]) => ({
      eventDefId: id,
      baseWeight: w.baseWeight,
      currentWeight: w.currentWeight,
    })),
    cooldowns: Array.from(engine.cooldowns.entries()).map(([id, c]) => ({
      eventDefId: id,
      startTurn: c.startTurn,
      endTurn: c.endTurn,
    })),
    chainProgresses: [],
    offlineQueue: [],
    activityBindings: Array.from(engine.activityBindings.values()).map(b => ({
      id: b.id,
      activityId: b.activityId,
      eventDefIds: b.eventDefIds,
      bindingType: b.bindingType,
      enabled: b.enabled,
    })),
    timedEvents: Array.from(engine.timedEvents.entries()).map(([id, t]) => ({
      eventDefId: id,
      startTime: t.startTime,
      endTime: t.endTime,
      rewardMultiplier: t.rewardMultiplier,
    })),
    autoProcessRules: [],
    activeEvents: Array.from(engine.activeEvents.values()),
    completedEventIds: Array.from(engine.completedEventIds),
    instanceCounter: engine.instanceCounter,
  };
}

/**
 * 从存档数据恢复引擎状态
 */
export function deserializeEventEngine(
  engine: SerializableEventEngine,
  data: EventSaveDataV15,
): void {
  engine.cooldowns.clear();
  for (const c of data.cooldowns ?? []) {
    engine.cooldowns.set(c.eventDefId, {
      eventDefId: c.eventDefId,
      startTurn: c.startTurn,
      endTurn: c.endTurn,
      remainingTurns: c.endTurn - c.startTurn,
    });
  }

  engine.eventWeights.clear();
  for (const w of data.eventWeights ?? []) {
    engine.eventWeights.set(w.eventDefId, {
      eventDefId: w.eventDefId,
      baseWeight: w.baseWeight,
      currentWeight: w.currentWeight,
      modifiers: [],
    });
  }

  engine.activityBindings.clear();
  for (const b of data.activityBindings ?? []) {
    engine.activityBindings.set(b.id, {
      id: b.id,
      activityId: b.activityId,
      eventDefIds: b.eventDefIds,
      bindingType: b.bindingType as ActivityEventBinding['bindingType'],
      enabled: b.enabled,
    });
  }

  engine.timedEvents.clear();
  for (const t of data.timedEvents ?? []) {
    engine.timedEvents.set(t.eventDefId, {
      eventDefId: t.eventDefId,
      startTime: t.startTime,
      endTime: t.endTime,
      rewardMultiplier: t.rewardMultiplier,
      isActivityExclusive: false,
    });
  }

  engine.activeEvents.clear();
  for (const inst of data.activeEvents ?? []) {
    engine.activeEvents.set(inst.instanceId, inst);
  }

  engine.completedEventIds.clear();
  for (const id of data.completedEventIds ?? []) {
    engine.completedEventIds.add(id);
  }

  engine.instanceCounter = data.instanceCounter ?? 0;
}
