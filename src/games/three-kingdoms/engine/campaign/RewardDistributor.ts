/**
 * 关卡系统 — 奖励分发器
 *
 * 负责计算关卡通关后的奖励，包括：
 * - 基础奖励（每次通关）
 * - 首通额外奖励
 * - 星级加成倍率
 * - 掉落表随机抽取
 *
 * 通过回调解耦资源系统和武将系统，不直接依赖其他子系统。
 *
 * @module engine/campaign/RewardDistributor
 */

import type {
  DropTableEntry,
  ICampaignDataProvider,
  RewardDistributorDeps,
  StageReward,
  StarCount,
} from './campaign.types';
import { MAX_STARS } from './campaign.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 各星级对应的加成倍率 */
const STAR_MULTIPLIERS: Record<number, number> = {
  0: 0,   // 未通关，无奖励
  1: 1.0, // 1星：基础倍率
  2: 1.0, // 2星：基础倍率
  3: 1.5, // 3星：1.5倍加成（使用关卡自身 threeStarBonusMultiplier 覆盖）
} as const;

/** 默认随机数生成器（使用 Math.random） */
const defaultRng = (): number => Math.random();

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/**
 * 随机整数（含边界）
 *
 * @param min - 最小值
 * @param max - 最大值
 * @param rng - 随机数生成器
 * @returns [min, max] 范围内的随机整数
 */
function randomInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * 计算星级加成倍率
 *
 * @param stars - 星级
 * @param threeStarBonusMultiplier - 关卡配置的三星额外倍率
 * @returns 加成倍率
 */
function getStarMultiplier(stars: number, threeStarBonusMultiplier: number): number {
  if (stars >= MAX_STARS) return threeStarBonusMultiplier;
  return STAR_MULTIPLIERS[stars] ?? 1.0;
}

// ─────────────────────────────────────────────
// RewardDistributor
// ─────────────────────────────────────────────

/**
 * 奖励分发器
 *
 * 计算关卡通关奖励并通过回调分发到各子系统。
 *
 * 奖励计算规则：
 * 1. 基础奖励 = stage.baseRewards × starMultiplier
 * 2. 基础经验 = stage.baseExp × starMultiplier
 * 3. 首通奖励 = stage.firstClearRewards（仅首次通关）
 * 4. 首通经验 = stage.firstClearExp（仅首次通关）
 * 5. 掉落物品 = 从 dropTable 随机抽取
 *
 * @example
 * ```ts
 * const distributor = new RewardDistributor(dataProvider, {
 *   addResource: (type, amount) => resourceSystem.add(type, amount),
 *   addFragment: (id, count) => heroSystem.addFragment(id, count),
 *   addExp: (exp) => heroSystem.addExp(exp),
 * });
 *
 * const reward = distributor.calculateRewards('chapter1_stage1', 3, true);
 * distributor.distribute(reward);
 * ```
 */
export class RewardDistributor {
  /** 关卡数据提供者 */
  private readonly dataProvider: ICampaignDataProvider;
  /** 奖励分发依赖（回调集合） */
  private readonly deps: RewardDistributorDeps;
  /** 随机数生成器（可注入，方便测试） */
  private readonly rng: () => number;

  /**
   * @param dataProvider - 关卡数据提供者
   * @param deps - 奖励分发依赖（回调集合）
   * @param rng - 随机数生成器（默认 Math.random）
   */
  constructor(
    dataProvider: ICampaignDataProvider,
    deps: RewardDistributorDeps,
    rng?: () => number,
  ) {
    this.dataProvider = dataProvider;
    this.deps = deps;
    this.rng = rng ?? defaultRng;
  }

  // ─────────────────────────────────────────────
  // 1. 奖励计算
  // ─────────────────────────────────────────────

  /**
   * 计算关卡奖励
   *
   * 根据关卡配置、星级和首通状态，计算本次通关的完整奖励。
   *
   * @param stageId - 关卡ID
   * @param stars - 通关星级（0-3）
   * @param isFirstClear - 是否为首通
   * @returns 计算后的奖励数据
   * @throws {Error} 关卡不存在时抛出异常
   */
  calculateRewards(stageId: string, stars: number, isFirstClear: boolean): StageReward {
    const stage = this.dataProvider.getStage(stageId);
    if (!stage) {
      throw new Error(`[RewardDistributor] 关卡不存在: ${stageId}`);
    }

    // 限制星级范围
    const clampedStars = Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarCount;

    // 计算星级加成倍率
    const starMultiplier = getStarMultiplier(clampedStars, stage.threeStarBonusMultiplier);

    // 1. 基础资源奖励
    const resources = this.calculateResourceRewards(stage.baseRewards, starMultiplier);

    // 2. 基础经验
    const exp = Math.floor(stage.baseExp * starMultiplier);

    // 3. 首通额外奖励
    if (isFirstClear) {
      this.mergeResources(resources, stage.firstClearRewards);
    }

    // 4. 首通额外经验
    const totalExp = isFirstClear ? exp + stage.firstClearExp : exp;

    // 5. 掉落物品
    const fragments = this.rollDropTable(stage.dropTable, resources);

    return {
      resources,
      exp: totalExp,
      fragments,
      isFirstClear,
      starMultiplier,
    };
  }

  /**
   * 计算并分发奖励
   *
   * 一步完成计算和分发：计算奖励后立即通过回调分发到各子系统。
   *
   * @param stageId - 关卡ID
   * @param stars - 通关星级（0-3）
   * @param isFirstClear - 是否为首通
   * @returns 计算后的奖励数据
   */
  calculateAndDistribute(stageId: string, stars: number, isFirstClear: boolean): StageReward {
    const reward = this.calculateRewards(stageId, stars, isFirstClear);
    this.distribute(reward);
    return reward;
  }

  // ─────────────────────────────────────────────
  // 2. 奖励分发
  // ─────────────────────────────────────────────

  /**
   * 分发奖励到各子系统
   *
   * 通过回调将奖励分发到资源系统、武将系统等。
   *
   * @param reward - 奖励数据
   */
  distribute(reward: StageReward): void {
    // 分发资源
    for (const [type, amount] of Object.entries(reward.resources)) {
      if (amount && amount > 0) {
        this.deps.addResource(type as any, amount);
      }
    }

    // 分发经验
    if (reward.exp > 0 && this.deps.addExp) {
      this.deps.addExp(reward.exp);
    }

    // 分发碎片
    if (this.deps.addFragment) {
      for (const [generalId, count] of Object.entries(reward.fragments)) {
        if (count > 0) {
          this.deps.addFragment(generalId, count);
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // 3. 预览奖励（不分发）
  // ─────────────────────────────────────────────

  /**
   * 预览基础奖励（不含掉落）
   *
   * 用于UI展示关卡的基础奖励信息。
   *
   * @param stageId - 关卡ID
   * @returns 基础资源和经验
   */
  previewBaseRewards(stageId: string): { resources: Partial<Record<string, number>>; exp: number } {
    const stage = this.dataProvider.getStage(stageId);
    if (!stage) {
      throw new Error(`[RewardDistributor] 关卡不存在: ${stageId}`);
    }

    return {
      resources: { ...stage.baseRewards },
      exp: stage.baseExp,
    };
  }

  /**
   * 预览首通奖励
   *
   * @param stageId - 关卡ID
   * @returns 首通资源和经验
   */
  previewFirstClearRewards(stageId: string): { resources: Partial<Record<string, number>>; exp: number } {
    const stage = this.dataProvider.getStage(stageId);
    if (!stage) {
      throw new Error(`[RewardDistributor] 关卡不存在: ${stageId}`);
    }

    return {
      resources: { ...stage.firstClearRewards },
      exp: stage.firstClearExp,
    };
  }

  // ─────────────────────────────────────────────
  // 4. 内部方法
  // ─────────────────────────────────────────────

  /**
   * 计算资源奖励（应用倍率）
   */
  private calculateResourceRewards(
    baseRewards: Partial<Record<string, number>>,
    multiplier: number,
  ): Partial<Record<string, number>> {
    const result: Partial<Record<string, number>> = {};
    for (const [type, amount] of Object.entries(baseRewards)) {
      if (amount !== undefined && amount > 0) {
        result[type] = Math.floor(amount * multiplier);
      }
    }
    return result;
  }

  /**
   * 合并资源到目标对象
   */
  private mergeResources(
    target: Partial<Record<string, number>>,
    source: Partial<Record<string, number>>,
  ): void {
    for (const [type, amount] of Object.entries(source)) {
      if (amount !== undefined && amount > 0) {
        target[type] = (target[type] ?? 0) + amount;
      }
    }
  }

  /**
   * 掉落表随机抽取
   *
   * 遍历掉落表，按概率随机决定是否掉落。
   * 资源类掉落合并到 resources，碎片类掉落返回 fragments Map。
   *
   * @param dropTable - 掉落表
   * @param resources - 资源累加目标（就地修改）
   * @returns 碎片掉落 Map<generalId, count>
   */
  private rollDropTable(
    dropTable: DropTableEntry[],
    resources: Partial<Record<string, number>>,
  ): Record<string, number> {
    const fragments: Record<string, number> = {};

    for (const entry of dropTable) {
      // 概率判定
      if (this.rng() > entry.probability) continue;

      // 随机数量
      const amount = randomInt(entry.minAmount, entry.maxAmount, this.rng);
      if (amount <= 0) continue;

      switch (entry.type) {
        case 'resource':
          if (entry.resourceType) {
            resources[entry.resourceType] = (resources[entry.resourceType] ?? 0) + amount;
          }
          break;

        case 'fragment':
          if (entry.generalId) {
            fragments[entry.generalId] = (fragments[entry.generalId] ?? 0) + amount;
          }
          break;

        case 'exp':
          // 经验掉落合并到 resources 中的 exp 字段（通过特殊key）
          // 实际经验通过 addExp 回调分发
          resources['_exp_drop'] = (resources['_exp_drop'] ?? 0) + amount;
          break;
      }
    }

    return fragments;
  }
}
