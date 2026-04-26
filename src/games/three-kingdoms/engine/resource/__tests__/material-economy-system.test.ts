/**
 * MaterialEconomySystem 单元测试
 *
 * 覆盖：突破石获取（关卡掉落、扫荡、商店、成就、活动、联盟预留）、
 *       技能书获取（日常任务、远征、活动、关卡首通、联盟预留）、
 *       日产出汇总、序列化/反序列化、ISubsystem 接口
 *
 * 设计规格来源：PRD v1.3 HER-8/9
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaterialEconomySystem } from '../material-economy-system';
import type { MaterialEconomySaveData } from '../material-economy-system';

// ─────────────────────────────────────────────
// 测试工具
// ─────────────────────────────────────────────

/** 固定随机序列生成器 */
function fixedRandom(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

/** 创建 mock 依赖 */
function createMockDeps(clearedStages: string[] = ['stage_1_1', 'stage_1_2', 'stage_1_3']) {
  let gold = 100000;
  let breakthroughStones = 0;
  let skillBooks = 0;

  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
    materialDeps: {
      consumeGold: vi.fn((amount: number) => {
        if (gold < amount) return false;
        gold -= amount;
        return true;
      }),
      getGoldAmount: vi.fn(() => gold),
      addBreakthroughStone: vi.fn((count: number) => { breakthroughStones += count; }),
      addSkillBook: vi.fn((count: number) => { skillBooks += count; }),
      getClearedStages: vi.fn(() => clearedStages),
    },
    getGold: () => gold,
    setGold: (v: number) => { gold = v; },
    getBreakthroughStones: () => breakthroughStones,
    getSkillBooks: () => skillBooks,
  };
}

/** 创建并初始化系统 */
function createSystem(clearedStages?: string[]) {
  const mock = createMockDeps(clearedStages);
  const system = new MaterialEconomySystem();
  system.init({
    eventBus: mock.eventBus,
    config: mock.config,
    registry: mock.registry,
  });
  system.setMaterialDeps(mock.materialDeps);
  return { system, mock };
}

// ═══════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════

describe('MaterialEconomySystem', () => {
  let system: MaterialEconomySystem;
  let mock: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.restoreAllMocks();
    ({ system, mock } = createSystem());
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════

  describe('ISubsystem 接口', () => {
    it('name 为 materialEconomy', () => {
      expect(system.name).toBe('materialEconomy');
    });

    it('getState 返回序列化数据', () => {
      const state = system.getState() as MaterialEconomySaveData;
      expect(state.version).toBe(1);
      expect(state.dailyBreakstonePurchased).toBe(0);
      expect(state.dailySkillBookClaimed).toBe(false);
    });

    it('reset 清空所有状态', () => {
      system.claimStageBreakthroughStone('stage_1');
      system.claimDailyTaskSkillBook();
      system.buyBreakthroughStone(5);

      system.reset();

      expect(system.getDailyBreakstonePurchased()).toBe(0);
      expect(system.getDailySkillBookClaimed()).toBe(false);
      expect(system.getDailyBreakthroughStoneEarned()).toBe(0);
      expect(system.getDailySkillBookEarned()).toBe(0);
      expect(system.getTotalBreakthroughStoneEarned()).toBe(0);
      expect(system.getTotalSkillBookEarned()).toBe(0);
    });

    it('init 注入依赖不报错', () => {
      const sys = new MaterialEconomySystem();
      expect(() => sys.init({
        eventBus: mock.eventBus, config: mock.config, registry: mock.registry,
      })).not.toThrow();
    });

    it('update 调用不报错', () => {
      expect(() => system.update(1)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 突破石 — 关卡掉落
  // ═══════════════════════════════════════════

  describe('突破石 — 关卡掉落', () => {
    it('关卡掉落返回 1~3 个突破石', () => {
      const count = system.claimStageBreakthroughStone('stage_1_1');
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    });

    it('关卡掉落添加到突破石', () => {
      system.claimStageBreakthroughStone('stage_1_1');
      expect(mock.materialDeps.addBreakthroughStone).toHaveBeenCalled();
      expect(mock.getBreakthroughStones()).toBeGreaterThanOrEqual(1);
    });

    it('空 stageId 返回 0', () => {
      expect(system.claimStageBreakthroughStone('')).toBe(0);
    });

    it('null deps 返回 0', () => {
      const sys = new MaterialEconomySystem();
      sys.init({ eventBus: mock.eventBus, config: mock.config, registry: mock.registry });
      expect(sys.claimStageBreakthroughStone('stage_1')).toBe(0);
    });

    it('多次关卡掉落累计正确', () => {
      const c1 = system.claimStageBreakthroughStone('stage_1_1');
      const c2 = system.claimStageBreakthroughStone('stage_1_2');
      const c3 = system.claimStageBreakthroughStone('stage_1_3');
      expect(mock.getBreakthroughStones()).toBe(c1 + c2 + c3);
      expect(system.getDailyBreakthroughStoneEarned()).toBe(c1 + c2 + c3);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 突破石 — 扫荡
  // ═══════════════════════════════════════════

  describe('突破石 — 扫荡', () => {
    it('已通关关卡扫荡 50% 概率掉落', () => {
      const rng = fixedRandom([0.1]);
      mock.materialDeps.random = rng;
      const count = system.sweepStage('stage_1_1');
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    });

    it('未通关关卡扫荡返回 0', () => {
      const count = system.sweepStage('stage_not_cleared');
      expect(count).toBe(0);
    });

    it('50% 概率未命中返回 0', () => {
      const rng = fixedRandom([0.9]);
      mock.materialDeps.random = rng;
      const count = system.sweepStage('stage_1_1');
      expect(count).toBe(0);
    });

    it('空 stageId 返回 0', () => {
      expect(system.sweepStage('')).toBe(0);
    });

    it('扫荡成功时记录突破石', () => {
      const rng = fixedRandom([0.1]);
      mock.materialDeps.random = rng;
      const count = system.sweepStage('stage_1_1');
      expect(count).toBeGreaterThan(0);
      expect(system.getDailyBreakthroughStoneEarned()).toBe(count);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 突破石 — 商店购买
  // ═══════════════════════════════════════════

  describe('突破石 — 商店购买', () => {
    it('购买 1 个突破石消耗 500 铜钱', () => {
      const result = system.buyBreakthroughStone(1);
      expect(result).toBe(true);
      expect(mock.getGold()).toBe(99500);
      expect(mock.getBreakthroughStones()).toBe(1);
    });

    it('购买 10 个突破石消耗 5000 铜钱', () => {
      const result = system.buyBreakthroughStone(10);
      expect(result).toBe(true);
      expect(mock.getGold()).toBe(95000);
      expect(mock.getBreakthroughStones()).toBe(10);
    });

    it('每日限购 20 个', () => {
      expect(system.buyBreakthroughStone(20)).toBe(true);
      expect(system.buyBreakthroughStone(1)).toBe(false);
    });

    it('超出日限购数量拒绝', () => {
      expect(system.buyBreakthroughStone(21)).toBe(false);
    });

    it('铜钱不足时拒绝购买', () => {
      mock.setGold(400);
      expect(system.buyBreakthroughStone(1)).toBe(false);
    });

    it('count <= 0 拒绝', () => {
      expect(system.buyBreakthroughStone(0)).toBe(false);
      expect(system.buyBreakthroughStone(-1)).toBe(false);
    });

    it('查询已购买数量', () => {
      system.buyBreakthroughStone(5);
      expect(system.getDailyBreakstonePurchased()).toBe(5);
    });

    it('分批购买累计到日限', () => {
      expect(system.buyBreakthroughStone(10)).toBe(true);
      expect(system.buyBreakthroughStone(10)).toBe(true);
      expect(system.buyBreakthroughStone(1)).toBe(false);
    });

    it('商店配置查询', () => {
      const config = system.getShopConfig();
      expect(config.price).toBe(500);
      expect(config.dailyLimit).toBe(20);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 突破石 — 成就奖励
  // ═══════════════════════════════════════════

  describe('突破石 — 成就奖励', () => {
    it('领取成就奖励返回正确数量', () => {
      const count = system.claimAchievementReward('ach_stage_10');
      expect(count).toBe(10);
    });

    it('领取不同成就返回不同数量', () => {
      expect(system.claimAchievementReward('ach_stage_30')).toBe(20);
      expect(system.claimAchievementReward('ach_power_100000')).toBe(50);
    });

    it('不可重复领取同一成就', () => {
      system.claimAchievementReward('ach_stage_10');
      const count = system.claimAchievementReward('ach_stage_10');
      expect(count).toBe(0);
    });

    it('不存在的成就返回 0', () => {
      expect(system.claimAchievementReward('ach_nonexistent')).toBe(0);
    });

    it('空 achievementId 返回 0', () => {
      expect(system.claimAchievementReward('')).toBe(0);
    });

    it('查询成就奖励数量', () => {
      expect(system.getAchievementReward('ach_stage_10')).toBe(10);
      expect(system.getAchievementReward('ach_nonexistent')).toBeUndefined();
    });

    it('查询所有成就 ID', () => {
      const ids = system.getAchievementIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('ach_stage_10');
    });

    it('已领取成就列表', () => {
      system.claimAchievementReward('ach_stage_10');
      system.claimAchievementReward('ach_stage_30');
      expect(system.getClaimedAchievements()).toEqual(['ach_stage_10', 'ach_stage_30']);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 突破石 — 活动奖励
  // ═══════════════════════════════════════════

  describe('突破石 — 活动奖励', () => {
    it('活动奖励返回 10~30 个', () => {
      const count = system.claimEventBreakthroughReward();
      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(30);
    });

    it('活动奖励记录到日产出', () => {
      const count = system.claimEventBreakthroughReward();
      expect(system.getDailyBreakthroughStoneEarned()).toBe(count);
    });

    it('多次活动奖励累计', () => {
      const c1 = system.claimEventBreakthroughReward();
      const c2 = system.claimEventBreakthroughReward();
      expect(system.getDailyBreakthroughStoneEarned()).toBe(c1 + c2);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 突破石 — 联盟商店（预留）
  // ═══════════════════════════════════════════

  describe('突破石 — 联盟商店（预留）', () => {
    it('联盟商店购买返回 false（未实现）', () => {
      expect(system.buyFromAllianceShop(1)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 技能书 — 日常任务
  // ═══════════════════════════════════════════

  describe('技能书 — 日常任务', () => {
    it('每日领取 2 本技能书', () => {
      const count = system.claimDailyTaskSkillBook();
      expect(count).toBe(2);
      expect(mock.getSkillBooks()).toBe(2);
    });

    it('每日只能领取一次', () => {
      system.claimDailyTaskSkillBook();
      const count = system.claimDailyTaskSkillBook();
      expect(count).toBe(0);
    });

    it('查询日常技能书是否已领取', () => {
      expect(system.getDailySkillBookClaimed()).toBe(false);
      system.claimDailyTaskSkillBook();
      expect(system.getDailySkillBookClaimed()).toBe(true);
    });

    it('领取后记录到日产出', () => {
      system.claimDailyTaskSkillBook();
      expect(system.getDailySkillBookEarned()).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 技能书 — 远征掉落
  // ═══════════════════════════════════════════

  describe('技能书 — 远征掉落', () => {
    it('远征掉落 1~3 本技能书', () => {
      const count = system.claimExpeditionReward('exp_1');
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    });

    it('每日最多 2 次远征', () => {
      system.claimExpeditionReward('exp_1');
      system.claimExpeditionReward('exp_2');
      const count = system.claimExpeditionReward('exp_3');
      expect(count).toBe(0);
    });

    it('查询远征次数', () => {
      expect(system.getDailyExpeditionCount()).toBe(0);
      system.claimExpeditionReward('exp_1');
      expect(system.getDailyExpeditionCount()).toBe(1);
    });

    it('空 expeditionId 返回 0', () => {
      expect(system.claimExpeditionReward('')).toBe(0);
    });

    it('远征配置查询', () => {
      const config = system.getExpeditionConfig();
      expect(config.maxDaily).toBe(2);
      expect(config.minBooks).toBe(1);
      expect(config.maxBooks).toBe(3);
    });

    it('远征记录到累计技能书', () => {
      system.claimExpeditionReward('exp_1');
      system.claimExpeditionReward('exp_2');
      expect(system.getDailySkillBookEarned()).toBeGreaterThanOrEqual(2);
      expect(system.getDailySkillBookEarned()).toBeLessThanOrEqual(6);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 技能书 — 活动奖励
  // ═══════════════════════════════════════════

  describe('技能书 — 活动奖励', () => {
    it('活动奖励返回 5~10 本', () => {
      const count = system.claimEventSkillBookReward();
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(10);
    });

    it('活动奖励记录到日产出', () => {
      const count = system.claimEventSkillBookReward();
      expect(system.getDailySkillBookEarned()).toBe(count);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 技能书 — 关卡首通
  // ═══════════════════════════════════════════

  describe('技能书 — 关卡首通', () => {
    it('首通获得 1 本技能书', () => {
      const count = system.claimStageFirstClearSkillBook('stage_1_1');
      expect(count).toBe(1);
    });

    it('同一关卡不可重复领取首通奖励', () => {
      system.claimStageFirstClearSkillBook('stage_1_1');
      const count = system.claimStageFirstClearSkillBook('stage_1_1');
      expect(count).toBe(0);
    });

    it('不同关卡可以分别领取', () => {
      const c1 = system.claimStageFirstClearSkillBook('stage_1_1');
      const c2 = system.claimStageFirstClearSkillBook('stage_1_2');
      expect(c1).toBe(1);
      expect(c2).toBe(1);
    });

    it('空 stageId 返回 0', () => {
      expect(system.claimStageFirstClearSkillBook('')).toBe(0);
    });

    it('查询已领取首通的关卡', () => {
      system.claimStageFirstClearSkillBook('stage_1_1');
      system.claimStageFirstClearSkillBook('stage_1_2');
      expect(system.getClaimedFirstClearStages()).toEqual(['stage_1_1', 'stage_1_2']);
    });
  });

  // ═══════════════════════════════════════════
  // 12. 技能书 — 联盟商店（预留）
  // ═══════════════════════════════════════════

  describe('技能书 — 联盟商店（预留）', () => {
    it('联盟商店购买返回 false（未实现）', () => {
      expect(system.buySkillBookFromAllianceShop(1)).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 13. 日产出汇总
  // ═══════════════════════════════════════════

  describe('日产出汇总', () => {
    it('突破石日产出汇总正确', () => {
      const c1 = system.claimStageBreakthroughStone('stage_1_1');
      system.buyBreakthroughStone(5);
      const c3 = system.claimEventBreakthroughReward();
      const expected = c1 + 5 + c3;
      expect(system.getDailyBreakthroughStoneEarned()).toBe(expected);
    });

    it('技能书日产出汇总正确', () => {
      system.claimDailyTaskSkillBook(); // 2
      const c2 = system.claimExpeditionReward('exp_1');
      const c3 = system.claimEventSkillBookReward();
      const c4 = system.claimStageFirstClearSkillBook('stage_1_1');
      const expected = 2 + c2 + c3 + c4;
      expect(system.getDailySkillBookEarned()).toBe(expected);
    });

    it('累计产出跟踪正确', () => {
      system.claimStageBreakthroughStone('stage_1_1');
      system.claimDailyTaskSkillBook();
      expect(system.getTotalBreakthroughStoneEarned()).toBeGreaterThanOrEqual(1);
      expect(system.getTotalSkillBookEarned()).toBe(2);
    });

    it('模拟完整一天产出', () => {
      // 突破石：10次关卡 + 20个购买 + 成就 + 活动
      let totalStones = 0;
      for (let i = 0; i < 10; i++) {
        totalStones += system.claimStageBreakthroughStone(`stage_${i}`);
      }
      system.buyBreakthroughStone(20);
      totalStones += 20;
      const ach = system.claimAchievementReward('ach_stage_10');
      totalStones += ach;
      const evt = system.claimEventBreakthroughReward();
      totalStones += evt;

      // 技能书：日常 + 远征x2 + 活动 + 首通x5
      system.claimDailyTaskSkillBook();
      const exp1 = system.claimExpeditionReward('exp_1');
      const exp2 = system.claimExpeditionReward('exp_2');
      const skillEvt = system.claimEventSkillBookReward();
      let firstClearBooks = 0;
      for (let i = 0; i < 5; i++) {
        firstClearBooks += system.claimStageFirstClearSkillBook(`fc_stage_${i}`);
      }

      expect(system.getDailyBreakthroughStoneEarned()).toBe(totalStones);
      expect(system.getDailySkillBookEarned()).toBe(2 + exp1 + exp2 + skillEvt + firstClearBooks);
    });
  });

  // ═══════════════════════════════════════════
  // 14. 序列化 / 反序列化
  // ═══════════════════════════════════════════

  describe('序列化 / 反序列化', () => {
    it('序列化返回完整数据', () => {
      system.claimStageBreakthroughStone('stage_1_1');
      system.buyBreakthroughStone(5);
      system.claimDailyTaskSkillBook();
      system.claimExpeditionReward('exp_1');

      const data = system.serialize();
      expect(data.version).toBe(1);
      expect(data.dailyBreakstonePurchased).toBe(5);
      expect(data.dailySkillBookClaimed).toBe(true);
      expect(data.dailyExpeditionCount).toBe(1);
      expect(data.dailyBreakthroughStoneEarned).toBeGreaterThanOrEqual(6);
      expect(data.dailySkillBookEarned).toBeGreaterThanOrEqual(3);
      expect(data.totalBreakthroughStoneEarned).toBeGreaterThanOrEqual(6);
      expect(data.totalSkillBookEarned).toBeGreaterThanOrEqual(3);
      expect(data.claimedAchievements).toEqual([]);
      expect(data.claimedFirstClearStages).toEqual([]);
    });

    it('反序列化恢复状态', () => {
      system.claimAchievementReward('ach_stage_10');
      system.claimStageFirstClearSkillBook('stage_1_1');
      system.buyBreakthroughStone(10);
      system.claimDailyTaskSkillBook();

      const data = system.serialize();
      const sys2 = new MaterialEconomySystem();
      sys2.init({ eventBus: mock.eventBus, config: mock.config, registry: mock.registry });
      sys2.setMaterialDeps(mock.materialDeps);
      sys2.deserialize(data);

      expect(sys2.getDailyBreakstonePurchased()).toBe(10);
      expect(sys2.getDailySkillBookClaimed()).toBe(true);
      expect(sys2.getClaimedAchievements()).toEqual(['ach_stage_10']);
      expect(sys2.getClaimedFirstClearStages()).toEqual(['stage_1_1']);
      expect(sys2.getTotalBreakthroughStoneEarned()).toBe(data.totalBreakthroughStoneEarned);
      expect(sys2.getTotalSkillBookEarned()).toBe(data.totalSkillBookEarned);
    });

    it('反序列化兼容部分数据', () => {
      const partial = { version: 1 } as MaterialEconomySaveData;
      const sys = new MaterialEconomySystem();
      sys.init({ eventBus: mock.eventBus, config: mock.config, registry: mock.registry });
      sys.setMaterialDeps(mock.materialDeps);
      expect(() => sys.deserialize(partial)).not.toThrow();
      expect(sys.getDailyBreakstonePurchased()).toBe(0);
      expect(sys.getDailySkillBookClaimed()).toBe(false);
      expect(sys.getDailyExpeditionCount()).toBe(0);
    });

    it('序列化-反序列化往返一致', () => {
      system.claimStageBreakthroughStone('stage_1');
      system.buyBreakthroughStone(3);
      system.claimAchievementReward('ach_hero_30');
      system.claimDailyTaskSkillBook();
      system.claimExpeditionReward('exp_1');
      system.claimStageFirstClearSkillBook('stage_fc_1');

      const data = system.serialize();
      const sys2 = new MaterialEconomySystem();
      sys2.init({ eventBus: mock.eventBus, config: mock.config, registry: mock.registry });
      sys2.setMaterialDeps(mock.materialDeps);
      sys2.deserialize(data);
      const data2 = sys2.serialize();

      expect(data2).toEqual(data);
    });

    it('成就和首通记录持久化', () => {
      system.claimAchievementReward('ach_stage_10');
      system.claimAchievementReward('ach_stage_30');
      system.claimStageFirstClearSkillBook('stage_1');
      system.claimStageFirstClearSkillBook('stage_2');

      const data = system.serialize();
      expect(data.claimedAchievements).toEqual(['ach_stage_10', 'ach_stage_30']);
      expect(data.claimedFirstClearStages).toEqual(['stage_1', 'stage_2']);
    });
  });

  // ═══════════════════════════════════════════
  // 15. 边界情况
  // ═══════════════════════════════════════════

  describe('边界情况', () => {
    it('未设置 materialDeps 时所有操作安全返回', () => {
      const sys = new MaterialEconomySystem();
      sys.init({ eventBus: mock.eventBus, config: mock.config, registry: mock.registry });
      expect(sys.claimStageBreakthroughStone('s1')).toBe(0);
      expect(sys.sweepStage('s1')).toBe(0);
      expect(sys.buyBreakthroughStone(1)).toBe(false);
      expect(sys.claimAchievementReward('ach_stage_10')).toBe(0);
      expect(sys.claimEventBreakthroughReward()).toBe(0);
      expect(sys.claimDailyTaskSkillBook()).toBe(0);
      expect(sys.claimExpeditionReward('e1')).toBe(0);
      expect(sys.claimEventSkillBookReward()).toBe(0);
      expect(sys.claimStageFirstClearSkillBook('s1')).toBe(0);
    });

    it('购买突破石恰好花光铜钱', () => {
      mock.setGold(500);
      expect(system.buyBreakthroughStone(1)).toBe(true);
      expect(mock.getGold()).toBe(0);
    });

    it('购买突破石铜钱差1', () => {
      mock.setGold(499);
      expect(system.buyBreakthroughStone(1)).toBe(false);
    });

    it('重置后成就记录清空可重新领取', () => {
      system.claimAchievementReward('ach_stage_10');
      system.reset();
      expect(system.getClaimedAchievements()).toEqual([]);
    });

    it('重置后首通记录清空', () => {
      system.claimStageFirstClearSkillBook('stage_1');
      system.reset();
      expect(system.getClaimedFirstClearStages()).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 16. 固定随机测试
  // ═══════════════════════════════════════════

  describe('固定随机测试', () => {
    it('关卡掉落使用注入的随机函数', () => {
      mock.materialDeps.random = fixedRandom([0]);
      expect(system.claimStageBreakthroughStone('s1')).toBe(1);

      mock.materialDeps.random = fixedRandom([0.5]);
      const count = system.claimStageBreakthroughStone('s2');
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    });

    it('活动突破石使用注入的随机函数', () => {
      mock.materialDeps.random = fixedRandom([0]);
      expect(system.claimEventBreakthroughReward()).toBe(10);
    });

    it('远征技能书使用注入的随机函数', () => {
      mock.materialDeps.random = fixedRandom([0]);
      expect(system.claimExpeditionReward('e1')).toBe(1);
    });

    it('活动技能书使用注入的随机函数', () => {
      mock.materialDeps.random = fixedRandom([0]);
      expect(system.claimEventSkillBookReward()).toBe(5);
    });
  });
});
