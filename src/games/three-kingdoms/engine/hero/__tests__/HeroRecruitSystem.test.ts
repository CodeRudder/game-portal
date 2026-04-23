import { vi } from 'vitest';
/**
 * HeroRecruitSystem 单元测试 — 核心部分
 * 覆盖：初始化、单抽/十连、概率分布、重复武将处理、资源不足、消耗计算、reset、ISubsystem 接口
 *
 * GENERAL_DEFS 中品质分布：
 * - COMMON: minbingduizhang, xiangyongtoumu (2个)
 * - FINE: junshou, xiaowei (2个)
 * - RARE: dianwei (1个)
 * - EPIC: liubei, zhangfei, simayi, zhouyu (4个)
 * - LEGENDARY: guanyu, zhugeliang, zhaoyun, caocao, lvbu (5个)
 *
 * 所有品质均有武将定义，不再有降级逻辑。
 */

import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitOutput, RecruitDeps, PityState } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import {
  RECRUIT_COSTS,
  TEN_PULL_DISCOUNT,
  RECRUIT_RATES,
  RECRUIT_PITY,
  RECRUIT_SAVE_VERSION,
  NORMAL_RATES,
  ADVANCED_RATES,
} from '../hero-recruit-config';
import type { RecruitType } from '../hero-recruit-config';
import { DUPLICATE_FRAGMENT_COUNT } from '../hero-config';

// ── 辅助 ──

/** 创建 mock 资源系统（无限资源） */
function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(true),
    canAffordResource: vi.fn().mockReturnValue(true),
  };
}

/** 创建 mock 资源系统（无资源） */
function makePoorDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(false),
    canAffordResource: vi.fn().mockReturnValue(false),
  };
}

/** 创建始终返回指定值的 RNG */
function makeConstantRng(value: number): () => number {
  return () => value;
}

/** 创建确定性 RNG（返回固定序列，循环） */
function makeSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/**
 * GENERAL_DEFS 中品质分布：
 * - COMMON: minbingduizhang(shu), xiangyongtoumu(wu) (2个)
 * - FINE: junshou(wei), xiaowei(qun) (2个)
 * - RARE: dianwei(wei) (1个)
 * - EPIC: liubei(shu), zhangfei(shu), simayi(wei), zhouyu(wu) (4个)
 * - LEGENDARY: guanyu(shu), zhugeliang(shu), zhaoyun(shu), caocao(wei), lvbu(qun) (5个)
 *
 * 所有品质均有武将，COMMON/FINE 不再降级。
 */

// ═══════════════════════════════════════════════════════════════
describe('HeroRecruitSystem', () => {
  let heroSystem: HeroSystem;
  let recruit: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps(makeRichDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. 基础属性与初始化
  // ───────────────────────────────────────────
  describe('初始化', () => {
    it('ISubsystem.name 为 heroRecruit', () => {
      expect(recruit.name).toBe('heroRecruit');
    });

    it('初始保底计数器全为 0', () => {
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
      expect(pity.normalHardPity).toBe(0);
      expect(pity.advancedHardPity).toBe(0);
    });

    it('未设置依赖时 canRecruit 返回 false', () => {
      const r = new HeroRecruitSystem();
      expect(r.canRecruit('normal', 1)).toBe(false);
    });

    it('未设置依赖时 recruitSingle 返回 null', () => {
      const r = new HeroRecruitSystem();
      expect(r.recruitSingle('normal')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 2. 单抽和十连
  // ───────────────────────────────────────────
  describe('单抽和十连', () => {
    it('单抽返回 1 个结果', () => {
      const result = recruit.recruitSingle('normal');
      expect(result).not.toBeNull();
      expect(result!.results).toHaveLength(1);
    });

    it('十连返回 10 个结果', () => {
      const result = recruit.recruitTen('advanced');
      expect(result).not.toBeNull();
      expect(result!.results).toHaveLength(10);
    });

    it('单抽结果包含正确字段', () => {
      const result = recruit.recruitSingle('normal')!;
      const r = result.results[0];
      expect(r).toHaveProperty('general');
      expect(r).toHaveProperty('isDuplicate');
      expect(r).toHaveProperty('fragmentCount');
      expect(r).toHaveProperty('quality');
    });

    it('招募消耗正确记录', () => {
      // 设计规格：普通招募 recruitToken×1
      const result = recruit.recruitSingle('normal')!;
      expect(result.cost.resourceType).toBe('recruitToken');
      expect(result.cost.amount).toBe(1);
    });

    it('十连消耗 = 10 × 单价 × 折扣', () => {
      // 设计规格：普通招募 recruitToken×1，TEN_PULL_DISCOUNT=1.0
      const result = recruit.recruitTen('normal')!;
      expect(result.cost.amount).toBe(Math.floor(1 * 10 * TEN_PULL_DISCOUNT));
    });

    it('高级招募消耗求贤令', () => {
      // 设计规格：高级招募 recruitToken×100
      const result = recruit.recruitSingle('advanced')!;
      expect(result.cost.resourceType).toBe('recruitToken');
      expect(result.cost.amount).toBe(100);
    });

    it('招募类型正确记录', () => {
      expect(recruit.recruitSingle('normal')!.type).toBe('normal');
      expect(recruit.recruitSingle('advanced')!.type).toBe('advanced');
    });
  });

  // ───────────────────────────────────────────
  // 3. 招募概率分布
  // ───────────────────────────────────────────
  describe('招募概率分布', () => {
    it('普通招募概率总和为 1', () => {
      const sum = NORMAL_RATES.reduce((s, r) => s + r.rate, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('高级招募概率总和为 1', () => {
      const sum = ADVANCED_RATES.reduce((s, r) => s + r.rate, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('确定性 RNG 抽到 COMMON 品质（普通招募）', () => {
      // COMMON 有武将，不再降级
      const rng = makeConstantRng(0.3);
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].quality).toBe(Quality.COMMON);
    });

    it('确定性 RNG 抽到 EPIC 品质（普通招募）', () => {
      // P0-1 修复后：0.60+0.30+0.08=0.98, rng=0.985 命中 EPIC
      const rng = makeConstantRng(0.985);
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].quality).toBe(Quality.EPIC);
    });

    it('确定性 RNG 抽到 LEGENDARY 品质（高级招募）', () => {
      // P0-1 修复后：0.20+0.40+0.25+0.13=0.98, rng=0.99 命中 LEGENDARY
      const rng = makeConstantRng(0.99);
      recruit.setRng(rng);
      const result = recruit.recruitSingle('advanced')!;
      expect(result.results[0].quality).toBe(Quality.LEGENDARY);
    });

    it('RARE rng 值命中 RARE 品质（普通招募）', () => {
      // P0-1 修复后：0.60+0.30=0.90, rng=0.93 命中 RARE
      const rng = makeConstantRng(0.93);
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].quality).toBe(Quality.RARE);
    });

    it('高级招募 COMMON rng 抽到 COMMON 品质', () => {
      const rng = makeConstantRng(0.1); // COMMON in advanced
      recruit.setRng(rng);
      const result = recruit.recruitSingle('advanced')!;
      // COMMON 有武将，不再降级
      expect(result.results[0].quality).toBe(Quality.COMMON);
    });
  });

  // ───────────────────────────────────────────
  // 4. 重复武将处理
  // ───────────────────────────────────────────
  describe('重复武将处理', () => {
    it('首次招募武将 isDuplicate=false', () => {
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].isDuplicate).toBe(false);
      expect(result.results[0].fragmentCount).toBe(0);
    });

    it('重复招募同一武将 isDuplicate=true（RARE 品质只有1个武将）', () => {
      // P0-1 修复后：Normal RARE 区间 [0.90, 0.98)
      // RARE 品质只有 dianwei，连续抽两次 RARE 必重复
      const rng = makeConstantRng(0.93); // RARE
      recruit.setRng(rng);
      const first = recruit.recruitSingle('normal')!;
      expect(first.results[0].isDuplicate).toBe(false);

      recruit.setRng(rng);
      const second = recruit.recruitSingle('normal')!;
      expect(second.results[0].isDuplicate).toBe(true);
      expect(second.results[0].fragmentCount).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.RARE]);
    });

    it('重复武将碎片数量与品质对应', () => {
      const rng = makeConstantRng(0.93); // RARE (P0-1 fix)
      recruit.setRng(rng);
      recruit.recruitSingle('normal'); // 首次
      recruit.setRng(rng);
      recruit.recruitSingle('normal'); // 重复

      // dianwei 是唯一的 RARE 武将
      expect(heroSystem.getFragments('dianwei')).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.RARE]);
    });

    it('EPIC 品质武将首次招募不重复', () => {
      // P0-1 修复后：Normal EPIC 区间 [0.98, 1.00)
      const rng = makeConstantRng(0.985); // EPIC in normal
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].isDuplicate).toBe(false);
      expect(result.results[0].quality).toBe(Quality.EPIC);
    });

    it('LEGENDARY 品质首次招募不重复', () => {
      const rng = makeConstantRng(0.99); // LEGENDARY in advanced
      recruit.setRng(rng);
      const result = recruit.recruitSingle('advanced')!;
      expect(result.results[0].isDuplicate).toBe(false);
      expect(result.results[0].quality).toBe(Quality.LEGENDARY);
    });
  });

  // ───────────────────────────────────────────
  // 5. 资源不足
  // ───────────────────────────────────────────
  describe('资源不足', () => {
    it('资源不足时单抽返回 null', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.recruitSingle('normal')).toBeNull();
    });

    it('资源不足时十连返回 null', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.recruitTen('advanced')).toBeNull();
    });

    it('canRecruit 检查资源充足', () => {
      expect(recruit.canRecruit('normal', 1)).toBe(true);
    });

    it('canRecruit 资源不足返回 false', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.canRecruit('normal', 1)).toBe(false);
    });

    it('spendResource 失败时招募返回 null', () => {
      const deps = makeRichDeps(heroSystem);
      deps.spendResource = vi.fn().mockReturnValue(false);
      recruit.setRecruitDeps(deps);
      expect(recruit.recruitSingle('normal')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 6. 消耗计算
  // ───────────────────────────────────────────
  describe('消耗计算', () => {
    it('getRecruitCost 单抽普通招募', () => {
      // 设计规格：普通招募 recruitToken×1
      const cost = recruit.getRecruitCost('normal', 1);
      expect(cost.resourceType).toBe('recruitToken');
      expect(cost.amount).toBe(1);
    });

    it('getRecruitCost 单抽高级招募', () => {
      // 设计规格：高级招募 recruitToken×100
      const cost = recruit.getRecruitCost('advanced', 1);
      expect(cost.resourceType).toBe('recruitToken');
      expect(cost.amount).toBe(100);
    });

    it('getRecruitCost 十连普通招募', () => {
      // 设计规格：普通招募 recruitToken×1，TEN_PULL_DISCOUNT=1.0
      const cost = recruit.getRecruitCost('normal', 10);
      expect(cost.amount).toBe(Math.floor(1 * 10 * TEN_PULL_DISCOUNT));
    });
  });

  // ───────────────────────────────────────────
  // 7. reset
  // ───────────────────────────────────────────
  describe('reset', () => {
    it('重置保底计数器', () => {
      // 手动设置保底计数器
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 10, advancedPity: 5, normalHardPity: 20, advancedHardPity: 15 },
        freeRecruit: { usedFreeCount: { normal: 1, advanced: 0 }, lastResetDate: '2026-01-01' },
        upHero: { upGeneralId: null, upRate: 0.5 },
      });
      expect(recruit.getGachaState().normalPity).toBeGreaterThan(0);

      recruit.reset();
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
      expect(pity.normalHardPity).toBe(0);
      expect(pity.advancedHardPity).toBe(0);
    });
  });

  // ───────────────────────────────────────────
  // 8. ISubsystem 接口
  // ───────────────────────────────────────────
  describe('ISubsystem 接口', () => {
    it('getState() 返回 serialize() 结果', () => {
      const state = recruit.getState() as { version: number; pity: PityState };
      expect(state.version).toBe(RECRUIT_SAVE_VERSION);
    });

    it('update() 不抛异常', () => {
      expect(() => recruit.update(16)).not.toThrow();
    });

    it('init() 不抛异常', () => {
      expect(() => recruit.init({ eventBus: null as unknown as Record<string, unknown>, configRegistry: null as unknown as Record<string, unknown> })).not.toThrow();
    });
  });
});
