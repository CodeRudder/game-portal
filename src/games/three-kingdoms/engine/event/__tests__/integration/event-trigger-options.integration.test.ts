/**
 * 集成测试 — 事件触发 + 选项后果 + 急报横幅 + 事件日志
 *
 * 覆盖 §1.1~1.6：
 *   §1.1 事件注册与触发条件判定
 *   §1.2 选项选择与后果执行
 *   §1.3 概率后果计算
 *   §1.4 急报横幅系统
 *   §1.5 事件日志记录
 *   §1.6 跨系统联动（触发→横幅→日志）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../EventTriggerSystem';
import { EventNotificationSystem } from '../../EventNotificationSystem';
import { EventLogSystem } from '../../EventLogSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { EventDef, EventInstance } from '../../../../core/event';

// ─────────────────────────────────────────────
// 辅助工具
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

/** 构造一个固定事件定义 */
function makeFixedEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-fixed-1',
    title: '天降祥瑞',
    description: '百姓称颂',
    triggerType: 'fixed',
    urgency: 'medium',
    scope: 'global',
    triggerConditions: [{ type: 'turn_range', params: { minTurn: 5 } }],
    options: [
      { id: 'accept', text: '接受祝福', consequences: { description: '金币+100', resourceChanges: { gold: 100 } } },
      { id: 'reject', text: '婉拒', consequences: { description: '士气+10', resourceChanges: { morale: 10 } } },
    ],
    expireAfterTurns: 3,
    ...overrides,
  };
}

/** 构造一个随机事件定义 */
function makeRandomEvent(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'evt-random-1',
    title: '流民投奔',
    description: '一群流民请求收留',
    triggerType: 'random',
    urgency: 'low',
    scope: 'global',
    triggerProbability: 0.5,
    options: [
      { id: 'accept', text: '收留', consequences: { description: '人口+50 粮草-30', resourceChanges: { troops: 50, grain: -30 } } },
      { id: 'refuse', text: '拒绝', consequences: { description: '无变化', resourceChanges: {} } },
    ],
    ...overrides,
  };
}

/** 创建完整的三系统联动环境 */
function createTestEnv() {
  const deps = mockDeps();
  const trigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const log = new EventLogSystem();

  trigger.init(deps);
  notification.init(deps);
  log.init(deps);

  return { deps, trigger, notification, log };
}

// ═══════════════════════════════════════════════════════════

describe('§1 事件触发+选项+后果+日志 集成', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  // ═══════════════════════════════════════════
  // §1.1 事件注册与触发条件判定
  // ═══════════════════════════════════════════
  describe('§1.1 事件注册与触发条件判定', () => {
    it('注册事件后可通过 getEventDef 获取', () => {
      const def = makeFixedEvent();
      env.trigger.registerEvent(def);
      expect(env.trigger.getEventDef('evt-fixed-1')).toEqual(def);
    });

    it('批量注册事件', () => {
      const before = env.trigger.getAllEventDefs().length;
      const defs = [makeFixedEvent({ id: 'a' }), makeFixedEvent({ id: 'b' })];
      env.trigger.registerEvents(defs);
      expect(env.trigger.getAllEventDefs()).toHaveLength(before + 2);
    });

    it('固定事件在条件满足时 canTrigger=true', () => {
      env.trigger.registerEvent(makeFixedEvent());
      // turn_range minTurn=5
      expect(env.trigger.canTrigger('evt-fixed-1', 5)).toBe(true);
      expect(env.trigger.canTrigger('evt-fixed-1', 10)).toBe(true);
    });

    it('固定事件在条件不满足时 canTrigger=false', () => {
      env.trigger.registerEvent(makeFixedEvent());
      expect(env.trigger.canTrigger('evt-fixed-1', 4)).toBe(false);
    });

    it('已完成事件不再触发', () => {
      env.trigger.registerEvent(makeFixedEvent());
      // 强制触发并解决
      env.trigger.forceTriggerEvent('evt-fixed-1', 5);
      env.trigger.resolveEvent('event-inst-1', 'accept');
      expect(env.trigger.canTrigger('evt-fixed-1', 10)).toBe(false);
    });

    it('活跃事件数达上限时不再触发', () => {
      env.trigger.setConfig({ maxActiveEvents: 1 });
      env.trigger.registerEvent(makeFixedEvent({ id: 'e1' }));
      env.trigger.registerEvent(makeFixedEvent({ id: 'e2' }));
      env.trigger.forceTriggerEvent('e1', 5);
      expect(env.trigger.canTrigger('e2', 5)).toBe(false);
    });

    it('按触发类型查询事件定义', () => {
      env.trigger.registerEvent(makeFixedEvent());
      env.trigger.registerEvent(makeRandomEvent());
      const fixed = env.trigger.getEventDefsByType('fixed');
      const random = env.trigger.getEventDefsByType('random');
      // 包含预定义事件，至少各有1个
      expect(fixed.length).toBeGreaterThanOrEqual(1);
      expect(random.length).toBeGreaterThanOrEqual(1);
      // 确保刚注册的事件在结果中
      expect(fixed.some(d => d.id === 'evt-fixed-1')).toBe(true);
      expect(random.some(d => d.id === 'evt-random-1')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // §1.2 选项选择与后果执行
  // ═══════════════════════════════════════════
  describe('§1.2 选项选择与后果执行', () => {
    it('forceTriggerEvent 返回触发结果含实例', () => {
      env.trigger.registerEvent(makeFixedEvent());
      const result = env.trigger.forceTriggerEvent('evt-fixed-1', 5);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe('evt-fixed-1');
      expect(result.instance!.status).toBe('active');
    });

    it('resolveEvent 返回选择结果含后果', () => {
      env.trigger.registerEvent(makeFixedEvent());
      const trig = env.trigger.forceTriggerEvent('evt-fixed-1', 5);
      const instId = trig.instance!.instanceId;
      const choice = env.trigger.resolveEvent(instId, 'accept');
      expect(choice).not.toBeNull();
      expect(choice!.optionId).toBe('accept');
      expect(choice!.consequences.resourceChanges?.gold).toBe(100);
    });

    it('选择第二个选项返回不同后果', () => {
      env.trigger.registerEvent(makeFixedEvent());
      const trig = env.trigger.forceTriggerEvent('evt-fixed-1', 5);
      const choice = env.trigger.resolveEvent(trig.instance!.instanceId, 'reject');
      expect(choice!.consequences.resourceChanges?.morale).toBe(10);
    });

    it('resolveEvent 对不存在的实例返回 null', () => {
      expect(env.trigger.resolveEvent('non-existent', 'accept')).toBeNull();
    });

    it('触发后事件出现在活跃列表中', () => {
      env.trigger.registerEvent(makeFixedEvent());
      env.trigger.forceTriggerEvent('evt-fixed-1', 5);
      const active = env.trigger.getActiveEvents();
      expect(active).toHaveLength(1);
      expect(active[0].eventDefId).toBe('evt-fixed-1');
    });
  });

  // ═══════════════════════════════════════════
  // §1.3 概率后果计算
  // ═══════════════════════════════════════════
  describe('§1.3 概率后果计算', () => {
    it('基础概率计算 clamp 到 [0,1]', () => {
      const result = env.trigger.calculateProbability({
        baseProbability: 0.5,
        modifiers: [],
      });
      expect(result.finalProbability).toBeGreaterThanOrEqual(0);
      expect(result.finalProbability).toBeLessThanOrEqual(1);
    });

    it('注册概率条件后可查询', () => {
      env.trigger.registerEvent(makeRandomEvent());
      env.trigger.registerProbabilityCondition('evt-random-1', {
        baseProbability: 0.3,
        modifiers: [],
      });
      const cond = env.trigger.getProbabilityCondition('evt-random-1');
      expect(cond).toBeDefined();
      expect(cond!.baseProbability).toBe(0.3);
    });

    it('加法修正因子叠加基础概率', () => {
      const result = env.trigger.calculateProbability({
        baseProbability: 0.5,
        modifiers: [
          { name: 'bonus1', additiveBonus: 0.2, multiplicativeBonus: 1, active: true },
          { name: 'bonus2', additiveBonus: 0.1, multiplicativeBonus: 1, active: true },
        ],
      });
      // P = clamp((0.5 + 0.2 + 0.1) * 1, 0, 1) = 0.8
      expect(result.finalProbability).toBeCloseTo(0.8, 5);
    });

    it('乘法修正因子叠加', () => {
      const result = env.trigger.calculateProbability({
        baseProbability: 0.5,
        modifiers: [
          { name: 'mul1', additiveBonus: 0, multiplicativeBonus: 1.5, active: true },
        ],
      });
      // P = clamp((0.5 + 0) * 1.5, 0, 1) = 0.75
      expect(result.finalProbability).toBeCloseTo(0.75, 5);
    });

    it('非活跃修正因子不参与计算', () => {
      const result = env.trigger.calculateProbability({
        baseProbability: 0.5,
        modifiers: [
          { name: 'active', additiveBonus: 0.3, multiplicativeBonus: 1, active: true },
          { name: 'inactive', additiveBonus: 0.5, multiplicativeBonus: 1, active: false },
        ],
      });
      // P = clamp((0.5 + 0.3) * 1, 0, 1) = 0.8
      expect(result.finalProbability).toBeCloseTo(0.8, 5);
    });
  });

  // ═══════════════════════════════════════════
  // §1.4 急报横幅系统
  // ═══════════════════════════════════════════
  describe('§1.4 急报横幅系统', () => {
    it('createBanner 根据事件实例创建横幅', () => {
      const instance: EventInstance = {
        instanceId: 'inst-1', eventDefId: 'evt-1',
        triggeredTurn: 5, expireTurn: 8, status: 'active',
      };
      const banner = env.notification.createBanner(instance, {
        title: '急报', description: '紧急事件', urgency: 'high',
      });
      expect(banner.title).toBe('急报');
      expect(banner.urgency).toBe('high');
      expect(banner.bannerType).toBe('danger');
      expect(banner.read).toBe(false);
    });

    it('横幅按优先级排序（critical > high > medium > low）', () => {
      const makeInst = (id: string): EventInstance => ({
        instanceId: id, eventDefId: 'e', triggeredTurn: 1, expireTurn: null, status: 'active',
      });
      env.notification.createBanner(makeInst('i1'), { title: '低', description: '', urgency: 'low' });
      env.notification.createBanner(makeInst('i2'), { title: '高', description: '', urgency: 'high' });
      env.notification.createBanner(makeInst('i3'), { title: '中', description: '', urgency: 'medium' });

      const active = env.notification.getActiveBanners();
      expect(active[0].urgency).toBe('high');
      expect(active[1].urgency).toBe('medium');
      expect(active[2].urgency).toBe('low');
    });

    it('getBannerState 返回未读状态', () => {
      const instance: EventInstance = {
        instanceId: 'i1', eventDefId: 'e', triggeredTurn: 1, expireTurn: null, status: 'active',
      };
      env.notification.createBanner(instance, { title: 'T', description: '', urgency: 'medium' });
      const state = env.notification.getBannerState();
      expect(state.hasUnread).toBe(true);
      expect(state.unreadCount).toBe(1);
    });

    it('markBannerRead 标记已读', () => {
      const instance: EventInstance = {
        instanceId: 'i1', eventDefId: 'e', triggeredTurn: 1, expireTurn: null, status: 'active',
      };
      const banner = env.notification.createBanner(instance, { title: 'T', description: '', urgency: 'medium' });
      env.notification.markBannerRead(banner.id);
      expect(env.notification.getBanner(banner.id)!.read).toBe(true);
    });

    it('expireBanners 移除过期横幅', () => {
      const instance: EventInstance = {
        instanceId: 'i1', eventDefId: 'e', triggeredTurn: 1, expireTurn: 5, status: 'active',
      };
      env.notification.createBanner(instance, { title: 'T', description: '', urgency: 'medium' });
      const expired = env.notification.expireBanners(6);
      expect(expired).toHaveLength(1);
      expect(env.notification.getActiveBanners()).toHaveLength(0);
    });

    it('横幅数量超过上限自动裁剪', () => {
      env.notification.setMaxBannerDisplay(2);
      const makeInst = (id: string): EventInstance => ({
        instanceId: id, eventDefId: 'e', triggeredTurn: 1, expireTurn: null, status: 'active',
      });
      env.notification.createBanner(makeInst('i1'), { title: 'A', description: '', urgency: 'low' });
      env.notification.createBanner(makeInst('i2'), { title: 'B', description: '', urgency: 'low' });
      env.notification.createBanner(makeInst('i3'), { title: 'C', description: '', urgency: 'low' });
      // 前2个已读，第3个进来会裁剪已读的
      env.notification.markBannerRead('banner-1');
      env.notification.markBannerRead('banner-2');
      expect(env.notification.getActiveBanners().length).toBeLessThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════
  // §1.5 事件日志记录
  // ═══════════════════════════════════════════
  describe('§1.5 事件日志记录', () => {
    it('logEvent 添加日志条目', () => {
      const entry = env.log.logEvent({
        eventDefId: 'evt-1', title: '测试事件', description: '描述',
        triggeredTurn: 5, timestamp: Date.now(), eventType: 'random',
      });
      expect(entry.id).toMatch(/^log-/);
      expect(env.log.getLogCount()).toBe(1);
    });

    it('logEventResolved 更新已存在日志', () => {
      env.log.logEvent({
        eventDefId: 'evt-1', title: '测试', description: '',
        triggeredTurn: 5, timestamp: Date.now(), eventType: 'fixed',
      });
      const updated = env.log.logEventResolved('evt-1', '接受', '金币+100', 5, 7);
      expect(updated).not.toBeNull();
      expect(updated!.chosenOptionText).toBe('接受');
      expect(updated!.resolvedTurn).toBe(7);
    });

    it('按类型过滤日志', () => {
      env.log.logEvent({ eventDefId: 'e1', title: 'A', description: '', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
      env.log.logEvent({ eventDefId: 'e2', title: 'B', description: '', triggeredTurn: 2, timestamp: 0, eventType: 'fixed' });
      env.log.logEvent({ eventDefId: 'e3', title: 'C', description: '', triggeredTurn: 3, timestamp: 0, eventType: 'random' });
      expect(env.log.getEventLog({ eventType: 'random' })).toHaveLength(2);
    });

    it('按回合范围过滤日志', () => {
      env.log.logEvent({ eventDefId: 'e1', title: '', description: '', triggeredTurn: 3, timestamp: 0, eventType: 'random' });
      env.log.logEvent({ eventDefId: 'e2', title: '', description: '', triggeredTurn: 7, timestamp: 0, eventType: 'random' });
      env.log.logEvent({ eventDefId: 'e3', title: '', description: '', triggeredTurn: 12, timestamp: 0, eventType: 'random' });
      const filtered = env.log.getEventLog({ fromTurn: 5, toTurn: 10 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].triggeredTurn).toBe(7);
    });

    it('急报管理：添加、标记已读、清除', () => {
      env.log.addAlert({ title: '急报1', description: 'd', urgency: 'high', alertType: 'random' });
      env.log.addAlert({ title: '急报2', description: 'd', urgency: 'critical', alertType: 'chain' });
      const stack = env.log.getAlertStack();
      expect(stack.totalCount).toBe(2);
      expect(stack.unreadCount).toBe(2);
      expect(stack.highestUrgency).toBe('critical');

      env.log.markAlertRead('alert-1');
      expect(env.log.getUnreadAlertCount()).toBe(1);

      env.log.markAllAlertsRead();
      env.log.clearReadAlerts();
      expect(env.log.getAlerts().length).toBe(0);
    });

    it('日志序列化/反序列化', () => {
      env.log.logEvent({ eventDefId: 'e1', title: 'T', description: 'D', triggeredTurn: 1, timestamp: 0, eventType: 'random' });
      const data = env.log.exportSaveData();
      const newLog = new EventLogSystem();
      newLog.init(mockDeps());
      newLog.importSaveData(data);
      expect(newLog.getLogCount()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // §1.6 跨系统联动
  // ═══════════════════════════════════════════
  describe('§1.6 跨系统联动（触发→横幅→日志）', () => {
    it('事件触发后创建横幅并记录日志', () => {
      const def = makeFixedEvent();
      env.trigger.registerEvent(def);

      // 触发
      const trigResult = env.trigger.forceTriggerEvent(def.id, 5);
      expect(trigResult.triggered).toBe(true);
      const inst = trigResult.instance!;

      // 创建横幅
      const banner = env.notification.createBanner(inst, {
        title: def.title, description: def.description, urgency: def.urgency,
      });
      expect(banner.eventInstanceId).toBe(inst.instanceId);

      // 记录日志
      env.log.logEvent({
        eventDefId: def.id, title: def.title, description: def.description,
        triggeredTurn: 5, timestamp: Date.now(), eventType: 'fixed',
      });
      expect(env.log.getLogCount()).toBe(1);
    });

    it('选择选项后更新日志含选择信息', () => {
      const def = makeFixedEvent();
      env.trigger.registerEvent(def);
      const trig = env.trigger.forceTriggerEvent(def.id, 5);
      const instId = trig.instance!.instanceId;

      const choice = env.trigger.resolveEvent(instId, 'accept');
      expect(choice).not.toBeNull();

      env.log.logEventResolved(def.id, '接受祝福', '金币+100', 5, 6);
      const logs = env.log.getEventLog();
      const resolved = logs.find(l => l.resolvedTurn !== undefined);
      expect(resolved).toBeDefined();
      expect(resolved!.chosenOptionText).toBe('接受祝福');
    });

    it('遭遇弹窗完整流程：创建→选择→结果', () => {
      const def = makeRandomEvent();
      const instance: EventInstance = {
        instanceId: 'enc-inst-1', eventDefId: def.id,
        triggeredTurn: 3, expireTurn: null, status: 'active',
      };
      const popup = env.notification.createEncounterPopup(instance, {
        title: def.title, description: def.description,
        urgency: def.urgency, options: def.options,
      });
      expect(popup.options).toHaveLength(2);
      expect(popup.dismissible).toBe(true);

      const result = env.notification.resolveEncounter(popup.id, 'accept');
      expect(result).not.toBeNull();
      expect(result!.optionId).toBe('accept');
      expect(result!.resourceChanges?.troops).toBe(50);

      // 已解决的弹窗不再活跃
      expect(env.notification.getEncounterPopup(popup.id)).toBeUndefined();
    });

    it('critical 事件弹窗不可关闭', () => {
      const def = makeRandomEvent({ urgency: 'critical' });
      const instance: EventInstance = {
        instanceId: 'crit-1', eventDefId: def.id,
        triggeredTurn: 1, expireTurn: null, status: 'active',
      };
      const popup = env.notification.createEncounterPopup(instance, {
        title: def.title, description: def.description,
        urgency: 'critical', options: def.options,
      });
      expect(popup.dismissible).toBe(false);
      expect(env.notification.dismissEncounter(popup.id)).toBe(false);
    });

    it('横幅图标和颜色映射正确', () => {
      expect(env.notification.getBannerIcon('info')).toBe('📢');
      expect(env.notification.getBannerIcon('danger')).toBe('🔴');
      expect(env.notification.getBannerColor('warning')).toBe('#F5A623');
    });

    it('事件过期后横幅和活跃事件同步清理', () => {
      const def = makeFixedEvent({ expireAfterTurns: 2 });
      env.trigger.registerEvent(def);
      const trig = env.trigger.forceTriggerEvent(def.id, 5);

      // 创建横幅
      env.notification.createBanner(trig.instance!, {
        title: def.title, description: def.description, urgency: def.urgency,
      });

      // 回合推进到过期
      const expired = env.notification.expireBanners(8);
      expect(expired).toHaveLength(1);

      const expiredEvents = env.trigger.expireEvents(8);
      expect(expiredEvents).toHaveLength(1);
      expect(env.trigger.getActiveEventCount()).toBe(0);
    });
  });
});
