// ========== Backgammon 双陆棋常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘布局
export const BOARD_MARGIN_X = 20;
export const BOARD_MARGIN_TOP = 50;
export const BOARD_MARGIN_BOTTOM = 30;
export const BAR_WIDTH = 30;
export const BORDER_WIDTH = 4;
export const POINT_COUNT = 24;
export const CHECKERS_PER_PLAYER = 15;

// 三角形尺寸
export const POINT_WIDTH = Math.floor(
  (CANVAS_WIDTH - 2 * BOARD_MARGIN_X - BAR_WIDTH) / 12
);
export const POINT_HEIGHT = Math.floor((CANVAS_HEIGHT - BOARD_MARGIN_TOP - BOARD_MARGIN_BOTTOM) * 0.42);

// 棋子尺寸
export const CHECKER_RADIUS = Math.floor(POINT_WIDTH / 2) - 2;

// 颜色
export const BG_COLOR = '#1a0a2e';
export const BOARD_COLOR = '#5d3a1a';
export const BOARD_BORDER_COLOR = '#8b6914';
export const BAR_COLOR = '#3d2010';
export const POINT_LIGHT_COLOR = '#d4a76a';
export const POINT_DARK_COLOR = '#2d1810';
export const WHITE_CHECKER_COLOR = '#f0e6d2';
export const WHITE_CHECKER_BORDER = '#c4b496';
export const BLACK_CHECKER_COLOR = '#2c2c2c';
export const BLACK_CHECKER_BORDER = '#555555';
export const SELECTED_COLOR = 'rgba(250, 204, 21, 0.6)';
export const VALID_TARGET_COLOR = 'rgba(34, 197, 94, 0.5)';
export const DICE_BG_COLOR = '#fff8e7';
export const DICE_DOT_COLOR = '#1a1a1a';
export const HUD_TEXT_COLOR = '#e0e0e0';
export const HIGHLIGHT_COLOR = 'rgba(255, 215, 0, 0.3)';
export const BEAR_OFF_ZONE_COLOR = '#3d2510';

// 玩家
export const PLAYER_WHITE = 1; // 白方（玩家）— 从 point 24 向 point 1 方向移动
export const PLAYER_BLACK = 2; // 黑方（AI）— 从 point 1 向 point 24 方向移动

// 方向
export const WHITE_DIRECTION = -1; // 白方向低号移动
export const BLACK_DIRECTION = 1;  // 黑方向高号移动

// 白方内盘 points 1-6, 黑方内盘 points 19-24
export const WHITE_HOME_RANGE = [1, 6];
export const BLACK_HOME_RANGE = [19, 24];

// AI
export const AI_THINK_TIME = 600; // ms

// 游戏阶段
export enum GamePhase {
  ROLL_DICE = 'roll_dice',       // 等待掷骰子
  SELECT_CHECKER = 'select',     // 选择棋子
  SELECT_TARGET = 'target',      // 选择目标点
  AI_TURN = 'ai_turn',           // AI 回合
  GAME_OVER = 'game_over',       // 游戏结束
}

// 初始棋盘布局（标准双陆棋）
// 正数 = 白子数量，负数 = 黑子数量，0 = 空
export const INITIAL_BOARD: number[] = [
  0,   // point 0 (unused)
  -2,   // point 1: 2 黑子
   0,   // point 2
   0,   // point 3
   0,   // point 4
   5,   // point 5: 5 白子
   0,   // point 6
   3,   // point 7: 3 白子
   0,   // point 8
   0,   // point 9
   0,   // point 10
  -5,   // point 11: 5 黑子
   5,   // point 12: 5 白子
   0,   // point 13
   0,   // point 14
   0,   // point 15
  -3,   // point 16: 3 黑子
   0,   // point 17
   -5,   // point 18: 5 黑子  (was point 19)
   0,   // point 19
   0,   // point 20
   0,   // point 21
   0,   // point 22
   2,    // point 23: 2 白子  (was point 24)
   0,   // point 24 (unused)
];
