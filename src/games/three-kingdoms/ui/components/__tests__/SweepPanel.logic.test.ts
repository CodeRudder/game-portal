/**
 * SweepPanel 逻辑测试 — 不依赖 DOM 渲染
 *
 * 测试 SweepLogic 的核心逻辑：
 * - 扫荡次数选项
 * - 扫荡令计算
 * - 扫荡可行性检查
 * - 预估收益计算
 * - 资源格式化
 */

import { SweepLogic } from '../battle/SweepPanel';

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SweepLogic — 扫荡次数选项', () => {
  it('默认返回所有选项', () => {
    const logic = new SweepLogic(100);
    const options = logic.getAvailableCounts();
    expect(options).toEqual([1, 3, 5, 10]);
  });

  it('最大扫荡次数为5时过滤10', () => {
    const logic = new SweepLogic(100, 1, 5);
    const options = logic.getAvailableCounts();
    expect(options).toEqual([1, 3, 5]);
  });

  it('最大扫荡次数为3时只返回1和3', () => {
    const logic = new SweepLogic(100, 1, 3);
    const options = logic.getAvailableCounts();
    expect(options).toEqual([1, 3]);
  });
});

describe('SweepLogic — 扫荡令计算', () => {
  it('每次消耗1个令，5次需要5个', () => {
    const logic = new SweepLogic(100, 1);
    expect(logic.getRequiredTickets(5)).toBe(5);
  });

  it('每次消耗2个令，3次需要6个', () => {
    const logic = new SweepLogic(100, 2);
    expect(logic.getRequiredTickets(3)).toBe(6);
  });

  it('扫荡令充足', () => {
    const logic = new SweepLogic(10, 1);
    expect(logic.hasEnoughTickets(5)).toBe(true);
  });

  it('扫荡令不足', () => {
    const logic = new SweepLogic(3, 1);
    expect(logic.hasEnoughTickets(5)).toBe(false);
  });

  it('刚好够', () => {
    const logic = new SweepLogic(5, 1);
    expect(logic.hasEnoughTickets(5)).toBe(true);
  });
});

describe('SweepLogic — 最大可扫荡次数', () => {
  it('扫荡令充足返回最大次数', () => {
    const logic = new SweepLogic(100, 1, 10);
    expect(logic.getMaxAffordableCount()).toBe(10);
  });

  it('扫荡令限制可扫荡次数', () => {
    const logic = new SweepLogic(3, 1, 10);
    expect(logic.getMaxAffordableCount()).toBe(3);
  });

  it('消耗2个令时计算正确', () => {
    const logic = new SweepLogic(7, 2, 10);
    expect(logic.getMaxAffordableCount()).toBe(3); // floor(7/2) = 3
  });
});

describe('SweepLogic — 扫荡可行性检查', () => {
  it('正常情况可以扫荡', () => {
    const logic = new SweepLogic(10, 1, 10, true, 3);
    const check = logic.canSweep(5);
    expect(check.can).toBe(true);
  });

  it('关卡未三星通关不可扫荡', () => {
    const logic = new SweepLogic(10, 1, 10, false, 2);
    const check = logic.canSweep(5);
    expect(check.can).toBe(false);
    expect(check.reason).toContain('三星');
  });

  it('次数为0不可扫荡', () => {
    const logic = new SweepLogic(10, 1, 10, true, 3);
    const check = logic.canSweep(0);
    expect(check.can).toBe(false);
  });

  it('超过最大次数不可扫荡', () => {
    const logic = new SweepLogic(100, 1, 5, true, 3);
    const check = logic.canSweep(10);
    expect(check.can).toBe(false);
    expect(check.reason).toContain('5');
  });

  it('扫荡令不足不可扫荡', () => {
    const logic = new SweepLogic(2, 1, 10, true, 3);
    const check = logic.canSweep(5);
    expect(check.can).toBe(false);
    expect(check.reason).toContain('不足');
  });
});

describe('SweepLogic — 预估收益', () => {
  it('三星关卡预估收益', () => {
    const logic = new SweepLogic(100, 1, 10, true, 3);
    const estimate = logic.estimateReward(5);
    expect(estimate.estimatedExp).toBe(500); // 5 * 100 * 1.0
    expect(estimate.estimatedResources.grain).toBe(250); // 5 * 50 * 1.0
    expect(estimate.estimatedResources.gold).toBe(150); // 5 * 30 * 1.0
  });

  it('二星关卡预估收益打折', () => {
    const logic = new SweepLogic(100, 1, 10, true, 2);
    const estimate = logic.estimateReward(1);
    expect(estimate.estimatedExp).toBe(67); // round(1 * 100 * 2/3)
  });

  it('单次扫荡预估', () => {
    const logic = new SweepLogic(100, 1, 10, true, 3);
    const estimate = logic.estimateReward(1);
    expect(estimate.estimatedExp).toBe(100);
  });
});

describe('SweepLogic — 扫荡令信息', () => {
  it('获取扫荡令信息', () => {
    const logic = new SweepLogic(5, 2);
    const info = logic.getTicketInfo();
    expect(info.current).toBe(5);
    expect(info.costPerRun).toBe(2);
  });
});

describe('SweepLogic — 资源格式化', () => {
  it('格式化资源', () => {
    const result = SweepLogic.formatResources({ grain: 100, gold: 50, troops: 30 });
    expect(result).toContain('粮草: 100');
    expect(result).toContain('铜钱: 50');
    expect(result).toContain('兵力: 30');
  });

  it('过滤0值资源', () => {
    const result = SweepLogic.formatResources({ grain: 0, gold: 50 });
    expect(result).not.toContain('粮草');
    expect(result).toContain('铜钱: 50');
  });

  it('空资源返回空数组', () => {
    const result = SweepLogic.formatResources({});
    expect(result).toEqual([]);
  });
});
