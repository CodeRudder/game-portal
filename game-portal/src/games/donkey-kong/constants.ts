// ========== Donkey Kong 大金刚常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 玩家 ==========
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 32;
export const PLAYER_SPEED = 150; // pixels per second
export const PLAYER_JUMP_VELOCITY = -380; // pixels per second (负值=向上)
export const PLAYER_GRAVITY = 900; // pixels per second²
export const PLAYER_CLIMB_SPEED = 120; // pixels per second
export const PLAYER_COLOR = '#e53935';
export const INITIAL_LIVES = 3;

// ========== 大金刚 ==========
export const DK_WIDTH = 64;
export const DK_HEIGHT = 56;
export const DK_COLOR = '#8B4513';
export const DK_THROW_INTERVAL_BASE = 2500; // ms
export const DK_THROW_INTERVAL_PER_LEVEL = -200; // 每级减少 ms（加快）
export const DK_THROW_INTERVAL_MIN = 800; // ms

// ========== 滚桶 ==========
export const BARREL_RADIUS = 12;
export const BARREL_SPEED_BASE = 120; // pixels per second
export const BARREL_SPEED_PER_LEVEL = 15; // 每级增加速度
export const BARREL_COLOR = '#D2691E';
export const BARREL_FALL_SPEED = 300; // pixels per second
export const BARREL_LADDER_CHANCE = 0.35; // 遇梯子下落概率
export const BARREL_SCORE = 100; // 跳过滚桶得分

// ========== 平台 ==========
export const PLATFORM_HEIGHT = 8;
export const PLATFORM_COLOR = '#5d4037';

// ========== 梯子 ==========
export const LADDER_WIDTH = 20;
export const LADDER_COLOR = '#4fc3f7';

// ========== 人质 ==========
export const HOSTAGE_WIDTH = 20;
export const HOSTAGE_HEIGHT = 28;
export const HOSTAGE_COLOR = '#ffd600';

// ========== 关卡完成 ==========
export const LEVEL_COMPLETE_SCORE = 500;

// ========== 颜色 ==========
export const BG_COLOR = '#0a0a0a';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';

// ========== 方向 ==========
export const DIR_LEFT = -1;
export const DIR_RIGHT = 1;

// ========== 关卡布局 ==========
export interface Platform {
  x: number;
  y: number;
  width: number;
}

export interface Ladder {
  x: number;
  topY: number;
  bottomY: number;
}

export interface LevelLayout {
  platforms: Platform[];
  ladders: Ladder[];
  dkX: number;
  dkY: number;
  hostageX: number;
  hostageY: number;
  playerStartX: number;
  playerStartY: number;
}

/** 生成关卡布局 */
export function generateLevel(level: number): LevelLayout {
  const platformYs = [560, 460, 360, 260, 160, 70];
  const platforms: Platform[] = [];
  const ladders: Ladder[] = [];

  // 底部地面（完整宽度）
  platforms.push({ x: 0, y: 590, width: CANVAS_WIDTH });

  // 各层平台，交替倾斜方向
  for (let i = 0; i < platformYs.length; i++) {
    const y = platformYs[i];
    const tilt = (i % 2 === 0) ? 1 : -1;
    const heightDiff = tilt * 20;

    if (i < platformYs.length - 1) {
      // 中间层：两端有斜度
      platforms.push({ x: 0, y: y + heightDiff, width: CANVAS_WIDTH });
    } else {
      // 顶层：大金刚所在平台
      platforms.push({ x: 0, y: y, width: CANVAS_WIDTH });
    }
  }

  // 梯子：每层之间放 2-3 个梯子
  const ladderXPositions = [
    [80, 320],
    [140, 380],
    [60, 260, 420],
    [100, 340],
    [200, 400],
  ];

  for (let i = 0; i < ladderXPositions.length; i++) {
    const positions = ladderXPositions[i];
    const topY = platformYs[i + 1] + ((i + 1) % 2 === 0 ? 20 : -20);
    const bottomY = platformYs[i];
    for (const lx of positions) {
      ladders.push({
        x: lx,
        topY: topY + PLATFORM_HEIGHT,
        bottomY: bottomY,
      });
    }
  }

  // 大金刚位置：左上角
  const dkX = 40;
  const dkY = platformYs[5] - DK_HEIGHT;

  // 人质位置：大金刚旁边
  const hostageX = dkX + DK_WIDTH + 10;
  const hostageY = platformYs[5] - HOSTAGE_HEIGHT;

  // 玩家起始位置：底部中央
  const playerStartX = (CANVAS_WIDTH - PLAYER_WIDTH) / 2;
  const playerStartY = 590 - PLAYER_HEIGHT;

  return { platforms, ladders, dkX, dkY, hostageX, hostageY, playerStartX, playerStartY };
}
