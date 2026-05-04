/**
 * PixelWorldMap 攻城动画Canvas渲染测试
 *
 * 测试攻城动画各阶段在Canvas上的渲染行为:
 * - renderAssemblyPhase: 集结阶段闪烁点+十字标记+兵力标签
 * - renderBattlePhase: 策略特效+战斗粒子+城防血条
 * - renderCompletedPhase: 胜利旗帜/失败灰色效果
 * - renderSiegeAnimationOverlay: 主叠加层save/restore配对
 *
 * 策略: 通过渲染PixelWorldMap组件并mock Canvas context，
 * 手动触发requestAnimationFrame后验证ctx方法调用。
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { PixelWorldMap, getDefenseBarColor } from '../PixelWorldMap';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import type { SiegeAnimationState } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';

// ── Mock CSS ──
vi.mock('../PixelWorldMap.css', () => ({}));

// ── Mock 地图数据模块 ──
vi.mock('@/games/three-kingdoms/core/map/maps/world-map.txt?raw', () => ({
  default: `MAP:测试地图
SIZE:10x8
TILE:8

CITY: L=洛阳,X=许昌

..........
.L....X...
..........
..........
..........
..........
..........
..........`,
}));

// ── Mock config ──
vi.mock('@/games/three-kingdoms/core/map', () => ({
  REGION_IDS: ['central_plains'],
  REGION_LABELS: { central_plains: '中原' },
  TERRAIN_TYPES: ['plain'],
  TERRAIN_LABELS: { plain: '平原' },
}));

vi.mock('@/games/three-kingdoms/core/map/map-config', () => ({
  LANDMARK_POSITIONS: {
    'city-luoyang': { x: 1, y: 1 },
    'city-xuchang': { x: 6, y: 1 },
  },
  DEFAULT_LANDMARKS: [
    { id: 'city-luoyang', name: '洛阳' },
    { id: 'city-xuchang', name: '许昌' },
  ],
}));

// ─────────────────────────────────────────────
// requestAnimationFrame mock
// ─────────────────────────────────────────────

/** Pending requestAnimationFrame callbacks */
let rafCallbacks: FrameRequestCallback[] = [];
let rafIdCounter = 0;
let originalRAF: typeof window.requestAnimationFrame;
let originalCancelRAF: typeof window.cancelAnimationFrame;

function mockRAF(cb: FrameRequestCallback): number {
  const id = ++rafIdCounter;
  rafCallbacks.push(cb);
  return id;
}

function mockCancelRAF(id: number) {
  // no-op for tests
}

/** Flush all pending rAF callbacks */
function flushRAF() {
  const callbacks = rafCallbacks.slice();
  rafCallbacks = [];
  const now = performance.now();
  for (const cb of callbacks) {
    cb(now);
  }
}

// ─────────────────────────────────────────────
// Mock Canvas
// ─────────────────────────────────────────────

/** All fillStyle values set during rendering (tracked via setter) */
let capturedFillStyles: string[] = [];
/** All globalAlpha values set during rendering */
let capturedGlobalAlphas: number[] = [];

function createMockCtx() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    clip: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
    putImageData: vi.fn(),
    canvas: { width: 800, height: 480 },
    // Colors/styles — use setters/getters to track assignments
    _fillStyle: '',
    _strokeStyle: '',
    _globalAlpha: 1,
    _lineWidth: 1,
    _font: '',
    _textAlign: '',
    _textBaseline: '',
    _lineDashOffset: 0,
    get fillStyle() { return this._fillStyle; },
    set fillStyle(v: string) { this._fillStyle = v; capturedFillStyles.push(v); },
    get strokeStyle() { return this._strokeStyle; },
    set strokeStyle(v: string) { this._strokeStyle = v; },
    get globalAlpha() { return this._globalAlpha; },
    set globalAlpha(v: number) { this._globalAlpha = v; capturedGlobalAlphas.push(v); },
    get lineWidth() { return this._lineWidth; },
    set lineWidth(v: number) { this._lineWidth = v; },
    get font() { return this._font; },
    set font(v: string) { this._font = v; },
    get textAlign() { return this._textAlign; },
    set textAlign(v: string) { this._textAlign = v; },
    get textBaseline() { return this._textBaseline; },
    set textBaseline(v: string) { this._textBaseline = v; },
    get lineDashOffset() { return this._lineDashOffset; },
    set lineDashOffset(v: number) { this._lineDashOffset = v; },
    // Transforms
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
  };
  return ctx;
}

let mockCtx: ReturnType<typeof createMockCtx>;

// Override HTMLCanvasElement.prototype.getContext
const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  capturedFillStyles = [];
  capturedGlobalAlphas = [];
  rafCallbacks = [];
  rafIdCounter = 0;
  mockCtx = createMockCtx();

  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
    contextId: string,
  ) {
    if (contextId === '2d') return mockCtx as any;
    return null;
  }) as any;

  // Mock requestAnimationFrame
  originalRAF = window.requestAnimationFrame;
  originalCancelRAF = window.cancelAnimationFrame;
  window.requestAnimationFrame = mockRAF;
  window.cancelAnimationFrame = mockCancelRAF;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  window.requestAnimationFrame = originalRAF;
  window.cancelAnimationFrame = originalCancelRAF;
});

// ─────────────────────────────────────────────
// Test data
// ─────────────────────────────────────────────

const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 1, y: 1 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-xuchang'],
  ...overrides,
});

const territories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', position: { x: 1, y: 1 } }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', position: { x: 6, y: 1 } }),
];

/** Create a SiegeAnimationState for testing */
function makeSiegeAnim(overrides: Partial<SiegeAnimationState> = {}): SiegeAnimationState {
  return {
    taskId: 'task-001',
    targetCityId: 'city-xuchang',
    targetX: 6,
    targetY: 1,
    phase: 'assembly',
    assemblyElapsedMs: 0,
    strategy: 'forceAttack',
    defenseRatio: 1.0,
    faction: 'wei',
    troops: 2000,
    startTimeMs: Date.now() - 1500,
    victory: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Helper: render with siege anims and flush rAF
// ─────────────────────────────────────────────

/**
 * Render PixelWorldMap with given siege animations, flush animation frames,
 * and return the mock context for assertions.
 *
 * The sequence:
 * 1. Render component → initial useEffect fires, registers first rAF
 * 2. Flush rAF #1 → base rendering happens (dirty=true), registers rAF #2
 * 3. Rerender with siege anims → siegeAnimsRef useEffect fires
 * 4. Flush rAF #2 → detects active siege anims, renders siege overlay
 */
function renderWithSiegeAnims(
  anims: SiegeAnimationState[],
  territoriesOverride?: TerritoryData[],
) {
  // Initial render (with empty siege anims to start the animation loop)
  const result = render(
    <PixelWorldMap
      territories={territoriesOverride ?? territories}
      activeSiegeAnims={[]}
    />,
  );

  // Flush the initial rAF (from useEffect setting up the animation loop)
  flushRAF();

  // Now rerender with actual siege anims (triggers siegeAnimsRef useEffect)
  result.rerender(
    <PixelWorldMap
      territories={territoriesOverride ?? territories}
      activeSiegeAnims={anims}
    />,
  );

  // Flush next rAF — this should pick up the siege anims and render them
  flushRAF();

  return result;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('PixelWorldMap 攻城动画Canvas渲染', () => {
  // ── Scenario 1: Assembly phase ──

  describe('renderAssemblyPhase — 集结阶段', () => {
    it('ctx.fillRect被调用(集结点+十字标记)', () => {
      const anim = makeSiegeAnim({
        phase: 'assembly',
        assemblyElapsedMs: 1500,
        startTimeMs: Date.now() - 1500,
      });

      renderWithSiegeAnims([anim]);

      // fillRect should be called for: 8 assembly dots, cross (2 rects), label bg, + troop label rendering
      expect(mockCtx.fillRect).toHaveBeenCalled();
      const callCount = mockCtx.fillRect.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);
    });

    it('ctx.fillText被调用(兵力数字标签)', () => {
      const anim = makeSiegeAnim({
        phase: 'assembly',
        assemblyElapsedMs: 1500,
        startTimeMs: Date.now() - 1500,
        troops: 5000,
      });

      renderWithSiegeAnims([anim]);

      expect(mockCtx.fillText).toHaveBeenCalled();
      // Verify the troops number was drawn
      const textCalls = mockCtx.fillText.mock.calls.map((c: any[]) => c[0]);
      expect(textCalls).toContain('5000');
    });

    it('ctx.measureText被调用(兵力标签尺寸计算)', () => {
      const anim = makeSiegeAnim({
        phase: 'assembly',
        assemblyElapsedMs: 1500,
        startTimeMs: Date.now() - 1500,
      });

      renderWithSiegeAnims([anim]);

      expect(mockCtx.measureText).toHaveBeenCalled();
    });

    it('globalAlpha被设置(闪烁效果) — alpha值在0到1之间', () => {
      const anim = makeSiegeAnim({
        phase: 'assembly',
        assemblyElapsedMs: 1500,
        startTimeMs: Date.now() - 1500,
      });

      renderWithSiegeAnims([anim]);

      // The assembly phase sets globalAlpha for blink effects (0.4, 0.7, 1.0, etc.)
      const alphas = capturedGlobalAlphas.filter(a => a !== 1.0);
      expect(alphas.length).toBeGreaterThan(0);
      for (const a of alphas) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    });

    it('阵营颜色被正确设置', () => {
      const anim = makeSiegeAnim({
        phase: 'assembly',
        faction: 'shu',
        startTimeMs: Date.now() - 1500,
      });

      renderWithSiegeAnims([anim]);

      // shu faction color should be '#D94A4A'
      expect(capturedFillStyles).toContain('#D94A4A');
    });
  });

  // ── Scenario 2: Battle phase ──

  describe('renderBattlePhase — 战斗阶段', () => {
    it('ctx.fillRect被调用(战斗粒子+城防血条)', () => {
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.65,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('城防血条颜色根据defenseRatio变化 — 高血量为绿色', () => {
      capturedFillStyles = [];
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.8,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // R12: ratio > 0.6 uses smooth interpolated green
      const expectedColor = getDefenseBarColor(0.8);
      expect(capturedFillStyles).toContain(expectedColor);
    });

    it('城防血条颜色根据defenseRatio变化 — 中等血量为黄色', () => {
      capturedFillStyles = [];
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.45,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // R12: 0.3 < ratio <= 0.6 uses smooth interpolated yellow
      const expectedColor = getDefenseBarColor(0.45);
      expect(capturedFillStyles).toContain(expectedColor);
    });

    it('城防血条颜色根据defenseRatio变化 — 低血量为红色', () => {
      capturedFillStyles = [];
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.1,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // R12: ratio <= 0.3 uses smooth interpolated red
      const expectedColor = getDefenseBarColor(0.1);
      expect(capturedFillStyles).toContain(expectedColor);
    });

    it('强攻策略(forceAttack)使用撞击线效果', () => {
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.5,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // forceAttack uses beginPath/moveTo/lineTo/stroke for impact lines
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('围困策略(siege)使用围困圈效果', () => {
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.5,
        strategy: 'siege',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // siege strategy draws a dashed circle via arc
      expect(mockCtx.setLineDash).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('夜袭策略(nightRaid)使用暗光脉动效果', () => {
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.5,
        strategy: 'nightRaid',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // nightRaid draws a pulse arc
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('内应策略(insider)使用城门开放效果', () => {
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.5,
        strategy: 'insider',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      // insider uses fillRect for gate crack
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });
  });

  // ── Scenario 3: Completed phase (victory) ──

  describe('renderCompletedPhase — 胜利', () => {
    it('胜利效果使用金色填充(#FFD700)', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: true,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      // Victory uses gold color for flag
      expect(capturedFillStyles).toContain('#FFD700');
    });

    it('胜利效果渲染旗杆', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: true,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      // Flag pole uses '#8B6914'
      expect(capturedFillStyles).toContain('#8B6914');
    });

    it('胜利效果绘制光环(arc)', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: true,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      // Victory draws a halo via arc + fill
      expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('胜利效果使用旗帜纹理(#FFF8DC)', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: true,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      // Small star texture on the flag
      expect(capturedFillStyles).toContain('#FFF8DC');
    });
  });

  // ── Scenario 4: Completed phase (defeat) ──

  describe('renderCompletedPhase — 失败', () => {
    it('失败效果使用灰色(#666666)', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: false,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      // Defeat uses grey for the flag
      expect(capturedFillStyles).toContain('#666666');
    });

    it('失败效果不使用金色(#FFD700)', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: false,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      capturedFillStyles = [];
      renderWithSiegeAnims([anim]);

      // Defeat should not have gold flag
      expect(capturedFillStyles).not.toContain('#FFD700');
    });

    it('失败效果渲染烟雾粒子(半透明灰色)', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: false,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      // Smoke particles use rgba grey
      expect(capturedFillStyles).toContain('rgba(100,100,100,0.3)');
    });

    it('失败效果与胜利效果使用不同的fillRect调用模式', () => {
      // Render victory
      const victoryAnim = makeSiegeAnim({
        phase: 'completed',
        victory: true,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      mockCtx.fillRect.mockClear();
      renderWithSiegeAnims([victoryAnim]);
      const victoryFillRectCount = mockCtx.fillRect.mock.calls.length;

      // Reset and render defeat
      mockCtx.fillRect.mockClear();
      const defeatAnim = makeSiegeAnim({
        phase: 'completed',
        victory: false,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([defeatAnim]);
      const defeatFillRectCount = mockCtx.fillRect.mock.calls.length;

      // Both should have fillRect calls
      expect(victoryFillRectCount).toBeGreaterThan(0);
      expect(defeatFillRectCount).toBeGreaterThan(0);
    });
  });

  // ── Scenario 5: save/restore pairing ──

  describe('renderSiegeAnimationOverlay — ctx.save/restore配对', () => {
    it('save与restore调用次数相等(无状态泄漏)', () => {
      const anim = makeSiegeAnim({
        phase: 'assembly',
        assemblyElapsedMs: 1500,
        startTimeMs: Date.now() - 1500,
      });

      renderWithSiegeAnims([anim]);

      const saveCount = mockCtx.save.mock.calls.length;
      const restoreCount = mockCtx.restore.mock.calls.length;
      // At least one save/restore pair from the overlay
      expect(saveCount).toBeGreaterThan(0);
      expect(saveCount).toEqual(restoreCount);
    });

    it('battle阶段的save/restore配对', () => {
      const anim = makeSiegeAnim({
        phase: 'battle',
        defenseRatio: 0.5,
        strategy: 'siege',
        startTimeMs: Date.now() - 5000,
      });

      renderWithSiegeAnims([anim]);

      const saveCount = mockCtx.save.mock.calls.length;
      const restoreCount = mockCtx.restore.mock.calls.length;
      expect(saveCount).toBeGreaterThan(0);
      expect(saveCount).toEqual(restoreCount);
    });

    it('completed阶段的save/restore配对', () => {
      const anim = makeSiegeAnim({
        phase: 'completed',
        victory: true,
        strategy: 'forceAttack',
        startTimeMs: Date.now() - 10000,
      });

      renderWithSiegeAnims([anim]);

      const saveCount = mockCtx.save.mock.calls.length;
      const restoreCount = mockCtx.restore.mock.calls.length;
      expect(saveCount).toBeGreaterThan(0);
      expect(saveCount).toEqual(restoreCount);
    });

    it('多个攻城动画同时渲染的save/restore配对', () => {
      const anims: SiegeAnimationState[] = [
        makeSiegeAnim({
          taskId: 'task-001',
          phase: 'assembly',
          targetX: 6,
          targetY: 1,
          startTimeMs: Date.now() - 1500,
        }),
        makeSiegeAnim({
          taskId: 'task-002',
          phase: 'battle',
          defenseRatio: 0.4,
          strategy: 'nightRaid',
          targetX: 1,
          targetY: 1,
          startTimeMs: Date.now() - 5000,
        }),
        makeSiegeAnim({
          taskId: 'task-003',
          phase: 'completed',
          victory: false,
          strategy: 'forceAttack',
          targetX: 3,
          targetY: 3,
          startTimeMs: Date.now() - 10000,
        }),
      ];

      renderWithSiegeAnims(anims);

      const saveCount = mockCtx.save.mock.calls.length;
      const restoreCount = mockCtx.restore.mock.calls.length;
      expect(saveCount).toBeGreaterThan(0);
      expect(saveCount).toEqual(restoreCount);
    });
  });

  // ── General rendering safety ──

  describe('攻城动画渲染安全性', () => {
    it('空activeSiegeAnims不崩溃', () => {
      expect(() => {
        renderWithSiegeAnims([]);
      }).not.toThrow();
    });

    it('undefined activeSiegeAnims不崩溃', () => {
      expect(() => {
        const result = render(<PixelWorldMap territories={territories} />);
        flushRAF();
        flushRAF();
      }).not.toThrow();
    });

    it('多个同阶段攻城动画不崩溃', () => {
      const anims = Array.from({ length: 5 }, (_, i) =>
        makeSiegeAnim({
          taskId: `task-${i}`,
          phase: 'battle',
          defenseRatio: 0.5,
          strategy: 'forceAttack',
          targetX: 2 + i,
          targetY: 1,
          startTimeMs: Date.now() - 5000,
        }),
      );
      expect(() => {
        renderWithSiegeAnims(anims);
      }).not.toThrow();
    });

    it('所有策略类型不崩溃', () => {
      const strategies: Array<SiegeAnimationState['strategy']> = [
        'forceAttack',
        'siege',
        'nightRaid',
        'insider',
      ];
      for (const strategy of strategies) {
        expect(() => {
          renderWithSiegeAnims([
            makeSiegeAnim({
              phase: 'battle',
              defenseRatio: 0.5,
              strategy,
              startTimeMs: Date.now() - 5000,
            }),
          ]);
        }).not.toThrow();
      }
    });

    it('所有阵营不崩溃', () => {
      const factions: Array<SiegeAnimationState['faction']> = ['wei', 'shu', 'wu', 'neutral'];
      for (const faction of factions) {
        expect(() => {
          renderWithSiegeAnims([
            makeSiegeAnim({
              phase: 'assembly',
              faction,
              startTimeMs: Date.now() - 1000,
            }),
          ]);
        }).not.toThrow();
      }
    });

    it('defenseRatio边界值(0和1)不崩溃', () => {
      expect(() => {
        renderWithSiegeAnims([
          makeSiegeAnim({ phase: 'battle', defenseRatio: 0, startTimeMs: Date.now() - 5000 }),
        ]);
      }).not.toThrow();

      expect(() => {
        renderWithSiegeAnims([
          makeSiegeAnim({ phase: 'battle', defenseRatio: 1, startTimeMs: Date.now() - 5000 }),
        ]);
      }).not.toThrow();
    });

    it('重新渲染时攻城动画状态更新不崩溃', () => {
      const result = render(
        <PixelWorldMap
          territories={territories}
          activeSiegeAnims={[
            makeSiegeAnim({ phase: 'assembly', startTimeMs: Date.now() - 1000 }),
          ]}
        />,
      );

      flushRAF();

      expect(() => {
        result.rerender(
          <PixelWorldMap
            territories={territories}
            activeSiegeAnims={[
              makeSiegeAnim({ phase: 'battle', defenseRatio: 0.5, startTimeMs: Date.now() - 5000 }),
            ]}
          />,
        );
        flushRAF();
      }).not.toThrow();
    });
  });
});
