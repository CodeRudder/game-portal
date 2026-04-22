/**
 * 扩展子系统依赖注入辅助
 *
 * 从 ThreeKingdomsEngine 中拆分出的扩展子系统（mail/shop/currency/equipment等）
 * 的创建、初始化和注册逻辑。
 *
 * @module engine/engine-extended-deps
 */

import { MailSystem } from './mail/MailSystem';
import { MailTemplateSystem } from './mail/MailTemplateSystem';
import { ShopSystem } from './shop/ShopSystem';
import { CurrencySystem } from './currency/CurrencySystem';
import { NPCSystem } from './npc/NPCSystem';
import { EquipmentSystem } from './equipment/EquipmentSystem';
import { EquipmentForgeSystem } from './equipment/EquipmentForgeSystem';
import { EquipmentEnhanceSystem } from './equipment/EquipmentEnhanceSystem';
import { EquipmentSetSystem } from './equipment/EquipmentSetSystem';
import { EquipmentRecommendSystem } from './equipment/EquipmentRecommendSystem';
import { ArenaSystem } from './pvp/ArenaSystem';
import { ArenaSeasonSystem } from './pvp/ArenaSeasonSystem';
import { RankingSystem } from './pvp/RankingSystem';
import { PvPBattleSystem } from './pvp/PvPBattleSystem';
import { DefenseFormationSystem } from './pvp/DefenseFormationSystem';
import { ArenaShopSystem } from './pvp/ArenaShopSystem';
import { ExpeditionSystem } from './expedition/ExpeditionSystem';
import { AllianceSystem } from './alliance/AllianceSystem';
import { AllianceTaskSystem } from './alliance/AllianceTaskSystem';
import { AllianceBossSystem } from './alliance/AllianceBossSystem';
import { AllianceShopSystem } from './alliance/AllianceShopSystem';
import { PrestigeSystem } from './prestige/PrestigeSystem';
import { PrestigeShopSystem } from './prestige/PrestigeShopSystem';
import { RebirthSystem } from './prestige/RebirthSystem';
import { QuestSystem } from './quest/QuestSystem';
import { AchievementSystem } from './achievement/AchievementSystem';
import { FriendSystem } from './social/FriendSystem';
import { ChatSystem } from './social/ChatSystem';
import { LeaderboardSystem as SocialLeaderboardSystem } from './social/LeaderboardSystem';
import { HeritageSystem } from './heritage/HeritageSystem';
import { AdvisorSystem } from './advisor/AdvisorSystem';
import { ActivitySystem } from './activity/ActivitySystem';
import { SignInSystem } from './activity/SignInSystem';
import { TradeSystem } from './trade/TradeSystem';
import { CaravanSystem } from './trade/CaravanSystem';
import { SettingsManager } from './settings/SettingsManager';
import { AccountSystem } from './settings/AccountSystem';
import type { EquipmentSystem as EquipmentSystemType } from './equipment/EquipmentSystem';
import type { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import type { ISystemDeps } from '../core/types';

// ─────────────────────────────────────────────
// R11+ 子系统集合
// ─────────────────────────────────────────────

/** R11+ 子系统集合 */
export interface R11Systems {
  mailSystem: MailSystem;
  mailTemplateSystem: MailTemplateSystem;
  shopSystem: ShopSystem;
  currencySystem: CurrencySystem;
  npcSystem: NPCSystem;
  equipmentSystem: EquipmentSystem;
  equipmentForgeSystem: EquipmentForgeSystem;
  equipmentEnhanceSystem: EquipmentEnhanceSystem;
  equipmentSetSystem: EquipmentSetSystem;
  equipmentRecommendSystem: EquipmentRecommendSystem;
  arenaSystem: ArenaSystem;
  arenaSeasonSystem: ArenaSeasonSystem;
  rankingSystem: RankingSystem;
  pvpBattleSystem: PvPBattleSystem;
  defenseFormationSystem: DefenseFormationSystem;
  arenaShopSystem: ArenaShopSystem;
  expeditionSystem: ExpeditionSystem;
  allianceSystem: AllianceSystem;
  allianceTaskSystem: AllianceTaskSystem;
  allianceBossSystem: AllianceBossSystem;
  allianceShopSystem: AllianceShopSystem;
  prestigeSystem: PrestigeSystem;
  prestigeShopSystem: PrestigeShopSystem;
  rebirthSystem: RebirthSystem;
  questSystem: QuestSystem;
  achievementSystem: AchievementSystem;
  friendSystem: FriendSystem;
  chatSystem: ChatSystem;
  socialLeaderboardSystem: SocialLeaderboardSystem;
  heritageSystem: HeritageSystem;
  advisorSystem: AdvisorSystem;
  activitySystem: ActivitySystem;
  signInSystem: SignInSystem;
  tradeSystem: TradeSystem;
  caravanSystem: CaravanSystem;
  settingsManager: SettingsManager;
  accountSystem: AccountSystem;
}

// ─────────────────────────────────────────────
// 创建 R11+ 子系统
// ─────────────────────────────────────────────

/**
 * 创建所有R11+子系统实例
 */
export function createR11Systems(equipmentSystem?: EquipmentSystemType): R11Systems {
  const eq = equipmentSystem ?? new EquipmentSystem();
  const setSystem = new EquipmentSetSystem(eq);
  return {
    mailSystem: new MailSystem(),
    mailTemplateSystem: new MailTemplateSystem(),
    shopSystem: new ShopSystem(),
    currencySystem: new CurrencySystem(),
    npcSystem: new NPCSystem(),
    equipmentSystem: eq,
    equipmentForgeSystem: new EquipmentForgeSystem(eq),
    equipmentEnhanceSystem: new EquipmentEnhanceSystem(eq),
    equipmentSetSystem: setSystem,
    equipmentRecommendSystem: new EquipmentRecommendSystem(eq, setSystem),
    arenaSystem: new ArenaSystem(),
    arenaSeasonSystem: new ArenaSeasonSystem(),
    rankingSystem: new RankingSystem(),
    pvpBattleSystem: new PvPBattleSystem(),
    defenseFormationSystem: new DefenseFormationSystem(),
    arenaShopSystem: new ArenaShopSystem(),
    expeditionSystem: new ExpeditionSystem(),
    allianceSystem: new AllianceSystem(),
    allianceTaskSystem: new AllianceTaskSystem(),
    allianceBossSystem: new AllianceBossSystem(),
    allianceShopSystem: new AllianceShopSystem(),
    prestigeSystem: new PrestigeSystem(),
    prestigeShopSystem: new PrestigeShopSystem(),
    rebirthSystem: new RebirthSystem(),
    questSystem: new QuestSystem(),
    achievementSystem: new AchievementSystem(),
    friendSystem: new FriendSystem(),
    chatSystem: new ChatSystem(),
    socialLeaderboardSystem: new SocialLeaderboardSystem(),
    heritageSystem: new HeritageSystem(),
    advisorSystem: new AdvisorSystem(),
    activitySystem: new ActivitySystem(),
    signInSystem: new SignInSystem(),
    tradeSystem: new TradeSystem(),
    caravanSystem: new CaravanSystem(),
    settingsManager: new SettingsManager(),
    accountSystem: new AccountSystem(),
  };
}

// ─────────────────────────────────────────────
// 注册 R11+ 子系统
// ─────────────────────────────────────────────

/**
 * 注册所有R11+子系统到注册表
 */
export function registerR11Systems(registry: SubsystemRegistry, systems: R11Systems): void {
  const r = registry;
  r.register('mail', systems.mailSystem);
  r.register('mailTemplate', systems.mailTemplateSystem);
  r.register('shop', systems.shopSystem);
  r.register('currency', systems.currencySystem);
  r.register('npc', systems.npcSystem);
  r.register('equipment', systems.equipmentSystem);
  r.register('equipmentForge', systems.equipmentForgeSystem);
  r.register('equipmentEnhance', systems.equipmentEnhanceSystem);
  r.register('equipmentSet', systems.equipmentSetSystem);
  r.register('equipmentRecommend', systems.equipmentRecommendSystem);
  r.register('arena', systems.arenaSystem);
  r.register('arenaSeason', systems.arenaSeasonSystem);
  r.register('ranking', systems.rankingSystem);
  r.register('pvpBattle', systems.pvpBattleSystem);
  r.register('defenseFormation', systems.defenseFormationSystem);
  r.register('arenaShop', systems.arenaShopSystem);
  r.register('expedition', systems.expeditionSystem);
  r.register('alliance', systems.allianceSystem);
  r.register('allianceTask', systems.allianceTaskSystem);
  r.register('allianceBoss', systems.allianceBossSystem);
  r.register('allianceShop', systems.allianceShopSystem);
  r.register('prestige', systems.prestigeSystem);
  r.register('prestigeShop', systems.prestigeShopSystem);
  r.register('rebirth', systems.rebirthSystem);
  r.register('quest', systems.questSystem);
  r.register('achievement', systems.achievementSystem);
  r.register('friend', systems.friendSystem);
  r.register('chat', systems.chatSystem);
  r.register('socialLeaderboard', systems.socialLeaderboardSystem);
  r.register('heritage', systems.heritageSystem);
  r.register('advisor', systems.advisorSystem);
  r.register('activity', systems.activitySystem);
  r.register('signIn', systems.signInSystem);
  r.register('trade', systems.tradeSystem);
  r.register('caravan', systems.caravanSystem);
  r.register('settings', systems.settingsManager);
  r.register('account', systems.accountSystem);
}

/**
 * 初始化R11+子系统（需要deps的）
 */
export function initR11Systems(systems: R11Systems, deps: ISystemDeps): void {
  systems.npcSystem.init(deps);
  systems.equipmentSystem.init(deps);
  systems.equipmentForgeSystem.init(deps);
}

/**
 * 重置R11+子系统
 */
export function resetR11Systems(systems: R11Systems): void {
  systems.mailSystem.reset();
  systems.mailTemplateSystem.reset();
  systems.shopSystem.reset();
  systems.currencySystem.reset();
  systems.tradeSystem.reset();
  systems.caravanSystem.reset();
  systems.npcSystem.reset();
  systems.equipmentSystem.reset();
  systems.equipmentForgeSystem.reset();
  systems.equipmentEnhanceSystem.reset();
  systems.prestigeSystem.reset();
  systems.prestigeShopSystem.reset();
  systems.rebirthSystem.reset();
  systems.questSystem.reset();
  systems.achievementSystem.reset();
  systems.heritageSystem.reset();
  systems.advisorSystem.reset();
  systems.accountSystem.reset();
}
