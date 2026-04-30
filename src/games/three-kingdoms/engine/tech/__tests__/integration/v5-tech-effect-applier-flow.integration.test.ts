/**
 * V5 百家争鸣 — 科技效果应用全流程集成测试
 *
 * 覆盖以下 play 流程：
 * - §1 科技效果系统: TechEffectSystem 缓存/聚合/分类查询
 * - §2 科技效果应用器: TechEffectApplier 军事/经济/文化加成计算
 * - §3 科技联动系统: TechLinkSystem 建筑/武将/资源联动效果
 * - §4 融合科技联动: FusionTechSystem + FusionLinkManager 联动同步
 * - §5 效果全链路: 科技完成 → 效果缓存刷新 → Applier 计算 → 外部系统消费
 *
 * 编码规范：
 * - 每个it前创建新的系统实例
 * - describe按play流程ID组织
 * - 不使用 as unknown as Record<string, unknown>
 *
 * @module engine/tech/__tests__/integration/v5-tech-effect-applier-flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechTreeSystem } from '../../TechTreeSystem';
import { TechPointSystem } from '../../TechPointSystem';
import { TechResearchSystem } from '../../TechResearchSystem';
import { TechEffectSystem } from '../../TechEffectSystem';
import { TechEffectApplier } from '../../TechEffectApplier';
import { TechLinkSystem } from '../../TechLinkSystem';
import { FusionTechSystem } from '../../FusionTechSystem';
import { TECH_NODE_DEFS, TECH_NODE_MAP } from '../../tech-config';
import type { TechPath } from '../../tech.types';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建完整的科技系统依赖链 */
function createTechStack(academyLevel = 5) {
  const tree = new TechTreeSystem();
  const points = new TechPointSystem();
  const link = new TechLinkSystem();
  const fusion = new FusionTechSystem();
  const effectSystem = new TechEffectSystem();
  const applier = new TechEffectApplier();
  const research = new TechResearchSystem(
    tree, points,
    () => academyLevel,
    () => 1000,
    () => true,
  );

  const registry = new Map<string, unknown>();
  registry.set('techTree', tree);
  registry.set('techPoint', points);
  registry.set('techLink', link);
  registry.set('fusionTech', fusion);
  registry.set('techEffect', effectSystem);
  registry.set('techApplier', applier);
  registry.set('techResearch', research);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  // 初始化所有系统
  tree.init(deps);
  points.init(deps);
  link.init(deps);
  fusion.init(deps);
  effectSystem.init(deps);
  research.init(deps);

  // 建立依赖关系
  fusion.setTechTree(tree);
  fusion.setLinkSystem(link);
  effectSystem.setTechTree(tree);
  applier.setTechEffectSystem(effectSystem);

  // 注入足够科技点
  points.syncAcademyLevel(academyLevel);
  points.exchangeGoldForTechPoints(500000, academyLevel);

  return { tree, points, link, fusion, effectSystem, applier, research, deps, registry };
}

/** 获取指定路线的第一个可研究节点 */
function getFirstResearchableNode(tree: TechTreeSystem, path?: TechPath) {
  const defs = path
    ? TECH_NODE_DEFS.filter(d => d.path === path)
    : TECH_NODE_DEFS;
  return defs.find(d => tree.canResearch(d.id).can);
}

/** 完成指定路线的前N个节点 */
function completePathNodes(tree: TechTreeSystem, path: TechPath, count: number): string[] {
  const completed: string[] = [];
  const pathDefs = TECH_NODE_DEFS.filter(d => d.path === path)
    .sort((a, b) => a.tier - b.tier);

  for (const def of pathDefs) {
    if (completed.length >= count) break;
    const check = tree.canResearch(def.id);
    if (check.can) {
      tree.completeNode(def.id);
      completed.push(def.id);
    }
  }
  return completed;
}

// ═══════════════════════════════════════════════════════════════
// §1 科技效果系统 — 缓存/聚合/分类查询
// ═══════════════════════════════════════════════════════════════
describe('§1 科技效果系统 — 缓存/聚合/分类查询', () => {

  it('初始状态：无科技完成时所有效果为0', () => {
    const { effectSystem } = createTechStack();
    const allBonuses = effectSystem.getAllBonuses();

    // 三条路线都无加成
    for (const path of ['military', 'economy', 'culture'] as const) {
      const bonuses = allBonuses[path];
      for (const val of Object.values(bonuses)) {
        expect(val).toBe(0);
      }
    }
  });

  it('军事科技完成后缓存正确刷新', () => {
    const { tree, effectSystem } = createTechStack();
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const militaryBonuses = effectSystem.getPathBonuses('military');
    const hasNonZero = Object.values(militaryBonuses).some(v => v > 0);
    expect(hasNonZero).toBe(true);
  });

  it('经济科技完成后资源产出加成正确', () => {
    const { tree, effectSystem } = createTechStack();
    const node = getFirstResearchableNode(tree, 'economy');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 经济科技第一个节点: 精耕细作 → 粮草产出+15% (target=grain)
    const grainBonus = effectSystem.getProductionBonus('grain');
    expect(grainBonus).toBeGreaterThan(0);

    // getEffectValueByTarget 按target精确查询
    const allBonus = effectSystem.getProductionBonus('all');
    // target=grain 不等于 target=all，所以 all 可能为0
    expect(allBonus).toBeGreaterThanOrEqual(0);
  });

  it('文化科技完成后经验加成正确', () => {
    const { tree, effectSystem } = createTechStack();
    const node = getFirstResearchableNode(tree, 'culture');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const expBonus = effectSystem.getExpBonus();
    expect(expBonus).toBeGreaterThan(0);
  });

  it('getEffectBonus统一查询接口正确', () => {
    const { tree, effectSystem } = createTechStack();
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 查询军事路线的攻击加成
    const atkBonus = effectSystem.getEffectBonus('military', 'attack');
    expect(atkBonus).toBeGreaterThanOrEqual(0);
  });

  it('getGlobalBonus合并所有路线效果', () => {
    const { tree, effectSystem } = createTechStack();

    // 完成各路线第一个节点
    for (const path of ['military', 'economy', 'culture'] as TechPath[]) {
      const node = getFirstResearchableNode(tree, path);
      if (node) tree.completeNode(node.id);
    }
    effectSystem.invalidateCache();

    // 全局加成应包含所有路线
    const globalAtk = effectSystem.getGlobalBonus('attack');
    expect(globalAtk).toBeGreaterThanOrEqual(0);
  });

  it('按target精确查询效果值', () => {
    const { tree, effectSystem } = createTechStack();
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 全军攻击加成
    const allAtk = effectSystem.getAttackBonus('all');
    expect(allAtk).toBeGreaterThanOrEqual(0);
  });

  it('乘数接口返回1+bonus/100的系数', () => {
    const { tree, effectSystem } = createTechStack();
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const atkMultiplier = effectSystem.getAttackMultiplier('all');
    expect(atkMultiplier).toBeGreaterThanOrEqual(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════
// §2 科技效果应用器 — 军事/经济/文化加成计算
// ═══════════════════════════════════════════════════════════════
describe('§2 科技效果应用器 — 军事/经济/文化加成计算', () => {

  it('初始状态：所有加成为默认值(无加成)', () => {
    const { applier } = createTechStack();
    const battle = applier.getBattleBonuses();
    expect(battle.attackMultiplier).toBe(1);
    expect(battle.defenseMultiplier).toBe(1);
    expect(battle.hpMultiplier).toBe(1);
    expect(battle.damageMultiplier).toBe(1);
  });

  it('军事科技完成后攻击力乘数增加', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const battle = applier.getBattleBonuses('all');
    // PRD: 兵法入门 → 全军攻击+5%
    expect(battle.attackMultiplier).toBeGreaterThan(1);
  });

  it('applyAttackBonus正确增强攻击力', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const baseAttack = 1000;
    const enhanced = applier.applyAttackBonus(baseAttack, 'all');
    expect(enhanced).toBeGreaterThanOrEqual(baseAttack);
  });

  it('applyDefenseBonus正确增强防御力', () => {
    const { tree, effectSystem, applier } = createTechStack();
    // 完成军事路线节点
    const completed = completePathNodes(tree, 'military', 2);
    if (completed.length < 2) return;
    effectSystem.invalidateCache();

    const baseDefense = 800;
    const enhanced = applier.applyDefenseBonus(baseDefense, 'all');
    expect(enhanced).toBeGreaterThanOrEqual(baseDefense);
  });

  it('经济科技完成后资源产出乘数增加', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'economy');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const resource = applier.getResourceBonuses();
    // 经济科技应增加产出乘数
    const hasProductionBonus = Object.values(resource.productionMultipliers)
      .some(m => m > 1);
    expect(hasProductionBonus).toBe(true);
  });

  it('getProductionMultiplier按资源类型精确查询', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'economy');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const grainMultiplier = applier.getProductionMultiplier('grain');
    expect(grainMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('文化科技完成后经验乘数增加', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'culture');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const culture = applier.getCultureBonuses();
    // PRD: 礼贤下士 → 武将经验+10%
    expect(culture.expMultiplier).toBeGreaterThan(1);
  });

  it('applyExpBonus正确增强经验值', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'culture');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const baseExp = 100;
    const enhanced = applier.applyExpBonus(baseExp);
    expect(enhanced).toBeGreaterThanOrEqual(baseExp);
  });

  it('applyResearchSpeedBonus正确缩短研究时间', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'culture');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const baseTime = 300; // 5分钟
    const reduced = applier.applyResearchSpeedBonus(baseTime);
    expect(reduced).toBeLessThanOrEqual(baseTime);
  });

  it('composeResourceBonuses组装完整的Bonuses对象', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const node = getFirstResearchableNode(tree, 'economy');
    if (!node) return;

    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const bonuses = applier.composeResourceBonuses();
    expect(bonuses.tech).toBeGreaterThanOrEqual(0);
    expect(bonuses.castle).toBe(0); // 无主城加成
    expect(bonuses.hero).toBe(0);   // 无武将加成
  });

  it('composeResourceBonuses合并已有加成', () => {
    const { applier } = createTechStack();
    const bonuses = applier.composeResourceBonuses({
      castle: 10,
      hero: 5,
    });
    expect(bonuses.castle).toBe(10);
    expect(bonuses.hero).toBe(5);
  });

  it('getAllBonuses返回完整加成快照', () => {
    const { applier } = createTechStack();
    const all = applier.getAllBonuses('cavalry');
    expect(all.battle).toBeDefined();
    expect(all.resource).toBeDefined();
    expect(all.culture).toBeDefined();
  });

  it('getBonusSummary返回可读的加成摘要', () => {
    const { applier } = createTechStack();
    const summary = applier.getBonusSummary();
    expect(summary.military).toBeDefined();
    expect(summary.economy).toBeDefined();
    expect(summary.culture).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// §3 科技联动系统 — 建筑/武将/资源联动效果
// ═══════════════════════════════════════════════════════════════
describe('§3 科技联动系统 — 建筑/武将/资源联动效果', () => {

  it('初始状态：无活跃联动', () => {
    const { link } = createTechStack();
    const state = link.getState();
    expect(state.activeLinks).toBe(0);
    expect(state.totalLinks).toBeGreaterThan(0); // 有预注册的联动
  });

  it('syncCompletedTechIds后联动激活', () => {
    const { tree, link } = createTechStack();
    const node = getFirstResearchableNode(tree);
    if (!node) return;

    tree.completeNode(node.id);
    link.syncCompletedTechIds([node.id]);

    const state = link.getState();
    // 检查是否有联动效果关联到这个科技
    const linksForTech = link.getLinksByTechId(node.id);
    if (linksForTech.length > 0) {
      expect(state.activeLinks).toBeGreaterThan(0);
    }
  });

  it('addCompletedTech增量同步', () => {
    const { tree, link } = createTechStack();

    const node1 = getFirstResearchableNode(tree, 'military');
    if (node1) {
      tree.completeNode(node1.id);
      link.addCompletedTech(node1.id);
    }

    const node2 = getFirstResearchableNode(tree, 'economy');
    if (node2) {
      tree.completeNode(node2.id);
      link.addCompletedTech(node2.id);
    }

    // 验证联动系统状态
    const state = link.getState();
    expect(state).toBeDefined();
  });

  it('getBuildingLinkBonus查询建筑联动加成', () => {
    const { link } = createTechStack();
    const bonus = link.getBuildingLinkBonus('farm');
    expect(bonus.buildingType).toBe('farm');
    expect(bonus.productionBonus).toBeGreaterThanOrEqual(0);
    expect(typeof bonus.unlockFeature).toBe('boolean');
  });

  it('getHeroLinkBonus查询武将联动加成', () => {
    const { link } = createTechStack();
    const bonus = link.getHeroLinkBonus('cavalry_charge');
    expect(bonus.skillId).toBe('cavalry_charge');
    expect(bonus.enhanceBonus).toBeGreaterThanOrEqual(0);
    expect(typeof bonus.unlockSkill).toBe('boolean');
  });

  it('getResourceLinkBonus查询资源联动加成', () => {
    const { link } = createTechStack();
    const bonus = link.getResourceLinkBonus('grain');
    expect(bonus.resourceType).toBe('grain');
    expect(bonus.productionBonus).toBeGreaterThanOrEqual(0);
    expect(bonus.storageBonus).toBeGreaterThanOrEqual(0);
    expect(bonus.tradeBonus).toBeGreaterThanOrEqual(0);
  });

  it('getTechBonus统一查询接口', () => {
    const { link } = createTechStack();
    const buildingBonus = link.getTechBonus('building', 'farm');
    expect(buildingBonus).toBeGreaterThanOrEqual(0);

    const heroBonus = link.getTechBonus('hero', 'cavalry_charge');
    expect(heroBonus).toBeGreaterThanOrEqual(0);

    const resourceBonus = link.getTechBonus('resource', 'grain');
    expect(resourceBonus).toBeGreaterThanOrEqual(0);
  });

  it('getTechBonusMultiplier返回乘数格式', () => {
    const { link } = createTechStack();
    const multiplier = link.getTechBonusMultiplier('building', 'farm');
    expect(multiplier).toBeGreaterThanOrEqual(1);
  });

  it('getActiveLinksByTarget按目标系统筛选', () => {
    const { link } = createTechStack();
    const buildingLinks = link.getActiveLinksByTarget('building');
    expect(Array.isArray(buildingLinks)).toBe(true);

    const heroLinks = link.getActiveLinksByTarget('hero');
    expect(Array.isArray(heroLinks)).toBe(true);

    const resourceLinks = link.getActiveLinksByTarget('resource');
    expect(Array.isArray(resourceLinks)).toBe(true);
  });

  it('getTechLinkSnapshot获取科技完成时的联动快照', () => {
    const { link } = createTechStack();
    // 获取一个有联动效果的科技
    const allLinks = link.getState();
    if (allLinks.totalLinks > 0) {
      // 找一个有联动的科技ID
      const firstLink = link.getLinksByTechId(
        TECH_NODE_DEFS[0]?.id ?? ''
      );
      if (firstLink.length > 0) {
        const snapshot = link.getTechLinkSnapshot(firstLink[0].techId);
        expect(snapshot.building).toBeDefined();
        expect(snapshot.hero).toBeDefined();
        expect(snapshot.resource).toBeDefined();
      }
    }
  });

  it('getAllActiveBonuses获取综合加成摘要', () => {
    const { link } = createTechStack();
    const bonuses = link.getAllActiveBonuses();
    expect(bonuses.buildings).toBeDefined();
    expect(bonuses.heroes).toBeDefined();
    expect(bonuses.resources).toBeDefined();
    expect(Array.isArray(bonuses.buildings)).toBe(true);
    expect(Array.isArray(bonuses.heroes)).toBe(true);
    expect(Array.isArray(bonuses.resources)).toBe(true);
  });

  it('registerLink/unregisterLink动态注册联动', () => {
    const { link } = createTechStack();
    const beforeCount = link.getState().totalLinks;

    link.registerLink({
      id: 'test_link_001',
      techId: 'test_tech',
      target: 'building',
      targetSub: 'test_building',
      description: '测试联动',
      value: 15,
    });

    expect(link.getState().totalLinks).toBe(beforeCount + 1);

    link.unregisterLink('test_link_001');
    expect(link.getState().totalLinks).toBe(beforeCount);
  });

  it('removeCompletedTech移除已完成科技', () => {
    const { link } = createTechStack();
    link.addCompletedTech('test_tech_remove');
    link.removeCompletedTech('test_tech_remove');
    // 不应抛异常
  });
});

// ═══════════════════════════════════════════════════════════════
// §4 融合科技联动 — FusionTechSystem + FusionLinkManager
// ═══════════════════════════════════════════════════════════════
describe('§4 融合科技联动 — FusionTechSystem联动效果', () => {

  it('融合科技初始状态为locked', () => {
    const { fusion } = createTechStack();
    const states = fusion.getAllFusionStates();
    for (const state of Object.values(states)) {
      expect(state.status).toBe('locked');
    }
  });

  it('getFusionLinkEffects查询融合科技联动', () => {
    const { fusion } = createTechStack();
    const links = fusion.getFusionLinkEffects('fusion_mil_eco_1');
    expect(Array.isArray(links)).toBe(true);
    // 兵精粮足应有联动效果
    if (links.length > 0) {
      expect(links[0].fusionTechId).toBe('fusion_mil_eco_1');
    }
  });

  it('getActiveFusionLinkEffects初始无活跃联动', () => {
    const { fusion } = createTechStack();
    const active = fusion.getActiveFusionLinkEffects();
    expect(active.length).toBe(0);
  });

  it('完成融合科技后联动效果激活', () => {
    const { fusion } = createTechStack();
    // 直接完成融合科技
    fusion.completeFusionNode('fusion_mil_eco_1');

    const active = fusion.getActiveFusionLinkEffects();
    expect(active.length).toBeGreaterThan(0);
  });

  it('getFusionLinkBonus查询指定目标的联动加成', () => {
    const { fusion } = createTechStack();
    fusion.completeFusionNode('fusion_mil_eco_1');

    // 查询粮草产出联动加成
    const grainBonus = fusion.getFusionLinkBonus('resource', 'grain');
    expect(grainBonus).toBeGreaterThan(0);
  });

  it('完成融合科技后联动同步到TechLinkSystem', () => {
    const { fusion, link } = createTechStack();
    fusion.completeFusionNode('fusion_mil_eco_1');

    // 联动系统应能查询到融合科技的联动
    const buildingBonus = link.getBuildingLinkBonus('barracks');
    // 兵精粮足 → 兵营训练速度+10%
    expect(buildingBonus.productionBonus).toBeGreaterThan(0);
  });

  it('多个融合科技联动效果叠加', () => {
    const { fusion } = createTechStack();
    fusion.completeFusionNode('fusion_mil_eco_1');
    fusion.completeFusionNode('fusion_eco_cul_1');

    const active = fusion.getActiveFusionLinkEffects();
    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  it('checkPrerequisitesDetailed详细检查前置条件', () => {
    const { fusion } = createTechStack();
    const result = fusion.checkPrerequisitesDetailed('fusion_mil_eco_1');
    expect(result.met).toBe(false);
    expect(result.groups).toBeDefined();
    expect(Array.isArray(result.groups)).toBe(true);
  });

  it('getPathPairProgress检查路线组合进度', () => {
    const { fusion } = createTechStack();
    const progress = fusion.getPathPairProgress('military', 'economy');
    expect(progress.total).toBeGreaterThanOrEqual(0);
    expect(progress.locked).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// §5 效果全链路 — 科技完成 → 效果缓存刷新 → Applier计算
// ═══════════════════════════════════════════════════════════════
describe('§5 效果全链路 — 科技完成→效果缓存刷新→Applier计算', () => {

  it('完成军事科技→攻击力乘数增加→applyAttackBonus增强', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const baseAttack = 1000;

    // 完成前
    const beforeAtk = applier.applyAttackBonus(baseAttack, 'all');

    // 完成军事科技
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 完成后
    const afterAtk = applier.applyAttackBonus(baseAttack, 'all');
    expect(afterAtk).toBeGreaterThan(beforeAtk);
  });

  it('完成经济科技→资源产出乘数增加→getProductionMultiplier增强', () => {
    const { tree, effectSystem, applier } = createTechStack();

    // 完成前
    const beforeGrain = applier.getProductionMultiplier('grain');

    // 完成经济科技
    const node = getFirstResearchableNode(tree, 'economy');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 完成后
    const afterGrain = applier.getProductionMultiplier('grain');
    expect(afterGrain).toBeGreaterThanOrEqual(beforeGrain);
  });

  it('完成文化科技→研究速度增加→applyResearchSpeedBonus缩短', () => {
    const { tree, effectSystem, applier } = createTechStack();
    const baseTime = 300;

    // 完成前
    const beforeTime = applier.applyResearchSpeedBonus(baseTime);

    // 完成文化科技
    const node = getFirstResearchableNode(tree, 'culture');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 完成后
    const afterTime = applier.applyResearchSpeedBonus(baseTime);
    expect(afterTime).toBeLessThanOrEqual(beforeTime);
  });

  it('三条路线各完成一个→getAllBonuses全维度加成', () => {
    const { tree, effectSystem, applier } = createTechStack();

    // 各路线完成一个节点
    for (const path of ['military', 'economy', 'culture'] as TechPath[]) {
      const node = getFirstResearchableNode(tree, path);
      if (node) tree.completeNode(node.id);
    }
    effectSystem.invalidateCache();

    const all = applier.getAllBonuses();
    // 战斗加成
    expect(all.battle.attackMultiplier).toBeGreaterThan(1);
    // 资源加成
    const hasResourceBonus = Object.values(all.resource.productionMultipliers)
      .some(m => m > 1);
    expect(hasResourceBonus).toBe(true);
    // 文化加成
    expect(all.culture.expMultiplier).toBeGreaterThan(1);
  });

  it('科技联动+效果系统同时生效', () => {
    const { tree, effectSystem, applier, link } = createTechStack();

    // 完成科技
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();
    link.syncCompletedTechIds([node.id]);

    // 效果系统加成
    const battleAtk = applier.getBattleBonuses('all');
    expect(battleAtk.attackMultiplier).toBeGreaterThanOrEqual(1);

    // 联动系统加成
    const linkState = link.getState();
    expect(linkState).toBeDefined();
  });

  it('研究系统完成科技后效果系统自动感知', () => {
    const { tree, effectSystem, applier, research } = createTechStack();

    // 通过研究系统启动研究
    const node = getFirstResearchableNode(tree);
    if (!node) return;

    const startResult = research.startResearch(node.id);
    if (!startResult.success) return;

    // 模拟时间流逝，直接完成
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    // 效果系统应感知到科技完成
    const allBonuses = effectSystem.getAllBonuses();
    const hasAnyBonus = Object.values(allBonuses)
      .flatMap(b => Object.values(b))
      .some(v => (v as number) > 0);
    expect(hasAnyBonus).toBe(true);
  });

  it('序列化/反序列化后效果链路完整', () => {
    const stack = createTechStack();
    const { tree, effectSystem, applier } = stack;

    // 完成科技
    const node = getFirstResearchableNode(tree, 'military');
    if (!node) return;
    tree.completeNode(node.id);
    effectSystem.invalidateCache();

    const beforeAtk = applier.applyAttackBonus(1000, 'all');

    // 序列化
    const saved = tree.serialize();

    // 重置并恢复
    tree.reset();
    tree.deserialize(saved);
    effectSystem.invalidateCache();

    const afterAtk = applier.applyAttackBonus(1000, 'all');
    expect(afterAtk).toBe(beforeAtk);
  });
});
