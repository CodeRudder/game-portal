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
import type { ExpeditionSystem } from './expedition/ExpeditionSystem';
import type { AllianceSystem } from './alliance/AllianceSystem';
import type { AllianceTaskSystem } from './alliance/AllianceTaskSystem';
import type { PrestigeSystem } from './prestige/PrestigeSystem';
import type { QuestSystem } from './quest/QuestSystem';
import type { AchievementSystem } from './achievement/AchievementSystem';
import type { FriendSystem } from './social/FriendSystem';
import type { HeritageSystem } from './heritage/HeritageSystem';
import type { ActivitySystem } from './activity/ActivitySystem';
import type { TradeSystem } from './trade/TradeSystem';
import type { CaravanSystem } from './trade/CaravanSystem';
import type { SettingsManager } from './settings/SettingsManager';
import type { AccountSystem } from './settings/AccountSystem';
import type { EventTriggerSystem } from './event/EventTriggerSystem';
import type { EventNotificationSystem } from './event/EventNotificationSystem';
import type { EventUINotification } from './event/EventUINotification';
import type { EventChainSystem } from './event/EventChainSystem';
import type { EventLogSystem } from './event/EventLogSystem';
import type { OfflineEventSystem } from './event/OfflineEventSystem';
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

  // ── R11: 缺失子系统 getter ──

  p.getMailSystem = function(this: EngineAny): MailSystem { return this.mailSystem; };
  p.getShopSystem = function(this: EngineAny): ShopSystem { return this.shopSystem; };
  p.getCurrencySystem = function(this: EngineAny): CurrencySystem { return this.currencySystem; };
  p.getNPCSystem = function(this: EngineAny): NPCSystem { return this.npcSystem; };
  p.getEquipmentSystem = function(this: EngineAny): EquipmentSystem { return this.equipmentSystem; };
  p.getEquipmentForgeSystem = function(this: EngineAny): EquipmentForgeSystem { return this.equipmentForgeSystem; };
  p.getEquipmentEnhanceSystem = function(this: EngineAny): EquipmentEnhanceSystem { return this.equipmentEnhanceSystem; };
  p.getEquipmentSetSystem = function(this: EngineAny): EquipmentSetSystem { return this.equipmentSetSystem; };
  p.getEquipmentRecommendSystem = function(this: EngineAny): EquipmentRecommendSystem { return this.equipmentRecommendSystem; };
  p.getArenaSystem = function(this: EngineAny): ArenaSystem { return this.arenaSystem; };
  p.getSeasonSystem = function(this: EngineAny): ArenaSeasonSystem { return this.arenaSeasonSystem; };
  p.getRankingSystem = function(this: EngineAny): RankingSystem { return this.rankingSystem; };
  p.getExpeditionSystem = function(this: EngineAny): ExpeditionSystem { return this.expeditionSystem; };
  p.getAllianceSystem = function(this: EngineAny): AllianceSystem { return this.allianceSystem; };
  p.getAllianceTaskSystem = function(this: EngineAny): AllianceTaskSystem { return this.allianceTaskSystem; };
  p.getPrestigeSystem = function(this: EngineAny): PrestigeSystem { return this.prestigeSystem; };
  p.getQuestSystem = function(this: EngineAny): QuestSystem { return this.questSystem; };
  p.getAchievementSystem = function(this: EngineAny): AchievementSystem { return this.achievementSystem; };
  p.getFriendSystem = function(this: EngineAny): FriendSystem { return this.friendSystem; };
  p.getHeritageSystem = function(this: EngineAny): HeritageSystem { return this.heritageSystem; };
  p.getActivitySystem = function(this: EngineAny): ActivitySystem { return this.activitySystem; };
  p.getTradeSystem = function(this: EngineAny): TradeSystem { return this.tradeSystem; };
  p.getCaravanSystem = function(this: EngineAny): CaravanSystem { return this.caravanSystem; };
  p.getSettingsManager = function(this: EngineAny): SettingsManager { return this.settingsManager; };
  p.getAccountSystem = function(this: EngineAny): AccountSystem { return this.accountSystem; };

  // ── v6.0: 事件子系统 getter ──

  p.getEventTriggerSystem = function(this: EngineAny): EventTriggerSystem { return this.eventSystems.trigger; };
  p.getEventNotificationSystem = function(this: EngineAny): EventNotificationSystem { return this.eventSystems.notification; };
  p.getEventUINotification = function(this: EngineAny): EventUINotification { return this.eventSystems.uiNotification; };
  p.getEventChainSystem = function(this: EngineAny): EventChainSystem { return this.eventSystems.chain; };
  p.getEventLogSystem = function(this: EngineAny): EventLogSystem { return this.eventSystems.log; };
  p.getOfflineEventSystem = function(this: EngineAny): OfflineEventSystem { return this.eventSystems.offline; };
}
