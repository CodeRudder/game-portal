/**
 * EventTriggerLifecycle 单元测试
 *
 * 覆盖：resolveEvent、expireEvents
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveEvent, expireEvents } from '../EventTriggerLifecycle';
import type { EventLifecycleState } from '../EventTriggerLifecycle';
import type { EventInstance, EventId, EventDef } from '../../../core/event';
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

function makeDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-1',
    title: '测试事件',
    description: '描述',
    triggerType: 'fixed',
    urgency: 'medium',
    scope: 'global',
    options: [
      {
        id: 'opt-1',
        text: '选项1',
        consequences: { description: '结果1', resourceChanges: { gold: 100 } },
      },
      {
        id: 'opt-2',
        text: '选项2',
        isDefault: true,
        consequences: { description: '结果2', triggerEventId: 'evt-2' },
      },
    ],
    ...overrides,
  };
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

function makeState(overrides: Partial<EventLifecycleState> = {}): EventLifecycleState {
  const def = makeDef();
  const inst = makeInstance();
  const activeEvents = new Map<string, EventInstance>();
  activeEvents.set('inst-1', inst);
  return {
    activeEvents,
    completedEventIds: new Set<EventId>(),
    cooldowns: new Map<EventId, number>(),
    eventDefs: new Map<EventId, EventDef>([['evt-1', def]]),
    ...overrides,
  };
}

describe('EventTriggerLifecycle', () => {
  describe('resolveEvent', () => {
    it('成功解决事件', () => {
      const deps = mockDeps();
      const state = makeState();

      const result = resolveEvent('inst-1', 'opt-1', state, deps);

      expect(result).not.toBeNull();
      expect(result!.instanceId).toBe('inst-1');
      expect(result!.optionId).toBe('opt-1');
      expect(result!.consequences.resourceChanges).toEqual({ gold: 100 });
    });

    it('解决事件后状态变为 resolved', () => {
      const state = makeState();
      const inst = state.activeEvents.get('inst-1')!;
      resolveEvent('inst-1', 'opt-1', state);
      expect(inst.status).toBe('resolved');
    });

    it('解决事件后记录到 completedEventIds', () => {
      const state = makeState();
      resolveEvent('inst-1', 'opt-1', state);
      expect(state.completedEventIds.has('evt-1')).toBe(true);
    });

    it('解决事件后从活跃列表移除', () => {
      const state = makeState();
      resolveEvent('inst-1', 'opt-1', state);
      expect(state.activeEvents.has('inst-1')).toBe(false);
    });

    it('有冷却时间时设置 cooldown', () => {
      const def = makeDef({ cooldownTurns: 10 });
      const state = makeState({
        eventDefs: new Map([['evt-1', def]]),
      });

      resolveEvent('inst-1', 'opt-1', state);
      expect(state.cooldowns.get('evt-1')).toBe(15); // triggeredTurn(5) + cooldownTurns(10)
    });

    it('返回 chainEventId', () => {
      const state = makeState();
      const result = resolveEvent('inst-1', 'opt-2', state);
      expect(result!.chainEventId).toBe('evt-2');
    });

    it('实例不存在返回 null', () => {
      const state = makeState();
      expect(resolveEvent('not-exist', 'opt-1', state)).toBeNull();
    });

    it('实例状态非 active 返回 null', () => {
      const inst = makeInstance({ status: 'resolved' });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst]]),
      });
      expect(resolveEvent('inst-1', 'opt-1', state)).toBeNull();
    });

    it('事件定义不存在返回 null', () => {
      const inst = makeInstance();
      const state = makeState({
        eventDefs: new Map(),
        activeEvents: new Map([['inst-1', inst]]),
      });
      expect(resolveEvent('inst-1', 'opt-1', state)).toBeNull();
    });

    it('选项不存在返回 null', () => {
      const state = makeState();
      expect(resolveEvent('inst-1', 'not-exist', state)).toBeNull();
    });

    it('无 deps 时不报错', () => {
      const state = makeState();
      const result = resolveEvent('inst-1', 'opt-1', state);
      expect(result).not.toBeNull();
    });

    it('发出 event:resolved 事件', () => {
      const deps = mockDeps();
      const state = makeState();
      resolveEvent('inst-1', 'opt-1', state, deps);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('event:resolved', expect.objectContaining({
        instanceId: 'inst-1',
        eventDefId: 'evt-1',
        optionId: 'opt-1',
      }));
    });
  });

  describe('expireEvents', () => {
    it('过期事件被移除并返回', () => {
      const inst = makeInstance({ expireTurn: 10 });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst]]),
      });

      const expired = expireEvents(10, state);

      expect(expired).toHaveLength(1);
      expect(expired[0].instanceId).toBe('inst-1');
      expect(expired[0].status).toBe('expired');
      expect(state.activeEvents.has('inst-1')).toBe(false);
    });

    it('未过期事件保留', () => {
      const inst = makeInstance({ expireTurn: 20 });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst]]),
      });

      const expired = expireEvents(10, state);
      expect(expired).toHaveLength(0);
      expect(state.activeEvents.has('inst-1')).toBe(true);
    });

    it('expireTurn 为 null 时不过期', () => {
      const inst = makeInstance({ expireTurn: null });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst]]),
      });

      const expired = expireEvents(100, state);
      expect(expired).toHaveLength(0);
    });

    it('混合过期和未过期', () => {
      const inst1 = makeInstance({ instanceId: 'inst-1', expireTurn: 5 });
      const inst2 = makeInstance({ instanceId: 'inst-2', expireTurn: 20 });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst1], ['inst-2', inst2]]),
      });

      const expired = expireEvents(10, state);
      expect(expired).toHaveLength(1);
      expect(expired[0].instanceId).toBe('inst-1');
      expect(state.activeEvents.size).toBe(1);
    });

    it('发出 event:expired 事件', () => {
      const deps = mockDeps();
      const inst = makeInstance({ expireTurn: 10 });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst]]),
      });

      expireEvents(10, state, deps);
      expect(deps.eventBus.emit).toHaveBeenCalledWith('event:expired', expect.objectContaining({
        instanceId: 'inst-1',
        eventDefId: 'evt-1',
      }));
    });

    it('无 deps 时不报错', () => {
      const inst = makeInstance({ expireTurn: 10 });
      const state = makeState({
        activeEvents: new Map([['inst-1', inst]]),
      });
      expect(() => expireEvents(10, state)).not.toThrow();
    });
  });
});
