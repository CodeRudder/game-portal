/**
 * TerritorySystem 测试
 *
 * 覆盖：
 *   #15 领土产出计算
 *   #16 领土等级升级
 *   #17 产出汇总
 *   归属变更
 *   相邻关系查询
 *   序列化/反序列化
 *
 * @module engine/map/__tests__/TerritorySystem.test
 */

import { TerritorySystem } from '../TerritorySystem';
import type { ISystemDeps } from '../../../core/types';
import { calculateUpgradeCost } from '../../../core/map/territory-config';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createSystem(): TerritorySystem {
  const sys = new TerritorySystem();
  sys.init(mockDeps());
  return sys;
}

// ============================================================
// #15 领土产出计算
// ============================================================

describe('TerritorySystem — #15 领土产出计算', () => {
  let sys: TerritorySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('初始所有领土归属为 neutral', () => {
    const all = sys.getAllTerritories();
    expect(all.length).toBeGreaterThan(0);
    for (const t of all) {
      expect(t.ownership).toBe('neutral');
    }
  });

  it('城池类型领土有正确的产出结构', () => {
    const luoyang = sys.getTerritoryById('city-luoyang');
    expect(luoyang).not.toBeNull();
    expect(luoyang!.baseProduction).toHaveProperty('grain');
    expect(luoyang!.baseProduction).toHaveProperty('gold');
    expect(luoyang!.baseProduction).toHaveProperty('troops');
    expect(luoyang!.baseProduction).toHaveProperty('mandate');
  });

  it('城池基础产出 > 0（粮食和金币）', () => {
    const luoyang = sys.getTerritoryById('city-luoyang');
    expect(luoyang!.baseProduction.grain).toBeGreaterThan(0);
    expect(luoyang!.baseProduction.gold).toBeGreaterThan(0);
  });

  it('关卡产出以兵力为主', () => {
    const hulao = sys.getTerritoryById('pass-hulao');
    expect(hulao).not.toBeNull();
    expect(hulao!.baseProduction.troops).toBeGreaterThan(0);
    expect(hulao!.baseProduction.grain).toBeGreaterThan(0);
  });

  it('资源点产出聚焦对应资源', () => {
    const grain1 = sys.getTerritoryById('res-grain1');
    expect(grain1).not.toBeNull();
    expect(grain1!.baseProduction.grain).toBeGreaterThan(0);
    expect(grain1!.baseProduction.gold).toBe(0);

    const gold1 = sys.getTerritoryById('res-gold1');
    expect(gold1).not.toBeNull();
    expect(gold1!.baseProduction.gold).toBeGreaterThan(0);
    expect(gold1!.baseProduction.grain).toBe(0);
  });

  it('等级1领土产出 = 基础产出 × 1.0', () => {
    const all = sys.getAllTerritories();
    const level1 = all.find(t => t.level === 1);
    if (level1) {
      expect(level1.currentProduction.grain).toBeCloseTo(level1.baseProduction.grain * 1.0, 1);
    }
  });

  it('高等级领土产出 > 基础产出', () => {
    const luoyang = sys.getTerritoryById('city-luoyang');
    expect(luoyang!.level).toBe(5);
    expect(luoyang!.currentProduction.grain).toBeGreaterThan(luoyang!.baseProduction.grain);
  });

  it('占领后产出汇总包含该领土', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(1);
    expect(summary.totalProduction.grain).toBeGreaterThan(0);
  });

  it('未占领领土不产出', () => {
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(0);
    expect(summary.totalProduction.grain).toBe(0);
  });

  it('累计产出计算正确', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const summary = sys.getPlayerProductionSummary();
    const accumulated = sys.calculateAccumulatedProduction(60);
    expect(accumulated.grain).toBeCloseTo(summary.totalProduction.grain * 60, 1);
  });
});

// ============================================================
// #16 领土等级
// ============================================================

describe('TerritorySystem — #16 领土等级', () => {
  let sys: TerritorySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('初始领土等级在1-5范围内', () => {
    const all = sys.getAllTerritories();
    for (const t of all) {
      expect(t.level).toBeGreaterThanOrEqual(1);
      expect(t.level).toBeLessThanOrEqual(5);
    }
  });

  it('升级玩家领土成功（非满级）', () => {
    sys.captureTerritory('res-grain1', 'player');
    const before = sys.getTerritoryById('res-grain1')!;

    if (before.level < 5) {
      const result = sys.upgradeTerritory('res-grain1');
      expect(result.success).toBe(true);
      expect(result.newLevel).toBe(before.level + 1);
      expect(result.previousLevel).toBe(before.level);
    }
  });

  it('升级成功后产出提升', () => {
    sys.captureTerritory('res-grain1', 'player');
    const before = sys.getTerritoryById('res-grain1')!;
    const beforeProd = { ...before.currentProduction };

    if (before.level < 5) {
      sys.upgradeTerritory('res-grain1');
      const after = sys.getTerritoryById('res-grain1')!;
      expect(after.currentProduction.grain).toBeGreaterThanOrEqual(beforeProd.grain);
    }
  });

  it('满级(5级)领土不可升级', () => {
    sys.captureTerritory('city-luoyang', 'player'); // 洛阳5级
    const result = sys.upgradeTerritory('city-luoyang');
    expect(result.success).toBe(false);
  });

  it('升级非玩家领土失败', () => {
    const result = sys.upgradeTerritory('city-xuchang');
    expect(result.success).toBe(false);
  });

  it('升级不存在的领土失败', () => {
    const result = sys.upgradeTerritory('non-existent');
    expect(result.success).toBe(false);
  });

  it('升级消耗随等级递增', () => {
    const cost1 = calculateUpgradeCost(1);
    const cost2 = calculateUpgradeCost(2);
    const cost3 = calculateUpgradeCost(3);

    expect(cost1).not.toBeNull();
    expect(cost2).not.toBeNull();
    expect(cost3).not.toBeNull();
    expect(cost2!.grain).toBeGreaterThan(cost1!.grain);
    expect(cost3!.grain).toBeGreaterThan(cost2!.grain);
  });

  it('5级升级消耗返回null', () => {
    const cost = calculateUpgradeCost(5);
    expect(cost).toBeNull();
  });
});

// ============================================================
// #17 产出汇总
// ============================================================

describe('TerritorySystem — #17 产出汇总', () => {
  let sys: TerritorySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('无领土时汇总为0', () => {
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(0);
    expect(summary.details).toHaveLength(0);
  });

  it('单块领土汇总正确', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(1);
    expect(summary.details).toHaveLength(1);
    expect(summary.details[0].id).toBe('city-luoyang');
  });

  it('多块领土汇总累加', () => {
    sys.captureTerritory('city-luoyang', 'player');
    sys.captureTerritory('city-xuchang', 'player');
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(2);
    expect(summary.details).toHaveLength(2);
  });

  it('按区域统计正确', () => {
    sys.captureTerritory('city-luoyang', 'player'); // 中原
    sys.captureTerritory('city-jianye', 'player');  // 江南
    const summary = sys.getPlayerProductionSummary();
    expect(summary.territoriesByRegion.wei).toBe(1);
    expect(summary.territoriesByRegion.wu).toBe(1);
  });

  it('产出明细包含完整信息', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const summary = sys.getPlayerProductionSummary();
    const detail = summary.details[0];
    expect(detail).toHaveProperty('id');
    expect(detail).toHaveProperty('name');
    expect(detail).toHaveProperty('region');
    expect(detail).toHaveProperty('level');
    expect(detail).toHaveProperty('production');
    expect(detail.production).toHaveProperty('grain');
    expect(detail.production).toHaveProperty('gold');
  });

  it('敌方领土不计入玩家汇总', () => {
    sys.captureTerritory('city-luoyang', 'enemy');
    const summary = sys.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(0);
  });
});

// ============================================================
// 归属变更
// ============================================================

describe('TerritorySystem — 归属变更', () => {
  let sys: TerritorySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('占领领土成功', () => {
    const result = sys.captureTerritory('city-luoyang', 'player');
    expect(result).toBe(true);
    const t = sys.getTerritoryById('city-luoyang');
    expect(t!.ownership).toBe('player');
  });

  it('占领不存在的领土失败', () => {
    const result = sys.captureTerritory('non-existent', 'player');
    expect(result).toBe(false);
  });

  it('领土可被敌方占领', () => {
    sys.captureTerritory('city-luoyang', 'player');
    sys.captureTerritory('city-luoyang', 'enemy');
    const t = sys.getTerritoryById('city-luoyang');
    expect(t!.ownership).toBe('enemy');
  });

  it('批量设置归属', () => {
    sys.setOwnerships({
      'city-luoyang': 'player',
      'city-xuchang': 'enemy',
    });
    expect(sys.getTerritoryById('city-luoyang')!.ownership).toBe('player');
    expect(sys.getTerritoryById('city-xuchang')!.ownership).toBe('enemy');
  });

  it('按归属查询正确', () => {
    sys.captureTerritory('city-luoyang', 'player');
    sys.captureTerritory('city-xuchang', 'enemy');
    const playerTerritories = sys.getTerritoriesByOwnership('player');
    expect(playerTerritories).toHaveLength(1);
    expect(playerTerritories[0].id).toBe('city-luoyang');
  });

  it('玩家领土ID列表正确', () => {
    sys.captureTerritory('city-luoyang', 'player');
    sys.captureTerritory('city-xuchang', 'player');
    const ids = sys.getPlayerTerritoryIds();
    expect(ids).toContain('city-luoyang');
    expect(ids).toContain('city-xuchang');
    expect(ids).toHaveLength(2);
  });

  it('占领事件触发', () => {
    const deps = mockDeps();
    const emitSpy = jest.spyOn(deps.eventBus, 'emit');
    const s = new TerritorySystem();
    s.init(deps);
    s.captureTerritory('city-luoyang', 'player');
    expect(emitSpy).toHaveBeenCalledWith('territory:captured', expect.objectContaining({
      territoryId: 'city-luoyang',
      newOwner: 'player',
    }));
  });
});

// ============================================================
// 相邻关系查询
// ============================================================

describe('TerritorySystem — 相邻关系', () => {
  let sys: TerritorySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('洛阳与许昌相邻', () => {
    const adjacent = sys.getAdjacentTerritoryIds('city-luoyang');
    expect(adjacent).toContain('city-xuchang');
  });

  it('洛阳与虎牢关相邻', () => {
    const adjacent = sys.getAdjacentTerritoryIds('city-luoyang');
    expect(adjacent).toContain('pass-hulao');
  });

  it('不相邻的领土', () => {
    const adjacent = sys.getAdjacentTerritoryIds('city-luoyang');
    expect(adjacent).not.toContain('city-jianye');
  });

  it('canAttackTerritory: 无己方领土时不可攻击', () => {
    const canAttack = sys.canAttackTerritory('city-xuchang', 'player');
    expect(canAttack).toBe(false);
  });

  it('canAttackTerritory: 有相邻己方领土时可攻击', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const canAttack = sys.canAttackTerritory('city-xuchang', 'player');
    expect(canAttack).toBe(true);
  });

  it('canAttackTerritory: 不相邻不可攻击', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const canAttack = sys.canAttackTerritory('city-jianye', 'player');
    expect(canAttack).toBe(false);
  });

  it('canAttackTerritory: 己方领土不可攻击', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const canAttack = sys.canAttackTerritory('city-luoyang', 'player');
    expect(canAttack).toBe(false);
  });

  it('getAttackableTerritories: 返回所有可攻击领土', () => {
    sys.captureTerritory('city-luoyang', 'player');
    const attackable = sys.getAttackableTerritories('player');
    const attackableIds = attackable.map(t => t.id);
    expect(attackableIds).toContain('city-xuchang');
    expect(attackableIds).toContain('city-ye');
    expect(attackableIds).toContain('pass-hulao');
    expect(attackableIds).toContain('city-changan');
    expect(attackableIds).toContain('pass-tong');
  });
});

// ============================================================
// 序列化/反序列化
// ============================================================

describe('TerritorySystem — 序列化', () => {
  let sys: TerritorySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  it('序列化包含所有领土', () => {
    const data = sys.serialize();
    const allCount = sys.getTotalTerritoryCount();
    expect(Object.keys(data.owners).length).toBe(allCount);
    expect(Object.keys(data.levels).length).toBe(allCount);
  });

  it('序列化后反序列化可恢复状态', () => {
    sys.captureTerritory('city-luoyang', 'player');
    sys.captureTerritory('city-xuchang', 'enemy');
    const serialized = sys.serialize();

    sys.reset();
    expect(sys.getTerritoryById('city-luoyang')!.ownership).toBe('neutral');

    sys.deserialize(serialized);
    expect(sys.getTerritoryById('city-luoyang')!.ownership).toBe('player');
    expect(sys.getTerritoryById('city-xuchang')!.ownership).toBe('enemy');
  });

  it('反序列化后产出重新计算', () => {
    sys.captureTerritory('res-grain1', 'player');
    const serialized = sys.serialize();
    serialized.levels['res-grain1'] = 4;

    sys.deserialize(serialized);
    const t = sys.getTerritoryById('res-grain1');
    expect(t!.level).toBe(4);
    expect(t!.currentProduction.grain).toBeGreaterThan(t!.baseProduction.grain);
  });
});

// ============================================================
// ISubsystem 接口
// ============================================================

describe('TerritorySystem — ISubsystem', () => {
  it('name 为 territory', () => {
    const sys = new TerritorySystem();
    expect(sys.name).toBe('territory');
  });

  it('init 后有领土数据', () => {
    const sys = createSystem();
    expect(sys.getTotalTerritoryCount()).toBeGreaterThan(0);
  });

  it('reset 恢复初始状态', () => {
    const sys = createSystem();
    sys.captureTerritory('city-luoyang', 'player');
    expect(sys.getPlayerTerritoryCount()).toBe(1);

    sys.reset();
    expect(sys.getPlayerTerritoryCount()).toBe(0);
  });

  it('getState 返回完整状态', () => {
    const sys = createSystem();
    const state = sys.getState();
    expect(state).toHaveProperty('territories');
    expect(state).toHaveProperty('playerTerritoryIds');
    expect(state).toHaveProperty('productionSummary');
    expect(state.territories.length).toBeGreaterThan(0);
  });

  it('update 不抛异常', () => {
    const sys = createSystem();
    expect(() => sys.update(0.016)).not.toThrow();
  });
});
