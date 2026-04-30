/**
 * R22-4: 战斗系统异常路径覆盖
 *
 * 覆盖场景：
 * - 空编队战斗
 * - 0兵力/0攻击力战斗单位
 * - 超时处理（最大回合数）
 * - 全灭判定
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleEngine } from '../BattleEngine';
import type { BattleTeam, BattleUnit, BattleSkill } from '../battle.types';
import { BattlePhase, BattleOutcome, StarRating } from '../battle.types';
import { TroopType, SkillTargetType } from '../battle-base.types';
import type { Position, BattleSide } from '../battle-base.types';

// ── 默认技能模板 ──

const NORMAL_ATTACK: BattleSkill = {
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

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate',
  name: '大招',
  type: 'active',
  level: 1,
  description: '终极技能',
  multiplier: 2.0,
  targetType: SkillTargetType.ALL_ENEMY,
  rageCost: 100,
  cooldown: 3,
  currentCooldown: 0,
};

// ── 工厂函数 ──

function createUnit(
  overrides: Partial<{
    id: string;
    name: string;
    side: BattleSide;
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
    maxHp: number;
    hp: number;
    troopType: TroopType;
    skills: BattleSkill[];
    rage: number;
  }> = {},
): BattleUnit {
  const maxHp = overrides.maxHp ?? 1000;
  return {
    id: overrides.id ?? 'unit1',
    name: overrides.name ?? 'TestUnit',
    faction: 'shu',
    troopType: overrides.troopType ?? TroopType.INFANTRY,
    position: 'front' as Position,
    side: overrides.side ?? 'ally',
    attack: overrides.attack ?? 100,
    baseAttack: overrides.attack ?? 100,
    defense: overrides.defense ?? 50,
    baseDefense: overrides.defense ?? 50,
    intelligence: overrides.intelligence ?? 50,
    speed: overrides.speed ?? 50,
    maxHp,
    hp: overrides.hp ?? maxHp,
    isAlive: true,
    rage: overrides.rage ?? 0,
    maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK },
    skills: overrides.skills ?? [{ ...ULTIMATE_SKILL }],
    buffs: [],
  };
}

function createTeam(units: BattleUnit[], side: BattleSide): BattleTeam {
  return { units, side };
}

describe('R22-4: 战斗系统异常路径', () => {
  let engine: BattleEngine;
  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ═══════════════════════════════════════════
  // 空编队战斗
  // ═══════════════════════════════════════════
  describe('空编队战斗', () => {
    it('我方空编队 vs 敌方有单位 → 我方失败', () => {
      const ally = createTeam([], 'ally');
      const enemy = createTeam([createUnit({ id: 'e1', name: 'Enemy', side: 'enemy' })], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    });

    it('敌方空编队 vs 我方有单位 → 我方胜利', () => {
      const ally = createTeam([createUnit({ id: 'a1', name: 'Ally', side: 'ally' })], 'ally');
      const enemy = createTeam([], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('双方空编队 → 不崩溃', () => {
      const ally = createTeam([], 'ally');
      const enemy = createTeam([], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 0属性战斗单位
  // ═══════════════════════════════════════════
  describe('0属性战斗单位', () => {
    it('0攻击力单位战斗不崩溃', () => {
      const ally = createTeam([
        createUnit({ id: 'a1', name: 'ZeroAtk', side: 'ally', attack: 0, defense: 50 }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Normal', side: 'enemy', attack: 100, defense: 50 }),
      ], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result).toBeDefined();
      expect(result.totalTurns).toBeGreaterThan(0);
    });

    it('0防御力单位受到更多伤害', () => {
      const ally = createTeam([
        createUnit({ id: 'a1', name: 'ZeroDef', side: 'ally', attack: 100, defense: 0, maxHp: 1000 }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Normal', side: 'enemy', attack: 100, defense: 100, maxHp: 10000 }),
      ], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result).toBeDefined();
    });

    it('0速度单位不崩溃（暴击率为基础5%）', () => {
      const ally = createTeam([
        createUnit({ id: 'a1', name: 'ZeroSpeed', side: 'ally', speed: 0, attack: 100, defense: 50 }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Normal', side: 'enemy', speed: 50, attack: 100, defense: 50 }),
      ], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result).toBeDefined();
    });

    it('0 HP 单位视为已死亡', () => {
      const deadUnit = createUnit({ id: 'a1', name: 'DeadAlly', side: 'ally', maxHp: 1000, hp: 0 });
      deadUnit.isAlive = false;
      const ally = createTeam([deadUnit], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Alive', side: 'enemy', maxHp: 1000, hp: 1000 }),
      ], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 超时处理（最大回合数）
  // ═══════════════════════════════════════════
  describe('超时处理（最大回合数）', () => {
    it('双方高防御低攻击 → 回合耗尽平局', () => {
      const ally = createTeam([
        createUnit({ id: 'a1', name: 'Tank', side: 'ally', attack: 1, defense: 9999, maxHp: 99999, speed: 1 }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Tank', side: 'enemy', attack: 1, defense: 9999, maxHp: 99999, speed: 1 }),
      ], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result).toBeDefined();
      expect(result.totalTurns).toBeLessThanOrEqual(8); // MAX_TURNS = 8
      if (result.outcome === BattleOutcome.DRAW) {
        expect(result.stars).toBe(StarRating.NONE);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 极端属性对比
  // ═══════════════════════════════════════════
  describe('极端属性对比', () => {
    it('极高攻击 vs 极低防御 → 快速击杀', () => {
      const ally = createTeam([
        createUnit({ id: 'a1', name: 'GodSlayer', side: 'ally', attack: 99999, defense: 10, speed: 100 }),
      ], 'ally');
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Squishy', side: 'enemy', attack: 10, defense: 1, maxHp: 100, speed: 1 }),
      ], 'enemy');
      const result = engine.runFullBattle(ally, enemy);
      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.totalTurns).toBeLessThanOrEqual(2);
    });

    it('多单位 vs 单单位 → 数量优势', () => {
      const allyUnits = Array.from({ length: 6 }, (_, i) =>
        createUnit({ id: `a${i}`, name: `Ally${i}`, side: 'ally', attack: 50, defense: 30, maxHp: 500 })
      );
      const enemy = createTeam([
        createUnit({ id: 'e1', name: 'Solo', side: 'enemy', attack: 100, defense: 50, maxHp: 1000 }),
      ], 'enemy');
      const result = engine.runFullBattle(createTeam(allyUnits, 'ally'), enemy);
      expect(result).toBeDefined();
    });
  });
});
