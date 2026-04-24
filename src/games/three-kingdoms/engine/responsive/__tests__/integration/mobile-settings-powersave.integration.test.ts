/**
 * §3.2 + §4.1 手机端设置 + 省电模式 + 性能降级 — 集成测试
 *
 * 覆盖 v17.0 竖屏适配核心路径：
 * - §3.2 手机端设置系统（MobileSettingsSystem）与省电模式联动
 * - §4.1 省电模式系统（PowerSaveSystem）性能降级全链路
 * - 两者协同：设置变更 → 省电状态 → 帧率/粒子/阴影降级
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PowerSaveLevel,
  FontSizeLevel,
  FONT_SIZE_MAP,
} from '../../../../core/responsive/responsive.types';
import { MobileSettingsSystem } from '../../MobileSettingsSystem';
import { PowerSaveSystem } from '../../PowerSaveSystem';

// ═══════════════════════════════════════════════
// §3.2 手机端设置系统
// ═══════════════════════════════════════════════

describe('§3.2+§4.1 手机端设置 + 省电模式 + 性能降级 — 集成测试', () => {
  let settings: MobileSettingsSystem;
  let powerSave: PowerSaveSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    settings = new MobileSettingsSystem();
    powerSave = new PowerSaveSystem();
  });

  afterEach(() => {
    settings.reset();
    powerSave.reset();
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────
  // §3.2.1 MobileSettingsSystem 初始化与属性
  // ─────────────────────────────────────────────

  describe('§3.2.1 MobileSettingsSystem 初始化与属性', () => {
    it('初始化后省电模式应为Off，帧率60fps', () => {
      expect(settings.powerSaveLevel).toBe(PowerSaveLevel.Off);
      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.currentFps).toBe(60);
      expect(settings.shouldDisableParticles).toBe(false);
      expect(settings.shouldDisableShadows).toBe(false);
    });

    it('初始化后屏幕常亮关闭，字体Medium', () => {
      expect(settings.screenAlwaysOn).toBe(false);
      expect(settings.isScreenAlwaysOnEffective).toBe(false);
      expect(settings.fontSize).toBe(FontSizeLevel.Medium);
    });

    it('getSettingsState() 返回完整设置快照', () => {
      const state = settings.getSettingsState();
      expect(state.powerSave.level).toBe(PowerSaveLevel.Off);
      expect(state.powerSave.isActive).toBe(false);
      expect(state.screenAlwaysOn).toBe(false);
      expect(state.fontSize).toBe(FontSizeLevel.Medium);
      expect(state.leftHandMode).toBe(false);
    });

    it('reset() 恢复所有默认值', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setFontSize(FontSizeLevel.Large);
      settings.setScreenAlwaysOn(true);
      settings.setInGame(true);

      settings.reset();

      expect(settings.powerSaveLevel).toBe(PowerSaveLevel.Off);
      expect(settings.fontSize).toBe(FontSizeLevel.Medium);
      expect(settings.screenAlwaysOn).toBe(false);
      expect(settings.isInitialized).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // §3.2.2 省电模式等级切换
  // ─────────────────────────────────────────────

  describe('§3.2.2 省电模式等级切换', () => {
    it('手动开启省电模式 → 激活，帧率30fps，关闭粒子和阴影', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);

      expect(settings.isPowerSaveActive).toBe(true);
      expect(settings.currentFps).toBe(30);
      expect(settings.shouldDisableParticles).toBe(true);
      expect(settings.shouldDisableShadows).toBe(true);
    });

    it('手动关闭省电模式 → 帧率恢复60fps', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setPowerSaveLevel(PowerSaveLevel.Off);

      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.currentFps).toBe(60);
      expect(settings.shouldDisableParticles).toBe(false);
    });

    it('自动模式：电量>20% → 不激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(80, false);

      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.currentFps).toBe(60);
    });

    it('自动模式：电量≤20%且未充电 → 激活省电', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(15, false);

      expect(settings.isPowerSaveActive).toBe(true);
      expect(settings.currentFps).toBe(30);
      expect(settings.shouldDisableParticles).toBe(true);
    });

    it('自动模式：电量≤20%但充电中 → 不激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(10, true);

      expect(settings.isPowerSaveActive).toBe(false);
      expect(settings.currentFps).toBe(60);
    });

    it('自动模式：从充电→拔电(低电量) → 自动激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(10, true);
      expect(settings.isPowerSaveActive).toBe(false);

      settings.updateBatteryStatus(10, false);
      expect(settings.isPowerSaveActive).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // §3.2.3 屏幕常亮与字体大小
  // ─────────────────────────────────────────────

  describe('§3.2.3 屏幕常亮与字体大小', () => {
    it('屏幕常亮：仅游戏中生效', () => {
      settings.setScreenAlwaysOn(true);
      expect(settings.isScreenAlwaysOnEffective).toBe(false);

      settings.setInGame(true);
      expect(settings.isScreenAlwaysOnEffective).toBe(true);
    });

    it('退出游戏 → 屏幕常亮不再生效', () => {
      settings.setScreenAlwaysOn(true);
      settings.setInGame(true);
      expect(settings.isScreenAlwaysOnEffective).toBe(true);

      settings.setInGame(false);
      expect(settings.isScreenAlwaysOnEffective).toBe(false);
    });

    it('字体大小三档切换', () => {
      settings.setFontSize(FontSizeLevel.Small);
      expect(settings.fontSize).toBe(FontSizeLevel.Small);

      settings.setFontSize(FontSizeLevel.Large);
      expect(settings.fontSize).toBe(FontSizeLevel.Large);

      settings.setFontSize(FontSizeLevel.Medium);
      expect(settings.fontSize).toBe(FontSizeLevel.Medium);
    });

    it('FONT_SIZE_MAP 映射值正确', () => {
      expect(FONT_SIZE_MAP[FontSizeLevel.Small]).toBe(12);
      expect(FONT_SIZE_MAP[FontSizeLevel.Medium]).toBe(14);
      expect(FONT_SIZE_MAP[FontSizeLevel.Large]).toBe(16);
    });
  });

  // ─────────────────────────────────────────────
  // §4.1.1 PowerSaveSystem 独立功能
  // ─────────────────────────────────────────────

  describe('§4.1.1 PowerSaveSystem 独立功能', () => {
    it('初始化状态：Off, 60fps, 无降级', () => {
      expect(powerSave.level).toBe(PowerSaveLevel.Off);
      expect(powerSave.isActive).toBe(false);
      expect(powerSave.currentFps).toBe(60);
      expect(powerSave.shouldDisableParticles()).toBe(false);
      expect(powerSave.shouldDisableShadows()).toBe(false);
      expect(powerSave.screenAlwaysOn).toBe(false);
    });

    it('enable()/disable() 手动开关', () => {
      powerSave.enable();
      expect(powerSave.isActive).toBe(true);
      expect(powerSave.level).toBe(PowerSaveLevel.On);

      powerSave.disable();
      expect(powerSave.isActive).toBe(false);
      expect(powerSave.level).toBe(PowerSaveLevel.Off);
    });

    it('setLevel(Auto) + 电池状态联动', () => {
      powerSave.setLevel(PowerSaveLevel.Auto);
      powerSave.updateBatteryStatus(5, false);
      expect(powerSave.isActive).toBe(true);

      powerSave.updateBatteryStatus(50, false);
      expect(powerSave.isActive).toBe(false);
    });

    it('屏幕常亮 toggle 切换', () => {
      expect(powerSave.screenAlwaysOn).toBe(false);
      const result = powerSave.toggleScreenAlwaysOn();
      expect(result).toBe(true);
      expect(powerSave.screenAlwaysOn).toBe(true);

      const result2 = powerSave.toggleScreenAlwaysOn();
      expect(result2).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // §4.1.2 帧率控制与性能降级
  // ─────────────────────────────────────────────

  describe('§4.1.2 帧率控制与性能降级', () => {
    it('getTargetFps() 正常60fps / 省电30fps', () => {
      expect(powerSave.getTargetFps()).toBe(60);
      powerSave.enable();
      expect(powerSave.getTargetFps()).toBe(30);
    });

    it('getFrameInterval() 正确计算帧间隔', () => {
      expect(powerSave.getFrameInterval()).toBeCloseTo(1000 / 60, 1);
      powerSave.enable();
      expect(powerSave.getFrameInterval()).toBeCloseTo(1000 / 30, 1);
    });

    it('shouldSkipFrame() 帧节流判断', () => {
      const interval = powerSave.getFrameInterval(); // ~16.67ms
      expect(powerSave.shouldSkipFrame(0, interval - 1)).toBe(true);
      expect(powerSave.shouldSkipFrame(0, interval + 1)).toBe(false);
    });

    it('省电模式下 shouldSkipFrame 使用30fps间隔', () => {
      powerSave.enable();
      const interval = powerSave.getFrameInterval(); // ~33.33ms
      // 20ms < 33.33ms → 跳帧
      expect(powerSave.shouldSkipFrame(0, 20)).toBe(true);
      // 35ms > 33.33ms → 不跳帧
      expect(powerSave.shouldSkipFrame(0, 35)).toBe(false);
    });

    it('自定义 targetFps 配置生效', () => {
      powerSave.updateConfig({ targetFps: 20 });
      powerSave.enable();
      expect(powerSave.getTargetFps()).toBe(20);
      expect(powerSave.getFrameInterval()).toBe(50);
    });
  });

  // ─────────────────────────────────────────────
  // §4.1.3 事件监听与状态变更通知
  // ─────────────────────────────────────────────

  describe('§4.1.3 事件监听与状态变更通知', () => {
    it('MobileSettingsSystem: 省电激活时通知监听器', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);
      settings.setPowerSaveLevel(PowerSaveLevel.On);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, currentFps: 30 }),
      );
    });

    it('PowerSaveSystem: enable() 触发 onStateChange', () => {
      const listener = vi.fn();
      powerSave.onStateChange(listener);
      powerSave.enable();

      expect(listener).toHaveBeenCalledTimes(1);
      const state = listener.mock.calls[0][0];
      expect(state.isActive).toBe(true);
      expect(state.currentFps).toBe(30);
    });

    it('状态未变更时不重复通知', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);

      settings.setPowerSaveLevel(PowerSaveLevel.Off); // 已经是Off
      expect(listener).not.toHaveBeenCalled();
    });

    it('取消订阅后不再接收通知', () => {
      const listener = vi.fn();
      const unsub = settings.onPowerSaveChange(listener);
      unsub();
      settings.setPowerSaveLevel(PowerSaveLevel.On);

      expect(listener).not.toHaveBeenCalled();
    });

    it('PowerSaveSystem: reset() 后监听器被清空', () => {
      const listener = vi.fn();
      powerSave.onStateChange(listener);
      powerSave.reset();
      powerSave.enable();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // §4.1.4 MobileSettingsSystem 与 PowerSaveSystem 协同
  // ─────────────────────────────────────────────

  describe('§4.1.4 MobileSettingsSystem 与 PowerSaveSystem 协同', () => {
    it('两者独立运行时状态一致：同时开启省电', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      powerSave.enable();

      expect(settings.isPowerSaveActive).toBe(powerSave.isActive);
      expect(settings.currentFps).toBe(powerSave.currentFps);
    });

    it('两者独立运行时状态一致：同时关闭省电', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      powerSave.enable();

      settings.setPowerSaveLevel(PowerSaveLevel.Off);
      powerSave.disable();

      expect(settings.isPowerSaveActive).toBe(powerSave.isActive);
      expect(settings.currentFps).toBe(60);
    });

    it('自定义省电配置后两者行为一致', () => {
      settings.setPowerSaveConfig({ targetFps: 20, disableParticles: true });
      powerSave.updateConfig({ targetFps: 20, disableParticles: true });

      settings.setPowerSaveLevel(PowerSaveLevel.On);
      powerSave.enable();

      expect(settings.currentFps).toBe(20);
      expect(powerSave.getTargetFps()).toBe(20);
      expect(settings.shouldDisableParticles).toBe(true);
      expect(powerSave.shouldDisableParticles()).toBe(true);
    });

    it('电量边界值：恰好等于阈值 → 激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(20, false); // 阈值=20

      expect(settings.isPowerSaveActive).toBe(true);
    });

    it('电量边界值：阈值+1 → 不激活', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(21, false);

      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('电量被clamp到0-100范围', () => {
      settings.updateBatteryStatus(-10, false);
      expect(settings.currentBatteryLevel).toBe(0);

      settings.updateBatteryStatus(150, false);
      expect(settings.currentBatteryLevel).toBe(100);
    });
  });

  // ─────────────────────────────────────────────
  // §4.1.5 ISubsystem 接口合规
  // ─────────────────────────────────────────────

  describe('§4.1.5 ISubsystem 接口合规', () => {
    it('MobileSettingsSystem: name, init, isInitialized', () => {
      expect(settings.name).toBe('mobile-settings');
      expect(settings.isInitialized).toBe(false);
      settings.init({} as any);
      expect(settings.isInitialized).toBe(true);
    });

    it('PowerSaveSystem: name, init, isInitialized', () => {
      expect(powerSave.name).toBe('power-save');
      expect(powerSave.isInitialized).toBe(false);
      powerSave.init({} as any);
      expect(powerSave.isInitialized).toBe(true);
    });

    it('MobileSettingsSystem: getState() 返回 MobileSettingsState', () => {
      settings.init({} as any);
      const state = settings.getState();
      expect(state).toHaveProperty('powerSave');
      expect(state).toHaveProperty('screenAlwaysOn');
      expect(state).toHaveProperty('fontSize');
      expect(state).toHaveProperty('leftHandMode');
    });

    it('PowerSaveSystem: getState() 返回 PowerSaveState', () => {
      powerSave.init({} as any);
      const state = powerSave.getState();
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('isActive');
      expect(state).toHaveProperty('currentFps');
      expect(state).toHaveProperty('config');
    });
  });
});
