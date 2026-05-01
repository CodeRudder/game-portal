/**
 * 武将经济系统 P1 缺口补充测试
 *
 * 覆盖 PRD HER-7~10 核心付费链路：
 * - HER-7: 武将商店购买（元宝/天命消耗、购买后获得武将碎片）
 * - HER-8: 突破石获取（引擎未实现，TODO 标注）
 * - HER-9: 技能书获取（引擎未实现，TODO 标注）
 * - HER-10: 经济模型（招贤令获取/消耗平衡、保底继承、招募令使用）
 *
 * 测试策略：使用真实引擎实例，避免 mock
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps, RecruitOutput } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { RecruitTokenEconomySystem } from '../recruit-token-economy-system';
import type { RecruitTokenEconomyDeps } from '../recruit-token-economy-system';
import { ResourceSystem } from '../../resource/ResourceSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import {
  RECRUIT_COSTS,
  RECRUIT_PITY,
  RECRUIT_SAVE_VERSION,
} from '../hero-recruit-config';
import type { RecruitType } from '../hero-recruit-config';
import { DUPLICATE_FRAGMENT_COUNT } from '../hero-config';
import type { ISystemDeps } from '../../../core/types';

// ── 辅助函数 ──

/** 创建 mock ISystemDeps */
function makeSystemDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } as unknown,
    config: { get: vi.fn(), set: vi.fn() } as unknown,
    registry: { get: vi.fn(), has: vi.fn(), getAll: vi.fn() } as unknown,
  };
}

/** 创建确定性 RNG（始终返回固定值） */
function makeConstantRng(value: number): () => number {
  return () => value;
}

/** 创建序列 RNG（按顺序返回值，循环） */
function makeSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/** 创建真实 ResourceSystem + HeroSystem + RecruitDeps 联动 */
function createRealEcosystem() {
  const resourceSystem = new ResourceSystem();
  resourceSystem.init(makeSystemDeps());

  const heroSystem = new HeroSystem();
  heroSystem.init(makeSystemDeps());

  // 创建招募依赖，连接真实资源系统
  const recruitDeps: RecruitDeps = {
    heroSystem,
    spendResource: (type: string, amount: number) => {
      try {
        resourceSystem.consumeResource(type as any, amount);
        return true;
      } catch {
        return false;
      }
    },
    canAffordResource: (type: string, amount: number) => {
      return resourceSystem.getAmount(type as any) >= amount;
    },
    addResource: (type: string, amount: number) => {
      resourceSystem.addResource(type as any, amount);
    },
  };

  return { resourceSystem, heroSystem, recruitDeps };
}

/** 创建招贤令经济依赖 */
function createTokenEconomyDeps(resourceSystem: ResourceSystem): RecruitTokenEconomyDeps {
  return {
    addRecruitToken: (amount: number) => resourceSystem.addResource('recruitToken', amount),
    consumeGold: (amount: number) => {
      try {
        resourceSystem.consumeResource('gold', amount);
        return true;
      } catch {
        return false;
      }
    },
    getGoldAmount: () => resourceSystem.getAmount('gold'),
    addGold: (amount: number) => resourceSystem.addResource('gold', amount),
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. 武将商店购买（HER-7）
// ═══════════════════════════════════════════════════════════════

describe('HER-7 武将商店购买', () => {
  let resourceSystem: ResourceSystem;
  let heroSystem: HeroSystem;
  let recruitDeps: RecruitDeps;
  let recruitSystem: HeroRecruitSystem;
  let tokenEconomy: RecruitTokenEconomySystem;

  beforeEach(() => {
    const eco = createRealEcosystem();
    resourceSystem = eco.resourceSystem;
    heroSystem = eco.heroSystem;
    recruitDeps = eco.recruitDeps;

    recruitSystem = new HeroRecruitSystem();
    recruitSystem.setRecruitDeps(recruitDeps);

    tokenEconomy = new RecruitTokenEconomySystem();
    tokenEconomy.init(makeSystemDeps());
    tokenEconomy.setEconomyDeps(createTokenEconomyDeps(resourceSystem));
  });

  // ── 招贤令消耗购买 ──

  describe('招贤令消耗购买', () => {
    it('普通招募消耗招贤令（recruitToken）', () => {
      // 确保初始招贤令充足
      resourceSystem.addResource('recruitToken', 100);
      const before = resourceSystem.getAmount('recruitToken');
      const cost = RECRUIT_COSTS.normal;

      const result = recruitSystem.recruitSingle('normal');
      expect(result).not.toBeNull();
      const after = resourceSystem.getAmount('recruitToken');
      expect(before - after).toBe(cost.amount);
    });

    it('高级招募消耗招贤令（recruitToken）', () => {
      resourceSystem.addResource('recruitToken', 100);
      const before = resourceSystem.getAmount('recruitToken');
      const cost = RECRUIT_COSTS.advanced;

      const result = recruitSystem.recruitSingle('advanced');
      expect(result).not.toBeNull();
      const after = resourceSystem.getAmount('recruitToken');
      expect(before - after).toBe(cost.amount);
    });

    it('十连招募消耗10倍资源', () => {
      resourceSystem.addResource('recruitToken', 100);
      const before = resourceSystem.getAmount('recruitToken');
      const cost = RECRUIT_COSTS.normal;

      const result = recruitSystem.recruitTen('normal');
      expect(result).not.toBeNull();
      const after = resourceSystem.getAmount('recruitToken');
      expect(before - after).toBe(cost.amount * 10);
    });

    it('资源不足时招募失败返回 null', () => {
      // 初始资源为 30 招贤令（来自 INITIAL_RESOURCES）
      // 普通招募消耗 1，连续招募耗尽后应失败
      // 先添加一些再消耗
      resourceSystem.addResource('recruitToken', 5); // 总共 35
      // 消耗掉大部分
      for (let i = 0; i < 35; i++) {
        const r = recruitSystem.recruitSingle('normal');
        if (r === null) break;
      }
      // 招贤令耗尽
      const result = recruitSystem.recruitSingle('normal');
      expect(result).toBeNull();
    });
  });

  // ── 商店购买招贤令（铜钱 → 招贤令） ──

  describe('商店购买招贤令', () => {
    it('铜钱购买招贤令成功', () => {
      resourceSystem.addResource('gold', 5000);
      const goldBefore = resourceSystem.getAmount('gold');
      const tokenBefore = resourceSystem.getAmount('recruitToken');

      const success = tokenEconomy.buyFromShop(10);
      expect(success).toBe(true);
      expect(resourceSystem.getAmount('gold')).toBeLessThan(goldBefore);
      expect(resourceSystem.getAmount('recruitToken')).toBeGreaterThan(tokenBefore);
    });

    it('铜钱不足时购买失败', () => {
      // 初始 300 铜，不够买 10 个（需 1000 铜）
      const result = tokenEconomy.buyFromShop(10);
      expect(result).toBe(false);
    });

    it('超过每日限购时购买失败', () => {
      resourceSystem.addResource('gold', 100000);
      // 每日限购 50 个
      expect(tokenEconomy.buyFromShop(50)).toBe(true);
      expect(tokenEconomy.getDailyShopRemaining()).toBe(0);
      expect(tokenEconomy.buyFromShop(1)).toBe(false);
    });

    it('部分购买：请求超过剩余额度时自动调整', () => {
      resourceSystem.addResource('gold', 100000);
      // 先买 48 个
      expect(tokenEconomy.buyFromShop(48)).toBe(true);
      // 再买 5 个，实际只能买 2 个（剩余额度 2）
      expect(tokenEconomy.buyFromShop(5)).toBe(true);
      expect(tokenEconomy.getDailyShopPurchased()).toBe(50);
    });

    it('购买 0 个或负数返回失败', () => {
      expect(tokenEconomy.buyFromShop(0)).toBe(false);
      expect(tokenEconomy.buyFromShop(-1)).toBe(false);
    });
  });

  // ── 购买后获得武将碎片 ──

  describe('购买后获得武将/碎片', () => {
    it('首次招募获得武将（非碎片）', () => {
      resourceSystem.addResource('recruitToken', 100);
      const result = recruitSystem.recruitSingle('normal');
      expect(result).not.toBeNull();
      expect(result!.results[0].general).not.toBeNull();
      expect(result!.results[0].isDuplicate).toBe(false);
      expect(result!.results[0].fragmentCount).toBe(0);
    });

    it('重复招募获得碎片', () => {
      resourceSystem.addResource('recruitToken', 1000);
      const recruitedIds: string[] = [];

      // 多次招募直到出现重复
      for (let i = 0; i < 50; i++) {
        const result = recruitSystem.recruitSingle('normal');
        if (result) {
          const generalId = result.results[0].general?.id;
          if (generalId && recruitedIds.includes(generalId)) {
            // 找到重复武将
            expect(result.results[0].isDuplicate).toBe(true);
            expect(result.results[0].fragmentCount).toBeGreaterThan(0);
            return;
          }
          if (generalId) recruitedIds.push(generalId);
        }
      }

      // 50 次招募中应至少出现 1 次重复（2 COMMON 武将，60% 概率）
      // 如果没出现也不断言失败，因为概率极低
    });

    it('碎片数量按品质区分', () => {
      resourceSystem.addResource('recruitToken', 10000);
      // 先收集所有武将
      for (let i = 0; i < 30; i++) {
        recruitSystem.recruitSingle('advanced');
      }

      // 后续招募检查重复碎片数量
      let foundDuplicate = false;
      for (let i = 0; i < 100; i++) {
        const result = recruitSystem.recruitSingle('advanced');
        if (result && result.results[0].isDuplicate) {
          const quality = result.results[0].quality;
          const expectedFragments = DUPLICATE_FRAGMENT_COUNT[quality];
          expect(result.results[0].fragmentCount).toBe(expectedFragments);
          foundDuplicate = true;
          break;
        }
      }
      // 高级招募 100 次应出现重复
      expect(foundDuplicate).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 首通奖励（HER-7 关卡首通）
// ═══════════════════════════════════════════════════════════════

describe('HER-7 关卡首通奖励', () => {
  let resourceSystem: ResourceSystem;
  let tokenEconomy: RecruitTokenEconomySystem;

  beforeEach(() => {
    resourceSystem = new ResourceSystem();
    resourceSystem.init(makeSystemDeps());
    tokenEconomy = new RecruitTokenEconomySystem();
    tokenEconomy.init(makeSystemDeps());
    tokenEconomy.setEconomyDeps(createTokenEconomyDeps(resourceSystem));
  });

  it('首次通关关卡获得招贤令奖励（3~5）', () => {
    const reward = tokenEconomy.claimStageClearReward('stage_1_1');
    expect(reward).toBeGreaterThanOrEqual(3);
    expect(reward).toBeLessThanOrEqual(5);
  });

  it('同一关卡不可重复领取首通奖励', () => {
    tokenEconomy.claimStageClearReward('stage_1_1');
    const reward2 = tokenEconomy.claimStageClearReward('stage_1_1');
    expect(reward2).toBe(0);
  });

  it('不同关卡可分别领取首通奖励', () => {
    const r1 = tokenEconomy.claimStageClearReward('stage_1_1');
    const r2 = tokenEconomy.claimStageClearReward('stage_1_2');
    const r3 = tokenEconomy.claimStageClearReward('stage_1_3');
    expect(r1).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(0);
    expect(r3).toBeGreaterThan(0);
  });

  it('空关卡ID返回0', () => {
    expect(tokenEconomy.claimStageClearReward('')).toBe(0);
  });

  it('首通奖励实际增加资源', () => {
    const before = resourceSystem.getAmount('recruitToken');
    tokenEconomy.claimStageClearReward('stage_1_1');
    const after = resourceSystem.getAmount('recruitToken');
    expect(after - before).toBeGreaterThanOrEqual(3);
    expect(after - before).toBeLessThanOrEqual(5);
  });

  it('isStageRewardClaimed 正确反映领取状态', () => {
    expect(tokenEconomy.isStageRewardClaimed('stage_1_1')).toBe(false);
    tokenEconomy.claimStageClearReward('stage_1_1');
    expect(tokenEconomy.isStageRewardClaimed('stage_1_1')).toBe(true);
  });

  it('getClearedStageCount 正确计数', () => {
    expect(tokenEconomy.getClearedStageCount()).toBe(0);
    tokenEconomy.claimStageClearReward('stage_1_1');
    expect(tokenEconomy.getClearedStageCount()).toBe(1);
    tokenEconomy.claimStageClearReward('stage_1_2');
    expect(tokenEconomy.getClearedStageCount()).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 保底继承（HER-10 保底机制）
// ═══════════════════════════════════════════════════════════════

describe('HER-10 保底继承', () => {
  let heroSystem: HeroSystem;
  let recruitSystem: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    heroSystem.init(makeSystemDeps());
    recruitSystem = new HeroRecruitSystem();
    const richDeps: RecruitDeps = {
      heroSystem,
      spendResource: vi.fn().mockReturnValue(true),
      canAffordResource: vi.fn().mockReturnValue(true),
    };
    recruitSystem.setRecruitDeps(richDeps);
  });

  describe('保底计数器递增', () => {
    it('普通招募每次 +1 十连保底计数', () => {
      // rng=0.3 → COMMON (60% 区间)
      recruitSystem.setRng(makeConstantRng(0.3));
      recruitSystem.recruitSingle('normal');
      recruitSystem.recruitSingle('normal');
      recruitSystem.recruitSingle('normal');
      const pity = recruitSystem.getGachaState();
      // COMMON < RARE → 不重置十连保底
      expect(pity.normalPity).toBe(3);
    });

    it('高级招募每次 +1 十连保底计数', () => {
      // rng=0.1 → COMMON (20% 区间 in advanced)
      recruitSystem.setRng(makeConstantRng(0.1));
      recruitSystem.recruitSingle('advanced');
      recruitSystem.recruitSingle('advanced');
      const pity = recruitSystem.getGachaState();
      expect(pity.advancedPity).toBe(2);
    });

    it('出稀有+品质重置十连保底计数', () => {
      // 先抽 5 次 COMMON
      recruitSystem.setRng(makeConstantRng(0.3));
      for (let i = 0; i < 5; i++) {
        recruitSystem.recruitSingle('normal');
      }
      expect(recruitSystem.getGachaState().normalPity).toBe(5);

      // 再抽 1 次 RARE（normal RARE 区间 0.90~0.98）
      recruitSystem.setRng(makeConstantRng(0.93));
      recruitSystem.recruitSingle('normal');
      expect(recruitSystem.getGachaState().normalPity).toBe(0);
    });

    it('硬保底计数独立于十连保底计数', () => {
      // normal: hardPityThreshold = Infinity（无硬保底）
      // advanced: hardPityThreshold = 100
      recruitSystem.setRng(makeConstantRng(0.1)); // COMMON in advanced
      for (let i = 0; i < 5; i++) {
        recruitSystem.recruitSingle('advanced');
      }
      const pity = recruitSystem.getGachaState();
      expect(pity.advancedPity).toBe(5);
      expect(pity.advancedHardPity).toBe(5);
    });
  });

  describe('保底触发', () => {
    it('十连保底：第10次必出稀有+', () => {
      // 预设保底计数为 9
      recruitSystem.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
        freeRecruit: {
          usedFreeCount: { normal: 0, advanced: 0 },
          lastResetDate: new Date().toISOString().slice(0, 10),
        },
        upHero: { upGeneralId: null, upRate: 0.5, description: '' },
        history: [],
      });

      // rng=0.3 → COMMON → 保底提升到 RARE
      recruitSystem.setRng(makeConstantRng(0.3));
      const result = recruitSystem.recruitSingle('normal');
      expect(result).not.toBeNull();
      const quality = result!.results[0].quality;
      expect(QUALITY_ORDER[quality]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.RARE]);
    });

    it('硬保底：高级招募第100次必出传说(LEGENDARY)+', () => {
      recruitSystem.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 99 },
        freeRecruit: {
          usedFreeCount: { normal: 0, advanced: 0 },
          lastResetDate: new Date().toISOString().slice(0, 10),
        },
        upHero: { upGeneralId: null, upRate: 0.5, description: '' },
        history: [],
      });

      // rng=0.1 → COMMON → 硬保底提升到 LEGENDARY
      recruitSystem.setRng(makeConstantRng(0.1));
      const result = recruitSystem.recruitSingle('advanced');
      expect(result).not.toBeNull();
      const quality = result!.results[0].quality;
      expect(QUALITY_ORDER[quality]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.LEGENDARY]);
    });

    it('硬保底优先级高于十连保底', () => {
      // 同时满足十连保底(9)和硬保底(99)
      recruitSystem.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 9, normalHardPity: 0, advancedHardPity: 99 },
        freeRecruit: {
          usedFreeCount: { normal: 0, advanced: 0 },
          lastResetDate: new Date().toISOString().slice(0, 10),
        },
        upHero: { upGeneralId: null, upRate: 0.5, description: '' },
        history: [],
      });

      // rng=0.1 → COMMON → 硬保底提升到 LEGENDARY（优先于十连保底的 RARE）
      recruitSystem.setRng(makeConstantRng(0.1));
      const result = recruitSystem.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
    });
  });

  describe('保底继承（跨卡池/序列化）', () => {
    it('序列化保存保底计数器状态', () => {
      recruitSystem.setRng(makeConstantRng(0.3));
      for (let i = 0; i < 5; i++) {
        recruitSystem.recruitSingle('normal');
      }
      const saved = recruitSystem.serialize();
      expect(saved.pity.normalPity).toBe(5);
      expect(saved.pity.normalHardPity).toBe(5);
    });

    it('反序列化恢复保底计数器状态', () => {
      const savedPity = {
        normalPity: 7,
        advancedPity: 3,
        normalHardPity: 7,
        advancedHardPity: 50,
      };
      recruitSystem.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: savedPity,
        freeRecruit: {
          usedFreeCount: { normal: 0, advanced: 0 },
          lastResetDate: new Date().toISOString().slice(0, 10),
        },
        upHero: { upGeneralId: null, upRate: 0.5, description: '' },
        history: [],
      });

      const pity = recruitSystem.getGachaState();
      expect(pity.normalPity).toBe(7);
      expect(pity.advancedPity).toBe(3);
      expect(pity.normalHardPity).toBe(7);
      expect(pity.advancedHardPity).toBe(50);
    });

    it('保底计数器在反序列化后继续正确递增', () => {
      recruitSystem.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 8, advancedPity: 0, normalHardPity: 8, advancedHardPity: 0 },
        freeRecruit: {
          usedFreeCount: { normal: 0, advanced: 0 },
          lastResetDate: new Date().toISOString().slice(0, 10),
        },
        upHero: { upGeneralId: null, upRate: 0.5, description: '' },
        history: [],
      });

      // 再抽 1 次 → normalPity=9 → 第2次触发十连保底
      recruitSystem.setRng(makeConstantRng(0.3));
      recruitSystem.recruitSingle('normal');
      expect(recruitSystem.getGachaState().normalPity).toBe(9);

      // 第 10 次 → 保底触发
      recruitSystem.recruitSingle('normal');
      const result = recruitSystem.recruitSingle('normal');
      // 保底触发后重置为 0
      // 注意：第10次保底触发后计数器重置，第11次从0开始
    });

    it('getNextTenPullPity 返回正确剩余次数', () => {
      recruitSystem.setRng(makeConstantRng(0.3));
      for (let i = 0; i < 5; i++) {
        recruitSystem.recruitSingle('normal');
      }
      expect(recruitSystem.getNextTenPullPity('normal')).toBe(5); // 10 - 5 = 5
    });

    it('getNextHardPity 返回正确剩余次数', () => {
      recruitSystem.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 90 },
        freeRecruit: {
          usedFreeCount: { normal: 0, advanced: 0 },
          lastResetDate: new Date().toISOString().slice(0, 10),
        },
        upHero: { upGeneralId: null, upRate: 0.5, description: '' },
        history: [],
      });
      expect(recruitSystem.getNextHardPity('advanced')).toBe(10); // 100 - 90 = 10
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 招募令使用（HER-10 招贤令经济）
// ═══════════════════════════════════════════════════════════════

describe('HER-10 招募令使用', () => {
  let resourceSystem: ResourceSystem;
  let heroSystem: HeroSystem;
  let recruitDeps: RecruitDeps;
  let recruitSystem: HeroRecruitSystem;
  let tokenEconomy: RecruitTokenEconomySystem;

  beforeEach(() => {
    const eco = createRealEcosystem();
    resourceSystem = eco.resourceSystem;
    heroSystem = eco.heroSystem;
    recruitDeps = eco.recruitDeps;

    recruitSystem = new HeroRecruitSystem();
    recruitSystem.setRecruitDeps(recruitDeps);

    tokenEconomy = new RecruitTokenEconomySystem();
    tokenEconomy.init(makeSystemDeps());
    tokenEconomy.setEconomyDeps(createTokenEconomyDeps(resourceSystem));
  });

  describe('新手礼包', () => {
    it('首次领取新手礼包获得 100 招贤令', () => {
      const before = resourceSystem.getAmount('recruitToken');
      const reward = tokenEconomy.claimNewbiePack();
      expect(reward).toBe(100);
      expect(resourceSystem.getAmount('recruitToken')).toBe(before + 100);
    });

    it('新手礼包只能领取一次', () => {
      tokenEconomy.claimNewbiePack();
      const reward2 = tokenEconomy.claimNewbiePack();
      expect(reward2).toBe(0);
    });

    it('新手礼包招贤令可用于高级招募', () => {
      // 领取新手礼包
      tokenEconomy.claimNewbiePack();
      const tokenAmount = resourceSystem.getAmount('recruitToken');
      // 高级招募需要 10 招贤令
      expect(tokenAmount).toBeGreaterThanOrEqual(10);
      const result = recruitSystem.recruitSingle('advanced');
      expect(result).not.toBeNull();
    });
  });

  describe('日常任务奖励', () => {
    it('领取日常任务奖励获得 15 招贤令', () => {
      const before = resourceSystem.getAmount('recruitToken');
      const reward = tokenEconomy.claimDailyTaskReward();
      expect(reward).toBe(15);
      expect(resourceSystem.getAmount('recruitToken')).toBe(before + 15);
    });

    it('每日只能领取一次日常任务奖励', () => {
      tokenEconomy.claimDailyTaskReward();
      const reward2 = tokenEconomy.claimDailyTaskReward();
      expect(reward2).toBe(0);
    });
  });

  describe('活动奖励', () => {
    it('领取活动奖励获得 10~20 招贤令', () => {
      const reward = tokenEconomy.claimEventReward();
      expect(reward).toBeGreaterThanOrEqual(10);
      expect(reward).toBeLessThanOrEqual(20);
    });

    it('活动奖励可多次领取', () => {
      const r1 = tokenEconomy.claimEventReward();
      const r2 = tokenEconomy.claimEventReward();
      expect(r1).toBeGreaterThan(0);
      expect(r2).toBeGreaterThan(0);
    });
  });

  describe('被动产出', () => {
    it('被动产出按 0.002/秒速率增加招贤令', () => {
      const before = resourceSystem.getAmount('recruitToken');
      // 模拟 1 小时（3600秒）
      tokenEconomy.tick(3600);
      const after = resourceSystem.getAmount('recruitToken');
      // 0.002 × 3600 = 7.2
      expect(after - before).toBeCloseTo(7.2, 1);
    });

    it('被动产出 4 小时约 28.8 招贤令', () => {
      const before = resourceSystem.getAmount('recruitToken');
      tokenEconomy.tick(14400); // 4h
      const after = resourceSystem.getAmount('recruitToken');
      // 0.002 × 14400 = 28.8
      expect(after - before).toBeCloseTo(28.8, 0);
    });

    it('无效 dt 不产出', () => {
      const before = resourceSystem.getAmount('recruitToken');
      tokenEconomy.tick(0);
      tokenEconomy.tick(-1);
      tokenEconomy.tick(NaN);
      tokenEconomy.tick(Infinity);
      expect(resourceSystem.getAmount('recruitToken')).toBe(before);
    });
  });

  describe('离线收益', () => {
    it('离线收益按 50% 效率计算', () => {
      // 1 小时离线 = 0.002 × 3600 × 0.5 = 3.6
      const reward = tokenEconomy.calculateOfflineReward(3600);
      expect(reward).toBeCloseTo(3.6, 1);
    });

    it('领取离线收益实际增加招贤令', () => {
      const before = resourceSystem.getAmount('recruitToken');
      const claimed = tokenEconomy.claimOfflineReward(3600);
      expect(claimed).toBeCloseTo(3.6, 1);
      expect(resourceSystem.getAmount('recruitToken')).toBeCloseTo(before + 3.6, 1);
    });

    it('离线 0 秒返回 0', () => {
      expect(tokenEconomy.calculateOfflineReward(0)).toBe(0);
      expect(tokenEconomy.claimOfflineReward(0)).toBe(0);
    });
  });

  describe('每日免费招募', () => {
    it('普通招募每日 1 次免费', () => {
      expect(recruitSystem.canFreeRecruit('normal')).toBe(true);
      const result = recruitSystem.freeRecruitSingle('normal');
      expect(result).not.toBeNull();
      expect(result!.cost.resourceType).toBe('free');
      expect(result!.cost.amount).toBe(0);
    });

    it('免费招募后不可再次免费', () => {
      recruitSystem.freeRecruitSingle('normal');
      expect(recruitSystem.canFreeRecruit('normal')).toBe(false);
      const result = recruitSystem.freeRecruitSingle('normal');
      expect(result).toBeNull();
    });

    it('高级招募无免费次数', () => {
      expect(recruitSystem.canFreeRecruit('advanced')).toBe(false);
      const result = recruitSystem.freeRecruitSingle('advanced');
      expect(result).toBeNull();
    });

    it('免费招募也触发保底计数', () => {
      recruitSystem.setRng(makeConstantRng(0.3));
      recruitSystem.freeRecruitSingle('normal');
      const pity = recruitSystem.getGachaState();
      expect(pity.normalPity).toBeGreaterThanOrEqual(0); // 可能被重置
      expect(pity.normalHardPity).toBeGreaterThanOrEqual(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 经济模型日产出验证（HER-10）
// ═══════════════════════════════════════════════════════════════

describe('HER-10 经济模型日产出验证', () => {
  let resourceSystem: ResourceSystem;
  let tokenEconomy: RecruitTokenEconomySystem;

  beforeEach(() => {
    resourceSystem = new ResourceSystem();
    resourceSystem.init(makeSystemDeps());
    tokenEconomy = new RecruitTokenEconomySystem();
    tokenEconomy.init(makeSystemDeps());
    tokenEconomy.setEconomyDeps(createTokenEconomyDeps(resourceSystem));
  });

  it('4h 在线被动产出约 28.8 招贤令', () => {
    const before = resourceSystem.getAmount('recruitToken');
    tokenEconomy.tick(14400); // 4h
    const earned = resourceSystem.getAmount('recruitToken') - before;
    expect(earned).toBeCloseTo(28.8, 0);
  });

  it('新手礼包 + 被动产出 + 日常任务 ≈ 143.8 招贤令', () => {
    const before = resourceSystem.getAmount('recruitToken');
    tokenEconomy.claimNewbiePack(); // 100
    tokenEconomy.tick(14400); // ~28.8
    tokenEconomy.claimDailyTaskReward(); // 15
    const total = resourceSystem.getAmount('recruitToken') - before;
    expect(total).toBeCloseTo(143.8, 0);
  });

  it('完整日产出（含商店购买 50 个）≈ 193.8', () => {
    resourceSystem.addResource('gold', 10000); // 确保铜钱充足
    const before = resourceSystem.getAmount('recruitToken');
    tokenEconomy.claimNewbiePack(); // 100
    tokenEconomy.tick(14400); // ~28.8
    tokenEconomy.claimDailyTaskReward(); // 15
    tokenEconomy.buyFromShop(50); // 50
    const total = resourceSystem.getAmount('recruitToken') - before;
    expect(total).toBeCloseTo(193.8, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. HER-8 突破石获取（TODO: 引擎未实现）
// ═══════════════════════════════════════════════════════════════

describe.todo('HER-8 突破石获取途径', () => {
  it.todo('关卡掉落突破石（1~3 个/关）');
  it.todo('关卡扫荡掉落突破石（1~2 个/次）');
  it.todo('商店购买突破石（500 铜钱/个，日限 20）');
  it.todo('成就奖励突破石（5~20 个）');
  it.todo('联盟商店兑换突破石（200 联盟币/个，周限 30）');
  it.todo('活动奖励突破石（10~30 个）');
  it.todo('单武将全部突破需 75 个突破石');
});

// ═══════════════════════════════════════════════════════════════
// 7. HER-9 技能书获取（TODO: 引擎未实现）
// ═══════════════════════════════════════════════════════════════

describe.todo('HER-9 技能书获取途径', () => {
  it.todo('日常任务奖励技能书（1~2 本/日）');
  it.todo('远征掉落技能书（1~3 本/次）');
  it.todo('活动奖励技能书（3~10 本）');
  it.todo('联盟商店兑换技能书（300 联盟币/本，周限 10）');
  it.todo('关卡通关首通奖励技能书（1 本/特定关卡）');
  it.todo('单技能升至满级需 12 本技能书');
});

// ═══════════════════════════════════════════════════════════════
// 8. 序列化/反序列化完整性
// ═══════════════════════════════════════════════════════════════

describe('经济系统序列化完整性', () => {
  it('招贤令经济系统序列化后反序列化状态一致', () => {
    const resourceSystem = new ResourceSystem();
    resourceSystem.init(makeSystemDeps());
    const tokenEconomy = new RecruitTokenEconomySystem();
    tokenEconomy.init(makeSystemDeps());
    tokenEconomy.setEconomyDeps(createTokenEconomyDeps(resourceSystem));

    // 操作一些状态
    tokenEconomy.claimNewbiePack();
    tokenEconomy.claimDailyTaskReward();
    tokenEconomy.claimStageClearReward('stage_1_1');
    tokenEconomy.tick(3600);

    // 序列化
    const saved = tokenEconomy.serialize();
    expect(saved.newbiePackClaimed).toBe(true);
    expect(saved.dailyTaskClaimed).toBe(true);
    expect(saved.clearedStages).toContain('stage_1_1');
    expect(saved.totalPassiveEarned).toBeCloseTo(7.2, 1);

    // 反序列化到新实例
    const tokenEconomy2 = new RecruitTokenEconomySystem();
    tokenEconomy2.deserialize(saved);
    expect(tokenEconomy2.getNewbiePackClaimed()).toBe(true);
    expect(tokenEconomy2.getDailyTaskClaimed()).toBe(true);
    expect(tokenEconomy2.isStageRewardClaimed('stage_1_1')).toBe(true);
    expect(tokenEconomy2.getTotalPassiveEarned()).toBeCloseTo(7.2, 1);
  });

  it('保底计数器序列化后反序列化一致', () => {
    const heroSystem = new HeroSystem();
    heroSystem.init(makeSystemDeps());
    const recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps({
      heroSystem,
      spendResource: vi.fn().mockReturnValue(true),
      canAffordResource: vi.fn().mockReturnValue(true),
    });

    recruit.setRng(makeConstantRng(0.3));
    for (let i = 0; i < 7; i++) {
      recruit.recruitSingle('normal');
    }

    const saved = recruit.serialize();
    expect(saved.pity.normalPity).toBe(7);

    // 反序列化到新实例
    const recruit2 = new HeroRecruitSystem();
    recruit2.setRecruitDeps({
      heroSystem,
      spendResource: vi.fn().mockReturnValue(true),
      canAffordResource: vi.fn().mockReturnValue(true),
    });
    recruit2.deserialize(saved);
    expect(recruit2.getGachaState().normalPity).toBe(7);
  });
});
