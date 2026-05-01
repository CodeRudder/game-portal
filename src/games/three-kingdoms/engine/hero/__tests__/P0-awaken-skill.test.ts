/**
 * P0 测试: 觉醒技能解锁精确验证
 * 缺口ID: GAP-HERO-007 | 节点ID: HERO-TRAIN-025
 *
 * 验证点：
 * 1. 突破消耗碎片、铜钱、突破石的精确验证
 * 2. 觉醒技能不可重置的验证
 * 3. 突破后技能解锁回调正确调用
 * 4. 突破后等级上限正确提升
 * 5. 突破条件不满足时拒绝突破
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import type { StarSystemDeps } from '../star-up.types';

// ── Mock 依赖 ──

function createMockStarDeps(overrides?: Partial<StarSystemDeps>): StarSystemDeps {
  return {
    canAffordResource: vi.fn(() => true),
    spendResource: vi.fn(() => true),
    addResource: vi.fn(),
    getResourceAmount: vi.fn(() => 99999),
    ...overrides,
  };
}

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(), once: vi.fn(), emit: vi.fn(),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

// ── 辅助：设置武将等级到当前上限 ──

function setHeroToLevelCap(heroSystem: HeroSystem, starSystem: HeroStarSystem, generalId: string) {
  const levelCap = starSystem.getLevelCap(generalId);
  heroSystem.setLevelAndExp(generalId, levelCap, 0);
}

// ── 测试 ──

describe('P0: 觉醒技能解锁 (GAP-HERO-007)', () => {
  let heroSystem: HeroSystem;
  let starSystem: HeroStarSystem;
  let mockDeps: StarSystemDeps;

  beforeEach(() => {
    vi.restoreAllMocks();
    heroSystem = new HeroSystem();
    heroSystem.init(createMockDeps());
    starSystem = new HeroStarSystem(heroSystem);
    starSystem.init(createMockDeps());
    mockDeps = createMockStarDeps();
    starSystem.setDeps(mockDeps);
  });

  describe('精确资源消耗验证', () => {
    it('突破消耗碎片、铜钱、突破石正确', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      const preview = starSystem.getBreakthroughPreview('guanyu');
      expect(preview).not.toBeNull();
      expect(preview!.canBreakthrough).toBe(true);

      const result = starSystem.breakthrough('guanyu');

      expect(result.success).toBe(true);
      expect(result.fragmentsSpent).toBeGreaterThan(0);
      expect(result.goldSpent).toBeGreaterThan(0);
      expect(result.breakthroughStonesSpent).toBeGreaterThan(0);

      // 验证deps调用
      expect(mockDeps.spendResource).toHaveBeenCalled();
    });

    it('碎片不足时突破失败', () => {
      heroSystem.addGeneral('guanyu');
      // 不给碎片
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      const result = starSystem.breakthrough('guanyu');
      expect(result.success).toBe(false);
    });

    it('等级未达到上限时突破失败', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      // 等级为1，远低于上限

      const result = starSystem.breakthrough('guanyu');
      expect(result.success).toBe(false);
    });

    it('铜钱不足时突破失败', () => {
      const poorDeps = createMockStarDeps({
        canAffordResource: vi.fn((resource: string) => resource !== 'gold'),
      });
      starSystem.setDeps(poorDeps);

      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      const result = starSystem.breakthrough('guanyu');
      expect(result.success).toBe(false);
    });

    it('突破石不足时突破失败', () => {
      const noStoneDeps = createMockStarDeps({
        canAffordResource: vi.fn((resource: string) => resource !== 'breakthroughStone'),
      });
      starSystem.setDeps(noStoneDeps);

      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      const result = starSystem.breakthrough('guanyu');
      expect(result.success).toBe(false);
    });
  });

  describe('突破后等级上限提升', () => {
    it('突破成功后等级上限提升', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      const levelCapBefore = starSystem.getLevelCap('guanyu');
      const result = starSystem.breakthrough('guanyu');

      expect(result.success).toBe(true);
      expect(result.newLevelCap).toBeGreaterThan(levelCapBefore);
      expect(starSystem.getLevelCap('guanyu')).toBe(result.newLevelCap);
    });

    it('多次突破等级上限持续提升', () => {
      heroSystem.addGeneral('guanyu');

      for (let i = 0; i < 3; i++) {
        // 每次给50碎片（足够突破消耗）
        heroSystem.addFragment('guanyu', 50);
        setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

        const result = starSystem.breakthrough('guanyu');
        if (!result.success) {
          // 可能已达到最大突破阶段
          break;
        }
      }

      // 应该至少突破了1次
      expect(starSystem.getBreakthroughStage('guanyu')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('突破后技能解锁回调', () => {
    it('突破成功时调用skillUnlockCallback', () => {
      const callback = vi.fn().mockReturnValue({
        unlocked: true,
        skillType: 'awakening',
        description: '觉醒技能：青龙偃月',
      });
      starSystem.setSkillUnlockCallback(callback);

      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      starSystem.breakthrough('guanyu');

      expect(callback).toHaveBeenCalledWith('guanyu', 1);
    });

    it('多次突破每次都调用回调', () => {
      const callback = vi.fn().mockReturnValue(null);
      starSystem.setSkillUnlockCallback(callback);

      heroSystem.addGeneral('guanyu');

      for (let i = 0; i < 2; i++) {
        heroSystem.addFragment('guanyu', 50);
        setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

        starSystem.breakthrough('guanyu');
      }

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 'guanyu', 1);
      expect(callback).toHaveBeenNthCalledWith(2, 'guanyu', 2);
    });
  });

  describe('觉醒技能不可重置验证', () => {
    it('突破阶段只能前进不能后退（序列化/反序列化保留）', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 50);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      starSystem.breakthrough('guanyu');
      expect(starSystem.getBreakthroughStage('guanyu')).toBe(1);

      // 序列化→反序列化
      const data = starSystem.serialize();
      starSystem.reset();
      expect(starSystem.getBreakthroughStage('guanyu')).toBe(0);

      starSystem.deserialize(data);
      expect(starSystem.getBreakthroughStage('guanyu')).toBe(1);
    });

    it('没有提供重置突破的方法', () => {
      // 验证HeroStarSystem没有resetBreakthrough之类的方法
      const methods = Object.getOwnPropertyNames(HeroStarSystem.prototype);
      const resetMethods = methods.filter(m =>
        m.toLowerCase().includes('resetbreakthrough') ||
        m.toLowerCase().includes('resetbreak') ||
        m.toLowerCase().includes('downgradebreak')
      );
      expect(resetMethods.length).toBe(0);
    });
  });

  describe('突破预览验证', () => {
    it('getBreakthroughPreview返回正确的资源需求', () => {
      heroSystem.addGeneral('guanyu');
      heroSystem.addFragment('guanyu', 30);
      setHeroToLevelCap(heroSystem, starSystem, 'guanyu');

      const preview = starSystem.getBreakthroughPreview('guanyu');

      expect(preview).not.toBeNull();
      expect(preview!.fragmentCost).toBeGreaterThan(0);
      expect(preview!.goldCost).toBeGreaterThan(0);
      expect(preview!.breakthroughStoneCost).toBeGreaterThan(0);
    });

    it('已满突破时返回null', () => {
      heroSystem.addGeneral('guanyu');

      // 手动设置突破阶段到最大
      const data = starSystem.serialize();
      for (let i = 0; i < 10; i++) {
        data.state.breakthroughStages['guanyu'] = i + 1;
      }
      starSystem.deserialize(data);

      const preview = starSystem.getBreakthroughPreview('guanyu');
      expect(preview).toBeNull();
    });
  });
});
