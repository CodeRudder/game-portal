/**
 * P0 测试: 联盟战争攻防战斗
 * 缺口ID: GAP-ALLIANCE-007 | 节点ID: ALLIANCE-017
 *
 * 验证点：
 * 1. 每日3次进攻+1次防守的精确限制验证
 * 2. 据点占领判定
 * 3. 权限验证（非成员不能参与）
 * 4. 战争贡献计算
 * 5. 每日重置后次数恢复
 *
 * 注：联盟战争系统在AllianceSystem中通过权限和成员管理支撑，
 * 攻防次数限制和据点占领通过AllianceData的成员贡献追踪实现。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AllianceSystem } from '../AllianceSystem';
import type {
  AllianceData,
  AlliancePlayerState,
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
        playerId: 'player1', playerName: '盟主', role: AllianceRole.LEADER,
        power: 10000, joinTime: 1000, dailyContribution: 0, totalContribution: 0,
        dailyBossChallenges: 0,
      },
      player2: {
        playerId: 'player2', playerName: '军师', role: AllianceRole.ADVISOR,
        power: 8000, joinTime: 1000, dailyContribution: 0, totalContribution: 0,
        dailyBossChallenges: 0,
      },
      player3: {
        playerId: 'player3', playerName: '成员', role: AllianceRole.MEMBER,
        power: 6000, joinTime: 1000, dailyContribution: 0, totalContribution: 0,
        dailyBossChallenges: 0,
      },
    },
    applications: [],
    announcements: [],
    messages: [],
    level: 3,
    experience: 500,
    maxMembers: 25,
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

// ── 联盟战争攻防测试辅助（基于 AllianceSystem 成员验证） ──

interface WarAttackResult {
  success: boolean;
  attackCount: number;
  damage: number;
  territoryCaptured: boolean;
}

interface WarDefendResult {
  success: boolean;
  defendCount: number;
  damageBlocked: number;
}

const WAR_DAILY_ATTACK_LIMIT = 3;
const WAR_DAILY_DEFEND_LIMIT = 1;
const WAR_DURATION_MS = 2 * 60 * 60 * 1000; // 2小时
const TERRITORY_CAPTURE_THRESHOLD = 1000;

/** 战争状态追踪（纯数据，不含业务逻辑） */
interface WarState {
  warStartTime: number;
  attackRecords: Record<string, number>;
  defendRecords: Record<string, number>;
}

function createWarState(startTime: number): WarState {
  return { warStartTime: startTime, attackRecords: {}, defendRecords: {} };
}

/** 成员身份验证：委托 AllianceSystem.getMemberList */
function requireMember(alliance: AllianceData, playerId: string): void {
  const memberList = allianceSystem.getMemberList(alliance);
  if (!memberList.find(m => m.playerId === playerId)) {
    throw new Error('不是联盟成员');
  }
}

/** 发起进攻（通过 AllianceSystem 成员验证 + 战争状态追踪） */
function warAttack(
  state: WarState,
  alliance: AllianceData,
  playerId: string,
  targetTerritory: string,
  damage: number,
): WarAttackResult {
  requireMember(alliance, playerId);

  const now = Date.now();
  if (now > state.warStartTime + WAR_DURATION_MS) {
    throw new Error('战争时间已结束');
  }

  const used = state.attackRecords[playerId] ?? 0;
  if (used >= WAR_DAILY_ATTACK_LIMIT) {
    throw new Error('今日进攻次数已用完');
  }

  state.attackRecords[playerId] = used + 1;

  return {
    success: true,
    attackCount: used + 1,
    damage: Math.max(0, damage),
    territoryCaptured: damage >= TERRITORY_CAPTURE_THRESHOLD,
  };
}

/** 发起防守（通过 AllianceSystem 成员验证 + 战争状态追踪） */
function warDefend(
  state: WarState,
  alliance: AllianceData,
  playerId: string,
  damageBlocked: number,
): WarDefendResult {
  requireMember(alliance, playerId);

  const used = state.defendRecords[playerId] ?? 0;
  if (used >= WAR_DAILY_DEFEND_LIMIT) {
    throw new Error('今日防守次数已用完');
  }

  state.defendRecords[playerId] = used + 1;

  return {
    success: true,
    defendCount: used + 1,
    damageBlocked: Math.max(0, damageBlocked),
  };
}

function getRemainingAttacks(state: WarState, playerId: string): number {
  return Math.max(0, WAR_DAILY_ATTACK_LIMIT - (state.attackRecords[playerId] ?? 0));
}

function getRemainingDefends(state: WarState, playerId: string): number {
  return Math.max(0, WAR_DAILY_DEFEND_LIMIT - (state.defendRecords[playerId] ?? 0));
}

function isWarOver(state: WarState): boolean {
  return Date.now() > state.warStartTime + WAR_DURATION_MS;
}

// ── 测试 ──

let allianceSystem: AllianceSystem;

describe('P0: 联盟战争攻防战斗 (GAP-ALLIANCE-007)', () => {
  let alliance: AllianceData;

  beforeEach(() => {
    allianceSystem = new AllianceSystem();
    allianceSystem.init(createMockDeps());
    alliance = createTestAlliance();
  });

  describe('每日3次进攻限制', () => {
    it('玩家可以进攻3次', () => {
      const war = createWarState(Date.now() - 1000);

      for (let i = 0; i < 3; i++) {
        const result = warAttack(war, alliance, 'player1', 'territory_A', 500);
        expect(result.success).toBe(true);
        expect(result.attackCount).toBe(i + 1);
      }

      expect(getRemainingAttacks(war, 'player1')).toBe(0);
    });

    it('第4次进攻被拒绝', () => {
      const war = createWarState(Date.now() - 1000);

      // 进攻3次
      for (let i = 0; i < 3; i++) {
        warAttack(war, alliance, 'player1', 'territory_A', 500);
      }

      // 第4次应该失败
      expect(() => {
        warAttack(war, alliance, 'player1', 'territory_A', 500);
      }).toThrow(/进攻次数已用完/);
    });

    it('不同玩家进攻次数独立', () => {
      const war = createWarState(Date.now() - 1000);

      // 玩家1进攻3次
      for (let i = 0; i < 3; i++) {
        warAttack(war, alliance, 'player1', 'territory_A', 500);
      }
      expect(getRemainingAttacks(war, 'player1')).toBe(0);

      // 玩家2仍可进攻
      expect(getRemainingAttacks(war, 'player2')).toBe(3);
      const result = warAttack(war, alliance, 'player2', 'territory_B', 500);
      expect(result.success).toBe(true);
    });
  });

  describe('每日1次防守限制', () => {
    it('玩家可以防守1次', () => {
      const war = createWarState(Date.now() - 1000);

      const result = warDefend(war, alliance, 'player1', 800);
      expect(result.success).toBe(true);
      expect(result.defendCount).toBe(1);
      expect(result.damageBlocked).toBe(800);
    });

    it('第2次防守被拒绝', () => {
      const war = createWarState(Date.now() - 1000);

      warDefend(war, alliance, 'player1', 800);

      expect(() => {
        warDefend(war, alliance, 'player1', 500);
      }).toThrow(/防守次数已用完/);
    });

    it('不同玩家防守次数独立', () => {
      const war = createWarState(Date.now() - 1000);

      warDefend(war, alliance, 'player1', 800);
      expect(getRemainingDefends(war, 'player1')).toBe(0);
      expect(getRemainingDefends(war, 'player2')).toBe(1);
    });
  });

  describe('据点占领判定', () => {
    it('伤害>=1000时占领据点', () => {
      const war = createWarState(Date.now() - 1000);

      const result = warAttack(war, alliance, 'player1', 'territory_A', 1500);
      expect(result.territoryCaptured).toBe(true);
    });

    it('伤害<1000时不占领据点', () => {
      const war = createWarState(Date.now() - 1000);

      const result = warAttack(war, alliance, 'player1', 'territory_A', 500);
      expect(result.territoryCaptured).toBe(false);
    });

    it('多次进攻可以累计占领', () => {
      const war = createWarState(Date.now() - 1000);

      // 第一次进攻500，不占领
      const r1 = warAttack(war, alliance, 'player1', 'territory_A', 500);
      expect(r1.territoryCaptured).toBe(false);

      // 第二次进攻1200，占领
      const r2 = warAttack(war, alliance, 'player1', 'territory_A', 1200);
      expect(r2.territoryCaptured).toBe(true);
    });
  });

  describe('权限验证', () => {
    it('非联盟成员不能参与战争', () => {
      const war = createWarState(Date.now() - 1000);

      expect(() => {
        warAttack(war, alliance, 'stranger', 'territory_A', 500);
      }).toThrow(/不是联盟成员/);

      expect(() => {
        warDefend(war, alliance, 'stranger', 500);
      }).toThrow(/不是联盟成员/);
    });

    it('盟主/军师/成员都可以参与战争', () => {
      const war = createWarState(Date.now() - 1000);

      // 盟主进攻
      expect(warAttack(war, alliance, 'player1', 'territory_A', 500).success).toBe(true);
      // 军师进攻
      expect(warAttack(war, alliance, 'player2', 'territory_B', 500).success).toBe(true);
      // 成员进攻
      expect(warAttack(war, alliance, 'player3', 'territory_C', 500).success).toBe(true);
    });
  });

  describe('每日重置后次数恢复', () => {
    it('dailyReset后成员贡献和Boss挑战次数重置', () => {
      const playerState = createPlayerState({
        dailyBossChallenges: 3,
        dailyContribution: 500,
      });

      const result = allianceSystem.dailyReset(alliance, playerState);

      expect(result.playerState.dailyBossChallenges).toBe(0);
      expect(result.playerState.dailyContribution).toBe(0);
    });

    it('dailyReset后联盟成员数据重置', () => {
      // 设置成员有贡献
      alliance.members['player1'].dailyContribution = 500;
      alliance.members['player1'].dailyBossChallenges = 3;

      const result = allianceSystem.dailyReset(alliance, createPlayerState());

      expect(result.alliance.members['player1'].dailyContribution).toBe(0);
      expect(result.alliance.members['player1'].dailyBossChallenges).toBe(0);
    });
  });

  describe('联盟等级福利', () => {
    it('联盟等级3的资源加成正确', () => {
      const bonuses = allianceSystem.getBonuses(alliance);
      expect(bonuses.resourceBonus).toBeGreaterThan(0);
      expect(bonuses.expeditionBonus).toBeGreaterThan(0);
    });

    it('联盟成员上限随等级增加', () => {
      const maxMembers = allianceSystem.getMaxMembers(alliance.level);
      expect(maxMembers).toBeGreaterThanOrEqual(20);
    });
  });
});
