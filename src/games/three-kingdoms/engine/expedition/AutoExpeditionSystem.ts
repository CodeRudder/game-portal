/**
 * 自动远征系统 — 引擎层
 *
 * 职责：自动远征循环、离线远征收益计算、暂停恢复
 * 规则：
 *   - 自动远征：可设定重复次数，失败/背包满/兵力不足时暂停
 *   - 连续失败2次自动暂停
 *   - 离线远征：效率×0.85，时间上限72h，胜率修正×0.85
 *   - 离线远征按路线平均时长计算完成次数
 *
 * @module engine/expedition/AutoExpeditionSystem
 */

import type {
  ExpeditionState,
  ExpeditionTeam,
  ExpeditionReward,
  AutoExpeditionConfig,
  OfflineExpeditionResult,
  FormationType,
  BattleGrade,
} from '../../core/expedition/expedition.types';
import {
  NodeType,
  PauseReason,
  BattleGrade as BG,
  OFFLINE_EXPEDITION_CONFIG,
  TROOP_COST,
} from '../../core/expedition/expedition.types';
import { CONSECUTIVE_FAILURE_LIMIT } from './expedition-config';
import type { ExpeditionBattleSystem } from './ExpeditionBattleSystem';
import type { ExpeditionRewardSystem } from './ExpeditionRewardSystem';

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 自动远征单次循环结果 */
export interface AutoExpeditionStepResult {
  /** 是否成功通关 */
  success: boolean;
  /** 战斗评级 */
  grade: BattleGrade;
  /** 获得奖励 */
  reward: ExpeditionReward;
  /** 是否触发暂停 */
  paused: boolean;
  /** 暂停原因 */
  pauseReason: PauseReason | null;
  /** 剩余重复次数（null=无限） */
  remainingRepeats: number | null;
}

/** 自动远征整体结果 */
export interface AutoExpeditionResult {
  /** 总循环次数 */
  totalRuns: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 总奖励 */
  totalReward: ExpeditionReward;
  /** 暂停原因 */
  pauseReason: PauseReason;
  /** 各步骤结果 */
  steps: AutoExpeditionStepResult[];
}

/** 离线远征计算参数 */
export interface OfflineExpeditionParams {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 队伍总战力 */
  teamPower: number;
  /** 队伍阵型 */
  teamFormation: FormationType;
  /** 路线平均战力（敌方） */
  routeAvgPower: number;
  /** 路线平均敌方阵型 */
  routeAvgFormation: FormationType;
  /** 单次路线平均时长（秒） */
  avgRouteDurationSeconds: number;
  /** 路线基础奖励 */
  baseRouteReward: ExpeditionReward;
  /** 武将数量 */
  heroCount: number;
}

/** 离线远征状态 */
export interface OfflineExpeditionState {
  /** 是否正在离线远征 */
  isActive: boolean;
  /** 离线开始时间戳 */
  startTime: number;
  /** 队伍ID */
  teamId: string;
  /** 路线ID */
  routeId: string;
}

// ─────────────────────────────────────────────
// AutoExpeditionSystem 类
// ─────────────────────────────────────────────

export class AutoExpeditionSystem {
  private battleSystem: ExpeditionBattleSystem;
  private rewardSystem: ExpeditionRewardSystem;
  /** 剩余重复次数（null=无限，0=用完） */
  private remainingRepeats: number | null = null;

  constructor(
    battleSystem: ExpeditionBattleSystem,
    rewardSystem: ExpeditionRewardSystem,
  ) {
    this.battleSystem = battleSystem;
    this.rewardSystem = rewardSystem;
  }

  // ─── #12 自动远征 ─────────────────────────

  /**
   * 启动自动远征
   *
   * @param state 远征状态
   * @param teamId 队伍ID
   * @param routeId 路线ID
   * @returns 是否成功启动
   */
  startAutoExpedition(state: ExpeditionState, teamId: string, routeId: string): boolean {
    const team = state.teams[teamId];
    const route = state.routes[routeId];

    if (!team || !route || !route.unlocked) return false;
    if (state.isAutoExpeditioning) return false;

    // 检查兵力
    const requiredTroops = team.heroIds.length * TROOP_COST.expeditionPerHero;
    if (team.troopCount < requiredTroops) return false;

    state.isAutoExpeditioning = true;
    state.consecutiveFailures = 0;
    // 初始化剩余次数：repeatCount=0 表示无限（null），否则使用配置值
    this.remainingRepeats = state.autoConfig.repeatCount === 0
      ? null
      : state.autoConfig.repeatCount;
    return true;
  }

  /**
   * 停止自动远征
   */
  stopAutoExpedition(state: ExpeditionState): void {
    state.isAutoExpeditioning = false;
    state.consecutiveFailures = 0;
    this.remainingRepeats = null;
  }

  /**
   * 执行自动远征单步
   *
   * @param state 远征状态
   * @param team 队伍数据
   * @param enemyPower 敌方战力
   * @param enemyFormation 敌方阵型
   * @param difficulty 路线难度
   * @param isFirstClear 是否首通
   * @returns 单步结果
   */
  executeAutoStep(
    state: ExpeditionState,
    team: ExpeditionTeam,
    enemyPower: number,
    enemyFormation: FormationType,
    difficulty: import('../../core/expedition/expedition.types').RouteDifficulty,
    isFirstClear: boolean,
  ): AutoExpeditionStepResult {
    // 检查兵力
    const requiredTroops = team.heroIds.length * TROOP_COST.expeditionPerHero;
    if (team.troopCount < requiredTroops) {
      state.isAutoExpeditioning = false;
      return {
        success: false,
        grade: BG.NARROW_DEFEAT,
        reward: this.emptyReward(),
        paused: true,
        pauseReason: PauseReason.TROOPS_EXHAUSTED,
        remainingRepeats: this.getRemainingRepeats(state),
      };
    }

    // 执行快速战斗
    const battleResult = this.battleSystem.quickBattle(
      team.totalPower,
      team.formation,
      enemyPower,
      enemyFormation,
    );

    const success = battleResult.grade !== BG.NARROW_DEFEAT;

    // 计算奖励
    const reward = this.rewardSystem.calculateNodeReward({
      difficulty,
      nodeType: NodeType.BOSS,
      grade: battleResult.grade,
      isFirstClear,
      isRouteComplete: true,
    });

    // 消耗兵力
    team.troopCount -= requiredTroops;

    // 更新连续失败计数
    if (!success) {
      state.consecutiveFailures++;
    } else {
      state.consecutiveFailures = 0;
    }

    // 检查暂停条件
    const { paused, pauseReason } = this.checkPauseConditions(state);

    // 减少剩余重复次数（null=无限，不减）
    if (this.remainingRepeats !== null) {
      this.remainingRepeats--;
    }

    const remainingRepeats = this.remainingRepeats;

    return {
      success,
      grade: battleResult.grade,
      reward,
      paused,
      pauseReason,
      remainingRepeats,
    };
  }

  /**
   * 执行完整的自动远征循环
   *
   * @param state 远征状态
   * @param team 队伍数据
   * @param enemyPower 敌方战力
   * @param enemyFormation 敌方阵型
   * @param difficulty 路线难度
   * @param isFirstClear 是否首通
   * @param maxSteps 最大步数（安全限制）
   * @returns 自动远征结果
   */
  executeAutoExpedition(
    state: ExpeditionState,
    team: ExpeditionTeam,
    enemyPower: number,
    enemyFormation: FormationType,
    difficulty: import('../../core/expedition/expedition.types').RouteDifficulty,
    isFirstClear: boolean,
    maxSteps: number = 100,
  ): AutoExpeditionResult {
    const result: AutoExpeditionResult = {
      totalRuns: 0,
      successCount: 0,
      failureCount: 0,
      totalReward: this.emptyReward(),
      pauseReason: PauseReason.COMPLETED,
      steps: [],
    };

    for (let i = 0; i < maxSteps; i++) {
      if (!state.isAutoExpeditioning) break;

      const step = this.executeAutoStep(
        state, team, enemyPower, enemyFormation, difficulty, isFirstClear,
      );

      result.steps.push(step);
      result.totalRuns++;

      if (step.success) {
        result.successCount++;
      } else {
        result.failureCount++;
      }

      result.totalReward = this.mergeRewards(result.totalReward, step.reward);

      if (step.paused) {
        result.pauseReason = step.pauseReason ?? PauseReason.MANUAL;
        break;
      }
    }

    return result;
  }

  // ─── #17 离线远征 ─────────────────────────

  /**
   * 计算离线远征收益
   *
   * 效率×0.85，时间上限72h，胜率修正×0.85
   */
  calculateOfflineExpedition(params: OfflineExpeditionParams): OfflineExpeditionResult {
    const { offlineSeconds, teamPower, teamFormation, routeAvgPower, routeAvgFormation,
      avgRouteDurationSeconds, baseRouteReward, heroCount } = params;

    const config = OFFLINE_EXPEDITION_CONFIG;
    const maxOfflineSeconds = config.maxOfflineHours * 3600;
    const cappedSeconds = Math.min(offlineSeconds, maxOfflineSeconds);
    const isTimeCapped = offlineSeconds > maxOfflineSeconds;

    // 计算可完成的路线次数
    const avgDuration = Math.max(avgRouteDurationSeconds, 60); // 至少1分钟
    const maxRuns = Math.floor(cappedSeconds / avgDuration);

    // 估算胜率（基于战力对比和离线修正）
    const counterBonus = this.battleSystem.getCounterBonus(teamFormation, routeAvgFormation);
    const effectivePower = teamPower * (1 + counterBonus);
    const powerRatio = effectivePower / Math.max(routeAvgPower, 1);

    // 离线胜率 = 基础胜率 × 离线修正
    const baseWinRate = this.estimateWinRate(powerRatio);
    const offlineWinRate = baseWinRate * config.winRateModifier;

    // 有效完成次数 = 总次数 × 胜率
    const completedRuns = Math.max(1, Math.round(maxRuns * offlineWinRate));

    // 总奖励 = 基础奖励 × 完成次数 × 效率
    const totalReward = this.scaleReward(baseRouteReward, completedRuns * config.battleEfficiency);

    // 综合效率 = 实际完成次数 × 效率 / 理论最大次数
    const theoreticalMaxRuns = cappedSeconds / avgDuration;
    const efficiency = theoreticalMaxRuns > 0
      ? (completedRuns * config.battleEfficiency) / theoreticalMaxRuns
      : 0;

    return {
      offlineSeconds: cappedSeconds,
      completedRuns,
      totalReward,
      efficiency: Math.round(efficiency * 1000) / 1000,
      isTimeCapped,
    };
  }

  /**
   * 计算离线远征的预估收益（用于UI展示）
   */
  estimateOfflineEarnings(
    params: OfflineExpeditionParams,
    hours: number,
  ): Array<{ hours: number; reward: ExpeditionReward; runs: number }> {
    const estimates: Array<{ hours: number; reward: ExpeditionReward; runs: number }> = [];

    for (const h of [1, 2, 4, 8, 12, 24, 48, 72]) {
      if (h > hours) break;
      const result = this.calculateOfflineExpedition({
        ...params,
        offlineSeconds: h * 3600,
      });
      estimates.push({
        hours: h,
        reward: result.totalReward,
        runs: result.completedRuns,
      });
    }

    return estimates;
  }

  // ─── 内部方法 ─────────────────────────────

  /** 检查暂停条件 */
  private checkPauseConditions(state: ExpeditionState): {
    paused: boolean;
    pauseReason: PauseReason | null;
  } {
    // 连续失败
    if (state.consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
      state.isAutoExpeditioning = false;
      return { paused: true, pauseReason: PauseReason.CONSECUTIVE_FAILURES };
    }

    // 完成设定次数（remainingRepeats=0 表示用完，null 表示无限）
    if (this.remainingRepeats !== null && this.remainingRepeats <= 0) {
      state.isAutoExpeditioning = false;
      return { paused: true, pauseReason: PauseReason.COMPLETED };
    }

    return { paused: false, pauseReason: null };
  }

  /** 获取剩余重复次数 */
  private getRemainingRepeats(state: ExpeditionState): number | null {
    return this.remainingRepeats;
  }

  /** 估算胜率（基于战力比） */
  private estimateWinRate(powerRatio: number): number {
    if (powerRatio >= 2.0) return 0.95;
    if (powerRatio >= 1.5) return 0.85;
    if (powerRatio >= 1.2) return 0.70;
    if (powerRatio >= 1.0) return 0.55;
    if (powerRatio >= 0.8) return 0.35;
    if (powerRatio >= 0.6) return 0.15;
    return 0.05;
  }

  /** 创建空奖励 */
  private emptyReward(): ExpeditionReward {
    return { grain: 0, gold: 0, iron: 0, equipFragments: 0, exp: 0, drops: [] };
  }

  /** 合并奖励 */
  private mergeRewards(a: ExpeditionReward, b: ExpeditionReward): ExpeditionReward {
    return {
      grain: a.grain + b.grain,
      gold: a.gold + b.gold,
      iron: a.iron + b.iron,
      equipFragments: a.equipFragments + b.equipFragments,
      exp: a.exp + b.exp,
      drops: [...a.drops, ...b.drops],
    };
  }

  /** 缩放奖励 */
  private scaleReward(reward: ExpeditionReward, multiplier: number): ExpeditionReward {
    return {
      grain: Math.round(reward.grain * multiplier),
      gold: Math.round(reward.gold * multiplier),
      iron: Math.round(reward.iron * multiplier),
      equipFragments: Math.round(reward.equipFragments * multiplier),
      exp: Math.round(reward.exp * multiplier),
      drops: reward.drops.map(d => ({ ...d, count: Math.round(d.count * multiplier) })),
    };
  }
}
