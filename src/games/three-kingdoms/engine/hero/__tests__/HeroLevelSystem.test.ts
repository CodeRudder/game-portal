import { vi } from 'vitest';
/**
 * HeroLevelSystem 单元测试 — 核心部分
 * 覆盖：初始化、消耗计算、addExp、levelUp、查询方法、序列化、ISubsystem 接口
 *
 * 注意：HeroLevelSystem 和 HeroSystem 各自独立管理武将状态。
 * HeroLevelSystem 通过 syncToHeroSystem 将变更同步到 HeroSystem。
 * 测试中需要确保两个系统共享同一个 HeroSystem 实例。
 */

import { HeroLevelSystem } from '../HeroLevelSystem';
import type { LevelDeps, LevelUpResult, EnhancePreview, BatchEnhanceResult } from '../HeroLevelSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';
import type { GeneralData } from '../hero.types';
import { HERO_MAX_LEVEL, LEVEL_EXP_TABLE } from '../hero-config';

// ── 辅助 ──

/** 无限资源的 mock deps */
function makeRichLevelDeps(heroSystem: HeroSystem): LevelDeps {
  const resources: Record<string, number> = { gold: 1e9, exp: 1e9 };
  return {
    heroSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type]),
  };
}

/** 指定资源的 mock deps */
function makeLevelDepsWithResources(
  heroSystem: HeroSystem,
  gold: number,
  exp: number,
): LevelDeps {
  const resources: Record<string, number> = { gold, exp };
  return {
    heroSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      if (resources[type] < amount) return false;
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => resources[type] >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type]),
  };
}

/** 查表获取升到下一级所需经验 */
function lookupExp(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.expPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
}

/** 查表获取升级铜钱 */
function lookupGold(level: number): number {
  for (const tier of LEVEL_EXP_TABLE) {
    if (level >= tier.levelMin && level <= tier.levelMax) return level * tier.goldPerLevel;
  }
  return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
}

// ═══════════════════════════════════════════════════════════════
describe('HeroLevelSystem', () => {
  let heroSystem: HeroSystem;
  let levelSys: HeroLevelSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    heroSystem.addGeneral('guanyu');
    levelSys = new HeroLevelSystem();
    levelSys.setLevelDeps(makeRichLevelDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. 初始化
  // ───────────────────────────────────────────
  describe('初始化', () => {
    it('ISubsystem.name 为 heroLevel', () => {
      expect(levelSys.name).toBe('heroLevel');
    });

    it('未设置依赖时 addExp 返回 null', () => {
      const ls = new HeroLevelSystem();
      expect(ls.addExp('guanyu', 100)).toBeNull();
    });

    it('未设置依赖时 levelUp 返回 null', () => {
      const ls = new HeroLevelSystem();
      expect(ls.levelUp('guanyu')).toBeNull();
    });

    it('未设置依赖时 getEnhancePreview 返回 null', () => {
      const ls = new HeroLevelSystem();
      expect(ls.getEnhancePreview('guanyu', 10)).toBeNull();
    });

    it('未设置依赖时 quickEnhance 返回 null', () => {
      const ls = new HeroLevelSystem();
      expect(ls.quickEnhance('guanyu', 10)).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 2. calculateExpToNextLevel / calculateLevelUpCost
  // ───────────────────────────────────────────
  describe('消耗计算', () => {
    it('Lv1 升级经验正确', () => {
      expect(levelSys.calculateExpToNextLevel(1)).toBe(lookupExp(1));
    });

    it('Lv10 升级经验正确（跨等级段）', () => {
      expect(levelSys.calculateExpToNextLevel(10)).toBe(lookupExp(10));
    });

    it('Lv25 升级经验正确', () => {
      expect(levelSys.calculateExpToNextLevel(25)).toBe(lookupExp(25));
    });

    it('Lv1 升级铜钱正确', () => {
      expect(levelSys.calculateLevelUpCost(1)).toBe(lookupGold(1));
    });

    it('满级时升级经验为 0', () => {
      expect(levelSys.calculateExpToNextLevel(HERO_MAX_LEVEL)).toBe(0);
    });

    it('满级时升级铜钱为 0', () => {
      expect(levelSys.calculateLevelUpCost(HERO_MAX_LEVEL)).toBe(0);
    });

    it('calculateTotalExp 正确汇总', () => {
      const total = levelSys.calculateTotalExp(1, 3);
      expect(total).toBe(lookupExp(1) + lookupExp(2));
    });

    it('calculateTotalGold 正确汇总', () => {
      const total = levelSys.calculateTotalGold(1, 3);
      expect(total).toBe(lookupGold(1) + lookupGold(2));
    });

    it('calculateTotalExp from >= to 返回 0', () => {
      expect(levelSys.calculateTotalExp(5, 5)).toBe(0);
      expect(levelSys.calculateTotalExp(5, 3)).toBe(0);
    });

    it('calculateTotalGold from >= to 返回 0', () => {
      expect(levelSys.calculateTotalGold(5, 5)).toBe(0);
    });
  });

  // ───────────────────────────────────────────
  // 3. addExp 经验添加和自动升级
  // ───────────────────────────────────────────
  describe('addExp', () => {
    it('经验不足升级时经验累加', () => {
      const result = levelSys.addExp('guanyu', 10)!;
      expect(result.levelsGained).toBe(0);
      const g = heroSystem.getGeneral('guanyu')!;
      expect(g.exp).toBe(10);
    });

    it('经验足够时自动升级', () => {
      const expReq = levelSys.calculateExpToNextLevel(1);
      const result = levelSys.addExp('guanyu', expReq)!;
      expect(result.levelsGained).toBe(1);
      expect(result.general.level).toBe(2);
    });

    it('大量经验连续升级多级', () => {
      const result = levelSys.addExp('guanyu', 50000)!;
      expect(result.levelsGained).toBeGreaterThan(1);
      expect(result.general.level).toBeGreaterThan(2);
    });

    it('升级消耗铜钱', () => {
      const mockDeps = makeRichLevelDeps(heroSystem);
      levelSys.setLevelDeps(mockDeps);
      const expReq = levelSys.calculateExpToNextLevel(1);
      levelSys.addExp('guanyi', expReq); // 不存在的武将
      // 重新添加武将并测试
      heroSystem.addGeneral('liubei');
      levelSys.addExp('liubei', expReq);
      expect(mockDeps.spendResource).toHaveBeenCalledWith('gold', lookupGold(1));
    });

    it('武将不存在返回 null', () => {
      expect(levelSys.addExp('nobody', 100)).toBeNull();
    });

    it('amount <= 0 返回 null', () => {
      expect(levelSys.addExp('guanyu', 0)).toBeNull();
      expect(levelSys.addExp('guanyu', -1)).toBeNull();
    });

    it('满级武将返回 null', () => {
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].level = HERO_MAX_LEVEL;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      expect(levelSys.addExp('guanyu', 100)).toBeNull();
    });

    it('statsDiff 记录属性变化', () => {
      const expReq = levelSys.calculateExpToNextLevel(1);
      const result = levelSys.addExp('guanyu', expReq)!;
      expect(result.statsDiff.before).toBeDefined();
      expect(result.statsDiff.after).toBeDefined();
      // 升级后属性应该更高或相等
      expect(result.statsDiff.after.attack).toBeGreaterThanOrEqual(result.statsDiff.before.attack);
    });
  });

  // ───────────────────────────────────────────
  // 4. levelUp 升一级
  // ───────────────────────────────────────────
  describe('levelUp', () => {
    it('经验不足时升级失败', () => {
      expect(levelSys.levelUp('guanyu')).toBeNull();
    });

    it('经验充足且铜钱充足时升级成功', () => {
      // 通过序列化直接设置武将经验，避免 addExp 自动升级
      const expReq = levelSys.calculateExpToNextLevel(1);
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].exp = expReq;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));

      const g = hs2.getGeneral('guanyu')!;
      expect(g.exp).toBeGreaterThanOrEqual(expReq);

      const result = levelSys.levelUp('guanyu');
      expect(result).not.toBeNull();
      expect(result!.levelsGained).toBe(1);
      expect(result!.general.level).toBe(2);
    });

    it('升级消耗铜钱', () => {
      const mockDeps = makeRichLevelDeps(heroSystem);
      levelSys.setLevelDeps(mockDeps);
      const expReq = levelSys.calculateExpToNextLevel(1);
      levelSys.addExp('guanyu', expReq);
      levelSys.levelUp('guanyu');
      expect(mockDeps.spendResource).toHaveBeenCalledWith('gold', lookupGold(1));
    });

    it('武将不存在返回 null', () => {
      expect(levelSys.levelUp('nobody')).toBeNull();
    });

    it('满级返回 null', () => {
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].level = HERO_MAX_LEVEL;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      expect(levelSys.levelUp('guanyu')).toBeNull();
    });

    it('铜钱不足返回 null', () => {
      const expReq = levelSys.calculateExpToNextLevel(1);
      levelSys.addExp('guanyu', expReq);
      // 替换为无铜钱的 deps
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, 0, 1e9));
      expect(levelSys.levelUp('guanyu')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 5. 查询方法
  // ───────────────────────────────────────────
  describe('查询方法', () => {
    it('calculateMaxAffordableLevel 无限资源返回高等级', () => {
      const g = heroSystem.getGeneral('guanyu')!;
      const maxLv = levelSys.calculateMaxAffordableLevel(g);
      expect(maxLv).toBeGreaterThan(g.level);
    });

    it('calculateMaxAffordableLevel 零资源返回当前等级', () => {
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, 0, 0));
      const g = heroSystem.getGeneral('guanyu')!;
      expect(levelSys.calculateMaxAffordableLevel(g)).toBe(g.level);
    });

    it('calculateMaxAffordableLevel 满级返回当前等级', () => {
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].level = HERO_MAX_LEVEL;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      const g = hs2.getGeneral('guanyu')!;
      expect(levelSys.calculateMaxAffordableLevel(g)).toBe(HERO_MAX_LEVEL);
    });

    it('getExpProgress 返回当前经验进度', () => {
      // 通过 HeroLevelSystem 加经验
      levelSys.addExp('guanyu', 25);
      const progress = levelSys.getExpProgress('guanyu')!;
      expect(progress.current).toBe(25);
      expect(progress.required).toBe(lookupExp(1));
      expect(progress.percentage).toBe(Math.min(100, Math.floor((25 / lookupExp(1)) * 100)));
    });

    it('getExpProgress 满级时 percentage=100', () => {
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].level = HERO_MAX_LEVEL;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      const progress = levelSys.getExpProgress('guanyu')!;
      expect(progress.percentage).toBe(100);
    });

    it('getExpProgress 武将不存在返回 null', () => {
      expect(levelSys.getExpProgress('nobody')).toBeNull();
    });

    it('canLevelUp 经验和铜钱充足返回 true', () => {
      // 通过序列化直接设置武将经验，避免 addExp 自动升级
      const expReq = levelSys.calculateExpToNextLevel(1);
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].exp = expReq;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      expect(levelSys.canLevelUp('guanyu')).toBe(true);
    });

    it('canLevelUp 经验不足返回 false', () => {
      expect(levelSys.canLevelUp('guanyu')).toBe(false);
    });

    it('canLevelUp 铜钱不足返回 false', () => {
      const expReq = levelSys.calculateExpToNextLevel(1);
      levelSys.addExp('guanyu', expReq);
      levelSys.setLevelDeps(makeLevelDepsWithResources(heroSystem, 0, 1e9));
      expect(levelSys.canLevelUp('guanyu')).toBe(false);
    });

    it('getUpgradableGeneralIds 返回可升级武将', () => {
      heroSystem.addGeneral('liubei');
      // 通过序列化直接设置武将经验，避免 addExp 自动升级
      const expReq = levelSys.calculateExpToNextLevel(1);
      const save = heroSystem.serialize();
      save.state.generals['guanyu'].exp = expReq;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      levelSys.setLevelDeps(makeRichLevelDeps(hs2));
      const ids = levelSys.getUpgradableGeneralIds();
      expect(ids).toContain('guanyu');
      expect(ids).not.toContain('liubei');
    });

    it('未设置依赖时 canLevelUp 返回 false', () => {
      const ls = new HeroLevelSystem();
      expect(ls.canLevelUp('guanyu')).toBe(false);
    });

    it('未设置依赖时 getUpgradableGeneralIds 返回空数组', () => {
      const ls = new HeroLevelSystem();
      expect(ls.getUpgradableGeneralIds()).toEqual([]);
    });
  });

  // ───────────────────────────────────────────
  // 6. 序列化
  // ───────────────────────────────────────────
  describe('序列化', () => {
    it('serialize 返回版本号', () => {
      const data = levelSys.serialize();
      expect(data.version).toBe(1);
    });

    it('deserialize 不抛异常', () => {
      expect(() => levelSys.deserialize({ version: 1 })).not.toThrow();
    });
  });

  // ───────────────────────────────────────────
  // 7. ISubsystem 接口
  // ───────────────────────────────────────────
  describe('ISubsystem 接口', () => {
    it('getState() 返回序列化结果', () => {
      const state = levelSys.getState() as { version: number };
      expect(state.version).toBe(1);
    });

    it('update() 不抛异常', () => {
      expect(() => levelSys.update(16)).not.toThrow();
    });

    it('init() 不抛异常', () => {
      expect(() => levelSys.init({ eventBus: null as unknown as Record<string, unknown>, configRegistry: null as unknown as Record<string, unknown> })).not.toThrow();
    });

    it('reset() 不抛异常', () => {
      expect(() => levelSys.reset()).not.toThrow();
    });
  });
});
