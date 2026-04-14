// ========== Senet 塞尼特游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘参数
export const BOARD_COLS = 10;
export const BOARD_ROWS = 3;
export const TOTAL_CELLS = 30;
export const CELL_SIZE = 44;
export const BOARD_OFFSET_X = 20;
export const BOARD_OFFSET_Y = 120;
export const BOARD_PADDING = 4;

// 棋子参数
export const PIECES_PER_PLAYER = 5;
export const PLAYER1 = 1; // 白色
export const PLAYER2 = 2; // 黑色

// 掷棍参数
export const STICK_COUNT = 4;

// 特殊格子
export const SAFE_HOUSE = 15;   // 第15格（索引14）- 安全区，不能被吃
export const BEAUTY_HOUSE = 26; // 第26格（索引25）- 美丽之屋
export const WATER_HOUSE = 27;  // 第27格（索引26）- 水之屋，掉入回到安全屋
export const TRUTH_HOUSE = 28;  // 第28格（索引27）- 真理之屋
export const RE_ATOUM_HOUSE = 29; // 第29格（索引28）- Re-Atoum之屋
export const EXIT_HOUSE = 30;   // 第30格（索引29）- 出口

// 安全球列表
export const SAFE_HOUSES = [15, 26, 28, 29];

// 掷棍结果到步数映射
// 0白面 = 0步（特殊），1白面=1步，2白面=2步，3白面=3步，4白面=4步+额外回合
export const THROW_EXTRA_TURN = [1, 4]; // 掷出1或4获得额外回合

// 颜色
export const BG_COLOR = '#2c1810';
export const BOARD_COLOR = '#d4a574';
export const BOARD_BORDER_COLOR = '#8b6914';
export const CELL_COLOR = '#e8c89e';
export const CELL_DARK_COLOR = '#c9a06c';
export const SAFE_CELL_COLOR = '#ffd700';
export const WATER_CELL_COLOR = '#4a90d9';
export const PLAYER1_COLOR = '#ffffff';
export const PLAYER2_COLOR = '#1a1a1a';
export const PLAYER1_BORDER = '#cccccc';
export const PLAYER2_BORDER = '#444444';
export const HIGHLIGHT_COLOR = '#00ff88';
export const SELECTED_COLOR = '#ff6b6b';
export const VALID_MOVE_COLOR = 'rgba(0, 255, 136, 0.4)';
export const SCORE_COLOR = '#ffffff';
export const STICK_WHITE = '#f5f5dc';
export const STICK_DARK = '#2c1810';
export const TEXT_COLOR = '#ffffff';
export const PATH_COLOR = 'rgba(255, 215, 0, 0.3)';

// AI 参数
export const AI_DELAY = 1000; // AI 思考延迟（毫秒）
