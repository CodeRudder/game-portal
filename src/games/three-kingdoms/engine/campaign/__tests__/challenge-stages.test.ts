/**
 * challenge-stages 配置数据测试
 *
 * 验证挑战关卡配置数据的完整性和一致性：
 * - 8个烽火台关卡配置
 * - 关卡ID唯一性
 * - 资源消耗递增
 * - 奖励结构合理
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CHALLENGE_STAGES } from '../challenge-stages';

describe('challenge-stages 配置数据', () => {
  it('应有8个挑战关卡', () => {
    expect(DEFAULT_CHALLENGE_STAGES).toHaveLength(8);
  });

  it('关卡ID格式正确且唯一', () => {
    const ids = DEFAULT_CHALLENGE_STAGES.map(s => s.id);
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) {
      expect(id).toMatch(/^challenge_\d+$/);
    }
  });

  it('关卡ID从 challenge_1 到 challenge_8', () => {
    const ids = DEFAULT_CHALLENGE_STAGES.map(s => s.id);
    for (let i = 1; i <= 8; i++) {
      expect(ids).toContain(`challenge_${i}`);
    }
  });

  it('每个关卡名称非空', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      expect(stage.name.length).toBeGreaterThan(0);
    }
  });

  it('兵力消耗为正数', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      expect(stage.armyCost).toBeGreaterThan(0);
    }
  });

  it('体力消耗为正数', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      expect(stage.staminaCost).toBeGreaterThan(0);
    }
  });

  it('兵力消耗大致递增', () => {
    for (let i = 1; i < DEFAULT_CHALLENGE_STAGES.length; i++) {
      expect(DEFAULT_CHALLENGE_STAGES[i].armyCost).toBeGreaterThanOrEqual(
        DEFAULT_CHALLENGE_STAGES[i - 1].armyCost,
      );
    }
  });

  it('每个关卡有固定奖励', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      expect(stage.rewards.length).toBeGreaterThan(0);
      for (const reward of stage.rewards) {
        expect(reward.amount).toBeGreaterThan(0);
      }
    }
  });

  it('每个关卡有首通额外奖励', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      expect(stage.firstClearBonus.length).toBeGreaterThan(0);
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

  it('概率掉落数量为正数', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      for (const drop of stage.randomDrops) {
        expect(drop.amount).toBeGreaterThan(0);
      }
    }
  });

  it('每个关卡至少有1个概率掉落', () => {
    for (const stage of DEFAULT_CHALLENGE_STAGES) {
      expect(stage.randomDrops.length).toBeGreaterThan(0);
    }
  });
});
