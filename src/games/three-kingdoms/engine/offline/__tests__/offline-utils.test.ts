/**
 * offline-utils 单元测试
 *
 * 覆盖：
 * 1. zeroRes — 创建零资源
 * 2. cloneRes — 克隆资源
 * 3. addRes — 资源相加
 * 4. mulRes — 资源乘以标量
 * 5. floorRes — 向下取整
 */

import {
  zeroRes,
  cloneRes,
  addRes,
  mulRes,
  floorRes,
} from '../offline-utils';

import type { Resources } from '../../shared/types';

describe('offline-utils', () => {
  // ─── zeroRes ──────────────────────────────

  describe('zeroRes', () => {
    it('应返回全零资源', () => {
      const r = zeroRes();
      expect(r.grain).toBe(0);
      expect(r.gold).toBe(0);
      expect(r.troops).toBe(0);
      expect(r.mandate).toBe(0);
      expect(r.techPoint).toBe(0);
      expect(r.recruitToken).toBe(0);
      expect(r.skillBook).toBe(0);
    });
  });

  // ─── cloneRes ─────────────────────────────

  describe('cloneRes', () => {
    it('应返回独立副本', () => {
      const r: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const c = cloneRes(r);
      expect(c).toEqual(r);
      c.grain = 999;
      expect(r.grain).toBe(10);
    });
  });

  // ─── addRes ───────────────────────────────

  describe('addRes', () => {
    it('应正确相加', () => {
      const a: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const b: Resources = { grain: 5, gold: 10, troops: 15, mandate: 2, techPoint: 1, recruitToken: 1, skillBook: 1, ore: 0, wood: 0 };
      const result = addRes(a, b);
      expect(result.grain).toBe(15);
      expect(result.gold).toBe(30);
    });

    it('加零应不变', () => {
      const a: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const z = zeroRes();
      const result = addRes(a, z);
      expect(result).toEqual(a);
    });
  });

  // ─── mulRes ───────────────────────────────

  describe('mulRes', () => {
    it('应正确乘以标量', () => {
      const r: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const result = mulRes(r, 2);
      expect(result.grain).toBe(20);
      expect(result.gold).toBe(40);
    });

    it('乘以0应返回零', () => {
      const r: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const result = mulRes(r, 0);
      expect(result.grain).toBe(0);
    });

    it('乘以小数应正确计算', () => {
      const r: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const result = mulRes(r, 0.5);
      expect(result.grain).toBe(5);
    });
  });

  // ─── floorRes ─────────────────────────────

  describe('floorRes', () => {
    it('应向下取整', () => {
      const r: Resources = { grain: 10.9, gold: 20.1, troops: 30.5, mandate: 5.99, techPoint: 1.1, recruitToken: 2.8, skillBook: 3.3 };
      const result = floorRes(r);
      expect(result.grain).toBe(10);
      expect(result.gold).toBe(20);
      expect(result.troops).toBe(30);
    });

    it('整数应不变', () => {
      const r: Resources = { grain: 10, gold: 20, troops: 30, mandate: 5, techPoint: 1, recruitToken: 2, skillBook: 3 };
      const result = floorRes(r);
      expect(result).toEqual(r);
    });
  });
});
