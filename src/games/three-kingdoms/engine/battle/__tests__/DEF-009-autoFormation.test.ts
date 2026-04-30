/**
 * DEF-009 修复测试：autoFormation 浅拷贝副作用
 *
 * 验证 autoFormation 不再修改传入的原始 BattleUnit 对象的 position 属性。
 */

import { describe, it, expect } from 'vitest';
import { autoFormation } from '../autoFormation';
import type { BattleUnit, BattleSkill } from '../battle.types';
import { TroopType } from '../battle.types';

// ── 测试工具 ─────────────────────────────────────────

const NORMAL_ATTACK: BattleSkill = {
  id: 'normal', name: '普攻', type: 'active', level: 1,
  description: '', multiplier: 1.0, targetType: 'SINGLE_ENEMY',
  rageCost: 0, cooldown: 0, currentCooldown: 0,
};

function makeUnit(overrides: Partial<BattleUnit> & { id: string }): BattleUnit {
  return {
    name: overrides.id,
    faction: 'shu',
    troopType: TroopType.INFANTRY,
    position: 'front',
    side: 'ally',
    attack: 100,
    baseAttack: 100,
    defense: 100,
    baseDefense: 100,
    intelligence: 50,
    speed: 50,
    hp: 1000,
    maxHp: 1000,
    isAlive: true,
    rage: 0,
    maxRage: 100,
    normalAttack: NORMAL_ATTACK,
    skills: [],
    buffs: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('DEF-009: autoFormation 不修改原始单位 position', () => {
  it('布阵后原始单位的 position 不被修改', () => {
    const units = [
      makeUnit({ id: 'tank', defense: 300, maxHp: 3000, position: 'front' }),
      makeUnit({ id: 'dps', defense: 50, maxHp: 800, position: 'back' }),
      makeUnit({ id: 'mid', defense: 150, maxHp: 1500, position: 'front' }),
      makeUnit({ id: 'sup', defense: 80, maxHp: 1000, position: 'back' }),
    ];

    // 记录原始 position
    const originalPositions = units.map(u => u.position);

    autoFormation(units);

    // 验证原始对象的 position 未被修改
    expect(units[0].position).toBe(originalPositions[0]);
    expect(units[1].position).toBe(originalPositions[1]);
    expect(units[2].position).toBe(originalPositions[2]);
    expect(units[3].position).toBe(originalPositions[3]);
  });

  it('多次调用 autoFormation 不产生累积副作用', () => {
    const units = [
      makeUnit({ id: 'u1', defense: 200, maxHp: 2000, position: 'front' }),
      makeUnit({ id: 'u2', defense: 100, maxHp: 1000, position: 'front' }),
      makeUnit({ id: 'u3', defense: 50, maxHp: 500, position: 'back' }),
      makeUnit({ id: 'u4', defense: 80, maxHp: 800, position: 'back' }),
    ];

    const originalPositions = units.map(u => u.position);

    // 连续调用 3 次
    autoFormation(units);
    autoFormation(units);
    autoFormation(units);

    // 原始对象的 position 仍然不变
    units.forEach((u, i) => {
      expect(u.position).toBe(originalPositions[i]);
    });
  });

  it('结果中的单位 position 应被正确设置', () => {
    const units = [
      makeUnit({ id: 'tank', defense: 300, maxHp: 3000 }),
      makeUnit({ id: 'dps', defense: 50, maxHp: 800 }),
      makeUnit({ id: 'mid', defense: 150, maxHp: 1500 }),
      makeUnit({ id: 'sup', defense: 80, maxHp: 1000 }),
    ];

    const result = autoFormation(units);

    // tank 和 mid 防御最高，应在前排
    expect(result.team.units.find(u => u.id === 'tank')!.position).toBe('front');
    expect(result.team.units.find(u => u.id === 'mid')!.position).toBe('front');
    // dps 防御最低，应在后排
    expect(result.team.units.find(u => u.id === 'dps')!.position).toBe('back');
  });

  it('空列表不抛错且不修改任何对象', () => {
    const result = autoFormation([]);
    expect(result.team.units).toHaveLength(0);
    expect(result.score).toBe(0);
  });
});
