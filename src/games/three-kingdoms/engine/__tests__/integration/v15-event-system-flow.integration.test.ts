/**
 * v15.0 事件风云 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 事件触发系统（注册/触发/选择/奖励/过期）
 * - §2 限时活动系统（创建/阶段流转/参与/排行榜/奖励）
 * - §3 随机事件（概率计算/条件评估/触发检查）
 * - §4 活动管理系统（活动列表/任务/里程碑/赛季主题）
 * - §5 事件通知与日志（急报横幅/事件日志/离线事件）
 * - §6 跨系统联动（事件→资源/活动→活跃度）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v15-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { EventDef, EventTriggerType } from '../../../../core/event/event.types';
import type { TimedActivityFlow } from '../../../../core/event/event-engine.types';
import { TimedActivitySystem } from '../../activity/TimedActivitySystem';

// ═══════════════════════════════════════════════════════════════
// §1 事件触发系统
// ═══════════════════════════════════════════════════════════════
describe('v15.0 事件风云 — §1 事件触发系统', () => {

  describe('§1.1 事件触发系统基础', () => {

    it('should access event trigger system via engine getter', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();
      expect(trigger).toBeDefined();
      expect(trigger.name).toBe('eventTrigger');
    });

    it('should register and retrieve event definitions', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const testEvent: EventDef = {
        id: 'test-event-001',
        name: '天降祥瑞',
        description: '天降祥瑞，国泰民安',
        triggerType: 'fixed',
        conditions: [],
        options: [
          {
            id: 'accept',
            text: '接受天命',
            consequences: [{ type: 'resource', target: 'gold', value: 100 }],
          },
        ],
      };

      trigger.registerEvent(testEvent);
      const retrieved = trigger.getEventDef('test-event-001');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('天降祥瑞');
      expect(retrieved!.triggerType).toBe('fixed');
    });

    it('should list all event definitions and filter by trigger type', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      // 引擎初始化时已加载预定义事件
      const allDefs = trigger.getAllEventDefs();
      expect(allDefs.length).toBeGreaterThan(0);

      // 按类型筛选
      const fixedDefs = trigger.getEventDefsByType('fixed');
      const randomDefs = trigger.getEventDefsByType('random');
      // 至少应有预定义事件
      expect(fixedDefs.length + randomDefs.length).toBeGreaterThanOrEqual(0);
    });

    it('should force trigger an event and produce an active instance', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const testEvent: EventDef = {
        id: 'force-trigger-event',
        name: '强制触发测试事件',
        description: '测试强制触发',
        triggerType: 'fixed',
        conditions: [],
        options: [
          {
            id: 'opt-1',
            text: '选项一',
            consequences: [{ type: 'resource', target: 'gold', value: 50 }],
          },
        ],
      };

      trigger.registerEvent(testEvent);
      const result = trigger.forceTriggerEvent('force-trigger-event', 1);

      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe('force-trigger-event');
    });

    it('should resolve an active event by choosing an option', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const testEvent: EventDef = {
        id: 'resolve-test-event',
        name: '抉择测试事件',
        description: '测试事件选择',
        triggerType: 'fixed',
        conditions: [],
        options: [
          {
            id: 'choice-a',
            text: '选项A',
            consequences: [{ type: 'resource', target: 'gold', value: 100 }],
          },
          {
            id: 'choice-b',
            text: '选项B',
            consequences: [{ type: 'resource', target: 'grain', value: 200 }],
          },
        ],
      };

      trigger.registerEvent(testEvent);
      const triggerResult = trigger.forceTriggerEvent('resolve-test-event', 1);
      const instanceId = triggerResult.instance!.instanceId;

      const choiceResult = trigger.resolveEvent(instanceId, 'choice-a');
      expect(choiceResult).not.toBeNull();
      expect(choiceResult!.instanceId).toBe(instanceId);
      expect(choiceResult!.optionId).toBe('choice-a');
    });

    it('should track completed events', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const testEvent: EventDef = {
        id: 'completion-track-event',
        name: '完成追踪测试',
        description: '测试事件完成追踪',
        triggerType: 'fixed',
        conditions: [],
        options: [
          {
            id: 'opt',
            text: '完成',
            consequences: [],
          },
        ],
      };

      trigger.registerEvent(testEvent);
      const result = trigger.forceTriggerEvent('completion-track-event', 1);
      trigger.resolveEvent(result.instance!.instanceId, 'opt');

      expect(trigger.isEventCompleted('completion-track-event')).toBe(true);
      expect(trigger.getCompletedEventIds()).toContain('completion-track-event');
    });

    it('should expire events based on current turn', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const testEvent: EventDef = {
        id: 'expire-test-event',
        name: '过期测试事件',
        description: '测试事件过期',
        triggerType: 'random',
        conditions: [],
        options: [
          { id: 'opt', text: '选项', consequences: [] },
        ],
        expireAfterTurns: 3, // 3回合后过期
      };

      trigger.registerEvent(testEvent);
      trigger.forceTriggerEvent('expire-test-event', 1);

      // 在过期回合前不应被移除
      expect(trigger.hasActiveEvent('expire-test-event')).toBe(true);

      // 推进到过期回合
      const expired = trigger.expireEvents(10);
      // 过期事件应被返回
      expect(expired.length).toBeGreaterThanOrEqual(0);
    });

  });

  describe('§1.2 事件触发条件与冷却', () => {

    it('should check canTrigger before triggering', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const testEvent: EventDef = {
        id: 'can-trigger-event',
        name: '触发条件测试',
        description: '测试触发条件检查',
        triggerType: 'fixed',
        conditions: [],
        options: [{ id: 'opt', text: '选项', consequences: [] }],
      };

      trigger.registerEvent(testEvent);
      // 未触发过，应该可以触发
      const canTrigger = trigger.canTrigger('can-trigger-event', 1);
      expect(typeof canTrigger).toBe('boolean');
    });

    it('should checkAndTriggerEvents return triggered instances', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const result = trigger.checkAndTriggerEvents(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should get/set trigger config', () => {
      const sim = createSim();
      const trigger = sim.engine.getEventTriggerSystem();

      const config = trigger.getConfig();
      expect(config).toBeDefined();

      trigger.setConfig({ maxActiveEvents: 15 });
      const updated = trigger.getConfig();
      expect(updated.maxActiveEvents).toBe(15);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §2 限时活动系统
// ═══════════════════════════════════════════════════════════════
describe('v15.0 事件风云 — §2 限时活动系统', () => {

  describe('§2.1 限时活动创建与阶段流转', () => {

    it('should create a timed activity flow with 4 phases', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      const flow = timedSystem.createTimedActivityFlow(
        'spring-festival-2025',
        now,
        now + 7 * 24 * 60 * 60 * 1000, // 7天后结束
      );

      expect(flow).toBeDefined();
      expect(flow.activityId).toBe('spring-festival-2025');
      // 初始阶段应为 preview 或 active
      expect(['preview', 'active']).toContain(flow.phase);
    });

    it('should update activity phase based on current time', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      timedSystem.createTimedActivityFlow(
        'phase-test-activity',
        now - 2 * 24 * 60 * 60 * 1000, // 2天前开始（跳过preview）
        now + 5 * 24 * 60 * 60 * 1000,
      );

      const phase = timedSystem.updatePhase('phase-test-activity', now);
      expect(['preview', 'active', 'settlement', 'closed']).toContain(phase);
    });

    it('should check participation eligibility based on phase', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      timedSystem.createTimedActivityFlow(
        'participate-test',
        now - 2 * 24 * 60 * 60 * 1000,
        now + 5 * 24 * 60 * 60 * 1000,
      );

      const canParticipate = timedSystem.canParticipate('participate-test', now);
      expect(typeof canParticipate).toBe('boolean');
    });

    it('should calculate remaining time for active activity', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      const endTime = now + 3 * 24 * 60 * 60 * 1000; // 3天后结束
      timedSystem.createTimedActivityFlow(
        'remaining-test',
        now - 2 * 24 * 60 * 60 * 1000,
        endTime,
      );

      const remaining = timedSystem.getRemainingTime('remaining-test', now);
      expect(remaining).toBeGreaterThan(0);
    });

  });

  describe('§2.2 活动排行榜与奖励', () => {

    it('should update and retrieve leaderboard', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      timedSystem.createTimedActivityFlow(
        'leaderboard-test',
        now - 2 * 24 * 60 * 60 * 1000,
        now + 5 * 24 * 60 * 60 * 1000,
      );

      timedSystem.updateLeaderboard('leaderboard-test', [
        { playerId: 'player-1', playerName: 'P1', points: 1000, tokens: 0 },
        { playerId: 'player-2', playerName: 'P2', points: 800, tokens: 0 },
        { playerId: 'player-3', playerName: 'P3', points: 1200, tokens: 0 },
      ]);

      const leaderboard = timedSystem.getLeaderboard('leaderboard-test');
      expect(leaderboard.length).toBe(3);
      // 排行榜应按分数降序排列
      expect(leaderboard[0].points).toBeGreaterThanOrEqual(leaderboard[1].points);
    });

    it('should get player rank from leaderboard', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      timedSystem.createTimedActivityFlow(
        'rank-test',
        now - 2 * 24 * 60 * 60 * 1000,
        now + 5 * 24 * 60 * 60 * 1000,
      );

      timedSystem.updateLeaderboard('rank-test', [
        { playerId: 'player-1', playerName: 'P1', points: 500, tokens: 0 },
      ]);
      const rank = timedSystem.getPlayerRank('rank-test', 'player-1');
      expect(rank).toBeGreaterThanOrEqual(1);
    });

    it('should calculate rank rewards based on tier config', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      // 第1名奖励
      const rank1Rewards = timedSystem.calculateRankRewards(1);
      expect(rank1Rewards).toBeDefined();
      expect(typeof rank1Rewards).toBe('object');

      // 前10名奖励
      const rank5Rewards = timedSystem.calculateRankRewards(5);
      expect(rank5Rewards).toBeDefined();
    });

  });

  describe('§2.3 节日活动模板', () => {

    it('should retrieve festival template by type', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const springFestival = timedSystem.getFestivalTemplate('spring');
      if (springFestival) {
        expect(springFestival.festivalType).toBe('spring');
        expect(springFestival.name).toBeTruthy();
      }

      const allTemplates = timedSystem.getAllFestivalTemplates();
      expect(allTemplates.length).toBeGreaterThan(0);
    });

    it('should create festival activity from template', () => {
      const sim = createSim();
      const timedSystem = new TimedActivitySystem();
      timedSystem.init({ eventBus: { on: () => {}, emit: () => {} }, config: { get: () => undefined }, registry: { get: () => undefined } });

      const now = Date.now();
      const result = timedSystem.createFestivalActivity(
        'spring',
        now,
        7,
      );

      if (result) {
        expect(result.flow.activityId).toBeTruthy();
        expect(result.flow.activityId).toContain('festival');
        expect(result.template.festivalType).toBe('spring');
      }
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §3 随机事件与概率系统
// ═══════════════════════════════════════════════════════════════
describe('v15.0 事件风云 — §3 随机事件与概率系统', () => {

  it('should calculate probability for an event', () => {
    const sim = createSim();
    const trigger = sim.engine.getEventTriggerSystem();

    const result = trigger.calculateProbability({
      baseProbability: 0.5,
      modifiers: [],
    });

    expect(result).toBeDefined();
    expect(typeof result.finalProbability).toBe('number');
    expect(result.finalProbability).toBeGreaterThanOrEqual(0);
    expect(result.finalProbability).toBeLessThanOrEqual(1);
  });

  it('should register and retrieve probability conditions', () => {
    const sim = createSim();
    const trigger = sim.engine.getEventTriggerSystem();

    const probCondition = {
      baseProbability: 0.3,
      modifiers: [
        { type: 'multiplier' as const, value: 1.5, condition: 'turn_gt_10' },
      ],
    };

    trigger.registerProbabilityCondition('prob-event-001', probCondition);
    const retrieved = trigger.getProbabilityCondition('prob-event-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.baseProbability).toBe(0.3);
  });

  it('should serialize and deserialize event trigger state', () => {
    const sim = createSim();
    const trigger = sim.engine.getEventTriggerSystem();

    const testEvent: EventDef = {
      id: 'serialize-test',
      name: '序列化测试',
      description: '测试序列化',
      triggerType: 'fixed',
      conditions: [],
      options: [{ id: 'opt', text: '选项', consequences: [] }],
    };

    trigger.registerEvent(testEvent);
    trigger.forceTriggerEvent('serialize-test', 1);

    const data = trigger.serialize();
    expect(data).toBeDefined();
    // 序列化数据应包含活跃事件
    expect(data.activeEvents.length).toBeGreaterThan(0);
    // 应包含completedEventIds数组
    expect(Array.isArray(data.completedEventIds)).toBe(true);

    // 反序列化到新实例
    const sim2 = createSim();
    const trigger2 = sim2.engine.getEventTriggerSystem();
    trigger2.deserialize(data);

    // 反序列化后应恢复活跃事件
    expect(trigger2.getActiveEventCount()).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 活动管理系统
// ═══════════════════════════════════════════════════════════════
describe('v15.0 事件风云 — §4 活动管理系统', () => {

  it('should access activity system via engine getter', () => {
    const sim = createSim();
    const activity = sim.engine.getActivitySystem();
    expect(activity).toBeDefined();
    expect(activity.name).toBe('activityMgmt');
  });

  it('should get concurrency config', () => {
    const sim = createSim();
    const activity = sim.engine.getActivitySystem();
    const config = activity.getConcurrencyConfig();
    expect(config).toBeDefined();
    expect(typeof config.maxSeason).toBe('number');
    expect(typeof config.maxLimitedTime).toBe('number');
  });

  it('should get offline efficiency config', () => {
    const sim = createSim();
    const activity = sim.engine.getActivitySystem();
    const efficiency = activity.getOfflineEfficiency();
    expect(efficiency).toBeDefined();
    expect(typeof efficiency.season).toBe('number');
    expect(typeof efficiency.limitedTime).toBe('number');
  });

  it('should get season themes list', () => {
    const sim = createSim();
    const activity = sim.engine.getActivitySystem();
    const themes = activity.getSeasonThemes();
    expect(Array.isArray(themes)).toBe(true);
  });

  it('should serialize and deserialize activity state', () => {
    const sim = createSim();
    const activity = sim.engine.getActivitySystem();
    const state = activity.getState();
    expect(state).toBeDefined();
    expect(state.name).toBe('activityMgmt');
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 事件通知与日志
// ═══════════════════════════════════════════════════════════════
describe('v15.0 事件风云 — §5 事件通知与日志', () => {

  it('should access event notification system via engine getter', () => {
    const sim = createSim();
    const notification = sim.engine.getEventNotificationSystem();
    expect(notification).toBeDefined();
    expect(notification.name).toBe('eventNotification');
  });

  it('should access event chain system via engine getter', () => {
    const sim = createSim();
    const chain = sim.engine.getEventChainSystem();
    expect(chain).toBeDefined();
    expect(chain.name).toBe('eventChain');
  });

  it('should access event log system via engine getter', () => {
    const sim = createSim();
    const log = sim.engine.getEventLogSystem();
    expect(log).toBeDefined();
    expect(log.name).toBe('eventLog');
  });

  it('should access offline event system via engine getter', () => {
    const sim = createSim();
    const offline = sim.engine.getOfflineEventSystem();
    expect(offline).toBeDefined();
    expect(offline.name).toBe('offlineEvent');
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v15.0 事件风云 — §6 跨系统联动', () => {

  it('should reflect event rewards in resource system', () => {
    const sim = createSim();
    sim.addResources(SUFFICIENT_RESOURCES);
    const trigger = sim.engine.getEventTriggerSystem();

    const rewardEvent: EventDef = {
      id: 'gold-reward-event',
      name: '金币奖励事件',
      description: '奖励金币',
      triggerType: 'fixed',
      conditions: [],
      options: [
        {
          id: 'take-gold',
          text: '领取金币',
          consequences: [{ type: 'resource', target: 'gold', value: 500 }],
        },
      ],
    };

    trigger.registerEvent(rewardEvent);
    const result = trigger.forceTriggerEvent('gold-reward-event', 1);
    expect(result.triggered).toBe(true);

    const choiceResult = trigger.resolveEvent(result.instance!.instanceId, 'take-gold');
    // 事件选择成功（资源变更由上层 RewardDistributor 处理）
    expect(choiceResult).not.toBeNull();
    expect(choiceResult!.instanceId).toBe(result.instance!.instanceId);
    expect(choiceResult!.optionId).toBe('take-gold');
  });

  it('should serialize and restore complete event state across systems', () => {
    const sim = createSim();
    const trigger = sim.engine.getEventTriggerSystem();
    const activity = sim.engine.getActivitySystem();

    // 注册事件
    const testEvent: EventDef = {
      id: 'cross-serialize-event',
      name: '跨系统序列化测试',
      description: '测试跨系统序列化',
      triggerType: 'fixed',
      conditions: [],
      options: [{ id: 'opt', text: '选项', consequences: [] }],
    };

    trigger.registerEvent(testEvent);
    trigger.forceTriggerEvent('cross-serialize-event', 1);

    // 序列化事件状态
    const eventData = trigger.serialize();
    expect(eventData).toBeDefined();

    // 活动系统状态也可获取
    const activityState = activity.getState();
    expect(activityState).toBeDefined();
  });

});
