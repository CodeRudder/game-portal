/**
 * ParticleSystem 测试
 *
 * 测试粒子系统的所有功能：
 * - 初始化和容器管理
 * - 粒子发射（emit）
 * - 粒子形状绘制（circle, square, triangle, star, diamond）
 * - 粒子池管理（acquire, release, 复用）
 * - 重力和风力参数
 * - 粒子旋转
 * - 生命周期管理
 * - Timeline 管理
 * - 销毁清理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Mock PixiJS v8
// ═══════════════════════════════════════════════════════════════

const mockRemoveFromParent = vi.fn();
const mockDestroy = vi.fn();
const mockAddChild = vi.fn();

vi.mock('pixi.js', () => {
  class MockGraphics {
    x = 0;
    y = 0;
    alpha = 1;
    rotation = 0;
    parent: any = null;

    scale = { x: 1, y: 1, set(x: number, y?: number) { this.x = x; this.y = y ?? x; } };
    position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };

    clear() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
    arc() { return this; }
    circle() { return this; }
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }

    removeFromParent() { mockRemoveFromParent(); return this; }
    destroy() { mockDestroy(); }
  }

  class MockContainer {
    x = 0;
    y = 0;
    alpha = 1;
    width = 1920;
    height = 1080;

    addChild(child: any) {
      mockAddChild(child);
      if (child) child.parent = this;
      return child;
    }
    removeChild(child: any) { return child; }
    destroy() { mockDestroy(); }
  }

  return {
    Container: MockContainer,
    Graphics: MockGraphics,
  };
});

// ═══════════════════════════════════════════════════════════════
// Mock GSAP
// ═══════════════════════════════════════════════════════════════

const mockTimelineKill = vi.fn();

function createMockTimeline(): any {
  return {
    kill: mockTimelineKill,
    to: vi.fn(function (this: any) { return this; }),
    from: vi.fn(function (this: any) { return this; }),
  };
}

vi.mock('gsap', () => {
  return {
    default: {
      timeline: vi.fn((opts?: any) => {
        const tl = createMockTimeline();
        if (opts?.onComplete) {
          // Store for manual trigger in tests
          tl._onComplete = opts.onComplete;
        }
        return tl;
      }),
      to: vi.fn(() => createMockTimeline()),
    },
  };
});

// ═══════════════════════════════════════════════════════════════
// Import after mocks
// ═══════════════════════════════════════════════════════════════

import { ParticleSystem } from '../ParticleSystem';
import type { ParticleEmitterConfig, ParticleShape } from '../ParticleSystem';
import { Container } from 'pixi.js';
import gsap from 'gsap';

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('ParticleSystem', () => {
  let ps: ParticleSystem;
  let container: Container;

  beforeEach(() => {
    vi.clearAllMocks();
    ps = new ParticleSystem(50); // 小池便于测试
    container = new Container();
  });

  afterEach(() => {
    ps.destroy();
  });

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  describe('初始化', () => {
    it('应该能创建 ParticleSystem 实例', () => {
      expect(ps).toBeDefined();
    });

    it('应该支持自定义池大小', () => {
      const customPs = new ParticleSystem(100);
      expect(customPs.getMaxPoolSize()).toBe(100);
      customPs.destroy();
    });

    it('应该使用默认池大小', () => {
      const defaultPs = new ParticleSystem();
      expect(defaultPs.getMaxPoolSize()).toBe(300);
      defaultPs.destroy();
    });

    it('init 应该设置容器', () => {
      ps.init(container);
      expect(ps.getContainer()).toBe(container);
    });

    it('未初始化时容器应为 null', () => {
      expect(ps.getContainer()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 发射
  // ═══════════════════════════════════════════════════════════

  describe('emit', () => {
    beforeEach(() => {
      ps.init(container);
    });

    it('基本发射应该返回发射的粒子数量', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        count: 5,
      });
      expect(count).toBe(5);
    });

    it('没有容器时应该返回 0', () => {
      const noContainerPs = new ParticleSystem();
      const count = noContainerPs.emit({ x: 100, y: 100 });
      expect(count).toBe(0);
    });

    it('发射后应该有活跃粒子', () => {
      ps.emit({ x: 100, y: 100, count: 3 });
      expect(ps.getActiveCount()).toBe(3);
    });

    it('发射后应该有活跃 Timeline', () => {
      ps.emit({ x: 100, y: 100, count: 2 });
      expect(ps.getActiveTimelineCount()).toBe(2);
    });

    it('默认参数应该正常工作', () => {
      const count = ps.emit({ x: 50, y: 50 });
      expect(count).toBe(10); // 默认 count=10
    });

    it('应该支持自定义颜色', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        color: '#ff0000',
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持颜色范围', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        colorRange: ['#ff0000', '#00ff00'],
        count: 5,
      });
      expect(count).toBe(5);
    });

    it('应该支持大小范围', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        sizeRange: [2, 8],
        count: 4,
      });
      expect(count).toBe(4);
    });

    it('应该支持速度范围', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        speedRange: [50, 150],
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持生命周期范围', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        lifetimeRange: [0.3, 1.0],
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持角度和扩散', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        angle: Math.PI / 4,
        spread: Math.PI / 6,
        count: 5,
      });
      expect(count).toBe(5);
    });

    it('应该支持自定义生命周期', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        lifetime: 1.5,
        count: 2,
      });
      expect(count).toBe(2);
    });

    it('应该支持自定义缓动', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        ease: 'elastic.out(1, 0.5)',
        count: 2,
      });
      expect(count).toBe(2);
    });

    it('应该支持 scaleIn 选项', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        scaleIn: true,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持初始透明度', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        alpha: 0.5,
        count: 2,
      });
      expect(count).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 重力和风力
  // ═══════════════════════════════════════════════════════════

  describe('重力和风力', () => {
    beforeEach(() => {
      ps.init(container);
    });

    it('应该支持重力 X', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        gravityX: 50,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持重力 Y', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        gravityY: 100,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持风力 X', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        windX: 30,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持风力 Y', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        windY: 20,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该同时支持重力和风力', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        gravityX: 50,
        gravityY: 100,
        windX: 30,
        windY: 20,
        count: 5,
      });
      expect(count).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 旋转
  // ═══════════════════════════════════════════════════════════

  describe('旋转', () => {
    beforeEach(() => {
      ps.init(container);
    });

    it('应该支持初始旋转角度', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        rotation: Math.PI / 4,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该支持旋转速度', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        rotationSpeed: Math.PI,
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('应该同时支持初始旋转和旋转速度', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        rotation: Math.PI / 2,
        rotationSpeed: Math.PI * 2,
        count: 5,
      });
      expect(count).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 粒子形状
  // ═══════════════════════════════════════════════════════════

  describe('粒子形状', () => {
    beforeEach(() => {
      ps.init(container);
    });

    it('circle 形状应该正常发射', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        shape: 'circle',
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('square 形状应该正常发射', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        shape: 'square',
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('triangle 形状应该正常发射', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        shape: 'triangle',
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('star 形状应该正常发射', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        shape: 'star',
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('diamond 形状应该正常发射', () => {
      const count = ps.emit({
        x: 100,
        y: 100,
        shape: 'diamond',
        count: 3,
      });
      expect(count).toBe(3);
    });

    it('drawShape 应该能绘制所有形状', () => {
      const shapes: ParticleShape[] = ['circle', 'square', 'triangle', 'star', 'diamond'];
      const { Graphics } = require('pixi.js');
      for (const shape of shapes) {
        const gfx = new Graphics();
        expect(() => ps.drawShape(gfx, shape, 5, '#ffffff')).not.toThrow();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 粒子池管理
  // ═══════════════════════════════════════════════════════════

  describe('粒子池管理', () => {
    beforeEach(() => {
      ps.init(container);
    });

    it('发射后池大小应该增长', () => {
      expect(ps.getPoolSize()).toBe(0);
      ps.emit({ x: 100, y: 100, count: 5 });
      expect(ps.getPoolSize()).toBe(5);
    });

    it('空闲粒子数量应该正确', () => {
      ps.emit({ x: 100, y: 100, count: 3 });
      // 所有粒子都活跃
      expect(ps.getActiveCount()).toBe(3);
      expect(ps.getIdleCount()).toBe(0);
    });

    it('池满时不应该超过最大容量', () => {
      const smallPs = new ParticleSystem(5);
      smallPs.init(container);
      const count = smallPs.emit({ x: 100, y: 100, count: 10 });
      expect(count).toBe(5); // 只能发射 5 个
      expect(smallPs.getPoolSize()).toBe(5);
      smallPs.destroy();
    });

    it('粒子释放后应该回到池中', () => {
      ps.emit({ x: 100, y: 100, count: 3 });
      expect(ps.getActiveCount()).toBe(3);

      // 模拟 timeline 完成 — 通过获取 timeline 的 onComplete
      const tl = (gsap.timeline as ReturnType<typeof vi.fn>).mock.results[0].value;
      if (tl._onComplete) {
        tl._onComplete();
      }

      // 检查空闲数量
      expect(ps.getIdleCount()).toBe(1);
    });

    it('复用粒子时不应增加池大小', () => {
      ps.emit({ x: 100, y: 100, count: 3 });
      expect(ps.getPoolSize()).toBe(3);

      // 模拟释放所有粒子
      const results = (gsap.timeline as ReturnType<typeof vi.fn>).mock.results;
      for (const result of results) {
        if (result.value?._onComplete) {
          result.value._onComplete();
        }
      }

      // 再次发射
      ps.emit({ x: 100, y: 100, count: 3 });
      // 池大小应该不变（复用）
      expect(ps.getPoolSize()).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Timeline 管理
  // ═══════════════════════════════════════════════════════════

  describe('Timeline 管理', () => {
    beforeEach(() => {
      ps.init(container);
    });

    it('发射后应该有活跃 Timeline', () => {
      ps.emit({ x: 100, y: 100, count: 3 });
      expect(ps.getActiveTimelineCount()).toBe(3);
    });

    it('没有发射时 Timeline 应为 0', () => {
      expect(ps.getActiveTimelineCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 销毁
  // ═══════════════════════════════════════════════════════════

  describe('销毁', () => {
    it('destroy 应该清理所有资源', () => {
      ps.init(container);
      ps.emit({ x: 100, y: 100, count: 5 });
      ps.destroy();
      expect(ps.getPoolSize()).toBe(0);
      expect(ps.getActiveTimelineCount()).toBe(0);
      expect(ps.getContainer()).toBeNull();
    });

    it('destroy 应该杀死所有活跃 Timeline', () => {
      ps.init(container);
      ps.emit({ x: 100, y: 100, count: 3 });
      ps.destroy();
      expect(mockTimelineKill).toHaveBeenCalled();
    });

    it('destroy 应该销毁所有粒子 Graphics', () => {
      ps.init(container);
      ps.emit({ x: 100, y: 100, count: 3 });
      ps.destroy();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('空 ParticleSystem destroy 不应崩溃', () => {
      const emptyPs = new ParticleSystem();
      expect(() => emptyPs.destroy()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 综合场景
  // ═══════════════════════════════════════════════════════════

  describe('综合场景', () => {
    it('多次发射应该正确管理池', () => {
      ps.init(container);
      ps.emit({ x: 100, y: 100, count: 5 });
      ps.emit({ x: 200, y: 200, count: 5 });
      expect(ps.getPoolSize()).toBe(10);
      expect(ps.getActiveCount()).toBe(10);
    });

    it('所有形状配合所有参数应该正常工作', () => {
      ps.init(container);
      const shapes: ParticleShape[] = ['circle', 'square', 'triangle', 'star', 'diamond'];
      for (const shape of shapes) {
        const count = ps.emit({
          x: 100,
          y: 100,
          shape,
          count: 2,
          color: '#ff4444',
          sizeRange: [2, 6],
          speedRange: [30, 100],
          lifetimeRange: [0.3, 0.8],
          gravityY: 50,
          windX: 20,
          rotation: Math.PI / 4,
          rotationSpeed: Math.PI,
          scaleIn: true,
        });
        expect(count).toBe(2);
      }
    });
  });
});
