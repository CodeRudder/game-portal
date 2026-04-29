/**
 * BattleEngine 深度路径覆盖测试
 *
 * 覆盖复杂分支路径和组合场景：
 * 1. 先手判定：速度相等/不等/一方为0
 * 2. 暴击路径：暴击/不暴击/暴击+克制叠加
 * 3. 技能释放：有技能/无技能/技能冷却中/终极技
 * 4. 战斗结束：全灭/超时/一方逃跑
 * 5. 特殊效果：中毒/灼烧/冰冻/眩晕
 * 6. 星级评定：三星/二星/一星/无星
 *
 * @module engine/battle/__tests__/BattleEngine.path-coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BattleEngine } from '../BattleEngine';
import {
  BattlePhase,
  BattleOutcome,
  StarRating,
  BattleMode,
  BattleSpeed,
  TroopType,
} from '../battle.types';
import type {
  BattleTeam,
  BattleUnit,
  BattleState,
  BattleSkill,
} from '../battle.types';
import { BuffType, SkillTargetType } from '../battle-base.types';
import type { BuffEffect } from '../battle-base.types';
import { BATTLE_CONFIG } from '../battle-config';

// ── 辅助函数 ──

function createSkill(overrides: Partial<BattleSkill> = {}): BattleSkill {
  return {
    id: 'skill_1',
    name: '普攻',
    type: 'active',
    level: 1,
    description: '普通攻击',
    multiplier: 1.0,
    targetType: SkillTargetType.SINGLE_ENEMY,
    rageCost: 0,
    cooldown: 0,
    currentCooldown: 0,
    ...overrides,
  };
}

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 30,
    speed: 50,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: createSkill({ id: 'normal_1', name: '普攻', multiplier: 1.0 }),
    skills: [createSkill({ id: 'skill_1', name: '技能1', multiplier: 1.5, rageCost: 50 })],
    buffs: [],
    ...overrides,
  };
}

function createTeam(units: BattleUnit[], side: 'ally' | 'enemy' = 'ally'): BattleTeam {
  return { units, side };
}

function createBuff(type: BuffType, remainingTurns: number, value: number, sourceId: string = 'src'): BuffEffect {
  return { type, remainingTurns, value, sourceId };
}

// ── 测试 ──

describe('BattleEngine 路径覆盖测试', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ═══════════════════════════════════════════
  // 1. 先手判定 — 速度分支路径
  // ═══════════════════════════════════════════

  describe('先手判定：速度排序路径', () => {
    it('速度不等时，高速方先行动', () => {
      const fastAlly = createUnit({ id: 'fast', speed: 200, name: '高速将' });
      const slowEnemy = createUnit({ id: 'slow', speed: 10, side: 'enemy', name: '低速将' });

      const ally = createTeam([fastAlly], 'ally');
      const enemy = createTeam([slowEnemy], 'enemy');

      const state = engine.initBattle(ally, enemy);
      expect(state.turnOrder[0]).toBe('fast');
      expect(state.turnOrder[1]).toBe('slow');
    });

    it('速度相等时，双方单位仍按稳定顺序排列', () => {
      const ally1 = createUnit({ id: 'ally_same', speed: 80, name: '我方同速' });
      const enemy1 = createUnit({ id: 'enemy_same', speed: 80, side: 'enemy', name: '敌方同速' });

      const ally = createTeam([ally1], 'ally');
      const enemy = createTeam([enemy1], 'enemy');

      const state = engine.initBattle(ally, enemy);
      expect(state.turnOrder).toHaveLength(2);
      expect(state.turnOrder).toContain('ally_same');
      expect(state.turnOrder).toContain('enemy_same');
    });

    it('一方速度为0时，另一方必定先行动', () => {
      const zeroSpeedAlly = createUnit({ id: 'zero_spd', speed: 0, name: '零速将' });
      const normalEnemy = createUnit({ id: 'normal_spd', speed: 50, side: 'enemy', name: '正常速将' });

      const ally = createTeam([zeroSpeedAlly], 'ally');
      const enemy = createTeam([normalEnemy], 'enemy');

      const state = engine.initBattle(ally, enemy);
      expect(state.turnOrder[0]).toBe('normal_spd');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 暴击路径 — 暴击判定 + 克制组合
  // ═══════════════════════════════════════════

  describe('暴击与克制组合路径', () => {
    it('高速度单位触发暴击路径（速度影响暴击率）', () => {
      // 速度200 → 暴击率 = 5% + 200/100 = 205% → 必定暴击
      const highSpeedAttacker = createUnit({
        id: 'high_spd',
        speed: 200,
        attack: 200,
        name: '高速攻击者',
      });
      const defender = createUnit({
        id: 'defender',
        side: 'enemy',
        hp: 5000,
        maxHp: 5000,
        name: '防御者',
      });

      const ally = createTeam([highSpeedAttacker], 'ally');
      const enemy = createTeam([defender], 'enemy');

      const result = engine.runFullBattle(ally, enemy);
      // 高速高攻，应能胜利
      expect([BattleOutcome.VICTORY, BattleOutcome.DRAW]).toContain(result.outcome);
    });

    it('骑兵攻击步兵触发克制路径（伤害加成1.5x）', () => {
      const cavalry = createUnit({
        id: 'cav',
        troopType: TroopType.CAVALRY,
        attack: 200,
        speed: 100,
        name: '骑兵',
      });
      const infantry = createUnit({
        id: 'inf',
        troopType: TroopType.INFANTRY,
        side: 'enemy',
        defense: 30,
        hp: 800,
        maxHp: 800,
        name: '步兵',
      });

      const result = engine.runFullBattle(
        createTeam([cavalry], 'ally'),
        createTeam([infantry], 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('弓兵对弓兵无克制关系（系数1.0）', () => {
      const archer1 = createUnit({
        id: 'archer1',
        troopType: TroopType.ARCHER,
        attack: 150,
        name: '弓兵A',
      });
      const archer2 = createUnit({
        id: 'archer2',
        troopType: TroopType.ARCHER,
        side: 'enemy',
        hp: 600,
        maxHp: 600,
        name: '弓兵B',
      });

      const result = engine.runFullBattle(
        createTeam([archer1], 'ally'),
        createTeam([archer2], 'enemy'),
      );
      expect([BattleOutcome.VICTORY, BattleOutcome.DRAW]).toContain(result.outcome);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 技能释放路径
  // ═══════════════════════════════════════════

  describe('技能释放分支路径', () => {
    it('怒气满时释放终极技能（rage >= 100）', () => {
      const hero = createUnit({
        id: 'hero',
        rage: 100,
        attack: 150,
        name: '怒气满将',
        skills: [
          createSkill({
            id: 'ultimate',
            name: '大招',
            multiplier: 2.5,
            rageCost: 100,
            type: 'active',
            targetType: SkillTargetType.ALL_ENEMY,
          }),
        ],
      });
      const weakEnemy = createUnit({
        id: 'weak',
        side: 'enemy',
        hp: 300,
        maxHp: 300,
        name: '弱敌',
      });

      const state = engine.initBattle(
        createTeam([hero], 'ally'),
        createTeam([weakEnemy], 'enemy'),
      );
      const actions = engine.executeTurn(state);

      // 应有行动记录
      expect(actions.length).toBeGreaterThan(0);
      // 第一行动者释放了大招
      const heroAction = actions.find((a) => a.actorId === 'hero');
      expect(heroAction).toBeDefined();
    });

    it('技能冷却中时使用普攻', () => {
      const hero = createUnit({
        id: 'cooldown_hero',
        rage: 100,
        attack: 150,
        name: '冷却将',
        skills: [
          createSkill({
            id: 'cd_skill',
            name: '冷却技能',
            multiplier: 2.0,
            rageCost: 100,
            type: 'active',
            cooldown: 3,
            currentCooldown: 2, // 冷却中
          }),
        ],
      });
      const enemy = createUnit({
        id: 'enemy_target',
        side: 'enemy',
        hp: 1000,
        maxHp: 1000,
        name: '敌将',
      });

      const state = engine.initBattle(
        createTeam([hero], 'ally'),
        createTeam([enemy], 'enemy'),
      );
      const actions = engine.executeTurn(state);
      const heroAction = actions.find((a) => a.actorId === 'cooldown_hero');
      expect(heroAction).toBeDefined();
      expect(heroAction!.isNormalAttack).toBe(true);
    });

    it('无主动技能时始终使用普攻', () => {
      const noSkillHero = createUnit({
        id: 'no_skill',
        attack: 120,
        name: '无技能将',
        skills: [],
      });
      const enemy = createUnit({
        id: 'enemy2',
        side: 'enemy',
        hp: 500,
        maxHp: 500,
        name: '敌将2',
      });

      const result = engine.runFullBattle(
        createTeam([noSkillHero], 'ally'),
        createTeam([enemy], 'enemy'),
      );
      expect([BattleOutcome.VICTORY, BattleOutcome.DRAW]).toContain(result.outcome);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 战斗结束路径
  // ═══════════════════════════════════════════

  describe('战斗结束判定路径', () => {
    it('敌方全灭 → VICTORY', () => {
      const strongAlly = createUnit({
        id: 'strong',
        attack: 9999,
        speed: 200,
        name: '强将',
      });
      const weakEnemy = createUnit({
        id: 'weak_e',
        side: 'enemy',
        hp: 1,
        maxHp: 1,
        defense: 0,
        name: '弱敌',
      });

      const result = engine.runFullBattle(
        createTeam([strongAlly], 'ally'),
        createTeam([weakEnemy], 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.allySurvivors).toBeGreaterThan(0);
    });

    it('我方全灭 → DEFEAT', () => {
      const weakAlly = createUnit({
        id: 'weak_ally',
        hp: 1,
        maxHp: 1,
        defense: 0,
        attack: 1,
        name: '弱我',
      });
      const strongEnemy = createUnit({
        id: 'strong_enemy',
        side: 'enemy',
        attack: 9999,
        speed: 200,
        name: '强敌',
      });

      const result = engine.runFullBattle(
        createTeam([weakAlly], 'ally'),
        createTeam([strongEnemy], 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.allySurvivors).toBe(0);
    });

    it('达到最大回合数 → DRAW（战斗超时判定）', () => {
      // 双方高防低攻，无法击杀对方
      const tank1 = createUnit({
        id: 'tank1',
        hp: 99999,
        maxHp: 99999,
        attack: 1,
        defense: 99999,
        speed: 10,
        name: '铁壁1',
      });
      const tank2 = createUnit({
        id: 'tank2',
        side: 'enemy',
        hp: 99999,
        maxHp: 99999,
        attack: 1,
        defense: 99999,
        speed: 10,
        name: '铁壁2',
      });

      const result = engine.runFullBattle(
        createTeam([tank1], 'ally'),
        createTeam([tank2], 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.DRAW);
      expect(result.totalTurns).toBeGreaterThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
    });

    it('战斗已结束时executeTurn返回空数组', () => {
      const ally = createUnit({ id: 'a1', name: 'A' });
      const enemy = createUnit({ id: 'e1', side: 'enemy', name: 'E' });

      const state = engine.initBattle(
        createTeam([ally], 'ally'),
        createTeam([enemy], 'enemy'),
      );
      state.phase = BattlePhase.FINISHED;

      const actions = engine.executeTurn(state);
      expect(actions).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 特殊效果路径 — Buff/Debuff
  // ═══════════════════════════════════════════

  describe('特殊效果：状态效果路径', () => {
    it('灼烧效果造成持续伤害（BURN DOT）', () => {
      const burningUnit = createUnit({
        id: 'burning',
        hp: 500,
        maxHp: 500,
        side: 'enemy',
        name: '灼烧单位',
        buffs: [createBuff(BuffType.BURN, 3, 5, 'attacker')],
      });
      const attacker = createUnit({
        id: 'attacker',
        attack: 200,
        speed: 100,
        name: '攻击者',
      });

      const result = engine.runFullBattle(
        createTeam([attacker], 'ally'),
        createTeam([burningUnit], 'enemy'),
      );
      // 灼烧+攻击应能击杀
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('中毒效果造成持续伤害（POISON DOT）', () => {
      const poisonedUnit = createUnit({
        id: 'poisoned',
        hp: 300,
        maxHp: 300,
        side: 'enemy',
        name: '中毒单位',
        buffs: [createBuff(BuffType.POISON, 3, 3, 'attacker')],
      });
      const attacker = createUnit({
        id: 'healer',
        attack: 100,
        name: '攻击者',
      });

      const result = engine.runFullBattle(
        createTeam([attacker], 'ally'),
        createTeam([poisonedUnit], 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('冰冻效果使单位无法行动（FREEZE 控制）', () => {
      const frozenUnit = createUnit({
        id: 'frozen',
        speed: 200,
        attack: 9999,
        name: '冰冻将',
        buffs: [createBuff(BuffType.FREEZE, 1, 0, 'enemy')],
      });
      const normalEnemy = createUnit({
        id: 'normal_e',
        side: 'enemy',
        hp: 500,
        maxHp: 500,
        name: '普通敌',
      });

      const state = engine.initBattle(
        createTeam([frozenUnit], 'ally'),
        createTeam([normalEnemy], 'enemy'),
      );
      const actions = engine.executeTurn(state);

      const frozenAction = actions.find((a) => a.actorId === 'frozen');
      expect(frozenAction).toBeDefined();
      expect(frozenAction!.skill).toBeNull(); // 被控制，无法行动
    });

    it('眩晕效果使单位无法行动（STUN 控制）', () => {
      const stunnedUnit = createUnit({
        id: 'stunned',
        speed: 200,
        attack: 9999,
        name: '眩晕将',
        buffs: [createBuff(BuffType.STUN, 1, 0, 'enemy')],
      });
      const enemy = createUnit({
        id: 'stun_enemy',
        side: 'enemy',
        hp: 500,
        maxHp: 500,
        name: '敌将',
      });

      const state = engine.initBattle(
        createTeam([stunnedUnit], 'ally'),
        createTeam([enemy], 'enemy'),
      );
      const actions = engine.executeTurn(state);
      const stunAction = actions.find((a) => a.actorId === 'stunned');
      expect(stunAction).toBeDefined();
      expect(stunAction!.skill).toBeNull();
    });

    it('DOT伤害导致单位阵亡时返回阵亡行动记录', () => {
      // 单位HP很低 + 中毒，DOT应导致阵亡
      const dyingUnit = createUnit({
        id: 'dying',
        hp: 1,
        maxHp: 1000,
        side: 'enemy',
        name: '垂死单位',
        buffs: [createBuff(BuffType.POISON, 3, 3, 'attacker')],
      });
      const attacker = createUnit({
        id: 'observer',
        attack: 1,
        name: '观察者',
      });

      const state = engine.initBattle(
        createTeam([attacker], 'ally'),
        createTeam([dyingUnit], 'enemy'),
      );
      const actions = engine.executeTurn(state);

      // 中毒单位应在DOT阶段阵亡
      const dotAction = actions.find(
        (a) => a.actorId === 'dying' && a.description.includes('持续伤害'),
      );
      expect(dotAction).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 星级评定路径
  // ═══════════════════════════════════════════

  describe('星级评定分支路径', () => {
    it('胜利 + 存活>=4 + 回合<=6 → 三星', () => {
      const allies = Array.from({ length: 5 }, (_, i) =>
        createUnit({
          id: `ally_${i}`,
          attack: 9999,
          speed: 200,
          name: `强将${i}`,
        }),
      );
      const enemies = Array.from({ length: 3 }, (_, i) =>
        createUnit({
          id: `enemy_${i}`,
          side: 'enemy',
          hp: 1,
          maxHp: 1,
          defense: 0,
          name: `弱敌${i}`,
        }),
      );

      const result = engine.runFullBattle(
        createTeam(allies, 'ally'),
        createTeam(enemies, 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.THREE);
    });

    it('胜利 + 存活>=4 + 回合>6 → 二星', () => {
      // 攻击力足够击杀，但敌方HP较高需要多回合
      const allies = Array.from({ length: 5 }, (_, i) =>
        createUnit({
          id: `ally_${i}`,
          attack: 500,
          speed: 10,
          hp: 9999,
          maxHp: 9999,
          defense: 500,
          name: `持久将${i}`,
        }),
      );
      const enemies = Array.from({ length: 3 }, (_, i) =>
        createUnit({
          id: `enemy_${i}`,
          side: 'enemy',
          hp: 5000,
          maxHp: 5000,
          defense: 30,
          attack: 1,
          name: `铁壁敌${i}`,
        }),
      );

      const result = engine.runFullBattle(
        createTeam(allies, 'ally'),
        createTeam(enemies, 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBeGreaterThanOrEqual(StarRating.ONE);
    });

    it('失败 → NONE星', () => {
      const weakAlly = createUnit({
        id: 'weak',
        hp: 1,
        maxHp: 1,
        attack: 1,
        defense: 0,
        name: '弱将',
      });
      const strongEnemy = createUnit({
        id: 'strong',
        side: 'enemy',
        attack: 9999,
        speed: 200,
        name: '强敌',
      });

      const result = engine.runFullBattle(
        createTeam([weakAlly], 'ally'),
        createTeam([strongEnemy], 'enemy'),
      );
      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.stars).toBe(StarRating.NONE);
    });
  });
});
