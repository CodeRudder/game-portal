/**
 * engine-hero-deps.ts 单元测试
 *
 * 覆盖：
 * - safeSpendResource: 资源类型校验、消耗成功/失败
 * - safeCanAfford: 资源类型校验、NaN/undefined 防御、grain 保留量
 * - safeGetAmount: 资源类型校验、非法类型返回 0
 * - initHeroSystems: 依赖注入完整性
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  safeSpendResource,
  safeCanAfford,
  safeGetAmount,
  initHeroSystems,
} from '../engine-hero-deps';
import type { HeroSystems } from '../engine-hero-deps';
import type { ResourceSystem } from '../resource/ResourceSystem';
import type { ISystemDeps } from '../../core/types';

// ── Mock factories ──────────────────────────────────

function createMockResourceSystem(): ResourceSystem {
  const amounts: Record<string, number> = {
    grain: 100,
    gold: 200,
    troops: 50,
    mandate: 10,
    techPoint: 5,
    recruitToken: 3,
    skillBook: 1,
  };
  return {
    getAmount: vi.fn((type: string) => amounts[type] ?? 0),
    consumeResource: vi.fn((type: string, amount: number) => {
      if (amounts[type] < amount) throw new Error('insufficient');
      amounts[type] -= amount;
    }),
    addResource: vi.fn((type: string, amount: number) => {
      amounts[type] = (amounts[type] ?? 0) + amount;
    }),
    getResources: vi.fn(),
    setResource: vi.fn(),
    serialize: vi.fn(),
    deserialize: vi.fn(),
  } as unknown as ResourceSystem;
}

function createMockHeroSystems(): HeroSystems {
  return {
    hero: {
      init: vi.fn(),
      setLevelCapGetter: vi.fn(),
    },
    heroRecruit: {
      init: vi.fn(),
      setRecruitDeps: vi.fn(),
    },
    heroLevel: {
      init: vi.fn(),
      setLevelDeps: vi.fn(),
    },
    heroStar: {
      getLevelCap: vi.fn(() => 50),
    },
  } as unknown as HeroSystems;
}

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), register: vi.fn() } as unknown,
    registry: { get: vi.fn(), register: vi.fn() } as unknown,
  } as unknown as ISystemDeps;
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-hero-deps', () => {
  let resource: ResourceSystem;

  beforeEach(() => {
    resource = createMockResourceSystem();
  });

  // ── safeSpendResource ──────────────────────────────

  describe('safeSpendResource()', () => {
    it('合法资源类型 + 余额充足 → 返回 true 并消耗', () => {
      const result = safeSpendResource(resource, 'gold', 50);
      expect(result).toBe(true);
      expect(resource.consumeResource).toHaveBeenCalledWith('gold', 50);
    });

    it('合法资源类型 + 余额不足 → 返回 false（不抛异常）', () => {
      const result = safeSpendResource(resource, 'gold', 9999);
      expect(result).toBe(false);
    });

    it('非法资源类型 → 返回 false，不调用 consumeResource', () => {
      const result = safeSpendResource(resource, 'invalidType', 10);
      expect(result).toBe(false);
      expect(resource.consumeResource).not.toHaveBeenCalled();
    });

    it('空字符串 → 返回 false', () => {
      expect(safeSpendResource(resource, '', 10)).toBe(false);
    });
  });

  // ── safeCanAfford ──────────────────────────────────

  describe('safeCanAfford()', () => {
    it('合法资源类型 + 余额充足 → 返回 true', () => {
      expect(safeCanAfford(resource, 'gold', 100)).toBe(true);
    });

    it('合法资源类型 + 余额不足 → 返回 false', () => {
      expect(safeCanAfford(resource, 'gold', 999)).toBe(false);
    });

    it('grain 需要扣除保留量 10', () => {
      // grain = 100, 可用 = 100 - 10 = 90
      expect(safeCanAfford(resource, 'grain', 90)).toBe(true);
      expect(safeCanAfford(resource, 'grain', 91)).toBe(false);
    });

    it('grain 余额 <= 10 → 无法消耗任何数量', () => {
      const lowGrainResource = createMockResourceSystem();
      (lowGrainResource.getAmount as ReturnType<typeof vi.fn>).mockImplementation(
        (type: string) => (type === 'grain' ? 10 : 0),
      );
      expect(safeCanAfford(lowGrainResource, 'grain', 1)).toBe(false);
    });

    it('非法资源类型 → 返回 false', () => {
      expect(safeCanAfford(resource, 'invalid', 10)).toBe(false);
    });

    it('getAmount 返回 NaN → 返回 false', () => {
      const nanResource = createMockResourceSystem();
      (nanResource.getAmount as ReturnType<typeof vi.fn>).mockReturnValue(NaN);
      expect(safeCanAfford(nanResource, 'gold', 10)).toBe(false);
    });

    it('getAmount 返回 undefined → 返回 false', () => {
      const undefResource = createMockResourceSystem();
      (undefResource.getAmount as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
      expect(safeCanAfford(undefResource, 'gold', 10)).toBe(false);
    });

    it('getAmount 返回 Infinity → 返回 true（有限值检查通过）', () => {
      const infResource = createMockResourceSystem();
      (infResource.getAmount as ReturnType<typeof vi.fn>).mockReturnValue(Infinity);
      expect(safeCanAfford(infResource, 'gold', 10)).toBe(false);
    });
  });

  // ── safeGetAmount ──────────────────────────────────

  describe('safeGetAmount()', () => {
    it('合法资源类型 → 返回正确数量', () => {
      expect(safeGetAmount(resource, 'gold')).toBe(200);
      expect(safeGetAmount(resource, 'grain')).toBe(100);
    });

    it('非法资源类型 → 返回 0', () => {
      expect(safeGetAmount(resource, 'invalid')).toBe(0);
      expect(safeGetAmount(resource, '')).toBe(0);
    });
  });

  // ── initHeroSystems ────────────────────────────────

  describe('initHeroSystems()', () => {
    it('调用所有子系统的 init', () => {
      const systems = createMockHeroSystems();
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      expect(systems.hero.init).toHaveBeenCalledWith(deps);
      expect(systems.heroRecruit.init).toHaveBeenCalledWith(deps);
      expect(systems.heroLevel.init).toHaveBeenCalledWith(deps);
    });

    it('为 heroRecruit 注入资源回调', () => {
      const systems = createMockHeroSystems();
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      expect(systems.heroRecruit.setRecruitDeps).toHaveBeenCalledWith(
        expect.objectContaining({
          heroSystem: systems.hero,
        }),
      );
      const recruitDeps = (systems.heroRecruit.setRecruitDeps as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(typeof recruitDeps.spendResource).toBe('function');
      expect(typeof recruitDeps.canAffordResource).toBe('function');
      expect(typeof recruitDeps.addResource).toBe('function');
    });

    it('为 heroLevel 注入资源回调和等级上限回调', () => {
      const systems = createMockHeroSystems();
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      expect(systems.heroLevel.setLevelDeps).toHaveBeenCalledWith(
        expect.objectContaining({
          heroSystem: systems.hero,
        }),
      );
      const levelDeps = (systems.heroLevel.setLevelDeps as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof levelDeps.spendResource).toBe('function');
      expect(typeof levelDeps.canAffordResource).toBe('function');
      expect(typeof levelDeps.getResourceAmount).toBe('function');
      expect(typeof levelDeps.getLevelCap).toBe('function');
    });

    it('为 hero 注入等级上限 getter', () => {
      const systems = createMockHeroSystems();
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      expect(systems.hero.setLevelCapGetter).toHaveBeenCalledWith(expect.any(Function));
    });

    it('getLevelCap 默认返回 heroStar 的等级上限', () => {
      const systems = createMockHeroSystems();
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      const getLevelCap = (systems.heroLevel.setLevelDeps as ReturnType<typeof vi.fn>).mock
        .calls[0][0].getLevelCap;
      expect(getLevelCap('hero1')).toBe(50);
    });

    it('getLevelCap 觉醒武将返回 120', () => {
      const systems = createMockHeroSystems();
      systems.awakening = {
        isAwakened: vi.fn((id: string) => id === 'awakenedHero'),
      } as unknown;
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      const getLevelCap = (systems.heroLevel.setLevelDeps as ReturnType<typeof vi.fn>).mock
        .calls[0][0].getLevelCap;
      expect(getLevelCap('awakenedHero')).toBe(120);
      expect(getLevelCap('normalHero')).toBe(50);
    });

    it('setLevelCapGetter 的回调优先取觉醒等级上限', () => {
      const systems = createMockHeroSystems();
      systems.awakening = {
        isAwakened: vi.fn((id: string) => id === 'awakenedHero'),
      } as unknown;
      const deps = createMockDeps();

      initHeroSystems(systems, resource, deps);

      const getter = (systems.hero.setLevelCapGetter as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(getter('awakenedHero')).toBe(120);
      expect(getter('normalHero')).toBe(50);
    });
  });
});
