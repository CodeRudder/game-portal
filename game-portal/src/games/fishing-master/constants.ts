// ========== 捕鱼达人 Fishing Master 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 场景布局
export const WATER_SURFACE_Y = 120; // 水面 Y 坐标
export const BOAT_Y = 80; // 船的 Y 坐标
export const BOAT_WIDTH = 80;
export const BOAT_HEIGHT = 30;

// 船/鱼钩水平移动
export const BOAT_SPEED = 4; // 像素/帧
export const BOAT_MIN_X = 20;
export const BOAT_MAX_X = CANVAS_WIDTH - 20;

// 鱼钩
export const HOOK_WIDTH = 16;
export const HOOK_HEIGHT = 20;
export const HOOK_SINK_SPEED = 3; // 下沉速度
export const HOOK_REEL_SPEED = 4; // 收回速度
export const HOOK_MAX_DEPTH = CANVAS_HEIGHT - 40; // 最大深度
export const HOOK_LINE_WIDTH = 2;

// 鱼钩状态
export enum HookState {
  IDLE = 'idle',       // 挂在船上，等待放下
  SINKING = 'sinking', // 正在下沉
  REELING = 'reeling', // 正在收回（带鱼或到最大深度）
}

// 鱼种类型
export enum FishType {
  SMALL = 'small',     // 小鱼
  MEDIUM = 'medium',   // 中鱼
  LARGE = 'large',     // 大鱼
  PUFFER = 'puffer',   // 河豚（有毒）
}

// 鱼的属性配置
export interface FishConfig {
  type: FishType;
  width: number;
  height: number;
  speed: number;       // 游动速度（像素/帧）
  score: number;       // 分值
  color: string;       // 身体颜色
  spawnWeight: number; // 生成权重（越大越常见）
  direction: 1 | -1;   // 1=向右, -1=向左
}

// 各鱼种配置
export const FISH_CONFIGS: Record<FishType, Omit<FishConfig, 'direction'>> = {
  [FishType.SMALL]: {
    type: FishType.SMALL,
    width: 30,
    height: 16,
    speed: 2.5,
    score: 10,
    color: '#4fc3f7',
    spawnWeight: 50,
  },
  [FishType.MEDIUM]: {
    type: FishType.MEDIUM,
    width: 44,
    height: 22,
    speed: 1.8,
    score: 25,
    color: '#ffb74d',
    spawnWeight: 30,
  },
  [FishType.LARGE]: {
    type: FishType.LARGE,
    width: 60,
    height: 30,
    speed: 1.2,
    score: 50,
    color: '#e57373',
    spawnWeight: 12,
  },
  [FishType.PUFFER]: {
    type: FishType.PUFFER,
    width: 36,
    height: 28,
    speed: 1.5,
    score: -20,
    color: '#a5d6a7',
    spawnWeight: 8,
  },
};

// 总权重（用于随机生成）
export const TOTAL_SPAWN_WEIGHT = Object.values(FISH_CONFIGS).reduce(
  (sum, cfg) => sum + cfg.spawnWeight,
  0
);

// 鱼群生成
export const MAX_FISH_COUNT = 8;           // 最大同时存在的鱼数
export const FISH_SPAWN_INTERVAL = 1500;   // 生成间隔（毫秒）
export const FISH_MIN_Y = WATER_SURFACE_Y + 40; // 鱼活动区域上边界
export const FISH_MAX_Y = CANVAS_HEIGHT - 40;    // 鱼活动区域下边界

// 游戏时间
export const GAME_DURATION = 60; // 秒

// 连击系统
export const COMBO_WINDOW = 3000; // 连击窗口（毫秒），3秒内连续捕鱼算连击
export const COMBO_MULTIPLIER_STEP = 0.5; // 每次连击增加的倍率
export const MAX_COMBO_MULTIPLIER = 3.0; // 最大连击倍率
export const COMBO_BASE_MULTIPLIER = 1.0; // 基础倍率

// 颜色
export const SKY_COLOR = '#87CEEB';
export const WATER_TOP_COLOR = '#1565C0';
export const WATER_BOTTOM_COLOR = '#0D47A1';
export const BOAT_COLOR = '#8D6E63';
export const BOAT_DARK_COLOR = '#5D4037';
export const HOOK_COLOR = '#B0BEC5';
export const LINE_COLOR = '#90A4AE';
export const BOAT_SAIL_COLOR = '#FAFAFA';

// 分数显示动画
export const SCORE_POPUP_DURATION = 1000; // 毫秒
