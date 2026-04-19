// ========== Air Hockey 空气曲棍球常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 桌面边距
export const TABLE_MARGIN = 20;
export const TABLE_LEFT = TABLE_MARGIN;
export const TABLE_RIGHT = CANVAS_WIDTH - TABLE_MARGIN;
export const TABLE_TOP = TABLE_MARGIN;
export const TABLE_BOTTOM = CANVAS_HEIGHT - TABLE_MARGIN;
export const TABLE_WIDTH = TABLE_RIGHT - TABLE_LEFT;
export const TABLE_HEIGHT = TABLE_BOTTOM - TABLE_TOP;

// 中线
export const CENTER_Y = CANVAS_HEIGHT / 2;

// 球门
export const GOAL_WIDTH = 120;
export const GOAL_LEFT = (CANVAS_WIDTH - GOAL_WIDTH) / 2;
export const GOAL_RIGHT = (CANVAS_WIDTH + GOAL_WIDTH) / 2;
export const GOAL_DEPTH = 10;

// 推板（Mallet）
export const MALLET_RADIUS = 28;
export const MALLET_SPEED = 7;
export const MALLET_COLOR_PLAYER = '#4fc3f7';
export const MALLET_COLOR_AI = '#ef5350';

// 推板活动范围
export const PLAYER_MIN_Y = CENTER_Y + MALLET_RADIUS;
export const PLAYER_MAX_Y = TABLE_BOTTOM - MALLET_RADIUS;
export const AI_MIN_Y = TABLE_TOP + MALLET_RADIUS;
export const AI_MAX_Y = CENTER_Y - MALLET_RADIUS;
export const MALLET_MIN_X = TABLE_LEFT + MALLET_RADIUS;
export const MALLET_MAX_X = TABLE_RIGHT - MALLET_RADIUS;

// 冰球（Puck）
export const PUCK_RADIUS = 14;
export const PUCK_INITIAL_SPEED = 4;
export const PUCK_MAX_SPEED = 12;
export const PUCK_FRICTION = 0.998; // 每帧摩擦系数
export const PUCK_COLOR = '#ffffff';

// 冰球初始位置
export const PUCK_START_X = CANVAS_WIDTH / 2;
export const PUCK_START_Y = CANVAS_HEIGHT / 2;

// 得分
export const WIN_SCORE = 7;

// AI 参数
export const AI_BASE_SPEED = 3.0;
export const AI_SPEED_PER_LEVEL = 0.6;
export const AI_TRACKING_ERROR = 40; // 像素，跟踪误差
export const AI_REACTION_DELAY = 0.18; // 秒

// 发球延迟（毫秒）
export const SERVE_DELAY = 800;

// 颜色
export const BG_COLOR = '#1a237e';
export const TABLE_COLOR = '#0d47a1';
export const LINE_COLOR = 'rgba(255,255,255,0.25)';
export const GOAL_COLOR = '#ffeb3b';
export const SCORE_COLOR = '#ffffff';

// 碰撞弹性系数
export const WALL_BOUNCE = 0.85;
export const MALLET_BOUNCE = 1.05;

// 推板质量（影响冰球反弹速度）
export const MALLET_MASS = 5;
export const PUCK_MASS = 1;
