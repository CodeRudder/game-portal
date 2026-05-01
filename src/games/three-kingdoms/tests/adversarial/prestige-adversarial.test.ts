/**
 * 声望模块对抗式测试 — Builder v2 产出
 *
 * 覆盖子系统：
 *   P1: PrestigeSystem        — 声望等级/获取/产出加成/任务
 *   P2: PrestigeShopSystem     — 声望商店购买/限购
 *   P3: RebirthSystem          — 转生条件/倍率/加速/解锁
 *   P4: RebirthSystem.helpers  — 转生辅助函数（建筑时间/增长曲线/时机对比）
 *
 * 5维度挑战：
 *   F-Error:     异常路径（无效来源/NaN/Infinity/负值/不满足条件/不存在商品）
 *   F-Cross:     跨系统交互（声望升级→商店解锁/转生→加速→建筑/任务→奖励→声望）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化/重置/每日重置/版本迁移）
 *   F-Boundary:  边界条件（满级/零声望/NaN/转生倍率上限/每日上限/满级后溢出）
 *   F-Normal:    正向流程（9种声望获取/等级奖励/转生模拟器/传承赠送）
 *
 * @module tests/adversarial/prestige-adversarial
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../../engine/prestige/PrestigeSystem';
import { PrestigeShopSystem } from '../../engine/prestige/PrestigeShopSystem';
import { RebirthSystem, calcRebirthMultiplier } from '../../engine/prestige/RebirthSystem';
import { calculateBuildTime, getAutoRebuildPlan, getUnlockContentsV16, isFeatureUnlocked, generatePrestigeGrowthCurve, compareRebirthTiming } from '../../engine/prestige/RebirthSystem.helpers';
import type { ISystemDeps } from '../../core/types';
import type { PrestigeSourceType } from '../../core/prestige';
import { MAX_PRESTIGE_LEVEL, PRESTIGE_BASE, PRESTIGE_EXPONENT, PRODUCTION_BONUS_PER_LEVEL, PRESTIGE_SOURCE_CONFIGS, PRESTIGE_SHOP_GOODS, LEVEL_UNLOCK_REWARDS, REBIRTH_CONDITIONS, REBIRTH_MULTIPLIER, REBIRTH_KEEP_RULES, REBIRTH_RESET_RULES, REBIRTH_ACCELERATION, REBIRTH_UNLOCK_CONTENTS, REBIRTH_INITIAL_GIFT, REBIRTH_INSTANT_BUILD, PRESTIGE_QUESTS, REBIRTH_QUESTS, calcRebirthMultiplierFromConfig } from '../../core/prestige';
// ── 测试辅助 ──────────────────────────────────
function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn(), set: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}
function createPrestige() { const s = new PrestigeSystem(); s.init(createMockDeps()); return s; }
function createShop() { const s = new PrestigeShopSystem(); s.init(createMockDeps()); return s; }
function createRebirth(overrides: {
  prestigeLevel?: number; castleLevel?: number; heroCount?: number; totalPower?: number;
} = {}): RebirthSystem {
  const sys = new RebirthSystem();
  sys.init(createMockDeps());
  sys.setCallbacks({
    castleLevel: () => overrides.castleLevel ?? REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => overrides.heroCount ?? REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => overrides.totalPower ?? REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => overrides.prestigeLevel ?? REBIRTH_CONDITIONS.minPrestigeLevel,
  });
  sys.updatePrestigeLevel(overrides.prestigeLevel ?? REBIRTH_CONDITIONS.minPrestigeLevel);
  return sys;
}
function levelUpPrestige(sys: PrestigeSystem, targetLevel: number): void {
  const required = calcRequiredPoints(targetLevel);
  sys.addPrestigePoints('main_quest' as PrestigeSourceType, required);
}
// ═══════════════════════════════════════════════
// F-Error: 异常路径覆盖
// ═══════════════════════════════════════════════
describe('F-Error: 声望获取异常路径', () => {
  let sys: PrestigeSystem;
  beforeEach(() => { sys = createPrestige(); });
  it('无效来源类型返回0且不修改状态', () => {
    const gained = sys.addPrestigePoints('invalid_type' as PrestigeSourceType, 100);
    expect(gained).toBe(0);
    expect(sys.getState().currentPoints).toBe(0);
    expect(sys.getState().totalPoints).toBe(0);
  });
  it('零声望值请求返回0', () => {
    expect(sys.addPrestigePoints('battle_victory', 0)).toBe(0);
  });
  it('负数声望值不应增加currentPoints或totalPoints', () => {
    sys.addPrestigePoints('battle_victory', -100);
    expect(sys.getState().currentPoints).toBeLessThanOrEqual(0);
    expect(sys.getState().totalPoints).toBeLessThanOrEqual(0);
  });
  it('Infinity声望值不应导致currentPoints为Infinity', () => {
    sys.addPrestigePoints('battle_victory', Infinity);
    expect(Number.isFinite(sys.getState().currentPoints)).toBe(true);
  });
  it('空字符串来源返回0', () => {
    expect(sys.addPrestigePoints('' as PrestigeSourceType, 100)).toBe(0);
  });
  it('NaN声望值被拒绝，不污染状态 — P0-001 FIXED', () => {
    sys.addPrestigePoints('battle_victory', NaN);
    const state = sys.getState();
    // ✅ FIXED (FIX-501): Number.isFinite(basePoints) 校验拒绝 NaN
    expect(Number.isNaN(state.currentPoints)).toBe(false);
    expect(Number.isNaN(state.totalPoints)).toBe(false);
    expect(state.currentPoints).toBe(0);
    expect(state.totalPoints).toBe(0);
  });
  it('负数声望值可能绕过每日上限 — P0 BUG', () => {
    sys.addPrestigePoints('battle_victory', 200); // 达到上限
    sys.addPrestigePoints('battle_victory', -50);  // 尝试负数减少dailyGained
    const state = sys.getState();
    // 期望：dailyGained不应减少，否则可绕过每日上限
    expect(state.dailyGained['battle_victory']).toBeGreaterThanOrEqual(200);
  });
});
describe('F-Error: 等级奖励异常路径', () => {
  let sys: PrestigeSystem;
  beforeEach(() => { sys = createPrestige(); });
  it('等级不足不能领取', () => {
    expect(sys.claimLevelReward(5).success).toBe(false);
    expect(sys.claimLevelReward(5).reason).toContain('等级不足');
  });
  it('无效等级(999)返回失败', () => {
    levelUpPrestige(sys, 50);
    const result = sys.claimLevelReward(999);
    expect(result.success).toBe(false);
    expect(result.reason).toBeTruthy();
  });
  it('重复领取同一等级奖励失败', () => {
    levelUpPrestige(sys, 10);
    expect(sys.claimLevelReward(5).success).toBe(true);
    const second = sys.claimLevelReward(5);
    expect(second.success).toBe(false);
    expect(second.reason).toContain('已领取');
  });
  it('领取等级0应失败（不在奖励列表）', () => {
    levelUpPrestige(sys, 50);
    const result = sys.claimLevelReward(0);
    expect(result.success).toBe(false);
  });
  it('负数等级领取应失败', () => {
    levelUpPrestige(sys, 50);
    const result = sys.claimLevelReward(-1);
    expect(result.success).toBe(false);
  });
});
describe('F-Error: 声望商店异常路径', () => {
  let shop: PrestigeShopSystem;
  beforeEach(() => { shop = createShop(); });
  it('购买不存在商品失败', () => {
    const r = shop.buyGoods('nonexistent_item', 1);
    expect(r.success).toBe(false);
    expect(r.reason).toContain('不存在');
  });
  it('等级不足不能购买', () => {
    shop.updatePrestigeInfo(1000, 1);
    expect(shop.buyGoods('psg-005', 1).success).toBe(false);
    expect(shop.buyGoods('psg-005', 1).reason).toContain('等级');
  });
  it('声望值不足不能购买', () => {
    shop.updatePrestigeInfo(10, 10);
    expect(shop.buyGoods('psg-005', 1).success).toBe(false);
    expect(shop.buyGoods('psg-005', 1).reason).toContain('不足');
  });
  it('超过限购数量失败', () => {
    shop.updatePrestigeInfo(99999, 5);
    const goods = PRESTIGE_SHOP_GOODS.find(g => g.id === 'psg-003')!;
    for (let i = 0; i < goods.purchaseLimit; i++) shop.buyGoods('psg-003', 1);
    const r = shop.buyGoods('psg-003', 1);
    expect(r.success).toBe(false);
    expect(r.reason).toContain('上限');
  });
  it('负数购买数量被拒绝，不增加声望 — P0-003 FIXED', () => {
    shop.updatePrestigeInfo(99999, 5);
    const before = shop.getState().prestigePoints;
    const result = shop.buyGoods('psg-001', -1);
    expect(() => shop.buyGoods('psg-001', -1)).not.toThrow();
    // ✅ FIXED (FIX-505): quantity <= 0 校验拒绝负数
    expect(result.success).toBe(false);
    expect(shop.getState().prestigePoints).toBe(before);
  });
  it('零购买数量安全处理', () => {
    shop.updatePrestigeInfo(99999, 5);
    const r = shop.buyGoods('psg-001', 0);
    expect(Number.isFinite(r.cost ?? 0)).toBe(true);
  });
  it('canBuyGoods不存在商品返回false', () => {
    expect(shop.canBuyGoods('nonexistent').canBuy).toBe(false);
  });
});
describe('F-Error: 转生条件异常路径', () => {
  it('声望等级不足不能转生', () => {
    const sys = createRebirth({ prestigeLevel: 5 });
    expect(sys.checkRebirthConditions().canRebirth).toBe(false);
    expect(sys.checkRebirthConditions().conditions.prestigeLevel.met).toBe(false);
  });
  it('主城等级不足不能转生', () => {
    expect(createRebirth({ castleLevel: 3 }).checkRebirthConditions().canRebirth).toBe(false);
  });
  it('武将数量不足不能转生', () => {
    expect(createRebirth({ heroCount: 2 }).checkRebirthConditions().canRebirth).toBe(false);
  });
  it('总战力不足不能转生', () => {
    expect(createRebirth({ totalPower: 100 }).checkRebirthConditions().canRebirth).toBe(false);
  });
  it('不满足条件时executeRebirth返回失败含原因', () => {
    const r = createRebirth({ prestigeLevel: 1 }).executeRebirth();
    expect(r.success).toBe(false);
    expect(r.reason).toContain('条件不满足');
  });
  it('所有条件不满足时列出全部未满足项', () => {
    const r = createRebirth({ prestigeLevel: 1, castleLevel: 1, heroCount: 0, totalPower: 0 }).executeRebirth();
    expect(r.success).toBe(false);
    expect(r.reason).toContain('prestigeLevel');
    expect(r.reason).toContain('castleLevel');
    expect(r.reason).toContain('heroCount');
    expect(r.reason).toContain('totalPower');
  });
});
describe('F-Error: 声望任务异常路径', () => {
  let sys: PrestigeSystem;
  beforeEach(() => { sys = createPrestige(); });
  it('检查不存在任务返回false', () => {
    expect(sys.checkPrestigeQuestCompletion('nonexistent_quest')).toBe(false);
  });
  it('未达任务所需声望等级的任务不可见', () => {
    const quests = sys.getPrestigeQuests();
    expect(quests.every(q => q.requiredPrestigeLevel <= 1)).toBe(true);
  });
  it('getRebirthQuests传入负数不崩溃', () => {
    const quests = sys.getRebirthQuests(-1);
    expect(Array.isArray(quests)).toBe(true);
  });
});
// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互覆盖
// ═══════════════════════════════════════════════
describe('F-Cross: 声望升级→商店解锁联动', () => {
  let sys: PrestigeSystem;
  let shop: PrestigeShopSystem;
  let deps: ISystemDeps;
  beforeEach(() => {
    deps = createMockDeps();
    sys = new PrestigeSystem(); sys.init(deps);
    shop = new PrestigeShopSystem(); shop.init(deps);
  });
  it('声望升级时发射levelUp事件', () => {
    const emitSpy = vi.spyOn(deps.eventBus, 'emit');
    levelUpPrestige(sys, 5);
    expect(emitSpy).toHaveBeenCalledWith('prestige:levelUp', expect.objectContaining({ level: expect.any(Number) }));
  });
  it('商店更新声望信息后商品解锁状态变化', () => {
    shop.updatePrestigeInfo(0, 1);
    expect(shop.getAllGoods().filter(g => !g.unlocked).length).toBeGreaterThan(0);
    shop.updatePrestigeInfo(99999, 50);
    expect(shop.getAllGoods().every(g => g.unlocked)).toBe(true);
  });
  it('声望消耗后商店余额应同步', () => {
    shop.updatePrestigeInfo(1000, 5);
    const before = shop.getState().prestigePoints;
    shop.buyGoods('psg-001', 1);
    expect(shop.getState().prestigePoints).toBe(before - 50);
  });
  it('商店扣减的是独立prestigePoints不同步回PrestigeSystem — P0 设计确认', () => {
    const pSys = createPrestige();
    pSys.addPrestigePoints('main_quest' as PrestigeSourceType, 1000);
    const pPoints = pSys.getState().currentPoints;
    shop.updatePrestigeInfo(pPoints, 5);
    shop.buyGoods('psg-001', 1);
    // PrestigeSystem 的 currentPoints 不受商店购买影响
    expect(pSys.getState().currentPoints).toBe(pPoints);
    expect(shop.getState().prestigePoints).toBe(pPoints - 50);
  });
});
describe('F-Cross: 转生→加速→建筑时间联动', () => {
  it('转生后加速期激活', () => {
    const sys = createRebirth();
    const r = sys.executeRebirth();
    expect(r.success).toBe(true);
    expect(sys.getAcceleration().active).toBe(true);
    expect(sys.getAcceleration().daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });
  it('加速期内建筑时间缩短', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    const m = sys.getEffectiveMultipliers();
    expect(m.buildSpeed).toBeGreaterThan(1);
    expect(m.resource).toBeGreaterThan(1);
    expect(m.techSpeed).toBeGreaterThan(1);
    expect(m.exp).toBeGreaterThan(1);
  });
  it('加速期结束后倍率回归基础', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    for (let i = 0; i < REBIRTH_ACCELERATION.durationDays; i++) sys['tickAcceleration']();
    expect(sys.getAcceleration().active).toBe(false);
    expect(sys.getAcceleration().daysLeft).toBe(0);
    const m = sys.getEffectiveMultipliers();
    expect(m.buildSpeed).toBe(sys.getState().currentMultiplier);
  });
  it('calculateBuildTime在加速期考虑倍率', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    const s = sys.getState();
    const time = calculateBuildTime(3600, 15, s.currentMultiplier, s.accelerationDaysLeft);
    expect(time).toBeLessThan(3600);
    expect(time).toBeGreaterThanOrEqual(1);
  });
});
describe('F-Cross: 声望获取→任务完成→奖励声望循环', () => {
  it('声望获取更新任务进度', () => {
    const sys = createPrestige();
    levelUpPrestige(sys, 3);
    expect(sys.getPrestigeQuestProgress('pq-001')).toBeGreaterThan(0);
  });
  it('声望任务完成后发放奖励', () => {
    const sys = createPrestige();
    const rewards: Record<string, number>[] = [];
    sys.setRewardCallback(r => rewards.push({ ...r }));
    levelUpPrestige(sys, 3);
    const state = sys.getState();
    if (state.completedPrestigeQuests.includes('pq-001')) {
      expect(rewards.length).toBeGreaterThan(0);
    }
  });
});
describe('F-Cross: 转生保留/重置规则一致性', () => {
  it('保留规则和重置规则无交集', () => {
    const keepSet = new Set(REBIRTH_KEEP_RULES);
    for (const rule of REBIRTH_RESET_RULES) expect(keepSet.has(rule as any)).toBe(false);
  });
  it('转生保留规则覆盖关键数据', () => {
    expect(REBIRTH_KEEP_RULES).toContain('keep_heroes');
    expect(REBIRTH_KEEP_RULES).toContain('keep_prestige');
    expect(REBIRTH_KEEP_RULES).toContain('keep_achievements');
  });
  it('转生重置规则覆盖进度数据', () => {
    expect(REBIRTH_RESET_RULES).toContain('reset_buildings');
    expect(REBIRTH_RESET_RULES).toContain('reset_resources');
    expect(REBIRTH_RESET_RULES).toContain('reset_map_progress');
  });
  it('转生executeRebirth触发onReset回调传入重置规则', () => {
    const resetRules: string[] = [];
    const sys = new RebirthSystem();
    sys.init(createMockDeps());
    sys.setCallbacks({
      castleLevel: () => 100, heroCount: () => 100,
      totalPower: () => 100000, prestigeLevel: () => 30,
      onReset: (rules: string[]) => { resetRules.push(...rules); },
    });
    sys.updatePrestigeLevel(30);
    sys.executeRebirth();
    expect(resetRules).toEqual([...REBIRTH_RESET_RULES]);
  });
});
// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期覆盖
// ═══════════════════════════════════════════════
describe('F-Lifecycle: 声望系统序列化/反序列化', () => {
  it('空系统序列化/反序列化一致', () => {
    const sys = createPrestige();
    const data = sys.getSaveData();
    expect(data.version).toBe(1);
    const sys2 = createPrestige();
    sys2.loadSaveData(data);
    expect(sys2.getState().currentPoints).toBe(0);
    expect(sys2.getState().currentLevel).toBe(1);
  });
  it('有声望数据完整保留', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('main_quest' as PrestigeSourceType, 5000);
    const data = sys.getSaveData();
    const sys2 = createPrestige();
    sys2.loadSaveData(data);
    expect(sys2.getState().currentPoints).toBe(sys.getState().currentPoints);
    expect(sys2.getState().totalPoints).toBe(sys.getState().totalPoints);
    expect(sys2.getState().currentLevel).toBe(sys.getState().currentLevel);
  });
  it('版本不匹配拒绝加载', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('main_quest' as PrestigeSourceType, 5000);
    const data = sys.getSaveData();
    data.version = 999;
    const sys2 = createPrestige();
    sys2.loadSaveData(data);
    expect(sys2.getState().currentPoints).toBe(0);
  });
  it('等级奖励领取记录保留', () => {
    const sys = createPrestige();
    levelUpPrestige(sys, 10);
    sys.claimLevelReward(5);
    sys.claimLevelReward(10);
    const data = sys.getSaveData();
    const sys2 = createPrestige();
    sys2.loadSaveData(data);
    expect(sys2.getState().claimedLevelRewards).toContain(5);
    expect(sys2.getState().claimedLevelRewards).toContain(10);
  });
  it('每日获取记录序列化保留', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('battle_victory', 100);
    sys.addPrestigePoints('daily_quest', 50);
    const data = sys.getSaveData();
    const sys2 = createPrestige();
    sys2.loadSaveData(data);
    expect(sys2.getState().dailyGained['battle_victory']).toBe(100);
    expect(sys2.getState().dailyGained['daily_quest']).toBe(50);
  });
});
describe('F-Lifecycle: 声望商店序列化', () => {
  it('购买记录加载后保留', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 5);
    shop.buyGoods('psg-001', 2);
    const purchases = shop.getPurchaseHistory();
    expect(purchases['psg-001']).toBe(2);
    const shop2 = createShop();
    shop2.loadPurchases(purchases);
    expect(shop2.getPurchaseHistory()['psg-001']).toBe(2);
  });
  it('空购买记录加载不崩溃', () => {
    expect(() => createShop().loadPurchases({})).not.toThrow();
  });
});
describe('F-Lifecycle: 转生系统序列化/反序列化', () => {
  it('转生记录完整保留', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    const state = sys.getState();
    const sys2 = createRebirth();
    sys2.loadSaveData({ rebirth: { ...state } });
    expect(sys2.getState().rebirthCount).toBe(1);
    expect(sys2.getState().rebirthRecords).toHaveLength(1);
    expect(sys2.getState().currentMultiplier).toBe(state.currentMultiplier);
  });
  it('多次转生记录全部保留', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    sys.executeRebirth();
    sys.executeRebirth();
    const sys2 = createRebirth();
    sys2.loadSaveData({ rebirth: { ...sys.getState() } });
    expect(sys2.getState().rebirthCount).toBe(3);
    expect(sys2.getState().rebirthRecords).toHaveLength(3);
  });
  it('加速天数序列化保留', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    const sys2 = createRebirth();
    sys2.loadSaveData({ rebirth: { ...sys.getState() } });
    expect(sys2.getState().accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });
});
describe('F-Lifecycle: 系统重置', () => {
  it('PrestigeSystem.reset清空所有状态', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('main_quest' as PrestigeSourceType, 99999);
    sys.reset();
    expect(sys.getState().currentPoints).toBe(0);
    expect(sys.getState().totalPoints).toBe(0);
    expect(sys.getState().currentLevel).toBe(1);
    expect(sys.getState().claimedLevelRewards).toHaveLength(0);
  });
  it('PrestigeShopSystem.reset清空所有状态', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 50);
    shop.buyGoods('psg-001', 2);
    shop.reset();
    expect(shop.getState().prestigePoints).toBe(0);
    expect(shop.getState().prestigeLevel).toBe(1);
  });
  it('RebirthSystem.reset清空所有状态', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    sys.reset();
    expect(sys.getState().rebirthCount).toBe(0);
    expect(sys.getState().currentMultiplier).toBe(1.0);
    expect(sys.getState().rebirthRecords).toHaveLength(0);
    expect(sys.getState().accelerationDaysLeft).toBe(0);
  });
});
describe('F-Lifecycle: 每日重置', () => {
  it('每日重置清零各途径已获取量', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('battle_victory', 200);
    expect(sys.getState().dailyGained['battle_victory']).toBe(200);
    sys['resetDailyGains']();
    expect(sys.getState().dailyGained['battle_victory']).toBe(0);
  });
  it('每日重置后声望总量不减少', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('battle_victory', 100);
    const total = sys.getState().totalPoints;
    sys['resetDailyGains']();
    expect(sys.getState().totalPoints).toBe(total);
    expect(sys.getState().currentPoints).toBe(total);
  });
  it('每日重置后可再次获取声望', () => {
    const sys = createPrestige();
    const cap = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'battle_victory')!.dailyCap;
    sys.addPrestigePoints('battle_victory', cap + 100);
    expect(sys.addPrestigePoints('battle_victory', 100)).toBe(0);
    sys['resetDailyGains']();
    expect(sys.addPrestigePoints('battle_victory', 100)).toBe(100);
  });
});
// ═══════════════════════════════════════════════
// F-Boundary: 边界条件覆盖
// ═══════════════════════════════════════════════
describe('F-Boundary: 声望等级满级', () => {
  it('巨量声望不超过最大等级', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('main_quest' as PrestigeSourceType, 999999999);
    expect(sys.getState().currentLevel).toBe(MAX_PRESTIGE_LEVEL);
  });
  it('满级后继续获取声望累积但不升级', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('main_quest' as PrestigeSourceType, 999999999);
    const level = sys.getState().currentLevel;
    sys.addPrestigePoints('main_quest' as PrestigeSourceType, 1000);
    expect(sys.getState().currentLevel).toBe(level);
    expect(sys.getState().currentPoints).toBeGreaterThan(0);
  });
  it('calcRequiredPoints边界值', () => {
    expect(calcRequiredPoints(0)).toBe(0);
    expect(calcRequiredPoints(-1)).toBe(0);
    expect(calcRequiredPoints(1)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(1, PRESTIGE_EXPONENT)));
    expect(calcRequiredPoints(50)).toBe(Math.floor(PRESTIGE_BASE * Math.pow(50, PRESTIGE_EXPONENT)));
  });
  it('calcProductionBonus满级加成', () => {
    expect(calcProductionBonus(MAX_PRESTIGE_LEVEL)).toBeCloseTo(1 + MAX_PRESTIGE_LEVEL * PRODUCTION_BONUS_PER_LEVEL);
  });
  it('calcProductionBonus(0)返回1', () => {
    expect(calcProductionBonus(0)).toBe(1);
  });
  it('calcProductionBonus负数返回小于1', () => {
    expect(calcProductionBonus(-1)).toBeLessThan(1);
  });
});
describe('F-Boundary: 每日上限边界', () => {
  it('恰好达到每日上限成功', () => {
    const cfg = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'battle_victory')!;
    expect(createPrestige().addPrestigePoints('battle_victory', cfg.dailyCap)).toBe(cfg.dailyCap);
  });
  it('超过每日上限截断', () => {
    const cfg = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'battle_victory')!;
    expect(createPrestige().addPrestigePoints('battle_victory', cfg.dailyCap + 100)).toBe(cfg.dailyCap);
  });
  it('无上限途径(dailyCap=-1)不限制', () => {
    expect(createPrestige().addPrestigePoints('main_quest' as PrestigeSourceType, 999999)).toBe(999999);
  });
  it('所有9种途径配置有效', () => {
    expect(PRESTIGE_SOURCE_CONFIGS).toHaveLength(9);
    for (const cfg of PRESTIGE_SOURCE_CONFIGS) {
      expect(cfg.type).toBeTruthy();
      expect(cfg.basePoints).toBeGreaterThan(0);
      expect(cfg.description).toBeTruthy();
    }
  });
  it('达到上限后再获取返回0', () => {
    const sys = createPrestige();
    const cfg = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'battle_victory')!;
    sys.addPrestigePoints('battle_victory', cfg.dailyCap);
    expect(sys.addPrestigePoints('battle_victory', 1)).toBe(0);
  });
});
describe('F-Boundary: 转生倍率边界', () => {
  it('转生0次倍率1.0', () => {
    expect(calcRebirthMultiplier(0)).toBe(1.0);
  });
  it('转生负数次倍率1.0', () => {
    expect(calcRebirthMultiplier(-1)).toBe(1.0);
    expect(calcRebirthMultiplier(-100)).toBe(1.0);
  });
  it('倍率不超最大值', () => {
    expect(calcRebirthMultiplier(1000)).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
  });
  it('倍率随转生次数递增', () => {
    let prev = 1.0;
    for (let i = 1; i <= 20; i++) {
      const cur = calcRebirthMultiplier(i);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });
  it('calcRebirthMultiplierFromConfig支持linear曲线', () => {
    expect(calcRebirthMultiplierFromConfig(5, { curveType: 'linear', decayFactor: 1.0 })).toBeGreaterThan(1.0);
  });
  it('calcRebirthMultiplierFromConfig支持diminishing曲线', () => {
    expect(calcRebirthMultiplierFromConfig(5, { curveType: 'diminishing', decayFactor: 0.8 })).toBeGreaterThan(1.0);
  });
  it('calcRebirthMultiplierFromConfig NaN输入返回1.0 — P0-009 FIXED', () => {
    // ✅ FIXED (FIX-503): Number.isFinite(count) 校验拒绝 NaN，返回安全默认值 1.0
    expect(calcRebirthMultiplierFromConfig(NaN)).toBe(1.0);
  });
  it('getNextMultiplier大于当前倍率', () => {
    const sys = createRebirth();
    expect(sys.getNextMultiplier()).toBeGreaterThan(sys.getCurrentMultiplier());
  });
});
describe('F-Boundary: 转生加速边界', () => {
  it('加速天数从配置值开始递减', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    expect(sys.getState().accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });
  it('加速天数不小于0', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    for (let i = 0; i < REBIRTH_ACCELERATION.durationDays + 10; i++) sys['tickAcceleration']();
    expect(sys.getState().accelerationDaysLeft).toBe(0);
  });
  it('加速结束触发accelerationEnded事件', () => {
    const deps = createMockDeps();
    const emitSpy = vi.spyOn(deps.eventBus, 'emit');
    const sys = new RebirthSystem();
    sys.init(deps);
    sys.setCallbacks({
      castleLevel: () => 100, heroCount: () => 100,
      totalPower: () => 100000, prestigeLevel: () => 30,
    });
    sys.updatePrestigeLevel(30);
    sys.executeRebirth();
    for (let i = 0; i < REBIRTH_ACCELERATION.durationDays; i++) sys['tickAcceleration']();
    expect(emitSpy).toHaveBeenCalledWith('rebirth:accelerationEnded', expect.any(Object));
  });
  it('无加速时getEffectiveMultipliers倍率部分为1', () => {
    const sys = createRebirth();
    const m = sys.getEffectiveMultipliers();
    expect(m.buildSpeed).toBe(1.0);
    expect(m.techSpeed).toBe(1.0);
    expect(m.resource).toBe(1.0);
    expect(m.exp).toBe(1.0);
  });
});
describe('F-Boundary: 建筑时间计算边界', () => {
  it('基础时间0返回0或1', () => {
    expect(calculateBuildTime(0, 1, 1.0, 0)).toBeGreaterThanOrEqual(0);
  });
  it('低级建筑在加速期瞬间升级', () => {
    expect(calculateBuildTime(3600, 5, 2.0, 7)).toBeLessThan(3600);
  });
  it('无转生加速返回原始时间', () => {
    expect(calculateBuildTime(3600, 15, 1.0, 0)).toBe(3600);
  });
  it('高级建筑在加速期缩短', () => {
    const time = calculateBuildTime(7200, 20, 3.0, 5);
    expect(time).toBeLessThan(7200);
    expect(time).toBeGreaterThanOrEqual(1);
  });
  it('建筑等级在瞬间范围内大幅缩短', () => {
    expect(calculateBuildTime(3600, REBIRTH_INSTANT_BUILD.maxInstantLevel, 2.0, 0))
      .toBeLessThanOrEqual(Math.floor(3600 / REBIRTH_INSTANT_BUILD.speedDivisor));
  });
  it('NaN基础时间不崩溃', () => {
    expect(() => calculateBuildTime(NaN, 5, 2.0, 0)).not.toThrow();
  });
  it('负数建筑等级安全处理', () => {
    const time = calculateBuildTime(3600, -1, 2.0, 0);
    expect(Number.isFinite(time)).toBe(true);
  });
});
describe('F-Boundary: 转生次数解锁内容', () => {
  it('0次转生不解锁任何内容', () => {
    expect(createRebirth().getUnlockedContents()).toHaveLength(0);
  });
  it('1次转生解锁转生商店', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    expect(sys.getUnlockedContents().some(c => c.unlockId === 'rebirth_shop')).toBe(true);
  });
  it('v16解锁内容覆盖', () => {
    expect(getUnlockContentsV16(0).every(c => !c.unlocked)).toBe(true);
    expect(getUnlockContentsV16(5).some(c => c.unlocked)).toBe(true);
  });
  it('isFeatureUnlocked不存在ID返回false', () => {
    expect(isFeatureUnlocked('nonexistent', 10)).toBe(false);
  });
  it('解锁内容列表完整', () => {
    for (const c of REBIRTH_UNLOCK_CONTENTS) {
      expect(c.requiredRebirthCount).toBeGreaterThan(0);
      expect(c.unlockId).toBeTruthy();
    }
  });
});
// ═══════════════════════════════════════════════
// F-Normal: 正向流程补充
// ═══════════════════════════════════════════════
describe('F-Normal: 9种声望获取途径完整验证', () => {
  it('每种途径都能获取声望', () => {
    const sys = createPrestige();
    for (const cfg of PRESTIGE_SOURCE_CONFIGS) {
      expect(sys.addPrestigePoints(cfg.type, cfg.basePoints)).toBe(cfg.basePoints);
    }
  });
  it('多种途径交替获取正确累加', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('daily_quest', 10);
    sys.addPrestigePoints('battle_victory', 20);
    sys.addPrestigePoints('expedition', 15);
    expect(sys.getState().currentPoints).toBe(45);
  });
});
describe('F-Normal: 等级奖励领取完整流程', () => {
  it('从1级到50级所有奖励可领取', () => {
    const sys = createPrestige();
    levelUpPrestige(sys, MAX_PRESTIGE_LEVEL);
    for (const reward of LEVEL_UNLOCK_REWARDS) {
      const r = sys.claimLevelReward(reward.level);
      expect(r.success).toBe(true);
      expect(r.reward).toBeDefined();
    }
  });
  it('所有等级奖励有资源定义', () => {
    for (const r of LEVEL_UNLOCK_REWARDS) {
      expect(r.resources).toBeDefined();
      expect(Object.keys(r.resources).length).toBeGreaterThan(0);
    }
  });
});
describe('F-Normal: 声望商店购买完整流程', () => {
  it('查看→购买→验证流程', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 50);
    const goods = shop.getAllGoods();
    expect(goods.length).toBeGreaterThan(0);
    const first = goods.find(g => g.unlocked && g.canBuy);
    expect(first).toBeDefined();
    const r = shop.buyGoods(first!.id, 1);
    expect(r.success).toBe(true);
    expect(r.cost).toBeGreaterThan(0);
  });
  it('限购商品正确计数', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 1);
    for (let i = 0; i < 5; i++) expect(shop.buyGoods('psg-001', 1).success).toBe(true);
    expect(shop.buyGoods('psg-001', 1).success).toBe(false);
  });
  it('批量购买正确计算总价', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 1);
    const r = shop.buyGoods('psg-001', 3);
    if (r.success) expect(r.cost).toBe(PRESTIGE_SHOP_GOODS.find(g => g.id === 'psg-001')!.costPoints * 3);
  });
  it('getUnlockedGoods只返回已解锁商品', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 1);
    const unlocked = shop.getUnlockedGoods();
    expect(unlocked.every(g => g.unlocked)).toBe(true);
    expect(unlocked.length).toBeLessThan(PRESTIGE_SHOP_GOODS.length);
  });
  it('无限购商品(purchaseLimit=-1)可多次购买 — P0确认', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 50);
    const unlimited = PRESTIGE_SHOP_GOODS.find(g => g.purchaseLimit === -1);
    if (unlimited) {
      for (let i = 0; i < 5; i++) expect(shop.buyGoods(unlimited.id, 1).success).toBe(true);
    }
  });
});
describe('F-Normal: 转生完整流程', () => {
  it('检查条件→执行转生→验证结果', () => {
    const sys = createRebirth();
    expect(sys.checkRebirthConditions().canRebirth).toBe(true);
    const r = sys.executeRebirth();
    expect(r.success).toBe(true);
    expect(r.newCount).toBe(1);
    expect(r.multiplier).toBeGreaterThan(1.0);
    expect(r.acceleration).toBeDefined();
    const state = sys.getState();
    expect(state.rebirthCount).toBe(1);
    expect(state.currentMultiplier).toBe(r.multiplier);
    expect(state.accelerationDaysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });
  it('多次转生倍率递增', () => {
    const sys = createRebirth();
    const multipliers: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = sys.executeRebirth();
      expect(r.success).toBe(true);
      multipliers.push(r.multiplier!);
    }
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]).toBeGreaterThanOrEqual(multipliers[i - 1]);
    }
  });
  it('转生记录包含完整信息', () => {
    const sys = createRebirth();
    sys.executeRebirth();
    const records = sys.getRebirthRecords();
    expect(records).toHaveLength(1);
    expect(records[0].rebirthCount).toBe(1);
    expect(records[0].prestigeLevelBefore).toBe(REBIRTH_CONDITIONS.minPrestigeLevel);
    expect(records[0].multiplier).toBeGreaterThan(1.0);
    expect(records[0].timestamp).toBeGreaterThan(0);
  });
});
describe('F-Normal: 转生模拟器', () => {
  it('simulateEarnings返回合理预估', () => {
    const sys = createRebirth();
    const r = sys.simulateEarnings({ currentPrestigeLevel: 20, currentRebirthCount: 0, simulateDays: 30, dailyOnlineHours: 4 });
    expect(r.estimatedResources.gold).toBeGreaterThan(0);
    expect(r.estimatedResources.grain).toBeGreaterThan(0);
    expect(r.estimatedPrestigeGain).toBeGreaterThan(0);
    expect(r.days).toBe(30);
  });
  it('simulateEarningsV16包含增长曲线', () => {
    const sys = createRebirth();
    const r = sys.simulateEarningsV16({ currentPrestigeLevel: 20, currentRebirthCount: 0, simulateDays: 30, dailyOnlineHours: 4 });
    expect(r.prestigeGrowthCurve).toBeDefined();
    expect(r.prestigeGrowthCurve.length).toBe(31);
    expect(r.comparison).toBeDefined();
    expect(r.recommendation).toBeTruthy();
  });
  it('generatePrestigeGrowthCurve从day0开始', () => {
    const curve = generatePrestigeGrowthCurve({ currentPrestigeLevel: 20, currentRebirthCount: 0, simulateDays: 10, dailyOnlineHours: 4 });
    expect(curve[0]).toEqual({ day: 0, prestige: 0 });
    expect(curve.length).toBe(11);
  });
  it('compareRebirthTiming返回对比结果', () => {
    const comparisons = compareRebirthTiming(0, [24, 48, 72]);
    expect(comparisons).toHaveLength(3);
    for (const c of comparisons) {
      expect(c.immediateMultiplier).toBeGreaterThan(0);
      expect(c.waitMultiplier).toBeGreaterThan(0);
      expect(['rebirth_now', 'wait', 'no_difference']).toContain(c.recommendedAction);
    }
  });
  it('simulateEarnings零天不崩溃', () => {
    const sys = createRebirth();
    const r = sys.simulateEarnings({ currentPrestigeLevel: 20, currentRebirthCount: 0, simulateDays: 0, dailyOnlineHours: 4 });
    expect(r.estimatedResources.gold).toBe(0);
    expect(r.days).toBe(0);
  });
  it('simulateEarnings零在线时长不崩溃', () => {
    const sys = createRebirth();
    const r = sys.simulateEarnings({ currentPrestigeLevel: 20, currentRebirthCount: 0, simulateDays: 30, dailyOnlineHours: 0 });
    expect(r.estimatedResources.gold).toBe(0);
  });
});
describe('F-Normal: 一键重建计划', () => {
  it('0次转生无重建计划', () => {
    expect(getAutoRebuildPlan(0)).toBeNull();
  });
  it('1次转生有重建计划且castle排第一', () => {
    const plan = getAutoRebuildPlan(1)!;
    expect(plan).not.toBeNull();
    expect(plan[0]).toBe('castle');
    expect(plan).toContain('barracks');
    expect(plan).toContain('farmland');
  });
});
describe('F-Normal: 转生专属任务', () => {
  it('不同转生次数解锁不同任务', () => {
    const sys = createPrestige();
    expect(sys.getRebirthQuests(3).length).toBeGreaterThanOrEqual(sys.getRebirthQuests(0).length);
  });
  it('转生任务有奖励定义', () => {
    const sys = createPrestige();
    for (const q of sys.getRebirthQuests(10)) {
      expect(q.rewards).toBeDefined();
      expect(q.id).toBeTruthy();
    }
  });
});
describe('F-Normal: 声望分栏信息完整性', () => {
  it('初始分栏包含所有字段', () => {
    const panel = createPrestige().getPrestigePanel();
    expect(panel.currentPoints).toBe(0);
    expect(panel.currentLevel).toBe(1);
    expect(panel.nextLevelPoints).toBe(calcRequiredPoints(2));
    expect(panel.totalPoints).toBe(0);
    expect(panel.productionBonus).toBeCloseTo(1 + PRODUCTION_BONUS_PER_LEVEL);
  });
  it('升级后分栏更新', () => {
    const sys = createPrestige();
    levelUpPrestige(sys, 5);
    const panel = sys.getPrestigePanel();
    expect(panel.currentLevel).toBeGreaterThanOrEqual(5);
    expect(panel.productionBonus).toBeCloseTo(1 + panel.currentLevel * PRODUCTION_BONUS_PER_LEVEL);
  });
  it('getCurrentLevelInfo返回完整信息', () => {
    const info = createPrestige().getCurrentLevelInfo();
    expect(info.level).toBe(1);
    expect(info.title).toBe('布衣');
    expect(info.productionBonus).toBeCloseTo(1.02);
  });
  it('满级分栏nextLevelPoints等于当前级所需', () => {
    const sys = createPrestige();
    levelUpPrestige(sys, MAX_PRESTIGE_LEVEL);
    const panel = sys.getPrestigePanel();
    expect(panel.nextLevelPoints).toBe(calcRequiredPoints(MAX_PRESTIGE_LEVEL));
  });
});
describe('F-Normal: 转生初始赠送', () => {
  it('初始赠送包含资源', () => {
    const gift = createRebirth().getInitialGift();
    expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
    expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
    expect(gift.troops).toBe(REBIRTH_INITIAL_GIFT.troops);
  });
  it('瞬间建筑配置有效', () => {
    const cfg = createRebirth().getInstantBuildConfig();
    expect(cfg.maxInstantLevel).toBeGreaterThan(0);
    expect(cfg.speedDivisor).toBeGreaterThan(1);
  });
});
// ═══════════════════════════════════════════════
// P0 问题记录
// ═══════════════════════════════════════════════
describe('P0 Issue: 声望系统已确认问题', () => {
  it('P0-001: NaN声望值被拒绝，不污染状态 [FIXED]', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('battle_victory', NaN);
    const state = sys.getState();
    // ✅ FIXED (FIX-501): Number.isFinite(basePoints) 校验拒绝 NaN
    expect(Number.isNaN(state.currentPoints)).toBe(false);
    expect(Number.isNaN(state.totalPoints)).toBe(false);
    expect(Number.isNaN(state.dailyGained['battle_victory'])).toBe(false);
    expect(state.currentPoints).toBe(0);
    expect(state.totalPoints).toBe(0);
  });
  it('P0-002: 负数声望值绕过每日上限', () => {
    const sys = createPrestige();
    sys.addPrestigePoints('battle_victory', 200);
    sys.addPrestigePoints('battle_victory', -100);
    // BUG: dailyGained可能减少到100，允许再次获取到200
    const state = sys.getState();
    expect(state.dailyGained['battle_victory']).toBeGreaterThanOrEqual(200);
  });
  it('P0-003: PrestigeShopSystem.buyGoods负数购买被拒绝 [FIXED]', () => {
    const shop = createShop();
    shop.updatePrestigeInfo(99999, 5);
    const before = shop.getState().prestigePoints;
    const result = shop.buyGoods('psg-001', -1);
    // ✅ FIXED (FIX-505): quantity <= 0 校验拒绝负数，声望不变
    expect(result.success).toBe(false);
    expect(shop.getState().prestigePoints).toBe(before);
  });
  it('P0-004: 商店扣减独立prestigePoints不同步回PrestigeSystem', () => {
    const pSys = createPrestige();
    pSys.addPrestigePoints('main_quest' as PrestigeSourceType, 1000);
    const shop = createShop();
    shop.updatePrestigeInfo(pSys.getState().currentPoints, 5);
    shop.buyGoods('psg-001', 1);
    // PrestigeSystem 不知道商店消耗了声望
    expect(pSys.getState().currentPoints).toBe(1000);
    expect(shop.getState().prestigePoints).toBe(950);
  });
  it('P0-005: 转生后声望等级保留(keep_prestige)但声望值currentPoints是否应重置', () => {
    const sys = createRebirth();
    const result = sys.executeRebirth();
    expect(result.success).toBe(true);
    // REBIRTH_KEEP_RULES包含keep_prestige
    expect(REBIRTH_KEEP_RULES).toContain('keep_prestige');
    // 但REBIRTH_RESET_RULES包含reset_resources
    // 需确认：声望值是否属于"资源"应被重置？
  });
  it('P0-006: 声望任务pq-001 reach_prestige_level自动完成时机', () => {
    const sys = createPrestige();
    levelUpPrestige(sys, 3);
    const state = sys.getState();
    // pq-001 目标 reach_prestige_level 3, requiredLevel 1
    // 升级到3时应自动完成
    expect(state.completedPrestigeQuests).toContain('pq-001');
  });
  it('P0-007: calcProductionBonus负数level返回小于1的加成', () => {
    // 负数level导致 1 + (-1) * 0.02 = 0.98
    expect(calcProductionBonus(-1)).toBeLessThan(1);
    // 这在生产环境中是否应被保护？
  });
  it('P0-008: PrestigeShopSystem购买奖励按quantity缩放', () => {
    const shop = createShop();
    const rewards: Record<string, number>[] = [];
    shop.setRewardCallback(r => rewards.push({ ...r }));
    shop.updatePrestigeInfo(99999, 1);
    shop.buyGoods('psg-001', 3);
    // 奖励应为 100 * 3 = 300
    expect(rewards.length).toBeGreaterThan(0);
    expect(rewards[rewards.length - 1].iron).toBe(300);
  });
});
