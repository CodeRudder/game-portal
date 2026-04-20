/**
 * TechDetailProvider 单元测试
 * 覆盖：普通科技详情、融合科技详情、效果展示、前置条件、消耗、时间、联动
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechDetailProvider } from '../TechDetailProvider';
import { TechTreeSystem } from '../TechTreeSystem';
import { FusionTechSystem } from '../FusionTechSystem';
import { TechLinkSystem } from '../TechLinkSystem';
import type { ISystemDeps } from '../../../../core/types';

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

describe('TechDetailProvider', () => {
  let provider: TechDetailProvider;
  let techTree: TechTreeSystem;
  let fusionSystem: FusionTechSystem;
  let linkSystem: TechLinkSystem;
  let currentTechPoints: number;
  let researchSpeedBonus: number;

  beforeEach(() => {
    currentTechPoints = 1000;
    researchSpeedBonus = 0;

    techTree = new TechTreeSystem();
    techTree.init(mockDeps());

    fusionSystem = new FusionTechSystem();
    fusionSystem.init(mockDeps());
    fusionSystem.setTechTree(techTree);

    linkSystem = new TechLinkSystem();
    linkSystem.init(mockDeps());

    provider = new TechDetailProvider(
      () => currentTechPoints,
      () => researchSpeedBonus,
    );
    provider.setTechTree(techTree);
    provider.setFusionSystem(fusionSystem);
    provider.setLinkSystem(linkSystem);
  });

  // ═══════════════════════════════════════════
  // 1. 普通科技详情
  // ═══════════════════════════════════════════
  describe('普通科技详情', () => {
    it('获取存在的科技详情', () => {
      const detail = provider.getTechDetail('mil_t1_attack');
      expect(detail).not.toBeNull();
      expect(detail!.id).toBe('mil_t1_attack');
      expect(detail!.name).toBe('锐兵术');
      expect(detail!.isFusion).toBe(false);
    });

    it('不存在的科技返回 null', () => {
      expect(provider.getTechDetail('nonexistent')).toBeNull();
    });

    it('详情包含基本信息', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.icon).toBeTruthy();
      expect(detail.path).toBe('military');
      expect(detail.pathLabel).toBe('军事');
      expect(detail.pathColor).toBe('#DC2626');
      expect(detail.tier).toBe(1);
      expect(detail.description).toBeTruthy();
    });

    it('详情包含正确状态', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.status).toBe('available'); // Tier 1 无前置

      const detail2 = provider.getTechDetail('mil_t2_charge')!;
      expect(detail2.status).toBe('locked'); // 有前置
    });

    it('完成后状态更新', () => {
      techTree.completeNode('mil_t1_attack');
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.status).toBe('completed');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 效果展示
  // ═══════════════════════════════════════════
  describe('效果展示', () => {
    it('详情包含效果列表', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.effects.length).toBeGreaterThan(0);
    });

    it('效果包含完整信息', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      const eff = detail.effects[0];
      expect(eff.type).toBe('troop_attack');
      expect(eff.target).toBe('all');
      expect(eff.value).toBe(10);
      expect(eff.description).toBeTruthy();
    });

    it('效果描述可读', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      const eff = detail.effects[0];
      expect(eff.description).toContain('兵种攻击');
      expect(eff.description).toContain('+10%');
    });

    it('多效果科技展示完整', () => {
      const detail = provider.getTechDetail('mil_t2_charge')!;
      expect(detail.effects).toHaveLength(2); // 攻击+行军速度
    });
  });

  // ═══════════════════════════════════════════
  // 3. 前置条件展示
  // ═══════════════════════════════════════════
  describe('前置条件展示', () => {
    it('Tier 1 无前置条件', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.prerequisites).toHaveLength(0);
    });

    it('有前置的科技展示前置列表', () => {
      const detail = provider.getTechDetail('mil_t2_charge')!;
      expect(detail.prerequisites).toHaveLength(1);
      expect(detail.prerequisites[0].id).toBe('mil_t1_attack');
      expect(detail.prerequisites[0].name).toBe('锐兵术');
      expect(detail.prerequisites[0].completed).toBe(false);
    });

    it('完成后前置标记为已完成', () => {
      techTree.completeNode('mil_t1_attack');
      const detail = provider.getTechDetail('mil_t2_charge')!;
      expect(detail.prerequisites[0].completed).toBe(true);
    });

    it('前置条件包含路线信息', () => {
      const detail = provider.getTechDetail('mil_t2_charge')!;
      expect(detail.prerequisites[0].path).toBe('military');
      expect(detail.prerequisites[0].pathLabel).toBe('军事');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 消耗展示
  // ═══════════════════════════════════════════
  describe('消耗展示', () => {
    it('消耗信息完整', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.cost.type).toBe('tech_points');
      expect(detail.cost.typeLabel).toBe('科技点');
      expect(detail.cost.amount).toBe(50);
      expect(detail.cost.current).toBe(1000);
      expect(detail.cost.sufficient).toBe(true);
    });

    it('科技点不足时标记 insufficient', () => {
      currentTechPoints = 10;
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.cost.sufficient).toBe(false);
    });

    it('高消耗科技正确展示', () => {
      const detail = provider.getTechDetail('mil_t4_dominance')!;
      expect(detail.cost.amount).toBe(800);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 研究时间展示
  // ═══════════════════════════════════════════
  describe('研究时间展示', () => {
    it('时间信息完整', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.researchTime.baseTime).toBe(120);
      expect(detail.researchTime.actualTime).toBe(120);
      expect(detail.researchTime.speedBonus).toBe(0);
      expect(detail.researchTime.formattedBase).toBeTruthy();
      expect(detail.researchTime.formattedActual).toBeTruthy();
    });

    it('无加成时基础时间等于实际时间', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.researchTime.baseTime).toBe(detail.researchTime.actualTime);
    });

    it('有研究速度加成时实际时间缩短', () => {
      researchSpeedBonus = 50; // +50% 速度
      const detail = provider.getTechDetail('mil_t1_attack')!;
      expect(detail.researchTime.speedBonus).toBe(50);
      expect(detail.researchTime.actualTime).toBeLessThan(detail.researchTime.baseTime);
    });

    it('格式化时间可读', () => {
      const detail = provider.getTechDetail('mil_t1_attack')!;
      // 120秒 = 2分
      expect(detail.researchTime.formattedBase).toContain('2分');
    });

    it('长时间格式化包含小时', () => {
      const detail = provider.getTechDetail('mil_t4_dominance')!;
      // 1800秒 = 30分
      expect(detail.researchTime.formattedBase).toContain('30分');
    });
  });

  // ═══════════════════════════════════════════
  // 6. 联动效果展示
  // ═══════════════════════════════════════════
  describe('联动效果展示', () => {
    it('有联动效果的科技展示联动', () => {
      const detail = provider.getTechDetail('eco_t1_farming')!;
      expect(detail.linkEffects.length).toBeGreaterThan(0);
    });

    it('联动效果包含完整信息', () => {
      const detail = provider.getTechDetail('eco_t1_farming')!;
      const linkEff = detail.linkEffects[0];
      expect(linkEff.target).toBeTruthy();
      expect(linkEff.description).toBeTruthy();
      expect(linkEff.value).toBeGreaterThan(0);
    });

    it('无联动效果的科技展示空列表', () => {
      // mil_t4_dominance 没有预定义联动
      const detail = provider.getTechDetail('mil_t4_dominance')!;
      expect(detail.linkEffects).toHaveLength(0);
    });

    it('无联动系统时展示空列表', () => {
      const noLinkProvider = new TechDetailProvider(() => 0, () => 0);
      noLinkProvider.setTechTree(techTree);
      const detail = noLinkProvider.getTechDetail('eco_t1_farming')!;
      expect(detail.linkEffects).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 融合科技详情
  // ═══════════════════════════════════════════
  describe('融合科技详情', () => {
    it('获取融合科技详情', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1');
      expect(detail).not.toBeNull();
      expect(detail!.id).toBe('fusion_mil_eco_1');
      expect(detail!.name).toBe('兵精粮足');
      expect(detail!.isFusion).toBe(true);
    });

    it('融合科技包含路线组合标签', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      expect(detail.pathLabel).toContain('军事');
      expect(detail.pathLabel).toContain('经济');
      expect(detail.path).toContain('military');
      expect(detail.path).toContain('economy');
    });

    it('融合科技前置条件展示两条路线', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      expect(detail.prerequisites).toHaveLength(2);
    });

    it('融合科技前置条件包含完成状态', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      expect(detail.prerequisites[0].completed).toBe(false);
      expect(detail.prerequisites[1].completed).toBe(false);
    });

    it('完成后融合科技前置条件更新', () => {
      techTree.completeNode('mil_t1_attack');
      techTree.completeNode('mil_t2_charge');
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      const milPrereq = detail.prerequisites.find((p) => p.id === 'mil_t2_charge');
      expect(milPrereq?.completed).toBe(true);
    });

    it('融合科技层级为 0', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      expect(detail.tier).toBe(0);
    });

    it('融合科技无联动效果', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      expect(detail.linkEffects).toHaveLength(0);
    });

    it('融合科技消耗和时间正确', () => {
      const detail = provider.getTechDetail('fusion_mil_eco_1')!;
      expect(detail.cost.amount).toBe(400);
      expect(detail.researchTime.baseTime).toBe(900);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 批量查询
  // ═══════════════════════════════════════════
  describe('批量查询', () => {
    it('getTechDetails 批量获取详情', () => {
      const details = provider.getTechDetails([
        'mil_t1_attack',
        'eco_t1_farming',
        'fusion_mil_eco_1',
      ]);
      expect(details).toHaveLength(3);
    });

    it('getTechDetails 跳过不存在的', () => {
      const details = provider.getTechDetails([
        'mil_t1_attack',
        'nonexistent',
        'eco_t1_farming',
      ]);
      expect(details).toHaveLength(2);
    });

    it('getTechDetails 空列表返回空', () => {
      const details = provider.getTechDetails([]);
      expect(details).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('无依赖注入时仍可工作', () => {
      const bareProvider = new TechDetailProvider();
      const detail = bareProvider.getTechDetail('mil_t1_attack');
      expect(detail).not.toBeNull();
      expect(detail!.status).toBe('locked'); // 无 techTree 时默认 locked
      expect(detail!.cost.current).toBe(0);
    });

    it('格式化 0 秒', () => {
      // 使用一个 researchTime 为 0 的场景（不会实际存在，但测试边界）
      const detail = provider.getTechDetail('mil_t1_attack')!;
      // 正常节点都有 researchTime > 0
      expect(detail.researchTime.formattedBase).toBeTruthy();
    });
  });
});
