import { vi } from 'vitest';
/**
 * 战斗引擎 — 单元测试
 *
 * 覆盖：
 * - 战斗初始化
 * - 回合行动顺序（速度排序）
 * - 技能选择（普攻/大招）
 * - 目标选择
 * - 怒气系统
 * - 胜负判定
 * - 星级评定
 * - 完整战斗流程
 *
 * @module engine/battle/__tests__/BattleEngine.test
 */

import { BattleEngine } from '../BattleEngine';
import type {
  BattleTeam,
  BattleUnit,
  BattleSkill,
  BattleState,
} from '../battle.types';
import {
  BATTLE_CONFIG,
  BattleOutcome,
  BattlePhase,
  BuffType,
  StarRating,
  TroopType,
} from '../battle.types';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal',
  name: '普攻',
  type: 'active',
  level: 1,
  description: '普通攻击',
  multiplier: 1.0,
  targetType: 'SINGLE_ENEMY',
  rageCost: 0,
  cooldown: 0,
  currentCooldown: 0,
};

const ULTIMATE_SKILL: BattleSkill = {
  id: 'ultimate',
  name: '大招',
  type: 'active',
  level: 1,
  description: '强力技能',
  multiplier: 2.0,
  targetType: 'ALL_ENEMY',
  rageCost: 100,
  cooldown: 3,
  currentCooldown: 0,
};

/** 创建测试用战斗单位 */
function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将',
    faction: 'shu',
    troopType: TroopType.CAVALRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 50,
    baseDefense: 50,
    intelligence: 60,
    speed: 80,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK },
    skills: [{ ...ULTIMATE_SKILL }],
    buffs: [],
    ...overrides,
  };
}

/** 创建测试队伍 */
function createTeam(
  side: 'ally' | 'enemy',
  count: number,
  overrides: Partial<BattleUnit> = {},
): BattleTeam {
  const units: BattleUnit[] = [];
  for (let i = 0; i < count; i++) {
    const position = i < 3 ? 'front' as const : 'back' as const;
    units.push(
      createUnit({
        id: `${side}_${i}`,
        name: `${side === 'ally' ? '我方' : '敌方'}${i + 1}`,
        side,
        position,
        ...overrides,
      }),
    );
  }
  return { units, side };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BattleEngine', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  // ── 战斗初始化 ──

  describe('initBattle', () => {
    it('应正确初始化战斗状态', () => {
      const ally = createTeam('ally', 3);
      const enemy = createTeam('enemy', 3);

      const state = engine.initBattle(ally, enemy);

      expect(state.phase).toBe(BattlePhase.IN_PROGRESS);
      expect(state.currentTurn).toBe(1);
      expect(state.maxTurns).toBe(BATTLE_CONFIG.MAX_TURNS);
      expect(state.allyTeam).toBe(ally);
      expect(state.enemyTeam).toBe(enemy);
      expect(state.actionLog).toHaveLength(0);
      expect(state.result).toBeNull();
    });

    it('应按速度排序生成行动顺序', () => {
      const ally = createTeam('ally', 2);
      const enemy = createTeam('enemy', 2);

      // 设置不同速度
      ally.units[0].speed = 100;
      ally.units[0].id = 'fast_ally';
      ally.units[1].speed = 50;
      ally.units[1].id = 'slow_ally';
      enemy.units[0].speed = 80;
      enemy.units[0].id = 'mid_enemy';
      enemy.units[1].speed = 30;
      enemy.units[1].id = 'slowest_enemy';

      const state = engine.initBattle(ally, enemy);

      // 顺序应为：fast_ally(100) > mid_enemy(80) > slow_ally(50) > slowest_enemy(30)
      expect(state.turnOrder).toEqual([
        'fast_ally',
        'mid_enemy',
        'slow_ally',
        'slowest_enemy',
      ]);
    });
  });

  // ── 回合执行 ──

  describe('executeTurn', () => {
    it('应执行一个完整回合', () => {
      const ally = createTeam('ally', 1, { attack: 200, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 200, defense: 0, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      // 双方各行动一次
      expect(actions.length).toBeGreaterThanOrEqual(2);
      expect(state.currentTurn).toBe(1);
    });

    it('战斗结束后不应再执行回合', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      const state = engine.initBattle(ally, enemy);
      state.phase = BattlePhase.FINISHED;

      const actions = engine.executeTurn(state);
      expect(actions).toHaveLength(0);
    });

    it('死亡单位不应行动', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      ally.units[0].isAlive = false;

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      // 只有敌方行动
      expect(actions.every((a) => a.actorSide === 'enemy')).toBe(true);
    });
  });

  // ── 技能选择 ──

  describe('技能选择', () => {
    it('怒气满时应释放大招', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      // 设置怒气满
      ally.units[0].rage = BATTLE_CONFIG.MAX_RAGE;

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      // 应该释放了大招
      const mainAction = actions.find((a) => a.actorId === ally.units[0].id);
      expect(mainAction).toBeDefined();
      expect(mainAction!.isNormalAttack).toBe(false);
      expect(mainAction!.skill!.name).toBe('大招');
    });

    it('怒气不足时应使用普攻', () => {
      const ally = createTeam('ally', 1, { troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { troopType: TroopType.ARCHER });

      ally.units[0].rage = 50; // 未满

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      const mainAction = actions.find((a) => a.actorId === ally.units[0].id);
      expect(mainAction!.isNormalAttack).toBe(true);
    });

    it('技能在冷却中时应使用普攻', () => {
      const ally = createTeam('ally', 1, { troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { troopType: TroopType.ARCHER });

      ally.units[0].rage = BATTLE_CONFIG.MAX_RAGE;
      ally.units[0].skills[0].currentCooldown = 2; // 技能冷却中

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      const mainAction = actions.find((a) => a.actorId === ally.units[0].id);
      expect(mainAction!.isNormalAttack).toBe(true);
    });
  });

  // ── 目标选择 ──

  describe('目标选择', () => {
    it('单体技能应优先攻击前排', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      const action = actions.find((a) => a.actorSide === 'ally');
      expect(action).toBeDefined();
      // 目标应该是前排之一
      const frontIds = enemy.units.filter((u) => u.position === 'front').map((u) => u.id);
      expect(frontIds).toContain(action!.targetIds[0]);
    });

    it('全体技能应攻击所有存活敌人', () => {
      const ally = createTeam('ally', 1, {
        attack: 100,
        defense: 0,
        troopType: TroopType.ARCHER,
        rage: BATTLE_CONFIG.MAX_RAGE, // 怒气满，释放大招
      });
      const enemy = createTeam('enemy', 3, {
        attack: 0,
        defense: 0,
        hp: 10000,
        maxHp: 10000,
        troopType: TroopType.ARCHER,
      });

      // 大招目标类型为ALL_ENEMY
      ally.units[0].skills[0].targetType = 'ALL_ENEMY';

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      const action = actions.find((a) => a.actorSide === 'ally' && !a.isNormalAttack);
      expect(action).toBeDefined();
      expect(action!.targetIds).toHaveLength(3);
    });
  });

  // ── 怒气系统 ──

  describe('怒气系统', () => {
    it('普攻后应增加怒气', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // 攻击者怒气应增加（普攻+25，可能受击+15）
      expect(ally.units[0].rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_ATTACK);
    });

    it('受击后应增加怒气', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 500, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // 被击者怒气应增加
      expect(enemy.units[0].rage).toBeGreaterThanOrEqual(BATTLE_CONFIG.RAGE_GAIN_HIT);
    });

    it('怒气不应超过上限', () => {
      const ally = createTeam('ally', 1, { attack: 500, defense: 0, troopType: TroopType.ARCHER, rage: 90 });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      expect(ally.units[0].rage).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_RAGE);
    });
  });

  // ── 胜负判定 ──

  describe('isBattleOver', () => {
    it('我方全灭时应结束', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      ally.units[0].isAlive = false;

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(true);
    });

    it('敌方全灭时应结束', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      enemy.units[0].isAlive = false;

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(true);
    });

    it('双方都有存活单位时应继续', () => {
      const ally = createTeam('ally', 1);
      const enemy = createTeam('enemy', 1);

      const state = engine.initBattle(ally, enemy);
      expect(engine.isBattleOver(state)).toBe(false);
    });
  });

  // ── 星级评定 ──

  describe('星级评定', () => {
    it('胜利 + 存活≥4 + 回合≤6 → 三星', () => {
      const ally = createTeam('ally', 6, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.THREE);
    });

    it('胜利 + 存活≥4 + 回合>6 → 二星', () => {
      // 使用确定性伤害计算器，每次攻击固定造成50伤害
      const deterministicCalc = {
        calculateDamage: () => ({
          damage: 50,
          baseDamage: 50,
          skillMultiplier: 1.0,
          isCritical: false,
          criticalMultiplier: 1.0,
          restraintMultiplier: 1.0,
          randomFactor: 1.0,
          isMinDamage: false,
        }),
        applyDamage: (_defender: BattleUnit, damage: number) => {
          const actual = Math.min(damage, _defender.hp);
          _defender.hp -= actual;
          if (_defender.hp <= 0) {
            _defender.hp = 0;
            _defender.isAlive = false;
          }
          return actual;
        },
        calculateDotDamage: () => 0,
        isControlled: () => false,
      };

      const customEngine = new BattleEngine(deterministicCalc as unknown as Record<string, unknown>);

      // 6个盟友，每次攻击50伤害，每回合300伤害
      // HP=1800：6回合=1800刚好不够（需要>1800），7回合=2100够了
      const ally = createTeam('ally', 6, { attack: 50, defense: 99999, hp: 99999, maxHp: 99999, speed: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1801, maxHp: 1801, troopType: TroopType.ARCHER });

      const result = customEngine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.totalTurns).toBe(7); // 确定性地需要7回合
      expect(result.stars).toBe(StarRating.TWO);
    });

    it('胜利 + 存活<4 → 一星', () => {
      const ally = createTeam('ally', 2, { attack: 99999, defense: 0, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
      expect(result.stars).toBe(StarRating.ONE);
    });

    it('失败 → 无星级', () => {
      const ally = createTeam('ally', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 99999, defense: 99999, hp: 99999, maxHp: 99999, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.DEFEAT);
      expect(result.stars).toBe(StarRating.NONE);
    });
  });

  // ── 完整战斗 ──

  describe('runFullBattle', () => {
    it('应运行完整战斗并返回结果', () => {
      const ally = createTeam('ally', 3, { attack: 200, defense: 50, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 100, defense: 30, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBeDefined();
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeLessThanOrEqual(BATTLE_CONFIG.MAX_TURNS);
      expect(result.allyTotalDamage).toBeGreaterThan(0);
      expect(result.summary).toBeTruthy();
    });

    it('强队应击败弱队', () => {
      const ally = createTeam('ally', 6, { attack: 500, defense: 200, hp: 5000, maxHp: 5000, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 50, defense: 20, hp: 500, maxHp: 500, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });

    it('回合耗尽应为平局', () => {
      // 双方防御极高，攻击极低，无法击杀
      const ally = createTeam('ally', 1, { attack: 1, defense: 99999, hp: 99999, maxHp: 99999, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { attack: 1, defense: 99999, hp: 99999, maxHp: 99999, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.outcome).toBe(BattleOutcome.DRAW);
    });

    it('战斗结果应包含统计信息', () => {
      const ally = createTeam('ally', 3, { attack: 200, defense: 50, troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 3, { attack: 100, defense: 30, troopType: TroopType.ARCHER });

      const result = engine.runFullBattle(ally, enemy);

      expect(result.allyTotalDamage).toBeGreaterThan(0);
      expect(result.enemyTotalDamage).toBeGreaterThan(0);
      expect(result.maxSingleDamage).toBeGreaterThan(0);
      expect(typeof result.maxCombo).toBe('number');
    });
  });

  // ── 控制效果 ──

  describe('控制效果', () => {
    it('眩晕时单位无法行动', () => {
      const ally = createTeam('ally', 1, {
        attack: 200,
        defense: 0,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.STUN, remainingTurns: 1, value: 0, sourceId: 's' }],
      });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 10000, maxHp: 10000, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      const actions = engine.executeTurn(state);

      const stunAction = actions.find((a) => a.actorId === ally.units[0].id);
      expect(stunAction).toBeDefined();
      expect(stunAction!.skill).toBeNull(); // 被控制，无技能
      expect(stunAction!.description).toContain('被控制');
    });
  });

  // ── Buff持续时间 ──

  describe('Buff持续时间', () => {
    it('回合结束后应减少Buff持续时间', () => {
      const ally = createTeam('ally', 1, {
        attack: 99999,
        defense: 0,
        troopType: TroopType.ARCHER,
        buffs: [{ type: BuffType.ATK_UP, remainingTurns: 2, value: 0.2, sourceId: 's' }],
      });
      const enemy = createTeam('enemy', 1, { attack: 0, defense: 0, hp: 1, maxHp: 1, troopType: TroopType.ARCHER });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // Buff剩余回合应减少
      expect(ally.units[0].buffs[0].remainingTurns).toBe(1);
    });
  });

  // ── 依赖注入 ──

  describe('依赖注入', () => {
    it('应支持注入自定义伤害计算器', () => {
      const customCalculator = {
        calculateDamage: vi.fn().mockReturnValue({
          damage: 999,
          baseDamage: 999,
          skillMultiplier: 1.0,
          isCritical: false,
          criticalMultiplier: 1.0,
          restraintMultiplier: 1.0,
          randomFactor: 1.0,
          isMinDamage: false,
        }),
        applyDamage: vi.fn().mockReturnValue(999),
        calculateDotDamage: vi.fn().mockReturnValue(0),
        isControlled: vi.fn().mockReturnValue(false),
      };

      const customEngine = new BattleEngine(customCalculator);
      const ally = createTeam('ally', 1, { troopType: TroopType.ARCHER });
      const enemy = createTeam('enemy', 1, { troopType: TroopType.ARCHER });

      customEngine.runFullBattle(ally, enemy);

      expect(customCalculator.calculateDamage).toHaveBeenCalled();
    });
  });

  // ── 技能冷却 ──

  describe('技能冷却', () => {
    it('释放大招后应进入冷却', () => {
      const ally = createTeam('ally', 1, {
        attack: 500,
        defense: 0,
        troopType: TroopType.ARCHER,
        rage: BATTLE_CONFIG.MAX_RAGE,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 10000,
        maxHp: 10000,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state);

      // 大招冷却设为3，回合结束减1 → 2
      expect(ally.units[0].skills[0].currentCooldown).toBe(2);
    });

    it('冷却中应每回合减少', () => {
      const ally = createTeam('ally', 1, {
        attack: 500,
        defense: 0,
        troopType: TroopType.ARCHER,
        rage: BATTLE_CONFIG.MAX_RAGE,
      });
      const enemy = createTeam('enemy', 1, {
        attack: 0,
        defense: 0,
        hp: 100000,
        maxHp: 100000,
        troopType: TroopType.ARCHER,
      });

      const state = engine.initBattle(ally, enemy);
      engine.executeTurn(state); // 释放大招，冷却=3，回合结束减1→2

      expect(ally.units[0].skills[0].currentCooldown).toBe(2);

      // 第二回合冷却再减1
      state.currentTurn++;
      engine.executeTurn(state);
      expect(ally.units[0].skills[0].currentCooldown).toBe(1);
    });
  });
});
