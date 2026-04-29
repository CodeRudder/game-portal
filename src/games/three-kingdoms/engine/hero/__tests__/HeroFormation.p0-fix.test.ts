/**
 * HeroFormation P0修复测试
 *
 * 覆盖：
 * - P0-01: 编队创建前置条件（主城等级、铜钱消耗）
 * - P0-02: 编队战力加成（羁绊加成系数）
 */

import { HeroFormation, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '../HeroFormation';
import type { FormationPrerequisites } from '../HeroFormation';
import type { GeneralData } from '../hero.types';
import { Quality } from '../hero.types';
import {
  FORMATION_CREATE_REQUIRED_CASTLE_LEVEL,
  FORMATION_CREATE_COST_COPPER,
  FORMATION_BOND_BONUS_RATE,
} from '../formation-types';

// ── 辅助：创建 mock GeneralData ──
function makeGeneral(id: string, power: number = 100): GeneralData {
  return {
    id,
    name: id,
    faction: 'shu',
    quality: Quality.EPIC,
    level: 1,
    exp: 0,
    baseStats: { attack: power, defense: power, intelligence: power, speed: power },
    skills: [],
    isUnlocked: true,
    unlockTime: Date.now(),
  };
}

function calcPower(g: GeneralData): number {
  return g.baseStats.attack + g.baseStats.defense;
}

function makeGetGeneral(map: Record<string, GeneralData>) {
  return (id: string) => map[id];
}

// ═══════════════════════════════════════════
// P0-01: 编队创建前置条件
// ═══════════════════════════════════════════
describe('P0-01: 编队创建前置条件', () => {
  it('常量值正确', () => {
    expect(FORMATION_CREATE_REQUIRED_CASTLE_LEVEL).toBe(3);
    expect(FORMATION_CREATE_COST_COPPER).toBe(500);
    expect(FORMATION_BOND_BONUS_RATE).toBe(0.05);
  });

  it('无前置条件时仍可正常创建编队（向后兼容）', () => {
    const formation = new HeroFormation();
    const f = formation.createFormation();
    expect(f).not.toBeNull();
    expect(f!.id).toBe('1');
  });

  it('主城等级不足时创建编队返回null', () => {
    const formation = new HeroFormation();
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 1, // 低于要求的3
      getCopperBalance: () => 10000,
      spendCopper: () => true,
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation();
    expect(f).toBeNull();
  });

  it('主城等级刚好满足时可创建编队', () => {
    const formation = new HeroFormation();
    let copperBalance = 10000;
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => FORMATION_CREATE_REQUIRED_CASTLE_LEVEL, // 刚好3
      getCopperBalance: () => copperBalance,
      spendCopper: (amount: number) => { copperBalance -= amount; return true; },
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation();
    expect(f).not.toBeNull();
    expect(f!.id).toBe('1');
    expect(copperBalance).toBe(10000 - FORMATION_CREATE_COST_COPPER);
  });

  it('铜钱不足时创建编队返回null', () => {
    const formation = new HeroFormation();
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 10,
      getCopperBalance: () => 100, // 不足500
      spendCopper: () => false,
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation();
    expect(f).toBeNull();
  });

  it('创建编队成功时扣除500铜钱', () => {
    const formation = new HeroFormation();
    let copperBalance = 2000;
    let spentAmount = 0;
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 5,
      getCopperBalance: () => copperBalance,
      spendCopper: (amount: number) => {
        spentAmount = amount;
        copperBalance -= amount;
        return true;
      },
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    formation.createFormation();
    expect(spentAmount).toBe(FORMATION_CREATE_COST_COPPER);
    expect(copperBalance).toBe(2000 - FORMATION_CREATE_COST_COPPER);
  });

  it('连续创建3个编队共扣除1500铜钱', () => {
    const formation = new HeroFormation();
    let copperBalance = 5000;
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 5,
      getCopperBalance: () => copperBalance,
      spendCopper: (amount: number) => { copperBalance -= amount; return true; },
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    formation.createFormation();
    formation.createFormation();
    formation.createFormation();
    expect(copperBalance).toBe(5000 - FORMATION_CREATE_COST_COPPER * 3);

    // 第4个应失败（上限3个）
    const f4 = formation.createFormation();
    expect(f4).toBeNull();
  });

  it('扣费失败时创建编队返回null', () => {
    const formation = new HeroFormation();
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 5,
      getCopperBalance: () => 1000,
      spendCopper: () => false, // 扣费失败
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation();
    expect(f).toBeNull();
  });
});

// ═══════════════════════════════════════════
// P0-02: 编队战力加成（羁绊加成）
// ═══════════════════════════════════════════
describe('P0-02: 编队战力羁绊加成', () => {
  it('无羁绊时战力为简单累加', () => {
    const formation = new HeroFormation();
    const f = formation.createFormation()!;
    formation.addToFormation(f.id, 'g1');
    formation.addToFormation(f.id, 'g2');

    const generals: Record<string, GeneralData> = {
      g1: makeGeneral('g1', 100),
      g2: makeGeneral('g2', 200),
    };

    // 需要获取更新后的编队数据
    const updatedFormation = formation.getFormation(f.id)!;
    const power = formation.calculateFormationPower(
      updatedFormation,
      makeGetGeneral(generals),
      calcPower,
    );

    // 无羁绊: (100+100) + (200+200) = 600
    expect(power).toBe(600);
  });

  it('有羁绊时战力获得加成', () => {
    const formation = new HeroFormation();
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 5,
      getCopperBalance: () => 10000,
      spendCopper: () => true,
      getActiveBondCount: () => 2, // 2个羁绊
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation()!;
    formation.addToFormation(f.id, 'g1');
    formation.addToFormation(f.id, 'g2');

    const generals: Record<string, GeneralData> = {
      g1: makeGeneral('g1', 100),
      g2: makeGeneral('g2', 200),
    };

    const power = formation.calculateFormationPower(
      formation.getFormation(f.id)!,
      makeGetGeneral(generals),
      calcPower,
    );

    // 基础战力 600, 2个羁绊加成: 600 * (1 + 2 * 0.05) = 600 * 1.1 = 660
    const expectedBase = 600;
    const expectedBonus = expectedBase * (1 + 2 * FORMATION_BOND_BONUS_RATE);
    expect(power).toBe(Math.floor(expectedBonus));
  });

  it('空编队战力为0（即使有羁绊）', () => {
    const formation = new HeroFormation();
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 5,
      getCopperBalance: () => 10000,
      spendCopper: () => true,
      getActiveBondCount: () => 5,
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation()!;
    const generals: Record<string, GeneralData> = {};

    const power = formation.calculateFormationPower(
      f,
      makeGetGeneral(generals),
      calcPower,
    );

    expect(power).toBe(0);
  });

  it('羁绊加成系数正确', () => {
    // 验证每个羁绊增加5%
    expect(FORMATION_BOND_BONUS_RATE).toBe(0.05);

    const formation = new HeroFormation();
    const prereqs: FormationPrerequisites = {
      getCastleLevel: () => 5,
      getCopperBalance: () => 10000,
      spendCopper: () => true,
      getActiveBondCount: () => 0,
    };
    formation.setPrerequisites(prereqs);

    const f = formation.createFormation()!;
    formation.addToFormation(f.id, 'g1');
    const generals: Record<string, GeneralData> = { g1: makeGeneral('g1', 500) };

    // 0羁绊
    let power = formation.calculateFormationPower(formation.getFormation(f.id)!, makeGetGeneral(generals), calcPower);
    expect(power).toBe(1000); // 500+500=1000

    // 1羁绊
    (prereqs as any).getActiveBondCount = () => 1;
    formation.setPrerequisites(prereqs);
    power = formation.calculateFormationPower(formation.getFormation(f.id)!, makeGetGeneral(generals), calcPower);
    expect(power).toBe(1050); // 1000 * 1.05

    // 3羁绊
    (prereqs as any).getActiveBondCount = () => 3;
    formation.setPrerequisites(prereqs);
    power = formation.calculateFormationPower(formation.getFormation(f.id)!, makeGetGeneral(generals), calcPower);
    expect(power).toBe(1150); // 1000 * 1.15
  });
});
