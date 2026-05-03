/**
 * 建筑域 — 建筑进化系统
 *
 * 职责：管理建筑星级进化（1星→2星→3星）
 * 进化后等级重置至Lv15，解锁新等级上限，获得星级加成
 * 进化后72小时保护期，Lv15→20升级速度+50%
 *
 * @module engine/building/EvolutionSystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 进化阶段配置 */
export interface EvolutionStage {
  /** 星级 (1/2/3) */
  stage: number;
  /** 该星级对应的等级上限 */
  maxLevel: number;
  /** 进化所需材料 */
  materialCost: {
    ore: number;
    wood: number;
    gold: number;
  };
  /** 星级加成百分比 */
  starBonus: number;
}

/** 建筑进化状态 */
interface BuildingEvolutionState {
  /** 当前星级 (0=未进化) */
  stage: number;
  /** 进化时间戳 (ms)，用于保护期计算 */
  evolutionTime: number | null;
}

/** 进化系统序列化数据 */
export interface EvolutionSaveData {
  /** 版本号 */
  version: number;
  /** 各建筑进化状态 */
  states: Record<string, BuildingEvolutionState>;
}

/** 进化可行性检查结果 */
export interface CanEvolveResult {
  canEvolve: boolean;
  reason?: string;
}

/** 进化执行结果 */
export interface EvolveResult {
  success: boolean;
  newLevel: number;
  newMaxLevel: number;
  starBonus: number;
  reason?: string;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 进化阶段配置表 */
export const EVOLUTION_STAGES: EvolutionStage[] = [
  { stage: 1, maxLevel: 30, materialCost: { ore: 5000, wood: 5000, gold: 50000 }, starBonus: 0.10 },
  { stage: 2, maxLevel: 35, materialCost: { ore: 15000, wood: 15000, gold: 150000 }, starBonus: 0.12 },
  { stage: 3, maxLevel: 40, materialCost: { ore: 50000, wood: 50000, gold: 500000 }, starBonus: 0.15 },
];

/** 未进化时的默认等级上限 */
const DEFAULT_MAX_LEVEL = 20;

/** 进化后重置到的等级 */
const EVOLUTION_RESET_LEVEL = 15;

/** 保护期时长 (ms)：72小时 */
const PROTECTION_DURATION_MS = 72 * 60 * 60 * 1000;

/** 加速恢复范围：Lv15→20 */
const ACCELERATED_RECOVERY_MIN = 15;
const ACCELERATED_RECOVERY_MAX = 20;

/** 加速恢复速度加成：+50% */
const ACCELERATED_RECOVERY_BONUS = 0.5;

// ─────────────────────────────────────────────
// 进化系统类
// ─────────────────────────────────────────────

/**
 * 建筑进化系统
 *
 * 通过回调获取建筑等级和资源，不直接依赖其他系统
 */
export class EvolutionSystem {
  // 外部回调
  private getBuildingLevel: (type: string) => number = () => 0;
  private getResource: (type: string) => number = () => 0;
  private spendResource: (type: string, amount: number) => boolean = () => false;

  // 内部状态：各建筑进化信息
  private states: Record<string, BuildingEvolutionState> = {};

  // 可注入的当前时间（便于测试）
  private _now: (() => number) | null = null;

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 初始化进化系统
   * @param getBuildingLevel 获取建筑等级的回调
   * @param getResource 获取资源数量的回调
   * @param spendResource 消耗资源的回调，返回是否成功
   */
  init(
    getBuildingLevel: (type: string) => number,
    getResource: (type: string) => number,
    spendResource: (type: string, amount: number) => boolean,
  ): void {
    this.getBuildingLevel = getBuildingLevel;
    this.getResource = getResource;
    this.spendResource = spendResource;
    this.states = {};
  }

  // ─────────────────────────────────────────
  // 进化操作
  // ─────────────────────────────────────────

  /**
   * 检查建筑是否可以进化
   * 条件：建筑达到当前星级对应的等级上限
   */
  canEvolve(buildingType: string): CanEvolveResult {
    const state = this.getOrCreateState(buildingType);
    const currentStage = state.stage;
    const nextStageIndex = currentStage; // stage 0 → index 0 (stage 1)

    // 已达最高星级
    if (nextStageIndex >= EVOLUTION_STAGES.length) {
      return { canEvolve: false, reason: '已达最高星级' };
    }

    // 检查建筑等级是否达到当前上限
    const currentMaxLevel = this.getMaxLevelForStage(currentStage);
    const buildingLevel = this.getBuildingLevel(buildingType);

    if (buildingLevel < currentMaxLevel) {
      return {
        canEvolve: false,
        reason: `建筑等级需达到${currentMaxLevel}级，当前${buildingLevel}级`,
      };
    }

    // 检查材料是否充足
    const nextStage = EVOLUTION_STAGES[nextStageIndex];
    const cost = nextStage.materialCost;
    if (this.getResource('ore') < cost.ore) {
      return { canEvolve: false, reason: '矿石不足' };
    }
    if (this.getResource('wood') < cost.wood) {
      return { canEvolve: false, reason: '木材不足' };
    }
    if (this.getResource('gold') < cost.gold) {
      return { canEvolve: false, reason: '金币不足' };
    }

    return { canEvolve: true };
  }

  /**
   * 执行进化
   * 扣材料 → 等级重置至Lv15 → 新上限 → 星级加成
   */
  evolve(buildingType: string): EvolveResult {
    const check = this.canEvolve(buildingType);
    if (!check.canEvolve) {
      return {
        success: false,
        newLevel: this.getBuildingLevel(buildingType),
        newMaxLevel: this.getMaxLevelForStage(this.getEvolutionStage(buildingType)),
        starBonus: this.getStarBonus(buildingType),
        reason: check.reason,
      };
    }

    const state = this.getOrCreateState(buildingType);
    const nextStageIndex = state.stage;
    const nextStage = EVOLUTION_STAGES[nextStageIndex];

    // 扣除材料
    const cost = nextStage.materialCost;
    const oreOk = this.spendResource('ore', cost.ore);
    if (!oreOk) {
      return {
        success: false,
        newLevel: this.getBuildingLevel(buildingType),
        newMaxLevel: this.getMaxLevelForStage(state.stage),
        starBonus: this.getStarBonus(buildingType),
        reason: '矿石扣除失败',
      };
    }
    const woodOk = this.spendResource('wood', cost.wood);
    if (!woodOk) {
      return {
        success: false,
        newLevel: this.getBuildingLevel(buildingType),
        newMaxLevel: this.getMaxLevelForStage(state.stage),
        starBonus: this.getStarBonus(buildingType),
        reason: '木材扣除失败',
      };
    }
    const goldOk = this.spendResource('gold', cost.gold);
    if (!goldOk) {
      return {
        success: false,
        newLevel: this.getBuildingLevel(buildingType),
        newMaxLevel: this.getMaxLevelForStage(state.stage),
        starBonus: this.getStarBonus(buildingType),
        reason: '金币扣除失败',
      };
    }

    // 更新进化状态
    state.stage = nextStage.stage;
    state.evolutionTime = this.now();

    return {
      success: true,
      newLevel: EVOLUTION_RESET_LEVEL,
      newMaxLevel: nextStage.maxLevel,
      starBonus: nextStage.starBonus,
    };
  }

  // ─────────────────────────────────────────
  // 状态查询
  // ─────────────────────────────────────────

  /**
   * 获取建筑当前进化星级
   * @returns 0=未进化, 1/2/3=对应星级
   */
  getEvolutionStage(buildingType: string): number {
    const state = this.states[buildingType];
    return state?.stage ?? 0;
  }

  /**
   * 获取建筑星级加成
   */
  getStarBonus(buildingType: string): number {
    const stage = this.getEvolutionStage(buildingType);
    if (stage === 0) return 0;
    const stageConfig = EVOLUTION_STAGES[stage - 1];
    return stageConfig?.starBonus ?? 0;
  }

  /**
   * 获取进化保护期剩余时间 (ms)
   * 进化后72小时内受保护
   */
  getProtectionRemaining(buildingType: string): number {
    const state = this.states[buildingType];
    if (!state || !state.evolutionTime) return 0;

    const elapsed = this.now() - state.evolutionTime;
    const remaining = PROTECTION_DURATION_MS - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * 获取加速恢复加成
   * 进化后 Lv15→20 升级速度+50%
   * @param buildingType 建筑类型
   * @param targetLevel 目标等级
   * @returns 速度加成百分比（0 或 0.5）
   */
  getAcceleratedRecovery(buildingType: string, targetLevel: number): number {
    const state = this.states[buildingType];
    if (!state || state.stage === 0 || !state.evolutionTime) return 0;

    // 只在保护期内有效
    if (this.getProtectionRemaining(buildingType) <= 0) return 0;

    // 只对 Lv15→20 范围有效
    if (targetLevel >= ACCELERATED_RECOVERY_MIN && targetLevel <= ACCELERATED_RECOVERY_MAX) {
      return ACCELERATED_RECOVERY_BONUS;
    }

    return 0;
  }

  /**
   * 获取当前星级对应的等级上限
   */
  getMaxLevel(buildingType: string): number {
    const stage = this.getEvolutionStage(buildingType);
    return this.getMaxLevelForStage(stage);
  }

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  serialize(): EvolutionSaveData {
    return {
      version: 1,
      states: JSON.parse(JSON.stringify(this.states)),
    };
  }

  deserialize(data: EvolutionSaveData): void {
    if (data && data.states) {
      this.states = JSON.parse(JSON.stringify(data.states));
    }
  }

  reset(): void {
    this.states = {};
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 获取或创建建筑进化状态
   */
  private getOrCreateState(buildingType: string): BuildingEvolutionState {
    if (!this.states[buildingType]) {
      this.states[buildingType] = { stage: 0, evolutionTime: null };
    }
    return this.states[buildingType];
  }

  /**
   * 根据星级获取等级上限
   */
  private getMaxLevelForStage(stage: number): number {
    if (stage === 0) return DEFAULT_MAX_LEVEL;
    const stageConfig = EVOLUTION_STAGES[stage - 1];
    return stageConfig?.maxLevel ?? DEFAULT_MAX_LEVEL;
  }

  /**
   * 获取当前时间戳
   */
  private now(): number {
    return this._now ? this._now() : Date.now();
  }

  /**
   * 注入时间函数（测试用）
   */
  _setNow(fn: () => number): void {
    this._now = fn;
  }
}
