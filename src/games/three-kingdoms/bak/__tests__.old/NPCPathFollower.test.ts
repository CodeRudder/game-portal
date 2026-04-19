/**
 * NPCPathFollower 单元测试
 *
 * 覆盖：初始化、路径规划、平滑移动、到达检测、方向判断、速度设置、移除、障碍物绕行
 */

import { describe, it, expect } from 'vitest';
import { NPCPathFollower } from '../NPCPathFollower';

// ---------------------------------------------------------------------------
// 辅助：生成简单可通行地图
// ---------------------------------------------------------------------------

/** 创建 rows×cols 全可通行地图 */
function makeOpenMap(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(true));
}

/** 创建带障碍的 7×7 地图，中间 3×3 不可通行 */
function makeBlockedMap(): boolean[][] {
  const map = makeOpenMap(7, 7);
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) {
      map[y][x] = false;
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('NPCPathFollower', () => {
  const TILE = 64;

  it('应正确初始化移动状态', () => {
    const follower = new NPCPathFollower(TILE);
    follower.initMovement('npc1', 3, 5);

    const pos = follower.getPosition('npc1');
    expect(pos.tileX).toBe(3);
    expect(pos.tileY).toBe(5);
    expect(pos.pixelX).toBe(3 * TILE);
    expect(pos.pixelY).toBe(5 * TILE);
    expect(follower.hasArrived('npc1')).toBe(true);
  });

  it('应规划出有效路径', () => {
    const follower = new NPCPathFollower(TILE);
    const map = makeOpenMap(10, 10);
    follower.initMovement('npc1', 0, 0);

    const path = follower.planPath('npc1', 0, 0, 5, 5, map);

    expect(path.length).toBeGreaterThan(0);
    // 起点和终点正确
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 5 });
  });

  it('应平滑移动（位置逐步变化）', () => {
    const follower = new NPCPathFollower(TILE);
    const map = makeOpenMap(10, 10);
    follower.initMovement('npc1', 0, 0, TILE); // speed = 64 px/s

    follower.planPath('npc1', 0, 0, 3, 0, map);

    // 初始位置
    const pos0 = follower.getPosition('npc1');
    expect(pos0.pixelX).toBe(0);

    // 更新 0.5 秒 → 应移动了 32 像素
    const r1 = follower.updateMovement('npc1', 0.5);
    expect(r1.pixelX).toBeCloseTo(32, 1);
    expect(r1.arrived).toBe(false);

    // 再更新 0.5 秒 → 到达第 1 个路径点 (1, 0)
    const r2 = follower.updateMovement('npc1', 0.5);
    expect(r2.pixelX).toBe(TILE);
  });

  it('应正确检测到达目标', () => {
    const follower = new NPCPathFollower(TILE);
    const map = makeOpenMap(10, 10);
    // 速度设为足够大，确保一帧能覆盖整条路径
    // 路径长度 3 格 × 64 px = 192 px，speed × dt 必须超过 192
    follower.initMovement('npc1', 0, 0, 10000);
    follower.planPath('npc1', 0, 0, 2, 0, map);

    // 分多帧更新直到到达
    let result = follower.updateMovement('npc1', 1);
    for (let i = 0; i < 10 && !result.arrived; i++) {
      result = follower.updateMovement('npc1', 1);
    }
    expect(result.arrived).toBe(true);
    expect(result.tileX).toBe(2);
    expect(follower.hasArrived('npc1')).toBe(true);
  });

  it('应正确判断移动方向', () => {
    const follower = new NPCPathFollower(TILE);
    const map = makeOpenMap(10, 10);
    follower.initMovement('npc1', 0, 0, 9999);

    // 向右移动
    follower.planPath('npc1', 0, 0, 3, 0, map);
    const r1 = follower.updateMovement('npc1', 0.001);
    expect(r1.direction).toBe('right');

    // 重新初始化向下移动
    follower.initMovement('npc2', 0, 0, 9999);
    follower.planPath('npc2', 0, 0, 0, 3, map);
    const r2 = follower.updateMovement('npc2', 0.001);
    expect(r2.direction).toBe('down');
  });

  it('应支持动态修改速度', () => {
    const follower = new NPCPathFollower(TILE);
    follower.initMovement('npc1', 0, 0, 64);

    follower.setSpeed('npc1', 256);
    const state = follower.getAllStates().get('npc1');
    expect(state!.speed).toBe(256);
  });

  it('应正确移除 NPC', () => {
    const follower = new NPCPathFollower(TILE);
    follower.initMovement('npc1', 1, 1);
    follower.removeNPC('npc1');

    expect(follower.getPosition('npc1').pixelX).toBe(0);
    expect(follower.hasArrived('npc1')).toBe(true);
    expect(follower.getAllStates().has('npc1')).toBe(false);
  });

  it('应绕过障碍物寻路', () => {
    const follower = new NPCPathFollower(TILE);
    const map = makeBlockedMap(); // 7×7, 中间 3×3 不可通行
    follower.initMovement('npc1', 0, 3);

    // 从 (0,3) 到 (6,3)，中间有障碍墙
    const path = follower.planPath('npc1', 0, 3, 6, 3, map);

    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ x: 0, y: 3 });
    expect(path[path.length - 1]).toEqual({ x: 6, y: 3 });

    // 路径不应经过不可通行区域 (2-4, 2-4)
    for (const node of path) {
      expect(node.x >= 2 && node.x <= 4 && node.y >= 2 && node.y <= 4).toBe(false);
    }

    // 路径长度应大于直线距离（因为需要绕行）
    expect(path.length).toBeGreaterThan(7);
  });
});
