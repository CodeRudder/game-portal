/**
 * BuildingSystem 单元测试
 */
import {
  BuildingSystem,
  type BuildingDef,
  type BuildingEvent,
  type BuildingSystemConfig,
} from '../engines/idle/modules/BuildingSystem';

// ============================================================
// 测试用建筑定义
// ============================================================

/** 渔夫小屋 — 初始解锁 */
const FISHERMAN: BuildingDef = {
  id: 'fisherman',
  name: '渔夫小屋',
  icon: '🏠',
  baseCost: { gold: 10 },
  costMultiplier: 1.15,
  maxLevel: 5,
  productionResource: 'fish',
  baseProduction: 1,
};

/** 鱼塘 — 需要 fisherman 解锁 */
const FISH_POND: BuildingDef = {
  id: 'fish_pond',
  name: '鱼塘',
  icon: '🎣',
  baseCost: { gold: 50, fish: 20 },
  costMultiplier: 1.25,
  maxLevel: 10,
  productionResource: 'fish',
  baseProduction: 3,
  requires: ['fisherman'],
};

/** 船坞 — 需要 fish_pond 解锁 */
const DOCK: BuildingDef = {
  id: 'dock',
  name: '船坞',
  icon: '⚓',
  baseCost: { gold: 200 },
  costMultiplier: 1.4,
  maxLevel: 0, // 无上限
  productionResource: 'pearl',
  baseProduction: 0.5,
  requires: ['fish_pond'],
};

/** 珍珠工坊 — 需要 dock 解锁 */
const PEARL_WORKSHOP: BuildingDef = {
  id: 'pearl_workshop',
  name: '珍珠工坊',
  icon: '✨',
  baseCost: { gold: 500, pearl: 10 },
  costMultiplier: 1.5,
  maxLevel: 20,
  productionResource: 'pearl',
  baseProduction: 2,
  requires: ['dock'],
};

/** 所有建筑定义 */
const ALL_BUILDINGS: BuildingDef[] = [FISHERMAN, FISH_POND, DOCK, PEARL_WORKSHOP];

// ============================================================
// 辅助函数
// ============================================================

/** 创建默认配置（fisherman 初始解锁） */
function createDefaultConfig(): BuildingSystemConfig {
  return { initiallyUnlocked: ['fisherman'] };
}

/** 创建一个简单的资源检查器 */
function createResourceChecker(resources: Record<string, number>) {
  return (id: string, amount: number) => (resources[id] ?? 0) >= amount;
}

/** 创建一个资源扣减器 */
function createResourceSpender(resources: Record<string, number>) {
  return (id: string, amount: number) => {
    resources[id] = (resources[id] ?? 0) - amount;
  };
}

/** 创建并注册系统 */
function createSystem(config?: BuildingSystemConfig): BuildingSystem {
  const system = new BuildingSystem(config ?? createDefaultConfig());
  system.register(ALL_BUILDINGS);
  return system;
}

// ============================================================
// 测试
// ============================================================

describe('BuildingSystem', () => {
  // ----------------------------------------------------------
  // 初始化
  // ----------------------------------------------------------

  describe('初始化', () => {
    it('constructor — 应正确初始化配置', () => {
      const system = new BuildingSystem({
        initiallyUnlocked: ['a', 'b'],
        globalMultiplier: 2.5,
      });
      expect(system).toBeInstanceOf(BuildingSystem);
    });

    it('constructor — globalMultiplier 默认为 1.0', () => {
      const system = createSystem();
      system.register([FISHERMAN]);
      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      expect(system.getProduction('fisherman')).toBe(1); // 1 * 1 * 1.0
    });

    it('register — 应注册所有建筑定义', () => {
      const system = createSystem();
      expect(system.getAllDefs()).toHaveLength(4);
    });

    it('register — initiallyUnlocked 的建筑应标记为已解锁', () => {
      const system = createSystem();
      expect(system.isUnlocked('fisherman')).toBe(true);
      expect(system.isUnlocked('fish_pond')).toBe(false);
      expect(system.isUnlocked('dock')).toBe(false);
    });

    it('register — 重复注册应覆盖定义但保留现有状态', () => {
      const system = createSystem();
      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      expect(system.getLevel('fisherman')).toBe(1);

      // 重新注册同名建筑
      system.register([{ ...FISHERMAN, name: '渔夫小屋V2' }]);
      expect(system.getLevel('fisherman')).toBe(1); // 状态保留
      expect(system.getDef('fisherman')!.name).toBe('渔夫小屋V2'); // 定义已更新
    });

    it('loadState — 应恢复建筑等级', () => {
      const system = createSystem();
      system.loadState({ fisherman: 3, fish_pond: 2 });
      expect(system.getLevel('fisherman')).toBe(3);
      expect(system.getLevel('fish_pond')).toBe(2);
    });

    it('loadState — 未注册的建筑 ID 应被忽略', () => {
      const system = createSystem();
      expect(() => system.loadState({ unknown: 5 })).not.toThrow();
    });

    it('saveState — 应导出等级 > 0 的建筑', () => {
      const system = createSystem();
      system.loadState({ fisherman: 3, fish_pond: 0 });
      const saved = system.saveState();
      expect(saved).toEqual({ fisherman: 3 });
    });

    it('saveState — 无建筑升级时返回空对象', () => {
      const system = createSystem();
      expect(system.saveState()).toEqual({});
    });

    it('saveState + loadState 往返应保持一致', () => {
      const system1 = createSystem();
      const resources = { gold: 10000, fish: 1000, pearl: 100 };
      system1.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      system1.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));

      const saved = system1.saveState();

      const system2 = createSystem();
      system2.loadState(saved);
      expect(system2.getLevel('fisherman')).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // 查询
  // ----------------------------------------------------------

  describe('查询', () => {
    it('getDef — 应返回正确的建筑定义', () => {
      const system = createSystem();
      expect(system.getDef('fisherman')).toEqual(FISHERMAN);
    });

    it('getDef — 未注册返回 undefined', () => {
      const system = createSystem();
      expect(system.getDef('unknown')).toBeUndefined();
    });

    it('getAllDefs — 应返回所有定义', () => {
      const system = createSystem();
      const defs = system.getAllDefs();
      expect(defs).toHaveLength(4);
      expect(defs.map(d => d.id)).toEqual(['fisherman', 'fish_pond', 'dock', 'pearl_workshop']);
    });

    it('getLevel — 初始等级为 0', () => {
      const system = createSystem();
      expect(system.getLevel('fisherman')).toBe(0);
    });

    it('getLevel — 未注册返回 0', () => {
      const system = createSystem();
      expect(system.getLevel('unknown')).toBe(0);
    });

    it('getCost — 等级 0 时费用 = baseCost', () => {
      const system = createSystem();
      expect(system.getCost('fisherman')).toEqual({ gold: 10 });
    });

    it('getCost — 等级 1 时费用 = floor(baseCost * costMultiplier^1)', () => {
      const system = createSystem();
      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      expect(system.getCost('fisherman')).toEqual({ gold: Math.floor(10 * 1.15) });
    });

    it('getCost — 多资源费用应全部计算', () => {
      const system = createSystem();
      const cost = system.getCost('fish_pond');
      expect(cost).toEqual({ gold: 50, fish: 20 });
    });

    it('getCost — 未注册返回空对象', () => {
      const system = createSystem();
      expect(system.getCost('unknown')).toEqual({});
    });

    it('canAfford — 资源充足时返回 true', () => {
      const system = createSystem();
      expect(system.canAfford('fisherman', createResourceChecker({ gold: 10 }))).toBe(true);
    });

    it('canAfford — 资源不足时返回 false', () => {
      const system = createSystem();
      expect(system.canAfford('fisherman', createResourceChecker({ gold: 5 }))).toBe(false);
    });

    it('canAfford — 未解锁返回 false', () => {
      const system = createSystem();
      expect(system.canAfford('fish_pond', createResourceChecker({ gold: 100 }))).toBe(false);
    });

    it('canAfford — 达到最大等级返回 false', () => {
      const system = createSystem();
      system.loadState({ fisherman: 5 }); // maxLevel = 5
      expect(system.canAfford('fisherman', createResourceChecker({ gold: 999 }))).toBe(false);
    });

    it('canAfford — 未注册返回 false', () => {
      const system = createSystem();
      expect(system.canAfford('unknown', () => true)).toBe(false);
    });

    it('isUnlocked — 已解锁返回 true', () => {
      const system = createSystem();
      expect(system.isUnlocked('fisherman')).toBe(true);
    });

    it('isUnlocked — 未解锁返回 false', () => {
      const system = createSystem();
      expect(system.isUnlocked('fish_pond')).toBe(false);
    });

    it('isUnlocked — 未注册返回 false', () => {
      const system = createSystem();
      expect(system.isUnlocked('unknown')).toBe(false);
    });

    it('getProduction — 等级 0 时产出为 0', () => {
      const system = createSystem();
      expect(system.getProduction('fisherman')).toBe(0);
    });

    it('getProduction — 等级 1 时产出 = baseProduction * 1 * globalMultiplier', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 });
      expect(system.getProduction('fisherman')).toBe(1); // 1 * 1 * 1.0
    });

    it('getProduction — 等级 3 时产出 = baseProduction * 3 * globalMultiplier', () => {
      const system = createSystem();
      system.loadState({ fish_pond: 3 });
      system.forceUnlock('fish_pond');
      expect(system.getProduction('fish_pond')).toBe(9); // 3 * 3 * 1.0
    });

    it('getProduction — 受 globalMultiplier 影响', () => {
      const system = createSystem();
      system.loadState({ fisherman: 2 });
      system.setGlobalMultiplier(2.0);
      expect(system.getProduction('fisherman')).toBe(4); // 1 * 2 * 2.0
    });

    it('getProduction — 未注册返回 0', () => {
      const system = createSystem();
      expect(system.getProduction('unknown')).toBe(0);
    });

    it('getTotalProduction — 应按资源分组汇总', () => {
      const system = createSystem();
      system.loadState({ fisherman: 2, fish_pond: 1 });
      system.forceUnlock('fish_pond');

      const total = system.getTotalProduction();
      expect(total).toEqual({ fish: 5 }); // fisherman: 1*2=2, fish_pond: 3*1=3 → total fish=5
    });

    it('getTotalProduction — 多种资源应分别计算', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1, dock: 2 });
      system.forceUnlock('fish_pond');
      system.forceUnlock('dock');

      const total = system.getTotalProduction();
      expect(total).toEqual({
        fish: 1,   // fisherman: 1*1
        pearl: 1,  // dock: 0.5*2
      });
    });

    it('getTotalProduction — 无建筑时返回空对象', () => {
      const system = createSystem();
      expect(system.getTotalProduction()).toEqual({});
    });

    it('getUnlockedBuildings — 应返回所有已解锁建筑', () => {
      const system = createSystem();
      const unlocked = system.getUnlockedBuildings();
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0].id).toBe('fisherman');
    });

    it('getVisibleCount — 初始只有已解锁的建筑可见', () => {
      const system = createSystem();
      expect(system.getVisibleCount()).toBe(1); // 只有 fisherman
    });

    it('getVisibleCount — requires 满足后未解锁建筑也可见', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 }); // fish_pond 的 requires 满足
      expect(system.getVisibleCount()).toBe(2); // fisherman + fish_pond
    });

    it('getVisibleCount — 链式 requires 部分满足', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 }); // fish_pond requires 满足，但 dock 需要 fish_pond > 0
      // fisherman(unlocked) + fish_pond(requires满足) = 2
      // dock 需要 fish_pond level > 0，但 fish_pond 还是 0
      expect(system.getVisibleCount()).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // 操作
  // ----------------------------------------------------------

  describe('操作', () => {
    it('purchase — 成功购买应返回 true', () => {
      const system = createSystem();
      const resources = { gold: 100 };
      const result = system.purchase(
        'fisherman',
        createResourceChecker(resources),
        createResourceSpender(resources),
      );
      expect(result).toBe(true);
      expect(system.getLevel('fisherman')).toBe(1);
    });

    it('purchase — 应正确扣除资源', () => {
      const system = createSystem();
      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      expect(resources.gold).toBe(90); // 100 - 10
    });

    it('purchase — 多资源建筑应扣除所有资源', () => {
      const system = createSystem();
      system.forceUnlock('fish_pond');
      const resources = { gold: 100, fish: 50 };
      system.purchase('fish_pond', createResourceChecker(resources), createResourceSpender(resources));
      expect(resources.gold).toBe(50); // 100 - 50
      expect(resources.fish).toBe(30); // 50 - 20
    });

    it('purchase — 资源不足返回 false', () => {
      const system = createSystem();
      const resources = { gold: 5 };
      const result = system.purchase(
        'fisherman',
        createResourceChecker(resources),
        createResourceSpender(resources),
      );
      expect(result).toBe(false);
      expect(system.getLevel('fisherman')).toBe(0);
    });

    it('purchase — 未解锁返回 false', () => {
      const system = createSystem();
      const resources = { gold: 999 };
      const result = system.purchase(
        'fish_pond',
        createResourceChecker(resources),
        createResourceSpender(resources),
      );
      expect(result).toBe(false);
    });

    it('purchase — 达到最大等级后返回 false', () => {
      const system = createSystem();
      const resources = { gold: 9999 };
      for (let i = 0; i < 5; i++) {
        system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      }
      expect(system.getLevel('fisherman')).toBe(5);
      const result = system.purchase(
        'fisherman',
        createResourceChecker(resources),
        createResourceSpender(resources),
      );
      expect(result).toBe(false);
    });

    it('setGlobalMultiplier — 应更新全局倍率', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 });
      expect(system.getProduction('fisherman')).toBe(1);

      system.setGlobalMultiplier(3.0);
      expect(system.getProduction('fisherman')).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // 解锁
  // ----------------------------------------------------------

  describe('解锁', () => {
    it('checkUnlocks — 前置建筑等级 > 0 时应自动解锁', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 });

      const unlocked = system.checkUnlocks();
      expect(unlocked).toEqual(['fish_pond']);
      expect(system.isUnlocked('fish_pond')).toBe(true);
    });

    it('checkUnlocks — 前置建筑等级 = 0 时不应解锁', () => {
      const system = createSystem();
      // fisherman 存在但 level = 0
      const unlocked = system.checkUnlocks();
      expect(unlocked).toEqual([]);
    });

    it('checkUnlocks — 链式解锁应逐步进行', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 });

      // 第一次：解锁 fish_pond
      let unlocked = system.checkUnlocks();
      expect(unlocked).toEqual(['fish_pond']);

      // fish_pond 还是 level 0，dock 不会解锁
      unlocked = system.checkUnlocks();
      expect(unlocked).toEqual([]);

      // 升级 fish_pond
      system.loadState({ fisherman: 1, fish_pond: 1 });
      unlocked = system.checkUnlocks();
      expect(unlocked).toEqual(['dock']);
    });

    it('checkUnlocks — 已解锁建筑不应重复出现在列表中', () => {
      const system = createSystem();
      system.loadState({ fisherman: 1 });
      system.checkUnlocks();
      const unlocked = system.checkUnlocks();
      expect(unlocked).toEqual([]);
    });

    it('checkUnlocks — 无 requires 的建筑不在此处理', () => {
      const system = createSystem();
      const unlocked = system.checkUnlocks();
      expect(unlocked).toEqual([]);
    });

    it('forceUnlock — 应强制解锁指定建筑', () => {
      const system = createSystem();
      expect(system.isUnlocked('dock')).toBe(false);
      system.forceUnlock('dock');
      expect(system.isUnlocked('dock')).toBe(true);
    });

    it('forceUnlock — 已解锁建筑不应重复触发事件', () => {
      const system = createSystem();
      const listener = jest.fn();
      system.onEvent(listener);

      system.forceUnlock('fisherman'); // 已经解锁
      expect(listener).not.toHaveBeenCalled();
    });

    it('forceUnlock — 未注册建筑应静默跳过', () => {
      const system = createSystem();
      expect(() => system.forceUnlock('unknown')).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // 事件
  // ----------------------------------------------------------

  describe('事件', () => {
    it('onEvent — 购买时应触发 purchased 事件', () => {
      const system = createSystem();
      const listener = jest.fn();
      system.onEvent(listener);

      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));

      expect(listener).toHaveBeenCalledWith({
        type: 'purchased',
        buildingId: 'fisherman',
        newLevel: 1,
      });
    });

    it('onEvent — 达到最大等级时应触发 levelMaxed 事件', () => {
      const system = createSystem();
      const listener = jest.fn();
      system.onEvent(listener);

      const resources = { gold: 9999 };
      for (let i = 0; i < 5; i++) {
        system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      }

      const events = listener.mock.calls.map(call => call[0]);
      const maxedEvent = events.find(e => e.type === 'levelMaxed');
      expect(maxedEvent).toEqual({ type: 'levelMaxed', buildingId: 'fisherman' });
    });

    it('onEvent — 解锁时应触发 unlocked 事件', () => {
      const system = createSystem();
      const listener = jest.fn();
      system.onEvent(listener);

      system.loadState({ fisherman: 1 });
      system.checkUnlocks();

      expect(listener).toHaveBeenCalledWith({
        type: 'unlocked',
        buildingId: 'fish_pond',
      });
    });

    it('onEvent — forceUnlock 应触发 unlocked 事件', () => {
      const system = createSystem();
      const listener = jest.fn();
      system.onEvent(listener);

      system.forceUnlock('dock');

      expect(listener).toHaveBeenCalledWith({
        type: 'unlocked',
        buildingId: 'dock',
      });
    });

    it('offEvent — 应正确移除监听器', () => {
      const system = createSystem();
      const listener = jest.fn();
      system.onEvent(listener);
      system.offEvent(listener);

      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));

      expect(listener).not.toHaveBeenCalled();
    });

    it('offEvent — 移除未注册的监听器不应报错', () => {
      const system = createSystem();
      const listener = jest.fn();
      expect(() => system.offEvent(listener)).not.toThrow();
    });

    it('监听器异常不应中断其他监听器', () => {
      const system = createSystem();
      const badListener = jest.fn(() => {
        throw new Error('listener error');
      });
      const goodListener = jest.fn();
      system.onEvent(badListener);
      system.onEvent(goodListener);

      const resources = { gold: 100 };
      system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------

  describe('重置', () => {
    it('reset — 应将所有等级归零', () => {
      const system = createSystem();
      system.loadState({ fisherman: 3, fish_pond: 2 });
      system.reset();
      expect(system.getLevel('fisherman')).toBe(0);
      expect(system.getLevel('fish_pond')).toBe(0);
    });

    it('reset — 不保留解锁状态时恢复为初始配置', () => {
      const system = createSystem();
      system.forceUnlock('fish_pond');
      system.forceUnlock('dock');
      system.reset(false);
      expect(system.isUnlocked('fisherman')).toBe(true);
      expect(system.isUnlocked('fish_pond')).toBe(false);
      expect(system.isUnlocked('dock')).toBe(false);
    });

    it('reset — 保留解锁状态时解锁不变', () => {
      const system = createSystem();
      system.forceUnlock('fish_pond');
      system.forceUnlock('dock');
      system.reset(true);
      expect(system.isUnlocked('fisherman')).toBe(true);
      expect(system.isUnlocked('fish_pond')).toBe(true);
      expect(system.isUnlocked('dock')).toBe(true);
    });

    it('reset — 默认不保留解锁状态', () => {
      const system = createSystem();
      system.forceUnlock('dock');
      system.reset(); // 默认 keepUnlocked = false
      expect(system.isUnlocked('dock')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 泛型支持
  // ----------------------------------------------------------

  describe('泛型支持', () => {
    it('应支持扩展的建筑定义类型', () => {
      interface ExtendedBuildingDef extends BuildingDef {
        category: string;
      }

      const extendedDef: ExtendedBuildingDef = {
        ...FISHERMAN,
        category: 'production',
      };

      const system = new BuildingSystem<ExtendedBuildingDef>({
        initiallyUnlocked: ['fisherman'],
      });
      system.register([extendedDef]);

      const def = system.getDef('fisherman');
      expect(def).toBeDefined();
      expect(def!.category).toBe('production');
    });
  });

  // ----------------------------------------------------------
  // 集成场景
  // ----------------------------------------------------------

  describe('集成场景', () => {
    it('完整的游戏流程：购买 → 解锁 → 购买 → 检查产出', () => {
      const system = createSystem();
      const resources: Record<string, number> = { gold: 10000, fish: 500, pearl: 100 };

      // 1. 购买 fisherman
      expect(system.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources))).toBe(true);
      expect(system.getLevel('fisherman')).toBe(1);

      // 2. 检查解锁
      const unlocked = system.checkUnlocks();
      expect(unlocked).toContain('fish_pond');

      // 3. 购买 fish_pond
      expect(system.purchase('fish_pond', createResourceChecker(resources), createResourceSpender(resources))).toBe(true);

      // 4. 再次检查解锁
      // fish_pond level = 1, dock requires fish_pond
      const unlocked2 = system.checkUnlocks();
      expect(unlocked2).toContain('dock');

      // 5. 购买 dock
      expect(system.purchase('dock', createResourceChecker(resources), createResourceSpender(resources))).toBe(true);

      // 6. 检查总产出
      const total = system.getTotalProduction();
      expect(total.fish).toBeCloseTo(4); // fisherman(1*1) + fish_pond(3*1) = 4
      expect(total.pearl).toBeCloseTo(0.5); // dock(0.5*1)
    });

    it('存档恢复后应保持一致状态', () => {
      const system1 = createSystem();
      const resources = { gold: 99999, fish: 9999, pearl: 9999 };

      // 购买并解锁
      system1.purchase('fisherman', createResourceChecker(resources), createResourceSpender(resources));
      system1.checkUnlocks();
      system1.purchase('fish_pond', createResourceChecker(resources), createResourceSpender(resources));

      // 存档
      const saved = system1.saveState();

      // 新系统恢复
      const system2 = createSystem();
      system2.loadState(saved);

      // 需要重新检查解锁
      system2.checkUnlocks();

      expect(system2.getLevel('fisherman')).toBe(1);
      expect(system2.getLevel('fish_pond')).toBe(1);
      expect(system2.isUnlocked('fish_pond')).toBe(true);
    });
  });
});
