// ========== 拧螺丝 (Screw Pin Puzzle) 常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// HUD 区域高度
export const HUD_HEIGHT = 60;

// ========== 螺丝常量 ==========
export const SCREW_RADIUS = 12;
export const SCREW_HEAD_RADIUS = 8;
export const SCREW_SLOT_WIDTH = 2;
export const SCREW_SLOT_LENGTH = 10;

// ========== 板常量 ==========
export const BOARD_MIN_WIDTH = 60;
export const BOARD_MIN_HEIGHT = 20;
export const BOARD_BORDER_RADIUS = 4;

// ========== 框架常量 ==========
export const FRAME_PADDING = 30;
export const FRAME_BORDER_WIDTH = 4;

// ========== 动画常量 ==========
export const UNSCREW_ANIM_DURATION = 400; // ms
export const FALL_ANIM_DURATION = 600; // ms
export const FALL_GRAVITY = 800; // px/s²

// ========== 颜色 ==========
export const COLORS = {
  BG: '#0f0f23',
  FRAME_BG: '#1a1a3e',
  FRAME_BORDER: '#4a4a6a',

  HUD_BG: '#1a1a3e',
  HUD_TEXT: '#e0e0e0',
  HUD_ACCENT: '#00d4ff',

  SCREW_BODY: '#c0c0c0',
  SCREW_HEAD: '#d4d4d8',
  SCREW_SLOT: '#4a4a6a',
  SCREW_SELECTED: '#00ff88',
  SCREW_REMOVED: 'transparent',

  BOARD_COLORS: [
    '#e74c3c', // 红
    '#3498db', // 蓝
    '#2ecc71', // 绿
    '#f39c12', // 橙
    '#9b59b6', // 紫
    '#1abc9c', // 青
    '#e67e22', // 深橙
    '#e84393', // 粉
  ],

  CURSOR_COLOR: '#00ff88',
  CURSOR_WIDTH: 3,

  WIN_TEXT: '#00ff88',
  STUCK_TEXT: '#ff4757',
};

// ========== 关卡配置 ==========
export interface LevelConfig {
  level: number;
  boards: BoardDef[];
  screws: ScrewDef[];
  label: string;
}

export interface BoardDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
}

export interface ScrewDef {
  id: string;
  x: number;
  y: number;
  connectedBoardIds: string[];
}

// ========== 关卡定义 ==========
// 关卡1: 2块板, 3颗螺丝 (入门)
const LEVEL_1: LevelConfig = {
  level: 1,
  label: '入门',
  boards: [
    { id: 'b1', x: 80, y: 180, width: 140, height: 40, colorIndex: 0 },
    { id: 'b2', x: 260, y: 280, width: 140, height: 40, colorIndex: 1 },
  ],
  screws: [
    { id: 's1', x: 120, y: 200, connectedBoardIds: ['b1'] },
    { id: 's2', x: 280, y: 200, connectedBoardIds: ['b1', 'b2'] },
    { id: 's3', x: 320, y: 300, connectedBoardIds: ['b2'] },
  ],
};

// 关卡2: 3块板, 5颗螺丝 (简单)
const LEVEL_2: LevelConfig = {
  level: 2,
  label: '简单',
  boards: [
    { id: 'b1', x: 60, y: 150, width: 160, height: 35, colorIndex: 0 },
    { id: 'b2', x: 260, y: 150, width: 160, height: 35, colorIndex: 1 },
    { id: 'b3', x: 140, y: 280, width: 200, height: 35, colorIndex: 2 },
  ],
  screws: [
    { id: 's1', x: 100, y: 168, connectedBoardIds: ['b1'] },
    { id: 's2', x: 180, y: 168, connectedBoardIds: ['b1', 'b3'] },
    { id: 's3', x: 300, y: 168, connectedBoardIds: ['b2'] },
    { id: 's4', x: 380, y: 168, connectedBoardIds: ['b2', 'b3'] },
    { id: 's5', x: 240, y: 298, connectedBoardIds: ['b3'] },
  ],
};

// 关卡3: 4块板, 7颗螺丝 (中等)
const LEVEL_3: LevelConfig = {
  level: 3,
  label: '中等',
  boards: [
    { id: 'b1', x: 60, y: 120, width: 150, height: 35, colorIndex: 0 },
    { id: 'b2', x: 270, y: 120, width: 150, height: 35, colorIndex: 1 },
    { id: 'b3', x: 60, y: 260, width: 150, height: 35, colorIndex: 2 },
    { id: 'b4', x: 270, y: 260, width: 150, height: 35, colorIndex: 3 },
  ],
  screws: [
    { id: 's1', x: 100, y: 138, connectedBoardIds: ['b1'] },
    { id: 's2', x: 170, y: 138, connectedBoardIds: ['b1', 'b3'] },
    { id: 's3', x: 310, y: 138, connectedBoardIds: ['b2'] },
    { id: 's4', x: 380, y: 138, connectedBoardIds: ['b2', 'b4'] },
    { id: 's5', x: 100, y: 278, connectedBoardIds: ['b3'] },
    { id: 's6', x: 240, y: 278, connectedBoardIds: ['b3', 'b4'] },
    { id: 's7', x: 380, y: 278, connectedBoardIds: ['b4'] },
  ],
};

// 关卡4: 5块板, 9颗螺丝 (困难)
const LEVEL_4: LevelConfig = {
  level: 4,
  label: '困难',
  boards: [
    { id: 'b1', x: 50, y: 100, width: 130, height: 35, colorIndex: 0 },
    { id: 'b2', x: 200, y: 100, width: 130, height: 35, colorIndex: 1 },
    { id: 'b3', x: 350, y: 100, width: 80, height: 35, colorIndex: 2 },
    { id: 'b4', x: 100, y: 220, width: 180, height: 35, colorIndex: 3 },
    { id: 'b5', x: 300, y: 320, width: 130, height: 35, colorIndex: 4 },
  ],
  screws: [
    { id: 's1', x: 80, y: 118, connectedBoardIds: ['b1'] },
    { id: 's2', x: 150, y: 118, connectedBoardIds: ['b1', 'b4'] },
    { id: 's3', x: 240, y: 118, connectedBoardIds: ['b2'] },
    { id: 's4', x: 320, y: 118, connectedBoardIds: ['b2', 'b5'] },
    { id: 's5', x: 390, y: 118, connectedBoardIds: ['b3', 'b5'] },
    { id: 's6', x: 160, y: 238, connectedBoardIds: ['b4'] },
    { id: 's7', x: 240, y: 238, connectedBoardIds: ['b4', 'b5'] },
    { id: 's8', x: 350, y: 338, connectedBoardIds: ['b5'] },
    { id: 's9', x: 200, y: 300, connectedBoardIds: ['b4'] },
  ],
};

// 关卡5: 6块板, 11颗螺丝 (专家)
const LEVEL_5: LevelConfig = {
  level: 5,
  label: '专家',
  boards: [
    { id: 'b1', x: 40, y: 90, width: 120, height: 30, colorIndex: 0 },
    { id: 'b2', x: 180, y: 90, width: 120, height: 30, colorIndex: 1 },
    { id: 'b3', x: 320, y: 90, width: 120, height: 30, colorIndex: 2 },
    { id: 'b4', x: 60, y: 200, width: 140, height: 30, colorIndex: 3 },
    { id: 'b5', x: 220, y: 200, width: 140, height: 30, colorIndex: 4 },
    { id: 'b6', x: 140, y: 320, width: 200, height: 30, colorIndex: 5 },
  ],
  screws: [
    { id: 's1', x: 70, y: 105, connectedBoardIds: ['b1'] },
    { id: 's2', x: 130, y: 105, connectedBoardIds: ['b1', 'b4'] },
    { id: 's3', x: 210, y: 105, connectedBoardIds: ['b2'] },
    { id: 's4', x: 290, y: 105, connectedBoardIds: ['b2', 'b5'] },
    { id: 's5', x: 350, y: 105, connectedBoardIds: ['b3'] },
    { id: 's6', x: 420, y: 105, connectedBoardIds: ['b3', 'b5'] },
    { id: 's7', x: 100, y: 215, connectedBoardIds: ['b4'] },
    { id: 's8', x: 180, y: 215, connectedBoardIds: ['b4', 'b6'] },
    { id: 's9', x: 280, y: 215, connectedBoardIds: ['b5'] },
    { id: 's10', x: 350, y: 215, connectedBoardIds: ['b5', 'b6'] },
    { id: 's11', x: 240, y: 335, connectedBoardIds: ['b6'] },
  ],
};

// 关卡6: 7块板, 13颗螺丝 (大师)
const LEVEL_6: LevelConfig = {
  level: 6,
  label: '大师',
  boards: [
    { id: 'b1', x: 40, y: 80, width: 110, height: 28, colorIndex: 0 },
    { id: 'b2', x: 170, y: 80, width: 110, height: 28, colorIndex: 1 },
    { id: 'b3', x: 300, y: 80, width: 110, height: 28, colorIndex: 2 },
    { id: 'b4', x: 50, y: 180, width: 130, height: 28, colorIndex: 3 },
    { id: 'b5', x: 200, y: 180, width: 130, height: 28, colorIndex: 4 },
    { id: 'b6', x: 340, y: 180, width: 90, height: 28, colorIndex: 5 },
    { id: 'b7', x: 120, y: 300, width: 240, height: 28, colorIndex: 6 },
  ],
  screws: [
    { id: 's1', x: 70, y: 94, connectedBoardIds: ['b1'] },
    { id: 's2', x: 120, y: 94, connectedBoardIds: ['b1', 'b4'] },
    { id: 's3', x: 200, y: 94, connectedBoardIds: ['b2'] },
    { id: 's4', x: 260, y: 94, connectedBoardIds: ['b2', 'b5'] },
    { id: 's5', x: 330, y: 94, connectedBoardIds: ['b3'] },
    { id: 's6', x: 390, y: 94, connectedBoardIds: ['b3', 'b6'] },
    { id: 's7', x: 80, y: 194, connectedBoardIds: ['b4'] },
    { id: 's8', x: 150, y: 194, connectedBoardIds: ['b4', 'b7'] },
    { id: 's9', x: 240, y: 194, connectedBoardIds: ['b5'] },
    { id: 's10', x: 310, y: 194, connectedBoardIds: ['b5', 'b7'] },
    { id: 's11', x: 370, y: 194, connectedBoardIds: ['b6'] },
    { id: 's12', x: 400, y: 194, connectedBoardIds: ['b6', 'b7'] },
    { id: 's13', x: 240, y: 314, connectedBoardIds: ['b7'] },
  ],
};

export const LEVEL_CONFIGS: LevelConfig[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
];

export const MAX_LEVEL = LEVEL_CONFIGS.length;

// ========== 计分 ==========
export const BASE_SCORE_PER_SCREW = 50;
export const LEVEL_BONUS = 100;
export const PERFECT_BONUS = 200;
export const STUCK_PENALTY = 50;

// ========== 游戏状态枚举 ==========
export type ScrewState = 'fixed' | 'unscrewing' | 'removed';
export type BoardState = 'fixed' | 'falling' | 'fallen' | 'stuck';
