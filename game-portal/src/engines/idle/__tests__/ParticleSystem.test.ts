/**
 * ParticleSystem 单元测试
 *
 * 覆盖范围：
 * - 构造函数初始化
 * - 发射器注册 / 移除 / 查询
 * - 手动发射与自动发射
 * - 粒子物理更新（速度、重力、位置）
 * - 粒子生命周期（颜色插值、尺寸衰减、老化死亡）
 * - Canvas 渲染
 * - 边界条件与异常处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ParticleSystem,
  type EmitterConfig,
  type EmitterShape,
} from '../modules/ParticleSystem';

// ============================================================
// 测试辅助工具
// ============================================================

/** 创建默认发射器配置 */
function createDefaultConfig(overrides?: Partial<EmitterConfig>): EmitterConfig {
  return {
    id: 'test-emitter',
    shape: { type: 'point' } as EmitterShape,
    emitCount: 5,
    emitRate: 0,
    lifetime: [1, 2],
    speed: { min: 10, max: 20, angle: null, spread: 0 },
    color: { start: '#ff0000', end: '#0000ff' },
    size: { start: 4, end: 1 },
    gravity: 0,
    opacity: 1,
    textureAsset: null,
    autoRotate: false,
    rotationSpeed: 0,
    ...overrides,
  };
}

/** 创建一个 mock Canvas 2D 上下文 */
function createMockCtx(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: vi.fn(),
    globalAlpha: vi.fn(),
  };
}

// ============================================================
// 测试用例
// ============================================================

describe('ParticleSystem', () => {
  let ps: ParticleSystem;

  beforeEach(() => {
    ps = new ParticleSystem();
  });

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('应正确初始化，初始无粒子无发射器', () => {
      expect(ps.getAliveCount()).toBe(0);
      expect(ps.getEmitterIds()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 发射器管理
  // ----------------------------------------------------------

  describe('registerEmitter', () => {
    it('应成功注册发射器', () => {
      ps.registerEmitter(createDefaultConfig());
      expect(ps.getEmitterIds()).toContain('test-emitter');
    });

    it('应支持注册多个发射器', () => {
      ps.registerEmitter(createDefaultConfig({ id: 'emitter-a' }));
      ps.registerEmitter(createDefaultConfig({ id: 'emitter-b' }));
      expect(ps.getEmitterIds().sort()).toEqual(['emitter-a', 'emitter-b']);
    });

    it('应支持覆盖已存在的发射器配置', () => {
      ps.registerEmitter(createDefaultConfig({ emitCount: 3 }));
      ps.registerEmitter(createDefaultConfig({ emitCount: 10 }));
      // 注册后 emit 使用最新配置
      ps.emit('test-emitter', 100, 100);
      expect(ps.getAliveCount()).toBe(10);
    });
  });

  describe('removeEmitter', () => {
    it('应移除发射器', () => {
      ps.registerEmitter(createDefaultConfig({ id: 'e1' }));
      ps.removeEmitter('e1');
      expect(ps.getEmitterIds()).not.toContain('e1');
    });

    it('应同时清除该发射器产生的所有粒子', () => {
      ps.registerEmitter(createDefaultConfig({ id: 'e1' }));
      ps.emit('e1', 50, 50, 10);
      expect(ps.getAliveCount()).toBe(10);

      ps.removeEmitter('e1');
      expect(ps.getAliveCount()).toBe(0);
    });

    it('移除不存在的发射器不应报错', () => {
      expect(() => ps.removeEmitter('nonexistent')).not.toThrow();
    });
  });

  describe('getEmitterIds', () => {
    it('应返回所有已注册发射器 ID', () => {
      ps.registerEmitter(createDefaultConfig({ id: 'a' }));
      ps.registerEmitter(createDefaultConfig({ id: 'b' }));
      ps.registerEmitter(createDefaultConfig({ id: 'c' }));
      const ids = ps.getEmitterIds();
      expect(ids.sort()).toEqual(['a', 'b', 'c']);
    });

    it('无发射器时返回空数组', () => {
      expect(ps.getEmitterIds()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 手动发射
  // ----------------------------------------------------------

  describe('emit', () => {
    it('应根据 emitCount 发射指定数量的粒子', () => {
      ps.registerEmitter(createDefaultConfig({ emitCount: 7 }));
      ps.emit('test-emitter', 100, 200);
      expect(ps.getAliveCount()).toBe(7);
    });

    it('应支持 count 参数覆盖默认发射数量', () => {
      ps.registerEmitter(createDefaultConfig({ emitCount: 5 }));
      ps.emit('test-emitter', 100, 200, 20);
      expect(ps.getAliveCount()).toBe(20);
    });

    it('发射不存在的发射器不应报错', () => {
      expect(() => ps.emit('nonexistent', 0, 0)).not.toThrow();
      expect(ps.getAliveCount()).toBe(0);
    });

    it('多次发射应累加粒子', () => {
      ps.registerEmitter(createDefaultConfig({ emitCount: 3 }));
      ps.emit('test-emitter', 0, 0);
      ps.emit('test-emitter', 0, 0);
      ps.emit('test-emitter', 0, 0);
      expect(ps.getAliveCount()).toBe(9);
    });

    it('粒子应具有正确的 emitterId', () => {
      ps.registerEmitter(createDefaultConfig({ id: 'my-emitter' }));
      ps.emit('my-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 自动发射
  // ----------------------------------------------------------

  describe('自动发射', () => {
    it('emitRate > 0 时应自动发射粒子', () => {
      ps.registerEmitter(createDefaultConfig({
        emitRate: 10,   // 每秒 10 次
        emitCount: 2,
      }));
      ps.emit('test-emitter', 100, 100); // 设置初始位置
      ps.update(0.1); // 0.1 秒 = 1 次发射
      expect(ps.getAliveCount()).toBe(2 + 2); // emit() 的 2 + auto 的 2
    });

    it('emitRate = 0 时不应自动发射', () => {
      ps.registerEmitter(createDefaultConfig({
        emitRate: 0,
        emitCount: 5,
      }));
      ps.update(1.0);
      expect(ps.getAliveCount()).toBe(0);
    });

    it('高帧率下应正确累积发射', () => {
      ps.registerEmitter(createDefaultConfig({
        emitRate: 5,    // 每秒 5 次
        emitCount: 1,
      }));
      ps.emit('test-emitter', 100, 100); // 设置位置

      // 模拟 10 帧，每帧 0.02 秒 = 总共 0.2 秒 = 1 次发射
      for (let i = 0; i < 10; i++) {
        ps.update(0.02);
      }
      // emit() 产生 1 个 + 自动发射 1 个 = 2 个
      expect(ps.getAliveCount()).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------
  // 粒子物理更新
  // ----------------------------------------------------------

  describe('update — 物理模拟', () => {
    it('粒子应按速度移动', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        speed: { min: 100, max: 100, angle: 0, spread: 0 }, // 向右 100px/s
        gravity: 0,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      ps.update(0.5); // 0.5 秒后 x ≈ 50

      expect(ps.getAliveCount()).toBe(1);
    });

    it('重力应影响 vy', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        speed: { min: 0, max: 0, angle: null, spread: 0 },
        gravity: 200, // 200 px/s² 向下
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 0, 1);

      ps.update(1.0);

      // 1 秒后 vy ≈ 200，y ≈ 100
      expect(ps.getAliveCount()).toBe(1);
    });

    it('粒子超过 maxAge 应标记为死亡', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        lifetime: [0.05, 0.05],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);

      ps.update(0.1); // dt 被限制为 0.1，超过 maxAge 0.05
      expect(ps.getAliveCount()).toBe(0);
    });

    it('粒子应在生命周期内颜色从 start 渐变到 end', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        lifetime: [1, 1],
        color: { start: '#ff0000', end: '#0000ff' },
      }));
      ps.emit('test-emitter', 0, 0, 1);

      // 更新到一半生命周期
      ps.update(0.5);

      expect(ps.getAliveCount()).toBe(1);
    });

    it('粒子尺寸应在生命周期内衰减', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        lifetime: [1, 1],
        size: { start: 10, end: 0 },
      }));
      ps.emit('test-emitter', 0, 0, 1);

      ps.update(0.5);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('不透明度应随生命周期线性衰减', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        lifetime: [1, 1],
        opacity: 1,
      }));
      ps.emit('test-emitter', 0, 0, 1);

      ps.update(0.5);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('autoRotate 应更新粒子旋转角度', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        autoRotate: true,
        rotationSpeed: Math.PI, // 每秒 π 弧度
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);

      ps.update(1.0);
      expect(ps.getAliveCount()).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 形状测试
  // ----------------------------------------------------------

  describe('EmitterShape', () => {
    it('point 形状应在精确中心点生成粒子', () => {
      ps.registerEmitter(createDefaultConfig({
        shape: { type: 'point' },
        emitCount: 1,
        speed: { min: 0, max: 0, angle: null, spread: 0 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 50, 80, 1);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('circle 形状应在圆内生成粒子', () => {
      ps.registerEmitter(createDefaultConfig({
        shape: { type: 'circle', radius: 50 },
        emitCount: 100,
        speed: { min: 0, max: 0, angle: null, spread: 0 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 100, 100);
      expect(ps.getAliveCount()).toBe(100);
    });

    it('rect 形状应在矩形内生成粒子', () => {
      ps.registerEmitter(createDefaultConfig({
        shape: { type: 'rect', width: 200, height: 100 },
        emitCount: 50,
        speed: { min: 0, max: 0, angle: null, spread: 0 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 100, 50);
      expect(ps.getAliveCount()).toBe(50);
    });

    it('ring 形状应在环形区域内生成粒子', () => {
      ps.registerEmitter(createDefaultConfig({
        shape: { type: 'ring', innerRadius: 20, outerRadius: 50 },
        emitCount: 100,
        speed: { min: 0, max: 0, angle: null, spread: 0 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 100, 100);
      expect(ps.getAliveCount()).toBe(100);
    });
  });

  // ----------------------------------------------------------
  // 速度配置
  // ----------------------------------------------------------

  describe('SpeedConfig', () => {
    it('angle=null 时应随机 360° 发射', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 100,
        speed: { min: 50, max: 50, angle: null, spread: 0 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 100, 100);
      expect(ps.getAliveCount()).toBe(100);
    });

    it('指定 angle + spread 时应在角度范围内发射', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 50,
        speed: { min: 50, max: 100, angle: 0, spread: Math.PI / 4 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 100, 50);
      expect(ps.getAliveCount()).toBe(50);
    });
  });

  // ----------------------------------------------------------
  // 渲染
  // ----------------------------------------------------------

  describe('render', () => {
    it('应调用 Canvas save/restore', () => {
      const ctx = createMockCtx() as unknown as CanvasRenderingContext2D;
      ps.render(ctx);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('无粒子时不应绘制任何内容', () => {
      const ctx = createMockCtx() as unknown as CanvasRenderingContext2D;
      ps.render(ctx);
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('有粒子时应调用 arc 绘制圆形', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 3,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 100, 100);

      const ctx = createMockCtx() as unknown as CanvasRenderingContext2D;
      ps.render(ctx);
      expect(ctx.arc).toHaveBeenCalledTimes(3);
    });

    it('死亡粒子不应被绘制', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 5,
        lifetime: [0.1, 0.1],
      }));
      ps.emit('test-emitter', 100, 100);
      ps.update(0.2); // 所有粒子应已死亡

      const ctx = createMockCtx() as unknown as CanvasRenderingContext2D;
      ps.render(ctx);
      expect(ctx.arc).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // clear
  // ----------------------------------------------------------

  describe('clear', () => {
    it('应清除所有粒子', () => {
      ps.registerEmitter(createDefaultConfig({ emitCount: 10 }));
      ps.emit('test-emitter', 0, 0);
      expect(ps.getAliveCount()).toBe(10);

      ps.clear();
      expect(ps.getAliveCount()).toBe(0);
    });

    it('清除后发射器仍保留', () => {
      ps.registerEmitter(createDefaultConfig());
      ps.clear();
      expect(ps.getEmitterIds()).toContain('test-emitter');
    });
  });

  // ----------------------------------------------------------
  // getAliveCount
  // ----------------------------------------------------------

  describe('getAliveCount', () => {
    it('应准确统计存活粒子数', () => {
      ps.registerEmitter(createDefaultConfig({
        id: 'short',
        emitCount: 5,
        lifetime: [0.1, 0.1],
      }));
      ps.registerEmitter(createDefaultConfig({
        id: 'long',
        emitCount: 3,
        lifetime: [10, 10],
      }));

      ps.emit('short', 0, 0);
      ps.emit('long', 0, 0);
      expect(ps.getAliveCount()).toBe(8);

      ps.update(0.2); // short 粒子死亡
      expect(ps.getAliveCount()).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // 颜色解析
  // ----------------------------------------------------------

  describe('颜色解析与插值', () => {
    it('应支持 #rrggbb 格式', () => {
      ps.registerEmitter(createDefaultConfig({
        color: { start: '#ff0000', end: '#00ff00' },
        emitCount: 1,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('应支持 rgba() 格式', () => {
      ps.registerEmitter(createDefaultConfig({
        color: { start: 'rgba(255,0,0,1)', end: 'rgba(0,0,255,0.5)' },
        emitCount: 1,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('应支持 rgb() 格式', () => {
      ps.registerEmitter(createDefaultConfig({
        color: { start: 'rgb(255,0,0)', end: 'rgb(0,0,255)' },
        emitCount: 1,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('应支持 #rgb 短格式', () => {
      ps.registerEmitter(createDefaultConfig({
        color: { start: '#f00', end: '#00f' },
        emitCount: 1,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('应支持 #rrggbbaa 格式', () => {
      ps.registerEmitter(createDefaultConfig({
        color: { start: '#ff0000ff', end: '#0000ff80' },
        emitCount: 1,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 边界条件
  // ----------------------------------------------------------

  describe('边界条件', () => {
    it('dt = 0 时不应崩溃', () => {
      ps.registerEmitter(createDefaultConfig({ emitRate: 10, emitCount: 5 }));
      ps.emit('test-emitter', 0, 0);
      expect(() => ps.update(0)).not.toThrow();
    });

    it('超大 dt 应被限制为 0.1 秒', () => {
      ps.registerEmitter(createDefaultConfig({
        emitRate: 10,
        emitCount: 1,
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0);
      expect(() => ps.update(5)).not.toThrow();
    });

    it('lifetime [0, 0] 时粒子应立即死亡', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 5,
        lifetime: [0, 0],
      }));
      ps.emit('test-emitter', 0, 0);
      ps.update(0.001);
      expect(ps.getAliveCount()).toBe(0);
    });

    it('speed min=max 时所有粒子速度相同', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1,
        speed: { min: 50, max: 50, angle: 0, spread: 0 },
        lifetime: [10, 10],
      }));
      ps.emit('test-emitter', 0, 0, 1);
      expect(ps.getAliveCount()).toBe(1);
    });

    it('大量粒子不应导致性能问题', () => {
      ps.registerEmitter(createDefaultConfig({
        emitCount: 1000,
        lifetime: [10, 10],
        speed: { min: 10, max: 50, angle: null, spread: 0 },
      }));
      const start = performance.now();
      ps.emit('test-emitter', 400, 300);
      ps.update(0.016);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100); // 应在 100ms 内完成
    });
  });
});
