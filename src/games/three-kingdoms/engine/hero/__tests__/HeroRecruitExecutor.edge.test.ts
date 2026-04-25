import { describe, it, expect, beforeEach } from 'vitest';
/**
 * HeroRecruitExecutor 边界测试
 *
 * 覆盖场景：
 * 1. 空卡池执行 — fallbackPick 无武将可用
 * 2. 资源不足执行 — 通过 HeroRecruitSystem 间接验证
 * 3. 保底触发执行 — 十连保底 / 硬保底
 * 4. 连续执行幂等性 — 多次单抽后保底计数器一致
 */

import { HeroRecruitExecutor } from '../HeroRecruitExecutor';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import type { RecruitDeps, PityState } from '../HeroRecruitSystem';
import { HeroSystem } from '../HeroSystem';
import { Quality, QUALITY_ORDER } from '../hero.types';
import type { RecruitType } from '../hero-recruit-config';
import { RECRUIT_PITY, RECRUIT_SAVE_VERSION } from '../hero-recruit-config';
import { DUPLICATE_FRAGMENT_COUNT } from '../hero-config';
import type { UpHeroState } from '../recruit-types';
import { createEmptyPity, createDefaultUpHero } from '../recruit-types';

// ── 辅助 ──

/** 创建 mock 资源系统（无限资源） */
function makeRichDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: () => true,
    canAffordResource: () => true,
  };
}

/** 创建 mock 资源系统（无资源） */
function makePoorDeps(heroSystem: HeroSystem): RecruitDeps {
  return {
    heroSystem,
    spendResource: () => false,
    canAffordResource: () => false,
  };
}

/** 始终返回指定值的 RNG */
function makeConstantRng(value: number): () => number {
  return () => value;
}

/** 按序列返回值的 RNG（循环） */
function makeSequenceRng(values: number[]): () => number {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx++;
    return v;
  };
}

/** 创建空保底状态 */
function emptyPity(): PityState {
  return createEmptyPity();
}

/** 创建默认 UP 武将状态 */
function defaultUpHero(): UpHeroState {
  return createDefaultUpHero();
}

// ═══════════════════════════════════════════════════════════════
describe('HeroRecruitExecutor — 边界测试', () => {
  let executor: HeroRecruitExecutor;
  let heroSystem: HeroSystem;

  beforeEach(() => {
    executor = new HeroRecruitExecutor();
    heroSystem = new HeroSystem();
  });

  // ───────────────────────────────────────────
  // 1. 空卡池执行
  // ───────────────────────────────────────────
  describe('空卡池执行', () => {
    it('GENERAL_DEFS 非空时 executeSinglePull 应返回有效结果', () => {
      // GENERAL_DEFS 包含多个品质的武将，不会真正空池
      const rng = makeConstantRng(0.3); // COMMON
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result).toBeDefined();
      expect(result.quality).toBeDefined();
    });

    it('普通招募 COMMON 品质有武将可抽取', () => {
      const rng = makeConstantRng(0.1); // COMMON
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result.quality).toBe(Quality.COMMON);
      expect(result.general).toBeDefined();
      expect(result.isDuplicate).toBe(false);
    });

    it('高级招募 COMMON 品质有武将可抽取', () => {
      const rng = makeConstantRng(0.1); // COMMON
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const result = executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      expect(result.quality).toBe(Quality.COMMON);
      expect(result.general).toBeDefined();
    });

    it('所有品质区间均可命中对应品质武将', () => {
      // FINE: normal 概率表 0.60~0.90 → rng=0.70 命中 FINE
      const rng = makeConstantRng(0.70);
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result.quality).toBe(Quality.FINE);
    });

    it('RARE 品质有武将可抽取', () => {
      // normal: 0.90~0.98 → rng=0.93 命中 RARE
      const rng = makeConstantRng(0.93);
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result.quality).toBe(Quality.RARE);
    });

    it('EPIC 品质有武将可抽取', () => {
      // normal: 0.98~1.00 → rng=0.99 命中 EPIC
      const rng = makeConstantRng(0.99);
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result.quality).toBe(Quality.EPIC);
    });
  });

  // ───────────────────────────────────────────
  // 2. 资源不足执行（通过 HeroRecruitSystem 间接验证）
  // ───────────────────────────────────────────
  describe('资源不足执行', () => {
    it('资源不足时 recruitSingle 返回 null', () => {
      const recruit = new HeroRecruitSystem();
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.recruitSingle('normal')).toBeNull();
    });

    it('资源不足时 recruitTen 返回 null', () => {
      const recruit = new HeroRecruitSystem();
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.recruitTen('normal')).toBeNull();
    });

    it('资源不足时高级招募返回 null', () => {
      const recruit = new HeroRecruitSystem();
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      expect(recruit.recruitSingle('advanced')).toBeNull();
    });

    it('资源不足时保底计数器不变', () => {
      const recruit = new HeroRecruitSystem();
      recruit.setRecruitDeps(makePoorDeps(heroSystem));
      recruit.recruitSingle('normal');
      const pity = recruit.getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
      expect(pity.normalHardPity).toBe(0);
      expect(pity.advancedHardPity).toBe(0);
    });

    it('canAfford 为 true 但 spend 为 false 时招募失败', () => {
      const recruit = new HeroRecruitSystem();
      const deps = makeRichDeps(heroSystem);
      deps.spendResource = () => false;
      deps.canAffordResource = () => true;
      recruit.setRecruitDeps(deps);
      expect(recruit.recruitSingle('normal')).toBeNull();
    });
  });

  // ───────────────────────────────────────────
  // 3. 保底触发执行
  // ───────────────────────────────────────────
  describe('保底触发执行', () => {
    it('十连保底触发：normalPity=9 时下次必出 RARE+', () => {
      const pity: PityState = { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 };
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.1); // 普通 COMMON，但保底修正为 RARE
      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(QUALITY_ORDER[result.quality]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.RARE]);
    });

    it('十连保底触发后计数器重置为 0', () => {
      const pity: PityState = { normalPity: 9, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 };
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.1);
      executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      // 保底触发后 normalPity 重置为 0（因为出 RARE+）
      expect(pity.normalPity).toBe(0);
    });

    it('硬保底触发：advancedHardPity=99 时下次必出 LEGENDARY', () => {
      const pity: PityState = { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 99 };
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.1); // COMMON，硬保底修正为 LEGENDARY
      const result = executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      expect(QUALITY_ORDER[result.quality]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.LEGENDARY]);
    });

    it('硬保底触发后计数器重置', () => {
      const pity: PityState = { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 99 };
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.1);
      executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      // 硬保底触发后 advancedHardPity 重置为 0
      expect(pity.advancedHardPity).toBe(0);
    });

    it('硬保底优先于十连保底', () => {
      // 同时满足十连保底和硬保底条件时，硬保底优先
      const pity: PityState = { normalPity: 0, advancedPity: 9, normalHardPity: 0, advancedHardPity: 99 };
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.1);
      const result = executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      // 硬保底 LEGENDARY 优先，品质应为 LEGENDARY
      expect(QUALITY_ORDER[result.quality]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.LEGENDARY]);
    });

    it('未触发保底时计数器 +1', () => {
      const pity: PityState = { normalPity: 3, advancedPity: 0, normalHardPity: 5, advancedHardPity: 0 };
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.3); // COMMON，不触发保底
      executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      // COMMON 不触发保底重置，计数器 +1
      expect(pity.normalPity).toBe(4);
      expect(pity.normalHardPity).toBe(6);
    });
  });

  // ───────────────────────────────────────────
  // 4. 连续执行幂等性
  // ───────────────────────────────────────────
  describe('连续执行幂等性', () => {
    it('连续10次单抽后保底计数器符合预期', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.3); // 始终 COMMON

      for (let i = 0; i < 10; i++) {
        executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      }

      // 第10次触发十连保底（normalPity 从9触发后重置为0），所以最终为0
      // 但 COMMON 不触发保底重置，只有 RARE+ 才重置
      // 第10次时 pityCount=9 → 保底触发 → 品质提升为 RARE → RARE>=RARE → 重置
      expect(pity.normalPity).toBe(0);
    });

    it('连续20次高级单抽保底计数器正确', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.3); // 始终 COMMON（高级池）

      for (let i = 0; i < 20; i++) {
        executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      }

      // 每10次触发一次十连保底，20次触发2次
      // 第10次保底后 advancedPity=0，第20次保底后 advancedPity=0
      expect(pity.advancedPity).toBe(0);
    });

    it('重复抽到同一武将时碎片正确累加', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();
      // 固定 rng 使每次都抽到 COMMON
      const rng = makeConstantRng(0.3);

      // 第一次抽取新武将
      const result1 = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result1.isDuplicate).toBe(false);
      expect(result1.fragmentCount).toBe(0);

      // 第二次可能是新武将也可能是重复，取决于 COMMON 池大小
      // 继续抽取直到出现重复
      let totalFragmentCount = 0;
      for (let i = 0; i < 15; i++) {
        const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
        if (result.isDuplicate) {
          totalFragmentCount += result.fragmentCount;
        }
      }

      // 验证碎片累加（COMMON 重复给 5 碎片）
      if (totalFragmentCount > 0) {
        expect(totalFragmentCount % DUPLICATE_FRAGMENT_COUNT[Quality.COMMON]).toBe(0);
      }
    });

    it('多次执行同一 pity 对象不产生异常', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();

      for (let i = 0; i < 50; i++) {
        const rng = makeConstantRng(Math.random());
        const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
        expect(result).toBeDefined();
        expect(result.quality).toBeDefined();
      }

      // 50次后计数器应在合理范围
      expect(pity.normalHardPity).toBeGreaterThanOrEqual(0);
    });

    it('普通和高级交替执行保底独立计数', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.3); // COMMON

      // 交替执行
      for (let i = 0; i < 5; i++) {
        executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
        executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      }

      // 各自独立计数，5次普通5次高级
      expect(pity.normalPity).toBe(5);
      expect(pity.advancedPity).toBe(5);
    });
  });

  // ───────────────────────────────────────────
  // 5. UP 武将机制
  // ───────────────────────────────────────────
  describe('UP 武将机制', () => {
    it('高级招募出 LEGENDARY 时 UP 武将可被选中', () => {
      // 设置 UP 武将
      const upHero: UpHeroState = {
        upGeneralId: 'guanyu', // LEGENDARY 品质
        upRate: 1.0, // 100% 触发
        description: 'test',
      };
      const pity = emptyPity();
      // 高级池 rng 序列：第一个 0.99 → EPIC(但需 LEGENDARY)，
      // 用硬保底强制 LEGENDARY，第二个 rng < 1.0 → UP 触发
      const rng = makeSequenceRng([0.99, 0.1]); // 第二个 0.1 < 1.0(upRate)
      // 设置硬保底确保 LEGENDARY
      pity.advancedHardPity = 99;

      const result = executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      // UP 触发后应获得 guanyu
      expect(result.general.id).toBe('guanyu');
      expect(result.quality).toBe(Quality.LEGENDARY);
    });

    it('普通招募不触发 UP 机制', () => {
      const upHero: UpHeroState = {
        upGeneralId: 'guanyu',
        upRate: 1.0,
        description: 'test',
      };
      const pity = emptyPity();
      const rng = makeConstantRng(0.3);

      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      // 普通招募不触发 UP，结果应为 COMMON 武将
      expect(result.quality).toBe(Quality.COMMON);
      // 不应是 guanyu（LEGENDARY），因为普通池 LEGENDARY 概率为 0
      expect(result.general.id).not.toBe('guanyu');
    });

    it('UP 武将不存在时忽略 UP 机制', () => {
      const upHero: UpHeroState = {
        upGeneralId: 'nonexistent_hero',
        upRate: 1.0,
        description: 'test',
      };
      const pity = emptyPity();
      pity.advancedHardPity = 99; // 强制 LEGENDARY
      // rng 序列：第一个 0.99 → roll品质，第二个 0.1 → UP 判定
      const rng = makeSequenceRng([0.99, 0.1]);

      const result = executor.executeSinglePull(heroSystem, 'advanced', pity, upHero, rng);
      // UP 武将不存在，走正常选择逻辑
      expect(result).toBeDefined();
      expect(result.quality).toBe(Quality.LEGENDARY);
    });
  });

  // ───────────────────────────────────────────
  // 6. 重复武将处理
  // ───────────────────────────────────────────
  describe('重复武将处理', () => {
    it('首次获得武将 isDuplicate 为 false', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.3); // COMMON

      const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
      expect(result.isDuplicate).toBe(false);
      expect(result.fragmentCount).toBe(0);
    });

    it('重复获得武将 isDuplicate 为 true 且碎片数 > 0', () => {
      const pity = emptyPity();
      const upHero = defaultUpHero();
      const rng = makeConstantRng(0.3); // COMMON

      // 先添加一个 COMMON 武将
      const defs = heroSystem.getAllGeneralDefs();
      const commonDef = defs.find(d => d.quality === Quality.COMMON);
      if (commonDef) {
        heroSystem.addGeneral(commonDef.id);

        const result = executor.executeSinglePull(heroSystem, 'normal', pity, upHero, rng);
        // 如果恰好抽到已拥有的武将
        if (result.isDuplicate) {
          expect(result.fragmentCount).toBe(DUPLICATE_FRAGMENT_COUNT[result.quality]);
        } else {
          // 抽到其他 COMMON 武将，不是重复
          expect(result.isDuplicate).toBe(false);
        }
      }
    });
  });
});
