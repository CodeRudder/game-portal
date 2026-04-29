/**
 * token-shop-config 测试
 *
 * 覆盖：
 *   - 默认配置完整性
 *   - 稀有度排序和价格倍率
 *   - 默认商品模板完整性
 *   - 各稀有度商品属性校验
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOKEN_SHOP_CONFIG,
  RARITY_ORDER,
  RARITY_PRICE_MULTIPLIER,
  DEFAULT_SHOP_ITEMS,
} from '../token-shop-config';

describe('token-shop-config', () => {
  describe('DEFAULT_TOKEN_SHOP_CONFIG', () => {
    it('应包含正确的默认配置', () => {
      expect(DEFAULT_TOKEN_SHOP_CONFIG.tokenName).toBe('活动代币');
      expect(DEFAULT_TOKEN_SHOP_CONFIG.dailyRefresh).toBe(true);
      expect(DEFAULT_TOKEN_SHOP_CONFIG.maxItems).toBe(12);
    });

    it('maxItems 应为正整数', () => {
      expect(DEFAULT_TOKEN_SHOP_CONFIG.maxItems).toBeGreaterThan(0);
      expect(Number.isInteger(DEFAULT_TOKEN_SHOP_CONFIG.maxItems)).toBe(true);
    });
  });

  describe('RARITY_ORDER', () => {
    it('应包含7个稀有度等级', () => {
      expect(RARITY_ORDER).toHaveLength(7);
    });

    it('稀有度应按从低到高排列', () => {
      expect(RARITY_ORDER[0]).toBe('common');
      expect(RARITY_ORDER[RARITY_ORDER.length - 1]).toBe('supreme');
    });
  });

  describe('RARITY_PRICE_MULTIPLIER', () => {
    it('每个稀有度应有对应的价格倍率', () => {
      for (const rarity of RARITY_ORDER) {
        expect(RARITY_PRICE_MULTIPLIER).toHaveProperty(rarity);
        expect(RARITY_PRICE_MULTIPLIER[rarity]).toBeGreaterThan(0);
      }
    });

    it('稀有度越高价格倍率越大', () => {
      for (let i = 1; i < RARITY_ORDER.length; i++) {
        const prev = RARITY_PRICE_MULTIPLIER[RARITY_ORDER[i - 1]];
        const curr = RARITY_PRICE_MULTIPLIER[RARITY_ORDER[i]];
        expect(curr).toBeGreaterThan(prev);
      }
    });

    it('common 倍率应为 1', () => {
      expect(RARITY_PRICE_MULTIPLIER.common).toBe(1);
    });
  });

  describe('DEFAULT_SHOP_ITEMS', () => {
    it('应包含7个商品（七阶各一个）', () => {
      expect(DEFAULT_SHOP_ITEMS).toHaveLength(7);
    });

    it('每个商品应有完整的属性', () => {
      for (const item of DEFAULT_SHOP_ITEMS) {
        expect(item.id).toBeTruthy();
        expect(item.name).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(RARITY_ORDER).toContain(item.rarity);
        expect(item.tokenPrice).toBeGreaterThan(0);
        expect(item.purchaseLimit).toBeGreaterThan(0);
        expect(item.purchased).toBe(0);
        expect(item.available).toBe(true);
      }
    });

    it('每个稀有度应有且仅有一个商品', () => {
      const rarities = DEFAULT_SHOP_ITEMS.map(item => item.rarity);
      const uniqueRarities = new Set(rarities);
      expect(uniqueRarities.size).toBe(rarities.length);
      for (const rarity of RARITY_ORDER) {
        expect(uniqueRarities).toContain(rarity);
      }
    });

    it('supreme 商品价格应最高', () => {
      const supremeItem = DEFAULT_SHOP_ITEMS.find(i => i.rarity === 'supreme');
      const commonItem = DEFAULT_SHOP_ITEMS.find(i => i.rarity === 'common');
      expect(supremeItem!.tokenPrice).toBeGreaterThan(commonItem!.tokenPrice);
    });

    it('所有商品应有 rewards 对象', () => {
      for (const item of DEFAULT_SHOP_ITEMS) {
        expect(item.rewards).toBeDefined();
        expect(Object.keys(item.rewards).length).toBeGreaterThan(0);
      }
    });
  });
});
