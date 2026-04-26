/**
 * 引擎层 — 武将羁绊系统（故事事件 & 好感度）
 *
 * ⚠️ 注意：此系统与 FactionBondSystem（hero/faction-bond-system）并存，职责分工如下：
 *
 * BondSystem（本文件）：
 *   - 武将故事事件 — 好感度触发专属剧情+历史典故+奖励
 *   - 编队羁绊预览 — getFormationPreview() 提供编队界面实时预览数据
 *   - 阵营羁绊检测（旧规则：2/3/6/混搭）— 仅用于故事事件判定
 *
 * FactionBondSystem（hero/faction-bond-system）：
 *   - 阵营羁绊计算（新规则：2/3/4/5人逐级增强）— UI 层 BondPanel 使用
 *   - 搭档羁绊计算（14组特殊组合）— UI 层 BondPanel 使用
 *   - 羁绊系数计算（第5乘区）— 战力公式使用
 *
 * UI 层（BondPanel/BondCollectionPanel）通过 faction-bond-config.ts 的数据驱动，
 * 不直接依赖本系统。本系统主要服务于编队预览和故事事件功能。
 *
 * @module engine/bond/BondSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { Faction } from '../hero/hero.types';
import type { GeneralStats, GeneralData } from '../hero/hero.types';
import { FACTIONS } from '../hero/hero.types';
import type {
  BondType,
  BondEffect,
  ActiveBond,
  FormationBondPreview,
  BondPotentialTip,
  StoryEventDef,
  StoryEventCondition,
  StoryEventReward,
  HeroFavorability,
  BondSaveData,
} from '../../core/bond';
import { BOND_EFFECTS, STORY_EVENTS } from './bond-config';
import {
  BOND_NAMES,
  BOND_DESCRIPTIONS,
  BOND_SAVE_VERSION,
} from '../../core/bond';

// ─────────────────────────────────────────────
// 羁绊效果配置
// ─────────────────────────────────────────────

/** 羁绊效果配置表 */

// ─────────────────────────────────────────────
// BondSystem 类
// ─────────────────────────────────────────────

/**
 * 武将羁绊系统
 *
 * 管理阵营羁绊检测、效果计算、编队预览、武将故事事件。
 */
export class BondSystem implements ISubsystem {
  readonly name = 'bond';

  private deps!: ISystemDeps;
  /** 武将好感度数据 */
  private favorabilities: Map<string, HeroFavorability> = new Map();
  /** 已完成的故事事件 */
  private completedStoryEvents: Set<string> = new Set();

  /** 外部回调：获取编队武将列表 */
  private getFormationHeroes?: () => GeneralData[];

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 羁绊系统不依赖帧更新
  }

  getState(): BondSaveData {
    return this.serialize();
  }

  reset(): void {
    this.favorabilities.clear();
    this.completedStoryEvents.clear();
  }

  // ─── 配置回调 ───────────────────────────

  /** 设置编队武将查询回调 */
  setCallbacks(callbacks: {
    getFormationHeroes?: () => GeneralData[];
  }): void {
    this.getFormationHeroes = callbacks.getFormationHeroes;
  }

  // ─────────────────────────────────────────
  // #1 阵营羁绊效果
  // ─────────────────────────────────────────

  /** 计算编队阵营分布 */
  getFactionDistribution(heroes: GeneralData[]): Record<Faction, number> {
    const dist: Record<Faction, number> = { shu: 0, wei: 0, wu: 0, qun: 0 };
    for (const hero of heroes) {
      dist[hero.faction]++;
    }
    return dist;
  }

  /** 检测激活的羁绊 */
  detectActiveBonds(heroes: GeneralData[]): ActiveBond[] {
    const dist = this.getFactionDistribution(heroes);
    const bonds: ActiveBond[] = [];

    // 检查各阵营的同阵营羁绊
    for (const faction of FACTIONS) {
      const count = dist[faction];
      if (count >= 6) {
        bonds.push({
          type: 'faction_6',
          faction,
          heroCount: count,
          effect: BOND_EFFECTS.faction_6,
        });
      } else if (count >= 3) {
        bonds.push({
          type: 'faction_3',
          faction,
          heroCount: count,
          effect: BOND_EFFECTS.faction_3,
        });
      } else if (count >= 2) {
        bonds.push({
          type: 'faction_2',
          faction,
          heroCount: count,
          effect: BOND_EFFECTS.faction_2,
        });
      }
    }

    // 检查混搭协作（3+3不同阵营）
    const factionCounts = FACTIONS.map(f => ({ faction: f, count: dist[f] }))
      .filter(fc => fc.count >= 3)
      .sort((a, b) => b.count - a.count);

    if (factionCounts.length >= 2) {
      // 检查是否已存在更高优先级的同阵营羁绊
      const hasFaction6 = bonds.some(b => b.type === 'faction_6');
      if (!hasFaction6) {
        bonds.push({
          type: 'mixed_3_3',
          faction: factionCounts[0].faction,
          heroCount: factionCounts[0].count + factionCounts[1].count,
          effect: BOND_EFFECTS.mixed_3_3,
        });
      }
    }

    return bonds;
  }

  /** 计算羁绊总加成 */
  calculateTotalBondBonuses(bonds: ActiveBond[]): Partial<GeneralStats> {
    const total: Partial<GeneralStats> = {};
    for (const bond of bonds) {
      for (const [key, value] of Object.entries(bond.effect.bonuses)) {
        const k = key as keyof GeneralStats;
        total[k] = (total[k] ?? 0) + value;
      }
    }
    return total;
  }

  /** 获取羁绊效果定义 */
  getBondEffect(type: BondType): BondEffect {
    return { ...BOND_EFFECTS[type] };
  }

  /** 获取所有羁绊效果定义 */
  getAllBondEffects(): BondEffect[] {
    return Object.values(BOND_EFFECTS).map(e => ({ ...e }));
  }

  // ─────────────────────────────────────────
  // #2 羁绊可视化
  // ─────────────────────────────────────────

  /** 生成编队羁绊预览 */
  getFormationPreview(formationId: string, heroes: GeneralData[]): FormationBondPreview {
    const dist = this.getFactionDistribution(heroes);
    const activeBonds = this.detectActiveBonds(heroes);
    const totalBonuses = this.calculateTotalBondBonuses(activeBonds);
    const potentialBonds = this.getPotentialBonds(heroes);

    return {
      formationId,
      activeBonds,
      totalBonuses,
      factionDistribution: dist,
      potentialBonds,
    };
  }

  /** 获取潜在羁绊提示 */
  private getPotentialBonds(heroes: GeneralData[]): BondPotentialTip[] {
    const dist = this.getFactionDistribution(heroes);
    const tips: BondPotentialTip[] = [];

    for (const faction of FACTIONS) {
      const count = dist[faction];
      if (count === 1) {
        // 差1个可以激活2同羁绊
        tips.push({
          type: 'faction_2',
          missingCount: 1,
          suggestedFaction: faction,
          bonuses: BOND_EFFECTS.faction_2.bonuses,
        });
      } else if (count === 2) {
        // 差1个可以激活3同羁绊
        tips.push({
          type: 'faction_3',
          missingCount: 1,
          suggestedFaction: faction,
          bonuses: BOND_EFFECTS.faction_3.bonuses,
        });
      } else if (count >= 3 && count < 6) {
        // 差(6-count)个可以激活6同羁绊
        tips.push({
          type: 'faction_6',
          missingCount: 6 - count,
          suggestedFaction: faction,
          bonuses: BOND_EFFECTS.faction_6.bonuses,
        });
      }
    }

    return tips;
  }

  // ─────────────────────────────────────────
  // #3 武将故事事件
  // ─────────────────────────────────────────

  /** 获取所有故事事件定义 */
  getAllStoryEvents(): StoryEventDef[] {
    return [...STORY_EVENTS];
  }

  /** 获取武将好感度 */
  getFavorability(heroId: string): HeroFavorability {
    const fav = this.favorabilities.get(heroId);
    if (fav) return { ...fav };
    return { heroId, value: 0, triggeredEvents: [] };
  }

  /** 增加武将好感度 */
  addFavorability(heroId: string, amount: number): void {
    const fav = this.favorabilities.get(heroId) ?? { heroId, value: 0, triggeredEvents: [] };
    fav.value += amount;
    this.favorabilities.set(heroId, fav);
  }

  /** 检查可触发的故事事件 */
  getAvailableStoryEvents(heroes: Map<string, GeneralData>): StoryEventDef[] {
    const available: StoryEventDef[] = [];

    for (const event of STORY_EVENTS) {
      // 已完成且不可重复
      if (this.completedStoryEvents.has(event.id) && !event.repeatable) continue;

      // 检查条件
      const condition = event.condition;
      let met = true;

      // 检查所有关联武将是否存在
      for (const heroId of condition.heroIds) {
        if (!heroes.has(heroId)) { met = false; break; }
      }
      if (!met) continue;

      // 检查好感度
      for (const heroId of condition.heroIds) {
        const fav = this.getFavorability(heroId);
        if (fav.value < condition.minFavorability) { met = false; break; }
      }
      if (!met) continue;

      // 检查等级
      for (const heroId of condition.heroIds) {
        const hero = heroes.get(heroId);
        if (hero && hero.level < condition.minLevel) { met = false; break; }
      }
      if (!met) continue;

      // 检查前置事件
      if (condition.prerequisiteEventId) {
        if (!this.completedStoryEvents.has(condition.prerequisiteEventId)) continue;
      }

      available.push(event);
    }

    return available;
  }

  /** 触发故事事件 */
  triggerStoryEvent(eventId: string): {
    success: boolean;
    event?: StoryEventDef;
    rewards?: StoryEventReward;
    reason?: string;
  } {
    const event = STORY_EVENTS.find(e => e.id === eventId);
    if (!event) return { success: false, reason: '事件不存在' };

    // 已完成且不可重复
    if (this.completedStoryEvents.has(eventId) && !event.repeatable) {
      return { success: false, reason: '事件已完成' };
    }

    // 标记完成
    this.completedStoryEvents.add(eventId);

    // 增加好感度
    for (const heroId of event.condition.heroIds) {
      this.addFavorability(heroId, event.rewards.favorability);
    }

    // 发射事件
    this.deps.eventBus.emit('bond:storyTriggered', {
      eventId,
      title: event.title,
      rewards: event.rewards,
    });

    return { success: true, event, rewards: event.rewards };
  }

  // ─── 序列化 ───────────────────────────

  serialize(): BondSaveData {
    const favorabilities: Record<string, HeroFavorability> = {};
    for (const [key, value] of this.favorabilities) {
      favorabilities[key] = value;
    }
    return {
      version: BOND_SAVE_VERSION,
      favorabilities,
      completedStoryEvents: [...this.completedStoryEvents],
    };
  }

  loadSaveData(data: BondSaveData): void {
    this.favorabilities.clear();
    this.completedStoryEvents.clear();
    for (const [key, value] of Object.entries(data.favorabilities ?? {})) {
      this.favorabilities.set(key, value);
    }
    for (const eventId of data.completedStoryEvents ?? []) {
      this.completedStoryEvents.add(eventId);
    }
  }
}
