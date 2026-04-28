/**
 * FLOW-12 觉醒系统集成测试 — 引擎层 AwakeningSystem API 验证
 *
 * 使用真实 ThreeKingdomsEngine（通过 createSim()），不 mock engine。
 * 通过 engine.getAwakeningSystem() 获取觉醒系统实例。
 * 通过 engine.getHeroSystem() / engine.getHeroStarSystem() 准备前置条件。
 *
 * 注意：breakthroughStone / awakeningStone 不是标准 ResourceType，
 * ResourceSystem 无法存储。因此通过 AwakeningDeps 注入自定义资源管理器。
 *
 * 覆盖范围：
 * - 觉醒面板数据查询（系统初始化、状态查询、技能预览）
 * - 觉醒条件检查（等级/星级/突破/品质/拥有状态）
 * - 觉醒执行（成功觉醒、资源消耗、属性提升、技能解锁）
 * - 觉醒效果（属性计算、等级上限、被动加成）
 * - 觉醒材料（资源消耗、经验/铜钱表）
 * - 苏格拉底边界（已觉醒、未拥有、COMMON品质、序列化）
 *
 * @module tests/acc/FLOW-12
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { AwakeningSystem } from '@/games/three-kingdoms/engine/hero/AwakeningSystem';
import type { HeroSystem } from '@/games/three-kingdoms/engine/hero/HeroSystem';
import type { HeroStarSystem } from '@/games/three-kingdoms/engine/hero/HeroStarSystem';
import {
  AWAKENING_MAX_LEVEL,
  AWAKENING_REQUIREMENTS,
  AWAKENING_COST,
  AWAKENING_STAT_MULTIPLIER,
  AWAKENING_PASSIVE,
  AWAKENING_SAVE_VERSION,
} from '@/games/three-kingdoms/engine/hero/awakening-config';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/** 创建测试用 sim 并添加大量资源 */
function createAwakeningSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({
    gold: 10_000_000,
    grain: 10_000_000,
    troops: 1_000_000,
    skillBook: 1_000,
  });
  return sim;
}

/**
 * 注入觉醒资源依赖。
 * breakthroughStone / awakeningStone 不是标准 ResourceType，
 * ResourceSystem 无法存储。因此需要通过 AwakeningDeps 注入。
 */
function injectAwakeningResources(awakening: AwakeningSystem): void {
  const specialResources: Record<string, number> = {
    gold: 10_000_000,
    breakthroughStone: 10_000,
    skillBook: 1_000,
    awakeningStone: 1_000,
  };

  awakening.setDeps({
    canAffordResource: (type: string, amount: number) => {
      return (specialResources[type] ?? 0) >= amount;
    },
    spendResource: (type: string, amount: number) => {
      const current = specialResources[type] ?? 0;
      if (current >= amount) {
        specialResources[type] = current - amount;
        return true;
      }
      return false;
    },
    getResourceAmount: (type: string) => specialResources[type] ?? 0,
  });
}

/** 将武将准备到可觉醒状态：Lv100 + 6星 + 4阶突破 + 200碎片 */
function prepareHeroForAwakening(sim: GameEventSimulator, heroId: string): void {
  const engine = sim.engine;
  const heroSystem = engine.getHeroSystem();
  const starSystem = engine.getHeroStarSystem();
  heroSystem.addGeneral(heroId);
  heroSystem.setLevelAndExp(heroId, 100, 0);
  (starSystem as any).state.stars[heroId] = 6;
  (starSystem as any).state.breakthroughStages[heroId] = 4;
  heroSystem.addFragment(heroId, 200);
}

/** 部分准备武将（可指定各项参数） */
function prepareHeroPartial(
  sim: GameEventSimulator,
  heroId: string,
  opts: { level?: number; star?: number; breakthrough?: number; fragments?: number },
): void {
  const engine = sim.engine;
  const heroSystem = engine.getHeroSystem();
  const starSystem = engine.getHeroStarSystem();
  heroSystem.addGeneral(heroId);
  if (opts.level) heroSystem.setLevelAndExp(heroId, opts.level, 0);
  if (opts.star) (starSystem as any).state.stars[heroId] = opts.star;
  if (opts.breakthrough) (starSystem as any).state.breakthroughStages[heroId] = opts.breakthrough;
  if (opts.fragments) heroSystem.addFragment(heroId, opts.fragments);
}

// ═══════════════════════════════════════════════════════════════
// FLOW-12 觉醒系统集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-12 觉醒系统集成测试', () => {
  let sim: GameEventSimulator;
  let engine: ThreeKingdomsEngine;
  let awakening: AwakeningSystem;
  let heroSystem: HeroSystem;
  let starSystem: HeroStarSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createAwakeningSim();
    engine = sim.engine;
    awakening = engine.getAwakeningSystem();
    heroSystem = engine.getHeroSystem();
    starSystem = engine.getHeroStarSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. 觉醒面板数据查询（FLOW-12-01 ~ FLOW-12-05） ──

  it(accTest('FLOW-12-01', '觉醒系统可通过引擎 getter 获取'), () => {
    assertStrict(!!awakening, 'FLOW-12-01', 'AwakeningSystem 应存在');
    assertStrict(awakening.name === 'awakening', 'FLOW-12-01', `子系统名应为 awakening，实际 ${awakening.name}`);
  });

  it(accTest('FLOW-12-02', '未觉醒武将状态查询返回默认值'), () => {
    const state = awakening.getAwakeningState('guanyu');
    assertStrict(state.isAwakened === false, 'FLOW-12-02', '未觉醒武将 isAwakened 应为 false');
    assertStrict(state.awakeningLevel === 0, 'FLOW-12-02', `awakeningLevel 应为 0，实际 ${state.awakeningLevel}`);
  });

  it(accTest('FLOW-12-03', 'isAwakened 对未觉醒武将返回 false'), () => {
    assertStrict(awakening.isAwakened('guanyu') === false, 'FLOW-12-03', '未觉醒武将 isAwakened 应为 false');
  });

  it(accTest('FLOW-12-04', '觉醒技能预览 — 关羽有觉醒技能'), () => {
    const skill = awakening.getAwakeningSkillPreview('guanyu');
    assertStrict(!!skill, 'FLOW-12-04', '关羽应有觉醒技能');
    assertStrict(skill!.name === '武圣·青龙偃月', 'FLOW-12-04', `技能名应为"武圣·青龙偃月"，实际 "${skill!.name}"`);
    assertStrict(skill!.damageMultiplier === 3.0, 'FLOW-12-04', `伤害倍率应为 3.0，实际 ${skill!.damageMultiplier}`);
    assertStrict(skill!.cooldown === 5, 'FLOW-12-04', `冷却应为 5，实际 ${skill!.cooldown}`);
  });

  it(accTest('FLOW-12-05', '觉醒技能预览 — 诸葛亮有觉醒技能'), () => {
    const skill = awakening.getAwakeningSkillPreview('zhugeliang');
    assertStrict(!!skill, 'FLOW-12-05', '诸葛亮应有觉醒技能');
    assertStrict(skill!.name === '卧龙·八阵图', 'FLOW-12-05', `技能名应为"卧龙·八阵图"，实际 "${skill!.name}"`);
    assertStrict(skill!.cooldown === 7, 'FLOW-12-05', `冷却应为 7，实际 ${skill!.cooldown}`);
  });

  // ── 2. 觉醒条件检查（FLOW-12-06 ~ FLOW-12-11） ──

  it(accTest('FLOW-12-06', '全部条件满足时觉醒条件检查通过'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    const result = awakening.checkAwakeningEligible('guanyu');
    assertStrict(result.eligible, 'FLOW-12-06', `应可觉醒: ${result.failures.join(', ')}`);
    assertStrict(result.failures.length === 0, 'FLOW-12-06', `失败列表应为空`);
    assertStrict(result.details.owned, 'FLOW-12-06', '应已拥有');
    assertStrict(result.details.level.met, 'FLOW-12-06', '等级应满足');
    assertStrict(result.details.stars.met, 'FLOW-12-06', '星级应满足');
    assertStrict(result.details.breakthrough.met, 'FLOW-12-06', '突破应满足');
    assertStrict(result.details.quality.met, 'FLOW-12-06', '品质应满足');
  });

  it(accTest('FLOW-12-07', '等级不足时条件检查失败'), () => {
    prepareHeroPartial(sim, 'guanyu', { level: 50, star: 6, breakthrough: 4, fragments: 200 });
    const result = awakening.checkAwakeningEligible('guanyu');
    assertStrict(!result.eligible, 'FLOW-12-07', '等级不足时不应可觉醒');
    assertStrict(!result.details.level.met, 'FLOW-12-07', '等级条件应不满足');
    assertStrict(result.details.level.current === 50, 'FLOW-12-07', `当前等级应为50`);
    assertStrict(result.details.level.required === AWAKENING_REQUIREMENTS.minLevel, 'FLOW-12-07', `要求等级应为 ${AWAKENING_REQUIREMENTS.minLevel}`);
  });

  it(accTest('FLOW-12-08', '星级不足时条件检查失败'), () => {
    prepareHeroPartial(sim, 'guanyu', { level: 100, star: 3, breakthrough: 4, fragments: 200 });
    const result = awakening.checkAwakeningEligible('guanyu');
    assertStrict(!result.eligible, 'FLOW-12-08', '星级不足时不应可觉醒');
    assertStrict(!result.details.stars.met, 'FLOW-12-08', '星级条件应不满足');
  });

  it(accTest('FLOW-12-09', '突破不足时条件检查失败'), () => {
    prepareHeroPartial(sim, 'guanyu', { level: 100, star: 6, breakthrough: 2, fragments: 200 });
    const result = awakening.checkAwakeningEligible('guanyu');
    assertStrict(!result.eligible, 'FLOW-12-09', '突破不足时不应可觉醒');
    assertStrict(!result.details.breakthrough.met, 'FLOW-12-09', '突破条件应不满足');
  });

  it(accTest('FLOW-12-10', '未拥有武将条件检查失败'), () => {
    const result = awakening.checkAwakeningEligible('guanyu');
    assertStrict(!result.eligible, 'FLOW-12-10', '未拥有武将不应可觉醒');
    assertStrict(!result.details.owned, 'FLOW-12-10', 'owned 应为 false');
    assertStrict(result.failures.includes('武将未拥有'), 'FLOW-12-10', '失败原因应包含"武将未拥有"');
  });

  it(accTest('FLOW-12-11', '条件检查详细数据 — 各字段值正确'), () => {
    prepareHeroPartial(sim, 'guanyu', { level: 100, star: 6, breakthrough: 4 });
    const result = awakening.checkAwakeningEligible('guanyu');
    assertStrict(result.details.level.current === 100, 'FLOW-12-11', '等级应为100');
    assertStrict(result.details.stars.current === 6, 'FLOW-12-11', '星级应为6');
    assertStrict(result.details.breakthrough.current === 4, 'FLOW-12-11', '突破应为4');
    assertStrict(result.details.quality.current === 'LEGENDARY', 'FLOW-12-11', `品质应为 LEGENDARY，实际 ${result.details.quality.current}`);
  });

  // ── 3. 觉醒执行（FLOW-12-12 ~ FLOW-12-17） ──

  it(accTest('FLOW-12-12', '觉醒执行成功 — 关羽'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    const result = awakening.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-12', `觉醒应成功: ${result.reason ?? ''}`);
    assertStrict(result.generalId === 'guanyu', 'FLOW-12-12', 'generalId 应匹配');
    assertStrict(!!result.costSpent, 'FLOW-12-12', '应有消耗记录');
    assertStrict(!!result.awakenedStats, 'FLOW-12-12', '应有觉醒后属性');
    assertStrict(!!result.skillUnlocked, 'FLOW-12-12', '应有解锁技能');
  });

  it(accTest('FLOW-12-13', '觉醒后武将状态变为已觉醒'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    awakening.awaken('guanyu');
    assertStrict(awakening.isAwakened('guanyu'), 'FLOW-12-13', '觉醒后 isAwakened 应为 true');
    const state = awakening.getAwakeningState('guanyu');
    assertStrict(state.isAwakened, 'FLOW-12-13', 'state.isAwakened 应为 true');
    assertStrict(state.awakeningLevel === 1, 'FLOW-12-13', `awakeningLevel 应为 1，实际 ${state.awakeningLevel}`);
  });

  it(accTest('FLOW-12-14', '觉醒消耗资源正确'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    const result = awakening.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-14', '觉醒应成功');
    assertStrict(result.costSpent!.copper === AWAKENING_COST.copper, 'FLOW-12-14', `铜钱消耗应为 ${AWAKENING_COST.copper}`);
    assertStrict(result.costSpent!.breakthroughStones === AWAKENING_COST.breakthroughStones, 'FLOW-12-14', `突破石消耗应为 ${AWAKENING_COST.breakthroughStones}`);
    assertStrict(result.costSpent!.skillBooks === AWAKENING_COST.skillBooks, 'FLOW-12-14', `技能书消耗应为 ${AWAKENING_COST.skillBooks}`);
    assertStrict(result.costSpent!.awakeningStones === AWAKENING_COST.awakeningStones, 'FLOW-12-14', `觉醒石消耗应为 ${AWAKENING_COST.awakeningStones}`);
  });

  it(accTest('FLOW-12-15', '觉醒解锁技能正确 — 关羽'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    const result = awakening.awaken('guanyu');
    assertStrict(result.success, 'FLOW-12-15', '觉醒应成功');
    assertStrict(result.skillUnlocked!.id === 'guanyu_awaken', 'FLOW-12-15', '技能ID应为 guanyu_awaken');
    assertStrict(result.skillUnlocked!.name === '武圣·青龙偃月', 'FLOW-12-15', '技能名应为"武圣·青龙偃月"');
  });

  it(accTest('FLOW-12-16', '觉醒解锁技能 — 刘备（EPIC品质）'), () => {
    prepareHeroForAwakening(sim, 'liubei');
    injectAwakeningResources(awakening);
    const result = awakening.awaken('liubei');
    assertStrict(result.success, 'FLOW-12-16', `刘备觉醒应成功: ${result.reason ?? ''}`);
    assertStrict(result.skillUnlocked!.id === 'liubei_awaken', 'FLOW-12-16', '技能ID应为 liubei_awaken');
    assertStrict(result.skillUnlocked!.name === '仁德·桃园结义', 'FLOW-12-16', '技能名应为"仁德·桃园结义"');
  });

  it(accTest('FLOW-12-17', '觉醒解锁技能 — 典韦（RARE品质）'), () => {
    prepareHeroForAwakening(sim, 'dianwei');
    injectAwakeningResources(awakening);
    const result = awakening.awaken('dianwei');
    assertStrict(result.success, 'FLOW-12-17', `典韦觉醒应成功: ${result.reason ?? ''}`);
    assertStrict(result.skillUnlocked!.id === 'dianwei_awaken', 'FLOW-12-17', '技能ID应为 dianwei_awaken');
  });

  // ── 4. 觉醒效果（FLOW-12-18 ~ FLOW-12-23） ──

  it(accTest('FLOW-12-18', '觉醒后属性提升 +50%'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    const general = heroSystem.getGeneral('guanyu')!;
    const baseAtk = general.baseStats.attack;
    const baseDef = general.baseStats.defense;
    awakening.awaken('guanyu');
    const awakenedStats = awakening.calculateAwakenedStats('guanyu');
    const expectedAtk = Math.floor(baseAtk * AWAKENING_STAT_MULTIPLIER);
    const expectedDef = Math.floor(baseDef * AWAKENING_STAT_MULTIPLIER);
    assertStrict(awakenedStats.attack === expectedAtk, 'FLOW-12-18', `攻击应为 ${expectedAtk}，实际 ${awakenedStats.attack}`);
    assertStrict(awakenedStats.defense === expectedDef, 'FLOW-12-18', `防御应为 ${expectedDef}，实际 ${awakenedStats.defense}`);
  });

  it(accTest('FLOW-12-19', '觉醒后等级上限变为 120'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    awakening.awaken('guanyu');
    const cap = awakening.getAwakenedLevelCap('guanyu');
    assertStrict(cap === AWAKENING_MAX_LEVEL, 'FLOW-12-19', `觉醒后等级上限应为 ${AWAKENING_MAX_LEVEL}，实际 ${cap}`);
  });

  it(accTest('FLOW-12-20', '觉醒属性差值计算正确'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    awakening.awaken('guanyu');
    const diff = awakening.getAwakeningStatDiff('guanyu');
    const general = heroSystem.getGeneral('guanyu')!;
    const expectedAtkDiff = Math.floor(general.baseStats.attack * AWAKENING_STAT_MULTIPLIER) - general.baseStats.attack;
    assertStrict(diff.attack === expectedAtkDiff, 'FLOW-12-20', `攻击差值应为 ${expectedAtkDiff}，实际 ${diff.attack}`);
  });

  it(accTest('FLOW-12-21', '觉醒被动效果 — 单个觉醒武将'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    awakening.awaken('guanyu');
    const summary = awakening.getPassiveSummary();
    assertStrict(summary.awakenedCount === 1, 'FLOW-12-21', `觉醒数量应为1，实际 ${summary.awakenedCount}`);
    assertStrict(summary.globalStatBonus === AWAKENING_PASSIVE.globalStatBonus, 'FLOW-12-21', `全局属性加成应为 ${AWAKENING_PASSIVE.globalStatBonus}`);
    assertStrict(summary.resourceBonus === AWAKENING_PASSIVE.resourceBonus, 'FLOW-12-21', `资源加成应为 ${AWAKENING_PASSIVE.resourceBonus}`);
    assertStrict(summary.expBonus === AWAKENING_PASSIVE.expBonus, 'FLOW-12-21', `经验加成应为 ${AWAKENING_PASSIVE.expBonus}`);
  });

  it(accTest('FLOW-12-22', '觉醒被动效果 — 多个觉醒武将叠加'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    prepareHeroForAwakening(sim, 'zhugeliang');
    injectAwakeningResources(awakening);
    awakening.awaken('guanyu');
    awakening.awaken('zhugeliang');
    const summary = awakening.getPassiveSummary();
    assertStrict(summary.awakenedCount === 2, 'FLOW-12-22', `觉醒数量应为2，实际 ${summary.awakenedCount}`);
    assertStrict(summary.globalStatBonus === AWAKENING_PASSIVE.globalStatBonus * 2, 'FLOW-12-22', `全局属性加成应为 ${AWAKENING_PASSIVE.globalStatBonus * 2}`);
    // 关羽和诸葛亮都是蜀国
    const faction = heroSystem.getGeneral('guanyu')!.faction;
    assertStrict(summary.factionStacks[faction] === 2, 'FLOW-12-22', `${faction}阵营叠加应为2`);
  });

  it(accTest('FLOW-12-23', '觉醒被动效果 — 无觉醒武将时全为0'), () => {
    const summary = awakening.getPassiveSummary();
    assertStrict(summary.awakenedCount === 0, 'FLOW-12-23', '觉醒数量应为0');
    assertStrict(summary.globalStatBonus === 0, 'FLOW-12-23', '全局属性加成应为0');
    assertStrict(summary.resourceBonus === 0, 'FLOW-12-23', '资源加成应为0');
    assertStrict(summary.expBonus === 0, 'FLOW-12-23', '经验加成应为0');
  });

  // ── 5. 觉醒材料与经验表（FLOW-12-24 ~ FLOW-12-28） ──

  it(accTest('FLOW-12-24', '觉醒经验表 — 101~105级经验递增'), () => {
    const exp101 = awakening.getAwakeningExpRequired(101);
    const exp105 = awakening.getAwakeningExpRequired(105);
    assertStrict(exp101 > 0, 'FLOW-12-24', `101级经验应 > 0，实际 ${exp101}`);
    assertStrict(exp105 > exp101, 'FLOW-12-24', '105级经验应 > 101级');
    assertStrict(exp101 === 101 * 12000, 'FLOW-12-24', `101级经验应为 ${101 * 12000}，实际 ${exp101}`);
  });

  it(accTest('FLOW-12-25', '觉醒经验表 — 106~110级经验更高'), () => {
    const exp106 = awakening.getAwakeningExpRequired(106);
    const exp110 = awakening.getAwakeningExpRequired(110);
    assertStrict(exp106 > 0, 'FLOW-12-25', '106级经验应 > 0');
    assertStrict(exp110 > exp106, 'FLOW-12-25', '110级经验应 > 106级');
    assertStrict(exp106 === 106 * 15000, 'FLOW-12-25', `106级经验应为 ${106 * 15000}，实际 ${exp106}`);
  });

  it(accTest('FLOW-12-26', '觉醒铜钱表 — 101~120级铜钱递增'), () => {
    const gold101 = awakening.getAwakeningGoldRequired(101);
    const gold120 = awakening.getAwakeningGoldRequired(120);
    assertStrict(gold101 > 0, 'FLOW-12-26', '101级铜钱应 > 0');
    assertStrict(gold120 > gold101, 'FLOW-12-26', '120级铜钱应 > 101级');
  });

  it(accTest('FLOW-12-27', '觉醒经验表 — 超出范围返回0'), () => {
    const exp100 = awakening.getAwakeningExpRequired(100);
    const exp121 = awakening.getAwakeningExpRequired(121);
    assertStrict(exp100 === 0, 'FLOW-12-27', `100级经验应为0，实际 ${exp100}`);
    assertStrict(exp121 === 0, 'FLOW-12-27', `121级经验应为0，实际 ${exp121}`);
  });

  it(accTest('FLOW-12-28', '觉醒消耗配置 — 各项资源数量正确'), () => {
    assertStrict(AWAKENING_COST.copper === 500000, 'FLOW-12-28', `铜钱应为 500000`);
    assertStrict(AWAKENING_COST.breakthroughStones === 100, 'FLOW-12-28', `突破石应为 100`);
    assertStrict(AWAKENING_COST.skillBooks === 50, 'FLOW-12-28', `技能书应为 50`);
    assertStrict(AWAKENING_COST.awakeningStones === 30, 'FLOW-12-28', `觉醒石应为 30`);
    assertStrict(AWAKENING_COST.fragments === 200, 'FLOW-12-28', `碎片应为 200`);
  });

  // ── 6. 苏格拉底边界（FLOW-12-29 ~ FLOW-12-35） ──

  it(accTest('FLOW-12-29', '边界 — 重复觉醒返回失败'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    const result1 = awakening.awaken('guanyu');
    assertStrict(result1.success, 'FLOW-12-29', '首次觉醒应成功');
    const result2 = awakening.awaken('guanyu');
    assertStrict(!result2.success, 'FLOW-12-29', '重复觉醒应失败');
    assertStrict(result2.reason!.includes('已觉醒'), 'FLOW-12-29', `原因应包含"已觉醒"，实际: ${result2.reason}`);
  });

  it(accTest('FLOW-12-30', '边界 — 条件不满足时觉醒失败'), () => {
    prepareHeroPartial(sim, 'guanyu', { level: 50, star: 3, breakthrough: 1 });
    const result = awakening.awaken('guanyu');
    assertStrict(!result.success, 'FLOW-12-30', '条件不满足时应失败');
    assertStrict(result.reason!.includes('条件不满足'), 'FLOW-12-30', `原因应包含"条件不满足"，实际: ${result.reason}`);
  });

  it(accTest('FLOW-12-31', '边界 — 未拥有武将觉醒失败'), () => {
    const result = awakening.awaken('nonexistent_hero');
    assertStrict(!result.success, 'FLOW-12-31', '未拥有武将觉醒应失败');
  });

  it(accTest('FLOW-12-32', '边界 — COMMON品质武将不可觉醒'), () => {
    prepareHeroPartial(sim, 'minbingduizhang', { level: 100, star: 6, breakthrough: 4 });
    const result = awakening.checkAwakeningEligible('minbingduizhang');
    assertStrict(!result.eligible, 'FLOW-12-32', 'COMMON品质不应可觉醒');
    assertStrict(!result.details.quality.met, 'FLOW-12-32', '品质条件应不满足');
  });

  it(accTest('FLOW-12-33', '边界 — 觉醒被动效果叠加有上限'), () => {
    const heroIds = ['guanyu', 'zhugeliang', 'zhaoyun', 'caocao', 'lvbu', 'liubei'];
    injectAwakeningResources(awakening);
    for (const id of heroIds) {
      prepareHeroForAwakening(sim, id);
      awakening.awaken(id);
    }
    const summary = awakening.getPassiveSummary();
    const maxGlobalBonus = AWAKENING_PASSIVE.globalMaxStacks * AWAKENING_PASSIVE.globalStatBonus;
    assertStrict(summary.globalStatBonus <= maxGlobalBonus, 'FLOW-12-33', `全局属性加成不应超过 ${maxGlobalBonus}，实际 ${summary.globalStatBonus}`);
    assertStrict(summary.awakenedCount === 6, 'FLOW-12-33', `觉醒数量应为6，实际 ${summary.awakenedCount}`);
  });

  it(accTest('FLOW-12-34', '边界 — 序列化与反序列化保持觉醒状态'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    injectAwakeningResources(awakening);
    awakening.awaken('guanyu');
    const data = awakening.serialize();
    assertStrict(data.version === AWAKENING_SAVE_VERSION, 'FLOW-12-34', `版本号应为 ${AWAKENING_SAVE_VERSION}`);
    assertStrict(!!data.state.heroes['guanyu'], 'FLOW-12-34', '应包含关羽觉醒数据');
    assertStrict(data.state.heroes['guanyu'].isAwakened, 'FLOW-12-34', '关羽觉醒状态应为 true');
    awakening.reset();
    assertStrict(!awakening.isAwakened('guanyu'), 'FLOW-12-34', '重置后应未觉醒');
    awakening.deserialize(data);
    assertStrict(awakening.isAwakened('guanyu'), 'FLOW-12-34', '恢复后应已觉醒');
  });

  it(accTest('FLOW-12-35', '边界 — 未觉醒武将属性不变'), () => {
    prepareHeroForAwakening(sim, 'guanyu');
    const stats = awakening.calculateAwakenedStats('guanyu');
    const general = heroSystem.getGeneral('guanyu')!;
    assertStrict(stats.attack === general.baseStats.attack, 'FLOW-12-35', `未觉醒攻击应等于基础攻击 ${general.baseStats.attack}，实际 ${stats.attack}`);
    assertStrict(stats.defense === general.baseStats.defense, 'FLOW-12-35', '未觉醒防御应等于基础防御');
  });
});
