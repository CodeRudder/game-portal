/**
 * SeasonSystem 单元测试
 *
 * 覆盖所有公开方法：constructor, update, getCurrent, getMultiplier,
 * getProgress, getNext, getRemainingTime, getEffects, serialize,
 * deserialize, getYear, reset, onEvent。
 */
import {
  SeasonSystem,
  type Season,
  type SeasonEffect,
  type SeasonEvent,
} from '../modules/SeasonSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建两个季节用于基础测试 */
function createSeasons(): Season[] {
  return [
    {
      id: 'spring',
      name: '春天',
      icon: '🌸',
      multipliers: { wood: 1.2, herb: 1.5 },
      duration: 10_000,
      effects: [
        { type: 'abundance', targetResource: 'herb', value: 0.5, description: '春日草药丰饶' },
      ],
      colorTheme: { primary: '#4caf50', secondary: '#81c784', background: '#e8f5e9' },
    },
    {
      id: 'summer',
      name: '夏天',
      icon: '☀️',
      multipliers: { wood: 1.0, food: 1.3 },
      duration: 15_000,
      effects: [
        { type: 'drought', targetResource: 'water', value: -0.3, description: '夏日干旱' },
        { type: 'storm', targetResource: 'crop', value: -0.2, description: '暴风侵袭' },
      ],
      colorTheme: { primary: '#ff9800', secondary: '#ffb74d', background: '#fff3e0' },
    },
  ];
}

/** 创建四季配置用于年度测试 */
function createFourSeasons(): Season[] {
  return [
    { id: 'spring', name: '春', icon: '🌸', multipliers: {}, duration: 5_000, effects: [], colorTheme: { primary: '#4caf50', secondary: '#81c784', background: '#e8f5e9' } },
    { id: 'summer', name: '夏', icon: '☀️', multipliers: {}, duration: 5_000, effects: [], colorTheme: { primary: '#ff9800', secondary: '#ffb74d', background: '#fff3e0' } },
    { id: 'autumn', name: '秋', icon: '🍂', multipliers: {}, duration: 5_000, effects: [], colorTheme: { primary: '#ff5722', secondary: '#ff8a65', background: '#fbe9e7' } },
    { id: 'winter', name: '冬', icon: '❄️', multipliers: {}, duration: 5_000, effects: [], colorTheme: { primary: '#2196f3', secondary: '#64b5f6', background: '#e3f2fd' } },
  ];
}

// ============================================================
// 测试
// ============================================================

describe('SeasonSystem', () => {
  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------
  it('应正确初始化为第一个季节', () => {
    const sys = new SeasonSystem(createSeasons());
    expect(sys.getCurrent().id).toBe('spring');
    expect(sys.getProgress()).toBe(0);
    expect(sys.getRemainingTime()).toBe(10_000);
  });

  it('空数组应抛出异常', () => {
    expect(() => new SeasonSystem([])).toThrow('at least one season');
    expect(() => new SeasonSystem(null as any)).toThrow('at least one season');
  });

  // ----------------------------------------------------------
  // update — 季节切换
  // ----------------------------------------------------------
  it('dt <= 0 时不应推进', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(0);
    expect(sys.getCurrent().id).toBe('spring');
    sys.update(-100);
    expect(sys.getCurrent().id).toBe('spring');
  });

  it('应在 duration 到达后自动切换季节', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(10_000);
    expect(sys.getCurrent().id).toBe('summer');
    expect(sys.getProgress()).toBe(0);
  });

  it('应支持一次性跳过多个季节', () => {
    const sys = new SeasonSystem(createFourSeasons());
    // 4 季 × 5000 = 20000，跳过一整轮 + 3000 进入第二个春季后的秋天
    sys.update(23_000);
    // spring(5000) + summer(5000) + autumn(5000) + winter(5000) = 20000 → year 2
    // 剩余 3000 进入 spring(5000) → 还在 spring
    expect(sys.getCurrent().id).toBe('spring');
    expect(sys.getYear()).toBe(2);
    expect(sys.getProgress()).toBeCloseTo(3000 / 5000);
  });

  // ----------------------------------------------------------
  // update — 年度推进
  // ----------------------------------------------------------
  it('完成一整轮后年度 +1', () => {
    const sys = new SeasonSystem(createFourSeasons());
    const events: SeasonEvent[] = [];
    sys.onEvent((e) => events.push(e));

    sys.update(20_000); // 一整轮

    expect(sys.getYear()).toBe(2);
    expect(sys.getCurrent().id).toBe('spring');

    const yearEvents = events.filter((e) => e.type === 'year_completed');
    expect(yearEvents).toHaveLength(1);
    expect((yearEvents[0].data as Record<string, unknown>)?.year).toBe(1);
  });

  // ----------------------------------------------------------
  // getMultiplier
  // ----------------------------------------------------------
  it('应返回正确的产出倍率', () => {
    const sys = new SeasonSystem(createSeasons());
    expect(sys.getMultiplier('wood')).toBe(1.2);
    expect(sys.getMultiplier('herb')).toBe(1.5);
    expect(sys.getMultiplier('unknown')).toBe(1.0);
  });

  it('切换季节后倍率应更新', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(10_000);
    expect(sys.getMultiplier('wood')).toBe(1.0);
    expect(sys.getMultiplier('food')).toBe(1.3);
  });

  // ----------------------------------------------------------
  // getProgress
  // ----------------------------------------------------------
  it('应正确计算进度', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(5_000);
    expect(sys.getProgress()).toBeCloseTo(0.5);
    sys.update(4_999);
    expect(sys.getProgress()).toBeCloseTo(0.9999);
  });

  // ----------------------------------------------------------
  // getNext
  // ----------------------------------------------------------
  it('应返回下一个季节', () => {
    const sys = new SeasonSystem(createSeasons());
    expect(sys.getNext()!.id).toBe('summer');
  });

  it('最后一个季节的下一个应回到第一个', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(10_000); // → summer
    expect(sys.getNext()!.id).toBe('spring');
  });

  // ----------------------------------------------------------
  // getRemainingTime
  // ----------------------------------------------------------
  it('应正确计算剩余时间', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(3_000);
    expect(sys.getRemainingTime()).toBe(7_000);
  });

  it('不应返回负数', () => {
    const sys = new SeasonSystem(createSeasons());
    sys.update(15_000);
    // 切换到 summer (duration=15000)，elapsed=5000
    expect(sys.getRemainingTime()).toBe(10_000);
  });

  // ----------------------------------------------------------
  // getEffects
  // ----------------------------------------------------------
  it('应返回当前季节的效果列表', () => {
    const sys = new SeasonSystem(createSeasons());
    const effects = sys.getEffects();
    expect(effects).toHaveLength(1);
    expect(effects[0].type).toBe('abundance');
    expect(effects[0].targetResource).toBe('herb');
  });

  it('应返回浅拷贝', () => {
    const sys = new SeasonSystem(createSeasons());
    const effects = sys.getEffects();
    effects.push({ type: 'calm', targetResource: 'x', value: 1, description: '' });
    expect(sys.getEffects()).toHaveLength(1);
  });

  // ----------------------------------------------------------
  // 事件系统
  // ----------------------------------------------------------
  it('应触发 season_changed 事件', () => {
    const sys = new SeasonSystem(createSeasons());
    const events: SeasonEvent[] = [];
    sys.onEvent((e) => events.push(e));

    sys.update(10_000);
    const changeEvents = events.filter((e) => e.type === 'season_changed');
    expect(changeEvents).toHaveLength(1);
    const data = changeEvents[0].data as Record<string, unknown>;
    expect(data.fromSeason).toBe('spring');
    expect(data.toSeason).toBe('summer');
  });

  it('应触发 season_effect 事件', () => {
    const sys = new SeasonSystem(createSeasons());
    const events: SeasonEvent[] = [];
    sys.onEvent((e) => events.push(e));

    sys.update(10_000); // → summer (2 effects)
    const effectEvents = events.filter((e) => e.type === 'season_effect');
    expect(effectEvents).toHaveLength(2);
  });

  it('onEvent 返回的函数应取消监听', () => {
    const sys = new SeasonSystem(createSeasons());
    const events: SeasonEvent[] = [];
    const unsub = sys.onEvent((e) => events.push(e));

    unsub();
    sys.update(10_000);
    expect(events).toHaveLength(0);
  });

  it('监听器异常不应影响系统', () => {
    const sys = new SeasonSystem(createSeasons());
    const events: SeasonEvent[] = [];
    sys.onEvent(() => { throw new Error('boom'); });
    sys.onEvent((e) => events.push(e));

    expect(() => sys.update(10_000)).not.toThrow();
    expect(events.length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------
  // serialize / deserialize
  // ----------------------------------------------------------
  it('应正确序列化和反序列化', () => {
    const sys = new SeasonSystem(createFourSeasons());
    sys.update(12_000); // spring(5k) + summer(5k) → autumn, elapsed=2k, year=1

    const state = sys.serialize();
    expect(state.currentIndex).toBe(2);
    expect(state.elapsed).toBe(2_000);
    expect(state.year).toBe(1);

    const sys2 = new SeasonSystem(createFourSeasons());
    sys2.deserialize(state);
    expect(sys2.getCurrent().id).toBe('autumn');
    expect(sys2.getProgress()).toBeCloseTo(2000 / 5000);
    expect(sys2.getYear()).toBe(1);
  });

  it('历史记录应正确保存和恢复', () => {
    const sys = new SeasonSystem(createFourSeasons());
    sys.update(12_000); // 记录 spring + summer 结束

    const state = sys.serialize();
    const history = state.history as any[];
    expect(history).toHaveLength(2);
    expect(history[0].seasonId).toBe('spring');
    expect(history[1].seasonId).toBe('summer');

    const sys2 = new SeasonSystem(createFourSeasons());
    sys2.deserialize(state);
    const state2 = sys2.serialize();
    expect((state2.history as any[])).toHaveLength(2);
  });

  it('deserialize 无效数据不应崩溃', () => {
    const sys = new SeasonSystem(createSeasons());
    expect(() => sys.deserialize({})).not.toThrow();
    expect(() => sys.deserialize({ currentIndex: -1, elapsed: -1, year: 0 })).not.toThrow();
    expect(() => sys.deserialize({ history: 'bad' })).not.toThrow();
    expect(() => sys.deserialize({ history: [{ bad: true }] })).not.toThrow();
  });

  // ----------------------------------------------------------
  // reset
  // ----------------------------------------------------------
  it('应重置到初始状态', () => {
    const sys = new SeasonSystem(createFourSeasons());
    sys.update(12_000);

    sys.reset();
    expect(sys.getCurrent().id).toBe('spring');
    expect(sys.getProgress()).toBe(0);
    expect(sys.getYear()).toBe(1);
    expect(sys.getRemainingTime()).toBe(5_000);

    const state = sys.serialize();
    expect((state.history as any[])).toHaveLength(0);
  });

  it('reset 不应清除事件监听器', () => {
    const sys = new SeasonSystem(createSeasons());
    const events: SeasonEvent[] = [];
    sys.onEvent((e) => events.push(e));

    sys.reset();
    sys.update(10_000);
    expect(events.length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------
  // 边界情况
  // ----------------------------------------------------------
  it('单季节配置应正常循环', () => {
    const single: Season[] = [{
      id: 'eternal', name: '永恒', icon: '♾️',
      multipliers: { gold: 2.0 }, duration: 1_000, effects: [],
      colorTheme: { primary: '#000', secondary: '#333', background: '#111' },
    }];
    const sys = new SeasonSystem(single);
    const events: SeasonEvent[] = [];
    sys.onEvent((e) => events.push(e));

    sys.update(3_500);
    // 1000 → year 2, 1000 → year 3, 1000 → year 4, 剩余 500
    expect(sys.getYear()).toBe(4);
    expect(sys.getCurrent().id).toBe('eternal');
    expect(sys.getMultiplier('gold')).toBe(2.0);
    expect(events.filter((e) => e.type === 'year_completed')).toHaveLength(3);
  });

  it('duration 为 0 的季节应立即跳过', () => {
    const seasons: Season[] = [
      { id: 'instant', name: '瞬', icon: '⚡', multipliers: {}, duration: 0, effects: [], colorTheme: { primary: '#000', secondary: '#333', background: '#111' } },
      { id: 'normal', name: '常', icon: '🌿', multipliers: {}, duration: 10_000, effects: [], colorTheme: { primary: '#000', secondary: '#333', background: '#111' } },
    ];
    const sys = new SeasonSystem(seasons);
    sys.update(1);
    expect(sys.getCurrent().id).toBe('normal');
  });
});
