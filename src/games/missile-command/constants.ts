// ========== 导弹指挥官 Missile Command 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 城市 ==========
export const CITY_COUNT = 6;
export const CITY_WIDTH = 36;
export const CITY_HEIGHT = 20;
export const CITY_Y = CANVAS_HEIGHT - 30; // 城市底部 Y 坐标
export const CITY_COLOR = '#4fc3f7';
export const CITY_DESTROYED_COLOR = '#333333';

// ========== 导弹发射台 ==========
export const BATTERY_COUNT = 3;
export const BATTERY_WIDTH = 30;
export const BATTERY_HEIGHT = 16;
export const BATTERY_Y = CANVAS_HEIGHT - 16; // 发射台底部 Y
export const BATTERY_COLOR = '#66bb6a';
export const BATTERY_MAX_AMMO = 10;
export const BATTERY_RELOAD_PER_WAVE = 10;

// ========== 拦截弹 ==========
export const MISSILE_SPEED = 5; // 像素/帧
export const MISSILE_TRAIL_COLOR = '#ffeb3b';

// ========== 爆炸 ==========
export const EXPLOSION_MAX_RADIUS = 30;
export const EXPLOSION_GROW_SPEED = 1.5; // 像素/帧
export const EXPLOSION_SHRINK_SPEED = 1.0;
export const EXPLOSION_COLOR = '#ff9800';
export const EXPLOSION_HIT_COLOR = '#ff5722';

// ========== 敌方导弹 ==========
export const ENEMY_MISSILE_BASE_SPEED = 0.8;
export const ENEMY_MISSILE_SPEED_PER_WAVE = 0.15;
export const ENEMY_MISSILE_BASE_COUNT = 8;
export const ENEMY_MISSILE_COUNT_PER_WAVE = 4;
export const ENEMY_MISSILE_MAX_COUNT = 30;
export const ENEMY_MISSILE_COLOR = '#ef5350';
export const ENEMY_MISSILE_TRAIL_COLOR = '#ff8a80';

// ========== 波次 ==========
export const WAVE_START_DELAY = 2000; // 毫秒，波次开始延迟
export const WAVE_SPAWN_INTERVAL_MIN = 200; // 最小生成间隔（毫秒）
export const WAVE_SPAWN_INTERVAL_MAX = 1200; // 最大生成间隔（毫秒）
export const WAVE_BONUS_CITY = 100; // 每存活城市奖励
export const WAVE_BONUS_AMMO = 5; // 每剩余弹药奖励

// ========== 得分 ==========
export const SCORE_PER_ENEMY = 25;
export const SCORE_PER_WAVE = 100; // 波次通关奖励

// ========== 颜色 ==========
export const BG_COLOR = '#0a0a2e';
export const GROUND_COLOR = '#2e7d32';
export const HUD_COLOR = '#ffffff';
export const CROSSHAIR_COLOR = '#ffffff';

// ========== 地面 ==========
export const GROUND_HEIGHT = 40;
export const GROUND_Y = CANVAS_HEIGHT - GROUND_HEIGHT;

// ========== 布局计算 ==========
// 6 座城市分布在 3 个发射台之间
// 发射台位置: 左、中、右
export const BATTERY_POSITIONS = [
  BATTERY_WIDTH / 2 + 10,                              // 左发射台中心 X
  CANVAS_WIDTH / 2,                                     // 中发射台中心 X
  CANVAS_WIDTH - BATTERY_WIDTH / 2 - 10,               // 右发射台中心 X
] as const;

// 城市位置: 在发射台之间均匀分布
// 左段: 2 城市, 中段: 2 城市, 右段: 2 城市
export const CITY_POSITIONS = (() => {
  const positions: number[] = [];
  const leftBattery = BATTERY_POSITIONS[0];
  const midBattery = BATTERY_POSITIONS[1];
  const rightBattery = BATTERY_POSITIONS[2];

  // 左段 2 城市
  const segLeftStart = leftBattery + BATTERY_WIDTH / 2 + CITY_WIDTH;
  const segLeftEnd = midBattery - BATTERY_WIDTH / 2 - CITY_WIDTH;
  const segLeftMid = (segLeftStart + segLeftEnd) / 2;
  positions.push(segLeftMid - CITY_WIDTH, segLeftMid + CITY_WIDTH);

  // 右段 2 城市
  const segRightStart = midBattery + BATTERY_WIDTH / 2 + CITY_WIDTH;
  const segRightEnd = rightBattery - BATTERY_WIDTH / 2 - CITY_WIDTH;
  const segRightMid = (segRightStart + segRightEnd) / 2;
  positions.push(segRightMid - CITY_WIDTH, segRightMid + CITY_WIDTH);

  // 左外侧 1 城市
  positions.push(leftBattery - BATTERY_WIDTH / 2 - CITY_WIDTH);

  // 右外侧 1 城市
  positions.push(rightBattery + BATTERY_WIDTH / 2 + CITY_WIDTH);

  return positions;
})();
