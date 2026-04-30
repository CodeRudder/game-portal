/**
 * tech/TechEffectTypes.ts 单元测试
 *
 * 覆盖导出函数：
 * - defaultBattleBonuses
 * - defaultResourceBonuses
 * - defaultCultureBonuses
 *
 * 验证常量：
 * - RESOURCE_TARGET_MAP
 * - RESOURCE_PRODUCTION_MAP
 */

import { describe, it, expect } from 'vitest';
import {
  RESOURCE_TARGET_MAP,
  RESOURCE_PRODUCTION_MAP,
  defaultBattleBonuses,
  defaultResourceBonuses,
  defaultCultureBonuses,
} from '../TechEffectTypes';

// ═══════════════════════════════════════════
// defaultBattleBonuses
// ═══════════════════════════════════════════
describe('defaultBattleBonuses', () => {
  it('所有乘数初始为 1（无加成）', () => {
    const bonuses = defaultBattleBonuses();
    expect(bonuses.attackMultiplier).toBe(1);
    expect(bonuses.defenseMultiplier).toBe(1);
    expect(bonuses.damageMultiplier).toBe(1);
    expect(bonuses.hpMultiplier).toBe(1);
  });

  it('暴击相关初始为 0', () => {
    const bonuses = defaultBattleBonuses();
    expect(bonuses.critRateBonus).toBe(0);
    expect(bonuses.critDamageBonus).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = defaultBattleBonuses();
    const b = defaultBattleBonuses();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('修改副本不影响新创建的对象', () => {
    const a = defaultBattleBonuses();
    a.attackMultiplier = 2;
    const b = defaultBattleBonuses();
    expect(b.attackMultiplier).toBe(1);
  });

  it('包含所有必要字段', () => {
    const bonuses = defaultBattleBonuses();
    expect(bonuses).toHaveProperty('attackMultiplier');
    expect(bonuses).toHaveProperty('defenseMultiplier');
    expect(bonuses).toHaveProperty('critRateBonus');
    expect(bonuses).toHaveProperty('critDamageBonus');
    expect(bonuses).toHaveProperty('damageMultiplier');
    expect(bonuses).toHaveProperty('hpMultiplier');
  });
});

// ═══════════════════════════════════════════
// defaultResourceBonuses
// ═══════════════════════════════════════════
describe('defaultResourceBonuses', () => {
  it('所有产出乘数初始为 1', () => {
    const bonuses = defaultResourceBonuses();
    for (const key of Object.keys(bonuses.productionMultipliers)) {
      expect(bonuses.productionMultipliers[key as keyof typeof bonuses.productionMultipliers]).toBe(1);
    }
  });

  it('所有存储乘数初始为 1', () => {
    const bonuses = defaultResourceBonuses();
    for (const key of Object.keys(bonuses.storageMultipliers)) {
      expect(bonuses.storageMultipliers[key as keyof typeof bonuses.storageMultipliers]).toBe(1);
    }
  });

  it('交易加成初始为 0', () => {
    const bonuses = defaultResourceBonuses();
    expect(bonuses.tradeBonus).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = defaultResourceBonuses();
    const b = defaultResourceBonuses();
    expect(a).not.toBe(b);
    expect(a.productionMultipliers).not.toBe(b.productionMultipliers);
    expect(a.storageMultipliers).not.toBe(b.storageMultipliers);
  });

  it('productionMultipliers 包含所有资源类型', () => {
    const bonuses = defaultResourceBonuses();
    const expectedKeys = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken', 'skillBook'];
    for (const key of expectedKeys) {
      expect(bonuses.productionMultipliers).toHaveProperty(key);
    }
  });

  it('storageMultipliers 包含所有资源类型', () => {
    const bonuses = defaultResourceBonuses();
    const expectedKeys = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken', 'skillBook'];
    for (const key of expectedKeys) {
      expect(bonuses.storageMultipliers).toHaveProperty(key);
    }
  });
});

// ═══════════════════════════════════════════
// defaultCultureBonuses
// ═══════════════════════════════════════════
describe('defaultCultureBonuses', () => {
  it('经验乘数初始为 1', () => {
    const bonuses = defaultCultureBonuses();
    expect(bonuses.expMultiplier).toBe(1);
  });

  it('研究速度乘数初始为 1', () => {
    const bonuses = defaultCultureBonuses();
    expect(bonuses.researchSpeedMultiplier).toBe(1);
  });

  it('招募折扣初始为 0', () => {
    const bonuses = defaultCultureBonuses();
    expect(bonuses.recruitDiscount).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = defaultCultureBonuses();
    const b = defaultCultureBonuses();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('包含所有必要字段', () => {
    const bonuses = defaultCultureBonuses();
    expect(bonuses).toHaveProperty('expMultiplier');
    expect(bonuses).toHaveProperty('researchSpeedMultiplier');
    expect(bonuses).toHaveProperty('recruitDiscount');
  });
});

// ═══════════════════════════════════════════
// RESOURCE_TARGET_MAP
// ═══════════════════════════════════════════
describe('RESOURCE_TARGET_MAP', () => {
  it('包含所有资源类型', () => {
    const expectedKeys = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken', 'skillBook'];
    for (const key of expectedKeys) {
      expect(RESOURCE_TARGET_MAP).toHaveProperty(key);
    }
  });

  it('映射值为字符串', () => {
    for (const val of Object.values(RESOURCE_TARGET_MAP)) {
      expect(typeof val).toBe('string');
      expect(val).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════
// RESOURCE_PRODUCTION_MAP
// ═══════════════════════════════════════════
describe('RESOURCE_PRODUCTION_MAP', () => {
  it('包含所有资源类型', () => {
    const expectedKeys = ['grain', 'gold', 'troops', 'mandate', 'techPoint', 'recruitToken', 'skillBook'];
    for (const key of expectedKeys) {
      expect(RESOURCE_PRODUCTION_MAP).toHaveProperty(key);
    }
  });

  it('映射值以 PerSec 结尾', () => {
    for (const val of Object.values(RESOURCE_PRODUCTION_MAP)) {
      expect(val).toMatch(/PerSec$/);
    }
  });
});
