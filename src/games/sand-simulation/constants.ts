/**
 * 沙盒粒子模拟 — 游戏常量
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 网格单元格大小（像素） */
export const CELL_SIZE = 4;

/** 网格列数 */
export const GRID_COLS = CANVAS_WIDTH / CELL_SIZE; // 120

/** 网格行数 */
export const GRID_ROWS = CANVAS_HEIGHT / CELL_SIZE; // 160

/** 材质类型枚举 */
export enum MaterialType {
  EMPTY = 0,
  SAND = 1,
  WATER = 2,
  STONE = 3,
  FIRE = 4,
  WOOD = 5,
}

/** 材质颜色（RGBA 格式便于 Canvas 渲染） */
export const MATERIAL_COLORS: Record<MaterialType, string> = {
  [MaterialType.EMPTY]: 'transparent',
  [MaterialType.SAND]: '#e2b857',
  [MaterialType.WATER]: '#4a90d9',
  [MaterialType.STONE]: '#808080',
  [MaterialType.FIRE]: '#ff4500',
  [MaterialType.WOOD]: '#8b5a2b',
};

/** 材质显示名称 */
export const MATERIAL_NAMES: Record<MaterialType, string> = {
  [MaterialType.EMPTY]: '空',
  [MaterialType.SAND]: '沙子',
  [MaterialType.WATER]: '水',
  [MaterialType.STONE]: '石头',
  [MaterialType.FIRE]: '火',
  [MaterialType.WOOD]: '木头',
};

/** 火焰生命周期（更新次数） */
export const FIRE_LIFETIME = 40;

/** 火焰蔓延概率 */
export const FIRE_SPREAD_CHANCE = 0.15;

/** 水平流动随机偏移概率 */
export const FLOW_RANDOM_CHANCE = 0.5;

/** 默认画笔大小 */
export const DEFAULT_BRUSH_SIZE = 3;

/** 最大画笔大小 */
export const MAX_BRUSH_SIZE = 10;

/** 最小画笔大小 */
export const MIN_BRUSH_SIZE = 1;

/** 光标移动速度（每帧移动格子数） */
export const CURSOR_SPEED = 1;

/** 材质选择快捷键映射 */
export const MATERIAL_KEYS: Record<string, MaterialType> = {
  '1': MaterialType.SAND,
  '2': MaterialType.WATER,
  '3': MaterialType.STONE,
  '4': MaterialType.FIRE,
  '5': MaterialType.WOOD,
};

/** 沙子颜色变化（模拟真实沙粒） */
export const SAND_COLOR_VARIANTS = ['#e2b857', '#d4a843', '#c9a03e', '#dbb24d', '#e8c060'];

/** 水颜色变化 */
export const WATER_COLOR_VARIANTS = ['#4a90d9', '#3a80c9', '#5aa0e9', '#4488cc', '#6699dd'];

/** 火颜色变化 */
export const FIRE_COLOR_VARIANTS = ['#ff4500', '#ff6600', '#ff3300', '#ff8800', '#ffaa00'];

/** 木头颜色变化 */
export const WOOD_COLOR_VARIANTS = ['#8b5a2b', '#7a4f26', '#9c6530', '#6b4520', '#a07838'];
