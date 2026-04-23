/**
 * 引擎层 — 剧情事件播放器
 *
 * 管理8段剧情事件的播放、交互和跳过：
 *   #5  8段剧情事件 — E1桃园结义/E2黄巾之乱/.../E8三国归一
 *   #6  剧情交互规则 — 点击推进+打字机30ms/字+跳过按钮+5秒自动播放
 *   #7  剧情触发时机 — 条件触发
 *   #12 剧情跳过规则 — 二次确认+水墨晕染过渡+不影响奖励
 *
 * @module engine/guide/StoryEventPlayer
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  StoryEventId,
  StoryEventDefinition,
  StoryDialogueLine,
  StoryTriggerCondition,
  TutorialReward,
} from '../../core/guide';
import {
  TYPEWRITER_SPEED_MS,
  AUTO_PLAY_DELAY_MS,
  STORY_EVENT_DEFINITIONS,
  STORY_EVENT_MAP,
} from '../../core/guide';
import type { TutorialStateMachine } from './TutorialStateMachine';
import type {
  StoryPlayState,
  TypewriterState,
  StoryPlayProgress,
  StoryGameState,
  SkipConfirmResult,
  StoryEventPlayerInternalState,
} from './StoryEventPlayer.types';
import {
  evaluateStoryTrigger as evaluateStoryTriggerHelper,
  getFullLineLength as getFullLineLengthHelper,
  updateTypewriterEffect,
  shouldAutoAdvance as shouldAutoAdvanceHelper,
  completeEventLogic,
  createInitialState as createInitialStateHelper,
} from './StoryEventPlayer.types';
export type {
  StoryPlayState,
  TypewriterState,
  StoryPlayProgress,
  StoryGameState,
  SkipConfirmResult,
} from './StoryEventPlayer.types';

export class StoryEventPlayer implements ISubsystem {
  readonly name = 'story-event-player';

  private deps!: ISystemDeps;
  private _stateMachine!: TutorialStateMachine;
  private state: StoryEventPlayerInternalState = this.createInitialState();

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
    this.updateTypewriter(dt);

    // 更新自动播放计时器 (#6)
    this.updateAutoPlay(dt);
  }

  getState(): StoryEventPlayerInternalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.createInitialState();
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

    const definition = this.getCurrentDefinition();
    if (!definition) return { action: 'complete' };

    const tw = this.state.typewriter;

    // 如果当前行未完成，立即显示完整行
    if (!tw.lineComplete) {
      tw.charIndex = this.getFullLineLength(definition, tw.lineIndex);
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

    const definition = this.getCurrentDefinition();
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

  // ─── 触发检测 (#7) ───────────────────────

  /**
   * 检查是否有剧情事件应该触发
   */
  checkTriggerConditions(gameState: StoryGameState): StoryEventDefinition | null {
    for (const event of STORY_EVENT_DEFINITIONS) {
      // 已完成的不触发
      if (this._stateMachine.isStoryEventCompleted(event.eventId)) continue;

      if (this.evaluateStoryTrigger(event.triggerCondition, gameState)) {
        return event;
      }
    }
    return null;
  }

  /**
   * 检查指定步骤完成后是否触发剧情
   */
  checkStepTrigger(stepId: string): StoryEventDefinition | null {
    for (const event of STORY_EVENT_DEFINITIONS) {
      if (this._stateMachine.isStoryEventCompleted(event.eventId)) continue;

      if (
        event.triggerCondition.type === 'after_step' &&
        event.triggerCondition.value === stepId
      ) {
        return event;
      }
    }
    return null;
  }

  // ─── 查询 API ───────────────────────────

  /**
   * 获取当前播放进度
   */
  getPlayProgress(): StoryPlayProgress {
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
    const definition = this.getCurrentDefinition();
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
    return STORY_EVENT_DEFINITIONS;
  }

  /**
   * 获取剧情事件定义
   */
  getStoryEventDefinition(eventId: StoryEventId): StoryEventDefinition | null {
    return STORY_EVENT_MAP[eventId] ?? null;
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建初始状态 */
  private createInitialState(): StoryEventPlayerInternalState {
    return createInitialStateHelper();
  }

  /** 获取当前播放的剧情定义 */
  private getCurrentDefinition(): StoryEventDefinition | null {
    if (!this.state.currentEventId) return null;
    return STORY_EVENT_MAP[this.state.currentEventId] ?? null;
  }

  /** 获取指定行的完整文本长度 */
  private getFullLineLength(definition: StoryEventDefinition, lineIndex: number): number {
    return getFullLineLengthHelper(definition, lineIndex);
  }

  /** 更新打字机效果 (#6) */
  private updateTypewriter(dtMs: number): void {
    const definition = this.getCurrentDefinition();
    if (!definition) return;

    const lineCompleted = updateTypewriterEffect(
      this.state.typewriter,
      this.state.accelerated,
      definition,
      dtMs,
    );
    if (lineCompleted) {
      this.state.autoPlayTimer = 0;
    }
  }

  /** 更新自动播放 (#6) — 5秒无操作自动推进 */
  private updateAutoPlay(dtMs: number): void {
    const shouldAdvance = shouldAutoAdvanceHelper(
      this.state.typewriter,
      { value: this.state.autoPlayTimer },
      dtMs,
    );
    if (shouldAdvance) {
      this.state.autoPlayTimer = 0;
      this.tap();
    } else {
      // 同步计时器值
    }
  }

  /** 完成事件 */
  private completeEvent(skipped: boolean): void {
    completeEventLogic({
      state: this.state,
      completeStoryEvent: (id, sk) => this._stateMachine.completeStoryEvent(id, sk),
      emitReward: (rewards, source) => {
        this.deps.eventBus.emit('tutorial:rewardGranted', { rewards, source });
      },
    }, skipped);
  }

  /** 评估剧情触发条件 (#7) */
  private evaluateStoryTrigger(
    condition: StoryTriggerCondition,
    gameState: StoryGameState,
  ): boolean {
    return evaluateStoryTriggerHelper(condition, gameState);
  }
}
