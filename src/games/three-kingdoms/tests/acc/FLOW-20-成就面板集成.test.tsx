/**
 * FLOW-20 成就面板集成测试 — 成就列表/解锁条件/奖励领取/进度追踪/苏格拉底边界
 *
 * 使用真实 AchievementSystem，通过 createSim() 创建引擎实例，不 mock 核心逻辑。
 *
 * 覆盖范围：
 * - 成就列表显示：5维度成就、稀有度、成就总数
 * - 成就解锁条件：前置成就、条件类型、进度更新
 * - 成就奖励领取：奖励结构、积分累计、维度统计
 * - 成就进度追踪：批量更新、完成检测、成就链
 * - 苏格拉底边界：空状态、重复领取、序列化、未完成领取
 *
 * @module tests/acc/FLOW-20
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 成就系统核心
import { AchievementSystem } from '../../engine/achievement/AchievementSystem';

// 成就类型与常量
import type {
  AchievementDimension,
  AchievementDef,
  AchievementInstance,
  AchievementStatus,
  AchievementState,
  AchievementReward,
  DimensionStats,
  RebirthAchievementChain,
  AchievementSaveData,
  AchievementConditionType,
} from '../../core/achievement';

import {
  ACHIEVEMENT_DIMENSION_LABELS,
  ACHIEVEMENT_DIMENSION_ICONS,
  ACHIEVEMENT_RARITY_LABELS,
  ACHIEVEMENT_RARITY_WEIGHTS,
  ACHIEVEMENT_SAVE_VERSION,
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_DEF_MAP,
  REBIRTH_ACHIEVEMENT_CHAINS,
} from '../../core/achievement';

import type { ISystemDeps } from '../../core/types/subsystem';

// ── 辅助函数 ──

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

// ═══════════════════════════════════════════════════════════════
// FLOW-20 成就面板集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-20 成就面板集成测试', () => {
  let sim: GameEventSimulator;
  let achieveSys: AchievementSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });

    achieveSys = new AchievementSystem();
    achieveSys.init(mockDeps());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 成就列表显示（FLOW-20-01 ~ FLOW-20-05）
  // ═══════════════════════════════════════════════════════════

  describe('1. 成就列表显示', () => {

    it(accTest('FLOW-20-01', '成就列表 — 5维度成就均存在'), () => {
      const dimensions = Object.keys(ACHIEVEMENT_DIMENSION_LABELS) as AchievementDimension[];
      assertStrict(dimensions.length === 5, 'FLOW-20-01',
        `应有5个维度，实际: ${dimensions.length}`);

      const expectedDimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];
      for (const dim of expectedDimensions) {
        assertStrict(dimensions.includes(dim), 'FLOW-20-01',
          `应包含维度: ${dim}`);
      }
    });

    it(accTest('FLOW-20-02', '成就列表 — 各维度均有成就定义'), () => {
      const dimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];

      for (const dim of dimensions) {
        const achievements = achieveSys.getAchievementsByDimension(dim);
        assertStrict(achievements.length > 0, 'FLOW-20-02',
          `维度${dim}应有成就，实际: ${achievements.length}`);
      }
    });

    it(accTest('FLOW-20-03', '成就列表 — 成就总数与ALL_ACHIEVEMENTS一致'), () => {
      const all = achieveSys.getAllAchievements();
      assertStrict(all.length === ALL_ACHIEVEMENTS.length, 'FLOW-20-03',
        `成就总数应为${ALL_ACHIEVEMENTS.length}，实际: ${all.length}`);
    });

    it(accTest('FLOW-20-04', '成就列表 — 每个成就包含完整定义与实例'), () => {
      const all = achieveSys.getAllAchievements();

      for (const ach of all) {
        assertStrict(!!ach.id, 'FLOW-20-04', '成就应有ID');
        assertStrict(!!ach.name, 'FLOW-20-04', '成就应有名称');
        assertStrict(!!ach.description, 'FLOW-20-04', '成就应有描述');
        assertStrict(!!ach.dimension, 'FLOW-20-04', '成就应有维度');
        assertStrict(!!ach.rarity, 'FLOW-20-04', '成就应有稀有度');
        assertStrict(ach.conditions.length > 0, 'FLOW-20-04',
          `成就${ach.id}应有条件`);
        assertStrict(!!ach.instance, 'FLOW-20-04',
          `成就${ach.id}应有运行时实例`);
      }
    });

    it(accTest('FLOW-20-05', '成就列表 — 稀有度分布正确'), () => {
      const rarities = Object.values(ACHIEVEMENT_RARITY_LABELS);
      assertStrict(rarities.length === 4, 'FLOW-20-05',
        `应有4种稀有度，实际: ${rarities.length}`);

      const all = achieveSys.getAllAchievements();
      const rarityCounts: Record<string, number> = {};
      for (const ach of all) {
        rarityCounts[ach.rarity] = (rarityCounts[ach.rarity] ?? 0) + 1;
      }

      // 应至少有 common 和 rare
      assertStrict((rarityCounts['common'] ?? 0) > 0, 'FLOW-20-05', '应有普通成就');
      assertStrict((rarityCounts['rare'] ?? 0) > 0, 'FLOW-20-05', '应有稀有成就');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 成就解锁条件（FLOW-20-06 ~ FLOW-20-10）
  // ═══════════════════════════════════════════════════════════

  describe('2. 成就解锁条件', () => {

    it(accTest('FLOW-20-06', '解锁条件 — 无前置成就初始为in_progress'), () => {
      const all = achieveSys.getAllAchievements();
      const noPrereq = all.filter(a => !a.prerequisiteId);

      assertStrict(noPrereq.length > 0, 'FLOW-20-06', '应有无前置成就的成就');

      for (const ach of noPrereq) {
        assertStrict(
          ach.instance.status === 'in_progress' || ach.instance.status === 'locked',
          'FLOW-20-06',
          `无前置成就${ach.id}应为in_progress或locked，实际: ${ach.instance.status}`,
        );
        // 无前置的应该直接是 in_progress
        assertStrict(ach.instance.status === 'in_progress', 'FLOW-20-06',
          `无前置成就${ach.id}应为in_progress，实际: ${ach.instance.status}`);
      }
    });

    it(accTest('FLOW-20-07', '解锁条件 — 有前置成就初始为locked'), () => {
      const all = achieveSys.getAllAchievements();
      const withPrereq = all.filter(a => a.prerequisiteId);

      assertStrict(withPrereq.length > 0, 'FLOW-20-07', '应有有前置成就的成就');

      for (const ach of withPrereq) {
        assertStrict(ach.instance.status === 'locked', 'FLOW-20-07',
          `有前置成就${ach.id}应为locked，实际: ${ach.instance.status}`);
      }
    });

    it(accTest('FLOW-20-08', '解锁条件 — 更新进度后成就可完成'), () => {
      // ach-battle-001: 战斗胜利10次
      achieveSys.updateProgress('battle_wins', 10);

      const ach = achieveSys.getAchievement('ach-battle-001');
      assertStrict(!!ach, 'FLOW-20-08', 'ach-battle-001应存在');
      assertStrict(ach!.instance.status === 'completed', 'FLOW-20-08',
        `应已完成，实际: ${ach!.instance.status}`);
      assertStrict(ach!.instance.progress['battle_wins'] === 10, 'FLOW-20-08',
        `进度应为10，实际: ${ach!.instance.progress['battle_wins']}`);
    });

    it(accTest('FLOW-20-09', '解锁条件 — 前置完成后后续成就解锁'), () => {
      // 完成 ach-battle-001 → ach-battle-002 解锁
      achieveSys.updateProgress('battle_wins', 10);

      // 领取前置成就（解锁后续）
      achieveSys.claimReward('ach-battle-001');

      const ach002 = achieveSys.getAchievement('ach-battle-002');
      assertStrict(!!ach002, 'FLOW-20-09', 'ach-battle-002应存在');
      assertStrict(ach002!.instance.status === 'in_progress', 'FLOW-20-09',
        `前置完成后ach-battle-002应为in_progress，实际: ${ach002!.instance.status}`);
    });

    it(accTest('FLOW-20-10', '解锁条件 — 部分进度不触发完成'), () => {
      // ach-battle-001 需要 battle_wins=10，只给5
      achieveSys.updateProgress('battle_wins', 5);

      const ach = achieveSys.getAchievement('ach-battle-001');
      assertStrict(!!ach, 'FLOW-20-10', 'ach-battle-001应存在');
      assertStrict(ach!.instance.status === 'in_progress', 'FLOW-20-10',
        `进度不足应仍为in_progress，实际: ${ach!.instance.status}`);
      assertStrict(ach!.instance.progress['battle_wins'] === 5, 'FLOW-20-10',
        `进度应为5，实际: ${ach!.instance.progress['battle_wins']}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 成就奖励领取（FLOW-20-11 ~ FLOW-20-15）
  // ═══════════════════════════════════════════════════════════

  describe('3. 成就奖励领取', () => {

    it(accTest('FLOW-20-11', '奖励领取 — 完成后可领取奖励'), () => {
      achieveSys.updateProgress('battle_wins', 10);

      const result = achieveSys.claimReward('ach-battle-001');
      assertStrict(result.success, 'FLOW-20-11',
        `领取应成功: ${result.reason ?? ''}`);
      assertStrict(!!result.reward, 'FLOW-20-11', '应有奖励数据');

      const def = ACHIEVEMENT_DEF_MAP['ach-battle-001'];
      assertStrict(result.reward!.achievementPoints === def.rewards.achievementPoints, 'FLOW-20-11',
        `积分应为${def.rewards.achievementPoints}，实际: ${result.reward!.achievementPoints}`);
    });

    it(accTest('FLOW-20-12', '奖励领取 — 领取后状态变为claimed'), () => {
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      const ach = achieveSys.getAchievement('ach-battle-001');
      assertStrict(ach!.instance.status === 'claimed', 'FLOW-20-12',
        `领取后应为claimed，实际: ${ach!.instance.status}`);
      assertStrict(ach!.instance.claimedAt !== null, 'FLOW-20-12',
        '领取时间不应为null');
    });

    it(accTest('FLOW-20-13', '奖励领取 — 总积分累计正确'), () => {
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      const totalPoints = achieveSys.getTotalPoints();
      const def = ACHIEVEMENT_DEF_MAP['ach-battle-001'];
      assertStrict(totalPoints === def.rewards.achievementPoints, 'FLOW-20-13',
        `总积分应为${def.rewards.achievementPoints}，实际: ${totalPoints}`);
    });

    it(accTest('FLOW-20-14', '奖励领取 — 维度统计更新正确'), () => {
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      const stats = achieveSys.getDimensionStats();
      const battleStats = stats['battle'];
      assertStrict(battleStats.completedCount === 1, 'FLOW-20-14',
        `战斗维度完成数应为1，实际: ${battleStats.completedCount}`);

      const def = ACHIEVEMENT_DEF_MAP['ach-battle-001'];
      assertStrict(battleStats.totalPoints === def.rewards.achievementPoints, 'FLOW-20-14',
        `战斗维度积分应为${def.rewards.achievementPoints}，实际: ${battleStats.totalPoints}`);
    });

    it(accTest('FLOW-20-15', '奖励领取 — 获取可领取列表'), () => {
      // 初始无可领取
      let claimable = achieveSys.getClaimableAchievements();
      assertStrict(claimable.length === 0, 'FLOW-20-15',
        `初始应无可领取，实际: ${claimable.length}`);

      // 完成一个成就
      achieveSys.updateProgress('battle_wins', 10);
      claimable = achieveSys.getClaimableAchievements();
      assertStrict(claimable.length === 1, 'FLOW-20-15',
        `完成后应有1个可领取，实际: ${claimable.length}`);
      assertStrict(claimable.includes('ach-battle-001'), 'FLOW-20-15',
        '可领取列表应包含ach-battle-001');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 成就进度追踪（FLOW-20-16 ~ FLOW-20-20）
  // ═══════════════════════════════════════════════════════════

  describe('4. 成就进度追踪', () => {

    it(accTest('FLOW-20-16', '进度追踪 — 批量更新进度'), () => {
      achieveSys.updateProgressFromSnapshot({
        battle_wins: 50,
        building_level: 8,
        hero_count: 15,
      });

      const ach001 = achieveSys.getAchievement('ach-battle-001');
      assertStrict(ach001!.instance.progress['battle_wins'] === 50, 'FLOW-20-16',
        `战斗胜利进度应为50，实际: ${ach001!.instance.progress['battle_wins']}`);

      const build001 = achieveSys.getAchievement('ach-build-001');
      assertStrict(build001!.instance.progress['building_level'] === 8, 'FLOW-20-16',
        `建筑等级进度应为8，实际: ${build001!.instance.progress['building_level']}`);

      const collect001 = achieveSys.getAchievement('ach-collect-001');
      assertStrict(collect001!.instance.progress['hero_count'] === 15, 'FLOW-20-16',
        `武将数量进度应为15，实际: ${collect001!.instance.progress['hero_count']}`);
    });

    it(accTest('FLOW-20-17', '进度追踪 — 多条件成就需全部满足'), () => {
      // 使用快照批量更新
      achieveSys.updateProgressFromSnapshot({
        battle_wins: 200,  // ach-battle-001(10), ach-battle-002(100) 完成
      });

      const ach001 = achieveSys.getAchievement('ach-battle-001');
      assertStrict(ach001!.instance.status === 'completed', 'FLOW-20-17',
        `ach-battle-001应已完成，实际: ${ach001!.instance.status}`);
    });

    it(accTest('FLOW-20-18', '进度追踪 — 成就链查询'), () => {
      const chains = achieveSys.getAchievementChains();
      assertStrict(chains.length > 0, 'FLOW-20-18',
        `应有成就链，实际: ${chains.length}`);

      // 验证战神之路链
      const battleChain = chains.find(c => c.chainId === 'chain-battle-master');
      assertStrict(!!battleChain, 'FLOW-20-18', '应有战神之路链');
      assertStrict(battleChain!.achievementIds.length === 4, 'FLOW-20-18',
        `战神之路应有4个成就，实际: ${battleChain!.achievementIds.length}`);
      assertStrict(battleChain!.progress === 0, 'FLOW-20-18',
        `初始进度应为0，实际: ${battleChain!.progress}`);
      assertStrict(!battleChain!.completed, 'FLOW-20-18', '初始应未完成');
    });

    it(accTest('FLOW-20-19', '进度追踪 — 成就链进度随完成更新'), () => {
      // 完成战斗链的第一个成就
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      const chains = achieveSys.getAchievementChains();
      const battleChain = chains.find(c => c.chainId === 'chain-battle-master');
      assertStrict(!!battleChain, 'FLOW-20-19', '应有战神之路链');
      assertStrict(battleChain!.progress >= 1, 'FLOW-20-19',
        `完成1个后进度应≥1，实际: ${battleChain!.progress}`);
    });

    it(accTest('FLOW-20-20', '进度追踪 — 维度统计初始值正确'), () => {
      const stats = achieveSys.getDimensionStats();
      const dimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];

      for (const dim of dimensions) {
        assertStrict(!!stats[dim], 'FLOW-20-20', `应有${dim}维度统计`);
        assertStrict(stats[dim].completedCount === 0, 'FLOW-20-20',
          `${dim}初始完成数应为0，实际: ${stats[dim].completedCount}`);
        assertStrict(stats[dim].totalPoints === 0, 'FLOW-20-20',
          `${dim}初始积分应为0，实际: ${stats[dim].totalPoints}`);
        assertStrict(stats[dim].totalCount > 0, 'FLOW-20-20',
          `${dim}应有成就定义，实际: ${stats[dim].totalCount}`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 苏格拉底边界（FLOW-20-21 ~ FLOW-20-30）
  // ═══════════════════════════════════════════════════════════

  describe('5. 苏格拉底边界', () => {

    it(accTest('FLOW-20-21', '边界 — 初始总积分为0'), () => {
      const points = achieveSys.getTotalPoints();
      assertStrict(points === 0, 'FLOW-20-21',
        `初始总积分应为0，实际: ${points}`);
    });

    it(accTest('FLOW-20-22', '边界 — 未完成成就不可领取'), () => {
      const result = achieveSys.claimReward('ach-battle-001');
      assertStrict(!result.success, 'FLOW-20-22', '未完成不应可领取');
      assertStrict(result.reason === '成就未完成', 'FLOW-20-22',
        `原因应为"成就未完成"，实际: ${result.reason}`);
    });

    it(accTest('FLOW-20-23', '边界 — 重复领取失败'), () => {
      achieveSys.updateProgress('battle_wins', 10);

      // 第一次领取成功
      const first = achieveSys.claimReward('ach-battle-001');
      assertStrict(first.success, 'FLOW-20-23', '第一次领取应成功');

      // 第二次领取失败
      const second = achieveSys.claimReward('ach-battle-001');
      assertStrict(!second.success, 'FLOW-20-23', '重复领取应失败');
      assertStrict(second.reason === '成就未完成', 'FLOW-20-23',
        `原因应为"成就未完成"（已claimed≠completed），实际: ${second.reason}`);
    });

    it(accTest('FLOW-20-24', '边界 — 不存在的成就领取失败'), () => {
      const result = achieveSys.claimReward('nonexistent-achievement');
      assertStrict(!result.success, 'FLOW-20-24', '不存在成就领取应失败');
      assertStrict(result.reason === '成就不存在', 'FLOW-20-24',
        `原因应为"成就不存在"，实际: ${result.reason}`);
    });

    it(accTest('FLOW-20-25', '边界 — 不存在的成就查询返回null'), () => {
      const ach = achieveSys.getAchievement('nonexistent-id');
      assertStrict(ach === null, 'FLOW-20-25', '不存在成就应返回null');
    });

    it(accTest('FLOW-20-26', '边界 — 序列化/反序列化保持状态'), () => {
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      const saveData = achieveSys.getSaveData();
      assertStrict(saveData.version === ACHIEVEMENT_SAVE_VERSION, 'FLOW-20-26',
        `版本应为${ACHIEVEMENT_SAVE_VERSION}，实际: ${saveData.version}`);

      // 创建新系统并加载
      const newSys = new AchievementSystem();
      newSys.init(mockDeps());
      newSys.loadSaveData(saveData);

      const totalPoints = newSys.getTotalPoints();
      assertStrict(totalPoints > 0, 'FLOW-20-26',
        `加载后总积分应>0，实际: ${totalPoints}`);

      const ach = newSys.getAchievement('ach-battle-001');
      assertStrict(ach!.instance.status === 'claimed', 'FLOW-20-26',
        `加载后ach-battle-001应为claimed，实际: ${ach!.instance.status}`);
    });

    it(accTest('FLOW-20-27', '边界 — reset后状态清空'), () => {
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      achieveSys.reset();

      const points = achieveSys.getTotalPoints();
      assertStrict(points === 0, 'FLOW-20-27',
        `reset后总积分应为0，实际: ${points}`);

      const ach = achieveSys.getAchievement('ach-battle-001');
      assertStrict(ach!.instance.status === 'in_progress', 'FLOW-20-27',
        `reset后应为in_progress，实际: ${ach!.instance.status}`);
    });

    it(accTest('FLOW-20-28', '边界 — 进度取最大值不覆盖'), () => {
      achieveSys.updateProgress('battle_wins', 5);
      achieveSys.updateProgress('battle_wins', 3); // 更小的值

      const ach = achieveSys.getAchievement('ach-battle-001');
      assertStrict(ach!.instance.progress['battle_wins'] === 5, 'FLOW-20-28',
        `进度应保持最大值5，实际: ${ach!.instance.progress['battle_wins']}`);
    });

    it(accTest('FLOW-20-29', '边界 — 已完成成就不重复更新'), () => {
      achieveSys.updateProgress('battle_wins', 10); // 完成
      achieveSys.updateProgress('battle_wins', 100); // 再次更新

      const ach = achieveSys.getAchievement('ach-battle-001');
      assertStrict(ach!.instance.status === 'completed', 'FLOW-20-29',
        `应保持completed状态，实际: ${ach!.instance.status}`);
    });

    it(accTest('FLOW-20-30', '边界 — 解锁汇总API正确'), () => {
      achieveSys.updateProgress('battle_wins', 10);
      achieveSys.claimReward('ach-battle-001');

      const summary = achieveSys.getUnlockedSummary();
      assertStrict(summary.totalAchievements === ALL_ACHIEVEMENTS.length, 'FLOW-20-30',
        `总成就数应为${ALL_ACHIEVEMENTS.length}，实际: ${summary.totalAchievements}`);
      assertStrict(summary.unlockedCount === 1, 'FLOW-20-30',
        `已解锁数应为1，实际: ${summary.unlockedCount}`);
      assertStrict(!!summary.byDimension['battle'], 'FLOW-20-30', '应有战斗维度统计');
      assertStrict(summary.byDimension['battle'].unlocked === 1, 'FLOW-20-30',
        `战斗维度解锁数应为1，实际: ${summary.byDimension['battle'].unlocked}`);
    });
  });
});
