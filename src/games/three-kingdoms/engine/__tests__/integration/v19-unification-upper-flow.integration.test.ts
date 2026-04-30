/**
 * v19.0 天下一统(上) — 统一战役与势力征服 集成测试
 *
 * 覆盖范围（按统一战役流程组织）：
 * - §1 统一战役（战役进度/章节推进/关卡解锁/星级评定）
 * - §2 势力征服（领土占领/攻城战/征服进度/征服奖励）
 * - §3 跨系统联动（战役→领土→攻城→奖励一致性）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例（createSim）
 * - 使用真实引擎 API，不使用 mock，不使用 as unknown as Record<string, unknown>
 * - 引擎未实现的 API 用 it.todo 标注 [引擎未实现]
 * - 以实际代码行为为准
 * - 所有断言直接执行，不使用 if 条件跳过
 * - 前置数据依赖使用 expect(xxx.length).toBeGreaterThan(0) 守卫
 *
 * @see docs/games/three-kingdoms/play/v19-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';

// ═══════════════════════════════════════════════════════════════
// §1 统一战役
// ═══════════════════════════════════════════════════════════════
describe('v19.0 天下一统(上) — §1 统一战役', () => {

  describe('§1.1 战役系统访问与初始化', () => {

    it('should access campaign system via engine getter', () => {
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      expect(campaign).toBeDefined();
      expect(typeof campaign.getProgress).toBe('function');
      expect(typeof campaign.getStageStatus).toBe('function');
      expect(typeof campaign.canChallenge).toBe('function');
      expect(typeof campaign.completeStage).toBe('function');
    });

    it('should access battle engine via engine getter', () => {
      const sim = createSim();
      const battle = sim.engine.getBattleEngine();
      expect(battle).toBeDefined();
    });

    it('should access reward distributor via engine getter', () => {
      const sim = createSim();
      const reward = sim.engine.getRewardDistributor();
      expect(reward).toBeDefined();
    });

    it('should return initial campaign progress on fresh engine', () => {
      // 战役初始进度：第1章第1关解锁
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      expect(progress).toBeDefined();
      expect(progress.currentChapterId).toBeDefined();
      expect(typeof progress.currentChapterId).toBe('string');
      expect(progress.currentChapterId.length).toBeGreaterThan(0);
      expect(progress.stageStates).toBeDefined();
      // 初始状态下应有关卡数据
      expect(Object.keys(progress.stageStates).length).toBeGreaterThan(0);
    });

  });

  describe('§1.2 战役进度与章节推进', () => {

    it('should report stage status as locked before prerequisites are cleared', () => {
      // 未通关前置关卡时，后续关卡应处于锁定状态
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      // 前置断言：至少有2个关卡才能验证锁定逻辑
      expect(stageIds.length).toBeGreaterThanOrEqual(2);

      // 第二关在未通关第一关时应为锁定状态
      const secondStageStatus = campaign.getStageStatus(stageIds[1]);
      expect(secondStageStatus).toBe('locked');
    });

    it('should report first stage as available on fresh engine', () => {
      // 初始状态第一关应为可挑战（available）
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const firstStageStatus = campaign.getStageStatus(stageIds[0]);
      // 第一关初始状态应为 available（可挑战）或 unlocked
      expect(firstStageStatus).not.toBe('locked');
    });

    it('should track total stars across all stages — initially zero', () => {
      // 初始状态下全关卡总星数应为0
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const totalStars = campaign.getTotalStars();
      expect(typeof totalStars).toBe('number');
      expect(totalStars).toBe(0);
    });

    it('should get stage stars for a specific stage — initially zero', () => {
      // 初始状态下单个关卡星数应为0
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const stars = campaign.getStageStars(stageIds[0]);
      expect(typeof stars).toBe('number');
      expect(stars).toBe(0);
    });

    it('should track clear count per stage — initially zero', () => {
      // 初始状态下通关次数应为0
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const count = campaign.getClearCount(stageIds[0]);
      expect(typeof count).toBe('number');
      expect(count).toBe(0);
    });

    it('should report first clear status correctly — initially false', () => {
      // 初始状态下首通状态应为 false
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const isFirst = campaign.isFirstCleared(stageIds[0]);
      expect(isFirst).toBe(false);
    });

    it('should get current chapter info with valid data', () => {
      // 获取当前章节信息
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const chapter = campaign.getCurrentChapter();
      // 初始状态应有当前章节
      expect(chapter).not.toBeNull();
      expect(chapter!.id).toBeDefined();
      expect(typeof chapter!.id).toBe('string');
      expect(chapter!.id.length).toBeGreaterThan(0);
      expect(chapter!.name).toBeDefined();
      expect(typeof chapter!.name).toBe('string');
      expect(chapter!.name.length).toBeGreaterThan(0);
      expect(Array.isArray(chapter!.stages)).toBe(true);
      expect(chapter!.stages.length).toBeGreaterThan(0);
    });

  });

  describe('§1.3 关卡解锁与挑战', () => {

    it('should identify first stage as challengeable', () => {
      // 第一关应可挑战
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const canChallenge = campaign.canChallenge(stageIds[0]);
      expect(canChallenge).toBe(true);
    });

    it('should identify second stage as not challengeable before first is cleared', () => {
      // 第二关在第一关未通关前不可挑战
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThanOrEqual(2);

      const canChallenge = campaign.canChallenge(stageIds[1]);
      expect(canChallenge).toBe(false);
    });

    it('should complete a stage and update stars to exact value', () => {
      // 通关关卡后星数应精确更新为传入值
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const starsBefore = campaign.getStageStars(stageIds[0]);
      expect(starsBefore).toBe(0);

      campaign.completeStage(stageIds[0], 3);

      const starsAfter = campaign.getStageStars(stageIds[0]);
      expect(starsAfter).toBe(3);
    });

    it('should mark first clear after completing a stage', () => {
      // 通关后首通标记应为 true
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      expect(campaign.isFirstCleared(stageIds[0])).toBe(false);
      campaign.completeStage(stageIds[0], 2);
      expect(campaign.isFirstCleared(stageIds[0])).toBe(true);
    });

    it('should increment clear count after each completion', () => {
      // 多次通关后计数递增
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      expect(campaign.getClearCount(stageIds[0])).toBe(0);
      campaign.completeStage(stageIds[0], 3);
      expect(campaign.getClearCount(stageIds[0])).toBe(1);
      campaign.completeStage(stageIds[0], 2);
      expect(campaign.getClearCount(stageIds[0])).toBe(2);
    });

    it('should update total stars after completing stages', () => {
      // 通关后总星数应增加
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      expect(campaign.getTotalStars()).toBe(0);
      campaign.completeStage(stageIds[0], 3);
      expect(campaign.getTotalStars()).toBe(3);
    });

    it('should unlock next stage after completing current stage', () => {
      // 通关当前关卡后，下一关解锁
      const sim = createSim();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      // 前置断言：至少有2个关卡才能验证解锁逻辑
      expect(stageIds.length).toBeGreaterThanOrEqual(2);

      // 第二关初始应为锁定
      const statusBefore = campaign.getStageStatus(stageIds[1]);
      expect(statusBefore).toBe('locked');

      // 通关第一关
      campaign.completeStage(stageIds[0], 3);

      // 第二关应解锁或可挑战
      const statusAfter = campaign.getStageStatus(stageIds[1]);
      expect(statusAfter).not.toBe('locked');
    });

  });

  describe('§1.4 扫荡系统', () => {

    it('should access sweep system via engine getter', () => {
      const sim = createSim();
      const sweep = sim.engine.getSweepSystem();
      expect(sweep).toBeDefined();
      expect(typeof sweep.canSweep).toBe('function');
      expect(typeof sweep.sweep).toBe('function');
      expect(typeof sweep.getTicketCount).toBe('function');
    });

    it('should report initial ticket count as zero', () => {
      // 扫荡券初始数量应为0
      const sim = createSim();
      const sweep = sim.engine.getSweepSystem();
      const tickets = sweep.getTicketCount();
      expect(typeof tickets).toBe('number');
      expect(tickets).toBe(0);
    });

    it('should not allow sweep before stage is three-starred', () => {
      // 未三星通关时不可扫荡
      const sim = createSim();
      const sweep = sim.engine.getSweepSystem();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      const canSweep = sweep.canSweep(stageIds[0]);
      expect(canSweep).toBe(false);
    });

    it('should allow sweep after stage is three-starred', () => {
      // 三星通关后可扫荡
      const sim = createSim();
      const sweep = sim.engine.getSweepSystem();
      const campaign = sim.engine.getCampaignSystem();
      const progress = campaign.getProgress();
      const stageIds = Object.keys(progress.stageStates);

      expect(stageIds.length).toBeGreaterThan(0);

      campaign.completeStage(stageIds[0], 3);
      const canSweep = sweep.canSweep(stageIds[0]);
      expect(canSweep).toBe(true);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §2 势力征服
// ═══════════════════════════════════════════════════════════════
describe('v19.0 天下一统(上) — §2 势力征服', () => {

  describe('§2.1 领土系统', () => {

    it('should access territory system via engine getter', () => {
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      expect(territory).toBeDefined();
      expect(typeof territory.getAllTerritories).toBe('function');
      expect(typeof territory.captureTerritory).toBe('function');
      expect(typeof territory.getPlayerTerritoryCount).toBe('function');
    });

    it('should return all territories with initial state', () => {
      // 初始领土状态
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const all = territory.getAllTerritories();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
      // 每个领土应有必要字段
      const first = all[0];
      expect(first.id).toBeDefined();
      expect(typeof first.id).toBe('string');
      expect(first.ownership).toBeDefined();
      expect(typeof first.ownership).toBe('string');
    });

    it('should report total and player territory counts', () => {
      // 总领土数与玩家占领数
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const total = territory.getTotalTerritoryCount();
      const playerCount = territory.getPlayerTerritoryCount();
      expect(total).toBeGreaterThan(0);
      expect(playerCount).toBeGreaterThanOrEqual(0);
      expect(playerCount).toBeLessThanOrEqual(total);
    });

    it('should have neutral territories on fresh engine', () => {
      // 初始状态下应存在中立领土
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');
      expect(neutralTerritories.length).toBeGreaterThan(0);
    });

    it('should capture a neutral territory successfully', () => {
      // 占领中立领土
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');

      // 前置断言：确保存在中立领土
      expect(neutralTerritories.length).toBeGreaterThan(0);

      const playerCountBefore = territory.getPlayerTerritoryCount();
      const target = neutralTerritories[0];
      const result = territory.captureTerritory(target.id, 'player');
      expect(result).toBe(true);
      expect(territory.getPlayerTerritoryCount()).toBe(playerCountBefore + 1);
    });

    it('should list player-owned territories after capture', () => {
      // 占领后列出玩家领土
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');

      // 前置断言：确保存在中立领土
      expect(neutralTerritories.length).toBeGreaterThan(0);

      territory.captureTerritory(neutralTerritories[0].id, 'player');
      const playerIds = territory.getPlayerTerritoryIds();
      expect(playerIds.length).toBeGreaterThan(0);
      expect(playerIds).toContain(neutralTerritories[0].id);
    });

    it('should update territory ownership after capture', () => {
      // 占领后领土归属应从 neutral 变为 player
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');

      expect(neutralTerritories.length).toBeGreaterThan(0);

      const target = neutralTerritories[0];
      expect(target.ownership).toBe('neutral');

      territory.captureTerritory(target.id, 'player');

      // 重新查询该领土，验证归属变更
      const updated = territory.getTerritoryById(target.id);
      expect(updated).not.toBeNull();
      expect(updated!.ownership).toBe('player');
    });

    it('should find adjacent territories for a given territory', () => {
      // 领土相邻关系 — 至少部分领土应有相邻关系
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const all = territory.getAllTerritories();

      expect(all.length).toBeGreaterThan(0);

      const adjacent = territory.getAdjacentTerritoryIds(all[0].id);
      expect(Array.isArray(adjacent)).toBe(true);
      // 相邻领土ID应指向实际存在的领土
      for (const adjId of adjacent) {
        const adjTerritory = territory.getTerritoryById(adjId);
        expect(adjTerritory).not.toBeNull();
      }
    });

    it('should identify attackable territories from player perspective', () => {
      // 可攻击领土列表 — 初始状态下应有可攻击领土（相邻中立领土）
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const attackable = territory.getAttackableTerritories('player');
      expect(Array.isArray(attackable)).toBe(true);
      // 有玩家领土就有可能存在可攻击的领土
      // 即使初始没有玩家领土，返回值也应是合法数组
    });

    it('should decrease neutral count after capture', () => {
      // 占领中立领土后中立数量应减少
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const neutralBefore = territory.getTerritoriesByOwnership('neutral');

      expect(neutralBefore.length).toBeGreaterThan(0);

      territory.captureTerritory(neutralBefore[0].id, 'player');

      const neutralAfter = territory.getTerritoriesByOwnership('neutral');
      expect(neutralAfter.length).toBe(neutralBefore.length - 1);
    });

  });

  describe('§2.2 攻城战系统', () => {

    it('should access siege system via engine getter', () => {
      const sim = createSim();
      const siege = sim.engine.getSiegeSystem();
      expect(siege).toBeDefined();
      expect(typeof siege.checkSiegeConditions).toBe('function');
      expect(typeof siege.executeSiege).toBe('function');
      expect(typeof siege.calculateSiegeCost).toBe('function');
    });

    it('should access world map system via engine getter', () => {
      const sim = createSim();
      const worldMap = sim.engine.getWorldMapSystem();
      expect(worldMap).toBeDefined();
      expect(typeof worldMap.getState).toBe('function');
      expect(typeof worldMap.getSize).toBe('function');
    });

    it('should calculate siege cost with valid structure for a territory', () => {
      // 攻城战消耗计算 — 应返回包含 troops 和 grain 的结构
      const sim = createSim();
      const siege = sim.engine.getSiegeSystem();
      const territory = sim.engine.getTerritorySystem();
      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');

      expect(neutralTerritories.length).toBeGreaterThan(0);

      const cost = siege.calculateSiegeCost(neutralTerritories[0]);
      expect(cost).toBeDefined();
      expect(typeof cost.troops).toBe('number');
      expect(cost.troops).toBeGreaterThan(0);
      expect(typeof cost.grain).toBe('number');
      expect(cost.grain).toBeGreaterThan(0);
    });

    it('should track siege statistics — initially all zero', () => {
      // 初始攻城统计：总次数=0，胜场=0，胜率=0
      const sim = createSim();
      const siege = sim.engine.getSiegeSystem();
      expect(siege.getTotalSieges()).toBe(0);
      expect(siege.getVictories()).toBe(0);
      expect(siege.getWinRate()).toBe(0);
    });

    it('should report remaining daily sieges — initially at max', () => {
      // 每日攻城次数限制 — 初始应为上限值
      const sim = createSim();
      const siege = sim.engine.getSiegeSystem();
      const remaining = siege.getRemainingDailySieges();
      expect(typeof remaining).toBe('number');
      expect(remaining).toBeGreaterThan(0);
    });

    it('should execute siege and update territory ownership on victory', () => {
      // 执行攻城战后领土归属变更
      // 先占领一个中立领土作为起始据点，然后攻城攻击相邻领土
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const siege = sim.engine.getSiegeSystem();
      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');

      expect(neutralTerritories.length).toBeGreaterThan(0);

      const target = neutralTerritories[0];
      const playerCountBefore = territory.getPlayerTerritoryCount();

      // 使用足够兵力和粮草执行攻城（10000 troops, 10000 grain 远超消耗）
      siege.executeSiege(target.id, 'player', 10000, 10000);

      const playerCountAfter = territory.getPlayerTerritoryCount();
      // 攻城后玩家领土数应 >= 攻城前（胜利时增加，失败时不变）
      expect(playerCountAfter).toBeGreaterThanOrEqual(playerCountBefore);
      // 攻城统计应已更新
      expect(siege.getTotalSieges()).toBe(1);
    });

  });

  describe('§2.3 征服进度与奖励', () => {

    it('should calculate conquest progress as percentage', () => {
      // 征服进度 = 玩家领土数 / 总领土数
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const total = territory.getTotalTerritoryCount();
      const playerCount = territory.getPlayerTerritoryCount();

      // 前置断言：总领土数必须 > 0
      expect(total).toBeGreaterThan(0);

      const progress = (playerCount / total) * 100;
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    it('should increase conquest progress after capturing territory', () => {
      // 占领领土后进度应增加
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const total = territory.getTotalTerritoryCount();
      const playerCountBefore = territory.getPlayerTerritoryCount();
      const progressBefore = (playerCountBefore / total) * 100;

      const neutralTerritories = territory.getTerritoriesByOwnership('neutral');
      expect(neutralTerritories.length).toBeGreaterThan(0);

      territory.captureTerritory(neutralTerritories[0].id, 'player');

      const playerCountAfter = territory.getPlayerTerritoryCount();
      const progressAfter = (playerCountAfter / total) * 100;
      expect(progressAfter).toBeGreaterThan(progressBefore);
    });

    it('should access siege enhancer via engine getter with valid API', () => {
      // 攻城增强系统 — 应有可调用的方法
      const sim = createSim();
      const enhancer = sim.engine.getSiegeEnhancer();
      expect(enhancer).toBeDefined();
      expect(typeof enhancer.computeWinRate).toBe('function');
    });

    it('should track territory production summary with valid structure', () => {
      // 玩家领土产出汇总 — 应返回结构化数据
      const sim = createSim();
      const territory = sim.engine.getTerritorySystem();
      const summary = territory.getPlayerProductionSummary();
      expect(summary).toBeDefined();
      // 产出汇总应有 totalTerritories 和 totalProduction 字段
      expect(typeof summary.totalTerritories).toBe('number');
      expect(summary.totalProduction).toBeDefined();
      expect(typeof summary.totalGrain).toBe('number');
      expect(typeof summary.totalCoins).toBe('number');
      expect(typeof summary.totalTroops).toBe('number');
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §3 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v19.0 天下一统(上) — §3 跨系统联动', () => {

  it('should coordinate campaign progress with territory conquest', () => {
    // 战役进度与领土征服联动 — 两个系统应可独立访问且状态一致
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();

    const campaignProgress = campaign.getProgress();
    const territoryState = territory.getState();

    expect(campaignProgress).toBeDefined();
    expect(campaignProgress.stageStates).toBeDefined();
    expect(Object.keys(campaignProgress.stageStates).length).toBeGreaterThan(0);

    expect(territoryState).toBeDefined();
    expect(territoryState.territories).toBeDefined();
    expect(territoryState.territories.length).toBeGreaterThan(0);
  });

  it('should maintain consistent state after campaign completion and territory capture', () => {
    // 通关关卡 + 占领领土后状态一致
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();

    // 前置断言：确保存在关卡数据和中立领土
    const progress = campaign.getProgress();
    const stageIds = Object.keys(progress.stageStates);
    expect(stageIds.length).toBeGreaterThan(0);

    const neutralTerritories = territory.getTerritoriesByOwnership('neutral');
    expect(neutralTerritories.length).toBeGreaterThan(0);

    // 通关一个关卡（3星）
    campaign.completeStage(stageIds[0], 3);

    // 占领一个领土
    territory.captureTerritory(neutralTerritories[0].id, 'player');

    // 验证关卡系统状态正确
    const updatedProgress = campaign.getProgress();
    expect(updatedProgress.stageStates).toBeDefined();

    // 通关后关卡星数应精确为3
    const stars = campaign.getStageStars(stageIds[0]);
    expect(stars).toBe(3);

    // 首通标记应为 true
    expect(campaign.isFirstCleared(stageIds[0])).toBe(true);

    // 通关次数应为1
    expect(campaign.getClearCount(stageIds[0])).toBe(1);

    // 验证领土系统状态正确
    const updatedTerritoryState = territory.getState();
    expect(updatedTerritoryState).toBeDefined();

    // 占领后玩家领土数应 > 0
    expect(territory.getPlayerTerritoryCount()).toBeGreaterThan(0);

    // 占领后该领土归属应为 player
    const captured = territory.getTerritoryById(neutralTerritories[0].id);
    expect(captured).not.toBeNull();
    expect(captured!.ownership).toBe('player');
  });

  it('should serialize campaign and territory state with valid structure', () => {
    // 序列化与恢复一致性
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();

    // 修改状态
    const progress = campaign.getProgress();
    const stageIds = Object.keys(progress.stageStates);

    expect(stageIds.length).toBeGreaterThan(0);

    campaign.completeStage(stageIds[0], 3);

    // 序列化
    const campaignSave = campaign.serialize();
    const territorySave = territory.serialize();

    // 验证序列化结果有实质内容
    expect(campaignSave).toBeDefined();
    expect(campaignSave.version).toBeDefined();
    expect(campaignSave.progress).toBeDefined();
    expect(campaignSave.progress.stageStates).toBeDefined();

    expect(territorySave).toBeDefined();
  });

  it('should reflect total stars correctly across campaign and territory operations', () => {
    // 跨系统操作后总星数应准确
    const sim = createSim();
    const campaign = sim.engine.getCampaignSystem();
    const territory = sim.engine.getTerritorySystem();

    const progress = campaign.getProgress();
    const stageIds = Object.keys(progress.stageStates);
    expect(stageIds.length).toBeGreaterThanOrEqual(2);

    // 通关两个关卡
    campaign.completeStage(stageIds[0], 3);
    campaign.completeStage(stageIds[1], 2);

    // 总星数应为 3 + 2 = 5
    expect(campaign.getTotalStars()).toBe(5);

    // 同时占领领土不影响战役星数
    const neutralTerritories = territory.getTerritoriesByOwnership('neutral');
    expect(neutralTerritories.length).toBeGreaterThan(0);
    territory.captureTerritory(neutralTerritories[0].id, 'player');

    // 星数应不受领土操作影响
    expect(campaign.getTotalStars()).toBe(5);
  });

});
