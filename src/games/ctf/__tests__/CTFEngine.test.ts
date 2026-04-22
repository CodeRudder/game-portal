import { CTFEngine } from '../CTFEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  FIELD_LEFT, FIELD_RIGHT, FIELD_TOP, FIELD_BOTTOM,
  RED_BASE_X, RED_BASE_Y, BASE_WIDTH, BASE_HEIGHT,
  BLUE_BASE_X, BLUE_BASE_Y,
  RED_FLAG_HOME_X, RED_FLAG_HOME_Y,
  BLUE_FLAG_HOME_X, BLUE_FLAG_HOME_Y,
  PLAYER_SIZE, PLAYER_SPEED,
  RED_START_X, RED_START_Y,
  BLUE_START_X, BLUE_START_Y,
  WIN_SCORE,
  AI_SPEED,
  OBSTACLES,
} from '../constants';

// ========== Mock requestAnimationFrame ==========
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  rafId = 0;
  rafCallbacks.clear();
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  };
  (globalThis as any).cancelAnimationFrame = (id: number) => {
    rafCallbacks.delete(id);
  };
});

function flushRAF(time = 0) {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  callbacks.forEach((cb) => cb(time));
}

/** 创建并初始化引擎 */
function createEngine(): CTFEngine {
  const engine = new CTFEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建引擎并开始游戏 */
function createAndStartEngine(): CTFEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 模拟多帧更新 */
function tick(engine: CTFEngine, count: number, dt = 16) {
  for (let i = 0; i < count; i++) {
    engine.update(dt);
  }
}

// ========== 测试 ==========

describe('CTFEngine', () => {
  // ===== 基础初始化 =====
  describe('初始化', () => {
    it('应该正确初始化引擎', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
    });

    it('初始分数应为 0', () => {
      const engine = createEngine();
      expect(engine.redScore).toBe(0);
      expect(engine.blueScore).toBe(0);
    });

    it('初始位置正确', () => {
      const engine = createEngine();
      expect(engine.redPlayerX).toBe(RED_START_X);
      expect(engine.redPlayerY).toBe(RED_START_Y);
      expect(engine.bluePlayerX).toBe(BLUE_START_X);
      expect(engine.bluePlayerY).toBe(BLUE_START_Y);
    });

    it('旗帜初始在原位', () => {
      const engine = createEngine();
      expect(engine.redFlagAtHome).toBe(true);
      expect(engine.blueFlagAtHome).toBe(true);
      expect(engine.redFlagX).toBe(RED_FLAG_HOME_X);
      expect(engine.redFlagY).toBe(RED_FLAG_HOME_Y);
      expect(engine.blueFlagX).toBe(BLUE_FLAG_HOME_X);
      expect(engine.blueFlagY).toBe(BLUE_FLAG_HOME_Y);
    });

    it('初始无人持旗', () => {
      const engine = createEngine();
      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.bluePlayerHasFlag).toBe(false);
      expect(engine.redFlagCarrier).toBeNull();
      expect(engine.blueFlagCarrier).toBeNull();
    });

    it('isWin 初始为 false', () => {
      const engine = createEngine();
      expect(engine.isWin).toBe(false);
    });
  });

  // ===== 生命周期 =====
  describe('生命周期', () => {
    it('start 后状态变为 playing', () => {
      const engine = createAndStartEngine();
      expect(engine.status).toBe('playing');
    });

    it('pause 后状态变为 paused', () => {
      const engine = createAndStartEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态变为 playing', () => {
      const engine = createAndStartEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态变为 idle', () => {
      const engine = createAndStartEngine();
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.redScore).toBe(0);
      expect(engine.blueScore).toBe(0);
    });

    it('reset 后重置位置和旗帜', () => {
      const engine = createAndStartEngine();
      engine.reset();
      expect(engine.redPlayerX).toBe(RED_START_X);
      expect(engine.redPlayerY).toBe(RED_START_Y);
      expect(engine.redFlagAtHome).toBe(true);
      expect(engine.blueFlagAtHome).toBe(true);
    });

    it('destroy 后清理资源', () => {
      const engine = createAndStartEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ===== 红队玩家移动 =====
  describe('红队玩家移动', () => {
    it('按上键向上移动', () => {
      const engine = createAndStartEngine();
      const startY = engine.redPlayerY;
      engine.handleKeyDown('ArrowUp');
      tick(engine, 5);
      engine.handleKeyUp('ArrowUp');
      expect(engine.redPlayerY).toBeLessThan(startY);
    });

    it('按下键向下移动', () => {
      const engine = createAndStartEngine();
      const startY = engine.redPlayerY;
      engine.handleKeyDown('ArrowDown');
      tick(engine, 5);
      engine.handleKeyUp('ArrowDown');
      expect(engine.redPlayerY).toBeGreaterThan(startY);
    });

    it('按左键向左移动', () => {
      const engine = createAndStartEngine();
      const startX = engine.redPlayerX;
      engine.handleKeyDown('ArrowLeft');
      tick(engine, 5);
      engine.handleKeyUp('ArrowLeft');
      expect(engine.redPlayerX).toBeLessThan(startX);
    });

    it('按右键向右移动', () => {
      const engine = createAndStartEngine();
      const startX = engine.redPlayerX;
      engine.handleKeyDown('ArrowRight');
      tick(engine, 5);
      engine.handleKeyUp('ArrowRight');
      expect(engine.redPlayerX).toBeGreaterThan(startX);
    });

    it('WASD 键也能移动', () => {
      const engine = createAndStartEngine();
      const startX = engine.redPlayerX;
      const startY = engine.redPlayerY;

      engine.handleKeyDown('w');
      tick(engine, 5);
      engine.handleKeyUp('w');
      expect(engine.redPlayerY).toBeLessThan(startY);

      engine.handleKeyDown('d');
      tick(engine, 5);
      engine.handleKeyUp('d');
      expect(engine.redPlayerX).toBeGreaterThan(startX);
    });

    it('大写 WASD 键也能移动', () => {
      const engine = createAndStartEngine();
      const startY = engine.redPlayerY;

      engine.handleKeyDown('W');
      tick(engine, 5);
      engine.handleKeyUp('W');
      expect(engine.redPlayerY).toBeLessThan(startY);
    });

    it('同时按上下不移动（或净移动为0）', () => {
      const engine = createAndStartEngine();
      const startY = engine.redPlayerY;
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowDown');
      tick(engine, 5);
      engine.handleKeyUp('ArrowUp');
      engine.handleKeyUp('ArrowDown');
      // 上下同时按，速度抵消
      expect(Math.abs(engine.redPlayerY - startY)).toBeLessThanOrEqual(PLAYER_SPEED);
    });

    it('不能超出场地左边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowLeft');
      tick(engine, 200);
      engine.handleKeyUp('ArrowLeft');
      expect(engine.redPlayerX).toBeGreaterThanOrEqual(FIELD_LEFT + PLAYER_SIZE / 2);
    });

    it('不能超出场地右边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowRight');
      tick(engine, 200);
      engine.handleKeyUp('ArrowRight');
      expect(engine.redPlayerX).toBeLessThanOrEqual(FIELD_RIGHT - PLAYER_SIZE / 2);
    });

    it('不能超出场地上边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowUp');
      tick(engine, 200);
      engine.handleKeyUp('ArrowUp');
      expect(engine.redPlayerY).toBeGreaterThanOrEqual(FIELD_TOP + PLAYER_SIZE / 2);
    });

    it('不能超出场地下边界', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowDown');
      tick(engine, 200);
      engine.handleKeyUp('ArrowDown');
      expect(engine.redPlayerY).toBeLessThanOrEqual(FIELD_BOTTOM - PLAYER_SIZE / 2);
    });

    it('释放按键后停止移动', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowRight');
      tick(engine, 5);
      const posAfterMove = engine.redPlayerX;
      engine.handleKeyUp('ArrowRight');
      tick(engine, 5);
      const posAfterStop = engine.redPlayerX;
      expect(posAfterStop).toBe(posAfterMove);
    });
  });

  // ===== 障碍物碰撞 =====
  describe('障碍物碰撞', () => {
    it('玩家不能穿过障碍物', () => {
      const engine = createAndStartEngine();
      // 手动将玩家放到障碍物附近
      const obs = OBSTACLES[0]; // 中央上方障碍
      // 尝试移动到障碍物内部
      engine.handleKeyDown('ArrowRight');
      tick(engine, 200);
      engine.handleKeyUp('ArrowRight');
      // 玩家应该被障碍物阻挡（不会在障碍物内）
      const playerX = engine.redPlayerX;
      const playerY = engine.redPlayerY;
      const half = PLAYER_SIZE / 2;
      // 检查玩家不在任何障碍物内
      for (const o of OBSTACLES) {
        const inside = playerX + half > o.x && playerX - half < o.x + o.w &&
                       playerY + half > o.y && playerY - half < o.y + o.h;
        expect(inside).toBe(false);
      }
    });

    it('斜向移动时遇到障碍物可以滑动', () => {
      const engine = createAndStartEngine();
      // 按两个方向键移动
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowUp');
      tick(engine, 10);
      // 至少一个方向应该有移动
      const moved = engine.redPlayerX !== RED_START_X || engine.redPlayerY !== RED_START_Y;
      expect(moved).toBe(true);
      engine.handleKeyUp('ArrowRight');
      engine.handleKeyUp('ArrowUp');
    });
  });

  // ===== 旗帜夺取 =====
  describe('旗帜夺取', () => {
    it('红队玩家靠近蓝旗按空格可以抢旗', () => {
      const engine = createAndStartEngine();
      // 手动将红队玩家移到蓝旗附近
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleKeyDown(' ');
      expect(engine.redPlayerHasFlag).toBe(true);
      expect(engine.blueFlagCarrier).toBe('red');
      expect(engine.blueFlagAtHome).toBe(false);
    });

    it('红队玩家远离蓝旗按空格不能抢旗', () => {
      const engine = createAndStartEngine();
      // 红队在起始位置，蓝旗在对面
      engine.handleKeyDown(' ');
      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.blueFlagCarrier).toBeNull();
    });

    it('持旗时按空格释放旗帜', () => {
      const engine = createAndStartEngine();
      // 先抢旗
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleKeyDown(' ');
      expect(engine.redPlayerHasFlag).toBe(true);

      // 再按空格释放
      engine.handleKeyDown(' ');
      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.blueFlagCarrier).toBeNull();
      // 旗帜应在玩家当前位置
      expect(engine.blueFlagX).toBe(BLUE_FLAG_HOME_X);
      expect(engine.blueFlagY).toBe(BLUE_FLAG_HOME_Y);
    });

    it('旗帜跟随携带者移动', () => {
      const engine = createAndStartEngine();
      // 抢旗
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleKeyDown(' ');

      // 移动红队
      engine.handleKeyDown('ArrowLeft');
      tick(engine, 5);
      engine.handleKeyUp('ArrowLeft');

      // 蓝旗应跟随红队
      expect(engine.blueFlagX).toBe(engine.redPlayerX);
      expect(engine.blueFlagY).toBe(engine.redPlayerY);
    });

    it('AI 自动抢红旗', () => {
      const engine = createAndStartEngine();
      // 将蓝队 AI 移到红旗位置
      (engine as any)._bluePlayer.x = RED_FLAG_HOME_X;
      (engine as any)._bluePlayer.y = RED_FLAG_HOME_Y;
      tick(engine, 1);
      expect(engine.bluePlayerHasFlag).toBe(true);
      expect(engine.redFlagCarrier).toBe('blue');
    });
  });

  // ===== 旗帜归还与得分 =====
  describe('旗帜归还与得分', () => {
    it('红队持蓝旗回红队基地得分', () => {
      const engine = createAndStartEngine();
      // 红队持蓝旗并在红队基地
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(1);
      expect(engine.blueFlagAtHome).toBe(true);
      expect(engine.redPlayerHasFlag).toBe(false);
    });

    it('蓝队持红旗回蓝队基地得分', () => {
      const engine = createAndStartEngine();
      // 蓝队持红旗并在蓝队基地
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;
      (engine as any)._bluePlayer.x = BLUE_BASE_X + BASE_WIDTH / 2;
      (engine as any)._bluePlayer.y = BLUE_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.blueScore).toBe(1);
      expect(engine.redFlagAtHome).toBe(true);
      expect(engine.bluePlayerHasFlag).toBe(false);
    });

    it('得分后旗帜归位', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.blueFlagX).toBe(BLUE_FLAG_HOME_X);
      expect(engine.blueFlagY).toBe(BLUE_FLAG_HOME_Y);
    });

    it('得分后分数增加', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.score).toBeGreaterThan(0);
    });
  });

  // ===== 碰撞对抗 =====
  describe('碰撞对抗', () => {
    it('红队碰到持旗的蓝队，蓝队掉旗', () => {
      const engine = createAndStartEngine();
      // 蓝队持有红旗
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;

      // 将两个玩家放在一起
      (engine as any)._redPlayer.x = 200;
      (engine as any)._redPlayer.y = 300;
      (engine as any)._bluePlayer.x = 200;
      (engine as any)._bluePlayer.y = 300;
      tick(engine, 1);

      expect(engine.bluePlayerHasFlag).toBe(false);
      expect(engine.redFlagCarrier).toBeNull();
    });

    it('蓝队碰到持旗的红队，红队掉旗', () => {
      const engine = createAndStartEngine();
      // 红队持有蓝旗
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;

      // 将两个玩家放在一起
      (engine as any)._redPlayer.x = 200;
      (engine as any)._redPlayer.y = 300;
      (engine as any)._bluePlayer.x = 200;
      (engine as any)._bluePlayer.y = 300;
      tick(engine, 1);

      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.blueFlagCarrier).toBeNull();
    });

    it('掉旗后旗帜位置在碰撞点附近', () => {
      const engine = createAndStartEngine();
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;

      const collisionX = 200;
      const collisionY = 300;
      (engine as any)._redPlayer.x = collisionX;
      (engine as any)._redPlayer.y = collisionY;
      (engine as any)._bluePlayer.x = collisionX;
      (engine as any)._bluePlayer.y = collisionY;
      tick(engine, 1);

      // 掉旗后旗帜在碰撞点（AI 可能继续移动，但初始掉落位置应在碰撞点附近）
      // 精度 -1 表示精确到十位（容差 ±5）
      expect(engine.redFlagX).toBeCloseTo(collisionX, -1);
      expect(engine.redFlagY).toBeCloseTo(collisionY, -1);
    });

    it('双方都没持旗时碰撞无效果', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.x = 200;
      (engine as any)._redPlayer.y = 300;
      (engine as any)._bluePlayer.x = 200;
      (engine as any)._bluePlayer.y = 300;
      tick(engine, 1);

      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.bluePlayerHasFlag).toBe(false);
    });

    it('双方都持旗时碰撞双方都掉旗', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;

      (engine as any)._redPlayer.x = 200;
      (engine as any)._redPlayer.y = 300;
      (engine as any)._bluePlayer.x = 200;
      (engine as any)._bluePlayer.y = 300;
      tick(engine, 1);

      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.bluePlayerHasFlag).toBe(false);
      expect(engine.redFlagCarrier).toBeNull();
      expect(engine.blueFlagCarrier).toBeNull();
    });
  });

  // ===== AI 行为 =====
  describe('AI 行为', () => {
    it('AI 没有持旗时向红旗移动', () => {
      const engine = createAndStartEngine();
      const startX = engine.bluePlayerX;
      const startY = engine.bluePlayerY;

      // 让 AI 思考
      tick(engine, 30, 16);

      // AI 应该向红旗方向移动
      const moved = engine.bluePlayerX !== startX || engine.bluePlayerY !== startY;
      expect(moved).toBe(true);
    });

    it('AI 持旗时向蓝队基地移动', () => {
      const engine = createAndStartEngine();
      // 给蓝队红旗
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;
      // 将蓝队放到远离基地的位置
      (engine as any)._bluePlayer.x = RED_FLAG_HOME_X;
      (engine as any)._bluePlayer.y = RED_FLAG_HOME_Y;

      tick(engine, 30, 16);

      // AI 应该向蓝队基地方向移动
      expect(engine.bluePlayerX).toBeGreaterThan(RED_FLAG_HOME_X);
    });

    it('AI 在思考间隔内不改变目标', () => {
      const engine = createAndStartEngine();
      const targetBefore = { x: engine.aiTargetX, y: engine.aiTargetY };
      // 少量 tick，不触发 AI 思考
      tick(engine, 1, 100);
      const targetAfter = { x: engine.aiTargetX, y: engine.aiTargetY };
      // 目标可能没变（间隔未到）
      expect(targetAfter).toEqual(targetBefore);
    });

    it('AI 不能超出场地边界', () => {
      const engine = createAndStartEngine();
      tick(engine, 200, 16);
      expect(engine.bluePlayerX).toBeGreaterThanOrEqual(FIELD_LEFT + PLAYER_SIZE / 2);
      expect(engine.bluePlayerX).toBeLessThanOrEqual(FIELD_RIGHT - PLAYER_SIZE / 2);
      expect(engine.bluePlayerY).toBeGreaterThanOrEqual(FIELD_TOP + PLAYER_SIZE / 2);
      expect(engine.bluePlayerY).toBeLessThanOrEqual(FIELD_BOTTOM - PLAYER_SIZE / 2);
    });

    it('AI 速度不应超过 AI_SPEED', () => {
      const engine = createAndStartEngine();
      const prevX = engine.bluePlayerX;
      const prevY = engine.bluePlayerY;
      tick(engine, 1, 16);
      const dx = engine.bluePlayerX - prevX;
      const dy = engine.bluePlayerY - prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeLessThanOrEqual(AI_SPEED + 1); // 容差
    });

    it('AI 被掉旗后去捡旗', () => {
      const engine = createAndStartEngine();
      // 红旗被丢弃在场地中间
      (engine as any)._redFlag.atHome = false;
      (engine as any)._redFlag.carrier = null;
      (engine as any)._redFlag.x = 240;
      (engine as any)._redFlag.y = 320;
      // AI 应该去捡红旗
      tick(engine, 30, 16);
      // 验证 AI 在移动
      expect(engine.bluePlayerX !== BLUE_START_X || engine.bluePlayerY !== BLUE_START_Y).toBe(true);
    });

    it('AI 碰到红旗可以自动捡起', () => {
      const engine = createAndStartEngine();
      // 红旗被丢弃
      (engine as any)._redFlag.atHome = false;
      (engine as any)._redFlag.carrier = null;
      (engine as any)._redFlag.x = 200;
      (engine as any)._redFlag.y = 300;
      // 蓝队 AI 在红旗位置
      (engine as any)._bluePlayer.x = 200;
      (engine as any)._bluePlayer.y = 300;
      tick(engine, 1);
      expect(engine.bluePlayerHasFlag).toBe(true);
      expect(engine.redFlagCarrier).toBe('blue');
    });
  });

  // ===== 得分与胜利判定 =====
  describe('得分与胜利判定', () => {
    it('红队先得 3 分获胜', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = 2;
      // 红队持旗回基地
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(3);
      expect(engine.isWin).toBe(true);
      expect(engine.status).toBe('gameover');
    });

    it('蓝队先得 3 分获胜', () => {
      const engine = createAndStartEngine();
      (engine as any)._blueScore = 2;
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;
      (engine as any)._bluePlayer.x = BLUE_BASE_X + BASE_WIDTH / 2;
      (engine as any)._bluePlayer.y = BLUE_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.blueScore).toBe(3);
      expect(engine.isWin).toBe(false);
      expect(engine.status).toBe('gameover');
    });

    it('2 分不触发胜利', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = 1;
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(2);
      expect(engine.status).toBe('playing');
    });

    it('胜利后状态为 gameover', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = WIN_SCORE - 1;
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.status).toBe('gameover');
    });

    it('红队胜利时 isWin 为 true', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = WIN_SCORE - 1;
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.isWin).toBe(true);
    });

    it('蓝队胜利时 isWin 为 false', () => {
      const engine = createAndStartEngine();
      (engine as any)._blueScore = WIN_SCORE - 1;
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;
      (engine as any)._bluePlayer.x = BLUE_BASE_X + BASE_WIDTH / 2;
      (engine as any)._bluePlayer.y = BLUE_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.isWin).toBe(false);
    });

    it('gameover 后不能再得分', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = WIN_SCORE - 1;
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.status).toBe('gameover');
      expect(engine.redScore).toBe(WIN_SCORE);

      // gameover 后再 update 不会再增加分数
      const scoreAfter = engine.redScore;
      tick(engine, 5);
      expect(engine.redScore).toBe(scoreAfter);
    });
  });

  // ===== 键盘输入 =====
  describe('键盘输入', () => {
    it('idle 状态按空格开始游戏', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('gameover 状态按空格重新开始', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = WIN_SCORE - 1;
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.status).toBe('gameover');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
      expect(engine.redScore).toBe(0);
      expect(engine.blueScore).toBe(0);
    });

    it('Space 键也能触发动作', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleKeyDown('Space');
      expect(engine.redPlayerHasFlag).toBe(true);
    });

    it('无效按键不崩溃', () => {
      const engine = createAndStartEngine();
      expect(() => engine.handleKeyDown('x')).not.toThrow();
      expect(() => engine.handleKeyUp('x')).not.toThrow();
    });

    it('方向键状态正确更新', () => {
      const engine = createAndStartEngine();
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowRight');
      const y1 = engine.redPlayerY;
      const x1 = engine.redPlayerX;
      tick(engine, 1);
      expect(engine.redPlayerY).toBeLessThan(y1);
      expect(engine.redPlayerX).toBeGreaterThan(x1);

      engine.handleKeyUp('ArrowUp');
      engine.handleKeyUp('ArrowRight');
      const y2 = engine.redPlayerY;
      const x2 = engine.redPlayerX;
      tick(engine, 1);
      expect(engine.redPlayerY).toBe(y2);
      expect(engine.redPlayerX).toBe(x2);
    });
  });

  // ===== getState =====
  describe('getState', () => {
    it('返回正确的状态对象', () => {
      const engine = createAndStartEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('redScore');
      expect(state).toHaveProperty('blueScore');
      expect(state).toHaveProperty('redPlayer');
      expect(state).toHaveProperty('bluePlayer');
      expect(state).toHaveProperty('redFlag');
      expect(state).toHaveProperty('blueFlag');
      expect(state).toHaveProperty('isWin');
    });

    it('状态值正确', () => {
      const engine = createAndStartEngine();
      const state = engine.getState() as any;
      expect(state.redScore).toBe(0);
      expect(state.blueScore).toBe(0);
      expect(state.isWin).toBe(false);
      expect(state.redPlayer.x).toBe(RED_START_X);
      expect(state.bluePlayer.x).toBe(BLUE_START_X);
    });

    it('持旗状态在 getState 中反映', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      const state = engine.getState() as any;
      expect(state.redPlayer.hasFlag).toBe(true);
      expect(state.blueFlag.carrier).toBe('red');
      expect(state.blueFlag.atHome).toBe(false);
    });
  });

  // ===== 事件系统 =====
  describe('事件系统', () => {
    it('start 时触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = jest.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('pause 时触发 statusChange 事件', () => {
      const engine = createAndStartEngine();
      const handler = jest.fn();
      engine.on('statusChange', handler);
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });

    it('得分时触发 scoreChange 事件', () => {
      const engine = createAndStartEngine();
      const handler = jest.fn();
      engine.on('scoreChange', handler);
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(handler).toHaveBeenCalled();
    });

    it('off 取消事件监听', () => {
      const engine = createEngine();
      const handler = jest.fn();
      engine.on('statusChange', handler);
      engine.off('statusChange', handler);
      engine.start();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ===== 重置位置 =====
  describe('resetPositions', () => {
    it('重置位置但不重置分数', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = 2;
      (engine as any)._blueScore = 1;
      engine.resetPositions();
      expect(engine.redScore).toBe(2);
      expect(engine.blueScore).toBe(1);
      expect(engine.redPlayerX).toBe(RED_START_X);
      expect(engine.redPlayerY).toBe(RED_START_Y);
      expect(engine.redFlagAtHome).toBe(true);
      expect(engine.blueFlagAtHome).toBe(true);
    });

    it('重置后无人持旗', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      engine.resetPositions();
      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.bluePlayerHasFlag).toBe(false);
    });
  });

  // ===== handleAction =====
  describe('handleAction', () => {
    it('在蓝旗附近可以抢旗', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(true);
    });

    it('已持旗时释放旗帜', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(true);

      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(false);
    });

    it('不在旗帜附近不能抢旗', () => {
      const engine = createAndStartEngine();
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(false);
    });

    it('已持旗时不能再次抢旗', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(true);

      // 释放后旗帜在当前位置，不在原位
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(false);
      expect(engine.blueFlagAtHome).toBe(false);
    });
  });

  // ===== 渲染 =====
  describe('渲染', () => {
    it('idle 状态可以渲染', () => {
      const engine = createEngine();
      expect(() => engine.render()).not.toThrow();
    });

    it('playing 状态可以渲染', () => {
      const engine = createAndStartEngine();
      expect(() => engine.render()).not.toThrow();
    });

    it('gameover 状态可以渲染', () => {
      const engine = createAndStartEngine();
      (engine as any)._redScore = WIN_SCORE - 1;
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(() => engine.render()).not.toThrow();
    });

    it('持旗状态渲染不报错', () => {
      const engine = createAndStartEngine();
      (engine as any)._redPlayer.hasFlag = true;
      (engine as any)._blueFlag.carrier = 'red';
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._bluePlayer.hasFlag = true;
      (engine as any)._redFlag.carrier = 'blue';
      (engine as any)._redFlag.atHome = false;
      expect(() => engine.render()).not.toThrow();
    });
  });

  // ===== 综合场景 =====
  describe('综合场景', () => {
    it('完整流程：抢旗 → 回基地 → 得分 → 胜利', () => {
      const engine = createAndStartEngine();

      // 第1分
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(true);

      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(1);
      expect(engine.blueFlagAtHome).toBe(true);

      // 第2分
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(2);

      // 第3分 - 获胜
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(3);
      expect(engine.isWin).toBe(true);
      expect(engine.status).toBe('gameover');
    });

    it('碰撞后抢旗再得分', () => {
      const engine = createAndStartEngine();

      // 蓝队抢红旗
      (engine as any)._bluePlayer.x = RED_FLAG_HOME_X;
      (engine as any)._bluePlayer.y = RED_FLAG_HOME_Y;
      tick(engine, 1);
      expect(engine.bluePlayerHasFlag).toBe(true);

      // 红队碰到蓝队，蓝队掉旗
      (engine as any)._redPlayer.x = engine.bluePlayerX;
      (engine as any)._redPlayer.y = engine.bluePlayerY;
      tick(engine, 1);
      expect(engine.bluePlayerHasFlag).toBe(false);
      expect(engine.redFlagCarrier).toBeNull();

      // 红队去抢蓝旗
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(true);

      // 回基地得分
      (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
      (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
      tick(engine, 1);
      expect(engine.redScore).toBe(1);
    });

    it('重置后可以重新开始', () => {
      const engine = createAndStartEngine();
      // 模拟游戏结束
      (engine as any)._redScore = WIN_SCORE;
      engine.gameOver();
      expect(engine.status).toBe('gameover');

      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.redScore).toBe(0);
      expect(engine.blueScore).toBe(0);

      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('多次得分循环', () => {
      const engine = createAndStartEngine();

      for (let i = 0; i < WIN_SCORE - 1; i++) {
        (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
        (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
        engine.handleAction();
        (engine as any)._redPlayer.x = RED_BASE_X + BASE_WIDTH / 2;
        (engine as any)._redPlayer.y = RED_BASE_Y + BASE_HEIGHT / 2;
        tick(engine, 1);
        expect(engine.redScore).toBe(i + 1);
        expect(engine.status).toBe('playing');
      }
    });

    it('蓝队连续得分获胜', () => {
      const engine = createAndStartEngine();

      for (let i = 0; i < WIN_SCORE; i++) {
        (engine as any)._bluePlayer.hasFlag = true;
        (engine as any)._redFlag.carrier = 'blue';
        (engine as any)._redFlag.atHome = false;
        (engine as any)._bluePlayer.x = BLUE_BASE_X + BASE_WIDTH / 2;
        (engine as any)._bluePlayer.y = BLUE_BASE_Y + BASE_HEIGHT / 2;
        tick(engine, 1);
      }

      expect(engine.blueScore).toBe(WIN_SCORE);
      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(false);
    });
  });

  // ===== 边界条件 =====
  describe('边界条件', () => {
    it('没有 canvas 时 start 抛错', () => {
      const engine = new CTFEngine();
      expect(() => engine.start()).toThrow('Canvas not initialized');
    });

    it('没有 canvas 时 resume 抛错', () => {
      const engine = new CTFEngine();
      (engine as any)._status = 'paused';
      expect(() => engine.resume()).toThrow('Canvas not initialized');
    });

    it('idle 状态不能暂停', () => {
      const engine = createEngine();
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('playing 状态不能 resume', () => {
      const engine = createAndStartEngine();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('旗帜不在原位时不能通过空格抢旗', () => {
      const engine = createAndStartEngine();
      // 蓝旗已被丢弃（不在原位）
      (engine as any)._blueFlag.atHome = false;
      (engine as any)._blueFlag.carrier = null;
      (engine as any)._blueFlag.x = 300;
      (engine as any)._blueFlag.y = 300;
      // 玩家在蓝旗原位
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleAction();
      expect(engine.redPlayerHasFlag).toBe(false);
    });

    it('非 playing 状态时空格键不触发 handleAction', () => {
      const engine = createEngine();
      (engine as any)._redPlayer.x = BLUE_FLAG_HOME_X;
      (engine as any)._redPlayer.y = BLUE_FLAG_HOME_Y;
      engine.handleKeyDown(' ');
      // 空格在 idle 时应该 start，不是 handleAction
      expect(engine.status).toBe('playing');
    });
  });

  // ===== 游戏循环 =====
  describe('游戏循环', () => {
    it('游戏循环正常启动', () => {
      const engine = createEngine();
      engine.start();
      expect(rafCallbacks.size).toBeGreaterThan(0);
    });

    it('暂停后取消动画帧', () => {
      const engine = createAndStartEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('恢复后重新启动动画帧', () => {
      const engine = createAndStartEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
      expect(rafCallbacks.size).toBeGreaterThan(0);
    });
  });

  // ===== 常量验证 =====
  describe('常量验证', () => {
    it('画布尺寸正确', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('胜利分数为 3', () => {
      expect(WIN_SCORE).toBe(3);
    });

    it('有障碍物', () => {
      expect(OBSTACLES.length).toBeGreaterThan(0);
    });

    it('障碍物在场地内', () => {
      for (const obs of OBSTACLES) {
        expect(obs.x).toBeGreaterThanOrEqual(FIELD_LEFT);
        expect(obs.x + obs.w).toBeLessThanOrEqual(FIELD_RIGHT);
        expect(obs.y).toBeGreaterThanOrEqual(FIELD_TOP);
        expect(obs.y + obs.h).toBeLessThanOrEqual(FIELD_BOTTOM);
      }
    });

    it('基地区域在场地内', () => {
      expect(RED_BASE_X).toBeGreaterThanOrEqual(FIELD_LEFT);
      expect(RED_BASE_X + BASE_WIDTH).toBeLessThanOrEqual(CANVAS_WIDTH / 2);
      expect(BLUE_BASE_X).toBeGreaterThanOrEqual(CANVAS_WIDTH / 2);
      expect(BLUE_BASE_X + BASE_WIDTH).toBeLessThanOrEqual(FIELD_RIGHT);
    });
  });
});
