/**
 * alliance/alliance-constants.ts 单元测试
 *
 * 覆盖导出函数：
 * - generateId
 * - createDefaultAlliancePlayerState
 * - createAllianceData
 *
 * 验证常量：
 * - DEFAULT_CREATE_CONFIG
 * - ALLIANCE_LEVEL_CONFIGS
 * - ALLIANCE_SAVE_VERSION
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CREATE_CONFIG,
  ALLIANCE_LEVEL_CONFIGS,
  ALLIANCE_SAVE_VERSION,
  generateId,
  createDefaultAlliancePlayerState,
  createAllianceData,
} from '../alliance-constants';

// ═══════════════════════════════════════════
// generateId
// ═══════════════════════════════════════════
describe('generateId', () => {
  it('包含指定前缀', () => {
    const id = generateId('alliance');
    expect(id).toMatch(/^alliance_/);
  });

  it('包含时间戳和随机串', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test_\d+_[a-z0-9]+$/);
  });

  it('每次调用生成不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(generateId('x'));
    }
    // 允许极少量碰撞，但 20 次应该都不同
    expect(ids.size).toBeGreaterThanOrEqual(19);
  });

  it('空前缀仍然生成有效 ID', () => {
    const id = generateId('');
    expect(id).toMatch(/^_\d+_/);
  });
});

// ═══════════════════════════════════════════
// createDefaultAlliancePlayerState
// ═══════════════════════════════════════════
describe('createDefaultAlliancePlayerState', () => {
  it('返回有效的默认状态', () => {
    const state = createDefaultAlliancePlayerState();
    expect(state.allianceId).toBe('');
    expect(state.guildCoins).toBe(0);
    expect(state.dailyBossChallenges).toBe(0);
    expect(state.dailyContribution).toBe(0);
  });

  it('lastDailyReset 为 0', () => {
    const state = createDefaultAlliancePlayerState();
    expect(state.lastDailyReset).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = createDefaultAlliancePlayerState();
    const b = createDefaultAlliancePlayerState();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ═══════════════════════════════════════════
// createAllianceData
// ═══════════════════════════════════════════
describe('createAllianceData', () => {
  const now = Date.now();

  it('创建包含指定信息的联盟数据', () => {
    const data = createAllianceData('id1', '蜀汉', '兴复汉室', 'liubei', '刘备', now);
    expect(data.id).toBe('id1');
    expect(data.name).toBe('蜀汉');
    expect(data.declaration).toBe('兴复汉室');
    expect(data.leaderId).toBe('liubei');
  });

  it('初始等级为 1', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.level).toBe(1);
  });

  it('初始经验为 0', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.experience).toBe(0);
  });

  it('包含创建者为 LEADER 成员', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader1', '盟主', now);
    const leader = data.members['leader1'];
    expect(leader).toBeDefined();
    expect(leader.role).toBe('LEADER');
    expect(leader.playerName).toBe('盟主');
    expect(leader.joinTime).toBe(now);
  });

  it('初始申请列表为空', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.applications).toEqual([]);
  });

  it('初始公告列表为空', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.announcements).toEqual([]);
  });

  it('初始消息列表为空', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.messages).toEqual([]);
  });

  it('createTime 等于传入的 now', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.createTime).toBe(now);
  });

  it('bossKilledToday 初始为 false', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.bossKilledToday).toBe(false);
  });

  it('dailyTaskCompleted 初始为 0', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(data.dailyTaskCompleted).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    const b = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    expect(a).not.toBe(b);
    expect(a.members).not.toBe(b.members);
  });

  it('leader 成员的 dailyContribution 和 totalContribution 初始为 0', () => {
    const data = createAllianceData('id', 'test', 'test', 'leader', 'leader', now);
    const leader = data.members['leader'];
    expect(leader.dailyContribution).toBe(0);
    expect(leader.totalContribution).toBe(0);
    expect(leader.dailyBossChallenges).toBe(0);
  });
});

// ═══════════════════════════════════════════
// 常量验证
// ═══════════════════════════════════════════
describe('常量', () => {
  it('DEFAULT_CREATE_CONFIG 有合理参数', () => {
    expect(DEFAULT_CREATE_CONFIG.createCostGold).toBeGreaterThan(0);
    expect(DEFAULT_CREATE_CONFIG.nameMinLength).toBeGreaterThan(0);
    expect(DEFAULT_CREATE_CONFIG.nameMaxLength).toBeGreaterThanOrEqual(DEFAULT_CREATE_CONFIG.nameMinLength);
    expect(DEFAULT_CREATE_CONFIG.maxMessages).toBeGreaterThan(0);
  });

  it('ALLIANCE_LEVEL_CONFIGS 非空且等级递增', () => {
    expect(ALLIANCE_LEVEL_CONFIGS.length).toBeGreaterThan(0);
    for (let i = 1; i < ALLIANCE_LEVEL_CONFIGS.length; i++) {
      expect(ALLIANCE_LEVEL_CONFIGS[i].level).toBeGreaterThan(ALLIANCE_LEVEL_CONFIGS[i - 1].level);
    }
  });

  it('ALLIANCE_LEVEL_CONFIGS requiredExp 递增', () => {
    for (let i = 1; i < ALLIANCE_LEVEL_CONFIGS.length; i++) {
      expect(ALLIANCE_LEVEL_CONFIGS[i].requiredExp).toBeGreaterThan(ALLIANCE_LEVEL_CONFIGS[i - 1].requiredExp);
    }
  });

  it('ALLIANCE_LEVEL_CONFIGS maxMembers 递增', () => {
    for (let i = 1; i < ALLIANCE_LEVEL_CONFIGS.length; i++) {
      expect(ALLIANCE_LEVEL_CONFIGS[i].maxMembers).toBeGreaterThanOrEqual(ALLIANCE_LEVEL_CONFIGS[i - 1].maxMembers);
    }
  });

  it('ALLIANCE_SAVE_VERSION 为正整数', () => {
    expect(ALLIANCE_SAVE_VERSION).toBeGreaterThan(0);
  });
});
