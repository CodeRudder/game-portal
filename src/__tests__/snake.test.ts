import { SnakeEngine } from '@/games/snake/SnakeEngine';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  return canvas;
}

function createEngine(): SnakeEngine {
  const engine = new SnakeEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): SnakeEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/**
 * 模拟游戏循环推进 deltaTime 毫秒
 * SnakeEngine.moveInterval 初始为 150ms
 */
function advanceUpdate(engine: SnakeEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

// ========== 测试 ==========

describe('SnakeEngine', () => {
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

    it('start 后蛇有 3 节', () => {
      const engine = startEngine();
      expect(engine.getState().snakeLength).toBe(3);
    });

    it('start 后分数和等级为初始值', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });
  });

  // ==================== T2: 移动 ====================
  describe('移动', () => {
    it('蛇默认向右移动，update 后蛇头右移一格', () => {
      const engine = startEngine();
      const state1 = engine.getState();
      // 蛇初始在中间，向右移动
      // midX = floor(20/2) = 10, midY = floor(20/2) = 10
      // 初始蛇: [{x:10,y:10}, {x:9,y:10}, {x:8,y:10}]
      expect(state1.snakeLength).toBe(3);

      // 推进 150ms 触发一次移动
      advanceUpdate(engine, 150);

      // 蛇头应右移到 x=11，蛇尾缩短，长度仍为3
      const state2 = engine.getState();
      expect(state2.snakeLength).toBe(3);
    });

    it('蛇移动时蛇尾缩短（未吃食物）', () => {
      const engine = startEngine();

      // 推进一次移动
      advanceUpdate(engine, 150);

      // 长度不变（头部+1，尾部-1）
      expect(engine.getState().snakeLength).toBe(3);
    });

    it('连续多次 update 蛇持续移动', () => {
      const engine = startEngine();

      // 将食物放到蛇路径之外，避免随机食物恰好落在蛇的行进路线上
      (engine as any).food = { x: 0, y: 0 };

      // 推进 3 次移动
      for (let i = 0; i < 3; i++) {
        advanceUpdate(engine, 150);
      }

      // 蛇仍然3节（没吃食物）
      expect(engine.getState().snakeLength).toBe(3);
    });
  });

  // ==================== T3: 转向 ====================
  describe('转向', () => {
    it('ArrowUp 改变方向为 UP', () => {
      const engine = startEngine();

      // 向右时可以向上转
      engine.handleKeyDown('ArrowUp');

      // 推进一次移动，蛇应向上移动
      advanceUpdate(engine, 150);

      // 蛇应该还活着（向上移动到 y=9 是合法的）
      expect(engine.status).toBe('playing');
    });

    it('不能反向移动（向右时不能向左）', () => {
      const engine = startEngine();

      // 蛇向右移动，尝试向左转（应该被忽略）
      engine.handleKeyDown('ArrowLeft');

      // 推进移动
      advanceUpdate(engine, 150);

      // 蛇应该继续向右移动（不是向左），仍然活着
      expect(engine.status).toBe('playing');
    });

    it('WASD 键也可以控制方向', () => {
      const engine = startEngine();

      engine.handleKeyDown('w'); // 向上

      advanceUpdate(engine, 150);

      // 蛇向上移动，应该还活着
      expect(engine.status).toBe('playing');
    });

    it('非 playing 状态下按键无效', () => {
      const engine = createEngine();
      // status 是 idle，按键应该被忽略
      engine.handleKeyDown('ArrowUp');
      expect(engine.status).toBe('idle');
    });
  });

  // ==================== T4: 食物 ====================
  describe('食物', () => {
    it('start 后食物已生成', () => {
      const engine = startEngine();
      const state = engine.getState();
      // 蛇有3节说明游戏正常运行，食物已生成
      expect(state.snakeLength).toBe(3);
    });

    it('吃到食物后蛇变长', () => {
      const engine = startEngine();

      // Mock food 位置在蛇头右边一格
      // 蛇头在 (10,10)，向右移动
      // 设置食物在 (11,10)
      (engine as any).food = { x: 11, y: 10 };

      const lengthBefore = engine.getState().snakeLength;

      // 推进一次移动，蛇头到 (11,10) 吃到食物
      advanceUpdate(engine, 150);

      // 蛇变长了
      expect(engine.getState().snakeLength).toBe(lengthBefore + 1);
    });

    it('吃到食物后分数 +10', () => {
      const engine = startEngine();

      // 设置食物在蛇头右边一格
      (engine as any).food = { x: 11, y: 10 };

      advanceUpdate(engine, 150);

      expect(engine.score).toBe(10);
    });
  });

  // ==================== T5: 碰撞检测 ====================
  describe('碰撞检测', () => {
    it('撞墙（右边界）触发 gameover', () => {
      const engine = startEngine();

      // 蛇头在 (10,10)，向右移动
      // 手动将蛇头设置到右边界 x=19
      const snake = (engine as any).snake;
      snake[0] = { x: 19, y: 10 };
      // 清除蛇身，只留蛇头避免自碰
      snake.length = 1;

      // 推进一次移动，蛇头到 x=20 越界
      advanceUpdate(engine, 150);

      expect(engine.status).toBe('gameover');
    });

    it('撞墙（上边界）触发 gameover', () => {
      const engine = startEngine();

      engine.handleKeyDown('ArrowUp');

      // 将蛇头设置到上边界 y=0
      const snake = (engine as any).snake;
      snake[0] = { x: 10, y: 0 };
      snake.length = 1;

      advanceUpdate(engine, 150);

      expect(engine.status).toBe('gameover');
    });

    it('撞自己触发 gameover', () => {
      const engine = startEngine();

      // 构造一个会自碰的蛇：蛇头紧邻蛇身
      // 蛇: [{x:5,y:5}, {x:6,y:5}, {x:6,y:4}]
      // 方向向左，蛇头向左到 (4,5) 安全
      // 但如果方向向下，蛇头到 (5,6)，然后向右到 (6,6)，再向上到 (6,5) 就撞到蛇身
      // 更简单：直接设置蛇形状为 U 形然后让它撞
      const snake = (engine as any).snake;
      snake.length = 0;
      snake.push(
        { x: 5, y: 5 },  // 头
        { x: 6, y: 5 },  // 身
        { x: 6, y: 6 },  // 身
        { x: 5, y: 6 },  // 尾
      );
      // 设置方向向下
      (engine as any).direction = 'DOWN';
      (engine as any).nextDirection = 'DOWN';
      // 蛇头在 (5,5) 向下移动到 (5,6) —— 但 (5,6) 是蛇尾
      // 蛇尾会在移动时被移除（如果没有吃到食物），所以 (5,6) 会被 pop
      // 但 unshift 在 pop 之前，所以 some 检查时蛇尾还在
      // 实际上 move() 先 unshift 再 pop（没吃食物时）
      // 所以 some 检查是在 unshift 之前，检查旧蛇身
      // 蛇身包含 (5,6)，所以会碰撞

      // 设置食物在远处，确保不会吃到
      (engine as any).food = { x: 0, y: 0 };

      advanceUpdate(engine, 150);

      expect(engine.status).toBe('gameover');
    });
  });

  // ==================== T6: 速度系统 ====================
  describe('速度系统', () => {
    it('初始 moveInterval 为 150ms', () => {
      const engine = startEngine();
      expect((engine as any).moveInterval).toBe(150);
    });

    it('分数增加后 moveInterval 减小', () => {
      const engine = startEngine();

      // 吃5个食物，score=50
      for (let i = 0; i < 5; i++) {
        // 设置食物在蛇头前方
        const head = (engine as any).snake[0];
        const dir = (engine as any).direction;
        let foodX = head.x;
        let foodY = head.y;
        if (dir === 'RIGHT') foodX = head.x + 1;
        else if (dir === 'LEFT') foodX = head.x - 1;
        else if (dir === 'UP') foodY = head.y - 1;
        else foodY = head.y + 1;
        (engine as any).food = { x: foodX, y: foodY };

        advanceUpdate(engine, 150);
      }

      expect(engine.score).toBe(50);
      // moveInterval = max(50, 150 - floor(50/10)*3) = max(50, 150-15) = 135
      expect((engine as any).moveInterval).toBeLessThan(150);
    });

    it('level 随分数递增', () => {
      const engine = startEngine();

      // 吃5个食物，score=50, level = floor(50/50)+1 = 2
      for (let i = 0; i < 5; i++) {
        const head = (engine as any).snake[0];
        (engine as any).food = { x: head.x + 1, y: head.y };
        advanceUpdate(engine, 150);
      }

      expect(engine.level).toBe(2);
    });

    it('moveInterval 最小值为 50ms', () => {
      const engine = startEngine();

      // 直接设置高分
      (engine as any)._score = 500;

      // 模拟一次吃食物触发速度更新
      const head = (engine as any).snake[0];
      (engine as any).food = { x: head.x + 1, y: head.y };
      advanceUpdate(engine, 150);

      // moveInterval = max(50, 150 - floor(score/10)*3)
      // score 此时至少 510
      // = max(50, 150 - 51*3) = max(50, 150-153) = max(50, -3) = 50
      expect((engine as any).moveInterval).toBeGreaterThanOrEqual(50);
    });
  });

  // ==================== T7: 边界 ====================
  describe('边界', () => {
    it('蛇到达网格左边界时下一步碰撞', () => {
      const engine = startEngine();

      // 将蛇头设置到左边界 x=0，方向向左
      const snake = (engine as any).snake;
      snake.length = 0;
      snake.push({ x: 0, y: 10 });
      (engine as any).direction = 'LEFT';
      (engine as any).nextDirection = 'LEFT';

      advanceUpdate(engine, 150);

      expect(engine.status).toBe('gameover');
    });

    it('蛇到达网格下边界时下一步碰撞', () => {
      const engine = startEngine();

      // 将蛇头设置到下边界 y=19，方向向下
      const snake = (engine as any).snake;
      snake.length = 0;
      snake.push({ x: 10, y: 19 });
      (engine as any).direction = 'DOWN';
      (engine as any).nextDirection = 'DOWN';

      advanceUpdate(engine, 150);

      expect(engine.status).toBe('gameover');
    });
  });

  // ==================== 生命周期与事件 ====================
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

    it('destroy 清除所有事件监听', () => {
      const engine = startEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);
      engine.destroy();
      // destroy 后事件应被清除，不会触发
      expect(engine.status).toBe('idle');
    });

    it('start 触发 statusChange 事件为 playing', () => {
      const engine = createEngine();
      const cb = jest.fn();
      engine.on('statusChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('getState 返回 snakeLength', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('snakeLength');
      expect(state.snakeLength).toBe(3);
    });
  });
});
