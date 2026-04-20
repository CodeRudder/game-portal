/**
 * 引擎层 — 数值验证器
 *
 * 自动化验证资源/武将/战斗/经济/转生5大平衡维度。
 * 作为 ISubsystem 门面，委托计算逻辑给 BalanceCalculator。
 *
 * @module engine/unification/BalanceValidator
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ValidationEntry,
  ValidationLevel,
  BalanceReport,
  BalanceSummary,
  ResourceBalanceConfig,
  ResourceBalanceResult,
  HeroBalanceResult,
  HeroBaseStats,
  BattleDifficultyConfig,
  BattleDifficultyResult,
  EconomyBalanceConfig,
  EconomyBalanceResult,
  RebirthBalanceConfig,
  RebirthBalanceResult,
} from '../../core/unification';
import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
  generateId,
  validateSingleResource,
  validateSingleHero,
  validateEconomy,
  calculateStagePoints,
  validateRebirth,
} from './BalanceCalculator';

// ─────────────────────────────────────────────
// 数值验证器
// ─────────────────────────────────────────────

/**
 * 数值验证器
 *
 * 自动化验证5大平衡维度，生成报告。
 */
export class BalanceValidator implements ISubsystem {
  readonly name = 'balance-validator';

  private deps!: ISystemDeps;
  private lastReport: BalanceReport | null = null;

  private resourceConfigs: ResourceBalanceConfig[] = DEFAULT_RESOURCE_CONFIGS;
  private heroStats: Record<string, HeroBaseStats> = HERO_BASE_STATS;
  private battleConfig: BattleDifficultyConfig = DEFAULT_BATTLE_CONFIG;
  private economyConfigs: EconomyBalanceConfig[] = DEFAULT_ECONOMY_CONFIGS;
  private rebirthConfig: RebirthBalanceConfig = DEFAULT_REBIRTH_CONFIG;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 验证器按需运行，不在 update 中自动执行
  }

  getState(): { lastReport: BalanceReport | null } {
    return { lastReport: this.lastReport ? { ...this.lastReport } : null };
  }

  reset(): void {
    this.lastReport = null;
    this.resourceConfigs = DEFAULT_RESOURCE_CONFIGS;
    this.heroStats = HERO_BASE_STATS;
    this.battleConfig = DEFAULT_BATTLE_CONFIG;
    this.economyConfigs = DEFAULT_ECONOMY_CONFIGS;
    this.rebirthConfig = DEFAULT_REBIRTH_CONFIG;
  }

  // ─── 配置注入 ──────────────────────────────

  setResourceConfigs(configs: ResourceBalanceConfig[]): void {
    this.resourceConfigs = configs;
  }

  setHeroBaseStats(stats: Record<string, HeroBaseStats>): void {
    this.heroStats = stats;
  }

  setBattleConfig(config: BattleDifficultyConfig): void {
    this.battleConfig = config;
  }

  setEconomyConfigs(configs: EconomyBalanceConfig[]): void {
    this.economyConfigs = configs;
  }

  setRebirthConfig(config: RebirthBalanceConfig): void {
    this.rebirthConfig = config;
  }

  // ─── 全量验证 ──────────────────────────────

  validateAll(): BalanceReport {
    const entries: ValidationEntry[] = [];

    const resourceResults = this.validateResourceBalance();
    for (const result of resourceResults) entries.push(...result.entries);

    const heroResults = this.validateHeroBalance();
    for (const result of heroResults) entries.push(...result.entries);

    const battleResult = this.validateBattleDifficulty();
    entries.push(...battleResult.entries);

    const economyResult = this.validateEconomy();
    entries.push(...economyResult.entries);

    const rebirthResult = this.validateRebirth();
    entries.push(...rebirthResult.entries);

    const summary = this.buildSummary(entries);
    const overallLevel = this.determineOverallLevel(summary);

    const report: BalanceReport = {
      id: generateId(),
      timestamp: Date.now(),
      overallLevel,
      entries,
      summary,
    };

    this.lastReport = report;
    return report;
  }

  getLastReport(): BalanceReport | null {
    return this.lastReport;
  }

  // ─── #5 资源产出平衡 ──────────────────────

  validateResourceBalance(): ResourceBalanceResult[] {
    return this.resourceConfigs.map(config => validateSingleResource(config));
  }

  // ─── #6 武将战力平衡 ──────────────────────

  validateHeroBalance(): HeroBalanceResult[] {
    const qualities = Object.keys(this.heroStats);
    return qualities.map(quality => validateSingleHero(quality, this.heroStats));
  }

  // ─── #7 战斗难度曲线 ──────────────────────

  validateBattleDifficulty(): BattleDifficultyResult {
    return calculateStagePoints(this.battleConfig);
  }

  // ─── #8 经济系统平衡 ──────────────────────

  validateEconomy(): EconomyBalanceResult {
    return validateEconomy(this.economyConfigs);
  }

  // ─── #9 转生倍率平衡 ──────────────────────

  validateRebirth(): RebirthBalanceResult {
    return validateRebirth(this.rebirthConfig);
  }

  // ─── 辅助方法 ──────────────────────────────

  private buildSummary(entries: ValidationEntry[]): BalanceSummary {
    const passCount = entries.filter(e => e.level === 'pass').length;
    const warningCount = entries.filter(e => e.level === 'warning').length;
    const failCount = entries.filter(e => e.level === 'fail').length;
    const totalChecks = entries.length;

    return {
      totalChecks,
      passCount,
      warningCount,
      failCount,
      passRate: totalChecks > 0 ? passCount / totalChecks : 0,
    };
  }

  private determineOverallLevel(summary: BalanceSummary): ValidationLevel {
    if (summary.failCount > 0) return 'fail';
    if (summary.warningCount > 0) return 'warning';
    return 'pass';
  }

  // ─── 公开查询 ──────────────────────────────

  getResourceConfigs(): ResourceBalanceConfig[] {
    return [...this.resourceConfigs];
  }

  getBattleConfig(): BattleDifficultyConfig {
    return { ...this.battleConfig };
  }

  getRebirthConfig(): RebirthBalanceConfig {
    return { ...this.rebirthConfig };
  }
}
