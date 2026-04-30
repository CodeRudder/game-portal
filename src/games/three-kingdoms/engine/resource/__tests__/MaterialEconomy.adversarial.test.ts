/**
 * MaterialEconomySystem 对抗式测试
 *
 * 五维度挑战覆盖：
 *   F-Normal: 突破石获取6途径、技能书获取5途径
 *   F-Boundary: 日限购、远征次数、首通去重
 *   F-Error: 无效输入、重复领取、未通关扫荡
 *   F-Cross: 铜钱消耗联动、随机数注入
 *   F-Lifecycle: 每日重置、序列化/反序列化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaterialEconomySystem } from '../material-economy-system';
import type { MaterialEconomyDeps } from '../material-economy-system';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

let goldAmount = 100000;
const clearedStages = ['stage_1', 'stage_2', 'stage_3'];

function createMaterialDeps(overrides?: Partial<MaterialEconomyDeps>): MaterialEconomyDeps {
  goldAmount = 100000;
  return {
    consumeGold: vi.fn((amount: number) => {
      if (goldAmount < amount) return false;
      goldAmount -= amount;
      return true;
    }),
    getGoldAmount: vi.fn(() => goldAmount),
    addBreakthroughStone: vi.fn(),
    addSkillBook: vi.fn(),
    getClearedStages: vi.fn(() => [...clearedStages]),
    random: () => 0.5, // 固定随机数
    ...overrides,
  };
}

function createSystem(deps?: Partial<MaterialEconomyDeps>): MaterialEconomySystem {
  const sys = new MaterialEconomySystem();
  sys.init(createMockDeps() as any);
  sys.setMaterialDeps(createMaterialDeps(deps));
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('MaterialEconomySystem 对抗式测试', () => {
  let sys: MaterialEconomySystem;

  beforeEach(() => {
    sys = createSystem();
  });

  // ═══════════════════════════════════════════
  // F-Normal: 突破石获取
  // ═══════════════════════════════════════════

  describe('[F-Normal] 突破石获取6途径', () => {
    it('1. 关卡掉落突破石', () => {
      const count = sys.claimStageBreakthroughStone('stage_1');
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    });

    it('2. 扫荡掉落突破石（已通关关卡）', () => {
      // random=0.5, SWEEP_DROP_CHANCE=0.5, 0.5 >= 0.5 => false (不触发)
      // 需要random < 0.5 才触发
      const sys2 = createSystem({ random: () => 0.3 });
      const count = sys2.sweepStage('stage_1');
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('3. 商店购买突破石', () => {
      const result = sys.buyBreakthroughStone(5);
      expect(result).toBe(true);
      expect(sys.getDailyBreakstonePurchased()).toBe(5);
    });

    it('4. 成就奖励突破石', () => {
      const count = sys.claimAchievementReward('ach_stage_10');
      expect(count).toBe(10);
    });

    it('6. 活动奖励突破石', () => {
      const count = sys.claimEventBreakthroughReward();
      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(30);
    });
  });

  // ═══════════════════════════════════════════
  // F-Normal: 技能书获取
  // ═══════════════════════════════════════════

  describe('[F-Normal] 技能书获取5途径', () => {
    it('1. 日常任务技能书', () => {
      const count = sys.claimDailyTaskSkillBook();
      expect(count).toBe(2);
    });

    it('2. 远征掉落技能书', () => {
      const count = sys.claimExpeditionReward('exp_1');
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    });

    it('3. 活动奖励技能书', () => {
      const count = sys.claimEventSkillBookReward();
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(10);
    });

    it('5. 关卡首通技能书', () => {
      const count = sys.claimStageFirstClearSkillBook('stage_new');
      expect(count).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // F-Boundary: 边界条件
  // ═══════════════════════════════════════════

  describe('[F-Boundary] 边界条件', () => {
    it('商店每日限购20个', () => {
      expect(sys.buyBreakthroughStone(20)).toBe(true);
      expect(sys.buyBreakthroughStone(1)).toBe(false);
    });

    it('商店限购刚好达到', () => {
      expect(sys.buyBreakthroughStone(19)).toBe(true);
      expect(sys.buyBreakthroughStone(1)).toBe(true);
      expect(sys.buyBreakthroughStone(1)).toBe(false);
    });

    it('远征每日2次限制', () => {
      expect(sys.claimExpeditionReward('exp_1')).toBeGreaterThan(0);
      expect(sys.claimExpeditionReward('exp_2')).toBeGreaterThan(0);
      expect(sys.claimExpeditionReward('exp_3')).toBe(0);
    });

    it('首通技能书不可重复领取', () => {
      expect(sys.claimStageFirstClearSkillBook('stage_x')).toBe(1);
      expect(sys.claimStageFirstClearSkillBook('stage_x')).toBe(0);
    });

    it('成就奖励不可重复领取', () => {
      expect(sys.claimAchievementReward('ach_stage_10')).toBe(10);
      expect(sys.claimAchievementReward('ach_stage_10')).toBe(0);
    });

    it('日常技能书每日只能领一次', () => {
      expect(sys.claimDailyTaskSkillBook()).toBe(2);
      expect(sys.claimDailyTaskSkillBook()).toBe(0);
    });

    it('购买0个突破石失败', () => {
      expect(sys.buyBreakthroughStone(0)).toBe(false);
    });

    it('购买负数突破石失败', () => {
      expect(sys.buyBreakthroughStone(-5)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // F-Error: 异常路径
  // ═══════════════════════════════════════════

  describe('[F-Error] 异常路径', () => {
    it('未通关关卡扫荡返回0', () => {
      expect(sys.sweepStage('stage_not_cleared')).toBe(0);
    });

    it('空关卡ID返回0', () => {
      expect(sys.claimStageBreakthroughStone('')).toBe(0);
      expect(sys.sweepStage('')).toBe(0);
      expect(sys.claimStageFirstClearSkillBook('')).toBe(0);
    });

    it('空远征ID返回0', () => {
      expect(sys.claimExpeditionReward('')).toBe(0);
    });

    it('空成就ID返回0', () => {
      expect(sys.claimAchievementReward('')).toBe(0);
    });

    it('不存在的成就ID返回0', () => {
      expect(sys.claimAchievementReward('ach_nonexistent')).toBe(0);
    });

    it('铜钱不足时购买失败', () => {
      goldAmount = 100; // 不够买1个(500)
      expect(sys.buyBreakthroughStone(1)).toBe(false);
    });

    it('materialDeps未设置时不崩溃', () => {
      const raw = new MaterialEconomySystem();
      raw.init(createMockDeps() as any);
      expect(() => raw.claimStageBreakthroughStone('s1')).not.toThrow();
      expect(() => raw.buyBreakthroughStone(1)).not.toThrow();
    });

    it('联盟商店购买返回false（未实现）', () => {
      expect(sys.buyFromAllianceShop(1)).toBe(false);
    });

    it('联盟商店技能书返回false（未实现）', () => {
      expect(sys.buySkillBookFromAllianceShop(1)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // F-Cross: 跨系统交互
  // ═══════════════════════════════════════════

  describe('[F-Cross] 跨系统交互', () => {
    it('随机数注入影响扫荡结果', () => {
      // random=0.5, SWEEP_DROP_CHANCE=0.5, 0.5 >= 0.5 => 不掉落
      const sys1 = createSystem({ random: () => 0.5 });
      expect(sys1.sweepStage('stage_1')).toBe(0);

      // random=0.49 => 掉落
      const sys2 = createSystem({ random: () => 0.49 });
      expect(sys2.sweepStage('stage_1')).toBeGreaterThan(0);
    });

    it('随机数注入影响掉落数量', () => {
      // 固定random=0.5 => randInt(1,3) = floor(0.5 * 3) + 1 = 2
      const sys1 = createSystem({ random: () => 0.5 });
      const count = sys1.claimStageBreakthroughStone('s1');
      expect(count).toBe(2);
    });

    it('突破石获取统计累计', () => {
      sys.claimStageBreakthroughStone('s1');
      sys.buyBreakthroughStone(5);
      expect(sys.getDailyBreakthroughStoneEarned()).toBeGreaterThan(0);
      expect(sys.getTotalBreakthroughStoneEarned()).toBeGreaterThan(0);
    });

    it('技能书获取统计累计', () => {
      sys.claimDailyTaskSkillBook();
      expect(sys.getDailySkillBookEarned()).toBe(2);
      expect(sys.getTotalSkillBookEarned()).toBe(2);
    });

    it('查询接口返回正确', () => {
      expect(sys.getShopConfig()).toEqual({ price: 500, dailyLimit: 20 });
      expect(sys.getExpeditionConfig()).toEqual({ maxDaily: 2, minBooks: 1, maxBooks: 3 });
      expect(sys.getAchievementIds().length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // F-Lifecycle: 数据生命周期
  // ═══════════════════════════════════════════

  describe('[F-Lifecycle] 生命周期', () => {
    it('序列化数据完整', () => {
      sys.buyBreakthroughStone(5);
      sys.claimDailyTaskSkillBook();
      const data = sys.serialize();
      expect(data.version).toBe(1);
      expect(data.dailyBreakstonePurchased).toBe(5);
      expect(data.dailySkillBookClaimed).toBe(true);
      expect(data.dailyBreakthroughStoneEarned).toBeGreaterThan(0);
    });

    it('反序列化恢复状态', () => {
      sys.buyBreakthroughStone(5);
      sys.claimAchievementReward('ach_stage_10');
      sys.claimStageFirstClearSkillBook('stage_x');
      const data = sys.serialize();

      const sys2 = createSystem();
      sys2.deserialize(data);
      expect(sys2.getDailyBreakstonePurchased()).toBe(5);
      expect(sys2.getClaimedAchievements()).toContain('ach_stage_10');
      expect(sys2.getClaimedFirstClearStages()).toContain('stage_x');
    });

    it('reset恢复初始状态', () => {
      sys.buyBreakthroughStone(10);
      sys.claimDailyTaskSkillBook();
      sys.reset();
      expect(sys.getDailyBreakstonePurchased()).toBe(0);
      expect(sys.getDailySkillBookClaimed()).toBe(false);
      expect(sys.getTotalBreakthroughStoneEarned()).toBe(0);
    });

    it('每日重置清零日统计但保留累计', () => {
      sys.buyBreakthroughStone(5);
      sys.claimDailyTaskSkillBook();
      const totalBreak = sys.getTotalBreakthroughStoneEarned();
      const totalSkill = sys.getTotalSkillBookEarned();

      // 触发每日重置
      const data = sys.serialize();
      data.lastResetDate = '2000-01-01';
      sys.deserialize(data);

      expect(sys.getDailyBreakstonePurchased()).toBe(0);
      expect(sys.getDailySkillBookClaimed()).toBe(false);
      expect(sys.getTotalBreakthroughStoneEarned()).toBe(totalBreak);
      expect(sys.getTotalSkillBookEarned()).toBe(totalSkill);
    });

    it('反序列化null安全', () => {
      const data = sys.serialize();
      // 模拟缺失字段
      const partial = { ...data, dailyBreakstonePurchased: undefined, claimedAchievements: undefined };
      expect(() => sys.deserialize(partial as any)).not.toThrow();
    });
  });
});
