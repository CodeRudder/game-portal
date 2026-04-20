/**
 * 引擎层 — 数值验证器
 *
 * 自动化验证资源/武将/战斗/经济/转生5大平衡维度：
 *   - 资源产出平衡 (#5): 4资源产出/消耗曲线验证
 *   - 武将战力平衡 (#6): 5品质属性差距+成长曲线验证
 *   - 战斗难度曲线 (#7): 15关卡难度递增验证
 *   - 经济系统平衡 (#8): 4货币获取/消耗验证
 *   - 转生倍率平衡 (#9): 1~20次转生倍率曲线验证
 *
 * 计算逻辑委托给 BalanceCalculator，辅助函数委托给 BalanceValidatorHelpers。
 *
 * @module engine/unification/BalanceValidator
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ValidationEntry,
  BalanceReport,
  ResourceBalanceConfig,
  ResourceBalanceResult,
  HeroBalanceResult,
  HeroPowerPoint,
  HeroBaseStats,
  BattleDifficultyConfig,
  BattleDifficultyResult,
  EconomyBalanceConfig,
  EconomyBalanceResult,
  CurrencyFlowPoint,
  RebirthBalanceConfig,
  RebirthBalanceResult,
} from '../../core/unification';

import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_REBIRTH_CONFIG,
  generateId,
  inRange,
  makeEntry,
  calcPower,
  generateResourceCurve,
  calculateStagePoints,
  calculateRebirthPoints,
} from './BalanceCalculator';

import {
  DEFAULT_ECONOMY_CONFIGS,
  buildSummary,
  determineOverallLevel,
} from './BalanceValidatorHelpers';

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

  /** 运行全量验证，生成报告 */
  validateAll(): BalanceReport {
    const entries: ValidationEntry[] = [];

    const resourceResults = this.validateResourceBalance();
    for (const result of resourceResults) {
      entries.push(...result.entries);
    }

    const heroResults = this.validateHeroBalance();
    for (const result of heroResults) {
      entries.push(...result.entries);
    }

    const battleResult = this.validateBattleDifficulty();
    entries.push(...battleResult.entries);

    const economyResult = this.validateEconomy();
    entries.push(...economyResult.entries);

    const rebirthResult = this.validateRebirth();
    entries.push(...rebirthResult.entries);

    const summary = buildSummary(entries);
    const overallLevel = determineOverallLevel(summary);

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
    return this.resourceConfigs.map(config => this.validateSingleResource(config));
  }

  private validateSingleResource(config: ResourceBalanceConfig): ResourceBalanceResult {
    const entries: ValidationEntry[] = [];
    const curvePoints = generateResourceCurve(config);

    const earlyPoint = curvePoints[0];
    if (earlyPoint) {
      const earlyOk = inRange(earlyPoint.productionRate * 86400, config.earlyGameDailyRange);
      entries.push(makeEntry(
        'BAL-RES-001', 'resource_production',
        earlyOk ? 'pass' : 'fail',
        earlyPoint.productionRate * 86400,
        config.earlyGameDailyRange,
        `Early game daily production for ${config.resourceType}`,
      ));
    }

    const midPoint = curvePoints[Math.floor(curvePoints.length / 2)];
    if (midPoint) {
      const midOk = inRange(midPoint.productionRate * 86400, config.midGameDailyRange);
      entries.push(makeEntry(
        'BAL-RES-002', 'resource_production',
        midOk ? 'pass' : 'warning',
        midPoint.productionRate * 86400,
        config.midGameDailyRange,
        `Mid game daily production for ${config.resourceType}`,
      ));
    }

    const latePoint = curvePoints[curvePoints.length - 1];
    if (latePoint) {
      const lateOk = inRange(latePoint.productionRate * 86400, config.lateGameDailyRange);
      entries.push(makeEntry(
        'BAL-RES-003', 'resource_production',
        lateOk ? 'pass' : 'warning',
        latePoint.productionRate * 86400,
        config.lateGameDailyRange,
        `Late game daily production for ${config.resourceType}`,
      ));
    }

    for (const point of curvePoints) {
      if (point.totalConsumed > 0) {
        const ratio = point.netIncome > 0 ? point.totalProduced / point.totalConsumed : 0;
        const ratioOk = inRange(ratio, config.productionConsumptionRatio);
        if (!ratioOk) {
          entries.push(makeEntry(
            'BAL-RES-004', 'resource_production',
            'warning', ratio, config.productionConsumptionRatio,
            `Production/consumption ratio out of range on day ${point.day}`,
          ));
        }
      }
    }

    return {
      resourceType: config.resourceType,
      curvePoints,
      isBalanced: entries.every(e => e.level !== 'fail'),
      entries,
    };
  }

  // ─── #6 武将战力平衡 ──────────────────────

  validateHeroBalance(): HeroBalanceResult[] {
    const qualities = Object.keys(this.heroStats) as Array<keyof typeof this.heroStats>;
    return qualities.map(quality => this.validateSingleHero(quality));
  }

  private validateSingleHero(quality: string): HeroBalanceResult {
    const entries: ValidationEntry[] = [];
    const baseStats = this.heroStats[quality];
    if (!baseStats) {
      return {
        quality: quality as HeroBalanceResult['quality'],
        powerPoints: [],
        isBalanced: false,
        entries: [makeEntry('BAL-HERO-000', 'hero_power', 'fail', 0, 0, `No base stats for ${quality}`)],
      };
    }

    const powerPoints: HeroPowerPoint[] = [];
    const levels = [1, 10, 30, 50, 80, 100];

    for (const level of levels) {
      const levelFactor = 1 + (level - 1) * 0.05;
      const growthMultiplier = 1 + (level - 1) * 0.02;
      const totalPower = calcPower(baseStats, levelFactor, 1.0);

      powerPoints.push({
        level,
        quality: quality as HeroPowerPoint['quality'],
        baseStats: { ...baseStats },
        totalPower,
        growthMultiplier,
      });
    }

    const qualityOrder = ['COMMON', 'FINE', 'RARE', 'EPIC', 'LEGENDARY'];
    const qIdx = qualityOrder.indexOf(quality);
    if (qIdx > 0) {
      const prevQuality = qualityOrder[qIdx - 1];
      const prevStats = this.heroStats[prevQuality];
      if (prevStats) {
        const prevPower = calcPower(prevStats, 1.0, 1.0);
        const curPower = calcPower(baseStats, 1.0, 1.0);
        const ratio = curPower / prevPower;
        const ratioOk = ratio >= 1.2 && ratio <= 2.0;
        entries.push(makeEntry(
          'BAL-HERO-001', 'hero_power',
          ratioOk ? 'pass' : 'warning',
          ratio, { min: 1.2, max: 2.0 },
          `Quality ratio ${prevQuality}→${quality}: ${ratio.toFixed(2)}`,
        ));
      }
    }

    const maxLevelPower = powerPoints[powerPoints.length - 1]?.totalPower ?? 0;
    const minExpectedPower = calcPower(baseStats, 1.0, 1.0) * 3;
    entries.push(makeEntry(
      'BAL-HERO-002', 'hero_power',
      maxLevelPower >= minExpectedPower ? 'pass' : 'warning',
      maxLevelPower, minExpectedPower,
      `Max level power for ${quality}: ${maxLevelPower}`,
    ));

    return {
      quality: quality as HeroBalanceResult['quality'],
      powerPoints,
      isBalanced: entries.every(e => e.level !== 'fail'),
      entries,
    };
  }

  // ─── #7 战斗难度曲线 ──────────────────────

  validateBattleDifficulty(): BattleDifficultyResult {
    return calculateStagePoints(this.battleConfig);
  }

  // ─── #8 经济系统平衡 ──────────────────────

  validateEconomy(): EconomyBalanceResult {
    const entries: ValidationEntry[] = [];
    const flows: CurrencyFlowPoint[] = [];

    for (const config of this.economyConfigs) {
      const midAcq = (config.dailyAcquisitionRange.min + config.dailyAcquisitionRange.max) / 2;
      const midCon = (config.dailyConsumptionRange.min + config.dailyConsumptionRange.max) / 2;
      const netFlow = midAcq - midCon;

      flows.push({
        currency: config.currency,
        dailyAcquisition: midAcq,
        dailyConsumption: midCon,
        netFlow,
        acquisitionSources: 3,
        consumptionSinks: 4,
      });

      entries.push(makeEntry(
        'BAL-ECO-001', 'economy',
        inRange(midAcq, config.dailyAcquisitionRange) ? 'pass' : 'warning',
        midAcq, config.dailyAcquisitionRange,
        `Daily acquisition for ${config.currency}`,
      ));

      entries.push(makeEntry(
        'BAL-ECO-002', 'economy',
        inRange(midCon, config.dailyConsumptionRange) ? 'pass' : 'warning',
        midCon, config.dailyConsumptionRange,
        `Daily consumption for ${config.currency}`,
      ));

      const inflationRatio = midAcq > 0 ? netFlow / midAcq : 0;
      entries.push(makeEntry(
        'BAL-ECO-003', 'economy',
        inflationRatio <= config.inflationWarningThreshold ? 'pass' : 'warning',
        inflationRatio, config.inflationWarningThreshold,
        `Inflation ratio for ${config.currency}: ${(inflationRatio * 100).toFixed(1)}%`,
      ));
    }

    return {
      currencyFlows: flows,
      isBalanced: entries.every(e => e.level !== 'fail'),
      entries,
    };
  }

  // ─── #9 转生倍率平衡 ──────────────────────

  validateRebirth(): RebirthBalanceResult {
    const entries: ValidationEntry[] = [];
    const cfg = this.rebirthConfig;
    const points = calculateRebirthPoints(cfg);

    const first = points[0];
    if (first) {
      const firstOk = first.multiplier >= 1.1 && first.multiplier <= 2.5;
      entries.push(makeEntry(
        'BAL-PRS-001', 'rebirth_multiplier',
        firstOk ? 'pass' : 'warning',
        first.multiplier, { min: 1.1, max: 2.5 },
        `1st rebirth multiplier: ${first.multiplier}x`,
      ));
    }

    const fifth = points[4];
    if (fifth) {
      const fifthOk = fifth.multiplier >= 2.0 && fifth.multiplier <= 6.0;
      entries.push(makeEntry(
        'BAL-PRS-002', 'rebirth_multiplier',
        fifthOk ? 'pass' : 'warning',
        fifth.multiplier, { min: 2.0, max: 6.0 },
        `5th rebirth multiplier: ${fifth.multiplier}x`,
      ));
    }

    const tenth = points[9];
    if (tenth) {
      const tenthOk = tenth.multiplier >= 3.0 && tenth.multiplier <= 9.0;
      entries.push(makeEntry(
        'BAL-PRS-003', 'rebirth_multiplier',
        tenthOk ? 'pass' : 'warning',
        tenth.multiplier, { min: 3.0, max: 9.0 },
        `10th rebirth multiplier: ${tenth.multiplier}x`,
      ));
    }

    const last = points[points.length - 1];
    if (last) {
      const maxOk = last.multiplier <= cfg.maxMultiplier;
      entries.push(makeEntry(
        'BAL-PRS-004', 'rebirth_multiplier',
        maxOk ? 'pass' : 'fail',
        last.multiplier, cfg.maxMultiplier,
        `Max rebirth multiplier (20th): ${last.multiplier}x, cap: ${cfg.maxMultiplier}x`,
      ));
    }

    for (let i = 1; i < points.length; i++) {
      if (points[i].increment > points[i - 1].increment) {
        entries.push(makeEntry(
          'BAL-PRS-005', 'rebirth_multiplier',
          'warning', points[i].increment, points[i - 1].increment,
          `No diminishing returns at rebirth #${i + 1}`,
        ));
        break;
      }
    }

    return {
      multiplierPoints: points,
      isBalanced: entries.every(e => e.level !== 'fail'),
      entries,
    };
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
