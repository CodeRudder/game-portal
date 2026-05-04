/**
 * AutoUpgradeSystem 单元测试
 * 覆盖：经济策略、军事策略、均衡策略、资源保护、排除建筑、启用/禁用、队列满、序列化/反序列化
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AutoUpgradeSystem } from '../AutoUpgradeSystem';
import type { AutoUpgradeStrategy } from '../AutoUpgradeSystem';
import { BuildingSystem } from '../BuildingSystem';
import type { BuildingType, Resources } from '../../../../shared/types';
import { BUILDING_TYPES } from '../building.types';
import { BUILDING_SAVE_VERSION } from '../building-config';

// ── 辅助工具 ──

/** 充足资源（足够支持高等级升级） */
const RICH: Resources = {
  grain: 1_000_000_000,
  gold: 1_000_000_000,
  ore: 1_000_000_000,
  wood: 1_000_000_000,
  troops: 1_000_000_000,
  mandate: 0,
  techPoint: 0,
  recruitToken: 0,
  skillBook: 0,
};

/** 少量资源 */
const POOR: Resources = {
  grain: 10,
  gold: 10,
  ore: 10,
  wood: 10,
  troops: 10,
  mandate: 0,
  techPoint: 0,
  recruitToken: 0,
  skillBook: 0,
};

/** 将 Resources 转为 Record<string, number> */
function toRecord(r: Resources): Record<string, number> {
  return { ...r };
}

/**
 * 安全升级主城到指定等级。
 * 处理主城前置条件：Lv4→5需一个建筑Lv4，Lv9→10需一个建筑Lv9。
 * 使用 farmland 作为前置建筑。
 */
function safeUpgradeCastleTo(bs: BuildingSystem, targetLevel: number): void {
  while (bs.getCastleLevel() < targetLevel) {
    const nextLv = bs.getCastleLevel() + 1;
    // 检查前置条件
    if (nextLv === 5 && !BUILDING_TYPES.some((t) => t !== 'castle' && bs.getLevel(t) >= 4)) {
      // 升级 farmland 到 Lv4
      while (bs.getLevel('farmland') < 4) {
        bs.startUpgrade('farmland', RICH);
        bs.forceCompleteUpgrades();
      }
    }
    if (nextLv === 10 && !BUILDING_TYPES.some((t) => t !== 'castle' && bs.getLevel(t) >= 9)) {
      // 升级 farmland 到 Lv9
      while (bs.getLevel('farmland') < 9) {
        bs.startUpgrade('farmland', RICH);
        bs.forceCompleteUpgrades();
      }
    }
    bs.startUpgrade('castle', RICH);
    bs.forceCompleteUpgrades();
  }
}

/** 创建已初始化的测试环境 */
function createSetup() {
  const autoSys = new AutoUpgradeSystem();
  const bs = new BuildingSystem();
  autoSys.setBuildingSystem(bs);

  let currentResources = { ...RICH };
  autoSys.setResourceProvider(() => toRecord(currentResources));
  autoSys.setResourceDeductor((cost) => {
    for (const [key, amount] of Object.entries(cost)) {
      (currentResources as Record<string, number>)[key] -= amount;
    }
  });

  return { autoSys, bs, getResources: () => currentResources, setResources: (r: Resources) => { currentResources = { ...r }; } };
}

describe('AutoUpgradeSystem', () => {
  let base: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    base = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(base);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础配置
  // ═══════════════════════════════════════════

  describe('配置管理', () => {
    it('默认配置为均衡策略、未启用、30%资源保护', () => {
      const sys = new AutoUpgradeSystem();
      const config = sys.getConfig();
      expect(config.strategy).toBe('balanced');
      expect(config.enabled).toBe(false);
      expect(config.resourceProtectionPercent).toBe(30);
      expect(config.excludedBuildings).toEqual([]);
      expect(config.maxCastleLevel).toBe(30);
    });

    it('setConfig 合并更新配置', () => {
      const sys = new AutoUpgradeSystem();
      sys.setConfig({ strategy: 'economy', resourceProtectionPercent: 50 });
      const config = sys.getConfig();
      expect(config.strategy).toBe('economy');
      expect(config.resourceProtectionPercent).toBe(50);
      expect(config.enabled).toBe(false); // 未修改
    });

    it('resourceProtectionPercent 钳制在 0~100', () => {
      const sys = new AutoUpgradeSystem();
      sys.setConfig({ resourceProtectionPercent: -10 });
      expect(sys.getConfig().resourceProtectionPercent).toBe(0);
      sys.setConfig({ resourceProtectionPercent: 150 });
      expect(sys.getConfig().resourceProtectionPercent).toBe(100);
    });

    it('enable/disable 切换启用状态', () => {
      const sys = new AutoUpgradeSystem();
      expect(sys.isEnabled()).toBe(false);
      sys.enable();
      expect(sys.isEnabled()).toBe(true);
      sys.disable();
      expect(sys.isEnabled()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 2. F12-01: 经济策略 — 优先升级 farmland/market
  // ═══════════════════════════════════════════

  describe('经济策略', () => {
    it('优先升级农田（farmland）', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true });

      const target = autoSys.getNextUpgradeTarget();
      expect(target).toBe('farmland');
    });

    it('农田满级后升级市集（market）', () => {
      const { autoSys, bs } = createSetup();
      // 先升级主城到足够高
      safeUpgradeCastleTo(bs, 26);
      // 将农田升到满级
      const maxLevel = 25;
      while (bs.getLevel('farmland') < maxLevel) {
        bs.startUpgrade('farmland', RICH);
        bs.forceCompleteUpgrades();
      }
      expect(bs.getLevel('farmland')).toBe(maxLevel);

      autoSys.setConfig({ strategy: 'economy', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      expect(target).toBe('market');
    });
  });

  // ═══════════════════════════════════════════
  // 3. F12-01: 军事策略 — 优先升级 barracks/wall
  // ═══════════════════════════════════════════

  describe('军事策略', () => {
    it('优先升级兵营（barracks）— 需要先解锁（主城Lv2）', () => {
      const { autoSys, bs } = createSetup();
      // barracks 需要主城Lv2解锁，先升级主城
      bs.startUpgrade('castle', RICH);
      base += 100000;
      vi.spyOn(Date, 'now').mockReturnValue(base);
      bs.tick();

      autoSys.setConfig({ strategy: 'military', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      expect(target).toBe('barracks');
    });

    it('兵营满级后升级城墙（wall）', () => {
      const { autoSys, bs } = createSetup();
      // 升级主城到足够高以解锁 barracks(Lv2) 和 wall(Lv5) 并支持满级
      safeUpgradeCastleTo(bs, 26);
      expect(bs.getCastleLevel()).toBeGreaterThanOrEqual(26);

      // barracks 满级
      const maxBarracks = 25;
      while (bs.getLevel('barracks') < maxBarracks) {
        bs.startUpgrade('barracks', RICH);
        bs.forceCompleteUpgrades();
      }
      expect(bs.getLevel('barracks')).toBe(maxBarracks);

      autoSys.setConfig({ strategy: 'military', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      expect(target).toBe('wall');
    });
  });

  // ═══════════════════════════════════════════
  // 4. F12-01: 均衡策略 — 优先升级最低等级建筑
  // ═══════════════════════════════════════════

  describe('均衡策略', () => {
    it('优先升级等级最低的建筑', () => {
      const { autoSys, bs } = createSetup();
      // 初始状态：farmland, market, mine, lumberMill 都是 Lv1
      // castle 也是 Lv1
      // 均衡策略应选择等级最低的，都是1级则按 BUILDING_TYPES 顺序
      autoSys.setConfig({ strategy: 'balanced', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      // castle 是 BUILDING_TYPES 第一个，等级也是1
      expect(target).toBeDefined();
      expect(typeof target).toBe('string');
    });

    it('等级不同时选择最低等级的', () => {
      const { autoSys, bs } = createSetup();
      // 先升级主城以解锁更多建筑
      bs.startUpgrade('castle', RICH);
      bs.forceCompleteUpgrades();
      // 升级农田到Lv3
      for (let i = 0; i < 2; i++) {
        bs.startUpgrade('farmland', RICH);
        bs.forceCompleteUpgrades();
      }
      expect(bs.getLevel('farmland')).toBe(3);

      autoSys.setConfig({ strategy: 'balanced', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      // market/mine/lumberMill 仍然是 Lv1，应该选其中一个
      expect(target).toBeDefined();
      expect(bs.getLevel(target!)).toBeLessThan(3);
    });
  });

  // ═══════════════════════════════════════════
  // 5. F12-02: 资源保护
  // ═══════════════════════════════════════════

  describe('资源保护', () => {
    it('保护30%资源不被消耗', () => {
      const { autoSys, bs, setResources } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 30 });

      // 获取farmland升级费用
      const cost = bs.getUpgradeCost('farmland');
      expect(cost).not.toBeNull();

      // 设置资源刚好够但不满足保护：当前资源 = 费用，保护30%后不够
      const requiredGrain = cost!.grain;
      const justEnough: Resources = { ...POOR, grain: requiredGrain, gold: cost!.gold + 1 };
      setResources(justEnough);

      // 30%保护后，可用grain = requiredGrain * 0.7 < requiredGrain
      expect(autoSys.canAffordWithProtection('farmland')).toBe(false);
    });

    it('资源充足时通过保护检查', () => {
      const { autoSys, bs } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 30 });

      // RICH 资源远超费用
      expect(autoSys.canAffordWithProtection('farmland')).toBe(true);
    });

    it('资源不足时跳过升级', () => {
      const { autoSys, setResources } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 30 });

      // 设置极少资源
      setResources(POOR);

      const result = autoSys.tickAutoUpgrade();
      expect(result.upgraded).toBeNull();
      expect(result.reason).toContain('资源保护');
    });

    it('0%保护等于不保护', () => {
      const { autoSys, bs, setResources } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 0 });

      const cost = bs.getUpgradeCost('farmland')!;
      const justEnough: Resources = { ...POOR, grain: cost.grain, gold: cost.gold };
      setResources(justEnough);

      expect(autoSys.canAffordWithProtection('farmland')).toBe(true);
    });

    it('100%保护等于完全不允许消耗', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 100 });

      // 100%保护下，任何有费用的建筑都无法升级
      expect(autoSys.canAffordWithProtection('farmland')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 排除建筑
  // ═══════════════════════════════════════════

  describe('排除建筑', () => {
    it('排除的建筑不参与自动升级', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({
        strategy: 'economy',
        enabled: true,
        excludedBuildings: ['farmland', 'market'],
      });

      const target = autoSys.getNextUpgradeTarget();
      expect(target).not.toBe('farmland');
      expect(target).not.toBe('market');
    });

    it('排除所有已解锁建筑时返回null', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({
        strategy: 'economy',
        enabled: true,
        excludedBuildings: ['farmland', 'market', 'mine', 'lumberMill', 'castle'],
      });

      const target = autoSys.getNextUpgradeTarget();
      // 剩余建筑可能都是locked（barracks需要主城Lv2）
      // 如果有unlocked的未被排除的，会返回它；否则null
      // 初始只有 castle, farmland, market, mine, lumberMill 解锁
      // 排除后没有可升级的
      expect(target).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 启用/禁用
  // ═══════════════════════════════════════════

  describe('启用/禁用', () => {
    it('禁用时不执行自动升级', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: false });

      const result = autoSys.tickAutoUpgrade();
      expect(result.upgraded).toBeNull();
      expect(result.reason).toContain('未启用');
    });

    it('启用后执行自动升级', () => {
      const { autoSys, bs } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true });

      const result = autoSys.tickAutoUpgrade();
      expect(result.upgraded).toBe('farmland');
      expect(result.cost.grain).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 队列已满
  // ═══════════════════════════════════════════

  describe('队列已满', () => {
    it('升级队列已满时不自动升级', () => {
      const { autoSys, bs } = createSetup();
      // 初始主城Lv1，队列只有1个槽位
      // 先手动升级一个建筑占满队列
      bs.startUpgrade('farmland', RICH);

      autoSys.setConfig({ strategy: 'economy', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      expect(target).toBeNull();

      const result = autoSys.tickAutoUpgrade();
      expect(result.upgraded).toBeNull();
      expect(result.reason).toContain('无可升级目标');
    });
  });

  // ═══════════════════════════════════════════
  // 9. 主城等级上限
  // ═══════════════════════════════════════════

  describe('主城等级上限', () => {
    it('主城达到maxCastleLevel时停止自动升级', () => {
      const { autoSys, bs } = createSetup();
      // 设置maxCastleLevel为1（当前主城Lv1）
      autoSys.setConfig({ strategy: 'economy', enabled: true, maxCastleLevel: 1 });

      const target = autoSys.getNextUpgradeTarget();
      // 主城已达到上限，但其他建筑不受此限制
      // 注意：maxCastleLevel只限制是否继续自动升级
      // 按需求理解为：主城达到阈值后整体停止
      expect(target).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 10. 序列化/反序列化
  // ═══════════════════════════════════════════

  describe('序列化/反序列化', () => {
    it('序列化后反序列化恢复配置', () => {
      const sys = new AutoUpgradeSystem();
      sys.setConfig({
        strategy: 'military',
        enabled: true,
        resourceProtectionPercent: 50,
        excludedBuildings: ['tavern', 'port'],
        maxCastleLevel: 20,
      });

      const serialized = sys.serialize();
      const sys2 = new AutoUpgradeSystem();
      sys2.deserialize(serialized);

      const config = sys2.getConfig();
      expect(config.strategy).toBe('military');
      expect(config.enabled).toBe(true);
      expect(config.resourceProtectionPercent).toBe(50);
      expect(config.excludedBuildings).toEqual(['tavern', 'port']);
      expect(config.maxCastleLevel).toBe(20);
    });

    it('反序列化无效数据不崩溃', () => {
      const sys = new AutoUpgradeSystem();
      sys.setConfig({ strategy: 'economy', enabled: true });

      // 无效JSON
      expect(() => sys.deserialize('not json')).not.toThrow();
      expect(sys.getConfig().strategy).toBe('economy'); // 保持原配置

      // 空对象
      expect(() => sys.deserialize('{}')).not.toThrow();
    });

    it('reset 恢复默认配置', () => {
      const sys = new AutoUpgradeSystem();
      sys.setConfig({ strategy: 'military', enabled: true, excludedBuildings: ['castle'] });
      sys.reset();

      const config = sys.getConfig();
      expect(config.strategy).toBe('balanced');
      expect(config.enabled).toBe(false);
      expect(config.excludedBuildings).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 完整执行流程
  // ═══════════════════════════════════════════

  describe('完整执行流程', () => {
    it('tickAutoUpgrade 成功升级并扣除资源', () => {
      const { autoSys, getResources } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true });

      const beforeGrain = getResources().grain;
      const result = autoSys.tickAutoUpgrade();

      expect(result.upgraded).toBe('farmland');
      expect(result.cost.grain).toBeGreaterThan(0);
      expect(getResources().grain).toBeLessThan(beforeGrain);
    });

    it('连续两次 tickAutoUpgrade，第二次因队列满而跳过', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true });

      // 第一次升级成功
      const result1 = autoSys.tickAutoUpgrade();
      expect(result1.upgraded).toBe('farmland');

      // 队列已满（主城Lv1只有1个槽位），第二次无法升级
      const result2 = autoSys.tickAutoUpgrade();
      expect(result2.upgraded).toBeNull();
    });

    it('未注入建筑系统时返回错误', () => {
      const sys = new AutoUpgradeSystem();
      sys.enable();
      const result = sys.tickAutoUpgrade();
      expect(result.upgraded).toBeNull();
      expect(result.reason).toContain('建筑系统');
    });
  });

  // ═══════════════════════════════════════════
  // F12 边界场景（Sprint B iteration 3）
  // ═══════════════════════════════════════════

  describe('F12 边界场景', () => {
    // B1: 所有建筑满级时自动升级
    it('F12-edge-01: 所有建筑满级→getNextUpgradeTarget返回null', () => {
      const { autoSys, bs } = createSetup();
      // 升级主城到满级（Lv30）
      safeUpgradeCastleTo(bs, 30);

      // 将所有已解锁建筑升到各自满级
      for (const t of BUILDING_TYPES) {
        const def = bs.getBuildingDef(t);
        if (!def) continue;
        while (bs.getLevel(t) < def.maxLevel) {
          if (bs.isUnlocked(t) && bs.getUpgradeCost(t)) {
            bs.startUpgrade(t, RICH);
            bs.forceCompleteUpgrades();
          } else {
            break;
          }
        }
      }

      autoSys.setConfig({ strategy: 'economy', enabled: true });
      const target = autoSys.getNextUpgradeTarget();
      // 所有建筑满级后应无升级目标
      expect(target).toBeNull();
    });

    // B2: 资源为0时资源保护
    it('F12-edge-02: 资源为0时canAffordWithProtection返回false', () => {
      const { autoSys, setResources } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 30 });

      // 设置所有资源为0
      const zeroResources: Resources = {
        grain: 0, gold: 0, ore: 0, wood: 0, troops: 0,
        mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
      };
      setResources(zeroResources);

      expect(autoSys.canAffordWithProtection('farmland')).toBe(false);
    });

    // B3: 策略切换后优先级变化
    it('F12-edge-03: 策略从economy→military→目标变化', () => {
      const { autoSys, bs } = createSetup();
      // 先升级主城以解锁 barracks
      bs.startUpgrade('castle', RICH);
      bs.forceCompleteUpgrades();

      // economy 策略应优先 farmland
      autoSys.setConfig({ strategy: 'economy', enabled: true });
      const economyTarget = autoSys.getNextUpgradeTarget();
      expect(economyTarget).toBe('farmland');

      // 切换到 military 策略应优先 barracks
      autoSys.setConfig({ strategy: 'military', enabled: true });
      const militaryTarget = autoSys.getNextUpgradeTarget();
      expect(militaryTarget).toBe('barracks');
      expect(militaryTarget).not.toBe(economyTarget);
    });

    // B4: 保护比例为0%时
    it('F12-edge-04: protectionPercent=0→不保护任何资源', () => {
      const { autoSys, bs, setResources } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 0 });

      const cost = bs.getUpgradeCost('farmland')!;
      // 设置资源刚好等于费用
      const exactResources: Resources = {
        ...POOR,
        grain: cost.grain,
        gold: cost.gold,
      };
      setResources(exactResources);

      // 0%保护时，资源刚好够就通过
      expect(autoSys.canAffordWithProtection('farmland')).toBe(true);
    });

    // B5: 保护比例为100%时
    it('F12-edge-05: protectionPercent=100→所有资源被保护', () => {
      const { autoSys } = createSetup();
      autoSys.setConfig({ strategy: 'economy', enabled: true, resourceProtectionPercent: 100 });

      // 即使资源充足，100%保护下也无法通过
      expect(autoSys.canAffordWithProtection('farmland')).toBe(false);
      expect(autoSys.canAffordWithProtection('castle')).toBe(false);
    });

    // B6: 排除所有建筑时
    it('F12-edge-06: excludedBuildings包含所有建筑→无升级目标', () => {
      const { autoSys } = createSetup();
      // 排除所有建筑类型（使用 BUILDING_TYPES）
      autoSys.setConfig({
        strategy: 'economy',
        enabled: true,
        excludedBuildings: [...BUILDING_TYPES],
      });

      const target = autoSys.getNextUpgradeTarget();
      expect(target).toBeNull();

      const result = autoSys.tickAutoUpgrade();
      expect(result.upgraded).toBeNull();
    });
  });
});
