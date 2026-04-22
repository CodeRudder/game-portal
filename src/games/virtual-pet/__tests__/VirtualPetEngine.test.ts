import { vi } from 'vitest';
/**
 * 电子宠物 Virtual Pet — 完整测试套件
 */
import { VirtualPetEngine } from '../VirtualPetEngine';
import {
  STAT_MIN,
  STAT_MAX,
  DECAY_RATES,
  ACTION_EFFECTS,
  ACTION_COOLDOWNS,
  Mood,
  MOOD_THRESHOLDS,
  SICK_THRESHOLDS,
  GrowthStage,
  GROWTH_THRESHOLDS,
  STAT_PANELS,
  ACTION_BUTTONS,
  type StatKey,
  type ActionKey,
} from '../constants';

/** 创建 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

/** 创建并初始化引擎 */
function createEngine(): VirtualPetEngine {
  const engine = new VirtualPetEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建并启动引擎 */
function createAndStartEngine(): VirtualPetEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

// ========== 常量测试 ==========
describe('constants', () => {
  it('STAT_MIN 应为 0', () => {
    expect(STAT_MIN).toBe(0);
  });

  it('STAT_MAX 应为 100', () => {
    expect(STAT_MAX).toBe(100);
  });

  it('衰减速率应全部为正数', () => {
    for (const rate of Object.values(DECAY_RATES)) {
      expect(rate).toBeGreaterThan(0);
    }
  });

  it('衰减速率应包含四个属性', () => {
    expect(Object.keys(DECAY_RATES)).toHaveLength(4);
    expect(DECAY_RATES).toHaveProperty('hunger');
    expect(DECAY_RATES).toHaveProperty('cleanliness');
    expect(DECAY_RATES).toHaveProperty('happiness');
    expect(DECAY_RATES).toHaveProperty('energy');
  });

  it('操作效果应包含四个操作', () => {
    expect(Object.keys(ACTION_EFFECTS)).toHaveLength(4);
    expect(ACTION_EFFECTS).toHaveProperty('feed');
    expect(ACTION_EFFECTS).toHaveProperty('bath');
    expect(ACTION_EFFECTS).toHaveProperty('play');
    expect(ACTION_EFFECTS).toHaveProperty('sleep');
  });

  it('冷却时间应全部为正数', () => {
    for (const cd of Object.values(ACTION_COOLDOWNS)) {
      expect(cd).toBeGreaterThan(0);
    }
  });

  it('冷却时间应包含四个操作', () => {
    expect(Object.keys(ACTION_COOLDOWNS)).toHaveLength(4);
  });

  it('心情阈值应合理排序', () => {
    expect(MOOD_THRESHOLDS.happy).toBeGreaterThan(MOOD_THRESHOLDS.normal);
    expect(MOOD_THRESHOLDS.normal).toBeGreaterThan(MOOD_THRESHOLDS.sad);
  });

  it('生病阈值应合理', () => {
    expect(SICK_THRESHOLDS.hunger).toBeGreaterThan(0);
    expect(SICK_THRESHOLDS.cleanliness).toBeGreaterThan(0);
    expect(SICK_THRESHOLDS.hunger).toBeLessThan(STAT_MAX);
    expect(SICK_THRESHOLDS.cleanliness).toBeLessThan(STAT_MAX);
  });

  it('成长阶段阈值应递增', () => {
    const thresholds = GROWTH_THRESHOLDS.map(([, t]) => t);
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i - 1]).toBeGreaterThan(thresholds[i]);
    }
  });

  it('成长阶段应包含四个阶段', () => {
    expect(GROWTH_THRESHOLDS).toHaveLength(4);
  });

  it('属性面板应包含四个属性', () => {
    expect(STAT_PANELS).toHaveLength(4);
  });

  it('操作按钮应包含四个操作', () => {
    expect(ACTION_BUTTONS).toHaveLength(4);
  });

  it('Mood 枚举应包含四种心情', () => {
    expect(Object.values(Mood)).toHaveLength(4);
    expect(Mood.HAPPY).toBe('happy');
    expect(Mood.NORMAL).toBe('normal');
    expect(Mood.SAD).toBe('sad');
    expect(Mood.SICK).toBe('sick');
  });

  it('GrowthStage 枚举应包含四个阶段', () => {
    expect(Object.values(GrowthStage)).toHaveLength(4);
    expect(GrowthStage.EGG).toBe('egg');
    expect(GrowthStage.BABY).toBe('baby');
    expect(GrowthStage.CHILD).toBe('child');
    expect(GrowthStage.ADULT).toBe('adult');
  });
});

// ========== 引擎初始化测试 ==========
describe('VirtualPetEngine - 初始化', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('应正确创建引擎实例', () => {
    expect(engine).toBeInstanceOf(VirtualPetEngine);
  });

  it('初始状态应为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始分数应为 0', () => {
    expect(engine.score).toBe(0);
  });

  it('初始等级应为 1', () => {
    expect(engine.level).toBe(1);
  });

  it('初始属性应全为 80', () => {
    expect(engine.hunger).toBe(80);
    expect(engine.cleanliness).toBe(80);
    expect(engine.happiness).toBe(80);
    expect(engine.energy).toBe(80);
  });

  it('初始心情应为 HAPPY', () => {
    expect(engine.mood).toBe(Mood.HAPPY);
  });

  it('初始不应生病', () => {
    expect(engine.isSick).toBe(false);
  });

  it('初始成长阶段应为 EGG', () => {
    expect(engine.growthStage).toBe(GrowthStage.EGG);
  });

  it('初始在线时间应为 0', () => {
    expect(engine.totalOnlineTime).toBe(0);
  });

  it('初始选中面板应为 0', () => {
    expect(engine.selectedPanel).toBe(0);
  });

  it('初始不应在睡觉', () => {
    expect(engine.isSleeping).toBe(false);
  });

  it('stats 返回的应是副本', () => {
    const stats = engine.stats;
    stats.hunger = 50;
    expect(engine.hunger).toBe(80);
  });
});

// ========== 引擎启动测试 ==========
describe('VirtualPetEngine - 启动', () => {
  it('start 后状态应为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后属性应重置为 80', () => {
    const engine = createAndStartEngine();
    expect(engine.hunger).toBe(80);
    expect(engine.cleanliness).toBe(80);
    expect(engine.happiness).toBe(80);
    expect(engine.energy).toBe(80);
  });

  it('start 后分数应为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后成长阶段应为 EGG', () => {
    const engine = createAndStartEngine();
    expect(engine.growthStage).toBe(GrowthStage.EGG);
  });

  it('未设置 canvas 时 start 应抛出错误', () => {
    const engine = new VirtualPetEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });
});

// ========== 属性衰减测试 ==========
describe('VirtualPetEngine - 属性衰减', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('经过 1 秒后饥饿度应衰减', () => {
    const initial = engine.hunger;
    engine.update(1000);
    expect(engine.hunger).toBeLessThan(initial);
  });

  it('经过 1 秒后清洁度应衰减', () => {
    const initial = engine.cleanliness;
    engine.update(1000);
    expect(engine.cleanliness).toBeLessThan(initial);
  });

  it('经过 1 秒后快乐度应衰减', () => {
    const initial = engine.happiness;
    engine.update(1000);
    expect(engine.happiness).toBeLessThan(initial);
  });

  it('经过 1 秒后体力应衰减', () => {
    const initial = engine.energy;
    engine.update(1000);
    expect(engine.energy).toBeLessThan(initial);
  });

  it('衰减量应与衰减速率一致', () => {
    const initial = engine.hunger;
    engine.update(1000);
    const expectedDecay = DECAY_RATES.hunger;
    expect(engine.hunger).toBeCloseTo(initial - expectedDecay, 1);
  });

  it('经过 10 秒后衰减应更多', () => {
    const initial = engine.hunger;
    engine.update(10000);
    const expectedDecay = DECAY_RATES.hunger * 10;
    expect(engine.hunger).toBeCloseTo(initial - expectedDecay, 0);
  });

  it('属性不应衰减到低于 0', () => {
    // 手动设置极低属性
    engine.loadState({ stats: { hunger: 1, cleanliness: 1, happiness: 1, energy: 1 } });
    engine.update(10000);
    expect(engine.hunger).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.cleanliness).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.happiness).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.energy).toBeGreaterThanOrEqual(STAT_MIN);
  });

  it('非 playing 状态下不应衰减', () => {
    engine.pause();
    const initial = engine.hunger;
    engine.update(1000);
    expect(engine.hunger).toBe(initial);
  });

  it('生病时衰减应加速（1.5倍）', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
      isSick: true,
    });
    const initial = engine.cleanliness;
    engine.update(1000);
    const expectedDecay = DECAY_RATES.cleanliness * 1.5;
    expect(engine.cleanliness).toBeCloseTo(initial - expectedDecay, 1);
  });
});

// ========== 喂食测试 ==========
describe('VirtualPetEngine - 喂食', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('喂食应增加饥饿度', () => {
    engine.loadState({ stats: { hunger: 50, cleanliness: 80, happiness: 80, energy: 80 } });
    const result = engine.feed();
    expect(result).toBe(true);
    expect(engine.hunger).toBe(50 + ACTION_EFFECTS.feed.hunger);
  });

  it('喂食应增加少量快乐度', () => {
    engine.loadState({ stats: { hunger: 50, cleanliness: 80, happiness: 50, energy: 80 } });
    engine.feed();
    expect(engine.happiness).toBe(50 + ACTION_EFFECTS.feed.happiness);
  });

  it('喂食应略微降低清洁度', () => {
    engine.loadState({ stats: { hunger: 50, cleanliness: 80, happiness: 80, energy: 80 } });
    engine.feed();
    expect(engine.cleanliness).toBe(80 + ACTION_EFFECTS.feed.cleanliness);
  });

  it('喂食不影响体力', () => {
    engine.loadState({ stats: { hunger: 50, cleanliness: 80, happiness: 80, energy: 80 } });
    engine.feed();
    expect(engine.energy).toBe(80);
  });

  it('喂食应增加分数', () => {
    const initialScore = engine.score;
    engine.feed();
    expect(engine.score).toBeGreaterThan(initialScore);
  });

  it('饥饿度不应超过最大值', () => {
    engine.loadState({ stats: { hunger: 95, cleanliness: 80, happiness: 80, energy: 80 } });
    engine.feed();
    expect(engine.hunger).toBeLessThanOrEqual(STAT_MAX);
  });

  it('冷却期间不能再次喂食', () => {
    engine.feed();
    const result = engine.feed();
    expect(result).toBe(false);
  });

  it('冷却结束后可以再次喂食', () => {
    engine.feed();
    engine.update(ACTION_COOLDOWNS.feed + 100);
    const result = engine.feed();
    expect(result).toBe(true);
  });

  it('非 playing 状态不能喂食', () => {
    engine.pause();
    expect(engine.feed()).toBe(false);
  });

  it('睡觉时不能喂食', () => {
    engine.sleep(); // 进入睡觉
    expect(engine.feed()).toBe(false);
  });
});

// ========== 洗澡测试 ==========
describe('VirtualPetEngine - 洗澡', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('洗澡应增加清洁度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 50, happiness: 80, energy: 80 } });
    const result = engine.bath();
    expect(result).toBe(true);
    expect(engine.cleanliness).toBe(50 + ACTION_EFFECTS.bath.cleanliness);
  });

  it('洗澡应略微降低快乐度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 50, happiness: 80, energy: 80 } });
    engine.bath();
    expect(engine.happiness).toBe(80 + ACTION_EFFECTS.bath.happiness);
  });

  it('洗澡应略微降低体力', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 50, happiness: 80, energy: 80 } });
    engine.bath();
    expect(engine.energy).toBe(80 + ACTION_EFFECTS.bath.energy);
  });

  it('洗澡不影响饥饿度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 50, happiness: 80, energy: 80 } });
    engine.bath();
    expect(engine.hunger).toBe(80);
  });

  it('清洁度不应超过最大值', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 95, happiness: 80, energy: 80 } });
    engine.bath();
    expect(engine.cleanliness).toBeLessThanOrEqual(STAT_MAX);
  });

  it('冷却期间不能再次洗澡', () => {
    engine.bath();
    expect(engine.bath()).toBe(false);
  });

  it('生病时不能洗澡', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
      isSick: true,
    });
    expect(engine.bath()).toBe(false);
  });

  it('睡觉时不能洗澡', () => {
    engine.sleep();
    expect(engine.bath()).toBe(false);
  });
});

// ========== 玩耍测试 ==========
describe('VirtualPetEngine - 玩耍', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('玩耍应增加快乐度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 80 } });
    const result = engine.play();
    expect(result).toBe(true);
    expect(engine.happiness).toBe(50 + ACTION_EFFECTS.play.happiness);
  });

  it('玩耍应消耗体力', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 80 } });
    engine.play();
    expect(engine.energy).toBe(80 + ACTION_EFFECTS.play.energy);
  });

  it('玩耍应降低饥饿度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 80 } });
    engine.play();
    expect(engine.hunger).toBe(80 + ACTION_EFFECTS.play.hunger);
  });

  it('玩耍应降低清洁度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 80 } });
    engine.play();
    expect(engine.cleanliness).toBe(80 + ACTION_EFFECTS.play.cleanliness);
  });

  it('体力不足时不能玩耍', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 5 } });
    expect(engine.play()).toBe(false);
  });

  it('体力刚好 10 时可以玩耍', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 10 } });
    expect(engine.play()).toBe(true);
  });

  it('体力低于 10 时不能玩耍', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 9 } });
    expect(engine.play()).toBe(false);
  });

  it('生病时不能玩耍', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
      isSick: true,
    });
    expect(engine.play()).toBe(false);
  });

  it('睡觉时不能玩耍', () => {
    engine.sleep();
    expect(engine.play()).toBe(false);
  });

  it('快乐度不应超过最大值', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 95, energy: 80 } });
    engine.play();
    expect(engine.happiness).toBeLessThanOrEqual(STAT_MAX);
  });
});

// ========== 睡觉测试 ==========
describe('VirtualPetEngine - 睡觉', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('睡觉应进入睡眠状态', () => {
    engine.sleep();
    expect(engine.isSleeping).toBe(true);
  });

  it('睡觉应增加体力', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 80, energy: 50 } });
    engine.sleep();
    expect(engine.energy).toBe(50 + ACTION_EFFECTS.sleep.energy);
  });

  it('睡觉应略微降低饥饿度', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 80, energy: 50 } });
    engine.sleep();
    expect(engine.hunger).toBe(80 + ACTION_EFFECTS.sleep.hunger);
  });

  it('再次按睡觉应醒来', () => {
    engine.sleep();
    expect(engine.isSleeping).toBe(true);
    // 等待冷却
    engine.update(ACTION_COOLDOWNS.sleep + 100);
    engine.sleep();
    expect(engine.isSleeping).toBe(false);
  });

  it('睡觉时体力应恢复而非衰减', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 80, energy: 50 } });
    engine.sleep();
    const energyAfterSleep = engine.energy;
    engine.update(1000);
    // 体力应该增加（恢复速率 = 2 * 衰减速率）
    const expectedRecovery = DECAY_RATES.energy * 2;
    expect(engine.energy).toBeCloseTo(energyAfterSleep + expectedRecovery, 1);
  });

  it('睡觉时不能喂食', () => {
    engine.sleep();
    expect(engine.feed()).toBe(false);
  });

  it('睡觉时不能洗澡', () => {
    engine.sleep();
    expect(engine.bath()).toBe(false);
  });

  it('睡觉时不能玩耍', () => {
    engine.sleep();
    expect(engine.play()).toBe(false);
  });

  it('生病时可以睡觉', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
      isSick: true,
    });
    expect(engine.sleep()).toBe(true);
  });

  it('暂停时应停止睡觉', () => {
    engine.sleep();
    engine.pause();
    expect(engine.isSleeping).toBe(false);
  });
});

// ========== 心情系统测试 ==========
describe('VirtualPetEngine - 心情系统', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('平均属性 >= 70 时心情应为 HAPPY', () => {
    engine.loadState({
      stats: { hunger: 75, cleanliness: 75, happiness: 75, energy: 75 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.HAPPY);
  });

  it('平均属性 >= 40 且 < 70 时心情应为 NORMAL', () => {
    engine.loadState({
      stats: { hunger: 50, cleanliness: 50, happiness: 50, energy: 50 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.NORMAL);
  });

  it('平均属性 >= 20 且 < 40 时心情应为 SAD', () => {
    engine.loadState({
      stats: { hunger: 30, cleanliness: 30, happiness: 30, energy: 30 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.SAD);
  });

  it('平均属性 < 20 时心情应为 SICK', () => {
    engine.loadState({
      stats: { hunger: 15, cleanliness: 15, happiness: 15, energy: 15 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.SICK);
  });

  it('饥饿度极低时应判定为生病', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(true);
  });

  it('清洁度极低时应判定为生病', () => {
    engine.loadState({
      stats: { hunger: 80, cleanliness: 5, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(true);
  });

  it('生病时心情应为 SICK', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.SICK);
  });

  it('饥饿度刚好在阈值以上不应生病', () => {
    engine.loadState({
      stats: { hunger: SICK_THRESHOLDS.hunger, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(false);
  });

  it('清洁度刚好在阈值以上不应生病', () => {
    engine.loadState({
      stats: { hunger: 80, cleanliness: SICK_THRESHOLDS.cleanliness, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(false);
  });

  it('属性恢复后应从生病中恢复', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
      isSick: true,
    });
    engine.loadState({
      stats: { hunger: 50, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.updateMood();
    expect(engine.isSick).toBe(false);
  });

  it('getAverageStats 应正确计算平均值', () => {
    engine.loadState({
      stats: { hunger: 40, cleanliness: 60, happiness: 80, energy: 100 },
    });
    expect(engine.getAverageStats()).toBe(70);
  });

  it('边界值：平均属性刚好 70 应为 HAPPY', () => {
    engine.loadState({
      stats: { hunger: 70, cleanliness: 70, happiness: 70, energy: 70 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.HAPPY);
  });

  it('边界值：平均属性刚好 40 应为 NORMAL', () => {
    engine.loadState({
      stats: { hunger: 40, cleanliness: 40, happiness: 40, energy: 40 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.NORMAL);
  });

  it('边界值：平均属性刚好 20 应为 SAD', () => {
    engine.loadState({
      stats: { hunger: 20, cleanliness: 20, happiness: 20, energy: 20 },
    });
    engine.updateMood();
    expect(engine.mood).toBe(Mood.SAD);
  });
});

// ========== 成长阶段测试 ==========
describe('VirtualPetEngine - 成长阶段', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始阶段应为 EGG', () => {
    expect(engine.growthStage).toBe(GrowthStage.EGG);
  });

  it('在线时间达到 20 秒应成长为 BABY', () => {
    engine.update(20_000);
    expect(engine.growthStage).toBe(GrowthStage.BABY);
  });

  it('在线时间达到 60 秒应成长为 CHILD', () => {
    engine.update(60_000);
    expect(engine.growthStage).toBe(GrowthStage.CHILD);
  });

  it('在线时间达到 120 秒应成长为 ADULT', () => {
    engine.update(120_000);
    expect(engine.growthStage).toBe(GrowthStage.ADULT);
  });

  it('在线时间 19 秒仍为 EGG', () => {
    engine.update(19_999);
    expect(engine.growthStage).toBe(GrowthStage.EGG);
  });

  it('在线时间 59 秒仍为 BABY', () => {
    engine.update(59_999);
    expect(engine.growthStage).toBe(GrowthStage.BABY);
  });

  it('在线时间 119 秒仍为 CHILD', () => {
    engine.update(119_999);
    expect(engine.growthStage).toBe(GrowthStage.CHILD);
  });

  it('累计在线时间应正确记录', () => {
    engine.update(5000);
    expect(engine.totalOnlineTime).toBe(5000);
    engine.update(3000);
    expect(engine.totalOnlineTime).toBe(8000);
  });

  it('成长阶段应更新等级', () => {
    engine.update(20_000);
    expect(engine.level).toBe(2); // BABY = level 2
  });

  it('成年后等级应为 4', () => {
    engine.update(120_000);
    expect(engine.level).toBe(4);
  });
});

// ========== 生病判定测试 ==========
describe('VirtualPetEngine - 生病判定', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('饥饿度低于阈值应生病', () => {
    engine.loadState({
      stats: { hunger: SICK_THRESHOLDS.hunger - 1, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(true);
  });

  it('清洁度低于阈值应生病', () => {
    engine.loadState({
      stats: { hunger: 80, cleanliness: SICK_THRESHOLDS.cleanliness - 1, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(true);
  });

  it('饥饿度和清洁度都正常不应生病', () => {
    engine.loadState({
      stats: { hunger: 50, cleanliness: 50, happiness: 80, energy: 80 },
    });
    engine.checkSick();
    expect(engine.isSick).toBe(false);
  });

  it('生病时只能喂食和睡觉', () => {
    // 设置饥饿度极低，确保喂食后仍然生病
    engine.loadState({
      stats: { hunger: 1, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.updateMood();
    expect(engine.isSick).toBe(true);
    // 洗澡和玩耍应被拒绝
    expect(engine.bath()).toBe(false);
    expect(engine.play()).toBe(false);
    // 睡觉和喂食应被允许
    expect(engine.sleep()).toBe(true);
  });

  it('生病时衰减加速', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 50, happiness: 50, energy: 50 },
      isSick: true,
    });
    const initialCleanliness = engine.cleanliness;
    engine.update(1000);
    // 衰减应为 1.5 倍
    const expectedDecay = DECAY_RATES.cleanliness * 1.5;
    expect(engine.cleanliness).toBeCloseTo(initialCleanliness - expectedDecay, 1);
  });

  it('喂食恢复饥饿度后可从生病中恢复', () => {
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.updateMood();
    expect(engine.isSick).toBe(true);

    // 喂食恢复
    engine.feed();
    engine.updateMood();
    expect(engine.isSick).toBe(false);
  });
});

// ========== 键盘控制测试 ==========
describe('VirtualPetEngine - 键盘控制', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('按 1 应触发喂食', () => {
    engine.loadState({ stats: { hunger: 50, cleanliness: 80, happiness: 80, energy: 80 } });
    engine.handleKeyDown('1');
    expect(engine.hunger).toBe(50 + ACTION_EFFECTS.feed.hunger);
  });

  it('按 2 应触发洗澡', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 50, happiness: 80, energy: 80 } });
    engine.handleKeyDown('2');
    expect(engine.cleanliness).toBe(50 + ACTION_EFFECTS.bath.cleanliness);
  });

  it('按 3 应触发玩耍', () => {
    engine.loadState({ stats: { hunger: 80, cleanliness: 80, happiness: 50, energy: 80 } });
    engine.handleKeyDown('3');
    expect(engine.happiness).toBe(50 + ACTION_EFFECTS.play.happiness);
  });

  it('按 4 应触发睡觉', () => {
    engine.handleKeyDown('4');
    expect(engine.isSleeping).toBe(true);
  });

  it('按 ArrowLeft 应切换面板', () => {
    engine.loadState({ selectedPanel: 2 });
    engine.handleKeyDown('ArrowLeft');
    expect(engine.selectedPanel).toBe(1);
  });

  it('按 ArrowRight 应切换面板', () => {
    engine.loadState({ selectedPanel: 1 });
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPanel).toBe(2);
  });

  it('按 ArrowUp 应切换面板', () => {
    engine.loadState({ selectedPanel: 2 });
    engine.handleKeyDown('ArrowUp');
    expect(engine.selectedPanel).toBe(1);
  });

  it('按 ArrowDown 应切换面板', () => {
    engine.loadState({ selectedPanel: 1 });
    engine.handleKeyDown('ArrowDown');
    expect(engine.selectedPanel).toBe(2);
  });

  it('面板索引不应小于 0', () => {
    engine.loadState({ selectedPanel: 0 });
    engine.handleKeyDown('ArrowLeft');
    expect(engine.selectedPanel).toBe(0);
  });

  it('面板索引不应超过最大值', () => {
    engine.loadState({ selectedPanel: STAT_PANELS.length - 1 });
    engine.handleKeyDown('ArrowRight');
    expect(engine.selectedPanel).toBe(STAT_PANELS.length - 1);
  });

  it('非 playing 状态按键不应有效果', () => {
    engine.pause();
    const initial = engine.hunger;
    engine.handleKeyDown('1');
    expect(engine.hunger).toBe(initial);
  });

  it('handleKeyUp 不应抛出错误', () => {
    expect(() => engine.handleKeyUp('1')).not.toThrow();
  });
});

// ========== 冷却系统测试 ==========
describe('VirtualPetEngine - 冷却系统', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('操作后应有冷却时间', () => {
    engine.feed();
    expect(engine.getCooldown('feed')).toBeGreaterThan(0);
  });

  it('冷却时间应随时间减少', () => {
    engine.feed();
    const cd1 = engine.getCooldown('feed');
    engine.update(500);
    const cd2 = engine.getCooldown('feed');
    expect(cd2).toBeLessThan(cd1);
  });

  it('冷却结束后冷却时间应为 0', () => {
    engine.feed();
    engine.update(ACTION_COOLDOWNS.feed + 100);
    expect(engine.getCooldown('feed')).toBe(0);
  });

  it('不同操作有独立冷却', () => {
    engine.feed();
    expect(engine.getCooldown('feed')).toBeGreaterThan(0);
    expect(engine.getCooldown('bath')).toBe(0);
  });

  it('未执行操作时冷却应为 0', () => {
    expect(engine.getCooldown('feed')).toBe(0);
    expect(engine.getCooldown('bath')).toBe(0);
    expect(engine.getCooldown('play')).toBe(0);
    expect(engine.getCooldown('sleep')).toBe(0);
  });
});

// ========== 状态序列化测试 ==========
describe('VirtualPetEngine - 状态序列化', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('getState 应返回完整状态', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('stats');
    expect(state).toHaveProperty('mood');
    expect(state).toHaveProperty('growthStage');
    expect(state).toHaveProperty('totalOnlineTime');
    expect(state).toHaveProperty('isSick');
    expect(state).toHaveProperty('selectedPanel');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
  });

  it('getState 的 stats 应是副本', () => {
    const state = engine.getState();
    state.stats.hunger = 0;
    expect(engine.hunger).toBe(80);
  });

  it('loadState 应恢复属性', () => {
    engine.loadState({
      stats: { hunger: 30, cleanliness: 40, happiness: 50, energy: 60 },
    });
    expect(engine.hunger).toBe(30);
    expect(engine.cleanliness).toBe(40);
    expect(engine.happiness).toBe(50);
    expect(engine.energy).toBe(60);
  });

  it('loadState 应恢复心情', () => {
    engine.loadState({ mood: Mood.SAD });
    expect(engine.mood).toBe(Mood.SAD);
  });

  it('loadState 应恢复成长阶段', () => {
    engine.loadState({ growthStage: GrowthStage.ADULT });
    expect(engine.growthStage).toBe(GrowthStage.ADULT);
  });

  it('loadState 应恢复在线时间', () => {
    engine.loadState({ totalOnlineTime: 50000 });
    expect(engine.totalOnlineTime).toBe(50000);
  });

  it('loadState 应恢复生病状态', () => {
    engine.loadState({ isSick: true });
    expect(engine.isSick).toBe(true);
  });

  it('loadState 应恢复面板选择', () => {
    engine.loadState({ selectedPanel: 3 });
    expect(engine.selectedPanel).toBe(3);
  });

  it('loadState 属性值应被 clamp', () => {
    engine.loadState({
      stats: { hunger: 150, cleanliness: -10, happiness: 50, energy: 50 },
    });
    expect(engine.hunger).toBe(STAT_MAX);
    expect(engine.cleanliness).toBe(STAT_MIN);
  });
});

// ========== 重置和销毁测试 ==========
describe('VirtualPetEngine - 重置和销毁', () => {
  it('reset 应恢复初始状态', () => {
    const engine = createAndStartEngine();
    engine.feed();
    engine.update(5000);
    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.hunger).toBe(80);
    expect(engine.score).toBe(0);
    expect(engine.growthStage).toBe(GrowthStage.EGG);
    expect(engine.totalOnlineTime).toBe(0);
  });

  it('destroy 应清理资源', () => {
    const engine = createAndStartEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
  });

  it('重置后可以重新开始', () => {
    const engine = createAndStartEngine();
    engine.feed();
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.hunger).toBe(80);
  });
});

// ========== 暂停和恢复测试 ==========
describe('VirtualPetEngine - 暂停和恢复', () => {
  it('暂停后状态应为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('恢复后状态应为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('暂停时睡觉状态应被取消', () => {
    const engine = createAndStartEngine();
    engine.sleep();
    expect(engine.isSleeping).toBe(true);
    engine.pause();
    expect(engine.isSleeping).toBe(false);
  });

  it('idle 状态不能暂停', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('非 paused 状态不能恢复', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });
});

// ========== 操作动画测试 ==========
describe('VirtualPetEngine - 操作动画', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('执行操作后应有动画', () => {
    engine.feed();
    expect(engine.getActionAnimation()).not.toBeNull();
    expect(engine.getActionAnimation()!.type).toBe('feed');
  });

  it('动画持续时间后应清除', () => {
    engine.feed();
    // 等待动画结束（使用 setTimeout 替代，这里直接等待）
    const start = Date.now();
    while (Date.now() - start < 600) {
      // 等待
    }
    engine.update(600);
    expect(engine.getActionAnimation()).toBeNull();
  });

  it('不同操作应产生不同动画类型', () => {
    engine.feed();
    expect(engine.getActionAnimation()!.type).toBe('feed');

    engine.update(ACTION_COOLDOWNS.feed + 100);
    engine.bath();
    expect(engine.getActionAnimation()!.type).toBe('bath');
  });
});

// ========== 操作计数测试 ==========
describe('VirtualPetEngine - 操作计数', () => {
  it('每次操作应增加计数', () => {
    const engine = createAndStartEngine();
    expect(engine.getActionCount()).toBe(0);
    engine.feed();
    expect(engine.getActionCount()).toBe(1);
  });

  it('操作失败不应增加计数', () => {
    const engine = createAndStartEngine();
    engine.feed();
    engine.feed(); // 冷却中，应失败
    expect(engine.getActionCount()).toBe(1);
  });

  it('多次操作应累计计数', () => {
    const engine = createAndStartEngine();
    engine.feed();
    engine.bath();
    engine.play();
    expect(engine.getActionCount()).toBe(3);
  });
});

// ========== 边界情况测试 ==========
describe('VirtualPetEngine - 边界情况', () => {
  let engine: VirtualPetEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('所有属性为 0 时不应崩溃', () => {
    engine.loadState({
      stats: { hunger: 0, cleanliness: 0, happiness: 0, energy: 0 },
    });
    expect(() => engine.update(1000)).not.toThrow();
  });

  it('所有属性为 100 时不应崩溃', () => {
    engine.loadState({
      stats: { hunger: 100, cleanliness: 100, happiness: 100, energy: 100 },
    });
    expect(() => engine.update(1000)).not.toThrow();
  });

  it('极大的 deltaTime 不应导致属性越界', () => {
    engine.loadState({
      stats: { hunger: 50, cleanliness: 50, happiness: 50, energy: 50 },
    });
    engine.update(1_000_000);
    expect(engine.hunger).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.hunger).toBeLessThanOrEqual(STAT_MAX);
  });

  it('连续快速操作不应导致问题', () => {
    engine.feed();
    engine.bath();
    engine.play();
    engine.sleep();
    expect(() => engine.update(1000)).not.toThrow();
  });

  it('在 EGG 阶段执行操作应正常', () => {
    expect(engine.growthStage).toBe(GrowthStage.EGG);
    expect(engine.feed()).toBe(true);
  });

  it('loadState 空对象不应崩溃', () => {
    expect(() => engine.loadState({})).not.toThrow();
  });

  it('多次 start 不应导致问题', () => {
    engine.reset();
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('performAction 返回 false 时不应改变状态', () => {
    engine.loadState({ stats: { hunger: 50, cleanliness: 80, happiness: 80, energy: 80 } });
    const initialHunger = engine.hunger;
    engine.pause();
    const result = engine.performAction('feed');
    expect(result).toBe(false);
    expect(engine.hunger).toBe(initialHunger);
  });
});

// ========== 事件系统测试 ==========
describe('VirtualPetEngine - 事件系统', () => {
  it('应触发 stateChange 事件', () => {
    const engine = createAndStartEngine();
    const callback = vi.fn();
    engine.on('stateChange', callback);
    engine.feed();
    // update 会触发 stateChange
    expect(callback).toHaveBeenCalled();
  });

  it('应触发 scoreChange 事件', () => {
    const engine = createAndStartEngine();
    const callback = vi.fn();
    engine.on('scoreChange', callback);
    engine.feed();
    expect(callback).toHaveBeenCalledWith(expect.any(Number));
  });

  it('应触发 statusChange 事件', () => {
    const engine = createEngine();
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('off 应取消事件监听', () => {
    const engine = createAndStartEngine();
    const callback = vi.fn();
    engine.on('stateChange', callback);
    engine.off('stateChange', callback);
    engine.feed();
    // feed 内部 emit stateChange 但 update 也会 emit
    // 所以我们检查 feed 触发的那次
    // 实际上 feed 直接调用了 emit('stateChange')
    // 但 off 已经移除了 callback
    expect(callback).not.toHaveBeenCalled();
  });
});

// ========== 综合场景测试 ==========
describe('VirtualPetEngine - 综合场景', () => {
  it('完整的照顾周期', () => {
    const engine = createAndStartEngine();

    // 模拟 10 秒衰减
    engine.update(10000);

    // 属性应该有所下降
    expect(engine.hunger).toBeLessThan(80);
    expect(engine.cleanliness).toBeLessThan(80);

    // 喂食恢复
    engine.feed();
    expect(engine.hunger).toBeGreaterThan(70);

    // 等待冷却
    engine.update(ACTION_COOLDOWNS.feed + 100);

    // 洗澡
    engine.bath();
    expect(engine.cleanliness).toBeGreaterThan(90);

    // 等待冷却
    engine.update(ACTION_COOLDOWNS.bath + 100);

    // 玩耍
    engine.play();
    expect(engine.happiness).toBeGreaterThan(90);

    // 检查分数增长
    expect(engine.score).toBeGreaterThan(0);
  });

  it('从健康到生病再到恢复', () => {
    const engine = createAndStartEngine();

    // 让饥饿度降低到生病阈值以下
    engine.loadState({
      stats: { hunger: 5, cleanliness: 80, happiness: 80, energy: 80 },
    });
    engine.updateMood();
    expect(engine.isSick).toBe(true);
    expect(engine.mood).toBe(Mood.SICK);

    // 喂食恢复
    engine.feed();
    engine.updateMood();
    expect(engine.isSick).toBe(false);
  });

  it('成长全阶段', () => {
    const engine = createAndStartEngine();

    expect(engine.growthStage).toBe(GrowthStage.EGG);

    engine.update(20_000);
    expect(engine.growthStage).toBe(GrowthStage.BABY);

    engine.update(40_000); // total 60s
    expect(engine.growthStage).toBe(GrowthStage.CHILD);

    engine.update(60_000); // total 120s
    expect(engine.growthStage).toBe(GrowthStage.ADULT);
  });

  it('长时间运行属性不会越界', () => {
    const engine = createAndStartEngine();

    // 模拟 5 分钟
    for (let i = 0; i < 300; i++) {
      engine.update(1000);
    }

    expect(engine.hunger).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.cleanliness).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.happiness).toBeGreaterThanOrEqual(STAT_MIN);
    expect(engine.energy).toBeGreaterThanOrEqual(STAT_MIN);
  });

  it('睡觉恢复体力综合场景', () => {
    const engine = createAndStartEngine();

    // 降低体力
    engine.loadState({
      stats: { hunger: 80, cleanliness: 80, happiness: 80, energy: 20 },
    });

    // 睡觉
    engine.sleep();
    expect(engine.isSleeping).toBe(true);

    // 睡觉中体力恢复
    engine.update(5000);
    expect(engine.energy).toBeGreaterThan(20);

    // 醒来
    engine.update(ACTION_COOLDOWNS.sleep + 100);
    engine.sleep();
    expect(engine.isSleeping).toBe(false);
  });
});
