/**
 * 三国霸业 — 攻城略地关卡管理器
 *
 * 管理关卡解锁、战力对比、战斗计算和奖励发放。
 * 使用简化的战力对比机制（区别于 CampaignBattleSystem 的详细回合制战斗）。
 *
 * 战斗计算规则：
 * - 玩家战力 >= 敌方战力 × 1.5 → 3星通关
 * - 玩家战力 >= 敌方战力 × 1.2 → 2星通关
 * - 玩家战力 >= 敌方战力 × 1.0 → 1星通关
 * - 玩家战力 < 敌方战力 → 挑战失败
 *
 * @module games/three-kingdoms/ThreeKingdomsCampaignManager
 */

import {
  CAMPAIGN_STAGE_DEFINITIONS,
  ERA_COLORS,
  DIFFICULTY_DISPLAY,
  type CampaignStage,
  type CampaignEra,
  type CampaignRewards,
  type StarRating,
  type ChallengeResult,
} from './ThreeKingdomsCampaign';

// ═══════════════════════════════════════════════════════════════
// 战斗计算常量
// ═══════════════════════════════════════════════════════════════

/** 星级计算阈值（玩家战力 / 敌方战力） */
export const STAR_THRESHOLDS = {
  /** 3星阈值：战力达到敌方的 1.5 倍 */
  THREE_STAR: 1.5,
  /** 2星阈值：战力达到敌方的 1.2 倍 */
  TWO_STAR: 1.2,
  /** 1星阈值：战力达到敌方的 1.0 倍 */
  ONE_STAR: 1.0,
} as const;

/** 关卡总数 */
export const TOTAL_STAGE_COUNT = CAMPAIGN_STAGE_DEFINITIONS.length;

// ═══════════════════════════════════════════════════════════════
// 关卡管理器
// ═══════════════════════════════════════════════════════════════

/**
 * 攻城略地关卡管理器
 *
 * 管理关卡状态（解锁/完成/星级），提供战力对比的战斗计算。
 * 与引擎的 CampaignSystem 独立，可单独使用或集成。
 */
export class ThreeKingdomsCampaignManager {
  /** 关卡运行时状态（id → CampaignStage） */
  private stages: Map<string, CampaignStage> = new Map();

  /** 关卡顺序（用于解锁链） */
  private stageOrder: string[] = [];

  constructor() {
    this.initializeStages();
  }

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  /** 从定义数据初始化关卡状态 */
  private initializeStages(): void {
    for (const def of CAMPAIGN_STAGE_DEFINITIONS) {
      const stage: CampaignStage = {
        id: def.id,
        name: def.name,
        description: def.description,
        era: def.era,
        difficulty: def.difficulty,
        enemyFaction: def.enemyFaction,
        enemyLeader: def.enemyLeader,
        requiredPower: def.requiredPower,
        rewards: { ...def.rewards },
        // 第一章默认解锁，其余锁定
        unlocked: def.id === 'stage_1',
        completed: false,
        stars: 0 as StarRating,
      };
      this.stages.set(def.id, stage);
      this.stageOrder.push(def.id);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 查询方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取所有关卡列表
   * @returns 关卡数组（按顺序排列）
   */
  getStages(): CampaignStage[] {
    return this.stageOrder
      .map(id => this.stages.get(id)!)
      .filter(Boolean);
  }

  /**
   * 获取指定关卡
   * @param stageId 关卡 ID
   * @returns 关卡数据或 undefined
   */
  getStage(stageId: string): CampaignStage | undefined {
    return this.stages.get(stageId);
  }

  /**
   * 获取关卡数量
   */
  getStageCount(): number {
    return this.stageOrder.length;
  }

  /**
   * 获取已完成的关卡数量
   */
  getCompletedCount(): number {
    let count = 0;
    for (const stage of this.stages.values()) {
      if (stage.completed) count++;
    }
    return count;
  }

  /**
   * 获取总星数
   */
  getTotalStars(): number {
    let total = 0;
    for (const stage of this.stages.values()) {
      total += stage.stars;
    }
    return total;
  }

  /**
   * 获取最大星数（3 × 关卡数）
   */
  getMaxStars(): number {
    return this.stageOrder.length * 3;
  }

  /**
   * 判断是否全部通关
   */
  isAllCompleted(): boolean {
    for (const stage of this.stages.values()) {
      if (!stage.completed) return false;
    }
    return true;
  }

  /**
   * 获取推荐战力（即敌方战力）
   * @param stageId 关卡 ID
   * @returns 推荐战力，不存在返回 0
   */
  getRecommendedPower(stageId: string): number {
    return this.stages.get(stageId)?.requiredPower ?? 0;
  }

  /**
   * 获取下一个可挑战的关卡
   * @returns 未完成的已解锁关卡，或 undefined
   */
  getNextAvailableStage(): CampaignStage | undefined {
    for (const id of this.stageOrder) {
      const stage = this.stages.get(id)!;
      if (stage.unlocked && !stage.completed) {
        return stage;
      }
    }
    return undefined;
  }

  // ═══════════════════════════════════════════════════════════
  // 战斗计算
  // ═══════════════════════════════════════════════════════════

  /**
   * 计算星级评价
   *
   * 基于玩家战力与敌方战力的比值：
   * - 比值 >= 1.5 → 3星
   * - 比值 >= 1.2 → 2星
   * - 比值 >= 1.0 → 1星
   * - 比值 < 1.0 → 0星（失败）
   *
   * @param playerPower 玩家战力
   * @param enemyPower 敌方战力
   * @returns 星级评价
   */
  calculateStars(playerPower: number, enemyPower: number): StarRating {
    if (enemyPower <= 0) return 3 as StarRating;
    const ratio = playerPower / enemyPower;

    if (ratio >= STAR_THRESHOLDS.THREE_STAR) return 3 as StarRating;
    if (ratio >= STAR_THRESHOLDS.TWO_STAR) return 2 as StarRating;
    if (ratio >= STAR_THRESHOLDS.ONE_STAR) return 1 as StarRating;
    return 0 as StarRating;
  }

  /**
   * 挑战关卡
   *
   * 执行战力对比计算，返回战斗结果。
   * 如果胜利，自动更新关卡状态（完成、星级）并解锁下一关。
   *
   * @param stageId 关卡 ID
   * @param playerPower 玩家当前战力
   * @returns 挑战结果
   */
  challenge(stageId: string, playerPower: number): ChallengeResult {
    const stage = this.stages.get(stageId);

    // 关卡不存在
    if (!stage) {
      return {
        won: false,
        stars: 0 as StarRating,
        rewards: {},
      };
    }

    // 关卡未解锁
    if (!stage.unlocked) {
      return {
        won: false,
        stars: 0 as StarRating,
        rewards: {},
      };
    }

    // 计算星级（包含胜负判定）
    const stars = this.calculateStars(playerPower, stage.requiredPower);
    const won = stars > 0;

    // 计算奖励（胜利时发放，失败时为空）
    const rewards: CampaignRewards = won ? { ...stage.rewards } : {};

    // 更新关卡状态
    if (won) {
      // 仅在首次通关或获得更高星级时更新
      if (!stage.completed || stars > stage.stars) {
        stage.completed = true;
        stage.stars = stars;
      }

      // 解锁下一关
      this.unlockNext(stageId);
    }

    return { won, stars, rewards };
  }

  // ═══════════════════════════════════════════════════════════
  // 解锁管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 解锁下一关（当前关通过后调用）
   *
   * @param currentStageId 当前通过的关卡 ID
   * @returns 是否成功解锁了新关卡
   */
  unlockNext(currentStageId: string): boolean {
    const currentIdx = this.stageOrder.indexOf(currentStageId);
    if (currentIdx < 0) return false;

    const nextIdx = currentIdx + 1;
    if (nextIdx >= this.stageOrder.length) return false;

    const nextStage = this.stages.get(this.stageOrder[nextIdx]);
    if (!nextStage || nextStage.unlocked) return false;

    nextStage.unlocked = true;
    return true;
  }

  /**
   * 重置所有关卡状态（用于重新开始）
   */
  reset(): void {
    this.stages.clear();
    this.stageOrder = [];
    this.initializeStages();
  }

  // ═══════════════════════════════════════════════════════════
  // 序列化
  // ═══════════════════════════════════════════════════════════

  /**
   * 序列化关卡状态
   */
  serialize(): { stages: Array<{ id: string; unlocked: boolean; completed: boolean; stars: number }> } {
    const stages: Array<{ id: string; unlocked: boolean; completed: boolean; stars: number }> = [];
    for (const id of this.stageOrder) {
      const s = this.stages.get(id)!;
      stages.push({
        id: s.id,
        unlocked: s.unlocked,
        completed: s.completed,
        stars: s.stars,
      });
    }
    return { stages };
  }

  /**
   * 反序列化关卡状态
   */
  deserialize(data: { stages?: Array<{ id: string; unlocked: boolean; completed: boolean; stars: number }> }): void {
    if (!data?.stages) return;
    for (const saved of data.stages) {
      const stage = this.stages.get(saved.id);
      if (stage) {
        stage.unlocked = saved.unlocked;
        stage.completed = saved.completed;
        stage.stars = saved.stars as StarRating;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 格式化战力数值（如 1000 → "1,000"，50000 → "50,000"）
 */
export function formatPower(power: number): string {
  return Math.floor(power).toLocaleString();
}

/**
 * 获取难度显示信息
 */
export function getDifficultyInfo(difficulty: number): { label: string; color: string; stars: string } {
  return DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG[1];
}

/** 难度显示配置（内部使用） */
const DIFFICULTY_CONFIG: Record<number, { label: string; color: string; stars: string }> = {
  1: { label: '入门', color: '#4ade80', stars: '★☆☆☆☆' },
  2: { label: '普通', color: '#facc15', stars: '★★☆☆☆' },
  3: { label: '困难', color: '#f97316', stars: '★★★☆☆' },
  4: { label: '噩梦', color: '#ef4444', stars: '★★★★☆' },
  5: { label: '地狱', color: '#dc2626', stars: '★★★★★' },
};
