/**
 * PatrolPathCalculator 单元测试
 *
 * 覆盖：updateSinglePatrol、updateAllPatrols
 * 测试场景：暂停/恢复、路径点到达、折返、插值移动、多NPC巡逻
 */
import { describe, it, expect, vi } from 'vitest';
import { PatrolPathCalculator } from '../PatrolPathCalculator';
import type { RuntimePatrolState } from '../PatrolPathCalculator';
import type { PatrolPath } from '../../../core/npc';

function makePath(overrides: Partial<PatrolPath> = {}): PatrolPath {
  return {
    id: 'path-1',
    name: '测试路径',
    waypoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    region: 'region-1',
    speed: 5, // 5格/秒
    ...overrides,
  };
}

function makeState(overrides: Partial<RuntimePatrolState> = {}): RuntimePatrolState {
  return {
    npcId: 'npc-1',
    patrolPathId: 'path-1',
    currentWaypointIndex: 0,
    direction: 1,
    exactPosition: { x: 0, y: 0 },
    isPatrolling: true,
    pauseTimer: 0,
    ...overrides,
  };
}

describe('PatrolPathCalculator', () => {
  const calculator = new PatrolPathCalculator();

  describe('updateSinglePatrol', () => {
    it('正常向目标路径点移动', () => {
      const state = makeState({
        exactPosition: { x: 0, y: 0 },
        currentWaypointIndex: 0,
        direction: 1,
        isPatrolling: true,
      });
      const path = makePath();
      const moveCb = vi.fn();

      // dt=1, speed=5, 移动5格
      calculator.updateSinglePatrol('npc-1', state, path, 1, moveCb);

      // 应该到达 wp[1] (10,0) — 距离10, 移动5格, 未到达
      expect(state.exactPosition.x).toBeCloseTo(5, 2);
      expect(state.exactPosition.y).toBe(0);
      expect(moveCb).toHaveBeenCalled();
    });

    it('到达路径点后前进到下一个', () => {
      const state = makeState({
        exactPosition: { x: 9.9, y: 0 },
        currentWaypointIndex: 0,
        direction: 1,
        isPatrolling: true,
      });
      const path = makePath();
      const moveCb = vi.fn();
      const emitCb = vi.fn();

      // dt=1, speed=5, 距离到wp[1]=0.1, 很快到达，然后继续
      calculator.updateSinglePatrol('npc-1', state, path, 1, moveCb, emitCb);

      // 应该至少到达 wp[1]
      expect(state.currentWaypointIndex).toBeGreaterThanOrEqual(1);
      expect(emitCb).toHaveBeenCalledWith('npc:patrol_waypoint_reached', expect.objectContaining({
        npcId: 'npc-1',
      }));
    });

    it('到达端点时折返并暂停', () => {
      const state = makeState({
        exactPosition: { x: 10, y: 10 },
        currentWaypointIndex: 2, // 最后一个路径点
        direction: 1,
        isPatrolling: true,
      });
      const path = makePath();
      const emitCb = vi.fn();

      calculator.updateSinglePatrol('npc-1', state, path, 0.5, undefined, emitCb);

      expect(state.direction).toBe(-1);
      expect(state.isPatrolling).toBe(false);
      expect(state.pauseTimer).toBeGreaterThan(0);
      expect(emitCb).toHaveBeenCalledWith('npc:patrol_turned', expect.objectContaining({
        npcId: 'npc-1',
        direction: -1,
      }));
    });

    it('反向到达端点时折返', () => {
      const state = makeState({
        exactPosition: { x: 0, y: 0 },
        currentWaypointIndex: 0,
        direction: -1,
        isPatrolling: true,
      });
      const path = makePath();

      calculator.updateSinglePatrol('npc-1', state, path, 0.5);

      expect(state.direction).toBe(1);
      expect(state.isPatrolling).toBe(false);
    });

    it('暂停中倒计时恢复', () => {
      const state = makeState({
        isPatrolling: false,
        pauseTimer: 0.5,
      });
      const path = makePath();

      calculator.updateSinglePatrol('npc-1', state, path, 0.3);
      expect(state.pauseTimer).toBeCloseTo(0.2, 5);
      expect(state.isPatrolling).toBe(false);

      calculator.updateSinglePatrol('npc-1', state, path, 0.3);
      expect(state.pauseTimer).toBe(0);
      expect(state.isPatrolling).toBe(true);
    });

    it('暂停中不移动', () => {
      const state = makeState({
        isPatrolling: false,
        pauseTimer: 2.0,
        exactPosition: { x: 5, y: 5 },
      });
      const path = makePath();
      const moveCb = vi.fn();

      calculator.updateSinglePatrol('npc-1', state, path, 1, moveCb);

      expect(state.exactPosition.x).toBe(5);
      expect(state.exactPosition.y).toBe(5);
      expect(moveCb).not.toHaveBeenCalled();
    });

    it('回调可选', () => {
      const state = makeState();
      const path = makePath();

      expect(() => calculator.updateSinglePatrol('npc-1', state, path, 1)).not.toThrow();
    });

    it('一帧内可到达多个路径点', () => {
      const state = makeState({
        exactPosition: { x: 0, y: 0 },
        currentWaypointIndex: 0,
        direction: 1,
        isPatrolling: true,
      });
      const path = makePath({ speed: 100 }); // 非常快
      const emitCb = vi.fn();

      calculator.updateSinglePatrol('npc-1', state, path, 1, undefined, emitCb);

      // 应该到达了多个路径点
      expect(state.currentWaypointIndex).toBeGreaterThan(0);
    });
  });

  describe('updateAllPatrols', () => {
    it('更新所有巡逻 NPC', () => {
      const state1 = makeState({ npcId: 'npc-1', exactPosition: { x: 0, y: 0 } });
      const state2 = makeState({
        npcId: 'npc-2',
        patrolPathId: 'path-1',
        exactPosition: { x: 5, y: 0 },
        currentWaypointIndex: 1,
      });
      const patrolStates = new Map([
        ['npc-1', state1],
        ['npc-2', state2],
      ]);
      const paths = new Map([['path-1', makePath()]]);
      const moveCb = vi.fn();

      calculator.updateAllPatrols(patrolStates, paths, 0.5, moveCb);

      expect(moveCb).toHaveBeenCalled();
    });

    it('路径不存在时跳过', () => {
      const state = makeState({ patrolPathId: 'not-exist' });
      const patrolStates = new Map([['npc-1', state]]);
      const paths = new Map();
      const moveCb = vi.fn();

      expect(() => calculator.updateAllPatrols(patrolStates, paths, 0.5, moveCb)).not.toThrow();
      expect(moveCb).not.toHaveBeenCalled();
    });

    it('空状态不报错', () => {
      const patrolStates = new Map();
      const paths = new Map();
      expect(() => calculator.updateAllPatrols(patrolStates, paths, 0.5)).not.toThrow();
    });
  });
});
