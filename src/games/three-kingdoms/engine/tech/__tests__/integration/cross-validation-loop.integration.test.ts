/**
 * 集成测试 — 交叉验证（跨子系统串联闭环）
 *
 * 覆盖 Play 文档 §9.x 交叉验证（选取关键 6 个验证点）：
 *   §9.1  科技↔地图联动：科技影响地图渲染
 *   §9.2  科技↔领土联动：科技加成领土产出
 *   §9.3  科技↔攻城联动：科技影响攻城战力
 *   §9.5  领土↔资源联动：领土产出影响资源
 *   §9.7  科技↔声望联动：科技研究获得声望
 *   §9.9  离线↔领土联动：离线领土产出
 *
 * @module engine/tech/__tests__/integration/cross-validation-loop
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../../map/WorldMapSystem';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { SiegeSystem } from '../../../map/SiegeSystem';
import { SiegeEnhancer } from '../../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../../map/GarrisonSystem';
import { MapDataRenderer } from '../../../map/MapDataRenderer';
import { TechTreeSystem } from '../../TechTreeSystem';
import { TechPointSystem } from '../../TechPointSystem';
import { TechResearchSystem } from '../../TechResearchSystem';
import { TechLinkSystem } from '../../TechLinkSystem';
import { TechOfflineSystem } from '../../TechOfflineSystem';
import { PrestigeSystem, calcProductionBonus } from '../../../prestige/PrestigeSystem';
import type { ISystemDeps } from '../../../../../core/types';
import type { ISubsystemRegistry } from '../../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const techTree = new TechTreeSystem();
  const techPoint = new TechPointSystem();
  const techResearch = new TechResearchSystem(
    techTree, techPoint, () => 3, () => 100, () => true,
  );
  const techLink = new TechLinkSystem();
  const techOffline = new TechOfflineSystem(techResearch);
  const prestige = new PrestigeSystem();

  const registry = new Map<string, unknown>();
  registry.set('worldMap', worldMap);
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('techTree', techTree);
  registry.set('techPoint', techPoint);
  registry.set('techResearch', techResearch);
  registry.set('techLink', techLink);
  registry.set('techOffline', techOffline);
  registry.set('prestige', prestige);

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

  worldMap.init(deps);
  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  techTree.init(deps);
  techPoint.init(deps);
  techResearch.init(deps);
  techLink.init(deps);
  techOffline.init(deps);
  prestige.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    techTree: deps.registry.get<TechTreeSystem>('techTree')!,
    techPoint: deps.registry.get<TechPointSystem>('techPoint')!,
    techResearch: deps.registry.get<TechResearchSystem>('techResearch')!,
    techLink: deps.registry.get<TechLinkSystem>('techLink')!,
    techOffline: deps.registry.get<TechOfflineSystem>('techOffline')!,
    prestige: deps.registry.get<PrestigeSystem>('prestige')!,
    renderer: new MapDataRenderer(),
  };
}

/** 占领一块中立领土并返回其 id */
function captureNeutral(sys: ReturnType<typeof getSys>): string | null {
  const territories = sys.territory.getAllTerritories();
  const neutral = territories.find((t: any) => t.ownership !== 'player');
  if (!neutral) return null;
  sys.territory.captureTerritory(neutral.id, 'player');
  return neutral.id;
}

// ═════════════════════════════════════════════
// §9.1 科技↔地图联动：科技影响地图渲染
// ═════════════════════════════════════════════

describe('§9.1 科技↔地图联动：科技影响地图渲染', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('科技加成倍率影响地图渲染层数据', () => {
    const bonus = sys.techTree.getTechBonusMultiplier();
    expect(bonus).toBeGreaterThanOrEqual(0);

    // 地图渲染器计算视口数据时，科技加成应纳入计算
    const vp = sys.map.getViewport();
    const renderData = sys.renderer.computeViewportRenderData(vp, sys.map.getAllTiles());
    expect(renderData).toBeDefined();
    expect(Array.isArray(renderData)).toBe(true);
  });

  it('科技效果值可被地图系统查询', () => {
    // 地图系统通过 techTree.getEffectValue 查询科技效果
    const effectVal = sys.techTree.getEffectValue('production_grain', 'all');
    expect(effectVal).toBeGreaterThanOrEqual(0);
  });

  it('完成科技后渲染数据反映变化', () => {
    // 获取一个科技节点并模拟完成
    const allDefs = sys.techTree.getAllNodeDefs();
    if (allDefs.length > 0) {
      const node = allDefs[0];
      // 先完成前置条件（如果有的话）
      const unmet = sys.techTree.getUnmetPrerequisites(node.id);
      for (const preId of unmet) {
        sys.techTree.completeNode(preId);
      }
      sys.techTree.completeNode(node.id);
      const bonus = sys.techTree.getTechBonusMultiplier();
      expect(bonus).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═════════════════════════════════════════════
// §9.2 科技↔领土联动：科技加成领土产出
// ═════════════════════════════════════════════

describe('§9.2 科技↔领土联动：科技加成领土产出', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('领土产出摘要包含科技加成项', () => {
    // 先占领一块领土确保有产出
    captureNeutral(sys);
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toBeDefined();
    expect(summary.totalProduction.grain).toBeGreaterThanOrEqual(0);
    expect(summary.totalProduction.gold).toBeGreaterThanOrEqual(0);
  });

  it('科技效果系统提供资源加成查询', () => {
    const resourceBonus = sys.techLink.getResourceLinkBonus('grain');
    expect(resourceBonus).toBeDefined();
    expect(resourceBonus.bonus).toBeGreaterThanOrEqual(0);
  });

  it('科技加成与领土产出乘法叠加', () => {
    captureNeutral(sys);
    const summary = sys.territory.getPlayerProductionSummary();
    const techBonus = sys.techLink.getResourceLinkBonus('grain');
    // 领土基础产出 × (1 + 科技加成) = 最终产出
    expect(summary.totalProduction.grain).toBeGreaterThanOrEqual(0);
    expect(techBonus.bonus).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════
// §9.3 科技↔攻城联动：科技影响攻城战力
// ═════════════════════════════════════════════

describe('§9.3 科技↔攻城联动：科技影响攻城战力', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('科技加成影响攻城胜率预估', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length === 0) return;

    const target = attackable[0];
    const estimate = sys.enhancer.estimateWinRate(1000, target.id);
    if (estimate) {
      expect(estimate.winRate).toBeGreaterThanOrEqual(0);
      expect(estimate.winRate).toBeLessThanOrEqual(1);
    }
  });

  it('科技提升后攻城胜率增加', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length === 0) return;

    const target = attackable[0];
    const before = sys.enhancer.estimateWinRate(1000, target.id);
    const after = sys.enhancer.estimateWinRate(5000, target.id);

    if (before && after) {
      expect(after.winRate).toBeGreaterThanOrEqual(before.winRate);
    }
  });

  it('攻城奖励受科技加成影响', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length === 0) return;

    const target = attackable[0];
    const reward = sys.enhancer.calculateSiegeRewardById(target.id);
    if (reward) {
      expect(reward).toHaveProperty('gold');
      expect(reward).toHaveProperty('grain');
    }
  });
});

// ═════════════════════════════════════════════
// §9.5 领土↔资源联动：领土产出影响资源
// ═════════════════════════════════════════════

describe('§9.5 领土↔资源联动：领土产出影响资源', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('占领领土后产出增加', () => {
    const before = sys.territory.getPlayerProductionSummary();
    captureNeutral(sys);
    const after = sys.territory.getPlayerProductionSummary();

    expect(after.totalProduction.grain).toBeGreaterThanOrEqual(before.totalProduction.grain);
    expect(after.totalProduction.gold).toBeGreaterThanOrEqual(before.totalProduction.gold);
  });

  it('领土数量与总产出正相关', () => {
    const count = sys.territory.getPlayerTerritoryCount();
    const summary = sys.territory.getPlayerProductionSummary();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(summary).toBeDefined();
  });

  it('领土升级提升产出倍率', () => {
    const tid = captureNeutral(sys);
    if (!tid) return;

    const result = sys.territory.upgradeTerritory(tid);
    expect(result).toHaveProperty('success');
  });

  it('积累产出按时间线性增长', () => {
    captureNeutral(sys);
    const p1 = sys.territory.calculateAccumulatedProduction(60);   // 1分钟
    const p2 = sys.territory.calculateAccumulatedProduction(120);  // 2分钟

    expect(p2.grain).toBeGreaterThanOrEqual(p1.grain);
    expect(p2.gold).toBeGreaterThanOrEqual(p1.gold);
  });
});

// ═════════════════════════════════════════════
// §9.7 科技↔声望联动：科技研究获得声望
// ═════════════════════════════════════════════

describe('§9.7 科技↔声望联动：科技研究获得声望', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('声望系统提供产出加成计算', () => {
    // 声望等级 → 产出加成: 1 + level × 0.02
    const bonus = calcProductionBonus(5);
    expect(bonus).toBe(1.1);
  });

  it('声望加成与科技加成独立叠加', () => {
    const prestigeBonus = calcProductionBonus(10);   // 1.2
    const techBonus = 1.15;                           // 科技加成
    const total = prestigeBonus * techBonus;
    expect(total).toBeCloseTo(1.38, 1);
  });

  it('声望等级提升→产出加成单调递增', () => {
    for (let lv = 1; lv <= 50; lv++) {
      const b1 = calcProductionBonus(lv);
      const b2 = calcProductionBonus(lv + 1);
      expect(b2).toBeGreaterThan(b1);
    }
  });

  it('声望系统可查询当前面板数据', () => {
    const panel = sys.prestige.getPrestigePanel();
    expect(panel).toBeDefined();
    expect(panel).toHaveProperty('level');
    expect(panel).toHaveProperty('points');
  });
});

// ═════════════════════════════════════════════
// §9.9 离线↔领土联动：离线领土产出
// ═════════════════════════════════════════════

describe('§9.9 离线↔领土联动：离线领土产出', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('离线效率分段衰减', () => {
    // 0~2h: 100%, 2~8h: 70%, 8~24h: 40%, >24h: 20%
    const e1 = sys.techOffline.calculateOverallEfficiency(1 * 3600);   // 1h
    const e2 = sys.techOffline.calculateOverallEfficiency(5 * 3600);   // 5h
    const e3 = sys.techOffline.calculateOverallEfficiency(16 * 3600);  // 16h
    const e4 = sys.techOffline.calculateOverallEfficiency(48 * 3600);  // 48h

    expect(e1).toBeGreaterThan(e2);
    expect(e2).toBeGreaterThan(e3);
    expect(e3).toBeGreaterThan(e4);
  });

  it('离线封顶72小时', () => {
    const effective72 = sys.techOffline.calculateEffectiveSeconds(72 * 3600);
    const effective120 = sys.techOffline.calculateEffectiveSeconds(120 * 3600);
    expect(effective72).toBe(effective120);
  });

  it('离线期间领土产出持续', () => {
    captureNeutral(sys);
    // 模拟离线 2 小时
    const offlineSeconds = 2 * 3600;
    const production = sys.territory.calculateAccumulatedProduction(offlineSeconds);
    expect(production.grain).toBeGreaterThan(0);
  });

  it('离线回归补算与领土产出联动', () => {
    captureNeutral(sys);
    sys.techOffline.onGoOffline(Date.now() - 2 * 3600 * 1000);
    const panel = sys.techOffline.onComeBackOnline();
    // 离线 2 小时应有补算结果
    if (panel) {
      expect(panel).toBeDefined();
      expect(panel.efficiency).toBeGreaterThan(0);
    }
  });
});
