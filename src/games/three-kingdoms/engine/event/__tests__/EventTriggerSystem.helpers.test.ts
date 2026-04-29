/**
 * EventTriggerSystem.helpers 单元测试
 *
 * 覆盖：getActiveEvents、hasActiveEvent、getInstance、getActiveEventCount、
 *       isEventCompleted、getCompletedEventIds、getConfig、updateConfig、
 *       serializeState、deserializeState、loadPredefinedEvents、createEventInstance、
 *       checkFixedConditions、checkChainPrerequisites、triggerEventLogic
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getActiveEvents,
  hasActiveEvent,
  getInstance,
  getActiveEventCount,
  isEventCompleted,
  getCompletedEventIds,
  getConfig,
  updateConfig,
  serializeState,
  deserializeState,
  loadPredefinedEvents,
  createEventInstance,
  checkFixedConditions,
  checkChainPrerequisites,
  triggerEventLogic,
} from '../EventTriggerSystem.helpers';
import type { EventInstance, EventId, EventDef, EventTriggerConfig } from '../../../core/event';
import type { ISystemDeps } from '../../../core/types';

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function makeInstance(overrides: Partial<EventInstance> = {}): EventInstance {
  return {
    instanceId: 'inst-1',
    eventDefId: 'evt-1',
    triggeredTurn: 5,
    expireTurn: 15,
    status: 'active',
    ...overrides,
  };
}

function makeDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-1',
    title: '测试事件',
    description: '描述',
    triggerType: 'fixed',
    urgency: 'medium',
    scope: 'global',
    options: [
      { id: 'opt-1', text: '选项1', consequences: { description: '结果1' } },
    ],
    ...overrides,
  };
}

// ─── 活跃事件查询 ──────────────────────────────

describe('EventTriggerSystem.helpers', () => {
  describe('getActiveEvents', () => {
    it('返回所有活跃事件', () => {
      const map = new Map<string, EventInstance>();
      map.set('inst-1', makeInstance({ instanceId: 'inst-1' }));
      map.set('inst-2', makeInstance({ instanceId: 'inst-2' }));

      const events = getActiveEvents(map);
      expect(events).toHaveLength(2);
    });

    it('空 Map 返回空数组', () => {
      expect(getActiveEvents(new Map())).toHaveLength(0);
    });
  });

  describe('hasActiveEvent', () => {
    it('存在活跃事件', () => {
      const map = new Map<string, EventInstance>();
      map.set('inst-1', makeInstance({ eventDefId: 'evt-1' }));
      expect(hasActiveEvent('evt-1', map)).toBe(true);
    });

    it('不存在活跃事件', () => {
      const map = new Map<string, EventInstance>();
      map.set('inst-1', makeInstance({ eventDefId: 'evt-1' }));
      expect(hasActiveEvent('evt-2', map)).toBe(false);
    });

    it('空 Map 返回 false', () => {
      expect(hasActiveEvent('evt-1', new Map())).toBe(false);
    });
  });

  describe('getInstance', () => {
    it('获取存在的实例', () => {
      const inst = makeInstance();
      const map = new Map([['inst-1', inst]]);
      expect(getInstance('inst-1', map)).toBe(inst);
    });

    it('不存在的实例返回 undefined', () => {
      expect(getInstance('not-exist', new Map())).toBeUndefined();
    });
  });

  describe('getActiveEventCount', () => {
    it('返回正确数量', () => {
      const map = new Map<string, EventInstance>();
      map.set('inst-1', makeInstance());
      map.set('inst-2', makeInstance());
      expect(getActiveEventCount(map)).toBe(2);
    });
  });

  describe('isEventCompleted', () => {
    it('已完成', () => {
      expect(isEventCompleted('evt-1', new Set(['evt-1']))).toBe(true);
    });

    it('未完成', () => {
      expect(isEventCompleted('evt-1', new Set())).toBe(false);
    });
  });

  describe('getCompletedEventIds', () => {
    it('返回数组', () => {
      const ids = getCompletedEventIds(new Set(['evt-1', 'evt-2']));
      expect(ids).toHaveLength(2);
      expect(ids).toContain('evt-1');
    });
  });

  // ─── 配置管理 ────────────────────────────────

  describe('getConfig', () => {
    it('返回配置副本', () => {
      const config: EventTriggerConfig = {
        randomEventProbability: 0.3,
        maxActiveEvents: 5,
        cooldownDefaultTurns: 10,
        fixedEventCheckInterval: 1,
      };
      const copy = getConfig(config);
      expect(copy).toEqual(config);
      expect(copy).not.toBe(config);
    });
  });

  describe('updateConfig', () => {
    it('局部更新配置', () => {
      const config: EventTriggerConfig = {
        randomEventProbability: 0.3,
        maxActiveEvents: 5,
        cooldownDefaultTurns: 10,
        fixedEventCheckInterval: 1,
      };
      const updated = updateConfig(config, { maxActiveEvents: 10 });
      expect(updated.maxActiveEvents).toBe(10);
      expect(updated.randomEventProbability).toBe(0.3);
    });
  });

  // ─── 序列化 ──────────────────────────────────

  describe('serializeState / deserializeState', () => {
    it('往返一致性', () => {
      const inst = makeInstance();
      const activeEvents = new Map([['inst-1', inst]]);
      const completedEventIds = new Set<EventId>(['evt-a']);
      const cooldowns = new Map<EventId, number>([['evt-1', 5]]);

      const data = serializeState(activeEvents, completedEventIds, cooldowns);

      const restoredActive = new Map<string, EventInstance>();
      const restoredCompleted = new Set<EventId>();
      const restoredCooldowns = new Map<EventId, number>();

      deserializeState(data, restoredActive, restoredCompleted, restoredCooldowns);

      expect(restoredActive.get('inst-1')).toEqual(inst);
      expect(restoredCompleted.has('evt-a')).toBe(true);
      expect(restoredCooldowns.get('evt-1')).toBe(5);
    });
  });

  // ─── loadPredefinedEvents ────────────────────

  describe('loadPredefinedEvents', () => {
    it('加载预定义事件到注册表', () => {
      const eventDefs = new Map<EventId, EventDef>();
      loadPredefinedEvents(eventDefs);
      expect(eventDefs.size).toBeGreaterThan(0);
    });
  });

  // ─── createEventInstance ─────────────────────

  describe('createEventInstance', () => {
    it('创建事件实例', () => {
      const def = makeDef({ expireAfterTurns: 5 });
      const counter = { value: 0 };

      const inst = createEventInstance(def, 10, counter);

      expect(inst.instanceId).toBe('event-inst-1');
      expect(inst.eventDefId).toBe('evt-1');
      expect(inst.triggeredTurn).toBe(10);
      expect(inst.expireTurn).toBe(15);
      expect(inst.status).toBe('active');
      expect(counter.value).toBe(1);
    });

    it('无过期时间时 expireTurn 为 null', () => {
      const def = makeDef({ expireAfterTurns: undefined });
      const counter = { value: 0 };
      const inst = createEventInstance(def, 10, counter);
      expect(inst.expireTurn).toBeNull();
    });

    it('计数器递增', () => {
      const def = makeDef();
      const counter = { value: 5 };
      createEventInstance(def, 1, counter);
      expect(counter.value).toBe(6);
    });
  });

  // ─── checkFixedConditions ────────────────────

  describe('checkFixedConditions', () => {
    it('无条件时通过', () => {
      const def = makeDef();
      expect(checkFixedConditions(def, 10, new Set())).toBe(true);
    });

    it('条件满足时通过', () => {
      const def = makeDef({
        triggerConditions: [{ type: 'turn_range', params: { minTurn: 5 } }],
      });
      expect(checkFixedConditions(def, 10, new Set())).toBe(true);
    });

    it('条件不满足时不通过', () => {
      const def = makeDef({
        triggerConditions: [{ type: 'turn_range', params: { minTurn: 20 } }],
      });
      expect(checkFixedConditions(def, 10, new Set())).toBe(false);
    });

    it('event_completed 条件检查', () => {
      const def = makeDef({
        triggerConditions: [{ type: 'event_completed', params: { eventId: 'evt-prereq' } }],
      });
      expect(checkFixedConditions(def, 10, new Set(['evt-prereq']))).toBe(true);
      expect(checkFixedConditions(def, 10, new Set())).toBe(false);
    });
  });

  // ─── checkChainPrerequisites ─────────────────

  describe('checkChainPrerequisites', () => {
    it('无前置条件时通过', () => {
      const def = makeDef();
      expect(checkChainPrerequisites(def, new Set())).toBe(true);
    });

    it('前置条件全部满足', () => {
      const def = makeDef({ prerequisiteEventIds: ['evt-a', 'evt-b'] });
      expect(checkChainPrerequisites(def, new Set(['evt-a', 'evt-b']))).toBe(true);
    });

    it('前置条件部分不满足', () => {
      const def = makeDef({ prerequisiteEventIds: ['evt-a', 'evt-b'] });
      expect(checkChainPrerequisites(def, new Set(['evt-a']))).toBe(false);
    });
  });

  // ─── triggerEventLogic ───────────────────────

  describe('triggerEventLogic', () => {
    it('成功触发事件', () => {
      const deps = mockDeps();
      const def = makeDef();
      const ctx = {
        eventDefs: new Map([['evt-1', def]]),
        activeEvents: new Map<string, EventInstance>(),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
        config: {
          randomEventProbability: 0.3,
          maxActiveEvents: 5,
          cooldownDefaultTurns: 10,
          fixedEventCheckInterval: 1,
        },
        instanceCounter: { value: 0 },
        deps,
        canTrigger: () => true,
      };

      const result = triggerEventLogic('evt-1', 10, ctx);

      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe('evt-1');
      expect(ctx.activeEvents.size).toBe(1);
    });

    it('事件不存在时触发失败', () => {
      const ctx = {
        eventDefs: new Map<EventId, EventDef>(),
        activeEvents: new Map<string, EventInstance>(),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
        config: {
          randomEventProbability: 0.3,
          maxActiveEvents: 5,
          cooldownDefaultTurns: 10,
          fixedEventCheckInterval: 1,
        },
        instanceCounter: { value: 0 },
        deps: undefined,
        canTrigger: () => true,
      };

      const result = triggerEventLogic('not-exist', 10, ctx);
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('已有活跃实例时不可重复触发', () => {
      const def = makeDef();
      const existing = makeInstance({ eventDefId: 'evt-1' });
      const ctx = {
        eventDefs: new Map([['evt-1', def]]),
        activeEvents: new Map([['inst-old', existing]]),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
        config: {
          randomEventProbability: 0.3,
          maxActiveEvents: 5,
          cooldownDefaultTurns: 10,
          fixedEventCheckInterval: 1,
        },
        instanceCounter: { value: 0 },
        deps: undefined,
        canTrigger: () => true,
      };

      const result = triggerEventLogic('evt-1', 10, ctx);
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('已有活跃实例');
    });

    it('不满足触发条件时失败', () => {
      const def = makeDef();
      const ctx = {
        eventDefs: new Map([['evt-1', def]]),
        activeEvents: new Map<string, EventInstance>(),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
        config: {
          randomEventProbability: 0.3,
          maxActiveEvents: 5,
          cooldownDefaultTurns: 10,
          fixedEventCheckInterval: 1,
        },
        instanceCounter: { value: 0 },
        deps: undefined,
        canTrigger: () => false,
      };

      const result = triggerEventLogic('evt-1', 10, ctx);
      expect(result.triggered).toBe(false);
    });

    it('强制触发忽略条件检查', () => {
      const def = makeDef();
      const ctx = {
        eventDefs: new Map([['evt-1', def]]),
        activeEvents: new Map<string, EventInstance>(),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
        config: {
          randomEventProbability: 0.3,
          maxActiveEvents: 5,
          cooldownDefaultTurns: 10,
          fixedEventCheckInterval: 1,
        },
        instanceCounter: { value: 0 },
        deps: undefined,
        canTrigger: () => false,
      };

      const result = triggerEventLogic('evt-1', 10, ctx, true);
      expect(result.triggered).toBe(true);
    });

    it('触发时发出 event:triggered 事件', () => {
      const deps = mockDeps();
      const def = makeDef();
      const ctx = {
        eventDefs: new Map([['evt-1', def]]),
        activeEvents: new Map<string, EventInstance>(),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
        config: {
          randomEventProbability: 0.3,
          maxActiveEvents: 5,
          cooldownDefaultTurns: 10,
          fixedEventCheckInterval: 1,
        },
        instanceCounter: { value: 0 },
        deps,
        canTrigger: () => true,
      };

      triggerEventLogic('evt-1', 10, ctx);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('event:triggered', expect.objectContaining({
        eventDefId: 'evt-1',
      }));
    });
  });
});
