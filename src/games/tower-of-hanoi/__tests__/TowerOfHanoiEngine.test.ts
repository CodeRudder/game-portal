/**
 * TowerOfHanoiEngine 综合测试
 * 覆盖：初始化、盘子分布、移动逻辑、规则验证、胜利条件、
 *       光标控制、选择机制、动画、盘数调整、状态管理、
 *       handleKeyDown/Up、getState、渲染、常量验证
 */
import { TowerOfHanoiEngine } from '../TowerOfHanoiEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  MIN_DISKS, MAX_DISKS, DEFAULT_DISKS,
  PEG_COUNT, PEG_WIDTH, PEG_HEIGHT, PEG_BASE_WIDTH, PEG_BASE_HEIGHT,
  PEG_POSITIONS, PEG_BOTTOM_Y,
  DISK_MIN_WIDTH, DISK_MAX_WIDTH, DISK_HEIGHT, DISK_GAP,
  DISK_COLORS,
  MOVE_ANIMATION_DURATION,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建一个带 mock context 的 canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): TowerOfHanoiEngine {
  const engine = new TowerOfHanoiEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(diskCount: number = DEFAULT_DISKS): TowerOfHanoiEngine {
  const engine = createEngine();
  if (diskCount !== DEFAULT_DISKS) {
    engine.setDiskCount(diskCount);
  }
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: TowerOfHanoiEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: TowerOfHanoiEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: TowerOfHanoiEngine, deltaTime: number) {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 推进动画直到完成 */
function advanceAnimation(engine: TowerOfHanoiEngine) {
  callUpdate(engine, MOVE_ANIMATION_DURATION + 100);
}

/** 执行一次合法移动（含动画完成） */
function performMove(engine: TowerOfHanoiEngine, from: number, to: number) {
  engine.tryMove(from, to);
  advanceAnimation(engine);
}

// ============================================================
// 1. 初始化
// ============================================================
describe('TowerOfHanoiEngine - 初始化', () => {
  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('init 后分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('init 后等级为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('init 后移动次数为 0', () => {
    const engine = createEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('init 后盘数为 DEFAULT_DISKS', () => {
    const engine = createEngine();
    expect(engine.diskCount).toBe(DEFAULT_DISKS);
  });

  it('init 后光标在第 0 根柱子', () => {
    const engine = createEngine();
    expect(engine.selectedPeg).toBe(0);
  });

  it('init 后选择阶段为 none', () => {
    const engine = createEngine();
    expect(engine.selectionPhase).toBe('none');
  });

  it('init 后 sourcePeg 为 -1', () => {
    const engine = createEngine();
    expect(engine.sourcePeg).toBe(-1);
  });

  it('init 后 isWin 为 false', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('init 后不在动画中', () => {
    const engine = createEngine();
    expect(engine.animating).toBe(false);
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('TowerOfHanoiEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后所有盘在第一根柱子', () => {
    const engine = createAndStartEngine();
    expect(engine.pegs[0].length).toBe(DEFAULT_DISKS);
    expect(engine.pegs[1].length).toBe(0);
    expect(engine.pegs[2].length).toBe(0);
  });

  it('start 后盘子从大到小排列', () => {
    const engine = createAndStartEngine();
    const peg0 = engine.pegs[0];
    for (let i = 0; i < peg0.length - 1; i++) {
      expect(peg0[i].size).toBeGreaterThan(peg0[i + 1].size);
    }
  });

  it('start 后移动次数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('start 后光标在第 0 根柱子', () => {
    const engine = createAndStartEngine();
    expect(engine.selectedPeg).toBe(0);
  });

  it('start 后选择阶段为 none', () => {
    const engine = createAndStartEngine();
    expect(engine.selectionPhase).toBe('none');
  });

  it('start 发出 statusChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('start 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isWin).toBe(false);
  });

  it('start 后不在动画中', () => {
    const engine = createAndStartEngine();
    expect(engine.animating).toBe(false);
  });
});

// ============================================================
// 3. 盘子初始化
// ============================================================
describe('TowerOfHanoiEngine - 盘子初始化', () => {
  it('3 个盘：第一柱有 [3,2,1]', () => {
    const engine = createAndStartEngine(3);
    expect(engine.pegs[0].map(d => d.size)).toEqual([3, 2, 1]);
  });

  it('4 个盘：第一柱有 [4,3,2,1]', () => {
    const engine = createAndStartEngine(4);
    expect(engine.pegs[0].map(d => d.size)).toEqual([4, 3, 2, 1]);
  });

  it('8 个盘：第一柱有 [8,7,...,1]', () => {
    const engine = createAndStartEngine(8);
    expect(engine.pegs[0].map(d => d.size)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('最小盘数为 MIN_DISKS', () => {
    const engine = createAndStartEngine(1); // 低于最小值
    expect(engine.diskCount).toBe(MIN_DISKS);
  });

  it('最大盘数为 MAX_DISKS', () => {
    const engine = createAndStartEngine(20); // 高于最大值
    expect(engine.diskCount).toBe(MAX_DISKS);
  });

  it('盘数恰好为 MIN_DISKS', () => {
    const engine = createAndStartEngine(MIN_DISKS);
    expect(engine.diskCount).toBe(MIN_DISKS);
    expect(engine.pegs[0].length).toBe(MIN_DISKS);
  });

  it('盘数恰好为 MAX_DISKS', () => {
    const engine = createAndStartEngine(MAX_DISKS);
    expect(engine.diskCount).toBe(MAX_DISKS);
    expect(engine.pegs[0].length).toBe(MAX_DISKS);
  });

  it('第二、三柱为空', () => {
    const engine = createAndStartEngine();
    expect(engine.pegs[1].length).toBe(0);
    expect(engine.pegs[2].length).toBe(0);
  });
});

// ============================================================
// 4. 最少步数计算
// ============================================================
describe('TowerOfHanoiEngine - 最少步数', () => {
  it('3 盘最少步数为 7', () => {
    const engine = createAndStartEngine(3);
    expect(engine.minMoves).toBe(7);
  });

  it('4 盘最少步数为 15', () => {
    const engine = createAndStartEngine(4);
    expect(engine.minMoves).toBe(15);
  });

  it('5 盘最少步数为 31', () => {
    const engine = createAndStartEngine(5);
    expect(engine.minMoves).toBe(31);
  });

  it('8 盘最少步数为 255', () => {
    const engine = createAndStartEngine(8);
    expect(engine.minMoves).toBe(255);
  });

  it('公式为 2^n - 1', () => {
    for (let n = MIN_DISKS; n <= MAX_DISKS; n++) {
      const engine = createAndStartEngine(n);
      expect(engine.minMoves).toBe(Math.pow(2, n) - 1);
    }
  });
});

// ============================================================
// 5. 合法移动
// ============================================================
describe('TowerOfHanoiEngine - 合法移动', () => {
  it('从空柱移动返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.tryMove(1, 0)).toBe(false);
  });

  it('从非空柱移到空柱返回 true', () => {
    const engine = createAndStartEngine();
    expect(engine.tryMove(0, 1)).toBe(true);
  });

  it('小盘移到大盘上返回 true', () => {
    const engine = createAndStartEngine();
    // 先移最小盘(1)到柱2
    engine.tryMove(0, 2);
    advanceAnimation(engine);
    // 再移次小盘(2)到柱1
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    // 把盘1移到盘2上
    expect(engine.tryMove(2, 1)).toBe(true);
  });

  it('大盘移到小盘上返回 false', () => {
    const engine = createAndStartEngine();
    // 先移最小盘(1)到柱1
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    // 尝试把盘2移到盘1上 → 非法
    expect(engine.tryMove(0, 1)).toBe(false);
  });

  it('同一柱子移动返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.tryMove(0, 0)).toBe(false);
  });

  it('非法柱子索引返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.tryMove(-1, 0)).toBe(false);
    expect(engine.tryMove(0, -1)).toBe(false);
    expect(engine.tryMove(3, 0)).toBe(false);
    expect(engine.tryMove(0, 3)).toBe(false);
  });

  it('移动后盘子从源柱移除', () => {
    const engine = createAndStartEngine();
    const beforeLen = engine.pegs[0].length;
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    expect(engine.pegs[0].length).toBe(beforeLen - 1);
  });

  it('移动后盘子出现在目标柱', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    expect(engine.pegs[1].length).toBe(1);
  });

  it('移动的是顶部盘子（最小的）', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    // 默认 4 盘，顶部是 size=1
    expect(engine.pegs[1][0].size).toBe(1);
  });

  it('移动后移动计数增加', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    expect(engine.moveCount).toBe(1);
  });

  it('多次移动计数累计', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    expect(engine.moveCount).toBe(3);
  });

  it('非法移动不计入计数', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 0); // 同一柱子
    expect(engine.moveCount).toBe(0);
  });

  it('非 playing 状态不能移动', () => {
    const engine = createEngine();
    expect(engine.tryMove(0, 1)).toBe(false);
  });

  it('动画中不能移动', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    // 不推进动画
    expect(engine.tryMove(0, 2)).toBe(false);
  });
});

// ============================================================
// 6. 胜利条件
// ============================================================
describe('TowerOfHanoiEngine - 胜利条件', () => {
  it('3 盘最优解（7 步）胜利', () => {
    const engine = createAndStartEngine(3);
    // 经典最优解
    performMove(engine, 0, 2); // 1→C
    performMove(engine, 0, 1); // 2→B
    performMove(engine, 2, 1); // 1→B
    performMove(engine, 0, 2); // 3→C
    performMove(engine, 1, 0); // 1→A
    performMove(engine, 1, 2); // 2→C
    performMove(engine, 0, 2); // 1→C
    expect(engine.isWin).toBe(true);
    expect(engine.status).toBe('gameover');
  });

  it('胜利时移动次数等于最少步数（最优解）', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.moveCount).toBe(engine.minMoves);
  });

  it('未完成时 isWin 为 false', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    expect(engine.isWin).toBe(false);
  });

  it('所有盘在第二柱不算胜利', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 0);
    performMove(engine, 2, 1);
    performMove(engine, 0, 1);
    // 所有盘在柱1（第二柱）
    expect(engine.pegs[1].length).toBe(3);
    expect(engine.isWin).toBe(false);
  });

  it('胜利后发出 statusChange gameover 事件', () => {
    const engine = createAndStartEngine(3);
    const handler = jest.fn();
    engine.on('statusChange', handler);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(handler).toHaveBeenCalledWith('gameover');
  });

  it('checkWin 在未完成时返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.checkWin()).toBe(false);
  });

  it('胜利后 score 等于移动次数', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.score).toBe(7);
  });
});

// ============================================================
// 7. 光标控制
// ============================================================
describe('TowerOfHanoiEngine - 光标控制', () => {
  let engine: TowerOfHanoiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始光标在柱子 0', () => {
    expect(engine.selectedPeg).toBe(0);
  });

  it('ArrowRight 光标右移', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPeg).toBe(1);
  });

  it('ArrowLeft 光标左移', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowLeft');
    expect(engine.selectedPeg).toBe(0);
  });

  it('d 键光标右移', () => {
    engine.handleKeyDown('d');
    expect(engine.selectedPeg).toBe(1);
  });

  it('D 键光标右移', () => {
    engine.handleKeyDown('D');
    expect(engine.selectedPeg).toBe(1);
  });

  it('a 键光标左移', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('a');
    expect(engine.selectedPeg).toBe(0);
  });

  it('A 键光标左移', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('A');
    expect(engine.selectedPeg).toBe(0);
  });

  it('光标不能超出左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.selectedPeg).toBe(0);
  });

  it('光标不能超出右边界', () => {
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPeg).toBe(2);
  });

  it('光标可以在三根柱子间移动', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPeg).toBe(1);
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPeg).toBe(2);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.selectedPeg).toBe(1);
  });
});

// ============================================================
// 8. 选择机制
// ============================================================
describe('TowerOfHanoiEngine - 选择机制', () => {
  let engine: TowerOfHanoiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空格选择源柱子', () => {
    engine.handleKeyDown(' '); // 柱0
    expect(engine.selectionPhase).toBe('source');
    expect(engine.sourcePeg).toBe(0);
  });

  it('Space 别名也能选择', () => {
    engine.handleKeyDown('Space');
    expect(engine.selectionPhase).toBe('source');
  });

  it('选择空柱子无效', () => {
    engine.handleKeyDown('ArrowRight'); // 柱1（空）
    engine.handleKeyDown(' ');
    expect(engine.selectionPhase).toBe('none');
  });

  it('选择后移动到合法目标完成移动', () => {
    engine.handleKeyDown(' '); // 选择柱0
    engine.handleKeyDown('ArrowRight'); // 到柱1
    engine.handleKeyDown(' '); // 确认目标
    advanceAnimation(engine);
    expect(engine.pegs[1].length).toBe(1);
    expect(engine.moveCount).toBe(1);
  });

  it('选择后移动到非法目标取消选择', () => {
    // 先移盘1到柱1
    performMove(engine, 0, 1);
    // 选择柱0（顶部是盘2）
    engine.handleKeyDown(' ');
    // 尝试放到柱1（顶部是盘1，盘2 > 盘1）
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown(' ');
    expect(engine.selectionPhase).toBe('none');
    expect(engine.moveCount).toBe(1); // 未增加
  });

  it('再次选择同一柱子取消选择', () => {
    engine.handleKeyDown(' '); // 选择柱0
    engine.handleKeyDown(' '); // 再次按同一柱0
    expect(engine.selectionPhase).toBe('none');
    expect(engine.sourcePeg).toBe(-1);
  });

  it('ESC 取消选择', () => {
    engine.handleKeyDown(' ');
    expect(engine.selectionPhase).toBe('source');
    engine.handleKeyDown('Escape');
    expect(engine.selectionPhase).toBe('none');
    expect(engine.sourcePeg).toBe(-1);
  });

  it('选择完成后 phase 重置为 none', () => {
    engine.handleKeyDown(' '); // 选择柱0
    engine.handleKeyDown('ArrowRight'); // 到柱1
    engine.handleKeyDown(' '); // 确认
    expect(engine.selectionPhase).toBe('none');
    expect(engine.sourcePeg).toBe(-1);
  });

  it('动画中不接受输入', () => {
    engine.tryMove(0, 1);
    // 动画中按键无效
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPeg).toBe(0);
  });
});

// ============================================================
// 9. 动画系统
// ============================================================
describe('TowerOfHanoiEngine - 动画系统', () => {
  it('移动后进入动画状态', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    expect(engine.animating).toBe(true);
  });

  it('动画完成后退出动画状态', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    advanceAnimation(engine);
    expect(engine.animating).toBe(false);
  });

  it('动画进度从 0 开始', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    const anim = getPrivate<{ progress: number } | null>(engine, '_animation');
    expect(anim).not.toBeNull();
    expect(anim!.progress).toBe(0);
  });

  it('动画进度逐渐增加到 1', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    callUpdate(engine, MOVE_ANIMATION_DURATION / 2);
    const anim = getPrivate<{ progress: number } | null>(engine, '_animation');
    expect(anim!.progress).toBeGreaterThan(0);
    expect(anim!.progress).toBeLessThan(1);
  });

  it('动画完成后盘子在目标柱上', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 2);
    advanceAnimation(engine);
    expect(engine.pegs[2].length).toBe(1);
    expect(engine.pegs[2][0].size).toBe(1);
  });

  it('动画期间源柱已移除盘子', () => {
    const engine = createAndStartEngine();
    const beforeLen = engine.pegs[0].length;
    engine.tryMove(0, 1);
    // 盘子已从源柱 pop
    expect(engine.pegs[0].length).toBe(beforeLen - 1);
  });

  it('动画未完成时盘子不在目标柱', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    callUpdate(engine, 10); // 只推进一点点
    expect(engine.pegs[1].length).toBe(0);
  });

  it('动画完成后 moveCount 增加', () => {
    const engine = createAndStartEngine();
    engine.tryMove(0, 1);
    // 动画未完成
    expect(engine.moveCount).toBe(0);
    advanceAnimation(engine);
    expect(engine.moveCount).toBe(1);
  });

  it('连续两次移动的动画顺序正确', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    expect(engine.pegs[2][0].size).toBe(1);
    performMove(engine, 0, 1);
    expect(engine.pegs[1][0].size).toBe(2);
  });
});

// ============================================================
// 10. 盘数调整
// ============================================================
describe('TowerOfHanoiEngine - 盘数调整', () => {
  it('idle 状态可以调整盘数', () => {
    const engine = createEngine();
    engine.setDiskCount(5);
    expect(engine.diskCount).toBe(5);
  });

  it('盘数不能低于 MIN_DISKS', () => {
    const engine = createEngine();
    engine.setDiskCount(1);
    expect(engine.diskCount).toBe(MIN_DISKS);
  });

  it('盘数不能超过 MAX_DISKS', () => {
    const engine = createEngine();
    engine.setDiskCount(20);
    expect(engine.diskCount).toBe(MAX_DISKS);
  });

  it('playing 状态不能调整盘数', () => {
    const engine = createAndStartEngine();
    engine.setDiskCount(5);
    expect(engine.diskCount).toBe(DEFAULT_DISKS);
  });

  it('调整盘数后柱子重新初始化', () => {
    const engine = createEngine();
    engine.setDiskCount(3);
    // 柱子应该有 3 个盘
    // 需要在 start 后验证
    engine.start();
    expect(engine.pegs[0].length).toBe(3);
  });

  it('调整相同盘数不触发事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('diskCountChange', handler);
    engine.setDiskCount(DEFAULT_DISKS);
    expect(handler).not.toHaveBeenCalled();
  });

  it('调整不同盘数触发 diskCountChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('diskCountChange', handler);
    engine.setDiskCount(5);
    expect(handler).toHaveBeenCalledWith(5);
  });

  it('边界值 MIN_DISKS 有效', () => {
    const engine = createEngine();
    engine.setDiskCount(MIN_DISKS);
    expect(engine.diskCount).toBe(MIN_DISKS);
  });

  it('边界值 MAX_DISKS 有效', () => {
    const engine = createEngine();
    engine.setDiskCount(MAX_DISKS);
    expect(engine.diskCount).toBe(MAX_DISKS);
  });
});

// ============================================================
// 11. 状态管理
// ============================================================
describe('TowerOfHanoiEngine - 状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('胜利后状态为 gameover', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.status).toBe('gameover');
  });

  it('idle 时不能 pause', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('playing 时不能 resume', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后移动次数清零', () => {
    const engine = createAndStartEngine();
    performMove(engine, 0, 1);
    engine.reset();
    expect(engine.moveCount).toBe(0);
  });

  it('reset 后柱子清空', () => {
    const engine = createAndStartEngine();
    performMove(engine, 0, 1);
    engine.reset();
    expect(engine.pegs[0].length).toBe(0);
    expect(engine.pegs[1].length).toBe(0);
    expect(engine.pegs[2].length).toBe(0);
  });

  it('reset 后 isWin 为 false', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    engine.reset();
    expect(engine.isWin).toBe(false);
  });

  it('reset 后光标回到柱0', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowRight');
    engine.reset();
    expect(engine.selectedPeg).toBe(0);
  });

  it('reset 后选择阶段为 none', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    engine.reset();
    expect(engine.selectionPhase).toBe('none');
  });

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCount = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCount);
  });

  it('pause/resume 发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 发出 statusChange idle 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 12. handleKeyDown / handleKeyUp
// ============================================================
describe('TowerOfHanoiEngine - handleKeyDown / handleKeyUp', () => {
  it('Space 在 idle 状态启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('Space 别名在 idle 状态启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('Space 在 gameover 状态重启游戏', () => {
    const engine = createAndStartEngine(3);
    // 完成游戏
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.moveCount).toBe(0);
  });

  it('paused 状态不处理方向键', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPeg).toBe(0);
  });

  it('未知按键不影响状态', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('x');
    expect(engine.selectedPeg).toBe(0);
    expect(engine.selectionPhase).toBe('none');
  });

  it('handleKeyUp 不影响状态', () => {
    const engine = createAndStartEngine();
    engine.handleKeyUp('ArrowRight');
    expect(engine.selectedPeg).toBe(0);
  });

  it('gameover 空格键别名也能重启', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 13. getState
// ============================================================
describe('TowerOfHanoiEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('diskCount');
    expect(state).toHaveProperty('moveCount');
    expect(state).toHaveProperty('minMoves');
    expect(state).toHaveProperty('selectedPeg');
    expect(state).toHaveProperty('selectionPhase');
    expect(state).toHaveProperty('sourcePeg');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('animating');
    expect(state).toHaveProperty('pegs');
  });

  it('初始状态值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.diskCount).toBe(DEFAULT_DISKS);
    expect(state.moveCount).toBe(0);
    expect(state.minMoves).toBe(Math.pow(2, DEFAULT_DISKS) - 1);
    expect(state.selectedPeg).toBe(0);
    expect(state.selectionPhase).toBe('none');
    expect(state.sourcePeg).toBe(-1);
    expect(state.isWin).toBe(false);
    expect(state.animating).toBe(false);
  });

  it('pegs 是序列化的盘子大小数组', () => {
    const engine = createAndStartEngine(3);
    const state = engine.getState();
    expect(state.pegs).toEqual([[3, 2, 1], [], []]);
  });

  it('移动后 getState 反映变化', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    const state = engine.getState();
    expect(state.moveCount).toBe(1);
    expect(state.pegs).toEqual([[3, 2], [], [1]]);
  });

  it('胜利后 isWin 正确', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    const state = engine.getState();
    expect(state.isWin).toBe(true);
    expect(state.score).toBe(7);
  });
});

// ============================================================
// 14. 事件系统
// ============================================================
describe('TowerOfHanoiEngine - 事件系统', () => {
  it('on 注册事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.off('test', handler);
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit 传递参数', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.emit('test', 'arg1', 42);
    expect(handler).toHaveBeenCalledWith('arg1', 42);
  });

  it('多次 on 同一事件注册多个监听', () => {
    const engine = createEngine();
    const h1 = jest.fn();
    const h2 = jest.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('移动时发出 scoreChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    performMove(engine, 0, 1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('多次移动 scoreChange 累计', () => {
    const engine = createAndStartEngine(3);
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    expect(handler).toHaveBeenCalledWith(1);
    expect(handler).toHaveBeenCalledWith(2);
  });
});

// ============================================================
// 15. 边界与异常场景
// ============================================================
describe('TowerOfHanoiEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new TowerOfHanoiEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续多次 start 不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });

  it('连续多次 reset 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('连续多次 pause 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => engine.pause()).not.toThrow();
  });

  it('未 pause 时 resume 不改变状态', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 时 pause 不改变状态', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('MIN_DISKS 盘的游戏可以正常完成', () => {
    const engine = createAndStartEngine(MIN_DISKS);
    // 3 盘最优解
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.isWin).toBe(true);
  });

  it('反复选择取消不影响游戏状态', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    expect(engine.moveCount).toBe(0);
    expect(engine.pegs[0].length).toBe(DEFAULT_DISKS);
  });

  it('快速连续合法移动不会丢失盘子', () => {
    const engine = createAndStartEngine(3);
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    const totalDisks = engine.pegs[0].length + engine.pegs[1].length + engine.pegs[2].length;
    expect(totalDisks).toBe(3);
  });

  it('paused 状态不处理空格确认', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.handleKeyDown(' ');
    expect(engine.selectionPhase).toBe('none');
  });
});

// ============================================================
// 16. 完整游戏流程
// ============================================================
describe('TowerOfHanoiEngine - 完整游戏流程', () => {
  it('4 盘完整游戏流程', () => {
    const engine = createAndStartEngine(4);
    // 4 盘最优解（15 步）：目标柱=2，辅助柱=1
    const moves: [number, number][] = [
      [0, 1], [0, 2], [1, 2],
      [0, 1], [2, 0], [2, 1], [0, 1],
      [0, 2], [1, 2], [1, 0], [2, 0],
      [1, 2], [0, 1], [0, 2], [1, 2],
    ];
    for (const [from, to] of moves) {
      performMove(engine, from, to);
    }
    expect(engine.isWin).toBe(true);
    expect(engine.moveCount).toBe(15);
    expect(engine.pegs[2].length).toBe(4);
  });

  it('5 盘完整游戏流程', () => {
    const engine = createAndStartEngine(5);
    // 5 盘最优解（31 步）
    const moves: [number, number][] = [
      [0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2],
      [0, 1], [2, 1], [2, 0], [1, 0], [2, 1], [0, 2], [0, 1], [2, 1],
      [0, 2], [1, 0], [1, 2], [0, 2], [1, 0], [2, 1], [2, 0], [1, 0],
      [1, 2], [0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2],
    ];
    for (const [from, to] of moves) {
      performMove(engine, from, to);
    }
    expect(engine.isWin).toBe(true);
    expect(engine.moveCount).toBe(31);
  });

  it('通过键盘操作完成 3 盘游戏', () => {
    const engine = createAndStartEngine(3);
    // 使用键盘操作
    // 0→2: 选择柱0，右移到柱2，确认
    engine.handleKeyDown(' '); // 选择柱0
    engine.handleKeyDown('ArrowRight'); // → 柱1
    engine.handleKeyDown('ArrowRight'); // → 柱2
    engine.handleKeyDown(' '); // 确认
    advanceAnimation(engine);

    // 0→1: 左移到柱0，选择，右移到柱1，确认
    engine.handleKeyDown('ArrowLeft'); // → 柱1
    engine.handleKeyDown('ArrowLeft'); // → 柱0
    engine.handleKeyDown(' '); // 选择柱0
    engine.handleKeyDown('ArrowRight'); // → 柱1
    engine.handleKeyDown(' '); // 确认
    advanceAnimation(engine);

    // 2→1: 右移到柱2，选择，左移到柱1，确认
    engine.handleKeyDown('ArrowRight'); // → 柱2
    engine.handleKeyDown('ArrowRight'); // → 柱2
    engine.handleKeyDown(' '); // 选择柱2
    engine.handleKeyDown('ArrowLeft'); // → 柱1
    engine.handleKeyDown(' '); // 确认
    advanceAnimation(engine);

    // 继续剩余步骤用 tryMove
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);

    expect(engine.isWin).toBe(true);
  });

  it('游戏重启后可以再次完成', () => {
    const engine = createAndStartEngine(3);
    // 完成
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.isWin).toBe(true);

    // 重启
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.moveCount).toBe(0);

    // 再次完成
    performMove(engine, 0, 2);
    performMove(engine, 0, 1);
    performMove(engine, 2, 1);
    performMove(engine, 0, 2);
    performMove(engine, 1, 0);
    performMove(engine, 1, 2);
    performMove(engine, 0, 2);
    expect(engine.isWin).toBe(true);
  });
});

// ============================================================
// 17. 常量合理性验证
// ============================================================
describe('Tower of Hanoi 常量验证', () => {
  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('CANVAS 尺寸为 480x640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('MIN_DISKS 为 3', () => {
    expect(MIN_DISKS).toBe(3);
  });

  it('MAX_DISKS 为 8', () => {
    expect(MAX_DISKS).toBe(8);
  });

  it('DEFAULT_DISKS 在合法范围内', () => {
    expect(DEFAULT_DISKS).toBeGreaterThanOrEqual(MIN_DISKS);
    expect(DEFAULT_DISKS).toBeLessThanOrEqual(MAX_DISKS);
  });

  it('PEG_COUNT 为 3', () => {
    expect(PEG_COUNT).toBe(3);
  });

  it('PEG_POSITIONS 长度为 3', () => {
    expect(PEG_POSITIONS.length).toBe(3);
  });

  it('PEG_POSITIONS 在画布范围内', () => {
    for (const x of PEG_POSITIONS) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(CANVAS_WIDTH);
    }
  });

  it('DISK_MIN_WIDTH < DISK_MAX_WIDTH', () => {
    expect(DISK_MIN_WIDTH).toBeLessThan(DISK_MAX_WIDTH);
  });

  it('DISK_COLORS 至少有 MAX_DISKS 个颜色', () => {
    expect(DISK_COLORS.length).toBeGreaterThanOrEqual(MAX_DISKS);
  });

  it('MOVE_ANIMATION_DURATION > 0', () => {
    expect(MOVE_ANIMATION_DURATION).toBeGreaterThan(0);
  });

  it('PEG_BOTTOM_Y 在画布范围内', () => {
    expect(PEG_BOTTOM_Y).toBeGreaterThan(0);
    expect(PEG_BOTTOM_Y).toBeLessThan(CANVAS_HEIGHT);
  });

  it('DISK_HEIGHT 和 DISK_GAP 为正数', () => {
    expect(DISK_HEIGHT).toBeGreaterThan(0);
    expect(DISK_GAP).toBeGreaterThan(0);
  });

  it('PEG_BASE_WIDTH 大于 PEG_WIDTH', () => {
    expect(PEG_BASE_WIDTH).toBeGreaterThan(PEG_WIDTH);
  });
});
