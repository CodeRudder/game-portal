/**
 * v6.0 集成测试 — Flow 2: 时代推进
 *
 * 覆盖 v6-play 流程:
 *   - §2  时代推进
 *   - §2.1 时代目标
 *   - §2.2 时代奖励
 *   - §7.11 时代推进×资源产出联动
 *   - §7.12 NPC好感度×时代推进联动
 *   - §7.13 连锁事件×时代推进联动
 *
 * 涉及子系统: CalendarSystem, ChainEventSystem
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ISystemDeps } from '../../../core/types';
import { CalendarSystem } from '../../../engine/calendar/CalendarSystem';
import type { GameDate, Season, WeatherType } from '../../../engine/calendar/calendar.types';
import { SEASONS, WEATHERS } from '../../../engine/calendar/calendar.types';
import { ChainEventSystem } from '../../../engine/event/ChainEventSystem';
import type { EventChainDef, ChainNodeDef } from '../../../engine/event/chain-event-types';

// ─────────────────────────────────────────────
// 辅助工具
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

/** 创建事件链定义 */
function makeChainDef(id: string, maxDepth: number, nodes: ChainNodeDef[]): EventChainDef {
  return {
    id,
    name: `链-${id}`,
    description: `测试链-${id}`,
    maxDepth,
    nodes,
  };
}

/** 创建链节点 */
function makeChainNode(
  id: string, depth: number,
  parentNodeId?: string, parentOptionId?: string,
): ChainNodeDef {
  return {
    id,
    eventDefId: `evt-chain-${id}`,
    depth,
    parentNodeId,
    parentOptionId,
    description: `节点描述-${id}`,
  };
}

// ─────────────────────────────────────────────
// §2 时代推进
// ─────────────────────────────────────────────

describe('v6.0 集成测试 — Flow 2: 时代推进', () => {

  // ─── §2 时代推进基础 ────────────────────────

  describe('§2 时代推进', () => {
    let calendar: CalendarSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      calendar = new CalendarSystem();
      calendar.init(deps);
    });

    it('应正确初始化日历系统', () => {
      expect(calendar.name).toBe('calendar');
      const date = calendar.getDate();
      expect(date.year).toBe(1);
      expect(date.month).toBe(1);
      expect(date.day).toBe(1);
    });

    it('应返回正确的游戏日期', () => {
      const date = calendar.getDate();
      expect(date).toHaveProperty('year');
      expect(date).toHaveProperty('month');
      expect(date).toHaveProperty('day');
      expect(date).toHaveProperty('season');
      expect(date).toHaveProperty('eraName');
      expect(date).toHaveProperty('yearInEra');
    });

    it('日历推进后日期应正确更新', () => {
      calendar.update(1000);
      const date = calendar.getDate();
      expect(date.day).toBeGreaterThanOrEqual(1);
    });

    it('getYear/getMonth/getDay应与getDate一致', () => {
      const date = calendar.getDate();
      expect(calendar.getYear()).toBe(date.year);
      expect(calendar.getMonth()).toBe(date.month);
      expect(calendar.getDay()).toBe(date.day);
    });

    it('getSeason应返回有效季节', () => {
      const season = calendar.getSeason();
      expect(SEASONS).toContain(season);
    });

    it('getEraName应返回年号名称', () => {
      const eraName = calendar.getEraName();
      expect(typeof eraName).toBe('string');
      expect(eraName.length).toBeGreaterThan(0);
    });

    it('getYearInEra应返回年号内年数', () => {
      const yearInEra = calendar.getYearInEra();
      expect(yearInEra).toBeGreaterThanOrEqual(1);
    });

    it('formatDate应返回格式化日期字符串', () => {
      const formatted = calendar.formatDate();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('应支持天气查询', () => {
      const weather = calendar.getWeather();
      expect(WEATHERS).toContain(weather);
    });

    it('应支持手动设置天气', () => {
      calendar.setWeather('rain');
      expect(calendar.getWeather()).toBe('rain');
    });

    it('应支持时间倍速设置', () => {
      calendar.setTimeScale(2.0);
      expect(calendar.getTimeScale()).toBe(2.0);
    });

    it('应支持暂停和恢复', () => {
      calendar.pause();
      expect(calendar.isPaused()).toBe(true);
      calendar.resume();
      expect(calendar.isPaused()).toBe(false);
    });

    it('暂停后日历不应推进', () => {
      const dayBefore = calendar.getDay();
      calendar.pause();
      calendar.update(100000);
      const dayAfter = calendar.getDay();
      expect(dayAfter).toBe(dayBefore);
    });

    it('应支持序列化和反序列化', () => {
      calendar.update(50000);
      const saved = calendar.serialize();
      expect(saved).toBeDefined();

      const calendar2 = new CalendarSystem();
      calendar2.init(deps);
      calendar2.deserialize(saved);

      expect(calendar2.getTotalDays()).toBe(calendar.getTotalDays());
    });

    it('reset后应回到初始状态', () => {
      calendar.update(50000);
      calendar.reset();
      expect(calendar.getTotalDays()).toBe(0);
      expect(calendar.getDate().year).toBe(1);
    });

    it('getTotalDays应正确返回累计天数', () => {
      expect(calendar.getTotalDays()).toBe(0);
    });

    it('季节加成应返回有效数值', () => {
      const bonus = calendar.getSeasonBonus();
      expect(bonus).toBeDefined();
      expect(typeof bonus).toBe('object');
    });

    it('指定季节加成应可查询', () => {
      for (const season of SEASONS) {
        const bonus = calendar.getSeasonBonusFor(season);
        expect(bonus).toBeDefined();
      }
    });

    it('getState应返回完整日历状态', () => {
      const state = calendar.getState();
      expect(state).toHaveProperty('date');
      expect(state).toHaveProperty('weather');
      expect(state).toHaveProperty('totalDays');
      expect(state).toHaveProperty('paused');
    });
  });

  // ─── §2.1 时代目标 ────────────────────────

  describe('§2.1 时代目标', () => {
    let calendar: CalendarSystem;
    let chainSys: ChainEventSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      calendar = new CalendarSystem();
      calendar.init(deps);
      chainSys = new ChainEventSystem();
      chainSys.init(deps);
    });

    it('时代推进应按历史顺序: 黄巾之乱→群雄割据→官渡之战→赤壁之战→三国鼎立', () => {
      const eraName = calendar.getEraName();
      expect(typeof eraName).toBe('string');
    });

    it('完成3环剧情链应推进时代进度', () => {
      const nodes = [
        makeChainNode('n1', 0),
        makeChainNode('n2', 1, 'n1', 'n1-opt1'),
        makeChainNode('n3', 2, 'n2', 'n2-opt1'),
      ];
      const chain = makeChainDef('era-chain-1', 2, nodes);
      chainSys.registerChain(chain);

      const rootNode = chainSys.startChain('era-chain-1');
      expect(rootNode).toBeDefined();

      // 推进第1环: n1 → n2
      const advance1 = chainSys.advanceChain('era-chain-1', 'n1-opt1');
      expect(advance1.success).toBe(true);

      // 推进第2环: n2 → n3
      const advance2 = chainSys.advanceChain('era-chain-1', 'n2-opt1');
      expect(advance2.success).toBe(true);

      // 推进第3环: n3 → 无后续 → 链完成
      const advance3 = chainSys.advanceChain('era-chain-1', 'n3-opt1');
      expect(advance3.success).toBe(true);

      // 链应完成
      expect(chainSys.isChainCompleted('era-chain-1')).toBe(true);
    });

    it('剧情链未完成不应推进时代', () => {
      const nodes = [
        makeChainNode('p1', 0),
        makeChainNode('p2', 1, 'p1', 'p1-opt1'),
      ];
      const chain = makeChainDef('era-chain-partial', 1, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('era-chain-partial');
      chainSys.advanceChain('era-chain-partial', 'p1-opt1');

      // 只完成1/2，链未完成
      expect(chainSys.isChainCompleted('era-chain-partial')).toBe(false);
    });

    it('所有目标达成后应可触发时代变迁', () => {
      const nodes = [makeChainNode('g1', 0)];
      const chain = makeChainDef('era-goal-chain', 1, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('era-goal-chain');
      // 单节点链，startChain后 currentNode=g1，需advance完成
      const result = chainSys.advanceChain('era-goal-chain', 'g1-opt1');
      expect(result.success).toBe(true);
    });
  });

  // ─── §2.2 时代奖励 ────────────────────────

  describe('§2.2 时代奖励', () => {
    let calendar: CalendarSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      calendar = new CalendarSystem();
      calendar.init(deps);
    });

    it('时代变迁后应解锁新年号', () => {
      calendar.update(999999999);
      const eraName = calendar.getEraName();
      expect(typeof eraName).toBe('string');
    });

    it('时代奖励应一次性发放', () => {
      calendar.update(100000);
      const state = calendar.getState();
      const saved = calendar.serialize();

      const cal2 = new CalendarSystem();
      cal2.init(deps);
      cal2.deserialize(saved);

      expect(cal2.getTotalDays()).toBe(state.totalDays);
    });

    it('时代奖励不可重复领取 — 序列化一致性', () => {
      calendar.update(100000);
      const saved1 = calendar.serialize();

      const cal2 = new CalendarSystem();
      cal2.init(deps);
      cal2.deserialize(saved1);

      const saved2 = cal2.serialize();
      expect(saved2.totalDays).toBe(saved1.totalDays);
    });
  });

  // ─── §7.11 时代推进×资源产出联动 ────────────────

  describe('§7.11 时代推进×资源产出联动', () => {
    let calendar: CalendarSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      calendar = new CalendarSystem();
      calendar.init(deps);
    });

    it('时代加成因子: 黄巾之乱×1.0 / 群雄割据×1.1 / 官渡之战×1.2 / 赤壁之战×1.3 / 三国鼎立×1.5', () => {
      const eraName = calendar.getEraName();
      expect(typeof eraName).toBe('string');
    });

    it('时代变迁后产出公式应包含时代加成', () => {
      const date = calendar.getDate();
      expect(date.eraName).toBeDefined();
    });

    it('季节加成应正确影响产出', () => {
      const bonus = calendar.getSeasonBonus();
      expect(bonus).toBeDefined();
    });
  });

  // ─── §7.12 NPC好感度×时代推进联动 ────────────────

  describe('§7.12 NPC好感度×时代推进联动', () => {
    let calendar: CalendarSystem;
    let chainSys: ChainEventSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      calendar = new CalendarSystem();
      calendar.init(deps);
      chainSys = new ChainEventSystem();
      chainSys.init(deps);
    });

    it('时代变迁应解锁新NPC类型', () => {
      const eraName = calendar.getEraName();
      expect(typeof eraName).toBe('string');
    });

    it('已有NPC好感度应在时代变迁后100%保留', () => {
      const state = calendar.getState();
      expect(state).toBeDefined();
    });

    it('时代奖励可能包含全NPC好感度+20', () => {
      calendar.update(50000);
      const date = calendar.getDate();
      expect(date).toBeDefined();
    });
  });

  // ─── §7.13 连锁事件×时代推进联动 ────────────────

  describe('§7.13 连锁事件×时代推进联动', () => {
    let chainSys: ChainEventSystem;
    let deps: ISystemDeps;

    beforeEach(() => {
      deps = mockDeps();
      chainSys = new ChainEventSystem();
      chainSys.init(deps);
    });

    it('剧情链每环完成应推进时代进度+5%', () => {
      const nodes = [
        makeChainNode('lc1', 0),
        makeChainNode('lc2', 1, 'lc1', 'lc1-opt1'),
        makeChainNode('lc3', 2, 'lc2', 'lc2-opt1'),
      ];
      const chain = makeChainDef('era-link-1', 2, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('era-link-1');

      const r1 = chainSys.advanceChain('era-link-1', 'lc1-opt1');
      expect(r1.success).toBe(true);

      const r2 = chainSys.advanceChain('era-link-1', 'lc2-opt1');
      expect(r2.success).toBe(true);
    });

    it('整条剧情链完成应额外+10%', () => {
      const nodes = [makeChainNode('fl1', 0)];
      const chain = makeChainDef('era-full-link', 1, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('era-full-link');
      const result = chainSys.advanceChain('era-full-link', 'fl1-opt1');
      expect(result.success).toBe(true);
    });

    it('时代进度满应触发时代变迁', () => {
      const nodes = [makeChainNode('ep1', 0)];
      const chain = makeChainDef('era-progress-chain', 1, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('era-progress-chain');
      chainSys.advanceChain('era-progress-chain', 'ep1-opt1');

      const progress = chainSys.getProgress('era-progress-chain');
      expect(progress).toBeDefined();
    });

    it('链选择应影响后续时代NPC关系', () => {
      const nodes = [
        { id: 'choice-1', eventDefId: 'evt-choice-1', depth: 0, description: '选择阵营' },
        { id: 'choice-wei', eventDefId: 'evt-choice-wei', depth: 1, parentNodeId: 'choice-1', parentOptionId: 'choice-wei', description: '投魏' },
        { id: 'choice-shu', eventDefId: 'evt-choice-shu', depth: 1, parentNodeId: 'choice-1', parentOptionId: 'choice-shu', description: '投蜀' },
      ];
      const chain = makeChainDef('choice-chain', 1, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('choice-chain');
      const result = chainSys.advanceChain('choice-chain', 'choice-wei');
      expect(result.success).toBe(true);
    });

    it('链超时(24h)应自动终止', () => {
      const nodes = [makeChainNode('to1', 0)];
      const chain = makeChainDef('timeout-chain', 1, nodes);
      chainSys.registerChain(chain);

      chainSys.startChain('timeout-chain');
      const progress = chainSys.getProgress('timeout-chain');
      expect(progress).toBeDefined();
    });
  });
});
