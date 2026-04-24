/**
 * 资源域 — 纯计算逻辑
 *
 * 职责：无状态的计算函数（加成、上限查表、容量警告）
 * 离线收益相关函数已迁移至 OfflineEarningsCalculator.ts
 * 规则：不持有任何状态，所有数据通过参数传入，可引用 resource-config 和 resource.types
 */

import type {
  ResourceType,
  Resources,
  Bonuses,
  CapWarning,
  CapWarningLevel,
} from './resource.types';
import { RESOURCE_TYPES } from './resource.types';
import {
  CAP_WARNING_THRESHOLDS,
  GRANARY_CAPACITY_TABLE,
  BARRACKS_CAPACITY_TABLE,
} from './resource-config';

// ─────────────────────────────────────────────
// 1. 辅助工厂
// ─────────────────────────────────────────────

/** 创建一个全零的 Resources 对象 */
export function zeroResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
}

/** 克隆 Resources */
export function cloneResources(r: Resources): Resources {
  return { grain: r.grain, gold: r.gold, troops: r.troops, mandate: r.mandate, techPoint: r.techPoint, recruitToken: r.recruitToken };
}

// ─────────────────────────────────────────────
// 2. 加成计算
// ─────────────────────────────────────────────

/**
 * 计算加成乘数：Π(1 + 各类加成)，乘法叠加
 *
 * 支持的加成类型（BonusType）：
 *   - castle  : 主城加成 — v5.0 已接入
 *   - tech    : 科技加成 — v5.1 预留（值始终为 0）
 *   - hero    : 武将加成 — v5.2 预留（值始终为 0）
 *   - rebirth : 转生加成 — v5.3 预留（值始终为 0）
 *   - vip     : VIP加成  — v5.4 预留（值始终为 0）
 *
 * 扩展方式：在 ThreeKingdomsEngine.tick() 中组装 Bonuses 对象，
 * 将对应类型的值从 0 改为实际加成百分比即可，本方法无需修改。
 */
export function calculateBonusMultiplier(bonuses?: Bonuses): number {
  if (!bonuses) return 1;
  let multiplier = 1;
  for (const value of Object.values(bonuses)) {
    if (value !== undefined) {
      multiplier *= (1 + value);
    }
  }
  return multiplier;
}

// ─────────────────────────────────────────────
// 3. 上限查表
// ─────────────────────────────────────────────

/**
 * 根据建筑等级查表获取上限
 * @param level 建筑等级
 * @param table 查哪张表：'granary' 粮仓 / 'barracks' 兵营
 */
export function lookupCap(level: number, table: 'granary' | 'barracks'): number {
  const capacityTable = table === 'granary' ? GRANARY_CAPACITY_TABLE : BARRACKS_CAPACITY_TABLE;

  // 找到 <= level 的最大 key
  const keys = Object.keys(capacityTable)
    .map(Number)
    .sort((a, b) => a - b);

  let result = capacityTable[1]; // 最低等级
  for (const key of keys) {
    if (key <= level) {
      result = capacityTable[key];
    } else {
      break;
    }
  }

  // 超过最大等级时，线性外推
  const maxKey = keys[keys.length - 1];
  if (level > maxKey) {
    const lastCap = capacityTable[maxKey];
    const prevCap = capacityTable[keys[keys.length - 2]] ?? 0;
    const incrementPerLevel = (lastCap - prevCap) / (maxKey - (keys[keys.length - 2] ?? 0));
    result = lastCap + Math.floor((level - maxKey) * incrementPerLevel);
  }

  return result;
}

// ─────────────────────────────────────────────
// 4. 容量警告
// ─────────────────────────────────────────────

/** 根据百分比判定警告等级 */
export function getWarningLevel(percentage: number): CapWarningLevel {
  if (percentage >= 1) return 'full';
  if (percentage >= CAP_WARNING_THRESHOLDS.urgent) return 'urgent';
  if (percentage >= CAP_WARNING_THRESHOLDS.warning) return 'warning';
  if (percentage >= CAP_WARNING_THRESHOLDS.notice) return 'notice';
  return 'safe';
}

/**
 * 计算所有有上限资源的容量警告
 */
export function calculateCapWarnings(
  resources: Readonly<Resources>,
  caps: Readonly<Record<ResourceType, number | null>>,
): CapWarning[] {
  const warnings: CapWarning[] = [];

  for (const type of RESOURCE_TYPES) {
    const cap = caps[type];
    if (cap === null) continue; // 无上限资源跳过

    const current = resources[type];
    const percentage = current / cap;
    const level = getWarningLevel(percentage);

    warnings.push({ resourceType: type, level, current, cap, percentage });
  }

  return warnings;
}

/**
 * 计算指定资源的容量警告
 */
export function calculateCapWarning(
  type: ResourceType,
  resources: Readonly<Resources>,
  caps: Readonly<Record<ResourceType, number | null>>,
): CapWarning | null {
  const cap = caps[type];
  if (cap === null) return null;

  const current = resources[type];
  const percentage = current / cap;
  const level = getWarningLevel(percentage);

  return { resourceType: type, level, current, cap, percentage };
}


