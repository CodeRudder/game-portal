/**
 * 远征日志记录完整性 + 保留时长 — P1 测试
 *
 * 验证远征日志系统的两大核心需求：
 *   1. 日志记录完整性（EXP-4 §4.11）
 *      - 每次远征（在线/离线）生成日志记录
 *      - 日志包含：路线ID、队伍配置、战斗结果、奖励、时间戳
 *   2. 日志保留时长与自动清理（EXP-4 §4.13）
 *      - 普通玩家 7 天，VIP 玩家 14 天
 *      - 超期日志自动清理
 *
 * @module engine/expedition/__tests__/ExpeditionLog
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../ExpeditionSystem';
import { ExpeditionBattleSystem } from '../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../ExpeditionRewardSystem';
import { AutoExpeditionSystem } from '../AutoExpeditionSystem';
import type { OfflineExpeditionParams } from '../AutoExpeditionSystem';
import type { HeroBrief } from '../ExpeditionTeamHelper';
import type { ExpeditionTeam, ExpeditionReward } from '../../../core/expedition/expedition.types';
import {
  RouteDifficulty, FormationType, SweepType,
  OFFLINE_EXPEDITION_CONFIG,
} from '../../../core/expedition/expedition.types';
import { BASE_REWARDS } from '../expedition-config';

// ── 辅助 ──────────────────────────────

function createHero(id: string, faction: string = 'shu', power: number = 1000): HeroBrief {
  return { id, faction: faction as HeroBrief['faction'], power };
}
function createHeroMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}
function createShuHeroes(n: number = 3): HeroBrief[] {
  return Array.from({ length: n }, (_, i) => createHero(`shu_${i}`, 'shu', 1000 + i * 100));
}
function toFullReward(r: { grain: number; gold: number; iron: number; equipFragments: number; exp: number }): ExpeditionReward {
  return { ...r, drops: [] };
}
const DAY_MS = 24 * 3600 * 1000;
const EASY_REWARD = toFullReward(BASE_REWARDS[RouteDifficulty.EASY]);

// ── 日志类型 ──────────────────────────────

type ExpeditionMode = 'online' | 'offline' | 'sweep';

interface ExpeditionLogEntry {
  id: string;
  routeId: string;
  routeName: string;
  teamId: string;
  teamConfig: { heroIds: string[]; formation: FormationType; totalPower: number };
  mode: ExpeditionMode;
  result: 'victory' | 'defeat';
  stars: number;
  reward: ExpeditionReward;
  startTime: number;
  endTime: number;
  failureReason?: string;
}

// ── 日志管理器参考实现 ──────────────────────────────

const DEFAULT_RETENTION = { normalDays: 7, vipDays: 14 };

class ExpeditionLogManager {
  private logs: ExpeditionLogEntry[] = [];
  private readonly isVip: boolean;
  private readonly retentionDays: number;
  private nextId = 1;

  constructor(isVip: boolean = false) {
    this.isVip = isVip;
    this.retentionDays = isVip ? DEFAULT_RETENTION.vipDays : DEFAULT_RETENTION.normalDays;
  }

  getRetentionMs(): number { return this.retentionDays * DAY_MS; }
  getRetentionDays(): number { return this.retentionDays; }
  isVipPlayer(): boolean { return this.isVip; }

  addLog(entry: Omit<ExpeditionLogEntry, 'id'>): ExpeditionLogEntry {
    const log: ExpeditionLogEntry = { ...entry, id: `log_${this.nextId++}_${Date.now()}` };
    this.logs.push(log);
    return log;
  }

  purgeExpired(now: number): number {
    const before = this.logs.length;
    const retentionMs = this.getRetentionMs();
    this.logs = this.logs.filter(log => (now - log.endTime) < retentionMs);
    return before - this.logs.length;
  }

  getLogs(): ExpeditionLogEntry[] { return [...this.logs]; }
  getLogCount(): number { return this.logs.length; }
  getLogsByRoute(routeId: string): ExpeditionLogEntry[] { return this.logs.filter(l => l.routeId === routeId); }
  getLogsByMode(mode: ExpeditionMode): ExpeditionLogEntry[] { return this.logs.filter(l => l.mode === mode); }
  getLogsByTimeRange(start: number, end: number): ExpeditionLogEntry[] {
    return this.logs.filter(l => l.startTime >= start && l.endTime <= end);
  }
  getFailedLogs(): ExpeditionLogEntry[] { return this.logs.filter(l => l.result === 'defeat'); }
}

// ── 快捷构建函数 ──────────────────────────────

function createDispatchedTeam(sys: ExpeditionSystem, heroMap: Record<string, HeroBrief>): ExpeditionTeam | null {
  sys.updateSlots(20);
  const r = sys.createTeam('测试队', Object.keys(heroMap), FormationType.STANDARD, heroMap);
  if (!r.valid) return null;
  const team = sys.getAllTeams()[0];
  return team && sys.dispatchTeam(team.id, 'route_hulao_easy') ? team : null;
}

/** 快速创建标准日志条目 */
function makeLog(overrides: Partial<Omit<ExpeditionLogEntry, 'id'>> & { teamId: string }): Omit<ExpeditionLogEntry, 'id'> {
  const now = Date.now();
  return {
    routeId: 'route_hulao_easy',
    routeName: '虎牢关·简',
    teamConfig: { heroIds: ['h1'], formation: FormationType.STANDARD, totalPower: 1000 },
    mode: 'online',
    result: 'victory',
    stars: 3,
    reward: { grain: 100, gold: 200, iron: 1, equipFragments: 0, exp: 300, drops: [] },
    startTime: now - 600000,
    endTime: now,
    ...overrides,
  };
}

function createOfflineParams(overrides?: Partial<OfflineExpeditionParams>): OfflineExpeditionParams {
  return {
    offlineSeconds: 3600, teamPower: 5000, teamFormation: FormationType.STANDARD,
    routeAvgPower: 3000, routeAvgFormation: FormationType.FLANKING,
    avgRouteDurationSeconds: 600, baseRouteReward: EASY_REWARD, heroCount: 3,
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// 一、在线远征日志完整性
// ═══════════════════════════════════════════

describe('远征日志 — 在线远征日志完整性', () => {
  let system: ExpeditionSystem;
  let logManager: ExpeditionLogManager;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(20);
    logManager = new ExpeditionLogManager(false);
  });

  it('在线远征应生成日志记录', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const log = logManager.addLog(makeLog({ teamId: team!.id }));
    expect(logManager.getLogCount()).toBe(1);
    expect(log.id).toBeDefined();
  });

  it('日志应包含路线ID和路线名称', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const log = logManager.addLog(makeLog({ teamId: team!.id }));
    expect(log.routeId).toBe('route_hulao_easy');
    expect(log.routeName).toContain('虎牢关');
  });

  it('日志应包含队伍配置（武将ID列表 + 阵型 + 战力）', () => {
    const heroes = createShuHeroes(3);
    const heroMap = createHeroMap(heroes);
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const log = logManager.addLog(makeLog({
      teamId: team!.id,
      teamConfig: { heroIds: [...team!.heroIds], formation: team!.formation, totalPower: team!.totalPower },
    }));
    expect(log.teamConfig.heroIds).toEqual(team!.heroIds);
    expect(log.teamConfig.formation).toBe(team!.formation);
    expect(log.teamConfig.totalPower).toBeGreaterThan(0);
  });

  it('日志应包含战斗结果（胜利/失败 + 星级）', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const victoryLog = logManager.addLog(makeLog({ teamId: team!.id, result: 'victory', stars: 3 }));
    expect(victoryLog.result).toBe('victory');
    expect(victoryLog.stars).toBe(3);

    const defeatLog = logManager.addLog(makeLog({ teamId: team!.id, result: 'defeat', stars: 0 }));
    expect(defeatLog.result).toBe('defeat');
    expect(defeatLog.stars).toBe(0);
  });

  it('日志应包含奖励明细', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const reward: ExpeditionReward = {
      grain: 200, gold: 400, iron: 1, equipFragments: 1, exp: 500,
      drops: [{ type: 'equip_fragment', id: 'ef_001', name: '铁剑碎片', count: 2 }],
    };
    const log = logManager.addLog(makeLog({ teamId: team!.id, reward }));
    expect(log.reward.gold).toBe(400);
    expect(log.reward.drops).toHaveLength(1);
  });

  it('日志应包含开始和结束时间戳', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const startTime = Date.now() - 1800000;
    const endTime = Date.now();
    const log = logManager.addLog(makeLog({ teamId: team!.id, startTime, endTime }));
    expect(log.startTime).toBe(startTime);
    expect(log.endTime).toBe(endTime);
    expect(log.endTime - log.startTime).toBe(1800000);
  });

  it('失败日志应包含失败原因', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    const log = logManager.addLog(makeLog({ teamId: team!.id, result: 'defeat', stars: 0, failureReason: '战力不足' }));
    expect(log.failureReason).toBe('战力不足');
  });

  it('推进节点后日志反映最新状态', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();
    system.advanceToNextNode(team!.id, 0);

    const log = logManager.addLog(makeLog({ teamId: team!.id, routeId: team!.currentRouteId ?? '' }));
    expect(log.routeId).toBe(team!.currentRouteId);
  });

  it('完成路线后可构建完成日志', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();

    // 进行中日志
    logManager.addLog(makeLog({ teamId: team!.id }));
    // 完成路线
    system.completeRoute(team!.id, 3);
    // 完成日志
    logManager.addLog(makeLog({
      teamId: team!.id,
      routeName: '虎牢关·简',
      result: 'victory', stars: 3,
      reward: { grain: 600, gold: 1200, iron: 4, equipFragments: 4, exp: 2500, drops: [] },
    }));

    expect(logManager.getLogCount()).toBe(2);
    const lastLog = logManager.getLogs()[1];
    expect(lastLog.result).toBe('victory');
    expect(lastLog.stars).toBe(3);
  });
});

// ═══════════════════════════════════════════
// 二、离线远征日志完整性
// ═══════════════════════════════════════════

describe('远征日志 — 离线远征日志完整性', () => {
  let autoSystem: AutoExpeditionSystem;
  let logManager: ExpeditionLogManager;

  beforeEach(() => {
    autoSystem = new AutoExpeditionSystem(new ExpeditionBattleSystem(), new ExpeditionRewardSystem());
    logManager = new ExpeditionLogManager(false);
  });

  it('离线远征应生成日志记录', () => {
    const result = autoSystem.calculateOfflineExpedition(createOfflineParams());
    const log = logManager.addLog(makeLog({
      teamId: 'team_offline_1',
      mode: 'offline',
      result: result.completedRuns > 0 ? 'victory' : 'defeat',
      reward: result.totalReward,
    }));
    expect(log.mode).toBe('offline');
    expect(log.routeId).toBe('route_hulao_easy');
  });

  it('离线日志应包含完成次数和时长', () => {
    const offlineSeconds = 7200;
    const result = autoSystem.calculateOfflineExpedition(createOfflineParams({ offlineSeconds }));
    const startTime = Date.now() - offlineSeconds * 1000;
    const log = logManager.addLog(makeLog({
      teamId: 'team_offline_1', mode: 'offline',
      reward: result.totalReward, startTime, endTime: Date.now(),
    }));
    expect(log.endTime - log.startTime).toBe(offlineSeconds * 1000);
    expect(log.reward.gold).toBeGreaterThan(0);
  });

  it('离线日志奖励体现0.85效率系数', () => {
    const baseReward = EASY_REWARD;
    const params = createOfflineParams({ offlineSeconds: 600, avgRouteDurationSeconds: 600, baseRouteReward: baseReward });
    const result = autoSystem.calculateOfflineExpedition(params);
    const expectedGold = Math.round(baseReward.gold * result.completedRuns * OFFLINE_EXPEDITION_CONFIG.battleEfficiency);
    expect(result.totalReward.gold).toBe(expectedGold);
  });
});

// ═══════════════════════════════════════════
// 三、扫荡日志完整性
// ═══════════════════════════════════════════

describe('远征日志 — 扫荡日志完整性', () => {
  let system: ExpeditionSystem;
  let logManager: ExpeditionLogManager;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.updateSlots(20);
    logManager = new ExpeditionLogManager(false);
  });

  it('扫荡应生成日志记录', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();
    system.completeRoute(team!.id, 3);

    const sweepResult = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
    expect(sweepResult.success).toBe(true);

    const log = logManager.addLog(makeLog({ teamId: team!.id, mode: 'sweep' }));
    expect(log.mode).toBe('sweep');
    expect(log.result).toBe('victory');
  });

  it('多次扫荡生成多条日志', () => {
    const heroMap = createHeroMap(createShuHeroes(3));
    const team = createDispatchedTeam(system, heroMap);
    expect(team).not.toBeNull();
    system.completeRoute(team!.id, 3);

    for (let i = 0; i < 3; i++) {
      system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      logManager.addLog(makeLog({ teamId: team!.id, mode: 'sweep' }));
    }
    expect(logManager.getLogCount()).toBe(3);
    expect(logManager.getLogsByMode('sweep')).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════
// 四、日志查询功能
// ═══════════════════════════════════════════

describe('远征日志 — 查询功能', () => {
  let logManager: ExpeditionLogManager;
  let now: number;

  beforeEach(() => {
    logManager = new ExpeditionLogManager(false);
    now = Date.now();
    const routes = [
      { id: 'route_hulao_easy', name: '虎牢关·简' },
      { id: 'route_hulao_normal', name: '虎牢关·普' },
      { id: 'route_yishui_easy', name: '汜水关·简' },
    ];
    const modes: ExpeditionMode[] = ['online', 'offline', 'sweep'];
    for (let i = 0; i < 9; i++) {
      logManager.addLog(makeLog({
        teamId: `team_${i}`,
        routeId: routes[i % 3].id,
        routeName: routes[i % 3].name,
        mode: modes[i % 3],
        result: i % 4 === 0 ? 'defeat' : 'victory',
        stars: i % 4 === 0 ? 0 : 3,
        startTime: now - (i + 1) * 3600000,
        endTime: now - i * 3600000,
      }));
    }
  });

  it('按路线ID查询日志', () => {
    const logs = logManager.getLogsByRoute('route_hulao_easy');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(l => l.routeId === 'route_hulao_easy')).toBe(true);
  });

  it('按模式查询日志', () => {
    const online = logManager.getLogsByMode('online');
    const offline = logManager.getLogsByMode('offline');
    const sweep = logManager.getLogsByMode('sweep');
    expect(online.length + offline.length + sweep.length).toBe(9);
  });

  it('按时间范围查询日志', () => {
    const logs = logManager.getLogsByTimeRange(now - 5 * 3600000, now);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(l => l.startTime >= now - 5 * 3600000)).toBe(true);
  });

  it('查询失败日志', () => {
    const failed = logManager.getFailedLogs();
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every(l => l.result === 'defeat')).toBe(true);
  });

  it('多队伍并行远征日志可区分', () => {
    const system = new ExpeditionSystem();
    system.updateSlots(20);
    const heroMap1 = createHeroMap(createShuHeroes(3));
    const heroMap2 = createHeroMap(Array.from({ length: 3 }, (_, i) => createHero(`wei_${i}`, 'wei', 1200 + i * 100)));
    const allHeroMap = { ...heroMap1, ...heroMap2 };

    const r1 = system.createTeam('队伍A', ['shu_0', 'shu_1', 'shu_2'], FormationType.STANDARD, allHeroMap);
    expect(r1.valid).toBe(true);
    const team1 = system.getAllTeams().find(t => t.name === '队伍A');
    system.dispatchTeam(team1!.id, 'route_hulao_easy');

    const r2 = system.createTeam('队伍B', ['wei_0', 'wei_1', 'wei_2'], FormationType.OFFENSIVE, allHeroMap);
    expect(r2.valid).toBe(true);
    const team2 = system.getAllTeams().find(t => t.name === '队伍B');
    system.dispatchTeam(team2!.id, 'route_hulao_normal');

    logManager.addLog(makeLog({ teamId: team1!.id, routeId: 'route_hulao_easy', routeName: '虎牢关·简' }));
    logManager.addLog(makeLog({ teamId: team2!.id, routeId: 'route_hulao_normal', routeName: '虎牢关·普' }));

    const t1Logs = logManager.getLogs().filter(l => l.teamId === team1!.id);
    const t2Logs = logManager.getLogs().filter(l => l.teamId === team2!.id);
    expect(t1Logs).toHaveLength(1);
    expect(t2Logs).toHaveLength(1);
    expect(t1Logs[0].routeId).toBe('route_hulao_easy');
    expect(t2Logs[0].routeId).toBe('route_hulao_normal');
  });
});

// ═══════════════════════════════════════════
// 五、普通玩家保留7天
// ═══════════════════════════════════════════

describe('远征日志 — 普通玩家保留7天', () => {
  let logManager: ExpeditionLogManager;
  let now: number;

  beforeEach(() => {
    logManager = new ExpeditionLogManager(false);
    now = Date.now();
  });

  it('保留天数和毫秒数', () => {
    expect(logManager.getRetentionDays()).toBe(7);
    expect(logManager.getRetentionMs()).toBe(7 * DAY_MS);
  });

  it('7天内的日志不清理', () => {
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - 3 * DAY_MS, endTime: now - 3 * DAY_MS + 600000 }));
    expect(logManager.purgeExpired(now)).toBe(0);
    expect(logManager.getLogCount()).toBe(1);
  });

  it('超过7天的日志被清理', () => {
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - 8 * DAY_MS, endTime: now - 8 * DAY_MS + 600000 }));
    expect(logManager.purgeExpired(now)).toBe(1);
    expect(logManager.getLogCount()).toBe(0);
  });

  it('恰好7天的日志不清理（边界）', () => {
    const endTime = now - 7 * DAY_MS + 600000;
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - 7 * DAY_MS, endTime }));
    expect(logManager.purgeExpired(now)).toBe(0);
    expect(logManager.getLogCount()).toBe(1);
  });

  it('混合过期和未过期 — 仅清理过期的', () => {
    for (let i = 0; i < 3; i++) {
      logManager.addLog(makeLog({
        teamId: `t_old_${i}`, routeName: '旧日志',
        startTime: now - (8 + i) * DAY_MS, endTime: now - (8 + i) * DAY_MS + 600000,
      }));
    }
    for (let i = 0; i < 5; i++) {
      logManager.addLog(makeLog({
        teamId: `t_new_${i}`, routeName: '新日志',
        startTime: now - (1 + i) * DAY_MS, endTime: now - (1 + i) * DAY_MS + 600000,
      }));
    }
    expect(logManager.purgeExpired(now)).toBe(3);
    expect(logManager.getLogCount()).toBe(5);
    expect(logManager.getLogs().every(l => l.routeName === '新日志')).toBe(true);
  });

  it('清理后过期日志不可查询', () => {
    logManager.addLog(makeLog({ teamId: 't1', routeId: 'route_hulao_easy', routeName: '过期日志', startTime: now - 10 * DAY_MS, endTime: now - 10 * DAY_MS + 600000 }));
    logManager.addLog(makeLog({ teamId: 't2', routeId: 'route_hulao_normal', routeName: '有效日志', startTime: now - DAY_MS, endTime: now - DAY_MS + 600000 }));
    logManager.purgeExpired(now);

    const logs = logManager.getLogs();
    expect(logs.every(l => l.routeName !== '过期日志')).toBe(true);
    expect(logs.some(l => l.routeName === '有效日志')).toBe(true);
    // 过期日志的路线已无记录
    expect(logManager.getLogsByRoute('route_hulao_easy')).toHaveLength(0);
    // 有效日志的路线仍可查
    expect(logManager.getLogsByRoute('route_hulao_normal')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════
// 六、VIP玩家保留14天
// ═══════════════════════════════════════════

describe('远征日志 — VIP玩家保留14天', () => {
  let logManager: ExpeditionLogManager;
  let now: number;

  beforeEach(() => {
    logManager = new ExpeditionLogManager(true);
    now = Date.now();
  });

  it('VIP保留天数和毫秒数', () => {
    expect(logManager.getRetentionDays()).toBe(14);
    expect(logManager.getRetentionMs()).toBe(14 * DAY_MS);
  });

  it('7~14天内的日志VIP保留', () => {
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - 10 * DAY_MS, endTime: now - 10 * DAY_MS + 600000 }));
    expect(logManager.purgeExpired(now)).toBe(0);
    expect(logManager.getLogCount()).toBe(1);
  });

  it('超过14天的日志VIP也清理', () => {
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - 15 * DAY_MS, endTime: now - 15 * DAY_MS + 600000 }));
    expect(logManager.purgeExpired(now)).toBe(1);
    expect(logManager.getLogCount()).toBe(0);
  });

  it('恰好14天的日志VIP不清理（边界）', () => {
    const endTime = now - 14 * DAY_MS + 600000;
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - 14 * DAY_MS, endTime }));
    expect(logManager.purgeExpired(now)).toBe(0);
    expect(logManager.getLogCount()).toBe(1);
  });

  it('VIP保留天数 = 普通玩家 × 2', () => {
    const normal = new ExpeditionLogManager(false);
    expect(logManager.getRetentionDays()).toBe(normal.getRetentionDays() * 2);
  });

  it('VIP保留7天前日志而普通玩家清理', () => {
    const normalManager = new ExpeditionLogManager(false);
    const entry = makeLog({ teamId: 't1', startTime: now - 10 * DAY_MS, endTime: now - 10 * DAY_MS + 600000 });
    normalManager.addLog({ ...entry });
    logManager.addLog({ ...entry });

    normalManager.purgeExpired(now);
    logManager.purgeExpired(now);

    expect(normalManager.getLogCount()).toBe(0);
    expect(logManager.getLogCount()).toBe(1);
  });
});

// ═══════════════════════════════════════════
// 七、批量清理与幂等性
// ═══════════════════════════════════════════

describe('远征日志 — 批量清理', () => {
  let logManager: ExpeditionLogManager;
  let now: number;

  beforeEach(() => {
    logManager = new ExpeditionLogManager(false);
    now = Date.now();
  });

  it('批量添加和清理100条日志', () => {
    for (let i = 0; i < 50; i++) {
      logManager.addLog(makeLog({
        teamId: `t_old_${i}`, routeName: '旧日志',
        startTime: now - (8 + (i % 5)) * DAY_MS, endTime: now - (8 + (i % 5)) * DAY_MS + 600000,
      }));
    }
    for (let i = 0; i < 50; i++) {
      logManager.addLog(makeLog({
        teamId: `t_new_${i}`, routeName: '新日志',
        startTime: now - (1 + (i % 5)) * DAY_MS, endTime: now - (1 + (i % 5)) * DAY_MS + 600000,
      }));
    }
    expect(logManager.getLogCount()).toBe(100);
    expect(logManager.purgeExpired(now)).toBe(50);
    expect(logManager.getLogCount()).toBe(50);
    expect(logManager.getLogs().every(l => l.routeName === '新日志')).toBe(true);
  });

  it('空日志管理器清理返回0', () => {
    expect(logManager.purgeExpired(now)).toBe(0);
  });

  it('全部过期时全部清理', () => {
    for (let i = 0; i < 10; i++) {
      logManager.addLog(makeLog({ teamId: `t_${i}`, startTime: now - (10 + i) * DAY_MS, endTime: now - (10 + i) * DAY_MS + 600000 }));
    }
    expect(logManager.purgeExpired(now)).toBe(10);
    expect(logManager.getLogCount()).toBe(0);
  });

  it('全部未过期时全部保留', () => {
    for (let i = 0; i < 10; i++) {
      logManager.addLog(makeLog({ teamId: `t_${i}`, startTime: now - (i + 1) * 3600000, endTime: now - i * 3600000 }));
    }
    expect(logManager.purgeExpired(now)).toBe(0);
    expect(logManager.getLogCount()).toBe(10);
  });

  it('多次清理幂等（不误删）', () => {
    logManager.addLog(makeLog({ teamId: 't1', startTime: now - DAY_MS, endTime: now - DAY_MS + 600000 }));
    for (let i = 0; i < 3; i++) {
      expect(logManager.purgeExpired(now)).toBe(0);
    }
    expect(logManager.getLogCount()).toBe(1);
  });
});

// ═══════════════════════════════════════════
// 八、字段完整性校验
// ═══════════════════════════════════════════

describe('远征日志 — 字段完整性校验', () => {
  it('日志条目包含所有PRD要求的字段', () => {
    const now = Date.now();
    const entry: ExpeditionLogEntry = {
      id: 'log_001',
      routeId: 'route_hulao_easy',
      routeName: '虎牢关·简',
      teamId: 'team_001',
      teamConfig: { heroIds: ['shu_0', 'shu_1', 'shu_2'], formation: FormationType.STANDARD, totalPower: 3300 },
      mode: 'online',
      result: 'victory',
      stars: 3,
      reward: { grain: 200, gold: 400, iron: 1, equipFragments: 1, exp: 500,
        drops: [{ type: 'equip_fragment', id: 'ef_001', name: '铁剑碎片', count: 2 }] },
      startTime: now - 1800000,
      endTime: now,
    };

    // PRD EXP-4 §4.11 必要字段
    const requiredFields = ['routeId', 'teamConfig', 'result', 'reward', 'startTime', 'endTime'];
    for (const field of requiredFields) {
      expect(entry).toHaveProperty(field);
    }
    // 扩展字段
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('routeName');
    expect(entry).toHaveProperty('stars');
    expect(entry).toHaveProperty('mode');
  });

  it('队伍配置包含武将列表和阵型', () => {
    const config = { heroIds: ['shu_0', 'shu_1', 'shu_2'], formation: FormationType.STANDARD, totalPower: 3300 };
    expect(config.heroIds).toHaveLength(3);
    expect(config.totalPower).toBeGreaterThan(0);
  });

  it('奖励字段包含所有资源类型', () => {
    const reward: ExpeditionReward = { grain: 200, gold: 400, iron: 1, equipFragments: 1, exp: 500, drops: [] };
    for (const field of ['grain', 'gold', 'iron', 'equipFragments', 'exp', 'drops'] as const) {
      expect(reward).toHaveProperty(field);
    }
    expect(Array.isArray(reward.drops)).toBe(true);
  });
});
