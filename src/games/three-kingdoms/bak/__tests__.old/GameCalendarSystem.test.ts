/**
 * GameCalendarSystem 单元测试
 * @module games/three-kingdoms/__tests__/GameCalendarSystem.test
 */

import { describe, it, expect } from 'vitest';
import {
  GameCalendarSystem,
  type Shichen,
  type Season,
  type GameDate,
} from '../GameCalendarSystem';

describe('GameCalendarSystem', () => {
  // ─────────────────────────────────────────────────────────
  // 1. 初始化日期
  // ─────────────────────────────────────────────────────────
  it('应初始化为建安元年正月初一子时', () => {
    const cal = new GameCalendarSystem();
    const date = cal.getCurrentDate();
    expect(date.year).toBe(1);
    expect(date.month).toBe(1);
    expect(date.day).toBe(1);
    expect(date.hour).toBe(0);
    expect(date.minute).toBe(0);
    expect(date.shichen).toBe('子');
    expect(date.season).toBe('春');
  });

  // ─────────────────────────────────────────────────────────
  // 2. 时间推进：60秒现实时间 → 1游戏小时
  // ─────────────────────────────────────────────────────────
  it('60秒现实时间应推进1游戏小时', () => {
    const cal = new GameCalendarSystem();
    cal.update(60);
    const date = cal.getCurrentDate();
    expect(date.hour).toBe(1);
    expect(date.minute).toBe(0);
  });

  it('24小时现实时间应推进到第二天', () => {
    const cal = new GameCalendarSystem();
    // 24分钟现实时间 = 24 * 60 = 1440秒 → 24游戏小时 → 第2天
    cal.update(24 * 60);
    const date = cal.getCurrentDate();
    expect(date.day).toBe(2);
    expect(date.hour).toBe(0);
  });

  // ─────────────────────────────────────────────────────────
  // 3. 时辰映射：12个时辰正确
  // ─────────────────────────────────────────────────────────
  it('应正确映射12个时辰', () => {
    const cal = new GameCalendarSystem();
    const expected: [number, Shichen][] = [
      [0, '子'], [1, '丑'], [2, '丑'], [3, '寅'],
      [4, '寅'], [5, '卯'], [6, '卯'], [7, '辰'],
      [8, '辰'], [9, '巳'], [10, '巳'], [11, '午'],
      [12, '午'], [13, '未'], [14, '未'], [15, '申'],
      [16, '申'], [17, '酉'], [18, '酉'], [19, '戌'],
      [20, '戌'], [21, '亥'], [22, '亥'], [23, '子'],
    ];
    expected.forEach(([hour, shichen]) => {
      expect(cal.getShichen(hour)).toBe(shichen);
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. 时辰描述
  // ─────────────────────────────────────────────────────────
  it('子时应为深夜', () => {
    const cal = new GameCalendarSystem();
    expect(cal.getShichenPeriod('子')).toBe('子时(深夜)');
    expect(cal.getShichenPeriod('午')).toBe('午时(中午)');
    expect(cal.getShichenPeriod('酉')).toBe('酉时(傍晚)');
  });

  // ─────────────────────────────────────────────────────────
  // 5. 季节判断
  // ─────────────────────────────────────────────────────────
  it('应正确判断季节', () => {
    const cal = new GameCalendarSystem();
    expect(cal.getCurrentSeason(1)).toBe('春');
    expect(cal.getCurrentSeason(3)).toBe('春');
    expect(cal.getCurrentSeason(4)).toBe('夏');
    expect(cal.getCurrentSeason(6)).toBe('夏');
    expect(cal.getCurrentSeason(7)).toBe('秋');
    expect(cal.getCurrentSeason(9)).toBe('秋');
    expect(cal.getCurrentSeason(10)).toBe('冬');
    expect(cal.getCurrentSeason(12)).toBe('冬');
  });

  // ─────────────────────────────────────────────────────────
  // 6. 节气判断
  // ─────────────────────────────────────────────────────────
  it('应正确识别节气', () => {
    const cal = new GameCalendarSystem();
    expect(cal.getSolarTerm(2, 4)).toBe('立春');
    expect(cal.getSolarTerm(6, 21)).toBe('夏至');
    expect(cal.getSolarTerm(12, 22)).toBe('冬至');
    expect(cal.getSolarTerm(1, 15)).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────
  // 7. 季节效果
  // ─────────────────────────────────────────────────────────
  it('秋季粮草应为1.5倍', () => {
    const cal = new GameCalendarSystem();
    const autumn = cal.getSeasonEffect('秋');
    expect(autumn.foodMultiplier).toBe(1.5);
    expect(autumn.goldMultiplier).toBe(1.2);

    const winter = cal.getSeasonEffect('冬');
    expect(winter.foodMultiplier).toBe(0.7);
    expect(winter.goldMultiplier).toBe(0.8);

    const spring = cal.getSeasonEffect('春');
    expect(spring.foodMultiplier).toBe(1.2);
    expect(spring.goldMultiplier).toBe(1.0);
  });

  // ─────────────────────────────────────────────────────────
  // 8. 日期格式化
  // ─────────────────────────────────────────────────────────
  it('应正确格式化日期', () => {
    const cal = new GameCalendarSystem();
    const date: GameDate = {
      year: 3, month: 5, day: 7, season: '夏',
      shichen: '午', hour: 12, minute: 0,
    };
    expect(cal.formatDate(date)).toBe('建安三年 五月初七 午时');
    expect(cal.formatDateShort(date)).toBe('三年/五月/初七');
  });

  it('应格式化建安元年正月初一', () => {
    const cal = new GameCalendarSystem();
    const formatted = cal.formatDate();
    expect(formatted).toBe('建安元年 正月初一 子时');
  });

  // ─────────────────────────────────────────────────────────
  // 9. 大事件预告
  // ─────────────────────────────────────────────────────────
  it('应添加和获取大事件', () => {
    const cal = new GameCalendarSystem();
    cal.addUpcomingEvent({
      id: 'test-1',
      name: '赤壁之战',
      description: '孙刘联军火烧赤壁',
      triggerDate: { year: 13, month: 7, day: 15, season: '秋', shichen: '午', hour: 12, minute: 0 },
      daysRemaining: 100,
      type: 'historical',
    });
    const events = cal.getUpcomingEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('赤壁之战');
  });

  it('应在日期到达时触发事件', () => {
    const cal = new GameCalendarSystem();
    const triggerDate: GameDate = {
      year: 1, month: 1, day: 1, season: '春', shichen: '子', hour: 0, minute: 0,
    };
    cal.addUpcomingEvent({
      id: 'evt-1', name: '测试事件', description: 'desc',
      triggerDate, daysRemaining: 0, type: 'quest',
    });
    const triggered = cal.checkEventTriggers(cal.getCurrentDate());
    expect(triggered).toHaveLength(1);
    expect(triggered[0].name).toBe('测试事件');
    expect(cal.getUpcomingEvents()).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────
  // 10. 时间加速/暂停
  // ─────────────────────────────────────────────────────────
  it('暂停后时间应停止推进', () => {
    const cal = new GameCalendarSystem();
    cal.pause();
    expect(cal.isPaused()).toBe(true);
    cal.update(600);
    expect(cal.getCurrentDate().hour).toBe(0);
  });

  it('恢复后时间应继续推进', () => {
    const cal = new GameCalendarSystem();
    cal.pause();
    cal.update(60);
    expect(cal.getCurrentDate().hour).toBe(0);
    cal.resume();
    expect(cal.isPaused()).toBe(false);
    cal.update(60);
    expect(cal.getCurrentDate().hour).toBe(1);
  });

  it('时间加速应倍增推进速度', () => {
    const cal = new GameCalendarSystem();
    cal.setTimeScale(10);
    expect(cal.getTimeScale()).toBe(10);
    // 60秒 * 10倍 = 600游戏分钟 = 10游戏小时
    cal.update(60);
    expect(cal.getCurrentDate().hour).toBe(10);
  });

  // ─────────────────────────────────────────────────────────
  // 11. 序列化/反序列化
  // ─────────────────────────────────────────────────────────
  it('应正确序列化和反序列化', () => {
    const cal = new GameCalendarSystem();
    cal.update(3600); // 推进60小时
    cal.setTimeScale(5);
    cal.pause();

    const data = cal.serialize();
    const cal2 = new GameCalendarSystem();
    cal2.deserialize(data as Record<string, unknown>);

    expect(cal2.getCurrentDate()).toEqual(cal.getCurrentDate());
    expect(cal2.getTimeScale()).toBe(5);
    expect(cal2.isPaused()).toBe(true);
  });
});
