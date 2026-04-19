/**
 * 建筑域 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 数值来源：BLD-buildings-prd.md
 */

import type {
  BuildingType,
  BuildingDef,
  LevelData,
  QueueConfig,
} from './building.types';

// ─────────────────────────────────────────────
// 1. 建筑等级上限 & 解锁条件
// ─────────────────────────────────────────────

/** 各建筑等级上限 */
export const BUILDING_MAX_LEVELS: Record<BuildingType, number> = {
  castle: 30,
  farmland: 25,
  market: 25,
  barracks: 25,
  smithy: 20,
  academy: 20,
  clinic: 20,
  wall: 20,
};

/** 各建筑解锁所需主城等级（0 = 初始解锁） */
export const BUILDING_UNLOCK_LEVELS: Record<BuildingType, number> = {
  castle: 0,
  farmland: 0,
  market: 2,
  barracks: 2,
  smithy: 3,
  academy: 3,
  clinic: 4,
  wall: 5,
};

// ─────────────────────────────────────────────
// 2. 通用等级段生成器
// ─────────────────────────────────────────────

/**
 * 生成连续等级段的数据
 *
 * @param count 生成几级
 * @param startProd 起始产出值（第一级）
 * @param endProd 结束产出值（最后一级）
 * @param prevGrain 上一级粮草费用（作为本段第一级的基准）
 * @param prevGold 上一级铜钱费用
 * @param prevTroops 上一级兵力费用
 * @param prevSeconds 上一级时间
 * @param costMul 费用每级倍率
 * @param timeMul 时间每级倍率
 * @param specialStart 特殊属性起始值
 * @param specialEnd 特殊属性结束值
 */
function generateRange(
  count: number,
  startProd: number,
  endProd: number,
  prevGrain: number,
  prevGold: number,
  prevTroops: number,
  prevSeconds: number,
  costMul: number,
  timeMul: number,
  specialStart?: number,
  specialEnd?: number,
): LevelData[] {
  const result: LevelData[] = [];
  const prodStep = count > 1 ? (endProd - startProd) / (count - 1) : 0;
  const specialStep =
    specialStart !== undefined && specialEnd !== undefined && count > 1
      ? (specialEnd - specialStart) / (count - 1)
      : 0;

  let grain = prevGrain;
  let gold = prevGold;
  let troops = prevTroops;
  let seconds = prevSeconds;

  for (let i = 0; i < count; i++) {
    // 费用每级递增
    grain = grain * costMul;
    gold = gold * costMul;
    troops = troops * costMul;
    seconds = seconds * timeMul;

    const production = count === 1 ? endProd : startProd + prodStep * i;
    const specialValue =
      specialStart !== undefined
        ? count === 1
          ? specialEnd!
          : specialStart + specialStep * i
        : undefined;

    result.push({
      production: Math.round(production * 100) / 100,
      specialValue: specialValue !== undefined ? Math.round(specialValue) : undefined,
      upgradeCost: {
        grain: Math.round(grain),
        gold: Math.round(gold),
        troops: Math.round(troops),
        timeSeconds: Math.round(seconds),
      },
    });
  }
  return result;
}

// ─────────────────────────────────────────────
// 3. 主城等级数据表（1~30级）
// ─────────────────────────────────────────────
// 产出：全资源加成百分比
// 来源：PRD BLD-2 主城等级数据

const CASTLE_LEVEL_TABLE: LevelData[] = [
  // Lv1 基础（无升级费用，production=0 表示无加成）
  { production: 0, upgradeCost: { grain: 0, gold: 0, troops: 0, timeSeconds: 0 } },
  // Lv1→2: +2%
  { production: 2, upgradeCost: { grain: 200, gold: 150, troops: 0, timeSeconds: 10 } },
  // Lv2→3: +4%
  { production: 4, upgradeCost: { grain: 500, gold: 400, troops: 50, timeSeconds: 30 } },
  // Lv3→4: +6%
  { production: 6, upgradeCost: { grain: 1200, gold: 900, troops: 150, timeSeconds: 60 } },
  // Lv4→5: +8% (前置: 任一建筑 Lv4)
  { production: 8, upgradeCost: { grain: 2500, gold: 2000, troops: 400, timeSeconds: 180 } },
  // Lv5→6: +10%
  { production: 10, upgradeCost: { grain: 5000, gold: 4000, troops: 800, timeSeconds: 480 } },
  // Lv6→7: +12%
  { production: 12, upgradeCost: { grain: 9000, gold: 7500, troops: 1500, timeSeconds: 900 } },
  // Lv7→8: +14%
  { production: 14, upgradeCost: { grain: 15000, gold: 12000, troops: 3000, timeSeconds: 1800 } },
  // Lv8→9: +16%
  { production: 16, upgradeCost: { grain: 25000, gold: 20000, troops: 5000, timeSeconds: 3600 } },
  // Lv9→10: +18% (前置: 任一建筑 Lv9)
  { production: 18, upgradeCost: { grain: 40000, gold: 32000, troops: 8000, timeSeconds: 7200 } },
  // Lv10→15: 每级 ×1.8 费用, ×2 时间, +2%/级
  ...generateRange(5, 20, 28, 40000, 32000, 8000, 7200, 1.8, 2.0),
  // Lv15→20: 每级 ×1.6 费用, ×1.8 时间, +2%/级
  // 上一段末尾费用: 40000*1.8^5 ≈ 188956.8
  ...generateRange(5, 30, 38, 188957, 151166, 37791, 230400, 1.6, 1.8),
  // Lv20→25: 每级 ×1.5 费用, ×1.5 时间, +2%/级
  ...generateRange(5, 40, 48, 1975661, 1580529, 395132, 1969920, 1.5, 1.5),
  // Lv25→30: 每级 ×1.4 费用, ×1.3 时间, +2%/级
  ...generateRange(5, 50, 58, 15025130, 12020104, 3005026, 22412646, 1.4, 1.3),
];

// ─────────────────────────────────────────────
// 4. 农田等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：粮草/秒
// 来源：PRD BLD-2 农田等级数据

const FARMLAND_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.8, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5 } },
  // Lv2
  { production: 1.0, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5 } },
  // Lv3
  { production: 1.5, upgradeCost: { grain: 250, gold: 120, troops: 0, timeSeconds: 15 } },
  // Lv4
  { production: 2.2, upgradeCost: { grain: 500, gold: 250, troops: 0, timeSeconds: 30 } },
  // Lv5
  { production: 3.0, upgradeCost: { grain: 1000, gold: 500, troops: 0, timeSeconds: 60 } },
  // Lv6~10: 每级 ×1.8 费用, ×1.6 时间, 产出 3.0→8.0
  ...generateRange(5, 3.8, 8.0, 1000, 500, 0, 60, 1.8, 1.6),
  // Lv11~15: 每级 ×1.6 费用, ×1.5 时间, 产出 8.0→16.0
  ...generateRange(5, 9.6, 16.0, 18896, 9448, 0, 403, 1.6, 1.5),
  // Lv16~20: 每级 ×1.5 费用, ×1.4 时间, 产出 16.0→28.0
  ...generateRange(5, 17.6, 28.0, 198946, 99473, 0, 3052, 1.5, 1.4),
  // Lv21~25: 每级 ×1.4 费用, ×1.3 时间, 产出 28.0→45.0
  ...generateRange(5, 30.2, 45.0, 1508249, 754125, 0, 16761, 1.4, 1.3),
];

// ─────────────────────────────────────────────
// 5. 市集等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：铜钱/秒
// 来源：PRD BLD-2 市集等级数据

const MARKET_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.6, upgradeCost: { grain: 80, gold: 100, troops: 0, timeSeconds: 5 } },
  // Lv2
  { production: 0.8, upgradeCost: { grain: 80, gold: 100, troops: 0, timeSeconds: 5 } },
  // Lv3
  { production: 1.2, upgradeCost: { grain: 200, gold: 250, troops: 0, timeSeconds: 15 } },
  // Lv4
  { production: 1.8, upgradeCost: { grain: 400, gold: 500, troops: 0, timeSeconds: 30 } },
  // Lv5
  { production: 2.5, upgradeCost: { grain: 800, gold: 1000, troops: 0, timeSeconds: 60 } },
  // Lv6~10: 同农田曲线
  ...generateRange(5, 3.2, 5.5, 800, 1000, 0, 60, 1.8, 1.6),
  // Lv11~15
  ...generateRange(5, 6.4, 10.0, 15117, 18896, 0, 403, 1.6, 1.5),
  // Lv16~20
  ...generateRange(5, 11.6, 18.0, 159043, 198946, 0, 3052, 1.5, 1.4),
  // Lv21~25
  ...generateRange(5, 19.6, 35.0, 1206366, 1508249, 0, 16761, 1.4, 1.3),
];

// ─────────────────────────────────────────────
// 6. 兵营等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：兵力/秒
// 来源：PRD BLD-2 兵营等级数据

const BARRACKS_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.4, upgradeCost: { grain: 120, gold: 80, troops: 0, timeSeconds: 8 } },
  // Lv2
  { production: 0.5, upgradeCost: { grain: 120, gold: 80, troops: 0, timeSeconds: 8 } },
  // Lv3
  { production: 0.8, upgradeCost: { grain: 300, gold: 200, troops: 30, timeSeconds: 20 } },
  // Lv4
  { production: 1.2, upgradeCost: { grain: 600, gold: 400, troops: 80, timeSeconds: 45 } },
  // Lv5
  { production: 1.8, upgradeCost: { grain: 1200, gold: 800, troops: 200, timeSeconds: 90 } },
  // Lv6~10: 同农田费用曲线, 兵力费用 ×1.8
  ...generateRange(5, 2.4, 5.5, 1200, 800, 200, 90, 1.8, 1.6),
  // Lv11~15
  ...generateRange(5, 6.4, 11.0, 22675, 15117, 3779, 605, 1.6, 1.5),
  // Lv16~20
  ...generateRange(5, 12.4, 20.0, 238735, 159043, 39765, 4578, 1.5, 1.4),
  // Lv21~25
  ...generateRange(5, 21.2, 28.0, 1809898, 1206366, 301649, 25142, 1.4, 1.3),
];

// ─────────────────────────────────────────────
// 7. 铁匠铺等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：材料/小时
// 来源：PRD BLD-2 铁匠铺等级数据

const SMITHY_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.5, upgradeCost: { grain: 200, gold: 300, troops: 0, timeSeconds: 30 } },
  // Lv2
  { production: 1, upgradeCost: { grain: 200, gold: 300, troops: 0, timeSeconds: 30 } },
  // Lv3
  { production: 2, upgradeCost: { grain: 500, gold: 800, troops: 0, timeSeconds: 60 } },
  // Lv4~5: 每级 ×2.0 费用, ×1.8 时间, 产出 2→5
  ...generateRange(2, 3.5, 5, 500, 800, 0, 60, 2.0, 1.8),
  // Lv6~10: 每级 ×1.7 费用, ×1.5 时间, 产出 5→15
  ...generateRange(5, 7, 15, 2000, 3200, 0, 194, 1.7, 1.5),
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 产出 15→40
  ...generateRange(10, 17.5, 40, 24135, 38616, 0, 1467, 1.5, 1.3),
];

// ─────────────────────────────────────────────
// 8. 书院等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：科技点/秒
// 来源：PRD BLD-2 书院等级数据

const ACADEMY_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.2, upgradeCost: { grain: 150, gold: 200, troops: 0, timeSeconds: 20 } },
  // Lv2
  { production: 0.3, upgradeCost: { grain: 150, gold: 200, troops: 0, timeSeconds: 20 } },
  // Lv3
  { production: 0.5, upgradeCost: { grain: 400, gold: 500, troops: 0, timeSeconds: 45 } },
  // Lv4~5: 每级 ×1.8 费用, ×1.6 时间, 产出 0.5→1.2
  ...generateRange(2, 0.85, 1.2, 400, 500, 0, 45, 1.8, 1.6),
  // Lv6~10: 每级 ×1.6 费用, ×1.4 时间, 产出 1.2→3.0
  ...generateRange(5, 1.56, 3.0, 1296, 1620, 0, 115, 1.6, 1.4),
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 产出 3.0→8.0
  ...generateRange(10, 3.5, 8.0, 8609, 10761, 0, 440, 1.5, 1.3),
];

// ─────────────────────────────────────────────
// 9. 医馆等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：恢复速率百分比
// 来源：PRD BLD-2 医馆等级数据

const CLINIC_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 3, upgradeCost: { grain: 100, gold: 150, troops: 0, timeSeconds: 15 } },
  // Lv2
  { production: 5, upgradeCost: { grain: 100, gold: 150, troops: 0, timeSeconds: 15 } },
  // Lv3~5: 每级 ×1.8 费用, ×1.6 时间, 恢复速率 5%→15%
  ...generateRange(3, 8, 15, 100, 150, 0, 15, 1.8, 1.6),
  // Lv6~10: 每级 ×1.6 费用, ×1.4 时间, 恢复速率 15%→30%
  ...generateRange(5, 18, 30, 583, 875, 0, 61, 1.6, 1.4),
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 恢复速率 30%→60%
  ...generateRange(10, 33, 60, 3870, 5805, 0, 235, 1.5, 1.3),
];

// ─────────────────────────────────────────────
// 10. 城墙等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：防御加成百分比
// specialValue：城防值
// 来源：PRD BLD-2 城墙等级数据

const WALL_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 3, specialValue: 300, upgradeCost: { grain: 300, gold: 200, troops: 100, timeSeconds: 30 } },
  // Lv2
  { production: 3, specialValue: 500, upgradeCost: { grain: 300, gold: 200, troops: 100, timeSeconds: 30 } },
  // Lv3
  { production: 5, specialValue: 800, upgradeCost: { grain: 800, gold: 500, troops: 250, timeSeconds: 60 } },
  // Lv4~5: 每级 ×2.0 费用, ×1.8 时间, 防御加成 5%→12%, 城防 800→2000
  ...generateRange(2, 8, 12, 800, 500, 250, 60, 2.0, 1.8, 1400, 2000),
  // Lv6~10: 每级 ×1.7 费用, ×1.5 时间, 防御加成 12%→25%, 城防 2000→5000
  ...generateRange(5, 15, 25, 3200, 2000, 1000, 194, 1.7, 1.5, 2600, 5000),
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 防御加成 25%→50%, 城防 5000→15000
  ...generateRange(10, 27, 50, 38616, 24135, 12068, 1467, 1.5, 1.3, 5500, 15000),
];

// ─────────────────────────────────────────────
// 11. 建筑定义汇总
// ─────────────────────────────────────────────

/** 8 种建筑的完整定义 */
export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  castle: {
    type: 'castle',
    maxLevel: 30,
    unlockCastleLevel: 0,
    specialAttribute: {
      name: '全资源加成',
      baseValue: 0,
      perLevel: 2,
    },
    levelTable: CASTLE_LEVEL_TABLE,
  },
  farmland: {
    type: 'farmland',
    maxLevel: 25,
    unlockCastleLevel: 0,
    production: { resourceType: 'grain', baseValue: 0.8, perLevel: 0 },
    levelTable: FARMLAND_LEVEL_TABLE,
  },
  market: {
    type: 'market',
    maxLevel: 25,
    unlockCastleLevel: 2,
    production: { resourceType: 'gold', baseValue: 0.6, perLevel: 0 },
    levelTable: MARKET_LEVEL_TABLE,
  },
  barracks: {
    type: 'barracks',
    maxLevel: 25,
    unlockCastleLevel: 2,
    production: { resourceType: 'troops', baseValue: 0.4, perLevel: 0 },
    levelTable: BARRACKS_LEVEL_TABLE,
  },
  smithy: {
    type: 'smithy',
    maxLevel: 20,
    unlockCastleLevel: 3,
    levelTable: SMITHY_LEVEL_TABLE,
  },
  academy: {
    type: 'academy',
    maxLevel: 20,
    unlockCastleLevel: 3,
    levelTable: ACADEMY_LEVEL_TABLE,
  },
  clinic: {
    type: 'clinic',
    maxLevel: 20,
    unlockCastleLevel: 4,
    levelTable: CLINIC_LEVEL_TABLE,
  },
  wall: {
    type: 'wall',
    maxLevel: 20,
    unlockCastleLevel: 5,
    levelTable: WALL_LEVEL_TABLE,
  },
};

// ─────────────────────────────────────────────
// 12. 建筑队列配置
// ─────────────────────────────────────────────

/** 建筑队列槽位配置（按主城等级） */
export const QUEUE_CONFIGS: readonly QueueConfig[] = [
  { castleLevelMin: 1, castleLevelMax: 5, slots: 1 },
  { castleLevelMin: 6, castleLevelMax: 10, slots: 2 },
  { castleLevelMin: 11, castleLevelMax: 20, slots: 3 },
  { castleLevelMin: 21, castleLevelMax: 30, slots: 4 },
];

// ─────────────────────────────────────────────
// 13. 取消升级返还比例
// ─────────────────────────────────────────────

/** 取消升级时返还资源的比例 */
export const CANCEL_REFUND_RATIO = 0.8;

// ─────────────────────────────────────────────
// 14. 存档版本
// ─────────────────────────────────────────────

/** 建筑存档数据版本号 */
export const BUILDING_SAVE_VERSION = 1;
