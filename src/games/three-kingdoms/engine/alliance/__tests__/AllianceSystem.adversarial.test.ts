/**
 * AllianceSystem 对抗式测试
 *
 * 覆盖：边界条件、异常注入、权限越级、状态转换、跨系统交互
 * 重点发现：负数伤害/经验/贡献注入、权限绕过、边界溢出
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AllianceSystem } from '../AllianceSystem';
import { AllianceBossSystem, createBoss, DEFAULT_BOSS_CONFIG } from '../AllianceBossSystem';
import { AllianceShopSystem, DEFAULT_ALLIANCE_SHOP_ITEMS } from '../AllianceShopSystem';
import { AllianceTaskSystem, ALLIANCE_TASK_POOL, DEFAULT_TASK_CONFIG } from '../AllianceTaskSystem';
import * as AllianceHelper from '../AllianceHelper';
import {
  DEFAULT_CREATE_CONFIG,
  ALLIANCE_LEVEL_CONFIGS,
  createDefaultAlliancePlayerState,
  createAllianceData,
  generateId,
} from '../alliance-constants';
import {
  ApplicationStatus,
  AllianceRole,
  BossStatus,
  AllianceTaskStatus,
  AllianceTaskType,
} from '../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceMember,
  AllianceBoss,
} from '../../../core/alliance/alliance.types';
import type { ISystemDeps } from '../../../core/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

const NOW = 1000000;

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

function createState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function createTestAlliance(
  leaderId = 'p1',
  leaderName = '刘备',
  name = '蜀汉',
): AllianceData {
  return createAllianceData('ally_1', name, '兴复汉室', leaderId, leaderName, NOW);
}

function createAllianceWithMembers(): AllianceData {
  let alliance = createTestAlliance();
  alliance.members['p2'] = {
    playerId: 'p2', playerName: '诸葛亮', role: AllianceRole.ADVISOR,
    power: 5000, joinTime: NOW, dailyContribution: 0, totalContribution: 100, dailyBossChallenges: 0,
  };
  alliance.members['p3'] = {
    playerId: 'p3', playerName: '关羽', role: AllianceRole.MEMBER,
    power: 3000, joinTime: NOW, dailyContribution: 0, totalContribution: 50, dailyBossChallenges: 0,
  };
  return alliance;
}

function createFullAlliance(memberCount: number): AllianceData {
  const alliance = createTestAlliance('leader', '盟主', '满员盟');
  for (let i = 1; i < memberCount; i++) {
    alliance.members[`m${i}`] = {
      playerId: `m${i}`, playerName: `成员${i}`, role: AllianceRole.MEMBER,
      power: 1000, joinTime: NOW, dailyContribution: 0, totalContribution: 0, dailyBossChallenges: 0,
    };
  }
  return alliance;
}

// ═══════════════════════════════════════════════════════════

describe('AllianceSystem 对抗式测试', () => {
  let system: AllianceSystem;

  beforeEach(() => {
    system = new AllianceSystem();
    system.init(mockDeps());
  });

  // ═══════════════════════════════════════════
  // 1. 负数注入攻击
  // ═══════════════════════════════════════════

  describe('TC-A-001: Boss负数伤害注入', () => {
    it('challengeBoss 负数伤害不应增加 Boss HP', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState();
      const boss = createBoss(alliance.level, NOW);

      const initialHp = boss.currentHp;

      // 对抗：注入负数伤害
      // BUG: Math.min(-10000, boss.currentHp) = -10000
      // newHp = currentHp - (-10000) = currentHp + 10000 → HP 增加！
      const result = bossSys.challengeBoss(boss, alliance, playerState, 'p1', -10000);
      // BUG: HP 从 initialHp(100000) 增加到 110000
      expect(result.boss.currentHp).toBe(initialHp); // 期望不变，实际 BUG: HP 增加
    });
  });

  describe('TC-A-002: 联盟经验负数注入', () => {
    it('addExperience 负数不应使经验为负', () => {
      const alliance = createTestAlliance();
      const result = system.addExperience(alliance, -5000);
      // BUG: experience = 0 + (-5000) = -5000
      expect(result.experience).toBeGreaterThanOrEqual(0);
    });

    it('addExperience 负数不应导致等级异常', () => {
      const alliance = createTestAlliance();
      const result = system.addExperience(alliance, -5000);
      expect(result.level).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TC-A-003: 任务进度负数', () => {
    it('updateProgress 负数不应使进度为负', () => {
      const taskSys = new AllianceTaskSystem();
      taskSys.init(mockDeps());
      taskSys.dailyRefresh();

      const tasks = taskSys.getActiveTasks();
      if (tasks.length > 0) {
        taskSys.updateProgress(tasks[0].defId, -100);
        const updated = taskSys.getActiveTasks()[0];
        // BUG: currentProgress = 0 + (-100) = -100
        expect(updated.currentProgress).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('TC-A-004: 贡献负数', () => {
    it('recordContribution 负数不应减少贡献', () => {
      const taskSys = new AllianceTaskSystem();
      taskSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState();

      const result = taskSys.recordContribution(alliance, playerState, 'p1', -500);
      // BUG: dailyContribution 和 totalContribution 会减少
      expect(result.alliance.members['p1'].dailyContribution).toBeGreaterThanOrEqual(0);
      expect(result.playerState.guildCoins).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 边界条件
  // ═══════════════════════════════════════════

  describe('TC-A-005: 创建联盟名称边界', () => {
    it('1字符名称应 throw', () => {
      const ps = createState();
      expect(() => system.createAlliance(ps, '蜀', '', 'p1', '刘备', NOW))
        .toThrow(/联盟名称长度/);
    });

    it('2字符名称应通过', () => {
      const ps = createState();
      const result = system.createAlliance(ps, '蜀汉', '', 'p1', '刘备', NOW);
      expect(result.alliance.name).toBe('蜀汉');
    });

    it('8字符名称应通过', () => {
      const ps = createState();
      const result = system.createAlliance(ps, '12345678', '', 'p1', '刘备', NOW);
      expect(result.alliance.name).toBe('12345678');
    });

    it('9字符名称应 throw', () => {
      const ps = createState();
      expect(() => system.createAlliance(ps, '123456789', '', 'p1', '刘备', NOW))
        .toThrow(/联盟名称长度/);
    });

    it('空字符串名称应 throw', () => {
      const ps = createState();
      expect(() => system.createAlliance(ps, '', '', 'p1', '刘备', NOW))
        .toThrow(/联盟名称长度/);
    });
  });

  describe('TC-A-007: 置顶公告上限', () => {
    it('第4条置顶公告应 throw', () => {
      const alliance = createAllianceWithMembers();
      let updated = alliance;
      for (let i = 0; i < 3; i++) {
        updated = system.postAnnouncement(updated, 'p1', '刘备', `公告${i}`, true, NOW);
      }
      expect(updated.announcements.filter(a => a.pinned).length).toBe(3);

      expect(() => system.postAnnouncement(updated, 'p1', '刘备', '第4条', true, NOW))
        .toThrow(/置顶公告最多/);
    });

    it('非置顶公告无数量限制', () => {
      let alliance = createAllianceWithMembers();
      for (let i = 0; i < 10; i++) {
        alliance = system.postAnnouncement(alliance, 'p1', '刘备', `公告${i}`, false, NOW);
      }
      expect(alliance.announcements.length).toBe(10);
    });
  });

  describe('TC-A-008: 消息列表截断', () => {
    it('超过 maxMessages 保留最新100条', () => {
      let alliance = createAllianceWithMembers();
      for (let i = 0; i < 101; i++) {
        alliance = system.sendMessage(alliance, 'p1', '刘备', `消息${i}`, NOW + i);
      }
      expect(alliance.messages.length).toBe(DEFAULT_CREATE_CONFIG.maxMessages);
      expect(alliance.messages[0].content).toBe('消息1'); // 最早的被截断
      expect(alliance.messages[99].content).toBe('消息100');
    });
  });

  describe('TC-A-027: 成员满时批准申请', () => {
    it('成员满时批准应 throw', () => {
      const maxMembers = ALLIANCE_LEVEL_CONFIGS[0].maxMembers; // 20
      const alliance = createFullAlliance(maxMembers);
      // 添加一个待审批申请
      alliance.applications.push({
        id: 'app-1', allianceId: alliance.id,
        playerId: 'extra-p', playerName: '额外玩家', power: 1000,
        timestamp: NOW, status: ApplicationStatus.PENDING,
      });

      expect(() => system.approveApplication(alliance, 'app-1', 'leader', NOW))
        .toThrow(/联盟成员已满/);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 权限越级
  // ═══════════════════════════════════════════

  describe('TC-A-011: MEMBER越权审批', () => {
    it('普通成员不能审批申请', () => {
      const alliance = createAllianceWithMembers();
      alliance.applications.push({
        id: 'app-1', allianceId: alliance.id,
        playerId: 'p4', playerName: '张飞', power: 2000,
        timestamp: NOW, status: ApplicationStatus.PENDING,
      });
      expect(() => system.approveApplication(alliance, 'app-1', 'p3', NOW))
        .toThrow(/权限不足/);
    });
  });

  describe('TC-A-012: ADVISOR越权转让', () => {
    it('军师不能转让盟主', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.transferLeadership(alliance, 'p2', 'p3'))
        .toThrow(/只有盟主可以转让/);
    });
  });

  describe('TC-A-009: 盟主踢出自己', () => {
    it('应 throw（盟主不能被踢出）', () => {
      const alliance = createAllianceWithMembers();
      // 盟主踢自己：先命中"不能踢出盟主"检查
      expect(() => system.kickMember(alliance, 'p1', 'p1'))
        .toThrow(/不能踢出盟主/);
    });
  });

  describe('TC-A-010: 盟主转让给自己', () => {
    it('应 throw', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.transferLeadership(alliance, 'p1', 'p1'))
        .toThrow(/不能转让给自己/);
    });
  });

  describe('TC-A-025: setRole 设为 LEADER', () => {
    it('应 throw 提示使用转让功能', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.setRole(alliance, 'p1', 'p2', AllianceRole.LEADER))
        .toThrow(/请使用转让盟主功能/);
    });
  });

  describe('setRole 修改自己的角色', () => {
    it('应 throw', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.setRole(alliance, 'p1', 'p1', AllianceRole.ADVISOR))
        .toThrow(/不能修改自己的角色/);
    });
  });

  describe('kickMember 踢出盟主', () => {
    it('军师不能踢出盟主', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.kickMember(alliance, 'p2', 'p1'))
        .toThrow(/不能踢出盟主/);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 重复操作
  // ═══════════════════════════════════════════

  describe('TC-A-013: 重复申请加入', () => {
    it('第二次申请应 throw', () => {
      const alliance = createTestAlliance();
      const ps = createState();
      let updated = system.applyToJoin(alliance, ps, 'p2', '诸葛亮', 5000, NOW);
      expect(() => system.applyToJoin(updated, ps, 'p2', '诸葛亮', 5000, NOW))
        .toThrow(/已提交申请/);
    });
  });

  describe('TC-A-014: 已处理申请再次操作', () => {
    it('批准后再拒绝应 throw', () => {
      const alliance = createAllianceWithMembers();
      alliance.applications.push({
        id: 'app-1', allianceId: alliance.id,
        playerId: 'p4', playerName: '张飞', power: 2000,
        timestamp: NOW, status: ApplicationStatus.PENDING,
      });
      const approved = system.approveApplication(alliance, 'app-1', 'p1', NOW);
      expect(() => system.rejectApplication(approved, 'app-1', 'p1'))
        .toThrow(/申请已处理/);
    });

    it('拒绝后再批准应 throw', () => {
      const alliance = createAllianceWithMembers();
      alliance.applications.push({
        id: 'app-1', allianceId: alliance.id,
        playerId: 'p4', playerName: '张飞', power: 2000,
        timestamp: NOW, status: ApplicationStatus.PENDING,
      });
      const rejected = system.rejectApplication(alliance, 'app-1', 'p1');
      expect(() => system.approveApplication(rejected, 'app-1', 'p1', NOW))
        .toThrow(/申请已处理/);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 退出与解散
  // ═══════════════════════════════════════════

  describe('TC-A-015: 最后一人退出', () => {
    it('最后一人退出后 alliance 为 null', () => {
      const alliance = createTestAlliance('only', '独狼');
      const ps = createState({ allianceId: alliance.id });

      // 盟主不能直接退出，需先转让
      expect(() => system.leaveAlliance(alliance, ps, 'only'))
        .toThrow(/盟主需先转让/);
    });

    it('非盟主退出正常', () => {
      const alliance = createAllianceWithMembers();
      const ps = createState({ allianceId: alliance.id });
      const result = system.leaveAlliance(alliance, ps, 'p3');
      expect(result.playerState.allianceId).toBe('');
      expect(result.alliance).not.toBeNull();
      expect(result.alliance!.members['p3']).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 6. Boss 系统对抗
  // ═══════════════════════════════════════════

  describe('TC-A-018: Boss挑战次数耗尽', () => {
    it('3次后第4次应 throw', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState({ dailyBossChallenges: 3 });

      const boss = createBoss(alliance.level, NOW);
      expect(() => bossSys.challengeBoss(boss, alliance, playerState, 'p1', 100))
        .toThrow(/今日挑战次数已用完/);
    });
  });

  describe('TC-A-019: Boss击杀奖励', () => {
    it('致命一击正确返回 killReward', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState();

      const boss = createBoss(alliance.level, NOW);
      const result = bossSys.challengeBoss(boss, alliance, playerState, 'p1', boss.maxHp);

      expect(result.result.isKillingBlow).toBe(true);
      expect(result.result.killReward).not.toBeNull();
      expect(result.result.killReward!.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
      expect(result.result.killReward!.destinyPoint).toBe(DEFAULT_BOSS_CONFIG.killDestinyReward);
    });
  });

  describe('TC-A-020: 伤害超过Boss剩余HP', () => {
    it('实际伤害 clamp 到剩余HP', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState();

      const boss = createBoss(alliance.level, NOW);
      // 先打掉大部分HP
      boss.currentHp = 100;

      const result = bossSys.challengeBoss(boss, alliance, playerState, 'p1', 99999);
      expect(result.result.damage).toBe(100);
      expect(result.boss.currentHp).toBe(0);
    });
  });

  describe('Boss已死时挑战', () => {
    it('应 throw', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState();

      const boss = createBoss(alliance.level, NOW);
      boss.status = BossStatus.KILLED;
      boss.currentHp = 0;

      expect(() => bossSys.challengeBoss(boss, alliance, playerState, 'p1', 100))
        .toThrow(/Boss已被击杀/);
    });
  });

  describe('非成员挑战Boss', () => {
    it('应 throw', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const playerState = createState();

      const boss = createBoss(alliance.level, NOW);
      expect(() => bossSys.challengeBoss(boss, alliance, playerState, 'outsider', 100))
        .toThrow(/不是联盟成员/);
    });
  });

  describe('TC-A-028: 伤害排行空记录', () => {
    it('新Boss无伤害记录返回空数组', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const boss = createBoss(alliance.level, NOW);

      const ranking = bossSys.getDamageRanking(boss, alliance);
      expect(ranking).toEqual([]);
    });
  });

  describe('Boss伤害排行排序', () => {
    it('按伤害降序排列', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const alliance = createAllianceWithMembers();

      const boss = createBoss(alliance.level, NOW);
      boss.damageRecords = { p1: 5000, p2: 8000, p3: 3000 };

      const ranking = bossSys.getDamageRanking(boss, alliance);
      expect(ranking[0].playerId).toBe('p2');
      expect(ranking[1].playerId).toBe('p1');
      expect(ranking[2].playerId).toBe('p3');
      expect(ranking[0].rank).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 商店系统对抗
  // ═══════════════════════════════════════════

  describe('TC-A-016: 商店限购溢出', () => {
    it('达到限购上限后再次购买应 throw', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      const item = DEFAULT_ALLIANCE_SHOP_ITEMS[0];
      let ps = createState({ guildCoins: 10000 });

      // 买满限购
      for (let i = 0; i < item.weeklyLimit; i++) {
        ps = shopSys.buyShopItem(ps, item.id, 1);
      }

      expect(() => shopSys.buyShopItem(ps, item.id, 1))
        .toThrow(/已达限购上限/);
    });
  });

  describe('TC-A-017: 商店批量购买超过限购', () => {
    it('应 clamp 到剩余限购数', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      const item = DEFAULT_ALLIANCE_SHOP_ITEMS[0]; // weeklyLimit=5
      let ps = createState({ guildCoins: 10000 });

      // 先买3个
      ps = shopSys.buyShopItemBatch(ps, item.id, 3, 1);
      expect(ps.guildCoins).toBe(10000 - item.guildCoinCost * 3);

      // 批量买5个，实际只能买2个
      ps = shopSys.buyShopItemBatch(ps, item.id, 5, 1);
      expect(ps.guildCoins).toBe(10000 - item.guildCoinCost * 3 - item.guildCoinCost * 2);
    });
  });

  describe('商店等级限制', () => {
    it('联盟等级不足时购买应 throw', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      // as_4 需要3级
      const ps = createState({ guildCoins: 10000 });
      expect(() => shopSys.buyShopItem(ps, 'as_4', 1))
        .toThrow(/联盟等级不足/);
    });
  });

  describe('商店公会币不足', () => {
    it('公会币不足时购买应 throw', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      const ps = createState({ guildCoins: 5 }); // 不够50
      expect(() => shopSys.buyShopItem(ps, 'as_1', 1))
        .toThrow(/公会币不足/);
    });
  });

  describe('canBuy 综合检查', () => {
    it('商品不存在', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      expect(shopSys.canBuy('nonexistent', 1, 1000)).toEqual({
        canBuy: false, reason: '商品不存在',
      });
    });

    it('等级不足', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      expect(shopSys.canBuy('as_4', 1, 1000)).toEqual({
        canBuy: false, reason: '需要联盟等级3',
      });
    });

    it('正常可购买', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      expect(shopSys.canBuy('as_1', 1, 1000)).toEqual({
        canBuy: true, reason: '',
      });
    });
  });

  describe('resetShopWeekly', () => {
    it('重置后所有商品购买数归零', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      let ps = createState({ guildCoins: 10000 });
      ps = shopSys.buyShopItem(ps, 'as_1', 1);

      shopSys.resetShopWeekly();
      expect(shopSys.getItem('as_1')!.purchased).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 任务系统对抗
  // ═══════════════════════════════════════════

  describe('TC-A-021: 任务奖励重复领取', () => {
    it('同一玩家重复领取应 throw', () => {
      const taskSys = new AllianceTaskSystem();
      taskSys.init(mockDeps());
      taskSys.dailyRefresh();

      const tasks = taskSys.getActiveTasks();
      if (tasks.length > 0) {
        const def = taskSys.getTaskDef(tasks[0].defId)!;
        // 完成任务
        taskSys.updateProgress(tasks[0].defId, def.targetCount);

        const alliance = createAllianceWithMembers();
        const ps = createState();
        taskSys.claimTaskReward(tasks[0].defId, alliance, ps, 'p1');

        expect(() => taskSys.claimTaskReward(tasks[0].defId, alliance, ps, 'p1'))
          .toThrow(/已领取奖励/);
      }
    });
  });

  describe('TC-A-022: 联盟等级跨级升级', () => {
    it('大量经验一次升到最高级', () => {
      let alliance = createTestAlliance();
      alliance = system.addExperience(alliance, 50000);
      expect(alliance.level).toBe(ALLIANCE_LEVEL_CONFIGS.length);
    });

    it('恰好升级所需经验', () => {
      let alliance = createTestAlliance();
      alliance = system.addExperience(alliance, 1000); // 升到2级需要1000
      expect(alliance.level).toBe(2);
    });

    it('差1经验不升级', () => {
      let alliance = createTestAlliance();
      alliance = system.addExperience(alliance, 999);
      expect(alliance.level).toBe(1);
    });
  });

  describe('任务序列化/反序列化', () => {
    it('Set<string> ↔ string[] 转换一致性', () => {
      const taskSys = new AllianceTaskSystem();
      taskSys.init(mockDeps());
      taskSys.dailyRefresh();

      const tasks = taskSys.getActiveTasks();
      if (tasks.length > 0) {
        // 模拟领取
        tasks[0].claimedPlayers.add('p1');
        tasks[0].claimedPlayers.add('p2');

        const serialized = taskSys.serializeTasks();
        expect(serialized[0].claimedPlayers).toEqual(['p1', 'p2']);

        const taskSys2 = new AllianceTaskSystem();
        taskSys2.init(mockDeps());
        taskSys2.deserializeTasks(serialized);

        const restored = taskSys2.getActiveTasks();
        expect(restored[0].claimedPlayers.has('p1')).toBe(true);
        expect(restored[0].claimedPlayers.has('p2')).toBe(true);
        expect(restored[0].claimedPlayers.has('p3')).toBe(false);
      }
    });
  });

  describe('recordContribution 非成员', () => {
    it('非成员记录贡献应 throw', () => {
      const taskSys = new AllianceTaskSystem();
      taskSys.init(mockDeps());
      const alliance = createAllianceWithMembers();
      const ps = createState();

      expect(() => taskSys.recordContribution(alliance, ps, 'outsider', 100))
        .toThrow(/不是联盟成员/);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化安全
  // ═══════════════════════════════════════════

  describe('TC-A-023: deserialize 版本不匹配', () => {
    it('错误版本返回默认值', () => {
      const result = system.deserialize({ version: 999, playerState: createState(), allianceData: null });
      expect(result.playerState.allianceId).toBe('');
      expect(result.alliance).toBeNull();
    });

    it('null 数据返回默认值', () => {
      const result = AllianceHelper.deserializeAlliance(null as any);
      expect(result.playerState.allianceId).toBe('');
      expect(result.alliance).toBeNull();
    });
  });

  describe('serialize/deserialize 往返', () => {
    it('序列化→反序列化后数据一致', () => {
      const alliance = createAllianceWithMembers();
      const ps = createState({ allianceId: alliance.id, guildCoins: 500 });

      const saved = system.serialize(ps, alliance);
      const restored = system.deserialize(saved);

      expect(restored.playerState.guildCoins).toBe(500);
      expect(restored.alliance).not.toBeNull();
      expect(restored.alliance!.name).toBe('蜀汉');
      expect(Object.keys(restored.alliance!.members).length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 搜索与查询
  // ═══════════════════════════════════════════

  describe('TC-A-024: searchAlliance 空关键词', () => {
    it('空字符串返回全部', () => {
      const alliances = [
        createAllianceData('a1', '蜀汉', '', 'p1', '刘备', NOW),
        createAllianceData('a2', '曹魏', '', 'p2', '曹操', NOW),
      ];
      const result = AllianceHelper.searchAlliance(alliances, '');
      expect(result.length).toBe(2);
    });

    it('大小写不敏感搜索', () => {
      const alliances = [
        createAllianceData('a1', 'TestAlliance', '', 'p1', 'P1', NOW),
      ];
      expect(AllianceHelper.searchAlliance(alliances, 'testalliance').length).toBe(1);
    });
  });

  describe('getPendingApplications', () => {
    it('只返回 PENDING 状态', () => {
      const alliance = createTestAlliance();
      alliance.applications = [
        { id: '1', allianceId: alliance.id, playerId: 'p2', playerName: 'P2', power: 100, timestamp: NOW, status: ApplicationStatus.PENDING },
        { id: '2', allianceId: alliance.id, playerId: 'p3', playerName: 'P3', power: 200, timestamp: NOW, status: ApplicationStatus.APPROVED },
        { id: '3', allianceId: alliance.id, playerId: 'p4', playerName: 'P4', power: 300, timestamp: NOW, status: ApplicationStatus.REJECTED },
      ];
      const pending = AllianceHelper.getPendingApplications(alliance);
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('1');
    });
  });

  // ═══════════════════════════════════════════
  // 11. createAllianceSimple 对抗
  // ═══════════════════════════════════════════

  describe('TC-A-026: createAllianceSimple', () => {
    it('元宝不足返回失败', () => {
      system.setCurrencyCallbacks({
        spend: vi.fn().mockReturnValue(false),
        getBalance: vi.fn().mockReturnValue(100), // < 500
      });
      const result = system.createAllianceSimple('测试联盟');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('元宝不足');
    });

    it('扣除失败返回失败', () => {
      system.setCurrencyCallbacks({
        spend: vi.fn().mockReturnValue(false),
        getBalance: vi.fn().mockReturnValue(1000),
      });
      const result = system.createAllianceSimple('测试联盟');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('元宝扣除失败');
    });

    it('正常创建成功', () => {
      system.setCurrencyCallbacks({
        spend: vi.fn().mockReturnValue(true),
        getBalance: vi.fn().mockReturnValue(1000),
      });
      const result = system.createAllianceSimple('测试联盟');
      expect(result.success).toBe(true);
      expect(system.getAlliance()).not.toBeNull();
    });

    it('已在联盟中创建失败', () => {
      system.setCurrencyCallbacks({
        spend: vi.fn().mockReturnValue(true),
        getBalance: vi.fn().mockReturnValue(1000),
      });
      system.createAllianceSimple('第一个');
      const result = system.createAllianceSimple('第二个');
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 12. 每日重置
  // ═══════════════════════════════════════════

  describe('dailyReset', () => {
    it('重置所有成员每日数据', () => {
      const alliance = createAllianceWithMembers();
      alliance.members['p1'].dailyContribution = 100;
      alliance.members['p2'].dailyBossChallenges = 3;
      alliance.bossKilledToday = true;

      const ps = createState({ dailyBossChallenges: 3, dailyContribution: 100 });
      const result = system.dailyReset(alliance, ps);

      expect(result.alliance.members['p1'].dailyContribution).toBe(0);
      expect(result.alliance.members['p2'].dailyBossChallenges).toBe(0);
      expect(result.alliance.bossKilledToday).toBe(false);
      expect(result.playerState.dailyBossChallenges).toBe(0);
      expect(result.playerState.dailyContribution).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 13. AllianceHelper 权限矩阵
  // ═══════════════════════════════════════════

  describe('权限矩阵完整覆盖', () => {
    const alliance = createAllianceWithMembers();

    it('LEADER 拥有所有权限', () => {
      expect(AllianceHelper.hasPermission(alliance, 'p1', 'approve')).toBe(true);
      expect(AllianceHelper.hasPermission(alliance, 'p1', 'announce')).toBe(true);
      expect(AllianceHelper.hasPermission(alliance, 'p1', 'kick')).toBe(true);
      expect(AllianceHelper.hasPermission(alliance, 'p1', 'manage')).toBe(true);
    });

    it('ADVISOR 拥有 approve/announce/kick 权限', () => {
      expect(AllianceHelper.hasPermission(alliance, 'p2', 'approve')).toBe(true);
      expect(AllianceHelper.hasPermission(alliance, 'p2', 'announce')).toBe(true);
      expect(AllianceHelper.hasPermission(alliance, 'p2', 'kick')).toBe(true);
      expect(AllianceHelper.hasPermission(alliance, 'p2', 'manage')).toBe(false);
    });

    it('MEMBER 无管理权限', () => {
      expect(AllianceHelper.hasPermission(alliance, 'p3', 'approve')).toBe(false);
      expect(AllianceHelper.hasPermission(alliance, 'p3', 'announce')).toBe(false);
      expect(AllianceHelper.hasPermission(alliance, 'p3', 'kick')).toBe(false);
      expect(AllianceHelper.hasPermission(alliance, 'p3', 'manage')).toBe(false);
    });

    it('非成员无权限', () => {
      expect(AllianceHelper.hasPermission(alliance, 'outsider', 'approve')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 14. 工具函数对抗
  // ═══════════════════════════════════════════

  describe('generateId', () => {
    it('生成带前缀的唯一ID', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test_')).toBe(true);
    });
  });

  describe('getLevelConfig', () => {
    it('level 0 返回 level 1 配置', () => {
      const config = system.getLevelConfig(0);
      expect(config.level).toBe(1);
    });

    it('超高等级返回最高级配置', () => {
      const config = system.getLevelConfig(999);
      expect(config.level).toBe(ALLIANCE_LEVEL_CONFIGS.length);
    });
  });

  describe('getBonuses', () => {
    it('1级联盟无加成', () => {
      const alliance = createTestAlliance();
      const bonuses = system.getBonuses(alliance);
      expect(bonuses.resourceBonus).toBe(0);
      expect(bonuses.expeditionBonus).toBe(0);
    });

    it('7级联盟有最高加成', () => {
      const alliance = createTestAlliance();
      alliance.level = 7;
      const bonuses = system.getBonuses(alliance);
      expect(bonuses.resourceBonus).toBe(12);
      expect(bonuses.expeditionBonus).toBe(6);
    });
  });

  // ═══════════════════════════════════════════
  // 15. 公告内容对抗
  // ═══════════════════════════════════════════

  describe('公告内容对抗', () => {
    it('空白内容公告应 throw', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.postAnnouncement(alliance, 'p1', '刘备', '   ', false, NOW))
        .toThrow(/公告内容不能为空/);
    });

    it('空字符串公告应 throw', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.postAnnouncement(alliance, 'p1', '刘备', '', false, NOW))
        .toThrow(/公告内容不能为空/);
    });
  });

  describe('消息内容对抗', () => {
    it('空白内容消息应 throw', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.sendMessage(alliance, 'p1', '刘备', '   ', NOW))
        .toThrow(/消息内容不能为空/);
    });

    it('非成员发消息应 throw', () => {
      const alliance = createAllianceWithMembers();
      expect(() => system.sendMessage(alliance, 'outsider', '外人', 'hello', NOW))
        .toThrow(/不是联盟成员/);
    });
  });

  // ═══════════════════════════════════════════
  // 16. Boss系统工具方法
  // ═══════════════════════════════════════════

  describe('Boss工具方法', () => {
    it('calculateBossMaxHp 随等级增长', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const hp1 = bossSys.calculateBossMaxHp(1);
      const hp7 = bossSys.calculateBossMaxHp(7);
      expect(hp7).toBeGreaterThan(hp1);
    });

    it('getRemainingChallenges 正确计算', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const ps = createState({ dailyBossChallenges: 1 });
      expect(bossSys.getRemainingChallenges(ps)).toBe(2);
    });

    it('getRemainingChallenges 用完后为0', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const ps = createState({ dailyBossChallenges: 3 });
      expect(bossSys.getRemainingChallenges(ps)).toBe(0);
    });

    it('distributeKillRewards 增加公会币', () => {
      const bossSys = new AllianceBossSystem();
      bossSys.init(mockDeps());
      const ps = createState({ guildCoins: 100 });
      const result = bossSys.distributeKillRewards(createTestAlliance(), ps);
      expect(result.guildCoins).toBe(100 + DEFAULT_BOSS_CONFIG.killGuildCoinReward);
    });
  });

  // ═══════════════════════════════════════════
  // 17. 商店工具方法
  // ═══════════════════════════════════════════

  describe('商店工具方法', () => {
    it('getRemainingPurchases 无限购商品', () => {
      const shopSys = new AllianceShopSystem([{
        id: 'unlimited', name: '无限商品', type: 'misc',
        guildCoinCost: 10, weeklyLimit: 0, purchased: 0, requiredAllianceLevel: 1,
      }]);
      shopSys.init(mockDeps());
      expect(shopSys.getRemainingPurchases('unlimited')).toBe(Infinity);
    });

    it('getItemsByType 按类型分组', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      const grouped = shopSys.getItemsByType(1);
      expect(grouped['recruit_order']).toBeDefined();
      expect(grouped['equip_box']).toBeDefined();
    });

    it('isItemUnlocked 不存在的商品', () => {
      const shopSys = new AllianceShopSystem();
      shopSys.init(mockDeps());
      expect(shopSys.isItemUnlocked('nonexistent', 1)).toBe(false);
    });
  });
});
