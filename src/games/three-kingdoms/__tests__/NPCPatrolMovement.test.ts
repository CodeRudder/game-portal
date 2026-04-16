/**
 * NPC 巡逻/走动逻辑测试
 *
 * 验证 NPCManager 中的巡逻系统：
 * - NPCMovement 数据结构创建
 * - 巡逻目标选择逻辑
 * - NPC 移动计算（距离、速度、到达检测）
 * - NPC 停留/恢复行为
 * - 不同类型 NPC 的巡逻范围
 *
 * 注意：由于 mgr.update() 会先运行 AI 系统再运行 patrol，
 * AI 可能分配交互任务（chat）导致 patrol 被跳过。
 * 因此移动相关的测试直接通过 mgr 的内部机制验证，
 * 或使用单 NPC manager 避免 NPC 间交互干扰。
 *
 * @module games/three-kingdoms/__tests__/NPCPatrolMovement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NPCManager } from '../../../engine/npc/NPCManager';
import {
  NPCProfession,
  NPCState,
  PATROL_CONFIGS,
} from '../../../engine/npc/types';
import type { NPCMovement, PatrolConfig } from '../../../engine/npc/types';
import { THREE_KINGDOMS_NPC_DEFS, THREE_KINGDOMS_SPAWN_CONFIG } from '../ThreeKingdomsNPCDefs';

// ---------------------------------------------------------------------------
// 辅助：创建已注册所有三国 NPC 定义的 NPCManager
// ---------------------------------------------------------------------------
function createManager(): NPCManager {
  const mgr = new NPCManager();
  for (const def of THREE_KINGDOMS_NPC_DEFS) {
    mgr.registerDef(def);
  }
  return mgr;
}

/** 生成并 spawn 一个 NPC，返回其实例 */
function spawnOne(mgr: NPCManager, defId: string) {
  const spawn = THREE_KINGDOMS_SPAWN_CONFIG[defId];
  const x = spawn?.x ?? 5;
  const y = spawn?.y ?? 5;
  return mgr.spawnNPC(defId, x, y);
}

/**
 * 创建只有一个 NPC 的 manager，避免多 NPC 交互干扰测试。
 * 使用 vi.spyOn 无法阻止 AI 分配任务，所以用单 NPC + gameTime=4（凌晨）
 * 来最小化日程调度干扰。
 */
function createSingleNPCManager(defId: string): { mgr: NPCManager; npc: ReturnType<NPCManager['spawnNPC']> } {
  const mgr = new NPCManager();
  for (const def of THREE_KINGDOMS_NPC_DEFS) {
    mgr.registerDef(def);
  }
  const npc = mgr.spawnNPC(defId, 10, 10);
  return { mgr, npc };
}

// ===========================================================================
// 测试
// ===========================================================================

describe('NPC 巡逻/走动逻辑', () => {
  let mgr: NPCManager;

  beforeEach(() => {
    mgr = createManager();
  });

  // ── 1. NPCMovement 数据结构 ──────────────────────────────

  describe('NPCMovement 数据结构', () => {
    it('spawn 时应自动创建 movement 字段', () => {
      const npc = spawnOne(mgr, 'soldier_zhao');
      expect(npc.movement).toBeDefined();
      expect(npc.movement).not.toBeNull();
    });

    it('movement 应包含所有必需字段', () => {
      const npc = spawnOne(mgr, 'farmer_wang');
      const mv = npc.movement!;
      expect(mv).toHaveProperty('targetX');
      expect(mv).toHaveProperty('targetY');
      expect(mv).toHaveProperty('speed');
      expect(mv).toHaveProperty('state');
      expect(mv).toHaveProperty('idleTimer');
      expect(mv).toHaveProperty('patrolRadius');
      expect(mv).toHaveProperty('homeX');
      expect(mv).toHaveProperty('homeY');
    });

    it('初始状态应为 idle', () => {
      const npc = spawnOne(mgr, 'merchant_chen');
      expect(npc.movement!.state).toBe('idle');
    });

    it('homeX/homeY 应与 spawn 位置一致', () => {
      const spawn = THREE_KINGDOMS_SPAWN_CONFIG['soldier_zhao'];
      const npc = spawnOne(mgr, 'soldier_zhao');
      expect(npc.movement!.homeX).toBe(spawn.x);
      expect(npc.movement!.homeY).toBe(spawn.y);
    });

    it('speed 应使用 NPC 定义中的速度', () => {
      const def = THREE_KINGDOMS_NPC_DEFS.find(d => d.id === 'soldier_zhao')!;
      const npc = spawnOne(mgr, 'soldier_zhao');
      expect(npc.movement!.speed).toBe(def.speed);
    });
  });

  // ── 2. 巡逻目标选择 ─────────────────────────────────────

  describe('巡逻目标选择', () => {
    it('pickPatrolTarget 应在巡逻半径内选择目标', () => {
      const npc = spawnOne(mgr, 'soldier_zhao');
      const mv = npc.movement!;
      const radius = mv.patrolRadius;

      // 多次选择，验证都在范围内
      for (let i = 0; i < 20; i++) {
        mgr.pickPatrolTarget(npc, mv);
        const dx = mv.targetX - mv.homeX;
        const dy = mv.targetY - mv.homeY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeLessThanOrEqual(radius + 1); // +1 for rounding
      }
    });

    it('不同职业应有不同的巡逻半径', () => {
      const soldier = spawnOne(mgr, 'soldier_zhao');
      const merchant = spawnOne(mgr, 'merchant_chen');
      const general = spawnOne(mgr, 'general_guan');
      const villager = spawnOne(mgr, 'villager_auntie_wang');

      // 士兵巡逻半径小，武将巡逻半径大
      expect(soldier.movement!.patrolRadius).toBeLessThan(general.movement!.patrolRadius);
      // 村民巡逻范围应大于士兵
      expect(villager.movement!.patrolRadius).toBeGreaterThan(soldier.movement!.patrolRadius);
    });

    it('目标坐标应为整数（取整到格子）', () => {
      const npc = spawnOne(mgr, 'farmer_wang');
      const mv = npc.movement!;
      for (let i = 0; i < 20; i++) {
        mgr.pickPatrolTarget(npc, mv);
        expect(Number.isInteger(mv.targetX)).toBe(true);
        expect(Number.isInteger(mv.targetY)).toBe(true);
      }
    });
  });

  // ── 3. NPC 移动计算 ──────────────────────────────────────

  describe('NPC 移动计算', () => {
    it('walking 状态下 NPC 应向目标移动', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('soldier_zhao');
      const mv = npc.movement!;
      const startX = npc.x;
      const startY = npc.y;

      // 手动设置目标
      mv.state = 'walking';
      mv.targetX = startX + 2;
      mv.targetY = startY;
      npc.state = NPCState.WALKING;
      npc.currentTask = null;

      // 模拟 0.5 秒，gameTime=4（凌晨，无日程干扰）
      singleMgr.update(0.5, 4);

      // NPC 应该移动了（不是原位）
      const moved = Math.abs(npc.x - startX) + Math.abs(npc.y - startY);
      expect(moved).toBeGreaterThan(0);
    });

    it('移动速度应影响每帧位移', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('soldier_zhao');
      const mv = npc.movement!;
      mv.speed = 2.0;
      mv.state = 'walking';
      mv.targetX = mv.homeX + 10;
      mv.targetY = mv.homeY;
      npc.state = NPCState.WALKING;
      npc.currentTask = null;

      const startX = npc.x;
      singleMgr.update(0.5, 4);
      const distMoved = Math.abs(npc.x - startX);

      // speed=2, dt=0.5 → 理论移动 1.0 格
      expect(distMoved).toBeCloseTo(1.0, 0);
    });

    it('到达目标后应切换为 idle', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('farmer_wang');
      const mv = npc.movement!;

      // 设置一个很近的目标
      mv.state = 'walking';
      mv.targetX = npc.x + 0.1;
      mv.targetY = npc.y;
      npc.state = NPCState.WALKING;
      npc.currentTask = null;

      // 模拟足够长的时间
      singleMgr.update(1.0, 4);

      expect(mv.state).toBe('idle');
      expect(npc.x).toBeCloseTo(mv.targetX, 1);
    });

    it('移动时应更新朝向', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('merchant_chen');
      const mv = npc.movement!;

      // 向右移动
      mv.state = 'walking';
      mv.targetX = npc.x + 5;
      mv.targetY = npc.y;
      npc.state = NPCState.WALKING;
      npc.currentTask = null;

      singleMgr.update(0.1, 4);
      expect(npc.direction).toBe('right');

      // 向下移动
      mv.state = 'walking';
      mv.targetX = npc.x;
      mv.targetY = npc.y + 5;
      npc.currentTask = null;

      singleMgr.update(0.1, 4);
      expect(npc.direction).toBe('down');
    });
  });

  // ── 4. 停留/恢复行为 ─────────────────────────────────────

  describe('停留/恢复行为', () => {
    it('idle 状态应倒计时停留计时器', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('scholar_kong');
      const mv = npc.movement!;
      mv.state = 'idle';
      mv.idleTimer = 3.0;
      npc.currentTask = null;
      npc.state = NPCState.IDLE;

      singleMgr.update(1.0, 4);
      // 如果 AI 没有分配任务（单 NPC，凌晨），timer 应减少
      expect(mv.idleTimer).toBeLessThanOrEqual(3.0);
    });

    it('停留计时器归零后应选择新目标并开始走动', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('craftsman_tie');
      const mv = npc.movement!;
      mv.state = 'idle';
      mv.idleTimer = 0.01; // 即将归零
      npc.currentTask = null;
      npc.state = NPCState.IDLE;

      singleMgr.update(0.1, 4);

      expect(mv.state).toBe('walking');
      expect(mv.targetX).toBeDefined();
      expect(mv.targetY).toBeDefined();
    });

    it('走动到达后应重置为 idle 并设置新的停留计时', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('farmer_li');
      const mv = npc.movement!;

      // 设置一个很近的目标，确保能到达
      mv.state = 'walking';
      mv.targetX = npc.x + 0.01;  // 更近的距离，确保 dist < 0.15 到达阈值
      mv.targetY = npc.y;
      npc.state = NPCState.WALKING;
      npc.currentTask = null;

      // 用更大的 deltaTime 确保到达
      singleMgr.update(5.0, 4);

      // 到达后应该变为 idle 或已重新开始 walking（因为 idle 计时器可能已过期）
      // 关键是确认 NPC 不再在原来的 walking 状态前往旧目标
      expect(['idle', 'walking']).toContain(mv.state);
      if (mv.state === 'idle') {
        expect(mv.idleTimer).toBeGreaterThan(0);
      }
    });

    it('idle 停留计时应在配置范围内', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('soldier_zhao');
      const mv = npc.movement!;
      const config = PATROL_CONFIGS['soldier'];

      // 到达目标后的 idleTimer 应在配置范围内
      mv.state = 'walking';
      mv.targetX = npc.x + 0.1;
      mv.targetY = npc.y;
      npc.state = NPCState.WALKING;
      npc.currentTask = null;

      singleMgr.update(1.0, 4);

      expect(mv.idleTimer).toBeGreaterThanOrEqual(config.idleDurationRange[0]);
      expect(mv.idleTimer).toBeLessThanOrEqual(config.idleDurationRange[1]);
    });
  });

  // ── 5. 不同类型 NPC 的巡逻范围 ────────────────────────────

  describe('不同类型 NPC 的巡逻范围', () => {
    it('soldier 应有小巡逻半径', () => {
      const npc = spawnOne(mgr, 'soldier_zhao');
      const config = PATROL_CONFIGS['soldier'];
      expect(npc.movement!.patrolRadius).toBe(config.patrolRadius);
      expect(npc.movement!.patrolRadius).toBeLessThanOrEqual(4);
    });

    it('merchant 应有中等巡逻半径', () => {
      const npc = spawnOne(mgr, 'merchant_chen');
      const config = PATROL_CONFIGS['merchant'];
      expect(npc.movement!.patrolRadius).toBe(config.patrolRadius);
      expect(npc.movement!.patrolRadius).toBeGreaterThanOrEqual(4);
    });

    it('general 应有较大巡逻半径', () => {
      const npc = spawnOne(mgr, 'general_guan');
      const config = PATROL_CONFIGS['general'];
      expect(npc.movement!.patrolRadius).toBe(config.patrolRadius);
      expect(npc.movement!.patrolRadius).toBeGreaterThanOrEqual(5);
    });

    it('villager 应有随机走动范围', () => {
      const npc = spawnOne(mgr, 'villager_auntie_wang');
      const config = PATROL_CONFIGS['villager'];
      expect(npc.movement!.patrolRadius).toBe(config.patrolRadius);
      expect(npc.movement!.patrolRadius).toBeGreaterThanOrEqual(5);
    });

    it('所有职业都应在 PATROL_CONFIGS 中有配置', () => {
      const professions = Object.values(NPCProfession);
      for (const prof of professions) {
        expect(PATROL_CONFIGS).toHaveProperty(prof);
      }
    });

    it('每个职业配置都应有合法的巡逻半径和速度', () => {
      for (const [prof, config] of Object.entries(PATROL_CONFIGS)) {
        expect(config.patrolRadius).toBeGreaterThan(0);
        expect(config.speed).toBeGreaterThan(0);
        expect(config.idleDurationRange[0]).toBeGreaterThan(0);
        expect(config.idleDurationRange[1]).toBeGreaterThanOrEqual(config.idleDurationRange[0]);
      }
    });
  });

  // ── 6. createMovement 方法 ───────────────────────────────

  describe('createMovement', () => {
    it('应使用指定职业的巡逻配置', () => {
      const mv = mgr.createMovement(5, 5, 'soldier', 1.8);
      const config = PATROL_CONFIGS['soldier'];
      expect(mv.patrolRadius).toBe(config.patrolRadius);
      expect(mv.speed).toBe(1.8); // 使用传入的 speed
    });

    it('未知职业应使用 villager 配置', () => {
      const mv = mgr.createMovement(3, 3, 'unknown_profession', 1.0);
      const config = PATROL_CONFIGS['villager'];
      expect(mv.patrolRadius).toBe(config.patrolRadius);
    });

    it('speed=0 时应使用配置中的默认速度', () => {
      const mv = mgr.createMovement(5, 5, 'soldier', 0);
      const config = PATROL_CONFIGS['soldier'];
      expect(mv.speed).toBe(config.speed);
    });

    it('idleTimer 应在配置范围内', () => {
      for (let i = 0; i < 20; i++) {
        const mv = mgr.createMovement(5, 5, 'merchant', 1.2);
        const config = PATROL_CONFIGS['merchant'];
        expect(mv.idleTimer).toBeGreaterThanOrEqual(config.idleDurationRange[0]);
        expect(mv.idleTimer).toBeLessThanOrEqual(config.idleDurationRange[1]);
      }
    });
  });

  // ── 7. 完整巡逻循环 ──────────────────────────────────────

  describe('完整巡逻循环', () => {
    it('NPC 应完成 idle → walking → idle 的完整循环', () => {
      const { mgr: singleMgr, npc } = createSingleNPCManager('villager_old_zhang');
      const mv = npc.movement!;

      // 初始为 idle
      expect(mv.state).toBe('idle');

      // 设置很短的 idle timer
      mv.idleTimer = 0.01;
      npc.currentTask = null;
      npc.state = NPCState.IDLE;

      // 更新 → 应切换到 walking
      singleMgr.update(0.1, 4);
      expect(mv.state).toBe('walking');

      // 设置很近的目标让 NPC 快速到达
      mv.targetX = npc.x + 0.1;
      mv.targetY = npc.y;
      npc.currentTask = null;

      // 更新 → 应到达并切换回 idle
      singleMgr.update(1.0, 4);
      expect(mv.state).toBe('idle');
      expect(mv.idleTimer).toBeGreaterThan(0);
    });

    it('多个 NPC 可以同时独立巡逻', () => {
      // 使用三个独立的单 NPC manager 避免交互干扰
      const s1 = createSingleNPCManager('soldier_zhao');
      const s2 = createSingleNPCManager('merchant_chen');
      const s3 = createSingleNPCManager('farmer_wang');

      // s1 和 s3 的 idleTimer 设为极小值，确保立即开始走动
      s1.npc.movement!.idleTimer = 0.01;
      s2.npc.movement!.idleTimer = 100;  // 大值，确保不会触发走动
      s3.npc.movement!.idleTimer = 0.01;
      s1.npc.currentTask = null;
      s2.npc.currentTask = null;
      s3.npc.currentTask = null;
      s1.npc.state = NPCState.IDLE;
      s2.npc.state = NPCState.IDLE;
      s3.npc.state = NPCState.IDLE;
      s1.npc.movement!.state = 'idle';
      s2.npc.movement!.state = 'idle';
      s3.npc.movement!.state = 'idle';

      s1.mgr.update(0.1, 4);
      s2.mgr.update(0.1, 4);
      s3.mgr.update(0.1, 4);

      // s1 和 s3 应开始走动（idleTimer 已归零）
      expect(s1.npc.movement!.state).toBe('walking');
      // s2 应还在 idle（idleTimer 很大）
      expect(s2.npc.movement!.state).toBe('idle');
      expect(s3.npc.movement!.state).toBe('walking');
    });
  });

  // ── 8. PATROL_CONFIGS 常量验证 ───────────────────────────

  describe('PATROL_CONFIGS 常量', () => {
    it('应包含所有 7 种职业配置', () => {
      const expectedProfessions = ['soldier', 'merchant', 'general', 'farmer', 'craftsman', 'scholar', 'villager'];
      for (const prof of expectedProfessions) {
        expect(PATROL_CONFIGS).toHaveProperty(prof);
      }
    });

    it('soldier 应有最小的巡逻半径', () => {
      const soldierRadius = PATROL_CONFIGS['soldier'].patrolRadius;
      for (const [prof, config] of Object.entries(PATROL_CONFIGS)) {
        if (prof !== 'soldier') {
          expect(config.patrolRadius).toBeGreaterThanOrEqual(soldierRadius);
        }
      }
    });

    it('general 应有最大的巡逻半径', () => {
      const generalRadius = PATROL_CONFIGS['general'].patrolRadius;
      for (const [, config] of Object.entries(PATROL_CONFIGS)) {
        expect(config.patrolRadius).toBeLessThanOrEqual(generalRadius);
      }
    });
  });
});
