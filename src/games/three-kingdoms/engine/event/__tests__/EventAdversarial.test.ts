/**
 * 事件模块对抗式测试 (3-Agent Adversarial Test)
 *
 * 5维度覆盖:
 *   F-Normal: 主线流程完整性
 *   F-Boundary: 边界条件覆盖
 *   F-Error: 异常路径覆盖
 *   F-Cross: 跨系统交互覆盖
 *   F-Lifecycle: 数据生命周期覆盖
 *
 * 目标系统: EventTriggerSystem, EventNotificationSystem, EventLogSystem,
 *           ChainEventSystem, StoryEventSystem, OfflineEventSystem
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../EventTriggerSystem';
import { EventNotificationSystem } from '../EventNotificationSystem';
import { EventLogSystem } from '../EventLogSystem';
import { ChainEventSystem } from '../ChainEventSystem';
import { StoryEventSystem } from '../StoryEventSystem';
import { OfflineEventSystem } from '../OfflineEventSystem';
import type { ISystemDeps } from '../../../core/types';
import type {
  EventDef,
  EventInstance,
  EventUrgency,
  EventTriggerType,
} from '../../../core/event';
import type {
  EventChainDef,
  ChainNodeDef,
} from '../chain-event-types';
import type {
  OfflineEventEntry,
  AutoProcessRule,
  AutoSelectStrategy,
} from '../../../core/event/event-offline.types';
import type { EventCategory } from '../../../core/event/event-shared.types';
import type { StoryEventDef } from '../StoryEventSystem';

// ═══════════════════════════════════════════════
// 辅助工具
// ═══════════════════════════════════════════════

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

function makeEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-test-01',
    title: '测试事件',
    description: '测试用',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    triggerProbability: 1,
    options: [
      { id: 'opt-a', text: 'A', consequences: { description: '选A', resourceChanges: { gold: 100 } } },
      { id: 'opt-b', text: 'B', isDefault: true, consequences: { description: '选B', resourceChanges: { gold: -50 } } },
    ],
    ...overrides,
  };
}

function makeChainDef(overrides: Partial<EventChainDef> = {}): EventChainDef {
  return {
    id: 'chain-test',
    name: '测试链',
    description: '测试用链',
    maxDepth: 3,
    nodes: [
      { id: 'node-0', eventDefId: 'evt-root', depth: 0 },
      { id: 'node-1a', eventDefId: 'evt-a', parentNodeId: 'node-0', parentOptionId: 'opt-a', depth: 1 },
      { id: 'node-1b', eventDefId: 'evt-b', parentNodeId: 'node-0', parentOptionId: 'opt-b', depth: 1 },
      { id: 'node-2', eventDefId: 'evt-c', parentNodeId: 'node-1a', parentOptionId: 'opt-a', depth: 2 },
    ],
    ...overrides,
  };
}

function makeStoryDef(overrides: Partial<StoryEventDef> = {}): StoryEventDef {
  return {
    id: 'story-test',
    title: '测试剧情',
    description: '测试用',
    era: 'test_era',
    order: 1,
    isKeyStory: true,
    triggerConditions: [{ type: 'turn_range', params: { minTurn: 1 } }],
    acts: [
      { id: 'act-1', title: '第一幕', storyLines: [{ speaker: '旁白', text: '测试' }] },
      { id: 'act-2', title: '第二幕', isFinal: true, storyLines: [{ speaker: '旁白', text: '结束' }] },
    ],
    ...overrides,
  };
}

function makeOfflineEntry(overrides: Partial<OfflineEventEntry> = {}): OfflineEventEntry {
  return {
    id: 'offline-1',
    eventId: 'evt-off-1',
    eventDefId: 'evt-off-1',
    title: '离线事件',
    description: '测试离线',
    urgency: 'medium',
    category: 'random' as EventCategory,
    triggeredAt: Date.now(),
    triggerTurn: 5,
    eventDef: makeEventDef({ id: 'evt-off-1' }),
    autoResult: null,
    autoProcessed: false,
    requiresManualAction: true,
    ...overrides,
  };
}

function makeAutoRule(overrides: Partial<AutoProcessRule> = {}): AutoProcessRule {
  return {
    id: 'rule-1',
    name: '测试规则',
    description: '自动处理低优先级',
    enabled: true,
    priority: 10,
    urgencyThreshold: 'high',
    applicableCategories: [],
    applicableEventIds: [],
    strategy: 'default_option' as AutoSelectStrategy,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// 1. EventTriggerSystem 对抗式测试
// ═══════════════════════════════════════════════

describe('EventTriggerSystem 对抗式测试', () => {
  let sys: EventTriggerSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    sys = new EventTriggerSystem();
    sys.init(deps);
  });

  // ─── F-Normal ───

  it('[F-Normal] 注册并获取事件定义', () => {
    const def = makeEventDef();
    sys.registerEvent(def);
    expect(sys.getEventDef(def.id)).toEqual(def);
    const allDefs = sys.getAllEventDefs();
    expect(allDefs.length).toBeGreaterThanOrEqual(1);
    expect(allDefs.some(d => d.id === def.id)).toBe(true);
  });

  it('[F-Normal] 批量注册事件', () => {
    const defs = [makeEventDef({ id: 'e1' }), makeEventDef({ id: 'e2' }), makeEventDef({ id: 'e3' })];
    sys.registerEvents(defs);
    expect(sys.getEventDef('e1')).toBeDefined();
    expect(sys.getEventDef('e2')).toBeDefined();
    expect(sys.getEventDef('e3')).toBeDefined();
  });

  it('[F-Normal] 按类型过滤事件定义', () => {
    sys.registerEvents([
      makeEventDef({ id: 'r1', triggerType: 'random' }),
      makeEventDef({ id: 'f1', triggerType: 'fixed' }),
      makeEventDef({ id: 'c1', triggerType: 'chain' }),
    ]);
    expect(sys.getEventDefsByType('random').length).toBeGreaterThanOrEqual(1);
    expect(sys.getEventDefsByType('fixed').length).toBeGreaterThanOrEqual(1);
    expect(sys.getEventDefsByType('chain').length).toBeGreaterThanOrEqual(1);
  });

  it('[F-Normal] forceTriggerEvent 成功触发', () => {
    const def = makeEventDef({ id: 'ft-1' });
    sys.registerEvent(def);
    const result = sys.forceTriggerEvent('ft-1', 1);
    expect(result.triggered).toBe(true);
    expect(result.instance).toBeDefined();
    expect(result.instance!.eventDefId).toBe('ft-1');
    expect(sys.hasActiveEvent('ft-1')).toBe(true);
  });

  it('[F-Normal] canTrigger 对未注册事件返回 false', () => {
    expect(sys.canTrigger('nonexistent', 1)).toBe(false);
  });

  it('[F-Normal] canTrigger 对已完成事件返回 false', () => {
    const def = makeEventDef({ id: 'done-1' });
    sys.registerEvent(def);
    sys.forceTriggerEvent('done-1', 1);
    sys.resolveEvent(sys.getActiveEvents()[0].instanceId, 'opt-a');
    expect(sys.isEventCompleted('done-1')).toBe(true);
    expect(sys.canTrigger('done-1', 5)).toBe(false);
  });

  it('[F-Normal] reset 清除所有状态', () => {
    sys.registerEvent(makeEventDef({ id: 'r-1' }));
    sys.forceTriggerEvent('r-1', 1);
    sys.reset();
    expect(sys.getActiveEventCount()).toBe(0);
    expect(sys.getCompletedEventIds()).toHaveLength(0);
  });

  it('[F-Normal] 序列化/反序列化保持一致性', () => {
    sys.registerEvent(makeEventDef({ id: 's-1' }));
    sys.forceTriggerEvent('s-1', 1);
    const data = sys.serialize();
    const sys2 = new EventTriggerSystem();
    sys2.init(deps);
    sys2.deserialize(data);
    expect(sys2.getActiveEventCount()).toBe(1);
    expect(sys2.getActiveEvents()[0].eventDefId).toBe('s-1');
  });

  // ─── F-Boundary ───

  it('[F-Boundary] 重复注册同一事件覆盖旧定义', () => {
    sys.registerEvent(makeEventDef({ id: 'dup', title: '旧' }));
    sys.registerEvent(makeEventDef({ id: 'dup', title: '新' }));
    expect(sys.getEventDef('dup')!.title).toBe('新');
  });

  it('[F-Boundary] forceTriggerEvent 不存在的 eventId', () => {
    const result = sys.forceTriggerEvent('ghost', 1);
    expect(result.triggered).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('[F-Boundary] 同一事件不可重复触发（已有活跃实例）', () => {
    sys.registerEvent(makeEventDef({ id: 'dup-trig' }));
    const r1 = sys.forceTriggerEvent('dup-trig', 1);
    expect(r1.triggered).toBe(true);
    const r2 = sys.forceTriggerEvent('dup-trig', 1);
    expect(r2.triggered).toBe(false);
  });

  it('[F-Boundary] resolveEvent 无效 instanceId 返回 null', () => {
    expect(sys.resolveEvent('nonexistent', 'opt-a')).toBeNull();
  });

  it('[F-Boundary] getInstance 不存在的实例', () => {
    expect(sys.getInstance('nope')).toBeUndefined();
  });

  it('[F-Boundary] getEventDef 不存在的ID', () => {
    expect(sys.getEventDef('no-such-id')).toBeUndefined();
  });

  it('[F-Boundary] setConfig 部分更新', () => {
    const oldConfig = sys.getConfig();
    sys.setConfig({ maxActiveEvents: 5 });
    expect(sys.getConfig().maxActiveEvents).toBe(5);
    expect(sys.getConfig().randomEventProbability).toBe(oldConfig.randomEventProbability);
  });

  // ─── F-Error ───

  it('[F-Error] 空 options 事件触发不崩溃', () => {
    const def = makeEventDef({ id: 'no-opts', options: [] });
    sys.registerEvent(def);
    expect(() => sys.forceTriggerEvent('no-opts', 1)).not.toThrow();
  });

  it('[F-Error] expireEvents 无活跃事件不崩溃', () => {
    expect(() => sys.expireEvents(999)).not.toThrow();
    expect(sys.expireEvents(999)).toEqual([]);
  });

  it('[F-Error] deserialize 空数据不崩溃', () => {
    const sys2 = new EventTriggerSystem();
    sys2.init(deps);
    expect(() => sys2.deserialize({} as any)).not.toThrow();
  });

  // ─── F-Lifecycle ───

  it('[F-Lifecycle] 事件完整生命周期: 注册→触发→选择→完成', () => {
    const def = makeEventDef({ id: 'lc-1' });
    sys.registerEvent(def);
    const trigger = sys.forceTriggerEvent('lc-1', 1);
    expect(trigger.triggered).toBe(true);
    const inst = trigger.instance!;
    const result = sys.resolveEvent(inst.instanceId, 'opt-a');
    expect(result).not.toBeNull();
    expect(sys.isEventCompleted('lc-1')).toBe(true);
    expect(sys.hasActiveEvent('lc-1')).toBe(false);
  });

  it('[F-Lifecycle] 概率条件注册与获取', () => {
    sys.registerProbabilityCondition('prob-1', {
      baseProbability: 0.5,
      modifiers: [{ type: 'additive', value: 0.1, active: true }],
    });
    const cond = sys.getProbabilityCondition('prob-1');
    expect(cond).toBeDefined();
    expect(cond!.baseProbability).toBe(0.5);
  });

  it('[F-Lifecycle] 概率条件不存在返回 undefined', () => {
    expect(sys.getProbabilityCondition('nope')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════
// 2. EventNotificationSystem 对抗式测试
// ═══════════════════════════════════════════════

describe('EventNotificationSystem 对抗式测试', () => {
  let sys: EventNotificationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    sys = new EventNotificationSystem();
    sys.init(deps);
  });

  const makeInstance = (): EventInstance => ({
    instanceId: 'inst-1',
    eventDefId: 'evt-1',
    triggeredTurn: 1,
    expireTurn: 10,
    status: 'active',
  });

  const makeEventDefForBanner = (urgency: EventUrgency = 'medium') => ({
    title: '测试横幅',
    description: '测试描述',
    urgency,
    options: [
      { id: 'opt-a', text: 'A', consequences: { description: 'A后果', resourceChanges: { gold: 100 } } },
    ],
  });

  // ─── F-Normal ───

  it('[F-Normal] 创建横幅并查询', () => {
    const banner = sys.createBanner(makeInstance(), makeEventDefForBanner());
    expect(banner.id).toBeDefined();
    expect(banner.title).toBe('测试横幅');
    expect(banner.read).toBe(false);
    expect(sys.getBanner(banner.id)).toBeDefined();
  });

  it('[F-Normal] 批量创建横幅', () => {
    const entries = [
      { instance: makeInstance(), eventDef: makeEventDefForBanner() },
      { instance: { ...makeInstance(), instanceId: 'inst-2' }, eventDef: makeEventDefForBanner('high') },
    ];
    const banners = sys.createBanners(entries);
    expect(banners).toHaveLength(2);
  });

  it('[F-Normal] 标记横幅已读', () => {
    const b = sys.createBanner(makeInstance(), makeEventDefForBanner());
    expect(sys.markBannerRead(b.id)).toBe(true);
    expect(sys.getBanner(b.id)!.read).toBe(true);
  });

  it('[F-Normal] 全部标记已读', () => {
    sys.createBanner(makeInstance(), makeEventDefForBanner());
    sys.createBanner({ ...makeInstance(), instanceId: 'inst-2' }, makeEventDefForBanner());
    sys.markAllBannersRead();
    expect(sys.getUnreadBanners()).toHaveLength(0);
  });

  it('[F-Normal] 删除横幅', () => {
    const b = sys.createBanner(makeInstance(), makeEventDefForBanner());
    expect(sys.removeBanner(b.id)).toBe(true);
    expect(sys.getBanner(b.id)).toBeUndefined();
  });

  it('[F-Normal] 创建遭遇弹窗并解决', () => {
    const popup = sys.createEncounterPopup(makeInstance(), {
      ...makeEventDefForBanner(),
      urgency: 'medium',
    });
    expect(popup.id).toBeDefined();
    expect(popup.options.length).toBeGreaterThan(0);
    const result = sys.resolveEncounter(popup.id, 'opt-a');
    expect(result).not.toBeNull();
    expect(result!.optionId).toBe('opt-a');
  });

  it('[F-Normal] 遭遇弹窗按实例查询', () => {
    const inst = makeInstance();
    const popup = sys.createEncounterPopup(inst, {
      ...makeEventDefForBanner(),
      urgency: 'medium',
    });
    expect(sys.getEncounterByInstance(inst.instanceId)).toBeDefined();
  });

  it('[F-Normal] 关闭非 critical 的遭遇弹窗', () => {
    const popup = sys.createEncounterPopup(makeInstance(), {
      ...makeEventDefForBanner(),
      urgency: 'medium',
    });
    expect(sys.dismissEncounter(popup.id)).toBe(true);
    expect(sys.getEncounterPopup(popup.id)).toBeUndefined();
  });

  // ─── F-Boundary ───

  it('[F-Boundary] critical 遭遇弹窗不可关闭', () => {
    const popup = sys.createEncounterPopup(makeInstance(), {
      ...makeEventDefForBanner(),
      urgency: 'critical',
    });
    expect(popup.dismissible).toBe(false);
    expect(sys.dismissEncounter(popup.id)).toBe(false);
  });

  it('[F-Boundary] 横幅优先级排序（critical > low）', () => {
    sys.createBanner(makeInstance(), makeEventDefForBanner('low'));
    sys.createBanner({ ...makeInstance(), instanceId: 'inst-c' }, makeEventDefForBanner('critical'));
    const active = sys.getActiveBanners();
    expect(active[0].urgency).toBe('critical');
  });

  it('[F-Boundary] 横幅过期清理', () => {
    const b = sys.createBanner(makeInstance(), makeEventDefForBanner());
    const expired = sys.expireBanners(100);
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });

  it('[F-Boundary] getBanner 不存在返回 undefined', () => {
    expect(sys.getBanner('no-such')).toBeUndefined();
  });

  it('[F-Boundary] markBannerRead 不存在返回 false', () => {
    expect(sys.markBannerRead('no-such')).toBe(false);
  });

  it('[F-Boundary] removeBanner 不存在返回 false', () => {
    expect(sys.removeBanner('no-such')).toBe(false);
  });

  it('[F-Boundary] resolveEncounter 无效ID返回 null', () => {
    expect(sys.resolveEncounter('no-such', 'opt-a')).toBeNull();
  });

  it('[F-Boundary] resolveEncounter 无效 optionId 返回 null', () => {
    const popup = sys.createEncounterPopup(makeInstance(), {
      ...makeEventDefForBanner(),
      urgency: 'medium',
    });
    expect(sys.resolveEncounter(popup.id, 'opt-nonexist')).toBeNull();
  });

  it('[F-Boundary] getBannerState 初始状态', () => {
    const state = sys.getBannerState();
    expect(state.activeBanners).toHaveLength(0);
    expect(state.hasUnread).toBe(false);
    expect(state.unreadCount).toBe(0);
  });

  // ─── F-Error ───

  it('[F-Error] reset 清除所有通知状态', () => {
    sys.createBanner(makeInstance(), makeEventDefForBanner());
    sys.createEncounterPopup(makeInstance(), { ...makeEventDefForBanner(), urgency: 'medium' });
    sys.reset();
    expect(sys.getActiveBanners()).toHaveLength(0);
    expect(sys.getActiveEncounters()).toHaveLength(0);
  });

  it('[F-Error] dismissEncounter 不存在返回 false', () => {
    expect(sys.dismissEncounter('no-such')).toBe(false);
  });

  // ─── F-Lifecycle ───

  it('[F-Lifecycle] 序列化/反序列化横幅', () => {
    sys.createBanner(makeInstance(), makeEventDefForBanner());
    const data = sys.exportSaveData();
    const sys2 = new EventNotificationSystem();
    sys2.init(deps);
    sys2.importSaveData(data);
    expect(sys2.getActiveBanners().length).toBeGreaterThanOrEqual(1);
  });

  it('[F-Lifecycle] 已解决遭遇可查询结果', () => {
    const popup = sys.createEncounterPopup(makeInstance(), {
      ...makeEventDefForBanner(),
      urgency: 'medium',
    });
    sys.resolveEncounter(popup.id, 'opt-a');
    const result = sys.getResolvedResult(popup.id);
    expect(result).not.toBeNull();
    expect(result!.optionId).toBe('opt-a');
  });

  it('[F-Lifecycle] getBannerIcon/getBannerColor 所有类型', () => {
    const types: Array<'info' | 'warning' | 'danger' | 'opportunity'> = ['info', 'warning', 'danger', 'opportunity'];
    for (const t of types) {
      expect(sys.getBannerIcon(t)).toBeDefined();
      expect(sys.getBannerColor(t)).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════
// 3. EventLogSystem 对抗式测试
// ═══════════════════════════════════════════════

describe('EventLogSystem 对抗式测试', () => {
  let sys: EventLogSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    sys = new EventLogSystem();
    sys.init(deps);
  });

  // ─── F-Normal ───

  it('[F-Normal] 记录事件日志', () => {
    const entry = sys.logEvent({
      eventDefId: 'evt-1',
      title: '测试日志',
      description: '日志描述',
      triggeredTurn: 1,
      timestamp: Date.now(),
      eventType: 'random',
    });
    expect(entry.id).toBeDefined();
    expect(sys.getLogCount()).toBe(1);
  });

  it('[F-Normal] 按类型查询日志', () => {
    sys.logEvent({ eventDefId: 'e1', title: 'A', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.logEvent({ eventDefId: 'e2', title: 'B', description: '', triggeredTurn: 2, timestamp: 0, eventType: 'fixed' });
    expect(sys.getLogCountByType('random')).toBe(1);
    expect(sys.getLogCountByType('fixed')).toBe(1);
  });

  it('[F-Normal] 按回合范围查询日志', () => {
    sys.logEvent({ eventDefId: 'e1', title: 'A', description: '', triggeredTurn: 3, timestamp: 0, eventType: 'random' });
    sys.logEvent({ eventDefId: 'e2', title: 'B', description: '', triggeredTurn: 7, timestamp: 0, eventType: 'random' });
    expect(sys.getEventLog({ fromTurn: 5 })).toHaveLength(1);
    expect(sys.getEventLog({ toTurn: 5 })).toHaveLength(1);
  });

  it('[F-Normal] 添加急报并查询', () => {
    const alert = sys.addAlert({ title: '急报', description: '紧急', urgency: 'high', alertType: 'random' });
    expect(alert.id).toBeDefined();
    expect(alert.read).toBe(false);
    expect(sys.getAlerts().length).toBe(1);
  });

  it('[F-Normal] 标记急报已读', () => {
    const a = sys.addAlert({ title: 'A', description: '', urgency: 'medium', alertType: 'random' });
    expect(sys.markAlertRead(a.id)).toBe(true);
    expect(sys.getUnreadAlertCount()).toBe(0);
  });

  it('[F-Normal] 急报按紧急程度排序', () => {
    sys.addAlert({ title: '低', description: '', urgency: 'low', alertType: 'random' });
    sys.addAlert({ title: '高', description: '', urgency: 'critical', alertType: 'random' });
    const alerts = sys.getAlerts();
    expect(alerts[0].urgency).toBe('critical');
  });

  // ─── F-Boundary ───

  it('[F-Boundary] 日志超过200条自动裁剪', () => {
    for (let i = 0; i < 210; i++) {
      sys.logEvent({ eventDefId: `e-${i}`, title: `T${i}`, description: '', triggeredTurn: i, timestamp: 0, eventType: 'random' });
    }
    expect(sys.getLogCount()).toBeLessThanOrEqual(200);
  });

  it('[F-Boundary] 急报超过50条自动裁剪', () => {
    for (let i = 0; i < 60; i++) {
      sys.addAlert({ title: `A${i}`, description: '', urgency: 'low', alertType: 'random' });
    }
    expect(sys.getAlerts().length).toBeLessThanOrEqual(50);
  });

  it('[F-Boundary] getRecentLogs 限制数量', () => {
    for (let i = 0; i < 10; i++) {
      sys.logEvent({ eventDefId: `e-${i}`, title: `T${i}`, description: '', triggeredTurn: i, timestamp: 0, eventType: 'random' });
    }
    expect(sys.getRecentLogs(3)).toHaveLength(3);
  });

  it('[F-Boundary] getLogEntry 不存在返回 undefined', () => {
    expect(sys.getLogEntry('no-such')).toBeUndefined();
  });

  it('[F-Boundary] markAlertRead 不存在返回 false', () => {
    expect(sys.markAlertRead('no-such')).toBe(false);
  });

  it('[F-Boundary] removeAlert 不存在返回 false', () => {
    expect(sys.removeAlert('no-such')).toBe(false);
  });

  // ─── F-Error ───

  it('[F-Error] logEventResolved 找不到已有日志时创建新条目', () => {
    const result = sys.logEventResolved('new-evt', '选项A', '结果A', 1, 2, 'random', '标题', '描述');
    expect(result).not.toBeNull();
    expect(result!.chosenOptionText).toBe('选项A');
  });

  it('[F-Error] clearReadAlerts 清除已读急报', () => {
    sys.addAlert({ title: 'A1', description: '', urgency: 'low', alertType: 'random' });
    sys.addAlert({ title: 'A2', description: '', urgency: 'low', alertType: 'random' });
    sys.markAllAlertsRead();
    sys.clearReadAlerts();
    expect(sys.getAlerts()).toHaveLength(0);
  });

  // ─── F-Lifecycle ───

  it('[F-Lifecycle] 序列化/反序列化日志和急报', () => {
    sys.logEvent({ eventDefId: 'e1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    sys.addAlert({ title: 'A', description: '', urgency: 'high', alertType: 'random' });
    const data = sys.exportSaveData();
    const sys2 = new EventLogSystem();
    sys2.init(deps);
    sys2.importSaveData(data);
    expect(sys2.getLogCount()).toBe(1);
    expect(sys2.getAlerts()).toHaveLength(1);
  });

  it('[F-Lifecycle] getAlertStack 返回完整状态', () => {
    sys.addAlert({ title: 'A', description: '', urgency: 'high', alertType: 'random' });
    const stack = sys.getAlertStack();
    expect(stack.totalCount).toBe(1);
    expect(stack.unreadCount).toBe(1);
    expect(stack.highestUrgency).toBe('high');
  });

  it('[F-Lifecycle] addOfflineAlerts 批量添加', () => {
    const alerts = sys.addOfflineAlerts([
      { title: 'A1', description: '', urgency: 'low' },
      { title: 'A2', description: '', urgency: 'high' },
    ]);
    expect(alerts).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════
// 4. ChainEventSystem 对抗式测试
// ═══════════════════════════════════════════════

describe('ChainEventSystem 对抗式测试', () => {
  let sys: ChainEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    sys = new ChainEventSystem();
    sys.init(deps);
  });

  // ─── F-Normal ───

  it('[F-Normal] 注册链并开始', () => {
    sys.registerChain(makeChainDef());
    const root = sys.startChain('chain-test');
    expect(root).not.toBeNull();
    expect(root!.depth).toBe(0);
    expect(sys.isChainStarted('chain-test')).toBe(true);
  });

  it('[F-Normal] 推进链到下一节点', () => {
    sys.registerChain(makeChainDef());
    sys.startChain('chain-test');
    const result = sys.advanceChain('chain-test', 'opt-a');
    expect(result.success).toBe(true);
    expect(result.currentNode).not.toBeNull();
    expect(result.currentNode!.depth).toBe(1);
  });

  it('[F-Normal] 链推进到完成', () => {
    sys.registerChain(makeChainDef());
    sys.startChain('chain-test');
    sys.advanceChain('chain-test', 'opt-a');
    sys.advanceChain('chain-test', 'opt-a');
    // node-2 之后没有后续节点，链完成
    const result = sys.advanceChain('chain-test', 'opt-a');
    expect(result.chainCompleted).toBe(true);
    expect(sys.isChainCompleted('chain-test')).toBe(true);
  });

  it('[F-Normal] 获取链进度统计', () => {
    sys.registerChain(makeChainDef());
    sys.startChain('chain-test');
    const stats = sys.getProgressStats('chain-test');
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(0);
  });

  it('[F-Normal] 获取下一节点列表', () => {
    sys.registerChain(makeChainDef());
    const nextNodes = sys.getNextNodes('chain-test', 'node-0');
    expect(nextNodes).toHaveLength(2);
  });

  // ─── F-Boundary ───

  it('[F-Boundary] maxDepth 超过5抛出错误', () => {
    expect(() => sys.registerChain(makeChainDef({ maxDepth: 6 }))).toThrow();
  });

  it('[F-Boundary] 节点深度超过 maxDepth 抛出错误', () => {
    const def = makeChainDef({
      maxDepth: 1,
      nodes: [
        { id: 'n0', eventDefId: 'e0', depth: 0 },
        { id: 'n1', eventDefId: 'e1', depth: 2 },
      ],
    });
    expect(() => sys.registerChain(def)).toThrow();
  });

  it('[F-Boundary] startChain 不存在的链返回 null', () => {
    expect(sys.startChain('no-such')).toBeNull();
  });

  it('[F-Boundary] advanceChain 未开始的链返回失败', () => {
    sys.registerChain(makeChainDef());
    const result = sys.advanceChain('chain-test', 'opt-a');
    expect(result.success).toBe(false);
  });

  it('[F-Boundary] advanceChain 已完成的链返回失败', () => {
    sys.registerChain(makeChainDef());
    sys.startChain('chain-test');
    // 推进到完成
    sys.advanceChain('chain-test', 'opt-a');
    sys.advanceChain('chain-test', 'opt-a');
    sys.advanceChain('chain-test', 'opt-a');
    const result = sys.advanceChain('chain-test', 'opt-a');
    expect(result.success).toBe(false);
    expect(result.chainCompleted).toBe(true);
  });

  it('[F-Boundary] getCurrentNode 未开始链返回 null', () => {
    sys.registerChain(makeChainDef());
    expect(sys.getCurrentNode('chain-test')).toBeNull();
  });

  it('[F-Boundary] getProgress 不存在的链返回 undefined', () => {
    expect(sys.getProgress('no-such')).toBeUndefined();
  });

  // ─── F-Lifecycle ───

  it('[F-Lifecycle] 序列化/反序列化链进度', () => {
    sys.registerChain(makeChainDef());
    sys.startChain('chain-test');
    sys.advanceChain('chain-test', 'opt-a');
    const data = sys.exportSaveData();
    const sys2 = new ChainEventSystem();
    sys2.init(deps);
    sys2.registerChain(makeChainDef());
    sys2.importSaveData(data);
    expect(sys2.isChainStarted('chain-test')).toBe(true);
    const progress = sys2.getProgress('chain-test');
    expect(progress!.completedNodeIds.size).toBe(1);
  });

  it('[F-Lifecycle] reset 清除所有链和进度', () => {
    sys.registerChain(makeChainDef());
    sys.startChain('chain-test');
    sys.reset();
    expect(sys.getAllChains()).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════
// 5. StoryEventSystem 对抗式测试
// ═══════════════════════════════════════════════

describe('StoryEventSystem 对抗式测试', () => {
  let sys: StoryEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    sys = new StoryEventSystem();
    sys.init(deps);
  });

  // ─── F-Normal ───

  it('[F-Normal] 默认加载预定义剧情', () => {
    const stories = sys.getAllStories();
    expect(stories.length).toBeGreaterThanOrEqual(3);
  });

  it('[F-Normal] 触发剧情', () => {
    const story = sys.triggerStory('story-yellow-turban');
    expect(story).not.toBeNull();
    expect(story!.id).toBe('story-yellow-turban');
    expect(sys.isStoryTriggered('story-yellow-turban')).toBe(true);
  });

  it('[F-Normal] 推进剧情到下一幕', () => {
    sys.triggerStory('story-yellow-turban');
    const result = sys.advanceStory('story-yellow-turban');
    expect(result.success).toBe(true);
    expect(result.currentAct).not.toBeNull();
  });

  it('[F-Normal] 推进剧情到完成', () => {
    sys.triggerStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban'); // act-1 → act-2
    const result = sys.advanceStory('story-yellow-turban'); // act-2 → 完成
    expect(result.storyCompleted).toBe(true);
    expect(sys.isStoryCompleted('story-yellow-turban')).toBe(true);
  });

  it('[F-Normal] 前置剧情检查', () => {
    // 董卓进京需要先完成黄巾之乱
    expect(sys.canTriggerStory('story-dong-zhuo', 10)).toBe(false);
    sys.triggerStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    expect(sys.canTriggerStory('story-dong-zhuo', 10)).toBe(true);
  });

  it('[F-Normal] getAvailableStories 按条件过滤', () => {
    const available = sys.getAvailableStories(1);
    expect(available.length).toBeGreaterThanOrEqual(1);
    expect(available[0].id).toBe('story-yellow-turban');
  });

  it('[F-Normal] 按时代查询剧情', () => {
    const stories = sys.getStoriesByEra('yellow_turban');
    expect(stories.length).toBeGreaterThanOrEqual(1);
  });

  // ─── F-Boundary ───

  it('[F-Boundary] triggerStory 不存在返回 null', () => {
    expect(sys.triggerStory('no-such')).toBeNull();
  });

  it('[F-Boundary] 重复触发同一剧情返回 null', () => {
    sys.triggerStory('story-yellow-turban');
    expect(sys.triggerStory('story-yellow-turban')).toBeNull();
  });

  it('[F-Boundary] advanceStory 未触发的剧情返回失败', () => {
    const result = sys.advanceStory('story-yellow-turban');
    expect(result.success).toBe(false);
  });

  it('[F-Boundary] advanceStory 已完成的剧情返回失败', () => {
    sys.triggerStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    const result = sys.advanceStory('story-yellow-turban');
    expect(result.success).toBe(false);
    expect(result.storyCompleted).toBe(true);
  });

  it('[F-Boundary] getCurrentAct 未触发返回 null', () => {
    expect(sys.getCurrentAct('story-yellow-turban')).toBeNull();
  });

  it('[F-Boundary] getProgressStats 不存在的剧情', () => {
    const stats = sys.getProgressStats('no-such');
    expect(stats.completed).toBe(0);
    expect(stats.total).toBe(0);
  });

  // ─── F-Cross ───

  it('[F-Cross] 剧情链依赖: 黄巾→董卓→官渡顺序完成', () => {
    // 黄巾
    sys.triggerStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    expect(sys.isStoryCompleted('story-yellow-turban')).toBe(true);

    // 董卓
    expect(sys.canTriggerStory('story-dong-zhuo', 10)).toBe(true);
    sys.triggerStory('story-dong-zhuo');
    sys.advanceStory('story-dong-zhuo');
    sys.advanceStory('story-dong-zhuo');
    expect(sys.isStoryCompleted('story-dong-zhuo')).toBe(true);

    // 官渡
    expect(sys.canTriggerStory('story-guan-du', 10)).toBe(true);
    sys.triggerStory('story-guan-du');
    sys.advanceStory('story-guan-du');
    sys.advanceStory('story-guan-du');
    expect(sys.isStoryCompleted('story-guan-du')).toBe(true);
  });

  // ─── F-Lifecycle ───

  it('[F-Lifecycle] 序列化/反序列化剧情进度', () => {
    sys.triggerStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    const data = sys.exportSaveData();
    const sys2 = new StoryEventSystem();
    sys2.init(deps);
    sys2.importSaveData(data);
    expect(sys2.isStoryTriggered('story-yellow-turban')).toBe(true);
  });

  it('[F-Lifecycle] 自定义剧情注册与触发', () => {
    const custom: StoryEventDef = makeStoryDef({ id: 'custom-1', triggerConditions: [{ type: 'turn_range', params: { minTurn: 1 } }] });
    sys.registerStory(custom);
    expect(sys.getStory('custom-1')).toBeDefined();
    expect(sys.canTriggerStory('custom-1', 1)).toBe(true);
  });

  it('[F-Lifecycle] getCompletedStories/getActiveStories', () => {
    sys.triggerStory('story-yellow-turban');
    expect(sys.getActiveStories().length).toBeGreaterThanOrEqual(1);
    expect(sys.getCompletedStories()).toHaveLength(0);
    sys.advanceStory('story-yellow-turban');
    sys.advanceStory('story-yellow-turban');
    expect(sys.getCompletedStories().length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════
// 6. OfflineEventSystem 对抗式测试
// ═══════════════════════════════════════════════

describe('OfflineEventSystem 对抗式测试', () => {
  let sys: OfflineEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    sys = new OfflineEventSystem();
    sys.init(deps);
  });

  // ─── F-Normal ───

  it('[F-Normal] 添加离线事件到队列', () => {
    const entry = sys.addOfflineEvent(makeOfflineEntry());
    expect(entry.id).toBeDefined();
    expect(entry.autoProcessed).toBe(false);
    expect(sys.getQueueSize()).toBe(1);
  });

  it('[F-Normal] 注册事件定义并自动处理', () => {
    const def = makeEventDef({ id: 'auto-evt' });
    sys.registerEventDef(def);
    sys.registerAutoRule(makeAutoRule({ strategy: 'default_option' }));
    sys.addOfflineEvent(makeOfflineEntry({
      eventDefId: 'auto-evt',
      eventDef: def,
      requiresManualAction: false,
      urgency: 'low',
    }));
    const result = sys.processOfflineEvents();
    expect(result.autoProcessedCount).toBe(1);
  });

  it('[F-Normal] 手动处理离线事件', () => {
    const def = makeEventDef({ id: 'manual-evt' });
    sys.registerEventDef(def);
    const entry = sys.addOfflineEvent(makeOfflineEntry({
      eventDefId: 'manual-evt',
      eventDef: def,
      requiresManualAction: true,
    }));
    const result = sys.manualProcessEvent(entry.id, 'opt-a');
    expect(result).not.toBeNull();
    expect(sys.getQueueSize()).toBe(0);
  });

  it('[F-Normal] 获取待处理和已处理事件', () => {
    sys.addOfflineEvent(makeOfflineEntry({ requiresManualAction: true }));
    sys.addOfflineEvent(makeOfflineEntry({ id: 'off-2', eventId: 'e2', eventDefId: 'e2', requiresManualAction: false }));
    expect(sys.getPendingEvents()).toHaveLength(1);
  });

  it('[F-Normal] 启用/禁用规则', () => {
    sys.registerAutoRule(makeAutoRule({ id: 'r1' }));
    sys.setRuleEnabled('r1', false);
    expect(sys.getAutoRule('r1')!.enabled).toBe(false);
  });

  it('[F-Normal] 移除规则', () => {
    sys.registerAutoRule(makeAutoRule({ id: 'r1' }));
    sys.removeAutoRule('r1');
    expect(sys.getAutoRule('r1')).toBeUndefined();
  });

  // ─── F-Boundary ───

  it('[F-Boundary] 队列超过50自动裁剪', () => {
    for (let i = 0; i < 55; i++) {
      sys.addOfflineEvent(makeOfflineEntry({
        id: `off-${i}`,
        eventId: `e-${i}`,
        eventDefId: `e-${i}`,
        eventDef: makeEventDef({ id: `e-${i}` }),
      }));
    }
    expect(sys.getQueueSize()).toBeLessThanOrEqual(50);
  });

  it('[F-Boundary] manualProcessEvent 不存在返回 null', () => {
    expect(sys.manualProcessEvent('no-such', 'opt-a')).toBeNull();
  });

  it('[F-Boundary] manualProcessEvent 无效选项返回 null', () => {
    const def = makeEventDef({ id: 'inv-opt' });
    sys.registerEventDef(def);
    const entry = sys.addOfflineEvent(makeOfflineEntry({ eventDefId: 'inv-opt', eventDef: def }));
    expect(sys.manualProcessEvent(entry.id, 'nonexistent-opt')).toBeNull();
  });

  it('[F-Boundary] clearQueue 清空队列', () => {
    sys.addOfflineEvent(makeOfflineEntry());
    sys.clearQueue();
    expect(sys.getQueueSize()).toBe(0);
  });

  it('[F-Boundary] getAutoRule 不存在返回 undefined', () => {
    expect(sys.getAutoRule('no-such')).toBeUndefined();
  });

  it('[F-Boundary] processOfflineEvents 空队列', () => {
    const result = sys.processOfflineEvents();
    expect(result.autoProcessedCount).toBe(0);
    expect(result.manualRequiredCount).toBe(0);
  });

  // ─── F-Error ───

  it('[F-Error] generateRetrospective 空队列不崩溃', () => {
    const retro = sys.generateRetrospective();
    expect(retro.timeline).toHaveLength(0);
    expect(retro.totalResourceChanges).toEqual({});
  });

  it('[F-Error] reset 清除所有状态', () => {
    sys.registerAutoRule(makeAutoRule());
    sys.addOfflineEvent(makeOfflineEntry());
    sys.reset();
    expect(sys.getQueueSize()).toBe(0);
    expect(sys.getAllAutoRules()).toHaveLength(0);
  });

  // ─── F-Cross ───

  it('[F-Cross] best_outcome 策略选择最大收益选项', () => {
    const def = makeEventDef({
      id: 'best-evt',
      options: [
        { id: 'opt-low', text: '低收益', consequences: { description: '低', resourceChanges: { gold: 10 } } },
        { id: 'opt-high', text: '高收益', consequences: { description: '高', resourceChanges: { gold: 500 } } },
      ],
    });
    sys.registerEventDef(def);
    sys.registerAutoRule(makeAutoRule({ strategy: 'best_outcome' }));
    sys.addOfflineEvent(makeOfflineEntry({
      eventDefId: 'best-evt',
      eventDef: def,
      requiresManualAction: false,
      urgency: 'low',
    }));
    const result = sys.processOfflineEvents();
    expect(result.autoProcessedCount).toBe(1);
    expect(result.processedEntries[0].selectedOptionId).toBe('opt-high');
  });

  it('[F-Cross] safest 策略选择最小损失选项', () => {
    const def = makeEventDef({
      id: 'safe-evt',
      options: [
        { id: 'opt-risk', text: '冒险', consequences: { description: '风险', resourceChanges: { gold: 1000, troops: -500 } } },
        { id: 'opt-safe', text: '安全', consequences: { description: '安全', resourceChanges: { gold: 50 } } },
      ],
    });
    sys.registerEventDef(def);
    sys.registerAutoRule(makeAutoRule({ strategy: 'safest' }));
    sys.addOfflineEvent(makeOfflineEntry({
      eventDefId: 'safe-evt',
      eventDef: def,
      requiresManualAction: false,
      urgency: 'low',
    }));
    const result = sys.processOfflineEvents();
    expect(result.processedEntries[0].selectedOptionId).toBe('opt-safe');
  });

  it('[F-Cross] 高紧急度事件不自动处理（规则阈值）', () => {
    const def = makeEventDef({ id: 'crit-evt' });
    sys.registerEventDef(def);
    sys.registerAutoRule(makeAutoRule({ urgencyThreshold: 'high' }));
    sys.addOfflineEvent(makeOfflineEntry({
      eventDefId: 'crit-evt',
      eventDef: def,
      requiresManualAction: false,
      urgency: 'critical',
    }));
    const result = sys.processOfflineEvents();
    expect(result.autoProcessedCount).toBe(0);
    expect(result.manualRequiredCount).toBe(1);
  });

  // ─── F-Lifecycle ───

  it('[F-Lifecycle] 序列化/反序列化离线事件', () => {
    sys.registerAutoRule(makeAutoRule());
    sys.addOfflineEvent(makeOfflineEntry());
    const data = sys.exportSaveData();
    const sys2 = new OfflineEventSystem();
    sys2.init(deps);
    sys2.importSaveData(data);
    expect(sys2.getQueueSize()).toBe(1);
    expect(sys2.getAllAutoRules()).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════
// 7. 跨系统交互对抗式测试
// ═══════════════════════════════════════════════

describe('跨系统交互对抗式测试', () => {
  let triggerSys: EventTriggerSystem;
  let notifSys: EventNotificationSystem;
  let logSys: EventLogSystem;
  let chainSys: ChainEventSystem;
  let storySys: StoryEventSystem;
  let offlineSys: OfflineEventSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    triggerSys = new EventTriggerSystem();
    triggerSys.init(deps);
    notifSys = new EventNotificationSystem();
    notifSys.init(deps);
    logSys = new EventLogSystem();
    logSys.init(deps);
    chainSys = new ChainEventSystem();
    chainSys.init(deps);
    storySys = new StoryEventSystem();
    storySys.init(deps);
    offlineSys = new OfflineEventSystem();
    offlineSys.init(deps);
  });

  it('[F-Cross] 触发→通知→日志完整流程', () => {
    const def = makeEventDef({ id: 'cross-1', urgency: 'high' });
    triggerSys.registerEvent(def);
    const triggerResult = triggerSys.forceTriggerEvent('cross-1', 1);
    expect(triggerResult.triggered).toBe(true);

    const inst = triggerResult.instance!;
    const banner = notifSys.createBanner(inst, {
      title: def.title,
      description: def.description,
      urgency: def.urgency,
    });
    expect(banner).toBeDefined();

    logSys.logEvent({
      eventDefId: def.id,
      title: def.title,
      description: def.description,
      triggeredTurn: 1,
      timestamp: Date.now(),
      eventType: 'random',
    });
    expect(logSys.getLogCount()).toBe(1);
  });

  it('[F-Cross] 链事件→触发→日志联动', () => {
    const chainDef = makeChainDef();
    chainSys.registerChain(chainDef);

    const root = chainSys.startChain('chain-test');
    expect(root).not.toBeNull();

    logSys.logEvent({
      eventDefId: root!.eventDefId,
      title: '链事件触发',
      description: '链根节点触发',
      triggeredTurn: 1,
      timestamp: Date.now(),
      eventType: 'chain',
    });
    expect(logSys.getLogCountByType('chain')).toBe(1);

    const advance = chainSys.advanceChain('chain-test', 'opt-a');
    expect(advance.success).toBe(true);
  });

  it('[F-Cross] 剧情完成→触发后续事件→记录日志', () => {
    storySys.triggerStory('story-yellow-turban');
    storySys.advanceStory('story-yellow-turban');
    storySys.advanceStory('story-yellow-turban');

    logSys.logEvent({
      eventDefId: 'story-yellow-turban',
      title: '黄巾之乱完成',
      description: '剧情完成',
      triggeredTurn: 5,
      timestamp: Date.now(),
      eventType: 'story',
    });
    expect(logSys.getLogCountByType('story')).toBe(1);
    expect(storySys.isStoryCompleted('story-yellow-turban')).toBe(true);
  });

  it('[F-Cross] 离线事件→急报堆→日志回溯', () => {
    const def = makeEventDef({ id: 'off-cross' });
    offlineSys.registerEventDef(def);
    offlineSys.addOfflineEvent(makeOfflineEntry({
      eventDefId: 'off-cross',
      eventDef: def,
      urgency: 'high',
    }));

    const retro = offlineSys.generateRetrospective();
    expect(retro.timeline.length).toBeGreaterThanOrEqual(1);

    logSys.addOfflineAlerts(
      retro.offlineEvents.map(e => ({ title: e.title, description: e.description, urgency: e.urgency as 'low' | 'medium' | 'high' | 'critical' }))
    );
    expect(logSys.getAlerts().length).toBeGreaterThanOrEqual(1);
  });

  it('[F-Cross] 全系统 reset 后状态干净', () => {
    triggerSys.registerEvent(makeEventDef({ id: 'all-1' }));
    triggerSys.forceTriggerEvent('all-1', 1);
    notifSys.createBanner(
      { instanceId: 'inst-1', eventDefId: 'all-1', triggeredTurn: 1, expireTurn: 10, status: 'active' },
      { title: 'T', description: 'D', urgency: 'medium' },
    );
    logSys.logEvent({ eventDefId: 'all-1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
    chainSys.registerChain(makeChainDef());
    chainSys.startChain('chain-test');
    offlineSys.addOfflineEvent(makeOfflineEntry());

    triggerSys.reset();
    notifSys.reset();
    logSys.reset();
    chainSys.reset();
    offlineSys.reset();

    expect(triggerSys.getActiveEventCount()).toBe(0);
    expect(notifSys.getActiveBanners()).toHaveLength(0);
    expect(logSys.getLogCount()).toBe(0);
    expect(chainSys.getAllChains()).toHaveLength(0);
    expect(offlineSys.getQueueSize()).toBe(0);
  });

  it('[F-Cross] 多系统序列化→反序列化一致性', () => {
    const def = makeEventDef({ id: 'ser-1' });
    triggerSys.registerEvent(def);
    triggerSys.forceTriggerEvent('ser-1', 1);

    notifSys.createBanner(
      triggerSys.getActiveEvents()[0],
      { title: 'T', description: 'D', urgency: 'high' },
    );

    logSys.logEvent({ eventDefId: 'ser-1', title: 'T', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });

    const tData = triggerSys.serialize();
    const nData = notifSys.exportSaveData();
    const lData = logSys.exportSaveData();

    const t2 = new EventTriggerSystem(); t2.init(deps); t2.deserialize(tData);
    const n2 = new EventNotificationSystem(); n2.init(deps); n2.importSaveData(nData);
    const l2 = new EventLogSystem(); l2.init(deps); l2.importSaveData(lData);

    expect(t2.getActiveEventCount()).toBe(1);
    expect(n2.getActiveBanners().length).toBeGreaterThanOrEqual(1);
    expect(l2.getLogCount()).toBe(1);
  });
});
