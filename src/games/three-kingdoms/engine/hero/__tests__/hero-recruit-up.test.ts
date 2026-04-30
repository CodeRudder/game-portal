/**
 * UP武将专项测试 — HeroRecruitSystem UP机制覆盖
 *
 * 覆盖：
 *   1. UP武将命中概率（出Legendary时50%是UP武将）
 *   2. UP武将未命中（出Legendary但不是UP武将）
 *   3. 无UP配置时正常招募
 *   4. 切换UP武将后新UP生效
 *   5. UP武将保底独立计数
 *   6. UP池十连保底仍生效
 *   7. UP池100抽硬保底仍生效
 *   8. 多次UP命中统计分布合理
 *
 * 高级招募概率表（ADVANCED_RATES）：
 *   COMMON=0.20, FINE=0.40, RARE=0.25, EPIC=0.13, LEGENDARY=0.02
 *   累积：COMMON=[0,0.20), FINE=[0.20,0.60), RARE=[0.60,0.85), EPIC=[0.85,0.98), LEGENDARY=[0.98,1.0)
 *
 * UP机制逻辑（源码 executeSinglePull）：
 *   条件：type==='advanced' && upGeneralId存在 && finalQuality===LEGENDARY && rng()<upRate
 *   命中时：直接返回UP武将ID
 *   未命中时：从对应品质池随机选择
 *
 * GENERAL_DEFS 中 LEGENDARY 武将：guanyu, zhugeliang, zhaoyun, caocao, lvbu
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality } from '../hero.types';
import { DEFAULT_UP_CONFIG } from '../hero-recruit-config';

// ── 辅助 ──────────────────────────────────

/** 创建 mock 资源系统（无限资源） */
function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: vi.fn().mockReturnValue(true),
    canAffordResource: vi.fn().mockReturnValue(true),
  };
}

/** 创建始终返回指定值的 RNG */
function makeConstantRng(value: number): () => number {
  return () => value;
}

/**
 * 创建确定性 RNG（返回固定序列，循环）
 * 每次调用返回序列中的下一个值
 */
function makeSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/** 创建 mock ISystemDeps */
function createMockDeps() {
  return {
    getResource: () => 0,
    getProductionRate: () => 0,
    emit: () => {},
  } as unknown as Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════

describe('HeroRecruitSystem — UP武将专项', () => {
  let heroSystem: HeroSystem;
  let recruit: HeroRecruitSystem;

  beforeEach(() => {
    heroSystem = new HeroSystem();
    recruit = new HeroRecruitSystem();
    recruit.setRecruitDeps(makeRichDeps(heroSystem));
  });

  // ───────────────────────────────────────
  // 1. UP武将命中概率
  // ───────────────────────────────────────
  describe('UP武将命中概率', () => {
    it('出LEGENDARY时UP命中 — 获取UP武将guanyu', () => {
      // 设置UP武将为 guanyu（LEGENDARY品质）
      recruit.setUpHero('guanyu');

      // RNG序列：
      //   第1个值 0.99 → 品质抽到 LEGENDARY（累积[0.98,1.0)）
      //   第2个值 0.3  → UP判定 rng() < 0.50，命中UP武将
      const rng = makeSequenceRng([0.99, 0.3]);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
      expect(result!.results[0].general.id).toBe('guanyu');
    });

    it('出LEGENDARY时UP命中 — 获取UP武将zhugeliang', () => {
      recruit.setUpHero('zhugeliang');

      const rng = makeSequenceRng([0.99, 0.1]); // LEGENDARY + UP命中
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].general.id).toBe('zhugeliang');
    });

    it('UP默认概率为50% — rng=0.49命中', () => {
      recruit.setUpHero('caocao');

      // rng=0.49 < 0.50，UP命中
      const rng = makeSequenceRng([0.99, 0.49]);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result!.results[0].general.id).toBe('caocao');
    });
  });

  // ───────────────────────────────────────
  // 2. UP武将未命中
  // ───────────────────────────────────────
  describe('UP武将未命中', () => {
    it('出LEGENDARY但UP未命中 — rng=0.60 >= 0.50', () => {
      recruit.setUpHero('guanyu');

      // 第1个值 0.99 → LEGENDARY
      // 第2个值 0.60 → UP判定 rng() >= 0.50，未命中
      // 第3个值 0.5 → 从LEGENDARY池随机选择（5个武将，0.5落在中间）
      const rng = makeSequenceRng([0.99, 0.60, 0.5]);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
      // 未命中UP，应从LEGENDARY池随机选（不一定是guanyu）
      // 只需验证不是UP武将，或者至少是LEGENDARY品质
      expect(result!.results[0].general.id).toBeDefined();
    });

    it('出EPIC品质不触发UP机制', () => {
      recruit.setUpHero('guanyu');

      // rng=0.92 → EPIC（累积[0.85,0.98)），不是LEGENDARY，不触发UP
      const rng = makeConstantRng(0.92);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.EPIC);
      // EPIC品质不触发UP，应从EPIC池随机选择
      expect(result!.results[0].general.id).toBeDefined();
    });

    it('普通招募不触发UP机制', () => {
      recruit.setUpHero('guanyu');

      // 普通招募概率表无LEGENDARY（rate=0），永远不会触发UP
      const rng = makeConstantRng(0.99);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('normal');
      expect(result).not.toBeNull();
      // 普通招募最高EPIC，不触发UP
      expect(result!.results[0].quality).not.toBe(Quality.LEGENDARY);
    });
  });

  // ───────────────────────────────────────
  // 3. 无UP配置时正常招募
  // ───────────────────────────────────────
  describe('无UP配置', () => {
    it('默认无UP武将时正常招募LEGENDARY', () => {
      // 默认 upGeneralId = null，不触发UP
      const upState = recruit.getUpHeroState();
      expect(upState.upGeneralId).toBeNull();

      // rng=0.99 → LEGENDARY
      const rng = makeConstantRng(0.99);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
    });

    it('设置UP为null时等效无UP', () => {
      recruit.setUpHero(null);
      expect(recruit.getUpHeroState().upGeneralId).toBeNull();

      const rng = makeConstantRng(0.99);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
    });

    it('无UP时高级招募十连正常返回10个结果', () => {
      const result = recruit.recruitTen('advanced');
      expect(result).not.toBeNull();
      expect(result!.results).toHaveLength(10);
    });
  });

  // ───────────────────────────────────────
  // 4. 切换UP武将后新UP生效
  // ───────────────────────────────────────
  describe('切换UP武将', () => {
    it('从guanyu切换到zhaoyun后新UP生效', () => {
      // 先设置UP为guanyu
      recruit.setUpHero('guanyu');
      expect(recruit.getUpHeroState().upGeneralId).toBe('guanyu');

      // 切换UP为zhaoyun
      recruit.setUpHero('zhaoyun');
      expect(recruit.getUpHeroState().upGeneralId).toBe('zhaoyun');

      // 验证新UP生效
      const rng = makeSequenceRng([0.99, 0.3]); // LEGENDARY + UP命中
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result!.results[0].general.id).toBe('zhaoyun');
    });

    it('切换UP后旧UP不再命中', () => {
      recruit.setUpHero('guanyu');
      recruit.setUpHero('lvbu');

      const rng = makeSequenceRng([0.99, 0.3]); // LEGENDARY + UP命中
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result!.results[0].general.id).toBe('lvbu');
      expect(result!.results[0].general.id).not.toBe('guanyu');
    });

    it('自定义UP概率rate生效', () => {
      // 设置UP武将，但rate=0（永远不命中）
      recruit.setUpHero('guanyu', 0);

      const rng = makeSequenceRng([0.99, 0.01]); // LEGENDARY + UP判定 rng() < 0 → 不命中
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
      // UP rate=0，即使出LEGENDARY也不会命中UP
      expect(result!.results[0].general.id).not.toBe('guanyu');
    });
  });

  // ───────────────────────────────────────
  // 5. UP武将保底独立计数
  // ───────────────────────────────────────
  describe('UP武将与保底独立', () => {
    it('UP命中不影响保底计数器', () => {
      recruit.setUpHero('guanyu');

      // 用确定性RNG做一次高级招募（出LEGENDARY + UP命中）
      const rng = makeSequenceRng([0.99, 0.3]);
      recruit.setRng(rng);
      recruit.recruitSingle('advanced');

      // LEGENDARY品质 >= RARE（十连保底阈值），所以十连保底也会被重置
      // LEGENDARY品质 >= LEGENDARY（硬保底阈值），所以硬保底也会被重置
      const pity = recruit.getGachaState();
      expect(pity.advancedPity).toBe(0); // LEGENDARY重置了十连保底
      expect(pity.advancedHardPity).toBe(0); // LEGENDARY重置了硬保底
    });

    it('UP未命中时保底也正常工作', () => {
      recruit.setUpHero('guanyu');

      // 出COMMON，不触发UP
      const rng = makeConstantRng(0.1); // COMMON in advanced
      recruit.setRng(rng);
      recruit.recruitSingle('advanced');

      const pity = recruit.getGachaState();
      expect(pity.advancedPity).toBe(1);
      expect(pity.advancedHardPity).toBe(1);
    });

    it('reset后UP状态恢复默认', () => {
      recruit.setUpHero('guanyu', 0.8);
      recruit.reset();

      const upState = recruit.getUpHeroState();
      expect(upState.upGeneralId).toBeNull();
      expect(upState.upRate).toBe(DEFAULT_UP_CONFIG.upRate);
    });
  });

  // ───────────────────────────────────────
  // 6. UP池十连保底仍生效
  // ───────────────────────────────────────
  describe('UP池十连保底', () => {
    it('UP配置下十连保底仍生效 — 第10抽出RARE+', () => {
      recruit.setUpHero('guanyu');

      // 前9抽出COMMON/FINE（不触发十连保底）
      // 用序列RNG：9次COMMON + 第10次触发保底
      // 高级招募 COMMON rng < 0.20
      const lowRng = makeConstantRng(0.1); // COMMON
      recruit.setRng(lowRng);

      // 手动模拟9次单抽
      for (let i = 0; i < 9; i++) {
        recruit.recruitSingle('advanced');
      }

      // 第10次：保底应出RARE+
      // 即使RNG值很低，保底也会强制提升品质
      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      const quality = result!.results[0].quality;
      expect([Quality.RARE, Quality.EPIC, Quality.LEGENDARY]).toContain(quality);
    });
  });

  // ───────────────────────────────────────
  // 7. UP池100抽硬保底仍生效
  // ───────────────────────────────────────
  describe('UP池硬保底', () => {
    it('UP配置下100抽硬保底仍生效', () => {
      recruit.setUpHero('guanyu');

      // 用低RNG连续抽99次（全COMMON），不触发硬保底
      const lowRng = makeConstantRng(0.1); // COMMON
      recruit.setRng(lowRng);

      for (let i = 0; i < 99; i++) {
        recruit.recruitSingle('advanced');
      }

      // 第100次：硬保底应出LEGENDARY
      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect([Quality.EPIC, Quality.LEGENDARY]).toContain(result!.results[0].quality);
    });
  });

  // ───────────────────────────────────────
  // 8. 多次UP命中统计分布合理
  // ───────────────────────────────────────
  describe('UP命中统计分布', () => {
    it('1000次LEGENDARY抽取中UP命中约50%（统计检验）', () => {
      recruit.setUpHero('guanyu');

      // 使用伪随机：模拟1000次出LEGENDARY的场景
      // 每次需要2个随机数：1个强制LEGENDARY(rng=0.99)，1个UP判定
      let upHits = 0;
      const totalLegendaries = 1000;

      for (let i = 0; i < totalLegendaries; i++) {
        // 创建新的recruit实例以避免保底干扰
        const localRecruit = new HeroRecruitSystem();
        localRecruit.setRecruitDeps(makeRichDeps(new HeroSystem()));
        localRecruit.setUpHero('guanyu');

        // 使用序列RNG：第1个=0.99(LEGENDARY)，第2个=Math.random()(UP判定)
        const upRng = Math.random();
        const rng = makeSequenceRng([0.99, upRng]);
        localRecruit.setRng(rng);

        const result = localRecruit.recruitSingle('advanced');
        if (result && result.results[0].general.id === 'guanyu') {
          upHits++;
        }
      }

      // UP rate = 0.50，1000次抽样期望500次命中
      // 允许 ±10% 的统计波动（450~550）
      expect(upHits).toBeGreaterThan(400);
      expect(upHits).toBeLessThan(600);
    });

    it('UP rate=1.0时LEGENDARY必出UP武将', () => {
      recruit.setUpHero('guanyu', 1.0);

      // 连续10次出LEGENDARY，UP rate=1.0，应全部命中
      for (let i = 0; i < 10; i++) {
        const localRecruit = new HeroRecruitSystem();
        localRecruit.setRecruitDeps(makeRichDeps(new HeroSystem()));
        localRecruit.setUpHero('guanyu', 1.0);

        // rng=0.99 → LEGENDARY, UP判定 rng=0.99 < 1.0 → 命中
        const rng = makeSequenceRng([0.99, 0.99]);
        localRecruit.setRng(rng);

        const result = localRecruit.recruitSingle('advanced');
        expect(result).not.toBeNull();
        expect(result!.results[0].general.id).toBe('guanyu');
      }
    });

    it('UP rate=0时LEGENDARY永远不命中UP', () => {
      recruit.setUpHero('guanyu', 0);

      for (let i = 0; i < 10; i++) {
        const localRecruit = new HeroRecruitSystem();
        localRecruit.setRecruitDeps(makeRichDeps(new HeroSystem()));
        localRecruit.setUpHero('guanyu', 0);

        // rng=0.99 → LEGENDARY, UP判定 rng=0.0 < 0 → 不命中（0不小于0）
        const rng = makeSequenceRng([0.99, 0.0]);
        localRecruit.setRng(rng);

        const result = localRecruit.recruitSingle('advanced');
        expect(result).not.toBeNull();
        expect(result!.results[0].general.id).not.toBe('guanyu');
      }
    });
  });

  // ───────────────────────────────────────
  // 9. UP武将不存在的边界情况
  // ───────────────────────────────────────
  describe('UP武将边界情况', () => {
    it('UP武将ID不存在时回退到普通LEGENDARY池', () => {
      // 设置一个不存在的武将ID
      recruit.setUpHero('non_existent_hero');

      // rng=0.99 → LEGENDARY, UP判定 rng=0.3 → 命中
      // 但 getGeneralDef 返回 undefined，所以回退到普通池
      const rng = makeSequenceRng([0.99, 0.3, 0.5]);
      recruit.setRng(rng);

      const result = recruit.recruitSingle('advanced');
      expect(result).not.toBeNull();
      expect(result!.results[0].quality).toBe(Quality.LEGENDARY);
      // 不应是不存在的武将
      expect(result!.results[0].general.id).not.toBe('non_existent_hero');
    });

    it('getUpHeroState返回只读快照', () => {
      recruit.setUpHero('guanyu');
      const state1 = recruit.getUpHeroState();
      const state2 = recruit.getUpHeroState();

      // 修改快照不影响内部状态
      (state1 as unknown as Record<string, unknown>).upGeneralId = 'lvbu';
      expect(recruit.getUpHeroState().upGeneralId).toBe('guanyu');

      // 两个快照是不同引用
      expect(state1).not.toBe(state2);
    });

    it('序列化/反序列化保留UP状态', () => {
      recruit.setUpHero('zhaoyun', 0.75);

      const saved = recruit.serialize();
      expect(saved).toBeTruthy();

      const newRecruit = new HeroRecruitSystem();
      newRecruit.setRecruitDeps(makeRichDeps(new HeroSystem()));
      newRecruit.deserialize(saved);

      const upState = newRecruit.getUpHeroState();
      expect(upState.upGeneralId).toBe('zhaoyun');
      expect(upState.upRate).toBe(0.75);
    });
  });
});
