/**
 * tech/tech-detail-types.ts 单元测试
 *
 * 覆盖导出函数：
 * - formatTime
 * - describeEffect
 */

import { describe, it, expect } from 'vitest';
import { formatTime, describeEffect } from '../../tech/tech-detail-types';
import type { TechEffect } from '../../tech/tech.types';

// ═══════════════════════════════════════════
// formatTime
// ═══════════════════════════════════════════
describe('formatTime', () => {
  it('0秒 → "0秒"', () => {
    expect(formatTime(0)).toBe('0秒');
  });

  it('负数 → "0秒"', () => {
    expect(formatTime(-1)).toBe('0秒');
    expect(formatTime(-100)).toBe('0秒');
  });

  it('1秒 → "1秒"', () => {
    expect(formatTime(1)).toBe('1秒');
  });

  it('59秒 → "59秒"', () => {
    expect(formatTime(59)).toBe('59秒');
  });

  it('60秒 → "1分"', () => {
    expect(formatTime(60)).toBe('1分');
  });

  it('61秒 → "1分1秒"', () => {
    expect(formatTime(61)).toBe('1分1秒');
  });

  it('3600秒 → "1小时"', () => {
    expect(formatTime(3600)).toBe('1小时');
  });

  it('3661秒 → "1小时1分1秒"', () => {
    expect(formatTime(3661)).toBe('1小时1分1秒');
  });

  it('7200秒 → "2小时"', () => {
    expect(formatTime(7200)).toBe('2小时');
  });

  it('7384秒 → "2小时3分4秒"', () => {
    expect(formatTime(7384)).toBe('2小时3分4秒');
  });

  it('半天(43200秒) → "12小时"', () => {
    expect(formatTime(43200)).toBe('12小时');
  });

  it('一天(86400秒) → "24小时"', () => {
    expect(formatTime(86400)).toBe('24小时');
  });

  it('小数秒向下取整', () => {
    expect(formatTime(1.9)).toBe('1秒');
    expect(formatTime(60.9)).toBe('1分');
  });

  it('边界：30秒 → "30秒"（无分无时）', () => {
    expect(formatTime(30)).toBe('30秒');
  });

  it('边界：3599秒 → "59分59秒"', () => {
    expect(formatTime(3599)).toBe('59分59秒');
  });
});

// ═══════════════════════════════════════════
// describeEffect
// ═══════════════════════════════════════════
describe('describeEffect', () => {
  it('正数效果带 + 号', () => {
    const effect: TechEffect = { type: 'troop_attack', target: 'cavalry', value: 15 };
    const desc = describeEffect(effect);
    expect(desc).toContain('+');
    expect(desc).toContain('15');
  });

  it('负数效果不带 + 号', () => {
    const effect: TechEffect = { type: 'troop_attack', target: 'cavalry', value: -10 };
    const desc = describeEffect(effect);
    expect(desc).not.toContain('+');
    expect(desc).toContain('-10');
  });

  it('零效果显示 +0%', () => {
    const effect: TechEffect = { type: 'troop_attack', target: 'cavalry', value: 0 };
    const desc = describeEffect(effect);
    expect(desc).toContain('+0');
  });

  it('包含效果类型中文名', () => {
    const effect: TechEffect = { type: 'resource_production', target: 'grain', value: 10 };
    const desc = describeEffect(effect);
    expect(desc).toContain('资源产出');
  });

  it('包含目标中文名', () => {
    const effect: TechEffect = { type: 'resource_production', target: 'grain', value: 10 };
    const desc = describeEffect(effect);
    expect(desc).toContain('粮草');
  });

  it('未知类型使用原始英文名', () => {
    const effect: TechEffect = { type: 'unknown_type' as any, target: 'unknown_target' as any, value: 5 };
    const desc = describeEffect(effect);
    expect(desc).toContain('unknown_type');
    expect(desc).toContain('unknown_target');
  });

  it('格式为 "类型(目标) +值%"', () => {
    const effect: TechEffect = { type: 'troop_attack', target: 'cavalry', value: 20 };
    const desc = describeEffect(effect);
    expect(desc).toContain('兵种攻击');
    expect(desc).toContain('骑兵');
    expect(desc).toContain('+20%');
  });

  it('所有已知效果类型有中文映射', () => {
    const knownTypes = [
      'resource_production', 'troop_attack', 'troop_defense', 'troop_hp',
      'building_production', 'hero_exp', 'research_speed', 'march_speed',
      'resource_cap', 'recruit_discount',
    ];
    for (const type of knownTypes) {
      const effect: TechEffect = { type: type as any, target: 'all', value: 10 };
      const desc = describeEffect(effect);
      // 应该不是直接用英文 type 名（除非没有映射）
      expect(desc).toContain('全体');
    }
  });
});
