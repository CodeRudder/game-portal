/**
 * 真实引擎端到端测试
 *
 * 使用真实的 ThreeKingdomsEngine 实例（不使用 mock），
 * 验证战力计算、羁绊激活、编队操作、引导动作的正确性。
 *
 * 覆盖场景：
 * - 场景1：战力计算一致性（8个测试）
 * - 场景2：羁绊激活准确性（8个测试）
 * - 场景3：编队操作约束（8个测试）
 * - 场景4：引导动作执行（6个测试）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import {
  QUALITY_MULTIPLIERS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
  GENERAL_DEF_MAP,
} from '@/games/three-kingdoms/engine/hero/hero-config';
import { getStarMultiplier } from '@/games/three-kingdoms/engine/hero/star-up-config';
import { FACTION_BONDS, PARTNER_BONDS } from '@/games/three-kingdoms/engine/hero/bond-config';

// ── 辅助：手动计算战力的参考实现 ──

/**
 * 参考战力公式：
 * 战力 = floor(statsPower × levelCoeff × qualityCoeff × starCoeff × equipmentCoeff × bondCoeff)
 * - statsPower = ATK×2.0 + DEF×1.5 + INT×2.0 + SPD×1.0
 * - levelCoeff = 1 + level × 0.05
 * - qualityCoeff = QUALITY_MULTIPLIERS[quality]
 * - starCoeff = getStarMultiplier(star)
 * - equipmentCoeff = 1 + equipPower / 1000
 * - bondCoeff = 默认 1.0
 */
function computeExpectedPower(
  attack: number, defense: number, intelligence: number, speed: number,
  level: number, quality: string, star: number,
  equipPower = 0, bondCoeff = 1.0,
): number {
  const statsPower = attack * POWER_WEIGHTS.attack
    + defense * POWER_WEIGHTS.defense
    + intelligence * POWER_WEIGHTS.intelligence
    + speed * POWER_WEIGHTS.speed;
  const levelCoeff = 1 + level * LEVEL_COEFFICIENT_PER_LEVEL;
  const qualityCoeff = QUALITY_MULTIPLIERS[quality as keyof typeof QUALITY_MULTIPLIERS];
  const starCoeff = getStarMultiplier(star);
  const equipmentCoeff = 1 + equipPower / 1000;
  return Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff);
}

// ── 辅助：创建并初始化真实引擎 ──

function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  engine.init();
  return engine;
}

// ── 辅助：添加武将并加入编队 ──

function addHeroAndAssign(engine: ThreeKingdomsEngine, heroId: string, formationId = '1'): void {
  engine.getHeroSystem().addGeneral(heroId);
  engine.addToFormation(formationId, heroId);
}

// ═══════════════════════════════════════════════════════════════════
// 场景1：战力计算一致性
// ═══════════════════════════════════════════════════════════════════

describe('场景1：战力计算一致性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('S1-1: 创建真实引擎实例不抛异常', () => {
    expect(engine).toBeDefined();
    expect(engine.getHeroSystem()).toBeDefined();
    expect(engine.getFormationSystem()).toBeDefined();
  });

  it('S1-2: 空编队战力为0', () => {
    engine.createFormation('1');
    const formation = engine.getActiveFormation();
    expect(formation).not.toBeNull();

    const heroSys = engine.getHeroSystem();
    const totalPower = heroSys.calculateTotalPower();
    expect(totalPower).toBe(0);
  });

  it('S1-3: 单武将战力与手动公式一致', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');
    const g = heroSys.getGeneral('guanyu');
    expect(g).toBeDefined();

    const actual = heroSys.calculatePower(g!);
    const expected = computeExpectedPower(
      g!.baseStats.attack, g!.baseStats.defense,
      g!.baseStats.intelligence, g!.baseStats.speed,
      g!.level, g!.quality, 1,
    );
    expect(actual).toBe(expected);
    expect(actual).toBeGreaterThan(0);
  });

  it('S1-4: 验证6乘区公式（等级×品质×星级×装备×羁绊）', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');
    const g = heroSys.getGeneral('guanyu')!;

    // 各乘区独立验证
    const statsPower = g.baseStats.attack * POWER_WEIGHTS.attack
      + g.baseStats.defense * POWER_WEIGHTS.defense
      + g.baseStats.intelligence * POWER_WEIGHTS.intelligence
      + g.baseStats.speed * POWER_WEIGHTS.speed;

    const levelCoeff = 1 + g.level * LEVEL_COEFFICIENT_PER_LEVEL;
    const qualityCoeff = QUALITY_MULTIPLIERS[g.quality];
    const starCoeff = getStarMultiplier(1);
    const equipCoeff = 1;
    const bondCoeff = 1.0;

    const expected = Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipCoeff * bondCoeff);
    const actual = heroSys.calculatePower(g);
    expect(actual).toBe(expected);
    // 验证各乘区值合理
    expect(levelCoeff).toBeGreaterThan(0);
    expect(qualityCoeff).toBeGreaterThan(0);
    expect(starCoeff).toBeGreaterThan(0);
  });

  it('S1-5: 升级后战力变化正确', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');
    const g1 = heroSys.getGeneral('guanyu')!;
    const powerBefore = heroSys.calculatePower(g1);

    // 升级到10级
    engine.enhanceHero('guanyu', 9);

    const g2 = heroSys.getGeneral('guanyu')!;
    const powerAfter = heroSys.calculatePower(g2);

    expect(powerAfter).toBeGreaterThan(powerBefore);

    // 验证升级后战力与公式一致
    const expected = computeExpectedPower(
      g2.baseStats.attack, g2.baseStats.defense,
      g2.baseStats.intelligence, g2.baseStats.speed,
      g2.level, g2.quality, 1,
    );
    expect(powerAfter).toBe(expected);
  });

  it('S1-6: 升星后战力变化正确', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');

    const power1Star = heroSys.calculatePower(heroSys.getGeneral('guanyu')!, 1);
    const power3Star = heroSys.calculatePower(heroSys.getGeneral('guanyu')!, 3);

    expect(power3Star).toBeGreaterThan(power1Star);

    // 验证星级系数
    const star1Coeff = getStarMultiplier(1);
    const star3Coeff = getStarMultiplier(3);
    const ratio = power3Star / power1Star;
    expect(ratio).toBeCloseTo(star3Coeff / star1Coeff, 1);
  });

  it('S1-7: 单武将战力正确（不同品质验证）', () => {
    const heroSys = engine.getHeroSystem();

    // 传说品质 - 关羽
    heroSys.addGeneral('guanyu');
    const guanyu = heroSys.getGeneral('guanyu')!;
    const powerLegendary = heroSys.calculatePower(guanyu);
    const expectedLegendary = computeExpectedPower(
      guanyu.baseStats.attack, guanyu.baseStats.defense,
      guanyu.baseStats.intelligence, guanyu.baseStats.speed,
      guanyu.level, guanyu.quality, 1,
    );
    expect(powerLegendary).toBe(expectedLegendary);

    // 稀有品质 - 典韦
    heroSys.addGeneral('dianwei');
    const dianwei = heroSys.getGeneral('dianwei')!;
    const powerRare = heroSys.calculatePower(dianwei);
    const expectedRare = computeExpectedPower(
      dianwei.baseStats.attack, dianwei.baseStats.defense,
      dianwei.baseStats.intelligence, dianwei.baseStats.speed,
      dianwei.level, dianwei.quality, 1,
    );
    expect(powerRare).toBe(expectedRare);
  });

  it('S1-8: 满编武将战力正确', () => {
    const heroSys = engine.getHeroSystem();
    const formationSys = engine.getFormationSystem();

    engine.createFormation('1');

    // 添加6个武将（MAX_SLOTS_PER_FORMATION = 6）
    const heroIds = ['guanyu', 'liubei', 'zhangfei', 'zhaoyun', 'caocao', 'lvbu'];
    heroIds.forEach((id) => {
      heroSys.addGeneral(id);
      engine.addToFormation('1', id);
    });

    const formation = formationSys.getFormation('1')!;
    expect(formation.slots.filter((s) => s !== '').length).toBe(6);

    // 验证编队总战力 = 各武将战力之和
    const totalPower = heroSys.calculateTotalPower();
    let expectedSum = 0;
    for (const id of heroIds) {
      const g = heroSys.getGeneral(id)!;
      expectedSum += heroSys.calculatePower(g);
    }
    expect(totalPower).toBe(expectedSum);
    expect(totalPower).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 场景2：羁绊激活准确性
// ═══════════════════════════════════════════════════════════════════

describe('场景2：羁绊激活准确性', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('S2-1: 2人同阵营触发初级羁绊', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');  // 蜀
    heroSys.addGeneral('liubei');  // 蜀

    const bondSystem = engine.getBondSystem();
    // 获取羁绊乘数
    const multiplier = bondSystem.getBondMultiplier(['guanyu', 'liubei']);

    // 蜀国2人初级羁绊：attack +0.05
    const shuBond = FACTION_BONDS.find((b) => b.faction === 'shu');
    expect(shuBond).toBeDefined();
    expect(shuBond!.tiers[0].requiredCount).toBe(2);

    // 羁绊乘数应 > 1.0（有加成）
    expect(multiplier).toBeGreaterThan(1.0);
  });

  it('S2-2: 3人同阵营触发中级羁绊', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');    // 蜀
    heroSys.addGeneral('liubei');    // 蜀
    heroSys.addGeneral('zhangfei');  // 蜀

    const bondSystem = engine.getBondSystem();
    const multiplier = bondSystem.getBondMultiplier(['guanyu', 'liubei', 'zhangfei']);

    // 蜀国3人中级羁绊：attack +0.10, defense +0.05
    const shuBond = FACTION_BONDS.find((b) => b.faction === 'shu');
    expect(shuBond!.tiers[1].requiredCount).toBe(3);

    // 3人羁绊乘数应大于2人
    const multiplier2 = bondSystem.getBondMultiplier(['guanyu', 'liubei']);
    expect(multiplier).toBeGreaterThan(multiplier2);
  });

  it('S2-3: 桃园结义搭档羁绊激活', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('liubei');
    heroSys.addGeneral('guanyu');
    heroSys.addGeneral('zhangfei');

    const bondSystem = engine.getBondSystem();
    const multiplier = bondSystem.getBondMultiplier(['liubei', 'guanyu', 'zhangfei']);

    // 桃园结义需要3人全部在场
    const taoyuan = PARTNER_BONDS.find((b) => b.id === 'partner_taoyuan');
    expect(taoyuan).toBeDefined();
    expect(taoyuan!.generalIds).toContain('liubei');
    expect(taoyuan!.generalIds).toContain('guanyu');
    expect(taoyuan!.generalIds).toContain('zhangfei');
    expect(taoyuan!.minRequired).toBe(3);

    // 羁绊乘数应 > 1.0（包含阵营羁绊+搭档羁绊）
    expect(multiplier).toBeGreaterThan(1.0);
  });

  it('S2-4: 部分搭档不激活', () => {
    const heroSys = engine.getHeroSystem();
    // 只有关羽和张飞，缺少刘备 → 桃园结义不激活
    heroSys.addGeneral('guanyu');
    heroSys.addGeneral('zhangfei');

    const bondSystem = engine.getBondSystem();
    const multiplier = bondSystem.getBondMultiplier(['guanyu', 'zhangfei']);

    // 仍有蜀国2人阵营羁绊，但无桃园结义搭档羁绊
    const fullMultiplier = bondSystem.getBondMultiplier(['guanyu', 'liubei', 'zhangfei']);
    // 3人羁绊乘数 > 2人（因为多了搭档羁绊）
    expect(fullMultiplier).toBeGreaterThan(multiplier);
  });

  it('S2-5: 混合阵营无阵营羁绊', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');  // 蜀
    heroSys.addGeneral('caocao');  // 魏

    const bondSystem = engine.getBondSystem();
    const multiplier = bondSystem.getBondMultiplier(['guanyu', 'caocao']);

    // 不同阵营无阵营羁绊，无搭档羁绊 → 乘数应为 1.0
    expect(multiplier).toBe(1.0);
  });

  it('S2-6: 羁绊加成正确应用到属性', () => {
    const heroSys = engine.getHeroSystem();
    heroSys.addGeneral('guanyu');

    // 无羁绊时的战力
    const powerNoBond = heroSys.calculatePower(heroSys.getGeneral('guanyu')!, 1, 0, 1.0);

    // 有羁绊时的战力（蜀国2人羁绊乘数）
    const bondSystem = engine.getBondSystem();
    heroSys.addGeneral('liubei');
    const bondMult = bondSystem.getBondMultiplier(['guanyu', 'liubei']);
    expect(bondMult).toBeGreaterThan(1.0);

    const powerWithBond = heroSys.calculatePower(heroSys.getGeneral('guanyu')!, 1, 0, bondMult);
    expect(powerWithBond).toBeGreaterThan(powerNoBond);

    // 验证差值与羁绊乘数一致
    const ratio = powerWithBond / powerNoBond;
    expect(ratio).toBeCloseTo(bondMult, 4);
  });

  it('S2-7: 移除武将后羁绊消失', () => {
    const heroSys = engine.getHeroSystem();
    const bondSystem = engine.getBondSystem();

    heroSys.addGeneral('guanyu');
    heroSys.addGeneral('liubei');
    heroSys.addGeneral('zhangfei');

    // 3人羁绊
    const mult3 = bondSystem.getBondMultiplier(['guanyu', 'liubei', 'zhangfei']);
    expect(mult3).toBeGreaterThan(1.0);

    // 移除张飞后只剩2人
    heroSys.removeGeneral('zhangfei');
    const mult2 = bondSystem.getBondMultiplier(['guanyu', 'liubei']);
    // 2人仍有蜀国初级羁绊
    expect(mult2).toBeGreaterThan(1.0);
    // 但3人羁绊乘数 > 2人
    expect(mult3).toBeGreaterThan(mult2);

    // 再移除刘备
    heroSys.removeGeneral('liubei');
    const mult1 = bondSystem.getBondMultiplier(['guanyu']);
    expect(mult1).toBe(1.0);
  });

  it('S2-8: 空编队无羁绊', () => {
    const bondSystem = engine.getBondSystem();
    const multiplier = bondSystem.getBondMultiplier([]);
    expect(multiplier).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 场景3：编队操作约束
// ═══════════════════════════════════════════════════════════════════

describe('场景3：编队操作约束', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('S3-1: 添加武将到编队', () => {
    engine.createFormation('1');
    engine.getHeroSystem().addGeneral('guanyu');
    const result = engine.addToFormation('1', 'guanyu');

    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('guanyu');
    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(1);
  });

  it('S3-2: 编队已满时不能再添加', () => {
    engine.createFormation('1');
    const heroIds = ['guanyu', 'liubei', 'zhangfei', 'zhaoyun', 'caocao', 'lvbu'];
    heroIds.forEach((id) => {
      engine.getHeroSystem().addGeneral(id);
      engine.addToFormation('1', id);
    });

    // 编队已有6人
    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(6);

    // 尝试添加第7人
    engine.getHeroSystem().addGeneral('dianwei');
    const result = engine.addToFormation('1', 'dianwei');
    expect(result).toBeNull();

    // 编队人数仍为6
    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(6);
  });

  it('S3-3: 移除编队中的武将', () => {
    engine.createFormation('1');
    engine.getHeroSystem().addGeneral('guanyu');
    engine.getHeroSystem().addGeneral('liubei');
    engine.addToFormation('1', 'guanyu');
    engine.addToFormation('1', 'liubei');

    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(2);

    const result = engine.removeFromFormation('1', 'guanyu');
    expect(result).not.toBeNull();
    expect(result!.slots.filter((s) => s !== '')).toEqual(['liubei']);
    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(1);
  });

  it('S3-4: 切换编队位置（通过 setFormation）', () => {
    engine.createFormation('1');
    engine.getHeroSystem().addGeneral('guanyu');
    engine.getHeroSystem().addGeneral('liubei');
    engine.addToFormation('1', 'guanyu');
    engine.addToFormation('1', 'liubei');

    // 切换位置：刘备在前，关羽在后
    const result = engine.setFormation('1', ['liubei', 'guanyu']);
    expect(result).not.toBeNull();
    expect(result!.slots[0]).toBe('liubei');
    expect(result!.slots[1]).toBe('guanyu');
  });

  it('S3-5: 同一武将不能重复添加到同一编队', () => {
    engine.createFormation('1');
    engine.getHeroSystem().addGeneral('guanyu');
    const result1 = engine.addToFormation('1', 'guanyu');
    expect(result1).not.toBeNull();

    const result2 = engine.addToFormation('1', 'guanyu');
    expect(result2).toBeNull();

    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(1);
  });

  it('S3-6: 同一武将不能加入多个编队', () => {
    engine.createFormation('1');
    engine.createFormation('2');
    engine.getHeroSystem().addGeneral('guanyu');

    const result1 = engine.addToFormation('1', 'guanyu');
    expect(result1).not.toBeNull();

    const result2 = engine.addToFormation('2', 'guanyu');
    expect(result2).toBeNull();

    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(1);
    expect(engine.getFormationSystem().getFormationMemberCount('2')).toBe(0);
  });

  it('S3-7: 空编队操作不崩溃', () => {
    engine.createFormation('1');

    // 移除不存在的武将
    const removeResult = engine.removeFromFormation('1', 'nonexistent');
    expect(removeResult).toBeNull();

    // 获取不存在的编队
    const formation = engine.getFormationSystem().getFormation('999');
    expect(formation).toBeNull();

    // 成员数为0
    expect(engine.getFormationSystem().getFormationMemberCount('1')).toBe(0);
  });

  it('S3-8: 删除编队后激活编队切换', () => {
    engine.createFormation('1');
    engine.createFormation('2');

    // 激活编队1
    engine.getFormationSystem().setActiveFormation('1');
    expect(engine.getFormationSystem().getActiveFormationId()).toBe('1');

    // 删除编队1
    const deleted = engine.getFormationSystem().deleteFormation('1');
    expect(deleted).toBe(true);

    // 激活编队应切换到编队2
    expect(engine.getFormationSystem().getActiveFormationId()).toBe('2');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 场景4：引导动作执行
// ═══════════════════════════════════════════════════════════════════

describe('场景4：引导动作执行', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('S4-1: 引导初始状态为 not_started', () => {
    const stateMachine = engine.guide.tutorialStateMachine;
    const state = stateMachine.getState();

    expect(state.currentPhase).toBe('not_started');
    expect(state.completedSteps).toEqual([]);
    expect(state.completedEvents).toEqual([]);
    expect(state.tutorialStartTime).toBeNull();
  });

  it('S4-2: 完成第一步（first_enter 进入 core_guiding）', () => {
    const stateMachine = engine.guide.tutorialStateMachine;

    const result = stateMachine.transition('first_enter');
    expect(result.success).toBe(true);

    const state = stateMachine.getState();
    expect(state.currentPhase).toBe('core_guiding');
    expect(state.tutorialStartTime).toBeGreaterThan(0);
  });

  it('S4-3: 按顺序完成所有核心步骤', () => {
    const stateMachine = engine.guide.tutorialStateMachine;
    stateMachine.transition('first_enter');

    const coreSteps: Array<import('@/games/three-kingdoms/core/guide/guide.types').TutorialStepId> = [
      'step1_castle_overview',
      'step2_build_farm',
      'step3_recruit_hero',
      'step4_first_battle',
      'step5_check_resources',
      'step6_tech_research',
    ];

    for (const stepId of coreSteps) {
      stateMachine.completeStep(stepId);
    }

    const state = stateMachine.getState();
    expect(state.completedSteps).toHaveLength(6);
    expect(state.completedSteps).toEqual(coreSteps);
  });

  it('S4-4: 不能跳步（从 not_started 不能直接到 free_play）', () => {
    const stateMachine = engine.guide.tutorialStateMachine;

    // not_started 阶段只允许 first_enter
    const result = stateMachine.transition('explore_done');
    expect(result.success).toBe(false);

    // 状态不变
    expect(stateMachine.getCurrentPhase()).toBe('not_started');

    // 非法转换：直接到 step6_complete
    const result2 = stateMachine.transition('step6_complete');
    expect(result2.success).toBe(false);
  });

  it('S4-5: 引导完成后状态正确（完整流程）', () => {
    const stateMachine = engine.guide.tutorialStateMachine;

    // 完整流程：not_started → core_guiding → free_explore → free_play
    const r1 = stateMachine.transition('first_enter');
    expect(r1.success).toBe(true);
    expect(stateMachine.getCurrentPhase()).toBe('core_guiding');

    const r2 = stateMachine.transition('step6_complete');
    expect(r2.success).toBe(true);
    expect(stateMachine.getCurrentPhase()).toBe('free_explore');

    const r3 = stateMachine.transition('explore_done');
    expect(r3.success).toBe(true);
    expect(stateMachine.getCurrentPhase()).toBe('free_play');

    // 验证转换日志
    const state = stateMachine.getState();
    expect(state.transitionLogs).toHaveLength(3);
    expect(state.transitionLogs[0].from).toBe('not_started');
    expect(state.transitionLogs[0].to).toBe('core_guiding');
    expect(state.transitionLogs[2].to).toBe('free_play');
  });

  it('S4-6: 跳过引导（skip_to_explore）', () => {
    const stateMachine = engine.guide.tutorialStateMachine;

    // 进入 core_guiding
    stateMachine.transition('first_enter');
    expect(stateMachine.getCurrentPhase()).toBe('core_guiding');

    // 跳过引导
    const result = stateMachine.transition('skip_to_explore');
    expect(result.success).toBe(true);
    expect(stateMachine.getCurrentPhase()).toBe('free_explore');

    // 可以继续到 free_play
    const r2 = stateMachine.transition('explore_done');
    expect(r2.success).toBe(true);
    expect(stateMachine.getCurrentPhase()).toBe('free_play');
  });
});
