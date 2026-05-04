/**
 * E1-4 离线→上线→奖励弹窗→资源更新 E2E集成测试
 *
 * 覆盖完整离线奖励生命周期:
 *   离线(时间流逝) → 上线检测 → OfflineRewardSystem 计算6档衰减快照
 *   → OfflineEventSystem 生成事件 → 奖励弹窗数据 → 领取(防重复) → 资源更新
 *
 * 使用真实 EventBus (非 mock) 串联各系统,
 * 使用 vi.useFakeTimers() 控制离线时间流逝。
 *
 * 测试场景:
 *   场景1: 正常离线8小时 → 计算奖励 → 奖励 = 领土产出 * 时长 * 衰减系数
 *   场景2: 离线时间过短(< 5分钟) → 无奖励或最低奖励
 *   场景3: 离线时间过长(> 72小时) → 奖励封顶72小时
 *   场景4: 多资源类型(粮草/金币/兵力/天命)分别计算
 *   场景5: 领土数量影响奖励(1城 vs 5城)
 *   场景6: 领取后资源确实更新 + 防重复领取
 *   场景7: VIP等级影响离线奖励加成
 *
 * @module engine/map/__tests__/integration/offline-e2e
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineRewardSystem } from '../../../offline/OfflineRewardSystem';
import { OfflineEventSystem } from '../../OfflineEventSystem';
import { EventBus } from '../../../../core/events/EventBus';
import type { Resources } from '../../../../shared/types';
import type { OfflineRewardResultV9 } from '../../../offline/offline.types';
import { MAX_OFFLINE_SECONDS, DECAY_TIERS } from '../../../offline/offline-config';

// ─────────────────────────────────────────────
// 辅助函数与常量
// ─────────────────────────────────────────────

const HOUR_S = 3600;
const MIN_S = 60;

/** 创建零资源对象 */
function zeroRes(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 };
}

/** 创建无限大资源上限 */
function infiniteCaps(): Record<string, number | null> {
  return { grain: null, gold: null, troops: null, mandate: null };
}

/** 创建有限资源上限 */
function limitedCaps(grain: number = 100000, gold: number = 100000, troops: number = 100000): Record<string, number | null> {
  return { grain, gold, troops, mandate: null };
}

/**
 * 手动计算期望收益（用于验证）
 *
 * 按 DECAY_TIERS 分段计算: 产出速率 * 各档位秒数 * 档位效率
 */
function calculateExpectedEarned(
  offlineSeconds: number,
  productionRates: Readonly<Resources>,
): Resources {
  const earned = zeroRes();
  const effectiveSeconds = Math.min(offlineSeconds, MAX_OFFLINE_SECONDS);
  const effectiveHours = effectiveSeconds / 3600;

  for (const tier of DECAY_TIERS) {
    if (effectiveHours <= tier.startHours) break;
    const tierStartSec = tier.startHours * 3600;
    const tierEndSec = tier.endHours * 3600;
    const tierSeconds = Math.min(effectiveSeconds, tierEndSec) - tierStartSec;
    if (tierSeconds <= 0) continue;

    for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
      earned[key] += productionRates[key] * tierSeconds * tier.efficiency;
    }
  }

  // 取整
  for (const key of Object.keys(earned) as (keyof Resources)[]) {
    earned[key] = Math.floor(earned[key]);
  }

  return earned;
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('E1-4 离线→上线→奖励弹窗→资源更新 E2E集成测试', () => {
  let rewardSystem: OfflineRewardSystem;
  let eventSystem: OfflineEventSystem;
  let eventBus: EventBus;
  let emittedEvents: Array<{ event: string; payload: unknown }>;

  beforeEach(() => {
    vi.useFakeTimers();

    // 创建真实 EventBus，捕获所有 emit 事件
    eventBus = new EventBus();
    emittedEvents = [];
    const originalEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = (event: string, payload: unknown) => {
      emittedEvents.push({ event, payload });
      originalEmit(event, payload);
    };

    // 初始化离线奖励系统
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.init({
      eventBus,
      registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
      config: { get: vi.fn() },
    } as any);

    // 初始化离线事件系统
    eventSystem = new OfflineEventSystem();
    eventSystem.init({
      eventBus,
      registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
      config: { get: vi.fn() },
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    eventBus.removeAllListeners();
  });

  // ═══════════════════════════════════════════
  // 场景1: 正常离线8小时 → 奖励 = 产出 * 时长 * 衰减
  // ═══════════════════════════════════════════

  describe('场景1: 正常离线8小时', () => {
    it('应该按6档衰减计算奖励 = 领土产出 * 时长 * 衰减系数', () => {
      // 1. 设定产出速率: grain=10/s, gold=5/s, troops=2/s, mandate=1/s
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      // 2. 离线8小时
      const offlineSeconds = 8 * HOUR_S;

      // 3. 计算快照
      const snapshot = rewardSystem.calculateSnapshot(offlineSeconds, productionRates);

      // 4. 验证快照结构
      expect(snapshot.offlineSeconds).toBe(offlineSeconds);
      expect(snapshot.isCapped).toBe(false);
      expect(snapshot.tierDetails.length).toBeGreaterThan(0);

      // 5. 手动验证衰减分段:
      //    tier1: 0~2h (7200s), 100% → 10*7200*1.0 = 72000 grain
      //    tier2: 2~8h (21600s), 80% → 10*21600*0.8 = 172800 grain
      //    total grain = 72000 + 172800 = 244800
      const expectedGrain = calculateExpectedEarned(offlineSeconds, productionRates).grain;
      expect(snapshot.totalEarned.grain).toBe(expectedGrain);

      // 6. 验证 gold/troops/mandate 也按相同衰减系数计算
      const expected = calculateExpectedEarned(offlineSeconds, productionRates);
      expect(snapshot.totalEarned.gold).toBe(expected.gold);
      expect(snapshot.totalEarned.troops).toBe(expected.troops);
      expect(snapshot.totalEarned.mandate).toBe(expected.mandate);

      // 7. 验证综合效率
      // 加权: (7200*1.0 + 21600*0.8) / 28800 = (7200 + 17280) / 28800 = 0.85
      expect(snapshot.overallEfficiency).toBeCloseTo(0.85, 3);

      // 8. 完整奖励计算
      const currentResources = zeroRes();
      const result = rewardSystem.calculateFullReward(
        offlineSeconds, productionRates, currentResources, infiniteCaps(), 0, 'building',
      );

      // building modifier = 1.2, VIP level 0 → no VIP bonus
      // systemModifiedEarned = snapshot.totalEarned * 1.2
      expect(result.systemModifiedEarned.grain).toBe(Math.floor(expected.grain * 1.2));
      expect(result.cappedEarned.grain).toBe(result.systemModifiedEarned.grain); // 无上限

      // 9. 领取奖励
      const claimed = rewardSystem.claimReward(result);
      expect(claimed).not.toBeNull();
      expect(claimed!.grain).toBe(result.cappedEarned.grain);
      expect(claimed!.gold).toBe(result.cappedEarned.gold);
    });

    it('应该通过真实EventBus触发离线事件并传递给OfflineEventSystem', () => {
      // 设置1个玩家城市
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 5 },
      ]);

      // 记录上线时间
      const onlineTime = Date.now();
      eventSystem.heartbeat();

      // 模拟8小时离线
      vi.advanceTimersByTime(8 * HOUR_S * 1000);

      // 玩家上线: 处理离线时间
      const reward = eventSystem.processOfflineTime();

      // 验证 EventBus 收到 offline:processed 事件
      const offlineEvents = emittedEvents.filter(e => e.event === 'offline:processed');
      expect(offlineEvents.length).toBe(1);

      const emittedPayload = offlineEvents[0].payload as any;
      expect(emittedPayload.offlineDuration).toBeGreaterThan(0);
      expect(emittedPayload.offlineDuration).toBeLessThanOrEqual(8 * HOUR_S);
      expect(emittedPayload.resources.gold).toBeGreaterThan(0);
      expect(emittedPayload.resources.grain).toBeGreaterThan(0);

      // 验证奖励数据
      expect(reward.offlineDuration).toBeGreaterThan(0);
      expect(reward.resources.gold).toBeGreaterThan(0);
      expect(reward.resources.grain).toBeGreaterThan(0);
      expect(reward.resources.troops).toBeGreaterThan(0);
      expect(reward.events.length).toBeGreaterThan(0);

      // 至少有 resource_accumulate 事件
      const resourceEvents = reward.events.filter(e => e.type === 'resource_accumulate');
      expect(resourceEvents.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // 场景2: 离线时间过短 (< 5分钟)
  // ═══════════════════════════════════════════

  describe('场景2: 离线时间过短', () => {
    it('OfflineEventSystem: 离线 < 10秒 → 无奖励', () => {
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 5 },
      ]);
      eventSystem.heartbeat();

      // 离线5秒
      vi.advanceTimersByTime(5 * 1000);

      const reward = eventSystem.processOfflineTime();
      expect(reward.offlineDuration).toBe(0);
      expect(reward.resources).toEqual({});
      expect(reward.events).toEqual([]);
    });

    it('OfflineRewardSystem: 离线0秒 → 快照返回零收益', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const snapshot = rewardSystem.calculateSnapshot(0, productionRates);
      expect(snapshot.offlineSeconds).toBe(0);
      expect(snapshot.totalEarned.grain).toBe(0);
      expect(snapshot.totalEarned.gold).toBe(0);
      expect(snapshot.overallEfficiency).toBe(0);
      expect(snapshot.tierDetails.length).toBe(0);
    });

    it('OfflineRewardSystem: 离线负数 → NaN防护返回零收益', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const snapshot = rewardSystem.calculateSnapshot(-100, productionRates);
      expect(snapshot.offlineSeconds).toBe(0);
      expect(snapshot.totalEarned.grain).toBe(0);
    });

    it('OfflineRewardSystem: 离线1分钟 → 仅tier1(100%效率)极少收益', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 0,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const offlineSeconds = 1 * MIN_S; // 60秒
      const snapshot = rewardSystem.calculateSnapshot(offlineSeconds, productionRates);

      // 60秒全部在 tier1 (0~2h, 100%)
      expect(snapshot.tierDetails.length).toBe(1);
      expect(snapshot.tierDetails[0].tierId).toBe('tier1');
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);

      // grain = 10 * 60 * 1.0 = 600
      expect(snapshot.totalEarned.grain).toBe(600);
      expect(snapshot.totalEarned.gold).toBe(300);
      expect(snapshot.totalEarned.troops).toBe(120);
    });
  });

  // ═══════════════════════════════════════════
  // 场景3: 离线时间过长 (> 72小时) → 奖励封顶
  // ═══════════════════════════════════════════

  describe('场景3: 离线时间过长 → 奖励封顶72小时', () => {
    it('OfflineRewardSystem: 离线100小时 → 封顶72小时 + isCapped=true', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const offlineSeconds100h = 100 * HOUR_S;
      const snapshot = rewardSystem.calculateSnapshot(offlineSeconds100h, productionRates);

      // 标记封顶
      expect(snapshot.isCapped).toBe(true);

      // 与72小时的收益完全相同
      const offlineSeconds72h = MAX_OFFLINE_SECONDS;
      const snapshot72h = rewardSystem.calculateSnapshot(offlineSeconds72h, productionRates);

      expect(snapshot.totalEarned.grain).toBe(snapshot72h.totalEarned.grain);
      expect(snapshot.totalEarned.gold).toBe(snapshot72h.totalEarned.gold);
      expect(snapshot.totalEarned.troops).toBe(snapshot72h.totalEarned.troops);
      expect(snapshot.totalEarned.mandate).toBe(snapshot72h.totalEarned.mandate);
    });

    it('OfflineRewardSystem: 72小时收益应包含5个衰减档位', () => {
      const productionRates: Resources = {
        grain: 1, gold: 1, troops: 1, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const snapshot = rewardSystem.calculateSnapshot(MAX_OFFLINE_SECONDS, productionRates);

      // 72小时 = 5个档位全覆盖
      expect(snapshot.tierDetails.length).toBe(5);
      expect(snapshot.tierDetails[0].tierId).toBe('tier1'); // 0~2h, 100%
      expect(snapshot.tierDetails[1].tierId).toBe('tier2'); // 2~8h, 80%
      expect(snapshot.tierDetails[2].tierId).toBe('tier3'); // 8~24h, 60%
      expect(snapshot.tierDetails[3].tierId).toBe('tier4'); // 24~48h, 40%
      expect(snapshot.tierDetails[4].tierId).toBe('tier5'); // 48~72h, 20%

      // 综合效率应 < 100% (因为有衰减)
      expect(snapshot.overallEfficiency).toBeLessThan(1.0);
      expect(snapshot.overallEfficiency).toBeGreaterThan(0);

      // 验证各档秒数
      expect(snapshot.tierDetails[0].seconds).toBe(2 * HOUR_S);   // 7200s
      expect(snapshot.tierDetails[1].seconds).toBe(6 * HOUR_S);   // 21600s
      expect(snapshot.tierDetails[2].seconds).toBe(16 * HOUR_S);  // 57600s
      expect(snapshot.tierDetails[3].seconds).toBe(24 * HOUR_S);  // 86400s
      expect(snapshot.tierDetails[4].seconds).toBe(24 * HOUR_S);  // 86400s
    });

    it('OfflineEventSystem: 离线48小时 → 封顶24小时(86400秒)', () => {
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 1 },
      ]);
      eventSystem.heartbeat();

      // 离线48小时
      vi.advanceTimersByTime(48 * HOUR_S * 1000);

      const reward = eventSystem.processOfflineTime();
      // OfflineEventSystem 上限24小时
      expect(reward.offlineDuration).toBeLessThanOrEqual(86400);
    });

    it('OfflineRewardSystem: 封顶72h的收益 < 未封顶24h * 3倍', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 0,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const snapshot24h = rewardSystem.calculateSnapshot(24 * HOUR_S, productionRates);
      const snapshot72h = rewardSystem.calculateSnapshot(72 * HOUR_S, productionRates);

      // 由于衰减, 72h的收益 < 24h收益 * 3
      expect(snapshot72h.totalEarned.grain).toBeLessThan(snapshot24h.totalEarned.grain * 3);
      // 但72h收益 > 24h收益 (因为还有额外48h产出)
      expect(snapshot72h.totalEarned.grain).toBeGreaterThan(snapshot24h.totalEarned.grain);
    });
  });

  // ═══════════════════════════════════════════
  // 场景4: 多资源类型(粮草/金币/兵力/天命)分别计算
  // ═══════════════════════════════════════════

  describe('场景4: 多资源类型分别计算', () => {
    it('grain/gold/troops/mandate 按各自速率独立计算', () => {
      const productionRates: Resources = {
        grain: 100, gold: 50, troops: 20, mandate: 5,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const offlineSeconds = 2 * HOUR_S; // 2h, 刚好在tier1
      const snapshot = rewardSystem.calculateSnapshot(offlineSeconds, productionRates);

      // tier1: 100%, 2h = 7200s
      // grain = 100 * 7200 * 1.0 = 720000
      // gold = 50 * 7200 * 1.0 = 360000
      // troops = 20 * 7200 * 1.0 = 144000
      // mandate = 5 * 7200 * 1.0 = 36000
      expect(snapshot.totalEarned.grain).toBe(720000);
      expect(snapshot.totalEarned.gold).toBe(360000);
      expect(snapshot.totalEarned.troops).toBe(144000);
      expect(snapshot.totalEarned.mandate).toBe(36000);

      // 比例关系
      expect(snapshot.totalEarned.grain / snapshot.totalEarned.gold).toBe(2); // 100/50
      expect(snapshot.totalEarned.gold / snapshot.totalEarned.troops).toBe(2.5); // 50/20
    });

    it('不同衰减档位下各资源独立衰减但比例不变', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 0,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      // 8小时 = tier1(2h,100%) + tier2(6h,80%)
      const snapshot = rewardSystem.calculateSnapshot(8 * HOUR_S, productionRates);

      // 各资源比例保持: grain:gold:troops = 10:5:2
      const grainGoldRatio = snapshot.totalEarned.grain / snapshot.totalEarned.gold;
      const goldTroopsRatio = snapshot.totalEarned.gold / snapshot.totalEarned.troops;
      expect(grainGoldRatio).toBe(2); // 10/5
      expect(goldTroopsRatio).toBeCloseTo(2.5, 5); // 5/2
    });

    it('资源溢出时应按caps分别截断', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 0,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const offlineSeconds = 2 * HOUR_S; // 7200s
      const currentResources = zeroRes();
      // grain上限500, gold上限1000000, troops上限100
      const caps = { grain: 500, gold: 1000000, troops: 100, mandate: null as number | null };

      const result = rewardSystem.calculateFullReward(
        offlineSeconds, productionRates, currentResources, caps, 0, 'building',
      );

      // grain: earned = 72000 * 1.2 = 86400, cap = 500 → capped = 500, overflow = 85900
      expect(result.cappedEarned.grain).toBe(500);
      expect(result.overflowResources.grain).toBeGreaterThan(0);

      // gold: earned远小于1000000 → 无溢出
      expect(result.overflowResources.gold).toBe(0);

      // troops: earned = 14400 * 1.2 = 17280, cap = 100 → capped = 100
      expect(result.cappedEarned.troops).toBe(100);
      expect(result.overflowResources.troops).toBeGreaterThan(0);
    });

    it('OfflineEventSystem: 各资源类型独立积累事件', () => {
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 3 },
      ]);
      eventSystem.heartbeat();

      vi.advanceTimersByTime(HOUR_S * 1000); // 1小时

      const reward = eventSystem.processOfflineTime();

      // 应有 gold/grain/troops 三种 resource_accumulate 事件
      const resourceEvents = reward.events.filter(e => e.type === 'resource_accumulate');
      const resourceTypes = resourceEvents.map(e => e.data.resource as string);
      expect(resourceTypes).toContain('gold');
      expect(resourceTypes).toContain('grain');
      expect(resourceTypes).toContain('troops');

      // 每种资源各1个事件
      expect(resourceEvents.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // 场景5: 领土数量影响奖励(1城 vs 5城)
  // ═══════════════════════════════════════════

  describe('场景5: 领土数量影响奖励', () => {
    it('OfflineEventSystem: 5个玩家城市 vs 1个玩家城市 → 奖励约5倍', () => {
      // 先测1城
      eventSystem.setCities([
        { id: 'city-1', faction: 'player', level: 3 },
      ]);
      eventSystem.heartbeat();
      vi.advanceTimersByTime(HOUR_S * 1000);
      const reward1City = eventSystem.processOfflineTime();

      // 重置
      eventSystem.reset();
      emittedEvents.length = 0;

      // 再测5城
      eventSystem.setCities([
        { id: 'city-1', faction: 'player', level: 3 },
        { id: 'city-2', faction: 'player', level: 3 },
        { id: 'city-3', faction: 'player', level: 3 },
        { id: 'city-4', faction: 'player', level: 3 },
        { id: 'city-5', faction: 'player', level: 3 },
      ]);
      eventSystem.heartbeat();
      vi.advanceTimersByTime(HOUR_S * 1000);
      const reward5Cities = eventSystem.processOfflineTime();

      // 5城的 gold 应约为1城的5倍
      expect(reward5Cities.resources.gold).toBeGreaterThanOrEqual(reward1City.resources.gold * 5 - 1);
      expect(reward5Cities.resources.grain).toBeGreaterThanOrEqual(reward1City.resources.grain * 5 - 1);

      // 事件数量: 5城 * 3种资源 = 15, 1城 * 3种资源 = 3
      const resEvents1 = reward1City.events.filter(e => e.type === 'resource_accumulate');
      const resEvents5 = reward5Cities.events.filter(e => e.type === 'resource_accumulate');
      expect(resEvents1.length).toBe(3);
      expect(resEvents5.length).toBe(15);
    });

    it('OfflineEventSystem: 敌方城市不产生离线奖励', () => {
      eventSystem.setCities([
        { id: 'city-player', faction: 'player', level: 5 },
        { id: 'city-enemy', faction: 'enemy', level: 5 },
        { id: 'city-neutral', faction: 'neutral', level: 5 },
      ]);
      eventSystem.heartbeat();

      vi.advanceTimersByTime(HOUR_S * 1000);
      const reward = eventSystem.processOfflineTime();

      // 只有player城市产出
      const resourceEvents = reward.events.filter(e => e.type === 'resource_accumulate');
      // 1个player城市 * 3种资源 = 3个事件
      expect(resourceEvents.length).toBe(3);

      // 所有资源事件的城市都是 player 城市
      for (const event of resourceEvents) {
        expect(event.cityId).toBe('city-player');
      }
    });

    it('OfflineEventSystem: 高等级城市产出更多', () => {
      // 低等级城市
      eventSystem.setCities([
        { id: 'city-low', faction: 'player', level: 1 },
      ]);
      eventSystem.heartbeat();
      vi.advanceTimersByTime(HOUR_S * 1000);
      const rewardLow = eventSystem.processOfflineTime();

      eventSystem.reset();
      emittedEvents.length = 0;

      // 高等级城市
      eventSystem.setCities([
        { id: 'city-high', faction: 'player', level: 10 },
      ]);
      eventSystem.heartbeat();
      vi.advanceTimersByTime(HOUR_S * 1000);
      const rewardHigh = eventSystem.processOfflineTime();

      // level=10: multiplier = 1 + (10-1)*0.2 = 2.8
      // level=1: multiplier = 1 + (1-1)*0.2 = 1.0
      // 高等级城市gold应约为低等级的2.8倍
      const ratio = rewardHigh.resources.gold / rewardLow.resources.gold;
      expect(ratio).toBeCloseTo(2.8, 0);
    });

    it('OfflineRewardSystem: 产出速率由领土决定 → 5倍产出 = 5倍奖励', () => {
      const production1City: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };
      const production5Cities: Resources = {
        grain: 50, gold: 25, troops: 10, mandate: 5,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const offlineSeconds = 8 * HOUR_S;

      const snapshot1 = rewardSystem.calculateSnapshot(offlineSeconds, production1City);
      const snapshot5 = rewardSystem.calculateSnapshot(offlineSeconds, production5Cities);

      // 5倍产出速率 → 5倍收益
      expect(snapshot5.totalEarned.grain).toBe(snapshot1.totalEarned.grain * 5);
      expect(snapshot5.totalEarned.gold).toBe(snapshot1.totalEarned.gold * 5);
      expect(snapshot5.totalEarned.troops).toBe(snapshot1.totalEarned.troops * 5);

      // 效率相同（与产出速率无关）
      expect(snapshot5.overallEfficiency).toBe(snapshot1.overallEfficiency);
    });
  });

  // ═══════════════════════════════════════════
  // 场景6: 领取后资源确实更新 + 防重复领取
  // ═══════════════════════════════════════════

  describe('场景6: 领取 → 资源更新 + 防重复领取', () => {
    it('领取奖励后资源数量应增加', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const offlineSeconds = 8 * HOUR_S;
      const currentResources = zeroRes();

      const result = rewardSystem.calculateOfflineReward(
        offlineSeconds, productionRates, currentResources, infiniteCaps(), 0, 'building',
      );

      // 领取前资源为0
      expect(currentResources.grain).toBe(0);

      // 领取
      const claimed = rewardSystem.claimReward(result);
      expect(claimed).not.toBeNull();
      expect(claimed!.grain).toBeGreaterThan(0);
      expect(claimed!.gold).toBeGreaterThan(0);
      expect(claimed!.troops).toBeGreaterThan(0);

      // 模拟资源更新
      const updatedResources = {
        grain: currentResources.grain + claimed!.grain,
        gold: currentResources.gold + claimed!.gold,
        troops: currentResources.troops + claimed!.troops,
        mandate: currentResources.mandate + claimed!.mandate,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      expect(updatedResources.grain).toBeGreaterThan(0);
      expect(updatedResources.gold).toBeGreaterThan(0);
      expect(updatedResources.troops).toBeGreaterThan(0);
    });

    it('防重复领取: 第二次claimReward返回null', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const result = rewardSystem.calculateOfflineReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'building',
      );

      // 第一次领取成功
      const first = rewardSystem.claimReward(result);
      expect(first).not.toBeNull();

      // 第二次领取失败
      const second = rewardSystem.claimReward(result);
      expect(second).toBeNull();
    });

    it('新一轮 calculateOfflineReward 后可再次领取', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      // 第一轮
      const result1 = rewardSystem.calculateOfflineReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'building',
      );
      const claimed1 = rewardSystem.claimReward(result1);
      expect(claimed1).not.toBeNull();

      // 第二轮（新的 calculateOfflineReward 重置 claimed 状态）
      const result2 = rewardSystem.calculateOfflineReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'building',
      );
      const claimed2 = rewardSystem.claimReward(result2);
      expect(claimed2).not.toBeNull();

      // 两轮收益一致
      expect(claimed2!.grain).toBe(claimed1!.grain);
    });

    it('完整流程: 离线→上线→弹窗数据→领取→资源更新→EventBus通知', () => {
      // 1. 设置玩家城市
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 5 },
      ]);

      // 2. 心跳记录在线时间
      eventSystem.heartbeat();

      // 3. 模拟离线8小时
      vi.advanceTimersByTime(8 * HOUR_S * 1000);

      // 4. 上线: OfflineEventSystem 处理离线时间
      const offlineReward = eventSystem.processOfflineTime();
      expect(offlineReward.offlineDuration).toBeGreaterThan(0);
      expect(offlineReward.events.length).toBeGreaterThan(0);

      // 5. EventBus 触发 offline:processed 事件 (用于UI弹窗通知)
      const processedEvents = emittedEvents.filter(e => e.event === 'offline:processed');
      expect(processedEvents.length).toBe(1);

      // 6. OfflineRewardSystem 计算精确奖励
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };
      const currentResources = zeroRes();
      const preciseReward = rewardSystem.calculateOfflineReward(
        offlineReward.offlineDuration, productionRates, currentResources, infiniteCaps(), 0, 'building',
      );

      // 7. 生成弹窗面板数据
      const panelData = preciseReward.panelData;
      expect(panelData.formattedTime).toBeDefined();
      expect(panelData.efficiencyPercent).toBeGreaterThan(0);
      expect(panelData.totalEarned.grain).toBeGreaterThan(0);

      // 8. 领取奖励
      const claimed = rewardSystem.claimReward(preciseReward);
      expect(claimed).not.toBeNull();

      // 9. 资源更新
      const updatedResources = {
        grain: currentResources.grain + claimed!.grain,
        gold: currentResources.gold + claimed!.gold,
        troops: currentResources.troops + claimed!.troops,
        mandate: currentResources.mandate + claimed!.mandate,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };
      expect(updatedResources.grain).toBeGreaterThan(0);

      // 10. 防重复领取
      const secondClaim = rewardSystem.claimReward(preciseReward);
      expect(secondClaim).toBeNull();

      // 11. 标记离线事件已处理
      for (const event of offlineReward.events) {
        eventSystem.markProcessed(event.id);
      }
      expect(eventSystem.getPendingEvents().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 场景7: VIP等级影响离线奖励加成
  // ═══════════════════════════════════════════

  describe('场景7: VIP等级影响离线奖励', () => {
    it('VIP3 比 VIP0 收益更高', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };
      const offlineSeconds = 8 * HOUR_S;

      const result0 = rewardSystem.calculateFullReward(
        offlineSeconds, productionRates, zeroRes(), infiniteCaps(), 0, 'building',
      );
      const result3 = rewardSystem.calculateFullReward(
        offlineSeconds, productionRates, zeroRes(), infiniteCaps(), 3, 'building',
      );

      // VIP3 有 15% 效率加成
      // vipBoostedEarned: VIP0 的 totalEarned * 1.0 vs VIP3 的 totalEarned * 1.15
      expect(result3.vipBoostedEarned.grain).toBeGreaterThan(result0.vipBoostedEarned.grain);
    });

    it('VIP加成后资源上限截断仍有效', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const smallCaps = { grain: 100, gold: 100, troops: 100, mandate: null as number | null };

      const result = rewardSystem.calculateFullReward(
        8 * HOUR_S, productionRates, zeroRes(), smallCaps, 5, 'building',
      );

      // 即使有VIP加成, 也要受上限约束
      expect(result.cappedEarned.grain).toBeLessThanOrEqual(100);
      expect(result.overflowResources.grain).toBeGreaterThan(0);
    });

    it('系统修正系数: building(1.2) > resource(1.0) > expedition(0.85)', () => {
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const resultBuilding = rewardSystem.calculateFullReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'building',
      );
      const resultResource = rewardSystem.calculateFullReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'resource',
      );
      const resultExpedition = rewardSystem.calculateFullReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'expedition',
      );

      // building(1.2) > resource(1.0) > expedition(0.85)
      expect(resultBuilding.systemModifiedEarned.grain)
        .toBeGreaterThan(resultResource.systemModifiedEarned.grain);
      expect(resultResource.systemModifiedEarned.grain)
        .toBeGreaterThan(resultExpedition.systemModifiedEarned.grain);

      // 验证倍率
      const buildingRatio = resultBuilding.systemModifiedEarned.grain / resultResource.systemModifiedEarned.grain;
      const expeditionRatio = resultExpedition.systemModifiedEarned.grain / resultResource.systemModifiedEarned.grain;
      expect(buildingRatio).toBeCloseTo(1.2, 3);
      expect(expeditionRatio).toBeCloseTo(0.85, 3);
    });
  });

  // ═══════════════════════════════════════════
  // 额外场景: 序列化/反序列化 + 时间连续性
  // ═══════════════════════════════════════════

  describe('额外场景: 序列化 + 时间连续性', () => {
    it('存档恢复后离线奖励应能正确计算', () => {
      // 设置初始状态
      rewardSystem.addBoostItem('offline_boost_1h', 3);
      rewardSystem.setLastOfflineTime(Date.now());

      // 序列化
      const saved = rewardSystem.serialize();
      expect(saved.boostItems['offline_boost_1h']).toBe(3);

      // 反序列化到新系统
      const restored = new OfflineRewardSystem();
      restored.init({
        eventBus,
        registry: { get: vi.fn(), register: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
        config: { get: vi.fn() },
      } as any);
      restored.deserialize(saved);

      // 恢复后应能正常计算奖励
      const productionRates: Resources = {
        grain: 10, gold: 5, troops: 2, mandate: 1,
        techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0,
      };

      const result = restored.calculateOfflineReward(
        8 * HOUR_S, productionRates, zeroRes(), infiniteCaps(), 0, 'building',
      );
      expect(result.cappedEarned.grain).toBeGreaterThan(0);

      const claimed = restored.claimReward(result);
      expect(claimed).not.toBeNull();
      expect(claimed!.grain).toBeGreaterThan(0);
    });

    it('OfflineEventSystem 序列化/反序列化后保持离线时间', () => {
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 5 },
      ]);
      eventSystem.heartbeat();

      // 序列化
      const saved = eventSystem.serialize();

      // 模拟时间流逝
      vi.advanceTimersByTime(HOUR_S * 1000);

      // 反序列化（恢复之前的在线时间）
      eventSystem.deserialize(saved);

      // 此时有离线时间（因为 lastOnlineTime 是1小时前的）
      const reward = eventSystem.processOfflineTime();
      expect(reward.offlineDuration).toBeGreaterThan(0);
      expect(reward.resources.gold).toBeGreaterThan(0);
    });

    it('多次离线-上线循环: 每次奖励独立', () => {
      eventSystem.setCities([
        { id: 'city-luoyang', faction: 'player', level: 3 },
      ]);

      const rewards: number[] = [];

      // 循环3次
      for (let i = 0; i < 3; i++) {
        eventSystem.heartbeat();
        vi.advanceTimersByTime(HOUR_S * 1000); // 每次离线1小时
        const reward = eventSystem.processOfflineTime();
        rewards.push(reward.resources.gold);
        emittedEvents.length = 0;
      }

      // 每次都应该有奖励
      expect(rewards.length).toBe(3);
      for (const gold of rewards) {
        expect(gold).toBeGreaterThan(0);
      }

      // 相同城市、相同时长 → 奖励应一致
      expect(rewards[0]).toBe(rewards[1]);
      expect(rewards[1]).toBe(rewards[2]);
    });
  });
});
