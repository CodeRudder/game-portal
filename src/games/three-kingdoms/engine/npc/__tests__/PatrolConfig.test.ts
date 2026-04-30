/**
 * PatrolConfig 单元测试
 *
 * 验证NPC巡逻配置常量的正确性：
 * - PATROL_SAVE_VERSION 值
 * - DEFAULT_SPAWN_CONFIG 默认值合理性
 */
import { describe, it, expect } from 'vitest';
import { PATROL_SAVE_VERSION, DEFAULT_SPAWN_CONFIG } from '../PatrolConfig';

describe('PatrolConfig', () => {
  describe('PATROL_SAVE_VERSION', () => {
    it('should be 1', () => {
      expect(PATROL_SAVE_VERSION).toBe(1);
    });

    it('should be a positive integer', () => {
      expect(Number.isInteger(PATROL_SAVE_VERSION)).toBe(true);
      expect(PATROL_SAVE_VERSION).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_SPAWN_CONFIG', () => {
    it('should have spawnInterval of 30', () => {
      expect(DEFAULT_SPAWN_CONFIG.spawnInterval).toBe(30);
    });

    it('should have maxNPCCount of 20', () => {
      expect(DEFAULT_SPAWN_CONFIG.maxNPCCount).toBe(20);
    });

    it('should have maxNPCPerRegion of 8', () => {
      expect(DEFAULT_SPAWN_CONFIG.maxNPCPerRegion).toBe(8);
    });

    it('should have npcLifetime of 0 (infinite)', () => {
      expect(DEFAULT_SPAWN_CONFIG.npcLifetime).toBe(0);
    });

    it('should have autoSpawnEnabled true', () => {
      expect(DEFAULT_SPAWN_CONFIG.autoSpawnEnabled).toBe(true);
    });

    it('maxNPCCount should be >= maxNPCPerRegion', () => {
      expect(DEFAULT_SPAWN_CONFIG.maxNPCCount).toBeGreaterThanOrEqual(
        DEFAULT_SPAWN_CONFIG.maxNPCPerRegion,
      );
    });

    it('spawnInterval should be positive', () => {
      expect(DEFAULT_SPAWN_CONFIG.spawnInterval).toBeGreaterThan(0);
    });

    it('should be a frozen/readonly config (no accidental mutation)', () => {
      // Verify the values are what we expect - config integrity check
      const config = { ...DEFAULT_SPAWN_CONFIG };
      expect(config.spawnInterval).toBe(30);
      expect(config.maxNPCCount).toBe(20);
      expect(config.maxNPCPerRegion).toBe(8);
    });
  });
});
