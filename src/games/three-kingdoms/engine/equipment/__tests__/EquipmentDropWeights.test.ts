/**
 * EquipmentDropWeights 单元测试
 *
 * 覆盖：关卡掉落权重、来源稀有度权重配置正确性
 */

import { describe, it, expect } from 'vitest';
import { CAMPAIGN_DROP_WEIGHTS, SOURCE_RARITY_WEIGHTS } from '../EquipmentDropWeights';
import type { EquipmentRarity, CampaignType } from '../../../core/equipment';
import { EQUIPMENT_RARITIES } from '../../../core/equipment';

// ═══════════════════════════════════════════════════
// 关卡掉落权重
// ═══════════════════════════════════════════════════

describe('EquipmentDropWeights — CAMPAIGN_DROP_WEIGHTS', () => {
  const campaignTypes: CampaignType[] = ['normal', 'elite', 'boss'];

  it('应包含所有关卡类型', () => {
    for (const type of campaignTypes) {
      expect(CAMPAIGN_DROP_WEIGHTS[type]).toBeDefined();
    }
  });

  it('每个关卡类型应包含所有品质权重', () => {
    for (const type of campaignTypes) {
      for (const rarity of EQUIPMENT_RARITIES) {
        expect(CAMPAIGN_DROP_WEIGHTS[type][rarity]).toBeDefined();
        expect(typeof CAMPAIGN_DROP_WEIGHTS[type][rarity]).toBe('number');
      }
    }
  });

  it('所有权重应为非负数', () => {
    for (const type of campaignTypes) {
      for (const rarity of EQUIPMENT_RARITIES) {
        expect(CAMPAIGN_DROP_WEIGHTS[type][rarity]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('normal 关卡白色权重应最高', () => {
    const normal = CAMPAIGN_DROP_WEIGHTS.normal;
    expect(normal.white).toBeGreaterThan(normal.green);
    expect(normal.white).toBeGreaterThan(normal.blue);
  });

  it('boss 关卡金色权重应最高', () => {
    const boss = CAMPAIGN_DROP_WEIGHTS.boss;
    expect(boss.gold).toBeGreaterThan(CAMPAIGN_DROP_WEIGHTS.normal.gold);
    expect(boss.gold).toBeGreaterThan(CAMPAIGN_DROP_WEIGHTS.elite.gold);
  });

  it('normal 关卡不应掉落金色装备', () => {
    expect(CAMPAIGN_DROP_WEIGHTS.normal.gold).toBe(0);
  });

  it('权重总和应大于 0', () => {
    for (const type of campaignTypes) {
      const total = EQUIPMENT_RARITIES.reduce(
        (sum, r) => sum + CAMPAIGN_DROP_WEIGHTS[type][r], 0,
      );
      expect(total).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════
// 来源稀有度权重
// ═══════════════════════════════════════════════════

describe('EquipmentDropWeights — SOURCE_RARITY_WEIGHTS', () => {
  it('应包含 equipment_box 和 event 来源', () => {
    expect(SOURCE_RARITY_WEIGHTS.equipment_box).toBeDefined();
    expect(SOURCE_RARITY_WEIGHTS.event).toBeDefined();
  });

  it('装备箱不应掉落白色和绿色', () => {
    expect(SOURCE_RARITY_WEIGHTS.equipment_box.white).toBe(0);
    expect(SOURCE_RARITY_WEIGHTS.equipment_box.green).toBe(0);
  });

  it('装备箱紫色权重应最高', () => {
    const box = SOURCE_RARITY_WEIGHTS.equipment_box;
    expect(box.purple).toBeGreaterThan(box.blue);
    expect(box.purple).toBeGreaterThan(box.gold);
  });

  it('活动来源紫色权重应最高', () => {
    const event = SOURCE_RARITY_WEIGHTS.event;
    expect(event.purple).toBeGreaterThan(event.blue);
    expect(event.purple).toBeGreaterThan(event.gold);
  });

  it('所有非零权重应为正数', () => {
    for (const source of Object.values(SOURCE_RARITY_WEIGHTS)) {
      for (const rarity of EQUIPMENT_RARITIES) {
        if (source[rarity] !== 0) {
          expect(source[rarity]).toBeGreaterThan(0);
        }
      }
    }
  });
});
