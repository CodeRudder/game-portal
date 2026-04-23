/**
 * EventTriggerSystem 单元测试 — p2
 *
 * 覆盖：
 * - 事件过期
 * - 活跃事件管理
 * - 事件类型矩阵完整性
 * - 存档序列化
 * - 配置
 * - canTrigger 综合测试
 * - 概率计算（v15 迁移）
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
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
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

describe('EventTriggerSystem p2', () => {
  let sys: EventTriggerSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // 7. 事件过期
  // ═══════════════════════════════════════════
  describe('事件过期', () => {
    it('expireEvents 清理过期事件', () => {
      const def = createRandomEventDef({ expireAfterTurns: 3 });
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      const expired = sys.expireEvents(5);
      expect(expired.length).toBeGreaterThanOrEqual(1);
    });

    it('expireEvents 不清理未过期事件', () => {
      const def = createRandomEventDef({ expireAfterTurns: 10 });
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      const expired = sys.expireEvents(5);
      const hasOurEvent = expired.some(e => e.eventDefId === def.id);
      expect(hasOurEvent).toBe(false);
    });

    it('expireEvents 发出 event:expired 事件', () => {
      const deps = mockDeps();
      const s = new EventTriggerSystem();
      s.init(deps);
      const def = createRandomEventDef({ expireAfterTurns: 2 });
      s.registerEvent(def);
      s.forceTriggerEvent(def.id, 1);

      s.expireEvents(5);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:expired',
        expect.objectContaining({
          eventDefId: def.id,
        }),
      );
    });
  });

  // ═══════════════════════════════════════════
  // 8. 活跃事件管理
  // ═══════════════════════════════════════════
  describe('活跃事件管理', () => {
    it('getActiveEvents 返回活跃事件列表', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      expect(sys.getActiveEvents().length).toBeGreaterThanOrEqual(1);
    });

    it('getInstance 获取指定实例', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      expect(sys.getInstance(r.instance!.instanceId)).toBeDefined();
    });

    it('getInstance 不存在返回 undefined', () => {
      expect(sys.getInstance('non-existent')).toBeUndefined();
    });

    it('getCompletedEventIds 返回已完成事件', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);
      sys.resolveEvent(r.instance!.instanceId, 'opt-a');

      expect(sys.getCompletedEventIds()).toContain(def.id);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 事件类型矩阵完整性
  // ═══════════════════════════════════════════
  describe('事件类型矩阵完整性', () => {
    it('预定义事件包含三种类型', () => {
      const types = new Set(Object.values(PREDEFINED_EVENTS).map(d => d.triggerType));
      expect(types.has('random')).toBe(true);
      expect(types.has('fixed')).toBe(true);
      expect(types.has('chain')).toBe(true);
    });

    it('预定义事件ID唯一', () => {
      const ids = Object.values(PREDEFINED_EVENTS).map(d => d.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('每个事件至少有一个选项', () => {
      for (const def of Object.values(PREDEFINED_EVENTS)) {
        expect(def.options.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('每个选项都有后果定义', () => {
      for (const def of Object.values(PREDEFINED_EVENTS)) {
        for (const opt of def.options) {
          expect(opt.consequences).toBeDefined();
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 10. 存档序列化
  // ═══════════════════════════════════════════
  describe('存档序列化', () => {
    it('serialize 导出完整存档', () => {
      const data = sys.serialize();
      expect(data).toHaveProperty('activeEvents');
      expect(data).toHaveProperty('completedEventIds');
      expect(data).toHaveProperty('cooldowns');
      expect(data).toHaveProperty('version');
    });

    it('deserialize 恢复存档', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      const data = sys.serialize();
      const newSys = createSystem();
      newSys.deserialize(data);

      expect(newSys.getActiveEvents().length).toBe(data.activeEvents.length);
    });

    it('deserialize 恢复已完成事件', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);
      sys.resolveEvent(r.instance!.instanceId, 'opt-a');

      const data = sys.serialize();
      const newSys = createSystem();
      newSys.deserialize(data);

      expect(newSys.isEventCompleted(def.id)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 配置
  // ═══════════════════════════════════════════
  describe('配置', () => {
    it('getConfig 返回默认配置', () => {
      const config = sys.getConfig();
      expect(config.randomEventProbability).toBe(DEFAULT_EVENT_TRIGGER_CONFIG.randomEventProbability);
      expect(config.maxActiveEvents).toBe(DEFAULT_EVENT_TRIGGER_CONFIG.maxActiveEvents);
    });

    it('setConfig 更新配置', () => {
      sys.setConfig({ randomEventProbability: 0.8 });
      expect(sys.getConfig().randomEventProbability).toBe(0.8);
    });
  });

  // ═══════════════════════════════════════════
  // 12. canTrigger 综合测试
  // ═══════════════════════════════════════════
  describe('canTrigger 综合测试', () => {
    it('已完成的事件不能再触发', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);
      sys.resolveEvent(r.instance!.instanceId, 'opt-a');

      expect(sys.canTrigger(def.id, 2)).toBe(false);
    });

    it('活跃事件不能重复触发', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      expect(sys.canTrigger(def.id, 1)).toBe(false);
    });

    it('不存在的事件不能触发', () => {
      expect(sys.canTrigger('non-existent', 1)).toBe(false);
    });

    it('达到最大活跃事件数时不能再触发', () => {
      const maxEvents = sys.getConfig().maxActiveEvents;

      for (let i = 0; i < maxEvents; i++) {
        const def = createRandomEventDef({ id: `max-test-${i}` });
        sys.registerEvent(def);
        sys.forceTriggerEvent(def.id, 1);
      }

      const extraDef = createRandomEventDef({ id: 'extra' });
      sys.registerEvent(extraDef);
      expect(sys.canTrigger('extra', 1)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 13. 概率计算（v15 迁移）
  // ═══════════════════════════════════════════
  describe('概率计算', () => {
    it('calculateProbability — 仅基础概率，无修正', () => {
      const result = sys.calculateProbability({
        baseProbability: 0.5,
        modifiers: [],
      });
      expect(result.baseProbability).toBe(0.5);
      expect(result.additiveTotal).toBe(0);
      expect(result.multiplicativeTotal).toBe(1);
      expect(result.finalProbability).toBe(0.5);
    });

    it('calculateProbability — 公式 P = clamp(base + Σ(add) × Π(mul), 0, 1)', () => {
      const result = sys.calculateProbability({
        baseProbability: 0.3,
        modifiers: [
          { name: 'bonus1', additiveBonus: 0.1, multiplicativeBonus: 1.2, active: true },
          { name: 'bonus2', additiveBonus: 0.05, multiplicativeBonus: 0.9, active: true },
        ],
      });
      // Σ(add) = 0.1 + 0.05 = 0.15
      expect(result.additiveTotal).toBeCloseTo(0.15);
      // Π(mul) = 1.2 × 0.9 = 1.08
      expect(result.multiplicativeTotal).toBeCloseTo(1.08);
      // P = clamp((0.3 + 0.15) × 1.08, 0, 1) = clamp(0.486, 0, 1) = 0.486
      expect(result.finalProbability).toBeCloseTo(0.486);
    });

    it('calculateProbability — 非活跃修正不参与计算', () => {
      const result = sys.calculateProbability({
        baseProbability: 0.5,
        modifiers: [
          { name: 'active', additiveBonus: 0.2, multiplicativeBonus: 1.5, active: true },
          { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 2.0, active: false },
        ],
      });
      // Σ(add) = 0.2 (仅 active)
      expect(result.additiveTotal).toBeCloseTo(0.2);
      // Π(mul) = 1.5 (仅 active)
      expect(result.multiplicativeTotal).toBeCloseTo(1.5);
      // P = clamp((0.5 + 0.2) × 1.5, 0, 1) = clamp(1.05, 0, 1) = 1.0
      expect(result.finalProbability).toBe(1.0);
    });

    it('calculateProbability — 结果 clamp 到 [0, 1]', () => {
      // 上限 clamp
      const high = sys.calculateProbability({
        baseProbability: 0.8,
        modifiers: [
          { name: 'big', additiveBonus: 0.5, multiplicativeBonus: 2.0, active: true },
        ],
      });
      // P = clamp((0.8 + 0.5) × 2.0, 0, 1) = clamp(2.6, 0, 1) = 1.0
      expect(high.finalProbability).toBe(1.0);

      // 下限 clamp
      const low = sys.calculateProbability({
        baseProbability: 0.1,
        modifiers: [
          { name: 'neg', additiveBonus: -0.2, multiplicativeBonus: 1.0, active: true },
        ],
      });
      // P = clamp((0.1 + (-0.2)) × 1.0, 0, 1) = clamp(-0.1, 0, 1) = 0.0
      expect(low.finalProbability).toBe(0.0);
    });

    it('calculateProbability — triggered 由随机数决定', () => {
      // baseProbability = 1.0 时必然触发
      const always = sys.calculateProbability({
        baseProbability: 1.0,
        modifiers: [],
      });
      expect(always.triggered).toBe(true);

      // baseProbability = 0.0 时永远不触发
      const never = sys.calculateProbability({
        baseProbability: 0.0,
        modifiers: [],
      });
      expect(never.triggered).toBe(false);
    });

    it('registerProbabilityCondition / getProbabilityCondition / reset', () => {
      // 未注册返回 undefined
      expect(sys.getProbabilityCondition('non-existent')).toBeUndefined();

      // 注册后可获取
      const condition: ProbabilityCondition = {
        baseProbability: 0.4,
        modifiers: [{ name: 'test', additiveBonus: 0.1, multiplicativeBonus: 1.0, active: true }],
      };
      sys.registerProbabilityCondition('test-event', condition);
      expect(sys.getProbabilityCondition('test-event')).toEqual(condition);

      // reset 清除
      sys.reset();
      expect(sys.getProbabilityCondition('test-event')).toBeUndefined();
    });
  });

});
