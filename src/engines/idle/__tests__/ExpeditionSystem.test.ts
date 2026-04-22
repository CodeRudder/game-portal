import { vi } from 'vitest';
/**
 * ExpeditionSystem 单元测试
 *
 * 覆盖远征系统的全部核心功能：
 * - 构造与自动解锁
 * - 解锁检查（isUnlocked）
 * - 开始前检查（canStart）
 * - 开始远征（start）— 含资源扣除
 * - 进度更新（update）
 * - 完成结算（complete）
 * - 加速（speedUp）
 * - 统计查询（getStats）
 * - 解锁检查（checkUnlocks）
 * - 序列化 / 反序列化（serialize / deserialize）
 * - 重置（reset）
 * - 事件监听（onEvent）
 */

import {
  ExpeditionSystem,
  type ExpeditionDef,
  type ExpeditionEvent,
} from '../modules/ExpeditionSystem';

// ============================================================
// 测试用远征定义
// ============================================================

/** 基础远征：无前置条件，自动解锁 */
const BASIC_EXPEDITION: ExpeditionDef = {
  id: 'forest',
  name: '森林探索',
  description: '探索神秘森林',
  duration: 10_000,
  cost: { gold: 100 },
  rewards: { wood: 500, herb: 50 },
  failureRewards: { wood: 100 },
  baseSuccessRate: 0.8,
  crewRequired: 2,
  difficulty: 1,
  repeatable: true,
};

/** 不可重复远征 */
const ONE_TIME_EXPEDITION: ExpeditionDef = {
  id: 'dragon_lair',
  name: '龙穴冒险',
  description: '挑战远古巨龙',
  duration: 60_000,
  cost: { gold: 1000, gem: 10 },
  rewards: { dragon_scale: 5, gold: 5000 },
  baseSuccessRate: 0.5,
  requires: 'forest',
  crewRequired: 4,
  difficulty: 5,
  repeatable: false,
};

/** 有自定义解锁条件的远征 */
const CONDITIONAL_EXPEDITION: ExpeditionDef = {
  id: 'abyss',
  name: '深渊探险',
  description: '探索无尽深渊',
  duration: 120_000,
  cost: { gold: 5000 },
  rewards: { dark_crystal: 10 },
  baseSuccessRate: 0.3,
  crewRequired: 3,
  difficulty: 8,
  repeatable: true,
  unlockCondition: { totalExpeditions: 5, playerLevel: 10 },
};

/** 无消耗远征 */
const FREE_EXPEDITION: ExpeditionDef = {
  id: 'tutorial',
  name: '新手远征',
  description: '教学关卡',
  duration: 5_000,
  cost: {},
  rewards: { gold: 50 },
  baseSuccessRate: 1.0,
  crewRequired: 1,
  difficulty: 0,
  repeatable: true,
};

/** 全部定义 */
const ALL_DEFS = [BASIC_EXPEDITION, ONE_TIME_EXPEDITION, CONDITIONAL_EXPEDITION, FREE_EXPEDITION];

// ============================================================
// 辅助：访问私有属性
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPrivate<T>(obj: any, key: string): T {
  return obj[key] as T;
}

// ============================================================
// 辅助：从事件 data 中提取字段
// ============================================================

function eventData(event: ExpeditionEvent): Record<string, unknown> {
  return event.data ?? {};
}

// ============================================================
// 测试
// ============================================================

describe('ExpeditionSystem', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new ExpeditionSystem(ALL_DEFS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ----------------------------------------------------------
  // 构造与自动解锁
  // ----------------------------------------------------------
  describe('constructor', () => {
    it('应正确初始化定义', () => {
      expect(system.getDef('forest')).toBeDefined();
      expect(system.getDef('dragon_lair')).toBeDefined();
      expect(system.getDef('abyss')).toBeDefined();
      expect(system.getDef('tutorial')).toBeDefined();
      expect(system.getDef('nonexistent')).toBeUndefined();
    });

    it('应自动解锁无前置条件的远征', () => {
      expect(system.isUnlocked('forest')).toBe(true);
      expect(system.isUnlocked('tutorial')).toBe(true);
    });

    it('不应自动解锁有前置条件的远征', () => {
      expect(system.isUnlocked('dragon_lair')).toBe(false);
    });

    it('不应自动解锁有自定义解锁条件的远征', () => {
      expect(system.isUnlocked('abyss')).toBe(false);
    });

    it('初始状态应无活跃远征', () => {
      expect(system.getActiveExpeditions()).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // canStart
  // ----------------------------------------------------------
  describe('canStart', () => {
    it('对已解锁且资源充足的远征返回 true', () => {
      expect(system.canStart('forest', ['h1', 'h2'], { gold: 200 })).toBe(true);
    });

    it('对不存在的远征返回 false', () => {
      expect(system.canStart('nonexistent', [], {})).toBe(false);
    });

    it('对未解锁的远征返回 false', () => {
      expect(system.canStart('dragon_lair', ['h1', 'h2', 'h3', 'h4'], { gold: 2000, gem: 20 })).toBe(false);
    });

    it('对资源不足的远征返回 false', () => {
      expect(system.canStart('forest', ['h1', 'h2'], { gold: 50 })).toBe(false);
    });

    it('对船员不足的远征返回 false', () => {
      expect(system.canStart('forest', ['h1'], { gold: 200 })).toBe(false);
    });

    it('对已完成的一次性远征返回 false', () => {
      getPrivate<Set<string>>(system, 'unlocked').add('dragon_lair');
      getPrivate<Set<string>>(system, 'completed').add('dragon_lair');
      expect(system.canStart('dragon_lair', ['h1', 'h2', 'h3', 'h4'], { gold: 2000, gem: 20 })).toBe(false);
    });

    it('无消耗远征只需船员即可', () => {
      expect(system.canStart('tutorial', ['h1'], {})).toBe(true);
    });

    it('同一远征已在进行中时返回 false', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });
      // forest 已有一个活跃实例，即使资源充足也不能再次开始
      expect(system.canStart('forest', ['h3', 'h4'], { gold: 200 })).toBe(false);
    });

    it('不同远征互不影响', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });
      // tutorial 是不同的远征，可以正常开始
      expect(system.canStart('tutorial', ['h1'], {})).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // start
  // ----------------------------------------------------------
  describe('start', () => {
    it('应成功开始已解锁且满足条件的远征', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });

      expect(active).not.toBeNull();
      expect(active!.defId).toBe('forest');
      expect(active!.instanceId).toBeTruthy();
      expect(active!.progress).toBe(0);
      expect(active!.crew).toEqual(['h1', 'h2']);
      expect(active!.successRate).toBeGreaterThanOrEqual(0);
      expect(active!.successRate).toBeLessThanOrEqual(1);
    });

    it('应生成不同的实例 ID', () => {
      const a1 = system.start('forest', ['h1', 'h2'], { gold: 200 });
      const a2 = system.start('tutorial', ['h1'], {});

      expect(a1).not.toBeNull();
      expect(a2).not.toBeNull();
      expect(a1!.instanceId).not.toBe(a2!.instanceId);
    });

    it('不满足条件时应返回 null', () => {
      expect(system.start('nonexistent', [], {})).toBeNull();
      expect(system.start('forest', ['h1'], { gold: 200 })).toBeNull();
      expect(system.start('forest', ['h1', 'h2'], { gold: 50 })).toBeNull();
    });

    it('船员多于最低要求时应提高成功率', () => {
      const base = system.start('forest', ['h1', 'h2'], { gold: 200 });
      const extra = system.start('tutorial', ['h1', 'h2', 'h3'], {});

      expect(base).not.toBeNull();
      expect(extra).not.toBeNull();
      // tutorial baseSuccessRate=1.0, 额外船员加成后仍为 1.0
      // forest baseSuccessRate=0.8, 最低2人, 额外1人加成 0.02
      expect(base!.successRate).toBe(0.8);
      expect(extra!.successRate).toBe(1.0); // min(1.0 + 0.04, 1) = 1.0
    });

    it('成功率不应超过 1', () => {
      const active = system.start('tutorial', ['h1'], {});
      expect(active).not.toBeNull();
      expect(active!.successRate).toBeLessThanOrEqual(1);
    });

    it('应触发 expedition_started 事件', () => {
      const events: ExpeditionEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.start('forest', ['h1', 'h2'], { gold: 200 });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('expedition_started');
      expect(eventData(events[0]).expeditionId).toBe('forest');
      expect(eventData(events[0]).instanceId).toBeTruthy();
    });

    it('返回的活跃远征应为副本', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      active!.crew.push('h3');
      active!.progress = 0.5;

      const internals = system.getActiveExpeditions();
      expect(internals[0].crew).toEqual(['h1', 'h2']);
      expect(internals[0].progress).toBe(0);
    });

    it('应从 resources 中扣除消耗资源', () => {
      const resources = { gold: 500 };
      system.start('forest', ['h1', 'h2'], resources);

      expect(resources.gold).toBe(400); // 500 - 100
    });

    it('无消耗远征不应改变资源', () => {
      const resources = { gold: 500 };
      system.start('tutorial', ['h1'], resources);

      expect(resources.gold).toBe(500);
    });

    it('多次 start 应累计扣除资源', () => {
      const resources = { gold: 500 };
      system.start('forest', ['h1', 'h2'], resources);
      system.start('tutorial', ['h1'], resources);

      // forest 扣 100, tutorial 无消耗
      expect(resources.gold).toBe(400);
    });
  });

  // ----------------------------------------------------------
  // update
  // ----------------------------------------------------------
  describe('update', () => {
    it('应随时间推进进度', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });

      vi.advanceTimersByTime(5_000);
      system.update(5_000);

      const activeList = system.getActiveExpeditions();
      expect(activeList).toHaveLength(1);
      expect(activeList[0].progress).toBeGreaterThan(0);
    });

    it('进度满后应自动完成远征', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });

      vi.advanceTimersByTime(20_000);
      system.update(20_000);

      expect(system.getActiveExpeditions()).toHaveLength(0);
    });

    it('dt 为 0 或负数时不应更新', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });

      system.update(0);
      expect(system.getActiveExpeditions()).toHaveLength(1);

      system.update(-100);
      expect(system.getActiveExpeditions()).toHaveLength(1);
    });

    it('应触发 progress_updated 事件', () => {
      const events: ExpeditionEvent[] = [];
      system.onEvent((e) => { if (e.type === 'progress_updated') events.push(e); });

      system.start('forest', ['h1', 'h2'], { gold: 200 });

      vi.advanceTimersByTime(5_000);
      system.update(5_000);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('progress_updated');
    });

    it('完成时应触发 expedition_completed 或 expedition_failed 事件', () => {
      const events: ExpeditionEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.start('forest', ['h1', 'h2'], { gold: 200 });

      vi.advanceTimersByTime(15_000);
      system.update(15_000);

      const completionEvent = events.find(
        (e) => e.type === 'expedition_completed' || e.type === 'expedition_failed'
      );
      expect(completionEvent).toBeDefined();
      expect(eventData(completionEvent!).success).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // complete
  // ----------------------------------------------------------
  describe('complete', () => {
    it('对不存在的实例 ID 返回 null', () => {
      expect(system.complete('nonexistent')).toBeNull();
    });

    it('完成后应从活跃列表移除', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      expect(system.getActiveExpeditions()).toHaveLength(1);

      const result = system.complete(active!.instanceId);
      expect(result).not.toBeNull();
      expect(system.getActiveExpeditions()).toHaveLength(0);
    });

    it('完成后应更新统计', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      const result = system.complete(active!.instanceId);

      const stats = system.getStats('forest');
      expect(stats).not.toBeNull();
      expect(stats!.totalRuns).toBe(1);

      if (result!.success) {
        expect(stats!.successCount).toBe(1);
        expect(stats!.failCount).toBe(0);
      } else {
        expect(stats!.successCount).toBe(0);
        expect(stats!.failCount).toBe(1);
      }
    });

    it('成功时应给予完整奖励', () => {
      const active = system.start('tutorial', ['h1'], {});
      const result = system.complete(active!.instanceId);

      expect(result!.success).toBe(true);
      expect(result!.rewards).toEqual({ gold: 50 });
    });

    it('完成后应标记为已完成', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      system.complete(active!.instanceId);

      expect(getPrivate<Set<string>>(system, 'completed').has('forest')).toBe(true);
    });

    it('应累计奖励到统计', () => {
      const active = system.start('tutorial', ['h1'], {});
      system.complete(active!.instanceId);

      const stats = system.getStats('tutorial');
      expect(stats!.totalRewardsEarned.gold).toBe(50);
    });
  });

  // ----------------------------------------------------------
  // speedUp
  // ----------------------------------------------------------
  describe('speedUp', () => {
    it('应减少远征的剩余时间', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      const originalEndTime = active!.endTime;

      system.speedUp(active!.instanceId, 5_000);

      const updated = system.getActiveExpeditions()[0];
      expect(updated.endTime).toBe(originalEndTime - 5_000);
    });

    it('对不存在的实例 ID 不应报错', () => {
      expect(() => system.speedUp('nonexistent', 5_000)).not.toThrow();
    });

    it('reductionMs 为 0 或负数时不应生效', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      const originalEndTime = active!.endTime;

      system.speedUp(active!.instanceId, 0);
      expect(system.getActiveExpeditions()[0].endTime).toBe(originalEndTime);

      system.speedUp(active!.instanceId, -100);
      expect(system.getActiveExpeditions()[0].endTime).toBe(originalEndTime);
    });

    it('加速后结束时间不应早于开始时间', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });

      system.speedUp(active!.instanceId, 1_000_000);

      const updated = system.getActiveExpeditions()[0];
      expect(updated.endTime).toBeGreaterThanOrEqual(updated.startTime);
    });
  });

  // ----------------------------------------------------------
  // checkUnlocks
  // ----------------------------------------------------------
  describe('checkUnlocks', () => {
    it('应解锁满足前置条件的远征', () => {
      getPrivate<Set<string>>(system, 'completed').add('forest');

      const newlyUnlocked = system.checkUnlocks({});
      expect(newlyUnlocked).toContain('dragon_lair');
      expect(system.isUnlocked('dragon_lair')).toBe(true);
    });

    it('应解锁满足自定义条件的远征', () => {
      const newlyUnlocked = system.checkUnlocks({ totalExpeditions: 5, playerLevel: 10 });
      expect(newlyUnlocked).toContain('abyss');
      expect(system.isUnlocked('abyss')).toBe(true);
    });

    it('不应解锁条件不满足的远征', () => {
      const newlyUnlocked = system.checkUnlocks({ totalExpeditions: 3 });
      expect(newlyUnlocked).not.toContain('abyss');
    });

    it('应触发 expedition_unlocked 事件', () => {
      const events: ExpeditionEvent[] = [];
      system.onEvent((e) => events.push(e));

      getPrivate<Set<string>>(system, 'completed').add('forest');
      system.checkUnlocks({});

      const unlockEvents = events.filter((e) => e.type === 'expedition_unlocked');
      expect(unlockEvents.length).toBeGreaterThan(0);
      expect(eventData(unlockEvents[0]).expeditionId).toBe('dragon_lair');
    });

    it('已解锁的远征不应重复解锁', () => {
      getPrivate<Set<string>>(system, 'completed').add('forest');
      const first = system.checkUnlocks({});
      const second = system.checkUnlocks({});

      expect(first).toContain('dragon_lair');
      expect(second).not.toContain('dragon_lair');
    });
  });

  // ----------------------------------------------------------
  // getStats
  // ----------------------------------------------------------
  describe('getStats', () => {
    it('对未执行的远征返回 null', () => {
      expect(system.getStats('forest')).toBeNull();
    });

    it('应返回统计的副本', () => {
      const active = system.start('tutorial', ['h1'], {});
      system.complete(active!.instanceId);

      const stats = system.getStats('tutorial');
      stats!.totalRuns = 999;

      const stats2 = system.getStats('tutorial');
      expect(stats2!.totalRuns).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // serialize / deserialize
  // ----------------------------------------------------------
  describe('serialize / deserialize', () => {
    it('应正确保存和恢复状态', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });

      const saved = system.serialize();

      const system2 = new ExpeditionSystem(ALL_DEFS);
      system2.deserialize(saved);

      expect(system2.getActiveExpeditions()).toHaveLength(1);
      expect(system2.getActiveExpeditions()[0].defId).toBe('forest');
      expect(system2.getActiveExpeditions()[0].instanceId).toBe(active!.instanceId);
    });

    it('应正确保存和恢复完成记录', () => {
      const active = system.start('forest', ['h1', 'h2'], { gold: 200 });
      system.complete(active!.instanceId);

      const saved = system.serialize();
      const system2 = new ExpeditionSystem(ALL_DEFS);
      system2.deserialize(saved);

      expect(getPrivate<Set<string>>(system2, 'completed').has('forest')).toBe(true);
    });

    it('应正确保存和恢复统计', () => {
      const active = system.start('tutorial', ['h1'], {});
      system.complete(active!.instanceId);

      const saved = system.serialize();
      const system2 = new ExpeditionSystem(ALL_DEFS);
      system2.deserialize(saved);

      const stats = system2.getStats('tutorial');
      expect(stats).not.toBeNull();
      expect(stats!.totalRuns).toBe(1);
      expect(stats!.successCount).toBe(1);
      expect(stats!.totalRewardsEarned.gold).toBe(50);
    });

    it('应正确保存和恢复解锁状态', () => {
      getPrivate<Set<string>>(system, 'completed').add('forest');
      system.checkUnlocks({});

      const saved = system.serialize();
      const system2 = new ExpeditionSystem(ALL_DEFS);
      system2.deserialize(saved);

      expect(system2.isUnlocked('dragon_lair')).toBe(true);
    });

    it('应正确保存和恢复实例计数器', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });
      system.start('tutorial', ['h1'], {});

      const saved = system.serialize();
      expect(saved.instanceCounter).toBe(2);

      const system2 = new ExpeditionSystem(ALL_DEFS);
      system2.deserialize(saved);

      // 验证实例计数器恢复：通过检查活跃远征的 instanceId 来确认
      const restored = system2.getActiveExpeditions();
      expect(restored).toHaveLength(2);

      // 完成所有活跃远征后，可以重新开始（repeatable）
      for (const exp of restored) {
        system2.complete(exp.instanceId);
      }

      // 现在可以再次开始 forest，且新实例 ID 的计数器部分应 > 2
      const newActive = system2.start('forest', ['h1', 'h2'], { gold: 200 });
      expect(newActive).not.toBeNull();
      // 验证计数器递增：instanceId 中包含计数器值 3
      expect(newActive!.instanceId).toContain('_3_');
    });

    it('应处理无效数据而不崩溃', () => {
      expect(() => system.deserialize({})).not.toThrow();
      expect(() => system.deserialize({ active: null })).not.toThrow();
      expect(() => system.deserialize({ active: [null] })).not.toThrow();
      expect(() => system.deserialize({ completed: [123] })).not.toThrow();
      expect(() => system.deserialize({ stats: 'invalid' })).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // reset
  // ----------------------------------------------------------
  describe('reset', () => {
    it('应清空所有状态', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });
      getPrivate<Set<string>>(system, 'completed').add('forest');

      system.reset();

      expect(system.getActiveExpeditions()).toHaveLength(0);
      expect(getPrivate<Set<string>>(system, 'completed').size).toBe(0);
      expect(system.getStats('forest')).toBeNull();
    });

    it('应重新自动解锁无前置条件的远征', () => {
      system.reset();

      expect(system.isUnlocked('forest')).toBe(true);
      expect(system.isUnlocked('tutorial')).toBe(true);
    });

    it('不应清除事件监听器', () => {
      const events: ExpeditionEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.reset();
      system.start('tutorial', ['h1'], {});

      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // onEvent
  // ----------------------------------------------------------
  describe('onEvent', () => {
    it('应返回取消订阅函数', () => {
      const events: ExpeditionEvent[] = [];
      const unsubscribe = system.onEvent((e) => events.push(e));

      system.start('tutorial', ['h1'], {});
      expect(events).toHaveLength(1);

      unsubscribe();

      system.start('forest', ['h1', 'h2'], { gold: 200 });
      expect(events).toHaveLength(1); // 仍只有 1 个事件
    });

    it('监听器异常不应影响系统运行', () => {
      system.onEvent(() => {
        throw new Error('listener error');
      });

      expect(() => system.start('tutorial', ['h1'], {})).not.toThrow();
      expect(system.getActiveExpeditions()).toHaveLength(1);
    });

    it('应支持多个监听器', () => {
      const events1: ExpeditionEvent[] = [];
      const events2: ExpeditionEvent[] = [];

      system.onEvent((e) => events1.push(e));
      system.onEvent((e) => events2.push(e));

      system.start('tutorial', ['h1'], {});

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // 泛型支持
  // ----------------------------------------------------------
  describe('泛型支持', () => {
    it('应支持扩展的远征定义', () => {
      interface ExtendedExpeditionDef extends ExpeditionDef {
        region: string;
      }

      const extendedDefs: ExtendedExpeditionDef[] = [
        {
          ...BASIC_EXPEDITION,
          region: 'greenwood',
        },
      ];

      const extendedSystem = new ExpeditionSystem<ExtendedExpeditionDef>(extendedDefs);
      const def = extendedSystem.getDef('forest');

      expect(def).not.toBeNull();
      expect(def!.region).toBe('greenwood');
    });
  });

  // ----------------------------------------------------------
  // getActiveExpeditions 返回 readonly
  // ----------------------------------------------------------
  describe('getActiveExpeditions readonly', () => {
    it('返回的列表应为独立副本', () => {
      system.start('forest', ['h1', 'h2'], { gold: 200 });

      const list1 = system.getActiveExpeditions();
      const list2 = system.getActiveExpeditions();

      // 两个快照是不同的数组
      expect(list1).not.toBe(list2);
      // 但内容相同
      expect(list1).toEqual(list2);
    });
  });
});
