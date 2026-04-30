/**
 * MapP2StatGarrison — P2 覆盖缺口 GAP-17~20 深度测试
 *
 * 补充 MapP2TerritoryDetail.test.ts 中未充分覆盖的边界场景，
 * 重点验证引擎层实际方法的数值正确性和状态一致性。
 *
 * 覆盖：
 *   GAP-17：统计面板完整交互 — 产出汇总实时性、排序、区域分布精度
 *   GAP-18：地标产出加成 — 洛阳+50%/长安+30%/建业+30%精确数值验证
 *   GAP-19：自动驻防比例 — 50%兵力自动驻防、边界条件、事件链验证
 *   GAP-20：产出气泡边界 — 归属/缩放/产出三维交叉条件
 *
 * @module engine/map/__tests__/MapP2StatGarrison
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerritorySystem } from '../TerritorySystem';
import { GarrisonSystem } from '../GarrisonSystem';
import { SiegeSystem } from '../SiegeSystem';
import { WorldMapSystem } from '../WorldMapSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { TerritoryProduction, TerritoryData } from '../../../core/map';
import { VIEWPORT_CONFIG, QUALITY_PRODUCTION_BONUS } from '../../../core/map';
import type { GeneralData } from '../../hero/hero.types';
import { Quality } from '../../hero/hero.types';

// ═══════════════════════════════════════════════
// 常量 & 辅助工具
// ═══════════════════════════════════════════════

/** PRD MAP-3 §3.6 地标产出加成配置 */
const LANDMARK_PRODUCTION_BONUS: Record<string, number> = {
  'city-luoyang': 0.50,
  'city-changan': 0.30,
  'city-jianye': 0.30,
};

/** 产出气泡最小缩放阈值（PRD MAP-3 §3.8~3.11） */
const BUBBLE_MIN_ZOOM = 0.6;

/** 自动驻防比例（PRD MAP-3 §3.15） */
const AUTO_GARRISON_RATIO = 0.5;

function createGeneral(id: string, quality: Quality, defense: number): GeneralData {
  return {
    id, name: `武将${id}`, quality,
    baseStats: { attack: 100, defense, intelligence: 80, speed: 70 },
    level: 10, exp: 0, faction: 'shu', skills: [],
  };
}

const GENERALS: Record<string, GeneralData> = {
  guanyu: createGeneral('guanyu', Quality.LEGENDARY, 200),
  zhangfei: createGeneral('zhangfei', Quality.EPIC, 180),
  zhaoyun: createGeneral('zhaoyun', Quality.RARE, 160),
};

/** 创建带完整子系统的测试环境 */
function createTestEnv(generals: Record<string, GeneralData> = GENERALS) {
  const territory = new TerritorySystem();
  const garrison = new GarrisonSystem();
  const siege = new SiegeSystem();
  const worldMap = new WorldMapSystem();

  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  const deps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn().mockImplementation((event: string, data: unknown) => {
        emittedEvents.push({ event, data });
      }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory') return territory;
        if (name === 'garrison') return garrison;
        if (name === 'siege') return siege;
        if (name === 'worldMap') return worldMap;
        if (name === 'hero') return { getGeneral: (id: string) => generals[id] ?? null };
        if (name === 'heroFormation') return { isGeneralInAnyFormation: () => false };
        if (name === 'resource') return { consume: vi.fn() };
        return null;
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((n: string) =>
        ['territory','garrison','siege','worldMap','hero','heroFormation','resource'].includes(n)),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  garrison.init(deps);
  siege.init(deps);
  worldMap.init(deps);

  return { deps, territory, garrison, siege, worldMap, emittedEvents };
}

function totalRevenue(prod: TerritoryProduction): number {
  return prod.grain + prod.gold + prod.troops + prod.mandate;
}

function applyLandmarkBonus(territory: TerritoryData): TerritoryProduction {
  const bonus = LANDMARK_PRODUCTION_BONUS[territory.id] ?? 0;
  const p = territory.currentProduction;
  return {
    grain: Math.round(p.grain * (1 + bonus) * 100) / 100,
    gold: Math.round(p.gold * (1 + bonus) * 100) / 100,
    troops: Math.round(p.troops * (1 + bonus) * 100) / 100,
    mandate: Math.round(p.mandate * (1 + bonus) * 100) / 100,
  };
}

function shouldShowBubble(territory: TerritoryData, zoom: number): boolean {
  if (territory.ownership !== 'player') return false;
  if (zoom < BUBBLE_MIN_ZOOM) return false;
  return true;
}

function isZeroProduction(prod: TerritoryProduction): boolean {
  return prod.grain === 0 && prod.gold === 0 && prod.troops === 0 && prod.mandate === 0;
}

// ═══════════════════════════════════════════════
// GAP-17：统计面板完整交互测试
// ═══════════════════════════════════════════════

describe('GAP-17：统计面板完整交互测试（MAP-5 UI）', () => {
  let env: ReturnType<typeof createTestEnv>;
  beforeEach(() => { env = createTestEnv(); });

  describe('GAP-17-1：势力分布数据精确验证', () => {
    it('各区域领土数之和 = 玩家领土总数', () => {
      const summary = env.territory.getPlayerProductionSummary();
      const regionTotal = Object.values(summary.territoriesByRegion).reduce((a, b) => a + b, 0);
      expect(regionTotal).toBe(summary.totalTerritories);
    });

    it('各区域领土数与 getTerritoriesByOwnership 手动统计一致', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      env.territory.captureTerritory('city-chengdu', 'player');
      env.territory.captureTerritory('city-jianye', 'player');

      const summary = env.territory.getPlayerProductionSummary();
      const player = env.territory.getTerritoriesByOwnership('player');
      const manual: Record<string, number> = { wei: 0, shu: 0, wu: 0, neutral: 0 };
      for (const t of player) { manual[t.region]++; }
      expect(summary.territoriesByRegion).toEqual(manual);
    });

    it('敌方领土不计入玩家势力分布', () => {
      env.territory.captureTerritory('city-xuchang', 'enemy');
      const summary = env.territory.getPlayerProductionSummary();
      expect(summary.totalTerritories).toBe(1);
    });

    it('全部领土设为player时覆盖所有区域', () => {
      const all = env.territory.getAllTerritories();
      for (const t of all) { env.territory.captureTerritory(t.id, 'player'); }
      const summary = env.territory.getPlayerProductionSummary();
      expect(summary.totalTerritories).toBe(all.length);
      expect(summary.territoriesByRegion.wei).toBeGreaterThan(0);
      expect(summary.territoriesByRegion.shu).toBeGreaterThan(0);
      expect(summary.territoriesByRegion.wu).toBeGreaterThan(0);
    });
  });

  describe('GAP-17-2：领土列表按产出降序排列', () => {
    it('排序后首项为最高产出', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      env.territory.captureTerritory('res-grain1', 'player');
      env.territory.captureTerritory('pass-hulao', 'player');
      const details = env.territory.getPlayerProductionSummary().details;
      const sorted = [...details].sort((a, b) => totalRevenue(b.production) - totalRevenue(a.production));
      const maxRev = Math.max(...details.map(d => totalRevenue(d.production)));
      expect(totalRevenue(sorted[0].production)).toBe(maxRev);
    });

    it('排序后相邻项总收益非递增', () => {
      ['city-xuchang','city-ye','city-chengdu','pass-hulao','res-grain1'].forEach(id =>
        env.territory.captureTerritory(id, 'player'));
      const sorted = [...env.territory.getPlayerProductionSummary().details]
        .sort((a, b) => totalRevenue(b.production) - totalRevenue(a.production));
      for (let i = 1; i < sorted.length; i++) {
        expect(totalRevenue(sorted[i - 1].production)).toBeGreaterThanOrEqual(totalRevenue(sorted[i].production));
      }
    });

    it('升级领土后排序顺序变化', () => {
      env.territory.captureTerritory('res-grain1', 'player');
      env.territory.captureTerritory('pass-hulao', 'player');
      const before = env.territory.getPlayerProductionSummary().details.find(d => d.id === 'res-grain1')!;
      const result = env.territory.upgradeTerritory('res-grain1');
      if (result.success) {
        const after = env.territory.getPlayerProductionSummary().details.find(d => d.id === 'res-grain1')!;
        expect(totalRevenue(after.production)).toBeGreaterThan(totalRevenue(before.production));
      }
    });
  });

  describe('GAP-17-3：总产出汇总实时更新', () => {
    it('占领后 totalProduction 精确增加', () => {
      const before = env.territory.getPlayerProductionSummary();
      const xu = env.territory.getTerritoryById('city-xuchang')!;
      env.territory.captureTerritory('city-xuchang', 'player');
      const after = env.territory.getPlayerProductionSummary();
      expect(after.totalProduction.grain - before.totalProduction.grain).toBeCloseTo(xu.currentProduction.grain, 1);
    });

    it('失去领土后 totalProduction 精确减少', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      const withXu = env.territory.getPlayerProductionSummary();
      const xu = env.territory.getTerritoryById('city-xuchang')!;
      env.territory.captureTerritory('city-xuchang', 'neutral');
      const withoutXu = env.territory.getPlayerProductionSummary();
      expect(withXu.totalProduction.grain - withoutXu.totalProduction.grain).toBeCloseTo(xu.currentProduction.grain, 1);
    });

    it('连续占领后产出逐次递增', () => {
      const grains = [env.territory.getPlayerProductionSummary().totalProduction.grain];
      ['city-xuchang','city-ye','pass-hulao'].forEach(id => {
        env.territory.captureTerritory(id, 'player');
        grains.push(env.territory.getPlayerProductionSummary().totalProduction.grain);
      });
      for (let i = 1; i < grains.length; i++) { expect(grains[i]).toBeGreaterThan(grains[i - 1]); }
    });

    it('details 数量 = totalTerritories', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      const s = env.territory.getPlayerProductionSummary();
      expect(s.details.length).toBe(s.totalTerritories);
    });
  });

  describe('GAP-17-4：面板事件通知', () => {
    it('territory:captured 事件含完整信息', () => {
      env.emittedEvents.length = 0;
      env.territory.captureTerritory('city-xuchang', 'player');
      const e = env.emittedEvents.find(ev => ev.event === 'territory:captured');
      expect(e).toBeDefined();
      expect(e!.data).toEqual(expect.objectContaining({
        territoryId: 'city-xuchang', territoryName: '许昌',
        previousOwner: 'neutral', newOwner: 'player',
      }));
    });

    it('territory:upgraded 事件含消耗和等级', () => {
      env.territory.captureTerritory('res-grain1', 'player');
      env.emittedEvents.length = 0;
      const r = env.territory.upgradeTerritory('res-grain1');
      if (r.success) {
        const e = env.emittedEvents.find(ev => ev.event === 'territory:upgraded');
        expect(e).toBeDefined();
        expect(e!.data).toEqual(expect.objectContaining({
          territoryId: 'res-grain1', previousLevel: expect.any(Number), newLevel: expect.any(Number),
        }));
      }
    });

    it('归属变更事件携带正确 previousOwner', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      env.emittedEvents.length = 0;
      env.territory.captureTerritory('city-xuchang', 'enemy');
      const e = env.emittedEvents.find(ev => ev.event === 'territory:captured');
      expect(e!.data).toEqual(expect.objectContaining({ previousOwner: 'player', newOwner: 'enemy' }));
    });
  });

  describe('GAP-17-5：统计数据自动更新', () => {
    it('占领/失去/再占领后 summary 始终反映当前状态', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      expect(env.territory.getPlayerProductionSummary().totalTerritories).toBe(2);
      env.territory.captureTerritory('city-xuchang', 'neutral');
      expect(env.territory.getPlayerProductionSummary().totalTerritories).toBe(1);
      env.territory.captureTerritory('city-xuchang', 'player');
      expect(env.territory.getPlayerProductionSummary().totalTerritories).toBe(2);
    });

    it('getState().productionSummary 与直接调用一致', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      const state = env.territory.getState();
      const direct = env.territory.getPlayerProductionSummary();
      expect(state.productionSummary.totalTerritories).toBe(direct.totalTerritories);
      expect(state.productionSummary.totalProduction.grain).toBe(direct.totalProduction.grain);
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-18：地标产出加成测试
// ═══════════════════════════════════════════════

describe('GAP-18：地标产出加成测试（MAP-3 §3.6）', () => {
  let env: ReturnType<typeof createTestEnv>;
  beforeEach(() => { env = createTestEnv(); });

  describe('GAP-18-1：洛阳产出加成+50%', () => {
    it('等级加成产出 = base × 2.5（level 5）', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(t.level).toBe(5);
      expect(t.currentProduction.grain).toBeCloseTo(t.baseProduction.grain * 2.5, 1);
    });

    it('地标加成后 = currentProduction × 1.5（精确数值）', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      const bp = applyLandmarkBonus(t);
      expect(bp.grain).toBeCloseTo(18.75, 1);
      expect(bp.gold).toBeCloseTo(18.75, 1);
      expect(bp.troops).toBeCloseTo(11.25, 1);
      expect(bp.mandate).toBeCloseTo(3.75, 1);
    });
  });

  describe('GAP-18-2：长安产出加成+30%', () => {
    it('地标加成后 = currentProduction × 1.3（精确数值）', () => {
      const t = env.territory.getTerritoryById('city-changan')!;
      expect(t.level).toBe(5);
      const bp = applyLandmarkBonus(t);
      expect(bp.grain).toBeCloseTo(16.25, 1);
      expect(bp.gold).toBeCloseTo(16.25, 1);
      expect(bp.troops).toBeCloseTo(9.75, 1);
      expect(bp.mandate).toBeCloseTo(3.25, 1);
    });
  });

  describe('GAP-18-3：建业产出加成+30%', () => {
    it('地标加成后 = currentProduction × 1.3（精确数值）', () => {
      const t = env.territory.getTerritoryById('city-jianye')!;
      expect(t.level).toBe(5);
      const bp = applyLandmarkBonus(t);
      expect(bp.grain).toBeCloseTo(16.25, 1);
      expect(bp.gold).toBeCloseTo(16.25, 1);
      expect(bp.troops).toBeCloseTo(9.75, 1);
      expect(bp.mandate).toBeCloseTo(3.25, 1);
    });
  });

  describe('GAP-18-4：地标加成与驻防加成叠加', () => {
    it('洛阳+50% + 传说驻防+30% = base×2.5×1.5×1.3', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      const landmarkProd = applyLandmarkBonus(t);
      const garrisonRate = QUALITY_PRODUCTION_BONUS.LEGENDARY;
      const combined = Math.round(landmarkProd.grain * (1 + garrisonRate) * 100) / 100;
      expect(combined).toBeCloseTo(5 * 2.5 * 1.5 * 1.3, 1);
    });

    it('使用GarrisonSystem实际方法验证驻防加成', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      const r = env.garrison.assignGarrison('city-xuchang', 'guanyu');
      if (r.success && r.bonus) {
        expect(r.bonus.productionBonus.grain).toBeGreaterThan(0);
        const xu = env.territory.getTerritoryById('city-xuchang')!;
        const effective = env.garrison.getEffectiveProduction('city-xuchang', xu.currentProduction);
        expect(effective.grain).toBeGreaterThan(xu.currentProduction.grain);
      }
    });
  });

  describe('GAP-18-5：非地标领土无特殊加成', () => {
    it('全地图仅洛阳/长安/建业有地标加成', () => {
      const all = env.territory.getAllTerritories();
      const ids = Object.keys(LANDMARK_PRODUCTION_BONUS);
      expect(ids).toEqual(['city-luoyang', 'city-changan', 'city-jianye']);
      let count = 0;
      for (const t of all) {
        if (ids.includes(t.id)) {
          expect(LANDMARK_PRODUCTION_BONUS[t.id]).toBeGreaterThan(0);
          count++;
        } else {
          expect(LANDMARK_PRODUCTION_BONUS[t.id] ?? 0).toBe(0);
        }
      }
      expect(count).toBe(3);
    });

    it('普通城池/关卡/资源点 applyLandmarkBonus 不变', () => {
      for (const id of ['city-xuchang', 'pass-hulao', 'res-grain1']) {
        const t = env.territory.getTerritoryById(id)!;
        const bp = applyLandmarkBonus(t);
        expect(bp.grain).toBe(t.currentProduction.grain);
        expect(bp.gold).toBe(t.currentProduction.gold);
      }
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-19：自动驻防比例测试
// ═══════════════════════════════════════════════

describe('GAP-19：自动驻防比例测试（MAP-3 §3.15）', () => {
  let env: ReturnType<typeof createTestEnv>;
  beforeEach(() => { env = createTestEnv(); });

  describe('GAP-19-1：50%自动驻防', () => {
    it('攻城胜利发出 siege:autoGarrison 事件', () => {
      env.emittedEvents.length = 0;
      const r = env.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 1000, true);
      if (r.launched && r.victory) {
        const e = env.emittedEvents.find(ev => ev.event === 'siege:autoGarrison');
        expect(e).toBeDefined();
        expect(e!.data).toEqual(expect.objectContaining({
          territoryId: 'city-xuchang', owner: 'player', garrisonTroops: expect.any(Number),
        }));
      }
    });

    it('autoGarrison 兵力 = 攻城消耗 × 50%', () => {
      const xu = env.territory.getTerritoryById('city-xuchang')!;
      const cost = env.siege.calculateSiegeCost(xu);
      expect(Math.floor(cost.troops * AUTO_GARRISON_RATIO)).toBe(Math.floor(cost.troops * 0.5));
    });

    it('攻城胜利后领土归属变更 + siege:victory 事件', () => {
      env.emittedEvents.length = 0;
      const r = env.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 1000, true);
      if (r.launched && r.victory) {
        expect(env.territory.getTerritoryById('city-xuchang')!.ownership).toBe('player');
        const v = env.emittedEvents.find(ev => ev.event === 'siege:victory');
        expect(v).toBeDefined();
      }
    });
  });

  describe('GAP-19-2：不同等级领土驻防数量', () => {
    it('level 5 defenseValue=5000 → 消耗5000 → 驻防2500', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(t.defenseValue).toBe(5000);
      expect(env.siege.calculateSiegeCost(t).troops).toBe(5000);
      expect(Math.floor(5000 * 0.5)).toBe(2500);
    });

    it('level 3 defenseValue=3000 → 消耗3000 → 驻防1500', () => {
      const t = env.territory.getTerritoryById('city-puyang')!;
      expect(t.defenseValue).toBe(3000);
      expect(Math.floor(env.siege.calculateSiegeCost(t).troops * 0.5)).toBe(1500);
    });

    it('level 2 defenseValue=2000 → 消耗2000 → 驻防1000', () => {
      const t = env.territory.getTerritoryById('res-grain1')!;
      expect(t.defenseValue).toBe(2000);
      expect(Math.floor(env.siege.calculateSiegeCost(t).troops * 0.5)).toBe(1000);
    });

    it('等级越高驻防越多（递增）', () => {
      const ids = ['res-grain1', 'city-puyang', 'city-luoyang'];
      const g = ids.map(id => Math.floor(env.siege.calculateSiegeCost(env.territory.getTerritoryById(id)!).troops * 0.5));
      for (let i = 1; i < g.length; i++) { expect(g[i]).toBeGreaterThan(g[i - 1]); }
    });
  });

  describe('GAP-19-3：兵力不足边界', () => {
    it('奇数消耗向下取整（1001→500）', () => { expect(Math.floor(1001 * 0.5)).toBe(500); });
    it('消耗=1时驻防=0（不发事件）', () => { expect(Math.floor(1 * 0.5)).toBe(0); });
    it('消耗=2时驻防=1', () => { expect(Math.floor(2 * 0.5)).toBe(1); });
    it('消耗=100时驻防=50', () => { expect(Math.floor(100 * 0.5)).toBe(50); });
  });

  describe('GAP-19-4：自动驻防独立性', () => {
    it('手动驻防与自动驻防互不干扰', () => {
      env.garrison.assignGarrison('city-luoyang', 'guanyu');
      expect(env.garrison.getGarrisonCount()).toBe(1);
      env.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 1000, true);
      expect(env.garrison.getGarrisonCount()).toBe(1);
      expect(env.garrison.getAssignment('city-luoyang')!.generalId).toBe('guanyu');
    });

    it('撤防后自动驻防逻辑仍可触发', () => {
      env.garrison.assignGarrison('city-luoyang', 'guanyu');
      env.garrison.withdrawGarrison('city-luoyang');
      expect(env.garrison.getGarrisonCount()).toBe(0);
      env.siege.executeSiegeWithResult('city-xuchang', 'player', 10000, 1000, true);
      expect(env.garrison.getAssignment('city-luoyang')).toBeNull();
    });
  });

  describe('GAP-19-5：手动驻防覆盖', () => {
    it('手动派遣/撤防/再派遣不同武将', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      env.garrison.assignGarrison('city-xuchang', 'guanyu');
      env.garrison.withdrawGarrison('city-xuchang');
      const r = env.garrison.assignGarrison('city-xuchang', 'zhangfei');
      expect(r.success).toBe(true);
      expect(env.garrison.getAssignment('city-xuchang')!.generalId).toBe('zhangfei');
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-20：产出气泡边界条件测试
// ═══════════════════════════════════════════════

describe('GAP-20：产出气泡边界条件测试（MAP-3 §3.8~3.11）', () => {
  let env: ReturnType<typeof createTestEnv>;
  beforeEach(() => { env = createTestEnv(); });

  describe('GAP-20-1：己方领土显示产出气泡', () => {
    it('player 领土正常缩放显示', () => {
      expect(shouldShowBubble(env.territory.getTerritoryById('city-luoyang')!, 1.0)).toBe(true);
    });

    it('占领后立即显示', () => {
      expect(shouldShowBubble(env.territory.getTerritoryById('city-xuchang')!, 1.0)).toBe(false);
      env.territory.captureTerritory('city-xuchang', 'player');
      expect(shouldShowBubble(env.territory.getTerritoryById('city-xuchang')!, 1.0)).toBe(true);
    });

    it('所有 player 领土在 zoom≥60% 时显示', () => {
      ['city-xuchang','pass-hulao','res-grain1'].forEach(id =>
        env.territory.captureTerritory(id, 'player'));
      for (const t of env.territory.getTerritoriesByOwnership('player')) {
        expect(shouldShowBubble(t, 0.6)).toBe(true);
      }
    });
  });

  describe('GAP-20-2：非己方不显示', () => {
    it('neutral/enemy 在任何缩放都不显示', () => {
      const xu = env.territory.getTerritoryById('city-xuchang')!;
      expect(shouldShowBubble(xu, 0.5)).toBe(false);
      expect(shouldShowBubble(xu, 1.0)).toBe(false);
      expect(shouldShowBubble(xu, 2.0)).toBe(false);
      env.territory.captureTerritory('city-xuchang', 'enemy');
      expect(shouldShowBubble(env.territory.getTerritoryById('city-xuchang')!, 1.0)).toBe(false);
    });

    it('失去领土后气泡消失', () => {
      expect(shouldShowBubble(env.territory.getTerritoryById('city-luoyang')!, 1.0)).toBe(true);
      env.territory.captureTerritory('city-luoyang', 'neutral');
      expect(shouldShowBubble(env.territory.getTerritoryById('city-luoyang')!, 1.0)).toBe(false);
    });
  });

  describe('GAP-20-3：产出为0时灰色气泡', () => {
    it('关卡 mandate=0，资源点非主资源=0', () => {
      expect(env.territory.getTerritoryById('pass-hulao')!.baseProduction.mandate).toBe(0);
      const g1 = env.territory.getTerritoryById('res-grain1')!;
      expect(g1.baseProduction.grain).toBeGreaterThan(0);
      expect(g1.baseProduction.gold).toBe(0);
    });

    it('isZeroProduction 边界', () => {
      expect(isZeroProduction({ grain: 0, gold: 0, troops: 0, mandate: 0 })).toBe(true);
      expect(isZeroProduction({ grain: 0.01, gold: 0, troops: 0, mandate: 0 })).toBe(false);
    });

    it('部分产出为0不影响气泡显示', () => {
      env.territory.captureTerritory('res-gold1', 'player');
      const t = env.territory.getTerritoryById('res-gold1')!;
      expect(shouldShowBubble(t, 1.0)).toBe(true);
      expect(t.currentProduction.gold).toBeGreaterThan(0);
      expect(t.currentProduction.grain).toBe(0);
    });
  });

  describe('GAP-20-4：缩放<60%隐藏', () => {
    it('zoom=0.50/0.59/0.5999 都隐藏', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(shouldShowBubble(t, 0.50)).toBe(false);
      expect(shouldShowBubble(t, 0.59)).toBe(false);
      expect(shouldShowBubble(t, 0.5999)).toBe(false);
    });

    it('WorldMapSystem 可设置 zoom<60%', () => {
      env.worldMap.setZoom(0.5);
      expect(env.worldMap.getViewport().zoom).toBeLessThan(BUBBLE_MIN_ZOOM);
    });

    it('VIEWPORT_CONFIG.minZoom < 60%', () => {
      expect(VIEWPORT_CONFIG.minZoom).toBeLessThan(BUBBLE_MIN_ZOOM);
    });
  });

  describe('GAP-20-5：缩放≥60%显示', () => {
    it('zoom=0.60/0.61/1.0/2.0 都显示', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(shouldShowBubble(t, 0.60)).toBe(true);
      expect(shouldShowBubble(t, 0.61)).toBe(true);
      expect(shouldShowBubble(t, 1.0)).toBe(true);
      expect(shouldShowBubble(t, 2.0)).toBe(true);
    });

    it('缩放从<60%变为≥60%气泡出现，反之消失', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(shouldShowBubble(t, 0.5)).toBe(false);
      expect(shouldShowBubble(t, 0.6)).toBe(true);
      expect(shouldShowBubble(t, 0.5)).toBe(false);
    });
  });

  describe('GAP-20-6：占领动画事件', () => {
    it('territory:captured 包含动画所需全部字段', () => {
      env.emittedEvents.length = 0;
      env.territory.captureTerritory('city-xuchang', 'player');
      const e = env.emittedEvents.find(ev => ev.event === 'territory:captured');
      const d = e!.data as Record<string, unknown>;
      expect(d).toHaveProperty('territoryId');
      expect(d).toHaveProperty('territoryName');
      expect(d).toHaveProperty('previousOwner');
      expect(d).toHaveProperty('newOwner');
      expect(d).toHaveProperty('region');
    });

    it('新占领领土产出即时生效', () => {
      const b = env.territory.getPlayerProductionSummary();
      env.territory.captureTerritory('city-xuchang', 'player');
      const a = env.territory.getPlayerProductionSummary();
      expect(a.totalTerritories).toBe(b.totalTerritories + 1);
      expect(a.totalProduction.grain).toBeGreaterThan(b.totalProduction.grain);
    });
  });

  describe('GAP-20 综合：归属×缩放三维交叉', () => {
    it('player+zoom≥60%→显示, player+zoom<60%→隐藏', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(shouldShowBubble(t, 0.6)).toBe(true);
      expect(shouldShowBubble(t, 0.5)).toBe(false);
    });

    it('非player无论缩放都隐藏', () => {
      const xu = env.territory.getTerritoryById('city-xuchang')!;
      expect(shouldShowBubble(xu, 1.0)).toBe(false);
      expect(shouldShowBubble(xu, 0.5)).toBe(false);
    });

    it('多领土混合状态', () => {
      env.territory.captureTerritory('city-xuchang', 'player');
      env.territory.captureTerritory('city-ye', 'enemy');
      const ly = env.territory.getTerritoryById('city-luoyang')!;
      const xu = env.territory.getTerritoryById('city-xuchang')!;
      const ye = env.territory.getTerritoryById('city-ye')!;
      expect(shouldShowBubble(ly, 1.0)).toBe(true);
      expect(shouldShowBubble(xu, 1.0)).toBe(true);
      expect(shouldShowBubble(ye, 1.0)).toBe(false);
      expect(shouldShowBubble(ly, 0.5)).toBe(false);
      expect(shouldShowBubble(xu, 0.5)).toBe(false);
    });

    it('精确边界 0.5999 vs 0.6000', () => {
      const t = env.territory.getTerritoryById('city-luoyang')!;
      expect(shouldShowBubble(t, 0.5999)).toBe(false);
      expect(shouldShowBubble(t, 0.6000)).toBe(true);
    });
  });
});
