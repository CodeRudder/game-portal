/**
 * 引擎层 — Getter 方法拆分（Mixin 模式）
 *
 * 从 ThreeKingdomsEngine.ts 拆分出来。
 * 包含所有 getXxxSystem() getter 方法、武将/战斗/科技/地图 API 方法。
 *
 * 使用 Mixin 模式：applyGetters() 将所有方法混入引擎类原型。
 * ThreeKingdomsEngine 只需在文件末尾调用 applyGetters(ThreeKingdomsEngine)。
 */

import type { HeroSystem } from './hero/HeroSystem';
import type { HeroRecruitSystem, RecruitOutput } from './hero/HeroRecruitSystem';
import type { HeroLevelSystem, LevelUpResult, BatchEnhanceResult, EnhancePreview } from './hero/HeroLevelSystem';
import type { HeroFormation, FormationData } from './hero/HeroFormation';
import type { HeroStarSystem } from './hero/HeroStarSystem';
import type { SkillUpgradeSystem } from './hero/SkillUpgradeSystem';
import type { BondSystem } from './bond/BondSystem';
import type { SweepSystem } from './campaign/SweepSystem';
import type { BattleEngine } from './battle/BattleEngine';
import type { CampaignProgressSystem } from './campaign/CampaignProgressSystem';
import type { RewardDistributor } from './campaign/RewardDistributor';
import type { TechTreeSystem } from './tech/TechTreeSystem';
import type { TechPointSystem } from './tech/TechPointSystem';
import type { TechResearchSystem } from './tech/TechResearchSystem';
import type { WorldMapSystem } from './map/WorldMapSystem';
import type { TerritorySystem } from './map/TerritorySystem';
import type { SiegeSystem } from './map/SiegeSystem';
import type { GarrisonSystem } from './map/GarrisonSystem';
import type { SiegeEnhancer } from './map/SiegeEnhancer';
import type { MailSystem } from './mail/MailSystem';
import type { MailTemplateSystem } from './mail/MailTemplateSystem';
import type { ShopSystem } from './shop/ShopSystem';
import type { CurrencySystem } from './currency/CurrencySystem';
import type { NPCSystem } from './npc/NPCSystem';
import type { EquipmentSystem } from './equipment/EquipmentSystem';
import type { EquipmentForgeSystem } from './equipment/EquipmentForgeSystem';
import type { EquipmentEnhanceSystem } from './equipment/EquipmentEnhanceSystem';
import type { EquipmentSetSystem } from './equipment/EquipmentSetSystem';
import type { EquipmentRecommendSystem } from './equipment/EquipmentRecommendSystem';
import type { ArenaSystem } from './pvp/ArenaSystem';
import type { ArenaSeasonSystem } from './pvp/ArenaSeasonSystem';
import type { RankingSystem } from './pvp/RankingSystem';
import type { PvPBattleSystem } from './pvp/PvPBattleSystem';
import type { DefenseFormationSystem } from './pvp/DefenseFormationSystem';
import type { ArenaShopSystem } from './pvp/ArenaShopSystem';
import type { ExpeditionSystem } from './expedition/ExpeditionSystem';
import type { AllianceSystem } from './alliance/AllianceSystem';
import type { AllianceTaskSystem } from './alliance/AllianceTaskSystem';
import type { AllianceBossSystem } from './alliance/AllianceBossSystem';
import type { AllianceShopSystem } from './alliance/AllianceShopSystem';
import type { PrestigeSystem } from './prestige/PrestigeSystem';
import type { PrestigeShopSystem } from './prestige/PrestigeShopSystem';
import type { RebirthSystem } from './prestige/RebirthSystem';
import type { QuestSystem } from './quest/QuestSystem';
import type { AchievementSystem } from './achievement/AchievementSystem';
import type { FriendSystem } from './social/FriendSystem';
import type { ChatSystem } from './social/ChatSystem';
import type { LeaderboardSystem as SocialLeaderboardSystem } from './social/LeaderboardSystem';
import type { HeritageSystem } from './heritage/HeritageSystem';
import type { AdvisorSystem } from './advisor/AdvisorSystem';
import type { ActivitySystem } from './activity/ActivitySystem';
import type { TimedActivitySystem } from './activity/TimedActivitySystem';
import type { SignInSystem } from './activity/SignInSystem';
import type { TradeSystem } from './trade/TradeSystem';
import type { CaravanSystem } from './trade/CaravanSystem';
import type { ResourceTradeEngine } from './trade/ResourceTradeEngine';
import type { SettingsManager } from './settings/SettingsManager';
import type { AccountSystem } from './settings/AccountSystem';
import type { EndingSystem } from './unification/EndingSystem';
import type { GlobalStatisticsSystem } from './unification/GlobalStatisticsSystem';
import type { EventTriggerSystem } from './event/EventTriggerSystem';
import type { EventNotificationSystem } from './event/EventNotificationSystem';
import type { EventUINotification } from './event/EventUINotification';
import type { EventChainSystem } from './event/EventChainSystem';
import type { EventLogSystem } from './event/EventLogSystem';
import type { OfflineEventSystem } from './event/OfflineEventSystem';
import type { OfflineRewardSystem } from './offline/OfflineRewardSystem';
import type { OfflineEstimateSystem } from './offline/OfflineEstimateSystem';
import type { OfflineSnapshotSystem } from './offline/OfflineSnapshotSystem';
import type { TutorialStateMachine } from './guide/TutorialStateMachine';
import type { StoryEventPlayer } from './guide/StoryEventPlayer';
import type { TutorialStepManager } from './guide/TutorialStepManager';
import type { TutorialStepExecutor } from './guide/TutorialStepExecutor';
import type { TutorialMaskSystem } from './guide/TutorialMaskSystem';
import type { TutorialStorage } from './guide/TutorialStorage';
import type { FirstLaunchDetector } from './guide/FirstLaunchDetector';
import type { GeneralData } from './hero/hero.types';
import type { RecruitType } from './hero/hero-recruit-config';
import type { BattleResult } from './battle/battle.types';
import type { Stage, Chapter, CampaignProgress } from './campaign/campaign.types';
import { campaignDataProvider } from './campaign/campaign-config';
import { buildAllyTeam, buildEnemyTeam } from './engine-campaign-deps';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EngineAny = any;

/**
 * 将 getter / API 方法混入引擎类原型。
 *
 * 用法：在 ThreeKingdomsEngine.ts 文件末尾调用
 * `applyGetters(ThreeKingdomsEngine);`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyGetters(cls: any): void {
  const p = cls.prototype;

  // ── 武将系统 API ──

  p.getHeroSystem = function(this: EngineAny): HeroSystem { return this.hero; };
  p.getRecruitSystem = function(this: EngineAny): HeroRecruitSystem { return this.heroRecruit; };
  p.getLevelSystem = function(this: EngineAny): HeroLevelSystem { return this.heroLevel; };
  p.getFormationSystem = function(this: EngineAny): HeroFormation { return this.heroFormation; };
  p.getFormations = function(this: EngineAny): FormationData[] { return this.heroFormation.getAllFormations(); };
  p.getActiveFormation = function(this: EngineAny): FormationData | null { return this.heroFormation.getActiveFormation(); };
  p.getHeroStarSystem = function(this: EngineAny): HeroStarSystem { return this.heroStarSystem; };
  p.getSkillUpgradeSystem = function(this: EngineAny): SkillUpgradeSystem { return this.skillUpgradeSystem; };
  p.getBondSystem = function(this: EngineAny): BondSystem { return this.bondSystem; };
  p.getSweepSystem = function(this: EngineAny): SweepSystem { return this.sweepSystem; };

  p.getResourceAmount = function(this: EngineAny, type: string): number {
    return this.resource.getAmount(type as import('../shared/types').ResourceType);
  };

  p.createFormation = function(this: EngineAny, id?: string): FormationData | null { return this.heroFormation.createFormation(id); };
  p.setFormation = function(this: EngineAny, id: string, generalIds: string[]): FormationData | null { return this.heroFormation.setFormation(id, generalIds); };
  p.addToFormation = function(this: EngineAny, formationId: string, generalId: string): FormationData | null { return this.heroFormation.addToFormation(formationId, generalId); };
  p.removeFromFormation = function(this: EngineAny, formationId: string, generalId: string): FormationData | null { return this.heroFormation.removeFromFormation(formationId, generalId); };
  p.recruit = function(this: EngineAny, type: RecruitType, count: 1 | 10 = 1): RecruitOutput | null { return count === 10 ? this.heroRecruit.recruitTen(type) : this.heroRecruit.recruitSingle(type); };
  p.freeRecruit = function(this: EngineAny, type: RecruitType): RecruitOutput | null { return this.heroRecruit.freeRecruitSingle(type); };
  p.canFreeRecruit = function(this: EngineAny, type: RecruitType): boolean { return this.heroRecruit.canFreeRecruit(type); };
  p.getRemainingFreeCount = function(this: EngineAny, type: RecruitType): number { return this.heroRecruit.getRemainingFreeCount(type); };
  p.getFreeRecruitState = function(this: EngineAny) { return this.heroRecruit.getFreeRecruitState(); };
  p.setUpHero = function(this: EngineAny, generalId: string | null, rate?: number, description?: string) { return this.heroRecruit.setUpHero(generalId, rate, description); };
  p.getUpHeroState = function(this: EngineAny) { return this.heroRecruit.getUpHeroState(); };
  p.enhanceHero = function(this: EngineAny, id: string, lvl?: number): LevelUpResult | null { return this.heroLevel.quickEnhance(id, lvl); };
  p.enhanceAllHeroes = function(this: EngineAny, lvl?: number): BatchEnhanceResult { return this.heroLevel.quickEnhanceAll(lvl); };
  p.getGenerals = function(this: EngineAny): Readonly<GeneralData>[] { return this.hero.getAllGenerals(); };
  p.getGeneral = function(this: EngineAny, id: string): Readonly<GeneralData> | undefined { return this.hero.getGeneral(id); };
  p.getRecruitHistory = function(this: EngineAny) { return this.heroRecruit.getRecruitHistory(); };
  p.getSynthesizeProgress = function(this: EngineAny, id: string) { return this.hero.getSynthesizeProgress(id); };
  p.getEnhancePreview = function(this: EngineAny, id: string, lvl: number): EnhancePreview | null { return this.heroLevel.getEnhancePreview(id, lvl); };

  // ── 战斗/关卡系统 API ──

  p.getBattleEngine = function(this: EngineAny): BattleEngine { return this.campaignSystems.battleEngine; };
  p.getCampaignSystem = function(this: EngineAny): CampaignProgressSystem { return this.campaignSystems.campaignSystem; };
  p.getRewardDistributor = function(this: EngineAny): RewardDistributor { return this.campaignSystems.rewardDistributor; };

  p.startBattle = function(this: EngineAny, stageId: string): BattleResult {
    const stage = campaignDataProvider.getStage(stageId);
    if (!stage) throw new Error(`关卡不存在: ${stageId}`);
    if (!this.campaignSystems.campaignSystem.canChallenge(stageId)) throw new Error(`关卡未解锁: ${stageId}`);
    const allyTeam = buildAllyTeam(this.heroFormation, this.hero);
    const enemyTeam = buildEnemyTeam(stage);
    return this.campaignSystems.battleEngine.runFullBattle(allyTeam, enemyTeam);
  };

  p.buildTeamsForStage = function(this: EngineAny, stage: Stage) {
    const allyTeam = buildAllyTeam(this.heroFormation, this.hero);
    const enemyTeam = buildEnemyTeam(stage);
    return { allyTeam, enemyTeam };
  };

  p.completeBattle = function(this: EngineAny, stageId: string, stars: number): void {
    const isFirst = !this.campaignSystems.campaignSystem.isFirstCleared(stageId);
    this.campaignSystems.rewardDistributor.calculateAndDistribute(stageId, stars, isFirst);
    this.campaignSystems.campaignSystem.completeStage(stageId, stars);
  };

  p.getStageList = function(this: EngineAny): Stage[] { return campaignDataProvider.getChapters().flatMap(c => c.stages); };
  p.getStageInfo = function(this: EngineAny, stageId: string): Stage | undefined { return campaignDataProvider.getStage(stageId); };
  p.getChapters = function(this: EngineAny): Chapter[] { return campaignDataProvider.getChapters(); };
  p.getCampaignProgress = function(this: EngineAny): CampaignProgress { return this.campaignSystems.campaignSystem.getProgress(); };

  // ── 科技系统 API ──

  p.getTechTreeSystem = function(this: EngineAny): TechTreeSystem { return this.techSystems.treeSystem; };
  p.getTechPointSystem = function(this: EngineAny): TechPointSystem { return this.techSystems.pointSystem; };
  p.getTechResearchSystem = function(this: EngineAny): TechResearchSystem { return this.techSystems.researchSystem; };

  p.getTechState = function(this: EngineAny) {
    const tree = this.techSystems.treeSystem;
    const point = this.techSystems.pointSystem;
    const research = this.techSystems.researchSystem;
    return {
      ...tree.getState(),
      researchQueue: research.getQueue(),
      techPoints: point.getTechPointState(),
    };
  };

  p.startTechResearch = function(this: EngineAny, techId: string) {
    return this.techSystems.researchSystem.startResearch(techId);
  };

  p.cancelTechResearch = function(this: EngineAny, techId: string) {
    return this.techSystems.researchSystem.cancelResearch(techId);
  };

  p.speedUpTechResearch = function(this: EngineAny, techId: string, method: 'mandate' | 'ingot', amount: number) {
    return this.techSystems.researchSystem.speedUp(techId, method, amount);
  };

  // ── 地图系统 API ──

  p.getWorldMapSystem = function(this: EngineAny): WorldMapSystem { return this.mapSystems.worldMap; };
  p.getTerritorySystem = function(this: EngineAny): TerritorySystem { return this.mapSystems.territory; };
  p.getSiegeSystem = function(this: EngineAny): SiegeSystem { return this.mapSystems.siege; };
  p.getGarrisonSystem = function(this: EngineAny): GarrisonSystem { return this.mapSystems.garrison; };
  p.getSiegeEnhancer = function(this: EngineAny): SiegeEnhancer { return this.mapSystems.siegeEnhancer; };

  // ── 科技子系统扩展 ──

  p.getFusionTechSystem = function(this: EngineAny) { return this.techSystems.fusionSystem; };
  p.getTechLinkSystem = function(this: EngineAny) { return this.techSystems.linkSystem; };
  p.getTechOfflineSystem = function(this: EngineAny) { return this.techSystems.offlineSystem; };
  p.getTechDetailProvider = function(this: EngineAny) { return this.techSystems.detailProvider; };

  // ── R11: 缺失子系统 getter (via r11 集合对象) ──

  p.getMailSystem = function(this: EngineAny): MailSystem { return this.r11.mailSystem; };
  p.getMailTemplateSystem = function(this: EngineAny): MailTemplateSystem { return this.r11.mailTemplateSystem; };
  p.getShopSystem = function(this: EngineAny): ShopSystem { return this.r11.shopSystem; };
  p.getCurrencySystem = function(this: EngineAny): CurrencySystem { return this.r11.currencySystem; };
  p.getNPCSystem = function(this: EngineAny): NPCSystem { return this.r11.npcSystem; };
  p.getEquipmentSystem = function(this: EngineAny): EquipmentSystem { return this.r11.equipmentSystem; };
  p.getEquipmentForgeSystem = function(this: EngineAny): EquipmentForgeSystem { return this.r11.equipmentForgeSystem; };
  p.getEquipmentEnhanceSystem = function(this: EngineAny): EquipmentEnhanceSystem { return this.r11.equipmentEnhanceSystem; };
  p.getEquipmentSetSystem = function(this: EngineAny): EquipmentSetSystem { return this.r11.equipmentSetSystem; };
  p.getEquipmentRecommendSystem = function(this: EngineAny): EquipmentRecommendSystem { return this.r11.equipmentRecommendSystem; };
  p.getArenaSystem = function(this: EngineAny): ArenaSystem { return this.r11.arenaSystem; };
  p.getSeasonSystem = function(this: EngineAny): ArenaSeasonSystem { return this.r11.arenaSeasonSystem; };
  p.getRankingSystem = function(this: EngineAny): RankingSystem { return this.r11.rankingSystem; };
  p.getPvPBattleSystem = function(this: EngineAny): PvPBattleSystem { return this.r11.pvpBattleSystem; };
  p.getDefenseFormationSystem = function(this: EngineAny): DefenseFormationSystem { return this.r11.defenseFormationSystem; };
  p.getArenaShopSystem = function(this: EngineAny): ArenaShopSystem { return this.r11.arenaShopSystem; };
  p.getExpeditionSystem = function(this: EngineAny): ExpeditionSystem { return this.r11.expeditionSystem; };
  p.getAllianceSystem = function(this: EngineAny): AllianceSystem { return this.r11.allianceSystem; };
  p.getAllianceTaskSystem = function(this: EngineAny): AllianceTaskSystem { return this.r11.allianceTaskSystem; };
  p.getAllianceBossSystem = function(this: EngineAny): AllianceBossSystem { return this.r11.allianceBossSystem; };
  p.getAllianceShopSystem = function(this: EngineAny): AllianceShopSystem { return this.r11.allianceShopSystem; };
  p.getPrestigeSystem = function(this: EngineAny): PrestigeSystem { return this.r11.prestigeSystem; };
  p.getPrestigeShopSystem = function(this: EngineAny): PrestigeShopSystem { return this.r11.prestigeShopSystem; };
  p.getRebirthSystem = function(this: EngineAny): RebirthSystem { return this.r11.rebirthSystem; };
  p.getQuestSystem = function(this: EngineAny): QuestSystem { return this.r11.questSystem; };
  p.getAchievementSystem = function(this: EngineAny): AchievementSystem { return this.r11.achievementSystem; };
  p.getFriendSystem = function(this: EngineAny): FriendSystem { return this.r11.friendSystem; };
  p.getChatSystem = function(this: EngineAny): ChatSystem { return this.r11.chatSystem; };
  p.getSocialLeaderboardSystem = function(this: EngineAny): SocialLeaderboardSystem { return this.r11.socialLeaderboardSystem; };
  p.getHeritageSystem = function(this: EngineAny): HeritageSystem { return this.r11.heritageSystem; };
  p.getTimedActivitySystem = function(this: EngineAny): TimedActivitySystem { return this.r11.timedActivitySystem; };
  p.getAdvisorSystem = function(this: EngineAny): AdvisorSystem { return this.r11.advisorSystem; };
  p.getActivitySystem = function(this: EngineAny): ActivitySystem { return this.r11.activitySystem; };
  p.getSignInSystem = function(this: EngineAny): SignInSystem { return this.r11.signInSystem; };
  p.getTradeSystem = function(this: EngineAny): TradeSystem { return this.r11.tradeSystem; };
  p.getCaravanSystem = function(this: EngineAny): CaravanSystem { return this.r11.caravanSystem; };
  p.getResourceTradeEngine = function(this: EngineAny): ResourceTradeEngine { return this.r11.resourceTradeEngine; };
  p.getSettingsManager = function(this: EngineAny): SettingsManager { return this.r11.settingsManager; };
  p.getAccountSystem = function(this: EngineAny): AccountSystem { return this.r11.accountSystem; };

  // ── v20.0: 结局与全局统计 getter ──

  p.getEndingSystem = function(this: EngineAny): EndingSystem { return this.r11.endingSystem; };
  p.getGlobalStatisticsSystem = function(this: EngineAny): GlobalStatisticsSystem { return this.r11.globalStatisticsSystem; };

  /** 获取全局统计快照（便捷方法） */
  p.getGlobalStatistics = function(this: EngineAny) { return this.r11.globalStatisticsSystem.getSnapshot(); };

  // ── v6.0: 事件子系统 getter ──

  p.getEventTriggerSystem = function(this: EngineAny): EventTriggerSystem { return this.eventSystems.trigger; };
  p.getEventNotificationSystem = function(this: EngineAny): EventNotificationSystem { return this.eventSystems.notification; };
  p.getEventUINotification = function(this: EngineAny): EventUINotification { return this.eventSystems.uiNotification; };
  p.getEventChainSystem = function(this: EngineAny): EventChainSystem { return this.eventSystems.chain; };
  p.getEventLogSystem = function(this: EngineAny): EventLogSystem { return this.eventSystems.log; };
  p.getOfflineEventSystem = function(this: EngineAny): OfflineEventSystem { return this.eventSystems.offline; };

  // ── 离线收益子系统 getter (via offline 集合对象) ──

  p.getOfflineRewardSystem = function(this: EngineAny): OfflineRewardSystem { return this.offline.offlineReward; };
  p.getOfflineEstimateSystem = function(this: EngineAny): OfflineEstimateSystem { return this.offline.offlineEstimate; };
  p.getOfflineSnapshotSystem = function(this: EngineAny): OfflineSnapshotSystem { return this.offline.offlineSnapshot; };

  // ── v18.0: 新手引导子系统 getter (via guide 集合对象) ──

  p.getTutorialStateMachine = function(this: EngineAny): TutorialStateMachine { return this.guide.tutorialStateMachine; };
  p.getStoryEventPlayer = function(this: EngineAny): StoryEventPlayer { return this.guide.storyEventPlayer; };
  p.getTutorialStepManager = function(this: EngineAny): TutorialStepManager { return this.guide.tutorialStepManager; };
  p.getTutorialStepExecutor = function(this: EngineAny): TutorialStepExecutor { return this.guide.tutorialStepExecutor; };
  p.getTutorialMaskSystem = function(this: EngineAny): TutorialMaskSystem { return this.guide.tutorialMaskSystem; };
  p.getTutorialStorage = function(this: EngineAny): TutorialStorage { return this.guide.tutorialStorage; };
  p.getFirstLaunchDetector = function(this: EngineAny): FirstLaunchDetector { return this.guide.firstLaunchDetector; };
}
