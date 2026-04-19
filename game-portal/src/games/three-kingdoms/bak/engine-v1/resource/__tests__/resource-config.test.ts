/**
 * resource-config.ts 单元测试
 * 验证配置常量的正确性和完整性
 */

import { describe, it, expect } from 'vitest';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  BUILDING_PRODUCTION,
  GRANARY_CAPACITY_TABLE,
  BARRACKS_CAPACITY_TABLE,
  CAP_WARNING_THRESHOLDS,
  OFFLINE_TIERS,
  OFFLINE_MAX_SECONDS,
  OFFLINE_POPUP_THRESHOLD_SECONDS,
  OFFLINE_FLOOR_EFFICIENCY,
  MIN_GRAIN_RESERVE,
  GOLD_SAFETY_LINE,
  MANDATE_CONFIRM_THRESHOLD,
  SAVE_VERSION,
} from '../resource-config';

// ═══════════════════════════════════════════════════════════════
// 1. 初始资源
// ═══════════════════════════════════════════════════════════════

describe('INITIAL_RESOURCES', () => {
  it('应包含4种资源且值正确', () => {
    expect(INITIAL_RESOURCES).toEqual({ grain: 200, gold: 100, troops: 50, mandate: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 初始产出速率
// ═══════════════════════════════════════════════════════════════

describe('INITIAL_PRODUCTION_RATES', () => {
  it('所有资源初始产出为0', () => {
    expect(INITIAL_PRODUCTION_RATES).toEqual({ grain: 0, gold: 0, troops: 0, mandate: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 初始上限
// ═══════════════════════════════════════════════════════════════

describe('INITIAL_CAPS', () => {
  it('应有正确的初始上限', () => {
    expect(INITIAL_CAPS.grain).toBe(2000);
    expect(INITIAL_CAPS.gold).toBeNull();
    expect(INITIAL_CAPS.troops).toBe(500);
    expect(INITIAL_CAPS.mandate).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 建筑产出配置
// ═══════════════════════════════════════════════════════════════

describe('BUILDING_PRODUCTION', () => {
  it('应包含三种建筑且公式正确', () => {
    const f = BUILDING_PRODUCTION.farmland;
    expect(f).toEqual({ resourceType: 'grain', baseRate: 1.0, levelFactor: 0.5 });
    expect(f.baseRate + f.levelFactor * 5).toBe(3.5); // Lv.5 = 3.5

    const m = BUILDING_PRODUCTION.market;
    expect(m).toEqual({ resourceType: 'gold', baseRate: 0.8, levelFactor: 0.4 });
    expect(m.baseRate + m.levelFactor * 10).toBe(4.8); // Lv.10 = 4.8

    const b = BUILDING_PRODUCTION.barracks;
    expect(b).toEqual({ resourceType: 'troops', baseRate: 0.5, levelFactor: 0.3 });
    expect(b.baseRate + b.levelFactor * 3).toBe(1.4); // Lv.3 = 1.4
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 仓库容量配置表
// ═══════════════════════════════════════════════════════════════

describe('容量配置表', () => {
  const expectedKeys = [1, 5, 10, 15, 20, 25, 30];

  describe('GRANARY_CAPACITY_TABLE', () => {
    it('应有7个等级节点且键正确', () => {
      const keys = Object.keys(GRANARY_CAPACITY_TABLE).map(Number).sort((a, b) => a - b);
      expect(keys).toEqual(expectedKeys);
    });

    it('首尾值正确且严格递增', () => {
      expect(GRANARY_CAPACITY_TABLE[1]).toBe(2000);
      expect(GRANARY_CAPACITY_TABLE[30]).toBe(200000);
      const keys = Object.keys(GRANARY_CAPACITY_TABLE).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < keys.length; i++) {
        expect(GRANARY_CAPACITY_TABLE[keys[i]]).toBeGreaterThan(GRANARY_CAPACITY_TABLE[keys[i - 1]]);
      }
    });
  });

  describe('BARRACKS_CAPACITY_TABLE', () => {
    it('应有7个等级节点且键正确', () => {
      const keys = Object.keys(BARRACKS_CAPACITY_TABLE).map(Number).sort((a, b) => a - b);
      expect(keys).toEqual(expectedKeys);
    });

    it('首尾值正确且严格递增', () => {
      expect(BARRACKS_CAPACITY_TABLE[1]).toBe(500);
      expect(BARRACKS_CAPACITY_TABLE[30]).toBe(50000);
      const keys = Object.keys(BARRACKS_CAPACITY_TABLE).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < keys.length; i++) {
        expect(BARRACKS_CAPACITY_TABLE[keys[i]]).toBeGreaterThan(BARRACKS_CAPACITY_TABLE[keys[i - 1]]);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 容量警告阈值
// ═══════════════════════════════════════════════════════════════

describe('CAP_WARNING_THRESHOLDS', () => {
  it('各阈值应正确且严格递增', () => {
    expect(CAP_WARNING_THRESHOLDS.safe).toBe(0.7);
    expect(CAP_WARNING_THRESHOLDS.notice).toBe(0.9);
    expect(CAP_WARNING_THRESHOLDS.warning).toBe(0.95);
    expect(CAP_WARNING_THRESHOLDS.urgent).toBe(1.0);
    expect(CAP_WARNING_THRESHOLDS.safe).toBeLessThan(CAP_WARNING_THRESHOLDS.notice);
    expect(CAP_WARNING_THRESHOLDS.notice).toBeLessThan(CAP_WARNING_THRESHOLDS.warning);
    expect(CAP_WARNING_THRESHOLDS.warning).toBeLessThan(CAP_WARNING_THRESHOLDS.urgent);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 离线收益配置
// ═══════════════════════════════════════════════════════════════

describe('OFFLINE_TIERS', () => {
  it('应包含5个衰减时段且值正确', () => {
    expect(OFFLINE_TIERS).toHaveLength(5);
    expect(OFFLINE_TIERS[0]).toEqual({ startSeconds: 0, endSeconds: 7200, efficiency: 1.0 });
    expect(OFFLINE_TIERS[1]).toEqual({ startSeconds: 7200, endSeconds: 28800, efficiency: 0.8 });
    expect(OFFLINE_TIERS[2]).toEqual({ startSeconds: 28800, endSeconds: 86400, efficiency: 0.6 });
    expect(OFFLINE_TIERS[3]).toEqual({ startSeconds: 86400, endSeconds: 172800, efficiency: 0.4 });
    expect(OFFLINE_TIERS[4]).toEqual({ startSeconds: 172800, endSeconds: 259200, efficiency: 0.25 });
  });

  it('时段连续且效率递减', () => {
    for (let i = 1; i < OFFLINE_TIERS.length; i++) {
      expect(OFFLINE_TIERS[i].startSeconds).toBe(OFFLINE_TIERS[i - 1].endSeconds);
      expect(OFFLINE_TIERS[i].efficiency).toBeLessThan(OFFLINE_TIERS[i - 1].efficiency);
    }
  });
});

describe('离线收益常量', () => {
  it('OFFLINE_MAX_SECONDS = 72h = 259200', () => {
    expect(OFFLINE_MAX_SECONDS).toBe(259200);
  });

  it('OFFLINE_POPUP_THRESHOLD_SECONDS = 300', () => {
    expect(OFFLINE_POPUP_THRESHOLD_SECONDS).toBe(300);
  });

  it('OFFLINE_FLOOR_EFFICIENCY = 0.15', () => {
    expect(OFFLINE_FLOOR_EFFICIENCY).toBe(0.15);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 资源保护机制
// ═══════════════════════════════════════════════════════════════

describe('资源保护常量', () => {
  it('MIN_GRAIN_RESERVE = 10, GOLD_SAFETY_LINE = 500, MANDATE_CONFIRM_THRESHOLD = 100', () => {
    expect(MIN_GRAIN_RESERVE).toBe(10);
    expect(GOLD_SAFETY_LINE).toBe(500);
    expect(MANDATE_CONFIRM_THRESHOLD).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 存档版本
// ═══════════════════════════════════════════════════════════════

describe('SAVE_VERSION', () => {
  it('当前版本为1且为正整数', () => {
    expect(SAVE_VERSION).toBe(1);
    expect(Number.isInteger(SAVE_VERSION)).toBe(true);
    expect(SAVE_VERSION).toBeGreaterThan(0);
  });
});
