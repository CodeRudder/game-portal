/**
 * hero-real-engine — 武将系统真实引擎集成测试（零 mock）
 *
 * 覆盖：引擎初始化、武将数据格式、招募、升级、编队、羁绊、派遣
 * 约束：初始 recruitToken=10，普通招募消耗 5/次
 * @module components/idle/panels/hero/__tests__/hero-real-engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality, QUALITY_LABELS, FACTION_LABELS } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { RecruitOutput } from '@/games/three-kingdoms/engine/hero/recruit-types';
import type { ActiveBond } from '@/games/three-kingdoms/core/bond/bond.types';
import type { LevelUpResult } from '@/games/three-kingdoms/engine/hero/HeroLevelSystem';

// localStorage mock（引擎 SaveManager 依赖）
const storage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
      clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
      get length() { return Object.keys(storage).length; },
      key: () => null,
    },
    writable: true,
    configurable: true,
  });
});

// 引擎工厂
function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  engine.init();
  return engine;
}

/** 验证 GeneralData 必要字段完整性 */
function assertValidGeneral(g: GeneralData): void {
  expect(g).toHaveProperty('id');
  expect(g).toHaveProperty('name');
  expect(g).toHaveProperty('quality');
  expect(g).toHaveProperty('baseStats');
  expect(g).toHaveProperty('level');
  expect(g).toHaveProperty('faction');
  expect(g).toHaveProperty('skills');
  expect(typeof g.id).toBe('string');
  expect(typeof g.name).toBe('string');
  expect(typeof g.level).toBe('number');
  expect(typeof g.faction).toBe('string');
  expect(Array.isArray(g.skills)).toBe(true);
}

/** 已知武将ID列表（来自 hero-config.ts） */
const KNOWN_HERO_IDS = [
  'liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun',  // 蜀
  'caocao', 'dianwei', 'simayi',                              // 魏
  'zhouyu',                                                    // 吴
  'lvbu',                                                      // 群
];

// 1. 引擎初始化与武将系统可用性

describe('引擎初始化与武将系统可用性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('引擎初始化成功，核心武将API均可用', () => {
    expect(engine.getHeroSystem).toBeTypeOf('function');
    expect(engine.getHeroStarSystem).toBeTypeOf('function');
    expect(engine.getFormationSystem).toBeTypeOf('function');
    expect(engine.getBondSystem).toBeTypeOf('function');
    expect(engine.getHeroDispatchSystem).toBeTypeOf('function');
    expect(engine.getGenerals).toBeTypeOf('function');
    expect(engine.getGeneral).toBeTypeOf('function');
    expect(engine.recruit).toBeTypeOf('function');
    expect(engine.enhanceHero).toBeTypeOf('function');
    expect(engine.setFormation).toBeTypeOf('function');
    expect(engine.getFormations).toBeTypeOf('function');
  });

  it('初始武将列表为空', () => {
    const generals = engine.getGenerals();
    expect(Array.isArray(generals)).toBe(true);
    expect(generals).toHaveLength(0);
  });

  it('getGeneral 对不存在的ID返回 undefined', () => {
    expect(engine.getGeneral('nonexistent_id')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════
// 2. 直接添加武将 → 数据格式验证
// ═══════════════════════════════════════════════

describe('武将数据格式验证', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('通过 hero.addGeneral 添加已知武将，返回完整数据', () => {
    const heroSystem = engine.getHeroSystem();
    const general = heroSystem.addGeneral('guanyu');
    expect(general).not.toBeNull();
    expect(general!.id).toBe('guanyu');
    expect(general!.name).toBe('关羽');
    assertValidGeneral(general!);
  });

  it('武将初始等级为1，经验为0', () => {
    const heroSystem = engine.getHeroSystem();
    const general = heroSystem.addGeneral('liubei');
    expect(general!.level).toBe(1);
    expect(general!.exp).toBe(0);
  });

  it('武将品质属于合法枚举值', () => {
    const heroSystem = engine.getHeroSystem();
    const legalQualities = Object.values(Quality);
    for (const id of KNOWN_HERO_IDS) {
      const g = heroSystem.addGeneral(id);
      expect(g).not.toBeNull();
      expect(legalQualities).toContain(g!.quality);
    }
  });

  it('武将阵营属于合法值且可映射中文', () => {
    const heroSystem = engine.getHeroSystem();
    const legalFactions = ['shu', 'wei', 'wu', 'qun'] as const;
    for (const id of KNOWN_HERO_IDS) {
      const g = heroSystem.addGeneral(id);
      expect(g).not.toBeNull();
      expect(legalFactions).toContain(g!.faction);
      // 中文名映射不抛异常
      expect(() => FACTION_LABELS[g!.faction]).not.toThrow();
    }
  });

  it('武将四维属性 baseStats 均为正数', () => {
    const heroSystem = engine.getHeroSystem();
    for (const id of KNOWN_HERO_IDS) {
      const g = heroSystem.addGeneral(id);
      const { attack, defense, intelligence, speed } = g!.baseStats;
      expect(attack).toBeGreaterThan(0);
      expect(defense).toBeGreaterThan(0);
      expect(intelligence).toBeGreaterThan(0);
      expect(speed).toBeGreaterThan(0);
    }
  });

  it('getGenerals 与 getGeneral 数据一致', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('guanyu');
    heroSystem.addGeneral('zhaoyun');

    const all = engine.getGenerals();
    expect(all).toHaveLength(2);

    for (const g of all) {
      const single = engine.getGeneral(g.id);
      expect(single).toBeDefined();
      expect(single!.id).toBe(g.id);
      expect(single!.name).toBe(g.name);
      expect(single!.level).toBe(g.level);
    }
  });
});

// ═══════════════════════════════════════════════
// 3. 招募武将 → 资源消耗 + 武将入队
// ═══════════════════════════════════════════════

describe('招募武将集成', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('普通招募返回有效 RecruitOutput', () => {
    const result: RecruitOutput | null = engine.recruit('normal', 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('normal');
    expect(result!.results).toHaveLength(1);
    expect(result!.results[0].general).toBeDefined();
    assertValidGeneral(result!.results[0].general);
  });

  it('招募后武将出现在 getGenerals 列表中', () => {
    const result = engine.recruit('normal', 1);
    expect(result).not.toBeNull();

    const recruitedId = result!.results[0].general.id;
    const generals = engine.getGenerals();
    expect(generals).toHaveLength(1);
    expect(generals[0].id).toBe(recruitedId);
  });

  it('招募消耗 recruitToken 资源', () => {
    const resource = engine.resource;
    const before = resource.getAmount('recruitToken');
    engine.recruit('normal', 1);
    const after = resource.getAmount('recruitToken');
    // 普通招募消耗 5 recruitToken
    expect(before - after).toBeGreaterThanOrEqual(5);
  });

  it('资源不足时招募返回 null', () => {
    // 初始 recruitToken = 10，普通招募消耗 5
    // 2 次招募后耗尽
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    // 第3次应失败
    const result = engine.recruit('normal', 1);
    expect(result).toBeNull();
  });

  it('招募武将品质为合法枚举值', () => {
    const result = engine.recruit('normal', 1);
    const quality = result!.results[0].quality;
    expect(Object.values(Quality)).toContain(quality);
  });
});

// ═══════════════════════════════════════════════
// 4. 升级武将 → 属性/战力变化
// ═══════════════════════════════════════════════

describe('升级武将集成', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('enhanceHero 返回有效的 LevelUpResult', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('guanyu');
    const heroId = 'guanyu';

    // 补充资源确保升级成功
    engine.resource.addResource('gold', 5000);
    engine.resource.addResource('grain', 5000);

    const result: LevelUpResult | null = engine.enhanceHero(heroId, 5);
    expect(result).not.toBeNull();
    expect(result!.general.id).toBe(heroId);
    expect(result!.levelsGained).toBeGreaterThanOrEqual(1);
  });

  it('升级后武将等级增加', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('zhaoyun');
    const levelBefore = engine.getGeneral('zhaoyun')!.level;

    // 补充资源
    engine.resource.addResource('gold', 5000);
    engine.resource.addResource('grain', 5000);

    engine.enhanceHero('zhaoyun', 3);
    const levelAfter = engine.getGeneral('zhaoyun')!.level;
    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it('升级后战力增加', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('zhangfei');

    // 补充资源
    engine.resource.addResource('gold', 5000);
    engine.resource.addResource('grain', 5000);

    const before = engine.getGeneral('zhangfei')!;
    const powerBefore = heroSystem.calculatePower(before);

    engine.enhanceHero('zhangfei', 5);

    const after = engine.getGeneral('zhangfei')!;
    const powerAfter = heroSystem.calculatePower(after);
    expect(powerAfter).toBeGreaterThan(powerBefore);
  });

  it('对不存在的武将 enhanceHero 返回 null', () => {
    const result = engine.enhanceHero('nonexistent_id', 1);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// 5. 编队操作 → 编队数据更新
// ═══════════════════════════════════════════════

describe('编队操作集成', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('初始编队列表为空，需手动创建', () => {
    const formations = engine.getFormations();
    expect(Array.isArray(formations)).toBe(true);
    expect(formations).toHaveLength(0);
  });

  it('创建编队后 setFormation 可设置武将', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('guanyu');
    heroSystem.addGeneral('zhangfei');
    heroSystem.addGeneral('zhaoyun');

    // 先创建编队
    const formationSystem = engine.getFormationSystem();
    formationSystem.createFormation('0');

    engine.setFormation('0', ['guanyu', 'zhangfei', 'zhaoyun']);

    const formations = engine.getFormations();
    expect(formations.length).toBeGreaterThan(0);
    const active = formations[0];
    const slotIds = active.slots
      .map((s: unknown) => {
        if (typeof s === 'string') return s;
        if (s != null && typeof s === 'object' && 'heroId' in (s as Record<string, unknown>)) {
          return (s as { heroId: string | null }).heroId;
        }
        return null;
      })
      .filter((id: string | null): id is string => id != null);

    expect(slotIds).toContain('guanyu');
    expect(slotIds).toContain('zhangfei');
    expect(slotIds).toContain('zhaoyun');
  });

  it('编队上限为 6 人', () => {
    const heroSystem = engine.getHeroSystem();
    for (const id of KNOWN_HERO_IDS.slice(0, 8)) {
      heroSystem.addGeneral(id);
    }
    const ids = KNOWN_HERO_IDS.slice(0, 8);

    // 先创建编队
    const formationSystem = engine.getFormationSystem();
    formationSystem.createFormation('0');

    expect(() => engine.setFormation('0', ids)).not.toThrow();

    const formations = engine.getFormations();
    const active = formations[0];
    const filledSlots = active.slots.filter((s: unknown) => {
      if (typeof s === 'string') return s.length > 0;
      if (s != null && typeof s === 'object' && 'heroId' in (s as Record<string, unknown>)) {
        return (s as { heroId: string | null }).heroId != null;
      }
      return false;
    });
    expect(filledSlots.length).toBeLessThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════
// 6. 羁绊系统 → 激活与数据格式
// ═══════════════════════════════════════════════

describe('羁绊系统数据格式', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('getBondSystem 返回有效的羁绊系统', () => {
    const bondSystem = engine.getBondSystem();
    expect(bondSystem).toBeDefined();
    // bond/BondSystem 的实际 API
    expect(bondSystem.detectActiveBonds).toBeTypeOf('function');
    expect(bondSystem.calculateTotalBondBonuses).toBeTypeOf('function');
    expect(bondSystem.getFormationPreview).toBeTypeOf('function');
  });

  it('无武将时 detectActiveBonds 返回空数组', () => {
    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.detectActiveBonds([]);
    expect(Array.isArray(bonds)).toBe(true);
    expect(bonds).toHaveLength(0);
  });

  it('同阵营武将激活羁绊且数据格式正确', () => {
    const heroSystem = engine.getHeroSystem();
    // 添加蜀国武将
    heroSystem.addGeneral('liubei');
    heroSystem.addGeneral('guanyu');
    heroSystem.addGeneral('zhangfei');

    const generals = engine.getGenerals();
    const bondSystem = engine.getBondSystem();
    const bonds: ActiveBond[] = bondSystem.detectActiveBonds(generals);

    // 同阵营羁绊应被激活
    expect(bonds.length).toBeGreaterThan(0);

    for (const bond of bonds) {
      expect(bond).toHaveProperty('type');
      expect(bond).toHaveProperty('faction');
      expect(bond).toHaveProperty('heroCount');
      expect(bond).toHaveProperty('effect');
      expect(typeof bond.type).toBe('string');
      expect(typeof bond.faction).toBe('string');
      expect(typeof bond.heroCount).toBe('number');
      expect(bond.heroCount).toBeGreaterThanOrEqual(2);
      // effect 结构（bond/BondSystem 的 BondEffect）
      expect(bond.effect).toHaveProperty('type');
      expect(bond.effect).toHaveProperty('name');
      expect(bond.effect).toHaveProperty('bonuses');
      expect(typeof bond.effect.type).toBe('string');
      expect(typeof bond.effect.name).toBe('string');
      expect(typeof bond.effect.bonuses).toBe('object');
    }
  });

  it('calculateTotalBondBonuses 返回属性加成', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('liubei');
    heroSystem.addGeneral('guanyu');

    const generals = engine.getGenerals();
    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.detectActiveBonds(generals);

    if (bonds.length > 0) {
      const bonuses = bondSystem.calculateTotalBondBonuses(bonds);
      expect(typeof bonuses).toBe('object');
      // 至少有一个属性被加成
      const bonusValues = Object.values(bonuses);
      const hasBonus = bonusValues.some((v) => typeof v === 'number' && v > 0);
      expect(hasBonus).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════
// 7. 派遣系统 → 派驻与召回
// ═══════════════════════════════════════════════

describe('派遣系统集成', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => { engine = createEngine(); });
  afterEach(() => { engine.reset(); });

  it('getHeroDispatchSystem 返回有效系统', () => {
    const dispatch = engine.getHeroDispatchSystem();
    expect(dispatch).toBeDefined();
    expect(dispatch.dispatchHero).toBeTypeOf('function');
    expect(dispatch.undeployHero).toBeTypeOf('function');
    expect(dispatch.getBuildingDispatchHero).toBeTypeOf('function');
    expect(dispatch.getState).toBeTypeOf('function');
  });

  it('派遣武将到建筑成功', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('guanyu');

    const dispatch = engine.getHeroDispatchSystem();
    const result = dispatch.dispatchHero('guanyu', 'barracks');
    expect(result.success).toBe(true);
  });

  it('派遣后可查询到派驻记录', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('zhaoyun');

    const dispatch = engine.getHeroDispatchSystem();
    dispatch.dispatchHero('zhaoyun', 'barracks');

    const heroId = dispatch.getBuildingDispatchHero('barracks');
    expect(heroId).toBe('zhaoyun');
  });

  it('召回武将成功并清除记录', () => {
    const heroSystem = engine.getHeroSystem();
    heroSystem.addGeneral('zhaoyun');

    const dispatch = engine.getHeroDispatchSystem();
    dispatch.dispatchHero('zhaoyun', 'barracks');

    // 召回
    const recallResult = dispatch.undeployHero('zhaoyun');
    expect(recallResult).toBe(true);

    // 验证清除
    const heroId = dispatch.getBuildingDispatchHero('barracks');
    expect(heroId).toBeNull();
  });
});
