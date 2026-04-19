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
import type { EventBus } from '../core/events/EventBus';
import type { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import type { ConfigRegistry } from '../core/config/ConfigRegistry';
import type {
  GameSaveData,
  OfflineEarnings,
} from '../shared/types';
import type { CalendarSaveData } from './calendar/calendar.types';
import type { HeroSaveData } from './hero/hero.types';
import type { RecruitSaveData } from './hero/HeroRecruitSystem';
import type { FormationSaveData } from './hero/HeroFormation';
import type { IGameState } from '../core/types/state';
import type { ISystemDeps } from '../core/types/subsystem';
import { ENGINE_SAVE_VERSION, SAVE_KEY } from '../shared/constants';
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
  readonly bus: EventBus;
  readonly registry: SubsystemRegistry;
  readonly configRegistry: ConfigRegistry;
  /** 在线时长（秒） */
  onlineSeconds: number;
}

// ─────────────────────────────────────────────
// 序列化
// ─────────────────────────────────────────────

/** 构建完整的 GameSaveData */
export function buildSaveData(ctx: SaveContext): GameSaveData {
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
  };
}

/** 将 GameSaveData 转换为 IGameState 格式（供 SaveManager 使用） */
export function toIGameState(data: GameSaveData, onlineSeconds: number): IGameState {
  return {
    version: String(data.version),
    timestamp: data.saveTime,
    subsystems: {
      resource: data.resource,
      building: data.building,
      calendar: data.calendar,
      hero: data.hero,
      recruit: data.recruit,
      formation: data.formation,
      campaign: data.campaign,
    },
    metadata: {
      totalPlayTime: onlineSeconds,
      saveCount: 0,
      lastVersion: String(data.version),
    },
  };
}

/** 从 IGameState 提取 GameSaveData */
export function fromIGameState(state: IGameState): GameSaveData {
  return {
    version: Number(state.version),
    saveTime: state.timestamp,
    resource: state.subsystems.resource as any,
    building: state.subsystems.building as any,
    calendar: state.subsystems.calendar as CalendarSaveData | undefined,
    hero: state.subsystems.hero as HeroSaveData | undefined,
    recruit: state.subsystems.recruit as RecruitSaveData | undefined,
    formation: state.subsystems.formation as FormationSaveData | undefined,
    campaign: state.subsystems.campaign as import('./campaign/campaign.types').CampaignSaveData | undefined,
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

    // v1.0 → v2.0 迁移：检测到旧版本存档时确保武将系统字段存在
    // applySaveData 内部已对 hero/recruit 缺失做兼容处理
    applySaveData(ctx, data);
    return computeOfflineAndFinalize(ctx);
  } catch (e) {
    console.error('ThreeKingdomsEngine.load 失败:', e);
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

  // ── 武将系统 v1.0 → v2.0 迁移 ──
  // v1.0 存档无 hero/recruit 字段，HeroSystem/HeroRecruitSystem 保持构造函数创建的空状态，
  // 后续由 finalizeLoad() → initHeroSystems() 注入资源回调即可正常工作。
  if (data.hero) {
    ctx.hero.deserialize(data.hero);
  } else {
    console.info('[Save] v1.0 存档迁移：无武将数据，自动初始化空武将系统');
  }

  // ── 招募系统 v1.0 → v2.0 迁移 ──
  if (data.recruit) {
    ctx.recruit.deserialize(data.recruit);
  } else {
    console.info('[Save] v1.0 存档迁移：无招募数据，保底计数器从 0 开始');
  }

  // ── 编队系统 v2.0 ──
  if (data.formation) {
    ctx.formation.deserialize(data.formation);
  }

  // ── 关卡系统 v3.0 ──
  if (data.campaign) {
    ctx.campaign.deserialize(data.campaign);
  } else {
    console.info('[Save] v2.0 存档迁移：无关卡数据，自动初始化空关卡进度');
  }

  syncBuildingToResource({
    resource: ctx.resource,
    building: ctx.building,
    calendar: ctx.calendar,
    hero: ctx.hero,
    campaign: ctx.campaign,
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
