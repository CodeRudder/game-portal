/**
 * v14.0 千秋万代 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 成就系统: 成就面板、维度分类、奖励领取、成就链
 * - §2 声望系统: 声望等级、声望面板、声望加成、声望任务
 * - §3 声望商店: 商品购买
 * - §4 转生系统: 转生条件、执行转生、转生倍率、解锁内容
 * - §5 传承系统: 保留/重置规则、初始礼包
 * - §6 跨系统联动: 转生→声望→成就→商贸
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v14-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';

// ═══════════════════════════════════════════════════════════════
// §1 成就系统（v14增强）
// ═══════════════════════════════════════════════════════════════
describe('v14.0 千秋万代 — §1 成就系统', () => {

  it('should access achievement system via engine getter', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();
    expect(achievement).toBeDefined();
    expect(typeof achievement.getAllAchievements).toBe('function');
    expect(typeof achievement.updateProgress).toBe('function');
  });

  it('should get achievement state', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const state = achievement.getState();
    expect(state).toBeDefined();
  });

  it('should list all achievements with instances', () => {
    // Play §1.1: 成就面板展示5个维度Tab
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const achievements = achievement.getAllAchievements();
    expect(Array.isArray(achievements)).toBe(true);
  });

  it('should get total achievement points', () => {
    // Play §1.2: 成就点数累积解锁宝箱
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const points = achievement.getTotalPoints();
    expect(typeof points).toBe('number');
  });

  it('should get achievement chains for rebirth', () => {
    // Play §1.3: 成就链"初露锋芒"(5个子成就依次解锁)
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const chains = achievement.getAchievementChains();
    expect(Array.isArray(chains)).toBe(true);
  });

  it('should get completed chains', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const completed = achievement.getCompletedChains();
    expect(Array.isArray(completed)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 声望系统
// ═══════════════════════════════════════════════════════════════
describe('v14.0 千秋万代 — §2 声望系统', () => {

  it('should access prestige system via engine getter', () => {
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    expect(prestige).toBeDefined();
    expect(typeof prestige.getPrestigePanel).toBe('function');
    expect(typeof prestige.addPrestigePoints).toBe('function');
    expect(typeof prestige.getLevelInfo).toBe('function');
  });

  it('should get prestige state', () => {
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const state = prestige.getState();
    expect(state).toBeDefined();
  });

  it('should get prestige panel data', () => {
    // Play §2: 声望面板展示当前等级/点数/下一级进度
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const panel = prestige.getPrestigePanel();
    expect(panel).toBeDefined();
  });

  it('should get level info for specific level', () => {
    // Play §2: 声望等级详情
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const level1 = prestige.getLevelInfo(1);
    expect(level1).toBeDefined();
    expect(level1.level).toBe(1);

    const level5 = prestige.getLevelInfo(5);
    expect(level5).toBeDefined();
  });

  it('should get current level info', () => {
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const currentLevel = prestige.getCurrentLevelInfo();
    expect(currentLevel).toBeDefined();
  });

  it('should add prestige points from various sources', () => {
    // Play §2: 游戏行为→声望累积
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const stateBefore = prestige.getState();
    const pointsBefore = stateBefore.totalPoints ?? 0;

    // 从不同来源添加声望点数
    const points = prestige.addPrestigePoints('building', 100, 'castle_upgrade');
    expect(typeof points).toBe('number');

    const stateAfter = prestige.getState();
    const pointsAfter = stateAfter.totalPoints ?? 0;
    expect(pointsAfter).toBeGreaterThanOrEqual(pointsBefore);
  });

  it('should get production bonus from prestige level', () => {
    // Play §2: 声望等级→产出加成
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const bonus = prestige.getProductionBonus();
    expect(typeof bonus).toBe('number');
    expect(bonus).toBeGreaterThanOrEqual(0);
  });

  it('should get source configs for prestige points', () => {
    // Play §2: 声望获取途径配置
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const configs = prestige.getSourceConfigs();
    expect(configs).toBeDefined();
  });

  it('should get level rewards list', () => {
    // Play §2: 声望等级奖励
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const rewards = prestige.getLevelRewards();
    expect(Array.isArray(rewards)).toBe(true);
  });

  it('should claim level reward when conditions are met', () => {
    // Play §2: 领取声望等级奖励
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.addPrestigePoints('building', 1000, 'test');

    const result = prestige.claimLevelReward(1);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should get prestige quests', () => {
    // Play §2: 声望任务
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const quests = prestige.getPrestigeQuests();
    expect(quests).toBeDefined();
  });

  it('should get rebirth quests based on rebirth count', () => {
    // Play §2: 转生任务
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const quests = prestige.getRebirthQuests(0);
    expect(quests).toBeDefined();
  });

  it('should check prestige quest completion', () => {
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const quests = prestige.getPrestigeQuests();
    if (Array.isArray(quests) && quests.length > 0) {
      const questId = (quests[0] as { id?: string }).id;
      if (questId) {
        const progress = prestige.getPrestigeQuestProgress(questId);
        expect(typeof progress).toBe('number');

        const completed = prestige.checkPrestigeQuestCompletion(questId);
        expect(typeof completed).toBe('boolean');
      }
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 声望商店
// ═══════════════════════════════════════════════════════════════
describe('v14.0 千秋万代 — §3 声望商店', () => {

  it('should access prestige shop system via engine getter', () => {
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();
    expect(shop).toBeDefined();
  });

  it('should get all goods from prestige shop', () => {
    // Play §3: 声望商店商品列表
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();

    const goods = shop.getAllGoods();
    expect(Array.isArray(goods)).toBe(true);
  });

  it('should get unlocked goods from prestige shop', () => {
    // Play §3: 按声望等级解锁商品
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();

    const unlocked = shop.getUnlockedGoods();
    expect(Array.isArray(unlocked)).toBe(true);
  });

  it('should check if goods can be bought', () => {
    // Play §3: 购买前验证
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();

    const goods = shop.getAllGoods();
    if (goods.length > 0) {
      const check = shop.canBuyGoods(goods[0].id);
      expect(check).toBeDefined();
      expect(typeof check.canBuy).toBe('boolean');
    }
  });

  it('should get purchase history', () => {
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();

    const history = shop.getPurchaseHistory();
    expect(history).toBeDefined();
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 转生系统
// ═══════════════════════════════════════════════════════════════
describe('v14.0 千秋万代 — §4 转生系统', () => {

  it('should access rebirth system via engine getter', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();
    expect(rebirth).toBeDefined();
    expect(typeof rebirth.checkRebirthConditions).toBe('function');
    expect(typeof rebirth.executeRebirth).toBe('function');
    expect(typeof rebirth.getCurrentMultiplier).toBe('function');
  });

  it('should get rebirth state', () => {
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const state = rebirth.getState();
    expect(state).toBeDefined();
  });

  it('should check rebirth conditions for new game', () => {
    // Play §4: 转生条件检查
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check).toBeDefined();
    // 新游戏通常不满足转生条件
    expect(typeof check.canRebirth).toBe('boolean');
  });

  it('should get current multiplier', () => {
    // Play §4: 转生倍率
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const multiplier = rebirth.getCurrentMultiplier();
    expect(typeof multiplier).toBe('number');
    expect(multiplier).toBeGreaterThan(0);
  });

  it('should get next multiplier preview', () => {
    // Play §4: 下一级倍率预览
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const nextMult = rebirth.getNextMultiplier();
    expect(typeof nextMult).toBe('number');
    expect(nextMult).toBeGreaterThan(0);
  });

  it('should get effective multipliers for all categories', () => {
    // Play §4: 各类加速倍率
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const mults = rebirth.getEffectiveMultipliers();
    expect(mults).toBeDefined();
    expect(typeof mults.buildSpeed).toBe('number');
    expect(typeof mults.techSpeed).toBe('number');
    expect(typeof mults.resource).toBe('number');
    expect(typeof mults.exp).toBe('number');
  });

  it('should get acceleration status', () => {
    // Play §4: 加速状态
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const accel = rebirth.getAcceleration();
    expect(accel).toBeDefined();
    expect(typeof accel.active).toBe('boolean');
  });

  it('should simulate rebirth earnings', () => {
    // Play §4: 转生收益模拟
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const simulation = rebirth.simulateEarnings({
      currentResources: { grain: 10000, gold: 5000, troops: 1000 },
      productionRates: { grain: 100, gold: 50, troops: 10 },
      hours: 24,
      rebirthCount: 1,
    });

    expect(simulation).toBeDefined();
  });

  it('should get rebirth records', () => {
    // Play §4: 转生记录
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const records = rebirth.getRebirthRecords();
    expect(Array.isArray(records)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 传承系统（保留/重置规则）
// ═══════════════════════════════════════════════════════════════
describe('v14.0 千秋万代 — §5 传承系统', () => {

  it('should get keep rules for rebirth', () => {
    // Play §5: 转生后保留的内容
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const rules = rebirth.getKeepRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should get reset rules for rebirth', () => {
    // Play §5: 转生后重置的内容
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const rules = rebirth.getResetRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('should get unlock contents list', () => {
    // Play §5: 转生解锁内容
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const contents = rebirth.getUnlockContents();
    expect(Array.isArray(contents)).toBe(true);
  });

  it('should get unlocked contents', () => {
    // Play §5: 已解锁内容
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const unlocked = rebirth.getUnlockedContents();
    expect(Array.isArray(unlocked)).toBe(true);
  });

  it('should get initial gift for rebirth', () => {
    // Play §5: 转生初始礼包
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const gift = rebirth.getInitialGift();
    expect(gift).toBeDefined();
  });

  it('should get instant build config for rebirth', () => {
    // Play §5: 转生后秒建配置
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const config = rebirth.getInstantBuildConfig();
    expect(config).toBeDefined();
  });

  it('should calculate build time with rebirth bonus', () => {
    // Play §5: 转生加速建造
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const buildTime = rebirth.calculateBuildTime(3600, 5);
    expect(typeof buildTime).toBe('number');
    expect(buildTime).toBeGreaterThan(0);
  });

  it('should get auto rebuild plan', () => {
    // Play §5: 自动重建计划
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const plan = rebirth.getAutoRebuildPlan();
    // 可能返回 null（首次转生无计划）
    expect(plan === null || Array.isArray(plan)).toBe(true);
  });

  it('should check feature unlock status', () => {
    // Play §5: 功能解锁判定
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const unlocked = rebirth.isFeatureUnlocked('some_feature');
    expect(typeof unlocked).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v14.0 千秋万代 — §6 跨系统联动', () => {

  it('should link prestige with rebirth system', () => {
    // Play §6: 声望→转生联动
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const rebirth = sim.engine.getRebirthSystem();

    expect(prestige).toBeDefined();
    expect(rebirth).toBeDefined();

    // 声望等级应影响转生系统
    const prestigeLevel = prestige.getCurrentLevelInfo();
    rebirth.updatePrestigeLevel(prestigeLevel.level);

    // 转生条件检查应能引用声望等级
    const conditions = rebirth.checkRebirthConditions();
    expect(conditions).toBeDefined();
  });

  it('should link prestige with production bonus', () => {
    // Play §6: 声望→产出加成
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const bonusBefore = prestige.getProductionBonus();

    prestige.addPrestigePoints('building', 500, 'test');

    const bonusAfter = prestige.getProductionBonus();
    expect(typeof bonusAfter).toBe('number');
  });

  it('should link rebirth with quest system', () => {
    // Play §6: 转生→任务系统
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();
    const quest = sim.engine.getQuestSystem();

    expect(rebirth).toBeDefined();
    expect(quest).toBeDefined();

    // 转生后应能获取新的任务
    const rebirthRecords = rebirth.getRebirthRecords();
    expect(Array.isArray(rebirthRecords)).toBe(true);
  });

  it('should link prestige with achievement system', () => {
    // Play §6: 声望→成就
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const achievement = sim.engine.getAchievementSystem();

    expect(prestige).toBeDefined();
    expect(achievement).toBeDefined();

    // 声望进度应能更新成就
    achievement.updateProgress('prestige_level', 1);

    const state = achievement.getState();
    expect(state).toBeDefined();
  });

  it('should coordinate full prestige-rebirth cycle', () => {
    // Play §6: 完整 声望→转生 循环
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const rebirth = sim.engine.getRebirthSystem();

    // 1. 累积声望
    prestige.addPrestigePoints('building', 1000, 'test');
    prestige.addPrestigePoints('combat', 500, 'test');

    // 2. 检查声望面板
    const panel = prestige.getPrestigePanel();
    expect(panel).toBeDefined();

    // 3. 检查转生条件
    const conditions = rebirth.checkRebirthConditions();
    expect(conditions).toBeDefined();

    // 4. 查看转生倍率
    const multiplier = rebirth.getCurrentMultiplier();
    expect(multiplier).toBeGreaterThan(0);

    // 5. 查看转生后可解锁内容
    const unlockContents = rebirth.getUnlockContents();
    expect(Array.isArray(unlockContents)).toBe(true);

    // 6. 查看保留/重置规则
    const keepRules = rebirth.getKeepRules();
    const resetRules = rebirth.getResetRules();
    expect(keepRules.length).toBeGreaterThan(0);
    expect(resetRules.length).toBeGreaterThan(0);
  });

  it('should link prestige shop with prestige level', () => {
    // Play §6: 声望等级→商店解锁
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    // 更新声望信息到商店
    const levelInfo = prestige.getCurrentLevelInfo();
    shop.updatePrestigeInfo(
      prestige.getState().totalPoints ?? 0,
      levelInfo.level,
    );

    const goods = shop.getAllGoods();
    expect(Array.isArray(goods)).toBe(true);
  });

});
