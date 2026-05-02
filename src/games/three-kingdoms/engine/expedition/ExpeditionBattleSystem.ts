/**
 * 远征战斗系统 — 引擎层
 *
 * 职责：全自动战斗模拟、阵型克制、星级评定
 * 规则：
 *   - 全自动战斗，最多10回合
 *   - 阵型克制：鱼鳞>锋矢>雁行>鹤翼>鱼鳞，克制方全属性+10%
 *   - 阵型克制：长蛇>方圆>长蛇（互克）
 *   - 战斗结果：大捷⭐⭐⭐/小胜⭐⭐/惨胜⭐/惜败
 *   - 大捷：剩余血量>50%且无武将阵亡
 *   - 小胜：剩余血量10%~50%或有武将阵亡
 *   - 惨胜：剩余血量<10%
 *   - 惜败：战斗失败
 *
 * TODO(DEF-025): [已评估-推迟] 架构问题 — 当前远征使用独立的简化战斗逻辑（simulateBattle/quickBattle），
 * 未复用 BattleEngine + DamageCalculator 的完整战斗管线。两套战斗逻辑可能导致：
 * 1. 伤害计算不一致（此处基于战力比，BattleEngine基于攻防公式）
 * 2. buff/技能/暴击等机制在远征中缺失
 * 3. 维护成本翻倍
 *
 * 评估结论（2025-06）：
 * - 远征战斗设计为快速模拟（10回合上限），不需要完整的buff/技能/暴击系统
 * - 战力比公式是远征系统特有的简化设计，不是bug而是feature
 * - 统一到BattleEngine需要大规模重构（预估4h+），收益不足以证明风险
 * - 当前两套系统各自独立运行，无交叉调用，不存在运行时状态不一致
 *
 * 长期方案（推迟到Phase 2）：重构为 ExpeditionBattleAdapter 适配层，将远征参数转换为
 * BattleEngine 可用的 BattleState，复用核心战斗引擎。短期保持现状以避免大规模改动。
 *
 * @module engine/expedition/ExpeditionBattleSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ExpeditionBattleResult,
  FormationType,
} from '../../core/expedition/expedition.types';
import {
  BattleGrade,
  GRADE_STARS,
  FORMATION_COUNTERS,
  FORMATION_EFFECTS,
  NodeType,
} from '../../core/expedition/expedition.types';
import { EXPEDITION_MAX_TURNS, FORMATION_COUNTER_BONUS } from './expedition-config';

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 战斗单位简化数据 */
export interface BattleUnitData {
  id: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  intelligence: number;
}

/** 战斗队伍数据 */
export interface BattleTeamData {
  units: BattleUnitData[];
  formation: FormationType;
  totalPower: number;
}

/** 节点战斗配置 */
export interface NodeBattleConfig {
  nodeType: NodeType;
  enemyPower: number;
  enemyFormation: FormationType;
  recommendedPower: number;
}

/** 战斗过程快照（每回合） */
export interface BattleTurnSnapshot {
  turn: number;
  allyHpPercent: number;
  enemyHpPercent: number;
  allyDeaths: number;
}

// ─────────────────────────────────────────────
// ExpeditionBattleSystem 类
// ─────────────────────────────────────────────

export class ExpeditionBattleSystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  readonly name = 'expeditionBattle' as const;
  private deps: ISystemDeps | null = null;

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 战斗系统无需帧更新 */
  update(_dt: number): void {
    // 战斗系统由事件驱动，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): Record<string, unknown> {
    return { name: this.name };
  }

  /** 重置系统状态 */
  reset(): void {
    // 战斗系统无持久状态，无需重置
  }

  // ─── 战斗逻辑 ─────────────────────────────

  /**
   * 执行远征战斗
   *
   * 全自动模拟，基于战力对比和阵型克制计算结果
   */
  executeBattle(
    allyTeam: BattleTeamData,
    nodeConfig: NodeBattleConfig,
  ): ExpeditionBattleResult {
    const counterBonus = this.getCounterBonus(allyTeam.formation, nodeConfig.enemyFormation);
    const effectiveAllyPower = this.calculateEffectivePower(allyTeam, counterBonus);
    const effectiveEnemyPower = this.calculateEnemyPower(nodeConfig);

    const { allyHpPercent, turns, allyDeaths } = this.simulateBattle(
      effectiveAllyPower,
      effectiveEnemyPower,
      allyTeam.totalPower,
    );

    const grade = this.evaluateGrade(allyHpPercent, allyDeaths, effectiveAllyPower > effectiveEnemyPower);
    const stars = GRADE_STARS[grade];

    const expGained = this.calculateExp(nodeConfig.nodeType, grade);

    return {
      grade,
      stars,
      totalTurns: turns,
      allyHpPercent,
      allyDeaths,
      expGained,
    };
  }

  /**
   * 快速判定（不模拟回合，仅基于战力对比）
   * 用于扫荡和离线远征
   */
  quickBattle(
    allyPower: number,
    allyFormation: FormationType,
    enemyPower: number,
    enemyFormation: FormationType,
  ): ExpeditionBattleResult {
    const counterBonus = this.getCounterBonus(allyFormation, enemyFormation);
    const effectiveAlly = allyPower * (1 + counterBonus);
    const powerRatio = effectiveAlly / Math.max(enemyPower, 1);

    let allyHpPercent: number;
    let allyDeaths: number;

    if (powerRatio >= 2.0) {
      // 压倒性优势
      allyHpPercent = 85 + Math.random() * 15;
      allyDeaths = 0;
    } else if (powerRatio >= 1.5) {
      // 明显优势
      allyHpPercent = 60 + Math.random() * 25;
      allyDeaths = Math.random() < 0.3 ? 1 : 0;
    } else if (powerRatio >= 1.0) {
      // 势均力敌
      allyHpPercent = 25 + Math.random() * 40;
      allyDeaths = Math.floor(Math.random() * 3);
    } else if (powerRatio >= 0.7) {
      // 劣势
      allyHpPercent = 5 + Math.random() * 20;
      allyDeaths = Math.floor(Math.random() * 4);
    } else {
      // 压倒性劣势
      allyHpPercent = Math.random() * 10;
      allyDeaths = Math.floor(Math.random() * 5);
    }

    const won = allyHpPercent > 0;
    if (!won) {
      allyHpPercent = 0;
    }

    const grade = this.evaluateGrade(allyHpPercent, allyDeaths, won);
    const stars = GRADE_STARS[grade];

    return {
      grade,
      stars,
      totalTurns: Math.min(EXPEDITION_MAX_TURNS, Math.ceil(10 / Math.max(powerRatio, 0.1))),
      allyHpPercent: Math.round(allyHpPercent * 100) / 100,
      allyDeaths,
      expGained: this.calculateExpByPower(enemyPower, grade),
    };
  }

  /**
   * 获取阵型克制加成
   * @returns 克制加成百分比（0 或 0.10）
   */
  getCounterBonus(allyFormation: FormationType, enemyFormation: FormationType): number {
    // 克制方全属性+10%
    if (FORMATION_COUNTERS[allyFormation] === enemyFormation) {
      return FORMATION_COUNTER_BONUS;
    }
    // 被克制方全属性-10%
    if (FORMATION_COUNTERS[enemyFormation] === allyFormation) {
      return -FORMATION_COUNTER_BONUS;
    }
    return 0;
  }

  /**
   * 判断是否克制
   */
  isCounter(allyFormation: FormationType, enemyFormation: FormationType): boolean {
    return FORMATION_COUNTERS[allyFormation] === enemyFormation;
  }

  // ─── 内部方法 ─────────────────────────────

  /** 计算有效战力（含阵型效果和克制） */
  private calculateEffectivePower(team: BattleTeamData, counterBonus: number): number {
    const formationEffect = FORMATION_EFFECTS[team.formation];
    const avgMod = (formationEffect.attackMod + formationEffect.defenseMod +
      formationEffect.speedMod + formationEffect.intelligenceMod) / 4;
    return team.totalPower * (1 + avgMod) * (1 + counterBonus);
  }

  /** 计算敌方战力 */
  private calculateEnemyPower(config: NodeBattleConfig): number {
    const difficultyMultiplier = this.getDifficultyMultiplier(config.nodeType);
    return config.enemyPower * difficultyMultiplier;
  }

  /** 获取节点难度倍率 */
  private getDifficultyMultiplier(nodeType: NodeType): number {
    switch (nodeType) {
      case NodeType.BANDIT: return 0.8;
      case NodeType.HAZARD: return 1.0;
      case NodeType.BOSS: return 1.3;
      case NodeType.TREASURE: return 0;
      case NodeType.REST: return 0;
      default: return 1.0;
    }
  }

  /** 模拟战斗过程 */
  private simulateBattle(
    allyPower: number,
    enemyPower: number,
    originalAllyPower: number,
  ): { allyHpPercent: number; turns: number; allyDeaths: number } {
    let allyHp = 1.0;
    let enemyHp = 1.0;
    const powerRatio = allyPower / Math.max(enemyPower, 1);

    // 每回合伤害比例
    const allyDpsPerTurn = powerRatio * 0.15;
    const enemyDpsPerTurn = (1 / Math.max(powerRatio, 0.1)) * 0.12;

    let turns = 0;
    for (let i = 0; i < EXPEDITION_MAX_TURNS; i++) {
      turns++;
      enemyHp -= allyDpsPerTurn * (0.8 + Math.random() * 0.4);
      allyHp -= enemyDpsPerTurn * (0.8 + Math.random() * 0.4);

      if (enemyHp <= 0) {
        enemyHp = 0;
        break;
      }
      if (allyHp <= 0) {
        allyHp = 0;
        break;
      }
    }

    // 估算阵亡数（基于剩余血量比例）
    const allyDeaths = allyHp <= 0
      ? 5
      : allyHp < 0.15
        ? Math.floor(Math.random() * 3) + 1
        : allyHp < 0.4
          ? Math.random() < 0.3 ? 1 : 0
          : 0;

    return {
      allyHpPercent: Math.round(Math.max(0, allyHp) * 100) / 100,
      turns,
      allyDeaths,
    };
  }

  /** 评定战斗等级 */
  evaluateGrade(hpPercent: number, deaths: number, won: boolean): BattleGrade {
    if (!won) {
      return BattleGrade.NARROW_DEFEAT;
    }
    if (hpPercent > 50 && deaths === 0) {
      return BattleGrade.GREAT_VICTORY;
    }
    if (hpPercent >= 10) {
      return BattleGrade.MINOR_VICTORY;
    }
    return BattleGrade.PYRRHIC_VICTORY;
  }

  /** 计算经验奖励 */
  private calculateExp(nodeType: NodeType, grade: BattleGrade): number {
    const baseExp: Record<NodeType, number> = {
      [NodeType.BANDIT]: 200,
      [NodeType.HAZARD]: 400,
      [NodeType.BOSS]: 800,
      [NodeType.TREASURE]: 100,
      [NodeType.REST]: 50,
      [NodeType.BATTLE]: 200,
      [NodeType.EVENT]: 100,
      [NodeType.SHOP]: 50,
    };
    const gradeMultiplier: Record<BattleGrade, number> = {
      [BattleGrade.GREAT_VICTORY]: 1.5,
      [BattleGrade.MINOR_VICTORY]: 1.0,
      [BattleGrade.PYRRHIC_VICTORY]: 0.7,
      [BattleGrade.NARROW_DEFEAT]: 0.3,
    };
    return Math.round(baseExp[nodeType] * gradeMultiplier[grade]);
  }

  /** 根据敌方战力计算经验 */
  private calculateExpByPower(enemyPower: number, grade: BattleGrade): number {
    const base = Math.round(enemyPower * 0.5);
    const gradeMultiplier: Record<BattleGrade, number> = {
      [BattleGrade.GREAT_VICTORY]: 1.5,
      [BattleGrade.MINOR_VICTORY]: 1.0,
      [BattleGrade.PYRRHIC_VICTORY]: 0.7,
      [BattleGrade.NARROW_DEFEAT]: 0.3,
    };
    return Math.round(base * gradeMultiplier[grade]);
  }
}
