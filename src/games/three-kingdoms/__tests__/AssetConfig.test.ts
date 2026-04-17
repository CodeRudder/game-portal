/**
 * AssetConfig 测试
 *
 * 验证所有地形/建筑/资源类型都有对应的美术资源映射，
 * 以及工具函数 getAssetUrl / getSpriteName 的正确性。
 *
 * @module games/three-kingdoms/__tests__/AssetConfig.test
 */

import { describe, it, expect } from 'vitest';
import {
  TERRAIN_ASSETS,
  BUILDING_ASSETS,
  RESOURCE_ASSETS,
  NPC_COLORS,
  TERRAIN_SPRITE_NAMES,
  BUILDING_SPRITE_NAMES,
  getAssetUrl,
  getSpriteName,
} from '../AssetConfig';
import type { TerrainType } from '../MapGenerator';

// ─── 所有地形类型 ─────────────────────────────────────────

const ALL_TERRAINS: TerrainType[] = [
  'plain', 'mountain', 'forest', 'water',
  'road', 'city', 'village', 'fortress',
  'desert', 'snow',
];

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('AssetConfig', () => {
  // ─── 地形资源映射 ────────────────────────────────────────

  describe('TERRAIN_ASSETS', () => {
    it('should have mapping for every TerrainType', () => {
      for (const terrain of ALL_TERRAINS) {
        expect(TERRAIN_ASSETS[terrain], `Missing terrain asset for "${terrain}"`).toBeDefined();
      }
    });

    it('all paths should point to Kenney PNG files', () => {
      for (const terrain of ALL_TERRAINS) {
        const path = TERRAIN_ASSETS[terrain];
        expect(path, `Terrain "${terrain}" path`).toMatch(
          /\/assets\/kenney-tower-defense\/PNG\/Default size\/towerDefense_tile\d{3}\.png$/,
        );
      }
    });
  });

  // ─── 建筑资源映射 ────────────────────────────────────────

  describe('BUILDING_ASSETS', () => {
    const EXPECTED_BUILDINGS = [
      'city', 'village', 'fortress', 'yamen',
      'barracks', 'market', 'shop', 'residence',
    ];

    it('should have mapping for every building type', () => {
      for (const building of EXPECTED_BUILDINGS) {
        expect(BUILDING_ASSETS[building], `Missing building asset for "${building}"`).toBeDefined();
      }
    });

    it('all paths should be valid PNG paths', () => {
      for (const [key, path] of Object.entries(BUILDING_ASSETS)) {
        expect(path, `Building "${key}" path`).toMatch(/\.png$/);
      }
    });
  });

  // ─── 资源点映射 ──────────────────────────────────────────

  describe('RESOURCE_ASSETS', () => {
    const EXPECTED_RESOURCES = ['farm', 'mine', 'lumber', 'fishery', 'herb'];

    it('should have mapping for every resource type', () => {
      for (const resource of EXPECTED_RESOURCES) {
        expect(RESOURCE_ASSETS[resource], `Missing resource asset for "${resource}"`).toBeDefined();
      }
    });
  });

  // ─── NPC 颜色配置 ────────────────────────────────────────

  describe('NPC_COLORS', () => {
    const EXPECTED_NPCS = ['farmer', 'soldier', 'merchant', 'scholar', 'scout'];

    it('should have color for every NPC type', () => {
      for (const npc of EXPECTED_NPCS) {
        expect(NPC_COLORS[npc], `Missing NPC color for "${npc}"`).toBeDefined();
      }
    });

    it('colors should be valid hex strings', () => {
      for (const [key, color] of Object.entries(NPC_COLORS)) {
        expect(color, `NPC "${key}" color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  // ─── 精灵图帧名映射 ──────────────────────────────────────

  describe('TERRAIN_SPRITE_NAMES', () => {
    it('should have sprite name for every TerrainType', () => {
      for (const terrain of ALL_TERRAINS) {
        expect(TERRAIN_SPRITE_NAMES[terrain], `Missing sprite name for "${terrain}"`).toBeDefined();
      }
    });
  });

  describe('BUILDING_SPRITE_NAMES', () => {
    it('should have sprite name for key building types', () => {
      const keys = ['city', 'village', 'fortress'];
      for (const key of keys) {
        expect(BUILDING_SPRITE_NAMES[key], `Missing sprite name for "${key}"`).toBeDefined();
      }
    });
  });

  // ─── getAssetUrl ─────────────────────────────────────────

  describe('getAssetUrl', () => {
    it('should return valid path for known terrain', () => {
      expect(getAssetUrl('terrain', 'plain')).toContain('towerDefense_tile');
    });

    it('should return valid path for known building', () => {
      expect(getAssetUrl('building', 'city')).toContain('towerDefense_tile');
    });

    it('should return valid path for known resource', () => {
      expect(getAssetUrl('resource', 'farm')).toContain('towerDefense_tile');
    });

    it('should return null for unknown key', () => {
      expect(getAssetUrl('terrain', 'nonexistent')).toBeNull();
      expect(getAssetUrl('building', 'unknown')).toBeNull();
      expect(getAssetUrl('resource', 'missing')).toBeNull();
    });
  });

  // ─── getSpriteName ───────────────────────────────────────

  describe('getSpriteName', () => {
    it('should return sprite name for known terrain', () => {
      expect(getSpriteName('terrain', 'plain')).toBe('terrain_grass');
      expect(getSpriteName('terrain', 'water')).toBe('terrain_water');
    });

    it('should return sprite name for known building', () => {
      expect(getSpriteName('building', 'city')).toBe('tower_cannon');
    });

    it('should return null for unknown key', () => {
      expect(getSpriteName('terrain', 'nonexistent')).toBeNull();
      expect(getSpriteName('building', 'unknown')).toBeNull();
    });
  });
});
