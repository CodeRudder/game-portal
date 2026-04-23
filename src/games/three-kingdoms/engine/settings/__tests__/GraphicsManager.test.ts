import { vi } from 'vitest';
/**
 * GraphicsManager 单元测试
 *
 * 覆盖：
 * 1. 4档画质预设
 * 2. 自动检测设备能力
 * 3. 5项高级画质选项
 * 4. 画质即时切换
 * 5. 低端设备隐藏高级选项
 */

import { GraphicsManager } from '../GraphicsManager';
import { GraphicsPreset } from '../../../core/settings';
import type { DeviceCapability, GraphicsSettings } from '../../../core/settings';

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('GraphicsManager', () => {
  let gfx: GraphicsManager;

  beforeEach(() => {
    gfx = new GraphicsManager();
  });

  // ── 自动检测 ────────────────────────────

  describe('自动检测', () => {
    test('CPU≥8核 + 内存≥8GB → 高画质', () => {
      const cap: DeviceCapability = { cpuCores: 8, memoryGB: 8 };
      expect(gfx.detectBestPreset(cap)).toBe(GraphicsPreset.High);
    });

    test('CPU≥4核 + 内存≥4GB → 中画质', () => {
      const cap: DeviceCapability = { cpuCores: 4, memoryGB: 4 };
      expect(gfx.detectBestPreset(cap)).toBe(GraphicsPreset.Medium);
    });

    test('低配设备 → 低画质', () => {
      const cap: DeviceCapability = { cpuCores: 2, memoryGB: 2 };
      expect(gfx.detectBestPreset(cap)).toBe(GraphicsPreset.Low);
    });

    test('CPU 8核但内存 4GB → 中画质', () => {
      const cap: DeviceCapability = { cpuCores: 8, memoryGB: 4 };
      expect(gfx.detectBestPreset(cap)).toBe(GraphicsPreset.Medium);
    });

    test('CPU 4核但内存 2GB → 低画质', () => {
      const cap: DeviceCapability = { cpuCores: 4, memoryGB: 2 };
      expect(gfx.detectBestPreset(cap)).toBe(GraphicsPreset.Low);
    });

    test('detectDeviceCapability 返回 DeviceCapability', () => {
      const cap = gfx.detectDeviceCapability();
      expect(cap).toHaveProperty('cpuCores');
      expect(cap).toHaveProperty('memoryGB');
      expect(cap.cpuCores).toBeGreaterThan(0);
      expect(cap.memoryGB).toBeGreaterThan(0);
    });
  });

  // ── 画质预设 ────────────────────────────

  describe('画质预设', () => {
    test('低画质预设: 粒子关+阴影关+水墨关+30fps', () => {
      const config = gfx.getPresetConfig(GraphicsPreset.Low);
      expect(config.particleEffects).toBe(false);
      expect(config.realtimeShadows).toBe(false);
      expect(config.inkWash).toBe(false);
      expect(config.frameRateLimit).toBe(30);
      expect(config.antiAliasing).toBe(false);
    });

    test('中画质预设: 粒子开+阴影关+水墨开+60fps', () => {
      const config = gfx.getPresetConfig(GraphicsPreset.Medium);
      expect(config.particleEffects).toBe(true);
      expect(config.realtimeShadows).toBe(false);
      expect(config.inkWash).toBe(true);
      expect(config.frameRateLimit).toBe(60);
      expect(config.antiAliasing).toBe(false);
    });

    test('高画质预设: 粒子开+阴影开+水墨开+60fps+抗锯齿', () => {
      const config = gfx.getPresetConfig(GraphicsPreset.High);
      expect(config.particleEffects).toBe(true);
      expect(config.realtimeShadows).toBe(true);
      expect(config.inkWash).toBe(true);
      expect(config.frameRateLimit).toBe(60);
      expect(config.antiAliasing).toBe(true);
    });

    test('applyPreset 切换预设时高级选项重置', () => {
      gfx.applyPreset(GraphicsPreset.High);
      const options = gfx.getEffectiveOptions();
      expect(options.realtimeShadows).toBe(true);
      expect(options.antiAliasing).toBe(true);
    });

    test('applyPreset Auto 自动检测并应用推荐档位', () => {
      gfx.applyPreset(GraphicsPreset.Auto);
      const detected = gfx.getDetectedPreset();
      expect(detected).not.toBeNull();
      expect([GraphicsPreset.Low, GraphicsPreset.Medium, GraphicsPreset.High]).toContain(detected);
    });

    test('applyPreset 触发 onChange 回调', () => {
      const cb = vi.fn();
      gfx.onChange(cb);
      gfx.applyPreset(GraphicsPreset.Low);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        preset: GraphicsPreset.Low,
      }));
    });
  });

  // ── 高级选项 ────────────────────────────

  describe('高级选项', () => {
    test('setAdvancedOption 独立修改单个选项', () => {
      gfx.applyPreset(GraphicsPreset.Medium);
      gfx.setAdvancedOption('particleEffects', false);
      expect(gfx.getEffectiveOptions().particleEffects).toBe(false);
      // 其他选项不受影响
      expect(gfx.getEffectiveOptions().inkWash).toBe(true);
    });

    test('updateAdvancedOptions 批量修改', () => {
      gfx.applyPreset(GraphicsPreset.Medium);
      gfx.updateAdvancedOptions({
        particleEffects: false,
        frameRateLimit: 30,
      });
      expect(gfx.getEffectiveOptions().particleEffects).toBe(false);
      expect(gfx.getEffectiveOptions().frameRateLimit).toBe(30);
    });

    test('高级选项修改触发 onChange', () => {
      const cb = vi.fn();
      gfx.onChange(cb);
      gfx.setAdvancedOption('antiAliasing', true);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ── 状态查询 ────────────────────────────

  describe('状态查询', () => {
    test('isLowQuality 低画质时返回 true', () => {
      gfx.applyPreset(GraphicsPreset.Low);
      expect(gfx.isLowQuality()).toBe(true);
    });

    test('isLowQuality 高画质时返回 false', () => {
      gfx.applyPreset(GraphicsPreset.High);
      expect(gfx.isLowQuality()).toBe(false);
    });

    test('isHighQuality 高画质时返回 true', () => {
      gfx.applyPreset(GraphicsPreset.High);
      expect(gfx.isHighQuality()).toBe(true);
    });

    test('isHighQuality 低画质时返回 false', () => {
      gfx.applyPreset(GraphicsPreset.Low);
      expect(gfx.isHighQuality()).toBe(false);
    });

    test('shouldShowAdvancedOptions 低画质时返回 false', () => {
      gfx.applyPreset(GraphicsPreset.Low);
      expect(gfx.shouldShowAdvancedOptions()).toBe(false);
    });

    test('shouldShowAdvancedOptions 中画质时返回 true', () => {
      gfx.applyPreset(GraphicsPreset.Medium);
      expect(gfx.shouldShowAdvancedOptions()).toBe(true);
    });
  });

  // ── 设置应用 ────────────────────────────

  describe('设置应用', () => {
    test('applySettings 恢复保存的设置', () => {
      const saved: GraphicsSettings = {
        preset: GraphicsPreset.High,
        advanced: {
          particleEffects: true,
          realtimeShadows: true,
          inkWash: true,
          frameRateLimit: 60,
          antiAliasing: true,
        },
      };
      gfx.applySettings(saved);
      expect(gfx.getSettings().preset).toBe(GraphicsPreset.High);
      expect(gfx.getEffectiveOptions().realtimeShadows).toBe(true);
    });

    test('applySettings Auto 模式触发自动检测', () => {
      const saved: GraphicsSettings = {
        preset: GraphicsPreset.Auto,
        advanced: {
          particleEffects: true,
          realtimeShadows: false,
          inkWash: true,
          frameRateLimit: 60,
          antiAliasing: false,
        },
      };
      gfx.applySettings(saved);
      expect(gfx.getDetectedPreset()).not.toBeNull();
    });
  });

  // ── 事件监听 ────────────────────────────

  describe('事件监听', () => {
    test('取消注册后不再触发', () => {
      const cb = vi.fn();
      const unsub = gfx.onChange(cb);
      unsub();
      gfx.applyPreset(GraphicsPreset.High);
      expect(cb).not.toHaveBeenCalled();
    });

    test('removeAllListeners 清除所有回调', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      gfx.onChange(cb1);
      gfx.onChange(cb2);
      gfx.removeAllListeners();
      gfx.applyPreset(GraphicsPreset.Low);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });
});
