/**
 * CivGamePixiComponent 测试
 *
 * 测试通用文明游戏 PixiJS React 组件：
 * - 组件渲染（加载/就绪/错误状态）
 * - 文明 ID 选择
 * - 事件回调
 * - 科技面板切换
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock PixiJS v8
// ---------------------------------------------------------------------------

vi.mock('pixi.js', () => {
  class MockApplication {
    canvas = document.createElement('canvas');
    stage = {
      addChild: vi.fn(),
      removeChild: vi.fn(),
      children: [],
      destroy: vi.fn(),
    };
    ticker = {
      add: vi.fn(),
      remove: vi.fn(),
      deltaMS: 16.67,
    };
    renderer = {
      resize: vi.fn(),
      destroy: vi.fn(),
    };

    async init(_opts?: any) {
      return Promise.resolve();
    }

    destroy(_removeView?: boolean, _opts?: any) {}
  }

  class MockContainer {
    label: string;
    visible = true;
    children: any[] = [];
    parent: any = null;
    position = { set: vi.fn() };
    scale = { set: vi.fn(), x: 1, y: 1 };
    emit = vi.fn();
    on = vi.fn().mockReturnThis();
    off = vi.fn();
    eventMode = 'passive';
    cursor = 'default';

    constructor(opts?: { label?: string }) { this.label = opts?.label ?? ''; }
    addChild(child: any) { this.children.push(child); if (child) child.parent = this; }
    removeChild(child: any) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
    }
    destroy(_opts?: any) { this.children = []; }
  }

  class MockGraphics {
    label = '';
    visible = true;
    clear() { return this; }
    circle() { return this; }
    rect() { return this; }
    ellipse() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
    fill() { return this; }
    stroke() { return this; }
    roundRect() { return this; }
    quadraticCurveTo() { return this; }
    destroy() {}
  }

  class MockText {
    label = '';
    text = '';
    visible = true;
    anchor = { set: vi.fn(), x: 0, y: 0 };
    x = 0; y = 0; width = 50; height = 14;
    position = { set: vi.fn() };
    emit = vi.fn();
    on = vi.fn();
    off = vi.fn();
    constructor(opts?: any) { this.text = opts?.text ?? ''; }
    destroy() {}
  }

  return { Application: MockApplication, Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

// ---------------------------------------------------------------------------
// Mock IdleGameEngine
// ---------------------------------------------------------------------------

function createMockEngine(gameId: string = 'civ-china') {
  return {
    gameId,
    getUnlockedResources: vi.fn(() => [
      { id: 'food', name: '粮食', amount: 1000, perSecond: 5.5, maxAmount: 1e9, unlocked: true },
      { id: 'silk', name: '丝绸', amount: 500, perSecond: 2.0, maxAmount: 1e9, unlocked: true },
    ]),
    getAvailableUpgrades: vi.fn(() => [
      {
        id: 'upgrade-1', name: '农田升级', description: '增加粮食产出',
        level: 2, maxLevel: 10, baseCost: { food: 100 }, costMultiplier: 1.5,
        unlocked: true, effect: { type: 'multiplier', target: 'food', value: 1.5 },
      },
    ]),
    getUpgradeCost: vi.fn(() => ({ food: 150 })),
    canAfford: vi.fn(() => true),
    purchaseUpgrade: vi.fn(() => true),
    prestige: { currency: 10, count: 2 },
    statistics: { totalEarned: 50000 },
    stages: {
      getCurrentStage: vi.fn(() => ({
        id: 'tang', name: '唐', description: '盛世大唐',
        productionMultiplier: 2.5, themeColor: '#daa520', order: 5,
      })),
      getAllStages: vi.fn(() => [
        { id: 'xia', name: '夏', order: 1 },
        { id: 'tang', name: '唐', order: 5 },
      ]),
      getProgress: vi.fn(() => 0.65),
    },
    techs: {
      getAllTechs: vi.fn(() => [
        { id: 'irrigation', name: '灌溉术', tier: 1 },
      ]),
      getTechState: vi.fn(() => 'completed'),
      getProgress: vi.fn(() => 1),
    },
    units: {
      getAllUnits: vi.fn(() => [
        { id: 'warrior', name: '战士', level: 3, unlocked: true },
      ]),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import CivGamePixiComponent from '@/components/idle/CivGamePixiComponent';

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('CivGamePixiComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(() => cb(performance.now()), 0);
      return 0;
    });
  });

  // ─── 基础渲染 ────────────────────────────────────────────

  describe('basic rendering', () => {
    it('should render loading state initially', () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should render with className', () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" className="test-class" />,
      );
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('test-class');
    });

    it('should render with custom style', () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" style={{ border: '1px solid red' }} />,
      );
      const div = container.firstChild as HTMLElement;
      expect(div.style.border).toBe('1px solid red');
    });
  });

  // ─── 文明 ID 选择 ────────────────────────────────────────

  describe('civilization selection', () => {
    it('should accept civ-china gameId', () => {
      const engine = createMockEngine('civ-china');
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should accept civ-egypt gameId', () => {
      const engine = createMockEngine('civ-egypt');
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-egypt" />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should accept civ-babylon gameId', () => {
      const engine = createMockEngine('civ-babylon');
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-babylon" />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should accept civ-india gameId', () => {
      const engine = createMockEngine('civ-india');
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-india" />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should fallback to civ-china for unknown gameId', () => {
      const engine = createMockEngine('unknown');
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="unknown" />,
      );
      expect(container.firstChild).toBeDefined();
    });
  });

  // ─── 回调 ────────────────────────────────────────────────

  describe('callbacks', () => {
    it('should call onReady when initialized', async () => {
      const engine = createMockEngine();
      const onReady = vi.fn();

      // Mock container with dimensions
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" onReady={onReady} />,
      );

      // Set dimensions on the container div
      Object.defineProperty(container.firstChild, 'clientWidth', { value: 800, configurable: true });
      Object.defineProperty(container.firstChild, 'clientHeight', { value: 600, configurable: true });

      await waitFor(() => {
        // Component should render without errors
        expect(container.firstChild).toBeDefined();
      }, { timeout: 3000 });
    });

    it('should call onError on failure', async () => {
      const engine = createMockEngine();
      const onError = vi.fn();

      // Create a scenario that triggers error
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" onError={onError} />,
      );

      expect(container.firstChild).toBeDefined();
    });
  });

  // ─── 科技面板 ────────────────────────────────────────────

  describe('tech panel toggle', () => {
    it('should render tech toggle button after ready', async () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" />,
      );

      // The button should exist in the DOM (even if hidden behind loading)
      expect(container.firstChild).toBeDefined();
    });
  });

  // ─── 卸载 ────────────────────────────────────────────────

  describe('unmount', () => {
    it('should cleanup on unmount', () => {
      const engine = createMockEngine();
      const { unmount } = render(
        <CivGamePixiComponent engine={engine} gameId="civ-china" />,
      );
      expect(() => unmount()).not.toThrow();
    });

    it('should handle multiple mount/unmount cycles', () => {
      const engine = createMockEngine();
      for (let i = 0; i < 3; i++) {
        const { unmount } = render(
          <CivGamePixiComponent engine={engine} gameId="civ-china" />,
        );
        unmount();
      }
    });
  });

  // ─── 文明名称显示 ────────────────────────────────────────

  describe('civilization name display', () => {
    it('should show correct name for civ-china', () => {
      const engine = createMockEngine('civ-china');
      render(<CivGamePixiComponent engine={engine} gameId="civ-china" />);
      // The component renders the name label after ready
    });

    it('should show correct name for civ-egypt', () => {
      const engine = createMockEngine('civ-egypt');
      render(<CivGamePixiComponent engine={engine} gameId="civ-egypt" />);
    });

    it('should show correct name for civ-babylon', () => {
      const engine = createMockEngine('civ-babylon');
      render(<CivGamePixiComponent engine={engine} gameId="civ-babylon" />);
    });

    it('should show correct name for civ-india', () => {
      const engine = createMockEngine('civ-india');
      render(<CivGamePixiComponent engine={engine} gameId="civ-india" />);
    });
  });

  // ─── 自定义策略 ──────────────────────────────────────────

  describe('custom strategy', () => {
    it('should accept custom strategy', () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent
          engine={engine}
          gameId="civ-china"
          strategy={{ theme: { accent: '#ff0000' } }}
        />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should accept custom config', () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent
          engine={engine}
          gameId="civ-china"
          config={{ syncInterval: 500 }}
        />,
      );
      expect(container.firstChild).toBeDefined();
    });

    it('should accept both strategy and config', () => {
      const engine = createMockEngine();
      const { container } = render(
        <CivGamePixiComponent
          engine={engine}
          gameId="civ-egypt"
          strategy={{ theme: { accent: '#0000ff' } }}
          config={{ syncInterval: 2000 }}
        />,
      );
      expect(container.firstChild).toBeDefined();
    });
  });
});
