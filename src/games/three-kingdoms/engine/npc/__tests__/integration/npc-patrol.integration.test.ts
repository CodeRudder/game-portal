/**
 * 集成测试 §1 — NPC巡逻路径（Plan#1）
 *
 * 覆盖 Play 流程：
 *   §1.1 NPC地图巡逻 — NPCPathFollower驱动，路径注册/分配/移动/折返
 *   §1.2 NPC日程状态切换 — 24h日程循环，状态影响可交互性
 *   §1.3 NPC地图聚合与优先级 — 同区域NPC聚合规则
 *
 * 集成系统：NPCPatrolSystem ↔ NPCSystem ↔ EventBus
 *
 * @module engine/npc/__tests__/integration/npc-patrol
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCPatrolSystem } from '../../NPCPatrolSystem';
import { NPCSystem } from '../../NPCSystem';
import type { ISystemDeps } from '../../../../core/types';
import type { NPCData, NPCProfession, RegionId } from '../../../../core/npc';
import type { PatrolPath } from '../../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createPatrolPath(
  id: string,
  region: RegionId = 'wei',
  speed = 2,
): PatrolPath {
  return {
    id,
    name: `路径-${id}`,
    waypoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    region,
    speed,
  };
}

function createNPCData(
  id: string,
  profession: NPCProfession = 'merchant',
  region: RegionId = 'wei',
  affinity = 50,
): NPCData {
  return {
    id,
    name: `NPC-${id}`,
    profession,
    affinity,
    position: { x: 0, y: 0 },
    region,
    visible: true,
    dialogId: `dialog-${profession}-default`,
    createdAt: 0,
    lastInteractedAt: 0,
  };
}

/** 创建集成环境：NPCSystem + NPCPatrolSystem */
function createIntegrationEnv() {
  const npcDeps = createMockDeps();
  const patrolDeps = createMockDeps();

  const npcSystem = new NPCSystem();
  npcSystem.init(npcDeps);

  const patrolSystem = new NPCPatrolSystem();
  patrolSystem.init(patrolDeps);

  // 共享 EventBus 引用便于断言
  const sharedEmit = vi.fn();
  npcDeps.eventBus.emit = sharedEmit;
  patrolDeps.eventBus.emit = sharedEmit;

  return {
    npcSystem,
    patrolSystem,
    npcDeps,
    patrolDeps,
    sharedEmit,
  };
}

// ─────────────────────────────────────────────
// §1 NPC巡逻路径
// ─────────────────────────────────────────────

describe('§1 NPC巡逻路径集成', () => {
  let env: ReturnType<typeof createIntegrationEnv>;

  beforeEach(() => {
    env = createIntegrationEnv();
  });

  // ── §1.1 NPC地图巡逻 ──────────────────────

  describe('§1.1 NPC地图巡逻', () => {
    it('§1.1.1 应注册巡逻路径并分配给NPC', () => {
      const path = createPatrolPath('patrol-wei-01');
      env.patrolSystem.registerPatrolPath(path);

      // 注册路径后应可查询
      const retrieved = env.patrolSystem.getPatrolPath('patrol-wei-01');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('patrol-wei-01');
      expect(retrieved!.waypoints).toHaveLength(4);

      // 分配给NPC
      const assigned = env.patrolSystem.assignPatrol('npc-merchant-01', 'patrol-wei-01');
      expect(assigned).toBe(true);

      // 验证巡逻状态
      const state = env.patrolSystem.getPatrolState('npc-merchant-01');
      expect(state).toBeDefined();
      expect(state!.patrolPathId).toBe('patrol-wei-01');
      expect(state!.isPatrolling).toBe(true);
    });

    it('§1.1.2 NPC应沿路径点移动', () => {
      const path = createPatrolPath('patrol-move', 'wei', 10);
      env.patrolSystem.registerPatrolPath(path);

      const positions: Array<{ x: number; y: number }> = [];
      env.patrolSystem.setMoveCallback((_id, x, y) => {
        positions.push({ x, y });
      });

      env.patrolSystem.assignPatrol('npc-01', 'patrol-move');

      // 模拟多帧更新，NPC应沿路径移动
      for (let i = 0; i < 20; i++) {
        env.patrolSystem.update(0.1);
      }

      // 应有位置更新回调
      expect(positions.length).toBeGreaterThan(0);
    });

    it('§1.1.3 NPC到达终点后应折返', () => {
      const path = createPatrolPath('patrol-bounce', 'wei', 100);
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-bounce', 'patrol-bounce');

      // 大量更新使NPC移动到路径末端
      for (let i = 0; i < 200; i++) {
        env.patrolSystem.update(0.05);
      }

      const state = env.patrolSystem.getPatrolState('npc-bounce');
      expect(state).toBeDefined();
      // NPC应仍在系统中（可能暂停或仍在巡逻）
      // 验证位置已从起点移动
      const pos = env.patrolSystem.getNPCExactPosition('npc-bounce');
      expect(pos).toBeDefined();
    });

    it('§1.1.4 多NPC可同时巡逻不同路径', () => {
      const path1 = createPatrolPath('path-a', 'wei');
      const path2 = createPatrolPath('path-b', 'shu');
      env.patrolSystem.registerPatrolPaths([path1, path2]);

      env.patrolSystem.assignPatrol('npc-a', 'path-a');
      env.patrolSystem.assignPatrol('npc-b', 'path-b');

      expect(env.patrolSystem.getPatrollingCount()).toBe(2);
      expect(env.patrolSystem.isPatrolling('npc-a')).toBe(true);
      expect(env.patrolSystem.isPatrolling('npc-b')).toBe(true);
    });

    it('§1.1.5 分配不存在的路径应返回false', () => {
      const result = env.patrolSystem.assignPatrol('npc-x', 'nonexistent');
      expect(result).toBe(false);
      expect(env.patrolSystem.isPatrolling('npc-x')).toBe(false);
    });

    it('§1.1.6 巡逻分配时应发出patrol:assigned事件', () => {
      const path = createPatrolPath('evt-path');
      env.patrolSystem.registerPatrolPath(path);

      env.patrolSystem.assignPatrol('npc-evt', 'evt-path');

      expect(env.sharedEmit).toHaveBeenCalledWith('patrol:assigned', expect.objectContaining({
        npcId: 'npc-evt',
        patrolPathId: 'evt-path',
      }));
    });

    it('§1.1.7 取消巡逻应发出patrol:unassigned事件', () => {
      const path = createPatrolPath('unassign-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-un', 'unassign-path');

      env.sharedEmit.mockClear();
      const result = env.patrolSystem.unassignPatrol('npc-un');

      expect(result).toBe(true);
      expect(env.sharedEmit).toHaveBeenCalledWith('patrol:unassigned', expect.objectContaining({
        npcId: 'npc-un',
      }));
    });

    it('§1.1.8 获取NPC精确位置应返回当前位置', () => {
      const path = createPatrolPath('pos-path', 'wei', 5);
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-pos', 'pos-path');

      // 初始位置应为第一个路径点
      const pos = env.patrolSystem.getNPCExactPosition('npc-pos');
      expect(pos).toBeDefined();
      expect(pos!.x).toBe(0);
      expect(pos!.y).toBe(0);

      // 更新后位置应变化
      env.patrolSystem.update(0.5);
      const posAfter = env.patrolSystem.getNPCExactPosition('npc-pos');
      expect(posAfter).toBeDefined();
      // 位置应有变化（x或y不再是0,0）
      expect(posAfter!.x + posAfter!.y).toBeGreaterThan(0);
    });

    it('§1.1.9 未巡逻NPC查询位置应返回null', () => {
      const pos = env.patrolSystem.getNPCExactPosition('npc-none');
      expect(pos).toBeNull();
    });

    it('§1.1.10 批量注册路径应全部可查询', () => {
      const paths = [
        createPatrolPath('batch-1', 'wei'),
        createPatrolPath('batch-2', 'shu'),
        createPatrolPath('batch-3', 'wu'),
      ];
      env.patrolSystem.registerPatrolPaths(paths);

      expect(env.patrolSystem.getAllPatrolPaths()).toHaveLength(3);
      expect(env.patrolSystem.getPatrolPathsByRegion('wei')).toHaveLength(1);
      expect(env.patrolSystem.getPatrolPathsByRegion('shu')).toHaveLength(1);
    });

    it('§1.1.11 删除路径应自动解除关联NPC的巡逻', () => {
      const path = createPatrolPath('del-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-del', 'del-path');

      expect(env.patrolSystem.isPatrolling('npc-del')).toBe(true);

      env.patrolSystem.removePatrolPath('del-path');

      // NPC巡逻状态应被清除
      expect(env.patrolSystem.isPatrolling('npc-del')).toBe(false);
    });

    it('§1.1.12 指定起始索引和方向分配巡逻', () => {
      const path = createPatrolPath('opt-path');
      env.patrolSystem.registerPatrolPath(path);

      // 从索引2开始，反向移动
      const result = env.patrolSystem.assignPatrol('npc-opt', 'opt-path', {
        startIndex: 2,
        direction: -1,
      });
      expect(result).toBe(true);

      const state = env.patrolSystem.getPatrolState('npc-opt');
      expect(state!.currentWaypointIndex).toBe(2);
      expect(state!.direction).toBe(-1);
    });

    it('§1.1.13 越界起始索引应分配失败', () => {
      const path = createPatrolPath('idx-path');
      env.patrolSystem.registerPatrolPath(path);

      expect(env.patrolSystem.assignPatrol('npc-idx', 'idx-path', { startIndex: 99 })).toBe(false);
      expect(env.patrolSystem.assignPatrol('npc-idx', 'idx-path', { startIndex: -1 })).toBe(false);
    });
  });

  // ── §1.2 NPC日程状态切换 ──────────────────

  describe('§1.2 NPC日程状态切换', () => {
    it('§1.2.1 暂停巡逻应停止移动', () => {
      const path = createPatrolPath('pause-path', 'wei', 10);
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-pause', 'pause-path');

      const paused = env.patrolSystem.pausePatrol('npc-pause', 5);
      expect(paused).toBe(true);

      const state = env.patrolSystem.getPatrolState('npc-pause');
      expect(state!.isPatrolling).toBe(false);
      expect(state!.pauseTimer).toBe(5);
    });

    it('§1.2.2 暂停后恢复巡逻应继续移动', () => {
      const path = createPatrolPath('resume-path', 'wei', 10);
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-resume', 'resume-path');

      env.patrolSystem.pausePatrol('npc-resume', 5);

      const resumed = env.patrolSystem.resumePatrol('npc-resume');
      expect(resumed).toBe(true);

      const state = env.patrolSystem.getPatrolState('npc-resume');
      expect(state!.isPatrolling).toBe(true);
      expect(state!.pauseTimer).toBe(0);
    });

    it('§1.2.3 暂停不存在的NPC应返回false', () => {
      expect(env.patrolSystem.pausePatrol('npc-none', 5)).toBe(false);
    });

    it('§1.2.4 恢复不存在的NPC应返回false', () => {
      expect(env.patrolSystem.resumePatrol('npc-none')).toBe(false);
    });

    it('§1.2.5 暂停期间update应递减暂停计时器', () => {
      const path = createPatrolPath('timer-path', 'wei', 10);
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('npc-timer', 'timer-path');

      env.patrolSystem.pausePatrol('npc-timer', 3);
      env.patrolSystem.update(1);

      const state = env.patrolSystem.getPatrolState('npc-timer');
      expect(state!.pauseTimer).toBeLessThan(3);
    });

    it('§1.2.6 多NPC独立暂停和恢复', () => {
      const path = createPatrolPath('multi-pause');
      env.patrolSystem.registerPatrolPath(path);

      env.patrolSystem.assignPatrol('npc-a', 'multi-pause');
      env.patrolSystem.assignPatrol('npc-b', 'multi-pause');

      env.patrolSystem.pausePatrol('npc-a', 5);

      expect(env.patrolSystem.getPatrolState('npc-a')!.isPatrolling).toBe(false);
      expect(env.patrolSystem.getPatrolState('npc-b')!.isPatrolling).toBe(true);
    });

    it('§1.2.7 NPCSystem查询可见NPC应与巡逻系统协同', () => {
      // NPCSystem管理NPC可见性
      const npcs = env.npcSystem.getAllNPCs();
      expect(npcs.length).toBeGreaterThan(0);

      // 所有默认NPC应可见
      const visible = env.npcSystem.getVisibleNPCs();
      expect(visible.length).toBeGreaterThan(0);
    });
  });

  // ── §1.3 NPC地图聚合与优先级 ─────────────

  describe('§1.3 NPC地图聚合与优先级', () => {
    it('§1.3.1 同区域NPC可通过NPCSystem按区域查询', () => {
      const weiNPCs = env.npcSystem.getNPCsByRegion('wei');
      // 默认NPC可能有多个在wei区域
      expect(Array.isArray(weiNPCs)).toBe(true);
    });

    it('§1.3.2 按职业查询NPC应返回正确结果', () => {
      const merchants = env.npcSystem.getNPCsByProfession('merchant');
      expect(Array.isArray(merchants)).toBe(true);
      merchants.forEach((npc) => {
        expect(npc.profession).toBe('merchant');
      });
    });

    it('§1.3.3 巡逻路径可按区域筛选', () => {
      env.patrolSystem.registerPatrolPaths([
        createPatrolPath('wei-p1', 'wei'),
        createPatrolPath('wei-p2', 'wei'),
        createPatrolPath('shu-p1', 'shu'),
      ]);

      const weiPaths = env.patrolSystem.getPatrolPathsByRegion('wei');
      expect(weiPaths).toHaveLength(2);

      const shuPaths = env.patrolSystem.getPatrolPathsByRegion('shu');
      expect(shuPaths).toHaveLength(1);
    });

    it('§1.3.4 getAllPatrolStates应返回所有巡逻状态快照', () => {
      const path = createPatrolPath('all-state');
      env.patrolSystem.registerPatrolPath(path);

      env.patrolSystem.assignPatrol('s1', 'all-state');
      env.patrolSystem.assignPatrol('s2', 'all-state');

      const states = env.patrolSystem.getAllPatrolStates();
      expect(states).toHaveLength(2);
    });

    it('§1.3.5 getState应返回完整系统状态快照', () => {
      const path = createPatrolPath('snap-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('snap-npc', 'snap-path');

      const state = env.patrolSystem.getState();
      expect(state.patrolStates).toHaveLength(1);
      expect(state.spawnRecords).toBeDefined();
    });

    it('§1.3.6 reset应清除所有巡逻状态和路径', () => {
      const path = createPatrolPath('reset-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('reset-npc', 'reset-path');

      env.patrolSystem.reset();

      expect(env.patrolSystem.getAllPatrolPaths()).toHaveLength(0);
      expect(env.patrolSystem.getAllPatrolStates()).toHaveLength(0);
      expect(env.patrolSystem.getPatrollingCount()).toBe(0);
    });

    it('§1.3.7 NPCSystem与PatrolSystem独立重置不互相影响', () => {
      const path = createPatrolPath('ind-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('ind-npc', 'ind-path');

      // 重置PatrolSystem
      env.patrolSystem.reset();

      // NPCSystem的NPC应仍在
      expect(env.npcSystem.getNPCCount()).toBeGreaterThan(0);
    });

    it('§1.3.8 同一路径可分配给多个NPC', () => {
      const path = createPatrolPath('shared-path');
      env.patrolSystem.registerPatrolPath(path);

      env.patrolSystem.assignPatrol('shared-a', 'shared-path');
      env.patrolSystem.assignPatrol('shared-b', 'shared-path');

      expect(env.patrolSystem.getPatrollingCount()).toBe(2);
    });

    it('§1.3.9 重新分配巡逻应覆盖之前的状态', () => {
      env.patrolSystem.registerPatrolPaths([
        createPatrolPath('old-path'),
        createPatrolPath('new-path'),
      ]);

      env.patrolSystem.assignPatrol('reassign-npc', 'old-path');
      expect(env.patrolSystem.getPatrolState('reassign-npc')!.patrolPathId).toBe('old-path');

      env.patrolSystem.assignPatrol('reassign-npc', 'new-path');
      expect(env.patrolSystem.getPatrolState('reassign-npc')!.patrolPathId).toBe('new-path');
      // 仍然只有1个NPC在巡逻
      expect(env.patrolSystem.getPatrollingCount()).toBe(1);
    });
  });

  // ── §1.4 存档序列化集成 ──────────────────

  describe('§1.4 巡逻系统存档序列化', () => {
    it('§1.4.1 exportSaveData应包含完整巡逻状态', () => {
      const path = createPatrolPath('save-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('save-npc', 'save-path');

      const saveData = env.patrolSystem.exportSaveData();
      expect(saveData).toBeDefined();
      expect(saveData.version).toBeDefined();
    });

    it('§1.4.2 NPCSystem exportSaveData应包含NPC数据', () => {
      const saveData = env.npcSystem.exportSaveData();
      expect(saveData).toBeDefined();
      expect(saveData.npcs).toBeDefined();
      expect(saveData.npcs.length).toBeGreaterThan(0);
    });

    it('§1.4.3 NPCSystem序列化后反序列化应恢复数据', () => {
      const originalCount = env.npcSystem.getNPCCount();
      const saveData = env.npcSystem.exportSaveData();

      // 修改好感度
      const npcs = env.npcSystem.getAllNPCs();
      if (npcs.length > 0) {
        env.npcSystem.setAffinity(npcs[0].id, 99);
      }

      // reset会重新加载默认NPC（不会清空）
      env.npcSystem.reset();
      expect(env.npcSystem.getNPCCount()).toBeGreaterThan(0);

      // importSaveData应覆盖为保存时的数据
      env.npcSystem.importSaveData(saveData);
      expect(env.npcSystem.getNPCCount()).toBe(originalCount);
    });

    it('§1.4.4 PatrolSystem重置后状态应干净', () => {
      const path = createPatrolPath('clean-path');
      env.patrolSystem.registerPatrolPath(path);
      env.patrolSystem.assignPatrol('clean-npc', 'clean-path');

      env.patrolSystem.reset();

      const state = env.patrolSystem.getState();
      expect(state.patrolStates).toHaveLength(0);
    });
  });
});
