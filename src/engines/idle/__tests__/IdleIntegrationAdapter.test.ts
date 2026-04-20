/**
 * IdleIntegrationAdapter 单元测试
 *
 * 覆盖范围：
 * - constructor() 构造函数
 * - initialize() 初始化（依赖验证、批量初始化）
 * - update() 批量更新
 * - snapshot() / restore() 快照与恢复
 * - reset() 重置
 * - connectModuleEvents() 自动事件连接
 * - disconnectModuleEvents() 断开事件连接
 * - 防御性编程（模块不存在时的行为）
 * - 集成场景测试
 */

import { ModuleRegistry } from '../modules/ModuleRegistry';
import { ModuleEventBus } from '../modules/ModuleEventBus';
import { IdleIntegrationAdapter } from '../modules/IdleIntegrationAdapter';
import type { RegistrySnapshot } from '../modules/ModuleRegistry';

// ============================================================
// 测试用辅助工具
// ============================================================

/** 创建模拟的建筑系统 */
function createMockBuildingSystem() {
  return {
    init: jest.fn(),
    update: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ buildings: [] })),
    setState: jest.fn(),
  };
}

/** 创建模拟的统计追踪器 */
function createMockStatisticsTracker() {
  const stats = {
    init: jest.fn(),
    update: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ stats: {} })),
    setState: jest.fn(),
    increment: jest.fn(),
  };
  return stats;
}

/** 创建模拟的单位系统 */
function createMockUnitSystem() {
  return {
    init: jest.fn(),
    update: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ units: [] })),
    setState: jest.fn(),
  };
}

/** 创建模拟的声望系统 */
function createMockPrestigeSystem() {
  return {
    init: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ currency: 0, count: 0 })),
    setState: jest.fn(),
  };
}

/** 创建模拟的战斗系统 */
function createMockBattleSystem() {
  return {
    init: jest.fn(),
    update: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ battles: [] })),
    setState: jest.fn(),
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('IdleIntegrationAdapter', () => {
  let registry: ModuleRegistry;
  let eventBus: ModuleEventBus;
  let adapter: IdleIntegrationAdapter;

  beforeEach(() => {
    registry = new ModuleRegistry();
    eventBus = new ModuleEventBus();
    adapter = new IdleIntegrationAdapter(registry, eventBus);
  });

  // ========== constructor ==========

  describe('constructor()', () => {
    it('应正确创建适配器实例', () => {
      expect(adapter).toBeDefined();
    });

    it('初始状态应为未初始化', () => {
      expect(adapter.isInitialized()).toBe(false);
    });
  });

  // ========== initialize() ==========

  describe('initialize()', () => {
    it('应成功初始化无依赖的模块', () => {
      const mod = { init: jest.fn() };
      registry.register({ id: 'simple', name: '简单模块', version: '1.0.0', module: mod });

      adapter.initialize();

      expect(mod.init).toHaveBeenCalledTimes(1);
      expect(adapter.isInitialized()).toBe(true);
    });

    it('应在依赖不满足时抛出错误', () => {
      registry.register({
        id: 'dependent',
        name: '依赖模块',
        version: '1.0.0',
        dependencies: ['missing-module'],
        module: { init: jest.fn() },
      });

      expect(() => adapter.initialize()).toThrow('依赖未满足');
    });

    it('应在依赖满足时正常初始化', () => {
      const modA = { init: jest.fn() };
      const modB = { init: jest.fn() };

      registry.register({ id: 'a', name: '模块A', version: '1.0.0', module: modA });
      registry.register({
        id: 'b',
        name: '模块B',
        version: '1.0.0',
        dependencies: ['a'],
        module: modB,
      });

      adapter.initialize();

      expect(modA.init).toHaveBeenCalledTimes(1);
      expect(modB.init).toHaveBeenCalledTimes(1);
    });

    it('应跳过不支持 init 的模块', () => {
      registry.register({ id: 'no-init', name: '无初始化模块', version: '1.0.0', module: {} });

      expect(() => adapter.initialize()).not.toThrow();
      expect(adapter.isInitialized()).toBe(true);
    });
  });

  // ========== update() ==========

  describe('update()', () => {
    it('应调用所有支持 update 的模块', () => {
      const modA = { update: jest.fn() };
      const modB = { update: jest.fn() };

      registry.register({ id: 'a', name: '模块A', version: '1.0.0', module: modA });
      registry.register({ id: 'b', name: '模块B', version: '1.0.0', module: modB });

      adapter.update(0.016);

      expect(modA.update).toHaveBeenCalledWith(0.016);
      expect(modB.update).toHaveBeenCalledWith(0.016);
    });

    it('应跳过不支持 update 的模块', () => {
      registry.register({ id: 'no-update', name: '无更新模块', version: '1.0.0', module: {} });

      expect(() => adapter.update(1)).not.toThrow();
    });
  });

  // ========== snapshot() & restore() ==========

  describe('snapshot()', () => {
    it('应生成包含所有模块状态的快照', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'statistics', name: '统计追踪', version: '1.0.0', module: stats });

      const snap = adapter.snapshot();

      expect(snap.version).toBe('1.0.0');
      expect(snap.timestamp).toBeGreaterThan(0);
      expect(snap.modules).toHaveLength(1);
      expect(snap.modules[0].moduleId).toBe('statistics');
    });

    it('无模块时应生成空快照', () => {
      const snap = adapter.snapshot();
      expect(snap.modules).toEqual([]);
    });
  });

  describe('restore()', () => {
    it('应恢复模块状态', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'statistics', name: '统计追踪', version: '1.0.0', module: stats });

      const snapshot: RegistrySnapshot = {
        version: '1.0.0',
        timestamp: Date.now(),
        modules: [{ moduleId: 'statistics', state: { stats: { kills: 100 } } }],
      };

      adapter.restore(snapshot);
      expect(stats.setState).toHaveBeenCalledWith({ stats: { kills: 100 } });
    });
  });

  describe('快照往返测试', () => {
    it('snapshot → restore 应保持数据一致', () => {
      const stats = createMockStatisticsTracker();
      stats.getState.mockReturnValue({ stats: { kills: 100 } });
      registry.register({ id: 'statistics', name: '统计追踪', version: '1.0.0', module: stats });

      const snap = adapter.snapshot();

      // 重置 mock
      stats.setState.mockClear();
      adapter.restore(snap);

      expect(stats.setState).toHaveBeenCalledWith({ stats: { kills: 100 } });
    });
  });

  // ========== reset() ==========

  describe('reset()', () => {
    it('应重置所有模块', () => {
      const mod = { reset: jest.fn() };
      registry.register({ id: 'mod', name: '模块', version: '1.0.0', module: mod });

      adapter.reset();
      expect(mod.reset).toHaveBeenCalledTimes(1);
    });

    it('应将初始化状态设为 false', () => {
      adapter.initialize();
      adapter.reset();
      expect(adapter.isInitialized()).toBe(false);
    });

    it('应清除事件连接', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      expect(adapter.getConnectionCount()).toBeGreaterThan(0);

      adapter.reset();
      expect(adapter.getConnectionCount()).toBe(0);
    });
  });

  // ========== connectModuleEvents() ==========

  describe('connectModuleEvents()', () => {
    it('应将 building_upgraded 事件连接到统计追踪器', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      eventBus.publish('building_upgraded', 'building', { id: 'mine' });

      expect(stats.increment).toHaveBeenCalledWith('buildingUpgrades');
    });

    it('应将 unit_unlocked 事件连接到统计追踪器', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'unit', name: '角色', version: '1.0.0', module: createMockUnitSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      eventBus.publish('unit_unlocked', 'unit', { id: 'warrior' });

      expect(stats.increment).toHaveBeenCalledWith('unitsUnlocked');
    });

    it('应将 prestige_completed 事件连接到统计追踪器', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'prestige', name: '声望', version: '1.0.0', module: createMockPrestigeSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      eventBus.publish('prestige_completed', 'prestige', { currency: 10 });

      expect(stats.increment).toHaveBeenCalledWith('prestigeCount');
    });

    it('应将 battle_completed 事件连接到统计追踪器', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'battle', name: '战斗', version: '1.0.0', module: createMockBattleSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      eventBus.publish('battle_completed', 'battle', { victory: true });

      expect(stats.increment).toHaveBeenCalledWith('battlesWon');
    });

    it('统计追踪器不存在时不应连接任何事件', () => {
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });

      adapter.connectModuleEvents();
      expect(adapter.getConnectionCount()).toBe(0);
    });

    it('统计追踪器无 increment 方法时不应连接', () => {
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: {} }); // 无 increment

      adapter.connectModuleEvents();
      expect(adapter.getConnectionCount()).toBe(0);
    });

    it('源模块不存在时不应连接对应事件', () => {
      const stats = createMockStatisticsTracker();
      // 只注册统计追踪器，不注册建筑系统
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      eventBus.publish('building_upgraded', 'building', {});

      expect(stats.increment).not.toHaveBeenCalled();
    });

    it('应返回正确的连接数', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'unit', name: '角色', version: '1.0.0', module: createMockUnitSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      expect(adapter.getConnectionCount()).toBe(2);
    });

    it('重复调用应先清除旧连接', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      adapter.connectModuleEvents(); // 第二次调用

      eventBus.publish('building_upgraded', 'building', {});
      // 不应重复调用（因为旧连接已清除）
      expect(stats.increment).toHaveBeenCalledTimes(1);
    });
  });

  // ========== disconnectModuleEvents() ==========

  describe('disconnectModuleEvents()', () => {
    it('应断开所有事件连接', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      expect(adapter.getConnectionCount()).toBeGreaterThan(0);

      adapter.disconnectModuleEvents();
      expect(adapter.getConnectionCount()).toBe(0);

      eventBus.publish('building_upgraded', 'building', {});
      expect(stats.increment).not.toHaveBeenCalled();
    });

    it('无连接时调用不应报错', () => {
      expect(() => adapter.disconnectModuleEvents()).not.toThrow();
    });
  });

  // ========== 集成场景 ==========

  describe('完整集成场景', () => {
    it('应支持完整的初始化 → 事件连接 → 更新 → 快照流程', () => {
      const building = createMockBuildingSystem();
      const stats = createMockStatisticsTracker();

      registry.register({ id: 'building', name: '建筑系统', version: '1.0.0', module: building });
      registry.register({ id: 'statistics', name: '统计追踪', version: '1.0.0', module: stats });

      // 初始化
      adapter.initialize();
      expect(adapter.isInitialized()).toBe(true);

      // 连接事件
      adapter.connectModuleEvents();

      // 模拟建筑升级事件
      eventBus.publish('building_upgraded', 'building', { buildingId: 'mine', newLevel: 3 });
      expect(stats.increment).toHaveBeenCalledWith('buildingUpgrades');

      // 更新
      adapter.update(0.016);
      expect(building.update).toHaveBeenCalledWith(0.016);
      expect(stats.update).toHaveBeenCalledWith(0.016);

      // 快照
      const snap = adapter.snapshot();
      expect(snap.modules).toHaveLength(2);
    });

    it('应支持重置后重新初始化', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'statistics', name: '统计追踪', version: '1.0.0', module: stats });

      adapter.initialize();
      adapter.connectModuleEvents();
      adapter.reset();

      expect(adapter.isInitialized()).toBe(false);
      expect(adapter.getConnectionCount()).toBe(0);

      // 重新初始化
      adapter.initialize();
      expect(adapter.isInitialized()).toBe(true);
    });
  });

  // ========== 状态查询 ==========

  describe('isInitialized()', () => {
    it('初始状态应为 false', () => {
      expect(adapter.isInitialized()).toBe(false);
    });

    it('初始化后应为 true', () => {
      adapter.initialize();
      expect(adapter.isInitialized()).toBe(true);
    });

    it('重置后应为 false', () => {
      adapter.initialize();
      adapter.reset();
      expect(adapter.isInitialized()).toBe(false);
    });
  });

  describe('getConnectionCount()', () => {
    it('初始应为 0', () => {
      expect(adapter.getConnectionCount()).toBe(0);
    });

    it('连接后应正确反映数量', () => {
      const stats = createMockStatisticsTracker();
      registry.register({ id: 'building', name: '建筑', version: '1.0.0', module: createMockBuildingSystem() });
      registry.register({ id: 'unit', name: '角色', version: '1.0.0', module: createMockUnitSystem() });
      registry.register({ id: 'prestige', name: '声望', version: '1.0.0', module: createMockPrestigeSystem() });
      registry.register({ id: 'battle', name: '战斗', version: '1.0.0', module: createMockBattleSystem() });
      registry.register({ id: 'statistics', name: '统计', version: '1.0.0', module: stats });

      adapter.connectModuleEvents();
      expect(adapter.getConnectionCount()).toBe(4);
    });
  });
});
