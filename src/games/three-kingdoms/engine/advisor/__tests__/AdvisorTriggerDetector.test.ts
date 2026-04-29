/**
 * AdvisorTriggerDetector 单元测试
 *
 * 覆盖：
 * 1. isInCooldown / setCooldown — 冷却检查
 * 2. findOverflowResource / findShortageResource — 资源检测
 * 3. detectAllTriggers — 全触发条件检测
 */

import {
  isInCooldown,
  setCooldown,
  findOverflowResource,
  findShortageResource,
  detectAllTriggers,
} from '../AdvisorTriggerDetector';

import type { AdvisorSuggestion } from '../../../core/advisor/advisor.types';
import type { GameStateSnapshot } from './AdvisorSystem';

describe('AdvisorTriggerDetector', () => {
  // ─── 冷却系统 ─────────────────────────────

  describe('冷却系统', () => {
    it('初始应不在冷却中', () => {
      const state = { cooldowns: {} };
      expect(isInCooldown(state, 'resource_overflow')).toBe(false);
    });

    it('设置冷却后应在冷却中', () => {
      const state = { cooldowns: {} };
      setCooldown(state, 'resource_overflow');
      expect(isInCooldown(state, 'resource_overflow')).toBe(true);
    });

    it('不同触发类型应独立冷却', () => {
      const state = { cooldowns: {} };
      setCooldown(state, 'resource_overflow');
      expect(isInCooldown(state, 'resource_shortage')).toBe(false);
    });
  });

  // ─── findOverflowResource ─────────────────

  describe('findOverflowResource', () => {
    it('资源超过90%容量应返回该资源', () => {
      const snapshot = {
        resources: { grain: 95 },
        resourceCaps: { grain: 100 },
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      expect(findOverflowResource(snapshot)).toBe('grain');
    });

    it('资源未超过90%应返回 null', () => {
      const snapshot = {
        resources: { grain: 50 },
        resourceCaps: { grain: 100 },
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      expect(findOverflowResource(snapshot)).toBeNull();
    });

    it('null resources 应返回 null', () => {
      const snapshot = {
        resources: null,
        resourceCaps: {},
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      expect(findOverflowResource(snapshot)).toBeNull();
    });
  });

  // ─── findShortageResource ─────────────────

  describe('findShortageResource', () => {
    it('资源低于10%容量应返回该资源', () => {
      const snapshot = {
        resources: { grain: 5 },
        resourceCaps: { grain: 100 },
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      expect(findShortageResource(snapshot)).toBe('grain');
    });

    it('资源充足应返回 null', () => {
      const snapshot = {
        resources: { grain: 50 },
        resourceCaps: { grain: 100 },
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      expect(findShortageResource(snapshot)).toBeNull();
    });
  });

  // ─── detectAllTriggers ────────────────────

  describe('detectAllTriggers', () => {
    const createSuggestion = (
      trigger: string, title: string, desc: string, priority: string, action: string, target: string, targetId?: string,
    ): AdvisorSuggestion => ({
      id: `sug_${trigger}`,
      triggerType: trigger,
      title,
      description: desc,
      priority,
      action,
      target,
      targetId,
    });

    it('应检测资源溢出', () => {
      const snapshot = {
        resources: { grain: 95 },
        resourceCaps: { grain: 100 },
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      const state = { cooldowns: {} };
      const suggestions = detectAllTriggers(snapshot, state, createSuggestion);
      const overflow = suggestions.find(s => s.triggerType === 'resource_overflow');
      expect(overflow).toBeDefined();
    });

    it('应检测建筑队列空闲', () => {
      const snapshot = {
        resources: {},
        resourceCaps: {},
        buildingQueueIdle: true,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      const state = { cooldowns: {} };
      const suggestions = detectAllTriggers(snapshot, state, createSuggestion);
      const idle = suggestions.find(s => s.triggerType === 'building_idle');
      expect(idle).toBeDefined();
    });

    it('冷却中的触发应被跳过', () => {
      const snapshot = {
        resources: { grain: 95 },
        resourceCaps: { grain: 100 },
        buildingQueueIdle: true,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      const state = { cooldowns: {} };
      setCooldown(state, 'resource_overflow');
      const suggestions = detectAllTriggers(snapshot, state, createSuggestion);
      const overflow = suggestions.find(s => s.triggerType === 'resource_overflow');
      expect(overflow).toBeUndefined();
    });

    it('无触发条件应返回空列表', () => {
      const snapshot = {
        resources: {},
        resourceCaps: {},
        buildingQueueIdle: false,
        upgradeableHeroes: [],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      const state = { cooldowns: {} };
      const suggestions = detectAllTriggers(snapshot, state, createSuggestion);
      expect(suggestions).toEqual([]);
    });

    it('应检测可升级武将', () => {
      const snapshot = {
        resources: {},
        resourceCaps: {},
        buildingQueueIdle: false,
        upgradeableHeroes: ['hero_1'],
        techQueueIdle: false,
        armyFull: false,
        leavingNpcs: [],
        newFeatures: [],
        offlineOverflowPercent: 0,
      };
      const state = { cooldowns: {} };
      const suggestions = detectAllTriggers(snapshot, state, createSuggestion);
      const hero = suggestions.find(s => s.triggerType === 'hero_upgradeable');
      expect(hero).toBeDefined();
      expect(hero!.targetId).toBe('hero_1');
    });
  });
});
