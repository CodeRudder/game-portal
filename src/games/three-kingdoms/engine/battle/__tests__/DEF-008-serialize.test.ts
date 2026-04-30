/**
 * DEF-008 修复测试：BattleEngine 序列化/反序列化
 *
 * 验证 serialize/deserialize 方法能正确保存和恢复 BattleState。
 */

import { describe, it, expect } from 'vitest';
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

describe('DEF-008: BattleEngine 序列化/反序列化', () => {
  const engine = new BattleEngine();

  // ── serialize ──

  describe('serialize', () => {
    it('应返回深拷贝的 BattleState', () => {
      const ally = createTeam('ally', 2, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });
      const state = engine.initBattle(ally, enemy);

      const serialized = engine.serialize(state);

      // 修改序列化副本不影响原始状态
      serialized.currentTurn = 999;
      expect(state.currentTurn).toBe(1);
    });

    it('序列化后修改原始状态不影响副本', () => {
      const ally = createTeam('ally', 2, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });
      const state = engine.initBattle(ally, enemy);

      const serialized = engine.serialize(state);
      state.currentTurn = 500;

      expect(serialized.currentTurn).toBe(1);
    });

    it('序列化结果应包含所有 BattleState 字段', () => {
      const ally = createTeam('ally', 2);
      const enemy = createTeam('enemy', 2);
      const state = engine.initBattle(ally, enemy);

      const serialized = engine.serialize(state);

      expect(serialized).toHaveProperty('id');
      expect(serialized).toHaveProperty('phase');
      expect(serialized).toHaveProperty('currentTurn');
      expect(serialized).toHaveProperty('maxTurns');
      expect(serialized).toHaveProperty('allyTeam');
      expect(serialized).toHaveProperty('enemyTeam');
      expect(serialized).toHaveProperty('turnOrder');
      expect(serialized).toHaveProperty('currentActorIndex');
      expect(serialized).toHaveProperty('actionLog');
      expect(serialized).toHaveProperty('result');
    });

    it('战斗结束后序列化应包含 result', () => {
      const ally = createTeam('ally', 1, { attack: 99999 });
      const enemy = createTeam('enemy', 1, { hp: 1, maxHp: 1 });
      const state = engine.initBattle(ally, enemy);

      // 执行到结束
      while (state.phase === BattlePhase.IN_PROGRESS) {
        engine.executeTurn(state);
        if (engine.isBattleOver(state)) break;
        state.currentTurn++;
      }
      state.phase = BattlePhase.FINISHED;
      state.result = engine.getBattleResult(state);

      const serialized = engine.serialize(state);
      expect(serialized.result).not.toBeNull();
      expect(serialized.result!.outcome).toBe(BattleOutcome.VICTORY);
    });
  });

  // ── deserialize ──

  describe('deserialize', () => {
    it('应从序列化数据恢复 BattleState', () => {
      const ally = createTeam('ally', 2);
      const enemy = createTeam('enemy', 2);
      const state = engine.initBattle(ally, enemy);

      const serialized = engine.serialize(state);
      const restored = engine.deserialize(serialized);

      expect(restored.id).toBe(state.id);
      expect(restored.phase).toBe(state.phase);
      expect(restored.currentTurn).toBe(state.currentTurn);
      expect(restored.allyTeam.units.length).toBe(2);
      expect(restored.enemyTeam.units.length).toBe(2);
    });

    it('恢复的状态应独立于序列化数据', () => {
      const ally = createTeam('ally', 2);
      const enemy = createTeam('enemy', 2);
      const state = engine.initBattle(ally, enemy);
      const serialized = engine.serialize(state);

      const restored = engine.deserialize(serialized);
      restored.currentTurn = 999;

      expect(serialized.currentTurn).toBe(1);
    });

    it('null/undefined 数据应抛出错误', () => {
      expect(() => engine.deserialize(null)).toThrow('data must be a non-null object');
      expect(() => engine.deserialize(undefined)).toThrow('data must be a non-null object');
    });

    it('缺少必要字段应抛出错误', () => {
      expect(() => engine.deserialize({ id: 'test' })).toThrow('missing required field');
    });

    it('非对象输入应抛出错误', () => {
      expect(() => engine.deserialize('string')).toThrow('data must be a non-null object');
      expect(() => engine.deserialize(123)).toThrow('data must be a non-null object');
    });

    it('完整 round-trip: serialize → deserialize → 继续战斗', () => {
      const ally = createTeam('ally', 2, { attack: 300, hp: 3000, maxHp: 3000 });
      const enemy = createTeam('enemy', 2, { attack: 100, hp: 1000, maxHp: 1000 });
      const state = engine.initBattle(ally, enemy);

      // 执行1回合
      engine.executeTurn(state);
      state.currentTurn++;

      // 序列化
      const saved = engine.serialize(state);

      // 反序列化
      const restored = engine.deserialize(saved);

      // 验证恢复状态一致
      expect(restored.id).toBe(state.id);
      expect(restored.currentTurn).toBe(state.currentTurn);
      expect(restored.actionLog.length).toBe(state.actionLog.length);
    });
  });
});
