import {
import { TouchInputSystem } from '../TouchInputSystem';

      it('超过防误触间隔后应正常响应', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        // 第一次点击
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 等待超过防误触间隔
        advanceTime(400); // >300ms
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        expect(gestures.length).toBe(2);
      });
    });

    describe('触控反馈配置', () => {
      it('默认配置应正确', () => {
        const config = system.feedbackConfig;
        expect(config.type).toBe(TouchFeedbackType.LightVibration);
        expect(config.visualScaleValue).toBeCloseTo(0.96);
        expect(config.vibrationEnabled).toBe(true);
      });

      it('setFeedbackConfig应更新配置', () => {
        system.setFeedbackConfig({ vibrationEnabled: false });
        expect(system.feedbackConfig.vibrationEnabled).toBe(false);
        expect(system.feedbackConfig.type).toBe(TouchFeedbackType.LightVibration); // 未变
      });
    });
  });

  // ═══════════════════════════════════════════
  // #10 武将编队触控
  // ═══════════════════════════════════════════

  describe('武将编队触控 (#10)', () => {
    it('SelectHero应选中武将', () => {
      const events: any[] = [];
      system.onFormationTouch((e) => events.push(e));

      const result = system.handleFormationTouch(FormationTouchAction.SelectHero, {
        heroId: 'hero-liubei',
      });

      expect(result).not.toBeNull();
      expect(result!.action).toBe(FormationTouchAction.SelectHero);
      expect(result!.heroId).toBe('hero-liubei');
      expect(system.selectedHeroId).toBe('hero-liubei');
    });

    it('DeployToSlot应部署选中武将到指定格子', () => {
      const events: any[] = [];
      system.onFormationTouch((e) => events.push(e));

      // 先选中武将
      system.handleFormationTouch(FormationTouchAction.SelectHero, {
        heroId: 'hero-liubei',
      });

      // 部署到格子0
      const result = system.handleFormationTouch(FormationTouchAction.DeployToSlot, {
        slotIndex: 0,
      });

      expect(result).not.toBeNull();
      expect(result!.action).toBe(FormationTouchAction.DeployToSlot);
      expect(result!.heroId).toBe('hero-liubei');
      expect(result!.slotIndex).toBe(0);
      // 部署后应清除选中
      expect(system.selectedHeroId).toBeNull();
    });

    it('DeployToSlot无选中武将应返回null', () => {
      const result = system.handleFormationTouch(FormationTouchAction.DeployToSlot, {
        slotIndex: 0,
      });
      expect(result).toBeNull();
    });

    it('RemoveFromSlot应移除指定格子的武将', () => {
      const events: any[] = [];
      system.onFormationTouch((e) => events.push(e));

      const result = system.handleFormationTouch(FormationTouchAction.RemoveFromSlot, {
        slotIndex: 2,
      });

      expect(result).not.toBeNull();
      expect(result!.action).toBe(FormationTouchAction.RemoveFromSlot);
      expect(result!.slotIndex).toBe(2);
    });

    it('SwapSlots应互换两个格子', () => {
      const events: any[] = [];
      system.onFormationTouch((e) => events.push(e));

      const result = system.handleFormationTouch(FormationTouchAction.SwapSlots, {
        slotIndex: 0,
        secondSlotIndex: 2,
      });

      expect(result).not.toBeNull();
      expect(result!.action).toBe(FormationTouchAction.SwapSlots);
      expect(result!.slotIndex).toBe(0);
      expect(result!.secondSlotIndex).toBe(2);
    });

    it('SwapSlots缺少第二个格子应返回null', () => {
      const result = system.handleFormationTouch(FormationTouchAction.SwapSlots, {
        slotIndex: 0,
      });
      expect(result).toBeNull();
    });

    it('clearFormationSelection应清除选中状态', () => {
      system.handleFormationTouch(FormationTouchAction.SelectHero, {
        heroId: 'hero-liubei',
      });
      expect(system.selectedHeroId).toBe('hero-liubei');

      system.clearFormationSelection();
      expect(system.selectedHeroId).toBeNull();
      expect(system.selectedSlotIndex).toBeNull();
    });

    it('编队操作应触发监听器', () => {
      const events: any[] = [];
      system.onFormationTouch((e) => events.push(e));

      system.handleFormationTouch(FormationTouchAction.SelectHero, {
        heroId: 'hero-guanyu',
      });

      expect(events.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // #15 桌面端交互规范
  // ═══════════════════════════════════════════

  describe('桌面端交互规范 (#15)', () => {
    it('handleDesktopInteraction应触发监听器', () => {
      const events: any[] = [];
      system.onDesktopInteraction((e) => events.push(e));

      system.handleDesktopInteraction(DesktopInteractionType.Click, 100, 200);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(DesktopInteractionType.Click);
      expect(events[0].x).toBe(100);
      expect(events[0].y).toBe(200);
    });

    it('应支持所有7种桌面交互类型', () => {
      const types = [
        DesktopInteractionType.Click,
        DesktopInteractionType.RightClick,
        DesktopInteractionType.Hover,
        DesktopInteractionType.Drag,
        DesktopInteractionType.Scroll,
        DesktopInteractionType.LongPress,
        DesktopInteractionType.ShiftClick,
      ];

      for (const type of types) {
        const events: any[] = [];
        system.onDesktopInteraction((e) => events.push(e));
        system.handleDesktopInteraction(type, 0, 0);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(type);
      }
    });

    it('附加数据应正确传递', () => {
      const events: any[] = [];
      system.onDesktopInteraction((e) => events.push(e));

      system.handleDesktopInteraction(DesktopInteractionType.Scroll, 0, 0, {
        deltaY: 120,
      });

      expect(events[0].data).toEqual({ deltaY: 120 });
    });
  });

  // ═══════════════════════════════════════════
  // #16 快捷键映射
  // ═══════════════════════════════════════════

  describe('快捷键映射 (#16)', () => {
    it('T键应映射到open-map', () => {
      const result = system.handleKeyDown('t');
      expect(result).toBe('open-map');
    });

    it('H键应映射到open-heroes', () => {
      const result = system.handleKeyDown('h');
      expect(result).toBe('open-heroes');
    });

    it('K键应映射到open-tech', () => {
      const result = system.handleKeyDown('k');
      expect(result).toBe('open-tech');
    });

    it('C键应映射到open-campaign', () => {
      const result = system.handleKeyDown('c');
      expect(result).toBe('open-campaign');
    });

    it('Space键应映射到toggle-pause', () => {
      const result = system.handleKeyDown(' ');
      expect(result).toBe('toggle-pause');
    });

    it('Escape键应映射到close-panel', () => {
      const result = system.handleKeyDown('escape');
      expect(result).toBe('close-panel');
    });

    it('Ctrl+S应映射到save-game', () => {
      const result = system.handleKeyDown('s', true, false, false);
      expect(result).toBe('save-game');
    });

    it('无修饰符S不应触发save-game', () => {
      const result = system.handleKeyDown('s', false, false, false);
      expect(result).toBeNull();
    });

    it('未映射的键应返回null', () => {
      const result = system.handleKeyDown('z');
      expect(result).toBeNull();
    });

    it('快捷键应触发监听器', () => {
      const actions: string[] = [];
      system.onHotkey((action) => actions.push(action));

      system.handleKeyDown('t');
      system.handleKeyDown('h');

      expect(actions).toEqual(['open-map', 'open-heroes']);
    });

    it('getHotkeys应返回当前映射表', () => {
      const hotkeys = system.getHotkeys();
      expect(hotkeys.length).toBeGreaterThan(0);
    });

    it('setHotkeys应更新映射表', () => {
      system.setHotkeys([{ key: 'x', description: '测试', action: 'test-action' }]);

      const result = system.handleKeyDown('x');
      expect(result).toBe('test-action');
    });
  });

  // ═══════════════════════════════════════════
  // 事件监听管理
  // ═══════════════════════════════════════════

  describe('事件监听管理', () => {
    it('onGesture返回的取消函数应正确工作', () => {
      const gestures: any[] = [];
      const unsub = system.onGesture((e) => gestures.push(e));

      system.handleTouchStart(100, 100);
      advanceTime(100);
      system.handleTouchEnd(100, 100);
      expect(gestures.length).toBe(1);

      unsub();
      system.handleTouchStart(100, 100);
      advanceTime(100);
      system.handleTouchEnd(100, 100);
      expect(gestures.length).toBe(1);
    });

    it('clearAllListeners应清除所有监听器', () => {
      const gestures: any[] = [];
      const formations: any[] = [];
      const desktops: any[] = [];
      const hotkeys: string[] = [];

      system.onGesture((e) => gestures.push(e));
      system.onFormationTouch((e) => formations.push(e));
      system.onDesktopInteraction((e) => desktops.push(e));
      system.onHotkey((a) => hotkeys.push(a));

      system.clearAllListeners();

      // 操作后不应有回调
      system.handleTouchStart(100, 100);
      advanceTime(100);
      system.handleTouchEnd(100, 100);
      system.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'h1' });
      system.handleDesktopInteraction(DesktopInteractionType.Click, 0, 0);
      system.handleKeyDown('t');

      expect(gestures.length).toBe(0);
      expect(formations.length).toBe(0);
      expect(desktops.length).toBe(0);
      expect(hotkeys.length).toBe(0);
    });
  });
});
