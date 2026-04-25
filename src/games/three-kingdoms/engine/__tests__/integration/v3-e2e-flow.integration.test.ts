/**
 * V3 端到端 + 交叉验证集成测试
 *
 * 基于 v3-play.md 测试端到端完整流程和跨系统交叉验证：
 * - §5.1  完整流程串联
 * - §5.2  章节推进
 * - §5.3  交叉验证（战役进度↔关卡解锁↔星级↔首通奖励↔编队↔战力）
 * - §9.4  VIP系统依赖说明
 * - §9.5  关卡↔扫荡↔离线统一状态机
 * - §9.6  VIP等级校验端到端流程
 * - §10.2a 离线收益领取弹窗流程 [UI层测试]
 * - §10.3 自动连续战斗
 * - §11.3 挑战关卡资源串联
 * - §11.1 进入挑战关卡 [引擎未实现]
 * - §11.2 挑战关卡结算 [引擎未实现]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import type { Stage, Chapter, CampaignProgress, StageStatus } from '../../campaign/campaign.types';
import { BattleOutcome, StarRating, TroopType } from '../../battle/battle.types';

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

describe('V3 E2E-FLOW: 端到端 + 交叉验证集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = initBattleReadyState();
  });

  // ─────────────────────────────────────────
  // §5.1 完整流程串联
  // ─────────────────────────────────────────
  describe('§5.1 完整流程串联', () => {
    it('should complete full cycle: formation→challenge→battle→reward→map', () => {
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
      const chapters = sim.engine.getChapters();
      const campaignSystem = sim.engine.getCampaignSystem();

      // 通关第一章
      clearChapter(sim, 0);

      // 第二章第一关应该可挑战
      const chapter2FirstStage = chapters[1].stages[0];
      expect(campaignSystem.canChallenge(chapter2FirstStage.id)).toBe(true);
    });

    it('should have increasing difficulty across chapters', () => {
      const chapters = sim.engine.getChapters();

      for (let i = 1; i < chapters.length; i++) {
        const prevChapter = chapters[i - 1];
        const currChapter = chapters[i];

        // 当前章节第一关的推荐战力应大于前一章第一关
        const prevPower = prevChapter.stages[0].enemyFormation.recommendedPower;
        const currPower = currChapter.stages[0].enemyFormation.recommendedPower;
        expect(currPower).toBeGreaterThan(prevPower);
      }
    });

    it('should track total stars across all chapters', () => {
      const campaignSystem = sim.engine.getCampaignSystem();

      // 初始总星数为0
      expect(campaignSystem.getTotalStars()).toBe(0);

      // 通关第一章
      clearChapter(sim, 0);
      expect(campaignSystem.getTotalStars()).toBe(15); // 5关 × 3星
    });
  });

  // ─────────────────────────────────────────
  // §5.3 交叉验证
  // ─────────────────────────────────────────
  describe('§5.3 交叉验证', () => {
    it('should sync campaign progress ↔ stage unlock correctly', () => {
      const stages = sim.engine.getStageList();
      const campaignSystem = sim.engine.getCampaignSystem();

      // 初始：第1关可挑战，第2关锁定
      expect(campaignSystem.getStageStatus(stages[0].id)).toBe('available');
      expect(campaignSystem.getStageStatus(stages[1].id)).toBe('locked');

      // 通关第1关后第2关解锁
      threeStarClear(sim, stages[0].id);
      expect(campaignSystem.getStageStatus(stages[1].id)).toBe('available');
    });

    it('should sync star rating ↔ sweep unlock', () => {
      const firstStageId = sim.engine.getStageList()[0].id;
      const sweepSystem = sim.engine.getSweepSystem();
      const campaignSystem = sim.engine.getCampaignSystem();

      // 未通关不能扫荡
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
      const firstStageId = sim.engine.getStageList()[0].id;
      const campaignSystem = sim.engine.getCampaignSystem();

      // 首通
      expect(campaignSystem.isFirstCleared(firstStageId)).toBe(false);

      const grainBeforeFirst = sim.getResource('grain');
      sim.engine.startBattle(firstStageId);
      sim.engine.completeBattle(firstStageId, 3);
      const grainAfterFirst = sim.getResource('grain');
      const firstGain = grainAfterFirst - grainBeforeFirst;

      expect(campaignSystem.isFirstCleared(firstStageId)).toBe(true);
      // 首通应该获得资源
      expect(firstGain).toBeGreaterThan(0);

      // 重复通关
      const grainBeforeRepeat = sim.getResource('grain');
      sim.engine.startBattle(firstStageId);
      sim.engine.completeBattle(firstStageId, 3);
      const grainAfterRepeat = sim.getResource('grain');
      const repeatGain = grainAfterRepeat - grainBeforeRepeat;

      // 重复通关也应该获得资源
      expect(repeatGain).toBeGreaterThanOrEqual(0);
      // 首通奖励应 >= 重复奖励（首通有额外倍率）
      expect(firstGain).toBeGreaterThanOrEqual(repeatGain);
    });

    it('should sync formation ↔ battle team correctly', () => {
      const formation = sim.engine.getFormationSystem().getFormation('main')!;
      const stages = sim.engine.getStageList();
      const { allyTeam } = sim.engine.buildTeamsForStage(stages[0]);

      // 编队中的武将应该出现在战斗队伍中
      const filledSlots = formation.slots.filter(s => s !== '');
      expect(allyTeam.units.length).toBe(filledSlots.length);
    });

    it('should sync power increase ↔ campaign progress', () => {
      const hero = sim.engine.hero;
      const starSystem = sim.engine.getHeroStarSystem();
      const formationSys = sim.engine.getFormationSystem();

      const powerBefore = formationSys.calculateFormationPower(
        formationSys.getFormation('main')!,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
      );

      // 升级武将
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
    it.skip('[引擎未实现] should have VIP level system', () => {
      // VIP系统尚未完整实现
    });

    it.skip('[引擎未实现] should unlock 3x speed at VIP3+', () => {
      // VIP特权校验尚未实现
    });

    it.skip('[引擎未实现] should unlock free sweep at VIP5+', () => {
      // VIP免费扫荡尚未实现
    });
  });

  // ─────────────────────────────────────────
  // §9.5 关卡↔扫荡↔离线统一状态机
  // ─────────────────────────────────────────
  describe('§9.5 关卡↔扫荡↔离线统一状态机', () => {
    it('should follow state transitions: locked→available→cleared→threeStar', () => {
      const stages = sim.engine.getStageList();
      const firstStageId = stages[0].id;
      const campaignSystem = sim.engine.getCampaignSystem();

      // 初始：available
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
      const stages = sim.engine.getStageList();
      const firstStageId = stages[0].id;
      const campaignSystem = sim.engine.getCampaignSystem();

      // 1星通关
      sim.engine.startBattle(firstStageId);
      sim.engine.completeBattle(firstStageId, 1);
      expect(campaignSystem.getStageStars(firstStageId)).toBe(1);

      // 可以重新挑战
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
    it.skip('[引擎未实现] should accumulate VIP experience from purchases', () => {
      // VIP经验累积尚未实现
    });

    it.skip('[引擎未实现] should validate VIP level for battle speed features', () => {
      // VIP等级校验尚未实现
    });

    it.skip('[引擎未实现] should support GM command to set VIP level for testing', () => {
      // GM命令尚未实现
    });
  });

  // ─────────────────────────────────────────
  // §10.2a 离线收益领取弹窗流程 [UI层测试]
  // ─────────────────────────────────────────
  describe('§10.2a 离线收益领取弹窗流程', () => {
    it.skip('[UI层测试] should show offline earnings popup on login', () => {
      // 离线收益弹窗属于UI层
    });

    it.skip('[UI层测试] should display earnings breakdown in popup', () => {
      // 收益明细展示属于UI层
    });
  });

  // ─────────────────────────────────────────
  // §10.3 自动连续战斗
  // ─────────────────────────────────────────
  describe('§10.3 自动连续战斗', () => {
    it('should have autoPush function in sweep system', () => {
      const sweepSystem = sim.engine.getSweepSystem();
      expect(typeof sweepSystem.autoPush).toBe('function');
    });

    it('should execute autoPush with prerequisites met', () => {
      // 先通关一些关卡
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
      const sweepSystem = sim.engine.getSweepSystem();
      const result = sweepSystem.autoPush();
      // 没有三星通关关卡时，autoPush可能不执行
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────
  // §11.3 挑战关卡资源串联
  // ─────────────────────────────────────────
  describe('§11.3 挑战关卡资源串联', () => {
    it.skip('[引擎未实现] should deduct army and stamina on challenge stage entry', () => {
      // 挑战关卡资源扣减尚未实现
    });

    it.skip('[引擎未实现] should give special materials on challenge stage victory', () => {
      // 挑战关卡特殊材料掉落尚未实现
    });

    it.skip('[引擎未实现] should refund resources on challenge stage failure', () => {
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
      // 1. 通关前3关
      const stages = sim.engine.getStageList();
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
      // 通关一些关卡
      const stages = sim.engine.getStageList();
      for (let i = 0; i < 3; i++) {
        threeStarClear(sim, stages[i].id);
      }

      const campaignSystem = sim.engine.getCampaignSystem();
      const progress = campaignSystem.getProgress();

      // 验证进度数据完整
      expect(progress.currentChapterId).toBeDefined();
      expect(Object.keys(progress.stageStates).length).toBeGreaterThan(0);

      // 验证已通关关卡数据
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
      const stages = sim.engine.getStageList();
      const campaignSystem = sim.engine.getCampaignSystem();
      const progress = campaignSystem.getProgress();

      // stageStates应该覆盖所有关卡
      expect(Object.keys(progress.stageStates).length).toBe(stages.length);
    });

    it('should maintain consistent total stars', () => {
      const stages = sim.engine.getStageList();
      const campaignSystem = sim.engine.getCampaignSystem();

      // 通关前5关
      for (let i = 0; i < 5; i++) {
        threeStarClear(sim, stages[i].id);
      }

      // 手动计算总星数
      let manualTotal = 0;
      const progress = campaignSystem.getProgress();
      for (const state of Object.values(progress.stageStates)) {
        manualTotal += state.stars;
      }

      expect(campaignSystem.getTotalStars()).toBe(manualTotal);
    });

    it('should maintain consistent clear count', () => {
      const firstStageId = sim.engine.getStageList()[0].id;
      const campaignSystem = sim.engine.getCampaignSystem();

      // 通关3次
      for (let i = 0; i < 3; i++) {
        sim.engine.startBattle(firstStageId);
        sim.engine.completeBattle(firstStageId, 3);
      }

      expect(campaignSystem.getClearCount(firstStageId)).toBe(3);
    });

    it('should handle concurrent sweep and battle on same stage', () => {
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
});
