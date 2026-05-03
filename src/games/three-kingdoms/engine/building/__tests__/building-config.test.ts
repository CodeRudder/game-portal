/**
 * building-config — 单元测试
 *
 * 覆盖：
 *   - 建筑等级上限
 *   - 解锁条件
 *   - 等级数据表完整性
 *   - 建筑定义汇总
 *   - 队列配置
 *   - 常量值
 *
 * @module engine/building/__tests__/building-config.test
 */

import { describe, it, expect } from 'vitest';
import {
  BUILDING_MAX_LEVELS,
  BUILDING_UNLOCK_LEVELS,
  BUILDING_DEFS,
  QUEUE_CONFIGS,
  CANCEL_REFUND_RATIO,
  BUILDING_SAVE_VERSION,
} from '../building-config';
import type { BuildingType } from '../building.types';

const ALL_BUILDING_TYPES: BuildingType[] = ['castle', 'farmland', 'market', 'mine', 'lumberMill', 'barracks', 'workshop', 'academy', 'clinic', 'wall', 'tavern'];

// ─────────────────────────────────────────────
// 建筑等级上限
// ─────────────────────────────────────────────

describe('BUILDING_MAX_LEVELS', () => {
  it('应包含 11 种建筑', () => {
    expect(Object.keys(BUILDING_MAX_LEVELS)).toHaveLength(11);
  });

  it('所有建筑等级上限 > 0', () => {
    for (const type of ALL_BUILDING_TYPES) {
      expect(BUILDING_MAX_LEVELS[type]).toBeGreaterThan(0);
    }
  });

  it('主城等级上限为 30', () => {
    expect(BUILDING_MAX_LEVELS.castle).toBe(30);
  });

  it('农田/市集/矿场/伐木场/兵营等级上限为 25', () => {
    expect(BUILDING_MAX_LEVELS.farmland).toBe(25);
    expect(BUILDING_MAX_LEVELS.market).toBe(25);
    expect(BUILDING_MAX_LEVELS.mine).toBe(25);
    expect(BUILDING_MAX_LEVELS.lumberMill).toBe(25);
    expect(BUILDING_MAX_LEVELS.barracks).toBe(25);
  });

  it('铁匠铺/书院/医馆/城墙/酒馆等级上限为 20', () => {
    expect(BUILDING_MAX_LEVELS.workshop).toBe(20);
    expect(BUILDING_MAX_LEVELS.academy).toBe(20);
    expect(BUILDING_MAX_LEVELS.clinic).toBe(20);
    expect(BUILDING_MAX_LEVELS.wall).toBe(20);
    expect(BUILDING_MAX_LEVELS.tavern).toBe(20);
  });
});

// ─────────────────────────────────────────────
// 解锁条件
// ─────────────────────────────────────────────

describe('BUILDING_UNLOCK_LEVELS', () => {
  it('应包含 11 种建筑', () => {
    expect(Object.keys(BUILDING_UNLOCK_LEVELS)).toHaveLength(11);
  });

  it('主城、农田、市集、矿场、伐木场初始解锁（0级）', () => {
    expect(BUILDING_UNLOCK_LEVELS.castle).toBe(0);
    expect(BUILDING_UNLOCK_LEVELS.farmland).toBe(0);
    expect(BUILDING_UNLOCK_LEVELS.market).toBe(0);
    expect(BUILDING_UNLOCK_LEVELS.mine).toBe(0);
    expect(BUILDING_UNLOCK_LEVELS.lumberMill).toBe(0);
  });

  it('兵营主城 2 级解锁', () => {
    expect(BUILDING_UNLOCK_LEVELS.barracks).toBe(2);
  });

  it('铁匠铺和书院主城 3 级解锁', () => {
    expect(BUILDING_UNLOCK_LEVELS.workshop).toBe(3);
    expect(BUILDING_UNLOCK_LEVELS.academy).toBe(3);
  });

  it('医馆主城 4 级解锁', () => {
    expect(BUILDING_UNLOCK_LEVELS.clinic).toBe(4);
  });

  it('城墙和酒馆主城 5 级解锁', () => {
    expect(BUILDING_UNLOCK_LEVELS.wall).toBe(5);
    expect(BUILDING_UNLOCK_LEVELS.tavern).toBe(5);
  });

  it('解锁条件非负', () => {
    for (const type of ALL_BUILDING_TYPES) {
      expect(BUILDING_UNLOCK_LEVELS[type]).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────
// 建筑定义
// ─────────────────────────────────────────────

describe('BUILDING_DEFS', () => {
  it('应包含 11 种建筑定义', () => {
    expect(Object.keys(BUILDING_DEFS)).toHaveLength(11);
  });

  it('每个建筑定义的 maxLevel 与 BUILDING_MAX_LEVELS 一致', () => {
    for (const type of ALL_BUILDING_TYPES) {
      expect(BUILDING_DEFS[type].maxLevel).toBe(BUILDING_MAX_LEVELS[type]);
    }
  });

  it('每个建筑定义的 unlockCastleLevel 与 BUILDING_UNLOCK_LEVELS 一致', () => {
    for (const type of ALL_BUILDING_TYPES) {
      expect(BUILDING_DEFS[type].unlockCastleLevel).toBe(BUILDING_UNLOCK_LEVELS[type]);
    }
  });

  it('每个建筑的 levelTable 长度等于 maxLevel', () => {
    for (const type of ALL_BUILDING_TYPES) {
      const def = BUILDING_DEFS[type];
      expect(def.levelTable).toHaveLength(def.maxLevel);
    }
  });

  it('产出建筑（农田/市集/矿场/伐木场/兵营/书院）应有 production 配置', () => {
    const productionTypes: BuildingType[] = ['farmland', 'market', 'mine', 'lumberMill', 'barracks', 'academy'];
    for (const type of productionTypes) {
      expect(BUILDING_DEFS[type].production).toBeDefined();
      expect(BUILDING_DEFS[type].production!.resourceType).toBeTruthy();
    }
  });

  it('主城应有 specialAttribute', () => {
    expect(BUILDING_DEFS.castle.specialAttribute).toBeDefined();
    expect(BUILDING_DEFS.castle.specialAttribute!.name).toBeTruthy();
  });

  it('等级数据表产出值应非负', () => {
    for (const type of ALL_BUILDING_TYPES) {
      for (const level of BUILDING_DEFS[type].levelTable) {
        expect(level.production).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('等级数据表升级费用应非负', () => {
    for (const type of ALL_BUILDING_TYPES) {
      for (const level of BUILDING_DEFS[type].levelTable) {
        expect(level.upgradeCost.grain).toBeGreaterThanOrEqual(0);
        expect(level.upgradeCost.gold).toBeGreaterThanOrEqual(0);
        expect(level.upgradeCost.troops).toBeGreaterThanOrEqual(0);
        expect(level.upgradeCost.timeSeconds).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('主城产出（全资源加成%）应单调递增', () => {
    const levels = BUILDING_DEFS.castle.levelTable;
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].production).toBeGreaterThanOrEqual(levels[i - 1].production);
    }
  });

  it('农田产出应单调递增', () => {
    const levels = BUILDING_DEFS.farmland.levelTable;
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].production).toBeGreaterThan(levels[i - 1].production);
    }
  });

  it('市集产出应单调递增', () => {
    const levels = BUILDING_DEFS.market.levelTable;
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].production).toBeGreaterThan(levels[i - 1].production);
    }
  });

  it('兵营产出应单调递增', () => {
    const levels = BUILDING_DEFS.barracks.levelTable;
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i].production).toBeGreaterThan(levels[i - 1].production);
    }
  });
});

// ─────────────────────────────────────────────
// 队列配置
// ─────────────────────────────────────────────

describe('QUEUE_CONFIGS', () => {
  it('应有 4 个配置段', () => {
    expect(QUEUE_CONFIGS).toHaveLength(4);
  });

  it('等级段应无重叠且连续', () => {
    for (let i = 1; i < QUEUE_CONFIGS.length; i++) {
      expect(QUEUE_CONFIGS[i].castleLevelMin).toBe(QUEUE_CONFIGS[i - 1].castleLevelMax + 1);
    }
  });

  it('覆盖范围 1~30 级', () => {
    expect(QUEUE_CONFIGS[0].castleLevelMin).toBe(1);
    expect(QUEUE_CONFIGS[QUEUE_CONFIGS.length - 1].castleLevelMax).toBe(30);
  });

  it('槽位数应单调递增', () => {
    for (let i = 1; i < QUEUE_CONFIGS.length; i++) {
      expect(QUEUE_CONFIGS[i].slots).toBeGreaterThanOrEqual(QUEUE_CONFIGS[i - 1].slots);
    }
  });

  it('初始 1 个队列，最高 4 个队列', () => {
    expect(QUEUE_CONFIGS[0].slots).toBe(1);
    expect(QUEUE_CONFIGS[QUEUE_CONFIGS.length - 1].slots).toBe(4);
  });
});

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

describe('常量', () => {
  it('CANCEL_REFUND_RATIO 为 0.8', () => {
    expect(CANCEL_REFUND_RATIO).toBe(0.8);
  });

  it('CANCEL_REFUND_RATIO 在 (0, 1] 范围内', () => {
    expect(CANCEL_REFUND_RATIO).toBeGreaterThan(0);
    expect(CANCEL_REFUND_RATIO).toBeLessThanOrEqual(1);
  });

  it('BUILDING_SAVE_VERSION 为正整数', () => {
    expect(BUILDING_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(BUILDING_SAVE_VERSION)).toBe(true);
  });
});
