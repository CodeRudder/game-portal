// ========== 点灯游戏 (Lights Out) 常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 网格
export const GRID_SIZE = 5;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;

// HUD 区域高度
export const HUD_HEIGHT = 60;

// ========== 等级配置 ==========
export interface LevelConfig {
  level: number;
  minClicks: number;
  maxClicks: number;
  label: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, minClicks: 2, maxClicks: 4, label: "入门" },
  { level: 2, minClicks: 4, maxClicks: 7, label: "简单" },
  { level: 3, minClicks: 6, maxClicks: 10, label: "中等" },
  { level: 4, minClicks: 9, maxClicks: 14, label: "困难" },
  { level: 5, minClicks: 12, maxClicks: 18, label: "专家" },
  { level: 6, minClicks: 16, maxClicks: 22, label: "大师" },
];

export const MAX_LEVEL = LEVEL_CONFIGS.length;

// ========== 计分 ==========
export const BASE_SCORE = 100;
export const OPTIMAL_BONUS = 50;
export const LEVEL_MULTIPLIER = 20;

// ========== 颜色 ==========
export const COLORS = {
  BG: "#0f0f23",
  HUD_BG: "#1a1a3e",
  HUD_TEXT: "#e0e0e0",
  HUD_ACCENT: "#00d4ff",

  LIGHT_ON: "#ffd700",
  LIGHT_ON_GLOW: "#ffed4a",
  LIGHT_OFF: "#2d2d4a",
  LIGHT_OFF_BORDER: "#3d3d5c",
  LIGHT_BORDER: "#4a4a6a",

  CURSOR_COLOR: "#00ff88",
  CURSOR_WIDTH: 3,

  WIN_TEXT: "#00ff88",
};

// ========== 网格布局 ==========
export const GRID_PADDING = 20;
export const CELL_GAP = 4;

// ========== 动画 ==========
export const ANIM_TOGGLE_DURATION = 200; // ms
