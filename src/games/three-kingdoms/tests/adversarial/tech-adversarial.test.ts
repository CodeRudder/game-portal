/**
 * 科技模块对抗式测试 — Builder 产出
 *
 * 覆盖子系统：
 *   T1: BuildingSystem           — 建筑升级作为科技研究
 *   T2: TechTreeSystem           — 科技树节点管理/前置依赖/互斥分支
 *   T3: TechResearchSystem       — 研究流程（开始/完成/取消/加速）
 *   T4: TechPointSystem          — 科技点产出/消耗/兑换
 *   T5: 跨系统联动               — 建筑→资源→科技点→研究
 *
 * 5维度挑战：
 *   F-Error:     异常路径（锁定/满级/队列满/资源不足/NaN/无效类型/不存在节点）
 *   F-Cross:     跨系统交互（升级→资源消耗/产出联动/离线完成/研究→效果→产出）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化/重置/离线升级完成）
 *   F-Boundary:  边界条件（主城前置/队列槽位/取消返还/满级/互斥/前置依赖链）
 *   F-Normal:    正向流程（升级完整流程/成本计算/前置依赖链/产出关联/研究加速）
 *
 * @module tests/adversarial/tech-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildingSystem } from '../../engine/building/BuildingSystem';
import { TechTreeSystem } from '../../engine/tech/TechTreeSystem';
import { TechResearchSystem } from '../../engine/tech/TechResearchSystem';
import { TechPointSystem } from '../../engine/tech/TechPointSystem';
import type { BuildingType } from '../../engine/building/building.types';
import { BUILDING_TYPES } from '../../engine/building/building.types';
import {
  BUILDING_DEFS, BUILDING_MAX_LEVELS,
  BUILDING_SAVE_VERSION, CANCEL_REFUND_RATIO,
} from '../../engine/building/building-config';
import type { Resources } from '../../engine/resource/resource.types';
import { ResourceSystem } from '../../engine/resource/ResourceSystem';
import { RESOURCE_TYPES } from '../../engine/resource/resource.types';

// ── 测试辅助 ──────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn().mockReturnValue(vi.fn()), off: vi.fn(), once: vi.fn().mockReturnValue(vi.fn()), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  };
}

function createBuilding() { const s = new BuildingSystem(); s.init(createMockDeps() as any); return s; }
function createResource() { const s = new ResourceSystem(); s.init(createMockDeps() as any); return s; }
function richRes(): Resources {
  return { grain: 9999999, gold: 9999999, troops: 9999999, mandate: 99999, techPoint: 99999, recruitToken: 99999, skillBook: 99999 };
}
function fillRes(rs: ResourceSystem) {
  rs.setCap('grain', null); rs.setCap('troops', null);
  for (const t of RESOURCE_TYPES) rs.setResource(t, 9999999);
}
function upgradeTo(sys: BuildingSystem, type: BuildingType, target: number, res?: Resources) {
  const r = res ?? richRes();
  while (sys.getLevel(type) < target) { if (!sys.checkUpgrade(type, r).canUpgrade) break; sys.startUpgrade(type, r); sys.forceCompleteUpgrades(); }
}
function createTechSuite(lv = 1) {
  const tree = new TechTreeSystem(); tree.init(createMockDeps() as any);
  const pts = new TechPointSystem(); pts.init(createMockDeps() as any); pts.syncAcademyLevel(lv);
  const research = new TechResearchSystem(tree, pts, () => lv, () => 1000, () => true);
  research.init(createMockDeps() as any);
  return { tree, pts, research };
}
function fillPts(pts: TechPointSystem, amt = 99999) { const d = amt - pts.getState().current; if (d > 0) pts.refund(d); }

// ═══════════════════════════════════════════════
// F-Error: 异常路径覆盖
// ═══════════════════════════════════════════════

describe('F-Error: 建筑升级异常路径', () => {
  let sys: BuildingSystem; let res: Resources;
  beforeEach(() => { sys = createBuilding(); res = richRes(); });

  it('锁定建筑不能升级', () => expect(sys.checkUpgrade('market', res).canUpgrade).toBe(false));
  it('升级中建筑不能再次升级', () => { sys.startUpgrade('farmland', res); expect(sys.checkUpgrade('farmland', res).reasons).toContain('建筑正在升级中'); });
  it('资源不足不能升级', () => {
    const p: Resources = { grain: 1, gold: 1, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
    expect(sys.checkUpgrade('castle', p).canUpgrade).toBe(false);
  });
  it('NaN资源判定异常', () => {
    const r: Resources = { grain: NaN, gold: NaN, troops: NaN, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
    expect(sys.checkUpgrade('farmland', r).reasons.some(x => x.includes('异常'))).toBe(true);
  });
  it('Infinity资源判定异常', () => {
    const r: Resources = { grain: Infinity, gold: Infinity, troops: Infinity, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
    expect(sys.checkUpgrade('farmland', r).canUpgrade).toBe(false);
  });
  it('startUpgrade资源不足抛错', () => {
    const p: Resources = { grain: 1, gold: 1, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
    expect(() => sys.startUpgrade('castle', p)).toThrow();
  });
  it('getUpgradeCost满级返回null', () => {
    const d = sys.serialize(); d.buildings.farmland.level = BUILDING_MAX_LEVELS.farmland;
    const s2 = createBuilding(); s2.deserialize(d); expect(s2.getUpgradeCost('farmland')).toBeNull();
  });
  it('getUpgradeCost等级0返回null', () => expect(sys.getUpgradeCost('market')).toBeNull());
  it('非升级状态取消返回null', () => expect(sys.cancelUpgrade('farmland')).toBeNull());
  it('队列满时不能升级', () => { sys.startUpgrade('farmland', res); expect(sys.checkUpgrade('castle', res).reasons).toContain('升级队列已满'); });
});

describe('F-Error: 科技研究异常路径', () => {
  let tree: TechTreeSystem; let pts: TechPointSystem; let research: TechResearchSystem;
  beforeEach(() => { ({ tree, pts, research } = createTechSuite(1)); fillPts(pts); });

  it('不存在节点应失败', () => expect(research.startResearch('nonexistent').success).toBe(false));
  it('空字符串ID应失败', () => expect(research.startResearch('').success).toBe(false));
  it('已完成科技不能重复研究', () => {
    research.startResearch('mil_t1_attack'); tree.completeNode('mil_t1_attack');
    expect(research.startResearch('mil_t1_attack').reason).toContain('已完成');
  });
  it('科技点不足不能研究', () => {
    const { research: r2 } = createTechSuite(1);
    expect(r2.startResearch('mil_t1_attack').reason).toContain('不足');
  });
  it('队列已满不能研究', () => {
    research.startResearch('mil_t1_attack');
    expect(research.startResearch('eco_t1_farming').reason).toContain('队列已满');
  });
  it('取消不存在研究应失败', () => expect(research.cancelResearch('nonexistent').success).toBe(false));
  it('加速不存在研究应失败', () => expect(research.speedUp('nonexistent', 'mandate', 10).success).toBe(false));
  it('加速无效数量应失败', () => {
    research.startResearch('mil_t1_attack');
    expect(research.speedUp('mil_t1_attack', 'mandate', 0).success).toBe(false);
    expect(research.speedUp('mil_t1_attack', 'mandate', NaN).success).toBe(false);
  });
});

describe('F-Error: 科技树异常路径', () => {
  let tree: TechTreeSystem;
  beforeEach(() => { tree = new TechTreeSystem(); tree.init(createMockDeps() as any); });

  it('getNodeDef不存在返回undefined', () => expect(tree.getNodeDef('nonexistent')).toBeUndefined());
  it('canResearch不存在返回失败', () => expect(tree.canResearch('nonexistent').can).toBe(false));
  it('arePrerequisitesMet不存在返回false', () => expect(tree.arePrerequisitesMet('nonexistent')).toBe(false));
  it('completeNode不存在安全忽略', () => expect(() => tree.completeNode('nonexistent')).not.toThrow());
  it('cancelResearch非研究中安全忽略', () => expect(() => tree.cancelResearch('mil_t1_attack')).not.toThrow());
  it('setResearching NaN时间忽略', () => {
    const before = tree.getNodeState('mil_t1_attack')!.status;
    tree.setResearching('mil_t1_attack', NaN, Date.now());
    expect(tree.getNodeState('mil_t1_attack')!.status).toBe(before);
  });
});

describe('F-Error: 科技点异常路径', () => {
  let pts: TechPointSystem;
  beforeEach(() => { pts = new TechPointSystem(); pts.init(createMockDeps() as any); });

  it('canAfford NaN返回false', () => expect(pts.canAfford(NaN)).toBe(false));
  it('spend NaN安全忽略', () => { pts.refund(100); const b = pts.getCurrentPoints(); pts.spend(NaN); expect(pts.getCurrentPoints()).toBe(b); });
  it('refund NaN安全忽略', () => { const b = pts.getCurrentPoints(); pts.refund(NaN); expect(pts.getCurrentPoints()).toBe(b); });
  it('syncAcademyLevel NaN忽略', () => { pts.syncAcademyLevel(NaN); expect(pts.getProductionRate()).toBe(0); });
  it('update NaN dt忽略', () => { pts.syncAcademyLevel(10); const b = pts.getCurrentPoints(); pts.update(NaN); expect(pts.getCurrentPoints()).toBe(b); });
  it('兑换等级不足应失败', () => expect(pts.exchangeGoldForTechPoints(1000, 3).success).toBe(false));
  it('兑换NaN应失败', () => expect(pts.exchangeGoldForTechPoints(NaN, 10).success).toBe(false));
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互覆盖
// ═══════════════════════════════════════════════

describe('F-Cross: 建筑升级→资源消耗联动', () => {
  let bld: BuildingSystem; let res: ResourceSystem;
  beforeEach(() => { bld = createBuilding(); res = createResource(); });

  it('startUpgrade返回费用与getUpgradeCost一致', () => {
    fillRes(res); const c = bld.getUpgradeCost('farmland')!;
    const r = bld.startUpgrade('farmland', res.getResources());
    expect(r.grain).toBe(c.grain);
  });
  it('升级农田后产出增加', () => expect(bld.getProduction('farmland', 2)).toBeGreaterThan(bld.getProduction('farmland', 1)));
  it('calculateTotalProduction反映等级', () => {
    const t1 = bld.calculateTotalProduction(); upgradeTo(bld, 'farmland', 5);
    expect(bld.calculateTotalProduction().grain).toBeGreaterThan(t1.grain ?? 0);
  });
  it('calculateTotalProduction不含主城', () => expect(bld.calculateTotalProduction()['castle']).toBeUndefined());
  it('资源系统接收建筑产出', () => {
    upgradeTo(bld, 'farmland', 5); res.recalculateProduction(bld.calculateTotalProduction());
    expect(res.getProductionRates().grain).toBeGreaterThan(0);
  });
});

describe('F-Cross: 离线升级完成', () => {
  it('deserialize自动完成已到期升级', () => {
    const s = createBuilding(); s.startUpgrade('farmland', richRes());
    const d = s.serialize(); d.buildings.farmland.upgradeEndTime = Date.now() - 1000;
    const s2 = createBuilding(); s2.deserialize(d);
    expect(s2.getLevel('farmland')).toBe(2);
  });
  it('deserialize保留未到期升级', () => {
    const s = createBuilding(); s.startUpgrade('farmland', richRes());
    const d = s.serialize(); d.buildings.farmland.upgradeEndTime = Date.now() + 60000;
    const s2 = createBuilding(); s2.deserialize(d);
    expect(s2.getUpgradeQueue()).toHaveLength(1);
  });
});

describe('F-Cross: 研究→科技树→效果联动', () => {
  let tree: TechTreeSystem; let pts: TechPointSystem; let research: TechResearchSystem;
  beforeEach(() => { ({ tree, pts, research } = createTechSuite(10)); fillPts(pts); });

  it('完成研究后节点completed', () => {
    research.startResearch('mil_t1_attack'); tree.completeNode('mil_t1_attack');
    expect(tree.getNodeState('mil_t1_attack')!.status).toBe('completed');
  });
  it('完成研究后效果可查询', () => {
    tree.completeNode('mil_t1_attack');
    expect(tree.getAllCompletedEffects().some(e => e.type === 'troop_attack')).toBe(true);
  });
  it('经济科技资源产出加成生效', () => {
    tree.completeNode('eco_t1_farming');
    expect(tree.getEffectValue('resource_production', 'grain')).toBe(15);
  });
  it('取消研究后科技点返还', () => {
    const b = pts.getCurrentPoints(); research.startResearch('mil_t1_attack');
    research.cancelResearch('mil_t1_attack');
    expect(pts.getCurrentPoints()).toBeGreaterThan(b - 1);
  });
  it('取消研究后节点恢复available', () => {
    research.startResearch('mil_t1_attack'); research.cancelResearch('mil_t1_attack');
    expect(tree.getNodeState('mil_t1_attack')!.status).toBe('available');
  });
});

describe('F-Cross: 书院等级→科技点→研究队列', () => {
  it('书院等级影响产出速率', () => {
    const p1 = new TechPointSystem(); p1.init(createMockDeps() as any); p1.syncAcademyLevel(1);
    const p2 = new TechPointSystem(); p2.init(createMockDeps() as any); p2.syncAcademyLevel(10);
    expect(p2.getProductionRate()).toBeGreaterThan(p1.getProductionRate());
  });
  it('书院等级影响队列大小', () => {
    expect(createTechSuite(1).research.getMaxQueueSize()).toBe(1);
    expect(createTechSuite(5).research.getMaxQueueSize()).toBe(2);
    expect(createTechSuite(10).research.getMaxQueueSize()).toBe(3);
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期覆盖
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 建筑序列化/反序列化', () => {
  it('空系统一致', () => {
    const s = createBuilding(); const d = s.serialize(); const s2 = createBuilding(); s2.deserialize(d);
    for (const t of BUILDING_TYPES) expect(s2.getLevel(t)).toBe(s.getLevel(t));
  });
  it('升级后状态保留', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 2); upgradeTo(s, 'farmland', 3);
    const d = s.serialize(); const s2 = createBuilding(); s2.deserialize(d);
    expect(s2.getLevel('castle')).toBe(2); expect(s2.getLevel('farmland')).toBe(3);
  });
  it('null数据安全重置', () => {
    const s = createBuilding(); upgradeTo(s, 'farmland', 5); s.deserialize(null as any);
    expect(s.getLevel('farmland')).toBe(1);
  });
  it('版本不匹配仍加载', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 2); const d = s.serialize(); d.version = 999;
    const s2 = createBuilding(); s2.deserialize(d); expect(s2.getLevel('castle')).toBe(2);
  });
});

describe('F-Lifecycle: 科技树序列化/反序列化', () => {
  it('完成后状态保留', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any); t.completeNode('mil_t1_attack');
    const d = t.serialize(); const t2 = new TechTreeSystem(); t2.init(createMockDeps() as any);
    t2.deserialize(d); expect(t2.getNodeState('mil_t1_attack')!.status).toBe('completed');
  });
  it('互斥选择保留', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any); t.completeNode('mil_t1_attack');
    const d = t.serialize(); const t2 = new TechTreeSystem(); t2.init(createMockDeps() as any);
    t2.deserialize(d); expect(t2.getChosenMutexNodes()['mil_t1']).toBe('mil_t1_attack');
  });
});

describe('F-Lifecycle: 研究系统序列化/反序列化', () => {
  it('空队列一致', () => {
    const { research } = createTechSuite(1); const d = research.serialize();
    expect(d.activeResearch).toBeNull();
    const { research: r2 } = createTechSuite(1); r2.deserialize(d);
    expect(r2.getQueue()).toEqual([]);
  });
  it('研究中队列保留', () => {
    const { pts, research } = createTechSuite(10); fillPts(pts);
    research.startResearch('mil_t1_attack'); const d = research.serialize();
    const { research: r2 } = createTechSuite(10); r2.deserialize(d);
    expect(r2.getQueue()[0].techId).toBe('mil_t1_attack');
  });
  it('旧存档兼容（只有activeResearch）', () => {
    const { research: r2 } = createTechSuite(10);
    r2.deserialize({ activeResearch: { techId: 'mil_t1_attack', startTime: Date.now(), endTime: Date.now() + 120000 } });
    expect(r2.getQueue()).toHaveLength(1);
  });
});

describe('F-Lifecycle: 科技点序列化/反序列化', () => {
  it('有数据完整保留', () => {
    const p = new TechPointSystem(); p.init(createMockDeps() as any);
    p.syncAcademyLevel(10); p.update(100); const d = p.serialize();
    const p2 = new TechPointSystem(); p2.init(createMockDeps() as any); p2.deserialize(d);
    expect(p2.getCurrentPoints()).toBeCloseTo(p.getCurrentPoints(), 1);
  });
});

describe('F-Lifecycle: 系统重置', () => {
  it('BuildingSystem.reset', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 3); s.reset();
    expect(s.getLevel('farmland')).toBe(1); expect(s.getLevel('market')).toBe(0);
  });
  it('TechTreeSystem.reset', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    t.completeNode('mil_t1_attack'); t.reset();
    expect(t.getNodeState('mil_t1_attack')!.status).toBe('available');
  });
  it('TechPointSystem.reset', () => {
    const p = new TechPointSystem(); p.init(createMockDeps() as any);
    p.refund(500); p.reset(); expect(p.getCurrentPoints()).toBe(0);
  });
  it('TechResearchSystem.reset', () => {
    const { pts, research } = createTechSuite(10); fillPts(pts);
    research.startResearch('mil_t1_attack'); research.reset();
    expect(research.getQueue()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件覆盖
// ═══════════════════════════════════════════════

describe('F-Boundary: 主城前置条件', () => {
  let sys: BuildingSystem; let res: Resources;
  beforeEach(() => { sys = createBuilding(); res = richRes(); });

  it('主城Lv4→5需任一建筑Lv4', () => {
    upgradeTo(sys, 'castle', 4); upgradeTo(sys, 'farmland', 4);
    expect(sys.checkUpgrade('castle', res).canUpgrade).toBe(true);
  });
  it('不满足前置时主城Lv5不能升级', () => {
    upgradeTo(sys, 'castle', 4);
    expect(sys.checkUpgrade('castle', res).reasons.some(r => r.includes('Lv4'))).toBe(true);
  });
  it('子建筑等级不能超过主城等级', () => {
    upgradeTo(sys, 'castle', 2); upgradeTo(sys, 'farmland', 3);
    expect(sys.checkUpgrade('farmland', res).canUpgrade).toBe(false);
  });
});

describe('F-Boundary: 满级与队列', () => {
  it('满级后不能升级', () => {
    const s = createBuilding(); const d = s.serialize();
    d.buildings.farmland.level = BUILDING_MAX_LEVELS.farmland;
    const s2 = createBuilding(); s2.deserialize(d);
    expect(s2.checkUpgrade('farmland', richRes()).canUpgrade).toBe(false);
  });
  it('各建筑最大等级与配置一致', () => {
    for (const t of BUILDING_TYPES) expect(BUILDING_DEFS[t].maxLevel).toBe(BUILDING_MAX_LEVELS[t]);
  });
  it('队列槽位随主城等级增长', () => {
    expect(createBuilding().getMaxQueueSlots()).toBe(1);
    const s = createBuilding(); const d = s.serialize();
    d.buildings.castle.level = 6; d.buildings.castle.status = 'idle';
    const s2 = createBuilding(); s2.deserialize(d);
    expect(s2.getMaxQueueSlots()).toBe(2);
  });
});

describe('F-Boundary: 取消升级返还', () => {
  it('取消返还80%资源', () => {
    const s = createBuilding(); const c = s.getUpgradeCost('farmland')!;
    s.startUpgrade('farmland', richRes()); const r = s.cancelUpgrade('farmland')!;
    expect(r.grain).toBe(Math.round(c.grain * CANCEL_REFUND_RATIO));
  });
  it('取消后恢复idle并清空队列', () => {
    const s = createBuilding(); s.startUpgrade('farmland', richRes());
    s.cancelUpgrade('farmland');
    expect(s.getBuilding('farmland').status).toBe('idle');
    expect(s.getUpgradeQueue()).toHaveLength(0);
  });
});

describe('F-Boundary: 建筑解锁条件', () => {
  it('初始解锁castle/farmland', () => {
    const s = createBuilding();
    expect(s.isUnlocked('castle')).toBe(true); expect(s.isUnlocked('farmland')).toBe(true);
  });
  it('主城Lv2解锁market/barracks', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 2);
    expect(s.isUnlocked('market')).toBe(true); expect(s.isUnlocked('barracks')).toBe(true);
  });
  it('主城Lv3解锁smithy/academy', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 3);
    expect(s.isUnlocked('smithy')).toBe(true); expect(s.isUnlocked('academy')).toBe(true);
  });
  it('主城Lv4解锁clinic', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 4);
    expect(s.isUnlocked('clinic')).toBe(true);
  });
  it('主城Lv5解锁wall', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 4);
    upgradeTo(s, 'farmland', 4); upgradeTo(s, 'castle', 5);
    expect(s.isUnlocked('wall')).toBe(true);
  });
});

describe('F-Boundary: 科技树互斥分支', () => {
  let tree: TechTreeSystem; let pts: TechPointSystem; let research: TechResearchSystem;
  beforeEach(() => { ({ tree, pts, research } = createTechSuite(10)); fillPts(pts); });

  it('同组互斥只能选一个', () => {
    tree.completeNode('mil_t1_attack');
    expect(research.startResearch('mil_t1_defense').reason).toContain('互斥');
  });
  it('互斥锁定后节点locked', () => {
    tree.completeNode('mil_t1_attack');
    expect(tree.getNodeState('mil_t1_defense')!.status).toBe('locked');
  });
  it('isMutexLocked正确判断', () => {
    tree.completeNode('mil_t1_attack');
    expect(tree.isMutexLocked('mil_t1_attack')).toBe(false);
    expect(tree.isMutexLocked('mil_t1_defense')).toBe(true);
  });
  it('getMutexAlternatives返回同组其他', () => expect(tree.getMutexAlternatives('mil_t1_attack')).toContain('mil_t1_defense'));
  it('无互斥组节点isMutexLocked返回false', () => expect(tree.isMutexLocked('mil_t2_charge')).toBe(false));
});

describe('F-Boundary: 前置依赖链', () => {
  let tree: TechTreeSystem; let pts: TechPointSystem; let research: TechResearchSystem;
  beforeEach(() => { ({ tree, pts, research } = createTechSuite(10)); fillPts(pts); });

  it('Tier2需Tier1前置完成', () => expect(research.startResearch('mil_t2_charge').reason).toContain('前置'));
  it('完成前置后可研究后续', () => {
    tree.completeNode('mil_t1_attack'); fillPts(pts);
    expect(research.startResearch('mil_t2_charge').success).toBe(true);
  });
  it('getUnmetPrerequisites返回未完成前置', () => expect(tree.getUnmetPrerequisites('mil_t2_charge')).toContain('mil_t1_attack'));
  it('前置完成后getUnmetPrerequisites为空', () => {
    tree.completeNode('mil_t1_attack');
    expect(tree.getUnmetPrerequisites('mil_t2_charge')).toEqual([]);
  });
  it('完整依赖链 mil_t1→t2→t3→t4', () => {
    const chain = ['mil_t1_attack', 'mil_t2_charge', 'mil_t3_blitz', 'mil_t4_dominance'];
    for (const id of chain.slice(0, -1)) {
      research.startResearch(id); tree.completeNode(id);
      research.cancelResearch(id); fillPts(pts);
    }
    expect(research.startResearch(chain[chain.length - 1]).success).toBe(true);
  });
});

describe('F-Boundary: 科技点上限', () => {
  it('不超过MAX_TECH_POINTS', () => {
    const p = new TechPointSystem(); p.init(createMockDeps() as any);
    p.refund(TechPointSystem.MAX_TECH_POINTS + 10000);
    expect(p.getCurrentPoints()).toBe(TechPointSystem.MAX_TECH_POINTS);
  });
});

describe('F-Boundary: 批量升级', () => {
  it('空列表返回空', () => {
    const r = createBuilding().batchUpgrade([], richRes());
    expect(r.succeeded).toEqual([]); expect(r.failed).toEqual([]);
  });
  it('跳过不可升级建筑', () => {
    const r = createBuilding().batchUpgrade(['farmland', 'market'], richRes());
    expect(r.succeeded.some(s => s.type === 'farmland')).toBe(true);
    expect(r.failed.some(f => f.type === 'market')).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// F-Normal: 正向流程补充
// ═══════════════════════════════════════════════

describe('F-Normal: 建筑升级完整流程', () => {
  it('检查→开始→完成→验证', () => {
    const s = createBuilding(); const r = richRes();
    expect(s.checkUpgrade('farmland', r).canUpgrade).toBe(true);
    s.startUpgrade('farmland', r);
    expect(s.getBuilding('farmland').status).toBe('upgrading');
    s.forceCompleteUpgrades();
    expect(s.getLevel('farmland')).toBe(2);
  });
  it('多级连续升级', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 3); upgradeTo(s, 'farmland', 4);
    expect(s.getLevel('farmland')).toBeGreaterThanOrEqual(4);
  });
});

describe('F-Normal: 成本计算', () => {
  it('农田Lv1→2成本正确', () => {
    const c = createBuilding().getUpgradeCost('farmland')!;
    expect(c.grain).toBe(100); expect(c.gold).toBe(50);
  });
  it('升级后成本增加', () => {
    const s = createBuilding(); const c1 = s.getUpgradeCost('farmland')!;
    upgradeTo(s, 'farmland', 2);
    expect(s.getUpgradeCost('farmland')!.grain).toBeGreaterThan(c1.grain);
  });
});

describe('F-Normal: 研究完整流程', () => {
  let tree: TechTreeSystem; let pts: TechPointSystem; let research: TechResearchSystem;
  beforeEach(() => { ({ tree, pts, research } = createTechSuite(10)); fillPts(pts); });

  it('开始→检查进度→完成', () => {
    const r = research.startResearch('mil_t1_attack');
    expect(r.success).toBe(true);
    expect(research.isResearching('mil_t1_attack')).toBe(true);
    expect(research.getResearchProgress('mil_t1_attack')).toBeGreaterThanOrEqual(0);
    expect(research.getRemainingTime('mil_t1_attack')).toBeGreaterThan(0);
    tree.completeNode('mil_t1_attack');
    expect(tree.getNodeState('mil_t1_attack')!.status).toBe('completed');
  });
});

describe('F-Normal: 研究加速', () => {
  let tree: TechTreeSystem; let pts: TechPointSystem; let research: TechResearchSystem;
  beforeEach(() => { ({ tree, pts, research } = createTechSuite(10)); fillPts(pts); });

  it('天命加速减少剩余时间', () => {
    research.startResearch('mil_t1_attack');
    const r = research.speedUp('mil_t1_attack', 'mandate', 1);
    expect(r.success).toBe(true); expect(r.timeReduced).toBeGreaterThan(0);
  });
  it('calculateIngotCost返回正数', () => {
    research.startResearch('mil_t1_attack');
    expect(research.calculateIngotCost('mil_t1_attack')).toBeGreaterThan(0);
  });
  it('非研究中科技费用为0', () => {
    expect(research.calculateIngotCost('mil_t1_attack')).toBe(0);
    expect(research.calculateMandateCost('mil_t1_attack')).toBe(0);
  });
});

describe('F-Normal: 科技路线统计与效果', () => {
  it('getAllPathProgress初始全0', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    const p = t.getAllPathProgress();
    expect(p.military.completed).toBe(0); expect(p.economy.completed).toBe(0);
  });
  it('完成后进度增加', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    t.completeNode('mil_t1_attack');
    expect(t.getAllPathProgress().military.completed).toBeGreaterThan(0);
  });
  it('getPathNodes返回正确路线', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    expect(t.getPathNodes('military').every(n => n.path === 'military')).toBe(true);
  });
  it('未完成效果返回0', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    expect(t.getEffectValue('troop_attack', 'all')).toBe(0);
  });
  it('完成后效果值正确', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    t.completeNode('eco_t3_marketplace');
    expect(t.getEffectValue('resource_production', 'all')).toBe(10);
  });
});

describe('F-Normal: 铜钱兑换科技点', () => {
  it('书院Lv5+可兑换', () => {
    const p = new TechPointSystem(); p.init(createMockDeps() as any);
    expect(p.canExchange(5).can).toBe(true); expect(p.canExchange(4).can).toBe(false);
  });
  it('兑换比率100:1', () => {
    const p = new TechPointSystem(); p.init(createMockDeps() as any);
    const r = p.exchangeGoldForTechPoints(1000, 10);
    expect(r.success).toBe(true); expect(r.pointsGained).toBe(10);
  });
});

describe('F-Normal: 产出关联', () => {
  it('农田产出粮草', () => expect(BUILDING_DEFS.farmland.production?.resourceType).toBe('grain'));
  it('城墙防御值>0', () => {
    const s = createBuilding(); upgradeTo(s, 'castle', 4);
    upgradeTo(s, 'farmland', 4); upgradeTo(s, 'castle', 5);
    expect(s.getWallDefense()).toBeGreaterThan(0);
  });
  it('主城加成随等级增长', () => {
    const s = createBuilding(); const p1 = s.getCastleBonusPercent();
    upgradeTo(s, 'castle', 5);
    expect(s.getCastleBonusPercent()).toBeGreaterThan(p1);
  });
});

describe('F-Normal: 升级进度', () => {
  it('非升级状态进度为0', () => {
    const s = createBuilding();
    expect(s.getUpgradeProgress('farmland')).toBe(0);
    expect(s.getUpgradeRemainingTime('farmland')).toBe(0);
  });
  it('升级中进度0~1', () => {
    const s = createBuilding(); s.startUpgrade('farmland', richRes());
    const p = s.getUpgradeProgress('farmland');
    expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1);
  });
});

describe('F-Normal: 外观/推荐/完整性', () => {
  it('低等级为humble', () => expect(createBuilding().getAppearanceStage('farmland')).toBe('humble'));
  it('推荐路线返回有效数据', () => {
    const s = createBuilding();
    expect(s.recommendUpgradePath('newbie')).toBeDefined();
    expect(s.getUpgradeRecommendation()).toBeDefined();
  });
  it('getAllBuildings返回8种建筑', () => {
    expect(Object.keys(createBuilding().getAllBuildings())).toHaveLength(BUILDING_TYPES.length);
  });
  it('getBuildingLevels返回等级', () => {
    const l = createBuilding().getBuildingLevels();
    expect(l.castle).toBe(1); expect(l.farmland).toBe(1);
  });
});

describe('F-Normal: ISubsystem接口', () => {
  it('BuildingSystem.getState', () => {
    expect((createBuilding().getState() as any).version).toBe(BUILDING_SAVE_VERSION);
  });
  it('TechTreeSystem.getState', () => {
    const t = new TechTreeSystem(); t.init(createMockDeps() as any);
    expect(t.getState().nodes).toBeDefined();
  });
  it('TechPointSystem.getState', () => {
    const p = new TechPointSystem(); p.init(createMockDeps() as any);
    expect(p.getState().current).toBe(0);
  });
});
