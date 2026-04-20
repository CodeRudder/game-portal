/**
 * SimulationDataProvider 测试
 *
 * 覆盖：
 *   - ISimulationDataProvider 接口
 *   - DefaultSimulationDataProvider 默认实现
 *   - 各方法返回值验证
 */

import { describe, it, expect } from 'vitest';
import {
  ISimulationDataProvider,
  DefaultSimulationDataProvider,
} from '../SimulationDataProvider';

describe('DefaultSimulationDataProvider', () => {
  let provider: DefaultSimulationDataProvider;

  beforeEach(() => {
    provider = new DefaultSimulationDataProvider();
  });

  describe('资源产出', () => {
    it('应返回 grain 产出速率', () => {
      expect(provider.getResourceProductionRate('grain')).toBeGreaterThan(0);
    });

    it('应返回 gold 产出速率', () => {
      expect(provider.getResourceProductionRate('gold')).toBeGreaterThan(0);
    });

    it('未知资源应返回 0', () => {
      expect(provider.getResourceProductionRate('unknown')).toBe(0);
    });
  });

  describe('建筑系统', () => {
    it('应返回 farm 等级', () => {
      expect(provider.getBuildingLevel('farm')).toBeGreaterThan(0);
    });

    it('未知建筑应返回 0', () => {
      expect(provider.getBuildingLevel('unknown')).toBe(0);
    });

    it('应返回升级费用', () => {
      const cost = provider.getBuildingUpgradeCost('farm', 5);
      expect(cost).toBeGreaterThan(0);
    });

    it('未知建筑升级应返回基于等级的费用', () => {
      const cost = provider.getBuildingUpgradeCost('unknown', 3);
      expect(cost).toBe(300);
    });
  });

  describe('武将系统', () => {
    it('应返回 hero_1 属性', () => {
      const stats = provider.getHeroStats('hero_1');
      expect(stats).not.toBeNull();
      expect(stats!.attack).toBeGreaterThan(0);
      expect(stats!.defense).toBeGreaterThan(0);
      expect(stats!.hp).toBeGreaterThan(0);
    });

    it('未知武将应返回 null', () => {
      expect(provider.getHeroStats('unknown')).toBeNull();
    });
  });

  describe('战斗系统', () => {
    it('应返回编队战力', () => {
      expect(provider.getFormationPower('main')).toBeGreaterThan(0);
    });

    it('应返回关卡敌方战力', () => {
      expect(provider.getStageEnemyPower(1, 1)).toBeGreaterThan(0);
    });

    it('未知关卡应返回默认战力', () => {
      expect(provider.getStageEnemyPower(99, 99)).toBe(1000);
    });
  });

  describe('科技系统', () => {
    it('应返回科技加成', () => {
      expect(provider.getTechBonus('tech_1')).toBeGreaterThan(0);
    });

    it('未知科技应返回 0', () => {
      expect(provider.getTechBonus('unknown')).toBe(0);
    });
  });

  describe('其他系统', () => {
    it('应返回声望值', () => {
      expect(provider.getReputation()).toBeGreaterThan(0);
    });

    it('应返回转生倍率', () => {
      expect(provider.getRebirthMultiplier()).toBeGreaterThan(1);
    });

    it('离线收益应与时间成正比', () => {
      const r1 = provider.getOfflineReward(3600);
      const r2 = provider.getOfflineReward(7200);
      expect(r2).toBeGreaterThan(r1);
      expect(r2).toBe(r1 * 2);
    });

    it('应返回装备加成', () => {
      expect(provider.getEquipmentBonus('equip_1')).toBeGreaterThan(0);
    });

    it('未知装备应返回 0', () => {
      expect(provider.getEquipmentBonus('unknown')).toBe(0);
    });
  });
});

describe('ISimulationDataProvider 接口', () => {
  it('应可被自定义实现', () => {
    const custom: ISimulationDataProvider = {
      getResourceProductionRate: () => 100,
      getBuildingLevel: () => 10,
      getBuildingUpgradeCost: () => 1000,
      getHeroStats: () => ({ attack: 200, defense: 150, hp: 1000 }),
      getFormationPower: () => 5000,
      getStageEnemyPower: () => 3000,
      getTechBonus: () => 0.2,
      getReputation: () => 3000,
      getRebirthMultiplier: () => 2.5,
      getOfflineReward: (s) => s * 10,
      getEquipmentBonus: () => 100,
    };
    expect(custom.getResourceProductionRate('grain')).toBe(100);
    expect(custom.getRebirthMultiplier()).toBe(2.5);
    expect(custom.getOfflineReward(60)).toBe(600);
  });
});
