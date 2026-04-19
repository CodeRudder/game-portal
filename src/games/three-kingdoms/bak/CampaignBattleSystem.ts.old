/**
 * 三国霸业 — 征战关卡战斗系统
 *
 * 简化版攻城战斗模拟器，基于双方兵力对比自动计算战斗结果。
 * 参考《三国志》/《三国群英传》的战斗设计理念：
 * - 兵力对比决定基础胜负概率
 * - 武将能力提供额外加成
 * - 城防等级影响攻方损耗
 * - 回合制文字战报
 *
 * @module games/three-kingdoms/CampaignBattleSystem
 */

import {
  CAMPAIGN_STAGES,
  type CampaignStage,
  type EnemyCommander,
  type EnemyUnit,
} from './CampaignSystem';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 攻方武将数据 */
export interface AttackerGeneral {
  id: string;
  name: string;
  level: number;
  attack: number;
  defense: number;
  intelligence: number;
  command: number;
}

/** 攻方兵力配置 */
export interface AttackerArmy {
  generals: AttackerGeneral[];
  /** 总兵力（士兵数量） */
  totalTroops: number;
  /** 粮草（影响持久战能力） */
  grain: number;
}

/** 单回合战斗事件 */
export interface BattleRoundEvent {
  round: number;
  phase: 'skirmish' | 'commander' | 'siege' | 'result';
  attackerAction: string;
  defenderAction: string;
  attackerLosses: number;
  defenderLosses: number;
  attackerTroopsRemaining: number;
  defenderTroopsRemaining: number;
  narrative: string;
}

/** 战斗结果 */
export interface BattleResult {
  victory: boolean;
  stageId: string;
  rounds: BattleRoundEvent[];
  totalAttackerLosses: number;
  totalDefenderLosses: number;
  troopsRemaining: number;       // 攻方剩余兵力
  troopsRemainingPercent: number; // 攻方剩余兵力百分比
  stars: number;                  // 星级评价 1-3
  /** 获得的奖励 */
  rewards: {
    territory: string;
    resources: Record<string, number>;
    unlockHero?: string;
    unlockFeature?: string;
  };
  /** 战斗摘要文本 */
  summary: string;
}

/** 战斗冷却信息 */
export interface BattleCooldown {
  stageId: string;
  canFight: boolean;
  remainingSeconds: number;
}

// ═══════════════════════════════════════════════════════════════
// 战斗配置常量
// ═══════════════════════════════════════════════════════════════

/** 战斗配置 */
export const BATTLE_CONFIG = {
  /** 最大回合数 */
  MAX_ROUNDS: 8,
  /** 基础攻方优势系数（攻方需要更多兵力才能获胜） */
  ATTACKER_DISADVANTAGE: 0.85,
  /** 武将攻击力对战斗的加成系数 */
  GENERAL_ATTACK_BONUS: 0.02,
  /** 武将防御力对损耗的减免系数 */
  GENERAL_DEFENSE_BONUS: 0.015,
  /** 武将智力对策略的加成系数 */
  GENERAL_INTEL_BONUS: 0.01,
  /** 城防减免系数（每级减少攻方伤害的百分比） */
  FORTIFICATION_REDUCTION: 0.05,
  /** 战斗冷却时间（毫秒） */
  COOLDOWN_MS: 30000, // 30秒
  /** 最低兵力要求 */
  MIN_TROOPS: 10,
  /** 兵力悬殊阈值（超过此倍率直接碾压） */
  OVERWHELM_RATIO: 5.0,
  /** 随机波动范围 (±) */
  RANDOM_VARIANCE: 0.15,
} as const;

// ═══════════════════════════════════════════════════════════════
// 战斗系统
// ═══════════════════════════════════════════════════════════════

/**
 * 征战关卡战斗系统
 *
 * 负责模拟攻城战斗，计算胜负和损耗，生成战报。
 */
export class CampaignBattleSystem {
  /** 战斗冷却记录：stageId → 上次战斗结束时间戳 */
  private cooldowns: Map<string, number> = new Map();

  /**
   * 模拟攻城战斗
   *
   * @param stageId - 关卡 ID
   * @param attackerArmy - 攻方兵力配置
   * @returns 战斗结果
   */
  simulateBattle(stageId: string, attackerArmy: AttackerArmy): BattleResult {
    const stage = CAMPAIGN_STAGES.find(s => s.id === stageId);
    if (!stage) {
      return this.createErrorResult(stageId, '关卡不存在');
    }

    // 检查最低兵力
    if (attackerArmy.totalTroops < BATTLE_CONFIG.MIN_TROOPS) {
      return this.createErrorResult(stageId, '兵力不足，无法进攻');
    }

    // 计算敌方总兵力
    const defenderTotalTroops = this.calculateDefenderTroops(stage);
    const commanderPower = this.calculateCommanderPower(stage.enemyCommander);

    // 计算攻方战斗力
    const attackerPower = this.calculateAttackerPower(attackerArmy);

    // 计算城防加成
    const fortificationBonus = this.calculateFortificationBonus(stage);

    // 计算有效兵力比
    const effectiveRatio = (attackerPower * BATTLE_CONFIG.ATTACKER_DISADVANTAGE) /
      (defenderTotalTroops + commanderPower + fortificationBonus);

    // 模拟回合
    const rounds = this.simulateRounds(
      stage, attackerArmy, attackerPower,
      defenderTotalTroops, commanderPower, fortificationBonus, effectiveRatio,
    );

    // 判定胜负
    const victory = effectiveRatio > 0.8 ||
      (rounds.length > 0 && rounds[rounds.length - 1].defenderTroopsRemaining <= 0);

    // 计算损耗
    const totalAttackerLosses = rounds.reduce((sum, r) => sum + r.attackerLosses, 0);
    const totalDefenderLosses = rounds.reduce((sum, r) => sum + r.defenderLosses, 0);
    const troopsRemaining = Math.max(0, attackerArmy.totalTroops - totalAttackerLosses);
    const troopsRemainingPercent = attackerArmy.totalTroops > 0
      ? (troopsRemaining / attackerArmy.totalTroops) * 100
      : 0;

    // 计算星级
    const stars = this.calculateStars(stage, troopsRemainingPercent, victory);

    // 设置冷却
    this.cooldowns.set(stageId, Date.now());

    // 构建结果
    const result: BattleResult = {
      victory,
      stageId,
      rounds,
      totalAttackerLosses,
      totalDefenderLosses,
      troopsRemaining,
      troopsRemainingPercent,
      stars: victory ? stars : 0,
      rewards: victory ? { ...stage.rewards } : { territory: '', resources: {} },
      summary: this.generateSummary(stage, victory, rounds, troopsRemainingPercent),
    };

    return result;
  }

  /**
   * 检查冷却状态
   */
  getCooldown(stageId: string): BattleCooldown {
    const lastTime = this.cooldowns.get(stageId) || 0;
    const elapsed = Date.now() - lastTime;
    const remaining = Math.max(0, BATTLE_CONFIG.COOLDOWN_MS - elapsed);

    return {
      stageId,
      canFight: remaining <= 0,
      remainingSeconds: Math.ceil(remaining / 1000),
    };
  }

  /**
   * 获取关卡战斗预览信息
   *
   * 不实际执行战斗，只返回敌我对比数据供 UI 展示。
   */
  getBattlePreview(stageId: string, attackerArmy: AttackerArmy): {
    canFight: boolean;
    reason?: string;
    attackerPower: number;
    defenderPower: number;
    difficulty: 'easy' | 'normal' | 'hard' | 'very_hard' | 'impossible';
    estimatedLosses: { min: number; max: number };
    winProbability: number;
  } {
    const stage = CAMPAIGN_STAGES.find(s => s.id === stageId);
    if (!stage) {
      return {
        canFight: false,
        reason: '关卡不存在',
        attackerPower: 0,
        defenderPower: 0,
        difficulty: 'impossible',
        estimatedLosses: { min: 0, max: 0 },
        winProbability: 0,
      };
    }

    // 检查冷却
    const cooldown = this.getCooldown(stageId);
    if (!cooldown.canFight) {
      return {
        canFight: false,
        reason: `冷却中，还需等待 ${cooldown.remainingSeconds} 秒`,
        attackerPower: 0,
        defenderPower: 0,
        difficulty: 'easy',
        estimatedLosses: { min: 0, max: 0 },
        winProbability: 0,
      };
    }

    // 检查兵力
    if (attackerArmy.totalTroops < BATTLE_CONFIG.MIN_TROOPS) {
      return {
        canFight: false,
        reason: `兵力不足（最低需要 ${BATTLE_CONFIG.MIN_TROOPS}）`,
        attackerPower: 0,
        defenderPower: 0,
        difficulty: 'impossible',
        estimatedLosses: { min: 0, max: 0 },
        winProbability: 0,
      };
    }

    const attackerPower = this.calculateAttackerPower(attackerArmy);
    const defenderTroops = this.calculateDefenderTroops(stage);
    const commanderPower = this.calculateCommanderPower(stage.enemyCommander);
    const fortBonus = this.calculateFortificationBonus(stage);
    const defenderPower = defenderTroops + commanderPower + fortBonus;

    const effectiveRatio = (attackerPower * BATTLE_CONFIG.ATTACKER_DISADVANTAGE) / defenderPower;

    // 计算胜率
    let winProbability: number;
    if (effectiveRatio >= BATTLE_CONFIG.OVERWHELM_RATIO) {
      winProbability = 0.99;
    } else if (effectiveRatio >= 2.0) {
      winProbability = 0.85;
    } else if (effectiveRatio >= 1.2) {
      winProbability = 0.65;
    } else if (effectiveRatio >= 0.8) {
      winProbability = 0.40;
    } else if (effectiveRatio >= 0.5) {
      winProbability = 0.20;
    } else {
      winProbability = 0.05;
    }

    // 难度评级
    let difficulty: 'easy' | 'normal' | 'hard' | 'very_hard' | 'impossible';
    if (effectiveRatio >= 3.0) difficulty = 'easy';
    else if (effectiveRatio >= 1.5) difficulty = 'normal';
    else if (effectiveRatio >= 0.8) difficulty = 'hard';
    else if (effectiveRatio >= 0.5) difficulty = 'very_hard';
    else difficulty = 'impossible';

    // 预估损耗
    const baseLossRate = Math.max(0.05, 1 - effectiveRatio * 0.3);
    const estimatedLosses = {
      min: Math.floor(attackerArmy.totalTroops * baseLossRate * 0.5),
      max: Math.floor(attackerArmy.totalTroops * baseLossRate * 1.5),
    };

    return {
      canFight: true,
      attackerPower: Math.floor(attackerPower),
      defenderPower: Math.floor(defenderPower),
      difficulty,
      estimatedLosses,
      winProbability,
    };
  }

  /**
   * 序列化
   */
  serialize(): object {
    return {
      cooldowns: [...this.cooldowns.entries()],
    };
  }

  /**
   * 反序列化
   */
  deserialize(data: any): void {
    this.cooldowns = new Map(data?.cooldowns ?? []);
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 计算敌方总兵力值
   */
  private calculateDefenderTroops(stage: CampaignStage): number {
    return stage.enemyUnits.reduce((sum, unit) => {
      return sum + unit.count * (unit.hpPerUnit + unit.attackPerUnit * 2 + unit.defensePerUnit);
    }, 0);
  }

  /**
   * 计算守将战斗力
   */
  private calculateCommanderPower(commander: EnemyCommander): number {
    return commander.hp + commander.attack * 5 + commander.defense * 3 + commander.intelligence * 2;
  }

  /**
   * 计算攻方战斗力
   */
  private calculateAttackerPower(army: AttackerArmy): number {
    let power = army.totalTroops * 3; // 基础兵力值

    // 武将加成
    for (const gen of army.generals) {
      power += gen.attack * gen.level * BATTLE_CONFIG.GENERAL_ATTACK_BONUS * army.totalTroops;
      power += gen.defense * gen.level * BATTLE_CONFIG.GENERAL_DEFENSE_BONUS * army.totalTroops;
      power += gen.intelligence * gen.level * BATTLE_CONFIG.GENERAL_INTEL_BONUS * army.totalTroops;
    }

    // 粮草加成（满粮+10%）
    if (army.grain > army.totalTroops * 2) {
      power *= 1.1;
    }

    return power;
  }

  /**
   * 计算城防加成
   */
  private calculateFortificationBonus(stage: CampaignStage): number {
    // 根据城墙和箭塔数量计算城防值
    const wallCount = stage.mapLayout.walls.length;
    const towerCount = stage.mapLayout.towers.length;
    const gateCount = stage.mapLayout.gates.length;

    let fortification = 0;
    fortification += wallCount * 50;  // 每段城墙
    fortification += towerCount * 200; // 每座箭塔
    fortification += gateCount * 100;  // 每座城门

    return fortification;
  }

  /**
   * 模拟回合制战斗
   */
  private simulateRounds(
    stage: CampaignStage,
    attackerArmy: AttackerArmy,
    attackerPower: number,
    defenderTroops: number,
    commanderPower: number,
    fortificationBonus: number,
    effectiveRatio: number,
  ): BattleRoundEvent[] {
    const rounds: BattleRoundEvent[] = [];
    const maxRounds = BATTLE_CONFIG.MAX_ROUNDS;

    let attackerRemaining = attackerArmy.totalTroops;
    let defenderRemaining = defenderTroops + commanderPower;

    // 战斗叙事模板
    const skirmishActions = [
      '前锋交锋，刀光剑影',
      '两军对阵，箭矢如雨',
      '骑兵突袭，尘土飞扬',
      '步兵推进，步步为营',
      '弓弩齐射，遮天蔽日',
    ];

    const commanderActions = [
      `${stage.enemyCommander.name}施展${stage.enemyCommander.abilities[0] || '猛攻'}！`,
      `${stage.enemyCommander.name}高呼：${stage.enemyCommander.dialogue.mid}`,
      `守将亲自率军反击！`,
    ];

    const attackerActions = [
      '全军突击！',
      '集中兵力攻城！',
      '分兵包抄！',
      '强攻城门！',
    ];

    for (let round = 1; round <= maxRounds; round++) {
      if (attackerRemaining <= 0 || defenderRemaining <= 0) break;

      // 随机波动
      const variance = 1 + (Math.random() * 2 - 1) * BATTLE_CONFIG.RANDOM_VARIANCE;

      // 攻方伤害
      const attackerDamage = (attackerPower / maxRounds) * effectiveRatio * variance;
      // 守方伤害
      const defenderDamage = ((defenderTroops + commanderPower + fortificationBonus) / maxRounds) *
        (1 / Math.max(0.1, effectiveRatio)) * variance;

      // 计算损耗
      const attackerLosses = Math.min(
        Math.floor(defenderDamage * 0.3),
        attackerRemaining,
      );
      const defenderLosses = Math.min(
        Math.floor(attackerDamage * 0.3),
        defenderRemaining,
      );

      attackerRemaining = Math.max(0, attackerRemaining - attackerLosses);
      defenderRemaining = Math.max(0, defenderRemaining - defenderLosses);

      // 确定阶段
      let phase: BattleRoundEvent['phase'];
      let narrative: string;

      if (round <= 2) {
        phase = 'skirmish';
        narrative = `第${round}回合：${skirmishActions[round % skirmishActions.length]}` +
          `。我军损失${attackerLosses}人，敌军损失${defenderLosses}人。`;
      } else if (round <= 4 && stage.enemyCommander.hp > 500) {
        phase = 'commander';
        narrative = `第${round}回合：${commanderActions[round % commanderActions.length]}` +
          `。${attackerActions[round % attackerActions.length]}我军损失${attackerLosses}人，敌军损失${defenderLosses}人。`;
      } else if (stage.mapLayout.gates.length > 0) {
        phase = 'siege';
        narrative = `第${round}回合：攻城激烈进行中。${attackerActions[round % attackerActions.length]}` +
          `我军损失${attackerLosses}人，敌军损失${defenderLosses}人。`;
      } else {
        phase = 'result';
        narrative = `第${round}回合：决战时刻。双方全力一搏。` +
          `我军损失${attackerLosses}人，敌军损失${defenderLosses}人。`;
      }

      rounds.push({
        round,
        phase,
        attackerAction: attackerActions[round % attackerActions.length],
        defenderAction: commanderActions[round % commanderActions.length],
        attackerLosses,
        defenderLosses,
        attackerTroopsRemaining: attackerRemaining,
        defenderTroopsRemaining: defenderRemaining,
        narrative,
      });
    }

    return rounds;
  }

  /**
   * 计算星级评价
   */
  private calculateStars(stage: CampaignStage, troopsRemainingPercent: number, victory: boolean): number {
    if (!victory) return 0;
    if (troopsRemainingPercent >= stage.starThresholds.threeStar) return 3;
    if (troopsRemainingPercent >= stage.starThresholds.twoStar) return 2;
    return 1;
  }

  /**
   * 生成战斗摘要
   */
  private generateSummary(
    stage: CampaignStage,
    victory: boolean,
    rounds: BattleRoundEvent[],
    troopsRemainingPercent: number,
  ): string {
    if (!victory) {
      return `攻打${stage.targetCityName}失败。${stage.enemyCommander.name}防守严密，我军不得不撤退。` +
        `剩余兵力${troopsRemainingPercent.toFixed(1)}%。`;
    }

    const lastRound = rounds[rounds.length - 1];
    if (troopsRemainingPercent >= stage.starThresholds.threeStar) {
      return `完美攻克${stage.targetCityName}！我军势如破竹，${stage.enemyCommander.name}俯首称臣。` +
        `仅损失${(100 - troopsRemainingPercent).toFixed(1)}%兵力，堪称经典之战！`;
    } else if (troopsRemainingPercent >= stage.starThresholds.twoStar) {
      return `成功攻克${stage.targetCityName}！经过${rounds.length}回合激战，` +
        `${stage.enemyCommander.name}败退。我军剩余${troopsRemainingPercent.toFixed(1)}%兵力。`;
    } else {
      return `险胜${stage.targetCityName}！${rounds.length}回合苦战，` +
        `${stage.enemyCommander.name}最终不敌。我军伤亡惨重，仅剩${troopsRemainingPercent.toFixed(1)}%兵力。`;
    }
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(stageId: string, reason: string): BattleResult {
    return {
      victory: false,
      stageId,
      rounds: [],
      totalAttackerLosses: 0,
      totalDefenderLosses: 0,
      troopsRemaining: 0,
      troopsRemainingPercent: 0,
      stars: 0,
      rewards: { territory: '', resources: {} },
      summary: reason,
    };
  }
}
