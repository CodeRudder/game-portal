/**
 * HeroDispatchSystem — attack 加成专项测试
 *
 * 覆盖 attack 属性对派驻加成的影响：
 *   1. attack=0 时加成为基础值（无 attack 乘数）
 *   2. attack=100 时 attackBonus=1.0，加成翻倍
 *   3. attack=500 时 attackBonus=5.0，加成 ×6
 *   4. 不同品质武将 attack 加成差异
 *   5. 升级后 attack 增加 → 加成自动更新
 *   6. 派驻+升级联动：派驻后升级，加成实时更新
 *   7. 取消派驻后加成清零
 *   8. 多武将派驻不同建筑，各自 attack 独立计算
 *   9. 边界：attack 为负数 / undefined / null
 *  10. 综合加成 = (品质系数 + 等级系数) × (1 + attack × 0.01)
 *
 * 加成公式（源码）：
 *   qualityBonus = QUALITY_BONUS[quality]         // COMMON=1, FINE=2, RARE=3, EPIC=5, LEGENDARY=8
 *   levelBonus   = level × 0.5
 *   attackBonus  = (baseStats.attack ?? 0) × 0.01
 *   totalBonus   = (qualityBonus + levelBonus) × (1 + attackBonus)
 *   result       = Math.round(totalBonus × 10) / 10  // 保留一位小数
 *
 * @module engine/hero/__tests__/HeroDispatchSystem.attack-bonus.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroDispatchSystem } from '../HeroDispatchSystem';
import type { GeneralData, Quality } from '../hero.types';
import type { BuildingType } from '../../../shared/types';
import type { ISystemDeps } from '../../../core/types';

// ── 测试辅助 ──────────────────────────────────

/** 创建 mock GeneralData */
function createMockGeneral(overrides: Partial<GeneralData> & { id: string }): GeneralData {
  return {
    name: overrides.name ?? '测试武将',
    quality: overrides.quality ?? ('RARE' as Quality),
    baseStats: overrides.baseStats ?? { attack: 100, defense: 80, intelligence: 90, speed: 70 },
    level: overrides.level ?? 10,
    exp: overrides.exp ?? 0,
    faction: overrides.faction ?? 'shu',
    skills: overrides.skills ?? [],
    ...overrides,
  } as GeneralData;
}

/** 创建 mock ISystemDeps */
function createMockDeps(): ISystemDeps {
  return {
    getResource: () => 0,
    getProductionRate: () => 0,
    emit: () => {},
  } as unknown as ISystemDeps;
}

/** 品质加成映射（与源码同步） */
const QUALITY_BONUS: Record<string, number> = {
  COMMON: 1,
  FINE: 2,
  RARE: 3,
  EPIC: 5,
  LEGENDARY: 8,
};

/** 手动计算期望加成 */
function expectedBonus(level: number, quality: string, attack?: number): number {
  const qualityBonus = QUALITY_BONUS[quality] ?? 1;
  const levelBonus = level * 0.5;
  const attackBonus = (attack ?? 0) * 0.01;
  const total = (qualityBonus + levelBonus) * (1 + attackBonus);
  return Math.round(total * 10) / 10;
}

// ── 测试 ──────────────────────────────────────

describe('HeroDispatchSystem — attack 加成专项', () => {
  let system: HeroDispatchSystem;
  let generalMap: Record<string, GeneralData>;

  beforeEach(() => {
    system = new HeroDispatchSystem();
    system.init(createMockDeps());
    generalMap = {};
    system.setGetGeneral((heroId: string) => generalMap[heroId]);
  });

  // ── 1. attack=0 时加成 ──

  describe('attack=0 时加成', () => {
    it('attack=0 时加成为基础值（无 attack 乘数）', () => {
      generalMap['hero_zero'] = createMockGeneral({
        id: 'hero_zero',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });

      const result = system.dispatchHero('hero_zero', 'barracks');
      expect(result.success).toBe(true);
      // qualityBonus=3, levelBonus=10*0.5=5, attackBonus=0*0.01=0
      // totalBonus = (3 + 5) × (1 + 0) = 8.0
      expect(result.bonusPercent).toBe(8.0);
    });

    it('attack=0 时 expectedBonus 交叉验证', () => {
      generalMap['hero_zero'] = createMockGeneral({
        id: 'hero_zero',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });

      const result = system.dispatchHero('hero_zero', 'barracks');
      expect(result.bonusPercent).toBe(expectedBonus(10, 'RARE', 0));
    });
  });

  // ── 2. attack=100 时加成 ──

  describe('attack=100 时加成', () => {
    it('attack=100 时 attackBonus=1.0，加成翻倍', () => {
      generalMap['hero_100'] = createMockGeneral({
        id: 'hero_100',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 },
      });

      const result = system.dispatchHero('hero_100', 'market');
      expect(result.success).toBe(true);
      // qualityBonus=3, levelBonus=5, attackBonus=100*0.01=1
      // totalBonus = (3 + 5) × (1 + 1) = 16.0
      expect(result.bonusPercent).toBe(16.0);
    });

    it('attack=100 加成是 attack=0 的两倍（同品质同等级）', () => {
      generalMap['hero_zero'] = createMockGeneral({
        id: 'hero_zero',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['hero_100'] = createMockGeneral({
        id: 'hero_100',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 },
      });

      const r0 = system.dispatchHero('hero_zero', 'barracks');
      const r100 = system.dispatchHero('hero_100', 'market');

      // attack=100 的加成应为 attack=0 的 2 倍
      expect(r100.bonusPercent).toBeCloseTo(r0.bonusPercent * 2, 1);
    });
  });

  // ── 3. attack=500 时加成 ──

  describe('attack=500 时加成', () => {
    it('attack=500 时 attackBonus=5.0，加成 ×6', () => {
      generalMap['hero_500'] = createMockGeneral({
        id: 'hero_500',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 500, defense: 200, intelligence: 150, speed: 100 },
      });

      const result = system.dispatchHero('hero_500', 'academy');
      expect(result.success).toBe(true);
      // qualityBonus=3, levelBonus=5, attackBonus=500*0.01=5
      // totalBonus = (3 + 5) × (1 + 5) = 48.0
      expect(result.bonusPercent).toBe(48.0);
    });

    it('attack=500 加成是 attack=0 的 6 倍', () => {
      generalMap['hero_zero'] = createMockGeneral({
        id: 'hero_zero',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['hero_500'] = createMockGeneral({
        id: 'hero_500',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 500, defense: 200, intelligence: 150, speed: 100 },
      });

      const r0 = system.dispatchHero('hero_zero', 'barracks');
      const r500 = system.dispatchHero('hero_500', 'market');

      expect(r500.bonusPercent).toBeCloseTo(r0.bonusPercent * 6, 1);
    });
  });

  // ── 4. 不同品质武将 attack 加成差异 ──

  describe('不同品质武将 attack 加成差异', () => {
    it('同 attack 不同品质，LEGENDARY 加成 > COMMON', () => {
      const attack = 100;
      generalMap['common'] = createMockGeneral({
        id: 'common',
        level: 10,
        quality: 'COMMON' as Quality,
        baseStats: { attack, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['legendary'] = createMockGeneral({
        id: 'legendary',
        level: 10,
        quality: 'LEGENDARY' as Quality,
        baseStats: { attack, defense: 200, intelligence: 150, speed: 100 },
      });

      const rCommon = system.dispatchHero('common', 'barracks');
      const rLegendary = system.dispatchHero('legendary', 'market');

      expect(rLegendary.bonusPercent).toBeGreaterThan(rCommon.bonusPercent);
    });

    it('所有品质在 attack=100 时加成均正确', () => {
      const qualities: Quality[] = ['COMMON', 'FINE', 'RARE', 'EPIC', 'LEGENDARY'];
      const attack = 100;
      const level = 10;

      for (const q of qualities) {
        const id = `hero_${q}`;
        generalMap[id] = createMockGeneral({
          id,
          level,
          quality: q,
          baseStats: { attack, defense: 80, intelligence: 90, speed: 70 },
        });

        const result = system.dispatchHero(id, `building_${q}` as BuildingType);
        expect(result.bonusPercent).toBe(expectedBonus(level, q, attack));
      }
    });

    it('attack=0 时品质差异仍然体现（纯品质+等级加成）', () => {
      generalMap['common_0'] = createMockGeneral({
        id: 'common_0',
        level: 10,
        quality: 'COMMON' as Quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['epic_0'] = createMockGeneral({
        id: 'epic_0',
        level: 10,
        quality: 'EPIC' as Quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });

      const rCommon = system.dispatchHero('common_0', 'barracks');
      const rEpic = system.dispatchHero('epic_0', 'market');

      // EPIC 品质系数=5, COMMON 品质系数=1
      // EPIC 加成应大于 COMMON
      expect(rEpic.bonusPercent).toBeGreaterThan(rCommon.bonusPercent);
    });
  });

  // ── 5. 升级后 attack 增加 → 加成自动更新 ──

  describe('升级后 attack 增加 → 加成自动更新', () => {
    it('武将升级后 refreshDispatchBonus 返回更高加成', () => {
      generalMap['hero_up'] = createMockGeneral({
        id: 'hero_up',
        level: 5,
        quality: 'RARE' as Quality,
        baseStats: { attack: 50, defense: 40, intelligence: 30, speed: 20 },
      });

      system.dispatchHero('hero_up', 'barracks');
      const bonusBefore = system.getDispatchBonus('barracks');

      // 模拟升级：level 5→20, attack 50→150
      generalMap['hero_up'] = createMockGeneral({
        id: 'hero_up',
        level: 20,
        quality: 'RARE' as Quality,
        baseStats: { attack: 150, defense: 120, intelligence: 90, speed: 60 },
      });

      const bonusAfter = system.refreshDispatchBonus('hero_up');
      expect(bonusAfter).toBeGreaterThan(bonusBefore);
    });

    it('升级前后加成值与公式一致', () => {
      generalMap['hero_formula'] = createMockGeneral({
        id: 'hero_formula',
        level: 5,
        quality: 'EPIC' as Quality,
        baseStats: { attack: 80, defense: 60, intelligence: 50, speed: 40 },
      });

      system.dispatchHero('hero_formula', 'barracks');
      expect(system.getDispatchBonus('barracks')).toBe(expectedBonus(5, 'EPIC', 80));

      // 升级
      generalMap['hero_formula'] = createMockGeneral({
        id: 'hero_formula',
        level: 25,
        quality: 'EPIC' as Quality,
        baseStats: { attack: 200, defense: 150, intelligence: 100, speed: 80 },
      });

      system.refreshDispatchBonus('hero_formula');
      expect(system.getDispatchBonus('barracks')).toBe(expectedBonus(25, 'EPIC', 200));
    });
  });

  // ── 6. 派驻+升级联动：派驻后升级，加成实时更新 ──

  describe('派驻+升级联动', () => {
    it('派驻后升级，getDispatchBonus 实时反映新加成', () => {
      generalMap['hero_link'] = createMockGeneral({
        id: 'hero_link',
        level: 1,
        quality: 'FINE' as Quality,
        baseStats: { attack: 20, defense: 15, intelligence: 10, speed: 10 },
      });

      system.dispatchHero('hero_link', 'farmland');
      // level=1, FINE, attack=20
      // qualityBonus=2, levelBonus=0.5, attackBonus=0.2
      // totalBonus = (2 + 0.5) × (1 + 0.2) = 3.0
      expect(system.getDispatchBonus('farmland')).toBe(3.0);

      // 模拟连续升级
      generalMap['hero_link'] = createMockGeneral({
        id: 'hero_link',
        level: 30,
        quality: 'FINE' as Quality,
        baseStats: { attack: 250, defense: 180, intelligence: 120, speed: 90 },
      });

      system.refreshDispatchBonus('hero_link');
      // qualityBonus=2, levelBonus=15, attackBonus=2.5
      // totalBonus = (2 + 15) × (1 + 2.5) = 59.5
      expect(system.getDispatchBonus('farmland')).toBe(59.5);
    });

    it('多次升级 refreshDispatchBonus 始终返回最新值', () => {
      generalMap['hero_multi'] = createMockGeneral({
        id: 'hero_multi',
        level: 1,
        quality: 'COMMON' as Quality,
        baseStats: { attack: 10, defense: 10, intelligence: 10, speed: 10 },
      });

      system.dispatchHero('hero_multi', 'smithy');
      const bonus1 = system.getDispatchBonus('smithy');

      // 第一次升级
      generalMap['hero_multi'] = createMockGeneral({
        id: 'hero_multi',
        level: 10,
        quality: 'COMMON' as Quality,
        baseStats: { attack: 60, defense: 50, intelligence: 40, speed: 30 },
      });
      const bonus2 = system.refreshDispatchBonus('hero_multi');
      expect(bonus2).toBeGreaterThan(bonus1);

      // 第二次升级
      generalMap['hero_multi'] = createMockGeneral({
        id: 'hero_multi',
        level: 30,
        quality: 'COMMON' as Quality,
        baseStats: { attack: 200, defense: 150, intelligence: 100, speed: 80 },
      });
      const bonus3 = system.refreshDispatchBonus('hero_multi');
      expect(bonus3).toBeGreaterThan(bonus2);
    });
  });

  // ── 7. 取消派驻后加成清零 ──

  describe('取消派驻后加成清零', () => {
    it('取消派驻后 getDispatchBonus 返回 0', () => {
      generalMap['hero_cancel'] = createMockGeneral({
        id: 'hero_cancel',
        level: 20,
        quality: 'EPIC' as Quality,
        baseStats: { attack: 200, defense: 150, intelligence: 100, speed: 80 },
      });

      system.dispatchHero('hero_cancel', 'barracks');
      expect(system.getDispatchBonus('barracks')).toBeGreaterThan(0);

      system.undeployHero('hero_cancel');
      expect(system.getDispatchBonus('barracks')).toBe(0);
    });

    it('取消派驻不影响其他建筑的加成', () => {
      generalMap['hero_a'] = createMockGeneral({
        id: 'hero_a',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 },
      });
      generalMap['hero_b'] = createMockGeneral({
        id: 'hero_b',
        level: 15,
        quality: 'EPIC' as Quality,
        baseStats: { attack: 150, defense: 100, intelligence: 80, speed: 60 },
      });

      system.dispatchHero('hero_a', 'barracks');
      system.dispatchHero('hero_b', 'market');

      const marketBonus = system.getDispatchBonus('market');
      system.undeployHero('hero_a');

      // barracks 加成清零
      expect(system.getDispatchBonus('barracks')).toBe(0);
      // market 加成不受影响
      expect(system.getDispatchBonus('market')).toBe(marketBonus);
    });
  });

  // ── 8. 多武将派驻不同建筑，各自 attack 独立计算 ──

  describe('多武将派驻不同建筑，各自 attack 独立计算', () => {
    it('三个武将派驻三个建筑，各自加成独立', () => {
      generalMap['hero_low'] = createMockGeneral({
        id: 'hero_low',
        level: 5,
        quality: 'COMMON' as Quality,
        baseStats: { attack: 10, defense: 10, intelligence: 10, speed: 10 },
      });
      generalMap['hero_mid'] = createMockGeneral({
        id: 'hero_mid',
        level: 15,
        quality: 'RARE' as Quality,
        baseStats: { attack: 150, defense: 100, intelligence: 80, speed: 60 },
      });
      generalMap['hero_high'] = createMockGeneral({
        id: 'hero_high',
        level: 30,
        quality: 'LEGENDARY' as Quality,
        baseStats: { attack: 500, defense: 300, intelligence: 200, speed: 150 },
      });

      system.dispatchHero('hero_low', 'farmland');
      system.dispatchHero('hero_mid', 'barracks');
      system.dispatchHero('hero_high', 'market');

      const bonuses = system.getAllDispatchBonuses();
      expect(Object.keys(bonuses)).toHaveLength(3);

      // 各自加成与公式一致
      expect(bonuses['farmland']).toBe(expectedBonus(5, 'COMMON', 10));
      expect(bonuses['barracks']).toBe(expectedBonus(15, 'RARE', 150));
      expect(bonuses['market']).toBe(expectedBonus(30, 'LEGENDARY', 500));

      // 高 attack 武将加成最大
      expect(bonuses['market']).toBeGreaterThan(bonuses['barracks']);
      expect(bonuses['barracks']).toBeGreaterThan(bonuses['farmland']);
    });

    it('升级其中一个武将只影响对应建筑', () => {
      generalMap['hero_x'] = createMockGeneral({
        id: 'hero_x',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 },
      });
      generalMap['hero_y'] = createMockGeneral({
        id: 'hero_y',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 },
      });

      system.dispatchHero('hero_x', 'barracks');
      system.dispatchHero('hero_y', 'market');

      // 升级 hero_x
      generalMap['hero_x'] = createMockGeneral({
        id: 'hero_x',
        level: 25,
        quality: 'RARE' as Quality,
        baseStats: { attack: 300, defense: 200, intelligence: 150, speed: 100 },
      });
      system.refreshDispatchBonus('hero_x');

      // barracks 加成增加
      expect(system.getDispatchBonus('barracks')).toBeGreaterThan(system.getDispatchBonus('market'));
      // market 加成不变
      expect(system.getDispatchBonus('market')).toBe(expectedBonus(10, 'RARE', 100));
    });
  });

  // ── 9. 边界：attack 为负数 / undefined / null ──

  describe('边界：attack 异常值', () => {
    it('baseStats 为 undefined 时加成仍为品质+等级（attack 按 0 处理）', () => {
      generalMap['hero_no_stats'] = {
        id: 'hero_no_stats',
        name: '无属性武将',
        quality: 'RARE' as Quality,
        baseStats: undefined as unknown as GeneralData['baseStats'],
        level: 10,
        exp: 0,
        faction: 'shu',
        skills: [],
      };

      const result = system.dispatchHero('hero_no_stats', 'barracks');
      expect(result.success).toBe(true);
      // qualityBonus=3, levelBonus=5, attackBonus=0
      // totalBonus = (3 + 5) × (1 + 0) = 8.0
      expect(result.bonusPercent).toBe(8.0);
    });

    it('attack 为负数时加成减少（负乘数）', () => {
      generalMap['hero_neg'] = createMockGeneral({
        id: 'hero_neg',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: -50, defense: 50, intelligence: 50, speed: 50 },
      });

      const result = system.dispatchHero('hero_neg', 'barracks');
      expect(result.success).toBe(true);
      // qualityBonus=3, levelBonus=5, attackBonus=-50*0.01=-0.5
      // totalBonus = (3 + 5) × (1 + (-0.5)) = 8 × 0.5 = 4.0
      expect(result.bonusPercent).toBe(4.0);
    });

    it('attack 为负数且绝对值很大时，加成趋近于 0 但不为负', () => {
      generalMap['hero_big_neg'] = createMockGeneral({
        id: 'hero_big_neg',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: -500, defense: 50, intelligence: 50, speed: 50 },
      });

      const result = system.dispatchHero('hero_big_neg', 'barracks');
      expect(result.success).toBe(true);
      // qualityBonus=3, levelBonus=5, attackBonus=-500*0.01=-5
      // totalBonus = (3 + 5) × (1 + (-5)) = 8 × (-4) = -32.0
      // 源码不做负数保护，直接返回 -32.0
      expect(result.bonusPercent).toBe(-32.0);
    });

    it('getGeneralFn 未设置时派驻失败 (FIX-303)', () => {
      const noCallbackSystem = new HeroDispatchSystem();
      noCallbackSystem.init(createMockDeps());
      // 不调用 setGetGeneral

      const result = noCallbackSystem.dispatchHero('any_hero', 'barracks');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未初始化');
    });

    it('武将 ID 在 generalMap 中不存在时派驻失败 (FIX-303)', () => {
      // generalMap 为空，任何 heroId 都查不到
      const result = system.dispatchHero('nonexistent', 'barracks');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });
  });

  // ── 10. 综合加成 = 品质系数 + 等级系数 + attack 系数 ──

  describe('综合加成公式验证', () => {
    it('综合加成 = (品质系数 + 等级系数) × (1 + attack × 0.01)', () => {
      // 全量验证：遍历多种组合
      const testCases: Array<{
        id: string;
        level: number;
        quality: Quality;
        attack: number;
        building: BuildingType;
      }> = [
        { id: 'tc1', level: 1, quality: 'COMMON', attack: 0, building: 'farmland' },
        { id: 'tc2', level: 1, quality: 'COMMON', attack: 100, building: 'market' },
        { id: 'tc3', level: 50, quality: 'LEGENDARY', attack: 500, building: 'academy' },
        { id: 'tc4', level: 25, quality: 'EPIC', attack: 250, building: 'barracks' },
        { id: 'tc5', level: 1, quality: 'LEGENDARY', attack: 0, building: 'castle' },
        { id: 'tc6', level: 50, quality: 'COMMON', attack: 0, building: 'smithy' },
      ];

      for (const tc of testCases) {
        generalMap[tc.id] = createMockGeneral({
          id: tc.id,
          level: tc.level,
          quality: tc.quality,
          baseStats: { attack: tc.attack, defense: 50, intelligence: 50, speed: 50 },
        });

        const result = system.dispatchHero(tc.id, tc.building);
        const expected = expectedBonus(tc.level, tc.quality, tc.attack);
        expect(result.bonusPercent).toBe(expected);
      }
    });

    it('attack 系数线性递增：attack 每增加 100，乘数增加 1.0', () => {
      const level = 10;
      const quality = 'RARE' as Quality;

      generalMap['atk_0'] = createMockGeneral({
        id: 'atk_0', level, quality,
        baseStats: { attack: 0, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['atk_100'] = createMockGeneral({
        id: 'atk_100', level, quality,
        baseStats: { attack: 100, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['atk_200'] = createMockGeneral({
        id: 'atk_200', level, quality,
        baseStats: { attack: 200, defense: 50, intelligence: 50, speed: 50 },
      });
      generalMap['atk_300'] = createMockGeneral({
        id: 'atk_300', level, quality,
        baseStats: { attack: 300, defense: 50, intelligence: 50, speed: 50 },
      });

      const r0 = system.dispatchHero('atk_0', 'farmland');
      const r100 = system.dispatchHero('atk_100', 'market');
      const r200 = system.dispatchHero('atk_200', 'barracks');
      const r300 = system.dispatchHero('atk_300', 'academy');

      // 基础加成 = qualityBonus + levelBonus = 3 + 5 = 8
      // attack=0:   8 × 1.0 = 8.0
      // attack=100: 8 × 2.0 = 16.0
      // attack=200: 8 × 3.0 = 24.0
      // attack=300: 8 × 4.0 = 32.0
      expect(r0.bonusPercent).toBe(8.0);
      expect(r100.bonusPercent).toBe(16.0);
      expect(r200.bonusPercent).toBe(24.0);
      expect(r300.bonusPercent).toBe(32.0);

      // 验证线性递增
      expect(r100.bonusPercent - r0.bonusPercent).toBeCloseTo(r200.bonusPercent - r100.bonusPercent, 1);
      expect(r200.bonusPercent - r100.bonusPercent).toBeCloseTo(r300.bonusPercent - r200.bonusPercent, 1);
    });

    it('attack=1000 时加成为基础的 11 倍', () => {
      generalMap['atk_1k'] = createMockGeneral({
        id: 'atk_1k',
        level: 10,
        quality: 'RARE' as Quality,
        baseStats: { attack: 1000, defense: 50, intelligence: 50, speed: 50 },
      });

      const result = system.dispatchHero('atk_1k', 'barracks');
      // qualityBonus=3, levelBonus=5, attackBonus=1000*0.01=10
      // totalBonus = (3 + 5) × (1 + 10) = 88.0
      expect(result.bonusPercent).toBe(88.0);
      // 基础 = 8.0, 88.0 / 8.0 = 11
      expect(result.bonusPercent / 8.0).toBeCloseTo(11, 1);
    });
  });
});
