/**
 * 三国 NPC 引擎集成测试
 *
 * 验证通用 NPC 引擎（NPCManager/DialogueSystem/CollaborationSystem）
 * 与三国霸业引擎的正确集成。
 *
 * @module games/three-kingdoms/__tests__/ThreeKingdomsNPC.test
 */

import { describe, it, expect } from 'vitest';
import { NPCManager } from '../../../engine/npc/NPCManager';
import { NPCProfession, NPCState } from '../../../engine/npc/types';
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

// ===========================================================================
// 测试
// ===========================================================================

describe('三国 NPC 引擎集成', () => {
  // ── 1. NPC 定义加载 ──────────────────────────────────

  it('应至少包含 10 个 NPC 定义', () => {
    expect(THREE_KINGDOMS_NPC_DEFS.length).toBeGreaterThanOrEqual(10);
  });

  it('每个 NPC 定义应有完整字段', () => {
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.profession).toBeTruthy();
      expect(def.color).toBeTruthy();
      expect(def.iconEmoji).toBeTruthy();
      expect(def.speed).toBeGreaterThan(0);
      expect(def.schedule.length).toBeGreaterThanOrEqual(4);
      expect(def.dialogues.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('应覆盖所有 7 种职业', () => {
    const professions = new Set(THREE_KINGDOMS_NPC_DEFS.map(d => d.profession));
    expect(professions.size).toBe(7);
    expect(professions.has(NPCProfession.FARMER)).toBe(true);
    expect(professions.has(NPCProfession.SOLDIER)).toBe(true);
    expect(professions.has(NPCProfession.MERCHANT)).toBe(true);
    expect(professions.has(NPCProfession.SCHOLAR)).toBe(true);
    expect(professions.has(NPCProfession.GENERAL)).toBe(true);
    expect(professions.has(NPCProfession.CRAFTSMAN)).toBe(true);
    expect(professions.has(NPCProfession.VILLAGER)).toBe(true);
  });

  // ── 2. NPCManager 初始化 ─────────────────────────────

  it('NPCManager 应成功注册所有定义', () => {
    const mgr = createManager();
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      expect(mgr.getDef(def.id)).toBeDefined();
    }
  });

  // ── 3. NPC spawn 在正确位置 ──────────────────────────

  it('应在 spawn 配置位置生成 NPC', () => {
    const mgr = createManager();
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
      expect(spawn).toBeDefined();
      const instance = mgr.spawnNPC(def.id, spawn.x, spawn.y);
      expect(instance).toBeDefined();
      expect(instance.x).toBe(spawn.x);
      expect(instance.y).toBe(spawn.y);
      expect(instance.defId).toBe(def.id);
      expect(instance.name).toBe(def.name);
    }
  });

  it('spawn 后应能通过 getAllNPCs 获取所有 NPC', () => {
    const mgr = createManager();
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
      mgr.spawnNPC(def.id, spawn.x, spawn.y);
    }
    const all = mgr.getAllNPCs();
    expect(all.length).toBe(THREE_KINGDOMS_NPC_DEFS.length);
  });

  // ── 4. NPC update 正常运行 ───────────────────────────

  it('update 不应抛出异常', () => {
    const mgr = createManager();
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
      mgr.spawnNPC(def.id, spawn.x, spawn.y);
    }
    // 模拟多帧更新
    for (let i = 0; i < 100; i++) {
      expect(() => mgr.update(0.016, 8 + i * 0.01)).not.toThrow();
    }
  });

  it('NPC 应根据日程切换状态', () => {
    const mgr = createManager();
    const spawn = THREE_KINGDOMS_SPAWN_CONFIG['farmer_wang'];
    mgr.spawnNPC('farmer_wang', spawn.x, spawn.y);

    // 模拟足够多的帧让 AI 处理日程
    for (let i = 0; i < 50; i++) {
      mgr.update(0.1, 6); // 6 点 — 应进入 WORKING
    }

    const npcs = mgr.getAllNPCs();
    expect(npcs.length).toBe(1);
    // NPC 应该从 IDLE 转换到某个活跃状态
    expect(npcs[0].state).not.toBe(NPCState.IDLE);
  });

  // ── 5. 对话系统可用 ─────────────────────────────────

  it('应能通过 NPCManager 开始对话', () => {
    const mgr = createManager();
    const spawn = THREE_KINGDOMS_SPAWN_CONFIG['farmer_wang'];
    mgr.spawnNPC('farmer_wang', spawn.x, spawn.y);

    const npc = mgr.getAllNPCs()[0];
    const dialogue = mgr.startDialogue(npc.id, 'click');
    expect(dialogue).not.toBeNull();
    expect(dialogue!.id).toBe('dlg_farmer_wang_greet');
    expect(dialogue!.lines.length).toBeGreaterThan(0);
  });

  it('应能选择对话选项', () => {
    const mgr = createManager();
    const spawn = THREE_KINGDOMS_SPAWN_CONFIG['farmer_wang'];
    mgr.spawnNPC('farmer_wang', spawn.x, spawn.y);

    const npc = mgr.getAllNPCs()[0];
    mgr.startDialogue(npc.id, 'click');

    // 选择第一个选项
    const nextLine = mgr.makeDialogueChoice(npc.id, 0);
    // 可能返回下一行或 null（取决于对话结构）
    // 关键是不抛异常
    expect(nextLine).toBeDefined();
  });

  it('接近触发对话应可用', () => {
    const mgr = createManager();
    const spawn = THREE_KINGDOMS_SPAWN_CONFIG['farmer_li'];
    mgr.spawnNPC('farmer_li', spawn.x, spawn.y);

    const npc = mgr.getAllNPCs()[0];
    const dialogue = mgr.startDialogue(npc.id, 'proximity');
    expect(dialogue).not.toBeNull();
    expect(dialogue!.id).toBe('dlg_farmer_li_proximity');
  });

  // ── 6. 协作系统可用 ─────────────────────────────────

  it('应能组建 NPC 团队', () => {
    const mgr = createManager();
    // spawn 两个士兵
    const spawn1 = THREE_KINGDOMS_SPAWN_CONFIG['soldier_zhao'];
    const spawn2 = THREE_KINGDOMS_SPAWN_CONFIG['soldier_sun'];
    const npc1 = mgr.spawnNPC('soldier_zhao', spawn1.x, spawn1.y);
    const npc2 = mgr.spawnNPC('soldier_sun', spawn2.x, spawn2.y);

    const task = {
      id: 'patrol_task_1',
      type: 'patrol' as const,
      targetX: 12,
      targetY: 6,
      progress: 0,
      duration: 60,
    };

    const team = mgr.formTeam(npc1.id, [npc2.id], task);
    expect(team).toBeDefined();
    expect(team.memberIds).toContain(npc1.id);
    expect(team.memberIds).toContain(npc2.id);
    expect(team.leaderId).toBe(npc1.id);
    expect(npc1.teamId).toBe(team.id);
    expect(npc2.teamId).toBe(team.id);
  });

  it('应能解散团队', () => {
    const mgr = createManager();
    const spawn1 = THREE_KINGDOMS_SPAWN_CONFIG['soldier_zhao'];
    const spawn2 = THREE_KINGDOMS_SPAWN_CONFIG['soldier_sun'];
    const npc1 = mgr.spawnNPC('soldier_zhao', spawn1.x, spawn1.y);
    const npc2 = mgr.spawnNPC('soldier_sun', spawn2.x, spawn2.y);

    const task = {
      id: 'patrol_task_2',
      type: 'patrol' as const,
      progress: 0,
      duration: 60,
    };

    const team = mgr.formTeam(npc1.id, [npc2.id], task);
    mgr.disbandTeam(team.id);

    expect(npc1.teamId).toBeNull();
    expect(npc2.teamId).toBeNull();
  });

  // ── 7. getNearbyNPCs 查询 ────────────────────────────

  it('应能查询附近 NPC', () => {
    const mgr = createManager();
    // spawn 多个 NPC 在相近位置
    mgr.spawnNPC('farmer_wang', 3, 8);
    mgr.spawnNPC('farmer_li', 6, 10);
    mgr.spawnNPC('villager_auntie_wang', 4, 7);

    // 在 (4, 8) 附近 3 格范围搜索
    const nearby = mgr.getNearbyNPCs(4, 8, 3);
    expect(nearby.length).toBeGreaterThanOrEqual(2); // farmer_wang 和 auntie_wang
  });

  // ── 8. 序列化/反序列化 ───────────────────────────────

  it('应能序列化和反序列化 NPC 状态', () => {
    const mgr = createManager();
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
      mgr.spawnNPC(def.id, spawn.x, spawn.y);
    }

    // 模拟一些更新
    for (let i = 0; i < 10; i++) {
      mgr.update(0.1, 8);
    }

    const serialized = mgr.serialize();
    expect(serialized).toBeDefined();

    // 创建新 manager 并恢复
    const mgr2 = createManager();
    mgr2.deserialize(serialized as Record<string, unknown>);
    const restored = mgr2.getAllNPCs();
    expect(restored.length).toBe(THREE_KINGDOMS_NPC_DEFS.length);
  });
});
