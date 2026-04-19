/**
 * 三国霸业 — 贸易路线系统 & 丰富事件系统 测试
 *
 * 覆盖：贸易路线创建、商队分配、利润计算、贸易建议、
 *       事件初始化（33种）、触发条件、选择效果、冷却、唯一事件、序列化
 */
import { describe, it, expect } from 'vitest';
import { TradeRouteSystem } from '../TradeRouteSystem';
import { EventEnrichmentSystem } from '../EventEnrichmentSystem';

// ═══════════════════════════════════════════════════════════════
// 贸易路线系统测试
// ═══════════════════════════════════════════════════════════════

describe('TradeRouteSystem', () => {
  it('应正确创建贸易路线', () => {
    const sys = new TradeRouteSystem();
    const route = sys.createRoute('luoyang', 'changan');
    expect(route).not.toBeNull();
    expect(route!.fromCityId).toBe('luoyang');
    expect(route!.toCityId).toBe('changan');
    expect(route!.isActive).toBe(true);
    expect(route!.profit).toBeGreaterThan(0);
    expect(route!.travelTime).toBeGreaterThan(0);
  });

  it('不允许相同城市创建路线', () => {
    const sys = new TradeRouteSystem();
    expect(sys.createRoute('luoyang', 'luoyang')).toBeNull();
  });

  it('不允许重复创建同方向路线', () => {
    const sys = new TradeRouteSystem();
    sys.createRoute('luoyang', 'changan');
    expect(sys.createRoute('luoyang', 'changan')).toBeNull();
  });

  it('应正确分配商队', () => {
    const sys = new TradeRouteSystem();
    const route = sys.createRoute('luoyang', 'chengdu')!;
    expect(route.caravanCount).toBe(0);
    expect(sys.assignCaravan(route.id)).toBe(true);
    expect(sys.assignCaravan(route.id)).toBe(true);
    const updated = sys.getAllRoutes().find((r) => r.id === route.id)!;
    expect(updated.caravanCount).toBe(2);
  });

  it('商队数量不应超过上限', () => {
    const sys = new TradeRouteSystem();
    const route = sys.createRoute('ye', 'jianye')!;
    for (let i = 0; i < route.maxCaravans; i++) {
      expect(sys.assignCaravan(route.id)).toBe(true);
    }
    expect(sys.assignCaravan(route.id)).toBe(false);
  });

  it('应正确计算贸易利润', () => {
    const sys = new TradeRouteSystem();
    const route = sys.createRoute('luoyang', 'chengdu')!;
    sys.assignCaravan(route.id);
    // 时间未到，不应有利润
    let result = sys.updateTrade(10, 10);
    expect(result.totalProfit).toBe(0);
    // 时间到达，应有利润
    result = sys.updateTrade(route.travelTime + 10, 10);
    expect(result.totalProfit).toBeGreaterThan(0);
    expect(result.completedTrades).toBe(1);
    expect(result.details).toHaveLength(1);
  });

  it('应正确提供贸易建议', () => {
    const sys = new TradeRouteSystem();
    const suggestions = sys.getTradeSuggestions(['luoyang']);
    expect(suggestions.length).toBeGreaterThan(0);
    // 已创建路线的城市不应再建议
    sys.createRoute('luoyang', 'changan');
    const filtered = sys.getTradeSuggestions(['luoyang']);
    expect(filtered.every((s) => !(s.from === 'luoyang' && s.to === 'changan'))).toBe(true);
  });

  it('应正确获取城市间路线', () => {
    const sys = new TradeRouteSystem();
    sys.createRoute('luoyang', 'changan');
    sys.createRoute('changan', 'luoyang');
    const routes = sys.getRoutesBetween('luoyang', 'changan');
    expect(routes).toHaveLength(2);
  });

  it('应正确序列化和反序列化', () => {
    const sys = new TradeRouteSystem();
    sys.createRoute('luoyang', 'changan');
    const data = sys.serialize();
    const sys2 = new TradeRouteSystem();
    sys2.deserialize(data);
    expect(sys2.getAllRoutes()).toHaveLength(1);
    expect(sys2.getAllRoutes()[0].fromCityId).toBe('luoyang');
  });
});

// ═══════════════════════════════════════════════════════════════
// 丰富事件系统测试
// ═══════════════════════════════════════════════════════════════

describe('EventEnrichmentSystem', () => {
  it('应初始化 33 种事件', () => {
    const sys = new EventEnrichmentSystem();
    expect(sys.getEventCount()).toBe(33);
  });

  it('各分类事件数量正确', () => {
    const sys = new EventEnrichmentSystem();
    expect(sys.getEventsByCategory('historical')).toHaveLength(5);
    expect(sys.getEventsByCategory('seasonal')).toHaveLength(4);
    expect(sys.getEventsByCategory('random')).toHaveLength(5);
    expect(sys.getEventsByCategory('trade')).toHaveLength(3);
    expect(sys.getEventsByCategory('military')).toHaveLength(3);
    expect(sys.getEventsByCategory('diplomatic')).toHaveLength(3);
    expect(sys.getEventsByCategory('disaster')).toHaveLength(3);
    expect(sys.getEventsByCategory('blessing')).toHaveLength(2);
    expect(sys.getEventsByCategory('npc')).toHaveLength(2);
    expect(sys.getEventsByCategory('festival')).toHaveLength(3);
  });

  it('应正确检查触发条件并触发事件', () => {
    const sys = new EventEnrichmentSystem();
    // 黄巾之乱：territoryCount >= 1
    const triggered = sys.checkTriggers({
      currentMinute: 100,
      season: 'spring',
      ownedTerritories: ['luoyang'],
      resources: { grain: 1000, gold: 2000 },
      heroCount: 3,
      armySize: 500,
    });
    expect(triggered.length).toBeGreaterThan(0);
    expect(triggered.some((e) => e.name === '黄巾之乱')).toBe(true);
  });

  it('应正确做出选择并返回效果', () => {
    const sys = new EventEnrichmentSystem();
    sys.checkTriggers({
      currentMinute: 100,
      season: 'spring',
      ownedTerritories: ['luoyang'],
      resources: { grain: 1000, gold: 2000 },
      heroCount: 3,
      armySize: 500,
    });
    const active = sys.getActiveEvents();
    if (active.length > 0) {
      const effects = sys.makeChoice(active[0].id, 0);
      expect(Object.keys(effects).length).toBeGreaterThan(0);
    }
  });

  it('冷却期内不应重复触发', () => {
    const sys = new EventEnrichmentSystem();
    // 先触发春耕
    const ctx = {
      currentMinute: 100,
      season: 'spring',
      ownedTerritories: ['luoyang'],
      resources: { grain: 10000, gold: 10000 },
      heroCount: 5,
      armySize: 1000,
    };
    sys.checkTriggers(ctx);
    // 同一时间再次触发，冷却中的事件不应再出现
    const activeBefore = sys.getActiveEvents().length;
    sys.checkTriggers({ ...ctx, currentMinute: 200 });
    // 冷却未过，不应重复触发同一事件
    const history = sys.getEventHistory();
    const springEvents = history.filter((h) => h.event === 'evt_s_01');
    expect(springEvents.length).toBeLessThanOrEqual(1);
  });

  it('唯一事件只应触发一次', () => {
    const sys = new EventEnrichmentSystem();
    const ctx = {
      currentMinute: 100,
      season: 'spring',
      ownedTerritories: ['luoyang', 'changan'],
      resources: { grain: 10000, gold: 10000 },
      heroCount: 5,
      armySize: 2000,
    };
    // 第一次触发
    sys.checkTriggers(ctx);
    // 冷却过后再触发
    sys.checkTriggers({ ...ctx, currentMinute: 99999 });
    const history = sys.getEventHistory();
    const uniqueEvents = history.filter((h) => h.event.startsWith('evt_h_'));
    // 每个唯一事件最多出现一次
    const counts = new Map<string, number>();
    for (const h of uniqueEvents) {
      counts.set(h.event, (counts.get(h.event) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it('应正确记录事件历史', () => {
    const sys = new EventEnrichmentSystem();
    sys.checkTriggers({
      currentMinute: 100,
      season: 'spring',
      ownedTerritories: ['luoyang'],
      resources: { grain: 5000, gold: 5000 },
      heroCount: 2,
      armySize: 600,
    });
    const history = sys.getEventHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].time).toBe(100);
  });

  it('应正确序列化和反序列化', () => {
    const sys = new EventEnrichmentSystem();
    sys.checkTriggers({
      currentMinute: 100,
      season: 'spring',
      ownedTerritories: ['luoyang'],
      resources: { grain: 5000, gold: 5000 },
      heroCount: 2,
      armySize: 600,
    });
    const data = sys.serialize();
    const sys2 = new EventEnrichmentSystem();
    sys2.deserialize(data);
    expect(sys2.getEventCount()).toBe(33);
    expect(sys2.getEventHistory().length).toBeGreaterThan(0);
  });
});
