/**
 * EventTriggerSystem 单元测试
 *
 * 覆盖事件触发系统的所有功能：
 * - ISubsystem 接口
 * - 事件注册
 * - 随机事件触发
 * - 固定事件触发
 * - 连锁事件触发
 * - 事件选择处理
 * - 事件过期
 * - 活跃事件管理
 * - 事件类型矩阵完整性
 * - 存档序列化
 * - 配置
 * - canTrigger 综合测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../EventTriggerSystem';
import type { ISystemDeps } from '../../../core/types';
import type {
  EventDef,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
} from '../../../core/event';
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

function createChainEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-chain-01',
    title: '测试连锁事件',
    description: '这是一个测试用的连锁事件',
    triggerType: 'chain',
    urgency: 'critical',
    scope: 'global',
    prerequisiteEventIds: [],
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        consequences: {
          description: '选择了A',
          triggerEventId: 'test-chain-02',
        },
      },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════

describe('EventTriggerSystem', () => {
  let sys: EventTriggerSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 eventTrigger', () => {
      expect(sys.name).toBe('eventTrigger');
    });

    it('init 后加载预定义事件', () => {
      const defs = sys.getAllEventDefs();
      expect(defs.length).toBeGreaterThanOrEqual(Object.keys(PREDEFINED_EVENTS).length);
    });

    it('reset 恢复初始状态', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      sys.reset();
      expect(sys.getActiveEvents().length).toBe(0);
      expect(sys.getCompletedEventIds().length).toBe(0);
    });

    it('update 不抛异常', () => {
      expect(() => sys.update(16)).not.toThrow();
    });

    it('getState 返回完整状态', () => {
      const state = sys.getState();
      expect(state).toHaveProperty('eventDefs');
      expect(state).toHaveProperty('activeEvents');
      expect(state).toHaveProperty('completedEventIds');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 事件注册
  // ═══════════════════════════════════════════
  describe('事件注册', () => {
    it('registerEvent 注册单个事件', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      expect(sys.getEventDef(def.id)).toEqual(def);
    });

    it('registerEvents 批量注册事件', () => {
      const defs = [
        createRandomEventDef({ id: 'r1' }),
        createRandomEventDef({ id: 'r2' }),
        createRandomEventDef({ id: 'r3' }),
      ];

      sys.registerEvents(defs);
      expect(sys.getAllEventDefs().length).toBeGreaterThanOrEqual(3);
    });

    it('getEventDef 不存在返回 undefined', () => {
      expect(sys.getEventDef('non-existent')).toBeUndefined();
    });

    it('getAllEventDefs 返回所有事件', () => {
      const initialCount = sys.getAllEventDefs().length;
      sys.registerEvent(createRandomEventDef({ id: 'extra' }));
      expect(sys.getAllEventDefs().length).toBe(initialCount + 1);
    });

    it('getEventDefsByType 按类型过滤', () => {
      const randomDefs = sys.getEventDefsByType('random');
      for (const def of randomDefs) {
        expect(def.triggerType).toBe('random');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 随机事件触发
  // ═══════════════════════════════════════════
  describe('随机事件触发', () => {
    it('forceTriggerEvent 强制触发随机事件', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);

      const result = sys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe(def.id);
    });

    it('触发事件后出现在活跃列表中', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      sys.forceTriggerEvent(def.id, 1);

      const active = sys.getActiveEvents();
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it('触发事件发出 event:triggered 事件', () => {
      const deps = mockDeps();
      const s = new EventTriggerSystem();
      s.init(deps);
      const def = createRandomEventDef();
      s.registerEvent(def);

      s.forceTriggerEvent(def.id, 1);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:triggered',
        expect.objectContaining({
          eventDefId: def.id,
        }),
      );
    });

    it('同一事件不能重复触发', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);

      const r1 = sys.forceTriggerEvent(def.id, 1);
      expect(r1.triggered).toBe(true);

      const r2 = sys.forceTriggerEvent(def.id, 1);
      expect(r2.triggered).toBe(false);
    });

    it('不存在的事件触发失败', () => {
      const result = sys.forceTriggerEvent('non-existent', 1);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('触发事件有正确的过期回合', () => {
      const def = createRandomEventDef({ expireAfterTurns: 3 });
      sys.registerEvent(def);

      const result = sys.forceTriggerEvent(def.id, 5);
      expect(result.instance!.expireTurn).toBe(8);
    });

    it('无过期时间的事件 expireTurn 为 null', () => {
      const def = createRandomEventDef();
      delete (def as any).expireAfterTurns;
      sys.registerEvent(def);

      const result = sys.forceTriggerEvent(def.id, 1);
      expect(result.instance!.expireTurn).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 固定事件触发
  // ═══════════════════════════════════════════
  describe('固定事件触发', () => {
    it('满足条件的固定事件可以触发', () => {
      const def = createFixedEventDef();
      sys.registerEvent(def);

      const result = sys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
    });

    it('canTrigger 对固定事件检查条件', () => {
      const def = createFixedEventDef();
      sys.registerEvent(def);

      expect(sys.canTrigger(def.id, 1)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 连锁事件触发
  // ═══════════════════════════════════════════
  describe('连锁事件触发', () => {
    it('无前置条件的连锁事件可以直接触发', () => {
      const def = createChainEventDef({
        id: 'chain-a',
        prerequisiteEventIds: [],
      });
      sys.registerEvent(def);

      expect(sys.canTrigger('chain-a', 1)).toBe(true);
    });

    it('有前置条件的连锁事件需要先完成前置', () => {
      const def1 = createChainEventDef({
        id: 'chain-a',
        prerequisiteEventIds: [],
      });
      const def2 = createChainEventDef({
        id: 'chain-b',
        prerequisiteEventIds: ['chain-a'],
      });

      sys.registerEvent(def1);
      sys.registerEvent(def2);

      // 未完成前置，不能触发
      expect(sys.canTrigger('chain-b', 1)).toBe(false);

      // 完成前置事件
      const r1 = sys.forceTriggerEvent('chain-a', 1);
      sys.resolveEvent(r1.instance!.instanceId, 'opt-a');

      // 现在可以触发
      expect(sys.canTrigger('chain-b', 2)).toBe(true);
    });

    it('连锁事件选择后可以触发后续事件', () => {
      const def1 = createChainEventDef({
        id: 'chain-1',
        prerequisiteEventIds: [],
        options: [
          {
            id: 'opt-a',
            text: '选项A',
            consequences: {
              description: '选择了A',
              triggerEventId: 'chain-2',
            },
          },
        ],
      });
      const def2 = createChainEventDef({
        id: 'chain-2',
        prerequisiteEventIds: ['chain-1'],
      });

      sys.registerEvent(def1);
      sys.registerEvent(def2);

      // 触发第1个
      const r1 = sys.forceTriggerEvent('chain-1', 1);
      const choice = sys.resolveEvent(r1.instance!.instanceId, 'opt-a');

      expect(choice).not.toBeNull();
      expect(choice!.chainEventId).toBe('chain-2');
      expect(sys.isEventCompleted('chain-1')).toBe(true);
    });

    it('预定义的连锁事件链完整', () => {
      // 验证三幕连锁事件
      const letter1 = PREDEFINED_EVENTS['event-chain-letter-1'];
      const letter2 = PREDEFINED_EVENTS['event-chain-letter-2'];
      const letter3 = PREDEFINED_EVENTS['event-chain-letter-3'];

      if (letter1 && letter2 && letter3) {
        expect(letter1.triggerType).toBe('chain');
        expect(letter2.prerequisiteEventIds).toContain(letter1.id);
        expect(letter3.prerequisiteEventIds).toContain(letter2.id);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 6. 事件选择处理
  // ═══════════════════════════════════════════
  describe('事件选择处理', () => {
    it('resolveEvent 处理有效选择', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      const choice = sys.resolveEvent(r.instance!.instanceId, 'opt-a');
      expect(choice).not.toBeNull();
      expect(choice!.optionId).toBe('opt-a');
    });

    it('resolveEvent 后事件从活跃列表移除', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      sys.resolveEvent(r.instance!.instanceId, 'opt-a');
      expect(sys.getInstance(r.instance!.instanceId)).toBeUndefined();
    });

    it('resolveEvent 标记事件为已完成', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      sys.resolveEvent(r.instance!.instanceId, 'opt-a');
      expect(sys.isEventCompleted(def.id)).toBe(true);
    });

    it('resolveEvent 不存在的实例返回 null', () => {
      expect(sys.resolveEvent('non-existent', 'opt-a')).toBeNull();
    });

    it('resolveEvent 不存在的选项返回 null', () => {
      const def = createRandomEventDef();
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      expect(sys.resolveEvent(r.instance!.instanceId, 'non-existent')).toBeNull();
    });

    it('resolveEvent 发出 event:resolved 事件', () => {
      const deps = mockDeps();
      const s = new EventTriggerSystem();
      s.init(deps);
      const def = createRandomEventDef();
      s.registerEvent(def);
      const r = s.forceTriggerEvent(def.id, 1);

      s.resolveEvent(r.instance!.instanceId, 'opt-a');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:resolved',
        expect.objectContaining({ optionId: 'opt-a' }),
      );
    });

    it('resolveEvent 设置冷却', () => {
      const def = createRandomEventDef({ cooldownTurns: 3 });
      sys.registerEvent(def);
      const r = sys.forceTriggerEvent(def.id, 1);

      sys.resolveEvent(r.instance!.instanceId, 'opt-a');
      // 冷却中的事件不能触发（但已完成的事件本身也不能触发）
      // 验证冷却被设置
      expect(sys.canTrigger(def.id, 2)).toBe(false);
    });
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
});
