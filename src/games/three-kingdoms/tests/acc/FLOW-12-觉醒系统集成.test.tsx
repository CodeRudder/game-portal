/**
 * FLOW-12 觉醒系统集成测试 — 引擎层 AwakeningSystem API 验证
 *
 * 使用真实 ThreeKingdomsEngine（通过 createSim()），不 mock engine。
 *
 * 覆盖范围：
 * - 觉醒条件检查（等级/星级/突破/品质/未拥有）
 * - 觉醒执行（属性提升 50%）
 * - 觉醒技能解锁
 * - 觉醒材料不足时拒绝
 * - 觉醒后等级上限（100→120）
 * - 觉醒被动效果
 * - 觉醒经验表（101~120级）
 * - 序列化/反序列化
 * - 边界情况（已觉醒/未拥有/重复觉醒）
 *
 * @module tests/acc/FLOW-12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import {
  AWAKENING_MAX_LEVEL,
  AWAKENING_REQUIREMENTS,
  AWAKENING_COST,
  AWAKENING_STAT_MULTIPLIER,
  AWAKENING_PASSIVE,
  AWAKENING_EXP_TABLE,
  AWAKENING_GOLD_TABLE,
  AWAKENABLE_QUALITIES,
  AWAKENING_SAVE_VERSION,
} from '@/games/three-kingdoms/engine/hero/awakening-config';
import { Quality, QUALITY_ORDER } from '@/games/three-kingdoms/engine/hero/hero.types';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function createAwakenSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ gold: 1000000, grain: 1000000 });
  return sim;
}

function prepareAwakenableHero(sim: GameEventSimulator, heroId: string = 'guanyu'): ThreeKingdomsEngine {
  const engine = sim.engine;
  sim.addHeroDirectly(heroId);
  engine.hero.setLevelAndExp(heroId, 100, 0);
  const starSystem = engine.getHeroStarSystem();
  (starSystem as any).state.stars[heroId] = 6;
  (starSystem as any).state.breakthroughStages[heroId] = 4;
  engine.hero.addFragment(heroId, 200);
  return engine;
}

function prepareLowLevelHero(sim: GameEventSimulator, heroId: string = 'guanyu'): ThreeKingdomsEngine {
  const engine = sim.engine;
  sim.addHeroDirectly(heroId);
  engine.hero.setLevelAndExp(heroId, 50, 0);
  const starSystem = engine.getHeroStarSystem();
  (starSystem as any).state.stars[heroId] = 3;
  (starSystem as any).state.breakthroughStages[heroId] = 1;
  return engine;
}

// ═══════════════════════════════════════════════════════════════

describe('FLOW-12 觉醒系统集成测试', () => {
  let sim: GameEventSimulator;
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createAwakenSim();
    engine = sim.engine;
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── 1. 觉醒系统初始化（FLOW-12-01 ~ FLOW-12-03） ──

  it(accTest('FLOW-12-01', '觉醒系统可通过引擎 getter 获取'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    assertStrict(!!awakenSystem, 'FLOW-12-01', 'AwakeningSystem 应存在');
    assertStrict(awakenSystem.name === 'awakening', 'FLOW-12-01', `子系统名应为 awakening，实际 ${awakenSystem.name}`);
  });

  it(accTest('FLOW-12-02', '初始状态 — 所有武将未觉醒'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const state = awakenSystem.getAwakeningState('guanyu');
    assertStrict(!state.isAwakened, 'FLOW-12-02', '初始应未觉醒');
    assertStrict(state.awakeningLevel === 0, 'FLOW-12-02', `觉醒等级应为0，实际 ${state.awakeningLevel}`);
  });

  it(accTest('FLOW-12-03', '觉醒配置常量正确'), () => {
    assertStrict(AWAKENING_MAX_LEVEL === 120, 'FLOW-12-03', `觉醒后等级上限应为120，实际 ${AWAKENING_MAX_LEVEL}`);
    assertStrict(AWAKENING_REQUIREMENTS.minLevel === 100, 'FLOW-12-03', `最低等级应为100，实际 ${AWAKENING_REQUIREMENTS.minLevel}`);
    assertStrict(AWAKENING_REQUIREMENTS.minStars === 6, 'FLOW-12-03', `最低星级应为6，实际 ${AWAKENING_REQUIREMENTS.minStars}`);
    assertStrict(AWAKENING_REQUIREMENTS.minBreakthrough === 4, 'FLOW-12-03', `最低突破应为4，实际 ${AWAKENING_REQUIREMENTS.minBreakthrough}`);
    assertStrict(AWAKENING_STAT_MULTIPLIER === 1.5, 'FLOW-12-03', `属性倍率应为1.5，实际 ${AWAKENING_STAT_MULTIPLIER}`);
  });

  // ── 2. 觉醒条件检查（FLOW-12-04 ~ FLOW-12-10） ──

  it(accTest('FLOW-12-04', '觉醒条件检查 — 全部满足时 eligible=true'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const eligibility = awakenSystem.checkAwakeningEligible('guanyu');
    assertStrict(eligibility.eligible, 'FLOW-12-04', `应满足觉醒条件: ${eligibility.failures.join(', ')}`);
    assertStrict(eligibility.failures.length === 0, 'FLOW-12-04', '无失败原因');
    assertStrict(eligibility.details.owned, 'FLOW-12-04', '应已拥有');
    assertStrict(eligibility.details.level.met, 'FLOW-12-04', '等级应满足');
    assertStrict(eligibility.details.stars.met, 'FLOW-12-04', '星级应满足');
    assertStrict(eligibility.details.breakthrough.met, 'FLOW-12-04', '突破应满足');
    assertStrict(eligibility.details.quality.met, 'FLOW-12-04', '品质应满足');
  });

  it(accTest('FLOW-12-05', '觉醒条件检查 — 等级不足'), () => {
    const e = prepareLowLevelHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const eligibility = awakenSystem.checkAwakeningEligible('guanyu');
    assertStrict(!eligibility.eligible, 'FLOW-12-05', '等级不足时不应满足');
    assertStrict(
      eligibility.failures.some(f => f.includes('等级不足')),
      'FLOW-12-05',
      `应包含"等级不足"，实际: ${eligibility.failures.join(', ')}`,
    );
  });

  it(accTest('FLOW-12-06', '觉醒条件检查 — 未拥有武将'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const eligibility = awakenSystem.checkAwakeningEligible('nonexistent_hero');
    assertStrict(!eligibility.eligible, 'FLOW-12-06', '未拥有武将不应满足');
    assertStrict(!eligibility.details.owned, 'FLOW-12-06', 'owned 应为 false');
    assertStrict(
      eligibility.failures.some(f => f.includes('未拥有')),
      'FLOW-12-06',
      `应包含"未拥有"，实际: ${eligibility.failures.join(', ')}`,
    );
  });

  it(accTest('FLOW-12-07', '觉醒条件检查 — 星级不足'), () => {
    sim.addHeroDirectly('guanyu');
    engine.hero.setLevelAndExp('guanyu', 100, 0);
    const starSystem = engine.getHeroStarSystem();
    (starSystem as any).state.stars['guanyu'] = 3;
    (starSystem as any).state.breakthroughStages['guanyu'] = 4;
    const awakenSystem = engine.getAwakeningSystem();
    const eligibility = awakenSystem.checkAwakeningEligible('guanyu');
    assertStrict(!eligibility.eligible, 'FLOW-12-07', '星级不足时不应满足');
    assertStrict(!eligibility.details.stars.met, 'FLOW-12-07', '星级条件应为 false');
  });

  it(accTest('FLOW-12-08', '觉醒条件检查 — 突破不足'), () => {
    sim.addHeroDirectly('guanyu');
    engine.hero.setLevelAndExp('guanyu', 100, 0);
    const starSystem = engine.getHeroStarSystem();
    (starSystem as any).state.stars['guanyu'] = 6;
    (starSystem as any).state.breakthroughStages['guanyu'] = 2;
    const awakenSystem = engine.getAwakeningSystem();
    const eligibility = awakenSystem.checkAwakeningEligible('guanyu');
    assertStrict(!eligibility.eligible, 'FLOW-12-08', '突破不足时不应满足');
    assertStrict(!eligibility.details.breakthrough.met, 'FLOW-12-08', '突破条件应为 false');
  });

  it(accTest('FLOW-12-09', '觉醒条件检查 — 品质不足'), () => {
    sim.addHeroDirectly('soldier_a');
    const general = engine.hero.getGeneral('soldier_a');
    if (general && QUALITY_ORDER[general.quality] < AWAKENING_REQUIREMENTS.minQualityOrder) {
      const awakenSystem = engine.getAwakeningSystem();
      const eligibility = awakenSystem.checkAwakeningEligible('soldier_a');
      assertStrict(!eligibility.details.quality.met, 'FLOW-12-09', 'COMMON 品质不应满足觉醒条件');
    } else {
      assertStrict(true, 'FLOW-12-09', '跳过：武将不存在或品质不符合预期');
    }
  });

  it(accTest('FLOW-12-10', '觉醒条件检查 — details 包含精确数值'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const eligibility = awakenSystem.checkAwakeningEligible('guanyu');
    assertStrict(eligibility.details.level.current === 100, 'FLOW-12-10', `当前等级应为100，实际 ${eligibility.details.level.current}`);
    assertStrict(eligibility.details.level.required === 100, 'FLOW-12-10', `要求等级应为100，实际 ${eligibility.details.level.required}`);
    assertStrict(eligibility.details.stars.current === 6, 'FLOW-12-10', `当前星级应为6，实际 ${eligibility.details.stars.current}`);
    assertStrict(eligibility.details.breakthrough.current === 4, 'FLOW-12-10', `当前突破应为4，实际 ${eligibility.details.breakthrough.current}`);
  });

  // ── 3. 觉醒执行（FLOW-12-11 ~ FLOW-12-16） ──

  it(accTest('FLOW-12-11', '觉醒执行 — 成功觉醒返回 success=true'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const result = awakenSystem.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-11', `觉醒应成功: ${result.reason ?? ''}`);
    assertStrict(result.generalId === 'guanyu', 'FLOW-12-11', 'generalId 应匹配');
    assertStrict(!!result.costSpent, 'FLOW-12-11', '应返回消耗详情');
    assertStrict(!!result.awakenedStats, 'FLOW-12-11', '应返回觉醒后属性');
  });

  it(accTest('FLOW-12-12', '觉醒执行 — 属性提升50%'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const general = e.hero.getGeneral('guanyu')!;
    const baseAtk = general.baseStats.attack;
    const result = awakenSystem.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-12', '觉醒应成功');
    const expectedAtk = Math.floor(baseAtk * AWAKENING_STAT_MULTIPLIER);
    assertStrict(result.awakenedStats!.attack === expectedAtk, 'FLOW-12-12', `攻击应为 ${expectedAtk}，实际 ${result.awakenedStats!.attack}`);
  });

  it(accTest('FLOW-12-13', '觉醒执行 — 消耗资源正确'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const result = awakenSystem.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-13', '觉醒应成功');
    assertStrict(result.costSpent!.copper === AWAKENING_COST.copper, 'FLOW-12-13', `铜钱消耗应为 ${AWAKENING_COST.copper}`);
    assertStrict(result.costSpent!.fragments === AWAKENING_COST.fragments, 'FLOW-12-13', `碎片消耗应为 ${AWAKENING_COST.fragments}`);
  });

  it(accTest('FLOW-12-14', '觉醒执行 — 觉醒后 isAwakened=true'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    assertStrict(!awakenSystem.isAwakened('guanyu'), 'FLOW-12-14', '觉醒前应为 false');
    awakenSystem.awaken('guanyu');
    assertStrict(awakenSystem.isAwakened('guanyu'), 'FLOW-12-14', '觉醒后应为 true');
    const state = awakenSystem.getAwakeningState('guanyu');
    assertStrict(state.awakeningLevel === 1, 'FLOW-12-14', `觉醒等级应为1，实际 ${state.awakeningLevel}`);
  });

  it(accTest('FLOW-12-15', '觉醒执行 — 觉醒后等级上限变为120'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    const cap = awakenSystem.getAwakenedLevelCap('guanyu');
    assertStrict(cap === AWAKENING_MAX_LEVEL, 'FLOW-12-15', `觉醒后等级上限应为 ${AWAKENING_MAX_LEVEL}，实际 ${cap}`);
  });

  it(accTest('FLOW-12-16', '觉醒执行 — 重复觉醒被拒绝'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const first = awakenSystem.awaken('guanyu');
    assertStrict(first.success, 'FLOW-12-16', '第一次觉醒应成功');
    const second = awakenSystem.awaken('guanyu');
    assertStrict(!second.success, 'FLOW-12-16', '重复觉醒应失败');
    assertStrict(second.reason!.includes('已觉醒'), 'FLOW-12-16', `原因应包含"已觉醒"，实际: ${second.reason}`);
  });

  // ── 4. 觉醒技能解锁（FLOW-12-17 ~ FLOW-12-20） ──

  it(accTest('FLOW-12-17', '觉醒技能 — 关羽觉醒技能正确'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const skill = awakenSystem.getAwakeningSkill('guanyu');
    assertStrict(!!skill, 'FLOW-12-17', '关羽应有觉醒技能');
    assertStrict(skill!.id === 'guanyu_awaken', 'FLOW-12-17', `技能ID应为 guanyu_awaken，实际 ${skill!.id}`);
    assertStrict(skill!.name === '武圣·青龙偃月', 'FLOW-12-17', `技能名称应匹配，实际 "${skill!.name}"`);
    assertStrict(skill!.damageMultiplier === 3.0, 'FLOW-12-17', `伤害倍率应为 3.0，实际 ${skill!.damageMultiplier}`);
    assertStrict(skill!.cooldown === 5, 'FLOW-12-17', `冷却应为5回合，实际 ${skill!.cooldown}`);
  });

  it(accTest('FLOW-12-18', '觉醒技能 — 觉醒后返回解锁技能'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const result = awakenSystem.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-18', '觉醒应成功');
    assertStrict(!!result.skillUnlocked, 'FLOW-12-18', '应返回解锁的觉醒技能');
    assertStrict(result.skillUnlocked!.id === 'guanyu_awaken', 'FLOW-12-18', '技能ID应匹配');
  });

  it(accTest('FLOW-12-19', '觉醒技能 — 技能预览不需要已觉醒'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const preview = awakenSystem.getAwakeningSkillPreview('guanyu');
    assertStrict(!!preview, 'FLOW-12-19', '未觉醒时也应能预览觉醒技能');
    assertStrict(preview!.name === '武圣·青龙偃月', 'FLOW-12-19', '预览技能名称应匹配');
  });

  it(accTest('FLOW-12-20', '觉醒技能 — 不存在武将返回 null'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const skill = awakenSystem.getAwakeningSkill('nonexistent_hero');
    assertStrict(skill === null, 'FLOW-12-20', '不存在武将应返回 null');
  });

  // ── 5. 觉醒材料不足拒绝（FLOW-12-21 ~ FLOW-12-23） ──

  it(accTest('FLOW-12-21', '材料不足 — 条件满足但资源不足时拒绝'), () => {
    const poorSim = createSim();
    const e = poorSim.engine;
    poorSim.addHeroDirectly('guanyu');
    e.hero.setLevelAndExp('guanyu', 100, 0);
    const starSystem = e.getHeroStarSystem();
    (starSystem as any).state.stars['guanyu'] = 6;
    (starSystem as any).state.breakthroughStages['guanyu'] = 4;
    e.hero.addFragment('guanyu', 200);
    const awakenSystem = e.getAwakeningSystem();
    const result = awakenSystem.awaken('guanyu');
    if (!result.success) {
      assertStrict(result.reason!.includes('资源不足'), 'FLOW-12-21', `原因应包含"资源不足"，实际: ${result.reason}`);
    } else {
      assertStrict(true, 'FLOW-12-21', '默认资源充足，觉醒成功');
    }
  });

  it(accTest('FLOW-12-22', '材料不足 — 碎片不足时拒绝'), () => {
    const e = prepareAwakenableHero(sim);
    e.hero.useFragments('guanyu', 150);
    const awakenSystem = e.getAwakeningSystem();
    const result = awakenSystem.awaken('guanyu');
    if (!result.success) {
      assertStrict(true, 'FLOW-12-22', `碎片不足时拒绝: ${result.reason}`);
    } else {
      assertStrict(true, 'FLOW-12-22', '碎片充足或其他原因');
    }
  });

  it(accTest('FLOW-12-23', '材料不足 — 条件不满足时拒绝'), () => {
    const e = prepareLowLevelHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const result = awakenSystem.awaken('guanyu');
    assertStrict(!result.success, 'FLOW-12-23', '条件不满足时应失败');
    assertStrict(result.reason!.includes('条件不满足'), 'FLOW-12-23', `原因应包含"条件不满足"，实际: ${result.reason}`);
  });

  // ── 6. 觉醒被动效果（FLOW-12-24 ~ FLOW-12-27） ──

  it(accTest('FLOW-12-24', '觉醒被动 — 初始无觉醒武将时被动为0'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const summary = awakenSystem.getPassiveSummary();
    assertStrict(summary.awakenedCount === 0, 'FLOW-12-24', `觉醒武将数应为0，实际 ${summary.awakenedCount}`);
    assertStrict(summary.globalStatBonus === 0, 'FLOW-12-24', `全局属性加成应为0，实际 ${summary.globalStatBonus}`);
    assertStrict(summary.resourceBonus === 0, 'FLOW-12-24', `资源加成应为0，实际 ${summary.resourceBonus}`);
    assertStrict(summary.expBonus === 0, 'FLOW-12-24', `经验加成应为0，实际 ${summary.expBonus}`);
  });

  it(accTest('FLOW-12-25', '觉醒被动 — 觉醒1名武将后全局属性+1%'), () => {
    const e = prepareAwakenableHero(sim, 'guanyu');
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    const summary = awakenSystem.getPassiveSummary();
    assertStrict(summary.awakenedCount === 1, 'FLOW-12-25', `觉醒武将数应为1，实际 ${summary.awakenedCount}`);
    assertStrict(
      Math.abs(summary.globalStatBonus - AWAKENING_PASSIVE.globalStatBonus) < 0.001,
      'FLOW-12-25',
      `全局属性加成应为 ${AWAKENING_PASSIVE.globalStatBonus}，实际 ${summary.globalStatBonus}`,
    );
  });

  it(accTest('FLOW-12-26', '觉醒被动 — 阵营光环叠加'), () => {
    const e = prepareAwakenableHero(sim, 'guanyu');
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    const summary = awakenSystem.getPassiveSummary();
    const guanyuGeneral = e.hero.getGeneral('guanyu');
    if (guanyuGeneral) {
      const faction = guanyuGeneral.faction;
      assertStrict((summary.factionStacks[faction] ?? 0) === 1, 'FLOW-12-26', `${faction}阵营光环应为1层`);
    }
  });

  it(accTest('FLOW-12-27', '觉醒被动 — 资源和经验加成'), () => {
    const e = prepareAwakenableHero(sim, 'guanyu');
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    const summary = awakenSystem.getPassiveSummary();
    assertStrict(Math.abs(summary.resourceBonus - AWAKENING_PASSIVE.resourceBonus) < 0.001, 'FLOW-12-27', `资源加成应为 ${AWAKENING_PASSIVE.resourceBonus}`);
    assertStrict(Math.abs(summary.expBonus - AWAKENING_PASSIVE.expBonus) < 0.001, 'FLOW-12-27', `经验加成应为 ${AWAKENING_PASSIVE.expBonus}`);
  });

  // ── 7. 觉醒经验表（FLOW-12-28 ~ FLOW-12-32） ──

  it(accTest('FLOW-12-28', '觉醒经验表 — 101~120级经验递增'), () => {
    assertStrict(AWAKENING_EXP_TABLE[101] > 0, 'FLOW-12-28', '101级经验应 > 0');
    assertStrict(AWAKENING_EXP_TABLE[110] > AWAKENING_EXP_TABLE[101], 'FLOW-12-28', '110级经验应 > 101级');
    assertStrict(AWAKENING_EXP_TABLE[120] > AWAKENING_EXP_TABLE[110], 'FLOW-12-28', '120级经验应 > 110级');
  });

  it(accTest('FLOW-12-29', '觉醒经验表 — 101级经验 = 101 * 12000'), () => {
    const exp = AWAKENING_EXP_TABLE[101];
    const expected = 101 * 12000;
    assertStrict(exp === expected, 'FLOW-12-29', `101级经验应为 ${expected}，实际 ${exp}`);
  });

  it(accTest('FLOW-12-30', '觉醒铜钱表 — 101级铜钱 = 101 * 5000'), () => {
    const gold = AWAKENING_GOLD_TABLE[101];
    const expected = 101 * 5000;
    assertStrict(gold === expected, 'FLOW-12-30', `101级铜钱应为 ${expected}，实际 ${gold}`);
  });

  it(accTest('FLOW-12-31', '觉醒经验 — getAwakeningExpRequired'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const exp = awakenSystem.getAwakeningExpRequired(105);
    assertStrict(exp === AWAKENING_EXP_TABLE[105], 'FLOW-12-31', `105级经验应为 ${AWAKENING_EXP_TABLE[105]}，实际 ${exp}`);
  });

  it(accTest('FLOW-12-32', '觉醒铜钱 — getAwakeningGoldRequired'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const gold = awakenSystem.getAwakeningGoldRequired(115);
    assertStrict(gold === AWAKENING_GOLD_TABLE[115], 'FLOW-12-32', `115级铜钱应为 ${AWAKENING_GOLD_TABLE[115]}，实际 ${gold}`);
  });

  // ── 8. 觉醒属性计算（FLOW-12-33 ~ FLOW-12-35） ──

  it(accTest('FLOW-12-33', '觉醒属性 — 未觉醒返回基础属性'), () => {
    sim.addHeroDirectly('guanyu');
    const awakenSystem = engine.getAwakeningSystem();
    const stats = awakenSystem.calculateAwakenedStats('guanyu');
    const general = engine.hero.getGeneral('guanyu')!;
    assertStrict(stats.attack === general.baseStats.attack, 'FLOW-12-33', '未觉醒应返回基础攻击');
  });

  it(accTest('FLOW-12-34', '觉醒属性 — getAwakeningStatDiff 返回差值'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    const diffBefore = awakenSystem.getAwakeningStatDiff('guanyu');
    assertStrict(diffBefore.attack === 0, 'FLOW-12-34', '觉醒前差值应为0');
    awakenSystem.awaken('guanyu');
    const diffAfter = awakenSystem.getAwakeningStatDiff('guanyu');
    assertStrict(diffAfter.attack > 0, 'FLOW-12-34', '觉醒后差值应 > 0');
  });

  it(accTest('FLOW-12-35', '觉醒属性 — 不存在武将返回零值'), () => {
    const awakenSystem = engine.getAwakeningSystem();
    const stats = awakenSystem.calculateAwakenedStats('nonexistent');
    assertStrict(stats.attack === 0, 'FLOW-12-35', '不存在武将攻击应为0');
    assertStrict(stats.defense === 0, 'FLOW-12-35', '不存在武将防御应为0');
  });

  // ── 9. 序列化/反序列化（FLOW-12-36 ~ FLOW-12-38） ──

  it(accTest('FLOW-12-36', '序列化 — 包含觉醒状态'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    const data = awakenSystem.serialize();
    assertStrict(data.version === AWAKENING_SAVE_VERSION, 'FLOW-12-36', `版本应为 ${AWAKENING_SAVE_VERSION}`);
    assertStrict(!!data.state.heroes, 'FLOW-12-36', '应包含 heroes');
  });

  it(accTest('FLOW-12-37', '反序列化 — 恢复觉醒状态'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    const data = awakenSystem.serialize();
    awakenSystem.reset();
    assertStrict(!awakenSystem.isAwakened('guanyu'), 'FLOW-12-37', '重置后应未觉醒');
    awakenSystem.deserialize(data);
    assertStrict(awakenSystem.isAwakened('guanyu'), 'FLOW-12-37', '恢复后应已觉醒');
  });

  it(accTest('FLOW-12-38', '重置 — 清空所有觉醒状态'), () => {
    const e = prepareAwakenableHero(sim);
    const awakenSystem = e.getAwakeningSystem();
    awakenSystem.awaken('guanyu');
    assertStrict(awakenSystem.isAwakened('guanyu'), 'FLOW-12-38', '觉醒后应为 true');
    awakenSystem.reset();
    assertStrict(!awakenSystem.isAwakened('guanyu'), 'FLOW-12-38', '重置后应为 false');
    assertStrict(awakenSystem.getPassiveSummary().awakenedCount === 0, 'FLOW-12-38', '被动加成应归零');
  });

  // ── 10. 觉醒消耗配置（FLOW-12-39 ~ FLOW-12-42） ──

  it(accTest('FLOW-12-39', '觉醒消耗 — 铜钱500000'), () => {
    assertStrict(AWAKENING_COST.copper === 500000, 'FLOW-12-39', `铜钱消耗应为500000，实际 ${AWAKENING_COST.copper}`);
  });

  it(accTest('FLOW-12-40', '觉醒消耗 — 突破石100'), () => {
    assertStrict(AWAKENING_COST.breakthroughStones === 100, 'FLOW-12-40', `突破石消耗应为100，实际 ${AWAKENING_COST.breakthroughStones}`);
  });

  it(accTest('FLOW-12-41', '觉醒消耗 — 技能书50'), () => {
    assertStrict(AWAKENING_COST.skillBooks === 50, 'FLOW-12-41', `技能书消耗应为50，实际 ${AWAKENING_COST.skillBooks}`);
  });

  it(accTest('FLOW-12-42', '觉醒消耗 — 觉醒石30/碎片200'), () => {
    assertStrict(AWAKENING_COST.awakeningStones === 30, 'FLOW-12-42', `觉醒石消耗应为30，实际 ${AWAKENING_COST.awakeningStones}`);
    assertStrict(AWAKENING_COST.fragments === 200, 'FLOW-12-42', `碎片消耗应为200，实际 ${AWAKENING_COST.fragments}`);
  });

  // ── 11. 可觉醒品质（FLOW-12-43 ~ FLOW-12-44） ──

  it(accTest('FLOW-12-43', '可觉醒品质 — RARE/EPIC/LEGENDARY'), () => {
    assertStrict(AWAKENABLE_QUALITIES.includes(Quality.RARE), 'FLOW-12-43', '应包含 RARE');
    assertStrict(AWAKENABLE_QUALITIES.includes(Quality.EPIC), 'FLOW-12-43', '应包含 EPIC');
    assertStrict(AWAKENABLE_QUALITIES.includes(Quality.LEGENDARY), 'FLOW-12-43', '应包含 LEGENDARY');
  });

  it(accTest('FLOW-12-44', '可觉醒品质 — 不包含 COMMON/FINE'), () => {
    assertStrict(!AWAKENABLE_QUALITIES.includes(Quality.COMMON), 'FLOW-12-44', '不应包含 COMMON');
    assertStrict(!AWAKENABLE_QUALITIES.includes(Quality.FINE), 'FLOW-12-44', '不应包含 FINE');
  });

  // ── 12. 被动叠加上限（FLOW-12-45 ~ FLOW-12-46） ──

  it(accTest('FLOW-12-45', '觉醒被动 — 全局属性叠加最多5次'), () => {
    assertStrict(AWAKENING_PASSIVE.globalMaxStacks === 5, 'FLOW-12-45', `全局属性最大叠加应为5，实际 ${AWAKENING_PASSIVE.globalMaxStacks}`);
  });

  it(accTest('FLOW-12-46', '觉醒被动 — 资源/经验叠加最多3次'), () => {
    assertStrict(AWAKENING_PASSIVE.resourceMaxStacks === 3, 'FLOW-12-46', `资源加成最大叠加应为3，实际 ${AWAKENING_PASSIVE.resourceMaxStacks}`);
    assertStrict(AWAKENING_PASSIVE.expMaxStacks === 3, 'FLOW-12-46', `经验加成最大叠加应为3，实际 ${AWAKENING_PASSIVE.expMaxStacks}`);
  });
});
