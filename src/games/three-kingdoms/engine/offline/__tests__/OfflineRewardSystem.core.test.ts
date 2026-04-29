/**
 * OfflineRewardSystem 核心功能测试
 *
 * 覆盖：
 *   - 6档衰减快照计算
 *   - 翻倍机制
 *   - VIP离线加成
 *   - 系统差异化修正系数
 *   - 收益上限与资源保护
 *   - 仓库扩容
 *   - 序列化/反序列化
 *   - 暂存邮件队列
 *   - 离线经验
 *   - 领取防重复
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OfflineRewardSystem } from '../OfflineRewardSystem';

const PRODUCTION_RATES = { grain: 1, gold: 2, troops: 0.5, mandate: 0.1, techPoint: 0, recruitToken: 0, skillBook: 0 };
const CURRENT_RES = { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 0, recruitToken: 0, skillBook: 0 };
const CAPS = { grain: 10000, gold: null, troops: 5000, mandate: null, techPoint: null, recruitToken: null, skillBook: null };

describe('OfflineRewardSystem', () => {
  let system: OfflineRewardSystem;

  beforeEach(() => {
    system = new OfflineRewardSystem();
    system.init({} as never);
  });

  // ─── 6档衰减快照 ──────────────────────

  describe('calculateSnapshot', () => {
    it('离线0秒应返回空快照', () => {
      const snap = system.calculateSnapshot(0, PRODUCTION_RATES);
      expect(snap.offlineSeconds).toBe(0);
      expect(snap.tierDetails).toHaveLength(0);
      expect(snap.overallEfficiency).toBe(0);
    });

    it('离线1小时应只在 tier1（100%效率）', () => {
      const snap = system.calculateSnapshot(3600, PRODUCTION_RATES);
      expect(snap.tierDetails).toHaveLength(1);
      expect(snap.tierDetails[0].efficiency).toBe(1.0);
    });

    it('离线5小时应跨越 tier1 和 tier2', () => {
      const snap = system.calculateSnapshot(5 * 3600, PRODUCTION_RATES);
      expect(snap.tierDetails.length).toBeGreaterThanOrEqual(2);
    });

    it('超过72小时应标记 isCapped', () => {
      const snap = system.calculateSnapshot(100 * 3600, PRODUCTION_RATES);
      expect(snap.isCapped).toBe(true);
    });

    it('总效率应在 0~1 范围', () => {
      const snap = system.calculateSnapshot(10 * 3600, PRODUCTION_RATES);
      expect(snap.overallEfficiency).toBeGreaterThan(0);
      expect(snap.overallEfficiency).toBeLessThanOrEqual(1);
    });
  });

  // ─── 翻倍机制 ─────────────────────────

  describe('applyDouble', () => {
    it('广告翻倍应成功', () => {
      const result = system.applyDouble(CURRENT_RES, { source: 'ad', multiplier: 2, description: 'test' });
      expect(result.success).toBe(true);
      expect(result.appliedMultiplier).toBe(2);
    });

    it('VIP翻倍超过次数限制应失败', () => {
      // 默认 VIP0 每日1次
      system.applyDouble(CURRENT_RES, { source: 'vip', multiplier: 2, description: 'test' });
      const result = system.applyDouble(CURRENT_RES, { source: 'vip', multiplier: 2, description: 'test' });
      expect(result.success).toBe(false);
    });
  });

  // ─── VIP离线加成 ──────────────────────

  describe('getVipBonus', () => {
    it('VIP0 应有基础加成', () => {
      const bonus = system.getVipBonus(0);
      expect(bonus.vipLevel).toBe(0);
      expect(bonus.dailyDoubleLimit).toBeGreaterThan(0);
    });

    it('更高VIP等级应有更高效率加成', () => {
      const bonus0 = system.getVipBonus(0);
      const bonus5 = system.getVipBonus(5);
      expect(bonus5.efficiencyBonus).toBeGreaterThan(bonus0.efficiencyBonus);
    });
  });

  // ─── 系统修正系数 ─────────────────────

  describe('getSystemModifier', () => {
    it('已知系统应返回有效修正系数', () => {
      expect(system.getSystemModifier('building')).toBe(1.2);
      expect(system.getSystemModifier('resource')).toBe(1.0);
      expect(system.getSystemModifier('expedition')).toBe(0.85);
    });

    it('未知系统应返回 1.0', () => {
      expect(system.getSystemModifier('unknown')).toBe(1.0);
    });
  });

  // ─── 收益上限与资源保护 ──────────────

  describe('applyCapAndOverflow', () => {
    it('有上限的资源应截断', () => {
      const earned = { grain: 20000, gold: 100, troops: 100, mandate: 10, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const current = { grain: 5000, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const caps = { grain: 10000, gold: null, troops: null, mandate: null, techPoint: null, recruitToken: null, skillBook: null };
      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      expect(cappedEarned.grain).toBe(5000);
      expect(overflowResources.grain).toBe(15000);
    });

    it('无上限的资源应全量获得', () => {
      const earned = { grain: 0, gold: 100, troops: 0, mandate: 10, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const current = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const caps = { grain: null, gold: null, troops: null, mandate: null, techPoint: null, recruitToken: null, skillBook: null };
      const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
      expect(cappedEarned.gold).toBe(100);
      expect(overflowResources.gold).toBe(0);
    });
  });

  describe('applyResourceProtection', () => {
    it('应保护最低资源量', () => {
      const available = system.applyResourceProtection('grain', 1000, 800);
      expect(available).toBeLessThan(800);
      expect(available).toBeGreaterThanOrEqual(0);
    });

    it('低于保护线的请求应返回0', () => {
      const available = system.applyResourceProtection('grain', 10, 5);
      expect(available).toBe(0);
    });
  });

  // ─── 仓库扩容 ─────────────────────────

  describe('仓库扩容', () => {
    it('初始容量应为基础值', () => {
      const cap = system.getWarehouseCapacity('grain');
      expect(cap).toBe(2000);
    });

    it('升级后容量应增加', () => {
      const prev = system.getWarehouseCapacity('grain');
      const result = system.upgradeWarehouse('grain');
      expect(result.success).toBe(true);
      expect(result.newCapacity).toBeGreaterThan(prev);
    });

    it('无效资源类型应返回失败', () => {
      const result = system.upgradeWarehouse('nonexistent');
      expect(result.success).toBe(false);
    });
  });

  // ─── 序列化/反序列化 ─────────────────

  describe('序列化', () => {
    it('serialize/deserialize 应保持数据一致', () => {
      system.addBoostItem('item1', 5);
      system.upgradeWarehouse('grain');
      system.setLastOfflineTime(1000);

      const data = system.serialize();
      const newSystem = new OfflineRewardSystem();
      newSystem.deserialize(data);

      expect(newSystem.getLastOfflineTime()).toBe(1000);
    });
  });

  // ─── 暂存邮件队列 ────────────────────

  describe('暂存邮件队列', () => {
    it('应正确入队邮件', () => {
      const result = system.enqueueStagingMails([
        { category: 'system', title: 'test', content: 'hello', sender: 'admin' },
      ]);
      expect(result.accepted).toHaveLength(1);
      expect(result.discarded).toHaveLength(0);
    });

    it('超过容量应丢弃', () => {
      const mails = Array.from({ length: 25 }, (_, i) => ({
        category: 'system', title: `mail${i}`, content: 'x', sender: 'admin',
      }));
      const result = system.enqueueStagingMails(mails);
      expect(result.accepted).toHaveLength(20);
      expect(result.discarded).toHaveLength(5);
    });

    it('FIFO 出队应保持顺序', () => {
      system.enqueueStagingMails([
        { category: 'system', title: 'first', content: '1', sender: 'admin' },
        { category: 'system', title: 'second', content: '2', sender: 'admin' },
      ]);
      const dequeued = system.dequeueStagingMails();
      expect(dequeued[0].title).toBe('first');
      expect(dequeued[1].title).toBe('second');
    });
  });

  // ─── 领取防重复 ──────────────────────

  describe('领取防重复', () => {
    it('首次领取应成功', () => {
      const reward = system.calculateOfflineReward(3600, PRODUCTION_RATES, CURRENT_RES, CAPS);
      const claimed = system.claimReward(reward);
      expect(claimed).not.toBeNull();
    });

    it('重复领取应返回 null', () => {
      const reward = system.calculateOfflineReward(3600, PRODUCTION_RATES, CURRENT_RES, CAPS);
      system.claimReward(reward);
      const second = system.claimReward(reward);
      expect(second).toBeNull();
    });

    it('重新计算后应允许再次领取', () => {
      const reward1 = system.calculateOfflineReward(3600, PRODUCTION_RATES, CURRENT_RES, CAPS);
      system.claimReward(reward1);
      const reward2 = system.calculateOfflineReward(3600, PRODUCTION_RATES, CURRENT_RES, CAPS);
      const claimed = system.claimReward(reward2);
      expect(claimed).not.toBeNull();
    });
  });

  // ─── 离线经验 ────────────────────────

  describe('离线经验', () => {
    it('应计算离线经验', () => {
      const result = system.calculateOfflineExp(3600);
      expect(result.baseExp).toBeGreaterThan(0);
      expect(result.finalExp).toBeGreaterThanOrEqual(result.decayedExp);
    });

    it('0秒离线应返回0经验', () => {
      const result = system.calculateOfflineExp(0);
      expect(result.baseExp).toBe(0);
      expect(result.finalExp).toBe(0);
    });

    it('经验加成应增加最终经验', () => {
      const noBonus = system.calculateOfflineExp(3600, 0);
      const withBonus = system.calculateOfflineExp(3600, 0.5);
      expect(withBonus.finalExp).toBeGreaterThan(noBonus.finalExp);
    });
  });

  // ─── 活动离线积分 ────────────────────

  describe('活动离线积分', () => {
    it('应计算赛季活动积分', () => {
      const results = system.calculateActivityPoints(3600, [
        { activityId: 'a1', type: 'season', basePointsPerHour: 100, baseTokensPerHour: 10 },
      ]);
      expect(results).toHaveLength(1);
      expect(results[0].points).toBeGreaterThan(0);
      expect(results[0].offlineEfficiency).toBe(0.5);
    });

    it('应计算限时活动积分（30%效率）', () => {
      const results = system.calculateActivityPoints(3600, [
        { activityId: 'a2', type: 'timed', basePointsPerHour: 100, baseTokensPerHour: 10 },
      ]);
      expect(results[0].offlineEfficiency).toBe(0.3);
    });
  });

  // ─── 攻城结算 ────────────────────────

  describe('攻城结算', () => {
    it('成功应无损失', () => {
      const result = system.calculateSiegeResult(1000, true);
      expect(result.success).toBe(true);
      expect(result.lostTroops).toBe(0);
      expect(result.remainingTroops).toBe(1000);
    });

    it('失败应损失30%兵力', () => {
      const result = system.calculateSiegeResult(1000, false);
      expect(result.success).toBe(false);
      expect(result.lostTroops).toBe(300);
      expect(result.remainingTroops).toBe(700);
    });
  });

  // ─── 过期邮件补偿 ────────────────────

  describe('过期邮件补偿', () => {
    it('应按50%比例补偿铜钱', () => {
      const result = system.processExpiredMailCompensation([
        { id: 'm1', title: 'test', attachments: [{ resourceType: 'gold', amount: 1000 }] },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].compensationGold).toBe(500);
    });

    it('无铜钱附件不应生成补偿', () => {
      const result = system.processExpiredMailCompensation([
        { id: 'm1', title: 'test', attachments: [{ resourceType: 'grain', amount: 1000 }] },
      ]);
      expect(result).toHaveLength(0);
    });
  });

  // ─── reset ───────────────────────────

  describe('reset', () => {
    it('应重置所有状态', () => {
      system.addBoostItem('item1', 5);
      system.setLastOfflineTime(1000);
      system.upgradeWarehouse('grain');

      system.reset();

      expect(system.getLastOfflineTime()).toBe(0);
      expect(system.getStagingQueueSize()).toBe(0);
    });
  });
});
