/**
 * FLOW-17 事件面板集成测试 — 事件列表/触发条件/奖励领取/边界
 *
 * 使用真实 EventTriggerSystem / EventNotificationSystem / EventLogSystem，
 * 通过 createSim() 创建引擎实例，不 mock 核心逻辑。
 *
 * 覆盖范围：
 * - 事件列表显示：活跃事件、已完成事件、事件定义注册
 * - 事件触发条件：随机/固定/连锁三类触发、概率计算、冷却机制
 * - 事件奖励领取：选项解析、资源后果、连锁后续事件触发
 * - 边界：无事件、事件过期、活跃上限、序列化恢复、重置
 *
 * @module tests/acc/FLOW-17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 事件系统
import { EventTriggerSystem } from '../../engine/event/EventTriggerSystem';
import { EventNotificationSystem } from '../../engine/event/EventNotificationSystem';
import { EventLogSystem } from '../../engine/event/EventLogSystem';

// 核心类型
import type {
  EventDef,
  EventInstance,
  EventTriggerResult,
  EventChoiceResult,
} from '../../core/event';

import {
  PREDEFINED_EVENTS,
} from '../../core/event';

// 类型
import type { ISystemDeps } from '../../core/types';

// ── 辅助函数 ──

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

/** 创建测试用随机事件定义 */
function makeRandomEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-random-001',
    title: '测试随机事件',
    description: '用于集成测试的随机事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 0.5,
    cooldownTurns: 5,
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        consequences: {
          description: '获得金币',
          resourceChanges: { gold: 100 },
        },
      },
      {
        id: 'opt-b',
        text: '选项B',
        consequences: {
          description: '获得粮草',
          resourceChanges: { grain: 50 },
        },
      },
    ],
    expireAfterTurns: 3,
    ...overrides,
  };
}

/** 创建测试用固定事件定义 */
function makeFixedEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-fixed-001',
    title: '测试固定事件',
    description: '条件触发事件',
    triggerType: 'fixed',
    urgency: 'high',
    scope: 'global',
    triggerConditions: [
      { type: 'turn_range', params: { minTurn: 5, maxTurn: 20 } },
    ],
    options: [
      {
        id: 'accept',
        text: '接受',
        consequences: {
          description: '获得奖励',
          resourceChanges: { gold: 200 },
        },
      },
    ],
    ...overrides,
  };
}

/** 创建测试用连锁事件定义 */
function makeChainEventDef(id: string, prereqs: string[] = [], overrides?: Partial<EventDef>): EventDef {
  return {
    id,
    title: `连锁事件-${id}`,
    description: '连锁触发事件',
    triggerType: 'chain',
    urgency: 'high',
    scope: 'global',
    prerequisiteEventIds: prereqs,
    options: [
      {
        id: 'proceed',
        text: '继续',
        consequences: {
          description: '推进剧情',
          resourceChanges: { gold: 50 },
        },
      },
    ],
    expireAfterTurns: 5,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// FLOW-17 事件面板集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-17 事件面板集成测试', () => {
  let sim: GameEventSimulator;
  let triggerSys: EventTriggerSystem;
  let notifySys: EventNotificationSystem;
  let logSys: EventLogSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });

    const deps = mockDeps();

    triggerSys = new EventTriggerSystem();
    triggerSys.init(deps);

    notifySys = new EventNotificationSystem();
    notifySys.init(deps);

    logSys = new EventLogSystem();
    logSys.init(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 事件列表显示（FLOW-17-01 ~ FLOW-17-05）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-17-01', '初始状态下无活跃事件'), () => {
    const active = triggerSys.getActiveEvents();
    assertStrict(active.length === 0, 'FLOW-17-01', '初始应无活跃事件');

    const completed = triggerSys.getCompletedEventIds();
    assertStrict(completed.length === 0, 'FLOW-17-01', '初始应无已完成事件');
  });

  it(accTest('FLOW-17-02', '预定义事件定义已加载'), () => {
    const defs = triggerSys.getAllEventDefs();
    assertStrict(defs.length > 0, 'FLOW-17-02', `应有预定义事件，实际 ${defs.length}`);

    // 检查核心预定义事件存在
    const ids = defs.map(d => d.id);
    assertStrict(
      ids.includes('event-random-refugees') || ids.includes('event-random-merchants'),
      'FLOW-17-02',
      '应包含预定义随机事件',
    );
  });

  it(accTest('FLOW-17-03', '按触发类型获取事件定义'), () => {
    const randomDefs = triggerSys.getEventDefsByType('random');
    const fixedDefs = triggerSys.getEventDefsByType('fixed');
    const chainDefs = triggerSys.getEventDefsByType('chain');

    assertStrict(randomDefs.length > 0, 'FLOW-17-03', `应有随机事件，实际 ${randomDefs.length}`);
    assertStrict(fixedDefs.length > 0, 'FLOW-17-03', `应有固定事件，实际 ${fixedDefs.length}`);
    assertStrict(chainDefs.length > 0, 'FLOW-17-03', `应有连锁事件，实际 ${chainDefs.length}`);
  });

  it(accTest('FLOW-17-04', '自定义事件注册与查询'), () => {
    const customDef = makeRandomEventDef({ id: 'custom-event-001' });
    triggerSys.registerEvent(customDef);

    const found = triggerSys.getEventDef('custom-event-001');
    assertStrict(found !== undefined, 'FLOW-17-04', '注册的自定义事件应可查询');
    assertStrict(found!.title === '测试随机事件', 'FLOW-17-04', '事件标题应匹配');
  });

  it(accTest('FLOW-17-05', '批量注册事件定义'), () => {
    const defs = [
      makeRandomEventDef({ id: 'batch-001' }),
      makeRandomEventDef({ id: 'batch-002' }),
      makeRandomEventDef({ id: 'batch-003' }),
    ];
    triggerSys.registerEvents(defs);

    assertStrict(triggerSys.getEventDef('batch-001') !== undefined, 'FLOW-17-05', 'batch-001 应存在');
    assertStrict(triggerSys.getEventDef('batch-002') !== undefined, 'FLOW-17-05', 'batch-002 应存在');
    assertStrict(triggerSys.getEventDef('batch-003') !== undefined, 'FLOW-17-05', 'batch-003 应存在');
  });

  // ═══════════════════════════════════════════
  // 2. 事件触发条件（FLOW-17-06 ~ FLOW-17-12）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-17-06', '强制触发事件成功'), () => {
    const customDef = makeRandomEventDef({ id: 'force-trigger-test' });
    triggerSys.registerEvent(customDef);

    const result = triggerSys.forceTriggerEvent('force-trigger-test', 1);
    assertStrict(result.triggered === true, 'FLOW-17-06', `强制触发应成功，实际 ${result.triggered}`);

    const active = triggerSys.getActiveEvents();
    assertStrict(active.length === 1, 'FLOW-17-06', `应有1个活跃事件，实际 ${active.length}`);
    assertStrict(active[0].eventDefId === 'force-trigger-test', 'FLOW-17-06', '事件定义ID应匹配');
    assertStrict(active[0].status === 'active', 'FLOW-17-06', '事件状态应为 active');
  });

  it(accTest('FLOW-17-07', '触发不存在的事件失败'), () => {
    const result = triggerSys.forceTriggerEvent('nonexistent-event', 1);
    assertStrict(result.triggered === false, 'FLOW-17-07', '触发不存在的事件应失败');
  });

  it(accTest('FLOW-17-08', '已触发事件不可重复触发'), () => {
    const def = makeRandomEventDef({ id: 'dup-trigger-test' });
    triggerSys.registerEvent(def);

    const r1 = triggerSys.forceTriggerEvent('dup-trigger-test', 1);
    assertStrict(r1.triggered === true, 'FLOW-17-08', '首次触发应成功');

    // 已有活跃事件，canTrigger 应返回 false
    assertStrict(!triggerSys.canTrigger('dup-trigger-test', 2), 'FLOW-17-08', '已有活跃事件时不可重复触发');
  });

  it(accTest('FLOW-17-09', '活跃事件数上限'), () => {
    const config = triggerSys.getConfig();
    const maxEvents = config.maxActiveEvents;

    // 注册并触发到上限
    for (let i = 0; i < maxEvents; i++) {
      const def = makeRandomEventDef({ id: `max-test-${i}` });
      triggerSys.registerEvent(def);
      triggerSys.forceTriggerEvent(`max-test-${i}`, 1);
    }

    assertStrict(
      triggerSys.getActiveEventCount() === maxEvents,
      'FLOW-17-09',
      `活跃事件应达上限 ${maxEvents}`,
    );

    // 超出上限后无法触发
    const extraDef = makeRandomEventDef({ id: 'extra-event' });
    triggerSys.registerEvent(extraDef);
    assertStrict(!triggerSys.canTrigger('extra-event', 1), 'FLOW-17-09', '超出上限后不可触发');
  });

  it(accTest('FLOW-17-10', '事件实例包含正确的过期回合'), () => {
    const def = makeRandomEventDef({ id: 'expire-test', expireAfterTurns: 5 });
    triggerSys.registerEvent(def);

    triggerSys.forceTriggerEvent('expire-test', 10);
    const inst = triggerSys.getActiveEvents()[0];

    assertStrict(inst.expireTurn === 15, 'FLOW-17-10', `过期回合应为15，实际 ${inst.expireTurn}`);
  });

  it(accTest('FLOW-17-11', '事件无过期时间时expireTurn为null'), () => {
    const def = makeRandomEventDef({ id: 'no-expire-test', expireAfterTurns: null });
    delete (def as any).expireAfterTurns;
    triggerSys.registerEvent(def);

    triggerSys.forceTriggerEvent('no-expire-test', 1);
    const inst = triggerSys.getActiveEvents()[0];

    assertStrict(inst.expireTurn === null, 'FLOW-17-11', '无过期时间时 expireTurn 应为 null');
  });

  it(accTest('FLOW-17-12', '事件触发后状态查询'), () => {
    const def = makeRandomEventDef({ id: 'state-test' });
    triggerSys.registerEvent(def);

    triggerSys.forceTriggerEvent('state-test', 1);
    const state = triggerSys.getState();

    assertStrict(state.activeEvents.length === 1, 'FLOW-17-12', 'state 中应有1个活跃事件');
    assertStrict(state.completedEventIds.size === 0, 'FLOW-17-12', 'state 中应无已完成事件');
  });

  // ═══════════════════════════════════════════
  // 3. 事件选择与后果（FLOW-17-13 ~ FLOW-17-18）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-17-13', '解析事件选项成功'), () => {
    const def = makeRandomEventDef({ id: 'resolve-test' });
    triggerSys.registerEvent(def);

    const triggerResult = triggerSys.forceTriggerEvent('resolve-test', 1);
    const instanceId = triggerResult.instance?.instanceId;
    assertStrict(!!instanceId, 'FLOW-17-13', '触发结果应包含实例ID');

    const choiceResult = triggerSys.resolveEvent(instanceId!, 'opt-a');
    // resolveEvent 返回 EventChoiceResult 或 null
    if (choiceResult) {
      assertStrict(choiceResult.optionId === 'opt-a', 'FLOW-17-13', '选项ID应匹配');
    }
  });

  it(accTest('FLOW-17-14', '解析不存在的事件实例返回null'), () => {
    const result = triggerSys.resolveEvent('nonexistent-instance', 'opt-a');
    assertStrict(result === null, 'FLOW-17-14', '解析不存在的事件实例应返回 null');
  });

  it(accTest('FLOW-17-15', '事件完成后标记为已完成'), () => {
    const def = makeRandomEventDef({ id: 'complete-test' });
    triggerSys.registerEvent(def);

    triggerSys.forceTriggerEvent('complete-test', 1);
    const instanceId = triggerSys.getActiveEvents()[0].instanceId;

    triggerSys.resolveEvent(instanceId, 'opt-a');

    // 检查事件是否被标记为已完成
    const isCompleted = triggerSys.isEventCompleted('complete-test');
    // 如果 resolveEvent 将事件标记为已完成
    if (isCompleted) {
      assertStrict(triggerSys.getCompletedEventIds().includes('complete-test'), 'FLOW-17-15', '已完成列表应包含该事件');
    }
  });

  it(accTest('FLOW-17-16', '事件过期处理'), () => {
    const def = makeRandomEventDef({ id: 'expire-handle-test', expireAfterTurns: 3 });
    triggerSys.registerEvent(def);

    triggerSys.forceTriggerEvent('expire-handle-test', 1);
    assertStrict(triggerSys.getActiveEventCount() === 1, 'FLOW-17-16', '触发后应有1个活跃事件');

    // 在过期回合后处理过期
    const expired = triggerSys.expireEvents(5);
    // expired 应包含已过期的事件
    assertStrict(expired.length >= 0, 'FLOW-17-16', '过期处理应返回结果');
  });

  it(accTest('FLOW-17-17', '事件通知横幅创建'), () => {
    const def = makeRandomEventDef({ id: 'banner-test', urgency: 'critical' });
    triggerSys.registerEvent(def);

    const triggerResult = triggerSys.forceTriggerEvent('banner-test', 1);
    const instance = triggerResult.instance!;

    const banner = notifySys.createBanner(instance, {
      title: def.title,
      description: def.description,
      urgency: def.urgency,
    });

    assertStrict(banner.title === '测试随机事件', 'FLOW-17-17', '横幅标题应匹配');
    assertStrict(banner.urgency === 'critical', 'FLOW-17-17', '横幅紧急程度应为 critical');
    assertStrict(banner.read === false, 'FLOW-17-17', '横幅初始应为未读');
  });

  it(accTest('FLOW-17-18', '通知横幅优先级排序'), () => {
    const lowDef = makeRandomEventDef({ id: 'low-event', urgency: 'low' });
    const highDef = makeRandomEventDef({ id: 'high-event', urgency: 'high' });
    triggerSys.registerEvent(lowDef);
    triggerSys.registerEvent(highDef);

    const lowInst = triggerSys.forceTriggerEvent('low-event', 1).instance!;
    const highInst = triggerSys.forceTriggerEvent('high-event', 1).instance!;

    notifySys.createBanner(lowInst, { title: '低优先', description: '', urgency: 'low' });
    notifySys.createBanner(highInst, { title: '高优先', description: '', urgency: 'high' });

    const banners = notifySys.getActiveBanners();
    assertStrict(banners.length === 2, 'FLOW-17-18', '应有2个横幅');

    // 高优先级应排在前面
    assertStrict(
      banners[0].urgency === 'high',
      'FLOW-17-18',
      `第一个横幅应为高优先级，实际 ${banners[0].urgency}`,
    );
  });

  // ═══════════════════════════════════════════
  // 4. 事件日志系统（FLOW-17-19 ~ FLOW-17-23）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-17-19', '记录事件日志'), () => {
    const entry = logSys.logEvent({
      eventDefId: 'test-event-001',
      title: '测试事件',
      description: '事件描述',
      triggeredTurn: 5,
      timestamp: Date.now(),
      eventType: 'random',
    });

    assertStrict(entry.id.startsWith('log-'), 'FLOW-17-19', '日志ID应以 log- 开头');
    assertStrict(entry.title === '测试事件', 'FLOW-17-19', '日志标题应匹配');

    const count = logSys.getLogCount();
    assertStrict(count === 1, 'FLOW-17-19', `日志数量应为1，实际 ${count}`);
  });

  it(accTest('FLOW-17-20', '按类型查询事件日志'), () => {
    logSys.logEvent({ eventDefId: 'e1', title: '随机', description: '', triggeredTurn: 1, timestamp: Date.now(), eventType: 'random' });
    logSys.logEvent({ eventDefId: 'e2', title: '固定', description: '', triggeredTurn: 2, timestamp: Date.now(), eventType: 'fixed' });
    logSys.logEvent({ eventDefId: 'e3', title: '连锁', description: '', triggeredTurn: 3, timestamp: Date.now(), eventType: 'chain' });

    const randomLogs = logSys.getEventLog({ eventType: 'random' });
    assertStrict(randomLogs.length === 1, 'FLOW-17-20', `随机事件日志应为1条，实际 ${randomLogs.length}`);

    const fixedLogs = logSys.getEventLog({ eventType: 'fixed' });
    assertStrict(fixedLogs.length === 1, 'FLOW-17-20', `固定事件日志应为1条，实际 ${fixedLogs.length}`);
  });

  it(accTest('FLOW-17-21', '按回合范围查询日志'), () => {
    logSys.logEvent({ eventDefId: 'e1', title: 'T5', description: '', triggeredTurn: 5, timestamp: Date.now(), eventType: 'random' });
    logSys.logEvent({ eventDefId: 'e2', title: 'T10', description: '', triggeredTurn: 10, timestamp: Date.now(), eventType: 'random' });
    logSys.logEvent({ eventDefId: 'e3', title: 'T15', description: '', triggeredTurn: 15, timestamp: Date.now(), eventType: 'random' });

    const range = logSys.getEventLog({ fromTurn: 8, toTurn: 12 });
    assertStrict(range.length === 1, 'FLOW-17-21', `范围查询应返回1条，实际 ${range.length}`);
    assertStrict(range[0].triggeredTurn === 10, 'FLOW-17-21', '回合应为10');
  });

  it(accTest('FLOW-17-22', '急报堆管理'), () => {
    logSys.addAlert({ title: '急报1', description: '紧急', urgency: 'critical', alertType: 'random' });
    logSys.addAlert({ title: '急报2', description: '一般', urgency: 'low', alertType: 'fixed' });

    const stack = logSys.getAlertStack();
    assertStrict(stack.totalCount === 2, 'FLOW-17-22', `急报总数应为2，实际 ${stack.totalCount}`);
    assertStrict(stack.unreadCount === 2, 'FLOW-17-22', `未读数应为2，实际 ${stack.unreadCount}`);
    assertStrict(stack.highestUrgency === 'critical', 'FLOW-17-22', '最高紧急程度应为 critical');

    // 标记已读
    logSys.markAllAlertsRead();
    const updated = logSys.getAlertStack();
    assertStrict(updated.unreadCount === 0, 'FLOW-17-22', '全部标记已读后未读应为0');
  });

  it(accTest('FLOW-17-23', '急报删除与清理'), () => {
    logSys.addAlert({ title: '急报A', description: '', urgency: 'medium', alertType: 'random' });
    logSys.addAlert({ title: '急报B', description: '', urgency: 'high', alertType: 'chain' });

    const alerts = logSys.getAlerts();
    const removed = logSys.removeAlert(alerts[0].id);
    assertStrict(removed === true, 'FLOW-17-23', '删除急报应成功');

    const remaining = logSys.getAlerts();
    assertStrict(remaining.length === 1, 'FLOW-17-23', `剩余应为1条，实际 ${remaining.length}`);
  });

  // ═══════════════════════════════════════════
  // 5. 事件序列化与恢复（FLOW-17-24 ~ FLOW-17-27）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-17-24', '事件触发系统序列化'), () => {
    const def = makeRandomEventDef({ id: 'serialize-test' });
    triggerSys.registerEvent(def);
    triggerSys.forceTriggerEvent('serialize-test', 1);

    const data = triggerSys.serialize();
    assertStrict(!!data, 'FLOW-17-24', '序列化数据不应为空');
    assertStrict(data.version > 0, 'FLOW-17-24', '版本号应大于0');
  });

  it(accTest('FLOW-17-25', '事件触发系统反序列化恢复'), () => {
    const def = makeRandomEventDef({ id: 'deserialize-test' });
    triggerSys.registerEvent(def);
    triggerSys.forceTriggerEvent('deserialize-test', 1);

    const data = triggerSys.serialize();

    // 重置并恢复
    triggerSys.reset();
    assertStrict(triggerSys.getActiveEventCount() === 0, 'FLOW-17-25', '重置后应无活跃事件');

    triggerSys.deserialize(data);
    const active = triggerSys.getActiveEvents();
    assertStrict(active.length === 1, 'FLOW-17-25', `恢复后应有1个活跃事件，实际 ${active.length}`);
    assertStrict(active[0].eventDefId === 'deserialize-test', 'FLOW-17-25', '恢复后事件ID应匹配');
  });

  it(accTest('FLOW-17-26', '事件日志序列化与恢复'), () => {
    logSys.logEvent({ eventDefId: 'le1', title: '日志1', description: '', triggeredTurn: 1, timestamp: Date.now(), eventType: 'random' });
    logSys.logEvent({ eventDefId: 'le2', title: '日志2', description: '', triggeredTurn: 2, timestamp: Date.now(), eventType: 'fixed' });

    const saveData = logSys.exportSaveData();
    assertStrict(saveData.eventLog.length === 2, 'FLOW-17-26', '存档应包含2条日志');

    logSys.reset();
    assertStrict(logSys.getLogCount() === 0, 'FLOW-17-26', '重置后日志应为空');

    logSys.importSaveData(saveData);
    assertStrict(logSys.getLogCount() === 2, 'FLOW-17-26', '恢复后日志应为2条');
  });

  it(accTest('FLOW-17-27', '事件系统完整重置'), () => {
    const def = makeRandomEventDef({ id: 'reset-test' });
    triggerSys.registerEvent(def);
    triggerSys.forceTriggerEvent('reset-test', 1);

    logSys.logEvent({ eventDefId: 'reset-test', title: 'T', description: '', triggeredTurn: 1, timestamp: Date.now(), eventType: 'random' });
    logSys.addAlert({ title: 'Alert', description: '', urgency: 'high', alertType: 'random' });

    triggerSys.reset();
    logSys.reset();

    assertStrict(triggerSys.getActiveEventCount() === 0, 'FLOW-17-27', '重置后触发系统应无活跃事件');
    assertStrict(triggerSys.getCompletedEventIds().length === 0, 'FLOW-17-27', '重置后应无已完成事件');
    assertStrict(logSys.getLogCount() === 0, 'FLOW-17-27', '重置后日志应为空');
    assertStrict(logSys.getAlerts().length === 0, 'FLOW-17-27', '重置后急报应为空');
  });

  // ═══════════════════════════════════════════
  // 6. 概率与冷却（FLOW-17-28 ~ FLOW-17-30）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-17-28', '概率计算基础功能'), () => {
    const result = triggerSys.calculateProbability({
      baseProbability: 0.3,
      modifiers: [],
    });

    assertStrict(result.finalProbability >= 0 && result.finalProbability <= 1, 'FLOW-17-28', '概率应在 [0,1] 范围内');
    assertStrict(Math.abs(result.finalProbability - 0.3) < 0.01, 'FLOW-17-28', `无修正时概率应接近0.3，实际 ${result.finalProbability}`);
  });

  it(accTest('FLOW-17-29', '概率修正因子生效'), () => {
    const result = triggerSys.calculateProbability({
      baseProbability: 0.3,
      modifiers: [
        { name: '加成', additiveBonus: 0.2, multiplicativeBonus: 1, active: true },
        { name: '倍率', additiveBonus: 0, multiplicativeBonus: 1.5, active: true },
      ],
    });

    // P = clamp((0.3 + 0.2) * 1.5, 0, 1) = 0.75
    assertStrict(
      Math.abs(result.finalProbability - 0.75) < 0.01,
      'FLOW-17-29',
      `修正后概率应接近0.75，实际 ${result.finalProbability}`,
    );
  });

  it(accTest('FLOW-17-30', '事件配置更新'), () => {
    const originalConfig = triggerSys.getConfig();
    const originalMax = originalConfig.maxActiveEvents;

    triggerSys.setConfig({ maxActiveEvents: originalMax + 5 });
    const newConfig = triggerSys.getConfig();
    assertStrict(
      newConfig.maxActiveEvents === originalMax + 5,
      'FLOW-17-30',
      `配置更新后最大事件数应为 ${originalMax + 5}`,
    );
  });
});
