/**
 * VisualSpecDefaults 测试
 *
 * 覆盖：
 *   - 颜色工具函数（hexToRgb / colorDifference）
 *   - 动画规范默认值完整性
 *   - 配色规范默认值完整性
 *   - ALL_ANIMATION_SPECS 聚合正确性
 *   - 边界条件
 */

import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  colorDifference,
  TRANSITION_SPECS,
  STATE_CHANGE_SPECS,
  FEEDBACK_SPECS,
  ENTRANCE_SPECS,
  EXIT_SPECS,
  ALL_ANIMATION_SPECS,
  DEFAULT_QUALITY_COLORS,
  DEFAULT_FACTION_COLORS,
  DEFAULT_FUNCTIONAL_COLORS,
  DEFAULT_STATUS_COLORS,
} from '../VisualSpecDefaults';

describe('VisualSpecDefaults', () => {
  // ─── hexToRgb ─────────────────────────────

  describe('hexToRgb', () => {
    it('应正确解析标准6位十六进制颜色', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('应正确解析小写十六进制', () => {
      expect(hexToRgb('#4caf50')).toEqual({ r: 76, g: 175, b: 80 });
    });

    it('应正确解析无 # 前缀的十六进制', () => {
      expect(hexToRgb('FF9800')).toEqual({ r: 255, g: 152, b: 0 });
    });

    it('应对无效输入返回 null', () => {
      expect(hexToRgb('')).toBeNull();
      expect(hexToRgb('#FFF')).toBeNull();
      expect(hexToRgb('#GGGGGG')).toBeNull();
      expect(hexToRgb('#12345')).toBeNull();
    });

    it('应正确解析黑色和白色', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  // ─── colorDifference ──────────────────────

  describe('colorDifference', () => {
    it('相同颜色差值应为 0', () => {
      expect(colorDifference('#FF0000', '#FF0000')).toBe(0);
    });

    it('黑色与白色差值应接近 100', () => {
      const diff = colorDifference('#000000', '#FFFFFF');
      expect(diff).toBeGreaterThan(90);
      expect(diff).toBeLessThanOrEqual(100);
    });

    it('无效颜色应返回 100', () => {
      expect(colorDifference('invalid', '#FF0000')).toBe(100);
      expect(colorDifference('#FF0000', 'invalid')).toBe(100);
    });

    it('相近颜色差值应小于差异大的颜色', () => {
      const closeDiff = colorDifference('#FF0000', '#FF0101');
      const farDiff = colorDifference('#FF0000', '#0000FF');
      expect(closeDiff).toBeLessThan(farDiff);
    });
  });

  // ─── 动画规范默认值 ──────────────────────

  describe('动画规范默认值', () => {
    it('TRANSITION_SPECS 应包含5个过渡动画', () => {
      expect(TRANSITION_SPECS).toHaveLength(5);
      for (const spec of TRANSITION_SPECS) {
        expect(spec.category).toBe('transition');
        expect(spec.id).toMatch(/^ANI-T-/);
      }
    });

    it('STATE_CHANGE_SPECS 应包含4个状态变化动画', () => {
      expect(STATE_CHANGE_SPECS).toHaveLength(4);
      for (const spec of STATE_CHANGE_SPECS) {
        expect(spec.category).toBe('state_change');
      }
    });

    it('FEEDBACK_SPECS 应包含3个反馈动画', () => {
      expect(FEEDBACK_SPECS).toHaveLength(3);
      for (const spec of FEEDBACK_SPECS) {
        expect(spec.category).toBe('feedback');
      }
    });

    it('ENTRANCE_SPECS 和 EXIT_SPECS 各至少1个', () => {
      expect(ENTRANCE_SPECS.length).toBeGreaterThanOrEqual(1);
      expect(EXIT_SPECS.length).toBeGreaterThanOrEqual(1);
      expect(ENTRANCE_SPECS[0].category).toBe('entrance');
      expect(EXIT_SPECS[0].category).toBe('exit');
    });

    it('ALL_ANIMATION_SPECS 应聚合所有分类', () => {
      const expected = TRANSITION_SPECS.length + STATE_CHANGE_SPECS.length + FEEDBACK_SPECS.length + ENTRANCE_SPECS.length + EXIT_SPECS.length;
      expect(ALL_ANIMATION_SPECS).toHaveLength(expected);
    });
  });

  // ─── 配色规范默认值 ──────────────────────

  describe('配色规范默认值', () => {
    it('DEFAULT_QUALITY_COLORS 应包含5个品质', () => {
      expect(DEFAULT_QUALITY_COLORS).toHaveLength(5);
      const qualities = DEFAULT_QUALITY_COLORS.map(c => c.quality);
      expect(qualities).toContain('COMMON');
      expect(qualities).toContain('LEGENDARY');
    });

    it('DEFAULT_FACTION_COLORS 应包含魏蜀吴+中立', () => {
      expect(DEFAULT_FACTION_COLORS).toHaveLength(4);
      const factions = DEFAULT_FACTION_COLORS.map(c => c.faction);
      expect(factions).toEqual(expect.arrayContaining(['wei', 'shu', 'wu', 'neutral']));
    });

    it('DEFAULT_FUNCTIONAL_COLORS 应包含核心功能色', () => {
      expect(DEFAULT_FUNCTIONAL_COLORS.length).toBeGreaterThanOrEqual(5);
      const names = DEFAULT_FUNCTIONAL_COLORS.map(c => c.name);
      expect(names).toContain('confirm');
      expect(names).toContain('cancel');
      expect(names).toContain('warning');
    });

    it('DEFAULT_STATUS_COLORS 应包含核心状态色', () => {
      expect(DEFAULT_STATUS_COLORS.length).toBeGreaterThanOrEqual(5);
      const statuses = DEFAULT_STATUS_COLORS.map(c => c.status);
      expect(statuses).toContain('online');
      expect(statuses).toContain('error');
      expect(statuses).toContain('locked');
    });
  });
});
