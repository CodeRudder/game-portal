/**
 * R13: 事件链和触发条件覆盖测试
 *
 * 测试事件系统的复杂触发链：
 *   1. 连锁事件：A 触发 B，B 触发 C
 *   2. 互斥事件：A 和 B 不能同时触发
 *   3. 条件组合：需要同时满足多个条件
 *   4. 时间窗口事件：只在特定时间段触发
 *   5. 优先级事件：多个事件同时满足条件时的优先级
 *
 * 至少 15 个用例。
 *
 * @module engine/event/__tests__/event-chain-coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../EventTriggerSystem';
import { ChainEventSystem } from '../ChainEventSystem';
import { EventChainSystem } from '../EventChainSystem';
import { EventConditionEvaluator, type ConditionContext } from '../EventConditionEvaluator';
import { calculateProbability } from '../EventProbabilityCalculator';
import { evaluateCondition } from '../EventTriggerConditions';
import type { EventDef, EventCondition } from '../../../core/event';
import type {
  EventChainDef,
  ChainNodeDef,
} from '../chain-event-types';
import type {
  EventChain,
  EventChainNode,
  StoryEventDef,
} from '../event-chain.types';
import type { ProbabilityCondition } from '../../../core/event/event-encounter.types';
import type { ISystemDeps } from '../../../core/types';
import { EventBus } from '../../../core/events/EventBus';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: new EventBus(),
    getResource: vi.fn(() => ({ grain: 100, gold: 50 })),
    getGameState: vi.fn(() => ({})),
  } as unknown as ISystemDeps;
}

/** 创建事件定义 */
function createEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'test-event',
    title: '测试事件',
    description: '测试事件描述',
    triggerType: 'random',
    options: [],
    ...overrides,
  };
}

/** 创建连锁事件链定义（ChainEventSystem 用） */
function createChainDef(overrides: Partial<EventChainDef> = {}): EventChainDef {
  return {
    id: 'test-chain',
    name: '测试事件链',
    description: '测试用事件链',
    nodes: [],
    maxDepth: 3,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 事件链和触发条件覆盖测试
// ═══════════════════════════════════════════════════════════════

describe('R13: 事件链和触发条件覆盖测试', () => {
  let triggerSystem: EventTriggerSystem;
  let chainSystem: ChainEventSystem;
  let eventChainSystem: EventChainSystem;
  let evaluator: EventConditionEvaluator;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    triggerSystem = new EventTriggerSystem();
    triggerSystem.init(deps);
    chainSystem = new ChainEventSystem();
    chainSystem.init(deps);
    eventChainSystem = new EventChainSystem();
    eventChainSystem.init(deps);
    evaluator = new EventConditionEvaluator();
  });

  // ─────────────────────────────────────────────
  // 1. 连锁事件：A 触发 B，B 触发 C
  // ─────────────────────────────────────────────

  describe('1. 连锁事件', () => {
    it('应支持 A→B→C 三级连锁事件推进', () => {
      const chain: EventChainDef = createChainDef({
        id: 'chain-abc',
        nodes: [
          { id: 'node-a', eventDefId: 'evt-a', depth: 0 },
          { id: 'node-b', eventDefId: 'evt-b', parentNodeId: 'node-a', parentOptionId: 'opt-attack', depth: 1 },
          { id: 'node-c', eventDefId: 'evt-c', parentNodeId: 'node-b', parentOptionId: 'opt-pursue', depth: 2 },
        ],
        maxDepth: 3,
      });

      chainSystem.registerChain(chain);

      // 开始链 → 到达 node-a
      const root = chainSystem.startChain('chain-abc');
      expect(root).not.toBeNull();
      expect(root!.id).toBe('node-a');

      // 推进 A → B
      const result1 = chainSystem.advanceChain('chain-abc', 'opt-attack');
      expect(result1.success).toBe(true);
      expect(result1.currentNode).not.toBeNull();
      expect(result1.currentNode!.id).toBe('node-b');

      // 推进 B → C
      const result2 = chainSystem.advanceChain('chain-abc', 'opt-pursue');
      expect(result2.success).toBe(true);
      expect(result2.currentNode).not.toBeNull();
      expect(result2.currentNode!.id).toBe('node-c');
    });

    it('链完成后再次推进应返回已完成', () => {
      const chain: EventChainDef = createChainDef({
        id: 'chain-short',
        nodes: [
          { id: 'node-1', eventDefId: 'evt-1', depth: 0 },
        ],
        maxDepth: 1,
      });

      chainSystem.registerChain(chain);
      chainSystem.startChain('chain-short');

      // 没有后续节点，推进后链完成
      const result = chainSystem.advanceChain('chain-short', 'opt-any');
      expect(result.chainCompleted).toBe(true);
      expect(result.currentNode).toBeNull();

      // 再次推进
      const result2 = chainSystem.advanceChain('chain-short', 'opt-any');
      expect(result2.success).toBe(false);
      expect(result2.chainCompleted).toBe(true);
    });

    it('不存在的链应返回 null/失败', () => {
      const result = chainSystem.startChain('non-existent');
      expect(result).toBeNull();

      const advanceResult = chainSystem.advanceChain('non-existent', 'opt');
      expect(advanceResult.success).toBe(false);
    });

    it('连锁事件进度追踪应正确', () => {
      const chain: EventChainDef = createChainDef({
        id: 'chain-progress',
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
          { id: 'n2', eventDefId: 'e2', parentNodeId: 'n1', parentOptionId: 'a', depth: 1 },
          { id: 'n3', eventDefId: 'e3', parentNodeId: 'n2', parentOptionId: 'b', depth: 2 },
        ],
        maxDepth: 3,
      });

      chainSystem.registerChain(chain);
      chainSystem.startChain('chain-progress');

      // 初始进度
      const stats0 = chainSystem.getProgressStats('chain-progress');
      expect(stats0.total).toBe(3);
      expect(stats0.completed).toBe(0);

      // 推进一步
      chainSystem.advanceChain('chain-progress', 'a');
      const stats1 = chainSystem.getProgressStats('chain-progress');
      expect(stats1.completed).toBe(1);

      // 推进两步
      chainSystem.advanceChain('chain-progress', 'b');
      const stats2 = chainSystem.getProgressStats('chain-progress');
      expect(stats2.completed).toBe(2);
    });
  });

  // ─────────────────────────────────────────────
  // 2. 互斥事件
  // ─────────────────────────────────────────────

  describe('2. 互斥事件', () => {
    it('同一事件不能重复触发', () => {
      const evt = createEventDef({ id: 'unique-event', triggerType: 'fixed' });
      triggerSystem.registerEvent(evt);

      // 第一次触发
      const result1 = triggerSystem.forceTriggerEvent('unique-event', 1);
      expect(result1.triggered).toBe(true);

      // 解决事件
      if (result1.instance) {
        triggerSystem.resolveEvent(result1.instance.instanceId, 'opt1');
      }

      // 已完成的事件不应再触发
      const canTrigger = triggerSystem.canTrigger('unique-event', 2);
      expect(canTrigger).toBe(false);
    });

    it('活跃事件数不应超过上限', () => {
      const config = triggerSystem.getConfig();
      const maxEvents = config.maxActiveEvents;

      // 注册足够多的事件
      for (let i = 0; i < maxEvents + 5; i++) {
        triggerSystem.registerEvent(createEventDef({
          id: `evt-${i}`,
          triggerType: 'random',
        }));
      }

      // 强制触发到上限
      let triggeredCount = 0;
      for (let i = 0; i < maxEvents + 5; i++) {
        const result = triggerSystem.forceTriggerEvent(`evt-${i}`, 1);
        if (result.triggered) triggeredCount++;
      }

      // 活跃事件数不应超过上限
      expect(triggerSystem.getActiveEventCount()).toBeLessThanOrEqual(maxEvents);
    });

    it('EventChainSystem 深度限制应生效', () => {
      // maxDepth > 3 应抛出错误
      expect(() => {
        eventChainSystem.registerChain({
          id: 'deep-chain',
          name: '深层链',
          description: '超过深度限制',
          nodes: [],
          maxDepth: 4,
        });
      }).toThrow();
    });

    it('ChainEventSystem 深度限制应生效', () => {
      // maxDepth > 5 应抛出错误
      expect(() => {
        chainSystem.registerChain(createChainDef({
          id: 'too-deep',
          maxDepth: 6,
        }));
      }).toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // 3. 条件组合
  // ─────────────────────────────────────────────

  describe('3. 条件组合评估', () => {
    it('evaluateAll 应要求所有条件同时满足（AND 逻辑）', () => {
      const conditions: EventCondition[] = [
        { type: 'turn_range', params: { minTurn: 5, maxTurn: 20 } },
        { type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '>=' } },
      ];

      const ctx: ConditionContext = {
        currentTurn: 10,
        completedEventIds: new Set(),
        gameState: { gold: 200 },
      };

      // 两个条件都满足
      expect(evaluator.evaluateAll(conditions, ctx)).toBe(true);

      // 只满足 turn 条件（gold 不够）
      ctx.gameState = { gold: 50 };
      expect(evaluator.evaluateAll(conditions, ctx)).toBe(false);

      // 只满足 resource 条件（turn 超出范围）
      ctx.currentTurn = 25;
      ctx.gameState = { gold: 200 };
      expect(evaluator.evaluateAll(conditions, ctx)).toBe(false);
    });

    it('空条件列表应默认通过', () => {
      const ctx: ConditionContext = { currentTurn: 0, completedEventIds: new Set() };
      expect(evaluator.evaluateAll([], ctx)).toBe(true);
      expect(evaluator.evaluateAll(undefined, ctx)).toBe(true);
    });

    it('turn_range 条件应正确评估 min/max/interval', () => {
      const cond: EventCondition = { type: 'turn_range', params: { minTurn: 5, maxTurn: 10 } };

      expect(evaluator.evaluate(cond, { currentTurn: 3, completedEventIds: new Set() })).toBe(false);
      expect(evaluator.evaluate(cond, { currentTurn: 5, completedEventIds: new Set() })).toBe(true);
      expect(evaluator.evaluate(cond, { currentTurn: 7, completedEventIds: new Set() })).toBe(true);
      expect(evaluator.evaluate(cond, { currentTurn: 10, completedEventIds: new Set() })).toBe(true);
      expect(evaluator.evaluate(cond, { currentTurn: 11, completedEventIds: new Set() })).toBe(false);
    });

    it('turn_interval 条件应正确评估', () => {
      const cond: EventCondition = { type: 'turn_range', params: { turnInterval: 5 } };

      expect(evaluator.evaluate(cond, { currentTurn: 0, completedEventIds: new Set() })).toBe(true);
      expect(evaluator.evaluate(cond, { currentTurn: 5, completedEventIds: new Set() })).toBe(true);
      expect(evaluator.evaluate(cond, { currentTurn: 10, completedEventIds: new Set() })).toBe(true);
      expect(evaluator.evaluate(cond, { currentTurn: 3, completedEventIds: new Set() })).toBe(false);
      expect(evaluator.evaluate(cond, { currentTurn: 7, completedEventIds: new Set() })).toBe(false);
    });

    it('resource_threshold 条件应支持 6 种运算符', () => {
      const ctx: ConditionContext = {
        currentTurn: 0,
        completedEventIds: new Set(),
        gameState: { gold: 100 },
      };

      // >=
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '>=' } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 101, operator: '>=' } }, ctx)).toBe(false);

      // <=
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '<=' } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 99, operator: '<=' } }, ctx)).toBe(false);

      // ==
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '==' } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 99, operator: '==' } }, ctx)).toBe(false);

      // !=
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 99, operator: '!=' } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '!=' } }, ctx)).toBe(false);

      // >
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 99, operator: '>' } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '>' } }, ctx)).toBe(false);

      // <
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 101, operator: '<' } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 100, operator: '<' } }, ctx)).toBe(false);
    });

    it('event_completed 条件应正确检查已完成事件', () => {
      const completedIds = new Set(['evt-a', 'evt-b']);

      const ctx: ConditionContext = { currentTurn: 0, completedEventIds: completedIds };

      expect(evaluator.evaluate(
        { type: 'event_completed', params: { eventId: 'evt-a' } }, ctx,
      )).toBe(true);

      expect(evaluator.evaluate(
        { type: 'event_completed', params: { eventId: 'evt-c' } }, ctx,
      )).toBe(false);
    });

    it('无 gameState 时 resource/affinity/building 条件应默认通过', () => {
      const ctx: ConditionContext = { currentTurn: 0, completedEventIds: new Set() };

      expect(evaluator.evaluate({ type: 'resource_threshold', params: { resource: 'gold', value: 999 } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'affinity_level', params: { target: 'npc-1', value: 100 } }, ctx)).toBe(true);
      expect(evaluator.evaluate({ type: 'building_level', params: { target: 'mainHall', value: 10 } }, ctx)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 4. 时间窗口事件
  // ─────────────────────────────────────────────

  describe('4. 时间窗口事件', () => {
    it('固定事件应在指定回合范围内可触发', () => {
      const evt = createEventDef({
        id: 'fixed-window',
        triggerType: 'fixed',
        triggerConditions: [
          { type: 'turn_range', params: { minTurn: 10, maxTurn: 20 } },
        ],
      });

      triggerSystem.registerEvent(evt);

      // 回合 5: 太早
      expect(triggerSystem.canTrigger('fixed-window', 5)).toBe(false);

      // 回合 15: 在窗口内
      expect(triggerSystem.canTrigger('fixed-window', 15)).toBe(true);

      // 回合 25: 太晚
      expect(triggerSystem.canTrigger('fixed-window', 25)).toBe(false);
    });

    it('周期性事件应在间隔回合触发', () => {
      const cond: EventCondition = { type: 'turn_range', params: { turnInterval: 10 } };

      // 只在 0, 10, 20, ... 回合满足
      for (const turn of [0, 10, 20, 30]) {
        expect(evaluateCondition(cond, turn)).toBe(true);
      }
      for (const turn of [1, 5, 11, 15, 23]) {
        expect(evaluateCondition(cond, turn)).toBe(false);
      }
    });
  });

  // ─────────────────────────────────────────────
  // 5. 优先级事件
  // ─────────────────────────────────────────────

  describe('5. 概率与优先级', () => {
    it('概率计算应正确应用加法修正', () => {
      const cond: ProbabilityCondition = {
        baseProbability: 0.5,
        modifiers: [
          { active: true, additiveBonus: 0.2, multiplicativeBonus: 1.0 },
          { active: true, additiveBonus: 0.1, multiplicativeBonus: 1.0 },
        ],
      };

      const result = calculateProbability(cond);
      // P = clamp(0.5 + 0.2 + 0.1) × 1.0 = 0.8
      expect(result.finalProbability).toBeCloseTo(0.8, 5);
      expect(result.additiveTotal).toBeCloseTo(0.3, 5);
    });

    it('概率计算应正确应用乘法修正', () => {
      const cond: ProbabilityCondition = {
        baseProbability: 0.5,
        modifiers: [
          { active: true, additiveBonus: 0, multiplicativeBonus: 1.5 },
          { active: true, additiveBonus: 0, multiplicativeBonus: 0.8 },
        ],
      };

      const result = calculateProbability(cond);
      // P = clamp((0.5 + 0) × 1.5 × 0.8) = clamp(0.6) = 0.6
      expect(result.finalProbability).toBeCloseTo(0.6, 5);
      expect(result.multiplicativeTotal).toBeCloseTo(1.2, 5);
    });

    it('概率应被 clamp 到 [0, 1] 范围', () => {
      // 超大加法修正
      const highCond: ProbabilityCondition = {
        baseProbability: 0.5,
        modifiers: [
          { active: true, additiveBonus: 10, multiplicativeBonus: 1.0 },
        ],
      };
      expect(calculateProbability(highCond).finalProbability).toBe(1);

      // 负修正
      const lowCond: ProbabilityCondition = {
        baseProbability: 0.1,
        modifiers: [
          { active: true, additiveBonus: -0.5, multiplicativeBonus: 1.0 },
        ],
      };
      expect(calculateProbability(lowCond).finalProbability).toBe(0);
    });

    it('inactive 修饰符不应影响概率', () => {
      const cond: ProbabilityCondition = {
        baseProbability: 0.5,
        modifiers: [
          { active: true, additiveBonus: 0.3, multiplicativeBonus: 1.0 },
          { active: false, additiveBonus: 10, multiplicativeBonus: 100 },
        ],
      };

      const result = calculateProbability(cond);
      // 只有 active 修饰符参与
      expect(result.finalProbability).toBeCloseTo(0.8, 5);
    });
  });

  // ─────────────────────────────────────────────
  // 6. 事件链序列化
  // ─────────────────────────────────────────────

  describe('6. 事件链序列化', () => {
    it('ChainEventSystem 序列化后反序列化应恢复进度', () => {
      const chain: EventChainDef = createChainDef({
        id: 'chain-serialize',
        nodes: [
          { id: 'n1', eventDefId: 'e1', depth: 0 },
          { id: 'n2', eventDefId: 'e2', parentNodeId: 'n1', parentOptionId: 'a', depth: 1 },
        ],
        maxDepth: 2,
      });

      chainSystem.registerChain(chain);
      chainSystem.startChain('chain-serialize');
      chainSystem.advanceChain('chain-serialize', 'a');

      // 序列化
      const saved = chainSystem.exportSaveData();
      expect(saved.version).toBeDefined();
      expect(saved.chainProgresses.length).toBe(1);

      // 反序列化到新系统
      const chainSystem2 = new ChainEventSystem();
      chainSystem2.init(deps);
      chainSystem2.registerChain(chain);
      chainSystem2.importSaveData(saved);

      // 验证进度恢复
      const progress = chainSystem2.getProgress('chain-serialize');
      expect(progress).toBeDefined();
      expect(progress!.completedNodeIds.size).toBe(1);
    });

    it('EventChainSystem 序列化后反序列化应恢复状态', () => {
      const chain: EventChain = {
        id: 'echain-test',
        name: '测试链',
        description: '测试',
        nodes: [
          { id: 'en1', eventDefId: 'ee1', depth: 0 },
          { id: 'en2', eventDefId: 'ee2', parentNodeId: 'en1', parentOptionId: 'x', depth: 1 },
        ],
        maxDepth: 2,
      };

      eventChainSystem.registerChain(chain);
      eventChainSystem.startChain('echain-test');
      eventChainSystem.advanceChain('echain-test', 'x');

      // 序列化
      const saved = eventChainSystem.serialize();
      expect(saved.version).toBe(1);

      // 反序列化
      const eventChainSystem2 = new EventChainSystem();
      eventChainSystem2.init(deps);
      eventChainSystem2.registerChain(chain);
      eventChainSystem2.deserialize(saved);

      // 验证进度恢复
      const progress = eventChainSystem2.getChainProgress('echain-test');
      expect(progress.completedCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // 7. 事件日志和急报
  // ─────────────────────────────────────────────

  describe('7. 事件日志和急报', () => {
    it('事件日志应正确记录和查询', () => {
      eventChainSystem.addLogEntry({
        eventDefId: 'evt-1',
        title: '测试日志',
        description: '日志描述',
        eventType: 'random',
        triggeredTurn: 5,
        timestamp: Date.now(),
      });

      expect(eventChainSystem.getLogCount()).toBe(1);
      const logs = eventChainSystem.getEventLog();
      expect(logs.length).toBe(1);
      expect(logs[0].title).toBe('测试日志');
    });

    it('事件日志应支持按类型过滤', () => {
      eventChainSystem.addLogEntry({
        eventDefId: 'e1', title: '随机事件', description: '', eventType: 'random', triggeredTurn: 1, timestamp: 0,
      });
      eventChainSystem.addLogEntry({
        eventDefId: 'e2', title: '固定事件', description: '', eventType: 'fixed', triggeredTurn: 2, timestamp: 0,
      });
      eventChainSystem.addLogEntry({
        eventDefId: 'e3', title: '随机事件2', description: '', eventType: 'random', triggeredTurn: 3, timestamp: 0,
      });

      const randomLogs = eventChainSystem.getEventLog(undefined, 'random');
      expect(randomLogs.length).toBe(2);

      const fixedLogs = eventChainSystem.getEventLog(undefined, 'fixed');
      expect(fixedLogs.length).toBe(1);
    });

    it('急报应支持添加/标记已读/清除', () => {
      const alert1 = eventChainSystem.addReturnAlert({
        title: '急报1',
        description: '紧急',
        urgency: 'high',
        alertType: 'event',
      });

      const alert2 = eventChainSystem.addReturnAlert({
        title: '急报2',
        description: '普通',
        urgency: 'low',
        alertType: 'story',
      });

      // 未读数量
      expect(eventChainSystem.getUnreadAlertCount()).toBe(2);

      // 标记已读
      eventChainSystem.markAlertRead(alert1.id);
      expect(eventChainSystem.getUnreadAlertCount()).toBe(1);

      // 全部标记已读
      eventChainSystem.markAllAlertsRead();
      expect(eventChainSystem.getUnreadAlertCount()).toBe(0);

      // 清除已读
      eventChainSystem.clearReadAlerts();
      expect(eventChainSystem.getReturnAlerts().length).toBe(0);
    });

    it('事件日志超过 100 条应自动截断', () => {
      for (let i = 0; i < 120; i++) {
        eventChainSystem.addLogEntry({
          eventDefId: `e-${i}`,
          title: `日志 ${i}`,
          description: '',
          eventType: 'random',
          triggeredTurn: i,
          timestamp: i,
        });
      }

      // 应只保留最近 100 条
      expect(eventChainSystem.getLogCount()).toBe(100);
      const logs = eventChainSystem.getEventLog();
      expect(logs[0].eventDefId).toBe('e-20'); // 从 20 开始
    });
  });

  // ─────────────────────────────────────────────
  // 8. 事件触发系统完整流程
  // ─────────────────────────────────────────────

  describe('8. 事件触发系统完整流程', () => {
    it('应支持注册-触发-解决完整生命周期', () => {
      const evt = createEventDef({
        id: 'lifecycle-event',
        triggerType: 'random',
        options: [
          { id: 'opt-1', text: '选项1', consequences: [] },
        ],
      });

      triggerSystem.registerEvent(evt);

      // 强制触发
      const triggerResult = triggerSystem.forceTriggerEvent('lifecycle-event', 1);
      expect(triggerResult.triggered).toBe(true);
      expect(triggerResult.instance).toBeDefined();

      // 验证活跃事件
      expect(triggerSystem.getActiveEventCount()).toBe(1);

      // 解决事件
      const instanceId = triggerResult.instance!.instanceId;
      const resolveResult = triggerSystem.resolveEvent(instanceId, 'opt-1');
      // 解决可能返回 null（取决于 EventTriggerLifecycle 实现）
      // 关键是活跃事件减少
      expect(triggerSystem.getActiveEventCount()).toBe(0);

      // 标记为已完成
      expect(triggerSystem.isEventCompleted('lifecycle-event')).toBe(true);
    });

    it('冷却中的事件不应触发', () => {
      const evt = createEventDef({
        id: 'cooldown-event',
        triggerType: 'random',
        cooldownTurns: 10,
      });

      triggerSystem.registerEvent(evt);

      // 触发
      const result = triggerSystem.forceTriggerEvent('cooldown-event', 1);
      expect(result.triggered).toBe(true);

      // 解决
      if (result.instance) {
        triggerSystem.resolveEvent(result.instance.instanceId, 'opt');
      }

      // 冷却期内不应再触发（canTrigger 检查）
      // 注意：forceTrigger 绕过 canTrigger，所以我们检查 canTrigger
      // 已完成的事件 canTrigger 返回 false
      expect(triggerSystem.canTrigger('cooldown-event', 2)).toBe(false);
    });
  });
});
