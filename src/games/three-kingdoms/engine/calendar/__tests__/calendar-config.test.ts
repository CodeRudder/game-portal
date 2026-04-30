/**
 * calendar/calendar-config.ts 单元测试
 *
 * 验证常量：
 * - DEFAULT_TIME_SCALE, DAYS_PER_MONTH, MONTHS_PER_YEAR, DAYS_PER_YEAR, DAYS_PER_SEASON
 * - SEASON_MONTH_MAP
 * - SEASON_BONUSES
 * - WEATHER_WEIGHTS
 * - ERA_TABLE
 * - CALENDAR_SAVE_VERSION
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIME_SCALE,
  DAYS_PER_MONTH,
  MONTHS_PER_YEAR,
  DAYS_PER_YEAR,
  DAYS_PER_SEASON,
  SEASON_MONTH_MAP,
  SEASON_BONUSES,
  WEATHER_WEIGHTS,
  WEATHER_CHANGE_INTERVAL_MIN,
  WEATHER_CHANGE_INTERVAL_MAX,
  ERA_TABLE,
  CALENDAR_SAVE_VERSION,
} from '../calendar-config';

// ═══════════════════════════════════════════
// 时间参数
// ═══════════════════════════════════════════
describe('时间参数', () => {
  it('DEFAULT_TIME_SCALE > 0', () => {
    expect(DEFAULT_TIME_SCALE).toBeGreaterThan(0);
  });

  it('DAYS_PER_MONTH > 0', () => {
    expect(DAYS_PER_MONTH).toBeGreaterThan(0);
  });

  it('MONTHS_PER_YEAR = 12', () => {
    expect(MONTHS_PER_YEAR).toBe(12);
  });

  it('DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR', () => {
    expect(DAYS_PER_YEAR).toBe(DAYS_PER_MONTH * MONTHS_PER_YEAR);
  });

  it('DAYS_PER_SEASON = DAYS_PER_YEAR / 4', () => {
    expect(DAYS_PER_SEASON).toBe(DAYS_PER_YEAR / 4);
  });

  it('DAYS_PER_YEAR 为 360', () => {
    expect(DAYS_PER_YEAR).toBe(360);
  });

  it('DAYS_PER_SEASON 为 90', () => {
    expect(DAYS_PER_SEASON).toBe(90);
  });
});

// ═══════════════════════════════════════════
// SEASON_MONTH_MAP
// ═══════════════════════════════════════════
describe('SEASON_MONTH_MAP', () => {
  it('覆盖 1-12 月', () => {
    for (let m = 1; m <= 12; m++) {
      expect(SEASON_MONTH_MAP[m]).toBeDefined();
    }
  });

  it('只有4种季节值', () => {
    const seasons = new Set(Object.values(SEASON_MONTH_MAP));
    expect(seasons.size).toBe(4);
    expect(seasons.has('spring')).toBe(true);
    expect(seasons.has('summer')).toBe(true);
    expect(seasons.has('autumn')).toBe(true);
    expect(seasons.has('winter')).toBe(true);
  });

  it('1-3月=春, 4-6月=夏, 7-9月=秋, 10-12月=冬', () => {
    expect(SEASON_MONTH_MAP[1]).toBe('spring');
    expect(SEASON_MONTH_MAP[3]).toBe('spring');
    expect(SEASON_MONTH_MAP[4]).toBe('summer');
    expect(SEASON_MONTH_MAP[6]).toBe('summer');
    expect(SEASON_MONTH_MAP[7]).toBe('autumn');
    expect(SEASON_MONTH_MAP[9]).toBe('autumn');
    expect(SEASON_MONTH_MAP[10]).toBe('winter');
    expect(SEASON_MONTH_MAP[12]).toBe('winter');
  });

  it('每季3个月', () => {
    const counts: Record<string, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    for (let m = 1; m <= 12; m++) {
      counts[SEASON_MONTH_MAP[m]]++;
    }
    expect(counts.spring).toBe(3);
    expect(counts.summer).toBe(3);
    expect(counts.autumn).toBe(3);
    expect(counts.winter).toBe(3);
  });
});

// ═══════════════════════════════════════════
// SEASON_BONUSES
// ═══════════════════════════════════════════
describe('SEASON_BONUSES', () => {
  it('覆盖4个季节', () => {
    expect(Object.keys(SEASON_BONUSES)).toHaveLength(4);
  });

  it('每个季节有3种倍率', () => {
    for (const [, bonus] of Object.entries(SEASON_BONUSES)) {
      expect(bonus).toHaveProperty('grainMultiplier');
      expect(bonus).toHaveProperty('goldMultiplier');
      expect(bonus).toHaveProperty('troopsMultiplier');
    }
  });

  it('所有倍率 > 0', () => {
    for (const bonus of Object.values(SEASON_BONUSES)) {
      expect(bonus.grainMultiplier).toBeGreaterThan(0);
      expect(bonus.goldMultiplier).toBeGreaterThan(0);
      expect(bonus.troopsMultiplier).toBeGreaterThan(0);
    }
  });

  it('秋季粮草倍率最高', () => {
    expect(SEASON_BONUSES.autumn.grainMultiplier).toBeGreaterThanOrEqual(SEASON_BONUSES.spring.grainMultiplier);
    expect(SEASON_BONUSES.autumn.grainMultiplier).toBeGreaterThanOrEqual(SEASON_BONUSES.summer.grainMultiplier);
    expect(SEASON_BONUSES.autumn.grainMultiplier).toBeGreaterThanOrEqual(SEASON_BONUSES.winter.grainMultiplier);
  });

  it('冬季粮草倍率 < 1（减产）', () => {
    expect(SEASON_BONUSES.winter.grainMultiplier).toBeLessThan(1);
  });

  it('冬季兵力倍率 < 1', () => {
    expect(SEASON_BONUSES.winter.troopsMultiplier).toBeLessThan(1);
  });
});

// ═══════════════════════════════════════════
// WEATHER_WEIGHTS
// ═══════════════════════════════════════════
describe('WEATHER_WEIGHTS', () => {
  it('权重总和为 100', () => {
    const sum = Object.values(WEATHER_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('所有权重 > 0', () => {
    for (const w of Object.values(WEATHER_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
    }
  });

  it('晴天权重最大', () => {
    const max = Math.max(...Object.values(WEATHER_WEIGHTS));
    expect(WEATHER_WEIGHTS.clear).toBe(max);
  });

  it('包含4种天气类型', () => {
    expect(Object.keys(WEATHER_WEIGHTS)).toHaveLength(4);
    expect(WEATHER_WEIGHTS).toHaveProperty('clear');
    expect(WEATHER_WEIGHTS).toHaveProperty('rain');
    expect(WEATHER_WEIGHTS).toHaveProperty('snow');
    expect(WEATHER_WEIGHTS).toHaveProperty('wind');
  });
});

// ═══════════════════════════════════════════
// 天气变化间隔
// ═══════════════════════════════════════════
describe('天气变化间隔', () => {
  it('MIN < MAX', () => {
    expect(WEATHER_CHANGE_INTERVAL_MIN).toBeLessThan(WEATHER_CHANGE_INTERVAL_MAX);
  });

  it('MIN > 0', () => {
    expect(WEATHER_CHANGE_INTERVAL_MIN).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// ERA_TABLE
// ═══════════════════════════════════════════
describe('ERA_TABLE', () => {
  it('非空', () => {
    expect(ERA_TABLE.length).toBeGreaterThan(0);
  });

  it('从第1年开始', () => {
    expect(ERA_TABLE[0].startYear).toBe(1);
  });

  it('年号区间连续无重叠', () => {
    for (let i = 1; i < ERA_TABLE.length; i++) {
      expect(ERA_TABLE[i].startYear).toBe(ERA_TABLE[i - 1].endYear + 1);
    }
  });

  it('每个年号 endYear >= startYear', () => {
    for (const era of ERA_TABLE) {
      expect(era.endYear).toBeGreaterThanOrEqual(era.startYear);
    }
  });

  it('所有年号有名称', () => {
    for (const era of ERA_TABLE) {
      expect(era.name).toBeTruthy();
      expect(era.name.length).toBeGreaterThan(0);
    }
  });

  it('startYear 严格递增', () => {
    for (let i = 1; i < ERA_TABLE.length; i++) {
      expect(ERA_TABLE[i].startYear).toBeGreaterThan(ERA_TABLE[i - 1].startYear);
    }
  });
});

// ═══════════════════════════════════════════
// CALENDAR_SAVE_VERSION
// ═══════════════════════════════════════════
describe('CALENDAR_SAVE_VERSION', () => {
  it('为正整数', () => {
    expect(CALENDAR_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(CALENDAR_SAVE_VERSION)).toBe(true);
  });
});
