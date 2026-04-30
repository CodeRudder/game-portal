/**
 * 武将招募系统 — 聚合根
 *
 * 职责：招募概率计算、保底计数、抽卡执行、重复武将处理
 * 规则：依赖 HeroSystem（添加武将/碎片），通过回调解耦资源消耗
 *
 * UP 武将管理委托给 HeroRecruitUpManager。
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
  ResourceSpendFn,
  ResourceCheckFn,
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
  todayDateString,
  rollQuality,
  applyPity,
  pickGeneralByQuality,
  MAX_HISTORY_SIZE,
} from './recruit-types';
import type { Quality, GeneralData } from './hero.types';
import { Quality as Q, QUALITY_ORDER } from './hero.types';
import type { HeroSystem } from './HeroSystem';
import { HeroSystem as HeroSystemClass } from './HeroSystem';
import { DUPLICATE_FRAGMENT_COUNT } from './hero-config';
import {
  RECRUIT_COSTS,
  TEN_PULL_DISCOUNT,
  RECRUIT_RATES,
  RECRUIT_PITY,
  RECRUIT_SAVE_VERSION,
  DAILY_FREE_CONFIG,
} from './hero-recruit-config';
import type { RecruitType } from './hero-recruit-config';
import { HeroRecruitUpManager } from './HeroRecruitUpManager';
import { gameLog } from '../../core/logger';

export class HeroRecruitSystem implements ISubsystem {
  readonly name = 'heroRecruit' as const;
  private deps: ISystemDeps | null = null;
  private recruitDeps: RecruitDeps | null = null;
  private pity: PityState;
  private freeRecruit: FreeRecruitState;
  private rng: () => number;
  private history: RecruitHistoryEntry[];
  /** UP 武将管理子系统（依赖注入） */
  private readonly upManager: HeroRecruitUpManager;

  constructor(rng: () => number = Math.random) {
    this.pity = createEmptyPity();
    this.freeRecruit = createEmptyFreeRecruit();
    this.rng = rng;
    this.history = [];
    this.upManager = new HeroRecruitUpManager();
  }

  // ── ISubsystem 适配层 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.upManager.init(deps);
  }
  update(_dt: number): void { this.checkDailyReset(); }
  getState(): unknown { return this.serialize(); }
  reset(): void {
    this.pity = createEmptyPity();
    this.freeRecruit = createEmptyFreeRecruit();
    this.history = [];
    this.upManager.reset();
  }

  // ─────────────────────────────────────────
  // 1. 依赖注入
  // ─────────────────────────────────────────

  /** 设置业务依赖（HeroSystem + 资源回调） */
  setRecruitDeps(deps: RecruitDeps): void { this.recruitDeps = deps; }

  /** 注入随机数生成器（测试用） */
  setRng(rng: () => number): void { this.rng = rng; }

  /** 获取 UP 武将管理子系统 */
  getUpManager(): HeroRecruitUpManager { return this.upManager; }

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
  getRecruitHistoryCount(): number { return this.history.length; }

  /** 清空招募历史 */
  clearRecruitHistory(): void { this.history = []; }

  // ─────────────────────────────────────────
  // 3.5 UP 武将管理（委托给 HeroRecruitUpManager）
  // ─────────────────────────────────────────

  /** 设置当前 UP 武将（仅高级招募生效） */
  setUpHero(generalId: string | null, rate?: number): void {
    this.upManager.setUpHero(generalId, rate);
  }

  /** 获取当前 UP 武将状态 */
  getUpHeroState(): Readonly<UpHeroState> {
    return this.upManager.getUpHeroState();
  }

  /** 清除 UP 武将 */
  clearUpHero(): void { this.upManager.clearUpHero(); }

  // ─────────────────────────────────────────
  // 3.6 每日免费招募
  // ─────────────────────────────────────────

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

  /** 使用免费招募（单次，不消耗资源） */
  freeRecruitSingle(type: RecruitType): RecruitOutput | null {
    if (!this.recruitDeps) return null;
    this.checkDailyReset();
    if (!this.canFreeRecruit(type)) return null;

    this.freeRecruit.usedFreeCount[type] += 1;

    const results: RecruitResult[] = [this.executeSinglePull(type)];
    const output: RecruitOutput = { type, results, cost: { resourceType: 'free', amount: 0 } };

    this.pushHistory(output);
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
      upHero: this.upManager.serializeUpHero(),
      history: [...this.history],
    };
  }

  deserialize(data: RecruitSaveData): void {
    if (!data) {
      this.pity = { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 };
      this.freeRecruit = createEmptyFreeRecruit();
      this.history = [];
      this.upManager.deserializeUpHero({ version: RECRUIT_SAVE_VERSION, pity: this.pity, freeRecruit: this.freeRecruit, upHero: { upGeneralId: null, upRate: 0, description: '' }, history: [] });
      return;
    }
    if (data.version !== RECRUIT_SAVE_VERSION) {
      gameLog.warn(
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
    this.upManager.deserializeUpHero(data);
    if (Array.isArray(data.history)) {
      this.history = data.history.slice(-MAX_HISTORY_SIZE);
    } else {
      this.history = [];
    }
  }

  // ─────────────────────────────────────────
  // 6. 内部方法
  // ─────────────────────────────────────────

  /** 记录到招募历史 */
  private pushHistory(output: RecruitOutput): void {
    this.history.push({ timestamp: Date.now(), type: output.type, results: output.results, cost: output.cost });
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }
  }

  private executeRecruit(type: RecruitType, count: number): RecruitOutput | null {
    if (!this.recruitDeps) return null;

    const cost = this.getRecruitCost(type, count);
    if (!this.recruitDeps.canAffordResource(cost.resourceType, cost.amount)) return null;
    if (!this.recruitDeps.spendResource(cost.resourceType, cost.amount)) return null;

    const results: RecruitResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push(this.executeSinglePull(type));
    }

    if (count > 1) {
      results.sort((a, b) => {
        const qa = QUALITY_ORDER[a.quality];
        const qb = QUALITY_ORDER[b.quality];
        if (qa !== qb) return qa - qb;
        return (a.general?.id ?? '').localeCompare(b.general?.id ?? '');
      });
    }

    const output: RecruitOutput = { type, results, cost };
    this.pushHistory(output);
    return output;
  }

  private executeSinglePull(type: RecruitType): RecruitResult {
    const heroSystem = this.recruitDeps!.heroSystem;
    const rates = RECRUIT_RATES[type];
    const config = RECRUIT_PITY[type];

    const isNormal = type === 'normal';
    const pityCount = isNormal ? this.pity.normalPity : this.pity.advancedPity;
    const hardPityCount = isNormal ? this.pity.normalHardPity : this.pity.advancedHardPity;

    const finalQuality = applyPity(rollQuality(rates, this.rng), pityCount, hardPityCount, config);

    // UP 武将机制：高级招募出 LEGENDARY 时，有概率直接获得 UP 武将
    const upState = this.upManager.getUpHeroState();
    let generalId: string | null = null;
    if (
      type === 'advanced'
      && upState.upGeneralId
      && finalQuality === Q.LEGENDARY
      && this.rng() < upState.upRate
    ) {
      const upDef = heroSystem.getGeneralDef(upState.upGeneralId);
      if (upDef) {
        generalId = upState.upGeneralId;
      }
    }

    if (!generalId) {
      generalId = pickGeneralByQuality(heroSystem, finalQuality, this.rng)
        ?? this.fallbackPick(heroSystem, finalQuality);
    }

    if (!generalId) {
      return {
        general: null,
        isDuplicate: false,
        fragmentCount: 0,
        quality: finalQuality,
        isEmpty: true,
      };
    }

    const def = heroSystem.getGeneralDef(generalId);
    const resolvedQuality = def?.quality ?? finalQuality;

    const isDuplicate = heroSystem.hasGeneral(generalId);
    let fragmentCount = 0;

    if (isDuplicate) {
      const fragmentsBefore = heroSystem.getFragments(generalId);
      const expectedFragments = DUPLICATE_FRAGMENT_COUNT[resolvedQuality];
      fragmentCount = heroSystem.handleDuplicate(generalId, resolvedQuality);
      const actualGain = heroSystem.getFragments(generalId) - fragmentsBefore;
      const overflow = expectedFragments - actualGain;
      if (overflow > 0 && this.recruitDeps!.addResource) {
        this.recruitDeps!.addResource('gold', overflow * HeroSystemClass.FRAGMENT_TO_GOLD_RATE);
      }
    } else {
      heroSystem.addGeneral(generalId);
    }

    this.updatePityCounters(type, resolvedQuality);

    return {
      general: heroSystem.getGeneral(generalId)!,
      isDuplicate,
      fragmentCount,
      quality: resolvedQuality,
    };
  }

  private fallbackPick(heroSystem: HeroSystem, startQuality: Quality): string | null {
    const order = [Q.COMMON, Q.FINE, Q.RARE, Q.EPIC, Q.LEGENDARY];
    const start = order.indexOf(startQuality);

    for (let i = start - 1; i >= 0; i--) {
      const id = pickGeneralByQuality(heroSystem, order[i], this.rng);
      if (id) return id;
    }
    for (let i = start + 1; i < order.length; i++) {
      const id = pickGeneralByQuality(heroSystem, order[i], this.rng);
      if (id) return id;
    }
    return null;
  }

  private updatePityCounters(type: RecruitType, quality: Quality): void {
    const config = RECRUIT_PITY[type];
    const isNormal = type === 'normal';

    if (isNormal) {
      this.pity.normalPity += 1;
      this.pity.normalHardPity += 1;
    } else {
      this.pity.advancedPity += 1;
      this.pity.advancedHardPity += 1;
    }

    if (QUALITY_ORDER[quality] >= QUALITY_ORDER[config.tenPullMinQuality]) {
      if (isNormal) this.pity.normalPity = 0;
      else this.pity.advancedPity = 0;
    }

    if (QUALITY_ORDER[quality] >= QUALITY_ORDER[config.hardPityMinQuality]) {
      if (isNormal) this.pity.normalHardPity = 0;
      else this.pity.advancedHardPity = 0;
    }
  }
}
