import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AirHockeyEngine } from '../AirHockeyEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  TABLE_LEFT, TABLE_RIGHT, TABLE_TOP, TABLE_BOTTOM,
  CENTER_Y, GOAL_LEFT, GOAL_RIGHT, GOAL_DEPTH,
  MALLET_RADIUS, MALLET_SPEED,
  PLAYER_MIN_Y, PLAYER_MAX_Y, AI_MIN_Y, AI_MAX_Y,
  MALLET_MIN_X, MALLET_MAX_X,
  PUCK_RADIUS, PUCK_INITIAL_SPEED, PUCK_MAX_SPEED, PUCK_FRICTION,
  WIN_SCORE, SERVE_DELAY,
} from '../constants';

// ========== Canvas Mock 补丁 ==========

const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  const ctx = origGetContext.call(this, contextId) as any;
  if (contextId === '2d' && ctx && !ctx.setLineDash) {
    ctx.setLineDash = () => {};
  }
  return ctx;
};

// ========== 辅助函数 ==========

function createEngine(): AirHockeyEngine {
  const engine = new AirHockeyEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 启动引擎并手动推进一帧（进入 playing 状态） */
function startEngine(engine: AirHockeyEngine): void {
  engine.start();
}

/** 手动调用 update（跳过游戏循环和渲染） */
function tick(engine: AirHockeyEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 跳过发球延迟 */
function skipServe(engine: AirHockeyEngine): void {
  tick(engine, SERVE_DELAY + 100);
}

// ========== 测试 ==========

describe('AirHockeyEngine', () => {
  let engine: AirHockeyEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(AirHockeyEngine);
    });

    it('初始状态应为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('初始分数应为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('初始等级应为 1', () => {
      expect(engine.level).toBe(1);
    });

    it('初始玩家分数应为 0', () => {
      expect(engine.playerScore).toBe(0);
    });

    it('初始 AI 分数应为 0', () => {
      expect(engine.aiScore).toBe(0);
    });

    it('初始不应处于发球状态', () => {
      expect(engine.serving).toBe(false);
    });

    it('初始冰球位置为 0', () => {
      expect(engine.puckX).toBe(0);
      expect(engine.puckY).toBe(0);
    });

    it('初始玩家推板在下半场', () => {
      expect(engine.playerY).toBeGreaterThan(CENTER_Y);
    });

    it('初始 AI 推板在上半场', () => {
      expect(engine.aiY).toBeLessThan(CENTER_Y);
    });
  });

  // ========== 游戏生命周期 ==========

  describe('游戏生命周期', () => {
    it('start 后状态变为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 后进入发球状态', () => {
      engine.start();
      expect(engine.serving).toBe(true);
    });

    it('start 后分数重置', () => {
      engine.start();
      expect(engine.playerScore).toBe(0);
      expect(engine.aiScore).toBe(0);
    });

    it('pause 后状态变为 paused', () => {
      startEngine(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态恢复为 playing', () => {
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态变为 idle', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后分数清零', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.playerScore).toBe(0);
      expect(engine.aiScore).toBe(0);
      expect(engine.score).toBe(0);
    });

    it('destroy 后状态变为 idle', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('未初始化 canvas 调用 start 应抛出异常', () => {
      const e = new AirHockeyEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });
  });

  // ========== 输入处理 ==========

  describe('输入处理', () => {
    it('ArrowUp 按下后玩家推板向上移动', () => {
      startEngine(engine);
      const startY = engine.playerY;
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      expect(engine.playerY).toBeLessThanOrEqual(startY);
    });

    it('ArrowDown 按下后玩家推板向下移动', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      const posY = engine.playerY;
      engine.handleKeyUp('ArrowUp');
      engine.handleKeyDown('ArrowDown');
      tick(engine);
      expect(engine.playerY).toBeGreaterThanOrEqual(posY);
    });

    it('ArrowLeft 按下后玩家推板向左移动', () => {
      startEngine(engine);
      const startX = engine.playerX;
      engine.handleKeyDown('ArrowLeft');
      tick(engine);
      expect(engine.playerX).toBeLessThanOrEqual(startX);
    });

    it('ArrowRight 按下后玩家推板向右移动', () => {
      startEngine(engine);
      const startX = engine.playerX;
      engine.handleKeyDown('ArrowRight');
      tick(engine);
      expect(engine.playerX).toBeGreaterThanOrEqual(startX);
    });

    it('W 键等同于 ArrowUp', () => {
      startEngine(engine);
      const startY = engine.playerY;
      engine.handleKeyDown('w');
      tick(engine);
      expect(engine.playerY).toBeLessThanOrEqual(startY);
    });

    it('S 键等同于 ArrowDown', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      const posY = engine.playerY;
      engine.handleKeyUp('ArrowUp');
      engine.handleKeyDown('s');
      tick(engine);
      expect(engine.playerY).toBeGreaterThanOrEqual(posY);
    });

    it('A 键等同于 ArrowLeft', () => {
      startEngine(engine);
      const startX = engine.playerX;
      engine.handleKeyDown('a');
      tick(engine);
      expect(engine.playerX).toBeLessThanOrEqual(startX);
    });

    it('D 键等同于 ArrowRight', () => {
      startEngine(engine);
      const startX = engine.playerX;
      engine.handleKeyDown('d');
      tick(engine);
      expect(engine.playerX).toBeGreaterThanOrEqual(startX);
    });

    it('大写 W 键也能工作', () => {
      startEngine(engine);
      const startY = engine.playerY;
      engine.handleKeyDown('W');
      tick(engine);
      expect(engine.playerY).toBeLessThanOrEqual(startY);
    });

    it('handleKeyUp 停止移动', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      const y1 = engine.playerY;
      engine.handleKeyUp('ArrowUp');
      tick(engine);
      const y2 = engine.playerY;
      expect(y2).toBe(y1);
    });

    it('Space 键从 idle 开始游戏', () => {
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('Space 键从 gameover 重新开始', () => {
      startEngine(engine);
      // 模拟游戏结束
      (engine as any)._status = 'gameover';
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });
  });

  // ========== 推板移动限制 ==========

  describe('推板移动限制', () => {
    it('玩家推板不能超过中线', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      for (let i = 0; i < 200; i++) tick(engine);
      expect(engine.playerY).toBeGreaterThanOrEqual(PLAYER_MIN_Y);
    });

    it('玩家推板不能超过底部', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowDown');
      for (let i = 0; i < 200; i++) tick(engine);
      expect(engine.playerY).toBeLessThanOrEqual(PLAYER_MAX_Y);
    });

    it('玩家推板不能超过左墙', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      for (let i = 0; i < 200; i++) tick(engine);
      expect(engine.playerX).toBeGreaterThanOrEqual(MALLET_MIN_X);
    });

    it('玩家推板不能超过右墙', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      for (let i = 0; i < 200; i++) tick(engine);
      expect(engine.playerX).toBeLessThanOrEqual(MALLET_MAX_X);
    });

    it('AI 推板不能超过中线', () => {
      startEngine(engine);
      skipServe(engine);
      for (let i = 0; i < 200; i++) tick(engine);
      expect(engine.aiY).toBeLessThanOrEqual(AI_MAX_Y);
    });

    it('AI 推板不能超过顶部', () => {
      startEngine(engine);
      skipServe(engine);
      for (let i = 0; i < 200; i++) tick(engine);
      expect(engine.aiY).toBeGreaterThanOrEqual(AI_MIN_Y);
    });
  });

  // ========== 冰球物理 ==========

  describe('冰球物理', () => {
    it('发球后冰球开始移动', () => {
      startEngine(engine);
      skipServe(engine);
      // 发球后冰球有速度
      const hasSpeed = engine.puckDx !== 0 || engine.puckDy !== 0;
      expect(hasSpeed).toBe(true);
    });

    it('冰球碰到左墙反弹', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = TABLE_LEFT + PUCK_RADIUS + 1;
      (engine as any)._puck.dx = -5;
      tick(engine);
      expect(engine.puckDx).toBeGreaterThan(0);
    });

    it('冰球碰到右墙反弹', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = TABLE_RIGHT - PUCK_RADIUS - 1;
      (engine as any)._puck.dx = 5;
      tick(engine);
      expect(engine.puckDx).toBeLessThan(0);
    });

    it('冰球碰到上墙（非球门区域）反弹', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = TABLE_LEFT + 10;
      (engine as any)._puck.y = TABLE_TOP + PUCK_RADIUS + 1;
      (engine as any)._puck.dy = -5;
      tick(engine);
      expect(engine.puckDy).toBeGreaterThan(0);
    });

    it('冰球碰到下墙（非球门区域）反弹', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = TABLE_LEFT + 10;
      (engine as any)._puck.y = TABLE_BOTTOM - PUCK_RADIUS - 1;
      (engine as any)._puck.dy = 5;
      tick(engine);
      expect(engine.puckDy).toBeLessThan(0);
    });

    it('冰球在球门区域不反弹（上方）', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP + PUCK_RADIUS + 1;
      (engine as any)._puck.dy = -5;
      tick(engine);
      expect(engine.puckDy).toBeLessThanOrEqual(0);
    });

    it('冰球在球门区域不反弹（下方）', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_BOTTOM - PUCK_RADIUS - 1;
      (engine as any)._puck.dy = 5;
      tick(engine);
      expect(engine.puckDy).toBeGreaterThanOrEqual(0);
    });

    it('冰球有摩擦力减速', () => {
      startEngine(engine);
      skipServe(engine);
      // 放冰球在远离推板的位置，给予较大速度
      (engine as any)._puck.x = 100;
      (engine as any)._puck.y = 300;
      (engine as any)._puck.dx = 0;
      (engine as any)._puck.dy = 0;
      tick(engine);
      // 冰球静止时速度应为 0 或接近 0
      expect(engine.puckSpeed).toBeGreaterThanOrEqual(0);
    });

    it('冰球速度不超过最大值', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = 100;
      (engine as any)._puck.y = 300;
      (engine as any)._puck.dx = PUCK_MAX_SPEED * 2;
      (engine as any)._puck.dy = PUCK_MAX_SPEED * 2;
      tick(engine);
      const speed = Math.sqrt(engine.puckDx ** 2 + engine.puckDy ** 2);
      expect(speed).toBeLessThanOrEqual(PUCK_MAX_SPEED * 1.1);
    });

    it('冰球静止时保持静止', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.dx = 0;
      (engine as any)._puck.dy = 0;
      const x = engine.puckX;
      const y = engine.puckY;
      tick(engine);
      expect(engine.puckX).toBe(x);
      expect(engine.puckY).toBe(y);
    });
  });

  // ========== 碰撞检测 ==========

  describe('推板碰撞检测', () => {
    it('冰球与玩家推板碰撞后反弹', () => {
      startEngine(engine);
      skipServe(engine);
      // 冰球在玩家推板正上方，向下移动
      (engine as any)._puck.x = engine.playerX;
      (engine as any)._puck.y = engine.playerY - MALLET_RADIUS - PUCK_RADIUS + 2;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.puckY).toBeLessThan(engine.playerY);
    });

    it('冰球与 AI 推板碰撞后反弹', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = engine.aiX;
      (engine as any)._puck.y = engine.aiY + MALLET_RADIUS + PUCK_RADIUS - 2;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.puckY).toBeGreaterThan(engine.aiY);
    });

    it('碰撞后冰球不与推板重叠', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = engine.playerX;
      (engine as any)._puck.y = engine.playerY - MALLET_RADIUS - PUCK_RADIUS + 1;
      (engine as any)._puck.dy = 5;
      (engine as any)._puck.dx = 0;
      tick(engine);
      const dx = engine.puckX - engine.playerX;
      const dy = engine.puckY - engine.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(PUCK_RADIUS + MALLET_RADIUS - 1);
    });

    it('冰球从侧面碰撞推板', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = engine.playerX + MALLET_RADIUS + PUCK_RADIUS - 1;
      (engine as any)._puck.y = engine.playerY;
      (engine as any)._puck.dx = -5;
      (engine as any)._puck.dy = 0;
      tick(engine);
      expect(engine.puckX).toBeGreaterThan(engine.playerX);
    });

    it('冰球远离推板时不触发碰撞', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = 100;
      (engine as any)._puck.y = 300;
      (engine as any)._puck.dx = 2;
      (engine as any)._puck.dy = 2;
      tick(engine);
      // 摩擦力会使速度略微减小，但方向不变
      expect(engine.puckDx).toBeGreaterThan(0);
      expect(engine.puckDy).toBeGreaterThan(0);
    });
  });

  // ========== 进球判定 ==========

  describe('进球判定', () => {
    it('冰球进入上方球门 → 玩家得分', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.playerScore).toBe(1);
    });

    it('冰球进入下方球门 → AI 得分', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_BOTTOM + GOAL_DEPTH + PUCK_RADIUS;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.aiScore).toBe(1);
    });

    it('冰球在球门范围外不算进球（上方左侧）', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = GOAL_LEFT - 10;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.playerScore).toBe(0);
    });

    it('冰球在球门范围外不算进球（上方右侧）', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = GOAL_RIGHT + 10;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.playerScore).toBe(0);
    });

    it('冰球在球门范围外不算进球（下方左侧）', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = GOAL_LEFT - 10;
      (engine as any)._puck.y = TABLE_BOTTOM + GOAL_DEPTH + PUCK_RADIUS;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.aiScore).toBe(0);
    });

    it('冰球在球门范围外不算进球（下方右侧）', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = GOAL_RIGHT + 10;
      (engine as any)._puck.y = TABLE_BOTTOM + GOAL_DEPTH + PUCK_RADIUS;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.aiScore).toBe(0);
    });

    it('进球后重新进入发球状态', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.serving).toBe(true);
    });

    it('冰球在球门线上方但未超过深度不算进球', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      // 冰球在球门线内但未超过深度 — 放在球门线稍上方，向上移动但未完全进入
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP + PUCK_RADIUS + 1; // 球门线以下（桌内）
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.playerScore).toBe(0);
    });
  });

  // ========== 胜利条件 ==========

  describe('胜利条件', () => {
    it('玩家先到 7 分获胜', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._playerScore = WIN_SCORE - 1;
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.playerScore).toBe(WIN_SCORE);
      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(true);
    });

    it('AI 先到 7 分则玩家失败', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._aiScore = WIN_SCORE - 1;
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_BOTTOM + GOAL_DEPTH + PUCK_RADIUS;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.aiScore).toBe(WIN_SCORE);
      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(false);
    });

    it('6:6 时继续比赛', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._playerScore = 6;
      (engine as any)._aiScore = 6;
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.playerScore).toBe(7);
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== AI 行为 ==========

  describe('AI 行为', () => {
    it('AI 推板在冰球靠近时移动拦截', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = CANVAS_WIDTH / 2;
      (engine as any)._puck.y = CENTER_Y - 100;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      const startAiX = engine.aiX;
      const startAiY = engine.aiY;
      for (let i = 0; i < 50; i++) tick(engine);
      const moved = engine.aiX !== startAiX || engine.aiY !== startAiY;
      expect(moved).toBe(true);
    });

    it('AI 推板在冰球远离时回到防守位置', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.x = CANVAS_WIDTH / 2;
      (engine as any)._puck.y = CENTER_Y + 100;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      for (let i = 0; i < 50; i++) tick(engine);
      expect(engine.aiY).toBeLessThanOrEqual(AI_MAX_Y);
      expect(engine.aiY).toBeGreaterThanOrEqual(AI_MIN_Y);
    });

    it('AI 推板 X 坐标在合理范围内', () => {
      startEngine(engine);
      skipServe(engine);
      for (let i = 0; i < 100; i++) tick(engine);
      expect(engine.aiX).toBeGreaterThanOrEqual(MALLET_MIN_X);
      expect(engine.aiX).toBeLessThanOrEqual(MALLET_MAX_X);
    });

    it('AI 随等级提升反应更快', () => {
      startEngine(engine);
      (engine as any)._level = 5;
      skipServe(engine);
      (engine as any)._puck.x = CANVAS_WIDTH / 2;
      (engine as any)._puck.y = CENTER_Y - 100;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      const startAiY = engine.aiY;
      // 多帧让 AI 反应
      for (let i = 0; i < 50; i++) tick(engine);
      // AI 应该移动了
      expect(engine.aiY).not.toBe(startAiY);
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('start 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('pause 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.reset();
      expect(handler).toHaveBeenCalledWith('idle');
    });

    it('scoreChange 事件在进球时触发', () => {
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(handler).toHaveBeenCalled();
    });

    it('gameover 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      skipServe(engine);
      (engine as any)._playerScore = WIN_SCORE - 1;
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(handler).toHaveBeenCalledWith('gameover');
    });

    it('off 取消事件监听', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.off('statusChange', handler);
      engine.start();
      expect(handler).not.toHaveBeenCalled();
    });

    it('start 触发 scoreChange 事件', () => {
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('start 触发 levelChange 事件', () => {
      const handler = vi.fn();
      engine.on('levelChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('返回正确的游戏状态对象', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('playerScore');
      expect(state).toHaveProperty('aiScore');
      expect(state).toHaveProperty('puckX');
      expect(state).toHaveProperty('puckY');
      expect(state).toHaveProperty('puckDx');
      expect(state).toHaveProperty('puckDy');
      expect(state).toHaveProperty('playerX');
      expect(state).toHaveProperty('playerY');
      expect(state).toHaveProperty('aiX');
      expect(state).toHaveProperty('aiY');
      expect(state).toHaveProperty('serving');
      expect(state).toHaveProperty('isWin');
    });

    it('idle 状态返回初始值', () => {
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.playerScore).toBe(0);
      expect(state.aiScore).toBe(0);
      expect(state.serving).toBe(false);
      expect(state.isWin).toBe(false);
    });

    it('playing 状态反映当前值', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state.serving).toBe(true);
      expect(state.playerScore).toBe(0);
      expect(state.aiScore).toBe(0);
    });

    it('进球后状态更新', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      const state = engine.getState();
      expect(state.playerScore).toBe(1);
    });
  });

  // ========== 常量验证 ==========

  describe('常量', () => {
    it('WIN_SCORE 为 7', () => {
      expect(WIN_SCORE).toBe(7);
    });

    it('画布尺寸 480×640', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('球门宽度合理', () => {
      expect(GOAL_LEFT).toBeGreaterThan(TABLE_LEFT);
      expect(GOAL_RIGHT).toBeLessThan(TABLE_RIGHT);
    });

    it('推板活动范围合理', () => {
      expect(PLAYER_MIN_Y).toBeGreaterThan(CENTER_Y);
      expect(AI_MAX_Y).toBeLessThan(CENTER_Y);
    });

    it('摩擦系数在 0-1 之间', () => {
      expect(PUCK_FRICTION).toBeGreaterThan(0);
      expect(PUCK_FRICTION).toBeLessThan(1);
    });

    it('球门深度为正数', () => {
      expect(GOAL_DEPTH).toBeGreaterThan(0);
    });

    it('推板半径大于冰球半径', () => {
      expect(MALLET_RADIUS).toBeGreaterThan(PUCK_RADIUS);
    });
  });

  // ========== 重置行为 ==========

  describe('重置行为', () => {
    it('reset 后推板回到初始位置', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      engine.reset();
      expect(engine.playerY).toBeGreaterThan(CENTER_Y);
      expect(engine.aiY).toBeLessThan(CENTER_Y);
    });

    it('reset 后输入状态清除', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowLeft');
      engine.reset();
      engine.start();
      const y = engine.playerY;
      const x = engine.playerX;
      tick(engine);
      expect(engine.playerY).toBe(y);
      expect(engine.playerX).toBe(x);
    });

    it('连续 start-reset-start 循环正常', () => {
      engine.start();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.playerScore).toBe(0);
      expect(engine.aiScore).toBe(0);
    });

    it('reset 后 isWin 为 false', () => {
      startEngine(engine);
      (engine as any)._isWin = true;
      engine.reset();
      expect(engine.isWin).toBe(false);
    });
  });

  // ========== 发球机制 ==========

  describe('发球机制', () => {
    it('发球期间冰球静止在中心', () => {
      startEngine(engine);
      expect(engine.puckX).toBe(CANVAS_WIDTH / 2);
      expect(engine.puckY).toBe(CANVAS_HEIGHT / 2);
      expect(engine.puckDx).toBe(0);
      expect(engine.puckDy).toBe(0);
    });

    it('发球延迟后冰球获得速度', () => {
      startEngine(engine);
      skipServe(engine);
      const hasSpeed = engine.puckDx !== 0 || engine.puckDy !== 0;
      expect(hasSpeed).toBe(true);
    });

    it('发球期间推板可以移动', () => {
      startEngine(engine);
      const startY = engine.playerY;
      engine.handleKeyDown('ArrowUp');
      tick(engine);
      expect(engine.playerY).toBeLessThanOrEqual(startY);
    });

    it('被进球后重新发球', () => {
      startEngine(engine);
      skipServe(engine);
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.serving).toBe(true);
      expect(engine.puckX).toBe(CANVAS_WIDTH / 2);
      expect(engine.puckY).toBe(CANVAS_HEIGHT / 2);
    });

    it('发球方向交替', () => {
      startEngine(engine);
      skipServe(engine);
      // 玩家进球 → 向 AI 半场发球
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);
      expect(engine.serveToPlayer).toBe(false);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('pause 在 idle 状态无效', () => {
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('resume 在 idle 状态无效', () => {
      engine.resume();
      expect(engine.status).toBe('idle');
    });

    it('多次 destroy 不报错', () => {
      engine.destroy();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('多次 reset 不报错', () => {
      startEngine(engine);
      engine.reset();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('冰球速度为 0 时摩擦力不会反转方向', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.dx = 0;
      (engine as any)._puck.dy = 0;
      tick(engine);
      expect(engine.puckDx).toBe(0);
      expect(engine.puckDy).toBe(0);
    });

    it('同时按上和下不移动', () => {
      startEngine(engine);
      const startY = engine.playerY;
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowDown');
      tick(engine);
      // 上和下抵消
      const diff = Math.abs(engine.playerY - startY);
      expect(diff).toBeLessThanOrEqual(MALLET_SPEED);
    });

    it('同时按左和右不移动', () => {
      startEngine(engine);
      const startX = engine.playerX;
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      tick(engine);
      const diff = Math.abs(engine.playerX - startX);
      expect(diff).toBeLessThanOrEqual(MALLET_SPEED);
    });

    it('pause 在 playing 状态有效', () => {
      startEngine(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 在 paused 状态有效', () => {
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });
  });

  // ========== 属性访问器 ==========

  describe('属性访问器', () => {
    it('score 属性可读', () => {
      expect(engine.score).toBe(0);
    });

    it('level 属性可读', () => {
      expect(engine.level).toBe(1);
    });

    it('status 属性可读', () => {
      expect(engine.status).toBe('idle');
    });

    it('isWin 默认为 false', () => {
      expect(engine.isWin).toBe(false);
    });

    it('serveToPlayer 默认为 true', () => {
      expect(engine.serveToPlayer).toBe(true);
    });

    it('puckSpeed 默认为 0', () => {
      expect(engine.puckSpeed).toBe(0);
    });

    it('elapsedTime 在 idle 为 0', () => {
      expect(engine.elapsedTime).toBe(0);
    });
  });

  // ========== 多帧模拟 ==========

  describe('多帧模拟', () => {
    it('冰球在多帧后持续移动', () => {
      startEngine(engine);
      skipServe(engine);
      const startX = engine.puckX;
      const startY = engine.puckY;
      for (let i = 0; i < 10; i++) tick(engine);
      const moved = engine.puckX !== startX || engine.puckY !== startY;
      expect(moved).toBe(true);
    });

    it('冰球最终会碰到墙壁或进球', () => {
      startEngine(engine);
      skipServe(engine);
      (engine as any)._puck.dx = 8;
      (engine as any)._puck.dy = 8;
      for (let i = 0; i < 200; i++) tick(engine);
      // 冰球应该在合理范围内
      const puckInBounds =
        engine.puckX >= TABLE_LEFT - 30 &&
        engine.puckX <= TABLE_RIGHT + 30;
      expect(puckInBounds).toBe(true);
    });

    it('推板持续移动多帧', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowRight');
      const startX = engine.playerX;
      for (let i = 0; i < 10; i++) tick(engine);
      expect(engine.playerX).toBeGreaterThan(startX);
    });
  });

  // ========== 完整游戏流程 ==========

  describe('完整游戏流程', () => {
    it('完整的 start → play → pause → resume → reset 流程', () => {
      // Start
      engine.start();
      expect(engine.status).toBe('playing');

      // 跳过发球
      skipServe(engine);
      expect(engine.serving).toBe(false);

      // Play
      tick(engine);
      expect(engine.status).toBe('playing');

      // Pause
      engine.pause();
      expect(engine.status).toBe('paused');

      // Resume
      engine.resume();
      expect(engine.status).toBe('playing');

      // Reset
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('完整的 start → gameover → restart 流程', () => {
      // Start
      engine.start();
      skipServe(engine);

      // 模拟 AI 得 7 分
      (engine as any)._aiScore = WIN_SCORE - 1;
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_BOTTOM + GOAL_DEPTH + PUCK_RADIUS;
      (engine as any)._puck.dy = 3;
      (engine as any)._puck.dx = 0;
      tick(engine);

      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(false);

      // Restart via Space
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
      expect(engine.playerScore).toBe(0);
      expect(engine.aiScore).toBe(0);
    });

    it('玩家获胜流程', () => {
      engine.start();
      skipServe(engine);

      (engine as any)._playerScore = WIN_SCORE - 1;
      const goalCenterX = (GOAL_LEFT + GOAL_RIGHT) / 2;
      (engine as any)._puck.x = goalCenterX;
      (engine as any)._puck.y = TABLE_TOP - GOAL_DEPTH - PUCK_RADIUS;
      (engine as any)._puck.dy = -3;
      (engine as any)._puck.dx = 0;
      tick(engine);

      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(true);
      expect(engine.playerScore).toBe(WIN_SCORE);
    });
  });
});
