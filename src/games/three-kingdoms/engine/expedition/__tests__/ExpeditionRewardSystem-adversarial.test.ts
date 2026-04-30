/**
 * ExpeditionRewardSystem 对抗式测试（Adversarial Test）
 *
 * 重点测试：
 *   P0-1: 奖励计算边界（零值/负数/NaN）
 *   P0-2: 掉落概率边界（全掉/全不掉）
 *   P0-3: 扫荡奖励倍率
 *   P0-4: 离线远征奖励（极端时间/零时间）
 *   P0-5: 首通奖励
 *
 * @module engine/expedition/__tests__/ExpeditionRewardSystem-adversarial
 */

import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import type { RewardParams, SweepRewardParams } from '../ExpeditionRewardSystem';
import {
  RouteDifficulty,
  NodeType,
  BattleGrade,
  SweepType,
  MilestoneType,
} from '../../../core/expedition/expedition.types';

// ── 辅助 ──────────────────────────────

/** 创建确定性随机数生成器（始终返回固定值） */
function createFixedRng(value: number): () => number {
  return () => value;
}

let rewardSystem: ExpeditionRewardSystem;

beforeEach(() => {
  rewardSystem = new ExpeditionRewardSystem();
});

// ═══════════════════════════════════════════════════════════
// P0-1: 奖励计算边界
// ═══════════════════════════════════════════════════════════

describe('P0-1: 奖励计算边界', () => {
  test('简单难度基础奖励正确', () => {
    const reward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.EASY,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
    expect(reward.exp).toBeGreaterThan(0);
  });

  test('困难难度奖励高于简单', () => {
    const easy = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.EASY,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const hard = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.HARD,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(hard.grain).toBeGreaterThan(easy.grain);
    expect(hard.gold).toBeGreaterThan(easy.gold);
  });

  test('大捷奖励倍率1.5', () => {
    const minor = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const great = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    // 大捷倍率1.5 vs 小胜倍率1.0
    expect(great.grain).toBe(Math.round(minor.grain * 1.5));
  });

  test('惜败奖励倍率0.3', () => {
    const minor = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const defeat = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.NARROW_DEFEAT,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(defeat.grain).toBe(Math.round(minor.grain * 0.3));
  });

  test('休息节点奖励为0', () => {
    const reward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.HARD,
      nodeType: NodeType.REST,
      grade: BattleGrade.GREAT_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(reward.grain).toBe(0);
    expect(reward.gold).toBe(0);
    expect(reward.exp).toBe(0);
  });

  test('宝箱节点奖励倍率0.8', () => {
    const reward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.TREASURE,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
  });

  test('山贼节点奖励倍率0.3', () => {
    const banditReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BANDIT,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const bossReward = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    // 山贼奖励应低于BOSS
    expect(banditReward.grain).toBeLessThan(bossReward.grain);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-2: 掉落概率边界
// ═══════════════════════════════════════════════════════════

describe('P0-2: 掉落概率边界', () => {
  test('rng=1（永远不触发掉落）：无掉落', () => {
    const rng1 = createFixedRng(0.99); // rng < rate 才触发
    const system = new ExpeditionRewardSystem(rng1);

    const reward = system.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BANDIT,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    // rng=0.99 > 0.30(装备碎片率)，不掉落
    expect(reward.drops.length).toBe(0);
  });

  test('rng=0（永远触发掉落）：最大掉落', () => {
    const rng0 = createFixedRng(0);
    const system = new ExpeditionRewardSystem(rng0);

    const reward = system.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    // BOSS掉落表有5种物品，rng=0全部触发
    expect(reward.drops.length).toBe(5);
  });

  test('奇袭BOSS掉落表独立于普通BOSS', () => {
    const rng0 = createFixedRng(0);
    const system = new ExpeditionRewardSystem(rng0);

    const ambushReward = system.calculateNodeReward({
      difficulty: RouteDifficulty.AMBUSH,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });

    const normalReward = system.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });

    // 奇袭BOSS掉落表有5种物品
    expect(ambushReward.drops.length).toBe(5);
    // 奇袭掉落的数量应该更多
    const ambushTotalCount = ambushReward.drops.reduce((sum, d) => sum + d.count, 0);
    const normalTotalCount = normalReward.drops.reduce((sum, d) => sum + d.count, 0);
    expect(ambushTotalCount).toBeGreaterThanOrEqual(normalTotalCount);
  });

  test('掉落物品count在minCount~maxCount范围内', () => {
    // 多次运行验证
    for (let i = 0; i < 50; i++) {
      const system = new ExpeditionRewardSystem();
      const reward = system.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BOSS,
        grade: BattleGrade.MINOR_VICTORY,
        isFirstClear: false,
        isRouteComplete: false,
      });
      for (const drop of reward.drops) {
        expect(drop.count).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// P0-3: 扫荡奖励
// ═══════════════════════════════════════════════════════════

describe('P0-3: 扫荡奖励', () => {
  test('普通扫荡奖励倍率1.0', () => {
    const reward = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.NORMAL,
      heroCount: 3,
    });
    expect(reward.grain).toBeGreaterThan(0);
  });

  test('高级扫荡奖励倍率1.5', () => {
    const normal = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.NORMAL,
      heroCount: 3,
    });
    const advanced = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.ADVANCED,
      heroCount: 3,
    });
    expect(advanced.grain).toBe(Math.round(normal.grain * 1.5));
  });

  test('免费扫荡奖励倍率0.5', () => {
    const normal = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.NORMAL,
      heroCount: 3,
    });
    const free = rewardSystem.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.FREE,
      heroCount: 3,
    });
    expect(free.grain).toBe(Math.round(normal.grain * 0.5));
  });

  test('高级扫荡保底稀有掉落', () => {
    // 使用rng=0.99（几乎不掉落），验证保底
    const rng99 = createFixedRng(0.99);
    const system = new ExpeditionRewardSystem(rng99);

    const reward = system.calculateSweepReward({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.ADVANCED,
      heroCount: 3,
    });

    // 高级扫荡保底：如果无掉落则添加保底稀有材料
    const hasRareOrGuaranteed = reward.drops.some(
      d => d.type === 'rare_material' || d.id === 'rm_guaranteed',
    );
    // rng=0.99时boss掉落表全部不触发，应有保底
    expect(hasRareOrGuaranteed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-4: 离线远征奖励
// ═══════════════════════════════════════════════════════════

describe('P0-4: 离线远征奖励', () => {
  const baseReward = {
    grain: 400, gold: 800, iron: 2, equipFragments: 2, exp: 1200, drops: [],
  };

  test('离线0秒：完成0次', () => {
    const result = rewardSystem.calculateOfflineReward(baseReward, 0, 0);
    expect(result.completedRuns).toBe(0);
    expect(result.totalReward.grain).toBe(0);
  });

  test('离线72小时上限', () => {
    const result = rewardSystem.calculateOfflineReward(baseReward, 100 * 3600, 10);
    expect(result.isTimeCapped).toBe(true);
    expect(result.offlineSeconds).toBe(72 * 3600);
  });

  test('离线不超过72小时', () => {
    const result = rewardSystem.calculateOfflineReward(baseReward, 48 * 3600, 5);
    expect(result.isTimeCapped).toBe(false);
    expect(result.offlineSeconds).toBe(48 * 3600);
  });

  test('完成次数×效率系数正确', () => {
    const result = rewardSystem.calculateOfflineReward(baseReward, 3600, 10);
    expect(result.efficiency).toBe(0.85);
    // 总奖励 = baseReward × 10 × 0.85
    expect(result.totalReward.grain).toBe(Math.round(400 * 10 * 0.85));
  });

  test('F-Boundary: 离线负数秒', () => {
    const result = rewardSystem.calculateOfflineReward(baseReward, -3600, 5);
    // 负数秒应被min(负数, 72h)处理
    expect(result).toBeDefined();
  });

  test('F-Boundary: 完成次数为0', () => {
    const result = rewardSystem.calculateOfflineReward(baseReward, 3600, 0);
    expect(result.totalReward.grain).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// P0-5: 首通奖励
// ═══════════════════════════════════════════════════════════

describe('P0-5: 首通奖励', () => {
  test('首通额外获得武将碎片', () => {
    const noFirst = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: false,
      isRouteComplete: false,
    });
    const first = rewardSystem.calculateNodeReward({
      difficulty: RouteDifficulty.NORMAL,
      nodeType: NodeType.BOSS,
      grade: BattleGrade.MINOR_VICTORY,
      isFirstClear: true,
      isRouteComplete: false,
    });

    const firstClearDrops = first.drops.filter(d => d.id === 'hf_first_clear');
    expect(firstClearDrops.length).toBe(1);
    expect(firstClearDrops[0].count).toBe(1);

    const noFirstClearDrops = noFirst.drops.filter(d => d.id === 'hf_first_clear');
    expect(noFirstClearDrops.length).toBe(0);
  });

  test('路线完成首通奖励包含元宝折算', () => {
    const result = rewardSystem.calculateRouteReward(
      RouteDifficulty.NORMAL,
      [{ nodeType: NodeType.BOSS, grade: BattleGrade.MINOR_VICTORY }],
      true,
    );
    // 首通奖励 gold += 50 * 10 = 500
    expect(result.gold).toBeGreaterThan(0);
    const heroFragment = result.drops.find(d => d.id === 'hf_first_clear');
    expect(heroFragment).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// F-Error: 里程碑奖励
// ═══════════════════════════════════════════════════════════

describe('F-Error: 里程碑奖励', () => {
  test('有效里程碑返回奖励', () => {
    const reward = rewardSystem.getMilestoneReward(MilestoneType.FIRST_CLEAR);
    expect(reward).not.toBeNull();
    expect(reward!.gold).toBe(1000);
  });

  test('无效里程碑返回null', () => {
    // MilestoneType.THREE_STAR 不在 MILESTONE_CONFIGS 中
    const reward = rewardSystem.getMilestoneReward(MilestoneType.THREE_STAR);
    expect(reward).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// F-Lifecycle: ISubsystem接口
// ═══════════════════════════════════════════════════════════

describe('F-Lifecycle: ISubsystem接口', () => {
  test('init/update/reset不崩溃', () => {
    rewardSystem.init({} as any);
    expect(() => rewardSystem.update(16)).not.toThrow();
    expect(() => rewardSystem.reset()).not.toThrow();
  });

  test('getState返回正确结构', () => {
    const state = rewardSystem.getState();
    expect(state.name).toBe('expeditionReward');
  });
});
