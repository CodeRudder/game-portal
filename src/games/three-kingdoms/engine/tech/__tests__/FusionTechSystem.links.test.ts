/**
 * FusionTechSystem.links 测试
 *
 * 覆盖：
 *   - createFusionLinksMap 创建
 *   - getFusionLinkEffects 查询
 *   - getActiveFusionLinkEffects 过滤
 *   - getFusionLinkBonus 加成汇总
 *   - syncFusionLinksToLinkSystem 同步
 *   - checkPrerequisitesDetailed 前置条件检查
 *   - getPathPairProgress 路线组合进度
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_FUSION_LINKS,
  createFusionLinksMap,
  getFusionLinkEffects,
  getActiveFusionLinkEffects,
  getFusionLinkBonus,
  syncFusionLinksToLinkSystem,
  checkPrerequisitesDetailed,
  getPathPairProgress,
} from '../FusionTechSystem.links';
import type { FusionTechState } from '../fusion-tech.types';

describe('FusionTechSystem.links', () => {
  describe('DEFAULT_FUSION_LINKS', () => {
    it('应包含12条默认联动效果', () => {
      expect(DEFAULT_FUSION_LINKS).toHaveLength(12);
    });

    it('每条联动效果应有完整属性', () => {
      for (const link of DEFAULT_FUSION_LINKS) {
        expect(link.id).toBeTruthy();
        expect(link.fusionTechId).toBeTruthy();
        expect(['building', 'hero', 'resource']).toContain(link.target);
        expect(link.value).toBeGreaterThan(0);
      }
    });
  });

  describe('createFusionLinksMap', () => {
    it('应创建包含所有默认联动效果的 Map', () => {
      const map = createFusionLinksMap();
      expect(map.size).toBe(DEFAULT_FUSION_LINKS.length);
    });

    it('Map 的 key 应为联动效果 ID', () => {
      const map = createFusionLinksMap();
      for (const link of DEFAULT_FUSION_LINKS) {
        expect(map.has(link.id)).toBe(true);
        expect(map.get(link.id)).toEqual(link);
      }
    });
  });

  describe('getFusionLinkEffects', () => {
    it('应返回指定融合科技的联动效果', () => {
      const map = createFusionLinksMap();
      const effects = getFusionLinkEffects('fusion_mil_eco_1', map);
      expect(effects).toHaveLength(2);
    });

    it('不存在的融合科技应返回空数组', () => {
      const map = createFusionLinksMap();
      const effects = getFusionLinkEffects('nonexistent', map);
      expect(effects).toHaveLength(0);
    });
  });

  describe('getActiveFusionLinkEffects', () => {
    it('应只返回已完成融合科技的联动效果', () => {
      const map = createFusionLinksMap();
      const nodes: Record<string, FusionTechState> = {
        fusion_mil_eco_1: { status: 'completed' } as FusionTechState,
        fusion_mil_eco_2: { status: 'locked' } as FusionTechState,
      };
      const effects = getActiveFusionLinkEffects(map, nodes);
      expect(effects.length).toBeGreaterThan(0);
      for (const e of effects) {
        expect(e.fusionTechId).toBe('fusion_mil_eco_1');
      }
    });

    it('无已完成节点时应返回空数组', () => {
      const map = createFusionLinksMap();
      const nodes: Record<string, FusionTechState> = {};
      const effects = getActiveFusionLinkEffects(map, nodes);
      expect(effects).toHaveLength(0);
    });
  });

  describe('getFusionLinkBonus', () => {
    it('应汇总指定目标的加成总值', () => {
      const map = createFusionLinksMap();
      const nodes: Record<string, FusionTechState> = {
        fusion_mil_eco_1: { status: 'completed' } as FusionTechState,
      };
      const bonus = getFusionLinkBonus('building', 'barracks', map, nodes);
      expect(bonus).toBe(10);
    });

    it('未完成科技不应计入', () => {
      const map = createFusionLinksMap();
      const nodes: Record<string, FusionTechState> = {
        fusion_mil_eco_1: { status: 'researching' } as FusionTechState,
      };
      const bonus = getFusionLinkBonus('building', 'barracks', map, nodes);
      expect(bonus).toBe(0);
    });
  });

  describe('syncFusionLinksToLinkSystem', () => {
    it('linkSystem 为 null 时不应报错', () => {
      const map = createFusionLinksMap();
      expect(() => syncFusionLinksToLinkSystem('fusion_mil_eco_1', map, {}, null)).not.toThrow();
    });

    it('应将联动效果注册到 linkSystem', () => {
      const map = createFusionLinksMap();
      const registerLink = vi.fn();
      const addCompletedTech = vi.fn();
      const linkSystem = { registerLink, addCompletedTech };

      syncFusionLinksToLinkSystem('fusion_mil_eco_1', map, {}, linkSystem);
      expect(registerLink).toHaveBeenCalledTimes(2);
      expect(addCompletedTech).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkPrerequisitesDetailed', () => {
    it('两个前置都完成时应满足', () => {
      const deps = {
        getNodeDef: (id: string) => ({ path: 'military' }),
        getNodeState: (id: string) => ({ status: 'completed' }),
      };
      const result = checkPrerequisitesDetailed('test', { pathA: 'a', pathB: 'b' }, deps);
      expect(result.met).toBe(true);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].met).toBe(true);
      expect(result.groups[1].met).toBe(true);
    });

    it('任一前置未完成时不应满足', () => {
      const deps = {
        getNodeDef: (id: string) => ({ path: 'military' }),
        getNodeState: (id: string) => id === 'a' ? { status: 'completed' } : { status: 'locked' },
      };
      const result = checkPrerequisitesDetailed('test', { pathA: 'a', pathB: 'b' }, deps);
      expect(result.met).toBe(false);
    });

    it('无前置状态时应不满足', () => {
      const deps = {
        getNodeDef: (id: string) => undefined,
        getNodeState: (id: string) => undefined,
      };
      const result = checkPrerequisitesDetailed('test', { pathA: 'a', pathB: 'b' }, deps);
      expect(result.met).toBe(false);
    });
  });

  describe('getPathPairProgress', () => {
    it('应正确统计各状态数量', () => {
      const fusions = [
        { id: 'f1' },
        { id: 'f2' },
        { id: 'f3' },
      ];
      const nodes: Record<string, FusionTechState> = {
        f1: { status: 'completed' } as FusionTechState,
        f2: { status: 'available' } as FusionTechState,
        f3: { status: 'locked' } as FusionTechState,
      };
      const progress = getPathPairProgress(fusions, nodes);
      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(1);
      expect(progress.available).toBe(1);
      expect(progress.locked).toBe(1);
    });

    it('空列表应返回全零', () => {
      const progress = getPathPairProgress([], {});
      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.available).toBe(0);
      expect(progress.locked).toBe(0);
    });
  });
});
