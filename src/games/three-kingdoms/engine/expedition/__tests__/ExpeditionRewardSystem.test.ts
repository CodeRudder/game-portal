/**
 * ExpeditionRewardSystem 单元测试
 *
 * 覆盖：
 *   - 节点奖励计算（基础+评级倍率）
 *   - 掉落表（普通/Boss/奇袭Boss）
 *   - 首通额外奖励
 *   - 路线完成奖励汇总
 *   - 扫荡奖励（普通/高级/免费）
 *   - 里程碑奖励
 *   - 离线远征奖励
 *   - 可注入RNG测试
 */

import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import type { RewardParams, SweepRewardParams } from '../ExpeditionRewardSystem';
import {
  NodeType,
  RouteDifficulty,
  BattleGrade,
  SweepType,
  MilestoneType,
} from '../../../core/expedition/expedition.types';
import type { ExpeditionReward } from '../../../core/expedition/expedition.types';

// ── 辅助函数 ──────────────────────────────

/** 创建奖励参数 */
function createRewardParams(overrides: Partial<RewardParams> = {}): RewardParams {
  return {
    difficulty: RouteDifficulty.NORMAL,
    nodeType: NodeType.BOSS,
    grade: BattleGrade.MINOR_VICTORY,
    isFirstClear: false,
    isRouteComplete: false,
    ...overrides,
  };
}

/** 创建扫荡参数 */
function createSweepParams(overrides: Partial<SweepRewardParams> = {}): SweepRewardParams {
  return {
    difficulty: RouteDifficulty.NORMAL,
    sweepType: SweepType.NORMAL,
    heroCount: 3,
    ...overrides,
  };
}

/** 固定随机数生成器（始终返回0.5） */
function fixedRng(value: number = 0.5): () => number {
  return () => value;
}

// ── 全局实例 ──────────────────────────────

let rewards: ExpeditionRewardSystem;

beforeEach(() => {
  rewards = new ExpeditionRewardSystem(fixedRng(0.5));
});

// ═══════════════════════════════════════════
// 1. 节点奖励计算
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 节点奖励', () => {
  test('基础奖励非零', () => {
    const reward = rewards.calculateNodeReward(createRewardParams());
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
    expect(reward.exp).toBeGreaterThan(0);
  });

  test('大捷奖励 > 小胜奖励 > 惨胜奖励', () => {
    const great = rewards.calculateNodeReward(createRewardParams({ grade: BattleGrade.GREAT_VICTORY }));
    const minor = rewards.calculateNodeReward(createRewardParams({ grade: BattleGrade.MINOR_VICTORY }));
    const pyrrhic = rewards.calculateNodeReward(createRewardParams({ grade: BattleGrade.PYRRHIC_VICTORY }));

    expect(great.gold).toBeGreaterThan(minor.gold);
    expect(minor.gold).toBeGreaterThan(pyrrhic.gold);
  });

  test('惜败奖励最低', () => {
    const defeat = rewards.calculateNodeReward(createRewardParams({ grade: BattleGrade.NARROW_DEFEAT }));
    const minor = rewards.calculateNodeReward(createRewardParams({ grade: BattleGrade.MINOR_VICTORY }));
    expect(defeat.gold).toBeLessThan(minor.gold);
  });

  test('困难路线奖励 > 普通路线 > 简单路线', () => {
    const easy = rewards.calculateNodeReward(createRewardParams({ difficulty: RouteDifficulty.EASY }));
    const normal = rewards.calculateNodeReward(createRewardParams({ difficulty: RouteDifficulty.NORMAL }));
    const hard = rewards.calculateNodeReward(createRewardParams({ difficulty: RouteDifficulty.HARD }));

    expect(normal.gold).toBeGreaterThan(easy.gold);
    expect(hard.gold).toBeGreaterThan(normal.gold);
  });

  test('奇袭路线奖励最高', () => {
    const ambush = rewards.calculateNodeReward(createRewardParams({ difficulty: RouteDifficulty.AMBUSH }));
    const hard = rewards.calculateNodeReward(createRewardParams({ difficulty: RouteDifficulty.HARD }));
    expect(ambush.gold).toBeGreaterThan(hard.gold);
  });

  test('BOSS节点奖励倍率1.0', () => {
    const boss = rewards.calculateNodeReward(createRewardParams({ nodeType: NodeType.BOSS }));
    const bandit = rewards.calculateNodeReward(createRewardParams({ nodeType: NodeType.BANDIT }));
    expect(boss.gold).toBeGreaterThan(bandit.gold);
  });

  test('休息节点奖励为0', () => {
    const rest = rewards.calculateNodeReward(createRewardParams({ nodeType: NodeType.REST }));
    expect(rest.grain).toBe(0);
    expect(rest.gold).toBe(0);
    expect(rest.exp).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 2. 掉落表
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 掉落表', () => {
  test('高RNG值（0.99）不掉落普通物品', () => {
    const highRng = new ExpeditionRewardSystem(() => 0.99);
    const reward = highRng.calculateNodeReward(createRewardParams({
      nodeType: NodeType.BANDIT,
      difficulty: RouteDifficulty.EASY,
    }));
    // rng=0.99 超过所有普通掉率，不掉落
    expect(reward.drops.length).toBe(0);
  });

  test('低RNG值（0.01）触发所有掉落', () => {
    const lowRng = new ExpeditionRewardSystem(() => 0.01);
    const reward = lowRng.calculateNodeReward(createRewardParams({
      nodeType: NodeType.BOSS,
      difficulty: RouteDifficulty.HARD,
    }));
    // rng=0.01 < 所有boss掉率，全部触发
    expect(reward.drops.length).toBeGreaterThan(0);
  });

  test('BOSS掉落比普通更丰富', () => {
    const bossReward = rewards.calculateNodeReward(createRewardParams({ nodeType: NodeType.BOSS }));
    const banditReward = rewards.calculateNodeReward(createRewardParams({ nodeType: NodeType.BANDIT }));
    // boss掉落表有更多条目（5 vs 3）
    // rng=0.5, boss掉率: 0.60/0.15/0.10/0.08/0.01 → 4个命中
    // bandit掉率: 0.30/0.05/0.02 → 0个命中(0.5>0.30)
    expect(bossReward.drops.length).toBeGreaterThanOrEqual(banditReward.drops.length);
  });

  test('奇袭BOSS掉落传说装备概率更高', () => {
    const lowRng = new ExpeditionRewardSystem(() => 0.01);
    const ambushReward = lowRng.calculateNodeReward(createRewardParams({
      nodeType: NodeType.BOSS,
      difficulty: RouteDifficulty.AMBUSH,
    }));
    const hasLegendary = ambushReward.drops.some(d => d.type === 'legendary_equip');
    expect(hasLegendary).toBe(true);
  });
});

// ═══════════════════════════════════════════
// 3. 首通额外奖励
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 首通奖励', () => {
  test('首通添加稀有武将碎片', () => {
    const reward = rewards.calculateNodeReward(createRewardParams({ isFirstClear: true }));
    const firstClearDrop = reward.drops.find(d => d.id === 'hf_first_clear');
    expect(firstClearDrop).toBeDefined();
    expect(firstClearDrop!.type).toBe('hero_fragment');
  });

  test('非首通无额外碎片', () => {
    const reward = rewards.calculateNodeReward(createRewardParams({ isFirstClear: false }));
    const firstClearDrop = reward.drops.find(d => d.id === 'hf_first_clear');
    expect(firstClearDrop).toBeUndefined();
  });
});

// ═══════════════════════════════════════════
// 4. 路线完成奖励
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 路线完成奖励', () => {
  test('汇总所有战斗节点奖励', () => {
    const nodeResults = [
      { nodeType: NodeType.BANDIT, grade: BattleGrade.GREAT_VICTORY },
      { nodeType: NodeType.HAZARD, grade: BattleGrade.MINOR_VICTORY },
      { nodeType: NodeType.BOSS, grade: BattleGrade.GREAT_VICTORY },
    ];
    const reward = rewards.calculateRouteReward(RouteDifficulty.NORMAL, nodeResults, false);
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
  });

  test('宝箱节点计入奖励', () => {
    const withTreasure = [
      { nodeType: NodeType.BANDIT, grade: BattleGrade.MINOR_VICTORY },
      { nodeType: NodeType.TREASURE, grade: BattleGrade.GREAT_VICTORY },
      { nodeType: NodeType.BOSS, grade: BattleGrade.MINOR_VICTORY },
    ];
    const withoutTreasure = [
      { nodeType: NodeType.BANDIT, grade: BattleGrade.MINOR_VICTORY },
      { nodeType: NodeType.BOSS, grade: BattleGrade.MINOR_VICTORY },
    ];
    const r1 = rewards.calculateRouteReward(RouteDifficulty.NORMAL, withTreasure, false);
    const r2 = rewards.calculateRouteReward(RouteDifficulty.NORMAL, withoutTreasure, false);
    expect(r1.gold).toBeGreaterThan(r2.gold);
  });

  test('休息节点不计入奖励', () => {
    const withRest = [
      { nodeType: NodeType.BANDIT, grade: BattleGrade.MINOR_VICTORY },
      { nodeType: NodeType.REST, grade: BattleGrade.GREAT_VICTORY },
      { nodeType: NodeType.BOSS, grade: BattleGrade.MINOR_VICTORY },
    ];
    const withoutRest = [
      { nodeType: NodeType.BANDIT, grade: BattleGrade.MINOR_VICTORY },
      { nodeType: NodeType.BOSS, grade: BattleGrade.MINOR_VICTORY },
    ];
    const r1 = rewards.calculateRouteReward(RouteDifficulty.NORMAL, withRest, false);
    const r2 = rewards.calculateRouteReward(RouteDifficulty.NORMAL, withoutRest, false);
    expect(r1.grain).toBe(r2.grain);
  });

  test('首通路线额外奖励', () => {
    const nodes = [{ nodeType: NodeType.BOSS, grade: BattleGrade.MINOR_VICTORY }];
    const firstClear = rewards.calculateRouteReward(RouteDifficulty.NORMAL, nodes, true);
    const normal = rewards.calculateRouteReward(RouteDifficulty.NORMAL, nodes, false);
    expect(firstClear.gold).toBeGreaterThan(normal.gold);
  });
});

// ═══════════════════════════════════════════
// 5. 扫荡奖励
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 扫荡奖励', () => {
  test('普通扫荡 ×1.0', () => {
    const reward = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    expect(reward.grain).toBeGreaterThan(0);
  });

  test('高级扫荡 ×1.5', () => {
    const normal = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    const advanced = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));
    expect(advanced.gold).toBeGreaterThan(normal.gold);
  });

  test('免费扫荡 ×0.5', () => {
    const normal = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    const free = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.FREE }));
    expect(free.gold).toBeLessThan(normal.gold);
  });

  test('高级扫荡保底稀有掉落', () => {
    // rng=0.99，无自然掉落，但高级扫荡有保底
    const highRng = new ExpeditionRewardSystem(() => 0.99);
    const reward = highRng.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));
    const hasGuaranteed = reward.drops.some(d => d.id === 'rm_guaranteed');
    expect(hasGuaranteed).toBe(true);
  });

  test('困难路线扫荡奖励更高', () => {
    const easy = rewards.calculateSweepReward(createSweepParams({ difficulty: RouteDifficulty.EASY }));
    const hard = rewards.calculateSweepReward(createSweepParams({ difficulty: RouteDifficulty.HARD }));
    expect(hard.gold).toBeGreaterThan(easy.gold);
  });
});

// ═══════════════════════════════════════════
// 6. 里程碑奖励
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 里程碑奖励', () => {
  test('初出茅庐有奖励', () => {
    const reward = rewards.getMilestoneReward(MilestoneType.FIRST_CLEAR);
    expect(reward).not.toBeNull();
    expect(reward!.gold).toBeGreaterThan(0);
  });

  test('不存在里程碑返回null', () => {
    // 使用类型断言绕过类型检查
    const reward = rewards.getMilestoneReward('NONEXISTENT' as MilestoneType);
    expect(reward).toBeNull();
  });
});

// ═══════════════════════════════════════════
// 7. 离线远征奖励
// ═══════════════════════════════════════════

describe('ExpeditionRewardSystem — 离线远征奖励', () => {
  const baseReward: ExpeditionReward = {
    grain: 100, gold: 200, iron: 10, equipFragments: 5, exp: 300, drops: [],
  };

  test('离线奖励按次数×效率计算', () => {
    const result = rewards.calculateOfflineReward(baseReward, 3600, 5);
    expect(result.completedRuns).toBe(5);
    expect(result.efficiency).toBe(0.85);
    expect(result.totalReward.gold).toBe(Math.round(200 * 5 * 0.85));
  });

  test('离线时间上限72小时', () => {
    const result = rewards.calculateOfflineReward(baseReward, 100 * 3600, 10);
    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBe(72 * 3600);
  });

  test('未超时不算capped', () => {
    const result = rewards.calculateOfflineReward(baseReward, 24 * 3600, 5);
    expect(result.isTimeCapped).toBe(false);
  });
});
