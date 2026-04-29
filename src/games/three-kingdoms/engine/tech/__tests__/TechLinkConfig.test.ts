/**
 * TechLinkConfig 测试
 *
 * 覆盖：
 *   - 默认联动效果完整性
 *   - 各目标系统（建筑/武将/资源）联动
 *   - ID唯一性
 *   - 特殊标记（unlockFeature/unlockSkill）
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_LINK_EFFECTS } from '../TechLinkConfig';

describe('TechLinkConfig', () => {
  describe('DEFAULT_LINK_EFFECTS', () => {
    it('应包含联动效果', () => {
      expect(DEFAULT_LINK_EFFECTS.length).toBeGreaterThan(0);
    });

    it('每条联动效果应有完整属性', () => {
      for (const effect of DEFAULT_LINK_EFFECTS) {
        expect(effect.id).toBeTruthy();
        expect(effect.techId).toBeTruthy();
        expect(effect.target).toBeTruthy();
        expect(effect.targetSub).toBeTruthy();
        expect(effect.description).toBeTruthy();
        expect(effect.value).toBeGreaterThan(0);
      }
    });

    it('所有ID应唯一', () => {
      const ids = DEFAULT_LINK_EFFECTS.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('应包含建筑联动效果', () => {
      const buildingLinks = DEFAULT_LINK_EFFECTS.filter(e => e.target === 'building');
      expect(buildingLinks.length).toBeGreaterThan(0);
    });

    it('应包含武将联动效果', () => {
      const heroLinks = DEFAULT_LINK_EFFECTS.filter(e => e.target === 'hero');
      expect(heroLinks.length).toBeGreaterThan(0);
    });

    it('应包含资源联动效果', () => {
      const resourceLinks = DEFAULT_LINK_EFFECTS.filter(e => e.target === 'resource');
      expect(resourceLinks.length).toBeGreaterThan(0);
    });

    it('应包含 unlockFeature 标记的联动', () => {
      const unlockLinks = DEFAULT_LINK_EFFECTS.filter(e => e.unlockFeature);
      expect(unlockLinks.length).toBeGreaterThan(0);
      for (const link of unlockLinks) {
        expect(link.unlockDescription).toBeTruthy();
      }
    });

    it('应包含 unlockSkill 标记的联动', () => {
      const skillLinks = DEFAULT_LINK_EFFECTS.filter(e => e.unlockSkill);
      expect(skillLinks.length).toBeGreaterThan(0);
    });

    it('value 应为正数（百分比增量）', () => {
      for (const effect of DEFAULT_LINK_EFFECTS) {
        expect(effect.value).toBeGreaterThan(0);
        expect(effect.value).toBeLessThanOrEqual(100);
      }
    });
  });
});
