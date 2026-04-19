/**
 * Cookie Clicker 放置类游戏 — 常量定义
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 点击产生的饼干数 */
export const COOKIES_PER_CLICK = 1;

/** 升级价格递增系数 */
export const PRICE_MULTIPLIER = 1.15;

/** 每秒自动生产更新间隔（毫秒） */
export const PRODUCTION_TICK_MS = 1000;

/** 升级定义 */
export interface UpgradeDef {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 英文名称 */
  nameEn: string;
  /** 基础价格 */
  basePrice: number;
  /** 每秒产量 */
  cps: number;
  /** 图标 */
  icon: string;
}

/** 升级列表（按解锁顺序） */
export const UPGRADES: UpgradeDef[] = [
  { id: 'cursor', name: '光标', nameEn: 'Cursor', basePrice: 15, cps: 0.1, icon: '👆' },
  { id: 'grandma', name: '奶奶', nameEn: 'Grandma', basePrice: 100, cps: 1, icon: '👵' },
  { id: 'farm', name: '农场', nameEn: 'Farm', basePrice: 1100, cps: 8, icon: '🌾' },
  { id: 'mine', name: '矿场', nameEn: 'Mine', basePrice: 12000, cps: 47, icon: '⛏️' },
  { id: 'factory', name: '工厂', nameEn: 'Factory', basePrice: 130000, cps: 260, icon: '🏭' },
];

/** 数字格式化后缀 */
export const NUMBER_SUFFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** 颜色主题 */
export const COLORS = {
  bg: '#1a0a2e',
  bgGradient1: '#1a0a2e',
  bgGradient2: '#16213e',
  cookie: '#d4a04a',
  cookieHighlight: '#f0c060',
  cookieShadow: '#a07020',
  textPrimary: '#ffffff',
  textSecondary: '#b0b0c0',
  textDim: '#606080',
  accent: '#ff6b9d',
  accentGreen: '#00e676',
  accentGold: '#ffd700',
  panelBg: 'rgba(30, 20, 60, 0.85)',
  panelBorder: 'rgba(255, 107, 157, 0.3)',
  selectedBg: 'rgba(255, 107, 157, 0.15)',
  selectedBorder: 'rgba(255, 107, 157, 0.6)',
  affordable: '#00e676',
  unaffordable: '#ff4757',
} as const;

/** Cookie 绘制参数 */
export const COOKIE_DRAW = {
  centerX: 240,
  centerY: 200,
  radius: 90,
  chipCount: 8,
  chipRadius: 8,
} as const;

/** 升级列表面板参数 */
export const UPGRADE_PANEL = {
  startY: 340,
  itemHeight: 52,
  itemPadding: 6,
  itemMarginX: 16,
  itemWidth: CANVAS_WIDTH - 32,
  visibleCount: 5,
} as const;
