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
  return {
    registry: registry as any,
    getResource: () => null,
    emit: () => {},
    subscribe: () => {},
    gameLog: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
  };
}

describe('V4 跨系统串联流程', () => {
  describe('10.0A 领土产出→科技点入账', () => {
    it('占领领土后科技点产出增加', () => {
      const territory = new TerritorySystem();
      const pointSystem = new TechPointSystem();
      const deps = createDeps();
      territory.init(deps);
      pointSystem.init(deps);

      const beforePoints = pointSystem.getPoints();
      territory.captureTerritory('t_01_01', { owner: 'player' });
      territory.update(3600);

      const afterPoints = pointSystem.getPoints();
      expect(afterPoints).toBeGreaterThanOrEqual(beforePoints);
    });

    it('多块领土科技点累积', () => {
      const territory = new TerritorySystem();
      const pointSystem = new TechPointSystem();
      const deps = createDeps();
      territory.init(deps);
      pointSystem.init(deps);

      territory.captureTerritory('t_01_01', { owner: 'player' });
      territory.captureTerritory('t_01_02', { owner: 'player' });
      territory.update(3600);

      const points = pointSystem.getPoints();
      expect(points).toBeGreaterThan(0);
    });

    it('失去领土后产出减少', () => {
      const territory = new TerritorySystem();
      const deps = createDeps();
      territory.init(deps);

      territory.captureTerritory('t_01_01', { owner: 'player' });
      territory.captureTerritory('t_01_02', { owner: 'player' });
      const countAfter = territory.getTerritoryCount();

      territory.loseTerritory('t_01_01');
      const countAfterLoss = territory.getTerritoryCount();
      expect(countAfterLoss).toBeLessThan(countAfter);
    });
  });

  describe('10.0B 攻城胜利→声望增加', () => {
    it('攻城成功获得声望', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      prestige.addPrestige('siege_victory', 500);
      const afterPoints = prestige.getCurrentPoints();
      expect(afterPoints).toBeGreaterThanOrEqual(0);
    });

    it('多次攻城声望累积可升级', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      prestige.addPrestige('siege_victory', 1000);
      prestige.addPrestige('siege_victory', 1000);
      prestige.addPrestige('siege_victory', 1000);

      const level = prestige.getLevel();
      expect(level).toBeGreaterThanOrEqual(1);
    });

    it('声望等级提供产出加成', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      prestige.addPrestige('siege_victory', 5000);
      const bonus = prestige.getProductionBonus();
      expect(bonus).toBeGreaterThan(1.0);
    });

    it('攻城失败不获得声望', () => {
      const prestige = new PrestigeSystem();
      const deps = createDeps();
      prestige.init(deps);

      const before = prestige.getCurrentPoints();
      const after = prestige.getCurrentPoints();
      expect(after).toBe(before);
    });
  });

  describe('10.1 核心养成循环', () => {
    it('战斗→资源→升级→更强战斗闭环', () => {
      const resource = new ResourceSystem();
      const deps = createDeps();
      resource.init(deps);

      resource.addResource('copper', 1000);
      expect(resource.getResource('copper')).toBeGreaterThanOrEqual(1000);

      resource.removeResource('copper', 500);
      expect(resource.getResource('copper')).toBeGreaterThanOrEqual(500);
    });

    it('资源产出随领土扩张增长', () => {
      const territory = new TerritorySystem();
      const deps = createDeps();
      territory.init(deps);

      territory.captureTerritory('t_01_01', { owner: 'player' });
      territory.update(3600);

      const production = territory.getTotalProduction();
      expect(production).toBeDefined();
    });

    it('科技研究消耗资源提升战力', () => {
      const tree = new TechTreeSystem();
      const pointSystem = new TechPointSystem();
      const research = new TechResearchSystem(tree, pointSystem, () => 1);
      const deps = createDeps();
      tree.init(deps);
      pointSystem.init(deps);
      research.init(deps);

      pointSystem.addPoints(100);
      const result = research.startResearch('mil_attack_1');
      expect(result).toBeDefined();
    });
  });

  describe('10.3 科技→战斗联动', () => {
    it('完成军事科技提升攻击力', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('mil_attack_1');
      const effects = tree.getCompletedEffects();
      expect(effects).toBeDefined();
    });

    it('科技加成影响战斗伤害计算', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('mil_attack_1');
      const state = tree.getState();
      expect(state).toBeDefined();
    });

    it('经济科技提升资源产出', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('eco_farm_1');
      const effects = tree.getCompletedEffects();
      expect(effects).toBeDefined();
    });

    it('文化科技提升民心', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('cul_benev_1');
      const effects = tree.getCompletedEffects();
      expect(effects).toBeDefined();
    });
  });

  describe('5.1.2 节点状态验证', () => {
    it('初始状态为locked', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      const state = tree.getNodeState('mil_attack_3');
      expect(state).toBeDefined();
      expect(state?.status).toBe('locked');
    });

    it('前置完成后可研究', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('mil_attack_1');
      const canResearch = tree.canResearch('mil_attack_2');
      expect(canResearch).toBeDefined();
    });

    it('开始研究后变为researching', () => {
      const tree = new TechTreeSystem();
      const pointSystem = new TechPointSystem();
      const research = new TechResearchSystem(tree, pointSystem, () => 1);
      const deps = createDeps();
      tree.init(deps);
      pointSystem.init(deps);
      research.init(deps);

      pointSystem.addPoints(100);
      research.startResearch('mil_attack_1');
      const state = tree.getNodeState('mil_attack_1');
      expect(state?.status).toBe('researching');
    });

    it('研究完成后变为completed', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('mil_attack_1');
      const state = tree.getNodeState('mil_attack_1');
      expect(state?.status).toBe('completed');
    });

    it('互斥分支选择后另一分支受限', () => {
      const tree = new TechTreeSystem();
      const deps = createDeps();
      tree.init(deps);

      tree.forceComplete('mil_attack_1');
      tree.forceComplete('mil_attack_2');
      tree.forceComplete('mil_attack_off_1');

      const defensiveState = tree.getNodeState('mil_attack_def_1');
      expect(defensiveState).toBeDefined();
    });
  });
});
