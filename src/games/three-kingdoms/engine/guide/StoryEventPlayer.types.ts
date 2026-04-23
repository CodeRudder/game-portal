/**
 * 引擎层 — 剧情事件播放器类型定义
 *
 * 包含剧情播放器相关的所有公开和内部类型。
 *
 * @module engine/guide/StoryEventPlayer.types
 */

import type { StoryEventId } from '../../core/guide';

// ─────────────────────────────────────────────
// 公开类型
// ─────────────────────────────────────────────

/** 剧情播放状态 */
export type StoryPlayState = 'idle' | 'playing' | 'paused' | 'skipping' | 'completed';

/** 打字机状态 */
export interface TypewriterState {
  /** 当前对话行索引 */
  lineIndex: number;
  /** 当前显示的字符数 */
  charIndex: number;
  /** 是否已完成当前行 */
  lineComplete: boolean;
  /** 是否已显示全部对话 */
  allComplete: boolean;
}

/** 剧情播放进度 */
export interface StoryPlayProgress {
  /** 播放状态 */
  state: StoryPlayState;
  /** 剧情事件ID */
  eventId: StoryEventId | null;
  /** 打字机状态 */
  typewriter: TypewriterState;
  /** 是否正在加速 */
  accelerated: boolean;
  /** 已等待自动播放的时间（毫秒） */
  autoPlayTimer: number;
}

/** 剧情触发检测用的游戏状态 */
export interface StoryGameState {
  /** 主城等级 */
  castleLevel: number;
  /** 战斗次数 */
  battleCount: number;
  /** 科技研究数 */
  techCount: number;
  /** 是否已加入联盟 */
  allianceJoined: boolean;
  /** 是否首次招募 */
  firstRecruit: boolean;
}

/** 跳过确认结果 */
export interface SkipConfirmResult {
  /** 是否确认跳过 */
  confirmed: boolean;
  /** 过渡效果 */
  transitionEffect: 'ink_wash' | 'none';
}

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────

/** 播放器内部状态 */
export interface StoryEventPlayerInternalState {
  /** 播放状态 */
  playState: StoryPlayState;
  /** 当前事件ID */
  currentEventId: StoryEventId | null;
  /** 打字机状态 */
  typewriter: TypewriterState;
  /** 是否加速 */
  accelerated: boolean;
  /** 自动播放计时器 */
  autoPlayTimer: number;
  /** 跳过确认待处理 */
  skipConfirmPending: boolean;
}
