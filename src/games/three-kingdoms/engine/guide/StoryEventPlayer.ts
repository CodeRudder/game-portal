/**
 * 引擎层 — 剧情事件播放器
 *
 * 管理8段剧情事件的播放、交互和跳过：
 *   #5  8段剧情事件 — E1桃园结义/E2黄巾之乱/.../E8三国归一
 *   #6  剧情交互规则 — 点击推进+打字机30ms/字+跳过按钮+5秒自动播放
 *   #7  剧情触发时机 — 条件触发（委托给 StoryTriggerEvaluator）
 *   #12 剧情跳过规则 — 二次确认+水墨晕染过渡+不影响奖励
 *
 * 辅助逻辑已拆分至 StoryEventPlayer.helpers.ts
 *
 * @module engine/guide/StoryEventPlayer
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  StoryEventId,
  StoryEventDefinition,
  StoryDialogueLine,
  TutorialReward,
} from '../../core/guide';
import { STORY_EVENT_MAP } from '../../core/guide';
import type { TutorialStateMachine } from './TutorialStateMachine';
import { StoryTriggerEvaluator } from './StoryTriggerEvaluator';
import type { StoryEventPlayerInternalState, StoryGameState } from './StoryEventPlayer.types';
import {
  createInitialPlayerState,
  findStoryDefinition,
  getFullLineLength,
  getAllStoryEventDefinitions,
  getStoryEventDefinitionById,
  updateTypewriterEffect,
  updateAutoPlayTimer,
} from './StoryEventPlayer.helpers';

// Re-export types from types file for backward compatibility
export type {
  StoryPlayState,
  TypewriterState,
  StoryPlayProgress,
  StoryGameState,
  SkipConfirmResult,
} from './StoryEventPlayer.types';

// ─────────────────────────────────────────────
// StoryEventPlayer 类
// ─────────────────────────────────────────────

/**
 * 剧情事件播放器
 *
 * 管理8段剧情事件的播放、打字机效果、自动播放和跳过。
 */
export class StoryEventPlayer implements ISubsystem {
  readonly name = 'story-event-player';

  private deps!: ISystemDeps;
  private _stateMachine!: TutorialStateMachine;
  private state: StoryEventPlayerInternalState = createInitialPlayerState();
  private readonly triggerEvaluator = new StoryTriggerEvaluator();

  // ─── 依赖注入 ───────────────────────────

  /** 注入状态机（由引擎引导模块在 init 之后调用） */
  setStateMachine(sm: TutorialStateMachine): void {
    this._stateMachine = sm;
  }

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    if (this.state.playState !== 'playing') return;

    // 更新打字机效果 (#6)
    updateTypewriterEffect(this.state, dt);

    // 更新自动播放计时器 (#6)
    updateAutoPlayTimer(this.state, dt, () => this.tap());
  }

  getState(): StoryEventPlayerInternalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = createInitialPlayerState();
  }

  // ─── 播放 API (#5) ───────────────────────

  /**
   * 开始播放剧情事件
   */
  startEvent(eventId: StoryEventId): { success: boolean; reason?: string } {
    const definition = STORY_EVENT_MAP[eventId];
    if (!definition) {
      return { success: false, reason: `剧情事件 ${eventId} 不存在` };
    }

    if (this.state.playState === 'playing') {
      return { success: false, reason: '已有剧情正在播放' };
    }

    this.state.playState = 'playing';
    this.state.currentEventId = eventId;
    this.state.typewriter = {
      lineIndex: 0,
      charIndex: 0,
      lineComplete: false,
      allComplete: false,
    };
    this.state.accelerated = false;
    this.state.autoPlayTimer = 0;
    this.state.skipConfirmPending = false;

    this.deps.eventBus.emit('tutorial:storyTriggered', { eventId });

    return { success: true };
  }

  /**
   * 点击推进 — 跳过打字机效果或推进到下一行 (#6)
   */
  tap(): { action: 'reveal_line' | 'next_line' | 'complete'; line?: StoryDialogueLine } {
    if (this.state.playState !== 'playing') {
      return { action: 'complete' };
    }

    const definition = findStoryDefinition(this.state.currentEventId);
    if (!definition) return { action: 'complete' };

    const tw = this.state.typewriter;

    // 如果当前行未完成，立即显示完整行
    if (!tw.lineComplete) {
      tw.charIndex = getFullLineLength(definition, tw.lineIndex);
      tw.lineComplete = true;
      this.state.autoPlayTimer = 0;
      return {
        action: 'reveal_line',
        line: definition.dialogues[tw.lineIndex],
      };
    }

    // 当前行已完成，推进到下一行
    const nextLineIndex = tw.lineIndex + 1;
    if (nextLineIndex >= definition.dialogues.length) {
      // 全部对话完成
      tw.allComplete = true;
      return { action: 'complete' };
    }

    tw.lineIndex = nextLineIndex;
    tw.charIndex = 0;
    tw.lineComplete = false;
    this.state.autoPlayTimer = 0;

    return {
      action: 'next_line',
      line: definition.dialogues[nextLineIndex],
    };
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (this.state.playState === 'playing') {
      this.state.playState = 'paused';
    }
  }

  /**
   * 恢复播放
   */
  resume(): void {
    if (this.state.playState === 'paused') {
      this.state.playState = 'playing';
    }
  }

  // ─── 跳过机制 (#12) ───────────────────────

  /**
   * 请求跳过（需二次确认）
   */
  requestSkip(): { requireConfirm: boolean } {
    if (this.state.playState !== 'playing') {
      return { requireConfirm: false };
    }

    this.state.skipConfirmPending = true;
    return { requireConfirm: true };
  }

  /**
   * 确认跳过
   */
  confirmSkip(): { success: boolean; transitionEffect: string; rewards: TutorialReward[] } {
    if (!this.state.skipConfirmPending) {
      return { success: false, transitionEffect: 'none', rewards: [] };
    }

    const definition = findStoryDefinition(this.state.currentEventId);
    const rewards = definition ? [...definition.rewards] : [];

    // 水墨晕染过渡效果
    this.state.playState = 'skipping';
    this.state.skipConfirmPending = false;

    // 完成事件
    this.completeEvent(true);

    return {
      success: true,
      transitionEffect: 'ink_wash',
      rewards,
    };
  }

  /**
   * 取消跳过
   */
  cancelSkip(): void {
    this.state.skipConfirmPending = false;
  }

  // ─── 加速 (#6) ───────────────────────────

  /**
   * 开启加速（打字机加速）
   */
  setAccelerated(enabled: boolean): void {
    this.state.accelerated = enabled;
  }

  // ─── 触发检测 (#7) — 委托给 StoryTriggerEvaluator ──

  /**
   * 检查是否有剧情事件应该触发
   */
  checkTriggerConditions(gameState: StoryGameState): StoryEventDefinition | null {
    return this.triggerEvaluator.checkTriggerConditions(this._stateMachine, gameState);
  }

  /**
   * 检查指定步骤完成后是否触发剧情
   */
  checkStepTrigger(stepId: string): StoryEventDefinition | null {
    return this.triggerEvaluator.checkStepTrigger(this._stateMachine, stepId);
  }

  // ─── 查询 API ───────────────────────────

  /**
   * 获取当前播放进度
   */
  getPlayProgress(): import('./StoryEventPlayer.types').StoryPlayProgress {
    return {
      state: this.state.playState,
      eventId: this.state.currentEventId,
      typewriter: { ...this.state.typewriter },
      accelerated: this.state.accelerated,
      autoPlayTimer: this.state.autoPlayTimer,
    };
  }

  /**
   * 获取当前对话行
   */
  getCurrentLine(): StoryDialogueLine | null {
    const definition = findStoryDefinition(this.state.currentEventId);
    if (!definition) return null;

    const tw = this.state.typewriter;
    if (tw.lineIndex >= definition.dialogues.length) return null;

    return definition.dialogues[tw.lineIndex];
  }

  /**
   * 获取当前显示文本（考虑打字机效果）
   */
  getCurrentDisplayText(): string {
    const line = this.getCurrentLine();
    if (!line) return '';

    const tw = this.state.typewriter;
    return line.text.slice(0, tw.charIndex);
  }

  /**
   * 获取所有剧情事件定义
   */
  getAllStoryEvents(): StoryEventDefinition[] {
    return getAllStoryEventDefinitions();
  }

  /**
   * 获取剧情事件定义
   */
  getStoryEventDefinition(eventId: StoryEventId): StoryEventDefinition | null {
    return getStoryEventDefinitionById(eventId);
  }

  // ─── 内部方法 ───────────────────────────

  /** 完成事件 */
  private completeEvent(skipped: boolean): void {
    const eventId = this.state.currentEventId;
    if (!eventId) return;

    this._stateMachine.completeStoryEvent(eventId, skipped);

    // 发放奖励（跳过不影响奖励 #12）
    const definition = STORY_EVENT_MAP[eventId];
    if (definition && definition.rewards.length > 0) {
      this.deps.eventBus.emit('tutorial:rewardGranted', {
        rewards: definition.rewards,
        source: `story_${eventId}`,
      });
    }

    this.state.playState = 'completed';
    this.state.currentEventId = null;
  }
}
