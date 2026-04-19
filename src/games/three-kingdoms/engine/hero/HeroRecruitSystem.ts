/**
 * 武将招募系统 — 聚合根
 *
 * 职责：招募概率计算、保底计数、抽卡执行、重复武将处理
 * 规则：依赖 HeroSystem（添加武将/碎片），通过回调解耦资源消耗
 *
 * @module engine/hero/HeroRecruitSystem
 */

import type { Quality, GeneralData } from './hero.types';
import { Quality as Q, QUALITY_ORDER } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import {
  RECRUIT_COSTS,
  TEN_PULL_DISCOUNT,
  RECRUIT_RATES,
  RECRUIT_PITY,
  RECRUIT_SAVE_VERSION,
} from './hero-recruit-config';
import type { RecruitType, QualityRate, PityConfig } from './hero-recruit-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 单次招募结果 */
export interface RecruitResult {
  general: GeneralData;
  /** 是否为重复武将 */
  isDuplicate: boolean;
  /** 转化碎片数（重复时 > 0） */
  fragmentCount: number;
  quality: Quality;
}

/** 招募执行结果（单抽或十连） */
export interface RecruitOutput {
  type: RecruitType;
  results: RecruitResult[];
  cost: { resourceType: string; amount: number };
}

/** 保底计数器状态 */
export interface PityState {
  /** 普通招募已抽次数（自上次出稀有+以来） */
  normalPity: number;
  /** 高级招募已抽次数（自上次出稀有+以来） */
  advancedPity: number;
  /** 普通招募硬保底计数（自上次出史诗+以来） */
  normalHardPity: number;
  /** 高级招募硬保底计数（自上次出史诗+以来） */
  advancedHardPity: number;
}

/** 招募系统存档数据 */
export interface RecruitSaveData {
  version: number;
  pity: PityState;
  /** 招募历史记录（最近20条） */
  history?: RecruitHistoryEntry[];
}

/** 资源消耗回调 */
export type ResourceSpendFn = (resourceType: string, amount: number) => boolean;
/** 资源检查回调 */
export type ResourceCheckFn = (resourceType: string, amount: number) => boolean;

/** 招募历史条目 */
export interface RecruitHistoryEntry {
  /** 招募时间戳 */
  timestamp: number;
  /** 招募类型 */
  type: RecruitType;
  /** 招募结果 */
  results: RecruitResult[];
  /** 消耗 */
  cost: { resourceType: string; amount: number };
}

/** 最大历史记录数 */
const MAX_HISTORY_SIZE = 20;

/** 招募系统业务依赖（通过回调解耦 ResourceSystem） */
export interface RecruitDeps {
  heroSystem: HeroSystem;
  /** 资源消耗回调 — 返回 true 表示消耗成功 */
  spendResource: ResourceSpendFn;
  /** 资源检查回调 — 返回 true 表示资源充足 */
  canAffordResource: ResourceCheckFn;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function createEmptyPity(): PityState {
  return { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 };
}

/** 累积概率法抽取品质 */
function rollQuality(rates: readonly QualityRate[], rng: () => number): Quality {
  const roll = rng();
  let cumulative = 0;
  for (const entry of rates) {
    cumulative += entry.rate;
    if (roll < cumulative) return entry.quality;
  }
  return rates[rates.length - 1].quality;
}

/** 保底修正：硬保底（史诗+）优先于十连保底（稀有+） */
function applyPity(
  baseQuality: Quality,
  pityCount: number,
  hardPityCount: number,
  config: PityConfig,
): Quality {
  if (hardPityCount >= config.hardPityThreshold - 1) {
    if (QUALITY_ORDER[baseQuality] < QUALITY_ORDER[config.hardPityMinQuality]) {
      return config.hardPityMinQuality;
    }
  }
  if (pityCount >= config.tenPullThreshold - 1) {
    if (QUALITY_ORDER[baseQuality] < QUALITY_ORDER[config.tenPullMinQuality]) {
      return config.tenPullMinQuality;
    }
  }
  return baseQuality;
}

/** 按品质从武将定义池中随机选择一个武将ID */
function pickGeneralByQuality(
  heroSystem: HeroSystem,
  quality: Quality,
  rng: () => number,
): string | null {
  const candidates = heroSystem.getAllGeneralDefs().filter((def) => def.quality === quality);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)].id;
}

// ─────────────────────────────────────────────
// HeroRecruitSystem
// ─────────────────────────────────────────────

/**
 * 武将招募系统
 *
 * 管理普通招募和高级招募的完整流程：
 * - 概率计算与品质抽取（含保底修正）
 * - 保底计数器（10连稀有+、50抽史诗+）
 * - 重复武将自动转化为碎片
 * - 资源消耗通过回调解耦
 *
 * @example
 * ```ts
 * const recruit = new HeroRecruitSystem();
 * recruit.setRecruitDeps({ heroSystem, spendResource, canAffordResource });
 * const result = recruit.recruitSingle('advanced');
 * ```
 */
export class HeroRecruitSystem implements ISubsystem {
  readonly name = 'heroRecruit' as const;
  private deps: ISystemDeps | null = null;
  private recruitDeps: RecruitDeps | null = null;
  private pity: PityState;
  private rng: () => number;
  private history: RecruitHistoryEntry[];

  constructor(rng: () => number = Math.random) {
    this.pity = createEmptyPity();
    this.rng = rng;
    this.history = [];
  }

  // ── ISubsystem 适配层 ──

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留：每日免费次数重置等 */ }
  getState(): unknown { return this.serialize(); }
  reset(): void { this.pity = createEmptyPity(); this.history = []; }

  // ─────────────────────────────────────────
  // 1. 依赖注入
  // ─────────────────────────────────────────

  /** 设置业务依赖（HeroSystem + 资源回调） */
  setRecruitDeps(deps: RecruitDeps): void { this.recruitDeps = deps; }

  /** 注入随机数生成器（测试用） */
  setRng(rng: () => number): void { this.rng = rng; }

  // ─────────────────────────────────────────
  // 2. 招募消耗计算
  // ─────────────────────────────────────────

  /** 计算招募消耗 */
  getRecruitCost(type: RecruitType, count: number): { resourceType: string; amount: number } {
    const cfg = RECRUIT_COSTS[type];
    const base = cfg.amount * count;
    const amount = count === 10 ? Math.floor(base * TEN_PULL_DISCOUNT) : base;
    return { resourceType: cfg.resourceType, amount };
  }

  /** 检查是否有足够资源进行招募 */
  canRecruit(type: RecruitType, count: number): boolean {
    if (!this.recruitDeps) return false;
    const cost = this.getRecruitCost(type, count);
    return this.recruitDeps.canAffordResource(cost.resourceType, cost.amount);
  }

  // ─────────────────────────────────────────
  // 3. 保底状态查询
  // ─────────────────────────────────────────

  /** 获取当前保底计数器状态（只读副本） */
  getGachaState(): Readonly<PityState> { return { ...this.pity }; }

  /** 距离下次十连保底的剩余次数 */
  getNextTenPullPity(type: RecruitType): number {
    const config = RECRUIT_PITY[type];
    const count = type === 'normal' ? this.pity.normalPity : this.pity.advancedPity;
    return Math.max(0, config.tenPullThreshold - count);
  }

  /** 距离下次硬保底的剩余次数 */
  getNextHardPity(type: RecruitType): number {
    const config = RECRUIT_PITY[type];
    const count = type === 'normal' ? this.pity.normalHardPity : this.pity.advancedHardPity;
    return Math.max(0, config.hardPityThreshold - count);
  }

  /** 获取招募历史记录（最近10条，最新在前） */
  getRecruitHistory(): Readonly<RecruitHistoryEntry[]> {
    return [...this.history].reverse();
  }

  /** 获取招募历史记录数量 */
  getRecruitHistoryCount(): number {
    return this.history.length;
  }

  /** 清空招募历史 */
  clearRecruitHistory(): void {
    this.history = [];
  }

  // ─────────────────────────────────────────
  // 4. 核心招募逻辑
  // ─────────────────────────────────────────

  /**
   * 单次招募
   *
   * 流程：检查资源 → 扣除 → 概率抽取（含保底）→ 选武将 → 处理重复 → 更新计数器
   *
   * @returns 招募结果，或 null（资源不足/依赖未设置）
   */
  recruitSingle(type: RecruitType): RecruitOutput | null {
    return this.executeRecruit(type, 1);
  }

  /**
   * 十连招募
   *
   * 连续执行 10 次抽卡，保底机制保证第 10 次必出稀有+。
   *
   * @returns 招募结果，或 null（资源不足/依赖未设置）
   */
  recruitTen(type: RecruitType): RecruitOutput | null {
    return this.executeRecruit(type, 10);
  }

  // ─────────────────────────────────────────
  // 5. 序列化/反序列化
  // ─────────────────────────────────────────

  /** 序列化（保存保底计数器和招募历史） */
  serialize(): RecruitSaveData {
    return {
      version: RECRUIT_SAVE_VERSION,
      pity: { ...this.pity },
      history: [...this.history],
    };
  }

  /** 反序列化恢复保底计数器和招募历史 */
  deserialize(data: RecruitSaveData): void {
    if (data.version !== RECRUIT_SAVE_VERSION) {
      console.warn(
        `HeroRecruitSystem: 存档版本不匹配 (期望 ${RECRUIT_SAVE_VERSION}，实际 ${data.version})`,
      );
    }
    this.pity = {
      normalPity: data.pity.normalPity ?? 0,
      advancedPity: data.pity.advancedPity ?? 0,
      normalHardPity: data.pity.normalHardPity ?? 0,
      advancedHardPity: data.pity.advancedHardPity ?? 0,
    };
    // 恢复招募历史（兼容无 history 字段的旧存档）
    if (Array.isArray(data.history)) {
      this.history = data.history.slice(-MAX_HISTORY_SIZE);
    } else {
      this.history = [];
    }
  }

  // ─────────────────────────────────────────
  // 6. 内部方法
  // ─────────────────────────────────────────

  /** 执行招募（单抽/十连统一入口） */
  private executeRecruit(type: RecruitType, count: number): RecruitOutput | null {
    if (!this.recruitDeps) return null;

    const cost = this.getRecruitCost(type, count);
    if (!this.recruitDeps.canAffordResource(cost.resourceType, cost.amount)) return null;
    if (!this.recruitDeps.spendResource(cost.resourceType, cost.amount)) return null;

    const results: RecruitResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.executeSinglePull(type));
    }

    const output: RecruitOutput = { type, results, cost };

    // 记录到招募历史
    this.history.push({
      timestamp: Date.now(),
      type,
      results: output.results,
      cost: output.cost,
    });
    // 保留最近 MAX_HISTORY_SIZE 条
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }

    return output;
  }

  /** 执行单次抽卡：概率抽取 → 保底修正 → 选武将 → 处理重复 → 更新计数器 */
  private executeSinglePull(type: RecruitType): RecruitResult {
    const heroSystem = this.recruitDeps!.heroSystem;
    const rates = RECRUIT_RATES[type];
    const config = RECRUIT_PITY[type];

    // 获取当前保底计数
    const isNormal = type === 'normal';
    const pityCount = isNormal ? this.pity.normalPity : this.pity.advancedPity;
    const hardPityCount = isNormal ? this.pity.normalHardPity : this.pity.advancedHardPity;

    // 1. 概率抽取品质 → 保底修正
    const finalQuality = applyPity(rollQuality(rates, this.rng), pityCount, hardPityCount, config);

    // 2. 从对应品质武将池中随机选择（无匹配时降级）
    const generalId = pickGeneralByQuality(heroSystem, finalQuality, this.rng)
      ?? this.fallbackPick(heroSystem, finalQuality);

    // 极端情况：完全无武将可用
    if (!generalId) {
      return {
        general: null as unknown as GeneralData,
        isDuplicate: false,
        fragmentCount: 0,
        quality: finalQuality,
      };
    }

    // 3. 确定实际品质（降级选择时可能与目标不同）
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
    this.updatePityCounters(type, resolvedQuality);

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
      const id = pickGeneralByQuality(heroSystem, order[i], this.rng);
      if (id) return id;
    }
    // 向上查找
    for (let i = start + 1; i < order.length; i++) {
      const id = pickGeneralByQuality(heroSystem, order[i], this.rng);
      if (id) return id;
    }
    return null;
  }

  /**
   * 更新保底计数器
   *
   * 规则：每次 +1；出稀有+重置十连计数；出史诗+重置硬保底计数
   */
  private updatePityCounters(type: RecruitType, quality: Quality): void {
    const config = RECRUIT_PITY[type];
    const isNormal = type === 'normal';

    // 基础计数 +1
    if (isNormal) {
      this.pity.normalPity += 1;
      this.pity.normalHardPity += 1;
    } else {
      this.pity.advancedPity += 1;
      this.pity.advancedHardPity += 1;
    }

    // 出稀有+品质：重置十连保底计数
    if (QUALITY_ORDER[quality] >= QUALITY_ORDER[config.tenPullMinQuality]) {
      if (isNormal) this.pity.normalPity = 0;
      else this.pity.advancedPity = 0;
    }

    // 出史诗+品质：重置硬保底计数
    if (QUALITY_ORDER[quality] >= QUALITY_ORDER[config.hardPityMinQuality]) {
      if (isNormal) this.pity.normalHardPity = 0;
      else this.pity.advancedHardPity = 0;
    }
  }
}
