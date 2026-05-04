/**
 * 双路径结算统一流水线
 *
 * 统一管理攻城结算的三条路径:
 *   Path A (Victory): 战斗胜利 → 计算伤亡 → 发放奖励 → 触发回城
 *   Path B (Defeat):  战斗失败 → 计算伤亡 → 不发奖励 → 触发回城
 *   Path C (Cancel):  取消行军 → 直接回城 → 无结算
 *
 * 流水线阶段: validate → calculate → distribute → notify
 * 每条路径使用不同的配置跳过特定阶段。
 *
 * @module engine/map/SettlementPipeline
 * @see docs/iterations/map-system/settlement-architecture.md
 */

import type { BattleCompletedEvent } from './SiegeBattleSystem';
import {
  SiegeResultCalculator,
  OUTCOME_REWARD_MULTIPLIER,
} from './SiegeResultCalculator';
import type { BattleOutcome, SiegeSettlementResult } from './SiegeResultCalculator';
import type { InjuryLevel } from './expedition-types';
import { shouldDropInsiderLetter } from './SiegeItemSystem';
import { SIEGE_REWARD_CONFIG } from '../../core/map';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 结算路径 */
export type SettlementPath = 'victory' | 'defeat' | 'cancel';

/** 结算伤亡数据 */
export interface SettlementCasualties {
  /** 士兵损失数量 */
  troopsLost: number;
  /** 士兵损失百分比 */
  troopsLostPercent: number;
  /** 将领是否受伤 */
  heroInjured: boolean;
  /** 将领受伤等级 */
  injuryLevel: InjuryLevel;
}

/** 结算奖励数据 */
export interface SettlementRewards {
  /** 资源奖励 */
  resources: {
    grain: number;
    gold: number;
    troops: number;
  };
  /** 道具奖励 */
  items: Array<{ type: string; count: number }>;
  /** 奖励倍率 */
  rewardMultiplier: number;
}

/** 回城行军信息 */
export interface ReturnMarchInfo {
  /** 出发城市ID(攻城目标) */
  fromCityId: string;
  /** 目的城市ID(出发城市) */
  toCityId: string;
  /** 剩余兵力 */
  troops: number;
  /** 将领 */
  general: string;
}

/** 统一结算上下文 */
export interface SettlementContext {
  // --- 标识 ---
  /** 关联的攻占任务ID */
  taskId: string;
  /** 目标领土/城市ID */
  targetId: string;
  /** 出发城市ID */
  sourceId: string;

  // --- 路径标识 ---
  /** 结算路径类型 */
  path: SettlementPath;

  // --- 战斗数据 ---
  /** 战斗完成事件(cancel时为null) */
  battleEvent: BattleCompletedEvent | null;
  /** 战斗结果等级(cancel时为null) */
  outcome: BattleOutcome | null;

  // --- 伤亡结果 ---
  /** 伤亡数据(cancel时为null) */
  casualties: SettlementCasualties | null;

  // --- 奖励结果 ---
  /** 奖励数据(仅victory时有值) */
  rewards: SettlementRewards | null;

  // --- 回城信息 ---
  /** 回城行军参数 */
  returnMarch: ReturnMarchInfo;

  // --- 元数据 ---
  /** 结算时间戳 */
  timestamp: number;
  /** 编队ID */
  forceId?: string;
  /** 将领ID */
  heroId?: string;
  /** 出征兵力(用于伤亡计算) */
  troops?: number;
  /** 目标等级(用于结算计算) */
  targetLevel?: number;
  /** 是否首次攻占 */
  isFirstCapture?: boolean;
}

/** 结算流水线阶段 */
export type SettlementPhase = 'validate' | 'calculate' | 'distribute' | 'notify';

/** 单个阶段的执行状态 */
export type PhaseStatus = 'executed' | 'skipped';

/** 阶段执行记录 */
export interface PhaseRecord {
  /** 阶段名 */
  phase: SettlementPhase;
  /** 执行状态 */
  status: PhaseStatus;
}

/** 结算验证错误 */
export interface SettlementValidationError {
  phase: SettlementPhase;
  message: string;
}

/** 结算结果 */
export interface SettlementResult {
  /** 是否成功 */
  success: boolean;
  /** 结算上下文(流水线各阶段填充) */
  context: SettlementContext;
  /** 验证错误(失败时) */
  errors: SettlementValidationError[];
  /** 已执行的阶段记录(含各阶段执行状态) */
  executedPhases: PhaseRecord[];
}

/** 结算完成事件payload */
export interface SettlementCompleteEvent {
  taskId: string;
  targetId: string;
  path: SettlementPath;
  victory: boolean;
  casualties: SettlementCasualties | null;
  rewards: SettlementRewards | null;
  timestamp: number;
}

/** 结算取消事件payload */
export interface SettlementCancelledEvent {
  taskId: string;
  targetId: string;
  timestamp: number;
}

// ─────────────────────────────────────────────
// 流水线阶段配置
// ─────────────────────────────────────────────

/** 各路径的流水线阶段配置 */
const PATH_PHASE_CONFIG: Record<SettlementPath, {
  /** 是否执行 calculate 阶段 */
  calculate: boolean;
  /** 是否执行 distribute 阶段 */
  distribute: boolean;
  /** 是否执行 notify 阶段(始终执行, 但发射的事件不同) */
  notify: boolean;
}> = {
  victory: { calculate: true,  distribute: true,  notify: true },
  defeat:  { calculate: true,  distribute: false, notify: true },
  cancel:  { calculate: false, distribute: false, notify: true },
};

// ─────────────────────────────────────────────
// 依赖接口
// ─────────────────────────────────────────────

/** 结算流水线依赖 */
export interface SettlementPipelineDeps {
  /** 事件总线 */
  eventBus: {
    emit(event: string, data: unknown): void;
    on(event: string, handler: (data: unknown) => void): void;
    off(event: string, handler: (data: unknown) => void): void;
  };
  /** 伤亡计算器(可选, 默认使用内置SiegeResultCalculator) */
  resultCalculator?: SiegeResultCalculator;
}

// ─────────────────────────────────────────────
// SettlementPipeline
// ─────────────────────────────────────────────

/**
 * 双路径结算统一流水线
 *
 * 通过四阶段流水线统一处理攻城结算的三条路径。
 * 每条路径根据 PATH_PHASE_CONFIG 跳过特定阶段。
 *
 * @example
 * ```ts
 * const pipeline = new SettlementPipeline();
 * pipeline.setDependencies({ eventBus });
 *
 * // Victory path
 * const result = pipeline.execute({
 *   taskId: 'task-001',
 *   targetId: 'city-luoyang',
 *   sourceId: 'city-xuchang',
 *   path: 'victory',
 *   battleEvent: { victory: true, ... },
 *   troops: 5000,
 *   targetLevel: 3,
 *   isFirstCapture: true,
 *   returnMarch: { fromCityId: 'city-luoyang', toCityId: 'city-xuchang', troops: 5000, general: '关羽' },
 *   timestamp: Date.now(),
 * });
 * ```
 */
export class SettlementPipeline {
  private deps: SettlementPipelineDeps | null = null;
  private calculator: SiegeResultCalculator;

  constructor() {
    this.calculator = new SiegeResultCalculator();
  }

  /** 设置依赖 */
  setDependencies(deps: SettlementPipelineDeps): void {
    this.deps = deps;
    if (deps.resultCalculator) {
      this.calculator = deps.resultCalculator;
    }
  }

  // ── 统一入口 ─────────────────────────────────

  /**
   * 执行完整结算流水线
   *
   * 根据 ctx.path 确定执行哪些阶段，按序执行:
   * validate → calculate → distribute → notify
   *
   * @param ctx - 结算上下文(调用方需填充路径、战斗数据、回城信息)
   * @returns 结算结果(包含执行后的完整上下文)
   */
  execute(ctx: SettlementContext): SettlementResult {
    const result: SettlementResult = {
      success: true,
      context: { ...ctx },
      errors: [],
      executedPhases: [],
    };

    // Phase 1: Validate
    const validationErrors = this.validate(result.context);
    if (validationErrors.length > 0) {
      result.success = false;
      result.errors = validationErrors;
      return result;
    }
    result.executedPhases.push({ phase: 'validate', status: 'executed' });

    const config = PATH_PHASE_CONFIG[result.context.path];

    // Phase 2: Calculate (victory/defeat only)
    if (config.calculate) {
      result.context = this.calculate(result.context);
      result.executedPhases.push({ phase: 'calculate', status: 'executed' });
    } else {
      result.executedPhases.push({ phase: 'calculate', status: 'skipped' });
    }

    // Phase 3: Distribute (victory only)
    if (config.distribute) {
      result.context = this.distribute(result.context);
      result.executedPhases.push({ phase: 'distribute', status: 'executed' });
    } else {
      result.executedPhases.push({ phase: 'distribute', status: 'skipped' });
    }

    // Phase 4: Notify (always)
    this.notify(result.context);
    result.executedPhases.push({ phase: 'notify', status: 'executed' });

    return result;
  }

  // ── 阶段实现 ─────────────────────────────────

  /**
   * 阶段1: 验证上下文完整性
   *
   * 检查必填字段、路径与数据的逻辑一致性。
   *
   * @param ctx - 结算上下文
   * @returns 验证错误列表(空表示通过)
   */
  validate(ctx: SettlementContext): SettlementValidationError[] {
    const errors: SettlementValidationError[] = [];

    // 基础字段
    if (!ctx.taskId) {
      errors.push({ phase: 'validate', message: 'taskId is required' });
    }
    if (!ctx.targetId) {
      errors.push({ phase: 'validate', message: 'targetId is required' });
    }
    if (!ctx.sourceId) {
      errors.push({ phase: 'validate', message: 'sourceId is required' });
    }

    // 回城信息
    if (!ctx.returnMarch || !ctx.returnMarch.fromCityId || !ctx.returnMarch.toCityId) {
      errors.push({ phase: 'validate', message: 'returnMarch with fromCityId and toCityId is required' });
    }

    // 路径特定验证
    if (ctx.path !== 'cancel') {
      if (!ctx.battleEvent) {
        errors.push({ phase: 'validate', message: 'battleEvent is required for victory/defeat paths' });
      }
      if (!ctx.troops || ctx.troops <= 0) {
        errors.push({ phase: 'validate', message: 'troops must be positive for victory/defeat paths' });
      }
    }

    // Victory 路径额外验证
    if (ctx.path === 'victory' && ctx.battleEvent && !ctx.battleEvent.victory) {
      errors.push({ phase: 'validate', message: 'battleEvent.victory must be true for victory path' });
    }

    // Defeat 路径额外验证
    if (ctx.path === 'defeat' && ctx.battleEvent && ctx.battleEvent.victory) {
      errors.push({ phase: 'validate', message: 'battleEvent.victory must be false for defeat path' });
    }

    return errors;
  }

  /**
   * 阶段2: 计算伤亡和结果等级
   *
   * 使用 SiegeResultCalculator 计算伤亡、将领受伤和结果等级。
   * 填充 ctx.outcome 和 ctx.casualties。
   *
   * @param ctx - 已验证的结算上下文
   * @returns 填充了伤亡数据的上下文
   */
  calculate(ctx: SettlementContext): SettlementContext {
    if (!ctx.battleEvent) return ctx;

    const settlementResult: SiegeSettlementResult = this.calculator.calculateSettlement(
      ctx.battleEvent,
      {
        targetLevel: ctx.targetLevel ?? 1,
        isFirstCapture: ctx.isFirstCapture ?? false,
      },
    );

    return {
      ...ctx,
      outcome: settlementResult.outcome,
      casualties: {
        troopsLost: settlementResult.troopsLost,
        troopsLostPercent: settlementResult.troopsLostPercent,
        heroInjured: settlementResult.heroInjured,
        injuryLevel: settlementResult.injuryLevel,
      },
    };
  }

  /**
   * 阶段3: 分发奖励(仅胜利路径)
   *
   * 根据 calculate 阶段的结果计算奖励。
   * 使用 SIEGE_REWARD_CONFIG 的基础值与 outcome 倍率。
   * 填充 ctx.rewards。
   *
   * @param ctx - 已计算的结算上下文
   * @returns 填充了奖励数据的上下文
   */
  distribute(ctx: SettlementContext): SettlementContext {
    if (ctx.path !== 'victory') {
      return { ...ctx, rewards: null };
    }

    // 奖励基于 outcome 的 rewardMultiplier
    const multiplier = ctx.outcome
      ? (OUTCOME_REWARD_MULTIPLIER[ctx.outcome] ?? 0)
      : 0;

    // 如果是首次攻占，倍率加成
    const finalMultiplier = ctx.isFirstCapture ? multiplier * 1.5 : multiplier;

    // 使用 SIEGE_REWARD_CONFIG 基础值(与 SiegeRewardProgressive 一致)
    const level = ctx.targetLevel ?? 1;
    const baseGrain = SIEGE_REWARD_CONFIG.baseGrain;
    const baseGold = SIEGE_REWARD_CONFIG.baseGold;
    const baseTroops = SIEGE_REWARD_CONFIG.baseTroops;

    // R14: 道具掉落检测 — 攻城胜利后检测内应信掉落
    const droppedItems: Array<{ type: string; count: number }> = [];
    if (shouldDropInsiderLetter(ctx.taskId)) {
      droppedItems.push({ type: 'insiderLetter', count: 1 });
    }

    const rewards: SettlementRewards = {
      resources: {
        grain: Math.floor(baseGrain * level * finalMultiplier),
        gold: Math.floor(baseGold * level * finalMultiplier),
        troops: Math.floor(baseTroops * level * finalMultiplier),
      },
      items: droppedItems,
      rewardMultiplier: finalMultiplier,
    };

    // 发射奖励事件
    if (this.deps) {
      this.deps.eventBus.emit('settlement:reward', {
        taskId: ctx.taskId,
        targetId: ctx.targetId,
        rewards,
        timestamp: ctx.timestamp,
      });
    }

    return { ...ctx, rewards };
  }

  /**
   * 阶段4: 触发通知事件
   *
   * 根据路径类型发射不同的事件:
   * - victory/defeat: settlement:complete
   * - cancel: settlement:cancelled
   *
   * 同时发射 settlement:return 事件标记回城。
   *
   * @param ctx - 已完成前面阶段的结算上下文
   */
  notify(ctx: SettlementContext): void {
    if (!this.deps) return;

    if (ctx.path === 'cancel') {
      // 取消路径: 发射取消事件
      this.deps.eventBus.emit('settlement:cancelled', {
        taskId: ctx.taskId,
        targetId: ctx.targetId,
        timestamp: ctx.timestamp,
      } satisfies SettlementCancelledEvent);
    } else {
      // 胜利/失败路径: 发射完成事件
      this.deps.eventBus.emit('settlement:complete', {
        taskId: ctx.taskId,
        targetId: ctx.targetId,
        path: ctx.path,
        victory: ctx.path === 'victory',
        casualties: ctx.casualties,
        rewards: ctx.rewards,
        timestamp: ctx.timestamp,
      } satisfies SettlementCompleteEvent);
    }

    // 回城通知
    this.deps.eventBus.emit('settlement:return', {
      taskId: ctx.taskId,
      returnMarch: ctx.returnMarch,
      path: ctx.path,
    });
  }

  // ── 辅助方法 ─────────────────────────────────

  /**
   * 从 BattleCompletedEvent 创建 victory 路径上下文
   *
   * 便捷工厂方法，简化调用方代码。
   */
  createVictoryContext(params: {
    taskId: string;
    battleEvent: BattleCompletedEvent;
    sourceId: string;
    returnMarch: ReturnMarchInfo;
    troops: number;
    targetLevel?: number;
    isFirstCapture?: boolean;
    forceId?: string;
    heroId?: string;
  }): SettlementContext {
    return {
      taskId: params.taskId,
      targetId: params.battleEvent.targetId,
      sourceId: params.sourceId,
      path: 'victory',
      battleEvent: params.battleEvent,
      outcome: null,
      casualties: null,
      rewards: null,
      returnMarch: params.returnMarch,
      timestamp: Date.now(),
      forceId: params.forceId,
      heroId: params.heroId,
      troops: params.troops,
      targetLevel: params.targetLevel,
      isFirstCapture: params.isFirstCapture,
    };
  }

  /**
   * 创建 defeat 路径上下文
   */
  createDefeatContext(params: {
    taskId: string;
    battleEvent: BattleCompletedEvent;
    sourceId: string;
    returnMarch: ReturnMarchInfo;
    troops: number;
    targetLevel?: number;
    forceId?: string;
    heroId?: string;
  }): SettlementContext {
    return {
      taskId: params.taskId,
      targetId: params.battleEvent.targetId,
      sourceId: params.sourceId,
      path: 'defeat',
      battleEvent: params.battleEvent,
      outcome: null,
      casualties: null,
      rewards: null,
      returnMarch: params.returnMarch,
      timestamp: Date.now(),
      forceId: params.forceId,
      heroId: params.heroId,
      troops: params.troops,
      targetLevel: params.targetLevel,
    };
  }

  /**
   * 创建 cancel 路径上下文
   */
  createCancelContext(params: {
    taskId: string;
    targetId: string;
    sourceId: string;
    returnMarch: ReturnMarchInfo;
    forceId?: string;
    heroId?: string;
  }): SettlementContext {
    return {
      taskId: params.taskId,
      targetId: params.targetId,
      sourceId: params.sourceId,
      path: 'cancel',
      battleEvent: null,
      outcome: null,
      casualties: null,
      rewards: null,
      returnMarch: params.returnMarch,
      timestamp: Date.now(),
      forceId: params.forceId,
      heroId: params.heroId,
    };
  }

  /**
   * 获取已执行的阶段名列表(便捷方法, 保留向后兼容)
   */
  static getExecutedPhaseNames(result: SettlementResult): SettlementPhase[] {
    return result.executedPhases
      .filter(p => p.status === 'executed')
      .map(p => p.phase);
  }

  /**
   * 检查指定阶段是否已执行
   */
  static isPhaseExecuted(result: SettlementResult, phase: SettlementPhase): boolean {
    const record = result.executedPhases.find(p => p.phase === phase);
    return record?.status === 'executed';
  }
}

// ─────────────────────────────────────────────
// 重导出常量
// ─────────────────────────────────────────────

export { OUTCOME_REWARD_MULTIPLIER } from './SiegeResultCalculator';
