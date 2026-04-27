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
  /** 商店系统（可选，v5.0+） */
  readonly shop?: import('./shop/ShopSystem').ShopSystem;
  /** 声望系统（可选，v14.0+） */
  readonly prestige?: import('./prestige/PrestigeSystem').PrestigeSystem;
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

  // ── 商店系统 v5.0 ──
  if (data.shop && ctx.shop) {
    ctx.shop.deserialize(data.shop);
  }

  // ── 声望系统 v14.0 ──
  if (data.prestige && ctx.prestige) {
    ctx.prestige.loadSaveData(data.prestige);
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
