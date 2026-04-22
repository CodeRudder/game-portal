/**
 * 引擎层 — 转生系统
 *
 * 管理转生条件、倍率、保留/重置规则、加速效果。
 * v16.0 深化功能已拆分至 RebirthSystem.helpers.ts。
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
} from '../../core/prestige';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
} from '../../core/prestige';
import {
  getInitialGift,
  getInstantBuildConfig,
  calculateBuildTime,
  getAutoRebuildPlan,
  getUnlockContentsV16,
  isFeatureUnlocked,
  generatePrestigeGrowthCurve,
  compareRebirthTiming,
  simulateEarningsV16,
} from './RebirthSystem.helpers';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

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
    this.deps.eventBus.on('calendar:dayChanged', () => this.tickAcceleration());
  }

  update(_dt: number): void { /* 转生系统不依赖帧更新 */ }

  getState(): RebirthState { return { ...this.state }; }

  reset(): void { this.state = createInitialRebirthState(); }

  // ─── 配置回调 ───────────────────────────

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
    if (callbacks.prestigeLevel) this.prestigeLevel = callbacks.prestigeLevel();
    this.resetCallback = callbacks.onReset;
  }

  updatePrestigeLevel(level: number): void { this.prestigeLevel = level; }

  // ─── 公开 API ───────────────────────────

  /** 检查转生条件 (#8) */
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
      prestigeLevel: { required: REBIRTH_CONDITIONS.minPrestigeLevel, current: this.prestigeLevel, met: this.prestigeLevel >= REBIRTH_CONDITIONS.minPrestigeLevel },
      castleLevel: { required: REBIRTH_CONDITIONS.minCastleLevel, current: castleLevel, met: castleLevel >= REBIRTH_CONDITIONS.minCastleLevel },
      heroCount: { required: REBIRTH_CONDITIONS.minHeroCount, current: heroCount, met: heroCount >= REBIRTH_CONDITIONS.minHeroCount },
      totalPower: { required: REBIRTH_CONDITIONS.minTotalPower, current: totalPower, met: totalPower >= REBIRTH_CONDITIONS.minTotalPower },
    };

    return { canRebirth: Object.values(conditions).every(c => c.met), conditions };
  }

  /** 执行转生 (#9, #10, #11) */
  executeRebirth(): {
    success: boolean; reason?: string; newCount?: number; multiplier?: number; acceleration?: RebirthAcceleration;
  } {
    const check = this.checkRebirthConditions();
    if (!check.canRebirth) {
      const unmet = Object.entries(check.conditions).filter(([, v]) => !v.met).map(([k, v]) => `${k}: ${v.current}/${v.required}`).join(', ');
      return { success: false, reason: `条件不满足: ${unmet}` };
    }

    if (this.resetCallback) this.resetCallback([...REBIRTH_RESET_RULES]);

    const newCount = this.state.rebirthCount + 1;
    const multiplier = calcRebirthMultiplier(newCount);

    const record: RebirthRecord = { rebirthCount: newCount, prestigeLevelBefore: this.prestigeLevel, multiplier, timestamp: Date.now() };
    this.state.rebirthCount = newCount;
    this.state.currentMultiplier = multiplier;
    this.state.rebirthRecords.push(record);
    this.state.accelerationDaysLeft = REBIRTH_ACCELERATION.durationDays;

    this.deps.eventBus.emit(`${EVENT_PREFIX}:completed`, { count: newCount, multiplier, acceleration: REBIRTH_ACCELERATION });

    return { success: true, newCount, multiplier, acceleration: REBIRTH_ACCELERATION };
  }

  getCurrentMultiplier(): number { return this.state.currentMultiplier; }
  getNextMultiplier(): number { return calcRebirthMultiplier(this.state.rebirthCount + 1); }
  getKeepRules(): string[] { return [...REBIRTH_KEEP_RULES]; }
  getResetRules(): string[] { return [...REBIRTH_RESET_RULES]; }

  getAcceleration(): { active: boolean; daysLeft: number; config: RebirthAcceleration } {
    return { active: this.state.accelerationDaysLeft > 0, daysLeft: this.state.accelerationDaysLeft, config: REBIRTH_ACCELERATION };
  }

  getEffectiveMultipliers(): { buildSpeed: number; techSpeed: number; resource: number; exp: number } {
    const base = this.state.currentMultiplier;
    const accel = this.state.accelerationDaysLeft > 0 ? REBIRTH_ACCELERATION : null;
    return {
      buildSpeed: base * (accel?.buildSpeedMultiplier ?? 1),
      techSpeed: base * (accel?.techSpeedMultiplier ?? 1),
      resource: base * (accel?.resourceMultiplier ?? 1),
      exp: base * (accel?.expMultiplier ?? 1),
    };
  }

  getUnlockContents(): RebirthUnlockContent[] {
    return REBIRTH_UNLOCK_CONTENTS.map(c => ({ ...c, unlocked: this.state.rebirthCount >= c.requiredRebirthCount }));
  }

  getUnlockedContents(): RebirthUnlockContent[] {
    return REBIRTH_UNLOCK_CONTENTS.filter(c => this.state.rebirthCount >= c.requiredRebirthCount);
  }

  /** 收益模拟器 (#13) */
  simulateEarnings(params: SimulationParams): SimulationResult {
    const nextMultiplier = calcRebirthMultiplier(params.currentRebirthCount + 1);
    const baseDailyGold = 100 * params.dailyOnlineHours;
    const baseDailyGrain = 50 * params.dailyOnlineHours;
    const baseDailyPrestige = 20 * params.dailyOnlineHours;

    const accelDays = Math.min(params.simulateDays, REBIRTH_ACCELERATION.durationDays);
    const normalDays = Math.max(0, params.simulateDays - accelDays);

    const accelGold = baseDailyGold * nextMultiplier * REBIRTH_ACCELERATION.resourceMultiplier * accelDays;
    const normalGold = baseDailyGold * nextMultiplier * normalDays;
    const accelGrain = baseDailyGrain * nextMultiplier * REBIRTH_ACCELERATION.resourceMultiplier * accelDays;
    const normalGrain = baseDailyGrain * nextMultiplier * normalDays;

    const totalPrestige = baseDailyPrestige * params.simulateDays;
    const estimatedLevelUps = Math.floor(totalPrestige / 500);

    return {
      estimatedResources: { gold: Math.floor(accelGold + normalGold), grain: Math.floor(accelGrain + normalGrain) },
      estimatedPrestigeGain: Math.floor(totalPrestige),
      estimatedLevelUps,
      rebirthAccelerationBonus: { gold: Math.floor(accelGold), grain: Math.floor(accelGrain) },
      days: params.simulateDays,
    };
  }

  getRebirthRecords(): RebirthRecord[] { return [...this.state.rebirthRecords]; }

  // ─── 存档 ───────────────────────────────

  loadSaveData(data: { rebirth: RebirthState }): void { this.state = { ...data.rebirth }; }

  // ─── v16.0 委托方法 ─────────────────────

  getInitialGift(): RebirthInitialGift { return getInitialGift(); }
  getInstantBuildConfig(): RebirthInstantBuild { return getInstantBuildConfig(); }
  calculateBuildTime(baseTimeSeconds: number, buildingLevel: number): number {
    return calculateBuildTime(baseTimeSeconds, buildingLevel, this.state.currentMultiplier, this.state.accelerationDaysLeft);
  }
  getAutoRebuildPlan(): string[] | null { return getAutoRebuildPlan(this.state.rebirthCount); }
  getUnlockContentsV16(): Array<RebirthUnlockContentV16 & { unlocked: boolean }> { return getUnlockContentsV16(this.state.rebirthCount); }
  getUnlockedContentsV16(): Array<RebirthUnlockContentV16 & { unlocked: boolean }> { return getUnlockContentsV16(this.state.rebirthCount).filter(c => c.unlocked); }
  isFeatureUnlocked(unlockId: string): boolean { return isFeatureUnlocked(unlockId, this.state.rebirthCount); }
  generatePrestigeGrowthCurve(params: SimulationParams) { return generatePrestigeGrowthCurve(params); }
  compareRebirthTiming(currentRebirthCount: number, waitHoursOptions?: number[]) { return compareRebirthTiming(currentRebirthCount, waitHoursOptions); }
  simulateEarningsV16(params: SimulationParams): SimulationResultV16 {
    const baseResult = this.simulateEarnings(params);
    return simulateEarningsV16(params, baseResult);
  }

  // ─── 内部方法 ───────────────────────────

  private tickAcceleration(): void {
    if (this.state.accelerationDaysLeft > 0) {
      this.state.accelerationDaysLeft--;
      if (this.state.accelerationDaysLeft === 0) {
        this.deps.eventBus.emit(`${EVENT_PREFIX}:accelerationEnded`, { rebirthCount: this.state.rebirthCount });
      }
    }
  }
}
