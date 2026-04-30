/**
 * engine-getters 测试
 *
 * 验证 applyGetters() Mixin 模式：
 *   - 混入方法后 getter 方法可用
 *   - 各类 getter 返回正确的子系统引用
 *   - API 方法（recruit/levelUp/buildTeamsForStage等）正确代理
 *
 * 注意：engine-getters 使用 Mixin 模式混入原型方法，
 * 测试通过创建模拟类来验证混入效果。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyGetters } from '../engine-getters';

// ─────────────────────────────────────────────
// 创建模拟引擎类
// ─────────────────────────────────────────────

function createMockEngine(): any {
  class MockEngine {}
  applyGetters(MockEngine);

  const hero = { name: 'hero' };
  const heroRecruit = {
    name: 'heroRecruit',
    recruitSingle: vi.fn().mockReturnValue({ generals: [] }),
    recruitTen: vi.fn().mockReturnValue({ generals: [] }),
    freeRecruitSingle: vi.fn().mockReturnValue({ generals: [] }),
    canFreeRecruit: vi.fn().mockReturnValue(true),
    getUpManager: vi.fn().mockReturnValue({ name: 'upManager' }),
  };
  const heroLevel = {
    name: 'heroLevel',
    levelUp: vi.fn().mockReturnValue({ success: true }),
    batchEnhance: vi.fn().mockReturnValue({ results: [] }),
    getEnhancePreview: vi.fn().mockReturnValue({ totalCost: {} }),
  };
  const heroFormation = {
    name: 'heroFormation',
    getAllFormations: vi.fn().mockReturnValue([]),
    getActiveFormation: vi.fn().mockReturnValue(null),
    createFormation: vi.fn().mockReturnValue(null),
    setFormation: vi.fn().mockReturnValue(null),
    addToFormation: vi.fn().mockReturnValue(null),
    removeFromFormation: vi.fn().mockReturnValue(null),
  };
  const heroStarSystem = { name: 'heroStarSystem' };
  const skillUpgradeSystem = {
    name: 'skillUpgradeSystem',
    getStrategyRecommender: vi.fn().mockReturnValue({ name: 'strategyRecommender' }),
  };
  const bondSystem = { name: 'bondSystem' };
  const formationRecommendSystem = { name: 'formationRecommendSystem' };
  const heroDispatchSystem = { name: 'heroDispatchSystem' };
  const heroBadgeSystem = { name: 'heroBadgeSystem' };
  const heroAttributeCompare = { name: 'heroAttributeCompare' };
  const resource = { name: 'resource', getAmount: vi.fn().mockReturnValue(100) };
  const sweepSystem = { name: 'sweepSystem' };
  const vipSystem = { name: 'vipSystem' };
  const challengeStageSystem = { name: 'challengeStageSystem' };

  const campaignSystems = {
    campaignSystem: {
      isFirstCleared: vi.fn().mockReturnValue(false),
      completeStage: vi.fn(),
      getProgress: vi.fn().mockReturnValue({ currentChapterId: 'chapter1', stageStates: {}, lastClearTime: 0 }),
    },
    rewardDistributor: {
      calculateAndDistribute: vi.fn(),
    },
    battleEngine: {
      runFullBattle: vi.fn().mockReturnValue({ victory: true }),
    },
  };

  const techSystems = {
    treeSystem: { name: 'treeSystem', getState: vi.fn().mockReturnValue({}) },
    pointSystem: { name: 'pointSystem', getTechPointState: vi.fn().mockReturnValue({}) },
    researchSystem: {
      name: 'researchSystem',
      getQueue: vi.fn().mockReturnValue([]),
      startResearch: vi.fn().mockReturnValue({ success: true }),
      cancelResearch: vi.fn().mockReturnValue({ success: true }),
      speedUp: vi.fn().mockReturnValue({ success: true }),
    },
    fusionSystem: { name: 'fusionSystem' },
    linkSystem: { name: 'linkSystem' },
    offlineSystem: { name: 'offlineSystem' },
    detailProvider: { name: 'detailProvider' },
  };

  const mapSystems = {
    worldMap: { name: 'worldMap' },
    territory: { name: 'territory' },
    siege: { name: 'siege' },
    garrison: { name: 'garrison' },
    siegeEnhancer: { name: 'siegeEnhancer' },
    mapEvent: { name: 'mapEvent' },
  };

  const r11 = {
    mailSystem: { name: 'mailSystem' },
    mailTemplateSystem: { name: 'mailTemplateSystem' },
    shopSystem: { name: 'shopSystem' },
    currencySystem: { name: 'currencySystem' },
    npcSystem: { name: 'npcSystem' },
    equipmentSystem: { name: 'equipmentSystem' },
    equipmentForgeSystem: { name: 'equipmentForgeSystem' },
    equipmentEnhanceSystem: { name: 'equipmentEnhanceSystem' },
    equipmentSetSystem: { name: 'equipmentSetSystem' },
    equipmentRecommendSystem: { name: 'equipmentRecommendSystem' },
    arenaSystem: { name: 'arenaSystem' },
    arenaSeasonSystem: { name: 'arenaSeasonSystem' },
    rankingSystem: { name: 'rankingSystem' },
    pvpBattleSystem: { name: 'pvpBattleSystem' },
    defenseFormationSystem: { name: 'defenseFormationSystem' },
    arenaShopSystem: { name: 'arenaShopSystem' },
    expeditionSystem: { name: 'expeditionSystem' },
    allianceSystem: { name: 'allianceSystem' },
    allianceTaskSystem: { name: 'allianceTaskSystem' },
    allianceBossSystem: { name: 'allianceBossSystem' },
    allianceShopSystem: { name: 'allianceShopSystem' },
    prestigeSystem: { name: 'prestigeSystem' },
    prestigeShopSystem: { name: 'prestigeShopSystem' },
    rebirthSystem: { name: 'rebirthSystem' },
    questSystem: { name: 'questSystem' },
    achievementSystem: { name: 'achievementSystem' },
    friendSystem: { name: 'friendSystem' },
    chatSystem: { name: 'chatSystem' },
    socialLeaderboardSystem: { name: 'socialLeaderboardSystem' },
    heritageSystem: { name: 'heritageSystem' },
    timedActivitySystem: { name: 'timedActivitySystem' },
    advisorSystem: { name: 'advisorSystem' },
    activitySystem: { name: 'activitySystem' },
    signInSystem: { name: 'signInSystem' },
    tradeSystem: { name: 'tradeSystem' },
    caravanSystem: { name: 'caravanSystem' },
    resourceTradeEngine: { name: 'resourceTradeEngine' },
    settingsManager: { name: 'settingsManager' },
    accountSystem: { name: 'accountSystem' },
    endingSystem: { name: 'endingSystem' },
    globalStatisticsSystem: { name: 'globalStatisticsSystem', getSnapshot: vi.fn().mockReturnValue({}) },
  };

  const eventSystems = {
    trigger: { name: 'trigger' },
    notification: { name: 'notification' },
    uiNotification: { name: 'uiNotification' },
    chain: { name: 'chain' },
    log: { name: 'log' },
    offline: { name: 'offline' },
  };

  const offline = {
    offlineReward: { name: 'offlineReward' },
    offlineEstimate: { name: 'offlineEstimate' },
    offlineSnapshot: { name: 'offlineSnapshot' },
  };

  const guide = {
    tutorialStateMachine: { name: 'tutorialStateMachine' },
    storyEventPlayer: { name: 'storyEventPlayer' },
    tutorialStepManager: { name: 'tutorialStepManager' },
    tutorialStepExecutor: { name: 'tutorialStepExecutor' },
    tutorialMaskSystem: { name: 'tutorialMaskSystem' },
    tutorialStorage: { name: 'tutorialStorage' },
    firstLaunchDetector: { name: 'firstLaunchDetector' },
  };

  const engine = new MockEngine();
  Object.assign(engine, {
    hero,
    heroRecruit,
    heroLevel,
    heroFormation,
    heroStarSystem,
    skillUpgradeSystem,
    bondSystem,
    formationRecommendSystem,
    heroDispatchSystem,
    heroBadgeSystem,
    heroAttributeCompare,
    resource,
    sweepSystem,
    vipSystem,
    challengeStageSystem,
    campaignSystems,
    techSystems,
    mapSystems,
    r11,
    eventSystems,
    offline,
    guide,
  });

  return engine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('engine-getters applyGetters', () => {
  let engine: any;

  beforeEach(() => {
    engine = createMockEngine();
  });

  // ── 武将系统 getter ──

  describe('武将系统 getter', () => {
    it('getHeroSystem 返回 hero', () => {
      expect(engine.getHeroSystem()).toBe(engine.hero);
    });

    it('getRecruitSystem 返回 heroRecruit', () => {
      expect(engine.getRecruitSystem()).toBe(engine.heroRecruit);
    });

    it('getLevelSystem 返回 heroLevel', () => {
      expect(engine.getLevelSystem()).toBe(engine.heroLevel);
    });

    it('getFormationSystem 返回 heroFormation', () => {
      expect(engine.getFormationSystem()).toBe(engine.heroFormation);
    });

    it('getHeroStarSystem 返回 heroStarSystem', () => {
      expect(engine.getHeroStarSystem()).toBe(engine.heroStarSystem);
    });

    it('getSkillUpgradeSystem 返回 skillUpgradeSystem', () => {
      expect(engine.getSkillUpgradeSystem()).toBe(engine.skillUpgradeSystem);
    });

    it('getBondSystem 返回 bondSystem', () => {
      expect(engine.getBondSystem()).toBe(engine.bondSystem);
    });

    it('getSweepSystem 返回 sweepSystem', () => {
      expect(engine.getSweepSystem()).toBe(engine.sweepSystem);
    });

    it('getVIPSystem 返回 vipSystem', () => {
      expect(engine.getVIPSystem()).toBe(engine.vipSystem);
    });
  });

  // ── 资源 API ──

  describe('资源 API', () => {
    it('getResourceAmount 委托给 resource.getAmount', () => {
      const amount = engine.getResourceAmount('grain');
      expect(amount).toBe(100);
      expect(engine.resource.getAmount).toHaveBeenCalledWith('grain');
    });
  });

  // ── 阵型 API ──

  describe('阵型 API', () => {
    it('getFormations 委托给 heroFormation.getAllFormations', () => {
      engine.getFormations();
      expect(engine.heroFormation.getAllFormations).toHaveBeenCalled();
    });

    it('getActiveFormation 委托给 heroFormation.getActiveFormation', () => {
      engine.getActiveFormation();
      expect(engine.heroFormation.getActiveFormation).toHaveBeenCalled();
    });

    it('createFormation 委托给 heroFormation', () => {
      engine.createFormation('test');
      expect(engine.heroFormation.createFormation).toHaveBeenCalledWith('test');
    });

    it('setFormation 委托给 heroFormation', () => {
      engine.setFormation('id', ['g1']);
      expect(engine.heroFormation.setFormation).toHaveBeenCalledWith('id', ['g1']);
    });

    it('addToFormation 委托给 heroFormation', () => {
      engine.addToFormation('f1', 'g1');
      expect(engine.heroFormation.addToFormation).toHaveBeenCalledWith('f1', 'g1');
    });

    it('removeFromFormation 委托给 heroFormation', () => {
      engine.removeFromFormation('f1', 'g1');
      expect(engine.heroFormation.removeFromFormation).toHaveBeenCalledWith('f1', 'g1');
    });
  });

  // ── 招募 API ──

  describe('招募 API', () => {
    it('recruit(type, 1) 调用 recruitSingle', () => {
      engine.recruit('normal', 1);
      expect(engine.heroRecruit.recruitSingle).toHaveBeenCalledWith('normal');
    });

    it('recruit(type, 10) 调用 recruitTen', () => {
      engine.recruit('normal', 10);
      expect(engine.heroRecruit.recruitTen).toHaveBeenCalledWith('normal');
    });

    it('freeRecruit 委托给 heroRecruit', () => {
      engine.freeRecruit('normal');
      expect(engine.heroRecruit.freeRecruitSingle).toHaveBeenCalledWith('normal');
    });

    it('canFreeRecruit 委托给 heroRecruit', () => {
      const result = engine.canFreeRecruit('normal');
      expect(result).toBe(true);
    });
  });

  // ── R11 子系统 getter ──

  describe('R11 子系统 getter', () => {
    it('getMailSystem 返回 r11.mailSystem', () => {
      expect(engine.getMailSystem()).toBe(engine.r11.mailSystem);
    });

    it('getShopSystem 返回 r11.shopSystem', () => {
      expect(engine.getShopSystem()).toBe(engine.r11.shopSystem);
    });

    it('getCurrencySystem 返回 r11.currencySystem', () => {
      expect(engine.getCurrencySystem()).toBe(engine.r11.currencySystem);
    });

    it('getEquipmentSystem 返回 r11.equipmentSystem', () => {
      expect(engine.getEquipmentSystem()).toBe(engine.r11.equipmentSystem);
    });

    it('getArenaSystem 返回 r11.arenaSystem', () => {
      expect(engine.getArenaSystem()).toBe(engine.r11.arenaSystem);
    });

    it('getAllianceSystem 返回 r11.allianceSystem', () => {
      expect(engine.getAllianceSystem()).toBe(engine.r11.allianceSystem);
    });

    it('getPrestigeSystem 返回 r11.prestigeSystem', () => {
      expect(engine.getPrestigeSystem()).toBe(engine.r11.prestigeSystem);
    });

    it('getQuestSystem 返回 r11.questSystem', () => {
      expect(engine.getQuestSystem()).toBe(engine.r11.questSystem);
    });

    it('getAchievementSystem 返回 r11.achievementSystem', () => {
      expect(engine.getAchievementSystem()).toBe(engine.r11.achievementSystem);
    });

    it('getSettingsManager 返回 r11.settingsManager', () => {
      expect(engine.getSettingsManager()).toBe(engine.r11.settingsManager);
    });

    it('getAccountSystem 返回 r11.accountSystem', () => {
      expect(engine.getAccountSystem()).toBe(engine.r11.accountSystem);
    });

    it('getEndingSystem 返回 r11.endingSystem', () => {
      expect(engine.getEndingSystem()).toBe(engine.r11.endingSystem);
    });

    it('getGlobalStatisticsSystem 返回 r11.globalStatisticsSystem', () => {
      expect(engine.getGlobalStatisticsSystem()).toBe(engine.r11.globalStatisticsSystem);
    });

    it('getGlobalStatistics 返回快照', () => {
      engine.getGlobalStatistics();
      expect(engine.r11.globalStatisticsSystem.getSnapshot).toHaveBeenCalled();
    });
  });

  // ── 事件子系统 getter ──

  describe('事件子系统 getter', () => {
    it('getEventTriggerSystem 返回 eventSystems.trigger', () => {
      expect(engine.getEventTriggerSystem()).toBe(engine.eventSystems.trigger);
    });

    it('getEventUINotification 返回 eventSystems.uiNotification', () => {
      expect(engine.getEventUINotification()).toBe(engine.eventSystems.uiNotification);
    });

    it('getEventLogSystem 返回 eventSystems.log', () => {
      expect(engine.getEventLogSystem()).toBe(engine.eventSystems.log);
    });
  });

  // ── 离线子系统 getter ──

  describe('离线子系统 getter', () => {
    it('getOfflineRewardSystem 返回 offline.offlineReward', () => {
      expect(engine.getOfflineRewardSystem()).toBe(engine.offline.offlineReward);
    });

    it('getOfflineEstimateSystem 返回 offline.offlineEstimate', () => {
      expect(engine.getOfflineEstimateSystem()).toBe(engine.offline.offlineEstimate);
    });

    it('getOfflineSnapshotSystem 返回 offline.offlineSnapshot', () => {
      expect(engine.getOfflineSnapshotSystem()).toBe(engine.offline.offlineSnapshot);
    });
  });

  // ── 引导子系统 getter ──

  describe('引导子系统 getter', () => {
    it('getTutorialStateMachine 返回 guide.tutorialStateMachine', () => {
      expect(engine.getTutorialStateMachine()).toBe(engine.guide.tutorialStateMachine);
    });

    it('getStoryEventPlayer 返回 guide.storyEventPlayer', () => {
      expect(engine.getStoryEventPlayer()).toBe(engine.guide.storyEventPlayer);
    });

    it('getFirstLaunchDetector 返回 guide.firstLaunchDetector', () => {
      expect(engine.getFirstLaunchDetector()).toBe(engine.guide.firstLaunchDetector);
    });
  });

  // ── 战役 API ──

  describe('战役 API', () => {
    it('completeBattle 委托给 campaignSystems', () => {
      engine.completeBattle('chapter1_stage1', 3);
      expect(engine.campaignSystems.campaignSystem.isFirstCleared).toHaveBeenCalledWith('chapter1_stage1');
      expect(engine.campaignSystems.rewardDistributor.calculateAndDistribute).toHaveBeenCalled();
      expect(engine.campaignSystems.campaignSystem.completeStage).toHaveBeenCalledWith('chapter1_stage1', 3);
    });

    it('getCampaignProgress 委托给 campaignSystem', () => {
      engine.getCampaignProgress();
      expect(engine.campaignSystems.campaignSystem.getProgress).toHaveBeenCalled();
    });

    it('getStageList 返回所有关卡列表', () => {
      const stages = engine.getStageList();
      expect(Array.isArray(stages)).toBe(true);
    });

    it('getChapters 返回章节列表', () => {
      const chapters = engine.getChapters();
      expect(Array.isArray(chapters)).toBe(true);
    });
  });

  // ── 科技系统 getter ──

  describe('科技系统 getter', () => {
    it('getTechTreeSystem 返回 techSystems.treeSystem', () => {
      expect(engine.getTechTreeSystem()).toBe(engine.techSystems.treeSystem);
    });

    it('getTechPointSystem 返回 techSystems.pointSystem', () => {
      expect(engine.getTechPointSystem()).toBe(engine.techSystems.pointSystem);
    });

    it('getTechResearchSystem 返回 techSystems.researchSystem', () => {
      expect(engine.getTechResearchSystem()).toBe(engine.techSystems.researchSystem);
    });

    it('getTechState 返回合并状态', () => {
      const state = engine.getTechState();
      expect(state).toBeDefined();
      expect(state).toHaveProperty('researchQueue');
      expect(state).toHaveProperty('techPoints');
    });

    it('startTechResearch 委托给 researchSystem', () => {
      engine.startTechResearch('tech_1');
      expect(engine.techSystems.researchSystem.startResearch).toHaveBeenCalledWith('tech_1');
    });

    it('cancelTechResearch 委托给 researchSystem', () => {
      engine.cancelTechResearch('tech_1');
      expect(engine.techSystems.researchSystem.cancelResearch).toHaveBeenCalledWith('tech_1');
    });

    it('speedUpTechResearch 委托给 researchSystem', () => {
      engine.speedUpTechResearch('tech_1', 'mandate', 10);
      expect(engine.techSystems.researchSystem.speedUp).toHaveBeenCalledWith('tech_1', 'mandate', 10);
    });
  });

  // ── 地图系统 getter ──

  describe('地图系统 getter', () => {
    it('getWorldMapSystem 返回 mapSystems.worldMap', () => {
      expect(engine.getWorldMapSystem()).toBe(engine.mapSystems.worldMap);
    });

    it('getTerritorySystem 返回 mapSystems.territory', () => {
      expect(engine.getTerritorySystem()).toBe(engine.mapSystems.territory);
    });

    it('getSiegeSystem 返回 mapSystems.siege', () => {
      expect(engine.getSiegeSystem()).toBe(engine.mapSystems.siege);
    });

    it('getGarrisonSystem 返回 mapSystems.garrison', () => {
      expect(engine.getGarrisonSystem()).toBe(engine.mapSystems.garrison);
    });

    it('getMapEventSystem 返回 mapSystems.mapEvent', () => {
      expect(engine.getMapEventSystem()).toBe(engine.mapSystems.mapEvent);
    });
  });
});
