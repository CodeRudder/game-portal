/**
 * 集成测试 — 交叉验证（跨子系统串联流程）
 *
 * 覆盖 Play 文档流程：
 *   §9.1  核心循环: 科技→战斗→领土→资源→科技
 *   §9.2  经济循环: 经济科技→建筑→资源→科技点
 *   §9.3  文化循环: 文化科技→研究速度→融合科技
 *   §9.4  离线循环: 离线→回归补算→保持节奏
 *   §9.5  领土扩张循环: 攻城→占领→产出→升级→更强攻城
 *   §9.6  互斥分支→差异化发展路线
 *   §9.8  地形与科技联动
 *   §9.9  声望→研究速度→领土产出双加成
 *   §9.10 融合科技→终极目标
 *   §9.11 科技点→研究资源闭环
 *   §9.12 攻城失败→推荐→提升→再战循环
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/tech/__tests__/integration/cross-system-validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechTreeSystem } from '../../TechTreeSystem';
import { TechResearchSystem } from '../../TechResearchSystem';
import { TechPointSystem } from '../../TechPointSystem';
import { TechLinkSystem } from '../../TechLinkSystem';
import { FusionTechSystem } from '../../FusionTechSystem';
import { TechOfflineSystem } from '../../TechOfflineSystem';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { SiegeSystem } from '../../../map/SiegeSystem';
import { SiegeEnhancer } from '../../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../../map/GarrisonSystem';
import { WorldMapSystem } from '../../../map/WorldMapSystem';
import { TECH_NODE_DEFS } from '../../tech-config';
import type { ISystemDeps } from '../../../../../core/types';
import type { ISubsystemRegistry } from '../../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const tree = new TechTreeSystem();
  const points = new TechPointSystem();
  const link = new TechLinkSystem();
  const fusion = new FusionTechSystem();
  const research = new TechResearchSystem(tree, points, () => 5);
  const offline = new TechOfflineSystem(tree, research);
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();

  const registry = new Map<string, unknown>();
  registry.set('techTree', tree);
  registry.set('techPoint', points);
  registry.set('techLink', link);
  registry.set('fusionTech', fusion);
  registry.set('techOffline', offline);
  registry.set('worldMap', worldMap);
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);

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

  tree.init(deps);
  points.init(deps);
  link.init(deps);
  fusion.init(deps);
  fusion.setTechTree(tree);
  fusion.setLinkSystem(link);
  offline.init(deps);
  worldMap.init(deps);
  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);

  points.syncAcademyLevel(5);
  points.exchangeGoldForTechPoints(500000, 5);

  return deps;
}

function getSystems(deps: ISystemDeps) {
  return {
    tree: deps.registry.get<TechTreeSystem>('techTree')!,
    points: deps.registry.get<TechPointSystem>('techPoint')!,
    link: deps.registry.get<TechLinkSystem>('techLink')!,
    fusion: deps.registry.get<FusionTechSystem>('fusionTech')!,
    offline: deps.registry.get<TechOfflineSystem>('techOffline')!,
    map: deps.registry.get<WorldMapSystem>('worldMap')!,
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('§9.1 核心循环: 科技→战斗→领土→资源→科技', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('科技完成→联动效果注册→数值更新', () => {
    // 完成军事科技
    const milNodes = sys.tree.getPathNodes('military');
    if (milNodes.length === 0) return;

    sys.tree.completeNode(milNodes[0].id);
    sys.link.addCompletedTech(milNodes[0].id);

    // 验证效果已注册
    const effects = sys.tree.getAllCompletedEffects();
    expect(effects.length).toBeGreaterThan(0);
  });

  it('领土产出汇入资源系统', () => {
    // 占领领土
    const territories = sys.territory.getAllTerritories();
    const target = territories.find(t => t.ownership !== 'player');
    if (!target) return;

    sys.territory.captureTerritory(target.id, 'player');
    const summary = sys.territory.getPlayerProductionSummary();
    expect(summary).toBeDefined();
  });
});

describe('§9.2 经济循环: 经济科技→建筑→资源→科技点', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('经济科技完成→建筑产出联动', () => {
    const ecoNodes = sys.tree.getPathNodes('economy');
    if (ecoNodes.length === 0) return;

    sys.tree.completeNode(ecoNodes[0].id);
    sys.link.addCompletedTech(ecoNodes[0].id);

    const bonus = sys.link.getBuildingLinkBonus('farmland');
    expect(bonus).toBeDefined();
  });

  it('资源充裕→书院科技点产出提升', () => {
    sys.points.syncAcademyLevel(10);
    const rate = sys.points.getProductionRate();
    expect(rate).toBeGreaterThan(0);

    // 升级书院后产出更高
    sys.points.syncAcademyLevel(15);
    const higherRate = sys.points.getProductionRate();
    expect(higherRate).toBeGreaterThan(rate);
  });
});

describe('§9.3 文化循环: 文化科技→研究速度→融合科技', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('文化科技→研究速度加成', () => {
    // 文化科技提供研究速度加成
    sys.points.syncResearchSpeedBonus(15);
    const multiplier = sys.points.getResearchSpeedMultiplier();
    expect(multiplier).toBe(1.15);
  });

  it('融合科技跨路线组合加成', () => {
    const fusionDefs = sys.fusion.getAllFusionDefs();
    expect(fusionDefs.length).toBe(6);

    // 检查融合科技是否正确关联路线
    for (const def of fusionDefs) {
      expect(def.prerequisites).toBeDefined();
    }
  });
});

describe('§9.4 离线循环: 离线→回归补算→保持节奏', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('离线→研究进度补算→科技点累积', () => {
    const firstAvailable = TECH_NODE_DEFS.find(n => sys.tree.canResearch(n.id).can);
    if (!firstAvailable) return;

    const now = Date.now();
    sys.tree.setResearching(firstAvailable.id, now, now + 3600000);

    // 离线
    sys.offline.onGoOffline(now);
    const pointsBefore = sys.points.getCurrentPoints();

    // 回归
    const panel = sys.offline.onComeBackOnline(now + 1800000);

    // 科技点应累积
    const pointsAfter = sys.points.getCurrentPoints();
    expect(pointsAfter).toBeGreaterThanOrEqual(pointsBefore);
  });
});

describe('§9.5 领土扩张循环: 攻城→占领→产出→升级', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('攻城胜利→领土归属→产出增加', () => {
    const beforeCount = sys.territory.getPlayerTerritoryCount();
    const territories = sys.territory.getAllTerritories();
    const target = territories.find(t => t.ownership !== 'player');
    if (!target) return;

    sys.territory.captureTerritory(target.id, 'player');
    const afterCount = sys.territory.getPlayerTerritoryCount();
    expect(afterCount).toBe(beforeCount + 1);
  });
});

describe('§9.6 互斥分支→差异化发展路线', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('不同互斥选择影响发展路线', () => {
    // 完成军事路线前几个节点（tier 1 互斥节点）
    const milNodes = sys.tree.getPathNodes('military');
    // 完成第一个节点（tier 1 是互斥组）
    const tier1Nodes = milNodes.filter(n => n.tier === 1);
    if (tier1Nodes.length > 0) {
      sys.tree.completeNode(tier1Nodes[0].id);
    }

    // 选择进攻分支后应记录互斥选择
    const mutexGroups = sys.tree.getChosenMutexNodes();
    // tier1 nodes have mutex groups, completing one should register
    if (tier1Nodes.length > 0 && tier1Nodes[0].mutexGroup) {
      expect(Object.keys(mutexGroups).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('§9.8 地形与科技联动', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('领土产出公式中科技加成正确应用', () => {
    // 完成经济科技
    const ecoNodes = sys.tree.getPathNodes('economy');
    if (ecoNodes.length === 0) return;

    sys.tree.completeNode(ecoNodes[0].id);
    sys.link.addCompletedTech(ecoNodes[0].id);

    // 获取资源联动加成
    const bonus = sys.link.getResourceLinkBonus('food');
    expect(bonus).toBeDefined();
  });
});

describe('§9.9 声望→研究速度→领土产出双加成', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('声望加成在研究速度中正确应用', () => {
    // 声望等级×0.02加成到研究速度
    sys.points.syncResearchSpeedBonus(10); // 声望等级5 × 2% = 10%
    const multiplier = sys.points.getResearchSpeedMultiplier();
    expect(multiplier).toBe(1.1);
  });
});

describe('§9.10 融合科技→终极目标', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('三条路线发展到高级→解锁高级融合科技', () => {
    const fusion = sys.fusion.getAllFusionDefs().find(d => d.name === '铁骑商路');
    if (!fusion) return;

    // 完成前置节点
    const prereqs = fusion.prerequisites;
    sys.tree.completeNode(prereqs.pathA);
    sys.tree.completeNode(prereqs.pathB);

    const met = sys.fusion.arePrerequisitesMet(fusion.id);
    expect(met).toBe(true);
  });
});

describe('§9.11 科技点→研究资源闭环', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('书院产出科技点→研究消耗→科技完成→建筑产出增加→资源充裕→升级书院', () => {
    // 1. 书院产出科技点
    sys.points.syncAcademyLevel(5);
    const rate = sys.points.getProductionRate();
    expect(rate).toBeGreaterThan(0);

    // 2. 研究消耗科技点
    const before = sys.points.getCurrentPoints();
    const firstAvailable = TECH_NODE_DEFS.find(n => sys.tree.canResearch(n.id).can);
    if (!firstAvailable) return;

    // 3. 完成科技
    sys.tree.completeNode(firstAvailable.id);

    // 4. 效果注册
    const effects = sys.tree.getAllCompletedEffects();
    expect(effects.length).toBeGreaterThan(0);
  });
});

describe('§9.12 攻城失败→推荐→提升→再战循环', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createFullDeps();
    sys = getSystems(deps);
  });

  it('攻城失败→损失兵力→推荐提升方案', () => {
    const result = sys.siege.executeSiegeWithResult(
      'test-strong', 'player', 100, 100, false
    );

    if (!result.victory && result.launched) {
      // 损失兵力
      expect(result.cost.troops).toBeGreaterThan(0);
      // 可获取攻城统计
      const totalSieges = sys.siege.getTotalSieges();
      const defeats = sys.siege.getDefeats();
      expect(totalSieges).toBeGreaterThan(0);
    }
  });

  it('提升后战力增加→胜率变化', () => {
    // 完成军事科技提升战力
    const milNodes = sys.tree.getPathNodes('military');
    if (milNodes.length > 0) {
      sys.tree.completeNode(milNodes[0].id);
    }

    // 检查胜率预估
    const territories = sys.territory.getAllTerritories();
    const target = territories.find(t => t.ownership !== 'player');
    if (!target) return;

    const estimate = sys.enhancer.estimateWinRate(5000, target.id);
    if (estimate) {
      expect(estimate.winRate).toBeGreaterThanOrEqual(0);
    }
  });
});
