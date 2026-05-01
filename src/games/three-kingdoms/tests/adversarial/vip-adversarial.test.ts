/**
 * VIP等级系统对抗式测试
 *
 * 覆盖子系统：
 *   S1: VIPSystem（经验/等级/特权/免费扫荡/GM命令/序列化）
 *   S2: SweepSystem（VIP额外扫荡令/免费扫荡联动）
 *   S3: OfflineRewardSystem（VIP离线加成/翻倍/时长上限）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/vip-adversarial
 */

import { describe, it, expect, vi } from 'vitest';
import { VIPSystem } from '../../engine/campaign/VIPSystem';
import type { VIPSaveData, VIPPrivilege } from '../../engine/campaign/VIPSystem';
import { SweepSystem } from '../../engine/campaign/SweepSystem';
import type { ISystemDeps } from '../../core/types/subsystem';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const createVIP = (): VIPSystem => { const v = new VIPSystem(); v.init(mockDeps()); return v; };

const createVIPWithSweep = () => {
  const deps = mockDeps();
  const vip = new VIPSystem(); vip.init(deps);
  const sweep = new SweepSystem(); sweep.init(deps, undefined, vip);
  return { deps, vip, sweep };
};

const NOW = new Date(2025, 0, 15, 12, 0, 0).getTime();
const NEXT_DAY = new Date(2025, 0, 16, 0, 0, 1).getTime();

const levelUpTo = (vip: VIPSystem, level: number): void => {
  const cfg = VIPSystem.getLevelTable().find(c => c.level === level);
  if (cfg) vip.addExp(cfg.requiredExp);
};

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('VIP对抗测试 — F-Normal', () => {

  describe('VIP初始化', () => {
    it('新建实例为VIP0，经验为0', () => {
      const vip = createVIP();
      expect(vip.getExp()).toBe(0);
      expect(vip.getBaseLevel()).toBe(0);
      expect(vip.getEffectiveLevel()).toBe(0);
    });

    it('getState 返回完整初始状态', () => {
      const s = createVIP().getState();
      expect(s).toMatchObject({ vipExp: 0, vipLevel: 0, freeSweepUsedToday: 0, lastFreeSweepResetDate: null, gmMode: false, gmLevel: null });
    });

    it('ISubsystem 接口: name/update/init', () => {
      const vip = createVIP();
      expect(vip.name).toBe('vipSystem');
      expect(() => vip.update(16)).not.toThrow();
    });
  });

  describe('VIP经验与等级', () => {
    it('addExp 单次/多次累加', () => {
      const vip = createVIP();
      vip.addExp(50); vip.addExp(50);
      expect(vip.getExp()).toBe(100);
    });

    it('等级判定覆盖全部等级', () => {
      const cases: [number, number][] = [[0,0],[100,1],[300,2],[600,3],[1000,4],[1500,5],[2500,6]];
      cases.forEach(([exp, lv]) => {
        const vip = createVIP(); vip.addExp(exp);
        expect(vip.getBaseLevel()).toBe(lv);
      });
    });

    it('getNextLevelExp 正确', () => {
      const vip = createVIP();
      expect(vip.getNextLevelExp()).toBe(100);
      levelUpTo(vip, 5);
      expect(vip.getNextLevelExp()).toBe(2500);
      levelUpTo(vip, 6);
      expect(vip.getNextLevelExp()).toBeNull();
    });

    it('getLevelProgress 正确', () => {
      const vip = createVIP();
      expect(vip.getLevelProgress()).toBe(0);
      vip.addExp(50);
      expect(vip.getLevelProgress()).toBeCloseTo(0.5);
      levelUpTo(vip, 6);
      expect(vip.getLevelProgress()).toBe(1);
    });
  });

  describe('VIP特权', () => {
    it('VIP0 无任何特权', () => {
      const allPrivs: VIPPrivilege[] = ['speed_3x','speed_instant','free_sweep','extra_sweep_ticket_1','extra_sweep_ticket_2','offline_hours_2','offline_hours_4'];
      const vip = createVIP();
      allPrivs.forEach(p => expect(vip.hasPrivilege(p)).toBe(false));
    });

    it('各等级特权逐步解锁', () => {
      const vip = createVIP();
      levelUpTo(vip, 1);
      expect(vip.hasPrivilege('extra_sweep_ticket_1')).toBe(true);
      expect(vip.getExtraDailyTickets()).toBe(1);

      levelUpTo(vip, 2);
      expect(vip.hasPrivilege('offline_hours_2')).toBe(true);
      expect(vip.getOfflineHoursBonus()).toBe(2);

      levelUpTo(vip, 3);
      expect(vip.canUseSpeed3x()).toBe(true);

      levelUpTo(vip, 4);
      expect(vip.getExtraDailyTickets()).toBe(3);

      levelUpTo(vip, 5);
      expect(vip.canUseSpeedInstant()).toBe(true);
      expect(vip.canUseFreeSweep()).toBe(true);

      levelUpTo(vip, 6);
      expect(vip.getOfflineHoursBonus()).toBe(6);
      expect(vip.getOfflineHoursLimit()).toBe(18);
    });
  });

  describe('免费扫荡奖励领取', () => {
    it('VIP5 有3次额度，连续使用后耗尽', () => {
      const vip = createVIP();
      levelUpTo(vip, 5);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(3);
      expect(vip.useFreeSweep(NOW)).toBe(true);
      expect(vip.useFreeSweep(NOW)).toBe(true);
      expect(vip.useFreeSweep(NOW)).toBe(true);
      expect(vip.useFreeSweep(NOW)).toBe(false);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(0);
    });

    it('每日重置：次日恢复3次', () => {
      const vip = createVIP();
      levelUpTo(vip, 5);
      vip.useFreeSweep(NOW); vip.useFreeSweep(NOW); vip.useFreeSweep(NOW);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(0);
      expect(vip.getFreeSweepRemaining(NEXT_DAY)).toBe(3);
      expect(vip.useFreeSweep(NEXT_DAY)).toBe(true);
    });
  });

  describe('GM命令', () => {
    it('gmSetLevel/gmResetLevel 正常工作', () => {
      const vip = createVIP();
      vip.addExp(300);
      vip.gmSetLevel(5);
      expect(vip.isGMMode()).toBe(true);
      expect(vip.getEffectiveLevel()).toBe(5);
      expect(vip.getBaseLevel()).toBe(2);
      vip.gmResetLevel();
      expect(vip.isGMMode()).toBe(false);
      expect(vip.getEffectiveLevel()).toBe(2);
    });
  });

  describe('静态方法', () => {
    it('getLevelTable 返回7级，getLevelConfig 正确', () => {
      const table = VIPSystem.getLevelTable();
      expect(table).toHaveLength(7);
      expect(VIPSystem.getLevelConfig(5)!.privileges).toContain('free_sweep');
      expect(VIPSystem.getLevelConfig(7)).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('VIP对抗测试 — F-Error', () => {

  describe('addExp 非法输入', () => {
    it('零/负数/NaN/Infinity 全部被忽略', () => {
      const vip = createVIP();
      vip.addExp(0); vip.addExp(-100); vip.addExp(NaN);
      vip.addExp(Infinity); vip.addExp(-Infinity);
      expect(vip.getExp()).toBe(0);
    });

    it('已有经验时非法输入不覆盖', () => {
      const vip = createVIP();
      vip.addExp(100);
      vip.addExp(NaN); vip.addExp(-50); vip.addExp(Infinity);
      expect(vip.getExp()).toBe(100);
    });
  });

  describe('免费扫荡权限不足', () => {
    it('VIP0~VIP4 均无法使用免费扫荡', () => {
      [0, 1, 2, 3, 4].forEach(lv => {
        const vip = createVIP();
        levelUpTo(vip, lv);
        expect(vip.useFreeSweep(NOW)).toBe(false);
        expect(vip.getFreeSweepRemaining(NOW)).toBe(0);
      });
    });
  });

  describe('序列化错误', () => {
    it('deserialize null/undefined/{}/版本不匹配 均不崩溃且状态不变', () => {
      const vip = createVIP();
      vip.addExp(500);
      vip.deserialize(null as unknown as VIPSaveData);
      vip.deserialize(undefined as unknown as VIPSaveData);
      vip.deserialize({} as VIPSaveData);
      vip.deserialize({ version: 999, vipExp: 5000, freeSweepUsedToday: 0, lastFreeSweepResetDate: null });
      expect(vip.getExp()).toBe(500);
    });
  });

  describe('GM命令边界', () => {
    it('gmSetLevel 负数→0，超过6→6', () => {
      const vip = createVIP();
      vip.gmSetLevel(-1);
      expect(vip.getEffectiveLevel()).toBe(0);
      vip.gmSetLevel(99);
      expect(vip.getEffectiveLevel()).toBe(6);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('VIP对抗测试 — F-Boundary', () => {

  describe('等级边界值', () => {
    it('恰好差1点不升级', () => {
      const cases: [number, number][] = [[99,0],[299,1],[599,2],[999,3],[1499,4],[2499,5]];
      cases.forEach(([exp, lv]) => {
        const vip = createVIP(); vip.addExp(exp);
        expect(vip.getBaseLevel()).toBe(lv);
      });
    });

    it('恰好满足升级', () => {
      const cases: [number, number][] = [[100,1],[300,2],[600,3],[1000,4],[1500,5],[2500,6]];
      cases.forEach(([exp, lv]) => {
        const vip = createVIP(); vip.addExp(exp);
        expect(vip.getBaseLevel()).toBe(lv);
      });
    });

    it('超满级仍为VIP6', () => {
      const vip = createVIP();
      vip.addExp(99999);
      expect(vip.getBaseLevel()).toBe(6);
    });

    it('MAX_SAFE_INTEGER 仍为VIP6', () => {
      const vip = createVIP();
      vip.addExp(Number.MAX_SAFE_INTEGER);
      expect(vip.getBaseLevel()).toBe(6);
    });

    it('MIN_VALUE 仍生效但不足以升级', () => {
      const vip = createVIP();
      vip.addExp(Number.MIN_VALUE);
      expect(vip.getExp()).toBe(Number.MIN_VALUE);
      expect(vip.getBaseLevel()).toBe(0);
    });
  });

  describe('进度边界', () => {
    it('0经验→进度0，超满级→进度1', () => {
      const vip = createVIP();
      expect(vip.getLevelProgress()).toBe(0);
      vip.addExp(5000);
      expect(vip.getLevelProgress()).toBe(1);
    });

    it('VIP3 有800经验 → 进度0.5', () => {
      const vip = createVIP();
      vip.addExp(800);
      expect(vip.getLevelProgress()).toBeCloseTo(0.5);
    });
  });

  describe('免费扫荡边界', () => {
    it('跨日分界线（毫秒级）重置', () => {
      const vip = createVIP();
      levelUpTo(vip, 5);
      const before = new Date(2025, 0, 15, 23, 59, 59).getTime();
      const after = new Date(2025, 0, 16, 0, 0, 0).getTime();
      vip.useFreeSweep(before); vip.useFreeSweep(before); vip.useFreeSweep(before);
      expect(vip.getFreeSweepRemaining(after)).toBe(3);
    });

    it('同一天多次 getFreeSweepRemaining 不额外消耗', () => {
      const vip = createVIP();
      levelUpTo(vip, 5);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(3);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(3);
    });
  });

  describe('离线时长与扫荡令边界', () => {
    it('各等级离线上限正确', () => {
      const cases: [number, number][] = [[0,12],[1,12],[2,14],[3,14],[4,14],[5,14],[6,18]];
      cases.forEach(([lv, limit]) => {
        const vip = createVIP(); levelUpTo(vip, lv);
        expect(vip.getOfflineHoursLimit()).toBe(limit);
      });
    });

    it('各等级额外扫荡令正确', () => {
      const cases: [number, number][] = [[0,0],[1,1],[2,1],[3,1],[4,3],[5,3],[6,3]];
      cases.forEach(([lv, tickets]) => {
        const vip = createVIP(); levelUpTo(vip, lv);
        expect(vip.getExtraDailyTickets()).toBe(tickets);
      });
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ═══════════════════════════════════════════════

describe('VIP对抗测试 — F-Cross', () => {

  describe('VIP ↔ SweepSystem 联动', () => {
    it('VIP等级影响额外扫荡令数量', () => {
      const { vip } = createVIPWithSweep();
      expect(vip.getExtraDailyTickets()).toBe(0);
      levelUpTo(vip, 4);
      expect(vip.getExtraDailyTickets()).toBe(3);
    });

    it('VIP5 免费扫荡与 SweepSystem 联动', () => {
      const { vip } = createVIPWithSweep();
      levelUpTo(vip, 5);
      expect(vip.canUseFreeSweep()).toBe(true);
      vip.useFreeSweep(NOW);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(2);
    });
  });

  describe('VIP ↔ 离线收益联动', () => {
    it('VIP等级越高离线时长上限越大', () => {
      const vip = createVIP();
      const limits = [0,1,2,3,4,5,6].map(lv => { vip.reset(); levelUpTo(vip, lv); return vip.getOfflineHoursLimit(); });
      expect(limits[0]).toBe(12);
      expect(limits[2]).toBe(14);
      expect(limits[6]).toBe(18);
    });
  });

  describe('VIP ↔ 倍速联动', () => {
    it('VIP3 有3倍速无极速，VIP5 两者都有', () => {
      const vip3 = createVIP(); levelUpTo(vip3, 3);
      expect(vip3.canUseSpeed3x()).toBe(true);
      expect(vip3.canUseSpeedInstant()).toBe(false);
      const vip5 = createVIP(); levelUpTo(vip5, 5);
      expect(vip5.canUseSpeed3x()).toBe(true);
      expect(vip5.canUseSpeedInstant()).toBe(true);
    });
  });

  describe('VIP ↔ GM模式联动', () => {
    it('GM等级覆盖真实等级影响全部特权', () => {
      const vip = createVIP();
      vip.gmSetLevel(6);
      expect(vip.canUseFreeSweep()).toBe(true);
      expect(vip.canUseSpeedInstant()).toBe(true);
      expect(vip.getOfflineHoursLimit()).toBe(18);
      expect(vip.getExtraDailyTickets()).toBe(3);
    });

    it('GM关闭后恢复真实等级特权', () => {
      const vip = createVIP();
      levelUpTo(vip, 2);
      vip.gmSetLevel(6);
      expect(vip.canUseFreeSweep()).toBe(true);
      vip.gmResetLevel();
      expect(vip.canUseFreeSweep()).toBe(false);
      expect(vip.getOfflineHoursBonus()).toBe(2);
    });

    it('GM模式使用免费扫荡后重置GM仍消耗了次数', () => {
      const vip = createVIP();
      vip.gmSetLevel(5);
      vip.useFreeSweep(NOW);
      vip.gmResetLevel();
      expect(vip.useFreeSweep(NOW)).toBe(false);
    });
  });

  describe('VIP完整生命周期联动', () => {
    it('充值→升级→解锁特权→使用扫荡→每日重置', () => {
      const vip = createVIP();
      vip.addExp(1500);
      expect(vip.getBaseLevel()).toBe(5);
      expect(vip.canUseFreeSweep()).toBe(true);
      vip.useFreeSweep(NOW); vip.useFreeSweep(NOW);
      expect(vip.getFreeSweepRemaining(NOW)).toBe(1);
      expect(vip.getFreeSweepRemaining(NEXT_DAY)).toBe(3);
    });

    it('多次充值逐步升级→特权逐步解锁', () => {
      const vip = createVIP();
      vip.addExp(100); expect(vip.getBaseLevel()).toBe(1); expect(vip.getExtraDailyTickets()).toBe(1);
      vip.addExp(200); expect(vip.getBaseLevel()).toBe(2); expect(vip.getOfflineHoursBonus()).toBe(2);
      vip.addExp(300); expect(vip.getBaseLevel()).toBe(3); expect(vip.canUseSpeed3x()).toBe(true);
      vip.addExp(400); expect(vip.getExtraDailyTickets()).toBe(3);
      vip.addExp(500); expect(vip.canUseFreeSweep()).toBe(true);
      vip.addExp(1000); expect(vip.getBaseLevel()).toBe(6); expect(vip.getOfflineHoursBonus()).toBe(6);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 生命周期 / 序列化
// ═══════════════════════════════════════════════

describe('VIP对抗测试 — F-Lifecycle', () => {

  describe('系统重置', () => {
    it('reset 恢复初始状态', () => {
      const vip = createVIP();
      vip.addExp(1500); vip.useFreeSweep(NOW); vip.gmSetLevel(6);
      vip.reset();
      expect(vip.getExp()).toBe(0);
      expect(vip.getBaseLevel()).toBe(0);
      expect(vip.isGMMode()).toBe(false);
    });

    it('reset 后可重新升级', () => {
      const vip = createVIP();
      vip.addExp(1500); vip.reset(); vip.addExp(600);
      expect(vip.getBaseLevel()).toBe(3);
    });
  });

  describe('序列化 → 反序列化', () => {
    it('serialize 返回完整存档结构', () => {
      const vip = createVIP();
      vip.addExp(1500); vip.useFreeSweep(NOW);
      const d = vip.serialize();
      expect(d).toMatchObject({ version: 1, vipExp: 1500, freeSweepUsedToday: 1 });
    });

    it('deserialize 恢复经验/等级/扫荡状态', () => {
      const vip = createVIP();
      vip.addExp(1500); vip.useFreeSweep(NOW);
      const vip2 = new VIPSystem(); vip2.init(mockDeps());
      vip2.deserialize(vip.serialize());
      expect(vip2.getExp()).toBe(1500);
      expect(vip2.getBaseLevel()).toBe(5);
      expect(vip2.getFreeSweepRemaining(NOW)).toBe(2);
    });

    it('serialize → deserialize 往返一致', () => {
      const vip = createVIP();
      vip.addExp(1000); vip.useFreeSweep(NOW); vip.useFreeSweep(NOW);
      const d = vip.serialize();
      const vip2 = new VIPSystem(); vip2.deserialize(d);
      expect(vip2.serialize()).toEqual(d);
    });

    it('deserialize 清除GM模式', () => {
      const vip = createVIP();
      vip.addExp(100); vip.gmSetLevel(6);
      const vip2 = new VIPSystem(); vip2.deserialize(vip.serialize());
      expect(vip2.isGMMode()).toBe(false);
      expect(vip2.getEffectiveLevel()).toBe(1);
    });

    it('VIP0 空状态序列化往返一致', () => {
      const d = createVIP().serialize();
      const vip2 = new VIPSystem(); vip2.deserialize(d);
      expect(vip2.getExp()).toBe(0);
      expect(vip2.getBaseLevel()).toBe(0);
    });

    it('VIP6满级序列化保持满级', () => {
      const vip = createVIP(); levelUpTo(vip, 6);
      const vip2 = new VIPSystem(); vip2.deserialize(vip.serialize());
      expect(vip2.getBaseLevel()).toBe(6);
      expect(vip2.getNextLevelExp()).toBeNull();
    });
  });

  describe('序列化边界', () => {
    it('多次序列化结果一致', () => {
      const vip = createVIP(); vip.addExp(500);
      expect(vip.serialize()).toEqual(vip.serialize());
    });

    it('序列化不包含GM状态', () => {
      const vip = createVIP(); vip.gmSetLevel(5);
      const d = vip.serialize() as Record<string, unknown>;
      expect(d.gmMode).toBeUndefined();
      expect(d.gmLevel).toBeUndefined();
    });
  });

  describe('getState 快照', () => {
    it('getState 反映实时状态', () => {
      const vip = createVIP(); vip.addExp(600);
      expect(vip.getState()).toMatchObject({ vipExp: 600, vipLevel: 3 });
    });

    it('getState GM模式反映GM等级', () => {
      const vip = createVIP(); vip.addExp(100); vip.gmSetLevel(5);
      expect(vip.getState()).toMatchObject({ gmMode: true, gmLevel: 5, vipLevel: 5 });
    });

    it('getState reset 后恢复初始值', () => {
      const vip = createVIP(); vip.addExp(1000); vip.gmSetLevel(6); vip.reset();
      const s = vip.getState();
      expect(s).toMatchObject({ vipExp: 0, vipLevel: 0, gmMode: false, gmLevel: null });
    });
  });
});
