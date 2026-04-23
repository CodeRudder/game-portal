import { vi } from 'vitest';
import { RhythmEngine } from '@/games/rhythm/RhythmEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LANE_COUNT,
  LANE_WIDTH,
  LANE_KEYS,
  LANE_COLORS,
  NOTE_HEIGHT,
  NOTE_WIDTH,
  JUDGE_LINE_Y,
  NOTE_FALL_SPEED,
  JUDGE_PERFECT_MS,
  JUDGE_GREAT_MS,
  JUDGE_GOOD_MS,
  SCORE_PERFECT,
  SCORE_GREAT,
  SCORE_GOOD,
  SCORE_MISS,
  INITIAL_HEALTH,
  MISS_HEALTH_PENALTY,
  GOOD_HEALTH_RECOVER,
  GREAT_HEALTH_RECOVER,
  PERFECT_HEALTH_RECOVER,
  MAX_HEALTH,
  JUDGE_FEEDBACK_DURATION,
  NOTE_TRAVEL_TIME,
  BEATMAPS,
  COMBO_MULTIPLIERS,
  type Beatmap,
  type JudgeResult,
} from '@/games/rhythm/constants';

// ========== Mock Canvas ==========

function createMockCanvas() {
  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    getContext: () => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      fill: vi.fn(),
      strokeRect: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 10 })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      setLineDash: vi.fn(),
      clip: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
    }),
  } as unknown as HTMLCanvasElement;
}

// ========== 辅助函数 ==========

function createEngine(beatmap?: Beatmap): RhythmEngine {
  const engine = new RhythmEngine(beatmap);
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(beatmap?: Beatmap): RhythmEngine {
  const engine = createEngine(beatmap);
  engine.start();
  return engine;
}

/** 创建简单的测试节拍图 */
function createTestBeatmap(notes: { time: number; lane: number }[]): Beatmap {
  return { name: 'Test', bpm: 120, notes };
}

// ========== Mock requestAnimationFrame ==========

beforeAll(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 0) as any;
  globalThis.cancelAnimationFrame = (() => {}) as any;
});

// ============================
// 1. 常量验证
// ============================

describe('Rhythm Constants', () => {
  it('CANVAS_WIDTH should be 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT should be 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('LANE_COUNT should be 4', () => {
    expect(LANE_COUNT).toBe(4);
  });

  it('LANE_WIDTH should be CANVAS_WIDTH / LANE_COUNT = 120', () => {
    expect(LANE_WIDTH).toBe(120);
  });

  it('LANE_KEYS should be d, f, j, k', () => {
    expect(LANE_KEYS).toEqual(['d', 'f', 'j', 'k']);
  });

  it('LANE_COLORS should have 4 colors', () => {
    expect(LANE_COLORS).toHaveLength(4);
  });

  it('JUDGE_LINE_Y should be about 80% of CANVAS_HEIGHT', () => {
    expect(JUDGE_LINE_Y).toBe(512);
    expect(JUDGE_LINE_Y).toBe(Math.floor(CANVAS_HEIGHT * 0.8));
  });

  it('NOTE_FALL_SPEED should be 0.3', () => {
    expect(NOTE_FALL_SPEED).toBe(0.3);
  });

  it('JUDGE_PERFECT_MS should be 50', () => {
    expect(JUDGE_PERFECT_MS).toBe(50);
  });

  it('JUDGE_GREAT_MS should be 100', () => {
    expect(JUDGE_GREAT_MS).toBe(100);
  });

  it('JUDGE_GOOD_MS should be 150', () => {
    expect(JUDGE_GOOD_MS).toBe(150);
  });

  it('SCORE_PERFECT should be 100', () => {
    expect(SCORE_PERFECT).toBe(100);
  });

  it('SCORE_GREAT should be 50', () => {
    expect(SCORE_GREAT).toBe(50);
  });

  it('SCORE_GOOD should be 25', () => {
    expect(SCORE_GOOD).toBe(25);
  });

  it('SCORE_MISS should be 0', () => {
    expect(SCORE_MISS).toBe(0);
  });

  it('INITIAL_HEALTH should be 100', () => {
    expect(INITIAL_HEALTH).toBe(100);
  });

  it('MISS_HEALTH_PENALTY should be 10', () => {
    expect(MISS_HEALTH_PENALTY).toBe(10);
  });

  it('MAX_HEALTH should be 100', () => {
    expect(MAX_HEALTH).toBe(100);
  });

  it('NOTE_TRAVEL_TIME should be JUDGE_LINE_Y / NOTE_FALL_SPEED', () => {
    expect(NOTE_TRAVEL_TIME).toBe(JUDGE_LINE_Y / NOTE_FALL_SPEED);
  });

  it('COMBO_MULTIPLIERS should be sorted by min descending', () => {
    for (let i = 1; i < COMBO_MULTIPLIERS.length; i++) {
      expect(COMBO_MULTIPLIERS[i - 1].min).toBeGreaterThan(COMBO_MULTIPLIERS[i].min);
    }
  });

  it('BEATMAPS should have at least 1 beatmap', () => {
    expect(BEATMAPS.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================
// 2. 引擎初始化
// ============================

describe('RhythmEngine - Initialization', () => {
  let engine: RhythmEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('should initialize with idle status', () => {
    expect(engine.status).toBe('idle');
  });

  it('should initialize with score 0', () => {
    expect(engine.score).toBe(0);
  });

  it('should initialize with combo 0', () => {
    expect(engine.combo).toBe(0);
  });

  it('should initialize with maxCombo 0', () => {
    expect(engine.maxCombo).toBe(0);
  });

  it('should initialize with full health', () => {
    expect(engine.health).toBe(INITIAL_HEALTH);
  });

  it('should initialize with all judge counts at 0', () => {
    const counts = engine.judgeCounts;
    expect(counts.perfect).toBe(0);
    expect(counts.great).toBe(0);
    expect(counts.good).toBe(0);
    expect(counts.miss).toBe(0);
  });

  it('should initialize with no active notes', () => {
    expect(engine.activeNotes).toHaveLength(0);
  });

  it('should initialize as not finished', () => {
    expect(engine.isFinished).toBe(false);
  });

  it('should initialize as not won', () => {
    expect(engine.isWin).toBe(false);
  });

  it('should initialize with gameTime 0', () => {
    expect(engine.gameTime).toBe(0);
  });

  it('should return correct state from getState', () => {
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(0);
    expect(state.health).toBe(INITIAL_HEALTH);
    expect(state.isFinished).toBe(false);
    expect(state.isWin).toBe(false);
  });

  it('should use default beatmap when none provided', () => {
    expect(engine.beatmap).toEqual(BEATMAPS[0]);
  });

  it('should use provided beatmap', () => {
    const custom: Beatmap = { name: 'Custom', bpm: 200, notes: [] };
    const eng = createEngine(custom);
    expect(eng.beatmap.name).toBe('Custom');
  });
});

// ============================
// 3. 游戏启动
// ============================

describe('RhythmEngine - Start', () => {
  it('should start with playing status', () => {
    const engine = startEngine();
    expect(engine.status).toBe('playing');
  });

  it('should reset score to 0 on start', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.score).toBe(0);
  });

  it('should reset combo to 0 on start', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.combo).toBe(0);
  });

  it('should reset health to INITIAL_HEALTH on start', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.health).toBe(INITIAL_HEALTH);
  });

  it('should reset active notes on start', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.activeNotes).toHaveLength(0);
  });

  it('should reset judge counts on start', () => {
    const engine = createEngine();
    engine.start();
    const counts = engine.judgeCounts;
    expect(counts.perfect + counts.great + counts.good + counts.miss).toBe(0);
  });

  it('should reset gameTime to 0 on start', () => {
    const engine = createEngine();
    engine.start();
    expect(engine.gameTime).toBe(0);
  });
});

// ============================
// 4. 音符生成
// ============================

describe('RhythmEngine - Note Spawning', () => {
  it('should spawn notes when gameTime reaches spawn time', () => {
    const beatmap = createTestBeatmap([
      { time: 3000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    // NOTE_TRAVEL_TIME before target time
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(1);
  });

  it('should not spawn notes before their time', () => {
    const beatmap = createTestBeatmap([
      { time: 5000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(1000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(0);
  });

  it('should spawn multiple notes at different times', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 3000, lane: 1 },
      { time: 4000, lane: 2 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(4000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(3);
  });

  it('should spawn notes in correct lanes', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2000, lane: 3 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes[0].lane).toBe(0);
    expect(engine.activeNotes[1].lane).toBe(3);
  });

  it('should spawn notes with correct targetTime', () => {
    const beatmap = createTestBeatmap([
      { time: 3000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes[0].targetTime).toBe(3000);
  });

  it('should spawn notes with judged = false', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes[0].judged).toBe(false);
  });

  it('should spawn notes starting at negative Y', () => {
    const beatmap = createTestBeatmap([
      { time: 3000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    expect(engine.activeNotes[0].y).toBe(-NOTE_HEIGHT);
  });

  it('should not spawn same note twice', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(1);
  });

  it('should handle empty beatmap', () => {
    const beatmap = createTestBeatmap([]);
    const engine = startEngine(beatmap);
    engine._setGameTime(10000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(0);
  });

  it('should spawn simultaneous notes in different lanes', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2000, lane: 1 },
      { time: 2000, lane: 2 },
      { time: 2000, lane: 3 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(4);
  });
});

// ============================
// 5. 音符下落
// ============================

describe('RhythmEngine - Note Falling', () => {
  it('notes should move down over time', () => {
    const beatmap = createTestBeatmap([
      { time: 5000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(5000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    const initialY = engine.activeNotes[0].y;

    engine._setGameTime(5000 - NOTE_TRAVEL_TIME + 1000);
    engine._forceUpdateNotes(1000);
    expect(engine.activeNotes[0].y).toBeGreaterThan(initialY);
  });

  it('notes should reach judge line at target time', () => {
    const beatmap = createTestBeatmap([
      { time: 5000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(5000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();

    // At target time, note should be at judge line
    engine._setGameTime(5000);
    engine._forceUpdateNotes(0);
    expect(Math.abs(engine.activeNotes[0].y - JUDGE_LINE_Y)).toBeLessThan(1);
  });

  it('notes should be above judge line before target time', () => {
    const beatmap = createTestBeatmap([
      { time: 5000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(5000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();

    engine._setGameTime(4500);
    engine._forceUpdateNotes(0);
    expect(engine.activeNotes[0].y).toBeLessThan(JUDGE_LINE_Y);
  });

  it('notes should be below judge line after target time', () => {
    const beatmap = createTestBeatmap([
      { time: 5000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(5000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();

    engine._setGameTime(5500);
    engine._forceUpdateNotes(0);
    expect(engine.activeNotes[0].y).toBeGreaterThan(JUDGE_LINE_Y);
  });

  it('multiple notes should fall independently', () => {
    const beatmap = createTestBeatmap([
      { time: 3000, lane: 0 },
      { time: 5000, lane: 1 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(5000);
    engine._forceSpawnNotes();

    // At time 4000: first note past judge line, second note approaching
    engine._setGameTime(4000);
    engine._forceUpdateNotes(0);
    expect(engine.activeNotes[0].y).toBeGreaterThan(JUDGE_LINE_Y);
    expect(engine.activeNotes[1].y).toBeLessThan(JUDGE_LINE_Y);
  });
});

// ============================
// 6. 4 轨道按键判定
// ============================

describe('RhythmEngine - Lane Key Mapping', () => {
  it('D key should map to lane 0', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].judged).toBe(true);
  });

  it('F key should map to lane 1', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 1 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('f');
    expect(engine.activeNotes[0].judged).toBe(true);
  });

  it('J key should map to lane 2', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 2 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('j');
    expect(engine.activeNotes[0].judged).toBe(true);
  });

  it('K key should map to lane 3', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 3 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('k');
    expect(engine.activeNotes[0].judged).toBe(true);
  });

  it('uppercase keys should also work', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('D');
    expect(engine.activeNotes[0].judged).toBe(true);
  });

  it('wrong key should not judge note in different lane', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('k'); // lane 3 key for lane 0 note
    expect(engine.activeNotes[0].judged).toBe(false);
  });

  it('unrelated key should not affect notes', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('a');
    expect(engine.activeNotes[0].judged).toBe(false);
  });
});

// ============================
// 7. Perfect 判定
// ============================

describe('RhythmEngine - Perfect Judge', () => {
  it('should judge Perfect at exact target time', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('perfect');
  });

  it('should judge Perfect within +50ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3050);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('perfect');
  });

  it('should judge Perfect within -50ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(2950);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('perfect');
  });

  it('should give Perfect score of 100', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(SCORE_PERFECT);
  });

  it('should increment perfect judge count', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.judgeCounts.perfect).toBe(1);
  });

  it('should recover health on Perfect', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    const healthBefore = engine.health;
    engine.handleKeyDown('d');
    expect(engine.health).toBe(Math.min(MAX_HEALTH, healthBefore + PERFECT_HEALTH_RECOVER));
  });
});

// ============================
// 8. Great 判定
// ============================

describe('RhythmEngine - Great Judge', () => {
  it('should judge Great at +75ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3075);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('great');
  });

  it('should judge Great at -75ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(2925);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('great');
  });

  it('should judge Great at boundary +100ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3100);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('great');
  });

  it('should give Great score of 50', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3075);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(SCORE_GREAT);
  });

  it('should increment great judge count', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3075);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.judgeCounts.great).toBe(1);
  });

  it('should recover health on Great', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3075);
    engine._forceUpdateNotes(0);
    const healthBefore = engine.health;
    engine.handleKeyDown('d');
    expect(engine.health).toBe(Math.min(MAX_HEALTH, healthBefore + GREAT_HEALTH_RECOVER));
  });
});

// ============================
// 9. Good 判定
// ============================

describe('RhythmEngine - Good Judge', () => {
  it('should judge Good at +125ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3125);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('good');
  });

  it('should judge Good at -125ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(2875);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('good');
  });

  it('should judge Good at boundary +150ms', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3150);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].result).toBe('good');
  });

  it('should give Good score of 25', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3125);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(SCORE_GOOD);
  });

  it('should increment good judge count', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3125);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.judgeCounts.good).toBe(1);
  });

  it('should recover health on Good', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3125);
    engine._forceUpdateNotes(0);
    const healthBefore = engine.health;
    engine.handleKeyDown('d');
    expect(engine.health).toBe(Math.min(MAX_HEALTH, healthBefore + GOOD_HEALTH_RECOVER));
  });
});

// ============================
// 10. Miss 判定
// ============================

describe('RhythmEngine - Miss Judge', () => {
  it('should miss note when time exceeds GOOD window', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3200); // 200ms past target
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.activeNotes[0].result).toBe('miss');
    expect(engine.activeNotes[0].judged).toBe(true);
  });

  it('should not miss note within GOOD window', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3140); // 140ms past target, still within 150ms
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.activeNotes[0].judged).toBe(false);
  });

  it('should reset combo on miss', () => {
    const beatmap = createTestBeatmap([
      { time: 3000, lane: 0 },
      { time: 4000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    // Hit first note to build combo
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.combo).toBe(1);

    // Let second note miss
    engine._setGameTime(4000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(4200);
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.combo).toBe(0);
  });

  it('should decrement health on miss', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3200);
    engine._forceUpdateNotes(0);
    const healthBefore = engine.health;
    engine._forceCheckMisses();
    expect(engine.health).toBe(healthBefore - MISS_HEALTH_PENALTY);
  });

  it('should increment miss judge count', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3200);
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.judgeCounts.miss).toBe(1);
  });

  it('should not add score on miss', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3200);
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.score).toBe(0);
  });

  it('key press too early (beyond Good window) should not judge', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(2800); // 200ms early, beyond 150ms window
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.activeNotes[0].judged).toBe(false);
  });

  it('key press too late (beyond Good window) should not judge', () => {
    const beatmap = createTestBeatmap([{ time: 3000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(3200);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    // Note not yet auto-missed (manual press), but beyond window
    // The note will be auto-missed by checkMisses
    expect(engine.activeNotes[0].judged).toBe(false);
  });
});

// ============================
// 11. 连击系统
// ============================

describe('RhythmEngine - Combo System', () => {
  it('combo should increment on each hit', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
      { time: 3000, lane: 2 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    expect(engine.combo).toBe(1);

    engine._setGameTime(2500);
    engine.handleKeyDown('f');
    expect(engine.combo).toBe(2);

    engine._setGameTime(3000);
    engine.handleKeyDown('j');
    expect(engine.combo).toBe(3);
  });

  it('combo should reset to 0 on miss', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 3000, lane: 1 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    expect(engine.combo).toBe(1);

    // Miss second note
    engine._setGameTime(3200);
    engine._forceCheckMisses();
    expect(engine.combo).toBe(0);
  });

  it('maxCombo should track highest combo', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 3000, lane: 1 },
      { time: 4000, lane: 2 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(4000);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine._setGameTime(3000);
    engine.handleKeyDown('f');
    expect(engine.maxCombo).toBe(2);

    // Miss the third note
    engine._setGameTime(4200);
    engine._forceCheckMisses();
    expect(engine.maxCombo).toBe(2); // maxCombo stays
    expect(engine.combo).toBe(0);
  });

  it('combo multiplier should be 1x for combo < 10', () => {
    const engine = startEngine();
    expect(engine.getComboMultiplier()).toBe(1);
  });

  it('combo multiplier should be 2x for combo >= 10', () => {
    const engine = startEngine();
    // Simulate 10 combo by manually setting combo
    for (let i = 0; i < 10; i++) {
      const beatmap = createTestBeatmap([{ time: 1000 + i * 100, lane: 0 }]);
    }
    // Use internal state for testing
    (engine as any)._combo = 10;
    expect(engine.getComboMultiplier()).toBe(2);
  });

  it('combo multiplier should be 3x for combo >= 30', () => {
    const engine = startEngine();
    (engine as any)._combo = 30;
    expect(engine.getComboMultiplier()).toBe(3);
  });

  it('combo multiplier should be 4x for combo >= 50', () => {
    const engine = startEngine();
    (engine as any)._combo = 50;
    expect(engine.getComboMultiplier()).toBe(4);
  });

  it('score should be multiplied by combo multiplier', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._combo = 10; // 2x multiplier
    engine._setGameTime(2000 - NOTE_TRAVEL_TIME);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(SCORE_PERFECT * 2);
  });

  it('combo should be tracked in getState', () => {
    const engine = startEngine();
    (engine as any)._combo = 5;
    (engine as any)._maxCombo = 5;
    const state = engine.getState();
    expect(state.combo).toBe(5);
    expect(state.maxCombo).toBe(5);
  });
});

// ============================
// 12. 健康值系统
// ============================

describe('RhythmEngine - Health System', () => {
  it('should start with full health', () => {
    const engine = startEngine();
    expect(engine.health).toBe(INITIAL_HEALTH);
  });

  it('should lose health on miss', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2200);
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.health).toBe(INITIAL_HEALTH - MISS_HEALTH_PENALTY);
  });

  it('should gain health on Perfect', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._health = 80;
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.health).toBe(80 + PERFECT_HEALTH_RECOVER);
  });

  it('should gain health on Great', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._health = 80;
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2075);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.health).toBe(80 + GREAT_HEALTH_RECOVER);
  });

  it('should gain health on Good', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._health = 80;
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2125);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.health).toBe(80 + GOOD_HEALTH_RECOVER);
  });

  it('health should not exceed MAX_HEALTH', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.health).toBeLessThanOrEqual(MAX_HEALTH);
  });

  it('health should not go below 0', () => {
    const beatmap = createTestBeatmap([
      { time: 1000, lane: 0 },
      { time: 2000, lane: 0 },
      { time: 3000, lane: 0 },
      { time: 4000, lane: 0 },
      { time: 5000, lane: 0 },
      { time: 6000, lane: 0 },
      { time: 7000, lane: 0 },
      { time: 8000, lane: 0 },
      { time: 9000, lane: 0 },
      { time: 10000, lane: 0 },
      { time: 11000, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(11000);
    engine._forceSpawnNotes();

    // Miss all notes
    for (let i = 0; i < 11; i++) {
      engine._setGameTime(1000 + i * 1000 + 200);
      engine._forceUpdateNotes(0);
      engine._forceCheckMisses();
    }
    expect(engine.health).toBeGreaterThanOrEqual(0);
  });

  it('should track health in getState', () => {
    const engine = startEngine();
    expect(engine.getState().health).toBe(INITIAL_HEALTH);
  });
});

// ============================
// 13. 分数计算
// ============================

describe('RhythmEngine - Score Calculation', () => {
  it('Perfect without combo should give 100 points', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(100);
  });

  it('Great without combo should give 50 points', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2075);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(50);
  });

  it('Good without combo should give 25 points', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2125);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(25);
  });

  it('Miss should give 0 points', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2200);
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.score).toBe(0);
  });

  it('score should accumulate across multiple notes', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2500);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d'); // Perfect: 100
    engine._setGameTime(2500);
    engine.handleKeyDown('f'); // Perfect: 100
    expect(engine.score).toBe(200);
  });

  it('score should be multiplied by combo multiplier', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._combo = 9; // combo becomes 10 after hit → 2x multiplier
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    // Combo becomes 10 after increment, multiplier is checked after increment → 2x
    expect(engine.score).toBe(200); // 100 * 2x
    expect(engine.combo).toBe(10);
  });

  it('next hit after building combo should use higher multiplier', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
    ]);
    const engine = startEngine(beatmap);
    (engine as any)._combo = 9;
    engine._setGameTime(2500);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d'); // combo becomes 10, 2x → 200
    engine._setGameTime(2500);
    engine.handleKeyDown('f'); // combo becomes 11, 2x → 200
    expect(engine.score).toBe(200 + 200); // 200 + 200
  });
});

// ============================
// 14. Beatmap
// ============================

describe('RhythmEngine - Beatmap', () => {
  it('should use default beatmap (BEATMAPS[0])', () => {
    const engine = startEngine();
    expect(engine.beatmap.name).toBe(BEATMAPS[0].name);
  });

  it('should use custom beatmap', () => {
    const custom: Beatmap = {
      name: 'Custom Test',
      bpm: 200,
      notes: [{ time: 1000, lane: 0 }],
    };
    const engine = startEngine(custom);
    expect(engine.beatmap.name).toBe('Custom Test');
    expect(engine.beatmap.notes).toHaveLength(1);
  });

  it('should process all notes in beatmap', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
      { time: 3000, lane: 2 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000);
    engine._forceSpawnNotes();
    expect(engine.activeNotes).toHaveLength(3);
  });

  it('BEATMAPS should have Easy Beat as first', () => {
    expect(BEATMAPS[0].name).toBe('Easy Beat');
  });

  it('BEATMAPS should have Normal Flow as second', () => {
    expect(BEATMAPS[1].name).toBe('Normal Flow');
  });

  it('BEATMAPS should have Hard Rush as third', () => {
    expect(BEATMAPS[2].name).toBe('Hard Rush');
  });

  it('Easy Beat should have 16 notes', () => {
    expect(BEATMAPS[0].notes).toHaveLength(16);
  });

  it('all beatmap notes should have valid lanes (0-3)', () => {
    for (const bm of BEATMAPS) {
      for (const note of bm.notes) {
        expect(note.lane).toBeGreaterThanOrEqual(0);
        expect(note.lane).toBeLessThan(4);
      }
    }
  });

  it('all beatmap notes should have positive times', () => {
    for (const bm of BEATMAPS) {
      for (const note of bm.notes) {
        expect(note.time).toBeGreaterThan(0);
      }
    }
  });
});

// ============================
// 15. 游戏结束
// ============================

describe('RhythmEngine - Game Over', () => {
  it('should reduce health to 0 with enough misses', () => {
    const notes = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 500,
      lane: i % 4,
    }));
    const beatmap = createTestBeatmap(notes);
    const engine = startEngine(beatmap);
    engine._setGameTime(notes[notes.length - 1].time);
    engine._forceSpawnNotes();

    // Miss all notes
    for (const note of notes) {
      engine._setGameTime(note.time + 200);
      engine._forceUpdateNotes(0);
      engine._forceCheckMisses();
      if (engine.health <= 0) break;
    }

    expect(engine.health).toBe(0);
  });

  it('should trigger gameOver when health reaches 0 via update', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    // Manually set health to 1 and trigger update logic
    (engine as any)._health = 1;
    engine._setGameTime(2200);
    engine._forceSpawnNotes();
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    // Now health should be 0, but gameOver is called from update()
    // Call update to trigger the gameOver check
    (engine as any).update(16);
    expect(engine.isFinished).toBe(true);
    expect(engine.status).toBe('gameover');
  });

  it('should set isWin to false when health reaches 0', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._health = 1;
    engine._setGameTime(2200);
    engine._forceSpawnNotes();
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    (engine as any).update(16);
    expect(engine.isWin).toBe(false);
  });

  it('should finish as win when all notes judged with health > 0', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2500);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine._setGameTime(2500);
    engine.handleKeyDown('f');

    // Check finish condition
    expect(engine.activeNotes.every(n => n.judged)).toBe(true);
    expect(engine.health).toBeGreaterThan(0);
  });

  it('should track isFinished in getState', () => {
    const engine = startEngine();
    expect(engine.getState().isFinished).toBe(false);
  });

  it('should track isWin in getState', () => {
    const engine = startEngine();
    expect(engine.getState().isWin).toBe(false);
  });
});

// ============================
// 16. 键盘控制
// ============================

describe('RhythmEngine - Keyboard Controls', () => {
  it('space key should start idle game', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('space key should restart finished game', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._isFinished = true;
    (engine as any)._status = 'gameover';
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.isFinished).toBe(false);
  });

  it('should track pressed keys', () => {
    const engine = startEngine();
    engine.handleKeyDown('d');
    expect(engine._isKeyPressed('d')).toBe(true);
  });

  it('should release keys on keyUp', () => {
    const engine = startEngine();
    engine.handleKeyDown('d');
    engine.handleKeyUp('d');
    expect(engine._isKeyPressed('d')).toBe(false);
  });

  it('should not double-trigger on held key', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2050, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2050);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    expect(engine.combo).toBe(1);

    // Hold d, press again - should not trigger
    engine._setGameTime(2050);
    engine.handleKeyDown('d');
    expect(engine.combo).toBe(1); // Still 1, d is still held
  });

  it('should allow re-press after release', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2050, lane: 0 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2050);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine.handleKeyUp('d');
    engine._setGameTime(2050);
    engine.handleKeyDown('d');
    expect(engine.combo).toBe(2);
  });

  it('should ignore keys when not playing', () => {
    const engine = createEngine();
    engine.handleKeyDown('d');
    expect(engine.score).toBe(0);
    expect(engine.combo).toBe(0);
  });

  it('should ignore keys when game is finished', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    (engine as any)._isFinished = true;
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.score).toBe(0);
  });
});

// ============================
// 17. 判定反馈
// ============================

describe('RhythmEngine - Judge Feedback', () => {
  it('should create feedback on hit', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.feedbacks).toHaveLength(1);
  });

  it('should create feedback on miss', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2200);
    engine._forceUpdateNotes(0);
    engine._forceCheckMisses();
    expect(engine.feedbacks).toHaveLength(1);
    expect(engine.feedbacks[0].result).toBe('miss');
  });

  it('feedback should have correct lane', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 2 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('j');
    expect(engine.feedbacks[0].lane).toBe(2);
  });

  it('feedback should have timestamp', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    expect(engine.feedbacks[0].timestamp).toBe(2000);
  });
});

// ============================
// 18. 重置
// ============================

describe('RhythmEngine - Reset', () => {
  it('should reset all state on reset()', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');

    engine.reset();

    expect(engine.score).toBe(0);
    expect(engine.combo).toBe(0);
    expect(engine.maxCombo).toBe(0);
    expect(engine.health).toBe(INITIAL_HEALTH);
    expect(engine.activeNotes).toHaveLength(0);
    expect(engine.isFinished).toBe(false);
    expect(engine.isWin).toBe(false);
    expect(engine.status).toBe('idle');
  });

  it('should reset judge counts on reset', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');
    engine.reset();
    const counts = engine.judgeCounts;
    expect(counts.perfect + counts.great + counts.good + counts.miss).toBe(0);
  });

  it('should allow restart after reset', () => {
    const engine = createEngine();
    engine.start();
    engine.reset();
    expect(engine.status).toBe('idle');
    engine.start();
    expect(engine.status).toBe('playing');
  });
});

// ============================
// 19. Destroy
// ============================

describe('RhythmEngine - Destroy', () => {
  it('should clean up on destroy', () => {
    const engine = createEngine();
    engine.start();
    engine.destroy();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
  });
});

// ============================
// 20. 轨道闪光
// ============================

describe('RhythmEngine - Lane Flash', () => {
  it('should trigger lane flash on key press', () => {
    const engine = startEngine();
    engine.handleKeyDown('d');
    expect(engine._getLaneFlash(0)).toBeGreaterThan(0);
  });

  it('should trigger correct lane flash for each key', () => {
    const engine = startEngine();
    engine.handleKeyDown('f');
    expect(engine._getLaneFlash(1)).toBeGreaterThan(0);
    expect(engine._getLaneFlash(0)).toBe(0);
  });

  it('lane flash should decrease over time', () => {
    const engine = startEngine();
    engine.handleKeyDown('d');
    const initial = engine._getLaneFlash(0);
    (engine as any).updateLaneFlash(100);
    expect(engine._getLaneFlash(0)).toBeLessThan(initial);
  });
});

// ============================
// 21. 综合场景测试
// ============================

describe('RhythmEngine - Integration Scenarios', () => {
  it('should handle a full easy beatmap playthrough (all Perfect)', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
      { time: 3000, lane: 2 },
      { time: 3500, lane: 3 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3500);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine._setGameTime(2500);
    engine.handleKeyDown('f');
    engine._setGameTime(3000);
    engine.handleKeyDown('j');
    engine._setGameTime(3500);
    engine.handleKeyDown('k');

    expect(engine.score).toBe(400); // 4 * 100
    expect(engine.combo).toBe(4);
    expect(engine.maxCombo).toBe(4);
    expect(engine.judgeCounts.perfect).toBe(4);
    expect(engine.health).toBe(INITIAL_HEALTH);
  });

  it('should handle mixed judgments', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },  // Perfect
      { time: 2500, lane: 1 },  // Great
      { time: 3000, lane: 2 },  // Good
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3000);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine._setGameTime(2575); // Great
    engine.handleKeyDown('f');
    engine._setGameTime(3125); // Good
    engine.handleKeyDown('j');

    expect(engine.judgeCounts.perfect).toBe(1);
    expect(engine.judgeCounts.great).toBe(1);
    expect(engine.judgeCounts.good).toBe(1);
    expect(engine.combo).toBe(3);
  });

  it('should handle miss breaking combo then resume', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
      { time: 3000, lane: 2 },  // will miss
      { time: 3500, lane: 3 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(3500);
    engine._forceSpawnNotes();

    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine._setGameTime(2500);
    engine.handleKeyDown('f');

    // Miss lane 2
    engine._setGameTime(3200);
    engine._forceCheckMisses();
    expect(engine.combo).toBe(0);

    // Resume
    engine._setGameTime(3500);
    engine.handleKeyDown('k');
    expect(engine.combo).toBe(1);
    expect(engine.maxCombo).toBe(2);
  });

  it('should handle all 4 lanes simultaneously', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2000, lane: 1 },
      { time: 2000, lane: 2 },
      { time: 2000, lane: 3 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);

    engine.handleKeyDown('d');
    engine.handleKeyDown('f');
    engine.handleKeyDown('j');
    engine.handleKeyDown('k');

    expect(engine.judgeCounts.perfect).toBe(4);
    expect(engine.combo).toBe(4);
    expect(engine.score).toBe(400);
  });

  it('should calculate score correctly with combo multiplier', () => {
    // Create 12 notes to test combo multiplier progression
    const notes = Array.from({ length: 12 }, (_, i) => ({
      time: 1000 + i * 500,
      lane: i % 4,
    }));
    const beatmap = createTestBeatmap(notes);
    const engine = startEngine(beatmap);
    engine._setGameTime(notes[notes.length - 1].time);
    engine._forceSpawnNotes();

    let expectedScore = 0;
    for (let i = 0; i < 12; i++) {
      engine._setGameTime(notes[i].time);
      engine._forceUpdateNotes(0);
      const key = LANE_KEYS[notes[i].lane];
      // combo is incremented BEFORE multiplier is applied
      const comboAfter = i + 1;
      const multiplier = comboAfter >= 10 ? 2 : 1;
      expectedScore += 100 * multiplier;
      engine.handleKeyDown(key);
      engine.handleKeyUp(key); // Release key to allow re-press
    }

    expect(engine.score).toBe(expectedScore);
    expect(engine.combo).toBe(12);
  });

  it('should handle game over from too many misses', () => {
    const notes = Array.from({ length: 15 }, (_, i) => ({
      time: 1000 + i * 500,
      lane: i % 4,
    }));
    const beatmap = createTestBeatmap(notes);
    const engine = startEngine(beatmap);
    engine._setGameTime(notes[notes.length - 1].time);
    engine._forceSpawnNotes();

    // Miss all notes
    for (const note of notes) {
      engine._setGameTime(note.time + 200);
      engine._forceUpdateNotes(0);
      engine._forceCheckMisses();
      if (engine.health <= 0) break;
    }

    expect(engine.health).toBe(0);
    // Call update to trigger gameOver
    (engine as any).update(16);
    expect(engine.isFinished).toBe(true);
    expect(engine.isWin).toBe(false);
    expect(engine.status).toBe('gameover');
  });

  it('should preserve maxCombo after reset and rebuild', () => {
    const beatmap = createTestBeatmap([
      { time: 2000, lane: 0 },
      { time: 2500, lane: 1 },
    ]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2500);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine.handleKeyDown('d');
    engine._setGameTime(2500);
    engine.handleKeyDown('f');
    expect(engine.maxCombo).toBe(2);

    engine.reset();
    expect(engine.maxCombo).toBe(0);
  });

  it('getState should return consistent snapshot', () => {
    const beatmap = createTestBeatmap([{ time: 2000, lane: 0 }]);
    const engine = startEngine(beatmap);
    engine._setGameTime(2000);
    engine._forceSpawnNotes();
    engine._setGameTime(2000);
    engine._forceUpdateNotes(0);
    engine.handleKeyDown('d');

    const state = engine.getState();
    expect(state.score).toBe(engine.score);
    expect(state.combo).toBe(engine.combo);
    expect(state.maxCombo).toBe(engine.maxCombo);
    expect(state.health).toBe(engine.health);
    expect(state.judgeCounts.perfect).toBe(1);
    expect(state.isFinished).toBe(false);
    expect(state.isWin).toBe(false);
  });

  it('judgeCounts should be a copy not reference', () => {
    const engine = startEngine();
    const counts = engine.judgeCounts;
    counts.perfect = 999;
    expect(engine.judgeCounts.perfect).toBe(0);
  });
});
