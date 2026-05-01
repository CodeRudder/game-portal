/**
 * 引擎存档内部逻辑
 *
 * 从 ThreeKingdomsEngine 中拆分出的存档/读档流程。
 * 职责：序列化、反序列化、离线收益计算、旧格式兼容
 *
 * @module engine/engine-save
 */

import type { ResourceSystem } from './resource/ResourceSystem';
import type { BuildingSystem } from './building/BuildingSystem';
import type { CalendarSystem } from './calendar/CalendarSystem';
import type { HeroSystem } from './hero/HeroSystem';
import type { HeroRecruitSystem } from './hero/HeroRecruitSystem';
import type { HeroFormation } from './hero/HeroFormation';
import type { CampaignProgressSystem } from './campaign/CampaignProgressSystem';
import type { SweepSystem } from './campaign/SweepSystem';
import type { VIPSystem } from './campaign/VIPSystem';
import type { ChallengeStageSystem } from './campaign/ChallengeStageSystem';
import type { TechTreeSystem } from './tech/TechTreeSystem';
import type { TechPointSystem } from './tech/TechPointSystem';
import type { TechResearchSystem } from './tech/TechResearchSystem';
import type { EventBus } from '../core/events/EventBus';
import type { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import type { ConfigRegistry } from '../core/config/ConfigRegistry';
import type {
  GameSaveData,
  OfflineEarnings,
  ResourceSaveData,
  BuildingSaveData,
} from '../shared/types';
import type { CalendarSaveData } from './calendar/calendar.types';
import type { HeroSaveData } from './hero/hero.types';
import type { RecruitSaveData } from './hero/HeroRecruitSystem';
import type { FormationSaveData } from './hero/HeroFormation';
import type { TechSaveData } from './tech/tech.types';
import type { IGameState } from '../core/types/state';
import type { ISystemDeps } from '../core/types/subsystem';
import type { ArenaSystem } from './pvp/ArenaSystem';
import type { ArenaShopSystem } from './pvp/ArenaShopSystem';
import type { RankingSystem } from './pvp/RankingSystem';
import { ENGINE_SAVE_VERSION, SAVE_KEY } from '../shared/constants';
import { gameLog } from '../core/logger';
import { GameDataValidator } from '../core/save/GameDataValidator';
import { GameDataFixer } from '../core/save/GameDataFixer';
import { SaveBackupManager } from '../core/save/SaveBackupManager';
import { repairWithBlueprint } from '../core/save/SaveDataRepair';
import { syncBuildingToResource } from './engine-tick';

// ─────────────────────────────────────────────
// 存档上下文
// ─────────────────────────────────────────────

/** 存档操作时需要访问的引擎上下文 */
export interface SaveContext {
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;
  readonly calendar: CalendarSystem;
  readonly hero: HeroSystem;
  readonly recruit: HeroRecruitSystem;
  readonly formation: HeroFormation;
  readonly campaign: CampaignProgressSystem;
  readonly techTree: TechTreeSystem;
  readonly techPoint: TechPointSystem;
  readonly techResearch: TechResearchSystem;
  /** FIX-502: 融合科技系统（可选，v18.0+） */
  readonly fusionTech?: import('./tech/FusionTechSystem').FusionTechSystem;
  /** FIX-503: 离线研究系统（可选，v18.0+） */
  readonly techOffline?: import('./tech/TechOfflineSystem').TechOfflineSystem;
  readonly bus: EventBus;
  readonly registry: SubsystemRegistry;
  readonly configRegistry: ConfigRegistry;
  /** 装备系统（可选，v5.0+） */
  readonly equipment?: import('./equipment/EquipmentSystem').EquipmentSystem;
  /** 装备炼制系统（可选，v10.0+） */
  readonly equipmentForge?: import('./equipment/EquipmentForgeSystem').EquipmentForgeSystem;
  /** 装备强化系统（可选，v10.0+） */
  readonly equipmentEnhance?: import('./equipment/EquipmentEnhanceSystem').EquipmentEnhanceSystem;
  /** 贸易系统（可选，v5.0+） */
  readonly trade?: import('./trade/TradeSystem').TradeSystem;
  /** 商队系统（可选，v5.0+，FIX-805: R1 存档接入） */
  readonly caravan?: import('./trade/CaravanSystem').CaravanSystem;
  /** 商店系统（可选，v5.0+） */
  readonly shop?: import('./shop/ShopSystem').ShopSystem;
  /** 声望系统（可选，v14.0+） */
  readonly prestige?: import('./prestige/PrestigeSystem').PrestigeSystem;
  /** 转生系统（可选，v14.0+，FIX-508: R1 存档接入） */
  readonly rebirth?: import('./prestige/RebirthSystem').RebirthSystem;
  /** 声望商店系统（可选，v14.0+，FIX-506: R1 存档接入） */
  readonly prestigeShop?: import('./prestige/PrestigeShopSystem').PrestigeShopSystem;
  /** 传承系统（可选，v14.0+） */
  readonly heritage?: import('./heritage/HeritageSystem').HeritageSystem;
  /** 成就系统（可选，v14.0+） */
  readonly achievement?: import('./achievement/AchievementSystem').AchievementSystem;
  /** 竞技场系统（可选，v7.0+） */
  readonly arena?: ArenaSystem;
  /** 竞技商店系统（可选，v7.0+） */
  readonly arenaShop?: ArenaShopSystem;
  /** 排行榜系统（可选，v7.0+） */
  readonly ranking?: RankingSystem;
  /** 事件触发系统（可选，v7.0+） */
  readonly eventTrigger?: import('./event/EventTriggerSystem').EventTriggerSystem;
  /** 事件通知系统（可选，v7.0+） */
  readonly eventNotification?: import('./event/EventNotificationSystem').EventNotificationSystem;
  /** 事件UI通知（可选，v7.0+） */
  readonly eventUI?: import('./event/EventUINotification').EventUINotification;
  /** 事件链系统（可选，v7.0+） */
  readonly eventChain?: import('./event/EventChainSystem').EventChainSystem;
  /** 事件日志系统（可选，v7.0+） */
  readonly eventLog?: import('./event/EventLogSystem').EventLogSystem;
  /** 离线事件系统（可选，v15.0+） */
  readonly offlineEvent?: import('./event/OfflineEventSystem').OfflineEventSystem;
  /** 在线时长（秒） */
  onlineSeconds: number;
  /** 赛季系统（可选，v16.0+） */
  readonly season?: import('./season/SeasonSystem').SeasonSystem;
  /** 扫荡系统（可选，v4.0+） */
  readonly sweep?: SweepSystem;
  /** VIP系统（可选，v9.4+） */
  readonly vip?: VIPSystem;
  /** 挑战关卡系统（可选，v11+） */
  readonly challenge?: ChallengeStageSystem;
  // ── 武将子系统 (FIX-301: R3 保存/加载覆盖) ──
  /** 升星/突破系统（可选，v17.0+） */
  readonly heroStar?: import('./hero/HeroStarSystem').HeroStarSystem;
  /** 技能升级系统（可选，v17.0+） */
  readonly skillUpgrade?: import('./hero/SkillUpgradeSystem').SkillUpgradeSystem;
  /** 武将派驻系统（可选，v17.0+） */
  readonly heroDispatch?: import('./hero/HeroDispatchSystem').HeroDispatchSystem;
  /** 觉醒系统（可选，v17.0+） */
  readonly awakening?: import('./hero/AwakeningSystem').AwakeningSystem;
  /** 招贤令经济系统（可选，v17.0+） */
  readonly recruitTokenEconomy?: import('./hero/recruit-token-economy-system').RecruitTokenEconomySystem;
  /** 远征系统（可选，v12.0+） */
  readonly expedition?: import('./expedition/ExpeditionSystem').ExpeditionSystem;
  /** NPC系统（可选，v19.0+，FIX-008: R2 存档接入） */
  readonly npc?: import('./npc/NPCSystem').NPCSystem;
  // ── 地图子系统 (FIX-714: R2 存档接入) ──
  readonly worldMap?: import('./map/WorldMapSystem').WorldMapSystem;
  readonly territory?: import('./map/TerritorySystem').TerritorySystem;
  readonly siege?: import('./map/SiegeSystem').SiegeSystem;
  readonly garrison?: import('./map/GarrisonSystem').GarrisonSystem;
  readonly siegeEnhancer?: import('./map/SiegeEnhancer').SiegeEnhancer;
  readonly mapEvent?: import('./map/MapEventSystem').MapEventSystem;
  // ── 离线收益系统 v9.0+ (FIX-816: R1 存档接入) ──
  readonly offlineReward?: import('./offline/OfflineRewardSystem').OfflineRewardSystem;
  readonly offlineSnapshot?: import('./offline/OfflineSnapshotSystem').OfflineSnapshotSystem;
  // ── 铜钱/材料经济系统 (FIX-720/721: Resource R1 存档接入) ──
  readonly copperEconomy?: import('./resource/copper-economy-system').CopperEconomySystem;
  readonly materialEconomy?: import('./resource/material-economy-system').MaterialEconomySystem;
  // ── 联盟系统 v13.0+ (FIX-P0-001: Alliance R1 存档接入) ──
  readonly allianceSystem?: import('./alliance/AllianceSystem').AllianceSystem;
  readonly allianceTaskSystem?: import('./alliance/AllianceTaskSystem').AllianceTaskSystem;
  readonly allianceBossSystem?: import('./alliance/AllianceBossSystem').AllianceBossSystem;
  readonly allianceShopSystem?: import('./alliance/AllianceShopSystem').AllianceShopSystem;
  // ── 社交系统 v6.0+ (FIX-R2-P0-01: Social R2 存档接入) ──
  readonly friendSystem?: import('./social/FriendSystem').FriendSystem;
  readonly socialLeaderboardSystem?: import('./social/LeaderboardSystem').LeaderboardSystem;
  /** 当前社交状态（FriendSystem 纯函数模式需要外部持有） */
  socialState?: import('../core/social/social.types').SocialState;
  /** 社交状态写回函数 */
  setSocialState?: (state: import('../core/social/social.types').SocialState) => void;
  // ── 新手引导系统 (FIX-T04: Tutorial R1 存档接入) ──
  readonly tutorialGuide?: import('./tutorial/tutorial-system').TutorialSystem;
  // ── 羁绊系统 (FIX-B04: Bond R1 存档接入) ──
  readonly bond?: import('./bond/BondSystem').BondSystem;
}

// ─────────────────────────────────────────────
// 序列化
// ─────────────────────────────────────────────

/** 构建完整的 GameSaveData */
export function buildSaveData(ctx: SaveContext): GameSaveData {
  // 序列化科技系统
  const treeData = ctx.techTree.serialize();
  const researchData = ctx.techResearch.serialize();
  const pointData = ctx.techPoint.serialize();
  // FIX-502: 序列化融合科技系统
  const fusionData = ctx.fusionTech?.serialize();
  // FIX-503: 序列化离线研究系统
  const offlineData = ctx.techOffline?.serialize();
  const techSaveData: TechSaveData = {
    version: 1,
    completedTechIds: treeData.completedTechIds,
    activeResearch: researchData.activeResearch,
    researchQueue: researchData.researchQueue,
    techPoints: pointData.techPoints,
    chosenMutexNodes: treeData.chosenMutexNodes,
    fusionTechData: fusionData,
    offlineResearchData: offlineData,
  };

  return {
    version: ENGINE_SAVE_VERSION,
    saveTime: Date.now(),
    resource: ctx.resource.serialize(),
    building: ctx.building.serialize(),
    calendar: ctx.calendar.serialize(),
    hero: ctx.hero.serialize(),
    recruit: ctx.recruit.serialize(),
    formation: ctx.formation.serialize(),
    campaign: ctx.campaign.serialize(),
    tech: techSaveData,
    equipment: ctx.equipment?.serialize(),
    equipmentForge: ctx.equipmentForge?.serialize(),
    equipmentEnhance: ctx.equipmentEnhance?.serialize(),
    trade: ctx.trade?.serialize(),
    caravan: ctx.caravan?.serialize(),
    shop: ctx.shop?.serialize(),
    prestige: ctx.prestige?.getSaveData(),
    heritage: ctx.heritage?.getSaveData(),
    achievement: ctx.achievement?.getSaveData(),
    // ── PvP 系统 v7.0 ──
    pvpArena: ctx.arena?.serialize(),
    pvpArenaShop: ctx.arenaShop?.serialize(),
    pvpRanking: ctx.ranking?.serialize(),

    // ── 事件系统 v7.0+ ──
    eventTrigger: ctx.eventTrigger?.serialize(),
    eventNotification: ctx.eventNotification?.exportSaveData(),
    eventUI: ctx.eventUI?.serialize(),
    eventChain: ctx.eventChain?.serialize(),
    eventLog: ctx.eventLog?.exportSaveData(),
    offlineEvent: ctx.offlineEvent?.exportSaveData() as { version: number; offlineQueue: unknown[]; autoRules: unknown[] },
    // ── 赛季系统 v16.0 ──
    season: ctx.season?.getSaveData(),
    // ── 扫荡系统 v4.0 ──
    sweep: ctx.sweep?.serialize(),
    // ── VIP系统 v9.4 ──
    vip: ctx.vip?.serialize(),
    // ── 挑战关卡系统 v11 ──
    challenge: ctx.challenge?.serialize(),
    // ── 武将子系统 v17.0 (FIX-301: R3 保存/加载覆盖) ──
    heroStar: ctx.heroStar?.serialize(),
    skillUpgrade: ctx.skillUpgrade?.serialize(),
    heroDispatch: ctx.heroDispatch?.serialize(),
    awakening: ctx.awakening?.serialize(),
    recruitTokenEconomy: ctx.recruitTokenEconomy?.serialize(),
    // ── 远征系统 v12.0 (FIX-601: R1 保存/加载覆盖) ──
    expedition: ctx.expedition?.serialize(),
    // ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
    npc: ctx.npc?.exportSaveData(),
    // ── 地图子系统 (FIX-714: R2 存档接入) ──
    worldMap: ctx.worldMap?.serialize(),
    territory: ctx.territory?.serialize(),
    siege: ctx.siege?.serialize(),
    garrison: ctx.garrison?.serialize(),
    siegeEnhancer: ctx.siegeEnhancer?.serialize(),
    mapEvent: ctx.mapEvent?.serialize(),
    // ── 离线收益系统 v9.0 (FIX-816: R1 存档接入) ──
    offlineReward: ctx.offlineReward?.serialize(),
    offlineSnapshot: ctx.offlineSnapshot?.getSaveData(),
    // ── 铜钱/材料经济系统 (FIX-720/721: Resource R1 存档接入) ──
    copperEconomy: ctx.copperEconomy?.serialize(),
    materialEconomy: ctx.materialEconomy?.serialize(),
    // ── 联盟系统 v13.0+ (FIX-P0-001: Alliance R1 存档接入) ──
    alliance: ctx.allianceSystem?.serialize(ctx.allianceSystem.getPlayerState(), ctx.allianceSystem.getAlliance()),
    allianceTask: ctx.allianceTaskSystem?.serialize(),
    allianceShop: ctx.allianceShopSystem?.serialize(),
    // ── 社交系统 v6.0+ (FIX-R2-P0-01: Social R2 存档序列化) ──
    social: ctx.friendSystem?.serialize(ctx.socialState ?? ctx.friendSystem.getState()),
    leaderboard: ctx.socialLeaderboardSystem?.serialize(),
    // ── 新手引导系统 (FIX-T04: Tutorial R1 存档接入) ──
    tutorialGuide: ctx.tutorialGuide?.serialize(),
    // ── 羁绊系统 (FIX-B04: Bond R1 存档接入) ──
    bond: ctx.bond?.serialize(),
  };
}

/** 将 GameSaveData 转换为 IGameState 格式（供 SaveManager 使用） */
export function toIGameState(data: GameSaveData, onlineSeconds: number): IGameState {
  const subsystems: Record<string, unknown> = {
    resource: data.resource,
    building: data.building,
    calendar: data.calendar,
    hero: data.hero,
    recruit: data.recruit,
    formation: data.formation,
    campaign: data.campaign,
    tech: data.tech,
  };
  if (data.equipment) subsystems.equipment = data.equipment;
  if (data.equipmentForge) subsystems.equipmentForge = data.equipmentForge;
  if (data.equipmentEnhance) subsystems.equipmentEnhance = data.equipmentEnhance;
  if (data.trade) subsystems.trade = data.trade;
  if (data.caravan) subsystems.caravan = data.caravan;
  if (data.shop) subsystems.shop = data.shop;
  if (data.prestige) subsystems.prestige = data.prestige;
  if (data.heritage) subsystems.heritage = data.heritage;
  if (data.achievement) subsystems.achievement = data.achievement;
  if (data.pvpArena) subsystems.pvpArena = data.pvpArena;
  if (data.pvpArenaShop) subsystems.pvpArenaShop = data.pvpArenaShop;
  if (data.pvpRanking) subsystems.pvpRanking = data.pvpRanking;
  if (data.eventTrigger) subsystems.eventTrigger = data.eventTrigger;
  if (data.eventNotification) subsystems.eventNotification = data.eventNotification;
  if (data.eventUI) subsystems.eventUI = data.eventUI;
  if (data.eventChain) subsystems.eventChain = data.eventChain;
  if (data.eventLog) subsystems.eventLog = data.eventLog;
  if (data.offlineEvent) subsystems.offlineEvent = data.offlineEvent;
  if (data.season) subsystems.season = data.season;
  if (data.sweep) subsystems.sweep = data.sweep;
  if (data.vip) subsystems.vip = data.vip;
  if (data.challenge) subsystems.challenge = data.challenge;
  // ── 武将子系统 v17.0 (FIX-301: R3 保存/加载覆盖) ──
  if (data.heroStar) subsystems.heroStar = data.heroStar;
  if (data.skillUpgrade) subsystems.skillUpgrade = data.skillUpgrade;
  if (data.heroDispatch) subsystems.heroDispatch = data.heroDispatch;
  if (data.awakening) subsystems.awakening = data.awakening;
  if (data.recruitTokenEconomy) subsystems.recruitTokenEconomy = data.recruitTokenEconomy;
  // ── 远征系统 v12.0 (FIX-601: R1 保存/加载覆盖) ──
  if (data.expedition) subsystems.expedition = data.expedition;
  // ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
  if (data.npc) subsystems.npc = data.npc;
  // ── 离线收益系统 v9.0 (FIX-816: R1 存档接入) ──
  if (data.offlineReward) subsystems.offlineReward = data.offlineReward;
  if (data.offlineSnapshot) subsystems.offlineSnapshot = data.offlineSnapshot;
  // ── 铜钱/材料经济系统 (FIX-720/721: Resource R1 存档接入) ──
  if (data.copperEconomy) subsystems.copperEconomy = data.copperEconomy;
  if (data.materialEconomy) subsystems.materialEconomy = data.materialEconomy;
  // ── 联盟系统 v13.0+ (FIX-P0-001: Alliance R1 存档接入) ──
  if (data.alliance) subsystems.alliance = data.alliance;
  if (data.allianceTask) subsystems.allianceTask = data.allianceTask;
  if (data.allianceShop) subsystems.allianceShop = data.allianceShop;
  // ── 社交系统 v6.0+ (FIX-P0-01: Social R1 存档接入) ──
  if (data.social) subsystems.social = data.social;
  if (data.leaderboard) subsystems.leaderboard = data.leaderboard;
  // ── 新手引导系统 (FIX-T04: Tutorial R1 存档接入) ──
  if (data.tutorialGuide) subsystems.tutorialGuide = data.tutorialGuide;
  // ── 羁绊系统 (FIX-B04: Bond R1 存档接入) ──
  if (data.bond) subsystems.bond = data.bond;

  return {
    version: String(data.version),
    timestamp: data.saveTime,
    subsystems,
    metadata: {
      totalPlayTime: onlineSeconds,
      saveCount: 0,
      lastVersion: String(data.version),
    },
  };
}

/** 从 IGameState 提取 GameSaveData */
export function fromIGameState(state: IGameState): GameSaveData {
  const s = state.subsystems;
  return {
    version: Number(state.version),
    saveTime: state.timestamp,
    resource: s.resource as ResourceSaveData,
    building: s.building as BuildingSaveData,
    calendar: s.calendar as CalendarSaveData | undefined,
    hero: s.hero as HeroSaveData | undefined,
    recruit: s.recruit as RecruitSaveData | undefined,
    formation: s.formation as FormationSaveData | undefined,
    campaign: s.campaign as import('./campaign/campaign.types').CampaignSaveData | undefined,
    tech: s.tech as TechSaveData | undefined,
    equipment: s.equipment as import('../core/equipment/equipment.types').EquipmentSaveData | undefined,
    equipmentForge: s.equipmentForge as import('../core/equipment/equipment-forge.types').ForgeSaveData | undefined,
    equipmentEnhance: s.equipmentEnhance as { protectionCount: number } | undefined,
    trade: s.trade as import('../core/trade/trade.types').TradeSaveData | undefined,
    shop: s.shop as import('../core/shop/shop.types').ShopSaveData | undefined,
    prestige: s.prestige as import('../core/prestige').PrestigeSaveData | undefined,
    heritage: s.heritage as import('../core/heritage').HeritageSaveData | undefined,
    achievement: s.achievement as import('../core/achievement').AchievementSaveData | undefined,
    pvpArena: s.pvpArena as import('../core/pvp/pvp.types').ArenaSaveData | undefined,
    pvpArenaShop: s.pvpArenaShop as import('./pvp/ArenaShopSystem').ArenaShopSaveData | undefined,
    pvpRanking: s.pvpRanking as import('./pvp/RankingSystem').RankingSaveData | undefined,
    eventTrigger: s.eventTrigger as import('../core/event').EventSystemSaveData | undefined,
    eventNotification: s.eventNotification as import('./event/EventNotificationSystem').EventNotificationSaveData | undefined,
    eventUI: s.eventUI as { expiredBanners: import('../core/events/event-system.types').EventBanner[] } | undefined,
    eventChain: s.eventChain as import('./event/EventChainSystem').EventChainSaveData | undefined,
    eventLog: s.eventLog as import('./event/EventLogSystem').EventLogSaveData | undefined,
    offlineEvent: s.offlineEvent as { version: number; offlineQueue: unknown[]; autoRules: unknown[] } | undefined,
    season: s.season as import('./season/SeasonSystem').SeasonSaveData | undefined,
    sweep: s.sweep as import('./campaign/sweep.types').SweepSaveData | undefined,
    vip: s.vip as import('./campaign/VIPSystem').VIPSaveData | undefined,
    challenge: s.challenge as import('./campaign/ChallengeStageSystem').ChallengeSaveData | undefined,
    // ── 武将子系统 v17.0 (FIX-301: R3 保存/加载覆盖) ──
    heroStar: s.heroStar as import('./hero/star-up.types').StarSystemSaveData | undefined,
    skillUpgrade: s.skillUpgrade as import('./hero/SkillUpgradeSystem').SkillUpgradeSaveData | undefined,
    heroDispatch: s.heroDispatch as import('./hero/HeroDispatchSystem').DispatchSaveData | undefined,
    awakening: s.awakening as import('./hero/AwakeningSystem').AwakeningSaveData | undefined,
    recruitTokenEconomy: s.recruitTokenEconomy as import('./hero/recruit-token-economy-system').RecruitTokenEconomySaveData | undefined,
    // ── 远征系统 v12.0 (FIX-601: R1 保存/加载覆盖) ──
    expedition: s.expedition as import('../core/expedition/expedition.types').ExpeditionSaveData | undefined,
    // ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
    npc: s.npc as import('../core/npc/npc.types').NPCSaveData | undefined,
    // ── 离线收益系统 v9.0 (FIX-816: R1 存档接入) ──
    offlineReward: s.offlineReward as import('./offline/offline.types').OfflineSaveData | undefined,
    offlineSnapshot: s.offlineSnapshot as import('./offline/offline.types').OfflineSaveData | undefined,
    // ── 铜钱/材料经济系统 (FIX-720/721: Resource R1 存档接入) ──
    copperEconomy: s.copperEconomy as import('./resource/copper-economy-system').CopperEconomySaveData | undefined,
    materialEconomy: s.materialEconomy as import('./resource/material-economy-system').MaterialEconomySaveData | undefined,
    // ── 联盟系统 v13.0+ (FIX-P0-001: Alliance R1 存档接入) ──
    alliance: s.alliance as import('../core/alliance/alliance.types').AllianceSaveData | undefined,
    allianceTask: s.allianceTask as { tasks: Array<{ defId: string; currentProgress: number; status: import('../core/alliance/alliance.types').AllianceTaskStatus; claimedPlayers: string[] }> } | undefined,
    allianceShop: s.allianceShop as { items: Array<{ id: string; purchased: number }> } | undefined,
    // ── 新手引导系统 (FIX-T04: Tutorial R1 存档接入) ──
    tutorialGuide: s.tutorialGuide as import('./tutorial/tutorial-config').TutorialGuideSaveData | undefined,
    // ── 羁绊系统 (FIX-B04: Bond R1 存档接入) ──
    bond: s.bond as import('../core/bond').BondSaveData | undefined,
  };
}

// ─────────────────────────────────────────────
// 反序列化
// ─────────────────────────────────────────────

/** 应用从 SaveManager 加载的 IGameState */
export function applyLoadedState(ctx: SaveContext, state: IGameState): OfflineEarnings | null {
  try {
    let data = fromIGameState(state);

    // 蓝图修复：用引擎默认数据补全存档缺失/错误字段
    const blueprint = buildSaveData(ctx);
    const repairResult = repairWithBlueprint(data, blueprint);
    if (repairResult.repaired) {
      gameLog.info(`[SaveRepair] 存档修复完成，共 ${repairResult.logs.length} 处修正`);
      for (const log of repairResult.logs) {
        gameLog.info(`[SaveRepair] ${log.action}: ${log.field}`);
      }
      data = repairResult.data;
    }

    if (data.version !== ENGINE_SAVE_VERSION) {
      gameLog.warn(
        `Engine: 存档版本不匹配 (期望 ${ENGINE_SAVE_VERSION}，实际 ${data.version})，尝试兼容加载`,
      );
    }

    // 数据校验
    const validator = new GameDataValidator();
    const report = validator.validate(data);

    if (!report.valid) {
      gameLog.warn('[engine-save] 存档数据校验发现问题:', report.stats);
      for (const issue of report.issues) {
        if (issue.severity === 'error') {
          gameLog.error(`  [${issue.severity}] ${issue.field}: ${issue.message}`);
        }
      }

      // 尝试修正数据
      const fixer = new GameDataFixer(new SaveBackupManager());
      const { data: fixedData } = fixer.fix(data);
      if (fixedData) {
        applySaveData(ctx, fixedData);
        return computeOfflineAndFinalize(ctx);
      }
    }

    // v1.0 → v2.0 迁移：检测到旧版本存档时确保武将系统字段存在
    // applySaveData 内部已对 hero/recruit 缺失做兼容处理
    applySaveData(ctx, data);
    return computeOfflineAndFinalize(ctx);
  } catch (e) {
    gameLog.error('ThreeKingdomsEngine.load 失败:', e);
    return null;
  }
}

/** 尝试加载旧格式存档（直接 JSON，无 checksum 包装） */
export function tryLoadLegacyFormat(): GameSaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // 新格式特征：外层有 v/checksum/data 字段
    if (parsed.v !== undefined && parsed.checksum !== undefined && parsed.data !== undefined) {
      return null;
    }

    // 旧格式特征：直接是 GameSaveData
    if (typeof parsed.version === 'number' && parsed.resource && parsed.building) {
      return parsed as GameSaveData;
    }

    return null;
  } catch {
    return null;
  }
}

/** 应用旧格式存档 */
export function applyLegacyState(ctx: SaveContext, data: GameSaveData): OfflineEarnings | null {
  try {
    // 蓝图修复：用引擎默认数据补全旧格式存档缺失/错误字段
    const blueprint = buildSaveData(ctx);
    const repairResult = repairWithBlueprint(data, blueprint);
    if (repairResult.repaired) {
      gameLog.info(`[SaveRepair] 旧格式存档修复完成，共 ${repairResult.logs.length} 处修正`);
      for (const log of repairResult.logs) {
        gameLog.info(`[SaveRepair] ${log.action}: ${log.field}`);
      }
      data = repairResult.data;
    }

    applySaveData(ctx, data);
    return computeOfflineAndFinalize(ctx);
  } catch (e) {
    gameLog.error('ThreeKingdomsEngine.load 旧格式加载失败:', e);
    return null;
  }
}

/** 从 JSON 字符串反序列化（不从 localStorage 读取） */
export function applyDeserialize(ctx: SaveContext, json: string): void {
  let data: GameSaveData = JSON.parse(json);

  // 蓝图修复：用引擎默认数据补全反序列化数据缺失/错误字段
  const blueprint = buildSaveData(ctx);
  const repairResult = repairWithBlueprint(data, blueprint);
  if (repairResult.repaired) {
    gameLog.info(`[SaveRepair] 反序列化数据修复完成，共 ${repairResult.logs.length} 处修正`);
    for (const log of repairResult.logs) {
      gameLog.info(`[SaveRepair] ${log.action}: ${log.field}`);
    }
    data = repairResult.data;
  }

  applySaveData(ctx, data);
}

// ─────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────

/** 将 GameSaveData 恢复到各子系统 */
function applySaveData(ctx: SaveContext, data: GameSaveData): void {
  ctx.building.deserialize(data.building);
  ctx.resource.deserialize(data.resource);
  if (data.calendar) {
    ctx.calendar.deserialize(data.calendar);
  }

  // ── 武将系统 v1.0 → v2.0 迁移 ──
  // v1.0 存档无 hero/recruit 字段，HeroSystem/HeroRecruitSystem 保持构造函数创建的空状态，
  // 后续由 finalizeLoad() → initHeroSystems() 注入资源回调即可正常工作。
  if (data.hero) {
    ctx.hero.deserialize(data.hero);
  } else {
    gameLog.info('[Save] v1.0 存档迁移：无武将数据，自动初始化空武将系统');
  }

  // ── 招募系统 v1.0 → v2.0 迁移 ──
  if (data.recruit) {
    ctx.recruit.deserialize(data.recruit);
  } else {
    gameLog.info('[Save] v1.0 存档迁移：无招募数据，保底计数器从 0 开始');
  }

  // ── 编队系统 v2.0 ──
  if (data.formation) {
    ctx.formation.deserialize(data.formation);
  }

  // ── 关卡系统 v3.0 ──
  if (data.campaign) {
    ctx.campaign.deserialize(data.campaign);
  } else {
    gameLog.info('[Save] v2.0 存档迁移：无关卡数据，自动初始化空关卡进度');
  }

  // ── 科技系统 v4.0 ──
  if (data.tech) {
    ctx.techTree.deserialize({
      completedTechIds: data.tech.completedTechIds,
      chosenMutexNodes: data.tech.chosenMutexNodes,
    });
    ctx.techResearch.deserialize({
      activeResearch: data.tech.activeResearch,
      researchQueue: data.tech.researchQueue,
    });
    ctx.techPoint.deserialize({
      techPoints: data.tech.techPoints,
    });
    // FIX-502: 反序列化融合科技系统
    if (data.tech.fusionTechData && ctx.fusionTech) {
      ctx.fusionTech.deserialize(data.tech.fusionTechData);
    }
    // FIX-503: 反序列化离线研究系统
    if (data.tech.offlineResearchData && ctx.techOffline) {
      ctx.techOffline.deserialize(data.tech.offlineResearchData);
    }
  } else {
    gameLog.info('[Save] v3.0 存档迁移：无科技数据，自动初始化空科技系统');
  }

  // ── 装备系统 v5.0 ──
  if (data.equipment && ctx.equipment) {
    ctx.equipment.deserialize(data.equipment);
  }

  // ── 装备炼制系统 v10.0 ──
  if (data.equipmentForge && ctx.equipmentForge) {
    ctx.equipmentForge.deserialize(data.equipmentForge);
  }

  // ── 装备强化系统 v10.0 ──
  if (data.equipmentEnhance && ctx.equipmentEnhance) {
    ctx.equipmentEnhance.deserialize(data.equipmentEnhance);
  }

  // ── 贸易系统 v5.0 ──
  if (data.trade && ctx.trade) {
    ctx.trade.deserialize(data.trade);
  }

  // ── 商队系统 v5.0 (FIX-805: R1 存档接入) ──
  if (data.caravan && ctx.caravan) {
    ctx.caravan.deserialize(data.caravan);
  }

  // ── 商店系统 v5.0 ──
  if (data.shop && ctx.shop) {
    ctx.shop.deserialize(data.shop);
  }

  // ── 声望系统 v14.0 ──
  if (data.prestige && ctx.prestige) {
    ctx.prestige.loadSaveData(data.prestige);
  }

  // FIX-508: 转生系统 v14.0 — 从 prestige save 中恢复 rebirth 数据
  if (data.prestige?.rebirth && ctx.rebirth) {
    ctx.rebirth.loadSaveData({ rebirth: data.prestige.rebirth });
  }

  // FIX-506: 声望商店系统 v14.0 — 恢复商店购买记录
  if (data.prestige?.prestige && ctx.prestigeShop) {
    ctx.prestigeShop.loadSaveData({
      shopPurchases: data.prestige.prestige.shopPurchases,
      prestigePoints: data.prestige.prestige.currentPoints,
      prestigeLevel: data.prestige.prestige.currentLevel,
    });
  }

  // ── 传承系统 v14.0 ──
  if (data.heritage && ctx.heritage) {
    ctx.heritage.loadSaveData(data.heritage);
  }

  // ── 成就系统 v14.0 ──
  if (data.achievement && ctx.achievement) {
    ctx.achievement.loadSaveData(data.achievement);
  }

  // ── PvP 竞技场系统 v7.0 ──
  if (data.pvpArena && ctx.arena) {
    ctx.arena.deserialize(data.pvpArena);
  } else {
    gameLog.info('[Save] v7.0 存档迁移：无竞技场数据，自动初始化默认状态');
  }

  // ── 竞技商店系统 v7.0 ──
  if (data.pvpArenaShop && ctx.arenaShop) {
    ctx.arenaShop.deserialize(data.pvpArenaShop);
  }

  // ── 排行榜系统 v7.0 ──
  if (data.pvpRanking && ctx.ranking) {
    ctx.ranking.deserialize(data.pvpRanking);
  }

  // ── 事件触发系统 v7.0 ──
  if (data.eventTrigger && ctx.eventTrigger) {
    ctx.eventTrigger.deserialize(data.eventTrigger);
  } else {
    gameLog.info('[Save] v7.0 存档迁移：无事件触发数据，自动初始化默认事件');
  }

  // ── 事件通知系统 v7.0 ──
  if (data.eventNotification && ctx.eventNotification) {
    ctx.eventNotification.importSaveData(data.eventNotification);
  }

  // ── 事件UI通知 v7.0 ──
  if (data.eventUI && ctx.eventUI) {
    ctx.eventUI.deserialize(data.eventUI);
  }

  // ── 事件链系统 v7.0 ──
  if (data.eventChain && ctx.eventChain) {
    ctx.eventChain.deserialize(data.eventChain);
  }

  // ── 事件日志系统 v7.0 ──
  if (data.eventLog && ctx.eventLog) {
    ctx.eventLog.importSaveData(data.eventLog);
  }

  // ── 离线事件系统 v15.0 ──
  if (data.offlineEvent && ctx.offlineEvent) {
    ctx.offlineEvent.importSaveData(data.offlineEvent as Parameters<typeof ctx.offlineEvent.importSaveData>[0]);
  }

  // ── 赛季系统 v16.0 ──
  if (data.season && ctx.season) {
    ctx.season.loadSaveData(data.season);
  }

  // ── 扫荡系统 v4.0 ──
  if (data.sweep && ctx.sweep) {
    ctx.sweep.deserialize(data.sweep);
  }

  // ── VIP系统 v9.4 ──
  if (data.vip && ctx.vip) {
    ctx.vip.deserialize(data.vip);
  }

  // ── 挑战关卡系统 v11 ──
  if (data.challenge && ctx.challenge) {
    ctx.challenge.deserialize(data.challenge);
  }

  // ── 武将子系统 v17.0 (FIX-301: R3 保存/加载覆盖) ──
  if (data.heroStar && ctx.heroStar) {
    ctx.heroStar.deserialize(data.heroStar);
  } else {
    gameLog.info('[Save] v17.0 存档迁移：无升星数据，自动初始化默认状态');
  }

  if (data.skillUpgrade && ctx.skillUpgrade) {
    ctx.skillUpgrade.deserialize(data.skillUpgrade);
  } else {
    gameLog.info('[Save] v17.0 存档迁移：无技能升级数据，自动初始化默认状态');
  }

  if (data.heroDispatch && ctx.heroDispatch) {
    ctx.heroDispatch.deserialize(data.heroDispatch);
  } else {
    gameLog.info('[Save] v17.0 存档迁移：无派驻数据，自动初始化默认状态');
  }

  if (data.awakening && ctx.awakening) {
    ctx.awakening.deserialize(data.awakening);
  } else {
    gameLog.info('[Save] v17.0 存档迁移：无觉醒数据，自动初始化默认状态');
  }

  if (data.recruitTokenEconomy && ctx.recruitTokenEconomy) {
    ctx.recruitTokenEconomy.deserialize(data.recruitTokenEconomy);
  } else {
    gameLog.info('[Save] v17.0 存档迁移：无招贤令经济数据，自动初始化默认状态');
  }

  // ── 远征系统 v12.0 (FIX-601: R1 保存/加载覆盖) ──
  if (data.expedition && ctx.expedition) {
    ctx.expedition.deserialize(data.expedition);
  } else {
    gameLog.info('[Save] v12.0 存档迁移：无远征数据，自动初始化默认远征状态');
  }

  // ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
  if (data.npc && ctx.npc) {
    ctx.npc.importSaveData(data.npc);
  } else {
    gameLog.info('[Save] v19.0 存档迁移：无NPC数据，自动初始化默认NPC状态');
  }

  // ── 地图子系统 (FIX-714: R2 存档接入) ──
  if (data.worldMap && ctx.worldMap) {
    ctx.worldMap.deserialize(data.worldMap);
  } else {
    gameLog.info('[Save] 地图存档迁移：无世界地图数据，自动初始化默认状态');
  }
  if (data.territory && ctx.territory) {
    ctx.territory.deserialize(data.territory);
  } else {
    gameLog.info('[Save] 地图存档迁移：无领土数据，自动初始化默认状态');
  }
  if (data.siege && ctx.siege) {
    ctx.siege.deserialize(data.siege);
  } else {
    gameLog.info('[Save] 地图存档迁移：无攻城数据，自动初始化默认状态');
  }
  if (data.garrison && ctx.garrison) {
    ctx.garrison.deserialize(data.garrison);
  } else {
    gameLog.info('[Save] 地图存档迁移：无驻防数据，自动初始化默认状态');
  }
  if (data.siegeEnhancer && ctx.siegeEnhancer) {
    ctx.siegeEnhancer.deserialize(data.siegeEnhancer);
  } else {
    gameLog.info('[Save] 地图存档迁移：无攻城增强数据，自动初始化默认状态');
  }
  if (data.mapEvent && ctx.mapEvent) {
    ctx.mapEvent.deserialize(data.mapEvent);
  } else {
    gameLog.info('[Save] 地图存档迁移：无地图事件数据，自动初始化默认状态');
  }

  // ── 离线收益系统 v9.0 (FIX-816: R1 存档接入) ──
  if (data.offlineReward && ctx.offlineReward) {
    ctx.offlineReward.deserialize(data.offlineReward);
  } else {
    gameLog.info('[Save] v9.0 存档迁移：无离线收益数据，自动初始化默认状态');
  }
  if (data.offlineSnapshot && ctx.offlineSnapshot) {
    // OfflineSnapshotSystem uses loadSaveData internally via constructor,
    // but we also support explicit restore here
    try {
      const saveData = data.offlineSnapshot;
      if (saveData.lastOfflineTime) {
        ctx.offlineSnapshot.createSnapshot({
          resources: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
          productionRates: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 },
          caps: { grain: 0, gold: null, troops: 0, mandate: null, techPoint: null, recruitToken: null, skillBook: null },
        });
      }
    } catch {
      gameLog.info('[Save] 离线快照恢复失败，使用默认状态');
    }
  } else {
    gameLog.info('[Save] v9.0 存档迁移：无离线快照数据，自动初始化默认状态');
  }

  // ── 铜钱经济系统 (FIX-720: Resource R1 存档接入) ──
  if (data.copperEconomy && ctx.copperEconomy) {
    ctx.copperEconomy.deserialize(data.copperEconomy);
  } else {
    gameLog.info('[Save] 铜钱经济存档迁移：无铜钱经济数据，自动初始化默认状态');
  }

  // ── 材料经济系统 (FIX-721: Resource R1 存档接入) ──
  if (data.materialEconomy && ctx.materialEconomy) {
    ctx.materialEconomy.deserialize(data.materialEconomy);
  } else {
    gameLog.info('[Save] 材料经济存档迁移：无材料经济数据，自动初始化默认状态');
  }

  // ── 联盟系统 v13.0+ (FIX-P0-001: Alliance R1 存档接入) ──
  if (data.alliance && ctx.allianceSystem) {
    const { playerState, alliance } = ctx.allianceSystem.deserialize(data.alliance);
    ctx.allianceSystem.resetAllianceData(alliance, playerState);
  } else {
    gameLog.info('[Save] v13.0 存档迁移：无联盟数据，自动初始化默认联盟状态');
  }

  // ── 联盟任务系统 (FIX-P0-002: Alliance R1 存档接入) ──
  if (data.allianceTask && ctx.allianceTaskSystem) {
    ctx.allianceTaskSystem.deserialize(data.allianceTask);
  } else {
    gameLog.info('[Save] v13.0 存档迁移：无联盟任务数据，自动初始化默认任务状态');
  }

  // ── 联盟商店系统 (FIX-P0-003: Alliance R1 存档接入) ──
  if (data.allianceShop && ctx.allianceShopSystem) {
    ctx.allianceShopSystem.deserialize(data.allianceShop);
  } else {
    gameLog.info('[Save] v13.0 存档迁移：无联盟商店数据，自动初始化默认商店状态');
  }

  // ── 社交系统 v6.0+ (FIX-R2-P0-02: Social R2 存档状态写回) ──
  if (data.social && ctx.friendSystem) {
    const socialState = ctx.friendSystem.deserialize(data.social);
    // FIX-R2-P0-02: 将反序列化的状态写回引擎上下文
    // FriendSystem 纯函数模式 → 需要外部持有当前 state
    if (ctx.setSocialState) {
      ctx.setSocialState(socialState);
    }
    gameLog.info('[Save] 社交系统存档恢复成功');
  } else {
    gameLog.info('[Save] v6.0 存档迁移：无社交数据，自动初始化默认社交状态');
  }

  if (data.leaderboard && ctx.socialLeaderboardSystem) {
    ctx.socialLeaderboardSystem.deserialize(data.leaderboard);
    gameLog.info('[Save] 排行榜系统存档恢复成功');
  } else {
    gameLog.info('[Save] v6.0 存档迁移：无排行榜数据，自动初始化默认排行榜状态');
  }

  // ── 新手引导系统 (FIX-T04: Tutorial R1 存档接入) ──
  if (data.tutorialGuide && ctx.tutorialGuide) {
    ctx.tutorialGuide.loadSaveData(data.tutorialGuide);
    gameLog.info('[Save] 新手引导系统存档恢复成功');
  } else {
    gameLog.info('[Save] 新手引导存档迁移：无引导数据，自动初始化默认引导状态');
  }

  // ── 羁绊系统 (FIX-B04: Bond R1 存档接入) ──
  if (data.bond && ctx.bond) {
    ctx.bond.loadSaveData(data.bond);
    gameLog.info('[Save] 羁绊系统存档恢复成功');
  } else {
    gameLog.info('[Save] 羁绊系统存档迁移：无羁绊数据，自动初始化默认状态');
  }

  syncBuildingToResource({
    resource: ctx.resource,
    building: ctx.building,
    calendar: ctx.calendar,
    hero: ctx.hero,
    campaign: ctx.campaign,
    techTree: ctx.techTree,
    techPoint: ctx.techPoint,
    techResearch: ctx.techResearch,
    bus: ctx.bus,
    prevResourcesJson: '',
    prevRatesJson: '',
  });
}

/** 计算离线收益并完成加载 */
function computeOfflineAndFinalize(ctx: SaveContext): OfflineEarnings | null {
  const lastSaveTime = ctx.resource.getLastSaveTime();
  const offlineMs = Date.now() - lastSaveTime;
  let offlineEarnings: OfflineEarnings | undefined;

  if (offlineMs > 0) {
    const offlineSeconds = offlineMs / 1000;
    offlineEarnings = ctx.resource.applyOfflineEarnings(offlineSeconds);

    if (offlineEarnings.earned.grain > 0 ||
        offlineEarnings.earned.gold > 0 ||
        offlineEarnings.earned.troops > 0 ||
        offlineEarnings.earned.mandate > 0) {
      ctx.bus.emit('game:offline-earnings', offlineEarnings);
    }
  }

  // 初始化日历子系统依赖
  const calendarDeps: ISystemDeps = {
    eventBus: ctx.bus,
    config: ctx.configRegistry,
    registry: ctx.registry,
  };
  ctx.calendar.init(calendarDeps);

  ctx.onlineSeconds = 0;

  ctx.bus.emit('game:loaded', { offlineEarnings });
  return offlineEarnings ?? null;
}
