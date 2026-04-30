/**
 * tech-effect-types 单元测试
 *
 * 验证科技效果类型的运行时常量：
 * - MILITARY_EFFECT_MAP 军事效果映射
 * - ECONOMY_EFFECT_MAP 经济效果映射
 * - CULTURE_EFFECT_MAP 文化效果映射
 */
import { describe, it, expect } from 'vitest';
import {
  MILITARY_EFFECT_MAP,
  ECONOMY_EFFECT_MAP,
  CULTURE_EFFECT_MAP,
} from '../tech-effect-types';

describe('tech-effect-types', () => {
  describe('MILITARY_EFFECT_MAP', () => {
    it('should map troop_attack to attack', () => {
      expect(MILITARY_EFFECT_MAP.troop_attack).toBe('attack');
    });

    it('should map troop_defense to defense', () => {
      expect(MILITARY_EFFECT_MAP.troop_defense).toBe('defense');
    });

    it('should map troop_hp to hp', () => {
      expect(MILITARY_EFFECT_MAP.troop_hp).toBe('hp');
    });

    it('should map march_speed to marchSpeed', () => {
      expect(MILITARY_EFFECT_MAP.march_speed).toBe('marchSpeed');
    });

    it('should have exactly 4 military effects', () => {
      expect(Object.keys(MILITARY_EFFECT_MAP)).toHaveLength(4);
    });

    it('all values should be valid MilitaryStat types', () => {
      const validStats = ['attack', 'defense', 'critRate', 'critDamage', 'damageBonus', 'hp', 'marchSpeed'];
      Object.values(MILITARY_EFFECT_MAP).forEach(stat => {
        expect(validStats).toContain(stat);
      });
    });
  });

  describe('ECONOMY_EFFECT_MAP', () => {
    it('should map resource_production to production', () => {
      expect(ECONOMY_EFFECT_MAP.resource_production).toBe('production');
    });

    it('should map resource_cap to storage', () => {
      expect(ECONOMY_EFFECT_MAP.resource_cap).toBe('storage');
    });

    it('should have exactly 2 economy effects', () => {
      expect(Object.keys(ECONOMY_EFFECT_MAP)).toHaveLength(2);
    });

    it('all values should be valid EconomyStat types', () => {
      const validStats = ['production', 'storage', 'trade'];
      Object.values(ECONOMY_EFFECT_MAP).forEach(stat => {
        expect(validStats).toContain(stat);
      });
    });
  });

  describe('CULTURE_EFFECT_MAP', () => {
    it('should map hero_exp to expBonus', () => {
      expect(CULTURE_EFFECT_MAP.hero_exp).toBe('expBonus');
    });

    it('should map research_speed to researchSpeed', () => {
      expect(CULTURE_EFFECT_MAP.research_speed).toBe('researchSpeed');
    });

    it('should map recruit_discount to recruitDiscount', () => {
      expect(CULTURE_EFFECT_MAP.recruit_discount).toBe('recruitDiscount');
    });

    it('should have exactly 3 culture effects', () => {
      expect(Object.keys(CULTURE_EFFECT_MAP)).toHaveLength(3);
    });

    it('all values should be valid CultureStat types', () => {
      const validStats = ['expBonus', 'researchSpeed', 'recruitDiscount'];
      Object.values(CULTURE_EFFECT_MAP).forEach(stat => {
        expect(validStats).toContain(stat);
      });
    });
  });

  describe('effect map cross-validation', () => {
    it('all effect maps should have unique keys within themselves', () => {
      [MILITARY_EFFECT_MAP, ECONOMY_EFFECT_MAP, CULTURE_EFFECT_MAP].forEach(map => {
        const keys = Object.keys(map);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
      });
    });

    it('all effect maps should have unique values across maps', () => {
      const allValues = [
        ...Object.values(MILITARY_EFFECT_MAP),
        ...Object.values(ECONOMY_EFFECT_MAP),
        ...Object.values(CULTURE_EFFECT_MAP),
      ];
      const uniqueValues = new Set(allValues);
      expect(uniqueValues.size).toBe(allValues.length);
    });

    it('total effect count should be 9 (4+2+3)', () => {
      const total = Object.keys(MILITARY_EFFECT_MAP).length
        + Object.keys(ECONOMY_EFFECT_MAP).length
        + Object.keys(CULTURE_EFFECT_MAP).length;
      expect(total).toBe(9);
    });
  });
});
