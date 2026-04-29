/**
 * engine-save.ts 单元测试
 *
 * 覆盖：
 * - buildSaveData: 序列化完整存档
 * - toIGameState / fromIGameState: 格式转换
 * - applyDeserialize: 从 JSON 反序列化
 * - tryLoadLegacyFormat: 旧格式检测
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  buildSaveData,
  toIGameState,
  fromIGameState,
  tryLoadLegacyFormat,
  applyDeserialize,
} from '../engine-save';
import type { SaveContext } from '../engine-save';
import type { ResourceSystem } from '../resource/ResourceSystem';
import type { BuildingSystem } from '../building/BuildingSystem';
import type { CalendarSystem } from '../calendar/CalendarSystem';
import type { HeroSystem } from '../hero/HeroSystem';
import type { HeroRecruitSystem } from '../hero/HeroRecruitSystem';
import type { HeroFormation } from '../hero/HeroFormation';
import type { CampaignProgressSystem } from '../campaign/CampaignProgressSystem';
import type { TechTreeSystem } from '../tech/TechTreeSystem';
import type { TechPointSystem } from '../tech/TechPointSystem';
import type { TechResearchSystem } from '../tech/TechResearchSystem';
import type { EventBus } from '../../../core/events/EventBus';
import type { SubsystemRegistry } from '../../../core/engine/SubsystemRegistry';
import type { ConfigRegistry } from '../../../core/config/ConfigRegistry';
import type { GameSaveData } from '../../shared/types';

// ── Mock factories ──────────────────────────────────

function createMockSaveContext(): SaveContext {
  return {
    resource: {
      serialize: vi.fn(() => ({
        grain: 100, gold: 200, troops: 50,
        mandate: 10, techPoint: 5, recruitToken: 3, skillBook: 1,
      })),
      deserialize: vi.fn(),
      getResources: vi.fn(() => ({})),
      getLastSaveTime: vi.fn(() => Date.now()),
      applyOfflineEarnings: vi.fn(() => ({
        offlineSeconds: 0,
        earned: { grain: 0, gold: 0, troops: 0, mandate: 0 },
        rates: { grain: 1, gold: 0.5, troops: 0.2 },
      })),
      recalculateProduction: vi.fn(),
      updateCaps: vi.fn(),
    } as unknown as ResourceSystem,
    building: {
      serialize: vi.fn(() => ({
        farmland: { level: 1, upgrading: false },
        barracks: { level: 1, upgrading: false },
        academy: { level: 1, upgrading: false },
        castle: { level: 1, upgrading: false },
        market: { level: 0, upgrading: false },
        warehouse: { level: 0, upgrading: false },
        watchtower: { level: 0, upgrading: false },
      })),
      deserialize: vi.fn(),
      calculateTotalProduction: vi.fn(() => ({})),
      getProductionBuildingLevels: vi.fn(() => ({ farmland: 1, barracks: 1 })),
      getLevel: vi.fn(() => 1),
    } as unknown as BuildingSystem,
    calendar: {
      serialize: vi.fn(() => ({ day: 1, season: 'spring', year: 1 })),
      deserialize: vi.fn(),
      init: vi.fn(),
    } as unknown as CalendarSystem,
    hero: {
      serialize: vi.fn(() => ({ version: 1, generals: [] })),
      deserialize: vi.fn(),
    } as unknown as HeroSystem,
    recruit: {
      serialize: vi.fn(() => ({ version: 1, history: [], pityCounter: {} })),
      deserialize: vi.fn(),
    } as unknown as HeroRecruitSystem,
    formation: {
      serialize: vi.fn(() => ({ version: 1, formations: [], activeId: 'default' })),
      deserialize: vi.fn(),
    } as unknown as HeroFormation,
    campaign: {
      serialize: vi.fn(() => ({ version: 1, completedStages: {}, currentChapter: 1 })),
      deserialize: vi.fn(),
    } as unknown as CampaignProgressSystem,
    techTree: {
      serialize: vi.fn(() => ({
        completedTechIds: [],
        chosenMutexNodes: {},
      })),
      deserialize: vi.fn(),
      getTechBonusMultiplier: vi.fn(() => 0),
      getEffectValue: vi.fn(() => 0),
    } as unknown as TechTreeSystem,
    techPoint: {
      serialize: vi.fn(() => ({ techPoints: { current: 0, max: 100 } })),
      deserialize: vi.fn(),
      syncAcademyLevel: vi.fn(),
      syncResearchSpeedBonus: vi.fn(),
      update: vi.fn(),
    } as unknown as TechPointSystem,
    techResearch: {
      serialize: vi.fn(() => ({
        activeResearch: null,
        researchQueue: [],
      })),
      deserialize: vi.fn(),
      update: vi.fn(),
    } as unknown as TechResearchSystem,
    bus: {
      emit: vi.fn(),
    } as unknown as EventBus,
    registry: {
      get: vi.fn(),
      register: vi.fn(),
    } as unknown as SubsystemRegistry,
    configRegistry: {
      get: vi.fn(),
      register: vi.fn(),
    } as unknown as ConfigRegistry,
    onlineSeconds: 3600,
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── buildSaveData ──────────────────────────────────

  describe('buildSaveData()', () => {
    it('构建包含 version 和 saveTime 的存档', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('number');
      expect(data.saveTime).toBeDefined();
      expect(typeof data.saveTime).toBe('number');
    });

    it('包含核心子系统数据', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);

      expect(data.resource).toBeDefined();
      expect(data.building).toBeDefined();
      expect(data.calendar).toBeDefined();
      expect(data.hero).toBeDefined();
      expect(data.recruit).toBeDefined();
      expect(data.formation).toBeDefined();
      expect(data.campaign).toBeDefined();
      expect(data.tech).toBeDefined();
    });

    it('科技存档包含完整数据', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);

      expect(data.tech.version).toBe(1);
      expect(data.tech.completedTechIds).toEqual([]);
      expect(data.tech.activeResearch).toBeNull();
      expect(data.tech.researchQueue).toEqual([]);
      expect(data.tech.techPoints).toEqual({ current: 0, max: 100 });
      expect(data.tech.chosenMutexNodes).toEqual({});
    });

    it('可选子系统不存在时为 undefined', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);

      expect(data.equipment).toBeUndefined();
      expect(data.equipmentForge).toBeUndefined();
      expect(data.equipmentEnhance).toBeUndefined();
      expect(data.trade).toBeUndefined();
      expect(data.shop).toBeUndefined();
      expect(data.prestige).toBeUndefined();
      expect(data.heritage).toBeUndefined();
      expect(data.achievement).toBeUndefined();
      expect(data.pvpArena).toBeUndefined();
      expect(data.pvpArenaShop).toBeUndefined();
      expect(data.pvpRanking).toBeUndefined();
      expect(data.eventTrigger).toBeUndefined();
      expect(data.eventNotification).toBeUndefined();
      expect(data.eventUI).toBeUndefined();
      expect(data.eventChain).toBeUndefined();
      expect(data.eventLog).toBeUndefined();
      expect(data.offlineEvent).toBeUndefined();
    });
  });

  // ── toIGameState / fromIGameState ──────────────────

  describe('toIGameState()', () => {
    it('正确转换版本和时间戳', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);
      const state = toIGameState(data, 3600);

      expect(state.version).toBe(String(data.version));
      expect(state.timestamp).toBe(data.saveTime);
      expect(state.metadata.totalPlayTime).toBe(3600);
    });
  });

  describe('fromIGameState()', () => {
    it('正确恢复版本和时间戳', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);
      const state = toIGameState(data, 0);
      const restored = fromIGameState(state);

      expect(restored.version).toBe(data.version);
      expect(restored.saveTime).toBe(data.saveTime);
    });
  });

  // ── 往返转换 ──────────────────────────────────────

  describe('往返转换一致性', () => {
    it('buildSaveData → toIGameState → fromIGameState 保持数据一致', () => {
      const ctx = createMockSaveContext();
      const original = buildSaveData(ctx);
      const state = toIGameState(original, 7200);
      const restored = fromIGameState(state);

      expect(restored.version).toBe(original.version);
      expect(restored.saveTime).toBe(original.saveTime);
      expect(restored.resource).toEqual(original.resource);
      expect(restored.building).toEqual(original.building);
      expect(restored.tech).toEqual(original.tech);
    });
  });

  // ── tryLoadLegacyFormat ────────────────────────────

  describe('tryLoadLegacyFormat()', () => {
    it('localStorage 为空时返回 null', () => {
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('新格式存档返回 null', () => {
      localStorage.setItem(
        'three-kingdoms-save',
        JSON.stringify({ v: 2, checksum: 'abc', data: {} }),
      );
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('旧格式存档返回数据', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);
      localStorage.setItem('three-kingdoms-save', JSON.stringify(data));

      const result = tryLoadLegacyFormat();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(data.version);
    });

    it('无效 JSON 返回 null', () => {
      localStorage.setItem('three-kingdoms-save', '{{invalid');
      expect(tryLoadLegacyFormat()).toBeNull();
    });
  });

  // ── applyDeserialize ───────────────────────────────

  describe('applyDeserialize()', () => {
    it('从 JSON 字符串恢复存档', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);
      const json = JSON.stringify(data);

      applyDeserialize(ctx, json);

      expect(ctx.building.deserialize).toHaveBeenCalled();
      expect(ctx.resource.deserialize).toHaveBeenCalled();
      expect(ctx.calendar.deserialize).toHaveBeenCalled();
    });

    it('缺少可选字段时不报错', () => {
      const ctx = createMockSaveContext();
      const minimalData: GameSaveData = {
        version: 2,
        saveTime: Date.now(),
        resource: {
          grain: 100, gold: 200, troops: 50,
          mandate: 10, techPoint: 5, recruitToken: 3, skillBook: 1,
        },
        building: {
          farmland: { level: 1, upgrading: false },
          barracks: { level: 1, upgrading: false },
          academy: { level: 1, upgrading: false },
          castle: { level: 1, upgrading: false },
          market: { level: 0, upgrading: false },
          warehouse: { level: 0, upgrading: false },
          watchtower: { level: 0, upgrading: false },
        },
      };

      expect(() => applyDeserialize(ctx, JSON.stringify(minimalData))).not.toThrow();
    });

    it('反序列化后同步建筑到资源', () => {
      const ctx = createMockSaveContext();
      const data = buildSaveData(ctx);

      applyDeserialize(ctx, JSON.stringify(data));

      expect(ctx.building.calculateTotalProduction).toHaveBeenCalled();
    });
  });
});
