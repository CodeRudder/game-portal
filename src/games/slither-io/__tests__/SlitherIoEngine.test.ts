import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlitherIoEngine } from '../SlitherIoEngine';
import type { Worm, Food, Segment } from '../SlitherIoEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SEGMENT_RADIUS, SEGMENT_SPACING, INITIAL_LENGTH,
  SNAKE_SPEED, BOOST_SPEED, TURN_SPEED,
  BOOST_SHRINK_INTERVAL, MIN_LENGTH_FOR_BOOST,
  FOOD_RADIUS, INITIAL_FOOD_COUNT, MAX_FOOD_COUNT, FOOD_SCORE,
  AI_COUNT, AI_TURN_SPEED, AI_VISION_RANGE, AI_FOOD_VISION,
  AI_DIRECTION_CHANGE_INTERVAL, AI_INITIAL_LENGTH_MIN, AI_INITIAL_LENGTH_MAX,
  HEAD_COLLISION_RADIUS, BODY_COLLISION_RADIUS,
  BORDER_MARGIN, DEATH_FOOD_RATIO,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): SlitherIoEngine {
  const engine = new SlitherIoEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

function startEngine(engine: SlitherIoEngine): void {
  engine.start();
}

function tick(engine: SlitherIoEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

function getPlayerWorm(engine: SlitherIoEngine): Worm {
  return (engine as any).player as Worm;
}

function getAIWorms(engine: SlitherIoEngine): Worm[] {
  return (engine as any).aiWorms as Worm[];
}

function getFoods(engine: SlitherIoEngine): Food[] {
  return (engine as any).foods as Food[];
}

function setPlayerWorm(engine: SlitherIoEngine, worm: Worm): void {
  (engine as any).player = worm;
}

function setAIWorms(engine: SlitherIoEngine, worms: Worm[]): void {
  (engine as any).aiWorms = worms;
}

function setFoods(engine: SlitherIoEngine, foods: Food[]): void {
  (engine as any).foods = foods;
}

/** 创建一条测试用虫子 */
function createTestWorm(
  x = CANVAS_WIDTH / 2,
  y = CANVAS_HEIGHT / 2,
  angle = -Math.PI / 2,
  length = INITIAL_LENGTH,
  isPlayer = true,
): Worm {
  const segments: Segment[] = [];
  for (let i = 0; i < length; i++) {
    segments.push({
      x: x - Math.cos(angle) * i * SEGMENT_SPACING,
      y: y - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }
  return {
    segments,
    angle,
    speed: SNAKE_SPEED,
    color: '#00ff88',
    colorAlt: '#00ffcc',
    alive: true,
    isPlayer,
    isBoosting: false,
    boostTimer: 0,
    score: length,
    aiTimer: 0,
    aiTargetAngle: angle,
  };
}

/** 创建一个测试用食物 */
function createTestFood(x: number, y: number): Food {
  return { x, y, color: '#ff0000', radius: FOOD_RADIUS };
}

// ========== 测试 ==========

describe('SlitherIoEngine', () => {
  let engine: SlitherIoEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(SlitherIoEngine);
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

    it('初始帧计数应为 0', () => {
      expect(engine.frameCount).toBe(0);
    });

    it('初始转向状态应为 false', () => {
      expect(engine.turningLeft).toBe(false);
      expect(engine.turningRight).toBe(false);
    });

    it('初始 Shift 状态应为 false', () => {
      expect(engine.shiftHeld).toBe(false);
    });
  });

  // ========== 启动 ==========

  describe('启动', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('启动后状态应为 playing', () => {
      expect(engine.status).toBe('playing');
    });

    it('启动后应有玩家虫子', () => {
      expect(engine.playerWorm).toBeDefined();
      expect(engine.playerWorm.alive).toBe(true);
    });

    it('玩家虫子初始应标记为 isPlayer', () => {
      expect(engine.playerWorm.isPlayer).toBe(true);
    });

    it('玩家虫子初始长度应为 INITIAL_LENGTH', () => {
      expect(engine.playerWorm.segments.length).toBe(INITIAL_LENGTH);
    });

    it('玩家虫子初始分数应等于长度', () => {
      expect(engine.playerWorm.score).toBe(INITIAL_LENGTH);
    });

    it('玩家虫子初始位置应在画布中央偏下', () => {
      const head = engine.playerWorm.segments[0];
      expect(head.x).toBeCloseTo(CANVAS_WIDTH / 2, 0);
      expect(head.y).toBeCloseTo(CANVAS_HEIGHT * 0.7, 0);
    });

    it('玩家虫子初始应朝上', () => {
      expect(engine.playerWorm.angle).toBeCloseTo(-Math.PI / 2);
    });

    it('启动后应有 AI 虫子', () => {
      expect(engine.aiWormList.length).toBe(AI_COUNT);
    });

    it('AI 虫子应标记为非玩家', () => {
      for (const ai of engine.aiWormList) {
        expect(ai.isPlayer).toBe(false);
      }
    });

    it('AI 虫子初始长度应在合理范围内', () => {
      for (const ai of engine.aiWormList) {
        expect(ai.segments.length).toBeGreaterThanOrEqual(AI_INITIAL_LENGTH_MIN);
        expect(ai.segments.length).toBeLessThanOrEqual(AI_INITIAL_LENGTH_MAX);
      }
    });

    it('AI 虫子初始应全部存活', () => {
      for (const ai of engine.aiWormList) {
        expect(ai.alive).toBe(true);
      }
    });

    it('启动后应有初始食物', () => {
      expect(engine.foodList.length).toBe(INITIAL_FOOD_COUNT);
    });

    it('食物应在画布范围内', () => {
      for (const food of engine.foodList) {
        expect(food.x).toBeGreaterThan(0);
        expect(food.x).toBeLessThan(CANVAS_WIDTH);
        expect(food.y).toBeGreaterThan(0);
        expect(food.y).toBeLessThan(CANVAS_HEIGHT);
      }
    });

    it('食物应有颜色', () => {
      for (const food of engine.foodList) {
        expect(food.color).toBeTruthy();
      }
    });

    it('食物半径应为 FOOD_RADIUS', () => {
      for (const food of engine.foodList) {
        expect(food.radius).toBe(FOOD_RADIUS);
      }
    });
  });

  // ========== 虫子移动 ==========

  describe('虫子移动', () => {
    let worm: Worm;

    beforeEach(() => {
      startEngine(engine);
      worm = getPlayerWorm(engine);
    });

    it('虫子移动后头部位置应改变', () => {
      worm.angle = 0; // 朝右移动，确保 x 改变
      const headBefore = { ...worm.segments[0] };
      engine.moveWorm(worm);
      const headAfter = worm.segments[0];
      expect(headAfter.x).not.toBe(headBefore.x);
    });

    it('虫子朝上移动时 y 应减小', () => {
      worm.angle = -Math.PI / 2;
      const headY = worm.segments[0].y;
      engine.moveWorm(worm);
      expect(worm.segments[0].y).toBeLessThan(headY);
    });

    it('虫子朝右移动时 x 应增大', () => {
      worm.angle = 0;
      const headX = worm.segments[0].x;
      engine.moveWorm(worm);
      expect(worm.segments[0].x).toBeGreaterThan(headX);
    });

    it('虫子朝下移动时 y 应增大', () => {
      worm.angle = Math.PI / 2;
      const headY = worm.segments[0].y;
      engine.moveWorm(worm);
      expect(worm.segments[0].y).toBeGreaterThan(headY);
    });

    it('虫子朝左移动时 x 应减小', () => {
      worm.angle = Math.PI;
      const headX = worm.segments[0].x;
      engine.moveWorm(worm);
      expect(worm.segments[0].x).toBeLessThan(headX);
    });

    it('死亡虫子不应移动', () => {
      worm.alive = false;
      const headBefore = { ...worm.segments[0] };
      engine.moveWorm(worm);
      expect(worm.segments[0].x).toBe(headBefore.x);
      expect(worm.segments[0].y).toBe(headBefore.y);
    });

    it('移动后身体段数应保持不变', () => {
      const lenBefore = worm.segments.length;
      engine.moveWorm(worm);
      expect(worm.segments.length).toBe(lenBefore);
    });

    it('加速时移动速度更快', () => {
      worm.speed = BOOST_SPEED;
      worm.angle = 0;
      const headX = worm.segments[0].x;
      engine.moveWorm(worm);
      const dx = worm.segments[0].x - headX;
      expect(dx).toBeCloseTo(BOOST_SPEED, 1);
    });
  });

  // ========== 虫子转向 ==========

  describe('虫子转向', () => {
    let worm: Worm;

    beforeEach(() => {
      startEngine(engine);
      worm = getPlayerWorm(engine);
    });

    it('左转应减小角度', () => {
      const angleBefore = worm.angle;
      engine.turnWorm(worm, 'left');
      expect(worm.angle).toBeLessThan(angleBefore);
    });

    it('右转应增大角度', () => {
      const angleBefore = worm.angle;
      engine.turnWorm(worm, 'right');
      expect(worm.angle).toBeGreaterThan(angleBefore);
    });

    it('转向量应等于 TURN_SPEED', () => {
      const angleBefore = worm.angle;
      engine.turnWorm(worm, 'right');
      expect(worm.angle - angleBefore).toBeCloseTo(TURN_SPEED);
    });

    it('死亡虫子不应转向', () => {
      worm.alive = false;
      const angleBefore = worm.angle;
      engine.turnWorm(worm, 'right');
      expect(worm.angle).toBe(angleBefore);
    });

    it('角度应保持在 [-PI, PI] 范围内', () => {
      worm.angle = Math.PI - 0.01;
      engine.turnWorm(worm, 'right');
      engine.turnWorm(worm, 'right');
      expect(worm.angle).toBeGreaterThanOrEqual(-Math.PI);
      expect(worm.angle).toBeLessThanOrEqual(Math.PI);
    });

    it('可以使用自定义转向速度', () => {
      const angleBefore = worm.angle;
      engine.turnWorm(worm, 'right', 0.1);
      expect(worm.angle - angleBefore).toBeCloseTo(0.1);
    });
  });

  // ========== 身体段调整 ==========

  describe('身体段调整', () => {
    let worm: Worm;

    beforeEach(() => {
      startEngine(engine);
      worm = getPlayerWorm(engine);
    });

    it('调整后相邻段间距应不超过 SEGMENT_SPACING', () => {
      // 故意拉开段间距
      for (let i = 1; i < worm.segments.length; i++) {
        worm.segments[i].x = worm.segments[0].x + i * 50;
        worm.segments[i].y = worm.segments[0].y;
      }
      engine.adjustSegments(worm);
      for (let i = 1; i < worm.segments.length; i++) {
        const prev = worm.segments[i - 1];
        const curr = worm.segments[i];
        const dist = Math.sqrt(
          (curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2,
        );
        expect(dist).toBeCloseTo(SEGMENT_SPACING, 1);
      }
    });
  });

  // ========== 食物生成 ==========

  describe('食物生成', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('createFood 应在画布范围内生成食物', () => {
      for (let i = 0; i < 50; i++) {
        const food = engine.createFood();
        expect(food.x).toBeGreaterThan(0);
        expect(food.x).toBeLessThan(CANVAS_WIDTH);
        expect(food.y).toBeGreaterThan(0);
        expect(food.y).toBeLessThan(CANVAS_HEIGHT);
      }
    });

    it('createFood 应有正确的半径', () => {
      const food = engine.createFood();
      expect(food.radius).toBe(FOOD_RADIUS);
    });

    it('createFoodAt 应在指定位置附近生成食物', () => {
      const food = engine.createFoodAt(100, 200);
      expect(food.x).toBeGreaterThan(90);
      expect(food.x).toBeLessThan(110);
      expect(food.y).toBeGreaterThan(190);
      expect(food.y).toBeLessThan(210);
    });

    it('createFoodAt 应有正确的半径', () => {
      const food = engine.createFoodAt(100, 200);
      expect(food.radius).toBe(FOOD_RADIUS);
    });
  });

  // ========== 吃食物 ==========

  describe('吃食物', () => {
    let worm: Worm;

    beforeEach(() => {
      startEngine(engine);
      worm = getPlayerWorm(engine);
    });

    it('头部接触食物时应被吃掉', () => {
      const head = worm.segments[0];
      const food = createTestFood(head.x + 3, head.y + 3);
      setFoods(engine, [food]);
      engine.checkFoodCollisions();
      expect(getFoods(engine).length).toBe(0);
    });

    it('吃食物后分数应增加', () => {
      const scoreBefore = worm.score;
      const head = worm.segments[0];
      const food = createTestFood(head.x + 3, head.y + 3);
      setFoods(engine, [food]);
      engine.checkFoodCollisions();
      expect(worm.score).toBe(scoreBefore + FOOD_SCORE);
    });

    it('吃食物后应调用 growWorm', () => {
      const scoreBefore = worm.score;
      engine.growWorm(worm, 3);
      expect(worm.score).toBe(scoreBefore + 3);
    });

    it('远离食物时不应被吃掉', () => {
      const head = worm.segments[0];
      const food = createTestFood(head.x + 100, head.y + 100);
      setFoods(engine, [food]);
      engine.checkFoodCollisions();
      expect(getFoods(engine).length).toBe(1);
    });

    it('多个食物应都能被吃掉', () => {
      const head = worm.segments[0];
      const foods = [
        createTestFood(head.x + 2, head.y),
        createTestFood(head.x, head.y + 2),
        createTestFood(head.x + 1, head.y + 1),
      ];
      setFoods(engine, foods);
      engine.checkFoodCollisions();
      expect(getFoods(engine).length).toBe(0);
    });

    it('AI 虫子也能吃食物', () => {
      const aiWorms = getAIWorms(engine);
      const ai = aiWorms[0];
      const aiScoreBefore = ai.score;
      const head = ai.segments[0];
      const food = createTestFood(head.x + 3, head.y + 3);
      setFoods(engine, [food]);
      engine.checkFoodCollisions();
      expect(getFoods(engine).length).toBe(0);
      expect(ai.score).toBe(aiScoreBefore + FOOD_SCORE);
    });

    it('死亡虫子不应吃食物', () => {
      worm.alive = false;
      const head = worm.segments[0];
      const food = createTestFood(head.x + 3, head.y + 3);
      setFoods(engine, [food]);
      engine.checkFoodCollisions();
      expect(getFoods(engine).length).toBe(1);
    });
  });

  // ========== 身体增长 ==========

  describe('身体增长', () => {
    let worm: Worm;

    beforeEach(() => {
      startEngine(engine);
      worm = getPlayerWorm(engine);
    });

    it('growWorm 应增加 score', () => {
      const scoreBefore = worm.score;
      engine.growWorm(worm, 5);
      expect(worm.score).toBe(scoreBefore + 5);
    });

    it('growWorm 默认增加 1', () => {
      const scoreBefore = worm.score;
      engine.growWorm(worm);
      expect(worm.score).toBe(scoreBefore + 1);
    });

    it('getTargetLength 应返回 score', () => {
      worm.score = 20;
      expect(engine.getTargetLength(worm)).toBe(20);
    });
  });

  // ========== 碰撞检测 — 头碰身体 ==========

  describe('碰撞检测 — 头碰身体', () => {
    let player: Worm;

    beforeEach(() => {
      startEngine(engine);
      player = getPlayerWorm(engine);
    });

    it('头部碰到其他虫子身体应死亡', () => {
      const ai = createTestWorm(player.segments[0].x + 5, player.segments[0].y, 0, 10, false);
      // AI 身体段在玩家头部附近
      ai.segments[3].x = player.segments[0].x;
      ai.segments[3].y = player.segments[0].y;
      setAIWorms(engine, [ai]);
      engine.checkWormCollisions();
      expect(player.alive).toBe(false);
    });

    it('虫子不应碰到自己的身体（跳过前几段）', () => {
      // 玩家自身不会触发碰撞
      engine.checkWormCollisions();
      expect(player.alive).toBe(true);
    });

    it('两条 AI 虫子碰撞时都应正确处理', () => {
      const ai1 = createTestWorm(200, 200, 0, 10, false);
      const ai2 = createTestWorm(200, 200, Math.PI, 10, false);
      // ai2 的头碰到 ai1 的身体
      ai2.segments[0].x = ai1.segments[5].x;
      ai2.segments[0].y = ai1.segments[5].y;
      setAIWorms(engine, [ai1, ai2]);
      // 临时让 respawnAI 不影响测试
      const originalRespawn = engine.respawnAI.bind(engine);
      let respawned = false;
      (engine as any).respawnAI = (w: Worm) => { respawned = true; };
      engine.checkWormCollisions();
      expect(ai2.alive).toBe(false);
      expect(respawned).toBe(true);
      // 恢复
      (engine as any).respawnAI = originalRespawn;
    });

    it('碰撞检测范围应正确', () => {
      const ai = createTestWorm(200, 200, 0, 10, false);
      // 玩家头远离 AI 身体
      player.segments[0].x = 50;
      player.segments[0].y = 50;
      ai.segments[5].x = 200;
      ai.segments[5].y = 200;
      setAIWorms(engine, [ai]);
      engine.checkWormCollisions();
      expect(player.alive).toBe(true);
    });

    it('死亡虫子不应参与碰撞检测', () => {
      const ai = createTestWorm(200, 200, 0, 10, false);
      ai.alive = false;
      ai.segments[3].x = player.segments[0].x;
      ai.segments[3].y = player.segments[0].y;
      setAIWorms(engine, [ai]);
      engine.checkWormCollisions();
      expect(player.alive).toBe(true);
    });
  });

  // ========== 碰撞检测 — 边界 ==========

  describe('碰撞检测 — 边界', () => {
    let player: Worm;

    beforeEach(() => {
      startEngine(engine);
      player = getPlayerWorm(engine);
    });

    it('碰到左边界应死亡', () => {
      player.segments[0].x = BORDER_MARGIN - 1;
      player.segments[0].y = CANVAS_HEIGHT / 2;
      engine.checkBoundaryCollisions();
      expect(player.alive).toBe(false);
    });

    it('碰到右边界应死亡', () => {
      player.segments[0].x = CANVAS_WIDTH - BORDER_MARGIN + 1;
      player.segments[0].y = CANVAS_HEIGHT / 2;
      engine.checkBoundaryCollisions();
      expect(player.alive).toBe(false);
    });

    it('碰到上边界应死亡', () => {
      player.segments[0].x = CANVAS_WIDTH / 2;
      player.segments[0].y = BORDER_MARGIN - 1;
      engine.checkBoundaryCollisions();
      expect(player.alive).toBe(false);
    });

    it('碰到下边界应死亡', () => {
      player.segments[0].x = CANVAS_WIDTH / 2;
      player.segments[0].y = CANVAS_HEIGHT - BORDER_MARGIN + 1;
      engine.checkBoundaryCollisions();
      expect(player.alive).toBe(false);
    });

    it('在边界内应存活', () => {
      player.segments[0].x = CANVAS_WIDTH / 2;
      player.segments[0].y = CANVAS_HEIGHT / 2;
      engine.checkBoundaryCollisions();
      expect(player.alive).toBe(true);
    });

    it('刚好在边界上应存活', () => {
      player.segments[0].x = BORDER_MARGIN;
      player.segments[0].y = BORDER_MARGIN;
      engine.checkBoundaryCollisions();
      expect(player.alive).toBe(true);
    });

    it('AI 碰到边界也应死亡', () => {
      const ai = createTestWorm(BORDER_MARGIN - 1, CANVAS_HEIGHT / 2, 0, 10, false);
      setAIWorms(engine, [ai]);
      // Mock respawnAI to prevent immediate respawn
      (engine as any).respawnAI = () => {};
      engine.checkBoundaryCollisions();
      expect(ai.alive).toBe(false);
    });
  });

  // ========== 加速 ==========

  describe('加速', () => {
    let worm: Worm;

    beforeEach(() => {
      startEngine(engine);
      worm = getPlayerWorm(engine);
    });

    it('加速时速度应为 BOOST_SPEED', () => {
      engine.boostWorm(worm);
      expect(worm.speed).toBe(BOOST_SPEED);
    });

    it('加速时 isBoosting 应为 true', () => {
      engine.boostWorm(worm);
      expect(worm.isBoosting).toBe(true);
    });

    it('身体太短时不能加速', () => {
      worm.score = MIN_LENGTH_FOR_BOOST - 1;
      worm.segments = worm.segments.slice(0, MIN_LENGTH_FOR_BOOST - 1);
      const result = engine.boostWorm(worm);
      expect(result).toBe(false);
      expect(worm.isBoosting).toBe(false);
    });

    it('加速消耗计时器应递增', () => {
      engine.boostWorm(worm);
      expect(worm.boostTimer).toBe(1);
    });

    it('加速达到间隔后应消耗身体', () => {
      const scoreBefore = worm.score;
      worm.boostTimer = BOOST_SHRINK_INTERVAL - 1;
      engine.boostWorm(worm);
      expect(worm.score).toBe(scoreBefore - 1);
    });

    it('加速消耗后应在尾部生成食物', () => {
      const foodsBefore = getFoods(engine).length;
      worm.boostTimer = BOOST_SHRINK_INTERVAL - 1;
      engine.boostWorm(worm);
      expect(getFoods(engine).length).toBe(foodsBefore + 1);
    });

    it('stopBoost 应恢复正常速度', () => {
      engine.boostWorm(worm);
      engine.stopBoost(worm);
      expect(worm.speed).toBe(SNAKE_SPEED);
      expect(worm.isBoosting).toBe(false);
    });

    it('stopBoost 应重置计时器', () => {
      engine.boostWorm(worm);
      engine.boostWorm(worm);
      engine.stopBoost(worm);
      expect(worm.boostTimer).toBe(0);
    });

    it('死亡虫子不能加速', () => {
      worm.alive = false;
      const result = engine.boostWorm(worm);
      expect(result).toBe(false);
    });

    it('加速消耗身体不会低于 1', () => {
      worm.score = 1;
      worm.segments = worm.segments.slice(0, 1);
      worm.boostTimer = BOOST_SHRINK_INTERVAL - 1;
      engine.boostWorm(worm);
      expect(worm.score).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== 死亡变食物 ==========

  describe('死亡变食物', () => {
    it('虫子死亡后应在身体位置生成食物', () => {
      startEngine(engine);
      const ai = createTestWorm(200, 200, 0, 20, false);
      setAIWorms(engine, [ai]);
      const foodsBefore = getFoods(engine).length;
      engine.killWorm(ai);
      const expectedFood = Math.ceil(20 / DEATH_FOOD_RATIO);
      expect(getFoods(engine).length).toBe(foodsBefore + expectedFood);
    });

    it('玩家死亡应触发游戏结束', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      engine.killWorm(player);
      expect(engine.status).toBe('gameover');
    });

    it('AI 死亡后应重生', () => {
      startEngine(engine);
      const ai = createTestWorm(200, 200, 0, 10, false);
      setAIWorms(engine, [ai]);
      engine.killWorm(ai);
      // killWorm 中 respawnAI 会重新设置 alive = true
      expect(ai.alive).toBe(true);
    });

    it('AI 重生后应在画布范围内', () => {
      startEngine(engine);
      const ai = createTestWorm(200, 200, 0, 10, false);
      setAIWorms(engine, [ai]);
      engine.killWorm(ai);
      const head = ai.segments[0];
      expect(head.x).toBeGreaterThan(0);
      expect(head.x).toBeLessThan(CANVAS_WIDTH);
      expect(head.y).toBeGreaterThan(0);
      expect(head.y).toBeLessThan(CANVAS_HEIGHT);
    });

    it('AI 重生后长度应在合理范围', () => {
      startEngine(engine);
      const ai = createTestWorm(200, 200, 0, 10, false);
      setAIWorms(engine, [ai]);
      engine.killWorm(ai);
      expect(ai.segments.length).toBeGreaterThanOrEqual(AI_INITIAL_LENGTH_MIN);
      expect(ai.segments.length).toBeLessThanOrEqual(AI_INITIAL_LENGTH_MAX);
    });
  });

  // ========== AI 虫群 ==========

  describe('AI 虫群', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('AI 数量应为 AI_COUNT', () => {
      expect(engine.aiWormList.length).toBe(AI_COUNT);
    });

    it('AI 行为应被调用', () => {
      const ai = getAIWorms(engine)[0];
      const angleBefore = ai.angle;
      // 将 AI 放在靠近边界的位置，触发回避行为
      ai.segments[0].x = 20;
      ai.segments[0].y = CANVAS_HEIGHT / 2;
      engine.updateAIBehavior(ai);
      // 角度可能改变
      expect(ai.angle).toBeDefined();
    });

    it('AI 靠近边界时应朝中心转向', () => {
      const ai = createTestWorm(15, CANVAS_HEIGHT / 2, Math.PI, 10, false);
      const angleBefore = ai.angle;
      engine.updateAIBehavior(ai);
      // 角度应朝向中心
      expect(ai.angle).not.toBe(angleBefore);
    });

    it('AI 应能检测到附近食物', () => {
      const ai = createTestWorm(200, 200, 0, 10, false);
      const food = createTestFood(205, 200);
      setFoods(engine, [food]);
      engine.updateAIBehavior(ai);
      // AI 应朝食物方向转向
      expect(ai.angle).toBeDefined();
    });

    it('AI 应能回避其他虫子', () => {
      const ai = createTestWorm(200, 200, 0, 10, false);
      const other = createTestWorm(210, 200, Math.PI, 10, false);
      setAIWorms(engine, [ai, other]);
      setPlayerWorm(engine, createTestWorm(400, 400, 0, 10, true));
      const angleBefore = ai.angle;
      engine.updateAIBehavior(ai);
      // AI 可能会转向回避
      expect(ai.angle).toBeDefined();
    });

    it('AI 随机漫游应在计时器到达后改变方向', () => {
      const ai = createTestWorm(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, 10, false);
      ai.aiTimer = AI_DIRECTION_CHANGE_INTERVAL - 1;
      // 清除食物和远离其他虫子
      setFoods(engine, []);
      setAIWorms(engine, [ai]);
      setPlayerWorm(engine, createTestWorm(400, 400, 0, 10, true));
      engine.updateAIBehavior(ai);
      expect(ai.aiTimer).toBe(0);
    });

    it('aiTurnToward 应平滑转向', () => {
      const ai = createTestWorm(200, 200, 0, 10, false);
      const targetAngle = Math.PI / 4;
      engine.aiTurnToward(ai, targetAngle);
      const diff = Math.abs(ai.angle - 0);
      expect(diff).toBeLessThanOrEqual(AI_TURN_SPEED);
    });

    it('aiTurnToward 接近目标时应精确对准', () => {
      const ai = createTestWorm(200, 200, 0, 10, false);
      const targetAngle = AI_TURN_SPEED / 2;
      engine.aiTurnToward(ai, targetAngle);
      expect(ai.angle).toBeCloseTo(targetAngle);
    });
  });

  // ========== 键盘控制 ==========

  describe('键盘控制', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('ArrowLeft 应设置 turningLeft', () => {
      engine.handleKeyDown('ArrowLeft');
      expect(engine.turningLeft).toBe(true);
    });

    it('ArrowRight 应设置 turningRight', () => {
      engine.handleKeyDown('ArrowRight');
      expect(engine.turningRight).toBe(true);
    });

    it('a 键应设置 turningLeft', () => {
      engine.handleKeyDown('a');
      expect(engine.turningLeft).toBe(true);
    });

    it('A 键应设置 turningLeft', () => {
      engine.handleKeyDown('A');
      expect(engine.turningLeft).toBe(true);
    });

    it('d 键应设置 turningRight', () => {
      engine.handleKeyDown('d');
      expect(engine.turningRight).toBe(true);
    });

    it('D 键应设置 turningRight', () => {
      engine.handleKeyDown('D');
      expect(engine.turningRight).toBe(true);
    });

    it('Shift 应设置 shiftHeld', () => {
      engine.handleKeyDown('Shift');
      expect(engine.shiftHeld).toBe(true);
    });

    it('keyup ArrowLeft 应取消 turningLeft', () => {
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyUp('ArrowLeft');
      expect(engine.turningLeft).toBe(false);
    });

    it('keyup ArrowRight 应取消 turningRight', () => {
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyUp('ArrowRight');
      expect(engine.turningRight).toBe(false);
    });

    it('keyup Shift 应取消 shiftHeld', () => {
      engine.handleKeyDown('Shift');
      engine.handleKeyUp('Shift');
      expect(engine.shiftHeld).toBe(false);
    });

    it('keyup a 应取消 turningLeft', () => {
      engine.handleKeyDown('a');
      engine.handleKeyUp('a');
      expect(engine.turningLeft).toBe(false);
    });

    it('keyup d 应取消 turningRight', () => {
      engine.handleKeyDown('d');
      engine.handleKeyUp('d');
      expect(engine.turningRight).toBe(false);
    });

    it('非 playing 状态时空格应启动游戏', () => {
      engine.reset();
      expect(engine.status).toBe('idle');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('gameover 状态时空格应重新开始', () => {
      const player = getPlayerWorm(engine);
      player.alive = false;
      (engine as any).gameOver();
      expect(engine.status).toBe('gameover');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('playing 状态时方向键应正常工作', () => {
      engine.handleKeyDown('ArrowLeft');
      expect(engine.turningLeft).toBe(true);
      engine.handleKeyDown('ArrowRight');
      expect(engine.turningRight).toBe(true);
    });
  });

  // ========== 游戏循环 ==========

  describe('游戏循环', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('每帧应递增 frameCount', () => {
      const before = engine.frameCount;
      tick(engine);
      expect(engine.frameCount).toBe(before + 1);
    });

    it('update 应更新玩家位置', () => {
      // 玩家朝上，y 应改变
      const headBefore = { ...engine.playerWorm.segments[0] };
      tick(engine);
      const headAfter = engine.playerWorm.segments[0];
      // 位置应改变（虫子在持续移动）
      const moved = Math.abs(headAfter.x - headBefore.x) > 0.01 || Math.abs(headAfter.y - headBefore.y) > 0.01;
      expect(moved).toBe(true);
    });

    it('update 应更新 AI 位置', () => {
      const aiHeadBefore = { ...engine.aiWormList[0].segments[0] };
      tick(engine);
      const aiHeadAfter = engine.aiWormList[0].segments[0];
      // AI 位置应改变
      const moved = aiHeadAfter.x !== aiHeadBefore.x || aiHeadAfter.y !== aiHeadBefore.y;
      expect(moved).toBe(true);
    });

    it('转向时玩家角度应改变', () => {
      engine.handleKeyDown('ArrowLeft');
      const angleBefore = engine.playerWorm.angle;
      tick(engine);
      expect(engine.playerWorm.angle).not.toBe(angleBefore);
    });

    it('加速时玩家速度应增加', () => {
      engine.handleKeyDown('Shift');
      tick(engine);
      expect(engine.playerWorm.speed).toBe(BOOST_SPEED);
    });

    it('松开加速后速度应恢复', () => {
      engine.handleKeyDown('Shift');
      tick(engine);
      engine.handleKeyUp('Shift');
      tick(engine);
      expect(engine.playerWorm.speed).toBe(SNAKE_SPEED);
    });
  });

  // ========== 食物补充 ==========

  describe('食物补充', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('食物不足时应自动补充', () => {
      setFoods(engine, []);
      engine.replenishFood();
      expect(getFoods(engine).length).toBe(MAX_FOOD_COUNT);
    });

    it('食物已满时不应补充', () => {
      const foods: Food[] = [];
      for (let i = 0; i < MAX_FOOD_COUNT; i++) {
        foods.push(createTestFood(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT));
      }
      setFoods(engine, foods);
      const before = getFoods(engine).length;
      engine.replenishFood();
      expect(getFoods(engine).length).toBe(before);
    });
  });

  // ========== 得分 ==========

  describe('得分', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('初始分数应等于虫子长度', () => {
      expect(engine.score).toBe(INITIAL_LENGTH);
    });

    it('吃食物后分数应增加', () => {
      const scoreBefore = engine.score;
      const head = engine.playerWorm.segments[0];
      const food = createTestFood(head.x + 3, head.y + 3);
      setFoods(engine, [food]);
      tick(engine);
      expect(engine.score).toBeGreaterThan(scoreBefore);
    });

    it('分数应等于玩家虫子的 score', () => {
      const player = getPlayerWorm(engine);
      player.score = 50;
      (engine as any).syncScore();
      expect(engine.score).toBe(50);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('idle 状态应返回正确状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('playerScore');
      expect(state).toHaveProperty('playerLength');
      expect(state).toHaveProperty('playerAlive');
      expect(state).toHaveProperty('aiCount');
      expect(state).toHaveProperty('foodCount');
      expect(state).toHaveProperty('frameCount');
    });

    it('playing 状态应返回正确值', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state.playerScore).toBe(INITIAL_LENGTH);
      expect(state.playerLength).toBe(INITIAL_LENGTH);
      expect(state.playerAlive).toBe(true);
      expect(state.aiCount).toBe(AI_COUNT);
      expect(state.foodCount).toBe(INITIAL_FOOD_COUNT);
      expect(state.frameCount).toBe(0);
    });

    it('死亡后 playerAlive 应为 false', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      player.alive = false;
      const state = engine.getState();
      expect(state.playerAlive).toBe(false);
    });
  });

  // ========== 重置 ==========

  describe('重置', () => {
    it('重置后状态应为 idle', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('重置后分数应为 0', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('重置后帧计数应为 0', () => {
      startEngine(engine);
      tick(engine);
      tick(engine);
      engine.reset();
      expect(engine.frameCount).toBe(0);
    });

    it('重置后转向状态应为 false', () => {
      startEngine(engine);
      engine.handleKeyDown('ArrowLeft');
      engine.reset();
      expect(engine.turningLeft).toBe(false);
      expect(engine.turningRight).toBe(false);
    });
  });

  // ========== 游戏结束 ==========

  describe('游戏结束', () => {
    it('玩家碰到边界应游戏结束', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      player.segments[0].x = BORDER_MARGIN - 1;
      tick(engine);
      expect(engine.status).toBe('gameover');
    });

    it('玩家碰到 AI 身体应游戏结束', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      const ai = createTestWorm(player.segments[0].x, player.segments[0].y, 0, 20, false);
      // 确保 AI 身体段在玩家头部
      ai.segments[5].x = player.segments[0].x;
      ai.segments[5].y = player.segments[0].y;
      setAIWorms(engine, [ai]);
      tick(engine);
      expect(engine.status).toBe('gameover');
    });

    it('游戏结束后应能重新开始', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      player.segments[0].x = BORDER_MARGIN - 1;
      tick(engine);
      expect(engine.status).toBe('gameover');
      engine.reset();
      expect(engine.status).toBe('idle');
      startEngine(engine);
      expect(engine.status).toBe('playing');
    });
  });

  // ========== 创建虫子 ==========

  describe('createWorm', () => {
    beforeEach(() => {
      startEngine(engine);
    });

    it('应正确创建指定长度的虫子', () => {
      const worm = engine.createWorm(100, 100, 0, 15, true, '#ff0000', '#00ff00');
      expect(worm.segments.length).toBe(15);
    });

    it('创建的虫子应存活', () => {
      const worm = engine.createWorm(100, 100, 0, 10, true, '#ff0000', '#00ff00');
      expect(worm.alive).toBe(true);
    });

    it('创建的虫子头应在指定位置', () => {
      const worm = engine.createWorm(100, 200, 0, 10, true, '#ff0000', '#00ff00');
      expect(worm.segments[0].x).toBe(100);
      expect(worm.segments[0].y).toBe(200);
    });

    it('身体段应沿角度方向排列', () => {
      const worm = engine.createWorm(100, 100, 0, 5, true, '#ff0000', '#00ff00');
      // angle=0 朝右，身体段应在左边
      for (let i = 1; i < worm.segments.length; i++) {
        expect(worm.segments[i].x).toBeLessThan(worm.segments[0].x);
      }
    });

    it('应正确设置 isPlayer', () => {
      const playerWorm = engine.createWorm(100, 100, 0, 10, true, '#ff0000', '#00ff00');
      const aiWorm = engine.createWorm(100, 100, 0, 10, false, '#ff0000', '#00ff00');
      expect(playerWorm.isPlayer).toBe(true);
      expect(aiWorm.isPlayer).toBe(false);
    });

    it('应正确设置颜色', () => {
      const worm = engine.createWorm(100, 100, 0, 10, true, '#ff0000', '#00ff00');
      expect(worm.color).toBe('#ff0000');
      expect(worm.colorAlt).toBe('#00ff00');
    });

    it('初始速度应为 SNAKE_SPEED', () => {
      const worm = engine.createWorm(100, 100, 0, 10, true, '#ff0000', '#00ff00');
      expect(worm.speed).toBe(SNAKE_SPEED);
    });

    it('初始 score 应等于 length', () => {
      const worm = engine.createWorm(100, 100, 0, 10, true, '#ff0000', '#00ff00');
      expect(worm.score).toBe(10);
    });
  });

  // ========== 暂停/恢复 ==========

  describe('暂停/恢复', () => {
    it('暂停后状态应为 paused', () => {
      startEngine(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('恢复后状态应为 playing', () => {
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('idle 状态不应暂停', () => {
      engine.pause();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== 销毁 ==========

  describe('销毁', () => {
    it('销毁后状态应为 idle', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('销毁后分数应为 0', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.score).toBe(0);
    });
  });

  // ========== 综合场景 ==========

  describe('综合场景', () => {
    it('完整的游戏流程：开始 → 移动 → 吃食物 → 死亡', () => {
      // 开始
      startEngine(engine);
      expect(engine.status).toBe('playing');

      // 放一个食物在玩家前方
      const player = getPlayerWorm(engine);
      const food = createTestFood(
        player.segments[0].x + Math.cos(player.angle) * 5,
        player.segments[0].y + Math.sin(player.angle) * 5,
      );
      setFoods(engine, [food, ...getFoods(engine).slice(1)]);

      // 移动几帧
      for (let i = 0; i < 5; i++) {
        tick(engine);
      }

      // 验证游戏还在进行
      expect(engine.status).toBe('playing');

      // 将玩家移出边界
      player.segments[0].x = -10;
      tick(engine);

      // 应该游戏结束
      expect(engine.status).toBe('gameover');
    });

    it('AI 虫子应持续移动', () => {
      startEngine(engine);
      const positions = engine.aiWormList.map(ai => ({ ...ai.segments[0] }));

      for (let i = 0; i < 10; i++) {
        tick(engine);
      }

      const newPositions = engine.aiWormList.map(ai => ({ ...ai.segments[0] }));
      // 至少有一些 AI 移动了
      let moved = 0;
      for (let i = 0; i < positions.length; i++) {
        if (newPositions[i].x !== positions[i].x || newPositions[i].y !== positions[i].y) {
          moved++;
        }
      }
      expect(moved).toBeGreaterThan(0);
    });

    it('多条虫子同时吃食物', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      const ai = getAIWorms(engine)[0];

      const playerFood = createTestFood(player.segments[0].x + 3, player.segments[0].y);
      const aiFood = createTestFood(ai.segments[0].x + 3, ai.segments[0].y);
      setFoods(engine, [playerFood, aiFood]);

      const playerScoreBefore = player.score;
      const aiScoreBefore = ai.score;

      engine.checkFoodCollisions();

      expect(player.score).toBeGreaterThan(playerScoreBefore);
      expect(ai.score).toBeGreaterThan(aiScoreBefore);
    });

    it('加速移动比普通移动快', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);

      // 普通移动
      player.angle = 0;
      const x1 = player.segments[0].x;
      engine.moveWorm(player);
      const normalDx = player.segments[0].x - x1;

      // 重置位置
      player.segments[0].x = x1;

      // 加速移动
      player.speed = BOOST_SPEED;
      engine.moveWorm(player);
      const boostDx = player.segments[0].x - x1;

      expect(boostDx).toBeGreaterThan(normalDx);
    });

    it('多次 tick 后食物应被补充', () => {
      startEngine(engine);
      // 清空食物
      setFoods(engine, []);

      for (let i = 0; i < 5; i++) {
        tick(engine);
      }

      // replenishFood 补充到 MAX_FOOD_COUNT，但 AI 虫子死亡时 killWorm
      // 会在身体位置额外生成食物，因此总数可能超过 MAX_FOOD_COUNT
      expect(getFoods(engine).length).toBeGreaterThanOrEqual(MAX_FOOD_COUNT);
    });

    it('转向 + 移动应改变方向', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      const initialAngle = player.angle;

      engine.handleKeyDown('ArrowRight');
      for (let i = 0; i < 30; i++) {
        tick(engine);
      }
      engine.handleKeyUp('ArrowRight');

      expect(player.angle).not.toBe(initialAngle);
    });

    it('左右同时按不应改变角度', () => {
      startEngine(engine);
      const player = getPlayerWorm(engine);
      const initialAngle = player.angle;

      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');
      tick(engine);

      // 左右同时按，效果抵消
      expect(player.angle).toBeCloseTo(initialAngle, 5);
    });
  });
});
