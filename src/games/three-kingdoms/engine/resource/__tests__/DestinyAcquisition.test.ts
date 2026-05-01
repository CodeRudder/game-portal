/**
 * 天命获取 P1 缺口补充测试
 *
 * 覆盖 PRD RES-2 天命获取的 9 种来源：
 * 1. 声望转生奖励（100 + 转生次数×50）
 * 2. 首次通关章节（100/章）
 * 3. 成就里程碑（50~200）
 * 4. 日常任务全套完成（20/日）
 * 5. 周常任务全套完成（80/周）
 * 6. 限时活动排名（50~300）
 * 7. 离线产出（天命阁，约5/天）
 * 8. NPC 好感度满级（150/位）
 * 9. 远征特殊节点（30~80）
 *
 * + 新手资源保护（前 7 天不被掠夺）
 *
 * 注意：天命（mandate）在 ResourceSystem 中无上限（cap=null），
 * 但大部分获取途径的引擎实现尚未完成，使用 TODO 标注。
 *
 * 测试策略：使用真实引擎实例，避免 mock
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import { resourceConfig } from '../resource-config';
import {
  INITIAL_RESOURCES,
  MIN_GRAIN_RESERVE,
  GOLD_SAFETY_LINE,
  MANDATE_CONFIRM_THRESHOLD,
  OFFLINE_MAX_SECONDS,
} from '../resource-config';
import type { ISystemDeps } from '../../../core/types';

// ── 辅助函数 ──

/** 创建 mock ISystemDeps */
function makeSystemDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    } as unknown,
    config: { get: vi.fn(), set: vi.fn() } as unknown,
    registry: { get: vi.fn(), has: vi.fn(), getAll: vi.fn() } as unknown,
  };
}

/** 创建真实的 ResourceSystem */
function createResourceSystem(): ResourceSystem {
  const rs = new ResourceSystem();
  rs.init(makeSystemDeps());
  return rs;
}

// ═══════════════════════════════════════════════════════════════
// 1. 天命基础属性
// ═══════════════════════════════════════════════════════════════

describe('天命基础属性', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createResourceSystem();
  });

  it('天命初始值为 0', () => {
    expect(rs.getAmount('mandate')).toBe(0);
  });

  it('天命无上限（cap=null）', () => {
    const caps = rs.getCaps();
    expect(caps.mandate).toBeNull();
  });

  it('天命可以无限增加', () => {
    rs.addResource('mandate', 999999);
    expect(rs.getAmount('mandate')).toBe(999999);
    rs.addResource('mandate', 1);
    expect(rs.getAmount('mandate')).toBe(1000000);
  });

  it('天命消耗正常工作', () => {
    rs.addResource('mandate', 500);
    const consumed = rs.consumeResource('mandate', 100);
    expect(consumed).toBe(100);
    expect(rs.getAmount('mandate')).toBe(400);
  });

  it('天命不足时消耗抛出错误', () => {
    rs.addResource('mandate', 50);
    expect(() => rs.consumeResource('mandate', 100)).toThrow();
  });

  it('天命消耗 0 或负数返回 0', () => {
    rs.addResource('mandate', 100);
    expect(rs.consumeResource('mandate', 0)).toBe(0);
    expect(rs.consumeResource('mandate', -10)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 天命获取来源（已实现的引擎功能）
// ═══════════════════════════════════════════════════════════════

describe('天命获取 — 引擎已实现', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createResourceSystem();
  });

  it('addResource 正确增加天命', () => {
    rs.addResource('mandate', 100);
    expect(rs.getAmount('mandate')).toBe(100);
  });

  it('多次 addResource 累加天命', () => {
    rs.addResource('mandate', 100);
    rs.addResource('mandate', 50);
    rs.addResource('mandate', 200);
    expect(rs.getAmount('mandate')).toBe(350);
  });

  it('addResource 返回实际增加量', () => {
    const actual = rs.addResource('mandate', 100);
    expect(actual).toBe(100);
  });

  it('addResource 负数或 0 不增加天命', () => {
    rs.addResource('mandate', 100);
    expect(rs.addResource('mandate', 0)).toBe(0);
    expect(rs.addResource('mandate', -50)).toBe(0);
    expect(rs.getAmount('mandate')).toBe(100);
  });

  it('天命产出速率可设置', () => {
    rs.setProductionRate('mandate', 0.1);
    const rates = rs.getProductionRates();
    expect(rates.mandate).toBe(0.1);
  });

  it('天命产出速率通过 tick 生效', () => {
    rs.setProductionRate('mandate', 0.1);
    rs.tick(10000); // 10 秒
    // 0.1 * 10 = 1.0 mandate
    expect(rs.getAmount('mandate')).toBeCloseTo(1.0, 5);
  });

  it('天命产出速率 + 加成乘数', () => {
    rs.setProductionRate('mandate', 0.1);
    // 科技加成 15% + 主城加成 35%
    rs.tick(10000, { tech: 0.15, castle: 0.35 });
    // 0.1 * 10 * (1 + 0.15) * (1 + 0.35) = 1.0 * 1.15 * 1.35 = 1.5525
    expect(rs.getAmount('mandate')).toBeCloseTo(1.5525, 3);
  });

  it('canAfford 正确检查天命消耗', () => {
    rs.addResource('mandate', 100);
    expect(rs.canAfford({ mandate: 50 }).canAfford).toBe(true);
    expect(rs.canAfford({ mandate: 100 }).canAfford).toBe(true);
    expect(rs.canAfford({ mandate: 101 }).canAfford).toBe(false);
  });

  it('consumeBatch 原子消耗天命', () => {
    rs.addResource('mandate', 200);
    rs.addResource('gold', 1000);
    // 初始 gold=300 + 1000 = 1300
    rs.consumeBatch({ mandate: 100, gold: 500 });
    expect(rs.getAmount('mandate')).toBe(100);
    expect(rs.getAmount('gold')).toBe(800); // 1300 - 500
  });

  it('consumeBatch 天命不足时全部失败', () => {
    rs.addResource('mandate', 50);
    rs.addResource('gold', 1000);
    // 初始 gold=300 + 1000 = 1300
    expect(() => rs.consumeBatch({ mandate: 100, gold: 500 })).toThrow();
    // 不应消耗任何资源
    expect(rs.getAmount('mandate')).toBe(50);
    expect(rs.getAmount('gold')).toBe(1300);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 天命获取来源（TODO: 引擎未实现）
// ═══════════════════════════════════════════════════════════════

describe.todo('天命获取 — PRD 定义但引擎未实现', () => {
  it.todo('声望转生奖励：100 + 转生次数×50 天命');
  it.todo('首次通关章节：100 天命/章');
  it.todo('成就里程碑：50~200 天命');
  it.todo('日常任务全套完成：20 天命/日');
  it.todo('周常任务全套完成：80 天命/周');
  it.todo('限时活动排名：50~300 天命');
  it.todo('离线产出（天命阁）：约 5/天，需声望≥3 且天命阁已解锁');
  it.todo('NPC 好感度满级：150 天命/位');
  it.todo('远征特殊节点：30~80 天命');
});

// ═══════════════════════════════════════════════════════════════
// 4. 天命消耗用途（PRD 定义）
// ═══════════════════════════════════════════════════════════════

describe('天命消耗用途', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createResourceSystem();
  });

  it('高级招募消耗天命（100/次）— 通过 ResourceSystem 消耗', () => {
    rs.addResource('mandate', 500);
    rs.consumeResource('mandate', 100);
    expect(rs.getAmount('mandate')).toBe(400);
  });

  it('科技研究加速消耗天命（50~200）', () => {
    rs.addResource('mandate', 500);
    rs.consumeResource('mandate', 150);
    expect(rs.getAmount('mandate')).toBe(350);
  });

  it('转生重置消耗天命（300）', () => {
    rs.addResource('mandate', 500);
    rs.consumeResource('mandate', 300);
    expect(rs.getAmount('mandate')).toBe(200);
  });

  it('天命大额消耗阈值 >100 需二次确认（PRD RES-6）', () => {
    // 验证配置常量
    expect(MANDATE_CONFIRM_THRESHOLD).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 新手资源保护（RES-6）
// ═══════════════════════════════════════════════════════════════

describe('新手资源保护（RES-6）', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createResourceSystem();
  });

  it('粮草最低保留 10（MIN_GRAIN_RESERVE）', () => {
    expect(MIN_GRAIN_RESERVE).toBe(10);
  });

  it('粮草消耗保护：始终保留 MIN_GRAIN_RESERVE', () => {
    rs.setResource('grain', 100);
    // 消耗 90，剩余 10（保留量）
    rs.consumeResource('grain', 90);
    expect(rs.getAmount('grain')).toBe(10);
  });

  it('粮草消耗不足时抛出错误（保留量不可动用）', () => {
    rs.setResource('grain', 50);
    // 可用 = 50 - 10 = 40，消耗 50 应失败
    expect(() => rs.consumeResource('grain', 50)).toThrow(/粮草不足/);
    expect(rs.getAmount('grain')).toBe(50); // 未消耗
  });

  it('铜钱安全线配置（<500 禁止非必要消费）', () => {
    expect(GOLD_SAFETY_LINE).toBe(500);
  });

  it('天命消耗保护阈值配置（>100 需二次确认）', () => {
    expect(MANDATE_CONFIRM_THRESHOLD).toBe(100);
  });

  it('离线收益封顶配置（>72h 按72h计算）', () => {
    // 验证配置：OFFLINE_MAX_SECONDS = 259200 (72h)
    expect(OFFLINE_MAX_SECONDS).toBe(259200);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 天命序列化/反序列化
// ═══════════════════════════════════════════════════════════════

describe('天命序列化完整性', () => {
  it('天命正确序列化', () => {
    const rs = createResourceSystem();
    rs.addResource('mandate', 1234);
    const saved = rs.serialize();
    expect(saved.resources.mandate).toBe(1234);
  });

  it('天命正确反序列化', () => {
    const rs = createResourceSystem();
    rs.addResource('mandate', 5678);
    const saved = rs.serialize();

    const rs2 = createResourceSystem();
    rs2.deserialize(saved);
    expect(rs2.getAmount('mandate')).toBe(5678);
  });

  it('天命产出速率正确序列化', () => {
    const rs = createResourceSystem();
    rs.setProductionRate('mandate', 0.5);
    const saved = rs.serialize();
    expect(saved.productionRates.mandate).toBe(0.5);
  });

  it('天命产出速率正确反序列化', () => {
    const rs = createResourceSystem();
    rs.setProductionRate('mandate', 0.5);
    const saved = rs.serialize();

    const rs2 = createResourceSystem();
    rs2.deserialize(saved);
    expect(rs2.getProductionRates().mandate).toBe(0.5);
  });

  it('序列化后天命无上限保持 null', () => {
    const rs = createResourceSystem();
    const saved = rs.serialize();
    expect(saved.caps.mandate).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 天命与其他资源联动
// ═══════════════════════════════════════════════════════════════

describe('天命与其他资源联动', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createResourceSystem();
  });

  it('批量消耗天命+铜钱成功', () => {
    rs.addResource('mandate', 200);
    rs.addResource('gold', 1000);
    // 初始 gold=300 + 1000 = 1300
    rs.consumeBatch({ mandate: 100, gold: 500 });
    expect(rs.getAmount('mandate')).toBe(100);
    expect(rs.getAmount('gold')).toBe(800); // 1300 - 500
  });

  it('批量消耗天命不足时铜钱也不消耗', () => {
    rs.addResource('mandate', 50);
    rs.addResource('gold', 1000);
    // 初始 gold=300 + 1000 = 1300
    expect(() => rs.consumeBatch({ mandate: 100, gold: 500 })).toThrow();
    expect(rs.getAmount('mandate')).toBe(50);
    expect(rs.getAmount('gold')).toBe(1300);
  });

  it('天令不受粮草保护影响', () => {
    rs.addResource('mandate', 100);
    rs.setResource('grain', 100); // 确保粮草不受初始值影响
    // 天命消耗不受粮草保留规则影响
    rs.consumeResource('mandate', 100);
    expect(rs.getAmount('mandate')).toBe(0);
    // 粮草仍为 100（未消耗）
    expect(rs.getAmount('grain')).toBe(100);
  });

  it('canAfford 正确检查多资源消耗（含天命）', () => {
    rs.addResource('mandate', 100);
    rs.addResource('gold', 500);
    rs.addResource('grain', 1000);

    const check = rs.canAfford({ mandate: 50, gold: 300, grain: 500 });
    expect(check.canAfford).toBe(true);
  });

  it('canAfford 天命不足时返回 false', () => {
    rs.addResource('mandate', 30);
    rs.addResource('gold', 500);

    const check = rs.canAfford({ mandate: 50, gold: 300 });
    expect(check.canAfford).toBe(false);
    expect(check.shortages.mandate).toBeDefined();
    expect(check.shortages.mandate!.required).toBe(50);
    expect(check.shortages.mandate!.current).toBe(30);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 天命溢出（无上限）验证
// ═══════════════════════════════════════════════════════════════

describe('天命溢出验证', () => {
  it('天命增加不触发 resource:overflow 事件', () => {
    const rs = createResourceSystem();
    const emitSpy = vi.fn();
    (rs as any).deps = {
      eventBus: { on: vi.fn(), off: vi.fn(), emit: emitSpy },
    };

    rs.addResource('mandate', 999999);
    // 天命无上限，不应触发溢出事件
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('天命产出速率 tick 不截断', () => {
    const rs = createResourceSystem();
    rs.setProductionRate('mandate', 10); // 极高速率
    rs.tick(100000); // 100 秒
    // 10 * 100 = 1000，无截断
    expect(rs.getAmount('mandate')).toBeCloseTo(1000, 3);
  });
});
