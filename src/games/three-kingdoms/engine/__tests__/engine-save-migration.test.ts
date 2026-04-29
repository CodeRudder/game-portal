/**
 * engine-save-migration.ts 单元测试
 *
 * 覆盖：
 * - toIGameState: GameSaveData → IGameState 转换
 * - fromIGameState: IGameState → GameSaveData 转换
 * - tryLoadLegacyFormat: 旧格式检测
 * - 往返转换一致性
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  toIGameState,
  fromIGameState,
  tryLoadLegacyFormat,
} from '../engine-save-migration';
import type { GameSaveData } from '../../shared/types';
import type { IGameState } from '../../core/types/state';

// ── Fixtures ────────────────────────────────────────

function createMinimalSaveData(): GameSaveData {
  return {
    version: 2,
    saveTime: 1700000000000,
    resource: {
      grain: 100,
      gold: 200,
      troops: 50,
      mandate: 10,
      techPoint: 5,
      recruitToken: 3,
      skillBook: 1,
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
}

function createFullSaveData(): GameSaveData {
  return {
    ...createMinimalSaveData(),
    calendar: { day: 1, season: 'spring', year: 1 },
    hero: { version: 1, generals: [] },
    recruit: { version: 1, history: [], pityCounter: {} },
    formation: { version: 1, formations: [], activeId: 'default' },
    campaign: { version: 1, completedStages: {}, currentChapter: 1 },
    tech: {
      version: 1,
      completedTechIds: [],
      activeResearch: null,
      researchQueue: [],
      techPoints: { current: 0, max: 100 },
      chosenMutexNodes: {},
    },
    equipment: { version: 1, items: [] },
    equipmentForge: { version: 1, recipes: [] },
    equipmentEnhance: { protectionCount: 0 },
    trade: { version: 1, trades: [] },
    shop: { version: 1, purchases: {} },
    prestige: { level: 1, exp: 0 },
    heritage: { version: 1, bonuses: [] },
    achievement: { version: 1, unlocked: [] },
    pvpArena: { version: 1, rank: 1000 },
    pvpArenaShop: { version: 1, purchases: {} },
    pvpRanking: { version: 1, rank: 1000 },
    eventTrigger: { version: 1, activeEvents: [] },
    eventNotification: { version: 1, banners: [] },
    eventUI: { expiredBanners: [] },
    eventChain: { version: 1, chains: [] },
    eventLog: { version: 1, logs: [] },
    offlineEvent: { version: 1, offlineQueue: [], autoRules: [] },
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-save-migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── toIGameState ───────────────────────────────────

  describe('toIGameState()', () => {
    it('将 GameSaveData 转换为 IGameState 格式', () => {
      const data = createMinimalSaveData();
      const state = toIGameState(data, 3600);

      expect(state.version).toBe('2');
      expect(state.timestamp).toBe(1700000000000);
      expect(state.metadata.totalPlayTime).toBe(3600);
      expect(state.metadata.saveCount).toBe(0);
    });

    it('包含核心子系统数据', () => {
      const data = createMinimalSaveData();
      const state = toIGameState(data, 0);

      expect(state.subsystems.resource).toBe(data.resource);
      expect(state.subsystems.building).toBe(data.building);
    });

    it('可选子系统存在时包含在 subsystems 中', () => {
      const data = createFullSaveData();
      const state = toIGameState(data, 0);

      expect(state.subsystems.calendar).toBe(data.calendar);
      expect(state.subsystems.hero).toBe(data.hero);
      expect(state.subsystems.recruit).toBe(data.recruit);
      expect(state.subsystems.formation).toBe(data.formation);
      expect(state.subsystems.campaign).toBe(data.campaign);
      expect(state.subsystems.tech).toBe(data.tech);
      expect(state.subsystems.equipment).toBe(data.equipment);
      expect(state.subsystems.equipmentForge).toBe(data.equipmentForge);
      expect(state.subsystems.equipmentEnhance).toBe(data.equipmentEnhance);
      expect(state.subsystems.trade).toBe(data.trade);
      expect(state.subsystems.shop).toBe(data.shop);
      expect(state.subsystems.prestige).toBe(data.prestige);
      expect(state.subsystems.heritage).toBe(data.heritage);
      expect(state.subsystems.achievement).toBe(data.achievement);
      expect(state.subsystems.pvpArena).toBe(data.pvpArena);
      expect(state.subsystems.pvpArenaShop).toBe(data.pvpArenaShop);
      expect(state.subsystems.pvpRanking).toBe(data.pvpRanking);
      expect(state.subsystems.eventTrigger).toBe(data.eventTrigger);
      expect(state.subsystems.eventNotification).toBe(data.eventNotification);
      expect(state.subsystems.eventUI).toBe(data.eventUI);
      expect(state.subsystems.eventChain).toBe(data.eventChain);
      expect(state.subsystems.eventLog).toBe(data.eventLog);
      expect(state.subsystems.offlineEvent).toBe(data.offlineEvent);
    });

    it('可选子系统不存在时不包含在 subsystems 中', () => {
      const data = createMinimalSaveData();
      const state = toIGameState(data, 0);

      expect(state.subsystems.calendar).toBeUndefined();
      expect(state.subsystems.hero).toBeUndefined();
      expect(state.subsystems.equipment).toBeUndefined();
    });
  });

  // ── fromIGameState ─────────────────────────────────

  describe('fromIGameState()', () => {
    it('将 IGameState 转换回 GameSaveData', () => {
      const data = createMinimalSaveData();
      const state = toIGameState(data, 0);
      const restored = fromIGameState(state);

      expect(restored.version).toBe(data.version);
      expect(restored.saveTime).toBe(data.saveTime);
      expect(restored.resource).toBe(data.resource);
      expect(restored.building).toBe(data.building);
    });

    it('保留可选子系统数据', () => {
      const data = createFullSaveData();
      const state = toIGameState(data, 0);
      const restored = fromIGameState(state);

      expect(restored.calendar).toBe(data.calendar);
      expect(restored.hero).toBe(data.hero);
      expect(restored.recruit).toBe(data.recruit);
      expect(restored.formation).toBe(data.formation);
      expect(restored.campaign).toBe(data.campaign);
      expect(restored.tech).toBe(data.tech);
      expect(restored.equipment).toBe(data.equipment);
    });
  });

  // ── 往返转换一致性 ────────────────────────────────

  describe('往返转换一致性', () => {
    it('toIGameState → fromIGameState 保持数据一致', () => {
      const original = createFullSaveData();
      const state = toIGameState(original, 7200);
      const restored = fromIGameState(state);

      expect(restored.version).toBe(original.version);
      expect(restored.saveTime).toBe(original.saveTime);
      expect(restored.resource).toEqual(original.resource);
      expect(restored.building).toEqual(original.building);
      expect(restored.calendar).toEqual(original.calendar);
      expect(restored.hero).toEqual(original.hero);
      expect(restored.tech).toEqual(original.tech);
    });
  });

  // ── tryLoadLegacyFormat ────────────────────────────

  describe('tryLoadLegacyFormat()', () => {
    it('localStorage 为空时返回 null', () => {
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('新格式存档（有 v/checksum/data）返回 null', () => {
      localStorage.setItem(
        'three-kingdoms-save',
        JSON.stringify({ v: 2, checksum: 'abc', data: { version: 2 } }),
      );
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('旧格式存档（有 version + resource + building）返回数据', () => {
      const legacyData = createMinimalSaveData();
      localStorage.setItem('three-kingdoms-save', JSON.stringify(legacyData));

      const result = tryLoadLegacyFormat();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(2);
      expect(result!.resource).toEqual(legacyData.resource);
      expect(result!.building).toEqual(legacyData.building);
    });

    it('无效 JSON 返回 null', () => {
      localStorage.setItem('three-kingdoms-save', 'not valid json{{{');
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('JSON 缺少 version 字段返回 null', () => {
      localStorage.setItem('three-kingdoms-save', JSON.stringify({ foo: 'bar' }));
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('JSON 有 version 但缺少 resource 返回 null', () => {
      localStorage.setItem(
        'three-kingdoms-save',
        JSON.stringify({ version: 2, building: {} }),
      );
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('JSON 有 version 但缺少 building 返回 null', () => {
      localStorage.setItem(
        'three-kingdoms-save',
        JSON.stringify({ version: 2, resource: {} }),
      );
      expect(tryLoadLegacyFormat()).toBeNull();
    });

    it('version 不是数字时返回 null', () => {
      localStorage.setItem(
        'three-kingdoms-save',
        JSON.stringify({ version: '2', resource: {}, building: {} }),
      );
      expect(tryLoadLegacyFormat()).toBeNull();
    });
  });
});
