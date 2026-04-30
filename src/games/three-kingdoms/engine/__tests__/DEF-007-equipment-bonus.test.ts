/**
 * DEF-007 修复测试：装备加成传递到战斗
 *
 * 验证 buildAllyTeam 在传入 getTotalStats 回调时，
 * 使用含装备/羁绊加成的总属性构建 BattleUnit，
 * 而非仅使用 baseStats。
 */

import { vi, describe, it, expect } from 'vitest';
import { buildAllyTeam } from '../engine-campaign-deps';
import type { HeroSystem } from '../hero/HeroSystem';
import type { HeroFormation } from '../hero/HeroFormation';
import { TroopType } from '../battle/battle.types';

// ── Mock factories ──────────────────────────────────

function createMockHeroSystem(): HeroSystem {
  const generals = [
    {
      id: 'hero1',
      name: '关羽',
      faction: 'shu',
      level: 10,
      baseStats: { attack: 95, defense: 80, intelligence: 60, speed: 70 },
      skills: [],
    },
  ];

  return {
    getAllGenerals: vi.fn(() => generals),
    getGeneral: vi.fn((id: string) => generals.find((g) => g.id === id)),
    addFragment: vi.fn(),
    addExp: vi.fn(),
  } as unknown as HeroSystem;
}

function createMockFormation(): HeroFormation {
  return {
    getActiveFormation: vi.fn(() => ({
      id: 'default',
      slots: ['hero1', null, null, null, null, null],
      isActive: true,
    })),
  } as unknown as HeroFormation;
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('DEF-007: 装备加成传递到战斗', () => {
  it('不传 getTotalStats 时使用 baseStats（向后兼容）', () => {
    const formation = createMockFormation();
    const hero = createMockHeroSystem();

    const team = buildAllyTeam(formation, hero);
    const unit = team.units[0];

    // baseStats: attack=95, defense=80
    expect(unit.attack).toBe(95);
    expect(unit.defense).toBe(80);
    expect(unit.baseAttack).toBe(95);
    expect(unit.baseDefense).toBe(80);
  });

  it('传入 getTotalStats 时使用总属性（含装备加成）', () => {
    const formation = createMockFormation();
    const hero = createMockHeroSystem();

    // 模拟装备加成：attack +50, defense +30
    const getTotalStats = vi.fn((generalId: string) => {
      if (generalId === 'hero1') {
        return { attack: 145, defense: 110, intelligence: 60, speed: 70 };
      }
      return undefined;
    });

    const team = buildAllyTeam(formation, hero, getTotalStats);
    const unit = team.units[0];

    // 战斗属性应使用 totalStats（含装备加成）
    expect(unit.attack).toBe(145);
    expect(unit.defense).toBe(110);
    expect(unit.intelligence).toBe(60);
    expect(unit.speed).toBe(70);
    // baseAttack/baseDefense 仍保留原始 baseStats
    expect(unit.baseAttack).toBe(95);
    expect(unit.baseDefense).toBe(80);
  });

  it('getTotalStats 返回 undefined 时回退到 baseStats', () => {
    const formation = createMockFormation();
    const hero = createMockHeroSystem();

    const getTotalStats = vi.fn(() => undefined);

    const team = buildAllyTeam(formation, hero, getTotalStats);
    const unit = team.units[0];

    // 回退到 baseStats
    expect(unit.attack).toBe(95);
    expect(unit.defense).toBe(80);
  });

  it('HP 计算使用 totalStats 的 defense', () => {
    const formation = createMockFormation();
    const hero = createMockHeroSystem();

    // 装备加成 defense: 80 → 130
    const getTotalStats = vi.fn(() => ({
      attack: 95, defense: 130, intelligence: 60, speed: 70,
    }));

    const team = buildAllyTeam(formation, hero, getTotalStats);
    const unit = team.units[0];

    // maxHp = 500 + level*100 + defense*10 = 500 + 10*100 + 130*10 = 2800
    expect(unit.maxHp).toBe(2800);
    expect(unit.hp).toBe(2800);
  });

  it('兵种推断使用 totalStats', () => {
    const formation = createMockFormation();
    const hero = createMockHeroSystem();

    // baseStats: attack=95(最高) → 骑兵
    // totalStats: intelligence=200(最高) → 谋士
    const getTotalStats = vi.fn(() => ({
      attack: 95, defense: 80, intelligence: 200, speed: 70,
    }));

    const team = buildAllyTeam(formation, hero, getTotalStats);
    const unit = team.units[0];

    expect(unit.troopType).toBe(TroopType.STRATEGIST);
  });

  it('getTotalStats 被每个武将调用一次', () => {
    const formation = createMockFormation();
    const hero = createMockHeroSystem();

    const getTotalStats = vi.fn(() => ({
      attack: 100, defense: 100, intelligence: 100, speed: 100,
    }));

    buildAllyTeam(formation, hero, getTotalStats);

    expect(getTotalStats).toHaveBeenCalledTimes(1);
    expect(getTotalStats).toHaveBeenCalledWith('hero1');
  });
});
