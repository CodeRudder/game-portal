/**
 * AllianceBossSystem 单元测试
 *
 * 覆盖：
 *   - Boss生成（等级+HP）
 *   - Boss挑战（伤害+击杀判定）
 *   - 伤害排行
 *   - 奖励分配
 *   - 挑战次数限制
 */

import {
  AllianceBossSystem,
  DEFAULT_BOSS_CONFIG,
  createBoss,
} from '../AllianceBossSystem';
import { BossStatus } from '../../../core/alliance/alliance.types';
import type {
  AllianceBoss,
  AllianceData,
  AlliancePlayerState,
} from '../../../core/alliance/alliance.types';
import { createDefaultAlliancePlayerState, createAllianceData } from '../alliance-constants';

// ── 辅助函数 ──────────────────────────────

const NOW = 1000000;

function createState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function createTestAlliance(level = 1): AllianceData {
  const alliance = createAllianceData('ally_1', '蜀汉', '兴复汉室', 'p1', '刘备', NOW);
  alliance.level = level;
  alliance.members['p2'] = {
    playerId: 'p2', playerName: '诸葛亮', role: 'ADVISOR' as any,
    power: 5000, joinTime: NOW, dailyContribution: 0, totalContribution: 100, dailyBossChallenges: 0,
  };
  return alliance;
}

// ── Boss生成 ──────────────────────────────

describe('AllianceBossSystem — Boss生成', () => {
  test('Boss基础HP计算', () => {
    const boss = createBoss(1, NOW);
    expect(boss.maxHp).toBe(DEFAULT_BOSS_CONFIG.baseHp);
    expect(boss.currentHp).toBe(boss.maxHp);
    expect(boss.status).toBe(BossStatus.ALIVE);
  });

  test('Boss HP随联盟等级递增', () => {
    const boss1 = createBoss(1, NOW);
    const boss3 = createBoss(3, NOW);
    expect(boss3.maxHp).toBe(boss1.maxHp + 2 * DEFAULT_BOSS_CONFIG.hpPerLevel);
  });

  test('Boss等级等于联盟等级', () => {
    const boss = createBoss(5, NOW);
    expect(boss.level).toBe(5);
  });

  test('Boss名称循环', () => {
    const boss1 = createBoss(1, NOW);
    const boss9 = createBoss(9, NOW);
    expect(boss1.name).toBe(boss9.name); // 8个名字循环
  });

  test('每日刷新Boss', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const result = system.refreshBoss(alliance, NOW + 1000);
    expect(result.bossKilledToday).toBe(false);
    expect(result.lastBossRefreshTime).toBe(NOW + 1000);
  });

  test('获取当前Boss — 击杀后状态', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    alliance.bossKilledToday = true;
    const boss = system.getCurrentBoss(alliance);
    expect(boss.status).toBe(BossStatus.KILLED);
    expect(boss.currentHp).toBe(0);
  });
});

// ── Boss挑战 ──────────────────────────────

describe('AllianceBossSystem — Boss挑战', () => {
  test('正常挑战造成伤害', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    const boss = createBoss(1, NOW);

    const result = system.challengeBoss(boss, alliance, state, 'p1', 10000);

    expect(result.result.damage).toBe(10000);
    expect(result.result.isKillingBlow).toBe(false);
    expect(result.result.guildCoinReward).toBe(DEFAULT_BOSS_CONFIG.participationGuildCoin);
    expect(result.boss.currentHp).toBe(boss.maxHp - 10000);
    expect(result.playerState.guildCoins).toBe(DEFAULT_BOSS_CONFIG.participationGuildCoin);
    expect(result.playerState.dailyBossChallenges).toBe(1);
  });

  test('击杀Boss', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    const boss = createBoss(1, NOW);

    const result = system.challengeBoss(boss, alliance, state, 'p1', boss.maxHp);

    expect(result.result.isKillingBlow).toBe(true);
    expect(result.result.damage).toBe(boss.maxHp);
    expect(result.boss.status).toBe(BossStatus.KILLED);
    expect(result.boss.currentHp).toBe(0);
    expect(result.alliance.bossKilledToday).toBe(true);
    expect(result.result.killReward).toEqual({
      guildCoin: DEFAULT_BOSS_CONFIG.killGuildCoinReward,
      destinyPoint: DEFAULT_BOSS_CONFIG.killDestinyReward,
    });
  });

  test('伤害不超过当前HP', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    const boss = createBoss(1, NOW);

    // 先打掉大部分HP
    const result1 = system.challengeBoss(boss, alliance, state, 'p1', boss.maxHp - 1000);
    // 再打超额伤害
    const result2 = system.challengeBoss(
      result1.boss, result1.alliance, result1.playerState, 'p1', 99999,
    );

    expect(result2.result.damage).toBe(1000); // 只剩1000
    expect(result2.result.isKillingBlow).toBe(true);
  });

  test('已击杀的Boss不能再挑战', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    const boss = createBoss(1, NOW);
    boss.status = BossStatus.KILLED;
    boss.currentHp = 0;

    expect(() => system.challengeBoss(boss, alliance, state, 'p1', 1000))
      .toThrow('Boss已被击杀');
  });

  test('非成员不能挑战', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    const boss = createBoss(1, NOW);

    expect(() => system.challengeBoss(boss, alliance, state, 'p999', 1000))
      .toThrow('不是联盟成员');
  });

  test('挑战次数耗尽', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState({ dailyBossChallenges: DEFAULT_BOSS_CONFIG.dailyChallengeLimit });
    const boss = createBoss(1, NOW);

    expect(() => system.challengeBoss(boss, alliance, state, 'p1', 1000))
      .toThrow('今日挑战次数已用完');
  });

  test('每日3次挑战限制', () => {
    expect(DEFAULT_BOSS_CONFIG.dailyChallengeLimit).toBe(3);
  });
});

// ── 伤害排行 ──────────────────────────────

describe('AllianceBossSystem — 伤害排行', () => {
  test('空排行', () => {
    const system = new AllianceBossSystem();
    const boss = createBoss(1, NOW);
    const alliance = createTestAlliance();
    const ranking = system.getDamageRanking(boss, alliance);
    expect(ranking).toHaveLength(0);
  });

  test('伤害排行按降序', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    let boss = createBoss(1, NOW);

    const r1 = system.challengeBoss(boss, alliance, state, 'p1', 30000,);
    const r2 = system.challengeBoss(r1.boss, r1.alliance, r1.playerState, 'p2', 50000);

    const ranking = system.getDamageRanking(r2.boss, r2.alliance);
    expect(ranking).toHaveLength(2);
    expect(ranking[0].playerId).toBe('p2'); // 50000 > 30000
    expect(ranking[0].rank).toBe(1);
    expect(ranking[1].rank).toBe(2);
  });

  test('伤害占比计算', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    let boss = createBoss(1, NOW);

    const r1 = system.challengeBoss(boss, alliance, state, 'p1', 30000);
    const r2 = system.challengeBoss(r1.boss, r1.alliance, { ...r1.playerState, dailyBossChallenges: 0 }, 'p2', 70000);

    const ranking = system.getDamageRanking(r2.boss, r2.alliance);
    // p1: 30000/100000 = 30%, p2: 70000/100000 = 70%
    expect(ranking[0].damagePercent).toBeCloseTo(70);
    expect(ranking[1].damagePercent).toBeCloseTo(30);
  });

  test('同一玩家多次挑战累计伤害', () => {
    const system = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const state = createState();
    let boss = createBoss(1, NOW);

    const r1 = system.challengeBoss(boss, alliance, state, 'p1', 10000);
    const r2 = system.challengeBoss(r1.boss, r1.alliance, r1.playerState, 'p1', 20000);

    const ranking = system.getDamageRanking(r2.boss, r2.alliance);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].damage).toBe(30000);
  });
});

// ── 奖励分配 ──────────────────────────────

describe('AllianceBossSystem — 奖励分配', () => {
  test('击杀全员奖励', () => {
    const system = new AllianceBossSystem();
    const rewards = system.getKillRewards();
    expect(rewards.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
    expect(rewards.destinyPoint).toBe(DEFAULT_BOSS_CONFIG.killDestinyReward);
  });

  test('分配击杀奖励增加公会币', () => {
    const system = new AllianceBossSystem();
    const state = createState({ guildCoins: 100 });
    const result = system.distributeKillRewards(createTestAlliance(), state);
    expect(result.guildCoins).toBe(100 + DEFAULT_BOSS_CONFIG.killGuildCoinReward);
  });

  test('参与奖公会币', () => {
    expect(DEFAULT_BOSS_CONFIG.participationGuildCoin).toBe(5);
  });
});

// ── 工具方法 ──────────────────────────────

describe('AllianceBossSystem — 工具方法', () => {
  test('计算Boss最大HP', () => {
    const system = new AllianceBossSystem();
    expect(system.calculateBossMaxHp(1)).toBe(DEFAULT_BOSS_CONFIG.baseHp);
    expect(system.calculateBossMaxHp(3)).toBe(
      DEFAULT_BOSS_CONFIG.baseHp + 2 * DEFAULT_BOSS_CONFIG.hpPerLevel,
    );
  });

  test('获取剩余挑战次数', () => {
    const system = new AllianceBossSystem();
    const state = createState({ dailyBossChallenges: 0 });
    expect(system.getRemainingChallenges(state)).toBe(3);

    const state2 = createState({ dailyBossChallenges: 2 });
    expect(system.getRemainingChallenges(state2)).toBe(1);

    const state3 = createState({ dailyBossChallenges: 3 });
    expect(system.getRemainingChallenges(state3)).toBe(0);
  });
});
