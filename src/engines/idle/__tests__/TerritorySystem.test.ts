import { vi } from 'vitest';
/**
 * TerritorySystem 单元测试
 *
 * 覆盖所有公共方法和边界情况。
 */

import {
  TerritorySystem,
  type TerritoryDef,
  type TerritoryEvent,
} from '../modules/TerritorySystem';

// ============================================================
// 测试用领土定义
// ============================================================

/** 基础领土图：中心 + 4 方向 + 1 远程 */
const BASIC_TERRITORIES: TerritoryDef[] = [
  {
    id: 'home',
    name: '家园',
    powerRequired: 0,
    rewards: {},
    adjacent: ['plains_1', 'forest_1'],
    type: 'plains',
    defenseMultiplier: 1,
    level: 1,
    position: { x: 0, y: 0 },
  },
  {
    id: 'plains_1',
    name: '平原',
    powerRequired: 100,
    rewards: { gold: 200, food: 100 },
    conquestBonus: { gold: 0.1 },
    adjacent: ['home', 'mountain_1'],
    type: 'plains',
    defenseMultiplier: 1.0,
    level: 2,
    position: { x: 1, y: 0 },
  },
  {
    id: 'forest_1',
    name: '暗影森林',
    powerRequired: 150,
    rewards: { wood: 300 },
    conquestBonus: { wood: 0.15 },
    adjacent: ['home', 'desert_1'],
    type: 'forest',
    defenseMultiplier: 1.5,
    level: 2,
    position: { x: 0, y: 1 },
  },
  {
    id: 'mountain_1',
    name: '铁壁山脉',
    powerRequired: 300,
    rewards: { iron: 500 },
    conquestBonus: { iron: 0.2 },
    adjacent: ['plains_1', 'capital_1'],
    type: 'mountain',
    defenseMultiplier: 2.0,
    level: 3,
    position: { x: 2, y: 0 },
  },
  {
    id: 'desert_1',
    name: '灼热沙漠',
    powerRequired: 200,
    rewards: { gem: 100 },
    adjacent: ['forest_1'],
    type: 'desert',
    defenseMultiplier: 1.8,
    level: 3,
    position: { x: -1, y: 1 },
  },
  {
    id: 'capital_1',
    name: '王都',
    powerRequired: 500,
    rewards: { gold: 1000, gem: 500 },
    conquestBonus: { gold: 0.3, gem: 0.1 },
    adjacent: ['mountain_1'],
    type: 'capital',
    defenseMultiplier: 3.0,
    level: 5,
    specialEffect: 'double_income',
    position: { x: 3, y: 0 },
  },
];

// ============================================================
// 辅助函数
// ============================================================

/** 创建系统并征服初始领土 */
function createSystemWithHome(): TerritorySystem {
  const sys = new TerritorySystem([...BASIC_TERRITORIES]);
  sys.conquer('home');
  return sys;
}

// ============================================================
// 测试套件
// ============================================================

describe('TerritorySystem', () => {
  let system: TerritorySystem;

  beforeEach(() => {
    vi.useFakeTimers();
    system = new TerritorySystem([...BASIC_TERRITORIES]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('应正确创建实例', () => {
      expect(system).toBeDefined();
      expect(system.getAttackInfo()).toBeNull();
      expect(system.getConqueredIds()).toEqual([]);
    });

    it('应在遇到重复 ID 时抛出错误', () => {
      const dup: TerritoryDef[] = [
        { ...BASIC_TERRITORIES[0] },
        { ...BASIC_TERRITORIES[0] },
      ];
      expect(() => new TerritorySystem(dup)).toThrow('Duplicate territory id');
    });

    it('应接受空数组', () => {
      const empty = new TerritorySystem([]);
      expect(empty).toBeDefined();
    });

    it('应初始化所有领土状态', () => {
      for (const def of BASIC_TERRITORIES) {
        const status = system.getTerritoryStatus(def.id);
        expect(status).not.toBeNull();
        expect(status!.conquered).toBe(false);
        expect(status!.garrison).toBe(0);
        expect(status!.prosperity).toBe(0);
      }
    });
  });

  // ----------------------------------------------------------
  // conquer()
  // ----------------------------------------------------------

  describe('conquer', () => {
    it('应正确征服领土', () => {
      const result = system.conquer('home');
      expect(result.rewards).toEqual({});
      expect(result.bonus).toEqual({});
      expect(system.isConquered('home')).toBe(true);
    });

    it('应返回正确的奖励和加成', () => {
      system.conquer('home');
      const result = system.conquer('plains_1');
      expect(result.rewards).toEqual({ gold: 200, food: 100 });
      expect(result.bonus).toEqual({ gold: 0.1 });
    });

    it('征服后繁荣度应为初始值 10', () => {
      system.conquer('home');
      const status = system.getTerritoryStatus('home');
      expect(status!.prosperity).toBe(10);
    });

    it('征服后应记录征服时间', () => {
      const now = Date.now();
      system.conquer('home');
      const status = system.getTerritoryStatus('home');
      expect(status!.conqueredAt).toBeGreaterThanOrEqual(now);
    });

    it('不存在的领土应抛出异常', () => {
      expect(() => system.conquer('nonexistent')).toThrow('Territory not found');
    });

    it('征服后应发布 territory_conquered 事件', () => {
      const events: TerritoryEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.conquer('home');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('territory_conquered');
      expect((events[0].data as Record<string, unknown>)?.territoryId).toBe('home');
    });
  });

  // ----------------------------------------------------------
  // isConquered()
  // ----------------------------------------------------------

  describe('isConquered', () => {
    it('未征服时应返回 false', () => {
      expect(system.isConquered('home')).toBe(false);
    });

    it('征服后应返回 true', () => {
      system.conquer('home');
      expect(system.isConquered('home')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // canAttack()
  // ----------------------------------------------------------

  describe('canAttack', () => {
    it('无已征服领土时不能进攻任何领土', () => {
      expect(system.canAttack('plains_1')).toBe(false);
    });

    it('征服 home 后应可进攻相邻领土', () => {
      system.conquer('home');
      expect(system.canAttack('plains_1')).toBe(true);
      expect(system.canAttack('forest_1')).toBe(true);
    });

    it('非相邻领土不可进攻', () => {
      system.conquer('home');
      expect(system.canAttack('mountain_1')).toBe(false);
      expect(system.canAttack('capital_1')).toBe(false);
    });

    it('已征服的领土不可进攻', () => {
      system.conquer('home');
      expect(system.canAttack('home')).toBe(false);
    });

    it('不存在的领土不可进攻', () => {
      expect(system.canAttack('nonexistent')).toBe(false);
    });

    it('征服链条：home → plains_1 → mountain_1', () => {
      system.conquer('home');
      system.conquer('plains_1');

      expect(system.canAttack('mountain_1')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // attack()
  // ----------------------------------------------------------

  describe('attack', () => {
    it('应在条件满足时成功开始进攻', () => {
      system.conquer('home');
      const result = system.attack('plains_1', 200);
      expect(result).toBe(true);
      expect(system.getAttackInfo()).not.toBeNull();
      expect(system.getAttackInfo()!.territoryId).toBe('plains_1');
      expect(system.getAttackInfo()!.progress).toBe(0);
    });

    it('未征服相邻领土时应返回 false', () => {
      expect(system.attack('plains_1', 200)).toBe(false);
    });

    it('进攻不存在的领土应返回 false', () => {
      expect(system.attack('nonexistent', 200)).toBe(false);
    });

    it('进攻已征服的领土应返回 false', () => {
      system.conquer('home');
      expect(system.attack('home', 200)).toBe(false);
    });

    it('战力为 0 时应返回 false', () => {
      system.conquer('home');
      expect(system.attack('plains_1', 0)).toBe(false);
    });

    it('已有进攻进行中时应返回 false', () => {
      system.conquer('home');
      system.attack('plains_1', 200);
      expect(system.attack('forest_1', 200)).toBe(false);
    });

    it('应在开始进攻时发布 attack_started 事件', () => {
      const events: TerritoryEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.conquer('home');
      system.attack('plains_1', 200);

      const startedEvents = events.filter((e) => e.type === 'attack_started');
      expect(startedEvents).toHaveLength(1);
      expect((startedEvents[0].data as Record<string, unknown>)?.territoryId).toBe('plains_1');
    });
  });

  // ----------------------------------------------------------
  // update() 进攻进度
  // ----------------------------------------------------------

  describe('update attack progress', () => {
    it('应正确推进进攻进度', () => {
      system.conquer('home');
      // plains_1: effective = 100 * 1.0 = 100, power = 50
      // speed = 50/100/1000 = 0.0005 per ms → 100ms gives 0.05
      system.attack('plains_1', 50);

      system.update(100); // 100ms → progress ≈ 0.05
      const info = system.getAttackInfo();
      expect(info).not.toBeNull();
      expect(info!.progress).toBeGreaterThan(0);
      expect(info!.progress).toBeLessThan(1);
    });

    it('战力充足时进度应正常推进到完成', () => {
      system.conquer('home');
      // plains_1: effective = 100 * 1.0 = 100, power = 200
      // speed = 200/100/1000 = 0.002 per ms → 500ms to complete
      system.attack('plains_1', 200);

      system.update(500);
      expect(system.isConquered('plains_1')).toBe(true);
    });

    it('无进攻时 update 不应报错', () => {
      expect(() => system.update(16)).not.toThrow();
    });

    it('dt <= 0 时不应更新', () => {
      system.conquer('home');
      system.attack('plains_1', 200);

      system.update(0);
      expect(system.getAttackInfo()!.progress).toBe(0);

      system.update(-100);
      expect(system.getAttackInfo()!.progress).toBe(0);
    });

    it('应在进度更新时发布 attack_progress 事件', () => {
      const events: TerritoryEvent[] = [];
      system.onEvent((e) => events.push(e));
      system.conquer('home');
      system.attack('plains_1', 200);

      system.update(100);

      const progressEvents = events.filter((e) => e.type === 'attack_progress');
      expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------
  // update() 繁荣度
  // ----------------------------------------------------------

  describe('update prosperity', () => {
    it('已征服领土繁荣度应随时间增长', () => {
      system.conquer('home');
      expect(system.getTerritoryStatus('home')!.prosperity).toBe(10);

      vi.advanceTimersByTime(10000);
      system.update(10000);

      const status = system.getTerritoryStatus('home');
      expect(status!.prosperity).toBeGreaterThan(10);
    });

    it('繁荣度不应超过 100', () => {
      system.conquer('home');

      // 大量时间推进
      vi.advanceTimersByTime(10000000);
      system.update(10000000);

      const status = system.getTerritoryStatus('home');
      expect(status!.prosperity).toBeLessThanOrEqual(100);
    });

    it('驻防兵力应加速繁荣度增长', () => {
      system.conquer('home');
      system.setGarrison('home', 100);

      const sys2 = new TerritorySystem([...BASIC_TERRITORIES]);
      sys2.conquer('home');
      // sys2 没有 garrison

      vi.advanceTimersByTime(10000);
      system.update(10000);
      sys2.update(10000);

      const prosperityWithGarrison = system.getTerritoryStatus('home')!.prosperity;
      const prosperityWithout = sys2.getTerritoryStatus('home')!.prosperity;
      expect(prosperityWithGarrison).toBeGreaterThan(prosperityWithout);
    });

    it('未征服领土繁荣度不应增长', () => {
      system.update(10000);
      expect(system.getTerritoryStatus('plains_1')!.prosperity).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // getBonus()
  // ----------------------------------------------------------

  describe('getBonus', () => {
    it('无已征服领土加成时应返回空对象', () => {
      expect(system.getBonus()).toEqual({});
    });

    it('home 无 conquestBonus，征服后仍为空', () => {
      system.conquer('home');
      expect(system.getBonus()).toEqual({});
    });

    it('应正确累加多个领土加成', () => {
      system.conquer('home');
      system.conquer('plains_1'); // gold: 0.1
      system.conquer('forest_1'); // wood: 0.15

      const bonus = system.getBonus();
      expect(bonus.gold).toBeCloseTo(0.1);
      expect(bonus.wood).toBeCloseTo(0.15);
    });

    it('相同资源的加成应累加', () => {
      system.conquer('home');
      system.conquer('plains_1'); // gold: 0.1
      // 需要征服更多有 gold 加成的领土
      system.conquer('mountain_1'); // iron: 0.2
      system.conquer('capital_1'); // gold: 0.3, gem: 0.1

      const bonus = system.getBonus();
      expect(bonus.gold).toBeCloseTo(0.4); // 0.1 + 0.3
      expect(bonus.iron).toBeCloseTo(0.2);
      expect(bonus.gem).toBeCloseTo(0.1);
    });
  });

  // ----------------------------------------------------------
  // getIncomePerSecond()
  // ----------------------------------------------------------

  describe('getIncomePerSecond', () => {
    it('无已征服领土时应返回空对象', () => {
      expect(system.getIncomePerSecond()).toEqual({});
    });

    it('应基于繁荣度和等级计算产出', () => {
      system.conquer('home');
      system.conquer('plains_1');
      // plains_1: rewards={gold:200, food:100}, prosperity=10, level=2
      // income = baseAmount * (prosperity/100) * (level * 0.5)
      // gold: 200 * (10/100) * (2 * 0.5) = 200 * 0.1 * 1.0 = 20
      // food: 100 * 0.1 * 1.0 = 10

      const income = system.getIncomePerSecond();
      expect(income.gold).toBeCloseTo(20);
      expect(income.food).toBeCloseTo(10);
    });

    it('繁荣度增长后产出应增加', () => {
      system.conquer('home');
      system.conquer('plains_1');

      const incomeBefore = system.getIncomePerSecond();

      vi.advanceTimersByTime(100000);
      system.update(100000);

      const incomeAfter = system.getIncomePerSecond();
      expect(incomeAfter.gold).toBeGreaterThan(incomeBefore.gold!);
    });
  });

  // ----------------------------------------------------------
  // setGarrison()
  // ----------------------------------------------------------

  describe('setGarrison', () => {
    it('应在已征服领土上设置驻防', () => {
      system.conquer('home');
      expect(system.setGarrison('home', 50)).toBe(true);
      expect(system.getTerritoryStatus('home')!.garrison).toBe(50);
    });

    it('未征服领土不可设置驻防', () => {
      expect(system.setGarrison('plains_1', 50)).toBe(false);
    });

    it('不存在的领土不可设置驻防', () => {
      expect(system.setGarrison('nonexistent', 50)).toBe(false);
    });

    it('负数驻防应被截断为 0', () => {
      system.conquer('home');
      system.setGarrison('home', -10);
      expect(system.getTerritoryStatus('home')!.garrison).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // getDef() / getAllDefs()
  // ----------------------------------------------------------

  describe('getDef and getAllDefs', () => {
    it('getDef 应返回正确的定义', () => {
      const def = system.getDef('home');
      expect(def).toBeDefined();
      expect(def!.name).toBe('家园');
    });

    it('getDef 不存在的 ID 应返回 undefined', () => {
      expect(system.getDef('nonexistent')).toBeUndefined();
    });

    it('getAllDefs 应返回所有定义', () => {
      const allDefs = system.getAllDefs();
      expect(allDefs.length).toBe(BASIC_TERRITORIES.length);
    });
  });

  // ----------------------------------------------------------
  // 事件系统
  // ----------------------------------------------------------

  describe('events', () => {
    it('取消订阅后不应再收到事件', () => {
      const events: TerritoryEvent[] = [];
      const unsub = system.onEvent((e) => events.push(e));

      unsub();
      system.conquer('home');

      expect(events).toHaveLength(0);
    });

    it('多个监听器应都能收到事件', () => {
      const events1: TerritoryEvent[] = [];
      const events2: TerritoryEvent[] = [];

      system.onEvent((e) => events1.push(e));
      system.onEvent((e) => events2.push(e));

      system.conquer('home');

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    it('监听器异常不应影响其他监听器', () => {
      const events: TerritoryEvent[] = [];
      system.onEvent(() => {
        throw new Error('listener error');
      });
      system.onEvent((e) => events.push(e));

      system.conquer('home');
      expect(events).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // serialize() / deserialize()
  // ----------------------------------------------------------

  describe('serialize and deserialize', () => {
    it('初始状态序列化应正确', () => {
      const data = system.serialize();
      expect(data.conquered).toEqual([]);
      expect(data.attacking).toBeNull();
      expect(data.attackProgress).toBe(0);
      expect(data.totalPower).toBe(0);
    });

    it('应正确序列化和反序列化有数据的状态', () => {
      system.conquer('home');
      system.conquer('plains_1');
      // forest_1: effective = 150 * 1.5 = 225, power = 10
      // speed = 10/225/1000 ≈ 0.0000444/ms → 100ms gives ~0.004
      system.attack('forest_1', 10);
      system.update(100);

      const serialized = system.serialize();
      expect(serialized.conquered).toContain('home');
      expect(serialized.conquered).toContain('plains_1');
      expect(serialized.attacking).toBe('forest_1');
      expect(serialized.attackProgress).toBeGreaterThan(0);

      const restored = new TerritorySystem([...BASIC_TERRITORIES]);
      restored.deserialize(serialized);

      expect(restored.isConquered('home')).toBe(true);
      expect(restored.isConquered('plains_1')).toBe(true);
      expect(restored.isConquered('forest_1')).toBe(false);
      expect(restored.getAttackInfo()!.territoryId).toBe('forest_1');
    });

    it('应正确恢复繁荣度和驻防', () => {
      system.conquer('home');
      system.setGarrison('home', 50);

      vi.advanceTimersByTime(50000);
      system.update(50000);

      const prosperityBefore = system.getTerritoryStatus('home')!.prosperity;
      const serialized = system.serialize();

      const restored = new TerritorySystem([...BASIC_TERRITORIES]);
      restored.deserialize(serialized);

      expect(restored.getTerritoryStatus('home')!.prosperity).toBeCloseTo(prosperityBefore);
      expect(restored.getTerritoryStatus('home')!.garrison).toBe(50);
    });

    it('应处理无效的反序列化数据', () => {
      const restored = new TerritorySystem([...BASIC_TERRITORIES]);
      expect(() => restored.deserialize({})).not.toThrow();
      expect(restored.getAttackInfo()).toBeNull();
      expect(restored.getConqueredIds()).toEqual([]);
    });

    it('应处理包含非法字段的反序列化数据', () => {
      const restored = new TerritorySystem([...BASIC_TERRITORIES]);
      restored.deserialize({
        conquered: ['home', 123, null],
        attacking: 456,
        attackProgress: 'invalid',
        totalPower: 'abc',
      });

      expect(restored.isConquered('home')).toBe(true);
      expect(restored.getAttackInfo()).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // reset()
  // ----------------------------------------------------------

  describe('reset', () => {
    it('应清除所有状态', () => {
      system.conquer('home');
      system.conquer('plains_1');
      system.attack('forest_1', 200);

      system.reset();

      expect(system.isConquered('home')).toBe(false);
      expect(system.isConquered('plains_1')).toBe(false);
      expect(system.getAttackInfo()).toBeNull();
      expect(system.getConqueredIds()).toEqual([]);
      expect(system.getBonus()).toEqual({});
      expect(system.getIncomePerSecond()).toEqual({});
    });

    it('重置后所有领土状态应恢复初始值', () => {
      system.conquer('home');
      system.setGarrison('home', 100);

      system.reset();

      const status = system.getTerritoryStatus('home');
      expect(status!.conquered).toBe(false);
      expect(status!.garrison).toBe(0);
      expect(status!.prosperity).toBe(0);
      expect(status!.conqueredAt).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 完整征服流程
  // ----------------------------------------------------------

  describe('full conquest flow', () => {
    it('应支持完整的征服链条', () => {
      // 1. 征服 home
      system.conquer('home');
      expect(system.canAttack('plains_1')).toBe(true);
      expect(system.canAttack('forest_1')).toBe(true);
      expect(system.canAttack('mountain_1')).toBe(false);

      // 2. 进攻并征服 plains_1
      system.attack('plains_1', 200);
      // effective = 100 * 1.0 = 100, speed = 200/100/1000 = 0.002/ms
      system.update(500);
      expect(system.isConquered('plains_1')).toBe(true);

      // 3. 现在 mountain_1 可进攻
      expect(system.canAttack('mountain_1')).toBe(true);

      // 4. 进攻并征服 mountain_1
      system.attack('mountain_1', 1000);
      // effective = 300 * 2.0 = 600, speed = 1000/600/1000 ≈ 0.00167/ms
      system.update(600);
      expect(system.isConquered('mountain_1')).toBe(true);

      // 5. 最终可进攻王都
      expect(system.canAttack('capital_1')).toBe(true);
    });

    it('应正确汇总最终加成', () => {
      // 征服所有领土
      system.conquer('home');
      system.conquer('plains_1');  // gold: 0.1
      system.conquer('forest_1');  // wood: 0.15
      system.conquer('mountain_1'); // iron: 0.2
      system.conquer('capital_1'); // gold: 0.3, gem: 0.1

      const bonus = system.getBonus();
      expect(bonus.gold).toBeCloseTo(0.4);
      expect(bonus.wood).toBeCloseTo(0.15);
      expect(bonus.iron).toBeCloseTo(0.2);
      expect(bonus.gem).toBeCloseTo(0.1);
    });
  });

  // ----------------------------------------------------------
  // 泛型支持
  // ----------------------------------------------------------

  describe('generics', () => {
    it('应支持扩展的 TerritoryDef', () => {
      interface ExtendedTerritoryDef extends TerritoryDef {
        difficulty: 'easy' | 'medium' | 'hard';
      }

      const extendedDefs: ExtendedTerritoryDef[] = [
        {
          id: 'ext_1',
          name: '扩展领土',
          powerRequired: 50,
          rewards: { gold: 100 },
          adjacent: [],
          type: 'plains',
          defenseMultiplier: 1,
          level: 1,
          position: { x: 0, y: 0 },
          difficulty: 'easy',
        },
      ];

      const extSystem = new TerritorySystem<ExtendedTerritoryDef>(extendedDefs);
      expect(extSystem).toBeDefined();
      expect(extSystem.getDef('ext_1')!.difficulty).toBe('easy');
    });
  });
});
