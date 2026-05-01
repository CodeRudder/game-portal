/**
 * 联盟模块对抗式测试
 *
 * 覆盖子系统：
 *   A1: AllianceSystem       — 联盟创建/加入/退出/权限/等级/公告/消息
 *   A2: AllianceBossSystem   — Boss生成/挑战/伤害排行/奖励
 *   A3: AllianceTaskSystem   — 联盟任务生成/进度/完成/奖励
 *   A4: AllianceHelper       — 权限检查/搜索/序列化
 *   A5: alliance-constants   — ID生成/默认状态/联盟数据创建
 *
 * 5维度挑战：
 *   F-Normal:    正向流程（创建→加入→审批→退出→Boss→任务→奖励）
 *   F-Error:     异常路径（空名称/无效ID/NaN值/负数注入/不存在操作）
 *   F-Boundary:  边界条件（满员/名称长度/置顶上限/消息截断/挑战次数）
 *   F-Cross:     跨系统交互（联盟→Boss→任务→公会币→经验→等级→加成）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化/每日重置/版本兼容）
 *
 * @module tests/adversarial/alliance-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AllianceSystem } from '../../engine/alliance/AllianceSystem';
import { AllianceBossSystem, createBoss, DEFAULT_BOSS_CONFIG } from '../../engine/alliance/AllianceBossSystem';
import { AllianceTaskSystem, ALLIANCE_TASK_POOL, DEFAULT_TASK_CONFIG } from '../../engine/alliance/AllianceTaskSystem';
import * as AllianceHelper from '../../engine/alliance/AllianceHelper';
import {
  DEFAULT_CREATE_CONFIG, ALLIANCE_LEVEL_CONFIGS, ALLIANCE_SAVE_VERSION,
  createDefaultAlliancePlayerState, createAllianceData, generateId,
} from '../../engine/alliance/alliance-constants';
import {
  ApplicationStatus, AllianceRole, BossStatus, AllianceTaskStatus, AllianceTaskType,
} from '../../core/alliance/alliance.types';
import type {
  AllianceData, AlliancePlayerState, AllianceBoss,
} from '../../core/alliance/alliance.types';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

const NOW = 1_000_000;

function mockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function ps(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function mkAlliance(leaderId = 'p1', leaderName = '刘备', name = '蜀汉'): AllianceData {
  return createAllianceData('ally_1', name, '兴复汉室', leaderId, leaderName, NOW);
}

function mkAllianceWithMembers(): AllianceData {
  const a = mkAlliance();
  a.members['p2'] = { playerId: 'p2', playerName: '诸葛亮', role: AllianceRole.ADVISOR, power: 5000, joinTime: NOW, dailyContribution: 0, totalContribution: 100, dailyBossChallenges: 0 };
  a.members['p3'] = { playerId: 'p3', playerName: '关羽', role: AllianceRole.MEMBER, power: 3000, joinTime: NOW, dailyContribution: 0, totalContribution: 50, dailyBossChallenges: 0 };
  return a;
}

function mkFullAlliance(count: number): AllianceData {
  const a = mkAlliance('leader', '盟主', '满员盟');
  for (let i = 1; i < count; i++) {
    a.members[`m${i}`] = { playerId: `m${i}`, playerName: `成员${i}`, role: AllianceRole.MEMBER, power: 1000, joinTime: NOW, dailyContribution: 0, totalContribution: 0, dailyBossChallenges: 0 };
  }
  return a;
}

function addPendingApp(a: AllianceData, playerId = 'p4', playerName = '张飞'): AllianceData {
  return { ...a, applications: [...a.applications, { id: `app-${playerId}`, allianceId: a.id, playerId, playerName, power: 2000, timestamp: NOW, status: ApplicationStatus.PENDING }] };
}

function createSys() { const s = new AllianceSystem(); s.init(mockDeps()); return s; }
function createBossSys() { const s = new AllianceBossSystem(); s.init(mockDeps()); return s; }
function createTaskSys() { const s = new AllianceTaskSystem(); s.init(mockDeps()); return s; }

// ═══════════════════════════════════════════════
// F-Normal: 正向流程
// ═══════════════════════════════════════════════

describe('F-Normal: 联盟创建', () => {
  it('正常创建联盟，盟主自动成为成员', () => {
    const sys = createSys();
    const r = sys.createAlliance(ps(), '蜀汉', '兴复汉室', 'p1', '刘备', NOW);
    expect(r.alliance.name).toBe('蜀汉');
    expect(r.alliance.leaderId).toBe('p1');
    expect(r.alliance.level).toBe(1);
    expect(r.alliance.members['p1'].role).toBe(AllianceRole.LEADER);
    expect(r.playerState.allianceId).toBe(r.alliance.id);
    expect(r.alliance.applications).toEqual([]);
  });
});

describe('F-Normal: 加入→审批→退出完整流程', () => {
  it('完整流程', () => {
    const sys = createSys();
    let a = mkAlliance();
    a = sys.applyToJoin(a, ps(), 'p2', '诸葛亮', 5000, NOW);
    expect(a.applications).toHaveLength(1);
    a = sys.approveApplication(a, a.applications[0].id, 'p1', NOW);
    expect(a.members['p2'].role).toBe(AllianceRole.MEMBER);
    const r = sys.leaveAlliance(a, ps({ allianceId: a.id }), 'p2');
    expect(r.playerState.allianceId).toBe('');
    expect(r.alliance!.members['p2']).toBeUndefined();
  });
});

describe('F-Normal: 等级与福利', () => {
  it('经验累积→升级→成员上限增加', () => {
    const sys = createSys();
    let a = mkAlliance();
    expect(a.level).toBe(1);
    a = sys.addExperience(a, 1000);
    expect(a.level).toBe(2);
    expect(sys.getMaxMembers(2)).toBe(25);
  });

  it('等级越高加成越大', () => {
    const sys = createSys();
    const b1 = sys.getBonuses({ ...mkAlliance(), level: 1 });
    const b7 = sys.getBonuses({ ...mkAlliance(), level: 7 });
    expect(b7.resourceBonus).toBeGreaterThan(b1.resourceBonus);
  });
});

// ═══════════════════════════════════════════════
// F-Error: 异常路径
// ═══════════════════════════════════════════════

describe('F-Error: 创建联盟异常', () => {
  it('已在联盟中/空名称/1字符/9字符 均应报错', () => {
    const sys = createSys();
    expect(() => sys.createAlliance(ps({ allianceId: 'x' }), '新盟', '', 'p1', 'P1', NOW)).toThrow(/已在联盟中/);
    expect(() => sys.createAlliance(ps(), '', '', 'p1', 'P1', NOW)).toThrow(/联盟名称长度/);
    expect(() => sys.createAlliance(ps(), '蜀', '', 'p1', 'P1', NOW)).toThrow(/联盟名称长度/);
    expect(() => sys.createAlliance(ps(), '123456789', '', 'p1', 'P1', NOW)).toThrow(/联盟名称长度/);
  });
});

describe('F-Error: 加入联盟异常', () => {
  it('已在联盟中/重复申请/满员', () => {
    const sys = createSys();
    expect(() => sys.applyToJoin(mkAlliance(), ps({ allianceId: 'x' }), 'p2', 'P2', 100, NOW)).toThrow(/已在联盟中/);
    let a = mkAlliance();
    a = sys.applyToJoin(a, ps(), 'p2', '诸葛亮', 5000, NOW);
    expect(() => sys.applyToJoin(a, ps(), 'p2', '诸葛亮', 5000, NOW)).toThrow(/已提交申请/);
    const full = mkFullAlliance(ALLIANCE_LEVEL_CONFIGS[0].maxMembers);
    expect(() => sys.applyToJoin(full, ps(), 'extra', '额外', 100, NOW)).toThrow(/联盟成员已满/);
  });
});

describe('F-Error: 审批异常', () => {
  it('不存在/已处理/权限不足', () => {
    const sys = createSys();
    expect(() => sys.approveApplication(mkAllianceWithMembers(), 'nonexistent', 'p1', NOW)).toThrow(/申请不存在/);
    let a = addPendingApp(mkAllianceWithMembers());
    const approved = sys.approveApplication(a, 'app-p4', 'p1', NOW);
    expect(() => sys.approveApplication(approved, 'app-p4', 'p1', NOW)).toThrow(/申请已处理/);
    expect(() => sys.rejectApplication(approved, 'app-p4', 'p1')).toThrow(/申请已处理/);
    expect(() => sys.approveApplication(addPendingApp(mkAllianceWithMembers()), 'app-p4', 'p3', NOW)).toThrow(/权限不足/);
  });
});

describe('F-Error: 退出/踢人异常', () => {
  it('非成员/盟主退出/踢自己/踢盟主/踢非成员/普通成员踢人', () => {
    const sys = createSys();
    const a = mkAllianceWithMembers();
    expect(() => sys.leaveAlliance(a, ps(), 'outsider')).toThrow(/不是联盟成员/);
    expect(() => sys.leaveAlliance(a, ps(), 'p1')).toThrow(/盟主需先转让/);
    expect(() => sys.kickMember(a, 'p1', 'p1')).toThrow(/不能踢出盟主/);
    expect(() => sys.kickMember(a, 'p2', 'p1')).toThrow(/不能踢出盟主/);
    expect(() => sys.kickMember(a, 'p1', 'outsider')).toThrow(/目标不是联盟成员/);
    expect(() => sys.kickMember(a, 'p3', 'p2')).toThrow(/权限不足/);
  });
});

describe('F-Error: 转让/角色异常', () => {
  it('非盟主转让/转让给非成员/转让给自己/setRole LEADER/setRole自己', () => {
    const sys = createSys();
    const a = mkAllianceWithMembers();
    expect(() => sys.transferLeadership(a, 'p2', 'p3')).toThrow(/只有盟主可以转让/);
    expect(() => sys.transferLeadership(a, 'p1', 'outsider')).toThrow(/目标不是联盟成员/);
    expect(() => sys.transferLeadership(a, 'p1', 'p1')).toThrow(/不能转让给自己/);
    expect(() => sys.setRole(a, 'p1', 'p2', AllianceRole.LEADER)).toThrow(/请使用转让盟主功能/);
    expect(() => sys.setRole(a, 'p1', 'p1', AllianceRole.ADVISOR)).toThrow(/不能修改自己的角色/);
  });
});

describe('F-Error: Boss挑战异常', () => {
  it('已击杀/非成员/次数用完', () => {
    const bs = createBossSys();
    const a = mkAllianceWithMembers();
    const deadBoss = createBoss(1, NOW);
    deadBoss.status = BossStatus.KILLED; deadBoss.currentHp = 0;
    expect(() => bs.challengeBoss(deadBoss, a, ps(), 'p1', 100)).toThrow(/Boss已被击杀/);
    const boss = createBoss(1, NOW);
    expect(() => bs.challengeBoss(boss, a, ps(), 'outsider', 100)).toThrow(/不是联盟成员/);
    expect(() => bs.challengeBoss(boss, a, ps({ dailyBossChallenges: 3 }), 'p1', 100)).toThrow(/今日挑战次数已用完/);
  });
});

describe('F-Error: 任务系统异常', () => {
  it('未完成领取/不存在任务/非成员贡献', () => {
    const ts = createTaskSys();
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    if (tasks.length > 0) {
      expect(() => ts.claimTaskReward(tasks[0].defId, mkAllianceWithMembers(), ps(), 'p1')).toThrow(/任务未完成/);
    }
    expect(() => ts.claimTaskReward('nonexistent', mkAllianceWithMembers(), ps(), 'p1')).toThrow(/任务不存在/);
    expect(() => ts.recordContribution(mkAllianceWithMembers(), ps(), 'outsider', 100)).toThrow(/不是联盟成员/);
  });
});

describe('F-Error: 公告/消息异常', () => {
  it('空白公告/空白消息/非成员发消息/普通成员发公告', () => {
    const sys = createSys();
    const a = mkAllianceWithMembers();
    expect(() => sys.postAnnouncement(a, 'p1', '刘备', '   ', false, NOW)).toThrow(/公告内容不能为空/);
    expect(() => sys.sendMessage(a, 'p1', '刘备', '  ', NOW)).toThrow(/消息内容不能为空/);
    expect(() => sys.sendMessage(a, 'outsider', '外人', 'hello', NOW)).toThrow(/不是联盟成员/);
    expect(() => sys.postAnnouncement(a, 'p3', '关羽', '公告', false, NOW)).toThrow(/权限不足/);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('F-Boundary: 名称长度边界', () => {
  it('2字符和8字符刚好通过', () => {
    const sys = createSys();
    expect(sys.createAlliance(ps(), '蜀汉', '', 'p1', 'P1', NOW).alliance.name).toBe('蜀汉');
    expect(sys.createAlliance(ps(), '12345678', '', 'p1', 'P1', NOW).alliance.name).toBe('12345678');
  });
});

describe('F-Boundary: 成员上限与升级', () => {
  it('满员审批报错 + 升级增加上限', () => {
    const sys = createSys();
    const a = addPendingApp(mkFullAlliance(ALLIANCE_LEVEL_CONFIGS[0].maxMembers), 'extra');
    expect(() => sys.approveApplication(a, 'app-extra', 'leader', NOW)).toThrow(/联盟成员已满/);
    expect(sys.getMaxMembers(1)).toBe(20);
    expect(sys.getMaxMembers(7)).toBe(50);
  });
});

describe('F-Boundary: 置顶公告上限', () => {
  it('第4条置顶报错，非置顶无限制', () => {
    const sys = createSys();
    let a = mkAllianceWithMembers();
    for (let i = 0; i < 3; i++) a = sys.postAnnouncement(a, 'p1', '刘备', `公告${i}`, true, NOW);
    expect(() => sys.postAnnouncement(a, 'p1', '刘备', '第4条', true, NOW)).toThrow(/置顶公告最多/);
    for (let i = 0; i < 10; i++) a = sys.postAnnouncement(a, 'p1', '刘备', `普通${i}`, false, NOW);
    expect(a.announcements.length).toBe(13); // 3 pinned + 10 normal
  });
});

describe('F-Boundary: 消息截断', () => {
  it('超过100条保留最新', () => {
    const sys = createSys();
    let a = mkAllianceWithMembers();
    for (let i = 0; i < 105; i++) a = sys.sendMessage(a, 'p1', '刘备', `消息${i}`, NOW + i);
    expect(a.messages.length).toBe(DEFAULT_CREATE_CONFIG.maxMessages);
    expect(a.messages[a.messages.length - 1].content).toBe('消息104');
  });
});

describe('F-Boundary: Boss伤害边界', () => {
  it('伤害超HP被clamp + 0伤害不击杀', () => {
    const bs = createBossSys();
    const boss = createBoss(1, NOW);
    boss.currentHp = 50;
    const r1 = bs.challengeBoss(boss, mkAllianceWithMembers(), ps(), 'p1', 99999);
    expect(r1.result.damage).toBe(50);
    expect(r1.boss.currentHp).toBe(0);

    const boss2 = createBoss(1, NOW);
    const r2 = bs.challengeBoss(boss2, mkAllianceWithMembers(), ps(), 'p1', 0);
    expect(r2.result.damage).toBe(0);
    expect(r2.result.isKillingBlow).toBe(false);
  });
});

describe('F-Boundary: 经验边界', () => {
  it('差1不升级/恰好升级/超大经验升满', () => {
    const sys = createSys();
    expect(sys.addExperience(mkAlliance(), 999).level).toBe(1);
    expect(sys.addExperience(mkAlliance(), 1000).level).toBe(2);
    expect(sys.addExperience(mkAlliance(), 999999).level).toBe(ALLIANCE_LEVEL_CONFIGS.length);
  });
});

describe('F-Boundary: 任务进度边界', () => {
  it('恰好达标自动完成 + 重复刷新幂等', () => {
    const ts = createTaskSys();
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    if (tasks.length > 0) {
      const def = ts.getTaskDef(tasks[0].defId)!;
      const r = ts.updateProgress(tasks[0].defId, def.targetCount);
      expect(r!.status).toBe(AllianceTaskStatus.COMPLETED);
    }
    const t2 = ts.dailyRefresh();
    expect(t2.length).toBe(DEFAULT_TASK_CONFIG.dailyTaskCount);
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('F-Cross: 联盟→Boss→奖励→公会币', () => {
  it('挑战增加公会币和贡献，击杀触发全员奖励', () => {
    const bs = createBossSys();
    const a = mkAllianceWithMembers();
    const boss = createBoss(a.level, NOW);

    const r1 = bs.challengeBoss(boss, a, ps(), 'p1', 5000);
    expect(r1.playerState.guildCoins).toBeGreaterThan(0);
    expect(r1.alliance.members['p1'].dailyContribution).toBeGreaterThan(0);

    const boss2 = createBoss(a.level, NOW);
    const r2 = bs.challengeBoss(boss2, a, ps(), 'p1', boss2.maxHp);
    expect(r2.result.isKillingBlow).toBe(true);
    expect(r2.result.killReward!.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
    expect(r2.result.killReward!.destinyPoint).toBe(DEFAULT_BOSS_CONFIG.killDestinyReward);
    expect(r2.alliance.bossKilledToday).toBe(true);
  });
});

describe('F-Cross: 联盟→任务→经验→等级', () => {
  it('完成任务增加联盟经验和公会币', () => {
    const ts = createTaskSys();
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    if (tasks.length > 0) {
      const def = ts.getTaskDef(tasks[0].defId)!;
      ts.updateProgress(tasks[0].defId, def.targetCount);
      const r = ts.claimTaskReward(tasks[0].defId, mkAllianceWithMembers(), ps(), 'p1');
      expect(r.expGained).toBe(def.allianceExpReward);
      expect(r.alliance.experience).toBe(def.allianceExpReward);
      expect(r.coinGained).toBe(def.guildCoinReward);
    }
  });

  it('贡献记录增加公会币和个人贡献', () => {
    const ts = createTaskSys();
    const r = ts.recordContribution(mkAllianceWithMembers(), ps(), 'p1', 50);
    expect(r.playerState.guildCoins).toBe(50);
    expect(r.playerState.dailyContribution).toBe(50);
    expect(r.alliance.members['p1'].dailyContribution).toBe(50);
    expect(r.alliance.members['p1'].totalContribution).toBe(50); // p1初始totalContribution=0
  });
});

describe('F-Cross: 转让→权限变化', () => {
  it('转让后权限矩阵更新', () => {
    const sys = createSys();
    const a = mkAllianceWithMembers();
    expect(sys.hasPermission(a, 'p1', 'manage')).toBe(true);
    const t = sys.transferLeadership(a, 'p1', 'p3');
    expect(t.leaderId).toBe('p3');
    expect(t.members['p1'].role).toBe(AllianceRole.MEMBER);
    expect(t.members['p3'].role).toBe(AllianceRole.LEADER);
    expect(sys.hasPermission(t, 'p3', 'manage')).toBe(true);
    expect(sys.hasPermission(t, 'p1', 'manage')).toBe(false);
  });
});

describe('F-Cross: 每日重置', () => {
  it('重置清空Boss次数和贡献', () => {
    const sys = createSys();
    const a = mkAllianceWithMembers();
    a.members['p1'].dailyBossChallenges = 3;
    a.members['p1'].dailyContribution = 200;
    a.bossKilledToday = true;
    const r = sys.dailyReset(a, ps({ dailyBossChallenges: 3, dailyContribution: 200 }));
    expect(r.alliance.members['p1'].dailyBossChallenges).toBe(0);
    expect(r.alliance.bossKilledToday).toBe(false);
    expect(r.playerState.dailyBossChallenges).toBe(0);
  });

  it('任务刷新生成新任务并清零进度', () => {
    const ts = createTaskSys();
    const t1 = ts.dailyRefresh();
    ts.updateProgress(t1[0].defId, 100);
    expect(ts.getTaskProgress(t1[0].defId)!.current).toBeGreaterThan(0);
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    expect(tasks[0].currentProgress).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 序列化/反序列化', () => {
  it('正常数据往返一致', () => {
    const sys = createSys();
    const a = mkAllianceWithMembers();
    const playerState = ps({ allianceId: a.id, guildCoins: 500 });
    const saved = sys.serialize(playerState, a);
    expect(saved.version).toBe(ALLIANCE_SAVE_VERSION);
    const restored = sys.deserialize(saved);
    expect(restored.playerState.guildCoins).toBe(500);
    expect(restored.alliance!.name).toBe('蜀汉');
    expect(Object.keys(restored.alliance!.members).length).toBe(3);
  });

  it('无联盟/版本不匹配/null数据 均返回默认', () => {
    const sys = createSys();
    const r1 = sys.deserialize(sys.serialize(ps(), null));
    expect(r1.alliance).toBeNull();
    const r2 = sys.deserialize({ version: 999, playerState: ps(), allianceData: null });
    expect(r2.alliance).toBeNull();
    const r3 = AllianceHelper.deserializeAlliance(null as any);
    expect(r3.alliance).toBeNull();
    expect(r3.playerState.allianceId).toBe('');
  });
});

describe('F-Lifecycle: 任务序列化', () => {
  it('Set<string> ↔ string[] 往返一致', () => {
    const ts = createTaskSys();
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    if (tasks.length > 0) {
      tasks[0].claimedPlayers.add('p1');
      tasks[0].claimedPlayers.add('p2');
      const serialized = ts.serializeTasks();
      expect(serialized[0].claimedPlayers).toEqual(['p1', 'p2']);
      const ts2 = createTaskSys();
      ts2.deserializeTasks(serialized);
      const restored = ts2.getActiveTasks();
      expect(restored[0].claimedPlayers.has('p1')).toBe(true);
      expect(restored[0].claimedPlayers.has('p3')).toBe(false);
    }
  });

  it('Boss系统serialize/deserialize', () => {
    const bs = createBossSys();
    const data = bs.serialize();
    expect(data.config).toBeDefined();
    const bs2 = createBossSys();
    expect(() => bs2.deserialize(data)).not.toThrow();
  });
});

describe('F-Lifecycle: createAllianceSimple', () => {
  it('元宝不足/扣除失败/正常创建/已在联盟中', () => {
    const sys = createSys();
    sys.setCurrencyCallbacks({ spend: vi.fn().mockReturnValue(false), getBalance: vi.fn().mockReturnValue(100) });
    expect(sys.createAllianceSimple('测试').success).toBe(false);
    expect(sys.createAllianceSimple('测试').reason).toContain('元宝不足');

    sys.setCurrencyCallbacks({ spend: vi.fn().mockReturnValue(false), getBalance: vi.fn().mockReturnValue(1000) });
    expect(sys.createAllianceSimple('测试').success).toBe(false);
    expect(sys.createAllianceSimple('测试').reason).toContain('元宝扣除失败');

    sys.setCurrencyCallbacks({ spend: vi.fn().mockReturnValue(true), getBalance: vi.fn().mockReturnValue(1000) });
    expect(sys.createAllianceSimple('测试联盟').success).toBe(true);
    expect(sys.getAlliance()).not.toBeNull();
    expect(sys.createAllianceSimple('第二个').success).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// 负数注入对抗
// ═══════════════════════════════════════════════

describe('负数注入对抗', () => {
  it('经验/进度/贡献 负数不导致负值', () => {
    const sys = createSys();
    expect(sys.addExperience(mkAlliance(), -5000).experience).toBeGreaterThanOrEqual(0);
    const ts = createTaskSys();
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    if (tasks.length > 0) {
      ts.updateProgress(tasks[0].defId, -100);
      expect(ts.getActiveTasks()[0].currentProgress).toBeGreaterThanOrEqual(0);
    }
    const r = ts.recordContribution(mkAllianceWithMembers(), ps(), 'p1', -500);
    expect(r.alliance.members['p1'].dailyContribution).toBeGreaterThanOrEqual(0);
    expect(r.playerState.guildCoins).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════
// 搜索/查询/权限/工具
// ═══════════════════════════════════════════════

describe('搜索与查询', () => {
  it('searchAlliance 空关键词返回全部 + 大小写不敏感', () => {
    const list = [createAllianceData('a1', '蜀汉', '', 'p1', '刘备', NOW), createAllianceData('a2', '曹魏', '', 'p2', '曹操', NOW)];
    expect(AllianceHelper.searchAlliance(list, '').length).toBe(2);
    expect(AllianceHelper.searchAlliance([createAllianceData('a1', 'TestAlliance', '', 'p1', 'P1', NOW)], 'testalliance').length).toBe(1);
  });

  it('getPendingApplications 只返回PENDING', () => {
    const a = mkAlliance();
    a.applications = [
      { id: '1', allianceId: a.id, playerId: 'p2', playerName: 'P2', power: 100, timestamp: NOW, status: ApplicationStatus.PENDING },
      { id: '2', allianceId: a.id, playerId: 'p3', playerName: 'P3', power: 200, timestamp: NOW, status: ApplicationStatus.APPROVED },
    ];
    expect(AllianceHelper.getPendingApplications(a).length).toBe(1);
  });

  it('getPinnedAnnouncements 只返回置顶', () => {
    const sys = createSys();
    let a = mkAllianceWithMembers();
    a = sys.postAnnouncement(a, 'p1', '刘备', '置顶1', true, NOW);
    a = sys.postAnnouncement(a, 'p1', '刘备', '普通1', false, NOW);
    expect(AllianceHelper.getPinnedAnnouncements(a).length).toBe(1);
  });
});

describe('权限矩阵', () => {
  const a = mkAllianceWithMembers();
  it('LEADER全权限/ADVISOR部分/MEMBER无/非成员无', () => {
    expect(AllianceHelper.hasPermission(a, 'p1', 'manage')).toBe(true);
    expect(AllianceHelper.hasPermission(a, 'p2', 'approve')).toBe(true);
    expect(AllianceHelper.hasPermission(a, 'p2', 'manage')).toBe(false);
    expect(AllianceHelper.hasPermission(a, 'p3', 'approve')).toBe(false);
    expect(AllianceHelper.hasPermission(a, 'outsider', 'approve')).toBe(false);
  });
});

describe('工具方法', () => {
  it('generateId/getLevelConfig/getMemberList/Boss工具', () => {
    expect(generateId('t')).not.toBe(generateId('t'));
    expect(generateId('t').startsWith('t_')).toBe(true);
    const sys = createSys();
    expect(sys.getLevelConfig(0).level).toBe(1);
    expect(sys.getLevelConfig(999).level).toBe(ALLIANCE_LEVEL_CONFIGS.length);
    expect(AllianceHelper.getMemberList(mkAllianceWithMembers()).length).toBe(3);
    const bs = createBossSys();
    expect(bs.calculateBossMaxHp(1)).toBe(DEFAULT_BOSS_CONFIG.baseHp);
    expect(bs.getRemainingChallenges(ps({ dailyBossChallenges: 1 }))).toBe(2);
    expect(bs.getRemainingChallenges(ps({ dailyBossChallenges: 3 }))).toBe(0);
    expect(bs.distributeKillRewards(mkAlliance(), ps({ guildCoins: 100 })).guildCoins)
      .toBe(100 + DEFAULT_BOSS_CONFIG.killGuildCoinReward);
  });
});

describe('Boss伤害排行', () => {
  it('空记录返回空 + 按伤害降序并计算百分比', () => {
    const bs = createBossSys();
    const a = mkAllianceWithMembers();
    expect(bs.getDamageRanking(createBoss(1, NOW), a)).toEqual([]);
    const boss = createBoss(1, NOW);
    boss.damageRecords = { p1: 5000, p2: 8000, p3: 3000 };
    const ranking = bs.getDamageRanking(boss, a);
    expect(ranking[0].playerId).toBe('p2');
    expect(ranking[0].rank).toBe(1);
    expect(ranking[0].damagePercent).toBeCloseTo(50);
  });
});

describe('重复操作对抗', () => {
  it('重复领奖/重复批准/重复拒绝 均报错', () => {
    const sys = createSys();
    const ts = createTaskSys();
    ts.dailyRefresh();
    const tasks = ts.getActiveTasks();
    if (tasks.length > 0) {
      const def = ts.getTaskDef(tasks[0].defId)!;
      ts.updateProgress(tasks[0].defId, def.targetCount);
      ts.claimTaskReward(tasks[0].defId, mkAllianceWithMembers(), ps(), 'p1');
      expect(() => ts.claimTaskReward(tasks[0].defId, mkAllianceWithMembers(), ps(), 'p1')).toThrow(/已领取奖励/);
    }
    let a = addPendingApp(mkAllianceWithMembers());
    a = sys.approveApplication(a, 'app-p4', 'p1', NOW);
    expect(() => sys.approveApplication(a, 'app-p4', 'p1', NOW)).toThrow(/申请已处理/);
    let a2 = addPendingApp(mkAllianceWithMembers());
    a2 = sys.rejectApplication(a2, 'app-p4', 'p1');
    expect(() => sys.rejectApplication(a2, 'app-p4', 'p1')).toThrow(/申请已处理/);
  });
});

describe('resetAllianceData', () => {
  it('重置后getAlliance返回新数据 / null清空', () => {
    const sys = createSys();
    const a = mkAlliance();
    sys.resetAllianceData(a);
    expect(sys.getAlliance()).toBe(a);
    sys.resetAllianceData(null);
    expect(sys.getAlliance()).toBeNull();
  });
});
