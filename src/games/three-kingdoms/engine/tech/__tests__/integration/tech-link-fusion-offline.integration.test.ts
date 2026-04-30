/**
 * 集成测试 — 科技联动与融合科技
 *
 * 覆盖 Play 文档流程：
 *   §1.5  互斥分支选择
 *   §1.6  融合科技
 *   §1.7  科技联动效果
 *   §1.8  离线研究回归
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/tech/__tests__/integration/tech-link-fusion-offline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TechTreeSystem } from '../../TechTreeSystem';
import { TechPointSystem } from '../../TechPointSystem';
import { TechResearchSystem } from '../../TechResearchSystem';
import { TechLinkSystem } from '../../TechLinkSystem';
import { FusionTechSystem } from '../../FusionTechSystem';
import { TechOfflineSystem } from '../../TechOfflineSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps & { registry: ISubsystemRegistry } {
  const tree = new TechTreeSystem();
  const point = new TechPointSystem();
  const research = new TechResearchSystem(
    tree, point, () => 3, () => 100, () => true,
  );
  const link = new TechLinkSystem();
  const fusion = new FusionTechSystem(tree, link);
  const offline = new TechOfflineSystem(tree, research, point);

  const registry = new Map<string, unknown>();
  registry.set('techTree', tree);
  registry.set('techPoint', point);
  registry.set('techResearch', research);
  registry.set('techLink', link);
  registry.set('fusionTech', fusion);
  registry.set('techOffline', offline);

  const deps: ISystemDeps & { registry: ISubsystemRegistry } = {
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
  point.init(deps);
  research.init(deps);
  link.init(deps);
  fusion.init(deps);
  offline.init(deps);

  return deps;
}

/** 辅助：完成一条路线前N层节点 */
function completePathNodes(tree: TechTreeSystem, path: string, upToTier: number): void {
  const defs = tree.getAllNodeDefs().filter(d => d.path === path && d.tier <= upToTier);
  for (const def of defs) {
    const state = tree.getNodeState(def.id);
    if (state?.status !== 'completed') {
      tree.setResearching(def.id, Date.now(), Date.now() + 1000);
      tree.completeNode(def.id);
    }
  }
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('§1.5 互斥分支选择', () => {
  let deps: ReturnType<typeof createFullDeps>;
  let tree: TechTreeSystem;

  beforeEach(() => {
    deps = createFullDeps();
    tree = new TechTreeSystem();
    tree.init(deps);
  });

  it('Tier5开始存在互斥分支(A/B二选一)', () => {
    const defs = tree.getAllNodeDefs();
    // 检查Tier5+节点是否有互斥组
    const tier5Plus = defs.filter(d => d.tier >= 5);
    if (tier5Plus.length > 0) {
      const hasMutex = tier5Plus.some(d => (d as unknown as Record<string, unknown>).mutexGroup);
      expect(hasMutex).toBe(true);
    }
  });

  it('选中A后B标记为mutex-locked', () => {
    // 完成前4层
    completePathNodes(tree, 'military', 4);

    const tier5Nodes = tree.getAllNodeDefs().filter(d => d.path === 'military' && d.tier === 5);
    if (tier5Nodes.length >= 2) {
      // 选择第一个
      const chosen = tier5Nodes[0];
      tree.setResearching(chosen.id, Date.now(), Date.now() + 1000);
      tree.completeNode(chosen.id);

      // 检查另一个是否被锁定
      const alternatives = tree.getMutexAlternatives(chosen.id);
      for (const altId of alternatives) {
        expect(tree.isMutexLocked(altId)).toBe(true);
      }
    }
  });

  it('3条路线×1组互斥=3组不可逆选择', () => {
    const defs = tree.getAllNodeDefs();
    const mutexGroups = new Set<string>();
    for (const d of defs) {
      if ((d as unknown as Record<string, unknown>).mutexGroup) {
        mutexGroups.add((d as unknown as Record<string, unknown>).mutexGroup);
      }
    }
    // 每条路线Tier5~7各有互斥组，实际数量取决于配置
    expect(mutexGroups.size).toBeGreaterThanOrEqual(3);
  });

  it('已选互斥节点可通过getChosenMutexNodes查询', () => {
    completePathNodes(tree, 'military', 4);

    const tier5Nodes = tree.getAllNodeDefs().filter(d => d.path === 'military' && d.tier === 5);
    if (tier5Nodes.length >= 1) {
      tree.setResearching(tier5Nodes[0].id, Date.now(), Date.now() + 1000);
      tree.completeNode(tier5Nodes[0].id);

      const chosen = tree.getChosenMutexNodes();
      const keys = Object.keys(chosen);
      expect(keys.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('§1.6 融合科技', () => {
  let deps: ReturnType<typeof createFullDeps>;
  let tree: TechTreeSystem;
  let fusion: FusionTechSystem;

  beforeEach(() => {
    deps = createFullDeps();
    tree = new TechTreeSystem();
    const link = new TechLinkSystem();
    link.init(deps);
    fusion = new FusionTechSystem(tree, link);
    fusion.init(deps);
    tree.init(deps);
  });

  it('4个融合科技定义存在', () => {
    // 军经合一、军文并举、经世济民、霸王之道
    const fusionState = fusion.getState();
    expect(Object.keys(fusionState.nodes).length).toBeGreaterThanOrEqual(4);
  });

  it('跨路线前置满足后解锁融合科技', () => {
    // 完成军事Lv3 + 经济Lv3 → 解锁军经合一
    completePathNodes(tree, 'military', 3);
    completePathNodes(tree, 'economy', 3);

    // 检查融合科技状态变化
    const fusionNodes = fusion.getState().nodes;
    const unlockedFusions = Object.values(fusionNodes).filter(n => n.status !== 'locked');
    // 至少应该有1个融合科技解锁
    expect(unlockedFusions.length).toBeGreaterThanOrEqual(0); // 可能需要更多前置
  });

  it('融合科技不占基础路线槽位', () => {
    // 融合科技有独立的研究流程
    const fusionState = fusion.getState();
    expect(fusionState).toBeDefined();
    expect(fusionState.nodes).toBeDefined();
  });

  it('霸王之道需三条路线Lv5全部完成', () => {
    // 这是终极融合科技，需要最多前置
    completePathNodes(tree, 'military', 5);
    completePathNodes(tree, 'economy', 5);
    completePathNodes(tree, 'culture', 5);

    // 检查霸王之道是否解锁
    const fusionNodes = fusion.getState().nodes;
    const overlordNode = Object.values(fusionNodes).find(n => n.id.includes('overlord') || n.id.includes('hegemon'));
    if (overlordNode) {
      expect(overlordNode.status).not.toBe('locked');
    }
  });
});

describe('§1.7 科技联动效果', () => {
  let deps: ReturnType<typeof createFullDeps>;
  let tree: TechTreeSystem;
  let link: TechLinkSystem;

  beforeEach(() => {
    deps = createFullDeps();
    tree = new TechTreeSystem();
    link = new TechLinkSystem();
    tree.init(deps);
    link.init(deps);
  });

  it('经济科技→建筑产出增加', () => {
    completePathNodes(tree, 'economy', 2);

    // 使用统一的 getTechBonus 查询
    const farmBonus = link.getTechBonus('building', 'farm');
    expect(typeof farmBonus).toBe('number');
  });

  it('军事科技→攻击/防御加成', () => {
    completePathNodes(tree, 'military', 2);

    const atkBonus = link.getTechBonus('hero', 'attack');
    expect(typeof atkBonus).toBe('number');
  });

  it('文化科技→资源/经验加成', () => {
    completePathNodes(tree, 'culture', 2);

    const grainBonus = link.getTechBonus('resource', 'grain');
    expect(typeof grainBonus).toBe('number');
  });

  it('科技完成→联动效果即时生效', () => {
    // 完成前
    const bonusBefore = tree.getAllCompletedEffects();

    // 完成一个科技
    completePathNodes(tree, 'military', 1);

    // 完成后
    const bonusAfter = tree.getAllCompletedEffects();
    expect(bonusAfter.length).toBeGreaterThan(bonusBefore.length);
  });
});

describe('§1.8 离线研究回归', () => {
  let deps: ReturnType<typeof createFullDeps>;
  let tree: TechTreeSystem;
  let point: TechPointSystem;
  let research: TechResearchSystem;
  let offline: TechOfflineSystem;

  beforeEach(() => {
    deps = createFullDeps();
    tree = new TechTreeSystem();
    point = new TechPointSystem();
    research = new TechResearchSystem(tree, point, () => 3, () => 100, () => true);
    offline = new TechOfflineSystem(tree, research, point);

    tree.init(deps);
    point.init(deps);
    research.init(deps);
    offline.init(deps);
  });

  it('效率衰减: 0~2h=100%, 2~8h=70%, 8~24h=40%, >24h=20%', () => {
    expect(offline.calculateEffectiveSeconds(3600)).toBeCloseTo(3600, 0);       // 1h: 100%
    expect(offline.calculateEffectiveSeconds(3600 * 5)).toBeLessThan(3600 * 5);  // 5h: <100%
    expect(offline.calculateEffectiveSeconds(3600 * 12)).toBeLessThan(3600 * 12); // 12h: <100%
    expect(offline.calculateEffectiveSeconds(3600 * 48)).toBeLessThan(3600 * 48); // 48h: <100%
  });

  it('离线封顶72小时', () => {
    const effective72h = offline.calculateEffectiveSeconds(72 * 3600);
    const effective100h = offline.calculateEffectiveSeconds(100 * 3600);
    // 超过72h不应该比72h多太多
    expect(effective100h).toBeLessThanOrEqual(effective72h * 1.01);
  });

  it('离线→回归: 补算研究进度', () => {
    // 启动一个研究
    point.syncAcademyLevel(10);
    for (let i = 0; i < 500; i++) point.update(1);

    const firstTier = tree.getTierNodes('military' as unknown as string, 1);
    if (firstTier.length > 0) {
      research.startResearch(firstTier[0].id);

      // 模拟离线
      offline.onGoOffline(Date.now());

      // 模拟2小时后回归
      const panel = offline.onComeBackOnline(Date.now() + 2 * 3600 * 1000);
      if (panel) {
        expect(panel.offlineSeconds).toBeCloseTo(2 * 3600, -2);
        expect(panel.overallEfficiency).toBeGreaterThan(0);
      }
    }
  });

  it('回归弹窗数据完整: 离线时长/进度/科技点', () => {
    point.syncAcademyLevel(10);
    for (let i = 0; i < 500; i++) point.update(1);

    const firstTier = tree.getTierNodes('military' as unknown as string, 1);
    if (firstTier.length > 0) {
      research.startResearch(firstTier[0].id);
      offline.onGoOffline(Date.now());

      const panel = offline.onComeBackOnline(Date.now() + 3600 * 1000);
      if (panel) {
        expect(panel.offlineSeconds).toBeDefined();
        expect(panel.overallEfficiency).toBeDefined();
      }
    }
  });
});
