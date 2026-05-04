/**
 * 酒馆↔招募桥接层 — 单元测试
 *
 * @module engine/building/__tests__/tavern-bridge.test
 */

import { describe, it, expect } from 'vitest';
import {
  getRecruitBonus,
  calculateActualRate,
  getTavernUnlockLevel,
  isTavernFeatureUnlocked,
  serializeTavernBridge,
  deserializeTavernBridge,
  TAVERN_BRIDGE_SAVE_VERSION,
} from '../tavern-bridge';

describe('TavernBridge', () => {
  // ─────────────────────────────────────────────
  // getRecruitBonus
  // ─────────────────────────────────────────────
  describe('getRecruitBonus', () => {
    it('酒馆Lv5→概率加成10%', () => {
      expect(getRecruitBonus(5)).toBeCloseTo(0.10, 4);
    });

    it('酒馆Lv10→概率加成20%', () => {
      expect(getRecruitBonus(10)).toBeCloseTo(0.20, 4);
    });

    it('酒馆Lv1→概率加成2%', () => {
      expect(getRecruitBonus(1)).toBeCloseTo(0.02, 4);
    });

    it('酒馆Lv20→概率加成40%', () => {
      expect(getRecruitBonus(20)).toBeCloseTo(0.40, 4);
    });

    it('酒馆Lv0→无加成', () => {
      expect(getRecruitBonus(0)).toBe(0);
    });

    it('酒馆Lv负数→无加成', () => {
      expect(getRecruitBonus(-1)).toBe(0);
    });

    it('酒馆Lv超过20→按20级计算', () => {
      expect(getRecruitBonus(25)).toBeCloseTo(0.40, 4);
    });
  });

  // ─────────────────────────────────────────────
  // calculateActualRate
  // ─────────────────────────────────────────────
  describe('calculateActualRate', () => {
    it('完整公式：基础5%×(1+10%)×(1+5%)×(1+8%)≈6.237%', () => {
      // baseRate=0.05, tavernLevel=5→10%, techBonus=5%, heroInt=8%
      const result = calculateActualRate(0.05, 5, 0.05, 0.08);
      // 0.05 × 1.10 × 1.05 × 1.08 = 0.06237
      expect(result).toBeCloseTo(0.06237, 4);
    });

    it('无加成时返回基础概率', () => {
      expect(calculateActualRate(0.05, 0)).toBeCloseTo(0.05, 4);
    });

    it('仅酒馆加成', () => {
      // 0.05 × 1.10 = 0.055
      expect(calculateActualRate(0.05, 5)).toBeCloseTo(0.055, 4);
    });

    it('概率不超过1.0', () => {
      // 0.8 × 1.40 × 1.3 × 1.2 = 1.7472 → capped at 1.0
      expect(calculateActualRate(0.8, 20, 0.3, 0.2)).toBe(1.0);
    });
  });

  // ─────────────────────────────────────────────
  // getTavernUnlockLevel
  // ─────────────────────────────────────────────
  describe('getTavernUnlockLevel', () => {
    it('普通招募 Lv1 解锁', () => {
      expect(getTavernUnlockLevel('normalRecruit')).toBe(1);
    });

    it('高级招募 Lv6 解锁', () => {
      expect(getTavernUnlockLevel('advancedRecruit')).toBe(6);
    });

    it('十连招募 Lv11 解锁', () => {
      expect(getTavernUnlockLevel('tenPull')).toBe(11);
    });

    it('保底可见 Lv16 解锁', () => {
      expect(getTavernUnlockLevel('pityVisible')).toBe(16);
    });

    it('未知功能返回 -1', () => {
      expect(getTavernUnlockLevel('unknownFeature')).toBe(-1);
    });
  });

  // ─────────────────────────────────────────────
  // isTavernFeatureUnlocked
  // ─────────────────────────────────────────────
  describe('isTavernFeatureUnlocked', () => {
    it('Lv1~5: 普通招募可用', () => {
      expect(isTavernFeatureUnlocked(1, 'normalRecruit')).toBe(true);
      expect(isTavernFeatureUnlocked(3, 'normalRecruit')).toBe(true);
      expect(isTavernFeatureUnlocked(5, 'normalRecruit')).toBe(true);
    });

    it('Lv5: 高级招募不可用', () => {
      expect(isTavernFeatureUnlocked(5, 'advancedRecruit')).toBe(false);
    });

    it('Lv6~10: 高级招募可用', () => {
      expect(isTavernFeatureUnlocked(6, 'advancedRecruit')).toBe(true);
      expect(isTavernFeatureUnlocked(10, 'advancedRecruit')).toBe(true);
    });

    it('Lv16~20: 保底可见', () => {
      expect(isTavernFeatureUnlocked(15, 'pityVisible')).toBe(false);
      expect(isTavernFeatureUnlocked(16, 'pityVisible')).toBe(true);
      expect(isTavernFeatureUnlocked(20, 'pityVisible')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 序列化/反序列化
  // ─────────────────────────────────────────────
  describe('serialize/deserialize', () => {
    it('序列化包含版本号和快照', () => {
      const data = serializeTavernBridge(5);
      expect(data.version).toBe(TAVERN_BRIDGE_SAVE_VERSION);
      expect(data.lastBonusSnapshot).toBeCloseTo(0.10, 4);
    });

    it('反序列化合法数据', () => {
      const data = deserializeTavernBridge({
        version: 1,
        lastBonusSnapshot: 0.2,
      });
      expect(data.version).toBe(1);
      expect(data.lastBonusSnapshot).toBe(0.2);
    });

    it('反序列化无效数据返回默认值', () => {
      const data = deserializeTavernBridge(null);
      expect(data.version).toBe(TAVERN_BRIDGE_SAVE_VERSION);
    });
  });
});
