import { vi } from 'vitest';
/**
 * HeroRecruitSystem 边界测试 — 空池、无资源、保底重置、降级选择
 * 覆盖：极端场景、保底计数器边界、资源不足、序列化边界
 */

import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps, PityState } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import {
  RECRUIT_SAVE_VERSION,
  TEN_PULL_DISCOUNT,
} from '../hero-recruit-config';
import type { RecruitType } from '../hero-recruit-config';
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

// ═══════════════════════════════════════════════════════════════
describe('HeroRecruitSystem — 边界测试', () => {
  let heroSystem: HeroSystem;
  let recruit: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps(makeRichDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. 空池/降级场景
  // ───────────────────────────────────────────
  describe('空池/降级场景', () => {
    it('所有品质均有武将定义，不触发降级', () => {
      // GENERAL_DEFS 中 COMMON/FINE/RARE/EPIC/LEGENDARY 均有武将
      const rng = makeConstantRng(0.3); // COMMON
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].quality).toBe(Quality.COMMON);
    });

    it('FINE 品质有武将可直接抽取', () => {
      // normal: 0.60+0.25=0.85, rng=0.70 → FINE
      const rng = makeConstantRng(0.70);
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].quality).toBe(Quality.FINE);
    });

    it('十连招募结果包含多个武将', () => {
      const result = recruit.recruitTen('normal')!;
      const names = result.results.map((r) => r.general?.name).filter(Boolean);
      // 10 次招募应该有结果
      expect(names.length).toBe(10);
    });

    it('十连高级招募结果包含正确数量', () => {
      const result = recruit.recruitTen('advanced')!;
      expect(result.results).toHaveLength(10);
      expect(result.cost.resourceType).toBe('recruitToken');
    });
  });

  // ───────────────────────────────────────────
  // 2. 无资源场景
  // ───────────────────────────────────────────
  describe('无资源场景', () => {
    it('canAffordResource 返回 false 时 canRecruit 返回 false', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.canRecruit('normal', 1)).toBe(false);
      expect(recruit.canRecruit('advanced', 1)).toBe(false);
    });

    it('canRecruit 十连检查资源', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.canRecruit('normal', 10)).toBe(false);
    });

    it('spendResource 返回 false 时十连返回 null', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.recruitTen('normal')).toBeNull();
    });

    it('资源不足时保底计数器不变', () => {
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      recruit.recruitSingle('normal');
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
    });

    it('canAfford 返回 true 但 spend 返回 false 时招募失败', () => {
      const deps = makeRichDeps(heroSystem);
      deps.spendResource = vi.fn().mockReturnValue(false);
      deps.canAffordResource = vi.fn().mockReturnValue(true);
      recruit.setRecruitDeps(deps);
      expect(recruit.recruitSingle('normal')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 3. 保底重置边界
  // ───────────────────────────────────────────
  describe('保底重置边界', () => {
    it('tenPullPity 达到 9 时下次触发十连保底', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });
      // 抽一次 COMMON（有武将不降级）
      const rng = makeConstantRng(0.3); // COMMON
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      // COMMON < RARE → 十连保底应提升品质到 RARE+
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.RARE],
      );
    });

    it('hardPity 达到 49 时下次触发硬保底', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 49, advancedHardPity: 0 },
      });
      const rng = makeConstantRng(0.88); // RARE
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      // 硬保底应提升到 EPIC+
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.EPIC],
      );
    });

    it('保底触发后计数器重置为 0', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });
      const rng = makeConstantRng(0.3); // COMMON → 保底提升
      recruit.setRng(rng);
      recruit.recruitSingle('normal');
      const pity = recruit.getGachaState();
      // 保底提升到 RARE+ 后 normalPity 重置
      expect(pity.normalPity).toBe(0);
    });

    it('高级招募保底独立于普通招募', () => {
      // 设置普通保底计数器
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 5, advancedPity: 3, normalHardPity: 10, advancedHardPity: 7 },
      });

      // 普通招募不影响高级保底
      const rng = makeConstantRng(0.88); // RARE
      recruit.setRng(rng);
      recruit.recruitSingle('normal');

      const pity = recruit.getGachaState();
      // 高级保底应保持不变
      expect(pity.advancedHardPity).toBe(7);
    });

    it('getNextTenPullPity 返回正确的剩余次数', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 7, advancedPity: 2, normalHardPity: 0, advancedHardPity: 0 },
      });
      expect(recruit.getNextTenPullPity('normal')).toBe(3);
      expect(recruit.getNextTenPullPity('advanced')).toBe(8);
    });

    it('getNextHardPity 返回正确的剩余次数', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 30, advancedHardPity: 45 },
      });
      expect(recruit.getNextHardPity('normal')).toBe(20);
      expect(recruit.getNextHardPity('advanced')).toBe(5);
    });
  });

  // ───────────────────────────────────────────
  // 4. 消耗计算边界
  // ───────────────────────────────────────────
  describe('消耗计算边界', () => {
    it('十连折扣正确计算', () => {
      const cost = recruit.getRecruitCost('normal', 10);
      expect(cost.amount).toBe(Math.floor(100 * 10 * TEN_PULL_DISCOUNT));
    });

    it('高级招募十连消耗 = 10 × 1 × 折扣', () => {
      const cost = recruit.getRecruitCost('advanced', 10);
      expect(cost.amount).toBe(Math.floor(1 * 10 * TEN_PULL_DISCOUNT));
    });

    it('单抽消耗无折扣', () => {
      const cost = recruit.getRecruitCost('normal', 1);
      expect(cost.amount).toBe(100);
    });

    it('招募输出记录正确的消耗', () => {
      const result = recruit.recruitTen('normal')!;
      expect(result.cost.amount).toBe(Math.floor(100 * 10 * TEN_PULL_DISCOUNT));
      expect(result.cost.resourceType).toBe('gold');
    });
  });

  // ───────────────────────────────────────────
  // 5. 序列化边界
  // ───────────────────────────────────────────
  describe('序列化边界', () => {
    it('多次序列化结果一致', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 5, advancedPity: 3, normalHardPity: 10, advancedHardPity: 7 },
      });
      const data1 = recruit.serialize();
      const data2 = recruit.serialize();
      expect(data1).toEqual(data2);
    });

    it('反序列化空保底数据使用默认值', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: {} as PityState,
      });
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
      expect(pity.normalHardPity).toBe(0);
      expect(pity.advancedHardPity).toBe(0);
    });

    it('reset 后保底计数器归零', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 8, normalHardPity: 49, advancedHardPity: 30 },
      });
      recruit.reset();
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
      expect(pity.normalHardPity).toBe(0);
      expect(pity.advancedHardPity).toBe(0);
    });
  });
});
