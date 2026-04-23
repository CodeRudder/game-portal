/**
 * 引擎层 — 剧情触发条件评估器
 *
 * 负责评估剧情事件的触发条件，包括：
 *   #7  剧情触发时机 — 条件触发检测
 *
 * 从 StoryEventPlayer 中提取，作为独立的纯逻辑评估模块。
 *
 * @module engine/guide/StoryTriggerEvaluator
 */

import type {
  StoryEventDefinition,
  StoryTriggerCondition,
} from '../../core/guide';
import { STORY_EVENT_DEFINITIONS } from '../../core/guide';
import type { StoryGameState } from './StoryEventPlayer';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 触发检测所需的完成状态查询接口 */
export interface IStoryCompletionChecker {
  /** 检查指定剧情事件是否已完成 */
  isStoryEventCompleted(eventId: string): boolean;
}

// ─────────────────────────────────────────────
// StoryTriggerEvaluator 类
// ─────────────────────────────────────────────

/**
 * 剧情触发条件评估器
 *
 * 纯逻辑模块，负责遍历剧情事件定义并评估触发条件。
 * 不持有可变状态，每次调用均为无副作用函数。
 */
export class StoryTriggerEvaluator {
  /**
   * 检查是否有剧情事件应该触发
   *
   * 遍历所有剧情事件定义，返回第一个未完成且满足触发条件的事件。
   *
   * @param completionChecker - 用于查询事件完成状态的对象
   * @param gameState - 当前游戏状态快照
   * @returns 满足触发条件的事件定义，或 null
   */
  checkTriggerConditions(
    completionChecker: IStoryCompletionChecker,
    gameState: StoryGameState,
  ): StoryEventDefinition | null {
    for (const event of STORY_EVENT_DEFINITIONS) {
      // 已完成的不触发
      if (completionChecker.isStoryEventCompleted(event.eventId)) continue;

      if (this.evaluateStoryTrigger(event.triggerCondition, gameState)) {
        return event;
      }
    }
    return null;
  }

  /**
   * 检查指定步骤完成后是否触发剧情
   *
   * @param completionChecker - 用于查询事件完成状态的对象
   * @param stepId - 当前完成的步骤 ID
   * @returns 满足触发条件的事件定义，或 null
   */
  checkStepTrigger(
    completionChecker: IStoryCompletionChecker,
    stepId: string,
  ): StoryEventDefinition | null {
    for (const event of STORY_EVENT_DEFINITIONS) {
      if (completionChecker.isStoryEventCompleted(event.eventId)) continue;

      if (
        event.triggerCondition.type === 'after_step' &&
        event.triggerCondition.value === stepId
      ) {
        return event;
      }
    }
    return null;
  }

  /**
   * 评估单个剧情触发条件 (#7)
   *
   * @param condition - 触发条件定义
   * @param gameState - 当前游戏状态快照
   * @returns 是否满足触发条件
   */
  evaluateStoryTrigger(
    condition: StoryTriggerCondition,
    gameState: StoryGameState,
  ): boolean {
    switch (condition.type) {
      case 'first_enter':
        // 由首次启动流程直接触发
        return false;
      case 'after_step':
        // 由步骤完成时检查
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
        // 由引导完成事件触发
        return false;
      default:
        return false;
    }
  }
}
