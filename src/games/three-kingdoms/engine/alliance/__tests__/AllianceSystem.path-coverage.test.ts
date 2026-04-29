/**
 * AllianceSystem 深度路径覆盖测试
 *
 * 覆盖复杂分支路径和组合场景：
 * 1. 创建联盟：首次创建/重复名/已满/已在联盟中
 * 2. 加入联盟：有邀请/无邀请/联盟已满
 * 3. 退出联盟：盟主退出/成员退出
 * 4. 联盟权限：三级权限检查（盟主/军师/成员）
 * 5. 联盟公告：发布/置顶上限/空内容
 * 6. 联盟商店：购买/积分不足/库存为0/等级不足
 *
 * @module engine/alliance/__tests__/AllianceSystem.path-coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AllianceSystem } from '../AllianceSystem';
import { AllianceTaskSystem } from '../AllianceTaskSystem';
import { AllianceShopSystem } from '../AllianceShopSystem';
import { createDefaultAlliancePlayerState, createAllianceData } from '../alliance-constants';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceMember,
} from '../../../core/alliance/alliance.types';
import { AllianceRole, ApplicationStatus } from '../../../core/alliance/alliance.types';
import type { ISystemDeps } from '../../../core/types';

// ── Mock ISystemDeps 工厂 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(() => false),
      unregister: vi.fn(),
    },
  };
}

// ── 辅助函数 ──

/** 创建默认玩家状态 */
function createPlayerState(overrides: Partial<AlliancePlayerState> = {}): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

/** 创建测试联盟数据 */
function createTestAlliance(overrides: Partial<AllianceData> = {}): AllianceData {
  const base = createAllianceData('ally_1', '测试联盟', '测试宣言', 'leader_1', '盟主', Date.now());
  return { ...base, ...overrides };
}

/** 添加成员到联盟 */
function addMember(alliance: AllianceData, playerId: string, playerName: string, role: AllianceRole = AllianceRole.MEMBER): AllianceData {
  const member: AllianceMember = {
    playerId,
    playerName,
    role,
    power: 1000,
    joinTime: Date.now(),
    dailyContribution: 0,
    totalContribution: 0,
    dailyBossChallenges: 0,
  };
  return {
    ...alliance,
    members: { ...alliance.members, [playerId]: member },
  };
}

// ── 测试 ──

describe('AllianceSystem 路径覆盖测试', () => {
  let system: AllianceSystem;
  let taskSystem: AllianceTaskSystem;
  let shopSystem: AllianceShopSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    system = new AllianceSystem();
    system.init(deps);
    taskSystem = new AllianceTaskSystem();
    taskSystem.init(deps);
    shopSystem = new AllianceShopSystem();
    shopSystem.init(deps);
  });

  // ═══════════════════════════════════════════
  // 1. 创建联盟路径
  // ═══════════════════════════════════════════

  describe('创建联盟路径', () => {
    it('首次创建联盟成功', () => {
      const playerState = createPlayerState();
      const result = system.createAlliance(playerState, '三国联盟', '复兴汉室', 'p1', '刘备', Date.now());

      expect(result.playerState.allianceId).toBeTruthy();
      expect(result.alliance.name).toBe('三国联盟');
      expect(result.alliance.leaderId).toBe('p1');
      expect(result.alliance.members['p1']).toBeDefined();
      expect(result.alliance.members['p1'].role).toBe('LEADER');
    });

    it('已在联盟中时创建失败', () => {
      const playerState = createPlayerState({ allianceId: 'existing_ally' });
      expect(() => {
        system.createAlliance(playerState, '新联盟', '宣言', 'p1', '玩家', Date.now());
      }).toThrow('已在联盟中');
    });

    it('联盟名称过短时创建失败', () => {
      const playerState = createPlayerState();
      expect(() => {
        system.createAlliance(playerState, '一', '宣言', 'p1', '玩家', Date.now());
      }).toThrow('联盟名称长度需在');
    });

    it('联盟名称过长时创建失败', () => {
      const playerState = createPlayerState();
      expect(() => {
        system.createAlliance(playerState, '超级长名字的联盟超出限制', '宣言', 'p1', '玩家', Date.now());
      }).toThrow('联盟名称长度需在');
    });

    it('简化版创建：元宝不足时返回失败', () => {
      system.setCurrencyCallbacks({
        spend: () => false,
        getBalance: () => 100, // 不足 500
      });

      const result = system.createAllianceSimple('测试联盟');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('元宝不足');
    });

    it('简化版创建：元宝充足时成功', () => {
      let spent = false;
      system.setCurrencyCallbacks({
        spend: () => { spent = true; return true; },
        getBalance: () => 1000,
      });

      const result = system.createAllianceSimple('测试联盟');
      expect(result.success).toBe(true);
      expect(spent).toBe(true);
      expect(system.getAlliance()).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 加入联盟路径
  // ═══════════════════════════════════════════

  describe('加入联盟路径', () => {
    it('申请加入联盟成功', () => {
      const alliance = createTestAlliance();
      const playerState = createPlayerState();

      const result = system.applyToJoin(alliance, playerState, 'p2', '关羽', 5000, Date.now());
      expect(result.applications).toHaveLength(1);
      expect(result.applications[0].playerId).toBe('p2');
      expect(result.applications[0].status).toBe(ApplicationStatus.PENDING);
    });

    it('已在联盟中时申请失败', () => {
      const alliance = createTestAlliance();
      const playerState = createPlayerState({ allianceId: 'other_ally' });

      expect(() => {
        system.applyToJoin(alliance, playerState, 'p2', '关羽', 5000, Date.now());
      }).toThrow('已在联盟中');
    });

    it('重复申请时失败', () => {
      const alliance = createTestAlliance();
      const playerState = createPlayerState();

      // 第一次申请成功
      const afterFirst = system.applyToJoin(alliance, playerState, 'p2', '关羽', 5000, Date.now());

      // 第二次申请失败（已有待审批的申请）
      expect(() => {
        system.applyToJoin(afterFirst, playerState, 'p2', '关羽', 5000, Date.now());
      }).toThrow('已提交申请');
    });

    it('联盟成员已满时申请失败', () => {
      // 等级1联盟最多20人
      let alliance = createTestAlliance();
      // 填满成员（已有leader_1，再加19人）
      for (let i = 2; i <= 20; i++) {
        alliance = addMember(alliance, `member_${i}`, `成员${i}`);
      }

      const playerState = createPlayerState();
      expect(() => {
        system.applyToJoin(alliance, playerState, 'p_extra', '溢出玩家', 1000, Date.now());
      }).toThrow('联盟成员已满');
    });

    it('审批申请成功（盟主/军师权限）', () => {
      let alliance = createTestAlliance();
      const playerState = createPlayerState();

      // 先申请
      alliance = system.applyToJoin(alliance, playerState, 'p2', '关羽', 5000, Date.now());
      const appId = alliance.applications[0].id;

      // 盟主审批
      const result = system.approveApplication(alliance, appId, 'leader_1', Date.now());
      expect(result.members['p2']).toBeDefined();
      expect(result.members['p2'].role).toBe('MEMBER');
    });

    it('审批已处理过的申请失败', () => {
      let alliance = createTestAlliance();
      const playerState = createPlayerState();

      alliance = system.applyToJoin(alliance, playerState, 'p2', '关羽', 5000, Date.now());
      const appId = alliance.applications[0].id;

      // 第一次审批成功
      alliance = system.approveApplication(alliance, appId, 'leader_1', Date.now());

      // 第二次审批同一申请失败
      expect(() => {
        system.approveApplication(alliance, appId, 'leader_1', Date.now());
      }).toThrow('申请已处理');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 退出联盟路径
  // ═══════════════════════════════════════════

  describe('退出联盟路径', () => {
    it('普通成员退出联盟成功', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'p2', '关羽');

      const playerState = createPlayerState({ allianceId: alliance.id });
      const result = system.leaveAlliance(alliance, playerState, 'p2');

      expect(result.playerState.allianceId).toBe('');
      expect(result.alliance).not.toBeNull();
      expect(result.alliance!.members['p2']).toBeUndefined();
    });

    it('盟主无法直接退出（需先转让）', () => {
      const alliance = createTestAlliance();
      const playerState = createPlayerState({ allianceId: alliance.id });

      expect(() => {
        system.leaveAlliance(alliance, playerState, 'leader_1');
      }).toThrow('盟主需先转让');
    });

    it('非成员退出失败', () => {
      const alliance = createTestAlliance();
      const playerState = createPlayerState({ allianceId: alliance.id });

      expect(() => {
        system.leaveAlliance(alliance, playerState, 'non_member');
      }).toThrow('不是联盟成员');
    });

    it('非盟主成员退出后联盟剩余成员为空时解散（返回null）', () => {
      // 构造一个特殊场景：联盟只有一个非盟主成员
      // 正常情况不会出现（盟主始终在），但需覆盖此分支
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'p2', '关羽');

      // 转让盟主给 p2
      alliance = system.transferLeadership(alliance, 'leader_1', 'p2');

      // leader_1（现在是普通成员）退出 → 只剩 p2（盟主）
      const result1 = system.leaveAlliance(alliance, createPlayerState({ allianceId: alliance.id }), 'leader_1');
      expect(result1.alliance).not.toBeNull();
      expect(result1.alliance!.members['leader_1']).toBeUndefined();

      // 构造只剩非盟主成员的极端场景：手动修改 alliance 数据
      // 将 leaderId 设为一个不存在的成员，然后让唯一成员退出
      const edgeCaseAlliance: AllianceData = {
        ...result1.alliance!,
        leaderId: 'ghost_leader', // 不在 members 中的盟主ID
      };

      // p2 现在不是盟主（leaderId 是 ghost_leader），可以退出
      const finalResult = system.leaveAlliance(
        edgeCaseAlliance,
        createPlayerState({ allianceId: alliance.id }),
        'p2',
      );
      expect(finalResult.alliance).toBeNull();
      expect(finalResult.playerState.allianceId).toBe('');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 联盟权限路径
  // ═══════════════════════════════════════════

  describe('联盟权限路径', () => {
    it('盟主拥有全部权限', () => {
      const alliance = createTestAlliance();
      expect(system.hasPermission(alliance, 'leader_1', 'approve')).toBe(true);
      expect(system.hasPermission(alliance, 'leader_1', 'announce')).toBe(true);
      expect(system.hasPermission(alliance, 'leader_1', 'kick')).toBe(true);
      expect(system.hasPermission(alliance, 'leader_1', 'manage')).toBe(true);
    });

    it('军师拥有审批/公告/踢人权限，无管理权限', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'advisor_1', '诸葛亮', AllianceRole.ADVISOR);

      expect(system.hasPermission(alliance, 'advisor_1', 'approve')).toBe(true);
      expect(system.hasPermission(alliance, 'advisor_1', 'announce')).toBe(true);
      expect(system.hasPermission(alliance, 'advisor_1', 'kick')).toBe(true);
      expect(system.hasPermission(alliance, 'advisor_1', 'manage')).toBe(false);
    });

    it('普通成员无任何管理权限', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'member_1', '张飞', AllianceRole.MEMBER);

      expect(system.hasPermission(alliance, 'member_1', 'approve')).toBe(false);
      expect(system.hasPermission(alliance, 'member_1', 'announce')).toBe(false);
      expect(system.hasPermission(alliance, 'member_1', 'kick')).toBe(false);
      expect(system.hasPermission(alliance, 'member_1', 'manage')).toBe(false);
    });

    it('踢人操作：盟主踢出成员成功', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'p2', '关羽');

      const result = system.kickMember(alliance, 'leader_1', 'p2');
      expect(result.members['p2']).toBeUndefined();
    });

    it('踢人操作：不能踢出自己', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'advisor_1', '诸葛亮', AllianceRole.ADVISOR);
      // 军师踢自己
      expect(() => {
        system.kickMember(alliance, 'advisor_1', 'advisor_1');
      }).toThrow('不能踢出自己');
    });

    it('踢人操作：不能踢出盟主', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'advisor_1', '诸葛亮', AllianceRole.ADVISOR);

      expect(() => {
        system.kickMember(alliance, 'advisor_1', 'leader_1');
      }).toThrow('不能踢出盟主');
    });

    it('转让盟主成功', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'p2', '关羽');

      const result = system.transferLeadership(alliance, 'leader_1', 'p2');
      expect(result.leaderId).toBe('p2');
      expect(result.members['leader_1'].role).toBe('MEMBER');
      expect(result.members['p2'].role).toBe('LEADER');
    });

    it('非盟主无法转让盟主', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'p2', '关羽', AllianceRole.ADVISOR);

      expect(() => {
        system.transferLeadership(alliance, 'p2', 'leader_1');
      }).toThrow('只有盟主可以转让');
    });

    it('转让给自己失败', () => {
      const alliance = createTestAlliance();
      expect(() => {
        system.transferLeadership(alliance, 'leader_1', 'leader_1');
      }).toThrow('不能转让给自己');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 联盟公告路径
  // ═══════════════════════════════════════════

  describe('联盟公告路径', () => {
    it('盟主发布公告成功', () => {
      const alliance = createTestAlliance();
      const result = system.postAnnouncement(alliance, 'leader_1', '盟主', '重要通知', false, Date.now());
      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].content).toBe('重要通知');
    });

    it('置顶公告达到上限时失败', () => {
      let alliance = createTestAlliance();
      // 发布3条置顶公告（上限）
      for (let i = 0; i < 3; i++) {
        alliance = system.postAnnouncement(alliance, 'leader_1', '盟主', `公告${i}`, true, Date.now());
      }
      // 第4条置顶公告应失败
      expect(() => {
        system.postAnnouncement(alliance, 'leader_1', '盟主', '第4条', true, Date.now());
      }).toThrow('置顶公告最多');
    });

    it('空内容公告失败', () => {
      const alliance = createTestAlliance();
      expect(() => {
        system.postAnnouncement(alliance, 'leader_1', '盟主', '   ', false, Date.now());
      }).toThrow('公告内容不能为空');
    });

    it('频道消息超过上限时自动裁剪', () => {
      let alliance = createTestAlliance();
      // 发送超过100条消息
      for (let i = 0; i < 110; i++) {
        alliance = system.sendMessage(alliance, 'leader_1', '盟主', `消息${i}`, Date.now());
      }
      // 应只保留最近100条
      expect(alliance.messages.length).toBeLessThanOrEqual(100);
    });

    it('非成员发送消息失败', () => {
      const alliance = createTestAlliance();
      expect(() => {
        system.sendMessage(alliance, 'non_member', '路人', '测试', Date.now());
      }).toThrow('不是联盟成员');
    });
  });

  // ═══════════════════════════════════════════
  // 6. 联盟等级与经验路径
  // ═══════════════════════════════════════════

  describe('联盟等级与经验路径', () => {
    it('添加经验后联盟升级', () => {
      const alliance = createTestAlliance();
      // 等级1 → 2 需要 1000 经验
      const result = system.addExperience(alliance, 1500);
      expect(result.level).toBe(2);
      expect(result.experience).toBe(1500);
    });

    it('经验不足时不升级', () => {
      const alliance = createTestAlliance();
      const result = system.addExperience(alliance, 500);
      expect(result.level).toBe(1);
    });

    it('联盟等级福利计算正确', () => {
      const alliance = createTestAlliance();
      const bonuses = system.getBonuses(alliance);
      // 等级1：resourceBonus=0, expeditionBonus=0
      expect(bonuses.resourceBonus).toBe(0);
      expect(bonuses.expeditionBonus).toBe(0);
    });

    it('联盟等级提升后成员上限增加', () => {
      expect(system.getMaxMembers(1)).toBe(20);
      expect(system.getMaxMembers(3)).toBe(30);
      expect(system.getMaxMembers(7)).toBe(50);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 联盟任务路径
  // ═══════════════════════════════════════════

  describe('联盟任务路径', () => {
    it('每日刷新生成任务', () => {
      const tasks = taskSystem.dailyRefresh();
      expect(tasks).toHaveLength(3); // 默认3个任务
      tasks.forEach(t => {
        expect(t.status).toBe('ACTIVE');
        expect(t.currentProgress).toBe(0);
      });
    });

    it('更新任务进度至完成', () => {
      taskSystem.dailyRefresh();
      const tasks = taskSystem.getActiveTasks();
      const firstTask = tasks[0];

      // 获取任务目标
      const def = taskSystem.getTaskDef(firstTask.defId);
      if (!def) return;

      // 更新进度到目标值
      const result = taskSystem.updateProgress(firstTask.defId, def.targetCount);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('COMPLETED');
    });

    it('领取未完成任务奖励失败', () => {
      taskSystem.dailyRefresh();
      const tasks = taskSystem.getActiveTasks();
      const alliance = createTestAlliance();
      const playerState = createPlayerState({ allianceId: alliance.id });

      expect(() => {
        taskSystem.claimTaskReward(tasks[0].defId, alliance, playerState, 'leader_1');
      }).toThrow('任务未完成');
    });

    it('领取已完成任务奖励成功', () => {
      taskSystem.dailyRefresh();
      const tasks = taskSystem.getActiveTasks();
      const def = taskSystem.getTaskDef(tasks[0].defId);
      if (!def) return;

      // 完成任务
      taskSystem.updateProgress(tasks[0].defId, def.targetCount);

      const alliance = createTestAlliance();
      const playerState = createPlayerState({ allianceId: alliance.id, guildCoins: 0 });

      const result = taskSystem.claimTaskReward(tasks[0].defId, alliance, playerState, 'leader_1');
      expect(result.coinGained).toBe(def.guildCoinReward);
      expect(result.expGained).toBe(def.allianceExpReward);
      expect(result.playerState.guildCoins).toBe(def.guildCoinReward);
    });

    it('重复领取奖励失败', () => {
      taskSystem.dailyRefresh();
      const tasks = taskSystem.getActiveTasks();
      const def = taskSystem.getTaskDef(tasks[0].defId);
      if (!def) return;

      taskSystem.updateProgress(tasks[0].defId, def.targetCount);

      const alliance = createTestAlliance();
      const playerState = createPlayerState({ allianceId: alliance.id });

      // 第一次领取成功
      taskSystem.claimTaskReward(tasks[0].defId, alliance, playerState, 'leader_1');

      // 第二次领取失败
      expect(() => {
        taskSystem.claimTaskReward(tasks[0].defId, alliance, playerState, 'leader_1');
      }).toThrow('已领取奖励');
    });
  });

  // ═══════════════════════════════════════════
  // 8. 联盟商店路径
  // ═══════════════════════════════════════════

  describe('联盟商店路径', () => {
    it('公会币充足时购买成功', () => {
      const playerState = createPlayerState({ guildCoins: 100 });
      const result = shopSystem.buyShopItem(playerState, 'as_1', 1);
      expect(result.guildCoins).toBe(50); // 100 - 50 = 50
    });

    it('公会币不足时购买失败', () => {
      const playerState = createPlayerState({ guildCoins: 10 });
      expect(() => {
        shopSystem.buyShopItem(playerState, 'as_1', 1);
      }).toThrow('公会币不足');
    });

    it('联盟等级不足时购买失败', () => {
      // as_4 需要 等级3
      const playerState = createPlayerState({ guildCoins: 200 });
      expect(() => {
        shopSystem.buyShopItem(playerState, 'as_4', 1);
      }).toThrow('联盟等级不足');
    });

    it('限购商品达到上限时购买失败', () => {
      const playerState = createPlayerState({ guildCoins: 1000 });

      // as_1 限购5次，先买5次
      for (let i = 0; i < 5; i++) {
        shopSystem.buyShopItem(playerState, 'as_1', 1);
      }

      // 第6次购买应失败
      expect(() => {
        shopSystem.buyShopItem(playerState, 'as_1', 1);
      }).toThrow('已达限购上限');
    });

    it('每周重置后限购恢复', () => {
      const playerState = createPlayerState({ guildCoins: 1000 });

      // 买满限购
      for (let i = 0; i < 5; i++) {
        shopSystem.buyShopItem(playerState, 'as_1', 1);
      }

      // 重置
      shopSystem.resetShopWeekly();

      // 重置后可以再买
      const canBuy = shopSystem.canBuy('as_1', 1, 100);
      expect(canBuy.canBuy).toBe(true);
    });

    it('canBuy检查不存在的商品', () => {
      const result = shopSystem.canBuy('nonexistent', 1, 1000);
      expect(result.canBuy).toBe(false);
      expect(result.reason).toContain('商品不存在');
    });

    it('批量购买正确计算', () => {
      const playerState = createPlayerState({ guildCoins: 500 });
      const result = shopSystem.buyShopItemBatch(playerState, 'as_3', 3, 1);
      // as_3: 20币/个，买3个 = 60
      expect(result.guildCoins).toBe(440);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 每日重置路径
  // ═══════════════════════════════════════════

  describe('每日重置路径', () => {
    it('每日重置清零成员日常数据', () => {
      let alliance = createTestAlliance();
      alliance = addMember(alliance, 'p2', '关羽');
      // 模拟有日常数据
      alliance.members['leader_1'].dailyContribution = 100;
      alliance.members['p2'].dailyContribution = 50;

      const playerState = createPlayerState({
        allianceId: alliance.id,
        dailyContribution: 100,
        dailyBossChallenges: 3,
      });

      const result = system.dailyReset(alliance, playerState);
      expect(result.alliance.members['leader_1'].dailyContribution).toBe(0);
      expect(result.alliance.members['p2'].dailyContribution).toBe(0);
      expect(result.playerState.dailyContribution).toBe(0);
      expect(result.playerState.dailyBossChallenges).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 序列化路径
  // ═══════════════════════════════════════════

  describe('序列化路径', () => {
    it('序列化与反序列化保持一致', () => {
      const playerState = createPlayerState({ allianceId: 'ally_1', guildCoins: 500 });
      const alliance = createTestAlliance();

      const saved = system.serialize(playerState, alliance);
      expect(saved.version).toBe(1);
      expect(saved.playerState.guildCoins).toBe(500);

      const restored = system.deserialize(saved);
      expect(restored.playerState.guildCoins).toBe(500);
      expect(restored.alliance).not.toBeNull();
      expect(restored.alliance!.name).toBe('测试联盟');
    });

    it('无联盟时序列化/反序列化', () => {
      const playerState = createPlayerState();
      const saved = system.serialize(playerState, null);
      expect(saved.allianceData).toBeNull();

      const restored = system.deserialize(saved);
      expect(restored.alliance).toBeNull();
      expect(restored.playerState.allianceId).toBe('');
    });
  });
});
