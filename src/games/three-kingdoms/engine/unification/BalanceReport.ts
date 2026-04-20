/**
 * 引擎层 — 数值验证报告生成器
 *
 * 提供5大维度的验证函数，生成验证结果和条目。
 * 使用 BalanceCalculator 中的工具函数和纯计算函数。
 *
 * 包含：
 *   - 资源产出验证 (validateSingleResource)
 *   - 武将战力验证 (validateSingleHero)
 *   - 战斗难度计算 (calculateStagePoints)
 *   - 经济系统验证 (validateEconomy)
 *   - 转生倍率验证 (validateRebirth)
 *
 * @module engine/unification/BalanceReport
 */

import type {
  ValidationEntry,
  NumericRange,
  ResourceBalanceConfig,
  ResourceBalanceResult,
  ResourceCurvePoint,
  HeroBaseStats,
  HeroBalanceResult,
  HeroPowerPoint,
  BattleDifficultyConfig,
  BattleDifficultyResult,
  StageDifficultyPoint,
  EconomyBalanceConfig,
  EconomyBalanceResult,
  CurrencyFlowPoint,
  RebirthBalanceConfig,
  RebirthBalanceResult,
} from '../../core/unification';
import {
  inRange,
  makeEntry,
  calcPower,
  generateResourceCurve,
  calculateRebirthPoints,
} from './BalanceCalculator';

// ─────────────────────────────────────────────
// 资源验证
// ─────────────────────────────────────────────

/** 验证单个资源配置，返回结果 */
export function validateSingleResource(config: ResourceBalanceConfig): ResourceBalanceResult {
  const entries: ValidationEntry[] = [];
  const curvePoints = generateResourceCurve(config);

  // 检查早期产出
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

  // 检查中期产出
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

  // 检查后期产出
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

  // 检查产出/消耗比
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

  const isBalanced = entries.every(e => e.level !== 'fail');

  return {
    resourceType: config.resourceType,
    curvePoints,
    isBalanced,
    entries,
  };
}

// ─────────────────────────────────────────────
// 武将验证
// ─────────────────────────────────────────────

/** 验证单个品质武将 */
export function validateSingleHero(
  quality: string,
  heroStats: Record<string, HeroBaseStats>,
): HeroBalanceResult {
  const entries: ValidationEntry[] = [];
  const baseStats = heroStats[quality];
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

  // 检查品质间差距
  const qualityOrder = ['COMMON', 'FINE', 'RARE', 'EPIC', 'LEGENDARY'];
  const qIdx = qualityOrder.indexOf(quality);
  if (qIdx > 0) {
    const prevQuality = qualityOrder[qIdx - 1];
    const prevStats = heroStats[prevQuality];
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

  // 检查满级战力
  const maxLevelPower = powerPoints[powerPoints.length - 1]?.totalPower ?? 0;
  const minExpectedPower = calcPower(baseStats, 1.0, 1.0) * 3;
  entries.push(makeEntry(
    'BAL-HERO-002', 'hero_power',
    maxLevelPower >= minExpectedPower ? 'pass' : 'warning',
    maxLevelPower, minExpectedPower,
    `Max level power for ${quality}: ${maxLevelPower}`,
  ));

  const isBalanced = entries.every(e => e.level !== 'fail');

  return {
    quality: quality as HeroBalanceResult['quality'],
    powerPoints,
    isBalanced,
    entries,
  };
}

// ─────────────────────────────────────────────
// 战斗难度计算
// ─────────────────────────────────────────────

/** 计算战斗关卡难度数据 */
export function calculateStagePoints(cfg: BattleDifficultyConfig): BattleDifficultyResult {
  const entries: ValidationEntry[] = [];
  const totalStages = cfg.totalChapters * cfg.stagesPerChapter;
  const stagePoints: StageDifficultyPoint[] = [];

  for (let ch = 0; ch < cfg.totalChapters; ch++) {
    for (let st = 0; st < cfg.stagesPerChapter; st++) {
      const stageIdx = ch * cfg.stagesPerChapter + st;
      const progress = stageIdx / (totalStages - 1);
      const isBoss = st === cfg.stagesPerChapter - 1;

      let enemyPower: number;
      if (cfg.curveType === 'exponential') {
        enemyPower = cfg.firstStagePower * Math.pow(cfg.growthFactor, stageIdx);
      } else if (cfg.curveType === 'linear') {
        enemyPower = cfg.firstStagePower + (cfg.lastStagePower - cfg.firstStagePower) * progress;
      } else {
        const chapterProgress = ch / (cfg.totalChapters - 1);
        enemyPower = cfg.firstStagePower + (cfg.lastStagePower - cfg.firstStagePower) * chapterProgress;
      }

      if (isBoss) {
        enemyPower *= cfg.bossMultiplier;
      }

      enemyPower = Math.floor(enemyPower);
      const recommendedPower = Math.floor(enemyPower * 0.85);
      const difficultyFactor = Math.min(1, enemyPower / cfg.lastStagePower);

      stagePoints.push({
        chapterIndex: ch,
        stageIndex: st,
        enemyPower,
        recommendedPower,
        difficultyFactor,
      });
    }
  }

  const firstStage = stagePoints[0];
  if (firstStage) {
    entries.push(makeEntry(
      'BAL-CBT-001', 'battle_difficulty',
      firstStage.enemyPower <= 1000 ? 'pass' : 'warning',
      firstStage.enemyPower, { min: 300, max: 1000 },
      `First stage enemy power: ${firstStage.enemyPower}`,
    ));
  }

  const lastStage = stagePoints[stagePoints.length - 1];
  if (lastStage) {
    entries.push(makeEntry(
      'BAL-CBT-002', 'battle_difficulty',
      lastStage.enemyPower >= 50000 ? 'pass' : 'warning',
      lastStage.enemyPower, { min: 50000, max: 120000 },
      `Last stage enemy power: ${lastStage.enemyPower}`,
    ));
  }

  for (let i = 1; i < stagePoints.length; i++) {
    const prev = stagePoints[i - 1];
    const cur = stagePoints[i];
    const ratio = cur.enemyPower / prev.enemyPower;
    if (ratio > 3.0) {
      entries.push(makeEntry(
        'BAL-CBT-003', 'battle_difficulty',
        'warning', ratio, { min: 1.0, max: 3.0 },
        `Difficulty spike at Ch${cur.chapterIndex + 1}-St${cur.stageIndex + 1}: ${ratio.toFixed(2)}x`,
      ));
    }
  }

  const isBalanced = entries.every(e => e.level !== 'fail');
  return { stagePoints, isBalanced, entries };
}

// ─────────────────────────────────────────────
// 经济验证
// ─────────────────────────────────────────────

/** 验证经济系统 */
export function validateEconomy(economyConfigs: EconomyBalanceConfig[]): EconomyBalanceResult {
  const entries: ValidationEntry[] = [];
  const flows: CurrencyFlowPoint[] = [];

  for (const config of economyConfigs) {
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

    const acqOk = inRange(midAcq, config.dailyAcquisitionRange);
    entries.push(makeEntry(
      'BAL-ECO-001', 'economy',
      acqOk ? 'pass' : 'warning',
      midAcq, config.dailyAcquisitionRange,
      `Daily acquisition for ${config.currency}`,
    ));

    const conOk = inRange(midCon, config.dailyConsumptionRange);
    entries.push(makeEntry(
      'BAL-ECO-002', 'economy',
      conOk ? 'pass' : 'warning',
      midCon, config.dailyConsumptionRange,
      `Daily consumption for ${config.currency}`,
    ));

    const inflationRatio = midAcq > 0 ? netFlow / midAcq : 0;
    const inflationOk = inflationRatio <= config.inflationWarningThreshold;
    entries.push(makeEntry(
      'BAL-ECO-003', 'economy',
      inflationOk ? 'pass' : 'warning',
      inflationRatio, config.inflationWarningThreshold,
      `Inflation ratio for ${config.currency}: ${(inflationRatio * 100).toFixed(1)}%`,
    ));
  }

  const isBalanced = entries.every(e => e.level !== 'fail');
  return { currencyFlows: flows, isBalanced, entries };
}

// ─────────────────────────────────────────────
// 转生验证
// ─────────────────────────────────────────────

/** 验证转生倍率 */
export function validateRebirth(cfg: RebirthBalanceConfig): RebirthBalanceResult {
  const entries: ValidationEntry[] = [];
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

  const isBalanced = entries.every(e => e.level !== 'fail');
  return { multiplierPoints: points, isBalanced, entries };
}
