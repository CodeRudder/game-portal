/**
 * PowerSaveSystem 单元测试
 *
 * 覆盖：
 * 1. 省电模式开关（enable/disable/setLevel）
 * 2. 自动模式（低电量检测）
 * 3. 帧率控制
 * 4. 屏幕常亮
 * 5. 事件监听
 * 6. 重置
 */

import { PowerSaveSystem } from '../PowerSaveSystem';
import { PowerSaveLevel } from '../../../core/responsive/responsive.types';

describe('PowerSaveSystem', () => {
  let system: PowerSaveSystem;

  beforeEach(() => {
    system = new PowerSaveSystem();
  });

  // ─── ISubsystem ───────────────────────────

  describe('ISubsystem 接口', () => {
    it('name 应为 power-save', () => {
      expect(system.name).toBe('power-save');
    });

    it('init 应标记初始化', () => {
      system.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() }, registry: { get: vi.fn() } });
      expect(system.isInitialized).toBe(true);
    });
  });

  // ─── 省电模式控制 ─────────────────────────

  describe('省电模式控制', () => {
    it('初始应为关闭状态', () => {
      expect(system.isActive).toBe(false);
      expect(system.level).toBe(PowerSaveLevel.Off);
    });

    it('enable 应开启省电模式', () => {
      system.enable();
      expect(system.isActive).toBe(true);
      expect(system.level).toBe(PowerSaveLevel.On);
    });

    it('disable 应关闭省电模式', () => {
      system.enable();
      system.disable();
      expect(system.isActive).toBe(false);
    });

    it('setLevel(On) 应激活', () => {
      system.setLevel(PowerSaveLevel.On);
      expect(system.isActive).toBe(true);
    });

    it('setLevel(Off) 应关闭', () => {
      system.enable();
      system.setLevel(PowerSaveLevel.Off);
      expect(system.isActive).toBe(false);
    });
  });

  // ─── 自动模式 ─────────────────────────────

  describe('自动模式', () => {
    it('Auto 模式低电量未充电应激活', () => {
      system.setLevel(PowerSaveLevel.Auto);
      system.updateBatteryStatus(15, false);
      expect(system.isActive).toBe(true);
    });

    it('Auto 模式低电量但充电中不应激活', () => {
      system.setLevel(PowerSaveLevel.Auto);
      system.updateBatteryStatus(15, true);
      expect(system.isActive).toBe(false);
    });

    it('Auto 模式电量正常不应激活', () => {
      system.setLevel(PowerSaveLevel.Auto);
      system.updateBatteryStatus(50, false);
      expect(system.isActive).toBe(false);
    });

    it('Auto 模式电量未知不应激活', () => {
      system.setLevel(PowerSaveLevel.Auto);
      // 未调用 updateBatteryStatus，batteryLevel 为 null
      expect(system.isActive).toBe(false);
    });
  });

  // ─── 帧率控制 ─────────────────────────────

  describe('帧率控制', () => {
    it('正常模式帧率应为60', () => {
      expect(system.getTargetFps()).toBe(60);
      expect(system.currentFps).toBe(60);
    });

    it('省电模式帧率应为30', () => {
      system.enable();
      expect(system.getTargetFps()).toBe(30);
      expect(system.currentFps).toBe(30);
    });

    it('getFrameInterval 应返回正确间隔', () => {
      expect(system.getFrameInterval()).toBeCloseTo(1000 / 60, 1);
      system.enable();
      expect(system.getFrameInterval()).toBeCloseTo(1000 / 30, 1);
    });

    it('shouldSkipFrame 应正确判断', () => {
      const interval = system.getFrameInterval();
      expect(system.shouldSkipFrame(0, interval - 1)).toBe(true);
      expect(system.shouldSkipFrame(0, interval + 1)).toBe(false);
    });
  });

  // ─── 特效控制 ─────────────────────────────

  describe('特效控制', () => {
    it('省电模式应禁用粒子', () => {
      system.enable();
      expect(system.shouldDisableParticles()).toBe(true);
    });

    it('省电模式应禁用阴影', () => {
      system.enable();
      expect(system.shouldDisableShadows()).toBe(true);
    });

    it('正常模式不应禁用', () => {
      expect(system.shouldDisableParticles()).toBe(false);
      expect(system.shouldDisableShadows()).toBe(false);
    });
  });

  // ─── 屏幕常亮 ─────────────────────────────

  describe('屏幕常亮', () => {
    it('初始应为关闭', () => {
      expect(system.screenAlwaysOn).toBe(false);
    });

    it('setScreenAlwaysOn 应设置状态', () => {
      system.setScreenAlwaysOn(true);
      expect(system.screenAlwaysOn).toBe(true);
    });

    it('toggleScreenAlwaysOn 应切换状态', () => {
      const result = system.toggleScreenAlwaysOn();
      expect(result).toBe(true);
      expect(system.screenAlwaysOn).toBe(true);
    });
  });

  // ─── 事件监听 ─────────────────────────────

  describe('事件监听', () => {
    it('状态变更应触发监听器', () => {
      const listener = vi.fn();
      system.onStateChange(listener);
      system.enable();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('取消订阅不应再触发', () => {
      const listener = vi.fn();
      const unsub = system.onStateChange(listener);
      unsub();
      system.enable();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ─── 重置 ─────────────────────────────────

  describe('reset', () => {
    it('应恢复默认状态', () => {
      system.enable();
      system.setScreenAlwaysOn(true);
      system.reset();
      expect(system.isActive).toBe(false);
      expect(system.screenAlwaysOn).toBe(false);
      expect(system.batteryLevel).toBeNull();
    });
  });

  // ─── 配置更新 ─────────────────────────────

  describe('updateConfig', () => {
    it('应更新配置', () => {
      system.updateConfig({ targetFps: 20 });
      system.enable();
      expect(system.getTargetFps()).toBe(20);
    });
  });
});
