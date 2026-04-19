/**
 * TKParticleSystem 单元测试
 */
import { describe, it, expect } from 'vitest';
import { TKParticleSystem, type ParticleType } from '../ParticleSystem';

/** 创建 mock Canvas context */
function createMockCtx() {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    fillStyle: '',
    globalAlpha: 1,
    beginPath: () => {},
    arc: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arcTo: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    clip: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    scale: () => {},
    measureText: () => ({ width: 0 }),
    fillText: () => {},
    strokeText: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(0) }),
    putImageData: () => {},
    createPattern: () => null,
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

describe('TKParticleSystem', () => {
  // ── 1. 发射粒子 ──────────────────────────────────────────
  describe('emit', () => {
    it('petal 类型发射指定数量的粒子', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'petal', 10);
      expect(ps.getAliveCount()).toBe(10);
    });

    it('smoke 类型发射粒子', () => {
      const ps = new TKParticleSystem();
      ps.emit(200, 100, 'smoke', 5);
      expect(ps.getAliveCount()).toBe(5);
    });

    it('spark 类型发射粒子', () => {
      const ps = new TKParticleSystem();
      ps.emit(300, 200, 'spark', 20);
      expect(ps.getAliveCount()).toBe(20);
    });

    it('snow 类型发射粒子', () => {
      const ps = new TKParticleSystem();
      ps.emit(400, 50, 'snow', 8);
      expect(ps.getAliveCount()).toBe(8);
    });

    it('不超过粒子上限', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'spark', 600); // 超过 maxParticles=500
      expect(ps.getAliveCount()).toBe(500);
    });
  });

  // ── 2. 更新 ──────────────────────────────────────────────
  describe('update', () => {
    it('粒子随时间减少生命值', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'spark', 5);
      const countBefore = ps.getAliveCount();
      // update 内部 dt 上限为 0.1s，需多次调用才能消耗完生命值
      for (let i = 0; i < 30; i++) ps.update(0.1);
      expect(ps.getAliveCount()).toBeLessThan(countBefore);
    });

    it('petal 粒子存活时间较长', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'petal', 10);
      ps.update(1); // 1秒后花瓣还活着（生命4-8秒）
      expect(ps.getAliveCount()).toBe(10);
    });

    it('dt 过大时被限制', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'petal', 5);
      expect(() => ps.update(100)).not.toThrow();
    });
  });

  // ── 3. 渲染 ──────────────────────────────────────────────
  describe('render', () => {
    it('无粒子时不报错', () => {
      const ps = new TKParticleSystem();
      const ctx = createMockCtx();
      expect(() => ps.render(ctx)).not.toThrow();
    });

    it('有粒子时正常渲染', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'petal', 5);
      const ctx = createMockCtx();
      expect(() => ps.render(ctx)).not.toThrow();
    });

    it('spark 粒子正常渲染', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'spark', 3);
      const ctx = createMockCtx();
      expect(() => ps.render(ctx)).not.toThrow();
    });

    it('smoke 粒子正常渲染', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'smoke', 4);
      const ctx = createMockCtx();
      expect(() => ps.render(ctx)).not.toThrow();
    });
  });

  // ── 4. 自动发射器 ────────────────────────────────────────
  describe('auto emitters', () => {
    it('注册自动发射器并产生粒子', () => {
      const ps = new TKParticleSystem();
      ps.registerAutoEmitter('bg-petals', 'petal', 2, 400, 0, 400);
      // 多次小步更新（dt 被 clamp 到 0.1）
      for (let i = 0; i < 20; i++) {
        ps.update(0.1);
      }
      expect(ps.getAliveCount()).toBeGreaterThanOrEqual(1);
    });

    it('移除自动发射器', () => {
      const ps = new TKParticleSystem();
      ps.registerAutoEmitter('bg-petals', 'petal', 10, 400, 0, 400);
      for (let i = 0; i < 20; i++) {
        ps.update(0.1);
      }
      expect(ps.getAliveCount()).toBeGreaterThan(0);
      ps.removeAutoEmitter('bg-petals');
      ps.clear();
      for (let i = 0; i < 20; i++) {
        ps.update(0.1);
      }
      expect(ps.getAliveCount()).toBe(0);
    });
  });

  // ── 5. 清除 ──────────────────────────────────────────────
  describe('clear', () => {
    it('清除所有粒子', () => {
      const ps = new TKParticleSystem();
      ps.emit(100, 50, 'petal', 20);
      expect(ps.getAliveCount()).toBe(20);
      ps.clear();
      expect(ps.getAliveCount()).toBe(0);
    });
  });

  // ── 6. 序列化 ────────────────────────────────────────────
  describe('serialize', () => {
    it('序列化包含发射器信息', () => {
      const ps = new TKParticleSystem();
      ps.registerAutoEmitter('test', 'snow', 5, 100, 50, 200);
      const data = ps.serialize();
      expect(data.emitters).toBeDefined();
      expect(data.particleCount).toBe(0);
    });
  });

  // ── 7. 画布尺寸 ──────────────────────────────────────────
  describe('setCanvasSize', () => {
    it('设置画布尺寸不报错', () => {
      const ps = new TKParticleSystem();
      expect(() => ps.setCanvasSize(1024, 768)).not.toThrow();
    });
  });

  // ── 8. 粒子类型覆盖 ──────────────────────────────────────
  describe('all particle types', () => {
    const types: ParticleType[] = ['petal', 'smoke', 'spark', 'snow'];

    types.forEach(type => {
      it(`${type} 粒子完整生命周期`, () => {
        const ps = new TKParticleSystem();
        ps.emit(200, 200, type, 5);
        expect(ps.getAliveCount()).toBe(5);

        // 多次更新
        for (let i = 0; i < 10; i++) {
          ps.update(0.5);
        }
        // 粒子应该已死亡或接近死亡
        const ctx = createMockCtx();
        expect(() => ps.render(ctx)).not.toThrow();
      });
    });
  });
});
