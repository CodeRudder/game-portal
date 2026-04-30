/**
 * BattleFragmentRewards 测试 — 战斗碎片奖励计算
 *
 * 覆盖：
 *   1. calculateFragmentRewards — 胜利/失败/平局
 *   2. calculateFragmentRewards — 首通必掉
 *   3. calculateFragmentRewards — 非首通10%掉率
 *   4. simpleHash — 确定性/边界值
 */

import { describe, it, expect } from 'vitest';
import { calculateFragmentRewards, simpleHash } from '../BattleFragmentRewards';
import { BattleOutcome } from '../battle.types';
import type { BattleTeam } from '../battle.types';

// ── 辅助 ──

function makeTeam(ids: string[]): BattleTeam {
  return {
    side: 'enemy',
    units: ids.map((id) => ({
      id,
      name: id,
      faction: 'wei' as const,
      troopType: 'INFANTRY' as const,
      position: 'front' as const,
      side: 'enemy' as const,
      attack: 100,
      baseAttack: 100,
      defense: 50,
      baseDefense: 50,
      intelligence: 30,
      speed: 40,
      hp: 1000,
      maxHp: 1000,
      isAlive: true,
      rage: 0,
      maxRage: 100,
      normalAttack: {
        id: 'atk',
        name: '普攻',
        type: 'active',
        level: 1,
        description: '',
        multiplier: 1.0,
        targetType: 'SINGLE_ENEMY' as const,
        rageCost: 0,
        cooldown: 0,
        currentCooldown: 0,
      },
      skills: [],
      buffs: [],
    })),
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('calculateFragmentRewards', () => {

  // ─────────────────────────────────────────
  // 1. 非胜利结果
  // ─────────────────────────────────────────
  describe('非胜利结果', () => {
    it('should return empty object for DEFEAT', () => {
      const result = calculateFragmentRewards(
        BattleOutcome.DEFEAT,
        makeTeam(['hero1']),
        0,
      );
      expect(result).toEqual({});
    });

    it('should return empty object for DRAW', () => {
      const result = calculateFragmentRewards(
        BattleOutcome.DRAW,
        makeTeam(['hero1']),
        3,
      );
      expect(result).toEqual({});
    });
  });

  // ─────────────────────────────────────────
  // 2. 胜利 + 首通
  // ─────────────────────────────────────────
  describe('胜利 + 首通', () => {
    it('should give 1 fragment per enemy unit on first clear', () => {
      const enemyTeam = makeTeam(['hero1', 'hero2', 'hero3']);
      const result = calculateFragmentRewards(
        BattleOutcome.VICTORY,
        enemyTeam,
        3,
        true, // isFirstClear
      );
      expect(result).toEqual({ hero1: 1, hero2: 1, hero3: 1 });
    });

    it('should give fragments even with 0 ally survivors on first clear', () => {
      const result = calculateFragmentRewards(
        BattleOutcome.VICTORY,
        makeTeam(['hero1']),
        0,
        true,
      );
      expect(result).toEqual({ hero1: 1 });
    });

    it('should handle single enemy unit on first clear', () => {
      const result = calculateFragmentRewards(
        BattleOutcome.VICTORY,
        makeTeam(['boss1']),
        5,
        true,
      );
      expect(result).toEqual({ boss1: 1 });
    });
  });

  // ─────────────────────────────────────────
  // 3. 胜利 + 非首通（10%掉率）
  // ─────────────────────────────────────────
  describe('胜利 + 非首通', () => {
    it('should use deterministic hash for drop decision', () => {
      const enemyTeam = makeTeam(['hero1']);
      // Same inputs should always produce same result
      const r1 = calculateFragmentRewards(BattleOutcome.VICTORY, enemyTeam, 3);
      const r2 = calculateFragmentRewards(BattleOutcome.VICTORY, enemyTeam, 3);
      expect(r1).toEqual(r2);
    });

    it('should return empty for empty enemy team', () => {
      const result = calculateFragmentRewards(
        BattleOutcome.VICTORY,
        makeTeam([]),
        3,
      );
      expect(result).toEqual({});
    });

    it('should produce number values (0 or 1) for each unit', () => {
      const enemyTeam = makeTeam(['unit_a', 'unit_b', 'unit_c', 'unit_d', 'unit_d2']);
      const result = calculateFragmentRewards(BattleOutcome.VICTORY, enemyTeam, 3);
      for (const val of Object.values(result)) {
        expect(val).toBe(1);
      }
    });
  });
});

describe('simpleHash', () => {

  it('should return a non-negative integer', () => {
    const hash = simpleHash('test');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hash)).toBe(true);
  });

  it('should be deterministic', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'));
  });

  it('should return different hashes for different strings', () => {
    expect(simpleHash('abc')).not.toBe(simpleHash('def'));
  });

  it('should handle empty string', () => {
    const hash = simpleHash('');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hash)).toBe(true);
  });

  it('should handle single character', () => {
    const hash = simpleHash('a');
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  it('should handle unicode characters', () => {
    const hash = simpleHash('赵云');
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  it('should handle long strings', () => {
    const longStr = 'a'.repeat(10000);
    const hash = simpleHash(longStr);
    expect(hash).toBeGreaterThanOrEqual(0);
  });

  it('should handle special characters', () => {
    const hash = simpleHash('!@#$%^&*()');
    expect(hash).toBeGreaterThanOrEqual(0);
  });
});
