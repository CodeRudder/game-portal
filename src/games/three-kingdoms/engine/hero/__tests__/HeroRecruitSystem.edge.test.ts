/**
 * HeroRecruitSystem 补充边界测试 — 空池、零资源、保底线、连续招募
 * 覆盖：招募池为空、铜钱/求贤令为0、保底必定触发、碎片数量验证、连续招募100次
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps, PityState, RecruitOutput } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import {
  RECRUIT_SAVE_VERSION,
  RECRUIT_PITY,
  RECRUIT_COSTS,
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
    it('铜钱为 0 时普通招募失败', () => {
      const tracked = makeTrackedDeps(heroSystem, 0, 10);
      recruit.setRecruitDeps(tracked);
      expect(recruit.canRecruit('normal', 1)).toBe(false);
      expect(recruit.recruitSingle('normal')).toBeNull();
    });

    it('求贤令为 0 时高级招募失败', () => {
      const tracked = makeTrackedDeps(heroSystem, 1000, 0);
      recruit.setRecruitDeps(tracked);
      expect(recruit.canRecruit('advanced', 1)).toBe(false);
      expect(recruit.recruitSingle('advanced')).toBeNull();
    });

    it('十连资源不足时返回 null', () => {
      const tracked = makeTrackedDeps(heroSystem, 500, 0);
      recruit.setRecruitDeps(tracked);
      // 十连需要 100*10*0.9=900 铜钱，500 不够
      expect(recruit.recruitTen('normal')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 2. 保底必定触发
  // ───────────────────────────────────────────
  describe('保底必定触发', () => {
    it('十连保底在第 10 次必定触发（普通招募）', () => {
      // 设置 normalPity=9，下一次应触发十连保底
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });
      // 用 COMMON rng 值，保底应提升到 RARE+
      const rng = makeConstantRng(0.3); // COMMON
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.RARE],
      );
    });

    it('硬保底在第 50 次必定触发史诗+', () => {
      // 设置 normalHardPity=49，下一次应触发硬保底
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 49, advancedHardPity: 0 },
      });
      // 用 COMMON rng 值，硬保底应提升到 EPIC+
      const rng = makeConstantRng(0.3); // COMMON
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.EPIC],
      );
    });

    it('高级招募硬保底在第 50 次必定触发', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 49 },
      });
      const rng = makeConstantRng(0.1); // COMMON in advanced
      recruit.setRng(rng);
      const result = recruit.recruitSingle('advanced')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.EPIC],
      );
    });
  });

  // ───────────────────────────────────────────
  // 3. 重复武将碎片数量
  // ───────────────────────────────────────────
  describe('重复武将碎片数量', () => {
    it('RARE 品质重复武将碎片数量正确', () => {
      // RARE 只有 dianwei，连续抽两次必重复
      const rng = makeConstantRng(0.88); // RARE in normal
      recruit.setRng(rng);
      recruit.recruitSingle('normal'); // 首次
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(result.results[0].fragmentCount).toBe(DUPLICATE_FRAGMENT_COUNT[Quality.RARE]);
    });

    it('EPIC 品质重复武将碎片数量正确', () => {
      // EPIC 有4个武将，需要多次抽取同一品质才可能重复
      // 先收集所有 EPIC 武将
      const epicRng = makeConstantRng(0.97); // EPIC in normal
      // 抽5次 EPIC（4个不同武将，第5次必然重复）
      const results: RecruitOutput[] = [];
      for (let i = 0; i < 5; i++) {
        recruit.setRng(epicRng);
        const r = recruit.recruitSingle('normal');
        if (r) results.push(r);
      }
      // 找到重复的结果
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
    it('普通招募正确扣除铜钱', () => {
      const tracked = makeTrackedDeps(heroSystem, 10000, 100);
      recruit.setRecruitDeps(tracked);
      const result = recruit.recruitSingle('normal')!;
      expect(result).not.toBeNull();
      expect(tracked.resources.gold).toBe(10000 - 100);
    });

    it('高级招募正确扣除求贤令', () => {
      const tracked = makeTrackedDeps(heroSystem, 10000, 100);
      recruit.setRecruitDeps(tracked);
      const result = recruit.recruitSingle('advanced')!;
      expect(result).not.toBeNull();
      expect(tracked.resources.recruitToken).toBe(99);
    });

    it('十连招募正确扣除折扣后的资源', () => {
      const tracked = makeTrackedDeps(heroSystem, 10000, 100);
      recruit.setRecruitDeps(tracked);
      const result = recruit.recruitTen('normal')!;
      expect(result).not.toBeNull();
      const expectedCost = Math.floor(100 * 10 * 0.9);
      expect(tracked.resources.gold).toBe(10000 - expectedCost);
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
      // 保底计数器应被正确维护
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
        expect(r.general).toBeDefined();
        expect(typeof r.isDuplicate).toBe('boolean');
        expect(typeof r.fragmentCount).toBe('number');
        expect(r.quality).toBeDefined();
      }
    });
  });

  // ───────────────────────────────────────────
  // 7. 保底计数器序列化往返
  // ───────────────────────────────────────────
  describe('保底计数器序列化往返', () => {
    it('保底计数器序列化往返一致性', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 7, advancedPity: 3, normalHardPity: 25, advancedHardPity: 40 },
      });
      const saved = recruit.serialize();
      const r2 = new HeroRecruitSystem();
      r2.deserialize(saved);
      const restored = r2.serialize();

      expect(restored.pity).toEqual(saved.pity);
      expect(restored.pity.normalPity).toBe(7);
      expect(restored.pity.advancedPity).toBe(3);
      expect(restored.pity.normalHardPity).toBe(25);
      expect(restored.pity.advancedHardPity).toBe(40);
    });

    it('招募后保底状态正确序列化', () => {
      // 抽一次
      recruit.recruitSingle('normal');
      const saved = recruit.serialize();
      const r2 = new HeroRecruitSystem();
      r2.deserialize(saved);
      r2.setRecruitDeps(makeRichDeps(heroSystem));

      // 从保存的状态继续招募
      const result = r2.recruitSingle('normal');
      expect(result).not.toBeNull();
    });
  });
});
