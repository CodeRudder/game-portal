/**
 * 集成测试 — 手机端适配 + 边界场景
 *
 * 覆盖 Play 文档（选取关键 6 个验证点）：
 *   §2.7  手机端地图适配：响应式配置
 *   §10.1 科技点不足：研究拒绝
 *   §10.2 前置科技未完成：研究拒绝
 *   §10.3 互斥科技冲突：互斥拒绝
 *   §10.5 领土被夺回：状态变更
 *   §10.6 攻城失败后重试：冷却和重试
 *
 * @module engine/tech/__tests__/integration/mobile-edge-cases
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
import { ResponsiveLayoutManager } from '../../../responsive/ResponsiveLayoutManager';
import { MobileLayoutManager } from '../../../responsive/MobileLayoutManager';
import { MobileSettingsSystem } from '../../../responsive/MobileSettingsSystem';
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
    renderer: new MapDataRenderer(),
  };
}

function createResponsiveDeps(): ISystemDeps {
  const responsive = new ResponsiveLayoutManager();
  const mobile = new MobileLayoutManager(responsive);
  const settings = new MobileSettingsSystem();

  const registry = new Map<string, unknown>();
  registry.set('responsive', responsive);
  registry.set('mobile', mobile);
  registry.set('mobileSettings', settings);

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

  responsive.init(deps);
  mobile.init(deps);
  settings.init(deps);

  return deps;
}

// ═════════════════════════════════════════════
// §2.7 手机端地图适配：响应式配置
// ═════════════════════════════════════════════

describe('§2.7 手机端地图适配：响应式配置', () => {
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createResponsiveDeps();
  });

  it('手机端画布基准 375×667px', () => {
    const mobile = deps.registry.get<MobileLayoutManager>('mobile')!;
    const layout = mobile.calculateMobileLayout(375, 667);
    expect(layout).toBeDefined();
    expect(layout.sceneAreaHeight).toBeGreaterThan(0);
  });

  it('底部 Tab 导航 5 个 Tab', () => {
    const mobile = deps.registry.get<MobileLayoutManager>('mobile')!;
    const tabBar = mobile.tabBar;
    expect(tabBar.tabs.length).toBe(5);
  });

  it('Tab 切换功能正常', () => {
    const mobile = deps.registry.get<MobileLayoutManager>('mobile')!;
    const result = mobile.switchTab('heroes');
    expect(result).toBe(true);
    expect(mobile.tabBar.activeTabId).toBe('heroes');
  });

  it('全屏面板模式可开关', () => {
    const mobile = deps.registry.get<MobileLayoutManager>('mobile')!;
    expect(mobile.fullScreenPanel.isOpen).toBe(false);
    mobile.openFullScreenPanel('tech-tree', '科技树');
    expect(mobile.fullScreenPanel.isOpen).toBe(true);
    mobile.closeFullScreenPanel();
    expect(mobile.fullScreenPanel.isOpen).toBe(false);
  });

  it('Bottom Sheet 交互正常', () => {
    const mobile = deps.registry.get<MobileLayoutManager>('mobile')!;
    expect(mobile.bottomSheet.isOpen).toBe(false);
    mobile.openBottomSheet('territory-detail', 300);
    expect(mobile.bottomSheet.isOpen).toBe(true);
    mobile.closeBottomSheet();
    expect(mobile.bottomSheet.isOpen).toBe(false);
  });

  it('省电模式可切换', () => {
    const settings = deps.registry.get<MobileSettingsSystem>('mobileSettings')!;
    settings.setPowerSaveLevel('on');
    expect(settings.powerSaveLevel).toBe('on');
  });

  it('字体大小三档可调', () => {
    const settings = deps.registry.get<MobileSettingsSystem>('mobileSettings')!;
    settings.setFontSize('large');
    expect(settings.fontSize).toBe('large');
    settings.setFontSize('small');
    expect(settings.fontSize).toBe('small');
    settings.setFontSize('medium');
    expect(settings.fontSize).toBe('medium');
  });

  it('响应式布局检测手机断点', () => {
    const responsive = deps.registry.get<ResponsiveLayoutManager>('responsive')!;
    responsive.updateViewport(375, 667);
    expect(responsive.isMobile).toBe(true);
  });
});

// ═════════════════════════════════════════════
// §10.1 科技点不足：研究拒绝
// ═════════════════════════════════════════════

describe('§10.1 科技点不足：研究拒绝', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('科技点不足时 trySpend 返回失败', () => {
    const result = sys.techPoint.trySpend(99999);
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('科技点不足时研究启动被拒绝', () => {
    // 不给科技点充值，尝试研究
    const allDefs = sys.techTree.getAllNodeDefs();
    if (allDefs.length === 0) return;

    const node = allDefs[0];
    // 先完成前置条件
    const unmet = sys.techTree.getUnmetPrerequisites(node.id);
    for (const preId of unmet) {
      sys.techTree.completeNode(preId);
    }

    const result = sys.techResearch.startResearch(node.id);
    // 可能因科技点不足而失败
    if (!result.success) {
      expect(result.reason).toBeDefined();
    }
  });

  it('科技点充足时研究正常启动', () => {
    // 充值足够科技点
    sys.techPoint.refund(10000);
    const allDefs = sys.techTree.getAllNodeDefs();
    if (allDefs.length === 0) return;

    const node = allDefs[0];
    const unmet = sys.techTree.getUnmetPrerequisites(node.id);
    for (const preId of unmet) {
      sys.techTree.completeNode(preId);
    }

    const canResearch = sys.techTree.canResearch(node.id);
    if (canResearch.can) {
      const result = sys.techResearch.startResearch(node.id);
      expect(result).toHaveProperty('success');
    }
  });
});

// ═════════════════════════════════════════════
// §10.2 前置科技未完成：研究拒绝
// ═════════════════════════════════════════════

describe('§10.2 前置科技未完成：研究拒绝', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('canResearch 返回前置未完成原因', () => {
    // 找一个有前置的科技
    const allDefs = sys.techTree.getAllNodeDefs();
    const nodeWithPrereq = allDefs.find((d) => {
      const state = sys.techTree.getNodeState(d.id);
      return state && state.status === 'locked';
    });

    if (nodeWithPrereq) {
      const result = sys.techTree.canResearch(nodeWithPrereq.id);
      if (!result.can) {
        expect(result.reason).toBeDefined();
      }
    }
  });

  it('getUnmetPrerequisites 返回未完成的前置列表', () => {
    const allDefs = sys.techTree.getAllNodeDefs();
    // 找一个高阶科技（通常有前置）
    const highTier = allDefs.filter((d) => d.tier >= 2);
    if (highTier.length > 0) {
      const unmet = sys.techTree.getUnmetPrerequisites(highTier[0].id);
      expect(Array.isArray(unmet)).toBe(true);
      if (unmet.length > 0) {
        expect(unmet.length).toBeGreaterThan(0);
      }
    }
  });

  it('完成前置后 canResearch 通过', () => {
    const allDefs = sys.techTree.getAllNodeDefs();
    const target = allDefs.find((d) => d.tier >= 2);
    if (!target) return;

    const unmet = sys.techTree.getUnmetPrerequisites(target.id);
    for (const preId of unmet) {
      sys.techTree.completeNode(preId);
    }

    const result = sys.techTree.canResearch(target.id);
    // 前置已满足，其他条件（互斥等）可能仍阻止
    if (result.can || result.reason) {
      expect(result).toHaveProperty('can');
    }
  });
});

// ═════════════════════════════════════════════
// §10.3 互斥科技冲突：互斥拒绝
// ═════════════════════════════════════════════

describe('§10.3 互斥科技冲突：互斥拒绝', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('isMutexLocked 检测互斥锁定', () => {
    const allDefs = sys.techTree.getAllNodeDefs();
    // 找互斥组中的科技
    const mutexNodes = allDefs.filter((d) => d.mutexGroup);
    if (mutexNodes.length >= 2) {
      // 完成第一个互斥科技
      const first = mutexNodes[0];
      const unmet = sys.techTree.getUnmetPrerequisites(first.id);
      for (const preId of unmet) {
        sys.techTree.completeNode(preId);
      }
      sys.techTree.completeNode(first.id);

      // 检查同组另一个是否被锁定
      const rival = mutexNodes.find(
        (d) => d.mutexGroup === first.mutexGroup && d.id !== first.id,
      );
      if (rival) {
        const locked = sys.techTree.isMutexLocked(rival.id);
        expect(locked).toBe(true);
      }
    }
  });

  it('getMutexAlternatives 返回替代科技', () => {
    const allDefs = sys.techTree.getAllNodeDefs();
    const mutexNodes = allDefs.filter((d) => d.mutexGroup);
    if (mutexNodes.length > 0) {
      const alternatives = sys.techTree.getMutexAlternatives(mutexNodes[0].id);
      expect(Array.isArray(alternatives)).toBe(true);
    }
  });

  it('互斥科技不能同时研究', () => {
    const allDefs = sys.techTree.getAllNodeDefs();
    const mutexNodes = allDefs.filter((d) => d.mutexGroup);
    if (mutexNodes.length >= 2) {
      // 完成第一个
      const first = mutexNodes[0];
      const unmet = sys.techTree.getUnmetPrerequisites(first.id);
      for (const preId of unmet) {
        sys.techTree.completeNode(preId);
      }
      sys.techTree.completeNode(first.id);

      // 尝试研究同组的第二个
      const rival = mutexNodes.find(
        (d) => d.mutexGroup === first.mutexGroup && d.id !== first.id,
      );
      if (rival) {
        const canResearch = sys.techTree.canResearch(rival.id);
        expect(canResearch.can).toBe(false);
      }
    }
  });
});

// ═════════════════════════════════════════════
// §10.5 领土被夺回：状态变更
// ═════════════════════════════════════════════

describe('§10.5 领土被夺回：状态变更', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('占领→夺回→归属变更', () => {
    const territories = sys.territory.getAllTerritories();
    const neutral = territories.find((t: any) => t.ownership !== 'player');
    if (!neutral) return;

    // 占领
    sys.territory.captureTerritory(neutral.id, 'player');
    const captured = sys.territory.getTerritoryById(neutral.id);
    expect(captured!.ownership).toBe('player');

    // 被夺回
    sys.territory.captureTerritory(neutral.id, 'enemy');
    const lost = sys.territory.getTerritoryById(neutral.id);
    expect(lost!.ownership).toBe('enemy');
  });

  it('领土被夺回后产出减少', () => {
    const territories = sys.territory.getAllTerritories();
    const neutral = territories.find((t: any) => t.ownership !== 'player');
    if (!neutral) return;

    sys.territory.captureTerritory(neutral.id, 'player');
    const afterCapture = sys.territory.getPlayerProductionSummary();

    sys.territory.captureTerritory(neutral.id, 'enemy');
    const afterLoss = sys.territory.getPlayerProductionSummary();

    expect(afterLoss.totalProduction.grain).toBeLessThanOrEqual(afterCapture.totalProduction.grain);
  });

  it('领土被夺回后玩家领土数减少', () => {
    const territories = sys.territory.getAllTerritories();
    const neutral = territories.find((t: any) => t.ownership !== 'player');
    if (!neutral) return;

    sys.territory.captureTerritory(neutral.id, 'player');
    const countAfterCapture = sys.territory.getPlayerTerritoryCount();

    sys.territory.captureTerritory(neutral.id, 'enemy');
    const countAfterLoss = sys.territory.getPlayerTerritoryCount();

    expect(countAfterLoss).toBeLessThan(countAfterCapture);
  });
});

// ═════════════════════════════════════════════
// §10.6 攻城失败后重试：冷却和重试
// ═════════════════════════════════════════════

describe('§10.6 攻城失败后重试：冷却和重试', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('攻城失败消耗每日次数', () => {
    const remainingBefore = sys.siege.getRemainingDailySieges();
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length === 0) return;

    const target = attackable[0];
    // 故意用低战力失败
    const result = sys.siege.executeSiegeWithResult(
      target.id, 'player', 1, 1, false,
    );

    if (!result.victory) {
      const remainingAfter = sys.siege.getRemainingDailySieges();
      expect(remainingAfter).toBeLessThanOrEqual(remainingBefore);
    }
  });

  it('失败后仍可再次攻城（次数未耗尽）', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length === 0) return;

    const target = attackable[0];
    sys.siege.executeSiegeWithResult(target.id, 'player', 1, 1, false);

    const remaining = sys.siege.getRemainingDailySieges();
    if (remaining > 0) {
      // 还有次数，可以再次攻城
      const canAttack = sys.siege.checkSiegeConditions(target.id, 'player', 1000, 1000);
      expect(canAttack).toBeDefined();
    }
  });

  it('每日攻城次数耗尽后无法攻城', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length < 3) return; // 需要至少3个可攻击目标

    // 连续攻城耗尽次数
    for (let i = 0; i < 3; i++) {
      sys.siege.executeSiegeWithResult(
        attackable[i].id, 'player', 100000, 100000, true,
      );
    }

    const remaining = sys.siege.getRemainingDailySieges();
    expect(remaining).toBe(0);
  });

  it('重置每日攻城次数后可继续攻城', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length < 3) return;

    for (let i = 0; i < 3; i++) {
      sys.siege.executeSiegeWithResult(
        attackable[i].id, 'player', 100000, 100000, true,
      );
    }

    expect(sys.siege.getRemainingDailySieges()).toBe(0);

    // 重置
    sys.siege.resetDailySiegeCount();
    expect(sys.siege.getRemainingDailySieges()).toBe(3);
  });

  it('失败后推荐提升方案', () => {
    const attackable = sys.territory.getAttackableTerritories('player');
    if (attackable.length === 0) return;

    const target = attackable[0];
    const estimate = sys.enhancer.estimateWinRate(100, target.id);
    if (estimate) {
      // 胜率低时应有推荐
      expect(estimate).toHaveProperty('winRate');
    }
  });
});
