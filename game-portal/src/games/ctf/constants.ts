// ========== Capture the Flag 抢旗大战常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 场地边界 ==========
export const FIELD_MARGIN = 10;
export const FIELD_LEFT = FIELD_MARGIN;
export const FIELD_RIGHT = CANVAS_WIDTH - FIELD_MARGIN;
export const FIELD_TOP = FIELD_MARGIN;
export const FIELD_BOTTOM = CANVAS_HEIGHT - FIELD_MARGIN;

// ========== 中线 ==========
export const CENTER_X = CANVAS_WIDTH / 2;

// ========== 基地区域 ==========
export const BASE_WIDTH = 80;
export const BASE_HEIGHT = 100;
// 红队基地（左侧）
export const RED_BASE_X = FIELD_LEFT;
export const RED_BASE_Y = (CANVAS_HEIGHT - BASE_HEIGHT) / 2;
// 蓝队基地（右侧）
export const BLUE_BASE_X = FIELD_RIGHT - BASE_WIDTH;
export const BLUE_BASE_Y = (CANVAS_HEIGHT - BASE_HEIGHT) / 2;

// ========== 旗帜位置 ==========
export const RED_FLAG_HOME_X = RED_BASE_X + BASE_WIDTH / 2;
export const RED_FLAG_HOME_Y = CANVAS_HEIGHT / 2;
export const BLUE_FLAG_HOME_X = BLUE_BASE_X + BASE_WIDTH / 2;
export const BLUE_FLAG_HOME_Y = CANVAS_HEIGHT / 2;

// ========== 角色 ==========
export const PLAYER_SIZE = 20;
export const PLAYER_SPEED = 3;
export const PLAYER_COLOR_RED = '#ef5350';
export const PLAYER_COLOR_BLUE = '#42a5f5';

// 红队初始位置
export const RED_START_X = RED_BASE_X + BASE_WIDTH / 2;
export const RED_START_Y = CANVAS_HEIGHT / 2 + 60;
// 蓝队初始位置
export const BLUE_START_X = BLUE_BASE_X + BASE_WIDTH / 2;
export const BLUE_START_Y = CANVAS_HEIGHT / 2 - 60;

// ========== 旗帜 ==========
export const FLAG_SIZE = 16;
export const FLAG_POLE_HEIGHT = 24;

// ========== 得分 ==========
export const WIN_SCORE = 3;

// ========== AI 参数 ==========
export const AI_SPEED = 2.2;
export const AI_THINK_INTERVAL = 300; // 毫秒
export const AI_GRAB_RANGE = 30; // AI 抢旗范围
export const AI_RETURN_TO_BASE_RANGE = 20; // AI 回基地判定范围

// ========== 障碍物 ==========
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OBSTACLES: Obstacle[] = [
  // 中央上方障碍
  { x: CENTER_X - 60, y: 120, w: 120, h: 20 },
  // 中央下方障碍
  { x: CENTER_X - 60, y: 500, w: 120, h: 20 },
  // 左侧中部障碍
  { x: 100, y: 280, w: 20, h: 80 },
  // 右侧中部障碍
  { x: 360, y: 280, w: 20, h: 80 },
  // 中央偏左
  { x: 160, y: 200, w: 40, h: 20 },
  // 中央偏右
  { x: 280, y: 420, w: 40, h: 20 },
];

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const FIELD_COLOR = '#16213e';
export const RED_BASE_COLOR = 'rgba(239, 83, 80, 0.2)';
export const BLUE_BASE_COLOR = 'rgba(66, 165, 245, 0.2)';
export const OBSTACLE_COLOR = '#4a4a6a';
export const RED_FLAG_COLOR = '#ff1744';
export const BLUE_FLAG_COLOR = '#2979ff';
export const SCORE_COLOR = '#ffffff';
export const CENTER_LINE_COLOR = 'rgba(255,255,255,0.15)';

// ========== 碰撞检测辅助 ==========
export const COLLISION_PADDING = 2;
