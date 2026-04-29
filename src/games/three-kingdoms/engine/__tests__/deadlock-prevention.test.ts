import { vi } from 'vitest';
/**
 * BUG-01 修复验证测试 — 建筑升级死锁预防
 *
 * 验收标准：
 * 1. 游戏开始时有足够资源升级至少2座基础建筑（主城+农田）
 * 2. 初始资源产出立即生效（不需要先升级）
 * 3. 所有建筑升级路径无死锁
 *
 * 升级规则：非主城建筑等级不能超过主城等级+1（P0-1修复：允许子建筑领先主城1级），
 * 因此初始状态农田 Lv1 可直接升级到 Lv2（无需先升主城）
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { INITIAL_RESOURCES, INITIAL_PRODUCTION_RATES } from '../resource/resource-config';
import { BUILDING_DEFS, BUILDING_UNLOCK_LEVELS } from '../building/building-config';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

/** 辅助函数：推进真实时间以完成建筑升级 */
function advanceTimeAndTick(engine: ThreeKingdomsEngine, ms: number): void {
  vi.advanceTimersByTime(ms);
  engine.tick(ms);
}

describe('BUG-01 建筑升级死锁预防', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    vi.useFakeTimers();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // 1. 初始资源足够升级至少2座基础建筑
  // ═══════════════════════════════════════════
  describe('初始资源充足性', () => {
    it('初始铜钱足够升级主城 Lv1→Lv2', () => {
      const castleCost = BUILDING_DEFS.castle.levelTable[1].upgradeCost;
      expect(INITIAL_RESOURCES.gold).toBeGreaterThanOrEqual(castleCost.gold);
      expect(INITIAL_RESOURCES.grain).toBeGreaterThanOrEqual(castleCost.grain);
    });

    it('初始铜钱足够升级农田 Lv1→Lv2', () => {
      const farmlandCost = BUILDING_DEFS.farmland.levelTable[1].upgradeCost;
      expect(INITIAL_RESOURCES.gold).toBeGreaterThanOrEqual(farmlandCost.gold);
      expect(INITIAL_RESOURCES.grain).toBeGreaterThanOrEqual(farmlandCost.grain);
    });

    it('初始资源足够连续升级主城+农田（无死锁）', () => {
      // P0-1修复后：农田可直接升级（允许领先主城1级），也可以先升主城
      const castleCost = BUILDING_DEFS.castle.levelTable[1].upgradeCost;
      const farmlandCost = BUILDING_DEFS.farmland.levelTable[1].upgradeCost;

      const totalGold = castleCost.gold + farmlandCost.gold;
      const totalGrain = castleCost.grain + farmlandCost.grain;

      expect(INITIAL_RESOURCES.gold).toBeGreaterThanOrEqual(totalGold);
      expect(INITIAL_RESOURCES.grain).toBeGreaterThanOrEqual(totalGrain);
    });

    it('游戏开始后可连续升级主城和农田', () => {
      engine.init();

      // Step 1: 升级主城（主城必须先升，其他建筑才能跟进）
      const castleCheck = engine.checkUpgrade('castle');
      expect(castleCheck.canUpgrade).toBe(true);
      engine.upgradeBuilding('castle');

      // 主城 Lv1→Lv2 需要 10 秒
      advanceTimeAndTick(engine, 15000);
      expect(engine.building.getLevel('castle')).toBe(2);

      // Step 2: 升级农田（主城已 Lv2，农田 Lv1→Lv2 不超过主城等级）
      const farmlandCheck = engine.checkUpgrade('farmland');
      expect(farmlandCheck.canUpgrade).toBe(true);
      engine.upgradeBuilding('farmland');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 初始资源产出立即生效
  // ═══════════════════════════════════════════
  describe('初始产出立即生效', () => {
    it('游戏开始时粮草产出速率 > 0', () => {
      engine.init();
      const rates = engine.getSnapshot().productionRates;
      expect(rates.grain).toBeGreaterThan(0);
    });

    it('初始产出速率配置与农田 Lv1 产出一致', () => {
      const farmlandLv1Production = BUILDING_DEFS.farmland.levelTable[0].production;
      expect(INITIAL_PRODUCTION_RATES.grain).toBe(farmlandLv1Production);
    });

    it('tick 后粮草数量增加', () => {
      engine.init();
      const grainBefore = engine.resource.getAmount('grain');
      engine.tick(1000); // 1秒
      const grainAfter = engine.resource.getAmount('grain');
      expect(grainAfter).toBeGreaterThan(grainBefore);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 升级路径无死锁
  // ═══════════════════════════════════════════
  describe('升级路径无死锁', () => {
    it('主城可立即升级（Lv1→Lv2）', () => {
      engine.init();
      const check = engine.checkUpgrade('castle');
      expect(check.canUpgrade).toBe(true);
    });

    it('主城升级到 Lv2 后解锁市集和兵营', () => {
      engine.init();

      // 升级主城到 Lv2
      engine.upgradeBuilding('castle');
      advanceTimeAndTick(engine, 15000);

      expect(engine.building.getLevel('castle')).toBe(2);

      // 市集和兵营应已解锁（BUILDING_UNLOCK_LEVELS 中两者都需要 castle Lv2）
      const marketCheck = engine.checkUpgrade('market');
      const barracksCheck = engine.checkUpgrade('barracks');

      // 解锁条件满足（主城 Lv2），检查不是因"未解锁"被拒绝
      expect(marketCheck.reasons).not.toContain('建筑尚未解锁');
      expect(barracksCheck.reasons).not.toContain('建筑尚未解锁');
    });

    it('完整升级链：主城→农田→市集 无死锁', () => {
      engine.init();

      // Step 1: 升级主城 Lv1→Lv2
      expect(engine.checkUpgrade('castle').canUpgrade).toBe(true);
      engine.upgradeBuilding('castle');
      advanceTimeAndTick(engine, 15000);
      expect(engine.building.getLevel('castle')).toBe(2);

      // Step 2: 升级农田 Lv1→Lv2（主城已 Lv2，允许）
      expect(engine.checkUpgrade('farmland').canUpgrade).toBe(true);
      engine.upgradeBuilding('farmland');
      advanceTimeAndTick(engine, 10000);
      expect(engine.building.getLevel('farmland')).toBe(2);

      // Step 3: 市集已解锁（主城 Lv2），验证可升级
      // 初始300gold - 150(castle) - 50(farmland) = 100gold >= 100(market Lv0→1 cost)
      // 初始500grain - 200(castle) - 100(farmland) = 200grain >= 80(market Lv0→1 cost)
      const marketCheck = engine.checkUpgrade('market');
      expect(marketCheck.canUpgrade).toBe(true);
    });

    it('所有初始解锁建筑（castle/farmland）资源检查通过', () => {
      engine.init();

      // castle 可升级（资源足够）
      const castleCheck = engine.checkUpgrade('castle');
      expect(castleCheck.canUpgrade).toBe(true);

      // P0-1修复后：farmland 不再被主城等级限制（允许领先1级），资源本身足够
      const farmlandCost = BUILDING_DEFS.farmland.levelTable[1].upgradeCost;
      expect(INITIAL_RESOURCES.gold).toBeGreaterThanOrEqual(farmlandCost.gold);
      expect(INITIAL_RESOURCES.grain).toBeGreaterThanOrEqual(farmlandCost.grain);
    });

    it('资源产出持续积累，不会因无建筑升级而停滞', () => {
      engine.init();

      // 不升级任何建筑，仅靠初始产出
      const grainStart = engine.resource.getAmount('grain');
      engine.tick(10000); // 10秒
      const grainAfter = engine.resource.getAmount('grain');

      // 粮草应持续增长（农田 Lv1 产出 0.8/s，10秒产出 8 粮草）
      expect(grainAfter).toBeGreaterThan(grainStart);
      expect(grainAfter - grainStart).toBeCloseTo(8, 0);
    });
  });
});
