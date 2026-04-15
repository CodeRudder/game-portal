/**
 * renderer/config/AssetPaths.ts — 资源路径配置
 *
 * 集中管理所有资源路径常量，按场景分类。
 * 提供路径解析函数，支持相对路径和 CDN 路径。
 * 使用程序化生成占位资源，不依赖外部文件。
 *
 * @module renderer/config/AssetPaths
 */

// ═══════════════════════════════════════════════════════════════
// 路径前缀配置
// ═══════════════════════════════════════════════════════════════

/** 本地资源根路径 */
const LOCAL_ASSET_BASE = '/assets';

/** CDN 资源根路径（可替换为实际 CDN 地址） */
const CDN_ASSET_BASE = '';

/** 当前使用的资源基础路径 */
let assetBase = LOCAL_ASSET_BASE;

/**
 * 设置资源基础路径
 *
 * 可用于切换本地资源与 CDN 资源。
 *
 * @param base - 资源根路径
 */
export function setAssetBase(base: string): void {
  assetBase = base || LOCAL_ASSET_BASE;
}

/**
 * 获取当前资源基础路径
 */
export function getAssetBase(): string {
  return assetBase;
}

/**
 * 解析资源路径
 *
 * 将相对路径解析为完整路径。
 * 如果路径已经是绝对路径（http/https/data:），直接返回。
 *
 * @param relativePath - 相对路径（如 '/map/terrain.png'）
 * @returns 完整资源路径
 */
export function resolveAssetPath(relativePath: string): string {
  // 绝对 URL 或 data URI 直接返回
  if (
    relativePath.startsWith('http://') ||
    relativePath.startsWith('https://') ||
    relativePath.startsWith('data:')
  ) {
    return relativePath;
  }

  // 确保路径以 / 开头
  const normalized = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`;

  return `${assetBase}${normalized}`;
}

/**
 * 批量解析资源路径
 *
 * @param paths - 相对路径数组
 * @returns 完整路径数组
 */
export function resolveAssetPaths(paths: string[]): string[] {
  return paths.map(resolveAssetPath);
}

// ═══════════════════════════════════════════════════════════════
// 地图场景资源
// ═══════════════════════════════════════════════════════════════

/** 地形瓦片类型 */
export type TerrainType =
  | 'grass' | 'forest' | 'mountain' | 'water' | 'desert' | 'snow' | 'swamp' | 'lava';

/** 地形瓦片颜色配置（程序化渲染用） */
export const TERRAIN_COLORS: Record<TerrainType, number> = {
  grass: 0x4a8c3f,
  forest: 0x2d6a2e,
  mountain: 0x8b8682,
  water: 0x3a7bd5,
  desert: 0xd4a853,
  snow: 0xe8e8f0,
  swamp: 0x5a7a50,
  lava: 0xc44020,
};

/** 地形瓦片尺寸 */
export const TILE_SIZE = 64;

/** 地图场景资源路径 */
export const MAP_ASSET_PATHS = {
  /** 地形瓦片 spritesheet */
  terrainSpritesheet: '/map/terrain-spritesheet.json',
  /** 建筑 spritesheet */
  buildingSpritesheet: '/map/building-spritesheet.json',
} as const;

/** 建筑图标定义（程序化渲染用） */
export const BUILDING_ICONS: Record<string, BuildingIconDef> = {
  capital: { color: 0xffd700, label: '🏛', size: 48 },
  city: { color: 0x87ceeb, label: '🏙', size: 40 },
  fortress: { color: 0x808080, label: '🏰', size: 44 },
  village: { color: 0x90ee90, label: '🏘', size: 36 },
  wilderness: { color: 0x8b4513, label: '🌲', size: 32 },
  farm: { color: 0x9acd32, label: '🌾', size: 32 },
  mine: { color: 0xa0522d, label: '⛏', size: 32 },
  barracks: { color: 0xb22222, label: '⚔', size: 36 },
  market: { color: 0xdaa520, label: '🏪', size: 36 },
  temple: { color: 0xee82ee, label: '⛪', size: 36 },
  academy: { color: 0x4169e1, label: '📚', size: 36 },
  wall: { color: 0x696969, label: '🧱', size: 28 },
} as const;

/** 建筑图标定义接口 */
export interface BuildingIconDef {
  /** 主色调 */
  color: number;
  /** 显示标签（emoji 或文字） */
  label: string;
  /** 图标尺寸（像素） */
  size: number;
}

// ═══════════════════════════════════════════════════════════════
// 战斗场景资源
// ═══════════════════════════════════════════════════════════════

/** 战斗特效类型 */
export type CombatEffectType =
  | 'slash' | 'fire' | 'ice' | 'lightning' | 'heal' | 'buff' | 'debuff';

/** 战斗特效参数定义 */
export interface CombatEffectDef {
  /** 特效颜色 */
  color: number;
  /** 粒子数量 */
  particleCount: number;
  /** 持续时间（ms） */
  duration: number;
  /** 扩散半径 */
  radius: number;
  /** 粒子大小 */
  particleSize: number;
}

/** 战斗特效参数配置 */
export const COMBAT_EFFECTS: Record<CombatEffectType, CombatEffectDef> = {
  slash: { color: 0xffffff, particleCount: 12, duration: 300, radius: 40, particleSize: 3 },
  fire: { color: 0xff4500, particleCount: 20, duration: 500, radius: 50, particleSize: 4 },
  ice: { color: 0x00bfff, particleCount: 16, duration: 400, radius: 45, particleSize: 3 },
  lightning: { color: 0xffff00, particleCount: 8, duration: 200, radius: 60, particleSize: 2 },
  heal: { color: 0x00ff7f, particleCount: 15, duration: 600, radius: 35, particleSize: 5 },
  buff: { color: 0xffd700, particleCount: 10, duration: 400, radius: 30, particleSize: 3 },
  debuff: { color: 0x8b008b, particleCount: 10, duration: 400, radius: 30, particleSize: 3 },
};

/** 战斗场景资源路径 */
export const COMBAT_ASSET_PATHS = {
  /** 战斗特效 spritesheet */
  effectSpritesheet: '/combat/effect-spritesheet.json',
  /** 战斗 UI spritesheet */
  combatUISpritesheet: '/combat/combat-ui-spritesheet.json',
} as const;

/** 战斗 UI 元素定义 */
export const COMBAT_UI_ELEMENTS: Record<string, CombatUIElementDef> = {
  hpBarBg: { color: 0x333333, width: 100, height: 10, radius: 5 },
  hpBarFill: { color: 0x00cc44, width: 100, height: 10, radius: 5 },
  hpBarLow: { color: 0xcc0000, width: 100, height: 10, radius: 5 },
  mpBarBg: { color: 0x333333, width: 80, height: 8, radius: 4 },
  mpBarFill: { color: 0x3366ff, width: 80, height: 8, radius: 4 },
  turnIndicator: { color: 0xffd700, width: 32, height: 32, radius: 16 },
  victoryBanner: { color: 0xffd700, width: 400, height: 80, radius: 10 },
  defeatBanner: { color: 0xcc0000, width: 400, height: 80, radius: 10 },
} as const;

/** 战斗 UI 元素定义接口 */
export interface CombatUIElementDef {
  color: number;
  width: number;
  height: number;
  radius: number;
}

// ═══════════════════════════════════════════════════════════════
// UI 通用资源
// ═══════════════════════════════════════════════════════════════

/** 按钮状态 */
export type ButtonState = 'normal' | 'hover' | 'pressed' | 'disabled';

/** 按钮样式定义 */
export interface ButtonStyleDef {
  /** 各状态的背景色 */
  colors: Record<ButtonState, number>;
  /** 边框色 */
  borderColor: number;
  /** 边框宽度 */
  borderWidth: number;
  /** 圆角半径 */
  radius: number;
  /** 默认宽度 */
  width: number;
  /** 默认高度 */
  height: number;
}

/** 按钮样式配置 */
export const BUTTON_STYLES: Record<string, ButtonStyleDef> = {
  primary: {
    colors: { normal: 0x4a90d9, hover: 0x5ba0e9, pressed: 0x3a80c9, disabled: 0x888888 },
    borderColor: 0x3a70b9,
    borderWidth: 2,
    radius: 8,
    width: 160,
    height: 44,
  },
  secondary: {
    colors: { normal: 0x6c757d, hover: 0x7c859d, pressed: 0x5c657d, disabled: 0x888888 },
    borderColor: 0x4c556d,
    borderWidth: 2,
    radius: 8,
    width: 120,
    height: 40,
  },
  danger: {
    colors: { normal: 0xdc3545, hover: 0xec4555, pressed: 0xcc2535, disabled: 0x888888 },
    borderColor: 0xbc1535,
    borderWidth: 2,
    radius: 8,
    width: 120,
    height: 40,
  },
  icon: {
    colors: { normal: 0x444444, hover: 0x555555, pressed: 0x333333, disabled: 0x888888 },
    borderColor: 0x666666,
    borderWidth: 1,
    radius: 4,
    width: 40,
    height: 40,
  },
} as const;

/** 面板样式定义 */
export interface PanelStyleDef {
  /** 背景色 */
  backgroundColor: number;
  /** 边框色 */
  borderColor: number;
  /** 边框宽度 */
  borderWidth: number;
  /** 圆角半径 */
  radius: number;
  /** 内边距 */
  padding: number;
  /** 阴影偏移 */
  shadowOffset: number;
  /** 阴影颜色 */
  shadowColor: number;
}

/** 面板样式配置 */
export const PANEL_STYLES: Record<string, PanelStyleDef> = {
  default: {
    backgroundColor: 0x1a1a2e,
    borderColor: 0x3a3a5e,
    borderWidth: 1,
    radius: 12,
    padding: 16,
    shadowOffset: 4,
    shadowColor: 0x000000,
  },
  tooltip: {
    backgroundColor: 0x2a2a3e,
    borderColor: 0x5a5a7e,
    borderWidth: 1,
    radius: 6,
    padding: 8,
    shadowOffset: 2,
    shadowColor: 0x000000,
  },
  dialog: {
    backgroundColor: 0x2a2a3e,
    borderColor: 0x4a4a6e,
    borderWidth: 2,
    radius: 16,
    padding: 24,
    shadowOffset: 8,
    shadowColor: 0x000000,
  },
  resourceBar: {
    backgroundColor: 0x16213e,
    borderColor: 0x0f3460,
    borderWidth: 1,
    radius: 8,
    padding: 8,
    shadowOffset: 0,
    shadowColor: 0x000000,
  },
} as const;

/** UI 资源路径 */
export const UI_ASSET_PATHS = {
  /** UI spritesheet */
  uiSpritesheet: '/ui/ui-spritesheet.json',
} as const;

// ═══════════════════════════════════════════════════════════════
// 文明资源
// ═══════════════════════════════════════════════════════════════

/** 文明图标定义 */
export interface CivIconDef {
  /** 文明 ID */
  id: string;
  /** 主色调 */
  color: number;
  /** 次色调 */
  secondaryColor: number;
  /** 图标标签 */
  label: string;
}

/** 文明图标配置 */
export const CIV_ICONS: CivIconDef[] = [
  { id: 'china', color: 0xff0000, secondaryColor: 0xffd700, label: '龙' },
  { id: 'egypt', color: 0xdaa520, secondaryColor: 0x0000cd, label: '鹰' },
  { id: 'babylon', color: 0x8b4513, secondaryColor: 0xdaa520, label: '塔' },
  { id: 'india', color: 0xff8c00, secondaryColor: 0x006400, label: '象' },
  { id: 'rome', color: 0x8b0000, secondaryColor: 0xffd700, label: '鹰' },
  { id: 'greece', color: 0x0000cd, secondaryColor: 0xffffff, label: '柱' },
  { id: 'persia', color: 0x800080, secondaryColor: 0xffd700, label: '狮' },
  { id: 'mongol', color: 0x006400, secondaryColor: 0xffd700, label: '弓' },
] as const;

// ═══════════════════════════════════════════════════════════════
// 字体配置
// ═══════════════════════════════════════════════════════════════

/** 字体定义 */
export interface FontDef {
  /** 字体族名称 */
  family: string;
  /** 字体来源类型 */
  source: 'system' | 'web' | 'google';
  /** 字体 URL（web 字体） */
  url?: string;
  /** 字重 */
  weight: number;
  /** 是否为回退字体 */
  fallback: boolean;
}

/** 字体配置列表 */
export const FONT_CONFIGS: FontDef[] = [
  {
    family: 'Noto Sans SC',
    source: 'google',
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap',
    weight: 400,
    fallback: false,
  },
  {
    family: 'Arial',
    source: 'system',
    weight: 400,
    fallback: true,
  },
  {
    family: 'sans-serif',
    source: 'system',
    weight: 400,
    fallback: true,
  },
] as const;

/** 默认字体族名称 */
export const DEFAULT_FONT_FAMILY = 'Noto Sans SC';

/** 回退字体族列表 */
export const FALLBACK_FONT_FAMILIES = FONT_CONFIGS
  .filter((f) => f.fallback)
  .map((f) => f.family);

/**
 * 获取完整的字体族 CSS 字符串（含回退）
 *
 * @param primary - 主字体
 * @returns CSS font-family 值
 */
export function getFontStack(primary: string = DEFAULT_FONT_FAMILY): string {
  const fallbacks = FALLBACK_FONT_FAMILIES.join(', ');
  return `"${primary}", ${fallbacks}`;
}

/**
 * 获取需要加载的 Web 字体列表
 */
export function getWebFonts(): FontDef[] {
  return FONT_CONFIGS.filter((f) => f.source !== 'system');
}

// ═══════════════════════════════════════════════════════════════
// Spritesheet 生成配置
// ═══════════════════════════════════════════════════════════════

/** Spritesheet 帧定义 */
export interface SpritesheetFrameDef {
  /** 帧名称 */
  name: string;
  /** 帧在 spritesheet 中的位置 */
  x: number;
  y: number;
  /** 帧尺寸 */
  width: number;
  height: number;
}

/** Spritesheet 生成配置 */
export interface ProceduralSpritesheetConfig {
  /** Spritesheet ID */
  id: string;
  /** Spritesheet 总宽度 */
  sheetWidth: number;
  /** Spritesheet 总高度 */
  sheetHeight: number;
  /** 帧列表 */
  frames: SpritesheetFrameDef[];
  /** 生成函数（使用 Canvas API 绘制每帧） */
  drawFrame: (ctx: CanvasRenderingContext2D, frame: SpritesheetFrameDef) => void;
}

/**
 * 获取地形瓦片 spritesheet 配置
 *
 * @returns 程序化生成地形 spritesheet 的配置
 */
export function getTerrainSpritesheetConfig(): ProceduralSpritesheetConfig {
  const terrainTypes = Object.keys(TERRAIN_COLORS) as TerrainType[];
  const frameSize = TILE_SIZE;
  const cols = 4;
  const rows = Math.ceil(terrainTypes.length / cols);

  const frames: SpritesheetFrameDef[] = terrainTypes.map((type, i) => ({
    name: `terrain_${type}`,
    x: (i % cols) * frameSize,
    y: Math.floor(i / cols) * frameSize,
    width: frameSize,
    height: frameSize,
  }));

  return {
    id: 'terrain',
    sheetWidth: cols * frameSize,
    sheetHeight: rows * frameSize,
    frames,
    drawFrame: (ctx, frame) => {
      const terrainType = frame.name.replace('terrain_', '') as TerrainType;
      const color = TERRAIN_COLORS[terrainType];
      // 转换十六进制颜色为 CSS 颜色
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
      // 添加网格线
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(frame.x + 0.5, frame.y + 0.5, frame.width - 1, frame.height - 1);
    },
  };
}

/**
 * 获取战斗特效 spritesheet 配置
 */
export function getCombatEffectSpritesheetConfig(): ProceduralSpritesheetConfig {
  const effectTypes = Object.keys(COMBAT_EFFECTS) as CombatEffectType[];
  const frameSize = 64;
  const cols = 4;
  const rows = Math.ceil(effectTypes.length / cols);

  const frames: SpritesheetFrameDef[] = effectTypes.map((type, i) => ({
    name: `effect_${type}`,
    x: (i % cols) * frameSize,
    y: Math.floor(i / cols) * frameSize,
    width: frameSize,
    height: frameSize,
  }));

  return {
    id: 'combat-effects',
    sheetWidth: cols * frameSize,
    sheetHeight: rows * frameSize,
    frames,
    drawFrame: (ctx, frame) => {
      const effectType = frame.name.replace('effect_', '') as CombatEffectType;
      const def = COMBAT_EFFECTS[effectType];
      const r = (def.color >> 16) & 0xff;
      const g = (def.color >> 8) & 0xff;
      const b = def.color & 0xff;
      const cx = frame.x + frame.width / 2;
      const cy = frame.y + frame.height / 2;

      // 绘制径向渐变圆作为特效占位
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, frame.width / 2);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
    },
  };
}

/**
 * 获取 UI spritesheet 配置
 */
export function getUISpritesheetConfig(): ProceduralSpritesheetConfig {
  const buttonTypes = Object.keys(BUTTON_STYLES);
  const states: ButtonState[] = ['normal', 'hover', 'pressed', 'disabled'];
  const frameW = 160;
  const frameH = 44;
  const cols = 4;
  const rows = buttonTypes.length;

  const frames: SpritesheetFrameDef[] = [];
  buttonTypes.forEach((btnType, row) => {
    states.forEach((state, col) => {
      frames.push({
        name: `btn_${btnType}_${state}`,
        x: col * frameW,
        y: row * frameH,
        width: frameW,
        height: frameH,
      });
    });
  });

  return {
    id: 'ui-buttons',
    sheetWidth: cols * frameW,
    sheetHeight: rows * frameH,
    frames,
    drawFrame: (ctx, frame) => {
      const parts = frame.name.split('_');
      const btnType = parts[1];
      const state = parts[2] as ButtonState;
      const style = BUTTON_STYLES[btnType];
      if (!style) return;

      const color = style.colors[state];
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.roundRect(frame.x, frame.y, frame.width, frame.height, style.radius);
      ctx.fill();

      // 边框
      const br = (style.borderColor >> 16) & 0xff;
      const bg = (style.borderColor >> 8) & 0xff;
      const bb = style.borderColor & 0xff;
      ctx.strokeStyle = `rgb(${br}, ${bg}, ${bb})`;
      ctx.lineWidth = style.borderWidth;
      ctx.beginPath();
      ctx.roundRect(frame.x, frame.y, frame.width, frame.height, style.radius);
      ctx.stroke();
    },
  };
}
