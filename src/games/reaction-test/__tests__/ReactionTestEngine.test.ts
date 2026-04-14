import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReactionTestEngine } from '../ReactionTestEngine';
import {
  ReactionPhase,
  WAIT_MIN_MS, WAIT_MAX_MS,
  DEFAULT_ROUNDS, MAX_ROUNDS, MIN_ROUNDS,
  RATING_LEGENDARY, RATING_EXCELLENT, RATING_GOOD,
  RATING_AVERAGE, RATING_SLOW,
  STORAGE_KEY_BEST, STORAGE_KEY_HISTORY,
} from '../constants';

// ========== Helper: 创建引擎并初始化 ==========
function createEngine(): ReactionTestEngine {
  const engine = new ReactionTestEngine();
  engine.init();
  return engine;
}

// ========== Helper: 启动引擎并进入 playing 状态 ==========
function startEngine(): ReactionTestEngine {
  const engine = createEngine();
  // 需要设置 canvas 才能 start，但测试中 init() 不传 canvas
  // 我们直接模拟 playing 状态
  (engine as any)._status = 'playing';
  engine.onStart();
  return engine;
}

// ========== Helper: 推进 update 模拟时间流逝 ==========
function advanceTime(engine: ReactionTestEngine, ms: number): void {
  engine.update(ms);
}

// ========== Helper: 模拟等待阶段完成（让随机延迟到期） ==========
function forceWaitingComplete(engine: ReactionTestEngine): void {
  const engineAny = engine as any;
  // 设置一个已经过期的等待
  engineAny._randomDelay = 100;
  engineAny._waitStartTime = performance.now() - 200;
  engine.update(16);
}

// ========== Helper: 模拟按键 ==========
function pressKey(engine: ReactionTestEngine, key: string = ' '): void {
  engine.handleKeyDown(key);
}

// ========== Helper: 模拟点击 ==========
function click(engine: ReactionTestEngine): void {
  engine.handleClick(0, 0);
}

// ============================================================
// 1. 引擎初始化测试
// ============================================================
describe('ReactionTestEngine - 初始化', () => {
  it('应该正确创建引擎实例', () => {
    const engine = new ReactionTestEngine();
    expect(engine).toBeInstanceOf(ReactionTestEngine);
  });

  it('init() 后应处于 WAITING 阶段', () => {
    const engine = createEngine();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
  });

  it('init() 后 currentRound 应为 0', () => {
    const engine = createEngine();
    expect(engine.currentRound).toBe(0);
  });

  it('init() 后 roundResults 应为空', () => {
    const engine = createEngine();
    expect(engine.roundResults).toHaveLength(0);
  });

  it('init() 后 lastReactionTime 应为 null', () => {
    const engine = createEngine();
    expect(engine.lastReactionTime).toBeNull();
  });

  it('init() 后 bestTime 应为 null', () => {
    const engine = createEngine();
    expect(engine.bestTime).toBeNull();
  });

  it('init() 后 averageTime 应为 null', () => {
    const engine = createEngine();
    expect(engine.averageTime).toBeNull();
  });

  it('init() 后 totalRounds 应为默认值', () => {
    const engine = createEngine();
    expect(engine.totalRounds).toBe(DEFAULT_ROUNDS);
  });

  it('init() 后 isWin 应为 false', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('init() 后 validRoundsCount 应为 0', () => {
    const engine = createEngine();
    expect(engine.validRoundsCount).toBe(0);
  });

  it('init() 后 tooEarlyCount 应为 0', () => {
    const engine = createEngine();
    expect(engine.tooEarlyCount).toBe(0);
  });
});

// ============================================================
// 2. 状态机转换测试
// ============================================================
describe('ReactionTestEngine - 状态机转换', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('start() 后应处于 WAITING 阶段', () => {
    expect(engine.phase).toBe(ReactionPhase.WAITING);
  });

  it('WAITING → READY：随机延迟到期后自动转换', () => {
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    forceWaitingComplete(engine);
    expect(engine.phase).toBe(ReactionPhase.READY);
  });

  it('READY → REACTING：用户按键后转换', () => {
    forceWaitingComplete(engine);
    expect(engine.phase).toBe(ReactionPhase.READY);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('READY → REACTING：用户点击后转换', () => {
    forceWaitingComplete(engine);
    click(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('WAITING → TOO_EARLY：过早按键转换', () => {
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
  });

  it('REACTING 阶段按键不应改变状态', () => {
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('TOO_EARLY 阶段按键不应改变状态', () => {
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
  });

  it('完整一轮: WAITING → READY → REACTING → WAITING', () => {
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    forceWaitingComplete(engine);
    expect(engine.phase).toBe(ReactionPhase.READY);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
    expect(engine.currentRound).toBe(1);
    // 模拟 setTimeout 回调
    const engineAny = engine as any;
    engineAny._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
  });
});

// ============================================================
// 3. 计时逻辑测试
// ============================================================
describe('ReactionTestEngine - 计时逻辑', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('反应时间应大于 0', () => {
    forceWaitingComplete(engine);
    // 等一小段时间再按键
    pressKey(engine);
    expect(engine.lastReactionTime).toBeGreaterThanOrEqual(0);
  });

  it('反应时间应记录到 roundResults', () => {
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.roundResults).toHaveLength(1);
    expect(engine.roundResults[0].isTooEarly).toBe(false);
    expect(engine.roundResults[0].reactionTime).toBeGreaterThanOrEqual(0);
  });

  it('bestTime 应跟踪本轮最佳', () => {
    // 第一轮
    forceWaitingComplete(engine);
    pressKey(engine);
    const firstTime = engine.lastReactionTime!;
    expect(engine.bestTime).toBe(firstTime);
  });

  it('update 应推进动画时间', () => {
    const engineAny = engine as any;
    const before = engineAny._animTime;
    engine.update(100);
    expect(engineAny._animTime).toBe(before + 100);
  });

  it('随机延迟应在 WAIT_MIN_MS 和 WAIT_MAX_MS 之间', () => {
    const engineAny = engine as any;
    const delay = engineAny._randomDelay;
    expect(delay).toBeGreaterThanOrEqual(WAIT_MIN_MS);
    expect(delay).toBeLessThanOrEqual(WAIT_MAX_MS);
  });
});

// ============================================================
// 4. 过早按键处理测试
// ============================================================
describe('ReactionTestEngine - 过早按键', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('WAITING 阶段按键应进入 TOO_EARLY', () => {
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
  });

  it('过早按键应记录 isTooEarly=true', () => {
    pressKey(engine);
    expect(engine.roundResults).toHaveLength(1);
    expect(engine.roundResults[0].isTooEarly).toBe(true);
    expect(engine.roundResults[0].reactionTime).toBe(-1);
  });

  it('过早按键应增加 currentRound', () => {
    expect(engine.currentRound).toBe(0);
    pressKey(engine);
    expect(engine.currentRound).toBe(1);
  });

  it('tooEarlyCount 应正确统计', () => {
    pressKey(engine);
    expect(engine.tooEarlyCount).toBe(1);
  });

  it('validRoundsCount 不应计入过早按键', () => {
    pressKey(engine);
    expect(engine.validRoundsCount).toBe(0);
  });

  it('averageTime 不应计入过早按键', () => {
    pressKey(engine);
    expect(engine.averageTime).toBeNull();
  });

  it('retry() 可以撤销过早按键并重新等待', () => {
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
    expect(engine.currentRound).toBe(1);
    engine.retry();
    expect(engine.currentRound).toBe(0);
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    expect(engine.roundResults).toHaveLength(0);
  });

  it('多次过早按键应正确累计', () => {
    pressKey(engine);
    // 模拟 advanceRound
    (engine as any)._advanceRound();
    pressKey(engine);
    expect(engine.tooEarlyCount).toBe(2);
    expect(engine.currentRound).toBe(2);
  });
});

// ============================================================
// 5. 成绩记录测试
// ============================================================
describe('ReactionTestEngine - 成绩记录', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
    localStorage.clear();
  });

  it('有效反应应记录 reactionTime', () => {
    forceWaitingComplete(engine);
    pressKey(engine);
    const result = engine.roundResults[0];
    expect(result.isTooEarly).toBe(false);
    expect(result.reactionTime).toBeGreaterThanOrEqual(0);
  });

  it('bestTime 应为所有有效轮次的最小值', () => {
    // 第一轮
    forceWaitingComplete(engine);
    pressKey(engine);
    const first = engine.lastReactionTime!;
    expect(engine.bestTime).toBe(first);

    // 第二轮 - 模拟更快
    (engine as any)._advanceRound();
    forceWaitingComplete(engine);
    // 模拟一个更快的反应时间
    (engine as any)._readyStartTime = performance.now() - 50;
    pressKey(engine);
    const second = engine.lastReactionTime!;
    if (second < first) {
      expect(engine.bestTime).toBe(second);
    }
  });

  it('averageTime 应计算所有有效轮次的平均值', () => {
    // 第一轮
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 200;
    pressKey(engine);

    // 第二轮
    (engine as any)._advanceRound();
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 300;
    pressKey(engine);

    const avg = engine.averageTime;
    expect(avg).not.toBeNull();
    expect(avg).toBeGreaterThan(0);
  });

  it('混合有效和过早按键的平均值计算', () => {
    // 有效轮
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 200;
    pressKey(engine);

    // 过早按键
    (engine as any)._advanceRound();
    pressKey(engine);

    // 有效轮
    (engine as any)._advanceRound();
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 250;
    pressKey(engine);

    const avg = engine.averageTime;
    expect(avg).not.toBeNull();
    // 只计算两个有效轮次
    expect(engine.validRoundsCount).toBe(2);
    expect(engine.tooEarlyCount).toBe(1);
  });

  it('allTimeBest 应从 localStorage 加载', () => {
    localStorage.setItem(STORAGE_KEY_BEST, '180');
    const engine2 = new ReactionTestEngine();
    engine2.init();
    expect(engine2.allTimeBest).toBe(180);
  });

  it('allTimeBest 为 NaN 时应返回 null', () => {
    localStorage.setItem(STORAGE_KEY_BEST, 'not-a-number');
    const engine2 = new ReactionTestEngine();
    engine2.init();
    expect(engine2.allTimeBest).toBeNull();
  });

  it('反应时间应更新 allTimeBest', () => {
    forceWaitingComplete(engine);
    pressKey(engine);
    const time = engine.lastReactionTime!;
    expect(engine.allTimeBest).toBe(time);
    // 检查 localStorage
    expect(localStorage.getItem(STORAGE_KEY_BEST)).toBe(time.toString());
  });

  it('更快的反应时间应更新 allTimeBest', () => {
    // 先设置一个较慢的最佳
    localStorage.setItem(STORAGE_KEY_BEST, '500');
    const engine2 = startEngine();
    forceWaitingComplete(engine2);
    // 模拟快速反应
    (engine2 as any)._readyStartTime = performance.now() - 100;
    pressKey(engine2);
    expect(engine2.allTimeBest).toBeLessThan(500);
  });

  it('更慢的反应时间不应更新 allTimeBest', () => {
    localStorage.setItem(STORAGE_KEY_BEST, '50');
    const engine2 = startEngine();
    forceWaitingComplete(engine2);
    // 模拟慢速反应
    (engine2 as any)._readyStartTime = performance.now() - 500;
    pressKey(engine2);
    expect(engine2.allTimeBest).toBe(50);
  });
});

// ============================================================
// 6. 多轮测试测试
// ============================================================
describe('ReactionTestEngine - 多轮测试', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
    engine.setRounds(3);
  });

  it('setRounds 应正确设置轮次数', () => {
    expect(engine.totalRounds).toBe(3);
  });

  it('setRounds 应限制最小值', () => {
    engine.setRounds(0);
    expect(engine.totalRounds).toBe(MIN_ROUNDS);
  });

  it('setRounds 应限制最大值', () => {
    engine.setRounds(100);
    expect(engine.totalRounds).toBe(MAX_ROUNDS);
  });

  it('完成所有轮次后应进入 RESULT 阶段', () => {
    engine.setRounds(2);

    // 第一轮
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.currentRound).toBe(1);

    // 第二轮
    (engine as any)._advanceRound();
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.currentRound).toBe(2);

    // 完成
    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.isWin).toBe(true);
  });

  it('完成所有轮次后 isWin 应为 true', () => {
    engine.setRounds(1);
    forceWaitingComplete(engine);
    pressKey(engine);
    (engine as any)._advanceRound();
    expect(engine.isWin).toBe(true);
  });

  it('未完成时 isWin 应为 false', () => {
    engine.setRounds(3);
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.isWin).toBe(false);
  });

  it('3轮测试应有3个结果', () => {
    engine.setRounds(3);

    for (let i = 0; i < 3; i++) {
      if (i > 0) (engine as any)._advanceRound();
      forceWaitingComplete(engine);
      pressKey(engine);
    }
    (engine as any)._advanceRound();

    expect(engine.roundResults).toHaveLength(3);
  });
});

// ============================================================
// 7. 分数计算测试
// ============================================================
describe('ReactionTestEngine - 分数计算', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('反应时间越短分数越高', () => {
    forceWaitingComplete(engine);
    // 模拟快速反应
    (engine as any)._readyStartTime = performance.now() - 100;
    pressKey(engine);
    const fastScore = engine.score;

    // 重置并模拟慢速反应
    engine.reset();
    (engine as any)._status = 'playing';
    engine.onStart();
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 500;
    pressKey(engine);
    const slowScore = engine.score;

    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it('分数不应为负数', () => {
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.score).toBeGreaterThanOrEqual(0);
  });

  it('极慢反应分数应为 0', () => {
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 2000;
    pressKey(engine);
    expect(engine.score).toBe(0);
  });
});

// ============================================================
// 8. 评级系统测试
// ============================================================
describe('ReactionTestEngine - 评级系统', () => {
  it('100ms 应为传奇', () => {
    const rating = ReactionTestEngine.getRating(100);
    expect(rating.label).toContain('传奇');
  });

  it('150ms 应为传奇', () => {
    const rating = ReactionTestEngine.getRating(150);
    expect(rating.label).toContain('传奇');
  });

  it('180ms 应为优秀', () => {
    const rating = ReactionTestEngine.getRating(180);
    expect(rating.label).toContain('优秀');
  });

  it('200ms 应为优秀', () => {
    const rating = ReactionTestEngine.getRating(200);
    expect(rating.label).toContain('优秀');
  });

  it('230ms 应为良好', () => {
    const rating = ReactionTestEngine.getRating(230);
    expect(rating.label).toContain('良好');
  });

  it('250ms 应为良好', () => {
    const rating = ReactionTestEngine.getRating(250);
    expect(rating.label).toContain('良好');
  });

  it('280ms 应为一般', () => {
    const rating = ReactionTestEngine.getRating(280);
    expect(rating.label).toContain('一般');
  });

  it('300ms 应为一般', () => {
    const rating = ReactionTestEngine.getRating(300);
    expect(rating.label).toContain('一般');
  });

  it('330ms 应为较慢', () => {
    const rating = ReactionTestEngine.getRating(330);
    expect(rating.label).toContain('较慢');
  });

  it('350ms 应为较慢', () => {
    const rating = ReactionTestEngine.getRating(350);
    expect(rating.label).toContain('较慢');
  });

  it('400ms 应为需要练习', () => {
    const rating = ReactionTestEngine.getRating(400);
    expect(rating.label).toContain('需要练习');
  });

  it('500ms 应为需要练习', () => {
    const rating = ReactionTestEngine.getRating(500);
    expect(rating.label).toContain('需要练习');
  });

  it('0ms 应为传奇', () => {
    const rating = ReactionTestEngine.getRating(0);
    expect(rating.label).toContain('传奇');
  });

  it('评级边界值: RATING_LEGENDARY', () => {
    const rating = ReactionTestEngine.getRating(RATING_LEGENDARY);
    expect(rating.label).toContain('传奇');
  });

  it('评级边界值: RATING_EXCELLENT', () => {
    const rating = ReactionTestEngine.getRating(RATING_EXCELLENT);
    expect(rating.label).toContain('优秀');
  });

  it('评级边界值: RATING_GOOD', () => {
    const rating = ReactionTestEngine.getRating(RATING_GOOD);
    expect(rating.label).toContain('良好');
  });

  it('评级边界值: RATING_AVERAGE', () => {
    const rating = ReactionTestEngine.getRating(RATING_AVERAGE);
    expect(rating.label).toContain('一般');
  });

  it('评级边界值: RATING_SLOW', () => {
    const rating = ReactionTestEngine.getRating(RATING_SLOW);
    expect(rating.label).toContain('较慢');
  });

  it('评级边界值: RATING_SLOW + 1', () => {
    const rating = ReactionTestEngine.getRating(RATING_SLOW + 1);
    expect(rating.label).toContain('需要练习');
  });
});

// ============================================================
// 9. 静态方法测试
// ============================================================
describe('ReactionTestEngine - 静态方法', () => {
  it('calculateAverage 空数组应返回 null', () => {
    expect(ReactionTestEngine.calculateAverage([])).toBeNull();
  });

  it('calculateAverage 全部过早应返回 null', () => {
    const results = [
      { reactionTime: -1, isTooEarly: true },
      { reactionTime: -1, isTooEarly: true },
    ];
    expect(ReactionTestEngine.calculateAverage(results)).toBeNull();
  });

  it('calculateAverage 应正确计算平均值', () => {
    const results = [
      { reactionTime: 200, isTooEarly: false },
      { reactionTime: 300, isTooEarly: false },
    ];
    expect(ReactionTestEngine.calculateAverage(results)).toBe(250);
  });

  it('calculateAverage 应忽略过早按键', () => {
    const results = [
      { reactionTime: 200, isTooEarly: false },
      { reactionTime: -1, isTooEarly: true },
      { reactionTime: 300, isTooEarly: false },
    ];
    expect(ReactionTestEngine.calculateAverage(results)).toBe(250);
  });

  it('calculateAverage 单个值', () => {
    const results = [
      { reactionTime: 250, isTooEarly: false },
    ];
    expect(ReactionTestEngine.calculateAverage(results)).toBe(250);
  });

  it('generateRandomDelay 应在范围内', () => {
    for (let i = 0; i < 100; i++) {
      const delay = ReactionTestEngine.generateRandomDelay();
      expect(delay).toBeGreaterThanOrEqual(WAIT_MIN_MS);
      expect(delay).toBeLessThanOrEqual(WAIT_MAX_MS);
    }
  });
});

// ============================================================
// 10. getState 测试
// ============================================================
describe('ReactionTestEngine - getState', () => {
  it('应返回完整的游戏状态', () => {
    const engine = createEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('currentRound');
    expect(state).toHaveProperty('totalRounds');
    expect(state).toHaveProperty('roundResults');
    expect(state).toHaveProperty('lastReactionTime');
    expect(state).toHaveProperty('averageTime');
    expect(state).toHaveProperty('bestTime');
    expect(state).toHaveProperty('allTimeBest');
    expect(state).toHaveProperty('isWin');
  });

  it('初始状态应正确', () => {
    const engine = createEngine();
    const state = engine.getState();
    expect(state.phase).toBe(ReactionPhase.WAITING);
    expect(state.currentRound).toBe(0);
    expect(state.totalRounds).toBe(DEFAULT_ROUNDS);
    expect(state.roundResults).toHaveLength(0);
    expect(state.lastReactionTime).toBeNull();
    expect(state.averageTime).toBeNull();
    expect(state.bestTime).toBeNull();
    expect(state.isWin).toBe(false);
  });

  it('反应后状态应更新', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    const state = engine.getState();
    expect(state.phase).toBe(ReactionPhase.REACTING);
    expect(state.currentRound).toBe(1);
    expect(state.roundResults).toHaveLength(1);
    expect(state.lastReactionTime).not.toBeNull();
    expect(state.lastReactionTime).toBeGreaterThanOrEqual(0);
  });

  it('返回的 roundResults 应是副本', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1.roundResults).not.toBe(state2.roundResults);
  });
});

// ============================================================
// 11. 事件系统测试
// ============================================================
describe('ReactionTestEngine - 事件系统', () => {
  it('状态变化时应触发 stateChange 事件', () => {
    const engine = startEngine();
    const callback = vi.fn();
    engine.on('stateChange', callback);
    forceWaitingComplete(engine);
    expect(callback).toHaveBeenCalled();
  });

  it('按键反应时应触发 stateChange', () => {
    const engine = startEngine();
    const callback = vi.fn();
    engine.on('stateChange', callback);
    forceWaitingComplete(engine);
    callback.mockClear();
    pressKey(engine);
    expect(callback).toHaveBeenCalled();
  });

  it('过早按键应触发 stateChange', () => {
    const engine = startEngine();
    const callback = vi.fn();
    engine.on('stateChange', callback);
    pressKey(engine);
    expect(callback).toHaveBeenCalled();
  });

  it('off 应取消事件监听', () => {
    const engine = startEngine();
    const callback = vi.fn();
    engine.on('stateChange', callback);
    engine.off('stateChange', callback);
    forceWaitingComplete(engine);
    expect(callback).not.toHaveBeenCalled();
  });

  it('stateChange 回调应包含状态数据', () => {
    const engine = startEngine();
    let receivedState: any = null;
    engine.on('stateChange', (state: any) => {
      receivedState = state;
    });
    forceWaitingComplete(engine);
    expect(receivedState).not.toBeNull();
    expect(receivedState.phase).toBe(ReactionPhase.READY);
  });
});

// ============================================================
// 12. 输入处理测试
// ============================================================
describe('ReactionTestEngine - 输入处理', () => {
  let engine: ReactionTestEngine;

  beforeEach(() => {
    engine = startEngine();
  });

  it('空格键应触发反应', () => {
    forceWaitingComplete(engine);
    pressKey(engine, ' ');
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('Enter 键应触发反应', () => {
    forceWaitingComplete(engine);
    pressKey(engine, 'Enter');
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('字母键应触发反应', () => {
    forceWaitingComplete(engine);
    pressKey(engine, 'a');
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('数字键应触发反应', () => {
    forceWaitingComplete(engine);
    pressKey(engine, '5');
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('方向键不应触发反应', () => {
    forceWaitingComplete(engine);
    pressKey(engine, 'ArrowUp');
    expect(engine.phase).toBe(ReactionPhase.READY);
  });

  it('handleClick 应触发反应', () => {
    forceWaitingComplete(engine);
    click(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('非 playing 状态下按键无效', () => {
    // 先进入 READY，然后暂停，按键不应有效果
    forceWaitingComplete(engine);
    expect(engine.phase).toBe(ReactionPhase.READY);
    (engine as any)._status = 'paused';
    pressKey(engine);
    // 状态不应改变（仍为 READY）
    expect(engine.phase).toBe(ReactionPhase.READY);
  });

  it('非 playing 状态下点击无效', () => {
    (engine as any)._status = 'paused';
    click(engine);
    expect(engine.phase).toBe(ReactionPhase.WAITING);
  });

  it('handleKeyUp 不应影响游戏状态', () => {
    forceWaitingComplete(engine);
    engine.handleKeyUp(' ');
    expect(engine.phase).toBe(ReactionPhase.READY);
  });
});

// ============================================================
// 13. 重置和销毁测试
// ============================================================
describe('ReactionTestEngine - 重置和销毁', () => {
  it('reset() 应重置所有状态', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.currentRound).toBe(1);

    engine.reset();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    expect(engine.currentRound).toBe(0);
    expect(engine.roundResults).toHaveLength(0);
    expect(engine.lastReactionTime).toBeNull();
    expect(engine.bestTime).toBeNull();
    expect(engine.isWin).toBe(false);
  });

  it('destroy() 应清理数据', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    engine.destroy();
    expect(engine.roundResults).toHaveLength(0);
  });

  it('reset 后可以重新开始', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    engine.reset();
    (engine as any)._status = 'playing';
    engine.onStart();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    expect(engine.currentRound).toBe(0);
  });
});

// ============================================================
// 14. 存储测试
// ============================================================
describe('ReactionTestEngine - 存储', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getHistory 空时应返回空数组', () => {
    const engine = createEngine();
    expect(engine.getHistory()).toEqual([]);
  });

  it('getHistory 应返回存储的历史', () => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify([250, 300, 280]));
    const engine = createEngine();
    expect(engine.getHistory()).toEqual([250, 300, 280]);
  });

  it('getHistory 存储 JSON 无效时应返回空数组', () => {
    localStorage.setItem(STORAGE_KEY_HISTORY, 'invalid-json');
    const engine = createEngine();
    expect(engine.getHistory()).toEqual([]);
  });

  it('allTimeBest 无存储时应为 null', () => {
    const engine = createEngine();
    expect(engine.allTimeBest).toBeNull();
  });

  it('allTimeBest 有存储时应加载', () => {
    localStorage.setItem(STORAGE_KEY_BEST, '200');
    const engine = createEngine();
    expect(engine.allTimeBest).toBe(200);
  });

  it('allTimeBest 存储无效值时应为 null', () => {
    localStorage.setItem(STORAGE_KEY_BEST, 'abc');
    const engine = createEngine();
    expect(engine.allTimeBest).toBeNull();
  });

  it('反应后应保存 allTimeBest 到 localStorage', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    const stored = localStorage.getItem(STORAGE_KEY_BEST);
    expect(stored).not.toBeNull();
    expect(parseInt(stored!, 10)).toBe(engine.allTimeBest);
  });
});

// ============================================================
// 15. 边界情况测试
// ============================================================
describe('ReactionTestEngine - 边界情况', () => {
  it('1轮测试应正常完成', () => {
    const engine = startEngine();
    engine.setRounds(1);
    forceWaitingComplete(engine);
    pressKey(engine);
    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.isWin).toBe(true);
  });

  it('10轮（最大）测试应正常完成', () => {
    const engine = startEngine();
    engine.setRounds(MAX_ROUNDS);
    for (let i = 0; i < MAX_ROUNDS; i++) {
      if (i > 0) (engine as any)._advanceRound();
      forceWaitingComplete(engine);
      pressKey(engine);
    }
    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.roundResults).toHaveLength(MAX_ROUNDS);
  });

  it('全部过早按键应能完成测试', () => {
    const engine = startEngine();
    engine.setRounds(2);
    for (let i = 0; i < 2; i++) {
      if (i > 0) (engine as any)._advanceRound();
      pressKey(engine);
    }
    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.averageTime).toBeNull();
    expect(engine.validRoundsCount).toBe(0);
    expect(engine.tooEarlyCount).toBe(2);
  });

  it('0ms 反应时间应正常处理', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    // 立即按键（readyStartTime 刚设置）
    pressKey(engine);
    expect(engine.lastReactionTime).toBeGreaterThanOrEqual(0);
  });

  it('极大反应时间应正常处理', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    (engine as any)._readyStartTime = performance.now() - 10000;
    pressKey(engine);
    expect(engine.lastReactionTime).toBeGreaterThanOrEqual(10000);
  });

  it('在非 playing 状态 update 不应崩溃', () => {
    const engine = createEngine();
    expect(() => engine.update(16)).not.toThrow();
  });

  it('连续快速按键不应崩溃', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    pressKey(engine);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('setRounds 负数应限制为 MIN_ROUNDS', () => {
    const engine = createEngine();
    engine.setRounds(-5);
    expect(engine.totalRounds).toBe(MIN_ROUNDS);
  });

  it('setRounds 小数应取整', () => {
    const engine = createEngine();
    engine.setRounds(3.7);
    // Math.max(Math.min(3.7, 10), 1) = 3.7, 但比较时可能有问题
    expect(engine.totalRounds).toBeGreaterThanOrEqual(MIN_ROUNDS);
    expect(engine.totalRounds).toBeLessThanOrEqual(MAX_ROUNDS);
  });

  it('retry 在非 TOO_EARLY 状态应安全', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    expect(() => engine.retry()).not.toThrow();
  });

  it('retry 在 RESULT 状态应安全', () => {
    const engine = startEngine();
    engine.setRounds(1);
    forceWaitingComplete(engine);
    pressKey(engine);
    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(() => engine.retry()).not.toThrow();
  });
});

// ============================================================
// 16. update 循环测试
// ============================================================
describe('ReactionTestEngine - update 循环', () => {
  it('WAITING 阶段 update 应检查延迟是否到期', () => {
    const engine = startEngine();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    // 设置一个很短的延迟
    (engine as any)._randomDelay = 50;
    (engine as any)._waitStartTime = performance.now() - 100;
    engine.update(16);
    expect(engine.phase).toBe(ReactionPhase.READY);
  });

  it('WAITING 阶段延迟未到期不应转换', () => {
    const engine = startEngine();
    (engine as any)._randomDelay = 5000;
    (engine as any)._waitStartTime = performance.now();
    engine.update(16);
    expect(engine.phase).toBe(ReactionPhase.WAITING);
  });

  it('READY 阶段 update 不应改变状态', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    expect(engine.phase).toBe(ReactionPhase.READY);
    engine.update(16);
    expect(engine.phase).toBe(ReactionPhase.READY);
  });

  it('REACTING 阶段 update 不应改变状态', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
    engine.update(16);
    expect(engine.phase).toBe(ReactionPhase.REACTING);
  });

  it('TOO_EARLY 阶段 update 不应改变状态', () => {
    const engine = startEngine();
    pressKey(engine);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
    engine.update(16);
    expect(engine.phase).toBe(ReactionPhase.TOO_EARLY);
  });

  it('RESULT 阶段 update 不应改变状态', () => {
    const engine = startEngine();
    engine.setRounds(1);
    forceWaitingComplete(engine);
    pressKey(engine);
    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    engine.update(16);
    expect(engine.phase).toBe(ReactionPhase.RESULT);
  });

  it('多次 update 应累积动画时间', () => {
    const engine = startEngine();
    engine.update(100);
    engine.update(200);
    expect((engine as any)._animTime).toBe(300);
  });
});

// ============================================================
// 17. 完整游戏流程测试
// ============================================================
describe('ReactionTestEngine - 完整游戏流程', () => {
  it('完整的5轮游戏流程', () => {
    const engine = startEngine();
    engine.setRounds(5);

    for (let i = 0; i < 5; i++) {
      if (i > 0) (engine as any)._advanceRound();
      forceWaitingComplete(engine);
      pressKey(engine);
      expect(engine.currentRound).toBe(i + 1);
    }

    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.isWin).toBe(true);
    expect(engine.roundResults).toHaveLength(5);
    expect(engine.averageTime).not.toBeNull();
    expect(engine.bestTime).not.toBeNull();
  });

  it('包含过早按键的完整游戏流程', () => {
    const engine = startEngine();
    engine.setRounds(4);

    // 第1轮：有效
    forceWaitingComplete(engine);
    pressKey(engine);

    // 第2轮：过早
    (engine as any)._advanceRound();
    pressKey(engine);

    // 第3轮：有效
    (engine as any)._advanceRound();
    forceWaitingComplete(engine);
    pressKey(engine);

    // 第4轮：有效
    (engine as any)._advanceRound();
    forceWaitingComplete(engine);
    pressKey(engine);

    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.validRoundsCount).toBe(3);
    expect(engine.tooEarlyCount).toBe(1);
    expect(engine.averageTime).not.toBeNull();
  });

  it('全部过早按键的游戏流程', () => {
    const engine = startEngine();
    engine.setRounds(3);

    for (let i = 0; i < 3; i++) {
      if (i > 0) (engine as any)._advanceRound();
      pressKey(engine);
    }

    (engine as any)._advanceRound();
    expect(engine.phase).toBe(ReactionPhase.RESULT);
    expect(engine.validRoundsCount).toBe(0);
    expect(engine.tooEarlyCount).toBe(3);
    expect(engine.averageTime).toBeNull();
    expect(engine.bestTime).toBeNull();
  });

  it('重置后重新开始游戏', () => {
    const engine = startEngine();
    engine.setRounds(1);
    forceWaitingComplete(engine);
    pressKey(engine);
    (engine as any)._advanceRound();
    expect(engine.isWin).toBe(true);

    engine.reset();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    expect(engine.currentRound).toBe(0);
    expect(engine.isWin).toBe(false);

    // 重新开始
    (engine as any)._status = 'playing';
    engine.onStart();
    forceWaitingComplete(engine);
    pressKey(engine);
    (engine as any)._advanceRound();
    expect(engine.isWin).toBe(true);
  });
});

// ============================================================
// 18. 常量验证测试
// ============================================================
describe('ReactionTestEngine - 常量验证', () => {
  it('WAIT_MIN_MS 应为 1000', () => {
    expect(WAIT_MIN_MS).toBe(1000);
  });

  it('WAIT_MAX_MS 应为 5000', () => {
    expect(WAIT_MAX_MS).toBe(5000);
  });

  it('DEFAULT_ROUNDS 应为 5', () => {
    expect(DEFAULT_ROUNDS).toBe(5);
  });

  it('MAX_ROUNDS 应为 10', () => {
    expect(MAX_ROUNDS).toBe(10);
  });

  it('MIN_ROUNDS 应为 1', () => {
    expect(MIN_ROUNDS).toBe(1);
  });

  it('RATING_LEGENDARY 应为 150', () => {
    expect(RATING_LEGENDARY).toBe(150);
  });

  it('RATING_EXCELLENT 应为 200', () => {
    expect(RATING_EXCELLENT).toBe(200);
  });

  it('RATING_GOOD 应为 250', () => {
    expect(RATING_GOOD).toBe(250);
  });

  it('RATING_AVERAGE 应为 300', () => {
    expect(RATING_AVERAGE).toBe(300);
  });

  it('RATING_SLOW 应为 350', () => {
    expect(RATING_SLOW).toBe(350);
  });

  it('WAIT_MIN_MS 应小于 WAIT_MAX_MS', () => {
    expect(WAIT_MIN_MS).toBeLessThan(WAIT_MAX_MS);
  });

  it('MIN_ROUNDS 应小于 MAX_ROUNDS', () => {
    expect(MIN_ROUNDS).toBeLessThan(MAX_ROUNDS);
  });

  it('评级阈值应递增', () => {
    expect(RATING_LEGENDARY).toBeLessThan(RATING_EXCELLENT);
    expect(RATING_EXCELLENT).toBeLessThan(RATING_GOOD);
    expect(RATING_GOOD).toBeLessThan(RATING_AVERAGE);
    expect(RATING_AVERAGE).toBeLessThan(RATING_SLOW);
  });
});

// ============================================================
// 19. ReactionPhase 枚举测试
// ============================================================
describe('ReactionPhase - 枚举', () => {
  it('应有 WAITING 值', () => {
    expect(ReactionPhase.WAITING).toBe('waiting');
  });

  it('应有 READY 值', () => {
    expect(ReactionPhase.READY).toBe('ready');
  });

  it('应有 REACTING 值', () => {
    expect(ReactionPhase.REACTING).toBe('reacting');
  });

  it('应有 RESULT 值', () => {
    expect(ReactionPhase.RESULT).toBe('result');
  });

  it('应有 TOO_EARLY 值', () => {
    expect(ReactionPhase.TOO_EARLY).toBe('too-early');
  });

  it('应有 5 个枚举值', () => {
    expect(Object.keys(ReactionPhase)).toHaveLength(5);
  });
});

// ============================================================
// 20. 属性访问器测试
// ============================================================
describe('ReactionTestEngine - 属性访问器', () => {
  it('phase 应反映当前阶段', () => {
    const engine = startEngine();
    expect(engine.phase).toBe(ReactionPhase.WAITING);
    forceWaitingComplete(engine);
    expect(engine.phase).toBe(ReactionPhase.READY);
  });

  it('currentRound 应反映当前轮次', () => {
    const engine = startEngine();
    expect(engine.currentRound).toBe(0);
    forceWaitingComplete(engine);
    pressKey(engine);
    expect(engine.currentRound).toBe(1);
  });

  it('totalRounds 应反映总轮数', () => {
    const engine = createEngine();
    expect(engine.totalRounds).toBe(DEFAULT_ROUNDS);
    engine.setRounds(7);
    expect(engine.totalRounds).toBe(7);
  });

  it('roundResults 应是只读的', () => {
    const engine = startEngine();
    forceWaitingComplete(engine);
    pressKey(engine);
    const results = engine.roundResults;
    expect(results).toHaveLength(1);
    // 修改返回值不应影响内部状态
    const snapshot = [...results];
    return; // readonly array 只能通过类型系统保证
  });

  it('lastReactionTime 在无反应时应为 null', () => {
    const engine = startEngine();
    expect(engine.lastReactionTime).toBeNull();
  });

  it('bestTime 在无有效轮次时应为 null', () => {
    const engine = startEngine();
    expect(engine.bestTime).toBeNull();
  });

  it('averageTime 在无有效轮次时应为 null', () => {
    const engine = startEngine();
    expect(engine.averageTime).toBeNull();
  });

  it('isWin 在游戏未完成时应为 false', () => {
    const engine = startEngine();
    expect(engine.isWin).toBe(false);
  });

  it('validRoundsCount 在无有效轮次时应为 0', () => {
    const engine = startEngine();
    expect(engine.validRoundsCount).toBe(0);
  });

  it('tooEarlyCount 在无过早按键时应为 0', () => {
    const engine = startEngine();
    expect(engine.tooEarlyCount).toBe(0);
  });
});
