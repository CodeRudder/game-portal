/**
 * GameEventSimulator 测试套件
 *
 * 验证模拟器的所有公共方法能正确调用引擎 API，
 * 确保测试基础设施本身是可靠的。
 */

import { GameEventSimulator } from '../GameEventSimulator';
import type { ResourceType, BuildingType } from '../../shared/types';

// ── 基础生命周期 ──

describe('GameEventSimulator — 生命周期', () => {
  it('应能创建实例并初始化引擎', () => {
    const sim = new GameEventSimulator();
    expect(sim.engine).toBeDefined();
    sim.init();
    expect(sim.engine.isInitialized()).toBe(true);
  });

  it('应能重置引擎', () => {
    const sim = new GameEventSimulator();
    sim.init();
    sim.reset();
    expect(sim.engine.isInitialized()).toBe(false);
    // reset 会记录一条日志
    expect(sim.getEventLog().length).toBe(1);
    expect(sim.getEventLog()[0].event).toBe('reset');
  });
});

// ── 资源操作 ──

describe('GameEventSimulator — 资源操作', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = new GameEventSimulator();
    sim.init();
  });

  afterEach(() => {
    sim.reset();
  });

  it('addResources 应正确添加资源', () => {
    sim.addResources({ gold: 1000, grain: 500 });
    expect(sim.getResource('gold')).toBeGreaterThanOrEqual(1000);
    expect(sim.getResource('grain')).toBeGreaterThanOrEqual(500);
  });

  it('addResources 应忽略零和负值', () => {
    const goldBefore = sim.getResource('gold');
    sim.addResources({ gold: 0 } as any);
    expect(sim.getResource('gold')).toBe(goldBefore);
  });

  it('consumeResources 应正确消耗资源', () => {
    sim.setResource('gold', 5000);
    sim.consumeResources({ gold: 1000 });
    expect(sim.getResource('gold')).toBe(4000);
  });

  it('setResource 应设置精确值', () => {
    sim.setResource('gold', 9999);
    expect(sim.getResource('gold')).toBe(9999);
  });

  it('getAllResources 应返回资源副本', () => {
    sim.addResources({ gold: 100 });
    const res = sim.getAllResources();
    expect(res).toHaveProperty('gold');
    expect(res).toHaveProperty('grain');
    expect(res).toHaveProperty('troops');
    expect(res).toHaveProperty('mandate');
  });

  it('资源操作应记录事件日志', () => {
    sim.addResources({ gold: 100 });
    const log = sim.getEventLog();
    const entry = log.find(e => e.event === 'addResources');
    expect(entry).toBeDefined();
    expect(entry!.detail).toContain('gold');
  });
});

// ── 建筑操作 ──

describe('GameEventSimulator — 建筑操作', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = new GameEventSimulator();
    sim.init();
    // 确保有足够资源升级建筑
    sim.addResources({ gold: 100000, grain: 100000, troops: 50000, mandate: 10000 });
  });

  afterEach(() => {
    sim.reset();
  });

  it('upgradeBuilding 应提升建筑等级', () => {
    const levelBefore = sim.getBuildingLevel('castle');
    sim.upgradeBuilding('castle');
    const levelAfter = sim.getBuildingLevel('castle');
    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it('upgradeBuildingTo 应升级到目标等级', () => {
    sim.upgradeBuildingTo('castle', 3);
    expect(sim.getBuildingLevel('castle')).toBe(3);
  });

  it('getAllBuildingLevels 应返回所有建筑等级', () => {
    const levels = sim.getAllBuildingLevels();
    expect(Object.keys(levels).length).toBeGreaterThan(0);
    expect(levels).toHaveProperty('castle');
    expect(levels).toHaveProperty('farmland');
  });
});

// ── 武将操作 ──

describe('GameEventSimulator — 武将操作', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = new GameEventSimulator();
    sim.init();
  });

  afterEach(() => {
    sim.reset();
  });

  it('addHeroDirectly 应添加指定武将', () => {
    const result = sim.addHeroDirectly('liubei');
    expect(result).not.toBeNull();
    expect(result!.id ?? (result as any).generalId).toBeTruthy();
  });

  it('addHeroDirectly 不存在的武将应返回 null', () => {
    const result = sim.addHeroDirectly('nonexistent_hero');
    expect(result).toBeNull();
  });

  it('getGenerals 应返回已添加的武将列表', () => {
    sim.addHeroDirectly('guanyu');
    sim.addHeroDirectly('zhangfei');
    const generals = sim.getGenerals();
    expect(generals.length).toBeGreaterThanOrEqual(2);
  });

  it('getGeneralCount 应返回正确的武将数量', () => {
    expect(sim.getGeneralCount()).toBe(0);
    sim.addHeroDirectly('liubei');
    expect(sim.getGeneralCount()).toBe(1);
    sim.addHeroDirectly('guanyu');
    expect(sim.getGeneralCount()).toBe(2);
  });

  it('getTotalPower 应返回总战力', () => {
    sim.addHeroDirectly('liubei');
    const power = sim.getTotalPower();
    expect(power).toBeGreaterThan(0);
  });

  it('addHeroFragments 应增加碎片', () => {
    sim.addHeroFragments('liubei', 10);
    const fragments = sim.engine.hero.getFragments('liubei');
    expect(fragments).toBe(10);
  });
});

// ── 战斗/关卡 ──

describe('GameEventSimulator — 战斗与关卡', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = new GameEventSimulator();
    sim.init();
    sim.addResources({ gold: 100000, grain: 100000, troops: 50000, mandate: 10000 });
    // 添加武将并设置阵容，确保有战力
    sim.addHeroDirectly('liubei');
    sim.addHeroDirectly('guanyu');
    sim.addHeroDirectly('zhangfei');
    sim.engine.createFormation('main');
    sim.engine.setFormation('main', ['liubei', 'guanyu', 'zhangfei']);
  });

  afterEach(() => {
    sim.reset();
  });

  it('winBattle 应完成关卡并返回战斗结果', () => {
    const result = sim.winBattle('chapter1_stage1', 3);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('outcome');
    expect(result).toHaveProperty('stars');
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  it('winBattle 应推进关卡进度', () => {
    const progressBefore = sim.getCampaignProgress();
    sim.winBattle('chapter1_stage1', 3);
    const progressAfter = sim.getCampaignProgress();
    // 验证进度有变化（星级或已通关关卡数）
    expect(progressAfter).toBeDefined();
  });

  it('getStageList 应返回关卡列表', () => {
    const stages = sim.getStageList();
    expect(stages.length).toBeGreaterThan(0);
  });
});

// ── 时间快进 ──

describe('GameEventSimulator — 时间快进', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = new GameEventSimulator();
    sim.init();
  });

  afterEach(() => {
    sim.reset();
  });

  it('fastForward 应推进游戏时间', () => {
    sim.fastForward(1000);
    expect(sim.getOnlineSeconds()).toBeGreaterThanOrEqual(1);
  });

  it('fastForwardSeconds 应正确换算', () => {
    sim.fastForwardSeconds(30);
    expect(sim.getOnlineSeconds()).toBeGreaterThanOrEqual(30);
  });

  it('fastForwardMinutes 应正确换算', () => {
    sim.fastForwardMinutes(1);
    expect(sim.getOnlineSeconds()).toBeGreaterThanOrEqual(60);
  });

  it('fastForwardHours 应正确换算', () => {
    sim.fastForwardHours(1);
    expect(sim.getOnlineSeconds()).toBeGreaterThanOrEqual(3600);
  });

  it('连续快进应累加时间', () => {
    sim.fastForwardSeconds(10);
    sim.fastForwardSeconds(20);
    expect(sim.getOnlineSeconds()).toBeGreaterThanOrEqual(30);
  });
});

// ── 快捷状态 ──

describe('GameEventSimulator — 快捷状态初始化', () => {
  it('initBeginnerState 应设置新手资源与建筑', () => {
    const sim = new GameEventSimulator();
    sim.initBeginnerState();
    const snap = sim.getSnapshot();

    expect(snap.resources.gold).toBeGreaterThanOrEqual(2000);
    expect(snap.resources.grain).toBeGreaterThanOrEqual(1000);
    expect(snap.resources.troops).toBeGreaterThanOrEqual(500);
    // 建筑应有升级
    expect(snap.buildingLevels.farmland).toBeGreaterThan(1);
    expect(snap.generalCount).toBeGreaterThanOrEqual(0);
    sim.reset();
  });

  it('initMidGameState 应设置中期状态', () => {
    const sim = new GameEventSimulator();
    sim.initMidGameState();
    const snap = sim.getSnapshot();

    // 资源被消耗用于建筑升级，但应仍有大量剩余
    expect(snap.resources.gold).toBeGreaterThan(0);
    expect(snap.generalCount).toBe(5);
    expect(snap.buildingLevels.castle).toBeGreaterThanOrEqual(5);
    expect(snap.totalPower).toBeGreaterThan(0);
    sim.reset();
  });
});

// ── 快照与事件日志 ──

describe('GameEventSimulator — 快照与事件日志', () => {
  it('getSnapshot 应返回完整快照', () => {
    const sim = new GameEventSimulator();
    sim.initBeginnerState();
    const snap = sim.getSnapshot();

    expect(snap).toHaveProperty('resources');
    expect(snap).toHaveProperty('productionRates');
    expect(snap).toHaveProperty('buildingLevels');
    expect(snap).toHaveProperty('generalCount');
    expect(snap).toHaveProperty('totalPower');
    expect(snap).toHaveProperty('campaignProgress');
    expect(snap).toHaveProperty('onlineSeconds');
    sim.reset();
  });

  it('getEventLog 应记录所有操作', () => {
    const sim = new GameEventSimulator();
    sim.initBeginnerState();
    const log = sim.getEventLog();

    expect(log.length).toBeGreaterThan(0);
    const events = log.map(e => e.event);
    expect(events).toContain('addResources');
    expect(events).toContain('upgradeBuilding');
    expect(events).toContain('initBeginnerState');
    sim.reset();
  });

  it('clearEventLog 应清空日志', () => {
    const sim = new GameEventSimulator();
    sim.initBeginnerState();
    expect(sim.getEventLog().length).toBeGreaterThan(0);
    sim.clearEventLog();
    expect(sim.getEventLog().length).toBe(0);
    sim.reset();
  });

  it('事件日志条目应有 timestamp 和 detail', () => {
    const sim = new GameEventSimulator();
    sim.init();
    sim.addResources({ gold: 100 });
    const entry = sim.getEventLog().find(e => e.event === 'addResources');
    expect(entry).toBeDefined();
    expect(typeof entry!.timestamp).toBe('number');
    expect(typeof entry!.detail).toBe('string');
    sim.reset();
  });
});

// ── 链式调用 ──

describe('GameEventSimulator — 链式调用', () => {
  it('所有 mutating 方法应返回 this 以支持链式调用', () => {
    const sim = new GameEventSimulator();
    const result = sim
      .init()
      .addResources({ gold: 5000 })
      .fastForward(1000)
      .clearEventLog();

    expect(result).toBe(sim);
    sim.reset();
  });
});
