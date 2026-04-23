/**
 * 响应式布局 & 触控系统 — 快捷键与导航类型
 *
 * 从 responsive.types.ts 中提取的模块 E（快捷键映射）、
 * 模块 F（导航）及通用事件回调类型。
 *
 * 规则：零 engine/ 依赖，纯类型与常量定义。
 *
 * @module core/responsive/responsive-navigation.types
 */

// ═══════════════════════════════════════════════
// 模块E: 快捷键映射
// ═══════════════════════════════════════════════

/** 快捷键定义 */
export interface HotkeyDef {
  /** 按键（小写） */
  key: string;
  /** 是否需要Ctrl */
  ctrl?: boolean;
  /** 是否需要Shift */
  shift?: boolean;
  /** 是否需要Alt */
  alt?: boolean;
  /** 功能描述 */
  description: string;
  /** 关联的动作标识 */
  action: string;
}

/** 默认快捷键映射表 */
export const DEFAULT_HOTKEYS: HotkeyDef[] = [
  { key: 't', description: '打开地图', action: 'open-map' },
  { key: 'h', description: '打开武将', action: 'open-heroes' },
  { key: 'k', description: '打开科技', action: 'open-tech' },
  { key: 'c', description: '打开关卡', action: 'open-campaign' },
  { key: ' ', description: '暂停/继续', action: 'toggle-pause' },
  { key: 'b', description: '打开建筑', action: 'open-buildings' },
  { key: 's', ctrl: true, description: '保存游戏', action: 'save-game' },
  { key: 'escape', description: '关闭面板', action: 'close-panel' },
  { key: 'm', description: '打开邮件', action: 'open-mail' },
  { key: 'i', description: '打开背包', action: 'open-inventory' },
];

// ═══════════════════════════════════════════════
// 模块F: 导航
// ═══════════════════════════════════════════════

/** 面包屑导航项 */
export interface BreadcrumbItem {
  /** 路径标识 */
  path: string;
  /** 显示标签 */
  label: string;
  /** 是否可点击返回 */
  clickable: boolean;
}

/** 导航路径状态 */
export interface NavigationPathState {
  /** 面包屑路径栈 */
  breadcrumbs: BreadcrumbItem[];
  /** 当前面板深度 */
  depth: number;
  /** 最大面板深度 */
  maxDepth: number;
  /** 是否可返回 */
  canGoBack: boolean;
}

// ═══════════════════════════════════════════════
// 模块D: 手机端专属设置 (SET)
// ═══════════════════════════════════════════════

/** 省电模式等级 */
export enum PowerSaveLevel {
  /** 关闭 */
  Off = 'off',
  /** 自动（电量<20%时开启） */
  Auto = 'auto',
  /** 手动开启 */
  On = 'on',
}

/** 省电模式配置 */
export interface PowerSaveConfig {
  /** 目标帧率 */
  targetFps: number;
  /** 是否关闭粒子特效 */
  disableParticles: boolean;
  /** 是否关闭阴影 */
  disableShadows: boolean;
  /** 自动触发电量阈值（百分比） */
  autoTriggerBatteryLevel: number;
}

/** 省电模式状态 */
export interface PowerSaveState {
  /** 当前等级 */
  level: PowerSaveLevel;
  /** 是否激活 */
  isActive: boolean;
  /** 当前帧率 */
  currentFps: number;
  /** 配置 */
  config: PowerSaveConfig;
}

/** 字体大小档位 */
export enum FontSizeLevel {
  /** 小 12px */
  Small = 'small',
  /** 中 14px（默认） */
  Medium = 'medium',
  /** 大 16px */
  Large = 'large',
}

/** 字体大小映射 */
export const FONT_SIZE_MAP: Record<FontSizeLevel, number> = {
  [FontSizeLevel.Small]: 12,
  [FontSizeLevel.Medium]: 14,
  [FontSizeLevel.Large]: 16,
};

/** 手机端设置状态 */
export interface MobileSettingsState {
  /** 省电模式 */
  powerSave: PowerSaveState;
  /** 左手模式 */
  leftHandMode: boolean;
  /** 屏幕常亮 */
  screenAlwaysOn: boolean;
  /** 字体大小 */
  fontSize: FontSizeLevel;
}
