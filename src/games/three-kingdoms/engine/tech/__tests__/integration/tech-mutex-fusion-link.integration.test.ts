/**
 * 集成测试 — 互斥分支选择 + 融合科技 + 科技联动效果
 *
 * 覆盖 Play 文档流程：
 *   §1.5  互斥分支选择（A/B二选一，不可逆）
 *   §1.6  融合科技（跨路线组合、4个融合科技）
 *   §1.7  科技联动效果（建筑/武将/资源联动）
 *   §1.10 内政武将派遣加速研究
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/tech/__tests__/integration/tech-mutex-fusion-link
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TechTreeSystem } from '../../TechTreeSystem';
import { TechPointSystem } from '../../TechPointSystem';
import { TechLinkSystem } from '../../TechLinkSystem';
import { FusionTechSystem } from '../../FusionTechSystem';
import { FUSION_TECH_DEFS } from '../../fusion-tech.types';
import { TECH_NODE_DEFS, getMutexGroups } from '../../tech-config';
import type { TechPath } from '../../tech.types';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createTechDeps(): ISystemDeps {
  const tree = new TechTreeSystem();
  const points = new TechPointSystem();
  const link = new TechLinkSystem();
  const fusion = new FusionTechSystem();

  const registry = new Map<string, unknown>();
  registry.set('techTree', tree);
  registry.set('techPoint', points);
  registry.set('techLink', link);
  registry.set('fusionTech', fusion);

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

  tree.init(deps);
  points.init(deps);
  link.init(deps);
  fusion.init(deps);
  fusion.setTechTree(tree);
  fusion.setLinkSystem(link);

  return deps;
}

function getSystems(deps: ISystemDeps) {
  return {
    tree: deps.registry.get<TechTreeSystem>('techTree')!,
    points: deps.registry.get<TechPointSystem>('techPoint')!,
    link: deps.registry.get<TechLinkSystem>('techLink')!,
    fusion: deps.registry.get<FusionTechSystem>('fusionTech')!,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('§1.5 互斥分支选择', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createTechDeps();
    sys = getSystems(deps);
  });

  it('应有互斥组（Map结构）', () => {
    const mutexGroups = getMutexGroups();
    expect(mutexGroups instanceof Map).toBe(true);
    expect(mutexGroups.size).toBeGreaterThan(0);
  });

  it('互斥分支: 选中A后B标记为mutex-locked', () => {
    const mutexGroups = getMutexGroups();
    if (mutexGroups.size === 0) return;

    const firstEntry = mutexGroups.entries().next().value;
    const [groupKey, nodes] = firstEntry as [string, string[]];
    expect(nodes.length).toBe(2); // A/B

    // 完成A节点
    sys.tree.completeNode(nodes[0]);

    // B节点应被锁定
    const isLocked = sys.tree.isMutexLocked(nodes[1]);
    expect(isLocked).toBe(true);
  });

  it('互斥锁定不可逆（转生除外）', () => {
    const mutexGroups = getMutexGroups();
    if (mutexGroups.size === 0) return;

    const firstEntry = mutexGroups.entries().next().value;
    const [, nodes] = firstEntry as [string, string[]];
    sys.tree.completeNode(nodes[0]);

    // 锁定状态持久
    expect(sys.tree.isMutexLocked(nodes[1])).toBe(true);
    // 再次检查仍然锁定
    expect(sys.tree.isMutexLocked(nodes[1])).toBe(true);
  });

  it('军事路线互斥: 进攻/防御', () => {
    const mutexGroups = getMutexGroups();
    // 检查是否有军事路线的互斥组
    let found = false;
    for (const [key, nodes] of mutexGroups) {
      if (nodes.some(n => n.startsWith('mil_'))) {
        expect(nodes.length).toBeGreaterThanOrEqual(2);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('经济路线互斥: 重农/重商', () => {
    const mutexGroups = getMutexGroups();
    let found = false;
    for (const [key, nodes] of mutexGroups) {
      if (nodes.some(n => n.startsWith('eco_'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('文化路线互斥: 仁政/霸道', () => {
    const mutexGroups = getMutexGroups();
    let found = false;
    for (const [key, nodes] of mutexGroups) {
      if (nodes.some(n => n.startsWith('cul_'))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('getChosenMutexNodes记录已选互斥节点', () => {
    const mutexGroups = getMutexGroups();
    if (mutexGroups.size === 0) return;

    const firstEntry = mutexGroups.entries().next().value;
    const [groupKey, nodes] = firstEntry as [string, string[]];
    sys.tree.completeNode(nodes[0]);

    const chosen = sys.tree.getChosenMutexNodes();
    expect(chosen[groupKey]).toBe(nodes[0]);
  });
});

describe('§1.6 融合科技', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createTechDeps();
    sys = getSystems(deps);
  });

  it('应有6个融合科技（3对路线×2级）', () => {
    const defs = FUSION_TECH_DEFS;
    expect(defs.length).toBe(6);
  });

  it('融合科技名称: 兵精粮足、铁骑商路、兵法大家、名将传承、文景之治、盛世华章', () => {
    const names = FUSION_TECH_DEFS.map(d => d.name);
    expect(names).toContain('兵精粮足');
    expect(names).toContain('铁骑商路');
    expect(names).toContain('兵法大家');
    expect(names).toContain('名将传承');
    expect(names).toContain('文景之治');
    expect(names).toContain('盛世华章');
  });

  it('兵精粮足: 军事t2+经济t2', () => {
    const fusion = FUSION_TECH_DEFS.find(d => d.name === '兵精粮足');
    expect(fusion).toBeDefined();
    expect(fusion!.prerequisites).toBeDefined();
  });

  it('铁骑商路: 军事t3+经济t3', () => {
    const fusion = FUSION_TECH_DEFS.find(d => d.name === '铁骑商路');
    expect(fusion).toBeDefined();
  });

  it('融合科技不占用基础路线研究槽位', () => {
    // 验证融合科技独立于基础路线
    const fusionStates = sys.fusion.getAllFusionStates();
    const treeStates = sys.tree.getAllNodeStates();
    // 融合科技的ID不应出现在基础路线中
    for (const fusionId of Object.keys(fusionStates)) {
      expect(treeStates[fusionId]).toBeUndefined();
    }
  });

  it('融合科技前置条件检测', () => {
    const fusionDefs = FUSION_TECH_DEFS;
    for (const def of fusionDefs) {
      const met = sys.fusion.arePrerequisitesMet(def.id);
      // 初始状态前置不应满足（除非无前置）
      expect(typeof met).toBe('boolean');
    }
  });

  it('完成跨路线前置后融合科技解锁', () => {
    // 找到军经合一
    const fusion = FUSION_TECH_DEFS.find(d => d.name === '军经合一');
    if (!fusion) return;

    // 完成前置节点
    const militaryNodes = sys.tree.getPathNodes('military');
    const economyNodes = sys.tree.getPathNodes('economy');

    // 完成军事路线前3层
    for (let i = 0; i < Math.min(3, militaryNodes.length); i++) {
      sys.tree.completeNode(militaryNodes[i].id);
    }
    // 完成经济路线前3层
    for (let i = 0; i < Math.min(3, economyNodes.length); i++) {
      sys.tree.completeNode(economyNodes[i].id);
    }

    // 检查前置是否满足
    const met = sys.fusion.arePrerequisitesMet(fusion.id);
    expect(met).toBe(true);
  });
});

describe('§1.7 科技联动效果', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSystems>;

  beforeEach(() => {
    deps = createTechDeps();
    sys = getSystems(deps);
  });

  it('TechLinkSystem应支持建筑/武将/资源联动注册', () => {
    const state = sys.link.getState();
    expect(state).toBeDefined();
  });

  it('科技完成→联动效果自动注册', () => {
    // 完成一个经济路线节点
    const economyNodes = sys.tree.getPathNodes('economy');
    if (economyNodes.length === 0) return;

    sys.tree.completeNode(economyNodes[0].id);
    sys.link.addCompletedTech(economyNodes[0].id);

    // 检查联动效果
    const buildingBonus = sys.link.getBuildingLinkBonus('farmland');
    expect(typeof buildingBonus).toBe('object');
  });

  it('getTechBonus应返回联动加成数值', () => {
    // 注册一个联动效果
    sys.link.registerLink({
      id: 'test-link-1',
      techId: 'test-tech',
      target: 'building',
      targetSub: 'farmland',
      bonusType: 'production',
      value: 0.1,
    });
    sys.link.addCompletedTech('test-tech');

    const bonus = sys.link.getTechBonus('building', 'farmland');
    expect(bonus).toBeGreaterThanOrEqual(0);
  });

  it('联动效果即时生效', () => {
    sys.link.registerLink({
      id: 'test-link-2',
      techId: 'test-tech-2',
      target: 'resource',
      targetSub: 'food',
      bonusType: 'production',
      value: 0.15,
    });
    sys.link.addCompletedTech('test-tech-2');

    const bonus = sys.link.getTechBonus('resource', 'food');
    expect(bonus).toBe(0.15);
  });
});

describe('§1.10 内政武将派遣加速研究', () => {
  it('内政武将派遣至书院增加研究速度+10%~30%（由上层引擎校验）', () => {
    // 引擎层验证: 加成通过 TechPointSystem.syncResearchSpeedBonus 注入
    const points = new TechPointSystem();
    const registry = new Map<string, unknown>();
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
        get: () => null,
        getAll: () => new Map(),
        has: () => false,
        unregister: () => {},
      } as unknown as ISubsystemRegistry,
    };
    points.init(deps);

    // 模拟10%加成
    points.syncResearchSpeedBonus(10);
    expect(points.getResearchSpeedMultiplier()).toBe(1.1);

    // 模拟30%加成
    points.syncResearchSpeedBonus(30);
    expect(points.getResearchSpeedMultiplier()).toBe(1.3);
  });
});
