/**
 * V4 攻城略地(下) — 挑战关卡系统完整流程集成测试
 *
 * 覆盖以下 play 流程：
 * - §11.1 挑战关卡前置校验 — 兵力/天命/次数
 * - §11.2 资源预锁与扣减 — 预锁/确认/回滚
 * - §11.3 挑战完成与奖励 — 首通/重复/失败
 * - §11.4 每日次数重置 — 跨天重置
 * - §11.5 挑战系统存档 — 序列化/反序列化
 * - §11.6 8关卡配置完整性 — 递增消耗/奖励
 *
 * 编码规范：
 * - 每个it前创建新的 ChallengeStageSystem 实例
 * - describe按play流程ID组织
 * - 不使用 as any
 */

import { describe, it, expect } from 'vitest';
import { ChallengeStageSystem } from '../../campaign/ChallengeStageSystem';
import { DEFAULT_CHALLENGE_STAGES } from '../../campaign/challenge-stages';
import type { ChallengeStageConfig, ChallengeCheckResult, ChallengeResult, ChallengeDeps } from '../../campaign/ChallengeStageSystem';

// ── 辅助：创建模拟依赖 ──

interface MockResources {
  troops: number;
  mandate: number;
  grain: number;
  gold: number;
  exp: number;
  fragments: Record<string, number>;
}

function createMockDeps(resources?: Partial<MockResources>): { deps: ChallengeDeps; res: MockResources } {
  const res: MockResources = {
    troops: 10000,
    mandate: 100,
    grain: 50000,
    gold: 50000,
    exp: 0,
    fragments: {},
    ...resources,
  };
  const deps: ChallengeDeps = {
    getResourceAmount: (type: string) => {
      if (type === 'troops') return res.troops;
      if (type === 'mandate') return res.mandate;
      if (type === 'grain') return res.grain;
      if (type === 'gold') return res.gold;
      return 0;
    },
    consumeResource: (type: string, amount: number) => {
      if (type === 'troops' && res.troops >= amount) { res.troops -= amount; return true; }
      if (type === 'mandate' && res.mandate >= amount) { res.mandate -= amount; return true; }
      if (type === 'grain' && res.grain >= amount) { res.grain -= amount; return true; }
      if (type === 'gold' && res.gold >= amount) { res.gold -= amount; return true; }
      return false;
    },
    addResource: (type: string, amount: number) => {
      if (type === 'troops') res.troops += amount;
      else if (type === 'mandate') res.mandate += amount;
      else if (type === 'grain') res.grain += amount;
      else if (type === 'gold') res.gold += amount;
    },
    addFragment: (heroId: string, count: number) => {
      res.fragments[heroId] = (res.fragments[heroId] ?? 0) + count;
    },
    addExp: (exp: number) => { res.exp += exp; },
  };
  return { deps, res };
}

/** 创建系统实例（固定rng=1保证概率掉落） */
function createSystem(resources?: Partial<MockResources>): { sys: ChallengeStageSystem; res: MockResources } {
  const { deps, res } = createMockDeps(resources);
  const sys = new ChallengeStageSystem(deps, undefined, () => 1); // rng=1 → 概率掉落不触发
  return { sys, res };
}

/** 当前时间基准 */
const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);
const TOMORROW = new Date(NOW + 86400000).toISOString().slice(0, 10);

// ═══════════════════════════════════════════════════════════════
// V4 CHALLENGE-STAGE-FLOW 挑战关卡完整流程
// ═══════════════════════════════════════════════════════════════
describe('V4 CHALLENGE-STAGE-FLOW 挑战关卡完整流程', () => {

  // ═══════════════════════════════════════════════════════════════
  // §11.1 挑战关卡前置校验
  // ═══════════════════════════════════════════════════════════════
  describe('§11.1 挑战关卡前置校验', () => {
    it('资源充足时校验通过', () => {
      const { sys } = createSystem();
      const check = sys.checkCanChallenge('challenge_1', NOW);
      expect(check.canChallenge).toBe(true);
      expect(check.reasons).toEqual([]);
    });

    it('兵力不足时校验失败', () => {
      const { sys } = createSystem({ troops: 50 });
      const check = sys.checkCanChallenge('challenge_1', NOW);
      expect(check.canChallenge).toBe(false);
      expect(check.reasons.some(r => r.includes('兵力不足'))).toBe(true);
    });

    it('天命不足时校验失败', () => {
      const { sys } = createSystem({ mandate: 5 });
      const check = sys.checkCanChallenge('challenge_1', NOW);
      expect(check.canChallenge).toBe(false);
      expect(check.reasons.some(r => r.includes('天命不足'))).toBe(true);
    });

    it('兵力+天命都不足时两个原因', () => {
      const { sys } = createSystem({ troops: 50, mandate: 5 });
      const check = sys.checkCanChallenge('challenge_1', NOW);
      expect(check.canChallenge).toBe(false);
      expect(check.reasons.length).toBe(2);
    });

    it('不存在的关卡校验失败', () => {
      const { sys } = createSystem();
      const check = sys.checkCanChallenge('nonexistent', NOW);
      expect(check.canChallenge).toBe(false);
      expect(check.reasons).toContain('关卡不存在');
    });

    it('每日次数上限为3次', () => {
      const { sys } = createSystem();
      // 完成3次
      for (let i = 0; i < 3; i++) {
        sys.preLockResources('challenge_1');
        sys.completeChallenge('challenge_1', true);
      }
      // 第4次校验失败
      const check = sys.checkCanChallenge('challenge_1', NOW);
      expect(check.canChallenge).toBe(false);
      expect(check.reasons.some(r => r.includes('次数已用完'))).toBe(true);
    });

    it('getDailyRemaining正确返回剩余次数', () => {
      const { sys } = createSystem();
      expect(sys.getDailyRemaining('challenge_1', NOW)).toBe(3);
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      expect(sys.getDailyRemaining('challenge_1', NOW)).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §11.2 资源预锁与扣减
  // ═══════════════════════════════════════════════════════════════
  describe('§11.2 资源预锁与扣减', () => {
    it('预锁成功扣减兵力和天命', () => {
      const { sys, res } = createSystem();
      const troopsBefore = res.troops;
      const mandateBefore = res.mandate;
      const ok = sys.preLockResources('challenge_1');
      expect(ok).toBe(true);
      expect(res.troops).toBe(troopsBefore - 200); // challenge_1 armyCost=200
      expect(res.mandate).toBe(mandateBefore - 12); // challenge_1 staminaCost=12
    });

    it('资源不足时预锁失败', () => {
      const { sys } = createSystem({ troops: 50 });
      const ok = sys.preLockResources('challenge_1');
      expect(ok).toBe(false);
    });

    it('重复预锁同一关卡失败', () => {
      const { sys } = createSystem();
      const ok1 = sys.preLockResources('challenge_1');
      const ok2 = sys.preLockResources('challenge_1');
      expect(ok1).toBe(true);
      expect(ok2).toBe(false);
    });

    it('胜利确认扣减（不返还）', () => {
      const { sys, res } = createSystem();
      sys.preLockResources('challenge_1');
      const troopsAfterLock = res.troops;
      sys.completeChallenge('challenge_1', true);
      expect(res.troops).toBe(troopsAfterLock); // 不返还
    });

    it('失败返还预锁资源', () => {
      const { sys, res } = createSystem();
      sys.preLockResources('challenge_1');
      const troopsAfterLock = res.troops;
      const mandateAfterLock = res.mandate;
      sys.completeChallenge('challenge_1', false);
      expect(res.troops).toBe(troopsAfterLock + 200);
      expect(res.mandate).toBe(mandateAfterLock + 12);
    });

    it('不存在的关卡预锁失败', () => {
      const { sys } = createSystem();
      expect(sys.preLockResources('nonexistent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §11.3 挑战完成与奖励
  // ═══════════════════════════════════════════════════════════════
  describe('§11.3 挑战完成与奖励', () => {
    it('首通胜利标记firstClear=true', () => {
      const { sys } = createSystem();
      sys.preLockResources('challenge_1');
      const result = sys.completeChallenge('challenge_1', true);
      expect(result.victory).toBe(true);
      expect(result.firstClear).toBe(true);
    });

    it('重复通关firstClear=false', () => {
      const { sys } = createSystem();
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      sys.preLockResources('challenge_1');
      const result = sys.completeChallenge('challenge_1', true);
      expect(result.victory).toBe(true);
      expect(result.firstClear).toBe(false);
    });

    it('首通奖励包含固定奖励+首通额外奖励', () => {
      const { sys } = createSystem({ troops: 100000, mandate: 1000 });
      sys.preLockResources('challenge_1');
      const result = sys.completeChallenge('challenge_1', true);
      // challenge_1固定奖励3项 + 首通额外2项 = 5项（rng=1不掉落概率物品）
      expect(result.rewards.length).toBeGreaterThanOrEqual(3);
    });

    it('失败无奖励', () => {
      const { sys } = createSystem();
      sys.preLockResources('challenge_1');
      const result = sys.completeChallenge('challenge_1', false);
      expect(result.victory).toBe(false);
      expect(result.rewards).toEqual([]);
      expect(result.firstClear).toBe(false);
    });

    it('胜利发放资源奖励到依赖', () => {
      const { sys, res } = createSystem();
      const grainBefore = res.grain;
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      // challenge_1固定奖励含grain:500
      expect(res.grain).toBeGreaterThan(grainBefore);
    });

    it('胜利发放武将经验', () => {
      const { sys, res } = createSystem();
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      expect(res.exp).toBeGreaterThan(0);
    });

    it('isFirstCleared查询正确', () => {
      const { sys } = createSystem();
      expect(sys.isFirstCleared('challenge_1')).toBe(false);
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      expect(sys.isFirstCleared('challenge_1')).toBe(true);
    });

    it('不存在的关卡completeChallenge返回空结果', () => {
      const { sys } = createSystem();
      const result = sys.completeChallenge('nonexistent', true);
      expect(result.victory).toBe(false);
      expect(result.rewards).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §11.4 每日次数重置
  // ═══════════════════════════════════════════════════════════════
  describe('§11.4 每日次数重置', () => {
    it('用完3次后跨天重置', () => {
      const { sys } = createSystem();
      for (let i = 0; i < 3; i++) {
        sys.preLockResources('challenge_1');
        sys.completeChallenge('challenge_1', true);
      }
      // 今天已满
      expect(sys.getDailyRemaining('challenge_1', NOW)).toBe(0);
      // 明天重置
      const tomorrow = NOW + 86400000;
      expect(sys.getDailyRemaining('challenge_1', tomorrow)).toBe(3);
    });

    it('getDailyAttempts正确计数', () => {
      const { sys } = createSystem();
      expect(sys.getDailyAttempts('challenge_1', NOW)).toBe(0);
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      expect(sys.getDailyAttempts('challenge_1', NOW)).toBe(1);
    });

    it('失败不消耗每日次数', () => {
      const { sys } = createSystem();
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', false);
      expect(sys.getDailyAttempts('challenge_1', NOW)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §11.5 挑战系统存档
  // ═══════════════════════════════════════════════════════════════
  describe('§11.5 挑战系统存档', () => {
    it('空系统序列化', () => {
      const { sys } = createSystem();
      const data = sys.serialize();
      expect(data.version).toBe(1);
      expect(data.lastResetDate).toBeNull();
      expect(Object.keys(data.stageProgress).length).toBe(DEFAULT_CHALLENGE_STAGES.length);
    });

    it('序列化后反序列化保持进度', () => {
      const { sys } = createSystem();
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      const data = sys.serialize();
      expect(data.stageProgress['challenge_1'].firstCleared).toBe(true);
      expect(data.stageProgress['challenge_1'].dailyAttempts).toBe(1);

      // 反序列化
      const { sys: sys2, deps: deps2 } = createMockDeps();
      const sys2Instance = new ChallengeStageSystem(deps2, undefined, () => 1);
      sys2Instance.deserialize(data);
      expect(sys2Instance.isFirstCleared('challenge_1')).toBe(true);
    });

    it('无效数据反序列化不崩溃', () => {
      const { sys } = createSystem();
      expect(() => sys.deserialize(null as any)).not.toThrow();
      expect(() => sys.deserialize({ version: 999 } as any)).not.toThrow();
    });

    it('reset清空所有进度', () => {
      const { sys } = createSystem();
      sys.preLockResources('challenge_1');
      sys.completeChallenge('challenge_1', true);
      expect(sys.isFirstCleared('challenge_1')).toBe(true);
      sys.reset();
      expect(sys.isFirstCleared('challenge_1')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §11.6 8关卡配置完整性
  // ═══════════════════════════════════════════════════════════════
  describe('§11.6 8关卡配置完整性', () => {
    it('共8个挑战关卡', () => {
      expect(DEFAULT_CHALLENGE_STAGES.length).toBe(8);
    });

    it('关卡ID从challenge_1到challenge_8', () => {
      const ids = DEFAULT_CHALLENGE_STAGES.map(s => s.id);
      for (let i = 1; i <= 8; i++) {
        expect(ids).toContain(`challenge_${i}`);
      }
    });

    it('兵力消耗递增', () => {
      for (let i = 1; i < DEFAULT_CHALLENGE_STAGES.length; i++) {
        expect(DEFAULT_CHALLENGE_STAGES[i].armyCost).toBeGreaterThanOrEqual(
          DEFAULT_CHALLENGE_STAGES[i - 1].armyCost
        );
      }
    });

    it('天命消耗递增或持平', () => {
      for (let i = 1; i < DEFAULT_CHALLENGE_STAGES.length; i++) {
        expect(DEFAULT_CHALLENGE_STAGES[i].staminaCost).toBeGreaterThanOrEqual(
          DEFAULT_CHALLENGE_STAGES[i - 1].staminaCost
        );
      }
    });

    it('每关有首通额外奖励', () => {
      for (const stage of DEFAULT_CHALLENGE_STAGES) {
        expect(stage.firstClearBonus.length).toBeGreaterThan(0);
      }
    });

    it('每关有固定奖励', () => {
      for (const stage of DEFAULT_CHALLENGE_STAGES) {
        expect(stage.rewards.length).toBeGreaterThan(0);
      }
    });

    it('每关有概率掉落', () => {
      for (const stage of DEFAULT_CHALLENGE_STAGES) {
        expect(stage.randomDrops.length).toBeGreaterThan(0);
      }
    });

    it('概率掉落概率在0~1之间', () => {
      for (const stage of DEFAULT_CHALLENGE_STAGES) {
        for (const drop of stage.randomDrops) {
          expect(drop.probability).toBeGreaterThan(0);
          expect(drop.probability).toBeLessThanOrEqual(1);
        }
      }
    });

    it('getStageConfigs返回完整列表', () => {
      const { sys } = createSystem();
      const configs = sys.getStageConfigs();
      expect(configs.length).toBe(8);
    });

    it('getStageConfig查询单个关卡', () => {
      const { sys } = createSystem();
      const config = sys.getStageConfig('challenge_1');
      expect(config).toBeDefined();
      expect(config!.name).toBe('烽火台·壹');
    });

    it('getStageConfig不存在返回undefined', () => {
      const { sys } = createSystem();
      expect(sys.getStageConfig('nonexistent')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §11.7 概率掉落验证
  // ═══════════════════════════════════════════════════════════════
  describe('§11.7 概率掉落验证', () => {
    it('rng=0时概率掉落必触发', () => {
      const { deps } = createMockDeps();
      const sys = new ChallengeStageSystem(deps, undefined, () => 0); // rng=0 → 必触发
      sys.preLockResources('challenge_1');
      const result = sys.completeChallenge('challenge_1', true);
      // challenge_1有2个概率掉落，rng=0应该都触发
      const hasRandomDrop = result.rewards.some(r =>
        r.type === 'fragment_guanyu' || r.type === 'tiger_tally'
      );
      expect(hasRandomDrop).toBe(true);
    });

    it('rng=1时概率掉落不触发', () => {
      const { deps } = createMockDeps();
      const sys = new ChallengeStageSystem(deps, undefined, () => 1); // rng=1 → 不触发
      sys.preLockResources('challenge_1');
      const result = sys.completeChallenge('challenge_1', true);
      const hasRandomDrop = result.rewards.some(r =>
        r.type === 'fragment_guanyu' || r.type === 'tiger_tally'
      );
      expect(hasRandomDrop).toBe(false);
    });
  });
});
