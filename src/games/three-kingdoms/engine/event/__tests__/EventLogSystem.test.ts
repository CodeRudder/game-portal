/**
 * EventLogSystem 单元测试
 *
 * 覆盖事件日志系统的所有功能：
 * - ISubsystem 接口
 * - 事件日志记录
 * - 日志查询与筛选
 * - 回归急报堆
 * - 急报已读管理
 * - 序列化/反序列化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLogSystem } from '../EventLogSystem';
import type { EventLogEntry, ReturnAlert } from '../EventLogSystem';
import type { ISystemDeps } from '../../../core/types';

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

function createSystem(): EventLogSystem {
  const sys = new EventLogSystem();
  sys.init(mockDeps());
  return sys;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('EventLogSystem', () => {
  let system: EventLogSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem 接口', () => {
    it('应该有正确的 name 属性', () => {
      expect(system.name).toBe('eventLog');
    });

    it('init 不应抛出异常', () => {
      expect(() => system.init(mockDeps())).not.toThrow();
    });

    it('update 不应抛出异常', () => {
      expect(() => system.update(16)).not.toThrow();
    });

    it('getState 应返回有效状态', () => {
      const state = system.getState();
      expect(state).toHaveProperty('eventLog');
      expect(state).toHaveProperty('alerts');
    });

    it('reset 应清空所有数据', () => {
      system.logEvent({
        eventDefId: 'evt-01',
        title: '测试',
        description: '测试事件',
        eventType: 'random',
        triggeredTurn: 1,
        timestamp: Date.now(),
      });
      system.addAlert({
        title: '急报',
        description: '测试急报',
        urgency: 'high',
        alertType: 'event',
      });
      system.reset();
      expect(system.getLogCount()).toBe(0);
      expect(system.getUnreadAlertCount()).toBe(0);
    });
  });

  // ─── 事件日志记录 ──────────────────────────

  describe('事件日志记录', () => {
    it('应该能记录事件日志', () => {
      const entry = system.logEvent({
        eventDefId: 'evt-01',
        title: '流民涌入',
        description: '大量流民涌入城池',
        eventType: 'random',
        triggeredTurn: 5,
        timestamp: Date.now(),
      });

      expect(entry.id).toBeTruthy();
      expect(entry.eventDefId).toBe('evt-01');
      expect(entry.title).toBe('流民涌入');
      expect(entry.eventType).toBe('random');
      expect(system.getLogCount()).toBe(1);
    });

    it('记录日志应发出 eventLog:added 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.logEvent({
        eventDefId: 'evt-01',
        title: '测试',
        description: '',
        eventType: 'random',
        triggeredTurn: 1,
        timestamp: Date.now(),
      });

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'eventLog:added',
        expect.objectContaining({ logId: expect.any(String) }),
      );
    });

    it('logEventResolved 应更新已有日志', () => {
      system.logEvent({
        eventDefId: 'evt-01',
        title: '流民涌入',
        description: '大量流民涌入',
        eventType: 'random',
        triggeredTurn: 5,
        timestamp: Date.now(),
      });

      const resolved = system.logEventResolved(
        'evt-01', '接纳流民', '人口+100', 5, 6,
      );

      expect(resolved.chosenOptionText).toBe('接纳流民');
      expect(resolved.consequenceDescription).toBe('人口+100');
      expect(resolved.resolvedTurn).toBe(6);
    });

    it('logEventResolved 无已有日志时应创建新条目', () => {
      const entry = system.logEventResolved(
        'evt-new', '战斗', '胜利', 3, 4, 'fixed', '战斗事件', '发生战斗',
      );

      expect(entry.eventDefId).toBe('evt-new');
      expect(entry.chosenOptionText).toBe('战斗');
      expect(entry.title).toBe('战斗事件');
    });

    it('日志超过上限应自动裁剪', () => {
      for (let i = 0; i < 250; i++) {
        system.logEvent({
          eventDefId: `evt-${i}`,
          title: `事件${i}`,
          description: '',
          eventType: 'random',
          triggeredTurn: i,
          timestamp: Date.now(),
        });
      }
      expect(system.getLogCount()).toBeLessThanOrEqual(200);
    });
  });

  // ─── 日志查询 ──────────────────────────────

  describe('日志查询', () => {
    beforeEach(() => {
      // 添加测试数据
      system.logEvent({ eventDefId: 'evt-r1', title: '随机1', description: '', eventType: 'random', triggeredTurn: 1, timestamp: 1000 });
      system.logEvent({ eventDefId: 'evt-f1', title: '固定1', description: '', eventType: 'fixed', triggeredTurn: 2, timestamp: 2000 });
      system.logEvent({ eventDefId: 'evt-r2', title: '随机2', description: '', eventType: 'random', triggeredTurn: 3, timestamp: 3000 });
      system.logEvent({ eventDefId: 'evt-s1', title: '剧情1', description: '', eventType: 'story', triggeredTurn: 4, timestamp: 4000 });
      system.logEvent({ eventDefId: 'evt-c1', title: '连锁1', description: '', eventType: 'chain', triggeredTurn: 5, timestamp: 5000 });
    });

    it('应能获取全部日志', () => {
      expect(system.getEventLog()).toHaveLength(5);
    });

    it('按事件类型筛选', () => {
      const randomLogs = system.getEventLog({ eventType: 'random' });
      expect(randomLogs).toHaveLength(2);
      expect(randomLogs.every((e) => e.eventType === 'random')).toBe(true);
    });

    it('按回合范围筛选', () => {
      const filtered = system.getEventLog({ minTurn: 2, maxTurn: 4 });
      expect(filtered).toHaveLength(3);
    });

    it('限制返回条数', () => {
      const limited = system.getEventLog({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('getLogEntry 应返回指定日志', () => {
      const allLogs = system.getEventLog();
      const first = allLogs[0];
      const found = system.getLogEntry(first.id);
      expect(found).toBeDefined();
      expect(found!.eventDefId).toBe(first.eventDefId);
    });

    it('getLogCountByType 应返回正确数量', () => {
      expect(system.getLogCountByType('random')).toBe(2);
      expect(system.getLogCountByType('fixed')).toBe(1);
      expect(system.getLogCountByType('story')).toBe(1);
    });

    it('getRecentLogs 应返回最近N条', () => {
      const recent = system.getRecentLogs(3);
      expect(recent).toHaveLength(3);
      expect(recent[2].triggeredTurn).toBe(5); // 最后一条
    });
  });

  // ─── 回归急报堆 ────────────────────────────

  describe('回归急报堆', () => {
    it('应该能添加急报', () => {
      const alert = system.addAlert({
        title: '紧急军情',
        description: '敌军来袭',
        urgency: 'high',
        alertType: 'event',
      });

      expect(alert.id).toBeTruthy();
      expect(alert.title).toBe('紧急军情');
      expect(alert.urgency).toBe('high');
      expect(alert.read).toBe(false);
    });

    it('添加急报应发出 alert:added 事件', () => {
      const deps = mockDeps();
      system.init(deps);
      system.addAlert({
        title: '急报',
        description: '测试',
        urgency: 'medium',
        alertType: 'event',
      });

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'alert:added',
        expect.objectContaining({
          alertId: expect.any(String),
          title: '急报',
          urgency: 'medium',
        }),
      );
    });

    it('批量添加急报', () => {
      const alerts = system.addOfflineAlerts([
        { title: '急报1', description: 'd1', urgency: 'low' },
        { title: '急报2', description: 'd2', urgency: 'high' },
        { title: '急报3', description: 'd3', urgency: 'critical' },
      ]);

      expect(alerts).toHaveLength(3);
      expect(system.getUnreadAlertCount()).toBe(3);
    });

    it('getAlertStack 应按紧急程度排序', () => {
      system.addAlert({ title: '低', description: '', urgency: 'low', alertType: 'event' });
      system.addAlert({ title: '紧急', description: '', urgency: 'critical', alertType: 'event' });
      system.addAlert({ title: '高', description: '', urgency: 'high', alertType: 'event' });
      system.addAlert({ title: '中', description: '', urgency: 'medium', alertType: 'event' });

      const stack = system.getAlertStack();
      expect(stack.alerts[0].urgency).toBe('critical');
      expect(stack.alerts[1].urgency).toBe('high');
      expect(stack.alerts[2].urgency).toBe('medium');
      expect(stack.alerts[3].urgency).toBe('low');
    });

    it('getAlertStack 应返回正确的统计', () => {
      system.addAlert({ title: '1', description: '', urgency: 'high', alertType: 'event' });
      system.addAlert({ title: '2', description: '', urgency: 'low', alertType: 'event' });

      const stack = system.getAlertStack();
      expect(stack.totalCount).toBe(2);
      expect(stack.unreadCount).toBe(2);
      expect(stack.highestUrgency).toBe('high');
    });

    it('空急报堆的 highestUrgency 应为 null', () => {
      const stack = system.getAlertStack();
      expect(stack.highestUrgency).toBeNull();
    });

    it('标记急报已读', () => {
      const alert = system.addAlert({ title: '测试', description: '', urgency: 'medium', alertType: 'event' });
      expect(alert.read).toBe(false);

      const result = system.markAlertRead(alert.id);
      expect(result).toBe(true);

      const found = system.getAlert(alert.id);
      expect(found!.read).toBe(true);
    });

    it('全部标记已读', () => {
      system.addAlert({ title: '1', description: '', urgency: 'low', alertType: 'event' });
      system.addAlert({ title: '2', description: '', urgency: 'high', alertType: 'event' });

      system.markAllAlertsRead();
      expect(system.getUnreadAlertCount()).toBe(0);
    });

    it('清除已读急报', () => {
      const a1 = system.addAlert({ title: '1', description: '', urgency: 'low', alertType: 'event' });
      system.addAlert({ title: '2', description: '', urgency: 'high', alertType: 'event' });

      system.markAlertRead(a1.id);
      system.clearReadAlerts();

      expect(system.getAlerts()).toHaveLength(1);
      expect(system.getAlerts()[0].read).toBe(false);
    });

    it('移除急报', () => {
      const alert = system.addAlert({ title: '测试', description: '', urgency: 'low', alertType: 'event' });
      expect(system.removeAlert(alert.id)).toBe(true);
      expect(system.getAlert(alert.id)).toBeUndefined();
    });

    it('获取未读急报', () => {
      system.addAlert({ title: '1', description: '', urgency: 'low', alertType: 'event' });
      const a2 = system.addAlert({ title: '2', description: '', urgency: 'high', alertType: 'event' });

      system.markAlertRead(a2.id);

      const unread = system.getAlerts(true);
      expect(unread).toHaveLength(1);
      expect(unread[0].title).toBe('1');
    });

    it('急报超过上限应自动裁剪', () => {
      for (let i = 0; i < 60; i++) {
        system.addAlert({ title: `急报${i}`, description: '', urgency: 'low', alertType: 'event' });
      }
      expect(system.getAlerts().length).toBeLessThanOrEqual(50);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('导出后导入应保持一致', () => {
      system.logEvent({
        eventDefId: 'evt-01',
        title: '测试事件',
        description: '描述',
        eventType: 'random',
        triggeredTurn: 5,
        timestamp: Date.now(),
      });

      const alert = system.addAlert({
        title: '急报',
        description: '测试急报',
        urgency: 'high',
        alertType: 'event',
      });

      system.markAlertRead(alert.id);

      const data = system.exportSaveData();

      const newSystem = createSystem();
      newSystem.importSaveData(data);

      expect(newSystem.getLogCount()).toBe(1);
      expect(newSystem.getAlerts()).toHaveLength(1);
      expect(newSystem.getUnreadAlertCount()).toBe(0);
    });

    it('空系统导出导入不应出错', () => {
      const data = system.exportSaveData();
      expect(data.eventLog).toHaveLength(0);
      expect(data.returnAlerts).toHaveLength(0);

      const newSystem = createSystem();
      expect(() => newSystem.importSaveData(data)).not.toThrow();
    });
  });
});
