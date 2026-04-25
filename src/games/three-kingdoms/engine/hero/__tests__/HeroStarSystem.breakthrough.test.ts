import { vi } from 'vitest';
/**
 * HeroStarSystem 单元测试 — 突破系统
 *
 * 覆盖功能点：#14 突破系统（等级上限突破+突破材料）
 */

import { HeroStarSystem } from '../HeroStarSystem';
import { HeroSystem } from '../HeroSystem';
import type { StarSystemDeps } from '../star-up.types';
import {
  BREAKTHROUGH_TIERS, MAX_BREAKTHROUGH_STAGE,
  INITIAL_LEVEL_CAP, FINAL_LEVEL_CAP,
} from '../star-up-config';

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

function createTestSystem() {
  const heroSystem = new HeroSystem();
  heroSystem.init(makeMockDeps());
  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(makeMockDeps());
  const deps = makeStarDeps();
  deps.getFragments = (id: string) => heroSystem.getFragments(id);
  deps.spendFragments = (id: string, count: number) => heroSystem.useFragments(id, count);
  starSystem.setDeps(deps);
  return { heroSystem, starSystem, deps };
}

describe('HeroStarSystem 突破系统 #14', () => {
  let heroSystem: HeroSystem;
  let starSystem: HeroStarSystem;
  let deps: ReturnType<typeof makeStarDeps>;

  beforeEach(() => {
    vi.restoreAllMocks();
    ({ heroSystem, starSystem, deps } = createTestSystem());
    heroSystem.addGeneral('guanyu');
  });

  // ═══════════════════════════════════════════
  // 等级上限查询
  // ═══════════════════════════════════════════
  describe('等级上限查询', () => {
    it('should return initial level cap for stage 0', () => {
      expect(starSystem.getLevelCap('guanyu')).toBe(INITIAL_LEVEL_CAP);
    });

    it('should return correct cap after each breakthrough', () => {
      for (let i = 0; i < BREAKTHROUGH_TIERS.length; i++) {
        const save = starSystem.serialize();
        save.state.breakthroughStages['guanyu'] = i + 1;
        starSystem.deserialize(save);
        expect(starSystem.getLevelCap('guanyu')).toBe(BREAKTHROUGH_TIERS[i].levelCapAfter);
      }
    });

    it('should return final level cap for max breakthrough', () => {
      const save = starSystem.serialize();
      save.state.breakthroughStages['guanyu'] = MAX_BREAKTHROUGH_STAGE;
      starSystem.deserialize(save);
      expect(starSystem.getLevelCap('guanyu')).toBe(FINAL_LEVEL_CAP);
    });
  });

  // ═══════════════════════════════════════════
  // 突破预览
  // ═══════════════════════════════════════════
  describe('突破预览', () => {
    it('should return null for nonexistent general', () => {
      expect(starSystem.getBreakthroughPreview('nonexistent')).toBeNull();
    });

    it('should return null for max breakthrough', () => {
      const save = starSystem.serialize();
      save.state.breakthroughStages['guanyu'] = MAX_BREAKTHROUGH_STAGE;
      starSystem.deserialize(save);
      expect(starSystem.getBreakthroughPreview('guanyu')).toBeNull();
    });

    it('should show level not ready when below cap', () => {
      const p = starSystem.getBreakthroughPreview('guanyu')!;
      expect(p.levelReady).toBe(false);
      expect(p.canBreakthrough).toBe(false);
    });

    it('should show level ready when at cap', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      expect(starSystem.getBreakthroughPreview('guanyu')!.levelReady).toBe(true);
    });

    it('should show resource sufficient when all resources available', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      const p = starSystem.getBreakthroughPreview('guanyu')!;
      expect(p.resourceSufficient).toBe(true);
      expect(p.canBreakthrough).toBe(true);
    });

    it('should show resource insufficient when fragments missing', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      expect(starSystem.getBreakthroughPreview('guanyu')!.resourceSufficient).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 突破执行
  // ═══════════════════════════════════════════
  describe('突破执行', () => {
    it('should successfully breakthrough when all conditions met', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);

      const r = starSystem.breakthrough('guanyu');
      expect(r.success).toBe(true);
      expect(r.previousLevelCap).toBe(INITIAL_LEVEL_CAP);
      expect(r.newLevelCap).toBe(BREAKTHROUGH_TIERS[0].levelCapAfter);
      expect(r.breakthroughStage).toBe(1);
      expect(r.fragmentsSpent).toBe(BREAKTHROUGH_TIERS[0].fragmentCost);
      expect(r.goldSpent).toBe(BREAKTHROUGH_TIERS[0].goldCost);
      expect(r.breakthroughStonesSpent).toBe(BREAKTHROUGH_TIERS[0].breakthroughStoneCost);
    });

    it('should increase level cap after breakthrough', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      starSystem.breakthrough('guanyu');
      expect(starSystem.getLevelCap('guanyu')).toBe(BREAKTHROUGH_TIERS[0].levelCapAfter);
      expect(starSystem.getBreakthroughStage('guanyu')).toBe(1);
    });

    it('should fail when level not at cap', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP - 1, 0);
      expect(starSystem.breakthrough('guanyu').success).toBe(false);
    });

    it('should fail when fragments insufficient', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', 1);
      expect(starSystem.breakthrough('guanyu').success).toBe(false);
    });

    it('should fail when gold insufficient', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      const poorDeps = makeStarDeps({ gold: 100 });
      poorDeps.getFragments = (id: string) => heroSystem.getFragments(id);
      poorDeps.spendFragments = (id: string, c: number) => heroSystem.useFragments(id, c);
      starSystem.setDeps(poorDeps);
      expect(starSystem.breakthrough('guanyu').success).toBe(false);
    });

    it('should fail when breakthrough stones insufficient', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      const poorDeps = makeStarDeps({ gold: 999999999, breakthroughStones: 1 });
      poorDeps.getFragments = (id: string) => heroSystem.getFragments(id);
      poorDeps.spendFragments = (id: string, c: number) => heroSystem.useFragments(id, c);
      starSystem.setDeps(poorDeps);
      expect(starSystem.breakthrough('guanyu').success).toBe(false);
    });

    it('should fail for nonexistent general', () => {
      expect(starSystem.breakthrough('nonexistent').success).toBe(false);
    });

    it('should fail when already max breakthrough', () => {
      const save = starSystem.serialize();
      save.state.breakthroughStages['guanyu'] = MAX_BREAKTHROUGH_STAGE;
      starSystem.deserialize(save);
      expect(starSystem.breakthrough('guanyu').success).toBe(false);
    });

    it('should fail without deps', () => {
      const noDeps = new HeroStarSystem(heroSystem); noDeps.init(makeMockDeps());
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', 999);
      expect(noDeps.breakthrough('guanyu').success).toBe(false);
    });

    it('should allow consecutive breakthroughs', () => {
      // First breakthrough
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      const r1 = starSystem.breakthrough('guanyu');
      expect(r1.success).toBe(true); expect(r1.breakthroughStage).toBe(1);

      // Second breakthrough
      heroSystem.setLevelAndExp('guanyu', BREAKTHROUGH_TIERS[0].levelCapAfter, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[1].fragmentCost);
      const r2 = starSystem.breakthrough('guanyu');
      expect(r2.success).toBe(true); expect(r2.breakthroughStage).toBe(2);
    });

    it('should consume resources after breakthrough', () => {
      const tier = BREAKTHROUGH_TIERS[0];
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', tier.fragmentCost + 50);
      const goldBefore = deps.resources.gold;
      const stonesBefore = deps.resources.breakthroughStone;

      starSystem.breakthrough('guanyu');

      expect(heroSystem.getFragments('guanyu')).toBe(50);
      expect(deps.resources.gold).toBe(goldBefore - tier.goldCost);
      expect(deps.resources.breakthroughStone).toBe(stonesBefore - tier.breakthroughStoneCost);
    });
  });

  // ═══════════════════════════════════════════
  // canBreakthrough
  // ═══════════════════════════════════════════
  describe('canBreakthrough', () => {
    it('should return false when level not at cap', () => {
      expect(starSystem.canBreakthrough('guanyu')).toBe(false);
    });

    it('should return true when all conditions met', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      expect(starSystem.canBreakthrough('guanyu')).toBe(true);
    });

    it('should return false for nonexistent', () => {
      expect(starSystem.canBreakthrough('nonexistent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // getNextBreakthroughTier
  // ═══════════════════════════════════════════
  describe('getNextBreakthroughTier', () => {
    it('should return first tier for stage 0', () => {
      const tier = starSystem.getNextBreakthroughTier('guanyu');
      expect(tier).not.toBeNull();
      expect(tier!.name).toBe(BREAKTHROUGH_TIERS[0].name);
    });

    it('should return null for max stage', () => {
      const save = starSystem.serialize();
      save.state.breakthroughStages['guanyu'] = MAX_BREAKTHROUGH_STAGE;
      starSystem.deserialize(save);
      expect(starSystem.getNextBreakthroughTier('guanyu')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // P0-1: 突破→技能联动集成测试
  // ═══════════════════════════════════════════
  describe('突破→技能联动 (P0-1)', () => {
    it('突破成功时应调用 skillUnlockCallback', () => {
      const callbackCalls: Array<{ heroId: string; level: number }> = [];
      starSystem.setSkillUnlockCallback((heroId, level) => {
        callbackCalls.push({ heroId, level });
        return { unlocked: true, skillType: 'passive_enhance', description: 'test' };
      });

      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);

      const r = starSystem.breakthrough('guanyu');
      expect(r.success).toBe(true);
      expect(callbackCalls.length).toBe(1);
      expect(callbackCalls[0].heroId).toBe('guanyu');
      expect(callbackCalls[0].level).toBe(1); // 突破阶段1
    });

    it('突破失败时不应调用 skillUnlockCallback', () => {
      const callbackCalls: Array<{ heroId: string; level: number }> = [];
      starSystem.setSkillUnlockCallback((heroId, level) => {
        callbackCalls.push({ heroId, level });
        return null;
      });

      // 等级不够，突破应失败
      const r = starSystem.breakthrough('guanyu');
      expect(r.success).toBe(false);
      expect(callbackCalls.length).toBe(0);
    });

    it('未设置回调时突破仍可正常执行', () => {
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);

      // 不设置回调，突破不应报错
      const r = starSystem.breakthrough('guanyu');
      expect(r.success).toBe(true);
    });

    it('连续突破应多次触发回调', () => {
      const callbackCalls: Array<{ heroId: string; level: number }> = [];
      starSystem.setSkillUnlockCallback((heroId, level) => {
        callbackCalls.push({ heroId, level });
        return { unlocked: true, skillType: 'test', description: 'test' };
      });

      // 第一次突破
      heroSystem.setLevelAndExp('guanyu', INITIAL_LEVEL_CAP, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[0].fragmentCost);
      starSystem.breakthrough('guanyu');

      // 第二次突破
      heroSystem.setLevelAndExp('guanyu', BREAKTHROUGH_TIERS[0].levelCapAfter, 0);
      heroSystem.addFragment('guanyu', BREAKTHROUGH_TIERS[1].fragmentCost);
      starSystem.breakthrough('guanyu');

      expect(callbackCalls.length).toBe(2);
      expect(callbackCalls[0].level).toBe(1);
      expect(callbackCalls[1].level).toBe(2);
    });
  });
});
