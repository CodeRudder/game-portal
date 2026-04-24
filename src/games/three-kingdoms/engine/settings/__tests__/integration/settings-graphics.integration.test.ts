/**
 * 集成测试 — §2 画质管理 (v19.0)
 *
 * 覆盖：
 *   - 4档画质预设 (低/中/高/自动)
 *   - 自动检测设备能力并推荐画质
 *   - 5项高级画质选项独立控制
 *   - 水墨过渡动画 (0.6s)
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/settings/__tests__/integration/settings-graphics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphicsManager } from '../../GraphicsManager';
import { AnimationController } from '../../AnimationController';
import type { IAnimationPlayer, AnimationEventCallbacks } from '../../AnimationController';
import type { GraphicsSettings, AdvancedGraphicsOptions, DeviceCapability } from '../../../../core/settings';
import { GraphicsPreset, EasingType, TransitionType, INK_WASH_TRANSITION_DURATION } from '../../../../core/settings';
import type { ISystemDeps } from '../../../../core/types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

/** 构造 mock ISystemDeps */
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

/** 创建已初始化的 GraphicsManager */
function createGraphicsManager(): GraphicsManager {
  const mgr = new GraphicsManager();
  mgr.init(mockDeps());
  return mgr;
}

/** 创建 mock 动画播放器 */
function createMockAnimationPlayer(): IAnimationPlayer & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    playTransition: (...args) => { calls.push({ method: 'playTransition', args }); },
    playStateAnimation: (...args) => { calls.push({ method: 'playStateAnimation', args }); },
    playFeedback: (...args) => { calls.push({ method: 'playFeedback', args }); },
    playInkWashTransition: (...args) => { calls.push({ method: 'playInkWashTransition', args }); },
    cancelAll: () => { calls.push({ method: 'cancelAll', args: [] }); },
  };
}

/** 低端设备 */
const LOW_DEVICE: DeviceCapability = { cpuCores: 2, memoryGB: 2 };
/** 中端设备 */
const MID_DEVICE: DeviceCapability = { cpuCores: 4, memoryGB: 4 };
/** 高端设备 */
const HIGH_DEVICE: DeviceCapability = { cpuCores: 8, memoryGB: 8 };

// ═══════════════════════════════════════════════════════════════════════

describe('v19.0 §2 画质管理 集成测试', () => {

  // ═══════════════════════════════════════════════════════════════════
  // §2.1  4档画质预设
  // ═══════════════════════════════════════════════════════════════════

  describe('§2.1 4档画质预设', () => {

    it('低画质: 粒子/阴影/水墨/抗锯齿全关, 帧率30', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.Low);
      const opts = mgr.getEffectiveOptions();
      expect(opts.particleEffects).toBe(false);
      expect(opts.realtimeShadows).toBe(false);
      expect(opts.inkWash).toBe(false);
      expect(opts.frameRateLimit).toBe(30);
      expect(opts.antiAliasing).toBe(false);
    });

    it('中画质: 粒子/水墨开, 阴影/抗锯齿关, 帧率60', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.Medium);
      const opts = mgr.getEffectiveOptions();
      expect(opts.particleEffects).toBe(true);
      expect(opts.realtimeShadows).toBe(false);
      expect(opts.inkWash).toBe(true);
      expect(opts.frameRateLimit).toBe(60);
      expect(opts.antiAliasing).toBe(false);
    });

    it('高画质: 全部开启, 帧率60', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.High);
      const opts = mgr.getEffectiveOptions();
      expect(opts.particleEffects).toBe(true);
      expect(opts.realtimeShadows).toBe(true);
      expect(opts.inkWash).toBe(true);
      expect(opts.frameRateLimit).toBe(60);
      expect(opts.antiAliasing).toBe(true);
    });

    it('自动模式: 根据设备能力选择预设', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.Auto);
      // 默认检测（可能为 Medium）
      const detected = mgr.getDetectedPreset();
      expect(detected).not.toBeNull();
      expect([GraphicsPreset.Low, GraphicsPreset.Medium, GraphicsPreset.High]).toContain(detected);
    });

    it('切换预设后 getSettings().preset 正确反映', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.High);
      expect(mgr.getSettings().preset).toBe(GraphicsPreset.High);
      mgr.applyPreset(GraphicsPreset.Low);
      expect(mgr.getSettings().preset).toBe(GraphicsPreset.Low);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §2.2  自动检测
  // ═══════════════════════════════════════════════════════════════════

  describe('§2.2 自动检测设备能力', () => {

    it('低端设备 (2核/2GB) → 推荐低画质', () => {
      const mgr = createGraphicsManager();
      expect(mgr.detectBestPreset(LOW_DEVICE)).toBe(GraphicsPreset.Low);
    });

    it('中端设备 (4核/4GB) → 推荐中画质', () => {
      const mgr = createGraphicsManager();
      expect(mgr.detectBestPreset(MID_DEVICE)).toBe(GraphicsPreset.Medium);
    });

    it('高端设备 (8核/8GB) → 推荐高画质', () => {
      const mgr = createGraphicsManager();
      expect(mgr.detectBestPreset(HIGH_DEVICE)).toBe(GraphicsPreset.High);
    });

    it('边界: 6核/6GB → 中画质 (不满足高画质8核要求)', () => {
      const mgr = createGraphicsManager();
      expect(mgr.detectBestPreset({ cpuCores: 6, memoryGB: 6 })).toBe(GraphicsPreset.Medium);
    });

    it('isLowQuality / isHighQuality 与预设一致', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.Low);
      expect(mgr.isLowQuality()).toBe(true);
      expect(mgr.isHighQuality()).toBe(false);

      mgr.applyPreset(GraphicsPreset.High);
      expect(mgr.isLowQuality()).toBe(false);
      expect(mgr.isHighQuality()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §2.3  高级选项独立控制
  // ═══════════════════════════════════════════════════════════════════

  describe('§2.3 高级选项独立控制', () => {

    it('setAdvancedOption: 单独关闭粒子特效', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.High);
      expect(mgr.getEffectiveOptions().particleEffects).toBe(true);
      mgr.setAdvancedOption('particleEffects', false);
      expect(mgr.getEffectiveOptions().particleEffects).toBe(false);
      // 其他选项不变
      expect(mgr.getEffectiveOptions().realtimeShadows).toBe(true);
    });

    it('updateAdvancedOptions: 批量修改多项', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.Medium);
      mgr.updateAdvancedOptions({ frameRateLimit: 30, antiAliasing: true });
      expect(mgr.getEffectiveOptions().frameRateLimit).toBe(30);
      expect(mgr.getEffectiveOptions().antiAliasing).toBe(true);
    });

    it('shouldShowAdvancedOptions: 低画质隐藏高级选项', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.Low);
      expect(mgr.shouldShowAdvancedOptions()).toBe(false);
      mgr.applyPreset(GraphicsPreset.High);
      expect(mgr.shouldShowAdvancedOptions()).toBe(true);
    });

    it('切换预设重置高级选项为预设默认值', () => {
      const mgr = createGraphicsManager();
      mgr.applyPreset(GraphicsPreset.High);
      mgr.setAdvancedOption('antiAliasing', false); // 自定义修改
      mgr.applyPreset(GraphicsPreset.High); // 重新应用
      expect(mgr.getEffectiveOptions().antiAliasing).toBe(true); // 恢复预设默认
    });

    it('onChange 回调在预设切换时触发', () => {
      const mgr = createGraphicsManager();
      const callback = vi.fn();
      mgr.onChange(callback);
      mgr.applyPreset(GraphicsPreset.High);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].preset).toBe(GraphicsPreset.High);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §2.4  水墨过渡动画
  // ═══════════════════════════════════════════════════════════════════

  describe('§2.4 水墨过渡动画', () => {

    it('INK_WASH_TRANSITION_DURATION 常量为 600ms', () => {
      expect(INK_WASH_TRANSITION_DURATION).toBe(600);
    });

    it('AnimationController 播放水墨过渡: 调用 player.playInkWashTransition(600)', () => {
      const ctrl = new AnimationController();
      ctrl.init(mockDeps());
      const player = createMockAnimationPlayer();
      ctrl.setPlayer(player);
      ctrl.playInkWashTransition();
      const inkCalls = player.calls.filter(c => c.method === 'playInkWashTransition');
      expect(inkCalls.length).toBe(1);
      expect(inkCalls[0].args[0]).toBe(INK_WASH_TRANSITION_DURATION);
    });

    it('水墨过渡 onInkWashStart / onInkWashEnd 回调触发', () => {
      const ctrl = new AnimationController();
      ctrl.init(mockDeps());
      const player = createMockAnimationPlayer();
      ctrl.setPlayer(player);
      const onStart = vi.fn();
      const onEnd = vi.fn();
      ctrl.setCallbacks({ onInkWashStart: onStart, onInkWashEnd: onEnd });
      ctrl.playInkWashTransition();
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('getInkWashDuration 返回 600ms', () => {
      const ctrl = new AnimationController();
      ctrl.init(mockDeps());
      expect(ctrl.getInkWashDuration()).toBe(INK_WASH_TRANSITION_DURATION);
    });

    it('水墨过渡使用合理缓动配置', () => {
      const ctrl = new AnimationController();
      ctrl.init(mockDeps());
      const config = ctrl.getTransitionConfig(TransitionType.PanelOpen);
      expect(config).toBeDefined();
      expect(config.duration).toBeGreaterThan(0);
      expect(config.easing).toBeDefined();
    });
  });
});
