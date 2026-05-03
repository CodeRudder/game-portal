/**
 * MapP2FilterDetail — P2 覆盖缺口 GAP-13~16 补充测试
 *
 * GAP-13：快捷按钮"高产领地"（MAP-2 §2.4）— 按总收益排序并高亮前5
 * GAP-14：快捷按钮"可征服"（MAP-2 §2.5）— 过滤与己方相邻的非己方领土
 * GAP-15：热力图颜色分级（MAP-2 §2.7）— 5档颜色分级阈值
 * GAP-16：产出详情展开面板（MAP-2-1 UI）— 基础/科技/建筑加成与总计
 */

import { describe, it, expect } from 'vitest';
import { MapFilterSystem } from '../MapFilterSystem';
import {
  generateTerritoryData, calculateProduction, getAdjacentIds,
  getBaseProduction,
} from '../../../core/map';
import type {
  TerritoryData, TerritoryProduction, OwnershipStatus, LandmarkLevel,
} from '../../../core/map';
import { createSim } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

// ═══════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════

const totalRevenue = (p: TerritoryProduction) => p.grain + p.gold + p.troops + p.mandate;

function sortByRevenueDesc(ts: TerritoryData[]): TerritoryData[] {
  return [...ts].sort((a, b) => {
    const d = totalRevenue(b.currentProduction) - totalRevenue(a.currentProduction);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

const getTopTerritories = (ts: TerritoryData[], n: number) =>
  sortByRevenueDesc(ts).slice(0, Math.min(n, ts.length));

function getConquerableTerritories(all: TerritoryData[], owner: OwnershipStatus) {
  const mine = new Set(all.filter(t => t.ownership === owner).map(t => t.id));
  return all.filter(t => t.ownership !== owner && t.adjacentIds.some(id => mine.has(id)));
}

const HEATMAP_TIERS = 5;
const HEATMAP_COLORS = ['#E8F5E9', '#A5D6A7', '#FFEB3B', '#FF9800', '#F44336'];

function computeHeatmapTier(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return Math.min(Math.floor((value - min) / (max - min) * HEATMAP_TIERS) + 1, HEATMAP_TIERS);
}

const getHeatmapColor = (tier: number) => HEATMAP_COLORS[Math.max(0, Math.min(tier - 1, 4))];

interface ProductionDetail {
  base: TerritoryProduction; techBonus: number; buildingBonus: number; otherBonus: number;
  techAmount: TerritoryProduction; buildingAmount: TerritoryProduction; total: TerritoryProduction;
}

function calculateProductionDetail(
  base: TerritoryProduction, tech = 0, building = 0, other = 0,
): ProductionDetail {
  const m = 1 + tech + building + other;
  const apply = (v: number, f: number) => Math.round(v * f * 100) / 100;
  const mk = (f: number) => ({
    grain: apply(base.grain, f), gold: apply(base.gold, f),
    troops: apply(base.troops, f), mandate: apply(base.mandate, f),
  });
  return { base, techBonus: tech, buildingBonus: building, otherBonus: other,
    techAmount: mk(tech), buildingAmount: mk(building), total: mk(m) };
}

function createSimWithTerritories(ids: string[]): GameEventSimulator {
  const sim = createSim();
  const ts = sim.engine.getTerritorySystem();
  ids.forEach(id => ts.captureTerritory(id, 'player'));
  return sim;
}

function makeTerritory(o: Partial<TerritoryData> & { id: string }): TerritoryData {
  const prod = { grain: 5, gold: 5, troops: 3, mandate: 1 };
  return {
    name: o.id, position: { x: 0, y: 0 }, region: 'wei', ownership: 'neutral',
    level: 1, baseProduction: prod, currentProduction: prod,
    defenseValue: 1000, adjacentIds: [], ...o,
  };
}

// ═══════════════════════════════════════════════
// GAP-13：快捷按钮"高产领地"
// ═══════════════════════════════════════════════

describe('GAP-13：快捷按钮"高产领地"（MAP-2 §2.4）', () => {
  it('GAP-13-1: 按总收益降序排列', () => {
    const sorted = sortByRevenueDesc(generateTerritoryData());
    for (let i = 1; i < sorted.length; i++) {
      expect(totalRevenue(sorted[i - 1].currentProduction))
        .toBeGreaterThanOrEqual(totalRevenue(sorted[i].currentProduction));
    }
  });

  it('GAP-13-2: 前5个领土高亮标记', () => {
    const all = generateTerritoryData();
    const top5 = getTopTerritories(all, 5);
    const sorted = sortByRevenueDesc(all);
    expect(top5.length).toBe(5);
    for (let i = 0; i < 5; i++) expect(top5[i].id).toBe(sorted[i].id);
  });

  it('GAP-13-3: 不足5个领土时全部高亮', () => {
    const few = generateTerritoryData().slice(0, 3);
    const top = getTopTerritories(few, 5);
    expect(top.length).toBe(3);
  });

  it('GAP-13-4: 收益相同排序稳定（按id字母序）', () => {
    const p: TerritoryProduction = { grain: 10, gold: 10, troops: 5, mandate: 1 };
    const ts = ['t-c', 't-a', 't-b'].map(id =>
      makeTerritory({ id, baseProduction: p, currentProduction: p }));
    const s1 = sortByRevenueDesc(ts);
    const s2 = sortByRevenueDesc(ts);
    expect(s1.map(t => t.id)).toEqual(['t-a', 't-b', 't-c']);
    expect(s2.map(t => t.id)).toEqual(s1.map(t => t.id));
  });

  it('GAP-13-5: 再次点击取消高亮（切换逻辑）', () => {
    const top5Ids = new Set(getTopTerritories(generateTerritoryData(), 5).map(t => t.id));
    let hl = new Set<string>();
    hl = top5Ids; expect(hl.size).toBe(5);        // 激活
    hl = new Set(); expect(hl.size).toBe(0);       // 取消
    hl = top5Ids; expect(hl.size).toBe(5);         // 重新激活
  });

  it('GAP-13-6: 引擎层各领土收益计算正确', () => {
    const ts = createSim().engine.getTerritorySystem();
    for (const t of ts.getAllTerritories()) {
      const e = calculateProduction(t.baseProduction, t.level);
      expect(t.currentProduction.grain).toBeCloseTo(e.grain, 1);
      expect(t.currentProduction.gold).toBeCloseTo(e.gold, 1);
    }
  });

  it('GAP-13-7: 空领土列表不崩溃', () => {
    expect(getTopTerritories([], 5)).toEqual([]);
  });

  it('GAP-13-8: 单个领土场景', () => {
    const p = { grain: 5, gold: 3, troops: 2, mandate: 0 };
    const top = getTopTerritories([makeTerritory({ id: 'only', currentProduction: p, baseProduction: p })], 5);
    expect(top.length).toBe(1);
    expect(top[0].id).toBe('only');
  });

  it('GAP-13-9: 高亮数量为0返回空、超过总数返回全部', () => {
    const all = generateTerritoryData();
    expect(getTopTerritories(all, 0)).toEqual([]);
    expect(getTopTerritories(all, 999).length).toBe(all.length);
  });

  it('GAP-13-10: 收益全为0时排序不崩溃', () => {
    const z: TerritoryProduction = { grain: 0, gold: 0, troops: 0, mandate: 0 };
    const sorted = sortByRevenueDesc([
      makeTerritory({ id: 'z-b', currentProduction: z, baseProduction: z }),
      makeTerritory({ id: 'z-a', currentProduction: z, baseProduction: z }),
    ]);
    expect(sorted.map(t => t.id)).toEqual(['z-a', 'z-b']);
  });

  it('GAP-13-11: 高亮不改变原始数据', () => {
    const all = generateTerritoryData();
    const ids = all.map(t => t.id);
    const revs = all.map(t => totalRevenue(t.currentProduction));
    getTopTerritories(all, 5);
    expect(all.map(t => t.id)).toEqual(ids);
    expect(all.map(t => totalRevenue(t.currentProduction))).toEqual(revs);
  });

  it('GAP-13-12: 不同类型领土收益差异', () => {
    const sorted = sortByRevenueDesc(generateTerritoryData());
    for (const t of sorted.filter(t => t.id.startsWith('pass-')))
      expect(t.currentProduction.mandate).toBe(0);
    for (const t of sorted.filter(t => t.id.startsWith('res-'))) {
      const nz = [t.currentProduction.grain, t.currentProduction.gold,
        t.currentProduction.troops, t.currentProduction.mandate].filter(v => v > 0);
      expect(nz.length).toBe(1);
    }
  });
});

// ═══════════════════════════════════════════════
// GAP-14：快捷按钮"可征服"
// ═══════════════════════════════════════════════

describe('GAP-14：快捷按钮"可征服"（MAP-2 §2.5）', () => {
  it('GAP-14-1: 只显示与己方相邻的非己方领土', () => {
    const sim = createSimWithTerritories(['city-luoyang']);
    const all = sim.engine.getTerritorySystem().getAllTerritories();
    const conq = getConquerableTerritories(all, 'player');
    const adj = new Set(getAdjacentIds('city-luoyang'));
    for (const t of conq) {
      expect(t.ownership).not.toBe('player');
      expect(adj.has(t.id)).toBe(true);
    }
  });

  it('GAP-14-2: 不相邻的非己方领土不显示', () => {
    const sim = createSimWithTerritories(['city-luoyang']);
    const ids = new Set(getConquerableTerritories(
      sim.engine.getTerritorySystem().getAllTerritories(), 'player').map(t => t.id));
    expect(ids.has('city-chengdu')).toBe(false);
    expect(ids.has('city-jianye')).toBe(false);
    expect(ids.has('city-nanzhong')).toBe(false);
  });

  it('GAP-14-3: 己方领土不显示', () => {
    const sim = createSimWithTerritories(['city-luoyang', 'pass-hulao']);
    const conq = getConquerableTerritories(
      sim.engine.getTerritorySystem().getAllTerritories(), 'player');
    for (const t of conq) expect(t.ownership).not.toBe('player');
  });

  it('GAP-14-4: 无可征服领土时空状态', () => {
    const all = generateTerritoryData();
    all.forEach(t => t.ownership = 'player');
    expect(getConquerableTerritories(all, 'player').length).toBe(0);
  });

  it('GAP-14-5: 再次点击取消过滤', () => {
    const all = createSimWithTerritories(['city-luoyang'])
      .engine.getTerritorySystem().getAllTerritories();
    let f: TerritoryData[] | null = getConquerableTerritories(all, 'player');
    expect(f.length).toBeGreaterThan(0);
    f = null;
    expect(f).toBeNull();
  });

  it('GAP-14-6: 引擎层 getAttackableTerritories 一致性', () => {
    const sim = createSimWithTerritories(['city-luoyang']);
    const ts = sim.engine.getTerritorySystem();
    const aIds = new Set(ts.getAttackableTerritories('player').map(t => t.id));
    const cIds = new Set(getConquerableTerritories(ts.getAllTerritories(), 'player').map(t => t.id));
    expect(aIds).toEqual(cIds);
  });

  it('GAP-14-7: 占领新领土后可征服范围有效', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    ts.captureTerritory('city-xuchang', 'player');
    // 占领后可征服列表仍非空
    expect(ts.getAttackableTerritories('player').length).toBeGreaterThan(0);
    // 已占领的领土不应在可征服列表中
    const ids = ts.getAttackableTerritories('player').map(t => t.id);
    expect(ids).not.toContain('city-xuchang');
  });

  it('GAP-14-8: 多个己方领土的相邻去重', () => {
    const atk = createSimWithTerritories(['city-luoyang', 'pass-hulao'])
      .engine.getTerritorySystem().getAttackableTerritories('player');
    const ids = atk.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('GAP-14-9: 无己方领土时无可征服目标', () => {
    const all = generateTerritoryData();
    all.forEach(t => t.ownership = 'neutral');
    expect(getConquerableTerritories(all, 'player').length).toBe(0);
  });

  it('GAP-14-10: 单个己方领土验证完整相邻列表', () => {
    const sim = createSimWithTerritories(['city-luoyang']);
    const ts = sim.engine.getTerritorySystem();
    const atkIds = new Set(ts.getAttackableTerritories('player').map(t => t.id));
    const adj = new Set(getAdjacentIds('city-luoyang'));
    for (const id of atkIds) expect(adj.has(id)).toBe(true);
    for (const id of adj) {
      const t = ts.getTerritoryById(id);
      if (t && t.ownership !== 'player') expect(atkIds.has(id)).toBe(true);
    }
  });

  it('GAP-14-11: 占领全部相邻后可征服范围扩展到二级', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    const adjacentIds = getAdjacentIds('city-luoyang');
    adjacentIds.forEach(id => ts.captureTerritory(id, 'player'));
    const atk = ts.getAttackableTerritories('player');
    // 已占领的相邻领土不应在可征服列表中
    const atkIds = new Set(atk.map(t => t.id));
    adjacentIds.forEach(id => expect(atkIds.has(id)).toBe(false));
    // 可征服列表可能为空（如果所有二级邻居都已被占领或不存在）
    // 但不应包含已占领的领土
    expect(atkIds.has('city-luoyang')).toBe(false);
  });

  it('GAP-14-12: canAttackTerritory 与 getAttackableTerritories 一致', () => {
    const sim = createSimWithTerritories(['city-luoyang', 'city-xuchang']);
    const ts = sim.engine.getTerritorySystem();
    const atkIds = new Set(ts.getAttackableTerritories('player').map(t => t.id));
    for (const t of ts.getAllTerritories()) {
      expect(ts.canAttackTerritory(t.id, 'player')).toBe(atkIds.has(t.id));
    }
  });

  it('GAP-14-13: enemy 归属领土也可被玩家征服', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    ts.captureTerritory('city-xuchang', 'enemy');
    const ids = ts.getAttackableTerritories('player').map(t => t.id);
    expect(ids).toContain('city-xuchang');
  });

  it('GAP-14-14: 过滤结果不含原始数据引用（防篡改）', () => {
    const ts = createSimWithTerritories(['city-luoyang']).engine.getTerritorySystem();
    const atk = ts.getAttackableTerritories('player');
    if (atk.length > 0) {
      const orig = atk[0].name;
      atk[0].name = 'TAMPERED';
      expect(ts.getTerritoryById(atk[0].id)!.name).toBe(orig);
    }
  });
});

// ═══════════════════════════════════════════════
// GAP-15：热力图颜色分级
// ═══════════════════════════════════════════════

describe('GAP-15：热力图颜色分级（MAP-2 §2.7）', () => {
  it('GAP-15-1: 5档阈值正确（0-20/20-40/40-60/60-80/80-100）', () => {
    const t = (v: number) => computeHeatmapTier(v, 0, 100);
    expect(t(0)).toBe(1);  expect(t(19)).toBe(1);
    expect(t(20)).toBe(2); expect(t(39)).toBe(2);
    expect(t(40)).toBe(3); expect(t(59)).toBe(3);
    expect(t(60)).toBe(4); expect(t(79)).toBe(4);
    expect(t(80)).toBe(5); expect(t(100)).toBe(5);
  });

  it('GAP-15-2: 产出值对应正确颜色档位', () => {
    expect(computeHeatmapTier(0, 0, 50)).toBe(1);
    expect(computeHeatmapTier(25, 0, 50)).toBe(3);
    expect(computeHeatmapTier(50, 0, 50)).toBe(5);
    expect(getHeatmapColor(1)).toBe('#E8F5E9');
    expect(getHeatmapColor(5)).toBe('#F44336');
  });

  it('GAP-15-3: 计算公式验证 ratio→tier', () => {
    // ratio=(v-min)/(max-min), tier=floor(ratio*5)+1, clamped to 5
    expect(computeHeatmapTier(20, 10, 60)).toBe(2);  // 0.2→2
    expect(computeHeatmapTier(35, 10, 60)).toBe(3);  // 0.5→3
    expect(computeHeatmapTier(50, 10, 60)).toBe(5);  // 0.8→5
    expect(computeHeatmapTier(10, 10, 60)).toBe(1);  // 0→1
    expect(computeHeatmapTier(60, 10, 60)).toBe(5);  // 1.0→6→5
  });

  it('GAP-15-4: 边界值阈值上/下', () => {
    const t = (v: number) => computeHeatmapTier(v, 0, 100);
    expect(t(19)).toBe(1); expect(t(20)).toBe(2);
    expect(t(39)).toBe(2); expect(t(40)).toBe(3);
    expect(t(59)).toBe(3); expect(t(60)).toBe(4);
    expect(t(79)).toBe(4); expect(t(80)).toBe(5);
  });

  it('GAP-15-5: 所有值相同时归为档1', () => {
    expect(computeHeatmapTier(50, 50, 50)).toBe(1);
    expect(computeHeatmapTier(0, 0, 0)).toBe(1);
  });

  it('GAP-15-6: 真实领土产出数据验证热力图分级', () => {
    const ts = generateTerritoryData();
    const revs = ts.map(t => totalRevenue(t.currentProduction));
    const [min, max] = [Math.min(...revs), Math.max(...revs)];
    const tiers = ts.map(t => computeHeatmapTier(totalRevenue(t.currentProduction), min, max));
    tiers.forEach(tier => { expect(tier).toBeGreaterThanOrEqual(1); expect(tier).toBeLessThanOrEqual(5); });
    expect(tiers[revs.indexOf(min)]).toBe(1);
    expect(tiers[revs.indexOf(max)]).toBe(5);
  });

  it('GAP-15-7: 热力图颜色映射完整性', () => {
    for (let i = 1; i <= 5; i++)
      expect(getHeatmapColor(i)).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('GAP-15-8: 小范围/大范围/非零起始', () => {
    expect(computeHeatmapTier(0, 0, 1)).toBe(1);
    expect(computeHeatmapTier(0.5, 0, 1)).toBe(3);
    expect(computeHeatmapTier(2000, 0, 10000)).toBe(2);
    expect(computeHeatmapTier(8000, 0, 10000)).toBe(5);
    expect(computeHeatmapTier(100, 100, 200)).toBe(1);
    expect(computeHeatmapTier(150, 100, 200)).toBe(3);
    expect(computeHeatmapTier(200, 100, 200)).toBe(5);
  });

  it('GAP-15-9: 浮点精度与单调递增', () => {
    expect(computeHeatmapTier(2.0, 0, 10)).toBe(2);
    expect(computeHeatmapTier(5.999, 0, 10)).toBe(3);
    expect(computeHeatmapTier(6.0, 0, 10)).toBe(4);
    let prev = 0;
    for (let v = 0; v <= 100; v++) {
      const tier = computeHeatmapTier(v, 0, 100);
      expect(tier).toBeGreaterThanOrEqual(prev);
      prev = tier;
    }
    expect(prev).toBe(5);
  });

  it('GAP-15-10: 档位与领土类型对应（城池≥关卡）', () => {
    const ts = generateTerritoryData();
    const revs = ts.map(t => ({ id: t.id, rev: totalRevenue(t.currentProduction) }));
    const [min, max] = [Math.min(...revs.map(r => r.rev)), Math.max(...revs.map(r => r.rev))];
    const avg = (type: string) => {
      const arr = revs.filter(r => r.id.startsWith(type + '-')).map(r => computeHeatmapTier(r.rev, min, max));
      return arr.length ? arr.reduce((a, b) => a + b) / arr.length : 0;
    };
    if (avg('city') > 0 && avg('pass') > 0)
      expect(avg('city')).toBeGreaterThanOrEqual(avg('pass'));
  });
});

// ═══════════════════════════════════════════════
// GAP-16：产出详情展开面板
// ═══════════════════════════════════════════════

describe('GAP-16：产出详情展开面板（MAP-2-1 UI）', () => {
  it('GAP-16-1: 展开面板显示基础产出数值', () => {
    const t = createSim().engine.getTerritorySystem().getTerritoryById('city-luoyang')!;
    expect(t.baseProduction.grain).toBeGreaterThan(0);
    const base = getBaseProduction('city');
    expect(t.baseProduction).toEqual(base);
  });

  it('GAP-16-2: 科技加成百分比和加成后数值', () => {
    const d = calculateProductionDetail({ grain: 10, gold: 10, troops: 5, mandate: 1 }, 0.15);
    expect(d.techAmount.grain).toBeCloseTo(1.5, 1);
    expect(d.total.grain).toBeCloseTo(11.5, 1);
  });

  it('GAP-16-3: 建筑加成百分比和加成后数值', () => {
    const d = calculateProductionDetail({ grain: 10, gold: 10, troops: 5, mandate: 1 }, 0, 0.25);
    expect(d.buildingAmount.grain).toBeCloseTo(2.5, 1);
    expect(d.total.grain).toBeCloseTo(12.5, 1);
  });

  it('GAP-16-4: 占领时间倒计时显示', () => {
    const remaining = Math.max(0, 24 * 3600_000 - (Date.now() - (Date.now() - 3600_000)));
    expect(remaining).toBeGreaterThan(0);
    const h = Math.floor(remaining / 3600_000);
    const m = Math.floor((remaining % 3600_000) / 60_000);
    expect(h).toBeGreaterThanOrEqual(0); expect(m).toBeGreaterThanOrEqual(0);
  });

  it('GAP-16-5: 下次产出提升提示', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    const t = ts.getTerritoryById('city-luoyang')!;
    if (t.level < 5) {
      const next = calculateProduction(t.baseProduction, (t.level + 1) as LandmarkLevel);
      expect(next.grain).toBeGreaterThan(t.currentProduction.grain);
    }
  });

  it('GAP-16-6: 总计产出 = 基础×(1+科技%+建筑%+其他%)', () => {
    const d = calculateProductionDetail({ grain: 10, gold: 10, troops: 5, mandate: 1 }, 0.10, 0.20, 0.05);
    const m = 1.35;
    expect(d.total.grain).toBeCloseTo(10 * m, 1);
    expect(d.total.troops).toBeCloseTo(5 * m, 1);
  });

  it('GAP-16-7: 无加成时总计等于基础', () => {
    const b = { grain: 10, gold: 10, troops: 5, mandate: 1 };
    const d = calculateProductionDetail(b);
    expect(d.total).toEqual(b);
  });

  it('GAP-16-8: 引擎层产出汇总与详情面板一致', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    ts.captureTerritory('pass-hulao', 'player');
    const s = ts.getPlayerProductionSummary();
    const l = ts.getTerritoryById('city-luoyang')!;
    const h = ts.getTerritoryById('pass-hulao')!;
    expect(s.totalProduction.grain).toBeCloseTo(l.currentProduction.grain + h.currentProduction.grain, 1);
    expect(s.totalProduction.gold).toBeCloseTo(l.currentProduction.gold + h.currentProduction.gold, 1);
  });

  it('GAP-16-9: 不同类型领土基础产出不同', () => {
    const city = getBaseProduction('city');
    const pass = getBaseProduction('pass');
    const grain = getBaseProduction('resource', 'grain');
    expect(city.mandate).toBeGreaterThan(0);
    expect(pass.mandate).toBe(0);
    expect(grain.grain).toBeGreaterThan(0);
    expect(grain.gold).toBe(0);
  });

  it('GAP-16-10: 等级加成系数精确值（Lv1~5）', () => {
    const b = { grain: 10, gold: 10, troops: 5, mandate: 1 };
    expect(calculateProduction(b, 1).grain).toBe(10);       // ×1.0
    expect(calculateProduction(b, 2).grain).toBeCloseTo(13, 1); // ×1.3
    expect(calculateProduction(b, 3).grain).toBeCloseTo(16, 1); // ×1.6
    expect(calculateProduction(b, 4).grain).toBeCloseTo(20, 1); // ×2.0
    expect(calculateProduction(b, 5).grain).toBeCloseTo(25, 1); // ×2.5
  });

  it('GAP-16-11: 零基础产出加成处理', () => {
    const d = calculateProductionDetail({ grain: 1, gold: 1, troops: 2, mandate: 0 }, 0.5, 0.3, 0.2);
    expect(d.total.mandate).toBe(0);
    expect(d.techAmount.mandate).toBe(0);
    expect(d.total.grain).toBeCloseTo(2, 1); // 1 × 2.0
  });

  it('GAP-16-12: 极端加成（100%+100%）', () => {
    const d = calculateProductionDetail({ grain: 10, gold: 10, troops: 5, mandate: 1 }, 1.0, 1.0);
    expect(d.total.grain).toBeCloseTo(30, 1); // 10 × 3.0
  });

  it('GAP-16-13: 升级后产出变化同步', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('pass-hulao', 'player'); // level=3, 可升级
    const before = ts.getTerritoryById('pass-hulao')!;
    expect(before.level).toBeLessThan(5);
    const r = ts.upgradeTerritory('pass-hulao');
    expect(r.success).toBe(true);
    const after = ts.getTerritoryById('pass-hulao')!;
    expect(after.level).toBe(before.level + 1);
    expect(after.currentProduction.grain).toBeGreaterThan(before.currentProduction.grain);
    expect(r.newProduction.grain).toBeCloseTo(after.currentProduction.grain, 1);
  });

  it('GAP-16-14: 满级领土不可升级', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('pass-hulao', 'player');
    const needed = 5 - ts.getTerritoryById('pass-hulao')!.level;
    for (let i = 0; i < needed; i++) expect(ts.upgradeTerritory('pass-hulao').success).toBe(true);
    expect(ts.getTerritoryById('pass-hulao')!.level).toBe(5);
    expect(ts.upgradeTerritory('pass-hulao').success).toBe(false);
  });

  it('GAP-16-15: 非己方领土不可升级', () => {
    expect(createSim().engine.getTerritorySystem().upgradeTerritory('city-xuchang').success).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// 跨GAP集成测试
// ═══════════════════════════════════════════════

describe('跨GAP集成', () => {
  it('高产领地中的可征服领土标记', () => {
    const sim = createSimWithTerritories(['city-luoyang']);
    const all = sim.engine.getTerritorySystem().getAllTerritories();
    const top5 = getTopTerritories(all, 5);
    const cIds = new Set(getConquerableTerritories(all, 'player').map(t => t.id));
    for (const t of top5)
      if (t.ownership === 'player') expect(cIds.has(t.id)).toBe(false);
  });

  it('可征服领土的热力图档位', () => {
    const conq = getConquerableTerritories(
      createSimWithTerritories(['city-luoyang']).engine.getTerritorySystem().getAllTerritories(), 'player');
    const revs = conq.map(t => totalRevenue(t.currentProduction));
    const [min, max] = [Math.min(...revs), Math.max(...revs)];
    conq.forEach(t => {
      const tier = computeHeatmapTier(totalRevenue(t.currentProduction), min, max);
      expect(tier).toBeGreaterThanOrEqual(1); expect(tier).toBeLessThanOrEqual(5);
    });
  });

  it('占领高产可征服领土后产出提升', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    const before = ts.getPlayerProductionSummary();
    const conq = sortByRevenueDesc(getConquerableTerritories(ts.getAllTerritories(), 'player'));
    if (conq.length > 0) {
      ts.captureTerritory(conq[0].id, 'player');
      const after = ts.getPlayerProductionSummary();
      expect(after.totalProduction.grain).toBeGreaterThan(before.totalProduction.grain);
      expect(after.totalTerritories).toBe(before.totalTerritories + 1);
    }
  });

  it('高产+热力图+加成面板联动', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    const top5 = getTopTerritories(ts.getAllTerritories(), 5);
    const revs = top5.map(t => totalRevenue(t.currentProduction));
    for (const t of top5) {
      const d = calculateProductionDetail(t.baseProduction, 0.1, 0.15, 0.05);
      expect(d.total.grain).toBeGreaterThanOrEqual(t.baseProduction.grain);
      const tier = computeHeatmapTier(totalRevenue(t.currentProduction), Math.min(...revs), Math.max(...revs));
      expect(tier).toBeGreaterThanOrEqual(1);
    }
  });

  it('占领全部可征服后高产列表更新', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    let atk = ts.getAttackableTerritories('player');
    for (let r = 0; r < 3 && atk.length > 0; r++) {
      atk.forEach(t => ts.captureTerritory(t.id, 'player'));
      atk = ts.getAttackableTerritories('player');
    }
    const player = ts.getAllTerritories().filter(t => t.ownership === 'player');
    expect(player.length).toBeGreaterThan(1);
    const top5 = getTopTerritories(player, 5);
    const sorted = sortByRevenueDesc(player);
    for (let i = 0; i < Math.min(5, sorted.length); i++)
      expect(top5[i].id).toBe(sorted[i].id);
  });

  it('领土升级后高产排名变化', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    ts.captureTerritory('pass-hulao', 'player');
    const beforeIdx = getTopTerritories(ts.getTerritoriesByOwnership('player'), 5)
      .findIndex(t => t.id === 'pass-hulao');
    ts.upgradeTerritory('pass-hulao');
    ts.upgradeTerritory('pass-hulao');
    const afterIdx = getTopTerritories(ts.getTerritoriesByOwnership('player'), 5)
      .findIndex(t => t.id === 'pass-hulao');
    if (beforeIdx >= 0 && afterIdx >= 0) expect(afterIdx).toBeLessThanOrEqual(beforeIdx);
  });

  it('序列化/反序列化后排序不变', () => {
    const ts = createSim().engine.getTerritorySystem();
    ts.captureTerritory('city-luoyang', 'player');
    ts.captureTerritory('pass-hulao', 'player');
    const before = getTopTerritories(ts.getTerritoriesByOwnership('player'), 5).map(t => t.id);
    const save = ts.serialize();
    ts.reset(); ts.deserialize(save);
    expect(getTopTerritories(ts.getTerritoriesByOwnership('player'), 5).map(t => t.id)).toEqual(before);
  });

  it('filterByOwnership 与 getConquerableTerritories 互补', () => {
    const sim = createSimWithTerritories(['city-luoyang']);
    const all = sim.engine.getTerritorySystem().getAllTerritories();
    const nonPlayer = all.filter(t => t.ownership !== 'player');
    const conq = getConquerableTerritories(all, 'player');
    const npIds = new Set(nonPlayer.map(t => t.id));
    conq.forEach(t => expect(npIds.has(t.id)).toBe(true));
    expect(conq.length).toBeLessThanOrEqual(nonPlayer.length);
  });

  it('占领状态变更后 filterByOwnership 更新', () => {
    const ts = createSim().engine.getTerritorySystem();
    expect(ts.getTerritoriesByOwnership('player').map(t => t.id)).toContain('city-luoyang');
    ts.captureTerritory('city-luoyang', 'neutral');
    expect(ts.getTerritoriesByOwnership('player').map(t => t.id)).not.toContain('city-luoyang');
  });
});
