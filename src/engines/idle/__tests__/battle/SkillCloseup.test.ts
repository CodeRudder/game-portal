import { vi } from 'vitest';
/**
 * SkillCloseup 单元测试
 *
 * 覆盖技能特写系统的所有核心功能：
 * - 构造函数和配置
 * - 触发特写
 * - 阶段转换（zooming_in → showing → zooming_out → idle）
 * - 进度计算
 * - 取消和重置
 * - 慢动作
 * - 镜头插值
 * - 事件系统
 * - 边界条件
 */

import { SkillCloseup } from '../../modules/battle/SkillCloseup';
import type { CloseupConfig, CloseupState, CloseupEvent } from '../../modules/battle/SkillCloseup';
import { BattleCamera } from '../../modules/battle/BattleCamera';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建镜头实例 */
function createCamera(): BattleCamera {
  return new BattleCamera({
    viewportWidth: 800,
    viewportHeight: 600,
    mapWidth: 2000,
    mapHeight: 1500,
  });
}

/** 创建特写系统 */
function createCloseup(config?: Partial<CloseupConfig>): SkillCloseup {
  return new SkillCloseup(config);
}

// ============================================================
// 测试套件
// ============================================================

describe('SkillCloseup', () => {
  let closeup: SkillCloseup;
  let camera: BattleCamera;

  beforeEach(() => {
    closeup = createCloseup();
    camera = createCamera();
  });

  // ============================================================
  // 构造函数
  // ============================================================

  describe('构造函数', () => {
    it('应使用默认配置创建', () => {
      const c = createCloseup();
      expect(c.getState()).toBe('idle');
      expect(c.isActive()).toBe(false);
    });

    it('应接受自定义配置', () => {
      const c = createCloseup({ zoomLevel: 3.0, slowMotion: true, slowMotionFactor: 0.2 });
      const config = c.getConfig();
      expect(config.zoomLevel).toBe(3.0);
      expect(config.slowMotion).toBe(true);
      expect(config.slowMotionFactor).toBe(0.2);
    });

    it('默认配置应有合理的值', () => {
      const config = closeup.getConfig();
      expect(config.durationMs).toBe(1100);
      expect(config.zoomLevel).toBe(2.0);
      expect(config.slowMotion).toBe(false);
      expect(config.slowMotionFactor).toBe(0.3);
    });
  });

  // ============================================================
  // 触发特写
  // ============================================================

  describe('trigger', () => {
    it('应触发特写并进入 zooming_in 状态', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      expect(closeup.getState()).toBe('zooming_in');
      expect(closeup.isActive()).toBe(true);
    });

    it('应发射 closeup_started 事件', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      expect(handler).toHaveBeenCalledWith({
        type: 'closeup_started',
        data: { unitId: 'unit-1', skillName: '烈焰斩' },
      });
    });

    it('应保存镜头状态', () => {
      camera.moveTo(800, 500);
      camera.zoomTo(1.5);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      const saved = closeup.getSavedCameraState();
      expect(saved.x).toBe(800);
      expect(saved.y).toBe(500);
      expect(saved.zoom).toBe(1.5);
    });

    it('如果已有特写，应先取消再触发', () => {
      const handler = vi.fn();
      closeup.on(handler);

      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能A', camera);
      // 进入 zooming_in
      expect(closeup.getState()).toBe('zooming_in');

      // 再次触发
      closeup.trigger('unit-2', { x: 600, y: 400 }, '技能B', camera);

      // 应该有 closeup_finished（取消）+ closeup_started（新）
      const finishCalls = handler.mock.calls.filter(c => c[0].type === 'closeup_finished');
      expect(finishCalls.length).toBe(1);
      expect(closeup.getState()).toBe('zooming_in');
    });
  });

  // ============================================================
  // 阶段转换
  // ============================================================

  describe('阶段转换', () => {
    it('zooming_in → showing（300ms 后）', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      expect(closeup.getState()).toBe('zooming_in');

      closeup.update(300);
      expect(closeup.getState()).toBe('showing');
    });

    it('showing → zooming_out（500ms 后）', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      closeup.update(300); // zooming_in 完成
      closeup.update(500); // showing 完成
      expect(closeup.getState()).toBe('zooming_out');
    });

    it('zooming_out → idle（300ms 后）', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      closeup.update(300); // zooming_in
      closeup.update(500); // showing
      closeup.update(300); // zooming_out
      expect(closeup.getState()).toBe('idle');
      expect(closeup.isActive()).toBe(false);
    });

    it('完整流程应发射所有事件', () => {
      const handler = vi.fn();
      closeup.on(handler);

      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      closeup.update(300);
      closeup.update(500);
      closeup.update(300);

      const types = handler.mock.calls.map(c => c[0].type);
      expect(types).toContain('closeup_started');
      expect(types).toContain('closeup_zooming_in');
      expect(types).toContain('closeup_showing');
      expect(types).toContain('closeup_zooming_out');
      expect(types).toContain('closeup_finished');
    });

    it('zooming_in 应发射带进度的事件', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      closeup.update(150); // 50% 进度

      const zoomInEvents = handler.mock.calls.filter(c => c[0].type === 'closeup_zooming_in');
      expect(zoomInEvents.length).toBeGreaterThan(0);
      expect(zoomInEvents[zoomInEvents.length - 1][0].data.progress).toBeCloseTo(0.5, 1);
    });

    it('showing 应发射带单位信息的事件', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      closeup.update(300); // 进入 showing

      const showEvents = handler.mock.calls.filter(c => c[0].type === 'closeup_showing');
      expect(showEvents.length).toBe(1);
      expect(showEvents[0][0].data.unitId).toBe('unit-1');
      expect(showEvents[0][0].data.skillName).toBe('烈焰斩');
    });

    it('zooming_out 应发射带进度的事件', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '烈焰斩', camera);
      closeup.update(300); // zooming_in
      closeup.update(500); // showing
      closeup.update(150); // zooming_out 50%

      const zoomOutEvents = handler.mock.calls.filter(c => c[0].type === 'closeup_zooming_out');
      expect(zoomOutEvents.length).toBeGreaterThan(0);
      expect(zoomOutEvents[zoomOutEvents.length - 1][0].data.progress).toBeCloseTo(0.5, 1);
    });
  });

  // ============================================================
  // 进度计算
  // ============================================================

  describe('getProgress', () => {
    it('idle 状态应返回 0', () => {
      expect(closeup.getProgress()).toBe(0);
    });

    it('zooming_in 阶段应返回 0-1 之间的值', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      closeup.update(150);
      expect(closeup.getProgress()).toBeCloseTo(0.5, 1);
    });

    it('进度不应超过 1', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      closeup.update(500); // 超过 300ms
      expect(closeup.getProgress()).toBe(1);
    });
  });

  // ============================================================
  // 取消和重置
  // ============================================================

  describe('cancel', () => {
    it('应取消正在进行的特写', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      closeup.cancel();
      expect(closeup.getState()).toBe('idle');
      expect(closeup.isActive()).toBe(false);
    });

    it('应发射 closeup_finished 事件', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      closeup.cancel();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'closeup_finished' }),
      );
    });

    it('idle 状态取消不应发射事件', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.cancel();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('应重置所有状态', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      closeup.update(100);
      closeup.reset();
      expect(closeup.getState()).toBe('idle');
      expect(closeup.isActive()).toBe(false);
      expect(closeup.getProgress()).toBe(0);
    });
  });

  // ============================================================
  // 慢动作
  // ============================================================

  describe('慢动作', () => {
    it('未启用慢动作时应返回 1.0', () => {
      expect(closeup.getSlowMotionFactor()).toBe(1.0);
    });

    it('启用慢动作且特写激活时应返回配置的倍率', () => {
      const c = createCloseup({ slowMotion: true, slowMotionFactor: 0.3 });
      c.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      expect(c.getSlowMotionFactor()).toBe(0.3);
    });

    it('启用慢动作但特写未激活时应返回 1.0', () => {
      const c = createCloseup({ slowMotion: true, slowMotionFactor: 0.3 });
      expect(c.getSlowMotionFactor()).toBe(1.0);
    });
  });

  // ============================================================
  // 镜头插值
  // ============================================================

  describe('getCameraInterpolation', () => {
    it('idle 状态应返回 null', () => {
      expect(closeup.getCameraInterpolation()).toBeNull();
    });

    it('zooming_in 阶段应返回插值位置', () => {
      camera.moveTo(800, 500);
      camera.zoomTo(1.0);
      closeup.trigger('unit-1', { x: 400, y: 250 }, '技能', camera);
      closeup.update(150); // 50% 进度

      const interp = closeup.getCameraInterpolation();
      expect(interp).not.toBeNull();
      expect(interp!.x).toBeCloseTo(600, 0); // lerp(800, 400, ~0.5)
      expect(interp!.y).toBeCloseTo(375, 0); // lerp(500, 250, ~0.5)
      expect(interp!.zoom).toBeGreaterThan(1.0);
      expect(interp!.zoom).toBeLessThan(2.0);
    });

    it('showing 阶段应在目标位置', () => {
      closeup.trigger('unit-1', { x: 400, y: 250 }, '技能', camera);
      closeup.update(300); // zooming_in 完成

      const interp = closeup.getCameraInterpolation();
      expect(interp).not.toBeNull();
      expect(interp!.x).toBe(400);
      expect(interp!.y).toBe(250);
      expect(interp!.zoom).toBe(2.0);
    });

    it('zooming_out 阶段应从目标位置插值回原位', () => {
      camera.moveTo(800, 500);
      closeup.trigger('unit-1', { x: 400, y: 250 }, '技能', camera);
      closeup.update(300); // zooming_in
      closeup.update(500); // showing
      closeup.update(150); // zooming_out 50%

      const interp = closeup.getCameraInterpolation();
      expect(interp).not.toBeNull();
      expect(interp!.x).toBeCloseTo(600, 0); // lerp(400, 800, ~0.5)
      expect(interp!.y).toBeCloseTo(375, 0); // lerp(250, 500, ~0.5)
    });
  });

  // ============================================================
  // 事件系统
  // ============================================================

  describe('事件系统', () => {
    it('on 应注册监听器', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      expect(handler).toHaveBeenCalled();
    });

    it('off 应注销监听器', () => {
      const handler = vi.fn();
      closeup.on(handler);
      closeup.off(handler);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      expect(handler).not.toHaveBeenCalled();
    });

    it('off 不存在的监听器不应崩溃', () => {
      const handler = vi.fn();
      expect(() => closeup.off(handler)).not.toThrow();
    });

    it('多个监听器都应收到事件', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      closeup.on(handler1);
      closeup.on(handler2);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 边界条件
  // ============================================================

  describe('边界条件', () => {
    it('update 在 idle 状态不应崩溃', () => {
      expect(() => closeup.update(16)).not.toThrow();
    });

    it('dt 为 0 不应崩溃', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      expect(() => closeup.update(0)).not.toThrow();
    });

    it('负 dt 不应崩溃', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      expect(() => closeup.update(-10)).not.toThrow();
    });

    it('单次大 dt 应跳过到最终阶段', () => {
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      closeup.update(2000); // 超过所有阶段
      expect(closeup.getState()).toBe('idle');
    });

    it('getSavedCameraState 应返回正确的值', () => {
      camera.moveTo(500, 400);
      camera.zoomTo(1.5);
      closeup.trigger('unit-1', { x: 500, y: 300 }, '技能', camera);
      const saved = closeup.getSavedCameraState();
      expect(saved.x).toBe(500);
      expect(saved.y).toBe(400);
      expect(saved.zoom).toBe(1.5);
    });

    it('getConfig 应返回配置副本', () => {
      const config1 = closeup.getConfig();
      const config2 = closeup.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });
});
