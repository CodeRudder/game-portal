/**
 * 武将招募 — 抽卡执行器
 *
 * 从 HeroRecruitSystem.ts 拆分出的核心抽卡执行逻辑。
 * 职责：概率抽取、保底修正、UP武将选择、重复武将处理、保底计数器更新
 *
 * @module engine/hero/HeroRecruitExecutor
 */

import type { RecruitResult, PityState } from './recruit-types';
import { rollQuality, applyPity, pickGeneralByQuality, MAX_HISTORY_SIZE } from './recruit-types';
import type { Quality, GeneralData } from './hero.types';
import { Quality as Q } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import type { RecruitType } from './hero-recruit-config';
import { RECRUIT_RATES, RECRUIT_PITY } from './hero-recruit-config';
import type { UpHeroState } from './recruit-types';

/**
 * 抽卡执行器
 *
 * 封装单次抽卡的完整流程：概率抽取 → 保底修正 → UP武将判断 → 武将选择 → 重复处理。
 * 由 HeroRecruitSystem 持有并委托调用。
 */
export class HeroRecruitExecutor {
  /**
   * 执行单次抽卡
   *
   * @param heroSystem - 武将系统引用
   * @param type - 招募类型
   * @param pity - 保底计数器（会被就地修改）
   * @param upHero - UP武将状态
   * @param rng - 随机数生成器
   * @returns 抽卡结果
   */
  executeSinglePull(
    heroSystem: HeroSystem,
    type: RecruitType,
    pity: PityState,
    upHero: UpHeroState,
    rng: () => number,
  ): RecruitResult {
    const rates = RECRUIT_RATES[type];
    const config = RECRUIT_PITY[type];

    // 获取当前保底计数
    const isNormal = type === 'normal';
    const pityCount = isNormal ? pity.normalPity : pity.advancedPity;
    const hardPityCount = isNormal ? pity.normalHardPity : pity.advancedHardPity;

    // 1. 概率抽取品质 → 保底修正
    const finalQuality = applyPity(rollQuality(rates, rng), pityCount, hardPityCount, config);

    // 2. UP 武将机制：高级招募出 LEGENDARY 时，有概率直接获得 UP 武将
    let generalId: string | null = null;
    if (
      type === 'advanced'
      && upHero.upGeneralId
      && finalQuality === Q.LEGENDARY
      && rng() < upHero.upRate
    ) {
      const upDef = heroSystem.getGeneralDef(upHero.upGeneralId);
      if (upDef) {
        generalId = upHero.upGeneralId;
      }
    }

    // 3. 非UP命中时，从对应品质武将池中随机选择（无匹配时降级）
    if (!generalId) {
      generalId = pickGeneralByQuality(heroSystem, finalQuality, rng)
        ?? this.fallbackPick(heroSystem, finalQuality);
    }

    // 极端情况：完全无武将可用
    if (!generalId) {
      return {
        general: null,
        isDuplicate: false,
        fragmentCount: 0,
        quality: finalQuality,
      };
    }

    // 确定实际品质（降级选择时可能与目标不同）
    const def = heroSystem.getGeneralDef(generalId);
    const resolvedQuality = def?.quality ?? finalQuality;

    // 4. 处理新武将/重复武将
    const isDuplicate = heroSystem.hasGeneral(generalId);
    let fragmentCount = 0;

    if (isDuplicate) {
      fragmentCount = heroSystem.handleDuplicate(generalId, resolvedQuality);
    } else {
      heroSystem.addGeneral(generalId);
    }

    // 5. 更新保底计数器
    this.updatePityCounters(pity, type, resolvedQuality);

    return {
      general: heroSystem.getGeneral(generalId)!,
      isDuplicate,
      fragmentCount,
      quality: resolvedQuality,
    };
  }

  /** 降级选择：目标品质无武将时，逐级降低品质尝试 */
  private fallbackPick(heroSystem: HeroSystem, startQuality: Quality): string | null {
    const order = [Q.COMMON, Q.FINE, Q.RARE, Q.EPIC, Q.LEGENDARY];
    const start = order.indexOf(startQuality);

    // 优先向下查找
    for (let i = start - 1; i >= 0; i--) {
      const id = pickGeneralByQuality(heroSystem, order[i], Math.random);
      if (id) return id;
    }
    // 向上查找
    for (let i = start + 1; i < order.length; i++) {
      const id = pickGeneralByQuality(heroSystem, order[i], Math.random);
      if (id) return id;
    }
    return null;
  }

  /**
   * 更新保底计数器
   *
   * 规则：每次 +1；出稀有+重置十连计数；出史诗+重置硬保底计数
   */
  private updatePityCounters(pity: PityState, type: RecruitType, quality: Quality): void {
    const config = RECRUIT_PITY[type];
    const isNormal = type === 'normal';

    // 基础计数 +1
    if (isNormal) {
      pity.normalPity += 1;
      pity.normalHardPity += 1;
    } else {
      pity.advancedPity += 1;
      pity.advancedHardPity += 1;
    }

    // 出稀有+品质：重置十连保底计数
    if (this.getQualityOrder(quality) >= this.getQualityOrder(config.tenPullMinQuality)) {
      if (isNormal) pity.normalPity = 0;
      else pity.advancedPity = 0;
    }

    // 出史诗+品质：重置硬保底计数
    if (this.getQualityOrder(quality) >= this.getQualityOrder(config.hardPityMinQuality)) {
      if (isNormal) pity.normalHardPity = 0;
      else pity.advancedHardPity = 0;
    }
  }

  /** 获取品质排序值 */
  private getQualityOrder(quality: Quality): number {
    const order: Record<string, number> = {
      [Q.COMMON]: 0,
      [Q.FINE]: 1,
      [Q.RARE]: 2,
      [Q.EPIC]: 3,
      [Q.LEGENDARY]: 4,
    };
    return order[quality] ?? 0;
  }
}
