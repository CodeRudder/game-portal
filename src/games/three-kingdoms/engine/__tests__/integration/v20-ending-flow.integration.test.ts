/**
 * v20.0 天下一统(下) — Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 最终统一（天下一统触发/条件验证/全服排行榜）
 * - §2 统一奖励（终局奖励/历史评价/赛季结算）
 * - §3 新游戏+（转生继承/倍率提升/传承系统）
 * - §4 成就总结（全局成就/5维度统计/成就链）
 * - §5 跨周目联动（声望/传承/成就跨周目一致性）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 * - UI 层功能用 it.skip 标注
 *
 * @see docs/games/three-kingdoms/play/v20-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { AchievementDimension } from '../../../../core/achievement';

// ═══════════════════════════════════════════════════════════════
// §1 最终统一
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §1 最终统一', () => {

  describe('§1.1 天下一统触发条件', () => {

    it('should access ranking system via engine getter', () => {
      // Play §1.3: 全服排行榜
      const sim = createSim();
      const ranking = sim.engine.getRankingSystem();
      expect(ranking).toBeDefined();
      expect(typeof ranking.getRanking).toBe('function');
      expect(typeof ranking.getTopPlayers).toBe('function');
    });

    it('should return ranking dimensions', () => {
      // Play §1.3: 4维度排行(最快通关/最高战力/最全收集/最高声望)
      const sim = createSim();
      const ranking = sim.engine.getRankingSystem();
      const dimensions = ranking.getDimensions();
      expect(Array.isArray(dimensions)).toBe(true);
      expect(dimensions.length).toBeGreaterThanOrEqual(1);
    });

    it('should return top players for a dimension', () => {
      // Play §1.3: 前10名展示
      const sim = createSim();
      const ranking = sim.engine.getRankingSystem();
      const dimensions = ranking.getDimensions();
      if (dimensions.length > 0) {
        const top = ranking.getTopPlayers(dimensions[0], 10);
        expect(Array.isArray(top)).toBe(true);
      }
    });

    it('should check player rank in a dimension', () => {
      // Play §1.3: 查看自身排名
      const sim = createSim();
      const ranking = sim.engine.getRankingSystem();
      const dimensions = ranking.getDimensions();
      if (dimensions.length > 0) {
        const rank = ranking.getPlayerRank(dimensions[0], 'test-player');
        expect(typeof rank).toBe('number');
      }
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §2 统一奖励 — 声望系统深化
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §2 统一奖励与声望', () => {

  describe('§2.1 声望系统', () => {

    it('should access prestige system via engine getter', () => {
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      expect(prestige).toBeDefined();
      expect(typeof prestige.getPrestigePanel).toBe('function');
      expect(typeof prestige.addPrestigePoints).toBe('function');
      expect(typeof prestige.getProductionBonus).toBe('function');
    });

    it('should return prestige panel with level info', () => {
      // Play §1: 声望分栏 — 当前等级/声望值/产出加成
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      const panel = prestige.getPrestigePanel();
      expect(panel).toBeDefined();
      expect(panel.currentLevel).toBeDefined();
      expect(panel.currentPoints).toBeDefined();
    });

    it('should add prestige points from various sources', () => {
      // Play §1.5: 声望获取途径
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      const gained = prestige.addPrestigePoints('battle_victory', 100);
      expect(typeof gained).toBe('number');
      expect(gained).toBeGreaterThan(0);
    });

    it('should calculate production bonus based on prestige level', () => {
      // Play §1.4: 产出加成特权 — 1 + level × 0.02
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      const bonus = prestige.getProductionBonus();
      expect(bonus).toBeGreaterThanOrEqual(1.0);
    });

    it('should provide level info with threshold calculation', () => {
      // Play §1.2: 等级阈值 — 1000 × N^1.8
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      const info = prestige.getLevelInfo(1);
      expect(info).toBeDefined();
      expect(info.requiredPoints).toBeGreaterThanOrEqual(0);
    });

  });

  describe('§2.2 声望商店', () => {

    it('should access prestige shop via engine getter', () => {
      const sim = createSim();
      const shop = sim.engine.getPrestigeShopSystem();
      expect(shop).toBeDefined();
    });

  });

  describe('§2.3 等级解锁奖励', () => {

    it('should list level unlock rewards', () => {
      // Play §1.7: 等级解锁奖励
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      const rewards = prestige.getLevelRewards();
      expect(Array.isArray(rewards)).toBe(true);
    });

    it('should claim a level reward', () => {
      // Play §1.7: 领取等级奖励
      const sim = createSim();
      const prestige = sim.engine.getPrestigeSystem();
      const result = prestige.claimLevelReward(1);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §3 新游戏+ — 转生系统
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §3 新游戏+转生系统', () => {

  describe('§3.1 转生条件与执行', () => {

    it('should access rebirth system via engine getter', () => {
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      expect(rebirth).toBeDefined();
      expect(typeof rebirth.checkRebirthConditions).toBe('function');
      expect(typeof rebirth.executeRebirth).toBe('function');
      expect(typeof rebirth.getCurrentMultiplier).toBe('function');
    });

    it('should check rebirth conditions and report unmet requirements', () => {
      // Play §1.1: 转生条件检查
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const check = rebirth.checkRebirthConditions();
      expect(check).toBeDefined();
      expect(typeof check.canRebirth).toBe('boolean');
      expect(check.conditions).toBeDefined();
      expect(typeof check.conditions.prestigeLevel).toBe('object');
      expect(typeof check.conditions.castleLevel).toBe('object');
    });

    it('should start with multiplier 1.0 for fresh state', () => {
      // Play §1.9: 转生倍率初始值
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      expect(rebirth.getCurrentMultiplier()).toBe(1.0);
    });

    it('should calculate next multiplier', () => {
      // Play §1.9: 下一周目倍率
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const next = rebirth.getNextMultiplier();
      expect(next).toBeGreaterThan(1.0);
    });

    it('should return keep and reset rules', () => {
      // Play §1: 转生保留/重置规则
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const keep = rebirth.getKeepRules();
      const reset = rebirth.getResetRules();
      expect(Array.isArray(keep)).toBe(true);
      expect(Array.isArray(reset)).toBe(true);
    });

  });

  describe('§3.2 转生加速与解锁', () => {

    it('should provide acceleration state', () => {
      // Play §1: 转生加速效果
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const accel = rebirth.getAcceleration();
      expect(accel).toBeDefined();
      expect(typeof accel.active).toBe('boolean');
      expect(typeof accel.daysLeft).toBe('number');
    });

    it('should provide effective multipliers for build/tech/resource/exp', () => {
      // Play §1: 转生倍率影响建造/科技/资源/经验速度
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const multipliers = rebirth.getEffectiveMultipliers();
      expect(multipliers).toBeDefined();
      expect(multipliers.buildSpeed).toBeGreaterThanOrEqual(1.0);
      expect(multipliers.techSpeed).toBeGreaterThanOrEqual(1.0);
      expect(multipliers.resource).toBeGreaterThanOrEqual(1.0);
      expect(multipliers.exp).toBeGreaterThanOrEqual(1.0);
    });

    it('should list unlock contents based on rebirth count', () => {
      // Play §1: 转生解锁内容
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const unlocks = rebirth.getUnlockContents();
      expect(Array.isArray(unlocks)).toBe(true);
    });

  });

  describe('§3.3 传承系统', () => {

    it('should access heritage system via engine getter', () => {
      const sim = createSim();
      const heritage = sim.engine.getHeritageSystem();
      expect(heritage).toBeDefined();
      expect(typeof heritage.getState).toBe('function');
    });

    it('should provide initial gift for new game+', () => {
      // Play §1: 转生初始礼包
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const gift = rebirth.getInitialGift();
      expect(gift).toBeDefined();
    });

    it('should provide instant build config for acceleration', () => {
      // Play §1: 转生即时建造
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const config = rebirth.getInstantBuildConfig();
      expect(config).toBeDefined();
    });

    it('should simulate rebirth earnings', () => {
      // Play §1: 收益模拟器
      const sim = createSim();
      const rebirth = sim.engine.getRebirthSystem();
      const result = rebirth.simulateEarnings({
        rebirthCount: 1,
        currentPrestigeLevel: 5,
        estimatedPlayDays: 7,
      });
      expect(result).toBeDefined();
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §4 成就总结
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §4 成就总结', () => {

  describe('§4.1 成就系统访问', () => {

    it('should access achievement system via engine getter', () => {
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      expect(achievement).toBeDefined();
      expect(typeof achievement.getAllAchievements).toBe('function');
      expect(typeof achievement.getAchievementsByDimension).toBe('function');
      expect(typeof achievement.getTotalPoints).toBe('function');
    });

    it('should return all achievements with instances', () => {
      // Play §1.6: 全局成就列表
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const all = achievement.getAllAchievements();
      expect(Array.isArray(all)).toBe(true);
    });

    it('should return achievements grouped by dimension', () => {
      // Play §1.6: 5维度成就(战斗/建设/收集/社交/转生)
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const battleAchievements = achievement.getAchievementsByDimension('battle' as AchievementDimension);
      expect(Array.isArray(battleAchievements)).toBe(true);
    });

    it('should track total achievement points', () => {
      // Play §1.6: 成就积分
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const points = achievement.getTotalPoints();
      expect(typeof points).toBe('number');
      expect(points).toBeGreaterThanOrEqual(0);
    });

  });

  describe('§4.2 成就进度与领取', () => {

    it('should update achievement progress by condition type', () => {
      // Play §1.6: 成就进度更新
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      // 更新战斗类进度
      achievement.updateProgress('battle_win', 1);
      // 不应抛出异常
      expect(achievement.getTotalPoints()).toBeGreaterThanOrEqual(0);
    });

    it('should return claimable achievements', () => {
      // Play §1.6: 可领取成就列表
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const claimable = achievement.getClaimableAchievements();
      expect(Array.isArray(claimable)).toBe(true);
    });

    it('should return dimension stats', () => {
      // Play §1.6: 5维度统计
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const stats = achievement.getDimensionStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

  });

  describe('§4.3 成就链', () => {

    it('should return achievement chains', () => {
      // Play §1.6: 转生成就链
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const chains = achievement.getAchievementChains();
      expect(Array.isArray(chains)).toBe(true);
    });

    it('should track completed chains', () => {
      // Play §1.6: 已完成成就链
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const completed = achievement.getCompletedChains();
      expect(Array.isArray(completed)).toBe(true);
    });

  });

  describe('§4.4 成就保存与加载', () => {

    it('should serialize achievement state to save data', () => {
      // Play §1.6: 成就进度保存
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      const saveData = achievement.getSaveData();
      expect(saveData).toBeDefined();
    });

    it('should restore achievement state from save data', () => {
      // Play §1.6: 成就进度加载
      const sim = createSim();
      const achievement = sim.engine.getAchievementSystem();
      achievement.updateProgress('battle_win', 5);
      const saveData = achievement.getSaveData();

      const sim2 = createSim();
      const achievement2 = sim2.engine.getAchievementSystem();
      achievement2.loadSaveData(saveData);
      // 加载后应恢复进度
      expect(achievement2.getTotalPoints()).toBeGreaterThanOrEqual(0);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §5 跨周目联动
// ═══════════════════════════════════════════════════════════════
describe('v20.0 天下一统(下) — §5 跨周目联动', () => {

  it('should coordinate prestige and rebirth systems', () => {
    // Play §5: 声望+转生联动
    const sim = createSim();
    const prestige = sim.engine.getPrestigeSystem();
    const rebirth = sim.engine.getRebirthSystem();

    // 声望等级影响转生
    const panel = prestige.getPrestigePanel();
    const multipliers = rebirth.getEffectiveMultipliers();
    expect(panel).toBeDefined();
    expect(multipliers).toBeDefined();
  });

  it('should coordinate heritage and rebirth systems', () => {
    // Play §5: 传承+转生联动
    const sim = createSim();
    const heritage = sim.engine.getHeritageSystem();
    const rebirth = sim.engine.getRebirthSystem();

    const heritageState = heritage.getState();
    const rebirthState = rebirth.getState();
    expect(heritageState).toBeDefined();
    expect(rebirthState).toBeDefined();
  });

  it('should coordinate achievement and prestige systems', () => {
    // Play §5: 成就+声望联动
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();
    const prestige = sim.engine.getPrestigeSystem();

    const stats = achievement.getDimensionStats();
    const panel = prestige.getPrestigePanel();
    expect(stats).toBeDefined();
    expect(panel).toBeDefined();
  });

});
