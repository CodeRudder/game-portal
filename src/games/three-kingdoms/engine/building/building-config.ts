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
// 2. 通用等级段数据（已预计算为静态数组）
// ─────────────────────────────────────────────

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
  { production: 20.0, upgradeCost: { grain: 72000, gold: 57600, troops: 14400, timeSeconds: 14400 } },
  { production: 22.0, upgradeCost: { grain: 129600, gold: 103680, troops: 25920, timeSeconds: 28800 } },
  { production: 24.0, upgradeCost: { grain: 233280, gold: 186624, troops: 46656, timeSeconds: 57600 } },
  { production: 26.0, upgradeCost: { grain: 419904, gold: 335923, troops: 83981, timeSeconds: 115200 } },
  { production: 28.0, upgradeCost: { grain: 755827, gold: 604662, troops: 151165, timeSeconds: 230400 } },
  // Lv15→20: 每级 ×1.6 费用, ×1.8 时间, +2%/级
  { production: 30.0, upgradeCost: { grain: 302331, gold: 241866, troops: 60466, timeSeconds: 414720 } },
  { production: 32.0, upgradeCost: { grain: 483730, gold: 386985, troops: 96745, timeSeconds: 746496 } },
  { production: 34.0, upgradeCost: { grain: 773968, gold: 619176, troops: 154792, timeSeconds: 1343693 } },
  { production: 36.0, upgradeCost: { grain: 1238349, gold: 990681, troops: 247667, timeSeconds: 2418647 } },
  { production: 38.0, upgradeCost: { grain: 1981358, gold: 1585090, troops: 396267, timeSeconds: 4353565 } },
  // Lv20→25: 每级 ×1.5 费用, ×1.5 时间, +2%/级
  { production: 40.0, upgradeCost: { grain: 2963492, gold: 2370794, troops: 592698, timeSeconds: 2954880 } },
  { production: 42.0, upgradeCost: { grain: 4445237, gold: 3556190, troops: 889047, timeSeconds: 4432320 } },
  { production: 44.0, upgradeCost: { grain: 6667856, gold: 5334285, troops: 1333570, timeSeconds: 6648480 } },
  { production: 46.0, upgradeCost: { grain: 10001784, gold: 8001428, troops: 2000356, timeSeconds: 9972720 } },
  { production: 48.0, upgradeCost: { grain: 15002676, gold: 12002142, troops: 3000534, timeSeconds: 14959080 } },
  // Lv25→30: 每级 ×1.4 费用, ×1.3 时间, +2%/级
  { production: 50.0, upgradeCost: { grain: 21035182, gold: 16828146, troops: 4207036, timeSeconds: 29136440 } },
  { production: 52.0, upgradeCost: { grain: 29449255, gold: 23559404, troops: 5889851, timeSeconds: 37877372 } },
  { production: 54.0, upgradeCost: { grain: 41228957, gold: 32983165, troops: 8245791, timeSeconds: 49240583 } },
  { production: 56.0, upgradeCost: { grain: 57720539, gold: 46176432, troops: 11544108, timeSeconds: 64012758 } },
  { production: 58.0, upgradeCost: { grain: 80808755, gold: 64647004, troops: 16161751, timeSeconds: 83216586 } },
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
  { production: 3.8, upgradeCost: { grain: 1800, gold: 900, troops: 0, timeSeconds: 96 } },
  { production: 4.85, upgradeCost: { grain: 3240, gold: 1620, troops: 0, timeSeconds: 154 } },
  { production: 5.9, upgradeCost: { grain: 5832, gold: 2916, troops: 0, timeSeconds: 246 } },
  { production: 6.95, upgradeCost: { grain: 10498, gold: 5249, troops: 0, timeSeconds: 393 } },
  { production: 8.0, upgradeCost: { grain: 18896, gold: 9448, troops: 0, timeSeconds: 629 } },
  // Lv11~15: 每级 ×1.6 费用, ×1.5 时间, 产出 8.0→16.0
  { production: 9.6, upgradeCost: { grain: 30234, gold: 15117, troops: 0, timeSeconds: 604 } },
  { production: 11.2, upgradeCost: { grain: 48374, gold: 24187, troops: 0, timeSeconds: 907 } },
  { production: 12.8, upgradeCost: { grain: 77398, gold: 38699, troops: 0, timeSeconds: 1360 } },
  { production: 14.4, upgradeCost: { grain: 123837, gold: 61918, troops: 0, timeSeconds: 2040 } },
  { production: 16.0, upgradeCost: { grain: 198139, gold: 99069, troops: 0, timeSeconds: 3060 } },
  // Lv16~20: 每级 ×1.5 费用, ×1.4 时间, 产出 16.0→28.0
  { production: 17.6, upgradeCost: { grain: 298419, gold: 149210, troops: 0, timeSeconds: 4273 } },
  { production: 20.2, upgradeCost: { grain: 447628, gold: 223814, troops: 0, timeSeconds: 5982 } },
  { production: 22.8, upgradeCost: { grain: 671443, gold: 335721, troops: 0, timeSeconds: 8375 } },
  { production: 25.4, upgradeCost: { grain: 1007164, gold: 503582, troops: 0, timeSeconds: 11725 } },
  { production: 28.0, upgradeCost: { grain: 1510746, gold: 755373, troops: 0, timeSeconds: 16414 } },
  // Lv21~25: 每级 ×1.4 费用, ×1.3 时间, 产出 28.0→45.0
  { production: 30.2, upgradeCost: { grain: 2111549, gold: 1055775, troops: 0, timeSeconds: 21789 } },
  { production: 33.9, upgradeCost: { grain: 2956168, gold: 1478085, troops: 0, timeSeconds: 28326 } },
  { production: 37.6, upgradeCost: { grain: 4138635, gold: 2069319, troops: 0, timeSeconds: 36824 } },
  { production: 41.3, upgradeCost: { grain: 5794089, gold: 2897047, troops: 0, timeSeconds: 47871 } },
  { production: 45.0, upgradeCost: { grain: 8111725, gold: 4055865, troops: 0, timeSeconds: 62232 } },
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
  { production: 3.2, upgradeCost: { grain: 1440, gold: 1800, troops: 0, timeSeconds: 96 } },
  { production: 3.78, upgradeCost: { grain: 2592, gold: 3240, troops: 0, timeSeconds: 154 } },
  { production: 4.35, upgradeCost: { grain: 4666, gold: 5832, troops: 0, timeSeconds: 246 } },
  { production: 4.92, upgradeCost: { grain: 8398, gold: 10498, troops: 0, timeSeconds: 393 } },
  { production: 5.5, upgradeCost: { grain: 15117, gold: 18896, troops: 0, timeSeconds: 629 } },
  // Lv11~15
  { production: 6.4, upgradeCost: { grain: 24187, gold: 30234, troops: 0, timeSeconds: 604 } },
  { production: 7.3, upgradeCost: { grain: 38700, gold: 48374, troops: 0, timeSeconds: 907 } },
  { production: 8.2, upgradeCost: { grain: 61919, gold: 77398, troops: 0, timeSeconds: 1360 } },
  { production: 9.1, upgradeCost: { grain: 99071, gold: 123837, troops: 0, timeSeconds: 2040 } },
  { production: 10.0, upgradeCost: { grain: 158513, gold: 198139, troops: 0, timeSeconds: 3060 } },
  // Lv16~20
  { production: 11.6, upgradeCost: { grain: 238564, gold: 298419, troops: 0, timeSeconds: 4273 } },
  { production: 13.2, upgradeCost: { grain: 357847, gold: 447628, troops: 0, timeSeconds: 5982 } },
  { production: 14.8, upgradeCost: { grain: 536770, gold: 671443, troops: 0, timeSeconds: 8375 } },
  { production: 16.4, upgradeCost: { grain: 805155, gold: 1007164, troops: 0, timeSeconds: 11725 } },
  { production: 18.0, upgradeCost: { grain: 1207733, gold: 1510746, troops: 0, timeSeconds: 16414 } },
  // Lv21~25
  { production: 19.6, upgradeCost: { grain: 1688912, gold: 2111549, troops: 0, timeSeconds: 21789 } },
  { production: 23.45, upgradeCost: { grain: 2364477, gold: 2956168, troops: 0, timeSeconds: 28326 } },
  { production: 27.3, upgradeCost: { grain: 3310268, gold: 4138635, troops: 0, timeSeconds: 36824 } },
  { production: 31.15, upgradeCost: { grain: 4634376, gold: 5794089, troops: 0, timeSeconds: 47871 } },
  { production: 35.0, upgradeCost: { grain: 6488126, gold: 8111725, troops: 0, timeSeconds: 62232 } },
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
  { production: 2.4, upgradeCost: { grain: 2160, gold: 1440, troops: 360, timeSeconds: 144 } },
  { production: 3.18, upgradeCost: { grain: 3888, gold: 2592, troops: 648, timeSeconds: 230 } },
  { production: 3.95, upgradeCost: { grain: 6998, gold: 4666, troops: 1166, timeSeconds: 369 } },
  { production: 4.72, upgradeCost: { grain: 12597, gold: 8398, troops: 2100, timeSeconds: 590 } },
  { production: 5.5, upgradeCost: { grain: 22675, gold: 15117, troops: 3779, timeSeconds: 944 } },
  // Lv11~15
  { production: 6.4, upgradeCost: { grain: 36280, gold: 24187, troops: 6046, timeSeconds: 908 } },
  { production: 7.55, upgradeCost: { grain: 58048, gold: 38700, troops: 9674, timeSeconds: 1361 } },
  { production: 8.7, upgradeCost: { grain: 92877, gold: 61919, troops: 15479, timeSeconds: 2042 } },
  { production: 9.85, upgradeCost: { grain: 148603, gold: 99071, troops: 24766, timeSeconds: 3063 } },
  { production: 11.0, upgradeCost: { grain: 237765, gold: 158513, troops: 39626, timeSeconds: 4594 } },
  // Lv16~20
  { production: 12.4, upgradeCost: { grain: 358102, gold: 238564, troops: 59648, timeSeconds: 6409 } },
  { production: 14.3, upgradeCost: { grain: 537154, gold: 357847, troops: 89471, timeSeconds: 8973 } },
  { production: 16.2, upgradeCost: { grain: 805731, gold: 536770, troops: 134207, timeSeconds: 12562 } },
  { production: 18.1, upgradeCost: { grain: 1208596, gold: 805155, troops: 201310, timeSeconds: 17587 } },
  { production: 20.0, upgradeCost: { grain: 1812894, gold: 1207733, troops: 301965, timeSeconds: 24622 } },
  // Lv21~25
  { production: 21.2, upgradeCost: { grain: 2533857, gold: 1688912, troops: 422309, timeSeconds: 32685 } },
  { production: 22.9, upgradeCost: { grain: 3547400, gold: 2364477, troops: 591232, timeSeconds: 42490 } },
  { production: 24.6, upgradeCost: { grain: 4966360, gold: 3310268, troops: 827725, timeSeconds: 55237 } },
  { production: 26.3, upgradeCost: { grain: 6952904, gold: 4634376, troops: 1158815, timeSeconds: 71808 } },
  { production: 28.0, upgradeCost: { grain: 9734066, gold: 6488126, troops: 1622341, timeSeconds: 93350 } },
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
  { production: 3.5, upgradeCost: { grain: 1000, gold: 1600, troops: 0, timeSeconds: 108 } },
  { production: 5.0, upgradeCost: { grain: 2000, gold: 3200, troops: 0, timeSeconds: 194 } },
  // Lv6~10: 每级 ×1.7 费用, ×1.5 时间, 产出 5→15
  { production: 7.0, upgradeCost: { grain: 3400, gold: 5440, troops: 0, timeSeconds: 291 } },
  { production: 9.0, upgradeCost: { grain: 5780, gold: 9248, troops: 0, timeSeconds: 436 } },
  { production: 11.0, upgradeCost: { grain: 9826, gold: 15722, troops: 0, timeSeconds: 655 } },
  { production: 13.0, upgradeCost: { grain: 16704, gold: 26727, troops: 0, timeSeconds: 982 } },
  { production: 15.0, upgradeCost: { grain: 28397, gold: 45435, troops: 0, timeSeconds: 1473 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 产出 15→40
  { production: 17.5, upgradeCost: { grain: 36202, gold: 57924, troops: 0, timeSeconds: 1907 } },
  { production: 20.0, upgradeCost: { grain: 54304, gold: 86886, troops: 0, timeSeconds: 2479 } },
  { production: 22.5, upgradeCost: { grain: 81456, gold: 130329, troops: 0, timeSeconds: 3223 } },
  { production: 25.0, upgradeCost: { grain: 122183, gold: 195494, troops: 0, timeSeconds: 4190 } },
  { production: 27.5, upgradeCost: { grain: 183275, gold: 293240, troops: 0, timeSeconds: 5447 } },
  { production: 30.0, upgradeCost: { grain: 274913, gold: 439860, troops: 0, timeSeconds: 7081 } },
  { production: 32.5, upgradeCost: { grain: 412369, gold: 659791, troops: 0, timeSeconds: 9205 } },
  { production: 35.0, upgradeCost: { grain: 618554, gold: 989686, troops: 0, timeSeconds: 11967 } },
  { production: 37.5, upgradeCost: { grain: 927830, gold: 1484529, troops: 0, timeSeconds: 15557 } },
  { production: 40.0, upgradeCost: { grain: 1391746, gold: 2226793, troops: 0, timeSeconds: 20224 } },
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
  { production: 0.85, upgradeCost: { grain: 720, gold: 900, troops: 0, timeSeconds: 72 } },
  { production: 1.2, upgradeCost: { grain: 1296, gold: 1620, troops: 0, timeSeconds: 115 } },
  // Lv6~10: 每级 ×1.6 费用, ×1.4 时间, 产出 1.2→3.0
  { production: 1.56, upgradeCost: { grain: 2074, gold: 2592, troops: 0, timeSeconds: 161 } },
  { production: 1.92, upgradeCost: { grain: 3318, gold: 4147, troops: 0, timeSeconds: 225 } },
  { production: 2.28, upgradeCost: { grain: 5308, gold: 6636, troops: 0, timeSeconds: 316 } },
  { production: 2.64, upgradeCost: { grain: 8493, gold: 10617, troops: 0, timeSeconds: 442 } },
  { production: 3.0, upgradeCost: { grain: 13590, gold: 16987, troops: 0, timeSeconds: 618 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 产出 3.0→8.0
  { production: 3.5, upgradeCost: { grain: 12914, gold: 16142, troops: 0, timeSeconds: 572 } },
  { production: 4.0, upgradeCost: { grain: 19370, gold: 24212, troops: 0, timeSeconds: 744 } },
  { production: 4.5, upgradeCost: { grain: 29055, gold: 36318, troops: 0, timeSeconds: 967 } },
  { production: 5.0, upgradeCost: { grain: 43583, gold: 54478, troops: 0, timeSeconds: 1257 } },
  { production: 5.5, upgradeCost: { grain: 65375, gold: 81716, troops: 0, timeSeconds: 1634 } },
  { production: 6.0, upgradeCost: { grain: 98062, gold: 122575, troops: 0, timeSeconds: 2124 } },
  { production: 6.5, upgradeCost: { grain: 147093, gold: 183862, troops: 0, timeSeconds: 2761 } },
  { production: 7.0, upgradeCost: { grain: 220639, gold: 275793, troops: 0, timeSeconds: 3589 } },
  { production: 7.5, upgradeCost: { grain: 330959, gold: 413689, troops: 0, timeSeconds: 4666 } },
  { production: 8.0, upgradeCost: { grain: 496438, gold: 620533, troops: 0, timeSeconds: 6066 } },
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
  { production: 8.0, upgradeCost: { grain: 180, gold: 270, troops: 0, timeSeconds: 24 } },
  { production: 11.5, upgradeCost: { grain: 324, gold: 486, troops: 0, timeSeconds: 38 } },
  { production: 15.0, upgradeCost: { grain: 583, gold: 875, troops: 0, timeSeconds: 61 } },
  // Lv6~10: 每级 ×1.6 费用, ×1.4 时间, 恢复速率 15%→30%
  { production: 18.0, upgradeCost: { grain: 933, gold: 1400, troops: 0, timeSeconds: 85 } },
  { production: 21.0, upgradeCost: { grain: 1492, gold: 2240, troops: 0, timeSeconds: 120 } },
  { production: 24.0, upgradeCost: { grain: 2388, gold: 3584, troops: 0, timeSeconds: 167 } },
  { production: 27.0, upgradeCost: { grain: 3821, gold: 5734, troops: 0, timeSeconds: 234 } },
  { production: 30.0, upgradeCost: { grain: 6113, gold: 9175, troops: 0, timeSeconds: 328 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 恢复速率 30%→60%
  { production: 33.0, upgradeCost: { grain: 5805, gold: 8708, troops: 0, timeSeconds: 306 } },
  { production: 36.0, upgradeCost: { grain: 8708, gold: 13061, troops: 0, timeSeconds: 397 } },
  { production: 39.0, upgradeCost: { grain: 13061, gold: 19592, troops: 0, timeSeconds: 516 } },
  { production: 42.0, upgradeCost: { grain: 19592, gold: 29388, troops: 0, timeSeconds: 671 } },
  { production: 45.0, upgradeCost: { grain: 29388, gold: 44082, troops: 0, timeSeconds: 873 } },
  { production: 48.0, upgradeCost: { grain: 44082, gold: 66123, troops: 0, timeSeconds: 1134 } },
  { production: 51.0, upgradeCost: { grain: 66123, gold: 99184, troops: 0, timeSeconds: 1475 } },
  { production: 54.0, upgradeCost: { grain: 99184, gold: 148776, troops: 0, timeSeconds: 1917 } },
  { production: 57.0, upgradeCost: { grain: 148776, gold: 223164, troops: 0, timeSeconds: 2492 } },
  { production: 60.0, upgradeCost: { grain: 223164, gold: 334746, troops: 0, timeSeconds: 3240 } },
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
  { production: 8.0, specialValue: 1400, upgradeCost: { grain: 1600, gold: 1000, troops: 500, timeSeconds: 108 } },
  { production: 12.0, specialValue: 2000, upgradeCost: { grain: 3200, gold: 2000, troops: 1000, timeSeconds: 194 } },
  // Lv6~10: 每级 ×1.7 费用, ×1.5 时间, 防御加成 12%→25%, 城防 2000→5000
  { production: 15.0, specialValue: 2600, upgradeCost: { grain: 5440, gold: 3400, troops: 1700, timeSeconds: 291 } },
  { production: 17.5, specialValue: 3200, upgradeCost: { grain: 9248, gold: 5780, troops: 2890, timeSeconds: 436 } },
  { production: 20.0, specialValue: 3800, upgradeCost: { grain: 15722, gold: 9826, troops: 4913, timeSeconds: 655 } },
  { production: 22.5, specialValue: 4400, upgradeCost: { grain: 26727, gold: 16704, troops: 8352, timeSeconds: 982 } },
  { production: 25.0, specialValue: 5000, upgradeCost: { grain: 45435, gold: 28397, troops: 14199, timeSeconds: 1473 } },
  // Lv11~20: 每级 ×1.5 费用, ×1.3 时间, 防御加成 25%→50%, 城防 5000→15000
  { production: 27.0, specialValue: 5500, upgradeCost: { grain: 57924, gold: 36202, troops: 18102, timeSeconds: 1907 } },
  { production: 29.56, specialValue: 6556, upgradeCost: { grain: 86886, gold: 54304, troops: 27153, timeSeconds: 2479 } },
  { production: 32.11, specialValue: 7611, upgradeCost: { grain: 130329, gold: 81456, troops: 40730, timeSeconds: 3223 } },
  { production: 34.67, specialValue: 8667, upgradeCost: { grain: 195494, gold: 122183, troops: 61094, timeSeconds: 4190 } },
  { production: 37.22, specialValue: 9722, upgradeCost: { grain: 293240, gold: 183275, troops: 91641, timeSeconds: 5447 } },
  { production: 39.78, specialValue: 10778, upgradeCost: { grain: 439860, gold: 274913, troops: 137462, timeSeconds: 7081 } },
  { production: 42.33, specialValue: 11833, upgradeCost: { grain: 659791, gold: 412369, troops: 206193, timeSeconds: 9205 } },
  { production: 44.89, specialValue: 12889, upgradeCost: { grain: 989686, gold: 618554, troops: 309290, timeSeconds: 11967 } },
  { production: 47.44, specialValue: 13944, upgradeCost: { grain: 1484529, gold: 927830, troops: 463934, timeSeconds: 15557 } },
  { production: 50.0, specialValue: 15000, upgradeCost: { grain: 2226793, gold: 1391746, troops: 695902, timeSeconds: 20224 } },
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
    production: { resourceType: 'mandate', baseValue: 0.1, perLevel: 0 },
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
