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
  mine: 25,
  lumberMill: 25,
  barracks: 25,
  workshop: 20,
  academy: 20,
  clinic: 20,
  wall: 20,
  tavern: 20,
};

/** 各建筑解锁所需主城等级（0 = 初始解锁） */
export const BUILDING_UNLOCK_LEVELS: Record<BuildingType, number> = {
  castle: 0,
  farmland: 0,
  market: 0,
  mine: 0,
  lumberMill: 0,
  barracks: 2,
  workshop: 3,
  academy: 3,
  clinic: 4,
  wall: 5,
  tavern: 5,
};

// ─────────────────────────────────────────────
// 2. 通用等级段数据（已预计算为静态数组）
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 3. 主城等级数据表（1~30级）
// ─────────────────────────────────────────────
// 产出：全资源加成百分比
// 来源：PRD BLD-2 主城等级数据

const CASTLE_LEVEL_TABLE: LevelData[] = [
  // Lv1 基础（无升级费用，production=0 表示无加成）
  { production: 0, upgradeCost: { grain: 0, gold: 0, troops: 0, timeSeconds: 0, ore: 0, wood: 0 } },
  // Lv1→2: +2%
  { production: 2, upgradeCost: { grain: 200, gold: 150, troops: 0, timeSeconds: 10, ore: 0, wood: 0 } },
  // Lv2→3: +4%
  { production: 4, upgradeCost: { grain: 500, gold: 400, troops: 50, timeSeconds: 30, ore: 0, wood: 0 } },
  // Lv3→4: +6%
  { production: 6, upgradeCost: { grain: 1200, gold: 900, troops: 150, timeSeconds: 60, ore: 0, wood: 0 } },
  // Lv4→5: +8% (前置: 任一建筑 Lv4)
  { production: 8, upgradeCost: { grain: 2500, gold: 2000, troops: 400, timeSeconds: 180, ore: 0, wood: 0 } },
  // Lv5→6: +10%
  { production: 10, upgradeCost: { grain: 5000, gold: 4000, troops: 800, timeSeconds: 480, ore: 0, wood: 0 } },
  // Lv6→7: +12%
  { production: 12, upgradeCost: { grain: 9000, gold: 7500, troops: 1500, timeSeconds: 900, ore: 0, wood: 0 } },
  // Lv7→8: +14%
  { production: 14, upgradeCost: { grain: 15000, gold: 12000, troops: 3000, timeSeconds: 1800, ore: 0, wood: 0 } },
  // Lv8→9: +16%
  { production: 16, upgradeCost: { grain: 25000, gold: 20000, troops: 5000, timeSeconds: 3600, ore: 0, wood: 0 } },
  // Lv9→10: +18% (前置: 任一建筑 Lv9)
  { production: 18, upgradeCost: { grain: 40000, gold: 32000, troops: 8000, timeSeconds: 7200, ore: 0, wood: 0 } },
  // Lv10→15: 每级 ×1.8 费用, ×2 时间, +2%/级
  { production: 20.0, upgradeCost: { grain: 72000, gold: 57600, troops: 14400, timeSeconds: 14400, ore: 0, wood: 0 } },
  { production: 22.0, upgradeCost: { grain: 129600, gold: 103680, troops: 25920, timeSeconds: 28800, ore: 0, wood: 0 } },
  { production: 24.0, upgradeCost: { grain: 233280, gold: 186624, troops: 46656, timeSeconds: 57600, ore: 0, wood: 0 } },
  { production: 26.0, upgradeCost: { grain: 419904, gold: 335923, troops: 83981, timeSeconds: 115200, ore: 0, wood: 0 } },
  { production: 28.0, upgradeCost: { grain: 755827, gold: 604662, troops: 151165, timeSeconds: 230400, ore: 0, wood: 0 } },
  // Lv15→20: 每级 ×1.6 费用, ×1.8 时间, +2%/级
  { production: 30.0, upgradeCost: { grain: 302331, gold: 241866, troops: 60466, timeSeconds: 414720, ore: 0, wood: 0 } },
  { production: 32.0, upgradeCost: { grain: 483730, gold: 386985, troops: 96745, timeSeconds: 746496, ore: 0, wood: 0 } },
  { production: 34.0, upgradeCost: { grain: 773968, gold: 619176, troops: 154792, timeSeconds: 1343693, ore: 0, wood: 0 } },
  { production: 36.0, upgradeCost: { grain: 1238349, gold: 990681, troops: 247667, timeSeconds: 2418647, ore: 0, wood: 0 } },
  { production: 38.0, upgradeCost: { grain: 1981358, gold: 1585090, troops: 396267, timeSeconds: 4353565, ore: 0, wood: 0 } },
  // Lv20→25: 每级 ×1.5 费用, ×1.5 时间, +2%/级
  { production: 40.0, upgradeCost: { grain: 2963492, gold: 2370794, troops: 592698, timeSeconds: 2954880, ore: 0, wood: 0 } },
  { production: 42.0, upgradeCost: { grain: 4445237, gold: 3556190, troops: 889047, timeSeconds: 4432320, ore: 0, wood: 0 } },
  { production: 44.0, upgradeCost: { grain: 6667856, gold: 5334285, troops: 1333570, timeSeconds: 6648480, ore: 0, wood: 0 } },
  { production: 46.0, upgradeCost: { grain: 10001784, gold: 8001428, troops: 2000356, timeSeconds: 9972720, ore: 0, wood: 0 } },
  { production: 48.0, upgradeCost: { grain: 15002676, gold: 12002142, troops: 3000534, timeSeconds: 14959080, ore: 0, wood: 0 } },
  // Lv25→30: 每级 ×1.4 费用, ×1.3 时间, +2%/级
  { production: 50.0, upgradeCost: { grain: 21035182, gold: 16828146, troops: 4207036, timeSeconds: 29136440, ore: 0, wood: 0 } },
  { production: 52.0, upgradeCost: { grain: 29449255, gold: 23559404, troops: 5889851, timeSeconds: 37877372, ore: 0, wood: 0 } },
  { production: 54.0, upgradeCost: { grain: 41228957, gold: 32983165, troops: 8245791, timeSeconds: 49240583, ore: 0, wood: 0 } },
  { production: 56.0, upgradeCost: { grain: 57720539, gold: 46176432, troops: 11544108, timeSeconds: 64012758, ore: 0, wood: 0 } },
  { production: 58.0, upgradeCost: { grain: 80808755, gold: 64647004, troops: 16161751, timeSeconds: 83216586, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 4. 农田等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：粮草/秒
// 来源：PRD BLD-2 农田等级数据

const FARMLAND_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.8, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  // Lv2
  { production: 1.0, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  // Lv3
  { production: 1.5, upgradeCost: { grain: 250, gold: 120, troops: 0, timeSeconds: 15, ore: 0, wood: 0 } },
  // Lv4
  { production: 2.2, upgradeCost: { grain: 500, gold: 250, troops: 0, timeSeconds: 30, ore: 0, wood: 0 } },
  // Lv5
  { production: 3.0, upgradeCost: { grain: 1000, gold: 500, troops: 0, timeSeconds: 60, ore: 0, wood: 0 } },
  // Lv6~10: 每级 ×1.8 费用, ×1.6 时间, 产出 3.0→8.0
  { production: 3.8, upgradeCost: { grain: 1800, gold: 900, troops: 0, timeSeconds: 96, ore: 0, wood: 0 } },
  { production: 4.85, upgradeCost: { grain: 3240, gold: 1620, troops: 0, timeSeconds: 154, ore: 0, wood: 0 } },
  { production: 5.9, upgradeCost: { grain: 5832, gold: 2916, troops: 0, timeSeconds: 246, ore: 0, wood: 0 } },
  { production: 6.95, upgradeCost: { grain: 10498, gold: 5249, troops: 0, timeSeconds: 393, ore: 0, wood: 0 } },
  { production: 8.0, upgradeCost: { grain: 18896, gold: 9448, troops: 0, timeSeconds: 629, ore: 0, wood: 0 } },
  // Lv11~15: 每级 ×1.6 费用, ×1.5 时间, 产出 8.0→16.0
  { production: 9.6, upgradeCost: { grain: 30234, gold: 15117, troops: 0, timeSeconds: 604, ore: 0, wood: 0 } },
  { production: 11.2, upgradeCost: { grain: 48374, gold: 24187, troops: 0, timeSeconds: 907, ore: 0, wood: 0 } },
  { production: 12.8, upgradeCost: { grain: 77398, gold: 38699, troops: 0, timeSeconds: 1360, ore: 0, wood: 0 } },
  { production: 14.4, upgradeCost: { grain: 123837, gold: 61918, troops: 0, timeSeconds: 2040, ore: 0, wood: 0 } },
  { production: 16.0, upgradeCost: { grain: 198139, gold: 99069, troops: 0, timeSeconds: 3060, ore: 0, wood: 0 } },
  // Lv16~20: 每级 ×1.5 费用, ×1.4 时间, 产出 16.0→28.0
  { production: 17.6, upgradeCost: { grain: 298419, gold: 149210, troops: 0, timeSeconds: 4273, ore: 0, wood: 0 } },
  { production: 20.2, upgradeCost: { grain: 447628, gold: 223814, troops: 0, timeSeconds: 5982, ore: 0, wood: 0 } },
  { production: 22.8, upgradeCost: { grain: 671443, gold: 335721, troops: 0, timeSeconds: 8375, ore: 0, wood: 0 } },
  { production: 25.4, upgradeCost: { grain: 1007164, gold: 503582, troops: 0, timeSeconds: 11725, ore: 0, wood: 0 } },
  { production: 28.0, upgradeCost: { grain: 1510746, gold: 755373, troops: 0, timeSeconds: 16414, ore: 0, wood: 0 } },
  // Lv21~25: 每级 ×1.4 费用, ×1.3 时间, 产出 28.0→45.0
  { production: 30.2, upgradeCost: { grain: 2111549, gold: 1055775, troops: 0, timeSeconds: 21789, ore: 0, wood: 0 } },
  { production: 33.9, upgradeCost: { grain: 2956168, gold: 1478085, troops: 0, timeSeconds: 28326, ore: 0, wood: 0 } },
  { production: 37.6, upgradeCost: { grain: 4138635, gold: 2069319, troops: 0, timeSeconds: 36824, ore: 0, wood: 0 } },
  { production: 41.3, upgradeCost: { grain: 5794089, gold: 2897047, troops: 0, timeSeconds: 47871, ore: 0, wood: 0 } },
  { production: 45.0, upgradeCost: { grain: 8111725, gold: 4055865, troops: 0, timeSeconds: 62232, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 5. 市集等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：铜钱/秒
// 来源：PRD BLD-2 市集等级数据

const MARKET_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.6, upgradeCost: { grain: 80, gold: 100, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  // Lv2
  { production: 0.8, upgradeCost: { grain: 80, gold: 100, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  // Lv3
  { production: 1.2, upgradeCost: { grain: 200, gold: 250, troops: 0, timeSeconds: 15, ore: 0, wood: 0 } },
  // Lv4
  { production: 1.8, upgradeCost: { grain: 400, gold: 500, troops: 0, timeSeconds: 30, ore: 0, wood: 0 } },
  // Lv5
  { production: 2.5, upgradeCost: { grain: 800, gold: 1000, troops: 0, timeSeconds: 60, ore: 0, wood: 0 } },
  // Lv6~10: 同农田曲线
  { production: 3.2, upgradeCost: { grain: 1440, gold: 1800, troops: 0, timeSeconds: 96, ore: 0, wood: 0 } },
  { production: 3.78, upgradeCost: { grain: 2592, gold: 3240, troops: 0, timeSeconds: 154, ore: 0, wood: 0 } },
  { production: 4.35, upgradeCost: { grain: 4666, gold: 5832, troops: 0, timeSeconds: 246, ore: 0, wood: 0 } },
  { production: 4.92, upgradeCost: { grain: 8398, gold: 10498, troops: 0, timeSeconds: 393, ore: 0, wood: 0 } },
  { production: 5.5, upgradeCost: { grain: 15117, gold: 18896, troops: 0, timeSeconds: 629, ore: 0, wood: 0 } },
  // Lv11~15
  { production: 6.4, upgradeCost: { grain: 24187, gold: 30234, troops: 0, timeSeconds: 604, ore: 0, wood: 0 } },
  { production: 7.3, upgradeCost: { grain: 38700, gold: 48374, troops: 0, timeSeconds: 907, ore: 0, wood: 0 } },
  { production: 8.2, upgradeCost: { grain: 61919, gold: 77398, troops: 0, timeSeconds: 1360, ore: 0, wood: 0 } },
  { production: 9.1, upgradeCost: { grain: 99071, gold: 123837, troops: 0, timeSeconds: 2040, ore: 0, wood: 0 } },
  { production: 10.0, upgradeCost: { grain: 158513, gold: 198139, troops: 0, timeSeconds: 3060, ore: 0, wood: 0 } },
  // Lv16~20
  { production: 11.6, upgradeCost: { grain: 238564, gold: 298419, troops: 0, timeSeconds: 4273, ore: 0, wood: 0 } },
  { production: 13.2, upgradeCost: { grain: 357847, gold: 447628, troops: 0, timeSeconds: 5982, ore: 0, wood: 0 } },
  { production: 14.8, upgradeCost: { grain: 536770, gold: 671443, troops: 0, timeSeconds: 8375, ore: 0, wood: 0 } },
  { production: 16.4, upgradeCost: { grain: 805155, gold: 1007164, troops: 0, timeSeconds: 11725, ore: 0, wood: 0 } },
  { production: 18.0, upgradeCost: { grain: 1207733, gold: 1510746, troops: 0, timeSeconds: 16414, ore: 0, wood: 0 } },
  // Lv21~25
  { production: 19.6, upgradeCost: { grain: 1688912, gold: 2111549, troops: 0, timeSeconds: 21789, ore: 0, wood: 0 } },
  { production: 23.45, upgradeCost: { grain: 2364477, gold: 2956168, troops: 0, timeSeconds: 28326, ore: 0, wood: 0 } },
  { production: 27.3, upgradeCost: { grain: 3310268, gold: 4138635, troops: 0, timeSeconds: 36824, ore: 0, wood: 0 } },
  { production: 31.15, upgradeCost: { grain: 4634376, gold: 5794089, troops: 0, timeSeconds: 47871, ore: 0, wood: 0 } },
  { production: 35.0, upgradeCost: { grain: 6488126, gold: 8111725, troops: 0, timeSeconds: 62232, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 6. 兵营等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：兵力/秒
// 来源：PRD BLD-2 兵营等级数据

const BARRACKS_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.4, upgradeCost: { grain: 120, gold: 80, troops: 0, timeSeconds: 8, ore: 0, wood: 0 } },
  // Lv2
  { production: 0.5, upgradeCost: { grain: 120, gold: 80, troops: 0, timeSeconds: 8, ore: 0, wood: 0 } },
  // Lv3
  { production: 0.8, upgradeCost: { grain: 300, gold: 200, troops: 30, timeSeconds: 20, ore: 0, wood: 0 } },
  // Lv4
  { production: 1.2, upgradeCost: { grain: 600, gold: 400, troops: 80, timeSeconds: 45, ore: 0, wood: 0 } },
  // Lv5
  { production: 1.8, upgradeCost: { grain: 1200, gold: 800, troops: 200, timeSeconds: 90, ore: 0, wood: 0 } },
  // Lv6~10: 同农田费用曲线, 兵力费用 ×1.8
  { production: 2.4, upgradeCost: { grain: 2160, gold: 1440, troops: 360, timeSeconds: 144, ore: 0, wood: 0 } },
  { production: 3.18, upgradeCost: { grain: 3888, gold: 2592, troops: 648, timeSeconds: 230, ore: 0, wood: 0 } },
  { production: 3.95, upgradeCost: { grain: 6998, gold: 4666, troops: 1166, timeSeconds: 369, ore: 0, wood: 0 } },
  { production: 4.72, upgradeCost: { grain: 12597, gold: 8398, troops: 2100, timeSeconds: 590, ore: 0, wood: 0 } },
  { production: 5.5, upgradeCost: { grain: 22675, gold: 15117, troops: 3779, timeSeconds: 944, ore: 0, wood: 0 } },
  // Lv11~15
  { production: 6.4, upgradeCost: { grain: 36280, gold: 24187, troops: 6046, timeSeconds: 908, ore: 0, wood: 0 } },
  { production: 7.55, upgradeCost: { grain: 58048, gold: 38700, troops: 9674, timeSeconds: 1361, ore: 0, wood: 0 } },
  { production: 8.7, upgradeCost: { grain: 92877, gold: 61919, troops: 15479, timeSeconds: 2042, ore: 0, wood: 0 } },
  { production: 9.85, upgradeCost: { grain: 148603, gold: 99071, troops: 24766, timeSeconds: 3063, ore: 0, wood: 0 } },
  { production: 11.0, upgradeCost: { grain: 237765, gold: 158513, troops: 39626, timeSeconds: 4594, ore: 0, wood: 0 } },
  // Lv16~20
  { production: 12.4, upgradeCost: { grain: 358102, gold: 238564, troops: 59648, timeSeconds: 6409, ore: 0, wood: 0 } },
  { production: 14.3, upgradeCost: { grain: 537154, gold: 357847, troops: 89471, timeSeconds: 8973, ore: 0, wood: 0 } },
  { production: 16.2, upgradeCost: { grain: 805731, gold: 536770, troops: 134207, timeSeconds: 12562, ore: 0, wood: 0 } },
  { production: 18.1, upgradeCost: { grain: 1208596, gold: 805155, troops: 201310, timeSeconds: 17587, ore: 0, wood: 0 } },
  { production: 20.0, upgradeCost: { grain: 1812894, gold: 1207733, troops: 301965, timeSeconds: 24622, ore: 0, wood: 0 } },
  // Lv21~25
  { production: 21.2, upgradeCost: { grain: 2533857, gold: 1688912, troops: 422309, timeSeconds: 32685, ore: 0, wood: 0 } },
  { production: 22.9, upgradeCost: { grain: 3547400, gold: 2364477, troops: 591232, timeSeconds: 42490, ore: 0, wood: 0 } },
  { production: 24.6, upgradeCost: { grain: 4966360, gold: 3310268, troops: 827725, timeSeconds: 55237, ore: 0, wood: 0 } },
  { production: 26.3, upgradeCost: { grain: 6952904, gold: 4634376, troops: 1158815, timeSeconds: 71808, ore: 0, wood: 0 } },
  { production: 28.0, upgradeCost: { grain: 9734066, gold: 6488126, troops: 1622341, timeSeconds: 93350, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 7. 矿场等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：矿石/秒
// 来源：PRD BLD-2 矿场等级数据

const MINE_LEVEL_TABLE: LevelData[] = [
  { production: 0.8, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  { production: 1.0, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  { production: 1.5, upgradeCost: { grain: 250, gold: 120, troops: 0, timeSeconds: 15, ore: 0, wood: 0 } },
  { production: 2.2, upgradeCost: { grain: 500, gold: 250, troops: 0, timeSeconds: 30, ore: 0, wood: 0 } },
  { production: 3.0, upgradeCost: { grain: 1000, gold: 500, troops: 0, timeSeconds: 60, ore: 0, wood: 0 } },
  { production: 3.8, upgradeCost: { grain: 1800, gold: 900, troops: 0, timeSeconds: 96, ore: 0, wood: 0 } },
  { production: 4.85, upgradeCost: { grain: 3240, gold: 1620, troops: 0, timeSeconds: 154, ore: 0, wood: 0 } },
  { production: 5.9, upgradeCost: { grain: 5832, gold: 2916, troops: 0, timeSeconds: 246, ore: 0, wood: 0 } },
  { production: 6.95, upgradeCost: { grain: 10498, gold: 5249, troops: 0, timeSeconds: 393, ore: 0, wood: 0 } },
  { production: 8.0, upgradeCost: { grain: 18896, gold: 9448, troops: 0, timeSeconds: 629, ore: 0, wood: 0 } },
  { production: 9.6, upgradeCost: { grain: 30234, gold: 15117, troops: 0, timeSeconds: 604, ore: 0, wood: 0 } },
  { production: 11.2, upgradeCost: { grain: 48374, gold: 24187, troops: 0, timeSeconds: 907, ore: 0, wood: 0 } },
  { production: 12.8, upgradeCost: { grain: 77398, gold: 38699, troops: 0, timeSeconds: 1360, ore: 0, wood: 0 } },
  { production: 14.4, upgradeCost: { grain: 123837, gold: 61918, troops: 0, timeSeconds: 2040, ore: 0, wood: 0 } },
  { production: 16.0, upgradeCost: { grain: 198139, gold: 99069, troops: 0, timeSeconds: 3060, ore: 0, wood: 0 } },
  { production: 17.6, upgradeCost: { grain: 298419, gold: 149210, troops: 0, timeSeconds: 4273, ore: 0, wood: 0 } },
  { production: 20.2, upgradeCost: { grain: 447628, gold: 223814, troops: 0, timeSeconds: 5982, ore: 0, wood: 0 } },
  { production: 22.8, upgradeCost: { grain: 671443, gold: 335721, troops: 0, timeSeconds: 8375, ore: 0, wood: 0 } },
  { production: 25.4, upgradeCost: { grain: 1007164, gold: 503582, troops: 0, timeSeconds: 11725, ore: 0, wood: 0 } },
  { production: 28.0, upgradeCost: { grain: 1510746, gold: 755373, troops: 0, timeSeconds: 16414, ore: 0, wood: 0 } },
  { production: 30.2, upgradeCost: { grain: 2111549, gold: 1055775, troops: 0, timeSeconds: 21789, ore: 0, wood: 0 } },
  { production: 33.9, upgradeCost: { grain: 2956168, gold: 1478085, troops: 0, timeSeconds: 28326, ore: 0, wood: 0 } },
  { production: 37.6, upgradeCost: { grain: 4138635, gold: 2069319, troops: 0, timeSeconds: 36824, ore: 0, wood: 0 } },
  { production: 41.3, upgradeCost: { grain: 5794089, gold: 2897047, troops: 0, timeSeconds: 47871, ore: 0, wood: 0 } },
  { production: 45.0, upgradeCost: { grain: 8111725, gold: 4055865, troops: 0, timeSeconds: 62232, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 8. 伐木场等级数据表（1~25级）
// ─────────────────────────────────────────────
// 产出：木材/秒
// 来源：PRD BLD-2 伐木场等级数据

const LUMBER_MILL_LEVEL_TABLE: LevelData[] = [
  { production: 0.8, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  { production: 1.0, upgradeCost: { grain: 100, gold: 50, troops: 0, timeSeconds: 5, ore: 0, wood: 0 } },
  { production: 1.5, upgradeCost: { grain: 250, gold: 120, troops: 0, timeSeconds: 15, ore: 0, wood: 0 } },
  { production: 2.2, upgradeCost: { grain: 500, gold: 250, troops: 0, timeSeconds: 30, ore: 0, wood: 0 } },
  { production: 3.0, upgradeCost: { grain: 1000, gold: 500, troops: 0, timeSeconds: 60, ore: 0, wood: 0 } },
  { production: 3.8, upgradeCost: { grain: 1800, gold: 900, troops: 0, timeSeconds: 96, ore: 0, wood: 0 } },
  { production: 4.85, upgradeCost: { grain: 3240, gold: 1620, troops: 0, timeSeconds: 154, ore: 0, wood: 0 } },
  { production: 5.9, upgradeCost: { grain: 5832, gold: 2916, troops: 0, timeSeconds: 246, ore: 0, wood: 0 } },
  { production: 6.95, upgradeCost: { grain: 10498, gold: 5249, troops: 0, timeSeconds: 393, ore: 0, wood: 0 } },
  { production: 8.0, upgradeCost: { grain: 18896, gold: 9448, troops: 0, timeSeconds: 629, ore: 0, wood: 0 } },
  { production: 9.6, upgradeCost: { grain: 30234, gold: 15117, troops: 0, timeSeconds: 604, ore: 0, wood: 0 } },
  { production: 11.2, upgradeCost: { grain: 48374, gold: 24187, troops: 0, timeSeconds: 907, ore: 0, wood: 0 } },
  { production: 12.8, upgradeCost: { grain: 77398, gold: 38699, troops: 0, timeSeconds: 1360, ore: 0, wood: 0 } },
  { production: 14.4, upgradeCost: { grain: 123837, gold: 61918, troops: 0, timeSeconds: 2040, ore: 0, wood: 0 } },
  { production: 16.0, upgradeCost: { grain: 198139, gold: 99069, troops: 0, timeSeconds: 3060, ore: 0, wood: 0 } },
  { production: 17.6, upgradeCost: { grain: 298419, gold: 149210, troops: 0, timeSeconds: 4273, ore: 0, wood: 0 } },
  { production: 20.2, upgradeCost: { grain: 447628, gold: 223814, troops: 0, timeSeconds: 5982, ore: 0, wood: 0 } },
  { production: 22.8, upgradeCost: { grain: 671443, gold: 335721, troops: 0, timeSeconds: 8375, ore: 0, wood: 0 } },
  { production: 25.4, upgradeCost: { grain: 1007164, gold: 503582, troops: 0, timeSeconds: 11725, ore: 0, wood: 0 } },
  { production: 28.0, upgradeCost: { grain: 1510746, gold: 755373, troops: 0, timeSeconds: 16414, ore: 0, wood: 0 } },
  { production: 30.2, upgradeCost: { grain: 2111549, gold: 1055775, troops: 0, timeSeconds: 21789, ore: 0, wood: 0 } },
  { production: 33.9, upgradeCost: { grain: 2956168, gold: 1478085, troops: 0, timeSeconds: 28326, ore: 0, wood: 0 } },
  { production: 37.6, upgradeCost: { grain: 4138635, gold: 2069319, troops: 0, timeSeconds: 36824, ore: 0, wood: 0 } },
  { production: 41.3, upgradeCost: { grain: 5794089, gold: 2897047, troops: 0, timeSeconds: 47871, ore: 0, wood: 0 } },
  { production: 45.0, upgradeCost: { grain: 8111725, gold: 4055865, troops: 0, timeSeconds: 62232, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 9. 工坊等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：锻造效率百分比+强化折扣百分比
// 来源：PRD BLD-2 工坊等级数据

const WORKSHOP_LEVEL_TABLE: LevelData[] = [
  { production: 5, specialValue: 3, upgradeCost: { grain: 200, gold: 300, troops: 0, timeSeconds: 30, ore: 100, wood: 0 } },
  { production: 5, specialValue: 3, upgradeCost: { grain: 200, gold: 300, troops: 0, timeSeconds: 30, ore: 100, wood: 0 } },
  { production: 8, specialValue: 5, upgradeCost: { grain: 500, gold: 800, troops: 0, timeSeconds: 60, ore: 250, wood: 0 } },
  { production: 10, specialValue: 6, upgradeCost: { grain: 1000, gold: 1600, troops: 0, timeSeconds: 108, ore: 500, wood: 0 } },
  { production: 15, specialValue: 8, upgradeCost: { grain: 2000, gold: 3200, troops: 0, timeSeconds: 194, ore: 1000, wood: 0 } },
  { production: 18, specialValue: 9, upgradeCost: { grain: 3400, gold: 5440, troops: 0, timeSeconds: 291, ore: 1700, wood: 0 } },
  { production: 21, specialValue: 10, upgradeCost: { grain: 5780, gold: 9248, troops: 0, timeSeconds: 436, ore: 2890, wood: 0 } },
  { production: 24, specialValue: 12, upgradeCost: { grain: 9826, gold: 15722, troops: 0, timeSeconds: 655, ore: 4913, wood: 0 } },
  { production: 27, specialValue: 13, upgradeCost: { grain: 16704, gold: 26727, troops: 0, timeSeconds: 982, ore: 8352, wood: 0 } },
  { production: 30, specialValue: 15, upgradeCost: { grain: 28397, gold: 45435, troops: 0, timeSeconds: 1473, ore: 14199, wood: 0 } },
  { production: 33, specialValue: 16, upgradeCost: { grain: 36202, gold: 57924, troops: 0, timeSeconds: 1907, ore: 18102, wood: 0 } },
  { production: 36, specialValue: 17, upgradeCost: { grain: 54304, gold: 86886, troops: 0, timeSeconds: 2479, ore: 27153, wood: 0 } },
  { production: 39, specialValue: 18, upgradeCost: { grain: 81456, gold: 130329, troops: 0, timeSeconds: 3223, ore: 40730, wood: 0 } },
  { production: 42, specialValue: 20, upgradeCost: { grain: 122183, gold: 195494, troops: 0, timeSeconds: 4190, ore: 61094, wood: 0 } },
  { production: 45, specialValue: 21, upgradeCost: { grain: 183275, gold: 293240, troops: 0, timeSeconds: 5447, ore: 91641, wood: 0 } },
  { production: 48, specialValue: 22, upgradeCost: { grain: 274913, gold: 439860, troops: 0, timeSeconds: 7081, ore: 137462, wood: 0 } },
  { production: 51, specialValue: 23, upgradeCost: { grain: 412369, gold: 659791, troops: 0, timeSeconds: 9205, ore: 206193, wood: 0 } },
  { production: 54, specialValue: 24, upgradeCost: { grain: 618554, gold: 989686, troops: 0, timeSeconds: 11967, ore: 309290, wood: 0 } },
  { production: 57, specialValue: 24, upgradeCost: { grain: 927830, gold: 1484529, troops: 0, timeSeconds: 15557, ore: 463934, wood: 0 } },
  { production: 60, specialValue: 25, upgradeCost: { grain: 1391746, gold: 2226793, troops: 0, timeSeconds: 20224, ore: 695902, wood: 0 } },
];

// ─────────────────────────────────────────────
// 10. 酒馆等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：招募概率加成百分比
// 来源：PRD BLD-2 酒馆等级数据

const TAVERN_LEVEL_TABLE: LevelData[] = [
  { production: 3, upgradeCost: { grain: 300, gold: 200, troops: 0, timeSeconds: 30, ore: 0, wood: 0 } },
  { production: 3, upgradeCost: { grain: 300, gold: 200, troops: 0, timeSeconds: 30, ore: 0, wood: 0 } },
  { production: 5, upgradeCost: { grain: 800, gold: 500, troops: 0, timeSeconds: 60, ore: 0, wood: 0 } },
  { production: 7, upgradeCost: { grain: 1600, gold: 1000, troops: 0, timeSeconds: 108, ore: 0, wood: 0 } },
  { production: 10, upgradeCost: { grain: 3200, gold: 2000, troops: 0, timeSeconds: 194, ore: 0, wood: 0 } },
  { production: 12, upgradeCost: { grain: 5440, gold: 3400, troops: 0, timeSeconds: 291, ore: 0, wood: 0 } },
  { production: 14, upgradeCost: { grain: 9248, gold: 5780, troops: 0, timeSeconds: 436, ore: 0, wood: 0 } },
  { production: 16, upgradeCost: { grain: 15722, gold: 9826, troops: 0, timeSeconds: 655, ore: 0, wood: 0 } },
  { production: 18, upgradeCost: { grain: 26727, gold: 16704, troops: 0, timeSeconds: 982, ore: 0, wood: 0 } },
  { production: 20, upgradeCost: { grain: 45435, gold: 28397, troops: 0, timeSeconds: 1473, ore: 0, wood: 0 } },
  { production: 22, upgradeCost: { grain: 57924, gold: 36202, troops: 0, timeSeconds: 1907, ore: 0, wood: 0 } },
  { production: 24, upgradeCost: { grain: 86886, gold: 54304, troops: 0, timeSeconds: 2479, ore: 0, wood: 0 } },
  { production: 26, upgradeCost: { grain: 130329, gold: 81456, troops: 0, timeSeconds: 3223, ore: 0, wood: 0 } },
  { production: 28, upgradeCost: { grain: 195494, gold: 122183, troops: 0, timeSeconds: 4190, ore: 0, wood: 0 } },
  { production: 30, upgradeCost: { grain: 293240, gold: 183275, troops: 0, timeSeconds: 5447, ore: 0, wood: 0 } },
  { production: 32, upgradeCost: { grain: 439860, gold: 274913, troops: 0, timeSeconds: 7081, ore: 0, wood: 0 } },
  { production: 34, upgradeCost: { grain: 659791, gold: 412369, troops: 0, timeSeconds: 9205, ore: 0, wood: 0 } },
  { production: 36, upgradeCost: { grain: 989686, gold: 618554, troops: 0, timeSeconds: 11967, ore: 0, wood: 0 } },
  { production: 38, upgradeCost: { grain: 1484529, gold: 927830, troops: 0, timeSeconds: 15557, ore: 0, wood: 0 } },
  { production: 40, upgradeCost: { grain: 2226793, gold: 1391746, troops: 0, timeSeconds: 20224, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 8. 书院等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：科技点/秒
// 来源：PRD BLD-2 书院等级数据

const ACADEMY_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 0.2, upgradeCost: { grain: 150, gold: 200, troops: 0, timeSeconds: 20, ore: 0, wood: 0 } },
  // Lv2
  { production: 0.3, upgradeCost: { grain: 150, gold: 200, troops: 0, timeSeconds: 20, ore: 0, wood: 0 } },
  // Lv3
  { production: 0.5, upgradeCost: { grain: 400, gold: 500, troops: 0, timeSeconds: 45, ore: 0, wood: 0 } },
  // Lv4~5: 每级 ×1.8 费用, ×1.6 时间, 产出 0.5→1.2
  { production: 0.85, upgradeCost: { grain: 720, gold: 900, troops: 0, timeSeconds: 72, ore: 0, wood: 0 } },
  { production: 1.2, upgradeCost: { grain: 1296, gold: 1620, troops: 0, timeSeconds: 115, ore: 0, wood: 0 } },
  // Lv6~10: 每级 ×1.6 费用, ×1.4 时间, 产出 1.2→3.0
  { production: 1.56, upgradeCost: { grain: 2074, gold: 2592, troops: 0, timeSeconds: 161, ore: 0, wood: 0 } },
  { production: 1.92, upgradeCost: { grain: 3318, gold: 4147, troops: 0, timeSeconds: 225, ore: 0, wood: 0 } },
  { production: 2.28, upgradeCost: { grain: 5308, gold: 6636, troops: 0, timeSeconds: 316, ore: 0, wood: 0 } },
  { production: 2.64, upgradeCost: { grain: 8493, gold: 10617, troops: 0, timeSeconds: 442, ore: 0, wood: 0 } },
  { production: 3.0, upgradeCost: { grain: 13590, gold: 16987, troops: 0, timeSeconds: 618, ore: 0, wood: 0 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 产出 3.0→8.0
  { production: 3.5, upgradeCost: { grain: 12914, gold: 16142, troops: 0, timeSeconds: 572, ore: 0, wood: 0 } },
  { production: 4.0, upgradeCost: { grain: 19370, gold: 24212, troops: 0, timeSeconds: 744, ore: 0, wood: 0 } },
  { production: 4.5, upgradeCost: { grain: 29055, gold: 36318, troops: 0, timeSeconds: 967, ore: 0, wood: 0 } },
  { production: 5.0, upgradeCost: { grain: 43583, gold: 54478, troops: 0, timeSeconds: 1257, ore: 0, wood: 0 } },
  { production: 5.5, upgradeCost: { grain: 65375, gold: 81716, troops: 0, timeSeconds: 1634, ore: 0, wood: 0 } },
  { production: 6.0, upgradeCost: { grain: 98062, gold: 122575, troops: 0, timeSeconds: 2124, ore: 0, wood: 0 } },
  { production: 6.5, upgradeCost: { grain: 147093, gold: 183862, troops: 0, timeSeconds: 2761, ore: 0, wood: 0 } },
  { production: 7.0, upgradeCost: { grain: 220639, gold: 275793, troops: 0, timeSeconds: 3589, ore: 0, wood: 0 } },
  { production: 7.5, upgradeCost: { grain: 330959, gold: 413689, troops: 0, timeSeconds: 4666, ore: 0, wood: 0 } },
  { production: 8.0, upgradeCost: { grain: 496438, gold: 620533, troops: 0, timeSeconds: 6066, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 9. 医馆等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：恢复速率百分比
// 来源：PRD BLD-2 医馆等级数据

const CLINIC_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 3, upgradeCost: { grain: 100, gold: 150, troops: 0, timeSeconds: 15, ore: 0, wood: 0 } },
  // Lv2
  { production: 5, upgradeCost: { grain: 100, gold: 150, troops: 0, timeSeconds: 15, ore: 0, wood: 0 } },
  // Lv3~5: 每级 ×1.8 费用, ×1.6 时间, 恢复速率 5%→15%
  { production: 8.0, upgradeCost: { grain: 180, gold: 270, troops: 0, timeSeconds: 24, ore: 0, wood: 0 } },
  { production: 11.5, upgradeCost: { grain: 324, gold: 486, troops: 0, timeSeconds: 38, ore: 0, wood: 0 } },
  { production: 15.0, upgradeCost: { grain: 583, gold: 875, troops: 0, timeSeconds: 61, ore: 0, wood: 0 } },
  // Lv6~10: 每级 ×1.6 费用, ×1.4 时间, 恢复速率 15%→30%
  { production: 18.0, upgradeCost: { grain: 933, gold: 1400, troops: 0, timeSeconds: 85, ore: 0, wood: 0 } },
  { production: 21.0, upgradeCost: { grain: 1492, gold: 2240, troops: 0, timeSeconds: 120, ore: 0, wood: 0 } },
  { production: 24.0, upgradeCost: { grain: 2388, gold: 3584, troops: 0, timeSeconds: 167, ore: 0, wood: 0 } },
  { production: 27.0, upgradeCost: { grain: 3821, gold: 5734, troops: 0, timeSeconds: 234, ore: 0, wood: 0 } },
  { production: 30.0, upgradeCost: { grain: 6113, gold: 9175, troops: 0, timeSeconds: 328, ore: 0, wood: 0 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 恢复速率 30%→60%
  { production: 33.0, upgradeCost: { grain: 5805, gold: 8708, troops: 0, timeSeconds: 306, ore: 0, wood: 0 } },
  { production: 36.0, upgradeCost: { grain: 8708, gold: 13061, troops: 0, timeSeconds: 397, ore: 0, wood: 0 } },
  { production: 39.0, upgradeCost: { grain: 13061, gold: 19592, troops: 0, timeSeconds: 516, ore: 0, wood: 0 } },
  { production: 42.0, upgradeCost: { grain: 19592, gold: 29388, troops: 0, timeSeconds: 671, ore: 0, wood: 0 } },
  { production: 45.0, upgradeCost: { grain: 29388, gold: 44082, troops: 0, timeSeconds: 873, ore: 0, wood: 0 } },
  { production: 48.0, upgradeCost: { grain: 44082, gold: 66123, troops: 0, timeSeconds: 1134, ore: 0, wood: 0 } },
  { production: 51.0, upgradeCost: { grain: 66123, gold: 99184, troops: 0, timeSeconds: 1475, ore: 0, wood: 0 } },
  { production: 54.0, upgradeCost: { grain: 99184, gold: 148776, troops: 0, timeSeconds: 1917, ore: 0, wood: 0 } },
  { production: 57.0, upgradeCost: { grain: 148776, gold: 223164, troops: 0, timeSeconds: 2492, ore: 0, wood: 0 } },
  { production: 60.0, upgradeCost: { grain: 223164, gold: 334746, troops: 0, timeSeconds: 3240, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 10. 城墙等级数据表（1~20级）
// ─────────────────────────────────────────────
// 产出：防御加成百分比
// specialValue：城防值
// 来源：PRD BLD-2 城墙等级数据

const WALL_LEVEL_TABLE: LevelData[] = [
  // Lv1
  { production: 3, specialValue: 300, upgradeCost: { grain: 300, gold: 200, troops: 100, timeSeconds: 30, ore: 0, wood: 0 } },
  // Lv2
  { production: 3, specialValue: 500, upgradeCost: { grain: 300, gold: 200, troops: 100, timeSeconds: 30, ore: 0, wood: 0 } },
  // Lv3
  { production: 5, specialValue: 800, upgradeCost: { grain: 800, gold: 500, troops: 250, timeSeconds: 60, ore: 0, wood: 0 } },
  // Lv4~5: 每级 ×2.0 费用, ×1.8 时间, 防御加成 5%→12%, 城防 800→2000
  { production: 8.0, specialValue: 1400, upgradeCost: { grain: 1600, gold: 1000, troops: 500, timeSeconds: 108, ore: 0, wood: 0 } },
  { production: 12.0, specialValue: 2000, upgradeCost: { grain: 3200, gold: 2000, troops: 1000, timeSeconds: 194, ore: 0, wood: 0 } },
  // Lv6~10: 每级 ×1.7 费用, ×1.5 时间, 防御加成 12%→25%, 城防 2000→5000
  { production: 15.0, specialValue: 2600, upgradeCost: { grain: 5440, gold: 3400, troops: 1700, timeSeconds: 291, ore: 0, wood: 0 } },
  { production: 17.5, specialValue: 3200, upgradeCost: { grain: 9248, gold: 5780, troops: 2890, timeSeconds: 436, ore: 0, wood: 0 } },
  { production: 20.0, specialValue: 3800, upgradeCost: { grain: 15722, gold: 9826, troops: 4913, timeSeconds: 655, ore: 0, wood: 0 } },
  { production: 22.5, specialValue: 4400, upgradeCost: { grain: 26727, gold: 16704, troops: 8352, timeSeconds: 982, ore: 0, wood: 0 } },
  { production: 25.0, specialValue: 5000, upgradeCost: { grain: 45435, gold: 28397, troops: 14199, timeSeconds: 1473, ore: 0, wood: 0 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 防御加成 25%→50%, 城防 5000→15000
  { production: 27.0, specialValue: 5500, upgradeCost: { grain: 57924, gold: 36202, troops: 18102, timeSeconds: 1907, ore: 0, wood: 0 } },
  { production: 29.56, specialValue: 6556, upgradeCost: { grain: 86886, gold: 54304, troops: 27153, timeSeconds: 2479, ore: 0, wood: 0 } },
  { production: 32.11, specialValue: 7611, upgradeCost: { grain: 130329, gold: 81456, troops: 40730, timeSeconds: 3223, ore: 0, wood: 0 } },
  { production: 34.67, specialValue: 8667, upgradeCost: { grain: 195494, gold: 122183, troops: 61094, timeSeconds: 4190, ore: 0, wood: 0 } },
  { production: 37.22, specialValue: 9722, upgradeCost: { grain: 293240, gold: 183275, troops: 91641, timeSeconds: 5447, ore: 0, wood: 0 } },
  { production: 39.78, specialValue: 10778, upgradeCost: { grain: 439860, gold: 274913, troops: 137462, timeSeconds: 7081, ore: 0, wood: 0 } },
  { production: 42.33, specialValue: 11833, upgradeCost: { grain: 659791, gold: 412369, troops: 206193, timeSeconds: 9205, ore: 0, wood: 0 } },
  { production: 44.89, specialValue: 12889, upgradeCost: { grain: 989686, gold: 618554, troops: 309290, timeSeconds: 11967, ore: 0, wood: 0 } },
  { production: 47.44, specialValue: 13944, upgradeCost: { grain: 1484529, gold: 927830, troops: 463934, timeSeconds: 15557, ore: 0, wood: 0 } },
  { production: 50.0, specialValue: 15000, upgradeCost: { grain: 2226793, gold: 1391746, troops: 695902, timeSeconds: 20224, ore: 0, wood: 0 } },
];

// ─────────────────────────────────────────────
// 11. 建筑定义汇总
// ─────────────────────────────────────────────

/** 11 种建筑的完整定义 */
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
    unlockCastleLevel: 0,
    production: { resourceType: 'gold', baseValue: 0.8, perLevel: 0 },
    levelTable: MARKET_LEVEL_TABLE,
  },
  mine: {
    type: 'mine',
    maxLevel: 25,
    unlockCastleLevel: 0,
    production: { resourceType: 'ore', baseValue: 0.8, perLevel: 0 },
    levelTable: MINE_LEVEL_TABLE,
  },
  lumberMill: {
    type: 'lumberMill',
    maxLevel: 25,
    unlockCastleLevel: 0,
    production: { resourceType: 'wood', baseValue: 0.8, perLevel: 0 },
    levelTable: LUMBER_MILL_LEVEL_TABLE,
  },
  barracks: {
    type: 'barracks',
    maxLevel: 25,
    unlockCastleLevel: 2,
    production: { resourceType: 'troops', baseValue: 0.5, perLevel: 0 },
    levelTable: BARRACKS_LEVEL_TABLE,
  },
  workshop: {
    type: 'workshop',
    maxLevel: 20,
    unlockCastleLevel: 3,
    // 工坊产出为锻造效率(production)和强化折扣(specialValue)
    specialAttribute: {
      name: '强化折扣',
      baseValue: 3,
      perLevel: 1,
    },
    levelTable: WORKSHOP_LEVEL_TABLE,
  },
  academy: {
    type: 'academy',
    maxLevel: 20,
    unlockCastleLevel: 3,
    production: { resourceType: 'techPoint', baseValue: 0.3, perLevel: 0 },
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
  tavern: {
    type: 'tavern',
    maxLevel: 20,
    unlockCastleLevel: 5,
    levelTable: TAVERN_LEVEL_TABLE,
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

// ─────────────────────────────────────────────
// 15. 升级消耗梯度规则（Sprint 1 BLD-F02）
// ─────────────────────────────────────────────
// Lv1~5: 仅粮草+铜钱
// Lv6+:  引入矿石（= grain × 20%）
// Lv10+: 引入木材（= grain × 15%）
// 适用建筑：farmland, market, mine, lumberMill, barracks, academy, clinic, tavern

/** 矿石消耗占粮草消耗的比例（Lv6+生效） */
export const ORE_COST_RATIO = 0.20;

/** 木材消耗占粮草消耗的比例（Lv10+生效） */
export const WOOD_COST_RATIO = 0.15;

/**
 * 为等级数据表中的升级消耗添加矿石/木材
 * 规则：Lv6+ 添加矿石，Lv10+ 添加木材
 *
 * @param table 等级数据表（会被就地修改）
 * @returns 修改后的等级数据表（同一引用）
 */
function enrichUpgradeCosts(table: LevelData[]): LevelData[] {
  for (let i = 0; i < table.length; i++) {
    const lv = i + 1; // levelTable 索引 0 = Lv1
    const cost = table[i].upgradeCost;
    // Lv6+ 引入矿石
    if (lv >= 6 && cost.ore === 0) {
      cost.ore = Math.floor(cost.grain * ORE_COST_RATIO);
    }
    // Lv10+ 引入木材
    if (lv >= 10 && cost.wood === 0) {
      cost.wood = Math.floor(cost.grain * WOOD_COST_RATIO);
    }
  }
  return table;
}

// 应用矿石/木材升级消耗梯度
enrichUpgradeCosts(FARMLAND_LEVEL_TABLE);
enrichUpgradeCosts(MARKET_LEVEL_TABLE);
enrichUpgradeCosts(MINE_LEVEL_TABLE);
enrichUpgradeCosts(LUMBER_MILL_LEVEL_TABLE);
enrichUpgradeCosts(BARRACKS_LEVEL_TABLE);
enrichUpgradeCosts(ACADEMY_LEVEL_TABLE);
enrichUpgradeCosts(CLINIC_LEVEL_TABLE);
enrichUpgradeCosts(TAVERN_LEVEL_TABLE);
// 注意：castle（主城）使用 troops 而非 ore/wood，保持不变
// 注意：workshop（工坊）已有 ore 消耗，保持不变
// 注意：wall（城墙）由 PRD 单独配置，保持不变

// ─────────────────────────────────────────────
// 16. 建筑库存配置（Sprint 1 BLD-F26/BLD-F10/BLD-F15）
// ─────────────────────────────────────────────

/** 建筑库存溢出降速比例（50%） */
export const STORAGE_OVERFLOW_SLOWDOWN = 0.5;

/** 默认缓冲时间（秒）— 库存容量 = 产出速率 × 缓冲时间 */
export const DEFAULT_BUFFER_SECONDS = 7200; // 2小时

/** 新手缓冲时间（秒）— Lv1~5 建筑使用更长的缓冲时间 */
export const NEWBIE_BUFFER_SECONDS = 2700; // 45分钟
