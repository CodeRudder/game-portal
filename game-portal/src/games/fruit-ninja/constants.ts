// ========== Fruit Ninja 水果忍者常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 水果
export const FRUIT_RADIUS = 22;
export const FRUIT_TYPES = ['apple', 'orange', 'watermelon', 'banana', 'kiwi', 'peach'] as const;
export type FruitType = (typeof FRUIT_TYPES)[number];

export const FRUIT_COLORS: Record<FruitType, string> = {
  apple: '#e53935',
  orange: '#ff9800',
  watermelon: '#43a047',
  banana: '#fdd835',
  kiwi: '#7cb342',
  peach: '#ff7043',
};

export const FRUIT_SCORES: Record<FruitType, number> = {
  apple: 10,
  orange: 15,
  watermelon: 20,
  banana: 10,
  kiwi: 15,
  peach: 10,
};

// 炸弹
export const BOMB_RADIUS = 20;
export const BOMB_COLOR = '#37474f';
export const BOMB_PENALTY = 1; // 扣除生命数

// 抛物线参数
export const GRAVITY = 0.35; // 像素/帧²（update 中的重力加速度）
export const INITIAL_VY_MIN = -13; // 初始垂直速度（向上为负）
export const INITIAL_VY_MAX = -9;
export const INITIAL_VX_RANGE = 3; // 水平速度范围 [-RANGE, +RANGE]

// 生命
export const INITIAL_LIVES = 3;
export const MAX_MISSED_FRUITS = 3; // 漏掉此数量游戏结束

// 切割
export const SLASH_RADIUS = 40; // 切割判定半径（数字键 / 空格键）
export const COMBO_WINDOW = 800; // 连击判定窗口（毫秒）

// 生成
export const BASE_SPAWN_INTERVAL = 1800; // 基础生成间隔（毫秒）
export const SPAWN_INTERVAL_DECREASE_PER_LEVEL = 120; // 每级减少的生成间隔
export const MIN_SPAWN_INTERVAL = 500; // 最小生成间隔
export const BOMB_CHANCE = 0.12; // 炸弹生成概率
export const BOMB_CHANCE_PER_LEVEL = 0.02; // 每级增加的炸弹概率
export const MAX_BOMB_CHANCE = 0.35; // 最大炸弹概率

// 等级
export const SCORE_PER_LEVEL = 100; // 每 100 分升一级
export const MAX_LEVEL = 10;

// 切割特效
export const SLASH_DURATION = 300; // 切割特效持续时间（毫秒）
export const SLASH_COLOR = '#ffffff';

// 方向键切割
export const DIRECTION_SLASH_RANGE = 80; // 方向键切割范围（像素）

// 颜色
export const BG_COLOR = '#1a0a2e';
export const HUD_COLOR = '#ffffff';
export const HUD_BG_COLOR = 'rgba(0, 0, 0, 0.5)';
export const SLASH_TRAIL_COLOR = 'rgba(255, 255, 255, 0.6)';

// 选框（方向键+空格模式）
export const CURSOR_SPEED = 8;
export const CURSOR_SIZE = 30;
