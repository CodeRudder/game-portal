/**
 * offline-config 测试
 *
 * 覆盖：
 *   - 5档衰减配置完整性
 *   - 翻倍机制配置
 *   - VIP加成配置表
 *   - 系统修正系数
 *   - 资源保护配置
 *   - 仓库扩容配置
 *   - 离线经验配置
 */

import { describe, it, expect } from 'vitest';
import {
  DECAY_TIERS,
  MAX_OFFLINE_HOURS,
  MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES,
  SYSTEM_EFFICIENCY_MODIFIERS,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  STAGING_QUEUE_CAPACITY,
  BASE_EXP_PER_HOUR,
  EXP_LEVEL_TABLE,
  SEASON_ACTIVITY_OFFLINE_EFFICIENCY,
  TIMED_ACTIVITY_OFFLINE_EFFICIENCY,
  SIEGE_FAILURE_TROOP_LOSS_RATIO,
  EXPIRED_MAIL_COMPENSATION_RATIO,
  OFFLINE_SAVE_VERSION,
} from '../offline-config';

describe('offline-config', () => {
  describe('DECAY_TIERS', () => {
    it('应包含5档衰减', () => {
      expect(DECAY_TIERS).toHaveLength(5);
    });

    it('第一档应为 100% 效率', () => {
      expect(DECAY_TIERS[0].efficiency).toBe(1.0);
      expect(DECAY_TIERS[0].startHours).toBe(0);
    });

    it('最后一档应为 20% 效率', () => {
      const last = DECAY_TIERS[DECAY_TIERS.length - 1];
      expect(last.efficiency).toBe(0.20);
    });

    it('各档效率应递减', () => {
      for (let i = 1; i < DECAY_TIERS.length; i++) {
        expect(DECAY_TIERS[i].efficiency).toBeLessThan(DECAY_TIERS[i - 1].efficiency);
      }
    });

    it('各档时间应无缝衔接', () => {
      for (let i = 1; i < DECAY_TIERS.length; i++) {
        expect(DECAY_TIERS[i].startHours).toBe(DECAY_TIERS[i - 1].endHours);
      }
    });
  });

  describe('时间常量', () => {
    it('MAX_OFFLINE_HOURS 应为 72', () => {
      expect(MAX_OFFLINE_HOURS).toBe(72);
    });

    it('MAX_OFFLINE_SECONDS 应等于 72*3600', () => {
      expect(MAX_OFFLINE_SECONDS).toBe(72 * 3600);
    });
  });

  describe('翻倍机制配置', () => {
    it('广告和道具翻倍倍率应为 2', () => {
      expect(AD_DOUBLE_MULTIPLIER).toBe(2);
      expect(ITEM_DOUBLE_MULTIPLIER).toBe(2);
    });

    it('回归奖励倍率应为 2', () => {
      expect(RETURN_BONUS_MULTIPLIER).toBe(2);
    });

    it('回归奖励最小小时数应为 24', () => {
      expect(RETURN_BONUS_MIN_HOURS).toBe(24);
    });
  });

  describe('VIP_OFFLINE_BONUSES', () => {
    it('应包含6个VIP等级', () => {
      expect(VIP_OFFLINE_BONUSES).toHaveLength(6);
    });

    it('等级应递增排列', () => {
      for (let i = 1; i < VIP_OFFLINE_BONUSES.length; i++) {
        expect(VIP_OFFLINE_BONUSES[i].vipLevel).toBeGreaterThan(VIP_OFFLINE_BONUSES[i - 1].vipLevel);
      }
    });

    it('更高VIP等级应有更高效率加成', () => {
      for (let i = 1; i < VIP_OFFLINE_BONUSES.length; i++) {
        expect(VIP_OFFLINE_BONUSES[i].efficiencyBonus).toBeGreaterThanOrEqual(VIP_OFFLINE_BONUSES[i - 1].efficiencyBonus);
      }
    });
  });

  describe('SYSTEM_EFFICIENCY_MODIFIERS', () => {
    it('应包含核心系统修正', () => {
      const ids = SYSTEM_EFFICIENCY_MODIFIERS.map(m => m.systemId);
      expect(ids).toContain('resource');
      expect(ids).toContain('building');
      expect(ids).toContain('expedition');
    });

    it('修正系数应在合理范围', () => {
      for (const mod of SYSTEM_EFFICIENCY_MODIFIERS) {
        expect(mod.modifier).toBeGreaterThan(0);
        expect(mod.modifier).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('RESOURCE_PROTECTIONS', () => {
    it('应包含核心资源保护', () => {
      const types = RESOURCE_PROTECTIONS.map(p => p.resourceType);
      expect(types).toContain('grain');
      expect(types).toContain('gold');
      expect(types).toContain('troops');
    });

    it('保护比例和底线应为正数', () => {
      for (const p of RESOURCE_PROTECTIONS) {
        expect(p.protectionRatio).toBeGreaterThan(0);
        expect(p.protectionFloor).toBeGreaterThan(0);
      }
    });
  });

  describe('DEFAULT_WAREHOUSE_EXPANSIONS', () => {
    it('应包含粮草和兵力仓库', () => {
      const types = DEFAULT_WAREHOUSE_EXPANSIONS.map(e => e.resourceType);
      expect(types).toContain('grain');
      expect(types).toContain('troops');
    });

    it('最大等级应为正整数', () => {
      for (const exp of DEFAULT_WAREHOUSE_EXPANSIONS) {
        expect(exp.maxLevel).toBeGreaterThan(0);
        expect(exp.perLevelIncrease).toBeGreaterThan(0);
      }
    });
  });

  describe('离线经验配置', () => {
    it('BASE_EXP_PER_HOUR 应为正数', () => {
      expect(BASE_EXP_PER_HOUR).toBeGreaterThan(0);
    });

    it('EXP_LEVEL_TABLE 应包含10个等级', () => {
      expect(EXP_LEVEL_TABLE).toHaveLength(10);
    });

    it('等级经验需求应递增', () => {
      for (let i = 1; i < EXP_LEVEL_TABLE.length; i++) {
        expect(EXP_LEVEL_TABLE[i].expRequired).toBeGreaterThan(EXP_LEVEL_TABLE[i - 1].expRequired);
      }
    });
  });

  describe('活动离线效率', () => {
    it('赛季活动效率应为 50%', () => {
      expect(SEASON_ACTIVITY_OFFLINE_EFFICIENCY).toBe(0.5);
    });

    it('限时活动效率应为 30%', () => {
      expect(TIMED_ACTIVITY_OFFLINE_EFFICIENCY).toBe(0.3);
    });
  });

  describe('攻城失败配置', () => {
    it('兵力损失比例应为 30%', () => {
      expect(SIEGE_FAILURE_TROOP_LOSS_RATIO).toBe(0.3);
    });
  });

  describe('过期补偿配置', () => {
    it('补偿比例应为 50%', () => {
      expect(EXPIRED_MAIL_COMPENSATION_RATIO).toBe(0.5);
    });
  });

  describe('其他常量', () => {
    it('STAGING_QUEUE_CAPACITY 应为 20', () => {
      expect(STAGING_QUEUE_CAPACITY).toBe(20);
    });

    it('OFFLINE_SAVE_VERSION 应为正整数', () => {
      expect(OFFLINE_SAVE_VERSION).toBeGreaterThan(0);
    });
  });
});
