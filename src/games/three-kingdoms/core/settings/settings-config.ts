/**
 * 设置系统 — 配置常量
 *
 * v19.0 设置系统使用的配置常量，包括：
 * - 动画时长配置
 * - 音频场景参数
 * - 画质检测阈值
 * - 云同步参数
 *
 * @module core/settings/settings-config
 */

import { EasingType } from './settings.types';
import type { AnimationConfig } from './settings.types';

// ─────────────────────────────────────────────
// 动画时长配置 (ms)
// ─────────────────────────────────────────────

/** 过渡动画时长 */
export const TRANSITION_DURATIONS = {
  /** 面板打开 */
  panelOpen: 300,
  /** 面板关闭 */
  panelClose: 200,
  /** Tab 切换 */
  tabSwitch: 200,
  /** 页面切换 */
  pageTransition: 500,
  /** 弹窗出现 */
  popupAppear: 250,
  /** 场景切换 */
  sceneSwitch: 800,
} as const;

/** 状态动画时长 */
export const STATE_ANIMATION_DURATIONS = {
  /** 悬停 */
  hover: 150,
  /** 按下 */
  press: 80,
  /** 释放 */
  release: 120,
  /** 开关切换 */
  toggleSwitch: 200,
  /** 选中 */
  select: 200,
} as const;

/** 反馈动画时长 */
export const FEEDBACK_ANIMATION_DURATIONS = {
  /** 资源飘字 */
  resourceFloat: 800,
  /** 升级光效 */
  levelUpGlow: 1000,
  /** Toast 滑入 */
  toastSlideIn: 300,
  /** 结算动画 */
  battleResult: 300,
} as const;

// ─────────────────────────────────────────────
// 水墨过渡配置
// ─────────────────────────────────────────────

/** 水墨过渡时长 (ms) */
export const INK_WASH_TRANSITION_DURATION = 600;

// ─────────────────────────────────────────────
// 音频场景配置
// ─────────────────────────────────────────────

/** 首次启动 BGM 延迟 (ms) */
export const FIRST_LAUNCH_BGM_DELAY = 3000;

/** 后台 BGM 渐弱时长 (ms) */
export const BACKGROUND_FADE_DURATION = 1000;

/** 来电恢复渐入时长 (ms) */
export const CALL_RECOVER_FADE_DURATION = 500;

/** 低电量阈值 (%) */
export const LOW_BATTERY_THRESHOLD = 20;

/** 低电量 BGM 降低比例 */
export const LOW_BATTERY_BGM_REDUCTION = 0.5;

// ─────────────────────────────────────────────
// 画质检测阈值
// ─────────────────────────────────────────────

/** 高画质最低 CPU 核心数 */
export const HIGH_QUALITY_MIN_CPU = 8;

/** 高画质最低内存 (GB) */
export const HIGH_QUALITY_MIN_MEMORY = 8;

/** 中画质最低 CPU 核心数 */
export const MEDIUM_QUALITY_MIN_CPU = 4;

/** 中画质最低内存 (GB) */
export const MEDIUM_QUALITY_MIN_MEMORY = 4;

/** 画质帧率选项 */
export const FRAME_RATE_OPTIONS = [30, 60] as const;

// ─────────────────────────────────────────────
// 云同步配置
// ─────────────────────────────────────────────

/** 云同步加密算法名称 */
export const CLOUD_ENCRYPTION_ALGO = 'AES-GCM';

/** 云同步数据版本 */
export const CLOUD_DATA_VERSION = '1.0.0';

/** 云同步重试次数 */
export const CLOUD_SYNC_MAX_RETRIES = 3;

/** 云同步重试间隔 (ms) */
export const CLOUD_SYNC_RETRY_INTERVAL = 5000;

/** 云同步超时 (ms) */
export const CLOUD_SYNC_TIMEOUT = 30000;

// ─────────────────────────────────────────────
// 语言配置
// ─────────────────────────────────────────────

/** 支持的语言列表 */
export const SUPPORTED_LANGUAGES = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
] as const;

/** 语言切换是否需要重启 */
export const LANGUAGE_CHANGE_REQUIRES_RESTART = true;

// ─────────────────────────────────────────────
// 时区配置
// ─────────────────────────────────────────────

/** 最小 UTC 偏移 */
export const MIN_UTC_OFFSET = -12;

/** 最大 UTC 偏移 */
export const MAX_UTC_OFFSET = 14;

/** 默认 UTC 偏移 (北京时间) */
export const DEFAULT_UTC_OFFSET = 8;
