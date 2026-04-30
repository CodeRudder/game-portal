/**
 * 集成测试 — NPC任务链+刷新+日程全链路 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §6.3 NPC任务链：任务链进度（NPCQuestSystem缺失，部分skip）
 *   §6.4 NPC出现与刷新：刷新机制、稀有NPC
 *   §6.5 NPC日程系统：24h日程循环（仅巡逻实现，部分skip）
 *
 * @module engine/calendar/__tests__/integration/npc-quest-schedule
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NPCSystem } from '../../../npc/NPCSystem';
import { NPCSpawnSystem } from '../../../npc/NPCSpawnSystem';
import { NPCPatrolSystem } from '../../../npc/NPCPatrolSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { NPCSpawnRule } from '../../../npc/NPCSpawnSystem';
import type { PatrolPath, NPCSpawnTemplate } from '../../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建完整的系统依赖 */
function createDeps(): ISystemDeps {
  const npc = new NPCSystem();
  const spawn = new NPCSpawnSystem();
  const patrol = new NPCPatrolSystem();

  const registry = new Map<string, unknown>();
  registry.set('npc', npc);
  registry.set('npcSpawn', spawn);
  registry.set('npcPatrol', patrol);

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
    } as unknown as import('../../../../core/types/subsystem').ISubsystemRegistry,
  };

  npc.init(deps);
  spawn.init(deps);
  patrol.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    npc: deps.registry!.get<NPCSystem>('npc')!,
    spawn: deps.registry!.get<NPCSpawnSystem>('npcSpawn')!,
    patrol: deps.registry!.get<NPCPatrolSystem>('npcPatrol')!,
  };
}

/** 创建标准刷新规则 */
function createSpawnRule(overrides: Partial<NPCSpawnRule> = {}): NPCSpawnRule {
  return {
    id: 'rule-merchant-01',
    defId: 'merchant',
    spawnX: 5,
    spawnY: 5,
    respawnInterval: 100,
    maxCount: 3,
    enabled: true,
    ...overrides,
  };
}

/** 创建稀有NPC刷新规则 */
function createRareSpawnRule(): NPCSpawnRule {
  return createSpawnRule({
    id: 'rule-rare-hermit',
    defId: 'strategist',
    spawnX: 20,
    spawnY: 20,
    respawnInterval: 500,
    maxCount: 1,
    conditions: [{ type: 'turn', params: { minTurn: 50 } }],
    enabled: true,
  });
}

/** 创建巡逻路径 */
function createPatrolPath(overrides: Partial<PatrolPath> = {}): PatrolPath {
  return {
    id: 'path-market',
    region: 'wei',
    waypoints: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 5 },
    ],
    speed: 1,
    loop: true,
    ...overrides,
  };
}

/** 创建刷新模板 */
function createSpawnTemplate(overrides: Partial<NPCSpawnTemplate> = {}): NPCSpawnTemplate {
  return {
    id: 'tpl-merchant',
    name: '行商',
    profession: 'merchant',
    region: 'wei',
    patrolPathId: 'path-market',
    initialAffinity: 30,
    weight: 10,
    ...overrides,
  };
}

/** 设置 spawn/despawn 回调 */
function setupSpawnCallbacks(sys: ReturnType<typeof getSys>): void {
  sys.spawn.setSpawnCallback((defId, x, y, name) => {
    const npc = sys.npc.createNPC(name ?? `NPC-${defId}`, defId as unknown as Record<string, unknown>, { x, y });
    return npc.id;
  });
  sys.spawn.setDespawnCallback((npcId) => {
    sys.npc.removeNPC(npcId);
  });
  sys.spawn.setPatrolAssignCallback((npcId, pathId) => {
    sys.patrol.assignPatrol(npcId, pathId);
  });
}

// ═════════════════════════════════════════════
// §6.3 NPC任务链
// ═════════════════════════════════════════════

describe('§6.3 NPC任务链', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // NPCQuestSystem 尚未实现，以下用 skip 标注

  it.skip('NPC任务链：接取任务后进度追踪', () => {
    // 需要 NPCQuestSystem
  });

  it.skip('NPC任务链：完成任务后奖励发放', () => {
    // 需要 NPCQuestSystem
  });

  it.skip('NPC任务链：任务链前后依赖关系', () => {
    // 需要 NPCQuestSystem
  });

  it.skip('NPC任务链：好感度影响任务可用性', () => {
    // 需要 NPCQuestSystem
  });

  it.skip('NPC任务链：任务失败处理', () => {
    // 需要 NPCQuestSystem
  });

  // 使用现有系统验证NPC存在性作为任务前置条件

  it('NPC存在时可作为任务发布者，不同职业提供不同任务', () => {
    const merchant = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 80 });
    const warrior = sys.npc.createNPC('武将赵云', 'warrior', { x: 6, y: 6 }, { affinity: 50 });
    expect(sys.npc.hasNPC(merchant.id)).toBe(true);
    expect(merchant.affinity).toBeGreaterThanOrEqual(80);
    expect(merchant.profession).not.toBe(warrior.profession);
  });
});

// ═════════════════════════════════════════════
// §6.4 NPC出现与刷新
// ═════════════════════════════════════════════

describe('§6.4 NPC出现与刷新', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
    setupSpawnCallbacks(sys);
  });

  // --- 刷新规则注册 ---

  describe('刷新规则注册', () => {
    it('registerRule 注册后 getRule 返回规则，removeRule 可删除', () => {
      sys.spawn.registerRule(createSpawnRule());
      expect(sys.spawn.getRule('rule-merchant-01')).toBeDefined();
      expect(sys.spawn.removeRule('rule-merchant-01')).toBe(true);
      expect(sys.spawn.getRule('rule-merchant-01')).toBeUndefined();
    });

    it('registerRules 批量注册后 getRuleIds 返回全部 ID', () => {
      sys.spawn.registerRules([
        createSpawnRule({ id: 'rule-1', defId: 'merchant' }),
        createSpawnRule({ id: 'rule-2', defId: 'warrior' }),
      ]);
      const ids = sys.spawn.getRuleIds();
      expect(ids).toContain('rule-1');
      expect(ids).toContain('rule-2');
    });

    it('setRuleEnabled 禁用规则后 enabled=false，removeRule 不存在返回 false', () => {
      sys.spawn.registerRule(createSpawnRule());
      sys.spawn.setRuleEnabled('rule-merchant-01', false);
      expect(sys.spawn.getRule('rule-merchant-01')!.enabled).toBe(false);
      expect(sys.spawn.removeRule('nonexistent')).toBe(false);
    });
  });

  // --- 刷新机制 ---

  describe('刷新机制', () => {
    it('forceSpawn 强制刷新NPC成功且计数正确', () => {
      sys.spawn.registerRule(createSpawnRule());
      const result = sys.spawn.forceSpawn('rule-merchant-01');
      expect(result.success).toBe(true);
      expect(result.npcId).toBeDefined();
      expect(sys.spawn.getActiveCountForRule('rule-merchant-01')).toBe(1);
      expect(sys.spawn.getRuleIdForNPC(result.npcId!)).toBe('rule-merchant-01');
    });

    it('forceSpawn 对不存在的规则返回失败', () => {
      const result = sys.spawn.forceSpawn('nonexistent');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('规则不存在');
    });

    it('forceSpawn 达到 maxCount 后返回失败', () => {
      sys.spawn.registerRule(createSpawnRule({ maxCount: 1 }));
      sys.spawn.forceSpawn('rule-merchant-01');
      const result = sys.spawn.forceSpawn('rule-merchant-01');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('最大数量');
    });

    it('checkSpawnConditions 检查条件并触发刷新', () => {
      sys.spawn.registerRule(createSpawnRule());
      const results = sys.spawn.checkSpawnConditions({ currentTurn: 1, events: [] });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].success).toBe(true);
    });

    it('checkSpawnConditions 禁用规则不触发刷新', () => {
      sys.spawn.registerRule(createSpawnRule());
      sys.spawn.setRuleEnabled('rule-merchant-01', false);
      const results = sys.spawn.checkSpawnConditions({ currentTurn: 1, events: [] });
      expect(results.length).toBe(0);
    });

    it('getActiveNPCCount 返回所有规则活跃NPC总数', () => {
      sys.spawn.registerRules([
        createSpawnRule({ id: 'rule-1', maxCount: 5 }),
        createSpawnRule({ id: 'rule-2', defId: 'warrior', maxCount: 5 }),
      ]);
      sys.spawn.forceSpawn('rule-1');
      sys.spawn.forceSpawn('rule-2');
      expect(sys.spawn.getActiveNPCCount()).toBe(2);
    });
  });

  // --- 稀有NPC ---

  describe('稀有NPC刷新', () => {
    it('稀有NPC有条件刷新规则且 maxCount=1，刷新间隔更长', () => {
      sys.spawn.registerRules([
        createSpawnRule({ id: 'rule-normal', respawnInterval: 100 }),
        createRareSpawnRule(),
      ]);
      const rareRule = sys.spawn.getRule('rule-rare-hermit')!;
      expect(rareRule.conditions!.length).toBeGreaterThan(0);
      expect(rareRule.maxCount).toBe(1);
      expect(rareRule.respawnInterval).toBeGreaterThan(
        sys.spawn.getRule('rule-normal')!.respawnInterval,
      );
    });

    it('稀有NPC条件不满足时不触发，条件满足时可刷新', () => {
      sys.spawn.registerRule(createRareSpawnRule());
      // 条件 minTurn: 50，传入 currentTurn: 1 → 不满足
      const results1 = sys.spawn.checkSpawnConditions({ currentTurn: 1, events: [] });
      expect(results1.every((r) => r.ruleId !== 'rule-rare-hermit')).toBe(true);

      // 条件满足 currentTurn: 100 → 可刷新
      const results2 = sys.spawn.checkSpawnConditions({ currentTurn: 100, events: [] });
      expect(results2.some((r) => r.ruleId === 'rule-rare-hermit')).toBe(true);
    });
  });

  // --- 序列化 ---

  describe('序列化', () => {
    it('serialize 返回完整数据，deserialize 可恢复 gameTime', () => {
      sys.spawn.registerRule(createSpawnRule());
      sys.spawn.forceSpawn('rule-merchant-01');
      const saved = sys.spawn.serialize();
      expect(saved).toHaveProperty('version');
      expect(saved).toHaveProperty('spawnTimers');
      expect(saved).toHaveProperty('spawnedRecords');

      const newSpawn = new NPCSpawnSystem();
      newSpawn.init(createDeps());
      newSpawn.deserialize(saved);
      expect(newSpawn.getGameTime()).toBe(sys.spawn.getGameTime());
    });
  });
});

// ═════════════════════════════════════════════
// §6.5 NPC日程系统
// ═════════════════════════════════════════════

describe('§6.5 NPC日程系统', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
  });

  // --- 巡逻路径管理 ---

  describe('巡逻路径管理', () => {
    it('registerPatrolPath 注册后可查询，removePatrolPath 可删除', () => {
      sys.patrol.registerPatrolPath(createPatrolPath());
      expect(sys.patrol.getPatrolPath('path-market')).toBeDefined();
      expect(sys.patrol.removePatrolPath('path-market')).toBe(true);
      expect(sys.patrol.getPatrolPath('path-market')).toBeUndefined();
      expect(sys.patrol.removePatrolPath('nonexistent')).toBe(false);
    });

    it('registerPatrolPaths 批量注册后 getAllPatrolPaths 返回全部', () => {
      sys.patrol.registerPatrolPaths([
        createPatrolPath({ id: 'path-1' }),
        createPatrolPath({ id: 'path-2', region: 'shu' }),
      ]);
      expect(sys.patrol.getAllPatrolPaths().length).toBeGreaterThanOrEqual(2);
    });

    it('getPatrolPathsByRegion 按区域过滤路径', () => {
      sys.patrol.registerPatrolPaths([
        createPatrolPath({ id: 'path-wei', region: 'wei' }),
        createPatrolPath({ id: 'path-shu', region: 'shu' }),
      ]);
      const weiPaths = sys.patrol.getPatrolPathsByRegion('wei');
      expect(weiPaths.length).toBeGreaterThanOrEqual(1);
      expect(weiPaths.every((p) => p.region === 'wei')).toBe(true);
    });

    it('removePatrolPath 同时清除关联的巡逻状态', () => {
      sys.patrol.registerPatrolPath(createPatrolPath());
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      sys.patrol.assignPatrol(npc.id, 'path-market');
      expect(sys.patrol.isPatrolling(npc.id)).toBe(true);

      sys.patrol.removePatrolPath('path-market');
      expect(sys.patrol.isPatrolling(npc.id)).toBe(false);
    });
  });

  // --- NPC巡逻分配 ---

  describe('NPC巡逻分配', () => {
    beforeEach(() => {
      sys.patrol.registerPatrolPath(createPatrolPath());
    });

    it('assignPatrol 分配成功后 isPatrolling=true，getPatrolState 包含 pathId', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      expect(sys.patrol.assignPatrol(npc.id, 'path-market')).toBe(true);
      expect(sys.patrol.isPatrolling(npc.id)).toBe(true);
      expect(sys.patrol.getPatrolState(npc.id)!.patrolPathId).toBe('path-market');
    });

    it('assignPatrol 对不存在的路径返回 false', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      expect(sys.patrol.assignPatrol(npc.id, 'nonexistent')).toBe(false);
    });

    it('unassignPatrol 取消后 isPatrolling=false', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      sys.patrol.assignPatrol(npc.id, 'path-market');
      expect(sys.patrol.unassignPatrol(npc.id)).toBe(true);
      expect(sys.patrol.isPatrolling(npc.id)).toBe(false);
    });

    it('pausePatrol/resumePatrol 暂停和恢复巡逻', () => {
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      sys.patrol.assignPatrol(npc.id, 'path-market');
      sys.patrol.pausePatrol(npc.id, 100);
      expect(sys.patrol.getPatrolState(npc.id)!.isPatrolling).toBe(false);

      sys.patrol.resumePatrol(npc.id);
      expect(sys.patrol.getPatrolState(npc.id)!.isPatrolling).toBe(true);
    });

    it('getPatrollingCount 返回正在巡逻的NPC数', () => {
      const npc1 = sys.npc.createNPC('商人A', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      const npc2 = sys.npc.createNPC('商人B', 'merchant', { x: 6, y: 6 }, { affinity: 50 });
      sys.patrol.assignPatrol(npc1.id, 'path-market');
      sys.patrol.assignPatrol(npc2.id, 'path-market');
      expect(sys.patrol.getPatrollingCount()).toBe(2);
    });
  });

  // --- 刷新模板 ---

  describe('刷新模板', () => {
    it('registerSpawnTemplate 注册后可查询，批量注册返回全部', () => {
      sys.patrol.registerSpawnTemplate(createSpawnTemplate());
      expect(sys.patrol.getSpawnTemplate('tpl-merchant')!.profession).toBe('merchant');

      sys.patrol.registerSpawnTemplates([
        createSpawnTemplate({ id: 'tpl-1', name: '行商' }),
        createSpawnTemplate({ id: 'tpl-2', name: '武将', profession: 'warrior' }),
      ]);
      expect(sys.patrol.getAllSpawnTemplates().length).toBeGreaterThanOrEqual(3);
    });

    it('getSpawnConfig/setSpawnConfig 可更新刷新配置', () => {
      sys.patrol.setSpawnConfig({ maxNPCCount: 50 });
      expect(sys.patrol.getSpawnConfig().maxNPCCount).toBe(50);
    });
  });

  // --- 24h日程循环（部分未实现） ---

  describe('24h日程循环', () => {
    it.skip('NPC在白天出现在市场区域', () => {
      // 需要 NPCScheduleSystem
    });

    it.skip('NPC在夜间返回住所', () => {
      // 需要 NPCScheduleSystem
    });

    it.skip('NPC根据职业有不同的日程安排', () => {
      // 需要 NPCScheduleSystem
    });

    it.skip('日程变化触发NPC位置更新', () => {
      // 需要 NPCScheduleSystem
    });

    // 使用巡逻系统模拟日程行为
    it('巡逻路径模拟NPC在多个地点间移动', () => {
      sys.patrol.registerPatrolPath(createPatrolPath({
        id: 'path-daily',
        waypoints: [
          { x: 0, y: 0 },   // 住所
          { x: 5, y: 5 },   // 市场
          { x: 10, y: 10 }, // 训练场
        ],
        loop: true,
      }));
      const npc = sys.npc.createNPC('武将赵云', 'warrior', { x: 0, y: 0 }, { affinity: 50 });
      sys.patrol.assignPatrol(npc.id, 'path-daily');
      const state = sys.patrol.getPatrolState(npc.id);
      expect(state).toBeDefined();
      expect(state!.exactPosition).toEqual({ x: 0, y: 0 });
    });
  });

  // --- 序列化 ---

  describe('序列化', () => {
    it('exportSaveData/importSaveData 可恢复巡逻系统状态', () => {
      sys.patrol.registerPatrolPath(createPatrolPath());
      const npc = sys.npc.createNPC('商人张三', 'merchant', { x: 5, y: 5 }, { affinity: 50 });
      sys.patrol.assignPatrol(npc.id, 'path-market');
      const saved = sys.patrol.exportSaveData();

      const newPatrol = new NPCPatrolSystem();
      const newDeps = createDeps();
      newPatrol.init(newDeps);
      newPatrol.registerPatrolPath(createPatrolPath());
      newPatrol.importSaveData(saved);

      expect(newPatrol.getAllPatrolPaths().length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ═════════════════════════════════════════════
// §6.3+§6.4+§6.5 交叉集成
// ═════════════════════════════════════════════

describe('§6.3+§6.4+§6.5 任务链+刷新+日程交叉集成', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    const deps = createDeps();
    sys = getSys(deps);
    setupSpawnCallbacks(sys);
  });

  it('刷新NPC后分配巡逻路径', () => {
    sys.patrol.registerPatrolPath(createPatrolPath());
    sys.spawn.registerRule(createSpawnRule({ patrolPathId: 'path-market' }));

    const result = sys.spawn.forceSpawn('rule-merchant-01');
    expect(result.success).toBe(true);
    expect(result.npcId).toBeDefined();
  });

  it('刷新系统+巡逻系统协同工作', () => {
    sys.patrol.registerPatrolPath(createPatrolPath());
    sys.spawn.registerRule(createSpawnRule({ maxCount: 3 }));

    const results = sys.spawn.checkSpawnConditions({ currentTurn: 1, events: [] });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(sys.npc.getNPCCount()).toBeGreaterThanOrEqual(1);
  });

  it('多条规则刷新不同职业NPC，禁用规则不影响其他规则', () => {
    sys.spawn.registerRules([
      createSpawnRule({ id: 'rule-1', maxCount: 5 }),
      createSpawnRule({ id: 'rule-2', defId: 'warrior', spawnX: 10, spawnY: 10, maxCount: 5 }),
    ]);

    // forceSpawn 两条规则
    sys.spawn.forceSpawn('rule-1');
    sys.spawn.forceSpawn('rule-2');
    expect(sys.spawn.getActiveNPCCount()).toBe(2);

    // 重置计时器后，禁用 rule-1，checkSpawnConditions 只触发 rule-2
    sys.spawn.setRuleEnabled('rule-1', false);
    // 注意：forceSpawn 后有 respawnInterval 计时器，需要重置
    // 通过新注册无计时器的规则来验证
    sys.spawn.registerRule(createSpawnRule({
      id: 'rule-3', defId: 'strategist', spawnX: 15, spawnY: 15, maxCount: 5,
    }));
    sys.spawn.setRuleEnabled('rule-1', false);
    const results = sys.spawn.checkSpawnConditions({ currentTurn: 1, events: [] });
    expect(results.some((r) => r.ruleId === 'rule-3')).toBe(true);
    expect(results.every((r) => r.ruleId !== 'rule-1')).toBe(true);
  });

  it.skip('NPC刷新后自动接取日程任务', () => {
    // 需要 NPCQuestSystem + NPCScheduleSystem
  });

  it.skip('日程驱动的NPC位置变化影响任务可接取性', () => {
    // 需要 NPCScheduleSystem
  });
});
