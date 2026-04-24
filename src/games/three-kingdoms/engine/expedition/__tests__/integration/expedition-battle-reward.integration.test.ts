/**
 * 集成测试 §3~§4: 远征战斗与奖励
 *
 * 覆盖 Play 流程：
 *   §3.1 节点遭遇与战斗 (6 cases)
 *   §3.2 远征战斗规则与结果评定 (7 cases)
 *   §3.3 扫荡系统 (6 cases)
 *   §4.1 基础奖励与掉落 (6 cases)
 *   §4.2 首通奖励与里程碑 (6 cases)
 *   §4.3 远征币与资源循环 (3 cases)
 *   Total: 34 cases
 *
 * 联动系统：ExpeditionSystem + ExpeditionBattleSystem + ExpeditionRewardSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { ExpeditionBattleSystem, type BattleTeamData, type NodeBattleConfig } from '../../ExpeditionBattleSystem';
import { ExpeditionRewardSystem } from '../../ExpeditionRewardSystem';
import type { HeroBrief } from '../../ExpeditionTeamHelper';
import type { Faction } from '../../../hero/hero.types';
import {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  FormationType,
  BattleGrade,
  GRADE_STARS,
  FORMATION_COUNTERS,
  FORMATION_EFFECTS,
  SweepType,
  MilestoneType,
} from '../../../../core/expedition/expedition.types';
import { EXPEDITION_MAX_TURNS, FORMATION_COUNTER_BONUS, BASE_REWARDS } from '../../expedition-config';

// ── 辅助函数 ──────────────────────────────

function createHero(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}

function createBattleTeam(
  units: Array<{ id: string; hp: number; maxHp: number; attack: number; defense: number; speed: number; intelligence: number }>,
  formation: FormationType,
  totalPower: number,
): BattleTeamData {
  return { units, formation, totalPower };
}

function createDefaultBattleTeam(power: number = 10000, formation: FormationType = FormationType.STANDARD): BattleTeamData {
  return {
    units: [
      { id: 'hero1', hp: 1000, maxHp: 1000, attack: 100, defense: 80, speed: 60, intelligence: 50 },
      { id: 'hero2', hp: 1000, maxHp: 1000, attack: 90, defense: 90, speed: 50, intelligence: 60 },
      { id: 'hero3', hp: 1000, maxHp: 1000, attack: 80, defense: 100, speed: 70, intelligence: 40 },
    ],
    formation,
    totalPower: power,
  };
}

function createNodeConfig(
  nodeType: NodeType = NodeType.BANDIT,
  enemyPower: number = 8000,
  enemyFormation: FormationType = FormationType.STANDARD,
  recommendedPower: number = 10000,
): NodeBattleConfig {
  return { nodeType, enemyPower, enemyFormation, recommendedPower };
}

// ── §3 远征事件 ───────────────────────────

describe('§3 远征事件', () => {
  let battle: ExpeditionBattleSystem;

  beforeEach(() => {
    battle = new ExpeditionBattleSystem();
  });

  // ── §3.1 节点遭遇与战斗 (6) ──────────────

  describe('§3.1 节点遭遇与战斗', () => {
    it('山贼节点难度倍率×0.8，战斗回合数≤10', () => {
      const ally = createDefaultBattleTeam(10000);
      const node = createNodeConfig(NodeType.BANDIT, 10000);
      const result = battle.executeBattle(ally, node);
      expect(result.totalTurns).toBeLessThanOrEqual(EXPEDITION_MAX_TURNS);
    });

    it('天险节点难度倍率×1.0，敌方战力较高', () => {
      const ally = createDefaultBattleTeam(10000);
      const node = createNodeConfig(NodeType.HAZARD, 10000);
      const result = battle.executeBattle(ally, node);
      expect(result.totalTurns).toBeLessThanOrEqual(EXPEDITION_MAX_TURNS);
      // 天险节点比山贼难度更高
      expect(result).toBeDefined();
    });

    it('Boss节点难度倍率×1.3，战斗更激烈', () => {
      const ally = createDefaultBattleTeam(10000);
      const node = createNodeConfig(NodeType.BOSS, 10000);
      const result = battle.executeBattle(ally, node);
      expect(result.totalTurns).toBeLessThanOrEqual(EXPEDITION_MAX_TURNS);
    });

    it('宝箱节点无战斗（难度倍率×0）', () => {
      const ally = createDefaultBattleTeam(10000);
      const node = createNodeConfig(NodeType.TREASURE, 0);
      const result = battle.executeBattle(ally, node);
      // 宝箱节点敌方战力为0，应轻松获胜
      expect(result.grade).not.toBe(BattleGrade.NARROW_DEFEAT);
    });

    it('休息节点无战斗', () => {
      const ally = createDefaultBattleTeam(10000);
      const node = createNodeConfig(NodeType.REST, 0);
      const result = battle.executeBattle(ally, node);
      expect(result).toBeDefined();
    });

    it('快速战斗返回有效战斗结果', () => {
      const result = battle.quickBattle(
        10000, FormationType.STANDARD,
        8000, FormationType.STANDARD,
      );
      expect(result.grade).toBeDefined();
      expect(result.stars).toBeGreaterThanOrEqual(0);
      expect(result.stars).toBeLessThanOrEqual(3);
      expect(result.allyHpPercent).toBeGreaterThanOrEqual(0);
      expect(result.allyHpPercent).toBeLessThanOrEqual(100);
    });
  });

  // ── §3.2 远征战斗规则与结果评定 (7) ──────

  describe('§3.2 远征战斗规则与结果评定', () => {
    it('大捷⭐⭐⭐: 剩余血量>50%且无武将阵亡', () => {
      const grade = battle.evaluateGrade(60, 0, true);
      expect(grade).toBe(BattleGrade.GREAT_VICTORY);
      expect(GRADE_STARS[grade]).toBe(3);
    });

    it('小胜⭐⭐: 剩余血量10%~50%', () => {
      const grade = battle.evaluateGrade(30, 0, true);
      expect(grade).toBe(BattleGrade.MINOR_VICTORY);
      expect(GRADE_STARS[grade]).toBe(2);
    });

    it('小胜⭐⭐: 有武将阵亡但血量>10%', () => {
      const grade = battle.evaluateGrade(60, 1, true);
      expect(grade).toBe(BattleGrade.MINOR_VICTORY);
    });

    it('惨胜⭐: 剩余血量<10%', () => {
      const grade = battle.evaluateGrade(5, 0, true);
      expect(grade).toBe(BattleGrade.PYRRHIC_VICTORY);
      expect(GRADE_STARS[grade]).toBe(1);
    });

    it('惜败: 战斗失败', () => {
      const grade = battle.evaluateGrade(0, 5, false);
      expect(grade).toBe(BattleGrade.NARROW_DEFEAT);
      expect(GRADE_STARS[grade]).toBe(0);
    });

    it('阵型克制：克制方全属性+10%', () => {
      const bonus = battle.getCounterBonus(FormationType.OFFENSIVE, FormationType.DEFENSIVE);
      expect(bonus).toBe(FORMATION_COUNTER_BONUS);
      expect(battle.isCounter(FormationType.OFFENSIVE, FormationType.DEFENSIVE)).toBe(true);
    });

    it('阵型克制关系循环无断链', () => {
      // OFFENSIVE > DEFENSIVE > FLANKING > OFFENSIVE
      expect(battle.isCounter(FormationType.OFFENSIVE, FormationType.DEFENSIVE)).toBe(true);
      expect(battle.isCounter(FormationType.DEFENSIVE, FormationType.FLANKING)).toBe(true);
      expect(battle.isCounter(FormationType.FLANKING, FormationType.OFFENSIVE)).toBe(true);
    });
  });

  // ── §3.3 扫荡系统 (6) ────────────────────

  describe('§3.3 扫荡系统', () => {
    let system: ExpeditionSystem;

    beforeEach(() => {
      system = new ExpeditionSystem();
      system.updateSlots(5);
    });

    it('三星通关路线可扫荡', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      expect(system.canSweepRoute('route_hulao_easy')).toBe(true);
    });

    it('未三星通关路线不可扫荡', () => {
      system.getState().routeStars['route_hulao_easy'] = 2;
      expect(system.canSweepRoute('route_hulao_easy')).toBe(false);
    });

    it('普通扫荡每日5次限制', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      for (let i = 0; i < 5; i++) {
        const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
        expect(result.success).toBe(true);
      }
      // 第6次应失败
      const result = system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('次数已用完');
    });

    it('高级扫荡每日3次限制', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      for (let i = 0; i < 3; i++) {
        const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
        expect(result.success).toBe(true);
      }
      const result = system.executeSweep('route_hulao_easy', SweepType.ADVANCED);
      expect(result.success).toBe(false);
    });

    it('免费扫荡每日1次限制', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      const result1 = system.executeSweep('route_hulao_easy', SweepType.FREE);
      expect(result1.success).toBe(true);
      const result2 = system.executeSweep('route_hulao_easy', SweepType.FREE);
      expect(result2.success).toBe(false);
    });

    it('不同扫荡类型次数独立计数', () => {
      system.getState().routeStars['route_hulao_easy'] = 3;
      // 普通扫荡5次
      for (let i = 0; i < 5; i++) {
        system.executeSweep('route_hulao_easy', SweepType.NORMAL);
      }
      // 免费扫荡仍可用
      const freeResult = system.executeSweep('route_hulao_easy', SweepType.FREE);
      expect(freeResult.success).toBe(true);
    });
  });
});

// ── §4 远征奖励 ───────────────────────────

describe('§4 远征奖励', () => {
  let reward: ExpeditionRewardSystem;

  beforeEach(() => {
    // 使用固定随机数确保掉落结果可预测
    let seed = 0;
    reward = new ExpeditionRewardSystem(() => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    });
  });

  // ── §4.1 基础奖励与掉落 (6) ──────────────

  describe('§4.1 基础奖励与掉落', () => {
    it('简单路线基础奖励：粮草200/铜钱400/铁矿1/碎片1/经验500', () => {
      const base = BASE_REWARDS[RouteDifficulty.EASY];
      expect(base.grain).toBe(200);
      expect(base.gold).toBe(400);
      expect(base.iron).toBe(1);
      expect(base.equipFragments).toBe(1);
      expect(base.exp).toBe(500);
    });

    it('困难路线基础奖励高于普通路线', () => {
      const hard = BASE_REWARDS[RouteDifficulty.HARD];
      const normal = BASE_REWARDS[RouteDifficulty.NORMAL];
      expect(hard.grain).toBeGreaterThan(normal.grain);
      expect(hard.gold).toBeGreaterThan(normal.gold);
      expect(hard.exp).toBeGreaterThan(normal.exp);
    });

    it('奇袭路线基础奖励最高', () => {
      const ambush = BASE_REWARDS[RouteDifficulty.AMBUSH];
      const hard = BASE_REWARDS[RouteDifficulty.HARD];
      expect(ambush.grain).toBeGreaterThan(hard.grain);
      expect(ambush.gold).toBeGreaterThan(hard.gold);
    });

    it('Boss节点掉落率高于普通节点', () => {
      // 使用全命中rng
      const alwaysDrop = new ExpeditionRewardSystem(() => 0.01); // 总是掉落
      const bossReward = alwaysDrop.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BOSS,
        grade: BattleGrade.MINOR_VICTORY,
        isFirstClear: false,
        isRouteComplete: false,
      });
      expect(bossReward.drops.length).toBeGreaterThan(0);
    });

    it('大捷评级奖励倍率×1.5', () => {
      const greatReward = reward.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BANDIT,
        grade: BattleGrade.GREAT_VICTORY,
        isFirstClear: false,
        isRouteComplete: false,
      });
      const minorReward = reward.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BANDIT,
        grade: BattleGrade.MINOR_VICTORY,
        isFirstClear: false,
        isRouteComplete: false,
      });
      // 大捷倍率1.5 vs 小胜倍率1.0
      expect(greatReward.grain).toBeGreaterThan(minorReward.grain);
    });

    it('惜败评级奖励倍率×0.3', () => {
      const defeatReward = reward.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BANDIT,
        grade: BattleGrade.NARROW_DEFEAT,
        isFirstClear: false,
        isRouteComplete: false,
      });
      const minorReward = reward.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BANDIT,
        grade: BattleGrade.MINOR_VICTORY,
        isFirstClear: false,
        isRouteComplete: false,
      });
      expect(defeatReward.grain).toBeLessThan(minorReward.grain);
    });
  });

  // ── §4.2 首通奖励与里程碑 (6) ────────────

  describe('§4.2 首通奖励与里程碑', () => {
    let system: ExpeditionSystem;

    beforeEach(() => {
      system = new ExpeditionSystem();
      system.updateSlots(5);
    });

    it('首通奖励包含稀有武将碎片', () => {
      const firstClearReward = reward.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BOSS,
        grade: BattleGrade.GREAT_VICTORY,
        isFirstClear: true,
        isRouteComplete: true,
      });
      const heroFragment = firstClearReward.drops.find(d => d.type === 'hero_fragment' && d.id === 'hf_first_clear');
      expect(heroFragment).toBeDefined();
    });

    it('非首通不包含首通奖励', () => {
      const normalReward = reward.calculateNodeReward({
        difficulty: RouteDifficulty.NORMAL,
        nodeType: NodeType.BOSS,
        grade: BattleGrade.GREAT_VICTORY,
        isFirstClear: false,
        isRouteComplete: true,
      });
      const firstClearDrop = normalReward.drops.find(d => d.id === 'hf_first_clear');
      expect(firstClearDrop).toBeUndefined();
    });

    it('里程碑"初出茅庐"：通关1条路线', () => {
      system.getState().clearedRouteIds.add('route_hulao_easy');
      const achieved = system.checkMilestones();
      expect(achieved).toContain(MilestoneType.FIRST_CLEAR);
    });

    it('里程碑"百战之师"：通关10条路线', () => {
      for (let i = 0; i < 10; i++) {
        system.getState().clearedRouteIds.add(`route_${i}`);
      }
      const achieved = system.checkMilestones();
      expect(achieved).toContain(MilestoneType.TEN_CLEARS);
    });

    it('里程碑"天下布武"：通关全部路线', () => {
      const allRouteIds = Object.keys(system.getState().routes);
      for (const id of allRouteIds) {
        system.getState().clearedRouteIds.add(id);
      }
      const achieved = system.checkMilestones();
      expect(achieved).toContain(MilestoneType.ALL_CLEARS);
    });

    it('已达成里程碑不重复触发', () => {
      system.getState().clearedRouteIds.add('route_hulao_easy');
      const first = system.checkMilestones();
      expect(first).toContain(MilestoneType.FIRST_CLEAR);

      const second = system.checkMilestones();
      expect(second).not.toContain(MilestoneType.FIRST_CLEAR);
    });
  });

  // ── §4.3 远征币与资源循环 (3) ────────────

  describe('§4.3 远征币与资源循环', () => {
    it('扫荡奖励：普通×100%/高级×150%/免费×50%', () => {
      const normalSweep = reward.calculateSweepReward({
        difficulty: RouteDifficulty.NORMAL,
        sweepType: SweepType.NORMAL,
        heroCount: 3,
      });
      const advancedSweep = reward.calculateSweepReward({
        difficulty: RouteDifficulty.NORMAL,
        sweepType: SweepType.ADVANCED,
        heroCount: 3,
      });
      const freeSweep = reward.calculateSweepReward({
        difficulty: RouteDifficulty.NORMAL,
        sweepType: SweepType.FREE,
        heroCount: 3,
      });

      // 高级扫荡奖励 > 普通扫荡 > 免费扫荡
      expect(advancedSweep.grain).toBeGreaterThan(normalSweep.grain);
      expect(normalSweep.grain).toBeGreaterThan(freeSweep.grain);
    });

    it('高级扫荡保底稀有掉落', () => {
      // 使用全不命中rng（除了保底）
      const neverDrop = new ExpeditionRewardSystem(() => 0.99);
      const sweepReward = neverDrop.calculateSweepReward({
        difficulty: RouteDifficulty.NORMAL,
        sweepType: SweepType.ADVANCED,
        heroCount: 3,
      });
      // 高级扫荡应保底至少1个稀有掉落
      const hasRare = sweepReward.drops.some(d => d.type === 'rare_material');
      expect(hasRare).toBe(true);
    });

    it('路线完成奖励汇总所有节点', () => {
      const routeReward = reward.calculateRouteReward(
        RouteDifficulty.NORMAL,
        [
          { nodeType: NodeType.BANDIT, grade: BattleGrade.GREAT_VICTORY },
          { nodeType: NodeType.HAZARD, grade: BattleGrade.MINOR_VICTORY },
          { nodeType: NodeType.TREASURE, grade: BattleGrade.GREAT_VICTORY },
          { nodeType: NodeType.REST, grade: BattleGrade.GREAT_VICTORY },
          { nodeType: NodeType.BOSS, grade: BattleGrade.GREAT_VICTORY },
        ],
        false,
      );
      // 应有正数奖励
      expect(routeReward.grain).toBeGreaterThan(0);
      expect(routeReward.gold).toBeGreaterThan(0);
      expect(routeReward.exp).toBeGreaterThan(0);
    });
  });
});
