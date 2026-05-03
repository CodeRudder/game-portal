/**
 * ResourceChainSystem 单元测试
 * 覆盖：基础功能、链路验证、瓶颈检测、吞吐量计算、集成场景
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ResourceChainSystem } from '../ResourceChainSystem';
import type {
  ResourceChain,
  ChainValidationResult,
  AllChainsValidation,
  BottleneckReport,
} from '../ResourceChainSystem';
import type { BuildingType } from '../../../../shared/types';

// ─────────────────────────────────────────────
// Mock BuildingSystem
// ─────────────────────────────────────────────

/** 创建一个 mock BuildingSystem，可自定义每栋建筑的等级和产出 */
function createMockBuildingSystem(
  levels: Partial<Record<BuildingType, number>> = {},
  productions: Partial<Record<string, number>> = {},
) {
  return {
    getLevel: vi.fn((type: BuildingType) => levels[type] ?? 0),
    getProduction: vi.fn((type: BuildingType, _level?: number) => {
      // 如果提供了 level 参数，使用 type+level 作为 key
      const lv = _level ?? levels[type] ?? 0;
      if (lv <= 0) return 0;
      return productions[`${type}_lv${lv}`] ?? productions[type] ?? lv * 10;
    }),
  } as any;
}

/** 创建一个所有建筑都达到指定等级的 mock */
function createAllLevelMock(level: number, productionPerLevel: number = 10) {
  const levels: Record<string, number> = {};
  const productions: Record<string, number> = {};
  const types: BuildingType[] = [
    'castle', 'farmland', 'barracks', 'mine', 'lumberMill',
    'workshop', 'market', 'port', 'academy', 'tavern', 'wall',
    'clinic', 'stable', 'armory', 'watchtower', 'warehouse',
    'diplomaticHall', 'prison', 'treasury', 'shrine',
  ];
  for (const t of types) {
    levels[t] = level;
    productions[t] = level * productionPerLevel;
  }
  return createMockBuildingSystem(levels, productions);
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('ResourceChainSystem - 基础功能', () => {
  let system: ResourceChainSystem;

  beforeEach(() => {
    system = new ResourceChainSystem();
  });

  it('初始化：默认配置正确，包含 6 条链路', () => {
    const chains = system.getChainDefinitions();
    expect(chains).toHaveLength(6);
    const ids = chains.map(c => c.id).sort();
    expect(ids).toEqual(['F28-01', 'F28-02', 'F28-03', 'F28-04', 'F28-05', 'F28-06']);
  });

  it('初始化：每条链路都有名称和节点', () => {
    const chains = system.getChainDefinitions();
    for (const chain of chains) {
      expect(chain.name).toBeTruthy();
      expect(chain.nodes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('setBuildingSystem：依赖注入成功', () => {
    const mock = createMockBuildingSystem();
    expect(() => system.setBuildingSystem(mock)).not.toThrow();
  });

  it('setResourceSystem：依赖注入成功', () => {
    const mockResource = { getResource: vi.fn() };
    expect(() => system.setResourceSystem(mockResource)).not.toThrow();
  });

  it('序列化/反序列化：数据一致', () => {
    // 手动设置瓶颈数据
    const chains = system.getChainDefinitions();
    expect(chains).toBeDefined();

    // 序列化默认状态
    const serialized = system.serialize();
    const parsed = JSON.parse(serialized);
    expect(Object.keys(parsed)).toHaveLength(6);

    // 反序列化回来
    const system2 = new ResourceChainSystem();
    system2.deserialize(serialized);
    const reserialized = system2.serialize();
    expect(reserialized).toEqual(serialized);
  });

  it('序列化：包含所有链路 ID', () => {
    const serialized = system.serialize();
    const parsed = JSON.parse(serialized);
    expect(parsed['F28-01']).toBeDefined();
    expect(parsed['F28-02']).toBeDefined();
    expect(parsed['F28-03']).toBeDefined();
    expect(parsed['F28-04']).toBeDefined();
    expect(parsed['F28-05']).toBeDefined();
    expect(parsed['F28-06']).toBeDefined();
  });

  it('反序列化：无效 JSON 不崩溃', () => {
    expect(() => system.deserialize('not valid json')).not.toThrow();
  });

  it('reset：重置后所有链路瓶颈为空', () => {
    system.reset();
    const serialized = system.serialize();
    const parsed = JSON.parse(serialized);
    for (const val of Object.values(parsed) as { bottlenecks: string[] }[]) {
      expect(val.bottlenecks).toEqual([]);
    }
  });

  it('getChain：返回正确的链路定义', () => {
    const chain = system.getChain('F28-01');
    expect(chain).toBeDefined();
    expect(chain!.id).toBe('F28-01');
    expect(chain!.name).toBe('粮草→兵力→战斗链');
  });

  it('getChain：不存在的 ID 返回 undefined', () => {
    const chain = system.getChain('F28-99');
    expect(chain).toBeUndefined();
  });

  it('无 BuildingSystem 时所有速率为 0', () => {
    const chains = system.getChainDefinitions();
    for (const chain of chains) {
      for (const node of chain.nodes) {
        expect(node.rate).toBe(0);
      }
    }
  });
});

describe('ResourceChainSystem - 链路验证', () => {
  let system: ResourceChainSystem;

  beforeEach(() => {
    system = new ResourceChainSystem();
  });

  it('validateChain F28-01: farmland→barracks（正常链路）', () => {
    const mock = createMockBuildingSystem(
      { farmland: 3, barracks: 2 },
      { farmland: 30, barracks: 20 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-01');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
    expect(result.throughput).toBeGreaterThan(0);
  });

  it('validateChain F28-02: mine+lumberMill→workshop（三输入链路）', () => {
    const mock = createMockBuildingSystem(
      { mine: 2, lumberMill: 2, workshop: 2 },
      { mine: 20, lumberMill: 20, workshop: 20 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-02');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
  });

  it('validateChain F28-03: market→port', () => {
    const mock = createMockBuildingSystem(
      { market: 3, port: 2 },
      { market: 30, port: 20 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-03');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
  });

  it('validateChain F28-04: academy 科技链（单节点）', () => {
    const mock = createMockBuildingSystem(
      { academy: 5 },
      { academy: 50 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-04');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
  });

  it('validateChain F28-05: farmland+market→tavern', () => {
    const mock = createMockBuildingSystem(
      { farmland: 3, market: 3, tavern: 2 },
      { farmland: 30, market: 30, tavern: 20 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-05');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
  });

  it('validateChain F28-06: mine+lumberMill→wall', () => {
    const mock = createMockBuildingSystem(
      { mine: 2, lumberMill: 2, wall: 2 },
      { mine: 20, lumberMill: 20, wall: 20 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-06');
    expect(result.valid).toBe(true);
    expect(result.bottlenecks).toHaveLength(0);
  });

  it('validateAllChains：6 条全验证', () => {
    const mock = createAllLevelMock(3, 10);
    system.setBuildingSystem(mock);

    const result = system.validateAllChains();
    expect(Object.keys(result)).toHaveLength(6);
    for (const chainId of ['F28-01', 'F28-02', 'F28-03', 'F28-04', 'F28-05', 'F28-06']) {
      expect(result[chainId]).toBeDefined();
      expect(result[chainId].valid).toBe(true);
    }
  });

  it('源建筑等级为 0 时链路不通', () => {
    const mock = createMockBuildingSystem(
      { farmland: 0, barracks: 3 },
      { farmland: 0, barracks: 30 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-01');
    expect(result.valid).toBe(false);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.bottlenecks.some(b => b.includes('farmland'))).toBe(true);
  });

  it('目标建筑等级为 0 时链路不通', () => {
    const mock = createMockBuildingSystem(
      { farmland: 3, barracks: 0 },
      { farmland: 30, barracks: 0 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-01');
    expect(result.valid).toBe(false);
    expect(result.bottlenecks.some(b => b.includes('barracks'))).toBe(true);
  });

  it('不存在的链路 ID 返回无效结果', () => {
    const result = system.validateChain('F28-99');
    expect(result.valid).toBe(false);
    expect(result.throughput).toBe(0);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
  });

  it('无 BuildingSystem 时所有链路无效', () => {
    const result = system.validateAllChains();
    for (const chainResult of Object.values(result)) {
      expect(chainResult.valid).toBe(false);
    }
  });
});

describe('ResourceChainSystem - 瓶颈检测', () => {
  let system: ResourceChainSystem;

  beforeEach(() => {
    system = new ResourceChainSystem();
  });

  it('资源过剩瓶颈：产出端远大于消费端', () => {
    const mock = createMockBuildingSystem(
      { farmland: 10, barracks: 2 },
      { farmland: 100, barracks: 20 },
    );
    system.setBuildingSystem(mock);

    const reports = system.detectBottlenecks();
    const surplusReport = reports.find(r =>
      r.chainId === 'F28-01' && r.bottleneck.includes('资源过剩'),
    );
    expect(surplusReport).toBeDefined();
    expect(surplusReport!.suggestion).toContain('升级');
  });

  it('供给不足瓶颈：消费端需求大于产出', () => {
    const mock = createMockBuildingSystem(
      { farmland: 1, barracks: 10 },
      { farmland: 10, barracks: 100 },
    );
    system.setBuildingSystem(mock);

    const reports = system.detectBottlenecks();
    const supplyReport = reports.find(r =>
      r.chainId === 'F28-01' && r.bottleneck.includes('供给不足'),
    );
    expect(supplyReport).toBeDefined();
    expect(supplyReport!.suggestion).toContain('升级');
  });

  it('链路未启动：源建筑未建造', () => {
    const mock = createMockBuildingSystem(
      { farmland: 0, barracks: 0 },
      { farmland: 0, barracks: 0 },
    );
    system.setBuildingSystem(mock);

    const reports = system.detectBottlenecks();
    const notStarted = reports.find(r =>
      r.chainId === 'F28-01' && r.bottleneck.includes('未启动'),
    );
    expect(notStarted).toBeDefined();
    expect(notStarted!.suggestion).toContain('建造');
  });

  it('detectBottlenecks 返回正确的瓶颈信息结构', () => {
    const mock = createAllLevelMock(1, 10);
    system.setBuildingSystem(mock);

    const reports = system.detectBottlenecks();
    expect(Array.isArray(reports)).toBe(true);
    for (const report of reports) {
      expect(report).toHaveProperty('chainId');
      expect(report).toHaveProperty('bottleneck');
      expect(report).toHaveProperty('suggestion');
      expect(typeof report.chainId).toBe('string');
      expect(typeof report.bottleneck).toBe('string');
      expect(typeof report.suggestion).toBe('string');
    }
  });

  it('所有建筑等级为 0 时每条链路都有未启动报告', () => {
    const mock = createMockBuildingSystem({}, {});
    system.setBuildingSystem(mock);

    const reports = system.detectBottlenecks();
    const chainIds = new Set(reports.map(r => r.chainId));
    // 所有 6 条链路应该都有未启动报告
    expect(chainIds.size).toBe(6);
  });

  it('源头建筑未建造时报告上游供给缺失', () => {
    const mock = createMockBuildingSystem(
      { mine: 0, lumberMill: 3, workshop: 3 },
      { mine: 0, lumberMill: 30, workshop: 30 },
    );
    system.setBuildingSystem(mock);

    const reports = system.detectBottlenecks();
    const mineReport = reports.find(r =>
      r.chainId === 'F28-02' && r.bottleneck.includes('mine'),
    );
    expect(mineReport).toBeDefined();
  });
});

describe('ResourceChainSystem - 吞吐量计算', () => {
  let system: ResourceChainSystem;

  beforeEach(() => {
    system = new ResourceChainSystem();
  });

  it('calculateThroughput：取瓶颈节点产出', () => {
    const mock = createMockBuildingSystem(
      { farmland: 5, barracks: 3 },
      { farmland: 50, barracks: 30 },
    );
    system.setBuildingSystem(mock);

    const throughput = system.calculateThroughput('F28-01');
    // 吞吐量应取最小值
    expect(throughput).toBeGreaterThan(0);
    expect(throughput).toBeLessThanOrEqual(30);
  });

  it('单链路吞吐量：F28-04 academy 单节点', () => {
    const mock = createMockBuildingSystem(
      { academy: 5 },
      { academy: 50 },
    );
    system.setBuildingSystem(mock);

    const throughput = system.calculateThroughput('F28-04');
    expect(throughput).toBe(50);
  });

  it('多输入链路吞吐量(取最小)：F28-02 mine+lumberMill→workshop', () => {
    const mock = createMockBuildingSystem(
      { mine: 3, lumberMill: 5, workshop: 4 },
      { mine: 30, lumberMill: 50, workshop: 40 },
    );
    system.setBuildingSystem(mock);

    const throughput = system.calculateThroughput('F28-02');
    // 吞吐量应受限于最小产出节点 (mine: 30)
    expect(throughput).toBeLessThanOrEqual(30);
  });

  it('链路断开时吞吐量为 0', () => {
    const mock = createMockBuildingSystem(
      { farmland: 0, barracks: 3 },
      { farmland: 0, barracks: 30 },
    );
    system.setBuildingSystem(mock);

    const throughput = system.calculateThroughput('F28-01');
    expect(throughput).toBe(0);
  });

  it('不存在的链路吞吐量为 0', () => {
    const throughput = system.calculateThroughput('F28-99');
    expect(throughput).toBe(0);
  });

  it('建筑等级越高吞吐量越大', () => {
    // 低等级
    const mockLow = createMockBuildingSystem(
      { farmland: 1, barracks: 1 },
      { farmland: 10, barracks: 10 },
    );
    system.setBuildingSystem(mockLow);
    const lowThroughput = system.calculateThroughput('F28-01');

    // 高等级
    const mockHigh = createMockBuildingSystem(
      { farmland: 5, barracks: 5 },
      { farmland: 50, barracks: 50 },
    );
    system.setBuildingSystem(mockHigh);
    const highThroughput = system.calculateThroughput('F28-01');

    expect(highThroughput).toBeGreaterThan(lowThroughput);
  });
});

describe('ResourceChainSystem - 集成场景', () => {
  let system: ResourceChainSystem;

  beforeEach(() => {
    system = new ResourceChainSystem();
  });

  it('完整链路循环：farmland 产出 grain → barracks 消耗 grain 训练', () => {
    const mock = createMockBuildingSystem(
      { farmland: 3, barracks: 3 },
      { farmland: 30, barracks: 30 },
    );
    system.setBuildingSystem(mock);

    // 验证链路
    const result = system.validateChain('F28-01');
    expect(result.valid).toBe(true);

    // 检查吞吐量
    const throughput = system.calculateThroughput('F28-01');
    expect(throughput).toBeGreaterThan(0);

    // 检查无瓶颈
    const reports = system.detectBottlenecks();
    const f28_01Reports = reports.filter(r => r.chainId === 'F28-01');
    // 均衡等级不应有过剩/不足报告
    expect(f28_01Reports.every(r =>
      !r.bottleneck.includes('过剩') && !r.bottleneck.includes('不足'),
    )).toBe(true);
  });

  it('多链路并行：同时运行多条链路', () => {
    const mock = createAllLevelMock(3, 10);
    system.setBuildingSystem(mock);

    const allResults = system.validateAllChains();
    const validCount = Object.values(allResults).filter(r => r.valid).length;
    expect(validCount).toBe(6);
  });

  it('链路升级：建筑升级后吞吐量提升', () => {
    // 初始等级
    const mock1 = createMockBuildingSystem(
      { farmland: 1, barracks: 1 },
      { farmland: 10, barracks: 10 },
    );
    system.setBuildingSystem(mock1);
    const t1 = system.calculateThroughput('F28-01');

    // 升级后
    const mock2 = createMockBuildingSystem(
      { farmland: 5, barracks: 5 },
      { farmland: 50, barracks: 50 },
    );
    system.setBuildingSystem(mock2);
    const t2 = system.calculateThroughput('F28-01');

    expect(t2).toBeGreaterThan(t1);
  });

  it('链路断裂修复：建造缺失建筑后链路恢复', () => {
    // 阶段 1：缺少 workshop
    const mockBroken = createMockBuildingSystem(
      { mine: 3, lumberMill: 3, workshop: 0 },
      { mine: 30, lumberMill: 30, workshop: 0 },
    );
    system.setBuildingSystem(mockBroken);

    const brokenResult = system.validateChain('F28-02');
    expect(brokenResult.valid).toBe(false);
    expect(brokenResult.throughput).toBe(0);

    // 阶段 2：建造 workshop
    const mockFixed = createMockBuildingSystem(
      { mine: 3, lumberMill: 3, workshop: 3 },
      { mine: 30, lumberMill: 30, workshop: 30 },
    );
    system.setBuildingSystem(mockFixed);

    const fixedResult = system.validateChain('F28-02');
    expect(fixedResult.valid).toBe(true);
    expect(fixedResult.throughput).toBeGreaterThan(0);
  });

  it('序列化后恢复状态一致', () => {
    const mock = createAllLevelMock(3, 10);
    system.setBuildingSystem(mock);

    // 触发一些操作
    system.validateAllChains();
    system.detectBottlenecks();

    // 序列化
    const serialized = system.serialize();

    // 新系统反序列化
    const system2 = new ResourceChainSystem();
    system2.deserialize(serialized);

    // 验证链路定义不变
    const chains1 = system.getChainDefinitions();
    const chains2 = system2.getChainDefinitions();
    expect(chains1.map(c => c.id)).toEqual(chains2.map(c => c.id));
  });

  it('F28-05 多源链路：farmland+market 同时供给 tavern', () => {
    // 只有 farmland，缺少 market
    const mockPartial = createMockBuildingSystem(
      { farmland: 3, market: 0, tavern: 3 },
      { farmland: 30, market: 0, tavern: 30 },
    );
    system.setBuildingSystem(mockPartial);

    const result = system.validateChain('F28-05');
    expect(result.valid).toBe(false);
    expect(result.bottlenecks.some(b => b.includes('market'))).toBe(true);

    // 补上 market
    const mockFull = createMockBuildingSystem(
      { farmland: 3, market: 3, tavern: 3 },
      { farmland: 30, market: 30, tavern: 30 },
    );
    system.setBuildingSystem(mockFull);

    const result2 = system.validateChain('F28-05');
    expect(result2.valid).toBe(true);
  });

  it('F28-06 城防链：mine+lumberMill→wall 完整验证', () => {
    const mock = createMockBuildingSystem(
      { mine: 4, lumberMill: 4, wall: 3 },
      { mine: 40, lumberMill: 40, wall: 30 },
    );
    system.setBuildingSystem(mock);

    const result = system.validateChain('F28-06');
    expect(result.valid).toBe(true);
    expect(result.throughput).toBeGreaterThan(0);
  });

  it('反复 reset 不影响链路定义', () => {
    system.reset();
    system.reset();
    system.reset();

    const chains = system.getChainDefinitions();
    expect(chains).toHaveLength(6);
    for (const chain of chains) {
      expect(chain.nodes.length).toBeGreaterThanOrEqual(1);
    }
  });
});
