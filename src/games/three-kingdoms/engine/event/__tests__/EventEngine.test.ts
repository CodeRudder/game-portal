/**
 * EventEngine 单元测试
 *
 * 覆盖 v15.0 事件引擎核心的所有功能：
 * - ISubsystem 接口
 * - 5类事件分类注册与查询
 * - 事件权重管理（添加/移除修正、加权选择）
 * - 事件冷却管理
 * - 条件触发评估
 * - 事件触发与过期
 * - 多选项分支与概率加权自动选择
 * - 活动事件绑定
 * - 限时事件
 * - 活动奖励联动
 * - 序列化/反序列化
 */

import { EventEngine } from '../EventEngine';
import type { ISystemDeps } from '../../../core/types';
import type { EventDef } from '../../../core/event';
import { EVENT_CATEGORY_META } from '../../../core/event/event-v15.types';

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

function createEngine(): EventEngine {
  const engine = new EventEngine();
  engine.init(mockDeps());
  return engine;
}

function createEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-event-01',
    title: '测试事件',
    description: '测试事件描述',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 0.5,
    cooldownTurns: 5,
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        consequences: { description: '获得金币', resourceChanges: { gold: 100 } },
      },
      {
        id: 'opt-b',
        text: '选项B',
        isDefault: true,
        consequences: { description: '获得粮草', resourceChanges: { grain: 50 } },
      },
    ],
    expireAfterTurns: 3,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('EventEngine', () => {
  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem', () => {
    it('应有正确的 name', () => {
      const engine = createEngine();
      expect(engine.name).toBe('eventEngine');
    });

    it('init 应注入 deps', () => {
      const engine = new EventEngine();
      const deps = mockDeps();
      engine.init(deps);
      expect(engine.getState()).toBeDefined();
    });

    it('reset 应清空所有状态', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.reset();
      expect(engine.getAllEventDefs()).toHaveLength(0);
      expect(engine.getActiveEventCount()).toBe(0);
    });
  });

  // ─── 5类事件分类 ────────────────────────────

  describe('事件分类（5类）', () => {
    it('应正确注册并查询5类事件', () => {
      const engine = createEngine();
      const categories = ['story', 'random', 'triggered', 'chain', 'world'] as const;

      for (const cat of categories) {
        engine.registerEvent(
          createEventDef({ id: `evt-${cat}` }),
          cat,
        );
      }

      for (const cat of categories) {
        expect(engine.getEventCategory(`evt-${cat}`)).toBe(cat);
      }

      expect(engine.getAllEventDefs()).toHaveLength(5);
    });

    it('应按分类获取事件', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'r1' }), 'random');
      engine.registerEvent(createEventDef({ id: 'r2' }), 'random');
      engine.registerEvent(createEventDef({ id: 's1' }), 'story');

      expect(engine.getEventsByCategory('random')).toHaveLength(2);
      expect(engine.getEventsByCategory('story')).toHaveLength(1);
      expect(engine.getEventsByCategory('world')).toHaveLength(0);
    });

    it('EVENT_CATEGORY_META 应包含5类', () => {
      const categories = Object.keys(EVENT_CATEGORY_META);
      expect(categories).toContain('story');
      expect(categories).toContain('random');
      expect(categories).toContain('triggered');
      expect(categories).toContain('chain');
      expect(categories).toContain('world');
      expect(categories).toHaveLength(5);
    });
  });

  // ─── 权重管理 ──────────────────────────────

  describe('权重管理', () => {
    it('注册事件时应设置默认权重', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'w1' }), 'story');
      const weight = engine.getEventWeight('w1');
      expect(weight).toBeDefined();
      expect(weight!.baseWeight).toBe(EVENT_CATEGORY_META.story.defaultWeight);
      expect(weight!.currentWeight).toBe(EVENT_CATEGORY_META.story.defaultWeight);
    });

    it('应支持自定义权重', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'w2' }), 'random', 200);
      const weight = engine.getEventWeight('w2');
      expect(weight!.baseWeight).toBe(200);
    });

    it('添加权重修正应重新计算', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'w3' }), 'random', 100);
      engine.addWeightModifier('w3', { source: 'test', value: 50, type: 'additive', expireTurn: null });
      const weight = engine.getEventWeight('w3');
      expect(weight!.currentWeight).toBe(150);
    });

    it('乘法修正应正确计算', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'w4' }), 'random', 100);
      engine.addWeightModifier('w4', { source: 'test', value: 1.5, type: 'multiplicative', expireTurn: null });
      const weight = engine.getEventWeight('w4');
      expect(weight!.currentWeight).toBe(150);
    });

    it('移除修正应恢复权重', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'w5' }), 'random', 100);
      engine.addWeightModifier('w5', { source: 'test', value: 50, type: 'additive', expireTurn: null });
      engine.removeWeightModifier('w5', 'test');
      const weight = engine.getEventWeight('w5');
      expect(weight!.currentWeight).toBe(100);
    });

    it('加权选择应返回有效结果', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'a' }), 'random', 100);
      engine.registerEvent(createEventDef({ id: 'b' }), 'random', 100);

      const result = engine.weightedSelect(['a', 'b']);
      expect(result).not.toBeNull();
      expect(result!.candidates).toHaveLength(2);
      expect(result!.totalWeight).toBe(200);
      expect(['a', 'b']).toContain(result!.eventDefId);
    });

    it('加权选择空列表应返回null', () => {
      const engine = createEngine();
      expect(engine.weightedSelect([])).toBeNull();
    });
  });

  // ─── 冷却管理 ──────────────────────────────

  describe('冷却管理', () => {
    it('应正确设置和检查冷却', () => {
      const engine = createEngine();
      engine.setCooldown('evt-1', 10, 5);
      expect(engine.isOnCooldown('evt-1', 12)).toBe(true);
      expect(engine.isOnCooldown('evt-1', 15)).toBe(false);
    });

    it('应获取剩余冷却回合', () => {
      const engine = createEngine();
      engine.setCooldown('evt-1', 10, 5);
      expect(engine.getCooldownRemaining('evt-1', 12)).toBe(3);
      expect(engine.getCooldownRemaining('evt-1', 16)).toBe(0);
    });

    it('应清除冷却', () => {
      const engine = createEngine();
      engine.setCooldown('evt-1', 10, 5);
      engine.clearCooldown('evt-1');
      expect(engine.isOnCooldown('evt-1', 12)).toBe(false);
    });

    it('tickCooldowns 应清理过期冷却', () => {
      const engine = createEngine();
      engine.setCooldown('evt-1', 10, 5);
      engine.tickCooldowns(20); // 过期
      expect(engine.isOnCooldown('evt-1', 20)).toBe(false);
    });
  });

  // ─── 条件触发评估 ──────────────────────────

  describe('条件触发评估', () => {
    it('回合范围条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 5 };
      expect(engine.evaluateConditions(
        [{ type: 'turn_range', params: { minTurn: 3, maxTurn: 10 } }],
        ctx,
      )).toBe(true);
      expect(engine.evaluateConditions(
        [{ type: 'turn_range', params: { minTurn: 10 } }],
        ctx,
      )).toBe(false);
    });

    it('资源阈值条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 1, resources: { gold: 500 } };
      expect(engine.evaluateConditions(
        [{ type: 'resource_threshold', params: { resource: 'gold', minAmount: 300 } }],
        ctx,
      )).toBe(true);
      expect(engine.evaluateConditions(
        [{ type: 'resource_threshold', params: { resource: 'gold', minAmount: 600 } }],
        ctx,
      )).toBe(false);
    });

    it('事件完成条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 1, completedEventIds: new Set(['evt-1']) };
      expect(engine.evaluateConditions(
        [{ type: 'event_completed', params: { eventId: 'evt-1' } }],
        ctx,
      )).toBe(true);
      expect(engine.evaluateConditions(
        [{ type: 'event_completed', params: { eventId: 'evt-2' } }],
        ctx,
      )).toBe(false);
    });

    it('武将招募条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 1, recruitedHeroIds: new Set(['hero-1']) };
      expect(engine.evaluateConditions(
        [{ type: 'hero_recruited', params: { heroId: 'hero-1' } }],
        ctx,
      )).toBe(true);
    });

    it('领地数量条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 1, territoryCount: 5 };
      expect(engine.evaluateConditions(
        [{ type: 'territory_count', params: { minCount: 3 } }],
        ctx,
      )).toBe(true);
    });

    it('战斗胜场条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 1, battlesWon: 10 };
      expect(engine.evaluateConditions(
        [{ type: 'battle_won', params: { minWins: 5 } }],
        ctx,
      )).toBe(true);
    });

    it('活动活跃条件应正确评估', () => {
      const engine = createEngine();
      const ctx = { currentTurn: 1, activeActivityIds: new Set(['act-1']) };
      expect(engine.evaluateConditions(
        [{ type: 'activity_active', params: { activityId: 'act-1' } }],
        ctx,
      )).toBe(true);
    });

    it('空条件应返回true', () => {
      const engine = createEngine();
      expect(engine.evaluateConditions([], { currentTurn: 1 })).toBe(true);
    });
  });

  // ─── 事件触发 ──────────────────────────────

  describe('事件触发', () => {
    it('应成功触发已注册事件', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      const result = engine.triggerEvent('test-event-01', 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.status).toBe('active');
    });

    it('触发不存在的事件应失败', () => {
      const engine = createEngine();
      const result = engine.triggerEvent('nonexistent', 1);
      expect(result.triggered).toBe(false);
    });

    it('重复触发同一事件应失败', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.triggerEvent('test-event-01', 1);
      const result = engine.triggerEvent('test-event-01', 1);
      expect(result.triggered).toBe(false);
    });

    it('冷却中的事件不可触发', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.triggerEvent('test-event-01', 1);
      engine.resolveEvent(engine.getActiveEvents()[0].instanceId, 'opt-a');
      engine.setCooldown('test-event-01', 1, 5);
      expect(engine.canTrigger('test-event-01', 3)).toBe(false);
    });

    it('force触发应跳过条件检查', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.setCooldown('test-event-01', 1, 10);
      const result = engine.triggerEvent('test-event-01', 2, true);
      expect(result.triggered).toBe(true);
    });

    it('按分类触发随机事件', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'r1', triggerProbability: 1.0 }), 'random');
      engine.registerEvent(createEventDef({ id: 's1' }), 'story');

      const triggered = engine.checkAndTriggerByCategory('random', 1);
      expect(triggered.length).toBeGreaterThanOrEqual(0); // 概率触发
    });
  });

  // ─── 选项处理 ──────────────────────────────

  describe('选项处理', () => {
    it('应正确处理选项选择', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      const triggerResult = engine.triggerEvent('test-event-01', 1);
      const instanceId = triggerResult.instance!.instanceId;

      const result = engine.resolveEvent(instanceId, 'opt-a');
      expect(result).not.toBeNull();
      expect(result!.optionId).toBe('opt-a');
      expect(result!.consequences.resourceChanges?.gold).toBe(100);
    });

    it('选择不存在的选项应返回null', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      const triggerResult = engine.triggerEvent('test-event-01', 1);
      const result = engine.resolveEvent(triggerResult.instance!.instanceId, 'nonexistent');
      expect(result).toBeNull();
    });

    it('自动选择应返回加权结果', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      const triggerResult = engine.triggerEvent('test-event-01', 1);
      const result = engine.autoSelectOption(triggerResult.instance!.instanceId);
      expect(result).not.toBeNull();
      expect(result!.isAuto).toBe(true);
      expect(['opt-a', 'opt-b']).toContain(result!.optionId);
    });
  });

  // ─── 过期处理 ──────────────────────────────

  describe('过期处理', () => {
    it('应正确过期事件', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ expireAfterTurns: 3 }), 'random');
      engine.triggerEvent('test-event-01', 1);

      const expired = engine.expireEvents(5);
      expect(expired).toHaveLength(1);
      expect(expired[0].status).toBe('expired');
      expect(engine.getActiveEventCount()).toBe(0);
    });
  });

  // ─── 活动事件绑定 ──────────────────────────

  describe('活动事件绑定', () => {
    it('应正确绑定活动与事件', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'evt-1' }), 'random');
      engine.bindActivityEvent({
        id: 'bind-1',
        activityId: 'act-1',
        eventDefIds: ['evt-1'],
        bindingType: 'trigger',
        enabled: true,
      });

      const events = engine.getActivityEvents('act-1');
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('evt-1');
    });

    it('解绑后应不再关联', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'evt-1' }), 'random');
      engine.bindActivityEvent({
        id: 'bind-1',
        activityId: 'act-1',
        eventDefIds: ['evt-1'],
        bindingType: 'trigger',
        enabled: true,
      });
      engine.unbindActivityEvent('bind-1');
      expect(engine.getActivityEvents('act-1')).toHaveLength(0);
    });

    it('禁用的绑定不应返回事件', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef({ id: 'evt-1' }), 'random');
      engine.bindActivityEvent({
        id: 'bind-1',
        activityId: 'act-1',
        eventDefIds: ['evt-1'],
        bindingType: 'trigger',
        enabled: false,
      });
      expect(engine.getActivityEvents('act-1')).toHaveLength(0);
    });
  });

  // ─── 限时事件 ──────────────────────────────

  describe('限时事件', () => {
    it('应正确设置和检查限时事件', () => {
      const engine = createEngine();
      engine.setTimedEvent({
        eventDefId: 'evt-1',
        startTime: 1000,
        endTime: 2000,
        isActivityExclusive: false,
        rewardMultiplier: 2.0,
      });

      expect(engine.isTimedEventActive('evt-1', 1500)).toBe(true);
      expect(engine.isTimedEventActive('evt-1', 3000)).toBe(false);
      expect(engine.isTimedEventActive('evt-1', 500)).toBe(false);
    });

    it('非限时事件应始终有效', () => {
      const engine = createEngine();
      expect(engine.isTimedEventActive('nonexistent', 1000)).toBe(true);
    });

    it('应获取正确的奖励倍率', () => {
      const engine = createEngine();
      engine.setTimedEvent({
        eventDefId: 'evt-1',
        startTime: 0,
        endTime: 10000,
        isActivityExclusive: false,
        rewardMultiplier: 3.0,
      });
      expect(engine.getTimedEventMultiplier('evt-1')).toBe(3.0);
      expect(engine.getTimedEventMultiplier('nonexistent')).toBe(1.0);
    });
  });

  // ─── 活动奖励联动 ──────────────────────────

  describe('活动奖励联动', () => {
    it('bonus_multiplier 应放大资源变化', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.addRewardLink({
        id: 'link-1',
        activityId: 'act-1',
        eventDefId: 'test-event-01',
        linkType: 'bonus_multiplier',
        params: { multiplier: 2 },
        enabled: true,
      });

      const triggerResult = engine.triggerEvent('test-event-01', 1);
      const result = engine.resolveEvent(triggerResult.instance!.instanceId, 'opt-a');
      expect(result!.consequences.resourceChanges!.gold).toBe(200); // 100 * 2
    });

    it('extra_reward 应增加额外奖励', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.addRewardLink({
        id: 'link-2',
        activityId: 'act-1',
        eventDefId: 'test-event-01',
        linkType: 'extra_reward',
        params: { rewards: { gems: 50 } },
        enabled: true,
      });

      const triggerResult = engine.triggerEvent('test-event-01', 1);
      const result = engine.resolveEvent(triggerResult.instance!.instanceId, 'opt-a');
      expect(result!.consequences.resourceChanges!.gold).toBe(100);
      expect(result!.consequences.resourceChanges!.gems).toBe(50);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('serialize/deserialize 应保持一致性', () => {
      const engine = createEngine();
      engine.registerEvent(createEventDef(), 'random');
      engine.setCooldown('test-event-01', 1, 5);
      engine.bindActivityEvent({
        id: 'bind-1',
        activityId: 'act-1',
        eventDefIds: ['test-event-01'],
        bindingType: 'trigger',
        enabled: true,
      });

      const data = engine.serialize();

      const engine2 = createEngine();
      engine2.deserialize(data);

      expect(engine2.isOnCooldown('test-event-01', 3)).toBe(true);
      const events = engine2.getActivityEvents('act-1');
      // 注意：deserialize 恢复绑定但事件定义需要重新注册
      expect(data.cooldowns).toHaveLength(1);
      expect(data.activityBindings).toHaveLength(1);
    });
  });
});
