import { vi } from 'vitest';
/**
 * HeroStarSystem 单元测试 — 碎片获取 + 升星 + 碎片进度
 *
 * 覆盖功能点：
 *   #11 碎片获取途径（招募重复转化、关卡掉落、商店兑换）
 *   #12 升星消耗与效果（碎片+铜钱消耗，属性倍率提升）
 *   #13 碎片进度可视化（当前/所需碎片数量）
 */

import { HeroStarSystem } from '../HeroStarSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality as Q } from '../hero.types';
import { FragmentSource } from '../star-up.types';
import type { StarSystemDeps } from '../star-up.types';
import {
  STAR_UP_FRAGMENT_COST, STAR_UP_GOLD_COST, STAR_MULTIPLIERS,
  BREAKTHROUGH_TIERS, INITIAL_LEVEL_CAP, STAGE_FRAGMENT_DROPS,
} from '../star-up-config';
import { MAX_STAR_LEVEL, DUPLICATE_FRAGMENT_COUNT } from '../hero-config';

// ── 辅助函数 ──

function makeMockDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

function makeStarDeps(overrides?: Partial<{ gold: number; breakthroughStones: number }>): StarSystemDeps & { resources: Record<string, number> } {
  const resources: Record<string, number> = {
    gold: overrides?.gold ?? 999999999,
    breakthroughStone: overrides?.breakthroughStones ?? 999999999,
  };
  return {
    resources,
    spendFragments: vi.fn(),
    getFragments: vi.fn(),
    spendResource: vi.fn((type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) { resources[type] -= amount; return true; }
      return false;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => (resources[type] ?? 0) >= amount),
    getResourceAmount: vi.fn((type: string) => resources[type] ?? 0),
  };
}

function createTestSystem(fragmentMap?: Record<string, number>) {
  const heroSystem = new HeroSystem();
  heroSystem.init(makeMockDeps());
  if (fragmentMap) {
    for (const [id, count] of Object.entries(fragmentMap)) heroSystem.addFragment(id, count);
  }
  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockDeps());
  const deps = makeStarDeps();
  deps.getFragments = (id: string) => heroSystem.getFragments(id);
  deps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
  starSystem.setDeps(deps);
  return { heroSystem, starSystem, deps };
}

describe('HeroStarSystem', () => {
  let heroSystem: HeroSystem;
  let starSystem: HeroStarSystem;
  let deps: ReturnType<typeof makeStarDeps>;

  beforeEach(() => {
    vi.restoreAllMocks();
    ({ heroSystem, starSystem, deps } = createTestSystem());
  });

  // ═══════════════════════════════════════════
  // 0. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('should have correct subsystem name', () => { expect(starSystem.name).toBe('heroStar'); });
    it('should return default star level 1 for unknown', () => { expect(starSystem.getStar('unknown')).toBe(1); });
    it('should return empty stars map initially', () => { expect(starSystem.getAllStars()).toEqual({}); });
    it('should return default breakthrough stage 0', () => { expect(starSystem.getBreakthroughStage('guanyu')).toBe(0); });
    it('should return initial level cap', () => { expect(starSystem.getLevelCap('guanyu')).toBe(INITIAL_LEVEL_CAP); });
  });

  // ═══════════════════════════════════════════
  // 1. 碎片获取途径（功能点 #11）
  // ═══════════════════════════════════════════
  describe('碎片获取途径 #11', () => {
    describe('招募重复→碎片转化', () => {
      it('should convert duplicate legendary to fragments', () => {
        const result = starSystem.handleDuplicateFragments('guanyu', Q.LEGENDARY);
        expect(result.count).toBe(DUPLICATE_FRAGMENT_COUNT[Q.LEGENDARY]);
        expect(result.source).toBe(FragmentSource.DUPLICATE);
        expect(heroSystem.getFragments('guanyu')).toBe(DUPLICATE_FRAGMENT_COUNT[Q.LEGENDARY]);
      });

      it('should convert for each quality', () => {
        for (const q of [Q.COMMON, Q.FINE, Q.RARE, Q.EPIC, Q.LEGENDARY]) {
          const r = starSystem.handleDuplicateFragments('test_' + q, q);
          expect(r.count).toBe(DUPLICATE_FRAGMENT_COUNT[q]);
        }
      });
    });

    describe('关卡掉落碎片', () => {
      it('should drop fragments for known stage', () => {
        const results = starSystem.gainFragmentsFromStage('stage_1_1', () => 0.5);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].source).toBe(FragmentSource.STAGE_DROP);
      });

      it('should return empty for unknown stage', () => {
        expect(starSystem.gainFragmentsFromStage('nonexistent')).toHaveLength(0);
      });

      it('should add fragments to hero system', () => {
        const before = heroSystem.getFragments('minbingduizhang');
        starSystem.gainFragmentsFromStage('stage_1_1', () => 0.5);
        expect(heroSystem.getFragments('minbingduizhang')).toBeGreaterThan(before);
      });

      it('should respect drop range', () => {
        const counts = new Set<number>();
        for (let i = 0; i < 100; i++) {
          heroSystem.reset(); heroSystem.init(makeMockDeps());
          const results = starSystem.gainFragmentsFromStage('stage_1_1', Math.random);
          if (results.length > 0) counts.add(results[0].count);
        }
        for (const c of counts) { expect(c).toBeGreaterThanOrEqual(1); expect(c).toBeLessThanOrEqual(3); }
      });

      it('should drop guanyu fragments for stage_4_1', () => {
        const results = starSystem.gainFragmentsFromStage('stage_4_1', () => 0.5);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].generalId).toBe('guanyu');
      });
    });

    describe('商店兑换碎片', () => {
      it('should exchange fragments for gold', () => {
        const result = starSystem.exchangeFragmentsFromShop('guanyu', 3);
        expect(result.success).toBe(true);
        expect(result.count).toBe(3);
        expect(result.goldSpent).toBe(3 * 5000);
        expect(heroSystem.getFragments('guanyu')).toBe(3);
      });

      it('should respect daily limit', () => {
        const result = starSystem.exchangeFragmentsFromShop('guanyu', 10);
        expect(result.success).toBe(true);
        expect(result.count).toBe(5); // guanyu dailyLimit = 5
      });

      it('should fail when gold insufficient', () => {
        const poorDeps = makeStarDeps({ gold: 100 });
        poorDeps.getFragments = (id: string) => heroSystem.getFragments(id);
        poorDeps.spendFragments = (id: string, c: number) => heroSystem.useFragments(id, c);
        starSystem.setDeps(poorDeps);
        expect(starSystem.exchangeFragmentsFromShop('guanyu', 1).success).toBe(false);
      });

      it('should fail for unknown general', () => {
        expect(starSystem.exchangeFragmentsFromShop('unknown', 1).success).toBe(false);
      });

      it('should fail for zero/negative count', () => {
        expect(starSystem.exchangeFragmentsFromShop('guanyu', 0).success).toBe(false);
        expect(starSystem.exchangeFragmentsFromShop('guanyu', -1).success).toBe(false);
      });

      it('should fail without deps', () => {
        const noDeps = new HeroStarSystem(heroSystem);
        noDeps.init(makeMockDeps());
        expect(noDeps.exchangeFragmentsFromShop('guanyu', 1).success).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 2. 升星消耗与效果（功能点 #12）
  // ═══════════════════════════════════════════
  describe('升星消耗与效果 #12', () => {
    beforeEach(() => { heroSystem.addGeneral('guanyu'); });

    describe('升星消耗计算', () => {
      it('should return correct cost for star 1→2', () => {
        const cost = starSystem.getStarUpCost(1);
        expect(cost.fragments).toBe(STAR_UP_FRAGMENT_COST[1]);
        expect(cost.gold).toBe(STAR_UP_GOLD_COST[1]);
      });
      it('should return correct cost for star 5→6', () => {
        const cost = starSystem.getStarUpCost(5);
        expect(cost.fragments).toBe(STAR_UP_FRAGMENT_COST[5]);
        expect(cost.gold).toBe(STAR_UP_GOLD_COST[5]);
      });
    });

    describe('升星预览', () => {
      it('should return preview with correct info', () => {
        heroSystem.addFragment('guanyu', 50);
        const p = starSystem.getStarUpPreview('guanyu')!;
        expect(p.currentStar).toBe(1); expect(p.targetStar).toBe(2);
        expect(p.fragmentCost).toBe(STAR_UP_FRAGMENT_COST[1]);
        expect(p.fragmentSufficient).toBe(true);
      });

      it('should show insufficient fragments', () => {
        heroSystem.addFragment('guanyu', 5);
        expect(starSystem.getStarUpPreview('guanyu')!.fragmentSufficient).toBe(false);
      });

      it('should return null for nonexistent general', () => {
        expect(starSystem.getStarUpPreview('nonexistent')).toBeNull();
      });

      it('should return null for max star', () => {
        const save = starSystem.serialize(); save.state.stars['guanyu'] = MAX_STAR_LEVEL;
        starSystem.deserialize(save);
        expect(starSystem.getStarUpPreview('guanyu')).toBeNull();
      });
    });

    describe('升星执行', () => {
      it('should successfully star up 1→2', () => {
        heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[1]);
        const r = starSystem.starUp('guanyu');
        expect(r.success).toBe(true); expect(r.currentStar).toBe(2);
        expect(r.fragmentsSpent).toBe(STAR_UP_FRAGMENT_COST[1]);
        expect(r.goldSpent).toBe(STAR_UP_GOLD_COST[1]);
      });

      it('should consume fragments', () => {
        heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[1] + 10);
        starSystem.starUp('guanyu');
        expect(heroSystem.getFragments('guanyu')).toBe(10);
      });

      it('should fail when fragments insufficient', () => {
        heroSystem.addFragment('guanyu', 5);
        expect(starSystem.starUp('guanyu').success).toBe(false);
        expect(starSystem.getStar('guanyu')).toBe(1);
      });

      it('should fail when gold insufficient', () => {
        heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[1]);
        const poorDeps = makeStarDeps({ gold: 100 });
        poorDeps.getFragments = (id: string) => heroSystem.getFragments(id);
        poorDeps.spendFragments = (id: string, c: number) => heroSystem.useFragments(id, c);
        starSystem.setDeps(poorDeps);
        expect(starSystem.starUp('guanyu').success).toBe(false);
      });

      it('should fail for nonexistent general', () => {
        expect(starSystem.starUp('nonexistent').success).toBe(false);
      });

      it('should fail when max star', () => {
        const save = starSystem.serialize(); save.state.stars['guanyu'] = MAX_STAR_LEVEL;
        starSystem.deserialize(save);
        expect(starSystem.starUp('guanyu').success).toBe(false);
      });

      it('should fail without deps', () => {
        const noDeps = new HeroStarSystem(heroSystem); noDeps.init(makeMockDeps());
        heroSystem.addFragment('guanyu', 1000);
        expect(noDeps.starUp('guanyu').success).toBe(false);
      });

      it('should calculate stats correctly', () => {
        const general = heroSystem.getGeneral('guanyu')!;
        heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[1]);
        const r = starSystem.starUp('guanyu');
        expect(r.success).toBe(true);
        const m1 = STAR_MULTIPLIERS[1], m2 = STAR_MULTIPLIERS[2];
        expect(r.statsBefore.attack).toBe(Math.floor(general.baseStats.attack * m1));
        expect(r.statsAfter.attack).toBe(Math.floor(general.baseStats.attack * m2));
        expect(r.statsAfter.attack).toBeGreaterThan(r.statsBefore.attack);
      });

      it('should allow consecutive star ups', () => {
        heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[1] + STAR_UP_FRAGMENT_COST[2]);
        expect(starSystem.starUp('guanyu').currentStar).toBe(2);
        expect(starSystem.starUp('guanyu').currentStar).toBe(3);
      });
    });

    describe('属性倍率', () => {
      it('should calculate star stats for star 1', () => {
        const g = heroSystem.getGeneral('guanyu')!;
        const s = starSystem.calculateStarStats(g, 1);
        expect(s.attack).toBe(Math.floor(g.baseStats.attack * STAR_MULTIPLIERS[1]));
      });

      it('should have increasing stats', () => {
        const g = heroSystem.getGeneral('guanyu')!;
        const s1 = starSystem.calculateStarStats(g, 1);
        const s3 = starSystem.calculateStarStats(g, 3);
        const s6 = starSystem.calculateStarStats(g, 6);
        expect(s3.attack).toBeGreaterThan(s1.attack);
        expect(s6.attack).toBeGreaterThan(s3.attack);
      });
    });
  });

  // ═══════════════════════════════════════════
  // 3. 碎片进度可视化（功能点 #13）
  // ═══════════════════════════════════════════
  describe('碎片进度可视化 #13', () => {
    it('should return progress for owned general', () => {
      heroSystem.addGeneral('guanyu'); heroSystem.addFragment('guanyu', 10);
      const p = starSystem.getFragmentProgress('guanyu')!;
      expect(p.generalName).toBe('关羽'); expect(p.currentFragments).toBe(10);
      expect(p.requiredFragments).toBe(STAR_UP_FRAGMENT_COST[1]);
    });

    it('should calculate percentage', () => {
      heroSystem.addGeneral('guanyu');
      const req = STAR_UP_FRAGMENT_COST[1];
      heroSystem.addFragment('guanyu', Math.floor(req / 2));
      expect(starSystem.getFragmentProgress('guanyu')!.percentage).toBe(50);
    });

    it('should show canStarUp when sufficient', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', STAR_UP_FRAGMENT_COST[1]);
      expect(starSystem.getFragmentProgress('guanyu')!.canStarUp).toBe(true);
    });

    it('should show cannot star up when insufficient', () => {
      heroSystem.addGeneral('guanyu'); heroSystem.addFragment('guanyu', 5);
      expect(starSystem.getFragmentProgress('guanyu')!.canStarUp).toBe(false);
    });

    it('should return null for nonexistent', () => {
      expect(starSystem.getFragmentProgress('nonexistent')).toBeNull();
    });

    it('should show 100% for max star', () => {
      heroSystem.addGeneral('guanyu');
      const save = starSystem.serialize(); save.state.stars['guanyu'] = MAX_STAR_LEVEL;
      starSystem.deserialize(save);
      const p = starSystem.getFragmentProgress('guanyu')!;
      expect(p.percentage).toBe(100); expect(p.requiredFragments).toBe(0); expect(p.canStarUp).toBe(false);
    });

    it('should cap percentage at 100', () => {
      heroSystem.addGeneral('guanyu'); heroSystem.addFragment('guanyu', 9999);
      expect(starSystem.getFragmentProgress('guanyu')!.percentage).toBe(100);
    });

    it('should return all progress for owned generals', () => {
      heroSystem.addGeneral('guanyu'); heroSystem.addGeneral('liubei');
      heroSystem.addFragment('guanyu', 10); heroSystem.addFragment('liubei', 20);
      const all = starSystem.getAllFragmentProgress();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.generalId)).toContain('guanyu');
    });

    it('should return empty for no generals', () => {
      expect(starSystem.getAllFragmentProgress()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 序列化 + reset + update
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('should serialize empty state', () => {
      const d = starSystem.serialize();
      expect(d.version).toBe(1); expect(d.state.stars).toEqual({});
    });

    it('should round-trip correctly', () => {
      heroSystem.addGeneral('guanyu'); heroSystem.addFragment('guanyu', 100);
      starSystem.starUp('guanyu');
      const save = starSystem.serialize();
      expect(save.state.stars['guanyu']).toBe(2);

      const newSys = new HeroStarSystem(heroSystem); newSys.init(makeMockDeps());
      const newDeps = makeStarDeps();
      newDeps.getFragments = (id: string) => heroSystem.getFragments(id);
      newDeps.spendFragments = (id: string, c: number) => heroSystem.useFragments(id, c);
      newSys.setDeps(newDeps);
      newSys.deserialize(save);
      expect(newSys.getStar('guanyu')).toBe(2);
    });

    it('should handle missing fields', () => {
      const ns = new HeroStarSystem(heroSystem); ns.init(makeMockDeps());
      ns.deserialize({ version: 1, state: { stars: { guanyu: 3 }, breakthroughStages: {} } });
      expect(ns.getStar('guanyu')).toBe(3);
    });
  });

  describe('reset()', () => {
    it('should clear all data', () => {
      heroSystem.addGeneral('guanyu'); heroSystem.addFragment('guanyu', 100);
      starSystem.starUp('guanyu');
      expect(starSystem.getStar('guanyu')).toBe(2);
      starSystem.reset();
      expect(starSystem.getStar('guanyu')).toBe(1);
      expect(starSystem.getAllStars()).toEqual({});
    });
  });

  describe('update()', () => {
    it('should not throw', () => { expect(() => starSystem.update(16)).not.toThrow(); });
  });
});
