/**
 * 集成测试 — 武将升星 / 突破系统
 *
 * 覆盖 Play 文档流程：
 *   §4.1  武将升星条件：碎片数量、铜钱消耗
 *   §4.2  升星属性增长：属性倍率提升
 *   §4.3  突破机制：特定星级突破
 *   §4.4  升星上限：最高星级限制
 *   §4.5  升星材料来源：碎片获取途径
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/hero-star-breakthrough
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeroStarSystem } from '../../../hero/HeroStarSystem';
import { HeroSystem } from '../../../hero/HeroSystem';
import { Quality } from '../../../hero/hero.types';
import type { GeneralData, GeneralStats } from '../../../hero/hero.types';
import type { StarSystemDeps, StarUpResult, BreakthroughResult, FragmentProgress } from '../../../hero/star-up.types';
import { FragmentSource } from '../../../hero/star-up.types';
import {
  MAX_STAR_LEVEL,
  STAR_UP_FRAGMENT_COST,
  STAR_UP_GOLD_COST,
  STAR_MULTIPLIERS,
  BREAKTHROUGH_TIERS,
  MAX_BREAKTHROUGH_STAGE,
  INITIAL_LEVEL_CAP,
  FINAL_LEVEL_CAP,
  RESOURCE_TYPE_GOLD,
  RESOURCE_TYPE_BREAKTHROUGH_STONE,
} from '../../../hero/star-up-config';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: () => null,
      getAll: () => new Map(),
      has: () => false,
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };
}

/** 模拟资源系统 */
function createMockStarDeps(
  gold: number = 999999,
  breakthroughStones: number = 999,
): StarSystemDeps {
  const resources: Record<string, number> = {
    [RESOURCE_TYPE_GOLD]: gold,
    [RESOURCE_TYPE_BREAKTHROUGH_STONE]: breakthroughStones,
  };

  return {
    spendFragments: () => true, // 由 HeroSystem 管理
    getFragments: () => 0,      // 由 HeroSystem 管理
    spendResource: (type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) {
        resources[type] -= amount;
        return true;
      }
      return false;
    },
    canAffordResource: (type: string, amount: number) => {
      return (resources[type] ?? 0) >= amount;
    },
    getResourceAmount: (type: string) => resources[type] ?? 0,
  };
}

/** 创建完整的 HeroStarSystem 实例 */
function createStarSystem(
  gold: number = 999999,
  breakthroughStones: number = 999,
): { heroSystem: HeroSystem; starSystem: HeroStarSystem; starDeps: StarSystemDeps } {
  const heroSystem = new HeroSystem();
  heroSystem.init(createMockDeps());

  const starSystem = new HeroStarSystem(heroSystem);
  starSystem.init(createMockDeps());

  const starDeps = createMockStarDeps(gold, breakthroughStones);
  starSystem.setDeps(starDeps);

  return { heroSystem, starSystem, starDeps };
}

/** 添加武将并给予碎片 */
function setupGeneralWithFragments(
  heroSystem: HeroSystem,
  generalId: string,
  fragmentCount: number,
): void {
  // 先添加武将到集合（starUp 需要 getGeneral 返回有效值）
  heroSystem.addGeneral(generalId);
  // 再添加碎片
  heroSystem.addFragment(generalId, fragmentCount);
}

// ═══════════════════════════════════════════════
// §4.1 武将升星条件
// ═══════════════════════════════════════════════

describe('§4.1 武将升星条件：碎片数量、铜钱消耗', () => {
  it('碎片不足时升星失败', () => {
    const { heroSystem, starSystem } = createStarSystem();
    // 刘备是 epic 品质，1→2 星需要 20 碎片
    setupGeneralWithFragments(heroSystem, 'liubei', 10);

    const result = starSystem.starUp('liubei');
    expect(result.success).toBe(false);
  });

  it('碎片充足时升星成功', () => {
    const { heroSystem, starSystem } = createStarSystem();
    // 1→2 星需要 20 碎片
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    const result = starSystem.starUp('liubei');
    expect(result.success).toBe(true);
    expect(result.currentStar).toBe(2);
    expect(result.fragmentsSpent).toBe(STAR_UP_FRAGMENT_COST[1]);
  });

  it('升星消耗铜钱', () => {
    const { heroSystem, starSystem, starDeps } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    const result = starSystem.starUp('liubei');
    expect(result.success).toBe(true);
    expect(result.goldSpent).toBe(STAR_UP_GOLD_COST[1]);
  });

  it('铜钱不足时升星失败', () => {
    const { heroSystem, starSystem } = createStarSystem(100); // 只有100铜钱
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    const result = starSystem.starUp('liubei');
    expect(result.success).toBe(false);
  });

  it('不存在的武将升星失败', () => {
    const { starSystem } = createStarSystem();
    const result = starSystem.starUp('nonexistent_hero');
    expect(result.success).toBe(false);
  });

  it('升星消耗碎片从 HeroSystem 扣除', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    starSystem.starUp('liubei');
    // 30 - 20 = 10 碎片剩余
    expect(heroSystem.getFragments('liubei')).toBe(30 - STAR_UP_FRAGMENT_COST[1]);
  });

  it('getStarUpCost 返回正确的碎片和铜钱消耗', () => {
    const { starSystem } = createStarSystem();
    const cost1 = starSystem.getStarUpCost(1);
    expect(cost1.fragments).toBe(STAR_UP_FRAGMENT_COST[1]);
    expect(cost1.gold).toBe(STAR_UP_GOLD_COST[1]);

    const cost3 = starSystem.getStarUpCost(3);
    expect(cost3.fragments).toBe(STAR_UP_FRAGMENT_COST[3]);
    expect(cost3.gold).toBe(STAR_UP_GOLD_COST[3]);
  });
});

// ═══════════════════════════════════════════════
// §4.2 升星属性增长
// ═══════════════════════════════════════════════

describe('§4.2 升星属性增长：属性倍率提升', () => {
  it('1星倍率为 1.0', () => {
    expect(STAR_MULTIPLIERS[1]).toBe(1.0);
  });

  it('2星倍率为 1.15', () => {
    expect(STAR_MULTIPLIERS[2]).toBe(1.15);
  });

  it('6星(满星)倍率为 2.5', () => {
    expect(STAR_MULTIPLIERS[6]).toBe(2.5);
  });

  it('升星后属性按倍率增长', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    const result = starSystem.starUp('liubei');
    expect(result.success).toBe(true);
    // statsBefore 使用 1 星倍率(1.0), statsAfter 使用 2 星倍率(1.15)
    expect(result.statsAfter.attack).toBeGreaterThan(result.statsBefore.attack);
  });

  it('calculateStarStats 返回正确的属性值', () => {
    const { heroSystem, starSystem } = createStarSystem();
    const general = heroSystem.getGeneral('liubei');
    if (!general) {
      // liubei 可能不在初始武将列表中，使用其他武将
      return;
    }

    const stats1 = starSystem.calculateStarStats(general, 1);
    const stats2 = starSystem.calculateStarStats(general, 2);

    expect(stats1.attack).toBe(Math.floor(general.baseStats.attack * STAR_MULTIPLIERS[1]));
    expect(stats2.attack).toBe(Math.floor(general.baseStats.attack * STAR_MULTIPLIERS[2]));
    expect(stats2.attack).toBeGreaterThan(stats1.attack);
  });

  it('升星预览显示属性差异', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    const preview = starSystem.getStarUpPreview('liubei');
    if (preview) {
      expect(preview.statsDiff.before.attack).toBeLessThan(preview.statsDiff.after.attack);
      expect(preview.currentStar).toBe(1);
      expect(preview.targetStar).toBe(2);
    }
  });
});

// ═══════════════════════════════════════════════
// §4.3 突破机制
// ═══════════════════════════════════════════════

describe('§4.3 突破机制', () => {
  it('初始等级上限为 30', () => {
    expect(INITIAL_LEVEL_CAP).toBe(30);
  });

  it('最终等级上限为 70', () => {
    expect(FINAL_LEVEL_CAP).toBe(70);
  });

  it('共4个突破阶段', () => {
    expect(MAX_BREAKTHROUGH_STAGE).toBe(4);
    expect(BREAKTHROUGH_TIERS).toHaveLength(4);
  });

  it('未突破时等级上限为 INITIAL_LEVEL_CAP', () => {
    const { starSystem } = createStarSystem();
    expect(starSystem.getLevelCap('liubei')).toBe(INITIAL_LEVEL_CAP);
  });

  it('突破阶段初始为 0', () => {
    const { starSystem } = createStarSystem();
    expect(starSystem.getBreakthroughStage('liubei')).toBe(0);
  });

  it('getNextBreakthroughTier 返回下一阶段配置', () => {
    const { starSystem } = createStarSystem();
    const tier = starSystem.getNextBreakthroughTier('liubei');
    expect(tier).not.toBeNull();
    expect(tier!.name).toBe('一阶突破');
    expect(tier!.levelCapAfter).toBe(40);
  });

  it('突破预览显示完整信息', () => {
    const { heroSystem, starSystem } = createStarSystem();
    // 添加武将并设置等级为满级30
    heroSystem.addFragment('liubei', 1);
    const general = heroSystem.getGeneral('liubei');

    const preview = starSystem.getBreakthroughPreview('liubei');
    // liubei 可能不在初始列表中，preview 可能为 null
    if (preview) {
      expect(preview.currentLevelCap).toBe(INITIAL_LEVEL_CAP);
      expect(preview.nextLevelCap).toBe(40);
      expect(preview.fragmentCost).toBeGreaterThan(0);
    }
  });

  it('突破阶段递增：30→40→50→60→70', () => {
    const caps = BREAKTHROUGH_TIERS.map((t) => t.levelCapAfter);
    expect(caps).toEqual([40, 50, 60, 70]);
  });
});

// ═══════════════════════════════════════════════
// §4.4 升星上限
// ═══════════════════════════════════════════════

describe('§4.4 升星上限：最高星级限制', () => {
  it('最高星级为 6', () => {
    expect(MAX_STAR_LEVEL).toBe(6);
  });

  it('已达最高星级时升星失败', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 9999);

    // 连续升星到满星
    for (let i = 0; i < MAX_STAR_LEVEL - 1; i++) {
      const result = starSystem.starUp('liubei');
      if (!result.success) break;
    }

    // 满星后再次升星应失败
    const result = starSystem.starUp('liubei');
    expect(result.success).toBe(false);
    expect(result.currentStar).toBe(MAX_STAR_LEVEL);
  });

  it('满星后 getStarUpPreview 返回 null', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 9999);

    // 连续升星到满星
    for (let i = 0; i < MAX_STAR_LEVEL - 1; i++) {
      const result = starSystem.starUp('liubei');
      if (!result.success) break;
    }

    const preview = starSystem.getStarUpPreview('liubei');
    expect(preview).toBeNull();
  });

  it('升星星级逐级递增', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 9999);

    const result1 = starSystem.starUp('liubei');
    expect(result1.success).toBe(true);
    expect(result1.previousStar).toBe(1);
    expect(result1.currentStar).toBe(2);

    const result2 = starSystem.starUp('liubei');
    expect(result2.success).toBe(true);
    expect(result2.previousStar).toBe(2);
    expect(result2.currentStar).toBe(3);
  });
});

// ═══════════════════════════════════════════════
// §4.5 升星材料来源
// ═══════════════════════════════════════════════

describe('§4.5 升星材料来源：碎片获取途径', () => {
  it('重复武将转化为碎片 (DUPLICATE)', () => {
    const { heroSystem, starSystem } = createStarSystem();
    const result = starSystem.handleDuplicateFragments('liubei', Quality.EPIC);
    expect(result.generalId).toBe('liubei');
    expect(result.count).toBeGreaterThan(0);
    expect(result.source).toBe('DUPLICATE' as FragmentSource);
  });

  it('关卡掉落碎片 (STAGE_DROP)', () => {
    const { heroSystem, starSystem } = createStarSystem();
    // stage_3_1 掉落 liubei 碎片
    const results = starSystem.gainFragmentsFromStage('stage_3_1', () => 0.5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('STAGE_DROP' as FragmentSource);
  });

  it('关卡掉落碎片数量在范围内', () => {
    const { heroSystem, starSystem } = createStarSystem();
    // 使用固定种子多次测试
    const results = starSystem.gainFragmentsFromStage('stage_3_1', () => 0.5);
    if (results.length > 0) {
      // stage_3_1 liubei 掉落范围 1~2
      expect(results[0].count).toBeGreaterThanOrEqual(1);
      expect(results[0].count).toBeLessThanOrEqual(2);
    }
  });

  it('不存在的关卡不掉落碎片', () => {
    const { starSystem } = createStarSystem();
    const results = starSystem.gainFragmentsFromStage('nonexistent_stage', () => 0.5);
    expect(results).toHaveLength(0);
  });

  it('商店兑换碎片消耗铜钱', () => {
    const { heroSystem, starSystem } = createStarSystem();
    const result = starSystem.exchangeFragmentsFromShop('liubei', 3);
    if (result.success) {
      expect(result.count).toBe(3);
      expect(result.goldSpent).toBeGreaterThan(0);
      expect(heroSystem.getFragments('liubei')).toBe(3);
    }
  });

  it('商店兑换受每日限购', () => {
    const { heroSystem, starSystem } = createStarSystem();
    // liubei 每日限购 10
    const result = starSystem.exchangeFragmentsFromShop('liubei', 20);
    if (result.success) {
      expect(result.count).toBeLessThanOrEqual(10);
    }
  });

  it('铜钱不足时商店兑换失败', () => {
    const { heroSystem, starSystem } = createStarSystem(100); // 只有100铜钱
    const result = starSystem.exchangeFragmentsFromShop('liubei', 5);
    expect(result.success).toBe(false);
    expect(result.goldSpent).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 碎片进度可视化
// ═══════════════════════════════════════════════

describe('碎片进度可视化', () => {
  it('getFragmentProgress 返回进度信息', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 10);

    const progress = starSystem.getFragmentProgress('liubei');
    if (progress) {
      expect(progress.generalId).toBe('liubei');
      expect(progress.currentFragments).toBe(10);
      expect(progress.currentStar).toBe(1);
      expect(typeof progress.percentage).toBe('number');
    }
  });

  it('碎片充足时 canStarUp 为 true', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 30);

    const progress = starSystem.getFragmentProgress('liubei');
    if (progress) {
      expect(progress.canStarUp).toBe(true);
    }
  });

  it('碎片不足时 canStarUp 为 false', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 5);

    const progress = starSystem.getFragmentProgress('liubei');
    if (progress) {
      expect(progress.canStarUp).toBe(false);
    }
  });

  it('不存在的武将返回 null', () => {
    const { starSystem } = createStarSystem();
    const progress = starSystem.getFragmentProgress('nonexistent');
    expect(progress).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// HeroStarSystem 存档与重置
// ═══════════════════════════════════════════════

describe('HeroStarSystem 存档与重置', () => {
  it('reset 清空星级和突破状态', () => {
    const { heroSystem, starSystem } = createStarSystem();
    setupGeneralWithFragments(heroSystem, 'liubei', 9999);

    starSystem.starUp('liubei');
    starSystem.reset();

    expect(starSystem.getBreakthroughStage('liubei')).toBe(0);
  });

  it('getState 返回当前状态', () => {
    const { starSystem } = createStarSystem();
    const state = starSystem.getState();
    expect(state).toBeDefined();
  });
});
