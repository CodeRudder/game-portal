/**
 * GraphicsQualityManager 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 画质档位 (#8)
 *   - 自动检测 (#8)
 *   - 高级画质选项 (#9)
 *   - 水墨过渡 (#10)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphicsQualityManager } from '../GraphicsQualityManager';
import { GraphicsPreset } from '../../../core/settings';

function createMockDeps() {
  const emitted: Record<string, unknown[]> = {};
  return {
    eventBus: {
      on: () => {},
      emit: (event: string, data: unknown) => { (emitted[event] ??= []).push(data); },
      off: () => {},
      _emitted: emitted,
    },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('GraphicsQualityManager', () => {
  let gqm: GraphicsQualityManager;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    gqm = new GraphicsQualityManager();
    deps = createMockDeps();
    gqm.init(deps as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(gqm.name).toBe('graphicsQuality');
    });

    it('init 不应抛错', () => {
      expect(() => gqm.init(deps as any)).not.toThrow();
    });

    it('reset 应恢复默认', () => {
      gqm.setPreset(GraphicsPreset.Low);
      gqm.reset();
      expect(gqm.getPreset()).toBe(GraphicsPreset.Auto);
    });

    it('getState 应返回画面设置', () => {
      const state = gqm.getState();
      expect(state).toHaveProperty('preset');
      expect(state).toHaveProperty('advanced');
    });
  });

  describe('#8 画质档位', () => {
    it('默认应为自动档位', () => {
      expect(gqm.getPreset()).toBe(GraphicsPreset.Auto);
    });

    it('应可切换到低画质', () => {
      const event = gqm.setPreset(GraphicsPreset.Low);
      expect(event.newPreset).toBe(GraphicsPreset.Low);
      expect(gqm.getPreset()).toBe(GraphicsPreset.Low);
    });

    it('应可切换到高画质', () => {
      gqm.setPreset(GraphicsPreset.High);
      expect(gqm.getPreset()).toBe(GraphicsPreset.High);
    });

    it('切换档位应触发水墨过渡', () => {
      const event = gqm.setPreset(GraphicsPreset.Low);
      expect(event.needsTransition).toBe(true);
      expect(gqm.isInkTransitionActive()).toBe(true);
    });

    it('相同档位切换不应触发过渡', () => {
      gqm.setPreset(GraphicsPreset.Low);
      const event = gqm.setPreset(GraphicsPreset.Low);
      expect(event.needsTransition).toBe(false);
    });

    it('getPresetConfig 应返回当前配置', () => {
      gqm.setPreset(GraphicsPreset.High);
      const config = gqm.getPresetConfig();
      expect(config.particleEffects).toBe(true);
      expect(config.realtimeShadows).toBe(true);
      expect(config.antiAliasing).toBe(true);
    });

    it('getPresetConfigFor 应返回指定档位配置', () => {
      const config = gqm.getPresetConfigFor(GraphicsPreset.Low);
      expect(config.particleEffects).toBe(false);
      expect(config.showAdvancedOptions).toBe(false);
    });

    it('低画质应隐藏高级选项', () => {
      gqm.setPreset(GraphicsPreset.Low);
      expect(gqm.shouldShowAdvancedOptions()).toBe(false);
    });

    it('高画质应显示高级选项', () => {
      gqm.setPreset(GraphicsPreset.High);
      expect(gqm.shouldShowAdvancedOptions()).toBe(true);
    });
  });

  describe('#8 自动检测', () => {
    it('detectDeviceCapability 应返回检测结果', () => {
      const result = gqm.detectDeviceCapability();
      expect(result.cpuCores).toBeGreaterThan(0);
      expect(result.memoryGB).toBeGreaterThan(0);
      expect(result.recommendedPreset).toBeTruthy();
    });

    it('getDetectionResult 应返回检测结果', () => {
      gqm.detectDeviceCapability();
      const result = gqm.getDetectionResult();
      expect(result).not.toBeNull();
      expect(result!.recommendedPreset).toBeTruthy();
    });

    it('getRecommendedPreset 应返回推荐档位', () => {
      const preset = gqm.getRecommendedPreset();
      expect(Object.values(GraphicsPreset)).toContain(preset);
    });
  });

  describe('#9 高级画质选项', () => {
    it('应可设置粒子特效', () => {
      gqm.setParticleEffects(false);
      expect(gqm.getAdvancedOptions().particleEffects).toBe(false);
    });

    it('应可设置实时阴影', () => {
      gqm.setRealtimeShadows(true);
      expect(gqm.getAdvancedOptions().realtimeShadows).toBe(true);
    });

    it('应可设置水墨晕染', () => {
      gqm.setInkWash(false);
      expect(gqm.getAdvancedOptions().inkWash).toBe(false);
    });

    it('应可设置帧率限制', () => {
      gqm.setFrameRateLimit(30);
      expect(gqm.getAdvancedOptions().frameRateLimit).toBe(30);
    });

    it('无效帧率应默认为 60', () => {
      gqm.setFrameRateLimit(45);
      expect(gqm.getAdvancedOptions().frameRateLimit).toBe(60);
    });

    it('应可设置抗锯齿', () => {
      gqm.setAntiAliasing(true);
      expect(gqm.getAdvancedOptions().antiAliasing).toBe(true);
    });

    it('setAdvancedOptions 应批量设置', () => {
      gqm.setAdvancedOptions({ particleEffects: false, antiAliasing: true });
      const opts = gqm.getAdvancedOptions();
      expect(opts.particleEffects).toBe(false);
      expect(opts.antiAliasing).toBe(true);
    });
  });

  describe('#10 水墨过渡', () => {
    it('水墨过渡进度应在 0~1 之间', () => {
      gqm.setPreset(GraphicsPreset.Low);
      const progress = gqm.getInkTransitionProgress();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('水墨过渡完成后应停止', () => {
      gqm.setPreset(GraphicsPreset.Low);
      const duration = gqm.getInkTransitionDuration();
      gqm.update(duration / 1000 + 0.1);
      expect(gqm.isInkTransitionActive()).toBe(false);
    });

    it('getInkTransitionDuration 应返回 600ms', () => {
      expect(gqm.getInkTransitionDuration()).toBe(600);
    });
  });
});
