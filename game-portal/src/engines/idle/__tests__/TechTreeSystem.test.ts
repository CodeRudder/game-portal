/**
 * TechTreeSystem 单元测试
 *
 * 覆盖所有公共方法和边界情况。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TechTreeSystem,
  type TechDef,
  type TechTreeEvent,
} from '../modules/TechTreeSystem';

// ============================================================
// 测试用科技定义
// ============================================================

/** 基础科技树：3 层线性依赖 + 1 条分支 */
const BASIC_TECHS: TechDef[] = [
  {
    id: 'mining_1',
    name: '初级采矿',
    description: '提升采矿效率',
    requires: [],
    cost: { gold: 100 },
    researchTime: 1000,
    effects: [
      { type: 'multiplier', target: 'mining', value: 1.5, description: '采矿+50%' },
    ],
    tier: 1,
    icon: '⛏️',
    branch: 'economy',
  },
  {
    id: 'mining_2',
    name: '高级采矿',
    description: '进一步提升采矿效率',
    requires: ['mining_1'],
    cost: { gold: 500, iron: 50 },
    researchTime: 3000,
    effects: [
      { type: 'multiplier', target: 'mining', value: 2.0, description: '采矿x2' },
      { type: 'modifier', target: 'mining_speed', value: 10, description: '采矿速度+10' },
    ],
    tier: 2,
    icon: '⛏️',
    branch: 'economy',
  },
  {
    id: 'mining_3',
    name: '大师采矿',
    description: '终极采矿技术',
    requires: ['mining_2'],
    cost: { gold: 2000 },
    researchTime: 10000,
    effects: [
      { type: 'multiplier', target: 'mining', value: 3.0, description: '采矿x3' },
    ],
    tier: 3,
    icon: '💎',
    branch: 'economy',
  },
  {
    id: 'combat_1',
    name: '基础战斗',
    description: '解锁战斗能力',
    requires: [],
    cost: { gold: 200 },
    researchTime: 2000,
    effects: [
      { type: 'unlock', target: 'combat', value: 1, description: '解锁战斗' },
    ],
    tier: 1,
    icon: '⚔️',
    branch: 'military',
  },
  {
    id: 'combat_2',
    name: '高级战斗',
    description: '战斗伤害提升',
    requires: ['combat_1', 'mining_1'],
    cost: { gold: 800 },
    researchTime: 5000,
    effects: [
      { type: 'multiplier', target: 'damage', value: 2.0, description: '伤害x2' },
      { type: 'ability', target: 'critical_strike', value: 1, description: '暴击能力' },
    ],
    tier: 2,
    icon: '🗡️',
    branch: 'military',
  },
];

// ============================================================
// 辅助函数
// ============================================================

/** 创建带有充足资源的资源对象 */
function richResources(): Record<string, number> {
  return { gold: 999999, iron: 999999, wood: 999999 };
}

// ============================================================
// 测试套件
// ============================================================

describe('TechTreeSystem', () => {
  let system: TechTreeSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new TechTreeSystem([...BASIC_TECHS]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('应正确创建实例', () => {
      expect(system).toBeDefined();
      expect(system.getCurrentResearch()).toBeNull();
      expect(system.getQueue()).toEqual([]);
    });

    it('应在遇到重复 ID 时抛出错误', () => {
      const dup: TechDef[] = [
        { ...BASIC_TECHS[0] },
        { ...BASIC_TECHS[0] }, // 重复
      ];
      expect(() => new TechTreeSystem(dup)).toThrow('Duplicate tech id');
    });

    it('应接受空数组', () => {
      const empty = new TechTreeSystem([]);
      expect(empty).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // research()
  // ----------------------------------------------------------

  describe('research', () => {
    it('应在资源充足且无前置时成功开始研究', () => {
      const result = system.research('mining_1', { gold: 100 });
      expect(result).toBe(true);
      expect(system.getCurrentResearch()).not.toBeNull();
      expect(system.getCurrentResearch()!.techId).toBe('mining_1');
      expect(system.getCurrentResearch()!.progress).toBe(0);
    });

    it('应在资源不足时返回 false', () => {
      const result = system.research('mining_1', { gold: 50 });
      expect(result).toBe(false);
      expect(system.getCurrentResearch()).toBeNull();
    });

    it('应在前置未满足时返回 false', () => {
      const result = system.research('mining_2', richResources());
      expect(result).toBe(false);
    });

    it('应在科技不存在时返回 false', () => {
      const result = system.research('nonexistent', richResources());
      expect(result).toBe(false);
    });

    it('应在已研究过时返回 false', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.research('mining_1', richResources())).toBe(false);
    });

    it('应在已有研究进行中时返回 false', () => {
      system.research('mining_1', richResources());
      expect(system.research('combat_1', richResources())).toBe(false);
    });

    it('前置满足后应可研究后续科技', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.research('mining_2', richResources())).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // isResearched()
  // ----------------------------------------------------------

  describe('isResearched', () => {
    it('未研究时应返回 false', () => {
      expect(system.isResearched('mining_1')).toBe(false);
    });

    it('研究完成后应返回 true', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.isResearched('mining_1')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // canResearch()
  // ----------------------------------------------------------

  describe('canResearch', () => {
    it('无前置且资源充足时应返回 true', () => {
      expect(system.canResearch('mining_1', { gold: 100 })).toBe(true);
    });

    it('资源不足时应返回 false', () => {
      expect(system.canResearch('mining_1', { gold: 50 })).toBe(false);
    });

    it('前置不满足时应返回 false', () => {
      expect(system.canResearch('mining_2', richResources())).toBe(false);
    });

    it('已研究过时应返回 false', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.canResearch('mining_1', richResources())).toBe(false);
    });

    it('科技不存在时应返回 false', () => {
      expect(system.canResearch('ghost', richResources())).toBe(false);
    });

    it('前置满足后应返回 true', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.canResearch('mining_2', richResources())).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getEffects()
  // ----------------------------------------------------------

  describe('getEffects', () => {
    it('无已研究科技时应返回空对象', () => {
      expect(system.getEffects()).toEqual({});
    });

    it('应正确汇总 multiplier 效果（累乘）', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      system.research('mining_2', richResources());
      vi.advanceTimersByTime(3000);
      system.update(0);

      const effects = system.getEffects();
      expect(effects.mining).toBeCloseTo(3.0);
      expect(effects.mining_speed).toBe(10);
    });

    it('应正确汇总 unlock 和 ability 效果', () => {
      system.research('combat_1', richResources());
      vi.advanceTimersByTime(2000);
      system.update(0);

      expect(system.getEffects().combat).toBe(1);

      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      system.research('combat_2', richResources());
      vi.advanceTimersByTime(5000);
      system.update(0);

      const effects2 = system.getEffects();
      expect(effects2.critical_strike).toBe(1);
      expect(effects2.damage).toBeCloseTo(2.0);
    });

    it('三项采矿科技全部完成后效果应正确累乘', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      system.research('mining_2', richResources());
      vi.advanceTimersByTime(3000);
      system.update(0);

      system.research('mining_3', richResources());
      vi.advanceTimersByTime(10000);
      system.update(0);

      const effects = system.getEffects();
      expect(effects.mining).toBeCloseTo(9.0);
    });
  });

  // ----------------------------------------------------------
  // getPrerequisites()
  // ----------------------------------------------------------

  describe('getPrerequisites', () => {
    it('无前置时应返回空数组', () => {
      expect(system.getPrerequisites('mining_1')).toEqual([]);
    });

    it('应返回直接前置', () => {
      expect(system.getPrerequisites('mining_2')).toEqual(['mining_1']);
    });

    it('应递归返回所有前置（拓扑序）', () => {
      expect(system.getPrerequisites('mining_3')).toEqual(['mining_1', 'mining_2']);
    });

    it('多前置时应全部返回', () => {
      const prereqs = system.getPrerequisites('combat_2');
      expect(prereqs).toContain('combat_1');
      expect(prereqs).toContain('mining_1');
      expect(prereqs.length).toBe(2);
    });

    it('不存在的科技应返回空数组', () => {
      expect(system.getPrerequisites('nonexistent')).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // getDependents()
  // ----------------------------------------------------------

  describe('getDependents', () => {
    it('无后续科技时应返回空数组', () => {
      expect(system.getDependents('mining_3')).toEqual([]);
    });

    it('应返回直接依赖的后续科技', () => {
      const deps = system.getDependents('mining_1');
      expect(deps).toContain('mining_2');
      expect(deps).toContain('combat_2');
      expect(deps.length).toBe(2);
    });

    it('mining_2 的后续应只有 mining_3', () => {
      expect(system.getDependents('mining_2')).toEqual(['mining_3']);
    });
  });

  // ----------------------------------------------------------
  // enqueue() + update() 队列机制
  // ----------------------------------------------------------

  describe('enqueue and queue processing', () => {
    it('应成功将科技加入队列', () => {
      expect(system.enqueue('mining_1')).toBe(true);
      expect(system.getQueue()).toEqual(['mining_1']);
    });

    it('不应允许重复入队', () => {
      system.enqueue('mining_1');
      expect(system.enqueue('mining_1')).toBe(false);
      expect(system.getQueue()).toEqual(['mining_1']);
    });

    it('不应允许已研究的科技入队', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.enqueue('mining_1')).toBe(false);
    });

    it('不应允许不存在的科技入队', () => {
      expect(system.enqueue('nonexistent')).toBe(false);
    });

    it('update 时应自动从队列启动研究', () => {
      system.enqueue('mining_1');
      system.update(0);

      expect(system.getCurrentResearch()).not.toBeNull();
      expect(system.getCurrentResearch()!.techId).toBe('mining_1');
      expect(system.getQueue()).toEqual([]);
    });

    it('队列完成后应自动启动下一项', () => {
      system.enqueue('mining_1');
      system.enqueue('mining_2');

      system.update(0);
      expect(system.getCurrentResearch()!.techId).toBe('mining_1');

      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.isResearched('mining_1')).toBe(true);
      expect(system.getCurrentResearch()).not.toBeNull();
      expect(system.getCurrentResearch()!.techId).toBe('mining_2');

      vi.advanceTimersByTime(3000);
      system.update(0);

      expect(system.isResearched('mining_2')).toBe(true);
      expect(system.getCurrentResearch()).toBeNull();
      expect(system.getQueue()).toEqual([]);
    });

    it('前置不满足的队列项应被跳过', () => {
      system.enqueue('mining_2');
      system.enqueue('mining_1');

      system.update(0);

      expect(system.getCurrentResearch()!.techId).toBe('mining_1');
    });
  });

  // ----------------------------------------------------------
  // update() 进度推进
  // ----------------------------------------------------------

  describe('update progress', () => {
    it('应正确更新进度', () => {
      system.research('mining_1', richResources());

      vi.advanceTimersByTime(500);
      system.update(0);

      expect(system.getCurrentResearch()!.progress).toBeCloseTo(0.5, 1);
    });

    it('完成后应标记为已研究', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(system.isResearched('mining_1')).toBe(true);
      expect(system.getCurrentResearch()).toBeNull();
    });

    it('无当前研究时 update 不应报错', () => {
      expect(() => system.update(16)).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // 事件系统
  // ----------------------------------------------------------

  describe('events', () => {
    it('应在开始研究时发布 research_started 事件', () => {
      const events: TechTreeEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.research('mining_1', richResources());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('research_started');
      expect(events[0].data!.techId).toBe('mining_1');
    });

    it('应在研究完成时发布 research_completed 和 tech_unlocked 事件', () => {
      const events: TechTreeEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events[1].type).toBe('research_completed');
      expect(events[2].type).toBe('tech_unlocked');
    });

    it('应在入队时发布 research_queued 事件', () => {
      const events: TechTreeEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.enqueue('mining_1');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('research_queued');
      expect(events[0].data!.techId).toBe('mining_1');
    });

    it('取消订阅后不应再收到事件', () => {
      const events: TechTreeEvent[] = [];
      const unsub = system.onEvent((e) => events.push(e));

      unsub();
      system.research('mining_1', richResources());

      expect(events).toHaveLength(0);
    });

    it('多个监听器应都能收到事件', () => {
      const events1: TechTreeEvent[] = [];
      const events2: TechTreeEvent[] = [];

      system.onEvent((e) => events1.push(e));
      system.onEvent((e) => events2.push(e));

      system.research('mining_1', richResources());

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // serialize() / deserialize()
  // ----------------------------------------------------------

  describe('serialize and deserialize', () => {
    it('初始状态序列化应正确', () => {
      const data = system.serialize();
      expect(data.researched).toEqual([]);
      expect(data.current).toBeNull();
      expect(data.queue).toEqual([]);
      expect(data.totalInvestment).toEqual({});
    });

    it('应正确序列化和反序列化有数据的状态', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(500);
      system.update(0);

      system.enqueue('mining_2');

      const serialized = system.serialize();

      const restored = new TechTreeSystem([...BASIC_TECHS]);
      restored.deserialize(serialized);

      expect(restored.isResearched('mining_1')).toBe(false);
      expect(restored.getCurrentResearch()).not.toBeNull();
      expect(restored.getCurrentResearch()!.techId).toBe('mining_1');
      expect(restored.getQueue()).toEqual(['mining_2']);
      expect(restored.serialize().totalInvestment).toEqual({ gold: 100 });
    });

    it('应正确恢复已完成研究的状态', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);

      const serialized = system.serialize();
      expect(serialized.researched).toContain('mining_1');

      const restored = new TechTreeSystem([...BASIC_TECHS]);
      restored.deserialize(serialized);

      expect(restored.isResearched('mining_1')).toBe(true);
      expect(restored.canResearch('mining_2', richResources())).toBe(true);
    });

    it('应处理无效的反序列化数据', () => {
      const restored = new TechTreeSystem([...BASIC_TECHS]);
      expect(() => restored.deserialize({})).not.toThrow();
      expect(restored.getCurrentResearch()).toBeNull();
      expect(restored.getQueue()).toEqual([]);
    });

    it('应处理包含非法字段的反序列化数据', () => {
      const restored = new TechTreeSystem([...BASIC_TECHS]);
      restored.deserialize({
        researched: ['mining_1', 123, null],
        current: 'invalid',
        queue: [456, 'mining_2'],
        totalInvestment: { gold: 'abc', iron: 100 },
      });

      expect(restored.isResearched('mining_1')).toBe(true);
      expect(restored.getQueue()).toEqual(['mining_2']);
    });
  });

  // ----------------------------------------------------------
  // reset()
  // ----------------------------------------------------------

  describe('reset', () => {
    it('应清除所有状态', () => {
      system.research('mining_1', richResources());
      vi.advanceTimersByTime(1000);
      system.update(0);
      system.enqueue('mining_2');

      system.reset();

      expect(system.isResearched('mining_1')).toBe(false);
      expect(system.getCurrentResearch()).toBeNull();
      expect(system.getQueue()).toEqual([]);
      expect(system.getEffects()).toEqual({});
    });
  });

  // ----------------------------------------------------------
  // 泛型支持
  // ----------------------------------------------------------

  describe('generics', () => {
    it('应支持扩展的 TechDef', () => {
      interface ExtendedTechDef extends TechDef {
        rarity: 'common' | 'rare' | 'epic';
      }

      const extendedTechs: ExtendedTechDef[] = [
        {
          id: 'ext_1',
          name: '扩展科技',
          description: '测试泛型',
          requires: [],
          cost: { gold: 100 },
          researchTime: 1000,
          effects: [],
          tier: 1,
          icon: '🔬',
          rarity: 'rare',
        },
      ];

      const extSystem = new TechTreeSystem<ExtendedTechDef>(extendedTechs);
      expect(extSystem).toBeDefined();
      expect(extSystem.canResearch('ext_1', { gold: 100 })).toBe(true);
    });
  });
});
