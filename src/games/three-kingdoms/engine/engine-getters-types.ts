/**
 * 类型声明 — 为 engine-getters.ts 中 Mixin 模式挂载的方法提供 TypeScript 类型。
 *
 * engine-getters.ts 通过 applyGetters() 将 getter / API 方法
 * 混入 ThreeKingdomsEngine.prototype，但 TypeScript 无法自动推断
 * 这些动态添加的方法。本文件通过 interface 合并补充类型声明。
 */

import type { HeroSystem } from './hero/HeroSystem';
import type { HeroRecruitSystem, RecruitOutput } from './hero/HeroRecruitSystem';
import type { HeroLevelSystem, LevelUpResult, BatchEnhanceResult, EnhancePreview } from './hero/HeroLevelSystem';
import type { HeroFormation, FormationData } from './hero/HeroFormation';
import type { HeroStarSystem } from './hero/HeroStarSystem';
import type { SkillUpgradeSystem } from './hero/SkillUpgradeSystem';
import type { HeroRecruitUpManager } from './hero/HeroRecruitUpManager';
import type { SkillStrategyRecommender } from './hero/SkillStrategyRecommender';
import type { BondSystem } from './bond/BondSystem';
import type { FormationRecommendSystem } from './hero/FormationRecommendSystem';
import type { HeroDispatchSystem } from './hero/HeroDispatchSystem';
import type { HeroBadgeSystem } from './hero/HeroBadgeSystem';
import type { HeroAttributeCompare } from './hero/HeroAttributeCompare';
import type { SweepSystem } from './campaign/SweepSystem';
import type { VIPSystem } from './campaign/VIPSystem';
import type { ChallengeStageSystem } from './campaign/ChallengeStageSystem';
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
import type { MapEventSystem } from './map/MapEventSystem';
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
import type { TechState } from './tech/tech.types';
import type { BattleUnit, BattleTeam } from './battle/battle.types';

/**
 * Mixin 方法接口 — 由 engine-getters.ts 通过原型挂载实现。
 * ThreeKingdomsEngine 通过 interface 合并获得这些方法的类型声明。
 */
export interface EngineGettersMixin {
  // ── 武将系统 API ──
  getHeroSystem(): HeroSystem;
  getRecruitSystem(): HeroRecruitSystem;
  getLevelSystem(): HeroLevelSystem;
  getFormationSystem(): HeroFormation;
  getFormations(): FormationData[];
  getActiveFormation(): FormationData | null;
  getHeroStarSystem(): HeroStarSystem;
  getSkillUpgradeSystem(): SkillUpgradeSystem;
  /** 获取 UP 武将管理子系统 */
  getHeroRecruitUpManager(): HeroRecruitUpManager;
  /** 获取技能策略推荐子系统 */
  getSkillStrategyRecommender(): SkillStrategyRecommender;
  getBondSystem(): BondSystem;
  getFormationRecommendSystem(): FormationRecommendSystem;
  getHeroDispatchSystem(): HeroDispatchSystem;
  getHeroBadgeSystem(): HeroBadgeSystem;
  getHeroAttributeCompare(): HeroAttributeCompare;
  getSweepSystem(): SweepSystem;
  getVIPSystem(): VIPSystem;
  getChallengeStageSystem(): ChallengeStageSystem;
  getResourceAmount(type: string): number;
  createFormation(id?: string): FormationData | null;
  setFormation(id: string, generalIds: string[]): FormationData | null;
  addToFormation(formationId: string, generalId: string): FormationData | null;
  removeFromFormation(formationId: string, generalId: string): FormationData | null;
  recruit(type: RecruitType, count?: 1 | 10): RecruitOutput | null;
  /** 每日免费招募（单次，不消耗资源） */
  freeRecruit(type: RecruitType): RecruitOutput | null;
  /** 检查指定招募类型是否还有免费次数 */
  canFreeRecruit(type: RecruitType): boolean;
  /** 获取今日剩余免费招募次数 */
  getRemainingFreeCount(type: RecruitType): number;
  /** 获取免费招募状态（已用次数 + 上次重置日期） */
  getFreeRecruitState(): ReturnType<HeroRecruitSystem['getFreeRecruitState']>;
  /** 设置 UP 武将（仅高级招募生效） */
  setUpHero(generalId: string | null, rate?: number, description?: string): void;
  /** 获取 UP 武将状态（ID + 概率 + 描述） */
  getUpHeroState(): ReturnType<HeroRecruitSystem['getUpHeroState']>;
  enhanceHero(id: string, lvl?: number): LevelUpResult | null;
  enhanceAllHeroes(lvl?: number): BatchEnhanceResult;
  getGenerals(): Readonly<GeneralData>[];
  getGeneral(id: string): Readonly<GeneralData> | undefined;
  getRecruitHistory(): ReturnType<HeroRecruitSystem['getRecruitHistory']>;
  getSynthesizeProgress(id: string): ReturnType<HeroSystem['getSynthesizeProgress']>;
  getEnhancePreview(id: string, lvl: number): EnhancePreview | null;

  // ── 战斗/关卡系统 API ──
  getBattleEngine(): BattleEngine;
  getCampaignSystem(): CampaignProgressSystem;
  getRewardDistributor(): RewardDistributor;
  startBattle(stageId: string): BattleResult;
  buildTeamsForStage(stage: Stage): { allyTeam: BattleTeam; enemyTeam: BattleTeam };
  completeBattle(stageId: string, stars: number): void;
  getStageList(): Stage[];
  getStageInfo(stageId: string): Stage | undefined;
  getChapters(): Chapter[];
  getCampaignProgress(): CampaignProgress;

  // ── 科技系统 API ──
  getTechTreeSystem(): TechTreeSystem;
  getTechPointSystem(): TechPointSystem;
  getTechResearchSystem(): TechResearchSystem;
  getTechState(): TechState;
  startTechResearch(techId: string): unknown;
  cancelTechResearch(techId: string): unknown;
  speedUpTechResearch(techId: string, method: 'mandate' | 'ingot', amount: number): unknown;

  // ── 地图系统 API ──
  getWorldMapSystem(): WorldMapSystem;
  getTerritorySystem(): TerritorySystem;
  getSiegeSystem(): SiegeSystem;
  getGarrisonSystem(): GarrisonSystem;
  getSiegeEnhancer(): SiegeEnhancer;
  getMapEventSystem(): MapEventSystem;

  // ── 科技子系统扩展 ──
  getFusionTechSystem(): unknown;
  getTechLinkSystem(): unknown;
  getTechOfflineSystem(): unknown;
  getTechDetailProvider(): unknown;

  // ── R11: 缺失子系统 getter ──
  getMailSystem(): MailSystem;
  getMailTemplateSystem(): MailTemplateSystem;
  getShopSystem(): ShopSystem;
  getCurrencySystem(): CurrencySystem;
  getNPCSystem(): NPCSystem;
  getEquipmentSystem(): EquipmentSystem;
  getEquipmentForgeSystem(): EquipmentForgeSystem;
  getEquipmentEnhanceSystem(): EquipmentEnhanceSystem;
  getEquipmentSetSystem(): EquipmentSetSystem;
  getEquipmentRecommendSystem(): EquipmentRecommendSystem;
  getArenaSystem(): ArenaSystem;
  getSeasonSystem(): ArenaSeasonSystem;
  getRankingSystem(): RankingSystem;
  getPvPBattleSystem(): PvPBattleSystem;
  getDefenseFormationSystem(): DefenseFormationSystem;
  getArenaShopSystem(): ArenaShopSystem;
  getExpeditionSystem(): ExpeditionSystem;
  getAllianceSystem(): AllianceSystem;
  getAllianceTaskSystem(): AllianceTaskSystem;
  getAllianceBossSystem(): AllianceBossSystem;
  getAllianceShopSystem(): AllianceShopSystem;
  getPrestigeSystem(): PrestigeSystem;
  getPrestigeShopSystem(): PrestigeShopSystem;
  getRebirthSystem(): RebirthSystem;
  getQuestSystem(): QuestSystem;
  getAchievementSystem(): AchievementSystem;
  getFriendSystem(): FriendSystem;
  getChatSystem(): ChatSystem;
  getSocialLeaderboardSystem(): SocialLeaderboardSystem;
  getHeritageSystem(): HeritageSystem;
  getTimedActivitySystem(): TimedActivitySystem;
  getAdvisorSystem(): AdvisorSystem;
  getActivitySystem(): ActivitySystem;
  getSignInSystem(): SignInSystem;
  getTradeSystem(): TradeSystem;
  getCaravanSystem(): CaravanSystem;
  getResourceTradeEngine(): ResourceTradeEngine;
  getSettingsManager(): SettingsManager;
  getAccountSystem(): AccountSystem;

  // ── 离线收益子系统 getter ──
  getOfflineRewardSystem(): OfflineRewardSystem;
  getOfflineEstimateSystem(): OfflineEstimateSystem;
  getOfflineSnapshotSystem(): OfflineSnapshotSystem;

  // ── v18.0: 新手引导子系统 getter ──
  getTutorialStateMachine(): TutorialStateMachine;
  getStoryEventPlayer(): StoryEventPlayer;
  getTutorialStepManager(): TutorialStepManager;
  getTutorialStepExecutor(): TutorialStepExecutor;
  getTutorialMaskSystem(): TutorialMaskSystem;
  getTutorialStorage(): TutorialStorage;
  getFirstLaunchDetector(): FirstLaunchDetector;
}
