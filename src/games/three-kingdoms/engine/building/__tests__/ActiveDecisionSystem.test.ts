/**
 * ActiveDecisionSystem 单元测试
 * 覆盖：建筑焦点、每日挑战、建筑巡查、序列化/反序列化
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActiveDecisionSystem } from '../ActiveDecisionSystem';

describe('ActiveDecisionSystem', () => {
  let system: ActiveDecisionSystem;

  beforeEach(() => {
    system = new ActiveDecisionSystem();
  });

  // ─────────────────────────────────────────
  // 建筑焦点
  // ─────────────────────────────────────────

  describe('focus', () => {
    it('设置焦点→+15%产出', () => {
      const result = system.setFocus('farmland');
      expect(result.success).toBe(true);
      expect(system.getFocus()).toBe('farmland');
      expect(system.getFocusBonus('farmland')).toBeCloseTo(0.15);
    });

    it('未设焦点建筑→无加成', () => {
      system.setFocus('farmland');
      expect(system.getFocusBonus('market')).toBe(0);
    });

    it('冷却期内切换失败', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      system.setFocus('farmland');

      // 推进时间3小时（冷却6小时）
      system._setNow(() => fixedTime + 3 * 60 * 60 * 1000);

      const result = system.setFocus('market');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('冷却');
    });

    it('冷却结束后可切换', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      system.setFocus('farmland');

      // 推进时间超过6小时
      system._setNow(() => fixedTime + 7 * 60 * 60 * 1000);

      const result = system.setFocus('market');
      expect(result.success).toBe(true);
      expect(system.getFocus()).toBe('market');
    });

    it('焦点冷却剩余时间', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);

      system.setFocus('farmland');
      expect(system.getFocusCooldownRemaining()).toBe(6 * 60 * 60 * 1000);

      system._setNow(() => fixedTime + 3 * 60 * 60 * 1000);
      expect(system.getFocusCooldownRemaining()).toBe(3 * 60 * 60 * 1000);
    });
  });

  // ─────────────────────────────────────────
  // 每日挑战
  // ─────────────────────────────────────────

  describe('daily challenges', () => {
    it('生成3个每日挑战', () => {
      const challenges = system.generateDailyChallenges();
      expect(challenges.length).toBe(3);

      for (const c of challenges) {
        expect(c.id).toBeTruthy();
        expect(c.description).toBeTruthy();
        expect(c.targetType).toMatch(/^(upgrade|train|research)$/);
        expect(c.progress).toBe(0);
        expect(c.accepted).toBe(false);
        expect(c.completed).toBe(false);
      }
    });

    it('接受挑战', () => {
      system.generateDailyChallenges();
      const challenges = system.getDailyChallenges();
      const challengeId = challenges[0].id;

      const result = system.acceptChallenge(challengeId);
      expect(result).toBe(true);

      const updated = system.getDailyChallenges();
      expect(updated[0].accepted).toBe(true);
    });

    it('未接受的挑战不可完成', () => {
      system.generateDailyChallenges();
      const challenges = system.getDailyChallenges();
      const challengeId = challenges[0].id;

      const result = system.completeChallenge(challengeId);
      expect(result.success).toBe(false);
    });

    it('接受并完成挑战→获得奖励', () => {
      system.generateDailyChallenges();
      const challenges = system.getDailyChallenges();
      const challengeId = challenges[0].id;

      system.acceptChallenge(challengeId);

      // 更新进度到目标
      const challenge = system.getDailyChallenges()[0];
      system.updateChallengeProgress(challenge.targetType, challenge.targetCount);

      const result = system.completeChallenge(challengeId);
      expect(result.success).toBe(true);
      expect(Object.keys(result.reward).length).toBeGreaterThan(0);
    });

    it('进度不足→完成失败', () => {
      system.generateDailyChallenges();
      const challenges = system.getDailyChallenges();
      const challengeId = challenges[0].id;

      system.acceptChallenge(challengeId);
      // 不更新进度

      const result = system.completeChallenge(challengeId);
      expect(result.success).toBe(false);
    });

    it('重复完成→失败', () => {
      system.generateDailyChallenges();
      const challenges = system.getDailyChallenges();
      const challengeId = challenges[0].id;

      system.acceptChallenge(challengeId);
      const challenge = system.getDailyChallenges()[0];
      system.updateChallengeProgress(challenge.targetType, challenge.targetCount);

      system.completeChallenge(challengeId);
      const result2 = system.completeChallenge(challengeId);
      expect(result2.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 建筑巡查
  // ─────────────────────────────────────────

  describe('inspection', () => {
    it('建筑巡查→发现问题', () => {
      system._setSeed(42);
      const result = system.startInspection('farmland');
      expect(result).not.toBeNull();
      expect(result!.id).toBeTruthy();
      expect(result!.buildingType).toBe('farmland');
      expect(['production_drop', 'safety_hazard', 'efficiency_bottleneck']).toContain(
        result!.problemType,
      );
    });

    it('三种处理方式均可执行', () => {
      // 使用固定种子确保free方式成功
      system._setSeed(100);
      const inspection = system.startInspection('farmland');
      expect(inspection).not.toBeNull();

      // invest方式：100%成功，3x回报
      const investResult = system.resolveInspection(inspection!.id, 'invest');
      expect(investResult.success).toBe(true);
      expect(investResult.reward).toBeDefined();
      // invest奖励 = 基础奖励 × 3
      expect(investResult.reward!.gold).toBe(1000 * 3);
    });

    it('auto方式：100%成功，1x回报', () => {
      system._setSeed(200);
      const inspection = system.startInspection('farmland');
      const result = system.resolveInspection(inspection!.id, 'auto');
      expect(result.success).toBe(true);
      expect(result.reward!.gold).toBe(1000);
    });

    it('已处理的巡查不可重复处理', () => {
      system._setSeed(300);
      const inspection = system.startInspection('farmland');
      system.resolveInspection(inspection!.id, 'invest');

      const result = system.resolveInspection(inspection!.id, 'invest');
      expect(result.success).toBe(false);
    });

    it('不存在的巡查→失败', () => {
      const result = system.resolveInspection('nonexistent', 'free');
      expect(result.success).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('焦点序列化后反序列化恢复一致', () => {
      const fixedTime = 1000000;
      system._setNow(() => fixedTime);
      system.setFocus('farmland');

      const data = system.serialize();
      const system2 = new ActiveDecisionSystem();
      system2.deserialize(data);

      expect(system2.getFocus()).toBe('farmland');
      expect(system2.getFocusBonus('farmland')).toBeCloseTo(0.15);
    });

    it('挑战序列化后反序列化恢复一致', () => {
      system.generateDailyChallenges();
      const challenges = system.getDailyChallenges();
      system.acceptChallenge(challenges[0].id);

      const data = system.serialize();
      const system2 = new ActiveDecisionSystem();
      system2.deserialize(data);

      const restored = system2.getDailyChallenges();
      expect(restored.length).toBe(3);
      expect(restored[0].accepted).toBe(true);
      expect(restored[1].accepted).toBe(false);
    });

    it('reset 后回到初始状态', () => {
      system.setFocus('farmland');
      system.generateDailyChallenges();
      system.reset();

      expect(system.getFocus()).toBeNull();
      expect(system.getDailyChallenges().length).toBe(0);
      expect(system.getFocusCooldownRemaining()).toBe(0);
    });
  });
});
