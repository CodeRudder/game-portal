// ========== Pipe Mania 接水管常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const HUD_HEIGHT = 60;

export const GRID_SIZE = 7; // 7x7 网格
export const CELL_SIZE = 56; // 每个管道格子像素
export const PIPE_WIDTH = 14; // 管道宽度
export const GRID_PADDING_X = Math.floor((CANVAS_WIDTH - GRID_SIZE * CELL_SIZE) / 2); // 44
export const GRID_PADDING_Y = HUD_HEIGHT + 10;

export const WATER_FLOW_SPEED = 300; // ms per pipe fill step
export const PREVIEW_COUNT = 5; // 预览管道数量
export const MIN_PIPE_LENGTH = 5; // 最短管道长度过关要求

// 管道类型
export enum PipeType {
  STRAIGHT_H = 'straight_h',   // 水平直管: LEFT ↔ RIGHT
  STRAIGHT_V = 'straight_v',   // 垂直直管: TOP ↔ BOTTOM
  BEND_TR = 'bend_tr',         // 弯管: TOP ↔ RIGHT
  BEND_BR = 'bend_br',         // 弯管: BOTTOM ↔ RIGHT
  BEND_BL = 'bend_bl',         // 弯管: BOTTOM ↔ LEFT
  BEND_TL = 'bend_tl',         // 弯管: TOP ↔ LEFT
  CROSS = 'cross',             // 十字管: TOP↔BOTTOM + LEFT↔RIGHT
}

// 方向
export enum Direction {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
}

export const OPPOSITE: Record<Direction, Direction> = {
  [Direction.TOP]: Direction.BOTTOM,
  [Direction.BOTTOM]: Direction.TOP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
};

// 每种管道的连接方向对
export const PIPE_CONNECTIONS: Record<PipeType, Direction[][]> = {
  [PipeType.STRAIGHT_H]: [[Direction.LEFT, Direction.RIGHT]],
  [PipeType.STRAIGHT_V]: [[Direction.TOP, Direction.BOTTOM]],
  [PipeType.BEND_TR]: [[Direction.TOP, Direction.RIGHT]],
  [PipeType.BEND_BR]: [[Direction.BOTTOM, Direction.RIGHT]],
  [PipeType.BEND_BL]: [[Direction.BOTTOM, Direction.LEFT]],
  [PipeType.BEND_TL]: [[Direction.TOP, Direction.LEFT]],
  [PipeType.CROSS]: [[Direction.TOP, Direction.BOTTOM], [Direction.LEFT, Direction.RIGHT]],
};

// 管道类型权重（生成随机管道时的概率）
export const PIPE_WEIGHTS: [PipeType, number][] = [
  [PipeType.STRAIGHT_H, 3],
  [PipeType.STRAIGHT_V, 3],
  [PipeType.BEND_TR, 2],
  [PipeType.BEND_BR, 2],
  [PipeType.BEND_BL, 2],
  [PipeType.BEND_TL, 2],
  [PipeType.CROSS, 1],
];

// 颜色
export const COLORS = {
  bg: '#0a0a2e',
  grid: '#1a1a4e',
  gridLine: '#2a2a5e',
  pipe: '#6688cc',
  pipeHighlight: '#88aaee',
  water: '#00ccff',
  waterGlow: '#00eeff',
  start: '#00ff88',
  end: '#ff4488',
  preview: '#4466aa',
  text: '#ffffff',
  timer: '#ffaa00',
};
