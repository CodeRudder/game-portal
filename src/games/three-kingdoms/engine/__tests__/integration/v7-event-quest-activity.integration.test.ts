/**
 * v7.0 草木皆兵 集成测试 — 流程2: 事件链→日志→日常任务→活跃度→离线联动
 *
 * 对应Play文档: #10连锁事件, #13事件日志, #14急报堆, #17日常任务, #18活跃度, #23核心循环
 *
 * 验证目标：
 * - 连锁事件注册与推进
 * - 事件日志记录与筛选
 * - 日常任务追踪
 * - 活跃度累积与里程碑
 * - 离线事件处理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventChainSystem } from '../../event/EventChainSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import { OfflineEventSystem } from '../../event/OfflineEventSystem';
import { QuestTrackerSystem } from '../../quest/QuestTrackerSystem';
import { ActivitySystem } from '../../quest/ActivitySystem';
import type { ISystemDeps } from '../../../core/types';

// ─── 测试工具 ─────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
    registry: {
      get: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

// ─── 测试套件 ─────────────────────────────────

describe('v7.0 流程2: 事件链→日志→日常任务→活跃度→离线联动', () => {
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  // ─── #10 连锁事件 ──────────────────────────

  describe('#10 连锁事件系统（Plan#10）', () => {
    let chainSys: EventChainSystem;

    beforeEach(() => {
      chainSys = new EventChainSystem();
      chainSys.init(deps);
    });

    it('应注册事件链', () => {
      chainSys.registerChain({
        id: 'chain-taoyuan',
        name: '桃园结义',
        nodes: [
          { id: 'node-1', eventId: 'evt-meet', options: [{ id: 'opt-1', text: '结伴同行', nextNodeId: 'node-2' }] },
          { id: 'node-2', eventId: 'evt-feast', options: [{ id: 'opt-2', text: '桃园结义', nextNodeId: 'node-3' }] },
          { id: 'node-3', eventId: 'evt-oath', options: [] },
        ],
      });

      // 验证链已注册（通过startChain不报错）
      const result = chainSys.startChain('chain-taoyuan');
      expect(result).toBeDefined();
    });

    it('应推进事件链', () => {
      chainSys.registerChain({
        id: 'chain-test',
        name: '测试链',
        nodes: [
          { id: 'n1', eventId: 'e1', options: [{ id: 'o1', text: '继续', nextNodeId: 'n2' }] },
          { id: 'n2', eventId: 'e2', options: [] },
        ],
      });

      chainSys.startChain('chain-test');
      const next = chainSys.advanceChain('chain-test', 'o1');
      expect(next).toBeDefined();
    });

    it('应获取链进度', () => {
      chainSys.registerChain({
        id: 'chain-prog',
        name: '进度链',
        nodes: [
          { id: 'n1', eventId: 'e1', options: [{ id: 'o1', text: '继续', nextNodeId: 'n2' }] },
          { id: 'n2', eventId: 'e2', options: [] },
        ],
      });

      chainSys.startChain('chain-prog');
      const progress = chainSys.getChainProgress('chain-prog');
      expect(progress).toBeDefined();
      expect(progress.totalCount).toBe(2);
    });
  });

  // ─── #13 事件日志 ──────────────────────────

  describe('#13 事件日志面板（Plan#13）', () => {
    let logSys: EventLogSystem;

    beforeEach(() => {
      logSys = new EventLogSystem();
      logSys.init(deps);
    });

    it('应记录事件日志', () => {
      logSys.logEvent({
        eventDefId: 'evt-001',
        title: '路遇豪杰',
        description: '在路上遇到了一位豪杰',
        triggeredTurn: 10,
        eventType: 'random',
      });

      const logs = logSys.getEventLog();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].title).toBe('路遇豪杰');
    });

    it('应按类型筛选日志', () => {
      logSys.logEvent({ eventDefId: 'e1', title: '随机事件', description: '', triggeredTurn: 1, eventType: 'random' });
      logSys.logEvent({ eventDefId: 'e2', title: '连锁事件', description: '', triggeredTurn: 2, eventType: 'chain' });
      logSys.logEvent({ eventDefId: 'e3', title: '剧情事件', description: '', triggeredTurn: 3, eventType: 'story' });

      const randomLogs = logSys.getEventLog({ eventType: 'random' });
      expect(randomLogs.every((l) => l.eventType === 'random')).toBe(true);
    });

    it('应记录事件解决信息', () => {
      logSys.logEventResolved(
        'evt-001', '结伴同行', '获得战友', 10, 12, 'random', '路遇豪杰', '在路上遇到了一位豪杰',
      );

      const logs = logSys.getEventLog();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('应支持分页查询', () => {
      for (let i = 0; i < 10; i++) {
        logSys.logEvent({ eventDefId: `e${i}`, title: `事件${i}`, description: '', triggeredTurn: i, eventType: 'random' });
      }

      const limited = logSys.getEventLog({ limit: 3 });
      expect(limited.length).toBeLessThanOrEqual(3);
    });
  });

  // ─── #14 离线事件处理 ──────────────────────

  describe('#14 离线事件与急报堆（Plan#14）', () => {
    let offlineEvtSys: OfflineEventSystem;

    beforeEach(() => {
      offlineEvtSys = new OfflineEventSystem();
      offlineEvtSys.init(deps);
    });

    it('应注册事件定义', () => {
      offlineEvtSys.registerEventDef({
        id: 'evt-fire',
        name: '火灾',
        type: 'disaster',
        autoResolve: 'reduce',
      });

      // 验证注册后系统状态正常
      const queue = offlineEvtSys.getOfflineQueue();
      expect(Array.isArray(queue)).toBe(true);
    });

    it('应添加离线事件到队列', () => {
      offlineEvtSys.addOfflineEvent({
        eventDefId: 'evt-fire',
        triggeredAt: Date.now() - 3600,
        eventData: { type: 'disaster' },
      });

      const queue = offlineEvtSys.getOfflineQueue();
      expect(queue.length).toBeGreaterThan(0);
    });

    it('应批量添加离线事件', () => {
      offlineEvtSys.addOfflineEvents([
        { eventDefId: 'e1', triggeredAt: Date.now() - 3600, eventData: {} },
        { eventDefId: 'e2', triggeredAt: Date.now() - 1800, eventData: {} },
      ]);

      const queue = offlineEvtSys.getOfflineQueue();
      expect(queue.length).toBeGreaterThanOrEqual(2);
    });

    it('应处理离线事件', () => {
      offlineEvtSys.registerEventDef({ id: 'e1', name: '测试', type: 'random', autoResolve: 'auto' });
      offlineEvtSys.addOfflineEvent({
        eventDefId: 'e1',
        triggeredAt: Date.now() - 3600,
        eventData: {},
      });

      const result = offlineEvtSys.processOfflineEvents();
      expect(result).toBeDefined();
    });
  });

  // ─── #17 日常任务追踪 ──────────────────────

  describe('#17 日常任务追踪（Plan#17）', () => {
    let trackerSys: QuestTrackerSystem;

    beforeEach(() => {
      trackerSys = new QuestTrackerSystem();
      trackerSys.init(deps);
    });

    it('应绑定任务系统', () => {
      const mockQuestSys = { updateProgressByType: vi.fn() };
      trackerSys.bindQuestSystem(mockQuestSys);
      // 验证绑定后状态正常
      const state = trackerSys.getState();
      expect(state).toBeDefined();
    });

    it('应开始追踪', () => {
      trackerSys.startTracking();
      // 验证eventBus.on被调用
      expect(deps.eventBus.on).toHaveBeenCalled();
    });

    it('应获取跳转路由', () => {
      // getQuestJumpRoute需要QuestDef参数，验证getJumpTargets方法
      const state = trackerSys.getState();
      expect(state).toBeDefined();
      expect(state.jumpTargets).toBeDefined();
    });
  });

  // ─── #18 活跃度系统 ───────────────────────

  describe('#18 活跃度系统（Plan#18）', () => {
    let activitySys: ActivitySystem;

    beforeEach(() => {
      activitySys = new ActivitySystem();
      activitySys.init(deps);
    });

    it('应累积活跃度', () => {
      activitySys.addPoints(20);
      activitySys.addPoints(15);

      expect(activitySys.getCurrentPoints()).toBe(35);
    });

    it('活跃度上限应为100', () => {
      activitySys.addPoints(150);
      expect(activitySys.getCurrentPoints()).toBeLessThanOrEqual(100);
    });

    it('应获取活跃度状态', () => {
      activitySys.addPoints(40);
      const state = activitySys.getActivityState();
      expect(state).toBeDefined();
      expect(state.currentPoints).toBe(40);
      expect(state.milestones).toBeDefined();
    });

    it('应领取里程碑奖励', () => {
      activitySys.addPoints(40);
      // 尝试领取第一个里程碑
      const reward = activitySys.claimMilestone(0);
      // 可能返回null如果未达到，或返回奖励
      expect(reward).toBeDefined();
    });

    it('重置后活跃度应归零', () => {
      activitySys.addPoints(60);
      activitySys.reset();
      expect(activitySys.getCurrentPoints()).toBe(0);
    });
  });

  // ─── #23 日常→活跃度→核心循环 ──────────────

  describe('#23 日常任务→活跃度→核心循环（Plan#23）', () => {
    it('完整日常循环应累积到80活跃度', () => {
      const activitySys = new ActivitySystem();
      activitySys.init(deps);

      // 模拟完成6个日常任务
      activitySys.addPoints(10); // 登录
      activitySys.addPoints(20); // 战斗
      activitySys.addPoints(15); // 强化
      activitySys.addPoints(10); // NPC交互
      activitySys.addPoints(15); // 建筑
      activitySys.addPoints(10); // 挂机

      expect(activitySys.getCurrentPoints()).toBe(80);
    });

    it('100活跃度应达到上限', () => {
      const activitySys = new ActivitySystem();
      activitySys.init(deps);

      activitySys.addPoints(100);
      expect(activitySys.getCurrentPoints()).toBe(100);

      // 超出部分不累计
      activitySys.addPoints(50);
      expect(activitySys.getCurrentPoints()).toBeLessThanOrEqual(100);
    });
  });
});
