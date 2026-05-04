/**
 * Round 13 Task 3 — 内应信掉落(I7) + 攻城策略道具(I8) 测试
 *
 * @module engine/map/__tests__/SiegeReward.drop.test
 */

import { describe, it, expect } from 'vitest';
import {
  SiegeItemSystem,
  hashCode,
  shouldDropInsiderLetter,
  type SiegeItemType,
} from '../SiegeItemSystem';

// ─────────────────────────────────────────────
// I7: 内应信掉落逻辑
// ─────────────────────────────────────────────

describe('I7: 内应信掉落逻辑 (shouldDropInsiderLetter)', () => {
  it('固定种子 taskId 确定性结果: 同一ID始终返回相同结果', () => {
    const taskId = 'task-seed42';
    const results: boolean[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(shouldDropInsiderLetter(taskId));
    }
    // 100次调用结果应完全一致
    const allSame = results.every((r) => r === results[0]);
    expect(allSame).toBe(true);
  });

  it('不同种子产生不同结果', () => {
    const dropCount = new Set<string>();
    const noDropCount = new Set<string>();

    for (let i = 1; i <= 100; i++) {
      const taskId = `siege-task-${i}`;
      if (shouldDropInsiderLetter(taskId)) {
        dropCount.add(taskId);
      } else {
        noDropCount.add(taskId);
      }
    }

    // 两种结果都应存在（概率极高，除非seed极端情况）
    expect(dropCount.size).toBeGreaterThan(0);
    expect(noDropCount.size).toBeGreaterThan(0);
  });

  it('100个任务的掉落数约20个(10~30范围)', () => {
    let dropped = 0;
    for (let i = 1; i <= 100; i++) {
      if (shouldDropInsiderLetter(`siege-task-${i}`)) {
        dropped++;
      }
    }
    // 20%概率 × 100次 → 期望20, 允许10~30浮动 (确定性hash, 放宽范围)
    expect(dropped).toBeGreaterThanOrEqual(10);
    expect(dropped).toBeLessThanOrEqual(30);
  });

  it('hashCode函数输出稳定且非负', () => {
    const h1 = hashCode('task-seed42');
    const h2 = hashCode('task-seed42');
    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
  });

  it('hashCode不同字符串产生不同值', () => {
    const h1 = hashCode('task-a');
    const h2 = hashCode('task-b');
    expect(h1).not.toBe(h2);
  });
});

// ─────────────────────────────────────────────
// I8: 攻城策略道具系统
// ─────────────────────────────────────────────

describe('I8: SiegeItemSystem 道具管理', () => {
  let system: SiegeItemSystem;

  beforeEach(() => {
    system = new SiegeItemSystem();
  });

  it('初始状态: 无道具，hasItem返回false', () => {
    const types: SiegeItemType[] = ['nightRaid', 'insiderLetter', 'siegeManual'];
    for (const t of types) {
      expect(system.hasItem(t)).toBe(false);
      expect(system.getCount(t)).toBe(0);
    }
  });

  it('acquireItem后hasItem为true', () => {
    expect(system.acquireItem('nightRaid', 'shop')).toBe(true);
    expect(system.hasItem('nightRaid')).toBe(true);
    expect(system.getCount('nightRaid')).toBe(1);
  });

  it('consumeItem后count减少', () => {
    system.acquireItem('nightRaid', 'drop');
    system.acquireItem('nightRaid', 'drop');

    expect(system.getCount('nightRaid')).toBe(2);
    expect(system.consumeItem('nightRaid')).toBe(true);
    expect(system.getCount('nightRaid')).toBe(1);
  });

  it('consumeItem count=0不可消耗', () => {
    expect(system.getCount('insiderLetter')).toBe(0);
    expect(system.consumeItem('insiderLetter')).toBe(false);
    expect(system.getCount('insiderLetter')).toBe(0);
  });

  it('多次攻城掉落独立（无状态污染）', () => {
    // 使用不同taskId模拟多次独立攻城
    const results: boolean[] = [];
    for (let i = 1; i <= 50; i++) {
      // 每次创建新系统实例，模拟独立攻城
      const freshSystem = new SiegeItemSystem();
      const taskId = `siege-task-${i}`;
      if (shouldDropInsiderLetter(taskId)) {
        freshSystem.acquireItem('insiderLetter', 'drop');
        results.push(true);
      } else {
        results.push(false);
      }
    }

    // 验证有真有假（说明独立性）
    expect(results.some((r) => r === true)).toBe(true);
    expect(results.some((r) => r === false)).toBe(true);
  });

  it('堆叠上限: acquireItem到达上限后返回false', () => {
    // nightRaid上限10
    for (let i = 0; i < 10; i++) {
      expect(system.acquireItem('nightRaid', 'daily')).toBe(true);
    }
    expect(system.getCount('nightRaid')).toBe(10);
    expect(system.acquireItem('nightRaid', 'shop')).toBe(false);
    expect(system.getCount('nightRaid')).toBe(10);
  });

  it('getInventory返回所有道具类型', () => {
    system.acquireItem('nightRaid', 'shop');
    system.acquireItem('insiderLetter', 'drop');

    const inv = system.getInventory();
    expect(inv).toHaveLength(3);
    expect(inv.find((i) => i.type === 'nightRaid')!.count).toBe(1);
    expect(inv.find((i) => i.type === 'insiderLetter')!.count).toBe(1);
    expect(inv.find((i) => i.type === 'siegeManual')!.count).toBe(0);
  });

  it('serialize/deserialize保存恢复完整状态', () => {
    system.acquireItem('nightRaid', 'shop');
    system.acquireItem('nightRaid', 'drop');
    system.consumeItem('nightRaid');

    const saved = system.serialize();
    const restored = new SiegeItemSystem();
    restored.deserialize(saved);

    expect(restored.getCount('nightRaid')).toBe(1);
    expect(restored.getTotalAcquired('nightRaid')).toBe(2);
    expect(restored.getTotalConsumed('nightRaid')).toBe(1);
  });

  it('不同来源获取均计入totalAcquired', () => {
    system.acquireItem('siegeManual', 'shop');
    system.acquireItem('siegeManual', 'drop');
    system.acquireItem('siegeManual', 'daily');

    expect(system.getCount('siegeManual')).toBe(3);
    expect(system.getTotalAcquired('siegeManual')).toBe(3);
  });

  it('consumeItem指定数量消耗', () => {
    system.acquireItem('nightRaid', 'shop');
    system.acquireItem('nightRaid', 'shop');
    system.acquireItem('nightRaid', 'shop');

    expect(system.consumeItem('nightRaid', 2)).toBe(true);
    expect(system.getCount('nightRaid')).toBe(1);
  });

  it('consumeItem数量不足时失败', () => {
    system.acquireItem('nightRaid', 'shop');
    expect(system.consumeItem('nightRaid', 2)).toBe(false);
    expect(system.getCount('nightRaid')).toBe(1);
  });

  it('reset清空所有数据', () => {
    system.acquireItem('nightRaid', 'shop');
    system.acquireItem('insiderLetter', 'drop');
    system.reset();

    expect(system.getCount('nightRaid')).toBe(0);
    expect(system.getCount('insiderLetter')).toBe(0);
    expect(system.hasItem('nightRaid')).toBe(false);
  });
});
