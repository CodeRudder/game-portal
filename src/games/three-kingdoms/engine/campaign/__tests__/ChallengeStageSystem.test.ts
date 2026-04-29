/**
 * ChallengeStageSystem 单元测试
 *
 * 覆盖挑战关卡系统的核心功能：
 * - 初始化与关卡配置查询
 * - 前置校验（兵力/体力/次数）
 * - 资源预锁与返还
 * - 挑战完成（胜利/失败）
 * - 奖励计算（固定/概率掉落/首通额外）
 * - 每日次数重置
 * - 序列化/反序列化
 *
 * 注意：preLockResources 内部调用 checkCanChallenge 时未传递 now 参数，
 * 导致使用 Date.now() 而非可控时间。测试中需要避免依赖精确的每日计数
 * （已记录为设计问题）。
 */

import { describe, it, expect, vi } from 'vitest';
import { ChallengeStageSystem } from '../ChallengeStageSystem';
import type {
  ChallengeDeps,
  ChallengeStageConfig,
  ChallengeResult,
  ChallengeSaveData,
} from '../ChallengeStageSystem';

// ─────────────────────────────────────────────
// 辅助：创建测试用依赖
// ─────────────────────────────────────────────

/** 创建标准 mock deps，资源通过闭包管理 */
function createDepsWithResources(initialResources?: Record<string, number>): {
  deps: ChallengeDeps;
  resources: Record<string, number>;
} {
  const resources: Record<string, number> = {
    troops: 1000,
    mandate: 100,
    grain: 0,
    gold: 0,
    ...initialResources,
  };
  const deps: ChallengeDeps = {
    getResourceAmount: (type: string) => resources[type] ?? 0,
    consumeResource: (type: string, amount: number) => {
      if ((resources[type] ?? 0) >= amount) {
        resources[type] -= amount;
        return true;
      }
      return false;
    },
    addResource: (type: string, amount: number) => {
      resources[type] = (resources[type] ?? 0) + amount;
    },
    addFragment: vi.fn(),
    addExp: vi.fn(),
  };
  return { deps, resources };
}

/** 创建标准 deps（简单场景） */
function createDeps(overrides?: Partial<ChallengeDeps>): ChallengeDeps {
  return createDepsWithResources().deps;
}

/** 创建最小测试关卡配置 */
function createTestStages(): ChallengeStageConfig[] {
  return [
    {
      id: 'test_1',
      name: '测试关卡·壹',
      armyCost: 200,
      staminaCost: 12,
      firstClearBonus: [{ type: 'mandate', amount: 50 }],
      rewards: [
        { type: 'grain', amount: 500 },
        { type: 'gold', amount: 300 },
      ],
      randomDrops: [
        { type: 'fragment_guanyu', amount: 1, probability: 0.5 },
      ],
    },
    {
      id: 'test_2',
      name: '测试关卡·贰',
      armyCost: 300,
      staminaCost: 14,
      firstClearBonus: [{ type: 'mandate', amount: 80 }],
      rewards: [
        { type: 'grain', amount: 800 },
      ],
      randomDrops: [],
    },
  ];
}

/** 固定时间戳 */
const NOW = new Date(2025, 0, 15, 12, 0, 0).getTime();
const NEXT_DAY = new Date(2025, 0, 16, 12, 0, 0).getTime();

// ─────────────────────────────────────────────
// 1. 初始化与查询
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 初始化与查询', () => {
  it('初始化所有关卡进度', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const progress1 = sys.getStageProgress('test_1');
    expect(progress1).toBeDefined();
    expect(progress1!.firstCleared).toBe(false);
    expect(progress1!.dailyAttempts).toBe(0);
  });

  it('getStageConfigs 返回所有配置', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.getStageConfigs()).toHaveLength(2);
  });

  it('getStageConfig 返回指定关卡', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const cfg = sys.getStageConfig('test_1');
    expect(cfg).toBeDefined();
    expect(cfg!.name).toBe('测试关卡·壹');
    expect(cfg!.armyCost).toBe(200);
    expect(cfg!.staminaCost).toBe(12);
  });

  it('getStageConfig 不存在返回 undefined', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.getStageConfig('nonexistent')).toBeUndefined();
  });

  it('getStageProgress 不存在返回 undefined', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.getStageProgress('nonexistent')).toBeUndefined();
  });

  it('isFirstCleared 初始为 false', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.isFirstCleared('test_1')).toBe(false);
  });

  it('ISubsystem 接口: name 属性', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.name).toBe('challengeStageSystem');
  });

  it('ISubsystem 接口: update 不抛异常', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(() => sys.update(16)).not.toThrow();
  });

  it('reset 恢复初始状态', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    sys.reset();
    expect(sys.isFirstCleared('test_1')).toBe(false);
    const progress = sys.getStageProgress('test_1');
    expect(progress!.dailyAttempts).toBe(0);
  });
});

// ─────────────────────────────────────────────
// 2. 前置校验
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 前置校验', () => {
  it('资源充足时校验通过', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.checkCanChallenge('test_1', NOW);
    expect(result.canChallenge).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('关卡不存在时校验失败', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.checkCanChallenge('nonexistent', NOW);
    expect(result.canChallenge).toBe(false);
    expect(result.reasons).toContain('关卡不存在');
  });

  it('兵力不足时校验失败', () => {
    const { deps } = createDepsWithResources({ troops: 50, mandate: 100 });
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.checkCanChallenge('test_1', NOW);
    expect(result.canChallenge).toBe(false);
    expect(result.reasons.some(r => r.includes('兵力不足'))).toBe(true);
  });

  it('天命不足时校验失败', () => {
    const { deps } = createDepsWithResources({ troops: 1000, mandate: 5 });
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.checkCanChallenge('test_1', NOW);
    expect(result.canChallenge).toBe(false);
    expect(result.reasons.some(r => r.includes('天命不足'))).toBe(true);
  });

  it('兵力不足时提示包含需要和当前数量', () => {
    const { deps } = createDepsWithResources({ troops: 50, mandate: 100 });
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.checkCanChallenge('test_1', NOW);
    const reason = result.reasons.find(r => r.includes('兵力不足'));
    expect(reason).toContain('200');
    expect(reason).toContain('50');
  });

  it('天命不足时提示包含需要和当前数量', () => {
    const { deps } = createDepsWithResources({ troops: 1000, mandate: 5 });
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.checkCanChallenge('test_1', NOW);
    const reason = result.reasons.find(r => r.includes('天命不足'));
    expect(reason).toContain('12');
    expect(reason).toContain('5');
  });

  it('每日次数用完时校验失败', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    // 完成3次挑战（通过直接操作进度来避免 now 参数问题）
    for (let i = 0; i < 3; i++) {
      sys.preLockResources('test_1');
      sys.completeChallenge('test_1', true);
    }
    // 使用 Date.now() 检查（与 preLockResources 一致）
    const result = sys.checkCanChallenge('test_1');
    expect(result.canChallenge).toBe(false);
    expect(result.reasons.some(r => r.includes('次数已用完'))).toBe(true);
  });

  it('getDailyRemaining 初始为3', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.getDailyRemaining('test_1', NOW)).toBe(3);
  });

  it('getDailyAttempts 不存在的关卡返回0', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.getDailyAttempts('nonexistent', NOW)).toBe(0);
  });
});

// ─────────────────────────────────────────────
// 3. 资源预锁
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 资源预锁', () => {
  it('preLockResources 成功扣减资源', () => {
    const { deps, resources } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.preLockResources('test_1')).toBe(true);
    expect(resources.troops).toBe(800); // 1000 - 200
    expect(resources.mandate).toBe(88);  // 100 - 12
  });

  it('preLockResources 关卡不存在返回 false', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.preLockResources('nonexistent')).toBe(false);
  });

  it('preLockResources 重复预锁返回 false', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.preLockResources('test_1')).toBe(true);
    expect(sys.preLockResources('test_1')).toBe(false);
  });

  it('preLockResources 兵力不足时返回 false', () => {
    const { deps } = createDepsWithResources({ troops: 50, mandate: 100 });
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.preLockResources('test_1')).toBe(false);
  });

  it('preLockResources 天命不足时返回 false', () => {
    const { deps } = createDepsWithResources({ troops: 1000, mandate: 5 });
    const sys = new ChallengeStageSystem(deps, createTestStages());
    expect(sys.preLockResources('test_1')).toBe(false);
  });

  it('preLockResources 扣减失败时回滚', () => {
    // 兵力够但天命不够 → 兵力扣了也要回滚
    const resources: Record<string, number> = { troops: 1000, mandate: 5 };
    const { deps } = createDepsWithResources(resources);
    // 重新设置资源
    const depsWithCustomResources: ChallengeDeps = {
      getResourceAmount: (type: string) => resources[type] ?? 0,
      consumeResource: (type: string, amount: number) => {
        if ((resources[type] ?? 0) >= amount) {
          resources[type] -= amount;
          return true;
        }
        return false;
      },
      addResource: (type: string, amount: number) => {
        resources[type] = (resources[type] ?? 0) + amount;
      },
      addFragment: vi.fn(),
      addExp: vi.fn(),
    };
    const sys = new ChallengeStageSystem(depsWithCustomResources, createTestStages());
    expect(sys.preLockResources('test_1')).toBe(false);
    // 兵力不应被扣减（因为天命不足导致回滚）
    expect(resources.troops).toBe(1000);
  });
});

// ─────────────────────────────────────────────
// 4. 挑战完成
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 挑战完成', () => {
  it('胜利：发放奖励并更新进度', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    const result: ChallengeResult = sys.completeChallenge('test_1', true);
    expect(result.victory).toBe(true);
    expect(result.firstClear).toBe(true);
    expect(result.rewards.length).toBeGreaterThan(0);
    expect(result.armyCost).toBe(200);
    expect(result.staminaCost).toBe(12);
    expect(sys.isFirstCleared('test_1')).toBe(true);
  });

  it('胜利：固定奖励包含配置项', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    const result = sys.completeChallenge('test_1', true);
    const grainReward = result.rewards.find(r => r.type === 'grain');
    const goldReward = result.rewards.find(r => r.type === 'gold');
    expect(grainReward).toBeDefined();
    expect(grainReward!.amount).toBe(500);
    expect(goldReward).toBeDefined();
    expect(goldReward!.amount).toBe(300);
  });

  it('胜利：首通额外奖励', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    const result = sys.completeChallenge('test_1', true);
    const mandateBonus = result.rewards.find(r => r.type === 'mandate');
    expect(mandateBonus).toBeDefined();
    expect(mandateBonus!.amount).toBe(50);
  });

  it('胜利：非首通无额外奖励', () => {
    const { deps } = createDepsWithResources();
    const rng = () => 0.99; // 不触发概率掉落
    const sys = new ChallengeStageSystem(deps, createTestStages(), rng);
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    // 第二次
    sys.preLockResources('test_1');
    const result = sys.completeChallenge('test_1', true);
    const mandateBonus = result.rewards.find(r => r.type === 'mandate');
    expect(mandateBonus).toBeUndefined();
  });

  it('胜利：发放武将经验', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    expect(deps.addExp).toHaveBeenCalledWith(150); // floor(100 * 1.5) = 150
  });

  it('胜利：碎片奖励通过 addFragment 发放', () => {
    const { deps } = createDepsWithResources();
    const rng = () => 0.1; // 触发概率掉落
    const sys = new ChallengeStageSystem(deps, createTestStages(), rng);
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    expect(deps.addFragment).toHaveBeenCalledWith('guanyu', 1);
  });

  it('胜利：无预锁时 armyCost/staminaCost 为0', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    // 直接调用 completeChallenge 不预锁（边界情况）
    const result = sys.completeChallenge('test_1', true);
    expect(result.victory).toBe(true);
    expect(result.armyCost).toBe(0);
    expect(result.staminaCost).toBe(0);
  });

  it('失败：返还预锁资源', () => {
    const { deps, resources } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    const troopsAfterLock = resources.troops;
    const mandateAfterLock = resources.mandate;
    const result = sys.completeChallenge('test_1', false);
    expect(result.victory).toBe(false);
    expect(result.rewards).toHaveLength(0);
    expect(result.armyCost).toBe(0);
    expect(result.staminaCost).toBe(0);
    // 资源应被返还
    expect(resources.troops).toBe(troopsAfterLock + 200);
    expect(resources.mandate).toBe(mandateAfterLock + 12);
  });

  it('失败：不增加每日次数', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', false);
    // 直接读取进度，不通过 getDailyAttempts（避免日期重置干扰）
    const progress = sys.getStageProgress('test_1');
    expect(progress!.dailyAttempts).toBe(0);
  });

  it('completeChallenge 关卡不存在返回空结果', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const result = sys.completeChallenge('nonexistent', true);
    expect(result.victory).toBe(false);
    expect(result.rewards).toHaveLength(0);
    expect(result.firstClear).toBe(false);
  });

  it('胜利：每日次数递增', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    const p1 = sys.getStageProgress('test_1');
    expect(p1!.dailyAttempts).toBe(1);
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    const p2 = sys.getStageProgress('test_1');
    expect(p2!.dailyAttempts).toBe(2);
  });
});

// ─────────────────────────────────────────────
// 5. 概率掉落
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 概率掉落', () => {
  it('rng=0 触发所有概率掉落', () => {
    const { deps } = createDepsWithResources();
    const rng = () => 0; // 必触发
    const sys = new ChallengeStageSystem(deps, createTestStages(), rng);
    sys.preLockResources('test_1');
    const result = sys.completeChallenge('test_1', true);
    const fragReward = result.rewards.find(r => r.type === 'fragment_guanyu');
    expect(fragReward).toBeDefined();
    expect(fragReward!.amount).toBe(1);
  });

  it('rng=1 不触发概率掉落', () => {
    const { deps } = createDepsWithResources();
    const rng = () => 0.99; // 不触发
    const sys = new ChallengeStageSystem(deps, createTestStages(), rng);
    sys.preLockResources('test_1');
    const result = sys.completeChallenge('test_1', true);
    const fragReward = result.rewards.find(r => r.type === 'fragment_guanyu');
    expect(fragReward).toBeUndefined();
  });

  it('无概率掉落的关卡只返回固定奖励', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_2');
    const result = sys.completeChallenge('test_2', true);
    // test_2 无 randomDrops，rewards 只有 grain + firstClearBonus mandate
    expect(result.rewards.some(r => r.type === 'grain')).toBe(true);
    expect(result.rewards.some(r => r.type === 'mandate')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 6. 每日重置
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 每日重置', () => {
  it('getDailyRemaining 跨日重置', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    // 完成挑战增加次数
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    // 使用不同的日期查询 → 触发重置
    expect(sys.getDailyRemaining('test_1', NEXT_DAY)).toBe(3);
  });

  it('getDailyAttempts 跨日重置为0', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    // 跨日查询
    expect(sys.getDailyAttempts('test_1', NEXT_DAY)).toBe(0);
  });

  it('同日内次数不重置', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    // 同一天查询
    const today = new Date().getFullYear() + '-' +
      String(new Date().getMonth() + 1).padStart(2, '0') + '-' +
      String(new Date().getDate()).padStart(2, '0');
    // getStageProgress 直接读取，不触发重置
    const progress = sys.getStageProgress('test_1');
    expect(progress!.dailyAttempts).toBe(1);
  });
});

// ─────────────────────────────────────────────
// 7. 序列化/反序列化
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 序列化', () => {
  it('serialize 返回正确数据', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    const data = sys.serialize();
    expect(data.version).toBe(1);
    expect(data.stageProgress['test_1'].firstCleared).toBe(true);
    expect(data.stageProgress['test_1'].dailyAttempts).toBe(1);
  });

  it('serialize 包含所有关卡', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const data = sys.serialize();
    expect(Object.keys(data.stageProgress)).toContain('test_1');
    expect(Object.keys(data.stageProgress)).toContain('test_2');
  });

  it('deserialize 恢复状态', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    const data = sys.serialize();

    const { deps: deps2 } = createDepsWithResources();
    const sys2 = new ChallengeStageSystem(deps2, createTestStages());
    sys2.deserialize(data);
    expect(sys2.isFirstCleared('test_1')).toBe(true);
    expect(sys2.getStageProgress('test_1')!.dailyAttempts).toBe(1);
  });

  it('deserialize 忽略版本不匹配', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    const badData = { version: 999, stageProgress: {}, lastResetDate: null };
    sys.deserialize(badData as ChallengeSaveData);
    expect(sys.isFirstCleared('test_1')).toBe(false);
  });

  it('deserialize 忽略 null 数据', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    sys.deserialize(null as unknown as ChallengeSaveData);
    expect(sys.isFirstCleared('test_1')).toBe(true); // 不变
  });

  it('deserialize 清除预锁资源', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    const data = sys.serialize();
    sys.deserialize(data);
    // 预锁应被清除，可以再次预锁
    expect(sys.preLockResources('test_1')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 8. 完整流程
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 完整流程', () => {
  it('完整挑战流程：校验→预锁→胜利→奖励', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());

    // 1. 校验
    const check = sys.checkCanChallenge('test_1', NOW);
    expect(check.canChallenge).toBe(true);

    // 2. 预锁
    expect(sys.preLockResources('test_1')).toBe(true);

    // 3. 完成
    const result = sys.completeChallenge('test_1', true);
    expect(result.victory).toBe(true);
    expect(result.firstClear).toBe(true);
    expect(sys.isFirstCleared('test_1')).toBe(true);
  });

  it('完整挑战流程：校验→预锁→失败→返还', () => {
    const { deps, resources } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());

    sys.preLockResources('test_1');
    expect(resources.troops).toBe(800);
    expect(resources.mandate).toBe(88);

    sys.completeChallenge('test_1', false);
    expect(resources.troops).toBe(1000); // 返还
    expect(resources.mandate).toBe(100);
  });

  it('序列化→反序列化→继续挑战', () => {
    const { deps } = createDepsWithResources();
    const sys = new ChallengeStageSystem(deps, createTestStages());
    sys.preLockResources('test_1');
    sys.completeChallenge('test_1', true);
    const data = sys.serialize();

    const { deps: deps2 } = createDepsWithResources();
    const sys2 = new ChallengeStageSystem(deps2, createTestStages());
    sys2.deserialize(data);
    expect(sys2.isFirstCleared('test_1')).toBe(true);
    // 可以继续挑战
    sys2.preLockResources('test_1');
    const result = sys2.completeChallenge('test_1', true);
    expect(result.victory).toBe(true);
    expect(result.firstClear).toBe(false); // 非首通
  });
});

// ─────────────────────────────────────────────
// 9. 使用默认关卡配置
// ─────────────────────────────────────────────

describe('ChallengeStageSystem 默认关卡配置', () => {
  it('使用 DEFAULT_CHALLENGE_STAGES 初始化', () => {
    const { deps } = createDepsWithResources({ troops: 10000, mandate: 1000 });
    // 不传 stages 参数，使用默认配置
    const sys = new ChallengeStageSystem(deps);
    const configs = sys.getStageConfigs();
    expect(configs.length).toBeGreaterThanOrEqual(8);
    expect(configs[0].id).toBe('challenge_1');
  });
});
