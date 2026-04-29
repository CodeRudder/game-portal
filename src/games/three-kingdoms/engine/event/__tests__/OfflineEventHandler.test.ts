/**
 * OfflineEventHandler 单元测试
 *
 * 覆盖：simulateOfflineEvents、tryAutoResolve、processOfflinePile、
 *       resolveOfflineEvent、getPileStats、convertToNotifications
 */
import { describe, it, expect } from 'vitest';
import { OfflineEventHandler } from '../OfflineEventHandler';
import type { EventDef } from '../../../core/event';
import { NotificationPriority } from '../../../core/event/event-encounter.types';

function makeDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-1',
    title: '测试事件',
    description: '描述',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    options: [
      {
        id: 'opt-1',
        text: '选项1',
        isDefault: true,
        consequences: {
          description: '结果1',
          resourceChanges: { gold: 100 },
        },
      },
      {
        id: 'opt-2',
        text: '选项2',
        consequences: {
          description: '结果2',
          resourceChanges: { grain: 50 },
        },
      },
    ],
    ...overrides,
  };
}

describe('OfflineEventHandler', () => {
  const handler = new OfflineEventHandler();

  describe('tryAutoResolve', () => {
    it('低优先级事件自动处理', () => {
      const def = makeDef({ urgency: 'medium' });
      const result = handler.tryAutoResolve(def);
      expect(result).not.toBeNull();
      expect(result!.chosenOptionId).toBe('opt-1'); // 默认选项
      expect(result!.reason).toBe('default');
    });

    it('高优先级事件保留给玩家', () => {
      const def = makeDef({ urgency: 'critical' });
      const result = handler.tryAutoResolve(def);
      expect(result).toBeNull();
    });

    it('低优先级无默认选项时选择第一个', () => {
      const def = makeDef({
        urgency: 'low',
        options: [
          { id: 'opt-a', text: 'A', consequences: { description: 'A' } },
          { id: 'opt-b', text: 'B', consequences: { description: 'B' } },
        ],
      });
      const result = handler.tryAutoResolve(def);
      expect(result).not.toBeNull();
      expect(result!.chosenOptionId).toBe('opt-a');
      expect(result!.reason).toBe('highest_weight');
    });
  });

  describe('simulateOfflineEvents', () => {
    it('模拟离线事件生成', () => {
      const events = [makeDef({ id: 'evt-1' }), makeDef({ id: 'evt-2' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);

      expect(pile.offlineTurns).toBe(5);
      expect(pile.processed).toBe(false);
      expect(pile.events.length).toBeGreaterThan(0);
      expect(pile.events.length).toBeLessThanOrEqual(5);
    });

    it('无可用事件时生成空堆积', () => {
      const pile = handler.simulateOfflineEvents(5, [], 1.0);
      expect(pile.events).toHaveLength(0);
    });

    it('离线回合为0时无事件', () => {
      const events = [makeDef()];
      const pile = handler.simulateOfflineEvents(0, events, 1.0);
      expect(pile.events).toHaveLength(0);
    });

    it('概率为0时无事件', () => {
      const events = [makeDef()];
      const pile = handler.simulateOfflineEvents(10, events, 0);
      expect(pile.events).toHaveLength(0);
    });

    it('最多堆积10个事件', () => {
      const events = [makeDef()];
      const pile = handler.simulateOfflineEvents(100, events, 1.0);
      expect(pile.events.length).toBeLessThanOrEqual(10);
    });

    it('事件包含必要字段', () => {
      const events = [makeDef()];
      const pile = handler.simulateOfflineEvents(1, events, 1.0);

      if (pile.events.length > 0) {
        const entry = pile.events[0];
        expect(entry.id).toBeDefined();
        expect(entry.eventId).toBe('evt-1');
        expect(entry.title).toBeDefined();
        expect(entry.triggeredAt).toBeDefined();
        expect(typeof entry.autoProcessed).toBe('boolean');
        expect(typeof entry.requiresManualAction).toBe('boolean');
      }
    });
  });

  describe('processOfflinePile', () => {
    it('分离自动处理和手动处理事件', () => {
      const events = [
        makeDef({ id: 'evt-low', urgency: 'low' }),
        makeDef({ id: 'evt-critical', urgency: 'critical' }),
      ];
      const pile = handler.simulateOfflineEvents(10, events, 1.0);
      const result = handler.processOfflinePile(pile);

      expect(pile.processed).toBe(true);
      expect(result.autoResolvedEvents.length + result.pendingEvents.length).toBe(pile.events.length);
    });

    it('自动处理事件汇总资源变化', () => {
      const events = [makeDef({ id: 'evt-low', urgency: 'low' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);
      const result = handler.processOfflinePile(pile);

      // 如果有自动处理的事件，检查资源汇总
      if (result.autoResolvedEvents.length > 0) {
        expect(typeof result.autoResourceChanges).toBe('object');
      }
    });
  });

  describe('resolveOfflineEvent', () => {
    it('手动处理一个离线事件', () => {
      const events = [makeDef({ id: 'evt-high', urgency: 'critical' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);

      // 找到需要手动处理的事件
      const manualEntry = pile.events.find((e) => e.requiresManualAction);
      if (manualEntry) {
        const result = handler.resolveOfflineEvent(pile, manualEntry.eventId, 'opt-1');
        expect(result.success).toBe(true);
        expect(result.consequences).toBeDefined();
      }
    });

    it('事件不存在返回失败', () => {
      const pile = handler.simulateOfflineEvents(1, [makeDef()], 1.0);
      const result = handler.resolveOfflineEvent(pile, 'not-exist', 'opt-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('事件不存在');
    });

    it('已自动处理的事件不能手动处理', () => {
      const events = [makeDef({ id: 'evt-low', urgency: 'low' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);

      const autoEntry = pile.events.find((e) => e.autoResult);
      if (autoEntry) {
        const result = handler.resolveOfflineEvent(pile, autoEntry.eventId, 'opt-1');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('事件已自动处理');
      }
    });

    it('选项不存在返回失败', () => {
      const events = [makeDef({ id: 'evt-high', urgency: 'critical' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);
      const manualEntry = pile.events.find((e) => e.requiresManualAction);
      if (manualEntry) {
        const result = handler.resolveOfflineEvent(pile, manualEntry.eventId, 'not-exist');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('选项不存在');
      }
    });
  });

  describe('getPileStats', () => {
    it('返回正确统计', () => {
      const events = [makeDef()];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);
      const stats = handler.getPileStats(pile);

      expect(stats.total).toBe(pile.events.length);
      expect(stats.autoResolved + stats.pending).toBe(stats.total);
    });

    it('空堆积统计为0', () => {
      const pile = handler.simulateOfflineEvents(0, [], 1.0);
      const stats = handler.getPileStats(pile);
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.autoResolved).toBe(0);
    });
  });

  describe('convertToNotifications', () => {
    it('转换待处理事件为通知', () => {
      const events = [makeDef({ id: 'evt-high', urgency: 'critical' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);
      const notifications = handler.convertToNotifications(pile);

      // 只有待手动处理的事件才生成通知
      const manualCount = pile.events.filter((e) => !e.autoResult).length;
      expect(notifications.length).toBe(manualCount);

      if (notifications.length > 0) {
        expect(notifications[0].id).toBeDefined();
        expect(notifications[0].title).toBeDefined();
        expect(notifications[0].read).toBe(false);
      }
    });

    it('全部自动处理时无通知', () => {
      const events = [makeDef({ urgency: 'low' })];
      const pile = handler.simulateOfflineEvents(5, events, 1.0);

      // 如果全部自动处理，通知应为空
      const allAuto = pile.events.every((e) => e.autoResult);
      if (allAuto) {
        const notifications = handler.convertToNotifications(pile);
        expect(notifications).toHaveLength(0);
      }
    });
  });
});
