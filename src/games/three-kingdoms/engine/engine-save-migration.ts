/**
 * 引擎存档 — 旧格式迁移与格式转换
 *
 * 从 engine-save.ts 拆分出的格式转换和迁移逻辑。
 * 职责：IGameState ↔ GameSaveData 转换、旧格式检测与加载
 *
 * @module engine/engine-save-migration
 */

import type {
  GameSaveData,
  ResourceSaveData,
  BuildingSaveData,
} from '../shared/types';
import type { CalendarSaveData } from './calendar/calendar.types';
import type { HeroSaveData } from './hero/hero.types';
import type { RecruitSaveData } from './hero/HeroRecruitSystem';
import type { FormationSaveData } from './hero/HeroFormation';
import type { TechSaveData } from './tech/tech.types';
import type { IGameState } from '../core/types/state';
import { SAVE_KEY } from '../shared/constants';

// ─────────────────────────────────────────────
// IGameState ↔ GameSaveData 转换
// ─────────────────────────────────────────────

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
  // ── 社交系统 v6.0+ (FIX-P0-01: Social R1 存档接入) ──
  if (data.social) subsystems.social = data.social;
  if (data.leaderboard) subsystems.leaderboard = data.leaderboard;

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
    // ── 社交系统 v6.0+ (FIX-P0-01: Social R1 存档接入) ──
    social: s.social as import('../core/social/social.types').SocialSaveData | undefined,
    leaderboard: s.leaderboard as import('./social/leaderboard-types').LeaderboardState | undefined,
  };
}

// ─────────────────────────────────────────────
// 旧格式检测与加载
// ─────────────────────────────────────────────

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
