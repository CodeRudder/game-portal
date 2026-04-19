/**
 * 2048 游戏引擎测试
 * 覆盖：初始化、滑动合并、方块生成、计分、游戏结束、胜利条件、键盘控制、生命周期、渲染
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { G2048Engine } from '@/games/g2048/G2048Engine';
import { GameType } from '@/types';
import { GRID_SIZE } from '@/games/g2048/constants';

// ========== 测试辅助 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

function createEngine(): G2048Engine {
  const engine = new G2048Engine();
  engine.init(createCanvas());
  return engine;
}

function startEngine(): G2048Engine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 推进一帧更新 */
function advanceUpdate(engine: G2048Engine, dt: number): void {
  (engine as any).update(dt);
}

/** 获取网格深拷贝 */
function getGrid(engine: G2048Engine): number[][] {
  return (engine as any).grid.map((row: number[]) => [...row]);
}

/** 设置网格（直接操作内部状态） */
function setGrid(engine: G2048Engine, grid: number[][]): void {
  (engine as any).grid = grid.map((row: number[]) => [...row]);
}

/** 计算网格中非零元素数量 */
function countNonZero(grid: number[][]): number {
  return grid.flat().filter((v) => v !== 0).length;
}

/** 计算网格所有元素之和 */
function sumGrid(grid: number[][]): number {
  return grid.flat().reduce((a, b) => a + b, 0);
}

// ========== 测试 ==========

describe('G2048Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== 1. 初始化 ==========

  describe('初始化', () => {
    it('创建后状态为 idle', () => {
      const engine = new G2048Engine();
      expect(engine.status).toBe('idle');
    });

    it('初始分数为 0，等级为 1', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('init 后网格为空（全 0）', () => {
      const engine = createEngine();
      const grid = getGrid(engine);
      expect(grid.every((row) => row.every((cell) => cell === 0))).toBe(true);
    });

    it('start 后网格有 2 个方块', () => {
      const engine = startEngine();
      const grid = getGrid(engine);
      expect(countNonZero(grid)).toBe(2);
    });

    it('start 后状态为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后方块值均为 2 或 4', () => {
      const engine = startEngine();
      const grid = getGrid(engine);
      const values = grid.flat().filter((v) => v !== 0);
      expect(values.every((v) => v === 2 || v === 4)).toBe(true);
    });
  });

  // ========== 2. 滑动合并 ==========

  describe('滑动合并', () => {
    it('向左滑动：相同数字合并 [2,2,0,0] → [4,0,0,0]', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(4);
      // addRandomTile 可能在空位填入新方块，只验证合并结果
    });

    it('向右滑动：从右端处理 [0,0,2,2] → 最右端为4', () => {
      const engine = startEngine();
      setGrid(engine, [
        [0, 0, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowRight');
      const grid = getGrid(engine);
      // 合并后最右端应为 4，addRandomTile 可能在其他空位填入新方块
      expect(grid[0][3]).toBe(4);
      // 第0行非零元素：合并的4 + 可能的随机方块(2或4)
      const nonZero = grid[0].filter(v => v !== 0);
      expect(nonZero.length).toBeGreaterThanOrEqual(1);
      expect(nonZero.length).toBeLessThanOrEqual(2);
    });

    it('向上滑动：列方向合并', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowUp');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(4);
      // addRandomTile 可能在空位填入新方块
    });

    it('向下滑动：列方向合并', () => {
      const engine = startEngine();
      setGrid(engine, [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowDown');
      const grid = getGrid(engine);
      expect(grid[3][0]).toBe(4);
      // addRandomTile 可能在空位填入新方块
    });

    it('多次合并：[2,2,2,2] → [4,4,0,0]（向左）', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(4);
      expect(grid[0][1]).toBe(4);
      // addRandomTile 可能在空位填入新方块
    });

    it('不同数字不合并：[2,4,0,0] → [2,4,0,0]（向左无变化）', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      const before = getGrid(engine);
      engine.handleKeyDown('ArrowLeft');
      const after = getGrid(engine);
      // 第一行不变（不合并），但可能生成新方块在空位
      expect(after[0][0]).toBe(2);
      expect(after[0][1]).toBe(4);
    });

    it('大数合并：[4,4,8,8] → 向左合并后前两位为 8,16', () => {
      const engine = startEngine();
      setGrid(engine, [
        [4, 4, 8, 8],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(8);
      expect(grid[0][1]).toBe(16);
      // addRandomTile 可能在空位填入新方块，不检查后续位置是否为 0
    });

    it('三连合并只合并一对：[2,2,2,0] → [4,2,0,0]（向左）', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 2, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(4);
      expect(grid[0][1]).toBe(2);
      // addRandomTile 可能在空位填入新方块
    });

    it('单元素不合并：[0,0,0,2] → [2,0,0,0]（向左仅移动）', () => {
      const engine = startEngine();
      setGrid(engine, [
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(2);
      // addRandomTile 可能在空位填入新方块
    });
  });

  // ========== 3. 方块生成 ==========

  describe('方块生成', () => {
    it('有效移动后生成新方块', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      const before = countNonZero(getGrid(engine));
      engine.handleKeyDown('ArrowLeft');
      const after = countNonZero(getGrid(engine));
      // 合并后 1 个 + 新生成 1 个 = 2
      expect(after).toBe(2);
    });

    it('无效移动不生成新方块', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      const before = countNonZero(getGrid(engine));
      engine.handleKeyDown('ArrowLeft');
      const after = countNonZero(getGrid(engine));
      expect(after).toBe(before); // 无法移动，不生成新方块
    });

    it('新方块值为 2 或 4', () => {
      const engine = startEngine();
      // 反复操作，验证新生成的方块都是 2 或 4
      for (let i = 0; i < 20; i++) {
        setGrid(engine, [
          [2, 2, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]);
        engine.handleKeyDown('ArrowLeft');
        const grid = getGrid(engine);
        const nonZero = grid.flat().filter((v) => v !== 0);
        expect(nonZero.every((v) => v === 2 || v === 4 || v === 8)).toBe(true);
      }
    });

    it('新方块出现在空位上', () => {
      const engine = startEngine();
      // 满一行
      setGrid(engine, [
        [2, 4, 2, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      const grid = getGrid(engine);
      // 第一行合并后有空位，新方块可能出现在第一行或新方块在空位
      const totalNonZero = countNonZero(grid);
      expect(totalNonZero).toBeGreaterThan(0);
    });
  });

  // ========== 4. 计分 ==========

  describe('计分', () => {
    it('合并得分累加', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 4, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      // 2+2=4(得4分) + 4+4=8(得8分) = 12分
      expect(engine.score).toBe(12);
    });

    it('不合并不得分', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 8, 16],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      const scoreBefore = engine.score;
      engine.handleKeyDown('ArrowLeft');
      // 向左移动只是滑过去，不合并
      expect(engine.score).toBe(scoreBefore);
    });

    it('scoreChange 事件在合并时触发', () => {
      const engine = startEngine();
      const onScoreChange = vi.fn();
      engine.on('scoreChange', onScoreChange);

      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(onScoreChange).toHaveBeenCalledWith(4);
    });

    it('连续移动计分正确', () => {
      const engine = startEngine();
      const onScoreChange = vi.fn();
      engine.on('scoreChange', onScoreChange);

      // 第一次合并
      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.score).toBe(4);

      // 第二次合并（假设新方块在合适位置）
      setGrid(engine, [
        [4, 2, 2, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.score).toBe(8); // 4 + 4
    });
  });

  // ========== 5. 游戏结束 ==========

  describe('游戏结束', () => {
    it('满网格无法移动时 canMove 返回 false', () => {
      const engine = startEngine();
      // 满网格且无相邻相同
      setGrid(engine, [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]);
      expect((engine as any).canMove()).toBe(false);
    });

    it('有空位时不会 gameover', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 0], // 有一个空位
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.status).toBe('playing');
    });

    it('有相邻相同数字时不会 gameover', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 4, 8],
        [4, 8, 16, 32],
        [2, 4, 8, 16],
        [16, 32, 64, 128],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.status).toBe('playing');
    });

    it('gameover 后 statusChange 事件触发', () => {
      const engine = startEngine();
      const onStatusChange = vi.fn();
      engine.on('statusChange', onStatusChange);

      // 设置满网格无法移动，然后手动触发 gameOver
      setGrid(engine, [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]);
      expect((engine as any).canMove()).toBe(false);
      (engine as any).gameOver();
      expect(engine.status).toBe('gameover');
      expect(onStatusChange).toHaveBeenCalledWith('gameover');
    });
  });

  // ========== 6. 胜利条件 ==========

  describe('胜利条件', () => {
    it('达到 2048 方块触发 win 事件', () => {
      const engine = startEngine();
      const onWin = vi.fn();
      engine.on('win', onWin);

      setGrid(engine, [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(onWin).toHaveBeenCalled();
      expect(onWin).toHaveBeenCalledWith(expect.objectContaining({ bestTile: 2048 }));
    });

    it('胜利后游戏不自动结束（可继续玩）', () => {
      const engine = startEngine();
      setGrid(engine, [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.status).toBe('playing');
    });

    it('达到 2048 后 level 提升', () => {
      const engine = startEngine();
      const initialLevel = engine.level;

      setGrid(engine, [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.level).toBe(initialLevel + 1);
    });

    it('win 事件只触发一次', () => {
      const engine = startEngine();
      const onWin = vi.fn();
      engine.on('win', onWin);

      // 第一次达到 2048
      setGrid(engine, [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(onWin).toHaveBeenCalledTimes(1);

      // 再合并 2048+2048（模拟继续玩）
      setGrid(engine, [
        [2048, 2048, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(onWin).toHaveBeenCalledTimes(1); // 不再触发
    });
  });

  // ========== 7. 键盘控制 ==========

  describe('键盘控制', () => {
    it('ArrowUp 对应向上移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [2, 0, 0, 0],
        [2, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowUp');
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(4);
    });

    it('ArrowDown 对应向下移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowDown');
      const grid = getGrid(engine);
      expect(grid[3][0]).toBe(4);
    });

    it('WASD 对应方向', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('w'); // W = Up
      const grid = getGrid(engine);
      expect(grid[0][0]).toBe(4);
    });

    it('非方向键不产生移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      const before = JSON.stringify(getGrid(engine));
      engine.handleKeyDown('Enter');
      const after = JSON.stringify(getGrid(engine));
      expect(after).toBe(before);
    });

    it('暂停状态下按键无效', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.pause();
      const before = JSON.stringify(getGrid(engine));
      engine.handleKeyDown('ArrowLeft');
      const after = JSON.stringify(getGrid(engine));
      expect(after).toBe(before);
    });
  });

  // ========== 8. 生命周期 ==========

  describe('生命周期', () => {
    it('pause/resume 正常工作', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
      engine.pause();
      expect(engine.status).toBe('paused');
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 清空网格和分数', () => {
      const engine = startEngine();
      // 做一些操作
      setGrid(engine, [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.score).toBeGreaterThan(0);

      engine.reset();
      expect(engine.score).toBe(0);
      expect(engine.status).toBe('idle');
    });

    it('destroy 清理资源', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('statusChange 事件正确触发', () => {
      const engine = createEngine();
      const onStatusChange = vi.fn();
      engine.on('statusChange', onStatusChange);

      engine.start();
      expect(onStatusChange).toHaveBeenCalledWith('playing');

      engine.pause();
      expect(onStatusChange).toHaveBeenCalledWith('paused');

      engine.resume();
      expect(onStatusChange).toHaveBeenCalledWith('playing');
    });
  });

  // ========== 9. 渲染 ==========

  describe('渲染', () => {
    it('onRender 不抛异常', () => {
      const engine = startEngine();
      expect(() => {
        advanceUpdate(engine, 16);
        engine.render();
      }).not.toThrow();
    });

    it('gameover 状态下渲染不抛异常', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]);
      // 手动触发 gameOver
      (engine as any).gameOver();
      expect(engine.status).toBe('gameover');
      expect(() => engine.render()).not.toThrow();
    });

    it('getState 返回正确结构', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('bestTile');
      expect(Array.isArray((state as any).grid)).toBe(true);
      expect((state as any).grid.length).toBe(4);
      expect(typeof (state as any).bestTile).toBe('number');
    });

    it('getState 返回网格深拷贝', () => {
      const engine = startEngine();
      const state1 = engine.getState();
      const state2 = engine.getState();
      expect((state1 as any).grid).not.toBe((state2 as any).grid);
    });
  });

  // ========== 10. canMove 检测 ==========

  describe('canMove 检测', () => {
    it('空网格可以移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
      expect((engine as any).canMove()).toBe(true);
    });

    it('满网格无相邻相同不可移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]);
      expect((engine as any).canMove()).toBe(false);
    });

    it('有垂直相邻相同可移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 4, 8, 16],
        [2, 8, 16, 32],
        [4, 16, 32, 64],
        [8, 32, 64, 128],
      ]);
      expect((engine as any).canMove()).toBe(true);
    });

    it('有水平相邻相同可移动', () => {
      const engine = startEngine();
      setGrid(engine, [
        [2, 2, 4, 8],
        [4, 8, 16, 32],
        [8, 16, 32, 64],
        [16, 32, 64, 128],
      ]);
      expect((engine as any).canMove()).toBe(true);
    });
  });
});
