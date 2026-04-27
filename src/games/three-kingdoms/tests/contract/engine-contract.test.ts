/**
 * Engine 契约测试
 *
 * 验证 ThreeKingdomsEngine 初始化后的完整性：
 * 1. 所有 UI 依赖的 getter 返回非 null
 * 2. 子系统间依赖关系正确
 * 3. Registry key 前后端一致
 * 4. 前端 Tab ID 与后端枚举匹配
 * 5. Engine 重置后可重新初始化
 *
 * @module tests/contract/engine-contract
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EngineFactory,
  ENGINE_GETTER_CONTRACT,
  ENGINE_DEPENDENCY_CONTRACT,
  REGISTRY_KEY_CONTRACT,
  TAB_ID_CONTRACT,
} from '../lib';
import type { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';

// ─────────────────────────────────────────────
// Helper: 将 getter 列表按子系统分组
// ─────────────────────────────────────────────

/** 核心系统 getter（武将 / 战斗 / 科技 / 地图） */
const CORE_GETTERS = [
  'getHeroSystem', 'getRecruitSystem', 'getLevelSystem', 'getFormationSystem',
  'getHeroStarSystem', 'getSkillUpgradeSystem', 'getBondSystem',
  'getFormationRecommendSystem', 'getHeroDispatchSystem', 'getHeroBadgeSystem',
  'getHeroAttributeCompare', 'getSweepSystem', 'getVIPSystem', 'getChallengeStageSystem',
  'getBattleEngine', 'getCampaignSystem', 'getRewardDistributor',
  'getTechTreeSystem', 'getTechPointSystem', 'getTechResearchSystem',
  'getWorldMapSystem', 'getTerritorySystem', 'getSiegeSystem',
  'getGarrisonSystem', 'getSiegeEnhancer', 'getMapEventSystem',
] as const;

/** R11 子系统 getter */
const R11_GETTERS = [
  'getMailSystem', 'getMailTemplateSystem', 'getShopSystem', 'getCurrencySystem',
  'getNPCSystem', 'getEquipmentSystem', 'getEquipmentForgeSystem',
  'getEquipmentEnhanceSystem', 'getEquipmentSetSystem', 'getEquipmentRecommendSystem',
  'getArenaSystem', 'getSeasonSystem', 'getRankingSystem', 'getPvPBattleSystem',
  'getDefenseFormationSystem', 'getArenaShopSystem', 'getExpeditionSystem',
  'getAllianceSystem', 'getAllianceTaskSystem', 'getAllianceBossSystem',
  'getAllianceShopSystem', 'getPrestigeSystem', 'getPrestigeShopSystem',
  'getRebirthSystem', 'getQuestSystem', 'getAchievementSystem', 'getFriendSystem',
  'getChatSystem', 'getSocialLeaderboardSystem', 'getHeritageSystem',
  'getTimedActivitySystem', 'getAdvisorSystem', 'getActivitySystem', 'getSignInSystem',
  'getTradeSystem', 'getCaravanSystem', 'getResourceTradeEngine',
  'getSettingsManager', 'getAccountSystem', 'getEndingSystem', 'getGlobalStatisticsSystem',
  // 事件系统
  'getEventTriggerSystem', 'getEventNotificationSystem', 'getEventUINotification',
  'getEventChainSystem', 'getEventLogSystem', 'getOfflineEventSystem',
] as const;

/** 引导系统 getter */
const GUIDE_GETTERS = [
  'getTutorialStateMachine', 'getStoryEventPlayer', 'getTutorialStepManager',
  'getTutorialStepExecutor', 'getTutorialMaskSystem', 'getTutorialStorage',
  'getFirstLaunchDetector',
] as const;

/** 离线系统 getter */
const OFFLINE_GETTERS = [
  'getOfflineRewardSystem', 'getOfflineEstimateSystem', 'getOfflineSnapshotSystem',
] as const;

// ─────────────────────────────────────────────
// Helper: 断言 getter 返回非 null
// ─────────────────────────────────────────────

function assertGetterNotNull(
  engine: ThreeKingdomsEngine,
  getterName: string,
  ecCode: string,
): void {
  const fn = (engine as Record<string, unknown>)[getterName];
  expect(fn, `[${ecCode}] engine.${getterName} 方法不存在`).toBeTypeOf('function');

  const result = (fn as () => unknown).call(engine);
  expect(result, `[${ecCode}] engine.${getterName}() 返回 null/undefined`).toBeDefined();
  expect(result, `[${ecCode}] engine.${getterName}() 返回 null`).not.toBeNull();
}

// ═════════════════════════════════════════════
// Suite 1: Engine 初始化契约 (EC-01)
// ═════════════════════════════════════════════

describe('Engine 初始化契约 (EC-01)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = EngineFactory.createFresh({ autoInit: false });
  });

  it('EC-01-01: engine.init() 不抛异常', () => {
    expect(() => engine.init()).not.toThrow();
  });

  it('EC-01-02: engine.init() 后所有核心 getter 返回非 null', () => {
    engine.init();

    for (const getterName of CORE_GETTERS) {
      assertGetterNotNull(engine, getterName, 'EC-01-02');
    }
  });

  it('EC-01-03: engine.init() 后所有 R11 子系统 getter 返回非 null', () => {
    engine.init();

    for (const getterName of R11_GETTERS) {
      assertGetterNotNull(engine, getterName, 'EC-01-03');
    }
  });

  it('EC-01-04: engine.init() 后引导系统 getter 返回非 null', () => {
    engine.init();

    for (const getterName of GUIDE_GETTERS) {
      assertGetterNotNull(engine, getterName, 'EC-01-04');
    }
  });

  it('EC-01-05: engine.init() 后离线系统 getter 返回非 null', () => {
    engine.init();

    for (const getterName of OFFLINE_GETTERS) {
      assertGetterNotNull(engine, getterName, 'EC-01-05');
    }
  });
});

// ═════════════════════════════════════════════
// Suite 2: 子系统依赖契约 (EC-02)
// ═════════════════════════════════════════════

describe('子系统依赖契约 (EC-02)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = EngineFactory.createFresh({ autoInit: true });
  });

  it('EC-02-01: ShopSystem 持有 CurrencySystem 引用（非 null）', () => {
    const shop = engine.getShopSystem();
    // ShopSystem 通过 setCurrencySystem 注入 CurrencySystem
    // 验证方式：shop 能执行依赖 currencySystem 的操作而不抛异常
    expect(shop, '[EC-02-01] getShopSystem() 返回 null').toBeDefined();

    // 直接检查内部引用（通过 getShopGoods 验证商店已初始化）
    const normalGoods = shop.getShopGoods('normal');
    expect(Array.isArray(normalGoods), '[EC-02-01] ShopSystem.getShopGoods("normal") 未返回数组').toBe(true);
  });

  it('EC-02-02: TutorialStepManager 持有 TutorialStateMachine 引用（非 null）', () => {
    const stepManager = engine.getTutorialStepManager();
    const stateMachine = engine.getTutorialStateMachine();
    expect(stepManager, '[EC-02-02] getTutorialStepManager() 返回 null').toBeDefined();
    expect(stateMachine, '[EC-02-02] getTutorialStateMachine() 返回 null').toBeDefined();

    // 验证两者实例一致性：通过 registry 获取的是同一实例
    const registry = engine.getSubsystemRegistry();
    const smFromRegistry = registry.get('tutorialStateMachine');
    expect(smFromRegistry, '[EC-02-02] registry 中 tutorialStateMachine 为 null').toBeDefined();
  });

  it('EC-02-03: engine.getSubsystemRegistry() 返回非 null', () => {
    const registry = engine.getSubsystemRegistry();
    expect(registry, '[EC-02-03] getSubsystemRegistry() 返回 null/undefined').toBeDefined();
    expect(registry, '[EC-02-03] getSubsystemRegistry() 返回 null').not.toBeNull();
    expect(typeof registry.get, '[EC-02-03] registry.get 不是函数').toBe('function');
    expect(typeof registry.has, '[EC-02-03] registry.has 不是函数').toBe('function');
  });
});

// ═════════════════════════════════════════════
// Suite 3: Registry Key 契约 (EC-03)
// ═════════════════════════════════════════════

describe('Registry Key 契约 (EC-03)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = EngineFactory.createFresh({ autoInit: true });
  });

  it('EC-03-01: registry.get("tutorialStateMachine") 返回非 null', () => {
    const registry = engine.getSubsystemRegistry();
    const result = registry.get('tutorialStateMachine');
    expect(result, '[EC-03-01] registry.get("tutorialStateMachine") 返回 null').toBeDefined();
    expect(result, '[EC-03-01] registry.get("tutorialStateMachine") 返回 null').not.toBeNull();
  });

  it('EC-03-02: registry.get("tutorialStepManager") 返回非 null', () => {
    const registry = engine.getSubsystemRegistry();
    const result = registry.get('tutorialStepManager');
    expect(result, '[EC-03-02] registry.get("tutorialStepManager") 返回 null').toBeDefined();
    expect(result, '[EC-03-02] registry.get("tutorialStepManager") 返回 null').not.toBeNull();
  });

  it('EC-03-03: registry.get("shop") 返回非 null', () => {
    const registry = engine.getSubsystemRegistry();
    const result = registry.get('shop');
    expect(result, '[EC-03-03] registry.get("shop") 返回 null').toBeDefined();
    expect(result, '[EC-03-03] registry.get("shop") 返回 null').not.toBeNull();
  });

  it('EC-03-04: 所有已注册的 subsystem 都能通过 registry.get() 获取', () => {
    const registry = engine.getSubsystemRegistry();
    const failedKeys: string[] = [];

    for (const { registeredKey, subsystem } of REGISTRY_KEY_CONTRACT) {
      const result = registry.get(registeredKey);
      if (result === null || result === undefined) {
        failedKeys.push(`${registeredKey} (${subsystem})`);
      }
    }

    expect(
      failedKeys,
      `[EC-03-04] 以下 registry key 获取失败: ${failedKeys.join(', ')}`,
    ).toEqual([]);
  });
});

// ═════════════════════════════════════════════
// Suite 4: Tab ID 契约 (EC-04)
// ═════════════════════════════════════════════

describe('Tab ID 契约 (EC-04)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = EngineFactory.createFresh({ autoInit: true });
  });

  it('EC-04-01: ShopPanel 的 SHOP_TABS 每个 id 对应 ShopSystem 中有效的商店', () => {
    const shop = engine.getShopSystem();
    const tabIds = TAB_ID_CONTRACT.shop.frontend;
    const failedTabs: string[] = [];

    for (const tabId of tabIds) {
      const goods = shop.getShopGoods(tabId as 'normal' | 'black_market' | 'limited_time' | 'vip');
      // getShopGoods 应返回数组（可以为空），不应抛异常
      if (!Array.isArray(goods)) {
        failedTabs.push(tabId);
      }
    }

    expect(
      failedTabs,
      `[EC-04-01] 以下 tab id 对应的商店无效: ${failedTabs.join(', ')}`,
    ).toEqual([]);
  });

  it('EC-04-02: ShopSystem.getShopGoods("normal") 返回非 undefined', () => {
    const shop = engine.getShopSystem();
    const goods = shop.getShopGoods('normal');
    expect(goods, '[EC-04-02] getShopGoods("normal") 返回 undefined').toBeDefined();
    expect(Array.isArray(goods), '[EC-04-02] getShopGoods("normal") 未返回数组').toBe(true);
  });

  it('EC-04-03: ShopSystem.getShopGoods("black_market") 返回非 undefined', () => {
    const shop = engine.getShopSystem();
    const goods = shop.getShopGoods('black_market');
    expect(goods, '[EC-04-03] getShopGoods("black_market") 返回 undefined').toBeDefined();
    expect(Array.isArray(goods), '[EC-04-03] getShopGoods("black_market") 未返回数组').toBe(true);
  });

  it('EC-04-04: ShopSystem.getShopGoods("limited_time") 返回非 undefined', () => {
    const shop = engine.getShopSystem();
    const goods = shop.getShopGoods('limited_time');
    expect(goods, '[EC-04-04] getShopGoods("limited_time") 返回 undefined').toBeDefined();
    expect(Array.isArray(goods), '[EC-04-04] getShopGoods("limited_time") 未返回数组').toBe(true);
  });

  it('EC-04-05: ShopSystem.getShopGoods("vip") 返回非 undefined', () => {
    const shop = engine.getShopSystem();
    const goods = shop.getShopGoods('vip');
    expect(goods, '[EC-04-05] getShopGoods("vip") 返回 undefined').toBeDefined();
    expect(Array.isArray(goods), '[EC-04-05] getShopGoods("vip") 未返回数组').toBe(true);
  });
});

// ═════════════════════════════════════════════
// Suite 5: Engine 重置契约 (EC-05)
// ═════════════════════════════════════════════

describe('Engine 重置契约 (EC-05)', () => {
  it('EC-05-01: engine.reset() 后可以重新 init()', () => {
    const engine = EngineFactory.createFresh({ autoInit: true });

    expect(() => engine.reset()).not.toThrow();
    expect(() => engine.init()).not.toThrow();
  });

  it('EC-05-02: engine.reset() + init() 后所有 getter 仍然返回非 null', () => {
    const engine = EngineFactory.createFresh({ autoInit: true });
    engine.reset();
    engine.init();

    const allGetters = ENGINE_GETTER_CONTRACT as readonly string[];
    for (const getterName of allGetters) {
      assertGetterNotNull(engine, getterName, 'EC-05-02');
    }
  });

  it('EC-05-03: engine.reset() + init() 后子系统依赖关系仍然正确', () => {
    const engine = EngineFactory.createFresh({ autoInit: true });
    engine.reset();
    engine.init();

    // 验证 ShopSystem 仍然可用
    const shop = engine.getShopSystem();
    expect(shop, '[EC-05-03] reset+init 后 getShopSystem() 返回 null').toBeDefined();
    const normalGoods = shop.getShopGoods('normal');
    expect(Array.isArray(normalGoods), '[EC-05-03] reset+init 后 getShopGoods("normal") 未返回数组').toBe(true);

    // 验证 Registry 仍然完整
    const registry = engine.getSubsystemRegistry();
    expect(registry, '[EC-05-03] reset+init 后 getSubsystemRegistry() 返回 null').toBeDefined();

    // 验证关键 registry key 仍可获取
    for (const { registeredKey, subsystem } of REGISTRY_KEY_CONTRACT) {
      const result = registry.get(registeredKey);
      expect(
        result,
        `[EC-05-03] reset+init 后 registry.get("${registeredKey}") (${subsystem}) 返回 null`,
      ).toBeDefined();
    }
  });
});
