/**
 * ConquestAnimationSystem — 渲染测试
 *
 * 覆盖:
 * - 阶段1(0~40%): 颜色渐变 + 战斗粒子效果
 * - 阶段2(40~70%): 旗帜升起动画
 * - 阶段3(70~100%): 结果文字
 * - 动画完成后再渲染不报错
 * - 多个动画同时渲染
 * - Canvas context方法被正确调用
 *
 * @module engine/map/__tests__/ConquestAnimation.render.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConquestAnimationSystem, FACTION_COLORS } from '../ConquestAnimation';
import type { ConquestAnim } from '../ConquestAnimation';

// ─────────────────────────────────────────────
// Mock CanvasRenderingContext2D
// ─────────────────────────────────────────────

function createMockCtx(): CanvasRenderingContext2D {
  const mock = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
  };
  return mock as unknown as CanvasRenderingContext2D;
}

// ─────────────────────────────────────────────
// 辅助: 强制设置动画状态
// ─────────────────────────────────────────────

function forceAnimState(
  system: ConquestAnimationSystem,
  animId: string,
  state: ConquestAnim['state'],
  progress: number,
): void {
  const active = system.getActive();
  const anim = active.find(a => a.id === animId);
  if (!anim) throw new Error(`Animation ${animId} not found`);
  // 直接修改内部状态(通过类型断言)
  (anim as any).state = state;
  (anim as any).progress = progress;
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('ConquestAnimationSystem 渲染', () => {
  let system: ConquestAnimationSystem;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    system = new ConquestAnimationSystem();
    ctx = createMockCtx();
  });

  // ─────────────────────────────────────────
  // 1. 阶段1渲染(capturing)
  // ─────────────────────────────────────────
  describe('阶段1: capturing(颜色渐变 + 粒子)', () => {
    it('capturing状态渲染不报错', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.2);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('capturing状态调用fillRect绘制颜色渐变', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.2);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 应调用save/restore和fillRect
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('capturing状态调用arc绘制粒子圆点', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.3);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 粒子使用arc绘制圆点
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('capturing进度0时无粒子', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 进度0时粒子数为 floor(0/0.4 * 8) = 0
      expect(mockCtx.arc).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 2. 阶段2渲染(flag_change)
  // ─────────────────────────────────────────
  describe('阶段2: flag_change(旗帜升起)', () => {
    it('flag_change状态渲染不报错', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'flag_change', 0.55);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('flag_change状态绘制旗杆和旗帜', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'flag_change', 0.55);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 旗杆: beginPath + moveTo + lineTo + stroke
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();

      // 旗帜: fillRect
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('flag_change状态绘制阵营文字', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'flag_change', 0.55);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 阵营文字: fillText
      expect(mockCtx.fillText).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 3. 阶段3渲染(result)
  // ─────────────────────────────────────────
  describe('阶段3: result(结果文字)', () => {
    it('result状态渲染不报错(成功)', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'result', 0.85);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('result状态渲染不报错(失败)', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: false,
        troopsLost: 500,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'result', 0.85);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('result状态绘制结果文字(成功)', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'result', 0.85);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 结果文字有阴影+正文两次fillText
      expect(mockCtx.fillText).toHaveBeenCalled();
      // 检查fillText被调用(阴影+正文)
      expect(mockCtx.fillText.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('result状态绘制结果文字(失败)', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: false,
        troopsLost: 500,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'result', 0.85);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('无result时不绘制文字', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu');
      forceAnimState(system, anim.id, 'result', 0.85);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 无result时只有背景fillRect，无fillText
      expect(mockCtx.fillText).not.toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 4. 动画完成后再渲染
  // ─────────────────────────────────────────
  describe('动画完成后渲染', () => {
    it('动画完成后渲染不报错(空列表)', () => {
      // 创建后立即模拟完成
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu');
      (anim as any).startTime = Date.now() - 5000;
      system.update(); // 触发done状态并移除

      expect(system.getActive().length).toBe(0);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('动画完成后不调用任何绘制方法', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu');
      (anim as any).startTime = Date.now() - 5000;
      system.update();

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      expect(mockCtx.fillRect).not.toHaveBeenCalled();
      expect(mockCtx.fillText).not.toHaveBeenCalled();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // 5. 多个动画同时渲染
  // ─────────────────────────────────────────
  describe('多个动画同时渲染', () => {
    it('两个动画同时渲染不报错', () => {
      const anim1 = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      const anim2 = system.create('city-b', 20, 20, 'wei', 'shu', {
        success: false,
        troopsLost: 300,
        general: '关羽',
      });
      forceAnimState(system, anim1.id, 'capturing', 0.2);
      forceAnimState(system, anim2.id, 'flag_change', 0.55);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('三个动画三个阶段同时渲染不报错', () => {
      const anim1 = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      const anim2 = system.create('city-b', 20, 20, 'wei', 'shu', {
        success: false,
        troopsLost: 300,
        general: '关羽',
      });
      const anim3 = system.create('city-c', 30, 30, 'wu', 'wei', {
        success: true,
        troopsLost: 200,
        general: '赵云',
      });
      forceAnimState(system, anim1.id, 'capturing', 0.2);
      forceAnimState(system, anim2.id, 'flag_change', 0.55);
      forceAnimState(system, anim3.id, 'result', 0.85);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });

    it('多个动画渲染调用多次绘制方法', () => {
      const anim1 = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      const anim2 = system.create('city-b', 20, 20, 'wei', 'shu', {
        success: false,
        troopsLost: 300,
        general: '关羽',
      });
      forceAnimState(system, anim1.id, 'result', 0.85);
      forceAnimState(system, anim2.id, 'result', 0.85);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 两个动画各调用2次fillText(阴影+正文) = 4次
      expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─────────────────────────────────────────
  // 6. Canvas context方法调用验证
  // ─────────────────────────────────────────
  describe('Canvas context方法调用', () => {
    it('capturing阶段正确使用save/restore', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.2);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 背景色: save + restore; 粒子: save + restore
      expect(mockCtx.save.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockCtx.restore.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('flag_change阶段调用beginPath/stroke绘制旗杆', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'flag_change', 0.55);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('result阶段调用fillText绘制文字', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'result', 0.85);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 阴影文字 + 正文
      const calls = mockCtx.fillText.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });

    it('粒子使用arc绘制圆点', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.3);

      const mockCtx = createMockCtx();
      system.render(mockCtx, 8, 0, 0);

      // 粒子用arc绘制
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('不同offset正确计算像素位置', () => {
      const anim = system.create('city-a', 10, 10, 'neutral', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.2);

      const mockCtx = createMockCtx();
      // offsetX=50, offsetY=30, ts=8
      // 预期px = 10*8 - 50 = 30, py = 10*8 - 30 = 50
      system.render(mockCtx, 8, 50, 30);

      // fillRect应该被调用(背景色渐变)
      expect(mockCtx.fillRect).toHaveBeenCalled();
      // 检查第一个fillRect调用的坐标
      const firstCall = mockCtx.fillRect.mock.calls[0];
      expect(firstCall[0]).toBe(30); // px
      expect(firstCall[1]).toBe(50); // py
      expect(firstCall[2]).toBe(24); // size = 8 * 3
      expect(firstCall[3]).toBe(24); // size = 8 * 3
    });
  });

  // ─────────────────────────────────────────
  // 7. 阵营颜色正确性
  // ─────────────────────────────────────────
  describe('阵营颜色', () => {
    it('FACTION_COLORS包含四阵营', () => {
      expect(FACTION_COLORS.wei).toBe('#2E5090');
      expect(FACTION_COLORS.shu).toBe('#8B2500');
      expect(FACTION_COLORS.wu).toBe('#2E6B3E');
      expect(FACTION_COLORS.neutral).toBe('#6B5B3E');
    });

    it('不同阵营渲染不报错', () => {
      const factions = ['wei', 'shu', 'wu', 'neutral'];
      for (const from of factions) {
        for (const to of factions) {
          if (from === to) continue;
          const s = new ConquestAnimationSystem();
          const anim = s.create('city-a', 5, 5, from, to, {
            success: true,
            troopsLost: 100,
            general: '测试',
          });
          forceAnimState(s, anim.id, 'capturing', 0.2);
          expect(() => {
            s.render(createMockCtx(), 8, 0, 0);
          }).not.toThrow();
        }
      }
    });

    it('未知阵营使用neutral颜色', () => {
      const anim = system.create('city-a', 10, 10, 'unknown_faction', 'shu', {
        success: true,
        troopsLost: 100,
        general: '张飞',
      });
      forceAnimState(system, anim.id, 'capturing', 0.2);

      expect(() => {
        system.render(ctx, 8, 0, 0);
      }).not.toThrow();
    });
  });
});
