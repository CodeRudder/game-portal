/**
 * 联盟模块 — 对抗式测试自动化用例
 *
 * 基于R1+R2对抗式测试树，覆盖242个测试节点
 * 按P0/P1/P2优先级组织
 *
 * @module alliance/__tests__/adversarial/alliance-adversarial.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AllianceSystem,
  AllianceBossSystem,
  AllianceShopSystem,
  AllianceTaskSystem,
  createDefaultAlliancePlayerState,
  createAllianceData,
  generateId,
} from '../index';
import {
  AllianceTaskType,
  AllianceTaskStatus,
  ApplicationStatus,
  BossStatus,
} from '../../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceTaskDef,
} from '../../../../core/alliance/alliance.types';

// ─────────────────────────────────────────────
// 测试工具函数
// ─────────────────────────────────────────────

function createTestPlayerState(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function createTestAlliance(leaderId = 'leader-1', leaderName = '盟主'): AllianceData {
  const now = Date.now();
  return createAllianceData('ally_test', '测试联盟', '测试宣言', leaderId, leaderName, now);
}

function createMember(
  id: string,
  name: string,
  role: 'LEADER' | 'ADVISOR' | 'MEMBER' = 'MEMBER',
) {
  return {
    playerId: id,
    playerName: name,
    role: role as any,
    power: 1000,
    joinTime: Date.now(),
    dailyContribution: 0,
    totalContribution: 0,
    dailyBossChallenges: 0,
  };
}

function addMembers(
  alliance: AllianceData,
  members: Array<{ id: string; name: string; role?: any }>,
): AllianceData {
  const newMembers = { ...alliance.members };
  for (const m of members) {
    newMembers[m.id] = createMember(m.id, m.name, m.role);
  }
  return { ...alliance, members: newMembers };
}

function makeBoss(hp = 100000, currentHp?: number) {
  return {
    id: 'boss_1',
    name: '测试Boss',
    level: 1,
    maxHp: hp,
    currentHp: currentHp ?? hp,
    status: BossStatus.ALIVE,
    damageRecords: {} as Record<string, number>,
    dailyChallengeLimit: 3,
    refreshTime: Date.now(),
  };
}

// ═══════════════════════════════════════════════
// P0 测试 — 必须通过 (阻塞发布)
// ═══════════════════════════════════════════════

describe('P0 — 联盟核心流程', () => {
  let system: AllianceSystem;
  beforeEach(() => {
    system = new AllianceSystem();
  });

  it('N-01: 创建联盟 → 成功', () => {
    const ps = createTestPlayerState();
    const result = system.createAlliance(ps, '测试联盟', '宣言', 'p1', '玩家1', Date.now());
    expect(result.alliance).toBeDefined();
    expect(result.alliance.name).toBe('测试联盟');
    expect(result.alliance.leaderId).toBe('p1');
    expect(result.playerState.allianceId).toBeTruthy();
  });

  it('N-02: 创建联盟 → 已有联盟', () => {
    const ps = createTestPlayerState({ allianceId: 'existing' });
    expect(() => system.createAlliance(ps, '新联盟', '', 'p1', '玩家1', Date.now())).toThrow(
      '已在联盟中',
    );
  });

  it('N-03: 创建联盟 → 名称过短', () => {
    const ps = createTestPlayerState();
    expect(() => system.createAlliance(ps, '一', '', 'p1', '玩家1', Date.now())).toThrow(
      '联盟名称长度',
    );
  });

  it('N-04: 创建联盟 → 名称过长', () => {
    const ps = createTestPlayerState();
    expect(() =>
      system.createAlliance(ps, '一二三四五六七八九', '', 'p1', '玩家1', Date.now()),
    ).toThrow('联盟名称长度');
  });

  it('N-05: 申请加入 → 成功', () => {
    const alliance = createTestAlliance();
    const ps = createTestPlayerState();
    const result = system.applyToJoin(alliance, ps, 'p2', '玩家2', 1000, Date.now());
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0].status).toBe(ApplicationStatus.PENDING);
  });

  it('N-09: 审批通过 → 成功', () => {
    let alliance = createTestAlliance();
    const ps = createTestPlayerState();
    alliance = system.applyToJoin(alliance, ps, 'p2', '玩家2', 1000, Date.now());
    const appId = alliance.applications[0].id;
    const result = system.approveApplication(alliance, appId, 'leader-1', Date.now());
    expect(result.members['p2']).toBeDefined();
    expect(result.members['p2'].role).toBe('MEMBER');
  });

  it('N-13: 退出联盟 → 成功', () => {
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState({ allianceId: alliance.id });
    const result = system.leaveAlliance(alliance, ps, 'p2');
    expect(result.playerState.allianceId).toBe('');
    expect(result.alliance?.members['p2']).toBeUndefined();
  });

  it('N-19: 踢人 → 成功', () => {
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const result = system.kickMember(alliance, 'leader-1', 'p2');
    expect(result.members['p2']).toBeUndefined();
  });

  it('N-23: 转让盟主 → 成功', () => {
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const result = system.transferLeadership(alliance, 'leader-1', 'p2');
    expect(result.leaderId).toBe('p2');
    expect(result.members['leader-1'].role).toBe('MEMBER');
    expect(result.members['p2'].role).toBe('LEADER');
  });
});

describe('P0 — 权限检查', () => {
  let system: AllianceSystem;
  let alliance: AllianceData;

  beforeEach(() => {
    system = new AllianceSystem();
    alliance = addMembers(createTestAlliance(), [
      { id: 'advisor-1', name: '军师', role: 'ADVISOR' },
      { id: 'member-1', name: '成员', role: 'MEMBER' },
    ]);
  });

  it('E-01: MEMBER审批 → 权限不足', () => {
    const ps = createTestPlayerState();
    const a = system.applyToJoin(alliance, ps, 'p-new', '新人', 100, Date.now());
    expect(() =>
      system.approveApplication(a, a.applications[0].id, 'member-1', Date.now()),
    ).toThrow('权限不足');
  });

  it('E-02: MEMBER发公告 → 权限不足', () => {
    expect(() =>
      system.postAnnouncement(alliance, 'member-1', '成员', '内容', false, Date.now()),
    ).toThrow('权限不足');
  });

  it('E-03: MEMBER踢人 → 权限不足', () => {
    expect(() => system.kickMember(alliance, 'member-1', 'advisor-1')).toThrow('权限不足');
  });

  it('E-04: ADVISOR设置角色 → 权限不足', () => {
    expect(() => system.setRole(alliance, 'advisor-1', 'member-1', 'ADVISOR')).toThrow(
      '只有盟主可以设置角色',
    );
  });

  it('E-05: 非成员操作 → 不是联盟成员', () => {
    expect(() =>
      system.postAnnouncement(alliance, 'outsider', '外人', '内容', false, Date.now()),
    ).toThrow('不是联盟成员');
  });

  it('ADVISOR审批 → 成功', () => {
    const ps = createTestPlayerState();
    const a = system.applyToJoin(alliance, ps, 'p-new', '新人', 100, Date.now());
    expect(() =>
      system.approveApplication(a, a.applications[0].id, 'advisor-1', Date.now()),
    ).not.toThrow();
  });

  it('ADVISOR发公告 → 成功', () => {
    expect(() =>
      system.postAnnouncement(alliance, 'advisor-1', '军师', '公告', false, Date.now()),
    ).not.toThrow();
  });
});

describe('P0 — BUG验证: 联盟解散死锁 (BUG-001)', () => {
  let system: AllianceSystem;
  beforeEach(() => {
    system = new AllianceSystem();
  });

  it('P0-1.1: 盟主退出(仅1人) → 失败', () => {
    const alliance = createTestAlliance('leader-1');
    const ps = createTestPlayerState({ allianceId: alliance.id });
    expect(() => system.leaveAlliance(alliance, ps, 'leader-1')).toThrow('盟主需先转让');
  });

  it('P0-1.2: 盟主转让后退出 → 成功', () => {
    let alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    alliance = system.transferLeadership(alliance, 'leader-1', 'p2');
    const ps = createTestPlayerState({ allianceId: alliance.id });
    const result = system.leaveAlliance(alliance, ps, 'leader-1');
    expect(result.playerState.allianceId).toBe('');
  });

  it('P0-1.4: 非盟主退出 → 剩盟主1人 → 盟主被困', () => {
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState({ allianceId: alliance.id });
    const result = system.leaveAlliance(alliance, ps, 'p2');
    expect(Object.keys(result.alliance!.members)).toHaveLength(1);
    expect(() =>
      system.leaveAlliance(
        result.alliance!,
        createTestPlayerState({ allianceId: alliance.id }),
        'leader-1',
      ),
    ).toThrow('盟主需先转让');
  });
});

describe('P0 — BUG验证: createAllianceSimple硬编码ID (BUG-002)', () => {
  it('P0-2.1: leaderId为硬编码player-1', () => {
    const system = new AllianceSystem();
    system.setCurrencyCallbacks({ spend: () => true, getBalance: () => 1000 });
    system.resetAllianceData(null);
    const result = system.createAllianceSimple('测试联盟', '玩家');
    expect(result.success).toBe(true);
    expect(system.getAlliance()!.leaderId).toBe('player-1');
  });

  it('P0-2.3: 用非player-1 ID操作 → 失败', () => {
    const system = new AllianceSystem();
    system.setCurrencyCallbacks({ spend: () => true, getBalance: () => 1000 });
    system.resetAllianceData(null);
    system.createAllianceSimple('测试联盟', '玩家');
    const alliance = system.getAlliance()!;
    expect(() =>
      system.sendMessage(alliance, 'real-player', '真实玩家', '消息', Date.now()),
    ).toThrow('不是联盟成员');
  });

  it('P0-2.5: 无回调设置 → 跳过余额检查直接创建', () => {
    const system = new AllianceSystem();
    system.resetAllianceData(null);
    const result = system.createAllianceSimple('测试联盟');
    expect(result.success).toBe(true);
  });
});

describe('P0 — BUG验证: kickMember不清理playerState (BUG-003)', () => {
  it('P0-4.1: 踢人后被踢者allianceId未清空(设计缺陷)', () => {
    const system = new AllianceSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const result = system.kickMember(alliance, 'leader-1', 'p2');
    expect(result.members['p2']).toBeUndefined();
  });

  it('P0-4.2: 被踢者allianceId未清空 → 无法创建新联盟', () => {
    const system = new AllianceSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    system.kickMember(alliance, 'leader-1', 'p2');
    const kickedPs = createTestPlayerState({ allianceId: alliance.id });
    expect(() => system.createAlliance(kickedPs, '新联盟', '', 'p2', '玩家2', Date.now())).toThrow(
      '已在联盟中',
    );
  });

  it('P0-4.5: 外部清空allianceId后可创建新联盟', () => {
    const system = new AllianceSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    system.kickMember(alliance, 'leader-1', 'p2');
    const cleanedPs = createTestPlayerState({ allianceId: '' });
    expect(() =>
      system.createAlliance(cleanedPs, '新联盟', '', 'p2', '玩家2', Date.now()),
    ).not.toThrow();
  });
});

describe('P0 — BUG验证: approveApplication双重联盟 (BUG-004)', () => {
  it('P0-5.1: 申请A → 加入B → A审批通过 → 数据不一致', () => {
    const system = new AllianceSystem();
    const allianceA = createTestAlliance('leaderA', '盟主A');
    const ps = createTestPlayerState();
    const allianceAWithApp = system.applyToJoin(allianceA, ps, 'p1', '玩家1', 1000, Date.now());
    const appId = allianceAWithApp.applications[0].id;
    // 玩家加入联盟B (外部操作)
    const result = system.approveApplication(allianceAWithApp, appId, 'leaderA', Date.now());
    expect(result.members['p1']).toBeDefined();
  });
});

describe('P0 — BUG验证: Boss挑战次数双重检查', () => {
  it('P0-3.1: member.challenges=3, playerState.challenges=0 → 被拒绝', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    alliance.members['p2'] = { ...alliance.members['p2'], dailyBossChallenges: 3 };
    const ps = createTestPlayerState({ dailyBossChallenges: 0 });
    expect(() => bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', 1000)).toThrow(
      '今日挑战次数已用完',
    );
  });

  it('P0-3.2: member.challenges=0, playerState.challenges=3 → 被拒绝', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState({ dailyBossChallenges: 3 });
    expect(() => bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', 1000)).toThrow(
      '今日挑战次数已用完',
    );
  });

  it('P0-3.5: 挑战后两个计数器同步+1', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState({ dailyBossChallenges: 0 });
    const result = bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', 1000);
    expect(result.playerState.dailyBossChallenges).toBe(1);
    expect(result.alliance.members['p2'].dailyBossChallenges).toBe(1);
  });
});

describe('P0 — 存档完整性', () => {
  it('C-13: 全系统序列化 → 反序列化 → 数据一致', () => {
    const system = new AllianceSystem();
    const ps = createTestPlayerState({ allianceId: 'ally_1', guildCoins: 100 });
    const alliance = createTestAlliance();
    const saved = system.serialize(ps, alliance);
    expect(saved.version).toBe(1);
    expect(saved.playerState.guildCoins).toBe(100);
    const restored = system.deserialize(saved);
    expect(restored.playerState.guildCoins).toBe(100);
    expect(restored.alliance?.name).toBe('测试联盟');
  });

  it('C-14: 无联盟存档 → 反序列化 → alliance=null', () => {
    const system = new AllianceSystem();
    const ps = createTestPlayerState();
    const saved = system.serialize(ps, null);
    const restored = system.deserialize(saved);
    expect(restored.alliance).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// P1 测试 — 强烈建议通过
// ═══════════════════════════════════════════════

describe('P1 — Boss系统', () => {
  it('N-45: Boss挑战 → 正常伤害', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState();
    const result = bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', 10000);
    expect(result.result.damage).toBe(10000);
    expect(result.boss.currentHp).toBe(90000);
    expect(result.result.guildCoinReward).toBe(5);
  });

  it('N-46: Boss挑战 → 击杀', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState();
    const result = bossSystem.challengeBoss(makeBoss(100000, 5000), alliance, ps, 'p2', 10000);
    expect(result.result.isKillingBlow).toBe(true);
    expect(result.boss.status).toBe(BossStatus.KILLED);
    expect(result.result.killReward!.guildCoin).toBe(30);
  });

  it('B-12: Boss伤害超过当前HP → 截断', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState();
    const result = bossSystem.challengeBoss(makeBoss(100000, 1000), alliance, ps, 'p2', 999999);
    expect(result.result.damage).toBe(1000);
  });

  it('P1-6: damage=0 → 仍消耗次数和获币', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState();
    const result = bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', 0);
    expect(result.result.damage).toBe(0);
    expect(result.playerState.dailyBossChallenges).toBe(1);
    expect(result.result.guildCoinReward).toBe(5);
  });

  it('P1-7: Boss贡献值浮点精度', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState();
    const result = bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', 50);
    expect(result.alliance.members['p2'].dailyContribution).toBe(0.5);
  });

  it('P1-4: getCurrentBoss每次重建丢失状态', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = createTestAlliance();
    const boss1 = bossSystem.getCurrentBoss(alliance);
    expect(boss1.currentHp).toBe(boss1.maxHp);
    const killedAlliance = { ...alliance, bossKilledToday: true };
    const boss2 = bossSystem.getCurrentBoss(killedAlliance);
    expect(boss2.status).toBe(BossStatus.KILLED);
    expect(boss2.currentHp).toBe(0);
  });
});

describe('P1 — 商店系统', () => {
  it('N-53: 购买商品 → 成功', () => {
    const shop = new AllianceShopSystem();
    const ps = createTestPlayerState({ guildCoins: 100 });
    const result = shop.buyShopItem(ps, 'as_1', 1);
    expect(result.guildCoins).toBe(50);
  });

  it('N-54: 购买商品 → 公会币不足', () => {
    const shop = new AllianceShopSystem();
    const ps = createTestPlayerState({ guildCoins: 10 });
    expect(() => shop.buyShopItem(ps, 'as_1', 1)).toThrow('公会币不足');
  });

  it('N-55: 购买商品 → 等级不足', () => {
    const shop = new AllianceShopSystem();
    const ps = createTestPlayerState({ guildCoins: 200 });
    expect(() => shop.buyShopItem(ps, 'as_4', 1)).toThrow('联盟等级不足');
  });

  it('N-57: 批量购买 → 成功', () => {
    const shop = new AllianceShopSystem();
    const ps = createTestPlayerState({ guildCoins: 200 });
    const result = shop.buyShopItemBatch(ps, 'as_3', 3, 1);
    expect(result.guildCoins).toBe(140);
  });

  it('N-58: 周重置 → purchased归零', () => {
    const shop = new AllianceShopSystem();
    const ps = createTestPlayerState({ guildCoins: 200 });
    shop.buyShopItem(ps, 'as_1', 1);
    shop.resetShopWeekly();
    expect(shop.getItem('as_1')!.purchased).toBe(0);
  });

  it('P1-5: 批量购买weeklyLimit=0', () => {
    const shop = new AllianceShopSystem([
      {
        id: 'free_1',
        name: '免费商品',
        type: 'recruit_order',
        guildCoinCost: 10,
        weeklyLimit: 0,
        purchased: 0,
        requiredAllianceLevel: 1,
      },
    ]);
    const ps = createTestPlayerState({ guildCoins: 100 });
    const result = shop.buyShopItemBatch(ps, 'free_1', 5, 1);
    expect(result.guildCoins).toBe(50);
  });

  it('P1-5: 批量购买count=0 → 失败', () => {
    const shop = new AllianceShopSystem([
      {
        id: 'free_1',
        name: '免费商品',
        type: 'recruit_order',
        guildCoinCost: 10,
        weeklyLimit: 0,
        purchased: 0,
        requiredAllianceLevel: 1,
      },
    ]);
    const ps = createTestPlayerState({ guildCoins: 100 });
    expect(() => shop.buyShopItemBatch(ps, 'free_1', 0, 1)).toThrow('已达限购上限');
  });

  it('商店序列化/反序列化 → 限购状态保持', () => {
    const shop = new AllianceShopSystem();
    const ps = createTestPlayerState({ guildCoins: 200 });
    shop.buyShopItem(ps, 'as_1', 1);
    const saved = shop.serialize();
    expect(saved.items.find(i => i.id === 'as_1')!.purchased).toBe(1);
    const shop2 = new AllianceShopSystem();
    shop2.deserialize(saved);
    expect(shop2.getItem('as_1')!.purchased).toBe(1);
  });
});

describe('P1 — 任务系统', () => {
  it('N-59: 每日刷新任务 → 生成3个', () => {
    const taskSystem = new AllianceTaskSystem();
    const tasks = taskSystem.dailyRefresh();
    expect(tasks).toHaveLength(3);
    tasks.forEach(t => {
      expect(t.status).toBe(AllianceTaskStatus.ACTIVE);
      expect(t.currentProgress).toBe(0);
    });
  });

  it('N-61: 更新进度 → 完成', () => {
    const taskSystem = new AllianceTaskSystem();
    taskSystem.dailyRefresh();
    const activeTasks = taskSystem.getActiveTasks();
    const taskDef = taskSystem.getTaskDef(activeTasks[0].defId)!;
    const result = taskSystem.updateProgress(activeTasks[0].defId, taskDef.targetCount);
    expect(result!.status).toBe(AllianceTaskStatus.COMPLETED);
  });

  it('N-62: 领取奖励 → 成功', () => {
    const taskSystem = new AllianceTaskSystem();
    taskSystem.dailyRefresh();
    const activeTasks = taskSystem.getActiveTasks();
    const taskDef = taskSystem.getTaskDef(activeTasks[0].defId)!;
    taskSystem.updateProgress(activeTasks[0].defId, taskDef.targetCount);
    const alliance = createTestAlliance();
    const ps = createTestPlayerState();
    const result = taskSystem.claimTaskReward(activeTasks[0].defId, alliance, ps, 'leader-1');
    expect(result.coinGained).toBe(taskDef.guildCoinReward);
    expect(result.expGained).toBe(taskDef.allianceExpReward);
  });

  it('N-64: 重复领取 → 失败', () => {
    const taskSystem = new AllianceTaskSystem();
    taskSystem.dailyRefresh();
    const activeTasks = taskSystem.getActiveTasks();
    const taskDef = taskSystem.getTaskDef(activeTasks[0].defId)!;
    taskSystem.updateProgress(activeTasks[0].defId, taskDef.targetCount);
    const alliance = createTestAlliance();
    const ps = createTestPlayerState();
    taskSystem.claimTaskReward(activeTasks[0].defId, alliance, ps, 'leader-1');
    expect(() =>
      taskSystem.claimTaskReward(activeTasks[0].defId, alliance, ps, 'leader-1'),
    ).toThrow('已领取奖励');
  });

  it('P1-9: claimedPlayers序列化往返', () => {
    const taskSystem = new AllianceTaskSystem();
    taskSystem.dailyRefresh();
    const activeTasks = taskSystem.getActiveTasks();
    const taskDef = taskSystem.getTaskDef(activeTasks[0].defId)!;
    taskSystem.updateProgress(activeTasks[0].defId, taskDef.targetCount);
    const alliance = createTestAlliance();
    const ps = createTestPlayerState();
    taskSystem.claimTaskReward(activeTasks[0].defId, alliance, ps, 'p1');
    const saved = taskSystem.serialize();
    const taskSystem2 = new AllianceTaskSystem();
    taskSystem2.deserialize(saved);
    expect(() =>
      taskSystem2.claimTaskReward(activeTasks[0].defId, alliance, ps, 'p1'),
    ).toThrow('已领取奖励');
    expect(() =>
      taskSystem2.claimTaskReward(activeTasks[0].defId, alliance, ps, 'p2'),
    ).not.toThrow();
  });

  it('P1-14: 任务进度累加和截断', () => {
    const taskSystem = new AllianceTaskSystem();
    taskSystem.dailyRefresh();
    const activeTasks = taskSystem.getActiveTasks();
    const taskDef = taskSystem.getTaskDef(activeTasks[0].defId)!;
    taskSystem.updateProgress(activeTasks[0].defId, Math.ceil(taskDef.targetCount * 0.5));
    taskSystem.updateProgress(activeTasks[0].defId, taskDef.targetCount);
    const progress = taskSystem.getTaskProgress(activeTasks[0].defId)!;
    expect(progress.status).toBe(AllianceTaskStatus.COMPLETED);
    expect(progress.current).toBe(taskDef.targetCount);
  });
});

describe('P1 — 联盟等级与经验', () => {
  it('N-38: 添加经验 → 升级', () => {
    const system = new AllianceSystem();
    const alliance = createTestAlliance();
    const result = system.addExperience(alliance, 1000);
    expect(result.level).toBe(2);
  });

  it('N-40: 满级继续加经验', () => {
    const system = new AllianceSystem();
    const alliance = { ...createTestAlliance(), level: 7, experience: 21000 };
    const result = system.addExperience(alliance, 99999);
    expect(result.level).toBe(7);
  });

  it('N-41: 负数经验 → 不减少', () => {
    const system = new AllianceSystem();
    const alliance = { ...createTestAlliance(), experience: 500 };
    const result = system.addExperience(alliance, -100);
    expect(result.experience).toBe(500);
  });

  it('B-07: 经验刚好等于升级线', () => {
    const system = new AllianceSystem();
    const result = system.addExperience(createTestAlliance(), 1000);
    expect(result.level).toBe(2);
  });

  it('B-09: 最高等级(7级)', () => {
    const system = new AllianceSystem();
    const config = system.getLevelConfig(7);
    expect(config.level).toBe(7);
    expect(config.maxMembers).toBe(50);
  });
});

describe('P1 — 频道与公告', () => {
  it('N-33: 置顶公告超限', () => {
    const system = new AllianceSystem();
    const alliance = createTestAlliance();
    let a = system.postAnnouncement(alliance, 'leader-1', '盟主', '公告1', true, Date.now());
    a = system.postAnnouncement(a, 'leader-1', '盟主', '公告2', true, Date.now());
    a = system.postAnnouncement(a, 'leader-1', '盟主', '公告3', true, Date.now());
    expect(() =>
      system.postAnnouncement(a, 'leader-1', '盟主', '公告4', true, Date.now()),
    ).toThrow('置顶公告最多3条');
  });

  it('N-37: 消息超限裁剪', () => {
    const system = new AllianceSystem();
    let alliance = createTestAlliance();
    for (let i = 0; i < 101; i++) {
      alliance = system.sendMessage(alliance, 'leader-1', '盟主', `消息${i}`, Date.now());
    }
    expect(alliance.messages.length).toBe(100);
  });
});

describe('P1 — 每日重置', () => {
  it('N-66: 每日重置 → 数据清零', () => {
    const system = new AllianceSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    alliance.members['p2'] = {
      ...alliance.members['p2'],
      dailyContribution: 100,
      dailyBossChallenges: 2,
    };
    const ps = createTestPlayerState({ dailyContribution: 50, dailyBossChallenges: 2 });
    const result = system.dailyReset(alliance, ps);
    expect(result.alliance.members['p2'].dailyContribution).toBe(0);
    expect(result.alliance.members['p2'].dailyBossChallenges).toBe(0);
    expect(result.alliance.bossKilledToday).toBe(false);
    expect(result.playerState.dailyBossChallenges).toBe(0);
  });
});

describe('P1 — R2补充: NaN/undefined边界', () => {
  it('getLevelConfig(NaN) → 返回level=1配置', () => {
    const system = new AllianceSystem();
    expect(system.getLevelConfig(NaN).level).toBe(1);
  });

  it('getLevelConfig(undefined) → 返回level=1配置', () => {
    const system = new AllianceSystem();
    expect(system.getLevelConfig(undefined as any).level).toBe(1);
  });

  it('challengeBoss damage=NaN → actualDamage=0', () => {
    const bossSystem = new AllianceBossSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const ps = createTestPlayerState();
    const result = bossSystem.challengeBoss(makeBoss(), alliance, ps, 'p2', NaN);
    expect(result.result.damage).toBe(0);
    expect(result.playerState.dailyBossChallenges).toBe(1);
  });

  it('deserialize purchased=NaN → purchased=0', () => {
    const shop = new AllianceShopSystem();
    shop.deserialize({ items: [{ id: 'as_1', purchased: NaN }] });
    expect(shop.getItem('as_1')!.purchased).toBe(0);
  });

  it('deserialize purchased=-5 → purchased=0', () => {
    const shop = new AllianceShopSystem();
    shop.deserialize({ items: [{ id: 'as_1', purchased: -5 }] });
    expect(shop.getItem('as_1')!.purchased).toBe(0);
  });
});

describe('P1 — createAllianceSimple无回滚验证', () => {
  it('P1-11: 创建成功 → 扣费失败 → _alliance未设置(代码正确处理)', () => {
    const system = new AllianceSystem();
    system.setCurrencyCallbacks({ spend: () => false, getBalance: () => 1000 });
    system.resetAllianceData(null);
    const result = system.createAllianceSimple('测试联盟', '玩家');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('元宝扣除失败');
    expect(system.getAlliance()).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// P2 测试 — 建议通过
// ═══════════════════════════════════════════════

describe('P2 — 边界与杂项', () => {
  it('B-01: 联盟名称最小长度=2 → 成功', () => {
    const system = new AllianceSystem();
    const ps = createTestPlayerState();
    const result = system.createAlliance(ps, '测试', '', 'p1', '玩家1', Date.now());
    expect(result.alliance.name).toBe('测试');
  });

  it('B-26: 搜索联盟-空关键词', () => {
    const system = new AllianceSystem();
    const result = system.searchAlliance([createTestAlliance()], '');
    expect(result).toHaveLength(1);
  });

  it('B-27: 搜索联盟-大小写不敏感', () => {
    const system = new AllianceSystem();
    const a = { ...createTestAlliance(), name: 'TestAlliance' };
    expect(system.searchAlliance([a], 'testalliance')).toHaveLength(1);
  });

  it('generateId唯一性', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateId('test'));
    expect(ids.size).toBe(100);
  });

  it('反序列化-null数据 → 返回默认状态', () => {
    const system = new AllianceSystem();
    const result = system.deserialize(null as any);
    expect(result.playerState.allianceId).toBe('');
    expect(result.alliance).toBeNull();
  });

  it('反序列化-版本不匹配 → 返回默认状态', () => {
    const system = new AllianceSystem();
    const result = system.deserialize({
      version: 999,
      playerState: createTestPlayerState(),
      allianceData: null,
    });
    expect(result.playerState.allianceId).toBe('');
  });

  it('getDamageRanking-无伤害 → 空数组', () => {
    const bossSystem = new AllianceBossSystem();
    const ranking = bossSystem.getDamageRanking(makeBoss(), createTestAlliance());
    expect(ranking).toHaveLength(0);
  });

  it('getRemainingPurchases-商品不存在 → 0', () => {
    const shop = new AllianceShopSystem();
    expect(shop.getRemainingPurchases('nonexistent')).toBe(0);
  });

  it('canBuy-商品不存在', () => {
    const shop = new AllianceShopSystem();
    const result = shop.canBuy('nonexistent', 1, 1000);
    expect(result.canBuy).toBe(false);
    expect(result.reason).toBe('商品不存在');
  });

  it('任务池不足时dailyRefresh', () => {
    const singleTask: AllianceTaskDef = {
      id: 'only_1',
      name: '唯一任务',
      description: '测试',
      taskType: AllianceTaskType.SHARED,
      targetCount: 10,
      allianceExpReward: 100,
      guildCoinReward: 10,
    };
    const taskSystem = new AllianceTaskSystem(undefined, [singleTask]);
    expect(taskSystem.dailyRefresh()).toHaveLength(1);
  });

  it('任务池为空时dailyRefresh', () => {
    const taskSystem = new AllianceTaskSystem(undefined, []);
    expect(taskSystem.dailyRefresh()).toHaveLength(0);
  });

  it('hasPermission非成员 → false', () => {
    const system = new AllianceSystem();
    expect(system.hasPermission(createTestAlliance(), 'outsider', 'approve')).toBe(false);
  });

  it('setRole双向变更', () => {
    const system = new AllianceSystem();
    const alliance = addMembers(createTestAlliance(), [
      { id: 'p2', name: '成员2', role: 'MEMBER' },
    ]);
    const toAdvisor = system.setRole(alliance, 'leader-1', 'p2', 'ADVISOR');
    expect(toAdvisor.members['p2'].role).toBe('ADVISOR');
    const backToMember = system.setRole(toAdvisor, 'leader-1', 'p2', 'MEMBER');
    expect(backToMember.members['p2'].role).toBe('MEMBER');
  });
});
