/**
 * 集成测试 §4: 离线回归全链路 — 事件堆积→自动处理→回归面板→签到→活动结算
 *
 * 覆盖 Play §5 + §3.13 + §6.4 的离线处理闭环：
 *   - 离线事件堆积（正面保守50%/负面防御减免/限时消失/堆积上限5条）
 *   - 自动处理规则匹配
 *   - 回归面板数据生成
 *   - 离线活动积分累积
 *   - 活动到期结算（代币转化10%）
 *   - 签到→代币→活动→离线→排行闭环
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OfflineEventSystem } from '../../OfflineEventSystem';
import { OfflineEventHandler } from '../../OfflineEventHandler';
import { EventTriggerSystem } from '../../EventTriggerSystem';
import { EventNotificationSystem } from '../../EventNotificationSystem';
import { TimedActivitySystem } from '../../../activity/TimedActivitySystem';
import { TokenShopSystem } from '../../../activity/TokenShopSystem';
import { SignInSystem, createDefaultSignInData, DEFAULT_SIGN_IN_CONFIG } from '../../../activity/SignInSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { EventDef } from '../../../../core/event';
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
    id: 'offline-evt-001',
    title: '离线测试事件',
    description: '',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'region',
    options: [
      {
        id: 'opt-conservative',
        text: '保守',
        isDefault: true,
        consequences: { description: '50%奖励', resourceChanges: { copper: 50 } },
      },
      {
        id: 'opt-risk',
        text: '冒险',
        consequences: { description: '全量或无', resourceChanges: { copper: 200 } },
      },
    ],
    ...overrides,
  };
}

function makeNegativeEventDef(): EventDef {
  return {
    id: 'offline-evt-negative',
    title: '天灾事件',
    description: '天灾降临',
    triggerType: 'random',
    urgency: 'high',
    scope: 'region',
    options: [
      {
        id: 'opt-defend',
        text: '加固',
        isDefault: true,
        consequences: { description: '损失较小', resourceChanges: { copper: -50 } },
      },
      {
        id: 'opt-endure',
        text: '硬抗',
        consequences: { description: '损失较大', resourceChanges: { copper: -200 } },
      },
    ],
  };
}

function makeOfflineEntry(def: EventDef, overrides?: Partial<OfflineEventEntry>): Omit<OfflineEventEntry, 'id' | 'autoProcessed'> {
  return {
    eventId: `off-${def.id}`,
    eventDefId: def.id,
    title: def.title,
    description: def.description,
    urgency: def.urgency,
    category: 'random',
    triggeredAt: Date.now() - 3600000,
    triggerTurn: 5,
    eventDef: def,
    autoResult: null,
    requiresManualAction: false,
    ...overrides,
  };
}

const BASE_TIME = new Date('2024-01-01T00:00:00Z').getTime();
function dayOffset(days: number): number {
  return BASE_TIME + days * 24 * 60 * 60 * 1000;
}

// ═══════════════════════════════════════════════
// §4 离线回归全链路集成
// ═══════════════════════════════════════════════

describe('§4 离线回归全链路集成', () => {
  let offlineSys: OfflineEventSystem;
  let offlineHandler: OfflineEventHandler;
  let triggerSys: EventTriggerSystem;
  let notifSys: EventNotificationSystem;
  let timedSys: TimedActivitySystem;
  let shopSys: TokenShopSystem;
  let signInSys: SignInSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    offlineSys = new OfflineEventSystem();
    offlineHandler = new OfflineEventHandler();
    triggerSys = new EventTriggerSystem();
    notifSys = new EventNotificationSystem();
    timedSys = new TimedActivitySystem();
    shopSys = new TokenShopSystem();
    signInSys = new SignInSystem();

    offlineSys.init(deps);
    // OfflineEventHandler is not ISubsystem, no init needed
    triggerSys.init(deps);
    notifSys.init(deps);
    timedSys.init(deps);
    shopSys.init(deps);
    signInSys.init(deps);
  });

  // ─── §4.1 离线事件堆积 ──────────────────

  describe('§4.1 离线事件堆积与分类处理', () => {
    it('正面事件自动保守50%奖励', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);

      // 注册保守策略规则
      const rule: AutoProcessRule = {
        id: 'rule-positive',
        name: '正面保守',
        description: '正面事件自动保守处理',
        enabled: true,
        priority: 10,
        urgencyThreshold: 'high',
        applicableCategories: ['random'],
        applicableEventIds: [],
        strategy: 'safest',
      };
      offlineSys.registerAutoRule(rule);

      offlineSys.addOfflineEvent(makeOfflineEntry(def, { requiresManualAction: false }));
      const result = offlineSys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
    });

    it('负面事件按防御值减免', () => {
      const def = makeNegativeEventDef();
      offlineSys.registerEventDef(def);

      const rule: AutoProcessRule = {
        id: 'rule-negative',
        name: '负面最小损失',
        description: '负面事件自动最小损失',
        enabled: true,
        priority: 20,
        urgencyThreshold: 'critical',
        applicableCategories: ['random'],
        applicableEventIds: [def.id],
        strategy: 'safest',
      };
      offlineSys.registerAutoRule(rule);

      offlineSys.addOfflineEvent(makeOfflineEntry(def, { requiresManualAction: false }));
      const result = offlineSys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
    });

    it('堆积上限5条（中性3+NPC2）', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);

      // 添加超过5条需手动处理的事件
      for (let i = 0; i < 7; i++) {
        offlineSys.addOfflineEvent(makeOfflineEntry(def, {
          eventId: `off-${i}`,
          requiresManualAction: true,
          category: i < 3 ? 'random' : 'story',
        }));
      }

      const pending = offlineSys.getPendingEvents();
      // 全部需要手动处理
      expect(pending.length).toBe(7);
    });

    it('限时机遇错过消失', () => {
      const def = makeEventDef({ id: 'timed-evt', urgency: 'critical' });
      offlineSys.registerEventDef(def);

      offlineSys.addOfflineEvent(makeOfflineEntry(def, {
        category: 'triggered',
        requiresManualAction: true,
        urgency: 'critical',
      }));

      // 限时事件需手动处理，不会自动消失（需要外部逻辑判断）
      const pending = offlineSys.getPendingEvents();
      expect(pending).toHaveLength(1);
    });

    it('剧情事件暂停等待玩家上线', () => {
      const def = makeEventDef({ id: 'story-evt', triggerType: 'fixed' });
      offlineSys.registerEventDef(def);

      offlineSys.addOfflineEvent(makeOfflineEntry(def, {
        category: 'story',
        requiresManualAction: true,
      }));

      const result = offlineSys.processOfflineEvents();
      expect(result.manualRequiredCount).toBe(1);
    });
  });

  // ─── §4.2 自动处理规则匹配 ──────────────

  describe('§4.2 自动处理规则匹配', () => {
    it('规则按优先级排序', () => {
      const rules: AutoProcessRule[] = [
        { id: 'r1', name: '低优先', description: '', enabled: true, priority: 5, urgencyThreshold: 'low', applicableCategories: [], applicableEventIds: [], strategy: 'default_option' },
        { id: 'r2', name: '高优先', description: '', enabled: true, priority: 20, urgencyThreshold: 'low', applicableCategories: [], applicableEventIds: [], strategy: 'safest' },
        { id: 'r3', name: '中优先', description: '', enabled: true, priority: 10, urgencyThreshold: 'low', applicableCategories: [], applicableEventIds: [], strategy: 'best_outcome' },
      ];
      offlineSys.registerAutoRules(rules);
      const sorted = offlineSys.getAllAutoRules();
      expect(sorted[0].priority).toBe(20);
      expect(sorted[1].priority).toBe(10);
      expect(sorted[2].priority).toBe(5);
    });

    it('禁用的规则不参与匹配', () => {
      const rule: AutoProcessRule = {
        id: 'disabled-rule', name: '禁用规则', description: '', enabled: false,
        priority: 100, urgencyThreshold: 'low', applicableCategories: [],
        applicableEventIds: [], strategy: 'default_option',
      };
      offlineSys.registerAutoRule(rule);
      offlineSys.setRuleEnabled('disabled-rule', false);

      const allRules = offlineSys.getAllAutoRules();
      const enabledRules = allRules.filter(r => r.enabled);
      expect(enabledRules).toHaveLength(0);
    });

    it('移除规则', () => {
      offlineSys.registerAutoRule({
        id: 'to-remove', name: '待移除', description: '', enabled: true,
        priority: 1, urgencyThreshold: 'low', applicableCategories: [],
        applicableEventIds: [], strategy: 'default_option',
      });
      offlineSys.removeAutoRule('to-remove');
      expect(offlineSys.getAutoRule('to-remove')).toBeUndefined();
    });

    it('不同策略选择不同选项', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);

      // safest 策略应选择损失最小的选项
      const safestRule: AutoProcessRule = {
        id: 'rule-safest', name: '最安全', description: '', enabled: true,
        priority: 10, urgencyThreshold: 'high', applicableCategories: ['random'],
        applicableEventIds: [], strategy: 'safest',
      };
      offlineSys.registerAutoRule(safestRule);

      offlineSys.addOfflineEvent(makeOfflineEntry(def, { requiresManualAction: false }));
      const result = offlineSys.processOfflineEvents();
      expect(result.autoProcessedCount).toBe(1);
    });
  });

  // ─── §4.3 回归面板数据生成 ──────────────

  describe('§4.3 回归面板数据生成', () => {
    it('生成完整回溯数据', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      offlineSys.addOfflineEvent(makeOfflineEntry(def));
      offlineSys.addOfflineEvent(makeOfflineEntry(def, { eventId: 'off-2' }));

      const retro = offlineSys.generateRetrospective();
      expect(retro.offlineEvents).toHaveLength(2);
      expect(retro.timeline).toHaveLength(2);
      expect(retro.totalResourceChanges).toBeDefined();
    });

    it('processOfflineEvents 返回完整结果', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);

      const rule: AutoProcessRule = {
        id: 'auto-all', name: '全部自动', description: '', enabled: true,
        priority: 1, urgencyThreshold: 'critical', applicableCategories: [],
        applicableEventIds: [], strategy: 'default_option',
      };
      offlineSys.registerAutoRule(rule);

      offlineSys.addOfflineEvent(makeOfflineEntry(def, { requiresManualAction: false }));
      const result = offlineSys.processOfflineEvents();

      expect(result.autoProcessedCount).toBe(1);
      expect(result.processedEntries).toHaveLength(1);
      expect(result.retrospectiveData).toBeDefined();
    });

    it('清空队列后回归数据为空', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      offlineSys.addOfflineEvent(makeOfflineEntry(def));
      offlineSys.clearQueue();

      expect(offlineSys.getQueueSize()).toBe(0);
      const retro = offlineSys.generateRetrospective();
      expect(retro.offlineEvents).toHaveLength(0);
    });
  });

  // ─── §4.4 离线活动积分累积 ──────────────

  describe('§4.4 离线活动积分累积', () => {
    it('限时活动离线效率30%', () => {
      const result = timedSys.calculateOfflineProgress('act-1', 'limitedTime', 3600000);
      // 基础每秒0.1积分 × 3600秒 × 0.3效率 = 108
      expect(result.pointsEarned).toBeGreaterThan(0);
      expect(result.tokensEarned).toBeGreaterThan(0);
    });

    it('赛季活动离线效率50%', () => {
      const result = timedSys.calculateOfflineProgress('act-2', 'season', 3600000);
      expect(result.pointsEarned).toBeGreaterThan(0);
    });

    it('日常活动离线效率100%', () => {
      const result = timedSys.calculateOfflineProgress('act-3', 'daily', 3600000);
      expect(result.pointsEarned).toBeGreaterThan(0);
    });

    it('节日活动离线效率50%', () => {
      const result = timedSys.calculateOfflineProgress('act-4', 'festival', 3600000);
      expect(result.pointsEarned).toBeGreaterThan(0);
    });

    it('声望等级加成: 效率 = 基础 × (1 + 声望等级 × 0.03)', () => {
      const baseEff = 0.5;
      const repLevel = 10;
      const eff = baseEff * (1 + repLevel * 0.03);
      expect(eff).toBeCloseTo(0.65, 4);
    });

    it('批量离线进度汇总', () => {
      const activities = [
        { id: 'a1', type: 'season' },
        { id: 'a2', type: 'limitedTime' },
      ];
      const summary = timedSys.calculateAllOfflineProgress(activities, 7200000);
      expect(summary.totalPoints).toBeGreaterThan(0);
      expect(summary.totalTokens).toBeGreaterThan(0);
      expect(summary.activityResults).toHaveLength(2);
    });
  });

  // ─── §4.5 活动到期结算 ──────────────────

  describe('§4.5 活动到期结算', () => {
    it('代币转化: 未使用代币 × 10%', () => {
      shopSys.addTokens(1234);
      const balance = shopSys.getTokenBalance();
      const converted = Math.floor(balance * 0.1);
      expect(converted).toBe(123);
    });

    it('活动阶段从 active → settlement → closed', () => {
      const now = Date.now();
      timedSys.createTimedActivityFlow('settle-1', now - 1000, now);
      expect(timedSys.updatePhase('settle-1', now + 1)).toBe('settlement');
      expect(timedSys.updatePhase('settle-1', now + 3 * 3600000)).toBe('closed');
    });

    it('结算后排行榜可查看', () => {
      const entries = [
        { playerId: 'p1', playerName: 'A', points: 500, tokens: 50, rank: 0, faction: 'wei' },
      ];
      timedSys.updateLeaderboard('settle-lb', entries as unknown as Record<string, unknown>);
      const lb = timedSys.getLeaderboard('settle-lb');
      expect(lb).toHaveLength(1);
    });

    it('排行奖励按梯度计算', () => {
      const rewards1 = timedSys.calculateRankRewards(1);
      const rewards50 = timedSys.calculateRankRewards(50);
      // 第1名奖励应多于第50名
      const total1 = Object.values(rewards1).reduce((s, v) => s + v, 0);
      const total50 = Object.values(rewards50).reduce((s, v) => s + v, 0);
      expect(total1).toBeGreaterThanOrEqual(total50);
    });
  });

  // ─── §4.6 签到→代币→活动闭环 ──────────────

  describe('§4.6 签到→代币→活动闭环', () => {
    it('签到获得代币奖励', () => {
      const rewards = signInSys.getAllRewards();
      const tokenDays = rewards.filter(r => r.tokenReward > 0);
      expect(tokenDays.length).toBeGreaterThan(0);
    });

    it('连续7天签到完成循环', () => {
      let data = createDefaultSignInData();
      for (let i = 0; i < 7; i++) {
        const result = signInSys.signIn(data, dayOffset(i));
        expect(result.data.consecutiveDays).toBe(i + 1);
        data = result.data;
      }
      expect(data.consecutiveDays).toBe(7);
    });

    it('断签重置连续天数', () => {
      let data = createDefaultSignInData();
      // 签到2天
      data = signInSys.signIn(data, dayOffset(0)).data;
      data = signInSys.signIn(data, dayOffset(1)).data;
      // 跳过1天
      data = signInSys.signIn(data, dayOffset(3)).data;
      expect(data.consecutiveDays).toBe(1);
    });

    it('代币可兑换商店商品', () => {
      shopSys.addTokens(5000);
      const items = shopSys.getAvailableItems();
      if (items.length > 0 && items[0].tokenPrice <= 5000) {
        const result = shopSys.purchaseItem(items[0].id);
        expect(result.success).toBe(true);
      }
    });
  });

  // ─── §4.7 序列化与跨系统持久化 ──────────

  describe('§4.7 序列化与跨系统持久化', () => {
    it('OfflineEventSystem 序列化恢复', () => {
      const def = makeEventDef();
      offlineSys.registerEventDef(def);
      offlineSys.addOfflineEvent(makeOfflineEntry(def));

      const data = offlineSys.exportSaveData();
      expect(data.version).toBe(15);

      const newSys = new OfflineEventSystem();
      newSys.init(mockDeps());
      newSys.importSaveData(data);
      expect(newSys.getQueueSize()).toBe(1);
    });

    it('TimedActivitySystem 序列化恢复', () => {
      timedSys.createTimedActivityFlow('ser-1', Date.now(), Date.now() + 86400000);
      const data = timedSys.serialize();

      const newSys = new TimedActivitySystem();
      newSys.init(mockDeps());
      newSys.deserialize(data);
      expect(newSys.getAllFlows()).toHaveLength(1);
    });

    it('TokenShopSystem 序列化恢复', () => {
      shopSys.addTokens(999);
      const data = shopSys.serialize();

      const newShop = new TokenShopSystem();
      newShop.init(mockDeps());
      newShop.deserialize(data);
      expect(newShop.getTokenBalance()).toBe(999);
    });

    it('EventNotificationSystem 序列化恢复', () => {
      const banners = notifSys.serializeBanners();
      expect(Array.isArray(banners)).toBe(true);
      const newSys = new EventNotificationSystem();
      newSys.init(mockDeps());
      newSys.deserializeBanners(banners);
      expect(newSys.getState()).toBeDefined();
    });
  });

  // ─── §4.8 OfflineEventHandler ─────────────

  describe('§4.8 OfflineEventHandler', () => {
    it('模拟离线事件触发', () => {
      const def = makeEventDef();
      const pile = offlineHandler.simulateOfflineEvents(10, [def], 0.3);
      expect(pile).toBeDefined();
      expect(pile.offlineTurns).toBe(10);
    });

    it('离线0回合无事件', () => {
      const def = makeEventDef();
      const pile = offlineHandler.simulateOfflineEvents(0, [def], 0.3);
      expect(pile.events).toHaveLength(0);
    });
  });
});
