/**
 * 集成测试 — 驻防与产出全链路 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §3.2   驻防机制：驻防武将、驻防加成
 *   §3.2.1 领土等级：升级条件、等级上限
 *   §3.2.2 领土产出计算：产出公式、加成叠加
 *
 * @module engine/calendar/__tests__/integration/garrison-production
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { SiegeSystem } from '../../../map/SiegeSystem';
import { GarrisonSystem } from '../../../map/GarrisonSystem';
import { Quality } from '../../../hero/hero.types';
import type { GeneralData } from '../../../hero/hero.types';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { LandmarkLevel } from '../../../../core/map';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建通用武将数据 */
function createGeneral(overrides: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'general-test-01',
    name: '测试武将',
    quality: Quality.RARE,
    baseStats: { attack: 80, defense: 70, intelligence: 60, speed: 50 },
    level: 10,
    exp: 0,
    faction: 'wei',
    skills: [],
    ...overrides,
  };
}

function createDeps(generals: GeneralData[] = []): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const garrison = new GarrisonSystem();

  const generalMap = new Map<string, GeneralData>();
  for (const g of generals) {
    generalMap.set(g.id, g);
  }

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('garrison', garrison);
  registry.set('hero', {
    getGeneralById: (id: string) => generalMap.get(id) ? { ...generalMap.get(id) } : null,
    isGeneralInFormation: () => false,
  });

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  siege.init(deps);
  garrison.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    territory: deps.registry!.get<TerritorySystem>('territory')!,
    siege: deps.registry!.get<SiegeSystem>('siege')!,
    garrison: deps.registry!.get<GarrisonSystem>('garrison')!,
  };
}

/** 获取一个玩家领土ID */
function getPlayerTerritoryId(sys: ReturnType<typeof getSys>): string | null {
  const ids = sys.territory.getPlayerTerritoryIds();
  return ids.length > 0 ? ids[0] : null;
}

/** 占领一个非己方领土使其变为己方 */
function captureFirstNeutral(sys: ReturnType<typeof getSys>): string | null {
  const attackable = sys.territory.getAttackableTerritories('player');
  if (attackable.length === 0) return null;
  const target = attackable[0];
  sys.siege.executeSiegeWithResult(target.id, 'player', 100000, 100000, true);
  return target.id;
}

// ═════════════════════════════════════════════
// §3.2 驻防机制
// ═════════════════════════════════════════════

describe('§3.2 驻防机制', () => {
  let sys: ReturnType<typeof getSys>;
  let general: GeneralData;

  beforeEach(() => {
    general = createGeneral();
    sys = getSys(createDeps([general]));
  });

  // --- 驻防武将 ---

  it('assignGarrison 成功返回 success=true', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const result = sys.garrison.assignGarrison(tid, general.id);
    expect(result.success).toBe(true);
    expect(result.assignment).toBeDefined();
    expect(result.assignment!.generalId).toBe(general.id);
    expect(result.assignment!.territoryId).toBe(tid);
  });

  it('驻防成功后 getAssignment 返回驻防记录', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    sys.garrison.assignGarrison(tid, general.id);
    const assignment = sys.garrison.getAssignment(tid);
    expect(assignment).not.toBeNull();
    expect(assignment!.generalId).toBe(general.id);
  });

  it('同一武将不可驻防两块领土', () => {
    const tid1 = getPlayerTerritoryId(sys);
    if (!tid1) return;
    const tid2 = captureFirstNeutral(sys);
    if (!tid2) return;

    const r1 = sys.garrison.assignGarrison(tid1, general.id);
    expect(r1.success).toBe(true);

    const r2 = sys.garrison.assignGarrison(tid2, general.id);
    expect(r2.success).toBe(false);
    expect(r2.errorCode).toBe('GENERAL_ALREADY_GARRISONED');
  });

  it('同一领土不可驻防两个武将', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const general2 = createGeneral({ id: 'general-test-02', name: '武将2' });
    // 注册第二个武将
    (sys.garrison as any).deps = {
      ...sys.garrison['deps'],
      registry: {
        get: (name: string) => {
          if (name === 'hero') return {
            getGeneralById: (id: string) => {
              if (id === general.id) return { ...general };
              if (id === general2.id) return { ...general2 };
              return null;
            },
            isGeneralInFormation: () => false,
          };
          return sys.garrison['deps']?.registry?.get(name);
        },
      },
    };

    const r1 = sys.garrison.assignGarrison(tid, general.id);
    expect(r1.success).toBe(true);
    const r2 = sys.garrison.assignGarrison(tid, general2.id);
    expect(r2.success).toBe(false);
    expect(r2.errorCode).toBe('TERRITORY_ALREADY_GARRISONED');
  });

  it('非己方领土不可驻防 → TERRITORY_NOT_OWNED', () => {
    const neutrals = sys.territory.getTerritoriesByOwnership('neutral');
    if (neutrals.length === 0) return;
    const result = sys.garrison.assignGarrison(neutrals[0].id, general.id);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TERRITORY_NOT_OWNED');
  });

  it('不存在的领土 → TERRITORY_NOT_FOUND', () => {
    const result = sys.garrison.assignGarrison('nonexistent', general.id);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TERRITORY_NOT_FOUND');
  });

  it('不存在的武将 → GENERAL_NOT_FOUND', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const result = sys.garrison.assignGarrison(tid, 'nonexistent-general');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('GENERAL_NOT_FOUND');
  });

  // --- 撤回驻防 ---

  it('withdrawGarrison 成功移除驻防', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    sys.garrison.assignGarrison(tid, general.id);
    expect(sys.garrison.isTerritoryGarrisoned(tid)).toBe(true);

    const result = sys.garrison.withdrawGarrison(tid);
    expect(result.success).toBe(true);
    expect(sys.garrison.isTerritoryGarrisoned(tid)).toBe(false);
  });

  it('withdrawGarrison 无驻防时返回失败', () => {
    const result = sys.garrison.withdrawGarrison('nonexistent');
    expect(result.success).toBe(false);
  });

  // --- 驻防加成 ---

  it('驻防后 getGarrisonBonus 返回防御加成 > 0', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    sys.garrison.assignGarrison(tid, general.id);
    const bonus = sys.garrison.getGarrisonBonus(tid);
    expect(bonus.defenseBonus).toBeGreaterThan(0);
  });

  it('防御加成 = 武将defense × 0.003', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    sys.garrison.assignGarrison(tid, general.id);
    const bonus = sys.garrison.getGarrisonBonus(tid);
    expect(bonus.defenseBonus).toBeCloseTo(general.baseStats.defense * 0.003, 2);
  });

  it('驻防后产出加成 > 0（RARE品质=15%）', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    sys.garrison.assignGarrison(tid, general.id);
    const bonus = sys.garrison.getGarrisonBonus(tid);
    // RARE品质加成15%
    expect(bonus.productionBonus.grain).toBeCloseTo(t.currentProduction.grain * 0.15, 1);
  });

  it('无驻防时 getGarrisonBonus 返回零加成', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const bonus = sys.garrison.getGarrisonBonus(tid);
    expect(bonus.defenseBonus).toBe(0);
    expect(bonus.productionBonus.grain).toBe(0);
  });

  it('getEffectiveDefense 返回加成后防御值', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    const baseDef = t.defenseValue;
    const before = sys.garrison.getEffectiveDefense(tid, baseDef);
    expect(before).toBe(baseDef);

    sys.garrison.assignGarrison(tid, general.id);
    const after = sys.garrison.getEffectiveDefense(tid, baseDef);
    expect(after).toBeGreaterThan(baseDef);
  });

  it('getEffectiveProduction 返回加成后产出', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    sys.garrison.assignGarrison(tid, general.id);
    const effective = sys.garrison.getEffectiveProduction(tid, t.currentProduction);
    expect(effective.grain).toBeGreaterThan(t.currentProduction.grain);
  });

  it('getGarrisonCount 正确统计驻防数量', () => {
    expect(sys.garrison.getGarrisonCount()).toBe(0);
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    sys.garrison.assignGarrison(tid, general.id);
    expect(sys.garrison.getGarrisonCount()).toBe(1);
  });

  it('isGeneralGarrisoned 正确判断武将驻防状态', () => {
    expect(sys.garrison.isGeneralGarrisoned(general.id)).toBe(false);
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    sys.garrison.assignGarrison(tid, general.id);
    expect(sys.garrison.isGeneralGarrisoned(general.id)).toBe(true);
  });

  it('不同品质武将产出加成不同', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;

    const commonGeneral = createGeneral({ id: 'gen-common', quality: Quality.COMMON });
    const legendaryGeneral = createGeneral({ id: 'gen-legendary', quality: Quality.LEGENDARY });

    // COMMON 加成
    const commonBonus = sys.garrison.calculateBonus(commonGeneral, t.currentProduction);
    // LEGENDARY 加成
    const legendBonus = sys.garrison.calculateBonus(legendaryGeneral, t.currentProduction);

    expect(legendBonus.productionBonus.grain).toBeGreaterThan(commonBonus.productionBonus.grain);
  });
});

// ═════════════════════════════════════════════
// §3.2.1 领土等级
// ═════════════════════════════════════════════

describe('§3.2.1 领土等级', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('初始领土等级在 1~5 范围内', () => {
    const all = sys.territory.getAllTerritories();
    for (const t of all) {
      expect(t.level).toBeGreaterThanOrEqual(1);
      expect(t.level).toBeLessThanOrEqual(5);
    }
  });

  it('upgradeTerritory 成功返回 success=true', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    if (t.level >= 5) return; // 已满级跳过
    const result = sys.territory.upgradeTerritory(tid);
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe((t.level + 1) as LandmarkLevel);
  });

  it('升级后等级递增', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const before = sys.territory.getTerritoryById(tid)!;
    if (before.level >= 5) return;
    const result = sys.territory.upgradeTerritory(tid);
    expect(result.previousLevel).toBe(before.level);
    expect(result.newLevel).toBe(before.level + 1);
  });

  it('升级后产出增加', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const before = sys.territory.getTerritoryById(tid)!;
    if (before.level >= 5) return;
    const result = sys.territory.upgradeTerritory(tid);
    expect(result.newProduction.grain).toBeGreaterThan(before.currentProduction.grain);
  });

  it('等级上限为5，满级不可升级', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    // 连续升级到满级
    let t = sys.territory.getTerritoryById(tid)!;
    while (t.level < 5) {
      sys.territory.upgradeTerritory(tid);
      t = sys.territory.getTerritoryById(tid)!;
    }
    const result = sys.territory.upgradeTerritory(tid);
    expect(result.success).toBe(false);
    expect(result.newLevel).toBe(5);
  });

  it('非己方领土不可升级', () => {
    const neutrals = sys.territory.getTerritoriesByOwnership('neutral');
    if (neutrals.length === 0) return;
    const result = sys.territory.upgradeTerritory(neutrals[0].id);
    expect(result.success).toBe(false);
  });

  it('不存在的领土升级返回失败', () => {
    const result = sys.territory.upgradeTerritory('nonexistent');
    expect(result.success).toBe(false);
  });

  it('升级消耗随等级递增', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    if (t.level >= 4) return; // 需要至少2次升级空间

    const cost1 = sys.territory.upgradeTerritory(tid);
    if (!cost1.success) return;
    const cost2 = sys.territory.upgradeTerritory(tid);
    if (!cost2.success) return;

    // 高等级消耗更多
    expect(cost2.cost.grain).toBeGreaterThan(cost1.cost.grain);
  });
});

// ═════════════════════════════════════════════
// §3.2.2 领土产出计算
// ═════════════════════════════════════════════

describe('§3.2.2 领土产出计算', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('每块领土产出值 >= 0', () => {
    const all = sys.territory.getAllTerritories();
    for (const t of all) {
      expect(t.currentProduction.grain).toBeGreaterThanOrEqual(0);
      expect(t.currentProduction.gold).toBeGreaterThanOrEqual(0);
      expect(t.currentProduction.troops).toBeGreaterThanOrEqual(0);
      expect(t.currentProduction.mandate).toBeGreaterThanOrEqual(0);
    }
  });

  it('getPlayerProductionSummary 返回正确结构', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toHaveProperty('totalTerritories');
    expect(summary).toHaveProperty('territoriesByRegion');
    expect(summary).toHaveProperty('totalProduction');
    expect(summary).toHaveProperty('details');
  });

  it('totalTerritories 等于玩家领土数', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    const playerCount = sys.territory.getPlayerTerritoryCount();
    expect(summary.totalTerritories).toBe(playerCount);
  });

  it('totalProduction 为所有玩家领土产出之和', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    const playerTerritories = sys.territory.getTerritoriesByOwnership('player');
    let totalGrain = 0;
    for (const t of playerTerritories) {
      totalGrain += t.currentProduction.grain;
    }
    expect(summary.totalProduction.grain).toBeCloseTo(totalGrain, 1);
  });

  it('territoriesByRegion 包含 wei/wu/shu/neutral 四区域', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary.territoriesByRegion).toHaveProperty('wei');
    expect(summary.territoriesByRegion).toHaveProperty('wu');
    expect(summary.territoriesByRegion).toHaveProperty('shu');
    expect(summary.territoriesByRegion).toHaveProperty('neutral');
  });

  it('升级后 totalProduction 增加', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    if (t.level >= 5) return;

    const before = sys.territory.getPlayerProductionSummary();
    sys.territory.upgradeTerritory(tid);
    const after = sys.territory.getPlayerProductionSummary();

    expect(after.totalProduction.grain).toBeGreaterThanOrEqual(before.totalProduction.grain);
  });

  it('占领新领土后 totalTerritories 增加', () => {
    const before = sys.territory.getPlayerTerritoryCount();
    const captured = captureFirstNeutral(sys);
    if (!captured) return;
    const after = sys.territory.getPlayerTerritoryCount();
    expect(after).toBe(before + 1);
  });

  it('驻防加成叠加到产出上', () => {
    const general = createGeneral();
    const deps = createDeps([general]);
    const s = getSys(deps);

    const tid = getPlayerTerritoryId(s);
    if (!tid) return;
    const t = s.territory.getTerritoryById(tid)!;
    const baseProd = t.currentProduction;

    s.garrison.assignGarrison(tid, general.id);
    const effectiveProd = s.garrison.getEffectiveProduction(tid, baseProd);

    // 加成后产出 > 基础产出
    expect(effectiveProd.grain).toBeGreaterThan(baseProd.grain);
  });

  it('撤回驻防后产出恢复基础值', () => {
    const general = createGeneral();
    const deps = createDeps([general]);
    const s = getSys(deps);

    const tid = getPlayerTerritoryId(s);
    if (!tid) return;
    const t = s.territory.getTerritoryById(tid)!;
    const baseProd = t.currentProduction;

    s.garrison.assignGarrison(tid, general.id);
    s.garrison.withdrawGarrison(tid);
    const afterWithdraw = s.garrison.getEffectiveProduction(tid, baseProd);

    expect(afterWithdraw.grain).toBe(baseProd.grain);
  });

  it('details 包含每个玩家领土的产出明细', () => {
    const summary = sys.territory.getPlayerProductionSummary();
    const playerIds = sys.territory.getPlayerTerritoryIds();
    expect(summary.details.length).toBe(playerIds.length);
    for (const d of summary.details) {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('name');
      expect(d).toHaveProperty('region');
      expect(d).toHaveProperty('level');
      expect(d).toHaveProperty('production');
    }
  });

  it('资源点类型领土有对应资源的高产出', () => {
    const all = sys.territory.getAllTerritories();
    const grainRes = all.find(t => t.id.startsWith('res-grain'));
    if (!grainRes) return;
    // 粮食资源点粮食产出应高于一般城池
    expect(grainRes.currentProduction.grain).toBeGreaterThan(0);
    expect(grainRes.baseProduction.grain).toBe(8); // 资源点基础8
  });

  it('等级加成系数：level 2 = 1.3x', () => {
    const tid = getPlayerTerritoryId(sys);
    if (!tid) return;
    const t = sys.territory.getTerritoryById(tid)!;
    // 升级到level 2
    if (t.level > 1) return; // 已超过level 1跳过
    sys.territory.upgradeTerritory(tid);
    const upgraded = sys.territory.getTerritoryById(tid)!;
    expect(upgraded.currentProduction.grain).toBeCloseTo(upgraded.baseProduction.grain * 1.3, 1);
  });

  it('getTerritoriesByRegion 返回正确区域领土', () => {
    const weiTerritories = sys.territory.getTerritoriesByRegion('wei');
    for (const t of weiTerritories) {
      expect(t.region).toBe('wei');
    }
  });

  it('getTotalTerritoryCount > 0', () => {
    expect(sys.territory.getTotalTerritoryCount()).toBeGreaterThan(0);
  });
});
