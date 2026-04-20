/**
 * EventTriggerEngine 单元测试
 *
 * 覆盖：
 *   #6  触发条件引擎（时间+条件+概率）
 *   #7  概率触发公式
 *   #8  通知优先级（6级）
 *   #9  事件冷却
 *   #10 事件选项系统（2-3分支）
 */

import { EventTriggerEngine } from '../EventTriggerEngine';
import type { ISystemDeps } from '../../../core/types';
import type {
  TriggerConditionGroup,
  ProbabilityCondition,
  ProbabilityModifier,
  BranchOption,
} from '../../../core/event/event-v15.types';
import { NotificationPriority } from '../../../core/event/event-v15.types';

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

function createEngine(): EventTriggerEngine {
  const engine = new EventTriggerEngine();
  engine.init(mockDeps());
  return engine;
}

function createConditionGroup(
  eventId: string,
  overrides?: Partial<TriggerConditionGroup>,
): TriggerConditionGroup {
  return {
    id: `cg-${eventId}`,
    eventId,
    stateConditions: [],
    probabilityCondition: { baseProbability: 0.5, modifiers: [] },
    logicOperator: 'AND',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('EventTriggerEngine', () => {
  let engine: EventTriggerEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ─── ISubsystem 接口 ───────────────────────

  describe('ISubsystem 接口', () => {
    it('应该有正确的 name', () => {
      expect(engine.name).toBe('eventTriggerEngine');
    });

    it('reset 应该清空所有状态', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1'));
      engine.setCooldown('evt-1', 1, 5);
      engine.sendNotification('evt-1', '标题', '内容', NotificationPriority.MEDIUM);

      engine.reset();

      expect(engine.getAllConditionGroups()).toHaveLength(0);
      expect(engine.getAllCooldowns()).toHaveLength(0);
      expect(engine.getNotifications()).toHaveLength(0);
    });
  });

  // ─── #6 触发条件引擎 ──────────────────────

  describe('#6 触发条件引擎', () => {
    it('无条件组时默认可触发', () => {
      expect(engine.evaluateTriggerConditions('unknown-event', 1, {})).toBe(true);
    });

    it('时间条件：minTurn 检查', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1', {
        timeCondition: { minTurn: 10 },
      }));

      expect(engine.evaluateTriggerConditions('evt-1', 5, {})).toBe(false);
      expect(engine.evaluateTriggerConditions('evt-1', 10, {})).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 15, {})).toBe(true);
    });

    it('时间条件：maxTurn 检查', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1', {
        timeCondition: { maxTurn: 20 },
      }));

      expect(engine.evaluateTriggerConditions('evt-1', 15, {})).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 20, {})).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 25, {})).toBe(false);
    });

    it('时间条件：turnInterval 检查', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1', {
        timeCondition: { turnInterval: 5 },
      }));

      expect(engine.evaluateTriggerConditions('evt-1', 5, {})).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 10, {})).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 7, {})).toBe(false);
    });

    it('状态条件：AND 逻辑', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1', {
        stateConditions: [
          { type: 'resource', target: 'gold', operator: '>=', value: 100 },
          { type: 'resource', target: 'grain', operator: '>=', value: 50 },
        ],
        logicOperator: 'AND',
      }));

      expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: 100, grain: 50 })).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: 100, grain: 30 })).toBe(false);
      expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: 50, grain: 50 })).toBe(false);
    });

    it('状态条件：OR 逻辑', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1', {
        stateConditions: [
          { type: 'resource', target: 'gold', operator: '>=', value: 100 },
          { type: 'resource', target: 'grain', operator: '>=', value: 50 },
        ],
        logicOperator: 'OR',
      }));

      expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: 100, grain: 0 })).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: 0, grain: 50 })).toBe(true);
      expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: 0, grain: 0 })).toBe(false);
    });

    it('冷却中不可触发', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1'));
      engine.setCooldown('evt-1', 1, 5);

      expect(engine.evaluateTriggerConditions('evt-1', 3, {})).toBe(false);
      expect(engine.evaluateTriggerConditions('evt-1', 6, {})).toBe(true);
    });

    it('状态条件支持所有比较操作符', () => {
      const testCases = [
        { operator: '>' as const, value: 10, testValue: 11, expected: true },
        { operator: '>' as const, value: 10, testValue: 10, expected: false },
        { operator: '<' as const, value: 10, testValue: 9, expected: true },
        { operator: '<' as const, value: 10, testValue: 10, expected: false },
        { operator: '==' as const, value: 10, testValue: 10, expected: true },
        { operator: '==' as const, value: 10, testValue: 11, expected: false },
        { operator: '!=' as const, value: 10, testValue: 11, expected: true },
        { operator: '!=' as const, value: 10, testValue: 10, expected: false },
      ];

      for (const tc of testCases) {
        engine.reset();
        engine.registerConditionGroup(createConditionGroup('evt-1', {
          stateConditions: [
            { type: 'resource', target: 'gold', operator: tc.operator, value: tc.value },
          ],
          logicOperator: 'AND',
        }));
        expect(engine.evaluateTriggerConditions('evt-1', 1, { gold: tc.testValue })).toBe(tc.expected);
      }
    });
  });

  // ─── #7 概率触发公式 ──────────────────────

  describe('#7 概率触发公式', () => {
    it('基础概率无修正时结果等于基础概率', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.3,
        modifiers: [],
      });

      expect(result.baseProbability).toBe(0.3);
      expect(result.additiveTotal).toBe(0);
      expect(result.multiplicativeTotal).toBe(1);
      expect(result.finalProbability).toBeCloseTo(0.3, 5);
    });

    it('加法修正正确累加', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.3,
        modifiers: [
          { name: 'bonus1', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
          { name: 'bonus2', additiveBonus: 0.2, multiplicativeBonus: 1, active: true },
        ],
      });

      expect(result.additiveTotal).toBeCloseTo(0.3, 5);
      expect(result.finalProbability).toBeCloseTo(0.6, 5);
    });

    it('乘法修正正确累乘', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.3,
        modifiers: [
          { name: 'mult1', additiveBonus: 0, multiplicativeBonus: 1.5, active: true },
          { name: 'mult2', additiveBonus: 0, multiplicativeBonus: 2, active: true },
        ],
      });

      expect(result.multiplicativeTotal).toBeCloseTo(3, 5);
      expect(result.finalProbability).toBeCloseTo(0.9, 5);
    });

    it('混合修正正确计算', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.2,
        modifiers: [
          { name: 'add', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
          { name: 'mult', additiveBonus: 0, multiplicativeBonus: 2, active: true },
        ],
      });

      // (0.2 + 0.1) * 2 = 0.6
      expect(result.finalProbability).toBeCloseTo(0.6, 5);
    });

    it('非活跃修正因子不参与计算', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.3,
        modifiers: [
          { name: 'active', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
          { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 3, active: false },
        ],
      });

      expect(result.additiveTotal).toBeCloseTo(0.1, 5);
      expect(result.finalProbability).toBeCloseTo(0.4, 5);
    });

    it('概率被 clamp 到 [0, 1]', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.8,
        modifiers: [
          { name: 'huge', additiveBonus: 0.5, multiplicativeBonus: 2, active: true },
        ],
      });

      expect(result.finalProbability).toBe(1);
    });

    it('概率不能低于 0', () => {
      const result = engine.calculateProbability({
        baseProbability: 0.1,
        modifiers: [
          { name: 'neg', additiveBonus: -0.5, multiplicativeBonus: 1, active: true },
        ],
      });

      expect(result.finalProbability).toBe(0);
    });

    it('rollEventTrigger 返回正确结构', () => {
      engine.registerConditionGroup(createConditionGroup('evt-1'));
      const result = engine.rollEventTrigger('evt-1');

      expect(result).toHaveProperty('finalProbability');
      expect(result).toHaveProperty('baseProbability');
      expect(result).toHaveProperty('triggered');
    });

    it('rollEventTrigger 不存在的条件组返回0', () => {
      const result = engine.rollEventTrigger('nonexistent');
      expect(result.finalProbability).toBe(0);
      expect(result.triggered).toBe(false);
    });

    it('静态工厂方法 createProbabilityCondition', () => {
      const cond = EventTriggerEngine.createProbabilityCondition(0.5);
      expect(cond.baseProbability).toBe(0.5);
      expect(cond.modifiers).toEqual([]);
    });

    it('静态工厂方法 createModifier', () => {
      const mod = EventTriggerEngine.createModifier('test', 0.1, 1.5, true);
      expect(mod.name).toBe('test');
      expect(mod.additiveBonus).toBe(0.1);
      expect(mod.multiplicativeBonus).toBe(1.5);
      expect(mod.active).toBe(true);
    });
  });

  // ─── #8 通知优先级（6级）──────────────────

  describe('#8 通知优先级', () => {
    it('应该支持6级优先级', () => {
      const levels = EventTriggerEngine.getPriorityLevels();
      expect(levels.SYSTEM).toBe(0);
      expect(levels.URGENT).toBe(1);
      expect(levels.HIGH).toBe(2);
      expect(levels.MEDIUM).toBe(3);
      expect(levels.LOW).toBe(4);
      expect(levels.INFO).toBe(5);
    });

    it('发送通知后可查询', () => {
      engine.sendNotification('evt-1', '系统维护', '服务器将维护', NotificationPriority.SYSTEM);
      engine.sendNotification('evt-2', '敌军来袭', '北方敌军入侵', NotificationPriority.URGENT);
      engine.sendNotification('evt-3', '任务完成', '日常任务已完成', NotificationPriority.LOW);

      const notifs = engine.getNotifications();
      expect(notifs).toHaveLength(3);
    });

    it('通知按优先级排序', () => {
      engine.sendNotification('evt-3', '低', '低优先级', NotificationPriority.LOW);
      engine.sendNotification('evt-1', '系统', '系统级', NotificationPriority.SYSTEM);
      engine.sendNotification('evt-2', '紧急', '紧急通知', NotificationPriority.URGENT);

      const notifs = engine.getNotifications();
      expect(notifs[0].priority).toBe(NotificationPriority.SYSTEM);
      expect(notifs[1].priority).toBe(NotificationPriority.URGENT);
      expect(notifs[2].priority).toBe(NotificationPriority.LOW);
    });

    it('获取未读通知', () => {
      engine.sendNotification('evt-1', '标题1', '内容1', NotificationPriority.MEDIUM);
      engine.sendNotification('evt-2', '标题2', '内容2', NotificationPriority.HIGH);

      const unread = engine.getUnreadNotifications();
      expect(unread).toHaveLength(2);

      engine.markNotificationRead(unread[0].id);
      expect(engine.getUnreadNotifications()).toHaveLength(1);
    });

    it('全部标记已读', () => {
      engine.sendNotification('evt-1', '标题1', '内容1', NotificationPriority.MEDIUM);
      engine.sendNotification('evt-2', '标题2', '内容2', NotificationPriority.HIGH);

      engine.markAllRead();
      expect(engine.getUnreadNotifications()).toHaveLength(0);
    });

    it('清理过期通知', () => {
      const now = Date.now();
      engine.sendNotification('evt-1', '过期', '已过期', NotificationPriority.LOW, now - 1000);
      engine.sendNotification('evt-2', '有效', '未过期', NotificationPriority.LOW, now + 10000);

      const cleaned = engine.cleanExpiredNotifications(now);
      expect(cleaned).toBe(1);
      expect(engine.getNotifications()).toHaveLength(1);
    });

    it('按优先级过滤通知', () => {
      engine.sendNotification('evt-1', '系统', '系统级', NotificationPriority.SYSTEM);
      engine.sendNotification('evt-2', '紧急', '紧急', NotificationPriority.URGENT);
      engine.sendNotification('evt-3', '低', '低优先级', NotificationPriority.LOW);

      const system = engine.getNotificationsByPriority(NotificationPriority.SYSTEM);
      expect(system).toHaveLength(1);
      expect(system[0].title).toBe('系统');
    });

    it('获取最高优先级未读通知', () => {
      engine.sendNotification('evt-3', '低', '低', NotificationPriority.LOW);
      engine.sendNotification('evt-1', '系统', '系统级', NotificationPriority.SYSTEM);

      const highest = engine.getHighestPriorityUnread();
      expect(highest).not.toBeNull();
      expect(highest!.priority).toBe(NotificationPriority.SYSTEM);
    });

    it('通知队列不超过最大限制', () => {
      for (let i = 0; i < 60; i++) {
        engine.sendNotification(`evt-${i}`, `标题${i}`, `内容${i}`, NotificationPriority.INFO);
      }

      expect(engine.getNotifications().length).toBeLessThanOrEqual(50);
    });
  });

  // ─── #9 事件冷却 ──────────────────────────

  describe('#9 事件冷却', () => {
    it('设置冷却后可查询', () => {
      const record = engine.setCooldown('evt-1', 10, 5);

      expect(record.eventId).toBe('evt-1');
      expect(record.startTurn).toBe(10);
      expect(record.endTurn).toBe(15);
      expect(record.remainingTurns).toBe(5);
    });

    it('冷却中返回 true', () => {
      engine.setCooldown('evt-1', 10, 5);

      expect(engine.isOnCooldown('evt-1', 12)).toBe(true);
      expect(engine.isOnCooldown('evt-1', 14)).toBe(true);
    });

    it('冷却结束后返回 false', () => {
      engine.setCooldown('evt-1', 10, 5);

      expect(engine.isOnCooldown('evt-1', 15)).toBe(false);
      expect(engine.isOnCooldown('evt-1', 20)).toBe(false);
    });

    it('无冷却记录返回 false', () => {
      expect(engine.isOnCooldown('evt-unknown', 1)).toBe(false);
    });

    it('获取冷却剩余回合', () => {
      engine.setCooldown('evt-1', 10, 5);

      expect(engine.getCooldownRemaining('evt-1', 12)).toBe(3);
      expect(engine.getCooldownRemaining('evt-1', 15)).toBe(0);
      expect(engine.getCooldownRemaining('evt-unknown', 1)).toBe(0);
    });

    it('清除冷却', () => {
      engine.setCooldown('evt-1', 10, 5);
      expect(engine.isOnCooldown('evt-1', 12)).toBe(true);

      engine.clearCooldown('evt-1');
      expect(engine.isOnCooldown('evt-1', 12)).toBe(false);
    });

    it('清理过期冷却', () => {
      engine.setCooldown('evt-1', 1, 5);
      engine.setCooldown('evt-2', 1, 3);
      engine.setCooldown('evt-3', 1, 10);

      const cleaned = engine.cleanExpiredCooldowns(5);
      expect(cleaned).toBe(2); // evt-1(end=6) and evt-2(end=4) are cleaned
      expect(engine.getAllCooldowns()).toHaveLength(1);
    });
  });

  // ─── #10 事件选项系统 ──────────────────────

  describe('#10 事件选项系统（2-3分支）', () => {
    const options: BranchOption[] = [
      {
        id: 'opt-1',
        text: '选项1',
        available: true,
        consequences: { description: '后果1' },
        visibilityConditions: [
          { type: 'resource', target: 'gold', operator: '>=', value: 100 },
        ],
      },
      {
        id: 'opt-2',
        text: '选项2',
        available: true,
        consequences: { description: '后果2' },
        visibilityConditions: [
          { type: 'resource', target: 'gold', operator: '>=', value: 200 },
        ],
      },
      {
        id: 'opt-3',
        text: '选项3',
        available: true,
        consequences: { description: '后果3' },
      },
    ];

    it('评估分支选项可见性', () => {
      const evaluated = engine.evaluateBranchOptions(options, { gold: 150 });

      expect(evaluated[0].available).toBe(true);  // gold >= 100 ✓
      expect(evaluated[1].available).toBe(false); // gold >= 200 ✗
      expect(evaluated[2].available).toBe(true);  // 无条件
    });

    it('获取可用选项', () => {
      const available = engine.getAvailableOptions(options, { gold: 150 });

      expect(available).toHaveLength(2);
      expect(available.map((o) => o.id)).toContain('opt-1');
      expect(available.map((o) => o.id)).toContain('opt-3');
    });

    it('所有条件满足时全部可用', () => {
      const available = engine.getAvailableOptions(options, { gold: 300 });
      expect(available).toHaveLength(3);
    });

    it('无条件选项始终可用', () => {
      const available = engine.getAvailableOptions(options, {});
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('opt-3');
    });
  });

  // ─── 序列化 ──────────────────────────────

  describe('序列化', () => {
    it('序列化和反序列化正确', () => {
      engine.setCooldown('evt-1', 1, 5);
      engine.setCooldown('evt-2', 3, 10);
      engine.sendNotification('evt-1', '标题', '内容', NotificationPriority.HIGH);

      const data = engine.serialize();
      expect(data.cooldowns).toHaveLength(2);
      expect(data.notifications).toHaveLength(1);

      // 反序列化到新引擎
      const engine2 = createEngine();
      engine2.deserialize(data);

      expect(engine2.isOnCooldown('evt-1', 3)).toBe(true);
      expect(engine2.isOnCooldown('evt-2', 5)).toBe(true);
      expect(engine2.getNotifications()).toHaveLength(1);
    });
  });
});
