/**
 * NPCDialogSystem 单元测试
 *
 * 覆盖对话系统的所有功能：
 * - ISubsystem 接口
 * - 对话树管理
 * - 对话会话创建与销毁
 * - 选项过滤（好感度/职业）
 * - 选项选择与效果执行
 * - 对话历史记录
 * - 边界情况
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCDialogSystem } from '../NPCDialogSystem';
import type { NPCDialogDeps } from '../NPCDialogSystem';
import type { ISystemDeps } from '../../../core/types';
import type { NPCProfession, DialogTree, DialogSession } from '../../../core/npc';
import { DIALOG_TREES } from '../../../core/npc';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
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

/** 创建对话系统并注入依赖 */
function createDialogSystem(
  options: {
    affinity?: number;
    profession?: NPCProfession;
  } = {},
): { sys: NPCDialogSystem; deps: ISystemDeps; dialogDeps: NPCDialogDeps } {
  const deps = mockDeps();
  const sys = new NPCDialogSystem();
  sys.init(deps);

  const affinity = options.affinity ?? 50;
  const profession = options.profession ?? 'merchant';

  const dialogDeps: NPCDialogDeps = {
    getAffinity: vi.fn().mockReturnValue(affinity),
    getProfession: vi.fn().mockReturnValue(profession),
    changeAffinity: vi.fn().mockReturnValue(affinity),
    getCurrentTurn: vi.fn().mockReturnValue(1),
  };

  sys.setDialogDeps(dialogDeps);
  return { sys, deps, dialogDeps };
}

// ═══════════════════════════════════════════════════════════

describe('NPCDialogSystem', () => {
  let dialogSys: NPCDialogSystem;
  let deps: ISystemDeps;
  let dialogDeps: NPCDialogDeps;

  beforeEach(() => {
    const result = createDialogSystem();
    dialogSys = result.sys;
    deps = result.deps;
    dialogDeps = result.dialogDeps;
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 npcDialog', () => {
      expect(dialogSys.name).toBe('npcDialog');
    });

    it('getState 返回活跃会话列表', () => {
      const state = dialogSys.getState();
      expect(state.activeSessions).toEqual([]);
    });

    it('reset 清除所有会话', () => {
      dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.reset();
      expect(dialogSys.getState().activeSessions).toEqual([]);
    });

    it('update 不抛异常', () => {
      expect(() => dialogSys.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 对话树管理
  // ═══════════════════════════════════════════
  describe('对话树管理', () => {
    it('加载默认对话树', () => {
      const ids = dialogSys.getDialogTreeIds();
      expect(ids).toContain('dialog-merchant-default');
      expect(ids).toContain('dialog-strategist-default');
      expect(ids).toContain('dialog-warrior-default');
      expect(ids).toContain('dialog-artisan-default');
      expect(ids).toContain('dialog-traveler-default');
    });

    it('getDialogTree 返回对话树', () => {
      const tree = dialogSys.getDialogTree('dialog-merchant-default');
      expect(tree).toBeDefined();
      expect(tree!.profession).toBe('merchant');
      expect(tree!.startNodeId).toBe('merchant-start');
    });

    it('getDialogTree 不存在返回 undefined', () => {
      expect(dialogSys.getDialogTree('non-existent')).toBeUndefined();
    });

    it('registerDialogTree 注册自定义对话树', () => {
      const customTree: DialogTree = {
        id: 'custom-dialog',
        profession: 'merchant',
        startNodeId: 'start',
        nodes: {
          start: {
            id: 'start',
            speaker: 'NPC',
            text: 'Hello',
            options: [],
          },
        },
      };
      dialogSys.registerDialogTree(customTree);
      expect(dialogSys.getDialogTree('custom-dialog')).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 对话会话管理
  // ═══════════════════════════════════════════
  describe('对话会话管理', () => {
    it('startDialog 创建会话', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      expect(session).not.toBeNull();
      expect(session!.npcId).toBe('npc-merchant-01');
      expect(session!.dialogTreeId).toBe('dialog-merchant-default');
      expect(session!.ended).toBe(false);
      expect(session!.currentNodeId).toBe('merchant-start');
    });

    it('startDialog 不存在的对话树返回 null', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'non-existent');
      expect(session).toBeNull();
    });

    it('startDialog 触发 npc:dialog_started 事件', () => {
      dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:dialog_started',
        expect.objectContaining({
          npcId: 'npc-merchant-01',
          dialogTreeId: 'dialog-merchant-default',
        }),
      );
    });

    it('getCurrentNode 返回当前对话节点', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const node = dialogSys.getCurrentNode(session!.id);
      expect(node).not.toBeNull();
      expect(node!.id).toBe('merchant-start');
      expect(node!.speaker).toBe('商人');
      expect(node!.options.length).toBeGreaterThan(0);
    });

    it('getCurrentNode 不存在的会话返回 null', () => {
      expect(dialogSys.getCurrentNode('non-existent')).toBeNull();
    });

    it('getSession 返回会话快照', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const retrieved = dialogSys.getSession(session!.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.npcId).toBe('npc-merchant-01');
    });

    it('getActiveSessions 返回活跃会话', () => {
      dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const active = dialogSys.getActiveSessions();
      expect(active.length).toBe(1);
    });

    it('destroySession 销毁会话', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.destroySession(session!.id);
      expect(dialogSys.getSession(session!.id)).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 选项过滤
  // ═══════════════════════════════════════════
  describe('选项过滤', () => {
    it('getAvailableOptions 返回可用选项', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const options = dialogSys.getAvailableOptions(session!.id);
      expect(options.length).toBeGreaterThan(0);
    });

    it('好感度不足时过滤高好感度选项', () => {
      // 好感度20，商人对话中 merchant-rumor 需要40
      const { sys } = createDialogSystem({ affinity: 20, profession: 'merchant' });
      const session = sys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const options = sys.getAvailableOptions(session!.id);

      const rumorOption = options.find((o) => o.id === 'merchant-rumor');
      expect(rumorOption).toBeUndefined();
    });

    it('好感度足够时显示所有选项', () => {
      const { sys } = createDialogSystem({ affinity: 60, profession: 'merchant' });
      const session = sys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const options = sys.getAvailableOptions(session!.id);

      expect(options.find((o) => o.id === 'merchant-buy')).toBeDefined();
      expect(options.find((o) => o.id === 'merchant-rumor')).toBeDefined();
    });

    it('所有选项被过滤时显示默认选项', () => {
      // 好感度0，所有选项都有好感度要求
      const { sys } = createDialogSystem({ affinity: 0, profession: 'merchant' });
      const session = sys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const options = sys.getAvailableOptions(session!.id);

      // 应该有默认的 "下次再来" 选项
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((o) => o.isDefault)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 选项选择与效果
  // ═══════════════════════════════════════════
  describe('选项选择与效果', () => {
    it('selectOption 成功选择选项', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const result = dialogSys.selectOption(session!.id, 'merchant-buy');

      expect(result.success).toBe(true);
      expect(result.ended).toBe(false);
    });

    it('selectOption 选择后跳转到下一节点', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.selectOption(session!.id, 'merchant-buy');

      const updatedSession = dialogSys.getSession(session!.id);
      expect(updatedSession!.currentNodeId).toBe('merchant-buy-response');
    });

    it('selectOption 选择结束选项标记对话结束', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const result = dialogSys.selectOption(session!.id, 'merchant-bye');

      expect(result.success).toBe(true);
      expect(result.ended).toBe(true);

      const updatedSession = dialogSys.getSession(session!.id);
      expect(updatedSession!.ended).toBe(true);
    });

    it('selectOption 执行好感度效果', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.selectOption(session!.id, 'merchant-buy');
      dialogSys.selectOption(session!.id, 'merchant-buy-confirm');

      // changeAffinity 应该被调用
      expect(dialogDeps.changeAffinity).toHaveBeenCalledWith(
        'npc-merchant-01',
        5,
      );
    });

    it('selectOption 累积效果到会话', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.selectOption(session!.id, 'merchant-buy');
      dialogSys.selectOption(session!.id, 'merchant-buy-confirm');

      const updatedSession = dialogSys.getSession(session!.id);
      expect(updatedSession!.accumulatedEffects.length).toBeGreaterThan(0);
    });

    it('selectOption 不存在的会话返回失败', () => {
      const result = dialogSys.selectOption('non-existent', 'option-1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });

    it('selectOption 已结束的会话返回失败', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.selectOption(session!.id, 'merchant-bye');

      const result = dialogSys.selectOption(session!.id, 'merchant-buy');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('session_ended');
    });

    it('selectOption 不存在的选项返回失败', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const result = dialogSys.selectOption(session!.id, 'non-existent');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('option_not_found');
    });

    it('selectOption 不可用的选项返回失败', () => {
      const { sys, dialogDeps: dd } = createDialogSystem({ affinity: 0, profession: 'merchant' });
      const session = sys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      // merchant-buy 需要20好感度，当前为0
      const result = sys.selectOption(session!.id, 'merchant-buy');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('option_not_available');
    });
  });

  // ═══════════════════════════════════════════
  // 6. 对话历史
  // ═══════════════════════════════════════════
  describe('对话历史', () => {
    it('开始对话记录起始节点历史', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      expect(session!.history.length).toBeGreaterThan(0);
      expect(session!.history[0].nodeId).toBe('merchant-start');
      expect(session!.history[0].selectedOptionId).toBeNull();
    });

    it('选择选项后记录历史', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.selectOption(session!.id, 'merchant-buy');

      const updated = dialogSys.getSession(session!.id);
      const lastEntry = updated!.history[updated!.history.length - 1];
      expect(lastEntry.nodeId).toBe('merchant-buy-response');
      expect(lastEntry.selectedOptionId).toBe('merchant-buy');
    });
  });

  // ═══════════════════════════════════════════
  // 7. endDialog
  // ═══════════════════════════════════════════
  describe('endDialog', () => {
    it('endDialog 手动结束对话', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      const result = dialogSys.endDialog(session!.id);
      expect(result).toBe(true);

      const updated = dialogSys.getSession(session!.id);
      expect(updated!.ended).toBe(true);
    });

    it('endDialog 触发 npc:dialog_ended 事件', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      dialogSys.endDialog(session!.id);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'npc:dialog_ended',
        expect.objectContaining({
          sessionId: session!.id,
          npcId: 'npc-merchant-01',
        }),
      );
    });

    it('endDialog 不存在的会话返回 false', () => {
      expect(dialogSys.endDialog('non-existent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 完整对话流程测试
  // ═══════════════════════════════════════════
  describe('完整对话流程', () => {
    it('商人对话完整流程', () => {
      const session = dialogSys.startDialog('npc-merchant-01', 'dialog-merchant-default');
      expect(session!.currentNodeId).toBe('merchant-start');

      // 选择"看看好东西"
      let result = dialogSys.selectOption(session!.id, 'merchant-buy');
      expect(result.success).toBe(true);

      // 确认购买
      result = dialogSys.selectOption(session!.id, 'merchant-buy-confirm');
      expect(result.success).toBe(true);
      expect(result.ended).toBe(true);

      // 验证效果
      expect(dialogDeps.changeAffinity).toHaveBeenCalled();
    });

    it('武将对话完整流程', () => {
      const { sys } = createDialogSystem({ affinity: 50, profession: 'warrior' });
      const session = sys.startDialog('npc-warrior-01', 'dialog-warrior-default');

      // 选择比武
      const result = sys.selectOption(session!.id, 'warrior-challenge');
      expect(result.success).toBe(true);

      // 开始比武
      const result2 = sys.selectOption(session!.id, 'warrior-fight');
      expect(result2.success).toBe(true);
      expect(result2.ended).toBe(true);
    });
  });
});
