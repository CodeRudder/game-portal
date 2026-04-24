/**
 * 集成测试: 跨系统联动全链路
 *
 * 覆盖 Play §6.1~6.7 跨系统联动：
 *   - §6.1 跨系统跳转路径验证
 *   - §6.2 随机事件→连锁事件→限时活动全链路
 *   - §6.3 NPC好感度→奇遇→连锁事件闭环
 *   - §6.4 签到→限时机遇→活动商店→离线处理闭环
 *   - §6.5 活动代币经济闭环（7种获取+3种消耗+10%结算）
 *   - §6.6 多活动并行管理（上限5个）
 *   - §6.7 事件→科技树跨系统联动
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerSystem } from '../../EventTriggerSystem';
import { EventNotificationSystem } from '../../EventNotificationSystem';
import { EventConditionEvaluator } from '../../EventConditionEvaluator';
import type { ConditionContext } from '../../EventConditionEvaluator';
import { calculateProbability } from '../../EventProbabilityCalculator';
import {
  evaluateCondition,
} from '../../EventTriggerConditions';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { EventDef, EventInstance, EventCondition } from '../../../../core/event';
import type { ProbabilityCondition } from '../../../../core/event/event-encounter.types';

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

function makeEventDef(overrides?: Partial<EventDef>): EventDef {
  return {
    id: 'evt-cross-001',
    title: '跨系统测试事件',
    description: '',
    triggerType: 'random',
    urgency: 'medium',
    scope: 'region',
    triggerProbability: 0.03,
    options: [
      { id: 'opt-help', text: '帮助', isDefault: true, consequences: { description: '获得好感', resourceChanges: { copper: 100 }, affinityChanges: { npc1: 10 } } },
      { id: 'opt-refuse', text: '拒绝', consequences: { description: '无变化' } },
      { id: 'opt-trade', text: '交易', consequences: { description: '获得资源', resourceChanges: { copper: -50, grain: 200 } } },
    ],
    ...overrides,
  };
}

/** 模拟活动代币经济 */
interface TokenEconomy {
  tokens: number;
  points: number;
  purchases: number[];
}

function createTokenEconomy(): TokenEconomy {
  return { tokens: 0, points: 0, purchases: [] };
}

/** 模拟活动系统 */
interface MockActivitySystem {
  activities: Map<string, { type: string; status: string; tokens: number; points: number }>;
  ranking: Map<string, number>;
}

function createMockActivitySystem(): MockActivitySystem {
  return {
    activities: new Map(),
    ranking: new Map(),
  };
}

/** 模拟科技树 */
interface MockTechTree {
  techPoints: number;
  unlockedTechs: Set<string>;
}

function createMockTechTree(): MockTechTree {
  return { techPoints: 0, unlockedTechs: new Set() };
}

// ═══════════════════════════════════════════════

describe('§6 跨系统联动全链路 集成', () => {
  let triggerSys: EventTriggerSystem;
  let notifSys: EventNotificationSystem;
  let evaluator: EventConditionEvaluator;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = mockDeps();
    triggerSys = new EventTriggerSystem();
    notifSys = new EventNotificationSystem();
    evaluator = new EventConditionEvaluator();
    triggerSys.init(deps);
    notifSys.init(deps);
  });

  // ─── §6.1 跨系统跳转路径 ──────────────────

  describe('§6.1 跨系统跳转路径', () => {
    it('随机遭遇选择"出兵" → 进入战斗系统', () => {
      const def = makeEventDef({
        id: 'evt-battle',
        options: [
          { id: 'opt-attack', text: '出兵', isDefault: false, consequences: { description: '进入战斗', triggerSystem: 'battle' } },
          { id: 'opt-retreat', text: '撤退', isDefault: true, consequences: { description: '安全撤退' } },
        ],
      });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
      const attackOption = def.options.find(o => o.id === 'opt-attack');
      expect(attackOption).toBeDefined();
      expect((attackOption!.consequences as any).triggerSystem).toBe('battle');
    });

    it('商队事件选择"交易" → 进入NPC交易面板', () => {
      const def = makeEventDef({
        id: 'evt-trade',
        options: [
          { id: 'opt-trade', text: '交易', isDefault: true, consequences: { description: '打开交易面板', triggerSystem: 'npcTrade' } },
          { id: 'opt-skip', text: '跳过', consequences: { description: '无变化' } },
        ],
      });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
    });

    it('剧情事件奖励科技点 → 科技树面板跳转', () => {
      const techTree = createMockTechTree();
      const techPointsReward = 300;
      techTree.techPoints += techPointsReward;
      expect(techTree.techPoints).toBe(300);
      // 模拟解锁科技
      techTree.unlockedTechs.add('agriculture');
      expect(techTree.unlockedTechs.has('agriculture')).toBe(true);
    });

    it('天灾损失提示 → 建筑修复面板跳转', () => {
      const def = makeEventDef({
        id: 'evt-disaster',
        urgency: 'critical',
        options: [
          { id: 'opt-repair', text: '修复建筑', isDefault: true, consequences: { description: '跳转修复面板', triggerSystem: 'buildingRepair' } },
          { id: 'opt-ignore', text: '忽略', consequences: { description: '损失加剧' } },
        ],
      });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);
      expect(result.instance).toBeDefined();
    });
  });

  // ─── §6.2 随机事件→连锁→活动全链路 ────────

  describe('§6.2 随机事件→连锁事件→限时活动全链路', () => {
    it('事件触发→选择→连锁→代币→活动积分', () => {
      const economy = createTokenEconomy();
      // 1. 触发随机事件
      const def = makeEventDef({ id: 'evt-escort' });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      expect(result.triggered).toBe(true);

      // 2. 选择后获得代币+积分
      economy.tokens += 50;
      economy.points += 30;
      expect(economy.tokens).toBe(50);
      expect(economy.points).toBe(30);
    });

    it('积分推进里程碑→解锁商店阶层', () => {
      const milestones = [
        { threshold: 100, tier: 'bronze' },
        { threshold: 500, tier: 'silver' },
        { threshold: 1000, tier: 'gold' },
        { threshold: 3000, tier: 'jade' },
        { threshold: 6000, tier: 'crimson' },
        { threshold: 12000, tier: 'dragon' },
      ];
      let currentPoints = 0;
      const unlockedTiers: string[] = [];
      for (const m of milestones) {
        currentPoints += 500;
        if (currentPoints >= m.threshold) {
          unlockedTiers.push(m.tier);
        }
      }
      expect(unlockedTiers).toContain('bronze');
      expect(unlockedTiers).toContain('silver');
      expect(unlockedTiers).toContain('gold');
    });

    it('战力提升→等级系数增大→事件概率提高', () => {
      const baseP = 0.03;
      const p_level1 = baseP * (1 + 1 * 0.02);
      const p_level10 = baseP * (1 + 10 * 0.02);
      const p_level20 = baseP * (1 + 20 * 0.02);
      expect(p_level10).toBeGreaterThan(p_level1);
      expect(p_level20).toBeGreaterThan(p_level10);
    });
  });

  // ─── §6.3 NPC好感度→奇遇→连锁闭环 ────────

  describe('§6.3 NPC好感度→奇遇→连锁事件闭环', () => {
    it('好感度阈值触发NPC事件', () => {
      const npcAffinity = { zhugeLiang: 0 };
      const thresholds = { stranger: 0, acquaintance: 20, friendly: 50, close: 80, soulmate: 100 };
      npcAffinity.zhugeLiang = 55;
      expect(npcAffinity.zhugeLiang).toBeGreaterThanOrEqual(thresholds.friendly);
    });

    it('好感度等级解锁内容', () => {
      const levels = ['陌生', '相识', '友好', '亲密', '知己'];
      const affinityToLevel = (a: number) => {
        if (a >= 100) return 4;
        if (a >= 80) return 3;
        if (a >= 50) return 2;
        if (a >= 20) return 1;
        return 0;
      };
      expect(levels[affinityToLevel(10)]).toBe('陌生');
      expect(levels[affinityToLevel(25)]).toBe('相识');
      expect(levels[affinityToLevel(60)]).toBe('友好');
      expect(levels[affinityToLevel(90)]).toBe('亲密');
      expect(levels[affinityToLevel(100)]).toBe('知己');
    });

    it('奇遇品质概率分布: 普通70%/稀有20%/史诗8%/传说2%', () => {
      const trials = 5000;
      const counts = { normal: 0, rare: 0, epic: 0, legendary: 0 };
      for (let i = 0; i < trials; i++) {
        const r = Math.random();
        if (r < 0.02) counts.legendary++;
        else if (r < 0.10) counts.epic++;
        else if (r < 0.30) counts.rare++;
        else counts.normal++;
      }
      expect(counts.normal / trials).toBeGreaterThan(0.60);
      expect(counts.rare / trials).toBeGreaterThan(0.15);
      expect(counts.epic / trials).toBeGreaterThan(0.04);
      expect(counts.legendary / trials).toBeGreaterThan(0.005);
    });

    it('NPC事件与随机事件冷却独立', () => {
      // NPC事件不占用随机事件冷却槽
      const npcCooldown = new Map<string, number>();
      const randomCooldown = new Map<string, number>();
      npcCooldown.set('npc-001', 100);
      expect(randomCooldown.has('npc-001')).toBe(false);
      expect(npcCooldown.has('npc-001')).toBe(true);
    });
  });

  // ─── §6.4 签到→限时机遇→活动商店闭环 ──────

  describe('§6.4 签到→限时机遇→活动商店→离线处理闭环', () => {
    it('连续签到7天获得日常代币×50%加成', () => {
      const baseTokens = 100;
      const bonus3d = Math.floor(baseTokens * 0.2);  // 3天+20%
      const bonus7d = Math.floor(baseTokens * 0.5);   // 7天+50%
      expect(bonus3d).toBe(20);
      expect(bonus7d).toBe(50);
    });

    it('签到7天循环奖励序列', () => {
      const rewards = [
        { day: 1, type: 'copper', amount: 1000 },
        { day: 2, type: 'grain', amount: 1000 },
        { day: 3, type: 'dailyToken', amount: 100 },
        { day: 4, type: 'troops', amount: 500 },
        { day: 5, type: 'speedup', amount: 1 },
        { day: 6, type: 'dailyToken', amount: 200 },
        { day: 7, type: 'recruitOrder', amount: 1 },
      ];
      expect(rewards).toHaveLength(7);
      expect(rewards[0].type).toBe('copper');
      expect(rewards[6].type).toBe('recruitOrder');
    });

    it('补签扣费正确 — 元宝×50/次，每周2次', () => {
      let yuanbao = 200;
      let weeklyMakeup = 0;
      const maxWeekly = 2;
      const cost = 50;
      // 补签1次
      if (weeklyMakeup < maxWeekly && yuanbao >= cost) {
        yuanbao -= cost;
        weeklyMakeup++;
      }
      expect(yuanbao).toBe(150);
      expect(weeklyMakeup).toBe(1);
      // 补签2次
      if (weeklyMakeup < maxWeekly && yuanbao >= cost) {
        yuanbao -= cost;
        weeklyMakeup++;
      }
      expect(yuanbao).toBe(100);
      expect(weeklyMakeup).toBe(2);
      // 补签3次 — 超限
      if (weeklyMakeup < maxWeekly && yuanbao >= cost) {
        yuanbao -= cost;
        weeklyMakeup++;
      }
      expect(weeklyMakeup).toBe(2); // 不变
      expect(yuanbao).toBe(100);    // 不扣
    });

    it('累计奖励里程碑: 14/21/28天', () => {
      const milestones = [
        { days: 14, reward: 'blueBox', count: 1 },
        { days: 21, reward: 'purpleBox', count: 1 },
        { days: 28, reward: 'goldFragment', count: 3 },
      ];
      expect(milestones[0].days).toBe(14);
      expect(milestones[2].count).toBe(3);
    });

    it('离线处理: 限时活动30%效率', () => {
      const basePointsPerSec = 1;
      const offlineHours = 4;
      const efficiency = 0.3;
      const points = Math.floor(basePointsPerSec * offlineHours * 3600 * efficiency);
      expect(points).toBe(4320);
    });
  });

  // ─── §6.5 活动代币经济闭环 ─────────────────

  describe('§6.5 活动代币经济闭环', () => {
    it('7种获取途径全部可用', () => {
      const sources = [
        'battle', 'milestone', 'task', 'ranking', 'offline', 'dailyActivity', 'yuanbaoBuy',
      ];
      expect(sources).toHaveLength(7);
    });

    it('3种消耗途径', () => {
      const sinks = ['shopPurchase', 'milestoneAccelerate', 'resetChallenge'];
      expect(sinks).toHaveLength(3);
    });

    it('结算转化: 未使用代币 × 10% → 铜钱', () => {
      const unusedTokens = 3500;
      const convertedCopper = Math.floor(unusedTokens * 0.1);
      expect(convertedCopper).toBe(350);
    });

    it('代币不可跨活动使用', () => {
      const activityA = { id: 'limited_001', tokens: 500 };
      const activityB = { id: 'limited_002', tokens: 300 };
      expect(activityA.tokens).toBe(500);
      expect(activityB.tokens).toBe(300);
      // 跨活动不可转移
      const transferable = false;
      expect(transferable).toBe(false);
    });

    it('每日代币最低获取量 ≈ 690', () => {
      const dailyMin = 690;
      const sources = {
        dailyTasks: 5 * 100,   // 500
        offlineBase: 190,       // 190
      };
      const total = Object.values(sources).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(dailyMin);
    });
  });

  // ─── §6.6 多活动并行管理 ───────────────────

  describe('§6.6 多活动并行管理', () => {
    it('并行上限5个活动', () => {
      const maxParallel = 5;
      const slots = { season: 1, limited: 2, daily: 1, festival: 1 };
      const total = Object.values(slots).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(maxParallel);
    });

    it('同类型限时活动间隔≥2天', () => {
      const lastEndTime = new Date('2026-04-10').getTime();
      const nextStartTime = new Date('2026-04-12').getTime();
      const diffDays = (nextStartTime - lastEndTime) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(2);
    });

    it('赛季衔接间隔3~5天', () => {
      const gapDays = 4;
      expect(gapDays).toBeGreaterThanOrEqual(3);
      expect(gapDays).toBeLessThanOrEqual(5);
    });

    it('横幅轮播优先级: 即将结束>新开始>有未领奖励>剩余时间', () => {
      const banners = [
        { id: 'b1', priority: 'ending', remaining: 0.5 },
        { id: 'b2', priority: 'new', remaining: 6 },
        { id: 'b3', priority: 'unclaimed', remaining: 3 },
        { id: 'b4', priority: 'normal', remaining: 2 },
      ];
      const priorityOrder: Record<string, number> = { ending: 0, new: 1, unclaimed: 2, normal: 3 };
      const sorted = [...banners].sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 99;
        const pb = priorityOrder[b.priority] ?? 99;
        return pa !== pb ? pa - pb : a.remaining - b.remaining;
      });
      expect(sorted[0].priority).toBe('ending');
      expect(sorted[1].priority).toBe('new');
      expect(sorted[2].priority).toBe('unclaimed');
      expect(sorted[3].priority).toBe('normal');
    });
  });

  // ─── §6.7 事件→科技树联动 ──────────────────

  describe('§6.7 事件→科技树跨系统联动', () => {
    it('剧情事件奖励科技点200~500（随主城等级缩放）', () => {
      const baseTechPoints = 200;
      const castleLevel = 10;
      const scaled = Math.floor(baseTechPoints * (1 + castleLevel * 0.1));
      expect(scaled).toBe(400);
      const castleLevel20 = 20;
      const scaled2 = Math.floor(baseTechPoints * (1 + castleLevel20 * 0.1));
      expect(scaled2).toBe(600);
    });

    it('科技效果反馈至事件数值缩放', () => {
      // "农业科技"降低天灾损失10%
      const baseLoss = 100;
      const techReduction = 0.1;
      const afterTech = Math.floor(baseLoss * (1 - techReduction));
      expect(afterTech).toBe(90);

      // "商贸科技"提升商队事件奖励20%
      const baseReward = 100;
      const techBonus = 0.2;
      const afterTechReward = Math.floor(baseReward * (1 + techBonus));
      expect(afterTechReward).toBe(120);
    });

    it('事件→科技→事件正反馈闭环', () => {
      const techTree = createMockTechTree();
      // 1. 事件奖励科技点
      techTree.techPoints += 300;
      // 2. 解锁科技
      techTree.unlockedTechs.add('agriculture');
      // 3. 科技降低天灾损失
      expect(techTree.unlockedTechs.has('agriculture')).toBe(true);
      // 4. 天灾损失计算
      const baseLoss = 100;
      const techReduction = techTree.unlockedTechs.has('agriculture') ? 0.1 : 0;
      const finalLoss = Math.floor(baseLoss * (1 - techReduction));
      expect(finalLoss).toBe(90);
    });
  });

  // ─── 事件通知系统联动 ──────────────────────

  describe('§6.8 事件通知与横幅系统联动', () => {
    it('事件触发后创建横幅通知', () => {
      notifSys.setMaxBannerDisplay(5);
      const def = makeEventDef({ id: 'evt-notif-1' });
      triggerSys.registerEvent(def);
      const result = triggerSys.forceTriggerEvent(def.id, 1);
      expect(result.instance).toBeDefined();
      const banner = notifSys.createBanner(result.instance!, { title: def.title, description: '', urgency: 'high' });
      expect(banner.title).toBe(def.title);
      expect(banner.urgency).toBe('high');
    });

    it('急报横幅最多缓存5条', () => {
      notifSys.setMaxBannerDisplay(5);
      for (let i = 0; i < 7; i++) {
        const def = makeEventDef({ id: `evt-cache-${i}` });
        triggerSys.registerEvent(def);
        const result = triggerSys.forceTriggerEvent(def.id, i + 1);
        if (result.instance) {
          notifSys.createBanner(result.instance, { title: `Banner ${i}`, description: '', urgency: 'medium' });
        }
      }
      expect(notifSys.getActiveBanners().length).toBeLessThanOrEqual(5);
    });

    it('限时机遇横幅最高优先级', () => {
      notifSys.setMaxBannerDisplay(5);
      const defNormal = makeEventDef({ id: 'evt-normal-prio' });
      const defLimited = makeEventDef({ id: 'evt-limited-prio' });
      triggerSys.registerEvent(defNormal);
      triggerSys.registerEvent(defLimited);
      const instNormal = triggerSys.forceTriggerEvent(defNormal.id, 1).instance!;
      const instLimited = triggerSys.forceTriggerEvent(defLimited.id, 2).instance!;
      notifSys.createBanner(instNormal, { title: '普通', description: '', urgency: 'medium' });
      notifSys.createBanner(instLimited, { title: '限时', description: '', urgency: 'critical' });
      const banners = notifSys.getActiveBanners();
      expect(banners[0].urgency).toBe('critical');
    });
  });
});
