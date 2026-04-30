/**
 * ExpeditionTeamHelper 对抗式测试（Adversarial Test）
 *
 * 重点测试：
 *   P0-1: 空武将/超上限武将
 *   P0-2: 重复武将ID
 *   P0-3: 不存在武将
 *   P0-4: 阵营羁绊精确阈值
 *   P0-5: 战力计算极端值（零/负/NaN）
 *   P0-6: 智能编队边界
 *   P0-7: 武将互斥检查
 *
 * @module engine/expedition/__tests__/ExpeditionTeamHelper-adversarial
 */

import { ExpeditionTeamHelper } from '../ExpeditionTeamHelper';
import type { HeroBrief } from '../ExpeditionTeamHelper';
import type { ExpeditionTeam } from '../../../core/expedition/expedition.types';
import {
  FormationType,
  MAX_HEROES_PER_TEAM,
  FACTION_BOND_THRESHOLD,
  TROOP_COST,
} from '../../../core/expedition/expedition.types';

// ── 辅助 ──────────────────────────────

function createHero(id: string, faction: string = 'shu', power: number = 1000): HeroBrief {
  return { id, faction: faction as HeroBrief['faction'], power };
}

function createHeroMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function createActiveTeam(heroIds: string[]): ExpeditionTeam {
  return {
    id: 'active_team',
    name: '远征中',
    heroIds,
    formation: FormationType.STANDARD,
    troopCount: 100,
    maxTroops: 300,
    totalPower: 3000,
    currentRouteId: 'route_1',
    currentNodeId: 'node_1',
    isExpeditioning: true,
  };
}

// ═══════════════════════════════════════════════════════════
// P0-1: 空武将/超上限
// ═══════════════════════════════════════════════════════════

describe('P0-1: 空武将/超上限', () => {
  test('空武将列表校验失败', () => {
    const result = ExpeditionTeamHelper.validateTeam([], FormationType.STANDARD, {}, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('至少需要1名武将');
  });

  test('恰好MAX_HEROES_PER_TEAM名武将通过', () => {
    const heroes = Array.from({ length: MAX_HEROES_PER_TEAM }, (_, i) =>
      createHero(`hero_${i}`, 'shu', 1000),
    );
    const heroMap = createHeroMap(heroes);
    const ids = heroes.map(h => h.id);

    const result = ExpeditionTeamHelper.validateTeam(ids, FormationType.STANDARD, heroMap, []);
    expect(result.valid).toBe(true);
  });

  test('超过MAX_HEROES_PER_TEAM名武将校验失败', () => {
    const ids = Array.from({ length: MAX_HEROES_PER_TEAM + 1 }, (_, i) => `hero_${i}`);
    const result = ExpeditionTeamHelper.validateTeam(ids, FormationType.STANDARD, {}, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`武将数量不能超过${MAX_HEROES_PER_TEAM}名`);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-2: 不存在武将
// ═══════════════════════════════════════════════════════════

describe('P0-2: 不存在武将', () => {
  test('武将不在heroDataMap中校验失败', () => {
    const result = ExpeditionTeamHelper.validateTeam(['ghost'], FormationType.STANDARD, {}, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('武将ghost不存在');
  });

  test('部分武将不存在', () => {
    const heroes = [createHero('h1', 'shu')];
    const heroMap = createHeroMap(heroes);
    const result = ExpeditionTeamHelper.validateTeam(['h1', 'ghost'], FormationType.STANDARD, heroMap, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('武将ghost不存在');
  });
});

// ═══════════════════════════════════════════════════════════
// P0-3: 阵营羁绊精确阈值
// ═══════════════════════════════════════════════════════════

describe('P0-3: 阵营羁绊精确阈值', () => {
  test(`${FACTION_BOND_THRESHOLD - 1}名同阵营不触发羁绊`, () => {
    const heroes = Array.from({ length: FACTION_BOND_THRESHOLD - 1 }, (_, i) =>
      createHero(`shu_${i}`, 'shu'),
    );
    const heroMap = createHeroMap(heroes);
    const ids = heroes.map(h => h.id);

    const bond = ExpeditionTeamHelper.checkFactionBond(ids, heroMap);
    expect(bond).toBe(false);
  });

  test(`恰好${FACTION_BOND_THRESHOLD}名同阵营触发羁绊`, () => {
    const heroes = Array.from({ length: FACTION_BOND_THRESHOLD }, (_, i) =>
      createHero(`shu_${i}`, 'shu'),
    );
    const heroMap = createHeroMap(heroes);
    const ids = heroes.map(h => h.id);

    const bond = ExpeditionTeamHelper.checkFactionBond(ids, heroMap);
    expect(bond).toBe(true);
  });

  test('空列表不触发羁绊', () => {
    const bond = ExpeditionTeamHelper.checkFactionBond([], {});
    expect(bond).toBe(false);
  });

  test('全不同阵营不触发羁绊', () => {
    const heroes = [
      createHero('h1', 'shu'),
      createHero('h2', 'wei'),
      createHero('h3', 'wu'),
    ];
    const heroMap = createHeroMap(heroes);
    const ids = heroes.map(h => h.id);

    const bond = ExpeditionTeamHelper.checkFactionBond(ids, heroMap);
    expect(bond).toBe(false);
  });

  test('羁绊加成影响战力计算', () => {
    const shuHeroes = Array.from({ length: 3 }, (_, i) =>
      createHero(`shu_${i}`, 'shu', 1000),
    );
    const shuMap = createHeroMap(shuHeroes);
    const shuIds = shuHeroes.map(h => h.id);

    const mixedHeroes = [
      createHero('shu', 'shu', 1000),
      createHero('wei', 'wei', 1000),
      createHero('wu', 'wu', 1000),
    ];
    const mixedMap = createHeroMap(mixedHeroes);
    const mixedIds = mixedHeroes.map(h => h.id);

    const shuPower = ExpeditionTeamHelper.calculateTeamPower(shuIds, shuMap, FormationType.STANDARD);
    const mixedPower = ExpeditionTeamHelper.calculateTeamPower(mixedIds, mixedMap, FormationType.STANDARD);

    // 蜀国3人有羁绊加成10%，混合没有
    expect(shuPower).toBeGreaterThan(mixedPower);
  });

  test('羁绊不足时产生警告', () => {
    const heroes = [
      createHero('h1', 'shu'),
      createHero('h2', 'wei'),
      createHero('h3', 'wu'),
      createHero('h4', 'qun'),
    ];
    const heroMap = createHeroMap(heroes);
    const ids = heroes.map(h => h.id);

    const result = ExpeditionTeamHelper.validateTeam(ids, FormationType.STANDARD, heroMap, []);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('当前编队未触发阵营羁绊');
  });
});

// ═══════════════════════════════════════════════════════════
// P0-4: 战力计算极端值
// ═══════════════════════════════════════════════════════════

describe('P0-4: 战力计算极端值', () => {
  test('武将战力为0', () => {
    const heroes = [createHero('h1', 'shu', 0)];
    const heroMap = createHeroMap(heroes);

    const power = ExpeditionTeamHelper.calculateTeamPower(['h1'], heroMap, FormationType.STANDARD);
    expect(power).toBe(0);
  });

  test('武将战力为负数', () => {
    const heroes = [createHero('h1', 'shu', -500)];
    const heroMap = createHeroMap(heroes);

    const power = ExpeditionTeamHelper.calculateTeamPower(['h1'], heroMap, FormationType.STANDARD);
    // 负数战力应产生负数结果（可能是bug，但记录行为）
    expect(Number.isFinite(power)).toBe(true);
  });

  test('武将战力极大值', () => {
    const heroes = [createHero('h1', 'shu', Number.MAX_SAFE_INTEGER)];
    const heroMap = createHeroMap(heroes);

    const power = ExpeditionTeamHelper.calculateTeamPower(['h1'], heroMap, FormationType.STANDARD);
    expect(Number.isFinite(power)).toBe(true);
  });

  test('空武将列表战力为0', () => {
    const power = ExpeditionTeamHelper.calculateTeamPower([], {}, FormationType.STANDARD);
    expect(power).toBe(0);
  });

  test('不同阵型影响战力', () => {
    const heroes = [createHero('h1', 'shu', 1000)];
    const heroMap = createHeroMap(heroes);

    const standard = ExpeditionTeamHelper.calculateTeamPower(['h1'], heroMap, FormationType.STANDARD);
    const offensive = ExpeditionTeamHelper.calculateTeamPower(['h1'], heroMap, FormationType.OFFENSIVE);

    // 锋矢阵有攻击加成，普通阵型无加成
    expect(offensive).not.toBe(standard);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-5: 武将互斥检查
// ═══════════════════════════════════════════════════════════

describe('P0-5: 武将互斥检查', () => {
  test('已在远征中的武将不能重复使用', () => {
    const heroes = [createHero('h1', 'shu'), createHero('h2', 'shu')];
    const heroMap = createHeroMap(heroes);
    const activeTeams = [createActiveTeam(['h1'])];

    const result = ExpeditionTeamHelper.validateTeam(['h1', 'h2'], FormationType.STANDARD, heroMap, activeTeams);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('武将h1已在其他远征队伍中');
  });

  test('多支活跃队伍的武将全部锁定', () => {
    const heroes = [createHero('h1', 'shu'), createHero('h2', 'shu'), createHero('h3', 'shu')];
    const heroMap = createHeroMap(heroes);
    const activeTeams = [
      createActiveTeam(['h1']),
      createActiveTeam(['h2']),
    ];

    const result = ExpeditionTeamHelper.validateTeam(['h1', 'h2', 'h3'], FormationType.STANDARD, heroMap, activeTeams);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('武将h1已在其他远征队伍中');
    expect(result.errors).toContain('武将h2已在其他远征队伍中');
  });

  test('无活跃队伍时不互斥', () => {
    const heroes = [createHero('h1', 'shu')];
    const heroMap = createHeroMap(heroes);

    const result = ExpeditionTeamHelper.validateTeam(['h1'], FormationType.STANDARD, heroMap, []);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-6: 智能编队边界
// ═══════════════════════════════════════════════════════════

describe('P0-6: 智能编队边界', () => {
  test('无可用武将返回空数组', () => {
    const result = ExpeditionTeamHelper.autoComposeTeam(
      [],
      new Set(),
      FormationType.STANDARD,
    );
    expect(result).toEqual([]);
  });

  test('排除已远征武将', () => {
    const heroes = [
      createHero('h1', 'shu', 3000),
      createHero('h2', 'shu', 2000),
      createHero('h3', 'shu', 1000),
    ];
    const activeIds = new Set(['h1']);

    const result = ExpeditionTeamHelper.autoComposeTeam(heroes, activeIds, FormationType.STANDARD);
    expect(result).not.toContain('h1');
    expect(result).toContain('h2');
    expect(result).toContain('h3');
  });

  test('所有武将都在远征中返回空数组', () => {
    const heroes = [createHero('h1', 'shu')];
    const activeIds = new Set(['h1']);

    const result = ExpeditionTeamHelper.autoComposeTeam(heroes, activeIds, FormationType.STANDARD);
    expect(result).toEqual([]);
  });

  test('优先选择高战力武将', () => {
    const heroes = [
      createHero('weak', 'shu', 100),
      createHero('strong', 'shu', 5000),
    ];

    const result = ExpeditionTeamHelper.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 1);
    expect(result).toContain('strong');
    expect(result).not.toContain('weak');
  });

  test('优先触发阵营羁绊', () => {
    const heroes = [
      createHero('shu_1', 'shu', 1000),
      createHero('shu_2', 'shu', 900),
      createHero('shu_3', 'shu', 800),
      createHero('wei_1', 'wei', 2000),
    ];

    const result = ExpeditionTeamHelper.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 3);
    // 应优先选3个蜀国武将触发羁绊
    const shuCount = result.filter(id => id.startsWith('shu')).length;
    expect(shuCount).toBeGreaterThanOrEqual(FACTION_BOND_THRESHOLD);
  });

  test('maxHeroes限制有效', () => {
    const heroes = Array.from({ length: 10 }, (_, i) =>
      createHero(`hero_${i}`, 'shu', 1000 + i * 100),
    );

    const result = ExpeditionTeamHelper.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-7: 兵力消耗计算
// ═══════════════════════════════════════════════════════════

describe('P0-7: 兵力消耗计算', () => {
  test('0名武将消耗0', () => {
    expect(ExpeditionTeamHelper.calculateTroopCost(0)).toBe(0);
  });

  test('1名武将消耗正确', () => {
    expect(ExpeditionTeamHelper.calculateTroopCost(1)).toBe(TROOP_COST.expeditionPerHero);
  });

  test('负数武将消耗为负数（潜在问题）', () => {
    const cost = ExpeditionTeamHelper.calculateTroopCost(-1);
    expect(cost).toBe(-TROOP_COST.expeditionPerHero);
    // 注意：负数武将数产生负消耗，这可能是bug
  });
});
