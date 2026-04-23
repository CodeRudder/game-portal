/**
 * First launch - types
 *
 * Extracted from FirstLaunchDetector.ts.
 */

import type { PermissionType } from '../../core/guide/guide.types';
import type {
  GraphicsQuality,
  FirstLaunchConfig,
  NewbieProtectionConfig,
  FirstLaunchDetection,
  BubblePosition,
  TutorialBubbleConfig,
} from '../../core/guide/guide.types';
import type { TutorialStateMachine } from './TutorialStateMachine';
// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export type FirstLaunchStep =
  | 'detect_language'     // 语言检测
  | 'detect_graphics'     // 画质检测
  | 'request_permissions' // 权限申请
  | 'trigger_tutorial'    // 触发引导
  | 'completed'           // 完成
  | 'skipped';            // 跳过（非首次启动）

/** 首次启动流程状态 */
export interface FirstLaunchFlowState {
  /** 当前步骤 */
  currentStep: FirstLaunchStep;
  /** 检测到的语言 */
  detectedLanguage: string;
  /** 推荐画质 */
  recommendedQuality: GraphicsQuality;
  /** 权限状态 */
  permissionStatus: Record<PermissionType, boolean>;
  /** 是否首次启动 */
  isFirstLaunch: boolean;
}

/** 设备硬件信息（用于画质推荐） */
export interface DeviceHardwareInfo {
  /** CPU核心数 */
  cpuCores: number;
  /** 内存大小（GB） */
  memoryGB: number;
  /** GPU信息（可选） */
  gpuRenderer: string;
  /** 设备像素比 */
  devicePixelRatio: number;
}

/** 新手保护状态 */
export interface NewbieProtectionState {
  /** 是否激活 */
  active: boolean;
  /** 保护开始时间戳 */
  startTime: number | null;
  /** 保护时长（毫秒） */
  durationMs: number;
  /** 剩余时间（毫秒） */
  remainingMs: number;
  /** 资源消耗折扣 */
  resourceCostDiscount: number;
  /** 战斗难度系数 */
  battleDifficultyFactor: number;
  /** 是否仅正面事件 */
  positiveEventsOnly: boolean;
}

/** 语言检测回调 */
export type LanguageDetector = () => string;

/** 硬件信息获取回调 */
export type HardwareInfoProvider = () => DeviceHardwareInfo;

/** 权限请求回调 */
export type PermissionRequester = (permissions: PermissionType[]) => Promise<Record<PermissionType, boolean>>;

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认语言 */
export const DEFAULT_LANGUAGE = 'zh-CN';

/** 默认首次启动配置 */
export const DEFAULT_FIRST_LAUNCH_CONFIG: FirstLaunchConfig = {
  defaultLanguage: DEFAULT_LANGUAGE,
  recommendedQuality: 'medium',
  requiredPermissions: ['storage', 'network'],
};

/** 画质推荐阈值 */
export const QUALITY_THRESHOLDS: {
  low: { minCores: number; minMemory: number };
  medium: { minCores: number; minMemory: number };
  high: { minCores: number; minMemory: number };
} = {
  low: { minCores: 2, minMemory: 2 },
  medium: { minCores: 4, minMemory: 4 },
  high: { minCores: 8, minMemory: 8 },
};

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 首次启动检测器内部状态 */
export interface FirstLaunchDetectorInternalState {
  /** 流程状态 */
  flowState: FirstLaunchFlowState;
  /** 新手保护配置 */
  protectionConfig: NewbieProtectionConfig;
  /** 是否已完成首次启动流程 */
  launchCompleted: boolean;
}

// ─────────────────────────────────────────────
// FirstLaunchDetector 类
// ─────────────────────────────────────────────

/**
 * 首次启动检测器
 *
 * 管理首次启动流程和新手保护机制。
 */
