/**
 * 核心层 — NPC 类型与配置测试
 *
 * 覆盖：类型定义完整性、配置数据正确性、辅助函数
 */

import {
  AFFINITY_THRESHOLDS,
  NPC_PROFESSION_DEFS,
  NPC_PROFESSIONS,
  DEFAULT_NPCS,
  DIALOG_TREES,
  DIALOG_MERCHANT_DEFAULT,
  DIALOG_STRATEGIST_DEFAULT,
  DIALOG_WARRIOR_DEFAULT,
  DIALOG_ARTISAN_DEFAULT,
  DIALOG_TRAVELER_DEFAULT,
  DEFAULT_CLUSTER_CONFIG,
  DEFAULT_CROWD_CONFIG,
  NPC_SAVE_VERSION,
  getAffinityLevel,
  getAffinityProgress,
  clampAffinity,
} from '..';
import type { NPCProfession, AffinityLevel } from '..';

// ═══════════════════════════════════════════════════════════

describe('NPC 核心层 — 类型与配置', () => {

  // ═══════════════════════════════════════════
  // #9 NPC 类型定义
  // ═══════════════════════════════════════════
  describe('#9 NPC 类型定义', () => {
    it('定义了 5 种 NPC 职业', () => {
      expect(NPC_PROFESSIONS).toHaveLength(5);
      expect(NPC_PROFESSIONS).toContain('merchant');
      expect(NPC_PROFESSIONS).toContain('strategist');
      expect(NPC_PROFESSIONS).toContain('warrior');
      expect(NPC_PROFESSIONS).toContain('artisan');
      expect(NPC_PROFESSIONS).toContain('traveler');
    });

    it('每种职业都有完整定义', () => {
      const professions: NPCProfession[] = ['merchant', 'strategist', 'warrior', 'artisan', 'traveler'];
      for (const prof of professions) {
        const def = NPC_PROFESSION_DEFS[prof];
        expect(def).toBeDefined();
        expect(def.profession).toBe(prof);
        expect(def.label).toBeTruthy();
        expect(def.description).toBeTruthy();
        expect(def.icon).toBeTruthy();
        expect(typeof def.defaultAffinity).toBe('number');
        expect(typeof def.affinityDecayRate).toBe('number');
        expect(def.interactionType).toBeTruthy();
      }
    });

    it('商人职业定义正确', () => {
      const merchant = NPC_PROFESSION_DEFS.merchant;
      expect(merchant.label).toBe('商人');
      expect(merchant.interactionType).toBe('trade');
      expect(merchant.icon).toBe('🏪');
    });

    it('谋士职业定义正确', () => {
      const strategist = NPC_PROFESSION_DEFS.strategist;
      expect(strategist.label).toBe('谋士');
      expect(strategist.interactionType).toBe('intel');
      expect(strategist.icon).toBe('📜');
    });

    it('武将职业定义正确', () => {
      const warrior = NPC_PROFESSION_DEFS.warrior;
      expect(warrior.label).toBe('武将');
      expect(warrior.interactionType).toBe('challenge');
      expect(warrior.icon).toBe('⚔️');
    });

    it('工匠职业定义正确', () => {
      const artisan = NPC_PROFESSION_DEFS.artisan;
      expect(artisan.label).toBe('工匠');
      expect(artisan.interactionType).toBe('craft');
      expect(artisan.icon).toBe('🔨');
    });

    it('旅人职业定义正确', () => {
      const traveler = NPC_PROFESSION_DEFS.traveler;
      expect(traveler.label).toBe('旅人');
      expect(traveler.interactionType).toBe('story');
      expect(traveler.icon).toBe('🗺️');
    });

    it('每种职业有不同的交互类型', () => {
      const types = NPC_PROFESSIONS.map(p => NPC_PROFESSION_DEFS[p].interactionType);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // #10 NPC 属性
  // ═══════════════════════════════════════════
  describe('#10 NPC 属性', () => {
    it('默认 NPC 列表不为空', () => {
      expect(DEFAULT_NPCS.length).toBeGreaterThanOrEqual(10);
    });

    it('每个 NPC 都有完整属性', () => {
      for (const npc of DEFAULT_NPCS) {
        expect(npc.id).toBeTruthy();
        expect(npc.name).toBeTruthy();
        expect(NPC_PROFESSIONS).toContain(npc.profession);
        expect(npc.affinity).toBeGreaterThanOrEqual(0);
        expect(npc.affinity).toBeLessThanOrEqual(100);
        expect(typeof npc.position.x).toBe('number');
        expect(typeof npc.position.y).toBe('number');
        expect(npc.region).toBeTruthy();
        expect(typeof npc.visible).toBe('boolean');
        expect(npc.dialogId).toBeTruthy();
      }
    });

    it('NPC ID 全局唯一', () => {
      const ids = DEFAULT_NPCS.map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('NPC 位置在地图范围内', () => {
      for (const npc of DEFAULT_NPCS) {
        expect(npc.position.x).toBeGreaterThanOrEqual(0);
        expect(npc.position.x).toBeLessThan(60);
        expect(npc.position.y).toBeGreaterThanOrEqual(0);
        expect(npc.position.y).toBeLessThan(40);
      }
    });

    it('每个区域至少有 2 个 NPC', () => {
      const regions = ['central_plains', 'jiangnan', 'western_shu'] as const;
      for (const region of regions) {
        const count = DEFAULT_NPCS.filter(n => n.region === region).length;
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });

    it('覆盖所有 5 种职业', () => {
      const professions = new Set(DEFAULT_NPCS.map(n => n.profession));
      expect(professions.size).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 好感度系统
  // ═══════════════════════════════════════════
  describe('好感度系统', () => {
    it('定义了 5 个好感度等级', () => {
      const levels = Object.keys(AFFINITY_THRESHOLDS) as AffinityLevel[];
      expect(levels).toHaveLength(5);
      expect(levels).toContain('hostile');
      expect(levels).toContain('neutral');
      expect(levels).toContain('friendly');
      expect(levels).toContain('trusted');
      expect(levels).toContain('bonded');
    });

    it('好感度等级边界覆盖 0-100', () => {
      // 检查每个值都能映射到某个等级
      for (let i = 0; i <= 100; i++) {
        const level = getAffinityLevel(i);
        expect(level).toBeTruthy();
      }
    });

    it('getAffinityLevel 返回正确等级', () => {
      expect(getAffinityLevel(0)).toBe('hostile');
      expect(getAffinityLevel(10)).toBe('hostile');
      expect(getAffinityLevel(20)).toBe('neutral');
      expect(getAffinityLevel(30)).toBe('neutral');
      expect(getAffinityLevel(40)).toBe('friendly');
      expect(getAffinityLevel(55)).toBe('friendly');
      expect(getAffinityLevel(65)).toBe('trusted');
      expect(getAffinityLevel(75)).toBe('trusted');
      expect(getAffinityLevel(85)).toBe('bonded');
      expect(getAffinityLevel(100)).toBe('bonded');
    });

    it('getAffinityProgress 返回 0-1 之间的值', () => {
      for (let i = 0; i <= 100; i++) {
        const progress = getAffinityProgress(i);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(1);
      }
    });

    it('clampAffinity 限制在 0-100 范围', () => {
      expect(clampAffinity(-10)).toBe(0);
      expect(clampAffinity(50)).toBe(50);
      expect(clampAffinity(110)).toBe(100);
      expect(clampAffinity(0)).toBe(0);
      expect(clampAffinity(100)).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 对话树配置
  // ═══════════════════════════════════════════
  describe('对话树配置', () => {
    it('定义了 5 个对话树', () => {
      expect(Object.keys(DIALOG_TREES)).toHaveLength(5);
    });

    it('每个对话树结构完整', () => {
      const trees = [
        DIALOG_MERCHANT_DEFAULT,
        DIALOG_STRATEGIST_DEFAULT,
        DIALOG_WARRIOR_DEFAULT,
        DIALOG_ARTISAN_DEFAULT,
        DIALOG_TRAVELER_DEFAULT,
      ];
      for (const tree of trees) {
        expect(tree.id).toBeTruthy();
        expect(tree.profession).toBeTruthy();
        expect(tree.startNodeId).toBeTruthy();
        expect(Object.keys(tree.nodes).length).toBeGreaterThan(0);

        // 起始节点存在
        const startNode = tree.nodes[tree.startNodeId];
        expect(startNode).toBeDefined();
        expect(startNode.text).toBeTruthy();
        expect(startNode.options.length).toBeGreaterThan(0);
      }
    });

    it('对话选项有正确的跳转目标', () => {
      for (const tree of Object.values(DIALOG_TREES)) {
        for (const node of Object.values(tree.nodes)) {
          for (const option of node.options) {
            // nextNodeId 为 null 表示对话结束，这是合法的
            if (option.nextNodeId !== null) {
              expect(tree.nodes[option.nextNodeId]).toBeDefined();
            }
          }
        }
      }
    });

    it('对话选项的效果格式正确', () => {
      const validTypes = ['affinity_change', 'unlock_item', 'unlock_info', 'trigger_event', 'grant_resource'];
      for (const tree of Object.values(DIALOG_TREES)) {
        for (const node of Object.values(tree.nodes)) {
          // 检查节点进入效果
          if (node.onEnter) {
            for (const effect of node.onEnter) {
              expect(validTypes).toContain(effect.type);
            }
          }
          // 检查选项效果
          for (const option of node.options) {
            if (option.effects) {
              for (const effect of option.effects) {
                expect(validTypes).toContain(effect.type);
              }
            }
          }
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 地图展示配置
  // ═══════════════════════════════════════════
  describe('地图展示配置', () => {
    it('聚合配置有合理默认值', () => {
      expect(DEFAULT_CLUSTER_CONFIG.clusterDistance).toBeGreaterThan(0);
      expect(DEFAULT_CLUSTER_CONFIG.maxDisplayPerRegion).toBeGreaterThan(0);
      expect(DEFAULT_CLUSTER_CONFIG.minClusterSize).toBeGreaterThanOrEqual(2);
      expect(typeof DEFAULT_CLUSTER_CONFIG.enabled).toBe('boolean');
    });

    it('拥挤管理配置有合理默认值', () => {
      expect(DEFAULT_CROWD_CONFIG.maxNPCsPerTile).toBeGreaterThan(0);
      expect(DEFAULT_CROWD_CONFIG.minSpacing).toBeGreaterThan(0);
      expect(DEFAULT_CROWD_CONFIG.jitterRadius).toBeGreaterThanOrEqual(0);
    });

    it('存档版本号已定义', () => {
      expect(NPC_SAVE_VERSION).toBe(1);
    });
  });
});
