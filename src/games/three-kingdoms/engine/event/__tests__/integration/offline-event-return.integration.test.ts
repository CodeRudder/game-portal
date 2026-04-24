/**
 * 集成测试 §5: 离线事件 + 回归流程
 *
 * 覆盖 Play §5.1~§5.3 的离线事件处理闭环：
 *   §5.1 离线事件堆积与队列管理
 *     - 离线事件模拟触发
 *     - 队列容量限制（最大50条）
 *     - 堆积上限（OfflineEventHandler 最大10条）
 *     - 紧急程度排序
 *   §5.2 默认选项自动处理
 *     - 低优先级事件自动处理（MEDIUM 及以下）
 *     - 自动处理规则匹配（优先级/分类/事件ID）
 *     - 多种选择策略（default_option / best_outcome / safest / weighted_random / skip）
 *     - 资源变化汇总
 *   §5.3 回归面板与72h超时
 *     - 回归面板数据生成（回溯数据/时间线/资源汇总）
 *     - 手动处理待确认事件
 *     - 72h超时自动处理
 *     - 通知列表转换
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OfflineEventSystem } from '../../OfflineEventSystem';
import { OfflineEventHandler } from '../../OfflineEventHandler';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { EventDef } from '../../../../core/event';
import type {
  OfflineEventEntry,
  AutoProcessRule,
} from '../../../../core/event/event-offline.types';
import type { OfflineEventPile } from '../../../../core/event/event-activity.types';
import { NotificationPriority } from '../../../../core/event/event-encounter.types';

// ─────────────────────────────────────────────
// 辅助
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

function makeEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'evt-offline-001',
    title: '离线测试事件',
    description: '离线期间触发的事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'region',
    options: [
      {
        id: 'opt-default',
        text: '默认选项',
        isDefault: true,
        consequences: { description: '获得铜钱100', resourceChanges: { copper: 100 } },
      },
      {
        id: 'opt-risk',
        text: '冒险选项',
        consequences: { description: '获得铜钱500', resourceChanges: { copper: 500 } },
      },
      {
        id: 'opt-safe',
        text: '安全选项',
        consequences: { description: '无变化', resourceChanges: {} },
      },
    ],
    ...overrides,
  };
}

function makeCriticalEventDef(): EventDef {
  return makeEventDef({
    id: 'evt-critical-001',
    title: '紧急事件',
    description: '高优先级事件',
    urgency: 'critical',
    options: [
      {
        id: 'opt-respond',
        text: '立即响应',
        isDefault: true,
        consequences: { description: '消耗资源', resourceChanges: { copper: -200 } },
      },
    ],
  });
}

function makeNegativeEventDef(): EventDef {
  return makeEventDef({
    id: 'evt-negative-001',
    title: '天灾事件',
    description: '损失资源',
    urgency: 'high',
    options: [
      {
        id: 'opt-defend',
        text: '加固防御',
        isDefault: true,
        consequences: { description: '损失较小', resourceChanges: { copper: -50 } },
      },
      {
        id: 'opt-endure',
        text: '硬抗',
        consequences: { description: '损失较大', resourceChanges: { copper: -200 } },
      },
    ],
  });
}

function makeAutoRule(overrides?: Partial<AutoProcessRule>): AutoProcessRule {
  return {
    id: 'rule-001',
    name: '低优先级自动处理',
    description: '自动处理低优先级事件',
    enabled: true,
    priority: 10,
    urgencyThreshold: 'high',
    applicableCategories: [],
    applicableEventIds: [],
    strategy: 'default_option',
    ...overrides,
  };
}

function addOfflineEvent(
  sys: OfflineEventSystem,
  def: EventDef,
  urgency: OfflineEventEntry['urgency'] = 'low',
  requiresManual = false,
  triggerTurn = 1,
): OfflineEventEntry {
  return sys.addOfflineEvent({
    eventId: `off-${def.id}`,
    eventDefId: def.id,
    title: def.title,
    description: def.description,
    urgency,
    category: 'random',
    triggeredAt: triggerTurn * 60000,
    triggerTurn,
    eventDef: def,
    autoResult: null,
    requiresManualAction: requiresManual,
  });
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('§5 离线事件 + 回归流程集成', () => {
  let sys: OfflineEventSystem;
  let handler: OfflineEventHandler;
  let deps: ISystemDeps;

  beforeEach(() => {
    sys = new OfflineEventSystem();
    handler = new OfflineEventHandler();
    deps = mockDeps();
    sys.init(deps);
  });

  // ─── §5.1 离线事件堆积与队列管理 ──────────

  describe('§5.1 离线事件堆积与队列管理', () => {
    it('应正确添加单个离线事件到队列', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);
      const entry = addOfflineEvent(sys, def, 'low');

      expect(entry.id).toBeTruthy();
      expect(entry.autoProcessed).toBe(false);
      expect(sys.getQueueSize()).toBe(1);
    });

    it('应正确批量添加离线事件', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);

      const entries = sys.addOfflineEvents([
        {
          eventId: 'off-1',
          eventDefId: def.id,
          title: '事件1',
          description: '',
          urgency: 'low' as const,
          category: 'random' as const,
          triggeredAt: 60000,
          triggerTurn: 1,
          eventDef: def,
          autoResult: null,
          requiresManualAction: false,
        },
        {
          eventId: 'off-2',
          eventDefId: def.id,
          title: '事件2',
          description: '',
          urgency: 'medium' as const,
          category: 'random' as const,
          triggeredAt: 120000,
          triggerTurn: 2,
          eventDef: def,
          autoResult: null,
          requiresManualAction: false,
        },
      ]);

      expect(entries).toHaveLength(2);
      expect(sys.getQueueSize()).toBe(2);
    });

    it('队列容量应限制为50条（超出自动裁剪最早的）', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);

      for (let i = 0; i < 55; i++) {
        addOfflineEvent(sys, def, 'low', false, i + 1);
      }

      expect(sys.getQueueSize()).toBe(50);
      // 最早的5条被裁剪
      const queue = sys.getOfflineQueue();
      expect(queue[0].triggerTurn).toBe(6);
    });

    it('OfflineEventHandler 模拟离线事件堆积上限10条', () => {
      const events = Array.from({ length: 15 }, (_, i) =>
        makeEventDef({ id: `evt-pile-${i}`, urgency: 'low' }),
      );

      // 使用确定性概率（通过多次调用验证上限）
      let maxSize = 0;
      for (let t = 0; t < 100; t++) {
        const pile = handler.simulateOfflineEvents(100, events, 1.0);
        maxSize = Math.max(maxSize, pile.events.length);
        if (maxSize >= 10) break;
      }
      expect(maxSize).toBeLessThanOrEqual(10);
    });

    it('OfflineEventHandler 离线0回合无事件', () => {
      const pile = handler.simulateOfflineEvents(0, [makeEventDef()]);
      expect(pile.events).toHaveLength(0);
      expect(pile.offlineTurns).toBe(0);
    });

    it('离线事件应按紧急程度排序（critical > high > medium > low）', () => {
      const def = makeEventDef();
      const critDef = makeCriticalEventDef();
      sys.registerEventDef(def);
      sys.registerEventDef(critDef);

      addOfflineEvent(sys, def, 'low', false, 1);
      addOfflineEvent(sys, critDef, 'critical', true, 2);
      addOfflineEvent(sys, def, 'medium', false, 3);

      const result = sys.processOfflineEvents();
      // critical 排在最前面处理
      expect(result.retrospectiveData.timeline[0].eventTitle).toBe('紧急事件');
    });

    it('应区分待处理事件和已自动处理事件', () => {
      const def = makeEventDef();
      const critDef = makeCriticalEventDef();
      sys.registerEventDef(def);
      sys.registerEventDef(critDef);

      addOfflineEvent(sys, def, 'low', false, 1);
      addOfflineEvent(sys, critDef, 'critical', true, 2);

      expect(sys.getPendingEvents()).toHaveLength(1);
      expect(sys.getAutoProcessedEvents()).toHaveLength(0);
    });

    it('清空队列后大小为0', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);
      addOfflineEvent(sys, def);
      addOfflineEvent(sys, def);

      sys.clearQueue();
      expect(sys.getQueueSize()).toBe(0);
      expect(sys.getOfflineQueue()).toHaveLength(0);
    });
  });

  // ─── §5.2 默认选项自动处理 ───────────────

  describe('§5.2 默认选项自动处理', () => {
    it('低优先级事件应被自动处理（MEDIUM 及以下）', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule());

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      expect(result.manualRequiredCount).toBe(0);
    });

    it('高优先级事件不自动处理，保留待玩家确认', () => {
      const critDef = makeCriticalEventDef();
      sys.registerEventDef(critDef);
      sys.registerAutoRule(makeAutoRule());

      addOfflineEvent(sys, critDef, 'critical', true, 1);

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(0);
      expect(result.manualRequiredCount).toBe(1);
    });

    it('规则按优先级排序（高优先级规则先匹配）', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);

      const rule1 = makeAutoRule({ id: 'rule-low', priority: 5, strategy: 'safest' });
      const rule2 = makeAutoRule({ id: 'rule-high', priority: 20, strategy: 'best_outcome' });
      sys.registerAutoRules([rule1, rule2]);

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      // 高优先级规则先匹配，使用 best_outcome 策略
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-risk');
    });

    it('禁用的规则不参与匹配', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);

      const rule = makeAutoRule({ id: 'rule-disabled', enabled: true });
      sys.registerAutoRule(rule);
      sys.setRuleEnabled('rule-disabled', false);

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      // 无可用规则，事件保留待手动处理
      expect(result.manualRequiredCount).toBe(1);
    });

    it('移除规则后不再匹配', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);

      sys.registerAutoRule(makeAutoRule({ id: 'rule-remove' }));
      sys.removeAutoRule('rule-remove');

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.manualRequiredCount).toBe(1);
    });

    it('策略 default_option 应选择标记为默认的选项', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule({ strategy: 'default_option' }));

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-default');
    });

    it('策略 best_outcome 应选择资源收益最大的选项', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule({ strategy: 'best_outcome' }));

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-risk');
    });

    it('策略 safest 应选择资源消耗最小的选项', () => {
      const negDef = makeNegativeEventDef();
      sys.registerEventDef(negDef);
      sys.registerAutoRule(makeAutoRule({
        strategy: 'safest',
        applicableEventIds: [negDef.id],
      }));

      addOfflineEvent(sys, negDef, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-defend');
    });

    it('策略 skip 应跳过不选择选项', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule({ strategy: 'skip' }));

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.processedEntries[0].selectedOptionId).toBe('');
    });

    it('规则分类过滤应限制适用范围', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);

      const rule = makeAutoRule({
        applicableCategories: ['story' as const],
      });
      sys.registerAutoRule(rule);

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      // category='random' 不匹配 'story'，保留待手动
      expect(result.manualRequiredCount).toBe(1);
    });

    it('规则事件ID过滤应限制适用范围', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);

      const rule = makeAutoRule({
        applicableEventIds: ['nonexistent-event'],
      });
      sys.registerAutoRule(rule);

      addOfflineEvent(sys, def, 'low', false, 1);

      const result = sys.processOfflineEvents();
      expect(result.manualRequiredCount).toBe(1);
    });

    it('自动处理应正确汇总资源变化', () => {
      const def1 = makeEventDef({ id: 'evt-res-1', urgency: 'low' });
      const def2 = makeEventDef({ id: 'evt-res-2', urgency: 'low' });
      sys.registerEventDefs([def1, def2]);
      sys.registerAutoRule(makeAutoRule({ strategy: 'default_option' }));

      addOfflineEvent(sys, def1, 'low', false, 1);
      addOfflineEvent(sys, def2, 'low', false, 2);

      const result = sys.processOfflineEvents();
      expect(result.retrospectiveData.totalResourceChanges.copper).toBe(200);
    });
  });

  // ─── §5.3 回归面板与72h超时 ──────────────

  describe('§5.3 回归面板与72h超时', () => {
    it('应生成完整的回溯数据（事件列表+时间线+资源汇总）', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule());

      addOfflineEvent(sys, def, 'low', false, 1);

      const retro = sys.generateRetrospective();
      expect(retro.offlineEvents).toHaveLength(1);
      expect(retro.timeline).toHaveLength(1);
      expect(retro.totalResourceChanges).toBeDefined();
    });

    it('processOfflineEvents 应返回完整结果（含回溯数据）', () => {
      const def = makeEventDef({ urgency: 'low' });
      const critDef = makeCriticalEventDef();
      sys.registerEventDefs([def, critDef]);
      sys.registerAutoRule(makeAutoRule());

      addOfflineEvent(sys, def, 'low', false, 1);
      addOfflineEvent(sys, critDef, 'critical', true, 2);

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      expect(result.manualRequiredCount).toBe(1);
      expect(result.processedEntries).toHaveLength(1);
      expect(result.pendingEntries).toHaveLength(1);
      expect(result.retrospectiveData.timeline).toHaveLength(2);
    });

    it('清空队列后回溯数据应为空', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);
      addOfflineEvent(sys, def);

      sys.clearQueue();
      const retro = sys.generateRetrospective();
      expect(retro.offlineEvents).toHaveLength(0);
      expect(retro.timeline).toHaveLength(0);
    });

    it('手动处理单个离线事件应返回选项后果', () => {
      const critDef = makeCriticalEventDef();
      sys.registerEventDef(critDef);

      const entry = addOfflineEvent(sys, critDef, 'critical', true, 1);

      const consequence = sys.manualProcessEvent(entry.id, 'opt-respond');
      expect(consequence).not.toBeNull();
      expect(consequence!.description).toBe('消耗资源');
      expect(consequence!.resourceChanges!.copper).toBe(-200);
    });

    it('手动处理后事件应从队列移除', () => {
      const critDef = makeCriticalEventDef();
      sys.registerEventDef(critDef);

      const entry = addOfflineEvent(sys, critDef, 'critical', true, 1);
      expect(sys.getQueueSize()).toBe(1);

      sys.manualProcessEvent(entry.id, 'opt-respond');
      expect(sys.getQueueSize()).toBe(0);
    });

    it('手动处理不存在的事件应返回null', () => {
      const result = sys.manualProcessEvent('nonexistent', 'opt-1');
      expect(result).toBeNull();
    });

    it('手动处理选择不存在的选项应返回null', () => {
      const critDef = makeCriticalEventDef();
      sys.registerEventDef(critDef);
      const entry = addOfflineEvent(sys, critDef, 'critical', true, 1);

      const result = sys.manualProcessEvent(entry.id, 'opt-nonexistent');
      expect(result).toBeNull();
    });

    it('OfflineEventHandler 应正确处理堆积（自动+手动）', () => {
      const lowDef = makeEventDef({ id: 'evt-low', urgency: 'low' });
      const highDef = makeCriticalEventDef();
      const pile = handler.simulateOfflineEvents(5, [lowDef, highDef], 1.0);

      const result = handler.processOfflinePile(pile);
      expect(result.autoResolvedEvents.length + result.pendingEvents.length).toBe(pile.events.length);
      expect(pile.processed).toBe(true);
    });

    it('OfflineEventHandler 手动处理堆积中的事件', () => {
      const highDef = makeCriticalEventDef();
      const pile = handler.simulateOfflineEvents(5, [highDef], 1.0);

      // 找到需要手动处理的事件
      const pending = pile.events.filter(e => !e.autoResult);
      if (pending.length > 0) {
        const entry = pending[0];
        const result = handler.resolveOfflineEvent(pile, entry.eventId, 'opt-respond');
        expect(result.success).toBe(true);
        expect(result.consequences).toBeDefined();
      }
    });

    it('OfflineEventHandler 手动处理不存在的事件应失败', () => {
      const pile = handler.simulateOfflineEvents(1, [makeEventDef()], 1.0);
      const result = handler.resolveOfflineEvent(pile, 'nonexistent', 'opt-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('事件不存在');
    });

    it('OfflineEventHandler 手动处理已自动处理的事件应失败', () => {
      const lowDef = makeEventDef({ id: 'evt-low', urgency: 'low' });
      const pile = handler.simulateOfflineEvents(5, [lowDef], 1.0);

      const autoResolved = pile.events.filter(e => e.autoResult);
      if (autoResolved.length > 0) {
        const result = handler.resolveOfflineEvent(pile, autoResolved[0].eventId, 'opt-default');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('事件已自动处理');
      }
    });

    it('OfflineEventHandler 应正确统计堆积数据', () => {
      const lowDef = makeEventDef({ id: 'evt-low', urgency: 'low' });
      const highDef = makeCriticalEventDef();
      const pile = handler.simulateOfflineEvents(10, [lowDef, highDef], 1.0);

      const stats = handler.getPileStats(pile);
      expect(stats.total).toBe(pile.events.length);
      expect(stats.autoResolved + stats.pending).toBe(stats.total);
    });

    it('OfflineEventHandler 应将堆积事件转换为通知列表（跳过已自动处理的）', () => {
      const lowDef = makeEventDef({ id: 'evt-low', urgency: 'low' });
      const highDef = makeCriticalEventDef();
      const pile = handler.simulateOfflineEvents(10, [lowDef, highDef], 1.0);

      const notifications = handler.convertToNotifications(pile);
      // 只有待手动处理的事件才生成通知
      const pendingCount = pile.events.filter(e => !e.autoResult).length;
      expect(notifications).toHaveLength(pendingCount);
      notifications.forEach(n => {
        expect(n.id).toBeTruthy();
        expect(n.title).toBeTruthy();
        expect(n.read).toBe(false);
      });
    });

    it('72h超时 — 离线超过72h的事件应自动按默认选项处理', () => {
      const def = makeEventDef({ urgency: 'low' });
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule({ strategy: 'default_option' }));

      const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
      const now = Date.now();
      const entry = sys.addOfflineEvent({
        eventId: 'off-timeout',
        eventDefId: def.id,
        title: def.title,
        description: def.description,
        urgency: 'low',
        category: 'random',
        triggeredAt: now - SEVENTY_TWO_HOURS_MS - 60000, // 超过72h
        triggerTurn: 1,
        eventDef: def,
        autoResult: null,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-default');
    });

    it('序列化与恢复 — 离线事件数据应可正确保存和加载', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule({ id: 'rule-serial' }));
      addOfflineEvent(sys, def, 'low', false, 1);

      const saved = sys.exportSaveData();
      expect(saved.version).toBe(15);
      expect(saved.offlineQueue).toHaveLength(1);
      expect(saved.autoRules).toHaveLength(1);

      // 恢复到新实例
      const newSys = new OfflineEventSystem();
      newSys.init(mockDeps());
      newSys.importSaveData(saved);

      expect(newSys.getQueueSize()).toBe(1);
      expect(newSys.getAutoRule('rule-serial')).toBeDefined();
    });

    it('reset 应清空所有状态', () => {
      const def = makeEventDef();
      sys.registerEventDef(def);
      sys.registerAutoRule(makeAutoRule());
      addOfflineEvent(sys, def);

      sys.reset();
      expect(sys.getQueueSize()).toBe(0);
      expect(sys.getAllAutoRules()).toHaveLength(0);
    });
  });
});
