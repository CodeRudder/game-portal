/**
 * v10.0 天下归心 — 端到端串联流程集成测试
 *
 * 覆盖声望→转生→商店→任务→存档全链路交叉验证：
 * - §1 声望获取→等级提升→产出加成→转生条件 核心循环
 * - §2 转生→保留/重置→加速→解锁内容 完整流程
 * - §3 声望商店→声望值消耗→资源获取→声望获取 闭环
 * - §4 声望→转生→收益模拟器→转生决策 效率循环
 * - §5 多次转生→倍率叠加→加速衰减 长期循环
 * - §6 声望任务→转生任务→奖励发放 任务闭环
 * - §7 存档→重置→加载→状态恢复 持久化闭环
 * - §8 v16.0深化功能→初始赠送→瞬间建筑→一键重建 串联
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
import { calcRequiredPoints, calcProductionBonus } from '../../prestige/PrestigeSystem';
import { calcRebirthMultiplier } from '../../prestige/RebirthSystem';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRESTIGE_SHOP_GOODS,
  LEVEL_UNLOCK_REWARDS,
  PRESTIGE_QUESTS,
  REBIRTH_QUESTS,
  REBIRTH_INITIAL_GIFT,
} from '../../../core/prestige/prestige-config';

/** 配置转生系统使其满足所有转生条件 */
function setupRebirthReady(rebirth: ReturnType<ReturnType<typeof createSim>['engine']['getRebirthSystem']>) {
  rebirth.setCallbacks({
    castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
    heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
    totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
    prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
    onReset: () => {},
  });
  rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
}

// ═══════════════════════════════════════════════════════════════
// §1 声望获取→等级提升→产出加成→转生条件 核心循环
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §1 声望→等级→加成→转生条件 核心循环', () => {

  it('E2E-1-1: 声望获取应驱动等级提升', () => {
    // Play §1: 获取声望→等级提升
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const levelBefore = prestige.getState().currentLevel;
    prestige.addPrestigePoints('main_quest', 999999999);
    const levelAfter = prestige.getState().currentLevel;

    expect(levelAfter).toBeGreaterThan(levelBefore);
  });

  it('E2E-1-2: 等级提升应增加产出加成', () => {
    // Play §1: 等级→产出加成
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const bonusBefore = prestige.getProductionBonus();
    prestige.addPrestigePoints('main_quest', 999999999);
    const bonusAfter = prestige.getProductionBonus();

    expect(bonusAfter).toBeGreaterThan(bonusBefore);
  });

  it('E2E-1-3: 高声望等级应满足转生条件中的声望要求', () => {
    // Play §1: 声望等级≥20→满足转生声望条件
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const rebirth = sim.engine.getRebirthSystem();

    // 快速升级到高声望等级
    prestige.addPrestigePoints('main_quest', 999999999);
    const prestigeLevel = prestige.getState().currentLevel;
    rebirth.updatePrestigeLevel(prestigeLevel);

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.prestigeLevel.met).toBe(true);
    expect(check.conditions.prestigeLevel.current).toBeGreaterThanOrEqual(REBIRTH_CONDITIONS.minPrestigeLevel);
  });

  it('E2E-1-4: 声望等级阈值应随等级指数增长', () => {
    // Play §1: 等级阈值指数增长曲线
    const lv5 = calcRequiredPoints(5);
    const lv10 = calcRequiredPoints(10);
    const lv20 = calcRequiredPoints(20);

    // 指数增长：高等级所需声望远大于低等级
    expect(lv10).toBeGreaterThan(lv5 * 2);
    expect(lv20).toBeGreaterThan(lv10 * 2);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 转生→保留/重置→加速→解锁内容 完整流程
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §2 转生完整流程', () => {

  it('E2E-2-1: 转生前条件检查→转生执行→加速激活 全链路', () => {
    // Play §2: 条件检查→确认→执行→加速
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    // 1. 初始不可转生
    expect(rebirth.checkRebirthConditions().canRebirth).toBe(false);

    // 2. 满足条件
    setupRebirthReady(rebirth);
    expect(rebirth.checkRebirthConditions().canRebirth).toBe(true);

    // 3. 执行转生
    const result = rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(result.newCount).toBe(1);

    // 4. 加速激活
    const accel = rebirth.getAcceleration();
    expect(accel.active).toBe(true);
    expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
  });

  it('E2E-2-2: 转生应触发重置回调并传入重置规则', () => {
    // Play §2: 重置规则执行
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const resetRulesReceived: string[][] = [];
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      onReset: (rules) => { resetRulesReceived.push(rules); },
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

    rebirth.executeRebirth();

    expect(resetRulesReceived.length).toBe(1);
    expect(resetRulesReceived[0]).toEqual([...REBIRTH_RESET_RULES]);
  });

  it('E2E-2-3: 转生后解锁内容应正确更新', () => {
    // Play §2: 转生→解锁内容
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);

    // 转生前无解锁
    expect(rebirth.getUnlockedContents().length).toBe(0);

    // 第1次转生
    rebirth.executeRebirth();
    const unlocked1 = rebirth.getUnlockedContents();
    expect(unlocked1.some(c => c.unlockId === 'rebirth_shop')).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 声望商店→声望值消耗→资源获取→声望获取 闭环
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §3 声望商店闭环', () => {

  it('E2E-3-1: 声望获取→商店购买→奖励发放 全链路', () => {
    // Play §3: 获取声望→消耗声望→获得资源
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    // 1. 获取声望值
    prestige.addPrestigePoints('main_quest', 500);
    const state = prestige.getState();
    expect(state.currentPoints).toBeGreaterThan(0);

    // 2. 同步声望信息到商店
    shop.updatePrestigeInfo(state.currentPoints, state.currentLevel);

    // 3. 购买商品
    const result = shop.buyGoods('psg-001', 1);
    expect(result.success).toBe(true);

    // 4. 验证声望值扣除
    const shopState = shop.getState();
    expect(shopState.prestigePoints).toBeLessThan(state.currentPoints);
  });

  it('E2E-3-2: 商店购买后奖励应通过回调发放', () => {
    // Play §3: 奖励回调机制
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    let rewardsReceived: Record<string, number> = {};
    shop.setRewardCallback((rewards) => { rewardsReceived = rewards; });

    prestige.addPrestigePoints('main_quest', 500);
    const state = prestige.getState();
    shop.updatePrestigeInfo(state.currentPoints, state.currentLevel);

    shop.buyGoods('psg-001', 1);
    expect(Object.keys(rewardsReceived).length).toBeGreaterThan(0);
  });

  it('E2E-3-3: 高等级商品应随声望等级解锁', () => {
    // Play §3: 等级解锁商品
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const shop = sim.engine.getPrestigeShopSystem();

    // 初始仅Lv1商品
    const goodsBefore = shop.getAllGoods().filter(g => g.unlocked).length;

    // 快速升级
    prestige.addPrestigePoints('main_quest', 999999999);
    const state = prestige.getState();
    shop.updatePrestigeInfo(state.currentPoints, state.currentLevel);

    // 高等级应解锁更多商品
    // 注意：商店通过eventBus监听levelUp事件自动更新，
    // 但直接调用updatePrestigeInfo也能更新
    const goodsAfter = shop.getAllGoods();
    const unlockedAfter = goodsAfter.filter(g => g.unlocked).length;
    expect(unlockedAfter).toBeGreaterThanOrEqual(goodsBefore);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 声望→转生→收益模拟器→转生决策 效率循环
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §4 收益模拟器决策循环', () => {

  it('E2E-4-1: 模拟器应对比转生前后的收益差异', () => {
    // Play §4: 收益模拟辅助转生决策
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const resultBefore = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 30,
      dailyOnlineHours: 4,
    });

    const resultAfter = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 1,
      simulateDays: 30,
      dailyOnlineHours: 4,
    });

    // 转生后收益应更高
    expect(resultAfter.estimatedResources.gold).toBeGreaterThan(resultBefore.estimatedResources.gold);
  });

  it('E2E-4-2: 加速期收益应在模拟结果中体现', () => {
    // Play §4: 加速收益
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const result = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 30,
      dailyOnlineHours: 4,
    });

    // 加速收益（前7天）
    expect(result.rebirthAccelerationBonus.gold).toBeGreaterThan(0);
    // 加速收益应小于总收益（30天中只有7天加速）
    expect(result.rebirthAccelerationBonus.gold).toBeLessThan(result.estimatedResources.gold);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 多次转生→倍率叠加→加速衰减 长期循环
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §5 多次转生长期循环', () => {

  it('E2E-5-1: 连续3次转生应正确累加倍率', () => {
    // Play §5: 多次转生倍率叠加
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);

    for (let i = 0; i < 3; i++) {
      const result = rebirth.executeRebirth();
      expect(result.success).toBe(true);
    }

    const state = rebirth.getState();
    expect(state.rebirthCount).toBe(3);
    expect(state.currentMultiplier).toBeCloseTo(calcRebirthMultiplier(3), 4);
  });

  it('E2E-5-2: 多次转生后解锁内容应逐步增加', () => {
    // Play §5: 转生次数→解锁内容
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);

    rebirth.executeRebirth(); // 1次
    const unlocked1 = rebirth.getUnlockedContents().length;

    rebirth.executeRebirth(); // 2次
    const unlocked2 = rebirth.getUnlockedContents().length;

    rebirth.executeRebirth(); // 3次
    const unlocked3 = rebirth.getUnlockedContents().length;

    expect(unlocked2).toBeGreaterThanOrEqual(unlocked1);
    expect(unlocked3).toBeGreaterThanOrEqual(unlocked2);
  });

  it('E2E-5-3: 多次转生记录应完整保存', () => {
    // Play §5: 转生记录
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);

    for (let i = 0; i < 3; i++) {
      rebirth.executeRebirth();
    }

    const records = rebirth.getRebirthRecords();
    expect(records.length).toBe(3);
    expect(records[0].rebirthCount).toBe(1);
    expect(records[1].rebirthCount).toBe(2);
    expect(records[2].rebirthCount).toBe(3);

    // 每次倍率递增
    expect(records[1].multiplier).toBeGreaterThan(records[0].multiplier);
    expect(records[2].multiplier).toBeGreaterThan(records[1].multiplier);
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 声望任务→转生任务→奖励发放 任务闭环
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §6 任务闭环', () => {

  it('E2E-6-1: 声望获取应推进声望任务进度', () => {
    // Play §6: 声望获取→任务进度更新
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // pq-001 是 reach_prestige_level 类型（requiredPrestigeLevel=1, targetCount=3）
    // pq-002 是 earn_prestige_points 类型（requiredPrestigeLevel=3, targetCount=1000）
    // 先升级到 Lv3 以解锁 pq-002
    prestige.addPrestigePoints('main_quest', 999999);

    // pq-001 进度应为当前声望等级
    const progress001 = prestige.getPrestigeQuestProgress('pq-001');
    expect(progress001).toBeGreaterThan(0);

    // pq-002 进度应为累计声望值（Lv3+后才会追踪）
    const state = prestige.getState();
    if (state.currentLevel >= 3) {
      const progress002 = prestige.getPrestigeQuestProgress('pq-002');
      expect(progress002).toBeGreaterThan(0);
    }
  });

  it('E2E-6-2: 声望等级提升应推进等级任务', () => {
    // Play §6: 等级提升→reach_prestige_level任务进度
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.addPrestigePoints('main_quest', 999999999);
    const state = prestige.getState();

    // pq-001: reach_prestige_level targetCount=3
    if (state.currentLevel >= 3) {
      const progress = prestige.getPrestigeQuestProgress('pq-001');
      expect(progress).toBeGreaterThanOrEqual(3);
    }
  });

  it('E2E-6-3: 转生任务应根据转生次数可见', () => {
    // Play §6: 转生次数→任务可见（通过PrestigeSystem获取）
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const quests0 = prestige.getRebirthQuests(0);
    const quests1 = prestige.getRebirthQuests(1);
    const quests4 = prestige.getRebirthQuests(4);

    // 更高转生次数应解锁更多任务
    expect(quests1.length).toBeGreaterThanOrEqual(quests0.length);
    expect(quests4.length).toBeGreaterThanOrEqual(quests1.length);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 存档→重置→加载→状态恢复 持久化闭环
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §7 持久化闭环', () => {

  it('E2E-7-1: 声望系统存档→重置→加载应完整恢复', () => {
    // Play §7: 声望存档恢复
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    prestige.addPrestigePoints('main_quest', 999999);
    prestige.claimLevelReward(1);

    const saveData = prestige.getSaveData();
    const stateBefore = prestige.getState();

    prestige.reset();
    expect(prestige.getState().currentPoints).toBe(0);

    prestige.loadSaveData(saveData);
    const stateAfter = prestige.getState();

    expect(stateAfter.currentPoints).toBe(stateBefore.currentPoints);
    expect(stateAfter.currentLevel).toBe(stateBefore.currentLevel);
    expect(stateAfter.totalPoints).toBe(stateBefore.totalPoints);
  });

  it('E2E-7-2: 转生系统存档→重置→加载应完整恢复', () => {
    // Play §7: 转生存档恢复
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const stateBefore = rebirth.getState();

    rebirth.reset();
    expect(rebirth.getState().rebirthCount).toBe(0);

    rebirth.loadSaveData({ rebirth: stateBefore });
    const stateAfter = rebirth.getState();

    expect(stateAfter.rebirthCount).toBe(stateBefore.rebirthCount);
    expect(stateAfter.currentMultiplier).toBeCloseTo(stateBefore.currentMultiplier, 4);
    expect(stateAfter.accelerationDaysLeft).toBe(stateBefore.accelerationDaysLeft);
  });

  it('E2E-7-3: 声望存档应包含转生数据', () => {
    // Play §7: 声望存档包含转生数据
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    prestige.setRebirthStateCallback(() => rebirth.getState());
    prestige.addPrestigePoints('main_quest', 500);

    const saveData = prestige.getSaveData();
    expect(saveData.rebirth).toBeDefined();
    expect(saveData.rebirth.rebirthCount).toBe(1);
    expect(saveData.prestige.currentPoints).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §8 v16.0深化功能→初始赠送→瞬间建筑→一键重建 串联
// ═══════════════════════════════════════════════════════════════
describe('v10.0 E2E — §8 v16.0深化功能串联', () => {

  it('E2E-8-1: 转生后初始赠送应为合理数值', () => {
    // Play §8: 初始赠送合理性
    const gift = REBIRTH_INITIAL_GIFT;
    expect(gift.grain).toBeGreaterThan(0);
    expect(gift.gold).toBeGreaterThan(0);
    expect(gift.troops).toBeGreaterThan(0);
    // 初始赠送应足够早期发展
    expect(gift.grain).toBeGreaterThanOrEqual(1000);
    expect(gift.gold).toBeGreaterThanOrEqual(1000);
  });

  it('E2E-8-2: 转生后建筑升级时间应显著缩短', () => {
    // Play §8: 建筑升级加速
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const baseTime = 3600; // 1小时
    const buildTime = rebirth.calculateBuildTime(baseTime, 5);

    // 转生后建筑时间应大幅缩短
    expect(buildTime).toBeLessThan(baseTime);
  });

  it('E2E-8-3: v16.0解锁内容应覆盖多种类型', () => {
    // Play §8: 解锁内容类型多样性
    const types = new Set(REBIRTH_UNLOCK_CONTENTS.map(c => c.type));
    expect(types.size).toBeGreaterThanOrEqual(3);
    expect(types.has('feature')).toBe(true);
    expect(types.has('hero') || types.has('building') || types.has('tech')).toBe(true);
  });

});
