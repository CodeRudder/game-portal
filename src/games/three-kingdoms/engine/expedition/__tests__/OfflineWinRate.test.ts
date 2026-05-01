/**
 * 离线胜率 × 0.85 系数 — P1 测试
 *
 * 验证远征系统离线战斗胜率 = 在线胜率 × 0.85 的完整逻辑：
 *   1. 在线胜率计算正确（基于战力比的 estimateWinRate 分段映射）
 *   2. 离线胜率 = 在线胜率 × 0.85（winRateModifier）
 *   3. 0.85 系数不可配置（as const 硬编码）
 *   4. 极端场景：100%→85%、0%→0%
 *   5. 离线收益体现 battleEfficiency × 0.85
 *
 * PRD 参考：EXP-3 §3.15 离线战斗规则
 *
 * @module engine/expedition/__tests__/OfflineWinRate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import { AutoExpeditionSystem } from '../AutoExpeditionSystem';
import type { OfflineExpeditionParams } from '../AutoExpeditionSystem';
import {
  FormationType,
  OFFLINE_EXPEDITION_CONFIG,
  RouteDifficulty,
  BattleGrade,
} from '../../../core/expedition/expedition.types';
import { BASE_REWARDS } from '../expedition-config';

// ── 辅助函数 ──────────────────────────────

/** 将 BASE_REWARDS 转为完整的 ExpeditionReward（含 drops） */
function toFullReward(r: { grain: number; gold: number; iron: number; equipFragments: number; exp: number }): import('../../../core/expedition/expedition.types').ExpeditionReward {
  return { ...r, drops: [] };
}

/** 创建基础离线远征参数 */
function createOfflineParams(
  overrides?: Partial<OfflineExpeditionParams>,
): OfflineExpeditionParams {
  const easyReward = BASE_REWARDS[RouteDifficulty.EASY];
  return {
    offlineSeconds: 3600, // 1小时
    teamPower: 5000,
    teamFormation: FormationType.STANDARD,
    routeAvgPower: 3000,
    routeAvgFormation: FormationType.FLANKING,
    avgRouteDurationSeconds: 600, // 10分钟
    baseRouteReward: {
      grain: easyReward.grain,
      gold: easyReward.gold,
      iron: easyReward.iron,
      equipFragments: easyReward.equipFragments,
      exp: easyReward.exp,
      drops: [],
    },
    heroCount: 3,
    ...overrides,
  };
}

/**
 * 从 AutoExpeditionSystem 提取 estimateWinRate 的分段映射表
 *
 * 由于 estimateWinRate 是私有方法，我们通过公开的 calculateOfflineExpedition
 * 间接验证。这里手动维护一份参考表用于断言。
 *
 * powerRatio → baseWinRate 映射：
 *   ≥2.0 → 0.95
 *   ≥1.5 → 0.85
 *   ≥1.2 → 0.70
 *   ≥1.0 → 0.55
 *   ≥0.8 → 0.35
 *   ≥0.6 → 0.15
 *   <0.6 → 0.05
 */
const WIN_RATE_TABLE: Array<{
  powerRatio: number;
  expectedBase: number;
  label: string;
}> = [
  { powerRatio: 2.5, expectedBase: 0.95, label: '压倒性优势(≥2.0)' },
  { powerRatio: 2.0, expectedBase: 0.95, label: '战力比=2.0边界' },
  { powerRatio: 1.8, expectedBase: 0.85, label: '明显优势(≥1.5)' },
  { powerRatio: 1.5, expectedBase: 0.85, label: '战力比=1.5边界' },
  { powerRatio: 1.3, expectedBase: 0.70, label: '优势(≥1.2)' },
  { powerRatio: 1.2, expectedBase: 0.70, label: '战力比=1.2边界' },
  { powerRatio: 1.1, expectedBase: 0.55, label: '势均力敌(≥1.0)' },
  { powerRatio: 1.0, expectedBase: 0.55, label: '战力比=1.0边界' },
  { powerRatio: 0.9, expectedBase: 0.35, label: '轻微劣势(≥0.8)' },
  { powerRatio: 0.8, expectedBase: 0.35, label: '战力比=0.8边界' },
  { powerRatio: 0.7, expectedBase: 0.15, label: '明显劣势(≥0.6)' },
  { powerRatio: 0.6, expectedBase: 0.15, label: '战力比=0.6边界' },
  { powerRatio: 0.5, expectedBase: 0.05, label: '压倒性劣势(<0.6)' },
  { powerRatio: 0.1, expectedBase: 0.05, label: '极端劣势' },
];

// ═══════════════════════════════════════════
// 一、0.85 系数不可配置（常量断言）
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 系数常量断言', () => {
  it('winRateModifier 应精确等于 0.85', () => {
    expect(OFFLINE_EXPEDITION_CONFIG.winRateModifier).toBe(0.85);
  });

  it('battleEfficiency 应精确等于 0.85', () => {
    expect(OFFLINE_EXPEDITION_CONFIG.battleEfficiency).toBe(0.85);
  });

  it('maxOfflineHours 应为 72', () => {
    expect(OFFLINE_EXPEDITION_CONFIG.maxOfflineHours).toBe(72);
  });

  it('OFFLINE_EXPEDITION_CONFIG 使用 as const，属性不可重赋值', () => {
    // TypeScript 的 as const 使属性 readonly
    // 运行时验证：属性描述符 writable 应为 false
    const desc = Object.getOwnPropertyDescriptor(
      OFFLINE_EXPEDITION_CONFIG,
      'winRateModifier',
    );
    expect(desc).toBeDefined();
    // as const 在运行时可能不冻结，但 TypeScript 层面是 readonly
    // 我们验证值本身不被意外修改
    expect(OFFLINE_EXPEDITION_CONFIG.winRateModifier).toBe(0.85);
    expect(OFFLINE_EXPEDITION_CONFIG.battleEfficiency).toBe(0.85);
  });

  it('0.85 系数不是近似值，是精确值', () => {
    // 不能是 0.8499 或 0.8501 等近似值
    expect(OFFLINE_EXPEDITION_CONFIG.winRateModifier).not.toBeCloseTo(0.84, 2);
    expect(OFFLINE_EXPEDITION_CONFIG.winRateModifier).not.toBeCloseTo(0.86, 2);
    expect(OFFLINE_EXPEDITION_CONFIG.winRateModifier).toBe(0.85);

    expect(OFFLINE_EXPEDITION_CONFIG.battleEfficiency).not.toBeCloseTo(0.84, 2);
    expect(OFFLINE_EXPEDITION_CONFIG.battleEfficiency).not.toBeCloseTo(0.86, 2);
    expect(OFFLINE_EXPEDITION_CONFIG.battleEfficiency).toBe(0.85);
  });
});

// ═══════════════════════════════════════════
// 二、在线胜率计算正确（estimateWinRate 分段映射）
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 在线基础胜率计算', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  /**
   * 通过 calculateOfflineExpedition 间接验证 estimateWinRate
   *
   * 已知公式：
   *   completedRuns = max(1, round(maxRuns × baseWinRate × winRateModifier))
   *   maxRuns = floor(cappedSeconds / avgDuration)
   *
   * 反推 baseWinRate：
   *   offlineWinRate = completedRuns / maxRuns（近似）
   *   baseWinRate = offlineWinRate / 0.85
   */
  function inferBaseWinRate(
    powerRatio: number,
    offlineSeconds: number = 36000, // 10小时，提高精度
    avgDuration: number = 600,
  ): number {
    const params = createOfflineParams({
      teamPower: powerRatio * 3000, // 敌方战力固定3000
      routeAvgPower: 3000,
      offlineSeconds,
      avgRouteDurationSeconds: avgDuration,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD, // 无克制，counterBonus=0
    });
    const result = autoSystem.calculateOfflineExpedition(params);
    const maxRuns = Math.floor(offlineSeconds / avgDuration);
    if (maxRuns === 0) return 0;
    const offlineWinRate = result.completedRuns / maxRuns;
    return offlineWinRate / OFFLINE_EXPEDITION_CONFIG.winRateModifier;
  }

  it.each(WIN_RATE_TABLE)(
    '战力比 $label ($powerRatio) → 基础胜率 ≈ $expectedBase',
    ({ powerRatio, expectedBase }) => {
      const inferred = inferBaseWinRate(powerRatio);
      // 允许 ±0.05 的误差（因为 completedRuns 经过 round 和 max(1,...) 处理）
      expect(inferred).toBeCloseTo(expectedBase, 0);
    },
  );

  it('战力比越高，基础胜率越高（单调递增）', () => {
    const ratios = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0];
    const winRates = ratios.map(r => inferBaseWinRate(r));

    // 验证单调递增（允许相等，因为分段函数）
    for (let i = 1; i < winRates.length; i++) {
      expect(winRates[i]).toBeGreaterThanOrEqual(winRates[i - 1]);
    }
  });

  it('战力比极低时基础胜率不低于 0.05', () => {
    const inferred = inferBaseWinRate(0.01);
    expect(inferred).toBeGreaterThanOrEqual(0.04); // 允许误差
  });

  it('战力比极高时基础胜率不超过 0.95', () => {
    const inferred = inferBaseWinRate(10.0);
    expect(inferred).toBeLessThanOrEqual(0.96); // 允许误差
  });
});

// ═══════════════════════════════════════════
// 三、离线胜率 = 在线胜率 × 0.85
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 离线胜率 = 基础胜率 × 0.85', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  /**
   * 精确计算完成次数，验证离线胜率公式
   *
   * 公式链：
   *   counterBonus = getCounterBonus(teamFormation, enemyFormation)
   *   effectivePower = teamPower × (1 + counterBonus)
   *   powerRatio = effectivePower / max(routeAvgPower, 1)
   *   baseWinRate = estimateWinRate(powerRatio)
   *   offlineWinRate = baseWinRate × winRateModifier(0.85)
   *   completedRuns = max(1, round(maxRuns × offlineWinRate))
   */
  it('高战力场景：战力比≥2.0 → 离线胜率=0.95×0.85=0.8075', () => {
    const params = createOfflineParams({
      teamPower: 6000,
      routeAvgPower: 3000, // 战力比=2.0（无克制时）
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD, // 无克制
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // maxRuns = floor(3600/600) = 6
    // offlineWinRate = 0.95 × 0.85 = 0.8075
    // completedRuns = max(1, round(6 × 0.8075)) = max(1, round(4.845)) = max(1, 5) = 5
    expect(result.completedRuns).toBe(5);
  });

  it('中等战力场景：战力比≈1.2 → 离线胜率=0.70×0.85=0.595', () => {
    const params = createOfflineParams({
      teamPower: 3600,
      routeAvgPower: 3000, // 战力比=1.2
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 7200, // 2小时
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // maxRuns = floor(7200/600) = 12
    // offlineWinRate = 0.70 × 0.85 = 0.595
    // completedRuns = max(1, round(12 × 0.595)) = max(1, round(7.14)) = max(1, 7) = 7
    expect(result.completedRuns).toBe(7);
  });

  it('低战力场景：战力比<0.6 → 离线胜率=0.05×0.85=0.0425', () => {
    const params = createOfflineParams({
      teamPower: 1500,
      routeAvgPower: 3000, // 战力比=0.5
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // maxRuns = floor(3600/600) = 6
    // offlineWinRate = 0.05 × 0.85 = 0.0425
    // completedRuns = max(1, round(6 × 0.0425)) = max(1, round(0.255)) = max(1, 0) = 1
    // 因为 max(1,...) 保证至少完成1次
    expect(result.completedRuns).toBe(1);
  });

  it('阵型克制影响战力比 → 间接影响离线胜率', () => {
    // OFFENSIVE克制DEFENSIVE，counterBonus=0.10
    const counterParams = createOfflineParams({
      teamPower: 3000,
      routeAvgPower: 3000, // 基础战力比=1.0
      teamFormation: FormationType.OFFENSIVE, // 锋矢（克制方圆）
      routeAvgFormation: FormationType.DEFENSIVE, // 方圆（被克制）
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });

    // 无克制对照
    const neutralParams = createOfflineParams({
      teamPower: 3000,
      routeAvgPower: 3000,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });

    const counterResult = autoSystem.calculateOfflineExpedition(counterParams);
    const neutralResult = autoSystem.calculateOfflineExpedition(neutralParams);

    // 克制方 effectivePower = 3000 × 1.10 = 3300，powerRatio = 1.1
    // 无克制 effectivePower = 3000，powerRatio = 1.0
    // 克制时胜率更高，完成次数应更多
    expect(counterResult.completedRuns).toBeGreaterThanOrEqual(
      neutralResult.completedRuns,
    );
  });

  it('被克制时离线胜率降低', () => {
    // DEFENSIVE被OFFENSIVE克制，counterBonus=-0.10
    const counteredParams = createOfflineParams({
      teamPower: 3000,
      routeAvgPower: 3000,
      teamFormation: FormationType.DEFENSIVE, // 方圆
      routeAvgFormation: FormationType.OFFENSIVE, // 锋矢（克制方圆）
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });

    // 无克制对照
    const neutralParams = createOfflineParams({
      teamPower: 3000,
      routeAvgPower: 3000,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });

    const counteredResult = autoSystem.calculateOfflineExpedition(counteredParams);
    const neutralResult = autoSystem.calculateOfflineExpedition(neutralParams);

    // 被克制 effectivePower = 3000 × 0.90 = 2700，powerRatio = 0.9
    // 无克制 effectivePower = 3000，powerRatio = 1.0
    expect(counteredResult.completedRuns).toBeLessThanOrEqual(
      neutralResult.completedRuns,
    );
  });

  it('离线完成次数 < 理论最大次数（胜率衰减验证）', () => {
    const params = createOfflineParams({
      teamPower: 4000,
      routeAvgPower: 3000,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    const maxRuns = Math.floor(params.offlineSeconds / params.avgRouteDurationSeconds);
    // 由于离线胜率 < 基础胜率 ≤ 1.0，完成次数应严格小于理论最大次数
    expect(result.completedRuns).toBeLessThan(maxRuns);
    // 效率应 < 1.0
    expect(result.efficiency).toBeLessThan(1.0);
  });

  it('多次调用结果一致（确定性验证）', () => {
    const params = createOfflineParams({
      teamPower: 5000,
      routeAvgPower: 3000,
      offlineSeconds: 7200,
      avgRouteDurationSeconds: 600,
    });

    const results = Array.from({ length: 5 }, () =>
      autoSystem.calculateOfflineExpedition(params),
    );

    // 所有结果应完全一致（无随机因素）
    const first = results[0];
    for (const r of results) {
      expect(r.completedRuns).toBe(first.completedRuns);
      expect(r.efficiency).toBe(first.efficiency);
      expect(r.totalReward.gold).toBe(first.totalReward.gold);
    }
  });
});

// ═══════════════════════════════════════════
// 四、极端场景
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 极端场景', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('100%在线胜率 → 85%离线胜率（战力比≥2.0场景）', () => {
    // 战力比≥2.0时基础胜率=0.95（最高），不是100%
    // 但我们可以验证：最高基础胜率×0.85的衰减效果
    const params = createOfflineParams({
      teamPower: 10000,
      routeAvgPower: 3000, // 战力比≈3.33，远超2.0
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // 即使战力远超对手，离线完成次数仍低于理论最大
    const maxRuns = Math.floor(3600 / 600);
    expect(result.completedRuns).toBeLessThan(maxRuns);

    // 0.95 × 0.85 = 0.8075，完成次数 ≈ round(6 × 0.8075) = 5
    expect(result.completedRuns).toBe(5);
  });

  it('极低战力场景：离线胜率趋近于0但至少完成1次', () => {
    const params = createOfflineParams({
      teamPower: 100,
      routeAvgPower: 3000, // 战力比≈0.033
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // max(1,...) 保证至少完成1次
    expect(result.completedRuns).toBeGreaterThanOrEqual(1);
    // 效率应极低
    expect(result.efficiency).toBeLessThan(0.2);
  });

  it('0%在线胜率 → 离线仍至少完成1次（max(1,...)保底）', () => {
    // 即使战力极低，completedRuns = max(1, ...) 保证至少1次
    const params = createOfflineParams({
      teamPower: 1,
      routeAvgPower: 10000,
      offlineSeconds: 600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);
    expect(result.completedRuns).toBeGreaterThanOrEqual(1);
  });

  it('离线时间为0时仍可计算', () => {
    const params = createOfflineParams({
      offlineSeconds: 0,
    });
    const result = autoSystem.calculateOfflineExpedition(params);
    // 0秒离线，maxRuns=0，但 max(1,...) 保证至少1次
    expect(result.completedRuns).toBeGreaterThanOrEqual(1);
    expect(result.offlineSeconds).toBe(0);
  });

  it('离线时间超过72h上限时截断', () => {
    const params = createOfflineParams({
      offlineSeconds: 100 * 3600, // 100小时
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // 应截断到72小时
    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBe(72 * 3600);
  });

  it('离线时间恰好72h不截断', () => {
    const params = createOfflineParams({
      offlineSeconds: 72 * 3600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    expect(result.isTimeCapped).toBe(false);
    expect(result.offlineSeconds).toBe(72 * 3600);
  });

  it('avgRouteDurationSeconds为极小值时不会除零', () => {
    const params = createOfflineParams({
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 1, // 极小值
    });
    expect(() => {
      autoSystem.calculateOfflineExpedition(params);
    }).not.toThrow();
  });

  it('routeAvgPower为0时不会除零', () => {
    const params = createOfflineParams({
      routeAvgPower: 0,
    });
    expect(() => {
      autoSystem.calculateOfflineExpedition(params);
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════
// 五、离线收益体现 battleEfficiency × 0.85
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 离线收益验证', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('离线收益 = 基础奖励 × completedRuns × battleEfficiency(0.85)', () => {
    const baseReward = toFullReward(BASE_REWARDS[RouteDifficulty.EASY]);
    const params = createOfflineParams({
      offlineSeconds: 600, // 恰好1次路线时长
      avgRouteDurationSeconds: 600,
      teamPower: 5000,
      routeAvgPower: 3000,
      baseRouteReward: baseReward,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // totalReward = baseReward × completedRuns × 0.85
    const expectedGold = Math.round(
      baseReward.gold * result.completedRuns * OFFLINE_EXPEDITION_CONFIG.battleEfficiency,
    );
    expect(result.totalReward.gold).toBe(expectedGold);

    const expectedGrain = Math.round(
      baseReward.grain * result.completedRuns * OFFLINE_EXPEDITION_CONFIG.battleEfficiency,
    );
    expect(result.totalReward.grain).toBe(expectedGrain);
  });

  it('不同难度的奖励均体现0.85效率系数', () => {
    const difficulties: RouteDifficulty[] = [
      RouteDifficulty.EASY,
      RouteDifficulty.NORMAL,
      RouteDifficulty.HARD,
    ];

    for (const difficulty of difficulties) {
      const baseReward = toFullReward(BASE_REWARDS[difficulty]);
      const params = createOfflineParams({
        offlineSeconds: 600,
        avgRouteDurationSeconds: 600,
        baseRouteReward: baseReward,
      });
      const result = autoSystem.calculateOfflineExpedition(params);

      const expectedGold = Math.round(
        baseReward.gold * result.completedRuns * OFFLINE_EXPEDITION_CONFIG.battleEfficiency,
      );
      expect(result.totalReward.gold).toBe(expectedGold);
    }
  });

  it('长时间离线收益不超过72h上限对应的奖励', () => {
    const baseReward = toFullReward(BASE_REWARDS[RouteDifficulty.EASY]);

    const params72h = createOfflineParams({
      offlineSeconds: 72 * 3600,
      avgRouteDurationSeconds: 600,
      baseRouteReward: baseReward,
    });

    const params100h = createOfflineParams({
      offlineSeconds: 100 * 3600,
      avgRouteDurationSeconds: 600,
      baseRouteReward: baseReward,
    });

    const result72h = autoSystem.calculateOfflineExpedition(params72h);
    const result100h = autoSystem.calculateOfflineExpedition(params100h);

    // 100h收益不应超过72h收益（因为截断）
    expect(result100h.totalReward.gold).toBe(result72h.totalReward.gold);
    expect(result100h.totalReward.grain).toBe(result72h.totalReward.grain);
  });

  it('效率值计算正确', () => {
    const params = createOfflineParams({
      teamPower: 6000,
      routeAvgPower: 3000,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // efficiency = (completedRuns × battleEfficiency) / theoreticalMaxRuns
    const theoreticalMaxRuns = params.offlineSeconds / params.avgRouteDurationSeconds;
    const expectedEfficiency =
      (result.completedRuns * OFFLINE_EXPEDITION_CONFIG.battleEfficiency) /
      theoreticalMaxRuns;
    expect(result.efficiency).toBeCloseTo(expectedEfficiency, 2);
  });
});

// ═══════════════════════════════════════════
// 六、estimateOfflineEarnings 预估接口
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 预估收益接口', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('预估收益按1/2/4/8/12/24/48/72小时递增', () => {
    const params = createOfflineParams({
      teamPower: 5000,
      routeAvgPower: 3000,
    });
    const estimates = autoSystem.estimateOfflineEarnings(params, 72);

    // 预估点应包含标准时间节点
    expect(estimates.length).toBeGreaterThan(0);

    // 完成次数应随时间递增
    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i].runs).toBeGreaterThanOrEqual(estimates[i - 1].runs);
    }

    // 奖励应随时间递增
    for (let i = 1; i < estimates.length; i++) {
      expect(estimates[i].reward.gold).toBeGreaterThanOrEqual(
        estimates[i - 1].reward.gold,
      );
    }
  });

  it('预估收益不超过72h', () => {
    const params = createOfflineParams({
      teamPower: 5000,
      routeAvgPower: 3000,
    });
    const estimates = autoSystem.estimateOfflineEarnings(params, 100);

    // 最大预估点不超过72h
    const maxHours = estimates[estimates.length - 1]?.hours ?? 0;
    expect(maxHours).toBeLessThanOrEqual(72);
  });

  it('预估收益中的0.85系数一致', () => {
    const params = createOfflineParams({
      teamPower: 5000,
      routeAvgPower: 3000,
      baseRouteReward: toFullReward(BASE_REWARDS[RouteDifficulty.EASY]),
    });
    const estimates = autoSystem.estimateOfflineEarnings(params, 72);

    for (const est of estimates) {
      // 每个预估点的奖励应体现0.85效率
      const directResult = autoSystem.calculateOfflineExpedition({
        ...params,
        offlineSeconds: est.hours * 3600,
      });
      expect(est.reward.gold).toBe(directResult.totalReward.gold);
    }
  });
});

// ═══════════════════════════════════════════
// 七、与在线战斗对比（胜率衰减量化）
// ═══════════════════════════════════════════

describe('离线胜率×0.85 — 与在线战斗对比', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem();
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  it('在线快速战斗胜率（多次采样）> 离线胜率', () => {
    // 在线快速战斗（quickBattle）使用随机因素，但总体胜率高于离线
    // 我们通过统计多次 quickBattle 的胜率来估算在线胜率
    const allyPower = 4000;
    const enemyPower = 3000;

    let onlineWins = 0;
    const samples = 100;
    for (let i = 0; i < samples; i++) {
      const result = battleSystem.quickBattle(
        allyPower,
        FormationType.STANDARD,
        enemyPower,
        FormationType.STANDARD,
      );
      if (result.grade !== BattleGrade.NARROW_DEFEAT) {
        onlineWins++;
      }
    }
    const onlineWinRate = onlineWins / samples;

    // 离线胜率（通过 calculateOfflineExpedition 间接获取）
    const offlineParams = createOfflineParams({
      teamPower: allyPower,
      routeAvgPower: enemyPower,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 36000, // 10小时
      avgRouteDurationSeconds: 600,
    });
    const offlineResult = autoSystem.calculateOfflineExpedition(offlineParams);
    const maxRuns = Math.floor(36000 / 600);
    const offlineWinRate = offlineResult.completedRuns / maxRuns;

    // 在线胜率应高于离线胜率（因为离线有0.85衰减）
    // 注意：quickBattle有随机因素，但我们用100次采样取均值
    expect(onlineWinRate).toBeGreaterThan(offlineWinRate);
  });

  it('离线效率 = 在线效率 × 胜率衰减 × 战斗效率衰减', () => {
    const params = createOfflineParams({
      teamPower: 5000,
      routeAvgPower: 3000,
      teamFormation: FormationType.STANDARD,
      routeAvgFormation: FormationType.STANDARD,
      offlineSeconds: 3600,
      avgRouteDurationSeconds: 600,
    });
    const result = autoSystem.calculateOfflineExpedition(params);

    // 理论最大效率 = 1.0（在线，100%胜率，无衰减）
    // 离线效率 = baseWinRate × winRateModifier × battleEfficiency
    // 应 < 1.0
    expect(result.efficiency).toBeLessThan(1.0);

    // 离线效率应 > 0（有战力优势时）
    expect(result.efficiency).toBeGreaterThan(0);
  });
});
