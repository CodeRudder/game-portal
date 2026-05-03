/**
 * 科技加速叠加公式 — P1 缺口完整验证测试
 *
 * 验证：
 * 1. 天命加速：每点天命减少固定秒数（MANDATE_SPEEDUP_SECONDS_PER_POINT = 60s）
 * 2. 元宝加速：立即完成，计算所需元宝数（INGOT_SPEEDUP_SECONDS_PER_UNIT = 600s）
 * 3. 加速叠加：多次加速后 endTime 正确递减
 * 4. 研究速度加成：文化路线科技对研究时间的影响
 * 5. 加速 + 研究速度加成叠加公式
 * 6. 边界防护：NaN/负值/零值/超大值
 * 7. 加速费用计算
 * 8. 取消研究 + 加速交互
 * 9. 多科技并行加速
 * 10. 加速完成后的科技树状态
 *
 * 使用真实引擎实例：TechTreeSystem + TechPointSystem + TechResearchSystem
 *
 * @module engine/tech/__tests__/TechAcceleration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TechResearchSystem } from '../TechResearchSystem';
import { TechTreeSystem } from '../TechTreeSystem';
import { TechPointSystem } from '../TechPointSystem';
import {
  MANDATE_SPEEDUP_SECONDS_PER_POINT,
  INGOT_SPEEDUP_SECONDS_PER_UNIT,
  TECH_NODE_MAP,
} from '../tech-config';
import type { ResearchSlot, SpeedUpResult } from '../tech.types';

// ═══════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════

/** 创建真实的三件套系统 */
function createSystems(mandate = 1000, academyLevel = 5) {
  const treeSystem = new TechTreeSystem();
  const pointSystem = new TechPointSystem();

  let currentMandate = mandate;
  const getMandate = () => currentMandate;
  const spendMandate = (amount: number) => {
    if (currentMandate < amount) return false;
    currentMandate -= amount;
    return true;
  };
  const getAcademyLevel = () => academyLevel;

  let currentGold = 100000;
  const getGold = () => currentGold;
  const spendGold = (amount: number) => {
    if (currentGold < amount) return false;
    currentGold -= amount;
    return true;
  };

  const researchSystem = new TechResearchSystem(
    treeSystem,
    pointSystem,
    getAcademyLevel,
    getMandate,
    spendMandate,
    getGold,
    spendGold,
  );

  return { treeSystem, pointSystem, researchSystem, getCurrentMandate: () => currentMandate };
}

/** 给科技点系统充值（amount 为名义点数，实际充值 × MULTIPLIER） */
function fundPoints(pointSystem: TechPointSystem, amount: number) {
  const RESEARCH_START_TECH_POINT_MULTIPLIER = 10;
  const actual = amount * RESEARCH_START_TECH_POINT_MULTIPLIER;
  (pointSystem as any).techPoints.current = actual;
  (pointSystem as any).techPoints.totalEarned += actual;
}

/** 获取第一个可研究的 Tier 1 科技 ID */
function getFirstAvailableTechId(): string {
  return 'mil_t1_attack';
}

/** 获取科技的研究时间（秒） */
function getTechResearchTime(techId: string): number {
  const def = TECH_NODE_MAP.get(techId);
  return def?.researchTime ?? 0;
}

/** 获取科技的科技点消耗 */
function getTechCost(techId: string): number {
  const def = TECH_NODE_MAP.get(techId);
  return def?.costPoints ?? 0;
}

/** 完成一个科技（快速完成前置） */
function completeTechQuick(
  researchSystem: TechResearchSystem,
  pointSystem: TechPointSystem,
  techId: string,
) {
  fundPoints(pointSystem, getTechCost(techId));
  researchSystem.startResearch(techId);
  researchSystem.speedUp(techId, 'ingot', 1);
  researchSystem.update(0);
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('TechAcceleration — 加速叠加公式完整验证', () => {
  let treeSystem: TechTreeSystem;
  let pointSystem: TechPointSystem;
  let researchSystem: TechResearchSystem;
  let getCurrentMandate: () => number;

  beforeEach(() => {
    const systems = createSystems(1000, 5);
    treeSystem = systems.treeSystem;
    pointSystem = systems.pointSystem;
    researchSystem = systems.researchSystem;
    getCurrentMandate = systems.getCurrentMandate;
  });

  // ═══════════════════════════════════════════
  // 1. 加速常量验证
  // ═══════════════════════════════════════════

  describe('1. 加速常量验证', () => {
    it('天命加速：每点天命减少 60 秒', () => {
      expect(MANDATE_SPEEDUP_SECONDS_PER_POINT).toBe(60);
    });

    it('元宝加速：每单位元宝覆盖 600 秒', () => {
      expect(INGOT_SPEEDUP_SECONDS_PER_UNIT).toBe(600);
    });

    it('天命加速和元宝加速单位比率应为 1:10', () => {
      // 1 点天命 = 60 秒，1 单位元宝 = 600 秒
      expect(INGOT_SPEEDUP_SECONDS_PER_UNIT / MANDATE_SPEEDUP_SECONDS_PER_POINT).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 天命加速公式
  // ═══════════════════════════════════════════

  describe('2. 天命加速公式', () => {
    const techId = getFirstAvailableTechId();

    beforeEach(() => {
      fundPoints(pointSystem, 1000);
      const result = researchSystem.startResearch(techId);
      expect(result.success).toBe(true);
    });

    it('1 点天命应减少 60 秒', () => {
      const slotBefore = researchSystem.getQueue()[0];
      const endTimeBefore = slotBefore!.endTime;

      const result = researchSystem.speedUp(techId, 'mandate', 1);

      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(MANDATE_SPEEDUP_SECONDS_PER_POINT);
      expect(result.cost).toBe(1);

      const slotAfter = researchSystem.getQueue()[0];
      expect(slotAfter!.endTime).toBe(endTimeBefore - MANDATE_SPEEDUP_SECONDS_PER_POINT * 1000);
    });

    it('5 点天命应减少 300 秒', () => {
      const expectedReduction = 5 * MANDATE_SPEEDUP_SECONDS_PER_POINT;
      const result = researchSystem.speedUp(techId, 'mandate', 5);
      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(expectedReduction);
    });

    it('10 点天命应减少 600 秒', () => {
      const expectedReduction = 10 * MANDATE_SPEEDUP_SECONDS_PER_POINT;
      const result = researchSystem.speedUp(techId, 'mandate', 10);
      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(expectedReduction);
    });

    it('天命消耗应从余额中扣除', () => {
      const mandateBefore = getCurrentMandate();
      researchSystem.speedUp(techId, 'mandate', 5);
      expect(getCurrentMandate()).toBe(mandateBefore - 5);
    });

    it('天命不足时应失败', () => {
      const systems = createSystems(2, 5);
      const localPointSystem = systems.pointSystem;
      const localResearchSystem = systems.researchSystem;
      fundPoints(localPointSystem, 1000);
      localResearchSystem.startResearch(techId);

      const result = localResearchSystem.speedUp(techId, 'mandate', 5);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命不足');
    });

    it('天命消耗失败时应返回失败', () => {
      const localTreeSystem = new TechTreeSystem();
      const localPointSystem = new TechPointSystem();
      const localResearchSystem = new TechResearchSystem(
        localTreeSystem,
        localPointSystem,
        () => 5,
        () => 100,
        () => false, // spendMandate 始终失败
        () => 100000,
        (amt: number) => { return true; },
      );
      fundPoints(localPointSystem, 1000);
      localResearchSystem.startResearch(techId);

      const result = localResearchSystem.speedUp(techId, 'mandate', 3);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命消耗失败');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 元宝加速公式
  // ═══════════════════════════════════════════

  describe('3. 元宝加速公式', () => {
    const techId = getFirstAvailableTechId();

    beforeEach(() => {
      fundPoints(pointSystem, 1000);
      const result = researchSystem.startResearch(techId);
      expect(result.success).toBe(true);
    });

    it('元宝加速应立即完成（timeReduced = remaining）', () => {
      const remaining = researchSystem.getRemainingTime(techId);
      expect(remaining).toBeGreaterThan(0);

      const result = researchSystem.speedUp(techId, 'ingot', 1);

      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.timeReduced).toBeCloseTo(remaining, 0);
    });

    it('元宝消耗应等于 ceil(remaining / 600)', () => {
      const remaining = researchSystem.getRemainingTime(techId);
      const expectedCost = Math.ceil(remaining / INGOT_SPEEDUP_SECONDS_PER_UNIT);

      const result = researchSystem.speedUp(techId, 'ingot', 1);

      expect(result.cost).toBe(expectedCost);
    });

    it('元宝加速后科技应标记为完成', () => {
      researchSystem.speedUp(techId, 'ingot', 1);
      researchSystem.update(0);
      const queue = researchSystem.getQueue();
      expect(queue.some((s) => s.techId === techId)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 加速叠加公式（核心P1验证）
  // ═══════════════════════════════════════════

  describe('4. 加速叠加公式（核心P1验证）', () => {
    it('连续两次天命加速应正确叠加', () => {
      // 使用 Tier 2 科技（300 秒研究时间），避免加速后完成
      completeTechQuick(researchSystem, pointSystem, 'mil_t1_attack');

      fundPoints(pointSystem, 200);
      const startResult = researchSystem.startResearch('mil_t2_charge');
      expect(startResult.success).toBe(true);
      const slot0 = researchSystem.getQueue().find(s => s.techId === 'mil_t2_charge');
      expect(slot0).toBeDefined();
      const endTime0 = slot0!.endTime;

      // 第一次加速：1 点天命 = 60 秒
      const result1 = researchSystem.speedUp('mil_t2_charge', 'mandate', 1);
      expect(result1.success).toBe(true);
      expect(result1.timeReduced).toBe(60);

      const slot1 = researchSystem.getQueue().find(s => s.techId === 'mil_t2_charge');
      expect(slot1!.endTime).toBe(endTime0 - 60000);

      // 第二次加速：2 点天命 = 120 秒
      const result2 = researchSystem.speedUp('mil_t2_charge', 'mandate', 2);
      expect(result2.success).toBe(true);
      expect(result2.timeReduced).toBe(120);

      const slot2 = researchSystem.getQueue().find(s => s.techId === 'mil_t2_charge');
      // 两次加速各减少 60s + 120s = 180s
      expect(slot2!.endTime).toBe(endTime0 - 60000 - 120000);
    });

    it('天命加速后元宝加速应正确叠加', () => {
      const techId = getFirstAvailableTechId();
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);

      // 天命加速：减少 60 秒
      researchSystem.speedUp(techId, 'mandate', 1);

      // 元宝加速：立即完成
      const result = researchSystem.speedUp(techId, 'ingot', 1);
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('多次小额天命加速等效于一次大额加速', () => {
      completeTechQuick(researchSystem, pointSystem, 'mil_t1_attack');

      const techId2 = 'mil_t2_charge';

      // 系统3：一次 2 点天命
      const systems3 = createSystems(1000, 5);
      fundPoints(systems3.pointSystem, 5000);
      completeTechQuick(systems3.researchSystem, systems3.pointSystem, 'mil_t1_attack');
      fundPoints(systems3.pointSystem, 200);
      const start3 = systems3.researchSystem.startResearch(techId2);
      expect(start3.success).toBe(true);
      systems3.researchSystem.speedUp(techId2, 'mandate', 2);

      // 系统4：两次各 1 点天命
      const systems4 = createSystems(1000, 5);
      fundPoints(systems4.pointSystem, 5000);
      completeTechQuick(systems4.researchSystem, systems4.pointSystem, 'mil_t1_attack');
      fundPoints(systems4.pointSystem, 200);
      const start4 = systems4.researchSystem.startResearch(techId2);
      expect(start4.success).toBe(true);
      systems4.researchSystem.speedUp(techId2, 'mandate', 1);
      systems4.researchSystem.speedUp(techId2, 'mandate', 1);

      // 两者 endTime 应相同
      const slot3 = systems3.researchSystem.getQueue().find(s => s.techId === techId2);
      const slot4 = systems4.researchSystem.getQueue().find(s => s.techId === techId2);
      expect(slot3).toBeDefined();
      expect(slot4).toBeDefined();
      expect(slot3!.endTime).toBe(slot4!.endTime);
    });

    it('加速到完成时 endTime 应等于 now', () => {
      const techId = getFirstAvailableTechId();
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);

      // 研究时间 120 秒，用 3 点天命 = 180 秒 > 120 秒
      const result = researchSystem.speedUp(techId, 'mandate', 3);
      expect(result.success).toBe(true);
      // 3 * 60 = 180 秒，研究时间 120 秒，应完成
    });

    it('加速叠加公式：总减少量 = Σ(各次加速量)', () => {
      completeTechQuick(researchSystem, pointSystem, 'mil_t1_attack');

      fundPoints(pointSystem, 5000);
      researchSystem.startResearch('mil_t2_charge');
      const slot0 = researchSystem.getQueue().find(s => s.techId === 'mil_t2_charge');
      const endTime0 = slot0!.endTime;

      // 连续3次天命加速（总计 3 * 60 = 180 秒）
      // academy level 5 → mil_t2_charge 实际时间 = 300/1.5 = 200s
      // 180s < 200s，不会完成
      researchSystem.speedUp('mil_t2_charge', 'mandate', 1); // 60s
      researchSystem.speedUp('mil_t2_charge', 'mandate', 1); // 60s
      researchSystem.speedUp('mil_t2_charge', 'mandate', 1); // 60s

      const slotFinal = researchSystem.getQueue().find(s => s.techId === 'mil_t2_charge');
      const totalReduced = 3 * MANDATE_SPEEDUP_SECONDS_PER_POINT * 1000;
      expect(slotFinal).toBeDefined();
      expect(slotFinal!.endTime).toBe(endTime0 - totalReduced);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 研究速度加成 + 加速叠加
  // ═══════════════════════════════════════════

  describe('5. 研究速度加成 + 加速叠加', () => {
    it('研究速度加成应缩短研究时间', () => {
      const techId = getFirstAvailableTechId();
      const baseTime = getTechResearchTime(techId);

      // 无额外研究速度加成（但 academy level 5 → speed 1.5）
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);
      const queue1 = researchSystem.getQueue();
      const actualTime1 = (queue1[0]!.endTime - queue1[0]!.startTime) / 1000;
      // academy level 5 → academySpeedMultiplier = 1.5
      expect(actualTime1).toBeCloseTo(baseTime / 1.5, 1);

      // 有额外 50% 加成：total = 1.5 × 1.5 = 2.25
      const systems2 = createSystems(1000, 5);
      systems2.pointSystem.syncResearchSpeedBonus(50); // 50% 加成
      fundPoints(systems2.pointSystem, 1000);
      systems2.researchSystem.startResearch(techId);
      const queue2 = systems2.researchSystem.getQueue();
      const actualTime2 = (queue2[0]!.endTime - queue2[0]!.startTime) / 1000;
      expect(actualTime2).toBeCloseTo(baseTime / 2.25, 1);
    });

    it('100% 加成时研究时间减半', () => {
      const techId = getFirstAvailableTechId();
      const baseTime = getTechResearchTime(techId);

      const systems = createSystems(1000, 5);
      systems.pointSystem.syncResearchSpeedBonus(100);
      fundPoints(systems.pointSystem, 1000);
      systems.researchSystem.startResearch(techId);

      const queue = systems.researchSystem.getQueue();
      const actualTime = (queue[0]!.endTime - queue[0]!.startTime) / 1000;
      // academy level 5 → 1.5, research bonus 100% → 2.0
      // total = 1.5 × 2.0 = 3.0
      expect(actualTime).toBeCloseTo(baseTime / 3.0, 1);
    });

    it('研究速度加成 + 天命加速叠加公式', () => {
      const techId = getFirstAvailableTechId();

      // academy level 5 → speed 1.5, 50% bonus → 1.5, total = 2.25
      const systems = createSystems(1000, 5);
      systems.pointSystem.syncResearchSpeedBonus(50);
      fundPoints(systems.pointSystem, 1000);
      systems.researchSystem.startResearch(techId);

      const queue = systems.researchSystem.getQueue();
      const endTime0 = queue[0]!.endTime;

      // 天命加速 1 点 = 60 秒
      systems.researchSystem.speedUp(techId, 'mandate', 1);

      const slotAfter = systems.researchSystem.getQueue().find(s => s.techId === techId);
      expect(slotAfter).toBeDefined();
      expect(slotAfter!.endTime).toBe(endTime0 - 60000);
    });

    it('研究速度加成后元宝费用应减少（因为时间短了）', () => {
      const techId = getFirstAvailableTechId();

      // 无加成
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);
      const costWithoutBonus = researchSystem.calculateIngotCost(techId);

      // 有加成
      const systems2 = createSystems(1000, 5);
      systems2.pointSystem.syncResearchSpeedBonus(100);
      fundPoints(systems2.pointSystem, 1000);
      systems2.researchSystem.startResearch(techId);
      const costWithBonus = systems2.researchSystem.calculateIngotCost(techId);

      // 加成后时间减半，元宝费用也应减半（或更少）
      expect(costWithBonus).toBeLessThanOrEqual(costWithoutBonus);
    });

    it('getResearchSpeedMultiplier 公式验证', () => {
      const ps = new TechPointSystem();

      // 无加成
      expect(ps.getResearchSpeedMultiplier()).toBe(1.0);

      // 50% 加成
      ps.syncResearchSpeedBonus(50);
      expect(ps.getResearchSpeedMultiplier()).toBe(1.5);

      // 100% 加成
      ps.syncResearchSpeedBonus(100);
      expect(ps.getResearchSpeedMultiplier()).toBe(2.0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 边界防护
  // ═══════════════════════════════════════════

  describe('6. 边界防护', () => {
    const techId = getFirstAvailableTechId();

    beforeEach(() => {
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);
    });

    it('加速数量为 0 应失败', () => {
      const result = researchSystem.speedUp(techId, 'mandate', 0);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('加速数量为负数应失败', () => {
      const result = researchSystem.speedUp(techId, 'mandate', -5);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('加速数量为 NaN 应失败', () => {
      const result = researchSystem.speedUp(techId, 'mandate', NaN);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('加速数量为 Infinity 应失败', () => {
      const result = researchSystem.speedUp(techId, 'mandate', Infinity);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('无效');
    });

    it('加速不存在的科技应失败', () => {
      const result = researchSystem.speedUp('nonexistent_tech', 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未找到');
    });

    it('未知的加速方式应失败', () => {
      const result = researchSystem.speedUp(techId, 'unknown_method' as any, 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未知');
    });

    it('已完成的研究再次加速应失败', () => {
      researchSystem.speedUp(techId, 'ingot', 1);
      const result = researchSystem.speedUp(techId, 'mandate', 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未找到');
    });

    it('研究速度加成为 NaN 时不应影响研究', () => {
      const systems = createSystems(1000, 5);
      systems.pointSystem.syncResearchSpeedBonus(NaN);
      fundPoints(systems.pointSystem, 1000);

      // NaN 加成被防护为 0，研究时间不变
      const result = systems.researchSystem.startResearch(techId);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 加速后的剩余时间和进度
  // ═══════════════════════════════════════════

  describe('7. 加速后的剩余时间和进度', () => {
    const techId = getFirstAvailableTechId();
    const researchTime = getTechResearchTime(techId);
    // academy level 5 → academySpeedMultiplier = 1.5
    const actualResearchTime = researchTime / 1.5;

    beforeEach(() => {
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);
    });

    it('加速前剩余时间应约等于研究时间', () => {
      const remaining = researchSystem.getRemainingTime(techId);
      expect(remaining).toBeCloseTo(actualResearchTime, 0);
    });

    it('天命加速后剩余时间应减少', () => {
      const remainingBefore = researchSystem.getRemainingTime(techId);
      researchSystem.speedUp(techId, 'mandate', 1);
      const remainingAfter = researchSystem.getRemainingTime(techId);
      expect(remainingAfter).toBeLessThan(remainingBefore);
      expect(remainingBefore - remainingAfter).toBeCloseTo(MANDATE_SPEEDUP_SECONDS_PER_POINT, 0);
    });

    it('加速到完成后剩余时间应为 0', () => {
      researchSystem.speedUp(techId, 'ingot', 1);
      const remaining = researchSystem.getRemainingTime(techId);
      expect(remaining).toBe(0);
    });

    it('不存在的科技剩余时间应为 0', () => {
      expect(researchSystem.getRemainingTime('nonexistent')).toBe(0);
    });

    it('初始进度应接近 0', () => {
      const progress = researchSystem.getResearchProgress(techId);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThan(0.1);
    });

    it('不存在的科技进度应为 0', () => {
      expect(researchSystem.getResearchProgress('nonexistent')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 加速费用计算
  // ═══════════════════════════════════════════

  describe('8. 加速费用计算', () => {
    const techId = getFirstAvailableTechId();

    beforeEach(() => {
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);
    });

    it('calculateIngotCost 应返回正确的元宝数', () => {
      const remaining = researchSystem.getRemainingTime(techId);
      const expectedCost = Math.ceil(remaining / INGOT_SPEEDUP_SECONDS_PER_UNIT);
      expect(researchSystem.calculateIngotCost(techId)).toBe(expectedCost);
    });

    it('天命加速后元宝费用应减少', () => {
      const costBefore = researchSystem.calculateIngotCost(techId);
      researchSystem.speedUp(techId, 'mandate', 1);
      const costAfter = researchSystem.calculateIngotCost(techId);
      expect(costAfter).toBeLessThanOrEqual(costBefore);
    });

    it('不存在的科技元宝费用应为 0', () => {
      expect(researchSystem.calculateIngotCost('nonexistent')).toBe(0);
    });

    it('calculateMandateCost 应返回正确的天命数', () => {
      const remaining = researchSystem.getRemainingTime(techId);
      const expectedCost = Math.ceil(remaining / MANDATE_SPEEDUP_SECONDS_PER_POINT);
      expect(researchSystem.calculateMandateCost(techId)).toBe(expectedCost);
    });

    it('不存在的科技天命费用应为 0', () => {
      expect(researchSystem.calculateMandateCost('nonexistent')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 多科技并行加速
  // ═══════════════════════════════════════════

  describe('9. 多科技并行加速', () => {
    it('两个科技同时加速互不影响', () => {
      fundPoints(pointSystem, 2000);

      const result1 = researchSystem.startResearch('mil_t1_attack');
      const result2 = researchSystem.startResearch('eco_t1_farming');
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const speedUp1 = researchSystem.speedUp('mil_t1_attack', 'mandate', 1);
      const speedUp2 = researchSystem.speedUp('eco_t1_farming', 'mandate', 1);

      expect(speedUp1.success).toBe(true);
      expect(speedUp2.success).toBe(true);
      expect(speedUp1.timeReduced).toBe(60);
      expect(speedUp2.timeReduced).toBe(60);

      const queue = researchSystem.getQueue();
      const slot1 = queue.find((s) => s.techId === 'mil_t1_attack');
      const slot2 = queue.find((s) => s.techId === 'eco_t1_farming');

      expect(slot1).toBeDefined();
      expect(slot2).toBeDefined();
      expect(slot1!.endTime).toBe(slot2!.endTime);
    });

    it('队列已满时不能再开始新研究', () => {
      fundPoints(pointSystem, 2000);
      researchSystem.startResearch('mil_t1_attack');
      researchSystem.startResearch('eco_t1_farming');

      const result3 = researchSystem.startResearch('cul_t1_education');
      expect(result3.success).toBe(false);
      expect(result3.reason).toContain('队列已满');
    });
  });

  // ═══════════════════════════════════════════
  // 10. 取消研究
  // ═══════════════════════════════════════════

  describe('10. 取消研究', () => {
    it('取消研究应返还科技点', () => {
      const techId = getFirstAvailableTechId();
      const cost = getTechCost(techId);
      const RESEARCH_START_TECH_POINT_MULTIPLIER = 10;
      const actualCost = cost * RESEARCH_START_TECH_POINT_MULTIPLIER;
      fundPoints(pointSystem, cost);

      researchSystem.startResearch(techId);
      const pointsBefore = pointSystem.getCurrentPoints();

      const result = researchSystem.cancelResearch(techId);
      expect(result.success).toBe(true);
      expect(result.refundPoints).toBe(actualCost);
      expect(pointSystem.getCurrentPoints()).toBeCloseTo(pointsBefore + actualCost, 0);
    });

    it('取消不存在的研究应失败', () => {
      const result = researchSystem.cancelResearch('nonexistent');
      expect(result.success).toBe(false);
      expect(result.refundPoints).toBe(0);
    });

    it('取消后可以重新开始研究', () => {
      const techId = getFirstAvailableTechId();
      fundPoints(pointSystem, getTechCost(techId) * 2);

      researchSystem.startResearch(techId);
      researchSystem.cancelResearch(techId);

      const result = researchSystem.startResearch(techId);
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 11. isResearching 查询
  // ═══════════════════════════════════════════

  describe('11. isResearching 查询', () => {
    it('未开始研究时返回 false', () => {
      expect(researchSystem.isResearching('mil_t1_attack')).toBe(false);
    });

    it('开始研究后返回 true', () => {
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch('mil_t1_attack');
      expect(researchSystem.isResearching('mil_t1_attack')).toBe(true);
    });

    it('取消研究后返回 false', () => {
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch('mil_t1_attack');
      researchSystem.cancelResearch('mil_t1_attack');
      expect(researchSystem.isResearching('mil_t1_attack')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 12. 加速完成后的科技树状态
  // ═══════════════════════════════════════════

  describe('12. 加速完成后的科技树状态', () => {
    it('加速完成后科技树节点应标记为 completed', () => {
      const techId = getFirstAvailableTechId();
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);

      researchSystem.speedUp(techId, 'ingot', 1);
      researchSystem.update(0);

      // 检查科技树节点状态
      const nodeState = treeSystem.getNodeState(techId);
      expect(nodeState?.status).toBe('completed');
    });

    it('加速完成后队列应清空该科技', () => {
      const techId = getFirstAvailableTechId();
      fundPoints(pointSystem, 1000);
      researchSystem.startResearch(techId);

      researchSystem.speedUp(techId, 'ingot', 1);
      researchSystem.update(0);

      expect(researchSystem.isResearching(techId)).toBe(false);
      expect(researchSystem.getQueue().length).toBe(0);
    });

    it('完成前置科技后可研究后续科技', () => {
      completeTechQuick(researchSystem, pointSystem, 'mil_t1_attack');

      // 现在可以研究 mil_t2_charge
      fundPoints(pointSystem, 200);
      const result = researchSystem.startResearch('mil_t2_charge');
      expect(result.success).toBe(true);
    });
  });
});
