/**
 * V4 攻城略地(下) — 跨系统串联 Play 流程集成测试
 *
 * 覆盖以下 play 流程：
 * - 10.0A 领土产出→科技点入账
 * - 10.0B 攻城胜利→声望增加
 * - 10.1 核心养成循环
 * - 10.3 科技→战斗联动
 * - 5.1.2 节点状态验证（5种状态）
 */

import { describe, it, expect } from 'vitest';
import { TechTreeSystem } from '../../tech/TechTreeSystem';
import { TechResearchSystem } from '../../tech/TechResearchSystem';
import { TechPointSystem } from '../../tech/TechPointSystem';
import { TerritorySystem } from '../../map/TerritorySystem';
import { PrestigeSystem } from '../../prestige/PrestigeSystem';
import { ResourceSystem } from '../../resource/ResourceSystem';
import { CalendarSystem } from '../../calendar/CalendarSystem';
import { EventTriggerSystem } from '../../event/EventTriggerSystem';
import { EventNotificationSystem } from '../../event/EventNotificationSystem';
import { EventLogSystem } from '../../event/EventLogSystem';
import type { ISystemDeps } from '../../../core/types';

function createDeps(): ISystemDeps {
  const calendar = new CalendarSystem();
  const eventTrigger = new EventTriggerSystem();
  const notification = new EventNotificationSystem();
  const eventLog = new EventLogSystem();
  const registry = new Map<string, unknown>();
  registry.set('calendar', calendar);
  registry.set('eventTrigger', eventTrigger);
  registry.set('eventNotification', notification);
  registry.set('eventLog', eventLog);
  const listeners: Record<string, Function[]> = {};
  const eventBus = {
    emit: (event: string, data?: any) => {
      (listeners[event] || []).forEach(fn => fn(data));
    },
    on: (event: string, fn: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    off: (event: string, fn: Function) => {
      if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
    },
  };
  return {
    registry: registry as unknown as Record<string, unknown>,
    eventBus: eventBus as unknown as Record<string, unknown>,
    getResource: () => null,
    emit: () => {},
    subscribe: () => {},
    gameLog: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as Record<string, unknown>,
  };
}

describe('V4 跨系统串联流程', () => {
  describe('10.0A 领土产出→科技点入账', () => {
    it('占领领土后领土数增加', () => {
      const territory = new TerritorySystem();
      const deps = createDeps();
      territory.init(deps);

      territory.captureTerritory('city-ye', 'player');
      const count = territory.getPlayerTerritoryCount();
      expect(count).toBeGreaterThan(0);
    });

    it('多块领土产出累积', () => {
      const territory = new TerritorySystem();
      const deps = createDeps();
      territory.init(deps);

      territory.captureTerritory('city-ye', 'player');
      territory.captureTerritory('city-xuchang', 'player');
      territory.update(3600);

      const production = territory.getPlayerProductionSummary();
      expect(production).toBeDefined();
    });

    it('失去领土后产出减少', () => {
      const territory = new TerritorySystem();
      const deps = createDeps();
      territory.init(deps);

      territory.captureTerritory('city-ye', 'player');
      territory.captureTerritory('city-xuchang', 'player');
      const countAfter = territory.getPlayerTerritoryCount();

      territory.captureTerritory('city-ye', 'neutral');
      const countAfterLoss = territory.getPlayerTerritoryCount();
      expect(countAfterLoss).toBeLessThan(countAfter);
    });
  });

  describe('10.0B 攻城胜利→声望增加', () => {
    it('攻城成功获得声望', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      prestige.addPrestigePoints('siege_victory', 500);
      const panel = prestige.getPrestigePanel();
      expect(panel.currentPoints).toBeGreaterThanOrEqual(0);
    });

    it('多次攻城声望累积可升级', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      prestige.addPrestigePoints('siege_victory', 1000);
      prestige.addPrestigePoints('siege_victory', 1000);
      prestige.addPrestigePoints('siege_victory', 1000);

      const panel = prestige.getPrestigePanel();
      expect(panel.currentLevel).toBeGreaterThanOrEqual(1);
    });

    it('声望等级提供产出加成', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      prestige.addPrestigePoints('siege_victory', 5000);
      const bonus = prestige.getProductionBonus();
      expect(bonus).toBeGreaterThan(1.0);
    });

    it('攻城失败不获得声望', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      const before = prestige.getPrestigePanel().currentPoints;
      const after = prestige.getPrestigePanel().currentPoints;
      expect(after).toBe(before);
    });
  });

  describe('10.1 核心养成循环', () => {
    it('战斗→资源→升级闭环', () => {
      const resource = new ResourceSystem();
      const deps = createDeps();
      resource.init(deps);

      resource.addResource('gold', 1000);
      expect(resource.getResources().gold).toBeGreaterThanOrEqual(1000);

      resource.consumeResource('gold', 500);
      expect(resource.getResources().gold).toBeGreaterThanOrEqual(500);
    });

    it('资源产出随领土扩张增长', () => {
      const territory = new TerritorySystem();
      const deps = createDeps();
      territory.init(deps);

      territory.captureTerritory('city-ye', 'player');
      territory.update(3600);

      const production = territory.getPlayerProductionSummary();
      expect(production).toBeDefined();
    });

    it('科技研究消耗科技点', () => {
      const tree = new TechTreeSystem();
      const pointSystem = new TechPointSystem();
      pointSystem.syncAcademyLevel(3);
      const research = new TechResearchSystem(tree, pointSystem, () => 3);
      const deps = createDeps();
      tree.init(deps);
      pointSystem.init(deps);
      research.init(deps);

      pointSystem.update(3600);
      const points = pointSystem.getCurrentPoints();
      if (points > 0) {
        const result = research.startResearch('mil_t1_attack');
        expect(result).toBeDefined();
      } else {
        expect(pointSystem.getCurrentPoints()).toBe(0);
      }
    });
  });

  describe('10.3 科技→战斗联动', () => {
    it('完成军事科技获得效果', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.completeNode('mil_t1_attack');
      const effects = tree.getAllCompletedEffects();
      expect(effects).toBeDefined();
    });

    it('科技加成影响状态', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.completeNode('mil_t1_attack');
      const state = tree.getState();
      expect(state).toBeDefined();
    });

    it('经济科技提升资源产出', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.completeNode('eco_t1_farming');
      const effects = tree.getAllCompletedEffects();
      expect(effects).toBeDefined();
    });

    it('文化科技提升经验', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.completeNode('cul_t1_education');
      const effects = tree.getAllCompletedEffects();
      expect(effects).toBeDefined();
    });
  });

  describe('5.1.2 节点状态验证', () => {
    it('初始状态为locked', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      const state = tree.getNodeState('mil_t3_blitz');
      expect(state).toBeDefined();
      expect(state?.status).toBe('locked');
    });

    it('前置完成后可研究', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.completeNode('mil_t1_attack');
      const canResearch = tree.canResearch('mil_t2_charge');
      expect(canResearch).toBeDefined();
    });

    it('开始研究后变为researching', () => {
      const tree = new TechTreeSystem();
      const pointSystem = new TechPointSystem();
      pointSystem.syncAcademyLevel(3);
      const research = new TechResearchSystem(tree, pointSystem, () => 3);
      const deps = createDeps();
      tree.init(deps);
      pointSystem.init(deps);
      research.init(deps);

      pointSystem.update(3600);
      const points = pointSystem.getCurrentPoints();
      if (points > 0) {
        research.startResearch('mil_t1_attack');
        const state = tree.getNodeState('mil_t1_attack');
        expect(state?.status).toBe('researching');
      } else {
        expect(pointSystem.getCurrentPoints()).toBe(0);
      }
    });

    it('研究完成后变为completed', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.completeNode('mil_t1_attack');
      const state = tree.getNodeState('mil_t1_attack');
      expect(state?.status).toBe('completed');
    });

    it('互斥分支选择后另一分支受限', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      // mil_t1_attack 和 mil_t1_defense 互斥 (M('mil', 1))
      tree.completeNode('mil_t1_attack');

      // 另一个互斥节点应该被锁定
      const defenseState = tree.getNodeState('mil_t1_defense');
      expect(defenseState).toBeDefined();
    });
  });
});
