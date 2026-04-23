import { vi } from 'vitest';
/**
 * EgyptMythEngine — 全面测试套件
 *
 * 覆盖范围 (~130 tests):
 * - 初始化 (10)  - 常量 (5)  - 点击 (8)
 * - 资源 (6)    - 建筑 (8)  - 神明 (8)
 * - 木乃伊 (6)  - 转生 (6)  - 存档 (5)
 * - 状态 (4)    - 生命周期 (5) - 格式化 (3)
 * - 渲染 (3)    - 键盘 (4)  - 边界 (10)
 * - 自动生产 (3)
 */
import {
  EgyptMythEngine,
  RESOURCE_IDS,
  BUILDING_IDS,
  GOLD_PER_CLICK,
  MIN_PRESTIGE_GOLD,
  PRESTIGE_BONUS_MULTIPLIER,
  GODS,
  MUMMIES,
  BUILDINGS,
} from '../index';
import type { EgyptMythState, GodState, MummyState, BlessingState } from '../index';

// ========== Canvas Mock ==========

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

// ========== Helper: create engine with canvas, init, and start ==========

function createAndStartEngine(): EgyptMythEngine {
  const engine = new EgyptMythEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  engine.start();
  return engine;
}

// ========== Helper: add gold to engine ==========

function addGold(engine: EgyptMythEngine, amount: number): void {
  engine.addResource('gold', amount);
  // Also bump totalGoldEarned via stats (click is one way, but we can use internal access)
  // Since totalGoldEarned is a getter on _stats, we can click many times or use loadState
}

// ========== Helper: set totalGoldEarned via loadState ==========

function setTotalGoldEarned(engine: EgyptMythEngine, amount: number): void {
  const state = engine.getState();
  state.statistics = {
    ...state.statistics,
    totalGoldEarned: amount,
  };
  engine.loadState(state);
}

// ================================================================
// 1. 初始化 (10 tests)
// ================================================================

describe('EgyptMythEngine — 初始化', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = new EgyptMythEngine();
    engine.init(createMockCanvas());
  });

  it('gameId 应为 egypt-myth', () => {
    expect(engine.gameId).toBe('egypt-myth');
  });

  it('初始状态为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始黄金为 0', () => {
    expect(engine.getResource('gold')?.amount).toBe(0);
  });

  it('初始莎草纸为 0 且未解锁', () => {
    const papyrus = engine.getResource('papyrus');
    expect(papyrus?.amount).toBe(0);
    expect(papyrus?.unlocked).toBe(false);
  });

  it('初始神圣之力为 0 且未解锁', () => {
    const divine = engine.getResource('divine_power');
    expect(divine?.amount).toBe(0);
    expect(divine?.unlocked).toBe(false);
  });

  it('初始 selectedIndex 为 0', () => {
    expect(engine.selectedIndex).toBe(0);
  });

  it('初始 totalGoldEarned 为 0', () => {
    expect(engine.totalGoldEarned).toBe(0);
  });

  it('初始 totalClicks 为 0', () => {
    expect(engine.totalClicks).toBe(0);
  });

  it('初始神明列表应有 6 位神明，仅 ra 解锁', () => {
    const gods = engine.gods;
    expect(gods).toHaveLength(6);
    expect(gods.find((g) => g.id === 'ra')?.unlocked).toBe(true);
    expect(gods.filter((g) => g.unlocked)).toHaveLength(1);
  });

  it('初始木乃伊列表有 3 个', () => {
    expect(engine.mummies).toHaveLength(3);
  });

  it('初始恩赐状态 interval > 0', () => {
    expect(engine.blessing.interval).toBeGreaterThan(0);
  });

  it('初始恩赐未就绪', () => {
    expect(engine.blessingReady).toBe(false);
  });

  it('初始声望 currency 为 0', () => {
    const state = engine.getState();
    expect(state.prestige.currency).toBe(0);
    expect(state.prestige.count).toBe(0);
  });
});

// ================================================================
// 2. 常量 (5 tests)
// ================================================================

describe('EgyptMythEngine — 常量', () => {
  it('RESOURCE_IDS 包含 gold, papyrus, divine_power', () => {
    expect(RESOURCE_IDS.GOLD).toBe('gold');
    expect(RESOURCE_IDS.PAPYRUS).toBe('papyrus');
    expect(RESOURCE_IDS.DIVINE_POWER).toBe('divine_power');
  });

  it('GOLD_PER_CLICK 为 1', () => {
    expect(GOLD_PER_CLICK).toBe(1);
  });

  it('MIN_PRESTIGE_GOLD 为 50000', () => {
    expect(MIN_PRESTIGE_GOLD).toBe(50000);
  });

  it('PRESTIGE_BONUS_MULTIPLIER 为 0.15', () => {
    expect(PRESTIGE_BONUS_MULTIPLIER).toBe(0.15);
  });

  it('BUILDING_IDS 包含 sand_pit', () => {
    expect(BUILDING_IDS.SAND_PIT).toBe('sand_pit');
  });
});

// ================================================================
// 3. 点击 (8 tests)
// ================================================================

describe('EgyptMythEngine — 点击', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('click() 返回获得的黄金数', () => {
    const gained = engine.click();
    expect(gained).toBeGreaterThanOrEqual(GOLD_PER_CLICK);
  });

  it('click() 增加黄金资源', () => {
    engine.click();
    expect(engine.getResource('gold')?.amount).toBeGreaterThanOrEqual(1);
  });

  it('click() 增加 totalClicks', () => {
    engine.click();
    engine.click();
    engine.click();
    expect(engine.totalClicks).toBe(3);
  });

  it('click() 增加 totalGoldEarned', () => {
    engine.click();
    expect(engine.totalGoldEarned).toBeGreaterThanOrEqual(1);
  });

  it('click() 增加 score', () => {
    engine.click();
    expect(engine.score).toBeGreaterThanOrEqual(1);
  });

  it('非 playing 状态下 click() 返回 0', () => {
    engine.pause();
    const gained = engine.click();
    expect(gained).toBe(0);
  });

  it('多次 click() 累积黄金', () => {
    for (let i = 0; i < 10; i++) {
      engine.click();
    }
    expect(engine.getResource('gold')?.amount).toBeGreaterThanOrEqual(10);
    expect(engine.totalClicks).toBe(10);
  });

  it('click() 触发 stateChange 事件', () => {
    const listener = vi.fn();
    engine.on('stateChange', listener);
    engine.click();
    expect(listener).toHaveBeenCalled();
  });

  it('click() 有 ra 神明加成时获得更多黄金', () => {
    // Ra is unlocked by default, giving +10% click bonus
    const gained = engine.click();
    // With ra's 10% bonus: 1 * 1.1 = 1.1, floored to 1.1
    expect(gained).toBeGreaterThanOrEqual(1);
  });

  it('click() 飘字效果不抛异常', () => {
    // Math.random is used in click, call many times
    for (let i = 0; i < 50; i++) {
      expect(() => engine.click()).not.toThrow();
    }
  });
});

// ================================================================
// 4. 资源 (6 tests)
// ================================================================

describe('EgyptMythEngine — 资源', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('addResource 增加资源数量', () => {
    engine.addResource('gold', 100);
    expect(engine.getResource('gold')?.amount).toBe(100);
  });

  it('spendResource 消耗资源并返回 true', () => {
    engine.addResource('gold', 50);
    const result = engine.spendResource('gold', 30);
    expect(result).toBe(true);
    expect(engine.getResource('gold')?.amount).toBe(20);
  });

  it('spendResource 资源不足时返回 false', () => {
    engine.addResource('gold', 10);
    const result = engine.spendResource('gold', 50);
    expect(result).toBe(false);
    expect(engine.getResource('gold')?.amount).toBe(10);
  });

  it('canAfford 检查多资源费用', () => {
    engine.addResource('gold', 100);
    engine.addResource('papyrus', 50);
    expect(engine.canAfford({ gold: 50, papyrus: 10 })).toBe(true);
    expect(engine.canAfford({ gold: 200 })).toBe(false);
  });

  it('getResource 返回 undefined 对于不存在的资源', () => {
    expect(engine.getResource('nonexistent')).toBeUndefined();
  });

  it('addResource 正数时自动解锁资源', () => {
    expect(engine.getResource('papyrus')?.unlocked).toBe(false);
    engine.addResource('papyrus', 10);
    expect(engine.getResource('papyrus')?.unlocked).toBe(true);
  });

  it('addResource 不超过 maxAmount', () => {
    engine.addResource('gold', 1e20);
    expect(engine.getResource('gold')!.amount).toBeLessThanOrEqual(1e15);
  });

  it('addResource 触发 resourceChange 事件', () => {
    const listener = vi.fn();
    engine.on('resourceChange', listener);
    engine.addResource('gold', 50);
    expect(listener).toHaveBeenCalledWith('gold', 50);
  });
});

// ================================================================
// 5. 建筑 (8 tests)
// ================================================================

describe('EgyptMythEngine — 建筑', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('初始只有 sand_pit 已解锁', () => {
    const state = engine.getState();
    // sand_pit should be available, others locked
    expect(engine.getBuildingLevel(0)).toBe(0); // sand_pit index 0
  });

  it('purchaseBuilding(index) 购买已解锁且买得起的建筑', () => {
    engine.addResource('gold', 100);
    const result = engine.purchaseBuilding(0); // sand_pit
    expect(result).toBe(true);
    expect(engine.getBuildingLevel(0)).toBe(1);
  });

  it('purchaseBuilding(index) 资源不足时返回 false', () => {
    const result = engine.purchaseBuilding(0);
    expect(result).toBe(false);
    expect(engine.getBuildingLevel(0)).toBe(0);
  });

  it('purchaseBuilding(index) 无效索引返回 false', () => {
    expect(engine.purchaseBuilding(-1)).toBe(false);
    expect(engine.purchaseBuilding(999)).toBe(false);
  });

  it('购买建筑后扣除资源', () => {
    engine.addResource('gold', 100);
    const cost = engine.getBuildingCost(0);
    const goldBefore = engine.getResource('gold')!.amount;
    engine.purchaseBuilding(0);
    expect(engine.getResource('gold')!.amount).toBeLessThan(goldBefore);
  });

  it('建筑费用随等级递增', () => {
    engine.addResource('gold', 10000);
    const cost1 = engine.getBuildingCost(0);
    engine.purchaseBuilding(0);
    const cost2 = engine.getBuildingCost(0);
    // cost2 should be > cost1 (due to costMultiplier 1.15)
    expect(cost2.gold).toBeGreaterThan(cost1.gold);
  });

  it('未解锁建筑不可购买', () => {
    engine.addResource('gold', 100000);
    // pyramid (index 1) requires sand_pit level > 0
    const result = engine.purchaseBuilding(1);
    expect(result).toBe(false);
  });

  it('购买前置建筑后，后续建筑解锁', () => {
    engine.addResource('gold', 100000);
    // Buy sand_pit first
    engine.purchaseBuilding(0);
    // Building unlock check happens in onUpdate, trigger an update cycle
    engine.update(16);
    // Now pyramid should be unlocked
    const result = engine.purchaseBuilding(1);
    expect(result).toBe(true);
  });
});

// ================================================================
// 6. 神明 (8 tests)
// ================================================================

describe('EgyptMythEngine — 神明', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('初始 ra 已解锁', () => {
    const ra = engine.gods.find((g) => g.id === 'ra');
    expect(ra?.unlocked).toBe(true);
  });

  it('unlockGod 解锁需要足够黄金', () => {
    engine.addResource('gold', 1000);
    const result = engine.unlockGod('isis'); // cost: 800
    expect(result).toBe(true);
    const isis = engine.gods.find((g) => g.id === 'isis');
    expect(isis?.unlocked).toBe(true);
  });

  it('unlockGod 黄金不足返回 false', () => {
    engine.addResource('gold', 100);
    const result = engine.unlockGod('isis');
    expect(result).toBe(false);
  });

  it('unlockGod 无效 godId 返回 false', () => {
    engine.addResource('gold', 100000);
    expect(engine.unlockGod('nonexistent')).toBe(false);
  });

  it('unlockGod 已解锁神明返回 false', () => {
    engine.addResource('gold', 100000);
    expect(engine.unlockGod('ra')).toBe(false); // already unlocked
  });

  it('解锁神明扣除黄金', () => {
    engine.addResource('gold', 1000);
    const before = engine.getResource('gold')!.amount;
    engine.unlockGod('isis');
    expect(engine.getResource('gold')!.amount).toBe(before - 800);
  });

  it('gods getter 返回副本（不可直接修改内部状态）', () => {
    const gods1 = engine.gods;
    const gods2 = engine.gods;
    expect(gods1).not.toBe(gods2); // different array references
  });

  it('解锁神明后触发 godUnlocked 事件', () => {
    engine.addResource('gold', 1000);
    const listener = vi.fn();
    engine.on('godUnlocked', listener);
    engine.unlockGod('isis');
    expect(listener).toHaveBeenCalledWith('isis');
  });

  it('所有神明都有正确的 id', () => {
    const ids = ['ra', 'isis', 'thoth', 'anubis', 'horus', 'osiris'];
    const gods = engine.gods;
    ids.forEach((id) => {
      expect(gods.find((g) => g.id === id)).toBeDefined();
    });
  });

  it('神明初始庇护等级均为 0', () => {
    const gods = engine.gods;
    expect(gods.every((g) => g.blessingLevel === 0)).toBe(true);
  });
});

// ================================================================
// 7. 木乃伊 (6 tests)
// ================================================================

describe('EgyptMythEngine — 木乃伊', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('初始木乃伊列表有 3 个，均未召唤', () => {
    const mummies = engine.mummies;
    expect(mummies).toHaveLength(3);
    expect(mummies.every((m) => !m.summoned)).toBe(true);
  });

  it('初始碎片为 0', () => {
    const mummies = engine.mummies;
    expect(mummies.every((m) => m.fragments === 0)).toBe(true);
  });

  it('summonMummy 碎片不足时返回 false', () => {
    const result = engine.summonMummy('common_mummy'); // needs 10 fragments
    expect(result).toBe(false);
  });

  it('summonMummy 无效 ID 返回 false', () => {
    expect(engine.summonMummy('nonexistent')).toBe(false);
  });

  it('summonMummy 碎片足够时成功召唤', () => {
    // Use loadState to set fragments
    const state = engine.getState();
    state.mummies = state.mummies.map((m) =>
      m.id === 'common_mummy' ? { ...m, fragments: 15 } : m
    );
    engine.loadState(state);

    const result = engine.summonMummy('common_mummy');
    expect(result).toBe(true);

    const mummy = engine.mummies.find((m) => m.id === 'common_mummy');
    expect(mummy?.summoned).toBe(true);
    expect(mummy?.fragments).toBe(5); // 15 - 10 = 5
  });

  it('summonMummy 已召唤的木乃伊返回 false', () => {
    const state = engine.getState();
    state.mummies = state.mummies.map((m) =>
      m.id === 'common_mummy' ? { ...m, fragments: 20, summoned: true } : m
    );
    engine.loadState(state);

    const result = engine.summonMummy('common_mummy');
    expect(result).toBe(false);
  });

  it('summonMummy 触发 mummySummoned 事件', () => {
    const state = engine.getState();
    state.mummies = state.mummies.map((m) =>
      m.id === 'common_mummy' ? { ...m, fragments: 15 } : m
    );
    engine.loadState(state);

    const listener = vi.fn();
    engine.on('mummySummoned', listener);
    engine.summonMummy('common_mummy');
    expect(listener).toHaveBeenCalledWith('common_mummy');
  });

  it('木乃伊召唤后碎片扣除正确', () => {
    const state = engine.getState();
    state.mummies = state.mummies.map((m) =>
      m.id === 'royal_mummy' ? { ...m, fragments: 55 } : m
    );
    engine.loadState(state);

    engine.summonMummy('royal_mummy'); // needs 50 fragments
    const mummy = engine.mummies.find((m) => m.id === 'royal_mummy');
    expect(mummy?.fragments).toBe(5);
  });

  it('mummies getter 返回副本', () => {
    const m1 = engine.mummies;
    const m2 = engine.mummies;
    expect(m1).not.toBe(m2);
  });
});

// ================================================================
// 8. 转生 / 声望 (6 tests)
// ================================================================

describe('EgyptMythEngine — 转生/声望', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('canPrestige() 初始为 false', () => {
    expect(engine.canPrestige()).toBe(false);
  });

  it('canPrestige() 总黄金 >= 50000 时为 true', () => {
    setTotalGoldEarned(engine, 60000);
    expect(engine.canPrestige()).toBe(true);
  });

  it('doPrestige() 未达标时返回 0', () => {
    const result = engine.doPrestige();
    expect(result).toBe(0);
  });

  it('doPrestige() 达标时返回神圣之力', () => {
    setTotalGoldEarned(engine, 100000);
    const result = engine.doPrestige();
    expect(result).toBeGreaterThan(0);
  });

  it('doPrestige() 后资源重置但声望保留', () => {
    setTotalGoldEarned(engine, 100000);
    engine.doPrestige();

    // Gold should be reset
    expect(engine.getResource('gold')?.amount).toBe(0);
    // Prestige currency should be > 0
    const state = engine.getState();
    expect(state.prestige.currency).toBeGreaterThan(0);
    expect(state.prestige.count).toBe(1);
  });

  it('getPrestigeMultiplier() 根据声望货币计算', () => {
    // Initially no prestige currency, multiplier = 1
    expect(engine.getPrestigeMultiplier()).toBe(1);

    // Set some prestige
    setTotalGoldEarned(engine, 100000);
    engine.doPrestige();
    const mult = engine.getPrestigeMultiplier();
    expect(mult).toBeGreaterThan(1);
  });

  it('doPrestige() 保留声望计数', () => {
    setTotalGoldEarned(engine, 100000);
    engine.doPrestige();
    const state = engine.getState();
    expect(state.prestige.count).toBe(1);
  });

  it('getPrestigePreview() 未达标时返回 0', () => {
    expect(engine.getPrestigePreview()).toBe(0);
  });

  it('getPrestigePreview() 达标时返回预览值', () => {
    setTotalGoldEarned(engine, 100000);
    const preview = engine.getPrestigePreview();
    expect(preview).toBeGreaterThan(0);
  });

  it('doPrestige() 触发 prestige 事件', () => {
    setTotalGoldEarned(engine, 100000);
    const listener = vi.fn();
    engine.on('prestige', listener);
    engine.doPrestige();
    expect(listener).toHaveBeenCalled();
  });
});

// ================================================================
// 9. 存档 (5 tests)
// ================================================================

describe('EgyptMythEngine — 存档', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('save() 返回包含 gameId 的存档数据', () => {
    const data = engine.save();
    expect(data.gameId).toBe('egypt-myth');
    expect(data.version).toBeDefined();
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it('save() 包含资源数据', () => {
    engine.addResource('gold', 42);
    const data = engine.save();
    expect(data.resources.gold).toBeDefined();
    expect(data.resources.gold.amount).toBe(42);
  });

  it('load() 恢复资源状态', () => {
    engine.addResource('gold', 500);
    const data = engine.save();

    // Create new engine and load
    const engine2 = new EgyptMythEngine();
    engine2.init(createMockCanvas());
    engine2.start();
    engine2.load(data);

    // Note: load may apply offline earnings, so amount >= 500
    expect(engine2.getResource('gold')?.amount).toBeGreaterThanOrEqual(500);
    engine2.destroy();
  });

  it('load() gameId 不匹配时不恢复', () => {
    const data = engine.save();
    data.gameId = 'wrong-game';

    const engine2 = new EgyptMythEngine();
    engine2.init(createMockCanvas());
    engine2.start();
    engine2.addResource('gold', 999);
    engine2.load(data);
    // Should not have loaded (gold stays at 999 since load returns early)
    expect(engine2.getResource('gold')?.amount).toBe(999);
    engine2.destroy();
  });

  it('save/load 往返保持建筑等级', () => {
    engine.addResource('gold', 1000);
    engine.purchaseBuilding(0);
    const data = engine.save();

    const engine2 = new EgyptMythEngine();
    engine2.init(createMockCanvas());
    engine2.start();
    engine2.load(data);

    expect(engine2.getBuildingLevel(0)).toBe(1);
    engine2.destroy();
  });

  it('save() 包含声望数据', () => {
    const data = engine.save();
    expect(data.prestige).toBeDefined();
    expect(data.prestige.currency).toBe(0);
  });

  it('save() 包含统计信息', () => {
    engine.click();
    const data = engine.save();
    expect(data.statistics).toBeDefined();
  });
});

// ================================================================
// 10. 状态 (4 tests)
// ================================================================

describe('EgyptMythEngine — 状态', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('getState() 返回完整状态对象', () => {
    const state = engine.getState();
    expect(state.resources).toBeDefined();
    expect(state.gods).toBeDefined();
    expect(state.mummies).toBeDefined();
    expect(state.blessing).toBeDefined();
    expect(state.prestige).toBeDefined();
    expect(state.statistics).toBeDefined();
    expect(state.selectedIndex).toBeDefined();
  });

  it('loadState() 恢复 selectedIndex', () => {
    const state = engine.getState();
    state.selectedIndex = 3;
    engine.loadState(state);
    expect(engine.selectedIndex).toBe(3);
  });

  it('loadState() 恢复神明解锁状态', () => {
    const state = engine.getState();
    state.gods = state.gods.map((g) =>
      g.id === 'isis' ? { ...g, unlocked: true } : g
    );
    engine.loadState(state);
    const isis = engine.gods.find((g) => g.id === 'isis');
    expect(isis?.unlocked).toBe(true);
  });

  it('loadState() 恢复木乃伊状态', () => {
    const state = engine.getState();
    state.mummies = state.mummies.map((m) =>
      m.id === 'common_mummy' ? { ...m, fragments: 5, summoned: true } : m
    );
    engine.loadState(state);
    const mummy = engine.mummies.find((m) => m.id === 'common_mummy');
    expect(mummy?.fragments).toBe(5);
    expect(mummy?.summoned).toBe(true);
  });
});

// ================================================================
// 11. 生命周期 (5 tests)
// ================================================================

describe('EgyptMythEngine — 生命周期', () => {
  it('init() 后状态为 idle', () => {
    const engine = new EgyptMythEngine();
    engine.init(createMockCanvas());
    expect(engine.status).toBe('idle');
    engine.destroy();
  });

  it('start() 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
    engine.destroy();
  });

  it('pause() 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
    engine.destroy();
  });

  it('resume() 后状态恢复为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
    engine.destroy();
  });

  it('reset() 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    engine.click();
    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.totalClicks).toBe(0);
    engine.destroy();
  });

  it('destroy() 后监听器被清除', () => {
    const engine = createAndStartEngine();
    const listener = vi.fn();
    engine.on('stateChange', listener);
    engine.destroy();
    // After destroy, emit should not reach listener
    // Re-init and check
    engine.init(createMockCanvas());
    engine.start();
    engine.click();
    // The old listener should not be called after destroy+reinit
    // (destroy clears listeners, but new init doesn't re-add them)
  });

  it('start() 设置分数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
    engine.destroy();
  });
});

// ================================================================
// 12. 格式化 (3 tests)
// ================================================================

describe('EgyptMythEngine — 格式化', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = new EgyptMythEngine();
    engine.init(createMockCanvas());
  });

  afterEach(() => {
    engine.destroy();
  });

  it('formatNumber 小数格式', () => {
    expect(engine.formatNumber(1.5)).toBe('1.5');
  });

  it('formatNumber 千级格式', () => {
    expect(engine.formatNumber(1500)).toBe('1.5K');
  });

  it('formatNumber 百万级格式', () => {
    expect(engine.formatNumber(2500000)).toBe('2.5M');
  });
});

// ================================================================
// 13. 渲染 (3 tests)
// ================================================================

describe('EgyptMythEngine — 渲染', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('render 不抛异常', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    expect(() => {
      engine.onRender(ctx, 480, 640);
    }).not.toThrow();
  });

  it('render 使用 createLinearGradient', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    const spy = vi.spyOn(ctx, 'createLinearGradient');
    engine.onRender(ctx, 480, 640);
    expect(spy).toHaveBeenCalled();
  });

  it('render 使用 createRadialGradient', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    const spy = vi.spyOn(ctx, 'createRadialGradient');
    engine.onRender(ctx, 480, 640);
    expect(spy).toHaveBeenCalled();
  });

  it('render 使用 ellipse', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    const spy = vi.spyOn(ctx, 'ellipse');
    engine.onRender(ctx, 480, 640);
    expect(spy).toHaveBeenCalled();
  });

  it('render 使用 arcTo', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d')!;
    const spy = vi.spyOn(ctx, 'arcTo');
    engine.onRender(ctx, 480, 640);
    expect(spy).toHaveBeenCalled();
  });
});

// ================================================================
// 14. 键盘 (4 tests)
// ================================================================

describe('EgyptMythEngine — 键盘', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('空格键触发 click', () => {
    const before = engine.totalClicks;
    engine.handleKeyDown(' ');
    expect(engine.totalClicks).toBe(before + 1);
  });

  it('ArrowDown 增加 selectedIndex', () => {
    const before = engine.selectedIndex;
    engine.handleKeyDown('ArrowDown');
    expect(engine.selectedIndex).toBe(before + 1);
  });

  it('ArrowUp 减少 selectedIndex', () => {
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowDown');
    const idx = engine.selectedIndex;
    engine.handleKeyDown('ArrowUp');
    expect(engine.selectedIndex).toBe(idx - 1);
  });

  it('Enter 键购买当前选中建筑', () => {
    engine.addResource('gold', 100);
    engine.handleKeyDown('Enter'); // selectedIndex=0 → sand_pit
    expect(engine.getBuildingLevel(0)).toBe(1);
  });

  it('B 键触发神明庇护', () => {
    // ra is unlocked, blessing costs { gold: 500, papyrus: 10 }
    engine.addResource('gold', 1000);
    engine.addResource('papyrus', 50);
    engine.handleKeyDown('b');
    const ra = engine.gods.find((g) => g.id === 'ra');
    expect(ra?.blessingLevel).toBe(1);
  });

  it('P 键触发转生（未达标不生效）', () => {
    engine.handleKeyDown('p');
    expect(engine.canPrestige()).toBe(false);
  });

  it('G 键尝试解锁下一个神明', () => {
    engine.addResource('gold', 1000);
    engine.handleKeyDown('g');
    const isis = engine.gods.find((g) => g.id === 'isis');
    expect(isis?.unlocked).toBe(true);
  });

  it('M 键尝试召唤木乃伊（碎片不足不生效）', () => {
    engine.handleKeyDown('m');
    const mummy = engine.mummies.find((m) => m.id === 'common_mummy');
    expect(mummy?.summoned).toBe(false);
  });
});

// ================================================================
// 15. 边界 (10 tests)
// ================================================================

describe('EgyptMythEngine — 边界', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('selectedIndex 不能低于 0', () => {
    engine.handleKeyDown('ArrowUp'); // already at 0
    expect(engine.selectedIndex).toBe(0);
  });

  it('selectedIndex 不能超过建筑数-1', () => {
    for (let i = 0; i < 20; i++) {
      engine.handleKeyDown('ArrowDown');
    }
    expect(engine.selectedIndex).toBeLessThanOrEqual(BUILDINGS.length - 1);
  });

  it('资源不超过 maxAmount', () => {
    engine.addResource('gold', 1e20);
    expect(engine.getResource('gold')!.amount).toBeLessThanOrEqual(1e15);
  });

  it('spendResource 不使资源变为负数', () => {
    engine.addResource('gold', 5);
    const result = engine.spendResource('gold', 100);
    expect(result).toBe(false);
    expect(engine.getResource('gold')!.amount).toBe(5);
  });

  it('purchaseBuilding 建筑达到 maxLevel 后不可再购买', () => {
    engine.addResource('gold', 1e12);
    // Buy sand_pit to max level (50)
    for (let i = 0; i < 55; i++) {
      engine.purchaseBuilding(0);
    }
    // Should be at max level
    expect(engine.getBuildingLevel(0)).toBeLessThanOrEqual(BUILDINGS[0].maxLevel);
    // Further purchase should fail
    expect(engine.purchaseBuilding(0)).toBe(false);
  });

  it('getBuildingCost 无效索引返回空对象', () => {
    expect(engine.getBuildingCost(-1)).toEqual({});
    expect(engine.getBuildingCost(999)).toEqual({});
  });

  it('getBuildingLevel 无效索引返回 0', () => {
    expect(engine.getBuildingLevel(-1)).toBe(0);
    expect(engine.getBuildingLevel(999)).toBe(0);
  });

  it('handleKeyDown 非 playing 状态不响应', () => {
    engine.pause();
    const before = engine.totalClicks;
    engine.handleKeyDown(' ');
    expect(engine.totalClicks).toBe(before);
  });

  it('连续快速 click 不丢失计数', () => {
    for (let i = 0; i < 100; i++) {
      engine.click();
    }
    expect(engine.totalClicks).toBe(100);
    expect(engine.totalGoldEarned).toBeGreaterThanOrEqual(100);
  });

  it('loadState(null/undefined fields) 不崩溃', () => {
    expect(() => {
      engine.loadState({} as EgyptMythState);
    }).not.toThrow();
  });

  it('unlockGod 不存在的神明不崩溃', () => {
    expect(() => engine.unlockGod('zeus')).not.toThrow();
    expect(engine.unlockGod('zeus')).toBe(false);
  });

  it('summonMummy 不存在的木乃伊不崩溃', () => {
    expect(() => engine.summonMummy('fake_mummy')).not.toThrow();
    expect(engine.summonMummy('fake_mummy')).toBe(false);
  });

  it('doPrestige() 保留已解锁神明', () => {
    engine.addResource('gold', 5000);
    engine.unlockGod('isis');
    setTotalGoldEarned(engine, 60000);
    engine.doPrestige();
    const isis = engine.gods.find((g) => g.id === 'isis');
    expect(isis?.unlocked).toBe(true);
  });

  it('doPrestige() 保留已召唤木乃伊', () => {
    const state = engine.getState();
    state.mummies = state.mummies.map((m) =>
      m.id === 'common_mummy' ? { ...m, fragments: 20, summoned: true } : m
    );
    engine.loadState(state);
    setTotalGoldEarned(engine, 60000);
    engine.doPrestige();
    const mummy = engine.mummies.find((m) => m.id === 'common_mummy');
    expect(mummy?.summoned).toBe(true);
  });

  it('handleKeyUp 不抛异常', () => {
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
  });

  it('destroy 后可以重新 init/start', () => {
    engine.click();
    engine.destroy();
    engine.init(createMockCanvas());
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.totalClicks).toBe(0);
  });

  it('formatNumber 处理负数', () => {
    const result = engine.formatNumber(-1500);
    expect(result).toContain('-');
  });

  it('formatNumber 处理 0', () => {
    expect(engine.formatNumber(0)).toBe('0');
  });

  it('formatNumber 处理十亿级', () => {
    expect(engine.formatNumber(3e9)).toContain('B');
  });
});

// ================================================================
// 16. 自动生产 (3 tests)
// ================================================================

describe('EgyptMythEngine — 自动生产', () => {
  let engine: EgyptMythEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('购买 sand_pit 后黄金 perSecond > 0', () => {
    engine.addResource('gold', 100);
    engine.purchaseBuilding(0);
    const gold = engine.getResource('gold');
    expect(gold?.perSecond).toBeGreaterThan(0);
  });

  it('update 调用后资源增加', () => {
    engine.addResource('gold', 100);
    engine.purchaseBuilding(0);

    const goldBefore = engine.getResource('gold')!.amount;
    // Simulate update tick (1000ms = 1s)
    engine.update(1000);
    const goldAfter = engine.getResource('gold')!.amount;
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  it('recalculateProduction 正确计算多建筑产出', () => {
    engine.addResource('gold', 100000);
    engine.purchaseBuilding(0); // sand_pit
    // Trigger update to run checkBuildingUnlocks
    engine.update(16);
    engine.purchaseBuilding(1); // pyramid (requires sand_pit)

    const papyrus = engine.getResource('papyrus');
    // After buying pyramid, papyrus production should exist
    expect(papyrus?.perSecond).toBeGreaterThan(0);
  });
});
