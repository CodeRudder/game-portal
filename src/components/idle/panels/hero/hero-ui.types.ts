/**
 * hero-ui.types — 武将 UI 层类型辅助定义
 *
 * 解决 UI 组件与引擎层之间的类型桥接问题：
 * - QualityBadge 需要严格的品质联合类型，而 UI 数据流中品质可能为 string
 * - 引擎子系统（heroStar/resource/building）通过 getter 访问，需声明扩展接口
 * - BondEffect 类型在不同上下文有细微差异，需统一适配
 *
 * @module components/idle/panels/hero/hero-ui.types
 */

import type { Quality } from '@/games/three-kingdoms/engine';
import type { BondEffect } from '@/games/three-kingdoms/engine/hero/bond-config';

// ─────────────────────────────────────────────
// 1. 品质类型安全转换
// ─────────────────────────────────────────────

/** QualityBadge 接受的合法品质值 */
export type QualityLiteral = 'COMMON' | 'FINE' | 'RARE' | 'EPIC' | 'LEGENDARY';

/** Quality 枚举的所有值（用于运行时校验） */
export const QUALITY_VALUES: ReadonlySet<string> = new Set<string>([
  'COMMON', 'FINE', 'RARE', 'EPIC', 'LEGENDARY',
]);

/**
 * 将 string 类型的品质值安全转换为 QualityLiteral
 *
 * @param quality - 品质字符串（可能来自引擎 Quality 枚举或 string 类型字段）
 * @param fallback - 无效时的回退值，默认 'COMMON'
 * @returns 合法的品质字面量
 */
export function toQualityLiteral(quality: string, fallback: QualityLiteral = 'COMMON'): QualityLiteral {
  return QUALITY_VALUES.has(quality) ? (quality as QualityLiteral) : fallback;
}

/**
 * 将 Quality 枚举值安全转换为 string
 *
 * Quality 是 string 枚举，可以直接赋值给 string，
 * 但此函数提供显式的类型安全转换点。
 */
export function qualityToString(q: Quality): string {
  return q as string;
}

// ─────────────────────────────────────────────
// 2. 引擎子系统扩展接口
// ─────────────────────────────────────────────

/**
 * HeroStarSystem 的 UI 层访问接口
 *
 * ThreeKingdomsEngine 通过 getHeroStarSystem() 暴露此接口，
 * 但 TypeScript 类型声明中未直接标注，需通过此接口桥接。
 */
export interface HeroStarSystemLike {
  /** 获取武将星级 */
  getStar(generalId: string): number;
  /** 获取等级上限 */
  getLevelCap(generalId: string): number;
  /** 获取突破阶段 */
  getBreakthroughStage(generalId: string): number;
  /** 获取碎片进度 */
  getFragmentProgress(generalId: string): { canStarUp: boolean } | null;
}

/**
 * ResourceSystem 的 UI 层访问接口
 *
 * ThreeKingdomsEngine.resource 公开此接口。
 */
export interface ResourceSystemLike {
  /** 获取资源数量 */
  getAmount(type: string): number;
}

/**
 * BuildingSystem 的 UI 层访问接口
 *
 * ThreeKingdomsEngine.building 公开此接口。
 */
export interface BuildingSystemLike {
  /** 获取所有建筑 */
  getAllBuildings(): Record<string, { level: number }>;
  /** 获取建筑定义 */
  getBuildingDef?(id: string): { name: string } | undefined;
}

/**
 * 技能数据扩展（含 cooldown 等运行时属性）
 *
 * 引擎 SkillData 不包含 cooldown，UI 层需扩展。
 */
export interface SkillDataWithCooldown {
  /** 技能冷却时间（秒） */
  cooldown?: number;
  /** 技能类型 */
  type: string;
}

// ─────────────────────────────────────────────
// 3. BondEffect 适配
// ─────────────────────────────────────────────

/**
 * 将引擎 BondEffect[] 安全适配为可变数组
 *
 * 用于 bondCatalog 数据构建中，引擎 BondEffect 与
 * BondCatalogItem.effects 之间的类型适配。
 * BondEffect 接口在不同模块中有细微差异（stat/value 字段），
 * 此函数通过浅拷贝提供显式的类型适配点并记录原因。
 */
export function adaptBondEffects(effects: readonly BondEffect[]): BondEffect[] {
  return [...effects];
}

// ─────────────────────────────────────────────
// 4. ActiveBond 扩展（含 faction 属性）
// ─────────────────────────────────────────────

/**
 * ActiveBond 可能携带 faction 属性的扩展类型
 *
 * BondSystem 的 ActiveBond 接口未声明 faction，
 * 但运行时阵营羁绊可能携带此字段。
 */
export interface ActiveBondWithFaction {
  readonly bondId: string;
  readonly name: string;
  readonly type: number;
  readonly participants: ReadonlyArray<string>;
  readonly faction?: string;
  [key: string]: unknown;
}
