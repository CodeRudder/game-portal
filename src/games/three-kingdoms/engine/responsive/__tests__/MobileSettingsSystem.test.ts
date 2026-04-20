/**
 * MobileSettingsSystem 单元测试
 *
 * 覆盖：
 * - #11 省电模式（手动/自动/关闭+帧率+粒子+阴影）
 * - #13 屏幕常亮（游戏内/后台）
 * - #14 字体大小三档
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PowerSaveLevel,
  FontSizeLevel,
} from '../../../core/responsive/responsive.types';
import { MobileSettingsSystem } from '../MobileSettingsSystem';

describe('MobileSettingsSystem', () => {
  let settings: MobileSettingsSystem;

  beforeEach(() => {
    settings = new MobileSettingsSystem();
  });

  // ═══════════════════════════════════════════
  // #11 省电模式
  // ═══════════════════════════════════════════

  describe('power save mode', () => {
    it('默认关闭', () => {
      expect(settings.powerSaveLevel).toBe(PowerSaveLevel.Off);
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('手动开启', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.isPowerSaveActive).toBe(true);
    });

    it('手动关闭', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      settings.setPowerSaveLevel(PowerSaveLevel.Off);
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('自动模式：低电量触发', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(15, false); // 15% < 20%, 未充电
      expect(settings.isPowerSaveActive).toBe(true);
    });

    it('自动模式：电量充足不触发', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(50, false);
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('自动模式：充电中不触发', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(10, true); // 低电量但充电中
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('自动模式：充电恢复后关闭', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(15, false);
      expect(settings.isPowerSaveActive).toBe(true);

      settings.updateBatteryStatus(15, true); // 开始充电
      expect(settings.isPowerSaveActive).toBe(false);
    });

    it('省电时帧率30fps', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.currentFps).toBe(30);
    });

    it('正常时帧率60fps', () => {
      expect(settings.currentFps).toBe(60);
    });

    it('省电时关闭粒子', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.shouldDisableParticles).toBe(true);
    });

    it('省电时关闭阴影', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(settings.shouldDisableShadows).toBe(true);
    });

    it('正常时粒子开启', () => {
      expect(settings.shouldDisableParticles).toBe(false);
    });

    it('状态变更触发回调', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
    });

    it('状态不变不触发回调', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);
      settings.setPowerSaveLevel(PowerSaveLevel.Off); // 已经是Off
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getPowerSaveState', () => {
    it('返回完整状态', () => {
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      const state = settings.getPowerSaveState();
      expect(state.level).toBe(PowerSaveLevel.On);
      expect(state.isActive).toBe(true);
      expect(state.currentFps).toBe(30);
      expect(state.config).toBeDefined();
    });
  });

  describe('setPowerSaveConfig', () => {
    it('更新配置', () => {
      settings.setPowerSaveConfig({ targetFps: 24 });
      const state = settings.getPowerSaveState();
      expect(state.config.targetFps).toBe(24);
    });

    it('自定义电量阈值', () => {
      settings.setPowerSaveConfig({ autoTriggerBatteryLevel: 30 });
      settings.setPowerSaveLevel(PowerSaveLevel.Auto);
      settings.updateBatteryStatus(25, false); // 25% < 30%
      expect(settings.isPowerSaveActive).toBe(true);
    });
  });

  describe('updateBatteryStatus', () => {
    it('电量范围0-100', () => {
      settings.updateBatteryStatus(150, false);
      expect(settings.currentBatteryLevel).toBe(100);

      settings.updateBatteryStatus(-10, false);
      expect(settings.currentBatteryLevel).toBe(0);
    });

    it('更新充电状态', () => {
      settings.updateBatteryStatus(50, true);
      expect(settings.isCharging).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // #13 屏幕常亮
  // ═══════════════════════════════════════════

  describe('screen always on', () => {
    it('默认关闭', () => {
      expect(settings.screenAlwaysOn).toBe(false);
    });

    it('开启屏幕常亮', () => {
      settings.setScreenAlwaysOn(true);
      expect(settings.screenAlwaysOn).toBe(true);
    });

    it('游戏内才生效', () => {
      settings.setScreenAlwaysOn(true);
      expect(settings.isScreenAlwaysOnEffective).toBe(false);

      settings.setInGame(true);
      expect(settings.isScreenAlwaysOnEffective).toBe(true);
    });

    it('退出游戏后不生效', () => {
      settings.setScreenAlwaysOn(true);
      settings.setInGame(true);
      settings.setInGame(false);
      expect(settings.isScreenAlwaysOnEffective).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // #14 字体大小
  // ═══════════════════════════════════════════

  describe('font size', () => {
    it('默认中号', () => {
      expect(settings.fontSize).toBe(FontSizeLevel.Medium);
    });

    it('切换字体大小', () => {
      settings.setFontSize(FontSizeLevel.Large);
      expect(settings.fontSize).toBe(FontSizeLevel.Large);

      settings.setFontSize(FontSizeLevel.Small);
      expect(settings.fontSize).toBe(FontSizeLevel.Small);
    });
  });

  // ═══════════════════════════════════════════
  // 完整设置状态
  // ═══════════════════════════════════════════

  describe('getSettingsState', () => {
    it('返回完整设置状态', () => {
      settings.setFontSize(FontSizeLevel.Large);
      settings.setScreenAlwaysOn(true);

      const state = settings.getSettingsState();
      expect(state.fontSize).toBe(FontSizeLevel.Large);
      expect(state.screenAlwaysOn).toBe(true);
      expect(state.powerSave).toBeDefined();
      expect(state.leftHandMode).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 监听器管理
  // ═══════════════════════════════════════════

  describe('listeners', () => {
    it('取消注册监听', () => {
      const listener = vi.fn();
      const unsub = settings.onPowerSaveChange(listener);
      unsub();
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(listener).not.toHaveBeenCalled();
    });

    it('clearListeners', () => {
      const listener = vi.fn();
      settings.onPowerSaveChange(listener);
      settings.clearListeners();
      settings.setPowerSaveLevel(PowerSaveLevel.On);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // 自定义配置构造
  // ═══════════════════════════════════════════

  describe('custom config', () => {
    it('构造时传入自定义配置', () => {
      const custom = new MobileSettingsSystem({ targetFps: 20 });
      custom.setPowerSaveLevel(PowerSaveLevel.On);
      expect(custom.currentFps).toBe(20);
    });
  });
});
