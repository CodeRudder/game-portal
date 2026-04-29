/**
 * resource-config 测试
 *
 * 覆盖：
 *   - 初始资源配置
 *   - 初始产出速率
 *   - 初始资源上限
 *   - 仓库容量表
 *   - 容量警告阈值
 *   - 离线收益配置
 *   - 资源保护机制
 *   - 铜钱经济模型
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  GRANARY_CAPACITY_TABLE,
  BARRACKS_CAPACITY_TABLE,
  CAP_WARNING_THRESHOLDS,
  OFFLINE_TIERS,
  OFFLINE_MAX_SECONDS,
  OFFLINE_POPUP_THRESHOLD_SECONDS,
  MIN_GRAIN_RESERVE,
  GOLD_SAFETY_LINE,
  MANDATE_CONFIRM_THRESHOLD,
  COPPER_PASSIVE_RATE,
  COPPER_DAILY_TASK_REWARD,
  COPPER_STAGE_CLEAR_BASE,
  COPPER_SHOP_DAILY_SPEND_LIMIT,
  SAVE_VERSION,
} from '../resource-config';

describe('resource-config', () => {
  describe('INITIAL_RESOURCES', () => {
    it('应包含所有资源类型', () => {
      expect(INITIAL_RESOURCES).toHaveProperty('grain');
      expect(INITIAL_RESOURCES).toHaveProperty('gold');
      expect(INITIAL_RESOURCES).toHaveProperty('troops');
      expect(INITIAL_RESOURCES).toHaveProperty('mandate');
      expect(INITIAL_RESOURCES).toHaveProperty('techPoint');
      expect(INITIAL_RESOURCES).toHaveProperty('recruitToken');
      expect(INITIAL_RESOURCES).toHaveProperty('skillBook');
    });

    it('初始天命应为 0', () => {
      expect(INITIAL_RESOURCES.mandate).toBe(0);
    });

    it('初始求贤令应大于 0', () => {
      expect(INITIAL_RESOURCES.recruitToken).toBeGreaterThan(0);
    });

    it('所有资源应为非负数', () => {
      for (const val of Object.values(INITIAL_RESOURCES)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('INITIAL_PRODUCTION_RATES', () => {
    it('粮草产出速率应为 0.8/秒', () => {
      expect(INITIAL_PRODUCTION_RATES.grain).toBe(0.8);
    });

    it('求贤令被动产出速率应为正数', () => {
      expect(INITIAL_PRODUCTION_RATES.recruitToken).toBeGreaterThan(0);
    });

    it('所有速率应为非负数', () => {
      for (const val of Object.values(INITIAL_PRODUCTION_RATES)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('INITIAL_CAPS', () => {
    it('粮草上限应为 2000', () => {
      expect(INITIAL_CAPS.grain).toBe(2000);
    });

    it('铜钱应无上限（null）', () => {
      expect(INITIAL_CAPS.gold).toBeNull();
    });

    it('兵力上限应为 500', () => {
      expect(INITIAL_CAPS.troops).toBe(500);
    });
  });

  describe('GRANARY_CAPACITY_TABLE', () => {
    it('应包含关键等级的容量', () => {
      expect(GRANARY_CAPACITY_TABLE[1]).toBe(2000);
      expect(GRANARY_CAPACITY_TABLE[30]).toBe(200000);
    });

    it('容量应随等级递增', () => {
      const levels = Object.keys(GRANARY_CAPACITY_TABLE).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < levels.length; i++) {
        expect(GRANARY_CAPACITY_TABLE[levels[i]]).toBeGreaterThan(GRANARY_CAPACITY_TABLE[levels[i - 1]]);
      }
    });
  });

  describe('BARRACKS_CAPACITY_TABLE', () => {
    it('Lv1 应为 500', () => {
      expect(BARRACKS_CAPACITY_TABLE[1]).toBe(500);
    });

    it('容量应随等级递增', () => {
      const levels = Object.keys(BARRACKS_CAPACITY_TABLE).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < levels.length; i++) {
        expect(BARRACKS_CAPACITY_TABLE[levels[i]]).toBeGreaterThan(BARRACKS_CAPACITY_TABLE[levels[i - 1]]);
      }
    });
  });

  describe('CAP_WARNING_THRESHOLDS', () => {
    it('阈值应递增排列', () => {
      expect(CAP_WARNING_THRESHOLDS.safe).toBeLessThan(CAP_WARNING_THRESHOLDS.notice);
      expect(CAP_WARNING_THRESHOLDS.notice).toBeLessThan(CAP_WARNING_THRESHOLDS.warning);
      expect(CAP_WARNING_THRESHOLDS.warning).toBeLessThan(CAP_WARNING_THRESHOLDS.urgent);
    });

    it('urgent 应为 1.0（100%）', () => {
      expect(CAP_WARNING_THRESHOLDS.urgent).toBe(1.0);
    });
  });

  describe('OFFLINE_TIERS', () => {
    it('应包含5档衰减', () => {
      expect(OFFLINE_TIERS).toHaveLength(5);
    });

    it('第一档应为 100% 效率', () => {
      expect(OFFLINE_TIERS[0].efficiency).toBe(1.0);
    });

    it('最后一档应为 20% 效率', () => {
      expect(OFFLINE_TIERS[OFFLINE_TIERS.length - 1].efficiency).toBe(0.20);
    });
  });

  describe('OFFLINE_MAX_SECONDS', () => {
    it('应为 72 小时对应的秒数', () => {
      expect(OFFLINE_MAX_SECONDS).toBe(72 * 3600);
    });
  });

  describe('资源保护机制', () => {
    it('MIN_GRAIN_RESERVE 应为正数', () => {
      expect(MIN_GRAIN_RESERVE).toBeGreaterThan(0);
    });

    it('GOLD_SAFETY_LINE 应为正数', () => {
      expect(GOLD_SAFETY_LINE).toBeGreaterThan(0);
    });

    it('MANDATE_CONFIRM_THRESHOLD 应为正数', () => {
      expect(MANDATE_CONFIRM_THRESHOLD).toBeGreaterThan(0);
    });
  });

  describe('铜钱经济模型', () => {
    it('COPPER_PASSIVE_RATE 应为 1.3/秒', () => {
      expect(COPPER_PASSIVE_RATE).toBe(1.3);
    });

    it('COPPER_DAILY_TASK_REWARD 应为正数', () => {
      expect(COPPER_DAILY_TASK_REWARD).toBeGreaterThan(0);
    });

    it('COPPER_SHOP_DAILY_SPEND_LIMIT 应为正数', () => {
      expect(COPPER_SHOP_DAILY_SPEND_LIMIT).toBeGreaterThan(0);
    });

    it('COPPER_STAGE_CLEAR_BASE 应为正数', () => {
      expect(COPPER_STAGE_CLEAR_BASE).toBeGreaterThan(0);
    });
  });

  describe('SAVE_VERSION', () => {
    it('应为正整数', () => {
      expect(SAVE_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SAVE_VERSION)).toBe(true);
    });
  });
});
