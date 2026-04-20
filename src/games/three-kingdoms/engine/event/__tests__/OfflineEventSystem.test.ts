/**
 * OfflineEventSystem 单元测试
 *
 * 覆盖 v15.0 离线事件处理系统的所有功能：
 * - ISubsystem 接口
 * - 离线事件队列管理
 * - 自动处理规则管理
 * - 自动处理（按策略选择选项）
 * - 手动处理
 * - 事件回溯数据生成
 * - 序列化/反序列化
 */

import { OfflineEventSystem } from '../OfflineEventSystem';
import type { ISystemDeps } from '../../../core/types';
import type { EventDef } from '../../../core/event';
import type { AutoProcessRule, OfflineEventEntry } from '../../../core/event/event-v15.types';

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

function createSystem(): OfflineEventSystem {
  const sys = new OfflineEventSystem();
  sys.init(mockDeps());
  return sys;
}

function createEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'evt-test',
    title: '测试事件',
    description: '测试',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    options: [
      {
        id: 'opt-accept',
        text: '接受',
        isDefault: true,
        consequences: { description: '获得金币', resourceChanges: { gold: 100 } },
      },
      {
        id: 'opt-reject',
        text: '拒绝',
        consequences: { description: '无变化', resourceChanges: {} },
      },
      {
        id: 'opt-risky',
        text: '冒险',
        consequences: { description: '高风险高回报', resourceChanges: { gold: 500, troops: -200 } },
      },
    ],
    ...overrides,
  };
}

function createAutoRule(overrides?: Partial<AutoProcessRule>): AutoProcessRule {
  return {
    id: 'rule-1',
    name: '低优先级自动处理',
    description: '自动处理低优先级事件',
    applicableCategories: ['random'],
    applicableEventIds: [],
    urgencyThreshold: 'high',
    strategy: 'default_option',
    enabled: true,
    priority: 10,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('OfflineEventSystem', () => {
  // ─── ISubsystem 接口 ────────────────────────

  describe('ISubsystem', () => {
    it('应有正确的 name', () => {
      const sys = createSystem();
      expect(sys.name).toBe('offlineEvent');
    });

    it('reset 应清空所有状态', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试',
        description: '测试',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });
      sys.reset();
      expect(sys.getQueueSize()).toBe(0);
    });
  });

  // ─── 离线事件队列 ──────────────────────────

  describe('离线事件队列', () => {
    it('应正确添加离线事件', () => {
      const sys = createSystem();
      const entry = sys.addOfflineEvent({
        eventDefId: 'evt-1',
        title: '流民求助',
        description: '流民来到领地',
        urgency: 'medium',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      expect(entry.id).toBeDefined();
      expect(entry.autoProcessed).toBe(false);
      expect(sys.getQueueSize()).toBe(1);
    });

    it('批量添加应正确工作', () => {
      const sys = createSystem();
      const entries = sys.addOfflineEvents([
        { eventDefId: 'e1', title: '事件1', description: '', urgency: 'low', category: 'random', triggeredAt: 1000, requiresManualAction: false },
        { eventDefId: 'e2', title: '事件2', description: '', urgency: 'high', category: 'chain', triggeredAt: 2000, requiresManualAction: true },
      ]);
      expect(entries).toHaveLength(2);
      expect(sys.getQueueSize()).toBe(2);
    });

    it('队列超过上限应自动截断', () => {
      const sys = createSystem();
      for (let i = 0; i < 60; i++) {
        sys.addOfflineEvent({
          eventDefId: `evt-${i}`,
          title: `事件${i}`,
          description: '',
          urgency: 'low',
          category: 'random',
          triggeredAt: i * 1000,
          requiresManualAction: false,
        });
      }
      expect(sys.getQueueSize()).toBe(50);
    });

    it('getPendingEvents 应只返回待处理事件', () => {
      const sys = createSystem();
      sys.addOfflineEvent({
        eventDefId: 'e1', title: '待处理', description: '',
        urgency: 'medium', category: 'random', triggeredAt: 1000, requiresManualAction: true,
      });
      sys.addOfflineEvent({
        eventDefId: 'e2', title: '可自动', description: '',
        urgency: 'low', category: 'random', triggeredAt: 2000, requiresManualAction: false,
      });

      expect(sys.getPendingEvents()).toHaveLength(1);
    });

    it('clearQueue 应清空队列', () => {
      const sys = createSystem();
      sys.addOfflineEvent({
        eventDefId: 'e1', title: '测试', description: '',
        urgency: 'low', category: 'random', triggeredAt: 1000, requiresManualAction: false,
      });
      sys.clearQueue();
      expect(sys.getQueueSize()).toBe(0);
    });
  });

  // ─── 自动处理规则 ──────────────────────────

  describe('自动处理规则', () => {
    it('应正确注册和查询规则', () => {
      const sys = createSystem();
      sys.registerAutoRule(createAutoRule());
      expect(sys.getAutoRule('rule-1')).toBeDefined();
      expect(sys.getAllAutoRules()).toHaveLength(1);
    });

    it('规则应按优先级排序', () => {
      const sys = createSystem();
      sys.registerAutoRule(createAutoRule({ id: 'low', priority: 5 }));
      sys.registerAutoRule(createAutoRule({ id: 'high', priority: 20 }));
      const rules = sys.getAllAutoRules();
      expect(rules[0].id).toBe('high');
      expect(rules[1].id).toBe('low');
    });

    it('应启用/禁用规则', () => {
      const sys = createSystem();
      sys.registerAutoRule(createAutoRule());
      sys.setRuleEnabled('rule-1', false);
      expect(sys.getAutoRule('rule-1')!.enabled).toBe(false);
    });

    it('应移除规则', () => {
      const sys = createSystem();
      sys.registerAutoRule(createAutoRule());
      sys.removeAutoRule('rule-1');
      expect(sys.getAutoRule('rule-1')).toBeUndefined();
    });
  });

  // ─── 自动处理 ──────────────────────────────

  describe('自动处理', () => {
    it('default_option 策略应选择默认选项', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ strategy: 'default_option' }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-accept');
    });

    it('best_outcome 策略应选择收益最大的选项', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ strategy: 'best_outcome' }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      // opt-risky 有最大收益 gold:500
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-risky');
    });

    it('safest 策略应选择损失最小的选项', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ strategy: 'safest' }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
      // opt-reject 无损失
      expect(result.processedEntries[0].selectedOptionId).toBe('opt-reject');
    });

    it('高紧急程度事件不应自动处理', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ urgencyThreshold: 'high' }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '紧急事件',
        description: '',
        urgency: 'high', // 等于阈值，不自动处理
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(0);
      expect(result.manualRequiredCount).toBe(1);
    });

    it('需手动确认的事件不应自动处理', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule());
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '需手动',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: true,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(0);
    });

    it('禁用的规则不应匹配', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ enabled: false }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(0);
    });

    it('应正确汇总资源变化', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ strategy: 'default_option' }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试1',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试2',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 2000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      expect(result.retrospectiveData.totalResourceChanges.gold).toBe(200); // 100 * 2
    });
  });

  // ─── 手动处理 ──────────────────────────────

  describe('手动处理', () => {
    it('应正确手动处理事件', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      const entry = sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试',
        description: '',
        urgency: 'medium',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: true,
      });

      const result = sys.manualProcessEvent(entry.id, 'opt-accept');
      expect(result).not.toBeNull();
      expect(result!.resourceChanges!.gold).toBe(100);
      expect(sys.getQueueSize()).toBe(0); // 已从队列移除
    });

    it('处理不存在的事件应返回null', () => {
      const sys = createSystem();
      expect(sys.manualProcessEvent('nonexistent', 'opt-a')).toBeNull();
    });
  });

  // ─── 事件回溯 ──────────────────────────────

  describe('事件回溯', () => {
    it('应生成完整的回溯数据', () => {
      const sys = createSystem();
      sys.registerEventDef(createEventDef());
      sys.registerAutoRule(createAutoRule({ strategy: 'default_option' }));
      sys.addOfflineEvent({
        eventDefId: 'evt-test',
        title: '测试事件',
        description: '测试',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const result = sys.processOfflineEvents();
      const retro = result.retrospectiveData;
      expect(retro.offlineEvents).toHaveLength(1);
      expect(retro.timeline).toHaveLength(1);
      expect(retro.totalResourceChanges.gold).toBe(100);
    });

    it('generateRetrospective 应返回当前状态', () => {
      const sys = createSystem();
      sys.addOfflineEvent({
        eventDefId: 'e1',
        title: '事件1',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const retro = sys.generateRetrospective();
      expect(retro.offlineEvents).toHaveLength(1);
      expect(retro.timeline).toHaveLength(1);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化', () => {
    it('exportSaveData/importSaveData 应保持一致性', () => {
      const sys = createSystem();
      sys.registerAutoRule(createAutoRule());
      sys.addOfflineEvent({
        eventDefId: 'e1',
        title: '测试',
        description: '',
        urgency: 'low',
        category: 'random',
        triggeredAt: 1000,
        requiresManualAction: false,
      });

      const data = sys.exportSaveData();

      const sys2 = createSystem();
      sys2.importSaveData(data);

      expect(sys2.getQueueSize()).toBe(1);
      expect(sys2.getAllAutoRules()).toHaveLength(1);
    });
  });
});
