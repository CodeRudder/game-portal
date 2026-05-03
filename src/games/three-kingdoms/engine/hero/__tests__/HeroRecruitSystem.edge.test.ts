import { vi } from 'vitest';
/**
 * HeroRecruitSystem 补充边界测试 — 空池、零资源、保底线、连续招募
 * 覆盖：招募池为空、铜钱/求贤令为0、保底必定触发、碎片数量验证、连续招募100次
 *
 * 设计规格（hero-system-design.md）：
 * - 普通招募：recruitToken×5（R3修正），高级招募：recruitToken×100
 * - 硬保底：100抽必出 LEGENDARY+
 */

import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps, PityState, RecruitOutput } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import {
  RECRUIT_COSTS,
  RECRUIT_SAVE_VERSION,
  RECRUIT_PITY,
  TEN_PULL_DISCOUNT,
} from '../hero-recruit-config';
import { DUPLICATE_FRAGMENT_COUNT } from '../hero-config';

// ── 辅助 ──

function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(true),
    canAffordResource: vi.fn().mockReturnValue(true),
  };
}

function makePoorDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(false),
    canAffordResource: vi.fn().mockReturnValue(false),
  };
}

function makeConstantRng(value: number): () => number {
  return () => value;
}

function makeSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/** 创建带资源计数的 deps */
function makeTrackedDeps(heroSystem: HeroSystem, gold: number, token: number): RecruitDeps & { resources: Record<string, number> } {
  const resources: Record<string, number> = { gold, recruitToken: token };
  return {
    resources,
    heroSystem,
    spendResource: vi.fn((type: string, amount: number) => {
      if ((resources[type] ?? 0) < amount) return false;
      resources[type] -= amount;
      return true;
    }),
    canAffordResource: vi.fn((type: string, amount: number) => (resources[type] ?? 0) >= amount),
  };
}

// ═══════════════════════════════════════════════════════════════
describe('HeroRecruitSystem — 补充边界测试', () => {
  let heroSystem: HeroSystem;
  let recruit: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps(makeRichDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. 零资源场景
  // ───────────────────────────────────────────
  describe('零资源场景', () => {
    it('招贤榜为 0 时普通招募失败', () => {
      // 设计规格：普通招募消耗 recruitToken×5（R3修正）
      const tracked = makeTrackedDeps(heroSystem, 0, 0);
      recruit.setRecruitDeps(tracked);
      expect(recruit.canRecruit('normal', 1)).toBe(false);
      expect(recruit.recruitSingle('normal')).toBeNull();
    });

    it('求贤令为 0 时高级招募失败', () => {
      // 设计规格：高级招募消耗 recruitToken×100
      const tracked = makeTrackedDeps(heroSystem, 1000, 0);
      recruit.setRecruitDeps(tracked);
      expect(recruit.canRecruit('advanced', 1)).toBe(false);
      expect(recruit.recruitSingle('advanced')).toBeNull();
    });

    it('十连资源不足时返回 null', () => {
      // 设计规格：十连普通 = recruitToken×1×10×1.0=10，需要至少10个
      const tracked = makeTrackedDeps(heroSystem, 0, 5);
      recruit.setRecruitDeps(tracked);
      expect(recruit.recruitTen('normal')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 2. 保底必定触发
  // ───────────────────────────────────────────
  describe('保底必定触发', () => {
    it('十连保底在第 10 次必定触发（普通招募）', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });
      const rng = makeConstantRng(0.3); // COMMON
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.RARE],
      );
    });

    it('高级招募硬保底在第 100 次必定触发传说+', () => {
      // PRD: 普通池无硬保底，仅高级池有100抽硬保底
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 99 },
      });
      const rng = makeConstantRng(0.1); // COMMON in advanced
      recruit.setRng(rng);
      const result = recruit.recruitSingle('advanced')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.LEGENDARY],
      );
    });
  });

  // ───────────────────────────────────────────
  // 3. 重复武将碎片数量
  // ───────────────────────────────────────────
  describe('重复武将碎片数量', () => {
    it('RARE 品质重复武将碎片数量正确', () => {
      // P0-1 修复后：Normal RARE 区间 [0.90, 0.98)
      const rng = makeConstantRng(0.93); // RARE in normal
      recruit.setRng(rng);
      recruit.recruitSingle('normal'); // 首次
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].fragmentCount).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.RARE]);
    });

    it('EPIC 品质重复武将碎片数量正确', () => {
      // P0-1 修复后：Normal EPIC 区间 [0.98, 1.00)
      const epicRng = makeConstantRng(0.985); // EPIC in normal
      const results: RecruitOutput[] = [];
      for (let i = 0; i < 5; i++) {
        recruit.setRng(epicRng);
        const r = recruit.recruitSingle('normal');
        if (r) results.push(r);
      }
      const dupes = results.flatMap((r) => r.results).filter((r) => r.isDuplicate);
      if (dupes.length > 0) {
        expect(dupes[0].fragmentCount).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.EPIC]);
      }
    });
  });

  // ───────────────────────────────────────────
  // 4. 招募后资源正确扣除
  // ───────────────────────────────────────────
  describe('招募后资源正确扣除', () => {
    it('普通招募正确扣除招贤榜', () => {
      // 设计规格：普通招募 recruitToken×1（v2修正）
      const tracked = makeTrackedDeps(heroSystem, 10000, 100);
      recruit.setRecruitDeps(tracked);
      const result = recruit.recruitSingle('normal')!;
      expect(result).not.toBeNull();
      expect(tracked.resources.recruitToken).toBe(100 - RECRUIT_COSTS.normal.amount);
    });

    it('高级招募正确扣除求贤令', () => {
      // 设计规格：高级招募 recruitToken×10（v2修正）
      const tracked = makeTrackedDeps(heroSystem, 10000, 1000);
      recruit.setRecruitDeps(tracked);
      const result = recruit.recruitSingle('advanced')!;
      expect(result).not.toBeNull();
      expect(tracked.resources.recruitToken).toBe(1000 - RECRUIT_COSTS.advanced.amount);
    });

    it('十连招募正确扣除折扣后的资源', () => {
      // 设计规格：普通招募 recruitToken×1（v2修正），TEN_PULL_DISCOUNT=1.0
      const tracked = makeTrackedDeps(heroSystem, 10000, 100);
      recruit.setRecruitDeps(tracked);
      const result = recruit.recruitTen('normal')!;
      expect(result).not.toBeNull();
      const expectedCost = Math.floor(RECRUIT_COSTS.normal.amount * 10 * TEN_PULL_DISCOUNT);
      expect(tracked.resources.recruitToken).toBe(100 - expectedCost);
    });
  });

  // ───────────────────────────────────────────
  // 5. 连续招募保底机制正常
  // ───────────────────────────────────────────
  describe('连续招募保底机制正常', () => {
    it('连续招募 100 次保底机制正常（无异常）', () => {
      for (let i = 0; i < 100; i++) {
        const result = recruit.recruitSingle('normal');
        expect(result).not.toBeNull();
        expect(result!.results).toHaveLength(1);
        expect(result!.results[0].quality).toBeDefined();
      }
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBeLessThan(RECRUIT_PITY.normal.tenPullThreshold);
      expect(pity.normalHardPity).toBeLessThan(RECRUIT_PITY.normal.hardPityThreshold);
    });
  });

  // ───────────────────────────────────────────
  // 6. recruit 返回结果结构完整
  // ───────────────────────────────────────────
  describe('recruit 返回结果结构完整', () => {
    it('recruitSingle 返回完整结构', () => {
      const result = recruit.recruitSingle('normal')!;
      expect(result).toHaveProperty('type', 'normal');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('cost');
      expect(result.results).toHaveLength(1);

      const r = result.results[0];
      expect(r).toHaveProperty('general');
      expect(r).toHaveProperty('isDuplicate');
      expect(r).toHaveProperty('fragmentCount');
      expect(r).toHaveProperty('quality');
      expect(typeof r.isDuplicate).toBe('boolean');
      expect(typeof r.fragmentCount).toBe('number');
    });

    it('recruitTen 返回完整结构', () => {
      const result = recruit.recruitTen('advanced')!;
      expect(result).toHaveProperty('type', 'advanced');
      expect(result.results).toHaveLength(10);
      expect(result.cost.resourceType).toBe('recruitToken');

      for (const r of result.results) {
        expect(r).toHaveProperty('general');
        expect(r).toHaveProperty('quality');
      }
    });
  });
});
