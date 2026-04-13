// ========== Dots and Boxes 点与线 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// HUD 区域
export const HUD_HEIGHT = 60;
export const FOOTER_HEIGHT = 40;

// 游戏区域
export const GAME_AREA_TOP = HUD_HEIGHT;
export const GAME_AREA_BOTTOM = CANVAS_HEIGHT - FOOTER_HEIGHT;
export const GAME_AREA_HEIGHT = GAME_AREA_BOTTOM - GAME_AREA_TOP;

// 玩家
export const PLAYER_1 = 1;
export const PLAYER_2 = 2;
export const NO_PLAYER = 0;

// 线段方向
export const LINE_HORIZONTAL = 'horizontal';
export const LINE_VERTICAL = 'vertical';
export type LineDirection = 'horizontal' | 'vertical';

// 网格大小选项（点数）
export const GRID_SIZES = [3, 5, 7] as const;
export type GridSize = typeof GRID_SIZES[number];
export const DEFAULT_GRID_SIZE: GridSize = 5;

// 颜色
export const BG_COLOR = '#0a0a2e';
export const DOT_COLOR = '#ffffff';
export const DOT_RADIUS = 5;
export const LINE_COLOR = '#4a5568';
export const LINE_HIGHLIGHT_COLOR = '#ffd700';
export const LINE_DRAWN_COLOR = '#a0aec0';
export const PLAYER1_COLOR = '#3b82f6'; // 蓝色
export const PLAYER2_COLOR = '#ef4444'; // 红色
export const PLAYER1_BOX_COLOR = 'rgba(59, 130, 246, 0.3)';
export const PLAYER2_BOX_COLOR = 'rgba(239, 68, 68, 0.3)';
export const CURSOR_COLOR = '#ffd700';
export const TEXT_COLOR = '#ffffff';
export const SCORE_COLOR = '#00ff88';

// 线段宽度
export const LINE_WIDTH = 4;
export const LINE_HIGHLIGHT_WIDTH = 6;

// AI 思考延迟（ms）
export const AI_THINK_DELAY = 400;
