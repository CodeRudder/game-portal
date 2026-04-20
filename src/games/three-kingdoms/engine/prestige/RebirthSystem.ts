/**
 * 引擎层 — 转生系统
 *
 * 管理转生条件、倍率、保留/重置规则、加速效果：
 *   #8 转生解锁条件 — 声望等级20 + 主城10级 + 武将5 + 战力10000
 *   #9 转生倍率公式 — base + count × perRebirth, 上限max
 *   #10 保留/重置规则 — 6项保留 + 5项重置
 *   #11 转生后加速 — 建筑/科技/资源/经验加速，持续7天
 *   #12 次数解锁内容 — 转生1/2/3/5/7/10次解锁
 *   #13 收益模拟器 — 预估转生后收益
 *   #18 转生后加速机制(v16.0) — 初始资源赠送+低级建筑瞬间+一键重建
 *   #19 转生次数解锁内容(v16.0) — 天命/专属科技/神话武将/跨服
 *   #20 收益模拟器深化(v16.0) — 声望增长预测+推荐转生时机+倍率对比
 *
 * @module engine/prestige/RebirthSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  RebirthState,
  RebirthRecord,
  RebirthAcceleration,
  RebirthUnlockContent,
  SimulationParams,
  SimulationResult,
  RebirthInitialGift,
  RebirthInstantBuild,
  RebirthUnlockContentV16,
  SimulationResultV16,
  RebirthSimulationComparison,
} from '../../core/prestige';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
  PRESTIGE_SAVE_VERSION,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_UNLOCK_CONTENTS_V16,
  SIMULATION_DIMINISHING_RETURNS_HOUR,
} from '../../core/prestige';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 转生事件前缀 */
const EVENT_PREFIX = 'rebirth';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/**
 * 计算转生倍率 (#9)
 * 公式: min(base + count × perRebirth, max)
 */
export function calcRebirthMultiplier(count: number): number {
  const raw = REBIRTH_MULTIPLIER.base + count * REBIRTH_MULTIPLIER.perRebirth;
  return Math.min(raw, REBIRTH_MULTIPLIER.max);
}

/** 创建初始转生状态 */
function createInitialRebirthState(): RebirthState {
  return {
    rebirthCount: 0,
    currentMultiplier: 1.0,
    rebirthRecords: [],
    accelerationDaysLeft: 0,
    completedRebirthQuests: [],
    rebirthQuestProgress: {},
  };
}

// ─────────────────────────────────────────────
// RebirthSystem 类
// ─────────────────────────────────────────────

/**
 * 转生系统
 *
 * 管理转生条件检查、倍率计算、保留/重置规则和加速效果。
 */
export class RebirthSystem implements ISubsystem {
  readonly name = 'rebirth';

  private deps!: ISystemDeps;
  private state: RebirthState = createInitialRebirthState();
  private prestigeLevel = 1;

  /** 外部状态查询回调 */
  private castleLevelCallback?: () => number;
  private heroCountCallback?: () => number;
  private totalPowerCallback?: () => number;
  private resetCallback?: (rules: string[]) => void;

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;

    // 监听每日更新（减少加速天数）
    this.deps.eventBus.on('calendar:dayChanged', () => this.tickAcceleration());
  }

  update(_dt: number): void {
    // 转生系统不依赖帧更新
  }

  getState(): RebirthState {
    return { ...this.state };
  }

  reset(): void {
    this.state = createInitialRebirthState();
  }

  // ─── 配置回调 ───────────────────────────

  /** 设置外部状态查询回调 */
  setCallbacks(callbacks: {
    castleLevel?: () => number;
    heroCount?: () => number;
    totalPower?: () => number;
    prestigeLevel?: () => number;
    onReset?: (rules: string[]) => void;
  }): void {
    this.castleLevelCallback = callbacks.castleLevel;
    this.heroCountCallback = callbacks.heroCount;
    this.totalPowerCallback = callbacks.totalPower;
    if (callbacks.prestigeLevel) {
      const cb = callbacks.prestigeLevel;
      this.prestigeLevel = cb();
    }
    this.resetCallback = callbacks.onReset;
  }

  /** 更新声望等级（由PrestigeSystem调用） */
  updatePrestigeLevel(level: number): void {
    this.prestigeLevel = level;
  }

  // ─── 公开 API ───────────────────────────

  /**
   * 检查转生条件 (#8)
   * @returns 满足的条件和未满足的条件
   */
  checkRebirthConditions(): {
    canRebirth: boolean;
    conditions: {
      prestigeLevel: { required: number; current: number; met: boolean };
      castleLevel: { required: number; current: number; met: boolean };
      heroCount: { required: number; current: number; met: boolean };
      totalPower: { required: number; current: number; met: boolean };
    };
  } {
    const castleLevel = this.castleLevelCallback?.() ?? 0;
    const heroCount = this.heroCountCallback?.() ?? 0;
    const totalPower = this.totalPowerCallback?.() ?? 0;

    const conditions = {
      prestigeLevel: {
        required: REBIRTH_CONDITIONS.minPrestigeLevel,
        current: this.prestigeLevel,
        met: this.prestigeLevel >= REBIRTH_CONDITIONS.minPrestigeLevel,
      },
      castleLevel: {
        required: REBIRTH_CONDITIONS.minCastleLevel,
        current: castleLevel,
        met: castleLevel >= REBIRTH_CONDITIONS.minCastleLevel,
      },
      heroCount: {
        required: REBIRTH_CONDITIONS.minHeroCount,
        current: heroCount,
        met: heroCount >= REBIRTH_CONDITIONS.minHeroCount,
      },
      totalPower: {
        required: REBIRTH_CONDITIONS.minTotalPower,
        current: totalPower,
        met: totalPower >= REBIRTH_CONDITIONS.minTotalPower,
      },
    };

    const canRebirth = Object.values(conditions).every((c) => c.met);

    return { canRebirth, conditions };
  }

  /**
   * 执行转生 (#9, #10, #11)
   * @returns 转生结果
   */
  executeRebirth(): {
    success: boolean;
    reason?: string;
    newCount?: number;
    multiplier?: number;
    acceleration?: RebirthAcceleration;
  } {
    // 检查条件
    const check = this.checkRebirthConditions();
    if (!check.canRebirth) {
      const unmet = Object.entries(check.conditions)
        .filter(([, v]) => !v.met)
        .map(([k, v]) => `${k}: ${v.current}/${v.required}`)
        .join(', ');
      return { success: false, reason: `条件不满足: ${unmet}` };
    }

    // 执行重置 (#10)
    if (this.resetCallback) {
      this.resetCallback([...REBIRTH_RESET_RULES]);
    }

    // 更新转生状态
    const newCount = this.state.rebirthCount + 1;
    const multiplier = calcRebirthMultiplier(newCount);

    const record: RebirthRecord = {
      rebirthCount: newCount,
      prestigeLevelBefore: this.prestigeLevel,
      multiplier,
      timestamp: Date.now(),
    };

    this.state.rebirthCount = newCount;
    this.state.currentMultiplier = multiplier;
    this.state.rebirthRecords.push(record);
    this.state.accelerationDaysLeft = REBIRTH_ACCELERATION.durationDays;

    // 发射转生事件
    this.deps.eventBus.emit(`${EVENT_PREFIX}:completed`, {
      count: newCount,
      multiplier,
      acceleration: REBIRTH_ACCELERATION,
    });

    return {
      success: true,
      newCount,
      multiplier,
      acceleration: REBIRTH_ACCELERATION,
    };
  }

  /** 获取当前转生倍率 (#9) */
  getCurrentMultiplier(): number {
    return this.state.currentMultiplier;
  }

  /** 获取预览倍率（下一次转生后） */
  getNextMultiplier(): number {
    return calcRebirthMultiplier(this.state.rebirthCount + 1);
  }

  /** 获取保留规则列表 (#10) */
  getKeepRules(): string[] {
    return [...REBIRTH_KEEP_RULES];
  }

  /** 获取重置规则列表 (#10) */
  getResetRules(): string[] {
    return [...REBIRTH_RESET_RULES];
  }

  /** 获取当前加速效果 (#11) */
  getAcceleration(): { active: boolean; daysLeft: number; config: RebirthAcceleration } {
    return {
      active: this.state.accelerationDaysLeft > 0,
      daysLeft: this.state.accelerationDaysLeft,
      config: REBIRTH_ACCELERATION,
    };
  }

  /** 计算当前加速倍率（含转生倍率叠加） (#11) */
  getEffectiveMultipliers(): {
    buildSpeed: number;
    techSpeed: number;
    resource: number;
    exp: number;
  } {
    const base = this.state.currentMultiplier;
    const accel = this.state.accelerationDaysLeft > 0 ? REBIRTH_ACCELERATION : null;

    return {
      buildSpeed: base * (accel?.buildSpeedMultiplier ?? 1),
      techSpeed: base * (accel?.techSpeedMultiplier ?? 1),
      resource: base * (accel?.resourceMultiplier ?? 1),
      exp: base * (accel?.expMultiplier ?? 1),
    };
  }

  /** 获取转生次数解锁内容 (#12) */
  getUnlockContents(): RebirthUnlockContent[] {
    return REBIRTH_UNLOCK_CONTENTS.map((c) => ({
      ...c,
      unlocked: this.state.rebirthCount >= c.requiredRebirthCount,
    }));
  }

  /** 获取已解锁内容 (#12) */
  getUnlockedContents(): RebirthUnlockContent[] {
    return REBIRTH_UNLOCK_CONTENTS.filter(
      (c) => this.state.rebirthCount >= c.requiredRebirthCount,
    );
  }

  /**
   * 收益模拟器 (#13)
   * 预估转生后指定天数内的收益
   */
  simulateEarnings(params: SimulationParams): SimulationResult {
    const nextMultiplier = calcRebirthMultiplier(params.currentRebirthCount + 1);
    const hasAcceleration = true; // 模拟假设有加速

    // 基础每日收益（简化模型）
    const baseDailyGold = 100 * params.dailyOnlineHours;
    const baseDailyGrain = 50 * params.dailyOnlineHours;
    const baseDailyPrestige = 20 * params.dailyOnlineHours;

    // 转生后加速期内收益
    const accelDays = Math.min(params.simulateDays, REBIRTH_ACCELERATION.durationDays);
    const normalDays = Math.max(0, params.simulateDays - accelDays);

    const accelGold = baseDailyGold * nextMultiplier * REBIRTH_ACCELERATION.resourceMultiplier * accelDays;
    const normalGold = baseDailyGold * nextMultiplier * normalDays;

    const accelGrain = baseDailyGrain * nextMultiplier * REBIRTH_ACCELERATION.resourceMultiplier * accelDays;
    const normalGrain = baseDailyGrain * nextMultiplier * normalDays;

    const totalPrestige = baseDailyPrestige * params.simulateDays;
    const estimatedLevelUps = Math.floor(totalPrestige / 500); // 简化估算

    return {
      estimatedResources: {
        gold: Math.floor(accelGold + normalGold),
        grain: Math.floor(accelGrain + normalGrain),
      },
      estimatedPrestigeGain: Math.floor(totalPrestige),
      estimatedLevelUps,
      rebirthAccelerationBonus: {
        gold: Math.floor(accelGold),
        grain: Math.floor(accelGrain),
      },
      days: params.simulateDays,
    };
  }

  /** 获取转生记录 */
  getRebirthRecords(): RebirthRecord[] {
    return [...this.state.rebirthRecords];
  }

  /** 更新转生任务进度 */
  updateRebirthQuestProgress(
    objectiveType: string,
    progress: number,
  ): void {
    const { REBIRTH_QUESTS } = require('../../core/prestige');
    for (const quest of REBIRTH_QUESTS) {
      if (this.state.completedRebirthQuests.includes(quest.id)) continue;
      if (quest.objectiveType === objectiveType) {
        this.state.rebirthQuestProgress[quest.id] = progress;
      }
    }
  }

  /** 检查转生任务完成 */
  checkRebirthQuestCompletion(questId: string): boolean {
    const { REBIRTH_QUESTS } = require('../../core/prestige');
    const quest = REBIRTH_QUESTS.find((q: any) => q.id === questId);
    if (!quest) return false;
    if (this.state.completedRebirthQuests.includes(questId)) return false;

    const progress = this.state.rebirthQuestProgress[questId] ?? 0;
    if (progress >= quest.targetCount) {
      this.state.completedRebirthQuests.push(questId);
      return true;
    }
    return false;
  }

  /** 加载存档 */
  loadSaveData(data: { rebirth: RebirthState }): void {
    this.state = { ...data.rebirth };
  }

  // ─── 内部方法 ───────────────────────────

  /** 每日减少加速天数 */
  private tickAcceleration(): void {
    if (this.state.accelerationDaysLeft > 0) {
      this.state.accelerationDaysLeft--;
      if (this.state.accelerationDaysLeft === 0) {
        this.deps.eventBus.emit(`${EVENT_PREFIX}:accelerationEnded`, {
          rebirthCount: this.state.rebirthCount,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // #18 转生后加速机制 (v16.0)
  // ─────────────────────────────────────────

  /** 获取转生后初始资源赠送 */
  getInitialGift(): RebirthInitialGift {
    return { ...REBIRTH_INITIAL_GIFT };
  }

  /** 获取低级建筑瞬间升级配置 */
  getInstantBuildConfig(): RebirthInstantBuild {
    return { ...REBIRTH_INSTANT_BUILD };
  }

  /** 计算建筑升级时间（含转生加速） */
  calculateBuildTime(baseTimeSeconds: number, buildingLevel: number): number {
    const multiplier = this.state.currentMultiplier;
    const accel = this.state.accelerationDaysLeft > 0 ? REBIRTH_ACCELERATION : null;

    // 低级建筑瞬间升级
    if (buildingLevel <= REBIRTH_INSTANT_BUILD.maxInstantLevel && accel) {
      return Math.max(1, Math.floor(baseTimeSeconds / REBIRTH_INSTANT_BUILD.speedDivisor));
    }

    // 正常加速
    const speedMul = multiplier * (accel?.buildSpeedMultiplier ?? 1);
    return Math.max(1, Math.floor(baseTimeSeconds / speedMul));
  }

  /** 一键重建（返回上次建筑优先级列表） */
  getAutoRebuildPlan(): string[] | null {
    if (this.state.rebirthCount === 0) return null;
    // 按标准优先级返回建筑类型列表
    return ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'];
  }

  // ─────────────────────────────────────────
  // #19 转生次数解锁内容 (v16.0)
  // ─────────────────────────────────────────

  /** 获取v16.0解锁内容列表 */
  getUnlockContentsV16(): RebirthUnlockContentV16[] {
    return REBIRTH_UNLOCK_CONTENTS_V16.map(c => ({
      ...c,
      unlocked: this.state.rebirthCount >= c.requiredRebirthCount,
    }));
  }

  /** 获取已解锁的v16.0内容 */
  getUnlockedContentsV16(): RebirthUnlockContentV16[] {
    return REBIRTH_UNLOCK_CONTENTS_V16.filter(
      c => this.state.rebirthCount >= c.requiredRebirthCount,
    );
  }

  /** 检查特定功能是否已解锁 */
  isFeatureUnlocked(unlockId: string): boolean {
    const content = REBIRTH_UNLOCK_CONTENTS_V16.find(c => c.unlockId === unlockId);
    if (!content) return false;
    return this.state.rebirthCount >= content.requiredRebirthCount;
  }

  // ─────────────────────────────────────────
  // #20 收益模拟器深化 (v16.0)
  // ─────────────────────────────────────────

  /** 生成声望增长预测曲线 */
  generatePrestigeGrowthCurve(params: SimulationParams): Array<{ day: number; prestige: number }> {
    const curve: Array<{ day: number; prestige: number }> = [];
    const nextMultiplier = calcRebirthMultiplier(params.currentRebirthCount + 1);
    const baseDailyPrestige = 20 * params.dailyOnlineHours;

    let accumulated = 0;
    for (let day = 0; day <= params.simulateDays; day++) {
      const isAccelDay = day <= REBIRTH_ACCELERATION.durationDays;
      const dayMultiplier = isAccelDay
        ? nextMultiplier * REBIRTH_ACCELERATION.resourceMultiplier
        : nextMultiplier;
      accumulated += baseDailyPrestige * dayMultiplier;
      curve.push({ day, prestige: Math.floor(accumulated) });
    }

    return curve;
  }

  /** 倍率对比：立即转生 vs 等待 */
  compareRebirthTiming(
    currentRebirthCount: number,
    waitHoursOptions: number[] = [0, 12, 24, 48, 72, 168],
  ): RebirthSimulationComparison[] {
    const immediateMultiplier = calcRebirthMultiplier(currentRebirthCount + 1);
    const results: RebirthSimulationComparison[] = [];

    for (const hours of waitHoursOptions) {
      // 等待期间可以继续积累声望，然后转生
      // 但等待太久边际收益递减
      const waitMultiplier = immediateMultiplier; // 倍率不变
      const currentMultiplier = calcRebirthMultiplier(currentRebirthCount);

      // 收益差异 = 等待期间用当前倍率产出 vs 立即转生用新倍率产出
      const currentRate = currentMultiplier;
      const newRate = immediateMultiplier;
      const hoursToBreakEven = hours > 0
        ? (hours * currentRate) / (newRate - currentRate || 1)
        : 0;

      let recommendedAction: 'rebirth_now' | 'wait' | 'no_difference';
      let confidence: 'high' | 'medium' | 'low';

      if (hours === 0) {
        recommendedAction = 'rebirth_now';
        confidence = 'high';
      } else if (hours <= SIMULATION_DIMINISHING_RETURNS_HOUR) {
        recommendedAction = newRate > currentRate * 1.2 ? 'rebirth_now' : 'no_difference';
        confidence = 'medium';
      } else {
        recommendedAction = 'wait';
        confidence = 'low';
      }

      results.push({
        immediateMultiplier,
        waitMultiplier,
        waitHours: hours,
        diminishingReturnsHour: SIMULATION_DIMINISHING_RETURNS_HOUR,
        recommendedAction,
        confidence,
      });
    }

    return results;
  }

  /** 完整收益模拟（v16.0 深化版） */
  simulateEarningsV16(params: SimulationParams): SimulationResultV16 {
    const baseResult = this.simulateEarnings(params);
    const prestigeGrowthCurve = this.generatePrestigeGrowthCurve(params);
    const comparisons = this.compareRebirthTiming(params.currentRebirthCount);

    // 找到最佳推荐
    const bestComparison = comparisons.find(c => c.recommendedAction === 'rebirth_now') ?? comparisons[0];
    const recommendation = bestComparison.recommendedAction === 'rebirth_now'
      ? '建议立即转生，当前收益已达到边际递减拐点'
      : bestComparison.recommendedAction === 'wait'
        ? `建议等待${bestComparison.waitHours}小时后转生`
        : '当前转生与等待收益相近，可根据需要选择';

    return {
      ...baseResult,
      prestigeGrowthCurve,
      comparison: bestComparison,
      recommendation,
    };
  }
}
