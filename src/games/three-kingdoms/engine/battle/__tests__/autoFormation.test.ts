/**
 * 一键布阵 (autoFormation) 测试
 * 覆盖：自动分配前排/后排、评分计算、边界情况
 */

import { autoFormation, type AutoFormationResult } from '../autoFormation';
import type { BattleUnit, BattleSkill } from '../battle.types';
import { TroopType } from '../battle.types';

/** 创建测试用 BattleUnit */
function makeUnit(overrides: Partial<BattleUnit> & { id: string }): BattleUnit {
  const normalAttack: BattleSkill = {
    id: 'normal', name: '普攻', type: 'active', level: 1,
    description: '', multiplier: 1.0, targetType: 'SINGLE_ENEMY' as any,
    rageCost: 0, cooldown: 0, currentCooldown: 0,
  };
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
    normalAttack,
    skills: [],
    buffs: [],
    ...overrides,
  };
}

describe('autoFormation — 一键布阵', () => {
  it('空列表返回空结果', () => {
    const result = autoFormation([]);
    expect(result.team.units).toHaveLength(0);
    expect(result.frontLine).toHaveLength(0);
    expect(result.backLine).toHaveLength(0);
    expect(result.score).toBe(0);
  });

  it('3个单位全部放前排', () => {
    const units = [
      makeUnit({ id: 'u1', defense: 200, maxHp: 2000 }),
      makeUnit({ id: 'u2', defense: 150, maxHp: 1500 }),
      makeUnit({ id: 'u3', defense: 100, maxHp: 1000 }),
    ];
    const result = autoFormation(units);
    expect(result.frontLine).toHaveLength(3);
    expect(result.backLine).toHaveLength(0);
    expect(result.team.units).toHaveLength(3);
  });

  it('6个单位：3前排 + 3后排', () => {
    const units = Array.from({ length: 6 }, (_, i) =>
      makeUnit({ id: `u${i + 1}`, defense: 200 - i * 30, maxHp: 2000 - i * 200 }),
    );
    const result = autoFormation(units);
    expect(result.frontLine).toHaveLength(3);
    expect(result.backLine).toHaveLength(3);
    expect(result.team.units).toHaveLength(6);
  });

  it('防御最高的单位在前排', () => {
    const units = [
      makeUnit({ id: 'tank', defense: 300, maxHp: 3000 }),
      makeUnit({ id: 'dps', defense: 50, maxHp: 800 }),
      makeUnit({ id: 'mid', defense: 150, maxHp: 1500 }),
      makeUnit({ id: 'sup', defense: 80, maxHp: 1000 }),
    ];
    const result = autoFormation(units);
    expect(result.frontLine).toContain('tank');
    expect(result.frontLine).toContain('mid');
    // dps 防御最低，应在后排
    expect(result.backLine).toContain('dps');
  });

  it('同防御时按HP降序排', () => {
    const units = [
      makeUnit({ id: 'low_hp', defense: 100, maxHp: 500 }),
      makeUnit({ id: 'high_hp', defense: 100, maxHp: 2000 }),
    ];
    const result = autoFormation(units);
    // high_hp 应排在前面（第一个进前排）
    expect(result.frontLine[0]).toBe('high_hp');
  });

  it('超过6个单位时截断为6个', () => {
    const units = Array.from({ length: 10 }, (_, i) =>
      makeUnit({ id: `u${i + 1}`, defense: 100, maxHp: 1000 }),
    );
    const result = autoFormation(units);
    expect(result.team.units).toHaveLength(6);
  });

  it('死亡单位被过滤', () => {
    const units = [
      makeUnit({ id: 'alive1', defense: 200, maxHp: 2000, isAlive: true }),
      makeUnit({ id: 'dead', defense: 300, maxHp: 3000, isAlive: false }),
      makeUnit({ id: 'alive2', defense: 100, maxHp: 1000, isAlive: true }),
    ];
    const result = autoFormation(units);
    expect(result.team.units).toHaveLength(2);
    expect(result.frontLine).toHaveLength(2);
    expect(result.backLine).toHaveLength(0);
  });

  it('布阵评分在 0~100 之间', () => {
    const units = Array.from({ length: 4 }, (_, i) =>
      makeUnit({ id: `u${i + 1}`, defense: 100 + i * 50, maxHp: 1000 + i * 500 }),
    );
    const result = autoFormation(units);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('布阵后单位的 position 属性被正确设置', () => {
    const units = [
      makeUnit({ id: 'tank', defense: 300, maxHp: 3000 }),
      makeUnit({ id: 'dps', defense: 50, maxHp: 800 }),
      makeUnit({ id: 'mid', defense: 150, maxHp: 1500 }),
      makeUnit({ id: 'sup', defense: 80, maxHp: 1000 }),
    ];
    const result = autoFormation(units);
    for (const u of result.team.units) {
      if (result.frontLine.includes(u.id)) {
        expect(u.position).toBe('front');
      } else {
        expect(u.position).toBe('back');
      }
    }
  });

  it('team.side 为 ally', () => {
    const units = [makeUnit({ id: 'u1' })];
    const result = autoFormation(units);
    expect(result.team.side).toBe('ally');
  });
});
