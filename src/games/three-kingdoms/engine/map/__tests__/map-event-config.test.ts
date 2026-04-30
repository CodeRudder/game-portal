/**
 * map-event-config 单元测试
 *
 * 验证地图事件配置数据的完整性和一致性：
 * - 5种事件类型齐全
 * - 权重总和合理
 * - 每种事件配置结构完整
 * - 奖励数据一致性
 */
import { describe, it, expect } from 'vitest';
import { EVENT_TYPE_CONFIGS } from '../map-event-config';

describe('map-event-config', () => {
  describe('EVENT_TYPE_CONFIGS', () => {
    it('should have exactly 5 event types', () => {
      expect(EVENT_TYPE_CONFIGS).toHaveLength(5);
    });

    it('should contain all expected event types', () => {
      const types = EVENT_TYPE_CONFIGS.map(c => c.type);
      expect(types).toContain('bandit');
      expect(types).toContain('caravan');
      expect(types).toContain('disaster');
      expect(types).toContain('ruins');
      expect(types).toContain('conflict');
    });

    it('should have unique event types', () => {
      const types = EVENT_TYPE_CONFIGS.map(c => c.type);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    it('should have total weight of 100', () => {
      const totalWeight = EVENT_TYPE_CONFIGS.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it('should have all weights positive', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        expect(config.weight).toBeGreaterThan(0);
      });
    });

    it('should have combat events: bandit and conflict', () => {
      const combatEvents = EVENT_TYPE_CONFIGS.filter(c => c.isCombat);
      expect(combatEvents.map(c => c.type).sort()).toEqual(['bandit', 'conflict']);
    });

    it('should have non-combat events: caravan, disaster, ruins', () => {
      const nonCombatEvents = EVENT_TYPE_CONFIGS.filter(c => !c.isCombat);
      expect(nonCombatEvents.map(c => c.type).sort()).toEqual(['caravan', 'disaster', 'ruins']);
    });

    it('should have positive duration for all events', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        expect(config.duration).toBeGreaterThan(0);
      });
    });

    it('should have valid choices for each event', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        expect(config.choices.length).toBeGreaterThan(0);
        config.choices.forEach(choice => {
          expect(['attack', 'negotiate', 'ignore']).toContain(choice);
        });
      });
    });

    it('disaster should only have negotiate and ignore choices (no attack)', () => {
      const disaster = EVENT_TYPE_CONFIGS.find(c => c.type === 'disaster');
      expect(disaster).toBeDefined();
      expect(disaster!.choices).toEqual(['negotiate', 'ignore']);
      expect(disaster!.attackRewards).toEqual([]);
    });

    it('should have non-negative reward amounts', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        const allRewards = [
          ...config.attackRewards,
          ...config.negotiateRewards,
          ...config.ignoreRewards,
        ];
        allRewards.forEach(reward => {
          expect(reward.amount).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('attack rewards should be >= negotiate rewards for same resource type', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        if (config.attackRewards.length === 0) return;
        config.attackRewards.forEach(attackReward => {
          const negotiateMatch = config.negotiateRewards.find(r => r.type === attackReward.type);
          if (negotiateMatch) {
            expect(attackReward.amount).toBeGreaterThanOrEqual(negotiateMatch.amount);
          }
        });
      });
    });

    it('ignore rewards should always be empty', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        expect(config.ignoreRewards).toEqual([]);
      });
    });

    it('bandit should have gold and grain attack rewards', () => {
      const bandit = EVENT_TYPE_CONFIGS.find(c => c.type === 'bandit');
      expect(bandit).toBeDefined();
      const rewardTypes = bandit!.attackRewards.map(r => r.type);
      expect(rewardTypes).toContain('gold');
      expect(rewardTypes).toContain('grain');
    });

    it('ruins should have techPoint rewards', () => {
      const ruins = EVENT_TYPE_CONFIGS.find(c => c.type === 'ruins');
      expect(ruins).toBeDefined();
      const attackRewardTypes = ruins!.attackRewards.map(r => r.type);
      expect(attackRewardTypes).toContain('techPoint');
    });

    it('conflict should have troops rewards', () => {
      const conflict = EVENT_TYPE_CONFIGS.find(c => c.type === 'conflict');
      expect(conflict).toBeDefined();
      const attackRewardTypes = conflict!.attackRewards.map(r => r.type);
      expect(attackRewardTypes).toContain('troops');
    });

    it('should have name and description for each event', () => {
      EVENT_TYPE_CONFIGS.forEach(config => {
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.name.length).toBeGreaterThan(0);
        expect(config.description.length).toBeGreaterThan(0);
      });
    });

    it('conflict should have the longest duration', () => {
      const conflict = EVENT_TYPE_CONFIGS.find(c => c.type === 'conflict')!;
      EVENT_TYPE_CONFIGS.forEach(config => {
        if (config.type !== 'conflict') {
          expect(conflict.duration).toBeGreaterThan(config.duration);
        }
      });
    });
  });
});
