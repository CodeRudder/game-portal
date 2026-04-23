import { EventNotificationSystem } from '../EventNotificationSystem';
import type { ISystemDeps } from '../../../core/types';
import type {

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
