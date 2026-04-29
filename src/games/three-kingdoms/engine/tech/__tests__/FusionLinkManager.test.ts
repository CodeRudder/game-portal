/**
 * FusionLinkManager 测试
 *
 * 覆盖：
 *   - 默认联动效果注册
 *   - getByFusionTechId 查询
 *   - getActiveEffects 过滤
 *   - getBonus 加成汇总
 *   - syncToLinkSystem 同步
 */

import { describe, it, expect, vi } from 'vitest';
import { FusionLinkManager } from '../FusionLinkManager';

describe('FusionLinkManager', () => {
  let manager: FusionLinkManager;

  beforeEach(() => {
    manager = new FusionLinkManager();
  });

  describe('默认联动效果注册', () => {
    it('构造时应注册默认联动效果', () => {
      // 验证通过查询功能间接确认注册成功
      const links = manager.getByFusionTechId('fusion_mil_eco_1');
      expect(links.length).toBeGreaterThan(0);
    });

    it('应包含6个融合科技的联动效果', () => {
      const techIds = new Set<string>();
      // 遍历所有默认科技ID
      const allTechIds = [
        'fusion_mil_eco_1', 'fusion_mil_eco_2',
        'fusion_mil_cul_1', 'fusion_mil_cul_2',
        'fusion_eco_cul_1', 'fusion_eco_cul_2',
      ];
      for (const id of allTechIds) {
        const links = manager.getByFusionTechId(id);
        expect(links.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getByFusionTechId', () => {
    it('应返回指定融合科技的联动效果', () => {
      const links = manager.getByFusionTechId('fusion_mil_eco_1');
      expect(links).toHaveLength(2);
      expect(links[0].fusionTechId).toBe('fusion_mil_eco_1');
      expect(links[1].fusionTechId).toBe('fusion_mil_eco_1');
    });

    it('不存在的融合科技应返回空数组', () => {
      const links = manager.getByFusionTechId('non_existent');
      expect(links).toHaveLength(0);
    });

    it('fusion_mil_eco_2 应包含 unlockFeature 联动', () => {
      const links = manager.getByFusionTechId('fusion_mil_eco_2');
      const stableLink = links.find(l => l.targetSub === 'stable');
      expect(stableLink?.unlockFeature).toBe(true);
      expect(stableLink?.unlockDescription).toBeTruthy();
    });
  });

  describe('getActiveEffects', () => {
    it('应只返回已完成融合科技的联动效果', () => {
      const isCompleted = (id: string) => id === 'fusion_mil_eco_1';
      const effects = manager.getActiveEffects(isCompleted);
      expect(effects.length).toBeGreaterThan(0);
      for (const effect of effects) {
        expect(effect.fusionTechId).toBe('fusion_mil_eco_1');
      }
    });

    it('无已完成科技时应返回空数组', () => {
      const effects = manager.getActiveEffects(() => false);
      expect(effects).toHaveLength(0);
    });

    it('全部完成时应返回所有联动效果', () => {
      const effects = manager.getActiveEffects(() => true);
      expect(effects.length).toBeGreaterThan(0);
    });
  });

  describe('getBonus', () => {
    it('应汇总指定目标的加成总值', () => {
      // fusion_mil_eco_1: barracks +10%
      const bonus = manager.getBonus('building', 'barracks', () => true);
      expect(bonus).toBe(10);
    });

    it('未完成科技不应计入加成', () => {
      const bonus = manager.getBonus('building', 'barracks', () => false);
      expect(bonus).toBe(0);
    });

    it('应汇总多个科技的加成', () => {
      // academy: mil_cul_1 +10%
      const bonus = manager.getBonus('building', 'academy', () => true);
      expect(bonus).toBe(10);
    });

    it('不存在的目标应返回 0', () => {
      const bonus = manager.getBonus('building', 'nonexistent', () => true);
      expect(bonus).toBe(0);
    });
  });

  describe('syncToLinkSystem', () => {
    it('应将联动效果注册到 TechLinkSystem', () => {
      const registerLink = vi.fn();
      const addCompletedTech = vi.fn();
      const linkSystem = { registerLink, addCompletedTech };

      manager.syncToLinkSystem('fusion_mil_eco_1', linkSystem);

      expect(registerLink).toHaveBeenCalledTimes(2);
      expect(addCompletedTech).toHaveBeenCalledTimes(2);
    });

    it('应传递正确的联动效果参数', () => {
      const registerLink = vi.fn();
      const addCompletedTech = vi.fn();
      const linkSystem = { registerLink, addCompletedTech };

      manager.syncToLinkSystem('fusion_mil_eco_1', linkSystem);

      const firstCall = registerLink.mock.calls[0][0];
      expect(firstCall.id).toBe('fl_mil_eco_1_barracks');
      expect(firstCall.techId).toBe('fusion_mil_eco_1');
      expect(firstCall.target).toBe('building');
    });

    it('不存在的融合科技不应注册任何效果', () => {
      const registerLink = vi.fn();
      const addCompletedTech = vi.fn();
      const linkSystem = { registerLink, addCompletedTech };

      manager.syncToLinkSystem('non_existent', linkSystem);

      expect(registerLink).not.toHaveBeenCalled();
      expect(addCompletedTech).not.toHaveBeenCalled();
    });
  });
});
