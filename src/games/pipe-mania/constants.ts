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
export const PREVIEW_COUNT = 5; // 预览管道数量（兼容旧常量）
export const MIN_PIPE_LENGTH = 5; // 最短管道长度过关要求

// 分数
export const SCORE_PER_PIPE = 5; // 每次旋转放置得分（兼容）
export const SCORE_PER_WATER = 20; // 水流经过每个管道得分
export const SCORE_END_BONUS = 200; // 到达终点奖励
export const PLACE_DURATION = 30000; // 放置阶段时长（兼容）
export const WATER_STEP_INTERVAL = 300; // 水流步进间隔

// 管道类型
export enum PipeType {
  STRAIGHT_H = 'straight_h',   // 水平直管: LEFT ↔ RIGHT
  STRAIGHT_V = 'straight_v',   // 垂直直管: TOP ↔ BOTTOM
  BEND_TR = 'bend_tr',         // 弯管: TOP ↔ RIGHT
  BEND_BR = 'bend_br',         // 弯管: BOTTOM ↔ RIGHT
  BEND_BL = 'bend_bl',         // 弯管: BOTTOM ↔ LEFT
  BEND_TL = 'bend_tl',         // 弯管: TOP ↔ LEFT
  CROSS = 'cross',             // 十字管: TOP↔BOTTOM + LEFT↔RIGHT
  T_TOP = 't_top',             // T型管: TOP + LEFT + RIGHT (无BOTTOM)
  T_BOTTOM = 't_bottom',       // T型管: BOTTOM + LEFT + RIGHT (无TOP)
  T_LEFT = 't_left',           // T型管: LEFT + TOP + BOTTOM (无RIGHT)
  T_RIGHT = 't_right',         // T型管: RIGHT + TOP + BOTTOM (无LEFT)
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

// 别名，兼容测试
export const OPPOSITE_DIRECTION = OPPOSITE;

// 方向偏移量
export const DIRECTION_OFFSET: Record<Direction, { dr: number; dc: number }> = {
  [Direction.TOP]: { dr: -1, dc: 0 },
  [Direction.BOTTOM]: { dr: 1, dc: 0 },
  [Direction.LEFT]: { dr: 0, dc: -1 },
  [Direction.RIGHT]: { dr: 0, dc: 1 },
};

// 每种管道的连接方向对（成对出现，表示水可以从一端进另一端出）
export const PIPE_CONNECTIONS: Record<PipeType, Direction[][]> = {
  [PipeType.STRAIGHT_H]: [[Direction.LEFT, Direction.RIGHT]],
  [PipeType.STRAIGHT_V]: [[Direction.TOP, Direction.BOTTOM]],
  [PipeType.BEND_TR]: [[Direction.TOP, Direction.RIGHT]],
  [PipeType.BEND_BR]: [[Direction.BOTTOM, Direction.RIGHT]],
  [PipeType.BEND_BL]: [[Direction.BOTTOM, Direction.LEFT]],
  [PipeType.BEND_TL]: [[Direction.TOP, Direction.LEFT]],
  [PipeType.CROSS]: [[Direction.TOP, Direction.BOTTOM], [Direction.LEFT, Direction.RIGHT]],
  // T型管：三通，任意两个方向之间都可以连通
  [PipeType.T_TOP]: [
    [Direction.TOP, Direction.LEFT],
    [Direction.TOP, Direction.RIGHT],
    [Direction.LEFT, Direction.RIGHT],
  ],
  [PipeType.T_BOTTOM]: [
    [Direction.BOTTOM, Direction.LEFT],
    [Direction.BOTTOM, Direction.RIGHT],
    [Direction.LEFT, Direction.RIGHT],
  ],
  [PipeType.T_LEFT]: [
    [Direction.TOP, Direction.LEFT],
    [Direction.BOTTOM, Direction.LEFT],
    [Direction.TOP, Direction.BOTTOM],
  ],
  [PipeType.T_RIGHT]: [
    [Direction.TOP, Direction.RIGHT],
    [Direction.BOTTOM, Direction.RIGHT],
    [Direction.TOP, Direction.BOTTOM],
  ],
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
  [PipeType.T_TOP, 1],
  [PipeType.T_BOTTOM, 1],
  [PipeType.T_LEFT, 1],
  [PipeType.T_RIGHT, 1],
];

// 关卡目标（水流经过的管道数）
export const LEVEL_TARGETS: number[] = [
  5, 7, 9, 11, 13, 15, 17, 19, 21, 23,
  25, 27, 29, 31, 33, 35, 37, 39, 41, 43,
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
