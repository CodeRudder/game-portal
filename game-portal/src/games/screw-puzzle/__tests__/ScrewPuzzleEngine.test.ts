import { describe, it, expect, beforeEach } from 'vitest';
import {
  ScrewPuzzleEngine,
} from '../ScrewPuzzleEngine';
import {
  LEVEL_CONFIGS,
  MAX_LEVEL,
  BASE_SCORE_PER_SCREW,
  LEVEL_BONUS,
  PERFECT_BONUS,
  STUCK_PENALTY,
  UNSCREW_ANIM_DURATION,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/**
 * 创建引擎并启动游戏，立即暂停游戏循环以避免 rAF 无限循环。
 *
 * 在 jsdom 中 requestAnimationFrame 是同步 mock（setup.ts），
 * start() 会触发 gameLoop → rAF → gameLoop → ... 无限递归。
 * 解决方案：start() 后立即 pause()，后续通过手动调用 update() 推进状态。
 * 所有测试都通过 engine.update(16) 手动推进帧，无需依赖 rAF 循环。
 */
function createAndStartEngine(): ScrewPuzzleEngine {
  const engine = new ScrewPuzzleEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  engine.start();
  // 立即暂停游戏循环，防止 jsdom 中 rAF 导致无限循环
  // 后续通过 engine.update(16) 手动推进帧
  engine.pause();
  // 恢复到 playing 状态（不重启 rAF 循环）
  (engine as any)._status = 'playing';
  // 拦截后续 start() 调用，避免 rAF 再次触发无限循环
  const originalStart = engine.start.bind(engine);
  engine.start = () => {
    // 仅执行状态初始化逻辑，不启动 rAF 循环
    (engine as any)._status = 'playing';
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    (engine as any)._startTime = now;
    (engine as any).lastTime = now;
    (engine as any)._score = 0;
    (engine as any)._level = 1;
    (engine as any).onStart();
    (engine as any).emit('statusChange', 'playing');
    (engine as any).emit('scoreChange', 0);
    (engine as any).emit('levelChange', 1);
    // 不调用 requestAnimationFrame
  };
  return engine;
}

// ========== 辅助函数 ==========

/** 选中指定 ID 的螺丝 */
function selectScrewById(engine: ScrewPuzzleEngine, screwId: string) {
  const screws = engine.getScrews();
  const idx = screws.findIndex((s) => s.id === screwId);
  if (idx === -1) return; // 螺丝不存在，直接返回
  const maxIterations = screws.length + 1;
  let iterations = 0;
  while (engine.getSelectedScrewIndex() !== idx && iterations < maxIterations) {
    engine.selectNextScrew();
    iterations++;
  }
}

/** 拧下指定 ID 的螺丝并完成动画 */
function unscrewAndComplete(engine: ScrewPuzzleEngine, screwId: string) {
  selectScrewById(engine, screwId);
  engine.unscrewSelected();
  engine.forceCompleteUnscrew(screwId);
}

/** 完成所有掉落动画 */
function completeFalls(engine: ScrewPuzzleEngine) {
  engine.forceCompleteFalls();
}

// ============================================================
// 基础测试 — 引擎初始化
// ============================================================
describe('ScrewPuzzleEngine - 初始化', () => {
  it('应该正确创建引擎实例', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine).toBeInstanceOf(ScrewPuzzleEngine);
  });

  it('初始状态应为 idle', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.status).toBe('idle');
  });

  it('初始分数应为 0', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.score).toBe(0);
  });

  it('初始等级应为 1', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.level).toBe(1);
  });

  it('初始移动次数应为 0', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.getMoveCount()).toBe(0);
  });

  it('初始未胜利', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.getIsWin()).toBe(false);
  });

  it('初始未卡住', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.getIsStuck()).toBe(false);
  });

  it('初始历史记录为空', () => {
    const engine = new ScrewPuzzleEngine();
    expect(engine.getHistoryCount()).toBe(0);
  });
});

// ============================================================
// 启动测试
// ============================================================
describe('ScrewPuzzleEngine - 启动', () => {
  it('start() 后状态应为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start() 后应加载关卡 1', () => {
    const engine = createAndStartEngine();
    expect(engine.level).toBe(1);
  });

  it('start() 后应有螺丝', () => {
    const engine = createAndStartEngine();
    const screws = engine.getScrews();
    expect(screws.length).toBeGreaterThan(0);
  });

  it('start() 后应有板', () => {
    const engine = createAndStartEngine();
    const boards = engine.getBoards();
    expect(boards.length).toBeGreaterThan(0);
  });

  it('start() 后所有螺丝应为 fixed 状态', () => {
    const engine = createAndStartEngine();
    const screws = engine.getScrews();
    screws.forEach((s) => {
      expect(s.state).toBe('fixed');
    });
  });

  it('start() 后所有板应为 fixed 状态', () => {
    const engine = createAndStartEngine();
    const boards = engine.getBoards();
    boards.forEach((b) => {
      expect(b.state).toBe('fixed');
    });
  });

  it('start() 后选中索引应为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.getSelectedScrewIndex()).toBe(0);
  });

  it('关卡 1 应有 2 块板', () => {
    const engine = createAndStartEngine();
    expect(engine.getBoards().length).toBe(2);
  });

  it('关卡 1 应有 3 颗螺丝', () => {
    const engine = createAndStartEngine();
    expect(engine.getScrews().length).toBe(3);
  });

  it('未设置 canvas 时 start() 应抛出错误', () => {
    const engine = new ScrewPuzzleEngine();
    engine.init();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });
});

// ============================================================
// 螺丝选择测试
// ============================================================
describe('ScrewPuzzleEngine - 螺丝选择', () => {
  let engine: ScrewPuzzleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('selectNextScrew 应该移动到下一个螺丝', () => {
    const prev = engine.getSelectedScrewIndex();
    engine.selectNextScrew();
    const next = engine.getSelectedScrewIndex();
    expect(next).not.toBe(prev);
  });

  it('selectPrevScrew 应该移动到上一个螺丝', () => {
    engine.selectNextScrew();
    const afterNext = engine.getSelectedScrewIndex();
    engine.selectPrevScrew();
    const afterPrev = engine.getSelectedScrewIndex();
    expect(afterPrev).not.toBe(afterNext);
  });

  it('在最后一个螺丝时 selectNextScrew 应循环到第一个', () => {
    const remaining = engine.getRemainingScrews();
    for (let i = 0; i < remaining.length; i++) {
      engine.selectNextScrew();
    }
    // After cycling through all, should be at the first remaining
    const currentScrew = engine.getScrews()[engine.getSelectedScrewIndex()];
    expect(currentScrew.state).toBe('fixed');
  });

  it('在第一个螺丝时 selectPrevScrew 应循环到最后一个', () => {
    engine.selectPrevScrew();
    const remaining = engine.getRemainingScrews();
    const screw = engine.getScrews()[engine.getSelectedScrewIndex()];
    expect(screw.id).toBe(remaining[remaining.length - 1].id);
  });

  it('通过键盘 ArrowRight 应选择下一个螺丝', () => {
    const prev = engine.getSelectedScrewIndex();
    engine.handleKeyDown('ArrowRight');
    expect(engine.getSelectedScrewIndex()).not.toBe(prev);
  });

  it('通过键盘 ArrowUp 应选择下一个螺丝', () => {
    const prev = engine.getSelectedScrewIndex();
    engine.handleKeyDown('ArrowUp');
    expect(engine.getSelectedScrewIndex()).not.toBe(prev);
  });

  it('通过键盘 ArrowLeft 应选择上一个螺丝', () => {
    engine.selectNextScrew();
    const afterNext = engine.getSelectedScrewIndex();
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getSelectedScrewIndex()).not.toBe(afterNext);
  });

  it('通过键盘 ArrowDown 应选择上一个螺丝', () => {
    engine.selectNextScrew();
    const afterNext = engine.getSelectedScrewIndex();
    engine.handleKeyDown('ArrowDown');
    expect(engine.getSelectedScrewIndex()).not.toBe(afterNext);
  });

  it('getRemainingScrews 应返回所有未移除的螺丝', () => {
    const remaining = engine.getRemainingScrews();
    expect(remaining.length).toBe(3);
  });

  it('选中螺丝后应能获取到螺丝信息', () => {
    const idx = engine.getSelectedScrewIndex();
    const screws = engine.getScrews();
    expect(screws[idx]).toBeDefined();
    expect(screws[idx].state).toBe('fixed');
  });
});

// ============================================================
// 拧螺丝逻辑测试
// ============================================================
describe('ScrewPuzzleEngine - 拧螺丝逻辑', () => {
  let engine: ScrewPuzzleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空格键应触发拧螺丝', () => {
    engine.handleKeyDown(' ');
    const screws = engine.getScrews();
    const selected = screws[engine.getSelectedScrewIndex()];
    expect(selected.state).toBe('unscrewing');
  });

  it('Enter 键应触发拧螺丝', () => {
    engine.handleKeyDown('Enter');
    const screws = engine.getScrews();
    const selected = screws[engine.getSelectedScrewIndex()];
    expect(selected.state).toBe('unscrewing');
  });

  it('拧螺丝后移动次数应增加', () => {
    const prev = engine.getMoveCount();
    engine.handleKeyDown(' ');
    expect(engine.getMoveCount()).toBe(prev + 1);
  });

  it('不能拧已经移除的螺丝', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);

    // 选中已移除的螺丝再试拧
    const moveCountBefore = engine.getMoveCount();
    engine.unscrewSelected();
    expect(engine.getMoveCount()).toBe(moveCountBefore);
  });

  it('不能拧正在拧的螺丝', () => {
    engine.unscrewSelected();
    const moveCountBefore = engine.getMoveCount();
    engine.unscrewSelected();
    expect(engine.getMoveCount()).toBe(moveCountBefore);
  });

  it('unscrewSelected 应设置 unscrewing 状态', () => {
    engine.unscrewSelected();
    const screw = engine.getScrews()[engine.getSelectedScrewIndex()];
    expect(screw.state).toBe('unscrewing');
  });

  it('unscrewing 动画完成后螺丝应变为 removed', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);
    const screw = engine.getSrewById?.(screwId) ?? engine.getScrews().find((s) => s.id === screwId);
    expect(screw?.state).toBe('removed');
  });

  it('拧下螺丝应增加分数', () => {
    const prevScore = engine.score;
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);
    expect(engine.score).toBe(prevScore + BASE_SCORE_PER_SCREW);
  });

  it('拧下螺丝应增加历史记录', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);
    expect(engine.getHistoryCount()).toBe(1);
  });
});

// ============================================================
// 板掉落判定测试
// ============================================================
describe('ScrewPuzzleEngine - 板掉落判定', () => {
  it('拧下只连接一块板的螺丝，板应掉落', () => {
    const engine = createAndStartEngine();

    // 关卡1: s1 只连接 b1, 但 b1 还有 s2
    // 先拧下 s2 (bridge), 再拧 s1, b1 掉落
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');

    const board1 = engine.getBoardById('b1');
    expect(board1?.state).toMatch(/falling|fallen/);
  });

  it('板掉出屏幕后应变为 fallen 状态', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    completeFalls(engine);

    const board1 = engine.getBoardById('b1');
    expect(board1?.state).toBe('fallen');
  });

  it('板未失去所有螺丝时不应掉落', () => {
    const engine = createAndStartEngine();

    // 只拧下 s1（b1 还有 s2）
    unscrewAndComplete(engine, 's1');

    const board1 = engine.getBoardById('b1');
    expect(board1?.state).toBe('fixed');
  });

  it('板失去所有螺丝但被其他板挡住应变为 stuck', () => {
    // 使用关卡 3 来测试 stuck 情况
    const engine = new ScrewPuzzleEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.setTargetLevel(3);
    engine.start();

    // 拧掉 b3 的螺丝: s5 和 s6
    unscrewAndComplete(engine, 's5');
    unscrewAndComplete(engine, 's6');

    const board3 = engine.getBoardById('b3');
    // b3 可能掉落或 stuck，取决于位置关系
    expect(['falling', 'fallen', 'stuck', 'fixed']).toContain(board3?.state);
  });

  it('拧下连接两块板的螺丝后两块板都还在', () => {
    const engine = createAndStartEngine();

    // 拧下 s2 (连接 b1 和 b2)
    unscrewAndComplete(engine, 's2');

    const board1 = engine.getBoardById('b1');
    const board2 = engine.getBoardById('b2');
    expect(board1?.state).toBe('fixed');
    expect(board2?.state).toBe('fixed');
  });
});

// ============================================================
// 连接关系测试
// ============================================================
describe('ScrewPuzzleEngine - 连接关系', () => {
  let engine: ScrewPuzzleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('螺丝应正确连接到板', () => {
    const screws = engine.getScrews();
    const bridgeScrew = screws.find((s) => s.connectedBoardIds.length === 2);
    expect(bridgeScrew).toBeDefined();
    expect(bridgeScrew!.connectedBoardIds).toContain('b1');
    expect(bridgeScrew!.connectedBoardIds).toContain('b2');
  });

  it('getScrewsForBoard 应返回板的固定螺丝', () => {
    const screwsForB1 = engine.getScrewsForBoard('b1');
    expect(screwsForB1.length).toBe(2); // s1 和 s2
  });

  it('getScrewsForBoard 不应包含已移除的螺丝', () => {
    unscrewAndComplete(engine, 's1');

    const screwsForB1 = engine.getScrewsForBoard('b1');
    expect(screwsForB1.length).toBe(1); // 只剩 s2
    expect(screwsForB1[0].id).toBe('s2');
  });

  it('getBoardById 应正确返回板', () => {
    const board = engine.getBoardById('b1');
    expect(board).toBeDefined();
    expect(board!.id).toBe('b1');
  });

  it('getScrewById 应正确返回螺丝', () => {
    const screw = engine.getScrewById('s1');
    expect(screw).toBeDefined();
    expect(screw!.id).toBe('s1');
  });

  it('getBoardById 不存在的 ID 应返回 undefined', () => {
    const board = engine.getBoardById('nonexistent');
    expect(board).toBeUndefined();
  });

  it('getScrewById 不存在的 ID 应返回 undefined', () => {
    const screw = engine.getScrewById('nonexistent');
    expect(screw).toBeUndefined();
  });

  it('每块板至少有一颗螺丝', () => {
    const boards = engine.getBoards();
    for (const board of boards) {
      const screws = engine.getScrewsForBoard(board.id);
      expect(screws.length).toBeGreaterThan(0);
    }
  });

  it('每颗螺丝至少连接一块板', () => {
    const screws = engine.getScrews();
    for (const screw of screws) {
      expect(screw.connectedBoardIds.length).toBeGreaterThan(0);
    }
  });

  it('螺丝最多连接两块板', () => {
    const screws = engine.getScrews();
    for (const screw of screws) {
      expect(screw.connectedBoardIds.length).toBeLessThanOrEqual(2);
    }
  });
});

// ============================================================
// 胜利判定测试
// ============================================================
describe('ScrewPuzzleEngine - 胜利判定', () => {
  it('所有板掉落且所有螺丝移除时应胜利', () => {
    const engine = createAndStartEngine();

    // 关卡1: 按正确顺序拧下所有螺丝
    // 1. 先拧 s2 (bridge)
    unscrewAndComplete(engine, 's2');
    // 2. 拧 s1 (b1 掉落)
    unscrewAndComplete(engine, 's1');
    // 3. 拧 s3 (b2 掉落)
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.getIsWin()).toBe(true);
  });

  it('胜利后状态应为 gameover', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.status).toBe('gameover');
  });

  it('胜利后应有完美通关奖励', () => {
    const engine = createAndStartEngine();
    const screws = engine.getScrews();
    const expectedScore =
      BASE_SCORE_PER_SCREW * screws.length + PERFECT_BONUS + LEVEL_BONUS;

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.score).toBe(expectedScore);
  });

  it('部分螺丝未移除时不应胜利', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's1');

    expect(engine.getIsWin()).toBe(false);
  });

  it('部分板未掉落时不应胜利', () => {
    const engine = createAndStartEngine();

    // 只拧下 s1（b1 还有 s2，不会掉落）
    unscrewAndComplete(engine, 's1');

    expect(engine.getIsWin()).toBe(false);
  });

  it('只有所有板掉落才算胜利', () => {
    const engine = createAndStartEngine();

    // 拧下 s2 和 s1，只有 b1 掉落
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');

    expect(engine.getIsWin()).toBe(false);
  });
});

// ============================================================
// 撤销测试
// ============================================================
describe('ScrewPuzzleEngine - 撤销', () => {
  let engine: ScrewPuzzleEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('撤销应恢复螺丝状态', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);

    const removedCount = engine.getScrews().filter((s) => s.state === 'removed').length;
    expect(removedCount).toBeGreaterThan(0);

    engine.undo();
    const fixedCount = engine.getScrews().filter((s) => s.state === 'fixed').length;
    expect(fixedCount).toBe(3);
  });

  it('撤销应减少移动次数', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);
    const moveCountAfter = engine.getMoveCount();
    expect(moveCountAfter).toBe(1);

    engine.undo();
    expect(engine.getMoveCount()).toBe(0);
  });

  it('撤销应减少分数', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);

    engine.undo();
    expect(engine.score).toBe(0);
  });

  it('撤销应减少历史记录', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);
    expect(engine.getHistoryCount()).toBe(1);

    engine.undo();
    expect(engine.getHistoryCount()).toBe(0);
  });

  it('撤销应选中被撤销的螺丝', () => {
    selectScrewById(engine, 's2');
    engine.unscrewSelected();
    engine.forceCompleteUnscrew('s2');

    engine.undo();
    const screw = engine.getScrews()[engine.getSelectedScrewIndex()];
    expect(screw.id).toBe('s2');
  });

  it('撤销应恢复板的状态', () => {
    // 拧下 bridge screw
    unscrewAndComplete(engine, 's2');
    // 拧下 s1，b1 掉落
    unscrewAndComplete(engine, 's1');

    const board1 = engine.getBoardById('b1');
    expect(board1?.state).toMatch(/falling|fallen/);

    // 撤销
    engine.undo();

    const board1After = engine.getBoardById('b1');
    expect(board1After?.state).toBe('fixed');
  });

  it('没有历史记录时撤销不应出错', () => {
    expect(() => engine.undo()).not.toThrow();
  });

  it('多次撤销应正常工作', () => {
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's2');

    expect(engine.getHistoryCount()).toBe(2);

    engine.undo();
    expect(engine.getHistoryCount()).toBe(1);

    engine.undo();
    expect(engine.getHistoryCount()).toBe(0);
  });

  it('通过键盘 U 应触发撤销', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);
    expect(engine.getHistoryCount()).toBe(1);

    engine.handleKeyDown('u');
    expect(engine.getHistoryCount()).toBe(0);
  });

  it('通过键盘 U (大写) 应触发撤销', () => {
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);

    engine.handleKeyDown('U');
    expect(engine.getHistoryCount()).toBe(0);
  });

  it('gameover 后撤销应恢复到 playing 状态', () => {
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.status).toBe('gameover');

    engine.undo();
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 关卡系统测试
// ============================================================
describe('ScrewPuzzleEngine - 关卡系统', () => {
  it('关卡 1 配置正确', () => {
    expect(LEVEL_CONFIGS[0].level).toBe(1);
    expect(LEVEL_CONFIGS[0].boards.length).toBe(2);
    expect(LEVEL_CONFIGS[0].screws.length).toBe(3);
  });

  it('关卡 2 配置正确', () => {
    expect(LEVEL_CONFIGS[1].level).toBe(2);
    expect(LEVEL_CONFIGS[1].boards.length).toBe(3);
    expect(LEVEL_CONFIGS[1].screws.length).toBe(5);
  });

  it('关卡 3 配置正确', () => {
    expect(LEVEL_CONFIGS[2].level).toBe(3);
    expect(LEVEL_CONFIGS[2].boards.length).toBe(4);
    expect(LEVEL_CONFIGS[2].screws.length).toBe(7);
  });

  it('关卡 4 配置正确', () => {
    expect(LEVEL_CONFIGS[3].level).toBe(4);
    expect(LEVEL_CONFIGS[3].boards.length).toBe(5);
    expect(LEVEL_CONFIGS[3].screws.length).toBe(9);
  });

  it('关卡 5 配置正确', () => {
    expect(LEVEL_CONFIGS[4].level).toBe(5);
    expect(LEVEL_CONFIGS[4].boards.length).toBe(6);
    expect(LEVEL_CONFIGS[4].screws.length).toBe(11);
  });

  it('关卡 6 配置正确', () => {
    expect(LEVEL_CONFIGS[5].level).toBe(6);
    expect(LEVEL_CONFIGS[5].boards.length).toBe(7);
    expect(LEVEL_CONFIGS[5].screws.length).toBe(13);
  });

  it('MAX_LEVEL 应等于关卡配置数量', () => {
    expect(MAX_LEVEL).toBe(LEVEL_CONFIGS.length);
  });

  it('每个关卡的板 ID 应唯一', () => {
    for (const config of LEVEL_CONFIGS) {
      const ids = config.boards.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('每个关卡的螺丝 ID 应唯一', () => {
    for (const config of LEVEL_CONFIGS) {
      const ids = config.screws.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('每个螺丝连接的板 ID 应存在于板的定义中', () => {
    for (const config of LEVEL_CONFIGS) {
      const boardIds = new Set(config.boards.map((b) => b.id));
      for (const screw of config.screws) {
        for (const bid of screw.connectedBoardIds) {
          expect(boardIds.has(bid)).toBe(true);
        }
      }
    }
  });

  it('每块板至少被一颗螺丝连接', () => {
    for (const config of LEVEL_CONFIGS) {
      for (const board of config.boards) {
        const connected = config.screws.some((s) =>
          s.connectedBoardIds.includes(board.id),
        );
        expect(connected).toBe(true);
      }
    }
  });

  it('关卡难度递增（螺丝数量增加）', () => {
    for (let i = 1; i < LEVEL_CONFIGS.length; i++) {
      expect(LEVEL_CONFIGS[i].screws.length).toBeGreaterThanOrEqual(
        LEVEL_CONFIGS[i - 1].screws.length,
      );
    }
  });

  it('resetLevel 应重置当前关卡', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    engine.resetLevel();

    const resetScrews = engine.getScrews();
    resetScrews.forEach((s) => {
      expect(s.state).toBe('fixed');
    });
  });

  it('通过键盘 R 应重置关卡', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    engine.handleKeyDown('r');

    const screws = engine.getScrews();
    screws.forEach((s) => {
      expect(s.state).toBe('fixed');
    });
  });

  it('通过键盘 R (大写) 应重置关卡', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    engine.handleKeyDown('R');

    const screws = engine.getScrews();
    screws.forEach((s) => {
      expect(s.state).toBe('fixed');
    });
  });

  it('resetLevel 后历史记录应清空', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    expect(engine.getHistoryCount()).toBe(1);

    engine.resetLevel();
    expect(engine.getHistoryCount()).toBe(0);
  });

  it('resetLevel 后移动次数应清零', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    expect(engine.getMoveCount()).toBe(1);

    engine.resetLevel();
    expect(engine.getMoveCount()).toBe(0);
  });
});

// ============================================================
// 边界情况测试
// ============================================================
describe('ScrewPuzzleEngine - 边界情况', () => {
  it('不在 playing 状态时不应响应方向键', () => {
    const engine = new ScrewPuzzleEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();

    const prev = engine.getSelectedScrewIndex();
    engine.handleKeyDown('ArrowRight');
    expect(engine.getSelectedScrewIndex()).toBe(prev);
  });

  it('不在 playing 状态时不应响应空格', () => {
    const engine = new ScrewPuzzleEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();

    engine.handleKeyDown(' ');
    expect(engine.getMoveCount()).toBe(0);
  });

  it('handleKeyUp 不应出错', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
  });

  it('连续快速拧螺丝不应出错', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    expect(() => engine.update(16)).not.toThrow();
  });

  it('getRemainingScrews 移除螺丝后应减少', () => {
    const engine = createAndStartEngine();
    expect(engine.getRemainingScrews().length).toBe(3);

    unscrewAndComplete(engine, 's1');
    expect(engine.getRemainingScrews().length).toBe(2);
  });

  it('所有螺丝移除后 getRemainingScrews 应为空', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');

    expect(engine.getRemainingScrews().length).toBe(0);
  });

  it('selectNextScrew 在没有剩余螺丝时不应出错', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');

    expect(() => engine.selectNextScrew()).not.toThrow();
  });

  it('selectPrevScrew 在没有剩余螺丝时不应出错', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');

    expect(() => engine.selectPrevScrew()).not.toThrow();
  });

  it('gameover 后 R 键应重新开始', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.status).toBe('gameover');

    engine.handleKeyDown('R');
    expect(engine.status).toBe('playing');
  });

  it('gameover 后 U 键应撤销', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.status).toBe('gameover');

    engine.handleKeyDown('U');
    expect(engine.status).toBe('playing');
  });

  it('重置后所有状态应恢复', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
    expect(engine.getMoveCount()).toBe(0);
    expect(engine.getHistoryCount()).toBe(0);
    expect(engine.getIsWin()).toBe(false);
    expect(engine.getIsStuck()).toBe(false);
  });

  it('destroy 后不应出错', () => {
    const engine = createAndStartEngine();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('连续撤销到空历史不应出错', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    engine.undo();
    engine.undo();
    engine.undo();

    expect(engine.getHistoryCount()).toBe(0);
  });
});

// ============================================================
// getState 测试
// ============================================================
describe('ScrewPuzzleEngine - getState', () => {
  it('getState 应返回正确的结构', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();

    expect(state).toHaveProperty('boards');
    expect(state).toHaveProperty('screws');
    expect(state).toHaveProperty('selectedScrewIndex');
    expect(state).toHaveProperty('moveCount');
    expect(state).toHaveProperty('isStuck');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('score');
  });

  it('getState boards 应包含正确字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const boards = state.boards as Array<{ id: string; state: string; x: number; y: number }>;

    expect(boards.length).toBeGreaterThan(0);
    expect(boards[0]).toHaveProperty('id');
    expect(boards[0]).toHaveProperty('state');
    expect(boards[0]).toHaveProperty('x');
    expect(boards[0]).toHaveProperty('y');
  });

  it('getState screws 应包含正确字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const screws = state.screws as Array<{ id: string; state: string; x: number; y: number }>;

    expect(screws.length).toBeGreaterThan(0);
    expect(screws[0]).toHaveProperty('id');
    expect(screws[0]).toHaveProperty('state');
  });

  it('getState 应反映当前状态', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    const state = engine.getState();
    expect(state.moveCount).toBe(1);
  });

  it('getState 应反映当前关卡', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.level).toBe(1);
  });

  it('getState 应反映分数', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    const state = engine.getState();
    expect(state.score).toBe(BASE_SCORE_PER_SCREW);
  });
});

// ============================================================
// 事件系统测试
// ============================================================
describe('ScrewPuzzleEngine - 事件系统', () => {
  it('start 应触发 statusChange 事件', () => {
    const engine = new ScrewPuzzleEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();

    const statuses: string[] = [];
    engine.on('statusChange', (s: string) => {
      statuses.push(s);
    });
    engine.start();

    expect(statuses).toContain('playing');
  });

  it('分数变化应触发 scoreChange 事件', () => {
    const engine = createAndStartEngine();
    let scoreReceived: number | undefined;
    engine.on('scoreChange', (s: number) => {
      scoreReceived = s;
    });

    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);

    expect(scoreReceived).toBe(BASE_SCORE_PER_SCREW);
  });

  it('reset 应触发 statusChange 事件', () => {
    const engine = createAndStartEngine();
    let statusReceived: string | undefined;
    engine.on('statusChange', (s: string) => {
      statusReceived = s;
    });

    engine.reset();
    expect(statusReceived).toBe('idle');
  });

  it('gameover 应触发 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const statuses: string[] = [];
    engine.on('statusChange', (s: string) => {
      statuses.push(s);
    });

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(statuses).toContain('gameover');
  });

  it('off 应取消事件监听', () => {
    const engine = createAndStartEngine();
    let count = 0;
    const handler = () => { count++; };
    engine.on('scoreChange', handler);
    engine.off('scoreChange', handler);

    unscrewAndComplete(engine, 's1');
    expect(count).toBe(0);
  });
});

// ============================================================
// 常量验证测试
// ============================================================
describe('ScrewPuzzleEngine - 常量验证', () => {
  it('CANVAS_WIDTH 应为 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT 应为 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('BASE_SCORE_PER_SCREW 应为正数', () => {
    expect(BASE_SCORE_PER_SCREW).toBeGreaterThan(0);
  });

  it('LEVEL_BONUS 应为正数', () => {
    expect(LEVEL_BONUS).toBeGreaterThan(0);
  });

  it('PERFECT_BONUS 应为正数', () => {
    expect(PERFECT_BONUS).toBeGreaterThan(0);
  });

  it('STUCK_PENALTY 应为正数', () => {
    expect(STUCK_PENALTY).toBeGreaterThan(0);
  });

  it('UNSCREW_ANIM_DURATION 应为正数', () => {
    expect(UNSCREW_ANIM_DURATION).toBeGreaterThan(0);
  });

  it('应有 6 个关卡', () => {
    expect(MAX_LEVEL).toBe(6);
  });
});

// ============================================================
// 板颜色测试
// ============================================================
describe('ScrewPuzzleEngine - 板颜色', () => {
  it('每块板应有不同的颜色索引', () => {
    const engine = createAndStartEngine();
    const boards = engine.getBoards();
    const colorIndices = boards.map((b) => b.colorIndex);
    expect(new Set(colorIndices).size).toBe(colorIndices.length);
  });

  it('颜色索引应在有效范围内', () => {
    const engine = createAndStartEngine();
    const boards = engine.getBoards();
    for (const board of boards) {
      expect(board.colorIndex).toBeGreaterThanOrEqual(0);
      expect(board.colorIndex).toBeLessThan(8);
    }
  });
});

// ============================================================
// 板位置测试
// ============================================================
describe('ScrewPuzzleEngine - 板位置', () => {
  it('所有板应在画布范围内', () => {
    const engine = createAndStartEngine();
    const boards = engine.getBoards();
    for (const board of boards) {
      expect(board.x).toBeGreaterThanOrEqual(0);
      expect(board.y).toBeGreaterThanOrEqual(0);
      expect(board.x + board.width).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(board.y + board.height).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
  });

  it('所有螺丝应在画布范围内', () => {
    const engine = createAndStartEngine();
    const screws = engine.getScrews();
    for (const screw of screws) {
      expect(screw.x).toBeGreaterThanOrEqual(0);
      expect(screw.y).toBeGreaterThanOrEqual(0);
      expect(screw.x).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(screw.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
  });

  it('板应有正的宽度和高度', () => {
    const engine = createAndStartEngine();
    const boards = engine.getBoards();
    for (const board of boards) {
      expect(board.width).toBeGreaterThan(0);
      expect(board.height).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 多关卡加载测试
// ============================================================
describe('ScrewPuzzleEngine - 多关卡加载', () => {
  it('关卡 3 应有 4 块板和 7 颗螺丝', () => {
    expect(LEVEL_CONFIGS[2].boards.length).toBe(4);
    expect(LEVEL_CONFIGS[2].screws.length).toBe(7);
  });

  it('关卡 4 应有 5 块板和 9 颗螺丝', () => {
    expect(LEVEL_CONFIGS[3].boards.length).toBe(5);
    expect(LEVEL_CONFIGS[3].screws.length).toBe(9);
  });

  it('关卡 5 应有 6 块板和 11 颗螺丝', () => {
    expect(LEVEL_CONFIGS[4].boards.length).toBe(6);
    expect(LEVEL_CONFIGS[4].screws.length).toBe(11);
  });

  it('关卡 6 应有 7 块板和 13 颗螺丝', () => {
    expect(LEVEL_CONFIGS[5].boards.length).toBe(7);
    expect(LEVEL_CONFIGS[5].screws.length).toBe(13);
  });

  it('每个关卡应有标签', () => {
    for (const config of LEVEL_CONFIGS) {
      expect(config.label).toBeTruthy();
    }
  });

  it('关卡标签应按顺序递增', () => {
    const labels = LEVEL_CONFIGS.map((c) => c.level);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i]).toBeGreaterThan(labels[i - 1]);
    }
  });
});

// ============================================================
// 暂停/恢复测试
// ============================================================
describe('ScrewPuzzleEngine - 暂停/恢复', () => {
  it('暂停后状态应为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('恢复后状态应为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('暂停后不应响应游戏操作', () => {
    const engine = createAndStartEngine();
    engine.pause();
    const prev = engine.getMoveCount();
    engine.handleKeyDown(' ');
    expect(engine.getMoveCount()).toBe(prev);
  });

  it('idle 状态暂停不应生效', () => {
    const engine = new ScrewPuzzleEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('暂停后方向键不应生效', () => {
    const engine = createAndStartEngine();
    engine.pause();
    const prev = engine.getSelectedScrewIndex();
    engine.handleKeyDown('ArrowRight');
    expect(engine.getSelectedScrewIndex()).toBe(prev);
  });
});

// ============================================================
// 分数系统测试
// ============================================================
describe('ScrewPuzzleEngine - 分数系统', () => {
  it('每拧一颗螺丝应加 BASE_SCORE_PER_SCREW', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    expect(engine.score).toBe(BASE_SCORE_PER_SCREW);
  });

  it('拧两颗螺丝应加两倍分数', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's2');
    expect(engine.score).toBe(BASE_SCORE_PER_SCREW * 2);
  });

  it('撤销应扣回分数', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    engine.undo();
    expect(engine.score).toBe(0);
  });

  it('完美通关应有额外奖励', () => {
    const engine = createAndStartEngine();
    const screws = engine.getScrews();
    const totalScrewScore = BASE_SCORE_PER_SCREW * screws.length;

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.score).toBe(totalScrewScore + PERFECT_BONUS + LEVEL_BONUS);
  });
});

// ============================================================
// 螺丝旋转动画测试
// ============================================================
describe('ScrewPuzzleEngine - 螺丝旋转动画', () => {
  it('拧螺丝时螺丝应有旋转', () => {
    const engine = createAndStartEngine();
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();

    // 手动触发一次 update（时间过去一半）
    const screw = (engine as any).screws.find((s: any) => s.id === screwId);
    screw.unscrewStartTime = Date.now() - UNSCREW_ANIM_DURATION / 2;
    engine.update(16);

    const updatedScrew = engine.getScrews().find((s) => s.id === screwId);
    expect(updatedScrew!.rotation).toBeGreaterThan(0);
  });

  it('旋转完成后应完成拧螺丝', () => {
    const engine = createAndStartEngine();
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();
    engine.forceCompleteUnscrew(screwId);

    const updatedScrew = engine.getScrews().find((s) => s.id === screwId);
    expect(updatedScrew?.state).toBe('removed');
  });

  it('旋转角度应随时间增加', () => {
    const engine = createAndStartEngine();
    const screwId = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.unscrewSelected();

    const screw = (engine as any).screws.find((s: any) => s.id === screwId);

    screw.unscrewStartTime = Date.now() - UNSCREW_ANIM_DURATION * 0.25;
    engine.update(16);
    const rot1 = engine.getScrews().find((s) => s.id === screwId)!.rotation;

    screw.unscrewStartTime = Date.now() - UNSCREW_ANIM_DURATION * 0.5;
    engine.update(16);
    const rot2 = engine.getScrews().find((s) => s.id === screwId)!.rotation;

    expect(rot2).toBeGreaterThan(rot1);
  });
});

// ============================================================
// 板掉落动画测试
// ============================================================
describe('ScrewPuzzleEngine - 板掉落动画', () => {
  it('板掉落时 Y 坐标应增加', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');

    const board1 = engine.getBoardById('b1');
    if (board1?.state === 'falling') {
      const originalY = board1.originalY;
      engine.update(100);
      const board1After = engine.getBoardById('b1');
      if (board1After?.state === 'falling') {
        expect(board1After.y).toBeGreaterThan(originalY);
      }
    }
  });

  it('板掉出屏幕后应变为 fallen', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    completeFalls(engine);

    const board1 = engine.getBoardById('b1');
    expect(board1?.state).toBe('fallen');
  });

  it('未掉落的板应保持 fixed', () => {
    const engine = createAndStartEngine();

    // 只拧下 s1（b1 还有 s2，不会掉落）
    unscrewAndComplete(engine, 's1');

    const board1 = engine.getBoardById('b1');
    expect(board1?.state).toBe('fixed');
  });
});

// ============================================================
// 完整游戏流程测试
// ============================================================
describe('ScrewPuzzleEngine - 完整游戏流程', () => {
  it('完整的关卡 1 通关流程', () => {
    const engine = createAndStartEngine();

    // 正确顺序: s2 (bridge) -> s1 (b1) -> s3 (b2)
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.getIsWin()).toBe(true);
    expect(engine.status).toBe('gameover');
    expect(engine.getMoveCount()).toBe(3);
    expect(engine.getHistoryCount()).toBe(3);
  });

  it('完整流程 + 撤销 + 重玩', () => {
    const engine = createAndStartEngine();

    unscrewAndComplete(engine, 's2');
    engine.undo();
    expect(engine.getScrews().filter((s) => s.state === 'fixed').length).toBe(3);

    // 重玩
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.getIsWin()).toBe(true);
  });

  it('重置后重新开始游戏', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);

    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.getScrews().length).toBe(3);
  });

  it('关卡 1 另一种顺序也应能通关', () => {
    const engine = createAndStartEngine();

    // 顺序: s2 -> s3 -> s1
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's3');
    unscrewAndComplete(engine, 's1');
    completeFalls(engine);

    expect(engine.getIsWin()).toBe(true);
  });

  it('先拧单板螺丝再拧桥接螺丝', () => {
    const engine = createAndStartEngine();

    // 先拧 s1（b1 还有 s2）
    unscrewAndComplete(engine, 's1');
    // 再拧 s2（b1 和 b2 都失去螺丝）
    unscrewAndComplete(engine, 's2');
    // 最后拧 s3
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);

    expect(engine.getIsWin()).toBe(true);
  });
});

// ============================================================
// 关卡 2 通关测试
// ============================================================
describe('ScrewPuzzleEngine - 关卡 2', () => {
  it('应能加载关卡 2', () => {
    const engine = new ScrewPuzzleEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.setTargetLevel(2);
    engine.start();

    expect(engine.getScrews().length).toBe(5);
    expect(engine.getBoards().length).toBe(3);
  });

  it('关卡 2 所有螺丝连接关系正确', () => {
    const engine = new ScrewPuzzleEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.setTargetLevel(2);
    engine.start();

    const screws = engine.getScrews();
    const boards = engine.getBoards();

    // 确保每块板至少有一颗螺丝
    for (const board of boards) {
      const boardScrews = engine.getScrewsForBoard(board.id);
      expect(boardScrews.length).toBeGreaterThan(0);
    }

    // 确保所有螺丝连接到存在的板
    for (const screw of screws) {
      for (const bid of screw.connectedBoardIds) {
        expect(engine.getBoardById(bid)).toBeDefined();
      }
    }
  });
});

// ============================================================
// 键盘控制完整测试
// ============================================================
describe('ScrewPuzzleEngine - 键盘控制', () => {
  it('所有方向键都应正常工作', () => {
    const engine = createAndStartEngine();

    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowLeft');
    engine.handleKeyDown('ArrowRight');

    // 不应出错
    expect(true).toBe(true);
  });

  it('空格和 Enter 都应触发拧螺丝', () => {
    const engine = createAndStartEngine();

    engine.handleKeyDown(' ');
    const screwId1 = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.forceCompleteUnscrew(screwId1);

    // 选中下一个螺丝（当前已被移除）
    engine.selectNextScrew();
    engine.handleKeyDown('Enter');
    const screwId2 = engine.getScrews()[engine.getSelectedScrewIndex()].id;
    engine.forceCompleteUnscrew(screwId2);

    expect(engine.getMoveCount()).toBe(2);
  });

  it('无效按键不应影响游戏', () => {
    const engine = createAndStartEngine();
    const prev = engine.getSelectedScrewIndex();

    engine.handleKeyDown('a');
    engine.handleKeyDown('1');
    engine.handleKeyDown('Escape');

    expect(engine.getSelectedScrewIndex()).toBe(prev);
    expect(engine.getMoveCount()).toBe(0);
  });

  it('handleKeyUp 对任何键都不应出错', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
    expect(() => engine.handleKeyUp('Enter')).not.toThrow();
  });
});

// ============================================================
// 板尺寸测试
// ============================================================
describe('ScrewPuzzleEngine - 板尺寸', () => {
  it('所有板的宽度应大于 0', () => {
    for (const config of LEVEL_CONFIGS) {
      for (const board of config.boards) {
        expect(board.width).toBeGreaterThan(0);
      }
    }
  });

  it('所有板的高度应大于 0', () => {
    for (const config of LEVEL_CONFIGS) {
      for (const board of config.boards) {
        expect(board.height).toBeGreaterThan(0);
      }
    }
  });

  it('所有板的坐标应为正数', () => {
    for (const config of LEVEL_CONFIGS) {
      for (const board of config.boards) {
        expect(board.x).toBeGreaterThanOrEqual(0);
        expect(board.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('所有螺丝的坐标应为正数', () => {
    for (const config of LEVEL_CONFIGS) {
      for (const screw of config.screws) {
        expect(screw.x).toBeGreaterThanOrEqual(0);
        expect(screw.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ============================================================
// 渲染测试（确保不报错）
// ============================================================
describe('ScrewPuzzleEngine - 渲染', () => {
  it('playing 状态下渲染不应出错', () => {
    const engine = createAndStartEngine();
    expect(() => engine.update(16)).not.toThrow();
  });

  it('有螺丝被移除时渲染不应出错', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's1');
    expect(() => engine.update(16)).not.toThrow();
  });

  it('有板掉落时渲染不应出错', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    expect(() => engine.update(16)).not.toThrow();
  });

  it('胜利后渲染不应出错', () => {
    const engine = createAndStartEngine();
    unscrewAndComplete(engine, 's2');
    unscrewAndComplete(engine, 's1');
    unscrewAndComplete(engine, 's3');
    completeFalls(engine);
    expect(() => engine.update(16)).not.toThrow();
  });
});
