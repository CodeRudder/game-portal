/**
 * UnlockChecker 单元测试
 *
 * 覆盖所有公开方法和私有条件评估逻辑（通过公开方法间接测试）。
 */
import {
  UnlockChecker,
  type Unlockable,
  type UnlockContext,
  type UnlockCondition,
} from '@/engines/idle/modules/UnlockChecker';

// ============================================================
// 辅助函数
// ============================================================

/** 创建空的默认上下文 */
function createEmptyContext(overrides?: Partial<UnlockContext>): UnlockContext {
  return {
    resources: new Map(),
    buildings: new Map(),
    statistics: {},
    prestige: { currency: 0, count: 0 },
    totalClicks: 0,
    ...overrides,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('UnlockChecker', () => {
  // ---------- 注册方法 ----------

  describe('registerBuildingUnlocks', () => {
    it('应正确注册建筑解锁目标', () => {
      const checker = new UnlockChecker();
      const unlockables: Unlockable[] = [
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 10 },
          description: '点击10次解锁',
        },
      ];

      checker.registerBuildingUnlocks(unlockables);

      // 通过 getProgress 间接验证注册成功
      const ctx = createEmptyContext({ totalClicks: 10 });
      const result = checker.getProgress('b1', ctx);
      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
    });

    it('应支持覆盖已存在的 id', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 100 },
          description: '旧条件',
        },
      ]);
      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 5 },
          description: '新条件',
        },
      ]);

      const ctx = createEmptyContext({ totalClicks: 10 });
      const result = checker.getProgress('b1', ctx);
      expect(result!.description).toBe('新条件');
      expect(result!.unlocked).toBe(true);
    });
  });

  describe('registerResourceUnlocks', () => {
    it('应正确注册资源解锁目标', () => {
      const checker = new UnlockChecker();
      const unlockables: Unlockable[] = [
        {
          id: 'r1',
          condition: { type: 'building_level', buildingId: 'mine', minLevel: 3 },
          description: '矿井3级解锁',
        },
      ];

      checker.registerResourceUnlocks(unlockables);

      const buildings = new Map<string, { level: number; unlocked: boolean }>();
      buildings.set('mine', { level: 3, unlocked: true });

      const ctx = createEmptyContext({ buildings });
      const result = checker.getProgress('r1', ctx);
      expect(result).not.toBeNull();
      expect(result!.unlocked).toBe(true);
    });
  });

  // ---------- 检查方法 ----------

  describe('checkBuildingUnlocks', () => {
    it('应返回满足条件的建筑 ID', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 5 },
          description: '建筑1',
        },
        {
          id: 'b2',
          condition: { type: 'total_clicks', minClicks: 100 },
          description: '建筑2',
        },
      ]);

      const ctx = createEmptyContext({ totalClicks: 10 });
      const result = checker.checkBuildingUnlocks(ctx);

      expect(result).toEqual(['b1']);
    });

    it('应跳过已解锁的建筑', () => {
      const checker = new UnlockChecker();

      const buildings = new Map<string, { level: number; unlocked: boolean }>();
      buildings.set('b1', { level: 1, unlocked: true });

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 1 },
          description: '建筑1',
        },
      ]);

      const ctx = createEmptyContext({ buildings, totalClicks: 50 });
      const result = checker.checkBuildingUnlocks(ctx);

      expect(result).toEqual([]);
    });

    it('无注册时应返回空数组', () => {
      const checker = new UnlockChecker();
      const ctx = createEmptyContext();
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });
  });

  describe('checkResourceUnlocks', () => {
    it('应返回满足条件的资源 ID', () => {
      const checker = new UnlockChecker();

      const resources = new Map<string, { amount: number; unlocked: boolean }>();
      resources.set('gold', { amount: 500, unlocked: true });

      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'resource_amount', resourceId: 'gold', minAmount: 100 },
          description: '资源1',
        },
        {
          id: 'r2',
          condition: { type: 'resource_amount', resourceId: 'gold', minAmount: 1000 },
          description: '资源2',
        },
      ]);

      const ctx = createEmptyContext({ resources });
      const result = checker.checkResourceUnlocks(ctx);

      expect(result).toEqual(['r1']);
    });

    it('应跳过已解锁的资源', () => {
      const checker = new UnlockChecker();

      const resources = new Map<string, { amount: number; unlocked: boolean }>();
      resources.set('r1', { amount: 500, unlocked: true });

      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'resource_amount', resourceId: 'gold', minAmount: 100 },
          description: '资源1',
        },
      ]);

      const ctx = createEmptyContext({ resources });
      expect(checker.checkResourceUnlocks(ctx)).toEqual([]);
    });
  });

  describe('checkAll', () => {
    it('应同时返回建筑和资源的解锁结果', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 5 },
          description: '建筑1',
        },
      ]);
      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'prestige_count', minCount: 1 },
          description: '资源1',
        },
      ]);

      const ctx = createEmptyContext({
        totalClicks: 10,
        prestige: { currency: 0, count: 2 },
      });

      const result = checker.checkAll(ctx);
      expect(result.buildings).toEqual(['b1']);
      expect(result.resources).toEqual(['r1']);
    });

    it('无任何满足条件时应返回空数组', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 999 },
          description: '建筑1',
        },
      ]);

      const ctx = createEmptyContext({ totalClicks: 0 });
      const result = checker.checkAll(ctx);
      expect(result.buildings).toEqual([]);
      expect(result.resources).toEqual([]);
    });
  });

  // ---------- 进度查询 ----------

  describe('getProgress', () => {
    it('应返回已解锁的进度信息', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 10 },
          description: '点击10次解锁',
        },
      ]);

      const ctx = createEmptyContext({ totalClicks: 15 });
      const result = checker.getProgress('b1', ctx);

      expect(result).toEqual({
        targetId: 'b1',
        unlocked: true,
        description: '点击10次解锁',
      });
    });

    it('应返回未解锁的进度信息', () => {
      const checker = new UnlockChecker();

      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'prestige_currency', minCurrency: 100 },
          description: '需要100声望币',
        },
      ]);

      const ctx = createEmptyContext({ prestige: { currency: 50, count: 0 } });
      const result = checker.getProgress('r1', ctx);

      expect(result).toEqual({
        targetId: 'r1',
        unlocked: false,
        description: '需要100声望币',
      });
    });

    it('目标未注册时应返回 null', () => {
      const checker = new UnlockChecker();
      const ctx = createEmptyContext();
      expect(checker.getProgress('nonexistent', ctx)).toBeNull();
    });
  });

  // ---------- 条件评估（通过公开方法间接测试） ----------

  describe('evaluateCondition (间接测试)', () => {
    it('resource_amount — 资源数量满足', () => {
      const checker = new UnlockChecker();

      const resources = new Map<string, { amount: number; unlocked: boolean }>();
      resources.set('gold', { amount: 200, unlocked: false });

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'resource_amount', resourceId: 'gold', minAmount: 100 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ resources });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('resource_amount — 资源不存在时视为 0', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'resource_amount', resourceId: 'nonexistent', minAmount: 1 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext();
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });

    it('building_level — 建筑等级满足', () => {
      const checker = new UnlockChecker();

      const buildings = new Map<string, { level: number; unlocked: boolean }>();
      buildings.set('mine', { level: 5, unlocked: true });

      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'building_level', buildingId: 'mine', minLevel: 5 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ buildings });
      expect(checker.checkResourceUnlocks(ctx)).toEqual(['r1']);
    });

    it('building_level — 建筑不存在时视为等级 0', () => {
      const checker = new UnlockChecker();

      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'building_level', buildingId: 'nonexistent', minLevel: 1 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext();
      expect(checker.checkResourceUnlocks(ctx)).toEqual([]);
    });

    it('total_clicks — 满足最小点击数', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 50 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ totalClicks: 50 });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('total_clicks — 不满足', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'total_clicks', minClicks: 50 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ totalClicks: 49 });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });

    it('prestige_count — 满足声望次数', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'prestige_count', minCount: 3 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ prestige: { currency: 0, count: 5 } });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('prestige_currency — 满足声望货币', () => {
      const checker = new UnlockChecker();

      checker.registerResourceUnlocks([
        {
          id: 'r1',
          condition: { type: 'prestige_currency', minCurrency: 500 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ prestige: { currency: 600, count: 0 } });
      expect(checker.checkResourceUnlocks(ctx)).toEqual(['r1']);
    });

    it('statistic — 满足统计值', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'statistic', statKey: 'totalEarned', minValue: 1000 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ statistics: { totalEarned: 1500 } });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('statistic — 键不存在时视为 0', () => {
      const checker = new UnlockChecker();

      checker.registerBuildingUnlocks([
        {
          id: 'b1',
          condition: { type: 'statistic', statKey: 'missingKey', minValue: 1 },
          description: '',
        },
      ]);

      const ctx = createEmptyContext({ statistics: {} });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });

    it('AND — 所有子条件都满足', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'and',
        conditions: [
          { type: 'total_clicks', minClicks: 10 },
          { type: 'prestige_count', minCount: 1 },
        ],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      const ctx = createEmptyContext({
        totalClicks: 15,
        prestige: { currency: 0, count: 2 },
      });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('AND — 任一子条件不满足则整体不满足', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'and',
        conditions: [
          { type: 'total_clicks', minClicks: 10 },
          { type: 'prestige_count', minCount: 5 },
        ],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      const ctx = createEmptyContext({
        totalClicks: 15,
        prestige: { currency: 0, count: 1 },
      });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });

    it('AND — 空列表为 true（vacuous truth）', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'and',
        conditions: [],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      const ctx = createEmptyContext();
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('OR — 任一子条件满足即可', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'or',
        conditions: [
          { type: 'total_clicks', minClicks: 100 },
          { type: 'prestige_count', minCount: 1 },
        ],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      const ctx = createEmptyContext({
        totalClicks: 5,
        prestige: { currency: 0, count: 2 },
      });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });

    it('OR — 所有子条件都不满足', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'or',
        conditions: [
          { type: 'total_clicks', minClicks: 100 },
          { type: 'prestige_count', minCount: 5 },
        ],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      const ctx = createEmptyContext({
        totalClicks: 5,
        prestige: { currency: 0, count: 1 },
      });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });

    it('OR — 空列表为 false', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'or',
        conditions: [],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      const ctx = createEmptyContext();
      expect(checker.checkBuildingUnlocks(ctx)).toEqual([]);
    });

    it('嵌套复合条件 — AND 包含 OR', () => {
      const checker = new UnlockChecker();

      const condition: UnlockCondition = {
        type: 'and',
        conditions: [
          { type: 'total_clicks', minClicks: 10 },
          {
            type: 'or',
            conditions: [
              { type: 'prestige_count', minCount: 1 },
              { type: 'prestige_currency', minCurrency: 100 },
            ],
          },
        ],
      };

      checker.registerBuildingUnlocks([
        { id: 'b1', condition, description: '' },
      ]);

      // 点击满足 + 声望货币满足（但声望次数不满足）
      const ctx = createEmptyContext({
        totalClicks: 15,
        prestige: { currency: 200, count: 0 },
      });
      expect(checker.checkBuildingUnlocks(ctx)).toEqual(['b1']);
    });
  });
});
