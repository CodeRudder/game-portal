// ========== Spirograph 万花尺 常量配置 ==========

// ========== 画布尺寸 ==========

/** 画布宽度 */
export const CANVAS_WIDTH = 480;

/** 画布高度 */
export const CANVAS_HEIGHT = 640;

// ========== 数学参数 ==========

/** 外圆默认半径 R */
export const DEFAULT_OUTER_RADIUS = 120;

/** 内圆默认半径 r */
export const DEFAULT_INNER_RADIUS = 45;

/** 笔距默认值 d */
export const DEFAULT_PEN_DISTANCE = 60;

/** 外圆最小半径 */
export const MIN_OUTER_RADIUS = 50;

/** 外圆最大半径 */
export const MAX_OUTER_RADIUS = 200;

/** 内圆最小半径 */
export const MIN_INNER_RADIUS = 5;

/** 内圆最大半径 */
export const MAX_INNER_RADIUS = 195;

/** 笔距最小值 */
export const MIN_PEN_DISTANCE = 1;

/** 笔距最大值 */
export const MAX_PEN_DISTANCE = 200;

/** 内圆半径调整步长 */
export const INNER_RADIUS_STEP = 5;

/** 笔距调整步长 */
export const PEN_DISTANCE_STEP = 5;

/** 外圆半径调整步长 */
export const OUTER_RADIUS_STEP = 5;

// ========== 动画参数 ==========

/** 默认绘制速度（每帧步进角度数） */
export const DEFAULT_DRAW_SPEED = 0.05;

/** 最小绘制速度 */
export const MIN_DRAW_SPEED = 0.005;

/** 最大绘制速度 */
export const MAX_DRAW_SPEED = 0.5;

/** 速度调整步长 */
export const SPEED_STEP = 0.005;

/** 曲线最大角度（用于计算闭合点） */
export const MAX_ANGLE = Math.PI * 200;

// ========== 颜色方案 ==========

/** 颜色方案定义 */
export interface ColorScheme {
  /** 方案名称 */
  name: string;
  /** 颜色列表（HSL 字符串或 hex） */
  colors: string[];
}

/** 内置颜色方案 */
export const COLOR_SCHEMES: ColorScheme[] = [
  {
    name: '彩虹',
    colors: ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff', '#ff00ff'],
  },
  {
    name: '海洋',
    colors: ['#00b4d8', '#0077b6', '#023e8a', '#48cae4', '#90e0ef', '#ade8f4'],
  },
  {
    name: '日落',
    colors: ['#ff6b6b', '#ee5a24', '#f0932b', '#ffbe76', '#f9ca24', '#ff7979'],
  },
  {
    name: '森林',
    colors: ['#00b894', '#55efc4', '#00cec9', '#81ecec', '#a3e635', '#22c55e'],
  },
  {
    name: '极光',
    colors: ['#a855f7', '#7c3aed', '#6366f1', '#818cf8', '#c084fc', '#e879f9'],
  },
  {
    name: '火焰',
    colors: ['#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#ffff00', '#ffffff'],
  },
];

/** 默认颜色方案索引 */
export const DEFAULT_COLOR_SCHEME_INDEX = 0;

// ========== 预设图案 ==========

/** 预设图案定义 */
export interface SpirographPreset {
  /** 图案名称 */
  name: string;
  /** 外圆半径 R */
  outerRadius: number;
  /** 内圆半径 r */
  innerRadius: number;
  /** 笔距 d */
  penDistance: number;
}

/** 内置预设图案 */
export const PRESETS: SpirographPreset[] = [
  {
    name: '经典五瓣花',
    outerRadius: 120,
    innerRadius: 48,
    penDistance: 60,
  },
  {
    name: '星形齿轮',
    outerRadius: 150,
    innerRadius: 50,
    penDistance: 100,
  },
  {
    name: '密集花纹',
    outerRadius: 180,
    innerRadius: 77,
    penDistance: 90,
  },
  {
    name: '对称六角',
    outerRadius: 120,
    innerRadius: 20,
    penDistance: 80,
  },
  {
    name: '复杂编织',
    outerRadius: 200,
    innerRadius: 93,
    penDistance: 120,
  },
];

// ========== 渲染参数 ==========

/** 曲线线条宽度 */
export const LINE_WIDTH = 1.5;

/** 齿轮线条宽度 */
export const GEAR_LINE_WIDTH = 1;

/** 齿轮透明度 */
export const GEAR_OPACITY = 0.3;

/** 曲线采样点数（每弧度） */
export const POINTS_PER_RADIAN = 10;

// ========== 颜色配置 ==========

/** 游戏中使用的所有颜色 */
export const COLORS = {
  /** 背景 */
  background: '#0d0d20',
  /** 外圆颜色 */
  outerGear: '#ffffff',
  /** 内圆颜色 */
  innerGear: '#00ff88',
  /** 笔点颜色 */
  penDot: '#ff4757',
  /** 连接线颜色 */
  connectingLine: 'rgba(255, 255, 255, 0.2)',
  /** 主文本颜色 */
  textPrimary: '#e2e8f0',
  /** 次要文本颜色 */
  textSecondary: '#94a3b8',
  /** 弱化文本颜色 */
  textMuted: '#64748b',
  /** 强调色 */
  accent: '#00ff88',
  /** HUD 背景 */
  hudBg: 'rgba(15, 14, 23, 0.85)',
  /** 中心标记 */
  centerMark: 'rgba(255, 255, 255, 0.15)',
};

// ========== HUD 配置 ==========

/** HUD 高度（像素） */
export const HUD_HEIGHT = 80;

/** 字体族 */
export const FONT_FAMILY = "'Courier New', monospace";

/** HUD 字号 */
export const FONT_SIZE_HUD = 12;

/** HUD 标题字号 */
export const FONT_SIZE_TITLE = 14;

// ========== 数学工具 ==========

/**
 * 计算 GCD（最大公约数）
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * 计算齿轮比（化简后的分数）
 */
export function gearRatio(R: number, r: number): { numerator: number; denominator: number } {
  const g = gcd(Math.round(R), Math.round(r));
  return {
    numerator: Math.round(R) / g,
    denominator: Math.round(r) / g,
  };
}

/**
 * 计算曲线闭合所需的最大角度
 * 闭合条件：当 (R - r) / r * t = 2πk 时曲线闭合
 * 最小闭合角度 = 2π * r / gcd(R, r)
 */
export function closureAngle(R: number, r: number): number {
  if (r === 0) return MAX_ANGLE;
  const g = gcd(Math.round(R), Math.round(r));
  return (2 * Math.PI * Math.round(r)) / g;
}

/**
 * 计算内摆线（Hypotrochoid）上的点
 * x = (R - r) * cos(t) + d * cos((R - r) / r * t)
 * y = (R - r) * sin(t) - d * sin((R - r) / r * t)
 */
export function hypotrochoidPoint(
  R: number,
  r: number,
  d: number,
  t: number
): { x: number; y: number } {
  const diff = R - r;
  const ratio = r !== 0 ? diff / r : 0;
  return {
    x: diff * Math.cos(t) + d * Math.cos(ratio * t),
    y: diff * Math.sin(t) - d * Math.sin(ratio * t),
  };
}

/**
 * 计算外摆线（Epitrochoid）上的点
 * x = (R + r) * cos(t) - d * cos((R + r) / r * t)
 * y = (R + r) * sin(t) - d * sin((R + r) / r * t)
 */
export function epitrochoidPoint(
  R: number,
  r: number,
  d: number,
  t: number
): { x: number; y: number } {
  const sum = R + r;
  const ratio = r !== 0 ? sum / r : 0;
  return {
    x: sum * Math.cos(t) - d * Math.cos(ratio * t),
    y: sum * Math.sin(t) - d * Math.sin(ratio * t),
  };
}

/**
 * 根据进度 [0, 1] 获取渐变颜色
 */
export function getGradientColor(colors: string[], progress: number): string {
  if (colors.length === 0) return '#ffffff';
  if (colors.length === 1) return colors[0];

  // 将 progress 限制在 [0, 1)
  const p = ((progress % 1) + 1) % 1;
  const segment = p * (colors.length - 1);
  const index = Math.floor(segment);
  const frac = segment - index;

  const c1 = parseHexColor(colors[Math.min(index, colors.length - 1)]);
  const c2 = parseHexColor(colors[Math.min(index + 1, colors.length - 1)]);

  const r = Math.round(c1.r + (c2.r - c1.r) * frac);
  const g = Math.round(c1.g + (c2.g - c1.g) * frac);
  const b = Math.round(c1.b + (c2.b - c1.b) * frac);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 解析 hex 颜色为 RGB
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}
