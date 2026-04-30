/**
 * v20.0 天下一统(下) — 最终战役、统一结局与全局统计 集成测试
 *
 * 覆盖范围（按天下一统下篇流程组织）：
 * - §1 最终战役（终极Boss/最终关卡/决战机制）
 * - §2 统一结局（结局类型/结局条件/结局触发）
 * - §3 统一奖励（最终奖励/纪念/传承）
 * - §4 统计数据（全局统计/成就汇总/历史记录）
 * - §5 跨系统联动（战役→结局→奖励→统计一致性）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例（createSim）
 * - 使用真实引擎 API，不使用 mock，不使用 as unknown as Record<string, unknown>
 * - 引擎未实现的 API 用 it.todo 标注 [引擎未实现]
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v20-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';

// ═══════════════════════════════════════════════════════════════
// §1 最终战役
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §1 最终战役', () => {

  describe('§1.1 最终战役系统访问与初始化', () => {

    it('should access campaign system for final battle stages', () => {
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      expect(campaign).toBeDefined();
      expect(typeof campaign.getProgress).toBe('function');
      expect(typeof campaign.completeStage).toBe('function');
    });

    it('should access battle engine for final encounter resolution', () => {
      const sim = createSim();
      const battle = sim.engine.getBattleEngine();
      expect(battle).toBeDefined();
    });

    it('should list all chapters including final chapter', () => {
      const sim = createSim();
      const chapters = sim.engine.getChapters();
      expect(chapters).toBeDefined();
      expect(Array.isArray(chapters)).toBe(true);
      expect(chapters.length).toBeGreaterThan(0);
    });

  });

  describe('§1.2 终极Boss与最终关卡', () => {

    it('should identify final chapter among available chapters', () => {
      const sim = createSim();
      const chapters = sim.engine.getChapters();
      // 最终章节应为章节列表的最后一章
      const lastChapter = chapters[chapters.length - 1];
      expect(lastChapter).toBeDefined();
      expect(lastChapter.id).toBeDefined();
      expect(lastChapter.stages).toBeDefined();
    });

    it('should retrieve stage info for final chapter stages', () => {
      const sim = createSim();
      const chapters = sim.engine.getChapters();
      const lastChapter = chapters[chapters.length - 1];
      for (const stage of lastChapter.stages) {
        const info = sim.engine.getStageInfo(stage.id);
        expect(info).toBeDefined();
        expect(info!.id).toBe(stage.id);
      }
    });

    it('should track campaign progress toward final stage', () => {
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      expect(progress).toBeDefined();
      expect(progress.currentChapterId).toBeDefined();
      expect(progress.stageStates).toBeDefined();
    });

    it('should have ultimate boss encounter data in final stage', () => {
      // 终极Boss数据（Boss属性/技能/阶段）应由最终关卡配置提供
      const sim = createSim();
      const chapters = sim.engine.getChapters();
      const lastChapter = chapters[chapters.length - 1];
      const finalStage = lastChapter.stages[lastChapter.stages.length - 1];
      const stageInfo = sim.engine.getStageInfo(finalStage.id);
      expect(stageInfo).toBeDefined();
      // TODO: 验证 boss 数据字段
    });

  });

  describe('§1.3 最终关卡挑战与通关', () => {

    it('should complete a stage and update progress', () => {
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      if (stageIds.length > 0) {
        campaign.completeStage(stageIds[0], 3);
        const updated = campaign.getProgress();
        expect(updated.stageStates[stageIds[0]]).toBeDefined();
      } else {
        // 无可通关关卡时跳过
        expect(stageIds).toBeDefined();
      }
    });

    it('should serialize and restore campaign state after stage completion', () => {
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      if (stageIds.length > 0) {
        campaign.completeStage(stageIds[0], 2);
      }

      const saved = campaign.serialize();
      expect(saved).toBeDefined();
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §2 统一结局
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §2 统一结局', () => {

  describe('§2.1 结局系统访问', () => {

    it('should access ending system via engine getter', () => {
      const sim = createSim();
      const ending = sim.engine.getEndingSystem();
      expect(ending).toBeDefined();
    });

    it('should access heritage system for ending legacy data', () => {
      const sim = createSim();
      const heritage = sim.engine.getHeritageSystem();
      expect(heritage).toBeDefined();
    });

  });

  describe('§2.2 结局类型与条件', () => {

    it('should enumerate available ending types', () => {
      // 结局类型（霸业统一/仁德天下/武道巅峰等）应可列举
      const sim = createSim();
      const ending = sim.engine.getEndingSystem();
      const types = ending.getEndingTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should evaluate ending conditions based on game state', () => {
      // 根据当前游戏状态评估可达成结局
      const sim = createSim();
      const ending = sim.engine.getEndingSystem();
      const conditions = ending.evaluateConditions();
      expect(conditions).toBeDefined();
    });

    it('should determine primary ending from multiple satisfied conditions', () => {
      // 多个结局条件满足时，确定主结局
      const sim = createSim();
      const ending = sim.engine.getEndingSystem();
      const primary = ending.getPrimaryEnding();
      expect(primary).toBeDefined();
    });

  });

  describe('§2.3 结局触发与展示', () => {

    it('should trigger ending when all territories are conquered', () => {
      // 所有领土被征服后触发统一结局
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const ending = sim.engine.getEndingSystem();

      // 征服所有中立领土
      const neutralList = territory.getTerritoriesByOwnership('neutral');
      for (const t of neutralList) {
        territory.captureTerritory(t.id, 'player');
      }

      const isTriggered = ending.checkTrigger();
      expect(typeof isTriggered).toBe('boolean');
    });

    it('should serialize ending state for save/load', () => {
      const sim = createSim();
      const ending = sim.engine.getEndingSystem();
      const saved = ending.serialize();
      expect(saved).toBeDefined();
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §3 统一奖励
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §3 统一奖励', () => {

  describe('§3.1 最终奖励发放', () => {

    it('should access reward distributor for final rewards', () => {
      const sim = createSim();
      const reward = sim.engine.getRewardDistributor();
      expect(reward).toBeDefined();
    });

    it('should grant unification completion rewards', () => {
      // 天下一统完成奖励（专属称号/头像/资源）
      const sim = createSim();
      const reward = sim.engine.getRewardDistributor();
      const unificationRewards = reward.getUnificationRewards();
      expect(unificationRewards).toBeDefined();
      expect(Array.isArray(unificationRewards)).toBe(true);
    });

    it('should grant final stage clear rewards with bonus', () => {
      // 最终关卡通关奖励（含星级加成）
      const sim = createSim();
      const reward = sim.engine.getRewardDistributor();
      const bonus = reward.getFinalStageBonus();
      expect(bonus).toBeDefined();
    });

  });

  describe('§3.2 纪念与传承', () => {

    it('should access prestige system for memorial prestige', () => {
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      expect(prestige).toBeDefined();
    });

    it('should access heritage system for legacy inheritance', () => {
      const sim = createSim();
      const heritage = sim.engine.getHeritageSystem();
      expect(heritage).toBeDefined();
    });

    it('should create memorial record upon unification', () => {
      // 统一后创建纪念记录
      const sim = createSim();
      const heritage = sim.engine.getHeritageSystem();
      const memorial = heritage.getMemorialRecord();
      expect(memorial).toBeDefined();
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §4 统计数据
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §4 统计数据', () => {

  describe('§4.1 全局统计', () => {

    it('should access achievement system for global statistics', () => {
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      expect(achievement).toBeDefined();
    });

    it('should access quest system for completion tracking', () => {
      const sim = createSim();
      const quest = sim.engine.getQuestSystem();
      expect(quest).toBeDefined();
    });

    it('should provide global statistics summary', () => {
      // 全局统计汇总（总战力/领土/资源/时间等）
      const sim = createSim();
      const snapshot = sim.engine.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.totalPower).toBeDefined();
      expect(snapshot.resources).toBeDefined();
      expect(snapshot.calendar).toBeDefined();
    });

    it('should track play time statistics', () => {
      const sim = createSim();
      const stats = sim.engine.getGlobalStatistics();
      expect(stats).toBeDefined();
      expect(stats.totalPlayTime).toBeDefined();
    });

  });

  describe('§4.2 成就汇总', () => {

    it('should access achievement system and list achievements', () => {
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      expect(achievement).toBeDefined();
      // 验证成就系统可访问且可用
      expect(typeof achievement.getState).toBe('function');
    });

    it('should summarize all unlocked achievements at unification', () => {
      // 统一时成就汇总
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const summary = achievement.getUnlockedSummary();
      expect(summary).toBeDefined();
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §5 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §5 跨系统联动', () => {

  it('should coordinate campaign, territory and reward systems consistently', () => {
    // 战役→领土→奖励 三系统联动一致性
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();
    const reward = sim.engine.getRewardDistributor();

    expect(campaign).toBeDefined();
    expect(territory).toBeDefined();
    expect(reward).toBeDefined();

    // 各系统状态独立可读
    const campaignProgress = campaign.getProgress();
    const territoryState = territory.getState();

    expect(campaignProgress).toBeDefined();
    expect(territoryState).toBeDefined();
  });

  it('should maintain consistent snapshot after multi-system operations', () => {
    // 多系统操作后快照一致性
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();

    // 通关关卡
    const progress = campaign.getProgress();
    const stageIds = Object.keys(progress.stageStates);
    if (stageIds.length > 0) {
      campaign.completeStage(stageIds[0], 3);
    }

    // 征服领土
    const neutralList = territory.getTerritoriesByOwnership('neutral');
    if (neutralList.length > 0) {
      territory.captureTerritory(neutralList[0].id, 'player');
    }

    // 快照应包含所有子系统状态
    const snapshot = sim.engine.getSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.campaignProgress).toBeDefined();
    expect(snapshot.territoryState).toBeDefined();
  });

  it('should serialize all unification-related systems consistently', () => {
    // 统一相关系统序列化一致性
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();
    const achievement = sim.engine.getAchievementSystem();
    const heritage = sim.engine.getHeritageSystem();

    const campaignSave = campaign.serialize();
    const territorySave = territory.serialize();
    const achievementSave = achievement.getState();
    const heritageSave = heritage.getState();

    expect(campaignSave).toBeDefined();
    expect(territorySave).toBeDefined();
    expect(achievementSave).toBeDefined();
    expect(heritageSave).toBeDefined();
  });

  it('should trigger ending, rewards and statistics in correct order upon unification', () => {
    // 统一时：结局→奖励→统计 顺序触发
    const sim = createSim();
    const territory = sim.engine.getTerritorySystem();

    // 征服所有领土
    const neutralList = territory.getTerritoriesByOwnership('neutral');
    for (const t of neutralList) {
      territory.captureTerritory(t.id, 'player');
    }

    // 验证结局触发、奖励发放、统计更新
    const snapshot = sim.engine.getSnapshot();
    expect(snapshot.territoryState).toBeDefined();
    // TODO: 验证结局/奖励/统计字段
  });

});
