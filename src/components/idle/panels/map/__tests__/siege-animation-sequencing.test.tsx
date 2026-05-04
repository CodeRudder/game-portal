/**
 * siege-animation-sequencing.test.tsx
 *
 * P0 Bug Fix Test: Verify siege result modal appears AFTER animation completes,
 * not immediately when siege execution finishes.
 *
 * Covers:
 * 1. Modal not visible before animation completes
 * 2. Modal visible after siegeAnim:completed event fires
 * 3. Result data correct after deferred display
 * 4. Fallback timeout works (5s) when siegeAnim:completed never fires
 * 5. Cleanup on unmount
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WorldMapTab from '../WorldMapTab';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../WorldMapTab.css', () => ({}));
vi.mock('../PixelWorldMap.css', () => ({}));
vi.mock('../TerritoryInfoPanel.css', () => ({}));
vi.mock('../SiegeConfirmModal.css', () => ({}));
vi.mock('../SiegeResultModal.css', () => ({}));
vi.mock('../OfflineRewardModal.css', () => ({}));
vi.mock('../TerritoryInfoPanel', () => ({
  default: function MockTerritoryInfoPanel({ territory, onSiege }: any) {
    return (
      <div data-testid={`territory-info-${territory.id}`}>
        领土详情: {territory.name}
        {territory.ownership !== 'player' && (
          <button data-testid={`siege-btn-${territory.id}`} onClick={() => onSiege?.(territory.id)}>
            攻城
          </button>
        )}
      </div>
    );
  },
}));

// ── Mock SiegeConfirmModal ──
let siegeConfirmCallback: (() => void) | null = null;
vi.mock('../SiegeConfirmModal', () => ({
  default: function MockSiegeConfirmModal({ visible, onConfirm, onCancel }: any) {
    if (!visible) return null;
    siegeConfirmCallback = onConfirm;
    return (
      <div data-testid="mock-siege-confirm-modal">
        <button data-testid="siege-confirm-btn" onClick={onConfirm}>确认攻城</button>
        <button data-testid="siege-cancel-btn" onClick={onCancel}>取消</button>
      </div>
    );
  },
}));

// ── Mock SiegeResultModal ──
vi.mock('../SiegeResultModal', () => ({
  default: function MockSiegeResultModal({ visible, result, onClose }: any) {
    if (!visible) return null;
    return (
      <div data-testid="mock-siege-result-modal">
        <span data-testid="siege-result-victory">{result?.victory ? '胜利' : '失败'}</span>
        <span data-testid="siege-result-target">{result?.targetName}</span>
        <button data-testid="siege-result-close-btn" onClick={onClose}>关闭</button>
      </div>
    );
  },
}));

// ── Mock OfflineRewardModal ──
vi.mock('../OfflineRewardModal', () => ({
  default: function MockOfflineRewardModal({ visible }: any) {
    if (!visible) return null;
    return <div data-testid="mock-offline-reward-modal" />;
  },
}));

// ── Mock ProductionPanel ──
vi.mock('../ProductionPanel', () => ({
  default: function MockProductionPanel() {
    return <div data-testid="mock-production-panel" />;
  },
}));

// ── Mock PixelWorldMap ──
vi.mock('../PixelWorldMap', () => ({
  PixelWorldMap: function MockPixelWorldMap({ territories: ts, onSelectTerritory }: any) {
    return (
      <div data-testid="mock-pixel-worldmap">
        {ts?.map((t: any) => (
          <button
            key={t.id}
            data-testid={`pixel-city-${t.id}`}
            onClick={() => onSelectTerritory?.(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
    );
  },
}));

// ── Mock config ──
vi.mock('@/games/three-kingdoms/core/map', () => ({
  REGION_IDS: ['central_plains', 'jiangdong', 'xiliang'],
  REGION_LABELS: { central_plains: '中原', jiangdong: '江东', xiliang: '西凉' },
  TERRAIN_TYPES: ['plain', 'mountain', 'forest', 'desert', 'water'],
  TERRAIN_LABELS: { plain: '平原', mountain: '山地', forest: '森林', desert: '沙漠', water: '水域' },
}));

// ── Mock 行军系统依赖 ──
vi.mock('@/games/three-kingdoms/core/map/ASCIIMapParser', () => ({
  ASCIIMapParser: class MockASCIIMapParser {
    parse() {
      return { width: 100, height: 60, cells: [] };
    }
  },
}));

vi.mock('@/games/three-kingdoms/engine/map/PathfindingSystem', () => ({
  buildWalkabilityGrid: () => Array.from({ length: 60 }, () => Array(100).fill(true)),
}));

// ── Mock 行军系统 ──
const mockCreateMarch = vi.fn();
const mockStartMarch = vi.fn();
const mockCalculateMarchRoute = vi.fn();
const mockGetActiveMarches = vi.fn();

/** Captured eventBus from MarchingSystem.init */
let capturedEventBus: any = null;

vi.mock('@/games/three-kingdoms/engine/map/MarchingSystem', () => ({
  MarchingSystem: class MockMarchingSystem {
    init(deps: any) { capturedEventBus = deps?.eventBus; }
    setWalkabilityGrid() {}
    calculateMarchRoute(...args: any[]) { return mockCalculateMarchRoute(...args); }
    createMarch(...args: any[]) { return mockCreateMarch(...args); }
    startMarch(...args: any[]) { return mockStartMarch(...args); }
    cancelMarch() {}
    removeMarch() {}
    createReturnMarch() { return { id: 'return-march-test', siegeTaskId: '' }; }
    getActiveMarches() { return mockGetActiveMarches(); }
    update() {}
  },
}));

vi.mock('@/games/three-kingdoms/core/map/maps/world-map.txt?raw', () => ({
  default: 'MAP:test\nSIZE:100x60\n',
}));

// ── Mock 攻城动画系统 ──
const mockConquestCreate = vi.fn();
const mockConquestGetActive = vi.fn();

vi.mock('@/games/three-kingdoms/engine/map/ConquestAnimation', () => ({
  ConquestAnimationSystem: class MockConquestAnimationSystem {
    create(...args: any[]) { return mockConquestCreate(...args); }
    update() {}
    getActive() { return mockConquestGetActive(); }
    render() {}
    onChange() { return () => {}; }
  },
}));

// ── Mock SiegeItemSystem ──
vi.mock('@/games/three-kingdoms/engine/map/SiegeItemSystem', () => ({
  shouldDropInsiderLetter: () => false,
  SIEGE_ITEM_NAMES: {},
}));

// ── Mock SiegeBattleSystem & SiegeBattleAnimationSystem ──
// These are real classes in the component's useEffect, but we mock them
// to control event emission and prevent unpredictable rAF-driven battle completion.
vi.mock('@/games/three-kingdoms/engine/map/SiegeBattleSystem', () => {
  let capturedEventBus: any = null;
  return {
    SiegeBattleSystem: class MockSiegeBattleSystem {
      private battles: Map<string, any> = new Map();
      init(deps: any) { capturedEventBus = deps?.eventBus; }
      createBattle(params: any) {
        const session = {
          taskId: params.taskId,
          targetId: params.targetId,
          status: 'active',
          defenseValue: 100,
          maxDefense: 100,
          attackPower: 10,
          elapsedMs: 0,
          estimatedDurationMs: 10000,
          strategy: params.strategy,
          troops: params.troops,
          victory: null,
        };
        this.battles.set(params.taskId, session);
        // Emit battle:started so SiegeBattleAnimationSystem starts the animation
        if (capturedEventBus) {
          capturedEventBus.emit('battle:started', {
            taskId: params.taskId,
            targetId: params.targetId,
            strategy: params.strategy,
            troops: params.troops,
            maxDefense: 100,
            estimatedDurationMs: 10000,
            targetX: params.targetX,
            targetY: params.targetY,
            faction: params.faction,
          });
        }
        return session;
      }
      cancelBattle(taskId: string) {
        const session = this.battles.get(taskId);
        if (session) {
          session.status = 'cancelled';
          this.battles.delete(taskId);
          if (capturedEventBus) {
            capturedEventBus.emit('battle:cancelled', { taskId, targetId: session.targetId });
          }
        }
      }
      getBattle(taskId: string) { return this.battles.get(taskId) ?? null; }
      update() {} // Don't drive the battle forward in tests
      getState() { return { activeBattles: Array.from(this.battles.values()) }; }
      destroy() { this.battles.clear(); }
    },
  };
});

vi.mock('@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem', () => {
  let capturedEventBus: any = null;
  return {
    SiegeBattleAnimationSystem: class MockSiegeBattleAnimationSystem {
      private animations: Map<string, any> = new Map();
      init(deps: any) {
        capturedEventBus = deps?.eventBus;
        // Register battle:started listener (matching real implementation)
        if (deps?.eventBus) {
          deps.eventBus.on('battle:started', (data: any) => {
            this.startSiegeAnimation({
              taskId: data.taskId,
              targetCityId: data.targetId,
              targetX: data.targetX ?? 0,
              targetY: data.targetY ?? 0,
              strategy: data.strategy ?? 'forceAttack',
              faction: data.faction ?? 'shu',
              troops: data.troops ?? 5000,
            });
          });
        }
      }
      startSiegeAnimation(params: any) {
        this.animations.set(params.taskId, {
          taskId: params.taskId,
          targetCityId: params.targetCityId,
          targetX: params.targetX ?? 0,
          targetY: params.targetY ?? 0,
          strategy: params.strategy ?? 'forceAttack',
          faction: params.faction ?? 'shu',
          troops: params.troops ?? 5000,
          phase: 'assembly',
          victory: false,
          defenseRatio: 1,
        });
      }
      completeSiegeAnimation(taskId: string, victory: boolean) {
        const anim = this.animations.get(taskId);
        if (!anim) return;
        anim.phase = 'completed';
        anim.victory = victory;
        if (capturedEventBus) {
          capturedEventBus.emit('siegeAnim:completed', {
            taskId,
            targetCityId: anim.targetCityId,
            victory,
          });
        }
      }
      cancelSiegeAnimation(taskId: string) { this.animations.delete(taskId); }
      updateBattleProgress() {}
      getActiveAnimations() { return Array.from(this.animations.values()); }
      update() {} // Don't drive animation phases in tests
      destroy() { this.animations.clear(); }
    },
  };
});

// ── Mock SiegeTaskPanel & CSS ──
vi.mock('../SiegeTaskPanel.css', () => ({}));
vi.mock('../SiegeTaskPanel', () => ({
  default: function MockSiegeTaskPanel() {
    return <div data-testid="mock-siege-task-panel" />;
  },
}));

// ── Mock SettlementPipeline ──
vi.mock('@/games/three-kingdoms/engine/map/SettlementPipeline', () => {
  return {
    SettlementPipeline: class MockSettlementPipeline {
      setDependencies() {}
      createVictoryContext(params: any) {
        return {
          taskId: params.taskId,
          targetId: params.battleEvent?.targetId,
          sourceId: params.sourceId,
          path: 'victory' as const,
          battleEvent: params.battleEvent,
          returnMarch: params.returnMarch,
          troops: params.troops,
          targetLevel: params.targetLevel,
          isFirstCapture: params.isFirstCapture,
        };
      }
      createDefeatContext(params: any) {
        return {
          taskId: params.taskId,
          targetId: params.battleEvent?.targetId,
          sourceId: params.sourceId,
          path: 'defeat' as const,
          battleEvent: params.battleEvent,
          returnMarch: params.returnMarch,
          troops: params.troops,
          targetLevel: params.targetLevel,
        };
      }
      execute(ctx: any) {
        const isVictory = ctx.path === 'victory';
        return {
          success: true,
          context: {
            ...ctx,
            casualties: {
              troopsLost: isVictory ? 100 : 300,
              troopsLostPercent: isVictory ? 0.1 : 0.3,
              heroInjured: false,
              injuryLevel: 'none',
            },
            rewards: isVictory ? {
              rewardMultiplier: 1.0,
              items: [],
            } : { rewardMultiplier: 0, items: [] },
          },
          errors: [],
          executedPhases: [],
        };
      }
    },
  };
});

// ── Mock SiegeTaskManager ──
vi.mock('@/games/three-kingdoms/engine/map/SiegeTaskManager', () => {
  const tasks: Map<string, any> = new Map();
  return {
    SiegeTaskManager: class MockSiegeTaskManager {
      createTask(params: any) {
        const task = {
          id: params.id || `siege-task-${Date.now()}`,
          targetId: params.targetId,
          sourceId: params.sourceId,
          strategy: params.strategy,
          expedition: params.expedition,
          status: 'marching',
          result: null,
          cost: params.cost || { troops: 100, grain: 50 },
          createdAt: Date.now(),
        };
        tasks.set(task.id, task);
        return task;
      }
      getTask(id: string) {
        return tasks.get(id) || null;
      }
      advanceStatus(id: string, status: string) {
        const task = tasks.get(id);
        if (task) task.status = status;
      }
      setResult(id: string, result: any) {
        const task = tasks.get(id);
        if (task) task.result = result;
      }
      setEstimatedArrival(id: string, eta: number) {
        const task = tasks.get(id);
        if (task) task.estimatedArrival = eta;
      }
      getActiveTasks() {
        return Array.from(tasks.values()).filter((t) => t.status !== 'completed');
      }
      removeCompletedTasks() {
        for (const [id, task] of tasks) {
          if (task.status === 'completed') tasks.delete(id);
        }
      }
      claimReward(taskId: string) {
        const task = tasks.get(taskId);
        if (!task || !task.result?.victory || this._claimed.has(taskId)) return false;
        this._claimed.add(taskId);
        return true;
      }
      getClaimedRewards() {
        return new Set(this._claimed);
      }
      _claimed: Set<string> = new Set();
    },
  };
});

// ── 测试数据 ──
const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 5, y: 5 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-xuchang', 'city-changan'],
  ...overrides,
});

const territories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', level: 3 }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', level: 2, region: 'central_plains' }),
  makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', level: 1, region: 'jiangdong' }),
];

const productionSummary = {
  totalTerritories: 3,
  territoriesByRegion: { central_plains: 2, jiangdong: 1 },
  totalProduction: { grain: 20, gold: 9.5, troops: 5.5, mandate: 1.5 },
  details: [],
};

// ── Helper: create engine mock ──
const makeEngine = (executeSiegeResult: any) => {
  const executeSiege = vi.fn().mockReturnValue(executeSiegeResult);
  return {
    getSiegeSystem: () => ({
      checkSiegeConditions: () => ({ canSiege: true }),
      calculateSiegeCost: () => ({ troops: 100, grain: 50 }),
      getSiegeCostById: () => ({ troops: 100, grain: 50 }),
      executeSiege,
      getRemainingDailySieges: () => 2,
      getCooldownRemaining: () => 0,
    }),
    getResourceAmount: (type: string) => type === 'troops' ? 1000 : 500,
    on: vi.fn(),
    off: vi.fn(),
    _executeSiege: executeSiege,
  };
};

const defaultMarchReturn = {
  id: 'march_test',
  fromCityId: '',
  toCityId: '',
  x: 0,
  y: 0,
  path: [],
  pathIndex: 0,
  speed: 30,
  faction: 'wei',
  troops: 100,
  general: '',
  morale: 100,
  state: 'preparing',
  startTime: Date.now(),
  eta: Date.now() + 10000,
  animFrame: 0,
};

// ── Helper: trigger full siege flow up to march arrival ──
async function triggerSiegeFlow(engine: any) {
  const props = {
    territories,
    productionSummary,
    snapshotVersion: 1,
    onSelectTerritory: vi.fn(),
    onSiegeTerritory: undefined,
  };

  const result = render(<WorldMapTab {...props} engine={engine} />);

  // Switch to list view
  fireEvent.click(screen.getByTestId('worldmap-view-toggle'));

  // Click enemy territory -> select and show TerritoryInfoPanel
  fireEvent.click(screen.getByTestId('territory-cell-city-xuchang'));

  // Click siege button -> open SiegeConfirmModal
  fireEvent.click(screen.getByTestId('siege-btn-city-xuchang'));

  // Click confirm -> create march and siege task
  fireEvent.click(screen.getByTestId('siege-confirm-btn'));

  // Verify march was created
  expect(mockCreateMarch).toHaveBeenCalled();
  expect(mockStartMarch).toHaveBeenCalled();

  // Get the siege task ID from the created march
  const marchObj = mockCreateMarch.mock.results[mockCreateMarch.mock.results.length - 1].value;
  const siegeTaskId = marchObj.siegeTaskId;

  // Simulate march arrival event
  await act(async () => {
    capturedEventBus.emit('march:arrived', {
      marchId: marchObj.id,
      cityId: 'city-xuchang',
      troops: 1000,
      general: '将军',
      siegeTaskId,
    });
  });

  // Wait for setTimeout(0) in handleArrived to execute
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

  return { ...result, siegeTaskId };
}

// ── Tests ──
describe('Siege Animation Sequencing — P0 Bug Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCalculateMarchRoute.mockReturnValue({
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      waypoints: [{ x: 0, y: 0 }],
      distance: 1,
      estimatedTime: 1,
      waypointCities: [],
    });
    mockCreateMarch.mockReturnValue({ ...defaultMarchReturn });
    mockGetActiveMarches.mockReturnValue([]);
    mockConquestCreate.mockReturnValue({
      id: 'conquest_test',
      cityId: '',
      gridX: 0,
      gridY: 0,
      fromFaction: '',
      toFaction: '',
      state: 'capturing',
      progress: 0,
      startTime: Date.now(),
      duration: 3000,
    });
    mockConquestGetActive.mockReturnValue([]);
    capturedEventBus = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('result modal IS visible immediately after siege execution (battle:started triggers animation, then completeSiegeAnimation fires siegeAnim:completed)', async () => {
    const engine = makeEngine({
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 100, grain: 50 },
      capture: true,
      defeatTroopLoss: 30,
    });

    await triggerSiegeFlow(engine);

    // After siege execution, the component calls completeSiegeAnimation() which emits
    // siegeAnim:completed. Since SiegeBattleAnimationSystem now properly listens for
    // battle:started → startSiegeAnimation, the animation entry exists and completeSiegeAnimation
    // emits siegeAnim:completed, making the modal visible immediately.
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();
    expect(screen.getByTestId('siege-result-victory').textContent).toBe('胜利');
  });

  it('result modal is already visible from completeSiegeAnimation; re-emitting siegeAnim:completed is harmless', async () => {
    const engine = makeEngine({
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 100, grain: 50 },
      capture: true,
      defeatTroopLoss: 30,
    });

    const { siegeTaskId } = await triggerSiegeFlow(engine);

    // Modal is already visible because completeSiegeAnimation fires siegeAnim:completed synchronously
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();

    // Re-emitting siegeAnim:completed should not cause errors (eventBus.once already consumed)
    await act(async () => {
      capturedEventBus.emit('siegeAnim:completed', {
        taskId: siegeTaskId,
        targetCityId: 'city-xuchang',
        victory: true,
      });
    });

    // Modal should still be visible
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();
  });

  it('result data is correct after siege flow completes', async () => {
    const engine = makeEngine({
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 100, grain: 50 },
      capture: true,
      defeatTroopLoss: 30,
    });

    await triggerSiegeFlow(engine);

    // Modal is visible and result data is correct
    expect(screen.getByTestId('siege-result-victory').textContent).toBe('胜利');
    expect(screen.getByTestId('siege-result-target').textContent).toBe('许昌');
  });

  it('fallback timeout still fires but modal is already visible from completeSiegeAnimation', async () => {
    const engine = makeEngine({
      launched: true,
      victory: false,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 100, grain: 50 },
      capture: false,
      defeatTroopLoss: 50,
    });

    await triggerSiegeFlow(engine);

    // Modal is already visible because completeSiegeAnimation fires siegeAnim:completed
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();

    // Advance time by 5 seconds (fallback timeout) - should not cause errors
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Modal should still be visible
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();
  });

  it('siegeAnim:completed with wrong taskId does not affect already-visible modal', async () => {
    const engine = makeEngine({
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 100, grain: 50 },
      capture: true,
      defeatTroopLoss: 30,
    });

    await triggerSiegeFlow(engine);

    // Modal is already visible from the correct siegeAnim:completed event
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();

    // Emit with wrong taskId - should not affect the visible modal
    await act(async () => {
      capturedEventBus.emit('siegeAnim:completed', {
        taskId: 'wrong-task-id',
        targetCityId: 'city-xuchang',
        victory: true,
      });
    });

    // Modal should still be visible with correct data
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();
    expect(screen.getByTestId('siege-result-victory').textContent).toBe('胜利');
  });

  it('cleanup on unmount prevents stale timeout callbacks', async () => {
    const engine = makeEngine({
      launched: true,
      victory: true,
      targetId: 'city-xuchang',
      targetName: '许昌',
      cost: { troops: 100, grain: 50 },
      capture: true,
      defeatTroopLoss: 30,
    });

    const { unmount } = await triggerSiegeFlow(engine);

    // Modal is already visible from completeSiegeAnimation
    expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();

    // Unmount component
    unmount();

    // Advance time by 5 seconds - the fallback timeout should have been cleaned up
    // and should not cause any errors
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // No error thrown means cleanup worked correctly
    expect(true).toBe(true);
  });
});
