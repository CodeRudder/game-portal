// ========== Lunar Lander 月球着陆器常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ---------- 登陆舱 ----------
export const LANDER_WIDTH = 20;
export const LANDER_HEIGHT = 24;
export const LANDER_START_X = CANVAS_WIDTH / 2;
export const LANDER_START_Y = 60;

// ---------- 物理参数 ----------
export const GRAVITY = 0.03;              // 每帧重力加速度（px/frame²）
export const MAIN_THRUST = 0.07;          // 主推力（向上）
export const ROTATION_SPEED = 3;          // 旋转速度（度/帧）
export const MAX_SAFE_VY = 1.5;           // 安全着陆最大垂直速度
export const MAX_SAFE_VX = 1.0;           // 安全着陆最大水平速度
export const MAX_SAFE_ANGLE = 15;         // 安全着陆最大倾斜角（度）

// ---------- 燃料 ----------
export const INITIAL_FUEL = 100;
export const FUEL_CONSUMPTION_THRUST = 0.3;   // 主推力每帧消耗
export const FUEL_CONSUMPTION_ROTATE = 0.05;   // 旋转每帧消耗
export const FUEL_BONUS_PER_LEVEL = 10;        // 每过一关奖励燃料

// ---------- 地形 ----------
export const TERRAIN_SEGMENTS = 30;           // 地形分段数
export const TERRAIN_MIN_Y = 420;             // 地形最高点 Y
export const TERRAIN_MAX_Y = 580;             // 地形最低点 Y
export const BASE_LANDING_ZONE_WIDTH = 80;    // 基础着陆区宽度
export const LANDING_ZONE_WIDTH_DECREASE = 8; // 每关着陆区缩小量
export const MIN_LANDING_ZONE_WIDTH = 40;     // 最小着陆区宽度
export const LANDING_ZONE_MARKER_HEIGHT = 4;  // 着陆区标记高度

// ---------- 关卡 ----------
export const MAX_LEVELS = 10;

// ---------- 颜色 ----------
export const BG_COLOR = '#0b0b2a';
export const STAR_COLOR = '#ffffff';
export const LANDER_COLOR = '#c0c0c0';
export const LANDER_WINDOW_COLOR = '#4fc3f7';
export const THRUST_FLAME_COLOR = '#ff6600';
export const THRUST_FLAME_INNER_COLOR = '#ffff00';
export const TERRAIN_COLOR = '#555555';
export const TERRAIN_FILL_COLOR = '#333333';
export const LANDING_ZONE_COLOR = '#66bb6a';
export const HUD_COLOR = '#ffffff';
export const FUEL_BAR_BG_COLOR = '#333333';
export const FUEL_BAR_COLOR = '#4fc3f7';
export const FUEL_BAR_LOW_COLOR = '#ef5350';
export const SUCCESS_COLOR = '#66bb6a';
export const CRASH_COLOR = '#ef5350';

// ---------- 星星 ----------
export const STAR_COUNT = 60;

// ---------- HUD ----------
export const HUD_MARGIN = 10;
export const HUD_FONT_SIZE = 14;
export const FUEL_BAR_WIDTH = 100;
export const FUEL_BAR_HEIGHT = 10;
export const FUEL_LOW_THRESHOLD = 20;  // 燃料低于此值显示红色
