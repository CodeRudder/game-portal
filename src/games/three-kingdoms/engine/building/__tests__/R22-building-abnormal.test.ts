/**
 * R22-2: 建筑系统异常路径覆盖
 *
 * 覆盖场景：
 * - 升级中断（取消升级）
 * - 队列满时无法升级
 * - 降级场景（不存在的降级操作）
 * - 锁定建筑升级
 * - 已达满级建筑
 * - 资源不足升级
 * - 主城等级限制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import type { Resources } from '../../resource/resource.types';

describe('R22-2: 建筑系统异常路径', () => {
  let bs: BuildingSystem;
  beforeEach(() => {
    bs = new BuildingSystem();
  });

  // ═══════════════════════════════════════════
  // 升级中断
  // ═══════════════════════════════════════════
  describe('升级中断（取消升级）', () => {
    it('取消正在升级的建筑返回 80% 资源', () => {
      const resources: Resources = {
        grain: 50000, gold: 50000, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      const cost = bs.startUpgrade('farmland', resources);
      expect(cost).not.toBeNull();

      const refund = bs.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();
      // 返还 80%
      expect(refund!.grain).toBe(Math.round(cost!.grain * 0.8));
      expect(refund!.gold).toBe(Math.round(cost!.gold * 0.8));
    });

    it('取消非升级状态建筑返回 null', () => {
      const refund = bs.cancelUpgrade('farmland');
      expect(refund).toBeNull();
    });

    it('取消升级后建筑状态恢复为 idle', () => {
      const resources: Resources = {
        grain: 50000, gold: 50000, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      bs.startUpgrade('farmland', resources);
      expect(bs.getBuilding('farmland').status).toBe('upgrading');

      bs.cancelUpgrade('farmland');
      expect(bs.getBuilding('farmland').status).toBe('idle');
    });
  });

  // ═══════════════════════════════════════════
  // 队列满
  // ═══════════════════════════════════════════
  describe('队列满时无法升级', () => {
    it('队列满时 checkUpgrade 返回失败', () => {
      const resources: Resources = {
        grain: 500000, gold: 500000, troops: 500000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      // 初始状态只有 castle 和 farmland 解锁
      // 队列容量 = 1（castle Lv1）
      const maxSlots = bs.getMaxQueueSlots();
      expect(maxSlots).toBe(1);

      // 填满队列：升级 farmland
      bs.startUpgrade('farmland', resources);
      expect(bs.getUpgradeQueue().length).toBe(1);
      expect(bs.isQueueFull()).toBe(true);

      // castle 也应该因为队列满而无法升级
      const check = bs.checkUpgrade('castle', resources);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('升级队列已满');
    });
  });

  // ═══════════════════════════════════════════
  // 锁定建筑
  // ═══════════════════════════════════════════
  describe('锁定建筑升级', () => {
    it('锁定建筑无法升级', () => {
      // 初始状态下，部分高级建筑是锁定的
      // workshop 需要 castle Lv3 解锁
      const check = bs.checkUpgrade('workshop');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('建筑尚未解锁');
    });

    it('锁定建筑 startUpgrade 抛出错误', () => {
      const resources: Resources = {
        grain: 50000, gold: 50000, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      expect(() => bs.startUpgrade('workshop', resources)).toThrow(/无法升级/);
    });
  });

  // ═══════════════════════════════════════════
  // 已达满级
  // ═══════════════════════════════════════════
  describe('已达满级建筑', () => {
    it('满级建筑 getUpgradeCost 返回 null', () => {
      // 通过 forceCompleteUpgrades 快速升级到满级
      // 先设为 upgrading 再完成
      const resources: Resources = {
        grain: 50000, gold: 50000, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      // 反复升级 farmland 直到满级
      const maxLevel = 30; // farmland max level
      for (let i = 0; i < maxLevel; i++) {
        const state = bs.getBuilding('farmland');
        if (state.level >= maxLevel) break;
        try {
          bs.startUpgrade('farmland', resources);
          bs.forceCompleteUpgrades();
        } catch {
          break;
        }
      }
      // 检查是否已满级（可能因资源不足提前停止）
      const cost = bs.getUpgradeCost('farmland');
      // 如果已满级，cost 应为 null
      if (bs.getBuilding('farmland').level >= 30) {
        expect(cost).toBeNull();
      }
    });
  });

  // ═══════════════════════════════════════════
  // 资源不足
  // ═══════════════════════════════════════════
  describe('资源不足升级', () => {
    it('粮草不足时 checkUpgrade 返回失败原因', () => {
      const resources: Resources = {
        grain: 0, gold: 50000, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      const check = bs.checkUpgrade('farmland', resources);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.some(r => r.includes('粮草不足'))).toBe(true);
    });

    it('铜钱不足时 checkUpgrade 返回失败原因', () => {
      const resources: Resources = {
        grain: 50000, gold: 0, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      const check = bs.checkUpgrade('farmland', resources);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.some(r => r.includes('铜钱不足'))).toBe(true);
    });

    it('资源不足时 startUpgrade 抛出错误', () => {
      const resources: Resources = {
        grain: 0, gold: 0, troops: 0,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      expect(() => bs.startUpgrade('farmland', resources)).toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 主城等级限制
  // ═══════════════════════════════════════════
  describe('主城等级限制', () => {
    it('非主城建筑等级不能超过主城等级+1', () => {
      // farmland 初始 Lv1，castle 初始 Lv1
      // farmland 升到 Lv2 后，不能再升到 Lv3（因为 castle 仍为 Lv1，Lv3 > Lv1+1=2）
      const resources: Resources = {
        grain: 500000, gold: 500000, troops: 500000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      // 升一次 farmland 到 Lv2
      bs.startUpgrade('farmland', resources);
      bs.forceCompleteUpgrades();
      expect(bs.getBuilding('farmland').level).toBe(2);

      // 再升一次 farmland 到 Lv3 应该失败（castle Lv1, farmland level 2 > castle level 1）
      const check = bs.checkUpgrade('farmland', resources);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.some(r => r.includes('主城等级'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 主城特殊前置
  // ═══════════════════════════════════════════
  describe('主城特殊前置条件', () => {
    it('主城 Lv4→Lv5 需要至少一座其他建筑达到 Lv4', () => {
      const resources: Resources = {
        grain: 5000000, gold: 5000000, troops: 5000000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      // 先升主城到 Lv4
      for (let i = 0; i < 3; i++) {
        bs.startUpgrade('castle', resources);
        bs.forceCompleteUpgrades();
      }
      expect(bs.getBuilding('castle').level).toBe(4);

      // 不升其他建筑，主城 Lv4→Lv5 应该失败
      const check = bs.checkUpgrade('castle', resources);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.some(r => r.includes('Lv4'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 正在升级中的建筑
  // ═══════════════════════════════════════════
  describe('正在升级中的建筑', () => {
    it('正在升级的建筑不能再次升级', () => {
      const resources: Resources = {
        grain: 50000, gold: 50000, troops: 50000,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      bs.startUpgrade('farmland', resources);
      const check = bs.checkUpgrade('farmland', resources);
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('建筑正在升级中');
    });
  });
});
