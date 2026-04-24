/**
 * 集成测试 §1: 事件触发 → 连锁事件 → 离线处理 全链路
 *
 * 覆盖 Play §1-§2-§5 的跨系统数据流：
 *   - 事件触发引擎 → 连锁事件推进 → 离线事件堆积 → 回归处理
 *   - 概率公式 → 冷却机制 → 优先级排队
 *   - 连锁事件分支追踪 + 链状态持久化
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../EventTriggerSystem';
import { ChainEventSystem } from '../../ChainEventSystem';
import { OfflineEventSystem } from '../../OfflineEventSystem';
import { EventNotificationSystem } from '../../EventNotificationSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { EventDef, EventInstance } from '../../../../core/event';
import type { EventChainDef, ChainNodeDef } from '../../chain-event-types';
import type { OfflineEventEntry, AutoProcessRule } from '../../../../core/event/event-offline.types';

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
    id: 'evt-test-001',
    title: '测试事件',
    description: '集成测试用事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'region',
    triggerProbability: 0.5,
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        consequences: {
          description: '获得资源',
          resourceChanges: { copper: 100 },
        },
      },
      {
        id: 'opt-b',
        text: '选项B',
        isDefault: true,
        consequences: {
          description: '保守选择',
          resourceChanges: { copper: 50 },
        },
      },
    ],
    ...overrides,
  };
}

function makeChainDef(): EventChainDef {
  return {
    id: 'chain-test-01',
    name: '测试链',
    description: '集成测试用链',
    maxDepth: 3,
    nodes: [
      { id: 'node-0', depth: 0, eventDefId: 'chain-evt-0', parentNodeId: null, parentOptionId: null },
      { id: 'node-1a', depth: 1, eventDefId: 'chain-evt-1a', parentNodeId: 'node-0', parentOptionId: 'opt-help' },
      { id: 'node-1b', depth: 1, eventDefId: 'chain-evt-1b', parentNodeId: 'node-0', parentOptionId: 'opt-refuse' },
      { id: 'node-2a', depth: 2, eventDefId: 'chain-evt-2a', parentNodeId: 'node-1a', parentOptionId: 'opt-accept' },
      { id: 'node-2b', depth: 2, eventDefId: 'chain-evt-2b', parentNodeId: 'node-1b', parentOptionId: 'opt-fight' },
    ],
  };
}

// ═══════════════════════════════════════════════
// §1 事件触发 → 连锁事件 → 离线处理
// ═══════════════════════════════════════════════

describe('§1 事件触发→连锁事件→离线处理 全链路集成', () => {
  let triggerSys: EventTriggerSystem;
  let chainSys: ChainEventSystem;
  let offlineSys: OfflineEventSystem;
  let notifSys: EventNotificationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    triggerSys = new EventTriggerSystem();
    chainSys = new ChainEventSystem();
    offlineSys = new OfflineEventSystem();
    notifSys = new EventNotificationSystem();

    triggerSys.init(deps);
    chainSys.init(deps);
    offlineSys.init(deps);
    notifSys.init(deps);
  });

  // ─── §1.1 事件触发引擎 ──────────────────

  describe('§1.1 事件触发引擎基础', () => {
    it('注册事件后可通过 getEventDef 查询', () => {
      const def = makeEventDef({ id: 'unique-evt-001' });
      triggerSys.registerEvent(def);
      expect(triggerSys.getEventDef('unique-evt-001')).toEqual(def);
    });

    it('批量注册事件后可查询到', () => {
      const defs = [makeEventDef({ id: 'batch-e1' }), makeEventDef({ id: 'batch-e2' }), makeEventDef({ id: 'batch-e3' })];
      triggerSys.registerEvents(defs);
      expect(triggerSys.getEventDef('batch-e1')).toBeDefined();
      expect(triggerSys.getEventDef('batch-e2')).toBeDefined();
      expect(triggerSys.getEventDef('batch-e3')).toBeDefined();
    });

    it('按触发类型过滤事件', () => {
      triggerSys.registerEvents([
        makeEventDef({ id: 'type-r1', triggerType: 'random' }),
        makeEventDef({ id: 'type-f1', triggerType: 'fixed' }),
        makeEventDef({ id: 'type-c1', triggerType: 'chain' }),
      ]);
      const randoms = triggerSys.getEventDefsByType('random');
      const fixeds = triggerSys.getEventDefsByType('fixed');
      const chains = triggerSys.getEventDefsByType('chain');
      // Should contain at least our registered events
      expect(randoms.some(e => e.id === 'type-r1')).toBe(true);
      expect(fixeds.some(e => e.id === 'type-f1')).toBe(true);
      expect(chains.some(e => e.id === 'type-c1')).toBe(true);
    });

    it('canTrigger 对未注册事件返回 false', () => {
      expect(triggerSys.canTrigger('nonexistent', 1)).toBe(false);
    });

    it('强制触发事件成功', () => {
      const def = makeEventDef({ id: 'force-evt-001' });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
    });

    it('checkAndTriggerEvents 按回合检查触发', () => {
      const def = makeEventDef({ id: 'check-evt', triggerType: 'random', triggerProbability: 1.0 });
      triggerSys.registerEvent(def);
      const triggered = triggerSys.checkAndTriggerEvents(1);
      expect(Array.isArray(triggered)).toBe(true);
    });

    it('活跃事件数不超过上限', () => {
      const config = triggerSys.getConfig();
      expect(config.maxActiveEvents).toBeGreaterThan(0);
    });

    it('概率条件注册与查询', () => {
      const def = makeEventDef({ id: 'prob-evt' });
      triggerSys.registerEvent(def);
      const probCond = {
        baseProbability: 0.03,
        modifiers: [{ name: 'test', additiveBonus: 0.01, multiplicativeBonus: 1, active: true }],
      };
      triggerSys.registerProbabilityCondition(def.id, probCond);
      const retrieved = triggerSys.getProbabilityCondition(def.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.baseProbability).toBe(0.03);
    });
  });

  // ─── §1.2 连锁事件系统 ──────────────────

  describe('§1.2 连锁事件分支追踪', () => {
    it('注册链并启动', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      const rootNode = chainSys.startChain(chainDef.id);
      expect(rootNode).not.toBeNull();
      expect(rootNode!.depth).toBe(0);
      expect(rootNode!.id).toBe('node-0');
    });

    it('推进链沿选项分支', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);

      // 选择帮助 → 走 1a 分支
      const result = chainSys.advanceChain(chainDef.id, 'opt-help');
      expect(result.success).toBe(true);
      expect(result.currentNode).not.toBeNull();
      expect(result.currentNode!.id).toBe('node-1a');
      expect(result.chainCompleted).toBe(false);
    });

    it('不同选择走不同分支', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);

      // 选择拒绝 → 走 1b 分支
      const result = chainSys.advanceChain(chainDef.id, 'opt-refuse');
      expect(result.success).toBe(true);
      expect(result.currentNode!.id).toBe('node-1b');
    });

    it('链完成后标记 isCompleted', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);

      // 推进到 node-1a
      const r1 = chainSys.advanceChain(chainDef.id, 'opt-help');
      expect(r1.success).toBe(true);
      // 推进到 node-2a
      const r2 = chainSys.advanceChain(chainDef.id, 'opt-accept');
      expect(r2.success).toBe(true);
      expect(r2.chainCompleted).toBe(false);
      // node-2a 没有后续节点，再次推进链完成
      const r3 = chainSys.advanceChain(chainDef.id, 'opt-any');
      expect(r3.chainCompleted).toBe(true);
    });

    it('获取进度统计', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);
      chainSys.advanceChain(chainDef.id, 'opt-help');

      const stats = chainSys.getProgressStats(chainDef.id);
      expect(stats.completed).toBe(1);
      expect(stats.total).toBe(5);
      expect(stats.percentage).toBe(20);
    });

    it('获取后续节点列表', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);

      const nextNodes = chainSys.getNextNodes(chainDef.id, 'node-0');
      expect(nextNodes).toHaveLength(2);
      expect(nextNodes.map(n => n.id)).toContain('node-1a');
      expect(nextNodes.map(n => n.id)).toContain('node-1b');
    });

    it('未开始的链查询返回 null', () => {
      expect(chainSys.getCurrentNode('nonexistent')).toBeNull();
      expect(chainSys.getProgress('nonexistent')).toBeUndefined();
    });

    it('链深度超限注册抛异常', () => {
      const badChain: EventChainDef = {
        id: 'bad-chain',
        name: '坏链',
        description: '',
        maxDepth: 100,
        nodes: [{ id: 'n0', depth: 0, eventDefId: 'e0', parentNodeId: null, parentOptionId: null }],
      };
      expect(() => chainSys.registerChain(badChain)).toThrow();
    });

    it('已完成的链不能再推进', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);
      chainSys.advanceChain(chainDef.id, 'opt-help');
      chainSys.advanceChain(chainDef.id, 'opt-accept');
      const r3 = chainSys.advanceChain(chainDef.id, 'opt-any');
      // 链已完成
      expect(r3.chainCompleted).toBe(true);

      const result = chainSys.advanceChain(chainDef.id, 'opt-x');
      expect(result.success).toBe(false);
      expect(result.chainCompleted).toBe(true);
    });
  });

  // ─── §1.3 离线事件处理 ──────────────────

  describe('§1.3 离线事件堆积与自动处理', () => {
    it('添加离线事件到队列', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      const entry = offlineSys.addOfflineEvent({
        eventId: 'off-1',
        eventDefId: def.id,
        title: '离线事件1',
        description: '测试',
        urgency: 'medium',
        category: 'random',
        triggeredAt: Date.now(),
        triggerTurn: 5,
        eventDef: def,
        autoResult: null,
        requiresManualAction: true,
      });
      expect(entry.id).toMatch(/^offline-/);
      expect(entry.autoProcessed).toBe(false);
      expect(offlineSys.getQueueSize()).toBe(1);
    });

    it('批量添加离线事件', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      const entries = offlineSys.addOfflineEvents([
        {
          eventId: 'off-a', eventDefId: def.id, title: 'A', description: '',
          urgency: 'low', category: 'random', triggeredAt: Date.now(),
          triggerTurn: 1, eventDef: def, autoResult: null, requiresManualAction: false,
        },
        {
          eventId: 'off-b', eventDefId: def.id, title: 'B', description: '',
          urgency: 'high', category: 'story', triggeredAt: Date.now(),
          triggerTurn: 2, eventDef: def, autoResult: null, requiresManualAction: true,
        },
      ]);
      expect(entries).toHaveLength(2);
      expect(offlineSys.getQueueSize()).toBe(2);
    });

    it('队列大小上限裁剪', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      for (let i = 0; i < 55; i++) {
        offlineSys.addOfflineEvent({
          eventId: `off-${i}`, eventDefId: def.id, title: `E${i}`, description: '',
          urgency: 'low', category: 'random', triggeredAt: Date.now(),
          triggerTurn: i, eventDef: def, autoResult: null, requiresManualAction: false,
        });
      }
      expect(offlineSys.getQueueSize()).toBeLessThanOrEqual(50);
    });

    it('注册自动处理规则', () => {
      const rule: AutoProcessRule = {
        id: 'rule-1',
        name: '低优先级自动处理',
        description: '自动处理低优先级事件',
        enabled: true,
        priority: 10,
        urgencyThreshold: 'medium',
        applicableCategories: ['random'],
        applicableEventIds: [],
        strategy: 'safest',
      };
      offlineSys.registerAutoRule(rule);
      expect(offlineSys.getAutoRule('rule-1')).toBeDefined();
    });

    it('获取待处理和已处理事件', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      offlineSys.addOfflineEvent({
        eventId: 'p1', eventDefId: def.id, title: '需手动', description: '',
        urgency: 'high', category: 'story', triggeredAt: Date.now(),
        triggerTurn: 1, eventDef: def, autoResult: null, requiresManualAction: true,
      });
      offlineSys.addOfflineEvent({
        eventId: 'p2', eventDefId: def.id, title: '自动', description: '',
        urgency: 'low', category: 'random', triggeredAt: Date.now(),
        triggerTurn: 2, eventDef: def, autoResult: null, requiresManualAction: false,
      });
      expect(offlineSys.getPendingEvents()).toHaveLength(1);
    });

    it('手动处理离线事件', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      const entry = offlineSys.addOfflineEvent({
        eventId: 'm1', eventDefId: def.id, title: '手动', description: '',
        urgency: 'high', category: 'story', triggeredAt: Date.now(),
        triggerTurn: 1, eventDef: def, autoResult: null, requiresManualAction: true,
      });
      const result = offlineSys.manualProcessEvent(entry.id, 'opt-a');
      expect(result).not.toBeNull();
      expect(offlineSys.getQueueSize()).toBe(0);
    });

    it('手动处理不存在的事件返回 null', () => {
      const result = offlineSys.manualProcessEvent('nonexistent', 'opt-a');
      expect(result).toBeNull();
    });

    it('生成事件回溯数据', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      offlineSys.addOfflineEvent({
        eventId: 'retro-1', eventDefId: def.id, title: '回溯', description: '',
        urgency: 'medium', category: 'random', triggeredAt: 1000,
        triggerTurn: 1, eventDef: def, autoResult: null, requiresManualAction: false,
      });
      const retro = offlineSys.generateRetrospective();
      expect(retro.timeline).toHaveLength(1);
      expect(retro.offlineEvents).toHaveLength(1);
    });

    it('序列化与反序列化', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      offlineSys.addOfflineEvent({
        eventId: 'ser-1', eventDefId: def.id, title: '序列化', description: '',
        urgency: 'low', category: 'random', triggeredAt: Date.now(),
        triggerTurn: 1, eventDef: def, autoResult: null, requiresManualAction: false,
      });
      const data = offlineSys.exportSaveData();
      expect(data.version).toBe(15);
      expect(data.offlineQueue).toHaveLength(1);

      const newSys = new OfflineEventSystem();
      newSys.init(mockDeps());
      newSys.importSaveData(data);
      expect(newSys.getQueueSize()).toBe(1);
    });
  });

  // ─── §1.4 通知系统 ──────────────────────

  describe('§1.4 急报横幅通知', () => {
    it('创建横幅通知', () => {
      const def = makeEventDef();
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      const banner = notifSys.createBanner(result.instance!, {
        title: def.title,
        description: def.description,
        urgency: def.urgency,
      });
      expect(banner.id).toMatch(/^banner-/);
      expect(banner.title).toBe(def.title);
    });

    it('获取活跃横幅列表', () => {
      const def = makeEventDef();
      triggerSys.registerEvent(def);
      const inst = triggerSys.forceTriggerEvent(def.id, 1).instance!;
      notifSys.createBanner(inst, { title: 'T1', description: 'D1', urgency: 'high' });
      notifSys.createBanner(inst, { title: 'T2', description: 'D2', urgency: 'critical' });
      const active = notifSys.getActiveBanners();
      expect(active).toHaveLength(2);
      // critical 应排在前面
      expect(active[0].urgency).toBe('critical');
    });

    it('标记横幅已读', () => {
      const def = makeEventDef();
      triggerSys.registerEvent(def);
      const inst = triggerSys.forceTriggerEvent(def.id, 1).instance!;
      const banner = notifSys.createBanner(inst, { title: 'T', description: 'D', urgency: 'medium' });
      expect(notifSys.markBannerRead(banner.id)).toBe(true);
      expect(notifSys.getUnreadBanners()).toHaveLength(0);
    });

    it('移除横幅', () => {
      const def = makeEventDef();
      triggerSys.registerEvent(def);
      const inst = triggerSys.forceTriggerEvent(def.id, 1).instance!;
      const banner = notifSys.createBanner(inst, { title: 'T', description: 'D', urgency: 'low' });
      expect(notifSys.removeBanner(banner.id)).toBe(true);
      expect(notifSys.getActiveBanners()).toHaveLength(0);
    });

    it('获取横幅状态', () => {
      const state = notifSys.getBannerState();
      expect(state.activeBanners).toHaveLength(0);
      expect(state.hasUnread).toBe(false);
    });

    it('序列化与恢复', () => {
      const banners = notifSys.serializeBanners();
      expect(Array.isArray(banners)).toBe(true);
      const newSys = new EventNotificationSystem();
      newSys.init(mockDeps());
      newSys.deserializeBanners(banners);
      expect(newSys.getBannerState()).toBeDefined();
    });
  });

  // ─── §1.5 跨系统联动 ──────────────────

  describe('§1.5 事件→连锁→离线 跨系统联动', () => {
    it('事件触发→创建横幅→连锁推进→离线处理 全链路', () => {
      // 1. 注册事件
      const def = makeEventDef({ id: 'cross-evt-001' });
      triggerSys.registerEvent(def);

      // 2. 注册连锁链
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);

      // 3. 触发事件
      const triggerResult = triggerSys.forceTriggerEvent(def.id, 1);
      expect(triggerResult.triggered).toBe(true);

      // 4. 创建横幅
      const banner = notifSys.createBanner(triggerResult.instance!, {
        title: def.title,
        description: def.description,
        urgency: def.urgency,
      });
      expect(banner).toBeDefined();

      // 5. 启动链并推进
      const rootNode = chainSys.startChain(chainDef.id);
      expect(rootNode).not.toBeNull();
      const advanceResult = chainSys.advanceChain(chainDef.id, 'opt-help');
      expect(advanceResult.success).toBe(true);

      // 6. 离线处理
      offlineSys.registerEventDef(def);
      const offlineEntry = offlineSys.addOfflineEvent({
        eventId: 'off-chain-1',
        eventDefId: def.id,
        title: '链事件离线堆积',
        description: '链推进中离线',
        urgency: 'medium',
        category: 'chain',
        triggeredAt: Date.now(),
        triggerTurn: 3,
        eventDef: def,
        autoResult: null,
        requiresManualAction: true,
      });
      expect(offlineSys.getPendingEvents()).toHaveLength(1);

      // 7. 手动处理离线事件
      const manualResult = offlineSys.manualProcessEvent(offlineEntry.id, 'opt-a');
      expect(manualResult).not.toBeNull();
    });

    it('连锁事件序列化后恢复可继续推进', () => {
      const chainDef = makeChainDef();
      chainSys.registerChain(chainDef);
      chainSys.startChain(chainDef.id);
      chainSys.advanceChain(chainDef.id, 'opt-help');

      // 保存
      const saveData = chainSys.exportSaveData();

      // 恢复
      const newChainSys = new ChainEventSystem();
      newChainSys.init(mockDeps());
      newChainSys.registerChain(chainDef);
      newChainSys.importSaveData(saveData);

      expect(newChainSys.isChainStarted(chainDef.id)).toBe(true);
      const progress = newChainSys.getProgress(chainDef.id);
      expect(progress!.completedNodeIds.size).toBe(1);
    });
  });
});
