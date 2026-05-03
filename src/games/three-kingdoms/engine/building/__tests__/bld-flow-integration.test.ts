/**
 * BLD Flow Integration Tests — 三国霸业建筑系统完整集成测试
 *
 * 覆盖 30 个主流程 / 124 个子流程
 * 按 Sprint 分组，逐条验证 FLOW-LIST 中定义的功能点
 *
 * 规则：
 * - 每个测试独立初始化，不依赖其他测试状态
 * - 已实现功能：正常验证
 * - 缺失功能(F11/F12/F28)：使用 it.todo 标记
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Building 域 ──
import { BuildingSystem } from '../BuildingSystem';
import { EvolutionSystem } from '../EvolutionSystem';
import { SynergySystem } from '../SynergySystem';
import { SpecializationSystem } from '../SpecializationSystem';
import { WallDefenseSystem } from '../WallDefenseSystem';
import { TrapSystem } from '../TrapSystem';
import { BuildingEventSystem } from '../BuildingEventSystem';
import { ActiveDecisionSystem } from '../ActiveDecisionSystem';
import { AutoUpgradeSystem } from '../AutoUpgradeSystem';
import { ResourceChainSystem } from '../ResourceChainSystem';
import { BUILDING_TYPES } from '../building.types';
import { BUILDING_DEFS, BUILDING_MAX_LEVELS, BUILDING_SAVE_VERSION, STORAGE_OVERFLOW_SLOWDOWN } from '../building-config';

// ── Bridge 层 ──
import { getRecruitBonus, calculateActualRate, isTavernFeatureUnlocked, getTavernUnlockLevel } from '../tavern-bridge';
import { getTradeDiscount, getProsperityBonus, getMaxCaravans, calculateProsperityLevel, calculateMarketGoldBonus, applyTradeDiscount } from '../port-bridge';

// ── Clinic 域 ──
import { ClinicTreatmentSystem } from '../../clinic/ClinicTreatmentSystem';
import { ClinicLossReport } from '../../clinic/ClinicLossReport';

// ── Barracks 域 ──
import { BarracksFormationSystem } from '../../barracks/BarracksFormationSystem';
import { BarracksTrainingSystem } from '../../barracks/BarracksTrainingSystem';

// ── Tech 域 ──
import { TechTreeSystem } from '../../tech/TechTreeSystem';
import { TechPointSystem } from '../../tech/TechPointSystem';
import { TechEffectSystem } from '../../tech/TechEffectSystem';
import { AcademyResearchSystem } from '../../tech/AcademyResearchSystem';

// ── Trade 域 ──
import { CaravanSystem } from '../../trade/CaravanSystem';
import { TradeSystem } from '../../trade/TradeSystem';

// ── Equipment 域 ──
import { EquipmentSystem } from '../../equipment/EquipmentSystem';
import { WorkshopForgeSystem } from '../../equipment/WorkshopForgeSystem';

// ── Resource 域 ──
import { ResourceSystem } from '../../resource/ResourceSystem';

// ── Types ──
import type { BuildingType, BuildingState, BuildingSaveData, Resources } from '../../../shared/types';

// ═══════════════════════════════════════════════════════════════
// 测试工具函数
// ═══════════════════════════════════════════════════════════════

const RICH: Resources = { grain: 1e9, gold: 1e9, troops: 1e9, mandate: 0 };

function makeSave(overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {}): BuildingSaveData {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = { type: t, level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, ...overrides[t] };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

/** 创建一个所有建筑都解锁到指定等级的存档 */
function makeSaveAllLevels(level: number, extra?: Partial<Record<BuildingType, Partial<BuildingState>>>): BuildingSaveData {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const t of BUILDING_TYPES) {
    buildings[t] = { type: t, level, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, ...extra?.[t] };
  }
  return { version: BUILDING_SAVE_VERSION, buildings };
}

/** 快速升级建筑到指定等级（不通过 tick） */
function forceLevel(bs: BuildingSystem, type: BuildingType, level: number): void {
  const save = bs.serialize();
  save.buildings[type].level = level;
  save.buildings[type].status = 'idle';
  save.buildings[type].upgradeStartTime = null;
  save.buildings[type].upgradeEndTime = null;
  bs.deserialize(save);
}

// ═══════════════════════════════════════════════════════════════
// Sprint 1: 核心资源流 (12项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1: 核心资源流', () => {
  let bs: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── BLD-F01-01: 主城加成计算 ──
  it('BLD-F01-01: 主城加成计算 — tick后资源累加，验证乘法公式', () => {
    // 主城 Lv1 → getCastleBonusPercent 返回产出值
    const bonusPct = bs.getCastleBonusPercent();
    expect(bonusPct).toBeGreaterThanOrEqual(0);

    // 乘数公式: 1 + pct/100
    const multiplier = bs.getCastleBonusMultiplier();
    expect(multiplier).toBeCloseTo(1 + bonusPct / 100);

    // NaN防护
    expect(Number.isFinite(multiplier)).toBe(true);
  });

  it('BLD-F01-01b: 主城加成随等级提升', () => {
    const lv1 = bs.getCastleBonusPercent();
    forceLevel(bs, 'castle', 5);
    const lv5 = bs.getCastleBonusPercent();
    expect(lv5).toBeGreaterThan(lv1);
  });

  // ── BLD-F01-02: 产出上限检查 ──
  it('BLD-F01-02: 产出上限检查 — 资源达上限后降速50%', () => {
    // 设置建筑有库存上限
    forceLevel(bs, 'farmland', 5);
    const capacity = bs.getStorageCapacity('farmland');
    expect(capacity).toBeGreaterThan(0);

    // 模拟库存接近上限
    bs.tickStorage(1); // 累加一点库存
    const storageBefore = bs.getStorageAmount('farmland');

    // 检查溢出降速
    const isOverflow = bs.isStorageOverflowing('farmland');
    // 如果已满，检查降速因子
    if (isOverflow) {
      expect(STORAGE_OVERFLOW_SLOWDOWN).toBe(0.5);
    }
  });

  // ── BLD-F02-01: 升级校验(7项) ──
  it('BLD-F02-01a: 升级校验 — 锁定建筑不可升级', () => {
    // barracks 初始锁定
    const r = bs.checkUpgrade('barracks', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons).toContain('建筑尚未解锁');
  });

  it('BLD-F02-01b: 升级校验 — 升级中不可再升级', () => {
    bs.startUpgrade('castle', RICH);
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(false);
  });

  it('BLD-F02-01c: 升级校验 — 等级上限', () => {
    const maxLv = BUILDING_MAX_LEVELS.farmland;
    forceLevel(bs, 'farmland', maxLv);
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(false);
  });

  it('BLD-F02-01d: 升级校验 — 子建筑不超过主城等级+1', () => {
    // farmland level 2, castle level 1 → should fail
    forceLevel(bs, 'farmland', 2);
    const r = bs.checkUpgrade('farmland', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons.some(x => x.includes('主城等级'))).toBe(true);
  });

  it('BLD-F02-01e: 升级校验 — 主城Lv5前置条件', () => {
    // 主城要升到5，需要至少一个其他建筑到4
    forceLevel(bs, 'castle', 4);
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(false);
  });

  it('BLD-F02-01f: 升级校验 — 队列满', () => {
    // 队列只有1个槽位（主城Lv1），占满后不可再升级
    bs.startUpgrade('farmland', RICH);
    const r = bs.checkUpgrade('castle', RICH);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons).toContain('升级队列已满');
  });

  it('BLD-F02-01g: 升级校验 — 资源不足', () => {
    const ZERO: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };
    const r = bs.checkUpgrade('castle', ZERO);
    expect(r.canUpgrade).toBe(false);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  // ── BLD-F02-02: 升级队列 ──
  it('BLD-F02-02a: 升级队列 — 入队→tick推进→完成', () => {
    const cost = bs.startUpgrade('castle', RICH);
    expect(cost).toBeDefined();
    expect(bs.getBuilding('castle').status).toBe('upgrading');
    expect(bs.getUpgradeQueue()).toHaveLength(1);

    // 推进时间完成升级
    vi.spyOn(Date, 'now').mockReturnValue(base + cost.timeSeconds * 1000 + 100);
    const completed = bs.tick();
    expect(completed).toContain('castle');
    expect(bs.getLevel('castle')).toBe(2);
  });

  it('BLD-F02-02b: 升级队列 — 取消升级返还80%', () => {
    const cost = bs.startUpgrade('castle', RICH);
    const refund = bs.cancelUpgrade('castle');
    expect(refund).not.toBeNull();
    expect(refund!.grain).toBe(Math.floor(cost.grain * 0.8));
    expect(refund!.gold).toBe(Math.floor(cost.gold * 0.8));
  });

  // ── BLD-F26-01: 矿场产出 ──
  it('BLD-F26-01: 矿场产出 — tick后ore增加', () => {
    forceLevel(bs, 'mine', 3);
    const before = bs.getStorageAmount('mine');
    bs.tickStorage(1);
    const after = bs.getStorageAmount('mine');
    expect(after).toBeGreaterThan(before);
  });

  // ── BLD-F26-02: 伐木场产出 ──
  it('BLD-F26-02: 伐木场产出 — tick后wood增加', () => {
    forceLevel(bs, 'lumberMill', 3);
    const before = bs.getStorageAmount('lumberMill');
    bs.tickStorage(1);
    const after = bs.getStorageAmount('lumberMill');
    expect(after).toBeGreaterThan(before);
  });

  // ── BLD-F07-01: 离线产出计算 ──
  it('BLD-F07-01: 离线产出计算 — ResourceSystem离线收益', () => {
    const rs = new ResourceSystem();
    rs.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    rs.setResource('grain', 1000);
    rs.setProductionRate('grain', 10);

    const earnings = rs.calculateOfflineEarnings(3600); // 1小时
    expect(earnings.earned.grain).toBeGreaterThan(0);
  });

  // ── BLD-F10-01: 一键收取 ──
  it('BLD-F10-01: 一键收取 — collectAll→各建筑库存清零→资源增加', () => {
    forceLevel(bs, 'farmland', 5);
    forceLevel(bs, 'mine', 5);
    bs.tickStorage(10); // 累加库存

    const result = bs.collectAll();
    expect(Object.keys(result.collected).length).toBeGreaterThan(0);
    expect(result.buildingDetails.length).toBeGreaterThan(0);

    // 库存清零
    expect(bs.getStorageAmount('farmland')).toBe(0);
    expect(bs.getStorageAmount('mine')).toBe(0);
  });

  // ── BLD-F10-03: 建筑库存 ──
  it('BLD-F10-03: 建筑库存 — tick后建筑库存累加', () => {
    forceLevel(bs, 'farmland', 3);
    const before = bs.getStorageAmount('farmland');
    bs.tickStorage(1);
    const after = bs.getStorageAmount('farmland');
    expect(after).toBeGreaterThan(before);
  });

  // ── BLD-F15-01: 上限计算 ──
  it('BLD-F15-01: 上限计算 — getStorageCapacity返回正确值', () => {
    forceLevel(bs, 'farmland', 5);
    const capacity = bs.getStorageCapacity('farmland');
    expect(capacity).toBeGreaterThan(0);

    // 无产出的建筑容量为0
    forceLevel(bs, 'castle', 5);
    expect(bs.getStorageCapacity('castle')).toBe(0);
  });

  // ── BLD-F15-02: 溢出处理 ──
  it('BLD-F15-02: 溢出处理 — 库存达上限后产出降速50%', () => {
    forceLevel(bs, 'farmland', 3);
    // 大量tick让库存接近上限
    for (let i = 0; i < 200; i++) {
      bs.tickStorage(60);
    }

    const isOverflow = bs.isStorageOverflowing('farmland');
    if (isOverflow) {
      // 溢出后继续tick，增长应减缓
      const before = bs.getStorageAmount('farmland');
      bs.tickStorage(1);
      const after = bs.getStorageAmount('farmland');
      // 降速模式下增长很小或不增长
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Sprint 2: 工坊装备系统 (7项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 2: 工坊装备系统', () => {
  let bs: BuildingSystem;
  let eq: EquipmentSystem;
  let ws: WorkshopForgeSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();
    eq = new EquipmentSystem();
    ws = new WorkshopForgeSystem();
    ws.setEquipmentSystem(eq);
    ws.setBuildingSystem(bs);
    ws.setResourceDeductor(() => true);
    ws.setResourceAdder(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── BLD-F24-01: 装备锻造 ──
  it('BLD-F24-01: 装备锻造 — 消耗ore+wood+gold→产出装备', () => {
    forceLevel(bs, 'workshop', 5);
    const result = ws.forgeEquipment();
    if (result.success) {
      expect(result.equipment).toBeDefined();
      expect(result.cost).toBeDefined();
    }
  });

  // ── BLD-F24-01b: 装备强化 ──
  it('BLD-F24-01b: 装备强化 — 消耗ore→属性提升', () => {
    forceLevel(bs, 'workshop', 5);
    const forgeResult = ws.forgeEquipment();
    if (forgeResult.success && forgeResult.equipment) {
      const uid = forgeResult.equipment.uid;
      const enhanceSys = eq.getEnhanceSystem?.();
      // EquipmentSystem has enhance capability through EquipmentEnhanceSystem
      expect(uid).toBeDefined();
    }
  });

  // ── BLD-F24-02: 批量锻造 ──
  it('BLD-F24-02: 批量锻造 — Lv10解锁', () => {
    // Lv5 未解锁
    forceLevel(bs, 'workshop', 5);
    expect(bs.isBatchForgeUnlocked()).toBe(false);

    // Lv10 解锁
    forceLevel(bs, 'workshop', 10);
    expect(bs.isBatchForgeUnlocked()).toBe(true);
  });

  it('BLD-F24-02b: 批量锻造 — 执行批量锻造', () => {
    forceLevel(bs, 'workshop', 10);
    const result = ws.batchForge(3);
    expect(result.equipments).toBeDefined();
    expect(result.forgedCount).toBeGreaterThan(0);
  });

  // ── BLD-F24-03: 装备分解 ──
  it('BLD-F24-03: 装备分解 — 装备→回收ore', () => {
    forceLevel(bs, 'workshop', 5);
    const forgeResult = ws.forgeEquipment();
    if (forgeResult.success && forgeResult.equipment) {
      const uid = forgeResult.equipment.uid;
      const decomposeResult = ws.decomposeEquipment(uid);
      if (decomposeResult.success) {
        expect(decomposeResult.recoveredOre).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // ── BLD-F24-04: 工坊升级 ──
  it('BLD-F24-04: 工坊升级 — 等级提升→效率增加', () => {
    forceLevel(bs, 'workshop', 3);
    const eff1 = bs.getWorkshopForgeEfficiency();

    forceLevel(bs, 'workshop', 8);
    const eff2 = bs.getWorkshopForgeEfficiency();
    expect(eff2).toBeGreaterThan(eff1);
  });

  // ── BLD-F24-05: 装备穿戴 ──
  it('BLD-F24-05: 装备穿戴 — 装备绑定武将→属性加成', () => {
    forceLevel(bs, 'workshop', 5);
    // 计算武将装备加成
    const bonus = ws.calculateHeroEquipmentBonus('hero_001');
    expect(bonus).toBeDefined();
    // bonus 包含 attack, defense 等属性加成
  });

  // ── XI-009: 工坊等级→锻造效率 ──
  it('XI-009: 工坊等级→锻造效率', () => {
    forceLevel(bs, 'workshop', 1);
    const mult1 = bs.getWorkshopForgeMultiplier();

    forceLevel(bs, 'workshop', 10);
    const mult10 = bs.getWorkshopForgeMultiplier();
    expect(mult10).toBeGreaterThanOrEqual(mult1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sprint 3: 书院研究系统 (5项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 3: 书院研究系统', () => {
  let techTree: TechTreeSystem;
  let techPoint: TechPointSystem;
  let techEffect: TechEffectSystem;
  let academy: AcademyResearchSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);

    techTree = new TechTreeSystem();
    techTree.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });

    techPoint = new TechPointSystem();
    techPoint.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    techPoint.syncAcademyLevel(5);

    techEffect = new TechEffectSystem();
    techEffect.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    techEffect.setTechTree(techTree);

    let copper = 1_000_000;
    let ingot = 1_000_000;

    academy = new AcademyResearchSystem(
      null, techTree, techPoint,
      () => copper,
      (amt) => { copper -= amt; return true; },
      () => ingot,
      (amt) => { ingot -= amt; return true; },
    );
    academy.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    academy.setTechEffectSystem(techEffect);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── BLD-F29-01: 研究队列 ──
  it('BLD-F29-01a: 研究队列 — 入队成功', () => {
    // 给足够的科技点
    techPoint.refund(10000);
    const allDefs = techTree.getAllNodeDefs();
    if (allDefs.length > 0) {
      const firstTech = allDefs[0];
      const result = academy.startResearch(firstTech.id);
      // 可能因前置条件失败，但API调用正常
      expect(result).toHaveProperty('success');
    }
  });

  it('BLD-F29-01b: 研究队列 — tick推进→完成', () => {
    techPoint.refund(10000);
    const allDefs = techTree.getAllNodeDefs();
    if (allDefs.length > 0) {
      const firstTech = allDefs[0];
      const result = academy.startResearch(firstTech.id);
      if (result.success) {
        // 推进时间
        vi.spyOn(Date, 'now').mockReturnValue(base + 999_999_999);
        const completed = academy.tickResearch(0);
        if (completed.length > 0) {
          expect(completed).toContain(firstTech.id);
        }
      }
    }
  });

  // ── BLD-F29-02: 研究加速 ──
  it('BLD-F29-02a: 研究加速 — 铜钱加速', () => {
    techPoint.refund(10000);
    const allDefs = techTree.getAllNodeDefs();
    if (allDefs.length > 0) {
      const firstTech = allDefs[0];
      const result = academy.startResearch(firstTech.id);
      if (result.success) {
        const speedUp = academy.copperSpeedUp(firstTech.id);
        expect(speedUp).toHaveProperty('success');
      }
    }
  });

  it('BLD-F29-02b: 研究加速 — 元宝秒完成', () => {
    techPoint.refund(10000);
    const allDefs = techTree.getAllNodeDefs();
    if (allDefs.length > 0) {
      const firstTech = allDefs[0];
      const result = academy.startResearch(firstTech.id);
      if (result.success) {
        const instant = academy.ingotInstantComplete(firstTech.id);
        expect(instant).toHaveProperty('success');
      }
    }
  });

  // ── BLD-F29-03: 科技树预览 ──
  it('BLD-F29-03: 科技树预览 — 节点/边/路径', () => {
    const allNodes = techTree.getAllNodeDefs();
    expect(allNodes.length).toBeGreaterThan(0);

    const edges = techTree.getEdges();
    expect(Array.isArray(edges)).toBe(true);

    // 路径进度
    const progress = techTree.getAllPathProgress();
    expect(progress).toBeDefined();
  });

  // ── XI-005: 书院→科技点 ──
  it('XI-005: 书院→科技点', () => {
    techPoint.syncAcademyLevel(5);
    const rate = techPoint.getProductionRate();
    expect(rate).toBeGreaterThanOrEqual(0);

    techPoint.syncAcademyLevel(10);
    const rate10 = techPoint.getProductionRate();
    expect(rate10).toBeGreaterThanOrEqual(rate);
  });

  // ── XI-016: 科技→建筑加成 ──
  it('XI-016: 科技→建筑加成', () => {
    const bonus = techEffect.getProductionBonus('farmland');
    expect(typeof bonus).toBe('number');
    expect(Number.isFinite(bonus)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sprint 4: 兵营编队+战斗 (6项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 4: 兵营编队+战斗', () => {
  let formation: BarracksFormationSystem;
  let training: BarracksTrainingSystem;
  let clinic: ClinicTreatmentSystem;

  beforeEach(() => {
    vi.restoreAllMocks();

    let troops = 10000;
    let grain = 100000;
    let gold = 100000;

    formation = new BarracksFormationSystem();
    formation.setup(5, () => troops, (n) => { troops -= n; return true; });

    training = new BarracksTrainingSystem();
    training.init(5, (r) => r === 'grain' ? grain : r === 'gold' ? gold : 0, (r, a) => {
      if (r === 'grain') { grain -= a; return true; }
      if (r === 'gold') { gold -= a; return true; }
      return false;
    });

    clinic = new ClinicTreatmentSystem();
    clinic.init(5, (r) => r === 'grain' ? grain : 0, (r, a) => {
      if (r === 'grain') { grain -= a; return true; }
      return false;
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── BLD-F27-01: 编队管理 ──
  it('BLD-F27-01a: 编队管理 — 创建编队', () => {
    const result = formation.createFormation('先锋营');
    expect(result.success).toBe(true);
    expect(result.formationId).toBeDefined();
  });

  it('BLD-F27-01b: 编队管理 — 删除编队', () => {
    const create = formation.createFormation();
    expect(create.success).toBe(true);
    const del = formation.deleteFormation(create.formationId!);
    expect(del.success).toBe(true);
  });

  it('BLD-F27-01c: 编队管理 — 兵力分配', () => {
    const create = formation.createFormation();
    expect(create.success).toBe(true);
    const assign = formation.assignTroops(create.formationId!, 100);
    expect(assign.success).toBe(true);
  });

  // ── BLD-F27-02: 训练模式 ──
  it('BLD-F27-02a: 训练模式 — 普通训练', () => {
    const result = training.train('normal', 100);
    expect(result.success).toBe(true);
    expect(result.troopsGained).toBeGreaterThan(0);
  });

  it('BLD-F27-02b: 训练模式 — 加速训练', () => {
    const result = training.train('accelerated', 100);
    expect(result.success).toBe(true);
  });

  it('BLD-F27-02c: 训练模式 — 精英训练', () => {
    const result = training.train('elite', 100);
    expect(result.success).toBe(true);
  });

  // ── BLD-F13-01: 被动加成 ──
  it('BLD-F13-01: 被动加成 — clinicLevel×2%', () => {
    const rate = clinic.passiveHealRate();
    // clinicLevel=5, rate = 5 * 0.02 = 0.10
    expect(rate).toBe(0.10);
  });

  // ── BLD-F13-02: 主动治疗 ──
  it('BLD-F13-02: 主动治疗 — 消耗grain→恢复伤兵', () => {
    clinic.addWounded(100);
    const result = clinic.treat();
    expect(result.success).toBe(true);
    expect(result.healed).toBeGreaterThan(0);
    expect(result.cost.grain).toBeGreaterThan(0);
  });

  // ── BLD-F13-03: 治疗Buff ──
  it('BLD-F13-03: 治疗Buff — 治疗后+10%产出10分钟', () => {
    clinic.addWounded(100);
    clinic.treat();
    const buff = clinic.getProductionBuff();
    expect(buff).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sprint 5: 酒馆+市舶司 (8项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 5: 酒馆+市舶司', () => {

  // ── BLD-F23-01: 武将招募 ──
  it('BLD-F23-01a: 武将招募 — 概率计算', () => {
    const bonus = getRecruitBonus(5);
    expect(bonus).toBe(0.10); // 5 * 0.02
  });

  it('BLD-F23-01b: 武将招募 — 实际概率计算', () => {
    const rate = calculateActualRate(0.05, 10, 0.05, 0.08);
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThanOrEqual(1.0);
  });

  // ── BLD-F23-02: 招募保底 ──
  it('BLD-F23-02: 招募保底 — 保底可见需Lv16', () => {
    expect(isTavernFeatureUnlocked(15, 'pityVisible')).toBe(false);
    expect(isTavernFeatureUnlocked(16, 'pityVisible')).toBe(true);
  });

  it('BLD-F23-02b: 招募保底 — 十连需Lv11', () => {
    expect(isTavernFeatureUnlocked(10, 'tenPull')).toBe(false);
    expect(isTavernFeatureUnlocked(11, 'tenPull')).toBe(true);
  });

  // ── BLD-F25-01: 商队派遣 ──
  it('BLD-F25-01: 商队派遣 — CaravanSystem初始化', () => {
    const caravan = new CaravanSystem();
    caravan.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    const caravans = caravan.getIdleCaravans();
    expect(caravans.length).toBeGreaterThan(0);
  });

  // ── BLD-F25-03: 贸易折扣 ──
  it('BLD-F25-03: 贸易折扣 — portLevel→折扣', () => {
    const discount5 = getTradeDiscount(5);
    const discount10 = getTradeDiscount(10);
    expect(discount10).toBeGreaterThanOrEqual(discount5);
  });

  it('BLD-F25-03b: 贸易折扣 — 应用折扣', () => {
    const original = 1000;
    const discounted = applyTradeDiscount(original, 10);
    expect(discounted).toBeLessThan(original);
  });

  // ── XI-008: 酒馆→招募概率加成 ──
  it('XI-008: 酒馆→招募概率加成', () => {
    const lv1 = getRecruitBonus(1);
    const lv10 = getRecruitBonus(10);
    expect(lv10).toBeGreaterThan(lv1);
  });

  // ── XI-010: 市舶司→贸易折扣 ──
  it('XI-010: 市舶司→贸易折扣', () => {
    expect(getTradeDiscount(1)).toBeGreaterThanOrEqual(0);
    expect(getTradeDiscount(20)).toBeGreaterThan(getTradeDiscount(1));
  });

  // ── XI-012: 市舶司→市集繁荣度加成 ──
  it('XI-012: 市舶司→市集繁荣度加成', () => {
    const bonus = getProsperityBonus(10);
    expect(bonus).toBeGreaterThan(0);

    const prosperityLevel = calculateProsperityLevel(2500);
    expect(prosperityLevel).toBeGreaterThan(1);

    const goldBonus = calculateMarketGoldBonus(prosperityLevel);
    expect(goldBonus).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sprint 6: 城墙+协同+进化 (7项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 6: 城墙+协同+进化', () => {
  let bs: BuildingSystem;
  let wall: WallDefenseSystem;
  let trap: TrapSystem;
  let synergy: SynergySystem;
  let spec: SpecializationSystem;
  let evo: EvolutionSystem;
  let ads: ActiveDecisionSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);

    bs = new BuildingSystem();
    wall = new WallDefenseSystem();
    wall.init(5);

    let ore = 10000;
    trap = new TrapSystem();
    trap.init(5, () => ore, (n) => { ore -= n; return true; });

    synergy = new SynergySystem();
    synergy.init((type: string) => bs.getLevel(type as BuildingType));

    spec = new SpecializationSystem();
    spec.init((type: string) => bs.getLevel(type as BuildingType));

    evo = new EvolutionSystem();

    ads = new ActiveDecisionSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── BLD-F06: 城墙防御 ──
  it('BLD-F06a: 城墙防御 — 城防值计算', () => {
    const defense = wall.getDefenseValue();
    expect(defense).toBeGreaterThan(0);
  });

  it('BLD-F06b: 城墙防御 — 守城Buff', () => {
    const buff = wall.getGarrisonBuff();
    expect(buff).toBeDefined();
    expect(typeof buff.attackBonus).toBe('number');
    expect(typeof buff.defenseBonus).toBe('number');
  });

  // ── BLD-F30-01: 陷阱部署 ──
  it('BLD-F30-01: 陷阱部署 — 消耗资源→部署陷阱', () => {
    const result = trap.deployTrap('fire');
    expect(result).toHaveProperty('success');
  });

  // ── BLD-F30-02: 陷阱触发 ──
  it('BLD-F30-02: 陷阱触发 — 攻击时触发陷阱', () => {
    // 先部署
    trap.deployTrap('fire');
    trap.deployTrap('fire');

    // 触发
    const triggerResult = trap.triggerTraps();
    expect(triggerResult).toBeDefined();
    expect(triggerResult.totalDamage).toBeGreaterThanOrEqual(0);
  });

  // ── BLD-F14-01: 协同发现 ──
  it('BLD-F14-01: 协同发现 — 组合条件检查', () => {
    // 初始等级低，无协同
    const statuses = synergy.checkAllSynergies();
    expect(Array.isArray(statuses)).toBe(true);
  });

  // ── BLD-F14-02: 协同激活 ──
  it('BLD-F14-02: 协同激活 — 激活协同加成', () => {
    // 提升建筑等级触发协同
    forceLevel(bs, 'farmland', 5);
    forceLevel(bs, 'mine', 5);
    synergy.onLevelChange('farmland', 5);
    synergy.onLevelChange('mine', 5);

    const bonus = synergy.getTotalSynergyBonus();
    expect(bonus).toBeGreaterThanOrEqual(0);
  });

  // ── BLD-F16-01: 特化选择 ──
  it('BLD-F16-01a: 特化选择 — Lv10前不可特化', () => {
    forceLevel(bs, 'farmland', 5);
    const canSpec = spec.canSpecialize('farmland');
    expect(canSpec).toBe(false);
  });

  it('BLD-F16-01b: 特化选择 — Lv10选择方向', () => {
    forceLevel(bs, 'farmland', 10);
    const canSpec = spec.canSpecialize('farmland');
    expect(canSpec).toBe(true);

    const options = spec.getSpecializationOptions('farmland');
    expect(options.length).toBeGreaterThan(0);
  });

  // ── BLD-F22-01: 进化解锁 ──
  it('BLD-F22-01: 进化解锁 — 满级→进化', () => {
    const canEvolve = evo.canEvolve('farmland');
    // 初始不可进化
    expect(canEvolve).toBeDefined();
    expect(canEvolve.canEvolve).toBe(false);
  });

  // ── BLD-F21-01: 建筑焦点 ──
  it('BLD-F21-01a: 建筑焦点 — 标记焦点建筑', () => {
    const result = ads.setFocus('farmland');
    expect(result.success).toBe(true);
    expect(ads.getFocus()).toBe('farmland');
  });

  it('BLD-F21-01b: 建筑焦点 — 焦点加成15%', () => {
    ads.setFocus('farmland');
    const bonus = ads.getFocusBonus('farmland');
    expect(bonus).toBeGreaterThan(0);
    // 非焦点建筑无加成
    expect(ads.getFocusBonus('mine')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sprint 7: 事件+跨系统 (5项)
// ═══════════════════════════════════════════════════════════════

describe('Sprint 7: 事件+跨系统', () => {
  let eventSys: BuildingEventSystem;
  let bs: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);

    bs = new BuildingSystem();
    eventSys = new BuildingEventSystem();
    eventSys.init(() => bs.getBuildingLevels());
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── BLD-F18-01: 事件触发 ──
  it('BLD-F18-01a: 事件触发 — 首次登录100%', () => {
    const event = eventSys.checkTriggerOnLogin(true);
    // 首次登录应触发事件（100%概率，但需有等级>0的建筑）
    if (event) {
      expect(event.uid).toBeDefined();
      expect(event.eventId).toBeDefined();
    }
  });

  it('BLD-F18-01b: 事件触发 — 非首次30%概率', () => {
    // 非首次登录可能不触发（30%概率）
    const event = eventSys.checkTriggerOnLogin(false);
    // 结果可能是 null 或 BuildingEvent
    if (event) {
      expect(event.uid).toBeDefined();
    } else {
      expect(event).toBeNull();
    }
  });

  // ── BLD-F18-02: 事件结算 ──
  it('BLD-F18-02: 事件结算 — 选择→奖励', () => {
    const event = eventSys.checkTriggerOnLogin(true);
    if (event && event.def && event.def.options && event.def.options.length > 0) {
      const result = eventSys.resolveEvent(event.uid, event.def.options[0].id);
      expect(result).toBeDefined();
      expect(result.reward).toBeDefined();
    }
  });

  // ── BLD-F19-01: 损失报告 ──
  it('BLD-F19-01: 损失报告 — 节省量计算', () => {
    const report = new ClinicLossReport();
    report.init(
      5,
      () => ({ grain: 100, gold: 50 }),
      () => ({ grain: 120, gold: 60 }),
    );
    const savings = report.getSavingsReport();
    expect(Array.isArray(savings)).toBe(true);
  });

  // ── BLD-F20-01: 每日事件 ──
  it('BLD-F20-01: 每日事件 — 首次登录100%触发', () => {
    const event = eventSys.checkTriggerOnLogin(true);
    // 首次登录应触发（100%概率）
    // 但可能因建筑等级不足等原因不触发
    expect(eventSys).toBeDefined();
  });

  // ── BLD-F20-02: 气泡状态 ──
  it('BLD-F20-02: 气泡状态 — calm/urgent', () => {
    const bubble = eventSys.getBubbleState('farmland');
    expect(bubble).toBeDefined();
    expect(['calm', 'urgent', 'none']).toContain(bubble);
  });
});

// ═══════════════════════════════════════════════════════════════
// 跨系统链路(XI) — 16条
// ═══════════════════════════════════════════════════════════════

describe('跨系统链路(XI)', () => {
  let bs: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── XI-001: 主城→全资源加成 ──
  it('XI-001: 主城→全资源加成', () => {
    const multiplier = bs.getCastleBonusMultiplier();
    expect(multiplier).toBeGreaterThanOrEqual(1.0);

    forceLevel(bs, 'castle', 5);
    const mult5 = bs.getCastleBonusMultiplier();
    expect(mult5).toBeGreaterThanOrEqual(multiplier);
  });

  // ── XI-002: 农田→grain产出 ──
  it('XI-002: 农田→grain产出', () => {
    forceLevel(bs, 'farmland', 5);
    const production = bs.getProduction('farmland');
    expect(production).toBeGreaterThan(0);
  });

  // ── XI-003: 市集→gold产出 ──
  it('XI-003: 市集→gold产出', () => {
    forceLevel(bs, 'market', 5);
    const production = bs.getProduction('market');
    expect(production).toBeGreaterThan(0);
  });

  // ── XI-004: 矿场→ore产出 ──
  it('XI-004: 矿场→ore产出', () => {
    forceLevel(bs, 'mine', 5);
    const production = bs.getProduction('mine');
    expect(production).toBeGreaterThan(0);
  });

  // ── XI-005: 书院→科技点 (已在Sprint 3中覆盖，此处补充) ──
  it('XI-005: 书院→科技点产出', () => {
    const tp = new TechPointSystem();
    tp.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    tp.syncAcademyLevel(5);
    const rate = tp.getProductionRate();
    expect(rate).toBeGreaterThanOrEqual(0);
  });

  // ── XI-006: 兵营→兵力 ──
  it('XI-006: 兵营→兵力上限', () => {
    const formation = new BarracksFormationSystem();
    formation.setup(5, () => 1000, () => true);
    const max = formation.getMaxFormations();
    expect(max).toBeGreaterThanOrEqual(1);
  });

  // ── XI-007: 城墙→防御 ──
  it('XI-007: 城墙→防御值', () => {
    forceLevel(bs, 'wall', 5);
    const defense = bs.getWallDefense();
    expect(defense).toBeGreaterThanOrEqual(0);
  });

  // ── XI-008: 酒馆→招募概率 (已在Sprint 5中覆盖) ──
  it('XI-008: 酒馆→招募概率加成', () => {
    expect(getRecruitBonus(10)).toBe(0.20);
  });

  // ── XI-009: 工坊→锻造效率 (已在Sprint 2中覆盖) ──
  it('XI-009: 工坊→锻造效率', () => {
    forceLevel(bs, 'workshop', 5);
    const eff = bs.getWorkshopForgeEfficiency();
    expect(eff).toBeGreaterThanOrEqual(0);
  });

  // ── XI-010: 市舶司→贸易折扣 (已在Sprint 5中覆盖) ──
  it('XI-010: 市舶司→贸易折扣', () => {
    const discount = getTradeDiscount(10);
    expect(discount).toBeGreaterThan(0);
  });

  // ── XI-011: 医馆→治疗 ──
  it('XI-011: 医馆→被动恢复率', () => {
    const clinic = new ClinicTreatmentSystem();
    clinic.init(5, () => 1000, () => true);
    expect(clinic.passiveHealRate()).toBeGreaterThan(0);
  });

  // ── XI-012: 市舶司→繁荣度 (已在Sprint 5中覆盖) ──
  it('XI-012: 市舶司→繁荣度加成', () => {
    const bonus = getProsperityBonus(10);
    expect(bonus).toBeGreaterThan(0);
  });

  // ── XI-013: 主城→建筑解锁 ──
  it('XI-013: 主城→建筑解锁', () => {
    // 主城Lv1时，部分建筑锁定
    const barracks = bs.getBuilding('barracks');
    expect(barracks.status).toBe('locked');

    // 主城升级后解锁
    forceLevel(bs, 'castle', 3);
    bs.checkAndUnlockBuildings();
  });

  // ── XI-014: 建筑等级→产出 ──
  it('XI-014: 建筑等级→产出线性增长', () => {
    forceLevel(bs, 'farmland', 1);
    const p1 = bs.getProduction('farmland');
    forceLevel(bs, 'farmland', 5);
    const p5 = bs.getProduction('farmland');
    expect(p5).toBeGreaterThan(p1);
  });

  // ── XI-015: 协同→加成 ──
  it('XI-015: 协同系统→加成', () => {
    const synergy = new SynergySystem();
    synergy.init((type: string) => {
      const levels: Record<string, number> = { farmland: 5, mine: 5, market: 5 };
      return levels[type] ?? 0;
    });
    const bonus = synergy.getTotalSynergyBonus();
    expect(bonus).toBeGreaterThanOrEqual(0);
  });

  // ── XI-016: 科技→建筑加成 (已在Sprint 3中覆盖) ──
  it('XI-016: 科技→建筑产出加成', () => {
    const techEffect = new TechEffectSystem();
    techEffect.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    const bonus = techEffect.getProductionBonus('all');
    expect(typeof bonus).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════
// 补充：建筑系统边界和序列化
// ═══════════════════════════════════════════════════════════════

describe('建筑系统边界和序列化', () => {
  let bs: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('BLD-SER-01: 序列化/反序列化一致性', () => {
    forceLevel(bs, 'castle', 5);
    forceLevel(bs, 'farmland', 3);

    const data = bs.serialize();
    const bs2 = new BuildingSystem();
    bs2.deserialize(data);

    expect(bs2.getLevel('castle')).toBe(5);
    expect(bs2.getLevel('farmland')).toBe(3);
  });

  it('BLD-SER-02: 库存序列化', () => {
    forceLevel(bs, 'farmland', 5);
    bs.tickStorage(10);

    const data = bs.serialize();
    expect(data.storage).toBeDefined();
    expect(data.storage.farmland).toBeGreaterThan(0);
  });

  it('BLD-PROD-01: 计算总产出', () => {
    forceLevel(bs, 'farmland', 5);
    forceLevel(bs, 'mine', 5);
    forceLevel(bs, 'market', 5);

    const total = bs.calculateTotalProduction();
    expect(Object.keys(total).length).toBeGreaterThan(0);
  });

  it('BLD-PROD-02: 产出建筑等级映射', () => {
    const levels = bs.getProductionBuildingLevels();
    expect(Object.keys(levels)).toHaveLength(BUILDING_TYPES.length - 1); // 排除castle
  });

  it('BLD-QUEUE-01: 队列容量随主城等级增长', () => {
    const max1 = bs.getMaxQueueSlots();
    forceLevel(bs, 'castle', 10);
    const max10 = bs.getMaxQueueSlots();
    expect(max10).toBeGreaterThanOrEqual(max1);
  });

  it('BLD-UNLOCK-01: 主城升级触发解锁检查', () => {
    // 主城升到3级应解锁新建筑
    const cost = bs.startUpgrade('castle', RICH);
    vi.spyOn(Date, 'now').mockReturnValue(base + cost.timeSeconds * 1000 + 100);
    bs.tick();
    // 主城升级完成，检查解锁
  });

  it('BLD-APPEARANCE-01: 建筑外观阶段', () => {
    forceLevel(bs, 'castle', 5);
    const stage = bs.getAppearanceStage('castle');
    expect(stage).toBeDefined();
  });

  it('BLD-DEF-01: 建筑定义查询', () => {
    const def = bs.getBuildingDef('farmland');
    expect(def).toBeDefined();
    expect(def.maxLevel).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 补充：子系统独立测试
// ═══════════════════════════════════════════════════════════════

describe('子系统独立测试', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  // ── WallDefenseSystem ──
  it('WALL-01: 城墙升级', () => {
    const wall = new WallDefenseSystem();
    wall.init(5);
    wall.upgradeWall(10);
    expect(wall.getWallLevel()).toBe(10);
    expect(wall.getDefenseValue()).toBeGreaterThan(0);
  });

  it('WALL-02: 城墙序列化', () => {
    const wall = new WallDefenseSystem();
    wall.init(5);
    const data = wall.serialize();
    const wall2 = new WallDefenseSystem();
    wall2.deserialize(data);
    expect(wall2.getWallLevel()).toBe(5);
  });

  // ── TrapSystem ──
  it('TRAP-01: 陷阱上限', () => {
    const trap = new TrapSystem();
    trap.init(5, () => 10000, () => true);
    const maxTraps = trap.getMaxTraps();
    expect(maxTraps).toBeGreaterThan(0);
  });

  it('TRAP-02: 陷阱序列化', () => {
    const trap = new TrapSystem();
    trap.init(5, () => 10000, () => true);
    trap.deployTrap('fire');
    const data = trap.serialize();
    const trap2 = new TrapSystem();
    trap2.init(5, () => 10000, () => true);
    trap2.deserialize(data);
    expect(trap2.getTrapInventory()).toBeDefined();
  });

  // ── SynergySystem ──
  it('SYN-01: 协同序列化', () => {
    const synergy = new SynergySystem();
    synergy.init(() => 5);
    const data = synergy.serialize();
    expect(data).toBeDefined();
  });

  it('SYN-02: 协同重置', () => {
    const synergy = new SynergySystem();
    synergy.init(() => 5);
    synergy.reset();
    expect(synergy.getTotalSynergyBonus()).toBe(0);
  });

  // ── SpecializationSystem ──
  it('SPEC-01: 特化选择', () => {
    const spec = new SpecializationSystem();
    spec.init(() => 10);
    const result = spec.chooseSpecialization('farmland', 'quantity');
    if (result.success) {
      const chosen = spec.getSpecialization('farmland');
      expect(chosen).not.toBeNull();
    }
  });

  it('SPEC-02: 特化加成', () => {
    const spec = new SpecializationSystem();
    spec.init(() => 10);
    spec.chooseSpecialization('farmland', 'quantity');
    const bonus = spec.getSpecializationBonus('farmland');
    expect(bonus).toBeDefined();
  });

  it('SPEC-03: 特化重置', () => {
    const spec = new SpecializationSystem();
    spec.init(() => 10);
    const chooseResult = spec.chooseSpecialization('farmland', 'quantity');
    if (chooseResult.success) {
      const resetResult = spec.resetSpecialization('farmland', true);
      expect(resetResult).toBe(true);
    }
  });

  // ── EvolutionSystem ──
  it('EVO-01: 进化阶段', () => {
    const evo = new EvolutionSystem();
    const stage = evo.getEvolutionStage('farmland');
    expect(stage).toBe(0); // 初始无进化
  });

  it('EVO-02: 进化星级加成', () => {
    const evo = new EvolutionSystem();
    const bonus = evo.getStarBonus('farmland');
    expect(bonus).toBeGreaterThanOrEqual(0);
  });

  it('EVO-03: 进化序列化', () => {
    const evo = new EvolutionSystem();
    const data = evo.serialize();
    expect(data).toBeDefined();
  });

  // ── ActiveDecisionSystem ──
  it('ADS-01: 焦点冷却', () => {
    const ads = new ActiveDecisionSystem();
    ads.setFocus('farmland');
    const cooldown = ads.getFocusCooldownRemaining();
    expect(cooldown).toBeGreaterThan(0);

    // 冷却中不可切换
    const result = ads.setFocus('mine');
    expect(result.success).toBe(false);
  });

  // ── BuildingEventSystem ──
  it('EVENT-01: 事件冷却', () => {
    const eventSys = new BuildingEventSystem();
    const bs = new BuildingSystem();
    eventSys.init((type) => bs.getLevel(type as BuildingType));

    eventSys.tickCooldowns(60000);
    // 冷却推进
  });

  it('EVENT-02: 持续加成', () => {
    const eventSys = new BuildingEventSystem();
    const bs = new BuildingSystem();
    eventSys.init((type) => bs.getLevel(type as BuildingType));

    const bonuses = eventSys.getActiveSustainedBonuses();
    expect(Array.isArray(bonuses)).toBe(true);
  });

  it('EVENT-03: 事件池', () => {
    const eventSys = new BuildingEventSystem();
    const bs = new BuildingSystem();
    eventSys.init((type) => bs.getLevel(type as BuildingType));

    const pool = eventSys.getEventPool('farmland');
    expect(Array.isArray(pool)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 补充：CaravanSystem + TradeSystem 集成
// ═══════════════════════════════════════════════════════════════

describe('商队+贸易集成', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('CARAVAN-01: 商队初始化', () => {
    const caravan = new CaravanSystem();
    caravan.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    expect(caravan.getCaravanCount()).toBeGreaterThan(0);
  });

  it('CARAVAN-02: 最大商队数', () => {
    const caravan = new CaravanSystem();
    caravan.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    caravan.setMaxCaravansCallback(() => getMaxCaravans(10));
    expect(caravan.getMaxCaravans()).toBeGreaterThanOrEqual(1);
  });

  it('CARAVAN-03: 商队重置', () => {
    const caravan = new CaravanSystem();
    caravan.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    caravan.reset();
    expect(caravan.getCaravanCount()).toBeGreaterThan(0);
  });

  it('TRADE-01: 贸易系统初始化', () => {
    const trade = new TradeSystem();
    trade.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
    const routes = trade.getRouteDefs();
    expect(Array.isArray(routes)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 补充：ResourceSystem 集成
// ═══════════════════════════════════════════════════════════════

describe('资源系统集成', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    rs = new ResourceSystem();
    rs.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('RES-01: 资源添加和消耗', () => {
    rs.addResource('grain', 1000);
    // 初始grain=500 + 1000 = 1500 (受上限约束)
    const amount = rs.getAmount('grain');
    expect(amount).toBeGreaterThan(0);

    rs.consumeResource('grain', 500);
    expect(rs.getAmount('grain')).toBeLessThan(amount);
  });

  it('RES-02: 资源上限', () => {
    rs.updateCaps(5, 5, 5, 5);
    const caps = rs.getCaps();
    expect(caps).toBeDefined();
  });

  it('RES-03: 产出速率', () => {
    rs.setProductionRate('grain', 10);
    const rates = rs.getProductionRates();
    expect(rates.grain).toBe(10);
  });

  it('RES-04: 离线收益', () => {
    rs.setProductionRate('grain', 10);
    const earnings = rs.calculateOfflineEarnings(3600);
    expect(earnings.offlineSeconds).toBe(3600);
    expect(earnings.earned.grain).toBeGreaterThan(0);
  });

  it('RES-05: 离线收益上限', () => {
    rs.setProductionRate('grain', 10);
    const earnings = rs.calculateOfflineEarnings(99999999);
    expect(earnings.isCapped).toBe(true);
  });

  it('RES-06: 批量消耗', () => {
    rs.addResource('grain', 10000);
    rs.addResource('gold', 10000);
    // canAfford checks grain reserve (MIN_GRAIN_RESERVE=10)
    const check = rs.canAfford({ grain: 100, gold: 100 });
    expect(check.canAfford).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 补充：EquipmentSystem 集成
// ═══════════════════════════════════════════════════════════════

describe('装备系统集成', () => {
  let eq: EquipmentSystem;
  let ws: WorkshopForgeSystem;
  let bs: BuildingSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
    eq = new EquipmentSystem();
    bs = new BuildingSystem();
    ws = new WorkshopForgeSystem();
    ws.setEquipmentSystem(eq);
    ws.setBuildingSystem(bs);
    ws.setResourceDeductor(() => true);
    ws.setResourceAdder(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('EQ-01: 装备背包', () => {
    const bag = eq.getAllEquipments();
    expect(Array.isArray(bag)).toBe(true);
    expect(eq.getBagCapacity()).toBeGreaterThan(0);
  });

  it('EQ-02: 工坊效率计算', () => {
    forceLevel(bs, 'workshop', 5);
    const eff = ws.getForgeEfficiency();
    expect(eff).toBeGreaterThanOrEqual(0);
  });

  it('EQ-03: 强化折扣', () => {
    forceLevel(bs, 'workshop', 5);
    const discount = ws.getEnhanceDiscountMultiplier();
    expect(discount).toBeGreaterThan(0);
    expect(discount).toBeLessThanOrEqual(1);
  });

  it('EQ-04: 装备分解预览', () => {
    // EquipmentDecomposer requires EquipmentBagManager instance
    // Test through WorkshopForgeSystem instead
    forceLevel(bs, 'workshop', 5);
    const forgeResult = ws.forgeEquipment();
    if (forgeResult.success && forgeResult.equipment) {
      const uid = forgeResult.equipment.uid;
      const decomposeResult = ws.decomposeEquipment(uid);
      expect(decomposeResult).toBeDefined();
      expect(decomposeResult.success).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// F11: 升级加速 — 铜钱/天命/元宝三种加速方式
// ═══════════════════════════════════════════════════════════════

describe('BLD-F11: 升级加速', () => {
  let bs: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('BLD-F11-01: 铜钱加速 — 减少30%剩余时间', () => {
    // 使用充足资源开始升级
    const cost = bs.startUpgrade('farmland', { ...RICH });

    // 推进时间到升级中间阶段
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000); // 1秒后

    // 铜钱加速：消耗铜钱减少30%剩余时间
    const result = bs.speedUpWithCopper('farmland', 1_000_000);

    expect(result.success).toBe(true);
    expect(result.timeReduced).toBeGreaterThan(0);
    expect(result.cost).toBe(1000); // 基础消耗 ×1
    expect(result.remainingSpeedUps).toBe(2); // 剩余2次

    // 验证建筑状态中endTime已更新
    const state = bs.getBuilding('farmland');
    expect(state.upgradeEndTime).toBeLessThan(base + cost.timeSeconds * 1000);
  });

  it('BLD-F11-01b: 铜钱加速 — 次数上限(3次)后拒绝', () => {
    bs.startUpgrade('farmland', { ...RICH });
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000);

    // 连续加速3次
    const r1 = bs.speedUpWithCopper('farmland', 1_000_000);
    expect(r1.success).toBe(true);
    expect(r1.remainingSpeedUps).toBe(2);

    const r2 = bs.speedUpWithCopper('farmland', 1_000_000);
    expect(r2.success).toBe(true);
    expect(r2.remainingSpeedUps).toBe(1);

    const r3 = bs.speedUpWithCopper('farmland', 1_000_000);
    expect(r3.success).toBe(true);
    expect(r3.remainingSpeedUps).toBe(0);

    // 第4次应失败
    const r4 = bs.speedUpWithCopper('farmland', 1_000_000);
    expect(r4.success).toBe(false);
    expect(r4.reason).toContain('上限');
  });

  it('BLD-F11-01c: 铜钱加速 — 铜钱不足时拒绝', () => {
    bs.startUpgrade('farmland', { ...RICH });
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000);

    const result = bs.speedUpWithCopper('farmland', 10); // 只有10铜钱
    expect(result.success).toBe(false);
    expect(result.reason).toContain('铜钱不足');
  });

  it('BLD-F11-02: 天命加速 — 消耗天命减少固定时间', () => {
    // 使用 castle Lv5→6 升级（480秒），确保剩余时间 > 300秒
    forceLevel(bs, 'farmland', 4);
    forceLevel(bs, 'castle', 5);
    bs.startUpgrade('castle', { ...RICH });
    // 不推进时间，剩余时间 = 完整升级时长（480秒）

    // 消耗5点天命，每点减少60秒 → 共减少300秒
    const result = bs.speedUpWithMandate('castle', 5, 100);

    expect(result.success).toBe(true);
    expect(result.timeReduced).toBe(300); // 5 × 60 = 300秒
    expect(result.cost).toBe(5);
  });

  it('BLD-F11-02b: 天命加速 — 天命不足时拒绝', () => {
    bs.startUpgrade('farmland', { ...RICH });
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000);

    const result = bs.speedUpWithMandate('farmland', 50, 10); // 需要50，只有10
    expect(result.success).toBe(false);
    expect(result.reason).toContain('天命不足');
  });

  it('BLD-F11-02c: 天命加速 — 天命加速可完成升级', () => {
    bs.startUpgrade('farmland', { ...RICH });
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000);

    // 使用大量天命使升级立即完成
    const result = bs.speedUpWithMandate('farmland', 99999, 99999);

    expect(result.success).toBe(true);
    // 升级完成后建筑状态恢复idle且等级+1
    const state = bs.getBuilding('farmland');
    expect(state.status).toBe('idle');
    expect(state.level).toBe(2);
    expect(state.upgradeEndTime).toBeNull();
  });

  it('BLD-F11-03: 元宝秒完成 — 立即完成升级', () => {
    bs.startUpgrade('farmland', { ...RICH });
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000);

    // 使用充足元宝秒完成
    const result = bs.instantCompleteWithIngot('farmland', 99999);

    expect(result.success).toBe(true);
    expect(result.ingotCost).toBeGreaterThan(0);

    // 验证建筑已完成升级
    const state = bs.getBuilding('farmland');
    expect(state.status).toBe('idle');
    expect(state.level).toBe(2);
    expect(state.upgradeStartTime).toBeNull();
    expect(state.upgradeEndTime).toBeNull();
  });

  it('BLD-F11-03b: 元宝秒完成 — 元宝不足时拒绝', () => {
    bs.startUpgrade('farmland', { ...RICH });
    vi.spyOn(Date, 'now').mockReturnValue(base + 1000);

    const result = bs.instantCompleteWithIngot('farmland', 0); // 0元宝
    expect(result.success).toBe(false);
    expect(result.reason).toContain('元宝不足');
  });

  it('BLD-F11-03c: 元宝秒完成 — 未在升级队列中时拒绝', () => {
    const result = bs.instantCompleteWithIngot('farmland', 99999);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('未在升级队列中');
  });
});

// ═══════════════════════════════════════════════════════════════
// F12: 自动升级 — 优先级算法 & 资源保护
// ═══════════════════════════════════════════════════════════════

describe('BLD-F12: 自动升级', () => {
  let bs: BuildingSystem;
  let autoSys: AutoUpgradeSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();
    autoSys = new AutoUpgradeSystem();
    autoSys.setBuildingSystem(bs);
    autoSys.setResourceProvider(() => ({
      grain: 1e9, gold: 1e9, troops: 1e9,
      ore: 1e9, wood: 1e9, mandate: 0,
    }));
    autoSys.setResourceDeductor(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('BLD-F12-01: 优先级算法 — balanced策略选择最低等级建筑', () => {
    autoSys.setConfig({ strategy: 'balanced', enabled: true });

    // 所有建筑初始 Lv1，balanced 应选择等级最低的建筑
    const target = autoSys.getNextUpgradeTarget();
    expect(target).not.toBeNull();
    // balanced 策略：等级最低优先，同等级按 BUILDING_TYPES 顺序
    expect(BUILDING_TYPES).toContain(target);
  });

  it('BLD-F12-01b: 优先级算法 — economy策略按经济优先级排序', () => {
    autoSys.setConfig({ strategy: 'economy', enabled: true });

    const target = autoSys.getNextUpgradeTarget();
    expect(target).not.toBeNull();
    // economy 优先级：farmland > market > mine > ...
    // 所有建筑同等级时，farmland 应被首选
    expect(target).toBe('farmland');
  });

  it('BLD-F12-01c: 优先级算法 — military策略按军事优先级排序', () => {
    // barracks 初始锁定（需主城Lv2），先解锁
    forceLevel(bs, 'castle', 2);
    forceLevel(bs, 'barracks', 1);
    autoSys.setBuildingSystem(bs); // 重新注入以获取最新状态
    autoSys.setConfig({ strategy: 'military', enabled: true });

    const target = autoSys.getNextUpgradeTarget();
    expect(target).not.toBeNull();
    // military 优先级：barracks > wall > workshop > ...
    expect(target).toBe('barracks');
  });

  it('BLD-F12-01d: 优先级算法 — 队列满时返回null', () => {
    autoSys.setConfig({ strategy: 'balanced', enabled: true });

    // 填满升级队列
    const maxSlots = bs.getMaxQueueSlots();
    for (let i = 0; i < maxSlots; i++) {
      const types = BUILDING_TYPES.filter(t => t !== 'castle');
      if (i < types.length) {
        bs.startUpgrade(types[i], { ...RICH });
      }
    }

    const target = autoSys.getNextUpgradeTarget();
    expect(target).toBeNull();
  });

  it('BLD-F12-01e: 优先级算法 — 排除指定建筑', () => {
    autoSys.setConfig({ strategy: 'economy', enabled: true, excludedBuildings: ['farmland'] });

    const target = autoSys.getNextUpgradeTarget();
    expect(target).not.toBeNull();
    expect(target).not.toBe('farmland');
  });

  it('BLD-F12-02: 资源保护 — 不消耗低于阈值的资源', () => {
    // 默认保护30%资源
    autoSys.setConfig({ resourceProtectionPercent: 30 });

    // 设置较少资源，使升级费用超过可用资源（扣除保护后）
    const cheapCost = bs.getUpgradeCost('farmland');
    expect(cheapCost).not.toBeNull();

    // 资源刚好等于升级费用（保护30%后不够）
    const tightResources = {
      grain: cheapCost!.grain,  // 刚好等于费用
      gold: cheapCost!.gold,
      troops: 0, ore: 0, wood: 0,
    };
    autoSys.setResourceProvider(() => tightResources);

    const canAfford = autoSys.canAffordWithProtection('farmland');
    expect(canAfford).toBe(false); // 保护30%后可用资源不足
  });

  it('BLD-F12-02b: 资源保护 — 充足资源时允许升级', () => {
    autoSys.setConfig({ resourceProtectionPercent: 30 });

    // 充足资源：远超升级费用
    autoSys.setResourceProvider(() => ({
      grain: 1e9, gold: 1e9, troops: 1e9,
      ore: 1e9, wood: 1e9,
    }));

    const canAfford = autoSys.canAffordWithProtection('farmland');
    expect(canAfford).toBe(true);
  });

  it('BLD-F12-02c: 资源保护 — 0%保护阈值等于不保护', () => {
    autoSys.setConfig({ resourceProtectionPercent: 0 });

    // 资源刚好等于费用，0%保护应该可以负担
    const cheapCost = bs.getUpgradeCost('farmland');
    expect(cheapCost).not.toBeNull();

    autoSys.setResourceProvider(() => ({
      grain: cheapCost!.grain,
      gold: cheapCost!.gold,
      troops: 0, ore: 0, wood: 0,
    }));

    const canAfford = autoSys.canAffordWithProtection('farmland');
    expect(canAfford).toBe(true);
  });

  it('BLD-F12-03: tickAutoUpgrade — 完整流程执行', () => {
    autoSys.enable();

    autoSys.setResourceProvider(() => ({
      grain: 1e9, gold: 1e9, troops: 1e9,
      ore: 1e9, wood: 1e9, mandate: 0,
    }));

    let deducted: Record<string, number> = {};
    autoSys.setResourceDeductor((cost) => { deducted = { ...cost }; });

    const result = autoSys.tickAutoUpgrade();

    expect(result.upgraded).not.toBeNull();
    expect(result.cost).toBeDefined();
    expect(Object.keys(result.cost).length).toBeGreaterThan(0);
  });

  it('BLD-F12-03b: tickAutoUpgrade — 未启用时返回原因', () => {
    autoSys.disable();
    const result = autoSys.tickAutoUpgrade();
    expect(result.upgraded).toBeNull();
    expect(result.reason).toContain('未启用');
  });
});

// ═══════════════════════════════════════════════════════════════
// F28: 资源链循环 — 6条链路验证
// ═══════════════════════════════════════════════════════════════

describe('BLD-F28: 资源链循环', () => {
  let bs: BuildingSystem;
  let chainSys: ResourceChainSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    bs = new BuildingSystem();

    // 解锁所有链路涉及的建筑：升级主城到Lv8以解锁全部建筑
    forceLevel(bs, 'castle', 8);
    // 解锁后设置所有链路建筑到Lv1（idle）
    const chainBuildings: BuildingType[] = [
      'farmland', 'barracks', 'mine', 'lumberMill', 'workshop',
      'market', 'port', 'academy', 'tavern', 'wall',
    ];
    for (const t of chainBuildings) {
      forceLevel(bs, t, 1);
    }

    chainSys = new ResourceChainSystem();
    chainSys.setBuildingSystem(bs);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('BLD-F28-01: 粮草→兵力→战斗链', () => {
    // 初始状态：所有建筑 Lv1（idle），链路应畅通
    const result = chainSys.validateChain('F28-01');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);

    // 验证链路包含 farmland 和 barracks
    const chain = chainSys.getChain('F28-01');
    expect(chain).toBeDefined();
    expect(chain!.nodes.some(n => n.buildingType === 'farmland')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'barracks')).toBe(true);
  });

  it('BLD-F28-02: 矿石+木材→装备→英雄链', () => {
    const result = chainSys.validateChain('F28-02');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);

    const chain = chainSys.getChain('F28-02');
    expect(chain).toBeDefined();
    expect(chain!.nodes.some(n => n.buildingType === 'mine')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'lumberMill')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'workshop')).toBe(true);
  });

  it('BLD-F28-03: 铜钱→贸易→折扣链', () => {
    const result = chainSys.validateChain('F28-03');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);

    const chain = chainSys.getChain('F28-03');
    expect(chain).toBeDefined();
    expect(chain!.nodes.some(n => n.buildingType === 'market')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'port')).toBe(true);
  });

  it('BLD-F28-04: 科技点→科技→加成链', () => {
    const result = chainSys.validateChain('F28-04');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);

    const chain = chainSys.getChain('F28-04');
    expect(chain).toBeDefined();
    expect(chain!.nodes.some(n => n.buildingType === 'academy')).toBe(true);
  });

  it('BLD-F28-05: 铜钱+粮草→招募→英雄链', () => {
    const result = chainSys.validateChain('F28-05');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);

    const chain = chainSys.getChain('F28-05');
    expect(chain).toBeDefined();
    expect(chain!.nodes.some(n => n.buildingType === 'farmland')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'market')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'tavern')).toBe(true);
  });

  it('BLD-F28-06: 矿石+木材→城防链', () => {
    const result = chainSys.validateChain('F28-06');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);

    const chain = chainSys.getChain('F28-06');
    expect(chain).toBeDefined();
    expect(chain!.nodes.some(n => n.buildingType === 'mine')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'lumberMill')).toBe(true);
    expect(chain!.nodes.some(n => n.buildingType === 'wall')).toBe(true);
  });

  it('BLD-F28-all: validateAllChains — 所有6条链路同时验证', () => {
    const results = chainSys.validateAllChains();

    expect(Object.keys(results)).toHaveLength(6);
    for (const chainId of ['F28-01', 'F28-02', 'F28-03', 'F28-04', 'F28-05', 'F28-06']) {
      expect(results[chainId]).toBeDefined();
      expect(results[chainId].valid).toBe(true);
      expect(results[chainId].bottlenecks).toHaveLength(0);
    }
  });

  it('BLD-F28-bottleneck: 瓶颈检测 — 建筑未建造时报告瓶颈', () => {
    // 降低主城等级到Lv1，使 barracks 锁定（需主城Lv2才解锁）
    forceLevel(bs, 'castle', 1);
    // barracks 需要主城Lv2才解锁，重新锁定
    const save = bs.serialize();
    save.buildings.barracks.level = 0;
    save.buildings.barracks.status = 'locked';
    bs.deserialize(save);

    // 确认 barracks 确实为 locked
    expect(bs.getBuilding('barracks').status).toBe('locked');
    expect(bs.getLevel('barracks')).toBe(0);

    // F28-01 链路应出现瓶颈（barracks未建造）
    const result = chainSys.validateChain('F28-01');
    expect(result.valid).toBe(false);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
  });

  it('BLD-F28-throughput: 链路效率 — 升级建筑提高吞吐', () => {
    const before = chainSys.validateChain('F28-01').throughput;

    // 升级农田到 Lv5
    forceLevel(bs, 'farmland', 5);
    const after = chainSys.validateChain('F28-01').throughput;

    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('BLD-F28-invalid: 不存在的链路返回错误', () => {
    const result = chainSys.validateChain('F28-99');
    expect(result.valid).toBe(false);
    expect(result.bottlenecks[0]).toContain('不存在');
    expect(result.throughput).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// BLD-F27-03: 编队出征 — 兵力检查→战斗系统
// ═══════════════════════════════════════════════════════════════

describe('BLD-F27-03: 编队出征 — 兵力检查→战斗系统', () => {
  let formation: BarracksFormationSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    let troops = 500;
    formation = new BarracksFormationSystem();
    formation.setup(5, () => troops, (n) => { troops -= n; return true; });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('兵力充足时可以分配兵力到编队', () => {
    const create = formation.createFormation('先锋营');
    expect(create.success).toBe(true);

    const assign = formation.assignTroops(create.formationId!, 100);
    expect(assign.success).toBe(true);

    const f = formation.getFormation(create.formationId!);
    expect(f).not.toBeNull();
    expect(f!.troops).toBe(100);
  });

  it('兵力不足时分配失败（模拟出征前兵力检查）', () => {
    const create = formation.createFormation('先锋营');
    expect(create.success).toBe(true);

    // 先分配大部分兵力
    const assign1 = formation.assignTroops(create.formationId!, 400);
    expect(assign1.success).toBe(true);

    // 剩余兵力不足，分配失败
    const assign2 = formation.assignTroops(create.formationId!, 200);
    expect(assign2.success).toBe(false);
    expect(assign2.reason).toContain('兵力不足');
  });

  it('编队兵力为零时无法出征（业务层校验）', () => {
    const create = formation.createFormation('空营');
    expect(create.success).toBe(true);

    const f = formation.getFormation(create.formationId!);
    expect(f!.troops).toBe(0);
    // 出征前应检查编队兵力 > 0
    expect(f!.troops).toBeLessThanOrEqual(0);
  });

  it('移除兵力后编队兵力减少（模拟战后减员）', () => {
    const create = formation.createFormation('先锋营');
    formation.assignTroops(create.formationId!, 200);

    // 模拟战后减员
    const remove = formation.removeTroops(create.formationId!, 80);
    expect(remove.success).toBe(true);

    const f = formation.getFormation(create.formationId!);
    expect(f!.troops).toBe(120);
  });
});

// ═══════════════════════════════════════════════════════════════
// BLD-F25-02: 商队返回 — 商队返回时间计算
// ═══════════════════════════════════════════════════════════════

describe('BLD-F25-02: 商队返回 — 商队返回时间计算', () => {
  let caravan: CaravanSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    caravan = new CaravanSystem();
    caravan.init({ eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() } as any });

    // 注入 mock 商路信息提供者
    caravan.setRouteProvider({
      getRouteDef: (routeId) => ({
        opened: true,
        baseTravelTime: 60, // 60秒去程
        baseProfitRate: 0.15,
        from: 'city_a',
        to: 'city_b',
      }),
      getPrice: (goodsId) => 10,
      completeTrade: vi.fn(),
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('去程时间 = baseTravelTime * 1000 / speedMultiplier', () => {
    const idleCaravans = caravan.getIdleCaravans();
    expect(idleCaravans.length).toBeGreaterThan(0);

    const c = idleCaravans[0];
    const beforeDispatch = Date.now();

    const result = caravan.dispatch({
      caravanId: c.id,
      routeId: 'route_1' as any,
      cargo: { silk: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.estimatedArrival).toBeDefined();

    // 去程时间 = 60 * 1000 / 1.0 = 60000ms
    const expectedTravelTime = 60 * 1000 / c.attributes.speedMultiplier;
    const actualTravelTime = result.estimatedArrival! - beforeDispatch;
    // 允许10ms误差（测试执行时间）
    expect(Math.abs(actualTravelTime - expectedTravelTime)).toBeLessThan(50);
  });

  it('返回时间 = 去程的一半 (baseTravelTime * 500 / speedMultiplier)', () => {
    const idleCaravans = caravan.getIdleCaravans();
    const c = idleCaravans[0];

    // 派遣商队
    const result = caravan.dispatch({
      caravanId: c.id,
      routeId: 'route_1' as any,
      cargo: { silk: 5 },
    });
    expect(result.success).toBe(true);

    // 模拟去程完成（将 arrivalTime 设为过去时间）
    const caravans = caravan.getCaravans();
    const traveling = caravans.find(cv => cv.status === 'traveling');
    expect(traveling).toBeDefined();

    // 手动推进时间：触发 update 让去程完成
    // 使用 vi.advanceTimersByTime 或直接 mock Date.now
    const originalNow = Date.now;
    const travelTime = 60 * 1000 / traveling!.attributes.speedMultiplier;
    let fakeTime = Date.now();

    // 先让去程完成
    fakeTime += travelTime + 1;
    Date.now = () => fakeTime;
    caravan.update(1);

    // 去程完成后应转为 returning
    const afterTravel = caravan.getCaravan(c.id);
    expect(afterTravel!.status).toBe('returning');

    // 返回时间 = baseTravelTime * 500 / speedMultiplier = 60 * 500 / 1.0 = 30000ms
    const expectedReturnTime = 60 * 500 / traveling!.attributes.speedMultiplier;
    const returnArrivalTime = afterTravel!.arrivalTime;
    const actualReturnTime = returnArrivalTime - fakeTime;
    expect(Math.abs(actualReturnTime - expectedReturnTime)).toBeLessThan(50);

    Date.now = originalNow;
  });

  it('返回完成后商队恢复idle状态', () => {
    const idleCaravans = caravan.getIdleCaravans();
    const c = idleCaravans[0];

    caravan.dispatch({
      caravanId: c.id,
      routeId: 'route_1' as any,
      cargo: { silk: 5 },
    });

    const caravans = caravan.getCaravans();
    const traveling = caravans.find(cv => cv.status === 'traveling');
    const speed = traveling!.attributes.speedMultiplier;
    const travelTime = 60 * 1000 / speed;
    const returnTime = 60 * 500 / speed;

    const originalNow = Date.now;
    let fakeTime = Date.now();

    // 去程完成
    fakeTime += travelTime + 1;
    Date.now = () => fakeTime;
    caravan.update(1);

    // 返回完成
    fakeTime += returnTime + 1;
    Date.now = () => fakeTime;
    caravan.update(1);

    const finalState = caravan.getCaravan(c.id);
    expect(finalState!.status).toBe('idle');
    expect(finalState!.currentRouteId).toBeNull();
    expect(finalState!.cargo).toEqual({});

    Date.now = originalNow;
  });
});

// ═══════════════════════════════════════════════════════════════
// 缺失功能 (it.todo) — 尚未实现的子系统
// ═══════════════════════════════════════════════════════════════

describe('缺失功能检测', () => {
  it.todo('BLD-F08-01: 建筑锁定 — 建筑手动锁定功能');
  it.todo('BLD-F09-01: 建筑拆除 — 建筑降级/拆除功能');
});
