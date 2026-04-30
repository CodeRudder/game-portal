/**
 * DEF-010 修复测试：quickBattle/skipBattle 后 speedController 累积 SKIP
 *
 * 验证 skipBattle 和 quickBattle 执行完毕后，
 * 速度控制器自动恢复到 X1，不会累积 SKIP 状态。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BattleEngine } from '../BattleEngine';
import type { BattleTeam, BattleUnit, BattleSkill } from '../battle.types';
import { BattleOutcome, BattlePhase, BattleSpeed, TroopType } from '../battle.types';

// ── 测试工具 ─────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal', name: '普攻', type: 'active', level: 1,
  description: '普通攻击', multiplier: 1.0, targetType: 'SINGLE_ENEMY',
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

function createUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: `unit_${Math.random().toString(36).slice(2, 6)}`,
    name: '测试武将', faction: 'shu', troopType: TroopType.CAVALRY,
    position: 'front', side: 'ally',
    attack: 100, baseAttack: 100, defense: 50, baseDefense: 50,
    intelligence: 60, speed: 80, hp: 1000, maxHp: 1000,
    isAlive: true, rage: 0, maxRage: 100,
    normalAttack: { ...NORMAL_ATTACK }, skills: [], buffs: [],
    ...overrides,
  };
}

function createTeam(side: 'ally' | 'enemy', count: number, overrides: Partial<BattleUnit> = {}): BattleTeam {
  return {
    units: Array.from({ length: count }, (_, i) =>
      createUnit({
        id: `${side}_${i}`, name: `${side}${i}`, side,
        position: i < 3 ? 'front' as const : 'back' as const,
        ...overrides,
      }),
    ),
    side,
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('DEF-010: skipBattle/quickBattle 后恢复速度', () => {
  let engine: BattleEngine;

  beforeEach(() => {
    engine = new BattleEngine();
  });

  describe('skipBattle', () => {
    it('skipBattle 完成后速度应恢复为 X1', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });
      const state = engine.initBattle(ally, enemy);

      engine.skipBattle(state);

      // DEF-010 修复：skipBattle 完成后速度应恢复 X1
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
      expect(engine.isSkipMode()).toBe(false);
    });

    it('连续 skipBattle 不累积 SKIP 状态', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });

      // 连续执行 3 次 skipBattle
      for (let i = 0; i < 3; i++) {
        const state = engine.initBattle(
          { units: ally.units.map(u => ({ ...u })), side: 'ally' },
          { units: enemy.units.map(u => ({ ...u })), side: 'enemy' },
        );
        engine.skipBattle(state);
      }

      // 最终速度应为 X1，而非 SKIP
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
      expect(engine.isSkipMode()).toBe(false);
    });

    it('skipBattle 后 getAdjustedTurnInterval 应为正常值', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });
      const state = engine.initBattle(ally, enemy);

      engine.skipBattle(state);

      // X1 速度下间隔应为 1000ms
      expect(engine.getAdjustedTurnInterval()).toBe(1000);
    });

    it('skipBattle 后可正常设置其他速度', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });
      const state = engine.initBattle(ally, enemy);

      engine.skipBattle(state);

      // 应能正常切换到其他速度
      engine.setSpeed(BattleSpeed.X2);
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X2);
    });

    it('对已结束的战斗 skipBattle 不改变速度', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });

      // 先设置 X2
      engine.setSpeed(BattleSpeed.X2);

      const state = engine.initBattle(ally, enemy);
      state.phase = BattlePhase.FINISHED;
      state.result = engine.getBattleResult(state);

      engine.skipBattle(state);

      // 已结束的战斗直接返回，不改变速度
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X2);
    });
  });

  describe('quickBattle', () => {
    it('quickBattle 完成后速度应恢复为 X1', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });

      engine.quickBattle(ally, enemy);

      // DEF-010 修复：quickBattle 内部调用 skipBattle，完成后速度应恢复 X1
      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
      expect(engine.isSkipMode()).toBe(false);
    });

    it('连续 quickBattle 不累积 SKIP 状态', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });

      // 连续执行 5 次 quickBattle
      for (let i = 0; i < 5; i++) {
        engine.quickBattle(
          { units: ally.units.map(u => ({ ...u })), side: 'ally' },
          { units: enemy.units.map(u => ({ ...u })), side: 'enemy' },
        );
      }

      expect(engine.getSpeedState().speed).toBe(BattleSpeed.X1);
      expect(engine.isSkipMode()).toBe(false);
    });

    it('quickBattle 后 runFullBattle 应正常工作', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });

      engine.quickBattle(
        { units: ally.units.map(u => ({ ...u })), side: 'ally' },
        { units: enemy.units.map(u => ({ ...u })), side: 'enemy' },
      );

      // quickBattle 后 runFullBattle 应正常
      const result = engine.runFullBattle(
        { units: ally.units.map(u => ({ ...u })), side: 'ally' },
        { units: enemy.units.map(u => ({ ...u })), side: 'enemy' },
      );

      expect(result.outcome).toBe(BattleOutcome.VICTORY);
    });
  });
});
