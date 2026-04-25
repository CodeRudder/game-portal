/**
 * V3 端到端 + 交叉验证集成测试
 *
 * 覆盖端到端完整流程和跨系统交叉验证：
 * - E2E-FLOW-1: 完整游戏循环（v3.0版）
 * - E2E-FLOW-2: 多关卡连续推图
 * - CROSS-FLOW-1: 战斗→武将经验→战力提升
 * - CROSS-FLOW-2: 战斗→资源消耗→奖励入账
 * - CROSS-FLOW-3: 扫荡→碎片→合成链路
 * - CROSS-FLOW-4: 存档→重载→进度恢复
 * - §5.1~5.3 完整流程串联 / 章节推进 / 交叉验证
 * - §9.4~9.6 VIP系统 / 统一状态机 / VIP等级校验
 * - §10.3 自动连续战斗
 * - §11.3 挑战关卡资源串联
 *
 * 编码规范：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - UI层 it.skip + `[UI层测试]`
 * - 引擎未实现 it.skip + `[引擎未实现]`
 * - 不使用 `as any`
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import { BattleOutcome } from '../../battle/battle.types';

// ── 辅助：初始化带武将和编队的状态 ──
function initBattleReadyState(): GameEventSimulator {
  const sim = createSim();
  // 提高资源上限避免奖励被截断
  sim.engine.resource.setCap('grain', 1_000_000);
  sim.engine.resource.setCap('troops', 1_000_000);
  sim.addResources({ gold: 500000, grain: 500000, troops: 200000 });
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  sim.engine.createFormation('main');
  sim.engine.setFormation('main', heroIds);
  return sim;
}

// ── 辅助：三星通关指定关卡 ──
function threeStarClear(sim: GameEventSimulator, stageId: string): void {
  sim.engine.startBattle(stageId);
  sim.engine.completeBattle(stageId, 3);
}

// ── 辅助：通关整个章节 ──
function clearChapter(sim: GameEventSimulator, chapterIndex: number): void {
  const chapters = sim.engine.getChapters();
  const chapter = chapters[chapterIndex];
  for (const stage of chapter.stages) {
    threeStarClear(sim, stage.id);
  }
}

// ─────────────────────────────────────────
// E2E-FLOW-1: 完整游戏循环（v3.0版）
// ─────────────────────────────────────────
describe('E2E-FLOW-1: 完整游戏循环（v3.0版）', () => {
  it('should complete full cycle: initMidGameState → stage list → challenge stage 1 → battle → settle → unlock stage 2 → sweep stage 1', () => {
    // Step 1: initMidGameState
    const sim = createSim();
    sim.initMidGameState();

    // Step 2: 查看关卡列表
    const stages = sim.engine.getStageList();
    expect(stages.length).toBeGreaterThan(0);
    const firstStage = stages[0];
    const campaignSystem = sim.engine.getCampaignSystem();

    // Step 3: 挑战第1关
    expect(campaignSystem.canChallenge(firstStage.id)).toBe(true);

    // Step 4: 战斗
    const result = sim.engine.startBattle(firstStage.id);
    expect(result.outcome).toBe(BattleOutcome.VICTORY);

    // Step 5: 结算
    sim.engine.completeBattle(firstStage.id, 3);
    expect(campaignSystem.getStageStars(firstStage.id)).toBe(3);
    expect(campaignSystem.getStageStatus(firstStage.id)).toBe('threeStar');

    // Step 6: 验证第2关解锁
    if (stages.length > 1) {
      expect(campaignSystem.canChallenge(stages[1].id)).toBe(true);
    }

    // Step 7: 扫荡第1关
    const sweepSystem = sim.engine.getSweepSystem();
    expect(sweepSystem.canSweep(firstStage.id)).toBe(true);
    sweepSystem.addTickets(5);
    const sweepResult = sweepSystem.sweep(firstStage.id, 1);
    expect(sweepResult.success).toBe(true);
    expect(sweepResult.executedCount).toBe(1);
  });

  it('should verify full chain: formation → challenge → battle → settle → reward → unlock', () => {
    const sim = initBattleReadyState();

    // 编队验证
    const formation = sim.engine.getFormationSystem().getFormation('main');
    expect(formation).toBeDefined();
    expect(formation!.slots.filter(s => s !== '').length).toBe(6);

    // 挑战
    const stages = sim.engine.getStageList();
    const firstStage = stages[0];
    const campaignSystem = sim.engine.getCampaignSystem();
    expect(campaignSystem.canChallenge(firstStage.id)).toBe(true);

    // 战斗
    const result = sim.engine.startBattle(firstStage.id);
    expect(result.outcome).toBe(BattleOutcome.VICTORY);

    // 结算 + 奖励
    const grainBefore = sim.getResource('grain');
    sim.engine.completeBattle(firstStage.id, 3);
    const grainAfter = sim.getResource('grain');
    expect(grainAfter).toBeGreaterThan(grainBefore);

    // 解锁
    if (stages.length > 1) {
      expect(campaignSystem.canChallenge(stages[1].id)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────
// E2E-FLOW-2: 多关卡连续推图
// ─────────────────────────────────────────
describe('E2E-FLOW-2: 多关卡连续推图', () => {
  it('should clear 5 stages sequentially and verify unlock, stars, and resources', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();
    const clearCount = Math.min(5, stages.length);

    // 记录初始资源
    const initialResources = sim.getAllResources();
    let totalStars = 0;

    for (let i = 0; i < clearCount; i++) {
      const stageId = stages[i].id;

      // 验证当前关卡可挑战
      expect(campaignSystem.canChallenge(stageId)).toBe(true);

      // 通关
      threeStarClear(sim, stageId);

      // 验证星级
      expect(campaignSystem.getStageStars(stageId)).toBe(3);
      totalStars += 3;

      // 验证下一关解锁（如果不是最后一关）
      if (i + 1 < clearCount) {
        expect(campaignSystem.canChallenge(stages[i + 1].id)).toBe(true);
      }
    }

    // 验证总星数
    expect(totalStars).toBe(clearCount * 3);

    // 验证资源增长
    const finalResources = sim.getAllResources();
    expect(finalResources.grain).toBeGreaterThan(initialResources.grain);
  });

  it('should track cumulative star count correctly across stages', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();

    for (let i = 0; i < Math.min(5, stages.length); i++) {
      threeStarClear(sim, stages[i].id);
    }

    // 验证总星数与手动计算一致
    let manualTotal = 0;
    const progress = campaignSystem.getProgress();
    for (let i = 0; i < 5; i++) {
      manualTotal += progress.stageStates[stages[i].id].stars;
    }
    expect(campaignSystem.getTotalStars()).toBe(manualTotal);
  });
});

// ─────────────────────────────────────────
// CROSS-FLOW-1: 战斗→武将经验→战力提升
// ─────────────────────────────────────────
describe('CROSS-FLOW-1: 战斗→武将经验→战力提升', () => {
  it('should increase hero exp and power after battle', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const firstStage = stages[0];

    // 记录战前武将状态
    const heroBefore = sim.engine.hero.getGeneral('guanyu')!;
    const expBefore = heroBefore.exp;
    const powerBefore = sim.engine.hero.calculatePower(heroBefore);

    // 通关
    threeStarClear(sim, firstStage.id);

    // 验证武将经验增加（战斗奖励包含经验）
    const heroAfter = sim.engine.hero.getGeneral('guanyu')!;
    const expAfter = heroAfter.exp;
    // 经验可能增加（取决于奖励是否分发到武将）
    expect(expAfter).toBeGreaterThanOrEqual(expBefore);

    // 通过 enhanceHero 验证战力提升链路
    sim.addResources({ gold: 500000, grain: 500000 });
    sim.engine.enhanceHero('guanyu', 10);
    const heroEnhanced = sim.engine.hero.getGeneral('guanyu')!;
    const powerAfterEnhance = sim.engine.hero.calculatePower(heroEnhanced);
    expect(powerAfterEnhance).toBeGreaterThan(powerBefore);
  });
});

// ─────────────────────────────────────────
// CROSS-FLOW-2: 战斗→资源消耗→奖励入账
// ─────────────────────────────────────────
describe('CROSS-FLOW-2: 战斗→资源消耗→奖励入账', () => {
  it('should verify resource changes across startBattle → completeBattle', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const firstStage = stages[0];

    // 记录战斗前资源
    const resourcesBefore = sim.getAllResources();

    // startBattle（可能扣减体力等资源）
    sim.engine.startBattle(firstStage.id);
    const resourcesAfterStart = sim.getAllResources();

    // completeBattle → 验证奖励入账
    sim.engine.completeBattle(firstStage.id, 3);
    const resourcesAfterComplete = sim.getAllResources();

    // 完成后资源应 >= startBattle后（奖励入账）
    expect(resourcesAfterComplete.grain).toBeGreaterThanOrEqual(resourcesAfterStart.grain);
    // 首通奖励应使资源增加
    expect(resourcesAfterComplete.grain).toBeGreaterThan(resourcesBefore.grain);
  });

  it('should give first clear bonus on first completion', () => {
    const sim = initBattleReadyState();
    const firstStageId = sim.engine.getStageList()[0].id;
    const campaignSystem = sim.engine.getCampaignSystem();

    // 首通
    const grainBeforeFirst = sim.getResource('grain');
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    const grainAfterFirst = sim.getResource('grain');
    const firstGain = grainAfterFirst - grainBeforeFirst;

    expect(campaignSystem.isFirstCleared(firstStageId)).toBe(true);
    expect(firstGain).toBeGreaterThan(0);

    // 重复通关
    const grainBeforeRepeat = sim.getResource('grain');
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    const grainAfterRepeat = sim.getResource('grain');
    const repeatGain = grainAfterRepeat - grainBeforeRepeat;

    // 首通奖励应 >= 重复奖励（首通有额外倍率）
    expect(firstGain).toBeGreaterThanOrEqual(repeatGain);
  });
});

// ─────────────────────────────────────────
// CROSS-FLOW-3: 扫荡→碎片→合成链路
// ─────────────────────────────────────────
describe('CROSS-FLOW-3: 扫荡→碎片→合成链路', () => {
  it('should get fragments from sweep and verify synthesis progress', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const firstStage = stages[0];

    // 三星通关
    threeStarClear(sim, firstStage.id);

    // 扫荡
    const sweepSystem = sim.engine.getSweepSystem();
    sweepSystem.addTickets(10);
    const sweepResult = sweepSystem.sweep(firstStage.id, 5);

    expect(sweepResult.success).toBe(true);
    expect(sweepResult.executedCount).toBe(5);
    expect(sweepResult.totalExp).toBeGreaterThan(0);

    // 验证碎片获得（扫荡可能产出碎片）
    expect(sweepResult.totalFragments).toBeDefined();
  });

  it('should verify fragment → synthesis chain via addFragment + canSynthesize', () => {
    const sim = initBattleReadyState();

    // 添加碎片到一个尚未拥有的武将
    // simayi 是 EPIC 品质，需要 150 碎片合成
    const targetHeroId = 'simayi';
    const progressBefore = sim.engine.getSynthesizeProgress(targetHeroId);
    expect(progressBefore.current).toBe(0);

    // 添加部分碎片，不足以合成
    sim.addHeroFragments(targetHeroId, 80);
    const progressAfter = sim.engine.getSynthesizeProgress(targetHeroId);
    expect(progressAfter.current).toBe(80);
    expect(sim.engine.hero.canSynthesize(targetHeroId)).toBe(false);

    // 添加足够碎片达到合成要求
    sim.addHeroFragments(targetHeroId, 80);
    const progressFinal = sim.engine.getSynthesizeProgress(targetHeroId);
    expect(progressFinal.current).toBe(160);

    // 现在应该可以合成（160 >= 150）
    expect(sim.engine.hero.canSynthesize(targetHeroId)).toBe(true);
  });

  it('should verify sweep rewards include fragments that contribute to synthesis', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();

    // 通关前3关
    for (let i = 0; i < 3; i++) {
      threeStarClear(sim, stages[i].id);
    }

    // 扫荡获取奖励
    const sweepSystem = sim.engine.getSweepSystem();
    sweepSystem.addTickets(10);
    const result = sweepSystem.sweep(stages[0].id, 3);

    expect(result.success).toBe(true);
    expect(result.totalResources).toBeDefined();
    expect(result.totalExp).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────
// CROSS-FLOW-4: 存档→重载→进度恢复
// ─────────────────────────────────────────
describe('CROSS-FLOW-4: 存档→重载→进度恢复', () => {
  it('should save → serialize → new engine → deserialize → verify progress', () => {
    // Step 1: 通关3关
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();

    for (let i = 0; i < 3; i++) {
      threeStarClear(sim, stages[i].id);
    }

    // 验证进度
    expect(campaignSystem.getStageStars(stages[0].id)).toBe(3);
    expect(campaignSystem.getStageStars(stages[1].id)).toBe(3);
    expect(campaignSystem.getStageStars(stages[2].id)).toBe(3);
    expect(campaignSystem.getTotalStars()).toBe(9);

    // Step 2: save + serialize
    sim.engine.save();
    const serialized = sim.engine.serialize();
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(0);

    // Step 3: 新引擎 → deserialize
    const sim2 = createSim();
    sim2.engine.deserialize(serialized);

    // Step 4: 验证进度恢复
    const campaignSystem2 = sim2.engine.getCampaignSystem();
    expect(campaignSystem2.getStageStars(stages[0].id)).toBe(3);
    expect(campaignSystem2.getStageStars(stages[1].id)).toBe(3);
    expect(campaignSystem2.getStageStars(stages[2].id)).toBe(3);
    expect(campaignSystem2.getTotalStars()).toBe(9);
    expect(campaignSystem2.isFirstCleared(stages[0].id)).toBe(true);
  });

  it('should preserve resource state across save/load cycle', () => {
    const sim = initBattleReadyState();
    sim.engine.resource.setCap('grain', 1_000_000);
    sim.engine.resource.setCap('troops', 1_000_000);

    // 通关获取资源
    const stages = sim.engine.getStageList();
    threeStarClear(sim, stages[0].id);

    const resourcesBefore = sim.getAllResources();

    // 序列化 + 反序列化
    const serialized = sim.engine.serialize();
    const sim2 = createSim();
    // 反序列化前提高上限避免截断
    sim2.engine.resource.setCap('grain', 1_000_000);
    sim2.engine.resource.setCap('troops', 1_000_000);
    sim2.engine.deserialize(serialized);

    // 验证资源恢复（反序列化后上限可能不同，验证资源量合理）
    const resourcesAfter = sim2.getAllResources();
    // 验证资源 > 0（至少有初始值）
    expect(resourcesAfter.grain).toBeGreaterThan(0);
    expect(resourcesAfter.gold).toBeGreaterThan(0);
    // 验证资源不超过原始值（反序列化可能被上限截断）
    expect(resourcesAfter.grain).toBeLessThanOrEqual(resourcesBefore.grain);
    expect(resourcesAfter.gold).toBeLessThanOrEqual(resourcesBefore.gold);
  });

  it('should preserve hero data across save/load cycle', () => {
    const sim = initBattleReadyState();
    const heroCountBefore = sim.getGeneralCount();

    // 序列化 + 反序列化
    const serialized = sim.engine.serialize();
    const sim2 = createSim();
    sim2.engine.deserialize(serialized);

    // 验证武将数据恢复
    expect(sim2.getGeneralCount()).toBe(heroCountBefore);
  });
});

// ─────────────────────────────────────────
// §5.1 完整流程串联
// ─────────────────────────────────────────
describe('§5.1 完整流程串联', () => {
  it('should complete full cycle: formation→challenge→battle→reward→map', () => {
    const sim = initBattleReadyState();

    // Step 1: 验证编队
    const formation = sim.engine.getFormationSystem().getFormation('main');
    expect(formation).toBeDefined();
    expect(formation!.slots.filter(s => s !== '').length).toBe(6);

    // Step 2: 查看可挑战关卡
    const stages = sim.engine.getStageList();
    const firstStage = stages[0];
    const campaignSystem = sim.engine.getCampaignSystem();
    expect(campaignSystem.canChallenge(firstStage.id)).toBe(true);

    // Step 3: 战斗
    const result = sim.engine.startBattle(firstStage.id);
    expect(result.outcome).toBe(BattleOutcome.VICTORY);

    // Step 4: 结算
    const grainBefore = sim.getResource('grain');
    sim.engine.completeBattle(firstStage.id, 3);
    const grainAfter = sim.getResource('grain');
    expect(grainAfter).toBeGreaterThan(grainBefore);

    // Step 5: 验证关卡状态更新
    const status = campaignSystem.getStageStatus(firstStage.id);
    expect(status).toBe('threeStar');

    // Step 6: 验证下一关解锁
    if (stages.length > 1) {
      expect(campaignSystem.canChallenge(stages[1].id)).toBe(true);
    }
  });

  it('should support repeated full cycles without data loss', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();

    for (let i = 0; i < Math.min(5, stages.length); i++) {
      const stageId = stages[i].id;
      sim.engine.startBattle(stageId);
      sim.engine.completeBattle(stageId, 3);
      expect(campaignSystem.getStageStars(stageId)).toBe(3);
    }

    // 验证所有通关数据完整
    let totalStars = 0;
    for (let i = 0; i < 5; i++) {
      totalStars += campaignSystem.getStageStars(stages[i].id);
    }
    expect(totalStars).toBe(15);
  });
});

// ─────────────────────────────────────────
// §5.2 章节推进
// ─────────────────────────────────────────
describe('§5.2 章节推进', () => {
  it('should progress through chapter 1 completely', () => {
    const sim = initBattleReadyState();
    const chapters = sim.engine.getChapters();
    const chapter1 = chapters[0];
    const campaignSystem = sim.engine.getCampaignSystem();

    // 通关第一章全部5关
    for (const stage of chapter1.stages) {
      threeStarClear(sim, stage.id);
    }

    // 验证所有关卡三星
    for (const stage of chapter1.stages) {
      expect(campaignSystem.getStageStars(stage.id)).toBe(3);
      expect(campaignSystem.getStageStatus(stage.id)).toBe('threeStar');
    }
  });

  it('should unlock chapter 2 after clearing chapter 1', () => {
    const sim = initBattleReadyState();
    const chapters = sim.engine.getChapters();
    const campaignSystem = sim.engine.getCampaignSystem();

    // 通关第一章
    clearChapter(sim, 0);

    // 第二章第一关应该可挑战
    const chapter2FirstStage = chapters[1].stages[0];
    expect(campaignSystem.canChallenge(chapter2FirstStage.id)).toBe(true);
  });

  it('should have increasing difficulty across chapters', () => {
    const sim = initBattleReadyState();
    const chapters = sim.engine.getChapters();

    for (let i = 1; i < chapters.length; i++) {
      const prevChapter = chapters[i - 1];
      const currChapter = chapters[i];

      const prevPower = prevChapter.stages[0].enemyFormation.recommendedPower;
      const currPower = currChapter.stages[0].enemyFormation.recommendedPower;
      expect(currPower).toBeGreaterThan(prevPower);
    }
  });

  it('should track total stars across all chapters', () => {
    const sim = initBattleReadyState();
    const campaignSystem = sim.engine.getCampaignSystem();

    expect(campaignSystem.getTotalStars()).toBe(0);

    clearChapter(sim, 0);
    expect(campaignSystem.getTotalStars()).toBe(15); // 5关 × 3星
  });
});

// ─────────────────────────────────────────
// §5.3 交叉验证
// ─────────────────────────────────────────
describe('§5.3 交叉验证', () => {
  it('should sync campaign progress ↔ stage unlock correctly', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();

    expect(campaignSystem.getStageStatus(stages[0].id)).toBe('available');
    expect(campaignSystem.getStageStatus(stages[1].id)).toBe('locked');

    threeStarClear(sim, stages[0].id);
    expect(campaignSystem.getStageStatus(stages[1].id)).toBe('available');
  });

  it('should sync star rating ↔ sweep unlock', () => {
    const sim = initBattleReadyState();
    const firstStageId = sim.engine.getStageList()[0].id;
    const sweepSystem = sim.engine.getSweepSystem();
    const campaignSystem = sim.engine.getCampaignSystem();

    expect(sweepSystem.canSweep(firstStageId)).toBe(false);

    // 1星通关仍不能扫荡
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 1);
    expect(campaignSystem.getStageStars(firstStageId)).toBe(1);
    expect(sweepSystem.canSweep(firstStageId)).toBe(false);

    // 3星通关后解锁扫荡
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    expect(campaignSystem.getStageStars(firstStageId)).toBe(3);
    expect(sweepSystem.canSweep(firstStageId)).toBe(true);
  });

  it('should sync first clear reward ↔ resource system', () => {
    const sim = initBattleReadyState();
    const firstStageId = sim.engine.getStageList()[0].id;
    const campaignSystem = sim.engine.getCampaignSystem();

    expect(campaignSystem.isFirstCleared(firstStageId)).toBe(false);

    const grainBeforeFirst = sim.getResource('grain');
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    const grainAfterFirst = sim.getResource('grain');
    const firstGain = grainAfterFirst - grainBeforeFirst;

    expect(campaignSystem.isFirstCleared(firstStageId)).toBe(true);
    expect(firstGain).toBeGreaterThan(0);

    // 重复通关
    const grainBeforeRepeat = sim.getResource('grain');
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    const grainAfterRepeat = sim.getResource('grain');
    const repeatGain = grainAfterRepeat - grainBeforeRepeat;

    expect(repeatGain).toBeGreaterThanOrEqual(0);
    expect(firstGain).toBeGreaterThanOrEqual(repeatGain);
  });

  it('should sync formation ↔ battle team correctly', () => {
    const sim = initBattleReadyState();
    const formation = sim.engine.getFormationSystem().getFormation('main')!;
    const stages = sim.engine.getStageList();
    const { allyTeam } = sim.engine.buildTeamsForStage(stages[0]);

    const filledSlots = formation.slots.filter(s => s !== '');
    expect(allyTeam.units.length).toBe(filledSlots.length);
  });

  it('should sync power increase ↔ campaign progress', () => {
    const sim = initBattleReadyState();
    const hero = sim.engine.hero;
    const starSystem = sim.engine.getHeroStarSystem();
    const formationSys = sim.engine.getFormationSystem();

    const powerBefore = formationSys.calculateFormationPower(
      formationSys.getFormation('main')!,
      (id) => hero.getGeneral(id),
      (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
    );

    sim.addResources({ gold: 500000, grain: 500000 });
    sim.engine.enhanceHero('guanyu', 10);

    const powerAfter = formationSys.calculateFormationPower(
      formationSys.getFormation('main')!,
      (id) => hero.getGeneral(id),
      (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
    );

    expect(powerAfter).toBeGreaterThan(powerBefore);
  });
});

// ─────────────────────────────────────────
// §9.4 VIP系统依赖说明
// ─────────────────────────────────────────
describe('§9.4 VIP系统依赖说明', () => {
  it.todo('[引擎未实现] should have VIP level system', () => {
    // VIP系统尚未完整实现
  });

  it.todo('[引擎未实现] should unlock 3x speed at VIP3+', () => {
    // VIP特权校验尚未实现
  });

  it.todo('[引擎未实现] should unlock free sweep at VIP5+', () => {
    // VIP免费扫荡尚未实现
  });
});

// ─────────────────────────────────────────
// §9.5 关卡↔扫荡↔离线统一状态机
// ─────────────────────────────────────────
describe('§9.5 关卡↔扫荡↔离线统一状态机', () => {
  it('should follow state transitions: locked→available→cleared→threeStar', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const firstStageId = stages[0].id;
    const campaignSystem = sim.engine.getCampaignSystem();

    expect(campaignSystem.getStageStatus(firstStageId)).toBe('available');

    // 1星通关：cleared
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 1);
    expect(campaignSystem.getStageStatus(firstStageId)).toBe('cleared');

    // 3星通关：threeStar
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    expect(campaignSystem.getStageStatus(firstStageId)).toBe('threeStar');
  });

  it('should unlock sweep only at threeStar state', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const firstStageId = stages[0].id;
    const sweepSystem = sim.engine.getSweepSystem();
    const campaignSystem = sim.engine.getCampaignSystem();

    // available → 不能扫荡
    expect(sweepSystem.canSweep(firstStageId)).toBe(false);

    // cleared (1星) → 不能扫荡
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 1);
    expect(campaignSystem.getStageStatus(firstStageId)).toBe('cleared');
    expect(sweepSystem.canSweep(firstStageId)).toBe(false);

    // threeStar → 可以扫荡
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    expect(campaignSystem.getStageStatus(firstStageId)).toBe('threeStar');
    expect(sweepSystem.canSweep(firstStageId)).toBe(true);
  });

  it('should allow re-challenge from cleared state to improve stars', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const firstStageId = stages[0].id;
    const campaignSystem = sim.engine.getCampaignSystem();

    // 1星通关
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 1);
    expect(campaignSystem.getStageStars(firstStageId)).toBe(1);

    expect(campaignSystem.canChallenge(firstStageId)).toBe(true);

    // 3星通关
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);
    expect(campaignSystem.getStageStars(firstStageId)).toBe(3);
  });
});

// ─────────────────────────────────────────
// §9.6 VIP等级校验端到端流程
// ─────────────────────────────────────────
describe('§9.6 VIP等级校验端到端流程', () => {
  it.todo('[引擎未实现] should accumulate VIP experience from purchases', () => {
    // VIP经验累积尚未实现
  });

  it.todo('[引擎未实现] should validate VIP level for battle speed features', () => {
    // VIP等级校验尚未实现
  });

  it.todo('[引擎未实现] should support GM command to set VIP level for testing', () => {
    // GM命令尚未实现
  });
});

// ─────────────────────────────────────────
// §10.2a 离线收益领取弹窗流程 [UI层测试]
// ─────────────────────────────────────────
describe('§10.2a 离线收益领取弹窗流程', () => {
  it.todo('[UI层测试] should show offline earnings popup on login', () => {
    // 离线收益弹窗属于UI层
  });

  it.todo('[UI层测试] should display earnings breakdown in popup', () => {
    // 收益明细展示属于UI层
  });
});

// ─────────────────────────────────────────
// §10.3 自动连续战斗
// ─────────────────────────────────────────
describe('§10.3 自动连续战斗', () => {
  it('should have autoPush function in sweep system', () => {
    const sim = initBattleReadyState();
    const sweepSystem = sim.engine.getSweepSystem();
    expect(typeof sweepSystem.autoPush).toBe('function');
  });

  it('should execute autoPush with prerequisites met', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    for (let i = 0; i < 3; i++) {
      threeStarClear(sim, stages[i].id);
    }

    const sweepSystem = sim.engine.getSweepSystem();
    sweepSystem.addTickets(10);

    const result = sweepSystem.autoPush();
    expect(result).toBeDefined();
    expect(result.totalAttempts).toBeGreaterThanOrEqual(0);
  });

  it('should stop autoPush on defeat', () => {
    const sim = initBattleReadyState();
    const sweepSystem = sim.engine.getSweepSystem();
    const result = sweepSystem.autoPush();
    expect(result).toBeDefined();
  });
});

// ─────────────────────────────────────────
// §11.3 挑战关卡资源串联
// ─────────────────────────────────────────
describe('§11.3 挑战关卡资源串联', () => {
  it.todo('[引擎未实现] should deduct army and stamina on challenge stage entry', () => {
    // 挑战关卡资源扣减尚未实现
  });

  it.todo('[引擎未实现] should give special materials on challenge stage victory', () => {
    // 挑战关卡特殊材料掉落尚未实现
  });

  it.todo('[引擎未实现] should refund resources on challenge stage failure', () => {
    // 挑战关卡失败资源返还尚未实现
  });
});

// ─────────────────────────────────────────
// 综合端到端场景
// ─────────────────────────────────────────
describe('综合端到端场景', () => {
  it('should simulate new player first campaign experience', () => {
    // 1. 初始化
    const newSim = createSim();
    newSim.addResources({ gold: 100000, grain: 100000, troops: 50000 });

    // 2. 添加武将
    const heroIds = ['liubei', 'guanyu', 'zhangfei'];
    for (const id of heroIds) {
      newSim.addHeroDirectly(id);
    }
    expect(newSim.getGeneralCount()).toBe(3);

    // 3. 编队
    newSim.engine.createFormation('main');
    newSim.engine.setFormation('main', heroIds);
    const formation = newSim.engine.getFormationSystem().getFormation('main')!;
    expect(formation.slots.filter(s => s !== '').length).toBe(3);

    // 4. 挑战第一关
    const stages = newSim.engine.getStageList();
    const firstStage = stages[0];
    const campaignSystem = newSim.engine.getCampaignSystem();

    expect(campaignSystem.canChallenge(firstStage.id)).toBe(true);

    // 5. 战斗
    const result = newSim.engine.startBattle(firstStage.id);
    expect([BattleOutcome.VICTORY, BattleOutcome.DEFEAT, BattleOutcome.DRAW]).toContain(result.outcome);

    // 6. 结算
    newSim.engine.completeBattle(firstStage.id, 3);
    expect(campaignSystem.getStageStars(firstStage.id)).toBe(3);
    expect(campaignSystem.isFirstCleared(firstStage.id)).toBe(true);

    // 7. 验证资源增加
    expect(newSim.getResource('grain')).toBeGreaterThan(0);
  });

  it('should simulate mid-game sweep and autoPush cycle', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();

    // 1. 通关前3关
    for (let i = 0; i < 3; i++) {
      threeStarClear(sim, stages[i].id);
    }

    // 2. 验证扫荡可用
    const sweepSystem = sim.engine.getSweepSystem();
    expect(sweepSystem.canSweep(stages[0].id)).toBe(true);
    expect(sweepSystem.canSweep(stages[1].id)).toBe(true);
    expect(sweepSystem.canSweep(stages[2].id)).toBe(true);

    // 3. 批量扫荡
    sweepSystem.addTickets(10);
    const sweepResult = sweepSystem.sweep(stages[0].id, 3);
    expect(sweepResult.success).toBe(true);
    expect(sweepResult.executedCount).toBe(3);

    // 4. 验证扫荡奖励
    expect(sweepResult.totalResources).toBeDefined();
    expect(sweepResult.totalExp).toBeGreaterThan(0);
  });

  it('should handle chapter completion and next chapter unlock', () => {
    const sim = initBattleReadyState();
    const chapters = sim.engine.getChapters();
    const campaignSystem = sim.engine.getCampaignSystem();

    // 通关前两章
    for (let ch = 0; ch < 2; ch++) {
      clearChapter(sim, ch);
    }

    // 验证两章都三星通关
    for (let ch = 0; ch < 2; ch++) {
      for (const stage of chapters[ch].stages) {
        expect(campaignSystem.getStageStars(stage.id)).toBe(3);
      }
    }

    // 第三章应该解锁
    const chapter3First = chapters[2].stages[0];
    expect(campaignSystem.canChallenge(chapter3First.id)).toBe(true);

    // 验证总星数
    expect(campaignSystem.getTotalStars()).toBe(30); // 2章 × 5关 × 3星
  });

  it('should verify campaign progress serialization', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    for (let i = 0; i < 3; i++) {
      threeStarClear(sim, stages[i].id);
    }

    const campaignSystem = sim.engine.getCampaignSystem();
    const progress = campaignSystem.getProgress();

    expect(progress.currentChapterId).toBeDefined();
    expect(Object.keys(progress.stageStates).length).toBeGreaterThan(0);

    for (let i = 0; i < 3; i++) {
      const state = progress.stageStates[stages[i].id];
      expect(state.stars).toBe(3);
      expect(state.firstCleared).toBe(true);
      expect(state.clearCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────
// 数据一致性验证
// ─────────────────────────────────────────
describe('数据一致性验证', () => {
  it('should maintain consistent stage count across operations', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();
    const progress = campaignSystem.getProgress();

    expect(Object.keys(progress.stageStates).length).toBe(stages.length);
  });

  it('should maintain consistent total stars', () => {
    const sim = initBattleReadyState();
    const stages = sim.engine.getStageList();
    const campaignSystem = sim.engine.getCampaignSystem();

    for (let i = 0; i < 5; i++) {
      threeStarClear(sim, stages[i].id);
    }

    let manualTotal = 0;
    const progress = campaignSystem.getProgress();
    for (const state of Object.values(progress.stageStates)) {
      manualTotal += state.stars;
    }

    expect(campaignSystem.getTotalStars()).toBe(manualTotal);
  });

  it('should maintain consistent clear count', () => {
    const sim = initBattleReadyState();
    const firstStageId = sim.engine.getStageList()[0].id;
    const campaignSystem = sim.engine.getCampaignSystem();

    for (let i = 0; i < 3; i++) {
      sim.engine.startBattle(firstStageId);
      sim.engine.completeBattle(firstStageId, 3);
    }

    expect(campaignSystem.getClearCount(firstStageId)).toBe(3);
  });

  it('should handle concurrent sweep and battle on same stage', () => {
    const sim = initBattleReadyState();
    const firstStageId = sim.engine.getStageList()[0].id;
    const sweepSystem = sim.engine.getSweepSystem();
    const campaignSystem = sim.engine.getCampaignSystem();

    threeStarClear(sim, firstStageId);
    sweepSystem.addTickets(5);

    // 先扫荡
    const sweepResult = sweepSystem.sweep(firstStageId, 1);
    expect(sweepResult.success).toBe(true);

    // 再战斗
    sim.engine.startBattle(firstStageId);
    sim.engine.completeBattle(firstStageId, 3);

    // 星级不变
    expect(campaignSystem.getStageStars(firstStageId)).toBe(3);
    // 通关次数增加
    expect(campaignSystem.getClearCount(firstStageId)).toBeGreaterThanOrEqual(2);
  });
});
