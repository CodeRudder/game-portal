/**
 * 好友互动子系统 — 从FriendSystem拆分
 *
 * 职责：好友互动（赠送兵力/拜访主城/切磋）逻辑
 * 规则：
 *   - 赠送兵力: 10次/天 → 友情点×5/次
 *   - 拜访主城: 5次/天 → 铜钱×100/次
 *   - 切磋: 3次/天 → 胜友情点×20/败×5
 *
 * @module engine/social/FriendInteractionHelper
 */

import type {
  InteractionConfig,
  InteractionRecord,
  InteractionType,
  SocialState,
} from '../../core/social/social.types';
import { InteractionType as IT } from '../../core/social/social.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认互动配置 */
export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  giftTroopsDailyLimit: 10,
  giftTroopsFriendshipPoints: 5,
  visitDailyLimit: 5,
  visitCopperReward: 100,
  sparDailyLimit: 3,
  sparWinPoints: 20,
  sparLosePoints: 5,
  borrowDailyLimit: 3,
  lendFriendshipPoints: 10,
  borrowPowerRatio: 0.8,
  friendshipDailyCap: 200,
};

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

/** 获取今日互动记录（使用 UTC 避免时区问题） */
function getTodayInteractions(state: SocialState, now: number): InteractionRecord[] {
  // P0-04 fix: 使用 UTC 计算当日零点，避免时区依赖
  const d = new Date(now);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  return state.dailyInteractions.filter((i) => i.timestamp >= dayStart);
}

// ─────────────────────────────────────────────
// 子系统
// ─────────────────────────────────────────────

/**
 * 好友互动子系统
 */
export class FriendInteractionHelper {
  constructor(private readonly config: InteractionConfig = DEFAULT_INTERACTION_CONFIG) {}

  /**
   * 赠送兵力给好友
   */
  giftTroops(state: SocialState, friendId: string, now: number): {
    state: SocialState;
    pointsEarned: number;
  } {
    const todayInteractions = getTodayInteractions(state, now)
      .filter((i) => i.type === IT.GIFT_TROOPS);
    if (todayInteractions.length >= this.config.giftTroopsDailyLimit) {
      throw new Error(`今日赠送次数已达上限(${this.config.giftTroopsDailyLimit}次)`);
    }
    if (!state.friends[friendId]) {
      throw new Error('好友不存在');
    }

    const basePoints = this.config.giftTroopsFriendshipPoints;
    const pointsEarned = this.calculateFriendshipEarned(state, basePoints);
    const record: InteractionRecord = {
      type: IT.GIFT_TROOPS,
      targetFriendId: friendId,
      timestamp: now,
    };

    return {
      state: {
        ...state,
        dailyInteractions: [...state.dailyInteractions, record],
        friendshipPoints: state.friendshipPoints + pointsEarned,
        dailyFriendshipEarned: state.dailyFriendshipEarned + pointsEarned,
      },
      pointsEarned,
    };
  }

  /**
   * 拜访好友主城
   */
  visitCastle(state: SocialState, friendId: string, now: number): {
    state: SocialState;
    copperReward: number;
    pointsEarned: number;
  } {
    const todayVisits = getTodayInteractions(state, now)
      .filter((i) => i.type === IT.VISIT_CASTLE);
    if (todayVisits.length >= this.config.visitDailyLimit) {
      throw new Error(`今日拜访次数已达上限(${this.config.visitDailyLimit}次)`);
    }
    if (!state.friends[friendId]) {
      throw new Error('好友不存在');
    }

    const copperReward = this.config.visitCopperReward;
    const basePoints = 3;
    const pointsEarned = this.calculateFriendshipEarned(state, basePoints);
    const record: InteractionRecord = {
      type: IT.VISIT_CASTLE,
      targetFriendId: friendId,
      timestamp: now,
    };

    return {
      state: {
        ...state,
        dailyInteractions: [...state.dailyInteractions, record],
        friendshipPoints: state.friendshipPoints + pointsEarned,
        dailyFriendshipEarned: state.dailyFriendshipEarned + pointsEarned,
      },
      copperReward,
      pointsEarned,
    };
  }

  /**
   * 与好友切磋
   */
  spar(state: SocialState, friendId: string, won: boolean, now: number): {
    state: SocialState;
    pointsEarned: number;
  } {
    const todaySpars = getTodayInteractions(state, now)
      .filter((i) => i.type === IT.SPAR);
    if (todaySpars.length >= this.config.sparDailyLimit) {
      throw new Error(`今日切磋次数已达上限(${this.config.sparDailyLimit}次)`);
    }
    if (!state.friends[friendId]) {
      throw new Error('好友不存在');
    }

    const basePoints = won ? this.config.sparWinPoints : this.config.sparLosePoints;
    const pointsEarned = this.calculateFriendshipEarned(state, basePoints);
    const record: InteractionRecord = {
      type: IT.SPAR,
      targetFriendId: friendId,
      timestamp: now,
    };

    return {
      state: {
        ...state,
        dailyInteractions: [...state.dailyInteractions, record],
        friendshipPoints: state.friendshipPoints + pointsEarned,
        dailyFriendshipEarned: state.dailyFriendshipEarned + pointsEarned,
      },
      pointsEarned,
    };
  }

  /**
   * 计算实际获得的友情点（考虑每日上限）
   */
  calculateFriendshipEarned(state: SocialState, basePoints: number): number {
    const remaining = this.config.friendshipDailyCap - state.dailyFriendshipEarned;
    return Math.max(0, Math.min(basePoints, remaining));
  }

  /**
   * 获取今日互动次数（按类型）
   */
  getDailyInteractionCount(state: SocialState, type: InteractionType, now: number): number {
    return getTodayInteractions(state, now).filter((i) => i.type === type).length;
  }

  /**
   * 获取互动配置
   */
  getConfig(): InteractionConfig {
    return { ...this.config };
  }
}
