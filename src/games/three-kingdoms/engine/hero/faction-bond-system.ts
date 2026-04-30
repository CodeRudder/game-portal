/**
 * 阵营羁绊系统 — 引擎层
 *
 * 职责：计算编队中阵营羁绊和搭档羁绊的加成效果
 * 规则：
 *   - 阵营羁绊：编队中同阵营武将达2/3/4/5人激活对应等级
 *   - 搭档羁绊：编队中包含羁绊所需武将即激活
 *   - 多羁绊可叠加（阵营+搭档同时生效）
 *
 * @module engine/hero/faction-bond-system
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { GeneralStats } from '../../shared/types';
import {
  FACTION_TIER_MAP,
  PARTNER_BOND_CONFIGS,
  HERO_FACTION_MAP,
  ALL_FACTIONS,
  EMPTY_BOND_EFFECT,
} from './faction-bond-config';
import type {
  BondEffect,
  BondConfig,
  FactionId,
  FactionTierDef,
} from './faction-bond-config';

// ─────────────────────────────────────────────
// 1. 运行时类型
// ─────────────────────────────────────────────

/** 激活的羁绊信息 */
export interface ActiveFactionBond {
  /** 羁绊ID */
  bondId: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型 */
  type: 'faction' | 'partner';
  /** 阵营（阵营羁绊专用） */
  faction?: FactionId;
  /** 等级名称 */
  tierName?: string;
  /** 加成效果 */
  effect: BondEffect;
  /** 参与的武将ID列表 */
  participants: string[];
  /** 羁绊描述 */
  description: string;
}

/** 武将阵营查询回调 */
export type HeroFactionResolver = (heroId: string) => FactionId | undefined;

// ─────────────────────────────────────────────
// 2. FactionBondSystem 类
// ─────────────────────────────────────────────

/**
 * 阵营羁绊系统
 *
 * 独立子系统，计算编队中激活的阵营羁绊和搭档羁绊，
 * 提供属性加成计算和羁绊查询功能。
 */
export class FactionBondSystem implements ISubsystem {
  readonly name = 'faction-bond' as const;

  private deps: ISystemDeps | null = null;
  /** 武将阵营查询回调（可覆盖默认的 HERO_FACTION_MAP） */
  private factionResolver: HeroFactionResolver;

  constructor() {
    // 默认使用内置阵营映射
    this.factionResolver = (heroId: string): FactionId | undefined =>
      HERO_FACTION_MAP[heroId];
  }

  // ─── ISubsystem 接口实现 ───

  /** 初始化子系统 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 每帧更新（羁绊系统无需每帧更新） */
  update(_dt: number): void {
    // 羁绊系统为无状态计算，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): unknown {
    return {
      name: this.name,
      bondConfigCount: this.getAllBondConfigs().length,
    };
  }

  /** 重置子系统 */
  reset(): void {
    this.deps = null;
    // 恢复默认阵营解析器
    this.factionResolver = (heroId: string): FactionId | undefined =>
      HERO_FACTION_MAP[heroId];
  }

  // ─── 配置方法 ───

  /**
   * 设置武将阵营查询回调
   *
   * 外部可通过此方法注入自定义的阵营查询逻辑，
   * 覆盖默认的 HERO_FACTION_MAP 查询。
   *
   * @param resolver - 武将阵营查询回调
   */
  setHeroFactionResolver(resolver: HeroFactionResolver): void {
    this.factionResolver = resolver;
  }

  // ─── 核心计算 ───

  /**
   * 计算当前编队的所有羁绊加成
   *
   * 遍历编队中的武将，按阵营分组，匹配最高激活的等级门槛，
   * 同时检查搭档羁绊是否激活。
   *
   * @param heroIds - 编队中的武将ID列表
   * @returns 每个武将ID对应的累计加成效果 Map
   */
  calculateBonds(heroIds: string[]): Map<string, BondEffect> {
    const result = new Map<string, BondEffect>();

    if (heroIds.length === 0) return result;

    // 初始化每个武将的加成为空
    for (const id of heroIds) {
      result.set(id, { ...EMPTY_BOND_EFFECT });
    }

    // 1. 计算阵营羁绊加成
    const factionBonds = this.calculateFactionBonds(heroIds);
    for (const bond of factionBonds) {
      for (const participantId of bond.participants) {
        if (result.has(participantId)) {
          const existing = result.get(participantId)!;
          result.set(participantId, this.mergeEffects(existing, bond.effect));
        }
      }
    }

    // 2. 计算搭档羁绊加成
    const partnerBonds = this.calculatePartnerBonds(heroIds);
    for (const bond of partnerBonds) {
      for (const participantId of bond.participants) {
        if (result.has(participantId)) {
          const existing = result.get(participantId)!;
          result.set(participantId, this.mergeEffects(existing, bond.effect));
        }
      }
    }

    return result;
  }

  /**
   * 计算编队羁绊总系数（R2-FIX-P01: 用于战力公式第5乘区）
   *
   * 将所有激活羁绊的加成效果汇总为一个乘数。
   * 计算方式：1 + 所有羁绊效果的平均加成百分比之和
   * 上限 2.0，下限 1.0
   *
   * @param heroIds - 编队中的武将ID列表
   * @returns 羁绊系数（1.0 ~ 2.0）
   */
  getBondMultiplier(heroIds: string[]): number {
    if (!heroIds || heroIds.length === 0) return 1.0;

    const bondMap = this.calculateBonds(heroIds);
    let totalBonus = 0;
    let count = 0;
    for (const [, effect] of bondMap) {
      // 累加各项加成百分比
      const sum = (effect.attackBonus ?? 0) + (effect.defenseBonus ?? 0)
        + (effect.hpBonus ?? 0) + (effect.critBonus ?? 0) + (effect.strategyBonus ?? 0);
      if (sum > 0) {
        totalBonus += sum;
        count++;
      }
    }

    if (count === 0 || !Number.isFinite(totalBonus)) return 1.0;

    // 取平均值作为羁绊系数的基础加成
    const avgBonus = totalBonus / count;
    const multiplier = 1 + avgBonus;
    // 上限 2.0，下限 1.0
    return Math.max(1.0, Math.min(multiplier, 2.0));
  }

  /**
   * 获取某武将当前激活的所有羁绊配置
   *
   * @param heroId - 目标武将ID
   * @param teamHeroIds - 编队中所有武将ID列表
   * @returns 该武将参与的激活羁绊配置列表
   */
  getActiveBonds(heroId: string, teamHeroIds: string[]): BondConfig[] {
    const activeBonds: BondConfig[] = [];
    const heroFaction = this.factionResolver(heroId);
    if (!heroFaction) return activeBonds;

    // 检查阵营羁绊
    const factionCount = this.countFactionHeroes(teamHeroIds, heroFaction);
    const tiers = FACTION_TIER_MAP[heroFaction];
    let matchedTier: FactionTierDef | null = null;
    for (const tier of tiers) {
      if (factionCount >= tier.requiredCount) {
        matchedTier = tier;
      }
    }

    if (matchedTier) {
      activeBonds.push({
        id: `faction_${heroFaction}`,
        name: `${heroFaction}阵营羁绊`,
        type: 'faction',
        faction: heroFaction,
        requiredHeroes: teamHeroIds.filter(id => this.factionResolver(id) === heroFaction),
        minCount: matchedTier.requiredCount,
        effect: matchedTier.effect,
        description: matchedTier.description,
      });
    }

    // 检查搭档羁绊
    for (const partnerBond of PARTNER_BOND_CONFIGS) {
      if (!partnerBond.requiredHeroes.includes(heroId)) continue;
      if (this.isPartnerBondActive(partnerBond, teamHeroIds)) {
        activeBonds.push(partnerBond);
      }
    }

    return activeBonds;
  }

  /**
   * 获取所有可用羁绊配置
   *
   * @returns 阵营羁绊（每个阵营最高等级）+ 所有搭档羁绊
   */
  getAllBondConfigs(): BondConfig[] {
    const configs: BondConfig[] = [];

    // 阵营羁绊（每个阵营的所有等级）
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      for (const tier of tiers) {
        configs.push({
          id: `faction_${faction}_${tier.requiredCount}`,
          name: `${faction}阵营${tier.tierName}羁绊`,
          type: 'faction',
          faction,
          requiredHeroes: [],
          minCount: tier.requiredCount,
          effect: tier.effect,
          description: tier.description,
        });
      }
    }

    // 搭档羁绊
    for (const partnerBond of PARTNER_BOND_CONFIGS) {
      configs.push(partnerBond);
    }

    return configs;
  }

  /**
   * 检查指定羁绊是否激活
   *
   * @param bondId - 羁绊ID
   * @param teamHeroIds - 编队中的武将ID列表
   * @returns 是否激活
   */
  isBondActive(bondId: string, teamHeroIds: string[]): boolean {
    // 检查搭档羁绊
    const partnerBond = PARTNER_BOND_CONFIGS.find(b => b.id === bondId);
    if (partnerBond) {
      return this.isPartnerBondActive(partnerBond, teamHeroIds);
    }

    // 检查阵营羁绊（格式：faction_{faction} 或 faction_{faction}_{count}）
    const factionMatch = bondId.match(/^faction_([a-z]+)(?:_(\d+))?$/);
    if (factionMatch) {
      const faction = factionMatch[1] as FactionId;
      const requiredCount = factionMatch[2] ? parseInt(factionMatch[2], 10) : 0;
      const count = this.countFactionHeroes(teamHeroIds, faction);

      if (requiredCount > 0) {
        return count >= requiredCount;
      }
      // 无具体人数要求，只要激活任何等级即可
      const tiers = FACTION_TIER_MAP[faction];
      if (!tiers) return false;
      return count >= tiers[0].requiredCount;
    }

    return false;
  }

  /**
   * 获取羁绊加成后的属性
   *
   * 将羁绊百分比加成应用到基础属性上。
   * 加成后属性 = 基础属性 × (1 + 羁绊加成百分比)
   *
   * @param baseStats - 武将基础属性
   * @param heroId - 目标武将ID
   * @param teamHeroIds - 编队中所有武将ID列表
   * @returns 加成后的属性
   */
  applyBondBonus(baseStats: GeneralStats, heroId: string, teamHeroIds: string[]): GeneralStats {
    const bondEffects = this.calculateBonds(teamHeroIds);
    const effect = bondEffects.get(heroId);

    if (!effect) return { ...baseStats };

    return {
      attack: Math.round(baseStats.attack * (1 + effect.attackBonus)),
      defense: Math.round(baseStats.defense * (1 + effect.defenseBonus)),
      intelligence: Math.round(baseStats.intelligence * (1 + effect.strategyBonus)),
      speed: baseStats.speed, // 羁绊不影响速度
    };
  }

  // ─── 序列化/反序列化 ───

  /**
   * 序列化系统状态
   *
   * @returns 可序列化的状态对象
   */
  serialize(): { name: string; configCount: number } {
    return {
      name: this.name,
      configCount: this.getAllBondConfigs().length,
    };
  }

  /**
   * 反序列化恢复系统状态
   *
   * @param _data - 序列化数据（当前版本无持久化状态）
   */
  deserialize(_data: unknown): void {
    // 羁绊系统为无状态计算，无需恢复
  }

  // ─── 内部方法 ───

  /**
   * 计算阵营羁绊
   *
   * 按阵营分组统计人数，匹配最高激活的等级门槛
   */
  private calculateFactionBonds(heroIds: string[]): ActiveFactionBond[] {
    const bonds: ActiveFactionBond[] = [];

    // 按阵营分组
    const factionGroups = this.groupByFaction(heroIds);

    for (const [faction, members] of factionGroups) {
      const tiers = FACTION_TIER_MAP[faction];
      if (!tiers) continue;

      // 找到最高匹配的 tier（tiers 按 requiredCount 升序）
      let matchedTier: FactionTierDef | null = null;
      for (const tier of tiers) {
        if (members.length >= tier.requiredCount) {
          matchedTier = tier;
        }
      }

      if (!matchedTier) continue;

      bonds.push({
        bondId: `faction_${faction}`,
        name: `${faction}阵营${matchedTier.tierName}羁绊`,
        type: 'faction',
        faction,
        tierName: matchedTier.tierName,
        effect: matchedTier.effect,
        participants: members,
        description: matchedTier.description,
      });
    }

    return bonds;
  }

  /**
   * 计算搭档羁绊
   *
   * 检查编队中是否包含搭档羁绊所需的全部武将
   */
  private calculatePartnerBonds(heroIds: string[]): ActiveFactionBond[] {
    const bonds: ActiveFactionBond[] = [];
    const idSet = new Set(heroIds);

    for (const bondConfig of PARTNER_BOND_CONFIGS) {
      // 检查所有必需武将是否在编队中
      const matched = bondConfig.requiredHeroes.filter(id => idSet.has(id));

      if (matched.length >= bondConfig.minCount) {
        bonds.push({
          bondId: bondConfig.id,
          name: bondConfig.name,
          type: 'partner',
          effect: bondConfig.effect,
          participants: matched,
          description: bondConfig.description,
        });
      }
    }

    return bonds;
  }

  /**
   * 检查搭档羁绊是否激活
   */
  private isPartnerBondActive(bondConfig: BondConfig, teamHeroIds: string[]): boolean {
    const idSet = new Set(teamHeroIds);
    const matched = bondConfig.requiredHeroes.filter(id => idSet.has(id));
    return matched.length >= bondConfig.minCount;
  }

  /**
   * 按阵营分组武将
   */
  private groupByFaction(heroIds: string[]): Map<FactionId, string[]> {
    const groups = new Map<FactionId, string[]>();

    for (const id of heroIds) {
      const faction = this.factionResolver(id);
      if (!faction) continue;

      const group = groups.get(faction) ?? [];
      group.push(id);
      groups.set(faction, group);
    }

    return groups;
  }

  /**
   * 统计某阵营的武将数量
   */
  private countFactionHeroes(heroIds: string[], faction: FactionId): number {
    let count = 0;
    for (const id of heroIds) {
      if (this.factionResolver(id) === faction) count++;
    }
    return count;
  }

  /**
   * 合并两个羁绊效果（叠加）
   */
  private mergeEffects(a: BondEffect, b: BondEffect): BondEffect {
    return {
      attackBonus: a.attackBonus + b.attackBonus,
      defenseBonus: a.defenseBonus + b.defenseBonus,
      hpBonus: a.hpBonus + b.hpBonus,
      critBonus: a.critBonus + b.critBonus,
      strategyBonus: a.strategyBonus + b.strategyBonus,
    };
  }
}
