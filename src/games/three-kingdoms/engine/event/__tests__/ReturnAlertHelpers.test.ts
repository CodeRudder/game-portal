/**
 * ReturnAlertHelpers 单元测试
 *
 * 覆盖：createReturnAlert、createOfflineAlerts、filterUnreadAlerts、
 *       markAlertRead、markAllAlertsRead、clearReadAlerts
 */
import { describe, it, expect } from 'vitest';
import {
  createReturnAlert,
  createOfflineAlerts,
  filterUnreadAlerts,
  markAlertRead,
  markAllAlertsRead,
  clearReadAlerts,
} from '../ReturnAlertHelpers';
import type { ReturnAlert } from '../event-chain.types';

function makeAlert(overrides: Partial<ReturnAlert> = {}): ReturnAlert {
  return {
    id: 'alert-1',
    title: '测试急报',
    description: '描述',
    urgency: 'medium',
    timestamp: Date.now(),
    read: false,
    alertType: 'event',
    ...overrides,
  };
}

describe('ReturnAlertHelpers', () => {
  describe('createReturnAlert', () => {
    it('创建新急报并自增计数器', () => {
      const result = createReturnAlert({
        title: '紧急事件',
        description: '敌军来袭',
        urgency: 'critical',
        alertType: 'event',
      }, 5);

      expect(result.alert.id).toBe('alert-6');
      expect(result.alert.title).toBe('紧急事件');
      expect(result.alert.description).toBe('敌军来袭');
      expect(result.alert.urgency).toBe('critical');
      expect(result.alert.read).toBe(false);
      expect(result.alert.alertType).toBe('event');
      expect(result.alert.timestamp).toBeGreaterThan(0);
      expect(result.newCounter).toBe(6);
    });

    it('从0开始计数', () => {
      const result = createReturnAlert({
        title: '测试',
        description: '',
        urgency: 'low',
        alertType: 'story',
      }, 0);

      expect(result.alert.id).toBe('alert-1');
      expect(result.newCounter).toBe(1);
    });
  });

  describe('createOfflineAlerts', () => {
    it('批量创建急报', () => {
      const events = [
        { title: '事件A', description: '描述A', urgency: 'high' as const },
        { title: '事件B', description: '描述B', urgency: 'low' as const },
      ];

      const result = createOfflineAlerts(events, 0);

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].id).toBe('alert-1');
      expect(result.alerts[0].title).toBe('事件A');
      expect(result.alerts[1].id).toBe('alert-2');
      expect(result.alerts[1].title).toBe('事件B');
      expect(result.newCounter).toBe(2);
    });

    it('空事件列表返回空数组', () => {
      const result = createOfflineAlerts([], 0);
      expect(result.alerts).toHaveLength(0);
      expect(result.newCounter).toBe(0);
    });

    it('计数器从指定值开始', () => {
      const events = [
        { title: '事件', description: '', urgency: 'medium' as const },
      ];
      const result = createOfflineAlerts(events, 10);
      expect(result.alerts[0].id).toBe('alert-11');
      expect(result.newCounter).toBe(11);
    });
  });

  describe('filterUnreadAlerts', () => {
    it('过滤出未读急报', () => {
      const alerts = [
        makeAlert({ id: 'a1', read: false }),
        makeAlert({ id: 'a2', read: true }),
        makeAlert({ id: 'a3', read: false }),
      ];

      const unread = filterUnreadAlerts(alerts);
      expect(unread).toHaveLength(2);
      expect(unread[0].id).toBe('a1');
      expect(unread[1].id).toBe('a3');
    });

    it('全部已读返回空数组', () => {
      const alerts = [
        makeAlert({ read: true }),
        makeAlert({ read: true }),
      ];
      expect(filterUnreadAlerts(alerts)).toHaveLength(0);
    });

    it('空数组返回空数组', () => {
      expect(filterUnreadAlerts([])).toHaveLength(0);
    });
  });

  describe('markAlertRead', () => {
    it('标记已读成功', () => {
      const alerts = [makeAlert({ id: 'a1', read: false })];
      const result = markAlertRead(alerts, 'a1');
      expect(result).toBe(true);
      expect(alerts[0].read).toBe(true);
    });

    it('急报不存在返回 false', () => {
      const alerts = [makeAlert({ id: 'a1' })];
      const result = markAlertRead(alerts, 'not-exist');
      expect(result).toBe(false);
    });

    it('空数组返回 false', () => {
      expect(markAlertRead([], 'a1')).toBe(false);
    });
  });

  describe('markAllAlertsRead', () => {
    it('标记全部已读', () => {
      const alerts = [
        makeAlert({ id: 'a1', read: false }),
        makeAlert({ id: 'a2', read: false }),
      ];
      markAllAlertsRead(alerts);
      expect(alerts.every((a) => a.read)).toBe(true);
    });

    it('空数组不报错', () => {
      expect(() => markAllAlertsRead([])).not.toThrow();
    });
  });

  describe('clearReadAlerts', () => {
    it('清除已读急报', () => {
      const alerts = [
        makeAlert({ id: 'a1', read: true }),
        makeAlert({ id: 'a2', read: false }),
        makeAlert({ id: 'a3', read: true }),
      ];
      const remaining = clearReadAlerts(alerts);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('a2');
    });

    it('全部已读返回空数组', () => {
      const alerts = [
        makeAlert({ read: true }),
        makeAlert({ read: true }),
      ];
      expect(clearReadAlerts(alerts)).toHaveLength(0);
    });

    it('全部未读返回原数组', () => {
      const alerts = [
        makeAlert({ id: 'a1', read: false }),
        makeAlert({ id: 'a2', read: false }),
      ];
      const remaining = clearReadAlerts(alerts);
      expect(remaining).toHaveLength(2);
    });
  });
});
