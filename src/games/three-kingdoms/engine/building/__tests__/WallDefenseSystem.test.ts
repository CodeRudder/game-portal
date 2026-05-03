/**
 * WallDefenseSystem 单元测试
 * 覆盖：城防值、守城防御加成、守城属性Buff、升级、序列化/反序列化
 */

import { describe, it, expect } from 'vitest';
import { WallDefenseSystem } from '../WallDefenseSystem';

describe('WallDefenseSystem', () => {
  let system: WallDefenseSystem;

  beforeEach(() => {
    system = new WallDefenseSystem();
  });

  // ─────────────────────────────────────────
  // 城防值
  // ─────────────────────────────────────────

  describe('getDefenseValue', () => {
    it('城墙Lv5 → 城防值2000', () => {
      system.init(5);
      expect(system.getDefenseValue()).toBe(2000);
    });

    it('城墙Lv1 → 城防值300', () => {
      system.init(1);
      expect(system.getDefenseValue()).toBe(300);
    });

    it('城墙Lv10 → 城防值5000', () => {
      system.init(10);
      expect(system.getDefenseValue()).toBe(5000);
    });

    it('城墙Lv0 → 城防值0', () => {
      system.init(0);
      expect(system.getDefenseValue()).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 守城防御加成
  // ─────────────────────────────────────────

  describe('getDefenseBonus', () => {
    it('城墙Lv10 → 守城防御加成25%', () => {
      system.init(10);
      expect(system.getDefenseBonus()).toBe(25);
    });

    it('城墙Lv5 → 守城防御加成12%', () => {
      system.init(5);
      expect(system.getDefenseBonus()).toBe(12);
    });

    it('城墙Lv0 → 守城防御加成0%', () => {
      system.init(0);
      expect(system.getDefenseBonus()).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 守城属性Buff
  // ─────────────────────────────────────────

  describe('getGarrisonBuff', () => {
    it('城墙Lv5 → 守城攻击+5%, 防御+10%', () => {
      system.init(5);
      const buff = system.getGarrisonBuff();
      expect(buff.attackBonus).toBeCloseTo(0.05);
      expect(buff.defenseBonus).toBeCloseTo(0.10);
    });

    it('城墙Lv10 → 守城攻击+10%, 防御+20%', () => {
      system.init(10);
      const buff = system.getGarrisonBuff();
      expect(buff.attackBonus).toBeCloseTo(0.10);
      expect(buff.defenseBonus).toBeCloseTo(0.20);
    });

    it('城墙Lv0 → 守城攻击+0%, 防御+0%', () => {
      system.init(0);
      const buff = system.getGarrisonBuff();
      expect(buff.attackBonus).toBe(0);
      expect(buff.defenseBonus).toBe(0);
    });
  });

  // ─────────────────────────────────────────
  // 升级
  // ─────────────────────────────────────────

  describe('upgradeWall', () => {
    it('升级后数值更新', () => {
      system.init(1);
      expect(system.getDefenseValue()).toBe(300);

      system.upgradeWall(5);
      expect(system.getDefenseValue()).toBe(2000);
      expect(system.getDefenseBonus()).toBe(12);
      expect(system.getGarrisonBuff().attackBonus).toBeCloseTo(0.05);
      expect(system.getGarrisonBuff().defenseBonus).toBeCloseTo(0.10);
    });

    it('不允许降级', () => {
      system.init(10);
      system.upgradeWall(5);
      expect(system.getWallLevel()).toBe(10);
    });

    it('连续升级', () => {
      system.init(1);
      system.upgradeWall(5);
      system.upgradeWall(10);
      expect(system.getDefenseValue()).toBe(5000);
    });
  });

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('序列化后反序列化恢复一致状态', () => {
      system.init(7);
      const data = system.serialize();

      const system2 = new WallDefenseSystem();
      system2.deserialize(data);

      expect(system2.getWallLevel()).toBe(7);
      expect(system2.getDefenseValue()).toBe(system.getDefenseValue());
      expect(system2.getDefenseBonus()).toBe(system.getDefenseBonus());
      expect(system2.getGarrisonBuff()).toEqual(system.getGarrisonBuff());
    });

    it('reset 后回到初始状态', () => {
      system.init(10);
      system.reset();
      expect(system.getWallLevel()).toBe(0);
      expect(system.getDefenseValue()).toBe(0);
      expect(system.getDefenseBonus()).toBe(0);
    });
  });
});
