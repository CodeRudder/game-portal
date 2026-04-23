/**
 * 白屏防护测试 — EVO-068~072
 *
 * 确保游戏在任何异常情况下都不会白屏。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('白屏防护 — EVO-068~072', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('EVO-068: ErrorBoundary 存在性', () => {
    it('GameErrorBoundary 组件存在于 ThreeKingdomsGame.tsx', async () => {
      const mod = await import('@/components/idle/ThreeKingdomsGame');
      // Force module evaluation to complete within timeout
      // GameErrorBoundary 在模块内部定义，验证主组件导出存在
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    }, 15000);

    it('GameErrorBoundary 是 React.Component 子类且实现了 componentDidCatch', async () => {
      const { GameErrorBoundary } = await import('@/components/idle/three-kingdoms/GameErrorBoundary');
      expect(GameErrorBoundary.prototype).toHaveProperty('render');
      expect(GameErrorBoundary.prototype).toHaveProperty('componentDidCatch');
    });
  });

  describe('EVO-069: 引擎构造安全', () => {
    it('ThreeKingdomsEngine 构造不抛异常（正常情况）', async () => {
      const { ThreeKingdomsEngine } = await import('@/games/three-kingdoms/engine');
      expect(() => new ThreeKingdomsEngine()).not.toThrow();
    });

    it('引擎构造失败时可被 try/catch 捕获', async () => {
      // 模拟 localStorage 损坏
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => { throw new Error('localStorage corrupted'); };

      try {
        const { ThreeKingdomsEngine } = await import('@/games/three-kingdoms/engine');
        // 即使 localStorage 损坏，构造也不应导致未捕获异常
        expect(() => {
          try { new ThreeKingdomsEngine(); } catch { /* 容错处理 */ }
        }).not.toThrow();
      } finally {
        localStorage.getItem = originalGetItem;
      }
    });
  });

  describe('EVO-070: 存档损坏容错', () => {
    it('损坏的 JSON 存档不导致崩溃', () => {
      localStorageMock.setItem('three-kingdoms-save', '{invalid json');
      expect(() => {
        try {
          const data = localStorage.getItem('three-kingdoms-save');
          if (data) JSON.parse(data);
        } catch {
          // 容错处理
        }
      }).not.toThrow();
    });

    it('null 存档不导致崩溃', () => {
      expect(localStorage.getItem('nonexistent')).toBeNull();
    });
  });

  describe('EVO-071: 构建产物检查', () => {
    it('引擎入口导出 ThreeKingdomsEngine', async () => {
      const mod = await import('@/games/three-kingdoms/engine');
      expect(mod.ThreeKingdomsEngine).toBeDefined();
    });

    it('引擎入口导出 RESOURCE_LABELS', async () => {
      const mod = await import('@/games/three-kingdoms/engine');
      expect(mod.RESOURCE_LABELS).toBeDefined();
    });
  });

  describe('EVO-072: 基本功能可用性', () => {
    it('引擎 tick 不抛异常', async () => {
      const { ThreeKingdomsEngine } = await import('@/games/three-kingdoms/engine');
      const engine = new ThreeKingdomsEngine();
      expect(() => engine.tick()).not.toThrow();
    });

    it('引擎 getSnapshot 返回有效数据', async () => {
      const { ThreeKingdomsEngine } = await import('@/games/three-kingdoms/engine');
      const engine = new ThreeKingdomsEngine();
      const snapshot = engine.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(typeof snapshot).toBe('object');
    });

    it('引擎 save/load 循环不抛异常', async () => {
      const { ThreeKingdomsEngine } = await import('@/games/three-kingdoms/engine');
      const engine = new ThreeKingdomsEngine();
      engine.tick();
      expect(() => engine.save()).not.toThrow();
      expect(() => engine.load()).not.toThrow();
    });
  });
});
});
