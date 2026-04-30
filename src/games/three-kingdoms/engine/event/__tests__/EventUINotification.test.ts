/**
 * EventUINotification 测试
 *
 * 验证事件 UI 通知系统：
 *   - 急报横幅创建与队列管理
 *   - 横幅优先级排序
 *   - 横幅已读/关闭/过期
 *   - 遭遇弹窗数据生成
 *   - 序列化/反序列化
 *   - ISubsystem 生命周期
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventUINotification, type EncounterModalData } from '../EventUINotification';
import type { ActiveGameEvent, EventBanner } from '../../../core/events';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

function createMockDeps(): any {
  return {
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      getAll: vi.fn().mockReturnValue({}),
    },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      unregister: vi.fn(),
    },
  };
}

function createMockEvent(overrides: Partial<ActiveGameEvent> = {}): ActiveGameEvent {
  return {
    instanceId: 'inst-001',
    eventId: 'event_test' as unknown as string,
    name: '测试事件',
    description: '这是一个测试事件',
    triggerType: 'random' as unknown as string,
    category: 'military' as unknown as string,
    priority: 'normal' as unknown as string,
    status: 'active' as unknown as string,
    options: [
      {
        id: 'opt1',
        text: '选项1',
        description: '选项描述1',
        consequences: [
          { type: 'resource_change' as unknown as string, target: 'grain', value: 100, description: '获得100粮草' },
        ],
        aiWeight: 1,
      },
      {
        id: 'opt2',
        text: '选项2',
        consequences: [
          { type: 'resource_change' as unknown as string, target: 'gold', value: -50, description: '损失50铜钱' },
        ],
        aiWeight: 0.5,
      },
    ],
    triggeredAtTurn: 1,
    expiresAtTurn: 0,
    selectedOptionId: null,
    appliedConsequences: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('EventUINotification', () => {
  let ui: EventUINotification;
  let deps: any;

  beforeEach(() => {
    ui = new EventUINotification();
    deps = createMockDeps();
    ui.init(deps);
  });

  // ── ISubsystem 生命周期 ──

  describe('ISubsystem 生命周期', () => {
    it('name 应为 eventUINotification', () => {
      expect(ui.name).toBe('eventUINotification');
    });

    it('init 应正常执行', () => {
      const newUi = new EventUINotification();
      expect(() => newUi.init(deps)).not.toThrow();
    });

    it('update 应正常执行（预留）', () => {
      expect(() => ui.update(16)).not.toThrow();
    });

    it('reset 应清空所有状态', () => {
      const event = createMockEvent();
      ui.createBanner(event);
      ui.reset();

      const state = ui.getState();
      expect(state.bannerQueue.current).toBeNull();
      expect(state.bannerQueue.pending).toHaveLength(0);
      expect(state.bannerQueue.expired).toHaveLength(0);
    });
  });

  // ── 急报横幅创建 ──

  describe('createBanner', () => {
    it('创建横幅并设为当前显示', () => {
      const event = createMockEvent();
      const banner = ui.createBanner(event);

      expect(banner).toBeDefined();
      expect(banner.eventId).toBe(event.eventId);
      expect(banner.title).toBe(event.name);
      expect(banner.content).toBe(event.description);
      expect(banner.read).toBe(false);
      expect(banner.id).toBeTruthy();
    });

    it('创建横幅时发出 event:banner_created 事件', () => {
      const event = createMockEvent();
      ui.createBanner(event);

      expect(deps.eventBus.emit).toHaveBeenCalledWith('event:banner_created', expect.objectContaining({
        eventId: event.eventId,
        title: event.name,
      }));
    });

    it('无当前横幅时直接显示', () => {
      const event = createMockEvent();
      ui.createBanner(event);

      expect(ui.getCurrentBanner()).not.toBeNull();
      expect(ui.getCurrentBanner()!.eventId).toBe(event.eventId);
    });

    it('有当前横幅时加入 pending 队列', () => {
      const event1 = createMockEvent({ eventId: 'e1' as unknown as string });
      const event2 = createMockEvent({ eventId: 'e2' as unknown as string });

      ui.createBanner(event1);
      ui.createBanner(event2);

      expect(ui.getCurrentBanner()!.eventId).toBe('e1');
      expect(ui.getPendingBannerCount()).toBe(1);
    });

    it('横幅图标根据 category 映射', () => {
      const militaryEvent = createMockEvent({ category: 'military' as unknown as string });
      const banner = ui.createBanner(militaryEvent);
      expect(banner.icon).toBe('⚔️');
    });

    it('未知 category 使用默认图标', () => {
      const unknownEvent = createMockEvent({ category: 'unknown_cat' as unknown as string });
      const banner = ui.createBanner(unknownEvent);
      expect(banner.icon).toBe('📢');
    });

    it('urgent 优先级显示时长 8000ms', () => {
      const event = createMockEvent({ priority: 'urgent' as unknown as string });
      const banner = ui.createBanner(event);
      expect(banner.displayDuration).toBe(8000);
    });

    it('high 优先级显示时长 6000ms', () => {
      const event = createMockEvent({ priority: 'high' as unknown as string });
      const banner = ui.createBanner(event);
      expect(banner.displayDuration).toBe(6000);
    });

    it('normal 优先级显示时长 5000ms', () => {
      const event = createMockEvent({ priority: 'normal' as unknown as string });
      const banner = ui.createBanner(event);
      expect(banner.displayDuration).toBe(5000);
    });

    it('low 优先级显示时长 4000ms', () => {
      const event = createMockEvent({ priority: 'low' as unknown as string });
      const banner = ui.createBanner(event);
      expect(banner.displayDuration).toBe(4000);
    });
  });

  // ── 横幅队列优先级排序 ──

  describe('横幅队列优先级排序', () => {
    it('pending 队列按优先级降序排列', () => {
      const lowEvent = createMockEvent({ eventId: 'low' as unknown as string, priority: 'low' as unknown as string });
      const urgentEvent = createMockEvent({ eventId: 'urgent' as unknown as string, priority: 'urgent' as unknown as string });
      const normalEvent = createMockEvent({ eventId: 'normal' as unknown as string, priority: 'normal' as unknown as string });

      ui.createBanner(lowEvent);
      ui.createBanner(urgentEvent);
      ui.createBanner(normalEvent);

      // 当前显示第一个（low），pending 应按优先级排序
      const state = ui.getState();
      expect(state.bannerQueue.pending[0].priority).toBe('urgent');
      expect(state.bannerQueue.pending[1].priority).toBe('normal');
    });
  });

  // ── 横幅已读/关闭 ──

  describe('markCurrentBannerRead', () => {
    it('标记当前横幅为已读', () => {
      ui.createBanner(createMockEvent());
      const result = ui.markCurrentBannerRead();
      expect(result).toBe(true);
      expect(ui.getCurrentBanner()!.read).toBe(true);
    });

    it('无当前横幅时返回 false', () => {
      const result = ui.markCurrentBannerRead();
      expect(result).toBe(false);
    });
  });

  describe('dismissCurrentBanner', () => {
    it('关闭当前横幅后显示下一个', () => {
      const event1 = createMockEvent({ eventId: 'e1' as unknown as string });
      const event2 = createMockEvent({ eventId: 'e2' as unknown as string });

      ui.createBanner(event1);
      ui.createBanner(event2);

      const next = ui.dismissCurrentBanner();
      expect(next).not.toBeNull();
      expect(next!.eventId).toBe('e2');
    });

    it('关闭最后一个横幅返回 null', () => {
      ui.createBanner(createMockEvent());
      const next = ui.dismissCurrentBanner();
      expect(next).toBeNull();
    });

    it('无当前横幅时返回 null', () => {
      const next = ui.dismissCurrentBanner();
      expect(next).toBeNull();
    });

    it('关闭的横幅移入 expired 列表', () => {
      ui.createBanner(createMockEvent());
      ui.dismissCurrentBanner();

      const expired = ui.getExpiredBanners();
      expect(expired).toHaveLength(1);
    });
  });

  // ── getState ──

  describe('getState', () => {
    it('返回深拷贝不影响内部状态', () => {
      ui.createBanner(createMockEvent());
      const state = ui.getState();
      (state.bannerQueue.current as unknown as { title: string })!.title = 'modified';

      // 内部状态不受影响
      expect(ui.getCurrentBanner()!.title).toBe('测试事件');
    });
  });

  // ── 遭遇弹窗 ──

  describe('createEncounterModal', () => {
    it('生成遭遇弹窗数据', () => {
      const event = createMockEvent();
      const modal = ui.createEncounterModal(event);

      expect(modal.instanceId).toBe(event.instanceId);
      expect(modal.title).toBe(event.name);
      expect(modal.description).toBe(event.description);
      expect(modal.category).toBe(event.category);
      expect(modal.priority).toBe(event.priority);
      expect(modal.options).toHaveLength(2);
    });

    it('选项数据正确映射', () => {
      const event = createMockEvent();
      const modal = ui.createEncounterModal(event);

      expect(modal.options[0].id).toBe('opt1');
      expect(modal.options[0].text).toBe('选项1');
      expect(modal.options[0].description).toBe('选项描述1');
      expect(modal.options[0].consequencePreviews).toEqual(['获得100粮草']);
    });

    it('urgent 事件 isUrgent 为 true', () => {
      const event = createMockEvent({ priority: 'urgent' as unknown as string });
      const modal = ui.createEncounterModal(event);
      expect(modal.isUrgent).toBe(true);
    });

    it('非 urgent 事件 isUrgent 为 false', () => {
      const event = createMockEvent({ priority: 'normal' as unknown as string });
      const modal = ui.createEncounterModal(event);
      expect(modal.isUrgent).toBe(false);
    });

    it('图标根据 category 映射', () => {
      const event = createMockEvent({ category: 'economic' as unknown as string });
      const modal = ui.createEncounterModal(event);
      expect(modal.icon).toBe('💰');
    });
  });

  describe('createEncounterModals', () => {
    it('批量生成弹窗数据', () => {
      const events = [
        createMockEvent({ instanceId: 'i1' }),
        createMockEvent({ instanceId: 'i2' }),
      ];
      const modals = ui.createEncounterModals(events);

      expect(modals).toHaveLength(2);
      expect(modals[0].instanceId).toBe('i1');
      expect(modals[1].instanceId).toBe('i2');
    });

    it('空事件列表返回空数组', () => {
      const modals = ui.createEncounterModals([]);
      expect(modals).toHaveLength(0);
    });
  });

  // ── 序列化 ──

  describe('serialize / deserialize', () => {
    it('序列化保存 expired 横幅', () => {
      ui.createBanner(createMockEvent());
      ui.dismissCurrentBanner();

      const data = ui.serialize();
      expect(data.expiredBanners).toHaveLength(1);
    });

    it('反序列化恢复 expired 横幅', () => {
      ui.createBanner(createMockEvent());
      ui.dismissCurrentBanner();
      const data = ui.serialize();

      const newUi = new EventUINotification();
      newUi.init(deps);
      newUi.deserialize(data);

      expect(newUi.getExpiredBanners()).toHaveLength(1);
    });

    it('反序列化重置 current 和 pending', () => {
      const newUi = new EventUINotification();
      newUi.init(deps);
      newUi.deserialize({ expiredBanners: [] });

      const state = newUi.getState();
      expect(state.bannerQueue.current).toBeNull();
      expect(state.bannerQueue.pending).toHaveLength(0);
    });

    it('反序列化 undefined 数据不崩溃', () => {
      const newUi = new EventUINotification();
      newUi.init(deps);
      expect(() => newUi.deserialize({})).not.toThrow();
    });
  });

  // ── 边界条件 ──

  describe('边界条件', () => {
    it('过期横幅列表最多保留50条', () => {
      // 创建并关闭51个横幅
      for (let i = 0; i < 51; i++) {
        ui.createBanner(createMockEvent({ eventId: `e${i}` as unknown as string }));
        ui.dismissCurrentBanner();
      }

      const expired = ui.getExpiredBanners();
      expect(expired.length).toBeLessThanOrEqual(50);
    });

    it('pending 队列超过最大长度时溢出到 expired', () => {
      // BANNER_MAX_QUEUE_SIZE = 5
      // 第一个作为 current，后续进入 pending
      for (let i = 0; i < 10; i++) {
        ui.createBanner(createMockEvent({ eventId: `e${i}` as unknown as string }));
      }

      const state = ui.getState();
      expect(state.bannerQueue.pending.length).toBeLessThanOrEqual(5);
    });
  });
});
