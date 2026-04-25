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
} from './campaign.types';
import { type StarRating, MAX_STARS } from './campaign.types';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/**
 * 各星级对应的加成倍率（PRD v3.0 §4.2）
 *
 * ★×1.0 / ★★×1.5 / ★★★×2.0
 */
const STAR_MULTIPLIERS: Record<number, number> = {
  0: 0,   // 未通关，无奖励
  1: 1.0, // 1星：基础倍率
  2: 1.5, // 2星：1.5倍加成
  3: 2.0, // 3星：2.0倍加成
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
 * PRD v3.0 §4.2：★×1.0 / ★★×1.5 / ★★★×2.0
 * 统一使用 STAR_MULTIPLIERS 常量，不再使用关卡配置的 threeStarBonusMultiplier。
 *
 * @param stars - 星级
 * @param _threeStarBonusMultiplier - 已废弃，保留参数签名兼容性
 * @returns 加成倍率
 */
function getStarMultiplier(stars: number, _threeStarBonusMultiplier?: number): number {
  if (stars >= MAX_STARS) return STAR_MULTIPLIERS[MAX_STARS] ?? 2.0;
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
export class RewardDistributor implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'rewardDistributor' as const;
  private sysDeps: ISystemDeps | null = null;

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
    const clampedStars = Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarRating;

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

    // 4. 掉落物品（首通时碎片必掉）
    const { fragments, bonusExp } = this.rollDropTable(
      stage.dropTable, resources, isFirstClear,
    );

    // 5. 总经验 = 基础经验 × 倍率 + 首通额外经验 + 掉落经验
    const totalExp = isFirstClear
      ? exp + stage.firstClearExp + bonusExp
      : exp + bonusExp;

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
    // 分发资源（类型安全遍历 Partial<Resources>）
    const resourceKeys: (keyof import('../../shared/types').Resources)[] = [
      'grain', 'gold', 'troops', 'mandate',
    ];
    for (const key of resourceKeys) {
      const amount = reward.resources[key];
      if (amount && amount > 0) {
        this.deps.addResource(key, amount);
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
   * 资源类掉落合并到 resources，碎片类掉落返回 fragments Map，
   * 经验类掉落返回额外经验值。
   *
   * PRD v3.0 §4.3a：
   *   - 首通时关联武将碎片必掉（100%概率）
   *   - 非首通时碎片按 dropTable 配置的概率掉落
   *
   * @param dropTable - 掉落表
   * @param resources - 资源累加目标（就地修改）
   * @param isFirstClear - 是否首通（首通时碎片必掉）
   * @returns 碎片掉落和额外经验 { fragments, bonusExp }
   */
  private rollDropTable(
    dropTable: DropTableEntry[],
    resources: Partial<Record<string, number>>,
    isFirstClear = false,
  ): { fragments: Record<string, number>; bonusExp: number } {
    const fragments: Record<string, number> = {};
    let bonusExp = 0;

    // P0-4: 首通时收集所有碎片类掉落条目，确保必掉
    const firstClearFragmentEntries: DropTableEntry[] = [];

    for (const entry of dropTable) {
      // 首通时收集碎片条目，跳过概率判定
      if (isFirstClear && entry.type === 'fragment') {
        firstClearFragmentEntries.push(entry);
        continue;
      }

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
          bonusExp += amount;
          break;
      }
    }

    // P0-4: 首通必掉碎片 — 使用掉落表中的 minAmount 确保必掉
    if (isFirstClear) {
      for (const entry of firstClearFragmentEntries) {
        if (entry.generalId) {
          const amount = entry.minAmount; // 首通使用最小数量，确保必掉
          fragments[entry.generalId] = (fragments[entry.generalId] ?? 0) + amount;
        }
      }
    }

    return { fragments, bonusExp };
  }

  // ─────────────────────────────────────────────
  // ISubsystem 适配层
  // ─────────────────────────────────────────────

  /** ISubsystem.init — 注入依赖 */
  init(deps: ISystemDeps): void {
    this.sysDeps = deps;
  }

  /** ISubsystem.update — 奖励分发器是事件驱动的，不需要每帧更新 */
  update(_dt: number): void {
    // 奖励分发器按需调用，不需要每帧更新
  }

  // ─────────────────────────────────────────────
  // v20.0 统一奖励 API
  // ─────────────────────────────────────────────

  /**
   * 获取天下一统完成奖励
   *
   * 返回统一完成时的奖励列表（专属称号/头像/资源）。
   * 奖励内容根据结局等级不同：
   * - S级: 帝王称号 + 专属头像框 + 天命×3000 + 神话武将碎片×10
   * - A级: 霸主称号 + 天命×2000 + 传说装备图纸×3
   * - B级: 诸侯称号 + 天命×1000
   * - C级: 英雄称号 + 天命×500
   *
   * @param grade - 结局等级
   */
  getUnificationRewards(grade: string = 'C'): Array<{ type: string; id: string; name: string; amount: number }> {
    const rewards: Array<{ type: string; id: string; name: string; amount: number }> = [];

    switch (grade) {
      case 'S':
        rewards.push({ type: 'title', id: 'title-emperor', name: '帝王称号', amount: 1 });
        rewards.push({ type: 'avatar', id: 'avatar-emperor-frame', name: '专属头像框', amount: 1 });
        rewards.push({ type: 'currency', id: 'mandate', name: '天命', amount: 3000 });
        rewards.push({ type: 'fragment', id: 'mythic-hero-frag', name: '神话武将碎片', amount: 10 });
        break;
      case 'A':
        rewards.push({ type: 'title', id: 'title-hegemon', name: '霸主称号', amount: 1 });
        rewards.push({ type: 'currency', id: 'mandate', name: '天命', amount: 2000 });
        rewards.push({ type: 'blueprint', id: 'legendary-equip-bp', name: '传说装备图纸', amount: 3 });
        break;
      case 'B':
        rewards.push({ type: 'title', id: 'title-warlord', name: '诸侯称号', amount: 1 });
        rewards.push({ type: 'currency', id: 'mandate', name: '天命', amount: 1000 });
        break;
      case 'C':
      default:
        rewards.push({ type: 'title', id: 'title-hero', name: '英雄称号', amount: 1 });
        rewards.push({ type: 'currency', id: 'mandate', name: '天命', amount: 500 });
        break;
    }

    return rewards;
  }

  /**
   * 获取最终关卡通关奖励加成
   *
   * 最终关卡通关时额外奖励，含星级加成。
   *
   * @param stars - 通关星级（0~3）
   */
  getFinalStageBonus(stars: number = 3): { bonusGold: number; bonusGrain: number; bonusMandate: number; starMultiplier: number } {
    const starMultiplier = Math.max(1, stars);
    return {
      bonusGold: 5000 * starMultiplier,
      bonusGrain: 8000 * starMultiplier,
      bonusMandate: 100 * starMultiplier,
      starMultiplier,
    };
  }

  /** ISubsystem.getState — 返回状态快照 */
  getState(): { name: string } {
    return { name: this.name };
  }

  /** ISubsystem.reset — 无状态需要重置 */
  reset(): void {
    // 奖励分发器无持久状态，无需重置
  }
}
