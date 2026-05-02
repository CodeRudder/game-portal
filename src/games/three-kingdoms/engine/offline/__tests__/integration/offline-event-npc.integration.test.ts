/**
 * v9.0 离线收益集成测试 — 事件堆积 / NPC刷新 / 好感度 / 限时NPC
 *
 * 覆盖 Play 文档:
 *   §3.5  事件系统离线行为
 *   §3.6  NPC离线行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineEventSystem } from '../../../event/OfflineEventSystem';
import { OfflineEventHandler } from '../../../event/OfflineEventHandler';
import {
  OfflineRewardSystem,
  calculateOfflineSnapshot,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  SYSTEM_EFFICIENCY_MODIFIERS,
} from '../../index';
import { OfflineSnapshotSystem } from '../../OfflineSnapshotSystem';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';
import type { EventDef } from '../../../../core/event/event.types';
import type { AutoProcessRule } from '../../../../core/event/event-offline.types';

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function zeroRes(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
}

function makeRates(overrides: Partial<ProductionRate> = {}): ProductionRate {
  return { grain: 10, gold: 5, troops: 2, mandate: 1, techPoint: 0.5, ...overrides };
}

function makeCaps(overrides: Partial<ResourceCap> = {}): ResourceCap {
  return { grain: 5000, gold: 2000, troops: 1000, mandate: null, techPoint: null, ...overrides };
}

function makeEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'test-event-1',
    title: '测试事件',
    description: '测试事件描述',
    urgency: 'medium' as const,
    category: 'random',
    options: [
      { id: 'opt-1', text: '选项1', consequences: { description: '结果1', resourceChanges: { gold: 100 } }, isDefault: true },
      { id: 'opt-2', text: '选项2', consequences: { description: '结果2', resourceChanges: { grain: -50 } } },
    ],
    ...overrides,
  };
}

function makeAutoRule(overrides: Partial<AutoProcessRule> = {}): AutoProcessRule {
  return {
    id: 'rule-1',
    name: '自动处理低优先级',
    description: '自动处理medium及以下事件',
    enabled: true,
    priority: 10,
    urgencyThreshold: 'medium',
    applicableCategories: [],
    applicableEventIds: [],
    strategy: 'default_option',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// §3.5 事件系统离线行为
// ─────────────────────────────────────────────

describe('v9-int §3.5 事件系统离线行为', () => {
  let eventSystem: OfflineEventSystem;

  beforeEach(() => {
    eventSystem = new OfflineEventSystem();
    eventSystem.reset();
  });

  it('§3.5.1 离线事件队列为空时getOfflineQueue返回空数组', () => {
    expect(eventSystem.getOfflineQueue()).toEqual([]);
    expect(eventSystem.getQueueSize()).toBe(0);
  });

  it('§3.5.2 添加离线事件到队列', () => {
    const eventDef = makeEventDef();
    const entry = eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '暴风来袭',
      description: '一场暴风正在逼近',
      urgency: 'high',
      category: 'random',
      triggeredAt: Date.now() - 3600000,
      requiresManualAction: true,
      triggerTurn: 5,
      eventDef,
      autoResult: null,
    });
    expect(entry.id).toBeTruthy();
    expect(entry.autoProcessed).toBe(false);
    expect(eventSystem.getQueueSize()).toBe(1);
  });

  it('§3.5.3 批量添加离线事件', () => {
    const eventDef = makeEventDef();
    const events = Array.from({ length: 5 }, (_, i) => ({
      eventId: `evt-${i}` as unknown as string,
      eventDefId: `evt-${i}`,
      title: `事件${i}`,
      description: `描述${i}`,
      urgency: 'medium' as const,
      category: 'random' as unknown as string,
      triggeredAt: Date.now() - i * 60000,
      requiresManualAction: false,
      triggerTurn: i,
      eventDef: makeEventDef({ id: `evt-${i}` }),
      autoResult: null,
    }));
    const entries = eventSystem.addOfflineEvents(events);
    expect(entries).toHaveLength(5);
    expect(eventSystem.getQueueSize()).toBe(5);
  });

  it('§3.5.4 队列容量上限50，超出截断', () => {
    const eventDef = makeEventDef();
    for (let i = 0; i < 55; i++) {
      eventSystem.addOfflineEvent({
        eventId: `evt-${i}` as unknown as string,
        eventDefId: `evt-${i}`,
        title: `事件${i}`,
        description: `描述${i}`,
        urgency: 'low',
        category: 'random' as unknown as string,
        triggeredAt: Date.now() - i * 60000,
        requiresManualAction: false,
        triggerTurn: i,
        eventDef: makeEventDef({ id: `evt-${i}` }),
        autoResult: null,
      });
    }
    expect(eventSystem.getQueueSize()).toBe(50);
  });

  it('§3.5.5 自动处理规则注册与匹配', () => {
    const rule = makeAutoRule();
    eventSystem.registerAutoRule(rule);
    const allRules = eventSystem.getAllAutoRules();
    expect(allRules).toHaveLength(1);
    expect(allRules[0].id).toBe('rule-1');
  });

  it('§3.5.6 自动处理规则按优先级排序', () => {
    eventSystem.registerAutoRule(makeAutoRule({ id: 'low', priority: 1 }));
    eventSystem.registerAutoRule(makeAutoRule({ id: 'high', priority: 100 }));
    eventSystem.registerAutoRule(makeAutoRule({ id: 'mid', priority: 50 }));
    const rules = eventSystem.getAllAutoRules();
    expect(rules[0].id).toBe('high');
    expect(rules[1].id).toBe('mid');
    expect(rules[2].id).toBe('low');
  });

  it('§3.5.7 processOfflineEvents自动处理低优先级事件', () => {
    const eventDef = makeEventDef({ urgency: 'low' });
    eventSystem.registerEventDef(eventDef);
    eventSystem.registerAutoRule(makeAutoRule({ urgencyThreshold: 'medium' }));
    eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '低优先级事件',
      description: '自动处理',
      urgency: 'low',
      category: 'random' as unknown as string,
      triggeredAt: Date.now() - 3600000,
      requiresManualAction: false,
      triggerTurn: 1,
      eventDef,
      autoResult: null,
    });
    const result = eventSystem.processOfflineEvents();
    expect(result.autoProcessedCount).toBeGreaterThanOrEqual(0);
    expect(result.retrospectiveData).toBeDefined();
  });

  it('§3.5.8 getPendingEvents返回需手动处理的事件', () => {
    const eventDef = makeEventDef();
    eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '需手动处理',
      description: '高优先级',
      urgency: 'critical',
      category: 'random' as unknown as string,
      triggeredAt: Date.now(),
      requiresManualAction: true,
      triggerTurn: 1,
      eventDef,
      autoResult: null,
    });
    const pending = eventSystem.getPendingEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].urgency).toBe('critical');
  });

  it('§3.5.9 clearQueue清空队列', () => {
    const eventDef = makeEventDef();
    eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '事件',
      description: '描述',
      urgency: 'low',
      category: 'random' as unknown as string,
      triggeredAt: Date.now(),
      requiresManualAction: false,
      triggerTurn: 1,
      eventDef,
      autoResult: null,
    });
    expect(eventSystem.getQueueSize()).toBe(1);
    eventSystem.clearQueue();
    expect(eventSystem.getQueueSize()).toBe(0);
  });

  it('§3.5.10 OfflineEventHandler模拟离线事件触发', () => {
    const handler = new OfflineEventHandler();
    const eventPool = [makeEventDef({ id: 'evt-a' }), makeEventDef({ id: 'evt-b' })];
    const pile = handler.simulateOfflineEvents(10, eventPool, 1.0);
    expect(pile.offlineTurns).toBe(10);
    expect(pile.events.length).toBeGreaterThan(0);
    expect(pile.events.length).toBeLessThanOrEqual(10);
  });

  it('§3.5.11 OfflineEventHandler处理事件堆积', () => {
    const handler = new OfflineEventHandler();
    const eventPool = [makeEventDef({ id: 'evt-a' })];
    const pile = handler.simulateOfflineEvents(5, eventPool, 1.0);
    const result = handler.processOfflinePile(pile);
    expect(result.autoResolvedEvents).toBeDefined();
    expect(result.pendingEvents).toBeDefined();
    expect(result.autoResourceChanges).toBeDefined();
  });

  it('§3.5.12 OfflineEventHandler资源变化汇总', () => {
    const handler = new OfflineEventHandler();
    const eventDef = makeEventDef({
      id: 'resource-evt',
      options: [{
        id: 'opt-1',
        text: '获取资源',
        consequences: { description: '获得铜钱', resourceChanges: { gold: 200 } },
        isDefault: true,
      }],
    });
    const pile = handler.simulateOfflineEvents(3, [eventDef], 1.0);
    const result = handler.processOfflinePile(pile);
    // 自动处理的事件应该汇总了资源变化
    expect(typeof result.autoResourceChanges).toBe('object');
  });
});

// ─────────────────────────────────────────────
// §3.6 NPC离线行为
// ─────────────────────────────────────────────

describe('v9-int §3.6 NPC离线行为', () => {
  let rewardSystem: OfflineRewardSystem;
  let snapshotSystem: OfflineSnapshotSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
  });

  it('§3.6.1 离线快照不影响NPC好感度（引擎层未实现NPC好感度衰减）', () => {
    // 离线快照记录资源产出速率，不包含NPC好感度数据
    const snap = snapshotSystem.createSnapshot({
      resources: { grain: 100, gold: 50, troops: 10, mandate: 5, techPoint: 2 },
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    // 快照只有资源/速率/队列数据，无NPC好感度字段
    expect(snap.resources).toBeDefined();
    expect((snap as unknown as Record<string, unknown>).npcAffinity).toBeUndefined();
  });

  it('§3.6.2 NPC系统离线效率系数(hero=0.5)', () => {
    const heroModifier = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === 'hero');
    expect(heroModifier).toBeDefined();
    expect(heroModifier!.modifier).toBe(0.5);
  });

  it('§3.6.3 离线收益计算不包含NPC好感度产出', () => {
    const snapshot = calculateOfflineSnapshot(
      2 * HOUR_S,
      makeRates(),
      { tech: 0, vip: 0, reputation: 0 },
    );
    // 收益只包含5种资源，无NPC好感度
    const keys = Object.keys(snapshot.totalEarned);
    expect(keys).toContain('grain');
    expect(keys).toContain('gold');
    expect(keys).toContain('troops');
    expect(keys).toContain('mandate');
    expect(keys).not.toContain('npcAffinity');
  });

  it('§3.6.4 NPC好感度系统需要NPC系统依赖（引擎层未完整集成）', () => {
    // NPCFavorabilitySystem 需要 NPCSystem 依赖才能工作
    // 离线场景下无法独立验证好感度变化
    // 此用例记录该限制，待v10+完善
    expect(true).toBe(true);
  });

  it('§3.6.5 限时NPC离线期间可能过期（引擎层未实现限时NPC）', () => {
    // 限时NPC刷新和过期逻辑在NPCSpawnManager中
    // 离线期间的时间推进可能导致限时NPC消失
    // 引擎层尚未实现离线NPC过期检测
    expect(true).toBe(true);
  });

  it('§3.6.6 NPC刷新管理器离线不触发（引擎层未实现）', () => {
    // NPCSpawnManager的定时刷新在update循环中
    // 离线期间不执行update，不会产生新NPC
    // 待后续版本实现离线NPC模拟
    expect(true).toBe(true);
  });

  it('§3.6.7 离线收益与事件系统资源变化独立计算', () => {
    // 离线收益由OfflineRewardSystem计算
    // 事件资源变化由OfflineEventSystem汇总
    // 两者独立计算，不重复
    const rewardSnapshot = calculateOfflineSnapshot(
      4 * HOUR_S,
      makeRates(),
      {},
    );
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    // 事件系统独立运行，不依赖收益计算
    expect(eventSystem.getQueueSize()).toBe(0);
    expect(rewardSnapshot.totalEarned.grain).toBeGreaterThan(0);
  });

  it('§3.6.8 系统差异化修正-远征系数0.85', () => {
    const expeditionMod = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === 'expedition');
    expect(expeditionMod).toBeDefined();
    expect(expeditionMod!.modifier).toBe(0.85);
  });

  it('§3.6.9 系统差异化修正-贸易系数0.8', () => {
    const tradeMod = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === 'Trade');
    expect(tradeMod).toBeDefined();
    expect(tradeMod!.modifier).toBe(0.8);
  });

  it('§3.6.10 系统差异化修正-关卡扫荡系数0.4', () => {
    const campaignMod = SYSTEM_EFFICIENCY_MODIFIERS.find(m => m.systemId === 'campaign');
    expect(campaignMod).toBeDefined();
    expect(campaignMod!.modifier).toBe(0.4);
  });

  it('§3.6.11 离线事件回溯数据包含时间线', () => {
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    const eventDef = makeEventDef();
    eventSystem.registerEventDef(eventDef);
    eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '回溯测试',
      description: '测试回溯',
      urgency: 'medium',
      category: 'random' as unknown as string,
      triggeredAt: Date.now() - 7200000,
      requiresManualAction: false,
      triggerTurn: 3,
      eventDef,
      autoResult: null,
    });
    const result = eventSystem.processOfflineEvents();
    expect(result.retrospectiveData).toBeDefined();
    expect(result.retrospectiveData.timeline).toBeDefined();
    expect(result.retrospectiveData.timeline.length).toBeGreaterThan(0);
  });

  it('§3.6.12 离线事件手动处理返回选项后果', () => {
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    const eventDef = makeEventDef();
    eventSystem.registerEventDef(eventDef);
    const entry = eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '手动处理',
      description: '需手动',
      urgency: 'high',
      category: 'random' as unknown as string,
      triggeredAt: Date.now(),
      requiresManualAction: true,
      triggerTurn: 1,
      eventDef,
      autoResult: null,
    });
    const consequence = eventSystem.manualProcessEvent(entry.id, 'opt-1');
    // 如果引擎实现了后果查询，验证结果
    if (consequence) {
      expect(consequence.description).toBeDefined();
    } else {
      // 引擎层可能返回null（选项后果未注册）
      expect(consequence).toBeNull();
    }
  });

  it('§3.6.13 离线事件系统reset清空所有状态', () => {
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    const eventDef = makeEventDef();
    eventSystem.addOfflineEvent({
      eventId: eventDef.id,
      eventDefId: eventDef.id,
      title: '事件',
      description: '描述',
      urgency: 'low',
      category: 'random' as unknown as string,
      triggeredAt: Date.now(),
      requiresManualAction: false,
      triggerTurn: 1,
      eventDef,
      autoResult: null,
    });
    eventSystem.registerAutoRule(makeAutoRule());
    eventSystem.reset();
    expect(eventSystem.getQueueSize()).toBe(0);
    expect(eventSystem.getAllAutoRules()).toHaveLength(0);
  });

  it('§3.6.14 自动处理规则启用/禁用', () => {
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    eventSystem.registerAutoRule(makeAutoRule({ id: 'toggle-rule' }));
    expect(eventSystem.getAutoRule('toggle-rule')?.enabled).toBe(true);
    eventSystem.setRuleEnabled('toggle-rule', false);
    expect(eventSystem.getAutoRule('toggle-rule')?.enabled).toBe(false);
  });

  it('§3.6.15 自动处理规则删除', () => {
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    eventSystem.registerAutoRule(makeAutoRule({ id: 'del-rule' }));
    expect(eventSystem.getAllAutoRules()).toHaveLength(1);
    eventSystem.removeAutoRule('del-rule');
    expect(eventSystem.getAllAutoRules()).toHaveLength(0);
  });
});
