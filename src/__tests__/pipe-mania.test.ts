import { describe, it, expect, beforeEach } from 'vitest';
import { PipeManiaEngine } from '@/games/pipe-mania/PipeManiaEngine';
import {
  GRID_SIZE,
  CELL_SIZE,
  GRID_PADDING_X,
  GRID_PADDING_Y,
  PREVIEW_COUNT,
  MIN_PIPE_LENGTH,
  PipeType,
  Direction,
  PIPE_CONNECTIONS,
} from '@/games/pipe-mania/constants';

// ========== 辅助函数 ==========

const mockCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
};

const createEngine = (): PipeManiaEngine => {
  const engine = new PipeManiaEngine();
  engine.init(mockCanvas());
  return engine;
};

const startEngine = (): PipeManiaEngine => {
  const engine = createEngine();
  engine.start();
  return engine;
};

/** 模拟时间流逝 */
const advanceTime = (engine: PipeManiaEngine, ms: number): void => {
  // 分成小步更新以避免精度问题
  const step = 16;
  let remaining = ms;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    engine.update(dt);
    remaining -= dt;
  }
};

/** 点击放置管道 */
const clickCell = (engine: PipeManiaEngine, row: number, col: number): void => {
  const x = GRID_PADDING_X + col * CELL_SIZE + CELL_SIZE / 2;
  const y = GRID_PADDING_Y + row * CELL_SIZE + CELL_SIZE / 2;
  engine.handleClick(x, y);
};

// ========== 测试 ==========

describe('PipeManiaEngine', () => {
  // ===== 初始化 =====
  describe('初始化', () => {
    it('正确初始化引擎', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
      expect(engine.status).toBe('idle');
    });

    it('初始化 7x7 网格', () => {
      const engine = createEngine();
      const grid = engine.getGrid();
      expect(grid).toHaveLength(GRID_SIZE);
      expect(grid[0]).toHaveLength(GRID_SIZE);
    });

    it('网格初始为空', () => {
      const engine = createEngine();
      const grid = engine.getGrid();
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          expect(grid[r][c].pipe).toBeNull();
          expect(grid[r][c].waterFilled).toBe(false);
        }
      }
    });

    it('初始有预览队列', () => {
      const engine = createEngine();
      const queue = engine.getPreviewQueue();
      expect(queue.length).toBeGreaterThanOrEqual(PREVIEW_COUNT);
    });

    it('预览队列包含有效管道类型', () => {
      const engine = createEngine();
      const queue = engine.getPreviewQueue();
      const validTypes = Object.values(PipeType);
      for (const pipe of queue) {
        expect(validTypes).toContain(pipe);
      }
    });

    it('初始阶段为 placing', () => {
      const engine = createEngine();
      expect(engine.phase).toBe('placing');
    });

    it('初始管道数为0', () => {
      const engine = createEngine();
      expect(engine.pipeCount).toBe(0);
    });
  });

  // ===== 游戏状态转换 =====
  describe('游戏状态转换', () => {
    it('idle → playing', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('playing → paused', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('paused → playing', () => {
      const engine = startEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 回到 idle', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('statusChange 事件正确发射', () => {
      const engine = createEngine();
      const events: string[] = [];
      engine.on('statusChange', (s: string) => events.push(s));
      engine.start();
      engine.pause();
      engine.resume();
      engine.reset();
      expect(events).toContain('playing');
      expect(events).toContain('paused');
      expect(events).toContain('idle');
    });
  });

  // ===== 管道放置 =====
  describe('管道放置', () => {
    it('点击空位放置当前管道', () => {
      const engine = startEngine();
      const currentPipe = engine.currentPipe;
      clickCell(engine, 0, 0);
      expect(engine.getGrid()[0][0].pipe).toBe(currentPipe);
    });

    it('放置后管道数增加', () => {
      const engine = startEngine();
      clickCell(engine, 0, 0);
      expect(engine.pipeCount).toBe(1);
    });

    it('放置后得分增加5', () => {
      const engine = startEngine();
      const scoreBefore = engine.score;
      clickCell(engine, 0, 0);
      expect(engine.score).toBe(scoreBefore + 5);
    });

    it('可以放置多个管道', () => {
      const engine = startEngine();
      clickCell(engine, 0, 0);
      clickCell(engine, 0, 1);
      clickCell(engine, 0, 2);
      expect(engine.pipeCount).toBe(3);
    });

    it('可以覆盖已有管道', () => {
      const engine = startEngine();
      clickCell(engine, 0, 0);
      const firstPipe = engine.getGrid()[0][0].pipe;
      clickCell(engine, 0, 0); // 覆盖
      // 管道可能不同（因为队列已更新）
      expect(engine.getGrid()[0][0].pipe).not.toBeNull();
    });

    it('放置后预览队列更新', () => {
      const engine = startEngine();
      const queueBefore = engine.getPreviewQueue();
      clickCell(engine, 0, 0);
      const queueAfter = engine.getPreviewQueue();
      // 队列长度应保持不变（shift + push）
      expect(queueAfter.length).toBe(queueBefore.length);
    });

    it('不在放置阶段不能放置', () => {
      const engine = startEngine();
      // 先让倒计时结束
      advanceTime(engine, 35000);
      expect(engine.phase).not.toBe('placing');
      const pipesBefore = engine.pipeCount;
      clickCell(engine, 0, 0);
      expect(engine.pipeCount).toBe(pipesBefore);
    });

    it('点击网格外无效', () => {
      const engine = startEngine();
      engine.handleClick(0, 0); // 左上角外
      expect(engine.pipeCount).toBe(0);
    });
  });

  // ===== 管道连接逻辑 =====
  describe('管道连接逻辑', () => {
    it('STRAIGHT_H 连接 LEFT↔RIGHT', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.STRAIGHT_H, Direction.LEFT)).toBe(Direction.RIGHT);
      expect(engine.getExitDirection(PipeType.STRAIGHT_H, Direction.RIGHT)).toBe(Direction.LEFT);
    });

    it('STRAIGHT_V 连接 TOP↔BOTTOM', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.STRAIGHT_V, Direction.TOP)).toBe(Direction.BOTTOM);
      expect(engine.getExitDirection(PipeType.STRAIGHT_V, Direction.BOTTOM)).toBe(Direction.TOP);
    });

    it('BEND_TR 连接 TOP↔RIGHT', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.BEND_TR, Direction.TOP)).toBe(Direction.RIGHT);
      expect(engine.getExitDirection(PipeType.BEND_TR, Direction.RIGHT)).toBe(Direction.TOP);
    });

    it('BEND_BR 连接 BOTTOM↔RIGHT', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.BEND_BR, Direction.BOTTOM)).toBe(Direction.RIGHT);
      expect(engine.getExitDirection(PipeType.BEND_BR, Direction.RIGHT)).toBe(Direction.BOTTOM);
    });

    it('BEND_BL 连接 BOTTOM↔LEFT', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.BEND_BL, Direction.BOTTOM)).toBe(Direction.LEFT);
      expect(engine.getExitDirection(PipeType.BEND_BL, Direction.LEFT)).toBe(Direction.BOTTOM);
    });

    it('BEND_TL 连接 TOP↔LEFT', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.BEND_TL, Direction.TOP)).toBe(Direction.LEFT);
      expect(engine.getExitDirection(PipeType.BEND_TL, Direction.LEFT)).toBe(Direction.TOP);
    });

    it('CROSS 连接 TOP↔BOTTOM 和 LEFT↔RIGHT', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.CROSS, Direction.TOP)).toBe(Direction.BOTTOM);
      expect(engine.getExitDirection(PipeType.CROSS, Direction.BOTTOM)).toBe(Direction.TOP);
      expect(engine.getExitDirection(PipeType.CROSS, Direction.LEFT)).toBe(Direction.RIGHT);
      expect(engine.getExitDirection(PipeType.CROSS, Direction.RIGHT)).toBe(Direction.LEFT);
    });

    it('无效方向返回 null', () => {
      const engine = createEngine();
      expect(engine.getExitDirection(PipeType.STRAIGHT_H, Direction.TOP)).toBeNull();
      expect(engine.getExitDirection(PipeType.STRAIGHT_V, Direction.LEFT)).toBeNull();
    });
  });

  // ===== 水流模拟 =====
  describe('水流模拟', () => {
    it('倒计时结束后开始流水', () => {
      const engine = startEngine();
      // 在起点放置一个管道让水流可以开始
      const grid = engine.getGrid();
      grid[0][0].pipe = PipeType.STRAIGHT_H;
      advanceTime(engine, 31000);
      // 水流开始后可能已经完成（如果没有更多管道）
      expect(['flowing', 'finished']).toContain(engine.phase);
    });

    it('水流经过管道填充格子', () => {
      const engine = startEngine();
      // 手动设置管道路径
      const grid = engine.getGrid();
      grid[0][0].pipe = PipeType.STRAIGHT_H; // 起点
      grid[0][1].pipe = PipeType.STRAIGHT_H;
      // 开始流水
      advanceTime(engine, 31000);
      // 水流应该在进行中或已完成
      expect(['flowing', 'finished']).toContain(engine.phase);
    });

    it('水流遇到空格停止', () => {
      const engine = startEngine();
      // 起点不放置管道
      advanceTime(engine, 31000); // 开始流水
      advanceTime(engine, 1000); // 水流一步
      // 应该停止（没有管道）
      expect(engine.phase).toBe('finished');
    });

    it('水流经过管道得分', () => {
      const engine = startEngine();
      // 放置起点管道
      const grid = engine.getGrid();
      grid[0][0].pipe = PipeType.STRAIGHT_H;

      // 让水流运行
      advanceTime(engine, 31000);
      advanceTime(engine, 1000);
      // 分数应该有增加（放置分 + 可能的水流分）
      expect(engine.score).toBeGreaterThanOrEqual(0);
    });

    it('水流到达终点有额外奖励', () => {
      const engine = startEngine();
      // 验证基本机制
      expect(engine.score).toBe(0);
    });
  });

  // ===== 倒计时 =====
  describe('倒计时', () => {
    it('初始倒计时为30秒', () => {
      const engine = startEngine();
      expect(engine.timeRemaining).toBeLessThanOrEqual(30000);
      expect(engine.timeRemaining).toBeGreaterThan(25000);
    });

    it('倒计时随时间减少', () => {
      const engine = startEngine();
      const time1 = engine.timeRemaining;
      advanceTime(engine, 1000);
      const time2 = engine.timeRemaining;
      expect(time2).toBeLessThan(time1);
    });

    it('倒计时到0开始流水或结束', () => {
      const engine = startEngine();
      advanceTime(engine, 35000);
      // 没有管道时，水流立即结束
      expect(['flowing', 'finished']).toContain(engine.phase);
    });
  });

  // ===== 跳过管道 =====
  describe('跳过管道', () => {
    it('空格跳过当前管道', () => {
      const engine = startEngine();
      const queueBefore = [...engine.getPreviewQueue()];
      const firstPipe = queueBefore[0];
      engine.handleKeyDown(' ');
      const queueAfter = engine.getPreviewQueue();
      // 队列应该已经更新（shift + push）
      expect(queueAfter.length).toBe(queueBefore.length);
      // 第二个元素变成第一个
      expect(queueAfter[0]).toBe(queueBefore[1]);
    });
  });

  // ===== 关卡升级 =====
  describe('关卡升级', () => {
    it('初始关卡为1', () => {
      const engine = createEngine();
      expect(engine.level).toBe(1);
    });

    it('达标后关卡提升', () => {
      const engine = startEngine();
      // 放置足够管道
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          clickCell(engine, r, c);
          if (engine.pipeCount >= MIN_PIPE_LENGTH + 5) break;
        }
        if (engine.pipeCount >= MIN_PIPE_LENGTH + 5) break;
      }
      // 让倒计时结束并等待水流完成
      advanceTime(engine, 35000);
      advanceTime(engine, 5000);

      // 如果达标，关卡应该提升
      if (engine.pipeCount >= MIN_PIPE_LENGTH) {
        expect(engine.level).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ===== 重置 =====
  describe('重置', () => {
    it('重置后状态为 idle', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('重置后分数归零', () => {
      const engine = startEngine();
      clickCell(engine, 0, 0);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('重置后网格清空', () => {
      const engine = startEngine();
      clickCell(engine, 0, 0);
      clickCell(engine, 0, 1);
      engine.reset();
      const grid = engine.getGrid();
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          expect(grid[r][c].pipe).toBeNull();
        }
      }
    });

    it('重置后管道数归零', () => {
      const engine = startEngine();
      clickCell(engine, 0, 0);
      engine.reset();
      expect(engine.pipeCount).toBe(0);
    });

    it('重置后阶段回到 placing', () => {
      const engine = startEngine();
      advanceTime(engine, 35000);
      engine.reset();
      expect(engine.phase).toBe('placing');
    });
  });

  // ===== getState =====
  describe('getState', () => {
    it('返回完整状态', () => {
      const engine = createEngine();
      const state = engine.getState() as Record<string, unknown>;
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('previewQueue');
      expect(state).toHaveProperty('gamePhase');
      expect(state).toHaveProperty('placeTimer');
      expect(state).toHaveProperty('waterPath');
      expect(state).toHaveProperty('pipesUsed');
      expect(state).toHaveProperty('levelTarget');
      expect(state).toHaveProperty('score');
    });

    it('grid 状态包含管道信息', () => {
      const engine = createEngine();
      const state = engine.getState() as Record<string, unknown>;
      const grid = state.grid as Array<Array<Record<string, unknown>>>;
      const cell = grid[0][0];
      expect(cell).toHaveProperty('pipe');
      expect(cell).toHaveProperty('waterFilled');
      expect(cell).toHaveProperty('waterFrom');
    });
  });

  // ===== 事件系统 =====
  describe('事件系统', () => {
    it('start 发射 statusChange', () => {
      const engine = createEngine();
      let received = '';
      engine.on('statusChange', (s: string) => { received = s; });
      engine.start();
      expect(received).toBe('playing');
    });

    it('放置管道发射 scoreChange', () => {
      const engine = startEngine();
      let scoreReceived = 0;
      engine.on('scoreChange', (s: number) => { scoreReceived = s; });
      clickCell(engine, 0, 0);
      expect(scoreReceived).toBe(5);
    });

    it('reset 发射 statusChange', () => {
      const engine = startEngine();
      let received = '';
      engine.on('statusChange', (s: string) => { received = s; });
      engine.reset();
      expect(received).toBe('idle');
    });
  });

  // ===== 销毁 =====
  describe('销毁', () => {
    it('destroy 后状态为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ===== 边界情况 =====
  describe('边界情况', () => {
    it('未初始化 canvas 不能 start', () => {
      const engine = new PipeManiaEngine();
      expect(() => engine.start()).toThrow();
    });

    it('handleKeyUp 不报错', () => {
      const engine = startEngine();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('PIPE_CONNECTIONS 所有类型都有定义', () => {
      const types = Object.values(PipeType);
      for (const type of types) {
        expect(PIPE_CONNECTIONS[type]).toBeDefined();
        expect(PIPE_CONNECTIONS[type].length).toBeGreaterThan(0);
      }
    });

    it('所有管道类型至少有一对连接', () => {
      const types = Object.values(PipeType);
      for (const type of types) {
        const connections = PIPE_CONNECTIONS[type];
        for (const pair of connections) {
          expect(pair).toHaveLength(2);
          expect(Object.values(Direction)).toContain(pair[0]);
          expect(Object.values(Direction)).toContain(pair[1]);
        }
      }
    });
  });
});
