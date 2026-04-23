/**
 * 科技域 — 科技联动系统
 *
 * 职责：
 * - 注册科技与建筑/武将/资源的联动关系
 * - 科技完成时自动应用联动效果
 * - 提供按目标系统查询科技联动加成的接口
 * - 联动效果类型：建筑产出加成、武将技能强化、资源产出/存储/交易加成
 *
 * 设计原则：
 * - 统一注册所有联动关系，各系统通过 getLinkBonus() 查询
 * - 联动效果与普通科技效果独立，不叠加到 TechEffectSystem
 * - 支持动态注册（后续版本可从配置加载）
 *
 * @module engine/tech/TechLinkSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { TechPath } from './tech.types';
import { DEFAULT_LINK_EFFECTS } from './TechLinkConfig';

// ─────────────────────────────────────────────
// 1. 联动类型定义
// ─────────────────────────────────────────────

/** 联动目标系统 */
export type LinkTarget = 'building' | 'hero' | 'resource';

/** 联动效果定义 */
export interface TechLinkEffect {
  /** 联动效果唯一 ID */
  id: string;
  /** 关联的科技节点 ID */
  techId: string;
  /** 联动目标系统 */
  target: LinkTarget;
  /** 联动目标子类型（如建筑类型、武将技能 ID、资源类型） */
  targetSub: string;
  /** 效果描述 */
  description: string;
  /** 效果值（百分比增量的分子，如 20 表示 +20%） */
  value: number;
  /** 是否解锁新功能（建筑联动） */
  unlockFeature?: boolean;
  /** 解锁的功能描述（仅 unlockFeature=true 时有值） */
  unlockDescription?: string;
  /** 是否解锁新技能（武将联动） */
  unlockSkill?: boolean;
  /** 新技能描述（仅 unlockSkill=true 时有值） */
  newSkillDescription?: string;
}

/** 建筑联动效果 */
export interface BuildingLinkBonus {
  /** 建筑类型 */
  buildingType: string;
  /** 产出加成百分比 */
  productionBonus: number;
  /** 是否解锁新功能 */
  unlockFeature: boolean;
  /** 解锁的功能描述（仅 unlockFeature=true 时有值） */
  unlockDescription?: string;
}

/** 武将联动效果 */
export interface HeroLinkBonus {
  /** 武将技能 ID */
  skillId: string;
  /** 技能强化百分比 */
  enhanceBonus: number;
  /** 是否解锁新技能 */
  unlockSkill: boolean;
  /** 新技能描述（仅 unlockSkill=true 时有值） */
  newSkillDescription?: string;
}

/** 资源联动效果 */
export interface ResourceLinkBonus {
  /** 资源类型 */
  resourceType: string;
  /** 产出加成百分比 */
  productionBonus: number;
  /** 存储上限加成百分比 */
  storageBonus: number;
  /** 交易加成百分比 */
  tradeBonus: number;
}

/** 联动系统状态 */
export interface TechLinkSystemState {
  /** 已注册的联动效果数量 */
  totalLinks: number;
  /** 已激活的联动效果数量（关联科技已完成） */
  activeLinks: number;
}

// ─────────────────────────────────────────────
// 2. 默认联动配置数据（提取到 TechLinkConfig）
// ─────────────────────────────────────────────

export { DEFAULT_LINK_EFFECTS } from './TechLinkConfig';

// ─────────────────────────────────────────────
// 3. TechLinkSystem
// ─────────────────────────────────────────────

export class TechLinkSystem implements ISubsystem {
  readonly name = 'tech-link' as const;
  private deps: ISystemDeps | null = null;

  /** 已注册的联动效果 */
  private links: Map<string, TechLinkEffect>;
  /** 已完成的科技 ID 集合（由外部同步） */
  private completedTechIds: Set<string>;

  constructor() {
    this.links = new Map();
    this.completedTechIds = new Set();
    // 注册默认联动效果
    for (const link of DEFAULT_LINK_EFFECTS) {
      this.links.set(link.id, link);
    }
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 联动系统不需要每帧更新
  }

  getState(): TechLinkSystemState {
    return {
      totalLinks: this.links.size,
      activeLinks: this.getActiveLinkCount(),
    };
  }

  reset(): void {
    this.completedTechIds.clear();
  }

  // ─────────────────────────────────────────
  // 联动注册
  // ─────────────────────────────────────────

  /** 注册联动效果 */
  registerLink(link: TechLinkEffect): void {
    this.links.set(link.id, link);
  }

  /** 批量注册联动效果 */
  registerLinks(links: TechLinkEffect[]): void {
    for (const link of links) {
      this.links.set(link.id, link);
    }
  }

  /** 移除联动效果 */
  unregisterLink(id: string): boolean {
    return this.links.delete(id);
  }

  // ─────────────────────────────────────────
  // 科技完成同步
  // ─────────────────────────────────────────

  /** 同步已完成的科技 ID 集合 */
  syncCompletedTechIds(techIds: string[]): void {
    this.completedTechIds = new Set(techIds);
    // 通知联动效果变化（v5.0）
    this.emitLinkChangeEvent();
  }

  /** 添加已完成的科技 ID */
  addCompletedTech(techId: string): void {
    if (this.completedTechIds.has(techId)) return; // 避免重复
    this.completedTechIds.add(techId);
    this.emitLinkChangeEvent();
  }

  /** 移除已完成的科技 ID（用于回退/重置场景） */
  removeCompletedTech(techId: string): void {
    this.completedTechIds.delete(techId);
    this.emitLinkChangeEvent();
  }

  // ─────────────────────────────────────────
  // 建筑联动查询
  // ─────────────────────────────────────────

  /** 获取指定建筑类型的联动加成 */
  getBuildingLinkBonus(buildingType: string): BuildingLinkBonus {
    let productionBonus = 0;
    let unlockFeature = false;
    let unlockDescription: string | undefined;

    for (const link of this.links.values()) {
      if (link.target !== 'building' || link.targetSub !== buildingType) continue;
      if (!this.completedTechIds.has(link.techId)) continue;

      productionBonus += link.value;
      if (link.unlockFeature) {
        unlockFeature = true;
        unlockDescription = link.unlockDescription;
      }
    }

    return { buildingType, productionBonus, unlockFeature, unlockDescription };
  }

  /** 获取所有建筑联动加成 */
  getAllBuildingBonuses(): BuildingLinkBonus[] {
    const buildingTypes = new Set<string>();
    for (const link of this.links.values()) {
      if (link.target === 'building') {
        buildingTypes.add(link.targetSub);
      }
    }
    return Array.from(buildingTypes).map((bt) => this.getBuildingLinkBonus(bt));
  }

  // ─────────────────────────────────────────
  // 武将联动查询
  // ─────────────────────────────────────────

  /** 获取指定武将技能的联动加成 */
  getHeroLinkBonus(skillId: string): HeroLinkBonus {
    let enhanceBonus = 0;
    let unlockSkill = false;
    let newSkillDescription: string | undefined;

    for (const link of this.links.values()) {
      if (link.target !== 'hero' || link.targetSub !== skillId) continue;
      if (!this.completedTechIds.has(link.techId)) continue;

      enhanceBonus += link.value;
      if (link.unlockSkill) {
        unlockSkill = true;
        newSkillDescription = link.newSkillDescription;
      }
    }

    return { skillId, enhanceBonus, unlockSkill, newSkillDescription };
  }

  /** 获取所有武将联动加成 */
  getAllHeroBonuses(): HeroLinkBonus[] {
    const skillIds = new Set<string>();
    for (const link of this.links.values()) {
      if (link.target === 'hero') {
        skillIds.add(link.targetSub);
      }
    }
    return Array.from(skillIds).map((sid) => this.getHeroLinkBonus(sid));
  }

  // ─────────────────────────────────────────
  // 资源联动查询
  // ─────────────────────────────────────────

  /** 获取指定资源类型的联动加成 */
  getResourceLinkBonus(resourceType: string): ResourceLinkBonus {
    let productionBonus = 0;
    let storageBonus = 0;
    let tradeBonus = 0;

    for (const link of this.links.values()) {
      if (link.target !== 'resource') continue;
      if (!this.completedTechIds.has(link.techId)) continue;

      // 产出加成
      if (link.targetSub === resourceType) {
        productionBonus += link.value;
      }
      // 存储加成
      if (link.targetSub === `${resourceType}_storage`) {
        storageBonus += link.value;
      }
      // 交易加成
      if (link.targetSub === `${resourceType}_trade`) {
        tradeBonus += link.value;
      }
    }

    return { resourceType, productionBonus, storageBonus, tradeBonus };
  }

  /** 获取所有资源联动加成 */
  getAllResourceBonuses(): ResourceLinkBonus[] {
    const resourceTypes = new Set<string>();
    for (const link of this.links.values()) {
      if (link.target === 'resource') {
        // 提取基础资源类型（去掉 _storage / _trade 后缀）
        const base = link.targetSub.replace(/_storage$|_trade$/, '');
        resourceTypes.add(base);
      }
    }
    return Array.from(resourceTypes).map((rt) => this.getResourceLinkBonus(rt));
  }

  // ─────────────────────────────────────────
  // 通用联动查询
  // ─────────────────────────────────────────

  /** 获取指定科技关联的所有联动效果 */
  getLinksByTechId(techId: string): TechLinkEffect[] {
    const result: TechLinkEffect[] = [];
    for (const link of this.links.values()) {
      if (link.techId === techId) {
        result.push(link);
      }
    }
    return result;
  }

  /** 获取指定目标系统的所有活跃联动效果 */
  getActiveLinksByTarget(target: LinkTarget): TechLinkEffect[] {
    const result: TechLinkEffect[] = [];
    for (const link of this.links.values()) {
      if (link.target === target && this.completedTechIds.has(link.techId)) {
        result.push(link);
      }
    }
    return result;
  }

  /** 获取活跃联动数量 */
  private getActiveLinkCount(): number {
    let count = 0;
    for (const link of this.links.values()) {
      if (this.completedTechIds.has(link.techId)) {
        count++;
      }
    }
    return count;
  }

  // ─────────────────────────────────────────
  // 联动事件通知（v5.0 扩展）
  // ─────────────────────────────────────────

  /** 发出联动效果变化事件 */
  private emitLinkChangeEvent(): void {
    if (!this.deps) return;
    const activeBuildingLinks = this.getActiveLinksByTarget('building');
    const activeHeroLinks = this.getActiveLinksByTarget('hero');
    const activeResourceLinks = this.getActiveLinksByTarget('resource');

    this.deps.eventBus.emit('tech:linksChanged', {
      buildingLinks: activeBuildingLinks.length,
      heroLinks: activeHeroLinks.length,
      resourceLinks: activeResourceLinks.length,
      totalActive: activeBuildingLinks.length + activeHeroLinks.length + activeResourceLinks.length,
    });
  }

  // ─────────────────────────────────────────
  // 综合联动查询（v5.0 扩展）
  // ─────────────────────────────────────────

  /**
   * 获取指定科技完成后的联动效果快照
   *
   * 用于科技完成时一次性获取所有联动效果变化。
   */
  getTechLinkSnapshot(techId: string): {
    building: BuildingLinkBonus[];
    hero: HeroLinkBonus[];
    resource: ResourceLinkBonus[];
  } {
    const links = this.getLinksByTechId(techId);
    const buildingTypes = new Set<string>();
    const skillIds = new Set<string>();
    const resourceTypes = new Set<string>();

    for (const link of links) {
      if (link.target === 'building') buildingTypes.add(link.targetSub);
      else if (link.target === 'hero') skillIds.add(link.targetSub);
      else if (link.target === 'resource') {
        const base = link.targetSub.replace(/_storage$|_trade$/, '');
        resourceTypes.add(base);
      }
    }

    return {
      building: Array.from(buildingTypes).map((bt) => this.getBuildingLinkBonus(bt)),
      hero: Array.from(skillIds).map((sid) => this.getHeroLinkBonus(sid)),
      resource: Array.from(resourceTypes).map((rt) => this.getResourceLinkBonus(rt)),
    };
  }

  /**
   * 获取所有活跃联动的综合加成摘要（v5.0 扩展）
   *
   * 供外部系统一次性查询所有联动加成。
   */
  getAllActiveBonuses(): {
    buildings: BuildingLinkBonus[];
    heroes: HeroLinkBonus[];
    resources: ResourceLinkBonus[];
  } {
    return {
      buildings: this.getAllBuildingBonuses(),
      heroes: this.getAllHeroBonuses(),
      resources: this.getAllResourceBonuses(),
    };
  }

  // ─────────────────────────────────────────
  // 统一查询接口 getTechBonus(system, stat)
  // ─────────────────────────────────────────

  /**
   * 统一联动加成查询接口
   *
   * 提供标准化的查询方式，供建筑/武将/资源等外部系统获取科技联动加成。
   *
   * @param system - 目标系统类型 ('building' | 'hero' | 'resource')
   * @param stat - 目标统计项（建筑类型 / 技能ID / 资源类型）
   * @returns 加成值（百分比，如 20 表示 +20%）
   *
   * @example
   * ```ts
   * // 建筑系统查询农田产出加成
   * const farmBonus = linkSystem.getTechBonus('building', 'farm');
   * // → 20（表示 +20%）
   *
   * // 武将系统查询骑兵冲锋技能加成
   * const cavalryBonus = linkSystem.getTechBonus('hero', 'cavalry_charge');
   * // → 20（表示 +20%）
   *
   * // 资源系统查询粮草产出加成
   * const grainBonus = linkSystem.getTechBonus('resource', 'grain');
   * // → 25（表示 +25%）
   * ```
   */
  getTechBonus(system: LinkTarget, stat: string): number {
    switch (system) {
      case 'building':
        return this.getBuildingLinkBonus(stat).productionBonus;
      case 'hero':
        return this.getHeroLinkBonus(stat).enhanceBonus;
      case 'resource':
        return this.getResourceLinkBonus(stat).productionBonus;
      default:
        return 0;
    }
  }

  /**
   * 统一联动加成乘数查询接口
   *
   * 返回 1 + bonus/100 的系数，方便直接乘法运算。
   *
   * @param system - 目标系统类型
   * @param stat - 目标统计项
   * @returns 乘数（如 1.2 表示 ×1.2）
   */
  getTechBonusMultiplier(system: LinkTarget, stat: string): number {
    return 1 + this.getTechBonus(system, stat) / 100;
  }
}
