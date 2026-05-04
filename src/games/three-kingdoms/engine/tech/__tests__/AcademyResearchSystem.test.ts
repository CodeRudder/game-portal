/**
 * Sprint 3 — 书院研究系统测试
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechEffectSystem } from '../TechEffectSystem';
import { AcademyResearchSystem } from '../AcademyResearchSystem';
import { createRealDeps } from '../../../test-utils/test-helpers';
import type { BuildingBonusInjection } from '../AcademyResearchSystem';
import { RESEARCH_START_TECH_POINT_MULTIPLIER } from '../tech-config';

describe('AcademyResearchSystem', () => {
  let treeSys: TechTreeSystem;
  let pointSys: TechPointSystem;
  let researchSys: TechResearchSystem;
  let effectSys: TechEffectSystem;
  let academySys: AcademyResearchSystem;
  let baseTime: number;
  let copperAmount: number;
  let ingotAmount: number;
  let mandateAmount: number;
  let injectedBonuses: BuildingBonusInjection[];

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    copperAmount = 1000000;
    ingotAmount = 1000;
    mandateAmount = 10000;
    injectedBonuses = [];

    treeSys = new TechTreeSystem();
    pointSys = new TechPointSystem();
    researchSys = new TechResearchSystem(
      treeSys, pointSys,
      () => 10,
      () => mandateAmount,
      (a: number) => { if (mandateAmount >= a) { mandateAmount -= a; return true; } return false; },
      () => copperAmount,
      (a: number) => { if (copperAmount >= a) { copperAmount -= a; return true; } return false; },
    );
    effectSys = new TechEffectSystem();
    academySys = new AcademyResearchSystem(
      researchSys, treeSys, pointSys,
      () => copperAmount,
      (a: number) => { if (copperAmount >= a) { copperAmount -= a; return true; } return false; },
      () => ingotAmount,
      (a: number) => { if (ingotAmount >= a) { ingotAmount -= a; return true; } return false; },
    );

    const deps = createRealDeps();
    treeSys.init(deps); pointSys.init(deps); researchSys.init(deps);
    effectSys.init(deps); effectSys.setTechTree(treeSys);
    academySys.init(deps);
    academySys.setTechEffectSystem(effectSys);
    academySys.setBuildingBonusCallback((inj) => { injectedBonuses.push(inj); });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  function grantPoints(amount: number): void {
    // amount 是实际要获得的科技点数
    // exchangeGoldForTechPoints: 100 gold = 1 tech point
    pointSys.syncAcademyLevel(20);
    pointSys.exchangeGoldForTechPoints(amount * 100, 10);
  }

  function advanceTime(ms: number): void {
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + ms);
  }

  describe('BLD-F29-01: 研究队列', () => {
    it('选择科技→入队→进度推进', () => {
      grantPoints(10000);
      const result = academySys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);

      const queue = academySys.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].techId).toBe('mil_t1_attack');

      const expectedCost = 50 * RESEARCH_START_TECH_POINT_MULTIPLIER;
      expect(pointSys.getCurrentPoints()).toBeCloseTo(10000 - expectedCost);

      advanceTime(30 * 1000);
      const progress = academySys.getResearchProgress('mil_t1_attack');
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    });

    it('研究完成后队列清空且节点变为completed', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      const completed = academySys.tickResearch(0);
      expect(completed).toContain('mil_t1_attack');
      expect(academySys.getQueue()).toHaveLength(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('研究完成后解锁后续节点', () => {
      grantPoints(20000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      expect(treeSys.getNodeState('mil_t2_charge')?.status).toBe('available');
    });

    it('研究完成后互斥节点被锁定', () => {
      grantPoints(20000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      expect(treeSys.getNodeState('mil_t1_defense')?.status).toBe('locked');
    });

    it('前置未完成无法研究', () => {
      grantPoints(20000);
      const result = academySys.startResearch('mil_t2_charge');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置');
    });

    it('队列满时无法入队', () => {
      grantPoints(50000);
      academySys.startResearch('mil_t1_attack');
      academySys.startResearch('eco_t1_farming');
      academySys.startResearch('cul_t1_education');
      const result = academySys.startResearch('eco_t1_trade');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已满');
    });

    it('取消研究返还科技点', () => {
      grantPoints(10000);
      const before = pointSys.getCurrentPoints();
      academySys.startResearch('mil_t1_attack');
      expect(pointSys.getCurrentPoints()).toBeLessThan(before);
      const cancelResult = academySys.cancelResearch('mil_t1_attack');
      expect(cancelResult.success).toBe(true);
      expect(cancelResult.refundPoints).toBe(50 * RESEARCH_START_TECH_POINT_MULTIPLIER);
    });
  });

  describe('BLD-F29-02: 铜钱加速', () => {
    it('铜钱加速→剩余时间-30%', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const remainingBefore = academySys.getRemainingTime('mil_t1_attack');
      const result = academySys.copperSpeedUp('mil_t1_attack');
      expect(result.success).toBe(true);
      expect(result.timeReduced).toBeCloseTo(remainingBefore * 0.3, -1);
      expect(result.remainingCopperSpeedUps).toBe(2);
    });

    it('铜钱加速可叠加3次', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      expect(academySys.copperSpeedUp('mil_t1_attack').remainingCopperSpeedUps).toBe(2);
      advanceTime(100);
      expect(academySys.copperSpeedUp('mil_t1_attack').remainingCopperSpeedUps).toBe(1);
      advanceTime(100);
      expect(academySys.copperSpeedUp('mil_t1_attack').remainingCopperSpeedUps).toBe(0);
      advanceTime(100);
      const r4 = academySys.copperSpeedUp('mil_t1_attack');
      expect(r4.success).toBe(false);
      expect(r4.reason).toContain('上限');
    });

    it('铜钱加速费用递增', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const cost1 = academySys.getCopperSpeedUpCost('mil_t1_attack').cost;
      academySys.copperSpeedUp('mil_t1_attack');
      advanceTime(100);
      const cost2 = academySys.getCopperSpeedUpCost('mil_t1_attack').cost;
      expect(cost2).toBeGreaterThan(cost1);
    });

    it('铜钱不足时加速失败', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      copperAmount = 0;
      const result = academySys.copperSpeedUp('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('铜钱不足');
    });

    it('不在队列中的科技无法加速', () => {
      const result = academySys.copperSpeedUp('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不在研究队列中');
    });
  });

  describe('BLD-F29-02: 元宝秒完成', () => {
    it('元宝加速→立即完成', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      const result = academySys.ingotInstantComplete('mil_t1_attack');
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.ingotCost).toBeGreaterThan(0);
      expect(treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
      expect(academySys.getQueue()).toHaveLength(0);
    });

    it('元宝加速消耗递增', () => {
      grantPoints(20000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      academySys.ingotInstantComplete('mil_t1_attack');
      advanceTime(200 * 1000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(10 * 1000);
      expect(academySys.getState().totalIngotSpeedUpCount).toBe(1);
    });

    it('元宝不足时秒完成失败', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      ingotAmount = 0;
      const result = academySys.ingotInstantComplete('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('元宝不足');
    });

    it('不在队列中的科技无法元宝加速', () => {
      const result = academySys.ingotInstantComplete('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不在研究队列中');
    });
  });

  describe('BLD-F29-03: 科技树预览', () => {
    it('生成完整科技树预览', () => {
      const preview = academySys.getTechTreePreview();
      expect(preview.nodes.length).toBeGreaterThan(0);
      expect(preview.edges.length).toBeGreaterThan(0);
      expect(preview.pathStats).toHaveProperty('military');
      expect(preview.pathStats).toHaveProperty('economy');
      expect(preview.pathStats).toHaveProperty('culture');
    });

    it('节点包含前置条件信息', () => {
      const preview = academySys.getTechTreePreview();
      const chargeNode = preview.nodes.find(n => n.id === 'mil_t2_charge');
      expect(chargeNode).toBeDefined();
      expect(chargeNode!.prerequisites.length).toBeGreaterThan(0);
      expect(chargeNode!.prerequisites[0].id).toBe('mil_t1_attack');
      expect(chargeNode!.prerequisites[0].completed).toBe(false);
    });

    it('未完成前置→节点显示为locked', () => {
      const preview = academySys.getTechTreePreview();
      const chargeNode = preview.nodes.find(n => n.id === 'mil_t2_charge');
      expect(chargeNode!.status).toBe('locked');
    });

    it('完成前置后节点变为available', () => {
      grantPoints(20000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      const preview = academySys.getTechTreePreview();
      const chargeNode = preview.nodes.find(n => n.id === 'mil_t2_charge');
      expect(chargeNode!.status).toBe('available');
    });

    it('推荐高亮：经济路线低层级科技被推荐', () => {
      grantPoints(10000);
      const preview = academySys.getTechTreePreview();
      expect(preview.recommendedIds).toContain('eco_t1_farming');
    });

    it('节点包含效果预览', () => {
      const preview = academySys.getTechTreePreview();
      const farmingNode = preview.nodes.find(n => n.id === 'eco_t1_farming');
      expect(farmingNode).toBeDefined();
      expect(farmingNode!.effects.length).toBeGreaterThan(0);
      expect(farmingNode!.effects[0].description).toContain('产出加成');
    });

    it('按路线过滤预览', () => {
      const militaryNodes = academySys.getPathPreview('military');
      const economyNodes = academySys.getPathPreview('economy');
      expect(militaryNodes.every(n => n.path === 'military')).toBe(true);
      expect(economyNodes.every(n => n.path === 'economy')).toBe(true);
    });

    it('获取单个科技详情预览', () => {
      const detail = academySys.getTechDetailPreview('mil_t1_attack');
      expect(detail).not.toBeNull();
      expect(detail!.name).toBe('锐兵术');
      expect(detail!.cost.amount).toBe(50);
      expect(detail!.researchTime.baseTime).toBe(120);
    });

    it('各路线统计正确', () => {
      grantPoints(20000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      const preview = academySys.getTechTreePreview();
      expect(preview.pathStats.military.completed).toBe(1);
      expect(preview.pathStats.economy.completed).toBe(0);
    });
  });

  describe('XI-016: TEC→BLD 科技完成→建筑加成注入', () => {
    it('经济科技完成→农田产出+15%→实际产出验证', () => {
      grantPoints(20000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(200 * 1000);
      const completed = academySys.tickResearch(0);
      expect(completed).toContain('eco_t1_farming');
      expect(injectedBonuses.length).toBeGreaterThan(0);
      const farmingBonus = injectedBonuses.find(b => b.techId === 'eco_t1_farming');
      expect(farmingBonus).toBeDefined();
      expect(farmingBonus!.effects.some(e => e.type === 'resource_production' && e.target === 'grain' && e.value === 15)).toBe(true);
      expect(farmingBonus!.affectedBuildingTypes).toContain('farmland');
    });

    it('科技完成→全资源产出加成注入', () => {
      grantPoints(50000);
      academySys.startResearch('eco_t1_trade');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      advanceTime(100);
      academySys.startResearch('eco_t2_minting');
      advanceTime(400 * 1000);
      academySys.tickResearch(0);
      advanceTime(100);
      academySys.startResearch('eco_t3_marketplace');
      advanceTime(800 * 1000);
      const completed = academySys.tickResearch(0);
      expect(completed).toContain('eco_t3_marketplace');
      const multiplier = academySys.getResourceProductionMultiplier('grain');
      expect(multiplier).toBeCloseTo(1.10, 1);
    });

    it('科技完成→建筑加成查询接口', () => {
      grantPoints(20000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      const bonuses = academySys.getAllBuildingBonuses();
      expect(bonuses['resource_production:grain']).toBe(15);
    });

    it('科技完成→资源产出乘数正确', () => {
      grantPoints(20000);
      expect(academySys.getResourceProductionMultiplier('grain')).toBe(1);
      academySys.startResearch('eco_t1_farming');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      expect(academySys.getResourceProductionMultiplier('grain')).toBeCloseTo(1.15, 1);
    });

    it('多个科技加成叠加', () => {
      grantPoints(50000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      advanceTime(100);
      academySys.startResearch('eco_t2_irrigation');
      advanceTime(400 * 1000);
      academySys.tickResearch(0);
      expect(academySys.getResourceProductionMultiplier('grain')).toBeCloseTo(1.35, 1);
    });

    it('科技完成→效果系统缓存刷新', () => {
      grantPoints(20000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      expect(effectSys.getProductionBonus('grain')).toBe(15);
    });
  });

  describe('XI-005: BLD→TEC 书院产出科技点→研究消费', () => {
    it('书院等级决定科技点产出', () => {
      academySys.syncAcademyLevel(10);
      expect(academySys.getTechPointProductionRate()).toBeGreaterThan(0);
    });

    it('书院等级越高产出越快', () => {
      academySys.syncAcademyLevel(1);
      const rate1 = academySys.getTechPointProductionRate();
      academySys.syncAcademyLevel(10);
      const rate10 = academySys.getTechPointProductionRate();
      academySys.syncAcademyLevel(20);
      const rate20 = academySys.getTechPointProductionRate();
      expect(rate10).toBeGreaterThan(rate1);
      expect(rate20).toBeGreaterThan(rate10);
    });

    it('tick产出科技点', () => {
      academySys.syncAcademyLevel(10);
      const before = academySys.getCurrentTechPoints();
      academySys.tickTechPoints(100);
      expect(academySys.getCurrentTechPoints()).toBeGreaterThan(before);
    });

    it('科技点用于研究消费', () => {
      academySys.syncAcademyLevel(20);
      // 需要至少 50 * RESEARCH_START_TECH_POINT_MULTIPLIER = 500 科技点
      // level 20 → 1.76/s → 需要 ~500000ms 才能累积足够
      academySys.tickTechPoints(500000);
      const pointsBefore = academySys.getCurrentTechPoints();
      expect(pointsBefore).toBeGreaterThan(50 * RESEARCH_START_TECH_POINT_MULTIPLIER);
      const result = academySys.startResearch('mil_t1_attack');
      expect(result.success).toBe(true);
      expect(academySys.getCurrentTechPoints()).toBeCloseTo(pointsBefore - 50 * RESEARCH_START_TECH_POINT_MULTIPLIER);
    });

    it('科技点不足无法研究', () => {
      academySys.syncAcademyLevel(1);
      academySys.tickTechPoints(1);
      const result = academySys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });
  });

  describe('完整链路', () => {
    it('产出→入队→铜钱加速→完成→加成', () => {
      academySys.syncAcademyLevel(20);
      academySys.tickTechPoints(500000);
      expect(academySys.startResearch('eco_t1_farming').success).toBe(true);
      advanceTime(30 * 1000);
      expect(academySys.getResearchProgress('eco_t1_farming')).toBeGreaterThan(0);
      const speedUpResult = academySys.copperSpeedUp('eco_t1_farming');
      expect(speedUpResult.success).toBe(true);
      expect(speedUpResult.timeReduced).toBeGreaterThan(0);
      advanceTime(300 * 1000);
      expect(academySys.tickResearch(0)).toContain('eco_t1_farming');
      expect(academySys.getResourceProductionMultiplier('grain')).toBeCloseTo(1.15, 1);
    });

    it('产出→入队→元宝秒完成→加成', () => {
      academySys.syncAcademyLevel(20);
      academySys.tickTechPoints(500000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(10 * 1000);
      const ingotResult = academySys.ingotInstantComplete('eco_t1_farming');
      expect(ingotResult.success).toBe(true);
      expect(ingotResult.completed).toBe(true);
      expect(treeSys.getNodeState('eco_t1_farming')?.status).toBe('completed');
      expect(effectSys.getProductionBonus('grain')).toBe(15);
    });

    it('多科技链路：连续研究多个科技', () => {
      academySys.syncAcademyLevel(20);
      academySys.tickTechPoints(2000000);
      academySys.startResearch('eco_t1_farming');
      advanceTime(200 * 1000);
      academySys.tickResearch(0);
      advanceTime(100);
      expect(academySys.startResearch('eco_t2_irrigation').success).toBe(true);
      advanceTime(400 * 1000);
      academySys.tickResearch(0);
      expect(academySys.getResourceProductionMultiplier('grain')).toBeCloseTo(1.35, 1);
    });
  });

  describe('序列化', () => {
    it('序列化保存铜钱加速次数和元宝加速计数', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      academySys.copperSpeedUp('mil_t1_attack');
      const data = academySys.serialize();
      expect(data.copperSpeedUpCounts['mil_t1_attack']).toBe(1);
      expect(data.totalIngotSpeedUpCount).toBe(0);
    });

    it('反序列化恢复状态', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      academySys.copperSpeedUp('mil_t1_attack');
      const data = academySys.serialize();
      academySys.reset();
      academySys.deserialize(data);
      expect(academySys.getState().copperSpeedUpCounts['mil_t1_attack']).toBe(1);
    });

    it('reset清空状态', () => {
      grantPoints(10000);
      academySys.startResearch('mil_t1_attack');
      advanceTime(10 * 1000);
      academySys.copperSpeedUp('mil_t1_attack');
      academySys.reset();
      expect(academySys.getState().copperSpeedUpCounts).toEqual({});
      expect(academySys.getState().totalIngotSpeedUpCount).toBe(0);
    });
  });

  describe('边界条件', () => {
    it('NaN dtSec 不导致异常', () => {
      expect(() => academySys.tickResearch(NaN)).not.toThrow();
      expect(() => academySys.tickTechPoints(NaN)).not.toThrow();
    });

    it('负数 dtSec 不导致异常', () => {
      expect(() => academySys.tickResearch(-1)).not.toThrow();
      expect(() => academySys.tickTechPoints(-1)).not.toThrow();
    });

    it('零 dtSec 不导致异常', () => {
      expect(() => academySys.tickResearch(0)).not.toThrow();
      expect(() => academySys.tickTechPoints(0)).not.toThrow();
    });

    it('不存在的科技ID返回null预览', () => {
      expect(academySys.getTechDetailPreview('nonexistent')).toBeNull();
    });

    it('getTechTreePreview 返回所有24个节点', () => {
      const preview = academySys.getTechTreePreview();
      expect(preview.nodes).toHaveLength(24);
    });
  });
});
