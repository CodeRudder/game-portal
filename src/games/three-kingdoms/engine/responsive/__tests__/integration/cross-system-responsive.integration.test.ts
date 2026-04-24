/**
 * §5.1~§5.6 交叉验证 — 集成测试
 *
 * 覆盖 v17.0 竖屏适配全链路：
 * - §5.1 竖屏 → 触控 → UI 全链路
 * - §5.2 跨平台一致性（桌面/平板/手机）
 * - §5.3 省电 → 性能 → 触控闭环
 * - §5.4 设置变更 → 布局联动
 * - §5.5 导航 + 手势 + 面板交互
 * - §5.6 边界条件与异常场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Breakpoint,
  PowerSaveLevel,
  FontSizeLevel,
  FONT_SIZE_MAP,
  GestureType,
  GESTURE_THRESHOLDS,
  FormationTouchAction,
  DesktopInteractionType,
  WhitespaceStrategy,
  MOBILE_LAYOUT,
  type GestureEvent,
  type FormationTouchEvent,
  type DesktopInteractionEvent,
  type ResponsiveLayoutSnapshot,
} from '../../../../core/responsive/responsive.types';
import { ResponsiveLayoutManager } from '../../ResponsiveLayoutManager';
import { MobileLayoutManager } from '../../MobileLayoutManager';
import { MobileSettingsSystem } from '../../MobileSettingsSystem';
import { PowerSaveSystem } from '../../PowerSaveSystem';
import { TouchInteractionSystem } from '../../TouchInteractionSystem';

describe('§5.1~§5.6 交叉验证 — 集成测试', () => {
  let rm: ResponsiveLayoutManager;
  let ml: MobileLayoutManager;
  let settings: MobileSettingsSystem;
  let powerSave: PowerSaveSystem;
  let touch: TouchInteractionSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    rm = new ResponsiveLayoutManager();
    ml = new MobileLayoutManager(rm);
    settings = new MobileSettingsSystem();
    powerSave = new PowerSaveSystem();
    touch = new TouchInteractionSystem();
  });

  afterEach(() => {
    rm.reset?.();
    ml.reset();
    settings.reset();
    powerSave.reset();
    touch.reset();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════
  // §5.1 竖屏 → 触控 → UI 全链路
  // ═══════════════════════════════════════════════

  describe('§5.1 竖屏 → 触控 → UI 全链路', () => {
    it('竖屏手机端：布局 → 触控 → Tab导航 联动', () => {
      // 设置竖屏手机视口
      rm.updateViewport(375, 812);
      expect(rm.isMobile).toBe(true);
      expect(rm.orientation).toBe('portrait');

      // 手机端布局计算
      const layout = ml.calculateMobileLayout(375, 812);
      expect(layout.sceneAreaHeight).toBeGreaterThan(0);
      expect(layout.tabBar.safeAreaHeight).toBe(MOBILE_LAYOUT.tabBarHeight);

      // 触控点击Tab区域
      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));
      touch.handleTouchStart(187, 780, 0);
      const result = touch.handleTouchEnd(187, 780, 100);
      expect(result).toBe(GestureType.Tap);
      expect(gestures).toHaveLength(1);
    });

    it('竖屏手机端：左滑手势 → 面板返回', () => {
      rm.updateViewport(375, 812);
      ml.openFullScreenPanel('heroes', '武将列表');

      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));

      // 左滑手势（duration > 150ms, distance > 80px 左方向）
      touch.handleTouchStart(300, 400, 0);
      touch.handleTouchMove(200, 400, 100);
      const result = touch.handleTouchEnd(200, 400, 200);

      expect(result).toBe(GestureType.SwipeLeft);
      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe(GestureType.SwipeLeft);

      // 面板处理左滑返回
      const handled = ml.handleSwipeBack();
      expect(handled).toBe(true);
      expect(ml.fullScreenPanel.isOpen).toBe(false);
    });

    it('竖屏手机端：下拉手势 → 无匹配面板操作', () => {
      rm.updateViewport(375, 812);

      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));

      // 下拉手势（duration > 150ms, dy > 60px）
      touch.handleTouchStart(187, 100, 0);
      touch.handleTouchMove(187, 200, 100);
      const result = touch.handleTouchEnd(187, 200, 200);

      expect(result).toBe(GestureType.PullDown);
      expect(gestures[0].type).toBe(GestureType.PullDown);
    });

    it('竖屏手机端：双指缩放 → 地图缩放', () => {
      rm.updateViewport(375, 812);

      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));

      touch.handlePinchStart(100, 1.0);
      const newScale = touch.handlePinchMove(150);
      expect(newScale).toBe(1.5);

      touch.handlePinchEnd(1.5);
      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe(GestureType.Pinch);
      expect(gestures[0].scale).toBe(1.5);
    });

    it('竖屏：布局变更回调 → 触控系统感知方向', () => {
      const snapshots: ResponsiveLayoutSnapshot[] = [];
      rm.onLayoutChange((s) => snapshots.push(s));

      // 从横屏切竖屏
      rm.updateViewport(812, 375); // landscape
      rm.updateViewport(375, 812); // portrait

      const portraitSnap = snapshots[snapshots.length - 1];
      expect(portraitSnap.orientation).toBe('portrait');
      expect(portraitSnap.isMobile).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // §5.2 跨平台一致性（桌面/平板/手机）
  // ═══════════════════════════════════════════════

  describe('§5.2 跨平台一致性（桌面/平板/手机）', () => {
    it('桌面端：非手机布局，桌面交互正常', () => {
      rm.updateViewport(1920, 1080);
      expect(rm.isDesktop).toBe(true);
      expect(rm.isMobile).toBe(false);
      expect(ml.isMobileMode).toBe(false);

      // 桌面端交互
      const events: DesktopInteractionEvent[] = [];
      touch.onDesktopInteraction((e) => events.push(e));
      const evt = TouchInteractionSystem.createDesktopEvent(
        DesktopInteractionType.Click, 500, 300,
      );
      touch.handleDesktopInteraction(evt);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(DesktopInteractionType.Click);
    });

    it('平板端：识别为平板，非手机非桌面', () => {
      rm.updateViewport(768, 1024);
      expect(rm.isTablet).toBe(true);
      expect(rm.isMobile).toBe(false);
      expect(rm.isDesktop).toBe(false);
    });

    it('手机端：触控目标≥44px 满足跨平台最小触控要求', () => {
      rm.updateViewport(375, 812);

      // 小按钮20x20，扩大到44x44
      expect(touch.isTouchTargetHit(100, 100, 100, 100, 20, 20)).toBe(true);
      // 超出44px扩展范围
      expect(touch.isTouchTargetHit(130, 100, 100, 100, 20, 20)).toBe(false);
    });

    it('跨平台：快捷键在桌面端生效', () => {
      const actions: string[] = [];
      touch.onHotkey((a) => actions.push(a));

      const result = touch.handleKeyPress('t');
      expect(result).toBe('open-map');
      expect(actions).toContain('open-map');
    });

    it('跨平台：Ctrl+S 保存游戏', () => {
      const result = touch.handleKeyPress('s', true);
      expect(result).toBe('save-game');
    });

    it('跨平台：未映射按键返回null', () => {
      const result = touch.handleKeyPress('z');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════
  // §5.3 省电 → 性能 → 触控闭环
  // ═══════════════════════════════════════════════

  describe('§5.3 省电 → 性能 → 触控闭环', () => {
    it('省电模式开启 → 帧率降低 → 触控反馈仍正常', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      powerSave.enable();

      expect(settings.currentFps).toBe(30);
      expect(powerSave.getTargetFps()).toBe(30);

      // 触控反馈不受省电影响
      expect(touch.getVisualScale(true)).toBe(0.96);
      expect(touch.getVisualScale(false)).toBe(1.0);
    });

    it('省电模式：帧节流与触控防误触独立运行', () => {
      powerSave.enable();

      // 帧节流
      expect(powerSave.shouldSkipFrame(0, 20)).toBe(true);
      expect(powerSave.shouldSkipFrame(0, 40)).toBe(false);

      // 触控防误触
      expect(touch.shouldBounce(1000)).toBe(false); // 首次
      expect(touch.shouldBounce(1100)).toBe(true);  // 100ms < 300ms
      expect(touch.shouldBounce(1400)).toBe(false); // 400ms > 300ms
    });

    it('低电量自动省电 → 性能降级 → 粒子/阴影关闭', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(10, false);

      expect(settings.isPowerSaveActive).toBe(true);
      expect(settings.shouldDisableParticles).toBe(true);
      expect(settings.shouldDisableShadows).toBe(true);

      // 充电后恢复
      settings.updateBatteryStatus(10, true);
      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.shouldDisableParticles).toBe(false);
    });

    it('省电模式变更通知 → 外部系统可感知', () => {
      const settingsListener = vi.fn();
      const powerSaveListener = vi.fn();
      settings.onPowerSaveChange(settingsListener);
      powerSave.onStateChange(powerSaveListener);

      settings.setPowerSaveLevel(PowerSaveLevel.On);
      powerSave.enable();

      expect(settingsListener).toHaveBeenCalledTimes(1);
      expect(powerSaveListener).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════
  // §5.4 设置变更 → 布局联动
  // ═══════════════════════════════════════════════

  describe('§5.4 设置变更 → 布局联动', () => {
    it('字体大小变更 → LayoutManager 同步', () => {
      settings.setFontSize(FontSizeLevel.Large);
      rm.setFontSize(FontSizeLevel.Large);

      expect(settings.fontSize).toBe(FontSizeLevel.Large);
      expect(rm.fontSize).toBe(FontSizeLevel.Large);
      expect(rm.fontSizePx).toBe(16);
    });

    it('左手模式 → LayoutManager 镜像', () => {
      rm.setLeftHandMode(true);
      expect(rm.leftHandMode).toBe(true);
    });

    it('省电模式配置自定义 → 两者行为同步', () => {
      settings.setPowerSaveConfig({ targetFps: 24, autoTriggerBatteryLevel: 30 });
      powerSave.updateConfig({ targetFps: 24, autoTriggerBatteryLevel: 30 });

      settings.setPowerSaveLevel(PowerSaveLevel.On);
      powerSave.enable();

      expect(settings.currentFps).toBe(24);
      expect(powerSave.getTargetFps()).toBe(24);

      // 自动模式在30%阈值触发
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      powerSave.setLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(30, false);
      powerSave.updateBatteryStatus(30, false);

      expect(settings.isPowerSaveActive).toBe(true);
      expect(powerSave.isActive).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // §5.5 导航 + 手势 + 面板交互
  // ═══════════════════════════════════════════════

  describe('§5.5 导航 + 手势 + 面板交互', () => {
    it('编队触控全流程：选中→部署→互换→移除', () => {
      const events: FormationTouchEvent[] = [];
      touch.onFormationTouch((e) => events.push(e));

      touch.formationSelectHero('hero-zhaoyun');
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe(FormationTouchAction.SelectHero);
      expect(events[0].heroId).toBe('hero-zhaoyun');

      touch.formationDeployToSlot(0);
      expect(events).toHaveLength(2);
      expect(events[1].action).toBe(FormationTouchAction.DeployToSlot);
      expect(events[1].slotIndex).toBe(0);

      touch.formationSwapSlots(0, 1);
      expect(events).toHaveLength(3);
      expect(events[2].action).toBe(FormationTouchAction.SwapSlots);

      touch.formationRemoveFromSlot(0);
      expect(events).toHaveLength(4);
      expect(events[3].action).toBe(FormationTouchAction.RemoveFromSlot);
    });

    it('导航面板深度 + 面包屑联动', () => {
      ml.openFullScreenPanel('map', '地图');
      expect(ml.navigationPath.depth).toBe(0); // 面板打开但stack为空
      expect(ml.navigationPath.canGoBack).toBe(true);

      ml.openFullScreenPanel('map-detail', '地图详情');
      expect(ml.navigationPath.depth).toBe(1);

      const crumbs = ml.getBreadcrumbs();
      expect(crumbs.length).toBeGreaterThanOrEqual(2);
    });

    it('Bottom Sheet 打开/关闭/更新高度', () => {
      ml.openBottomSheet('hero-info', 300);
      expect(ml.bottomSheet.isOpen).toBe(true);
      expect(ml.bottomSheet.contentHeight).toBe(300);

      ml.updateBottomSheetHeight(400);
      expect(ml.bottomSheet.contentHeight).toBe(400);

      ml.closeBottomSheet();
      expect(ml.bottomSheet.isOpen).toBe(false);
    });

    it('Tab切换 → 关闭面板和Sheet', () => {
      ml.openFullScreenPanel('heroes', '武将');
      ml.openBottomSheet('detail', 200);

      ml.switchTab('heroes');
      expect(ml.fullScreenPanel.isOpen).toBe(false);
      expect(ml.bottomSheet.isOpen).toBe(false);
    });

    it('长按手势识别 → 编队移除', () => {
      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));

      touch.handleTouchStart(100, 200, 0);
      // 触发长按（500ms后）
      vi.advanceTimersByTime(600);
      touch.handleTouchEnd(100, 200, 650);

      expect(gestures).toHaveLength(1);
      expect(gestures[0].type).toBe(GestureType.LongPress);
    });

    it('双击手势识别', () => {
      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));

      // 第一次点击
      touch.handleTouchStart(100, 100, 0);
      touch.handleTouchEnd(100, 100, 100);
      // 第二次点击（200ms内）
      touch.handleTouchStart(100, 100, 200);
      touch.handleTouchEnd(100, 100, 250);

      // 应该识别出双击
      const doubleTap = gestures.find((g) => g.type === GestureType.DoubleTap);
      expect(doubleTap).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════
  // §5.6 边界条件与异常场景
  // ═══════════════════════════════════════════════

  describe('§5.6 边界条件与异常场景', () => {
    it('极小屏幕 (MobileS 320px) 仍可正常布局', () => {
      rm.updateViewport(320, 568);
      expect(rm.currentBreakpoint).toBe(Breakpoint.MobileS);
      expect(rm.isMobile).toBe(true);

      const layout = ml.calculateMobileLayout(320, 568);
      expect(layout.sceneAreaHeight).toBeGreaterThan(0);
    });

    it('4K大屏 (DesktopL) 画布缩放不超过上限', () => {
      rm.updateViewport(3840, 2160, 2);
      expect(rm.currentBreakpoint).toBe(Breakpoint.DesktopL);

      const snap = rm.getSnapshot();
      expect(snap.canvasScale.scale).toBeLessThanOrEqual(2.0);
    });

    it('未选中武将时 DeployToSlot 不触发事件', () => {
      const events: FormationTouchEvent[] = [];
      touch.onFormationTouch((e) => events.push(e));

      touch.resetFormationSelection();
      touch.formationDeployToSlot(0);

      expect(events).toHaveLength(0);
    });

    it('触控系统：无 touchStart 直接 touchEnd 返回 null', () => {
      touch.reset();
      const result = touch.handleTouchEnd(100, 100, 0);
      expect(result).toBeNull();
    });

    it('PinchMove 在 startDistance=0 时返回初始缩放', () => {
      touch.handlePinchStart(0, 1.0);
      const scale = touch.handlePinchMove(100);
      expect(scale).toBe(1.0);
    });

    it('多次 reset 后系统仍可正常使用', () => {
      for (let i = 0; i < 5; i++) {
        settings.reset();
        powerSave.reset();
        touch.reset();
      }

      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.isPowerSaveActive).toBe(true);

      powerSave.enable();
      expect(powerSave.isActive).toBe(true);

      touch.handleTouchStart(100, 100, 0);
      const r = touch.handleTouchEnd(100, 100, 50);
      expect(r).toBe(GestureType.Tap);
    });

    it('快速连续操作：省电开关切换稳定性', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);

      for (let i = 0; i < 10; i++) {
        settings.setPowerSaveLevel(i % 2 === 0 ? PowerSaveLevel.On : PowerSaveLevel.Off);
      }

      // 每次状态变更都应通知（On→Off→On→Off...）
      expect(listener.mock.calls.length).toBeGreaterThan(0);
      // 最终状态取决于最后一次设置
      expect(settings.isPowerSaveActive).toBe(false); // 第10次(i=9)是Off
    });

    it('导航到根路径 → 关闭所有面板', () => {
      ml.openFullScreenPanel('panel1', '面板1');
      ml.openFullScreenPanel('panel2', '面板2');
      ml.openFullScreenPanel('panel3', '面板3');

      const result = ml.navigateToBreadcrumb('root');
      expect(result).toBe(true);
      expect(ml.fullScreenPanel.isOpen).toBe(false);
      expect(ml.navigationPath.depth).toBe(0);
    });

    it('switchTab 无效ID → 返回 false', () => {
      const result = ml.switchTab('non-existent-tab');
      expect(result).toBe(false);
    });

    it('navigateToBreadcrumb 无效路径 → 返回 false', () => {
      const result = ml.navigateToBreadcrumb('invalid-path');
      expect(result).toBe(false);
    });

    it('防误触：快速双击第二次被拦截', () => {
      const gestures: GestureEvent[] = [];
      touch.onGesture((e) => gestures.push(e));

      // 第一次点击
      touch.handleTouchStart(100, 100, 0);
      touch.handleTouchEnd(100, 100, 100);

      // 极快第二次点击（防误触间隔内）
      touch.handleTouchStart(100, 100, 150);
      const result = touch.handleTouchEnd(100, 100, 200);

      // 第二次点击应被防误触拦截（返回null被as unknown转为GestureType）
      // 但不应是DoubleTap，因为间隔太短
      const taps = gestures.filter((g) => g.type === GestureType.Tap);
      expect(taps.length).toBe(1); // 只有第一次Tap
    });
  });
});
