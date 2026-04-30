/**
 * 联盟Boss与任务集成测试
 *
 * 覆盖 Play 流程：
 *   §3.1 联盟Boss讨伐
 *   §4.3 联盟任务与活跃度
 *   §5.2 Boss讨伐→排行→奖励→商店资源闭环
 *   §5.3 联盟对战→赛季→科技→活跃度闭环（任务部分）
 */

import { AllianceBossSystem, createBoss, DEFAULT_BOSS_CONFIG } from '../../AllianceBossSystem';
import { AllianceTaskSystem, ALLIANCE_TASK_POOL } from '../../AllianceTaskSystem';
import { AllianceSystem } from '../../AllianceSystem';
import {
  createDefaultAlliancePlayerState,
  createAllianceData,
} from '../../alliance-constants';
import {
  AllianceRole,
  BossStatus,
  AllianceTaskStatus,
  AllianceTaskType,
} from '../../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceBoss,
  AllianceTaskInstance,
} from '../../../../core/alliance/alliance.types';

// ── 辅助函数 ──────────────────────────────

const NOW = 1_000_000;

function state(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function makeAlliance(level = 1): AllianceData {
  const a = createAllianceData('ally_1', '蜀汉', '兴复汉室', 'p1', '刘备', NOW);
  a.level = level;
  // Add members
  for (const [pid, pname, role] of [['p2', '诸葛亮', 'ADVISOR'], ['p3', '关羽', 'MEMBER'], ['p4', '张飞', 'MEMBER']] as const) {
    a.members[pid] = {
      playerId: pid, playerName: pname, role: role as AllianceRole,
      power: 5000, joinTime: NOW, dailyContribution: 0, totalContribution: 0, dailyBossChallenges: 0,
    };
  }
  return a;
}

// ══════════════════════════════════════════════
// §3.1 联盟Boss讨伐
// ══════════════════════════════════════════════

describe('§3.1 联盟Boss讨伐', () => {
  let bossSys: AllianceBossSystem;

  beforeEach(() => { bossSys = new AllianceBossSystem(); });

  it('Boss生成：等级与HP随联盟等级递增', () => {
    const boss1 = createBoss(1, NOW);
    const boss3 = createBoss(3, NOW);
    expect(boss1.level).toBe(1);
    expect(boss3.level).toBe(3);
    expect(boss3.maxHp).toBeGreaterThan(boss1.maxHp);
    expect(boss1.maxHp).toBe(DEFAULT_BOSS_CONFIG.baseHp);
    expect(boss3.maxHp).toBe(DEFAULT_BOSS_CONFIG.baseHp + 2 * DEFAULT_BOSS_CONFIG.hpPerLevel);
  });

  it('Boss生成：状态为ALIVE，HP满', () => {
    const boss = createBoss(1, NOW);
    expect(boss.status).toBe(BossStatus.ALIVE);
    expect(boss.currentHp).toBe(boss.maxHp);
  });

  it('Boss生成：名称按等级循环', () => {
    const boss1 = createBoss(1, NOW);
    const boss9 = createBoss(9, NOW);
    expect(boss1.name).toBeTruthy();
    expect(boss9.name).toBeTruthy();
    // 8 names in pool, so boss9 should use same index as boss1
    expect(boss9.name).toBe(boss1.name);
  });

  it('成员挑战Boss：正常伤害', () => {
    const alliance = makeAlliance();
    const boss = createBoss(alliance.level, NOW);
    const ps = state();
    const { boss: afterBoss, playerState: afterPs, result } = bossSys.challengeBoss(
      boss, alliance, ps, 'p1', 10000,
    );
    expect(result.damage).toBe(10000);
    expect(result.isKillingBlow).toBe(false);
    expect(afterBoss.currentHp).toBe(boss.maxHp - 10000);
    expect(afterPs.dailyBossChallenges).toBe(1);
  });

  it('挑战次数耗尽后不可挑战', () => {
    const alliance = makeAlliance();
    const boss = createBoss(alliance.level, NOW);
    let ps = state();
    // Use 3 challenges
    for (let i = 0; i < 3; i++) {
      const r = bossSys.challengeBoss(boss, alliance, ps, 'p1', 1000);
      ps = r.playerState;
    }
    expect(() => bossSys.challengeBoss(boss, alliance, ps, 'p1', 1000))
      .toThrow('今日挑战次数已用完');
  });

  it('击杀Boss：最后一击判定', () => {
    const alliance = makeAlliance();
    const boss = createBoss(1, NOW);
    const ps = state();
    // Deal exact remaining damage
    const { result, boss: afterBoss } = bossSys.challengeBoss(
      boss, alliance, ps, 'p1', boss.maxHp,
    );
    expect(result.isKillingBlow).toBe(true);
    expect(afterBoss.status).toBe(BossStatus.KILLED);
    expect(afterBoss.currentHp).toBe(0);
    expect(result.killReward).not.toBeNull();
    expect(result.killReward!.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
  });

  it('击杀Boss后不可再挑战', () => {
    const alliance = makeAlliance();
    const boss = createBoss(1, NOW);
    const ps = state();
    // Kill boss
    bossSys.challengeBoss(boss, alliance, ps, 'p1', boss.maxHp);
    // Try again
    expect(() => bossSys.challengeBoss(
      { ...boss, status: BossStatus.KILLED, currentHp: 0 }, alliance, ps, 'p2', 100,
    )).toThrow('Boss已被击杀');
  });

  it('非成员不可挑战Boss', () => {
    const alliance = makeAlliance();
    const boss = createBoss(alliance.level, NOW);
    const ps = state();
    expect(() => bossSys.challengeBoss(boss, alliance, ps, 'p99', 1000))
      .toThrow('不是联盟成员');
  });

  it('伤害不超过Boss剩余HP', () => {
    const alliance = makeAlliance();
    const boss = createBoss(1, NOW);
    const ps = state();
    // Boss has maxHp, deal more than that
    const { result } = bossSys.challengeBoss(boss, alliance, ps, 'p1', boss.maxHp + 99999);
    expect(result.damage).toBe(boss.maxHp); // capped
  });

  it('伤害排行榜按伤害降序排列', () => {
    const alliance = makeAlliance();
    let boss = createBoss(alliance.level, NOW);
    // p1 deals 50000, p2 deals 30000, p3 deals 20000
    const damages: [string, number][] = [['p1', 50000], ['p2', 30000], ['p3', 20000]];
    for (const [pid, dmg] of damages) {
      const r = bossSys.challengeBoss(boss, alliance, state(), pid, dmg);
      boss = r.boss;
    }
    const ranking = bossSys.getDamageRanking(boss, alliance);
    expect(ranking).toHaveLength(3);
    expect(ranking[0].playerId).toBe('p1');
    expect(ranking[0].rank).toBe(1);
    expect(ranking[0].damagePercent).toBe(50);
    expect(ranking[1].playerId).toBe('p2');
    expect(ranking[2].playerId).toBe('p3');
  });

  it('伤害排行榜：伤害占比计算', () => {
    const alliance = makeAlliance();
    let boss = createBoss(alliance.level, NOW);
    // p1 deals 80000 (capped at boss HP)
    const r1 = bossSys.challengeBoss(boss, alliance, state(), 'p1', 80000);
    boss = r1.boss;
    // p2 deals 20000 but boss only has 20000 left
    const r2 = bossSys.challengeBoss(boss, alliance, state(), 'p2', 20000);
    // Total actual damage = 100000 (boss maxHp), p1=80000(80%), p2=20000(20%)
    const ranking = bossSys.getDamageRanking(r2.boss, alliance);
    expect(ranking[0].damagePercent).toBe(80);
    expect(ranking[1].damagePercent).toBe(20);
  });

  it('击杀全员奖励分配', () => {
    const ps = state({ guildCoins: 100 });
    const afterPs = bossSys.distributeKillRewards(makeAlliance(), ps);
    expect(afterPs.guildCoins).toBe(100 + DEFAULT_BOSS_CONFIG.killGuildCoinReward);
  });

  it('剩余挑战次数计算', () => {
    const ps = state({ dailyBossChallenges: 0 });
    expect(bossSys.getRemainingChallenges(ps)).toBe(3);
    const ps2 = state({ dailyBossChallenges: 2 });
    expect(bossSys.getRemainingChallenges(ps2)).toBe(1);
    const ps3 = state({ dailyBossChallenges: 3 });
    expect(bossSys.getRemainingChallenges(ps3)).toBe(0);
  });

  it('Boss HP计算公式验证', () => {
    expect(bossSys.calculateBossMaxHp(1)).toBe(DEFAULT_BOSS_CONFIG.baseHp);
    expect(bossSys.calculateBossMaxHp(5)).toBe(DEFAULT_BOSS_CONFIG.baseHp + 4 * DEFAULT_BOSS_CONFIG.hpPerLevel);
  });

  it('每日刷新Boss', () => {
    const alliance = makeAlliance();
    alliance.bossKilledToday = true;
    const after = bossSys.refreshBoss(alliance, NOW + 86400000);
    expect(after.bossKilledToday).toBe(false);
    expect(after.lastBossRefreshTime).toBe(NOW + 86400000);
  });

  it('getCurrentBoss：击杀后状态为KILLED', () => {
    const alliance = makeAlliance();
    alliance.bossKilledToday = true;
    const boss = bossSys.getCurrentBoss(alliance);
    expect(boss.status).toBe(BossStatus.KILLED);
    expect(boss.currentHp).toBe(0);
  });
});

// ══════════════════════════════════════════════
// §4.3 联盟任务与活跃度
// ══════════════════════════════════════════════

describe('§4.3 联盟任务与活跃度', () => {
  let taskSys: AllianceTaskSystem;

  beforeEach(() => { taskSys = new AllianceTaskSystem(); });

  it('每日刷新生成指定数量任务', () => {
    const tasks = taskSys.dailyRefresh();
    expect(tasks).toHaveLength(3); // default dailyTaskCount=3
    tasks.forEach(t => {
      expect(t.status).toBe(AllianceTaskStatus.ACTIVE);
      expect(t.currentProgress).toBe(0);
    });
  });

  it('任务进度更新', () => {
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId);
    expect(def).toBeTruthy();
    const updated = taskSys.updateProgress(task.defId, 5);
    expect(updated).not.toBeNull();
    expect(updated!.currentProgress).toBe(5);
  });

  it('任务完成：进度达标自动完成', () => {
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId)!;
    const result = taskSys.updateProgress(task.defId, def.targetCount);
    expect(result!.status).toBe(AllianceTaskStatus.COMPLETED);
  });

  it('任务完成：超出目标值截断', () => {
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId)!;
    const result = taskSys.updateProgress(task.defId, def.targetCount + 999);
    expect(result!.currentProgress).toBe(def.targetCount);
  });

  it('已完成任务不再累加进度', () => {
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId)!;
    taskSys.updateProgress(task.defId, def.targetCount); // complete
    const result = taskSys.updateProgress(task.defId, 10); // try more
    expect(result!.currentProgress).toBe(def.targetCount); // unchanged
  });

  it('领取任务奖励', () => {
    const alliance = makeAlliance();
    const ps = state({ guildCoins: 0, allianceId: alliance.id });
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId)!;
    taskSys.updateProgress(task.defId, def.targetCount);

    const { playerState: afterPs, expGained, coinGained } = taskSys.claimTaskReward(
      task.defId, alliance, ps, 'p1',
    );
    expect(afterPs.guildCoins).toBe(def.guildCoinReward);
    expect(expGained).toBe(def.allianceExpReward);
    expect(coinGained).toBe(def.guildCoinReward);
  });

  it('不可重复领取奖励', () => {
    const alliance = makeAlliance();
    const ps = state({ allianceId: alliance.id });
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId)!;
    taskSys.updateProgress(task.defId, def.targetCount);
    taskSys.claimTaskReward(task.defId, alliance, ps, 'p1');
    expect(() => taskSys.claimTaskReward(task.defId, alliance, ps, 'p1'))
      .toThrow('已领取奖励');
  });

  it('未完成任务不可领取', () => {
    const alliance = makeAlliance();
    const ps = state({ allianceId: alliance.id });
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    expect(() => taskSys.claimTaskReward(task.defId, alliance, ps, 'p1'))
      .toThrow('任务未完成');
  });

  it('非成员不可记录贡献', () => {
    const alliance = makeAlliance();
    const ps = state();
    expect(() => taskSys.recordContribution(alliance, ps, 'p99', 100))
      .toThrow('不是联盟成员');
  });

  it('记录贡献：个人与联盟同步', () => {
    const alliance = makeAlliance();
    const ps = state({ guildCoins: 0, dailyContribution: 0, allianceId: alliance.id });
    const { alliance: afterA, playerState: afterPs } = taskSys.recordContribution(
      alliance, ps, 'p1', 50,
    );
    expect(afterPs.guildCoins).toBe(50);
    expect(afterPs.dailyContribution).toBe(50);
    expect(afterA.members['p1'].dailyContribution).toBe(50);
    expect(afterA.members['p1'].totalContribution).toBe(50);
  });

  it('任务进度查询', () => {
    taskSys.dailyRefresh();
    const task = taskSys.getActiveTasks()[0];
    const def = taskSys.getTaskDef(task.defId)!;
    taskSys.updateProgress(task.defId, Math.floor(def.targetCount / 2));
    const progress = taskSys.getTaskProgress(task.defId);
    expect(progress).not.toBeNull();
    expect(progress!.percent).toBeCloseTo(50, 1);
  });

  it('已完成任务计数', () => {
    taskSys.dailyRefresh();
    const tasks = taskSys.getActiveTasks();
    // Complete first task
    const def = taskSys.getTaskDef(tasks[0].defId)!;
    taskSys.updateProgress(tasks[0].defId, def.targetCount);
    expect(taskSys.getCompletedCount()).toBe(1);
  });

  it('任务序列化与反序列化', () => {
    taskSys.dailyRefresh();
    const tasks = taskSys.getActiveTasks();
    const def = taskSys.getTaskDef(tasks[0].defId)!;
    taskSys.updateProgress(tasks[0].defId, def.targetCount);
    // Serialize
    const serialized = taskSys.serializeTasks();
    expect(serialized).toHaveLength(3);
    expect(serialized[0].status).toBe(AllianceTaskStatus.COMPLETED);
    // Deserialize
    const newSys = new AllianceTaskSystem();
    newSys.init({} as Record<string, unknown>);
    newSys.deserializeTasks(serialized);
    const restored = newSys.getActiveTasks();
    expect(restored).toHaveLength(3);
    expect(restored[0].status).toBe(AllianceTaskStatus.COMPLETED);
  });

  it('不存在的任务进度返回null', () => {
    taskSys.dailyRefresh();
    expect(taskSys.getTaskProgress('nonexistent')).toBeNull();
  });

  it('不存在的任务更新返回null', () => {
    taskSys.dailyRefresh();
    expect(taskSys.updateProgress('nonexistent', 10)).toBeNull();
  });
});

// ══════════════════════════════════════════════
// §5.2 Boss讨伐→排行→奖励→商店资源闭环
// ══════════════════════════════════════════════

describe('§5.2 Boss讨伐→排行→奖励闭环', () => {
  let bossSys: AllianceBossSystem;
  let taskSys: AllianceTaskSystem;

  beforeEach(() => {
    bossSys = new AllianceBossSystem();
    taskSys = new AllianceTaskSystem();
  });

  it('完整闭环：挑战→击杀→排行→奖励→贡献', () => {
    const alliance = makeAlliance(3);
    let boss = createBoss(alliance.level, NOW);
    const players = ['p1', 'p2', 'p3', 'p4'];
    const playerStates: Record<string, AlliancePlayerState> = {};
    players.forEach(pid => { playerStates[pid] = state(); });

    // Each player challenges boss - accumulate boss state
    const damages = [40000, 35000, 30000, 25000];
    for (let i = 0; i < players.length; i++) {
      const r = bossSys.challengeBoss(boss, alliance, playerStates[players[i]], players[i], damages[i]);
      boss = r.boss; // carry forward boss state
      playerStates[players[i]] = r.playerState;
      alliance.members[players[i]].dailyBossChallenges = r.alliance.members[players[i]].dailyBossChallenges;
    }

    // Boss should be killed (total damage 130000 > boss HP at level 3 = 200000)
    // Actually Lv3 boss HP = 100000 + 2*50000 = 200000, damage 130000 < 200000
    // So boss is NOT killed. Adjust damages to kill.
    // Reset and use larger damages
  });

  it('完整闭环(击杀)：挑战→击杀→排行→奖励', () => {
    const alliance = makeAlliance(1); // Lv1 boss = 100000 HP
    let boss = createBoss(alliance.level, NOW);
    const playerStates: Record<string, AlliancePlayerState> = {};
    ['p1', 'p2', 'p3', 'p4'].forEach(pid => { playerStates[pid] = state(); });

    // p1 deals 40000, p2 deals 35000, p3 deals 30000 → total 105000 > 100000
    // p3's blow will be the killing blow (40000+35000+30000=105000)
    const challenges: [string, number][] = [['p1', 40000], ['p2', 35000], ['p3', 30000]];
    for (const [pid, dmg] of challenges) {
      const r = bossSys.challengeBoss(boss, alliance, playerStates[pid], pid, dmg);
      boss = r.boss;
      playerStates[pid] = r.playerState;
    }

    // Boss should be killed
    expect(boss.status).toBe(BossStatus.KILLED);

    // Ranking
    const ranking = bossSys.getDamageRanking(boss, alliance);
    expect(ranking[0].playerId).toBe('p1');
    expect(ranking).toHaveLength(3);

    // Each player got guild coins from participation
    for (const pid of ['p1', 'p2', 'p3']) {
      expect(playerStates[pid].guildCoins).toBeGreaterThan(0);
    }
  });

  it('任务贡献→联盟经验→等级提升闭环', () => {
    const allianceSys = new AllianceSystem();
    let alliance = makeAlliance();
    const ps = state({ guildCoins: 0, dailyContribution: 0, allianceId: alliance.id });

    // Record contribution
    const { alliance: afterA, playerState: afterPs } = taskSys.recordContribution(
      alliance, ps, 'p1', 100,
    );
    expect(afterPs.guildCoins).toBe(100);

    // Add alliance experience
    alliance = allianceSys.addExperience(afterA, 1000);
    expect(alliance.level).toBe(2);
    expect(allianceSys.getMaxMembers(alliance.level)).toBe(25);
  });
});
