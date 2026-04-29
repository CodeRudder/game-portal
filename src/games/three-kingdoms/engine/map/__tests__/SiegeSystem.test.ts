import { vi } from 'vitest';
/**
 * SiegeSystem 测试
 *
 * 覆盖：
 *   #19 攻城条件校验（相邻 + 兵力 + 粮草）
 *   #20 占领规则（攻城胜利后归属变更）
 *   攻城消耗计算
 *   攻城执行（胜利/失败）
 *   外部战斗结果模式
 *   统计查询
 *   序列化/反序列化
 *
 * @module engine/map/__tests__/SiegeSystem.test
 */

import { SiegeSystem } from '../SiegeSystem';
import { TerritorySystem } from '../TerritorySystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry, ISubsystem } from '../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(withTerritory = true): ISystemDeps {
  const territorySys = new TerritorySystem();
  const deps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory' && withTerritory) return territorySys;
        throw new Error(`Subsystem ${name} not found`);
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((name: string) => name === 'territory'),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };

  if (withTerritory) {
    territorySys.init(deps);
  }

  return deps;
}

function createSystems(): { siege: SiegeSystem; territory: TerritorySystem; deps: ISystemDeps } {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();

  const deps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory') return territory;
        throw new Error(`Subsystem ${name} not found`);
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((name: string) => name === 'territory'),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  siege.init(deps);

  return { siege, territory, deps };
}

// ============================================================
// #19 攻城条件校验
// ============================================================

describe('SiegeSystem — #19 攻城条件校验', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    ({ siege, territory } = createSystems());
  });

  it('目标不存在时不可攻城', () => {
    const result = siege.checkSiegeConditions('non-existent', 'player', 10000, 500);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_NOT_FOUND');
  });

  it('己方领土不可攻城', () => {
    territory.captureTerritory('city-luoyang', 'player');
    const result = siege.checkSiegeConditions('city-luoyang', 'player', 10000, 500);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_ALREADY_OWNED');
  });

  it('不相邻不可攻城', () => {
    // 没有己方领土，自然不相邻
    const result = siege.checkSiegeConditions('city-xuchang', 'player', 10000, 500);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('NOT_ADJACENT');
  });

  it('兵力不足不可攻城', () => {
    territory.captureTerritory('city-luoyang', 'player');
    const cost = siege.getSiegeCostById('city-xuchang');
    expect(cost).not.toBeNull();

    // city-xuchang: level=4, defenseValue=4000, troops=4000
    const result = siege.checkSiegeConditions('city-xuchang', 'player', 100, 500);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
  });

  it('粮草不足不可攻城', () => {
    territory.captureTerritory('city-luoyang', 'player');
    // city-xuchang: level=4, defenseValue=4000, troops=4000, grain=500
    const result = siege.checkSiegeConditions('city-xuchang', 'player', 10000, 0);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_GRAIN');
  });

  it('满足所有条件时可攻城', () => {
    territory.captureTerritory('city-luoyang', 'player');
    // city-xuchang: level=4, defenseValue=4000, troops=4000, grain=500
    const result = siege.checkSiegeConditions('city-xuchang', 'player', 5000, 500);
    expect(result.canSiege).toBe(true);
    expect(result.errorCode).toBeUndefined();
  });

  it('与己方领土相邻才可攻击', () => {
    territory.captureTerritory('city-luoyang', 'player');
    // 洛阳与建业不相邻
    const result = siege.checkSiegeConditions('city-jianye', 'player', 10000, 5000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('NOT_ADJACENT');
  });

  it('占领相邻领土后可攻击更远领土', () => {
    territory.captureTerritory('city-luoyang', 'player');
    // 洛阳与长安相邻
    const result = siege.checkSiegeConditions('city-changan', 'player', 10000, 5000);
    expect(result.canSiege).toBe(true);
  });

  it('错误信息包含有意义描述', () => {
    const result = siege.checkSiegeConditions('non-existent', 'player', 1000, 500);
    expect(result.errorMessage).toBeTruthy();
  });
});

// ============================================================
// #20 占领规则
// ============================================================

describe('SiegeSystem — #20 占领规则', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    ({ siege, territory } = createSystems());
  });

  it('攻城胜利后领土归属变更', () => {
    territory.captureTerritory('city-luoyang', 'player');

    const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(true);
    expect(result.capture).toBeDefined();
    expect(result.capture!.newOwner).toBe('player');
    expect(result.capture!.previousOwner).toBe('neutral');

    // 验证领土归属已变更
    const t = territory.getTerritoryById('city-xuchang');
    expect(t!.ownership).toBe('player');
  });

  it('攻城失败后领土归属不变', () => {
    territory.captureTerritory('city-luoyang', 'player');

    const result = siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(false);
    expect(result.capture).toBeUndefined();

    // 领土归属不变
    const t = territory.getTerritoryById('city-xuchang');
    expect(t!.ownership).toBe('neutral');
  });

  it('条件不满足时攻城不发起', () => {
    const result = siege.executeSiegeWithResult('city-xuchang', 'player', 10, 5, true);
    expect(result.launched).toBe(false);
    expect(result.victory).toBe(false);
  });

  it('攻城胜利事件触发', () => {
    const { siege: s, territory: t, deps } = createSystems();
    const emitSpy = vi.spyOn(deps.eventBus, 'emit');
    t.captureTerritory('city-luoyang', 'player');

    s.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    expect(emitSpy).toHaveBeenCalledWith('siege:victory', expect.objectContaining({
      territoryId: 'city-xuchang',
      newOwner: 'player',
    }));
  });

  it('攻城失败事件触发', () => {
    const { siege: s, territory: t, deps } = createSystems();
    const emitSpy = vi.spyOn(deps.eventBus, 'emit');
    t.captureTerritory('city-luoyang', 'player');

    s.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
    expect(emitSpy).toHaveBeenCalledWith('siege:defeat', expect.objectContaining({
      territoryId: 'city-xuchang',
    }));
  });

  it('连续攻城可逐步扩张领土', () => {
    // 占领洛阳
    territory.captureTerritory('city-luoyang', 'player');

    // 攻占许昌（与洛阳相邻）
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    expect(territory.getTerritoryById('city-xuchang')!.ownership).toBe('player');

    // 现在可以攻占虎牢关（与洛阳和许昌都相邻）
    siege.executeSiegeWithResult('pass-hulao', 'player', 5000, 500, true);
    expect(territory.getTerritoryById('pass-hulao')!.ownership).toBe('player');
  });

  it('占领后产出归己方', () => {
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

    const summary = territory.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(2);
    expect(summary.totalProduction.grain).toBeGreaterThan(0);
  });
});

// ============================================================
// 攻城消耗计算
// ============================================================

describe('SiegeSystem — 攻城消耗计算', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    ({ siege, territory } = createSystems());
  });

  it('城池消耗 > 关卡消耗（防御值更高）', () => {
    const cityCost = siege.getSiegeCostById('city-luoyang'); // level=5, defenseValue=5000
    const passCost = siege.getSiegeCostById('pass-hulao'); // level=3, defenseValue=3000
    expect(cityCost).not.toBeNull();
    expect(passCost).not.toBeNull();
    // ⚠️ PRD MAP-4 统一声明：defenseValue=1000×level，洛阳(5000) > 虎牢关(3000)
    expect(cityCost!.troops).toBeGreaterThan(passCost!.troops);
  });

  it('粮草消耗为固定500（⚠️PRD MAP-4统一声明）', () => {
    const luoyangCost = siege.getSiegeCostById('city-luoyang'); // 5级
    const hanzhongCost = siege.getSiegeCostById('city-hanzhong'); // 3级
    // 粮草消耗固定500，不随等级变化
    expect(luoyangCost!.grain).toBe(500);
    expect(hanzhongCost!.grain).toBe(500);
  });

  it('不存在的领土消耗返回null', () => {
    const cost = siege.getSiegeCostById('non-existent');
    expect(cost).toBeNull();
  });

  it('消耗结构包含 troops 和 grain', () => {
    const cost = siege.getSiegeCostById('city-luoyang');
    expect(cost).toHaveProperty('troops');
    expect(cost).toHaveProperty('grain');
    expect(cost!.troops).toBeGreaterThan(0);
    expect(cost!.grain).toBeGreaterThan(0);
  });
});

// ============================================================
// 攻城执行（简化版战斗模拟）
// ============================================================

describe('SiegeSystem — 攻城执行', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    ({ siege, territory } = createSystems());
  });

  it('executeSiege 返回完整结果', () => {
    territory.captureTerritory('city-luoyang', 'player');
    const result = siege.executeSiege('city-xuchang', 'player', 5000, 500);

    expect(result).toHaveProperty('launched');
    expect(result).toHaveProperty('victory');
    expect(result).toHaveProperty('targetId');
    expect(result).toHaveProperty('targetName');
    expect(result).toHaveProperty('cost');
    expect(result.targetId).toBe('city-xuchang');
    expect(result.targetName).toBe('许昌');
  });

  it('兵力充足时简化战斗有胜算', () => {
    territory.captureTerritory('city-luoyang', 'player');
    // 大量兵力，胜率应该很高
    const result = siege.executeSiege('city-xuchang', 'player', 50000, 5000);
    expect(result.launched).toBe(true);
  });

  it('条件不满足时 executeSiege 不发起', () => {
    const result = siege.executeSiege('city-xuchang', 'player', 10, 5);
    expect(result.launched).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });
});

// ============================================================
// 统计查询
// ============================================================

describe('SiegeSystem — 统计查询', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    ({ siege, territory } = createSystems());
  });

  it('初始统计为0', () => {
    expect(siege.getTotalSieges()).toBe(0);
    expect(siege.getVictories()).toBe(0);
    expect(siege.getDefeats()).toBe(0);
    expect(siege.getWinRate()).toBe(0);
  });

  it('攻城后统计更新', () => {
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, false);

    expect(siege.getTotalSieges()).toBe(2);
    expect(siege.getVictories()).toBe(1);
    expect(siege.getDefeats()).toBe(1);
    expect(siege.getWinRate()).toBe(0.5);
  });

  it('攻城历史记录完整', () => {
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

    const history = siege.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].targetId).toBe('city-xuchang');
    expect(history[0].victory).toBe(true);
  });
});

// ============================================================
// 序列化/反序列化
// ============================================================

describe('SiegeSystem — 序列化', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    ({ siege, territory } = createSystems());
  });

  it('序列化包含统计数据', () => {
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

    const data = siege.serialize();
    expect(data.totalSieges).toBe(1);
    expect(data.victories).toBe(1);
    expect(data.defeats).toBe(0);
    expect(data.version).toBe(1);
  });

  it('反序列化恢复统计', () => {
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

    const data = siege.serialize();
    siege.reset();
    expect(siege.getTotalSieges()).toBe(0);

    siege.deserialize(data);
    expect(siege.getTotalSieges()).toBe(1);
    expect(siege.getVictories()).toBe(1);
  });

  it('反序列化后历史清空（仅恢复统计）', () => {
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

    const data = siege.serialize();
    siege.deserialize(data);
    expect(siege.getHistory()).toHaveLength(0);
  });
});

// ============================================================
// ISubsystem 接口
// ============================================================

describe('SiegeSystem — ISubsystem', () => {
  it('name 为 siege', () => {
    const sys = new SiegeSystem();
    expect(sys.name).toBe('siege');
  });

  it('init 后可正常使用', () => {
    const sys = new SiegeSystem();
    sys.init(createMockDeps());
    expect(sys.getTotalSieges()).toBe(0);
  });

  it('reset 恢复初始状态', () => {
    const { siege, territory } = createSystems();
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    expect(siege.getTotalSieges()).toBe(1);

    siege.reset();
    expect(siege.getTotalSieges()).toBe(0);
    expect(siege.getHistory()).toHaveLength(0);
  });

  it('getState 返回完整状态', () => {
    const { siege } = createSystems();
    const state = siege.getState();
    expect(state).toHaveProperty('history');
    expect(state).toHaveProperty('totalSieges');
    expect(state).toHaveProperty('victories');
    expect(state).toHaveProperty('defeats');
  });

  it('update 不抛异常', () => {
    const { siege } = createSystems();
    expect(() => siege.update(0.016)).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// P1-4: 每日攻城次数自动重置
// ─────────────────────────────────────────────
describe('SiegeSystem — P1-4 每日攻城次数自动重置', () => {
  it('初始状态下每日攻城次数为3', () => {
    const { siege } = createSystems();
    expect(siege.getRemainingDailySieges()).toBe(3);
  });

  it('攻城后剩余次数减少', () => {
    const { siege, territory } = createSystems();
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    expect(siege.getRemainingDailySieges()).toBe(2);
  });

  it('update中检测日期变化自动重置每日次数', () => {
    const { siege, territory } = createSystems();
    // 消耗2次攻城
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    siege.executeSiegeWithResult('city-ye', 'player', 5000, 500, true);
    expect(siege.getRemainingDailySieges()).toBe(1);

    // 模拟跨天：修改内部 lastSiegeDate 为昨天
    const saveData = siege.serialize();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    saveData.lastSiegeDate = yesterday.toISOString().slice(0, 10);
    saveData.dailySiegeCount = 2;
    siege.deserialize(saveData);

    // 调用 update 触发日期检测
    siege.update(0.016);

    // 每日次数应已重置
    expect(siege.getRemainingDailySieges()).toBe(3);
  });

  it('同一天内update不会重置次数', () => {
    const { siege, territory } = createSystems();
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
    expect(siege.getRemainingDailySieges()).toBe(2);

    // 同一天调用 update 不应重置
    siege.update(0.016);
    siege.update(0.016);
    expect(siege.getRemainingDailySieges()).toBe(2);
  });

  it('序列化/反序列化保留每日次数和日期', () => {
    const { siege, territory } = createSystems();
    territory.captureTerritory('city-luoyang', 'player');
    siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);

    const data = siege.serialize();
    expect(data.dailySiegeCount).toBe(1);
    expect(data.lastSiegeDate).toBeTruthy();

    // 反序列化后恢复
    const newSiege = new SiegeSystem();
    newSiege.init(createMockDeps());
    newSiege.deserialize(data);
    expect(newSiege.getRemainingDailySieges()).toBe(2);
  });

  it('每日3次攻城用完后不可再攻城', () => {
    const { siege, territory } = createSystems();
    territory.captureTerritory('city-luoyang', 'player');

    // 通过序列化/反序列化模拟已用完3次
    const saveData = siege.serialize();
    saveData.dailySiegeCount = 3;
    saveData.lastSiegeDate = new Date().toISOString().slice(0, 10);
    siege.deserialize(saveData);

    expect(siege.getRemainingDailySieges()).toBe(0);

    // 攻城条件检查应拒绝
    const result = siege.checkSiegeConditions('city-xuchang', 'player', 5000, 500);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('DAILY_LIMIT_REACHED');
  });
});
