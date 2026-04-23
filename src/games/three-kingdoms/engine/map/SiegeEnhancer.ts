/**
 * 引擎层 — 攻城增强系统
 *
 * 在 SiegeSystem 基础上提供增强功能：
 *   - 胜率预估公式（基于攻防双方战力）
 *   - 攻城奖励计算与发放
 *   - 驻防对攻城的影响
 *   - 完整征服流程（条件检查→战斗→占领→奖励）
 *
 * @module engine/map/SiegeEnhancer
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  WinRateEstimate,
  BattleRating,
  SiegeReward,
  SiegeRewardItem,
  ConquestResult,
  SiegeEnhancerSaveData,
} from '../../core/map';
import {
  BATTLE_RATING_THRESHOLDS,
  SIEGE_REWARD_CONFIG,
  SIEGE_ENHANCER_SAVE_VERSION,
} from '../../core/map';
import type { TerritoryData, OwnershipStatus } from '../../core/map';

// ─────────────────────────────────────────────
// 配置常量
// ─────────────────────────────────────────────

/** 胜率公式中的幂次参数（控制曲线陡峭度） */
const WIN_RATE_EXPONENT = 1.2;

/** 损失率基础值（胜利时） */
const BASE_LOSS_RATE = 0.3;

/** 道具掉落概率表 */
const ITEM_DROP_TABLE: Array<{ item: SiegeRewardItem; weight: number; minLevel: number }> = [
  { item: { itemId: 'scroll-attack', itemName: '攻击卷轴', quantity: 1, rarity: 'common' }, weight: 40, minLevel: 1 },
  { item: { itemId: 'scroll-defense', itemName: '防御卷轴', quantity: 1, rarity: 'common' }, weight: 40, minLevel: 1 },
  { item: { itemId: 'fragment-box', itemName: '碎片宝箱', quantity: 1, rarity: 'rare' }, weight: 25, minLevel: 2 },
  { item: { itemId: 'exp-book', itemName: '经验书', quantity: 1, rarity: 'rare' }, weight: 20, minLevel: 2 },
  { item: { itemId: 'star-gem', itemName: '升星宝石', quantity: 1, rarity: 'epic' }, weight: 10, minLevel: 3 },
  { item: { itemId: 'mandate-seal', itemName: '天命印', quantity: 1, rarity: 'legendary' }, weight: 3, minLevel: 4 },
];

// ─────────────────────────────────────────────
// 攻城增强系统
// ─────────────────────────────────────────────

/**
 * 攻城增强系统
 *
 * 提供胜率预估、攻城奖励和征服流程。
 * 依赖 SiegeSystem、TerritorySystem 和 GarrisonSystem。
 */
export class SiegeEnhancer implements ISubsystem {
  readonly name = 'siegeEnhancer';

  private deps!: ISystemDeps;
  private totalRewardsGranted = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.totalRewardsGranted = 0;
  }

  update(_dt: number): void { /* 预留 */ }

  getState(): { totalRewardsGranted: number } {
    return { totalRewardsGranted: this.totalRewardsGranted };
  }

  reset(): void {
    this.totalRewardsGranted = 0;
  }

  // ─── 胜率预估（#3）──────────────────────────

  /**
   * 计算胜率预估
   *
   * 公式：
   *   winRate = attackerPower^α / (attackerPower^α + defenderPower^α)
   *   defenderPower = 基础防御 + 驻防加成
   *   estimatedLossRate = baseLoss × (1 - winRate)
   *
   * @param attackerPower - 攻击方有效战力（兵力 × 战力系数）
   * @param targetTerritoryId - 目标领土ID
   * @returns 胜率预估结果
   */
  estimateWinRate(attackerPower: number, targetTerritoryId: string): WinRateEstimate | null {
    const territory = this.territorySys?.getTerritoryById(targetTerritoryId);
    if (!territory) return null;

    const defenderPower = this.calculateDefenderPower(territory);
    const winRate = this.computeWinRate(attackerPower, defenderPower);
    const estimatedLossRate = Math.round(BASE_LOSS_RATE * (1 - winRate) * 100) / 100;
    const rating = this.getBattleRating(winRate);

    return {
      winRate: Math.round(winRate * 10000) / 10000,
      attackerPower: Math.round(attackerPower * 100) / 100,
      defenderPower: Math.round(defenderPower * 100) / 100,
      estimatedLossRate,
      rating,
    };
  }

  /**
   * 计算防守方有效战力
   *
   * ⚠️ PRD MAP-4 统一声明：城防值=基础(1000)×城市等级×(1+科技加成)
   * defenseValue 已由 territory-config 按公式"基础(1000)×城市等级"生成
   * 此处叠加驻防加成；科技加成由 TechLinkSystem 在引擎层动态注入
   */
  calculateDefenderPower(territory: TerritoryData): number {
    const basePower = territory.defenseValue;

    // 加入驻防防御加成
    const garrisonBonus = this.garrisonSys?.getGarrisonBonus(territory.id);
    const garrisonDefenseBonus = garrisonBonus?.defenseBonus ?? 0;

    return basePower * (1 + garrisonDefenseBonus);
  }

  /**
   * 核心胜率计算公式
   *
   * 使用幂函数变换的比率公式
   */
  private computeWinRate(attackerPower: number, defenderPower: number): number {
    if (attackerPower <= 0) return 0;
    if (defenderPower <= 0) return 1;

    const a = Math.pow(attackerPower, WIN_RATE_EXPONENT);
    const d = Math.pow(defenderPower, WIN_RATE_EXPONENT);
    return a / (a + d);
  }

  /**
   * 根据胜率获取战斗评级
   */
  private getBattleRating(winRate: number): BattleRating {
    const ratings: BattleRating[] = ['easy', 'moderate', 'hard', 'very_hard', 'impossible'];
    for (const rating of ratings) {
      const threshold = BATTLE_RATING_THRESHOLDS[rating];
      if (winRate >= threshold.min && winRate <= threshold.max) {
        return rating;
      }
    }
    return 'impossible';
  }

  // ─── 攻城奖励（#5）──────────────────────────

  /**
   * 计算攻城奖励
   *
   * 奖励 = 基础值 × 领土等级 × 类型加成 + 随机道具
   *
   * @param territory - 被攻占的领土
   * @returns 攻城奖励
   */
  calculateSiegeReward(territory: TerritoryData): SiegeReward {
    const level = territory.level;

    // 类型加成
    let typeMultiplier = 1.0;
    if (territory.id.includes('pass-')) {
      typeMultiplier = SIEGE_REWARD_CONFIG.passBonusMultiplier;
    } else if (territory.id.includes('capital-')) {
      typeMultiplier = SIEGE_REWARD_CONFIG.capitalBonusMultiplier;
    }

    const resources = {
      grain: Math.round(SIEGE_REWARD_CONFIG.baseGrain * level * typeMultiplier),
      gold: Math.round(SIEGE_REWARD_CONFIG.baseGold * level * typeMultiplier),
      troops: Math.round(SIEGE_REWARD_CONFIG.baseTroops * level * typeMultiplier),
      mandate: Math.round(SIEGE_REWARD_CONFIG.baseMandate * level * typeMultiplier),
    };

    const territoryExp = Math.round(SIEGE_REWARD_CONFIG.baseTerritoryExp * level * typeMultiplier);

    // 根据等级生成道具奖励
    const items = this.rollRewardItems(level);

    return { resources, territoryExp, items };
  }

  /**
   * 按领土ID计算攻城奖励
   */
  calculateSiegeRewardById(targetId: string): SiegeReward | null {
    const territory = this.territorySys?.getTerritoryById(targetId);
    return territory ? this.calculateSiegeReward(territory) : null;
  }

  /**
   * 随机掉落道具
   */
  private rollRewardItems(territoryLevel: number): SiegeRewardItem[] {
    const eligible = ITEM_DROP_TABLE.filter(entry => territoryLevel >= entry.minLevel);
    if (eligible.length === 0) return [];

    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    const items: SiegeRewardItem[] = [];

    // 每次攻城最多掉落2个道具
    const maxDrops = Math.min(2, Math.ceil(territoryLevel / 2));
    for (let i = 0; i < maxDrops; i++) {
      const roll = Math.random() * totalWeight;
      let cumulative = 0;
      for (const entry of eligible) {
        cumulative += entry.weight;
        if (roll <= cumulative) {
          items.push({ ...entry.item });
          break;
        }
      }
    }

    return items;
  }

  // ─── 征服流程（#2）──────────────────────────

  /**
   * 执行完整征服流程
   *
   * 阶段：条件检查 → 胜率预估 → 战斗 → 占领 → 奖励
   *
   * @param targetId - 目标领土ID
   * @param attackerOwner - 攻击方归属
   * @param attackerPower - 攻击方有效战力
   * @param availableTroops - 可用兵力
   * @param availableGrain - 可用粮草
   * @returns 征服结果
   */
  executeConquest(
    targetId: string,
    attackerOwner: OwnershipStatus,
    attackerPower: number,
    availableTroops: number,
    availableGrain: number,
  ): ConquestResult {
    const territory = this.territorySys?.getTerritoryById(targetId);
    const emptyResult: ConquestResult = {
      success: false,
      phase: 'check',
      targetId,
      targetName: territory?.name ?? targetId,
      winRateEstimate: null,
      battleVictory: false,
      capture: null,
      reward: null,
    };

    if (!territory) {
      return { ...emptyResult, failureReason: `领土 ${targetId} 不存在` };
    }

    // 阶段1：条件检查
    const siegeCheck = this.siegeSys?.checkSiegeConditions(
      targetId, attackerOwner, availableTroops, availableGrain,
    );
    if (!siegeCheck?.canSiege) {
      return {
        ...emptyResult,
        phase: 'check',
        failureReason: siegeCheck?.errorMessage ?? '攻城条件不满足',
      };
    }

    // 阶段2：胜率预估
    const winRateEstimate = this.estimateWinRate(attackerPower, targetId);

    // 阶段3：战斗（使用 SiegeSystem 执行）
    const siegeResult = this.siegeSys?.executeSiegeWithResult(
      targetId, attackerOwner, availableTroops, availableGrain,
      this.determineBattleOutcome(attackerPower, territory),
    );

    if (!siegeResult?.launched) {
      return {
        ...emptyResult,
        phase: 'battle',
        winRateEstimate,
        failureReason: siegeResult?.failureReason ?? '攻城未能发起',
      };
    }

    // 阶段4：占领 & 奖励
    if (siegeResult.victory) {
      const reward = this.calculateSiegeReward(territory);
      this.totalRewardsGranted++;

      // 发出奖励事件
      this.deps?.eventBus.emit('siege:reward', {
        territoryId: targetId,
        territoryName: territory.name,
        reward,
      });

      return {
        success: true,
        phase: 'reward',
        targetId,
        targetName: territory.name,
        winRateEstimate,
        battleVictory: true,
        capture: {
          territoryId: targetId,
          previousOwner: siegeResult.capture?.previousOwner ?? 'neutral',
        },
        reward,
      };
    }

    // 战败
    return {
      success: false,
      phase: 'battle',
      targetId,
      targetName: territory.name,
      winRateEstimate,
      battleVictory: false,
      capture: null,
      reward: null,
      failureReason: siegeResult.failureReason ?? '攻城失败',
    };
  }

  /**
   * 基于战力对比判定战斗结果
   *
   * 使用胜率作为概率阈值
   */
  private determineBattleOutcome(attackerPower: number, territory: TerritoryData): boolean {
    const defenderPower = this.calculateDefenderPower(territory);
    const winRate = this.computeWinRate(attackerPower, defenderPower);
    return Math.random() < winRate;
  }

  // ─── 统计查询 ──────────────────────────────

  getTotalRewardsGranted(): number {
    return this.totalRewardsGranted;
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): SiegeEnhancerSaveData {
    return {
      totalRewardsGranted: this.totalRewardsGranted,
      version: SIEGE_ENHANCER_SAVE_VERSION,
    };
  }

  deserialize(data: SiegeEnhancerSaveData): void {
    this.totalRewardsGranted = data.totalRewardsGranted ?? 0;
  }

  // ─── 内部方法 ──────────────────────────────

  /** 获取 TerritorySystem */
  private get territorySys(): import('./TerritorySystem').TerritorySystem | null {
    try {
      return this.deps?.registry?.get<import('./TerritorySystem').TerritorySystem>('territory') ?? null;
    } catch { return null; }
  }

  /** 获取 SiegeSystem */
  private get siegeSys(): import('./SiegeSystem').SiegeSystem | null {
    try {
      return this.deps?.registry?.get<import('./SiegeSystem').SiegeSystem>('siege') ?? null;
    } catch { return null; }
  }

  /** 获取 GarrisonSystem */
  private get garrisonSys(): import('./GarrisonSystem').GarrisonSystem | null {
    try {
      return this.deps?.registry?.get<import('./GarrisonSystem').GarrisonSystem>('garrison') ?? null;
    } catch { return null; }
  }
}
