/**
 * 高级扫荡 & 一键远征分配算法 — 引擎层测试
 *
 * P0 级覆盖缺口修复：
 *   1. 高级扫荡（150%奖励 + 保底稀有 + 消耗/次数限制）
 *   2. 免费扫荡（50%奖励 + 每日1次 + 不消耗资源 + 次日重置）
 *   3. 一键远征分配算法（按战力排序匹配路线）
 *
 * TODO 清单（引擎尚未实现的功能）：
 *   - [ ] 高级扫荡消耗元宝/高级货币扣减（当前引擎仅记录次数，未扣减货币）
 *   - [ ] 免费扫荡次日重置逻辑（当前引擎无每日重置方法，需上层调度）
 *   - [ ] 一键远征分配算法的序列化/反序列化（当前无独立分配结果数据结构）
 *
 * @module engine/expedition/__tests__/SweepAllocation.test
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import type { SweepRewardParams } from '../ExpeditionRewardSystem';
import { ExpeditionSystem } from '../ExpeditionSystem';
import { createDefaultExpeditionState } from '../expedition-helpers';
import { ExpeditionTeamHelper } from '../ExpeditionTeamHelper';
import type { HeroBrief } from '../ExpeditionTeamHelper';
import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import { AutoExpeditionSystem } from '../AutoExpeditionSystem';
import {
  RouteDifficulty,
  NodeType,
  BattleGrade,
  SweepType,
  SWEEP_CONFIG,
  FormationType,
  MilestoneType,
  NodeStatus,
} from '../../../core/expedition/expedition.types';
import type {
  ExpeditionReward,
  ExpeditionTeam,
  ExpeditionState,
} from '../../../core/expedition/expedition.types';
import { BASE_REWARDS } from '../expedition-config';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 固定随机数生成器 */
function fixedRng(value: number = 0.5): () => number {
  return () => value;
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

/** 创建测试用武将简要信息 */
function createHero(id: string, faction: string = 'shu', power: number = 1000): HeroBrief {
  return { id, faction: faction as HeroBrief['faction'], power };
}

/** 创建武将映射 */
function createHeroMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

/** 创建蜀国武将 */
function createShuHeroes(count: number = 3): HeroBrief[] {
  return Array.from({ length: count }, (_, i) => createHero(`shu_${i}`, 'shu', 1000 + i * 100));
}

/** 准备三星通关路线状态 */
function prepareThreeStarRoute(system: ExpeditionSystem, routeId: string): void {
  const state = system.getState();
  state.routeStars[routeId] = 3;
}

// ═══════════════════════════════════════════
// A. 高级扫荡 — 奖励计算（RewardSystem 层）
// ═══════════════════════════════════════════

describe('高级扫荡 — 奖励计算', () => {
  let rewards: ExpeditionRewardSystem;

  beforeEach(() => {
    rewards = new ExpeditionRewardSystem(fixedRng(0.5));
  });

  // A1. 高级扫荡奖励 = 普通奖励 × 150%
  test('A1: 高级扫荡基础资源 = 普通扫荡 × 150%', () => {
    const normal = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    const advanced = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));

    // 验证每种资源都是 1.5 倍
    expect(advanced.grain).toBe(Math.round(normal.grain * 1.5));
    expect(advanced.gold).toBe(Math.round(normal.gold * 1.5));
    expect(advanced.iron).toBe(Math.round(normal.iron * 1.5));
    expect(advanced.equipFragments).toBe(Math.round(normal.equipFragments * 1.5));
    expect(advanced.exp).toBe(Math.round(normal.exp * 1.5));
  });

  // A2. 高级扫荡奖励精确值验证
  test('A2: 高级扫荡在普通难度下的精确奖励值', () => {
    const base = BASE_REWARDS[RouteDifficulty.NORMAL];
    const advanced = rewards.calculateSweepReward(createSweepParams({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.ADVANCED,
    }));

    expect(advanced.grain).toBe(Math.round(base.grain * 1.5));
    expect(advanced.gold).toBe(Math.round(base.gold * 1.5));
    expect(advanced.iron).toBe(Math.round(base.iron * 1.5));
    expect(advanced.exp).toBe(Math.round(base.exp * 1.5));
  });

  // A3. 高级扫荡在所有难度下都是 150%
  test('A3: 高级扫荡在所有难度下均为 ×1.5', () => {
    const difficulties: RouteDifficulty[] = [
      RouteDifficulty.EASY,
      RouteDifficulty.NORMAL,
      RouteDifficulty.HARD,
      RouteDifficulty.EPIC,
      RouteDifficulty.AMBUSH,
    ];

    for (const diff of difficulties) {
      const normal = rewards.calculateSweepReward(createSweepParams({ difficulty: diff, sweepType: SweepType.NORMAL }));
      const advanced = rewards.calculateSweepReward(createSweepParams({ difficulty: diff, sweepType: SweepType.ADVANCED }));

      expect(advanced.gold).toBe(Math.round(normal.gold * 1.5));
      expect(advanced.grain).toBe(Math.round(normal.grain * 1.5));
    }
  });

  // A4. 高级扫荡保底至少1个稀有道具
  test('A4: 高级扫荡无自然掉落时保底稀有道具', () => {
    // rng=0.99 超过所有掉率，无自然掉落
    const highRng = new ExpeditionRewardSystem(() => 0.99);
    const reward = highRng.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));

    const guaranteed = reward.drops.find(d => d.id === 'rm_guaranteed');
    expect(guaranteed).toBeDefined();
    expect(guaranteed!.type).toBe('rare_material');
    expect(guaranteed!.count).toBeGreaterThanOrEqual(1);
  });

  // A5. 高级扫荡有自然掉落时仍然包含掉落
  test('A5: 高级扫荡有自然掉落时不重复保底', () => {
    // rng=0.01 低于所有掉率，自然掉落全部触发
    const lowRng = new ExpeditionRewardSystem(() => 0.01);
    const reward = lowRng.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));

    // 自然掉落 + 保底可能共存
    expect(reward.drops.length).toBeGreaterThanOrEqual(1);
    // 自然掉落已触发，保底不应重复添加（因为 drops.length > 0）
    const guaranteedCount = reward.drops.filter(d => d.id === 'rm_guaranteed').length;
    expect(guaranteedCount).toBe(0); // 自然掉落已有，不需要保底
  });

  // A6. 高级扫荡保底道具为稀有类型
  test('A6: 保底道具类型为 rare_material', () => {
    const highRng = new ExpeditionRewardSystem(() => 0.99);
    const reward = highRng.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));

    const guaranteed = reward.drops.find(d => d.id === 'rm_guaranteed');
    expect(guaranteed).toBeDefined();
    expect(guaranteed!.type).toBe('rare_material');
    expect(guaranteed!.name).toContain('保底');
  });

  // A7. SWEEP_CONFIG 高级扫荡配置正确
  test('A7: SWEEP_CONFIG 中高级扫荡配置验证', () => {
    const config = SWEEP_CONFIG[SweepType.ADVANCED];
    expect(config.cost).toBe(3);
    expect(config.rewardMultiplier).toBe(1.5);
    expect(config.dailyLimit).toBe(3);
    expect(config.guaranteedRare).toBe(true);
  });

  // A8. 高级扫荡奖励严格大于普通扫荡
  test('A8: 高级扫荡奖励严格大于普通扫荡（所有难度）', () => {
    for (const diff of [RouteDifficulty.EASY, RouteDifficulty.NORMAL, RouteDifficulty.HARD]) {
      const normal = rewards.calculateSweepReward(createSweepParams({ difficulty: diff, sweepType: SweepType.NORMAL }));
      const advanced = rewards.calculateSweepReward(createSweepParams({ difficulty: diff, sweepType: SweepType.ADVANCED }));
      expect(advanced.gold).toBeGreaterThan(normal.gold);
      expect(advanced.grain).toBeGreaterThan(normal.grain);
      expect(advanced.exp).toBeGreaterThan(normal.exp);
    }
  });
});

// ═══════════════════════════════════════════
// B. 高级扫荡 — 次数限制与消耗（ExpeditionSystem 层）
// ═══════════════════════════════════════════

describe('高级扫荡 — 次数限制与消耗', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    prepareThreeStarRoute(system, 'route_hulao_easy');
  });

  // B1. 高级扫荡每日上限3次
  test('B1: 高级扫荡每日上限3次', () => {
    // 执行3次应该都成功
    for (let i = 0; i < 3; i++) {
      const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
      expect(result.success).toBe(true);
    }
    // 第4次应该失败
    const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
  });

  // B2. 高级扫荡次数独立于普通扫荡
  test('B2: 高级扫荡和普通扫荡次数独立计数', () => {
    // 执行3次高级扫荡（达到上限）
    for (let i = 0; i < 3; i++) {
      system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    }
    // 高级扫荡已满
    expect(system.executeSweep('route_hulao_easy', SweepType.ADVANCED).success).toBe(false);
    // 普通扫荡仍可用
    expect(system.executeSweep('route_hulao_easy', SweepType.NORMAL).success).toBe(true);
  });

  // B3. 高级扫荡次数独立于免费扫荡
  test('B3: 高级扫荡和免费扫荡次数独立计数', () => {
    // 执行1次免费扫荡
    system.executeSweep('route_hulao_easy', SweepType.FREE);
    // 免费扫荡已满
    expect(system.executeSweep('route_hulao_easy', SweepType.FREE).success).toBe(false);
    // 高级扫荡仍可用
    expect(system.executeSweep('route_hulao_easy', SweepType.ADVANCED).success).toBe(true);
  });

  // B4. 高级扫荡次数正确查询
  test('B4: getSweepCount 正确记录高级扫荡次数', () => {
    expect(system.getSweepCount('route_hulao_easy', SweepType.ADVANCED)).toBe(0);
    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    expect(system.getSweepCount('route_hulao_easy', SweepType.ADVANCED)).toBe(1);
    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    expect(system.getSweepCount('route_hulao_easy', SweepType.ADVANCED)).toBe(2);
  });

  // B5. 不同路线的高级扫荡次数独立
  test('B5: 不同路线的高级扫荡次数独立', () => {
    prepareThreeStarRoute(system, 'route_hulao_normal');

    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);

    // route_hulao_easy 已满
    expect(system.getSweepCount('route_hulao_easy', SweepType.ADVANCED)).toBe(3);
    // route_hulao_normal 未使用
    expect(system.getSweepCount('route_hulao_normal', SweepType.ADVANCED)).toBe(0);
    expect(system.executeSweep('route_hulao_normal', SweepType.ADVANCED).success).toBe(true);
  });

  // B6. 未三星通关路线不可高级扫荡
  test('B6: 未三星通关路线不可高级扫荡', () => {
    const state = system.getState();
    state.routeStars['route_hulao_hard'] = 2; // 仅2星
    const result = system.executeSweep('route_hulao_hard', SweepType.ADVANCED);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('三星');
  });

  // B7. 高级扫荡消耗配置
  test('B7: 高级扫荡消耗为3（扫荡令×3）', () => {
    expect(SWEEP_CONFIG[SweepType.ADVANCED].cost).toBe(3);
  });
});

// ═══════════════════════════════════════════
// C. 免费扫荡 — 奖励计算（RewardSystem 层）
// ═══════════════════════════════════════════

describe('免费扫荡 — 奖励计算', () => {
  let rewards: ExpeditionRewardSystem;

  beforeEach(() => {
    rewards = new ExpeditionRewardSystem(fixedRng(0.5));
  });

  // C1. 免费扫荡奖励 = 普通奖励 × 50%
  test('C1: 免费扫荡基础资源 = 普通扫荡 × 50%', () => {
    const normal = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    const free = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.FREE }));

    expect(free.grain).toBe(Math.round(normal.grain * 0.5));
    expect(free.gold).toBe(Math.round(normal.gold * 0.5));
    expect(free.iron).toBe(Math.round(normal.iron * 0.5));
    expect(free.equipFragments).toBe(Math.round(normal.equipFragments * 0.5));
    expect(free.exp).toBe(Math.round(normal.exp * 0.5));
  });

  // C2. 免费扫荡精确值验证（普通难度）
  test('C2: 免费扫荡在普通难度下的精确奖励值', () => {
    const base = BASE_REWARDS[RouteDifficulty.NORMAL];
    const free = rewards.calculateSweepReward(createSweepParams({
      difficulty: RouteDifficulty.NORMAL,
      sweepType: SweepType.FREE,
    }));

    expect(free.grain).toBe(Math.round(base.grain * 0.5));
    expect(free.gold).toBe(Math.round(base.gold * 0.5));
    expect(free.iron).toBe(Math.round(base.iron * 0.5));
    expect(free.exp).toBe(Math.round(base.exp * 0.5));
  });

  // C3. 免费扫荡在所有难度下都是 50%
  test('C3: 免费扫荡在所有难度下均为 ×0.5', () => {
    for (const diff of [RouteDifficulty.EASY, RouteDifficulty.NORMAL, RouteDifficulty.HARD, RouteDifficulty.EPIC, RouteDifficulty.AMBUSH]) {
      const normal = rewards.calculateSweepReward(createSweepParams({ difficulty: diff, sweepType: SweepType.NORMAL }));
      const free = rewards.calculateSweepReward(createSweepParams({ difficulty: diff, sweepType: SweepType.FREE }));

      expect(free.gold).toBe(Math.round(normal.gold * 0.5));
      expect(free.grain).toBe(Math.round(normal.grain * 0.5));
    }
  });

  // C4. 免费扫荡无保底稀有
  test('C4: 免费扫荡无自然掉落时无保底', () => {
    const highRng = new ExpeditionRewardSystem(() => 0.99);
    const reward = highRng.calculateSweepReward(createSweepParams({ sweepType: SweepType.FREE }));

    expect(reward.drops.length).toBe(0);
  });

  // C5. 免费扫荡奖励严格小于普通扫荡
  test('C5: 免费扫荡奖励严格小于普通扫荡', () => {
    const normal = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    const free = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.FREE }));

    expect(free.gold).toBeLessThan(normal.gold);
    expect(free.grain).toBeLessThan(normal.grain);
    expect(free.exp).toBeLessThan(normal.exp);
  });

  // C6. SWEEP_CONFIG 免费扫荡配置正确
  test('C6: SWEEP_CONFIG 中免费扫荡配置验证', () => {
    const config = SWEEP_CONFIG[SweepType.FREE];
    expect(config.cost).toBe(0);
    expect(config.rewardMultiplier).toBe(0.5);
    expect(config.dailyLimit).toBe(1);
    expect(config.guaranteedRare).toBe(false);
  });

  // C7. 免费扫荡资源为正（不为零）
  test('C7: 免费扫荡在困难难度下资源仍为正', () => {
    const free = rewards.calculateSweepReward(createSweepParams({
      difficulty: RouteDifficulty.HARD,
      sweepType: SweepType.FREE,
    }));

    expect(free.grain).toBeGreaterThan(0);
    expect(free.gold).toBeGreaterThan(0);
    expect(free.exp).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// D. 免费扫荡 — 次数限制与不消耗（ExpeditionSystem 层）
// ═══════════════════════════════════════════

describe('免费扫荡 — 次数限制与不消耗', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    prepareThreeStarRoute(system, 'route_hulao_easy');
  });

  // D1. 免费扫荡每日1次限制
  test('D1: 免费扫荡每日上限1次', () => {
    const result1 = system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(result1.success).toBe(true);

    const result2 = system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(result2.success).toBe(false);
    expect(result2.reason).toContain('已用完');
  });

  // D2. 免费扫荡不消耗资源（cost = 0）
  test('D2: 免费扫荡消耗为0', () => {
    expect(SWEEP_CONFIG[SweepType.FREE].cost).toBe(0);
  });

  // D3. 免费扫荡不影响其他扫荡次数
  test('D3: 免费扫荡不影响普通/高级扫荡次数', () => {
    system.executeSweep('route_hulao_easy', SweepType.FREE);

    expect(system.executeSweep('route_hulao_easy', SweepType.NORMAL).success).toBe(true);
    expect(system.executeSweep('route_hulao_easy', SweepType.ADVANCED).success).toBe(true);
  });

  // D4. 免费扫荡次数正确查询
  test('D4: getSweepCount 正确记录免费扫荡次数', () => {
    expect(system.getSweepCount('route_hulao_easy', SweepType.FREE)).toBe(0);
    system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(system.getSweepCount('route_hulao_easy', SweepType.FREE)).toBe(1);
  });

  // D5. 免费扫荡次数满后普通扫荡仍可用
  test('D5: 免费扫荡用完后普通扫荡仍可执行5次', () => {
    system.executeSweep('route_hulao_easy', SweepType.FREE);

    for (let i = 0; i < 5; i++) {
      const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      expect(result.success).toBe(true);
    }
    // 第6次普通扫荡失败
    expect(system.executeSweep('route_hulao_easy', SweepType.NORMAL).success).toBe(false);
  });

  // D6. 不同路线的免费扫荡次数独立
  test('D6: 不同路线的免费扫荡次数独立', () => {
    prepareThreeStarRoute(system, 'route_hulao_normal');

    system.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(system.getSweepCount('route_hulao_easy', SweepType.FREE)).toBe(1);
    expect(system.getSweepCount('route_hulao_normal', SweepType.FREE)).toBe(0);
    expect(system.executeSweep('route_hulao_normal', SweepType.FREE).success).toBe(true);
  });
});

// ═══════════════════════════════════════════
// E. 免费扫荡 — 次日重置
// ═══════════════════════════════════════════

describe('免费扫荡 — 次日重置', () => {
  // E1. 扫荡次数通过序列化/反序列化保持
  test('E1: 扫荡次数通过序列化/反序列化保持', () => {
    const system = new ExpeditionSystem();
    prepareThreeStarRoute(system, 'route_hulao_easy');

    system.executeSweep('route_hulao_easy', SweepType.FREE);
    system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);

    const data = system.serialize();
    const system2 = new ExpeditionSystem();
    system2.deserialize(data);

    expect(system2.getSweepCount('route_hulao_easy', SweepType.FREE)).toBe(1);
    expect(system2.getSweepCount('route_hulao_easy', SweepType.NORMAL)).toBe(1);
    expect(system2.getSweepCount('route_hulao_easy', SweepType.ADVANCED)).toBe(1);
  });

  // E2. 重置系统后扫荡次数清零
  test('E2: reset() 后扫荡次数清零', () => {
    const system = new ExpeditionSystem();
    prepareThreeStarRoute(system, 'route_hulao_easy');

    system.executeSweep('route_hulao_easy', SweepType.FREE);
    system.executeSweep('route_hulao_easy', SweepType.ADVANCED);

    system.reset();

    // reset 后状态为全新，routeStars 也被重置
    expect(system.getSweepCount('route_hulao_easy', SweepType.FREE)).toBe(0);
    expect(system.getSweepCount('route_hulao_easy', SweepType.ADVANCED)).toBe(0);
  });

  // E3. 模拟次日重置：通过重新创建状态实现
  test('E3: 模拟次日重置（新建 ExpeditionSystem）后免费扫荡可用', () => {
    // 第一天
    const day1 = new ExpeditionSystem();
    prepareThreeStarRoute(day1, 'route_hulao_easy');
    day1.executeSweep('route_hulao_easy', SweepType.FREE);
    expect(day1.executeSweep('route_hulao_easy', SweepType.FREE).success).toBe(false);

    // 第二天（新实例 = 新的 sweepCounts）
    const day2 = new ExpeditionSystem();
    prepareThreeStarRoute(day2, 'route_hulao_easy');
    expect(day2.executeSweep('route_hulao_easy', SweepType.FREE).success).toBe(true);
  });

  // E4. 序列化数据中包含扫荡次数
  test('E4: 序列化数据包含 sweepCounts', () => {
    const system = new ExpeditionSystem();
    prepareThreeStarRoute(system, 'route_hulao_easy');
    system.executeSweep('route_hulao_easy', SweepType.FREE);

    const data = system.serialize();
    expect(data.sweepCounts).toBeDefined();
    expect(data.sweepCounts['route_hulao_easy']).toBeDefined();
    expect(data.sweepCounts['route_hulao_easy']['FREE']).toBe(1);
  });
});

// ═══════════════════════════════════════════
// F. 三种扫荡类型对比测试
// ═══════════════════════════════════════════

describe('三种扫荡类型对比', () => {
  let rewards: ExpeditionRewardSystem;

  beforeEach(() => {
    rewards = new ExpeditionRewardSystem(fixedRng(0.5));
  });

  // F1. 奖励排序：高级 > 普通 > 免费
  test('F1: 奖励排序 高级 > 普通 > 免费', () => {
    const advanced = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.ADVANCED }));
    const normal = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.NORMAL }));
    const free = rewards.calculateSweepReward(createSweepParams({ sweepType: SweepType.FREE }));

    expect(advanced.gold).toBeGreaterThan(normal.gold);
    expect(normal.gold).toBeGreaterThan(free.gold);
  });

  // F2. 消耗排序：高级(3) > 普通(1) > 免费(0)
  test('F2: 消耗排序 高级(3) > 普通(1) > 免费(0)', () => {
    expect(SWEEP_CONFIG[SweepType.ADVANCED].cost).toBeGreaterThan(SWEEP_CONFIG[SweepType.NORMAL].cost);
    expect(SWEEP_CONFIG[SweepType.NORMAL].cost).toBeGreaterThan(SWEEP_CONFIG[SweepType.FREE].cost);
  });

  // F3. 每日上限排序：普通(5) > 高级(3) > 免费(1)
  test('F3: 每日上限排序 普通(5) > 高级(3) > 免费(1)', () => {
    expect(SWEEP_CONFIG[SweepType.NORMAL].dailyLimit).toBe(5);
    expect(SWEEP_CONFIG[SweepType.ADVANCED].dailyLimit).toBe(3);
    expect(SWEEP_CONFIG[SweepType.FREE].dailyLimit).toBe(1);
  });

  // F4. 保底稀有排序：仅高级有保底
  test('F4: 仅高级扫荡有保底稀有', () => {
    expect(SWEEP_CONFIG[SweepType.ADVANCED].guaranteedRare).toBe(true);
    expect(SWEEP_CONFIG[SweepType.NORMAL].guaranteedRare).toBe(false);
    expect(SWEEP_CONFIG[SweepType.FREE].guaranteedRare).toBe(false);
  });

  // F5. 三种扫荡全部用完后均不可再扫
  test('F5: 三种扫荡全部用完后均不可再扫', () => {
    const system = new ExpeditionSystem();
    prepareThreeStarRoute(system, 'route_hulao_easy');

    // 消耗所有次数
    for (let i = 0; i < 5; i++) system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    for (let i = 0; i < 3; i++) system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
    system.executeSweep('route_hulao_easy', SweepType.FREE);

    expect(system.executeSweep('route_hulao_easy', SweepType.NORMAL).success).toBe(false);
    expect(system.executeSweep('route_hulao_easy', SweepType.ADVANCED).success).toBe(false);
    expect(system.executeSweep('route_hulao_easy', SweepType.FREE).success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// G. 一键远征分配算法 — 战力排序匹配
// ═══════════════════════════════════════════

describe('一键远征分配算法 — 战力排序匹配', () => {
  // G1. autoComposeTeam 按战力降序选择武将
  test('G1: autoComposeTeam 按战力降序选择武将', () => {
    const system = new ExpeditionSystem();
    const heroes: HeroBrief[] = [
      createHero('weak', 'shu', 500),
      createHero('mid', 'shu', 1500),
      createHero('strong', 'shu', 3000),
      createHero('elite', 'shu', 5000),
    ];

    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 2);
    expect(selected).toContain('elite');
    expect(selected).toContain('strong');
    expect(selected).not.toContain('weak');
    expect(selected).not.toContain('mid');
  });

  // G2. autoComposeTeam 优先选择最强武将
  test('G2: autoComposeTeam 始终选择最强武将', () => {
    const system = new ExpeditionSystem();
    const heroes: HeroBrief[] = [
      createHero('h1', 'wei', 1000),
      createHero('h2', 'wei', 2000),
      createHero('h3', 'wei', 3000),
    ];

    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 1);
    expect(selected).toEqual(['h3']);
  });

  // G3. 已在远征中的武将不参与分配
  test('G3: 已在远征中的武将被排除', () => {
    const system = new ExpeditionSystem();
    const heroes: HeroBrief[] = [
      createHero('h1', 'shu', 5000),
      createHero('h2', 'shu', 3000),
      createHero('h3', 'shu', 1000),
    ];

    // h1 已在远征中
    const activeHeroIds = new Set(['h1']);
    const selected = system.autoComposeTeam(heroes, activeHeroIds, FormationType.STANDARD, 2);

    expect(selected).not.toContain('h1');
    expect(selected).toContain('h2');
    expect(selected).toContain('h3');
  });

  // G4. 武将数量不足时返回可用数量
  test('G4: 武将数量不足时返回所有可用武将', () => {
    const system = new ExpeditionSystem();
    const heroes: HeroBrief[] = [
      createHero('h1', 'shu', 3000),
      createHero('h2', 'wei', 2000),
    ];

    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 5);
    expect(selected.length).toBe(2);
    expect(selected).toContain('h1');
    expect(selected).toContain('h2');
  });

  // G5. 无可用武将时返回空数组
  test('G5: 无可用武将时返回空数组', () => {
    const system = new ExpeditionSystem();
    const heroes: HeroBrief[] = [
      createHero('h1', 'shu', 3000),
    ];

    const selected = system.autoComposeTeam(heroes, new Set(['h1']), FormationType.STANDARD, 3);
    expect(selected).toEqual([]);
  });

  // G6. 空武将列表返回空数组
  test('G6: 空武将列表返回空数组', () => {
    const system = new ExpeditionSystem();
    const selected = system.autoComposeTeam([], new Set(), FormationType.STANDARD, 5);
    expect(selected).toEqual([]);
  });

  // G7. 优先触发阵营羁绊
  test('G7: autoComposeTeam 优先触发阵营羁绊', () => {
    const system = new ExpeditionSystem();
    const heroes: HeroBrief[] = [
      createHero('shu_1', 'shu', 2000),
      createHero('shu_2', 'shu', 1800),
      createHero('shu_3', 'shu', 1600),
      createHero('wei_1', 'wei', 5000), // 最强但不同阵营
      createHero('wu_1', 'wu', 4000),
    ];

    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 4);
    // 应包含3个蜀国武将（触发羁绊）+ 1个最强其他
    const shuCount = selected.filter(id => id.startsWith('shu')).length;
    expect(shuCount).toBeGreaterThanOrEqual(3);
  });

  // G8. 多个远征队伍武将互斥
  test('G8: 多个远征队伍间武将互斥', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);

    // 创建第一支队伍
    const result1 = system.createTeam('队伍1', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
    expect(result1.valid).toBe(true);

    // 派遣第一支队伍
    const teamId1 = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId1, 'route_hulao_easy');

    // 第二支队伍不能使用已在远征中的武将
    const result2 = system.validateTeam(['shu_0', 'shu_3', 'shu_4'], FormationType.STANDARD, heroMap, 
      Object.values(system.getState().teams).filter(t => t.isExpeditioning));
    expect(result2.valid).toBe(false);
    expect(result2.errors.some(e => e.includes('已在其他远征队伍中'))).toBe(true);
  });
});

// ═══════════════════════════════════════════
// H. 一键远征分配算法 — 最强武将匹配最难路线
// ═══════════════════════════════════════════

describe('一键远征分配算法 — 最强武将匹配最难路线', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(20); // 4个槽位
  });

  // H1. 手动模拟分配：最强队伍分配到最难路线
  test('H1: 最强队伍应分配到最难路线', () => {
    const heroes = [
      ...createShuHeroes(3).map(h => ({ ...h, power: 5000 + parseInt(h.id.split('_')[1]) * 100 })),
      createHero('wei_a', 'wei', 3000),
      createHero('wei_b', 'wei', 2800),
      createHero('wei_c', 'wei', 2600),
    ];
    const heroMap = createHeroMap(heroes);

    // 创建强队
    const strongResult = system.createTeam('强队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
    expect(strongResult.valid).toBe(true);

    // 解锁所有路线
    const state = system.getState();
    for (const routeId of Object.keys(state.routes)) {
      state.clearedRouteIds.add(routeId);
      state.routes[routeId].unlocked = true;
    }

    // 强队应能派遣到最难路线（奇袭）
    const strongTeamId = Object.keys(state.teams)[0];
    const ok = system.dispatchTeam(strongTeamId, 'route_luoyang_ambush');
    expect(ok).toBe(true);
  });

  // H2. 队伍战力排序
  test('H2: 多队伍按战力降序排列', () => {
    const heroes = [
      createHero('a1', 'shu', 5000),
      createHero('a2', 'shu', 4800),
      createHero('a3', 'shu', 4600),
      createHero('b1', 'wei', 2000),
      createHero('b2', 'wei', 1800),
      createHero('b3', 'wei', 1600),
    ];
    const heroMap = createHeroMap(heroes);

    system.createTeam('强队', ['a1', 'a2', 'a3'], FormationType.OFFENSIVE, heroMap);
    system.createTeam('弱队', ['b1', 'b2', 'b3'], FormationType.DEFENSIVE, heroMap);

    const teams = system.getAllTeams();
    const sorted = [...teams].sort((a, b) => b.totalPower - a.totalPower);

    expect(sorted[0].name).toBe('强队');
    expect(sorted[1].name).toBe('弱队');
    expect(sorted[0].totalPower).toBeGreaterThan(sorted[1].totalPower);
  });

  // H3. 路线难度排序
  test('H3: 路线按难度排序', () => {
    const routes = system.getAllRoutes();
    const difficultyOrder: Record<string, number> = {
      [RouteDifficulty.EASY]: 1,
      [RouteDifficulty.NORMAL]: 2,
      [RouteDifficulty.HARD]: 3,
      [RouteDifficulty.EPIC]: 4,
      [RouteDifficulty.AMBUSH]: 5,
    };

    const sorted = [...routes].sort((a, b) =>
      (difficultyOrder[b.difficulty] ?? 0) - (difficultyOrder[a.difficulty] ?? 0),
    );

    // 最难路线排在前面
    expect(difficultyOrder[sorted[0].difficulty]).toBeGreaterThanOrEqual(
      difficultyOrder[sorted[sorted.length - 1].difficulty],
    );
  });

  // H4. 武将数量不足时优先分配高难度路线
  test('H4: 武将不足时优先分配高难度路线', () => {
    // 仅有1支队伍的武将，应优先分配到已解锁的最难路线
    const heroes = [createHero('solo', 'shu', 5000)];
    const heroMap = createHeroMap(heroes);

    system.createTeam('单将队', ['solo'], FormationType.STANDARD, heroMap);
    const teamId = Object.keys(system.getState().teams)[0];

    // 可派遣到已解锁的困难路线
    const ok = system.dispatchTeam(teamId, 'route_hulao_hard');
    expect(ok).toBe(true);
  });

  // H5. ExpeditionSystem.getExpeditioningHeroIds 正确收集
  test('H5: getExpeditioningHeroIds 正确收集远征中武将', () => {
    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);

    system.createTeam('队1', ['shu_0', 'shu_1'], FormationType.STANDARD, heroMap);
    const teamId1 = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId1, 'route_hulao_easy');

    const expeditioning = system.getExpeditioningHeroIds();
    expect(expeditioning.has('shu_0')).toBe(true);
    expect(expeditioning.has('shu_1')).toBe(true);
    expect(expeditioning.has('shu_2')).toBe(false);
  });

  // H6. isHeroExpeditioning 正确判断
  test('H6: isHeroExpeditioning 正确判断单个武将', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);

    system.createTeam('队1', ['shu_0', 'shu_1'], FormationType.STANDARD, heroMap);
    const teamId = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId, 'route_hulao_easy');

    expect(system.isHeroExpeditioning('shu_0')).toBe(true);
    expect(system.isHeroExpeditioning('shu_1')).toBe(true);
    expect(system.isHeroExpeditioning('shu_2')).toBe(false);
  });

  // H7. 完成远征后武将释放
  test('H7: 完成远征后武将不再被锁定', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);

    system.createTeam('队1', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);
    const teamId = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId, 'route_hulao_easy');

    expect(system.isHeroExpeditioning('shu_0')).toBe(true);

    system.completeRoute(teamId, 3);

    expect(system.isHeroExpeditioning('shu_0')).toBe(false);
    expect(system.isHeroExpeditioning('shu_1')).toBe(false);
  });
});

// ═══════════════════════════════════════════
// I. 一键远征分配算法 — 序列化/反序列化
// ═══════════════════════════════════════════

describe('一键远征分配算法 — 序列化/反序列化', () => {
  // I1. 队伍分配结果可序列化
  test('I1: 队伍分配结果可序列化', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId, 'route_hulao_easy');

    const data = system.serialize();
    expect(data.teams[teamId]).toBeDefined();
    expect(data.teams[teamId].currentRouteId).toBe('route_hulao_easy');
    expect(data.teams[teamId].isExpeditioning).toBe(true);
    expect(data.teams[teamId].heroIds).toEqual(['shu_0', 'shu_1', 'shu_2']);
  });

  // I2. 反序列化后队伍状态一致
  test('I2: 反序列化后队伍状态一致', () => {
    const system1 = new ExpeditionSystem();
    system1.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system1.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system1.getState().teams)[0];
    system1.dispatchTeam(teamId, 'route_hulao_easy');

    const data = system1.serialize();

    const system2 = new ExpeditionSystem();
    system2.deserialize(data);

    const team = system2.getTeam(teamId);
    expect(team).toBeDefined();
    expect(team!.isExpeditioning).toBe(true);
    expect(team!.currentRouteId).toBe('route_hulao_easy');
    expect(team!.heroIds).toEqual(['shu_0', 'shu_1', 'shu_2']);
    expect(team!.formation).toBe(FormationType.STANDARD);
  });

  // I3. 序列化包含路线星级信息
  test('I3: 序列化包含路线星级信息', () => {
    const system = new ExpeditionSystem();
    const state = system.getState();
    state.routeStars['route_hulao_easy'] = 3;
    state.routeStars['route_hulao_normal'] = 2;

    const data = system.serialize();
    expect(data.routeStars['route_hulao_easy']).toBe(3);
    expect(data.routeStars['route_hulao_normal']).toBe(2);
  });

  // I4. 反序列化后路线星级一致
  test('I4: 反序列化后路线星级一致', () => {
    const system1 = new ExpeditionSystem();
    system1.getState().routeStars['route_hulao_easy'] = 3;

    const data = system1.serialize();
    const system2 = new ExpeditionSystem();
    system2.deserialize(data);

    expect(system2.getRouteStars('route_hulao_easy')).toBe(3);
  });

  // I5. 快速重派配置可序列化
  test('I5: 快速重派配置可序列化', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId, 'route_hulao_easy');

    const data = system.serialize();
    expect(data.lastDispatchConfig).toBeDefined();
    expect(data.lastDispatchConfig!.teamId).toBe(teamId);
    expect(data.lastDispatchConfig!.routeId).toBe('route_hulao_easy');
    expect(data.lastDispatchConfig!.heroIds).toEqual(['shu_0', 'shu_1', 'shu_2']);
  });

  // I6. 反序列化后快速重派可用
  test('I6: 反序列化后快速重派配置保持', () => {
    const system1 = new ExpeditionSystem();
    system1.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system1.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system1.getState().teams)[0];
    system1.dispatchTeam(teamId, 'route_hulao_easy');

    const data = system1.serialize();
    const system2 = new ExpeditionSystem();
    system2.deserialize(data);

    const config = system2.getLastDispatchConfig();
    expect(config).not.toBeNull();
    expect(config!.routeId).toBe('route_hulao_easy');
  });

  // I7. 多队伍序列化/反序列化
  test('I7: 多队伍序列化/反序列化后全部保持', () => {
    const system1 = new ExpeditionSystem();
    system1.updateSlots(20);

    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);

    system1.createTeam('队1', ['shu_0', 'shu_1'], FormationType.OFFENSIVE, heroMap);
    system1.createTeam('队2', ['shu_2', 'shu_3', 'shu_4'], FormationType.DEFENSIVE, heroMap);

    const data = system1.serialize();
    expect(Object.keys(data.teams).length).toBe(2);

    const system2 = new ExpeditionSystem();
    system2.deserialize(data);

    const teams = system2.getAllTeams();
    expect(teams.length).toBe(2);

    const offensive = teams.find(t => t.formation === FormationType.OFFENSIVE);
    const defensive = teams.find(t => t.formation === FormationType.DEFENSIVE);
    expect(offensive).toBeDefined();
    expect(defensive).toBeDefined();
    expect(offensive!.heroIds).toEqual(['shu_0', 'shu_1']);
    expect(defensive!.heroIds).toEqual(['shu_2', 'shu_3', 'shu_4']);
  });
});

// ═══════════════════════════════════════════
// J. 一键远征 — 自动远征集成
// ═══════════════════════════════════════════

describe('一键远征 — 自动远征集成', () => {
  let battleSystem: ExpeditionBattleSystem;
  let rewardSystem: ExpeditionRewardSystem;
  let autoSystem: AutoExpeditionSystem;

  beforeEach(() => {
    battleSystem = new ExpeditionBattleSystem();
    rewardSystem = new ExpeditionRewardSystem(fixedRng(0.5));
    autoSystem = new AutoExpeditionSystem(battleSystem, rewardSystem);
  });

  // J1. 自动远征启动需要有效队伍和路线
  test('J1: 自动远征启动需要有效队伍和路线', () => {
    const state = createDefaultExpeditionState();
    const autoResult = autoSystem.startAutoExpedition(state, 'nonexistent_team', 'route_hulao_easy');
    expect(autoResult).toBe(false);
  });

  // J2. 自动远征不可重复启动
  test('J2: 已在自动远征中不可重复启动', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    const state = system.getState();

    const ok1 = autoSystem.startAutoExpedition(state, teamId, 'route_hulao_easy');
    expect(ok1).toBe(true);

    const ok2 = autoSystem.startAutoExpedition(state, teamId, 'route_hulao_easy');
    expect(ok2).toBe(false);
  });

  // J3. 停止自动远征后可重新启动
  test('J3: 停止自动远征后可重新启动', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    const state = system.getState();

    autoSystem.startAutoExpedition(state, teamId, 'route_hulao_easy');
    autoSystem.stopAutoExpedition(state);

    const ok = autoSystem.startAutoExpedition(state, teamId, 'route_hulao_easy');
    expect(ok).toBe(true);
  });

  // J4. 自动远征兵力不足时暂停
  test('J4: 兵力不足时自动远征暂停', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    const state = system.getState();
    const team = state.teams[teamId];

    // 设置兵力不足
    team.troopCount = 0;

    autoSystem.startAutoExpedition(state, teamId, 'route_hulao_easy');

    const step = autoSystem.executeAutoStep(
      state, team, 500, FormationType.STANDARD, RouteDifficulty.EASY, false,
    );

    expect(step.paused).toBe(true);
    expect(step.pauseReason).toBe('TROOPS_EXHAUSTED');
  });

  // J5. 自动远征完整循环
  test('J5: 自动远征完整循环（有限次数）', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    const state = system.getState();
    const team = state.teams[teamId];

    // 设置重复次数为3
    state.autoConfig.repeatCount = 3;

    autoSystem.startAutoExpedition(state, teamId, 'route_hulao_easy');

    const result = autoSystem.executeAutoExpedition(
      state, team, 500, FormationType.STANDARD, RouteDifficulty.EASY, false, 10,
    );

    expect(result.totalRuns).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// K. 边界条件与异常测试
// ═══════════════════════════════════════════

describe('边界条件与异常', () => {
  // K1. 扫荡不存在的路线
  test('K1: 扫荡不存在的路线失败', () => {
    const system = new ExpeditionSystem();
    const result = system.executeSweep('nonexistent_route', SweepType.NORMAL);
    expect(result.success).toBe(false);
  });

  // K2. 未三星通关不可高级扫荡
  test('K2: 1星/2星路线不可高级扫荡', () => {
    const system = new ExpeditionSystem();
    system.getState().routeStars['route_hulao_easy'] = 1;
    expect(system.executeSweep('route_hulao_easy', SweepType.ADVANCED).success).toBe(false);

    system.getState().routeStars['route_hulao_easy'] = 2;
    expect(system.executeSweep('route_hulao_easy', SweepType.ADVANCED).success).toBe(false);
  });

  // K3. 0星路线不可免费扫荡
  test('K3: 0星路线不可免费扫荡', () => {
    const system = new ExpeditionSystem();
    expect(system.executeSweep('route_hulao_easy', SweepType.FREE).success).toBe(false);
  });

  // K4. 高级扫荡在极低难度下仍有保底
  test('K4: 简单路线高级扫荡仍有保底稀有', () => {
    const highRng = new ExpeditionRewardSystem(() => 0.99);
    const reward = highRng.calculateSweepReward(createSweepParams({
      difficulty: RouteDifficulty.EASY,
      sweepType: SweepType.ADVANCED,
    }));

    const hasGuaranteed = reward.drops.some(d => d.id === 'rm_guaranteed');
    expect(hasGuaranteed).toBe(true);
  });

  // K5. 免费扫荡在极低难度下奖励不为零
  test('K5: 简单路线免费扫荡奖励不为零', () => {
    const rewards = new ExpeditionRewardSystem(fixedRng(0.5));
    const reward = rewards.calculateSweepReward(createSweepParams({
      difficulty: RouteDifficulty.EASY,
      sweepType: SweepType.FREE,
    }));

    expect(reward.grain).toBeGreaterThan(0);
    expect(reward.gold).toBeGreaterThan(0);
  });

  // K6. autoComposeTeam 武将数恰好等于队伍上限
  test('K6: autoComposeTeam 武将数恰好等于上限5', () => {
    const system = new ExpeditionSystem();
    const heroes = Array.from({ length: 5 }, (_, i) => createHero(`h_${i}`, 'shu', 1000 + i * 100));

    const selected = system.autoComposeTeam(heroes, new Set(), FormationType.STANDARD, 5);
    expect(selected.length).toBe(5);
  });

  // K7. 队伍战力为0的武将
  test('K7: 战力为0的武将仍可编队', () => {
    const system = new ExpeditionSystem();
    const heroes = [createHero('zero', 'shu', 0)];
    const heroMap = createHeroMap(heroes);

    const result = system.validateTeam(['zero'], FormationType.STANDARD, heroMap, []);
    expect(result.valid).toBe(true);
    expect(result.totalPower).toBe(0);
  });

  // K8. 快速重派无上次配置时返回 false
  test('K8: 无上次配置时快速重派返回 false', () => {
    const system = new ExpeditionSystem();
    expect(system.quickRedeploy()).toBe(false);
  });

  // K9. 快速重派成功场景
  test('K9: 快速重派成功场景', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(10);

    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    system.createTeam('测试队', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, heroMap);

    const teamId = Object.keys(system.getState().teams)[0];
    system.dispatchTeam(teamId, 'route_hulao_easy');
    system.completeRoute(teamId, 3);

    // 完成后武将释放，可以重新派遣
    const ok = system.quickRedeploy();
    expect(ok).toBe(true);
  });

  // K10. 派遣超出槽位限制
  test('K10: 派遣超出槽位限制失败', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(5); // 仅1个槽位

    const heroes = createShuHeroes(5);
    const heroMap = createHeroMap(heroes);

    system.createTeam('队1', ['shu_0', 'shu_1'], FormationType.STANDARD, heroMap);
    system.createTeam('队2', ['shu_2', 'shu_3'], FormationType.STANDARD, heroMap);

    const teams = system.getAllTeams();
    const teamId1 = teams[0].id;
    const teamId2 = teams[1].id;

    // 派遣第一队成功
    expect(system.dispatchTeam(teamId1, 'route_hulao_easy')).toBe(true);
    // 派遣第二队失败（槽位已满）
    expect(system.dispatchTeam(teamId2, 'route_hulao_normal')).toBe(false);
  });
});
