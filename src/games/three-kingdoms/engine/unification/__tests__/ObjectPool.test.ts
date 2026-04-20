/**
 * ObjectPool 测试
 *
 * 覆盖：
 *   - 预分配
 *   - 分配/回收
 *   - 扩容
 *   - 命中率统计
 *   - 清空
 */

import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../ObjectPool';

interface TestObj {
  x: number;
  y: number;
  active: boolean;
}

function createPool(initialSize: number = 5): ObjectPool<TestObj> {
  return new ObjectPool<TestObj>(
    'test',
    () => ({ x: 0, y: 0, active: false }),
    (obj) => { obj.x = 0; obj.y = 0; obj.active = false; },
    initialSize,
  );
}

describe('ObjectPool', () => {
  describe('预分配', () => {
    it('应预分配指定数量的对象', () => {
      const pool = createPool(5);
      const state = pool.getState();
      expect(state.poolSize).toBe(5);
      expect(state.activeCount).toBe(0);
    });

    it('初始命中率和分配数应为 0', () => {
      const pool = createPool(3);
      const state = pool.getState();
      expect(state.totalAllocations).toBe(0);
      expect(state.totalDeallocations).toBe(0);
      expect(state.hitRate).toBe(0);
    });

    it('应记录池名称', () => {
      const pool = createPool(1);
      expect(pool.getState().name).toBe('test');
    });
  });

  describe('分配/回收', () => {
    it('allocate 应返回对象', () => {
      const pool = createPool(3);
      const obj = pool.allocate();
      expect(obj).toBeDefined();
      expect(obj.x).toBe(0);
    });

    it('allocate 后 activeCount 应增加', () => {
      const pool = createPool(3);
      pool.allocate();
      pool.allocate();
      expect(pool.getState().activeCount).toBe(2);
    });

    it('deallocate 应回收对象', () => {
      const pool = createPool(3);
      const obj = pool.allocate();
      obj.x = 42;
      pool.deallocate(obj);
      expect(obj.x).toBe(0); // resetFn should have reset it
      expect(pool.getState().activeCount).toBe(0);
    });

    it('deallocate 应增加 totalDeallocations', () => {
      const pool = createPool(3);
      const obj = pool.allocate();
      pool.deallocate(obj);
      expect(pool.getState().totalDeallocations).toBe(1);
    });

    it('deallocate 不存在的对象应无操作', () => {
      const pool = createPool(3);
      pool.deallocate({ x: 0, y: 0, active: false });
      expect(pool.getState().totalDeallocations).toBe(0);
    });
  });

  describe('扩容', () => {
    it('池耗尽时应自动扩容', () => {
      const pool = createPool(2);
      pool.allocate();
      pool.allocate();
      pool.allocate();
      expect(pool.getState().poolSize).toBeGreaterThanOrEqual(3);
      expect(pool.getState().activeCount).toBe(3);
    });

    it('misses 应在扩容时增加', () => {
      const pool = createPool(1);
      pool.allocate();
      pool.allocate();
      expect(pool.getState().hitRate).toBeLessThan(1);
    });
  });

  describe('命中率', () => {
    it('复用对象应提高命中率', () => {
      const pool = createPool(5);
      const obj = pool.allocate();
      pool.deallocate(obj);
      pool.allocate(); // 应命中
      const state = pool.getState();
      expect(state.totalAllocations).toBe(2);
      expect(state.hitRate).toBeGreaterThan(0);
    });

    it('全部命中时 hitRate 应为 1', () => {
      const pool = createPool(5);
      const obj1 = pool.allocate();
      pool.deallocate(obj1);
      pool.allocate(); // hit
      expect(pool.getState().hitRate).toBe(1);
    });
  });

  describe('clear', () => {
    it('clear 应清空池', () => {
      const pool = createPool(5);
      pool.allocate();
      pool.allocate();
      pool.clear();
      const state = pool.getState();
      expect(state.poolSize).toBe(0);
      expect(state.activeCount).toBe(0);
      expect(state.totalAllocations).toBe(0);
      expect(state.totalDeallocations).toBe(0);
    });

    it('clear 后应可重新使用', () => {
      const pool = createPool(2);
      pool.clear();
      const obj = pool.allocate();
      expect(obj).toBeDefined();
    });
  });
});
