/**
 * NPC 对话系统 — 辅助类型定义
 *
 * 从 NPCDialogSystem 中提取的类型接口。
 *
 * @module engine/npc/NPCDialogHelpers
 */

import type { NPCId, NPCProfession, DialogEffect } from '../../core/npc';

/** 对话系统依赖（外部注入） */
export interface NPCDialogDeps {
  /** 获取 NPC 好感度 */
  getAffinity: (npcId: NPCId) => number;
  /** 获取 NPC 职业 */
  getProfession: (npcId: NPCId) => NPCProfession | null;
  /** 修改好感度（返回修改后的值） */
  changeAffinity: (npcId: NPCId, delta: number) => number | null;
  /** 获取当前回合数 */
  getCurrentTurn: () => number;
}

/** 选项选择结果 */
export interface DialogSelectResult {
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  reason?: 'session_not_found' | 'session_ended' | 'node_not_found' | 'option_not_found' | 'option_not_available';
  /** 对话是否已结束 */
  ended?: boolean;
  /** 触发的效果列表 */
  effects: DialogEffect[];
}
