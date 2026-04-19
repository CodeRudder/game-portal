// ========== Fall Down 下落跑酷 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 球
export const BALL_RADIUS = 10;
export const BALL_INITIAL_X = CANVAS_WIDTH / 2;
export const BALL_INITIAL_Y = 100;
export const BALL_HORIZONTAL_SPEED = 5; // 像素/帧 (60fps 标准化)
export const GRAVITY = 0.3; // 每帧加速度
export const MAX_FALL_SPEED = 8; // 最大下落速度

// 平台
export const PLATFORM_HEIGHT = 12;
export const PLATFORM_GAP_WIDTH = 80; // 普通间隙宽度
export const WIDE_GAP_WIDTH = 130; // 宽间隙宽度
export const PLATFORM_SPEED = 1.2; // 初始上升速度（像素/帧）
export const PLATFORM_SPAWN_INTERVAL = 100; // 像素间距（Y方向）
export const PLATFORM_INITIAL_COUNT = 7; // 初始平台数量
export const PLATFORM_MIN_Y = -20; // 平台超出顶部后移除

// 移动间隙平台
export const MOVING_GAP_SPEED = 1.5; // 间隙移动速度
export const MOVING_GAP_RANGE = 100; // 间隙移动范围

// 速度递增
export const SPEED_INCREMENT = 0.08; // 每级速度增量
export const SPEED_LEVEL_INTERVAL = 5; // 每穿5层平台升一级
export const MAX_PLATFORM_SPEED = 4.0; // 最大平台速度

// 颜色
export const BG_COLOR = '#0d0d20';
export const BALL_COLOR = '#ff4757';
export const BALL_GLOW_COLOR = '#ff6b81';
export const PLATFORM_COLOR = '#2ed573';
export const PLATFORM_BORDER_COLOR = '#1e9c4f';
export const WIDE_PLATFORM_COLOR = '#ffa502';
export const WIDE_PLATFORM_BORDER_COLOR = '#cc8400';
export const MOVING_PLATFORM_COLOR = '#1e90ff';
export const MOVING_PLATFORM_BORDER_COLOR = '#1565c0';
export const SCORE_COLOR = '#ffffff';
export const GAME_OVER_COLOR = '#ff4757';
export const TOP_DANGER_ZONE = 30; // 顶部危险区域高度

// 计分
export const SCORE_PER_PLATFORM = 1;

// 平台类型枚举
export enum PlatformType {
  NORMAL = 'normal',   // 普通单间隙
  WIDE = 'wide',       // 宽间隙
  MOVING = 'moving',   // 移动间隙
}
