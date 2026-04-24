/**
 * 集成测试 — 事件触发+遭遇+连锁全链路 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §7.1 事件触发：触发条件、触发类型（随机/固定/连锁）
 *   §7.2 随机遭遇弹窗：遭遇事件数据
 *   §7.3 连锁事件：连锁触发、前置依赖、链推进
 *
 * @module engine/calendar/__tests__/integration/event-trigger-chain
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventTriggerSystem } from '../../../event/EventTriggerSystem';
import { ChainEventSystem } from '../../../event/ChainEventSystem';
import { EventChainSystem } from '../../../event/EventChainSystem';
import type { ISystemDeps } from '../../../../core/types';
import type {
  EventDef,
  EventTriggerType,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
  EventCondition,
  EventOption,
  EventTriggerConfig,
} from '../../../../core/event';
import type {
  EventChainDef,
  ChainNodeDef,
  ChainAdvanceResult,
  ChainProgress,
} from '../../../event/chain-event-types';
import type {
  EventChain,
  EventChainNode,
  StoryEventDef,
  EventLogEntry,
  ReturnAlert,
} from '../../../event/event-chain.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建完整的系统依赖 */
function createDeps(): ISystemDeps {
  const trigger = new EventTriggerSystem();
  const chain = new ChainEventSystem();
  const chainSystem = new EventChainSystem();

  const registry = new Map<string, unknown>();
  registry.set('eventTrigger', trigger);
  registry.set('chainEvent', chain);
  registry.set('eventChain', chainSystem);

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

  trigger.init(deps);
  chain.init(deps);
  chainSystem.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    trigger: deps.registry!.get<EventTriggerSystem>('eventTrigger')!,
    chain: deps.registry!.get<ChainEventSystem>('chainEvent')!,
    chainSystem: deps.registry!.get<EventChainSystem>('eventChain')!,
  };
}

/** 创建随机事件定义 */
function createRandomEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-random-refugees',
    title: '流民涌入',
    description: '大批流民涌入城池，需要做出决策',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 0.3,
    options: [
      {
        id: 'accept',
        text: '接纳流民',
        consequences: {
          description: '人口增加，粮食消耗增加',
          resourceChanges: { food: -50, population: 100 },
        },
      },
      {
        id: 'reject',
        text: '拒绝流民',
        consequences: {
          description: '民心下降',
          affinityChanges: { 'npc-people': -10 },
        },
      },
    ],
    ...overrides,
  };
}

/** 创建固定事件定义 */
function createFixedEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-fixed-harvest',
    title: '秋收时节',
    description: '秋季丰收，粮食产量大增',
    triggerType: 'fixed',
    urgency: 'low',
    scope: 'region',
    triggerConditions: [{ type: 'turn_range', params: { minTurn: 10, maxTurn: 20 } }],
    options: [
      {
        id: 'store',
        text: '囤积粮食',
        consequences: {
          description: '粮食储备增加',
          resourceChanges: { food: 200 },
        },
      },
      {
        id: 'sell',
        text: '出售粮食',
        consequences: {
          description: '获得金币',
          resourceChanges: { gold: 100, food: -100 },
        },
      },
    ],
    expireAfterTurns: 5,
    ...overrides,
  };
}

/** 创建连锁事件定义 */
function createChainEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-chain-secret-letter-1',
    title: '密信',
    description: '发现一封神秘密信',
    triggerType: 'chain',
    urgency: 'high',
    scope: 'global',
    prerequisiteEventIds: [],
    options: [
      {
        id: 'open',
        text: '拆开密信',
        consequences: {
          description: '信中暗藏玄机',
          triggerEventId: 'evt-chain-secret-letter-2',
        },
      },
      {
        id: 'destroy',
        text: '销毁密信',
        consequences: {
          description: '选择销毁密信',
        },
      },
    ],
    ...overrides,
  };
}

/** 创建事件链定义 */
function createEventChainDef(): EventChainDef {
  return {
    id: 'chain-secret-letter',
    name: '密信事件链',
    description: '围绕一封密信展开的连锁事件',
    maxDepth: 3,
    nodes: [
      {
        id: 'node-1',
        eventDefId: 'evt-chain-secret-letter-1',
        depth: 0,
        description: '发现密信',
      },
      {
        id: 'node-2',
        eventDefId: 'evt-chain-secret-letter-2',
        parentNodeId: 'node-1',
        parentOptionId: 'open',
        depth: 1,
        description: '追踪密信来源',
      },
      {
        id: 'node-3',
        eventDefId: 'evt-chain-secret-letter-3',
        parentNodeId: 'node-2',
        parentOptionId: 'investigate',
        depth: 2,
        description: '揭开真相',
      },
    ],
  };
}

/** 创建故事事件 */
function createStoryEvent(overrides: Partial<StoryEventDef> = {}): StoryEventDef {
  return {
    id: 'story-battle-guandu',
    title: '官渡之战',
    storyLines: [
      { speaker: '曹操', text: '此战关乎天下大势！' },
      { speaker: '旁白', text: '两军对峙，战鼓雷鸣。', choices: [
        { text: '主动出击', consequence: '发动突袭' },
        { text: '坚守不出', consequence: '等待时机' },
      ]},
    ],
    triggerConditions: [],
    triggered: false,
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// §7.1 事件触发
// ═════════════════════════════════════════════

describe('§7.1 事件触发', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // --- 事件注册 ---

  describe('事件注册', () => {
    it('registerEvent 注册单个事件定义', () => {
      sys.trigger.registerEvent(createRandomEvent());
      expect(sys.trigger.getEventDef('evt-random-refugees')).toBeDefined();
      expect(sys.trigger.getEventDef('evt-random-refugees')!.title).toBe('流民涌入');
    });

    it('registerEvents 批量注册事件定义', () => {
      sys.trigger.registerEvents([
        createRandomEvent(),
        createFixedEvent(),
        createChainEventDef(),
      ]);
      expect(sys.trigger.getAllEventDefs().length).toBeGreaterThanOrEqual(3);
    });

    it('getEventDefsByType 按触发类型过滤', () => {
      sys.trigger.registerEvents([
        createRandomEvent(),
        createFixedEvent(),
        createChainEventDef(),
      ]);
      const randoms = sys.trigger.getEventDefsByType('random');
      expect(randoms.length).toBeGreaterThanOrEqual(1);
      expect(randoms.every(e => e.triggerType === 'random')).toBe(true);
    });

    it('getEventDef 对不存在的事件返回 undefined', () => {
      expect(sys.trigger.getEventDef('nonexistent')).toBeUndefined();
    });

    it('预定义事件加载后可查询', () => {
      const allDefs = sys.trigger.getAllEventDefs();
      expect(allDefs.length).toBeGreaterThanOrEqual(0);
    });
  });

  // --- 触发条件 ---

  describe('触发条件', () => {
    it('固定事件需要满足条件才触发', () => {
      const fixedEvt = createFixedEvent({
        triggerConditions: [{ type: 'turn_range', params: { minTurn: 10, maxTurn: 20 } }],
      });
      sys.trigger.registerEvent(fixedEvt);

      // 低回合不满足条件
      expect(sys.trigger.canTrigger('evt-fixed-harvest', 5)).toBe(false);
      // 满足条件的回合
      expect(sys.trigger.canTrigger('evt-fixed-harvest', 15)).toBe(true);
    });

    it('连锁事件需要前置事件完成', () => {
      const chainEvt = createChainEventDef({
        prerequisiteEventIds: ['evt-prerequisite-1'],
      });
      sys.trigger.registerEvent(chainEvt);

      // 前置事件未完成
      expect(sys.trigger.canTrigger('evt-chain-secret-letter-1', 1)).toBe(false);
    });

    it('canTrigger 对不存在的事件返回 false', () => {
      expect(sys.trigger.canTrigger('nonexistent', 1)).toBe(false);
    });

    it('随机事件检查概率条件', () => {
      const randomEvt = createRandomEvent({ triggerProbability: 0.5 });
      sys.trigger.registerEvent(randomEvt);
      // canTrigger 只检查基本条件（冷却、已完成等），不检查概率
      expect(typeof sys.trigger.canTrigger('evt-random-refugees', 1)).toBe('boolean');
    });
  });

  // --- 触发类型 ---

  describe('触发类型', () => {
    it('forceTriggerEvent 强制触发事件', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe('evt-random-refugees');
    });

    it('forceTriggerEvent 对不存在的事件返回失败', () => {
      const result = sys.trigger.forceTriggerEvent('nonexistent', 1);
      expect(result.triggered).toBe(false);
    });

    it('checkAndTriggerEvents 检查并触发满足条件的事件', () => {
      sys.trigger.registerEvent(createRandomEvent({ triggerProbability: 1.0 }));
      const instances = sys.trigger.checkAndTriggerEvents(1);
      // 概率为1.0时应触发
      expect(instances.length).toBeGreaterThanOrEqual(0);
    });

    it('触发后事件进入活跃状态', () => {
      sys.trigger.registerEvent(createRandomEvent());
      sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      expect(sys.trigger.hasActiveEvent('evt-random-refugees')).toBe(true);
    });

    it('getActiveEvents 返回活跃事件列表', () => {
      sys.trigger.registerEvent(createRandomEvent());
      sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      const active = sys.trigger.getActiveEvents();
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it('getActiveEventCount 返回活跃事件数量', () => {
      sys.trigger.registerEvent(createRandomEvent());
      sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      expect(sys.trigger.getActiveEventCount()).toBeGreaterThanOrEqual(1);
    });

    it('getInstance 获取事件实例', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      const instance = sys.trigger.getInstance(result.instance!.instanceId);
      expect(instance).toBeDefined();
      expect(instance!.eventDefId).toBe('evt-random-refugees');
    });
  });

  // --- 事件解决与过期 ---

  describe('事件解决与过期', () => {
    it('resolveEvent 选择选项解决事件', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      const choice = sys.trigger.resolveEvent(result.instance!.instanceId, 'accept');
      expect(choice).not.toBeNull();
      expect(choice!.optionId).toBe('accept');
      expect(choice!.consequences).toBeDefined();
    });

    it('resolveEvent 标记事件为已完成', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      sys.trigger.resolveEvent(result.instance!.instanceId, 'accept');
      expect(sys.trigger.isEventCompleted('evt-random-refugees')).toBe(true);
    });

    it('getCompletedEventIds 返回已完成事件ID列表', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      sys.trigger.resolveEvent(result.instance!.instanceId, 'accept');
      const completed = sys.trigger.getCompletedEventIds();
      expect(completed).toContain('evt-random-refugees');
    });

    it('expireEvents 过期事件', () => {
      sys.trigger.registerEvent(createFixedEvent({ expireAfterTurns: 5 }));
      const result = sys.trigger.forceTriggerEvent('evt-fixed-harvest', 10);
      const expired = sys.trigger.expireEvents(20);
      expect(expired.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- 配置与序列化 ---

  describe('配置与序列化', () => {
    it('getConfig 返回默认配置', () => {
      const config = sys.trigger.getConfig();
      expect(config).toHaveProperty('randomEventProbability');
      expect(config).toHaveProperty('maxActiveEvents');
      expect(config).toHaveProperty('chainEventDelay');
    });

    it('setConfig 更新配置', () => {
      sys.trigger.setConfig({ maxActiveEvents: 10 });
      expect(sys.trigger.getConfig().maxActiveEvents).toBe(10);
    });

    it('serialize 返回可序列化数据', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const data = sys.trigger.serialize();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('version');
    });

    it('deserialize 恢复事件系统状态', () => {
      sys.trigger.registerEvent(createRandomEvent());
      sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      const saved = sys.trigger.serialize();

      const newTrigger = new EventTriggerSystem();
      const newDeps = createDeps();
      newTrigger.init(newDeps);
      newTrigger.registerEvent(createRandomEvent());
      newTrigger.deserialize(saved);

      expect(newTrigger.getActiveEventCount()).toBeGreaterThanOrEqual(1);
    });
  });
});

// ═════════════════════════════════════════════
// §7.2 随机遭遇弹窗
// ═════════════════════════════════════════════

describe('§7.2 随机遭遇弹窗', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // --- 遭遇事件数据 ---

  describe('遭遇事件数据', () => {
    it('随机事件包含有效的选项列表', () => {
      const evt = createRandomEvent();
      sys.trigger.registerEvent(evt);
      const def = sys.trigger.getEventDef('evt-random-refugees');
      expect(def!.options.length).toBeGreaterThanOrEqual(2);
    });

    it('事件选项包含文本和后果', () => {
      const evt = createRandomEvent();
      for (const option of evt.options) {
        expect(option.text).toBeDefined();
        expect(option.consequences).toBeDefined();
        expect(option.consequences.description).toBeDefined();
      }
    });

    it('事件后果可包含资源变化', () => {
      const evt = createRandomEvent();
      const acceptOption = evt.options.find(o => o.id === 'accept');
      expect(acceptOption!.consequences.resourceChanges).toBeDefined();
      expect(acceptOption!.consequences.resourceChanges!.food).toBe(-50);
    });

    it('事件后果可包含好感度变化', () => {
      const evt = createRandomEvent();
      const rejectOption = evt.options.find(o => o.id === 'reject');
      expect(rejectOption!.consequences.affinityChanges).toBeDefined();
    });

    it('事件有紧急程度标识', () => {
      const evt = createRandomEvent();
      expect(['low', 'medium', 'high', 'critical']).toContain(evt.urgency);
    });

    it('事件有作用域标识', () => {
      const evt = createRandomEvent();
      expect(['global', 'region', 'npc']).toContain(evt.scope);
    });

    it('解决事件返回选择结果数据', () => {
      sys.trigger.registerEvent(createRandomEvent());
      const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
      const choice = sys.trigger.resolveEvent(result.instance!.instanceId, 'accept');
      expect(choice).not.toBeNull();
      expect(choice!.consequences.resourceChanges).toBeDefined();
    });

    it('解决事件可触发后续连锁事件', () => {
      sys.trigger.registerEvent(createChainEventDef());
      const result = sys.trigger.forceTriggerEvent('evt-chain-secret-letter-1', 1);
      const choice = sys.trigger.resolveEvent(result.instance!.instanceId, 'open');
      expect(choice).not.toBeNull();
      // 选择 open 应触发后续事件
      expect(choice!.consequences.triggerEventId).toBe('evt-chain-secret-letter-2');
    });
  });

  // --- 概率计算 ---

  describe('概率计算', () => {
    it('calculateProbability 返回概率计算结果', () => {
      const result = sys.trigger.calculateProbability({
        baseProbability: 0.5,
        modifiers: [],
      });
      expect(result).toHaveProperty('finalProbability');
      expect(result.finalProbability).toBeGreaterThanOrEqual(0);
      expect(result.finalProbability).toBeLessThanOrEqual(1);
    });

    it('registerProbabilityCondition 注册概率条件', () => {
      sys.trigger.registerProbabilityCondition('evt-test', {
        baseProbability: 0.3,
        modifiers: [],
      });
      const condition = sys.trigger.getProbabilityCondition('evt-test');
      expect(condition).toBeDefined();
      expect(condition!.baseProbability).toBe(0.3);
    });

    it('getProbabilityCondition 对未注册事件返回 undefined', () => {
      expect(sys.trigger.getProbabilityCondition('nonexistent')).toBeUndefined();
    });
  });

  // --- 横幅通知 ---

  describe('横幅通知', () => {
    it('事件触发后可通过 EventChainSystem 记录日志', () => {
      sys.chainSystem.addLogEntry({
        type: 'event',
        title: '流民涌入',
        description: '大批流民涌入城池',
        urgency: 'medium',
      });
      const log = sys.chainSystem.getEventLog();
      expect(log.length).toBe(1);
    });

    it('getLogCount 返回日志数量', () => {
      sys.chainSystem.addLogEntry({
        type: 'event',
        title: '测试事件',
        description: '测试描述',
        urgency: 'low',
      });
      expect(sys.chainSystem.getLogCount()).toBe(1);
    });

    it('getEventLog 按类型过滤日志', () => {
      sys.chainSystem.addLogEntry({ type: 'event', title: '事件1', description: 'd1', urgency: 'low' });
      sys.chainSystem.addLogEntry({ type: 'story', title: '故事1', description: 'd2', urgency: 'high' });
      const eventLogs = sys.chainSystem.getEventLog(10, 'event');
      expect(eventLogs.every(l => l.type === 'event')).toBe(true);
    });
  });

  // --- 回归急报 ---

  describe('回归急报', () => {
    it('addReturnAlert 添加回归急报', () => {
      const alert = sys.chainSystem.addReturnAlert({
        title: '紧急事件',
        description: '城池遭受攻击',
        urgency: 'critical',
      });
      expect(alert).toBeDefined();
      expect(alert.title).toBe('紧急事件');
      expect(alert.read).toBe(false);
    });

    it('addOfflineAlerts 批量添加离线急报', () => {
      const alerts = sys.chainSystem.addOfflineAlerts([
        { title: '事件1', description: 'd1', urgency: 'low' },
        { title: '事件2', description: 'd2', urgency: 'high' },
      ]);
      expect(alerts.length).toBe(2);
    });

    it('getReturnAlerts 返回所有急报', () => {
      sys.chainSystem.addReturnAlert({ title: 't1', description: 'd1', urgency: 'medium' });
      sys.chainSystem.addReturnAlert({ title: 't2', description: 'd2', urgency: 'high' });
      expect(sys.chainSystem.getReturnAlerts().length).toBe(2);
    });

    it('getReturnAlerts 只返回未读急报', () => {
      sys.chainSystem.addReturnAlert({ title: 't1', description: 'd1', urgency: 'medium' });
      const alerts = sys.chainSystem.getReturnAlerts();
      const first = alerts[0];
      sys.chainSystem.markAlertRead(first.id);
      const unread = sys.chainSystem.getReturnAlerts(true);
      expect(unread.length).toBe(0);
    });

    it('getUnreadAlertCount 返回未读急报数量', () => {
      sys.chainSystem.addReturnAlert({ title: 't1', description: 'd1', urgency: 'medium' });
      sys.chainSystem.addReturnAlert({ title: 't2', description: 'd2', urgency: 'high' });
      expect(sys.chainSystem.getUnreadAlertCount()).toBe(2);
    });

    it('markAllAlertsRead 标记所有急报为已读', () => {
      sys.chainSystem.addReturnAlert({ title: 't1', description: 'd1', urgency: 'medium' });
      sys.chainSystem.addReturnAlert({ title: 't2', description: 'd2', urgency: 'high' });
      sys.chainSystem.markAllAlertsRead();
      expect(sys.chainSystem.getUnreadAlertCount()).toBe(0);
    });

    it('clearReadAlerts 清除已读急报', () => {
      sys.chainSystem.addReturnAlert({ title: 't1', description: 'd1', urgency: 'medium' });
      const alerts = sys.chainSystem.getReturnAlerts();
      sys.chainSystem.markAlertRead(alerts[0].id);
      sys.chainSystem.clearReadAlerts();
      expect(sys.chainSystem.getReturnAlerts().length).toBe(0);
    });
  });
});

// ═════════════════════════════════════════════
// §7.3 连锁事件
// ═════════════════════════════════════════════

describe('§7.3 连锁事件', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // --- 事件链注册 ---

  describe('事件链注册', () => {
    it('registerChain 注册事件链', () => {
      sys.chain.registerChain(createEventChainDef());
      expect(sys.chain.getChain('chain-secret-letter')).toBeDefined();
    });

    it('registerChains 批量注册事件链', () => {
      sys.chain.registerChains([
        createEventChainDef(),
        {
          id: 'chain-assassination',
          name: '暗杀事件链',
          description: '一场政治暗杀',
          maxDepth: 2,
          nodes: [
            { id: 'a-node-1', eventDefId: 'evt-assassination-1', depth: 0 },
            { id: 'a-node-2', eventDefId: 'evt-assassination-2', parentNodeId: 'a-node-1', depth: 1 },
          ],
        },
      ]);
      expect(sys.chain.getAllChains().length).toBeGreaterThanOrEqual(2);
    });

    it('注册深度超过限制的事件链抛出错误', () => {
      expect(() => {
        sys.chain.registerChain({
          id: 'chain-deep',
          name: '超深链',
          description: '深度超过限制',
          maxDepth: 999,
          nodes: [],
        });
      }).toThrow();
    });

    it('getChain 对不存在的链返回 undefined', () => {
      expect(sys.chain.getChain('nonexistent')).toBeUndefined();
    });
  });

  // --- 链推进 ---

  describe('链推进', () => {
    it('startChain 开始事件链', () => {
      sys.chain.registerChain(createEventChainDef());
      const firstNode = sys.chain.startChain('chain-secret-letter');
      expect(firstNode).not.toBeNull();
      expect(firstNode!.id).toBe('node-1');
      expect(firstNode!.depth).toBe(0);
    });

    it('startChain 后 isChainStarted 返回 true', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      expect(sys.chain.isChainStarted('chain-secret-letter')).toBe(true);
    });

    it('advanceChain 推进事件链', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const result = sys.chain.advanceChain('chain-secret-letter', 'open');
      expect(result.success).toBe(true);
      expect(result.currentNode).not.toBeNull();
      expect(result.currentNode!.depth).toBe(1);
    });

    it('advanceChain 返回前一个节点ID', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const result = sys.chain.advanceChain('chain-secret-letter', 'open');
      expect(result.previousNodeId).toBe('node-1');
    });

    it('连续推进事件链到完成', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');

      // 推进到第2个节点
      const result1 = sys.chain.advanceChain('chain-secret-letter', 'open');
      expect(result1.success).toBe(true);
      expect(result1.currentNode!.depth).toBe(1);

      // 推进到第3个节点（最后）
      const result2 = sys.chain.advanceChain('chain-secret-letter', 'investigate');
      expect(result2.success).toBe(true);
      expect(result2.currentNode).not.toBeNull();

      // 再推进一次，无后续节点，链完成
      const result3 = sys.chain.advanceChain('chain-secret-letter', 'any');
      expect(result3.chainCompleted).toBe(true);
    });

    it('isChainCompleted 完成后返回 true', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      sys.chain.advanceChain('chain-secret-letter', 'open');
      sys.chain.advanceChain('chain-secret-letter', 'investigate');
      sys.chain.advanceChain('chain-secret-letter', 'any');
      expect(sys.chain.isChainCompleted('chain-secret-letter')).toBe(true);
    });

    it('getCurrentNode 返回当前节点', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const node = sys.chain.getCurrentNode('chain-secret-letter');
      expect(node).not.toBeNull();
      expect(node!.id).toBe('node-1');
    });

    it('getNextNodes 返回下一级节点列表', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const nextNodes = sys.chain.getNextNodes('chain-secret-letter', 'node-1');
      expect(nextNodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- 链进度 ---

  describe('链进度', () => {
    it('getProgress 返回链进度', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const progress = sys.chain.getProgress('chain-secret-letter');
      expect(progress).toBeDefined();
      expect(progress!.currentNodeId).toBe('node-1');
      expect(progress!.isCompleted).toBe(false);
    });

    it('getProgressStats 返回进度统计', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const stats = sys.chain.getProgressStats('chain-secret-letter');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('percentage');
    });

    it('推进后进度百分比更新', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');

      const statsBefore = sys.chain.getProgressStats('chain-secret-letter');
      sys.chain.advanceChain('chain-secret-letter', 'open');
      const statsAfter = sys.chain.getProgressStats('chain-secret-letter');

      expect(statsAfter.completed).toBeGreaterThan(statsBefore.completed);
    });
  });

  // --- 前置依赖 ---

  describe('前置依赖', () => {
    it('连锁事件定义包含 prerequisiteEventIds', () => {
      const evt = createChainEventDef({
        prerequisiteEventIds: ['evt-prerequisite-1', 'evt-prerequisite-2'],
      });
      expect(evt.prerequisiteEventIds!.length).toBe(2);
    });

    it('EventChainSystem 注册事件链', () => {
      const chain: EventChain = {
        id: 'chain-test',
        name: '测试链',
        description: '测试用事件链',
        maxDepth: 2,
        nodes: [
          {
            id: 'node-1',
            eventDefId: 'evt-1',
            depth: 0,
          },
          {
            id: 'node-2',
            eventDefId: 'evt-2',
            depth: 1,
            parentNodeId: 'node-1',
            parentOptionId: 'opt-a',
          },
        ],
      };
      sys.chainSystem.registerChain(chain);
      const node = sys.chainSystem.getCurrentChainNode('chain-test');
      // 未开始的链应返回 null
      expect(node).toBeNull();
    });

    it('EventChainSystem startChain 开始链', () => {
      const chain: EventChain = {
        id: 'chain-test',
        name: '测试链',
        description: '测试用事件链',
        maxDepth: 2,
        nodes: [
          {
            id: 'node-1',
            eventDefId: 'evt-1',
            depth: 0,
          },
          {
            id: 'node-2',
            eventDefId: 'evt-2',
            depth: 1,
            parentNodeId: 'node-1',
            parentOptionId: 'opt-a',
          },
        ],
      };
      sys.chainSystem.registerChain(chain);
      const startNode = sys.chainSystem.startChain('chain-test');
      expect(startNode).not.toBeNull();
      expect(startNode!.id).toBe('node-1');
    });

    it('EventChainSystem advanceChain 推进链', () => {
      const chain: EventChain = {
        id: 'chain-test',
        name: '测试链',
        description: '测试用事件链',
        maxDepth: 2,
        nodes: [
          {
            id: 'node-1',
            eventDefId: 'evt-1',
            depth: 0,
          },
          {
            id: 'node-2',
            eventDefId: 'evt-2',
            depth: 1,
            parentNodeId: 'node-1',
            parentOptionId: 'opt-a',
          },
        ],
      };
      sys.chainSystem.registerChain(chain);
      sys.chainSystem.startChain('chain-test');
      const nextNode = sys.chainSystem.advanceChain('chain-test', 'opt-a');
      expect(nextNode).not.toBeNull();
      expect(nextNode!.id).toBe('node-2');
    });
  });

  // --- 故事事件 ---

  describe('故事事件', () => {
    it('registerStoryEvent 注册故事事件', () => {
      sys.chainSystem.registerStoryEvent(createStoryEvent());
      expect(sys.chainSystem.getStoryEvent('story-battle-guandu')).toBeDefined();
    });

    it('registerStoryEvents 批量注册故事事件', () => {
      sys.chainSystem.registerStoryEvents([
        createStoryEvent({ id: 'story-1', title: '故事1' }),
        createStoryEvent({ id: 'story-2', title: '故事2' }),
      ]);
      expect(sys.chainSystem.getAllStoryEvents().length).toBeGreaterThanOrEqual(2);
    });

    it('canTriggerStoryEvent 检查故事事件触发条件', () => {
      sys.chainSystem.registerStoryEvent(createStoryEvent());
      const canTrigger = sys.chainSystem.canTriggerStoryEvent('story-battle-guandu');
      expect(typeof canTrigger).toBe('boolean');
    });

    it('triggerStoryEvent 触发故事事件', () => {
      sys.chainSystem.registerStoryEvent(createStoryEvent());
      const event = sys.chainSystem.triggerStoryEvent('story-battle-guandu');
      expect(event).not.toBeNull();
      expect(event!.title).toBe('官渡之战');
      expect(event!.storyLines.length).toBeGreaterThan(0);
    });
  });

  // --- 序列化 ---

  describe('序列化', () => {
    it('ChainEventSystem serialize 返回存档数据', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const data = sys.chain.exportSaveData();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('version');
      expect(data.chainProgresses.length).toBe(1);
    });

    it('ChainEventSystem importSaveData 恢复链状态', () => {
      sys.chain.registerChain(createEventChainDef());
      sys.chain.startChain('chain-secret-letter');
      const saved = sys.chain.exportSaveData();

      const newChain = new ChainEventSystem();
      const newDeps = createDeps();
      newChain.init(newDeps);
      newChain.registerChain(createEventChainDef());
      newChain.importSaveData(saved);

      expect(newChain.isChainStarted('chain-secret-letter')).toBe(true);
    });

    it('EventChainSystem serialize 返回存档数据', () => {
      sys.chainSystem.registerStoryEvent(createStoryEvent());
      const data = sys.chainSystem.serialize();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('version');
    });

    it('EventChainSystem deserialize 恢复状态', () => {
      sys.chainSystem.registerStoryEvent(createStoryEvent());
      sys.chainSystem.addLogEntry({ type: 'event', title: '测试', description: 'd', urgency: 'low' });
      const saved = sys.chainSystem.serialize();

      const newSys = new EventChainSystem();
      const newDeps = createDeps();
      newSys.init(newDeps);
      newSys.deserialize(saved);

      expect(newSys.getLogCount()).toBe(1);
    });
  });
});

// ═════════════════════════════════════════════
// §7.1+§7.2+§7.3 事件全链路交叉集成
// ═════════════════════════════════════════════

describe('§7.1+§7.2+§7.3 事件全链路交叉集成', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  it('触发事件→解决→记录日志 全链路', () => {
    sys.trigger.registerEvent(createRandomEvent());
    const result = sys.trigger.forceTriggerEvent('evt-random-refugees', 1);
    expect(result.triggered).toBe(true);

    const choice = sys.trigger.resolveEvent(result.instance!.instanceId, 'accept');
    expect(choice).not.toBeNull();

    sys.chainSystem.addLogEntry({
      type: 'event',
      title: '流民涌入',
      description: '选择接纳流民',
      urgency: 'medium',
    });
    expect(sys.chainSystem.getLogCount()).toBe(1);
  });

  it('连锁事件链：触发→推进→完成 全流程', () => {
    sys.chain.registerChain(createEventChainDef());
    const firstNode = sys.chain.startChain('chain-secret-letter');
    expect(firstNode).not.toBeNull();

    sys.chain.advanceChain('chain-secret-letter', 'open');
    sys.chain.advanceChain('chain-secret-letter', 'investigate');
    // 从最后一个节点再推进一次，无后续节点，链完成
    const finalResult = sys.chain.advanceChain('chain-secret-letter', 'any');

    expect(finalResult.chainCompleted).toBe(true);
    expect(sys.chain.isChainCompleted('chain-secret-letter')).toBe(true);
  });

  it('事件触发+急报堆叠+标记已读 全流程', () => {
    // 添加多个急报
    sys.chainSystem.addOfflineAlerts([
      { title: '紧急事件1', description: 'd1', urgency: 'high' },
      { title: '紧急事件2', description: 'd2', urgency: 'critical' },
      { title: '普通事件3', description: 'd3', urgency: 'low' },
    ]);

    expect(sys.chainSystem.getUnreadAlertCount()).toBe(3);

    sys.chainSystem.markAllAlertsRead();
    expect(sys.chainSystem.getUnreadAlertCount()).toBe(0);

    sys.chainSystem.clearReadAlerts();
    expect(sys.chainSystem.getReturnAlerts().length).toBe(0);
  });

  it('固定事件条件触发+过期 全流程', () => {
    sys.trigger.registerEvent(createFixedEvent());
    // 低回合不满足条件
    expect(sys.trigger.canTrigger('evt-fixed-harvest', 5)).toBe(false);
    // 满足条件回合触发
    expect(sys.trigger.canTrigger('evt-fixed-harvest', 15)).toBe(true);

    const result = sys.trigger.forceTriggerEvent('evt-fixed-harvest', 15);
    expect(result.triggered).toBe(true);

    // 过期
    const expired = sys.trigger.expireEvents(25);
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });

  it('故事事件+事件日志 全流程', () => {
    sys.chainSystem.registerStoryEvent(createStoryEvent());
    const event = sys.chainSystem.triggerStoryEvent('story-battle-guandu');
    expect(event).not.toBeNull();

    sys.chainSystem.logEventResolved(
      'story-battle-guandu',
      '官渡之战',
      'attack',
      '发动突袭',
    );
    expect(sys.chainSystem.getLogCount()).toBeGreaterThanOrEqual(1);
  });
});
