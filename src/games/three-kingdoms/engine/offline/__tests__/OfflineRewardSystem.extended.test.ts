/**
 * OfflineRewardSystem 扩展功能测试
 *
 * 覆盖未被现有测试文件覆盖的方法：
 *   - handleDegradationNotice 快照降级通知
 *   - calculateSiegeResult 攻城结算
 *   - updateProductionRatesAfterTech 科技产出更新
 *   - calculateWithSnapshotBonus 快照加成计算
 *   - calculateCrossSystemReward 跨系统离线收益汇总
 *   - updateReputationBonus 声望加成更新
 *   - handleExpiredMailCompensation 过期邮件补偿
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineRewardSystem } from '../OfflineRewardSystem';
import type { Resources } from '../../../shared/types';

const PRODUCTION_RATES: Resources = {
  grain: 1, gold: 2, troops: 0.5, mandate: 0.1,
  techPoint: 0, recruitToken: 0, skillBook: 0,
};

describe('OfflineRewardSystem 扩展功能', () => {
  let system: OfflineRewardSystem;

  beforeEach(() => {
    system = new OfflineRewardSystem();
    system.init({} as never);
  });

  // ── handleDegradationNotice ──

  describe('handleDegradationNotice', () => {
    it('有快照时不触发降级通知', () => {
      const result = system.handleDegradationNotice(true);
      expect(result.popupTriggered).toBe(false);
      expect(result.mailSent).toBe(false);
      expect(result.isDuplicate).toBe(false);
    });

    it('无快照时触发弹窗通知', () => {
      const result = system.handleDegradationNotice(false);
      expect(result.popupTriggered).toBe(true);
    });

    it('无快照且有 mailSystem 时发送邮件', () => {
      const mockMailSystem = {
        sendMail: vi.fn().mockReturnValue({ id: 'mail-001' }),
      };
      const result = system.handleDegradationNotice(false, mockMailSystem);
      expect(result.mailSent).toBe(true);
      expect(result.mailId).toBe('mail-001');
      expect(result.isDuplicate).toBe(false);
      expect(mockMailSystem.sendMail).toHaveBeenCalledWith(expect.objectContaining({
        category: 'system',
        title: '离线数据异常通知',
      }));
    });

    it('无快照但无 mailSystem 时不发送邮件', () => {
      const result = system.handleDegradationNotice(false);
      expect(result.mailSent).toBe(false);
      expect(result.mailId).toBeNull();
    });

    it('连续多次无快照不重复发送邮件', () => {
      const mockMailSystem = {
        sendMail: vi.fn().mockReturnValue({ id: 'mail-001' }),
      };

      // 第一次：发送邮件
      const r1 = system.handleDegradationNotice(false, mockMailSystem);
      expect(r1.isDuplicate).toBe(false);
      expect(r1.mailSent).toBe(true);

      // 第二次：不重复发送
      const r2 = system.handleDegradationNotice(false, mockMailSystem);
      expect(r2.isDuplicate).toBe(true);
      expect(r2.mailSent).toBe(false);

      expect(mockMailSystem.sendMail).toHaveBeenCalledTimes(1);
    });

    it('恢复快照后再次丢失重新发送邮件', () => {
      const mockMailSystem = {
        sendMail: vi.fn().mockReturnValue({ id: 'mail-001' }),
      };

      // 第一次丢失
      system.handleDegradationNotice(false, mockMailSystem);
      // 恢复
      system.handleDegradationNotice(true);
      // 再次丢失
      const r = system.handleDegradationNotice(false, mockMailSystem);
      expect(r.isDuplicate).toBe(false);
      expect(r.mailSent).toBe(true);
    });
  });

  // ── calculateSiegeResult ──

  describe('calculateSiegeResult', () => {
    it('攻城成功无兵力损失', () => {
      const result = system.calculateSiegeResult(1000, true);
      expect(result.success).toBe(true);
      expect(result.lostTroops).toBe(0);
      expect(result.remainingTroops).toBe(1000);
      expect(result.loot).toBeNull();
    });

    it('攻城成功有战利品', () => {
      const loot: Resources = { grain: 500, gold: 200, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const result = system.calculateSiegeResult(1000, true, loot);
      expect(result.loot).toEqual(loot);
    });

    it('攻城失败损失30%兵力', () => {
      const result = system.calculateSiegeResult(1000, false);
      expect(result.success).toBe(false);
      expect(result.lostTroops).toBe(300);
      expect(result.remainingTroops).toBe(700);
      expect(result.loot).toBeNull();
    });

    it('攻城失败兵力向下取整', () => {
      const result = system.calculateSiegeResult(333, false);
      expect(result.lostTroops).toBe(Math.floor(333 * 0.3));
      expect(result.remainingTroops).toBe(333 - Math.floor(333 * 0.3));
    });

    it('攻城失败无战利品（即使传入loot）', () => {
      const loot: Resources = { grain: 500, gold: 200, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const result = system.calculateSiegeResult(1000, false, loot);
      expect(result.loot).toBeNull();
    });
  });

  // ── updateProductionRatesAfterTech ──

  describe('updateProductionRatesAfterTech', () => {
    it('按完成时间顺序更新产出', () => {
      const completedTech = [
        { techId: 'tech1', endTime: 1000, productionBonus: 0.1 },
        { techId: 'tech2', endTime: 2000, productionBonus: 0.2 },
      ];
      const currentRates: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };

      const updates = system.updateProductionRatesAfterTech(completedTech, currentRates);
      expect(updates).toHaveLength(2);
      expect(updates[0].techId).toBe('tech1');
      expect(updates[1].techId).toBe('tech2');
    });

    it('科技加成应叠加到产出速率', () => {
      const completedTech = [
        { techId: 'tech1', endTime: 1000, productionBonus: 0.1 },
      ];
      const currentRates: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };

      const updates = system.updateProductionRatesAfterTech(completedTech, currentRates);
      // 产出 = 100 * 1.1 = 110
      expect(updates[0].updatedRates.grain).toBe(110);
    });

    it('空科技列表返回空数组', () => {
      const currentRates: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };
      const updates = system.updateProductionRatesAfterTech([], currentRates);
      expect(updates).toHaveLength(0);
    });

    it('按完成时间排序（乱序输入）', () => {
      const completedTech = [
        { techId: 'tech2', endTime: 2000, productionBonus: 0.2 },
        { techId: 'tech1', endTime: 1000, productionBonus: 0.1 },
      ];
      const currentRates: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 };

      const updates = system.updateProductionRatesAfterTech(completedTech, currentRates);
      expect(updates[0].techId).toBe('tech1');
      expect(updates[1].techId).toBe('tech2');
    });
  });

  // ── calculateWithSnapshotBonus ──

  describe('calculateWithSnapshotBonus', () => {
    it('无加成时返回基础快照', () => {
      const result = system.calculateWithSnapshotBonus(3600, PRODUCTION_RATES, {});
      expect(result.totalEarned).toBeDefined();
      expect(result.offlineSeconds).toBe(3600);
    });

    it('有加成时 totalEarned 应增加', () => {
      const base = system.calculateWithSnapshotBonus(3600, PRODUCTION_RATES, {});
      const boosted = system.calculateWithSnapshotBonus(3600, PRODUCTION_RATES, { tech: 0.1 });

      expect(boosted.totalEarned.grain).toBeGreaterThan(base.totalEarned.grain);
    });

    it('多个加成来源叠加', () => {
      const single = system.calculateWithSnapshotBonus(3600, PRODUCTION_RATES, { tech: 0.1 });
      const multi = system.calculateWithSnapshotBonus(3600, PRODUCTION_RATES, { tech: 0.1, vip: 0.1, reputation: 0.1 });

      expect(multi.totalEarned.grain).toBeGreaterThan(single.totalEarned.grain);
    });

    it('离线0秒返回空快照', () => {
      const result = system.calculateWithSnapshotBonus(0, PRODUCTION_RATES, { tech: 0.5 });
      expect(result.offlineSeconds).toBe(0);
      expect(result.tierDetails).toHaveLength(0);
    });
  });

  // ── calculateCrossSystemReward ──

  describe('calculateCrossSystemReward', () => {
    const currentResources: Resources = {
      grain: 1000, gold: 500, troops: 200, mandate: 50,
      techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const caps: Record<string, number | null> = {
      grain: 10000, gold: null, troops: 5000, mandate: null,
      techPoint: null, recruitToken: null, skillBook: null,
    };

    it('应返回三系统独立收益', () => {
      const result = system.calculateCrossSystemReward(3600, PRODUCTION_RATES, currentResources, caps);

      expect(result.resourceReward).toBeDefined();
      expect(result.buildingReward).toBeDefined();
      expect(result.expeditionReward).toBeDefined();
      expect(result.totalReward).toBeDefined();
    });

    it('总收益应等于三系统之和', () => {
      const result = system.calculateCrossSystemReward(3600, PRODUCTION_RATES, currentResources, caps);

      // totalReward = resourceReward + buildingReward + expeditionReward
      expect(result.totalReward.grain).toBe(
        result.resourceReward.grain + result.buildingReward.grain + result.expeditionReward.grain,
      );
    });

    it('noDuplicates 应为 true', () => {
      const result = system.calculateCrossSystemReward(3600, PRODUCTION_RATES, currentResources, caps);
      expect(result.noDuplicates).toBe(true);
    });

    it('离线0秒所有收益为0', () => {
      const result = system.calculateCrossSystemReward(0, PRODUCTION_RATES, currentResources, caps);
      expect(result.totalReward.grain).toBe(0);
      expect(result.totalReward.gold).toBe(0);
    });
  });

  // ── updateReputationBonus ──

  describe('updateReputationBonus', () => {
    it('返回更新后的加成系数', () => {
      const result = system.updateReputationBonus(0.1);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('更高声望加成返回更高系数', () => {
      const low = system.updateReputationBonus(0.1);
      const high = system.updateReputationBonus(0.5);
      expect(high).toBeGreaterThan(low);
    });

    it('0声望加成返回基础系数', () => {
      const result = system.updateReputationBonus(0);
      expect(result).toBeGreaterThan(0);
    });
  });

  // ── processExpiredMailCompensation ──

  describe('processExpiredMailCompensation', () => {
    it('应返回补偿结果（含gold附件的邮件）', () => {
      const mails = [
        {
          id: 'm1',
          title: '奖励邮件',
          attachments: [{ resourceType: 'gold', amount: 100 }],
        },
      ];

      const result = system.processExpiredMailCompensation(mails);
      expect(result).toHaveLength(1);
      expect(result[0].originalMailId).toBe('m1');
      expect(result[0].compensationGold).toBe(50); // 100 * 0.5
    });

    it('无过期邮件返回空数组', () => {
      const result = system.processExpiredMailCompensation([]);
      expect(result).toHaveLength(0);
    });

    it('只有非gold附件的邮件无补偿', () => {
      const mails = [
        {
          id: 'm1',
          title: '奖励邮件',
          attachments: [{ resourceType: 'grain', amount: 100 }],
        },
      ];
      const result = system.processExpiredMailCompensation(mails);
      expect(result).toHaveLength(0);
    });

    it('多封邮件独立计算补偿', () => {
      const mails = [
        { id: 'm1', title: '邮件1', attachments: [{ resourceType: 'gold', amount: 200 }] },
        { id: 'm2', title: '邮件2', attachments: [{ resourceType: 'gold', amount: 100 }] },
      ];
      const result = system.processExpiredMailCompensation(mails);
      expect(result).toHaveLength(2);
      expect(result[0].compensationGold).toBe(100); // 200 * 0.5
      expect(result[1].compensationGold).toBe(50);  // 100 * 0.5
    });
  });

  // ── registerExpSystem / handleExpRegistrationFailure ──

  describe('经验系统注册', () => {
    it('registerExpSystem 默认成功', () => {
      expect(system.registerExpSystem()).toBe(true);
    });

    it('handleExpRegistrationFailure 返回降级结果', () => {
      const result = system.handleExpRegistrationFailure(80);
      expect(result.degraded).toBe(true);
      expect(result.fallbackRate).toBe(80);
    });

    it('handleExpRegistrationFailure 默认降级速率', () => {
      const result = system.handleExpRegistrationFailure();
      expect(result.fallbackRate).toBeGreaterThan(0);
    });
  });

  // ── setExpState / getExpState ──

  describe('经验状态管理', () => {
    it('setExpState / getExpState 应正确存取', () => {
      system.setExpState(5, 300, 0.2);
      const state = system.getExpState();
      expect(state.level).toBe(5);
      expect(state.exp).toBe(300);
      expect(state.bonus).toBe(0.2);
    });

    it('初始经验状态为 level=1, exp=0, bonus=0', () => {
      const state = system.getExpState();
      expect(state.level).toBe(1);
      expect(state.exp).toBe(0);
      expect(state.bonus).toBe(0);
    });
  });

  // ── calculateOfflineExp ──

  describe('calculateOfflineExp', () => {
    it('应计算离线经验', () => {
      const result = system.calculateOfflineExp(3600);
      expect(result.baseExp).toBeGreaterThan(0);
      expect(result.finalExp).toBeGreaterThan(0);
    });

    it('离线0秒经验为0', () => {
      const result = system.calculateOfflineExp(0);
      expect(result.baseExp).toBe(0);
      expect(result.finalExp).toBe(0);
    });

    it('经验加成应增加最终经验', () => {
      const noBonus = system.calculateOfflineExp(3600, 0);
      const withBonus = system.calculateOfflineExp(3600, 0.5);
      expect(withBonus.finalExp).toBeGreaterThan(noBonus.finalExp);
    });

    it('经验加成上限为100%', () => {
      const noBonus = system.calculateOfflineExp(3600, 0);
      const bonus200 = system.calculateOfflineExp(3600, 2.0);
      // 加成超过100%时截断：bonusExp 不超过 decayedExp
      expect(bonus200.finalExp).toBeLessThanOrEqual(noBonus.decayedExp * 2);
    });
  });

  // ── reset ──

  describe('reset', () => {
    it('重置后所有状态恢复初始值', () => {
      system.setExpState(10, 5000, 0.5);
      system.setLastOfflineTime(Date.now());
      system.addBoostItem('test_item', 5);

      system.reset();

      const expState = system.getExpState();
      expect(expState.level).toBe(1);
      expect(expState.exp).toBe(0);
      expect(expState.bonus).toBe(0);
      expect(system.getLastOfflineTime()).toBe(0);
      // getBoostItems 返回道具定义列表（count=0），不是空数组
      const boostItems = system.getBoostItems();
      for (const item of boostItems) {
        expect(item.count).toBe(0);
      }
    });
  });
});
