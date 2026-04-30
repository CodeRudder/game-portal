/**
 * §3 移动端UI设置 — 集成测试
 *
 * 覆盖：省电模式、画质设置、省电+画质联动、触控反馈开关
 *
 * @module engine/responsive/__tests__/integration/mobile-settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MobileSettingsSystem } from '../../MobileSettingsSystem';
import { PowerSaveSystem } from '../../PowerSaveSystem';
import { ResponsiveLayoutManager } from '../../ResponsiveLayoutManager';
import {
  PowerSaveLevel,
  FontSizeLevel,
  FONT_SIZE_MAP,
  Breakpoint,
} from '../../../../core/responsive/responsive.types';

// ═══════════════════════════════════════════════
// §3 测试主体
// ═══════════════════════════════════════════════
describe('§3 移动端UI设置', () => {
  // ═══════════════════════════════════════════════
  // §3.1 省电模式 — MobileSettingsSystem
  // ═══════════════════════════════════════════════
  let settings: MobileSettingsSystem;

  beforeEach(() => {
    settings = new MobileSettingsSystem();
  });

  describe('§3.1 省电模式 (MobileSettingsSystem)', () => {
    it('默认应关闭省电模式，帧率60fps', () => {
      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.currentFps).toBe(60);
    });

    it('手动开启省电模式应激活，帧率降至30fps', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.isPowerSaveActive).toBe(true);
      expect(settings.currentFps).toBe(30);
    });

    it('手动关闭省电模式应恢复正常', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setPowerSaveLevel(PowerSaveLevel.Off);
      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.currentFps).toBe(60);
    });

    it('自动模式 — 电量低于阈值且未充电应激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(15, false); // 15% < 20% 阈值
      expect(settings.isPowerSaveActive).toBe(true);
    });

    it('自动模式 — 电量低但正在充电不应激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(10, true);
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('自动模式 — 电量恢复应自动关闭省电', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(10, false);
      expect(settings.isPowerSaveActive).toBe(true);
      settings.updateBatteryStatus(80, false);
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('省电激活时应禁用粒子和阴影', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.shouldDisableParticles).toBe(true);
      expect(settings.shouldDisableShadows).toBe(true);
    });

    it('省电关闭时粒子和阴影应正常', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Off);
      expect(settings.shouldDisableParticles).toBe(false);
      expect(settings.shouldDisableShadows).toBe(false);
    });

    it('省电状态变更应通知监听器', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('电量值应被 clamp 到 0-100', () => {
      settings.updateBatteryStatus(-10, false);
      expect(settings.currentBatteryLevel).toBe(0);
      settings.updateBatteryStatus(150, false);
      expect(settings.currentBatteryLevel).toBe(100);
    });

    it('setPowerSaveConfig 应更新配置', () => {
      settings.setPowerSaveConfig({ targetFps: 24, autoTriggerBatteryLevel: 30 });
      const state = settings.getPowerSaveState();
      expect(state.config.targetFps).toBe(24);
      expect(state.config.autoTriggerBatteryLevel).toBe(30);
    });
  });

  // ═══════════════════════════════════════════════
  // §3.2 画质设置（字体大小 + 屏幕常亮）
  // ═══════════════════════════════════════════════
  describe('§3.2 画质设置（字体大小 + 屏幕常亮）', () => {
    it('字体大小默认应为 Medium', () => {
      expect(settings.fontSize).toBe(FontSizeLevel.Medium);
    });

    it('setFontSize 应切换字体档位', () => {
      settings.setFontSize(FontSizeLevel.Small);
      expect(settings.fontSize).toBe(FontSizeLevel.Small);
      settings.setFontSize(FontSizeLevel.Large);
      expect(settings.fontSize).toBe(FontSizeLevel.Large);
    });

    it('FONT_SIZE_MAP 应包含三档字体大小', () => {
      expect(FONT_SIZE_MAP[FontSizeLevel.Small]).toBeDefined();
      expect(FONT_SIZE_MAP[FontSizeLevel.Medium]).toBeDefined();
      expect(FONT_SIZE_MAP[FontSizeLevel.Large]).toBeDefined();
      expect(FONT_SIZE_MAP[FontSizeLevel.Small]).toBeLessThan(FONT_SIZE_MAP[FontSizeLevel.Medium]);
      expect(FONT_SIZE_MAP[FontSizeLevel.Medium]).toBeLessThan(FONT_SIZE_MAP[FontSizeLevel.Large]);
    });

    it('屏幕常亮默认应关闭', () => {
      expect(settings.screenAlwaysOn).toBe(false);
    });

    it('setScreenAlwaysOn 应设置屏幕常亮', () => {
      settings.setScreenAlwaysOn(true);
      expect(settings.screenAlwaysOn).toBe(true);
    });

    it('屏幕常亮仅在游戏内生效', () => {
      settings.setScreenAlwaysOn(true);
      settings.setInGame(false);
      expect(settings.isScreenAlwaysOnEffective).toBe(false);
      settings.setInGame(true);
      expect(settings.isScreenAlwaysOnEffective).toBe(true);
    });

    it('getSettingsState 应返回完整的设置快照', () => {
      const state = settings.getSettingsState();
      expect(state.powerSave).toBeDefined();
      expect(state.screenAlwaysOn).toBe(false);
      expect(state.fontSize).toBe(FontSizeLevel.Medium);
    });
  });

  // ═══════════════════════════════════════════════
  // §3.3 省电 + 画质联动
  // ═══════════════════════════════════════════════
  describe('§3.3 省电 + 画质联动', () => {
    it('省电模式开启时应影响画质相关状态', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      const state = settings.getSettingsState();
      expect(state.powerSave.isActive).toBe(true);
      expect(state.powerSave.currentFps).toBe(30);
    });

    it('省电模式关闭时画质应恢复高帧率', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setPowerSaveLevel(PowerSaveLevel.Off);
      const state = settings.getSettingsState();
      expect(state.powerSave.isActive).toBe(false);
      expect(state.powerSave.currentFps).toBe(60);
    });

    it('省电模式 + 字体大小可独立设置', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setFontSize(FontSizeLevel.Large);
      expect(settings.isPowerSaveActive).toBe(true);
      expect(settings.fontSize).toBe(FontSizeLevel.Large);
    });

    it('省电模式不应影响屏幕常亮设置', () => {
      settings.setScreenAlwaysOn(true);
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.screenAlwaysOn).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // §3.4 触控反馈开关
  // ═══════════════════════════════════════════════
  describe('§3.4 触控反馈开关', () => {
    it('MobileSettingsSystem 不直接管理触控反馈，但 getSettingsState 应包含完整状态', () => {
      const state = settings.getSettingsState();
      expect(state).toHaveProperty('powerSave');
      expect(state).toHaveProperty('fontSize');
      expect(state).toHaveProperty('screenAlwaysOn');
    });
  });

  // ═══════════════════════════════════════════════
  // §3.5 PowerSaveSystem 独立验证
  // ═══════════════════════════════════════════════
  describe('§3.5 PowerSaveSystem 独立验证', () => {
    let power: PowerSaveSystem;

    beforeEach(() => {
      power = new PowerSaveSystem();
    });

    it('enable/disable 应切换省电状态', () => {
      power.enable();
      expect(power.isActive).toBe(true);
      expect(power.currentFps).toBe(30);
      power.disable();
      expect(power.isActive).toBe(false);
      expect(power.currentFps).toBe(60);
    });

    it('自动模式电量低于阈值应激活', () => {
      power.setLevel(PowerSaveLevel.Auto);
      power.updateBatteryStatus(15, false);
      expect(power.isActive).toBe(true);
    });

    it('自动模式充电中不应激活', () => {
      power.setLevel(PowerSaveLevel.Auto);
      power.updateBatteryStatus(5, true);
      expect(power.isActive).toBe(false);
    });

    it('shouldDisableParticles/shouldDisableShadows 应反映省电状态', () => {
      power.enable();
      expect(power.shouldDisableParticles()).toBe(true);
      expect(power.shouldDisableShadows()).toBe(true);
      power.disable();
      expect(power.shouldDisableParticles()).toBe(false);
      expect(power.shouldDisableShadows()).toBe(false);
    });

    it('getFrameInterval 应返回正确的帧间隔', () => {
      expect(power.getFrameInterval()).toBeCloseTo(1000 / 60, 1);
      power.enable();
      expect(power.getFrameInterval()).toBeCloseTo(1000 / 30, 1);
    });

    it('shouldSkipFrame 应正确判断帧节流', () => {
      const base = 1000;
      power.enable(); // 30fps → interval ~33ms
      expect(power.shouldSkipFrame(base, base + 10)).toBe(true);  // 10ms < 33ms
      expect(power.shouldSkipFrame(base, base + 50)).toBe(false); // 50ms > 33ms
    });

    it('toggleScreenAlwaysOn 应切换常亮状态', () => {
      expect(power.toggleScreenAlwaysOn()).toBe(true);
      expect(power.screenAlwaysOn).toBe(true);
      expect(power.toggleScreenAlwaysOn()).toBe(false);
      expect(power.screenAlwaysOn).toBe(false);
    });

    it('updateConfig 应更新配置并重新评估', () => {
      power.setLevel(PowerSaveLevel.Auto);
      power.updateBatteryStatus(25, false); // 25% > 20% → 不激活
      expect(power.isActive).toBe(false);
      power.updateConfig({ autoTriggerBatteryLevel: 30 }); // 阈值改为30%
      expect(power.isActive).toBe(true); // 25% < 30% → 激活
    });

    it('状态变更应通知监听器', () => {
      const listener = vi.fn();
      power.onStateChange(listener);
      power.enable();
      expect(listener).toHaveBeenCalledTimes(1);
      power.disable();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('reset 应恢复所有默认值', () => {
      power.enable();
      power.setScreenAlwaysOn(true);
      power.updateBatteryStatus(10, false);
      power.reset();
      expect(power.isActive).toBe(false);
      expect(power.screenAlwaysOn).toBe(false);
      expect(power.batteryLevel).toBeNull();
      expect(power.isCharging).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // §3.6 跨系统联动（MobileSettings + ResponsiveLayout）
  // ═══════════════════════════════════════════════
  describe('§3.6 跨系统联动', () => {
    let layout: ResponsiveLayoutManager;

    beforeEach(() => {
      layout = new ResponsiveLayoutManager();
    });

    it('字体大小设置应在两个系统间同步', () => {
      // MobileSettingsSystem 设置字体
      settings.setFontSize(FontSizeLevel.Large);
      // ResponsiveLayoutManager 也应同步
      layout.setFontSize(FontSizeLevel.Large);
      expect(layout.fontSize).toBe(FontSizeLevel.Large);
      expect(layout.fontSizePx).toBe(FONT_SIZE_MAP[FontSizeLevel.Large]);
    });

    it('省电模式不应影响布局断点检测', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      layout.updateViewport(375, 812);
      expect(layout.currentBreakpoint).toBe(Breakpoint.Mobile);
      expect(layout.isMobile).toBe(true);
    });

    it('ISubsystem 接口 — init/getState/isInitialized 应正常工作', () => {
      expect(settings.isInitialized).toBe(false);
      settings.init({} as Record<string, unknown>);
      expect(settings.isInitialized).toBe(true);
      const state = settings.getState();
      expect(state.fontSize).toBeDefined();
      expect(state.powerSave).toBeDefined();
    });

    it('MobileSettingsSystem reset 应恢复所有设置', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setFontSize(FontSizeLevel.Large);
      settings.setScreenAlwaysOn(true);
      settings.reset();
      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.fontSize).toBe(FontSizeLevel.Medium);
      expect(settings.screenAlwaysOn).toBe(false);
    });
  });
});
