/**
 * 引擎存档内部逻辑
 *
 * 从 ThreeKingdomsEngine 中拆分出的存档/读档流程。
 * 职责：序列化、反序列化、离线收益计算、旧格式兼容
 *
 * 格式转换逻辑委托给 engine-save-migration.ts。
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
import type { TechTreeSystem } from './tech/TechTreeSystem';
import type { TechPointSystem } from './tech/TechPointSystem';
import type { TechResearchSystem } from './tech/TechResearchSystem';
import type { EventBus } from '../core/events/EventBus';
import type { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import type { ConfigRegistry } from '../core/config/ConfigRegistry';
import type {
  GameSaveData,
  OfflineEarnings,
} from '../shared/types';
import type { TechSaveData } from './tech/tech.types';
import type { IGameState } from '../core/types/state';
import type { ISystemDeps } from '../core/types/subsystem';
import type { ArenaSystem } from './pvp/ArenaSystem';
import type { ArenaShopSystem } from './pvp/ArenaShopSystem';
import type { RankingSystem } from './pvp/RankingSystem';
import { ENGINE_SAVE_VERSION } from '../shared/constants';
import { syncBuildingToResource } from './engine-tick';
import { toIGameState, fromIGameState, tryLoadLegacyFormat } from './engine-save-migration';

// Re-export migration functions for backward compatibility
export { toIGameState, fromIGameState, tryLoadLegacyFormat } from './engine-save-migration';

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
  readonly bus: EventBus;
  readonly registry: SubsystemRegistry;
  readonly configRegistry: ConfigRegistry;
  readonly equipment?: import('./equipment/EquipmentSystem').EquipmentSystem;
  readonly equipmentForge?: import('./equipment/EquipmentForgeSystem').EquipmentForgeSystem;
  readonly equipmentEnhance?: import('./equipment/EquipmentEnhanceSystem').EquipmentEnhanceSystem;
  readonly trade?: import('./trade/TradeSystem').TradeSystem;
  readonly shop?: import('./shop/ShopSystem').ShopSystem;
  readonly prestige?: import('./prestige/PrestigeSystem').PrestigeSystem;
  readonly heritage?: import('./heritage/HeritageSystem').HeritageSystem;
  readonly achievement?: import('./achievement/AchievementSystem').AchievementSystem;
  readonly arena?: ArenaSystem;
  readonly arenaShop?: ArenaShopSystem;
  readonly ranking?: RankingSystem;
  readonly eventTrigger?: import('./event/EventTriggerSystem').EventTriggerSystem;
  readonly eventNotification?: import('./event/EventNotificationSystem').EventNotificationSystem;
  readonly eventUI?: import('./event/EventUINotification').EventUINotification;
  readonly eventChain?: import('./event/EventChainSystem').EventChainSystem;
  readonly eventLog?: import('./event/EventLogSystem').EventLogSystem;
  readonly offlineEvent?: import('./event/OfflineEventSystem').OfflineEventSystem;
  onlineSeconds: number;
}

// ─────────────────────────────────────────────
// 序列化
// ─────────────────────────────────────────────

/** 构建完整的 GameSaveData */
export function buildSaveData(ctx: SaveContext): GameSaveData {
  const treeData = ctx.techTree.serialize();
  const researchData = ctx.techResearch.serialize();
  const pointData = ctx.techPoint.serialize();
  const techSaveData: TechSaveData = {
    version: 1,
    completedTechIds: treeData.completedTechIds,
    activeResearch: researchData.activeResearch,
    researchQueue: researchData.researchQueue,
    techPoints: pointData.techPoints,
    chosenMutexNodes: treeData.chosenMutexNodes,
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
    shop: ctx.shop?.serialize(),
    prestige: ctx.prestige?.getSaveData(),
    heritage: ctx.heritage?.getSaveData(),
    achievement: ctx.achievement?.getSaveData(),
    pvpArena: ctx.arena?.serialize(),
    pvpArenaShop: ctx.arenaShop?.serialize(),
    pvpRanking: ctx.ranking?.serialize(),
    eventTrigger: ctx.eventTrigger?.serialize(),
    eventNotification: ctx.eventNotification?.exportSaveData(),
    eventUI: ctx.eventUI?.serialize(),
    eventChain: ctx.eventChain?.serialize(),
    eventLog: ctx.eventLog?.exportSaveData(),
    offlineEvent: ctx.offlineEvent?.exportSaveData() as { version: number; offlineQueue: unknown[]; autoRules: unknown[] },
  };
}

// ─────────────────────────────────────────────
// 反序列化
// ─────────────────────────────────────────────

/** 应用从 SaveManager 加载的 IGameState */
export function applyLoadedState(ctx: SaveContext, state: IGameState): OfflineEarnings | null {
  try {
    const data = fromIGameState(state);

    if (data.version !== ENGINE_SAVE_VERSION) {
      console.warn(
        `Engine: 存档版本不匹配 (期望 ${ENGINE_SAVE_VERSION}，实际 ${data.version})，尝试兼容加载`,
      );
    }

    applySaveData(ctx, data);
    return computeOfflineAndFinalize(ctx);
  } catch (e) {
    console.error('ThreeKingdomsEngine.load 失败:', e);
    return null;
  }
}

/** 应用旧格式存档 */
export function applyLegacyState(ctx: SaveContext, data: GameSaveData): OfflineEarnings | null {
  try {
    applySaveData(ctx, data);
    return computeOfflineAndFinalize(ctx);
  } catch (e) {
    console.error('ThreeKingdomsEngine.load 旧格式加载失败:', e);
    return null;
  }
}

/** 从 JSON 字符串反序列化（不从 localStorage 读取） */
export function applyDeserialize(ctx: SaveContext, json: string): void {
  const data: GameSaveData = JSON.parse(json);
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

  if (data.hero) {
    ctx.hero.deserialize(data.hero);
  } else {
    console.info('[Save] v1.0 存档迁移：无武将数据，自动初始化空武将系统');
  }

  if (data.recruit) {
    ctx.recruit.deserialize(data.recruit);
  } else {
    console.info('[Save] v1.0 存档迁移：无招募数据，保底计数器从 0 开始');
  }

  if (data.formation) {
    ctx.formation.deserialize(data.formation);
  }

  if (data.campaign) {
    ctx.campaign.deserialize(data.campaign);
  } else {
    console.info('[Save] v2.0 存档迁移：无关卡数据，自动初始化空关卡进度');
  }

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
  } else {
    console.info('[Save] v3.0 存档迁移：无科技数据，自动初始化空科技系统');
  }

  // 可选系统恢复
  if (data.equipment && ctx.equipment) ctx.equipment.deserialize(data.equipment);
  if (data.equipmentForge && ctx.equipmentForge) ctx.equipmentForge.deserialize(data.equipmentForge);
  if (data.equipmentEnhance && ctx.equipmentEnhance) ctx.equipmentEnhance.deserialize(data.equipmentEnhance);
  if (data.trade && ctx.trade) ctx.trade.deserialize(data.trade);
  if (data.shop && ctx.shop) ctx.shop.deserialize(data.shop);
  if (data.prestige && ctx.prestige) ctx.prestige.loadSaveData(data.prestige);
  if (data.heritage && ctx.heritage) ctx.heritage.loadSaveData(data.heritage);
  if (data.achievement && ctx.achievement) ctx.achievement.loadSaveData(data.achievement);

  // PvP 系统 v7.0
  if (data.pvpArena && ctx.arena) {
    ctx.arena.deserialize(data.pvpArena);
  } else {
    console.info('[Save] v7.0 存档迁移：无竞技场数据，自动初始化默认状态');
  }
  if (data.pvpArenaShop && ctx.arenaShop) ctx.arenaShop.deserialize(data.pvpArenaShop);
  if (data.pvpRanking && ctx.ranking) ctx.ranking.deserialize(data.pvpRanking);

  // 事件系统 v7.0+
  if (data.eventTrigger && ctx.eventTrigger) {
    ctx.eventTrigger.deserialize(data.eventTrigger);
  } else {
    console.info('[Save] v7.0 存档迁移：无事件触发数据，自动初始化默认事件');
  }
  if (data.eventNotification && ctx.eventNotification) ctx.eventNotification.importSaveData(data.eventNotification);
  if (data.eventUI && ctx.eventUI) ctx.eventUI.deserialize(data.eventUI);
  if (data.eventChain && ctx.eventChain) ctx.eventChain.deserialize(data.eventChain);
  if (data.eventLog && ctx.eventLog) ctx.eventLog.importSaveData(data.eventLog);
  if (data.offlineEvent && ctx.offlineEvent) {
    ctx.offlineEvent.importSaveData(data.offlineEvent as Parameters<typeof ctx.offlineEvent.importSaveData>[0]);
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
