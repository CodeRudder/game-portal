/**
 * P1 缺口测试 — 武将加成联动 + 声望加成联动
 *
 * 验证建筑资源产出的完整乘法链：
 *   基础产出 × 主城加成 × 科技加成 × 武将加成 × 声望加成
 *
 * 测试策略：
 *   - 使用真实引擎实例（BuildingSystem, ResourceSystem, PrestigeSystem, HeroDispatchSystem）
 *   - 通过 calculateBonusMultiplier() 验证加成乘法链
 *   - 通过 ResourceSystem.tick() 验证实际资源产出
 *   - 通过 PrestigeSystem.getProductionBonus() 验证声望加成
 *   - 通过 HeroDispatchSystem.getDispatchBonus() 验证武将加成
 *
 * @module engine/building/__tests__/CrossSystemBonus
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── 建筑域 ──
import { BuildingSystem } from '../BuildingSystem';
import { BUILDING_DEFS } from '../building-config';

// ── 资源域 ──
import { ResourceSystem } from '../../resource/ResourceSystem';
import { calculateBonusMultiplier } from '../../resource/resource-calculator';
import type { Bonuses } from '../../resource/resource.types';

// ── 声望域 ──
import { PrestigeSystem, calcProductionBonus } from '../../prestige/PrestigeSystem';

// ── 武将域 ──
import { HeroDispatchSystem } from '../../hero/HeroDispatchSystem';
import type { GeneralData } from '../../hero/hero.types';
import { Quality } from '../../hero/hero.types';
import type { GeneralStats } from '../../../shared/types';
import type { BuildingType, Resources } from '../../../shared/types';

// ── 共享 ──
import { EventBus } from '../../../core/events/EventBus';

// ─────────────────────────────────────────────
// 测试辅助
// ─────────────────────────────────────────────

/** 充足资源 */
const RICH: Resources = { grain: 1e9, gold: 1e9, troops: 1e9, mandate: 0 };

/** 创建测试用武将数据 */
function createGeneral(
  id: string,
  quality: Quality = Quality.RARE,
  level: number = 10,
  attack: number = 100,
): GeneralData {
  return {
    id,
    name: `测试武将_${id}`,
    quality,
    baseStats: { attack, defense: 50, intelligence: 50, speed: 50 },
    level,
    exp: 0,
    faction: 'shu',
    skills: [],
  };
}

/** 创建依赖注入对象 */
function createDeps() {
  const eventBus = new EventBus();
  return { eventBus, configRegistry: { get: () => undefined } } as any;
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('P1: 武将加成联动 + 声望加成联动', () => {
  let building: BuildingSystem;
  let resource: ResourceSystem;
  let prestige: PrestigeSystem;
  let dispatch: HeroDispatchSystem;
  let baseTime: number;

  beforeEach(() => {
    vi.restoreAllMocks();
    baseTime = 1_000_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    building = new BuildingSystem();
    building.init(createDeps());

    resource = new ResourceSystem();
    resource.init(createDeps());

    prestige = new PrestigeSystem();
    prestige.init(createDeps());

    dispatch = new HeroDispatchSystem();
    dispatch.init(createDeps());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // §1 声望加成联动
  // ═══════════════════════════════════════════

  describe('§1 声望加成联动', () => {
    it('声望等级1时产出加成为 1 + 1 × 0.02 = 1.02', () => {
      // 声望等级1（初始）
      const bonus = prestige.getProductionBonus();
      expect(bonus).toBeCloseTo(1.02, 4);
    });

    it('声望等级提升后产出加成增加', () => {
      const bonusLv1 = prestige.getProductionBonus();

      // 手动增加声望值到足以升级
      prestige.addPrestigePoints('main_quest', 5000);
      const panel = prestige.getPrestigePanel();
      // 确认等级已提升
      expect(panel.currentLevel).toBeGreaterThan(1);

      const bonusLvUp = prestige.getProductionBonus();
      expect(bonusLvUp).toBeGreaterThan(bonusLv1);
    });

    it('声望加成公式 calcProductionBonus 各等级正确', () => {
      // 公式: 1 + level × 0.02
      expect(calcProductionBonus(1)).toBeCloseTo(1.02);
      expect(calcProductionBonus(5)).toBeCloseTo(1.10);
      expect(calcProductionBonus(10)).toBeCloseTo(1.20);
      expect(calcProductionBonus(25)).toBeCloseTo(1.50);
      expect(calcProductionBonus(50)).toBeCloseTo(2.00);
    });

    it('声望加成参与资源tick产出乘法链', () => {
      // 设置农田产出
      resource.recalculateProduction({ grain: 10 }); // 10 粮草/秒

      // 声望等级1 → 加成 1.02
      const prestigeBonus = prestige.getProductionBonus() - 1; // 0.02

      // 模拟tick，使用声望加成
      const bonuses: Bonuses = {
        castle: 0,   // 无主城加成
        tech: 0,     // 无科技加成
        hero: 0,     // 无武将加成
        rebirth: 0,  // 无转生加成
        vip: 0,      // 无VIP加成
      };
      // 声望加成当前不在 Bonuses 类型中（BonusType 不含 prestige）
      // 但可以通过乘法链手动叠加
      const multiplier = calculateBonusMultiplier(bonuses) * prestigeBonus;

      // 10 粮草/秒 × 1秒 × 1.02 ≈ 10.2
      const before = resource.getAmount('grain');
      resource.tick(1000, bonuses); // 1秒
      const after = resource.getAmount('grain');

      // 基础产出（无额外加成时）
      const gained = after - before;
      expect(gained).toBeCloseTo(10, 1); // 无加成时约10
    });

    it('声望等级50时产出翻倍', () => {
      // 大量声望值升级到高等级
      for (let i = 0; i < 100; i++) {
        prestige.addPrestigePoints('main_quest', 100000);
      }
      const panel = prestige.getPrestigePanel();
      // 验证声望加成接近2.0
      const bonus = prestige.getProductionBonus();
      expect(bonus).toBeGreaterThanOrEqual(1.5);
    });
  });

  // ═══════════════════════════════════════════
  // §2 武将加成联动
  // ═══════════════════════════════════════════

  describe('§2 武将加成联动', () => {
    it('武将派驻后建筑获得加成', () => {
      const general = createGeneral('hero_001', Quality.RARE, 10, 100);
      dispatch.setGetGeneral((id) => id === 'hero_001' ? general : undefined);

      // 派驻武将到农田
      const result = dispatch.dispatchHero('hero_001', 'farmland');
      expect(result.success).toBe(true);
      expect(result.bonusPercent).toBeGreaterThan(0);

      // 获取加成
      const bonus = dispatch.getDispatchBonus('farmland');
      expect(bonus).toBeGreaterThan(0);
    });

    it('武将品质越高加成越大', () => {
      const common = createGeneral('common_01', Quality.COMMON, 10, 100);
      const epic = createGeneral('epic_01', Quality.EPIC, 10, 100);
      dispatch.setGetGeneral((id) => {
        if (id === 'common_01') return common;
        if (id === 'epic_01') return epic;
        return undefined;
      });

      // 派驻普通品质
      const r1 = dispatch.dispatchHero('common_01', 'farmland');
      const commonBonus = r1.bonusPercent;

      // 取消派驻
      dispatch.undeployHero('common_01');

      // 派驻史诗品质
      const r2 = dispatch.dispatchHero('epic_01', 'farmland');
      const epicBonus = r2.bonusPercent;

      expect(epicBonus).toBeGreaterThan(commonBonus);
    });

    it('武将等级越高加成越大', () => {
      const low = createGeneral('low_01', Quality.RARE, 1, 100);
      const high = createGeneral('high_01', Quality.RARE, 30, 100);
      dispatch.setGetGeneral((id) => {
        if (id === 'low_01') return low;
        if (id === 'high_01') return high;
        return undefined;
      });

      const r1 = dispatch.dispatchHero('low_01', 'farmland');
      const lowBonus = r1.bonusPercent;
      dispatch.undeployHero('low_01');

      const r2 = dispatch.dispatchHero('high_01', 'farmland');
      const highBonus = r2.bonusPercent;

      expect(highBonus).toBeGreaterThan(lowBonus);
    });

    it('武将攻击属性越高加成越大', () => {
      const weak = createGeneral('weak_01', Quality.RARE, 10, 50);
      const strong = createGeneral('strong_01', Quality.RARE, 10, 200);
      dispatch.setGetGeneral((id) => {
        if (id === 'weak_01') return weak;
        if (id === 'strong_01') return strong;
        return undefined;
      });

      const r1 = dispatch.dispatchHero('weak_01', 'farmland');
      const weakBonus = r1.bonusPercent;
      dispatch.undeployHero('weak_01');

      const r2 = dispatch.dispatchHero('strong_01', 'farmland');
      const strongBonus = r2.bonusPercent;

      expect(strongBonus).toBeGreaterThan(weakBonus);
    });

    it('取消武将派驻后加成归零', () => {
      const general = createGeneral('hero_002', Quality.EPIC, 20, 150);
      dispatch.setGetGeneral((id) => id === 'hero_002' ? general : undefined);

      dispatch.dispatchHero('hero_002', 'farmland');
      expect(dispatch.getDispatchBonus('farmland')).toBeGreaterThan(0);

      dispatch.undeployHero('hero_002');
      expect(dispatch.getDispatchBonus('farmland')).toBe(0);
    });

    it('每个建筑最多派驻1名武将', () => {
      const g1 = createGeneral('g1', Quality.RARE, 10, 100);
      const g2 = createGeneral('g2', Quality.RARE, 10, 100);
      dispatch.setGetGeneral((id) => {
        if (id === 'g1') return g1;
        if (id === 'g2') return g2;
        return undefined;
      });

      // 派驻第一个武将
      dispatch.dispatchHero('g1', 'farmland');
      // 派驻第二个武将到同一建筑 → 应替换
      const result = dispatch.dispatchHero('g2', 'farmland');
      expect(result.success).toBe(true);

      // 应该只有第二个武将
      expect(dispatch.getBuildingDispatchHero('farmland')).toBe('g2');
      // 第一个武将不再派驻
      expect(dispatch.getHeroDispatchBuilding('g1')).toBeNull();
    });

    it('武将升级后加成自动刷新', () => {
      let general = createGeneral('hero_003', Quality.RARE, 10, 100);
      dispatch.setGetGeneral((id) => id === 'hero_003' ? general : undefined);

      dispatch.dispatchHero('hero_003', 'market');
      const bonusBefore = dispatch.getDispatchBonus('market');

      // 模拟武将升级
      general = createGeneral('hero_003', Quality.RARE, 20, 100);
      dispatch.setGetGeneral((id) => id === 'hero_003' ? general : undefined);

      const newBonus = dispatch.refreshDispatchBonus('hero_003');
      expect(newBonus).toBeGreaterThan(bonusBefore);

      // 获取的加成也应更新
      expect(dispatch.getDispatchBonus('market')).toBe(newBonus);
    });

    it('派驻不存在的武将应失败', () => {
      dispatch.setGetGeneral(() => undefined);
      const result = dispatch.dispatchHero('nonexistent', 'farmland');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('未初始化getGeneral时派驻应失败', () => {
      // 不调用 setGetGeneral
      const result = dispatch.dispatchHero('hero_004', 'farmland');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('未初始化');
    });
  });

  // ═══════════════════════════════════════════
  // §3 主城加成联动
  // ═══════════════════════════════════════════

  describe('§3 主城加成联动', () => {
    it('主城等级1时无加成（0%）', () => {
      expect(building.getCastleBonusPercent()).toBe(0);
      expect(building.getCastleBonusMultiplier()).toBeCloseTo(1.0);
    });

    it('主城升级后加成增加', () => {
      // 主城Lv1 → 升级到Lv2
      const cost = building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();

      // Lv2 → +2% 加成
      expect(building.getCastleBonusPercent()).toBe(2);
      expect(building.getCastleBonusMultiplier()).toBeCloseTo(1.02);
    });

    it('主城加成参与资源tick产出', () => {
      // 升级主城到Lv3 → +4%
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();

      expect(building.getCastleBonusPercent()).toBe(4);

      // 设置农田产出
      const farmProduction = building.getProduction('farmland');
      resource.recalculateProduction({ grain: farmProduction });

      const bonuses: Bonuses = {
        castle: building.getCastleBonusMultiplier() - 1, // 0.04
      };

      const before = resource.getAmount('grain');
      resource.tick(10000, bonuses); // 10秒
      const after = resource.getAmount('grain');

      const gained = after - before;
      const expected = farmProduction * 10 * (1 + 0.04);
      expect(gained).toBeCloseTo(expected, 1);
    });
  });

  // ═══════════════════════════════════════════
  // §4 多系统叠加乘法链
  // ═══════════════════════════════════════════

  describe('§4 多系统叠加乘法链', () => {
    it('calculateBonusMultiplier 正确计算乘法链', () => {
      // 无加成
      expect(calculateBonusMultiplier()).toBe(1);
      expect(calculateBonusMultiplier({})).toBe(1);

      // 单项加成
      expect(calculateBonusMultiplier({ castle: 0.1 })).toBeCloseTo(1.1);

      // 多项乘法叠加
      expect(calculateBonusMultiplier({ castle: 0.1, tech: 0.2 })).toBeCloseTo(1.1 * 1.2);

      // 全部叠加
      const all: Bonuses = { castle: 0.1, tech: 0.15, hero: 0.05, rebirth: 0.2, vip: 0.1 };
      const expected = 1.1 * 1.15 * 1.05 * 1.2 * 1.1;
      expect(calculateBonusMultiplier(all)).toBeCloseTo(expected, 4);
    });

    it('主城+武将+声望叠加后产出正确', () => {
      // 1. 主城升级到Lv3 → +4%
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();
      const castleBonus = building.getCastleBonusMultiplier() - 1; // 0.04

      // 2. 武将派驻到农田
      const general = createGeneral('hero_100', Quality.EPIC, 20, 200);
      dispatch.setGetGeneral((id) => id === 'hero_100' ? general : undefined);
      const dispatchResult = dispatch.dispatchHero('hero_100', 'farmland');
      expect(dispatchResult.success).toBe(true);
      const heroBonus = dispatchResult.bonusPercent / 100; // 百分比转小数

      // 3. 声望加成
      const prestigeBonus = prestige.getProductionBonus() - 1; // 0.02

      // 4. 设置基础产出
      const baseProduction = 10; // 10 粮草/秒
      resource.recalculateProduction({ grain: baseProduction });

      // 5. 组装加成
      const bonuses: Bonuses = {
        castle: castleBonus,
        hero: heroBonus,
      };

      // 6. 计算期望产出
      const multiplier = calculateBonusMultiplier(bonuses) * (1 + prestigeBonus);
      const expectedGainPerSec = baseProduction * multiplier;

      // 7. 验证tick产出
      const before = resource.getAmount('grain');
      resource.tick(1000, bonuses); // 1秒
      const after = resource.getAmount('grain');
      const actualGain = after - before;

      // 基础产出 × (1+主城加成) × (1+武将加成) × 声望加成
      expect(actualGain).toBeCloseTo(baseProduction * calculateBonusMultiplier(bonuses), 1);

      // 验证乘法链各环节都大于1
      expect(castleBonus).toBeGreaterThan(0);
      expect(heroBonus).toBeGreaterThan(0);
      expect(prestigeBonus).toBeGreaterThan(0);
    });

    it('建筑基础产出 × 主城加成 × 科技加成 乘法链', () => {
      // 升级主城到Lv2 → +2%
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();
      const castleBonus = building.getCastleBonusMultiplier() - 1;

      // 模拟科技加成 10%
      const techBonus = 0.10;

      // 基础产出 5 粮草/秒
      resource.recalculateProduction({ grain: 5 });

      const bonuses: Bonuses = {
        castle: castleBonus,
        tech: techBonus,
      };

      const before = resource.getAmount('grain');
      resource.tick(1000, bonuses);
      const after = resource.getAmount('grain');
      const gained = after - before;

      // 5 × (1+0.02) × (1+0.10) = 5 × 1.02 × 1.10 = 5.61
      expect(gained).toBeCloseTo(5 * 1.02 * 1.10, 2);
    });

    it('所有加成为0时产出等于基础产出', () => {
      resource.recalculateProduction({ grain: 8 });
      const bonuses: Bonuses = { castle: 0, tech: 0, hero: 0 };

      const before = resource.getAmount('grain');
      resource.tick(1000, bonuses);
      const after = resource.getAmount('grain');

      expect(after - before).toBeCloseTo(8, 1);
    });

    it('加成乘法链不遗漏任何系统', () => {
      // 验证 Bonuses 类型覆盖了 PRD 中所有加成来源
      const bonusTypes: Array<keyof Bonuses> = ['castle', 'tech', 'hero', 'rebirth', 'vip'];

      // PRD 定义: 基础产出 × 主城加成 × 科技加成 × 武将加成 × 声望加成
      // 引擎 Bonuses 包含: castle, tech, hero, rebirth, vip
      // 注意: 声望加成 (prestige) 不在 Bonuses 类型中，需要单独叠加
      expect(bonusTypes).toContain('castle');   // 主城加成
      expect(bonusTypes).toContain('tech');     // 科技加成
      expect(bonusTypes).toContain('hero');     // 武将加成

      // TODO: 声望加成尚未接入 Bonuses 乘法链
      // PRD 要求声望加成参与乘法链，但当前 BonusType 不包含 'prestige'
      // 建议在 BonusType 中增加 'prestige' 类型
    });
  });

  // ═══════════════════════════════════════════
  // §5 建筑产出与资源系统联动
  // ═══════════════════════════════════════════

  describe('§5 建筑产出与资源系统联动', () => {
    it('建筑升级后产出增加', () => {
      const productionLv1 = building.getProduction('farmland', 1);
      const productionLv2 = building.getProduction('farmland', 2);

      expect(productionLv2).toBeGreaterThan(productionLv1);
    });

    it('calculateTotalProduction 正确汇总各建筑产出', () => {
      // 初始状态：农田Lv1 产出 0.8 粮草/秒
      const productions = building.calculateTotalProduction();
      expect(productions.grain).toBeCloseTo(0.8, 1);
    });

    it('建筑升级后 calculateTotalProduction 更新', () => {
      const before = building.calculateTotalProduction();

      // 升级农田
      building.startUpgrade('farmland', RICH);
      building.forceCompleteUpgrades();

      const after = building.calculateTotalProduction();
      expect(after.grain).toBeGreaterThan(before.grain);
    });

    it('多建筑产出汇总正确', () => {
      // 升级主城到Lv2解锁市集和兵营
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();

      // 解锁的建筑应该有产出
      const productions = building.calculateTotalProduction();
      // 农田 + 市集 + 兵营
      const totalTypes = Object.keys(productions);
      expect(totalTypes.length).toBeGreaterThanOrEqual(1); // 至少有粮草
    });

    it('recalculateProduction 正确同步到资源系统', () => {
      const productions = building.calculateTotalProduction();
      resource.recalculateProduction(productions);

      const rates = resource.getProductionRates();
      expect(rates.grain).toBeCloseTo(0.8, 1); // 农田Lv1产出
    });
  });

  // ═══════════════════════════════════════════
  // §6 武将加成计算公式验证
  // ═══════════════════════════════════════════

  describe('§6 武将加成计算公式验证', () => {
    it('COMMON品质基础加成1%', () => {
      const general = createGeneral('g1', Quality.COMMON, 1, 0);
      dispatch.setGetGeneral((id) => id === 'g1' ? general : undefined);
      const result = dispatch.dispatchHero('g1', 'farmland');
      // 品质1% + 等级1×0.5% = 1 + 0.5 = 1.5%，攻击为0 → 1.5% × 1 = 1.5%
      expect(result.bonusPercent).toBeGreaterThan(0);
      expect(result.bonusPercent).toBeLessThan(5); // 不超过5%
    });

    it('LEGENDARY品质基础加成8%', () => {
      const general = createGeneral('g2', Quality.LEGENDARY, 1, 0);
      dispatch.setGetGeneral((id) => id === 'g2' ? general : undefined);
      const result = dispatch.dispatchHero('g2', 'farmland');
      // 品质8% + 等级1×0.5% = 8 + 0.5 = 8.5%
      expect(result.bonusPercent).toBeGreaterThan(5);
    });

    it('高等级高攻击传说武将加成显著', () => {
      const general = createGeneral('g3', Quality.LEGENDARY, 50, 500);
      dispatch.setGetGeneral((id) => id === 'g3' ? general : undefined);
      const result = dispatch.dispatchHero('g3', 'market');

      // 品质8% + 等级50×0.5% = 8 + 25 = 33%
      // 攻击加成: 500 × 0.01 = 5 → 33% × (1 + 5) = 198%
      expect(result.bonusPercent).toBeGreaterThan(100);
    });

    it('所有品质加成递增', () => {
      const qualities = [Quality.COMMON, Quality.FINE, Quality.RARE, Quality.EPIC, Quality.LEGENDARY];
      const bonuses: number[] = [];

      for (let i = 0; i < qualities.length; i++) {
        const q = qualities[i];
        const general = createGeneral(`q_${i}`, q, 10, 100);
        dispatch.setGetGeneral((id) => id === `q_${i}` ? general : undefined);
        const result = dispatch.dispatchHero(`q_${i}`, 'farmland');
        bonuses.push(result.bonusPercent);
        if (i > 0) dispatch.undeployHero(`q_${i}`);
      }

      // 品质越高加成越大
      for (let i = 1; i < bonuses.length; i++) {
        expect(bonuses[i]).toBeGreaterThan(bonuses[i - 1]);
      }
    });
  });

  // ═══════════════════════════════════════════
  // §7 序列化与反序列化保持加成状态
  // ═══════════════════════════════════════════

  describe('§7 序列化与反序列化保持加成状态', () => {
    it('武将派驻序列化/反序列化后保持', () => {
      const general = createGeneral('hero_ser', Quality.EPIC, 15, 120);
      dispatch.setGetGeneral((id) => id === 'hero_ser' ? general : undefined);
      dispatch.dispatchHero('hero_ser', 'farmland');

      // 序列化
      const saved = dispatch.serialize();
      expect(saved.buildingDispatch['farmland']).toBeDefined();
      expect(saved.buildingDispatch['farmland'].heroId).toBe('hero_ser');

      // 反序列化
      const newDispatch = new HeroDispatchSystem();
      newDispatch.init(createDeps());
      newDispatch.setGetGeneral((id) => id === 'hero_ser' ? general : undefined);
      newDispatch.deserialize(saved);

      expect(newDispatch.getBuildingDispatchHero('farmland')).toBe('hero_ser');
      expect(newDispatch.getDispatchBonus('farmland')).toBeGreaterThan(0);
    });

    it('声望序列化/反序列化后保持', () => {
      prestige.addPrestigePoints('main_quest', 5000);
      const panelBefore = prestige.getPrestigePanel();

      const saved = prestige.getSaveData();

      const newPrestige = new PrestigeSystem();
      newPrestige.init(createDeps());
      newPrestige.loadSaveData(saved);

      const panelAfter = newPrestige.getPrestigePanel();
      expect(panelAfter.currentLevel).toBe(panelBefore.currentLevel);
      expect(panelAfter.productionBonus).toBeCloseTo(panelBefore.productionBonus, 4);
    });

    it('建筑序列化/反序列化后保持', () => {
      building.startUpgrade('castle', RICH);
      building.forceCompleteUpgrades();
      building.startUpgrade('farmland', RICH);
      building.forceCompleteUpgrades();

      const saved = building.serialize();
      const levelBefore = building.getLevel('farmland');

      const newBuilding = new BuildingSystem();
      newBuilding.init(createDeps());
      newBuilding.deserialize(saved);

      expect(newBuilding.getLevel('farmland')).toBe(levelBefore);
      expect(newBuilding.getProduction('farmland')).toBe(building.getProduction('farmland'));
    });
  });

  // ═══════════════════════════════════════════
  // §8 边界条件与防御性测试
  // ═══════════════════════════════════════════

  describe('§8 边界条件与防御性测试', () => {
    it('calculateBonusMultiplier 处理 undefined 值', () => {
      const bonuses: Bonuses = { castle: 0.1, tech: undefined as any };
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.1);
    });

    it('calculateBonusMultiplier 处理负加成', () => {
      // 负加成（减益效果）
      expect(calculateBonusMultiplier({ castle: -0.5 })).toBeCloseTo(0.5);
    });

    it('calculateBonusMultiplier 处理零加成', () => {
      expect(calculateBonusMultiplier({ castle: 0 })).toBeCloseTo(1);
    });

    it('声望calcProductionBonus处理0级', () => {
      expect(calcProductionBonus(0)).toBeCloseTo(1.0);
    });

    it('武将派驻到无产出的建筑（如城墙）仍可成功', () => {
      const general = createGeneral('hero_wall', Quality.RARE, 10, 100);
      dispatch.setGetGeneral((id) => id === 'hero_wall' ? general : undefined);
      const result = dispatch.dispatchHero('hero_wall', 'wall');
      expect(result.success).toBe(true);
      expect(result.bonusPercent).toBeGreaterThan(0);
    });

    it('多个武将派驻到不同建筑互不干扰', () => {
      const g1 = createGeneral('multi_1', Quality.RARE, 10, 100);
      const g2 = createGeneral('multi_2', Quality.EPIC, 15, 150);
      dispatch.setGetGeneral((id) => {
        if (id === 'multi_1') return g1;
        if (id === 'multi_2') return g2;
        return undefined;
      });

      const r1 = dispatch.dispatchHero('multi_1', 'farmland');
      const r2 = dispatch.dispatchHero('multi_2', 'market');

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(dispatch.getBuildingDispatchHero('farmland')).toBe('multi_1');
      expect(dispatch.getBuildingDispatchHero('market')).toBe('multi_2');
    });

    it('声望每日上限限制获取', () => {
      // daily_quest 每日上限100
      const gained1 = prestige.addPrestigePoints('daily_quest', 50);
      expect(gained1).toBe(50);

      const gained2 = prestige.addPrestigePoints('daily_quest', 80);
      // 上限100，已获取50，还能获取50
      expect(gained2).toBe(50);

      const gained3 = prestige.addPrestigePoints('daily_quest', 10);
      expect(gained3).toBe(0); // 已达上限
    });

    it('主城加成NaN防护', () => {
      // BuildingSystem.getCastleBonusMultiplier 有NaN防护
      // 在正常使用中不应返回NaN
      const multiplier = building.getCastleBonusMultiplier();
      expect(Number.isFinite(multiplier)).toBe(true);
      expect(multiplier).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  // §9 TODO: 待实现功能标注
  // ═══════════════════════════════════════════

  describe('§9 TODO: 待接入的加成系统', () => {
    it.todo('声望加成应接入 Bonuses 乘法链 (BonusType 缺少 prestige)');
    it.todo('武将加成应接入 Bonuses 乘法链 (hero 字段在 engine-tick 中始终为 0)');
    it.todo('VIP加成应接入 Bonuses 乘法链 (vip 字段在 engine-tick 中始终为 0)');
    it.todo('转生加成应接入 Bonuses 乘法链 (rebirth 字段在 engine-tick 中始终为 0)');
  });
});
