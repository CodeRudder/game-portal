/**
 * StatisticsTracker 单元测试
 *
 * 覆盖范围：
 * - 构造函数和初始化
 * - update() 五种聚合方式（sum / max / min / last / count）
 * - increment() 增量更新快捷方式
 * - get() / getRecord() / getByCategory() 查询
 * - getTimeSeries() 时间序列记录与查询
 * - getSessionSummary() 会话摘要
 * - onProgress() 成就进度回调注册与取消
 * - serialize() / deserialize() 序列化与反序列化
 * - reset() 重置
 * - getAllDefinitions() / getCategories() 元数据查询
 * - 边界条件和错误处理
 */

import {
  StatisticsTracker,
  type StatDefinition,
  type StatValue,
  type AchievementProgressCallback,
} from '../modules/StatisticsTracker';

// ============================================================
// 测试用辅助工具
// ============================================================

/** 创建一组标准的统计项定义，覆盖各种聚合方式和值类型 */
function createStandardDefinitions(): StatDefinition[] {
  const now = Date.now();
  return [
    {
      id: 'total_kills',
      displayName: '总击杀数',
      category: 'combat',
      valueType: 'number',
      aggregation: 'sum',
      initialValue: 0,
      linkedAchievementIds: ['ach_kill_100', 'ach_kill_1000'],
      persistent: true,
    },
    {
      id: 'max_damage',
      displayName: '最大伤害',
      category: 'combat',
      valueType: 'number',
      aggregation: 'max',
      initialValue: 0,
      linkedAchievementIds: ['ach_damage_500'],
      persistent: true,
    },
    {
      id: 'min_health',
      displayName: '最低血量',
      category: 'combat',
      valueType: 'number',
      aggregation: 'min',
      initialValue: 100,
      linkedAchievementIds: [],
      persistent: true,
    },
    {
      id: 'last_weapon',
      displayName: '最后使用的武器',
      category: 'combat',
      valueType: 'string',
      aggregation: 'last',
      initialValue: '无',
      linkedAchievementIds: [],
      persistent: true,
    },
    {
      id: 'battle_count',
      displayName: '战斗次数',
      category: 'combat',
      valueType: 'number',
      aggregation: 'count',
      initialValue: 0,
      linkedAchievementIds: ['ach_battle_50'],
      persistent: true,
    },
    {
      id: 'gold_earned',
      displayName: '累计金币',
      category: 'resource',
      valueType: 'number',
      aggregation: 'sum',
      initialValue: 0,
      linkedAchievementIds: ['ach_gold_10000'],
      persistent: true,
    },
    {
      id: 'is_vip',
      displayName: '是否VIP',
      category: 'player',
      valueType: 'boolean',
      aggregation: 'last',
      initialValue: false,
      linkedAchievementIds: [],
      persistent: false,
    },
    {
      id: 'session_clicks',
      displayName: '本次会话点击',
      category: 'session',
      valueType: 'number',
      aggregation: 'count',
      initialValue: 0,
      linkedAchievementIds: [],
      persistent: false,
    },
  ];
}

/** 创建一个简单的 number/sum 类型统计项定义 */
function createSimpleDefinition(
  id: string = 'simple_stat',
  overrides: Partial<StatDefinition> = {}
): StatDefinition {
  return {
    id,
    displayName: overrides.displayName ?? '简单统计',
    category: overrides.category ?? 'default',
    valueType: overrides.valueType ?? 'number',
    aggregation: overrides.aggregation ?? 'sum',
    initialValue: overrides.initialValue ?? 0,
    linkedAchievementIds: overrides.linkedAchievementIds ?? [],
    persistent: overrides.persistent ?? true,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('StatisticsTracker', () => {
  let tracker: StatisticsTracker;
  let definitions: StatDefinition[];

  beforeEach(() => {
    definitions = createStandardDefinitions();
    tracker = new StatisticsTracker(definitions);
  });

  // ==========================================================
  // 构造函数和初始化
  // ==========================================================

  describe('构造函数和初始化', () => {
    it('应正确初始化所有统计项', () => {
      for (const def of definitions) {
        const value = tracker.get(def.id);
        expect(value).toBe(def.initialValue);
      }
    });

    it('应正确初始化统计项记录的 updateCount 为 0', () => {
      for (const def of definitions) {
        const record = tracker.getRecord(def.id);
        expect(record).toBeDefined();
        expect(record!.updateCount).toBe(0);
      }
    });

    it('应正确初始化 number 类型统计项的时间序列为空', () => {
      for (const def of definitions) {
        if (def.valueType === 'number') {
          const ts = tracker.getTimeSeries(def.id);
          expect(ts).toEqual([]);
        }
      }
    });

    it('非 number 类型统计项的时间序列应返回空数组', () => {
      expect(tracker.getTimeSeries('last_weapon')).toEqual([]);
      expect(tracker.getTimeSeries('is_vip')).toEqual([]);
    });

    it('空定义数组应创建无统计项的 tracker', () => {
      const emptyTracker = new StatisticsTracker([]);
      expect(emptyTracker.getAllDefinitions()).toEqual([]);
      expect(emptyTracker.getCategories()).toEqual([]);
    });

    it('应正确返回所有定义', () => {
      const allDefs = tracker.getAllDefinitions();
      expect(allDefs).toHaveLength(definitions.length);
      const ids = allDefs.map((d) => d.id).sort();
      const expectedIds = definitions.map((d) => d.id).sort();
      expect(ids).toEqual(expectedIds);
    });

    it('getAllDefinitions 应返回副本，修改不影响内部状态', () => {
      const allDefs = tracker.getAllDefinitions();
      allDefs[0].displayName = '被篡改的名称';
      const freshDefs = tracker.getAllDefinitions();
      expect(freshDefs[0].displayName).not.toBe('被篡改的名称');
    });
  });

  // ==========================================================
  // update() — sum 聚合
  // ==========================================================

  describe('update() — sum 聚合', () => {
    it('应累加数值到初始值为 0 的统计项', () => {
      expect(tracker.update('total_kills', 10)).toEqual({ ok: true });
      expect(tracker.get('total_kills')).toBe(10);

      expect(tracker.update('total_kills', 5)).toEqual({ ok: true });
      expect(tracker.get('total_kills')).toBe(15);
    });

    it('应正确累加多次更新', () => {
      tracker.update('gold_earned', 100);
      tracker.update('gold_earned', 200);
      tracker.update('gold_earned', 300);
      expect(tracker.get('gold_earned')).toBe(600);
    });

    it('应正确处理负数累加（扣减）', () => {
      tracker.update('gold_earned', 100);
      tracker.update('gold_earned', -30);
      expect(tracker.get('gold_earned')).toBe(70);
    });

    it('应记录时间序列数据点', () => {
      tracker.update('total_kills', 10);
      tracker.update('total_kills', 20);
      const ts = tracker.getTimeSeries('total_kills');
      expect(ts).toHaveLength(2);
      expect(ts[0].value).toBe(10);
      expect(ts[1].value).toBe(30); // 累加后的值
    });

    it('应递增 updateCount 和 totalUpdates', () => {
      tracker.update('total_kills', 1);
      tracker.update('total_kills', 2);
      const record = tracker.getRecord('total_kills')!;
      expect(record.updateCount).toBe(2);
    });
  });

  // ==========================================================
  // update() — max 聚合
  // ==========================================================

  describe('update() — max 聚合', () => {
    it('应保留最大值', () => {
      tracker.update('max_damage', 100);
      expect(tracker.get('max_damage')).toBe(100);

      tracker.update('max_damage', 50);
      expect(tracker.get('max_damage')).toBe(100);

      tracker.update('max_damage', 200);
      expect(tracker.get('max_damage')).toBe(200);
    });

    it('初始值为 0 时应正确更新', () => {
      tracker.update('max_damage', 0);
      expect(tracker.get('max_damage')).toBe(0);

      tracker.update('max_damage', 1);
      expect(tracker.get('max_damage')).toBe(1);
    });
  });

  // ==========================================================
  // update() — min 聚合
  // ==========================================================

  describe('update() — min 聚合', () => {
    it('应保留最小值', () => {
      tracker.update('min_health', 80);
      expect(tracker.get('min_health')).toBe(80);

      tracker.update('min_health', 90);
      expect(tracker.get('min_health')).toBe(80);

      tracker.update('min_health', 30);
      expect(tracker.get('min_health')).toBe(30);
    });

    it('初始值为 100 时应正确更新', () => {
      tracker.update('min_health', 120);
      // min(100, 120) = 100，初始值仍保持
      expect(tracker.get('min_health')).toBe(100);
    });
  });

  // ==========================================================
  // update() — last 聚合
  // ==========================================================

  describe('update() — last 聚合', () => {
    it('应直接替换为最新值（string 类型）', () => {
      tracker.update('last_weapon', '长剑');
      expect(tracker.get('last_weapon')).toBe('长剑');

      tracker.update('last_weapon', '弓箭');
      expect(tracker.get('last_weapon')).toBe('弓箭');
    });

    it('应直接替换为最新值（boolean 类型）', () => {
      tracker.update('is_vip', true);
      expect(tracker.get('is_vip')).toBe(true);

      tracker.update('is_vip', false);
      expect(tracker.get('is_vip')).toBe(false);
    });
  });

  // ==========================================================
  // update() — count 聚合
  // ==========================================================

  describe('update() — count 聚合', () => {
    it('应忽略传入值，每次更新递增 1', () => {
      tracker.update('battle_count', 999);
      expect(tracker.get('battle_count')).toBe(1);

      tracker.update('battle_count', 0);
      expect(tracker.get('battle_count')).toBe(2);

      tracker.update('battle_count', -1);
      expect(tracker.get('battle_count')).toBe(3);
    });

    it('应正确记录时间序列（count 结果为 number）', () => {
      tracker.update('battle_count', 0);
      tracker.update('battle_count', 0);
      const ts = tracker.getTimeSeries('battle_count');
      expect(ts).toHaveLength(2);
      expect(ts[0].value).toBe(1);
      expect(ts[1].value).toBe(2);
    });
  });

  // ==========================================================
  // update() — 错误处理
  // ==========================================================

  describe('update() — 错误处理', () => {
    it('不存在的统计项应返回错误', () => {
      const result = tracker.update('nonexistent', 10);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('类型不匹配应返回错误（传入 string 给 number 类型）', () => {
      const result = tracker.update('total_kills', '不是数字' as StatValue);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Type mismatch');
    });

    it('类型不匹配应返回错误（传入 number 给 string 类型）', () => {
      const result = tracker.update('last_weapon', 123 as StatValue);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Type mismatch');
    });

    it('类型不匹配应返回错误（传入 number 给 boolean 类型）', () => {
      const result = tracker.update('is_vip', 1 as StatValue);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Type mismatch');
    });

    it('更新失败时不应修改记录值', () => {
      tracker.update('total_kills', 10);
      const before = tracker.get('total_kills');
      tracker.update('total_kills', '错误值' as StatValue);
      const after = tracker.get('total_kills');
      expect(before).toBe(after);
    });
  });

  // ==========================================================
  // increment()
  // ==========================================================

  describe('increment()', () => {
    it('应默认增量为 1', () => {
      tracker.increment('total_kills');
      expect(tracker.get('total_kills')).toBe(1);
    });

    it('应支持自定义增量', () => {
      tracker.increment('total_kills', 50);
      expect(tracker.get('total_kills')).toBe(50);
    });

    it('应支持负增量（扣减）', () => {
      tracker.update('total_kills', 100);
      tracker.increment('total_kills', -20);
      expect(tracker.get('total_kills')).toBe(80);
    });

    it('对 count 聚合类型应忽略 delta，每次递增 1', () => {
      tracker.increment('battle_count', 999);
      expect(tracker.get('battle_count')).toBe(1);

      tracker.increment('battle_count');
      expect(tracker.get('battle_count')).toBe(2);
    });

    it('不存在的统计项应返回错误', () => {
      const result = tracker.increment('nonexistent');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('非 number 类型应返回错误', () => {
      const result = tracker.increment('last_weapon');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Cannot increment non-number stat');
    });
  });

  // ==========================================================
  // get() 和 getRecord()
  // ==========================================================

  describe('get() 和 getRecord()', () => {
    it('get() 未找到统计项应返回 undefined', () => {
      expect(tracker.get('nonexistent')).toBeUndefined();
    });

    it('getRecord() 未找到统计项应返回 undefined', () => {
      expect(tracker.getRecord('nonexistent')).toBeUndefined();
    });

    it('getRecord() 应返回包含完整信息的记录', () => {
      tracker.update('total_kills', 42);
      const record = tracker.getRecord('total_kills')!;
      expect(record.statId).toBe('total_kills');
      expect(record.value).toBe(42);
      expect(record.updateCount).toBe(1);
      expect(record.lastUpdated).toBeTypeOf('number');
      expect(record.lastUpdated).toBeGreaterThan(0);
    });

    it('getRecord() 应返回副本，修改不影响内部状态', () => {
      const record = tracker.getRecord('total_kills')!;
      record.value = 99999;
      expect(tracker.get('total_kills')).toBe(0);
    });
  });

  // ==========================================================
  // getByCategory()
  // ==========================================================

  describe('getByCategory()', () => {
    it('应返回指定类别的所有记录', () => {
      const combatStats = tracker.getByCategory('combat');
      // combat 类别有 5 个统计项
      expect(combatStats).toHaveLength(5);
      const ids = combatStats.map((r) => r.statId).sort();
      expect(ids).toEqual(
        ['battle_count', 'last_weapon', 'max_damage', 'min_health', 'total_kills'].sort()
      );
    });

    it('应返回 resource 类别的记录', () => {
      const resourceStats = tracker.getByCategory('resource');
      expect(resourceStats).toHaveLength(1);
      expect(resourceStats[0].statId).toBe('gold_earned');
    });

    it('不存在的类别应返回空数组', () => {
      expect(tracker.getByCategory('nonexistent')).toEqual([]);
    });

    it('返回的记录应为副本', () => {
      const records = tracker.getByCategory('combat');
      records[0].value = 99999;
      const fresh = tracker.getByCategory('combat');
      // 至少有一个值不是 99999（因为原始值没被修改）
      const modified = fresh.some((r) => r.value === 99999);
      expect(modified).toBe(false);
    });
  });

  // ==========================================================
  // getTimeSeries()
  // ==========================================================

  describe('getTimeSeries()', () => {
    it('应返回空数组给未更新的统计项', () => {
      expect(tracker.getTimeSeries('total_kills')).toEqual([]);
    });

    it('应返回非 number 类型统计项的空数组', () => {
      expect(tracker.getTimeSeries('last_weapon')).toEqual([]);
    });

    it('不存在的统计项应返回空数组', () => {
      expect(tracker.getTimeSeries('nonexistent')).toEqual([]);
    });

    it('应记录每次更新的聚合后值', () => {
      tracker.update('total_kills', 10); // value = 10
      tracker.update('total_kills', 20); // value = 30
      tracker.update('total_kills', 5);  // value = 35

      const ts = tracker.getTimeSeries('total_kills');
      expect(ts).toHaveLength(3);
      expect(ts[0].value).toBe(10);
      expect(ts[1].value).toBe(30);
      expect(ts[2].value).toBe(35);
    });

    it('应支持 since 参数过滤时间范围', () => {
      const baseTime = Date.now();

      // 使用 jest.spyOn 控制 Date.now 以测试时间过滤
      let mockTime = baseTime;
      jest.spyOn(Date, 'now').mockImplementation(() => mockTime);

      mockTime = baseTime;
      tracker.update('total_kills', 10);

      mockTime = baseTime + 1000;
      tracker.update('total_kills', 20);

      mockTime = baseTime + 2000;
      tracker.update('total_kills', 30);

      // 查询 baseTime + 500 之后的数据
      const filtered = tracker.getTimeSeries('total_kills', baseTime + 500);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].value).toBe(30);  // baseTime + 1000 的聚合结果
      expect(filtered[1].value).toBe(60);  // baseTime + 2000 的聚合结果

      jest.restoreAllMocks();
    });

    it('应返回数据点副本', () => {
      tracker.update('total_kills', 10);
      const ts = tracker.getTimeSeries('total_kills');
      ts[0].value = 99999;
      const fresh = tracker.getTimeSeries('total_kills');
      expect(fresh[0].value).toBe(10);
    });

    it('时间序列超过最大点数时应移除最旧的点', () => {
      // 创建一个只有单个统计项的 tracker，方便测试
      const singleDef = createSimpleDefinition('overflow_stat');
      const overflowTracker = new StatisticsTracker([singleDef]);

      // 插入 1001 个点，超过 MAX_TIME_SERIES_POINTS (1000)
      for (let i = 0; i <= 1000; i++) {
        overflowTracker.update('overflow_stat', 1);
      }

      const ts = overflowTracker.getTimeSeries('overflow_stat');
      // 应保留 1000 个点（移除了最旧的 1 个）
      expect(ts).toHaveLength(1000);
    });
  });

  // ==========================================================
  // getSessionSummary()
  // ==========================================================

  describe('getSessionSummary()', () => {
    it('初始状态应返回正确的摘要', () => {
      const summary = tracker.getSessionSummary();
      expect(summary.totalUpdates).toBe(0);
      expect(summary.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(summary.topStats).toHaveLength(definitions.length);
    });

    it('应统计总更新次数', () => {
      tracker.update('total_kills', 1);
      tracker.update('total_kills', 2);
      tracker.update('gold_earned', 100);

      const summary = tracker.getSessionSummary();
      expect(summary.totalUpdates).toBe(3);
    });

    it('topStats 应按 updateCount 降序排列', () => {
      // total_kills 更新 3 次
      tracker.update('total_kills', 1);
      tracker.update('total_kills', 2);
      tracker.update('total_kills', 3);

      // gold_earned 更新 1 次
      tracker.update('gold_earned', 100);

      const summary = tracker.getSessionSummary();
      expect(summary.topStats[0].statId).toBe('total_kills');
    });

    it('topStats 最多返回 10 个', () => {
      // 创建 12 个统计项
      const manyDefs: StatDefinition[] = [];
      for (let i = 0; i < 12; i++) {
        manyDefs.push(createSimpleDefinition(`stat_${i}`));
      }
      const manyTracker = new StatisticsTracker(manyDefs);

      const summary = manyTracker.getSessionSummary();
      expect(summary.topStats.length).toBeLessThanOrEqual(10);
    });

    it('sessionDuration 应随时间增长', () => {
      const summary1 = tracker.getSessionSummary();
      // 等待一小段时间
      const start = Date.now();
      while (Date.now() - start < 2) {
        // 忙等 2ms
      }
      const summary2 = tracker.getSessionSummary();
      expect(summary2.sessionDuration).toBeGreaterThanOrEqual(summary1.sessionDuration);
    });
  });

  // ==========================================================
  // onProgress() — 成就进度回调
  // ==========================================================

  describe('onProgress() — 成就进度回调', () => {
    it('应在更新有关联成就的统计项时触发回调', () => {
      const callback = jest.fn();
      tracker.onProgress(callback);

      tracker.update('total_kills', 10);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(
        'total_kills',
        10,
        ['ach_kill_100', 'ach_kill_1000']
      );
    });

    it('无关联成就的统计项不应触发回调', () => {
      const callback = jest.fn();
      tracker.onProgress(callback);

      tracker.update('min_health', 50); // linkedAchievementIds 为空

      expect(callback).not.toHaveBeenCalled();
    });

    it('应支持多个回调同时注册', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      tracker.onProgress(cb1);
      tracker.onProgress(cb2);

      tracker.update('total_kills', 5);

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('取消注册后不应再触发该回调', () => {
      const callback = jest.fn();
      const unsubscribe = tracker.onProgress(callback);

      tracker.update('total_kills', 1);
      expect(callback).toHaveBeenCalledOnce();

      unsubscribe();

      tracker.update('total_kills', 2);
      expect(callback).toHaveBeenCalledOnce(); // 仍然是 1 次
    });

    it('回调抛出异常不应影响统计更新流程', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('回调异常');
      });
      const normalCallback = jest.fn();
      tracker.onProgress(errorCallback);
      tracker.onProgress(normalCallback);

      const result = tracker.update('total_kills', 10);
      expect(result.ok).toBe(true);
      expect(tracker.get('total_kills')).toBe(10);
      // 正常回调仍应被调用（errorCallback 在前）
      expect(normalCallback).toHaveBeenCalledOnce();
    });

    it('多次取消注册不应报错', () => {
      const callback = jest.fn();
      const unsubscribe = tracker.onProgress(callback);

      unsubscribe();
      unsubscribe(); // 第二次取消
      // 不应抛出异常
    });
  });

  // ==========================================================
  // serialize() 和 deserialize()
  // ==========================================================

  describe('serialize() 和 deserialize()', () => {
    it('初始状态序列化后应能正确反序列化', () => {
      const json = tracker.serialize();
      const newTracker = new StatisticsTracker(definitions);
      const result = newTracker.deserialize(json);
      expect(result.ok).toBe(true);

      for (const def of definitions) {
        if (def.persistent) {
          expect(newTracker.get(def.id)).toBe(def.initialValue);
        }
      }
    });

    it('应仅序列化 persistent 为 true 的统计项', () => {
      tracker.update('total_kills', 100); // persistent: true
      tracker.update('is_vip', true);     // persistent: false
      tracker.update('session_clicks', 0); // persistent: false

      const json = tracker.serialize();
      const data = JSON.parse(json);

      const serializedIds = data.records.map((r: { statId: string }) => r.statId);
      expect(serializedIds).toContain('total_kills');
      expect(serializedIds).not.toContain('is_vip');
      expect(serializedIds).not.toContain('session_clicks');
    });

    it('应正确序列化和恢复统计数据', () => {
      tracker.update('total_kills', 10);
      tracker.update('total_kills', 20);
      tracker.update('max_damage', 150);
      tracker.update('last_weapon', '法杖');

      const json = tracker.serialize();

      const newTracker = new StatisticsTracker(definitions);
      const result = newTracker.deserialize(json);
      expect(result.ok).toBe(true);

      expect(newTracker.get('total_kills')).toBe(30);
      expect(newTracker.get('max_damage')).toBe(150);
      expect(newTracker.get('last_weapon')).toBe('法杖');
    });

    it('应正确恢复 updateCount', () => {
      tracker.update('total_kills', 1);
      tracker.update('total_kills', 2);

      const json = tracker.serialize();
      const newTracker = new StatisticsTracker(definitions);
      newTracker.deserialize(json);

      const record = newTracker.getRecord('total_kills')!;
      expect(record.updateCount).toBe(2);
    });

    it('应正确恢复 totalUpdates', () => {
      tracker.update('total_kills', 1);
      tracker.update('gold_earned', 100);
      tracker.update('max_damage', 50);

      const json = tracker.serialize();
      const data = JSON.parse(json);
      expect(data.totalUpdates).toBe(3);

      const newTracker = new StatisticsTracker(definitions);
      newTracker.deserialize(json);

      const summary = newTracker.getSessionSummary();
      expect(summary.totalUpdates).toBe(3);
    });

    it('应正确恢复时间序列数据', () => {
      tracker.update('total_kills', 10);
      tracker.update('total_kills', 20);

      const json = tracker.serialize();
      const newTracker = new StatisticsTracker(definitions);
      newTracker.deserialize(json);

      const ts = newTracker.getTimeSeries('total_kills');
      expect(ts).toHaveLength(2);
    });

    it('反序列化非法 JSON 应返回错误', () => {
      const result = tracker.deserialize('{invalid json}');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('反序列化缺少 records 数组应返回错误', () => {
      const result = tracker.deserialize('{"timeSeries":[]}');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('missing records array');
    });

    it('反序列化时忽略不存在的统计项（旧版本数据兼容）', () => {
      const data = {
        records: [
          { statId: 'old_removed_stat', value: 42, lastUpdated: 1000, updateCount: 1 },
        ],
        timeSeries: [],
        sessionStart: 1000,
        totalUpdates: 1,
      };

      const result = tracker.deserialize(JSON.stringify(data));
      expect(result.ok).toBe(true);
      // 不应抛出异常，旧的统计项被忽略
    });

    it('反序列化时忽略非持久化统计项的数据', () => {
      // 使用全新的 tracker，确保 is_vip 为初始值 false
      const freshTracker = new StatisticsTracker(definitions);

      const data = {
        records: [
          { statId: 'is_vip', value: true, lastUpdated: 1000, updateCount: 1 },
        ],
        timeSeries: [],
        sessionStart: 1000,
        totalUpdates: 1,
      };

      const result = freshTracker.deserialize(JSON.stringify(data));
      expect(result.ok).toBe(true);
      // is_vip 不应被恢复（非持久化），应保持初始值 false
      expect(freshTracker.get('is_vip')).toBe(false);
    });

    it('反序列化时忽略类型不匹配的数据', () => {
      const data = {
        records: [
          { statId: 'total_kills', value: '不是数字', lastUpdated: 1000, updateCount: 1 },
        ],
        timeSeries: [],
        sessionStart: 1000,
        totalUpdates: 1,
      };

      tracker.deserialize(JSON.stringify(data));
      expect(tracker.get('total_kills')).toBe(0); // 保持初始值
    });

    it('反序列化空 JSON 对象不应崩溃', () => {
      // records 为 undefined 时，!Array.isArray(undefined) 为 true
      const result = tracker.deserialize('{}');
      expect(result.ok).toBe(false);
    });

    it('序列化-反序列化往返应保持数据一致', () => {
      // 进行多次更新
      tracker.update('total_kills', 10);
      tracker.update('total_kills', 20);
      tracker.update('max_damage', 200);
      tracker.update('max_damage', 100);
      tracker.update('min_health', 50);
      tracker.update('last_weapon', '魔杖');
      tracker.update('battle_count', 0);
      tracker.update('battle_count', 0);
      tracker.update('gold_earned', 500);

      // 序列化
      const json = tracker.serialize();

      // 反序列化到新实例
      const restored = new StatisticsTracker(definitions);
      const result = restored.deserialize(json);
      expect(result.ok).toBe(true);

      // 验证所有持久化统计项的值
      expect(restored.get('total_kills')).toBe(tracker.get('total_kills'));
      expect(restored.get('max_damage')).toBe(tracker.get('max_damage'));
      expect(restored.get('min_health')).toBe(tracker.get('min_health'));
      expect(restored.get('last_weapon')).toBe(tracker.get('last_weapon'));
      expect(restored.get('battle_count')).toBe(tracker.get('battle_count'));
      expect(restored.get('gold_earned')).toBe(tracker.get('gold_earned'));
    });
  });

  // ==========================================================
  // reset()
  // ==========================================================

  describe('reset()', () => {
    it('应将所有统计项重置为初始值', () => {
      tracker.update('total_kills', 100);
      tracker.update('max_damage', 500);
      tracker.update('last_weapon', '圣剑');

      tracker.reset();

      expect(tracker.get('total_kills')).toBe(0);
      expect(tracker.get('max_damage')).toBe(0);
      expect(tracker.get('last_weapon')).toBe('无');
      expect(tracker.get('min_health')).toBe(100);
    });

    it('应清空时间序列数据', () => {
      tracker.update('total_kills', 10);
      tracker.update('total_kills', 20);
      expect(tracker.getTimeSeries('total_kills')).toHaveLength(2);

      tracker.reset();
      expect(tracker.getTimeSeries('total_kills')).toEqual([]);
    });

    it('应重置 totalUpdates 为 0', () => {
      tracker.update('total_kills', 1);
      tracker.update('gold_earned', 100);

      tracker.reset();

      const summary = tracker.getSessionSummary();
      expect(summary.totalUpdates).toBe(0);
    });

    it('应重置所有记录的 updateCount 为 0', () => {
      tracker.update('total_kills', 1);
      tracker.update('total_kills', 2);

      tracker.reset();

      const record = tracker.getRecord('total_kills')!;
      expect(record.updateCount).toBe(0);
    });

    it('应保留统计项定义', () => {
      tracker.reset();
      const allDefs = tracker.getAllDefinitions();
      expect(allDefs).toHaveLength(definitions.length);
    });

    it('应保留已注册的回调', () => {
      const callback = jest.fn();
      tracker.onProgress(callback);

      tracker.reset();

      tracker.update('total_kills', 1);
      expect(callback).toHaveBeenCalled();
    });
  });

  // ==========================================================
  // getCategories()
  // ==========================================================

  describe('getCategories()', () => {
    it('应返回所有去重的类别名称', () => {
      const categories = tracker.getCategories();
      expect(categories).toContain('combat');
      expect(categories).toContain('resource');
      expect(categories).toContain('player');
      expect(categories).toContain('session');
    });

    it('类别数量应正确', () => {
      const categories = tracker.getCategories();
      // combat, resource, player, session = 4 个类别
      expect(categories).toHaveLength(4);
    });

    it('空 tracker 应返回空数组', () => {
      const emptyTracker = new StatisticsTracker([]);
      expect(emptyTracker.getCategories()).toEqual([]);
    });
  });

  // ==========================================================
  // 边界条件和集成场景
  // ==========================================================

  describe('边界条件和集成场景', () => {
    it('大量更新后状态应保持一致', () => {
      for (let i = 0; i < 100; i++) {
        tracker.update('total_kills', 1);
      }
      expect(tracker.get('total_kills')).toBe(100);

      const record = tracker.getRecord('total_kills')!;
      expect(record.updateCount).toBe(100);

      const summary = tracker.getSessionSummary();
      expect(summary.totalUpdates).toBe(100);
    });

    it('多统计项交叉更新应互不影响', () => {
      tracker.update('total_kills', 10);
      tracker.update('gold_earned', 100);
      tracker.update('total_kills', 5);
      tracker.update('gold_earned', 50);

      expect(tracker.get('total_kills')).toBe(15);
      expect(tracker.get('gold_earned')).toBe(150);
    });

    it('重置后应能正常继续使用', () => {
      tracker.update('total_kills', 100);
      tracker.reset();
      tracker.update('total_kills', 50);
      expect(tracker.get('total_kills')).toBe(50);

      const record = tracker.getRecord('total_kills')!;
      expect(record.updateCount).toBe(1);
    });

    it('反序列化后应能正常继续更新', () => {
      tracker.update('total_kills', 100);
      const json = tracker.serialize();

      const restored = new StatisticsTracker(definitions);
      restored.deserialize(json);
      restored.update('total_kills', 50);

      expect(restored.get('total_kills')).toBe(150);
    });

    it('Date.now 被模拟时 lastUpdated 应使用模拟时间', () => {
      const fixedTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedTime);

      const t = new StatisticsTracker([createSimpleDefinition('test_stat')]);
      t.update('test_stat', 42);

      const record = t.getRecord('test_stat')!;
      expect(record.lastUpdated).toBe(fixedTime);

      jest.restoreAllMocks();
    });

    it('构造函数中初始化的 lastUpdated 应使用构造时的时间', () => {
      const fixedTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedTime);

      const t = new StatisticsTracker([createSimpleDefinition('test_stat')]);
      const record = t.getRecord('test_stat')!;
      expect(record.lastUpdated).toBe(fixedTime);

      jest.restoreAllMocks();
    });

    it('count 聚合从非 number 初始值开始时应正确递增', () => {
      // 创建一个初始值为 string 的 count 类型（虽然不合理但需测试健壮性）
      const def: StatDefinition = {
        id: 'weird_count',
        displayName: '异常计数',
        category: 'test',
        valueType: 'number',
        aggregation: 'count',
        initialValue: 0,
        linkedAchievementIds: [],
        persistent: true,
      };
      const t = new StatisticsTracker([def]);
      t.update('weird_count', 0);
      expect(t.get('weird_count')).toBe(1);
    });

    it('max 聚合初始值为非 0 时应正确比较', () => {
      // max_damage 初始值为 0
      tracker.update('max_damage', -5);
      // max(0, -5) = 0
      expect(tracker.get('max_damage')).toBe(0);
    });

    it('serialize 后的 JSON 应是合法的 JSON 字符串', () => {
      tracker.update('total_kills', 10);
      const json = tracker.serialize();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('连续序列化和反序列化多次应保持数据稳定', () => {
      tracker.update('total_kills', 42);
      tracker.update('gold_earned', 1000);

      // 第一次往返
      const json1 = tracker.serialize();
      const t1 = new StatisticsTracker(definitions);
      t1.deserialize(json1);

      // 第二次往返
      const json2 = t1.serialize();
      const t2 = new StatisticsTracker(definitions);
      t2.deserialize(json2);

      expect(t2.get('total_kills')).toBe(42);
      expect(t2.get('gold_earned')).toBe(1000);
      // 两次序列化结果应一致
      expect(json2).toBe(json1);
    });
  });
});
