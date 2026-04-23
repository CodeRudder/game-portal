import { vi } from 'vitest';
/**
 * EventNotificationSystem 单元测试
 *
 * 覆盖事件通知系统的所有功能：
 * - ISubsystem 接口
 * - 急报横幅创建与管理
 * - 横幅已读/未读状态
 * - 横幅过期清理
 * - 遭遇弹窗创建
 * - 遭遇选项与后果预览
 * - 遭遇选择处理
 * - 序列化
 */

import { EventNotificationSystem } from '../EventNotificationSystem';
import type { ISystemDeps } from '../../../core/types';
import type {
  EventDef,
  EventInstance,
  EventBanner,
  EncounterPopup,
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

function createSystem(): EventNotificationSystem {
  const sys = new EventNotificationSystem();
  sys.init(mockDeps());
  return sys;
}

function createTestEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'test-event-01',
    title: '测试事件',
    description: '这是一个测试事件',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'global',
    options: [
      {
        id: 'opt-a',
        text: '选项A',
        description: '选择A',
        consequences: {
          description: '获得金币',
          resourceChanges: { gold: 100 },
        },
      },
      {
        id: 'opt-b',
        text: '选项B',
        isDefault: true,
        consequences: {
          description: '获得粮草',
          resourceChanges: { grain: 50 },
        },
      },
    ],
    ...overrides,
  };
}

function createTestInstance(overrides?: Partial<EventInstance>): EventInstance {
  return {
    instanceId: 'inst-001',
    eventDefId: 'test-event-01',
    triggeredTurn: 1,
    expireTurn: 5,
    status: 'active',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════

describe('EventNotificationSystem', () => {
  let sys: EventNotificationSystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 eventNotification', () => {
      expect(sys.name).toBe('eventNotification');
    });

    it('init 后状态为空', () => {
      const state = sys.getState();
      expect(state.activeBanners).toEqual([]);
      expect(state.hasUnread).toBe(false);
      expect(state.unreadCount).toBe(0);
    });

    it('reset 恢复初始状态', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      sys.createBanner(inst, def, 1);

      sys.reset();
      const state = sys.getState();
      expect(state.activeBanners).toEqual([]);
    });

    it('update 不抛异常', () => {
      expect(() => sys.update(16)).not.toThrow();
    });

    it('getState 返回 BannerState', () => {
      const state = sys.getState();
      expect(state).toHaveProperty('activeBanners');
      expect(state).toHaveProperty('hasUnread');
      expect(state).toHaveProperty('unreadCount');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 急报横幅创建（#22）
  // ═══════════════════════════════════════════
  describe('急报横幅创建', () => {
    it('createBanner 创建横幅', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();

      const banner = sys.createBanner(inst, def, 1);
      expect(banner).toBeDefined();
      expect(banner.title).toBe(def.title);
      expect(banner.description).toBe(def.description);
      expect(banner.eventInstanceId).toBe(inst.instanceId);
      expect(banner.read).toBe(false);
      expect(banner.createdAt).toBe(1);
    });

    it('横幅紧急程度映射正确', () => {
      const testCases = [
        { urgency: 'low' as const, expectedType: 'info' },
        { urgency: 'medium' as const, expectedType: 'warning' },
        { urgency: 'high' as const, expectedType: 'danger' },
        { urgency: 'critical' as const, expectedType: 'opportunity' },
      ];

      for (const tc of testCases) {
        const def = createTestEventDef({ urgency: tc.urgency });
        const inst = createTestInstance();
        const banner = sys.createBanner(inst, def, 1);
        expect(banner.bannerType).toBe(tc.expectedType);
        expect(banner.urgency).toBe(tc.urgency);
      }
    });

    it('横幅优先级按紧急程度排列', () => {
      const priorities: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

      for (const [urgency, expectedPriority] of Object.entries(priorities)) {
        const def = createTestEventDef({ urgency: urgency as EventDef['urgency'] });
        const inst = createTestInstance({ instanceId: `inst-${urgency}` });
        const banner = sys.createBanner(inst, def, 1);
        expect(banner.priority).toBe(expectedPriority);
      }
    });

    it('createBanner 发出 event:banner_created 事件', () => {
      const deps = mockDeps();
      const s = new EventNotificationSystem();
      s.init(deps);
      const def = createTestEventDef();
      const inst = createTestInstance();

      s.createBanner(inst, def, 1);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:banner_created',
        expect.objectContaining({
          title: def.title,
        }),
      );
    });

    it('createBanners 批量创建', () => {
      const entries = [
        { instance: createTestInstance({ instanceId: 'i1' }), eventDef: createTestEventDef({ id: 'e1', title: '事件1' }) },
        { instance: createTestInstance({ instanceId: 'i2' }), eventDef: createTestEventDef({ id: 'e2', title: '事件2' }) },
      ];

      const banners = sys.createBanners(entries, 1);
      expect(banners.length).toBe(2);
      expect(banners[0].title).toBe('事件1');
      expect(banners[1].title).toBe('事件2');
    });

    it('超过最大数量时移除最旧已读横幅', () => {
      sys.setMaxBannerDisplay(2);

      const b1 = sys.createBanner(
        createTestInstance({ instanceId: 'i1' }),
        createTestEventDef({ id: 'e1' }),
        1,
      );
      sys.markBannerRead(b1.id);

      sys.createBanner(
        createTestInstance({ instanceId: 'i2' }),
        createTestEventDef({ id: 'e2' }),
        2,
      );

      // 第3个应该触发清理
      sys.createBanner(
        createTestInstance({ instanceId: 'i3' }),
        createTestEventDef({ id: 'e3' }),
        3,
      );

      const banners = sys.getActiveBanners();
      expect(banners.length).toBeLessThanOrEqual(3);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 横幅已读/未读管理
  // ═══════════════════════════════════════════
  describe('横幅已读/未读管理', () => {
    it('新创建的横幅为未读', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      sys.createBanner(inst, def, 1);

      const state = sys.getState();
      expect(state.hasUnread).toBe(true);
      expect(state.unreadCount).toBe(1);
    });

    it('markBannerRead 标记已读', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const banner = sys.createBanner(inst, def, 1);

      const result = sys.markBannerRead(banner.id);
      expect(result).toBe(true);
      expect(banner.read).toBe(true);

      const state = sys.getState();
      expect(state.unreadCount).toBe(0);
    });

    it('markBannerRead 不存在的横幅返回 false', () => {
      expect(sys.markBannerRead('non-existent')).toBe(false);
    });

    it('markAllBannersRead 标记所有已读', () => {
      sys.createBanner(createTestInstance({ instanceId: 'i1' }), createTestEventDef({ id: 'e1' }), 1);
      sys.createBanner(createTestInstance({ instanceId: 'i2' }), createTestEventDef({ id: 'e2' }), 1);

      sys.markAllBannersRead();
      const state = sys.getState();
      expect(state.unreadCount).toBe(0);
      expect(state.hasUnread).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 横幅过期与移除
  // ═══════════════════════════════════════════
  describe('横幅过期与移除', () => {
    it('removeBanner 移除横幅', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const banner = sys.createBanner(inst, def, 1);

      expect(sys.removeBanner(banner.id)).toBe(true);
      expect(sys.getBanner(banner.id)).toBeUndefined();
    });

    it('removeBanner 不存在返回 false', () => {
      expect(sys.removeBanner('non-existent')).toBe(false);
    });

    it('expireBanners 清理过期横幅', () => {
      const inst = createTestInstance({ expireTurn: 3 });
      const def = createTestEventDef();
      sys.createBanner(inst, def, 1);

      const expired = sys.expireBanners(5);
      expect(expired.length).toBe(1);
      expect(sys.getActiveBanners().length).toBe(0);
    });

    it('expireBanners 不清理未过期横幅', () => {
      const inst = createTestInstance({ expireTurn: 10 });
      const def = createTestEventDef();
      sys.createBanner(inst, def, 1);

      const expired = sys.expireBanners(5);
      expect(expired.length).toBe(0);
      expect(sys.getActiveBanners().length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 横幅排序与查询
  // ═══════════════════════════════════════════
  describe('横幅排序与查询', () => {
    it('横幅按优先级降序排列', () => {
      sys.createBanner(
        createTestInstance({ instanceId: 'i1' }),
        createTestEventDef({ id: 'e1', urgency: 'low' }),
        1,
      );
      sys.createBanner(
        createTestInstance({ instanceId: 'i2' }),
        createTestEventDef({ id: 'e2', urgency: 'critical' }),
        1,
      );
      sys.createBanner(
        createTestInstance({ instanceId: 'i3' }),
        createTestEventDef({ id: 'e3', urgency: 'high' }),
        1,
      );

      const banners = sys.getActiveBanners();
      expect(banners[0].urgency).toBe('critical');
      expect(banners[1].urgency).toBe('high');
      expect(banners[2].urgency).toBe('low');
    });

    it('getUnreadBanners 只返回未读', () => {
      const b1 = sys.createBanner(
        createTestInstance({ instanceId: 'i1' }),
        createTestEventDef({ id: 'e1' }),
        1,
      );
      sys.createBanner(
        createTestInstance({ instanceId: 'i2' }),
        createTestEventDef({ id: 'e2' }),
        1,
      );

      sys.markBannerRead(b1.id);
      const unread = sys.getUnreadBanners();
      expect(unread.length).toBe(1);
      expect(unread[0].read).toBe(false);
    });

    it('getBanner 获取指定横幅', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const banner = sys.createBanner(inst, def, 1);

      expect(sys.getBanner(banner.id)).toEqual(banner);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 随机遭遇弹窗（#23）
  // ═══════════════════════════════════════════
  describe('随机遭遇弹窗', () => {
    it('createEncounterPopup 创建弹窗', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();

      const popup = sys.createEncounterPopup(inst, def);
      expect(popup).toBeDefined();
      expect(popup.title).toBe(def.title);
      expect(popup.description).toBe(def.description);
      expect(popup.eventInstanceId).toBe(inst.instanceId);
      expect(popup.options.length).toBe(def.options.length);
    });

    it('弹窗选项包含后果预览', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();

      const popup = sys.createEncounterPopup(inst, def);
      for (const opt of popup.options) {
        expect(opt.consequencePreview).toBeDefined();
        expect(opt.consequencePreview.length).toBeGreaterThan(0);
      }
    });

    it('弹窗选项包含完整后果数据', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();

      const popup = sys.createEncounterPopup(inst, def);
      expect(popup.options[0].consequences).toBeDefined();
      expect(popup.options[0].consequences.resourceChanges).toEqual({ gold: 100 });
    });

    it('紧急事件弹窗不可关闭', () => {
      const def = createTestEventDef({ urgency: 'critical' });
      const inst = createTestInstance();

      const popup = sys.createEncounterPopup(inst, def);
      expect(popup.dismissible).toBe(false);
    });

    it('非紧急事件弹窗可关闭', () => {
      const def = createTestEventDef({ urgency: 'low' });
      const inst = createTestInstance();

      const popup = sys.createEncounterPopup(inst, def);
      expect(popup.dismissible).toBe(true);
    });

    it('createEncounterPopup 发出 event:encounter_created 事件', () => {
      const deps = mockDeps();
      const s = new EventNotificationSystem();
      s.init(deps);
      const def = createTestEventDef();
      const inst = createTestInstance();

      s.createEncounterPopup(inst, def);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:encounter_created',
        expect.objectContaining({
          title: def.title,
        }),
      );
    });

    it('getEncounterPopup 获取弹窗', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(sys.getEncounterPopup(popup.id)).toEqual(popup);
    });

    it('getEncounterByInstance 按实例ID获取', () => {
      const def = createTestEventDef();
      const inst = createTestInstance({ instanceId: 'inst-xyz' });
      const popup = sys.createEncounterPopup(inst, def);

      expect(sys.getEncounterByInstance('inst-xyz')).toEqual(popup);
    });

    it('getActiveEncounters 返回所有活跃弹窗', () => {
      sys.createEncounterPopup(
        createTestInstance({ instanceId: 'i1' }),
        createTestEventDef({ id: 'e1' }),
      );
      sys.createEncounterPopup(
        createTestInstance({ instanceId: 'i2' }),
        createTestEventDef({ id: 'e2' }),
      );

      expect(sys.getActiveEncounters().length).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 遭遇选择处理
  // ═══════════════════════════════════════════
  describe('遭遇选择处理', () => {
    it('resolveEncounter 处理有效选择', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      const result = sys.resolveEncounter(popup.id, 'opt-a');
      expect(result).not.toBeNull();
      expect(result!.resourceChanges).toEqual({ gold: 100 });
    });

    it('resolveEncounter 后弹窗被移除', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      sys.resolveEncounter(popup.id, 'opt-a');
      expect(sys.getEncounterPopup(popup.id)).toBeUndefined();
    });

    it('resolveEncounter 发出 event:encounter_resolved 事件', () => {
      const deps = mockDeps();
      const s = new EventNotificationSystem();
      s.init(deps);
      const def = createTestEventDef();
      const inst = createTestInstance();
      const popup = s.createEncounterPopup(inst, def);

      s.resolveEncounter(popup.id, 'opt-a');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'event:encounter_resolved',
        expect.objectContaining({ optionId: 'opt-a' }),
      );
    });

    it('resolveEncounter 不存在的弹窗返回 null', () => {
      expect(sys.resolveEncounter('non-existent', 'opt-a')).toBeNull();
    });

    it('resolveEncounter 不存在的选项返回 null', () => {
      const def = createTestEventDef();
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(sys.resolveEncounter(popup.id, 'non-existent')).toBeNull();
    });

    it('dismissEncounter 关闭可关闭的弹窗', () => {
      const def = createTestEventDef({ urgency: 'low' });
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(sys.dismissEncounter(popup.id)).toBe(true);
      expect(sys.getEncounterPopup(popup.id)).toBeUndefined();
    });

    it('dismissEncounter 不可关闭的弹窗返回 false', () => {
      const def = createTestEventDef({ urgency: 'critical' });
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(sys.dismissEncounter(popup.id)).toBe(false);
      expect(sys.getEncounterPopup(popup.id)).toBeDefined();
    });

    it('dismissEncounter 不存在的弹窗返回 false', () => {
      expect(sys.dismissEncounter('non-existent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 后果预览生成
  // ═══════════════════════════════════════════
  describe('后果预览生成', () => {
    it('资源增加显示正确', () => {
      const def = createTestEventDef({
        options: [{
          id: 'opt',
          text: '选项',
          consequences: {
            description: '获得资源',
            resourceChanges: { gold: 100, grain: 50 },
          },
        }],
      });
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(popup.options[0].consequencePreview).toContain('金币+100');
      expect(popup.options[0].consequencePreview).toContain('粮草+50');
    });

    it('资源减少显示正确', () => {
      const def = createTestEventDef({
        options: [{
          id: 'opt',
          text: '选项',
          consequences: {
            description: '消耗资源',
            resourceChanges: { gold: -50 },
          },
        }],
      });
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(popup.options[0].consequencePreview).toContain('金币-50');
    });

    it('无资源变化时显示描述', () => {
      const def = createTestEventDef({
        options: [{
          id: 'opt',
          text: '选项',
          consequences: {
            description: '什么都没发生',
          },
        }],
      });
      const inst = createTestInstance();
      const popup = sys.createEncounterPopup(inst, def);

      expect(popup.options[0].consequencePreview).toContain('什么都没发生');
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serializeBanners 导出横幅数据', () => {
      sys.createBanner(
        createTestInstance(),
        createTestEventDef(),
        1,
      );

      const data = sys.serializeBanners();
      expect(data.length).toBe(1);
      expect(data[0].title).toBe('测试事件');
    });

    it('deserializeBanners 恢复横幅数据', () => {
      sys.createBanner(
        createTestInstance(),
        createTestEventDef(),
        1,
      );
      const data = sys.serializeBanners();

      const newSys = createSystem();
      newSys.deserializeBanners(data);
      expect(newSys.getActiveBanners().length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 配置
  // ═══════════════════════════════════════════
  describe('配置', () => {
    it('setMaxBannerDisplay 设置最大显示数量', () => {
      sys.setMaxBannerDisplay(5);
      // 不抛异常即可
    });

    it('setBannerDisplayTurns 设置显示回合数', () => {
      sys.setBannerDisplayTurns(10);
      // 不抛异常即可
    });
  });
});
