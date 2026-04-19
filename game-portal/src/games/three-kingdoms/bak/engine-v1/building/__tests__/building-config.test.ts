/**
 * building-config.ts 单元测试
 * 验证建筑配置常量的正确性和完整性
 */

import { describe, it, expect } from 'vitest';
import {
  BUILDING_DEFS,
  BUILDING_MAX_LEVELS,
  BUILDING_UNLOCK_LEVELS,
  BUILDING_SAVE_VERSION,
  QUEUE_CONFIGS,
  CANCEL_REFUND_RATIO,
} from '../building-config';
import { BUILDING_TYPES } from '../building.types';
import type { BuildingType } from '../building.types';

// ═══════════════════════════════════════════════════════════════
// 1. 8种建筑类型定义完整
// ═══════════════════════════════════════════════════════════════

describe('BUILDING_DEFS — 8种建筑类型完整性', () => {
  const EXPECTED_TYPES: BuildingType[] = [
    'castle', 'farmland', 'market', 'barracks',
    'smithy', 'academy', 'clinic', 'wall',
  ];

  it('应包含8种建筑定义', () => {
    const keys = Object.keys(BUILDING_DEFS) as BuildingType[];
    expect(keys).toHaveLength(8);
  });

  it('每种建筑类型与key一致', () => {
    for (const t of EXPECTED_TYPES) {
      expect(BUILDING_DEFS[t]).toBeDefined();
      expect(BUILDING_DEFS[t].type).toBe(t);
    }
  });

  it('每种建筑都有levelTable', () => {
    for (const t of EXPECTED_TYPES) {
      expect(Array.isArray(BUILDING_DEFS[t].levelTable)).toBe(true);
      expect(BUILDING_DEFS[t].levelTable.length).toBeGreaterThan(0);
    }
  });

  it('每种建筑都有maxLevel', () => {
    for (const t of EXPECTED_TYPES) {
      expect(BUILDING_DEFS[t].maxLevel).toBeGreaterThan(0);
    }
  });

  it('每种建筑都有unlockCastleLevel', () => {
    for (const t of EXPECTED_TYPES) {
      expect(typeof BUILDING_DEFS[t].unlockCastleLevel).toBe('number');
      expect(BUILDING_DEFS[t].unlockCastleLevel).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 等级上限配置
// ═══════════════════════════════════════════════════════════════

describe('BUILDING_MAX_LEVELS', () => {
  it('应包含8种建筑', () => {
    expect(Object.keys(BUILDING_MAX_LEVELS)).toHaveLength(8);
  });

  it('主城等级上限为30', () => {
    expect(BUILDING_MAX_LEVELS.castle).toBe(30);
  });

  it('农田/市集/兵营等级上限为25', () => {
    expect(BUILDING_MAX_LEVELS.farmland).toBe(25);
    expect(BUILDING_MAX_LEVELS.market).toBe(25);
    expect(BUILDING_MAX_LEVELS.barracks).toBe(25);
  });

  it('铁匠铺/书院/医馆/城墙等级上限为20', () => {
    expect(BUILDING_MAX_LEVELS.smithy).toBe(20);
    expect(BUILDING_MAX_LEVELS.academy).toBe(20);
    expect(BUILDING_MAX_LEVELS.clinic).toBe(20);
    expect(BUILDING_MAX_LEVELS.wall).toBe(20);
  });

  it('maxLevel与BUILDING_DEFS中一致', () => {
    for (const t of BUILDING_TYPES) {
      expect(BUILDING_MAX_LEVELS[t]).toBe(BUILDING_DEFS[t].maxLevel);
    }
  });

  it('levelTable长度应等于maxLevel', () => {
    for (const t of BUILDING_TYPES) {
      expect(BUILDING_DEFS[t].levelTable.length).toBe(BUILDING_DEFS[t].maxLevel);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 解锁条件
// ═══════════════════════════════════════════════════════════════

describe('BUILDING_UNLOCK_LEVELS', () => {
  it('应包含8种建筑', () => {
    expect(Object.keys(BUILDING_UNLOCK_LEVELS)).toHaveLength(8);
  });

  it('主城和农田初始解锁（unlockCastleLevel=0）', () => {
    expect(BUILDING_UNLOCK_LEVELS.castle).toBe(0);
    expect(BUILDING_UNLOCK_LEVELS.farmland).toBe(0);
  });

  it('市集和兵营需要主城Lv2', () => {
    expect(BUILDING_UNLOCK_LEVELS.market).toBe(2);
    expect(BUILDING_UNLOCK_LEVELS.barracks).toBe(2);
  });

  it('铁匠铺和书院需要主城Lv3', () => {
    expect(BUILDING_UNLOCK_LEVELS.smithy).toBe(3);
    expect(BUILDING_UNLOCK_LEVELS.academy).toBe(3);
  });

  it('医馆需要主城Lv4', () => {
    expect(BUILDING_UNLOCK_LEVELS.clinic).toBe(4);
  });

  it('城墙需要主城Lv5', () => {
    expect(BUILDING_UNLOCK_LEVELS.wall).toBe(5);
  });

  it('解锁等级与BUILDING_DEFS一致', () => {
    for (const t of BUILDING_TYPES) {
      expect(BUILDING_UNLOCK_LEVELS[t]).toBe(BUILDING_DEFS[t].unlockCastleLevel);
    }
  });

  it('解锁等级递增关系正确', () => {
    expect(BUILDING_UNLOCK_LEVELS.castle).toBeLessThanOrEqual(BUILDING_UNLOCK_LEVELS.farmland);
    expect(BUILDING_UNLOCK_LEVELS.farmland).toBeLessThanOrEqual(BUILDING_UNLOCK_LEVELS.market);
    expect(BUILDING_UNLOCK_LEVELS.market).toBeLessThanOrEqual(BUILDING_UNLOCK_LEVELS.smithy);
    expect(BUILDING_UNLOCK_LEVELS.smithy).toBeLessThanOrEqual(BUILDING_UNLOCK_LEVELS.clinic);
    expect(BUILDING_UNLOCK_LEVELS.clinic).toBeLessThanOrEqual(BUILDING_UNLOCK_LEVELS.wall);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 升级费用曲线正确性
// ═══════════════════════════════════════════════════════════════

describe('升级费用曲线', () => {
  it('主城Lv1升级费用为0（初始等级无升级成本）', () => {
    const lv1 = BUILDING_DEFS.castle.levelTable[0];
    expect(lv1.upgradeCost.grain).toBe(0);
    expect(lv1.upgradeCost.gold).toBe(0);
    expect(lv1.upgradeCost.troops).toBe(0);
    expect(lv1.upgradeCost.timeSeconds).toBe(0);
  });

  it('主城Lv1→2费用正确', () => {
    const lv2 = BUILDING_DEFS.castle.levelTable[1];
    expect(lv2.upgradeCost.grain).toBe(200);
    expect(lv2.upgradeCost.gold).toBe(150);
    expect(lv2.upgradeCost.troops).toBe(0);
    expect(lv2.upgradeCost.timeSeconds).toBe(10);
  });

  it('农田Lv1费用正确', () => {
    const lv1 = BUILDING_DEFS.farmland.levelTable[0];
    expect(lv1.upgradeCost.grain).toBe(100);
    expect(lv1.upgradeCost.gold).toBe(50);
    expect(lv1.upgradeCost.troops).toBe(0);
    expect(lv1.upgradeCost.timeSeconds).toBe(5);
  });

  it('市集Lv1费用正确', () => {
    const lv1 = BUILDING_DEFS.market.levelTable[0];
    expect(lv1.upgradeCost.grain).toBe(80);
    expect(lv1.upgradeCost.gold).toBe(100);
    expect(lv1.upgradeCost.troops).toBe(0);
    expect(lv1.upgradeCost.timeSeconds).toBe(5);
  });

  it('兵营Lv1费用正确', () => {
    const lv1 = BUILDING_DEFS.barracks.levelTable[0];
    expect(lv1.upgradeCost.grain).toBe(120);
    expect(lv1.upgradeCost.gold).toBe(80);
    expect(lv1.upgradeCost.troops).toBe(0);
    expect(lv1.upgradeCost.timeSeconds).toBe(8);
  });

  it('城墙Lv1费用包含兵力', () => {
    const lv1 = BUILDING_DEFS.wall.levelTable[0];
    expect(lv1.upgradeCost.troops).toBe(100);
  });

  it('所有建筑费用总体递增趋势（首尾对比）', () => {
    for (const t of BUILDING_TYPES) {
      const table = BUILDING_DEFS[t].levelTable;
      // 跳过Lv1（可能为0），从Lv2开始验证首尾递增
      if (table.length > 2) {
        expect(table[table.length - 1].upgradeCost.grain)
          .toBeGreaterThan(table[1].upgradeCost.grain);
      }
    }
  });

  it('所有建筑升级时间总体递增（首尾对比）', () => {
    for (const t of BUILDING_TYPES) {
      const table = BUILDING_DEFS[t].levelTable;
      if (table.length > 2) {
        expect(table[table.length - 1].upgradeCost.timeSeconds)
          .toBeGreaterThan(table[1].upgradeCost.timeSeconds);
      }
    }
  });

  it('所有费用值为非负整数', () => {
    for (const t of BUILDING_TYPES) {
      for (const lv of BUILDING_DEFS[t].levelTable) {
        expect(lv.upgradeCost.grain).toBeGreaterThanOrEqual(0);
        expect(lv.upgradeCost.gold).toBeGreaterThanOrEqual(0);
        expect(lv.upgradeCost.troops).toBeGreaterThanOrEqual(0);
        expect(lv.upgradeCost.timeSeconds).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(lv.upgradeCost.grain)).toBe(true);
        expect(Number.isInteger(lv.upgradeCost.gold)).toBe(true);
        expect(Number.isInteger(lv.upgradeCost.troops)).toBe(true);
        expect(Number.isInteger(lv.upgradeCost.timeSeconds)).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 产出配置与resource域对应
// ═══════════════════════════════════════════════════════════════

describe('产出配置', () => {
  it('农田产出粮草（grain）', () => {
    expect(BUILDING_DEFS.farmland.production?.resourceType).toBe('grain');
  });

  it('市集产出铜钱（gold）', () => {
    expect(BUILDING_DEFS.market.production?.resourceType).toBe('gold');
  });

  it('兵营产出兵力（troops）', () => {
    expect(BUILDING_DEFS.barracks.production?.resourceType).toBe('troops');
  });

  it('主城无production但有specialAttribute', () => {
    expect(BUILDING_DEFS.castle.production).toBeUndefined();
    expect(BUILDING_DEFS.castle.specialAttribute).toBeDefined();
    expect(BUILDING_DEFS.castle.specialAttribute?.name).toBe('全资源加成');
  });

  it('铁匠铺/书院/医馆/城墙无production字段', () => {
    expect(BUILDING_DEFS.smithy.production).toBeUndefined();
    expect(BUILDING_DEFS.academy.production).toBeUndefined();
    expect(BUILDING_DEFS.clinic.production).toBeUndefined();
    expect(BUILDING_DEFS.wall.production).toBeUndefined();
  });

  it('产出值（production）随等级递增', () => {
    const productionBuildings: BuildingType[] = ['farmland', 'market', 'barracks'];
    for (const t of productionBuildings) {
      const table = BUILDING_DEFS[t].levelTable;
      for (let i = 1; i < table.length; i++) {
        expect(table[i].production).toBeGreaterThan(table[i - 1].production);
      }
    }
  });

  it('主城产出（加成百分比）随等级递增', () => {
    const table = BUILDING_DEFS.castle.levelTable;
    for (let i = 2; i < table.length; i++) {
      expect(table[i].production).toBeGreaterThanOrEqual(table[i - 1].production);
    }
  });

  it('城墙有specialValue（城防值）', () => {
    for (const lv of BUILDING_DEFS.wall.levelTable) {
      expect(lv.specialValue).toBeDefined();
      expect(lv.specialValue).toBeGreaterThan(0);
    }
  });

  it('主城Lv1产出为0（无加成）', () => {
    expect(BUILDING_DEFS.castle.levelTable[0].production).toBe(0);
  });

  it('农田Lv1产出为0.8', () => {
    expect(BUILDING_DEFS.farmland.levelTable[0].production).toBe(0.8);
  });

  it('市集Lv1产出为0.6', () => {
    expect(BUILDING_DEFS.market.levelTable[0].production).toBe(0.6);
  });

  it('兵营Lv1产出为0.4', () => {
    expect(BUILDING_DEFS.barracks.levelTable[0].production).toBe(0.4);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 建筑依赖关系（解锁依赖主城等级）
// ═══════════════════════════════════════════════════════════════

describe('建筑依赖关系', () => {
  it('解锁等级不超过主城最大等级', () => {
    for (const t of BUILDING_TYPES) {
      expect(BUILDING_UNLOCK_LEVELS[t]).toBeLessThanOrEqual(BUILDING_MAX_LEVELS.castle);
    }
  });

  it('解锁后建筑等级上限不超过主城等级上限', () => {
    for (const t of BUILDING_TYPES) {
      // 非主城建筑的等级上限不超过主城等级上限
      if (t !== 'castle') {
        expect(BUILDING_MAX_LEVELS[t]).toBeLessThanOrEqual(BUILDING_MAX_LEVELS.castle);
      }
    }
  });

  it('所有建筑的解锁等级不大于自身等级上限', () => {
    for (const t of BUILDING_TYPES) {
      expect(BUILDING_UNLOCK_LEVELS[t]).toBeLessThanOrEqual(BUILDING_MAX_LEVELS[t]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 队列配置
// ═══════════════════════════════════════════════════════════════

describe('QUEUE_CONFIGS', () => {
  it('应包含4个等级段', () => {
    expect(QUEUE_CONFIGS).toHaveLength(4);
  });

  it('主城Lv1~5有1个队列槽位', () => {
    expect(QUEUE_CONFIGS[0].castleLevelMin).toBe(1);
    expect(QUEUE_CONFIGS[0].castleLevelMax).toBe(5);
    expect(QUEUE_CONFIGS[0].slots).toBe(1);
  });

  it('主城Lv6~10有2个队列槽位', () => {
    expect(QUEUE_CONFIGS[1].castleLevelMin).toBe(6);
    expect(QUEUE_CONFIGS[1].castleLevelMax).toBe(10);
    expect(QUEUE_CONFIGS[1].slots).toBe(2);
  });

  it('主城Lv11~20有3个队列槽位', () => {
    expect(QUEUE_CONFIGS[2].castleLevelMin).toBe(11);
    expect(QUEUE_CONFIGS[2].castleLevelMax).toBe(20);
    expect(QUEUE_CONFIGS[2].slots).toBe(3);
  });

  it('主城Lv21~30有4个队列槽位', () => {
    expect(QUEUE_CONFIGS[3].castleLevelMin).toBe(21);
    expect(QUEUE_CONFIGS[3].castleLevelMax).toBe(30);
    expect(QUEUE_CONFIGS[3].slots).toBe(4);
  });

  it('等级段连续无间隔', () => {
    for (let i = 1; i < QUEUE_CONFIGS.length; i++) {
      expect(QUEUE_CONFIGS[i].castleLevelMin).toBe(QUEUE_CONFIGS[i - 1].castleLevelMax + 1);
    }
  });

  it('覆盖主城全部等级范围（1~30）', () => {
    expect(QUEUE_CONFIGS[0].castleLevelMin).toBe(1);
    expect(QUEUE_CONFIGS[QUEUE_CONFIGS.length - 1].castleLevelMax).toBe(30);
  });

  it('槽位数递增', () => {
    for (let i = 1; i < QUEUE_CONFIGS.length; i++) {
      expect(QUEUE_CONFIGS[i].slots).toBeGreaterThan(QUEUE_CONFIGS[i - 1].slots);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 取消升级返还比例
// ═══════════════════════════════════════════════════════════════

describe('CANCEL_REFUND_RATIO', () => {
  it('返还比例为80%', () => {
    expect(CANCEL_REFUND_RATIO).toBe(0.8);
  });

  it('比例在合理范围(0,1)', () => {
    expect(CANCEL_REFUND_RATIO).toBeGreaterThan(0);
    expect(CANCEL_REFUND_RATIO).toBeLessThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 存档版本
// ═══════════════════════════════════════════════════════════════

describe('BUILDING_SAVE_VERSION', () => {
  it('当前版本应为1', () => {
    expect(BUILDING_SAVE_VERSION).toBe(1);
  });

  it('应为正整数', () => {
    expect(BUILDING_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(BUILDING_SAVE_VERSION)).toBe(true);
  });
});
