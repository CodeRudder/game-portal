/**
 * HeroRecruitUpManager 测试 — UP 武将管理子系统
 *
 * 覆盖：
 *   1. UP 武将状态管理 — set/get/clear
 *   2. UP 触发概率 — set/get
 *   3. 序列化/反序列化 — 正常/版本不匹配/空数据
 *   4. ISubsystem 接口 — init/update/getState/reset
 *   5. 边界：null generalId、空字符串、极端概率值
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HeroRecruitUpManager } from '../HeroRecruitUpManager';
import type { RecruitSaveData } from '../recruit-types';
import { RECRUIT_SAVE_VERSION } from '../hero-recruit-config';
import { DEFAULT_UP_CONFIG } from '../hero-recruit-config';

// ── 辅助 ──

function makeMockCoreDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

function makeSaveData(overrides?: Partial<RecruitSaveData>): RecruitSaveData {
  return {
    version: RECRUIT_SAVE_VERSION,
    pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
    history: [],
    upHero: {
      upGeneralId: 'guanyu',
      upRate: 0.5,
      description: 'UP关羽',
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('HeroRecruitUpManager', () => {
  let manager: HeroRecruitUpManager;

  beforeEach(() => {
    manager = new HeroRecruitUpManager();
    manager.init(makeMockCoreDeps());
  });

  // ─────────────────────────────────────────
  // 1. ISubsystem 接口
  // ─────────────────────────────────────────
  describe('ISubsystem 接口', () => {
    it('should have correct subsystem name', () => {
      expect(manager.name).toBe('heroRecruitUp');
    });

    it('should init with deps', () => {
      expect(() => manager.init(makeMockCoreDeps())).not.toThrow();
    });

    it('update should be a no-op', () => {
      expect(() => manager.update(0.016)).not.toThrow();
    });

    it('getState should return serialized up hero', () => {
      const state = manager.getState();
      expect(state).toHaveProperty('upGeneralId');
      expect(state).toHaveProperty('upRate');
    });

    it('reset should clear up hero state', () => {
      manager.setUpHero('guanyu', 0.8);
      expect(manager.getUpGeneralId()).toBe('guanyu');
      manager.reset();
      expect(manager.getUpGeneralId()).toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // 2. UP 武将状态管理
  // ─────────────────────────────────────────
  describe('UP 武将状态管理', () => {
    it('should set up hero with generalId', () => {
      manager.setUpHero('zhaoyun');
      expect(manager.getUpGeneralId()).toBe('zhaoyun');
    });

    it('should set up hero with generalId and rate', () => {
      manager.setUpHero('guanyu', 0.75);
      expect(manager.getUpGeneralId()).toBe('guanyu');
      expect(manager.getUpRate()).toBe(0.75);
    });

    it('should set up hero without changing rate when rate not provided', () => {
      const originalRate = manager.getUpRate();
      manager.setUpHero('guanyu');
      expect(manager.getUpRate()).toBe(originalRate);
    });

    it('should clear up hero to default state', () => {
      manager.setUpHero('guanyu', 0.8);
      manager.clearUpHero();
      expect(manager.getUpGeneralId()).toBeNull();
    });

    it('should set up hero to null', () => {
      manager.setUpHero('guanyu');
      manager.setUpHero(null);
      expect(manager.getUpGeneralId()).toBeNull();
    });

    it('should return readonly copy from getUpHeroState', () => {
      manager.setUpHero('guanyu', 0.5);
      const state1 = manager.getUpHeroState();
      const state2 = manager.getUpHeroState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // different references
    });
  });

  // ─────────────────────────────────────────
  // 3. UP 触发概率
  // ─────────────────────────────────────────
  describe('UP 触发概率', () => {
    it('should get default up rate', () => {
      const rate = manager.getUpRate();
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });

    it('should set custom up rate', () => {
      manager.setUpRate(0.3);
      expect(manager.getUpRate()).toBe(0.3);
    });

    it('should set up rate to 0', () => {
      manager.setUpRate(0);
      expect(manager.getUpRate()).toBe(0);
    });

    it('should set up rate to 1', () => {
      manager.setUpRate(1);
      expect(manager.getUpRate()).toBe(1);
    });

    it('should update rate via setUpHero', () => {
      manager.setUpHero('guanyu', 0.65);
      expect(manager.getUpRate()).toBe(0.65);
    });
  });

  // ─────────────────────────────────────────
  // 4. 序列化/反序列化
  // ─────────────────────────────────────────
  describe('序列化/反序列化', () => {
    it('should serialize up hero state', () => {
      manager.setUpHero('guanyu', 0.5);
      const serialized = manager.serializeUpHero();
      expect(serialized.upGeneralId).toBe('guanyu');
      expect(serialized.upRate).toBe(0.5);
    });

    it('should deserialize up hero state', () => {
      const data = makeSaveData();
      manager.deserializeUpHero(data);
      expect(manager.getUpGeneralId()).toBe('guanyu');
      expect(manager.getUpRate()).toBe(0.5);
    });

    it('should handle deserialization with version mismatch', () => {
      const data = makeSaveData({ version: 999 });
      expect(() => manager.deserializeUpHero(data)).not.toThrow();
    });

    it('should handle deserialization with null upHero', () => {
      const data: RecruitSaveData = {
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
        history: [],
        upHero: null as any,
      };
      manager.deserializeUpHero(data);
      expect(manager.getUpGeneralId()).toBeNull();
    });

    it('should handle deserialization with missing upHero fields', () => {
      const data: RecruitSaveData = {
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
        history: [],
        upHero: {} as any,
      };
      manager.deserializeUpHero(data);
      expect(manager.getUpGeneralId()).toBeNull();
    });

    it('should preserve state through serialize/deserialize cycle', () => {
      manager.setUpHero('zhaoyun', 0.7);
      const serialized = manager.serializeUpHero();

      const manager2 = new HeroRecruitUpManager();
      manager2.init(makeMockCoreDeps());
      manager2.deserializeUpHero({
        version: RECRUIT_SAVE_VERSION,
        pity: { normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 },
        history: [],
        upHero: serialized,
      });
      expect(manager2.getUpGeneralId()).toBe('zhaoyun');
      expect(manager2.getUpRate()).toBe(0.7);
    });
  });

  // ─────────────────────────────────────────
  // 5. 边界情况
  // ─────────────────────────────────────────
  describe('边界情况', () => {
    it('should handle empty string generalId', () => {
      manager.setUpHero('');
      expect(manager.getUpGeneralId()).toBe('');
    });

    it('should handle very long generalId', () => {
      const longId = 'a'.repeat(1000);
      manager.setUpHero(longId);
      expect(manager.getUpGeneralId()).toBe(longId);
    });

    it('should handle extreme rate values', () => {
      manager.setUpRate(0.0001);
      expect(manager.getUpRate()).toBe(0.0001);
      manager.setUpRate(0.9999);
      expect(manager.getUpRate()).toBe(0.9999);
    });

    it('should initialize with default state', () => {
      const fresh = new HeroRecruitUpManager();
      expect(fresh.getUpGeneralId()).toBeNull();
    });
  });
});
