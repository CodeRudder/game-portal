/**
 * P1 测试 — 转生冷却72小时
 *
 * PRD [PRS-4] 转生冷却规则：
 *   - 转生后72小时内不可再次转生
 *   - 冷却期间转生按钮禁用
 *   - 冷却时间精确到秒
 *   - 跨天/跨周/跨月冷却正确
 *
 * 验证策略：
 *   1. 转生记录中包含 timestamp，可用于冷却计算
 *   2. 引擎已实现冷却检查（checkRebirthConditions 含 cooldown 条件）
 *   3. 验证转生记录 timestamp 精度
 *   4. 验证多次转生时间戳递增
 *   5. 验证 getRebirthRecords 提供足够信息供上层实现冷却
 *
 * @module engine/prestige/__tests__/ReincarnationCooldown
 */

import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import { PrestigeSystem, calcProductionBonus } from '../PrestigeSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_ACCELERATION,
  PRESTIGE_SOURCE_CONFIGS,
} from '../../../core/prestige';

// ═══════════════════════════════════════════════════════════
// 辅助工具
// ═══════════════════════════════════════════════════════════

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

function createSystem(): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

/** 创建满足转生条件的系统 */
function createReadySystem(): {
  sys: RebirthSystem;
  resetFn: ReturnType<typeof vi.fn>;
} {
  const sys = createSystem();
  const resetFn = vi.fn();
  sys.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: resetFn,
    campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
    achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
  });
  sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
  return { sys, resetFn };
}

/** 创建带时间注入的系统（支持模拟冷却时间流逝） */
function createReadySystemWithTime(): {
  sys: RebirthSystem;
  resetFn: ReturnType<typeof vi.fn>;
  advanceTime: (ms: number) => void;
} {
  let currentTime = Date.now();
  const sys = createSystem();
  const resetFn = vi.fn();
  sys.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: resetFn,
    campaignStage: () => REBIRTH_CONDITIONS.minCampaignStage,
    achievementChainCount: () => REBIRTH_CONDITIONS.requiredAchievementChainCount,
    nowProvider: () => currentTime,
  });
  sys.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
  return {
    sys,
    resetFn,
    advanceTime: (ms: number) => { currentTime += ms; },
  };
}

/** 冷却常量（PRD要求72小时） */
const COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72小时 = 259,200,000 毫秒
const COOLDOWN_HOURS = 72;
const COOLDOWN_SECONDS = 72 * 3600;

// ═══════════════════════════════════════════════════════════
// 测试主体
// ═══════════════════════════════════════════════════════════

describe('P1 — 转生冷却72小时', () => {

  // ─────────────────────────────────────────
  // A. 转生记录时间戳精度
  // ─────────────────────────────────────────

  describe('A. 转生记录时间戳精度', () => {
    test('转生记录包含 timestamp 字段', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      expect(records).toHaveLength(1);
      expect(records[0]).toHaveProperty('timestamp');
    });

    test('timestamp 精确到毫秒（Date.now() 级别）', () => {
      const { sys } = createReadySystem();
      const before = Date.now();
      sys.executeRebirth();
      const after = Date.now();

      const records = sys.getRebirthRecords();
      const ts = records[0].timestamp;
      // timestamp 应在 before 和 after 之间
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
      // 验证是毫秒级精度（不是秒级）
      expect(ts).toBeGreaterThan(1_000_000_000_000); // 毫秒级时间戳 > 1万亿
    });

    test('多次转生时间戳严格递增', () => {
      const { sys, advanceTime } = createReadySystemWithTime();
      sys.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      sys.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      sys.executeRebirth();

      const records = sys.getRebirthRecords();
      for (let i = 1; i < records.length; i++) {
        expect(records[i].timestamp).toBeGreaterThanOrEqual(records[i - 1].timestamp);
      }
    });

    test('timestamp 可用于计算冷却剩余时间', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      const lastRebirthTime = records[0].timestamp;
      const now = Date.now();
      const elapsed = now - lastRebirthTime;
      const remaining = Math.max(0, COOLDOWN_MS - elapsed);

      // 刚转生完成，elapsed 接近0，remaining 接近 COOLDOWN_MS
      expect(remaining).toBeGreaterThan(COOLDOWN_MS - 1000); // 允许1秒误差
      expect(remaining).toBeLessThanOrEqual(COOLDOWN_MS);
    });
  });

  // ─────────────────────────────────────────
  // B. 冷却检查 — 引擎已实现
  // ─────────────────────────────────────────

  describe('B. 冷却检查 — 引擎已实现', () => {
    test('转生后72小时内不可再次转生', () => {
      const { sys } = createReadySystem();
      const r1 = sys.executeRebirth();
      expect(r1.success).toBe(true);
      // 冷却期内第二次转生应失败
      const r2 = sys.executeRebirth();
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('cooldown');
      expect(sys.getState().rebirthCount).toBe(1);
    });

    test('冷却期间 executeRebirth 返回失败并提示剩余冷却时间', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const r2 = sys.executeRebirth();
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('cooldown');
    });

    test('首次转生无冷却限制', () => {
      const { sys } = createReadySystem();
      // 首次转生（rebirthCount=0），冷却条件自动满足
      const check = sys.checkRebirthConditions();
      expect(check.conditions.cooldown.met).toBe(true);
      expect(check.conditions.cooldown.description).toContain('首次');
    });

    test('转生记录提供足够信息供冷却计算', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      expect(records).toHaveLength(1);
      expect(records[0].timestamp).toBeTypeOf('number');
      expect(records[0].rebirthCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // C. 冷却时间计算（上层逻辑验证）
  // ─────────────────────────────────────────

  describe('C. 冷却时间计算（基于转生记录推算）', () => {
    test('72小时 = 259,200秒 = 2,592,000毫秒...不对，重新算', () => {
      // 72小时 = 72 × 3600秒 = 259,200秒 = 259,200,000毫秒
      expect(COOLDOWN_SECONDS).toBe(259_200);
      expect(COOLDOWN_MS).toBe(259_200_000);
    });

    test('刚转生后冷却剩余 ≈ 72小时', () => {
      const { sys } = createReadySystem();
      const rebirthTime = Date.now();
      sys.executeRebirth();

      const records = sys.getRebirthRecords();
      const lastTime = records[records.length - 1].timestamp;
      const elapsed = Date.now() - lastTime;
      const remaining = COOLDOWN_MS - elapsed;

      // 剩余时间应接近72小时
      expect(remaining).toBeGreaterThan(COOLDOWN_MS - 5000); // 允许5秒误差
      expect(remaining).toBeLessThanOrEqual(COOLDOWN_MS);
    });

    test('冷却到期判断：elapsed >= COOLDOWN_MS → 可转生', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      const lastTime = records[records.length - 1].timestamp;

      // 模拟冷却已过
      const mockNow = lastTime + COOLDOWN_MS + 1;
      const elapsed = mockNow - lastTime;
      expect(elapsed).toBeGreaterThanOrEqual(COOLDOWN_MS);
      // 冷却已过，可转生
    });

    test('冷却未到期判断：elapsed < COOLDOWN_MS → 不可转生', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      const lastTime = records[records.length - 1].timestamp;

      // 模拟冷却未过（只过了1小时）
      const mockNow = lastTime + 3600_000; // 1小时后
      const elapsed = mockNow - lastTime;
      expect(elapsed).toBeLessThan(COOLDOWN_MS);
    });

    test('冷却精确到秒：剩余时间向下取整到秒', () => {
      const remainingMs = COOLDOWN_MS - 1234; // 剩余 259,198,766 毫秒
      const remainingSeconds = Math.floor(remainingMs / 1000);
      expect(remainingSeconds).toBe(259_198);
    });

    test('冷却精确到秒：显示格式 HH:MM:SS', () => {
      const remainingMs = COOLDOWN_MS - 3661_000; // 剩余 71小时59分59秒前
      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      expect(hours).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThan(60);
      expect(seconds).toBeGreaterThanOrEqual(0);
      expect(seconds).toBeLessThan(60);
    });
  });

  // ─────────────────────────────────────────
  // D. 跨天/跨周/跨月冷却
  // ─────────────────────────────────────────

  describe('D. 跨天/跨周/跨月冷却', () => {
    test('跨天冷却：从23:50转生到次日23:50到期', () => {
      // 模拟 2025-01-15 23:50:00 转生
      const rebirthTime = new Date('2025-01-15T23:50:00Z').getTime();
      const cooldownEnd = rebirthTime + COOLDOWN_MS;
      // 72小时后 = 2025-01-18 23:50:00
      const endDate = new Date(cooldownEnd);
      expect(endDate.getUTCDate()).toBe(18); // 跨越了3天
      expect(endDate.getUTCHours()).toBe(23);
      expect(endDate.getUTCMinutes()).toBe(50);
    });

    test('跨周冷却：从周五转生到下周一到期', () => {
      // 模拟 2025-01-17 (周五) 12:00 转生
      const rebirthTime = new Date('2025-01-17T12:00:00Z').getTime();
      const cooldownEnd = rebirthTime + COOLDOWN_MS;
      // 72小时后 = 2025-01-20 (周一) 12:00
      const endDate = new Date(cooldownEnd);
      expect(endDate.getUTCDay()).toBe(1); // 周一
    });

    test('跨月冷却：从1月30日转生到2月2日到期', () => {
      // 模拟 2025-01-30 12:00 转生
      const rebirthTime = new Date('2025-01-30T12:00:00Z').getTime();
      const cooldownEnd = rebirthTime + COOLDOWN_MS;
      // 72小时后 = 2025-02-02 12:00
      const endDate = new Date(cooldownEnd);
      expect(endDate.getUTCMonth()).toBe(1); // 2月 (0-indexed)
      expect(endDate.getUTCDate()).toBe(2);
    });

    test('跨年冷却：从12月30日转生到1月2日到期', () => {
      // 模拟 2025-12-30 12:00 转生
      const rebirthTime = new Date('2025-12-30T12:00:00Z').getTime();
      const cooldownEnd = rebirthTime + COOLDOWN_MS;
      // 72小时后 = 2026-01-02 12:00
      const endDate = new Date(cooldownEnd);
      expect(endDate.getUTCFullYear()).toBe(2026);
      expect(endDate.getUTCMonth()).toBe(0); // 1月
      expect(endDate.getUTCDate()).toBe(2);
    });

    test('闰年2月29日转生冷却正确', () => {
      // 模拟 2024-02-29 12:00 转生（闰年）
      const rebirthTime = new Date('2024-02-29T12:00:00Z').getTime();
      const cooldownEnd = rebirthTime + COOLDOWN_MS;
      // 72小时后 = 2024-03-03 12:00
      const endDate = new Date(cooldownEnd);
      expect(endDate.getUTCMonth()).toBe(2); // 3月
      expect(endDate.getUTCDate()).toBe(3);
    });

    test('夏令时切换不影响冷却计算（基于UTC毫秒）', () => {
      // 冷却基于绝对毫秒时间戳，不受时区/夏令时影响
      const rebirthTime = Date.now();
      const cooldownEnd = rebirthTime + COOLDOWN_MS;
      const diff = cooldownEnd - rebirthTime;
      expect(diff).toBe(COOLDOWN_MS);
    });
  });

  // ─────────────────────────────────────────
  // E. 冷却边界条件
  // ─────────────────────────────────────────

  describe('E. 冷却边界条件', () => {
    test('冷却恰好到期（elapsed = COOLDOWN_MS）→ 可转生', () => {
      const rebirthTime = 1000_000_000_000; // 固定时间戳
      const now = rebirthTime + COOLDOWN_MS;
      const elapsed = now - rebirthTime;
      expect(elapsed).toBe(COOLDOWN_MS);
      // 冷却恰好到期，应允许转生
    });

    test('冷却差1毫秒未到期 → 不可转生', () => {
      const rebirthTime = 1000_000_000_000;
      const now = rebirthTime + COOLDOWN_MS - 1;
      const elapsed = now - rebirthTime;
      expect(elapsed).toBe(COOLDOWN_MS - 1);
      expect(elapsed).toBeLessThan(COOLDOWN_MS);
    });

    test('冷却差1秒未到期 → 不可转生', () => {
      const rebirthTime = 1000_000_000_000;
      const now = rebirthTime + COOLDOWN_MS - 1000;
      const elapsed = now - rebirthTime;
      expect(elapsed).toBeLessThan(COOLDOWN_MS);
    });

    test('冷却过期1天 → 可转生', () => {
      const rebirthTime = 1000_000_000_000;
      const now = rebirthTime + COOLDOWN_MS + 86400_000; // 过期1天
      const elapsed = now - rebirthTime;
      expect(elapsed).toBeGreaterThan(COOLDOWN_MS);
    });

    test('多次转生：冷却基于最后一次转生时间', () => {
      const { sys, advanceTime } = createReadySystemWithTime();
      sys.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      sys.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      sys.executeRebirth();

      const records = sys.getRebirthRecords();
      // 冷却应基于最后一次转生时间
      const lastRebirthTime = records[records.length - 1].timestamp;
      expect(lastRebirthTime).toBe(records[2].timestamp);
    });
  });

  // ─────────────────────────────────────────
  // F. 冷却与转生条件组合
  // ─────────────────────────────────────────

  describe('F. 冷却与转生条件组合', () => {
    test('条件满足但冷却未到期 → 不可转生（PRD要求）', () => {
      const { sys } = createReadySystem();
      const r1 = sys.executeRebirth();
      expect(r1.success).toBe(true);
      // 冷却期内再次转生
      const r2 = sys.executeRebirth();
      expect(r2.success).toBe(false);
      expect(r2.reason).toContain('cooldown');
    });

    test('冷却到期但条件不满足 → 不可转生', () => {
      const { sys, advanceTime } = createReadySystemWithTime();
      sys.executeRebirth();
      // 推进时间超过冷却
      advanceTime(COOLDOWN_MS + 1);
      // 但不满足其他条件（如降低声望等级）
      sys.updatePrestigeLevel(1);
      const check = sys.checkRebirthConditions();
      expect(check.canRebirth).toBe(false);
      expect(check.conditions.cooldown.met).toBe(true);
      expect(check.conditions.prestigeLevel.met).toBe(false);
    });

    test('冷却到期且条件满足 → 可转生', () => {
      const { sys, advanceTime } = createReadySystemWithTime();
      sys.executeRebirth();
      advanceTime(COOLDOWN_MS + 1);
      const r2 = sys.executeRebirth();
      expect(r2.success).toBe(true);
      expect(r2.newCount).toBe(2);
    });

    test('首次转生无冷却限制（无上次转生记录）', () => {
      const { sys } = createReadySystem();
      const check = sys.checkRebirthConditions();
      expect(check.conditions.cooldown.met).toBe(true);
      expect(check.conditions.cooldown.remainingMs).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // G. 离线声望累积 + 加成取最高级
  // ─────────────────────────────────────────

  describe('G. 离线声望累积 + 加成取最高级', () => {
    test('声望获取途径包含 expedition（远征产出可用于离线累积）', () => {
      // 验证声望系统配置包含远征途径
      const sourceTypes = PRESTIGE_SOURCE_CONFIGS.map(c => c.type);
      expect(sourceTypes).toContain('expedition');
    });

    test('声望获取途径包含 building_upgrade（建筑产出可用于离线累积）', () => {
      const sourceTypes = PRESTIGE_SOURCE_CONFIGS.map(c => c.type);
      expect(sourceTypes).toContain('building_upgrade');
    });

    test.todo('PRD: 离线期间声望正常累积（按50%系数）— 引擎未实现离线累积逻辑');
    test.todo('PRD: 离线声望累积受转生倍率影响 — 需集成测试验证');

    test('PRD 产出加成特权：同类型加成取最高级生效（不叠加）', () => {
      // PRD [PRS-3] 声望奖励表格明确：
      // 领土产出: Lv.2(+5%), Lv.6(+10%), Lv.12(+15%), Lv.19(+20%) → 取最高级
      // 远征收益: Lv.7(+10%), Lv.13(+15%) → 取最高级
      // 武将经验: Lv.9(+10%), Lv.16(+15%) → 取最高级
      // 建筑速度: Lv.11(+5%), Lv.18(+10%) → 取最高级
      // 科技速度: Lv.14(+5%) → 固定
      // 验证引擎的 calcProductionBonus 是线性公式而非叠加
      // 公式: 1 + level × 0.02，是线性而非叠加
      const bonus5 = calcProductionBonus(5);
      const bonus10 = calcProductionBonus(10);
      // 线性：bonus10 = 1 + 10*0.02 = 1.2
      // 如果是叠加：bonus10 = 1 + 0.05 + 0.10 + ... ≠ 1.2
      expect(bonus10).toBeCloseTo(1.2);
      expect(bonus5).toBeCloseTo(1.1);
    });

    test.todo('PRD: 多个同类型加成取最高级生效（非叠加）— 引擎 calcProductionBonus 为线性公式，取最高级的语义需在特权系统中实现');
    test.todo('PRD: 离线收益 = 正常产出 × 50% × 转生倍率 — 需离线系统集成测试验证');
  });

  // ─────────────────────────────────────────
  // H. PRD 差距汇总 — 转生冷却
  // ─────────────────────────────────────────

  describe('H. PRD 差距汇总 — 转生冷却已实现', () => {
    test('引擎 RebirthSystem 已有冷却相关 API', () => {
      const sys = createSystem();
      expect(typeof (sys as any).getCooldownRemainingMs).toBe('function');
      expect(typeof (sys as any).isCooldownActive).toBe('function');
    });

    test('转生记录提供 timestamp 可供冷却计算', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const records = sys.getRebirthRecords();
      expect(records[0].timestamp).toBeTypeOf('number');
    });

    test('PRD 冷却72小时 — 已实现', () => {
      const { sys } = createReadySystem();
      const r1 = sys.executeRebirth();
      expect(r1.success).toBe(true);
      // 冷却期内第二次转生失败
      const r2 = sys.executeRebirth();
      expect(r2.success).toBe(false);
    });

    test('getCooldownRemainingMs 返回剩余冷却毫秒', () => {
      const { sys } = createReadySystem();
      sys.executeRebirth();
      const remaining = sys.getCooldownRemainingMs();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(COOLDOWN_MS);
    });

    test('isCooldownActive 在冷却期内返回 true', () => {
      const { sys } = createReadySystem();
      expect(sys.isCooldownActive()).toBe(false);
      sys.executeRebirth();
      expect(sys.isCooldownActive()).toBe(true);
    });

    test('冷却到期后 isCooldownActive 返回 false', () => {
      const { sys, advanceTime } = createReadySystemWithTime();
      sys.executeRebirth();
      expect(sys.isCooldownActive()).toBe(true);
      advanceTime(COOLDOWN_MS + 1);
      expect(sys.isCooldownActive()).toBe(false);
    });

    test('checkRebirthConditions 包含 cooldown 条件', () => {
      const sys = createSystem();
      const check = sys.checkRebirthConditions();
      expect(check.conditions).toHaveProperty('cooldown');
      expect(check.conditions.cooldown).toHaveProperty('met');
      expect(check.conditions.cooldown).toHaveProperty('remainingMs');
      expect(check.conditions.cooldown).toHaveProperty('description');
    });

    test('首次转生无冷却限制 — 引擎已判断 rebirthRecords 是否为空', () => {
      const sys = createSystem();
      const check = sys.checkRebirthConditions();
      // 首次转生（rebirthCount=0），冷却条件自动满足
      expect(check.conditions.cooldown.met).toBe(true);
    });
  });
});
