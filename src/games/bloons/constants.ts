// ========== Bloons 打气球 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 气球类型 ==========
export enum BloonType {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
}

// ========== 气球属性 ==========
/** 各类型气球的血量 */
export const BLOON_HP: Record<BloonType, number> = {
  [BloonType.RED]: 1,
  [BloonType.BLUE]: 2,
  [BloonType.GREEN]: 3,
  [BloonType.YELLOW]: 5,
};

/** 各类型气球的颜色 */
export const BLOON_COLORS: Record<BloonType, string> = {
  [BloonType.RED]: '#ff4444',
  [BloonType.BLUE]: '#4488ff',
  [BloonType.GREEN]: '#44cc44',
  [BloonType.YELLOW]: '#ffcc00',
};

/** 各类型气球被击破时的得分 */
export const BLOON_SCORE: Record<BloonType, number> = {
  [BloonType.RED]: 10,
  [BloonType.BLUE]: 25,
  [BloonType.GREEN]: 50,
  [BloonType.YELLOW]: 100,
};

/** 气球半径 */
export const BLOON_RADIUS = 16;

// ========== 路径系统 ==========
/** 路径航点（S形蜿蜒路径） */
export const PATH_WAYPOINTS: { x: number; y: number }[] = [
  { x: -20, y: 100 },
  { x: 120, y: 100 },
  { x: 120, y: 200 },
  { x: 360, y: 200 },
  { x: 360, y: 100 },
  { x: 460, y: 100 },
  { x: 460, y: 300 },
  { x: 120, y: 300 },
  { x: 120, y: 400 },
  { x: 360, y: 400 },
  { x: 360, y: 500 },
  { x: 120, y: 500 },
  { x: 120, y: 600 },
  { x: 500, y: 600 },
];

// ========== 飞镖猴（塔） ==========
/** 飞镖猴射程半径 */
export const MONKEY_RANGE = 120;
/** 飞镖猴攻击间隔（毫秒） */
export const MONKEY_ATTACK_INTERVAL = 1500;
/** 飞镖猴大小 */
export const MONKEY_SIZE = 24;

// ========== 飞镖 ==========
/** 飞镖速度（像素/毫秒） */
export const DART_SPEED = 0.4;
/** 飞镖大小 */
export const DART_SIZE = 8;
/** 玩家手动投掷飞镖的冷却时间（毫秒） */
export const DART_COOLDOWN = 300;

// ========== 准星 ==========
/** 准星移动速度（像素/毫秒） */
export const CROSSHAIR_SPEED = 0.3;
/** 准星大小 */
export const CROSSHAIR_SIZE = 18;

// ========== 关卡系统 ==========
/** 关卡配置 */
export interface LevelConfig {
  /** 红色气球数量 */
  red: number;
  /** 蓝色气球数量 */
  blue: number;
  /** 绿色气球数量 */
  green: number;
  /** 黄色气球数量 */
  yellow: number;
  /** 气球速度倍率 */
  speedMultiplier: number;
  /** 本关可用飞镖数 */
  darts: number;
}

/** 关卡定义（10关） */
export const LEVELS: LevelConfig[] = [
  { red: 5,  blue: 0,  green: 0,  yellow: 0,  speedMultiplier: 1.0, darts: 10 },
  { red: 8,  blue: 2,  green: 0,  yellow: 0,  speedMultiplier: 1.1, darts: 12 },
  { red: 6,  blue: 5,  green: 0,  yellow: 0,  speedMultiplier: 1.2, darts: 14 },
  { red: 5,  blue: 5,  green: 3,  yellow: 0,  speedMultiplier: 1.3, darts: 16 },
  { red: 8,  blue: 6,  green: 4,  yellow: 0,  speedMultiplier: 1.4, darts: 18 },
  { red: 5,  blue: 8,  green: 5,  yellow: 2,  speedMultiplier: 1.5, darts: 20 },
  { red: 8,  blue: 8,  green: 6,  yellow: 3,  speedMultiplier: 1.6, darts: 22 },
  { red: 10, blue: 8,  green: 8,  yellow: 4,  speedMultiplier: 1.7, darts: 25 },
  { red: 10, blue: 10, green: 8,  yellow: 5,  speedMultiplier: 1.8, darts: 28 },
  { red: 12, blue: 12, green: 10, yellow: 6,  speedMultiplier: 2.0, darts: 32 },
];

/** 气球基础移动速度（像素/毫秒） */
export const BLOON_BASE_SPEED = 0.04;

// ========== 生命系统 ==========
/** 初始生命数 */
export const INITIAL_LIVES = 20;

// ========== 飞镖猴放置位置 ==========
/** 可用飞镖猴放置位置（固定位置） */
export const MONKEY_SLOTS: { x: number; y: number }[] = [
  { x: 240, y: 150 },
  { x: 240, y: 350 },
  { x: 240, y: 550 },
  { x: 60,  y: 250 },
  { x: 420, y: 450 },
];

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const PATH_COLOR = '#8B7355';
export const PATH_BORDER_COLOR = '#6B5335';
export const PATH_WIDTH = 30;
export const HUD_COLOR = '#ffffff';
export const HUD_BG_COLOR = 'rgba(0,0,0,0.5)';
export const HUD_HEIGHT = 50;
export const CROSSHAIR_COLOR = '#ff4757';
export const CROSSHAIR_DOT_COLOR = '#ffffff';
export const DART_COLOR = '#c0c0c0';
export const MONKEY_BODY_COLOR = '#8B4513';
export const MONKEY_FACE_COLOR = '#DEB887';

// ========== 气球生成间隔 ==========
/** 气球生成间隔（毫秒） */
export const BLOON_SPAWN_INTERVAL = 600;

// ========== 键盘映射 ==========
export const DIRECTION_KEYS = {
  UP: ['ArrowUp', 'w', 'W'],
  DOWN: ['ArrowDown', 's', 'S'],
  LEFT: ['ArrowLeft', 'a', 'A'],
  RIGHT: ['ArrowRight', 'd', 'D'],
};
