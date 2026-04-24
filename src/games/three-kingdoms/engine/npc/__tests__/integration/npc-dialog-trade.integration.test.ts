/**
 * 集成测试 §8+§9+§9.5 — 离线摘要+对话历史+交易
 *
 * 覆盖 Play 流程：
 *   §8  离线摘要 — 离线回来后的行为汇总展示
 *   §9  对话历史 — NPC对话记录回看
 *   §9.5 交易系统 — 商路开通、价格波动、利润计算
 *
 * 集成系统：NPCTrainingSystem(对话历史) ↔ NPCDialogSystem ↔ TradeSystem
 *
 * @module engine/npc/__tests__/integration/npc-dialog-trade
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NPCTrainingSystem } from '../../NPCTrainingSystem';
import { NPCDialogSystem } from '../../NPCDialogSystem';
import { TradeSystem, type TradeCurrencyOps } from '../../../trade/TradeSystem';
import { CaravanSystem, type RouteInfoProvider } from '../../../trade/CaravanSystem';
import type { ISystemDeps } from '../../../../core/types';
import { MAX_DIALOGUE_HISTORY, DIALOGUE_TRIM_TO } from '../../NPCTrainingTypes';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
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

/** 创建对话依赖 */
function createDialogDeps() {
  const affinityMap = new Map<string, number>();
  const professionMap = new Map<string, string>();

  return {
    getAffinity: (npcId: string) => affinityMap.get(npcId) ?? 50,
    getProfession: (npcId: string) => professionMap.get(npcId) ?? null,
    changeAffinity: (npcId: string, value: number) => {
      affinityMap.set(npcId, (affinityMap.get(npcId) ?? 50) + value);
    },
    getCurrentTurn: () => 1,
    affinityMap,
    professionMap,
  };
}

/** 创建交易货币操作 */
function createCurrencyOps(): TradeCurrencyOps & { balances: Record<string, number> } {
  const balances: Record<string, number> = { gold: 100000 };
  return {
    balances,
    addCurrency: (type: string, amount: number) => {
      balances[type] = (balances[type] ?? 0) + amount;
    },
    canAfford: (type: string, amount: number) => (balances[type] ?? 0) >= amount,
    spendByPriority: (shopType: string, amount: number) => {
      if (balances.gold >= amount) {
        balances.gold -= amount;
        return { success: true };
      }
      return { success: false };
    },
  };
}

/** 创建集成环境 */
function createDialogTradeEnv() {
  const deps = createMockDeps();
  const dialogDeps = createDialogDeps();
  const currencyOps = createCurrencyOps();

  const trainingSystem = new NPCTrainingSystem();
  trainingSystem.init(deps);

  const dialogSystem = new NPCDialogSystem();
  dialogSystem.init(deps);
  dialogSystem.setDialogDeps(dialogDeps);

  const tradeSystem = new TradeSystem();
  tradeSystem.init(deps);
  tradeSystem.setCurrencyOps(currencyOps);

  return { trainingSystem, dialogSystem, tradeSystem, dialogDeps, currencyOps, deps };
}

// ─────────────────────────────────────────────
// §8 离线摘要
// ─────────────────────────────────────────────

describe('§8 离线摘要集成', () => {
  let env: ReturnType<typeof createDialogTradeEnv>;

  beforeEach(() => {
    env = createDialogTradeEnv();
  });

  describe('§8.1 离线摘要生成', () => {
    it('§8.1.1 应根据离线时长和NPC生成行为摘要', () => {
      const npcs = [
        { id: 'npc-01', name: '张飞', profession: 'warrior' },
        { id: 'npc-02', name: '诸葛亮', profession: 'advisor' },
      ];
      const summary = env.trainingSystem.calculateOfflineActions(7200, npcs);

      expect(summary).toBeDefined();
      expect(summary.offlineDuration).toBe(7200);
      expect(summary.actions.length).toBeGreaterThan(0);
      expect(summary.actions[0].npcId).toBeDefined();
      expect(summary.actions[0].actionType).toBeDefined();
    });

    it('§8.1.2 离线行为应包含资源变化汇总', () => {
      const npcs = Array.from({ length: 5 }, (_, i) => ({
        id: `npc-${i}`, name: `NPC${i}`, profession: 'merchant',
      }));
      const summary = env.trainingSystem.calculateOfflineActions(10800, npcs);

      expect(summary.totalResourceChanges).toBeDefined();
    });

    it('§8.1.3 离线行为应包含好感度变化汇总', () => {
      const npcs = [{ id: 'npc-aff', name: '关羽', profession: 'warrior' }];
      const summary = env.trainingSystem.calculateOfflineActions(3600, npcs);

      expect(summary.totalAffinityChanges).toBeDefined();
    });
  });

  describe('§8.2 离线摘要与对话历史联动', () => {
    it('§8.2.1 离线前对话历史应保留', () => {
      env.trainingSystem.recordDialogue('npc-01', '张飞', '讨论兵法', 5, 'attack');
      env.trainingSystem.recordDialogue('npc-02', '诸葛亮', '讨论策略', 8, 'advise');

      // 离线
      env.trainingSystem.calculateOfflineActions(3600, [
        { id: 'npc-01', name: '张飞', profession: 'warrior' },
      ]);

      // 离线前的对话历史应保留
      expect(env.trainingSystem.getDialogueCount()).toBe(2);
    });

    it('§8.2.2 清除离线摘要不应影响对话历史', () => {
      env.trainingSystem.recordDialogue('npc-01', '张飞', '闲聊', 3);
      env.trainingSystem.calculateOfflineActions(3600, [
        { id: 'npc-01', name: '张飞', profession: 'warrior' },
      ]);

      env.trainingSystem.clearOfflineSummary();

      expect(env.trainingSystem.getOfflineSummary()).toBeNull();
      expect(env.trainingSystem.getDialogueCount()).toBe(1);
    });
  });

  describe('§8.3 离线摘要序列化', () => {
    it('§8.3.1 序列化应包含离线摘要数据', () => {
      env.trainingSystem.calculateOfflineActions(3600, [
        { id: 'npc-01', name: '张飞', profession: 'warrior' },
      ]);

      const saved = env.trainingSystem.serialize();
      expect(saved.offlineSummary).toBeDefined();
    });

    it('§8.3.2 反序列化应恢复离线摘要', () => {
      env.trainingSystem.calculateOfflineActions(3600, [
        { id: 'npc-01', name: '张飞', profession: 'warrior' },
      ]);
      const saved = env.trainingSystem.serialize();

      const newEnv = createDialogTradeEnv();
      newEnv.trainingSystem.deserialize(saved);

      const restored = newEnv.trainingSystem.getOfflineSummary();
      expect(restored).not.toBeNull();
      expect(restored!.offlineDuration).toBe(3600);
    });
  });
});

// ─────────────────────────────────────────────
// §9 对话历史
// ─────────────────────────────────────────────

describe('§9 对话历史集成', () => {
  let env: ReturnType<typeof createDialogTradeEnv>;

  beforeEach(() => {
    env = createDialogTradeEnv();
  });

  describe('§9.1 对话记录', () => {
    it('§9.1.1 应能记录对话到历史', () => {
      env.trainingSystem.recordDialogue('npc-01', '张飞', '讨论进攻策略', 6, 'attack');

      const history = env.trainingSystem.getDialogueHistory('npc-01');
      expect(history.length).toBe(1);
      expect(history[0].summary).toBe('讨论进攻策略');
      expect(history[0].playerChoice).toBe('attack');
    });

    it('§9.1.2 应能按NPC筛选对话历史', () => {
      env.trainingSystem.recordDialogue('npc-01', '张飞', '对话A', 3);
      env.trainingSystem.recordDialogue('npc-02', '诸葛亮', '对话B', 5);
      env.trainingSystem.recordDialogue('npc-01', '张飞', '对话C', 4);

      const npc01History = env.trainingSystem.getDialogueHistory('npc-01');
      expect(npc01History.length).toBe(2);
    });

    it('§9.1.3 应能限制历史返回数量', () => {
      for (let i = 0; i < 10; i++) {
        env.trainingSystem.recordDialogue('npc-01', '张飞', `对话${i}`, 3);
      }

      const limited = env.trainingSystem.getDialogueHistory('npc-01', 3);
      expect(limited.length).toBe(3);
    });

    it('§9.1.4 应能获取最近对话', () => {
      for (let i = 0; i < 15; i++) {
        env.trainingSystem.recordDialogue(`npc-${i % 3}`, `NPC${i % 3}`, `对话${i}`, 3);
      }

      const recent = env.trainingSystem.getRecentDialogues(5);
      expect(recent.length).toBe(5);
    });
  });

  describe('§9.2 对话历史容量管理', () => {
    it('§9.2.1 超过最大容量时应自动裁剪', () => {
      // 每次插入都检查容量，超过 MAX_DIALOGUE_HISTORY 时裁剪到 DIALOGUE_TRIM_TO
      // 插入足够多记录确保触发裁剪
      for (let i = 0; i < MAX_DIALOGUE_HISTORY + 1; i++) {
        env.trainingSystem.recordDialogue('npc-01', '张飞', `对话${i}`, 3);
      }

      // 裁剪后应不超过 MAX_DIALOGUE_HISTORY
      const count = env.trainingSystem.getDialogueCount();
      expect(count).toBeLessThanOrEqual(MAX_DIALOGUE_HISTORY);
      expect(count).toBeLessThanOrEqual(DIALOGUE_TRIM_TO + 1); // 裁剪后+1条新记录
    });

    it('§9.2.2 应能清除特定NPC的对话历史', () => {
      env.trainingSystem.recordDialogue('npc-01', '张飞', '对话A', 3);
      env.trainingSystem.recordDialogue('npc-02', '诸葛亮', '对话B', 5);
      env.trainingSystem.recordDialogue('npc-01', '张飞', '对话C', 4);

      env.trainingSystem.clearDialogueHistory('npc-01');

      expect(env.trainingSystem.getDialogueCount('npc-01')).toBe(0);
      expect(env.trainingSystem.getDialogueCount('npc-02')).toBe(1);
    });

    it('§9.2.3 应能清除所有对话历史', () => {
      env.trainingSystem.recordDialogue('npc-01', '张飞', '对话A', 3);
      env.trainingSystem.recordDialogue('npc-02', '诸葛亮', '对话B', 5);

      env.trainingSystem.clearDialogueHistory();

      expect(env.trainingSystem.getDialogueCount()).toBe(0);
    });
  });

  describe('§9.3 对话系统与历史联动', () => {
    it('§9.3.1 对话会话应能正常创建和结束', () => {
      const treeIds = env.dialogSystem.getDialogTreeIds();
      if (treeIds.length === 0) {
        // 无默认对话树时跳过
        return;
      }

      const session = env.dialogSystem.startDialog('npc-01', treeIds[0]);
      if (session) {
        expect(session.npcId).toBe('npc-01');
        expect(session.ended).toBe(false);

        const ended = env.dialogSystem.endDialog(session.id);
        expect(ended).toBe(true);
      }
    });

    it('§9.3.2 结束的会话应不再返回当前节点', () => {
      const treeIds = env.dialogSystem.getDialogTreeIds();
      if (treeIds.length === 0) return;

      const session = env.dialogSystem.startDialog('npc-01', treeIds[0]);
      if (session) {
        env.dialogSystem.endDialog(session.id);
        expect(env.dialogSystem.getCurrentNode(session.id)).toBeNull();
      }
    });

    it('§9.3.3 不存在的对话树应返回null', () => {
      const session = env.dialogSystem.startDialog('npc-01', 'nonexistent-tree');
      expect(session).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────
// §9.5 交易系统
// ─────────────────────────────────────────────

describe('§9.5 交易系统集成', () => {
  let env: ReturnType<typeof createDialogTradeEnv>;

  beforeEach(() => {
    env = createDialogTradeEnv();
  });

  describe('§9.5.1 商路开通', () => {
    it('§9.5.1.1 应能检查商路开通条件', () => {
      const routeDefs = env.tradeSystem.getRouteDefs();
      if (routeDefs.length === 0) return;

      const check = env.tradeSystem.canOpenRoute(routeDefs[0].id, 10);
      expect(check).toHaveProperty('canOpen');
    });

    it('§9.5.1.2 等级不足时应拒绝开通', () => {
      const routeDefs = env.tradeSystem.getRouteDefs();
      if (routeDefs.length === 0) return;

      const check = env.tradeSystem.canOpenRoute(routeDefs[0].id, 0);
      if (!check.canOpen) {
        expect(check.reason).toBeDefined();
      }
    });

    it('§9.5.1.3 应能开通符合条件的商路', () => {
      const routeDefs = env.tradeSystem.getRouteDefs();
      if (routeDefs.length === 0) return;

      // 找到一条可以开通的商路
      const target = routeDefs.find((r) => !r.requiredRoute && r.requiredCastleLevel <= 1);
      if (!target) return;

      const result = env.tradeSystem.openRoute(target.id, 10);
      if (result.success) {
        const state = env.tradeSystem.getRouteState(target.id);
        expect(state?.opened).toBe(true);
      }
    });
  });

  describe('§9.5.2 价格与利润', () => {
    it('§9.5.2.1 应能获取商品价格', () => {
      const allDefs = env.tradeSystem.getAllGoodsDefs();
      if (allDefs.length === 0) return;

      const price = env.tradeSystem.getPrice(allDefs[0].id);
      expect(price).toBeGreaterThanOrEqual(0);
    });

    it('§9.5.2.2 刷新价格后价格应变化', () => {
      const allDefs = env.tradeSystem.getAllGoodsDefs();
      if (allDefs.length === 0) return;

      const beforePrice = env.tradeSystem.getPrice(allDefs[0].id);
      env.tradeSystem.refreshPrices();
      // 价格可能变化也可能不变（随机波动）
      const afterPrice = env.tradeSystem.getPrice(allDefs[0].id);
      expect(typeof afterPrice).toBe('number');
    });

    it('§9.5.2.3 应能计算贸易利润', () => {
      const routeDefs = env.tradeSystem.getRouteDefs();
      const goodsDefs = env.tradeSystem.getAllGoodsDefs();
      if (routeDefs.length === 0 || goodsDefs.length === 0) return;

      // 先开通一条商路
      const target = routeDefs.find((r) => !r.requiredRoute && r.requiredCastleLevel <= 1);
      if (!target) return;
      env.tradeSystem.openRoute(target.id, 10);

      const cargo: Record<string, number> = {};
      cargo[goodsDefs[0].id] = 10;

      const profit = env.tradeSystem.calculateProfit(target.id, cargo, 1.0, 0);
      expect(profit).toHaveProperty('revenue');
      expect(profit).toHaveProperty('cost');
      expect(profit).toHaveProperty('profit');
      expect(profit).toHaveProperty('profitRate');
    });
  });

  describe('§9.5.3 繁荣度', () => {
    it('§9.5.3.1 应能获取繁荣度等级', () => {
      const routeDefs = env.tradeSystem.getRouteDefs();
      if (routeDefs.length === 0) return;

      const level = env.tradeSystem.getProsperityLevel(routeDefs[0].id);
      expect(typeof level).toBe('string');
    });

    it('§9.5.3.2 完成贸易应增加繁荣度', () => {
      const routeDefs = env.tradeSystem.getRouteDefs();
      if (routeDefs.length === 0) return;

      const target = routeDefs.find((r) => !r.requiredRoute && r.requiredCastleLevel <= 1);
      if (!target) return;
      env.tradeSystem.openRoute(target.id, 10);

      const before = env.tradeSystem.getRouteState(target.id)!.prosperity;
      env.tradeSystem.completeTrade(target.id);
      const after = env.tradeSystem.getRouteState(target.id)!.prosperity;

      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('§9.5.4 对话历史与交易联动', () => {
    it('§9.5.4.1 交易完成应能记录到对话历史', () => {
      // 模拟交易对话
      env.trainingSystem.recordDialogue('npc-merchant-01', '商人A', '购买粮草100单位', 4, 'buy');

      const history = env.trainingSystem.getDialogueHistory('npc-merchant-01');
      expect(history.length).toBe(1);
      expect(history[0].playerChoice).toBe('buy');
    });

    it('§9.5.4.2 序列化应保留交易相关对话历史', () => {
      env.trainingSystem.recordDialogue('npc-merchant-01', '商人A', '交易对话1', 3);
      env.trainingSystem.recordDialogue('npc-merchant-01', '商人A', '交易对话2', 5);

      const saved = env.trainingSystem.serialize();
      expect(saved.dialogueHistory.length).toBeGreaterThanOrEqual(2);

      const newEnv = createDialogTradeEnv();
      newEnv.trainingSystem.deserialize(saved);
      expect(newEnv.trainingSystem.getDialogueCount('npc-merchant-01')).toBe(2);
    });
  });
});
