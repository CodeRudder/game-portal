/**
 * NPCDialogHelpers 单元测试
 *
 * 覆盖：NPCDialogDeps 接口、DialogSelectResult 类型验证
 */
import { describe, it, expect } from 'vitest';
import type { NPCDialogDeps, DialogSelectResult } from '../NPCDialogHelpers';

describe('NPCDialogHelpers', () => {
  describe('NPCDialogDeps', () => {
    it('接口可被正确实现', () => {
      const deps: NPCDialogDeps = {
        getAffinity: (npcId) => npcId === 'npc-1' ? 80 : 0,
        getProfession: (npcId) => npcId === 'npc-1' ? 'merchant' : null,
        changeAffinity: (npcId, delta) => 80 + delta,
        getCurrentTurn: () => 10,
      };

      expect(deps.getAffinity('npc-1')).toBe(80);
      expect(deps.getAffinity('npc-2')).toBe(0);
      expect(deps.getProfession('npc-1')).toBe('merchant');
      expect(deps.getProfession('npc-2')).toBeNull();
      expect(deps.changeAffinity('npc-1', 5)).toBe(85);
      expect(deps.getCurrentTurn()).toBe(10);
    });
  });

  describe('DialogSelectResult', () => {
    it('成功结果结构', () => {
      const result: DialogSelectResult = {
        success: true,
        ended: false,
        effects: [],
      };

      expect(result.success).toBe(true);
      expect(result.effects).toEqual([]);
    });

    it('失败结果结构', () => {
      const result: DialogSelectResult = {
        success: false,
        reason: 'session_not_found',
        effects: [],
      };

      expect(result.success).toBe(false);
      expect(result.reason).toBe('session_not_found');
    });

    it('所有失败原因类型', () => {
      const reasons: DialogSelectResult['reason'][] = [
        'session_not_found',
        'session_ended',
        'node_not_found',
        'option_not_found',
        'option_not_available',
      ];

      reasons.forEach((reason) => {
        const result: DialogSelectResult = { success: false, reason, effects: [] };
        expect(result.reason).toBe(reason);
      });
    });
  });
});
