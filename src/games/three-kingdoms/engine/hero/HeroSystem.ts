/**
 * 武将域 — 聚合根
 *
 * 职责：武将状态管理、战力计算、碎片管理
 * 序列化逻辑已拆分到 HeroSerializer
 * 规则：可引用 hero-config 和 hero.types，禁止引用其他域的 System
 *
 * @module engine/hero/HeroSystem
 */

import type {
  Quality,
  GeneralData,
  HeroState,
  HeroSaveData,
  Faction,
} from './hero.types';
import {
  GENERAL_DEFS,
  GENERAL_DEF_MAP,
  QUALITY_MULTIPLIERS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
  HERO_MAX_LEVEL,
  LEVEL_EXP_TABLE,
  DUPLICATE_FRAGMENT_COUNT,
  STAR_UP_FRAGMENT_COST,
  SYNTHESIZE_REQUIRED_FRAGMENTS,
} from './hero-config';
import { getStarMultiplier } from './star-up-config';
import { createEmptyState, cloneGeneral, serializeHeroState, deserializeHeroState } from './HeroSerializer';
import type { ISubsystem, ISystemDeps } from '../../core/types';

/**
 * 武将系统 — 管理玩家的武将集合、碎片背包、战力计算
 *
 * 实现 ISubsystem 接口，可注册到引擎子系统注册表中。
 */
export class HeroSystem implements ISubsystem {
  readonly name = 'hero' as const;
  private deps: ISystemDeps | null = null;
  private state: HeroState;
  /**
   * 等级上限回调（由引擎层注入 HeroStarSystem.getLevelCap）。
   * 未注入时 fallback 到 HERO_MAX_LEVEL(50)。
   */
  private _getLevelCap: ((generalId: string) => number) | null = null;
  /**
   * 装备战力回调（由引擎层注入 EquipmentSystem 聚合）。
   * 返回指定武将的装备总战力，未注入时 fallback 到 0。
   */
  private _getEquipmentPower: ((generalId: string) => number) | null = null;
  /**
   * 羁绊系数回调（由引擎层注入 BondSystem.getBondMultiplier）。
   * 返回编队羁绊总系数，未注入时 fallback 到 1.0（无羁绊加成）。
   */
  private _getBondMultiplier: ((generalIds: string[]) => number) | null = null;

  constructor() {
    this.state = createEmptyState();
  }

  /** 注入等级上限回调 */
  setLevelCapGetter(fn: (generalId: string) => number): void {
    this._getLevelCap = fn;
  }

  /** 注入装备战力回调（PRD: 装备系数 = 1 + 装备总战力 / 1000） */
  setEquipmentPowerGetter(fn: (generalId: string) => number): void {
    this._getEquipmentPower = fn;
  }

  /** 注入羁绊系数回调（PRD: 羁绊系数 = BondSystem.getBondMultiplier，1.0~2.0） */
  setBondMultiplierGetter(fn: (generalIds: string[]) => number): void {
    this._getBondMultiplier = fn;
  }

  /** 获取武将当前等级上限 */
  getMaxLevel(generalId: string): number {
    return this._getLevelCap ? this._getLevelCap(generalId) : HERO_MAX_LEVEL;
  }

  // ── ISubsystem 适配层 ──

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 预留：后续可在此处理武将恢复、离线经验等 */
  update(_dt: number): void {}

  /** 适配 serialize() */
  getState(): unknown {
    return this.serialize();
  }

  /** 重置到初始状态 */
  reset(): void {
    this.state = createEmptyState();
  }

  // ── 1. 武将管理 ──

  /**
   * 添加武将到玩家集合
   * @param generalId - 武将定义ID（如 'guanyu'）
   * @returns 新创建的武将数据，或 null（已存在/未找到定义）
   */
  addGeneral(generalId: string): GeneralData | null {
    if (this.state.generals[generalId]) return null;

    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) return null;

    const general: GeneralData = {
      id: def.id,
      name: def.name,
      quality: def.quality,
      baseStats: { ...def.baseStats },
      level: 1,
      exp: 0,
      faction: def.faction,
      skills: def.skills.map((s) => ({ ...s })),
    };

    this.state.generals[generalId] = general;
    return cloneGeneral(general);
  }

  /** 移除武将，返回被移除的武将数据或 null */
  removeGeneral(generalId: string): GeneralData | null {
    const general = this.state.generals[generalId];
    if (!general) return null;
    const removed = cloneGeneral(general);
    delete this.state.generals[generalId];
    return removed;
  }

  /** 获取单个武将的只读副本 */
  getGeneral(generalId: string): Readonly<GeneralData> | undefined {
    const g = this.state.generals[generalId];
    return g ? cloneGeneral(g) : undefined;
  }

  /** 获取所有已拥有武将的只读副本数组 */
  getAllGenerals(): Readonly<GeneralData>[] {
    return Object.values(this.state.generals).map(cloneGeneral);
  }

  /** 检查是否拥有指定武将 */
  hasGeneral(generalId: string): boolean {
    return generalId in this.state.generals;
  }

  /** 获取已拥有武将数量 */
  getGeneralCount(): number {
    return Object.keys(this.state.generals).length;
  }

  // ── 2. 战力计算 ──

  /**
   * 计算单个武将的战力
   *
   * 公式：战力 = (ATK×2.0 + CMD×1.5 + INT×2.0 + POL×1.0) × 等级系数 × 星级系数 × 装备系数 × 羁绊系数
   * 等级系数 = 1 + 等级 × 0.05
   * 星级系数 = getStarMultiplier(star)，每星递增（1星=1.0, 2星=1.15, 3星=1.35, ...）
   * 装备系数 = 1 + totalEquipmentPower / 1000
   * 羁绊系数 = BondSystem.getBondMultiplier(formationIds)，默认 1.0（无羁绊）
   * 注: 源码字段 defense↔CMD, speed↔POL, 属性命名待后续统一
   *
   * @param general - 武将数据
   * @param star - 武将星级（默认1），由 HeroStarSystem.getStar() 提供
   * @param totalEquipmentPower - 武将装备总战力，默认使用注入的装备战力回调；未注入时 fallback 到 0
   * @param bondMultiplier - 羁绊系数，默认使用注入的羁绊回调；未注入时 fallback 到 1.0
   */
  calculatePower(general: GeneralData, star = 1, totalEquipmentPower?: number, bondMultiplier?: number): number {
    const { attack, defense, intelligence, speed } = general.baseStats;
    const { attack: wA, defense: wD, intelligence: wI, speed: wS } = POWER_WEIGHTS;
    const statsPower = attack * wA + defense * wD + intelligence * wI + speed * wS;
    const levelCoeff = 1 + general.level * LEVEL_COEFFICIENT_PER_LEVEL;
    const qualityCoeff = QUALITY_MULTIPLIERS[general.quality];
    const starCoeff = getStarMultiplier(star);
    // P0-2: 优先使用显式传入的装备战力，否则从注入的回调获取，最终 fallback 到 0
    const equipPower = totalEquipmentPower ?? this._getEquipmentPower?.(general.id) ?? 0;
    const equipmentCoeff = 1 + equipPower / 1000;
    // P0-R6-1: 羁绊系数作为第5乘区，优先使用显式传入值，否则 fallback 到 1.0
    const bondCoeff = bondMultiplier ?? 1.0;
    return Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff);
  }

  /**
   * 计算全体武将总战力（不含羁绊系数）
   *
   * 语义说明：羁绊是编队级概念（依赖编队中武将组合），而此方法
   * 遍历全体武将，不存在"编队"上下文，因此不含羁绊系数。
   * 如需含羁绊的编队战力，请使用 calculateFormationPower()。
   */
  calculateTotalPower(): number {
    return Object.values(this.state.generals)
      .reduce((sum, g) => sum + this.calculatePower(g), 0);
  }

  /**
   * 计算编队武将总战力（含羁绊系数）
   *
   * 羁绊系数基于编队整体计算，乘以编队总战力。
   * 羁绊系数优先级：显式参数 > 注入回调 > 默认1.0（与 calculatePower 设计一致）
   *
   * @param generalIds - 编队中的武将ID列表
   * @param getStar - 获取武将星级的回调
   * @param bondMultiplier - 羁绊系数（可选），优先级高于注入回调；未传入时使用 setBondMultiplierGetter 注入的回调
   */
  calculateFormationPower(generalIds: string[], getStar?: (id: string) => number, bondMultiplier?: number): number {
    const starGetter = getStar ?? (() => 1);
    // 计算编队基础战力（不含羁绊）
    let basePower = 0;
    for (const id of generalIds) {
      const g = this.state.generals[id];
      if (g) basePower += this.calculatePower(g, starGetter(id));
    }
    // 羁绊系数优先级：显式参数 > 注入回调 > 默认 1.0（与 calculatePower 一致）
    const bondCoeff = bondMultiplier ?? this._getBondMultiplier?.(generalIds) ?? 1.0;
    return Math.floor(basePower * bondCoeff);
  }

  // ── 3. 碎片管理 ──

  /** 碎片上限常量 */
  static readonly FRAGMENT_CAP = 999;

  /** 溢出碎片→铜钱转化比率（1碎片 = 100铜钱） */
  static readonly FRAGMENT_TO_GOLD_RATE = 100;

  /**
   * 添加武将碎片（count 必须 > 0）
   *
   * 碎片上限 999，超出部分返回给调用方转化为铜钱。
   * @returns 溢出的碎片数量（用于转化为铜钱：1碎片 = 100铜钱）
   */
  addFragment(generalId: string, count: number): number {
    if (count <= 0) return 0;
    const current = this.state.fragments[generalId] ?? 0;
    const newTotal = current + count;
    const cap = HeroSystem.FRAGMENT_CAP;

    if (newTotal <= cap) {
      this.state.fragments[generalId] = newTotal;
      return 0;
    }

    this.state.fragments[generalId] = cap;
    return newTotal - cap;
  }

  /** 消耗武将碎片，碎片不足返回 false */
  useFragments(generalId: string, count: number): boolean {
    const current = this.state.fragments[generalId] ?? 0;
    if (current < count) return false;
    this.state.fragments[generalId] = current - count;
    if (this.state.fragments[generalId] === 0) {
      delete this.state.fragments[generalId];
    }
    return true;
  }

  /** 获取指定武将的碎片数量 */
  getFragments(generalId: string): number {
    return this.state.fragments[generalId] ?? 0;
  }

  /** 获取所有碎片信息的副本 */
  getAllFragments(): Readonly<Record<string, number>> {
    return { ...this.state.fragments };
  }

  /** 处理重复武将 — 按品质转化为碎片，返回碎片数量 */
  handleDuplicate(generalId: string, quality: Quality): number {
    const fragments = DUPLICATE_FRAGMENT_COUNT[quality];
    this.addFragment(generalId, fragments);
    return fragments;
  }

  /**
   * 碎片合成武将
   *
   * 当指定武将的碎片数量达到合成所需数量时，消耗碎片并添加武将。
   * 合成所需碎片数量按品质区分：
   *   COMMON=20 / FINE=40 / RARE=80 / EPIC=150 / LEGENDARY=300
   *
   * @returns 合成后的武将数据，或 null（碎片不足/已拥有/未找到定义）
   */
  fragmentSynthesize(generalId: string): GeneralData | null {
    // 已拥有则不能合成
    if (this.state.generals[generalId]) return null;

    // 检查武将定义是否存在
    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) return null;

    // 按品质获取所需碎片数量
    const required = SYNTHESIZE_REQUIRED_FRAGMENTS[def.quality];
    const current = this.state.fragments[generalId] ?? 0;
    if (current < required) return null;

    // 消耗碎片
    this.state.fragments[generalId] = current - required;
    if (this.state.fragments[generalId] === 0) {
      delete this.state.fragments[generalId];
    }

    // 添加武将
    return this.addGeneral(generalId);
  }

  /** 获取碎片合成所需数量（按武将品质区分） */
  getSynthesizeCost(generalId: string): number {
    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) return 0;
    return SYNTHESIZE_REQUIRED_FRAGMENTS[def.quality];
  }

  /** 检查指定武将是否可合成 */
  canSynthesize(generalId: string): boolean {
    if (this.state.generals[generalId]) return false;
    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) return false;
    const required = SYNTHESIZE_REQUIRED_FRAGMENTS[def.quality];
    return (this.state.fragments[generalId] ?? 0) >= required;
  }

  /**
   * 获取碎片合成进度
   *
   * @returns { current: number, required: number } 当前碎片数和所需碎片数
   */
  getSynthesizeProgress(generalId: string): { current: number; required: number } {
    const def = GENERAL_DEF_MAP.get(generalId);
    const required = def ? SYNTHESIZE_REQUIRED_FRAGMENTS[def.quality] : 0;
    return {
      current: this.state.fragments[generalId] ?? 0,
      required,
    };
  }

  // ── 4. 升级经验 ──

  /** 获取指定等级升级所需经验 */
  getExpRequired(level: number): number {
    for (const tier of LEVEL_EXP_TABLE) {
      if (level >= tier.levelMin && level <= tier.levelMax) {
        return level * tier.expPerLevel;
      }
    }
    return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
  }

  /** 获取指定等级升级所需铜钱 */
  getGoldRequired(level: number): number {
    for (const tier of LEVEL_EXP_TABLE) {
      if (level >= tier.levelMin && level <= tier.levelMax) {
        return level * tier.goldPerLevel;
      }
    }
    return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
  }

  /**
   * 直接设置武将等级和经验（供 HeroLevelSystem 同步状态使用）
   * @returns 更新后的武将数据，或 undefined
   */
  setLevelAndExp(generalId: string, level: number, exp: number): Readonly<GeneralData> | undefined {
    const general = this.state.generals[generalId];
    if (!general) return undefined;
    general.level = level;
    general.exp = exp;
    return cloneGeneral(general);
  }

  /**
   * 更新指定武将的技能等级（供 SkillUpgradeSystem 使用）
   * @param generalId - 武将ID
   * @param skillIndex - 技能索引
   * @param newLevel - 新的技能等级
   * @returns 更新后的武将数据，或 undefined
   */
  updateSkillLevel(generalId: string, skillIndex: number, newLevel: number): Readonly<GeneralData> | undefined {
    const general = this.state.generals[generalId];
    if (!general) return undefined;
    if (skillIndex < 0 || skillIndex >= general.skills.length) return undefined;
    general.skills[skillIndex] = { ...general.skills[skillIndex], level: newLevel };
    return cloneGeneral(general);
  }

  /**
   * 给武将增加经验，自动处理升级
   * @returns 升级后的武将数据和升级次数，或 null（不存在/已满级）
   */
  addExp(generalId: string, exp: number): { general: GeneralData; levelsGained: number } | null {
    const general = this.state.generals[generalId];
    if (!general) return null;
    const maxLevel = this.getMaxLevel(generalId);
    if (general.level >= maxLevel) return null;

    let levelsGained = 0;
    let remainingExp = exp;

    while (remainingExp > 0 && general.level < maxLevel) {
      const required = this.getExpRequired(general.level);
      const currentExp = general.exp + remainingExp;
      if (currentExp >= required) {
        remainingExp = currentExp - required;
        general.level += 1;
        general.exp = 0;
        levelsGained += 1;
      } else {
        general.exp = currentExp;
        remainingExp = 0;
      }
    }

    return { general: cloneGeneral(general), levelsGained };
  }

  // ── 5. 查询工具 ──

  /** 按阵营筛选武将 */
  getGeneralsByFaction(faction: Faction): Readonly<GeneralData>[] {
    return Object.values(this.state.generals)
      .filter((g) => g.faction === faction)
      .map(cloneGeneral);
  }

  /** 按品质筛选武将 */
  getGeneralsByQuality(quality: Quality): Readonly<GeneralData>[] {
    return Object.values(this.state.generals)
      .filter((g) => g.quality === quality)
      .map(cloneGeneral);
  }

  /** 按战力排序获取武将列表（默认降序） */
  getGeneralsSortedByPower(descending = true): Readonly<GeneralData>[] {
    const list = Object.values(this.state.generals).map(cloneGeneral);
    const dir = descending ? -1 : 1;
    list.sort((a, b) => dir * (this.calculatePower(a) - this.calculatePower(b)));
    return list;
  }

  /** 获取所有可用的武将定义（静态配置） */
  getAllGeneralDefs(): Readonly<typeof GENERAL_DEFS[number][]> {
    return [...GENERAL_DEFS];
  }

  /** 根据ID获取武将定义 */
  getGeneralDef(generalId: string): Readonly<typeof GENERAL_DEFS[number]> | undefined {
    return GENERAL_DEF_MAP.get(generalId);
  }

  // ── 6. 序列化/反序列化（委托 HeroSerializer） ──

  /** 序列化武将系统状态 */
  serialize(): HeroSaveData {
    return serializeHeroState(this.state);
  }

  /** 反序列化恢复武将系统状态 */
  deserialize(data: HeroSaveData): void {
    this.state = deserializeHeroState(data);
  }
}
