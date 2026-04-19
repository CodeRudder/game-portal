// ========== Pong 乒乓球常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const HUD_HEIGHT = 40;

// 挡板（左右垂直挡板）
export const PADDLE_WIDTH = 12;
export const PADDLE_HEIGHT = 80;
export const PADDLE_SPEED = 6;
export const PADDLE_COLOR = '#4fc3f7';

// 挡板 X 位置
export const LEFT_PADDLE_X = 20;
export const RIGHT_PADDLE_X = CANVAS_WIDTH - 20 - PADDLE_WIDTH;

// 挡板 Y 位置（居中）
export const PADDLE_START_Y = (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2;

// 球
export const BALL_RADIUS = 6;
export const BALL_INITIAL_SPEED = 5;
export const BALL_MAX_SPEED = 10;
export const BALL_SPEED_INCREMENT = 0.3;
export const BALL_COLOR = '#ffffff';

// 得分
export const WIN_SCORE = 11;

// AI 参数
export const AI_REACTION_DELAY = 0.15; // 秒，反应延迟
export const AI_BASE_SPEED = 3.5;
export const AI_SPEED_PER_LEVEL = 0.5;
export const AI_TRACKING_ERROR = 30; // 像素，跟踪误差

// 颜色
export const BG_COLOR = '#0a0a2e';
export const HUD_COLOR = '#ffffff';
export const NET_COLOR = 'rgba(255,255,255,0.15)';

// 发球延迟（毫秒）
export const SERVE_DELAY = 1000;
