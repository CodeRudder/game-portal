/**
 * EventTriggerSerialization 单元测试
 *
 * 覆盖：serializeEventTriggerState、deserializeEventTriggerState
 */
import { describe, it, expect } from 'vitest';
import {
  serializeEventTriggerState,
  deserializeEventTriggerState,
} from '../EventTriggerSerialization';
import type { EventInstance, EventId } from '../../../core/event';

function makeInstance(overrides: Partial<EventInstance> = {}): EventInstance {
  return {
    instanceId: 'inst-1',
    eventDefId: 'evt-1',
    triggeredTurn: 5,
    expireTurn: 10,
    status: 'active',
    ...overrides,
  };
}

describe('EventTriggerSerialization', () => {
  describe('serializeEventTriggerState', () => {
    it('序列化空状态', () => {
      const state = {
        activeEvents: new Map<string, EventInstance>(),
        completedEventIds: new Set<EventId>(),
        cooldowns: new Map<EventId, number>(),
      };

      const data = serializeEventTriggerState(state);

      expect(data.activeEvents).toEqual([]);
      expect(data.completedEventIds).toEqual([]);
      expect(data.banners).toEqual([]);
      expect(data.cooldowns).toEqual({});
      expect(data.version).toBeDefined();
    });

    it('序列化有数据的状态', () => {
      const inst1 = makeInstance({ instanceId: 'inst-1', eventDefId: 'evt-1' });
      const inst2 = makeInstance({ instanceId: 'inst-2', eventDefId: 'evt-2' });
      const activeEvents = new Map<string, EventInstance>();
      activeEvents.set('inst-1', inst1);
      activeEvents.set('inst-2', inst2);

      const completedEventIds = new Set<EventId>(['evt-a', 'evt-b']);
      const cooldowns = new Map<EventId, number>();
      cooldowns.set('evt-1', 5);
      cooldowns.set('evt-2', 10);

      const data = serializeEventTriggerState({ activeEvents, completedEventIds, cooldowns });

      expect(data.activeEvents).toHaveLength(2);
      expect(data.completedEventIds).toHaveLength(2);
      expect(data.cooldowns).toEqual({ 'evt-1': 5, 'evt-2': 10 });
    });
  });

  describe('deserializeEventTriggerState', () => {
    it('反序列化空数据', () => {
      const data = {
        activeEvents: [],
        completedEventIds: [],
        banners: [],
        cooldowns: {},
        version: 1,
      };

      const state = deserializeEventTriggerState(data);

      expect(state.activeEvents.size).toBe(0);
      expect(state.completedEventIds.size).toBe(0);
      expect(state.cooldowns.size).toBe(0);
    });

    it('反序列化完整数据', () => {
      const inst = makeInstance({ instanceId: 'inst-1', eventDefId: 'evt-1' });
      const data = {
        activeEvents: [inst],
        completedEventIds: ['evt-a', 'evt-b'],
        banners: [],
        cooldowns: { 'evt-1': 5, 'evt-2': 10 },
        version: 1,
      };

      const state = deserializeEventTriggerState(data);

      expect(state.activeEvents.size).toBe(1);
      expect(state.activeEvents.get('inst-1')).toEqual(inst);
      expect(state.completedEventIds.has('evt-a')).toBe(true);
      expect(state.completedEventIds.has('evt-b')).toBe(true);
      expect(state.cooldowns.get('evt-1')).toBe(5);
      expect(state.cooldowns.get('evt-2')).toBe(10);
    });

    it('处理 undefined activeEvents', () => {
      const data = {
        activeEvents: undefined,
        completedEventIds: [],
        banners: [],
        cooldowns: {},
        version: 1,
      };

      const state = deserializeEventTriggerState(data);
      expect(state.activeEvents.size).toBe(0);
    });

    it('处理 undefined cooldowns', () => {
      const data = {
        activeEvents: [],
        completedEventIds: [],
        banners: [],
        cooldowns: undefined,
        version: 1,
      };

      const state = deserializeEventTriggerState(data);
      expect(state.cooldowns.size).toBe(0);
    });

    it('序列化→反序列化往返一致性', () => {
      const inst = makeInstance({ instanceId: 'inst-1', eventDefId: 'evt-1' });
      const original = {
        activeEvents: new Map([['inst-1', inst]]),
        completedEventIds: new Set<EventId>(['evt-a']),
        cooldowns: new Map<EventId, number>([['evt-1', 5]]),
      };

      const serialized = serializeEventTriggerState(original);
      const restored = deserializeEventTriggerState(serialized);

      expect(restored.activeEvents.get('inst-1')).toEqual(inst);
      expect(restored.completedEventIds.has('evt-a')).toBe(true);
      expect(restored.cooldowns.get('evt-1')).toBe(5);
    });
  });
});
