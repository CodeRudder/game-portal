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
import type { SignInSystem } from './activity/SignInSystem';
import type { TradeSystem } from './trade/TradeSystem';
import type { CaravanSystem } from './trade/CaravanSystem';
import type { SettingsManager } from './settings/SettingsManager';
import type { AccountSystem } from './settings/AccountSystem';
import type { OfflineRewardSystem } from './offline/OfflineRewardSystem';
import type { OfflineEstimateSystem } from './offline/OfflineEstimateSystem';
import type { OfflineSnapshotSystem } from './offline/OfflineSnapshotSystem';
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
  getBondSystem(): BondSystem;
  getSweepSystem(): SweepSystem;
  getResourceAmount(type: string): number;
  createFormation(id?: string): FormationData | null;
  setFormation(id: string, generalIds: string[]): FormationData | null;
  addToFormation(formationId: string, generalId: string): FormationData | null;
  removeFromFormation(formationId: string, generalId: string): FormationData | null;
  recruit(type: RecruitType, count?: 1 | 10): RecruitOutput | null;
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

  // ── 科技子系统扩展 ──
  getFusionTechSystem(): unknown;
  getTechLinkSystem(): unknown;
  getTechOfflineSystem(): unknown;
  getTechDetailProvider(): unknown;

  // ── R11: 缺失子系统 getter ──
  getMailSystem(): MailSystem;
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
  getAdvisorSystem(): AdvisorSystem;
  getActivitySystem(): ActivitySystem;
  getSignInSystem(): SignInSystem;
  getTradeSystem(): TradeSystem;
  getCaravanSystem(): CaravanSystem;
  getSettingsManager(): SettingsManager;
  getAccountSystem(): AccountSystem;

  // ── 离线收益子系统 getter ──
  getOfflineRewardSystem(): OfflineRewardSystem;
  getOfflineEstimateSystem(): OfflineEstimateSystem;
  getOfflineSnapshotSystem(): OfflineSnapshotSystem;
}
