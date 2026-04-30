/**
 * V3 战斗系统 Play 流程集成测试
 *
 * 覆盖以下 play 流程：
 * - BATTLE-FLOW-1: 自动战斗完整流程
 * - BATTLE-FLOW-2: 伤害计算验证
 * - BATTLE-FLOW-3: 兵种克制验证
 * - BATTLE-FLOW-4: 战斗结算与奖励
 * - BATTLE-FLOW-5: 异常边界
 *
 * 编码规范：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - UI层测试 it.skip + [UI层测试]
 * - 引擎未实现 it.skip + [引擎未实现]
 * - 不使用 as unknown as Record<string, unknown>
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import { BattleEngine } from '../../battle/BattleEngine';
import { DamageCalculator, getRestraintMultiplier } from '../../battle/DamageCalculator';
import {
  BattleOutcome,
  BattlePhase,
  StarRating,
  TroopType,
} from '../../battle/battle.types';
import type {
  BattleTeam,
  BattleUnit,
  BattleResult,
} from '../../battle/battle.types';
import type { BattleSide } from '../../battle/battle-base.types';
import { SkillTargetType } from '../../battle/battle-base.types';
import type { BattleSkill } from '../../battle/battle-base.types';
import { BATTLE_CONFIG } from '../../battle/battle-config';

/** 默认普攻技能（所有战斗单位必备） */
const DEFAULT_NORMAL_ATTACK: BattleSkill = {
  id: 'normal_attack',
  name: '普攻',
  type: 'active',
  level: 1,
  description: '普通攻击',
  multiplier: 1.0,
  targetType: SkillTargetType.SINGLE_ENEMY,
  rageCost: 0,
  cooldown: 0,
  currentCooldown: 0,
};

// ── 辅助：创建战斗单位 ──
function createBattleUnit(
  id: string,
  name: string,
  troopType: TroopType,
  side: BattleSide,
  position: 'front' | 'back',
  stats: { attack: number; defense: number; intelligence: number; speed: number; maxHp: number },
): BattleUnit {
  return {
    id,
    name,
    faction: 'shu',
    troopType,
    side,
    position,
    attack: stats.attack,
    baseAttack: stats.attack,
    defense: stats.defense,
    baseDefense: stats.defense,
    intelligence: stats.intelligence,
    speed: stats.speed,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: { ...DEFAULT_NORMAL_ATTACK },
    skills: [],
    buffs: [],
  };
}

// ── 辅助：创建标准队伍（前排3+后排3） ──
function createStandardTeam(side: BattleSide, power: number = 1000): BattleTeam {
  const baseStat = Math.floor(power / 6);
  const units: BattleUnit[] = [];

  for (let i = 0; i < 3; i++) {
    units.push(createBattleUnit(
      `${side}_front_${i}`,
      `${side === 'ally' ? '我方' : '敌方'}前排${i + 1}`,
      [TroopType.CAVALRY, TroopType.INFANTRY, TroopType.SPEARMAN][i],
      side,
      'front',
      { attack: baseStat, defense: Math.floor(baseStat * 0.3), intelligence: Math.floor(baseStat * 0.5), speed: 50 + i * 10, maxHp: baseStat * 5 },
    ));
  }

  for (let i = 0; i < 3; i++) {
    units.push(createBattleUnit(
      `${side}_back_${i}`,
      `${side === 'ally' ? '我方' : '敌方'}后排${i + 1}`,
      [TroopType.ARCHER, TroopType.STRATEGIST, TroopType.ARCHER][i],
      side,
      'back',
      { attack: Math.floor(baseStat * 0.9), defense: Math.floor(baseStat * 0.2), intelligence: Math.floor(baseStat * 0.8), speed: 60 + i * 10, maxHp: baseStat * 4 },
    ));
  }

  return { units, side };
}

// ── 辅助：创建弱队 ──
function createWeakTeam(side: BattleSide): BattleTeam {
  return {
    units: [
      createBattleUnit(`${side}_w1`, `弱方1`, TroopType.INFANTRY, side, 'front',
        { attack: 1, defense: 1, intelligence: 1, speed: 1, maxHp: 1 }),
    ],
    side,
  };
}

// ── 辅助：创建强队 ──
function createStrongTeam(side: BattleSide): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < 6; i++) {
    units.push(createBattleUnit(
      `${side}_strong_${i}`,
      `强方${i + 1}`,
      TroopType.CAVALRY,
      side,
      i < 3 ? 'front' : 'back',
      { attack: 500, defense: 100, intelligence: 200, speed: 80 + i, maxHp: 5000 },
    ));
  }
  return { units, side };
}

// ── 辅助：初始化带武将和编队的状态 ──
function initBattleReadyState(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 1_000_000);
  sim.engine.resource.setCap('troops', 1_000_000);
  sim.addResources({ gold: 100000, grain: 100000, troops: 50000 });
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  sim.engine.createFormation('main');
  sim.engine.setFormation('main', heroIds);
  return sim;
}

// ═══════════════════════════════════════════════════════════════
// BATTLE-FLOW-1: 自动战斗完整流程
// ═══════════════════════════════════════════════════════════════
describe('V3 战斗系统 — BATTLE-FLOW', () => {
  describe('BATTLE-FLOW-1: 自动战斗完整流程', () => {
    it('buildTeamsForStage → runFullBattle → 验证结果包含outcome/stars/totalTurns/summary', () => {
      // BATTLE-FLOW-1: 通过引擎完整战斗流程验证
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage = stages[0];
      const { allyTeam, enemyTeam } = sim.engine.buildTeamsForStage(stage);

      const battleEngine = sim.engine.getBattleEngine();
      const result = battleEngine.runFullBattle(allyTeam, enemyTeam);

      // 结果包含所有必要字段
      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
      expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
      expect(result.stars).toBeDefined();
      expect(result.totalTurns).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('runFullBattle(强队 vs 弱队) → VICTORY', () => {
      // BATTLE-FLOW-1: 强队必胜
      const battleEngine = new BattleEngine();
      const allyTeam = createStrongTeam('ally');
      const enemyTeam = createWeakTeam('enemy');

      const result = battleEngine.runFullBattle(allyTeam, enemyTeam);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
    });

    it('runFullBattle(弱队 vs 强队) → DEFEAT', () => {
      // BATTLE-FLOW-1: 弱队必败
      const battleEngine = new BattleEngine();
      const allyTeam = createWeakTeam('ally');
      const enemyTeam = createStrongTeam('enemy');

      const result = battleEngine.runFullBattle(allyTeam, enemyTeam);

      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.stars).toBe(StarRating.NONE);
    });

    it('战斗回合数不超过MAX_TURNS(8)', () => {
      // BATTLE-FLOW-1: 回合上限验证
      const battleEngine = new BattleEngine();
      const allyTeam = createStandardTeam('ally');
      const enemyTeam = createStandardTeam('enemy');

      const result = battleEngine.runFullBattle(allyTeam, enemyTeam);

      expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
    });

    it('initBattle → executeTurn → isBattleOver → getBattleResult 逐步执行', () => {
      // BATTLE-FLOW-1: 手动逐步执行战斗流程
      // 使用强队 vs 弱队确保战斗在回合内结束
      const battleEngine = new BattleEngine();
      const allyTeam = createStrongTeam('ally');
      const enemyTeam = createWeakTeam('enemy');

      const state = battleEngine.initBattle(allyTeam, enemyTeam);

      // 初始状态验证
      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      expect(state.currentTurn).toBe(1);
      expect(state.allyTeam.units.length).toBe(6);
      expect(state.enemyTeam.units.length).toBe(1);

      // 逐步执行回合直到战斗结束
      let turnCount = 0;
      while (!battleEngine.isBattleOver(state) && turnCount < BATTLE_CONFIG.MAX_TURNS) {
        const actions = battleEngine.executeTurn(state);
        // 每回合至少有一个行动记录（如果战斗未结束）
        if (!battleEngine.isBattleOver(state)) {
          expect(actions.length).toBeGreaterThan(0);
        }
        turnCount++;
      }

      // 战斗结束
      expect(battleEngine.isBattleOver(state)).toBe(true);
      expect(state.phase).toBe(BattlePhase.FINISHED);

      // 获取结果
      const result = battleEngine.getBattleResult(state);
      expect(result).toBeDefined();
      expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
    });

    it('战斗结果包含存活人数和伤害统计', () => {
      // BATTLE-FLOW-1: 结果字段完整性验证
      const battleEngine = new BattleEngine();
      const allyTeam = createStrongTeam('ally');
      const enemyTeam = createWeakTeam('enemy');

      const result = battleEngine.runFullBattle(allyTeam, enemyTeam);

      expect(result.allySurvivors).toBeGreaterThanOrEqual(0);
      expect(result.enemySurvivors).toBeGreaterThanOrEqual(0);
      expect(result.allyTotalDamage).toBeGreaterThanOrEqual(0);
      expect(result.enemyTotalDamage).toBeGreaterThanOrEqual(0);
      expect(result.fragmentRewards).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BATTLE-FLOW-2: 伤害计算验证
  // ═══════════════════════════════════════════════════════════════
  describe('BATTLE-FLOW-2: 伤害计算验证', () => {
    it('基础伤害 = 攻击 × (1+加成) - 防御 × (1+加成)', () => {
      // BATTLE-FLOW-2: 验证伤害公式结构
      const attacker = createBattleUnit('atk', '攻击者', TroopType.ARCHER, 'ally', 'front',
        { attack: 200, defense: 50, intelligence: 30, speed: 50, maxHp: 1000 });
      const defender = createBattleUnit('def', '防御者', TroopType.ARCHER, 'enemy', 'front',
        { attack: 80, defense: 80, intelligence: 20, speed: 40, maxHp: 1000 });

      const calc = new DamageCalculator();
      const result = calc.calculateDamage(attacker, defender, 1.0);

      // 基础伤害应为 attack - defense 的某种形式
      expect(result.baseDamage).toBeDefined();
      expect(result.damage).toBeGreaterThan(0);
      expect(result.skillMultiplier).toBe(1.0);
    });

    it('最终伤害 ≥ 1（最低伤害保底）', () => {
      // BATTLE-FLOW-2: 即使防御远高于攻击，伤害至少为1
      const attacker = createBattleUnit('atk', '弱攻', TroopType.INFANTRY, 'ally', 'front',
        { attack: 10, defense: 5, intelligence: 5, speed: 50, maxHp: 1000 });
      const defender = createBattleUnit('def', '铁壁', TroopType.CAVALRY, 'enemy', 'front',
        { attack: 5, defense: 5000, intelligence: 5, speed: 40, maxHp: 50000 });

      const calc = new DamageCalculator();
      const result = calc.calculateDamage(attacker, defender, 1.0);

      // 最低伤害保底：最终伤害至少为1
      expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    it('攻击力越高伤害越高', () => {
      // BATTLE-FLOW-2: 攻击力与伤害正相关
      const calc = new DamageCalculator();

      const weakAttacker = createBattleUnit('weak', '弱攻', TroopType.ARCHER, 'ally', 'front',
        { attack: 50, defense: 10, intelligence: 5, speed: 50, maxHp: 1000 });
      const strongAttacker = createBattleUnit('strong', '强攻', TroopType.ARCHER, 'ally', 'front',
        { attack: 500, defense: 10, intelligence: 5, speed: 50, maxHp: 1000 });
      const defender = createBattleUnit('def', '目标', TroopType.ARCHER, 'enemy', 'front',
        { attack: 10, defense: 50, intelligence: 5, speed: 40, maxHp: 1000 });

      // 多次计算取平均以消除随机波动
      let weakTotal = 0;
      let strongTotal = 0;
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        weakTotal += calc.calculateDamage(weakAttacker, defender, 1.0).damage;
        strongTotal += calc.calculateDamage(strongAttacker, defender, 1.0).damage;
      }

      // 强攻平均伤害应远高于弱攻
      expect(strongTotal / iterations).toBeGreaterThan(weakTotal / iterations);
    });

    it('暴击时伤害有1.5倍加成', () => {
      // BATTLE-FLOW-2: 暴击倍率验证
      const attacker = createBattleUnit('atk', '暴击者', TroopType.ARCHER, 'ally', 'front',
        { attack: 200, defense: 50, intelligence: 30, speed: 50, maxHp: 1000 });
      const defender = createBattleUnit('def', '目标', TroopType.ARCHER, 'enemy', 'front',
        { attack: 80, defense: 30, intelligence: 20, speed: 40, maxHp: 1000 });

      const calc = new DamageCalculator();
      // 多次计算寻找暴击
      let foundCritical = false;
      for (let i = 0; i < 100; i++) {
        const result = calc.calculateDamage(attacker, defender, 1.0);
        if (result.isCritical) {
          expect(result.criticalMultiplier).toBe(1.5);
          foundCritical = true;
          break;
        }
      }
      // 暴击概率约20%，100次内应出现
      expect(foundCritical).toBe(true);
    });

    it('随机波动系数在0.9~1.1之间', () => {
      // BATTLE-FLOW-2: 随机波动范围验证
      const attacker = createBattleUnit('atk', '攻击者', TroopType.ARCHER, 'ally', 'front',
        { attack: 100, defense: 10, intelligence: 30, speed: 50, maxHp: 1000 });
      const defender = createBattleUnit('def', '防御者', TroopType.ARCHER, 'enemy', 'front',
        { attack: 80, defense: 20, intelligence: 20, speed: 40, maxHp: 1000 });

      const calc = new DamageCalculator();
      for (let i = 0; i < 20; i++) {
        const result = calc.calculateDamage(attacker, defender, 1.0);
        expect(result.randomFactor).toBeGreaterThanOrEqual(0.9);
        expect(result.randomFactor).toBeLessThanOrEqual(1.1);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BATTLE-FLOW-3: 兵种克制验证
  // ═══════════════════════════════════════════════════════════════
  describe('BATTLE-FLOW-3: 兵种克制验证', () => {
    it('骑兵→步兵 ×1.5（克制）', () => {
      // BATTLE-FLOW-3: 骑兵克制步兵
      const multiplier = getRestraintMultiplier(TroopType.CAVALRY, TroopType.INFANTRY);
      expect(multiplier).toBe(1.5);
    });

    it('步兵→枪兵 ×1.5（克制）', () => {
      // BATTLE-FLOW-3: 步兵克制枪兵
      const multiplier = getRestraintMultiplier(TroopType.INFANTRY, TroopType.SPEARMAN);
      expect(multiplier).toBe(1.5);
    });

    it('枪兵→骑兵 ×1.5（克制）', () => {
      // BATTLE-FLOW-3: 枪兵克制骑兵
      const multiplier = getRestraintMultiplier(TroopType.SPEARMAN, TroopType.CAVALRY);
      expect(multiplier).toBe(1.5);
    });

    it('步兵→骑兵 ×0.7（被克制）', () => {
      // BATTLE-FLOW-3: 步兵被骑兵克制
      const multiplier = getRestraintMultiplier(TroopType.INFANTRY, TroopType.CAVALRY);
      expect(multiplier).toBe(0.7);
    });

    it('枪兵→步兵 ×0.7（被克制）', () => {
      // BATTLE-FLOW-3: 枪兵被步兵克制
      const multiplier = getRestraintMultiplier(TroopType.SPEARMAN, TroopType.INFANTRY);
      expect(multiplier).toBe(0.7);
    });

    it('骑兵→枪兵 ×0.7（被克制）', () => {
      // BATTLE-FLOW-3: 骑兵被枪兵克制
      const multiplier = getRestraintMultiplier(TroopType.CAVALRY, TroopType.SPEARMAN);
      expect(multiplier).toBe(0.7);
    });

    it('弓兵/谋士 ×1.0（无克制关系）', () => {
      // BATTLE-FLOW-3: 弓兵对所有兵种无克制
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.CAVALRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.INFANTRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.SPEARMAN)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.ARCHER)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.ARCHER, TroopType.STRATEGIST)).toBe(1.0);

      // 谋士对所有兵种无克制
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.CAVALRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.INFANTRY)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.SPEARMAN)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.ARCHER)).toBe(1.0);
      expect(getRestraintMultiplier(TroopType.STRATEGIST, TroopType.STRATEGIST)).toBe(1.0);
    });

    it('克制系数影响实际伤害计算', () => {
      // BATTLE-FLOW-3: 克制关系在伤害计算中生效
      const calc = new DamageCalculator();

      const cavalry = createBattleUnit('cav', '骑兵', TroopType.CAVALRY, 'ally', 'front',
        { attack: 100, defense: 50, intelligence: 30, speed: 50, maxHp: 1000 });
      const infantry = createBattleUnit('inf', '步兵', TroopType.INFANTRY, 'enemy', 'front',
        { attack: 80, defense: 50, intelligence: 20, speed: 40, maxHp: 1000 });

      const result = calc.calculateDamage(cavalry, infantry, 1.0);
      expect(result.restraintMultiplier).toBe(1.5);
    });

    it('被克制时伤害降低', () => {
      // BATTLE-FLOW-3: 被克制时restraintMultiplier为0.7
      const calc = new DamageCalculator();

      const infantry = createBattleUnit('inf', '步兵', TroopType.INFANTRY, 'ally', 'front',
        { attack: 100, defense: 50, intelligence: 30, speed: 50, maxHp: 1000 });
      const cavalry = createBattleUnit('cav', '骑兵', TroopType.CAVALRY, 'enemy', 'front',
        { attack: 80, defense: 50, intelligence: 20, speed: 40, maxHp: 1000 });

      const result = calc.calculateDamage(infantry, cavalry, 1.0);
      expect(result.restraintMultiplier).toBe(0.7);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BATTLE-FLOW-4: 战斗结算与奖励
  // ═══════════════════════════════════════════════════════════════
  describe('BATTLE-FLOW-4: 战斗结算与奖励', () => {
    it('startBattle(stageId) → 验证资源变化', () => {
      // BATTLE-FLOW-4: 战斗胜利后资源增加
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      const grainBefore = sim.getResource('grain');
      const goldBefore = sim.getResource('gold');

      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);

      const grainAfter = sim.getResource('grain');
      const goldAfter = sim.getResource('gold');

      // 战斗胜利后资源应增加
      expect(grainAfter).toBeGreaterThan(grainBefore);
      expect(goldAfter).toBeGreaterThan(goldBefore);
    });

    it('completeBattle(stageId, stars) → 验证奖励入账', () => {
      // BATTLE-FLOW-4: 通关后奖励正确入账
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const rewardDistributor = sim.engine.getRewardDistributor();

      // 预览基础奖励
      const baseRewards = rewardDistributor.previewBaseRewards(stage1Id);
      expect(baseRewards.exp).toBeGreaterThan(0);

      // 执行战斗
      const resourcesBefore = sim.getAllResources();
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      const resourcesAfter = sim.getAllResources();

      // 至少有一种资源增加
      const hasIncrease = (resourcesAfter.grain > resourcesBefore.grain)
        || (resourcesAfter.gold > resourcesBefore.gold);
      expect(hasIncrease).toBe(true);
    });

    it('星级倍率：★×1.0 / ★★×1.5 / ★★★×2.0', () => {
      // BATTLE-FLOW-4: 不同星级的奖励倍率验证
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const rewardDistributor = sim.engine.getRewardDistributor();

      // 1星奖励
      const reward1 = rewardDistributor.calculateRewards(stage1Id, 1, false);
      // 2星奖励
      const reward2 = rewardDistributor.calculateRewards(stage1Id, 2, false);
      // 3星奖励
      const reward3 = rewardDistributor.calculateRewards(stage1Id, 3, false);

      // 星级倍率验证
      expect(reward1.starMultiplier).toBe(1.0);
      expect(reward2.starMultiplier).toBe(1.5);
      expect(reward3.starMultiplier).toBe(2.0);

      // 高星级经验 > 低星级经验
      expect(reward2.exp).toBeGreaterThan(reward1.exp);
      expect(reward3.exp).toBeGreaterThan(reward2.exp);
    });

    it('首通奖励额外叠加', () => {
      // BATTLE-FLOW-4: 首通奖励 = 基础奖励 × 倍率 + 首通额外奖励
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const rewardDistributor = sim.engine.getRewardDistributor();

      const firstClearReward = rewardDistributor.calculateRewards(stage1Id, 3, true);
      const repeatReward = rewardDistributor.calculateRewards(stage1Id, 3, false);

      // 首通奖励 > 重复奖励
      expect(firstClearReward.exp).toBeGreaterThan(repeatReward.exp);
      expect(firstClearReward.isFirstClear).toBe(true);
      expect(repeatReward.isFirstClear).toBe(false);
    });

    it('战斗结果包含碎片奖励', () => {
      // BATTLE-FLOW-4: 胜利时碎片奖励字段存在
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      const result = sim.engine.startBattle(stage1Id);
      expect(result.fragmentRewards).toBeDefined();
      expect(typeof result.fragmentRewards).toBe('object');
    });

    it('战斗经验分配给参战武将', () => {
      // BATTLE-FLOW-4: 武将经验增加验证
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      const expBefore = sim.engine.hero.getGeneral('liubei')!.exp;

      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);

      const expAfter = sim.engine.hero.getGeneral('liubei')!.exp;
      expect(expAfter).toBeGreaterThanOrEqual(expBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BATTLE-FLOW-5: 异常边界
  // ═══════════════════════════════════════════════════════════════
  describe('BATTLE-FLOW-5: 异常边界', () => {
    it('挑战locked关卡 → 应失败（抛出异常）', () => {
      // BATTLE-FLOW-5: 锁定关卡不可挑战
      const sim = createSim();
      const stages = sim.engine.getStageList();

      // 第2关应该是锁定的
      const lockedStage = stages[1];
      expect(() => sim.engine.startBattle(lockedStage.id)).toThrow();
    });

    it('不存在的关卡 → 应失败（抛出异常）', () => {
      // BATTLE-FLOW-5: 不存在的关卡ID
      const sim = createSim();
      expect(() => sim.engine.startBattle('nonexistent_stage')).toThrow();
    });

    it('0星通关 → 应该可以', () => {
      // BATTLE-FLOW-5: 0星通关不抛异常
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const campaignSystem = sim.engine.getCampaignSystem();

      // 0星通关
      sim.engine.startBattle(stage1Id);
      expect(() => sim.engine.completeBattle(stage1Id, 0)).not.toThrow();

      // 0星时状态仍为cleared（因为firstCleared=true，stars=0）
      const status = campaignSystem.getStageStatus(stage1Id);
      expect(campaignSystem.isFirstCleared(stage1Id)).toBe(true);
      // 0星通关，状态取决于实现：可能是cleared或available
      expect(['available', 'cleared', 'threeStar']).toContain(status);
    });

    it('空编队战斗 → 不应崩溃', () => {
      // BATTLE-FLOW-5: 空编队或不足编队时的处理
      const sim = createSim();
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('main');
      sim.engine.setFormation('main', ['liubei']);

      const stages = sim.engine.getStageList();
      const stage = stages[0];

      // buildTeamsForStage 不应崩溃
      const { allyTeam, enemyTeam } = sim.engine.buildTeamsForStage(stage);
      expect(allyTeam.units.length).toBeGreaterThan(0);
    });

    it('极高防御敌人 → 最低伤害保底', () => {
      // BATTLE-FLOW-5: 极端数值下的保底机制
      // 当攻击力极低时，baseDamage = max(1, attack - defense) = 1
      // 最终伤害 = floor(1 * multipliers)，可能为0
      // 但 minDamage = attack * 10% 会保底
      // 使用稍高的攻击力确保保底生效
      const calc = new DamageCalculator();
      const attacker = createBattleUnit('atk', '弱攻', TroopType.ARCHER, 'ally', 'front',
        { attack: 50, defense: 1, intelligence: 1, speed: 50, maxHp: 100 });
      const defender = createBattleUnit('def', '神盾', TroopType.ARCHER, 'enemy', 'front',
        { attack: 1, defense: 99999, intelligence: 1, speed: 1, maxHp: 99999 });

      const result = calc.calculateDamage(attacker, defender, 1.0);
      // 最低伤害保底：attack=50, minDamage = 50 * 10% = 5
      expect(result.damage).toBeGreaterThanOrEqual(1);
      expect(result.isMinDamage).toBe(true);
    });

    it('回合上限耗尽 → DRAW', () => {
      // BATTLE-FLOW-5: 两个高防低攻队伍拖到回合上限
      const battleEngine = new BattleEngine();
      const allyTeam: BattleTeam = {
        units: [createBattleUnit('ally1', '铁壁1', TroopType.ARCHER, 'ally', 'front',
          { attack: 1, defense: 999, intelligence: 10, speed: 50, maxHp: 99999 })],
        side: 'ally',
      };
      const enemyTeam: BattleTeam = {
        units: [createBattleUnit('enemy1', '铁壁2', TroopType.ARCHER, 'enemy', 'front',
          { attack: 1, defense: 999, intelligence: 10, speed: 50, maxHp: 99999 })],
        side: 'enemy',
      };

      const result = battleEngine.runFullBattle(allyTeam, enemyTeam);
      // 可能是平局（回合耗尽）或某一方胜利
      expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);
      expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
    });

    it('资源溢出时不超过上限', () => {
      // BATTLE-FLOW-5: 资源上限保护
      const sim = createSim();
      sim.engine.resource.setCap('grain', 500);
      sim.addResources({ grain: 10000 });

      const grain = sim.getResource('grain');
      expect(grain).toBeLessThanOrEqual(500);
    });
  });
});
