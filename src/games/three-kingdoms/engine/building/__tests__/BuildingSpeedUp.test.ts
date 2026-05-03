/**
 * BLD-F11 升级加速系统测试
 *
 * 覆盖3个子流程：
 *   F11-01: 铜钱加速 — 消耗铜钱→减少30%剩余时间，可叠加3次
 *   F11-02: 天命加速 — 消耗天命→减少固定时间（60秒/点）
 *   F11-03: 元宝秒完成 — 消耗元宝→立即完成升级
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import type { Resources } from '../../../shared/types';
import { BUILDING_DEFS } from '../building-config';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

const RICH: Resources = {
  grain: 1e9,
  gold: 1e9,
  ore: 1e9,
  wood: 1e9,
  troops: 1e9,
  mandate: 1e9,
  techPoint: 0,
  recruitToken: 0,
  skillBook: 0,
};

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('BLD-F11 升级加速系统', () => {
  let sys: BuildingSystem;
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    sys = new BuildingSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // F11-01: 铜钱加速
  // ═══════════════════════════════════════════

  describe('F11-01 铜钱加速', () => {
    it('铜钱加速减少30%剩余时间', () => {
      sys.startUpgrade('farmland', RICH);
      const cost = BUILDING_DEFS.farmland.levelTable[0].upgradeCost;
      const totalTimeMs = cost.timeSeconds * 1000;
      const expectedRemaining = totalTimeMs; // 刚开始，剩余=总时间
      const expectedReduce = expectedRemaining * 0.3;

      const result = sys.speedUpWithCopper('farmland', 1e9);

      expect(result.success).toBe(true);
      expect(result.timeReduced).toBeCloseTo(expectedReduce / 1000, 1);
      expect(result.cost).toBe(1000); // 第1次：1000×1
    });

    it('铜钱加速最多3次', () => {
      sys.startUpgrade('farmland', RICH);

      const r1 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r1.success).toBe(true);
      expect(r1.remainingSpeedUps).toBe(2);

      const r2 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r2.success).toBe(true);
      expect(r2.remainingSpeedUps).toBe(1);

      const r3 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r3.success).toBe(true);
      expect(r3.remainingSpeedUps).toBe(0);

      // 第4次应失败
      const r4 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r4.success).toBe(false);
      expect(r4.reason).toContain('上限');
    });

    it('铜钱不足时加速失败', () => {
      sys.startUpgrade('farmland', RICH);

      // 第1次需要1000，给500不够
      const result = sys.speedUpWithCopper('farmland', 500);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('铜钱不足');
      expect(result.cost).toBe(1000);
    });

    it('铜钱加速消耗递增：1000/2000/3000', () => {
      sys.startUpgrade('farmland', RICH);

      const r1 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r1.cost).toBe(1000);

      const r2 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r2.cost).toBe(2000);

      const r3 = sys.speedUpWithCopper('farmland', 1e9);
      expect(r3.cost).toBe(3000);
    });

    it('铜钱加速后endTime确实提前', () => {
      sys.startUpgrade('farmland', RICH);
      const endTimeBefore = sys.getBuilding('farmland').upgradeEndTime!;

      sys.speedUpWithCopper('farmland', 1e9);

      const endTimeAfter = sys.getBuilding('farmland').upgradeEndTime!;
      expect(endTimeAfter).toBeLessThan(endTimeBefore);
    });

    it('铜钱加速后队列slot同步更新', () => {
      sys.startUpgrade('farmland', RICH);
      const queueBefore = sys.getUpgradeQueue();
      const endTimeBefore = queueBefore.find((s) => s.buildingType === 'farmland')!.endTime;

      sys.speedUpWithCopper('farmland', 1e9);

      const queueAfter = sys.getUpgradeQueue();
      const endTimeAfter = queueAfter.find((s) => s.buildingType === 'farmland')!.endTime;
      expect(endTimeAfter).toBeLessThan(endTimeBefore);
    });
  });

  // ═══════════════════════════════════════════
  // F11-02: 天命加速
  // ═══════════════════════════════════════════

  describe('F11-02 天命加速', () => {
    it('天命加速减少60秒', () => {
      // 升级主城+农田到Lv5，使农田Lv5→6需要96秒
      for (let i = 0; i < 4; i++) {
        sys.startUpgrade('castle', RICH);
        sys.forceCompleteUpgrades();
        sys.startUpgrade('farmland', RICH);
        sys.forceCompleteUpgrades();
      }
      // 现在农田Lv5，升级到Lv6需要96秒
      sys.startUpgrade('farmland', RICH);

      const result = sys.speedUpWithMandate('farmland', 1, 100);

      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(60);
      expect(result.cost).toBe(1);
    });

    it('天命加速2点减少120秒', () => {
      // 升级到Lv6，农田Lv6→7需要154秒
      for (let i = 0; i < 5; i++) {
        sys.startUpgrade('castle', RICH);
        sys.forceCompleteUpgrades();
        sys.startUpgrade('farmland', RICH);
        sys.forceCompleteUpgrades();
      }
      sys.startUpgrade('farmland', RICH);

      const result = sys.speedUpWithMandate('farmland', 2, 100);

      expect(result.success).toBe(true);
      expect(result.timeReduced).toBe(120);
      expect(result.cost).toBe(2);
    });

    it('天命不足时加速失败', () => {
      sys.startUpgrade('farmland', RICH);

      const result = sys.speedUpWithMandate('farmland', 5, 3);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('天命不足');
    });

    it('天命数量为0或负数时加速失败', () => {
      sys.startUpgrade('farmland', RICH);

      const r0 = sys.speedUpWithMandate('farmland', 0, 100);
      expect(r0.success).toBe(false);
      expect(r0.reason).toContain('无效');

      const rn = sys.speedUpWithMandate('farmland', -1, 100);
      expect(rn.success).toBe(false);
    });

    it('天命加速后endTime提前', () => {
      // 农田Lv5→6（96秒）
      for (let i = 0; i < 4; i++) {
        sys.startUpgrade('castle', RICH);
        sys.forceCompleteUpgrades();
        sys.startUpgrade('farmland', RICH);
        sys.forceCompleteUpgrades();
      }
      sys.startUpgrade('farmland', RICH);
      const endTimeBefore = sys.getBuilding('farmland').upgradeEndTime!;

      sys.speedUpWithMandate('farmland', 1, 100);

      const endTimeAfter = sys.getBuilding('farmland').upgradeEndTime!;
      // 应减少60秒=60000ms
      expect(endTimeBefore - endTimeAfter).toBe(60000);
    });

    it('天命加速超过剩余时间时刚好完成', () => {
      sys.startUpgrade('farmland', RICH);
      const cost = BUILDING_DEFS.farmland.levelTable[0].upgradeCost;
      const totalTime = cost.timeSeconds;

      // 用大量天命超过剩余时间
      const mandatePoints = Math.ceil(totalTime / 60) + 10;
      const levelBefore = sys.getLevel('farmland');

      const result = sys.speedUpWithMandate('farmland', mandatePoints, mandatePoints + 100);

      expect(result.success).toBe(true);
      expect(sys.getLevel('farmland')).toBe(levelBefore + 1);
      expect(sys.getBuilding('farmland').status).toBe('idle');
    });
  });

  // ═══════════════════════════════════════════
  // F11-03: 元宝秒完成
  // ═══════════════════════════════════════════

  describe('F11-03 元宝秒完成', () => {
    it('元宝秒完成立即完成升级', () => {
      sys.startUpgrade('farmland', RICH);
      const levelBefore = sys.getLevel('farmland');

      const result = sys.instantCompleteWithIngot('farmland', 1e9);

      expect(result.success).toBe(true);
      expect(result.ingotCost).toBeGreaterThanOrEqual(1);
      expect(sys.getLevel('farmland')).toBe(levelBefore + 1);
      expect(sys.getBuilding('farmland').status).toBe('idle');
    });

    it('元宝消耗按剩余时间/600向上取整', () => {
      sys.startUpgrade('farmland', RICH);
      const cost = BUILDING_DEFS.farmland.levelTable[0].upgradeCost;
      const totalTime = cost.timeSeconds;
      const expectedCost = Math.ceil(totalTime / 600);

      const result = sys.instantCompleteWithIngot('farmland', 1e9);

      expect(result.success).toBe(true);
      expect(result.ingotCost).toBe(expectedCost);
    });

    it('元宝不足时秒完成失败', () => {
      sys.startUpgrade('farmland', RICH);

      const result = sys.instantCompleteWithIngot('farmland', 0);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('元宝不足');
      expect(result.ingotCost).toBeGreaterThan(0);
    });

    it('元宝秒完成后建筑状态恢复idle', () => {
      sys.startUpgrade('farmland', RICH);

      sys.instantCompleteWithIngot('farmland', 1e9);

      const state = sys.getBuilding('farmland');
      expect(state.status).toBe('idle');
      expect(state.upgradeStartTime).toBeNull();
      expect(state.upgradeEndTime).toBeNull();
    });

    it('元宝秒完成后队列清空该建筑', () => {
      sys.startUpgrade('farmland', RICH);

      sys.instantCompleteWithIngot('farmland', 1e9);

      const queue = sys.getUpgradeQueue();
      expect(queue.find((s) => s.buildingType === 'farmland')).toBeUndefined();
    });

    it('元宝秒完成主城后触发解锁检查', () => {
      // 主城Lv1，兵营未解锁
      expect(sys.isUnlocked('barracks')).toBe(false);

      sys.instantCompleteWithIngot('castle', 1e9);
      // 不直接触发，需要先升级主城
      // 先开始升级再秒完成
      // 主城已经是Lv1 idle，先升级
      // 重新开始
      vi.spyOn(Date, 'now').mockReturnValue(base);
      const sys2 = new BuildingSystem();
      sys2.startUpgrade('castle', RICH);
      sys2.instantCompleteWithIngot('castle', 1e9);

      expect(sys2.isUnlocked('barracks')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 通用边界条件
  // ═══════════════════════════════════════════

  describe('通用边界条件', () => {
    it('无升级时铜钱加速失败', () => {
      const result = sys.speedUpWithCopper('farmland', 1e9);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未在升级队列中');
    });

    it('无升级时天命加速失败', () => {
      const result = sys.speedUpWithMandate('farmland', 1, 100);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未在升级队列中');
    });

    it('无升级时元宝秒完成失败', () => {
      const result = sys.instantCompleteWithIngot('farmland', 1e9);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未在升级队列中');
    });

    it('加速后升级完成触发等级+1（tick结算）', () => {
      sys.startUpgrade('farmland', RICH);
      const cost = BUILDING_DEFS.farmland.levelTable[0].upgradeCost;
      const totalTimeMs = cost.timeSeconds * 1000;
      const levelBefore = sys.getLevel('farmland');

      // 铜钱加速3次，总共减少 1 - 0.7^3 ≈ 65.7% 的时间
      sys.speedUpWithCopper('farmland', 1e9);
      sys.speedUpWithCopper('farmland', 1e9);
      sys.speedUpWithCopper('farmland', 1e9);

      // 推进时间到加速后的endTime之后
      const endTime = sys.getBuilding('farmland').upgradeEndTime!;
      vi.spyOn(Date, 'now').mockReturnValue(endTime + 1000);

      const completed = sys.tick();
      expect(completed).toContain('farmland');
      expect(sys.getLevel('farmland')).toBe(levelBefore + 1);
      expect(sys.getBuilding('farmland').status).toBe('idle');
    });

    it('加速后取消升级仍返还80%原始费用', () => {
      const cost = sys.getUpgradeCost('farmland')!;
      sys.startUpgrade('farmland', RICH);

      // 加速一次
      sys.speedUpWithCopper('farmland', 1e9);

      // 取消仍返还原始费用的80%
      const refund = sys.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();
      expect(refund!.grain).toBe(Math.floor(cost.grain * 0.8));
    });
  });
});
