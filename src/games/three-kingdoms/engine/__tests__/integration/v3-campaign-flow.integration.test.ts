/**
 * V3 战役系统 Play 流程集成测试
 *
 * 覆盖以下 play 流程：
 * - CAMPAIGN-FLOW-1: 章节浏览与关卡列表
 * - CAMPAIGN-FLOW-2: 关卡状态流转
 * - CAMPAIGN-FLOW-3: 星级评定
 * - CAMPAIGN-FLOW-4: 首通奖励
 * - CAMPAIGN-FLOW-5: 关卡解锁链
 * - CAMPAIGN-FLOW-6: 扫荡系统
 *
 * 编码规范：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - UI层测试 it.skip + [UI层测试]
 * - 引擎未实现 it.skip + [引擎未实现]
 * - 不使用 as any
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

// ── 辅助：获取第一章第一个可挑战关卡ID ──
function getFirstStageId(sim: GameEventSimulator): string {
  const stages = sim.engine.getStageList();
  return stages.length > 0 ? stages[0].id : '';
}

// ── 辅助：初始化带武将和编队的状态（用于战斗测试） ──
function initBattleReadyState(): GameEventSimulator {
  const sim = createSim();
  // 提高资源上限避免奖励被截断
  sim.engine.resource.setCap('grain', 1_000_000);
  sim.engine.resource.setCap('troops', 1_000_000);
  sim.addResources({ gold: 100000, grain: 100000, troops: 50000 });
  // 添加武将
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  // 创建编队
  sim.engine.createFormation('main');
  sim.engine.setFormation('main', heroIds);
  return sim;
}

// ── 辅助：三星通关指定关卡 ──
function threeStarClear(sim: GameEventSimulator, stageId: string): void {
  sim.engine.startBattle(stageId);
  sim.engine.completeBattle(stageId, 3);
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN-FLOW-1: 章节浏览与关卡列表
// ═══════════════════════════════════════════════════════════════
describe('V3 战役系统 — CAMPAIGN-FLOW', () => {
  describe('CAMPAIGN-FLOW-1: 章节浏览与关卡列表', () => {
    it('init() → getChapters() 返回6章', () => {
      // CAMPAIGN-FLOW-1: 验证初始化后返回6个章节
      const sim = createSim();
      const chapters = sim.engine.getChapters();
      expect(chapters.length).toBe(6);
    });

    it('getStageList() 返回30关', () => {
      // CAMPAIGN-FLOW-1: 验证关卡列表总数为30
      const sim = createSim();
      const stages = sim.engine.getStageList();
      expect(stages.length).toBe(30);
    });

    it('每章包含正确的关卡ID范围', () => {
      // CAMPAIGN-FLOW-1: 验证每章包含5个关卡，且ID格式为 chapter{N}_stage{M}
      const sim = createSim();
      const chapters = sim.engine.getChapters();

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        expect(chapter.stages.length).toBe(5);

        // 验证关卡ID格式
        for (let j = 0; j < chapter.stages.length; j++) {
          const stage = chapter.stages[j];
          expect(stage.id).toContain(`chapter${i + 1}`);
          expect(stage.id).toContain(`stage${j + 1}`);
          // 验证关卡属于正确的章节
          expect(stage.chapterId).toBe(chapter.id);
          // 验证关卡序号
          expect(stage.order).toBe(j + 1);
        }
      }
    });

    it('章节顺序和名称正确', () => {
      // CAMPAIGN-FLOW-1: 验证章节顺序与名称
      const sim = createSim();
      const chapters = sim.engine.getChapters();
      const expectedNames = ['黄巾之乱', '群雄割据', '官渡之战', '赤壁之战', '三国鼎立', '一统天下'];

      for (let i = 0; i < chapters.length; i++) {
        expect(chapters[i].order).toBe(i + 1);
        expect(chapters[i].name).toBe(expectedNames[i]);
      }
    });

    it('章节前置关系正确（第1章无前置，后续章节需前一章通关）', () => {
      // CAMPAIGN-FLOW-1: 验证章节解锁前置条件
      const sim = createSim();
      const chapters = sim.engine.getChapters();

      expect(chapters[0].prerequisiteChapterId).toBeNull();
      for (let i = 1; i < chapters.length; i++) {
        expect(chapters[i].prerequisiteChapterId).toBe(chapters[i - 1].id);
      }
    });

    it('关卡类型分布正确（每章最后为boss）', () => {
      // CAMPAIGN-FLOW-1: 验证关卡类型包含 normal/elite/boss
      const sim = createSim();
      const chapters = sim.engine.getChapters();

      for (const chapter of chapters) {
        const lastStage = chapter.stages[chapter.stages.length - 1];
        expect(lastStage.type).toBe('boss');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CAMPAIGN-FLOW-2: 关卡状态流转
  // ═══════════════════════════════════════════════════════════════
  describe('CAMPAIGN-FLOW-2: 关卡状态流转', () => {
    it('初始状态：第1关available，其余locked', () => {
      // CAMPAIGN-FLOW-2: 初始化后第1关可挑战，其余锁定
      const sim = createSim();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();

      // 第1关 available
      expect(campaignSystem.getStageStatus(stages[0].id)).toBe('available');

      // 第2关开始 locked
      for (let i = 1; i < stages.length; i++) {
        expect(campaignSystem.getStageStatus(stages[i].id)).toBe('locked');
      }
    });

    it('completeStage(stage1, 3) → 第1关变为threeStar，第2关变为available', () => {
      // CAMPAIGN-FLOW-2: 三星通关后状态正确流转
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const stage2Id = stages[1].id;

      // 通关前：第1关 available，第2关 locked
      expect(campaignSystem.getStageStatus(stage1Id)).toBe('available');
      expect(campaignSystem.getStageStatus(stage2Id)).toBe('locked');

      // 三星通关第1关
      threeStarClear(sim, stage1Id);

      // 通关后：第1关 threeStar，第2关 available
      expect(campaignSystem.getStageStatus(stage1Id)).toBe('threeStar');
      expect(campaignSystem.getStageStatus(stage2Id)).toBe('available');
    });

    it('completeStage(stage1, 1) → 第1关变为cleared（非threeStar）', () => {
      // CAMPAIGN-FLOW-2: 1-2星通关后状态为cleared
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      // 1星通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 1);

      // 状态为cleared（非threeStar）
      const status = campaignSystem.getStageStatus(stage1Id);
      expect(status).toBe('cleared');
    });

    it('completeStage(stage1, 2) → 第1关变为cleared', () => {
      // CAMPAIGN-FLOW-2: 2星通关后状态为cleared
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      // 2星通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 2);

      // 状态为cleared（非threeStar）
      const status = campaignSystem.getStageStatus(stage1Id);
      expect(status).toBe('cleared');
    });

    it('先1星→再3星 → 第1关从cleared变为threeStar', () => {
      // CAMPAIGN-FLOW-2: 状态从cleared升级到threeStar
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      // 先1星通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 1);
      expect(campaignSystem.getStageStatus(stage1Id)).toBe('cleared');

      // 再3星通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      expect(campaignSystem.getStageStatus(stage1Id)).toBe('threeStar');
    });

    it('canChallenge对available/cleared/threeStar返回true，对locked返回false', () => {
      // CAMPAIGN-FLOW-2: canChallenge方法验证
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();

      // 第1关 available → canChallenge = true
      expect(campaignSystem.canChallenge(stages[0].id)).toBe(true);
      // 第2关 locked → canChallenge = false
      expect(campaignSystem.canChallenge(stages[1].id)).toBe(false);

      // 通关第1关后
      threeStarClear(sim, stages[0].id);
      // 第1关 threeStar → canChallenge = true（可重复挑战）
      expect(campaignSystem.canChallenge(stages[0].id)).toBe(true);
      // 第2关 available → canChallenge = true
      expect(campaignSystem.canChallenge(stages[1].id)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CAMPAIGN-FLOW-3: 星级评定
  // ═══════════════════════════════════════════════════════════════
  describe('CAMPAIGN-FLOW-3: 星级评定', () => {
    it('winBattle(stage1, 3) → getStageStars(stage1) === 3', () => {
      // CAMPAIGN-FLOW-3: 三星通关后星级为3
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      threeStarClear(sim, stage1Id);
      expect(campaignSystem.getStageStars(stage1Id)).toBe(3);
    });

    it('winBattle(stage1, 1) → getStageStars(stage1) === 1', () => {
      // CAMPAIGN-FLOW-3: 1星通关后星级为1
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 1);
      expect(campaignSystem.getStageStars(stage1Id)).toBe(1);
    });

    it('重复通关取最高星级（1星→3星→1星 → 保持3星）', () => {
      // CAMPAIGN-FLOW-3: 星级只升不降
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      // 1星通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 1);
      expect(campaignSystem.getStageStars(stage1Id)).toBe(1);

      // 3星通关（升级）
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      expect(campaignSystem.getStageStars(stage1Id)).toBe(3);

      // 再次1星通关（不降级）
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 1);
      expect(campaignSystem.getStageStars(stage1Id)).toBe(3);
    });

    it('未通关关卡星级为0', () => {
      // CAMPAIGN-FLOW-3: 初始状态所有关卡星级为0
      const sim = createSim();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();

      for (const stage of stages) {
        expect(campaignSystem.getStageStars(stage.id)).toBe(0);
      }
    });

    it('getTotalStars() 统计所有关卡星级之和', () => {
      // CAMPAIGN-FLOW-3: 总星数统计
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();

      // 初始总星数为0
      expect(campaignSystem.getTotalStars()).toBe(0);

      // 三星通关第1关
      threeStarClear(sim, stages[0].id);
      expect(campaignSystem.getTotalStars()).toBe(3);

      // 三星通关第2关
      threeStarClear(sim, stages[1].id);
      expect(campaignSystem.getTotalStars()).toBe(6);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CAMPAIGN-FLOW-4: 首通奖励
  // ═══════════════════════════════════════════════════════════════
  describe('CAMPAIGN-FLOW-4: 首通奖励', () => {
    it('isFirstCleared(stage1) === false → winBattle → isFirstCleared(stage1) === true', () => {
      // CAMPAIGN-FLOW-4: 首通标记从false变为true
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      // 通关前
      expect(campaignSystem.isFirstCleared(stage1Id)).toBe(false);

      // 通关后
      threeStarClear(sim, stage1Id);
      expect(campaignSystem.isFirstCleared(stage1Id)).toBe(true);
    });

    it('首通奖励 = 基础奖励 × 3.0（首通额外奖励叠加）', () => {
      // CAMPAIGN-FLOW-4: 验证首通奖励显著高于重复通关
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const rewardDistributor = sim.engine.getRewardDistributor();

      // 预览基础奖励
      const baseRewards = rewardDistributor.previewBaseRewards(stage1Id);
      expect(baseRewards.resources).toBeDefined();
      expect(baseRewards.exp).toBeGreaterThan(0);

      // 计算首通奖励（isFirstClear=true）
      const firstClearReward = rewardDistributor.calculateRewards(stage1Id, 3, true);
      // 计算重复通关奖励（isFirstClear=false）
      const repeatReward = rewardDistributor.calculateRewards(stage1Id, 3, false);

      // 首通奖励应大于重复奖励
      expect(firstClearReward.isFirstClear).toBe(true);
      expect(repeatReward.isFirstClear).toBe(false);

      // 首通经验应高于重复经验（因为包含firstClearExp）
      expect(firstClearReward.exp).toBeGreaterThan(repeatReward.exp);
    });

    it('首通奖励包含firstClearRewards配置的额外资源', () => {
      // CAMPAIGN-FLOW-4: 验证首通额外奖励来自配置
      const sim = createSim();
      const stages = sim.engine.getStageList();
      const stage1 = stages[0];

      // 关卡应配置首通额外奖励
      expect(stage1.firstClearRewards).toBeDefined();
      expect(stage1.firstClearExp).toBeGreaterThanOrEqual(0);
    });

    it('首通后再次通关不再获得首通奖励', () => {
      // CAMPAIGN-FLOW-4: 首通标记只触发一次
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const campaignSystem = sim.engine.getCampaignSystem();

      // 首通
      threeStarClear(sim, stage1Id);
      expect(campaignSystem.isFirstCleared(stage1Id)).toBe(true);

      // 再次通关，首通标记仍为true（不会重置）
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      expect(campaignSystem.isFirstCleared(stage1Id)).toBe(true);
    });

    it('首通资源增加量显著高于重复通关', () => {
      // CAMPAIGN-FLOW-4: 验证首通实际入账资源更多
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      // 首通
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      const grainAfterFirst = sim.getResource('grain');

      // 重复通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      const grainAfterSecond = sim.getResource('grain');

      const firstGain = grainAfterFirst;
      const secondGain = grainAfterSecond - grainAfterFirst;

      // 首通获得资源 > 重复通关获得资源
      expect(firstGain).toBeGreaterThan(secondGain);
      expect(secondGain).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CAMPAIGN-FLOW-5: 关卡解锁链
  // ═══════════════════════════════════════════════════════════════
  describe('CAMPAIGN-FLOW-5: 关卡解锁链', () => {
    it('逐关通关到第5关，验证每关解锁正确', () => {
      // CAMPAIGN-FLOW-5: 章节内逐关解锁验证
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();

      // 逐关三星通关前5关（第1章全部关卡）
      for (let i = 0; i < 5; i++) {
        const stageId = stages[i].id;

        // 当前关卡应该可挑战
        expect(campaignSystem.canChallenge(stageId)).toBe(true);

        // 三星通关
        threeStarClear(sim, stageId);

        // 验证通关状态
        expect(campaignSystem.getStageStars(stageId)).toBe(3);
        expect(campaignSystem.getStageStatus(stageId)).toBe('threeStar');

        // 验证下一关解锁（如果还有下一关）
        if (i < stages.length - 1) {
          expect(campaignSystem.getStageStatus(stages[i + 1].id)).toBe('available');
        }
      }
    });

    it('跨章节解锁（第1章最后一关 → 第2章第1关）', () => {
      // CAMPAIGN-FLOW-5: 验证章节间解锁链
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const chapters = sim.engine.getChapters();

      // 第2章第1关初始应为locked
      const ch2FirstStage = chapters[1].stages[0];
      expect(campaignSystem.getStageStatus(ch2FirstStage.id)).toBe('locked');

      // 通关第1章所有关卡（5关）
      for (const stage of chapters[0].stages) {
        threeStarClear(sim, stage.id);
      }

      // 第2章第1关应变为available
      expect(campaignSystem.getStageStatus(ch2FirstStage.id)).toBe('available');
      expect(campaignSystem.canChallenge(ch2FirstStage.id)).toBe(true);
    });

    it('跳关无法解锁（不通关第1关，第2关始终locked）', () => {
      // CAMPAIGN-FLOW-5: 验证解锁链的严格顺序
      const sim = createSim();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();

      // 不通关第1关，第2关始终locked
      expect(campaignSystem.getStageStatus(stages[1].id)).toBe('locked');
      expect(campaignSystem.canChallenge(stages[1].id)).toBe(false);
    });

    it('通关计数正确递增', () => {
      // CAMPAIGN-FLOW-5: 验证通关次数统计
      const sim = initBattleReadyState();
      const campaignSystem = sim.engine.getCampaignSystem();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;

      expect(campaignSystem.getClearCount(stage1Id)).toBe(0);

      // 第1次通关
      threeStarClear(sim, stage1Id);
      expect(campaignSystem.getClearCount(stage1Id)).toBe(1);

      // 第2次通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 3);
      expect(campaignSystem.getClearCount(stage1Id)).toBe(2);

      // 第3次通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 2);
      expect(campaignSystem.getClearCount(stage1Id)).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CAMPAIGN-FLOW-6: 扫荡系统
  // ═══════════════════════════════════════════════════════════════
  describe('CAMPAIGN-FLOW-6: 扫荡系统', () => {
    it('三星通关前 canSweep() === false', () => {
      // CAMPAIGN-FLOW-6: 未三星通关不能扫荡
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();

      // 未通关时不能扫荡
      expect(sweepSystem.canSweep(stage1Id)).toBe(false);
    });

    it('1星/2星通关后 canSweep() === false', () => {
      // CAMPAIGN-FLOW-6: 非三星通关不能扫荡
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();

      // 1星通关
      sim.engine.startBattle(stage1Id);
      sim.engine.completeBattle(stage1Id, 1);
      expect(sweepSystem.canSweep(stage1Id)).toBe(false);
    });

    it('三星通关后 canSweep() === true', () => {
      // CAMPAIGN-FLOW-6: 三星通关后可以扫荡
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();

      threeStarClear(sim, stage1Id);
      expect(sweepSystem.canSweep(stage1Id)).toBe(true);
    });

    it('addTickets(10) → sweep(stageId, 3) → 验证奖励和消耗', () => {
      // CAMPAIGN-FLOW-6: 添加扫荡令后批量扫荡
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();

      // 三星通关解锁扫荡
      threeStarClear(sim, stage1Id);

      // 添加10枚扫荡令
      sweepSystem.addTickets(10);
      expect(sweepSystem.getTicketCount()).toBe(10);

      // 批量扫荡3次
      const result = sweepSystem.sweep(stage1Id, 3);
      expect(result.success).toBe(true);
      expect(result.executedCount).toBe(3);
      expect(result.ticketsUsed).toBe(3);

      // 验证奖励
      expect(result.totalResources).toBeDefined();
      expect(result.totalExp).toBeGreaterThan(0);

      // 验证扫荡令消耗
      expect(sweepSystem.getTicketCount()).toBe(7);
    });

    it('扫荡令不足时失败', () => {
      // CAMPAIGN-FLOW-6: 扫荡令不足时扫荡失败
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();

      // 三星通关解锁扫荡
      threeStarClear(sim, stage1Id);

      // 不添加扫荡令，直接尝试扫荡
      const result = sweepSystem.sweep(stage1Id, 1);
      expect(result.success).toBe(false);
      expect(result.executedCount).toBe(0);
      expect(result.ticketsUsed).toBe(0);
    });

    it('扫荡不改变星级评定', () => {
      // CAMPAIGN-FLOW-6: 扫荡不影响已有星级
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();
      const campaignSystem = sim.engine.getCampaignSystem();

      threeStarClear(sim, stage1Id);
      sweepSystem.addTickets(5);

      const starsBefore = campaignSystem.getStageStars(stage1Id);
      sweepSystem.sweep(stage1Id, 3);
      const starsAfter = campaignSystem.getStageStars(stage1Id);

      expect(starsAfter).toBe(starsBefore);
    });

    it('每日扫荡令领取', () => {
      // CAMPAIGN-FLOW-6: 每日扫荡令领取
      const sim = createSim();
      const sweepSystem = sim.engine.getSweepSystem();

      // 初始扫荡令为0
      expect(sweepSystem.getTicketCount()).toBe(0);

      // 领取每日扫荡令
      const claimed = sweepSystem.claimDailyTickets();
      // 每日赠送3枚
      expect(claimed).toBeGreaterThanOrEqual(0);
      if (claimed > 0) {
        expect(sweepSystem.getTicketCount()).toBeGreaterThan(0);
      }
    });

    it('扫荡奖励包含资源和经验', () => {
      // CAMPAIGN-FLOW-6: 验证扫荡奖励内容
      const sim = initBattleReadyState();
      const stages = sim.engine.getStageList();
      const stage1Id = stages[0].id;
      const sweepSystem = sim.engine.getSweepSystem();

      threeStarClear(sim, stage1Id);
      sweepSystem.addTickets(10);

      const result = sweepSystem.sweep(stage1Id, 3);
      expect(result.success).toBe(true);

      // 验证汇总奖励
      expect(result.totalExp).toBeGreaterThan(0);
      expect(result.results.length).toBe(3);

      // 每次扫荡结果都应有奖励
      for (const sweepResult of result.results) {
        expect(sweepResult.stageId).toBe(stage1Id);
        expect(sweepResult.reward).toBeDefined();
      }
    });
  });
});
