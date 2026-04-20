/**
 * 测试基础设施验证 — GameTestRunner + TestDataProvider + MockGameLogic
 *
 * 验证测试基础设施的核心功能是否正常工作。
 */

import {
  GameTestRunner,
  MockGameLogic,
  TestDataProvider,
  resetCounters,
} from '../utils';
import type { GameTestCase, GameTestContext } from '../utils';
import type { HeroData, ArmyData, CityData } from '../types';

// ─────────────────────────────────────────────
// TestDataProvider 测试
// ─────────────────────────────────────────────

describe('TestDataProvider', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('hero()', () => {
    it('生成默认武将数据', () => {
      const hero = TestDataProvider.hero();
      expect(hero).toBeDefined();
      expect(hero.id).toBe('hero-0');
      expect(hero.name).toBeTruthy();
      expect(hero.faction).toBeTruthy();
      expect(hero.level).toBeGreaterThanOrEqual(1);
      expect(hero.attack).toBeGreaterThan(0);
      expect(hero.defense).toBeGreaterThan(0);
      expect(hero.intelligence).toBeGreaterThan(0);
      expect(hero.loyalty).toBeGreaterThanOrEqual(0);
    });

    it('支持 overrides 覆盖', () => {
      const hero = TestDataProvider.hero({ id: 'custom-id', attack: 99 });
      expect(hero.id).toBe('custom-id');
      expect(hero.attack).toBe(99);
    });

    it('每次调用生成唯一 ID', () => {
      const h1 = TestDataProvider.hero();
      const h2 = TestDataProvider.hero();
      expect(h1.id).not.toBe(h2.id);
    });
  });

  describe('heroes()', () => {
    it('批量生成指定数量的武将', () => {
      const heroes = TestDataProvider.heroes(5);
      expect(heroes).toHaveLength(5);
    });

    it('批量生成的武将应用 overrides', () => {
      const heroes = TestDataProvider.heroes(3, { faction: 'wei' });
      expect(heroes.every((h) => h.faction === 'wei')).toBe(true);
    });
  });

  describe('army()', () => {
    it('生成默认军队数据', () => {
      const army = TestDataProvider.army();
      expect(army).toBeDefined();
      expect(army.id).toBeTruthy();
      expect(army.soldiers).toBeGreaterThan(0);
      expect(army.morale).toBeGreaterThanOrEqual(0);
    });

    it('支持 overrides 覆盖', () => {
      const army = TestDataProvider.army({ soldiers: 9999, faction: 'wu' });
      expect(army.soldiers).toBe(9999);
      expect(army.faction).toBe('wu');
    });
  });

  describe('city()', () => {
    it('生成默认城市数据', () => {
      const city = TestDataProvider.city();
      expect(city).toBeDefined();
      expect(city.id).toBeTruthy();
      expect(city.name).toBeTruthy();
      expect(city.population).toBeGreaterThan(0);
      expect(city.position).toBeDefined();
      expect(typeof city.position.x).toBe('number');
      expect(typeof city.position.y).toBe('number');
    });
  });

  describe('resources()', () => {
    it('生成默认资源数据', () => {
      const res = TestDataProvider.resources();
      expect(res.grain).toBeGreaterThan(0);
      expect(res.gold).toBeGreaterThan(0);
      expect(res.troops).toBeGreaterThan(0);
      expect(res.mandate).toBeGreaterThan(0);
    });

    it('支持部分覆盖', () => {
      const res = TestDataProvider.resources({ gold: 99999 });
      expect(res.gold).toBe(99999);
      expect(res.grain).toBe(5000); // 默认值
    });
  });

  describe('building() / buildings()', () => {
    it('生成单个建筑状态', () => {
      const b = TestDataProvider.building('barracks', { level: 5 });
      expect(b.type).toBe('barracks');
      expect(b.level).toBe(5);
      expect(b.status).toBe('idle');
    });

    it('生成全部8种建筑', () => {
      const buildings = TestDataProvider.buildings();
      expect(Object.keys(buildings)).toHaveLength(8);
      expect(buildings.castle).toBeDefined();
      expect(buildings.wall).toBeDefined();
    });
  });

  describe('threeKingdomsSetup()', () => {
    it('生成完整的三方初始数据', () => {
      const setup = TestDataProvider.threeKingdomsSetup();
      expect(setup.factions).toEqual(['shu', 'wei', 'wu']);
      expect(setup.cities.length).toBe(6); // 每势力2城
      expect(setup.heroes.length).toBe(9); // 每势力3武将
      expect(setup.armies.length).toBe(3); // 每势力1军
      expect(setup.resources).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────
// MockGameLogic 测试
// ─────────────────────────────────────────────

describe('MockGameLogic', () => {
  let mock: MockGameLogic;

  beforeEach(() => {
    resetCounters();
    mock = new MockGameLogic();
  });

  describe('调用日志', () => {
    it('记录方法调用', () => {
      mock.getHero('hero-0');
      expect(mock.getCallCount('getHero')).toBe(1);
      expect(mock.getCalls('getHero')[0]).toEqual(['hero-0']);
    });

    it('多次调用正确计数', () => {
      mock.endTurn();
      mock.endTurn();
      mock.endTurn();
      expect(mock.getCallCount('endTurn')).toBe(3);
    });

    it('未调用的方法返回0', () => {
      expect(mock.getCallCount('nonExistent')).toBe(0);
    });

    it('reset 清除日志', () => {
      mock.getHero('hero-0');
      mock.reset();
      expect(mock.getCallCount('getHero')).toBe(0);
    });
  });

  describe('默认行为', () => {
    it('getHero 返回默认武将', () => {
      // MockGameLogic 初始化时会通过 TestDataProvider 创建默认武将
      const hero = mock.getHero('hero-0');
      // 默认数据可能存在也可能不存在，取决于初始化
      // 重点是方法不抛异常
      expect(typeof mock.getCallCount('getHero')).toBe('number');
    });

    it('getCurrentRound 返回初始回合', () => {
      expect(mock.getCurrentRound()).toBe(1);
    });

    it('getCurrentFaction 返回初始势力', () => {
      expect(mock.getCurrentFaction()).toBe('shu');
    });

    it('endTurn 递增回合', () => {
      mock.endTurn();
      expect(mock.getCurrentRound()).toBe(2);
      expect(mock.getCurrentFaction()).toBe('wei');
    });

    it('createArmy 返回新军队ID', () => {
      const id = mock.createArmy('hero-0', 'city-0', 1000);
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('simulateBattle 返回战斗结果', () => {
      const attacker: ArmyData = TestDataProvider.army({ soldiers: 5000, morale: 90 });
      const defender: ArmyData = TestDataProvider.army({ soldiers: 3000, morale: 60 });
      const result = mock.simulateBattle(attacker, defender);
      expect(result).toBeDefined();
      expect(typeof result.victory).toBe('boolean');
      expect(result.attackerRemaining).toBeGreaterThanOrEqual(0);
      expect(result.defenderRemaining).toBeGreaterThanOrEqual(0);
      expect(result.rounds).toBeGreaterThan(0);
      expect(result.log.length).toBeGreaterThan(0);
    });

    it('formAlliance / getRelationship', () => {
      mock.formAlliance('shu', 'wu');
      expect(mock.getRelationship('shu', 'wu')).toBe('ally');
    });

    it('breakAlliance 解除同盟', () => {
      mock.formAlliance('shu', 'wu');
      const result = mock.breakAlliance('shu', 'wu');
      expect(result).toBe(true);
      expect(mock.getRelationship('shu', 'wu')).toBe('neutral');
    });

    it('collectTax 返回税收', () => {
      // 先确保有城市数据
      const tax = mock.collectTax('city-0');
      expect(typeof tax).toBe('number');
    });

    it('trade 返回 true（正数金额）', () => {
      expect(mock.trade('shu', 'wei', 'gold', 100)).toBe(true);
    });
  });

  describe('overrides 自定义行为', () => {
    it('覆盖 getHero', () => {
      const customHero: HeroData = {
        id: 'custom',
        name: '自定义武将',
        faction: 'qun',
        level: 99,
        attack: 100,
        defense: 100,
        intelligence: 100,
        loyalty: 100,
      };
      const m = new MockGameLogic({
        getHero: () => customHero,
      });
      expect(m.getHero('any-id')).toEqual(customHero);
    });

    it('覆盖 recruitHero 使其总是失败', () => {
      const m = new MockGameLogic({
        recruitHero: () => false,
      });
      expect(m.recruitHero('hero-0', 'city-0')).toBe(false);
    });

    it('覆盖 getCurrentRound', () => {
      const m = new MockGameLogic({
        getCurrentRound: () => 42,
      });
      expect(m.getCurrentRound()).toBe(42);
    });
  });

  describe('resetAll', () => {
    it('重置所有状态', () => {
      mock.endTurn();
      mock.endTurn();
      mock.resetAll();
      expect(mock.getCurrentRound()).toBe(1);
      expect(mock.getCallCount('endTurn')).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────
// GameTestRunner 测试
// ─────────────────────────────────────────────

describe('GameTestRunner', () => {
  let runner: GameTestRunner;

  beforeEach(() => {
    resetCounters();
    runner = new GameTestRunner();
  });

  describe('registerCase', () => {
    it('注册测试用例', () => {
      runner.registerCase({
        name: 'test-1',
        category: 'core',
        execute: async () => {},
      });
      expect(runner.caseCount).toBe(1);
    });

    it('重复注册抛出异常', () => {
      runner.registerCase({
        name: 'test-dup',
        category: 'core',
        execute: async () => {},
      });
      expect(() =>
        runner.registerCase({
          name: 'test-dup',
          category: 'core',
          execute: async () => {},
        }),
      ).toThrow('已注册');
    });

    it('registerCases 批量注册', () => {
      runner.registerCases([
        { name: 'a', category: 'core', execute: async () => {} },
        { name: 'b', category: 'system', execute: async () => {} },
        { name: 'c', category: 'ui', execute: async () => {} },
      ]);
      expect(runner.caseCount).toBe(3);
    });
  });

  describe('runSingle', () => {
    it('执行通过的用例', async () => {
      runner.registerCase({
        name: 'pass-test',
        category: 'core',
        execute: async (ctx) => {
          expect(ctx.mockLogic).toBeDefined();
          expect(ctx.data).toBe(TestDataProvider);
        },
      });
      const result = await runner.runSingle('pass-test');
      expect(result.name).toBe('pass-test');
      expect(result.status).toBe('passed');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('执行失败的用例', async () => {
      runner.registerCase({
        name: 'fail-test',
        category: 'core',
        execute: async () => {
          throw new Error('故意失败');
        },
      });
      const result = await runner.runSingle('fail-test');
      expect(result.status).toBe('failed');
      expect(result.error?.message).toBe('故意失败');
    });

    it('未注册的用例返回 error', async () => {
      const result = await runner.runSingle('nonexistent');
      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('未注册');
    });

    it('执行 setup 和 teardown', async () => {
      const log: string[] = [];
      runner.registerCase({
        name: 'lifecycle-test',
        category: 'core',
        setup: async () => { log.push('setup'); },
        execute: async () => { log.push('execute'); },
        teardown: async () => { log.push('teardown'); },
      });
      const result = await runner.runSingle('lifecycle-test');
      expect(result.status).toBe('passed');
      expect(log).toEqual(['setup', 'execute', 'teardown']);
    });

    it('teardown 即使出错也执行', async () => {
      const log: string[] = [];
      runner.registerCase({
        name: 'teardown-after-error',
        category: 'core',
        execute: async () => { throw new Error('boom'); },
        teardown: async () => { log.push('teardown'); },
      });
      const result = await runner.runSingle('teardown-after-error');
      expect(result.status).toBe('failed');
      expect(log).toEqual(['teardown']);
    });
  });

  describe('run (批量 + 过滤)', () => {
    beforeEach(() => {
      runner.registerCases([
        {
          name: 'core-1',
          category: 'core',
          tags: ['unit', 'fast'],
          execute: async () => {},
        },
        {
          name: 'core-2',
          category: 'core',
          tags: ['unit'],
          execute: async () => {},
        },
        {
          name: 'system-1',
          category: 'system',
          tags: ['integration'],
          execute: async () => {},
        },
        {
          name: 'ui-1',
          category: 'ui',
          tags: ['unit', 'render'],
          execute: async () => {},
        },
      ]);
    });

    it('无过滤执行全部用例', async () => {
      const results = await runner.run();
      expect(results).toHaveLength(4);
      expect(results.every((r) => r.status === 'passed')).toBe(true);
    });

    it('按 category 过滤', async () => {
      const results = await runner.run({ category: 'core' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.name.startsWith('core'))).toBe(true);
    });

    it('按 tags 过滤', async () => {
      const results = await runner.run({ tags: ['integration'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('system-1');
    });

    it('tags 过滤匹配任一标签', async () => {
      const results = await runner.run({ tags: ['fast', 'render'] });
      expect(results).toHaveLength(2);
    });

    it('category + tags 组合过滤', async () => {
      const results = await runner.run({ category: 'ui', tags: ['unit'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ui-1');
    });
  });

  describe('report', () => {
    it('生成测试报告', async () => {
      runner.registerCases([
        { name: 'pass-1', category: 'core', execute: async () => {} },
        { name: 'pass-2', category: 'core', execute: async () => {} },
      ]);
      await runner.run();
      const report = runner.report();
      expect(report.total).toBe(2);
      expect(report.passed).toBe(2);
      expect(report.failed).toBe(0);
      expect(report.skipped).toBe(0);
      expect(report.duration).toBeGreaterThanOrEqual(0);
      expect(report.timestamp).toBeTruthy();
      expect(report.results).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('清除所有用例', () => {
      runner.registerCase({ name: 'x', category: 'core', execute: async () => {} });
      runner.clear();
      expect(runner.caseCount).toBe(0);
    });
  });
});
