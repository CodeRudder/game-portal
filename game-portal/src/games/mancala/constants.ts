// ========== Mancala 曼卡拉常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘布局
export const PITS_PER_SIDE = 6;        // 每侧凹坑数
export const INITIAL_SEEDS = 4;         // 每坑初始种子数
export const TOTAL_PITS = 14;           // 总坑数（12 凹坑 + 2 仓库）

// 仓库索引
export const PLAYER_STORE = 6;          // 玩家仓库索引
export const AI_STORE = 13;             // AI 仓库索引

// 玩家范围
export const PLAYER_PITS = [0, 1, 2, 3, 4, 5] as const;   // 玩家凹坑索引
export const AI_PITS = [7, 8, 9, 10, 11, 12] as const;     // AI 凹坑索引

// 颜色
export const BG_COLOR = '#1a0a2e';
export const BOARD_COLOR = '#3e2723';
export const BOARD_BORDER_COLOR = '#5d4037';
export const PIT_COLOR = '#2c1810';
export const PIT_HOVER_COLOR = '#4e342e';
export const PIT_ACTIVE_COLOR = '#6d4c41';
export const STORE_COLOR = '#1b5e20';
export const STORE_PLAYER_COLOR = '#1565c0';
export const STORE_AI_COLOR = '#c62828';
export const SEED_COLOR = '#ffd54f';
export const SEED_SHADOW = '#f9a825';
export const TEXT_COLOR = '#ffffff';
export const TEXT_DIM_COLOR = 'rgba(255,255,255,0.6)';
export const HIGHLIGHT_COLOR = '#ffab00';
export const VALID_MOVE_COLOR = 'rgba(76,175,80,0.4)';

// 布局尺寸
export const BOARD_MARGIN_X = 20;
export const BOARD_MARGIN_Y = 80;
export const BOARD_PADDING = 15;
export const STORE_WIDTH = 60;
export const PIT_WIDTH = 52;
export const PIT_HEIGHT = 52;
export const PIT_GAP = 8;
export const PIT_RADIUS = 20;
export const SEED_RADIUS = 6;
export const STORE_HEIGHT = 240;

// AI 参数
export const AI_THINK_DELAY = 800;      // AI 思考延迟（毫秒）
export const AI_DIFFICULTY_EASY = 0.3;
export const AI_DIFFICULTY_MEDIUM = 0.6;
export const AI_DIFFICULTY_HARD = 0.9;

// 动画
export const SEED_ANIM_DURATION = 120;  // 每颗种子动画时长（毫秒）
export const PIT_ANIM_DURATION = 200;   // 凹坑高亮动画时长

// HUD
export const HUD_HEIGHT = 60;
export const FONT_FAMILY = 'monospace';
