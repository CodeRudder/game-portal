/**
 * 战斗解析器 — 山贼战斗+遗迹探索公式 (MAP-F09-02)
 *
 * 实现R6/R7/R8修正后的公式:
 * - 山贼战斗: 独立战力+兵力参与+胜利损耗上限35%
 * - 遗迹探索: 三档随机判定+科技加成影响阈值
 *
 * @module engine/map/CombatResolver
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 山贼难度等级 */
export type BanditDifficulty = 'weak' | 'fierce' | 'elite' | 'king';

/** 山贼战斗结果 */
export interface BanditCombatResult {
  /** 是否胜利 */
  victory: boolean;
  /** 战斗胜率 */
  winRate: number;
  /** 山贼战力 */
  banditPower: number;
  /** 玩家有效战力 */
  playerPower: number;
  /** 兵力损失 */
  troopLoss: number;
  /** 损失比例 */
  lossRate: number;
}

/** 遗迹探索结果等级 */
export type ExploreResultTier = 'success' | 'partial' | 'fail';

/** 遗迹探索结果 */
export interface RuinsExploreResult {
  /** 结果等级 */
  tier: ExploreResultTier;
  /** roll值(0-100) */
  roll: number;
  /** 失败阈值 */
  failThreshold: number;
  /** 部分成功阈值 */
  partialThreshold: number;
  /** 奖励倍率 */
  rewardMultiplier: number;
  /** 内应信掉落概率 */
  insiderLetterChance: number;
  /** 兵力损失比例(仅失败) */
  troopLossRate: number;
}

/** 装备品质 */
export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic';

/** 装备掉落结果 */
export interface EquipmentDropResult {
  /** 是否掉落 */
  dropped: boolean;
  /** 装备品质 */
  rarity: EquipmentRarity | null;
  /** 装备等级 */
  level: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 山贼难度系数 (R6修正) */
const BANDIT_DIFFICULTY_COEFFICIENTS: Record<BanditDifficulty, number> = {
  weak: 0.3,    // 玩家等级 1~20
  fierce: 0.5,  // 玩家等级 21~40
  elite: 0.7,   // 玩家等级 41~60
  king: 0.9,    // 玩家等级 61+
};

/** 胜利损耗上限 (R8修正: k=1.75, 35%) */
const WIN_LOSS_CAP = 0.35;

/** 失败损耗固定比例 */
const DEFEAT_LOSS_RATE = 0.20;

/** 胜率截断范围 */
const WIN_RATE_MIN = 0.05;
const WIN_RATE_MAX = 0.95;

/** 装备掉落品质概率表 */
const EQUIPMENT_DROP_TABLE: Array<{ rarity: EquipmentRarity; weight: number }> = [
  { rarity: 'common', weight: 60 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 12 },
  { rarity: 'epic', weight: 3 },
];

/** 内应信掉落概率(山贼战斗胜利) */
const BANDIT_INSIDER_LETTER_CHANCE = 0.15;

/** 内应信掉落概率(遗迹探索成功) */
const RUINS_INSIDER_LETTER_CHANCE = 0.25;

// ─────────────────────────────────────────────
// CombatResolver
// ─────────────────────────────────────────────

/**
 * 战斗解析器
 *
 * 提供山贼战斗和遗迹探索的公式计算。
 * 所有方法为纯函数，无状态依赖。
 */
export class CombatResolver {

  // ── 山贼战斗 ─────────────────────────────────

  /**
   * 获取玩家等级对应的山贼难度
   */
  getBanditDifficulty(playerLevel: number): BanditDifficulty {
    if (playerLevel <= 20) return 'weak';
    if (playerLevel <= 40) return 'fierce';
    if (playerLevel <= 60) return 'elite';
    return 'king';
  }

  /**
   * 计算山贼战力 (R6修正: 独立数值，不依赖玩家兵力)
   *
   * 公式: max(100, 玩家等级 × 100) × 难度系数
   */
  calculateBanditPower(playerLevel: number, difficulty?: BanditDifficulty): number {
    const diff = difficulty ?? this.getBanditDifficulty(playerLevel);
    const coefficient = BANDIT_DIFFICULTY_COEFFICIENTS[diff];
    const basePower = Math.max(100, playerLevel * 100);
    return Math.round(basePower * coefficient);
  }

  /**
   * 计算山贼战斗胜率 (R6修正)
   *
   * 公式: min(95%, max(5%,
   *   (玩家兵力 / 山贼战力) × 50%
   *   + 地形修正(森林+10% / 山地-10% / 其他0%)
   *   + 科技加成(攻城术等级×2%)
   * ))
   */
  calculateBanditWinRate(
    playerTroops: number,
    banditPower: number,
    terrainBonus: number = 0,
    techBonus: number = 0,
  ): number {
    if (!Number.isFinite(playerTroops) || !Number.isFinite(banditPower)) return WIN_RATE_MIN;
    if (playerTroops <= 0) return WIN_RATE_MIN;
    if (banditPower <= 0) return WIN_RATE_MAX;

    const ratio = playerTroops / banditPower;
    const rawRate = ratio * 0.5 + terrainBonus + techBonus;
    return Math.min(WIN_RATE_MAX, Math.max(WIN_RATE_MIN, rawRate));
  }

  /**
   * 计算胜利时兵力损失 (R8修正: 上限35%)
   *
   * 公式: 出征兵力 × min(35%, max(5%, 20% × (山贼战力 / 玩家兵力)))
   */
  calculateWinLoss(playerTroops: number, banditPower: number): number {
    if (playerTroops <= 0) return 0;
    const ratio = banditPower / playerTroops;
    const rawRate = DEFEAT_LOSS_RATE * ratio;
    const clampedRate = Math.min(WIN_LOSS_CAP, Math.max(0.05, rawRate));
    return Math.floor(playerTroops * clampedRate);
  }

  /**
   * 计算失败时兵力损失
   *
   * 公式: 出征兵力 × 20%
   */
  calculateDefeatLoss(playerTroops: number): number {
    return Math.floor(playerTroops * DEFEAT_LOSS_RATE);
  }

  /**
   * 执行山贼战斗
   */
  executeBanditCombat(
    playerTroops: number,
    playerLevel: number,
    terrainBonus: number = 0,
    techBonus: number = 0,
    rng: () => number = Math.random,
  ): BanditCombatResult {
    const difficulty = this.getBanditDifficulty(playerLevel);
    const banditPower = this.calculateBanditPower(playerLevel, difficulty);
    const winRate = this.calculateBanditWinRate(playerTroops, banditPower, terrainBonus, techBonus);
    const victory = rng() < winRate;

    let troopLoss: number;
    let lossRate: number;

    if (victory) {
      troopLoss = this.calculateWinLoss(playerTroops, banditPower);
      lossRate = troopLoss / playerTroops;
    } else {
      troopLoss = this.calculateDefeatLoss(playerTroops);
      lossRate = DEFEAT_LOSS_RATE;
    }

    return {
      victory,
      winRate,
      banditPower,
      playerPower: playerTroops,
      troopLoss,
      lossRate,
    };
  }

  // ── 遗迹探索 ─────────────────────────────────

  /**
   * 计算遗迹探索三档阈值 (R6/R7修正)
   *
   * 失败阈值 = max(5%, 30% - 科技加成 - 地形修正)
   * 部分成功阈值 = max(失败阈值+5%, 50% - 科技加成×0.5 - 地形修正×0.5)
   */
  calculateExploreThresholds(
    techBonus: number = 0,
    terrainBonus: number = 0,
  ): { failThreshold: number; partialThreshold: number } {
    const failThreshold = Math.max(0.05, 0.30 - techBonus - terrainBonus);
    const partialThreshold = Math.max(failThreshold + 0.05, 0.50 - techBonus * 0.5 - terrainBonus * 0.5);
    return { failThreshold, partialThreshold };
  }

  /**
   * 执行遗迹探索三档判定
   */
  executeRuinsExplore(
    techBonus: number = 0,
    terrainBonus: number = 0,
    rng: () => number = Math.random,
  ): RuinsExploreResult {
    const { failThreshold, partialThreshold } = this.calculateExploreThresholds(techBonus, terrainBonus);
    const roll = rng();

    let tier: ExploreResultTier;
    let rewardMultiplier: number;
    let insiderLetterChance: number;
    let troopLossRate: number;

    if (roll < failThreshold) {
      tier = 'fail';
      rewardMultiplier = 0;
      insiderLetterChance = 0;
      troopLossRate = 0.10;
    } else if (roll < partialThreshold) {
      tier = 'partial';
      rewardMultiplier = 0.5;
      insiderLetterChance = RUINS_INSIDER_LETTER_CHANCE * 0.5;
      troopLossRate = 0;
    } else {
      tier = 'success';
      rewardMultiplier = 1.0;
      insiderLetterChance = RUINS_INSIDER_LETTER_CHANCE;
      troopLossRate = 0;
    }

    return {
      tier,
      roll,
      failThreshold,
      partialThreshold,
      rewardMultiplier,
      insiderLetterChance,
      troopLossRate,
    };
  }

  // ── 装备掉落 ─────────────────────────────────

  /**
   * 判定装备掉落 (山贼战斗胜利)
   */
  rollEquipmentDrop(
    playerLevel: number,
    rng: () => number = Math.random,
  ): EquipmentDropResult {
    const roll = rng() * 100;
    let cumulative = 0;

    for (const entry of EQUIPMENT_DROP_TABLE) {
      cumulative += entry.weight;
      if (roll < cumulative) {
        const levelOffset = entry.rarity === 'epic' ? 0
          : entry.rarity === 'rare' ? 2
          : entry.rarity === 'uncommon' ? 3
          : 5;
        return {
          dropped: true,
          rarity: entry.rarity,
          level: Math.max(1, playerLevel + Math.floor(rng() * (levelOffset * 2 + 1)) - levelOffset),
        };
      }
    }

    return { dropped: false, rarity: null, level: 0 };
  }

  /**
   * 判定内应信掉落
   */
  rollInsiderLetterDrop(
    chance: number,
    rng: () => number = Math.random,
  ): boolean {
    return rng() < chance;
  }
}
