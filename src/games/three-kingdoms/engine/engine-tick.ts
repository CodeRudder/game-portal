/**
 * 引擎 Tick 内部逻辑
 *
 * 从 ThreeKingdomsEngine 中拆分出的 tick 流程编排。
 * 职责：驱动各子系统 update、处理建筑完成、计算加成、变化检测
 *
 * @module engine/engine-tick
 */

import type { ResourceSystem } from './resource/ResourceSystem';
import type { BuildingSystem } from './building/BuildingSystem';
import type { CalendarSystem } from './calendar/CalendarSystem';
import type { HeroSystem } from './hero/HeroSystem';
import type { CampaignProgressSystem } from './campaign/CampaignProgressSystem';
import type { TechTreeSystem } from './tech/TechTreeSystem';
import type { TechPointSystem } from './tech/TechPointSystem';
import type { TechResearchSystem } from './tech/TechResearchSystem';
import type { EventBus } from '../core/events/EventBus';
import type { Bonuses } from './resource/resource.types';
import type { BuildingType } from './building/building.types';

// ─────────────────────────────────────────────
// Tick 上下文
// ─────────────────────────────────────────────

/**
 * tick() 执行时需要访问的引擎上下文
 *
 * 以接口形式解耦，避免 engine-tick 直接依赖 ThreeKingdomsEngine 实例
 */
export interface TickContext {
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;
  readonly calendar: CalendarSystem;
  readonly hero: HeroSystem;
  readonly campaign: CampaignProgressSystem;
  readonly techTree: TechTreeSystem;
  readonly techPoint: TechPointSystem;
  readonly techResearch: TechResearchSystem;
  readonly bus: EventBus;
  /** 变化检测用的缓存 JSON */
  prevResourcesJson: string;
  prevRatesJson: string;
}

// ─────────────────────────────────────────────
// Tick 执行
// ─────────────────────────────────────────────

/**
 * 执行单帧 tick 逻辑
 *
 * 流程：
 *  1. 日历推进（现实秒 → 游戏天数）
 *  2. 建筑升级计时 → 返回本帧完成的建筑
 *  3. 处理升级完成的建筑（联动更新产出/上限）
 *  4. 资源产出（含各类加成）
 *  5. 武将系统更新
 *  6. 变化检测 → 发出事件
 *
 * @param ctx   - tick 上下文
 * @param dtSec - 本帧时间增量（秒）
 */
export function executeTick(ctx: TickContext, dtSec: number): void {
  // 1. 日历推进
  ctx.calendar.update(dtSec);

  // 2. 建筑升级计时
  const completed = ctx.building.tick();

  // 3. 处理升级完成的建筑
  if (completed.length > 0) {
    syncBuildingToResource(ctx);
    for (const type of completed) {
      const level = ctx.building.getLevel(type);
      ctx.bus.emit('building:upgraded', { type, level });
    }
  }

  // 4. 资源产出（含各类加成）
  // ── 加成框架 v5.0 ──
  const castleMultiplier = ctx.building.getCastleBonusMultiplier();

  // 科技加成：同步书院等级到科技点系统，并获取科技加成
  const academyLevel = ctx.building.getLevel('academy');
  ctx.techPoint.syncAcademyLevel(academyLevel);
  ctx.techPoint.update(dtSec);
  ctx.techResearch.update(dtSec);

  // 同步研究速度加成（来自文化路线科技）
  const researchSpeedBonus = ctx.techTree.getEffectValue('research_speed', 'all');
  ctx.techPoint.syncResearchSpeedBonus(researchSpeedBonus);

  const techBonus = ctx.techTree.getTechBonusMultiplier();

  const bonuses: Bonuses = {
    castle: castleMultiplier - 1, // v5.0 主城加成
    tech:   techBonus,            // v5.1 科技加成
    hero:   0,                    // v5.2 武将加成（预留）
    rebirth: 0,                   // v5.3 转生加成（预留）
    vip:    0,                    // v5.4 VIP加成（预留）
  };
  ctx.resource.tick(dtSec * 1000, bonuses);

  // 5. 武将系统更新
  ctx.hero.update(dtSec);

  // 5.5 关卡进度系统更新（事件驱动，通常为空操作）
  ctx.campaign.update(dtSec);

  // 6. 变化检测 → 发出事件
  detectAndEmitChanges(ctx);
}

// ─────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────

/** 将建筑系统状态同步到资源系统（产出速率 + 资源上限） */
export function syncBuildingToResource(ctx: TickContext): void {
  const productions = ctx.building.calculateTotalProduction();
  ctx.resource.recalculateProduction(productions);

  const levels = ctx.building.getProductionBuildingLevels();
  ctx.resource.updateCaps(
    levels['farmland'] ?? 0,
    levels['barracks'] ?? 0,
  );
}

/** 检测资源和产出速率变化，发出对应事件 */
function detectAndEmitChanges(ctx: TickContext): void {
  const resources = ctx.resource.getResources();
  const rates = ctx.resource.getProductionRates();

  const resJson = JSON.stringify(resources);
  if (resJson !== ctx.prevResourcesJson) {
    ctx.prevResourcesJson = resJson;
    ctx.bus.emit('resource:changed', { resources });
  }

  const ratesJson = JSON.stringify(rates);
  if (ratesJson !== ctx.prevRatesJson) {
    ctx.prevRatesJson = ratesJson;
    ctx.bus.emit('resource:rate-changed', { rates });
  }
}
