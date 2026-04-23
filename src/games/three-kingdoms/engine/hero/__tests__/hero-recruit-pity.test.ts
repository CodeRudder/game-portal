/**
 * HeroRecruitSystem 单元测试 — 保底机制部分
 * 覆盖：保底机制、序列化/反序列化保底计数器、注入确定性 RNG
 *
 * 设计规格（hero-system-design.md §2.4）：
 * - 十连保底：10抽必出稀有+
 * - 硬保底：50抽必出史诗+
 * - 优先级：硬保底 > 十连保底 > 随机品质
 *
 * 注意：GENERAL_DEFS 包含 COMMON/FINE/RARE/EPIC/LEGENDARY 全品质武将。
 * COMMON/FINE 抽到时不会降级。
 */

import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps, PityState } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import {
  RECRUIT_SAVE_VERSION,
} from '../hero-recruit-config';
import { DUPLICATE_FRAGMENT_COUNT } from '../hero-config';

// ── 辅助 ──

/** 创建 mock 资源系统（无限资源） */
function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: jest.fn().mockReturnValue(true),
    canAffordResource: jest.fn().mockReturnValue(true),
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

// ═══════════════════════════════════════════════════════════════
describe('HeroRecruitSystem — 保底机制', () => {
  let heroSystem: HeroSystem;
  let recruit: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps(makeRichDeps(heroSystem));
  });

  // ───────────────────────────────────────────
  // 1. 保底机制
  // ───────────────────────────────────────────
  describe('保底机制', () => {
    it('每次招募保底计数 +1', () => {
      // P0-1 修复后：Normal COMMON=0.60, FINE=0.30, RARE=0.08
      // rng=0.93 → 0.90 <= 0.93 < 0.98 命中 RARE
      // RARE >= RARE → tenPullPity 重置为 0
      // RARE < LEGENDARY → hardPity 不重置，保持 1
      const rng = makeConstantRng(0.93);
      recruit.setRng(rng);
      recruit.recruitSingle('normal');
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.normalHardPity).toBe(1);
    });

    it('出 EPIC 品质重置十连保底但不重置硬保底', () => {
      // P0-1 修复后：Normal EPIC 区间 [0.98, 1.00)
      // rng=0.985 → EPIC in normal
      // EPIC >= RARE → 重置 tenPullPity
      // EPIC < LEGENDARY → 不重置 hardPity
      const rng = makeConstantRng(0.985);
      recruit.setRng(rng);
      recruit.recruitSingle('normal');
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.normalHardPity).toBe(1);
    });

    it('10连保底：第10次必出稀有+', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });

      const rng = makeConstantRng(0.3); // COMMON → 保底提升到 RARE+
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.RARE],
      );
    });

    it('硬保底：第100次必出传说+', () => {
      // P0-1 修复后：100抽保底 LEGENDARY+
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 99, advancedHardPity: 0 },
      });

      // 第100次保底应提升到 LEGENDARY+
      const rng = makeConstantRng(0.93); // RARE in normal → 保底提升到 LEGENDARY+
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.LEGENDARY],
      );
    });

    it('普通和高级招募保底独立计数', () => {
      // P0-1 修复后概率：
      // Normal: COMMON=0.60, FINE=0.30, RARE=0.08, EPIC=0.02, LEGENDARY=0.00
      // Advanced: COMMON=0.20, FINE=0.40, RARE=0.25, EPIC=0.13, LEGENDARY=0.02
      // EPIC in normal: rng=0.985 → 0.98 <= 0.985 < 1.00 命中 EPIC
      const epicRng = makeConstantRng(0.985);
      recruit.setRng(epicRng);
      recruit.recruitSingle('normal');
      // RARE in advanced: rng=0.70 → 0.60 <= 0.70 < 0.85 命中 RARE
      const rareAdvRng = makeConstantRng(0.70);
      recruit.setRng(rareAdvRng);
      recruit.recruitSingle('advanced');
      const pity = recruit.getGachaState();
      // normal EPIC 重置了 normalPity（EPIC >= RARE），不重置 normalHardPity（EPIC < LEGENDARY）
      expect(pity.normalPity).toBe(0);
      expect(pity.normalHardPity).toBe(1);
      // advanced RARE 重置了 advancedPity（RARE >= RARE），不重置 advancedHardPity（RARE < LEGENDARY）
      expect(pity.advancedPity).toBe(0);
      expect(pity.advancedHardPity).toBe(1);
    });

    it('getNextTenPullPity 返回剩余次数', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 5, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });
      expect(recruit.getNextTenPullPity('normal')).toBe(5);
    });

    it('getNextHardPity 返回剩余次数', () => {
      // P0-2 修复后：hardPityThreshold=100
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 20, advancedHardPity: 0 },
      });
      expect(recruit.getNextHardPity('normal')).toBe(80);
    });

    it('保底计数器在多次 RARE 抽取后 hardPity 递增', () => {
      const rng = makeConstantRng(0.93); // RARE in normal (P0-1 fix: 0.90-0.98)
      recruit.setRng(rng);
      for (let i = 0; i < 3; i++) {
        recruit.recruitSingle('normal');
      }
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.normalHardPity).toBe(3);
    });
  });

  // ───────────────────────────────────────────
  // 2. 序列化/反序列化保底计数器
  // ───────────────────────────────────────────
  describe('序列化/反序列化', () => {
    it('serialize 返回正确版本号', () => {
      const data = recruit.serialize();
      expect(data.version).toBe(RECRUIT_SAVE_VERSION);
    });

    it('serialize 包含保底计数器', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 5, advancedPity: 3, normalHardPity: 10, advancedHardPity: 7 },
      });
      const data = recruit.serialize();
      expect(data.pity.normalPity).toBe(5);
      expect(data.pity.advancedPity).toBe(3);
    });

    it('往返一致性', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 5, advancedPity: 3, normalHardPity: 10, advancedHardPity: 7 },
      });

      const saved = recruit.serialize();
      const recruit2 = new HeroRecruitSystem();
      recruit2.deserialize(saved);
      const restored = recruit2.serialize();

      expect(restored.version).toBe(saved.version);
      expect(restored.pity).toEqual(saved.pity);
    });

    it('版本不匹配时打印警告', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      recruit.deserialize({
        version: 999,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
      });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('反序列化恢复保底计数器后招募继续计数', () => {
      // P0-1 修复后：hardPityThreshold=100, hardPityMinQuality=LEGENDARY
      // 设置 normalHardPity=98，再抽2次应触发硬保底
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 98, advancedHardPity: 0 },
      });

      // 抽一次 RARE → hardPity=99 (rng=0.93 → RARE in normal)
      const rng = makeConstantRng(0.93);
      recruit.setRng(rng);
      recruit.recruitSingle('normal');
      expect(recruit.getGachaState().normalHardPity).toBe(99);

      // 再抽一次 → hardPity 达到 100，保底提升到 LEGENDARY
      recruit.setRng(rng);
      const result = recruit.recruitSingle('normal')!;
      expect(QUALITY_ORDER[result.results[0].quality]).toBeGreaterThanOrEqual(
        QUALITY_ORDER[Quality.LEGENDARY],
      );
    });

    it('反序列化缺失字段时使用默认值 0', () => {
      recruit.deserialize({
        version: RECRUIT_SAVE_VERSION,
        pity: {} as PityState,
      });
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
    });
  });

  // ───────────────────────────────────────────
  // 3. 注入确定性 RNG
  // ───────────────────────────────────────────
  describe('注入确定性 RNG', () => {
    it('构造函数注入 RNG', () => {
      // P0-1 修复后：Normal RARE 区间 [0.90, 0.98)
      const rng = makeConstantRng(0.93); // RARE
      const r = new HeroRecruitSystem(rng);
      r.setRecruitDeps(makeRichDeps(heroSystem));
      const result = r.recruitSingle('normal')!;
      expect(result.results[0].quality).toBe(Quality.RARE);
    });

    it('setRng 运行时替换 RNG', () => {
      // P0-1 修复后：Normal RARE 区间 [0.90, 0.98)
      recruit.setRng(makeConstantRng(0.93)); // RARE
      const r1 = recruit.recruitSingle('normal')!;
      expect(r1.results[0].quality).toBe(Quality.RARE);

      // P0-1 修复后：Advanced LEGENDARY 区间 [0.98, 1.00)
      recruit.setRng(makeConstantRng(0.99));
      const r2 = recruit.recruitSingle('advanced')!;
      expect(r2.results[0].quality).toBe(Quality.LEGENDARY);
    });

    it('多次招募使用序列 RNG', () => {
      // 每次 pull 消耗 2 次 rng（rollQuality + pickGeneralByQuality）
      // P0-1 修复后概率：
      // Normal: COMMON=0.60, FINE=0.30, RARE=0.08, EPIC=0.02, LEGENDARY=0.00
      const values = [
        0.93, 0.5,   // pull 1: quality=RARE, pick dianwei
        0.985, 0.5,  // pull 2: quality=EPIC, pick one of EPIC generals
        0.93, 0.5,   // pull 3: quality=RARE, pick dianwei (duplicate)
      ];
      const rng = makeSequenceRng(values);
      recruit.setRng(rng);

      const results: Quality[] = [];
      for (let i = 0; i < 3; i++) {
        const r = recruit.recruitSingle('normal')!;
        results.push(r.results[0].quality);
      }

      expect(results[0]).toBe(Quality.RARE);
      expect(results[1]).toBe(Quality.EPIC);
      expect(results[2]).toBe(Quality.RARE);
    });
  });
});
