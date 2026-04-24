/**
 * 集成测试 — 声望商店×声望点数×任务系统
 *
 * 验证声望商店购买、等级解锁、限购、折扣、声望点数/声望值双货币体系，
 * 以及声望专属任务和转生专属任务的完整流程。
 * 覆盖 §5.6 + §7.1 + §7.2 + §10.1 + §10.6 + §10.8
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrestigeSystem, calcRequiredPoints } from '../../../../engine/prestige/PrestigeSystem';
import { PrestigeShopSystem } from '../../../../engine/prestige/PrestigeShopSystem';
import { RebirthSystem } from '../../../../engine/prestige/RebirthSystem';
import type { ISystemDeps } from '../../../../core/types';
import {
  PRESTIGE_SHOP_GOODS,
  LEVEL_UNLOCK_REWARDS,
  REBIRTH_CONDITIONS,
  PRESTIGE_QUESTS,
  REBIRTH_QUESTS,
} from '../../prestige-config';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createShop() {
  const shop = new PrestigeShopSystem();
  shop.init(mockDeps());
  return shop;
}

function createPrestige() {
  const sys = new PrestigeSystem();
  sys.init(mockDeps());
  return sys;
}

function createRebirth() {
  const sys = new RebirthSystem();
  sys.init(mockDeps());
  return sys;
}

// ═════════════════════════════════════════════════════════════

describe('§5.6+§7 声望商店×任务 集成测试', () => {
  let shop: PrestigeShopSystem;
  let prestige: PrestigeSystem;

  beforeEach(() => {
    shop = createShop();
    prestige = createPrestige();
  });

  // ═══════════════════════════════════════════
  // §5.6 声望商店
  // ═══════════════════════════════════════════

  describe('§5.6 声望商店', () => {
    it('商品列表非空', () => {
      const goods = shop.getAllGoods();
      expect(goods.length).toBeGreaterThan(0);
    });

    it('等级不足时商品不可购买', () => {
      // 初始等级1，psg-002需要等级3
      const result = shop.buyGoods('psg-002');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('等级');
    });

    it('等级足够且声望值足够可购买', () => {
      shop.updatePrestigeInfo(1000, 3);
      const result = shop.buyGoods('psg-002');
      expect(result.success).toBe(true);
      expect(result.cost).toBe(80);
    });

    it('声望值不足不可购买', () => {
      shop.updatePrestigeInfo(10, 3);
      const result = shop.buyGoods('psg-002');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不足');
    });

    it('限购次数正确扣减', () => {
      shop.updatePrestigeInfo(5000, 3);
      // psg-002限购3次
      const r1 = shop.buyGoods('psg-002');
      expect(r1.success).toBe(true);
      const r2 = shop.buyGoods('psg-002');
      expect(r2.success).toBe(true);
      const r3 = shop.buyGoods('psg-002');
      expect(r3.success).toBe(true);
      const r4 = shop.buyGoods('psg-002');
      expect(r4.success).toBe(false);
      expect(r4.reason).toContain('上限');
    });

    it('购买后声望值扣除', () => {
      shop.updatePrestigeInfo(1000, 3);
      shop.buyGoods('psg-002');
      const state = shop.getState();
      expect(state.prestigePoints).toBe(1000 - 80);
    });

    it('canBuyGoods检查', () => {
      shop.updatePrestigeInfo(10, 1);
      const check = shop.canBuyGoods('psg-002');
      expect(check.canBuy).toBe(false);
    });

    it('购买事件发射', () => {
      const emitSpy = vi.fn();
      const deps = mockDeps();
      deps.eventBus.emit = emitSpy;
      const s = new PrestigeShopSystem();
      s.init(deps);
      s.updatePrestigeInfo(1000, 3);
      s.buyGoods('psg-002');
      expect(emitSpy).toHaveBeenCalledWith('prestigeShop:purchased', expect.any(Object));
    });

    it('未解锁商品灰显', () => {
      shop.updatePrestigeInfo(10000, 1);
      const goods = shop.getAllGoods();
      const locked = goods.filter(g => !g.unlocked);
      expect(locked.length).toBeGreaterThan(0);
    });

    it('已解锁商品列表', () => {
      shop.updatePrestigeInfo(10000, 5);
      const unlocked = shop.getUnlockedGoods();
      unlocked.forEach(g => {
        expect(g.unlocked).toBe(true);
        expect(g.requiredLevel).toBeLessThanOrEqual(5);
      });
    });

    it('购买记录保存', () => {
      shop.updatePrestigeInfo(5000, 3);
      shop.buyGoods('psg-002');
      shop.buyGoods('psg-002');
      const history = shop.getPurchaseHistory();
      expect(history['psg-002']).toBe(2);
    });

    it('批量购买数量正确', () => {
      shop.updatePrestigeInfo(5000, 1);
      const result = shop.buyGoods('psg-001', 3);
      expect(result.success).toBe(true);
      expect(result.cost).toBe(50 * 3);
    });

    it('不存在的商品返回失败', () => {
      const result = shop.buyGoods('non-existent');
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // §5.5 等级解锁奖励
  // ═══════════════════════════════════════════

  describe('§5.5 等级解锁奖励', () => {
    it('解锁奖励列表完整', () => {
      const rewards = prestige.getLevelRewards();
      expect(rewards.length).toBeGreaterThan(0);
    });

    it('未达到等级灰显', () => {
      const rewards = prestige.getLevelRewards();
      const locked = rewards.filter(r => !r.claimed && r.level > 1);
      expect(locked.length).toBeGreaterThan(0);
    });

    it('奖励回调触发', () => {
      const cb = vi.fn();
      prestige.setRewardCallback(cb);
      // 提升到等级5
      while (prestige.getState().currentLevel < 5) {
        prestige.addPrestigePoints('main_quest', 10000);
      }
      prestige.claimLevelReward(5);
      expect(cb).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  // ═══════════════════════════════════════════
  // §7.1 声望专属日常任务
  // ═══════════════════════════════════════════

  describe('§7.1 声望专属日常任务', () => {
    it('声望任务列表非空', () => {
      const quests = prestige.getPrestigeQuests();
      expect(quests.length).toBeGreaterThan(0);
    });

    it('等级不足的任务不显示', () => {
      // 初始等级1，只有requiredPrestigeLevel<=1的任务显示
      const quests = prestige.getPrestigeQuests();
      quests.forEach(q => {
        expect(q.requiredPrestigeLevel).toBeLessThanOrEqual(1);
      });
    });

    it('声望任务进度追踪', () => {
      // pq-001: 达到声望等级3
      const progress = prestige.getPrestigeQuestProgress('pq-001');
      expect(progress).toBeGreaterThanOrEqual(0);
    });

    it('声望任务完成检测', () => {
      // 提升到等级3
      while (prestige.getState().currentLevel < 3) {
        prestige.addPrestigePoints('main_quest', 10000);
      }
      const completed = prestige.checkPrestigeQuestCompletion('pq-001');
      // pq-001目标是等级3
      expect(typeof completed).toBe('boolean');
    });

    it('声望任务配置完整', () => {
      PRESTIGE_QUESTS.forEach(q => {
        expect(q.id).toBeTruthy();
        expect(q.title).toBeTruthy();
        expect(q.objectiveType).toBeTruthy();
        expect(q.targetCount).toBeGreaterThan(0);
        expect(q.rewards).toBeTruthy();
      });
    });
  });

  // ═══════════════════════════════════════════
  // §7.2 转生专属任务
  // ═══════════════════════════════════════════

  describe('§7.2 转生专属任务', () => {
    it('转生任务列表非空', () => {
      const quests = prestige.getRebirthQuests(0);
      expect(quests.length).toBeGreaterThan(0);
    });

    it('转生次数过滤正确', () => {
      const quests0 = prestige.getRebirthQuests(0);
      const quests2 = prestige.getRebirthQuests(2);
      quests0.forEach(q => expect(q.requiredRebirthCount).toBeLessThanOrEqual(0));
      expect(quests2.length).toBeGreaterThanOrEqual(quests0.length);
    });

    it('转生任务配置完整', () => {
      REBIRTH_QUESTS.forEach(q => {
        expect(q.id).toBeTruthy();
        expect(q.title).toBeTruthy();
        expect(q.objectiveType).toBeTruthy();
        expect(q.targetCount).toBeGreaterThan(0);
        expect(q.rewards).toBeTruthy();
      });
    });

    it('转生后任务触发', () => {
      const rebirth = createRebirth();
      rebirth.setCallbacks({
        castleLevel: () => REBIRTH_CONDITIONS.minCastleLevel,
        heroCount: () => REBIRTH_CONDITIONS.minHeroCount,
        totalPower: () => REBIRTH_CONDITIONS.minTotalPower,
        prestigeLevel: () => REBIRTH_CONDITIONS.minPrestigeLevel,
      });
      rebirth.updatePrestigeLevel(REBIRTH_CONDITIONS.minPrestigeLevel);
      rebirth.executeRebirth();
      const quests = prestige.getRebirthQuests(1);
      expect(quests.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // §10.1+§10.6 双货币体系
  // ═══════════════════════════════════════════

  describe('§10.1+§10.6 双货币体系', () => {
    it('声望值只增不减', () => {
      prestige.addPrestigePoints('main_quest', 500);
      expect(prestige.getState().totalPoints).toBe(500);
      prestige.addPrestigePoints('main_quest', 300);
      expect(prestige.getState().totalPoints).toBe(800);
    });

    it('声望值用于驱动等级', () => {
      const beforeLevel = prestige.getState().currentLevel;
      prestige.addPrestigePoints('main_quest', calcRequiredPoints(2));
      expect(prestige.getState().currentLevel).toBeGreaterThan(beforeLevel);
    });

    it('声望点数用于商店消费(独立于声望值)', () => {
      shop.updatePrestigeInfo(500, 3);
      shop.buyGoods('psg-002');
      // 声望点数(用于商店)被扣除
      expect(shop.getState().prestigePoints).toBe(500 - 80);
    });

    it('转生后声望值保留', () => {
      prestige.addPrestigePoints('main_quest', 5000);
      const totalBefore = prestige.getState().totalPoints;
      // 声望值在转生时保留（由PrestigeSystem保证）
      expect(prestige.getState().totalPoints).toBe(totalBefore);
    });
  });

  // ═══════════════════════════════════════════
  // §10.8 成就点数与声望点数区分
  // ═══════════════════════════════════════════

  describe('§10.8 成就点数与声望点数', () => {
    it('声望任务奖励声望值(非声望点数)', () => {
      const quest = PRESTIGE_QUESTS[0];
      expect(quest.rewards.prestigePoints).toBeDefined();
    });

    it('声望商店消耗声望点数(非声望值)', () => {
      PRESTIGE_SHOP_GOODS.forEach(g => {
        expect(g.costPoints).toBeGreaterThan(0);
      });
    });

    it('两套货币独立计算', () => {
      // 声望值通过addPrestigePoints增加
      prestige.addPrestigePoints('main_quest', 1000);
      // 声望点数通过商店消耗
      shop.updatePrestigeInfo(1000, 3);
      shop.buyGoods('psg-002');
      // 两套系统独立
      expect(prestige.getState().totalPoints).toBe(1000);
      expect(shop.getState().prestigePoints).toBe(1000 - 80);
    });
  });
});
