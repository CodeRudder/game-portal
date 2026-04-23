/**
 * 引擎层 — 剧情事件播放器辅助函数
 *
 * 从 StoryEventPlayer.ts 提取的独立纯函数和无状态逻辑：
 *   - 初始状态创建
 *   - 打字机效果更新
 *   - 自动播放计时器更新
 *   - 定义查找工具
 *
 * @module engine/guide/StoryEventPlayer.helpers
 */

import type {
  StoryEventId,
  StoryEventDefinition,
} from '../../core/guide';
import {
  TYPEWRITER_SPEED_MS,
  AUTO_PLAY_DELAY_MS,
  STORY_EVENT_MAP,
  STORY_EVENT_DEFINITIONS,
} from '../../core/guide';
import type { StoryEventPlayerInternalState } from './StoryEventPlayer.types';

// ─────────────────────────────────────────────
// 状态创建
// ─────────────────────────────────────────────

/**
 * 创建播放器初始状态
 */
export function createInitialPlayerState(): StoryEventPlayerInternalState {
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

// ─────────────────────────────────────────────
// 定义查找
// ─────────────────────────────────────────────

/**
 * 根据事件 ID 获取剧情定义
 */
export function findStoryDefinition(eventId: StoryEventId | null): StoryEventDefinition | null {
  if (!eventId) return null;
  return STORY_EVENT_MAP[eventId] ?? null;
}

/**
 * 获取指定行的完整文本长度
 */
export function getFullLineLength(definition: StoryEventDefinition, lineIndex: number): number {
  return definition.dialogues[lineIndex]?.text.length ?? 0;
}

/**
 * 获取所有剧情事件定义
 */
export function getAllStoryEventDefinitions(): StoryEventDefinition[] {
  return STORY_EVENT_DEFINITIONS;
}

/**
 * 根据 ID 获取剧情事件定义
 */
export function getStoryEventDefinitionById(eventId: StoryEventId): StoryEventDefinition | null {
  return STORY_EVENT_MAP[eventId] ?? null;
}

// ─────────────────────────────────────────────
// 打字机效果更新 (#6)
// ─────────────────────────────────────────────

/**
 * 更新打字机效果 — 纯函数，返回更新后的状态片段
 *
 * @param state 当前内部状态（会被就地修改以保持引用一致性）
 * @param dtMs 帧间隔（毫秒）
 */
export function updateTypewriterEffect(
  state: StoryEventPlayerInternalState,
  dtMs: number,
): void {
  const definition = findStoryDefinition(state.currentEventId);
  if (!definition) return;

  const tw = state.typewriter;
  if (tw.lineComplete || tw.allComplete) return;

  const fullLength = getFullLineLength(definition, tw.lineIndex);
  const speed = state.accelerated ? TYPEWRITER_SPEED_MS / 3 : TYPEWRITER_SPEED_MS;

  // dtMs是毫秒，计算本帧应该推进的字符数
  const charsToAdd = Math.floor(dtMs / speed);
  if (charsToAdd > 0) {
    tw.charIndex = Math.min(tw.charIndex + charsToAdd, fullLength);
    if (tw.charIndex >= fullLength) {
      tw.lineComplete = true;
      state.autoPlayTimer = 0;
    }
  }
}

// ─────────────────────────────────────────────
// 自动播放计时器更新 (#6)
// ─────────────────────────────────────────────

/**
 * 自动播放回调类型 — 当计时器到期时调用
 */
export type AutoPlayCallback = () => void;

/**
 * 更新自动播放计时器
 *
 * @param state 当前内部状态（会被就地修改）
 * @param dtMs 帧间隔（毫秒）
 * @param onAutoPlay 当计时器到期时调用的回调（执行 tap 逻辑）
 */
export function updateAutoPlayTimer(
  state: StoryEventPlayerInternalState,
  dtMs: number,
  onAutoPlay: AutoPlayCallback,
): void {
  const tw = state.typewriter;
  if (!tw.lineComplete || tw.allComplete) return;

  state.autoPlayTimer += dtMs;
  if (state.autoPlayTimer >= AUTO_PLAY_DELAY_MS) {
    onAutoPlay();
  }
}
