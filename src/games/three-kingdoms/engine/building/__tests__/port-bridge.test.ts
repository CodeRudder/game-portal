/**
 * 市舶司↔贸易桥接层 — 单元测试
 *
 * @module engine/building/__tests__/port-bridge.test
 */

import { describe, it, expect } from 'vitest';
import {
  getTradeDiscount,
  getProsperityBonus,
  getMaxCaravans,
  calculateProsperityLevel,
  calculateMarketGoldBonus,
  applyTradeDiscount,
  serializePortBridge,
  deserializePortBridge,
  PORT_BRIDGE_SAVE_VERSION,
} from '../port-bridge';

describe('PortBridge', () => {
  // ─────────────────────────────────────────────
  // getTradeDiscount
  // ─────────────────────────────────────────────
  describe('getTradeDiscount', () => {
    it('市舶司Lv5→贸易折扣5%', () => {
      expect(getTradeDiscount(5)).toBe(5);
    });

    it('市舶司Lv10→贸易折扣10%', () => {
      expect(getTradeDiscount(10)).toBe(10);
    });

    it('市舶司Lv1→贸易折扣1%', () => {
      expect(getTradeDiscount(1)).toBe(1);
    });

    it('市舶司Lv20→贸易折扣20%', () => {
      expect(getTradeDiscount(20)).toBe(20);
    });

    it('市舶司Lv0→无折扣', () => {
      expect(getTradeDiscount(0)).toBe(0);
    });

    it('市舶司Lv负数→无折扣', () => {
      expect(getTradeDiscount(-1)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // getMaxCaravans
  // ─────────────────────────────────────────────
  describe('getMaxCaravans', () => {
    it('市舶司Lv1→最大商队1支', () => {
      expect(getMaxCaravans(1)).toBe(1);
    });

    it('市舶司Lv5→最大商队2支', () => {
      expect(getMaxCaravans(5)).toBe(2);
    });

    it('市舶司Lv10→最大商队3支', () => {
      expect(getMaxCaravans(10)).toBe(3);
    });

    it('市舶司Lv15→最大商队4支', () => {
      expect(getMaxCaravans(15)).toBe(4);
    });

    it('市舶司Lv20→最大商队5支', () => {
      expect(getMaxCaravans(20)).toBe(5);
    });

    it('市舶司Lv0→无商队', () => {
      expect(getMaxCaravans(0)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // getProsperityBonus
  // ─────────────────────────────────────────────
  describe('getProsperityBonus', () => {
    it('市舶司Lv1→繁荣度产出+50/h', () => {
      expect(getProsperityBonus(1)).toBe(50);
    });

    it('市舶司Lv10→繁荣度产出+250/h', () => {
      expect(getProsperityBonus(10)).toBe(250);
    });

    it('市舶司Lv15→繁荣度产出+350/h', () => {
      expect(getProsperityBonus(15)).toBe(350);
    });

    it('市舶司Lv20→繁荣度产出+500/h', () => {
      expect(getProsperityBonus(20)).toBe(500);
    });

    it('市舶司Lv0→无繁荣度', () => {
      expect(getProsperityBonus(0)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // calculateMarketGoldBonus
  // ─────────────────────────────────────────────
  describe('calculateMarketGoldBonus', () => {
    it('繁荣度等级1→市集铜钱加成+5%', () => {
      expect(calculateMarketGoldBonus(1)).toBe(5);
    });

    it('繁荣度等级3→市集铜钱加成+15%', () => {
      expect(calculateMarketGoldBonus(3)).toBe(15);
    });

    it('繁荣度等级5→市集铜钱加成+25%', () => {
      expect(calculateMarketGoldBonus(5)).toBe(25);
    });

    it('繁荣度等级0→无加成', () => {
      expect(calculateMarketGoldBonus(0)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // calculateProsperityLevel
  // ─────────────────────────────────────────────
  describe('calculateProsperityLevel', () => {
    it('经验值0→等级1', () => {
      expect(calculateProsperityLevel(0)).toBe(1);
    });

    it('经验值500→等级1', () => {
      expect(calculateProsperityLevel(500)).toBe(1);
    });

    it('经验值1000→等级2', () => {
      expect(calculateProsperityLevel(1000)).toBe(2);
    });

    it('经验值3000→等级3', () => {
      expect(calculateProsperityLevel(3000)).toBe(3);
    });

    it('经验值6000→等级4', () => {
      expect(calculateProsperityLevel(6000)).toBe(4);
    });

    it('经验值10000→等级5', () => {
      expect(calculateProsperityLevel(10000)).toBe(5);
    });

    it('经验值超过上限→等级5', () => {
      expect(calculateProsperityLevel(99999)).toBe(5);
    });
  });

  // ─────────────────────────────────────────────
  // applyTradeDiscount
  // ─────────────────────────────────────────────
  describe('applyTradeDiscount', () => {
    it('原价1000，Lv10折扣10%→900', () => {
      expect(applyTradeDiscount(1000, 10)).toBe(900);
    });

    it('原价500，Lv5折扣5%→475', () => {
      expect(applyTradeDiscount(500, 5)).toBe(475);
    });

    it('原价100，Lv0无折扣→100', () => {
      expect(applyTradeDiscount(100, 0)).toBe(100);
    });
  });

  // ─────────────────────────────────────────────
  // 序列化/反序列化
  // ─────────────────────────────────────────────
  describe('serialize/deserialize', () => {
    it('序列化包含版本号和繁荣度经验', () => {
      const data = serializePortBridge(2500);
      expect(data.version).toBe(PORT_BRIDGE_SAVE_VERSION);
      expect(data.prosperityExp).toBe(2500);
    });

    it('反序列化合法数据', () => {
      const data = deserializePortBridge({
        version: 1,
        prosperityExp: 5000,
      });
      expect(data.version).toBe(1);
      expect(data.prosperityExp).toBe(5000);
    });

    it('反序列化无效数据返回默认值', () => {
      const data = deserializePortBridge(null);
      expect(data.version).toBe(PORT_BRIDGE_SAVE_VERSION);
      expect(data.prosperityExp).toBe(0);
    });

    it('反序列化缺少字段的数据使用默认值', () => {
      const data = deserializePortBridge({ version: 1 });
      expect(data.prosperityExp).toBe(0);
    });
  });
});
