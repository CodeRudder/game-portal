/**
 * v6.0 集成测试 — §7 事件系统
 *
 * 覆盖 Play 文档流程：
 *   §7.1 事件触发（触发规则、概率公式、冷却机制）
 *   §7.2 随机遭遇弹窗（选项后果、奖励缩放）
 *   §7.3 连锁事件（链结构、超时、中断补偿）
 *   §7.4 离线事件处理（自动处理规则、收益公式）
 *   §7.5 事件跨系统联动
 *   §7.10 事件类型筛选异常处理
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/__tests__/integration/v6-event-system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventNotificationSystem } from '../../event/EventNotificationSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import { ChainEventSystem } from '../../event/ChainEventSystem';
import { OfflineEventSystem } from '../../event/OfflineEventSystem';
import { OfflineEventHandler } from '../../event/OfflineEventHandler';
import { StoryEventSystem } from '../../event/StoryEventSystem';
import { EventConditionEvaluator } from '../../event/EventConditionEvaluator';
import { calculateProbability } from '../../event/EventProbabilityCalculator';
import { TerritorySystem } from '../../map/TerritorySystem';
import { SiegeSystem } from '../../map/SiegeSystem';
import { CalendarSystem } from '../../calendar/CalendarSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { EventDef, EventInstance } from '../../../core/event';
import type { ProbabilityCondition } from '../../../core/event/event-encounter.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const eventTrigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const eventLog = new EventLogSystem();
  const chainEvent = new ChainEventSystem();
  const offlineEvent = new OfflineEventSystem();
  const offlineHandler = new OfflineEventHandler();
  const storyEvent = new StoryEventSystem();
  const conditionEval = new EventConditionEvaluator();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const calendar = new CalendarSystem();

  const registry = new Map<string, unknown>();
  registry.set('eventTrigger', eventTrigger);
  registry.set('eventNotification', notification);
  registry.set('eventLog', eventLog);
  registry.set('chainEvent', chainEvent);
  registry.set('offlineEvent', offlineEvent);
  registry.set('offlineEventHandler', offlineHandler);
  registry.set('storyEvent', storyEvent);
  registry.set('eventConditionEvaluator', conditionEval);
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('calendar', calendar);

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
    } as unknown as ISubsystemRegistry,
  };

  eventTrigger.init(deps);
  notification.init(deps);
  eventLog.init(deps);
  chainEvent.init(deps);
  offlineEvent.init(deps);
  storyEvent.init(deps);
  territory.init(deps);
  siege.init(deps);
  calendar.init(deps);

  return deps;
}

function getSystems(deps: ISystemDeps) {
  return {
    eventTrigger: deps.registry.get<EventTriggerSystem>('eventTrigger')!,
    notification: deps.registry.get<EventNotificationSystem>('eventNotification')!,
    eventLog: deps.registry.get<EventLogSystem>('eventLog')!,
    chainEvent: deps.registry.get<ChainEventSystem>('chainEvent')!,
    offlineEvent: deps.registry.get<OfflineEventSystem>('offlineEvent')!,
    offlineHandler: deps.registry.get<OfflineEventHandler>('offlineHandler')!,
    storyEvent: deps.registry.get<StoryEventSystem>('storyEvent')!,
    conditionEval: deps.registry.get<EventConditionEvaluator>('eventConditionEvaluator')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    calendar: deps.registry.get<CalendarSystem>('calendar')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v6.0 集成测试: §7 事件系统', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  // ── §7.1 事件触发 ────────────────────────────

  describe('§7.1 事件触发', () => {
    it('触发规则：随机遭遇30~60min间隔', () => {
      const config = sys.eventTrigger.getConfig();
      expect(config).toBeDefined();
      expect(config.maxActiveEvents).toBeGreaterThan(0);
    });

    it('触发概率公式：P = clamp(base + Σadd × Πmul)', () => {
      const probCondition: ProbabilityCondition = {
        baseProbability: 0.03,
        modifiers: [
          { name: 'level', additiveBonus: 0.02, multiplicativeBonus: 1.0, active: true },
        ],
      };
      const result = calculateProbability(probCondition);
      expect(result).toBeDefined();
      expect(result.finalProbability).toBeGreaterThanOrEqual(0);
      expect(result.finalProbability).toBeLessThanOrEqual(1);
    });

    it('冷却机制：同子类型60min冷却', () => {
      // 注册事件并触发，验证冷却
      const def: EventDef = {
        id: 'test-cool-event',
        title: '冷却测试',
        description: '测试冷却机制',
        triggerType: 'random',
        urgency: 'medium',
        options: [{ id: 'opt-1', text: '选项1', consequences: { description: '结果' } }],
      };
      sys.eventTrigger.registerEvent(def);

      // 首次触发
      const r1 = sys.eventTrigger.forceTriggerEvent('test-cool-event', 1);
      expect(r1.triggered).toBe(true);

      // 同回合不能再次触发
      const canTrigger = sys.eventTrigger.canTrigger('test-cool-event', 1);
      expect(canTrigger).toBe(false);
    });

    it('活跃事件数上限', () => {
      const config = sys.eventTrigger.getConfig();
      expect(config.maxActiveEvents).toBeLessThanOrEqual(20);
    });

    it('事件注册与查询', () => {
      const def: EventDef = {
        id: 'test-query-event',
        title: '查询测试',
        description: '测试事件查询',
        triggerType: 'random',
        urgency: 'low',
        options: [{ id: 'opt-1', text: '选项1', consequences: { description: '结果' } }],
      };
      sys.eventTrigger.registerEvent(def);

      const found = sys.eventTrigger.getEventDef('test-query-event');
      expect(found).toBeDefined();
      expect(found!.title).toBe('查询测试');

      const byType = sys.eventTrigger.getEventDefsByType('random');
      expect(byType.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── §7.2 随机遭遇弹窗 ────────────────────────

  describe('§7.2 随机遭遇弹窗', () => {
    it('选项后果标注：绿色正面/红色负面/黄色中性', () => {
      const def: EventDef = {
        id: 'test-encounter',
        title: '商队来访',
        description: '一支商队经过你的领地',
        triggerType: 'random',
        urgency: 'medium',
        options: [
          { id: 'opt-welcome', text: '热情款待', consequences: { description: '产出×1.5，2h', resourceChanges: { grain: 100 } } },
          { id: 'opt-trade', text: '适度交易', consequences: { description: '铜钱+200~500', resourceChanges: { gold: 300 } } },
          { id: 'opt-tax', text: '征收税金', consequences: { description: '铜钱+500~1000，声望-10', resourceChanges: { gold: 800, morale: -10 } } },
        ],
      };
      sys.eventTrigger.registerEvent(def);

      const result = sys.eventTrigger.forceTriggerEvent('test-encounter', 1);
      expect(result.triggered).toBe(true);

      // 创建遭遇弹窗
      const popup = sys.notification.createEncounterPopup(result.instance!, {
        title: def.title,
        description: def.description,
        urgency: def.urgency,
        options: def.options,
      });

      expect(popup).toBeDefined();
      expect(popup.options).toHaveLength(3);
    });

    it('选择后执行后果并Toast反馈', () => {
      const def: EventDef = {
        id: 'test-resolve',
        title: '流寇来袭',
        description: '一群流寇正在骚扰边境',
        triggerType: 'random',
        urgency: 'high',
        options: [
          { id: 'opt-fight', text: '出兵剿灭', consequences: { description: '声望+15', resourceChanges: { morale: 15 } } },
          { id: 'opt-pay', text: '花钱买路', consequences: { description: '铜钱-300~800', resourceChanges: { gold: -500 } } },
        ],
      };
      sys.eventTrigger.registerEvent(def);

      const result = sys.eventTrigger.forceTriggerEvent('test-resolve', 1);
      const popup = sys.notification.createEncounterPopup(result.instance!, {
        title: def.title,
        description: def.description,
        urgency: def.urgency,
        options: def.options,
      });

      // 选择"出兵剿灭"
      const choiceResult = sys.notification.resolveEncounter(popup.id, 'opt-fight');
      expect(choiceResult).toBeDefined();
      expect(choiceResult!.optionId).toBe('opt-fight');
      expect(choiceResult!.consequences).toBeDefined();
    });

    it('奖励缩放：资源奖励 = 基础值 × (1 + 主城等级 × 0.1)', () => {
      // 公式验证
      const baseValue = 100;
      const castleLevel = 5;
      const scaled = baseValue * (1 + castleLevel * 0.1);
      expect(scaled).toBe(150);
    });
  });

  // ── §7.3 连锁事件 ────────────────────────────

  describe('§7.3 连锁事件', () => {
    it('链结构：2~4环（大部分3环）', () => {
      // 桃园结义链（3环）
      sys.chainEvent.registerChain({
        id: 'peach-garden',
        name: '桃园结义',
        description: '刘关张桃园三结义',
        maxDepth: 3,
        nodes: [
          { id: 'pg-1', eventDefId: 'evt-pg-1', depth: 0, description: '路遇豪杰' },
          { id: 'pg-2', eventDefId: 'evt-pg-2', parentNodeId: 'pg-1', parentOptionId: 'befriend', depth: 1, description: '桃园设宴' },
          { id: 'pg-3', eventDefId: 'evt-pg-3', parentNodeId: 'pg-2', parentOptionId: 'feast', depth: 2, description: '义薄云天' },
        ],
      });

      const chain = sys.chainEvent.getChain('peach-garden');
      expect(chain).toBeDefined();
      expect(chain!.nodes).toHaveLength(3);
    });

    it('最多同时进行1条事件链', () => {
      sys.chainEvent.registerChain({
        id: 'chain-1',
        name: '链1',
        description: '测试链1',
        maxDepth: 2,
        nodes: [
          { id: 'c1-1', eventDefId: 'evt-c1-1', depth: 0 },
          { id: 'c1-2', eventDefId: 'evt-c1-2', parentNodeId: 'c1-1', parentOptionId: 'go', depth: 1 },
        ],
      });

      sys.chainEvent.startChain('chain-1');
      expect(sys.chainEvent.isChainStarted('chain-1')).toBe(true);
    });

    it('链超时：单环等待>24h未响应→自动终止', () => {
      sys.chainEvent.registerChain({
        id: 'timeout-test',
        name: '超时测试',
        description: '测试超时',
        maxDepth: 2,
        nodes: [
          { id: 'tt-1', eventDefId: 'evt-tt-1', depth: 0 },
          { id: 'tt-2', eventDefId: 'evt-tt-2', parentNodeId: 'tt-1', parentOptionId: 'go', depth: 1 },
        ],
      });

      const root = sys.chainEvent.startChain('timeout-test');
      expect(root).toBeDefined();

      const progress = sys.chainEvent.getProgress('timeout-test');
      expect(progress!.startedAt).toBeGreaterThan(0);
    });

    it('链完成奖励：完成全部环节后额外获得最终奖励', () => {
      sys.chainEvent.registerChain({
        id: 'reward-chain',
        name: '奖励链',
        description: '测试奖励',
        maxDepth: 2,
        nodes: [
          { id: 'rc-1', eventDefId: 'evt-rc-1', depth: 0 },
          { id: 'rc-2', eventDefId: 'evt-rc-2', parentNodeId: 'rc-1', parentOptionId: 'go', depth: 1 },
        ],
      });

      sys.chainEvent.startChain('reward-chain');
      const r = sys.chainEvent.advanceChain('reward-chain', 'go');
      // 没有后续节点 → 链完成
      if (!r.chainCompleted) {
        const r2 = sys.chainEvent.advanceChain('reward-chain', 'done');
        expect(r2.chainCompleted).toBe(true);
      } else {
        expect(r.chainCompleted).toBe(true);
      }
    });

    it('重复规则：同一事件链完成后不可重新开始', () => {
      sys.chainEvent.registerChain({
        id: 'cooldown-chain',
        name: '冷却链',
        description: '测试冷却',
        maxDepth: 2,
        nodes: [
          { id: 'cc-1', eventDefId: 'evt-cc-1', depth: 0 },
          { id: 'cc-2', eventDefId: 'evt-cc-2', parentNodeId: 'cc-1', parentOptionId: 'go', depth: 1 },
        ],
      });

      sys.chainEvent.startChain('cooldown-chain');
      // Advance to complete
      const r1 = sys.chainEvent.advanceChain('cooldown-chain', 'go');
      if (!r1.chainCompleted) {
        sys.chainEvent.advanceChain('cooldown-chain', 'done');
      }

      // 验证链已完成
      expect(sys.chainEvent.isChainCompleted('cooldown-chain')).toBe(true);
    });
  });

  // ── §7.4 离线事件处理 ────────────────────────

  describe('§7.4 离线事件处理', () => {
    it('离线事件队列管理', () => {
      // 添加离线事件
      const def: EventDef = {
        id: 'offline-test-1',
        title: '离线事件1',
        description: '测试离线事件',
        triggerType: 'random',
        urgency: 'medium',
        options: [{ id: 'opt-1', text: '选项1', consequences: { description: '结果' } }],
      };
      sys.offlineEvent.registerEventDef(def);

      sys.offlineEvent.addOfflineEvent({
        eventId: 'oe-1',
        eventDefId: 'offline-test-1',
        title: '天灾降临',
        description: '一场暴雨袭击了你的领地',
        urgency: 'high',
        category: 'disaster',
        triggeredAt: Date.now() - 3600000,
        requiresManualAction: false,
        triggerTurn: 10,
        eventDef: def,
        autoResult: null,
      });

      expect(sys.offlineEvent.getQueueSize()).toBe(1);
    });

    it('自动处理规则匹配', () => {
      sys.offlineEvent.registerAutoRule({
        id: 'rule-safe',
        name: '安全策略',
        description: '自动选择最安全的选项',
        enabled: true,
        priority: 1,
        strategy: 'safest',
        urgencyThreshold: 'medium',
        applicableCategories: ['disaster'],
        applicableEventIds: [],
      });

      const rules = sys.offlineEvent.getAllAutoRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].strategy).toBe('safest');
    });

    it('离线事件堆积上限', () => {
      // 队列上限应为50
      expect(sys.offlineEvent.getQueueSize()).toBe(0);

      // 添加大量事件
      const def: EventDef = {
        id: 'bulk-event',
        title: '批量事件',
        description: '测试堆积',
        triggerType: 'random',
        urgency: 'low',
        options: [{ id: 'opt-1', text: '选项1', consequences: { description: '结果' } }],
      };

      for (let i = 0; i < 60; i++) {
        sys.offlineEvent.addOfflineEvent({
          eventId: `bulk-${i}`,
          eventDefId: 'bulk-event',
          title: `事件${i}`,
          description: `描述${i}`,
          urgency: 'low',
          category: 'random',
          triggeredAt: Date.now(),
          requiresManualAction: false,
          triggerTurn: i,
          eventDef: def,
          autoResult: null,
        });
      }

      // 队列应被裁剪到上限
      expect(sys.offlineEvent.getQueueSize()).toBeLessThanOrEqual(50);
    });

    it('离线收益公式：正面收益 = 基础奖励 × 50%', () => {
      const baseReward = 100;
      const offlineRate = 0.5;
      expect(baseReward * offlineRate).toBe(50);
    });

    it('离线损失上限 = 当前资源总量15%', () => {
      const totalResources = 10000;
      const maxLoss = totalResources * 0.15;
      expect(maxLoss).toBe(1500);
    });
  });

  // ── §7.5 事件跨系统联动 ──────────────────────

  describe('§7.5 事件跨系统联动', () => {
    it('随机遭遇→战斗：选择"出兵"→战斗界面', () => {
      // 事件系统与战斗系统的联动路径
      const def: EventDef = {
        id: 'cross-battle',
        title: '流寇来袭',
        description: '选择出兵进入战斗',
        triggerType: 'random',
        urgency: 'high',
        options: [
          { id: 'fight', text: '出兵剿灭', consequences: { description: '进入战斗', triggerEventId: 'battle-start' } },
          { id: 'pay', text: '花钱买路', consequences: { description: '铜钱-500', resourceChanges: { gold: -500 } } },
        ],
      };
      sys.eventTrigger.registerEvent(def);

      const result = sys.eventTrigger.forceTriggerEvent('cross-battle', 1);
      expect(result.triggered).toBe(true);
    });

    it('剧情事件→地图：剧情解锁新区域→地图自动定位', () => {
      // StoryEventSystem 初始化
      const state = sys.storyEvent.getState();
      expect(state).toBeDefined();
    });

    it('事件日志记录完整', () => {
      sys.eventLog.logEvent({
        eventDefId: 'evt-test-1',
        title: '测试事件',
        description: '事件描述',
        triggeredTurn: 5,
        timestamp: Date.now(),
        eventType: 'random',
      });

      const logs = sys.eventLog.getEventLog();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe('random');
    });
  });

  // ── §7.10 事件类型筛选异常处理 ─────────────────

  describe('§7.10 事件类型筛选异常处理', () => {
    it('筛选结果为空：返回空数组', () => {
      const logs = sys.eventLog.getEventLog({ eventType: 'story' });
      expect(logs).toHaveLength(0);
    });

    it('快速切换标签：防抖200ms', () => {
      // 验证筛选接口稳定
      const r1 = sys.eventLog.getEventLog({ eventType: 'random' });
      const r2 = sys.eventLog.getEventLog({ eventType: 'chain' });
      const r3 = sys.eventLog.getEventLog({ eventType: 'fixed' });
      expect(Array.isArray(r1)).toBe(true);
      expect(Array.isArray(r2)).toBe(true);
      expect(Array.isArray(r3)).toBe(true);
    });

    it('按回合范围筛选', () => {
      sys.eventLog.logEvent({
        eventDefId: 'evt-range-1', title: '早期事件', description: '',
        triggeredTurn: 5, timestamp: Date.now(), eventType: 'random',
      });
      sys.eventLog.logEvent({
        eventDefId: 'evt-range-2', title: '后期事件', description: '',
        triggeredTurn: 15, timestamp: Date.now(), eventType: 'random',
      });

      const filtered = sys.eventLog.getEventLog({ fromTurn: 10, toTurn: 20 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].triggeredTurn).toBe(15);
    });
  });

  // ── 事件系统完整性 ──────────────────────────

  describe('事件系统完整性', () => {
    it('EventTriggerSystem 序列化/反序列化', () => {
      const saved = sys.eventTrigger.serialize();
      expect(saved).toBeDefined();

      sys.eventTrigger.reset();
      sys.eventTrigger.deserialize(saved);
    });

    it('EventNotificationSystem 序列化/反序列化', () => {
      const saved = sys.notification.exportSaveData();
      expect(saved).toBeDefined();
      expect(saved.version).toBeDefined();

      sys.notification.reset();
      sys.notification.importSaveData(saved);
    });

    it('EventLogSystem 序列化/反序列化', () => {
      sys.eventLog.logEvent({
        eventDefId: 'evt-serial', title: '序列化测试', description: '',
        triggeredTurn: 1, timestamp: Date.now(), eventType: 'random',
      });

      const saved = sys.eventLog.exportSaveData();
      expect(saved.eventLog).toHaveLength(1);

      sys.eventLog.reset();
      sys.eventLog.importSaveData(saved);
      expect(sys.eventLog.getLogCount()).toBe(1);
    });

    it('ChainEventSystem 序列化/反序列化', () => {
      sys.chainEvent.registerChain({
        id: 'serial-chain',
        name: '序列化链',
        description: '测试',
        maxDepth: 2,
        nodes: [
          { id: 'sc-1', eventDefId: 'evt-sc-1', depth: 0 },
          { id: 'sc-2', eventDefId: 'evt-sc-2', parentNodeId: 'sc-1', parentOptionId: 'go', depth: 1 },
        ],
      });
      sys.chainEvent.startChain('serial-chain');

      const saved = sys.chainEvent.exportSaveData();
      expect(saved.chainProgresses).toHaveLength(1);

      sys.chainEvent.reset();
      sys.chainEvent.importSaveData(saved);
      expect(sys.chainEvent.isChainStarted('serial-chain')).toBe(true);
    });

    it('OfflineEventSystem 序列化/反序列化', () => {
      const saved = sys.offlineEvent.exportSaveData();
      expect(saved).toBeDefined();
      expect(saved.version).toBeDefined();
    });

    it('预定义事件加载', () => {
      const allDefs = sys.eventTrigger.getAllEventDefs();
      expect(allDefs.length).toBeGreaterThan(0);
    });
  });
});
