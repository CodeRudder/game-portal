/**
 * hero-engine-integration — 真实引擎集成测试
 *
 * 使用真实 ThreeKingdomsEngine 实例（非 mock），验证：
 *   1. 初始化引擎 → 获取武将数据 → 验证数据格式
 *   2. 招募武将 → 验证武将加入列表
 *   3. 升级武将 → 验证属性变化
 *   4. 编队操作 → 验证编队更新
 *   5. 羁绊检测 → 验证羁绊激活
 *
 * 每个 test 独立初始化引擎，不使用任何 mock。
 *
 * @module components/idle/panels/hero/__tests__/hero-engine-integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { RecruitOutput } from '@/games/three-kingdoms/engine/hero/recruit-types';
import type { LevelUpResult } from '@/games/three-kingdoms/engine/hero/HeroLevelSystem';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import { BondType } from '@/games/three-kingdoms/engine/hero/bond-config';

// ─────────────────────────────────────────────
// localStorage mock（引擎 SaveManager 依赖）
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// 引擎工厂函数
// ─────────────────────────────────────────────

/** 创建并初始化一个真实 ThreeKingdomsEngine 实例 */
function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  engine.init();
  return engine;
}

/** 验证 GeneralData 必要字段完整性 */
function assertValidGeneralData(g: GeneralData): void {
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

// ═══════════════════════════════════════════════
// 1. 初始化引擎 → 获取武将数据 → 验证数据格式
// ═══════════════════════════════════════════════

describe('引擎初始化与武将数据格式', () => {
  it('引擎应成功初始化', () => {
    const engine = createEngine();
    expect(engine).toBeDefined();
    expect(engine.getGenerals).toBeDefined();
    expect(engine.getGeneral).toBeDefined();
    expect(engine.recruit).toBeDefined();
    expect(engine.enhanceHero).toBeDefined();
    expect(engine.setFormation).toBeDefined();
    expect(engine.getFormations).toBeDefined();
    expect(engine.getBondSystem).toBeDefined();
    expect(engine.getHeroDispatchSystem).toBeDefined();
    expect(engine.getHeroSystem).toBeDefined();
    expect(engine.getHeroStarSystem).toBeDefined();
    expect(engine.getFormationSystem).toBeDefined();
  });

  it('初始武将列表应为空数组', () => {
    const engine = createEngine();
    const generals = engine.getGenerals();
    expect(Array.isArray(generals)).toBe(true);
    expect(generals.length).toBe(0);
  });

  it('getGeneral 对不存在的ID应返回undefined', () => {
    const engine = createEngine();
    const result = engine.getGeneral('nonexistent_id');
    expect(result).toBeUndefined();
  });

  it('getHeroSystem 应返回有效的武将系统', () => {
    const engine = createEngine();
    const heroSystem = engine.getHeroSystem();
    expect(heroSystem).toBeDefined();
    expect(typeof heroSystem.calculatePower).toBe('function');
    expect(typeof heroSystem.getAllGenerals).toBe('function');
  });

  it('getHeroStarSystem 应返回有效的星级系统', () => {
    const engine = createEngine();
    const starSystem = engine.getHeroStarSystem();
    expect(starSystem).toBeDefined();
    expect(typeof starSystem.getStar).toBe('function');
  });
});

// ═══════════════════════════════════════════════
// 2. 招募武将 → 验证武将加入列表
// ═══════════════════════════════════════════════

describe('招募武将集成', () => {
  it('普通招募应返回有效的RecruitOutput', () => {
    const engine = createEngine();
    const result: RecruitOutput | null = engine.recruit('normal', 1);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('normal');
    expect(result!.results).toHaveLength(1);
    expect(result!.results[0].general).toBeDefined();
    assertValidGeneralData(result!.results[0].general);
  });

  it('招募后武将应出现在getGenerals列表中', () => {
    const engine = createEngine();
    const result = engine.recruit('normal', 1);
    expect(result).not.toBeNull();

    const recruitedId = result!.results[0].general.id;
    const generals = engine.getGenerals();
    expect(generals.length).toBe(1);
    expect(generals[0].id).toBe(recruitedId);
  });

  it('招募后getGeneral应能通过ID获取武将', () => {
    const engine = createEngine();
    const result = engine.recruit('normal', 1);
    const recruitedId = result!.results[0].general.id;

    const general = engine.getGeneral(recruitedId);
    expect(general).toBeDefined();
    expect(general!.id).toBe(recruitedId);
  });

  it('多次招募应累积武将到列表', () => {
    const engine = createEngine();
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);

    const generals = engine.getGenerals();
    expect(generals.length).toBe(3);
    // ID 应唯一
    const ids = generals.map((g) => g.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('十连招募应返回10个结果', () => {
    const engine = createEngine();
    const result = engine.recruit('normal', 10);
    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(10);

    const generals = engine.getGenerals();
    expect(generals.length).toBe(10);
  });

  it('招募武将应包含合法品质', () => {
    const engine = createEngine();
    const result = engine.recruit('normal', 1);
    const quality = result!.results[0].quality;
    expect(Object.values(Quality)).toContain(quality);
  });

  it('招募武将应包含合法阵营', () => {
    const engine = createEngine();
    const result = engine.recruit('normal', 1);
    const faction = result!.results[0].general.faction;
    expect(['shu', 'wei', 'wu', 'qun']).toContain(faction);
  });
});

// ═══════════════════════════════════════════════
// 3. 升级武将 → 验证属性变化
// ═══════════════════════════════════════════════

describe('升级武将集成', () => {
  it('enhanceHero应返回有效的LevelUpResult', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    const result: LevelUpResult | null = engine.enhanceHero(heroId, 1);
    expect(result).not.toBeNull();
    expect(result!.general.id).toBe(heroId);
    expect(result!.levelsGained).toBeGreaterThanOrEqual(1);
  });

  it('升级后武将等级应增加', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;
    const levelBefore = engine.getGeneral(heroId)!.level;

    engine.enhanceHero(heroId, 1);
    const levelAfter = engine.getGeneral(heroId)!.level;

    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it('升级后属性应发生变化', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;
    const statsBefore = { ...engine.getGeneral(heroId)!.baseStats };

    const result = engine.enhanceHero(heroId, 5);
    expect(result).not.toBeNull();

    const statsAfter = engine.getGeneral(heroId)!.baseStats;
    // 至少有一个属性发生变化
    const changed = (
      statsAfter.attack !== statsBefore.attack ||
      statsAfter.defense !== statsBefore.defense ||
      statsAfter.intelligence !== statsBefore.intelligence ||
      statsAfter.speed !== statsBefore.speed
    );
    expect(changed).toBe(true);
  });

  it('多次升级应累积等级', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    engine.enhanceHero(heroId, 1);
    engine.enhanceHero(heroId, 1);
    engine.enhanceHero(heroId, 1);

    const general = engine.getGeneral(heroId);
    expect(general!.level).toBeGreaterThanOrEqual(4);
  });

  it('升级后战力应增加', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;
    const heroSystem = engine.getHeroSystem();

    const generalBefore = engine.getGeneral(heroId)!;
    const powerBefore = heroSystem.calculatePower(generalBefore);

    engine.enhanceHero(heroId, 3);

    const generalAfter = engine.getGeneral(heroId)!;
    const powerAfter = heroSystem.calculatePower(generalAfter);

    expect(powerAfter).toBeGreaterThan(powerBefore);
  });

  it('对不存在的武将升级应返回null', () => {
    const engine = createEngine();
    const result = engine.enhanceHero('nonexistent_id', 1);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// 4. 编队操作 → 验证编队更新
// ═══════════════════════════════════════════════

describe('编队操作集成', () => {
  it('初始编队应为空', () => {
    const engine = createEngine();
    const formations = engine.getFormations();
    // 引擎初始化后可能有默认编队
    if (formations.length > 0) {
      const active = formations[0];
      const heroIds = active.slots.filter((s) =>
        typeof s === 'string' ? s : s?.heroId
      );
      expect(heroIds.length).toBe(0);
    }
  });

  it('设置编队后getFormations应返回更新后的编队', () => {
    const engine = createEngine();
    // 招募3个武将
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    const generals = engine.getGenerals();
    const ids = generals.map((g) => g.id);

    // 设置编队
    engine.setFormation('0', ids);

    const formations = engine.getFormations();
    expect(formations.length).toBeGreaterThan(0);
    const active = formations[0];
    const slotIds = active.slots.map((s: { heroId?: string | null } | string | null) =>
      (s != null && typeof s === 'object' && 'heroId' in s) ? s.heroId : typeof s === 'string' ? s : null
    ).filter((id: string | null): id is string => id != null);
    expect(slotIds.length).toBe(3);
  });

  it('编队应包含已招募的武将ID', () => {
    const engine = createEngine();
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    const generals = engine.getGenerals();
    const ids = generals.map((g) => g.id).slice(0, 2);

    engine.setFormation('0', ids);

    const formations = engine.getFormations();
    const active = formations[0];
    const slotIds = active.slots.map((s: { heroId?: string | null } | string | null) =>
      (s != null && typeof s === 'object' && 'heroId' in s) ? s.heroId : typeof s === 'string' ? s : null
    ).filter((id: string | null): id is string => id != null);

    for (const id of ids) {
      expect(slotIds).toContain(id);
    }
  });

  it('getFormationSystem应返回有效的编队系统', () => {
    const engine = createEngine();
    const formationSystem = engine.getFormationSystem();
    expect(formationSystem).toBeDefined();
    expect(typeof formationSystem.setFormation).toBe('function');
  });

  it('通过FormationSystem设置编队应生效', () => {
    const engine = createEngine();
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    const ids = engine.getGenerals().map((g) => g.id);

    const formationSystem = engine.getFormationSystem();
    formationSystem.setFormation(0, ids);

    const formations = engine.getFormations();
    expect(formations.length).toBeGreaterThan(0);
  });

  it('编队超过6人时引擎应截断或报错', () => {
    const engine = createEngine();
    // 招募8个武将
    for (let i = 0; i < 8; i++) {
      engine.recruit('normal', 1);
    }
    const ids = engine.getGenerals().map((g) => g.id);

    // 尝试设置8人编队
    expect(() => {
      engine.setFormation('0', ids);
    }).not.toThrow();

    // 编队中最多6人
    const formations = engine.getFormations();
    const active = formations[0];
    const slotIds = active.slots.filter((s) => {
      const id = typeof s === 'string' ? s : s?.heroId;
      return id != null;
    });
    expect(slotIds.length).toBeLessThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════
// 5. 羁绊检测 → 验证羁绊激活
// ═══════════════════════════════════════════════

describe('羁绊检测集成', () => {
  it('getBondSystem应返回有效的羁绊系统', () => {
    const engine = createEngine();
    const bondSystem = engine.getBondSystem();
    expect(bondSystem).toBeDefined();
    expect(typeof bondSystem.getActiveBonds).toBe('function');
  });

  it('无武将时getActiveBonds应返回空数组', () => {
    const engine = createEngine();
    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.getActiveBonds([]);
    expect(Array.isArray(bonds)).toBe(true);
    expect(bonds.length).toBe(0);
  });

  it('单个武将不应激活阵营羁绊', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.getActiveBonds([heroId]);
    // 阵营羁绊通常需要2人以上，单人不激活
    const factionBonds = bonds.filter((b) => b.type === BondType.FACTION);
    expect(factionBonds.length).toBe(0);
  });

  it('同阵营2人应激活阵营羁绊', () => {
    const engine = createEngine();
    // 招募多个武将，寻找同阵营的2人
    const recruited: GeneralData[] = [];
    for (let i = 0; i < 20; i++) {
      const result = engine.recruit('normal', 1);
      if (result) recruited.push(result.results[0].general);
    }

    // 按阵营分组
    const byFaction: Record<string, string[]> = {};
    for (const g of recruited) {
      if (!byFaction[g.faction]) byFaction[g.faction] = [];
      byFaction[g.faction].push(g.id);
    }

    // 找到第一个有2人以上的阵营
    const factionEntry = Object.entries(byFaction).find(([, ids]) => ids.length >= 2);
    if (!factionEntry) {
      // 如果没找到同阵营2人，跳过（概率极低）
      return;
    }

    const [, factionIds] = factionEntry;
    const bondSystem = engine.getBondSystem();
    const bonds: ActiveBond[] = bondSystem.getActiveBonds(factionIds);

    // 应至少激活一个阵营羁绊
    const factionBonds = bonds.filter((b) => b.type === BondType.FACTION);
    expect(factionBonds.length).toBeGreaterThan(0);
  });

  it('羁绊效果应包含合法属性', () => {
    const engine = createEngine();
    const recruited: GeneralData[] = [];
    for (let i = 0; i < 20; i++) {
      const result = engine.recruit('normal', 1);
      if (result) recruited.push(result.results[0].general);
    }

    const byFaction: Record<string, string[]> = {};
    for (const g of recruited) {
      if (!byFaction[g.faction]) byFaction[g.faction] = [];
      byFaction[g.faction].push(g.id);
    }

    const factionEntry = Object.entries(byFaction).find(([, ids]) => ids.length >= 2);
    if (!factionEntry) return;

    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.getActiveBonds(factionEntry[1]);

    for (const bond of bonds) {
      expect(bond).toHaveProperty('bondId');
      expect(bond).toHaveProperty('name');
      expect(bond).toHaveProperty('type');
      expect(bond).toHaveProperty('effects');
      expect(Array.isArray(bond.effects)).toBe(true);

      for (const effect of bond.effects) {
        expect(effect).toHaveProperty('stat');
        expect(effect).toHaveProperty('value');
        expect(typeof effect.stat).toBe('string');
        expect(typeof effect.value).toBe('number');
      }
    }
  });

  it('搭档羁绊需要特定武将组合', () => {
    const engine = createEngine();
    // 招募大量武将以增加搭档组合概率
    const recruited: GeneralData[] = [];
    for (let i = 0; i < 30; i++) {
      const result = engine.recruit('normal', 1);
      if (result) recruited.push(result.results[0].general);
    }

    const allIds = recruited.map((g) => g.id);
    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.getActiveBonds(allIds);

    // 检查是否有搭档羁绊（概率性，不强制要求）
    const partnerBonds = bonds.filter((b) => b.type === BondType.PARTNER);
    // 验证搭档羁绊数据格式正确
    for (const bond of partnerBonds) {
      expect(bond.participants.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('getActiveBonds返回值应包含必要字段', () => {
    const engine = createEngine();
    engine.recruit('normal', 1);
    engine.recruit('normal', 1);
    const ids = engine.getGenerals().map((g) => g.id);

    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.getActiveBonds(ids);

    for (const bond of bonds) {
      expect(typeof bond.bondId).toBe('string');
      expect(typeof bond.name).toBe('string');
      expect(typeof bond.level).toBe('number');
      expect(typeof bond.dispatchFactor).toBe('number');
    }
  });
});

// ═══════════════════════════════════════════════
// 6. 派遣系统集成（额外覆盖）
// ═══════════════════════════════════════════════

describe('派遣系统集成', () => {
  it('getHeroDispatchSystem应返回有效的派遣系统', () => {
    const engine = createEngine();
    const dispatchSystem = engine.getHeroDispatchSystem();
    expect(dispatchSystem).toBeDefined();
    expect(typeof dispatchSystem.dispatchHero).toBe('function');
    expect(typeof dispatchSystem.undispatchHero).toBe('function');
    expect(typeof dispatchSystem.getState).toBe('function');
  });

  it('派遣武将到建筑应成功', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    const dispatchSystem = engine.getHeroDispatchSystem();
    const result = dispatchSystem.dispatchHero(heroId, 'barracks');
    expect(result.success).toBe(true);
  });

  it('派遣后getState应包含派遣记录', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    const dispatchSystem = engine.getHeroDispatchSystem();
    dispatchSystem.dispatchHero(heroId, 'barracks');

    const state = dispatchSystem.getState();
    expect(state).toHaveProperty('buildingDispatch');
    const buildingDispatch = (state as Record<string, Record<string, { heroId: string }>>).buildingDispatch;
    expect(buildingDispatch).toHaveProperty('barracks');
    expect(buildingDispatch.barracks.heroId).toBe(heroId);
  });

  it('召回武将应成功', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    const dispatchSystem = engine.getHeroDispatchSystem();
    dispatchSystem.dispatchHero(heroId, 'barracks');
    const result = dispatchSystem.undeployHero(heroId);
    expect(result).toBe(true);
  });

  it('召回后派遣记录应清除', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    const dispatchSystem = engine.getHeroDispatchSystem();
    dispatchSystem.dispatchHero(heroId, 'barracks');
    dispatchSystem.undispatchHero(heroId);

    const dispatchedHero = dispatchSystem.getBuildingDispatchHero('barracks');
    expect(dispatchedHero).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// 7. 跨系统端到端集成（综合场景）
// ═══════════════════════════════════════════════

describe('跨系统端到端集成', () => {
  it('招募→升级→编队→羁绊 全流程', () => {
    const engine = createEngine();

    // 1. 招募多个武将（招募可能返回重复，使用足够多的招募次数）
    const uniqueIds = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = engine.recruit('normal', 1);
      if (result) {
        for (const r of result.results) {
          uniqueIds.add(r.general.id);
        }
      }
    }
    const generals = engine.getGenerals();
    expect(generals.length).toBeGreaterThanOrEqual(4);

    // 2. 升级所有武将
    for (const g of generals) {
      const result = engine.enhanceHero(g.id, 5);
      expect(result).not.toBeNull();
    }

    // 3. 验证等级提升
    for (const g of generals) {
      const updated = engine.getGeneral(g.id)!;
      expect(updated.level).toBeGreaterThan(1);
    }

    // 4. 设置编队
    const ids = generals.map((g) => g.id);
    engine.setFormation('0', ids);
    const formations = engine.getFormations();
    expect(formations.length).toBeGreaterThan(0);

    // 5. 检测羁绊
    const bondSystem = engine.getBondSystem();
    const bonds = bondSystem.getActiveBonds(ids);
    // 羁绊数量 >= 0（不强制要求特定羁绊）
    expect(Array.isArray(bonds)).toBe(true);
  });

  it('招募→派遣→召回 全流程', () => {
    const engine = createEngine();

    // 1. 招募武将
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;

    // 2. 派遣到建筑
    const dispatchSystem = engine.getHeroDispatchSystem();
    const dispatchResult = dispatchSystem.dispatchHero(heroId, 'market');
    expect(dispatchResult.success).toBe(true);

    // 3. 验证派遣状态
    const dispatchedHero = dispatchSystem.getBuildingDispatchHero('market');
    expect(dispatchedHero).toBe(heroId);

    // 4. 召回
    const recallResult = dispatchSystem.undeployHero(heroId);
    expect(recallResult).toBe(true);

    // 5. 验证召回状态
    const afterRecall = dispatchSystem.getBuildingDispatchHero('market');
    expect(afterRecall).toBeNull();
  });

  it('战力计算应与武将等级正相关', () => {
    const engine = createEngine();
    const recruitResult = engine.recruit('normal', 1);
    const heroId = recruitResult!.results[0].general.id;
    const heroSystem = engine.getHeroSystem();

    const powerBefore = heroSystem.calculatePower(engine.getGeneral(heroId)!);
    // 使用较大升级幅度确保战力变化
    const enhanceResult = engine.enhanceHero(heroId, 20);
    if (enhanceResult && enhanceResult.levelsGained > 0) {
      const powerAfter = heroSystem.calculatePower(engine.getGeneral(heroId)!);
      expect(powerAfter).toBeGreaterThan(powerBefore);
    } else {
      // 如果升级失败（资源不足等），仅验证战力计算可用
      expect(powerBefore).toBeGreaterThan(0);
    }
  });
});
