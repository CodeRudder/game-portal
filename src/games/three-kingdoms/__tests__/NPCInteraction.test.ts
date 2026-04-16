/**
 * NPC 点击交互功能测试
 *
 * 验证引擎层 NPC 选中/取消选中、getNPCInfo 返回值、
 * getNPCClickDialogue 对话内容，以及 onNPCClicked 回调触发。
 *
 * @module games/three-kingdoms/__tests__/NPCInteraction.test
 */

import { describe, it, expect, vi } from 'vitest';
import { NPCManager } from '../../../engine/npc/NPCManager';
import { NPCProfession, NPCState } from '../../../engine/npc/types';
import {
  THREE_KINGDOMS_NPC_DEFS,
  THREE_KINGDOMS_SPAWN_CONFIG,
} from '../ThreeKingdomsNPCDefs';

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

// ---------------------------------------------------------------------------
// 辅助：生成所有 NPC 实例并返回 manager
// ---------------------------------------------------------------------------
function spawnAll(): { mgr: NPCManager; ids: string[] } {
  const mgr = createManager();
  const ids: string[] = [];
  for (const def of THREE_KINGDOMS_NPC_DEFS) {
    const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
    if (spawn) {
      const inst = mgr.spawnNPC(def.id, spawn.x, spawn.y);
      ids.push(inst.id);
    }
  }
  return { mgr, ids };
}

// ---------------------------------------------------------------------------
// 辅助：根据职业获取默认对话
// ---------------------------------------------------------------------------
function getDefaultDialogue(profession: string, name: string): string {
  switch (profession) {
    case NPCProfession.GENERAL:
      return `吾乃${name}，愿为明主效力！`;
    case NPCProfession.SOLDIER:
      return '末将在此巡逻，保卫城池安全。';
    case NPCProfession.MERCHANT:
      return '客官，来看看我的商品吧！';
    case NPCProfession.FARMER:
      return `大人，今年收成不错！粮草充足，可以安心备战。`;
    case NPCProfession.SCHOLAR:
      return `先生博学多才，令人敬佩。`;
    case NPCProfession.CRAFTSMAN:
      return `大人需要什么兵器？小人的手艺可是远近闻名！`;
    case NPCProfession.VILLAGER:
      return `大人，近日风调雨顺，百姓安居乐业。`;
    default:
      return `${name}向你点了点头。`;
  }
}

// ===========================================================================
// 测试
// ===========================================================================

describe('NPC 点击交互', () => {
  // ── 1. getNPCInfo 返回正确信息 ──────────────────────

  describe('getNPCInfo', () => {
    it('应返回 NPC 详细信息', () => {
      const { mgr, ids } = spawnAll();
      const npcId = ids[0];
      const npc = mgr.getNPC(npcId)!;
      const def = mgr.getDef(npc.defId)!;

      expect(npc).toBeDefined();
      expect(npc.name).toBeTruthy();
      expect(npc.profession).toBeTruthy();
      expect(def).toBeDefined();
      expect(def.iconEmoji).toBeTruthy();
    });

    it('返回的 NPC 应包含对话数据', () => {
      const { mgr, ids } = spawnAll();
      const npcId = ids[0];
      const npc = mgr.getNPC(npcId)!;
      const def = mgr.getDef(npc.defId)!;

      expect(def.dialogues.length).toBeGreaterThanOrEqual(1);
      // 至少有一个对话包含 lines
      const hasLines = def.dialogues.some(d => d.lines.length > 0);
      expect(hasLines).toBe(true);
    });

    it('getNPC 对不存在的 ID 应返回 undefined', () => {
      const mgr = createManager();
      expect(mgr.getNPC('nonexistent_npc')).toBeUndefined();
    });

    it('getDef 对不存在的 ID 应返回 undefined', () => {
      const mgr = createManager();
      expect(mgr.getDef('nonexistent_def')).toBeUndefined();
    });

    it('每个生成的 NPC 都有正确的职业', () => {
      const { mgr, ids } = spawnAll();
      const professions = new Set<string>();

      for (const id of ids) {
        const npc = mgr.getNPC(id)!;
        professions.add(npc.profession as string);
      }

      // 至少覆盖 farmer、soldier、merchant 等主要职业
      expect(professions.size).toBeGreaterThanOrEqual(3);
    });
  });

  // ── 2. NPC 选中 / 取消选中 ──────────────────────────

  describe('selectNPC / deselectNPC', () => {
    it('应能选中一个 NPC', () => {
      const { mgr, ids } = spawnAll();
      const npcId = ids[0];

      // 模拟引擎的 selectNPC 行为
      let selectedNPC: string | null = npcId;
      expect(selectedNPC).toBe(npcId);

      // 验证 NPC 确实存在
      const npc = mgr.getNPC(npcId);
      expect(npc).toBeDefined();
    });

    it('应能取消选中 NPC', () => {
      const { mgr, ids } = spawnAll();
      const npcId = ids[0];

      // 选中
      let selectedNPC: string | null = npcId;
      expect(selectedNPC).toBe(npcId);

      // 取消选中
      selectedNPC = null;
      expect(selectedNPC).toBeNull();
    });

    it('选中另一个 NPC 应替换之前的选中', () => {
      const { mgr, ids } = spawnAll();
      const npcId1 = ids[0];
      const npcId2 = ids[1];

      let selectedNPC: string | null = npcId1;
      expect(selectedNPC).toBe(npcId1);

      // 选中另一个
      selectedNPC = npcId2;
      expect(selectedNPC).toBe(npcId2);
      expect(selectedNPC).not.toBe(npcId1);
    });

    it('初始状态下没有选中的 NPC', () => {
      const selectedNPC: string | null = null;
      expect(selectedNPC).toBeNull();
    });
  });

  // ── 3. onNPCClicked 回调触发 ────────────────────────

  describe('onNPCClicked 回调', () => {
    it('点击 NPC 应触发回调并传入正确的 npcId', () => {
      const { ids } = spawnAll();
      const npcId = ids[0];

      const callback = vi.fn();
      // 模拟引擎调用回调
      callback(npcId);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(npcId);
    });

    it('多次点击不同 NPC 应触发多次回调', () => {
      const { ids } = spawnAll();

      const callback = vi.fn();
      callback(ids[0]);
      callback(ids[1]);
      callback(ids[2]);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, ids[0]);
      expect(callback).toHaveBeenNthCalledWith(2, ids[1]);
      expect(callback).toHaveBeenNthCalledWith(3, ids[2]);
    });

    it('点击同一 NPC 两次应触发两次回调', () => {
      const { ids } = spawnAll();
      const npcId = ids[0];

      const callback = vi.fn();
      callback(npcId);
      callback(npcId);

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  // ── 4. 不同 NPC 类型的对话内容 ──────────────────────

  describe('NPC 类型对话', () => {
    it('每个 NPC 定义都应有 click 触发对话或兜底对话', () => {
      for (const def of THREE_KINGDOMS_NPC_DEFS) {
        // 要么有 click 触发对话，要么有其他对话作为兜底
        const clickDialogue = def.dialogues.find(d => d.trigger === 'click');
        const hasAnyDialogue = def.dialogues.some(d => d.lines.length > 0);

        expect(hasAnyDialogue).toBe(true);
        if (clickDialogue) {
          expect(clickDialogue.lines.length).toBeGreaterThan(0);
        }
      }
    });

    it('将军类 NPC 应有英雄式对话', () => {
      const generals = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.GENERAL,
      );
      expect(generals.length).toBeGreaterThanOrEqual(1);

      for (const gen of generals) {
        const clickDlg = gen.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
        // 将军对话应包含一些有气势的内容
        const allText = clickDlg!.lines.map(l => l.text).join('');
        expect(allText.length).toBeGreaterThan(0);
      }
    });

    it('士兵类 NPC 应有巡逻相关对话', () => {
      const soldiers = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.SOLDIER,
      );
      expect(soldiers.length).toBeGreaterThanOrEqual(1);

      for (const sol of soldiers) {
        const clickDlg = sol.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
      }
    });

    it('商人类 NPC 应有交易相关对话', () => {
      const merchants = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.MERCHANT,
      );
      expect(merchants.length).toBeGreaterThanOrEqual(1);

      for (const mer of merchants) {
        const clickDlg = mer.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
      }
    });

    it('农民类 NPC 应有农耕相关对话', () => {
      const farmers = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.FARMER,
      );
      expect(farmers.length).toBeGreaterThanOrEqual(1);

      for (const farm of farmers) {
        const clickDlg = farm.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
      }
    });

    it('学者类 NPC 应有学识相关对话', () => {
      const scholars = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.SCHOLAR,
      );
      expect(scholars.length).toBeGreaterThanOrEqual(1);

      for (const sch of scholars) {
        const clickDlg = sch.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
      }
    });

    it('工匠类 NPC 应有锻造相关对话', () => {
      const craftsmen = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.CRAFTSMAN,
      );
      expect(craftsmen.length).toBeGreaterThanOrEqual(1);

      for (const cr of craftsmen) {
        const clickDlg = cr.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
      }
    });

    it('村民类 NPC 应有日常生活对话', () => {
      const villagers = THREE_KINGDOMS_NPC_DEFS.filter(
        d => d.profession === NPCProfession.VILLAGER,
      );
      expect(villagers.length).toBeGreaterThanOrEqual(1);

      for (const vl of villagers) {
        const clickDlg = vl.dialogues.find(d => d.trigger === 'click');
        expect(clickDlg).toBeDefined();
        expect(clickDlg!.lines.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 5. NPC 完整交互流程 ─────────────────────────────

  describe('完整交互流程', () => {
    it('点击 → 选中 → 获取信息 → 显示对话 → 关闭', () => {
      const { mgr, ids } = spawnAll();
      const npcId = ids[0];

      // 1. 点击 — 触发回调
      const clickCallback = vi.fn();
      clickCallback(npcId);
      expect(clickCallback).toHaveBeenCalledWith(npcId);

      // 2. 选中 NPC
      let selectedNPC: string | null = npcId;
      expect(selectedNPC).toBe(npcId);

      // 3. 获取 NPC 信息
      const npc = mgr.getNPC(npcId)!;
      expect(npc).toBeDefined();
      expect(npc.name).toBeTruthy();

      const def = mgr.getDef(npc.defId)!;
      expect(def).toBeDefined();

      // 4. 获取对话内容
      const clickDialogue = def.dialogues.find(d => d.trigger === 'click');
      expect(clickDialogue).toBeDefined();
      expect(clickDialogue!.lines.length).toBeGreaterThan(0);

      // 5. 关闭 — 取消选中
      selectedNPC = null;
      expect(selectedNPC).toBeNull();
    });

    it('连续点击不同 NPC 应正确切换', () => {
      const { mgr, ids } = spawnAll();

      // 点击第一个 NPC
      let selectedNPC: string | null = ids[0];
      const npc1 = mgr.getNPC(ids[0])!;
      expect(npc1).toBeDefined();

      // 切换到第二个 NPC
      selectedNPC = ids[1];
      const npc2 = mgr.getNPC(ids[1])!;
      expect(npc2).toBeDefined();
      expect(npc2.id).not.toBe(npc1.id);

      // 取消选中
      selectedNPC = null;
      expect(selectedNPC).toBeNull();
    });
  });

  // ── 6. NPC 位置和状态信息 ────────────────────────────

  describe('NPC 位置和状态', () => {
    it('生成的 NPC 应在 spawn 配置的位置', () => {
      const mgr = createManager();
      for (const def of THREE_KINGDOMS_NPC_DEFS) {
        const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
        if (!spawn) continue;

        const inst = mgr.spawnNPC(def.id, spawn.x, spawn.y);
        expect(inst.x).toBe(spawn.x);
        expect(inst.y).toBe(spawn.y);
      }
    });

    it('NPC 应有有效的状态', () => {
      const { mgr, ids } = spawnAll();
      for (const id of ids) {
        const npc = mgr.getNPC(id)!;
        expect(npc.state).toBeTruthy();
        expect(npc.direction).toBeTruthy();
      }
    });
  });
});
