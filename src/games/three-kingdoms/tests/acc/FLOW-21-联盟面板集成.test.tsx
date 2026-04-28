/**
 * FLOW-21 联盟面板集成测试 — 联盟信息/成员列表/联盟捐献/联盟任务/苏格拉底边界
 *
 * 使用真实 AllianceSystem / AllianceBossSystem / AllianceTaskSystem / AllianceShopSystem，
 * 通过 createSim() 创建引擎实例，不 mock 核心逻辑。
 *
 * 覆盖范围：
 * - 联盟信息显示：创建联盟、联盟数据结构、等级配置
 * - 联盟成员列表：加入/退出/踢人/权限管理
 * - 联盟捐献：贡献记录、经验增长、公会币
 * - 联盟任务：任务生成/进度/完成/奖励
 * - 苏格拉底边界：名称限制/满员/重复加入/序列化
 *
 * @module tests/acc/FLOW-21
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 联盟系统核心
import {
  AllianceSystem,
  AllianceBossSystem,
  AllianceTaskSystem,
  AllianceShopSystem,
  DEFAULT_CREATE_CONFIG,
  ALLIANCE_LEVEL_CONFIGS,
  ALLIANCE_SAVE_VERSION,
  createDefaultAlliancePlayerState,
  createAllianceData,
  DEFAULT_BOSS_CONFIG,
  DEFAULT_ALLIANCE_SHOP_ITEMS,
  DEFAULT_TASK_CONFIG,
  ALLIANCE_TASK_POOL,
} from '../../engine/alliance';

// 联盟类型
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceMember,
  AllianceApplication,
  AllianceLevelConfig,
  AllianceBoss,
  AllianceTaskDef,
  AllianceTaskInstance,
  AllianceShopItem,
  AllianceSaveData,
} from '../../engine/alliance';

import {
  AllianceRole,
  ApplicationStatus,
  BossStatus,
  AllianceTaskType,
  AllianceTaskStatus,
} from '../../engine/alliance';

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

const NOW = Date.now();

function createPlayerState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return {
    ...createDefaultAlliancePlayerState(),
    ...overrides,
  };
}

/** 创建一个含盟主的联盟 */
function createTestAlliance(
  allianceSys: AllianceSystem,
  playerId = 'p1',
  playerName = '玩家1',
): { playerState: AlliancePlayerState; alliance: AllianceData } {
  const ps = createPlayerState();
  return allianceSys.createAlliance(ps, '测试联盟', '测试宣言', playerId, playerName, NOW);
}

// ═══════════════════════════════════════════════════════════════
// FLOW-21 联盟面板集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-21 联盟面板集成测试', () => {
  let sim: GameEventSimulator;
  let allianceSys: AllianceSystem;
  let bossSys: AllianceBossSystem;
  let taskSys: AllianceTaskSystem;
  let shopSys: AllianceShopSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });

    const deps = mockDeps();
    allianceSys = new AllianceSystem();
    allianceSys.init(deps);

    bossSys = new AllianceBossSystem();
    bossSys.init(deps);

    taskSys = new AllianceTaskSystem();
    taskSys.init(deps);

    shopSys = new AllianceShopSystem();
    shopSys.init(deps);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 联盟信息显示（FLOW-21-01 ~ FLOW-21-05）
  // ═══════════════════════════════════════════════════════════

  describe('1. 联盟信息显示', () => {

    it(accTest('FLOW-21-01', '联盟创建 — 成功创建联盟'), () => {
      const ps = createPlayerState();
      const result = allianceSys.createAlliance(ps, '蜀汉', '兴复汉室', 'p1', '刘备', NOW);

      assertStrict(!!result.alliance, 'FLOW-21-01', '应创建联盟');
      assertStrict(result.alliance.name === '蜀汉', 'FLOW-21-01',
        `名称应为蜀汉，实际: ${result.alliance.name}`);
      assertStrict(result.alliance.leaderId === 'p1', 'FLOW-21-01',
        `盟主应为p1，实际: ${result.alliance.leaderId}`);
      assertStrict(result.playerState.allianceId === result.alliance.id, 'FLOW-21-01',
        '玩家状态应包含联盟ID');
    });

    it(accTest('FLOW-21-02', '联盟信息 — 初始等级和经验正确'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      assertStrict(alliance.level === 1, 'FLOW-21-02',
        `初始等级应为1，实际: ${alliance.level}`);
      assertStrict(alliance.experience === 0, 'FLOW-21-02',
        `初始经验应为0，实际: ${alliance.experience}`);
      assertStrict(alliance.bossKilledToday === false, 'FLOW-21-02',
        '初始Boss应未击杀');
    });

    it(accTest('21-03', '联盟信息 — 等级配置表完整'), () => {
      assertStrict(ALLIANCE_LEVEL_CONFIGS.length === 7, 'FLOW-21-03',
        `应有7个等级配置，实际: ${ALLIANCE_LEVEL_CONFIGS.length}`);

      const level1 = ALLIANCE_LEVEL_CONFIGS[0];
      assertStrict(level1.maxMembers === 20, 'FLOW-21-03',
        `1级成员上限应为20，实际: ${level1.maxMembers}`);

      const level7 = ALLIANCE_LEVEL_CONFIGS[6];
      assertStrict(level7.maxMembers === 50, 'FLOW-21-03',
        `7级成员上限应为50，实际: ${level7.maxMembers}`);
    });

    it(accTest('FLOW-21-04', '联盟信息 — 成员列表查询'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      const members = allianceSys.getMemberList(alliance);
      assertStrict(members.length === 1, 'FLOW-21-04',
        `初始应有1个成员（盟主），实际: ${members.length}`);
      assertStrict(members[0].role === AllianceRole.LEADER, 'FLOW-21-04',
        `盟主角色应为LEADER，实际: ${members[0].role}`);
    });

    it(accTest('FLOW-21-05', '联盟信息 — 联盟福利随等级增长'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      const bonuses1 = allianceSys.getBonuses(alliance);
      assertStrict(bonuses1.resourceBonus === 0, 'FLOW-21-05',
        `1级资源加成应为0%，实际: ${bonuses1.resourceBonus}`);

      // 模拟升级到3级
      const upgraded = allianceSys.addExperience(alliance, 3000);
      const bonuses3 = allianceSys.getBonuses(upgraded);
      assertStrict(bonuses3.resourceBonus > 0, 'FLOW-21-05',
        `3级资源加成应>0%，实际: ${bonuses3.resourceBonus}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 联盟成员列表（FLOW-21-06 ~ FLOW-21-10）
  // ═══════════════════════════════════════════════════════════

  describe('2. 联盟成员列表', () => {

    it(accTest('FLOW-21-06', '成员加入 — 申请并审批通过'), () => {
      const { alliance, playerState } = createTestAlliance(allianceSys);

      // 玩家2申请加入
      const ps2 = createPlayerState();
      const withApp = allianceSys.applyToJoin(alliance, ps2, 'p2', '关羽', 5000, NOW);

      const pendingApps = allianceSys.getPendingApplications(withApp);
      assertStrict(pendingApps.length === 1, 'FLOW-21-06',
        `应有1个待审批申请，实际: ${pendingApps.length}`);

      // 盟主审批
      const approved = allianceSys.approveApplication(withApp, pendingApps[0].id, 'p1', NOW);
      const members = allianceSys.getMemberList(approved);
      assertStrict(members.length === 2, 'FLOW-21-06',
        `审批后应有2个成员，实际: ${members.length}`);
    });

    it(accTest('FLOW-21-07', '成员退出 — 普通成员可退出'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      // 加入一个成员
      const ps2 = createPlayerState();
      let ally = allianceSys.applyToJoin(alliance, ps2, 'p2', '关羽', 5000, NOW);
      const apps = allianceSys.getPendingApplications(ally);
      ally = allianceSys.approveApplication(ally, apps[0].id, 'p1', NOW);

      // 退出
      const result = allianceSys.leaveAlliance(ally, createPlayerState({ allianceId: ally.id }), 'p2');
      assertStrict(!!result.alliance, 'FLOW-21-07', '联盟应仍存在');
      const members = allianceSys.getMemberList(result.alliance!);
      assertStrict(members.length === 1, 'FLOW-21-07',
        `退出后应有1个成员，实际: ${members.length}`);
    });

    it(accTest('FLOW-21-08', '成员踢出 — 盟主可踢人'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      // 加入一个成员
      const ps2 = createPlayerState();
      let ally = allianceSys.applyToJoin(alliance, ps2, 'p2', '关羽', 5000, NOW);
      const apps = allianceSys.getPendingApplications(ally);
      ally = allianceSys.approveApplication(ally, apps[0].id, 'p1', NOW);

      // 踢人
      const kicked = allianceSys.kickMember(ally, 'p1', 'p2');
      const members = allianceSys.getMemberList(kicked);
      assertStrict(members.length === 1, 'FLOW-21-08',
        `踢人后应有1个成员，实际: ${members.length}`);
    });

    it(accTest('FLOW-21-09', '权限管理 — 三级权限体系正确'), () => {
      const roles = Object.values(AllianceRole);
      assertStrict(roles.length === 3, 'FLOW-21-09',
        `应有3种角色，实际: ${roles.length}`);
      assertStrict(roles.includes(AllianceRole.LEADER), 'FLOW-21-09', '应有盟主');
      assertStrict(roles.includes(AllianceRole.ADVISOR), 'FLOW-21-09', '应有军师');
      assertStrict(roles.includes(AllianceRole.MEMBER), 'FLOW-21-09', '应有成员');
    });

    it(accTest('FLOW-21-10', '权限管理 — 盟主可设置角色'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      // 加入成员
      const ps2 = createPlayerState();
      let ally = allianceSys.applyToJoin(alliance, ps2, 'p2', '关羽', 5000, NOW);
      const apps = allianceSys.getPendingApplications(ally);
      ally = allianceSys.approveApplication(ally, apps[0].id, 'p1', NOW);

      // 设置为军师
      const updated = allianceSys.setRole(ally, 'p1', 'p2', AllianceRole.ADVISOR);
      const member = updated.members['p2'];
      assertStrict(member.role === AllianceRole.ADVISOR, 'FLOW-21-10',
        `角色应为ADVISOR，实际: ${member.role}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 联盟捐献（FLOW-21-11 ~ FLOW-21-15）
  // ═══════════════════════════════════════════════════════════

  describe('3. 联盟捐献', () => {

    it(accTest('FLOW-21-11', '联盟捐献 — 记录贡献值'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id });

      const result = taskSys.recordContribution(alliance, ps, 'p1', 100);

      assertStrict(result.playerState.guildCoins === 100, 'FLOW-21-11',
        `公会币应为100，实际: ${result.playerState.guildCoins}`);
      assertStrict(result.playerState.dailyContribution === 100, 'FLOW-21-11',
        `日贡献应为100，实际: ${result.playerState.dailyContribution}`);
    });

    it(accTest('FLOW-21-12', '联盟捐献 — 联盟经验增长'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      const upgraded = allianceSys.addExperience(alliance, 500);
      assertStrict(upgraded.experience === 500, 'FLOW-21-12',
        `经验应为500，实际: ${upgraded.experience}`);
    });

    it(accTest('FLOW-21-13', '联盟捐献 — 经验升级'), () => {
      const { alliance } = createTestAlliance(allianceSys);

      // 1→2 需要1000经验
      const upgraded = allianceSys.addExperience(alliance, 1000);
      assertStrict(upgraded.level === 2, 'FLOW-21-13',
        `1000经验应升到2级，实际: ${upgraded.level}`);
    });

    it(accTest('FLOW-21-14', '联盟捐献 — 成员累计贡献'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id });

      // 第一次捐献
      let result = taskSys.recordContribution(alliance, ps, 'p1', 50);
      // 第二次捐献
      result = taskSys.recordContribution(result.alliance, result.playerState, 'p1', 30);

      const member = result.alliance.members['p1'];
      assertStrict(member.totalContribution === 80, 'FLOW-21-14',
        `累计贡献应为80，实际: ${member.totalContribution}`);
    });

    it(accTest('FLOW-21-15', '联盟捐献 — 每日重置清零日贡献'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id, dailyContribution: 100 });

      const result = allianceSys.dailyReset(alliance, ps);
      assertStrict(result.playerState.dailyContribution === 0, 'FLOW-21-15',
        `重置后日贡献应为0，实际: ${result.playerState.dailyContribution}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 联盟任务（FLOW-21-16 ~ FLOW-21-20）
  // ═══════════════════════════════════════════════════════════

  describe('4. 联盟任务', () => {

    it(accTest('FLOW-21-16', '联盟任务 — 每日刷新生成任务'), () => {
      const tasks = taskSys.dailyRefresh();
      assertStrict(tasks.length === DEFAULT_TASK_CONFIG.dailyTaskCount, 'FLOW-21-16',
        `应有${DEFAULT_TASK_CONFIG.dailyTaskCount}个任务，实际: ${tasks.length}`);

      for (const task of tasks) {
        assertStrict(task.status === AllianceTaskStatus.ACTIVE, 'FLOW-21-16',
          `任务应为ACTIVE状态，实际: ${task.status}`);
        assertStrict(task.currentProgress === 0, 'FLOW-21-16',
          `初始进度应为0，实际: ${task.currentProgress}`);
      }
    });

    it(accTest('FLOW-21-17', '联盟任务 — 更新任务进度'), () => {
      taskSys.dailyRefresh();
      const tasks = taskSys.getActiveTasks();
      const firstTaskDefId = tasks[0].defId;

      const updated = taskSys.updateProgress(firstTaskDefId, 5);
      assertStrict(!!updated, 'FLOW-21-17', '应返回更新后的任务');
      assertStrict(updated!.currentProgress === 5, 'FLOW-21-17',
        `进度应为5，实际: ${updated!.currentProgress}`);
    });

    it(accTest('FLOW-21-18', '联盟任务 — 完成任务自动标记'), () => {
      taskSys.dailyRefresh();
      const tasks = taskSys.getActiveTasks();
      const firstTaskDefId = tasks[0].defId;
      const def = taskSys.getTaskDef(firstTaskDefId);
      assertStrict(!!def, 'FLOW-21-18', '任务定义应存在');

      // 一次性完成
      taskSys.updateProgress(firstTaskDefId, def!.targetCount);

      const progress = taskSys.getTaskProgress(firstTaskDefId);
      assertStrict(progress!.status === AllianceTaskStatus.COMPLETED, 'FLOW-21-18',
        `任务应已完成，实际: ${progress!.status}`);
    });

    it(accTest('FLOW-21-19', '联盟任务 — 领取任务奖励'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id, guildCoins: 0 });

      taskSys.dailyRefresh();
      const tasks = taskSys.getActiveTasks();
      const firstTaskDefId = tasks[0].defId;
      const def = taskSys.getTaskDef(firstTaskDefId);

      // 完成任务
      taskSys.updateProgress(firstTaskDefId, def!.targetCount);

      // 领取奖励
      const result = taskSys.claimTaskReward(firstTaskDefId, alliance, ps, 'p1');
      assertStrict(result.coinGained === def!.guildCoinReward, 'FLOW-21-19',
        `应获得${def!.guildCoinReward}公会币，实际: ${result.coinGained}`);
      assertStrict(result.expGained === def!.allianceExpReward, 'FLOW-21-19',
        `应获得${def!.allianceExpReward}联盟经验，实际: ${result.expGained}`);
    });

    it(accTest('FLOW-21-20', '联盟任务 — 任务池包含多种类型'), () => {
      assertStrict(ALLIANCE_TASK_POOL.length >= 8, 'FLOW-21-20',
        `任务池应有至少8个任务，实际: ${ALLIANCE_TASK_POOL.length}`);

      const sharedTasks = ALLIANCE_TASK_POOL.filter(t => t.taskType === AllianceTaskType.SHARED);
      const personalTasks = ALLIANCE_TASK_POOL.filter(t => t.taskType === AllianceTaskType.PERSONAL);

      assertStrict(sharedTasks.length > 0, 'FLOW-21-20', '应有共享任务');
      assertStrict(personalTasks.length > 0, 'FLOW-21-20', '应有个人任务');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 联盟Boss与商店（FLOW-21-21 ~ FLOW-21-25）
  // ═══════════════════════════════════════════════════════════

  describe('5. 联盟Boss与商店', () => {

    it(accTest('FLOW-21-21', '联盟Boss — Boss生成与属性正确'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const boss = bossSys.getCurrentBoss(alliance);

      assertStrict(boss.level === alliance.level, 'FLOW-21-21',
        `Boss等级应等于联盟等级，实际: ${boss.level}`);
      assertStrict(boss.maxHp === DEFAULT_BOSS_CONFIG.baseHp, 'FLOW-21-21',
        `1级Boss HP应为${DEFAULT_BOSS_CONFIG.baseHp}，实际: ${boss.maxHp}`);
      assertStrict(boss.status === BossStatus.ALIVE, 'FLOW-21-21',
        `Boss应为存活状态，实际: ${boss.status}`);
    });

    it(accTest('FLOW-21-22', '联盟Boss — 挑战Boss造成伤害'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id });
      const boss = bossSys.getCurrentBoss(alliance);

      const result = bossSys.challengeBoss(boss, alliance, ps, 'p1', 10000);
      assertStrict(result.result.damage === 10000, 'FLOW-21-22',
        `伤害应为10000，实际: ${result.result.damage}`);
      assertStrict(result.result.guildCoinReward === DEFAULT_BOSS_CONFIG.participationGuildCoin, 'FLOW-21-22',
        `参与奖应为${DEFAULT_BOSS_CONFIG.participationGuildCoin}公会币`);
      assertStrict(result.playerState.dailyBossChallenges === 1, 'FLOW-21-22',
        `挑战次数应为1，实际: ${result.playerState.dailyBossChallenges}`);
    });

    it(accTest('FLOW-21-23', '联盟商店 — 商品列表正确'), () => {
      const items = shopSys.getAllItems();
      assertStrict(items.length === DEFAULT_ALLIANCE_SHOP_ITEMS.length, 'FLOW-21-23',
        `应有${DEFAULT_ALLIANCE_SHOP_ITEMS.length}个商品，实际: ${items.length}`);
    });

    it(accTest('FLOW-21-24', '联盟商店 — 按等级解锁商品'), () => {
      const available = shopSys.getAvailableShopItems(1);
      const level1Items = DEFAULT_ALLIANCE_SHOP_ITEMS.filter(i => i.requiredAllianceLevel <= 1);
      assertStrict(available.length === level1Items.length, 'FLOW-21-24',
        `1级应解锁${level1Items.length}个商品，实际: ${available.length}`);
    });

    it(accTest('FLOW-21-25', '联盟商店 — 购买商品扣除公会币'), () => {
      const ps = createPlayerState({ guildCoins: 1000 });

      const available = shopSys.getAvailableShopItems(1);
      assertStrict(available.length > 0, 'FLOW-21-25', '应有可购买商品');

      const item = available[0];
      const result = shopSys.buyShopItem(ps, item.id, 1);
      assertStrict(result.guildCoins === 1000 - item.guildCoinCost, 'FLOW-21-25',
        `余额应为${1000 - item.guildCoinCost}，实际: ${result.guildCoins}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 苏格拉底边界（FLOW-21-26 ~ FLOW-21-35）
  // ═══════════════════════════════════════════════════════════

  describe('6. 苏格拉底边界', () => {

    it(accTest('FLOW-21-26', '边界 — 联盟名称长度限制'), () => {
      const ps = createPlayerState();

      // 名称太短
      let threw = false;
      try {
        allianceSys.createAlliance(ps, 'A', '宣言', 'p1', '玩家', NOW);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('长度'), 'FLOW-21-26',
          `错误应包含"长度"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-26', '名称太短应抛异常');

      // 名称太长
      threw = false;
      try {
        allianceSys.createAlliance(ps, '一二三四五六七八九', '宣言', 'p1', '玩家', NOW);
      } catch (e: any) {
        threw = true;
      }
      assertStrict(threw, 'FLOW-21-26', '名称太长应抛异常');
    });

    it(accTest('FLOW-21-27', '边界 — 已在联盟中不可创建'), () => {
      const ps = createPlayerState({ allianceId: 'existing-ally' });

      let threw = false;
      try {
        allianceSys.createAlliance(ps, '新联盟', '宣言', 'p1', '玩家', NOW);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('已在联盟'), 'FLOW-21-27',
          `错误应包含"已在联盟"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-27', '已在联盟应抛异常');
    });

    it(accTest('FLOW-21-28', '边界 — 盟主不可直接退出'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id });

      let threw = false;
      try {
        allianceSys.leaveAlliance(alliance, ps, 'p1');
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('转让'), 'FLOW-21-28',
          `错误应包含"转让"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-28', '盟主退出应抛异常');
    });

    it(accTest('FLOW-21-29', '边界 — 公会币不足购买失败'), () => {
      const ps = createPlayerState({ guildCoins: 0 });

      let threw = false;
      try {
        const items = shopSys.getAvailableShopItems(1);
        shopSys.buyShopItem(ps, items[0].id, 1);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('不足'), 'FLOW-21-29',
          `错误应包含"不足"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-29', '公会币不足应抛异常');
    });

    it(accTest('FLOW-21-30', '边界 — Boss已击杀不可挑战'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id });

      // 模拟Boss已被击杀
      const killedAlliance = { ...alliance, bossKilledToday: true };
      const boss = bossSys.getCurrentBoss(killedAlliance);

      let threw = false;
      try {
        bossSys.challengeBoss(boss, killedAlliance, ps, 'p1', 1000);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('已被击杀'), 'FLOW-21-30',
          `错误应包含"已被击杀"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-30', 'Boss已击杀应抛异常');
    });

    it(accTest('FLOW-21-31', '边界 — 重复申请抛异常'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState();

      // 第一次申请
      const withApp = allianceSys.applyToJoin(alliance, ps, 'p2', '关羽', 5000, NOW);

      // 第二次申请
      let threw = false;
      try {
        allianceSys.applyToJoin(withApp, ps, 'p2', '关羽', 5000, NOW);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('已提交'), 'FLOW-21-31',
          `错误应包含"已提交"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-31', '重复申请应抛异常');
    });

    it(accTest('FLOW-21-32', '边界 — 序列化/反序列化保持状态'), () => {
      const { alliance, playerState } = createTestAlliance(allianceSys);

      const saveData = allianceSys.serialize(playerState, alliance);
      assertStrict(saveData.version === ALLIANCE_SAVE_VERSION, 'FLOW-21-32',
        `版本应为${ALLIANCE_SAVE_VERSION}，实际: ${saveData.version}`);

      const restored = allianceSys.deserialize(saveData);
      assertStrict(restored.playerState.allianceId === alliance.id, 'FLOW-21-32',
        '恢复后联盟ID应一致');
      assertStrict(!!restored.alliance, 'FLOW-21-32', '恢复后联盟应存在');
      assertStrict(restored.alliance!.name === '测试联盟', 'FLOW-21-32',
        `恢复后名称应一致，实际: ${restored.alliance!.name}`);
    });

    it(accTest('FLOW-21-33', '边界 — 未完成任务不可领取奖励'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState({ allianceId: alliance.id });

      taskSys.dailyRefresh();
      const tasks = taskSys.getActiveTasks();
      const firstTaskDefId = tasks[0].defId;

      let threw = false;
      try {
        taskSys.claimTaskReward(firstTaskDefId, alliance, ps, 'p1');
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('未完成'), 'FLOW-21-33',
          `错误应包含"未完成"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-33', '未完成任务领取应抛异常');
    });

    it(accTest('FLOW-21-34', '边界 — 联盟搜索功能'), () => {
      const alliances: AllianceData[] = [];
      const ps1 = createPlayerState();
      const ps2 = createPlayerState();
      alliances.push(allianceSys.createAlliance(ps1, '蜀汉联盟', '宣言', 'p1', '刘备', NOW).alliance);
      alliances.push(allianceSys.createAlliance(ps2, '魏武联盟', '宣言', 'p2', '曹操', NOW).alliance);

      const result = allianceSys.searchAlliance(alliances, '蜀汉');
      assertStrict(result.length === 1, 'FLOW-21-34',
        `搜索蜀汉应返回1个结果，实际: ${result.length}`);
      assertStrict(result[0].name === '蜀汉联盟', 'FLOW-21-34',
        `结果应为蜀汉联盟，实际: ${result[0].name}`);
    });

    it(accTest('FLOW-21-35', '边界 — 非成员不可捐献'), () => {
      const { alliance } = createTestAlliance(allianceSys);
      const ps = createPlayerState();

      let threw = false;
      try {
        taskSys.recordContribution(alliance, ps, 'non-member', 100);
      } catch (e: any) {
        threw = true;
        assertStrict(e.message.includes('不是联盟成员'), 'FLOW-21-35',
          `错误应包含"不是联盟成员"，实际: ${e.message}`);
      }
      assertStrict(threw, 'FLOW-21-35', '非成员捐献应抛异常');
    });
  });
});
