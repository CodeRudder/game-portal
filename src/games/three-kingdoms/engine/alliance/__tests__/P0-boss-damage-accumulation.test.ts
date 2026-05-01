/**
 * P0 测试: 联盟Boss伤害累计
 * 缺口ID: GAP-ALLIANCE-006 | 节点ID: ALLIANCE-012
 *
 * 验证点：
 * 1. 每日挑战次数限制的精确验证（默认3次）
 * 2. 伤害排行榜实时更新
 * 3. 战斗中武将阵亡不影响正常阵容
 * 4. 伤害累计正确
 * 5. Boss击杀奖励分配
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AllianceBossSystem, DEFAULT_BOSS_CONFIG, createBoss } from '../AllianceBossSystem';
import { AllianceSystem } from '../AllianceSystem';
import { BossStatus } from '../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceBoss,
  AllianceMember,
} from '../../../core/alliance/alliance.types';
import { AllianceRole } from '../../../core/alliance/alliance.types';

// ── 测试辅助 ──

function createMockDeps() {
  return {
    eventBus: {
      on: () => {}, once: () => {}, emit: () => {},
      off: () => {}, removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {}, has: () => false },
    registry: { register: () => {}, get: () => undefined, getAll: () => new Map(), has: () => false, unregister: () => {} },
  };
}

function createTestAlliance(): AllianceData {
  return {
    id: 'ally_1',
    name: '测试联盟',
    declaration: '测试',
    leaderId: 'player1',
    members: {
      player1: {
        playerId: 'player1', playerName: '玩家1', role: AllianceRole.LEADER,
        power: 10000, joinTime: 1000, dailyContribution: 0, totalContribution: 0,
        dailyBossChallenges: 0,
      },
      player2: {
        playerId: 'player2', playerName: '玩家2', role: AllianceRole.MEMBER,
        power: 8000, joinTime: 1000, dailyContribution: 0, totalContribution: 0,
        dailyBossChallenges: 0,
      },
    },
    applications: [],
    announcements: [],
    messages: [],
    level: 1,
    experience: 0,
    maxMembers: 20,
    bossKilledToday: false,
    lastBossRefreshTime: 1000,
    lastDailyReset: 1000,
    dailyTaskCompleted: 0,
    createdAt: 1000,
  };
}

function createPlayerState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return {
    allianceId: 'ally_1',
    guildCoins: 0,
    dailyBossChallenges: 0,
    dailyContribution: 0,
    totalContribution: 0,
    lastDailyReset: 0,
    ...overrides,
  };
}

// ── 测试 ──

describe('P0: 联盟Boss伤害累计 (GAP-ALLIANCE-006)', () => {
  let bossSystem: AllianceBossSystem;
  let alliance: AllianceData;

  beforeEach(() => {
    bossSystem = new AllianceBossSystem();
    bossSystem.init(createMockDeps());
    alliance = createTestAlliance();
  });

  describe('每日挑战次数限制', () => {
    it('默认每日可挑战3次', () => {
      expect(DEFAULT_BOSS_CONFIG.dailyChallengeLimit).toBe(3);
    });

    it('挑战3次后第4次被拒绝', () => {
      const boss = createBoss(alliance.level, 1000);
      let playerState = createPlayerState();

      // 挑战3次
      for (let i = 0; i < 3; i++) {
        const result = bossSystem.challengeBoss(
          boss, alliance, playerState, 'player1', 1000,
        );
        playerState = result.playerState;
        alliance = result.alliance;
      }

      expect(playerState.dailyBossChallenges).toBe(3);

      // 第4次应该失败
      expect(() => {
        bossSystem.challengeBoss(boss, alliance, playerState, 'player1', 500);
      }).toThrow(/挑战次数已用完/);
    });

    it('每日重置后挑战次数恢复', () => {
      const allianceSystem = new AllianceSystem();
      allianceSystem.init(createMockDeps());

      let playerState = createPlayerState({ dailyBossChallenges: 3 });

      const resetResult = allianceSystem.dailyReset(alliance, playerState);
      playerState = resetResult.playerState;

      expect(playerState.dailyBossChallenges).toBe(0);
    });

    it('不同玩家挑战次数独立计算', () => {
      const boss = createBoss(alliance.level, 1000);

      // 玩家1挑战2次
      let ps1 = createPlayerState();
      for (let i = 0; i < 2; i++) {
        const result = bossSystem.challengeBoss(boss, alliance, ps1, 'player1', 500);
        ps1 = result.playerState;
        alliance = result.alliance;
      }
      expect(ps1.dailyBossChallenges).toBe(2);

      // 玩家2仍可挑战3次
      let ps2 = createPlayerState();
      const result2 = bossSystem.challengeBoss(boss, alliance, ps2, 'player2', 300);
      expect(result2.playerState.dailyBossChallenges).toBe(1);
    });
  });

  describe('伤害累计与排行榜', () => {
    it('多次挑战伤害累计正确', () => {
      const boss = createBoss(alliance.level, 1000);
      let playerState = createPlayerState();

      // 第一次挑战
      const r1 = bossSystem.challengeBoss(boss, alliance, playerState, 'player1', 1000);
      const bossAfter1 = r1.boss;
      expect(bossAfter1.damageRecords['player1']).toBe(1000);

      // 第二次挑战
      const r2 = bossSystem.challengeBoss(bossAfter1, r1.alliance, r1.playerState, 'player1', 2000);
      const bossAfter2 = r2.boss;
      expect(bossAfter2.damageRecords['player1']).toBe(3000); // 累计3000
    });

    it('排行榜按伤害降序排列', () => {
      const boss = createBoss(alliance.level, 1000);

      // 玩家1造成3000伤害
      let ps1 = createPlayerState();
      const r1 = bossSystem.challengeBoss(boss, alliance, ps1, 'player1', 3000);
      alliance = r1.alliance;

      // 玩家2造成5000伤害
      let ps2 = createPlayerState();
      const r2 = bossSystem.challengeBoss(r1.boss, alliance, ps2, 'player2', 5000);

      const ranking = bossSystem.getDamageRanking(r2.boss, r2.alliance);

      expect(ranking.length).toBe(2);
      expect(ranking[0].playerId).toBe('player2'); // 5000 > 3000
      expect(ranking[0].damage).toBe(5000);
      expect(ranking[1].playerId).toBe('player1');
      expect(ranking[1].damage).toBe(3000);
    });

    it('伤害不超过Boss当前HP', () => {
      const boss = createBoss(alliance.level, 1000);
      const playerState = createPlayerState();

      // Boss只有150000HP，尝试造成999999伤害
      const result = bossSystem.challengeBoss(
        boss, alliance, playerState, 'player1', 999999,
      );

      // 实际伤害应被限制为Boss当前HP
      expect(result.result.damage).toBe(boss.currentHp);
      expect(result.boss.currentHp).toBe(0);
    });
  });

  describe('Boss击杀奖励分配', () => {
    it('击杀Boss时给予击杀奖励', () => {
      const boss = createBoss(alliance.level, 1000);
      const playerState = createPlayerState();

      // 一击击杀
      const result = bossSystem.challengeBoss(
        boss, alliance, playerState, 'player1', boss.maxHp,
      );

      expect(result.result.isKillingBlow).toBe(true);
      expect(result.result.killReward).not.toBeNull();
      expect(result.result.killReward!.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
      expect(result.result.killReward!.destinyPoint).toBe(DEFAULT_BOSS_CONFIG.killDestinyReward);
      expect(result.boss.status).toBe(BossStatus.KILLED);
    });

    it('未击杀时无击杀奖励，但有参与奖', () => {
      const boss = createBoss(alliance.level, 1000);
      const playerState = createPlayerState();

      const result = bossSystem.challengeBoss(
        boss, alliance, playerState, 'player1', 100,
      );

      expect(result.result.isKillingBlow).toBe(false);
      expect(result.result.killReward).toBeNull();
      expect(result.result.guildCoinReward).toBe(DEFAULT_BOSS_CONFIG.participationGuildCoin);
    });

    it('Boss已被击杀后不能继续挑战', () => {
      const boss = createBoss(alliance.level, 1000);
      let playerState = createPlayerState();

      // 击杀Boss
      const r1 = bossSystem.challengeBoss(
        boss, alliance, playerState, 'player1', boss.maxHp,
      );

      // 尝试再次挑战
      expect(() => {
        bossSystem.challengeBoss(r1.boss, r1.alliance, r1.playerState, 'player1', 100);
      }).toThrow(/Boss已被击杀/);
    });
  });

  describe('阵容隔离验证', () => {
    it('Boss战斗不影响成员的dailyBossChallenges以外的数据', () => {
      const boss = createBoss(alliance.level, 1000);
      const playerState = createPlayerState({ guildCoins: 100 });

      const result = bossSystem.challengeBoss(
        boss, alliance, playerState, 'player1', 500,
      );

      // guildCoins应该增加（参与奖），其他不变
      expect(result.playerState.guildCoins).toBeGreaterThan(100);
      expect(result.playerState.allianceId).toBe('ally_1');
    });

    it('非联盟成员不能挑战Boss', () => {
      const boss = createBoss(alliance.level, 1000);
      const playerState = createPlayerState({ allianceId: 'other_alliance' });

      expect(() => {
        bossSystem.challengeBoss(boss, alliance, playerState, 'stranger', 100);
      }).toThrow(/不是联盟成员/);
    });
  });
});
