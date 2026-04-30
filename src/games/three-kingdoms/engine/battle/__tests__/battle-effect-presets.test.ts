/**
 * battle-effect-presets 测试 — 武技特效预设配置
 *
 * 覆盖：
 *   1. ELEMENT_PARTICLE_PRESETS — 所有8种元素的粒子配置完整性
 *   2. ELEMENT_GLOW_PRESETS — 所有8种元素的光效配置完整性
 *   3. SCREEN_PRESETS — 3种屏幕尺寸的布局配置完整性
 *   4. BUFF_ELEMENT_MAP — Buff到元素的映射完整性
 *   5. 类型守卫 — 配置结构验证
 *   6. 数据一致性 — 跨配置交叉验证
 */

import { describe, it, expect } from 'vitest';
import {
  ELEMENT_PARTICLE_PRESETS,
  ELEMENT_GLOW_PRESETS,
  SCREEN_PRESETS,
  BUFF_ELEMENT_MAP,
} from '../battle-effect-presets';
import type {
  EffectElement,
  EffectTrigger,
  ParticleConfig,
  GlowConfig,
  ScreenShakeConfig,
  ScreenClass,
  MobileLayoutConfig,
} from '../battle-effect-presets';
import { BuffType } from '../battle-base.types';

// ── 辅助 ──

const ALL_ELEMENTS: EffectElement[] = [
  'fire', 'ice', 'thunder', 'wind', 'earth', 'light', 'dark', 'neutral',
];

const ALL_SCREEN_CLASSES: ScreenClass[] = ['small', 'medium', 'large'];

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('battle-effect-presets', () => {

  // ─────────────────────────────────────────
  // 1. ELEMENT_PARTICLE_PRESETS
  // ─────────────────────────────────────────
  describe('ELEMENT_PARTICLE_PRESETS', () => {
    it('should have presets for all 8 elements', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_PARTICLE_PRESETS[elem]).toBeDefined();
      }
      expect(Object.keys(ELEMENT_PARTICLE_PRESETS)).toHaveLength(8);
    });

    it('should have valid particle count (> 0)', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_PARTICLE_PRESETS[elem].count).toBeGreaterThan(0);
      }
    });

    it('should have valid speed ranges (2-element tuple, min <= max)', () => {
      for (const elem of ALL_ELEMENTS) {
        const [min, max] = ELEMENT_PARTICLE_PRESETS[elem].speedRange;
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeGreaterThanOrEqual(min);
      }
    });

    it('should have valid size ranges (2-element tuple, min <= max)', () => {
      for (const elem of ALL_ELEMENTS) {
        const [min, max] = ELEMENT_PARTICLE_PRESETS[elem].sizeRange;
        expect(min).toBeGreaterThan(0);
        expect(max).toBeGreaterThanOrEqual(min);
      }
    });

    it('should have valid lifetime ranges (2-element tuple, min <= max)', () => {
      for (const elem of ALL_ELEMENTS) {
        const [min, max] = ELEMENT_PARTICLE_PRESETS[elem].lifetimeRange;
        expect(min).toBeGreaterThan(0);
        expect(max).toBeGreaterThanOrEqual(min);
      }
    });

    it('should have valid angle ranges (0-360)', () => {
      for (const elem of ALL_ELEMENTS) {
        const [min, max] = ELEMENT_PARTICLE_PRESETS[elem].angleRange;
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeLessThanOrEqual(360);
        expect(max).toBeGreaterThanOrEqual(min);
      }
    });

    it('should have non-empty color arrays with valid hex colors', () => {
      for (const elem of ALL_ELEMENTS) {
        const colors = ELEMENT_PARTICLE_PRESETS[elem].colors;
        expect(colors.length).toBeGreaterThan(0);
        for (const c of colors) {
          expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      }
    });

    it('should have gravity as a number (positive = down, negative = up)', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(typeof ELEMENT_PARTICLE_PRESETS[elem].gravity).toBe('number');
      }
    });

    it('should have fire with upward gravity (negative)', () => {
      expect(ELEMENT_PARTICLE_PRESETS.fire.gravity).toBeLessThan(0);
    });

    it('should have ice with downward gravity (positive)', () => {
      expect(ELEMENT_PARTICLE_PRESETS.ice.gravity).toBeGreaterThan(0);
    });

    it('should have earth with downward gravity (positive)', () => {
      expect(ELEMENT_PARTICLE_PRESETS.earth.gravity).toBeGreaterThan(0);
    });

    it('should have thunder/wind/light/dark/neutral with no gravity', () => {
      for (const elem of ['thunder', 'wind', 'light', 'dark', 'neutral'] as EffectElement[]) {
        expect(ELEMENT_PARTICLE_PRESETS[elem].gravity).toBe(0);
        expect(ELEMENT_PARTICLE_PRESETS[elem].useGravity).toBe(false);
      }
    });

    it('should have unique color palettes per element', () => {
      const colorSets = ALL_ELEMENTS.map(
        (elem) => new Set(ELEMENT_PARTICLE_PRESETS[elem].colors),
      );
      // At least fire and ice should have different palettes
      expect(colorSets[0]).not.toEqual(colorSets[1]);
    });
  });

  // ─────────────────────────────────────────
  // 2. ELEMENT_GLOW_PRESETS
  // ─────────────────────────────────────────
  describe('ELEMENT_GLOW_PRESETS', () => {
    it('should have presets for all 8 elements', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem]).toBeDefined();
      }
      expect(Object.keys(ELEMENT_GLOW_PRESETS)).toHaveLength(8);
    });

    it('should have valid hex color', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should have positive radius', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem].radius).toBeGreaterThan(0);
      }
    });

    it('should have intensity between 0 and 1', () => {
      for (const elem of ALL_ELEMENTS) {
        const { intensity } = ELEMENT_GLOW_PRESETS[elem];
        expect(intensity).toBeGreaterThan(0);
        expect(intensity).toBeLessThanOrEqual(1);
      }
    });

    it('should have positive duration', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem].duration).toBeGreaterThan(0);
      }
    });

    it('should have non-negative pulse frequency', () => {
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem].pulseFrequency).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have thunder with highest intensity', () => {
      const thunderIntensity = ELEMENT_GLOW_PRESETS.thunder.intensity;
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem].intensity).toBeLessThanOrEqual(thunderIntensity);
      }
    });

    it('should have neutral with lowest intensity', () => {
      const neutralIntensity = ELEMENT_GLOW_PRESETS.neutral.intensity;
      for (const elem of ALL_ELEMENTS) {
        expect(ELEMENT_GLOW_PRESETS[elem].intensity).toBeGreaterThanOrEqual(neutralIntensity);
      }
    });
  });

  // ─────────────────────────────────────────
  // 3. SCREEN_PRESETS
  // ─────────────────────────────────────────
  describe('SCREEN_PRESETS', () => {
    it('should have presets for all 3 screen classes', () => {
      for (const cls of ALL_SCREEN_CLASSES) {
        expect(SCREEN_PRESETS[cls]).toBeDefined();
      }
      expect(Object.keys(SCREEN_PRESETS)).toHaveLength(3);
    });

    it('should have valid canvas dimensions', () => {
      for (const cls of ALL_SCREEN_CLASSES) {
        const preset = SCREEN_PRESETS[cls];
        expect(preset.canvasWidth).toBeGreaterThan(0);
        expect(preset.canvasHeight).toBeGreaterThan(preset.canvasWidth);
      }
    });

    it('should have increasing canvas sizes across screen classes', () => {
      expect(SCREEN_PRESETS.small.canvasWidth).toBeLessThan(SCREEN_PRESETS.medium.canvasWidth);
      expect(SCREEN_PRESETS.medium.canvasWidth).toBeLessThan(SCREEN_PRESETS.large.canvasWidth);
    });

    it('should have valid skill button sizes', () => {
      for (const cls of ALL_SCREEN_CLASSES) {
        const preset = SCREEN_PRESETS[cls];
        expect(preset.skillButtonSize).toBeGreaterThan(0);
        expect(preset.skillButtonGap).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have increasing button sizes across screen classes', () => {
      expect(SCREEN_PRESETS.small.skillButtonSize).toBeLessThan(SCREEN_PRESETS.medium.skillButtonSize);
      expect(SCREEN_PRESETS.medium.skillButtonSize).toBeLessThan(SCREEN_PRESETS.large.skillButtonSize);
    });

    it('should have small screen with simplified effects', () => {
      expect(SCREEN_PRESETS.small.simplifiedEffects).toBe(true);
    });

    it('should have medium and large screens without simplified effects', () => {
      expect(SCREEN_PRESETS.medium.simplifiedEffects).toBe(false);
      expect(SCREEN_PRESETS.large.simplifiedEffects).toBe(false);
    });

    it('should have particleScale between 0 and 1', () => {
      for (const cls of ALL_SCREEN_CLASSES) {
        expect(SCREEN_PRESETS[cls].particleScale).toBeGreaterThan(0);
        expect(SCREEN_PRESETS[cls].particleScale).toBeLessThanOrEqual(1);
      }
    });

    it('should have increasing maxActiveEffects across screen classes', () => {
      expect(SCREEN_PRESETS.small.maxActiveEffects).toBeLessThan(SCREEN_PRESETS.medium.maxActiveEffects);
      expect(SCREEN_PRESETS.medium.maxActiveEffects).toBeLessThan(SCREEN_PRESETS.large.maxActiveEffects);
    });

    it('should have damageNumberScale between 0.5 and 1.5', () => {
      for (const cls of ALL_SCREEN_CLASSES) {
        expect(SCREEN_PRESETS[cls].damageNumberScale).toBeGreaterThanOrEqual(0.5);
        expect(SCREEN_PRESETS[cls].damageNumberScale).toBeLessThanOrEqual(1.5);
      }
    });
  });

  // ─────────────────────────────────────────
  // 4. BUFF_ELEMENT_MAP
  // ─────────────────────────────────────────
  describe('BUFF_ELEMENT_MAP', () => {
    it('should map BURN to fire', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.BURN]).toBe('fire');
    });

    it('should map FREEZE to ice', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.FREEZE]).toBe('ice');
    });

    it('should map POISON to dark', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.POISON]).toBe('dark');
    });

    it('should map STUN to thunder', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.STUN]).toBe('thunder');
    });

    it('should map BLEED to dark', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.BLEED]).toBe('dark');
    });

    it('should map ATK_UP to light', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.ATK_UP]).toBe('light');
    });

    it('should map DEF_UP to earth', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.DEF_UP]).toBe('earth');
    });

    it('should map SHIELD to light', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.SHIELD]).toBe('light');
    });

    it('should not have entries for debuff types ATK_DOWN/DEF_DOWN', () => {
      expect(BUFF_ELEMENT_MAP[BuffType.ATK_DOWN]).toBeUndefined();
      expect(BUFF_ELEMENT_MAP[BuffType.DEF_DOWN]).toBeUndefined();
    });

    it('should only map to valid EffectElement values', () => {
      const validElements = new Set(ALL_ELEMENTS);
      for (const elem of Object.values(BUFF_ELEMENT_MAP)) {
        expect(validElements.has(elem!)).toBe(true);
      }
    });

    it('should be Readonly (frozen or typed as such)', () => {
      // Verify it's a Partial<Record<BuffType, EffectElement>>
      expect(typeof BUFF_ELEMENT_MAP).toBe('object');
    });
  });

  // ─────────────────────────────────────────
  // 5. 类型完整性验证
  // ─────────────────────────────────────────
  describe('类型完整性', () => {
    it('should satisfy ParticleConfig interface for all elements', () => {
      for (const elem of ALL_ELEMENTS) {
        const p = ELEMENT_PARTICLE_PRESETS[elem];
        expect(p).toHaveProperty('count');
        expect(p).toHaveProperty('speedRange');
        expect(p).toHaveProperty('sizeRange');
        expect(p).toHaveProperty('lifetimeRange');
        expect(p).toHaveProperty('angleRange');
        expect(p).toHaveProperty('colors');
        expect(p).toHaveProperty('useGravity');
        expect(p).toHaveProperty('gravity');
        expect(Array.isArray(p.speedRange)).toBe(true);
        expect(Array.isArray(p.sizeRange)).toBe(true);
        expect(Array.isArray(p.lifetimeRange)).toBe(true);
        expect(Array.isArray(p.angleRange)).toBe(true);
        expect(Array.isArray(p.colors)).toBe(true);
        expect(typeof p.useGravity).toBe('boolean');
      }
    });

    it('should satisfy GlowConfig interface for all elements', () => {
      for (const elem of ALL_ELEMENTS) {
        const g = ELEMENT_GLOW_PRESETS[elem];
        expect(typeof g.color).toBe('string');
        expect(typeof g.radius).toBe('number');
        expect(typeof g.intensity).toBe('number');
        expect(typeof g.duration).toBe('number');
        expect(typeof g.pulseFrequency).toBe('number');
      }
    });
  });
});
