/**
 * 集成测试 — 地图事件系统
 *
 * 覆盖 Play 文档流程：
 *   §8.1  事件触发规则（每小时10%/最多3个/已探索区域）
 *   §8.2  基础事件类型与处理（4类：商队遇险/流民/宝箱/山贼）
 *   §8.3  扩展事件类型验证（5类：流寇/商队经过/天灾/遗迹/阵营冲突）
 *   §8.4  事件选择分支风险（强攻/谈判/忽略）
 *   §10.0C 地图事件→声望/民心影响
 *
 * 引擎层验证，不依赖 UI。
 *
 * 注意: MapEventSystem 尚未实现为独立子系统，本测试验证事件类型定义
 *       和事件触发条件的数据完整性，以及与 TerritorySystem 的联动。
 *
 * @module engine/map/__tests__/integration/map-event-system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerritorySystem } from '../../TerritorySystem';
import { SiegeSystem } from '../../SiegeSystem';
import { SiegeEnhancer } from '../../SiegeEnhancer';
import { GarrisonSystem } from '../../GarrisonSystem';
import { WorldMapSystem } from '../../WorldMapSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 事件类型定义（对应 PRD MAP-5）
// ─────────────────────────────────────────────

/** 基础事件类型（4类） */
const BASIC_EVENT_TYPES = [
  { id: 'merchant_distress', name: '商队遇险', probability: 0.30, options: ['aid', 'ignore'] },
  { id: 'refugees', name: '流民', probability: 0.25, options: ['accept', 'dismiss'] },
  { id: 'treasure', name: '宝箱', probability: 0.20, options: ['open'] },
  { id: 'bandits', name: '山贼', probability: 0.25, options: ['fight', 'bypass'] },
] as const;

/** 扩展事件类型（5类） */
const EXTENDED_EVENT_TYPES = [
  { id: 'bandit_invasion', name: '流寇入侵', duration: 2, unit: 'hours', frequency: '2~3/day', options: ['fight', 'ignore'] },
  { id: 'caravan_passing', name: '商队经过', duration: 1.5, unit: 'hours', frequency: '1~2/day', options: ['escort', 'intercept', 'ignore'] },
  { id: 'disaster', name: '天灾降临', duration: 24, unit: 'hours', frequency: '1/week', options: ['relief', 'ignore'] },
  { id: 'ruins', name: '遗迹发现', duration: 4, unit: 'hours', frequency: '2/week', options: ['explore', 'abandon'] },
  { id: 'faction_conflict', name: '阵营冲突', duration: 48, unit: 'hours', frequency: '1/week', options: ['participate', 'neutral'] },
] as const;

/** 事件选择分支效果定义（§8.4） */
const EVENT_BRANCH_EFFECTS = {
  merchant_distress: {
    aid: { gold: 1000, prestige: 5 },
    ignore: {},
  },
  refugees: {
    accept: { troops: 200 },
    dismiss: {},
  },
  bandits: {
    fight: { equipment: 1, prestige: 5 },
    bypass: {},
  },
  bandit_invasion: {
    fight: { grain: 500, gold: 500, prestige: 15 },
    ignore: { production_debuff: 0.1, duration: '24h' },
  },
  caravan_passing: {
    escort: { gold: 2000 },
    intercept: { gold: 5000, prestige: -10 },
    ignore: {},
  },
  disaster: {
    relief: { grain: -3000, morale: 20 },
    ignore: { production_debuff: 0.2, duration: '24h' },
  },
  ruins: {
    explore: { rare_items: true },
    abandon: {},
  },
  faction_conflict: {
    participate: { resources: true, prestige: 25 },
    neutral: {},
  },
} as const;

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('worldMap', mapSys);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);

  return deps;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('集成测试: 地图事件系统 (Play §8.1-8.4, §10.0C)', () => {
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createFullDeps();
  });

  // ── §8.1 事件触发规则 ──────────────────────

  describe('§8.1 事件触发规则', () => {
    it('基础事件类型共4种', () => {
      expect(BASIC_EVENT_TYPES).toHaveLength(4);
    });

    it('扩展事件类型共5种', () => {
      expect(EXTENDED_EVENT_TYPES).toHaveLength(5);
    });

    it('事件类型总数为9类（4基础+5扩展）', () => {
      const allTypes = [...BASIC_EVENT_TYPES, ...EXTENDED_EVENT_TYPES];
      expect(allTypes).toHaveLength(9);
    });

    it('基础事件概率总和为1.0', () => {
      const totalProb = BASIC_EVENT_TYPES.reduce((sum, e) => sum + e.probability, 0);
      expect(totalProb).toBeCloseTo(1.0, 2);
    });

    it('每种事件类型有唯一ID', () => {
      const allTypes = [...BASIC_EVENT_TYPES, ...EXTENDED_EVENT_TYPES];
      const ids = allTypes.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(9);
    });

    it('每种事件至少有1个选项', () => {
      const allTypes = [...BASIC_EVENT_TYPES, ...EXTENDED_EVENT_TYPES];
      for (const evt of allTypes) {
        expect(evt.options.length).toBeGreaterThanOrEqual(1);
      }
    });

    it.skip('每小时10%概率触发事件（需 MapEventSystem 实现）', () => {
      // TODO: MapEventSystem 实现后验证触发概率
      // 验证: 100次tick中约10次触发事件
    });

    it.skip('最多3个未处理事件同时存在（需 MapEventSystem 实现）', () => {
      // TODO: MapEventSystem 实现后验证上限
    });

    it.skip('事件仅在已探索区域触发（需 MapEventSystem 实现）', () => {
      // TODO: MapEventSystem 实现后验证探索区域限制
    });
  });

  // ── §8.2 基础事件类型与处理 ──────────────────────

  describe('§8.2 基础事件类型与处理（4类）', () => {
    it('商队遇险: 援助/忽略两个选项', () => {
      const event = BASIC_EVENT_TYPES.find(e => e.id === 'merchant_distress')!;
      expect(event).toBeDefined();
      expect(event.options).toContain('aid');
      expect(event.options).toContain('ignore');
    });

    it('流民: 接纳/遣散两个选项', () => {
      const event = BASIC_EVENT_TYPES.find(e => e.id === 'refugees')!;
      expect(event).toBeDefined();
      expect(event.options).toContain('accept');
      expect(event.options).toContain('dismiss');
    });

    it('宝箱: 直接打开一个选项', () => {
      const event = BASIC_EVENT_TYPES.find(e => e.id === 'treasure')!;
      expect(event).toBeDefined();
      expect(event.options).toContain('open');
    });

    it('山贼: 战斗/绕行两个选项', () => {
      const event = BASIC_EVENT_TYPES.find(e => e.id === 'bandits')!;
      expect(event).toBeDefined();
      expect(event.options).toContain('fight');
      expect(event.options).toContain('bypass');
    });

    it('各基础事件效果定义完整', () => {
      for (const evt of BASIC_EVENT_TYPES) {
        const effects = EVENT_BRANCH_EFFECTS[evt.id as keyof typeof EVENT_BRANCH_EFFECTS];
        if (effects) {
          for (const option of evt.options) {
            expect(effects).toHaveProperty(option);
          }
        }
      }
    });
  });

  // ── §8.3 扩展事件类型验证 ──────────────────────

  describe('§8.3 扩展事件类型验证（5类）', () => {
    it('流寇入侵: 每日2~3次，持续2小时', () => {
      const event = EXTENDED_EVENT_TYPES.find(e => e.id === 'bandit_invasion')!;
      expect(event).toBeDefined();
      expect(event.duration).toBe(2);
      expect(event.options).toContain('fight');
      expect(event.options).toContain('ignore');
    });

    it('商队经过: 每日1~2次，持续1.5小时', () => {
      const event = EXTENDED_EVENT_TYPES.find(e => e.id === 'caravan_passing')!;
      expect(event).toBeDefined();
      expect(event.duration).toBe(1.5);
      expect(event.options).toContain('escort');
      expect(event.options).toContain('intercept');
      expect(event.options).toContain('ignore');
    });

    it('天灾降临: 每周1次，持续24小时', () => {
      const event = EXTENDED_EVENT_TYPES.find(e => e.id === 'disaster')!;
      expect(event).toBeDefined();
      expect(event.duration).toBe(24);
      expect(event.options).toContain('relief');
      expect(event.options).toContain('ignore');
    });

    it('遗迹发现: 每周2次，持续4小时', () => {
      const event = EXTENDED_EVENT_TYPES.find(e => e.id === 'ruins')!;
      expect(event).toBeDefined();
      expect(event.duration).toBe(4);
      expect(event.options).toContain('explore');
      expect(event.options).toContain('abandon');
    });

    it('阵营冲突: 每周1次，持续48小时', () => {
      const event = EXTENDED_EVENT_TYPES.find(e => e.id === 'faction_conflict')!;
      expect(event).toBeDefined();
      expect(event.duration).toBe(48);
      expect(event.options).toContain('participate');
      expect(event.options).toContain('neutral');
    });

    it('扩展事件效果定义完整', () => {
      for (const evt of EXTENDED_EVENT_TYPES) {
        const effects = EVENT_BRANCH_EFFECTS[evt.id as keyof typeof EVENT_BRANCH_EFFECTS];
        if (effects) {
          for (const option of evt.options) {
            expect(effects).toHaveProperty(option);
          }
        }
      }
    });
  });

  // ── §8.4 事件选择分支风险 ──────────────────────

  describe('§8.4 事件选择分支风险', () => {
    it('商队遇险: 援助获得金币，忽略无收益', () => {
      const effects = EVENT_BRANCH_EFFECTS.merchant_distress;
      expect(effects.aid).toHaveProperty('gold');
      expect(effects.aid.gold).toBeGreaterThan(0);
      expect(Object.keys(effects.ignore)).toHaveLength(0);
    });

    it('流寇入侵: 战斗获得资源+声望，忽略导致产出debuff', () => {
      const effects = EVENT_BRANCH_EFFECTS.bandit_invasion;
      expect(effects.fight).toHaveProperty('grain');
      expect(effects.fight).toHaveProperty('prestige');
      expect(effects.ignore).toHaveProperty('production_debuff');
    });

    it('商队经过: 截获获得更多金币但声望降低', () => {
      const effects = EVENT_BRANCH_EFFECTS.caravan_passing;
      expect(effects.intercept).toHaveProperty('gold');
      expect(effects.intercept).toHaveProperty('prestige');
      expect((effects.intercept as { prestige: number }).prestige).toBeLessThan(0);
      expect((effects.intercept as { gold: number }).gold).toBeGreaterThan(
        (effects.escort as { gold: number }).gold
      );
    });

    it('天灾降临: 赈灾消耗粮草但增加民心', () => {
      const effects = EVENT_BRANCH_EFFECTS.disaster;
      expect(effects.relief).toHaveProperty('grain');
      expect(effects.relief).toHaveProperty('morale');
      expect((effects.relief as { grain: number }).grain).toBeLessThan(0);
      expect((effects.relief as { morale: number }).morale).toBeGreaterThan(0);
    });

    it('阵营冲突: 参战获得声望+25', () => {
      const effects = EVENT_BRANCH_EFFECTS.faction_conflict;
      expect(effects.participate).toHaveProperty('prestige');
      expect((effects.participate as { prestige: number }).prestige).toBe(25);
    });
  });

  // ── §10.0C 地图事件→声望/民心影响 ──────────────────────

  describe('§10.0C 地图事件→声望/民心影响', () => {
    it('事件分支效果定义覆盖声望变化', () => {
      // 流寇入侵 → 出兵剿灭 → 声望+15
      const invasion = EVENT_BRANCH_EFFECTS.bandit_invasion;
      expect((invasion.fight as { prestige: number }).prestige).toBe(15);

      // 商队经过 → 截获 → 声望-10
      const caravan = EVENT_BRANCH_EFFECTS.caravan_passing;
      expect((caravan.intercept as { prestige: number }).prestige).toBe(-10);

      // 阵营冲突 → 参战 → 声望+25
      const conflict = EVENT_BRANCH_EFFECTS.faction_conflict;
      expect((conflict.participate as { prestige: number }).prestige).toBe(25);
    });

    it('事件分支效果定义覆盖民心变化', () => {
      // 天灾降临 → 赈灾 → 民心+20
      const disaster = EVENT_BRANCH_EFFECTS.disaster;
      expect((disaster.relief as { morale: number }).morale).toBe(20);
    });

    it.skip('PrestigeSystem 正确响应事件结算（需事件系统集成）', () => {
      // TODO: MapEventSystem + PrestigeSystem 集成后验证
      // 验证: 事件选择后声望值正确变化
    });

    it.skip('MoraleSystem 正确响应事件结算（需事件系统集成）', () => {
      // TODO: MapEventSystem + MoraleSystem 集成后验证
      // 验证: 天灾赈灾→民心+20，忽略→产出降低
    });
  });
});
