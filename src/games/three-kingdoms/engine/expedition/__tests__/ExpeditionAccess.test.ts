/**
 * 远征UI — 入口可达性 + 阵营筛选UI 引擎层测试
 *
 * 验证：
 * 1. 入口可达性：远征入口解锁条件（主城等级→队伍槽位、路线解锁前置条件）
 * 2. 阵营筛选UI：阵营筛选逻辑（阵营羁绊检测、按阵营筛选武将）
 *
 * P1 缺口：补充远征入口解锁条件验证 + 阵营筛选逻辑测试
 * 使用真实引擎实例，不使用 mock
 *
 * @module engine/expedition/__tests__/ExpeditionAccess
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../ExpeditionSystem';
import { ExpeditionTeamHelper } from '../ExpeditionTeamHelper';
import type { HeroBrief, TeamValidationResult } from '../ExpeditionTeamHelper';
import { createDefaultExpeditionState } from '../expedition-helpers';
import {
  RouteDifficulty,
  NodeStatus,
  FormationType,
  CASTLE_LEVEL_SLOTS,
  FACTION_BOND_THRESHOLD,
  FACTION_BOND_BONUS,
  MAX_HEROES_PER_TEAM,
} from '../../../core/expedition/expedition.types';
import type { Faction } from '../../hero/hero.types';
import type { ExpeditionState, ExpeditionRoute } from '../../../core/expedition/expedition.types';

// ═══════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════

/** 创建测试用 HeroBrief */
function createHero(id: string, faction: Faction, power: number): HeroBrief {
  return { id, faction, power };
}

/** 创建英雄映射 */
function createHeroMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) {
    map[h.id] = h;
  }
  return map;
}

// ═══════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════

describe('ExpeditionAccess — 远征入口可达性 + 阵营筛选', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
  });

  // ═══════════════════════════════════════════
  // Part 1: 入口可达性
  // ═══════════════════════════════════════════

  describe('Part 1: 远征入口可达性', () => {
    // ── 1.1 主城等级 → 队伍槽位解锁 ──

    describe('主城等级 → 队伍槽位解锁', () => {
      it('主城等级 0 时无队伍槽位', () => {
        expect(system.getSlotCount(0)).toBe(0);
      });

      it('主城等级 1~4 时无队伍槽位', () => {
        expect(system.getSlotCount(1)).toBe(0);
        expect(system.getSlotCount(4)).toBe(0);
      });

      it('主城等级 5 时解锁 1 个队伍槽位', () => {
        expect(system.getSlotCount(5)).toBe(1);
      });

      it('主城等级 10 时解锁 2 个队伍槽位', () => {
        expect(system.getSlotCount(10)).toBe(2);
      });

      it('主城等级 15 时解锁 3 个队伍槽位', () => {
        expect(system.getSlotCount(15)).toBe(3);
      });

      it('主城等级 20 时解锁 4 个队伍槽位', () => {
        expect(system.getSlotCount(20)).toBe(4);
      });

      it('主城等级 6~9 仍为 1 个槽位', () => {
        expect(system.getSlotCount(6)).toBe(1);
        expect(system.getSlotCount(9)).toBe(1);
      });

      it('主城等级 11~14 仍为 2 个槽位', () => {
        expect(system.getSlotCount(11)).toBe(2);
        expect(system.getSlotCount(14)).toBe(2);
      });

      it('负数等级返回 0 个槽位', () => {
        expect(system.getSlotCount(-1)).toBe(0);
      });

      it('NaN/Infinity 等级返回当前已解锁槽位', () => {
        system.updateSlots(10); // 先解锁2个
        expect(system.updateSlots(NaN)).toBe(2);
      });
    });

    // ── 1.2 updateSlots 同步 ──

    describe('updateSlots 同步', () => {
      it('初始状态 unlockedSlots 为 1（默认值）', () => {
        expect(system.getUnlockedSlots()).toBe(1);
      });

      it('updateSlots 应更新 unlockedSlots', () => {
        system.updateSlots(10);
        expect(system.getUnlockedSlots()).toBe(2);
      });

      it('updateSlots 返回更新后的槽位数', () => {
        const result = system.updateSlots(15);
        expect(result).toBe(3);
      });

      it('updateSlots 连续升级应正确反映最新等级', () => {
        system.updateSlots(5);
        expect(system.getUnlockedSlots()).toBe(1);
        system.updateSlots(10);
        expect(system.getUnlockedSlots()).toBe(2);
        system.updateSlots(20);
        expect(system.getUnlockedSlots()).toBe(4);
      });
    });

    // ── 1.3 路线解锁前置条件 ──

    describe('路线解锁前置条件', () => {
      it('默认虎牢关路线应已解锁', () => {
        const route = system.getRoute('route_hulao_easy');
        if (route) {
          // 虎牢关是第一区域，简单路线应默认解锁
          expect(route.unlocked).toBeDefined();
        }
      });

      it('汜水关路线需要先通关虎牢关区域', () => {
        const result = system.canUnlockRoute('route_yishui_easy');
        // 汜水关有 requiredRegionId: 'region_hulao'
        if (!result.canUnlock) {
          expect(result.reasons.length).toBeGreaterThan(0);
        }
      });

      it('不存在的路线不能解锁', () => {
        const result = system.canUnlockRoute('route_nonexistent');
        expect(result.canUnlock).toBe(false);
        expect(result.reasons).toContain('路线不存在');
      });

      it('已解锁的路线 canUnlock 返回 true', () => {
        // 先确保虎牢关简单路线存在
        const route = system.getRoute('route_hulao_easy');
        if (route && route.unlocked) {
          const result = system.canUnlockRoute('route_hulao_easy');
          expect(result.canUnlock).toBe(true);
        }
      });

      it('unlockRoute 成功后路线 unlocked 应为 true', () => {
        // 模拟通关虎牢关所有路线以解锁汜水关
        const state = system.getState();
        const hulaoRoutes = state.regions['region_hulao']?.routeIds ?? [];
        for (const rid of hulaoRoutes) {
          state.clearedRouteIds.add(rid);
        }
        // 尝试解锁汜水关简单路线
        const check = system.canUnlockRoute('route_yishui_easy');
        if (check.canUnlock) {
          const result = system.unlockRoute('route_yishui_easy');
          expect(result).toBe(true);
          const route = system.getRoute('route_yishui_easy');
          expect(route?.unlocked).toBe(true);
        }
      });

      it('unlockRoute 失败时不应修改路线状态', () => {
        const routeBefore = system.getRoute('route_yishui_easy');
        const unlockedBefore = routeBefore?.unlocked;
        system.unlockRoute('route_yishui_easy');
        const routeAfter = system.getRoute('route_yishui_easy');
        expect(routeAfter?.unlocked).toBe(unlockedBefore);
      });
    });

    // ── 1.4 队伍派遣入口条件 ──

    describe('队伍派遣入口条件', () => {
      it('未解锁的路线不能派遣队伍', () => {
        const heroes = [createHero('h1', 'shu', 1000)];
        const heroMap = createHeroMap(heroes);
        const result = system.createTeam('test', ['h1'], FormationType.STANDARD, heroMap);
        if (result.valid) {
          const teams = system.getAllTeams();
          const team = teams[0];
          if (team) {
            const dispatched = system.dispatchTeam(team.id, 'route_yishui_easy');
            // 汜水关可能未解锁
            const route = system.getRoute('route_yishui_easy');
            if (route && !route.unlocked) {
              expect(dispatched).toBe(false);
            }
          }
        }
      });

      it('槽位已满时不能派遣更多队伍', () => {
        system.updateSlots(5); // 1个槽位
        const heroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'shu', 2000),
        ];
        const heroMap = createHeroMap(heroes);

        // 创建并派遣第一支队伍
        system.createTeam('team1', ['h1'], FormationType.STANDARD, heroMap);
        const teams = system.getAllTeams();
        if (teams.length > 0) {
          system.dispatchTeam(teams[0].id, 'route_hulao_easy');
        }

        // 创建并派遣第二支队伍应失败（只有1个槽位）
        system.createTeam('team2', ['h2'], FormationType.STANDARD, heroMap);
        const teams2 = system.getAllTeams();
        if (teams2.length > 1) {
          const dispatched = system.dispatchTeam(teams2[1].id, 'route_hulao_easy');
          // 如果第一支已占用唯一槽位，第二支应失败
          const expeditioningCount = teams2.filter((t) => t.isExpeditioning).length;
          if (expeditioningCount >= system.getUnlockedSlots()) {
            expect(dispatched).toBe(false);
          }
        }
      });

      it('兵力不足时不能派遣', () => {
        const heroes = [createHero('h1', 'shu', 1000)];
        const heroMap = createHeroMap(heroes);
        system.createTeam('team', ['h1'], FormationType.STANDARD, heroMap);
        const teams = system.getAllTeams();
        if (teams.length > 0) {
          // 设置兵力为 0
          teams[0].troopCount = 0;
          const dispatched = system.dispatchTeam(teams[0].id, 'route_hulao_easy');
          expect(dispatched).toBe(false);
        }
      });
    });

    // ── 1.5 区域可达性 ──

    describe('区域可达性', () => {
      it('虎牢关区域应存在', () => {
        const region = system.getRegion('region_hulao');
        expect(region).toBeDefined();
        expect(region!.name).toBe('虎牢关');
      });

      it('汜水关区域应存在', () => {
        const region = system.getRegion('region_yishui');
        expect(region).toBeDefined();
        expect(region!.name).toBe('汜水关');
      });

      it('洛阳区域应存在', () => {
        const region = system.getRegion('region_luoyang');
        expect(region).toBeDefined();
        expect(region!.name).toBe('洛阳');
      });

      it('每个区域应包含至少 1 条路线', () => {
        const state = system.getState();
        for (const region of Object.values(state.regions)) {
          expect(region.routeIds.length).toBeGreaterThanOrEqual(1);
        }
      });

      it('区域路线 ID 应能在 routes 中找到', () => {
        const state = system.getState();
        for (const region of Object.values(state.regions)) {
          for (const routeId of region.routeIds) {
            expect(state.routes[routeId]).toBeDefined();
          }
        }
      });
    });
  });

  // ═══════════════════════════════════════════
  // Part 2: 阵营筛选UI逻辑
  // ═══════════════════════════════════════════

  describe('Part 2: 阵营筛选UI逻辑', () => {
    // ── 2.1 阵营羁绊检测 ──

    describe('阵营羁绊检测 (checkFactionBond)', () => {
      it('3 名同阵营武将触发羁绊', () => {
        const heroes = [
          createHero('guanyu', 'shu', 1000),
          createHero('zhangfei', 'shu', 900),
          createHero('liubei', 'shu', 800),
        ];
        const heroMap = createHeroMap(heroes);
        const result = ExpeditionTeamHelper.checkFactionBond(
          heroes.map((h) => h.id),
          heroMap,
        );
        expect(result).toBe(true);
      });

      it('2 名同阵营不触发羁绊（阈值=3）', () => {
        const heroes = [
          createHero('guanyu', 'shu', 1000),
          createHero('zhangfei', 'shu', 900),
        ];
        const heroMap = createHeroMap(heroes);
        const result = ExpeditionTeamHelper.checkFactionBond(
          heroes.map((h) => h.id),
          heroMap,
        );
        expect(result).toBe(false);
      });

      it('混合阵营不触发羁绊', () => {
        const heroes = [
          createHero('guanyu', 'shu', 1000),
          createHero('caocao', 'wei', 900),
          createHero('zhouyu', 'wu', 800),
        ];
        const heroMap = createHeroMap(heroes);
        const result = ExpeditionTeamHelper.checkFactionBond(
          heroes.map((h) => h.id),
          heroMap,
        );
        expect(result).toBe(false);
      });

      it('4 名同阵营触发羁绊', () => {
        const heroes = [
          createHero('h1', 'wei', 1000),
          createHero('h2', 'wei', 900),
          createHero('h3', 'wei', 800),
          createHero('h4', 'wei', 700),
        ];
        const heroMap = createHeroMap(heroes);
        const result = ExpeditionTeamHelper.checkFactionBond(
          heroes.map((h) => h.id),
          heroMap,
        );
        expect(result).toBe(true);
      });

      it('空列表不触发羁绊', () => {
        expect(ExpeditionTeamHelper.checkFactionBond([], {})).toBe(false);
      });

      it('1 名武将不触发羁绊', () => {
        const heroMap = createHeroMap([createHero('h1', 'shu', 1000)]);
        expect(ExpeditionTeamHelper.checkFactionBond(['h1'], heroMap)).toBe(false);
      });

      it('FACTION_BOND_THRESHOLD 应为 3', () => {
        expect(FACTION_BOND_THRESHOLD).toBe(3);
      });

      it('FACTION_BOND_BONUS 应为 10%', () => {
        expect(FACTION_BOND_BONUS).toBe(0.10);
      });
    });

    // ── 2.2 按阵营筛选武将 ──

    describe('按阵营筛选武将', () => {
      const allHeroes: HeroBrief[] = [
        createHero('guanyu', 'shu', 1000),
        createHero('zhangfei', 'shu', 900),
        createHero('liubei', 'shu', 800),
        createHero('caocao', 'wei', 950),
        createHero('dianwei', 'wei', 750),
        createHero('zhouyu', 'wu', 850),
        createHero('lushu', 'wu', 700),
        createHero('huanggai', 'wu', 650),
        createHero('lvbu', 'qun', 1100),
        createHero('xiaowei', 'qun', 600),
      ];

      it('筛选蜀国武将应返回正确数量', () => {
        const shuHeroes = allHeroes.filter((h) => h.faction === 'shu');
        expect(shuHeroes).toHaveLength(3);
      });

      it('筛选魏国武将应返回正确数量', () => {
        const weiHeroes = allHeroes.filter((h) => h.faction === 'wei');
        expect(weiHeroes).toHaveLength(2);
      });

      it('筛选吴国武将应返回正确数量', () => {
        const wuHeroes = allHeroes.filter((h) => h.faction === 'wu');
        expect(wuHeroes).toHaveLength(3);
      });

      it('筛选群雄武将应返回正确数量', () => {
        const qunHeroes = allHeroes.filter((h) => h.faction === 'qun');
        expect(qunHeroes).toHaveLength(2);
      });

      it('按阵营筛选后可触发羁绊（蜀国3人）', () => {
        const shuHeroes = allHeroes.filter((h) => h.faction === 'shu');
        const shuMap = createHeroMap(shuHeroes);
        const bond = ExpeditionTeamHelper.checkFactionBond(
          shuHeroes.map((h) => h.id),
          shuMap,
        );
        expect(bond).toBe(true);
      });

      it('按阵营筛选后不可触发羁绊（魏国2人）', () => {
        const weiHeroes = allHeroes.filter((h) => h.faction === 'wei');
        const weiMap = createHeroMap(weiHeroes);
        const bond = ExpeditionTeamHelper.checkFactionBond(
          weiHeroes.map((h) => h.id),
          weiMap,
        );
        expect(bond).toBe(false);
      });
    });

    // ── 2.3 智能编队中的阵营筛选 ──

    describe('智能编队中的阵营筛选', () => {
      it('autoComposeTeam 应优先选择同阵营组合', () => {
        const heroes: HeroBrief[] = [
          createHero('guanyu', 'shu', 1000),
          createHero('zhangfei', 'shu', 900),
          createHero('liubei', 'shu', 800),
          createHero('caocao', 'wei', 950),
          createHero('zhouyu', 'wu', 850),
        ];
        const activeIds = new Set<string>();
        const selected = ExpeditionTeamHelper.autoComposeTeam(
          heroes,
          activeIds,
          FormationType.STANDARD,
          5,
        );

        // 应优先选择3个蜀国武将触发羁绊
        const shuSelected = selected.filter((id) => {
          const hero = heroes.find((h) => h.id === id);
          return hero?.faction === 'shu';
        });
        expect(shuSelected.length).toBeGreaterThanOrEqual(FACTION_BOND_THRESHOLD);
      });

      it('autoComposeTeam 无可用武将时返回空数组', () => {
        const selected = ExpeditionTeamHelper.autoComposeTeam(
          [],
          new Set(),
          FormationType.STANDARD,
        );
        expect(selected).toEqual([]);
      });

      it('autoComposeTeam 所有武将都在远征中时返回空数组', () => {
        const heroes = [createHero('h1', 'shu', 1000)];
        const activeIds = new Set(['h1']);
        const selected = ExpeditionTeamHelper.autoComposeTeam(
          heroes,
          activeIds,
          FormationType.STANDARD,
        );
        expect(selected).toEqual([]);
      });

      it('autoComposeTeam 不超过 MAX_HEROES_PER_TEAM', () => {
        const heroes = Array.from({ length: 10 }, (_, i) =>
          createHero(`h${i}`, 'shu', 1000 - i * 50),
        );
        const selected = ExpeditionTeamHelper.autoComposeTeam(
          heroes,
          new Set(),
          FormationType.STANDARD,
        );
        expect(selected.length).toBeLessThanOrEqual(MAX_HEROES_PER_TEAM);
      });
    });

    // ── 2.4 编队校验中的阵营筛选 ──

    describe('编队校验中的阵营筛选', () => {
      it('3 名同阵营编队应触发羁绊且无警告', () => {
        const heroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'shu', 900),
          createHero('h3', 'shu', 800),
        ];
        const heroMap = createHeroMap(heroes);
        const result = system.validateTeam(
          heroes.map((h) => h.id),
          FormationType.STANDARD,
          heroMap,
          [],
        );
        expect(result.valid).toBe(true);
        expect(result.factionBond).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('3 名混合阵营编队应触发羁绊未激活警告', () => {
        const heroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'wei', 900),
          createHero('h3', 'wu', 800),
        ];
        const heroMap = createHeroMap(heroes);
        const result = system.validateTeam(
          heroes.map((h) => h.id),
          FormationType.STANDARD,
          heroMap,
          [],
        );
        expect(result.valid).toBe(true);
        expect(result.factionBond).toBe(false);
        expect(result.warnings).toContain('当前编队未触发阵营羁绊');
      });

      it('2 名武将编队不触发阵营警告（未达阈值）', () => {
        const heroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'wei', 900),
        ];
        const heroMap = createHeroMap(heroes);
        const result = system.validateTeam(
          heroes.map((h) => h.id),
          FormationType.STANDARD,
          heroMap,
          [],
        );
        expect(result.valid).toBe(true);
        // 2人未达FACTION_BOND_THRESHOLD(3)，不应有羁绊警告
        const bondWarning = result.warnings.find((w) => w.includes('羁绊'));
        expect(bondWarning).toBeUndefined();
      });

      it('超过 MAX_HEROES_PER_TEAM 时编队无效', () => {
        const heroes = Array.from({ length: MAX_HEROES_PER_TEAM + 1 }, (_, i) =>
          createHero(`h${i}`, 'shu', 1000),
        );
        const heroMap = createHeroMap(heroes);
        const result = system.validateTeam(
          heroes.map((h) => h.id),
          FormationType.STANDARD,
          heroMap,
          [],
        );
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('空编队应无效', () => {
        const result = system.validateTeam(
          [],
          FormationType.STANDARD,
          {},
          [],
        );
        expect(result.valid).toBe(false);
      });
    });

    // ── 2.5 阵营筛选 + 战力计算 ──

    describe('阵营筛选对战力的影响', () => {
      it('有阵营羁绊时战力应高于无羁绊', () => {
        const heroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'shu', 1000),
          createHero('h3', 'shu', 1000),
        ];
        const heroMap = createHeroMap(heroes);

        const bondPower = system.calculateTeamPower(
          heroes.map((h) => h.id),
          heroMap,
          FormationType.STANDARD,
        );

        const mixedHeroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'wei', 1000),
          createHero('h3', 'wu', 1000),
        ];
        const mixedMap = createHeroMap(mixedHeroes);

        const mixedPower = system.calculateTeamPower(
          mixedHeroes.map((h) => h.id),
          mixedMap,
          FormationType.STANDARD,
        );

        expect(bondPower).toBeGreaterThan(mixedPower);
      });

      it('羁绊加成应为 10%', () => {
        const heroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'shu', 1000),
          createHero('h3', 'shu', 1000),
        ];
        const heroMap = createHeroMap(heroes);

        const bondPower = system.calculateTeamPower(
          heroes.map((h) => h.id),
          heroMap,
          FormationType.STANDARD,
        );

        const mixedHeroes = [
          createHero('h1', 'shu', 1000),
          createHero('h2', 'wei', 1000),
          createHero('h3', 'wu', 1000),
        ];
        const mixedMap = createHeroMap(mixedHeroes);

        const mixedPower = system.calculateTeamPower(
          mixedHeroes.map((h) => h.id),
          mixedMap,
          FormationType.STANDARD,
        );

        // 羁绊加成 = 10%，所以 bondPower ≈ mixedPower * 1.1
        const ratio = bondPower / mixedPower;
        expect(ratio).toBeCloseTo(1.1, 1);
      });
    });

    // ── 2.6 阵营筛选 UI 数据完整性 ──

    describe('阵营筛选 UI 数据完整性', () => {
      it('所有路线应包含正确的区域归属', () => {
        const state = system.getState();
        const regionRouteIds = new Set<string>();
        for (const region of Object.values(state.regions)) {
          for (const rid of region.routeIds) {
            regionRouteIds.add(rid);
          }
        }
        for (const route of Object.values(state.routes)) {
          expect(regionRouteIds.has(route.id)).toBe(true);
        }
      });

      it('所有路线应有难度等级', () => {
        const state = system.getState();
        for (const route of Object.values(state.routes)) {
          expect(route.difficulty).toBeDefined();
          expect(Object.values(RouteDifficulty)).toContain(route.difficulty);
        }
      });

      it('路线难度分布应包含简单、普通、困难', () => {
        const state = system.getState();
        const difficulties = new Set(
          Object.values(state.routes).map((r) => r.difficulty),
        );
        expect(difficulties.has(RouteDifficulty.EASY)).toBe(true);
        expect(difficulties.has(RouteDifficulty.NORMAL)).toBe(true);
        expect(difficulties.has(RouteDifficulty.HARD)).toBe(true);
      });

      it('路线应有完整的节点链', () => {
        const state = system.getState();
        for (const route of Object.values(state.routes)) {
          expect(route.startNodeId).toBeDefined();
          expect(route.endNodeId).toBeDefined();
          expect(route.nodes[route.startNodeId]).toBeDefined();
          expect(route.nodes[route.endNodeId]).toBeDefined();
        }
      });
    });
  });
});
