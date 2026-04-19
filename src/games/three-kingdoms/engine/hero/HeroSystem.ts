/**
 * 武将域 — 聚合根
 *
 * 职责：武将状态管理、战力计算、碎片管理、序列化/反序列化
 * 规则：可引用 hero-config 和 hero.types，禁止引用其他域的 System
 *
 * @module engine/hero/HeroSystem
 */

import type {
  Quality,
  GeneralStats,
  GeneralData,
  HeroState,
  HeroSaveData,
  SkillData,
  Faction,
} from './hero.types';
import { Quality as Q, QUALITY_ORDER } from './hero.types';
import {
  GENERAL_DEFS,
  GENERAL_DEF_MAP,
  QUALITY_MULTIPLIERS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
  HERO_SAVE_VERSION,
  HERO_MAX_LEVEL,
  LEVEL_EXP_TABLE,
  DUPLICATE_FRAGMENT_COUNT,
} from './hero-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建空的武将系统状态 */
function createEmptyState(): HeroState {
  return {
    generals: {},
    fragments: {},
  };
}

/** 深拷贝武将数据 */
function cloneGeneral(g: GeneralData): GeneralData {
  return {
    ...g,
    baseStats: { ...g.baseStats },
    skills: g.skills.map((s) => ({ ...s })),
  };
}

/** 深拷贝武将系统状态 */
function cloneState(state: HeroState): HeroState {
  const generals: Record<string, GeneralData> = {};
  for (const [id, g] of Object.entries(state.generals)) {
    generals[id] = cloneGeneral(g);
  }
  return {
    generals,
    fragments: { ...state.fragments },
  };
}

// ─────────────────────────────────────────────
// HeroSystem
// ─────────────────────────────────────────────

/**
 * 武将系统
 *
 * 管理玩家的武将集合、碎片背包、战力计算。
 * 实现 ISubsystem 接口，可注册到引擎子系统注册表中。
 *
 * @example
 * ```ts
 * const hero = new HeroSystem();
 * hero.init(deps);
 *
 * // 添加武将
 * hero.addGeneral('guanyu');
 *
 * // 计算战力
 * const power = hero.calculatePower(hero.getGeneral('guanyu')!);
 *
 * // 序列化
 * const save = hero.serialize();
 * ```
 */
export class HeroSystem implements ISubsystem {
  // ── ISubsystem 接口 ──
  readonly name = 'hero' as const;
  private deps: ISystemDeps | null = null;

  /** 武将系统运行时状态 */
  private state: HeroState;

  constructor() {
    this.state = createEmptyState();
  }

  // ── ISubsystem 适配层 ──

  /** 注入依赖（事件总线、配置注册表等） */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** ISubsystem.update — 武将系统当前无 tick 逻辑，预留接口 */
  update(_dt: number): void {
    // 预留：后续可在此处理武将恢复、离线经验等
  }

  /** ISubsystem.getState — 适配 serialize() */
  getState(): unknown {
    return this.serialize();
  }

  /** ISubsystem.reset — 重置到初始状态 */
  reset(): void {
    this.state = createEmptyState();
  }

  // ─────────────────────────────────────────
  // 1. 武将管理
  // ─────────────────────────────────────────

  /**
   * 添加武将到玩家集合
   *
   * 根据武将ID查找静态配置，创建运行时实例并加入集合。
   * 如果武将已存在，返回 null 表示重复（由调用方处理碎片转化）。
   *
   * @param generalId - 武将定义ID（如 'guanyu'）
   * @returns 新创建的武将数据，或 null（已存在/未找到定义）
   */
  addGeneral(generalId: string): GeneralData | null {
    // 检查是否已拥有
    if (this.state.generals[generalId]) {
      return null;
    }

    // 查找武将定义
    const def = GENERAL_DEF_MAP.get(generalId);
    if (!def) {
      return null;
    }

    // 创建运行时武将实例
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

  /**
   * 移除武将
   *
   * @param generalId - 武将ID
   * @returns 被移除的武将数据，或 null（不存在）
   */
  removeGeneral(generalId: string): GeneralData | null {
    const general = this.state.generals[generalId];
    if (!general) return null;

    const removed = cloneGeneral(general);
    delete this.state.generals[generalId];
    return removed;
  }

  /**
   * 获取单个武将
   *
   * @param generalId - 武将ID
   * @returns 武将数据的只读副本，或 undefined
   */
  getGeneral(generalId: string): Readonly<GeneralData> | undefined {
    const g = this.state.generals[generalId];
    return g ? cloneGeneral(g) : undefined;
  }

  /**
   * 获取所有已拥有武将
   *
   * @returns 武将数据数组的只读副本
   */
  getAllGenerals(): Readonly<GeneralData>[] {
    return Object.values(this.state.generals).map(cloneGeneral);
  }

  /**
   * 检查是否拥有指定武将
   */
  hasGeneral(generalId: string): boolean {
    return generalId in this.state.generals;
  }

  /**
   * 获取已拥有武将数量
   */
  getGeneralCount(): number {
    return Object.keys(this.state.generals).length;
  }

  // ─────────────────────────────────────────
  // 2. 战力计算
  // ─────────────────────────────────────────

  /**
   * 计算单个武将的战力
   *
   * 公式（来源 PRD HER-1-3）：
   * ```
   * 战力 = (ATK × 2.0 + DEF × 1.5 + INT × 2.0 + SPD × 1.0)
   *        × 等级系数 × 品质系数
   *
   * 等级系数 = 1 + 等级 × 0.05
   * 品质系数 = QUALITY_MULTIPLIERS[quality]
   * ```
   *
   * @param general - 武将数据
   * @returns 战力数值（向下取整）
   */
  calculatePower(general: GeneralData): number {
    const { attack, defense, intelligence, speed } = general.baseStats;
    const { attack: wA, defense: wD, intelligence: wI, speed: wS } = POWER_WEIGHTS;

    // 四维加权总和
    const statsPower = attack * wA + defense * wD + intelligence * wI + speed * wS;

    // 等级系数：1 + 等级 × 0.05
    const levelCoeff = 1 + general.level * LEVEL_COEFFICIENT_PER_LEVEL;

    // 品质系数
    const qualityCoeff = QUALITY_MULTIPLIERS[general.quality];

    return Math.floor(statsPower * levelCoeff * qualityCoeff);
  }

  /**
   * 计算全体武将总战力
   *
   * @returns 所有武将战力之和
   */
  calculateTotalPower(): number {
    return Object.values(this.state.generals)
      .reduce((sum, g) => sum + this.calculatePower(g), 0);
  }

  // ─────────────────────────────────────────
  // 3. 碎片管理
  // ─────────────────────────────────────────

  /**
   * 添加武将碎片
   *
   * @param generalId - 武将ID
   * @param count - 碎片数量（必须 > 0）
   */
  addFragment(generalId: string, count: number): void {
    if (count <= 0) return;
    this.state.fragments[generalId] = (this.state.fragments[generalId] ?? 0) + count;
  }

  /**
   * 消耗武将碎片
   *
   * @param generalId - 武将ID
   * @param count - 消耗数量
   * @returns 是否消耗成功（碎片不足返回 false）
   */
  useFragments(generalId: string, count: number): boolean {
    const current = this.state.fragments[generalId] ?? 0;
    if (current < count) return false;

    this.state.fragments[generalId] = current - count;
    if (this.state.fragments[generalId] === 0) {
      delete this.state.fragments[generalId];
    }
    return true;
  }

  /**
   * 获取指定武将的碎片数量
   */
  getFragments(generalId: string): number {
    return this.state.fragments[generalId] ?? 0;
  }

  /**
   * 获取所有碎片信息
   *
   * @returns 碎片映射的副本
   */
  getAllFragments(): Readonly<Record<string, number>> {
    return { ...this.state.fragments };
  }

  /**
   * 处理重复武将 — 转化为碎片
   *
   * 根据 PRD HER-2，重复武将按品质转化为对应数量的碎片。
   *
   * @param quality - 重复武将的品质
   * @returns 转化获得的碎片数量
   */
  handleDuplicate(generalId: string, quality: Quality): number {
    const fragments = DUPLICATE_FRAGMENT_COUNT[quality];
    this.addFragment(generalId, fragments);
    return fragments;
  }

  // ─────────────────────────────────────────
  // 4. 升级经验
  // ─────────────────────────────────────────

  /**
   * 获取指定等级升级所需经验
   *
   * @param level - 当前等级
   * @returns 升到下一级所需的经验值
   */
  getExpRequired(level: number): number {
    for (const tier of LEVEL_EXP_TABLE) {
      if (level >= tier.levelMin && level <= tier.levelMax) {
        return level * tier.expPerLevel;
      }
    }
    // 超出范围则使用最后一档
    return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].expPerLevel;
  }

  /**
   * 获取指定等级升级所需铜钱
   *
   * @param level - 当前等级
   * @returns 升到下一级所需的铜钱
   */
  getGoldRequired(level: number): number {
    for (const tier of LEVEL_EXP_TABLE) {
      if (level >= tier.levelMin && level <= tier.levelMax) {
        return level * tier.goldPerLevel;
      }
    }
    return level * LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1].goldPerLevel;
  }

  /**
   * 给武将增加经验
   *
   * 自动处理升级，返回升级前后的信息。
   *
   * @param generalId - 武将ID
   * @param exp - 增加的经验值
   * @returns 升级后的武将数据和升级次数，或 null（武将不存在/已满级）
   */
  /**
   * 直接设置武将等级和经验（跳过自动升级逻辑）
   *
   * 供 HeroLevelSystem 同步状态使用，外部不应直接调用。
   *
   * @param generalId - 武将ID
   * @param level - 目标等级
   * @param exp - 目标经验
   * @returns 更新后的武将数据，或 undefined（武将不存在）
   */
  setLevelAndExp(generalId: string, level: number, exp: number): Readonly<GeneralData> | undefined {
    const general = this.state.generals[generalId];
    if (!general) return undefined;
    general.level = level;
    general.exp = exp;
    return cloneGeneral(general);
  }

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

  // ─────────────────────────────────────────
  // 5. 查询工具
  // ─────────────────────────────────────────

  /**
   * 按阵营筛选武将
   */
  getGeneralsByFaction(faction: Faction): Readonly<GeneralData>[] {
    return Object.values(this.state.generals)
      .filter((g) => g.faction === faction)
      .map(cloneGeneral);
  }

  /**
   * 按品质筛选武将
   */
  getGeneralsByQuality(quality: Quality): Readonly<GeneralData>[] {
    return Object.values(this.state.generals)
      .filter((g) => g.quality === quality)
      .map(cloneGeneral);
  }

  /**
   * 按战力排序获取武将列表
   *
   * @param descending - 是否降序（默认 true）
   */
  getGeneralsSortedByPower(descending = true): Readonly<GeneralData>[] {
    const list = Object.values(this.state.generals).map(cloneGeneral);
    const dir = descending ? -1 : 1;
    list.sort((a, b) => dir * (this.calculatePower(a) - this.calculatePower(b)));
    return list;
  }

  /**
   * 获取所有可用的武将定义（静态配置）
   *
   * 用于招募等场景，返回全量武将定义
   */
  getAllGeneralDefs(): Readonly<typeof GENERAL_DEFS[number][]> {
    return [...GENERAL_DEFS];
  }

  /**
   * 根据ID获取武将定义
   */
  getGeneralDef(generalId: string): Readonly<typeof GENERAL_DEFS[number]> | undefined {
    return GENERAL_DEF_MAP.get(generalId);
  }

  // ─────────────────────────────────────────
  // 6. 序列化/反序列化
  // ─────────────────────────────────────────

  /**
   * 序列化武将系统状态
   *
   * @returns 可存储的存档数据
   */
  serialize(): HeroSaveData {
    return {
      version: HERO_SAVE_VERSION,
      state: cloneState(this.state),
    };
  }

  /**
   * 反序列化恢复武将系统状态
   *
   * @param data - 存档数据
   */
  deserialize(data: HeroSaveData): void {
    if (data.version !== HERO_SAVE_VERSION) {
      console.warn(
        `HeroSystem: 存档版本不匹配 (期望 ${HERO_SAVE_VERSION}，实际 ${data.version})`,
      );
    }

    // 恢复武将数据
    this.state.generals = {};
    for (const [id, g] of Object.entries(data.state.generals)) {
      this.state.generals[id] = cloneGeneral(g);
    }

    // 恢复碎片数据
    this.state.fragments = { ...data.state.fragments };
  }
}
