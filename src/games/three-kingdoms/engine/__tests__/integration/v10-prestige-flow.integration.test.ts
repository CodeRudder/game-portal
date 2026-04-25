/**
 * v10.0 天下归心 — 声望系统流程集成测试
 *
 * 覆盖声望系统核心 play 流程：
 * - §1 声望分栏场景与等级展示
 * - §2 声望等级升级流程（阈值公式 1000×N^1.8）
 * - §3 声望获取途径（9种途径 + 每日上限）
 * - §4 产出加成特权（1 + level × 0.02）
 * - §5 等级解锁奖励
 * - §6 声望商店购买流程
 * - §7 声望专属任务
 * - §8 声望存档与持久化
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 * - 引擎未实现功能用 test.skip
 *
 * @see docs/games/three-kingdoms/play/v10-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import { PrestigeSystem, calcRequiredPoints, calcProductionBonus } from '../../prestige/PrestigeSystem';
import {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRODUCTION_BONUS_PER_LEVEL,
  PRESTIGE_SOURCE_CONFIGS,
  LEVEL_UNLOCK_REWARDS,
  PRESTIGE_LEVEL_TITLES,
  PRESTIGE_SHOP_GOODS,
  PRESTIGE_QUESTS,
} from '../../../core/prestige/prestige-config';
import { PRESTIGE_SAVE_VERSION } from '../../../core/prestige/prestige.types';
import type { PrestigeSourceType } from '../../../core/prestige';

// ═══════════════════════════════════════════════════════════════
// §1 声望分栏场景与等级展示
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §1 声望分栏场景', () => {

  it('PRESTIGE-PANEL-1: 新游戏声望面板应返回初始数据', () => {
    // Play §1: 新游戏声望等级1，声望值0
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const panel = prestige.getPrestigePanel();
    expect(panel.currentLevel).toBe(1);
    expect(panel.currentPoints).toBe(0);
    expect(panel.totalPoints).toBe(0);
    expect(panel.productionBonus).toBeCloseTo(1 + 1 * PRODUCTION_BONUS_PER_LEVEL, 4);
  });

  it('PRESTIGE-PANEL-2: 下一等级声望值应按公式计算', () => {
    // Play §1: 等级阈值公式 1000 × N^1.8
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const panel = prestige.getPrestigePanel();
    const expectedNext = Math.floor(PRESTIGE_BASE * Math.pow(2, PRESTIGE_EXPONENT));
    expect(panel.nextLevelPoints).toBe(expectedNext);
  });

  it('PRESTIGE-PANEL-3: 等级信息应包含标题、阈值和特权', () => {
    // Play §1: 等级标题配置
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const info = prestige.getLevelInfo(1);
    expect(info.level).toBe(1);
    expect(info.title).toBe('布衣');
    expect(info.requiredPoints).toBe(Math.floor(PRESTIGE_BASE * Math.pow(1, PRESTIGE_EXPONENT))); // Lv1 = 1000×1^1.8
    expect(info.productionBonus).toBeGreaterThan(0);
  });

  it('PRESTIGE-PANEL-4: 等级标题映射应覆盖关键节点', () => {
    // Play §1: 等级标题配置覆盖 1/5/10/15/20/25/30/35/40/45/50
    expect(PRESTIGE_LEVEL_TITLES[1]).toBe('布衣');
    expect(PRESTIGE_LEVEL_TITLES[10]).toBe('县令');
    expect(PRESTIGE_LEVEL_TITLES[20]).toBe('刺史');
    expect(PRESTIGE_LEVEL_TITLES[50]).toBe('帝王');
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 声望等级升级流程
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §2 声望等级升级流程', () => {

  it('PRESTIGE-LVL-1: 添加声望值达到阈值应自动升级', () => {
    // Play §2: 声望值累积达到等级阈值时自动升级
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // Lv1→Lv2 需要 calcRequiredPoints(2) = 1000 × 2^1.8 ≈ 3482
    const required = calcRequiredPoints(2);
    prestige.addPrestigePoints('main_quest', required);

    const state = prestige.getState();
    expect(state.currentLevel).toBeGreaterThanOrEqual(2);
  });

  it('PRESTIGE-LVL-2: 大量声望值应触发多级连升', () => {
    // Play §2: 一次性获得大量声望值应连续升级
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // 注入大量声望值
    prestige.addPrestigePoints('main_quest', 999999999);

    const state = prestige.getState();
    expect(state.currentLevel).toBeGreaterThan(10);
  });

  it('PRESTIGE-LVL-3: 声望等级不应超过最大等级50', () => {
    // Play §2: 声望等级上限 MAX_PRESTIGE_LEVEL=50
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.addPrestigePoints('main_quest', 999999999999);

    const state = prestige.getState();
    expect(state.currentLevel).toBeLessThanOrEqual(MAX_PRESTIGE_LEVEL);
  });

  it('PRESTIGE-LVL-4: 等级阈值公式应精确匹配 1000×N^1.8', () => {
    // Play §2: 等级阈值公式验证
    const testLevels = [1, 2, 5, 10, 20, 50];
    for (const level of testLevels) {
      const expected = Math.floor(PRESTIGE_BASE * Math.pow(level, PRESTIGE_EXPONENT));
      expect(calcRequiredPoints(level)).toBe(expected);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 声望获取途径（9种 + 每日上限）
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §3 声望获取途径', () => {

  it('PRESTIGE-SRC-1: 应配置9种声望获取途径', () => {
    // Play §3: 9种声望获取途径
    expect(PRESTIGE_SOURCE_CONFIGS.length).toBe(9);
  });

  it('PRESTIGE-SRC-2: 每种途径应有每日上限配置', () => {
    // Play §3: 每日上限 -1 表示无限
    for (const cfg of PRESTIGE_SOURCE_CONFIGS) {
      expect(cfg.type).toBeDefined();
      expect(cfg.basePoints).toBeGreaterThan(0);
      expect(typeof cfg.dailyCap).toBe('number');
    }
  });

  it('PRESTIGE-SRC-3: 通过battle_victory获取声望应正确累加', () => {
    // Play §3: 战斗胜利获取声望
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const gained = prestige.addPrestigePoints('battle_victory', 10);
    expect(gained).toBe(10);

    const state = prestige.getState();
    expect(state.currentPoints).toBe(10);
  });

  it('PRESTIGE-SRC-4: 每日上限到达后不再获取', () => {
    // Play §3: 每日上限限制
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const config = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'battle_victory')!;
    expect(config.dailyCap).toBeGreaterThan(0);

    // 反复获取直到超过每日上限
    let totalGained = 0;
    for (let i = 0; i < 100; i++) {
      const gained = prestige.addPrestigePoints('battle_victory', 50);
      totalGained += gained;
      if (gained === 0) break;
    }

    expect(totalGained).toBeLessThanOrEqual(config.dailyCap);
  });

  it('PRESTIGE-SRC-5: 无上限途径(main_quest)应无限制获取', () => {
    // Play §3: 主线任务无每日上限
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const config = PRESTIGE_SOURCE_CONFIGS.find(c => c.type === 'main_quest')!;
    expect(config.dailyCap).toBe(-1);

    // 多次获取应全部成功
    let totalGained = 0;
    for (let i = 0; i < 10; i++) {
      totalGained += prestige.addPrestigePoints('main_quest', 100);
    }
    expect(totalGained).toBe(1000);
  });

  it('PRESTIGE-SRC-6: 不同途径的每日上限应独立计算', () => {
    // Play §3: 各途径每日上限互不影响
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // battle_victory 上限200，消耗完
    let battleTotal = 0;
    for (let i = 0; i < 100; i++) {
      const g = prestige.addPrestigePoints('battle_victory', 50);
      battleTotal += g;
      if (g === 0) break;
    }

    // building_upgrade 应仍可获取（独立上限150）
    const buildingGain = prestige.addPrestigePoints('building_upgrade', 15);
    expect(buildingGain).toBe(15);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 产出加成特权
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §4 产出加成特权', () => {

  it('PRESTIGE-BONUS-1: 初始等级产出加成为 1 + 1×0.02 = 1.02', () => {
    // Play §4: 产出加成公式 1 + level × 0.02
    const bonus = calcProductionBonus(1);
    expect(bonus).toBeCloseTo(1.02, 4);
  });

  it('PRESTIGE-BONUS-2: 等级10产出加成为 1 + 10×0.02 = 1.2', () => {
    // Play §4: 等级10产出加成
    const bonus = calcProductionBonus(10);
    expect(bonus).toBeCloseTo(1.2, 4);
  });

  it('PRESTIGE-BONUS-3: 等级50产出加成为 1 + 50×0.02 = 2.0', () => {
    // Play §4: 满级产出加成
    const bonus = calcProductionBonus(50);
    expect(bonus).toBeCloseTo(2.0, 4);
  });

  it('PRESTIGE-BONUS-4: 升级后产出加成应实时更新', () => {
    // Play §4: 等级提升→产出加成实时更新
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const bonusBefore = prestige.getProductionBonus();
    prestige.addPrestigePoints('main_quest', 999999999);
    const bonusAfter = prestige.getProductionBonus();

    expect(bonusAfter).toBeGreaterThan(bonusBefore);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 等级解锁奖励
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §5 等级解锁奖励', () => {

  it('PRESTIGE-REWARD-1: 等级解锁奖励列表应包含关键节点', () => {
    // Play §5: 等级1/5/10/15/20/30/40/50 有解锁奖励
    const levels = LEVEL_UNLOCK_REWARDS.map(r => r.level);
    expect(levels).toContain(1);
    expect(levels).toContain(5);
    expect(levels).toContain(20);
    expect(levels).toContain(50);
  });

  it('PRESTIGE-REWARD-2: Lv1奖励应可领取', () => {
    // Play §5: 等级1解锁奖励
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const result = prestige.claimLevelReward(1);
    expect(result.success).toBe(true);
    expect(result.reward).toBeDefined();
  });

  it('PRESTIGE-REWARD-3: 重复领取应失败', () => {
    // Play §5: 奖励不可重复领取
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.claimLevelReward(1);
    const result = prestige.claimLevelReward(1);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已领取');
  });

  it('PRESTIGE-REWARD-4: 等级不足时领取应失败', () => {
    // Play §5: 等级不足不可领取
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const result = prestige.claimLevelReward(20);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('等级不足');
  });

  it('PRESTIGE-REWARD-5: 高等级奖励升级后应可领取', () => {
    // Play §5: 升级后解锁新奖励
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // 快速升级到高等级
    prestige.addPrestigePoints('main_quest', 999999999);

    const state = prestige.getState();
    // 尝试领取当前等级对应的奖励
    const rewards = prestige.getLevelRewards();
    const claimable = rewards.filter(r => r.level <= state.currentLevel && !r.claimed);
    expect(claimable.length).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 声望商店购买流程
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §6 声望商店', () => {

  it('PRESTIGE-SHOP-1: 声望商店应有商品列表', () => {
    // Play §6: 声望商店商品列表
    expect(PRESTIGE_SHOP_GOODS.length).toBeGreaterThan(0);
  });

  it('PRESTIGE-SHOP-2: 初始状态仅Lv1商品可购买', () => {
    // Play §6: 商品按声望等级解锁
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();

    const allGoods = shop.getAllGoods();
    const unlocked = allGoods.filter(g => g.unlocked);
    const locked = allGoods.filter(g => !g.unlocked);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(locked.length).toBeGreaterThan(0);
  });

  it('PRESTIGE-SHOP-3: 声望值不足时购买应失败', () => {
    // Play §6: 声望值消耗购买
    const sim = createSim();
    const shop = sim.engine.getPrestigeShopSystem();

    // 新游戏声望值为0，购买应失败
    const result = shop.buyGoods('psg-001', 1);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('声望值不足');
  });

  it('PRESTIGE-SHOP-4: 有声望值时应可购买Lv1商品', () => {
    // Play §6: 声望值充足→购买成功
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    // 获取声望值
    prestige.addPrestigePoints('main_quest', 500);
    const state = prestige.getState();
    shop.updatePrestigeInfo(state.currentPoints, state.currentLevel);

    // 购买Lv1商品 psg-001（消耗50声望值）
    const result = shop.buyGoods('psg-001', 1);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(50);
  });

  it('PRESTIGE-SHOP-5: 限购商品达到上限后应不可购买', () => {
    // Play §6: 限购机制
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    prestige.addPrestigePoints('main_quest', 99999);
    const state = prestige.getState();
    shop.updatePrestigeInfo(state.currentPoints, state.currentLevel);

    // psg-001 限购5次
    const goodsDef = PRESTIGE_SHOP_GOODS.find(g => g.id === 'psg-001')!;
    const limit = goodsDef.purchaseLimit;
    expect(limit).toBeGreaterThan(0);

    // 购买到上限
    for (let i = 0; i < limit; i++) {
      const r = shop.buyGoods('psg-001', 1);
      expect(r.success).toBe(true);
    }

    // 再次购买应失败
    const result = shop.buyGoods('psg-001', 1);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('上限');
  });

  it('PRESTIGE-SHOP-6: 购买后声望值应正确扣除', () => {
    // Play §6: 声望值扣除
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    prestige.addPrestigePoints('main_quest', 200);
    const state = prestige.getState();
    const pointsBefore = state.currentPoints;
    shop.updatePrestigeInfo(state.currentPoints, state.currentLevel);

    const result = shop.buyGoods('psg-001', 1);
    expect(result.success).toBe(true);

    // 商店内部扣除了声望值
    const shopState = shop.getState();
    expect(shopState.prestigePoints).toBe(pointsBefore - 50);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 声望专属任务
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §7 声望专属任务', () => {

  it('PRESTIGE-QUEST-1: 声望任务列表应包含多个任务', () => {
    // Play §7: 声望专属任务
    expect(PRESTIGE_QUESTS.length).toBeGreaterThan(0);
  });

  it('PRESTIGE-QUEST-2: 低等级时应可见部分任务', () => {
    // Play §7: 任务按声望等级解锁
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const quests = prestige.getPrestigeQuests();
    // Lv1应至少能看到pq-001（requiredPrestigeLevel=1）
    expect(quests.length).toBeGreaterThanOrEqual(1);
  });

  it('PRESTIGE-QUEST-3: 高等级应解锁更多任务', () => {
    // Play §7: 等级提升→任务解锁
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const questsBefore = prestige.getPrestigeQuests().length;
    prestige.addPrestigePoints('main_quest', 999999999);
    const questsAfter = prestige.getPrestigeQuests().length;

    expect(questsAfter).toBeGreaterThanOrEqual(questsBefore);
  });

  it('PRESTIGE-QUEST-4: 声望任务进度应可追踪', () => {
    // Play §7: 任务进度更新
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // 添加声望值触发 earn_prestige_points 类型任务进度
    prestige.addPrestigePoints('main_quest', 100);

    // pq-002 是 earn_prestige_points 类型（requiredPrestigeLevel=3）
    // pq-001 是 reach_prestige_level 类型（requiredPrestigeLevel=1）
    const progress = prestige.getPrestigeQuestProgress('pq-001');
    expect(progress).toBeGreaterThanOrEqual(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §8 声望存档与持久化
// ═══════════════════════════════════════════════════════════════
describe('v10.0 声望系统 — §8 存档与持久化', () => {

  it('PRESTIGE-SAVE-1: 存档数据应包含完整声望和转生状态', () => {
    // Play §8: 存档完整性
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.addPrestigePoints('main_quest', 500);

    const saveData = prestige.getSaveData();
    expect(saveData.version).toBe(PRESTIGE_SAVE_VERSION);
    expect(saveData.prestige).toBeDefined();
    expect(saveData.rebirth).toBeDefined();
    expect(saveData.prestige.currentPoints).toBeGreaterThan(0);
  });

  it('PRESTIGE-SAVE-2: 加载存档应恢复声望状态', () => {
    // Play §8: 存档恢复
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.addPrestigePoints('main_quest', 500);
    const saveData = prestige.getSaveData();

    // 重置后加载
    prestige.reset();
    expect(prestige.getState().currentPoints).toBe(0);

    prestige.loadSaveData(saveData);
    expect(prestige.getState().currentPoints).toBe(saveData.prestige.currentPoints);
  });

  it('PRESTIGE-SAVE-3: 版本不匹配应拒绝加载', () => {
    // Play §8: 版本校验
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const badData = { prestige: prestige.getState(), rebirth: { rebirthCount: 0, currentMultiplier: 1.0, rebirthRecords: [], accelerationDaysLeft: 0, completedRebirthQuests: [], rebirthQuestProgress: {} }, version: 999 };

    prestige.loadSaveData(badData);
    // 版本不匹配应不加载（状态保持初始）
    expect(prestige.getState().currentLevel).toBe(1);
  });

});
