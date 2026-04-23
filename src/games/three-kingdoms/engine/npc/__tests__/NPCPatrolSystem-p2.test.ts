/**
 * NPCPatrolSystem 单元测试 (p2)
 *
 * 覆盖：
 * - #1 NPC 巡逻分配与控制（续）
 * - #1 巡逻移动与折返
 * - #2 NPC 刷新规则
 * - 存档序列化
 */

import { NPCPatrolSystem } from '../NPCPatrolSystem';
import type { ISystemDeps } from '../../../core/types';
import type { PatrolPath, NPCSpawnTemplate, NPCSpawnConfig } from '../../../core/npc';
import type { NPCData, NPCProfession, RegionId } from '../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

/** 创建带 mock NPCSystem 的 deps */
function mockDepsWithNPC(npcs: NPCData[] = []): ISystemDeps {
  const npcMap = new Map(npcs.map((n) => [n.id, { ...n }]));

  const mockNPCSys = {
    getNPCCount: () => npcMap.size,
    getNPCsByRegion: (region: RegionId) =>
      Array.from(npcMap.values()).filter((n) => n.region === region),
    createNPC: (name: string, profession: NPCProfession, position: { x: number; y: number }, opts?: { affinity?: number }) => {
      const id = `npc-spawn-${npcMap.size + 1}`;
      const npc: NPCData = {
        id,
        name,
        profession,
        affinity: opts?.affinity ?? 30,
        position,
        region: 'wei' as RegionId,
        visible: true,
        dialogId: `dialog-${profession}-default`,
        createdAt: 0,
        lastInteractedAt: 0,
      };
      npcMap.set(id, npc);
      return { ...npc };
    },
    removeNPC: (id: string) => npcMap.delete(id),
    moveNPC: (id: string, pos: { x: number; y: number }) => {
      const npc = npcMap.get(id);
      if (npc) { npc.position = pos; return true; }
      return false;
    },
  };

  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: {
      register: jest.fn(),
      get: jest.fn().mockReturnValue(mockNPCSys),
      getAll: jest.fn(),
      has: jest.fn(),
      unregister: jest.fn(),
    },
  } as unknown as ISystemDeps;
}

/** 创建测试巡逻路径 */
function createTestPath(overrides?: Partial<PatrolPath>): PatrolPath {
  return {
    id: 'test-path-1',
    name: '测试路径',
    waypoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    region: 'wei',
    speed: 5.0,
    ...overrides,
  };
}

/** 创建测试刷新模板 */
function createTestTemplate(overrides?: Partial<NPCSpawnTemplate>): NPCSpawnTemplate {
  return {
    id: 'template-1',
    name: '测试商人',
    profession: 'merchant',
    region: 'wei',
    patrolPathId: 'test-path-1',
    initialAffinity: 30,
    weight: 1.0,
    ...overrides,
  };
}

function createPatrolSystem(deps?: ISystemDeps): NPCPatrolSystem {
  const sys = new NPCPatrolSystem();
  sys.init(deps ?? mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('NPCPatrolSystem', () => {
  let patrolSys: NPCPatrolSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    patrolSys = createPatrolSystem(deps);
  });

  // ═══════════════════════════════════════════
  // 3. #1 NPC 巡逻分配与控制（续）
  // ═══════════════════════════════════════════
  describe('#1 NPC 巡逻分配与控制', () => {
    beforeEach(() => {
      patrolSys.registerPatrolPath(createTestPath());
    });

    it('getNPCExactPosition 不存在的NPC返回 null', () => {
      expect(patrolSys.getNPCExactPosition('non-existent')).toBeNull();
    });

    it('getPatrolState 返回副本', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      const state1 = patrolSys.getPatrolState('npc-1');
      state1!.direction = -1;
      const state2 = patrolSys.getPatrolState('npc-1');
      expect(state2!.direction).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 4. #1 巡逻移动与折返
  // ═══════════════════════════════════════════
  describe('#1 巡逻移动与折返', () => {
    it('NPC沿路径正向移动', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        speed: 10.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');

      // 更新 0.5秒，速度10格/秒，应移动5格
      patrolSys.update(0.5);
      const pos = patrolSys.getNPCExactPosition('npc-1');
      expect(pos!.x).toBeCloseTo(5, 0);
      expect(pos!.y).toBe(0);
    });

    it('NPC到达路径端点后折返', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        speed: 100.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');

      // 大步更新，到达端点
      patrolSys.update(1.0);
      const state = patrolSys.getPatrolState('npc-1');

      // 到达端点后应折返并暂停
      expect(state!.direction).toBe(-1);
      expect(state!.isPatrolling).toBe(false);
      expect(state!.pauseTimer).toBeGreaterThan(0);
    });

    it('NPC暂停后自动恢复巡逻', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        speed: 100.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');

      // 到达端点，进入暂停
      patrolSys.update(1.0);
      const state1 = patrolSys.getPatrolState('npc-1');
      expect(state1!.isPatrolling).toBe(false);

      // 等待暂停结束
      patrolSys.update(2.0);
      const state2 = patrolSys.getPatrolState('npc-1');
      expect(state2!.isPatrolling).toBe(true);
    });

    it('NPC在多路径点间移动', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 10, y: 0 },
        ],
        speed: 10.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');

      // 移动到第一个路径点
      patrolSys.update(0.5);
      const state1 = patrolSys.getPatrolState('npc-1');
      expect(state1!.currentWaypointIndex).toBe(1);

      // 继续移动到第二个路径点
      patrolSys.update(0.5);
      const state2 = patrolSys.getPatrolState('npc-1');
      expect(state2!.currentWaypointIndex).toBe(2);
    });

    it('NPC反向移动（折返后）', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        speed: 100.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');

      // 到达端点并暂停
      patrolSys.update(1.0);
      // 等待暂停结束
      patrolSys.update(2.0);

      // 反向移动
      patrolSys.update(0.05);
      const pos = patrolSys.getNPCExactPosition('npc-1');
      expect(pos!.x).toBeLessThan(10);
    });

    it('路径被删除时NPC巡逻状态被清除', () => {
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.removePatrolPath('test-path-1');

      patrolSys.update(0.016);
      expect(patrolSys.getPatrolState('npc-1')).toBeUndefined();
    });

    it('手动暂停NPC巡逻', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        speed: 10.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.pausePatrol('npc-1', 5.0);

      // 暂停期间不移动
      patrolSys.update(1.0);
      const pos = patrolSys.getNPCExactPosition('npc-1');
      expect(pos!.x).toBe(0);
    });

    it('手动暂停后自动恢复', () => {
      patrolSys.registerPatrolPath(createTestPath({
        waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        speed: 10.0,
      }));
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.pausePatrol('npc-1', 1.0);

      // 暂停1秒
      patrolSys.update(0.5);
      expect(patrolSys.getPatrolState('npc-1')!.isPatrolling).toBe(false);

      // 暂停结束
      patrolSys.update(1.0);
      expect(patrolSys.getPatrolState('npc-1')!.isPatrolling).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 5. #2 NPC 刷新规则
  // ═══════════════════════════════════════════
  describe('#2 NPC 刷新规则', () => {
    let depsWithNPC: ISystemDeps;

    beforeEach(() => {
      depsWithNPC = mockDepsWithNPC();
      patrolSys = createPatrolSystem(depsWithNPC);
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.registerSpawnTemplate(createTestTemplate());
    });

    it('registerSpawnTemplate 注册模板', () => {
      patrolSys.registerSpawnTemplate(createTestTemplate({ id: 't2' }));
      expect(patrolSys.getSpawnTemplate('t2')).toBeDefined();
    });

    it('registerSpawnTemplates 批量注册', () => {
      patrolSys.registerSpawnTemplates([
        createTestTemplate({ id: 't2' }),
        createTestTemplate({ id: 't3' }),
      ]);
      expect(patrolSys.getAllSpawnTemplates()).toHaveLength(3);
    });

    it('getSpawnConfig 返回默认配置', () => {
      const config = patrolSys.getSpawnConfig();
      expect(config.spawnInterval).toBe(30);
      expect(config.maxNPCCount).toBe(20);
      expect(config.maxNPCPerRegion).toBe(8);
    });

    it('setSpawnConfig 更新配置', () => {
      patrolSys.setSpawnConfig({ maxNPCCount: 5 });
      const config = patrolSys.getSpawnConfig();
      expect(config.maxNPCCount).toBe(5);
      expect(config.spawnInterval).toBe(30); // 未修改的保持不变
    });

    it('trySpawnNPC 成功刷新', () => {
      const result = patrolSys.trySpawnNPC();
      expect(result.success).toBe(true);
      expect(result.npcId).toBeTruthy();
    });

    it('trySpawnNPC 刷新后分配巡逻路径', () => {
      const result = patrolSys.trySpawnNPC();
      expect(result.success).toBe(true);
      const state = patrolSys.getPatrolState(result.npcId!);
      expect(state).toBeDefined();
      expect(state!.patrolPathId).toBe('test-path-1');
    });

    it('trySpawnNPC 记录刷新记录', () => {
      patrolSys.trySpawnNPC();
      const records = patrolSys.getSpawnRecords();
      expect(records).toHaveLength(1);
      expect(records[0].templateId).toBe('template-1');
    });

    it('trySpawnNPC 触发事件', () => {
      patrolSys.trySpawnNPC();
      expect(depsWithNPC.eventBus.emit).toHaveBeenCalledWith(
        'patrol:npc_spawned',
        expect.objectContaining({
          templateId: 'template-1',
          region: 'wei',
        }),
      );
    });

    it('trySpawnNPC 达到全局上限时失败', () => {
      patrolSys.setSpawnConfig({ maxNPCCount: 0 });
      const result = patrolSys.trySpawnNPC();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('上限');
    });

    it('trySpawnNPC 达到区域上限时失败', () => {
      patrolSys.setSpawnConfig({ maxNPCPerRegion: 0 });
      const result = patrolSys.trySpawnNPC();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('区域');
    });

    it('trySpawnNPC 无模板时失败', () => {
      patrolSys.reset();
      patrolSys.registerPatrolPath(createTestPath());
      const result = patrolSys.trySpawnNPC();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('模板');
    });

    it('定时刷新触发（update累积时间）', () => {
      patrolSys.setSpawnConfig({ spawnInterval: 5, autoSpawnEnabled: true });
      const initialRecords = patrolSys.getSpawnRecords().length;

      // 累积5秒
      patrolSys.update(5.1);

      expect(patrolSys.getSpawnRecords().length).toBeGreaterThan(initialRecords);
    });

    it('禁用自动刷新时不刷新', () => {
      patrolSys.setSpawnConfig({ autoSpawnEnabled: false, spawnInterval: 0.1 });
      patrolSys.update(1.0);
      expect(patrolSys.getSpawnRecords()).toHaveLength(0);
    });

    it('forceSpawn 强制刷新', () => {
      const result = patrolSys.forceSpawn();
      expect(result.success).toBe(true);
    });

    it('getSpawnTimer 返回计时器值', () => {
      patrolSys.setSpawnConfig({ autoSpawnEnabled: true, spawnInterval: 30 });
      patrolSys.update(10);
      expect(patrolSys.getSpawnTimer()).toBeCloseTo(10, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 存档序列化
  // ═══════════════════════════════════════════
  describe('存档序列化', () => {
    it('exportSaveData 导出完整存档', () => {
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.update(5); // 推进spawnTimer

      const save = patrolSys.exportSaveData();
      expect(save.patrolStates).toHaveLength(1);
      expect(save.patrolStates[0].npcId).toBe('npc-1');
      expect(save.spawnTimer).toBeCloseTo(5, 0);
      expect(save.version).toBe(1);
    });

    it('importSaveData 恢复存档', () => {
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      const save = patrolSys.exportSaveData();

      const newSys = createPatrolSystem();
      newSys.registerPatrolPath(createTestPath());
      newSys.importSaveData(save);

      const state = newSys.getPatrolState('npc-1');
      expect(state).toBeDefined();
      expect(state!.patrolPathId).toBe('test-path-1');
    });

    it('importSaveData 覆盖现有数据', () => {
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.assignPatrol('npc-old', 'test-path-1');

      const save = {
        patrolStates: [{
          npcId: 'npc-new',
          patrolPathId: 'test-path-1',
          currentWaypointIndex: 1,
          direction: -1 as const,
          exactPosition: { x: 5, y: 0 },
          isPatrolling: true,
          pauseTimer: 0,
        }],
        spawnRecords: [],
        spawnTimer: 0,
        version: 1,
      };

      patrolSys.importSaveData(save);
      expect(patrolSys.getPatrolState('npc-old')).toBeUndefined();
      expect(patrolSys.getPatrolState('npc-new')).toBeDefined();
    });
  });
});
