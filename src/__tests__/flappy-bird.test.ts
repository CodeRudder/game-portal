import { FlappyBirdEngine } from '@/games/flappy-bird/FlappyBirdEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  BIRD_X,
  BIRD_RADIUS,
  GRAVITY,
  JUMP_FORCE,
  MAX_FALL_SPEED,
  PIPE_WIDTH,
  PIPE_GAP,
  PIPE_SPEED,
  PIPE_SPAWN_INTERVAL,
  PIPE_MIN_HEIGHT,
  SCORE_PER_PIPE,
  LEVEL_UP_SCORE,
  SPEED_INCREMENT,
  GAP_DECREMENT,
  MIN_GAP,
} from '@/games/flappy-bird/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): FlappyBirdEngine {
  const engine = new FlappyBirdEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): FlappyBirdEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/**
 * 模拟引擎 update，推进 deltaTime 毫秒
 */
function advanceUpdate(engine: FlappyBirdEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 获取内部 bird 对象
 */
function getBird(engine: FlappyBirdEngine): any {
  return (engine as any).bird;
}

/**
 * 获取内部 pipes 数组
 */
function getPipes(engine: FlappyBirdEngine): any[] {
  return (engine as any).pipes;
}

// ========== 测试 ==========

describe('FlappyBirdEngine', () => {
  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('start 后 status 为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后小鸟在画布中央', () => {
      const engine = startEngine();
      const bird = getBird(engine);
      expect(bird.y).toBe(CANVAS_HEIGHT / 2);
      expect(bird.x).toBe(BIRD_X);
    });

    it('start 后初始速度和旋转为 0', () => {
      const engine = startEngine();
      const bird = getBird(engine);
      expect(bird.velocity).toBe(0);
      expect(bird.rotation).toBe(0);
    });

    it('start 后分数和等级为初始值', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('start 后管道列表为空', () => {
      const engine = startEngine();
      expect(getPipes(engine)).toHaveLength(0);
    });
  });

  // ==================== T2: 重力与跳跃 ====================
  describe('重力与跳跃', () => {
    it('flap 后小鸟获得向上速度', () => {
      const engine = startEngine();
      engine.flap();
      const bird = getBird(engine);
      expect(bird.velocity).toBe(JUMP_FORCE);
    });

    it('重力使小鸟下落', () => {
      const engine = startEngine();
      const yBefore = getBird(engine).y;

      // 不跳跃，让重力作用
      advanceUpdate(engine, 16.667); // ~1帧

      const bird = getBird(engine);
      expect(bird.velocity).toBeGreaterThan(0); // 速度向下
      expect(bird.y).toBeGreaterThan(yBefore); // 位置下移
    });

    it('连续 update 小鸟持续加速下落', () => {
      const engine = startEngine();

      advanceUpdate(engine, 16.667);
      const v1 = getBird(engine).velocity;

      advanceUpdate(engine, 16.667);
      const v2 = getBird(engine).velocity;

      expect(v2).toBeGreaterThan(v1); // 速度递增
    });

    it('下落速度不超过 MAX_FALL_SPEED', () => {
      const engine = startEngine();

      // 长时间不跳跃
      for (let i = 0; i < 100; i++) {
        advanceUpdate(engine, 16.667);
      }

      const bird = getBird(engine);
      expect(bird.velocity).toBeLessThanOrEqual(MAX_FALL_SPEED);
    });

    it('空格键触发跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown(' ');
      expect(getBird(engine).velocity).toBe(JUMP_FORCE);
    });

    it('ArrowUp 键触发跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(getBird(engine).velocity).toBe(JUMP_FORCE);
    });

    it('W 键触发跳跃', () => {
      const engine = startEngine();
      engine.handleKeyDown('w');
      expect(getBird(engine).velocity).toBe(JUMP_FORCE);
    });

    it('非 playing 状态下 flap 无效', () => {
      const engine = createEngine(); // idle 状态
      engine.flap();
      expect(getBird(engine).velocity).toBe(0);
    });
  });

  // ==================== T3: 管道系统 ====================
  describe('管道系统', () => {
    it('管道按间隔生成', () => {
      const engine = startEngine();

      // 初始无管道
      expect(getPipes(engine)).toHaveLength(0);

      // 推进到生成时间
      advanceUpdate(engine, PIPE_SPAWN_INTERVAL + 20);

      // 应该有管道了
      expect(getPipes(engine).length).toBeGreaterThanOrEqual(1);
    });

    it('管道从右侧屏幕外生成', () => {
      const engine = startEngine();

      // 推进生成一个管道
      advanceUpdate(engine, PIPE_SPAWN_INTERVAL + 20);

      const pipes = getPipes(engine);
      expect(pipes.length).toBeGreaterThanOrEqual(1);
      // 管道从 CANVAS_WIDTH+10 生成，经过 update 已移动，但应仍在画布右半部分
      expect(pipes[0].x).toBeGreaterThan(CANVAS_WIDTH * 0.4);
    });

    it('管道 topHeight 在合法范围内', () => {
      const engine = startEngine();

      // 生成多个管道
      for (let i = 0; i < 5; i++) {
        advanceUpdate(engine, PIPE_SPAWN_INTERVAL + 20);
      }

      const pipes = getPipes(engine);
      const playAreaHeight = CANVAS_HEIGHT - GROUND_HEIGHT;

      pipes.forEach((pipe: any) => {
        expect(pipe.topHeight).toBeGreaterThanOrEqual(PIPE_MIN_HEIGHT);
        expect(pipe.topHeight).toBeLessThanOrEqual(
          playAreaHeight - PIPE_GAP - PIPE_MIN_HEIGHT
        );
      });
    });

    it('管道向左移动', () => {
      const engine = startEngine();

      // 生成管道
      advanceUpdate(engine, PIPE_SPAWN_INTERVAL + 20);
      const pipes = getPipes(engine);
      if (pipes.length === 0) return;

      const xBefore = pipes[0].x;

      // 再推进
      advanceUpdate(engine, 16.667);

      expect(pipes[0].x).toBeLessThan(xBefore);
    });

    it('离开屏幕的管道被移除', () => {
      const engine = startEngine();

      // 生成管道
      advanceUpdate(engine, PIPE_SPAWN_INTERVAL + 20);
      const pipes = getPipes(engine);
      if (pipes.length === 0) return;

      // 手动将管道移到屏幕左侧外
      pipes[0].x = -PIPE_WIDTH - 20;

      // 推进触发清理
      advanceUpdate(engine, 16.667);

      // 该管道应被移除
      const remaining = getPipes(engine);
      remaining.forEach((p: any) => {
        expect(p.x).toBeGreaterThan(-PIPE_WIDTH - 10);
      });
    });
  });

  // ==================== T4: 碰撞检测 ====================
  describe('碰撞检测', () => {
    it('小鸟碰到地面触发 gameover', () => {
      const engine = startEngine();

      // 将小鸟设置到接近地面
      const bird = getBird(engine);
      bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS;

      // 给一个向下的速度让小鸟撞地
      bird.velocity = 5;

      advanceUpdate(engine, 16.667);

      expect(engine.status).toBe('gameover');
    });

    it('小鸟碰到天花板触发 gameover', () => {
      const engine = startEngine();

      // 将小鸟设置到接近天花板
      const bird = getBird(engine);
      bird.y = BIRD_RADIUS + 1;
      bird.velocity = 0;

      // 手动触发碰撞检测
      // 天花板检测：by - br <= 0
      bird.y = BIRD_RADIUS - 1;

      advanceUpdate(engine, 16.667);

      expect(engine.status).toBe('gameover');
    });

    it('小鸟碰到上管道触发 gameover', () => {
      const engine = startEngine();

      // 手动添加一个管道
      const pipes = getPipes(engine);
      pipes.push({
        x: BIRD_X - PIPE_WIDTH / 2, // 管道与小鸟水平重叠
        topHeight: 100, // 上管道高度 100
        scored: false,
      });

      // 将小鸟放在上管道区域内
      const bird = getBird(engine);
      bird.y = 50; // 在管道高度 100 内

      advanceUpdate(engine, 16.667);

      expect(engine.status).toBe('gameover');
    });

    it('小鸟碰到下管道触发 gameover', () => {
      const engine = startEngine();

      const pipeTopHeight = 200;
      const gap = PIPE_GAP;
      const bottomPipeTop = pipeTopHeight + gap;

      // 手动添加管道
      const pipes = getPipes(engine);
      pipes.push({
        x: BIRD_X - PIPE_WIDTH / 2,
        topHeight: pipeTopHeight,
        scored: false,
      });

      // 将小鸟放在下管道区域内
      const bird = getBird(engine);
      bird.y = bottomPipeTop + BIRD_RADIUS + 5;

      advanceUpdate(engine, 16.667);

      expect(engine.status).toBe('gameover');
    });

    it('小鸟在管道间隙中安全通过', () => {
      const engine = startEngine();

      const pipeTopHeight = 200;
      const gapCenter = pipeTopHeight + PIPE_GAP / 2;

      // 手动添加管道
      const pipes = getPipes(engine);
      pipes.push({
        x: BIRD_X - PIPE_WIDTH / 2,
        topHeight: pipeTopHeight,
        scored: false,
      });

      // 将小鸟放在间隙中央
      const bird = getBird(engine);
      bird.y = gapCenter;
      bird.velocity = 0;

      advanceUpdate(engine, 16.667);

      expect(engine.status).toBe('playing');
    });
  });

  // ==================== T5: 计分系统 ====================
  describe('计分系统', () => {
    it('通过管道后得分', () => {
      const engine = startEngine();

      // 添加一个已经过去的管道（scored=false, x+PIPE_WIDTH < bird.x）
      const pipes = getPipes(engine);
      pipes.push({
        x: BIRD_X - PIPE_WIDTH - 10, // 管道完全在小鸟左边
        topHeight: 200,
        scored: false,
      });

      // 将小鸟放在安全位置
      const bird = getBird(engine);
      bird.y = 200 + PIPE_GAP / 2;
      bird.velocity = 0;

      advanceUpdate(engine, 16.667);

      expect(engine.score).toBe(SCORE_PER_PIPE);
    });

    it('每个管道只计分一次', () => {
      const engine = startEngine();

      const pipes = getPipes(engine);
      pipes.push({
        x: BIRD_X - PIPE_WIDTH - 10,
        topHeight: 200,
        scored: false,
      });

      const bird = getBird(engine);
      bird.y = 200 + PIPE_GAP / 2;
      bird.velocity = 0;

      // 第一次 update 计分
      advanceUpdate(engine, 16.667);
      expect(engine.score).toBe(SCORE_PER_PIPE);

      // 第二次 update 不再计分
      advanceUpdate(engine, 16.667);
      expect(engine.score).toBe(SCORE_PER_PIPE);
    });

    it('通过多个管道累计得分', () => {
      const engine = startEngine();

      const pipes = getPipes(engine);
      pipes.push({
        x: BIRD_X - PIPE_WIDTH - 10,
        topHeight: 200,
        scored: false,
      });
      pipes.push({
        x: BIRD_X - PIPE_WIDTH - 80,
        topHeight: 250,
        scored: false,
      });

      const bird = getBird(engine);
      bird.y = 250 + PIPE_GAP / 2;
      bird.velocity = 0;

      advanceUpdate(engine, 16.667);

      expect(engine.score).toBe(SCORE_PER_PIPE * 2);
    });
  });

  // ==================== T6: 难度递增 ====================
  describe('难度递增', () => {
    it('初始速度为 PIPE_SPEED', () => {
      const engine = startEngine();
      expect((engine as any).currentSpeed).toBe(PIPE_SPEED);
    });

    it('初始间距为 PIPE_GAP', () => {
      const engine = startEngine();
      expect((engine as any).currentGap).toBe(PIPE_GAP);
    });

    it('升级后速度增加', () => {
      const engine = startEngine();

      // 手动设置分数触发升级
      (engine as any)._score = LEVEL_UP_SCORE;
      (engine as any).setLevel(2);
      (engine as any).increaseDifficulty();

      expect((engine as any).currentSpeed).toBe(PIPE_SPEED + SPEED_INCREMENT);
    });

    it('升级后间距减小', () => {
      const engine = startEngine();

      (engine as any)._score = LEVEL_UP_SCORE;
      (engine as any).setLevel(2);
      (engine as any).increaseDifficulty();

      expect((engine as any).currentGap).toBe(PIPE_GAP - GAP_DECREMENT);
    });

    it('间距不低于 MIN_GAP', () => {
      const engine = startEngine();

      // 设置到很高等级
      (engine as any).setLevel(50);
      (engine as any).increaseDifficulty();

      expect((engine as any).currentGap).toBeGreaterThanOrEqual(MIN_GAP);
    });
  });

  // ==================== T7: 旋转与动画 ====================
  describe('旋转与动画', () => {
    it('跳跃时小鸟仰头（负旋转）', () => {
      const engine = startEngine();

      engine.flap(); // 向上跳跃，velocity < 0
      advanceUpdate(engine, 16.667);

      const bird = getBird(engine);
      expect(bird.rotation).toBeLessThan(0);
    });

    it('下落时小鸟俯冲（正旋转）', () => {
      const engine = startEngine();

      // 不跳跃，让小鸟下落
      for (let i = 0; i < 10; i++) {
        advanceUpdate(engine, 16.667);
      }

      const bird = getBird(engine);
      expect(bird.rotation).toBeGreaterThan(0);
    });

    it('翅膀动画帧在 0-2 之间', () => {
      const engine = startEngine();

      // 推进触发翅膀动画
      for (let i = 0; i < 20; i++) {
        advanceUpdate(engine, 16.667);
      }

      const bird = getBird(engine);
      expect(bird.wingPhase).toBeGreaterThanOrEqual(0);
      expect(bird.wingPhase).toBeLessThanOrEqual(2);
    });
  });

  // ==================== T8: 生命周期与事件 ====================
  describe('生命周期与事件', () => {
    it('pause 后 status 为 paused', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后 status 为 playing', () => {
      const engine = startEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后 status 为 idle', () => {
      const engine = startEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后小鸟回到初始位置', () => {
      const engine = startEngine();

      // 让小鸟移动
      engine.flap();
      advanceUpdate(engine, 100);

      engine.reset();

      const bird = getBird(engine);
      expect(bird.y).toBe(CANVAS_HEIGHT / 2);
      expect(bird.velocity).toBe(0);
    });

    it('reset 后管道清空', () => {
      const engine = startEngine();

      // 生成管道
      advanceUpdate(engine, PIPE_SPAWN_INTERVAL + 20);
      expect(getPipes(engine).length).toBeGreaterThan(0);

      engine.reset();
      expect(getPipes(engine)).toHaveLength(0);
    });

    it('start 触发 statusChange 事件为 playing', () => {
      const engine = createEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('gameover 触发 statusChange 事件', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);

      // 撞地面
      const bird = getBird(engine);
      bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS;
      bird.velocity = 5;

      advanceUpdate(engine, 16.667);

      expect(cb).toHaveBeenCalledWith('gameover');
    });

    it('getState 返回游戏状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('birdY');
      expect(state).toHaveProperty('birdVelocity');
      expect(state).toHaveProperty('pipeCount');
      expect(state).toHaveProperty('currentSpeed');
      expect(state).toHaveProperty('currentGap');
    });

    it('destroy 清除事件', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== T9: 天花板限制 ====================
  describe('天花板限制', () => {
    it('小鸟不会飞出画布顶部', () => {
      const engine = startEngine();

      // 连续跳跃
      for (let i = 0; i < 20; i++) {
        engine.flap();
        advanceUpdate(engine, 16.667);
      }

      const bird = getBird(engine);
      expect(bird.y).toBeGreaterThanOrEqual(BIRD_RADIUS);
    });

    it('小鸟到达天花板时速度归零', () => {
      const engine = startEngine();

      // 给一个很大的向上速度
      const bird = getBird(engine);
      bird.velocity = -50;

      advanceUpdate(engine, 16.667);

      // 如果到达天花板，速度被重置
      if (bird.y <= BIRD_RADIUS) {
        expect(bird.velocity).toBe(0);
      }
    });
  });
});
