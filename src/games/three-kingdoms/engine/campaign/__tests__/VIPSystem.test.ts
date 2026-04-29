/**
 * VIPSystem 单元测试
 *
 * 覆盖VIP等级系统的核心功能：
 * - 经验累积与等级判定
 * - 特权解锁校验
 * - 免费扫荡每日重置
 * - GM命令
 * - 序列化/反序列化
 * - ISubsystem 接口
 */

import { describe, it, expect } from 'vitest';
import { VIPSystem } from '../VIPSystem';
import type { VIPState, VIPSaveData, VIPPrivilege } from '../VIPSystem';

// ─────────────────────────────────────────────
// 辅助：创建固定时间戳
// ─────────────────────────────────────────────

/** 2025-01-15 10:00:00 UTC+8 */
const NOW_MORNING = new Date(2025, 0, 15, 10, 0, 0).getTime();
/** 2025-01-15 23:59:59 UTC+8 */
const NOW_EVENING = new Date(2025, 0, 15, 23, 59, 59).getTime();
/** 2025-01-16 00:00:01 UTC+8 (次日) */
const NOW_NEXT_DAY = new Date(2025, 0, 16, 0, 0, 1).getTime();

// ─────────────────────────────────────────────
// 1. 初始状态与 ISubsystem 接口
// ─────────────────────────────────────────────

describe('VIPSystem 初始状态', () => {
  it('新建实例应为VIP0', () => {
    const vip = new VIPSystem();
    expect(vip.getExp()).toBe(0);
    expect(vip.getBaseLevel()).toBe(0);
    expect(vip.getEffectiveLevel()).toBe(0);
  });

  it('getState 返回正确的初始状态', () => {
    const vip = new VIPSystem();
    const state: VIPState = vip.getState();
    expect(state.vipExp).toBe(0);
    expect(state.vipLevel).toBe(0);
    expect(state.freeSweepUsedToday).toBe(0);
    expect(state.lastFreeSweepResetDate).toBeNull();
    expect(state.gmMode).toBe(false);
    expect(state.gmLevel).toBeNull();
  });

  it('reset 恢复初始状态', () => {
    const vip = new VIPSystem();
    vip.addExp(500);
    vip.gmSetLevel(5);
    vip.reset();
    expect(vip.getExp()).toBe(0);
    expect(vip.getEffectiveLevel()).toBe(0);
    expect(vip.isGMMode()).toBe(false);
  });

  it('ISubsystem 接口: name 属性', () => {
    const vip = new VIPSystem();
    expect(vip.name).toBe('vipSystem');
  });

  it('ISubsystem 接口: update 不抛异常', () => {
    const vip = new VIPSystem();
    expect(() => vip.update(16)).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// 2. 经验与等级
// ─────────────────────────────────────────────

describe('VIPSystem 经验与等级', () => {
  it('addExp 增加经验', () => {
    const vip = new VIPSystem();
    vip.addExp(100);
    expect(vip.getExp()).toBe(100);
  });

  it('addExp 忽略非正数', () => {
    const vip = new VIPSystem();
    vip.addExp(0);
    expect(vip.getExp()).toBe(0);
    vip.addExp(-50);
    expect(vip.getExp()).toBe(0);
  });

  it('addExp 可多次累加', () => {
    const vip = new VIPSystem();
    vip.addExp(50);
    vip.addExp(50);
    expect(vip.getExp()).toBe(100);
  });

  it('等级判定: 0exp → VIP0', () => {
    const vip = new VIPSystem();
    expect(vip.getBaseLevel()).toBe(0);
  });

  it('等级判定: 100exp → VIP1', () => {
    const vip = new VIPSystem();
    vip.addExp(100);
    expect(vip.getBaseLevel()).toBe(1);
  });

  it('等级判定: 300exp → VIP2', () => {
    const vip = new VIPSystem();
    vip.addExp(300);
    expect(vip.getBaseLevel()).toBe(2);
  });

  it('等级判定: 600exp → VIP3', () => {
    const vip = new VIPSystem();
    vip.addExp(600);
    expect(vip.getBaseLevel()).toBe(3);
  });

  it('等级判定: 1000exp → VIP4', () => {
    const vip = new VIPSystem();
    vip.addExp(1000);
    expect(vip.getBaseLevel()).toBe(4);
  });

  it('等级判定: 1500exp → VIP5', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    expect(vip.getBaseLevel()).toBe(5);
  });

  it('等级判定: 2500exp → VIP6 (满级)', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.getBaseLevel()).toBe(6);
  });

  it('等级判定: 超过满级仍为VIP6', () => {
    const vip = new VIPSystem();
    vip.addExp(9999);
    expect(vip.getBaseLevel()).toBe(6);
  });

  it('等级判定: 边界值 99exp → VIP0', () => {
    const vip = new VIPSystem();
    vip.addExp(99);
    expect(vip.getBaseLevel()).toBe(0);
  });

  it('等级判定: 边界值 299exp → VIP1', () => {
    const vip = new VIPSystem();
    vip.addExp(299);
    expect(vip.getBaseLevel()).toBe(1);
  });

  it('getNextLevelExp: VIP0 下一级需100', () => {
    const vip = new VIPSystem();
    expect(vip.getNextLevelExp()).toBe(100);
  });

  it('getNextLevelExp: VIP6 (满级) 返回 null', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.getNextLevelExp()).toBeNull();
  });

  it('getLevelProgress: VIP0 经验0 → 0', () => {
    const vip = new VIPSystem();
    expect(vip.getLevelProgress()).toBe(0);
  });

  it('getLevelProgress: VIP0 经验50 → 0.5', () => {
    const vip = new VIPSystem();
    vip.addExp(50);
    expect(vip.getLevelProgress()).toBeCloseTo(0.5);
  });

  it('getLevelProgress: VIP6 (满级) → 1', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.getLevelProgress()).toBe(1);
  });

  it('getLevelProgress: 超过满级经验仍为1', () => {
    const vip = new VIPSystem();
    vip.addExp(5000);
    expect(vip.getLevelProgress()).toBe(1);
  });
});

// ─────────────────────────────────────────────
// 3. 特权校验
// ─────────────────────────────────────────────

describe('VIPSystem 特权校验', () => {
  it('VIP0 无任何特权', () => {
    const vip = new VIPSystem();
    expect(vip.hasPrivilege('speed_3x')).toBe(false);
    expect(vip.hasPrivilege('speed_instant')).toBe(false);
    expect(vip.hasPrivilege('free_sweep')).toBe(false);
    expect(vip.hasPrivilege('extra_sweep_ticket_1')).toBe(false);
    expect(vip.hasPrivilege('extra_sweep_ticket_2')).toBe(false);
    expect(vip.hasPrivilege('offline_hours_2')).toBe(false);
    expect(vip.hasPrivilege('offline_hours_4')).toBe(false);
  });

  it('VIP1 解锁 extra_sweep_ticket_1', () => {
    const vip = new VIPSystem();
    vip.addExp(100);
    expect(vip.hasPrivilege('extra_sweep_ticket_1')).toBe(true);
    expect(vip.hasPrivilege('extra_sweep_ticket_2')).toBe(false);
  });

  it('VIP3 解锁 speed_3x', () => {
    const vip = new VIPSystem();
    vip.addExp(600);
    expect(vip.canUseSpeed3x()).toBe(true);
    expect(vip.canUseSpeedInstant()).toBe(false);
  });

  it('VIP5 解锁 speed_instant 和 free_sweep', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    expect(vip.canUseSpeedInstant()).toBe(true);
    expect(vip.canUseFreeSweep()).toBe(true);
  });

  it('VIP6 解锁 offline_hours_4', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.hasPrivilege('offline_hours_4')).toBe(true);
  });

  it('getExtraDailyTickets: VIP0 → 0', () => {
    const vip = new VIPSystem();
    expect(vip.getExtraDailyTickets()).toBe(0);
  });

  it('getExtraDailyTickets: VIP1 → 1', () => {
    const vip = new VIPSystem();
    vip.addExp(100);
    expect(vip.getExtraDailyTickets()).toBe(1);
  });

  it('getExtraDailyTickets: VIP4 → 3 (1+2)', () => {
    const vip = new VIPSystem();
    vip.addExp(1000);
    expect(vip.getExtraDailyTickets()).toBe(3);
  });

  it('getExtraDailyTickets: VIP6 → 3 (1+2)', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.getExtraDailyTickets()).toBe(3);
  });

  it('getOfflineHoursBonus: VIP0 → 0', () => {
    const vip = new VIPSystem();
    expect(vip.getOfflineHoursBonus()).toBe(0);
  });

  it('getOfflineHoursBonus: VIP2 → 2', () => {
    const vip = new VIPSystem();
    vip.addExp(300);
    expect(vip.getOfflineHoursBonus()).toBe(2);
  });

  it('getOfflineHoursBonus: VIP6 → 6 (2+4)', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.getOfflineHoursBonus()).toBe(6);
  });

  it('getOfflineHoursLimit: VIP0 → 12 (基础)', () => {
    const vip = new VIPSystem();
    expect(vip.getOfflineHoursLimit()).toBe(12);
  });

  it('getOfflineHoursLimit: VIP6 → 18', () => {
    const vip = new VIPSystem();
    vip.addExp(2500);
    expect(vip.getOfflineHoursLimit()).toBe(18);
  });
});

// ─────────────────────────────────────────────
// 4. 免费扫荡
// ─────────────────────────────────────────────

describe('VIPSystem 免费扫荡', () => {
  it('VIP0 无免费扫荡权限', () => {
    const vip = new VIPSystem();
    expect(vip.getFreeSweepRemaining(NOW_MORNING)).toBe(0);
  });

  it('VIP5 有3次免费扫荡', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    expect(vip.getFreeSweepRemaining(NOW_MORNING)).toBe(3);
  });

  it('useFreeSweep 成功消耗一次', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    expect(vip.useFreeSweep(NOW_MORNING)).toBe(true);
    expect(vip.getFreeSweepRemaining(NOW_MORNING)).toBe(2);
  });

  it('useFreeSweep 3次后返回false', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    expect(vip.useFreeSweep(NOW_MORNING)).toBe(true);
    expect(vip.useFreeSweep(NOW_MORNING)).toBe(true);
    expect(vip.useFreeSweep(NOW_MORNING)).toBe(true);
    expect(vip.useFreeSweep(NOW_MORNING)).toBe(false);
    expect(vip.getFreeSweepRemaining(NOW_MORNING)).toBe(0);
  });

  it('免费扫荡每日重置', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    // 第一天用完3次
    vip.useFreeSweep(NOW_MORNING);
    vip.useFreeSweep(NOW_MORNING);
    vip.useFreeSweep(NOW_MORNING);
    expect(vip.getFreeSweepRemaining(NOW_EVENING)).toBe(0);
    // 第二天重置
    expect(vip.getFreeSweepRemaining(NOW_NEXT_DAY)).toBe(3);
  });

  it('useFreeSweep 跨日重置后可继续使用', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    vip.useFreeSweep(NOW_MORNING);
    vip.useFreeSweep(NOW_MORNING);
    vip.useFreeSweep(NOW_MORNING);
    expect(vip.useFreeSweep(NOW_NEXT_DAY)).toBe(true);
  });

  it('VIP5以下 useFreeSweep 返回false', () => {
    const vip = new VIPSystem();
    vip.addExp(600); // VIP3
    expect(vip.useFreeSweep(NOW_MORNING)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 5. GM命令
// ─────────────────────────────────────────────

describe('VIPSystem GM命令', () => {
  it('gmSetLevel 设置GM等级', () => {
    const vip = new VIPSystem();
    vip.gmSetLevel(5);
    expect(vip.isGMMode()).toBe(true);
    expect(vip.getEffectiveLevel()).toBe(5);
    // 基础等级不变
    expect(vip.getBaseLevel()).toBe(0);
  });

  it('gmSetLevel 负数钳制为0', () => {
    const vip = new VIPSystem();
    vip.gmSetLevel(-1);
    expect(vip.getEffectiveLevel()).toBe(0);
  });

  it('gmSetLevel 超过6钳制为6', () => {
    const vip = new VIPSystem();
    vip.gmSetLevel(99);
    expect(vip.getEffectiveLevel()).toBe(6);
  });

  it('gmResetLevel 恢复真实等级', () => {
    const vip = new VIPSystem();
    vip.addExp(300); // VIP2
    vip.gmSetLevel(6);
    expect(vip.getEffectiveLevel()).toBe(6);
    vip.gmResetLevel();
    expect(vip.isGMMode()).toBe(false);
    expect(vip.getEffectiveLevel()).toBe(2);
  });

  it('GM模式下特权校验使用GM等级', () => {
    const vip = new VIPSystem();
    vip.gmSetLevel(5);
    expect(vip.canUseFreeSweep()).toBe(true);
    expect(vip.canUseSpeedInstant()).toBe(true);
  });

  it('GM模式关闭后特权恢复', () => {
    const vip = new VIPSystem();
    vip.gmSetLevel(5);
    vip.gmResetLevel();
    expect(vip.canUseFreeSweep()).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 6. 序列化/反序列化
// ─────────────────────────────────────────────

describe('VIPSystem 序列化', () => {
  it('serialize 返回正确数据', () => {
    const vip = new VIPSystem();
    vip.addExp(1500); // VIP5, 才有免费扫荡
    vip.useFreeSweep(NOW_MORNING);
    const data: VIPSaveData = vip.serialize();
    expect(data.version).toBe(1);
    expect(data.vipExp).toBe(1500);
    expect(data.freeSweepUsedToday).toBe(1);
    expect(data.lastFreeSweepResetDate).toBeDefined();
  });

  it('deserialize 恢复状态', () => {
    const vip = new VIPSystem();
    vip.addExp(1500);
    vip.useFreeSweep(NOW_MORNING);
    const data = vip.serialize();

    const vip2 = new VIPSystem();
    vip2.deserialize(data);
    expect(vip2.getExp()).toBe(1500);
    expect(vip2.getBaseLevel()).toBe(5);
    expect(vip2.isGMMode()).toBe(false);
  });

  it('deserialize 忽略版本不匹配', () => {
    const vip = new VIPSystem();
    vip.addExp(500);
    const badData = { version: 999, vipExp: 1000, freeSweepUsedToday: 0, lastFreeSweepResetDate: null };
    vip.deserialize(badData as VIPSaveData);
    // 状态不变
    expect(vip.getExp()).toBe(500);
  });

  it('deserialize 忽略 null 数据', () => {
    const vip = new VIPSystem();
    vip.addExp(500);
    vip.deserialize(null as unknown as VIPSaveData);
    expect(vip.getExp()).toBe(500);
  });

  it('deserialize 清除GM模式', () => {
    const vip = new VIPSystem();
    vip.addExp(100);
    vip.gmSetLevel(6);
    const data = vip.serialize();
    const vip2 = new VIPSystem();
    vip2.deserialize(data);
    expect(vip2.isGMMode()).toBe(false);
    expect(vip2.getEffectiveLevel()).toBe(1);
  });
});

// ─────────────────────────────────────────────
// 7. 静态方法
// ─────────────────────────────────────────────

describe('VIPSystem 静态方法', () => {
  it('getLevelTable 返回7个等级配置', () => {
    const table = VIPSystem.getLevelTable();
    expect(table).toHaveLength(7);
    expect(table[0].level).toBe(0);
    expect(table[6].level).toBe(6);
  });

  it('getLevelConfig 返回指定等级配置', () => {
    const cfg = VIPSystem.getLevelConfig(5);
    expect(cfg).toBeDefined();
    expect(cfg!.level).toBe(5);
    expect(cfg!.requiredExp).toBe(1500);
    expect(cfg!.privileges).toContain('speed_instant');
    expect(cfg!.privileges).toContain('free_sweep');
  });

  it('getLevelConfig 不存在返回 undefined', () => {
    expect(VIPSystem.getLevelConfig(7)).toBeUndefined();
    expect(VIPSystem.getLevelConfig(-1)).toBeUndefined();
  });
});
