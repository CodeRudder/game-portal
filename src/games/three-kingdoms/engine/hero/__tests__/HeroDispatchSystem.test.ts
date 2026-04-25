/**
 * 武将派驻建筑系统 — 单元测试
 *
 * 覆盖：
 *   1. 派驻/取消派驻基本流程
 *   2. 加成计算公式验证
 *   3. 互斥约束（每建筑1武将/每武将1建筑）
 *   4. 自动替换旧武将
 *   5. 序列化/反序列化
 *   6. ISubsystem 接口合规
 *
 * @module engine/hero/__tests__/HeroDispatchSystem.test
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
    quality: overrides.quality ?? 'RARE' as Quality,
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
  // 源码使用 general.baseStats?.attack ?? 0，攻击加成系数 = attack * 0.01
  const attackBonus = (attack ?? 0) * 0.01;
  const total = (qualityBonus + levelBonus) * (1 + attackBonus);
  return Math.round(total * 10) / 10;
}

// ── 测试 ──────────────────────────────────────

describe('HeroDispatchSystem', () => {
  let system: HeroDispatchSystem;
  let generalMap: Record<string, GeneralData>;

  beforeEach(() => {
    system = new HeroDispatchSystem();
    system.init(createMockDeps());

    generalMap = {
      hero1: createMockGeneral({ id: 'hero1', level: 10, quality: 'RARE' as Quality, baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 } }),
      hero2: createMockGeneral({ id: 'hero2', level: 20, quality: 'EPIC' as Quality, baseStats: { attack: 200, defense: 150, intelligence: 100, speed: 80 } }),
      hero3: createMockGeneral({ id: 'hero3', level: 5, quality: 'COMMON' as Quality, baseStats: { attack: 50, defense: 40, intelligence: 30, speed: 20 } }),
      hero4: createMockGeneral({ id: 'hero4', level: 30, quality: 'LEGENDARY' as Quality, baseStats: { attack: 300, defense: 200, intelligence: 150, speed: 100 } }),
    };

    // 注入武将数据获取回调
    system.setGetGeneral((heroId: string) => generalMap[heroId]);
  });

  // ── 1. 派驻/取消派驻基本流程 ──

  describe('派驻/取消派驻基本流程', () => {
    it('应成功派驻武将到建筑', () => {
      const result = system.dispatchHero('hero1', 'barracks');
      expect(result.success).toBe(true);
      expect(result.bonusPercent).toBeGreaterThan(0);
    });

    it('派驻后应能查询到派驻关系', () => {
      system.dispatchHero('hero1', 'barracks');
      expect(system.getHeroDispatchBuilding('hero1')).toBe('barracks');
      expect(system.getBuildingDispatchHero('barracks')).toBe('hero1');
    });

    it('应成功取消派驻', () => {
      system.dispatchHero('hero1', 'barracks');
      const result = system.undeployHero('hero1');
      expect(result).toBe(true);
      expect(system.getHeroDispatchBuilding('hero1')).toBeNull();
      expect(system.getBuildingDispatchHero('barracks')).toBeNull();
    });

    it('取消不存在的派驻应返回 false', () => {
      const result = system.undeployHero('hero_unknown');
      expect(result).toBe(false);
    });

    it('重复派驻到同一建筑应成功', () => {
      const r1 = system.dispatchHero('hero1', 'barracks');
      const r2 = system.dispatchHero('hero1', 'barracks');
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
    });
  });

  // ── 2. 加成计算公式验证 ──

  describe('加成计算公式验证', () => {
    it('RARE品质 Lv10 攻击100 的加成应正确', () => {
      const result = system.dispatchHero('hero1', 'barracks');
      expect(result.success).toBe(true);
      // 品质加成=3, 等级加成=10*0.5=5, 攻击加成=100*0.01=1
      // 总加成 = (3 + 5) * (1 + 1) = 16.0
      expect(result.bonusPercent).toBe(16.0);
    });

    it('EPIC品质 Lv20 攻击200 的加成应正确', () => {
      const result = system.dispatchHero('hero2', 'market');
      expect(result.success).toBe(true);
      // 品质加成=5, 等级加成=20*0.5=10, 攻击加成=200*0.01=2
      // 总加成 = (5 + 10) * (1 + 2) = 45.0
      expect(result.bonusPercent).toBe(45.0);
    });

    it('COMMON品质 Lv5 攻击50 的加成应正确', () => {
      const result = system.dispatchHero('hero3', 'farmland');
      expect(result.success).toBe(true);
      // 品质加成=1, 等级加成=5*0.5=2.5, 攻击加成=50*0.01=0.5
      // 总加成 = (1 + 2.5) * (1 + 0.5) = 5.25 → Math.round(5.25*10)/10 = 5.3
      expect(result.bonusPercent).toBe(5.3);
    });

    it('LEGENDARY品质 Lv30 攻击300 的加成应正确', () => {
      const result = system.dispatchHero('hero4', 'academy');
      expect(result.success).toBe(true);
      // 品质加成=8, 等级加成=30*0.5=15, 攻击加成=300*0.01=3
      // 总加成 = (8 + 15) * (1 + 3) = 92.0
      expect(result.bonusPercent).toBe(92.0);
    });

    it('使用 expectedBonus 辅助函数交叉验证', () => {
      for (const [id, g] of Object.entries(generalMap)) {
        const result = system.dispatchHero(id, 'castle' as BuildingType);
        expect(result.bonusPercent).toBe(expectedBonus(g.level, g.quality, g.baseStats.attack));
      }
    });

    it('getDispatchBonus 未派驻建筑返回 0', () => {
      expect(system.getDispatchBonus('barracks')).toBe(0);
    });

    it('getAllDispatchBonuses 应返回所有已派驻建筑的加成', () => {
      system.dispatchHero('hero1', 'barracks');
      system.dispatchHero('hero2', 'market');
      const bonuses = system.getAllDispatchBonuses();
      expect(Object.keys(bonuses)).toHaveLength(2);
      expect(bonuses['barracks']).toBe(16.0);
      expect(bonuses['market']).toBe(45.0);
    });
  });

  // ── 3. 互斥约束 ──

  describe('互斥约束', () => {
    it('武将已派驻到其他建筑时不能再派驻到新建筑', () => {
      system.dispatchHero('hero1', 'barracks');
      const result = system.dispatchHero('hero1', 'market');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已派驻');
    });

    it('武将未派驻时应返回 null', () => {
      expect(system.getHeroDispatchBuilding('hero1')).toBeNull();
    });

    it('建筑未派驻武将时应返回 null', () => {
      expect(system.getBuildingDispatchHero('barracks')).toBeNull();
    });
  });

  // ── 4. 自动替换旧武将 ──

  describe('自动替换旧武将', () => {
    it('派驻新武将到已有武将的建筑应自动替换', () => {
      system.dispatchHero('hero1', 'barracks');
      expect(system.getBuildingDispatchHero('barracks')).toBe('hero1');

      // hero2 替换 hero1
      const result = system.dispatchHero('hero2', 'barracks');
      expect(result.success).toBe(true);
      expect(system.getBuildingDispatchHero('barracks')).toBe('hero2');
      // hero1 应不再派驻到任何建筑
      expect(system.getHeroDispatchBuilding('hero1')).toBeNull();
    });

    it('替换后旧武将的派驻关系应完全清除', () => {
      system.dispatchHero('hero1', 'barracks');
      system.dispatchHero('hero2', 'barracks');

      // hero1 应已无派驻
      expect(system.getHeroDispatchBuilding('hero1')).toBeNull();
      // hero2 应派驻到 barracks
      expect(system.getHeroDispatchBuilding('hero2')).toBe('barracks');
    });
  });

  // ── 5. 序列化/反序列化 ──

  describe('序列化/反序列化', () => {
    it('序列化后反序列化应恢复状态', () => {
      system.dispatchHero('hero1', 'barracks');
      system.dispatchHero('hero2', 'market');

      const json = system.serialize();
      expect(typeof json).toBe('string');

      // 创建新系统并反序列化
      const newSystem = new HeroDispatchSystem();
      newSystem.deserialize(json);

      expect(newSystem.getBuildingDispatchHero('barracks')).toBe('hero1');
      expect(newSystem.getBuildingDispatchHero('market')).toBe('hero2');
    });

    it('反序列化无效 JSON 应重置状态', () => {
      const newSystem = new HeroDispatchSystem();
      newSystem.dispatchHero('hero1', 'barracks');
      newSystem.deserialize('invalid json');
      // reset 后应清空
      expect(newSystem.getBuildingDispatchHero('barracks')).toBeNull();
    });

    it('序列化空状态应返回有效 JSON', () => {
      const json = system.serialize();
      const parsed = JSON.parse(json);
      expect(parsed.buildingDispatch).toEqual({});
      expect(parsed.heroDispatch).toEqual({});
    });
  });

  // ── 6. ISubsystem 接口合规 ──

  describe('ISubsystem 接口合规', () => {
    it('应正确实现 name 属性', () => {
      expect(system.name).toBe('heroDispatch');
    });

    it('应正确实现 init', () => {
      const newSystem = new HeroDispatchSystem();
      expect(() => newSystem.init(createMockDeps())).not.toThrow();
    });

    it('应正确实现 update（无操作）', () => {
      expect(() => system.update(16)).not.toThrow();
    });

    it('应正确实现 getState', () => {
      system.dispatchHero('hero1', 'barracks');
      const state = system.getState();
      expect(state).toHaveProperty('buildingDispatch');
      expect(state).toHaveProperty('heroDispatch');
      expect((state as { buildingDispatch: Record<string, unknown> }).buildingDispatch).toHaveProperty('barracks');
    });

    it('应正确实现 reset', () => {
      system.dispatchHero('hero1', 'barracks');
      system.reset();
      expect(system.getBuildingDispatchHero('barracks')).toBeNull();
      expect(system.getHeroDispatchBuilding('hero1')).toBeNull();
    });
  });

  // ── 刷新加成 ──

  describe('refreshDispatchBonus', () => {
    it('武将升级后应刷新加成', () => {
      system.dispatchHero('hero1', 'barracks');
      const bonusBefore = system.getDispatchBonus('barracks');

      // 模拟武将升级
      generalMap['hero1'] = createMockGeneral({
        id: 'hero1',
        level: 20,
        quality: 'RARE' as Quality,
        baseStats: { attack: 100, defense: 80, intelligence: 90, speed: 70 },
      });

      const newBonus = system.refreshDispatchBonus('hero1');
      expect(newBonus).toBeGreaterThan(bonusBefore);
    });

    it('未派驻武将刷新应返回 0', () => {
      expect(system.refreshDispatchBonus('hero_unknown')).toBe(0);
    });
  });
});
