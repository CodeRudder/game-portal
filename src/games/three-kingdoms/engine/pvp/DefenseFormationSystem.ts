/**
 * 防守阵容系统 — 引擎层
 *
 * 职责：防守编队管理、AI策略配置、防守日志记录与统计
 * 规则：
 *   - 5个阵位，5种阵型（鱼鳞/锋矢/雁行/长蛇/方圆）
 *   - 4种AI策略（均衡/猛攻/坚守/智谋）
 *   - 防守日志最多50条，记录被挑战历史
 *   - 智能建议：根据胜率推荐策略调整
 *
 * @module engine/pvp/DefenseFormationSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  DefenseFormation,
  DefenseLogEntry,
  DefenseLogStats,
  DefenseSnapshot,
  ArenaPlayerState,
} from '../../core/pvp/pvp.types';
import {
  FormationType,
  AIDefenseStrategy,
} from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 阵位数量 */
export const FORMATION_SLOT_COUNT = 5;

/** 防守日志最大条数 */
export const MAX_DEFENSE_LOGS = 50;

/** 阵型列表 */
export const ALL_FORMATIONS: FormationType[] = [
  FormationType.FISH_SCALE,
  FormationType.WEDGE,
  FormationType.GOOSE,
  FormationType.SNAKE,
  FormationType.SQUARE,
];

/** AI策略列表 */
export const ALL_STRATEGIES: AIDefenseStrategy[] = [
  AIDefenseStrategy.BALANCED,
  AIDefenseStrategy.AGGRESSIVE,
  AIDefenseStrategy.DEFENSIVE,
  AIDefenseStrategy.CUNNING,
];

/** 阵型名称映射 */
export const FORMATION_NAMES: Record<FormationType, string> = {
  [FormationType.FISH_SCALE]: '鱼鳞阵',
  [FormationType.WEDGE]: '锋矢阵',
  [FormationType.GOOSE]: '雁行阵',
  [FormationType.SNAKE]: '长蛇阵',
  [FormationType.SQUARE]: '方圆阵',
};

/** 策略名称映射 */
export const STRATEGY_NAMES: Record<AIDefenseStrategy, string> = {
  [AIDefenseStrategy.BALANCED]: '均衡',
  [AIDefenseStrategy.AGGRESSIVE]: '猛攻',
  [AIDefenseStrategy.DEFENSIVE]: '坚守',
  [AIDefenseStrategy.CUNNING]: '智谋',
};

/** 策略建议阈值 */
const STRATEGY_SUGGESTION_THRESHOLD = 5; // 至少5场才给建议
const LOW_WIN_RATE_THRESHOLD = 0.3;
const MID_WIN_RATE_THRESHOLD = 0.5;

// ─────────────────────────────────────────────
// DefenseFormationSystem 类
// ─────────────────────────────────────────────

/**
 * 防守阵容系统
 *
 * 管理防守编队、AI策略、防守日志
 */
export class DefenseFormationSystem implements ISubsystem {
  readonly name = 'DefenseFormationSystem';
  private deps!: ISystemDeps;

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    /* 预留 */
  }

  getState(): Record<string, unknown> {
    // DefenseFormationSystem 是无状态工具类，返回空状态
    return {};
  }

  reset(): void {
    /* 无内部状态，无需重置 */
  }
  // ── 阵容管理 ──────────────────────────────

  /**
   * 创建默认防守阵容
   */
  createDefaultFormation(): DefenseFormation {
    return {
      slots: ['', '', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    };
  }

  /**
   * 设置防守阵容
   *
   * @throws 至少需要1名武将
   */
  setFormation(
    current: DefenseFormation,
    slots: [string, string, string, string, string],
    formation?: FormationType,
    strategy?: AIDefenseStrategy,
  ): DefenseFormation {
    const heroCount = slots.filter((s) => s !== '').length;
    if (heroCount === 0) {
      throw new Error('防守阵容至少需要1名武将');
    }
    if (heroCount > FORMATION_SLOT_COUNT) {
      throw new Error(`最多${FORMATION_SLOT_COUNT}名武将`);
    }

    return {
      slots,
      formation: formation ?? current.formation,
      strategy: strategy ?? current.strategy,
    };
  }

  /**
   * 设置阵型
   */
  setFormationType(current: DefenseFormation, formation: FormationType): DefenseFormation {
    return { ...current, formation };
  }

  /**
   * 设置AI策略
   */
  setStrategy(current: DefenseFormation, strategy: AIDefenseStrategy): DefenseFormation {
    return { ...current, strategy };
  }

  /**
   * 创建防守快照（挑战发起时锁定）
   */
  createSnapshot(formation: DefenseFormation): DefenseSnapshot {
    return {
      slots: [...formation.slots],
      formation: formation.formation,
      aiStrategy: formation.strategy,
    };
  }

  // ── 阵容验证 ──────────────────────────────

  /**
   * 验证阵容是否合法
   */
  validateFormation(formation: DefenseFormation): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (formation.slots.length !== FORMATION_SLOT_COUNT) {
      errors.push(`阵位数量必须为${FORMATION_SLOT_COUNT}`);
    }

    const heroCount = formation.slots.filter((s) => s !== '').length;
    if (heroCount === 0) {
      errors.push('至少需要1名武将');
    }

    // 检查重复武将
    const heroIds = formation.slots.filter((s) => s !== '');
    const uniqueIds = new Set(heroIds);
    if (uniqueIds.size !== heroIds.length) {
      errors.push('武将不能重复');
    }

    // 检查阵型是否合法
    if (!ALL_FORMATIONS.includes(formation.formation)) {
      errors.push('无效的阵型');
    }

    // 检查策略是否合法
    if (!ALL_STRATEGIES.includes(formation.strategy)) {
      errors.push('无效的AI策略');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 获取阵容中的武将数量
   */
  getHeroCount(formation: DefenseFormation): number {
    return formation.slots.filter((s) => s !== '').length;
  }

  /**
   * 获取阵容中的武将ID列表（去空）
   */
  getHeroIds(formation: DefenseFormation): string[] {
    return formation.slots.filter((s) => s !== '');
  }

  // ── 防守日志 ──────────────────────────────

  /**
   * 添加防守日志
   */
  addDefenseLog(
    logs: DefenseLogEntry[],
    entry: Omit<DefenseLogEntry, 'id'>,
  ): DefenseLogEntry[] {
    const newEntry: DefenseLogEntry = {
      ...entry,
      id: `def_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    return [newEntry, ...logs].slice(0, MAX_DEFENSE_LOGS);
  }

  /**
   * 获取防守统计
   */
  getDefenseStats(logs: DefenseLogEntry[]): DefenseLogStats {
    const wins = logs.filter((l) => l.defenderWon).length;
    const losses = logs.filter((l) => !l.defenderWon).length;
    const totalDefenses = wins + losses;
    const winRate = totalDefenses > 0 ? wins / totalDefenses : 0;

    let suggestedStrategy: AIDefenseStrategy | null = null;
    if (totalDefenses >= STRATEGY_SUGGESTION_THRESHOLD) {
      if (winRate < LOW_WIN_RATE_THRESHOLD) {
        suggestedStrategy = AIDefenseStrategy.DEFENSIVE;
      } else if (winRate < MID_WIN_RATE_THRESHOLD) {
        suggestedStrategy = AIDefenseStrategy.BALANCED;
      }
    }

    return { totalDefenses, wins, losses, winRate, suggestedStrategy };
  }

  /**
   * 获取最近的防守日志
   */
  getRecentLogs(logs: DefenseLogEntry[], count: number = 10): DefenseLogEntry[] {
    return logs.slice(0, count);
  }

  /**
   * 获取指定进攻方的防守记录
   */
  getLogsByAttacker(logs: DefenseLogEntry[], attackerId: string): DefenseLogEntry[] {
    return logs.filter((l) => l.attackerId === attackerId);
  }

  // ── AI策略建议 ──────────────────────────────

  /**
   * 获取策略建议描述
   */
  getStrategySuggestion(stats: DefenseLogStats): string | null {
    if (!stats.suggestedStrategy) return null;

    const strategyName = STRATEGY_NAMES[stats.suggestedStrategy];
    const winRatePercent = Math.round(stats.winRate * 100);

    if (stats.winRate < LOW_WIN_RATE_THRESHOLD) {
      return `当前防守胜率仅${winRatePercent}%，建议切换为「${strategyName}」策略以提高防守成功率`;
    }
    return `当前防守胜率${winRatePercent}%，建议尝试「${strategyName}」策略`;
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化防守数据
   */
  serialize(playerState: ArenaPlayerState): {
    defenseFormation: DefenseFormation;
    defenseLogs: DefenseLogEntry[];
  } {
    return {
      defenseFormation: { ...playerState.defenseFormation },
      defenseLogs: [...playerState.defenseLogs],
    };
  }

  /**
   * 反序列化恢复防守数据
   */
  deserialize(data: {
    defenseFormation: DefenseFormation;
    defenseLogs: DefenseLogEntry[];
  }): Partial<ArenaPlayerState> {
    return {
      defenseFormation: data.defenseFormation ?? this.createDefaultFormation(),
      defenseLogs: data.defenseLogs ?? [],
    };
  }
}
