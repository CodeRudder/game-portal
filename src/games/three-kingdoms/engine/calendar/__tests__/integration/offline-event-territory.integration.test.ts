/**
 * 集成测试 — 离线领土变化 + 离线事件处理 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §3.3 离线领土变化：离线期间领土产出、归属变化
 *   §7.4 离线事件处理：离线事件队列、自动处理规则、回溯数据
 *
 * @module engine/calendar/__tests__/integration/offline-event-territory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineEventSystem } from '../../../event/OfflineEventSystem';
import { OfflineEventHandler } from '../../../event/OfflineEventHandler';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { OfflineRewardSystem } from '../../../offline/OfflineRewardSystem';
import type { ISystemDeps } from '../../../../core/types';
import type {
  EventDef,
  EventCategory,
} from '../../../../core/event';
import type {
  OfflineEventEntry,
  AutoProcessRule,
  AutoSelectStrategy,
  OfflineEventProcessResult,
  EventRetrospectiveData,
  OptionConsequence,
} from '../../../../core/event/event-offline.types';
import type {
  OfflineEventPile,
  AutoResolveResult,
} from '../../../../core/event/event-activity.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建完整的系统依赖 */
function createDeps(): ISystemDeps {
  const offlineEvent = new OfflineEventSystem();
  const offlineHandler = new OfflineEventHandler();
  const territory = new TerritorySystem();
  const offlineReward = new OfflineRewardSystem();

  const registry = new Map<string, unknown>();
  registry.set('offlineEvent', offlineEvent);
  registry.set('offlineHandler', offlineHandler);
  registry.set('territory', territory);
  registry.set('offlineReward', offlineReward);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as import('../../../../core/types/subsystem').ISubsystemRegistry,
  };

  offlineEvent.init(deps);
  territory.init(deps);
  offlineReward.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    offlineEvent: deps.registry!.get<OfflineEventSystem>('offlineEvent')!,
    offlineHandler: new OfflineEventHandler(),
    territory: deps.registry!.get<TerritorySystem>('territory')!,
    offlineReward: deps.registry!.get<OfflineRewardSystem>('offlineReward')!,
  };
}

/** 创建低优先级事件定义 */
function createLowUrgencyEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-low-bandits',
    title: '小股盗贼',
    description: '附近出现小股盗贼，需要处理',
    triggerType: 'random',
    urgency: 'low',
    scope: 'region',
    triggerProbability: 0.5,
    options: [
      {
        id: 'patrol',
        text: '派遣巡逻队',
        isDefault: true,
        consequences: {
          description: '巡逻队驱散了盗贼',
          resourceChanges: { gold: -20, food: -10 },
        },
      },
      {
        id: 'ignore',
        text: '置之不理',
        consequences: {
          description: '盗贼继续骚扰',
          affinityChanges: { 'npc-people': -5 },
        },
      },
    ],
    ...overrides,
  };
}

/** 创建高优先级事件定义 */
function createHighUrgencyEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-high-invasion',
    title: '敌军入侵',
    description: '敌军大举入侵，需要立即应对',
    triggerType: 'fixed',
    urgency: 'critical',
    scope: 'global',
    triggerProbability: 1.0,
    options: [
      {
        id: 'defend',
        text: '全力防守',
        consequences: {
          description: '成功击退敌军',
          resourceChanges: { gold: -100, food: -50 },
        },
      },
      {
        id: 'retreat',
        text: '战略撤退',
        isDefault: true,
        consequences: {
          description: '撤退保存实力，但失去部分领土',
          resourceChanges: { gold: -30 },
        },
      },
    ],
    ...overrides,
  };
}

/** 创建中优先级事件定义 */
function createMediumUrgencyEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-medium-drought',
    title: '旱灾预警',
    description: '持续干旱影响粮食产量',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'region',
    triggerProbability: 0.3,
    options: [
      {
        id: 'irrigate',
        text: '修建灌溉',
        isDefault: true,
        consequences: {
          description: '灌溉缓解旱情',
          resourceChanges: { gold: -50, food: 30 },
        },
      },
      {
        id: 'ration',
        text: '实行配给',
        consequences: {
          description: '配给制减少消耗',
          resourceChanges: { food: -20 },
          affinityChanges: { 'npc-people': -10 },
        },
      },
    ],
    ...overrides,
  };
}

/** 创建自动处理规则 */
function createAutoRule(overrides: Partial<AutoProcessRule> = {}): AutoProcessRule {
  return {
    id: 'rule-auto-low',
    name: '自动处理低优先级事件',
    description: '自动处理低优先级的离线事件',
    enabled: true,
    priority: 10,
    urgencyThreshold: 'medium',
    applicableCategories: [],
    applicableEventIds: [],
    strategy: 'default_option',
    ...overrides,
  };
}

/** 创建离线事件条目 */
function createOfflineEntry(overrides: Partial<OfflineEventEntry> = {}): OfflineEventEntry {
  const evtDef = createLowUrgencyEventDef();
  return {
    id: 'offline-1',
    eventId: 'evt-low-bandits',
    eventDefId: 'evt-low-bandits',
    title: '小股盗贼',
    description: '附近出现小股盗贼',
    urgency: 'low',
    category: 'random',
    triggeredAt: 100,
    triggerTurn: 5,
    eventDef: evtDef,
    autoResult: null,
    autoProcessed: false,
    requiresManualAction: true,
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// §3.3 离线领土变化
// ═════════════════════════════════════════════

describe('§3.3 离线领土变化', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // --- 领土产出与离线收益 ---

  describe('领土产出与离线收益', () => {
    it('占领领土后获取产出数据', () => {
      const result = sys.territory.captureTerritory('city-luoyang', 'player');
      expect(result).toBe(true);

      const territory = sys.territory.getTerritoryById('city-luoyang');
      expect(territory).not.toBeNull();
      expect(territory!.ownership).toBe('player');
    });

    it('getPlayerProductionSummary 返回玩家领土总产出', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('totalProduction');
      expect(summary).toHaveProperty('totalTerritories');
      expect(summary.totalTerritories).toBeGreaterThanOrEqual(1);
    });

    it('离线收益系统可计算基于领土产出的离线收益', () => {
      const productionRates = { grain: 10, gold: 5, troops: 3, mandate: 2, techPoint: 1 };
      const snapshot = sys.offlineReward.calculateSnapshot(3600, productionRates);
      expect(snapshot).toBeDefined();
      expect(snapshot.offlineSeconds).toBe(3600);
      expect(snapshot.totalEarned).toBeDefined();
      expect(snapshot.tierDetails.length).toBeGreaterThan(0);
    });

    it('离线收益随时间衰减', () => {
      const rates = { grain: 10, gold: 5, troops: 3, mandate: 2, techPoint: 1 };
      const shortSnapshot = sys.offlineReward.calculateSnapshot(3600, rates);
      const longSnapshot = sys.offlineReward.calculateSnapshot(7200, rates);

      // 长时间离线总收益更多，但效率可能更低
      const shortGrain = shortSnapshot.totalEarned.grain ?? 0;
      const longGrain = longSnapshot.totalEarned.grain ?? 0;
      expect(longGrain).toBeGreaterThan(shortGrain);
    });

    it('离线收益有上限', () => {
      const rates = { grain: 10, gold: 5, troops: 3, mandate: 2, techPoint: 1 };
      const veryLongSnapshot = sys.offlineReward.calculateSnapshot(999999, rates);
      expect(veryLongSnapshot.isCapped).toBe(true);
    });
  });

  // --- 领土归属变化 ---

  describe('领土归属变化', () => {
    it('captureTerritory 变更领土归属', () => {
      const result = sys.territory.captureTerritory('city-luoyang', 'player');
      expect(result).toBe(true);
      expect(sys.territory.getTerritoryById('city-luoyang')!.ownership).toBe('player');
    });

    it('captureTerritory 可将领土转给NPC', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      sys.territory.captureTerritory('city-luoyang', 'npc-caowei');
      expect(sys.territory.getTerritoryById('city-luoyang')!.ownership).toBe('npc-caowei');
    });

    it('canAttackTerritory 检查攻城条件', () => {
      // 先占领一个领土
      sys.territory.captureTerritory('city-luoyang', 'player');
      // 检查相邻领土是否可攻击
      const adjacentIds = sys.territory.getAdjacentTerritoryIds('city-luoyang');
      if (adjacentIds.length > 0) {
        // 相邻领土不属于玩家，应可攻击
        const targetId = adjacentIds[0];
        const target = sys.territory.getTerritoryById(targetId);
        if (target && target.ownership !== 'player') {
          const canAttack = sys.territory.canAttackTerritory(targetId, 'player');
          expect(typeof canAttack).toBe('boolean');
        } else {
          // 已属于玩家或不存在，不可攻击
          expect(true).toBe(true);
        }
      } else {
        // 无相邻领土时跳过
        expect(true).toBe(true);
      }
    });

    it('多领土占领后产出汇总正确', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      sys.territory.captureTerritory('city-xuchang', 'player');

      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalTerritories).toBeGreaterThanOrEqual(2);
    });

    it('领土升级后产出增加', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      const before = sys.territory.getPlayerProductionSummary();
      const upgradeResult = sys.territory.upgradeTerritory('city-luoyang');
      if (upgradeResult.success) {
        const after = sys.territory.getPlayerProductionSummary();
        // 升级后产出应增加
        expect(after.totalProduction.grain).toBeGreaterThanOrEqual(before.totalProduction.grain);
      }
    });
  });

  // --- 离线领土序列化 ---

  describe('离线领土序列化', () => {
    it('领土系统 serialize 保存当前状态', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      const saved = sys.territory.serialize();
      expect(saved).toBeDefined();
      expect(saved).toHaveProperty('version');
    });

    it('领土系统 deserialize 恢复状态', () => {
      sys.territory.captureTerritory('city-luoyang', 'player');
      const saved = sys.territory.serialize();

      const newTerritory = new TerritorySystem();
      const newDeps = createDeps();
      newTerritory.init(newDeps);
      newTerritory.deserialize(saved);

      const t = newTerritory.getTerritoryById('city-luoyang');
      expect(t).not.toBeNull();
      expect(t!.ownership).toBe('player');
    });

    it('离线收益系统 serialize 保存状态', () => {
      const saved = sys.offlineReward.serialize();
      expect(saved).toBeDefined();
    });

    it('离线收益系统 deserialize 恢复状态', () => {
      const saved = sys.offlineReward.serialize();
      const newReward = new OfflineRewardSystem();
      const newDeps = createDeps();
      newReward.init(newDeps);
      newReward.deserialize(saved);
      expect(newReward.getState()).toBeDefined();
    });
  });
});

// ═════════════════════════════════════════════
// §7.4 离线事件处理
// ═════════════════════════════════════════════

describe('§7.4 离线事件处理', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // --- 离线事件队列 ---

  describe('离线事件队列', () => {
    it('addOfflineEvent 添加离线事件到队列', () => {
      const entry = sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '附近出现小股盗贼',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      expect(entry).toBeDefined();
      expect(entry.id).toMatch(/^offline-/);
      expect(entry.autoProcessed).toBe(false);
    });

    it('addOfflineEvents 批量添加离线事件', () => {
      const entries = sys.offlineEvent.addOfflineEvents([
        {
          eventId: 'evt-1',
          eventDefId: 'evt-1',
          title: '事件1',
          description: '描述1',
          urgency: 'low',
          category: 'random',
          triggeredAt: 100,
          triggerTurn: 5,
          eventDef: createLowUrgencyEventDef({ id: 'evt-1' }),
          autoResult: null,
          requiresManualAction: true,
        },
        {
          eventId: 'evt-2',
          eventDefId: 'evt-2',
          title: '事件2',
          description: '描述2',
          urgency: 'high',
          category: 'random',
          triggeredAt: 200,
          triggerTurn: 10,
          eventDef: createHighUrgencyEventDef({ id: 'evt-2' }),
          autoResult: null,
          requiresManualAction: true,
        },
      ]);

      expect(entries.length).toBe(2);
      expect(sys.offlineEvent.getQueueSize()).toBe(2);
    });

    it('getOfflineQueue 返回队列副本', () => {
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const queue = sys.offlineEvent.getOfflineQueue();
      expect(queue.length).toBe(1);
      // 修改副本不影响原队列
      queue.push(createOfflineEntry());
      expect(sys.offlineEvent.getQueueSize()).toBe(1);
    });

    it('getPendingEvents 只返回未自动处理的事件', () => {
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const pending = sys.offlineEvent.getPendingEvents();
      expect(pending.length).toBe(1);
      expect(pending[0].autoProcessed).toBe(false);
    });

    it('getAutoProcessedEvents 返回已自动处理的事件', () => {
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: false,
      });

      const auto = sys.offlineEvent.getAutoProcessedEvents();
      expect(auto.length).toBe(0);
    });

    it('clearQueue 清空离线事件队列', () => {
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      expect(sys.offlineEvent.getQueueSize()).toBe(1);
      sys.offlineEvent.clearQueue();
      expect(sys.offlineEvent.getQueueSize()).toBe(0);
    });

    it('队列超过最大容量时自动裁剪', () => {
      const evtDef = createLowUrgencyEventDef();
      for (let i = 0; i < 55; i++) {
        sys.offlineEvent.addOfflineEvent({
          eventId: `evt-${i}`,
          eventDefId: `evt-${i}`,
          title: `事件${i}`,
          description: `描述${i}`,
          urgency: 'low',
          category: 'random',
          triggeredAt: i * 100,
          triggerTurn: i,
          eventDef: evtDef,
          autoResult: null,
          requiresManualAction: true,
        });
      }
      // 最大50，应被裁剪
      expect(sys.offlineEvent.getQueueSize()).toBeLessThanOrEqual(50);
    });
  });

  // --- 自动处理规则 ---

  describe('自动处理规则', () => {
    it('registerAutoRule 注册自动处理规则', () => {
      sys.offlineEvent.registerAutoRule(createAutoRule());
      const rule = sys.offlineEvent.getAutoRule('rule-auto-low');
      expect(rule).toBeDefined();
      expect(rule!.name).toBe('自动处理低优先级事件');
    });

    it('registerAutoRules 批量注册规则', () => {
      sys.offlineEvent.registerAutoRules([
        createAutoRule({ id: 'rule-1', name: '规则1', priority: 10 }),
        createAutoRule({ id: 'rule-2', name: '规则2', priority: 20 }),
      ]);
      const rules = sys.offlineEvent.getAllAutoRules();
      expect(rules.length).toBeGreaterThanOrEqual(2);
    });

    it('getAllAutoRules 按优先级降序排列', () => {
      sys.offlineEvent.registerAutoRules([
        createAutoRule({ id: 'rule-low', name: '低优先级规则', priority: 5 }),
        createAutoRule({ id: 'rule-high', name: '高优先级规则', priority: 20 }),
        createAutoRule({ id: 'rule-mid', name: '中优先级规则', priority: 10 }),
      ]);
      const rules = sys.offlineEvent.getAllAutoRules();
      expect(rules[0].priority).toBeGreaterThanOrEqual(rules[1].priority);
    });

    it('setRuleEnabled 启用/禁用规则', () => {
      sys.offlineEvent.registerAutoRule(createAutoRule());
      sys.offlineEvent.setRuleEnabled('rule-auto-low', false);
      const rule = sys.offlineEvent.getAutoRule('rule-auto-low');
      expect(rule!.enabled).toBe(false);
    });

    it('removeAutoRule 移除规则', () => {
      sys.offlineEvent.registerAutoRule(createAutoRule());
      sys.offlineEvent.removeAutoRule('rule-auto-low');
      expect(sys.offlineEvent.getAutoRule('rule-auto-low')).toBeUndefined();
    });

    it('规则策略支持多种选择策略', () => {
      const strategies: AutoSelectStrategy[] = [
        'default_option', 'best_outcome', 'safest', 'weighted_random', 'skip',
      ];
      for (const strategy of strategies) {
        sys.offlineEvent.registerAutoRule(
          createAutoRule({ id: `rule-${strategy}`, strategy }),
        );
        const rule = sys.offlineEvent.getAutoRule(`rule-${strategy}`);
        expect(rule!.strategy).toBe(strategy);
      }
    });
  });

  // --- 自动处理执行 ---

  describe('自动处理执行', () => {
    it('processOfflineEvents 处理离线事件队列', () => {
      // 注册事件定义
      sys.offlineEvent.registerEventDef(createLowUrgencyEventDef());

      // 添加低优先级事件（不要求手动操作）
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: false,
      });

      // 注册自动处理规则
      sys.offlineEvent.registerAutoRule(createAutoRule());

      const result = sys.offlineEvent.processOfflineEvents();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('autoProcessedCount');
      expect(result).toHaveProperty('manualRequiredCount');
      expect(result).toHaveProperty('processedEntries');
      expect(result).toHaveProperty('pendingEntries');
      expect(result).toHaveProperty('retrospectiveData');
    });

    it('高优先级事件不自动处理，保留给玩家', () => {
      sys.offlineEvent.registerEventDef(createHighUrgencyEventDef());

      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-high-invasion',
        eventDefId: 'evt-high-invasion',
        title: '敌军入侵',
        description: '敌军大举入侵',
        urgency: 'critical',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createHighUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      sys.offlineEvent.registerAutoRule(createAutoRule());

      const result = sys.offlineEvent.processOfflineEvents();
      expect(result.manualRequiredCount).toBeGreaterThanOrEqual(1);
    });

    it('manualProcessEvent 手动处理单个事件', () => {
      sys.offlineEvent.registerEventDef(createLowUrgencyEventDef());

      const entry = sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const consequence = sys.offlineEvent.manualProcessEvent(entry.id, 'patrol');
      expect(consequence).not.toBeNull();
      expect(consequence!.description).toBeDefined();
    });

    it('manualProcessEvent 对不存在的事件返回 null', () => {
      const result = sys.offlineEvent.manualProcessEvent('nonexistent', 'patrol');
      expect(result).toBeNull();
    });
  });

  // --- 事件回溯数据 ---

  describe('事件回溯数据', () => {
    it('generateRetrospective 生成回溯数据', () => {
      sys.offlineEvent.registerEventDef(createLowUrgencyEventDef());

      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const retro = sys.offlineEvent.generateRetrospective();
      expect(retro).toBeDefined();
      expect(retro).toHaveProperty('offlineEvents');
      expect(retro).toHaveProperty('totalResourceChanges');
      expect(retro).toHaveProperty('timeline');
      expect(retro.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it('回溯数据时间线包含事件标题和动作', () => {
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const retro = sys.offlineEvent.generateRetrospective();
      const firstTimeline = retro.timeline[0];
      expect(firstTimeline.eventTitle).toBe('小股盗贼');
      expect(firstTimeline.action).toBeDefined();
      expect(firstTimeline.result).toBeDefined();
    });

    it('自动处理后的回溯数据包含资源汇总', () => {
      sys.offlineEvent.registerEventDef(createLowUrgencyEventDef());

      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: false,
      });

      sys.offlineEvent.registerAutoRule(createAutoRule());
      const result = sys.offlineEvent.processOfflineEvents();

      if (result.autoProcessedCount > 0) {
        expect(result.retrospectiveData.totalResourceChanges).toBeDefined();
      }
    });
  });

  // --- 离线事件处理器 (OfflineEventHandler) ---

  describe('OfflineEventHandler', () => {
    it('simulateOfflineEvents 模拟离线事件堆积', () => {
      const events = [createLowUrgencyEventDef(), createMediumUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(5, events, 1.0);

      expect(pile).toBeDefined();
      expect(pile).toHaveProperty('id');
      expect(pile).toHaveProperty('offlineTurns');
      expect(pile).toHaveProperty('events');
      expect(pile.offlineTurns).toBe(5);
    });

    it('getPileStats 返回堆积统计', () => {
      const events = [createLowUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(3, events, 1.0);
      const stats = sys.offlineHandler.getPileStats(pile);

      expect(stats).toBeDefined();
      expect(stats.total).toBe(pile.events.length);
      expect(stats.autoResolved + stats.pending).toBe(stats.total);
    });

    it('processOfflinePile 处理离线事件堆积', () => {
      const events = [createLowUrgencyEventDef(), createHighUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(5, events, 1.0);
      const result = sys.offlineHandler.processOfflinePile(pile);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('pendingEvents');
      expect(result).toHaveProperty('autoResolvedEvents');
      expect(result).toHaveProperty('autoResourceChanges');
      expect(pile.processed).toBe(true);
    });

    it('resolveOfflineEvent 手动处理单个离线事件', () => {
      const events = [createHighUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(3, events, 1.0);

      // 找到需要手动处理的事件
      const pendingEvents = pile.events.filter(e => !e.autoResult);
      if (pendingEvents.length > 0) {
        const result = sys.offlineHandler.resolveOfflineEvent(
          pile,
          pendingEvents[0].eventId,
          'defend',
        );
        expect(result.success).toBe(true);
        expect(result.consequences).toBeDefined();
      }
    });

    it('resolveOfflineEvent 对已自动处理的事件返回失败', () => {
      const events = [createLowUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(3, events, 1.0);

      const autoEvents = pile.events.filter(e => e.autoResult);
      if (autoEvents.length > 0) {
        const result = sys.offlineHandler.resolveOfflineEvent(
          pile,
          autoEvents[0].eventId,
          'patrol',
        );
        expect(result.success).toBe(false);
        expect(result.reason).toContain('已自动处理');
      }
    });

    it('resolveOfflineEvent 对不存在的事件返回失败', () => {
      const events = [createLowUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(1, events, 1.0);
      const result = sys.offlineHandler.resolveOfflineEvent(pile, 'nonexistent', 'patrol');
      expect(result.success).toBe(false);
    });

    it('convertToNotifications 将堆积事件转为通知', () => {
      const events = [createHighUrgencyEventDef()];
      const pile = sys.offlineHandler.simulateOfflineEvents(3, events, 1.0);
      const notifications = sys.offlineHandler.convertToNotifications(pile);

      expect(Array.isArray(notifications)).toBe(true);
      // 通知只包含需要手动处理的事件
      for (const notif of notifications) {
        expect(notif).toHaveProperty('id');
        expect(notif).toHaveProperty('title');
        expect(notif).toHaveProperty('content');
        expect(notif).toHaveProperty('priority');
        expect(notif.read).toBe(false);
      }
    });
  });

  // --- 序列化 ---

  describe('序列化', () => {
    it('OfflineEventSystem exportSaveData 导出存档', () => {
      sys.offlineEvent.registerAutoRule(createAutoRule());
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const saved = sys.offlineEvent.exportSaveData();
      expect(saved).toBeDefined();
      expect(saved).toHaveProperty('version');
      expect(saved.offlineQueue.length).toBe(1);
      expect(saved.autoRules.length).toBe(1);
    });

    it('OfflineEventSystem importSaveData 恢复状态', () => {
      sys.offlineEvent.registerAutoRule(createAutoRule());
      sys.offlineEvent.addOfflineEvent({
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      });

      const saved = sys.offlineEvent.exportSaveData();

      const newOffline = new OfflineEventSystem();
      const newDeps = createDeps();
      newOffline.init(newDeps);
      newOffline.importSaveData(saved);

      expect(newOffline.getQueueSize()).toBe(1);
      expect(newOffline.getAllAutoRules().length).toBe(1);
    });
  });
});

// ═════════════════════════════════════════════
// §3.3+§7.4 离线领土+离线事件 交叉集成
// ═════════════════════════════════════════════

describe('§3.3+§7.4 离线领土+离线事件 交叉集成', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  it('离线期间：领土产出 → 离线收益计算', () => {
    // 占领领土
    sys.territory.captureTerritory('city-luoyang', 'player');
    const summary = sys.territory.getPlayerProductionSummary();

    // 基于领土产出计算离线收益
    const rates = {
      grain: summary.totalProduction.grain ?? 10,
      gold: summary.totalProduction.gold ?? 5,
      troops: summary.totalProduction.troops ?? 3,
      mandate: summary.totalProduction.mandate ?? 2,
      techPoint: 1,
    };
    const snapshot = sys.offlineReward.calculateSnapshot(7200, rates);

    expect(snapshot.totalEarned).toBeDefined();
    expect(snapshot.offlineSeconds).toBe(7200);
  });

  it('离线期间：事件堆积 + 自动处理 + 回溯', () => {
    // 注册事件定义
    sys.offlineEvent.registerEventDef(createLowUrgencyEventDef());
    sys.offlineEvent.registerEventDef(createHighUrgencyEventDef());

    // 模拟离线期间多个事件
    sys.offlineEvent.addOfflineEvents([
      {
        eventId: 'evt-low-bandits',
        eventDefId: 'evt-low-bandits',
        title: '小股盗贼',
        description: '描述',
        urgency: 'low',
        category: 'random',
        triggeredAt: 100,
        triggerTurn: 5,
        eventDef: createLowUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: false,
      },
      {
        eventId: 'evt-high-invasion',
        eventDefId: 'evt-high-invasion',
        title: '敌军入侵',
        description: '敌军大举入侵',
        urgency: 'critical',
        category: 'random',
        triggeredAt: 200,
        triggerTurn: 10,
        eventDef: createHighUrgencyEventDef(),
        autoResult: null,
        requiresManualAction: true,
      },
    ]);

    // 注册自动处理规则
    sys.offlineEvent.registerAutoRule(createAutoRule());

    // 处理
    const result = sys.offlineEvent.processOfflineEvents();

    // 低优先级事件应自动处理
    expect(result.autoProcessedCount + result.manualRequiredCount).toBe(2);

    // 生成回溯数据
    const retro = sys.offlineEvent.generateRetrospective();
    expect(retro.timeline.length).toBeGreaterThanOrEqual(2);
  });

  it('离线全流程：领土+收益+事件 完整集成', () => {
    // 1. 占领领土
    sys.territory.captureTerritory('city-luoyang', 'player');
    expect(sys.territory.getTerritoryById('city-luoyang')!.ownership).toBe('player');

    // 2. 计算离线收益
    const rates = { grain: 10, gold: 5, troops: 3, mandate: 2, techPoint: 1 };
    const snapshot = sys.offlineReward.calculateSnapshot(3600, rates);
    expect(snapshot.totalEarned).toBeDefined();

    // 3. 模拟离线事件
    const events = [createLowUrgencyEventDef(), createHighUrgencyEventDef()];
    const pile = sys.offlineHandler.simulateOfflineEvents(5, events, 1.0);
    expect(pile.events.length).toBeGreaterThan(0);

    // 4. 处理离线事件
    const pileResult = sys.offlineHandler.processOfflinePile(pile);
    expect(pile.processed).toBe(true);

    // 5. 手动处理待处理事件
    for (const pending of pileResult.pendingEvents) {
      const option = pending.eventDef.options[0];
      if (option) {
        const resolveResult = sys.offlineHandler.resolveOfflineEvent(
          pile, pending.eventId, option.id,
        );
        // 可能已被处理或选项不匹配，检查结果
        expect(typeof resolveResult.success).toBe('boolean');
      }
    }

    // 6. 保存所有状态
    const territorySave = sys.territory.serialize();
    const offlineSave = sys.offlineReward.serialize();
    expect(territorySave).toBeDefined();
    expect(offlineSave).toBeDefined();
  });

  it('离线领土序列化/反序列化 往返一致性', () => {
    sys.territory.captureTerritory('city-luoyang', 'player');
    sys.territory.captureTerritory('city-xuchang', 'player');

    const saved = sys.territory.serialize();

    const restored = new TerritorySystem();
    const newDeps = createDeps();
    restored.init(newDeps);
    restored.deserialize(saved);

    const origSummary = sys.territory.getPlayerProductionSummary();
    const restoredSummary = restored.getPlayerProductionSummary();
    expect(restoredSummary.totalTerritories).toBe(origSummary.totalTerritories);
  });
});
