/**
 * P1 测试 — 声望转生倍率作用范围
 *
 * PRD [PRS-4] 倍率作用范围：
 *   ✅ 受影响（6项）：资源产出、建筑速度、科研速度、武将经验、招募折扣、远征收益
 *   ❌ 不受影响（3项）：VIP等级、充值金额、已购买商品
 *
 * 验证策略：
 *   1. 转生后 getEffectiveMultipliers 返回的倍率正确覆盖受影响系统
 *   2. 转生倍率不应用于 VIP / 充值 / 已购买商品
 *   3. 加速期内倍率叠加正确
 *   4. 加速期结束后倍率回落
 *
 * @module engine/prestige/__tests__/PrestigeMultiplierScope
 */

import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { RebirthSystem, calcRebirthMultiplier } from '../RebirthSystem';
import type { ISystemDeps } from '../../../core/types';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_ACCELERATION,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
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

/** 创建满足所有转生条件的系统并执行转生 */
function createRebirthedSystem(rebirthTimes: number = 1): {
  sys: RebirthSystem;
  resetFn: ReturnType<typeof vi.fn>;
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

  const COOLDOWN_MS = 72 * 60 * 60 * 1000;
  for (let i = 0; i < rebirthTimes; i++) {
    sys.executeRebirth();
    currentTime += COOLDOWN_MS + 1; // 推进冷却时间
  }

  return { sys, resetFn };
}

// ═══════════════════════════════════════════════════════════
// 测试主体
// ═══════════════════════════════════════════════════════════

describe('P1 — 声望转生倍率作用范围', () => {

  // ─────────────────────────────────────────
  // A. 受影响系统（6项） — 倍率正确应用
  // ─────────────────────────────────────────

  describe('A. 受影响系统（6项）— 倍率正确应用', () => {

    // A1. 资源产出
    describe('A1. 资源产出倍率', () => {
      test('转生后 getEffectiveMultipliers.resource > 1.0', () => {
        const { sys } = createRebirthedSystem(1);
        const mults = sys.getEffectiveMultipliers();
        expect(mults.resource).toBeGreaterThan(1.0);
      });

      test('资源倍率 = 转生倍率 × 加速资源倍率（加速期内）', () => {
        const { sys } = createRebirthedSystem(1);
        const rebirthMult = sys.getCurrentMultiplier();
        const mults = sys.getEffectiveMultipliers();
        expect(mults.resource).toBeCloseTo(rebirthMult * REBIRTH_ACCELERATION.resourceMultiplier);
      });

      test('多次转生后资源倍率递增', () => {
        const { sys: sys1 } = createRebirthedSystem(1);
        const { sys: sys3 } = createRebirthedSystem(3);
        expect(sys3.getEffectiveMultipliers().resource).toBeGreaterThan(
          sys1.getEffectiveMultipliers().resource,
        );
      });

      test('加速期结束后资源倍率回落为纯转生倍率', () => {
        const { sys } = createRebirthedSystem(1);
        const state = sys.getState();
        // 模拟加速期结束
        const expiredState = { ...state, accelerationDaysLeft: 0 };
        const newSys = createSystem();
        newSys.loadSaveData({ rebirth: expiredState });

        const mults = newSys.getEffectiveMultipliers();
        const rebirthMult = newSys.getCurrentMultiplier();
        expect(mults.resource).toBeCloseTo(rebirthMult);
        // 不再包含加速倍率
        expect(mults.resource).toBeLessThan(
          rebirthMult * REBIRTH_ACCELERATION.resourceMultiplier,
        );
      });

      test('未转生时资源倍率 = 1.0', () => {
        const sys = createSystem();
        expect(sys.getEffectiveMultipliers().resource).toBeCloseTo(1.0);
      });
    });

    // A2. 建筑速度
    describe('A2. 建筑升级速度倍率', () => {
      test('转生后 buildSpeed > 1.0', () => {
        const { sys } = createRebirthedSystem(1);
        expect(sys.getEffectiveMultipliers().buildSpeed).toBeGreaterThan(1.0);
      });

      test('建筑速度 = 转生倍率 × 加速建筑倍率（加速期内）', () => {
        const { sys } = createRebirthedSystem(1);
        const rebirthMult = sys.getCurrentMultiplier();
        expect(sys.getEffectiveMultipliers().buildSpeed).toBeCloseTo(
          rebirthMult * REBIRTH_ACCELERATION.buildSpeedMultiplier,
        );
      });

      test('calculateBuildTime 在加速期内除以更高倍率', () => {
        const { sys } = createRebirthedSystem(1);
        const baseTime = 3600; // 1小时
        const highLevel = 20; // 超过 maxInstantLevel
        const actualTime = sys.calculateBuildTime(baseTime, highLevel);
        // 加速期内: baseTime / multiplier / acceleration.buildSpeed
        const rebirthMult = sys.getCurrentMultiplier();
        const expected = Math.max(1, Math.floor(
          baseTime / rebirthMult / REBIRTH_ACCELERATION.buildSpeedMultiplier,
        ));
        expect(actualTime).toBe(expected);
        expect(actualTime).toBeLessThan(baseTime);
      });

      test('加速期结束后建筑速度回落为纯转生倍率', () => {
        const { sys } = createRebirthedSystem(1);
        const state = sys.getState();
        const expiredState = { ...state, accelerationDaysLeft: 0 };
        const newSys = createSystem();
        newSys.loadSaveData({ rebirth: expiredState });

        const mults = newSys.getEffectiveMultipliers();
        const rebirthMult = newSys.getCurrentMultiplier();
        expect(mults.buildSpeed).toBeCloseTo(rebirthMult);
      });

      test('未转生时建筑速度 = 1.0', () => {
        const sys = createSystem();
        expect(sys.getEffectiveMultipliers().buildSpeed).toBeCloseTo(1.0);
      });
    });

    // A3. 科研速度
    describe('A3. 科技研究速度倍率', () => {
      test('转生后 techSpeed > 1.0', () => {
        const { sys } = createRebirthedSystem(1);
        expect(sys.getEffectiveMultipliers().techSpeed).toBeGreaterThan(1.0);
      });

      test('科研速度 = 转生倍率 × 加速科研倍率（加速期内）', () => {
        const { sys } = createRebirthedSystem(1);
        const rebirthMult = sys.getCurrentMultiplier();
        expect(sys.getEffectiveMultipliers().techSpeed).toBeCloseTo(
          rebirthMult * REBIRTH_ACCELERATION.techSpeedMultiplier,
        );
      });

      test('加速期结束后科研速度回落', () => {
        const { sys } = createRebirthedSystem(1);
        const state = sys.getState();
        const expiredState = { ...state, accelerationDaysLeft: 0 };
        const newSys = createSystem();
        newSys.loadSaveData({ rebirth: expiredState });

        const mults = newSys.getEffectiveMultipliers();
        expect(mults.techSpeed).toBeCloseTo(newSys.getCurrentMultiplier());
      });

      test('未转生时科研速度 = 1.0', () => {
        const sys = createSystem();
        expect(sys.getEffectiveMultipliers().techSpeed).toBeCloseTo(1.0);
      });
    });

    // A4. 武将经验
    describe('A4. 武将经验倍率', () => {
      test('转生后 exp > 1.0', () => {
        const { sys } = createRebirthedSystem(1);
        expect(sys.getEffectiveMultipliers().exp).toBeGreaterThan(1.0);
      });

      test('经验倍率 = 转生倍率 × 加速经验倍率（加速期内）', () => {
        const { sys } = createRebirthedSystem(1);
        const rebirthMult = sys.getCurrentMultiplier();
        expect(sys.getEffectiveMultipliers().exp).toBeCloseTo(
          rebirthMult * REBIRTH_ACCELERATION.expMultiplier,
        );
      });

      test('加速期结束后经验倍率回落', () => {
        const { sys } = createRebirthedSystem(1);
        const state = sys.getState();
        const expiredState = { ...state, accelerationDaysLeft: 0 };
        const newSys = createSystem();
        newSys.loadSaveData({ rebirth: expiredState });

        expect(newSys.getEffectiveMultipliers().exp).toBeCloseTo(newSys.getCurrentMultiplier());
      });

      test('未转生时经验倍率 = 1.0', () => {
        const sys = createSystem();
        expect(sys.getEffectiveMultipliers().exp).toBeCloseTo(1.0);
      });
    });

    // A5. 招募折扣
    describe('A5. 招募折扣倍率', () => {
      test.todo('PRD: 招募折扣受倍率影响 — 引擎 getEffectiveMultipliers 未包含 recruitDiscount 字段');
      test.todo('招募折扣 = 基础消耗 / 转生倍率 — 待引擎实现');
    });

    // A6. 远征收益
    describe('A6. 远征收益倍率', () => {
      test.todo('PRD: 远征收益受倍率影响 — 引擎 getEffectiveMultipliers 未包含 expeditionBonus 字段');
      test.todo('远征收益 = 基础收益 × 转生倍率 — 待引擎实现');
    });
  });

  // ─────────────────────────────────────────
  // B. 不受影响系统（3项）— 倍率不应用
  // ─────────────────────────────────────────

  describe('B. 不受影响系统（3项）— 倍率不应用', () => {

    // B1. VIP等级
    describe('B1. VIP等级不受倍率影响', () => {
      test('保留规则包含 keep_vip，说明VIP独立于倍率', () => {
        expect(REBIRTH_KEEP_RULES).toContain('keep_vip');
      });

      test('getEffectiveMultipliers 不包含 vipMultiplier 字段', () => {
        const { sys } = createRebirthedSystem(1);
        const mults = sys.getEffectiveMultipliers();
        // getEffectiveMultipliers 仅返回 buildSpeed/techSpeed/resource/exp
        expect(Object.keys(mults)).not.toContain('vipMultiplier');
      });

      test.todo('PRD: VIP等级计算公式中不引用转生倍率 — 需跨系统集成测试验证');
    });

    // B2. 充值金额
    describe('B2. 充值金额不受倍率影响', () => {
      test('保留规则中充值相关数据不在重置列表', () => {
        const resetRules = [...REBIRTH_RESET_RULES];
        // 充值金额不在任何重置规则中
        expect(resetRules).not.toContain('reset_recharge');
        expect(resetRules).not.toContain('reset_payment');
        expect(resetRules).not.toContain('reset_vip');
      });

      test.todo('PRD: 充值金额独立于转生倍率 — 需支付系统集成测试验证');
    });

    // B3. 已购买商品
    describe('B3. 已购买商品不受倍率影响', () => {
      test('保留规则中已购买商品不在重置列表', () => {
        const resetRules = [...REBIRTH_RESET_RULES];
        expect(resetRules).not.toContain('reset_shop_purchases');
        expect(resetRules).not.toContain('reset_purchased_goods');
      });

      test.todo('PRD: 声望商店已购买商品记录在转生后保留 — 需 PrestigeShopSystem 集成测试验证');
    });
  });

  // ─────────────────────────────────────────
  // C. 倍率边界与一致性
  // ─────────────────────────────────────────

  describe('C. 倍率边界与一致性', () => {
    test('所有受影响倍率在加速期内的加速系数一致', () => {
      const { sys } = createRebirthedSystem(1);
      const mults = sys.getEffectiveMultipliers();
      const rebirthMult = sys.getCurrentMultiplier();

      // 加速期内：各倍率 = rebirthMult × 对应加速系数
      expect(mults.buildSpeed / rebirthMult).toBeCloseTo(REBIRTH_ACCELERATION.buildSpeedMultiplier);
      expect(mults.techSpeed / rebirthMult).toBeCloseTo(REBIRTH_ACCELERATION.techSpeedMultiplier);
      expect(mults.resource / rebirthMult).toBeCloseTo(REBIRTH_ACCELERATION.resourceMultiplier);
      expect(mults.exp / rebirthMult).toBeCloseTo(REBIRTH_ACCELERATION.expMultiplier);
    });

    test('getEffectiveMultipliers 返回4个字段', () => {
      const { sys } = createRebirthedSystem(1);
      const mults = sys.getEffectiveMultipliers();
      const keys = Object.keys(mults);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('buildSpeed');
      expect(keys).toContain('techSpeed');
      expect(keys).toContain('resource');
      expect(keys).toContain('exp');
    });

    test('多次转生后所有倍率单调递增', () => {
      const prevMults = createRebirthedSystem(1).sys.getEffectiveMultipliers();
      const nextMults = createRebirthedSystem(3).sys.getEffectiveMultipliers();

      expect(nextMults.buildSpeed).toBeGreaterThan(prevMults.buildSpeed);
      expect(nextMults.techSpeed).toBeGreaterThan(prevMults.techSpeed);
      expect(nextMults.resource).toBeGreaterThan(prevMults.resource);
      expect(nextMults.exp).toBeGreaterThan(prevMults.exp);
    });

    test('倍率不超过最大上限', () => {
      const { sys } = createRebirthedSystem(10);
      const mults = sys.getEffectiveMultipliers();
      // 即使10次转生 + 加速，各倍率不应超过合理上限
      // max = 10.0，加速最大 2.0，理论上限 = 20.0
      expect(mults.buildSpeed).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max * REBIRTH_ACCELERATION.buildSpeedMultiplier);
      expect(mults.resource).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max * REBIRTH_ACCELERATION.resourceMultiplier);
    });

    test('getCurrentMultiplier 与 calcRebirthMultiplier 一致', () => {
      const { sys } = createRebirthedSystem(1);
      expect(sys.getCurrentMultiplier()).toBeCloseTo(calcRebirthMultiplier(1));
    });

    test('getNextMultiplier 预览下一次转生倍率', () => {
      const { sys } = createRebirthedSystem(1);
      expect(sys.getNextMultiplier()).toBeCloseTo(calcRebirthMultiplier(2));
      expect(sys.getNextMultiplier()).toBeGreaterThan(sys.getCurrentMultiplier());
    });

    test('转生倍率公式遵循对数衰减曲线', () => {
      // 验证递减特性：相邻两次转生的倍率增量逐渐减小
      const increments: number[] = [];
      for (let i = 1; i <= 10; i++) {
        const prev = calcRebirthMultiplier(i - 1);
        const curr = calcRebirthMultiplier(i);
        increments.push(curr - prev);
      }
      // 对数衰减：增量应逐渐减小
      for (let i = 1; i < increments.length; i++) {
        expect(increments[i]).toBeLessThanOrEqual(increments[i - 1]);
      }
    });
  });

  // ─────────────────────────────────────────
  // D. 低级建筑瞬间升级（倍率在建筑系统的特殊应用）
  // ─────────────────────────────────────────

  describe('D. 低级建筑瞬间升级', () => {
    test('≤maxInstantLevel 建筑升级时间大幅缩短', () => {
      const { sys } = createRebirthedSystem(1);
      const baseTime = 600;
      const time = sys.calculateBuildTime(baseTime, 5);
      expect(time).toBeLessThan(baseTime);
      expect(time).toBeGreaterThanOrEqual(1);
    });

    test('>maxInstantLevel 建筑在加速期内除以倍率×加速', () => {
      const { sys } = createRebirthedSystem(1);
      const baseTime = 3600;
      const level = 15;
      const time = sys.calculateBuildTime(baseTime, level);
      const rebirthMult = sys.getCurrentMultiplier();
      const expected = Math.max(1, Math.floor(
        baseTime / rebirthMult / REBIRTH_ACCELERATION.buildSpeedMultiplier,
      ));
      expect(time).toBe(expected);
    });

    test('未转生时 calculateBuildTime 返回原始时间', () => {
      const sys = createSystem();
      // multiplier=1.0, accelerationDaysLeft=0 → 返回原始时间
      const baseTime = 600;
      const time = sys.calculateBuildTime(baseTime, 15);
      expect(time).toBe(baseTime);
    });
  });

  // ─────────────────────────────────────────
  // E. PRD 差距汇总 — 倍率作用范围
  // ─────────────────────────────────────────

  describe('E. PRD 差距汇总 — 倍率作用范围', () => {
    test('PRD 要求6项受影响，引擎 getEffectiveMultipliers 仅实现4项', () => {
      const { sys } = createRebirthedSystem(1);
      const mults = sys.getEffectiveMultipliers();
      const keys = Object.keys(mults);
      // 引擎实现了：buildSpeed, techSpeed, resource, exp
      // 缺失：recruitDiscount（招募折扣）, expeditionBonus（远征收益）
      expect(keys).toHaveLength(4);
    });

    test.todo('PRD: 招募折扣受倍率影响 — getEffectiveMultipliers 需新增 recruitDiscount 字段');
    test.todo('PRD: 远征收益受倍率影响 — getEffectiveMultipliers 需新增 expeditionBonus 字段');
    test.todo('PRD: 关卡扫荡收益受倍率影响 — 待引擎实现 sweepBonus 字段');
    test.todo('PRD: 离线收益受倍率影响 — 待引擎实现 offlineBonus 字段');

    test('PRD 要求3项不受影响，引擎无对应字段（正确行为）', () => {
      const { sys } = createRebirthedSystem(1);
      const mults = sys.getEffectiveMultipliers();
      // 确认不存在不应受影响的字段
      expect(mults).not.toHaveProperty('vipMultiplier');
      expect(mults).not.toHaveProperty('rechargeMultiplier');
      expect(mults).not.toHaveProperty('shopPriceMultiplier');
    });
  });
});
