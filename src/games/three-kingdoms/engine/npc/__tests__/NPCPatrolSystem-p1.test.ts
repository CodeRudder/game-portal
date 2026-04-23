/**
 * NPCPatrolSystem 单元测试
 *
 * 覆盖 NPC 巡逻与刷新系统的所有功能：
 * - #1 NPC巡逻路径：路径注册、分配、移动、折返
 * - #2 NPC刷新规则：定时刷新、同屏数量控制
 * - ISubsystem 接口
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
        region: 'central_plains' as RegionId,
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
    region: 'central_plains',
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
    region: 'central_plains',
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
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 npcPatrol', () => {
      expect(patrolSys.name).toBe('npcPatrol');
    });

    it('init 不抛异常', () => {
      expect(() => createPatrolSystem()).not.toThrow();
    });

    it('getState 返回初始状态', () => {
      const state = patrolSys.getState();
      expect(state.patrolStates).toEqual([]);
      expect(state.spawnRecords).toEqual([]);
    });

    it('reset 恢复初始状态', () => {
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.reset();
      const state = patrolSys.getState();
      expect(state.patrolStates).toEqual([]);
      expect(patrolSys.getAllPatrolPaths()).toEqual([]);
    });

    it('update 不抛异常', () => {
      expect(() => patrolSys.update(0.016)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. #1 巡逻路径管理
  // ═══════════════════════════════════════════
  describe('#1 巡逻路径管理', () => {
    it('registerPatrolPath 注册路径', () => {
      patrolSys.registerPatrolPath(createTestPath());
      const path = patrolSys.getPatrolPath('test-path-1');
      expect(path).toBeDefined();
      expect(path!.name).toBe('测试路径');
      expect(path!.waypoints).toHaveLength(3);
    });

    it('registerPatrolPath 至少需要2个路径点', () => {
      expect(() =>
        patrolSys.registerPatrolPath({ ...createTestPath(), waypoints: [{ x: 0, y: 0 }] })
      ).toThrow('至少需要2个路径点');
    });

    it('registerPatrolPath 触发事件', () => {
      patrolSys.registerPatrolPath(createTestPath());
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'patrol:path_registered',
        { pathId: 'test-path-1' },
      );
    });

    it('registerPatrolPaths 批量注册', () => {
      patrolSys.registerPatrolPaths([
        createTestPath({ id: 'path-1' }),
        createTestPath({ id: 'path-2' }),
      ]);
      expect(patrolSys.getAllPatrolPaths()).toHaveLength(2);
    });

    it('getPatrolPath 不存在返回 undefined', () => {
      expect(patrolSys.getPatrolPath('non-existent')).toBeUndefined();
    });

    it('getAllPatrolPaths 返回所有路径', () => {
      patrolSys.registerPatrolPaths([
        createTestPath({ id: 'path-1' }),
        createTestPath({ id: 'path-2', region: 'jiangnan' }),
      ]);
      expect(patrolSys.getAllPatrolPaths()).toHaveLength(2);
    });

    it('getPatrolPathsByRegion 按区域过滤', () => {
      patrolSys.registerPatrolPaths([
        createTestPath({ id: 'path-1', region: 'central_plains' }),
        createTestPath({ id: 'path-2', region: 'jiangnan' }),
      ]);
      const result = patrolSys.getPatrolPathsByRegion('central_plains');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('path-1');
    });

    it('removePatrolPath 删除路径', () => {
      patrolSys.registerPatrolPath(createTestPath());
      expect(patrolSys.removePatrolPath('test-path-1')).toBe(true);
      expect(patrolSys.getPatrolPath('test-path-1')).toBeUndefined();
    });

    it('removePatrolPath 同时移除关联巡逻状态', () => {
      patrolSys.registerPatrolPath(createTestPath());
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.removePatrolPath('test-path-1');
      expect(patrolSys.getPatrolState('npc-1')).toBeUndefined();
    });

    it('removePatrolPath 不存在返回 false', () => {
      expect(patrolSys.removePatrolPath('non-existent')).toBe(false);
    });

    it('getPatrolPath 返回副本', () => {
      patrolSys.registerPatrolPath(createTestPath());
      const path1 = patrolSys.getPatrolPath('test-path-1');
      path1!.name = 'modified';
      const path2 = patrolSys.getPatrolPath('test-path-1');
      expect(path2!.name).toBe('测试路径');
    });
  });

  // ═══════════════════════════════════════════
  // 3. #1 NPC 巡逻分配与控制
  // ═══════════════════════════════════════════
  describe('#1 NPC 巡逻分配与控制', () => {
    beforeEach(() => {
      patrolSys.registerPatrolPath(createTestPath());
    });

    it('assignPatrol 分配成功', () => {
      const result = patrolSys.assignPatrol('npc-1', 'test-path-1');
      expect(result).toBe(true);
      const state = patrolSys.getPatrolState('npc-1');
      expect(state).toBeDefined();
      expect(state!.patrolPathId).toBe('test-path-1');
      expect(state!.currentWaypointIndex).toBe(0);
      expect(state!.direction).toBe(1);
      expect(state!.isPatrolling).toBe(true);
    });

    it('assignPatrol 路径不存在返回 false', () => {
      expect(patrolSys.assignPatrol('npc-1', 'non-existent')).toBe(false);
    });

    it('assignPatrol 自定义起始索引和方向', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1', { startIndex: 2, direction: -1 });
      const state = patrolSys.getPatrolState('npc-1');
      expect(state!.currentWaypointIndex).toBe(2);
      expect(state!.direction).toBe(-1);
    });

    it('assignPatrol 无效索引返回 false', () => {
      expect(patrolSys.assignPatrol('npc-1', 'test-path-1', { startIndex: 99 })).toBe(false);
      expect(patrolSys.assignPatrol('npc-1', 'test-path-1', { startIndex: -1 })).toBe(false);
    });

    it('assignPatrol 触发事件', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'patrol:assigned',
        expect.objectContaining({ npcId: 'npc-1', patrolPathId: 'test-path-1' }),
      );
    });

    it('unassignPatrol 移除分配', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      expect(patrolSys.unassignPatrol('npc-1')).toBe(true);
      expect(patrolSys.getPatrolState('npc-1')).toBeUndefined();
    });

    it('unassignPatrol 不存在的NPC返回 false', () => {
      expect(patrolSys.unassignPatrol('non-existent')).toBe(false);
    });

    it('pausePatrol 暂停巡逻', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      expect(patrolSys.pausePatrol('npc-1', 2.0)).toBe(true);
      const state = patrolSys.getPatrolState('npc-1');
      expect(state!.isPatrolling).toBe(false);
      expect(state!.pauseTimer).toBe(2.0);
    });

    it('resumePatrol 恢复巡逻', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      patrolSys.pausePatrol('npc-1', 5.0);
      expect(patrolSys.resumePatrol('npc-1')).toBe(true);
      const state = patrolSys.getPatrolState('npc-1');
      expect(state!.isPatrolling).toBe(true);
      expect(state!.pauseTimer).toBe(0);
    });

    it('getNPCExactPosition 返回当前位置', () => {
      patrolSys.assignPatrol('npc-1', 'test-path-1');
      const pos = patrolSys.getNPCExactPosition('npc-1');
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it('getNPCExactPosition 不存在的NPC返回 null', () => {
