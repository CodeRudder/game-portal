/**
 * 剧情事件播放器 — 类型定义
 *
 * 从 StoryEventPlayer.ts 中提取的类型与内部状态接口。
 *
 * @module engine/guide/StoryEventPlayer.types
 */

import type { StoryEventId } from '../../core/guide';

// ─────────────────────────────────────────────
// 类型定义
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
// 内部状态
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

// ─────────────────────────────────────────────
// 触发条件评估
// ─────────────────────────────────────────────

import type { StoryTriggerCondition } from '../../core/guide';

/** 评估剧情触发条件 */
export function evaluateStoryTrigger(
  condition: StoryTriggerCondition,
  gameState: StoryGameState,
): boolean {
  switch (condition.type) {
    case 'first_enter':
      return false;
    case 'after_step':
      return false;
    case 'first_recruit':
      return gameState.firstRecruit;
    case 'castle_level':
      return gameState.castleLevel >= Number(condition.value);
    case 'battle_count':
      return gameState.battleCount >= Number(condition.value ?? 3);
    case 'first_alliance':
      return gameState.allianceJoined;
    case 'tech_count':
      return gameState.techCount >= Number(condition.value ?? 4);
    case 'all_steps_complete':
      return false;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────
// 打字机与自动播放
// ─────────────────────────────────────────────

import type { StoryEventDefinition, StoryDialogueLine } from '../../core/guide';
import { TYPEWRITER_SPEED_MS, AUTO_PLAY_DELAY_MS, STORY_EVENT_MAP } from '../../core/guide';

/** 获取指定行的完整文本长度 */
export function getFullLineLength(definition: StoryEventDefinition, lineIndex: number): number {
  return definition.dialogues[lineIndex]?.text.length ?? 0;
}

/** 更新打字机效果 — 返回 true 表示行完成 */
export function updateTypewriterEffect(
  typewriter: TypewriterState,
  accelerated: boolean,
  definition: StoryEventDefinition,
  dtMs: number,
): boolean {
  if (typewriter.lineComplete || typewriter.allComplete) return false;

  const fullLength = getFullLineLength(definition, typewriter.lineIndex);
  const speed = accelerated ? TYPEWRITER_SPEED_MS / 3 : TYPEWRITER_SPEED_MS;
  const charsToAdd = Math.floor(dtMs / speed);

  if (charsToAdd > 0) {
    typewriter.charIndex = Math.min(typewriter.charIndex + charsToAdd, fullLength);
    if (typewriter.charIndex >= fullLength) {
      typewriter.lineComplete = true;
      return true;
    }
  }
  return false;
}

/** 更新自动播放计时器 — 返回 true 表示应该自动推进 */
export function shouldAutoAdvance(
  typewriter: TypewriterState,
  autoPlayTimer: { value: number },
  dtMs: number,
): boolean {
  if (!typewriter.lineComplete || typewriter.allComplete) return false;

  autoPlayTimer.value += dtMs;
  return autoPlayTimer.value >= AUTO_PLAY_DELAY_MS;
}

// ─────────────────────────────────────────────
// 事件完成
// ─────────────────────────────────────────────

import type { TutorialReward } from '../../core/guide';

/** 完成事件的上下文 */
export interface CompleteEventContext {
  state: StoryEventPlayerInternalState;
  completeStoryEvent: (eventId: StoryEventId, skipped: boolean) => void;
  emitReward: (rewards: TutorialReward[], source: string) => void;
}

/** 执行完成事件逻辑 */
export function completeEventLogic(ctx: CompleteEventContext, skipped: boolean): void {
  const eventId = ctx.state.currentEventId;
  if (!eventId) return;

  ctx.completeStoryEvent(eventId, skipped);

  const definition = STORY_EVENT_MAP[eventId];
  if (definition && definition.rewards.length > 0) {
    ctx.emitReward(definition.rewards, `story_${eventId}`);
  }

  ctx.state.playState = 'completed';
  ctx.state.currentEventId = null;
}

/** 创建播放器初始状态 */
export function createInitialState(): StoryEventPlayerInternalState {
  return {
    playState: 'idle',
    currentEventId: null,
    typewriter: {
      lineIndex: 0,
      charIndex: 0,
      lineComplete: false,
      allComplete: false,
    },
    accelerated: false,
    autoPlayTimer: 0,
    skipConfirmPending: false,
  };
}
