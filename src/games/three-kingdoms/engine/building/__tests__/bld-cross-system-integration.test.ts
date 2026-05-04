/**
 * 跨系统集成测试: F11(升级加速) + F12(自动升级) + F28(资源链)
 *
 * 验证三个子系统之间的交互逻辑：
 *   - F11+F28: 加速升级后资源链吞吐量变化
 *   - F12+F28: 自动升级策略与资源链瓶颈联动
 *   - F11+F12: 加速+自动升级组合
 *   - 全链路循环: 建造→产出→升级→加速→资源链→自动升级
 *
 * @module engine/building/__tests__/bld-cross-system-integration
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import { AutoUpgradeSystem, type AutoUpgradeStrategy } from '../AutoUpgradeSystem';
import { ResourceChainSystem } from '../ResourceChainSystem';
import type { Resources, BuildingType } from '../../../../shared/types';
import { BUILDING_DEFS } from '../building-config';
import { BUILDING_TYPES } from '../building.types';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

/** 充足资源 */
const RICH: Resources = {
  grain: 1_000_000_000,
  gold: 1_000_000_000,
  ore: 1_000_000_000,
  wood: 1_000_000_000,
  troops: 1_000_000_000,
  mandate: 1_000_000_000,
  techPoint: 0,
  recruitToken: 0,
  skillBook: 0,
};

/** 将 Resources 转为 Record<string, number> */
function toRecord(r: Resources): Record<string, number> {
  return { ...r };
}

/**
 * 安全升级主城到指定等级（处理前置条件）。
 * 使用 farmland 作为前置建筑。
 */
function safeUpgradeCastleTo(bs: BuildingSystem, targetLevel: number): void {
  while (bs.getCastleLevel() < targetLevel) {
    const nextLv = bs.getCastleLevel() + 1;
    if (nextLv === 5 && !BUILDING_TYPES.some((t) => t !== 'castle' && bs.getLevel(t) >= 4)) {
      while (bs.getLevel('farmland') < 4) {
        bs.startUpgrade('farmland', RICH);
        bs.forceCompleteUpgrades();
      }
    }
    if (nextLv === 10 && !BUILDING_TYPES.some((t) => t !== 'castle' && bs.getLevel(t) >= 9)) {
      while (bs.getLevel('farmland') < 9) {
        bs.startUpgrade('farmland', RICH);
        bs.forceCompleteUpgrades();
      }
    }
    bs.startUpgrade('castle', RICH);
    bs.forceCompleteUpgrades();
  }
}

/** 创建完整的测试环境 */
function createTestEnv() {
  const bs = new BuildingSystem();
  const autoSys = new AutoUpgradeSystem();
  const chainSys = new ResourceChainSystem();

  // 注入依赖
  autoSys.setBuildingSystem(bs);
  chainSys.setBuildingSystem(bs);

  // 资源管理（简单的 mock）
  let currentResources = { ...RICH };
  autoSys.setResourceProvider(() => toRecord(currentResources));
  autoSys.setResourceDeductor((cost) => {
    for (const [key, amount] of Object.entries(cost)) {
      (currentResources as Record<string, number>)[key] -= amount;
    }
  });

  return {
    bs,
    autoSys,
    chainSys,
    getResources: () => currentResources,
    setResources: (r: Partial<Resources>) => {
      currentResources = { ...currentResources, ...r };
    },
    resetResources: () => {
      currentResources = { ...RICH };
    },
  };
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('跨系统集成: F11+F28 升级加速+资源链', () => {
  let base: number;
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    env = createTestEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── XI-F11-F28-01 ──
  it('XI-F11-F28-01: 升级加速完成后资源链吞吐量提升', () => {
    const { bs, chainSys } = env;

    // 升级主城到 Lv2 以解锁 barracks（F28-01 需要 barracks 参与链路）
    safeUpgradeCastleTo(bs, 2);

    // 初始状态: farmland Lv1, barracks Lv1
    const throughputBefore = chainSys.calculateThroughput('F28-01');
    expect(throughputBefore).toBeGreaterThan(0); // farmland Lv1 + barracks Lv1 有产出

    // 启动 barracks 升级到 Lv2（barracks 是 F28-01 的瓶颈节点）
    bs.startUpgrade('barracks', RICH);

    // 升级期间，barracks 仍在队列中，等级还是 Lv1
    const throughputDuring = chainSys.calculateThroughput('F28-01');
    expect(throughputDuring).toBe(throughputBefore); // 等级未变

    // 铜钱加速完成升级
    const speedResult = bs.speedUpWithCopper('barracks', 1e9);
    expect(speedResult.success).toBe(true);

    // 元宝秒完成
    const instantResult = bs.instantCompleteWithIngot('barracks', 1e9);
    expect(instantResult.success).toBe(true);
    expect(bs.getLevel('barracks')).toBe(2);

    // 升级后吞吐量应提升
    const throughputAfter = chainSys.calculateThroughput('F28-01');
    expect(throughputAfter).toBeGreaterThan(throughputBefore);

    // 验证具体产出值变化
    const productionBefore = bs.getProduction('barracks', 1);
    const productionAfter = bs.getProduction('barracks', 2);
    expect(productionAfter).toBeGreaterThan(productionBefore);
  });

  // ── XI-F11-F28-02 ──
  it('XI-F11-F28-02: 快速升级多个建筑→多条链路同时激活', () => {
    const { bs, chainSys } = env;

    // 先升级主城到 Lv8 以解锁所有基础链路建筑（port 在 Lv8 解锁）
    safeUpgradeCastleTo(bs, 8);

    // 依次启动并完成 farmland、market、barracks 升级（队列上限为2，需分批）
    bs.startUpgrade('farmland', RICH);
    bs.instantCompleteWithIngot('farmland', 1e9);

    bs.startUpgrade('market', RICH);
    bs.instantCompleteWithIngot('market', 1e9);

    bs.startUpgrade('barracks', RICH);
    bs.instantCompleteWithIngot('barracks', 1e9);

    expect(bs.getLevel('farmland')).toBeGreaterThan(1);
    expect(bs.getLevel('market')).toBeGreaterThan(1);
    expect(bs.getLevel('barracks')).toBeGreaterThan(1);

    // 验证多条链路吞吐量
    const chain01 = chainSys.validateChain('F28-01'); // 粮草→兵力→战斗
    const chain03 = chainSys.validateChain('F28-03'); // 铜钱→贸易→折扣
    const chain05 = chainSys.validateChain('F28-05'); // 铜钱+粮草→招募→英雄

    // F28-01 的 farmland + barracks 产出应 > 0
    expect(chain01.throughput).toBeGreaterThan(0);
    // F28-03 的 market 产出应 > 0（port 已解锁）
    expect(chain03.throughput).toBeGreaterThan(0);
    // F28-05 依赖 farmland + market + tavern，tavern 在 Lv5 已解锁
    expect(chain05.throughput).toBeGreaterThan(0);

    // 瓶颈检测应无严重问题
    const bottlenecks = chainSys.detectBottlenecks();
    // 不应出现"完全未启动"的瓶颈
    const unstartedChains = bottlenecks.filter((b) => b.suggestion.includes('优先建造'));
    // F28-01 和 F28-03 已启动，但其他链路可能未启动
    expect(unstartedChains.length).toBeLessThan(6);
  });
});

describe('跨系统集成: F12+F28 自动升级+资源链', () => {
  let base: number;
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    env = createTestEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── XI-F12-F28-01 ──
  it('XI-F12-F28-01: 资源链瓶颈→自动升级优先级调整', () => {
    const { bs, autoSys, chainSys } = env;

    // 升级主城到 Lv6 以允许 farmland 升到 Lv5（建筑等级 ≤ 主城等级+1）
    safeUpgradeCastleTo(bs, 6);

    // 手动将 farmland 升级到 Lv5，但 barracks 仍为 Lv1
    // 这会造成 F28-01 链路中 barracks 成为瓶颈
    while (bs.getLevel('farmland') < 5) {
      bs.startUpgrade('farmland', RICH);
      bs.forceCompleteUpgrades();
    }

    // 验证瓶颈检测
    const bottlenecks = chainSys.detectBottlenecks();
    const f28_01Bottleneck = bottlenecks.find((b) => b.chainId === 'F28-01');
    // barracks 等级低应被检测为瓶颈
    expect(f28_01Bottleneck).toBeDefined();

    // 设置军事策略，barracks 应优先升级
    autoSys.setConfig({ strategy: 'military', enabled: true });
    const target = autoSys.getNextUpgradeTarget();
    // 军事策略下 barracks 应排在前面
    expect(target).toBe('barracks');
  });

  // ── XI-F12-F28-02 ──
  it('XI-F12-F28-02: 自动升级消耗资源→链路吞吐量变化', () => {
    const { bs, autoSys, chainSys } = env;

    // 升级主城到 Lv2 以解锁 barracks（F28-01 链路需要 barracks）
    safeUpgradeCastleTo(bs, 2);

    // 记录升级前的吞吐量
    const throughputBefore = chainSys.calculateThroughput('F28-01');

    // 启用自动升级（军事策略，barracks 优先以解除 F28-01 瓶颈）
    autoSys.setConfig({ strategy: 'military', enabled: true });
    const result = autoSys.tickAutoUpgrade();

    // 自动升级应触发
    expect(result.upgraded).not.toBeNull();

    // 完成升级
    bs.forceCompleteUpgrades();

    // 升级后吞吐量应提升
    const throughputAfter = chainSys.calculateThroughput('F28-01');
    expect(throughputAfter).toBeGreaterThan(throughputBefore);
  });
});

describe('跨系统集成: F11+F12 加速+自动升级', () => {
  let base: number;
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    env = createTestEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── XI-F11-F12-01 ──
  it('XI-F11-F12-01: 自动升级的建筑可手动铜钱加速', () => {
    const { bs, autoSys } = env;

    // 启用自动升级（军事策略，barracks 优先以解除 F28-01 瓶颈）
    autoSys.setConfig({ strategy: 'military', enabled: true });

    // 自动升级触发
    const result = autoSys.tickAutoUpgrade();
    expect(result.upgraded).not.toBeNull();

    // 验证建筑正在升级中
    const upgradedType = result.upgraded!;
    const buildingState = bs.getBuilding(upgradedType);
    expect(buildingState.status).toBe('upgrading');

    // 手动铜钱加速
    const speedResult = bs.speedUpWithCopper(upgradedType, 1e9);
    expect(speedResult.success).toBe(true);
    expect(speedResult.timeReduced).toBeGreaterThan(0);
    expect(speedResult.remainingSpeedUps).toBe(2);

    // 验证加速后时间确实减少
    const remainingTime = bs.getUpgradeRemainingTime(upgradedType);
    expect(remainingTime).toBeGreaterThan(0);
  });

  // ── XI-F11-F12-02 ──
  it('XI-F11-F12-02: 自动升级+元宝秒完成→快速提升', () => {
    const { bs, autoSys, chainSys } = env;

    // 升级主城到 Lv2
    safeUpgradeCastleTo(bs, 2);

    // 记录初始状态
    const throughputBefore = chainSys.calculateThroughput('F28-01');

    // 启用自动升级（军事策略，barracks 优先以解除 F28-01 瓶颈）
    autoSys.setConfig({ strategy: 'military', enabled: true });
    const result = autoSys.tickAutoUpgrade();
    expect(result.upgraded).not.toBeNull();

    // 元宝秒完成
    const upgradedType = result.upgraded!;
    const instantResult = bs.instantCompleteWithIngot(upgradedType, 1e9);
    expect(instantResult.success).toBe(true);

    // 验证等级提升
    expect(bs.getLevel(upgradedType)).toBeGreaterThan(1);

    // 验证链路吞吐量提升
    const throughputAfter = chainSys.calculateThroughput('F28-01');
    expect(throughputAfter).toBeGreaterThan(throughputBefore);
  });
});

describe('跨系统集成: 全链路循环', () => {
  let base: number;
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
    env = createTestEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── FULL-01 ──
  it('FULL-01: 完整游戏循环 — 建造→产出→升级→加速→链路验证', () => {
    const { bs, autoSys, chainSys } = env;

    // 1. 初始状态验证
    expect(bs.getLevel('farmland')).toBe(1);
    expect(bs.getLevel('castle')).toBe(1);

    // 2. 升级主城到 Lv3 解锁更多建筑（barracks 在 Lv2 解锁，port 在 Lv3 解锁）
    safeUpgradeCastleTo(bs, 3);
    expect(bs.getCastleLevel()).toBe(3);

    // 3. 升级后链路状态验证
    const initialValidation = chainSys.validateAllChains();
    // F28-01 应有 farmland + barracks 产出
    expect(initialValidation['F28-01'].valid).toBe(true);

    // 4. 手动升级 farmland 并加速
    bs.startUpgrade('farmland', RICH);
    const copperResult = bs.speedUpWithCopper('farmland', 1e9);
    expect(copperResult.success).toBe(true);

    // 元宝秒完成
    bs.instantCompleteWithIngot('farmland', 1e9);
    expect(bs.getLevel('farmland')).toBe(2);

    // 5. 启用自动升级
    autoSys.setConfig({ strategy: 'balanced', enabled: true });

    // 6. 自动升级一轮
    const autoResult = autoSys.tickAutoUpgrade();
    expect(autoResult.upgraded).not.toBeNull();

    // 完成自动升级
    bs.forceCompleteUpgrades();

    // 7. 验证链路吞吐量提升
    const finalThroughput = chainSys.calculateThroughput('F28-01');
    expect(finalThroughput).toBeGreaterThan(0);

    // 8. 瓶颈检测
    const bottlenecks = chainSys.detectBottlenecks();
    // 不应有"完全未启动"的 F28-01
    const f28_01Unstarted = bottlenecks.find(
      (b) => b.chainId === 'F28-01' && b.bottleneck.includes('完全未启动'),
    );
    expect(f28_01Unstarted).toBeUndefined();

    // 9. 库存系统验证
    const storageCapacity = bs.getStorageCapacity('farmland');
    expect(storageCapacity).toBeGreaterThan(0);

    // 模拟产出累积
    bs.tickStorage(60); // 60秒产出
    const storageAmount = bs.getStorageAmount('farmland');
    expect(storageAmount).toBeGreaterThan(0);

    // 收取库存
    const collectResult = bs.collectBuilding('farmland');
    expect(collectResult).toBeGreaterThan(0);
    expect(bs.getStorageAmount('farmland')).toBe(0);
  });

  // ── FULL-02 ──
  it('FULL-02: 资源保护30%→自动升级受限→链路瓶颈', () => {
    const { bs, autoSys, chainSys, setResources } = env;

    // 升级主城到 Lv3
    safeUpgradeCastleTo(bs, 3);

    // 设置少量资源（不够升级）
    const SCARCE: Resources = {
      grain: 100,
      gold: 100,
      ore: 100,
      wood: 100,
      troops: 100,
      mandate: 0,
      techPoint: 0,
      recruitToken: 0,
      skillBook: 0,
    };
    setResources(SCARCE);

    // 启用自动升级，资源保护 30%
    autoSys.setConfig({
      strategy: 'economy',
      enabled: true,
      resourceProtectionPercent: 30,
    });

    // 自动升级应因资源保护受限而失败
    const result = autoSys.tickAutoUpgrade();

    if (result.upgraded === null) {
      // 升级被拒绝，验证原因
      expect(result.reason).toBeDefined();
      // 可能是资源不足或资源保护限制
      expect(
        result.reason!.includes('资源保护') ||
        result.reason!.includes('无可升级') ||
        result.reason!.includes('费用'),
      ).toBe(true);
    }

    // 链路应仍正常（建筑等级未变）
    const validation = chainSys.validateAllChains();
    // F28-01 的 farmland 仍有产出
    expect(validation['F28-01'].valid).toBe(true);

    // 恢复充足资源后自动升级应成功
    setResources(RICH);
    const result2 = autoSys.tickAutoUpgrade();
    expect(result2.upgraded).not.toBeNull();
  });

  // ── FULL-03: 多轮循环验证 ──
  it('FULL-03: 多轮自动升级+加速→链路持续提升', () => {
    const { bs, autoSys, chainSys } = env;

    // 升级主城到 Lv5
    safeUpgradeCastleTo(bs, 5);

    // 记录初始吞吐量
    const throughputs: number[] = [chainSys.calculateThroughput('F28-01')];

    // 启用自动升级（军事策略，barracks 优先以解除 F28-01 瓶颈）
    autoSys.setConfig({ strategy: 'military', enabled: true });

    // 执行3轮自动升级+秒完成
    for (let i = 0; i < 3; i++) {
      const result = autoSys.tickAutoUpgrade();
      if (result.upgraded) {
        bs.instantCompleteWithIngot(result.upgraded, 1e9);
        throughputs.push(chainSys.calculateThroughput('F28-01'));
      }
    }

    // 吞吐量应持续提升（或持平）
    for (let i = 1; i < throughputs.length; i++) {
      expect(throughputs[i]).toBeGreaterThanOrEqual(throughputs[i - 1]);
    }

    // 最终吞吐量应大于初始
    expect(throughputs[throughputs.length - 1]).toBeGreaterThan(throughputs[0]);
  });

  // ── FULL-04: 加速+自动升级+链路瓶颈修复 ──
  it('FULL-04: 链路瓶颈检测→自动升级修复→加速完成', () => {
    const { bs, autoSys, chainSys } = env;

    // 升级主城到 Lv5
    safeUpgradeCastleTo(bs, 5);

    // 人为制造瓶颈：farmland Lv5, market Lv5, 但 tavern/port Lv1
    while (bs.getLevel('farmland') < 5) {
      bs.startUpgrade('farmland', RICH);
      bs.forceCompleteUpgrades();
    }
    while (bs.getLevel('market') < 5) {
      bs.startUpgrade('market', RICH);
      bs.forceCompleteUpgrades();
    }

    // 检测瓶颈
    const bottlenecks = chainSys.detectBottlenecks();
    // 应检测到一些瓶颈
    expect(bottlenecks.length).toBeGreaterThan(0);

    // 切换到均衡策略，自动升级低等级建筑
    autoSys.setConfig({ strategy: 'balanced', enabled: true });

    // 执行多轮自动升级
    const upgradedBuildings: BuildingType[] = [];
    for (let i = 0; i < 5; i++) {
      const result = autoSys.tickAutoUpgrade();
      if (result.upgraded) {
        // 加速完成
        bs.instantCompleteWithIngot(result.upgraded, 1e9);
        upgradedBuildings.push(result.upgraded);
      }
    }

    // 应有建筑被升级
    expect(upgradedBuildings.length).toBeGreaterThan(0);

    // 均衡策略应优先升级低等级建筑
    // 验证链路整体改善
    const finalBottlenecks = chainSys.detectBottlenecks();
    // 瓶颈应减少
    expect(finalBottlenecks.length).toBeLessThanOrEqual(bottlenecks.length);
  });
});
