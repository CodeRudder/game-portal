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

  constructor() {
    this.state = createEmptyState();
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
   * 公式：战力 = (ATK×2.0 + DEF×1.5 + INT×2.0 + SPD×1.0) × 等级系数 × 品质系数
   * 等级系数 = 1 + 等级 × 0.05
   */
  calculatePower(general: GeneralData): number {
    const { attack, defense, intelligence, speed } = general.baseStats;
    const { attack: wA, defense: wD, intelligence: wI, speed: wS } = POWER_WEIGHTS;
    const statsPower = attack * wA + defense * wD + intelligence * wI + speed * wS;
    const levelCoeff = 1 + general.level * LEVEL_COEFFICIENT_PER_LEVEL;
    const qualityCoeff = QUALITY_MULTIPLIERS[general.quality];
    return Math.floor(statsPower * levelCoeff * qualityCoeff);
  }

  /** 计算全体武将总战力 */
  calculateTotalPower(): number {
    return Object.values(this.state.generals)
      .reduce((sum, g) => sum + this.calculatePower(g), 0);
  }

  // ── 3. 碎片管理 ──

  /** 添加武将碎片（count 必须 > 0） */
  addFragment(generalId: string, count: number): void {
    if (count <= 0) return;
    this.state.fragments[generalId] = (this.state.fragments[generalId] ?? 0) + count;
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
   * 合成所需碎片数量 = SYNTHESIZE_REQUIRED_FRAGMENTS（80）
   *
   * @returns 合成后的武将数据，或 null（碎片不足/已拥有/未找到定义）
   */
  fragmentSynthesize(generalId: string): GeneralData | null {
    // 已拥有则不能合成
    if (this.state.generals[generalId]) return null;

    // 检查武将定义是否存在
    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) return null;

    // 检查碎片数量
    const required = SYNTHESIZE_REQUIRED_FRAGMENTS;
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

  /** 获取碎片合成所需数量 */
  getSynthesizeCost(): number {
    return SYNTHESIZE_REQUIRED_FRAGMENTS;
  }

  /** 检查指定武将是否可合成 */
  canSynthesize(generalId: string): boolean {
    if (this.state.generals[generalId]) return false;
    if (!GENERAL_DEF_MAP.has(generalId)) return false;
    return (this.state.fragments[generalId] ?? 0) >= SYNTHESIZE_REQUIRED_FRAGMENTS;
  }

  /**
   * 获取碎片合成进度
   *
   * @returns { current: number, required: number } 当前碎片数和所需碎片数
   */
  getSynthesizeProgress(generalId: string): { current: number; required: number } {
    return {
      current: this.state.fragments[generalId] ?? 0,
      required: SYNTHESIZE_REQUIRED_FRAGMENTS,
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
   * 给武将增加经验，自动处理升级
   * @returns 升级后的武将数据和升级次数，或 null（不存在/已满级）
   */
  addExp(generalId: string, exp: number): { general: GeneralData; levelsGained: number } | null {
    const general = this.state.generals[generalId];
    if (!general) return null;
    if (general.level >= HERO_MAX_LEVEL) return null;

    let levelsGained = 0;
    let remainingExp = exp;

    while (remainingExp > 0 && general.level < HERO_MAX_LEVEL) {
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
