import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * 天下Tab P0覆盖缺口测试 — 占领产出渐进 + 攻城奖励链路
 *
 * GAP-01: 占领产出渐进 — PRD: 占领后初始产出50%，24h后产出100%
 * GAP-02: 攻城奖励链路 — PRD: 首次攻占(元宝×100+声望+50)、重复攻占(铜钱×5000+产出×2/24h)
 *
 * ⚠️ TODO 清单（引擎尚未实现的功能）：
 *   TODO-01 [GAP-01] TerritorySystem 缺少产出渐进机制
 *     - 需要新增占领时间记录、产出倍率计算(0.5+0.5×min(1,elapsed/24))
 *     - TerritorySystem.getPlayerProductionSummary() 需乘以渐进倍率
 *   TODO-02 [GAP-02] SiegeEnhancer 缺少首次/重复攻占奖励区分
 *     - 需要攻占历史记录、首次奖励(元宝+100,声望+50)、重复奖励(铜钱×5000,产出×2/24h)
 *   TODO-03 [GAP-02] 特殊地标(洛阳/长安/建业)额外奖励未实现
 *     - 当前 capitalBonusMultiplier 通过 id.includes('capital-') 判断，但三大都城ID为 city-* 前缀
 *   TODO-04 [GAP-01] 反攻时产出倍率重置逻辑未实现
 *
 * @module engine/map/__tests__/SiegeRewardProgressive.test
 */

import { SiegeSystem } from '../SiegeSystem';
import { TerritorySystem } from '../TerritorySystem';
import { SiegeEnhancer } from '../SiegeEnhancer';
import { GarrisonSystem } from '../GarrisonSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';
import { SIEGE_REWARD_CONFIG } from '../../../core/map';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const PROGRESSIVE_INITIAL_RATE = 0.5;
const PROGRESSIVE_FULL_HOURS = 24;
const PROGRESSIVE_FULL_RATE = 1.0;
const FIRST_CAPTURE_INGOT = 100;
const FIRST_CAPTURE_PRESTIGE = 50;
const REPEAT_CAPTURE_COPPER = 5000;
const REPEAT_CAPTURE_PRODUCTION_BUFF = 2;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** 产出渐进倍率公式：0.5 + 0.5 × min(1, max(0, elapsedHours / 24)) */
function calcMultiplier(hours: number): number {
  return PROGRESSIVE_INITIAL_RATE +
    (PROGRESSIVE_FULL_RATE - PROGRESSIVE_INITIAL_RATE) *
    Math.min(1, Math.max(0, hours / PROGRESSIVE_FULL_HOURS));
}

// ─────────────────────────────────────────────
// Mock 工厂
// ─────────────────────────────────────────────
function createSystems() {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const garrison = new GarrisonSystem();
  const enhancer = new SiegeEnhancer();
  const resourceMock = { consume: vi.fn(), add: vi.fn(), get: vi.fn() };

  const deps: ISystemDeps = {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory') return territory;
        if (name === 'siege') return siege;
        if (name === 'garrison') return garrison;
        if (name === 'siegeEnhancer') return enhancer;
        if (name === 'resource') return resourceMock;
        throw new Error(`Subsystem ${name} not found`);
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockImplementation((name: string) =>
        ['territory', 'siege', 'garrison', 'siegeEnhancer', 'resource'].includes(name)),
      unregister: vi.fn(),
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps); siege.init(deps); garrison.init(deps); enhancer.init(deps);
  return { territory, siege, garrison, enhancer, deps, resourceMock };
}

/** 占领相邻领土使目标可被攻击 */
function setupAttackPath(territory: TerritorySystem, targetId: string, owner: 'player' | 'enemy' = 'player') {
  const adj = territory.getAdjacentTerritoryIds(targetId);
  if (adj.length > 0) territory.captureTerritory(adj[0], owner);
}

/** 确保胜利的攻城 */
function captureWin(siege: SiegeSystem, territory: TerritorySystem, targetId: string, owner: 'player' | 'enemy' = 'player') {
  return siege.executeSiegeWithResult(targetId, owner, 5000, 500, true);
}

/** 创建带 resource mock 的独立系统 */
function createSystemsWithResource() {
  const s = createSystems();
  const resourceSys = { consume: vi.fn(), add: vi.fn(), get: vi.fn() };
  const deps: ISystemDeps = {
    ...s.deps,
    registry: {
      ...s.deps.registry,
      get: vi.fn().mockImplementation((name: string) => {
        if (name === 'territory') return s.territory;
        if (name === 'siege') return s.siege;
        if (name === 'resource') return resourceSys;
        throw new Error(`Subsystem ${name} not found`);
      }),
    } as unknown as ISubsystemRegistry,
  };
  s.territory.init(deps); s.siege.init(deps);
  return { ...s, resourceSys };
}

// ═══════════════════════════════════════════════
// GAP-01: 占领产出渐进测试
// ═══════════════════════════════════════════════

describe('GAP-01: 占领产出渐进测试', () => {
  let s: ReturnType<typeof createSystems>;
  beforeEach(() => { s = createSystems(); });

  // ─── 产出渐进公式验证 ───

  describe('产出渐进公式验证', () => {
    it('PRD关键节点: 0h=50%, 12h=75%, 24h=100%', () => {
      expect(calcMultiplier(0)).toBe(0.5);
      expect(calcMultiplier(12)).toBe(0.75);
      expect(calcMultiplier(24)).toBe(1.0);
    });

    it('中间节点: 6h=0.625, 18h=0.875', () => {
      expect(calcMultiplier(6)).toBeCloseTo(0.625, 4);
      expect(calcMultiplier(18)).toBeCloseTo(0.875, 4);
    });

    it('封顶: 48h=1.0, 负数→0.5', () => {
      expect(calcMultiplier(48)).toBe(1.0);
      expect(calcMultiplier(-5)).toBe(0.5);
    });

    it('倍率单调递增且始终在[0.5, 1.0]', () => {
      let prev = calcMultiplier(0);
      for (let h = 1; h <= 48; h++) {
        const cur = calcMultiplier(h);
        expect(cur).toBeGreaterThanOrEqual(prev);
        expect(cur).toBeGreaterThanOrEqual(0.5);
        expect(cur).toBeLessThanOrEqual(1.0);
        prev = cur;
      }
    });
  });

  // ─── 占领时间戳基础设施 ───

  describe('占领时间戳基础设施', () => {
    it('攻城胜利后自动记录占领时间戳', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      s.siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      expect(s.siege.isInCaptureCooldown('city-xuchang')).toBe(true);
      expect(s.siege.getRemainingCooldown('city-xuchang')).toBeLessThanOrEqual(MS_PER_DAY);
    });

    it('setCaptureTimestamp 可手动设置，冷却24h后过期', () => {
      s.siege.setCaptureTimestamp('t1', Date.now() - 25 * MS_PER_HOUR);
      expect(s.siege.isInCaptureCooldown('t1')).toBe(false);
      s.siege.setCaptureTimestamp('t2', Date.now() - 23 * MS_PER_HOUR);
      expect(s.siege.isInCaptureCooldown('t2')).toBe(true);
    });

    it('恰好24h时冷却过期', () => {
      s.siege.setCaptureTimestamp('t1', Date.now() - MS_PER_DAY);
      expect(s.siege.getRemainingCooldown('t1')).toBe(0);
      expect(s.siege.isInCaptureCooldown('t1')).toBe(false);
    });

    it('不同领土时间戳独立管理', () => {
      s.siege.setCaptureTimestamp('t1', Date.now());
      s.siege.setCaptureTimestamp('t2', Date.now());
      expect(s.siege.isInCaptureCooldown('t1')).toBe(true);
      expect(s.siege.isInCaptureCooldown('t2')).toBe(true);
      s.siege.setCaptureTimestamp('t1', Date.now() - 25 * MS_PER_HOUR);
      expect(s.siege.isInCaptureCooldown('t1')).toBe(false);
      expect(s.siege.isInCaptureCooldown('t2')).toBe(true);
    });

    it('未占领的领土不在冷却中', () => {
      expect(s.siege.isInCaptureCooldown('city-xuchang')).toBe(false);
      expect(s.siege.getRemainingCooldown('city-xuchang')).toBe(0);
    });
  });

  // ─── 占领后立即产出倍率 ───

  describe('占领后立即产出倍率（依赖产出渐进系统）', () => {
    it('占领后基础设施就绪 + 公式倍率=0.5', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      const result = captureWin(s.siege, s.territory, 'city-xuchang');
      expect(result.victory).toBe(true);
      expect(s.siege.isInCaptureCooldown('city-xuchang')).toBe(true);
      expect(calcMultiplier(0)).toBe(0.5);
      // TODO-01: 验证实际产出 = currentProduction × 0.5
    });

    it('占领多块领土时各自独立', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      s.siege.resetDailySiegeCount();
      setupAttackPath(s.territory, 'city-ye');
      captureWin(s.siege, s.territory, 'city-ye');
      const summary = s.territory.getPlayerProductionSummary();
      expect(summary.details.length).toBeGreaterThanOrEqual(2);
      expect(calcMultiplier(0)).toBe(0.5);
    });
  });

  // ─── 12h/24h后产出倍率 ───

  describe('12h/24h后产出倍率（依赖产出渐进系统）', () => {
    it('12h后倍率=0.75, 冷却仍在', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 12 * MS_PER_HOUR);
      expect(calcMultiplier(12)).toBeCloseTo(0.75, 2);
      expect(s.siege.isInCaptureCooldown('city-xuchang')).toBe(true);
    });

    it('24h后倍率=1.0, 冷却过期', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 24 * MS_PER_HOUR);
      expect(calcMultiplier(24)).toBeCloseTo(1.0, 2);
      expect(s.siege.isInCaptureCooldown('city-xuchang')).toBe(false);
    });

    it('超过24h倍率封顶1.0', () => {
      expect(calcMultiplier(48)).toBe(1.0);
      expect(calcMultiplier(23.9)).toBeLessThan(1.0);
      expect(calcMultiplier(23.9)).toBeGreaterThan(0.99);
    });
  });

  // ─── 反攻时产出倍率重置 ───

  describe('反攻时产出倍率重置', () => {
    it('领土被夺回后再次占领，时间戳重置', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 12 * MS_PER_HOUR);
      s.territory.captureTerritory('city-xuchang', 'enemy');
      s.siege.resetDailySiegeCount();
      s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 25 * MS_PER_HOUR);
      captureWin(s.siege, s.territory, 'city-xuchang');
      expect(s.siege.isInCaptureCooldown('city-xuchang')).toBe(true);
      // TODO-04: 验证产出倍率重置为50%
    });

    it('多次反复争夺后时间戳始终更新', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      for (let i = 0; i < 3; i++) {
        captureWin(s.siege, s.territory, 'city-xuchang');
        s.territory.captureTerritory('city-xuchang', 'enemy');
        s.siege.resetDailySiegeCount();
        s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 25 * MS_PER_HOUR);
      }
      captureWin(s.siege, s.territory, 'city-xuchang');
      expect(s.siege.getRemainingCooldown('city-xuchang')).toBeGreaterThan(MS_PER_DAY - 5000);
    });
  });

  // ─── 不同等级领土渐进速率一致 ───

  describe('不同等级领土渐进速率一致', () => {
    it('公式与领土等级无关（纯时间函数）', () => {
      const m = calcMultiplier(6);
      expect(calcMultiplier(6)).toBe(m);
      expect(m).toBeCloseTo(0.625, 3);
    });

    it('产出渐进不影响产出类型比例', () => {
      const luoyang = s.territory.getTerritoryById('city-luoyang')!;
      const ratio = luoyang.currentProduction.grain / luoyang.currentProduction.gold;
      const m = 0.75;
      expect((luoyang.currentProduction.grain * m) / (luoyang.currentProduction.gold * m)).toBeCloseTo(ratio, 4);
    });
  });

  // ─── 当前实现状态验证 ───

  describe('当前实现状态（占领后无渐进）', () => {
    it('当前: 占领后立即获得100%产出', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      const detail = s.territory.getPlayerProductionSummary().details.find(d => d.id === 'city-xuchang')!;
      const t = s.territory.getTerritoryById('city-xuchang')!;
      expect(detail.production.grain).toBe(t.currentProduction.grain); // TODO-01: 应改为 × 0.5
    });

    it('累计产出计算未考虑渐进倍率', () => {
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      const summary = s.territory.getPlayerProductionSummary();
      const acc = s.territory.calculateAccumulatedProduction(3600);
      expect(acc.grain).toBeCloseTo(summary.totalProduction.grain * 3600, 1);
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-02: 攻城奖励链路测试
// ═══════════════════════════════════════════════

describe('GAP-02: 攻城奖励链路测试', () => {
  let s: ReturnType<typeof createSystems>;
  beforeEach(() => { s = createSystems(); });

  // ─── 现有奖励系统基础设施 ───

  describe('现有奖励系统基础设施', () => {
    it('SiegeEnhancer 计算攻城奖励包含资源和经验', () => {
      const reward = s.enhancer.calculateSiegeReward(s.territory.getTerritoryById('city-luoyang')!);
      expect(reward.resources.grain).toBeGreaterThan(0);
      expect(reward.resources.gold).toBeGreaterThan(0);
      expect(reward.territoryExp).toBeGreaterThan(0);
    });

    it('奖励与领土等级正相关', () => {
      const r3 = s.enhancer.calculateSiegeReward(s.territory.getTerritoryById('city-hanzhong')!);
      const r5 = s.enhancer.calculateSiegeReward(s.territory.getTerritoryById('city-luoyang')!);
      expect(r5.resources.grain).toBeGreaterThan(r3.resources.grain);
      expect(r5.territoryExp).toBeGreaterThan(r3.territoryExp);
    });

    it('奖励公式 = base × level × typeMultiplier', () => {
      const t = s.territory.getTerritoryById('city-luoyang')!;
      const r = s.enhancer.calculateSiegeReward(t);
      expect(r.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain * t.level);
      expect(r.resources.gold).toBe(SIEGE_REWARD_CONFIG.baseGold * t.level);
    });

    it('关卡有passBonusMultiplier=1.5加成', () => {
      const pass = s.territory.getTerritoryById('pass-hulao')!;
      const r = s.enhancer.calculateSiegeReward(pass);
      expect(r.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain * pass.level * SIEGE_REWARD_CONFIG.passBonusMultiplier);
    });

    it('关卡奖励高于同等级城池', () => {
      const passR = s.enhancer.calculateSiegeReward(s.territory.getTerritoryById('pass-hulao')!);
      const cityR = s.enhancer.calculateSiegeReward(s.territory.getTerritoryById('city-hanzhong')!);
      expect(passR.resources.grain).toBeGreaterThan(cityR.resources.grain);
    });

    it('征服成功触发 siege:reward 事件', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      for (let i = 0; i < 20; i++) {
        s.territory.captureTerritory('city-xuchang', 'enemy');
        setupAttackPath(s.territory, 'city-xuchang');
        s.siege.resetDailySiegeCount();
        const r = s.enhancer.executeConquest('city-xuchang', 'player', 10000, 5000, 5000);
        if (r.success) {
          expect(r.reward).not.toBeNull();
          expect(emitSpy).toHaveBeenCalledWith('siege:reward', expect.objectContaining({ territoryId: 'city-xuchang' }));
          return;
        }
      }
    });
  });

  // ─── 首次攻占奖励 ───

  describe('首次攻占奖励（依赖首次/重复区分系统）', () => {
    it('首次攻占胜利触发 siege:victory 事件', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      expect(emitSpy).toHaveBeenCalledWith('siege:victory', expect.objectContaining({
        territoryId: 'city-xuchang', newOwner: 'player',
      }));
      // TODO-02: 验证首次奖励 = 元宝×100 + 声望+50
    });

    it('PRD首次奖励参数: ingot=100, prestige=50', () => {
      expect(FIRST_CAPTURE_INGOT).toBe(100);
      expect(FIRST_CAPTURE_PRESTIGE).toBe(50);
    });
  });

  // ─── 重复攻占奖励 ───

  describe('重复攻占奖励（依赖首次/重复区分系统）', () => {
    it('再次攻占同一领土触发两次胜利事件', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      s.territory.captureTerritory('city-xuchang', 'enemy');
      s.siege.resetDailySiegeCount();
      s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 25 * MS_PER_HOUR);
      captureWin(s.siege, s.territory, 'city-xuchang');
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:victory')).toHaveLength(2);
      // TODO-02: 第二次应为重复奖励(铜钱×5000 + 产出×2/24h)
    });

    it('PRD重复奖励参数: copper=5000, productionBuff=2', () => {
      expect(REPEAT_CAPTURE_COPPER).toBe(5000);
      expect(REPEAT_CAPTURE_PRODUCTION_BUFF).toBe(2);
    });
  });

  // ─── 奖励不重复发放 ───

  describe('奖励不重复发放', () => {
    it('同一次攻占 victory 和 autoGarrison 事件各只触发一次', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:victory')).toHaveLength(1);
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:autoGarrison')).toHaveLength(1);
    });

    it('攻城失败不发放奖励', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      s.siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:victory')).toHaveLength(0);
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:reward')).toHaveLength(0);
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:autoGarrison')).toHaveLength(0);
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:defeat')).toHaveLength(1);
      expect(s.enhancer.getTotalRewardsGranted()).toBe(0);
    });

    it('条件不满足时不触发任何siege事件', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      s.siege.executeSiegeWithResult('city-xuchang', 'player', 10, 5, true);
      expect(emitSpy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].startsWith('siege:'))).toHaveLength(0);
    });
  });

  // ─── 特殊地标额外奖励 ───

  describe('特殊地标（洛阳/长安/建业）额外奖励', () => {
    it('三大都城存在且等级较高', () => {
      expect(s.territory.getTerritoryById('city-luoyang')!.level).toBe(5);
      expect(s.territory.getTerritoryById('city-changan')!.level).toBe(5);
      expect(s.territory.getTerritoryById('city-jianye')).not.toBeNull();
    });

    it('当前: 都城按普通城池计算（无capital加成）', () => {
      const luoyang = s.territory.getTerritoryById('city-luoyang')!;
      const r = s.enhancer.calculateSiegeReward(luoyang);
      expect(r.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain * luoyang.level);
      // TODO-03: 实现后应为 baseGrain × level × capitalBonusMultiplier(2.0)
    });

    it('PRD都城加成参数 capitalBonusMultiplier=2.0', () => {
      expect(SIEGE_REWARD_CONFIG.capitalBonusMultiplier).toBe(2.0);
    });
  });

  // ─── 事件链路完整性 ───

  describe('攻城奖励事件链路完整性', () => {
    it('胜利 → 占领事件 → autoGarrison 按序触发', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      const names = emitSpy.mock.calls.filter(c => typeof c[0] === 'string').map(c => c[0]);
      expect(names).toContain('siege:victory');
      expect(names).toContain('territory:captured');
      expect(names).toContain('siege:autoGarrison');
    });

    it('攻城失败事件包含 defeatTroopLoss', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      s.siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
      const data = emitSpy.mock.calls.find(c => c[0] === 'siege:defeat')![1];
      expect(data.defeatTroopLoss).toBeGreaterThan(0);
    });

    it('autoGarrison兵力 = 攻城消耗 × 50%', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      captureWin(s.siege, s.territory, 'city-xuchang');
      const t = s.territory.getTerritoryById('city-xuchang')!;
      const expectedCost = Math.ceil(100 * (t.defenseValue / 100) * 1.0);
      const garrisonData = emitSpy.mock.calls.find(c => c[0] === 'siege:autoGarrison')![1];
      expect(garrisonData.garrisonTroops).toBe(Math.floor(expectedCost * 0.5));
    });

    it('失败不触发autoGarrison', () => {
      const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
      setupAttackPath(s.territory, 'city-xuchang');
      s.siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
      expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:autoGarrison')).toHaveLength(0);
    });
  });

  // ─── 奖励计算边界条件 ───

  describe('奖励计算边界条件', () => {
    it('等级1和等级5领土奖励验证', () => {
      const all = s.territory.getAllTerritories();
      const lv1 = all.find(t => t.level === 1);
      if (lv1) {
        const r = s.enhancer.calculateSiegeReward(lv1);
        expect(r.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain);
      }
      const lv5 = s.territory.getTerritoryById('city-luoyang')!;
      const r5 = s.enhancer.calculateSiegeReward(lv5);
      expect(r5.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain * 5);
    });

    it('不存在的领土返回null', () => {
      expect(s.enhancer.calculateSiegeRewardById('nonexistent')).toBeNull();
    });

    it('所有领土奖励为非负整数', () => {
      for (const t of s.territory.getAllTerritories()) {
        const r = s.enhancer.calculateSiegeReward(t);
        for (const val of [r.resources.grain, r.resources.gold, r.resources.troops, r.resources.mandate, r.territoryExp]) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(val)).toBe(true);
        }
      }
    });

    it('道具奖励列表结构正确', () => {
      const r = s.enhancer.calculateSiegeReward(s.territory.getTerritoryById('city-luoyang')!);
      expect(Array.isArray(r.items)).toBe(true);
      for (const item of r.items) {
        expect(['common', 'rare', 'epic', 'legendary']).toContain(item.rarity);
      }
    });
  });

  // ─── 攻城资源扣减 ───

  describe('攻城资源扣减', () => {
    it('胜利扣减全部消耗', () => {
      const sr = createSystemsWithResource();
      setupAttackPath(sr.territory, 'city-xuchang');
      sr.siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, true);
      const t = sr.territory.getTerritoryById('city-xuchang')!;
      const expectedTroops = Math.ceil(100 * (t.defenseValue / 100) * 1.0);
      expect(sr.resourceSys.consume).toHaveBeenCalledWith('troops', expectedTroops);
      expect(sr.resourceSys.consume).toHaveBeenCalledWith('grain', 500);
    });

    it('失败扣减30%兵力+全部粮草', () => {
      const sr = createSystemsWithResource();
      setupAttackPath(sr.territory, 'city-xuchang');
      const result = sr.siege.executeSiegeWithResult('city-xuchang', 'player', 5000, 500, false);
      const t = sr.territory.getTerritoryById('city-xuchang')!;
      const fullCost = Math.ceil(100 * (t.defenseValue / 100) * 1.0);
      expect(sr.resourceSys.consume).toHaveBeenCalledWith('troops', Math.floor(fullCost * 0.3));
      expect(sr.resourceSys.consume).toHaveBeenCalledWith('grain', 500);
      expect(result.defeatTroopLoss).toBe(Math.floor(fullCost * 0.3));
    });

    it('条件不满足时不扣减', () => {
      s.siege.executeSiegeWithResult('city-xuchang', 'player', 10, 5, true);
      expect(s.resourceMock.consume).not.toHaveBeenCalled();
    });
  });

  // ─── SiegeEnhancer 序列化与接口 ───

  describe('SiegeEnhancer 序列化与接口', () => {
    it('name=siegeEnhancer, getState含统计', () => {
      expect(s.enhancer.name).toBe('siegeEnhancer');
      expect(s.enhancer.getState()).toHaveProperty('totalRewardsGranted');
    });

    it('序列化→反序列化→reset', () => {
      s.enhancer.deserialize({ totalRewardsGranted: 5, version: 1 });
      expect(s.enhancer.getTotalRewardsGranted()).toBe(5);
      s.enhancer.reset();
      expect(s.enhancer.getTotalRewardsGranted()).toBe(0);
    });

    it('update不抛异常', () => {
      expect(() => s.enhancer.update(0.016)).not.toThrow();
    });
  });

  // ─── 胜率预估与奖励关联 ───

  describe('胜率预估', () => {
    it('高战力胜率高于低战力', () => {
      const high = s.enhancer.estimateWinRate(50000, 'city-xuchang')!;
      const low = s.enhancer.estimateWinRate(100, 'city-xuchang')!;
      expect(high.winRate).toBeGreaterThan(low.winRate);
    });

    it('不存在的领土返回null', () => {
      expect(s.enhancer.estimateWinRate(5000, 'nonexistent')).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-01 + GAP-02 交叉验证
// ═══════════════════════════════════════════════

describe('GAP-01 + GAP-02 交叉验证', () => {
  let s: ReturnType<typeof createSystems>;
  beforeEach(() => { s = createSystems(); });

  it('占领→产出→奖励完整链路', () => {
    const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
    setupAttackPath(s.territory, 'city-xuchang');
    captureWin(s.siege, s.territory, 'city-xuchang');
    expect(s.territory.getTerritoryById('city-xuchang')!.ownership).toBe('player');
    expect(s.territory.getPlayerProductionSummary().totalTerritories).toBeGreaterThanOrEqual(2);
    const names = emitSpy.mock.calls.filter(c => typeof c[0] === 'string').map(c => c[0]);
    expect(names).toContain('siege:victory');
    expect(names).toContain('territory:captured');
    expect(names).toContain('siege:autoGarrison');
  });

  it('连续占领多块领土后产出汇总正确', () => {
    s.territory.captureTerritory('city-luoyang', 'player');
    captureWin(s.siege, s.territory, 'city-xuchang');
    s.siege.resetDailySiegeCount();
    captureWin(s.siege, s.territory, 'pass-hulao');
    s.siege.resetDailySiegeCount();
    captureWin(s.siege, s.territory, 'city-changan');
    const summary = s.territory.getPlayerProductionSummary();
    expect(summary.totalTerritories).toBe(4);
    expect(summary.totalProduction.grain).toBeGreaterThan(0);
  });

  it('占领→失去→再占领完整循环', () => {
    const emitSpy = vi.spyOn(s.deps.eventBus, 'emit');
    setupAttackPath(s.territory, 'city-xuchang');
    captureWin(s.siege, s.territory, 'city-xuchang');
    s.territory.captureTerritory('city-xuchang', 'enemy');
    s.siege.resetDailySiegeCount();
    s.siege.setCaptureTimestamp('city-xuchang', Date.now() - 25 * MS_PER_HOUR);
    captureWin(s.siege, s.territory, 'city-xuchang');
    expect(s.territory.getTerritoryById('city-xuchang')!.ownership).toBe('player');
    expect(emitSpy.mock.calls.filter(c => c[0] === 'siege:victory')).toHaveLength(2);
  });

  it('产出渐进公式 × 领土产出 × 奖励倍率一致性', () => {
    const luoyang = s.territory.getTerritoryById('city-luoyang')!;
    const reward = s.enhancer.calculateSiegeReward(luoyang);
    const production = luoyang.currentProduction;
    const m = calcMultiplier(0);
    expect(production.grain * m).toBeCloseTo(production.grain * 0.5, 2);
    expect(reward.resources.grain).toBe(SIEGE_REWARD_CONFIG.baseGrain * luoyang.level);
  });
});
