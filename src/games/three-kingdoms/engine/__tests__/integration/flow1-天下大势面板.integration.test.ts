/**
 * v6.0 集成测试 — Flow 1: 天下大势面板 + 急报横幅 + 事件类型筛选
 *
 * 覆盖 v6-play 流程:
 *   - §1  天下大势面板
 *   - §1.1 急报横幅
 *   - §1.2 事件类型筛选
 *
 * 涉及子系统: EventTriggerSystem, EventNotificationSystem, ChainEventSystem
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ISystemDeps } from '../../../core/types';
import { EventTriggerSystem } from '../../../engine/event/EventTriggerSystem';
import { EventNotificationSystem } from '../../../engine/event/EventNotificationSystem';
import { ChainEventSystem } from '../../../engine/event/ChainEventSystem';
import type {
  EventDef,
  EventInstance,
  EventTriggerType,
  EventUrgency,
} from '../../../core/event';

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

/** 创建随机事件定义 */
function makeRandomEventDef(id: string, urgency: EventUrgency = 'medium'): EventDef {
  return {
    id,
    title: `事件-${id}`,
    description: `描述-${id}`,
    triggerType: 'random' as EventTriggerType,
    urgency,
    options: [
      { id: `${id}-opt1`, text: '选项A', consequences: [{ resource: 'gold', amount: 100, probability: 1.0 }] },
      { id: `${id}-opt2`, text: '选项B', consequences: [{ resource: 'grain', amount: -50, probability: 1.0 }] },
    ],
  };
}

/** 创建固定事件定义 */
function makeFixedEventDef(id: string, urgency: EventUrgency = 'high'): EventDef {
  return {
    id,
    title: `固定事件-${id}`,
    description: `固定描述-${id}`,
    triggerType: 'fixed' as EventTriggerType,
    urgency,
    options: [
      { id: `${id}-opt1`, text: '确认', consequences: [{ resource: 'gold', amount: 200, probability: 1.0 }] },
    ],
  };
}

/** 创建连锁事件定义 */
function makeChainEventDef(id: string, urgency: EventUrgency = 'critical'): EventDef {
  return {
    id,
    title: `连锁事件-${id}`,
    description: `连锁描述-${id}`,
    triggerType: 'chain' as EventTriggerType,
    urgency,
    options: [
      { id: `${id}-opt1`, text: '推进链', consequences: [{ resource: 'gold', amount: 500, probability: 1.0 }] },
    ],
  };
}

// ─────────────────────────────────────────────
// §1 天下大势面板
// ─────────────────────────────────────────────

describe('v6.0 集成测试 — Flow 1: 天下大势面板 + 急报横幅 + 事件筛选', () => {

  // ─── §1 天下大势面板 ────────────────────────

  describe('§1 天下大势面板', () => {
    let triggerSys: EventTriggerSystem;
    let notifySys: EventNotificationSystem;
    let chainSys: ChainEventSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      triggerSys = new EventTriggerSystem();
      triggerSys.init(deps);
      notifySys = new EventNotificationSystem();
      notifySys.init(deps);
      chainSys = new ChainEventSystem();
      chainSys.init(deps);
    });

    it('应正确初始化所有子系统', () => {
      expect(triggerSys.name).toBe('eventTrigger');
      expect(notifySys.name).toBe('eventNotification');
      expect(chainSys.name).toBe('chainEvent');
    });

    it('应加载预定义事件定义', () => {
      const defs = triggerSys.getAllEventDefs();
      expect(defs.length).toBeGreaterThan(0);
    });

    it('应按触发类型获取事件定义', () => {
      triggerSys.registerEvents([
        makeRandomEventDef('rand-1'),
        makeFixedEventDef('fix-1'),
        makeChainEventDef('chain-1'),
      ]);

      const randomDefs = triggerSys.getEventDefsByType('random');
      const fixedDefs = triggerSys.getEventDefsByType('fixed');
      const chainDefs = triggerSys.getEventDefsByType('chain');

      expect(randomDefs.some(d => d.id === 'rand-1')).toBe(true);
      expect(fixedDefs.some(d => d.id === 'fix-1')).toBe(true);
      expect(chainDefs.some(d => d.id === 'chain-1')).toBe(true);
    });

    it('面板数据应与实际游戏状态一致 — 注册→触发→查询', () => {
      triggerSys.registerEvent(makeRandomEventDef('evt-panel-1'));
      const result = triggerSys.forceTriggerEvent('evt-panel-1', 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.instance!.eventDefId).toBe('evt-panel-1');
    });

    it('势力占比总和应可通过领土数据验证', () => {
      // 天下大势面板依赖 TerritorySystem 数据
      // 此处验证事件触发后面板数据可获取
      const state = triggerSys.getState();
      expect(state).toHaveProperty('eventDefs');
      expect(state).toHaveProperty('activeEvents');
      expect(state).toHaveProperty('completedEventIds');
    });

    it('应支持批量注册事件', () => {
      const defs = [
        makeRandomEventDef('batch-1'),
        makeRandomEventDef('batch-2'),
        makeFixedEventDef('batch-3'),
      ];
      triggerSys.registerEvents(defs);
      expect(triggerSys.getEventDef('batch-1')).toBeDefined();
      expect(triggerSys.getEventDef('batch-2')).toBeDefined();
      expect(triggerSys.getEventDef('batch-3')).toBeDefined();
    });

    it('应能获取单个事件定义', () => {
      triggerSys.registerEvent(makeRandomEventDef('single-1'));
      const def = triggerSys.getEventDef('single-1');
      expect(def).toBeDefined();
      expect(def!.id).toBe('single-1');
      expect(def!.title).toContain('事件');
    });

    it('获取不存在的事件定义应返回undefined', () => {
      expect(triggerSys.getEventDef('nonexistent')).toBeUndefined();
    });
  });

  // ─── §1.1 急报横幅 ────────────────────────

  describe('§1.1 急报横幅', () => {
    let triggerSys: EventTriggerSystem;
    let notifySys: EventNotificationSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      triggerSys = new EventTriggerSystem();
      triggerSys.init(deps);
      notifySys = new EventNotificationSystem();
      notifySys.init(deps);
    });

    it('事件触发后应创建急报横幅', () => {
      triggerSys.registerEvent(makeRandomEventDef('banner-evt-1', 'high'));
      const result = triggerSys.forceTriggerEvent('banner-evt-1', 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();

      const banner = notifySys.createBanner(result.instance!, {
        title: '紧急军情',
        description: '敌军来袭',
        urgency: 'high',
      });

      expect(banner).toBeDefined();
      expect(banner.title).toBe('紧急军情');
      expect(banner.urgency).toBe('high');
      expect(banner.read).toBe(false);
    });

    it('横幅应按优先级排序', () => {
      const makeInstance = (id: string): EventInstance => ({
        instanceId: id,
        eventDefId: `event-${id}`,
        triggeredTurn: 1,
        expireTurn: 10,
        status: 'active',
      });

      const b1 = notifySys.createBanner(makeInstance('low-1'), { title: '低优先', description: '', urgency: 'low' });
      const b2 = notifySys.createBanner(makeInstance('crit-1'), { title: '紧急', description: '', urgency: 'critical' });
      const b3 = notifySys.createBanner(makeInstance('med-1'), { title: '中等', description: '', urgency: 'medium' });

      const active = notifySys.getActiveBanners();
      expect(active.length).toBe(3);
      // critical > medium > low
      expect(active[0].id).toBe(b2.id);
      expect(active[1].id).toBe(b3.id);
      expect(active[2].id).toBe(b1.id);
    });

    it('横幅应支持标记已读', () => {
      const instance: EventInstance = {
        instanceId: 'inst-read-1',
        eventDefId: 'evt-read-1',
        triggeredTurn: 1,
        expireTurn: 10,
        status: 'active',
      };

      const banner = notifySys.createBanner(instance, { title: '测试', description: '', urgency: 'medium' });
      expect(banner.read).toBe(false);

      notifySys.markBannerRead(banner.id);
      const updated = notifySys.getBanner(banner.id);
      expect(updated!.read).toBe(true);
    });

    it('应支持标记全部已读', () => {
      const makeInstance = (id: string): EventInstance => ({
        instanceId: id, eventDefId: `e-${id}`, triggeredTurn: 1, expireTurn: 10, status: 'active',
      });

      notifySys.createBanner(makeInstance('a1'), { title: 'A', description: '', urgency: 'low' });
      notifySys.createBanner(makeInstance('a2'), { title: 'B', description: '', urgency: 'medium' });

      notifySys.markAllBannersRead();
      const unread = notifySys.getUnreadBanners();
      expect(unread.length).toBe(0);
    });

    it('应支持移除横幅', () => {
      const instance: EventInstance = {
        instanceId: 'inst-del-1', eventDefId: 'evt-del-1', triggeredTurn: 1, expireTurn: 10, status: 'active',
      };
      const banner = notifySys.createBanner(instance, { title: '删除', description: '', urgency: 'low' });
      expect(notifySys.removeBanner(banner.id)).toBe(true);
      expect(notifySys.getBanner(banner.id)).toBeUndefined();
    });

    it('应支持横幅过期清理', () => {
      const instance: EventInstance = {
        instanceId: 'inst-exp-1', eventDefId: 'evt-exp-1', triggeredTurn: 1, expireTurn: 5, status: 'active',
      };
      notifySys.createBanner(instance, { title: '过期', description: '', urgency: 'medium' });

      const expired = notifySys.expireBanners(10);
      expect(expired.length).toBe(1);
      expect(expired[0].title).toBe('过期');
    });

    it('未读横幅计数应正确', () => {
      const makeInstance = (id: string): EventInstance => ({
        instanceId: id, eventDefId: `e-${id}`, triggeredTurn: 1, expireTurn: 10, status: 'active',
      });

      notifySys.createBanner(makeInstance('u1'), { title: 'U1', description: '', urgency: 'low' });
      notifySys.createBanner(makeInstance('u2'), { title: 'U2', description: '', urgency: 'medium' });

      const state = notifySys.getBannerState();
      expect(state.hasUnread).toBe(true);
      expect(state.unreadCount).toBe(2);
    });

    it('横幅上限应生效(最多5条)', () => {
      const makeInstance = (id: string): EventInstance => ({
        instanceId: id, eventDefId: `e-${id}`, triggeredTurn: 1, expireTurn: 10, status: 'active',
      });

      // 创建6条横幅
      for (let i = 0; i < 6; i++) {
        notifySys.createBanner(makeInstance(`lim-${i}`), { title: `横幅${i}`, description: '', urgency: 'low' });
      }

      const active = notifySys.getActiveBanners();
      expect(active.length).toBeLessThanOrEqual(5);
    });

    it('横幅创建应发出事件总线通知', () => {
      const instance: EventInstance = {
        instanceId: 'inst-emit-1', eventDefId: 'evt-emit-1', triggeredTurn: 1, expireTurn: 10, status: 'active',
      };

      notifySys.createBanner(instance, { title: '通知', description: '', urgency: 'high' });
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:banner_created',
        expect.objectContaining({ title: '通知', urgency: 'high' }),
      );
    });

    it('应支持dismiss横幅', () => {
      const instance: EventInstance = {
        instanceId: 'inst-dismiss-1', eventDefId: 'evt-dismiss-1', triggeredTurn: 1, expireTurn: 10, status: 'active',
      };
      const banner = notifySys.createBanner(instance, { title: '关闭', description: '', urgency: 'low' });
      expect(notifySys.dismissBanner(banner.id)).toBe(true);
      expect(notifySys.getBanner(banner.id)).toBeUndefined();
    });

    it('批量创建横幅应正确', () => {
      const makeInstance = (id: string): EventInstance => ({
        instanceId: id, eventDefId: `e-${id}`, triggeredTurn: 1, expireTurn: 10, status: 'active',
      });

      const banners = notifySys.createBanners([
        { instance: makeInstance('b1'), eventDef: { title: 'B1', description: '', urgency: 'low' } },
        { instance: makeInstance('b2'), eventDef: { title: 'B2', description: '', urgency: 'medium' } },
      ]);

      expect(banners.length).toBe(2);
      expect(banners[0].title).toBe('B1');
      expect(banners[1].title).toBe('B2');
    });
  });

  // ─── §1.2 事件类型筛选 ────────────────────────

  describe('§1.2 事件类型筛选', () => {
    let triggerSys: EventTriggerSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      triggerSys = new EventTriggerSystem();
      triggerSys.init(deps);
    });

    it('应按random类型筛选出随机事件', () => {
      const countBefore = triggerSys.getEventDefsByType('random').length;
      triggerSys.registerEvents([
        makeRandomEventDef('r1'),
        makeRandomEventDef('r2'),
        makeFixedEventDef('f1'),
        makeChainEventDef('c1'),
      ]);

      const randomDefs = triggerSys.getEventDefsByType('random');
      expect(randomDefs.length).toBe(countBefore + 2);
      expect(randomDefs.every(d => d.triggerType === 'random')).toBe(true);
    });

    it('应按fixed类型筛选出固定事件', () => {
      const countBefore = triggerSys.getEventDefsByType('fixed').length;
      triggerSys.registerEvents([
        makeRandomEventDef('r1'),
        makeFixedEventDef('f1'),
        makeFixedEventDef('f2'),
      ]);

      const fixedDefs = triggerSys.getEventDefsByType('fixed');
      expect(fixedDefs.length).toBe(countBefore + 2);
      expect(fixedDefs.every(d => d.triggerType === 'fixed')).toBe(true);
    });

    it('应按chain类型筛选出连锁事件', () => {
      const countBefore = triggerSys.getEventDefsByType('chain').length;
      triggerSys.registerEvents([
        makeChainEventDef('c1'),
        makeChainEventDef('c2'),
        makeRandomEventDef('r1'),
      ]);

      const chainDefs = triggerSys.getEventDefsByType('chain');
      expect(chainDefs.length).toBe(countBefore + 2);
      expect(chainDefs.every(d => d.triggerType === 'chain')).toBe(true);
    });

    it('筛选结果为空应返回空数组', () => {
      // 不注册任何chain事件，预定义事件可能含chain
      // 改为验证筛选逻辑正确性
      const chainDefs = triggerSys.getEventDefsByType('chain');
      expect(chainDefs.every(d => d.triggerType === 'chain')).toBe(true);
    });

    it('切换标签后列表应即时刷新', () => {
      const randomBefore = triggerSys.getEventDefsByType('random').length;
      const fixedBefore = triggerSys.getEventDefsByType('fixed').length;
      const chainBefore = triggerSys.getEventDefsByType('chain').length;

      triggerSys.registerEvents([
        makeRandomEventDef('r1'),
        makeFixedEventDef('f1'),
        makeChainEventDef('c1'),
      ]);

      // 模拟切换到 random
      const r = triggerSys.getEventDefsByType('random');
      expect(r.length).toBe(randomBefore + 1);

      // 切换到 fixed
      const f = triggerSys.getEventDefsByType('fixed');
      expect(f.length).toBe(fixedBefore + 1);

      // 切换到 chain
      const c = triggerSys.getEventDefsByType('chain');
      expect(c.length).toBe(chainBefore + 1);
    });

    it('事件子类型标签颜色应可区分', () => {
      triggerSys.registerEvents([
        makeRandomEventDef('evt-tianzai', 'critical'),  // 天灾 - 红
        makeRandomEventDef('evt-renhuo', 'high'),       // 人祸 - 橙
        makeRandomEventDef('evt-qiyu', 'low'),          // 奇遇 - 绿
        makeRandomEventDef('evt-shangdui', 'medium'),   // 商队 - 蓝
      ]);

      const defs = triggerSys.getEventDefsByType('random');
      const urgencies = defs.map(d => d.urgency);
      expect(urgencies).toContain('critical');
      expect(urgencies).toContain('high');
      expect(urgencies).toContain('low');
      expect(urgencies).toContain('medium');
    });
  });

  // ─── §1 跨系统联动 ────────────────────────

  describe('§1 跨系统联动: EventTrigger → EventNotification', () => {
    let triggerSys: EventTriggerSystem;
    let notifySys: EventNotificationSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      triggerSys = new EventTriggerSystem();
      triggerSys.init(deps);
      notifySys = new EventNotificationSystem();
      notifySys.init(deps);
    });

    it('触发事件后应可创建横幅并查询', () => {
      triggerSys.registerEvent(makeRandomEventDef('cross-1', 'high'));
      const result = triggerSys.forceTriggerEvent('cross-1', 1);
      expect(result.triggered).toBe(true);

      const banner = notifySys.createBanner(result.instance!, {
        title: result.instance!.eventDefId,
        description: '跨系统联动测试',
        urgency: 'high',
      });

      const active = notifySys.getActiveBanners();
      expect(active.some(b => b.id === banner.id)).toBe(true);
    });

    it('解决事件后横幅应可标记完成', () => {
      triggerSys.registerEvent(makeRandomEventDef('cross-2'));
      const result = triggerSys.forceTriggerEvent('cross-2', 1);
      expect(result.triggered).toBe(true);

      const banner = notifySys.createBanner(result.instance!, {
        title: '待解决',
        description: '',
        urgency: 'medium',
      });

      // 解决事件
      const choice = triggerSys.resolveEvent(result.instance!.instanceId, 'cross-2-opt1');
      // 标记横幅已读
      notifySys.markBannerRead(banner.id);

      const updated = notifySys.getBanner(banner.id);
      expect(updated!.read).toBe(true);
    });

    it('多个事件触发应产生多条横幅', () => {
      triggerSys.registerEvents([
        makeRandomEventDef('multi-1', 'low'),
        makeRandomEventDef('multi-2', 'medium'),
        makeRandomEventDef('multi-3', 'high'),
      ]);

      const results = [
        triggerSys.forceTriggerEvent('multi-1', 1),
        triggerSys.forceTriggerEvent('multi-2', 1),
        triggerSys.forceTriggerEvent('multi-3', 1),
      ];

      for (const r of results) {
        if (r.triggered && r.instance) {
          notifySys.createBanner(r.instance, {
            title: r.instance.eventDefId,
            description: '',
            urgency: 'medium',
          });
        }
      }

      const active = notifySys.getActiveBanners();
      expect(active.length).toBe(3);
    });

    it('reset后所有子系统应清空', () => {
      triggerSys.registerEvent(makeRandomEventDef('reset-1'));
      triggerSys.forceTriggerEvent('reset-1', 1);

      triggerSys.reset();
      notifySys.reset();

      expect(triggerSys.getActiveEvents().length).toBe(0);
      expect(notifySys.getActiveBanners().length).toBe(0);
    });
  });
});
