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
  REBIRTH_COOLDOWN_MS,
  // PRS-P1-01 fix: 使用声望域本地的转生倍率计算，消除对 unification 的跨域依赖
  calcRebirthMultiplierFromConfig,
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
 *
 * PRS-P1-01 fix: 委托给 core/prestige 域的 calcRebirthMultiplierFromConfig，
 * 使用 REBIRTH_MULTIPLIER 常量构建配置，保持向后兼容的单参数签名。
 * 不再跨域引用 unification/BalanceUtils。
 */
export function calcRebirthMultiplier(count: number): number {
  return calcRebirthMultiplierFromConfig(count);
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
    lastRebirthTimestamp: 0,
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

  /** 时间提供函数（默认 Date.now，测试可注入） */
  private nowProvider: () => number = () => Date.now();

  /** 外部状态查询回调 */
  private castleLevelCallback?: () => number;
  private heroCountCallback?: () => number;
  private totalPowerCallback?: () => number;
  private resetCallback?: (rules: string[]) => void;
  /** 通关进度回调：返回当前已通关的最高阶段编号 */
  private campaignStageCallback?: () => number;
  /** 成就链完成数量回调：返回指定成就链已完成的子成就数量 */
  private achievementChainCountCallback?: () => number;

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
    /** 通关进度回调：返回当前已通关的最高阶段编号 */
    campaignStage?: () => number;
    /** 成就链完成数量回调：返回"初露锋芒"成就链已完成的子成就数量 */
    achievementChainCount?: () => number;
    /** 时间提供函数（默认 Date.now，测试可注入以模拟时间流逝） */
    nowProvider?: () => number;
  }): void {
    this.castleLevelCallback = callbacks.castleLevel;
    this.heroCountCallback = callbacks.heroCount;
    this.totalPowerCallback = callbacks.totalPower;
    if (callbacks.prestigeLevel) this.prestigeLevel = callbacks.prestigeLevel();
    this.resetCallback = callbacks.onReset;
    this.campaignStageCallback = callbacks.campaignStage;
    this.achievementChainCountCallback = callbacks.achievementChainCount;
    if (callbacks.nowProvider) this.nowProvider = callbacks.nowProvider;
  }

  updatePrestigeLevel(level: number): void { this.prestigeLevel = level; }

  // ─── 公开 API ───────────────────────────

  /** 检查转生条件 (#8) — 含PRD全部6项条件 + 冷却 */
  checkRebirthConditions(): {
    canRebirth: boolean;
    conditions: {
      prestigeLevel: { required: number; current: number; met: boolean };
      castleLevel: { required: number; current: number; met: boolean };
      heroCount: { required: number; current: number; met: boolean };
      totalPower: { required: number; current: number; met: boolean };
      campaignProgress: { required: number; current: number; met: boolean };
      achievementChain: { required: number; current: number; met: boolean; chainId: string };
      cooldown: { met: boolean; remainingMs: number; description: string };
    };
  } {
    const castleLevel = this.castleLevelCallback?.() ?? 0;
    const heroCount = this.heroCountCallback?.() ?? 0;
    const totalPower = this.totalPowerCallback?.() ?? 0;
    const campaignStage = this.campaignStageCallback?.() ?? 0;
    const achievementChainCount = this.achievementChainCountCallback?.() ?? 0;

    // 冷却检查：首次转生（rebirthCount === 0）无冷却限制
    const lastTs = this.state.lastRebirthTimestamp ?? 0;
    const isFirstRebirth = this.state.rebirthCount === 0;
    const now = this.nowProvider();
    const elapsed = now - lastTs;
    const cooldownMet = isFirstRebirth || lastTs === 0 || elapsed >= REBIRTH_COOLDOWN_MS;
    const remainingMs = cooldownMet ? 0 : Math.max(0, REBIRTH_COOLDOWN_MS - elapsed);

    const conditions = {
      prestigeLevel: { required: REBIRTH_CONDITIONS.minPrestigeLevel, current: this.prestigeLevel, met: this.prestigeLevel >= REBIRTH_CONDITIONS.minPrestigeLevel },
      castleLevel: { required: REBIRTH_CONDITIONS.minCastleLevel, current: castleLevel, met: castleLevel >= REBIRTH_CONDITIONS.minCastleLevel },
      heroCount: { required: REBIRTH_CONDITIONS.minHeroCount, current: heroCount, met: heroCount >= REBIRTH_CONDITIONS.minHeroCount },
      totalPower: { required: REBIRTH_CONDITIONS.minTotalPower, current: totalPower, met: totalPower >= REBIRTH_CONDITIONS.minTotalPower },
      campaignProgress: { required: REBIRTH_CONDITIONS.minCampaignStage, current: campaignStage, met: campaignStage >= REBIRTH_CONDITIONS.minCampaignStage },
      achievementChain: {
        required: REBIRTH_CONDITIONS.requiredAchievementChainCount,
        current: achievementChainCount,
        met: achievementChainCount >= REBIRTH_CONDITIONS.requiredAchievementChainCount,
        chainId: REBIRTH_CONDITIONS.requiredAchievementChainId,
      },
      cooldown: {
        met: cooldownMet,
        remainingMs,
        description: isFirstRebirth || lastTs === 0
          ? '首次转生无冷却限制'
          : cooldownMet
            ? '冷却已完成'
            : `冷却中，剩余 ${this.formatCooldownRemaining(remainingMs)}`,
      },
    };

    // 前6项条件必须全部满足，冷却也必须通过
    const allConditionsMet = [
      conditions.prestigeLevel,
      conditions.castleLevel,
      conditions.heroCount,
      conditions.totalPower,
      conditions.campaignProgress,
      conditions.achievementChain,
      conditions.cooldown,
    ].every(c => c.met);

    return { canRebirth: allConditionsMet, conditions };
  }

  /** 执行转生 (#9, #10, #11) */
  executeRebirth(): {
    success: boolean; reason?: string; newCount?: number; multiplier?: number; acceleration?: RebirthAcceleration;
  } {
    const check = this.checkRebirthConditions();
    if (!check.canRebirth) {
      const unmet = Object.entries(check.conditions)
        .filter(([, v]) => typeof v === 'object' && 'met' in v && !v.met)
        .map(([k, v]) => {
          const cond = v as { current?: number; required?: number; description?: string };
          if (k === 'cooldown') return `${k}: ${cond.description}`;
          return `${k}: ${cond.current}/${cond.required}`;
        })
        .join(', ');
      return { success: false, reason: `条件不满足: ${unmet}` };
    }

    if (this.resetCallback) this.resetCallback([...REBIRTH_RESET_RULES]);

    const now = this.nowProvider();
    const newCount = this.state.rebirthCount + 1;
    const multiplier = calcRebirthMultiplier(newCount);

    const record: RebirthRecord = { rebirthCount: newCount, prestigeLevelBefore: this.prestigeLevel, multiplier, timestamp: now };
    this.state.rebirthCount = newCount;
    this.state.currentMultiplier = multiplier;
    this.state.rebirthRecords.push(record);
    this.state.accelerationDaysLeft = REBIRTH_ACCELERATION.durationDays;
    this.state.lastRebirthTimestamp = now;

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

  // ─── 冷却查询 API ──────────────────────

  /** 获取冷却剩余毫秒数（0表示冷却已完成或首次无冷却） */
  getCooldownRemainingMs(): number {
    const lastTs = this.state.lastRebirthTimestamp ?? 0;
    // 首次转生或旧存档无时间戳 → 无冷却
    if (lastTs === 0) return 0;
    const elapsed = this.nowProvider() - lastTs;
    return Math.max(0, REBIRTH_COOLDOWN_MS - elapsed);
  }

  /** 冷却是否激活中 */
  isCooldownActive(): boolean {
    // 首次转生无冷却
    if (this.state.rebirthCount === 0) return false;
    return this.getCooldownRemainingMs() > 0;
  }

  /** 格式化冷却剩余时间为 HH:MM:SS */
  private formatCooldownRemaining(remainingMs: number): string {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // ─── 存档 ───────────────────────────────

  loadSaveData(data: { rebirth: RebirthState }): void {
    // FIX-504: null防护
    if (!data || !data.rebirth) return;
    // 合并默认值 + 存档数据（含向后兼容 lastRebirthTimestamp: 0）
    const loaded = { ...createInitialRebirthState(), ...data.rebirth };
    // FIX-504: 关键字段NaN防护
    loaded.rebirthCount = Number.isFinite(loaded.rebirthCount) && loaded.rebirthCount >= 0 ? loaded.rebirthCount : 0;
    loaded.currentMultiplier = Number.isFinite(loaded.currentMultiplier) && loaded.currentMultiplier > 0 ? loaded.currentMultiplier : 1.0;
    loaded.accelerationDaysLeft = Number.isFinite(loaded.accelerationDaysLeft) && loaded.accelerationDaysLeft >= 0 ? loaded.accelerationDaysLeft : 0;
    loaded.rebirthRecords = Array.isArray(loaded.rebirthRecords) ? loaded.rebirthRecords : [];
    loaded.completedRebirthQuests = Array.isArray(loaded.completedRebirthQuests) ? loaded.completedRebirthQuests : [];
    loaded.rebirthQuestProgress = loaded.rebirthQuestProgress && typeof loaded.rebirthQuestProgress === 'object' ? loaded.rebirthQuestProgress : {};
    // 向后兼容：旧存档无 lastRebirthTimestamp 字段时，从最后一条转生记录推算
    if (loaded.lastRebirthTimestamp === undefined && loaded.rebirthRecords.length > 0) {
      loaded.lastRebirthTimestamp = loaded.rebirthRecords[loaded.rebirthRecords.length - 1].timestamp;
    }
    this.state = loaded;
  }

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
