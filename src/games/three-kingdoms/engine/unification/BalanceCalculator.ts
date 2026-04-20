/**
 * 引擎层 — 数值计算器
 *
 * 提供数值验证所需的常量配置、工具函数和纯计算逻辑。
 * 从 BalanceValidator 中拆分出来，保持单一职责。
 *
 * 包含：
 *   - 5大平衡维度的默认配置常量
 *   - 通用工具函数（范围判断、偏差计算、ID生成等）
 *   - 纯计算函数（战力计算、转生倍率计算、曲线生成等）
 *   - 经济系统计算
 *   - 武将战力计算
 *
 * @module engine/unification/BalanceCalculator
 */

import type {
  ValidationEntry,
  ValidationLevel,
  BalanceDimension,
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
  RebirthMultiplierPoint,
} from '../../core/unification';

// ─────────────────────────────────────────────
// 默认配置常量
// ─────────────────────────────────────────────

/** 默认资源平衡配置 */
export const DEFAULT_RESOURCE_CONFIGS: ResourceBalanceConfig[] = [
  {
    resourceType: 'grain',
    earlyGameDailyRange: { min: 500, max: 2000 },
    midGameDailyRange: { min: 5000, max: 20000 },
    lateGameDailyRange: { min: 50000, max: 200000 },
    productionConsumptionRatio: { min: 1.2, max: 3.0 },
    maxDeviationPercent: 30,
  },
  {
    resourceType: 'gold',
    earlyGameDailyRange: { min: 200, max: 1000 },
    midGameDailyRange: { min: 2000, max: 10000 },
    lateGameDailyRange: { min: 20000, max: 100000 },
    productionConsumptionRatio: { min: 1.0, max: 2.5 },
    maxDeviationPercent: 30,
  },
  {
    resourceType: 'troops',
    earlyGameDailyRange: { min: 100, max: 500 },
    midGameDailyRange: { min: 1000, max: 5000 },
    lateGameDailyRange: { min: 10000, max: 50000 },
    productionConsumptionRatio: { min: 0.8, max: 2.0 },
    maxDeviationPercent: 30,
  },
  {
    resourceType: 'mandate',
    earlyGameDailyRange: { min: 10, max: 50 },
    midGameDailyRange: { min: 50, max: 200 },
    lateGameDailyRange: { min: 200, max: 1000 },
    productionConsumptionRatio: { min: 0.5, max: 1.5 },
    maxDeviationPercent: 40,
  },
];

/** 默认武将品质基础属性 */
export const HERO_BASE_STATS: Record<string, HeroBaseStats> = {
  COMMON: { attack: 30, defense: 25, hp: 200, speed: 20 },
  FINE: { attack: 45, defense: 38, hp: 300, speed: 30 },
  RARE: { attack: 65, defense: 55, hp: 450, speed: 45 },
  EPIC: { attack: 90, defense: 75, hp: 650, speed: 60 },
  LEGENDARY: { attack: 120, defense: 100, hp: 900, speed: 80 },
};

/** 默认战斗难度配置 */
export const DEFAULT_BATTLE_CONFIG: BattleDifficultyConfig = {
  totalChapters: 5,
  stagesPerChapter: 3,
  firstStagePower: 500,
  lastStagePower: 80000,
  curveType: 'exponential',
  growthFactor: 1.35,
  bossMultiplier: 1.5,
};

/** 默认经济配置 */
export const DEFAULT_ECONOMY_CONFIGS: EconomyBalanceConfig[] = [
  {
    currency: 'copper',
    dailyAcquisitionRange: { min: 5000, max: 50000 },
    dailyConsumptionRange: { min: 3000, max: 40000 },
    acquisitionConsumptionRatio: { min: 1.0, max: 2.0 },
    inflationWarningThreshold: 0.5,
  },
  {
    currency: 'mandate',
    dailyAcquisitionRange: { min: 10, max: 100 },
    dailyConsumptionRange: { min: 5, max: 80 },
    acquisitionConsumptionRatio: { min: 1.0, max: 3.0 },
    inflationWarningThreshold: 0.6,
  },
  {
    currency: 'recruit',
    dailyAcquisitionRange: { min: 1, max: 10 },
    dailyConsumptionRange: { min: 0, max: 8 },
    acquisitionConsumptionRatio: { min: 1.0, max: 5.0 },
    inflationWarningThreshold: 0.7,
  },
  {
    currency: 'ingot',
    dailyAcquisitionRange: { min: 0, max: 5 },
    dailyConsumptionRange: { min: 0, max: 3 },
    acquisitionConsumptionRatio: { min: 0.5, max: 3.0 },
    inflationWarningThreshold: 0.4,
  },
];

/** 默认转生配置 */
export const DEFAULT_REBIRTH_CONFIG: RebirthBalanceConfig = {
  maxRebirthCount: 20,
  baseMultiplier: 1.0,
  perRebirthIncrement: 0.15,
  maxMultiplier: 10.0,
  curveType: 'diminishing',
  decayFactor: 0.92,
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一 ID */
export function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 判断数值是否在范围内 */
export function inRange(value: number, range: NumericRange): boolean {
  return value >= range.min && value <= range.max;
}

/** 计算偏差百分比 */
export function calcDeviation(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return Math.abs((actual - expected) / expected) * 100;
}

/** 创建验证条目 */
export function makeEntry(
  featureId: string,
  dimension: BalanceDimension,
  level: ValidationLevel,
  actual: number,
  expected: number | NumericRange,
  message: string,
): ValidationEntry {
  const expectedNum = typeof expected === 'number' ? expected : (expected.min + expected.max) / 2;
  return {
    featureId,
    dimension,
    level,
    actual,
    expected,
    deviation: calcDeviation(actual, expectedNum),
    message,
  };
}

// ─────────────────────────────────────────────
// 纯计算函数
// ─────────────────────────────────────────────

/** 计算战力 */
export function calcPower(stats: HeroBaseStats, levelFactor: number, starFactor: number): number {
  return Math.floor(
    (stats.attack * 2 + stats.defense * 1.5 + stats.hp * 0.5 + stats.speed * 1) *
    levelFactor * starFactor,
  );
}

/** 计算转生倍率（递减曲线） */
export function calcRebirthMultiplier(count: number, config: RebirthBalanceConfig): number {
  if (count <= 0) return 1.0;
  let multiplier = config.baseMultiplier;
  for (let i = 1; i <= count; i++) {
    const increment = config.perRebirthIncrement * Math.pow(config.decayFactor, i - 1);
    multiplier = Math.min(multiplier + increment, config.maxMultiplier);
  }
  return Math.round(multiplier * 100) / 100;
}

/** 生成资源曲线数据点 */
export function generateResourceCurve(config: ResourceBalanceConfig): ResourceCurvePoint[] {
  const points: ResourceCurvePoint[] = [];
  const days = [1, 7, 14, 30, 60, 90];
  const earlyDaily = (config.earlyGameDailyRange.min + config.earlyGameDailyRange.max) / 2;
  const growthRate = 1.08; // 每天8%增长

  let totalProduced = 0;
  let totalConsumed = 0;

  for (const day of days) {
    const productionRate = (earlyDaily / 86400) * Math.pow(growthRate, day - 1);
    const consumptionRate = productionRate * (0.5 + Math.random() * 0.3);
    totalProduced += productionRate * 86400;
    totalConsumed += consumptionRate * 86400;

    points.push({
      day,
      productionRate: Math.round(productionRate * 1000) / 1000,
      totalProduced: Math.floor(totalProduced),
      totalConsumed: Math.floor(totalConsumed),
      netIncome: Math.floor(totalProduced - totalConsumed),
    });
  }

  return points;
}

// ─────────────────────────────────────────────
// 资源验证计算
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
// 武将验证计算
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
// 经济验证计算
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
// 转生倍率计算
// ─────────────────────────────────────────────

/** 计算转生倍率数据点 */
export function calculateRebirthPoints(cfg: RebirthBalanceConfig): RebirthMultiplierPoint[] {
  const points: RebirthMultiplierPoint[] = [];
  let prevMultiplier = 1.0;

  for (let count = 1; count <= cfg.maxRebirthCount; count++) {
    const multiplier = calcRebirthMultiplier(count, cfg);
    const increment = multiplier - prevMultiplier;

    points.push({
      rebirthCount: count,
      multiplier,
      increment: Math.round(increment * 1000) / 1000,
      cumulativeAcceleration: multiplier,
    });

    prevMultiplier = multiplier;
  }

  return points;
}

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
