/**
 * v10.0 天下归心 — 转生系统流程集成测试
 *
 * 覆盖转生系统核心 play 流程：
 * - §1 转生解锁条件检查（4项条件）
 * - §2 转生倍率计算与展示
 * - §3 转生确认与数据重置（保留/重置规则）
 * - §4 转生后加速机制（7天加速期）
 * - §5 转生次数解锁内容
 * - §6 收益模拟器
 * - §7 转生专属任务
 * - §8 转生存档与持久化
 * - §9 v16.0 深化功能（初始赠送/瞬间建筑/一键重建）
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
import { RebirthSystem, calcRebirthMultiplier } from '../../prestige/RebirthSystem';
import {
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
  REBIRTH_QUESTS,
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
} from '../../../core/prestige/prestige-config';

/** 配置转生系统使其满足所有转生条件 */
function setupRebirthReady(rebirth: RebirthSystem) {
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
// §1 转生解锁条件检查
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §1 转生解锁条件检查', () => {

  it('REBIRTH-COND-1: 新游戏应不满足转生条件', () => {
    // Play §1: 新游戏条件全部不满足
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(false);
  });

  it('REBIRTH-COND-2: 应检查声望等级条件（≥20）', () => {
    // Play §1: 声望等级≥20
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.prestigeLevel.required).toBe(REBIRTH_CONDITIONS.minPrestigeLevel);
    expect(check.conditions.prestigeLevel.met).toBe(false);
  });

  it('REBIRTH-COND-3: 应检查主城等级条件（≥10）', () => {
    // Play §1: 主城等级≥10
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.castleLevel.required).toBe(REBIRTH_CONDITIONS.minCastleLevel);
    expect(check.conditions.castleLevel.met).toBe(false);
  });

  it('REBIRTH-COND-4: 应检查武将数量条件（≥5）', () => {
    // Play §1: 武将数量≥5
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.heroCount.required).toBe(REBIRTH_CONDITIONS.minHeroCount);
    expect(check.conditions.heroCount.met).toBe(false);
  });

  it('REBIRTH-COND-5: 应检查总战力条件（≥10000）', () => {
    // Play §1: 总战力≥10000
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const check = rebirth.checkRebirthConditions();
    expect(check.conditions.totalPower.required).toBe(REBIRTH_CONDITIONS.minTotalPower);
    expect(check.conditions.totalPower.met).toBe(false);
  });

  it('REBIRTH-COND-6: 满足全部条件后应可转生', () => {
    // Play §1: 所有条件满足→canRebirth=true
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);

    const check = rebirth.checkRebirthConditions();
    expect(check.canRebirth).toBe(true);
    expect(Object.values(check.conditions).every(c => c.met)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 转生倍率计算与展示
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §2 转生倍率计算', () => {

  it('REBIRTH-MULT-1: 初始倍率应为1.0', () => {
    // Play §2: 初始无转生倍率=1.0
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    expect(rebirth.getCurrentMultiplier()).toBe(1.0);
  });

  it('REBIRTH-MULT-2: 第一次转生倍率应为 1.0+0.5=1.5', () => {
    // Play §2: base=1.0 + perRebirth=0.5 × count=1
    const mult = calcRebirthMultiplier(1);
    expect(mult).toBeCloseTo(1.5, 4);
  });

  it('REBIRTH-MULT-3: 第五次转生倍率应为 1.0+0.5×5=3.5', () => {
    // Play §2: 5次转生倍率
    const mult = calcRebirthMultiplier(5);
    expect(mult).toBeCloseTo(3.5, 4);
  });

  it('REBIRTH-MULT-4: 倍率不应超过最大值10.0', () => {
    // Play §2: 倍率上限 max=10.0
    const mult = calcRebirthMultiplier(100);
    expect(mult).toBeLessThanOrEqual(REBIRTH_MULTIPLIER.max);
  });

  it('REBIRTH-MULT-5: 下次转生倍率预览应正确', () => {
    // Play §2: 下一转生倍率展示
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const nextMult = rebirth.getNextMultiplier();
    expect(nextMult).toBeCloseTo(1.5, 4); // 0→1次
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 转生确认与数据重置
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §3 转生确认与数据重置', () => {

  it('REBIRTH-EXEC-1: 条件不满足时执行转生应失败', () => {
    // Play §3: 条件不满足→拒绝转生
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const result = rebirth.executeRebirth();
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('REBIRTH-EXEC-2: 条件满足时执行转生应成功', () => {
    // Play §3: 条件满足→转生成功
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);

    const result = rebirth.executeRebirth();
    expect(result.success).toBe(true);
    expect(result.newCount).toBe(1);
    expect(result.multiplier).toBeCloseTo(1.5, 4);
  });

  it('REBIRTH-EXEC-3: 转生后应触发重置回调', () => {
    // Play §3: 转生→重置规则执行
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const resetRules: string[] = [];
    rebirth.setCallbacks({
      castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
      heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
      totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
      prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      onReset: (rules) => { resetRules.push(...rules); },
    });
    rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);

    rebirth.executeRebirth();
    expect(resetRules.length).toBeGreaterThan(0);
  });

  it('REBIRTH-EXEC-4: 保留规则应包含关键项目', () => {
    // Play §3: 保留英雄/装备/科技点/声望/成就/VIP
    const keepRules = REBIRTH_KEEP_RULES;
    expect(keepRules).toContain('keep_heroes');
    expect(keepRules).toContain('keep_equipment');
    expect(keepRules).toContain('keep_prestige');
    expect(keepRules).toContain('keep_achievements');
  });

  it('REBIRTH-EXEC-5: 重置规则应包含关键项目', () => {
    // Play §3: 重置建筑/资源/地图/任务/战役
    const resetRules = REBIRTH_RESET_RULES;
    expect(resetRules).toContain('reset_buildings');
    expect(resetRules).toContain('reset_resources');
    expect(resetRules).toContain('reset_campaign');
  });

  it('REBIRTH-EXEC-6: 转生记录应正确保存', () => {
    // Play §3: 转生记录持久化
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const records = rebirth.getRebirthRecords();
    expect(records.length).toBe(1);
    expect(records[0].rebirthCount).toBe(1);
    expect(records[0].multiplier).toBeCloseTo(1.5, 4);
    expect(records[0].timestamp).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 转生后加速机制
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §4 转生后加速机制', () => {

  it('REBIRTH-ACCEL-1: 转生后应激活7天加速期', () => {
    // Play §4: 转生后7天加速
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const accel = rebirth.getAcceleration();
    expect(accel.active).toBe(true);
    expect(accel.daysLeft).toBe(REBIRTH_ACCELERATION.durationDays);
    expect(accel.daysLeft).toBe(7);
  });

  it('REBIRTH-ACCEL-2: 加速期应提升建筑速度', () => {
    // Play §4: 建筑升级速度×1.5
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const mults = rebirth.getEffectiveMultipliers();
    // buildSpeed = base(1.5) × accel.buildSpeed(1.5) = 2.25
    expect(mults.buildSpeed).toBeCloseTo(1.5 * REBIRTH_ACCELERATION.buildSpeedMultiplier, 4);
  });

  it('REBIRTH-ACCEL-3: 加速期应提升资源产出', () => {
    // Play §4: 资源产出×2.0
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const mults = rebirth.getEffectiveMultipliers();
    expect(mults.resource).toBeCloseTo(1.5 * REBIRTH_ACCELERATION.resourceMultiplier, 4);
  });

  it('REBIRTH-ACCEL-4: 加速期应提升经验获取', () => {
    // Play §4: 经验获取×2.0
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const mults = rebirth.getEffectiveMultipliers();
    expect(mults.exp).toBeCloseTo(1.5 * REBIRTH_ACCELERATION.expMultiplier, 4);
  });

  it('REBIRTH-ACCEL-5: 加速期结束后倍率应恢复正常', () => {
    // Play §4: 加速到期→恢复正常倍率
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    // 模拟加速期结束（7天后）
    const state = rebirth.getState();
    expect(state.accelerationDaysLeft).toBe(7);

    // 加速期结束后 effectiveMultipliers 应不含加速加成
    // 通过 loadSaveData 模拟加速期结束
    const expiredState = { ...state, accelerationDaysLeft: 0 };
    rebirth.loadSaveData({ rebirth: expiredState });

    const mults = rebirth.getEffectiveMultipliers();
    expect(mults.buildSpeed).toBeCloseTo(1.5, 4); // 仅转生倍率，无加速
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 转生次数解锁内容
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §5 转生次数解锁内容', () => {

  it('REBIRTH-UNLOCK-1: 解锁内容列表应包含多个条目', () => {
    // Play §5: 转生次数解锁内容
    expect(REBIRTH_UNLOCK_CONTENTS.length).toBeGreaterThan(0);
  });

  it('REBIRTH-UNLOCK-2: 初始状态应无解锁内容', () => {
    // Play §5: 0次转生→无解锁
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const unlocked = rebirth.getUnlockedContents();
    expect(unlocked.length).toBe(0);
  });

  it('REBIRTH-UNLOCK-3: 第1次转生应解锁转生商店', () => {
    // Play §5: 1次转生→rebirth_shop
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const unlocked = rebirth.getUnlockedContents();
    expect(unlocked.some(c => c.unlockId === 'rebirth_shop')).toBe(true);
  });

  it('REBIRTH-UNLOCK-4: 第2次转生应解锁高级武将', () => {
    // Play §5: 2次转生→hero_legend
    const contents = REBIRTH_UNLOCK_CONTENTS.filter(c => c.requiredRebirthCount <= 2);
    expect(contents.some(c => c.unlockId === 'hero_legend')).toBe(true);
  });

  it('REBIRTH-UNLOCK-5: 第10次转生应解锁帝王之路', () => {
    // Play §5: 10次转生→emperor_road
    const emperorRoad = REBIRTH_UNLOCK_CONTENTS.find(c => c.unlockId === 'emperor_road');
    expect(emperorRoad).toBeDefined();
    expect(emperorRoad!.requiredRebirthCount).toBe(10);
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 收益模拟器
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §6 收益模拟器', () => {

  it('REBIRTH-SIM-1: 模拟器应返回预计资源收益', () => {
    // Play §6: 收益模拟器
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const result = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 7,
      dailyOnlineHours: 4,
    });

    expect(result.estimatedResources).toBeDefined();
    expect(result.estimatedResources.gold).toBeGreaterThan(0);
    expect(result.estimatedResources.grain).toBeGreaterThan(0);
  });

  it('REBIRTH-SIM-2: 模拟器应返回声望增长预估', () => {
    // Play §6: 声望增长预估
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const result = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 30,
      dailyOnlineHours: 4,
    });

    expect(result.estimatedPrestigeGain).toBeGreaterThan(0);
    expect(result.days).toBe(30);
  });

  it('REBIRTH-SIM-3: 加速期内收益应高于正常期', () => {
    // Play §6: 加速收益对比
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const result = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 7,
      dailyOnlineHours: 4,
    });

    // 加速收益应存在且小于总收益
    expect(result.rebirthAccelerationBonus).toBeDefined();
    expect(result.rebirthAccelerationBonus.gold).toBeGreaterThan(0);
    expect(result.rebirthAccelerationBonus.gold).toBeLessThanOrEqual(result.estimatedResources.gold);
  });

  it('REBIRTH-SIM-4: 更高转生次数应有更高收益', () => {
    // Play §6: 转生倍率→收益提升
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const result1 = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 0,
      simulateDays: 7,
      dailyOnlineHours: 4,
    });

    const result2 = rebirth.simulateEarnings({
      currentPrestigeLevel: 20,
      currentRebirthCount: 4,
      simulateDays: 7,
      dailyOnlineHours: 4,
    });

    expect(result2.estimatedResources.gold).toBeGreaterThan(result1.estimatedResources.gold);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 转生专属任务
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §7 转生专属任务', () => {

  it('REBIRTH-QUEST-1: 转生任务列表应包含多个任务', () => {
    // Play §7: 转生专属任务
    expect(REBIRTH_QUESTS.length).toBeGreaterThan(0);
  });

  it('REBIRTH-QUEST-2: 初始状态应可见初次转生任务', () => {
    // Play §7: 0次转生可见rq-001
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    // 转生任务通过 PrestigeSystem.getRebirthQuests(rebirthCount) 获取
    const quests = prestige.getRebirthQuests(0);
    expect(quests.some(q => q.id === 'rq-001')).toBe(true);
  });

  it('REBIRTH-QUEST-3: 转生后应解锁更多任务', () => {
    // Play §7: 转生次数增加→任务解锁
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();

    const quests0 = prestige.getRebirthQuests(0).length;
    const quests1 = prestige.getRebirthQuests(1).length;

    expect(quests1).toBeGreaterThanOrEqual(quests0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §8 转生存档与持久化
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §8 存档与持久化', () => {

  it('REBIRTH-SAVE-1: 转生后状态应可通过 getState 获取', () => {
    // Play §8: 转生状态持久化
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const state = rebirth.getState();
    expect(state.rebirthCount).toBe(1);
    expect(state.currentMultiplier).toBeCloseTo(1.5, 4);
    expect(state.rebirthRecords.length).toBe(1);
    expect(state.accelerationDaysLeft).toBe(7);
  });

  it('REBIRTH-SAVE-2: 加载存档应恢复转生状态', () => {
    // Play §8: 存档恢复
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const state = rebirth.getState();

    // 重置后加载
    rebirth.reset();
    expect(rebirth.getState().rebirthCount).toBe(0);

    rebirth.loadSaveData({ rebirth: state });
    expect(rebirth.getState().rebirthCount).toBe(1);
    expect(rebirth.getState().currentMultiplier).toBeCloseTo(1.5, 4);
  });

});

// ═══════════════════════════════════════════════════════════════
// §9 v16.0 深化功能（初始赠送/瞬间建筑/一键重建）
// ═══════════════════════════════════════════════════════════════
describe('v10.0 转生系统 — §9 v16.0 深化功能', () => {

  it('REBIRTH-V16-1: 转生初始赠送应包含粮草/铜钱/兵力', () => {
    // Play §9: 转生后初始资源赠送
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const gift = rebirth.getInitialGift();
    expect(gift.grain).toBe(REBIRTH_INITIAL_GIFT.grain);
    expect(gift.gold).toBe(REBIRTH_INITIAL_GIFT.gold);
    expect(gift.troops).toBe(REBIRTH_INITIAL_GIFT.troops);
  });

  it('REBIRTH-V16-2: 瞬间建筑配置应正确', () => {
    // Play §9: 低级建筑瞬间升级
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const config = rebirth.getInstantBuildConfig();
    expect(config.maxInstantLevel).toBe(REBIRTH_INSTANT_BUILD.maxInstantLevel);
    expect(config.speedDivisor).toBe(REBIRTH_INSTANT_BUILD.speedDivisor);
  });

  it('REBIRTH-V16-3: 建筑升级时间应受转生倍率影响', () => {
    // Play §9: 建筑升级时间 = 基础时间 ÷ 倍率
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    setupRebirthReady(rebirth);
    rebirth.executeRebirth();

    const buildTime = rebirth.calculateBuildTime(100, 5);
    // buildTime 应小于基础时间（受倍率和加速影响）
    expect(buildTime).toBeLessThan(100);
  });

  it('REBIRTH-V16-4: 一键重建计划应根据转生次数返回', () => {
    // Play §9: 一键重建
    const sim = createSim();
    const rebirth = sim.engine.getRebirthSystem();

    const plan = rebirth.getAutoRebuildPlan();
    // 0次转生可能返回null或空计划
    expect(plan === null || Array.isArray(plan)).toBe(true);
  });

});
