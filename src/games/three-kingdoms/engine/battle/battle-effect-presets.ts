/**
 * 战斗系统 — 武技特效预设配置
 *
 * 职责：武技特效的粒子、光效、屏幕震动等预设数据
 * 规则：只有 const/type/interface，零运行时逻辑
 *
 * @module engine/battle/battle-effect-presets
 */

import { BuffType } from './battle.types';

// ─────────────────────────────────────────────
// 1. 特效类型定义
// ─────────────────────────────────────────────

/** 特效元素类型 */
export type EffectElement = 'fire' | 'ice' | 'thunder' | 'wind' | 'earth' | 'light' | 'dark' | 'neutral';

/** 特效触发时机 */
export type EffectTrigger = 'onSkillCast' | 'onHit' | 'onCritical' | 'onKill' | 'onHeal';

/** 粒子配置 */
export interface ParticleConfig {
  count: number;
  speedRange: [number, number];
  sizeRange: [number, number];
  lifetimeRange: [number, number];
  angleRange: [number, number];
  colors: string[];
  useGravity: boolean;
  gravity: number;
}

/** 光效配置 */
export interface GlowConfig {
  color: string;
  radius: number;
  intensity: number;
  duration: number;
  pulseFrequency: number;
}

/** 屏幕震动配置 */
export interface ScreenShakeConfig {
  enabled: boolean;
  intensity: number;
  duration: number;
  frequency: number;
}

/** 屏幕尺寸分类 */
export type ScreenClass = 'small' | 'medium' | 'large';

/** 手机端战斗布局配置 */
export interface MobileLayoutConfig {
  screenClass: ScreenClass;
  canvasWidth: number;
  canvasHeight: number;
  skillButtonSize: number;
  skillButtonGap: number;
  skillBarOffsetY: number;
  touchPadding: number;
  damageNumberScale: number;
  simplifiedEffects: boolean;
  maxActiveEffects: number;
  particleScale: number;
}

// ─────────────────────────────────────────────
// 2. 元素粒子预设
// ─────────────────────────────────────────────

export const ELEMENT_PARTICLE_PRESETS: Record<EffectElement, ParticleConfig> = {
  fire: {
    count: 30, speedRange: [50, 150], sizeRange: [3, 8],
    lifetimeRange: [300, 800], angleRange: [0, 360],
    colors: ['#FF4500', '#FF6347', '#FFD700', '#FF8C00'],
    useGravity: true, gravity: -50,
  },
  ice: {
    count: 25, speedRange: [30, 100], sizeRange: [2, 6],
    lifetimeRange: [400, 900], angleRange: [0, 360],
    colors: ['#00BFFF', '#87CEEB', '#E0FFFF', '#B0E0E6'],
    useGravity: true, gravity: 30,
  },
  thunder: {
    count: 40, speedRange: [100, 300], sizeRange: [2, 5],
    lifetimeRange: [100, 400], angleRange: [0, 360],
    colors: ['#FFD700', '#FFFF00', '#FFFFFF', '#FFFACD'],
    useGravity: false, gravity: 0,
  },
  wind: {
    count: 20, speedRange: [80, 200], sizeRange: [2, 4],
    lifetimeRange: [200, 600], angleRange: [0, 180],
    colors: ['#90EE90', '#98FB98', '#F0FFF0', '#FFFFFF'],
    useGravity: false, gravity: 0,
  },
  earth: {
    count: 35, speedRange: [60, 180], sizeRange: [4, 10],
    lifetimeRange: [300, 700], angleRange: [0, 360],
    colors: ['#8B4513', '#A0522D', '#D2691E', '#DEB887'],
    useGravity: true, gravity: 80,
  },
  light: {
    count: 15, speedRange: [20, 60], sizeRange: [3, 7],
    lifetimeRange: [500, 1000], angleRange: [0, 360],
    colors: ['#FFFFE0', '#FFFACD', '#FFFFFF', '#FFE4B5'],
    useGravity: false, gravity: 0,
  },
  dark: {
    count: 28, speedRange: [40, 120], sizeRange: [3, 8],
    lifetimeRange: [400, 800], angleRange: [0, 360],
    colors: ['#4B0082', '#800080', '#9932CC', '#483D8B'],
    useGravity: false, gravity: 0,
  },
  neutral: {
    count: 10, speedRange: [30, 80], sizeRange: [2, 5],
    lifetimeRange: [200, 500], angleRange: [0, 360],
    colors: ['#FFFFFF', '#C0C0C0', '#D3D3D3'],
    useGravity: false, gravity: 0,
  },
};

// ─────────────────────────────────────────────
// 3. 元素光效预设
// ─────────────────────────────────────────────

export const ELEMENT_GLOW_PRESETS: Record<EffectElement, GlowConfig> = {
  fire: { color: '#FF4500', radius: 60, intensity: 0.8, duration: 600, pulseFrequency: 3 },
  ice: { color: '#00BFFF', radius: 50, intensity: 0.6, duration: 500, pulseFrequency: 2 },
  thunder: { color: '#FFD700', radius: 80, intensity: 1.0, duration: 300, pulseFrequency: 5 },
  wind: { color: '#90EE90', radius: 40, intensity: 0.5, duration: 400, pulseFrequency: 1 },
  earth: { color: '#8B4513', radius: 70, intensity: 0.7, duration: 700, pulseFrequency: 2 },
  light: { color: '#FFFFE0', radius: 55, intensity: 0.9, duration: 800, pulseFrequency: 1 },
  dark: { color: '#4B0082', radius: 65, intensity: 0.8, duration: 650, pulseFrequency: 3 },
  neutral: { color: '#FFFFFF', radius: 30, intensity: 0.4, duration: 300, pulseFrequency: 0 },
};

// ─────────────────────────────────────────────
// 4. 手机端布局预设
// ─────────────────────────────────────────────

export const SCREEN_PRESETS: Record<ScreenClass, Omit<MobileLayoutConfig, 'screenClass'>> = {
  small: {
    canvasWidth: 375, canvasHeight: 667,
    skillButtonSize: 48, skillButtonGap: 8,
    skillBarOffsetY: 80, touchPadding: 12,
    damageNumberScale: 0.8, simplifiedEffects: true,
    maxActiveEffects: 5, particleScale: 0.6,
  },
  medium: {
    canvasWidth: 414, canvasHeight: 896,
    skillButtonSize: 56, skillButtonGap: 10,
    skillBarOffsetY: 90, touchPadding: 10,
    damageNumberScale: 0.9, simplifiedEffects: false,
    maxActiveEffects: 8, particleScale: 0.8,
  },
  large: {
    canvasWidth: 768, canvasHeight: 1024,
    skillButtonSize: 64, skillButtonGap: 12,
    skillBarOffsetY: 100, touchPadding: 8,
    damageNumberScale: 1.0, simplifiedEffects: false,
    maxActiveEffects: 12, particleScale: 1.0,
  },
};

// ─────────────────────────────────────────────
// 5. Buff → 元素映射
// ─────────────────────────────────────────────

export const BUFF_ELEMENT_MAP: Readonly<Partial<Record<BuffType, EffectElement>>> = {
  [BuffType.BURN]: 'fire',
  [BuffType.FREEZE]: 'ice',
  [BuffType.POISON]: 'dark',
  [BuffType.STUN]: 'thunder',
  [BuffType.BLEED]: 'dark',
  [BuffType.ATK_UP]: 'light',
  [BuffType.DEF_UP]: 'earth',
  [BuffType.SHIELD]: 'light',
};
