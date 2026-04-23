/**
 * 武将招募系统 — 聚合根
 *
 * 职责：招募概率计算、保底计数、抽卡执行、重复武将处理
 * 规则：依赖 HeroSystem（添加武将/碎片），通过回调解耦资源消耗
 *
 * 核心抽卡逻辑委托给 HeroRecruitExecutor。
 *
 * @module engine/hero/HeroRecruitSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  RecruitResult,
  RecruitOutput,
  PityState,
  FreeRecruitState,
  UpHeroState,
  RecruitSaveData,
  RecruitHistoryEntry,
  RecruitDeps,
} from './recruit-types';

// Re-export for index.ts convenience
export type {
  RecruitResult,
  RecruitOutput,
  PityState,
  RecruitSaveData,
  ResourceSpendFn,
  ResourceCheckFn,
  RecruitHistoryEntry,
  RecruitDeps,
} from './recruit-types';
import {
  createEmptyPity,
  createEmptyFreeRecruit,
  createDefaultUpHero,
  todayDateString,
  MAX_HISTORY_SIZE,
} from './recruit-types';
import type { GeneralData } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import {
  RECRUIT_COSTS,
  TEN_PULL_DISCOUNT,
  RECRUIT_PITY,
  RECRUIT_SAVE_VERSION,
  DEFAULT_UP_CONFIG,
  DAILY_FREE_CONFIG,
  UP_HERO_DESCRIPTIONS,
} from './hero-recruit-config';
import type { RecruitType } from './hero-recruit-config';
import { HeroRecruitExecutor } from './HeroRecruitExecutor';

export class HeroRecruitSystem implements ISubsystem {
  readonly name = 'heroRecruit' as const;
  private deps: ISystemDeps | null = null;
  private recruitDeps: RecruitDeps | null = null;
  private pity: PityState;
  private freeRecruit: FreeRecruitState;
  private upHero: UpHeroState;
  private rng: () => number;
  private history: RecruitHistoryEntry[];
  private executor: HeroRecruitExecutor;

  constructor(rng: () => number = Math.random) {
    this.pity = createEmptyPity();
    this.freeRecruit = createEmptyFreeRecruit();
    this.upHero = createDefaultUpHero();
    this.rng = rng;
    this.history = [];
    this.executor = new HeroRecruitExecutor();
  }

  // ── ISubsystem 适配层 ──

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { this.checkDailyReset(); }
  getState(): unknown { return this.serialize(); }
  reset(): void {
    this.pity = createEmptyPity();
    this.freeRecruit = createEmptyFreeRecruit();
    this.upHero = createDefaultUpHero();
    this.history = [];
  }

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
  // 3.5 UP 武将管理
  // ─────────────────────────────────────────

  /** 设置当前 UP 武将（仅高级招募生效） */
  setUpHero(generalId: string | null, rate?: number, description?: string): void {
    this.upHero.upGeneralId = generalId;
    if (rate !== undefined) {
      this.upHero.upRate = rate;
    }
    if (description !== undefined) {
      this.upHero.description = description;
    } else if (generalId) {
      this.upHero.description = UP_HERO_DESCRIPTIONS[generalId] ?? `本期UP武将：${generalId}，概率提升！`;
    } else {
      this.upHero.description = '';
    }
  }

  /** 获取当前 UP 武将状态 */
  getUpHeroState(): Readonly<UpHeroState> {
    return { ...this.upHero };
  }

  // ─────────────────────────────────────────
  // 3.6 每日免费招募
  // ─────────────────────────────────────────

  /** 检查并执行每日免费次数重置 */
  private checkDailyReset(): void {
    const today = todayDateString();
    if (this.freeRecruit.lastResetDate !== today) {
      this.freeRecruit = createEmptyFreeRecruit();
    }
  }

  /** 获取今日剩余免费次数 */
  getRemainingFreeCount(type: RecruitType): number {
    this.checkDailyReset();
    const maxFree = DAILY_FREE_CONFIG[type].freeCount;
    const used = this.freeRecruit.usedFreeCount[type];
    return Math.max(0, maxFree - used);
  }

  /** 是否可以使用免费招募 */
  canFreeRecruit(type: RecruitType): boolean {
    return this.getRemainingFreeCount(type) > 0;
  }

  /**
   * 使用免费招募（单次）
   *
   * 不消耗资源，使用每日免费次数
   */
  freeRecruitSingle(type: RecruitType): RecruitOutput | null {
    if (!this.recruitDeps) return null;
    this.checkDailyReset();

    if (!this.canFreeRecruit(type)) return null;

    this.freeRecruit.usedFreeCount[type] += 1;

    const results: RecruitResult[] = [];
    for (let i = 0; i < 1; i++) {
      results.push(this.executeSinglePull(type));
    }

    const output: RecruitOutput = {
      type,
      results,
      cost: { resourceType: 'free', amount: 0 },
    };

    this.addHistory(output);
    return output;
  }

  /** 获取免费招募状态（只读） */
  getFreeRecruitState(): Readonly<FreeRecruitState> {
    this.checkDailyReset();
    return {
      usedFreeCount: { ...this.freeRecruit.usedFreeCount },
      lastResetDate: this.freeRecruit.lastResetDate,
    };
  }

  // ─────────────────────────────────────────
  // 4. 核心招募逻辑
  // ─────────────────────────────────────────

  /** 单次招募 */
  recruitSingle(type: RecruitType): RecruitOutput | null {
    return this.executeRecruit(type, 1);
  }

  /** 十连招募 */
  recruitTen(type: RecruitType): RecruitOutput | null {
    return this.executeRecruit(type, 10);
  }

  // ─────────────────────────────────────────
  // 5. 序列化/反序列化
  // ─────────────────────────────────────────

  serialize(): RecruitSaveData {
    return {
      version: RECRUIT_SAVE_VERSION,
      pity: { ...this.pity },
      freeRecruit: {
        usedFreeCount: { ...this.freeRecruit.usedFreeCount },
        lastResetDate: this.freeRecruit.lastResetDate,
      },
      upHero: { ...this.upHero },
      history: [...this.history],
    };
  }

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
    if (data.freeRecruit) {
      this.freeRecruit = {
        usedFreeCount: {
          normal: data.freeRecruit.usedFreeCount?.normal ?? 0,
          advanced: data.freeRecruit.usedFreeCount?.advanced ?? 0,
        },
        lastResetDate: data.freeRecruit.lastResetDate ?? todayDateString(),
      };
    } else {
      this.freeRecruit = createEmptyFreeRecruit();
    }
    if (data.upHero) {
      this.upHero = {
        upGeneralId: data.upHero.upGeneralId ?? null,
        upRate: data.upHero.upRate ?? DEFAULT_UP_CONFIG.upRate,
        description: data.upHero.description ?? DEFAULT_UP_CONFIG.description,
      };
    } else {
      this.upHero = createDefaultUpHero();
    }
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
    this.addHistory(output);
    return output;
  }

  /** 执行单次抽卡（委托给 HeroRecruitExecutor） */
  private executeSinglePull(type: RecruitType): RecruitResult {
    return this.executor.executeSinglePull(
      this.recruitDeps!.heroSystem,
      type,
      this.pity,
      this.upHero,
      this.rng,
    );
  }

  /** 记录到招募历史 */
  private addHistory(output: RecruitOutput): void {
    this.history.push({
      timestamp: Date.now(),
      type: output.type,
      results: output.results,
      cost: output.cost,
    });
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }
  }
}
