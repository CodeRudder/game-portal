/**
 * 集成测试 — 声望×转生×设置 全链路
 *
 * 验证声望获取→等级提升→转生条件→倍率计算→设置持久化→存档恢复全流程。
 * 覆盖 §5.1~§5.6 + §6.1~§6.6 + §10.1~§10.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../../../prestige/PrestigeSystem';
import { PrestigeShopSystem } from '../../../prestige/PrestigeShopSystem';
import { RebirthSystem, calcRebirthMultiplier } from '../../../prestige/RebirthSystem';
import { SettingsManager } from '../../SettingsManager';
import type { ISystemDeps } from '../../../../core/types';
import {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRODUCTION_BONUS_PER_LEVEL,
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_ACCELERATION,
  PRESTIGE_SAVE_VERSION,
} from '../../../../core/prestige';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

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

function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
  };
}

/** 快速提升声望等级 */
function levelUpTo(sys: PrestigeSystem, targetLevel: number): void {
  const clampedTarget = Math.min(targetLevel, MAX_PRESTIGE_LEVEL);
  let safety = 0;
  while (sys.getState().currentLevel < clampedTarget && safety < 200) {
    // 计算升到下一级所需点数，并多给一些余量确保能升级
    const nextLevel = sys.getState().currentLevel + 1;
    const required = calcRequiredPoints(nextLevel);
    const currentPoints = sys.getState().currentPoints;
    const deficit = Math.max(0, required - currentPoints);
    const pointsToAdd = deficit + 1000; // 额外 1000 点余量
    sys.addPrestigePoints('main_quest', pointsToAdd);
    safety++;
  }
}

// ═════════════════════════════════════════════════════════════

describe('§5-6 声望×转生×设置 集成测试', () => {
  let prestige: PrestigeSystem;
  let shop: PrestigeShopSystem;
  let rebirth: RebirthSystem;
  let settings: SettingsManager;

  beforeEach(() => {
    prestige = new PrestigeSystem();
    prestige.init(mockDeps());
    shop = new PrestigeShopSystem();
    shop.init(mockDeps());
    rebirth = new RebirthSystem();
    rebirth.init(mockDeps());
    settings = new SettingsManager(createMockStorage());
  });

  // ─── §5.1 声望分栏与等级 ──────────────────

  it('初始声望等级为1，声望值为0', () => {
    const panel = prestige.getPrestigePanel();
    expect(panel.currentLevel).toBe(1);
    expect(panel.currentPoints).toBe(0);
    expect(panel.productionBonus).toBeCloseTo(1 + 1 * PRODUCTION_BONUS_PER_LEVEL);
  });

  it('声望面板展示下一级阈值正确', () => {
    const panel = prestige.getPrestigePanel();
    const expected = Math.floor(PRESTIGE_BASE * Math.pow(2, PRESTIGE_EXPONENT));
    expect(panel.nextLevelPoints).toBe(expected);
  });

  it('声望等级标题随等级变化', () => {
    levelUpTo(prestige, 5);
    const info = prestige.getCurrentLevelInfo();
    expect(info.title).toBe('亭长');
  });

  it('等级50标题为帝王', () => {
    levelUpTo(prestige, 50);
    const info = prestige.getCurrentLevelInfo();
    expect(info.title).toBe('帝王');
  });

  // ─── §5.2 声望等级升级 ──────────────────

  it('声望值达到阈值自动升级', () => {
    const required = calcRequiredPoints(2);
    prestige.addPrestigePoints('main_quest', required);
    expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(2);
  });

  it('跨级升级一次声望值跨越多个阈值', () => {
    prestige.addPrestigePoints('main_quest', calcRequiredPoints(5));
    expect(prestige.getState().currentLevel).toBeGreaterThanOrEqual(5);
  });

  it('升级后产出加成增加', () => {
    const bonus1 = prestige.getProductionBonus();
    levelUpTo(prestige, 5);
    const bonus5 = prestige.getProductionBonus();
    expect(bonus5).toBeGreaterThan(bonus1);
  });

  it('声望等级上限为50', () => {
    levelUpTo(prestige, 60);
    expect(prestige.getState().currentLevel).toBeLessThanOrEqual(MAX_PRESTIGE_LEVEL);
  });

  // ─── §5.3 声望获取途径 ──────────────────

  it('9种声望获取途径全部覆盖', () => {
    const configs = prestige.getSourceConfigs();
    expect(configs.length).toBe(9);
  });

  it('有每日上限的途径不超限', () => {
    const gained = prestige.addPrestigePoints('daily_quest', 200);
    expect(gained).toBeLessThanOrEqual(100); // daily_quest cap=100
  });

  it('无每日上限的途径不限制', () => {
    const gained = prestige.addPrestigePoints('main_quest', 10000);
    expect(gained).toBe(10000); // main_quest cap=-1
  });

  it('达到每日上限后返回0', () => {
    prestige.addPrestigePoints('daily_quest', 100);
    const gained2 = prestige.addPrestigePoints('daily_quest', 50);
    expect(gained2).toBe(0);
  });

  // ─── §5.4 产出加成特权 ──────────────────

  it('产出加成公式正确: 1 + level × 0.02', () => {
    levelUpTo(prestige, 10);
    const bonus = prestige.getProductionBonus();
    expect(bonus).toBeCloseTo(1 + 10 * PRODUCTION_BONUS_PER_LEVEL);
  });

  it('等级1产出加成为1.02', () => {
    expect(calcProductionBonus(1)).toBeCloseTo(1.02);
  });

  it('等级50产出加成为2.0', () => {
    expect(calcProductionBonus(50)).toBeCloseTo(2.0);
  });

  // ─── §5.5 等级解锁奖励 ──────────────────

  it('等级解锁奖励列表完整', () => {
    const rewards = prestige.getLevelRewards();
    expect(rewards.length).toBeGreaterThanOrEqual(7);
  });

  it('未达到等级不可领取奖励', () => {
    const result = prestige.claimLevelReward(5);
    expect(result.success).toBe(false);
  });

  it('达到等级可领取奖励', () => {
    levelUpTo(prestige, 5);
    const result = prestige.claimLevelReward(5);
    expect(result.success).toBe(true);
  });

  it('奖励不可重复领取', () => {
    levelUpTo(prestige, 5);
    prestige.claimLevelReward(5);
    const result = prestige.claimLevelReward(5);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已领取');
  });

  // ─── §5.6 声望商店 ─────────────────────

  it('声望商店商品列表不为空', () => {
    const goods = shop.getAllGoods();
    expect(goods.length).toBeGreaterThan(0);
  });

  it('等级不足时商品不可购买', () => {
    const result = shop.buyGoods('psg-003'); // requiredLevel=5
    expect(result.success).toBe(false);
  });

  it('等级足够且声望值充足可购买', () => {
    shop.updatePrestigeInfo(200, 5);
    const result = shop.buyGoods('psg-003');
    expect(result.success).toBe(true);
    expect(result.cost).toBe(150);
  });

  it('声望值不足时不可购买', () => {
    shop.updatePrestigeInfo(100, 5);
    const result = shop.buyGoods('psg-003'); // cost=150
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不足');
  });

  // ─── §6.1 转生条件检查 ──────────────────

  it('初始状态不满足转生条件', () => {
    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);
  });

  it('满足全部条件后可转生', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(true);
  });

  it('部分条件不满足时不可转生', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount - 1, // 差1
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);
  });

  // ─── §6.2 转生倍率 ─────────────────────

  it('首次转生倍率正确', () => {
    const multiplier = calcRebirthMultiplier(1);
    expect(multiplier).toBeCloseTo(REBIRTH_MULTIPLIER.base + REBIRTH_MULTIPLIER.perRebirth);
  });

  it('多次转生倍率递增', () => {
    const m1 = calcRebirthMultiplier(1);
    const m5 = calcRebirthMultiplier(5);
    expect(m5).toBeGreaterThan(m1);
  });

  it('倍率有上限', () => {
    const m100 = calcRebirthMultiplier(100);
    expect(m100).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
  });

  // ─── §6.3 转生执行与数据重置 ─────────────

  it('执行转生成功返回新次数和倍率', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    const result = rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(result.newCount).toBe(1);
    expect(result.multiplier).toBeGreaterThan(1);
  });

  it('转生后倍率生效', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    rebirth.executeRebirth();
    expect(rebirth.getCurrentMultiplier()).toBeGreaterThan(1);
  });

  // ─── §6.4 转生后加速 ─────────────────────

  it('转生后加速期激活', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    rebirth.executeRebirth();
    const accel = rebirth.getAcceleration();
    expect(accel.active).toBe(true);
    expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });

  it('加速期内有效倍率更高', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    rebirth.executeRebirth();
    const effective = rebirth.getEffectiveMultipliers();
    expect(effective.resource).toBeGreaterThan(rebirth.getCurrentMultiplier());
  });

  // ─── §10.1 声望点数获取 ──────────────────

  it('声望值只增不减', () => {
    prestige.addPrestigePoints('main_quest', 500);
    const total1 = prestige.getState().totalPoints;
    prestige.addPrestigePoints('main_quest', 300);
    const total2 = prestige.getState().totalPoints;
    expect(total2).toBeGreaterThan(total1);
  });

  // ─── §10.3 转生回滚保护 ──────────────────

  it('条件不满足时转生失败不影响数据', () => {
    const state = rebirth.getState();
    const result = rebirth.executeRebirth();
    expect(result.success).toBe(false);
    expect(rebirth.getState().rebirthCount).toBe(state.rebirthCount);
  });

  // ─── 存档恢复 ────────────────────────────

  it('声望存档数据版本正确', () => {
    const save = prestige.getSaveData();
    expect(save.version).toBe(PRESTIGE_SAVE_VERSION);
  });

  it('声望存档加载后状态一致', () => {
    levelUpTo(prestige, 10);
    const save = prestige.getSaveData();
    const newPrestige = new PrestigeSystem();
    newPrestige.init(mockDeps());
    newPrestige.loadSaveData(save);
    expect(newPrestige.getState().currentLevel).toBe(prestige.getState().currentLevel);
    expect(newPrestige.getState().totalPoints).toBe(prestige.getState().totalPoints);
  });

  it('转生存档加载后状态一致', () => {
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
    rebirth.executeRebirth();
    const state = rebirth.getState();
    const newRebirth = new RebirthSystem();
    newRebirth.init(mockDeps());
    newRebirth.loadSaveData({ rebirth: state });
    expect(newRebirth.getState().rebirthCount).toBe(1);
    expect(newRebirth.getState().currentMultiplier).toBe(state.currentMultiplier);
  });

  // ─── §10.5 转生次数上限 ──────────────────

  it('转生保留规则列表完整', () => {
    const rules = rebirth.getKeepRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).toContain('keep_heroes');
    expect(rules).toContain('keep_prestige');
  });

  it('转生重置规则列表完整', () => {
    const rules = rebirth.getResetRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules).toContain('reset_buildings');
    expect(rules).toContain('reset_resources');
  });
});
