/**
 * EventTriggerSystem 单元测试 — p3
 *
 * 覆盖：
 * - 条件评估
 * - 概率公式集成触发
 */

import { EventTriggerSystem } from '../EventTriggerSystem';
import type { ISystemDeps } from '../../../core/types';
import type {
  EventDef,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
} from '../../../core/event';
import type { ProbabilityCondition } from '../../../core/event/event-v15-event.types';
import {
  PREDEFINED_EVENTS,
  DEFAULT_EVENT_TRIGGER_CONFIG,
} from '../../../core/event';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

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

function createSystem(): EventTriggerSystem {
  const sys = new EventTriggerSystem();
  sys.init(mockDeps());
  return sys;
}

function createRandomEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-random-01',
    title: '测试随机事件',
    description: '这是一个测试用的随机事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 0.5,
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        description: '选择A',
        consequences: {
          description: '获得金币',
          resourceChanges: { gold: 100 },
        },
      },
      {
        id: 'opt-b',
        text: '选项B',
        isDefault: true,
        consequences: {
          description: '获得粮草',
          resourceChanges: { grain: 50 },
        },
      },
    ],
    ...overrides,
  };
}

function createFixedEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-fixed-01',
    title: '测试固定事件',
    description: '这是一个测试用的固定事件',
    triggerType: 'fixed',
    urgency: 'high',
    scope: 'global',
    triggerConditions: [],
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        consequences: {
          description: '固定事件结果',
        },
      },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════

describe('EventTriggerSystem p3', () => {
  let sys: EventTriggerSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // 14. 条件评估
  // ═══════════════════════════════════════════
  describe('条件评估', () => {
    describe('turn_range 条件', () => {
      it('minTurn / maxTurn / turnInterval 组合验证', () => {
        // minTurn
        const minDef = createFixedEventDef({
          id: 'turn-min', triggerConditions: [{ type: 'turn_range', params: { minTurn: 5 } }],
        });
        sys.registerEvent(minDef);
        expect(sys.canTrigger('turn-min', 3)).toBe(false);
        expect(sys.canTrigger('turn-min', 5)).toBe(true);

        // maxTurn
        const maxDef = createFixedEventDef({
          id: 'turn-max', triggerConditions: [{ type: 'turn_range', params: { maxTurn: 10 } }],
        });
        sys.registerEvent(maxDef);
        expect(sys.canTrigger('turn-max', 10)).toBe(true);
        expect(sys.canTrigger('turn-max', 11)).toBe(false);

        // turnInterval
        const intDef = createFixedEventDef({
          id: 'turn-int', triggerConditions: [{ type: 'turn_range', params: { turnInterval: 5 } }],
        });
        sys.registerEvent(intDef);
        expect(sys.canTrigger('turn-int', 5)).toBe(true);
        expect(sys.canTrigger('turn-int', 7)).toBe(false);

        // 组合 minTurn + maxTurn
        const rangeDef = createFixedEventDef({
          id: 'turn-range', triggerConditions: [{ type: 'turn_range', params: { minTurn: 3, maxTurn: 8 } }],
        });
        sys.registerEvent(rangeDef);
        expect(sys.canTrigger('turn-range', 2)).toBe(false);
        expect(sys.canTrigger('turn-range', 5)).toBe(true);
        expect(sys.canTrigger('turn-range', 9)).toBe(false);
      });
    });

    describe('resource_threshold 条件', () => {
      it('资源满足条件时触发', () => {
        const def = createFixedEventDef({
          id: 'res-check',
          triggerConditions: [
            { type: 'resource_threshold', params: { resource: 'gold', minAmount: 100 } },
          ],
        });
        sys.registerEvent(def);

        // 无 gameState 时默认通过（兼容旧逻辑）
        expect(sys.canTrigger('res-check', 1)).toBe(true);
      });
    });

    describe('event_completed 条件', () => {
      it('前置事件完成后可触发，无 eventId 默认通过', () => {
        // 无 eventId 默认通过
        const noIdDef = createFixedEventDef({
          id: 'no-event-id',
          triggerConditions: [{ type: 'event_completed', params: {} }],
        });
        sys.registerEvent(noIdDef);
        expect(sys.canTrigger('no-event-id', 1)).toBe(true);

        // 注册前置事件
        const pre = createRandomEventDef({ id: 'pre-event' });
        sys.registerEvent(pre);

        const def = createFixedEventDef({
          id: 'need-complete',
          triggerConditions: [{ type: 'event_completed', params: { eventId: 'pre-event' } }],
        });
        sys.registerEvent(def);

        // 未完成前置
        expect(sys.canTrigger('need-complete', 1)).toBe(false);

        // 完成前置事件
        const r = sys.forceTriggerEvent('pre-event', 1);
        sys.resolveEvent(r.instance!.instanceId, 'opt-a');
        expect(sys.canTrigger('need-complete', 2)).toBe(true);
      });
    });

    describe('多条件 AND 逻辑', () => {
      it('所有条件必须满足', () => {
        const def = createFixedEventDef({
          id: 'multi-cond',
          triggerConditions: [
            { type: 'turn_range', params: { minTurn: 5 } },
            { type: 'turn_range', params: { maxTurn: 10 } },
          ],
        });
        sys.registerEvent(def);

        // turn=3 → minTurn 不满足
        expect(sys.canTrigger('multi-cond', 3)).toBe(false);
        // turn=7 → 都满足
        expect(sys.canTrigger('multi-cond', 7)).toBe(true);
        // turn=12 → maxTurn 不满足
        expect(sys.canTrigger('multi-cond', 12)).toBe(false);
      });
    });

    describe('空/未知条件', () => {
      it('空 triggerConditions 和未知类型默认通过', () => {
        // 空数组
        const emptyDef = createFixedEventDef({ id: 'no-cond', triggerConditions: [] });
        sys.registerEvent(emptyDef);
        expect(sys.canTrigger('no-cond', 1)).toBe(true);

        // undefined
        const undefDef = createFixedEventDef({ id: 'undef-cond' });
        delete (undefDef as unknown as Record<string, unknown>).triggerConditions;
        sys.registerEvent(undefDef);
        expect(sys.canTrigger('undef-cond', 1)).toBe(true);

        // 未知类型
        const unkDef = createFixedEventDef({
          id: 'unknown-cond',
          triggerConditions: [{ type: 'future_condition' as unknown as Record<string, unknown>, params: {} }],
        });
        sys.registerEvent(unkDef);
        expect(sys.canTrigger('unknown-cond', 1)).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 15. 概率公式集成触发
  // ═══════════════════════════════════════════
  describe('概率公式集成触发', () => {
    it('注册概率条件后 checkAndTriggerEvents 使用公式', () => {
      const def = createRandomEventDef({ id: 'prob-event' });
      sys.registerEvent(def);

      // 注册概率条件：概率 = 1.0 必然触发
      sys.registerProbabilityCondition('prob-event', {
        baseProbability: 1.0,
        modifiers: [],
      });

      const triggered = sys.checkAndTriggerEvents(1);
      const found = triggered.find((i) => i.eventDefId === 'prob-event');
      expect(found).toBeDefined();
    });

    it('概率条件概率 = 0 时不触发', () => {
      const def = createRandomEventDef({ id: 'no-prob-event' });
      sys.registerEvent(def);

      // 注册概率条件：概率 = 0.0 不触发
      sys.registerProbabilityCondition('no-prob-event', {
        baseProbability: 0.0,
        modifiers: [],
      });

      const triggered = sys.checkAndTriggerEvents(1);
      const found = triggered.find((i) => i.eventDefId === 'no-prob-event');
      expect(found).toBeUndefined();
    });

    it('无概率条件时回退到简单概率', () => {
      const def = createRandomEventDef({
        id: 'simple-prob',
        triggerProbability: 1.0, // 必然触发
      });
      sys.registerEvent(def);

      // 不注册概率条件，使用 triggerProbability
      const triggered = sys.checkAndTriggerEvents(1);
      const found = triggered.find((i) => i.eventDefId === 'simple-prob');
      expect(found).toBeDefined();
    });
  });
});
