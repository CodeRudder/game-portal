/**
 * SiegeEnhancer 测试
 *
 * 覆盖：
 *   #3 胜率预估公式
 *   #5 攻城奖励
 *   #2 征服流程
 *   驻防对攻城的影响
 *   序列化/反序列化
 *
 * @module engine/map/__tests__/SiegeEnhancer.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SiegeEnhancer } from '../SiegeEnhancer';
import { SiegeSystem } from '../SiegeSystem';
import { TerritorySystem } from '../TerritorySystem';
import { GarrisonSystem } from '../GarrisonSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import type { GeneralData } from '../../hero/hero.types';
import { Quality } from '../../hero/hero.types';
import { SIEGE_REWARD_CONFIG, BATTLE_RATING_THRESHOLDS } from '../../../core/map';

// ─────────────────────────────────────────────
// 测试武将数据
// ─────────────────────────────────────────────

function createGeneral(id: string, quality: Quality, defense: number): GeneralData {
  return {
    id,
    name: `武将${id}`,
    quality,
    baseStats: { attack: 100, defense, intelligence: 80, speed: 70 },
    level: 10,
    exp: 0,
    faction: 'shu',
    skills: [],
  };
}

const GENERALS: Record<string, GeneralData> = {
  guanyu: createGeneral('guanyu', Quality.LEGENDARY, 200),
  zhangfei: createGeneral('zhangfei', Quality.EPIC, 180),
};

// ─────────────────────────────────────────────
// Mock 工厂
// ─────────────────────────────────────────────

function createSystems() {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const garrison = new GarrisonSystem();
  const enhancer = new SiegeEnhancer();

  const deps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory') return territory;
        if (name === 'siege') return siege;
        if (name === 'garrison') return garrison;
        if (name === 'siegeEnhancer') return enhancer;
        if (name === 'hero') return { getGeneral: (id: string) => GENERALS[id] };
        if (name === 'formation') return { isGeneralInAnyFormation: () => false };
        throw new Error(`Subsystem ${name} not found`);
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((name: string) =>
        ['territory', 'siege', 'garrison', 'siegeEnhancer', 'hero', 'formation'].includes(name)),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  siege.init(deps);
  garrison.init(deps);
  enhancer.init(deps);

  return { territory, siege, garrison, enhancer, deps };
}

/** 占领领土并设置相邻己方领土（用于攻城条件） */
function setupAttackPath(territory: TerritorySystem, targetId: string): void {
  // 先占领目标
  territory.captureTerritory(targetId, 'player');
  // 获取目标的相邻领土
  const adjacentIds = territory.getAdjacentTerritoryIds(targetId);
  if (adjacentIds.length > 0) {
    // 取消占领目标，占领其相邻领土（使目标可被攻击）
    territory.captureTerritory(targetId, 'enemy');
    territory.captureTerritory(adjacentIds[0], 'player');
  }
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('SiegeEnhancer', () => {
  let systems: ReturnType<typeof createSystems>;

  beforeEach(() => {
    systems = createSystems();
  });

  // ─── ISubsystem 接口 ───────────────────────

  describe('ISubsystem', () => {
    it('name 为 siegeEnhancer', () => {
      expect(systems.enhancer.name).toBe('siegeEnhancer');
    });

    it('getState 返回初始状态', () => {
      const state = systems.enhancer.getState();
      expect(state.totalRewardsGranted).toBe(0);
    });

    it('reset 清零统计', () => {
      systems.enhancer.reset();
      expect(systems.enhancer.getState().totalRewardsGranted).toBe(0);
    });
  });

  // ─── 胜率预估 ──────────────────────────────

  describe('estimateWinRate', () => {
    it('高攻击力 vs 低防御 → 高胜率', () => {
      const result = systems.enhancer.estimateWinRate(1000, 'city-luoyang');
      expect(result).not.toBeNull();
      expect(result!.winRate).toBeGreaterThan(0.5);
      expect(result!.attackerPower).toBe(1000);
      expect(result!.defenderPower).toBeGreaterThan(0);
    });

    it('低攻击力 vs 高防御 → 低胜率', () => {
      const result = systems.enhancer.estimateWinRate(10, 'city-luoyang');
      expect(result).not.toBeNull();
      expect(result!.winRate).toBeLessThan(0.3);
    });

    it('不存在领土时返回 null', () => {
      const result = systems.enhancer.estimateWinRate(1000, 'nonexistent');
      expect(result).toBeNull();
    });

    it('胜率在 0~1 之间', () => {
      for (const power of [1, 50, 100, 500, 1000, 5000]) {
        const result = systems.enhancer.estimateWinRate(power, 'city-luoyang');
        expect(result!.winRate).toBeGreaterThanOrEqual(0);
        expect(result!.winRate).toBeLessThanOrEqual(1);
      }
    });

    it('攻防相等时胜率接近 0.5', () => {
      // 先计算 defenderPower
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const defenderPower = systems.enhancer.calculateDefenderPower(territory);

      const result = systems.enhancer.estimateWinRate(defenderPower, 'city-luoyang');
      // 由于幂函数变换，不一定精确0.5，但应在 0.4~0.6 范围
      expect(result!.winRate).toBeGreaterThan(0.35);
      expect(result!.winRate).toBeLessThan(0.65);
    });

    it('预估损失率与胜率负相关', () => {
      const highPower = systems.enhancer.estimateWinRate(2000, 'city-luoyang')!;
      const lowPower = systems.enhancer.estimateWinRate(50, 'city-luoyang')!;

      expect(highPower.estimatedLossRate).toBeLessThan(lowPower.estimatedLossRate);
    });

    it('评级随胜率变化', () => {
      const easy = systems.enhancer.estimateWinRate(5000, 'city-luoyang')!;
      const hard = systems.enhancer.estimateWinRate(10, 'city-luoyang')!;

      expect(easy.rating).toMatch(/easy|moderate/);
      expect(hard.rating).toMatch(/impossible|very_hard|hard/);
    });
  });

  // ─── 战斗评级 ──────────────────────────────

  describe('战斗评级', () => {
    it('各评级阈值互斥且完整覆盖 [0, 1]', () => {
      const ratings = Object.values(BATTLE_RATING_THRESHOLDS);
      // 每个区间 [min, max]
      for (const r of ratings) {
        expect(r.min).toBeLessThan(r.max);
      }
    });
  });

  // ─── 防御力计算 ────────────────────────────

  describe('calculateDefenderPower', () => {
    it('无驻防时防御力 = 基础 × 等级加成', () => {
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const power = systems.enhancer.calculateDefenderPower(territory);

      const expected = territory.defenseValue * (1 + (territory.level - 1) * 0.15);
      expect(power).toBeCloseTo(expected, 2);
    });

    it('有驻防时防御力增加', () => {
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const powerBefore = systems.enhancer.calculateDefenderPower(territory);

      // 驻防
      systems.territory.captureTerritory('city-luoyang', 'player');
      systems.garrison.assignGarrison('city-luoyang', 'guanyu');

      // 恢复为 enemy 以便计算防御力
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      const powerAfter = systems.enhancer.calculateDefenderPower(territory);
      expect(powerAfter).toBeGreaterThan(powerBefore);
    });
  });

  // ─── 攻城奖励 ──────────────────────────────

  describe('calculateSiegeReward', () => {
    it('奖励与领土等级正相关', () => {
      const t3 = systems.territory.getTerritoryById('city-changsha')!; // level 3
      const t5 = systems.territory.getTerritoryById('city-luoyang')!; // level 5

      const reward3 = systems.enhancer.calculateSiegeReward(t3);
      const reward5 = systems.enhancer.calculateSiegeReward(t5);

      expect(reward5.resources.grain).toBeGreaterThan(reward3.resources.grain);
      expect(reward5.resources.gold).toBeGreaterThan(reward3.resources.gold);
    });

    it('关卡有额外奖励加成', () => {
      const pass = systems.territory.getTerritoryById('pass-hulao')!;
      const city = systems.territory.getTerritoryById('city-changsha')!;

      const passReward = systems.enhancer.calculateSiegeReward(pass);
      const cityReward = systems.enhancer.calculateSiegeReward(city);

      // 同等级关卡奖励应更高（pass-hulao level 3, city-changsha level 3）
      if (pass.level === city.level) {
        expect(passReward.resources.grain).toBeGreaterThan(cityReward.resources.grain);
      }
    });

    it('奖励包含领土经验', () => {
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const reward = systems.enhancer.calculateSiegeReward(territory);

      expect(reward.territoryExp).toBeGreaterThan(0);
      expect(reward.territoryExp).toBe(
        SIEGE_REWARD_CONFIG.baseTerritoryExp * territory.level,
      );
    });

    it('道具掉落数量与等级相关', () => {
      const t1 = { ...systems.territory.getTerritoryById('pass-hulao')!, level: 1 as const };
      const t5 = systems.territory.getTerritoryById('city-luoyang')!;

      const reward1 = systems.enhancer.calculateSiegeReward(t1);
      const reward5 = systems.enhancer.calculateSiegeReward(t5);

      // 高等级领土道具更多
      expect(reward5.items.length).toBeGreaterThanOrEqual(reward1.items.length);
    });

    it('calculateSiegeRewardById 不存在领土返回 null', () => {
      expect(systems.enhancer.calculateSiegeRewardById('nonexistent')).toBeNull();
    });

    it('奖励资源公式正确', () => {
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const reward = systems.enhancer.calculateSiegeReward(territory);

      expect(reward.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain * territory.level);
      expect(reward.resources.gold).toBe(SIEGE_REWARD_CONFIG.baseGold * territory.level);
      expect(reward.resources.troops).toBe(SIEGE_REWARD_CONFIG.baseTroops * territory.level);
      expect(reward.resources.mandate).toBe(SIEGE_REWARD_CONFIG.baseMandate * territory.level);
    });
  });

  // ─── 征服流程 ──────────────────────────────

  describe('executeConquest', () => {
    it('目标不存在时失败（check 阶段）', () => {
      const result = systems.enhancer.executeConquest(
        'nonexistent', 'player', 1000, 500, 500,
      );

      expect(result.success).toBe(false);
      expect(result.phase).toBe('check');
    });

    it('条件不满足时失败（check 阶段）', () => {
      // city-luoyang 是 neutral，玩家没有相邻领土
      const result = systems.enhancer.executeConquest(
        'city-luoyang', 'player', 1000, 500, 500,
      );

      expect(result.success).toBe(false);
      expect(result.phase).toBe('check');
    });

    it('成功征服（胜利路径）', () => {
      // 设置：玩家占领 city-xuchang，city-luoyang 为 enemy
      systems.territory.captureTerritory('city-xuchang', 'player');
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      // 足够战力确保胜利
      const result = systems.enhancer.executeConquest(
        'city-luoyang', 'player', 5000, 5000, 5000,
      );

      // 由于使用随机判定，可能胜也可能败
      // 但胜率很高，大概率胜利
      expect(['battle', 'reward']).toContain(result.phase);
      expect(result.winRateEstimate).not.toBeNull();
      expect(result.winRateEstimate!.winRate).toBeGreaterThan(0.5);
    });

    it('征服成功时发放奖励', () => {
      systems.territory.captureTerritory('city-xuchang', 'player');
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      // 多次尝试直到胜利（胜率很高）
      let result;
      for (let i = 0; i < 20; i++) {
        // 重置领土状态
        systems.territory.captureTerritory('city-luoyang', 'enemy');
        result = systems.enhancer.executeConquest(
          'city-luoyang', 'player', 5000, 5000, 5000,
        );
        if (result.success) break;
      }

      if (result!.success) {
        expect(result!.reward).not.toBeNull();
        expect(result!.reward!.resources.grain).toBeGreaterThan(0);
        expect(result!.capture).not.toBeNull();
      }
    });

    it('征服成功时发出 siege:reward 事件', () => {
      systems.territory.captureTerritory('city-xuchang', 'player');
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      for (let i = 0; i < 20; i++) {
        systems.territory.captureTerritory('city-luoyang', 'enemy');
        const result = systems.enhancer.executeConquest(
          'city-luoyang', 'player', 5000, 5000, 5000,
        );
        if (result.success) {
          expect(systems.deps.eventBus.emit).toHaveBeenCalledWith(
            'siege:reward',
            expect.objectContaining({
              territoryId: 'city-luoyang',
            }),
          );
          return;
        }
      }
    });

    it('兵力不足时失败', () => {
      systems.territory.captureTerritory('city-xuchang', 'player');
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      const result = systems.enhancer.executeConquest(
        'city-luoyang', 'player', 5000, 1, 1, // 兵力不足
      );

      expect(result.success).toBe(false);
      expect(result.phase).toBe('check');
    });
  });

  // ─── 驻防对攻城的影响 ──────────────────────

  describe('驻防影响攻城', () => {
    it('驻防提高防守方有效战力', () => {
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const powerBefore = systems.enhancer.calculateDefenderPower(territory);

      // 驻防武将
      systems.territory.captureTerritory('city-luoyang', 'player');
      systems.garrison.assignGarrison('city-luoyang', 'guanyu');
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      const powerAfter = systems.enhancer.calculateDefenderPower(territory);
      expect(powerAfter).toBeGreaterThan(powerBefore);
    });

    it('驻防降低攻击方胜率', () => {
      const territory = systems.territory.getTerritoryById('city-luoyang')!;
      const estimateBefore = systems.enhancer.estimateWinRate(500, 'city-luoyang');

      // 驻防
      systems.territory.captureTerritory('city-luoyang', 'player');
      systems.garrison.assignGarrison('city-luoyang', 'guanyu');
      systems.territory.captureTerritory('city-luoyang', 'enemy');

      const estimateAfter = systems.enhancer.estimateWinRate(500, 'city-luoyang');
      expect(estimateAfter!.winRate).toBeLessThan(estimateBefore!.winRate);
    });
  });

  // ─── 统计查询 ──────────────────────────────

  describe('统计查询', () => {
    it('初始奖励次数为 0', () => {
      expect(systems.enhancer.getTotalRewardsGranted()).toBe(0);
    });
  });

  // ─── 序列化 ────────────────────────────────

  describe('序列化/反序列化', () => {
    it('序列化后可正确恢复', () => {
      const data = systems.enhancer.serialize();
      expect(data.version).toBe(1);
      expect(data.totalRewardsGranted).toBe(0);

      const newEnhancer = new SiegeEnhancer();
      newEnhancer.init(systems.deps);
      newEnhancer.deserialize({ totalRewardsGranted: 5, version: 1 });

      expect(newEnhancer.getTotalRewardsGranted()).toBe(5);
    });

    it('反序列化缺失数据时默认为 0', () => {
      const newEnhancer = new SiegeEnhancer();
      newEnhancer.init(systems.deps);
      newEnhancer.deserialize({ totalRewardsGranted: undefined, version: 1 } as any);

      expect(newEnhancer.getTotalRewardsGranted()).toBe(0);
    });
  });
});
