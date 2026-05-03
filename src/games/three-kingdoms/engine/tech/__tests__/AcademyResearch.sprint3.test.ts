/**
 * Sprint 3 — 书院研究系统完整测试
 *
 * 覆盖：
 *   BLD-F29-01: 研究启动（techPoint×10 + 铜钱×5000）
 *   BLD-F29-02: 研究加速（铜钱×1000 → 进度+10%）
 *   BLD-F29-03: 研究完成 → 加成回流（建筑+5%/级，资源+3%/级，战斗+2%/级）
 *   BLD-F29-04: 研究队列管理（书院等级决定队列数）
 *   XI-005: 书院等级 → 可研究科技上限 / 研究速度加成
 *   XI-016: 科技完成 → 建筑产出加成 / 资源产出加成 / 战斗属性加成
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechLinkSystem } from '../TechLinkSystem';
import { TechEffectSystem } from '../TechEffectSystem';
import { TechEffectApplier } from '../TechEffectApplier';
import { AcademyResearchManager } from '../AcademyResearchManager';
import { createRealDeps } from '../../../test-utils/test-helpers';
import {
  TECH_NODE_MAP,
  getQueueSizeForAcademyLevel,
  getMaxResearchableTechCount,
  getAcademyResearchSpeedMultiplier,
  COPPER_SPEEDUP_COST,
  COPPER_SPEEDUP_PROGRESS_PERCENT,
  COPPER_SPEEDUP_MAX_DAILY,
  RESEARCH_START_COPPER_COST,
  RESEARCH_START_TECH_POINT_MULTIPLIER,
  ACADEMY_TECH_CAP_MULTIPLIER,
  ACADEMY_RESEARCH_SPEED_PER_LEVEL,
  TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL,
  TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL,
  TECH_BATTLE_STAT_BONUS_PER_LEVEL,
} from '../tech-config';

/* ═══════════════════════════════════════════
 * 测试辅助
 * ═══════════════════════════════════════════ */

interface TestContext {
  treeSys: TechTreeSystem;
  pointSys: TechPointSystem;
  researchSys: TechResearchSystem;
  linkSys: TechLinkSystem;
  effectSys: TechEffectSystem;
  applier: TechEffectApplier;
  manager: AcademyResearchManager;
  goldAmount: number;
  mandateAmount: number;
  baseTime: number;
}

function createTestContext(academyLevel = 5): TestContext {
  const ctx: TestContext = {
    treeSys: new TechTreeSystem(),
    pointSys: new TechPointSystem(),
    linkSys: new TechLinkSystem(),
    effectSys: new TechEffectSystem(),
    applier: new TechEffectApplier(),
    manager: new AcademyResearchManager(() => academyLevel),
    goldAmount: 100000,
    mandateAmount: 1000,
    baseTime: 1_000_000_000_000,
  };

  ctx.researchSys = new TechResearchSystem(
    ctx.treeSys,
    ctx.pointSys,
    () => academyLevel,
    () => ctx.mandateAmount,
    (amt: number) => {
      if (ctx.mandateAmount >= amt) { ctx.mandateAmount -= amt; return true; }
      return false;
    },
    () => ctx.goldAmount,
    (amt: number) => {
      if (ctx.goldAmount >= amt) { ctx.goldAmount -= amt; return true; }
      return false;
    },
  );

  ctx.effectSys.setTechTree(ctx.treeSys);
  ctx.applier.setTechEffectSystem(ctx.effectSys);

  ctx.manager.setTechTree(ctx.treeSys);
  ctx.manager.setTechResearch(ctx.researchSys);
  ctx.manager.setTechLink(ctx.linkSys);
  ctx.manager.setTechEffectApplier(ctx.applier);

  const deps = createRealDeps();
  ctx.treeSys.init(deps);
  ctx.pointSys.init(deps);
  ctx.researchSys.init(deps);
  ctx.linkSys.init(deps);
  ctx.effectSys.init(deps);

  return ctx;
}

function fundPoints(ctx: TestContext, amount: number): void {
  (ctx.pointSys as any).techPoints.current = amount;
  (ctx.pointSys as any).techPoints.totalEarned += amount;
}

function completeTechQuick(ctx: TestContext, techId: string): void {
  const def = TECH_NODE_MAP.get(techId);
  if (!def) return;
  const cost = def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER;
  fundPoints(ctx, cost + 1000);
  ctx.researchSys.startResearch(techId);
  ctx.researchSys.speedUp(techId, 'ingot', 1);
  ctx.researchSys.update(0);
}

/* ═══════════════════════════════════════════
 * 测试
 * ═══════════════════════════════════════════ */

describe('Sprint 3: 书院研究系统', () => {
  let ctx: TestContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    ctx = createTestContext(5);
    vi.spyOn(Date, 'now').mockReturnValue(ctx.baseTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // BLD-F29-01: 研究启动
  // ═══════════════════════════════════════════
  describe('BLD-F29-01: 研究启动', () => {
    it('消耗 techPoint×10 + 铜钱×5000 开始研究', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      const techPointCost = def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER;
      fundPoints(ctx, techPointCost);

      const goldBefore = ctx.goldAmount;
      const result = ctx.researchSys.startResearch('mil_t1_attack');

      expect(result.success).toBe(true);
      expect(ctx.goldAmount).toBe(goldBefore - RESEARCH_START_COPPER_COST);
    });

    it('消耗科技点 = 节点costPoints × 10', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      const techPointCost = def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER;
      fundPoints(ctx, techPointCost + 100);

      const pointsBefore = ctx.pointSys.getCurrentPoints();
      ctx.researchSys.startResearch('mil_t1_attack');

      expect(ctx.pointSys.getCurrentPoints()).toBeCloseTo(pointsBefore - techPointCost);
    });

    it('消耗铜钱 = 5000', () => {
      fundPoints(ctx, 10000);
      const goldBefore = ctx.goldAmount;
      ctx.researchSys.startResearch('mil_t1_attack');
      expect(ctx.goldAmount).toBe(goldBefore - 5000);
    });

    it('科技点不足无法启动研究', () => {
      fundPoints(ctx, 10);
      const result = ctx.researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('铜钱不足无法启动研究', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER + 100);
      ctx.goldAmount = 1000;
      const result = ctx.researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('铜钱不足');
    });

    it('铜钱不足时科技点不被扣除', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER + 100);
      ctx.goldAmount = 1000;
      const pointsBefore = ctx.pointSys.getCurrentPoints();
      ctx.researchSys.startResearch('mil_t1_attack');
      expect(ctx.pointSys.getCurrentPoints()).toBe(pointsBefore);
    });

    it('不存在的节点无法研究', () => {
      fundPoints(ctx, 10000);
      const result = ctx.researchSys.startResearch('nonexistent');
      expect(result.success).toBe(false);
    });

    it('前置未完成无法研究高级科技', () => {
      fundPoints(ctx, 100000);
      const result = ctx.researchSys.startResearch('mil_t2_charge');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('前置');
    });
  });

  // ═══════════════════════════════════════════
  // BLD-F29-02: 研究加速（铜钱）
  // ═══════════════════════════════════════════
  describe('BLD-F29-02: 研究加速（铜钱）', () => {
    beforeEach(() => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER + 1000);
      ctx.researchSys.startResearch('mil_t1_attack');
    });

    it('消耗铜钱×1000 加速研究进度+10%', () => {
      const goldBefore = ctx.goldAmount;
      const result = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);

      expect(result.success).toBe(true);
      expect(result.cost).toBe(COPPER_SPEEDUP_COST);
      expect(ctx.goldAmount).toBe(goldBefore - COPPER_SPEEDUP_COST);
    });

    it('铜钱加速进度增加10%', () => {
      const slot = ctx.researchSys.getQueue()[0];
      const totalDuration = slot!.endTime - slot!.startTime;
      const expectedReduction = totalDuration * (COPPER_SPEEDUP_PROGRESS_PERCENT / 100);

      const result = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);

      expect(result.success).toBe(true);
      expect(result.timeReduced).toBeCloseTo(expectedReduction / 1000, 0);
    });

    it('铜钱不足时加速失败', () => {
      ctx.goldAmount = 500;
      const result = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('铜钱不足');
    });

    it('每日铜钱加速上限10次', () => {
      for (let i = 0; i < COPPER_SPEEDUP_MAX_DAILY; i++) {
        const result = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
        expect(result.success).toBe(true);
      }
      const result = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('次数已用完');
    });

    it('查询铜钱加速已用次数正确', () => {
      expect(ctx.researchSys.getCopperSpeedUpCount()).toBe(0);
      ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(ctx.researchSys.getCopperSpeedUpCount()).toBe(1);
    });

    it('查询铜钱加速剩余次数正确', () => {
      expect(ctx.researchSys.getCopperSpeedUpRemaining()).toBe(COPPER_SPEEDUP_MAX_DAILY);
      ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(ctx.researchSys.getCopperSpeedUpRemaining()).toBe(COPPER_SPEEDUP_MAX_DAILY - 1);
    });

    it('多次铜钱加速进度正确叠加', () => {
      const slot0 = ctx.researchSys.getQueue()[0];
      const endTime0 = slot0!.endTime;
      const totalDuration = slot0!.endTime - slot0!.startTime;
      const reductionPer = totalDuration * (COPPER_SPEEDUP_PROGRESS_PERCENT / 100);

      ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      const slot1 = ctx.researchSys.getQueue().find(s => s.techId === 'mil_t1_attack');
      expect(slot1!.endTime).toBe(endTime0 - reductionPer);

      // 第二次加速基于新的总时长（startTime不变，endTime已缩短）
      const slot1Data = ctx.researchSys.getQueue()[0];
      const totalDuration2 = slot1Data!.endTime - slot1Data!.startTime;
      const reductionPer2 = totalDuration2 * (COPPER_SPEEDUP_PROGRESS_PERCENT / 100);

      ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      const slot2 = ctx.researchSys.getQueue().find(s => s.techId === 'mil_t1_attack');
      expect(slot2!.endTime).toBe(slot1!.endTime - reductionPer2);
    });

    it('加速不存在的科技返回失败', () => {
      const result = ctx.researchSys.speedUp('nonexistent', 'copper', 1);
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // BLD-F29-03: 研究完成 → 加成回流
  // ═══════════════════════════════════════════
  describe('BLD-F29-03: 研究完成 → 加成回流', () => {
    it('完成1个科技 → 建筑产出加成+5%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.buildingProductionBonus).toBe(TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL);
    });

    it('完成1个科技 → 资源产出加成+3%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.resourceProductionBonus).toBe(TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL);
    });

    it('完成1个科技 → 战斗属性加成+2%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.battleStatBonus).toBe(TECH_BATTLE_STAT_BONUS_PER_LEVEL);
    });

    it('完成2个科技 → 建筑产出加成+10%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      completeTechQuick(ctx, 'eco_t1_farming');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.buildingProductionBonus).toBe(TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL * 2);
    });

    it('完成2个科技 → 资源产出加成+6%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      completeTechQuick(ctx, 'eco_t1_farming');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.resourceProductionBonus).toBe(TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL * 2);
    });

    it('完成3个科技 → 战斗属性加成+6%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      completeTechQuick(ctx, 'eco_t1_farming');
      completeTechQuick(ctx, 'cul_t1_education');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.battleStatBonus).toBe(TECH_BATTLE_STAT_BONUS_PER_LEVEL * 3);
    });

    it('建筑产出乘数 = 1 + bonus/100', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const multiplier = ctx.manager.getBuildingProductionMultiplier();
      expect(multiplier).toBe(1 + TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL / 100);
    });

    it('资源产出乘数 = 1 + bonus/100', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const multiplier = ctx.manager.getResourceProductionMultiplier();
      expect(multiplier).toBe(1 + TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL / 100);
    });

    it('战斗属性乘数 = 1 + bonus/100', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const multiplier = ctx.manager.getBattleStatMultiplier();
      expect(multiplier).toBe(1 + TECH_BATTLE_STAT_BONUS_PER_LEVEL / 100);
    });

    it('未完成科技时加成为0', () => {
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.buildingProductionBonus).toBe(0);
      expect(snapshot.resourceProductionBonus).toBe(0);
      expect(snapshot.battleStatBonus).toBe(0);
    });

    it('完成科技后节点状态变为completed', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');
    });

    it('完成科技后队列清空', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.researchSys.getQueue()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // BLD-F29-04: 研究队列管理
  // ═══════════════════════════════════════════
  describe('BLD-F29-04: 研究队列管理', () => {
    it('书院Lv1 → 1个队列', () => {
      expect(getQueueSizeForAcademyLevel(1)).toBe(1);
    });

    it('书院Lv5 → 2个队列', () => {
      expect(getQueueSizeForAcademyLevel(5)).toBe(2);
    });

    it('书院Lv10 → 3个队列', () => {
      expect(getQueueSizeForAcademyLevel(10)).toBe(3);
    });

    it('书院Lv15 → 4个队列', () => {
      expect(getQueueSizeForAcademyLevel(15)).toBe(4);
    });

    it('书院Lv20 → 5个队列', () => {
      expect(getQueueSizeForAcademyLevel(20)).toBe(5);
    });

    it('队列已满 → 无法新增研究', () => {
      fundPoints(ctx, 100000);
      ctx.researchSys.startResearch('mil_t1_attack');
      ctx.researchSys.startResearch('eco_t1_farming');
      const result = ctx.researchSys.startResearch('cul_t1_education');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('队列已满');
    });

    it('同一科技不能重复入队', () => {
      fundPoints(ctx, 100000);
      ctx.researchSys.startResearch('mil_t1_attack');
      const result = ctx.researchSys.startResearch('mil_t1_attack');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('研究');
    });

    it('队列大小随书院等级递增', () => {
      const levels = [1, 5, 10, 15, 20];
      const sizes = levels.map(l => getQueueSizeForAcademyLevel(l));
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      }
    });

    it('取消研究后队列空出位置', () => {
      fundPoints(ctx, 100000);
      ctx.researchSys.startResearch('mil_t1_attack');
      ctx.researchSys.startResearch('eco_t1_farming');
      ctx.researchSys.cancelResearch('mil_t1_attack');
      const result = ctx.researchSys.startResearch('cul_t1_education');
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // XI-005: 书院等级 → 科技上限 / 研究速度
  // ═══════════════════════════════════════════
  describe('XI-005: 书院等级 → 科技系统影响', () => {
    it('书院Lv1 → 可研究科技上限2', () => {
      expect(getMaxResearchableTechCount(1)).toBe(1 * ACADEMY_TECH_CAP_MULTIPLIER);
    });

    it('书院Lv5 → 可研究科技上限10', () => {
      expect(getMaxResearchableTechCount(5)).toBe(5 * ACADEMY_TECH_CAP_MULTIPLIER);
    });

    it('书院Lv10 → 可研究科技上限20', () => {
      expect(getMaxResearchableTechCount(10)).toBe(10 * ACADEMY_TECH_CAP_MULTIPLIER);
    });

    it('书院Lv0 → 可研究科技上限0', () => {
      expect(getMaxResearchableTechCount(0)).toBe(0);
    });

    it('研究速度 = 1 + 书院等级×0.1', () => {
      expect(getAcademyResearchSpeedMultiplier(1)).toBeCloseTo(1.1);
      expect(getAcademyResearchSpeedMultiplier(5)).toBeCloseTo(1.5);
      expect(getAcademyResearchSpeedMultiplier(10)).toBeCloseTo(2.0);
    });

    it('书院Lv1 → 研究速度1.1倍', () => {
      const ctx1 = createTestContext(1);
      expect(ctx1.manager.getAcademyResearchSpeedMultiplier()).toBeCloseTo(1.1);
    });

    it('书院Lv10 → 研究速度2.0倍', () => {
      const ctx10 = createTestContext(10);
      expect(ctx10.manager.getAcademyResearchSpeedMultiplier()).toBeCloseTo(2.0);
    });

    it('书院等级影响实际研究时间', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      const expectedTime = def.researchTime / 1.5;

      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER + 1000);
      ctx.researchSys.startResearch('mil_t1_attack');

      const slot = ctx.researchSys.getQueue()[0];
      const actualTime = (slot!.endTime - slot!.startTime) / 1000;
      expect(actualTime).toBeCloseTo(expectedTime, 0);
    });

    it('可研究科技上限满时无法启动新研究', () => {
      const ctx1 = createTestContext(1);
      completeTechQuick(ctx1, 'mil_t1_attack');
      completeTechQuick(ctx1, 'eco_t1_farming');

      fundPoints(ctx1, 100000);
      const result = ctx1.researchSys.startResearch('cul_t1_education');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('上限已满');
    });

    it('书院等级不足无法研究高级科技（层级检查）', () => {
      expect(ctx.manager.canResearchAtTier(1)).toBe(true);
      expect(ctx.manager.canResearchAtTier(5)).toBe(true);
      expect(ctx.manager.canResearchAtTier(6)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // XI-016: 科技完成 → 加成回流
  // ═══════════════════════════════════════════
  describe('XI-016: 科技完成 → 加成回流', () => {
    it('建筑产出加成 = 已完成科技数 × 5%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.manager.getTechBonusSnapshot().buildingProductionBonus).toBe(5);

      completeTechQuick(ctx, 'eco_t1_farming');
      expect(ctx.manager.getTechBonusSnapshot().buildingProductionBonus).toBe(10);
    });

    it('资源产出加成 = 已完成科技数 × 3%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.manager.getTechBonusSnapshot().resourceProductionBonus).toBe(3);

      completeTechQuick(ctx, 'eco_t1_farming');
      expect(ctx.manager.getTechBonusSnapshot().resourceProductionBonus).toBe(6);
    });

    it('战斗属性加成 = 已完成科技数 × 2%', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.manager.getTechBonusSnapshot().battleStatBonus).toBe(2);

      completeTechQuick(ctx, 'eco_t1_farming');
      expect(ctx.manager.getTechBonusSnapshot().battleStatBonus).toBe(4);
    });

    it('TechEffectApplier 正确读取科技效果', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      // mil_t1_attack: troop_attack +10%
      const battleBonuses = ctx.applier.getBattleBonuses('all');
      expect(battleBonuses.attackMultiplier).toBeCloseTo(1.1);
    });

    it('TechLinkSystem 正确注册建筑联动', () => {
      ctx.linkSys.addCompletedTech('eco_t1_farming');
      const bonus = ctx.linkSys.getBuildingLinkBonus('farm');
      expect(bonus.productionBonus).toBeGreaterThan(0);
    });

    it('TechLinkSystem 正确注册资源联动', () => {
      ctx.linkSys.addCompletedTech('eco_t1_farming');
      const bonus = ctx.linkSys.getResourceLinkBonus('grain');
      expect(bonus.productionBonus).toBeGreaterThan(0);
    });

    it('科技效果通过 TechEffectSystem 正确聚合', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const atkBonus = ctx.effectSys.getAttackBonus('all');
      expect(atkBonus).toBe(10);
    });

    it('多个科技效果正确叠加', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      // mil_t1_attack: troop_attack all +10
      completeTechQuick(ctx, 'mil_t2_charge');
      // mil_t2_charge: troop_attack cavalry +15, march_speed all +5

      const allAtk = ctx.effectSys.getAttackBonus('all');
      expect(allAtk).toBe(10); // 只有 mil_t1_attack 是 all

      // getAttackBonus('cavalry') 匹配 target='cavalry' 和 target='all'
      const cavalryAtk = ctx.effectSys.getAttackBonus('cavalry');
      expect(cavalryAtk).toBe(25); // 10 (all) + 15 (cavalry)
    });
  });

  // ═══════════════════════════════════════════
  // 配置常量验证
  // ═══════════════════════════════════════════
  describe('配置常量验证', () => {
    it('COPPER_SPEEDUP_COST = 1000', () => {
      expect(COPPER_SPEEDUP_COST).toBe(1000);
    });

    it('COPPER_SPEEDUP_PROGRESS_PERCENT = 10', () => {
      expect(COPPER_SPEEDUP_PROGRESS_PERCENT).toBe(10);
    });

    it('COPPER_SPEEDUP_MAX_DAILY = 10', () => {
      expect(COPPER_SPEEDUP_MAX_DAILY).toBe(10);
    });

    it('RESEARCH_START_COPPER_COST = 5000', () => {
      expect(RESEARCH_START_COPPER_COST).toBe(5000);
    });

    it('RESEARCH_START_TECH_POINT_MULTIPLIER = 10', () => {
      expect(RESEARCH_START_TECH_POINT_MULTIPLIER).toBe(10);
    });

    it('ACADEMY_TECH_CAP_MULTIPLIER = 2', () => {
      expect(ACADEMY_TECH_CAP_MULTIPLIER).toBe(2);
    });

    it('ACADEMY_RESEARCH_SPEED_PER_LEVEL = 0.1', () => {
      expect(ACADEMY_RESEARCH_SPEED_PER_LEVEL).toBe(0.1);
    });

    it('TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL = 5', () => {
      expect(TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL).toBe(5);
    });

    it('TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL = 3', () => {
      expect(TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL).toBe(3);
    });

    it('TECH_BATTLE_STAT_BONUS_PER_LEVEL = 2', () => {
      expect(TECH_BATTLE_STAT_BONUS_PER_LEVEL).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // AcademyResearchManager
  // ═══════════════════════════════════════════
  describe('AcademyResearchManager', () => {
    it('getAcademyState 返回正确快照', () => {
      const state = ctx.manager.getAcademyState();
      expect(state.academyLevel).toBe(5);
      expect(state.maxTechCount).toBe(10);
      expect(state.researchSpeedMultiplier).toBeCloseTo(1.5);
      expect(state.queueSize).toBe(2);
    });

    it('getTechBonusSnapshot 返回正确快照', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.completedTechCount).toBe(1);
      expect(snapshot.buildingProductionBonus).toBe(5);
      expect(snapshot.resourceProductionBonus).toBe(3);
      expect(snapshot.battleStatBonus).toBe(2);
    });

    it('getBuildingProductionMultiplier 返回正确乘数', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.manager.getBuildingProductionMultiplier()).toBeCloseTo(1.05);
    });

    it('getResourceProductionMultiplier 返回正确乘数', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.manager.getResourceProductionMultiplier()).toBeCloseTo(1.03);
    });

    it('getBattleStatMultiplier 返回正确乘数', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      expect(ctx.manager.getBattleStatMultiplier()).toBeCloseTo(1.02);
    });
  });

  // ═══════════════════════════════════════════
  // 完整链路测试
  // ═══════════════════════════════════════════
  describe('完整链路', () => {
    it('启动→加速→完成→加成回流 完整流程', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      const techPointCost = def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER;
      fundPoints(ctx, techPointCost + 10000);

      const goldBefore = ctx.goldAmount;
      const startResult = ctx.researchSys.startResearch('mil_t1_attack');
      expect(startResult.success).toBe(true);
      expect(ctx.goldAmount).toBe(goldBefore - RESEARCH_START_COPPER_COST);

      const goldBefore2 = ctx.goldAmount;
      const speedUpResult = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(speedUpResult.success).toBe(true);
      expect(ctx.goldAmount).toBe(goldBefore2 - COPPER_SPEEDUP_COST);

      ctx.researchSys.speedUp('mil_t1_attack', 'ingot', 1);
      ctx.researchSys.update(0);
      expect(ctx.treeSys.getNodeState('mil_t1_attack')?.status).toBe('completed');

      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.completedTechCount).toBe(1);
      expect(snapshot.buildingProductionBonus).toBe(5);
      expect(snapshot.resourceProductionBonus).toBe(3);
      expect(snapshot.battleStatBonus).toBe(2);
    });

    it('多科技完成 → 加成叠加', () => {
      completeTechQuick(ctx, 'mil_t1_attack');
      completeTechQuick(ctx, 'eco_t1_farming');
      completeTechQuick(ctx, 'cul_t1_education');

      const snapshot = ctx.manager.getTechBonusSnapshot();
      expect(snapshot.completedTechCount).toBe(3);
      expect(snapshot.buildingProductionBonus).toBe(15);
      expect(snapshot.resourceProductionBonus).toBe(9);
      expect(snapshot.battleStatBonus).toBe(6);
    });

    it('取消研究后可重新启动', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER * 2 + 20000);

      ctx.researchSys.startResearch('mil_t1_attack');
      const cancelResult = ctx.researchSys.cancelResearch('mil_t1_attack');
      expect(cancelResult.success).toBe(true);

      const restartResult = ctx.researchSys.startResearch('mil_t1_attack');
      expect(restartResult.success).toBe(true);
    });

    it('天命加速与铜钱加速可叠加使用', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER + 10000);

      ctx.researchSys.startResearch('mil_t1_attack');

      const mandateResult = ctx.researchSys.speedUp('mil_t1_attack', 'mandate', 1);
      expect(mandateResult.success).toBe(true);

      const copperResult = ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(copperResult.success).toBe(true);

      const slot = ctx.researchSys.getQueue()[0];
      expect(slot).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 边界防护
  // ═══════════════════════════════════════════
  describe('边界防护', () => {
    it('getMaxResearchableTechCount(NaN) = 0', () => {
      expect(getMaxResearchableTechCount(NaN)).toBe(0);
    });

    it('getMaxResearchableTechCount(-1) = 0', () => {
      expect(getMaxResearchableTechCount(-1)).toBe(0);
    });

    it('getAcademyResearchSpeedMultiplier(NaN) = 1', () => {
      expect(getAcademyResearchSpeedMultiplier(NaN)).toBe(1);
    });

    it('getAcademyResearchSpeedMultiplier(-1) = 1', () => {
      expect(getAcademyResearchSpeedMultiplier(-1)).toBe(1);
    });

    it('getAcademyResearchSpeedMultiplier(0) = 1', () => {
      expect(getAcademyResearchSpeedMultiplier(0)).toBe(1);
    });

    it('铜钱加速参数查询正确', () => {
      expect(ctx.researchSys.getCopperSpeedUpCost()).toBe(COPPER_SPEEDUP_COST);
      expect(ctx.researchSys.getCopperSpeedUpProgressPercent()).toBe(COPPER_SPEEDUP_PROGRESS_PERCENT);
      expect(ctx.researchSys.getCopperSpeedUpMaxDaily()).toBe(COPPER_SPEEDUP_MAX_DAILY);
    });

    it('reset 清空铜钱加速状态', () => {
      const def = TECH_NODE_MAP.get('mil_t1_attack')!;
      fundPoints(ctx, def.costPoints * RESEARCH_START_TECH_POINT_MULTIPLIER + 10000);
      ctx.researchSys.startResearch('mil_t1_attack');
      ctx.researchSys.speedUp('mil_t1_attack', 'copper', 1);
      expect(ctx.researchSys.getCopperSpeedUpCount()).toBe(1);

      ctx.researchSys.reset();
      expect(ctx.researchSys.getCopperSpeedUpCount()).toBe(0);
    });
  });
});
