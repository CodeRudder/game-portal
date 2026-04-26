/**
 * FormationRecommendPanel — 编队推荐面板
 *
 * 功能：
 * - 展示3套推荐编队（战力最优 / 羁绊最优 / 平衡编队）
 * - 每套编队：名称、总战力、激活羁绊列表、6个武将位
 * - "应用此编队"按钮
 * - 与当前编队的战力对比（+/-差值）
 * - 推荐依据说明
 */

import React, { useMemo, useCallback } from 'react';
import { HERO_QUALITY_COLORS } from '../../common/constants';
import { QualityBadge, StarDisplay } from './atoms';
import { toQualityLiteral } from './hero-ui.types';
import './FormationRecommendPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

/** 武将简要数据（含阵营） */
export interface HeroInfo {
  id: string;
  name: string;
  level: number;
  quality: string;
  stars: number;
  faction: string;
}

/** 推荐方案数据 */
export interface RecommendPlan {
  id: string;
  name: string;
  description: string;
  heroIds: string[];
  estimatedPower: number;
  score: number;
  bonds: string[];
  basis: string;
}

export interface FormationRecommendPanelProps {
  /** 拥有的武将列表（外部传入优先） */
  ownedHeroes?: HeroInfo[];
  /** 当前编队（外部传入优先） */
  currentFormation?: (string | null)[];
  /** 应用推荐回调（外部传入优先） */
  onApplyRecommend?: (heroIds: (string | null)[]) => void;
  /** 关闭回调 */
  onClose: () => void;
  /**
   * 战力计算回调（由外部注入引擎的 calculateFormationPower 逻辑）
   *
   * 接收一组武将信息，返回该编队的总战力。
   * 如果未提供，回退到内置简易估算 estimatePower()。
   */
  powerCalculator?: (heroes: HeroInfo[]) => number;
  /**
   * 引擎驱动的推荐方案生成器（P1-4 优化）
   *
   * 当提供此参数时，推荐算法调用引擎的 calculateTotalPower() 计算实际战力，
   * 调用引擎的 BondSystem 检测可激活羁绊，综合战力+羁绊评分生成3套方案。
   * 优先级高于内置的 generatePlans() 简易排序。
   */
  generateRecommendations?: () => RecommendPlan[];
  /**
   * 引擎数据源（P1-1 桥接）
   * 当提供此参数时，ownedHeroes/currentFormation/onApplyRecommend/powerCalculator
   * 从引擎数据自动获取，无需手动传入。
   */
  engineDataSource?: {
    ownedHeroes: HeroInfo[];
    currentFormation: (string | null)[];
    onApplyRecommend: (heroIds: (string | null)[]) => void;
    powerCalculator: (heroes: HeroInfo[]) => number;
    generateRecommendations?: () => RecommendPlan[];
  };
}

// ─────────────────────────────────────────────
// 品质排序权重
// ─────────────────────────────────────────────
const QUALITY_ORDER: Record<string, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  FINE: 2,
  COMMON: 1,
};

/** 简易战力估算（等级 × 品质权重 × 星级系数）— 回退方案 */
function estimatePower(hero: HeroInfo): number {
  const qWeight = QUALITY_ORDER[hero.quality] ?? 1;
  const starFactor = 1 + hero.stars * 0.15;
  return Math.round(hero.level * qWeight * starFactor * 10);
}

/**
 * 计算一组武将的总战力
 *
 * 优先使用外部注入的 powerCalculator（对接引擎 calculateFormationPower），
 * 无外部计算器时回退到简易求和。
 */
function computeTeamPower(
  heroes: HeroInfo[],
  powerCalculator?: (heroes: HeroInfo[]) => number,
): number {
  if (powerCalculator) {
    return powerCalculator(heroes);
  }
  // 回退：逐个简易估算后求和
  return heroes.reduce((sum, h) => sum + estimatePower(h), 0);
}

/** 从武将列表中生成羁绊标签（简化版） */
function detectBonds(heroes: HeroInfo[]): string[] {
  const bonds: string[] = [];
  // 按阵营分组
  const factionCounts: Record<string, number> = {};
  heroes.forEach((h) => {
    factionCounts[h.faction] = (factionCounts[h.faction] || 0) + 1;
  });

  // 同阵营≥2人激活阵营羁绊
  const factionNames: Record<string, string> = {
    shu: '蜀国羁绊', wei: '魏国羁绊', wu: '吴国羁绊', qun: '群雄羁绊',
  };
  for (const [faction, count] of Object.entries(factionCounts)) {
    if (count >= 2) bonds.push(`${factionNames[faction] || faction}(${count}人)`);
  }

  // 品质羁绊：≥2名相同品质
  const qualityCounts: Record<string, number> = {};
  heroes.forEach((h) => {
    qualityCounts[h.quality] = (qualityCounts[h.quality] || 0) + 1;
  });
  for (const [q, count] of Object.entries(qualityCounts)) {
    if (count >= 2 && QUALITY_ORDER[q] >= QUALITY_ORDER.EPIC) {
      bonds.push(`${q}品质共鸣(${count}人)`);
    }
  }

  return bonds;
}

// ─────────────────────────────────────────────
// 生成推荐方案
// ─────────────────────────────────────────────
function generatePlans(
  heroes: HeroInfo[],
  powerCalculator?: (heroes: HeroInfo[]) => number,
): RecommendPlan[] {
  if (heroes.length === 0) return [];

  const MAX_SLOTS = 6;
  const sorted = [...heroes]
    .map((h) => ({ hero: h, power: estimatePower(h) }))
    .sort((a, b) => b.power - a.power);

  const plans: RecommendPlan[] = [];

  // 方案1：战力最优 — 取战力最高的6名
  const bestCount = Math.min(MAX_SLOTS, sorted.length);
  const bestHeroes = sorted.slice(0, bestCount);
  const bestHeroInfos = bestHeroes.map((h) => h.hero);
  const bestPower = computeTeamPower(bestHeroInfos, powerCalculator);
  const bestBonds = detectBonds(bestHeroInfos);
  plans.push({
    id: 'best-power',
    name: '战力最优',
    description: `选择战力最高的${bestCount}名武将`,
    heroIds: bestHeroes.map((h) => h.hero.id),
    estimatedPower: bestPower,
    score: Math.min(100, Math.round(bestPower / 50)),
    bonds: bestBonds,
    basis: '基于武将战力排序，选取最高战力组合',
  });

  // 方案2：羁绊最优 — 优先同阵营
  if (sorted.length > 2) {
    const factionGroups: Record<string, typeof sorted> = {};
    sorted.forEach((item) => {
      const f = item.hero.faction;
      if (!factionGroups[f]) factionGroups[f] = [];
      factionGroups[f].push(item);
    });

    // 找出人数最多的阵营
    let bestFaction = '';
    let bestFactionCount = 0;
    for (const [faction, items] of Object.entries(factionGroups)) {
      if (items.length > bestFactionCount) {
        bestFaction = faction;
        bestFactionCount = items.length;
      }
    }

    const synergyHeroes = (factionGroups[bestFaction] || sorted)
      .slice(0, MAX_SLOTS);
    // 如果不足6个，用其他武将补充
    const synergyIds = new Set(synergyHeroes.map((h) => h.hero.id));
    const remaining = sorted.filter((h) => !synergyIds.has(h.hero.id));
    while (synergyHeroes.length < MAX_SLOTS && remaining.length > 0) {
      synergyHeroes.push(remaining.shift()!);
    }

    const synergyHeroInfos = synergyHeroes.map((h) => h.hero);
    const synergyPower = computeTeamPower(synergyHeroInfos, powerCalculator);
    const synergyBonds = detectBonds(synergyHeroInfos);
    plans.push({
      id: 'best-synergy',
      name: '羁绊最优',
      description: `优先激活阵营羁绊，以${bestFaction || '混合'}阵营为核心`,
      heroIds: synergyHeroes.map((h) => h.hero.id),
      estimatedPower: synergyPower,
      score: Math.min(100, Math.round(synergyPower / 55) + synergyBonds.length * 5),
      bonds: synergyBonds,
      basis: '基于阵营羁绊最大化，优先选择同阵营武将',
    });
  }

  // 方案3：平衡编队 — 兼顾品质与覆盖
  if (sorted.length > 3) {
    // 按品质分层选取
    const byQuality: Record<string, typeof sorted> = {};
    sorted.forEach((item) => {
      const q = item.hero.quality;
      if (!byQuality[q]) byQuality[q] = [];
      byQuality[q].push(item);
    });

    const balanced: typeof sorted = [];
    // 优先取高品质
    for (const q of ['LEGENDARY', 'EPIC', 'RARE', 'FINE', 'COMMON']) {
      const items = byQuality[q] || [];
      for (const item of items) {
        if (balanced.length >= MAX_SLOTS) break;
        balanced.push(item);
      }
      if (balanced.length >= MAX_SLOTS) break;
    }

    const balancedHeroInfos = balanced.map((h) => h.hero);
    const balancedPower = computeTeamPower(balancedHeroInfos, powerCalculator);
    const balancedBonds = detectBonds(balancedHeroInfos);
    plans.push({
      id: 'balanced',
      name: '平衡编队',
      description: '兼顾品质与覆盖面的均衡阵容',
      heroIds: balanced.map((h) => h.hero.id),
      estimatedPower: balancedPower,
      score: Math.min(100, Math.round(balancedPower / 52) + balancedBonds.length * 3),
      bonds: balancedBonds,
      basis: '基于品质分层选取，兼顾战力与羁绊平衡',
    });
  }

  return plans;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const FormationRecommendPanel: React.FC<FormationRecommendPanelProps> = ({
  ownedHeroes: externalOwnedHeroes,
  currentFormation: externalCurrentFormation,
  onApplyRecommend: externalOnApplyRecommend,
  onClose,
  powerCalculator: externalPowerCalculator,
  generateRecommendations: externalGenerateRecommendations,
  engineDataSource,
}) => {
  // 优先使用外部传入数据，否则使用引擎数据源
  const rawOwnedHeroes = externalOwnedHeroes ?? engineDataSource?.ownedHeroes ?? [];
  const currentFormation = externalCurrentFormation ?? engineDataSource?.currentFormation ?? Array(6).fill(null);
  const onApplyRecommend = externalOnApplyRecommend ?? engineDataSource?.onApplyRecommend ?? (() => {});
  const powerCalculator = externalPowerCalculator ?? engineDataSource?.powerCalculator;
  const generateRecommendations = externalGenerateRecommendations ?? engineDataSource?.generateRecommendations;

  // ── Props 校验：过滤非法武将数据 ──
  const ownedHeroes = useMemo(() =>
    rawOwnedHeroes.filter((h) =>
      h.id && typeof h.id === 'string' &&
      h.name && typeof h.name === 'string' &&
      typeof h.level === 'number' && h.level >= 1 &&
      h.quality && typeof h.quality === 'string' &&
      typeof h.stars === 'number' && h.stars >= 1 &&
      h.faction && typeof h.faction === 'string',
    ),
  [rawOwnedHeroes]);
  // ── 武将ID → 武将映射 ──
  const heroMap = useMemo(() => {
    const map = new Map<string, HeroInfo>();
    ownedHeroes.forEach((h) => map.set(h.id, h));
    return map;
  }, [ownedHeroes]);

  // ── 当前编队战力 ──
  const currentPower = useMemo(() => {
    const heroes = currentFormation
      .map((id) => (id ? heroMap.get(id) : undefined))
      .filter((h): h is HeroInfo => h !== undefined);
    return computeTeamPower(heroes, powerCalculator);
  }, [currentFormation, heroMap, powerCalculator]);

  // ── 生成推荐方案 ──
  // 优先使用引擎驱动的推荐（调用引擎战力计算+羁绊检测），
  // 回退到内置简易排序算法
  const plans = useMemo(
    () => generateRecommendations?.() ?? generatePlans(ownedHeroes, powerCalculator),
    [generateRecommendations, ownedHeroes, powerCalculator],
  );

  // ── 应用推荐 ──
  const handleApply = useCallback(
    (plan: RecommendPlan) => {
      // 补齐到6位（不足填null）
      const result: (string | null)[] = [...plan.heroIds];
      while (result.length < 6) result.push(null);
      onApplyRecommend(result);
    },
    [onApplyRecommend],
  );

  // ── 方案卡片样式类 ──
  const getCardClass = (plan: RecommendPlan): string => {
    switch (plan.id) {
      case 'best-power': return 'tk-recommend-card--best';
      case 'best-synergy': return 'tk-recommend-card--synergy';
      case 'balanced': return 'tk-recommend-card--balanced';
      default: return '';
    }
  };

  return (
    <div className="tk-recommend-panel" data-testid="formation-recommend-panel">
      {/* 头部 */}
      <div className="tk-recommend-header">
        <span className="tk-recommend-title">编队推荐</span>
        <button
          className="tk-recommend-close-btn"
          onClick={onClose}
          data-testid="recommend-close-btn"
        >
          关闭
        </button>
      </div>

      {/* 推荐方案列表 */}
      {plans.length === 0 ? (
        <div className="tk-recommend-empty" data-testid="recommend-empty">
          暂无可用武将，无法生成推荐编队
        </div>
      ) : (
        <div className="tk-recommend-list">
          {plans.map((plan) => {
            const powerDiff = plan.estimatedPower - currentPower;
            const diffClass =
              powerDiff > 0
                ? 'tk-recommend-power-diff--positive'
                : powerDiff < 0
                  ? 'tk-recommend-power-diff--negative'
                  : 'tk-recommend-power-diff--zero';

            return (
              <div
                key={plan.id}
                className={`tk-recommend-card ${getCardClass(plan)}`}
                data-testid={`recommend-card-${plan.id}`}
              >
                {/* 卡片头部 */}
                <div className="tk-recommend-card-header">
                  <span className="tk-recommend-card-name">{plan.name}</span>
                  <span className="tk-recommend-card-score">评分 {plan.score}</span>
                </div>

                {/* 战力 */}
                <div className="tk-recommend-power-row">
                  <span className="tk-recommend-power">
                    战力 {plan.estimatedPower.toLocaleString()}
                  </span>
                  <span className={diffClass}>
                    {powerDiff > 0 ? `↑+${powerDiff.toLocaleString()}` : powerDiff < 0 ? `↓${powerDiff.toLocaleString()}` : '→持平'}
                  </span>
                </div>

                {/* 羁绊 */}
                {plan.bonds.length > 0 && (
                  <div className="tk-recommend-bonds">
                    {plan.bonds.map((bond, i) => (
                      <span key={i} className="tk-recommend-bond-tag">
                        {bond}
                      </span>
                    ))}
                  </div>
                )}

                {/* 武将槽位 */}
                <div className="tk-recommend-slots">
                  {plan.heroIds.map((heroId, slotIdx) => {
                    const hero = heroMap.get(heroId);
                    if (!hero) {
                      return (
                        <div key={slotIdx} className="tk-recommend-slot tk-recommend-slot--empty">
                          -
                        </div>
                      );
                    }
                    return (
                      <div key={slotIdx} className="tk-recommend-slot">
                        <QualityBadge quality={toQualityLiteral(hero.quality)} size="small" />
                        <span style={{ marginLeft: 4 }}>{hero.name}</span>
                      </div>
                    );
                  })}
                  {/* 补齐空槽位 */}
                  {Array.from({ length: Math.max(0, 6 - plan.heroIds.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="tk-recommend-slot tk-recommend-slot--empty">
                      -
                    </div>
                  ))}
                </div>

                {/* 推荐依据 */}
                <div className="tk-recommend-basis">{plan.basis}</div>

                {/* 应用按钮 */}
                <button
                  className="tk-recommend-apply-btn"
                  onClick={() => handleApply(plan)}
                  data-testid={`apply-btn-${plan.id}`}
                >
                  应用此编队
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FormationRecommendPanel;
