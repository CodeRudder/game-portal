/**
 * 借将子系统 — 引擎层
 *
 * 职责：借将/归还/ PvP禁用检查
 * 规则：
 *   - 每日3次借将上限
 *   - 战力80%折算
 *   - PvP禁用
 *   - 自动归还
 *
 * 从 FriendSystem.ts 拆分，解决500行限制
 *
 * @module engine/social/BorrowHeroSubsystem
 */

import type {
  BorrowHeroRecord,
  InteractionConfig,
  SocialState,
} from '../../core/social/social.types';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一ID */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────
// BorrowHeroSubsystem 类
// ─────────────────────────────────────────────

/**
 * 借将子系统
 *
 * 管理借将、归还、PvP禁用检查
 */
export class BorrowHeroSubsystem {
  private interactionConfig: InteractionConfig;

  constructor(interactionConfig: InteractionConfig) {
    this.interactionConfig = interactionConfig;
  }

  /**
   * 借将
   */
  borrowHero(
    state: SocialState,
    heroId: string,
    lenderPlayerId: string,
    borrowerPlayerId: string,
    now: number,
    calculateFriendshipEarned: (state: SocialState, basePoints: number) => number,
  ): { state: SocialState; powerRatio: number } {
    if (state.dailyBorrowCount >= this.interactionConfig.borrowDailyLimit) {
      throw new Error('今日借将次数已达上限');
    }
    if (!state.friends[lenderPlayerId]) {
      throw new Error('不是好友');
    }

    // 检查是否已有未归还的借将
    const activeFromLender = state.activeBorrows.filter(
      (b) => b.lenderPlayerId === lenderPlayerId && !b.returned,
    );
    if (activeFromLender.length > 0) {
      throw new Error('该好友已有借出武将未归还');
    }

    const record: BorrowHeroRecord = {
      id: generateId('borrow'),
      heroId,
      lenderPlayerId,
      borrowerPlayerId,
      borrowTime: now,
      returned: false,
    };

    // 出借方获得友情点
    const earned = calculateFriendshipEarned(
      state,
      this.interactionConfig.lendFriendshipPoints,
    );

    return {
      state: {
        ...state,
        activeBorrows: [...state.activeBorrows, record],
        dailyBorrowCount: state.dailyBorrowCount + 1,
        friendshipPoints: state.friendshipPoints + earned,
        dailyFriendshipEarned: state.dailyFriendshipEarned + earned,
      },
      powerRatio: this.interactionConfig.borrowPowerRatio,
    };
  }

  /**
   * 归还借将
   */
  returnBorrowedHero(state: SocialState, borrowId: string): SocialState {
    const borrow = state.activeBorrows.find((b) => b.id === borrowId);
    if (!borrow) {
      throw new Error('借将记录不存在');
    }
    if (borrow.returned) {
      throw new Error('已归还');
    }

    return {
      ...state,
      activeBorrows: state.activeBorrows.map((b) =>
        b.id === borrowId ? { ...b, returned: true } : b,
      ),
    };
  }

  /**
   * 检查借将是否可用于PvP
   */
  isBorrowHeroAllowedInPvP(): boolean {
    return false; // 借将PvP禁用
  }

  /**
   * 获取互动配置
   */
  getConfig(): InteractionConfig {
    return { ...this.interactionConfig };
  }
}
