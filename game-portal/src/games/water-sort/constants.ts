// ========== 水排序 (Water Sort) 常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 试管配置
export const TUBE_CAPACITY = 4; // 每根试管最多装4层水

// 颜色池
export const COLOR_POOL = [
  '#FF4444', // 红
  '#44AAFF', // 蓝
  '#44DD44', // 绿
  '#FFAA00', // 橙
  '#AA44FF', // 紫
  '#FF44AA', // 粉
  '#44DDDD', // 青
  '#DDDD00', // 黄
  '#FF6600', // 深橙
  '#8844FF', // 靛蓝
  '#FF8888', // 浅红
  '#00CC88', // 翡翠绿
];

// 关卡配置
export interface LevelConfig {
  level: number;
  colorCount: number;   // 使用颜色数
  tubeCount: number;    // 有色试管数（不含空试管）
  emptyTubes: number;   // 空试管数
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1,  colorCount: 3, tubeCount: 3, emptyTubes: 2 },
  { level: 2,  colorCount: 3, tubeCount: 3, emptyTubes: 2 },
  { level: 3,  colorCount: 4, tubeCount: 4, emptyTubes: 2 },
  { level: 4,  colorCount: 4, tubeCount: 4, emptyTubes: 2 },
  { level: 5,  colorCount: 5, tubeCount: 5, emptyTubes: 2 },
  { level: 6,  colorCount: 5, tubeCount: 5, emptyTubes: 2 },
  { level: 7,  colorCount: 6, tubeCount: 6, emptyTubes: 2 },
  { level: 8,  colorCount: 6, tubeCount: 6, emptyTubes: 2 },
  { level: 9,  colorCount: 7, tubeCount: 7, emptyTubes: 2 },
  { level: 10, colorCount: 7, tubeCount: 7, emptyTubes: 2 },
  { level: 11, colorCount: 8, tubeCount: 8, emptyTubes: 2 },
  { level: 12, colorCount: 8, tubeCount: 8, emptyTubes: 2 },
  { level: 13, colorCount: 9, tubeCount: 9, emptyTubes: 2 },
  { level: 14, colorCount: 9, tubeCount: 9, emptyTubes: 2 },
  { level: 15, colorCount: 10, tubeCount: 10, emptyTubes: 2 },
  { level: 16, colorCount: 10, tubeCount: 10, emptyTubes: 2 },
  { level: 17, colorCount: 11, tubeCount: 11, emptyTubes: 2 },
  { level: 18, colorCount: 11, tubeCount: 11, emptyTubes: 2 },
  { level: 19, colorCount: 12, tubeCount: 12, emptyTubes: 2 },
  { level: 20, colorCount: 12, tubeCount: 12, emptyTubes: 2 },
];

export const MAX_LEVEL = LEVEL_CONFIGS.length;

// 计分
export const BASE_SCORE = 100;
export const LEVEL_BONUS = 50;
export const MOVE_PENALTY = 2;

// 颜色
export const COLORS = {
  BG: '#0f0f23',
  HUD_BG: '#1a1a3e',
  HUD_TEXT: '#e0e0e0',
  HUD_ACCENT: '#00d4ff',
  TUBE_BORDER: '#4a4a6a',
  TUBE_FILL: '#2d2d4a',
  TUBE_SELECTED: '#00ff88',
  TUBE_HOVER: '#3d5a3d',
  EMPTY_TUBE: '#1a1a2e',
  CURSOR_COLOR: '#00ff88',
  WIN_TEXT: '#00ff88',
  WATER_SHINE: 'rgba(255,255,255,0.15)',
};

// 布局
export const HUD_HEIGHT = 60;
export const TUBE_PADDING = 20;
export const TUBE_GAP = 8;
export const WATER_GAP = 2;

// 动画
export const POUR_ANIM_DURATION = 300; // ms
