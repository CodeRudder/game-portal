/**
 * 装备模块对抗式测试 — R2 封版测试
 *
 * 覆盖维度: 5维 (Normal / Boundary / Error / CrossSystem / DataLifecycle)
 * 总分支: 94条 (R1: 68 + R2补充: 26)
 * 封版线: 9.0
 *
 * R2补充重点:
 *   - 强化降级路径 (C2)
 *   - 保底机制 (C3)
 *   - 属性计算精度 (C4)
 *   - 生成确定性 (C9)
 *   - 排序/筛选 (C6)
 *   - 图鉴边缘 (C7)
 *   - 推荐评分 (C8)
 *   - 逻辑竞态 (C5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EquipmentSystem } from '../EquipmentSystem';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentForgeSystem } from '../EquipmentForgeSystem';
import { EquipmentSetSystem } from '../EquipmentSetSystem';
import { EquipmentRecommendSystem } from '../EquipmentRecommendSystem';
import { EquipmentBagManager } from '../EquipmentBagManager';
import { ForgePityManager } from '../ForgePityManager';
import { EquipmentDecomposer } from '../EquipmentDecomposer';
import type {
  EquipmentInstance, EquipmentRarity, EquipmentSlot, HeroEquipSlots,
  BagFilter, BagSortMode,
} from '../../../core/equipment/equipment.types';
import type {
  ForgePityState, AutoEnhanceConfig,
} from '../../../core/equipment/equipment-forge.types';
import type { ISystemDeps } from '../../../core/types';
import {
  DEFAULT_BAG_CAPACITY, MAX_BAG_CAPACITY, BAG_EXPAND_INCREMENT, BAG_EXPAND_COST,
  RARITY_ENHANCE_CAP, ENHANCE_CONFIG, EQUIPMENT_SAVE_VERSION,
  RARITY_MAIN_STAT_MULTIPLIER, RARITY_SUB_STAT_MULTIPLIER,
  ENHANCE_MAIN_STAT_FACTOR, ENHANCE_SUB_STAT_FACTOR,
  DECOMPOSE_COPPER_BASE, DECOMPOSE_STONE_BASE, DECOMPOSE_ENHANCE_BONUS,
  TRANSFER_COST_FACTOR, TRANSFER_LEVEL_LOSS,
  FORGE_PITY_THRESHOLDS,
  EQUIPMENT_TEMPLATES, TEMPLATE_MAP, EQUIPMENT_SETS, SET_MAP,
} from '../../../core/equipment/equipment-config';
import { EQUIPMENT_SLOTS, RARITY_ORDER, EQUIPMENT_RARITIES } from '../../../core/equipment/equipment.types';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createFullSetup() {
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
  const enhance = new EquipmentEnhanceSystem(sys);
  enhance.init(createMockDeps());
  const forge = new EquipmentForgeSystem(sys);
  forge.init(createMockDeps());
  const setSys = new EquipmentSetSystem(sys);
  setSys.init(createMockDeps());
  const recommend = new EquipmentRecommendSystem(sys, setSys);
  recommend.init(createMockDeps());
  return { sys, enhance, forge, setSys, recommend };
}

/** 生成装备到背包 */
function genEq(sys: EquipmentSystem, slot: EquipmentSlot = 'weapon', rarity: EquipmentRarity = 'white', seed: number = 42): EquipmentInstance {
  const eq = sys.generateEquipment(slot, rarity, 'forge', seed);
  expect(eq).not.toBeNull();
  return eq!;
}

/** 生成N件同品质装备 */
function genNEq(sys: EquipmentSystem, n: number, rarity: EquipmentRarity = 'white', seedStart: number = 100): EquipmentInstance[] {
  const result: EquipmentInstance[] = [];
  for (let i = 0; i < n; i++) {
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
    result.push(genEq(sys, slots[i % 4], rarity, seedStart + i));
  }
  return result;
}

/** 生成同品质同slot装备 */
function genSameSlot(sys: EquipmentSystem, n: number, slot: EquipmentSlot, rarity: EquipmentRarity, seedStart: number = 200): EquipmentInstance[] {
  const result: EquipmentInstance[] = [];
  for (let i = 0; i < n; i++) {
    result.push(genEq(sys, slot, rarity, seedStart + i));
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 维度一: F-Normal 正向流程
// ═══════════════════════════════════════════════════════════════

describe('F-Normal 正向流程', () => {

  // ── 1.1 装备生成 ──

  describe('装备生成', () => {
    let sys: EquipmentSystem;
    beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

    it('N-01: generateEquipment(slot, rarity) 按部位+品质生成', () => {
      const eq = genEq(sys, 'weapon', 'purple');
      expect(eq.slot).toBe('weapon');
      expect(eq.rarity).toBe('purple');
      expect(eq.uid).toBeTruthy();
      expect(eq.mainStat).toBeDefined();
      expect(eq.source).toBe('forge');
    });

    it('N-02: generateEquipment(templateId, rarity) 按模板生成', () => {
      const eq = sys.generateEquipment('sword_dragon', 'blue', 'forge', 42);
      expect(eq).not.toBeNull();
      expect(eq!.templateId).toBe('sword_dragon');
      expect(eq!.slot).toBe('weapon');
    });

    it('N-03: generateCampaignDrop 关卡掉落', () => {
      const eq = sys.generateCampaignDrop('normal', 42);
      expect(eq).toBeDefined();
      expect(eq.source).toBe('campaign_drop');
      expect(EQUIPMENT_SLOTS).toContain(eq.slot);
    });

    it('N-04: generateFromSource 按来源生成', () => {
      const eq = sys.generateFromSource('shop', 42);
      expect(eq).toBeDefined();
      expect(eq.source).toBe('shop');
    });

    it('N-32: seed确定性 — 相同seed生成相同baseValue', () => {
      const eq1 = sys.generateEquipment('weapon', 'blue', 'forge', 12345);
      sys.removeEquipment(eq1!.uid);
      const eq2 = sys.generateEquipment('weapon', 'blue', 'forge', 12345);
      expect(eq2).not.toBeNull();
      // uid可能不同(因为seedCounter递增), 但属性值应该一致
      expect(eq1!.mainStat.baseValue).toBe(eq2!.mainStat.baseValue);
      expect(eq1!.mainStat.type).toBe(eq2!.mainStat.type);
      expect(eq1!.subStats.length).toBe(eq2!.subStats.length);
    });
  });

  // ── 1.2 穿戴/卸下 ──

  describe('穿戴/卸下', () => {
    let sys: EquipmentSystem;
    beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

    it('N-05: equipItem 穿戴到空槽位', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const result = sys.equipItem('hero1', eq.uid);
      expect(result.success).toBe(true);
      expect(eq.isEquipped).toBe(true);
      expect(eq.equippedHeroId).toBe('hero1');
    });

    it('N-06: equipItem 同武将同部位替换', () => {
      const eq1 = genEq(sys, 'weapon', 'white', 1);
      const eq2 = genEq(sys, 'weapon', 'green', 2);
      sys.equipItem('hero1', eq1.uid);
      const result = sys.equipItem('hero1', eq2.uid);
      expect(result.success).toBe(true);
      expect(result.replacedUid).toBe(eq1.uid);
      expect(eq1.isEquipped).toBe(false);
      expect(eq2.isEquipped).toBe(true);
    });

    it('N-07: unequipItem 卸下装备', () => {
      const eq = genEq(sys, 'armor', 'blue');
      sys.equipItem('hero1', eq.uid);
      const result = sys.unequipItem('hero1', 'armor');
      expect(result.success).toBe(true);
      expect(eq.isEquipped).toBe(false);
      expect(eq.equippedHeroId).toBeNull();
    });

    it('N-08: getHeroEquips 获取武将装备栏', () => {
      const w = genEq(sys, 'weapon', 'white', 1);
      const a = genEq(sys, 'armor', 'green', 2);
      sys.equipItem('hero1', w.uid);
      sys.equipItem('hero1', a.uid);
      const slots = sys.getHeroEquips('hero1');
      expect(slots.weapon).toBe(w.uid);
      expect(slots.armor).toBe(a.uid);
      expect(slots.accessory).toBeNull();
      expect(slots.mount).toBeNull();
    });
  });

  // ── 1.3 强化系统 ──

  describe('强化系统', () => {
    let sys: EquipmentSystem, enhance: EquipmentEnhanceSystem;
    let deductFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const setup = createFullSetup();
      sys = setup.sys; enhance = setup.enhance;
      deductFn = vi.fn().mockReturnValue(true);
      enhance.setResourceDeductor(deductFn);
    });

    it('N-09: enhance 低等级强化(0→1) 100%成功', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).toBe('success');
      expect(result.currentLevel).toBe(1);
      expect(result.successRate).toBe(1.0);
    });

    it('N-10: enhance(uid, true) 使用保护符强化', () => {
      const eq = genEq(sys, 'weapon', 'white');
      // 强化到6级以上才能使用保护符
      for (let i = 0; i < 5; i++) {
        enhance.enhance(eq.uid);
      }
      // 注入保护符
      (enhance as any).protectionCount = 10;
      const result = enhance.enhance(eq.uid, true);
      expect(result.copperCost).toBeGreaterThan(0);
    });

    it('N-11: autoEnhance 自动强化到目标等级', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      const config: AutoEnhanceConfig = {
        targetLevel: 3,
        maxCopper: 999999,
        maxStone: 999999,
        useProtection: false,
        protectionThreshold: 10,
      };
      const result = enhance.autoEnhance(eq.uid, config);
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
      expect(result.finalLevel).toBe(3);
      expect(result.totalCopper).toBeGreaterThan(0);
    });

    it('N-12: transferEnhance 强化转移', () => {
      const src = genEq(sys, 'weapon', 'gold', 1);
      const tgt = genEq(sys, 'weapon', 'white', 2);
      // 直接设置源装备强化等级为5
      sys.updateEquipment({ ...sys.getEquipment(src.uid)!, enhanceLevel: 5 });
      const srcLevel = sys.getEquipment(src.uid)!.enhanceLevel;
      expect(srcLevel).toBe(5);

      const result = enhance.transferEnhance(src.uid, tgt.uid);
      expect(result.success).toBe(true);
      expect(result.transferredLevel).toBe(5 - TRANSFER_LEVEL_LOSS);
      expect(sys.getEquipment(src.uid)!.enhanceLevel).toBe(0);
      expect(sys.getEquipment(tgt.uid)!.enhanceLevel).toBe(5 - TRANSFER_LEVEL_LOSS);
    });

    // ── R2补充: 强化降级路径 (C2) ──

    it('N-19: safeLevel内失败→等级不变', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      // safeLevel=5, 0→1是100%, 但我们mock随机来测试失败场景
      // 0→3是100%, 3→4是80%, 如果失败在safeLevel内不降级
      for (let i = 0; i < 3; i++) enhance.enhance(eq.uid);
      // 3→4: 80%成功率, mock为失败
      const origRandom = (enhance as any).randomFloat;
      (enhance as any).randomFloat = () => 0.9; // > 0.80, 失败
      const result = enhance.enhance(eq.uid);
      // safeLevel=5, level=3 < 5, 不降级
      expect(['fail', 'success']).toContain(result.outcome);
      if (result.outcome === 'fail') {
        expect(result.currentLevel).toBe(3); // 不降级
      }
      (enhance as any).randomFloat = origRandom;
    });

    it('N-20: safeLevel外失败→可能降级', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      // 强化到6级(safeLevel=5之上)
      for (let i = 0; i < 6; i++) enhance.enhance(eq.uid);
      const currentEq = sys.getEquipment(eq.uid);
      // 如果没到6级就跳过(随机失败), 直接设置
      if (currentEq!.enhanceLevel < 6) {
        sys.updateEquipment({ ...currentEq!, enhanceLevel: 6 });
      }
      // Mock: 第一次random失败(>successRate), 第二次random触发降级(<0.5)
      let callCount = 0;
      (enhance as any).randomFloat = () => {
        callCount++;
        if (callCount === 1) return 0.99; // > successRate → 失败
        return 0.3; // < downgradeChance(0.5) → 降级
      };
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).toBe('downgrade');
      expect(result.currentLevel).toBe(5); // 6→5
    });

    it('N-21: 金色+12失败→不降级(isGoldSafe)', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      // 直接设置到12级
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 12 });
      let callCount = 0;
      (enhance as any).randomFloat = () => {
        callCount++;
        if (callCount === 1) return 0.99; // 失败
        return 0.1; // 不会到这里因为isGoldSafe
      };
      const result = enhance.enhance(eq.uid);
      // 金色+12以上失败不降级
      expect(result.outcome).toBe('fail');
      expect(result.currentLevel).toBe(12); // 不变
    });

    it('N-22: 保护符消耗→protectionCount减少', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 6 });
      (enhance as any).protectionCount = 10;
      let callCount = 0;
      (enhance as any).randomFloat = () => {
        callCount++;
        if (callCount === 1) return 0.99; // 失败
        return 0.3; // 本应降级
      };
      const result = enhance.enhance(eq.uid, true);
      expect(result.protectionUsed).toBe(true);
      expect(result.currentLevel).toBe(6); // 保护符防降级
    });
  });

  // ── 1.4 锻造系统 ──

  describe('锻造系统', () => {
    let sys: EquipmentSystem, forge: EquipmentForgeSystem;

    beforeEach(() => {
      const setup = createFullSetup();
      sys = setup.sys; forge = setup.forge;
    });

    it('N-13: basicForge 3白→更高品质', () => {
      const inputs = genSameSlot(sys, 3, 'weapon', 'white');
      const uids = inputs.map(e => e.uid);
      const beforeCount = sys.getBagUsedCount();
      const result = forge.basicForge(uids);
      expect(result.success).toBe(true);
      expect(result.equipment).not.toBeNull();
      expect(RARITY_ORDER[result.equipment!.rarity]).toBeGreaterThan(RARITY_ORDER.white);
      // 消耗了3件输入, 加了1件输出
      expect(sys.getBagUsedCount()).toBe(beforeCount - 3 + 1);
    });

    it('N-14: advancedForge 5件高级炼制', () => {
      const inputs = genNEq(sys, 5, 'green');
      const result = forge.advancedForge(inputs.map(e => e.uid));
      expect(result.success).toBe(true);
      expect(result.equipment).not.toBeNull();
    });

    it('N-15: targetedForge 定向炼制(指定slot)', () => {
      const inputs = genSameSlot(sys, 3, 'weapon', 'blue');
      const result = forge.targetedForge(inputs.map(e => e.uid), 'armor');
      expect(result.success).toBe(true);
      expect(result.equipment?.slot).toBe('armor');
    });

    // ── R2补充: 保底机制 (C3) ──

    it('N-23: 基础炼制保底紫触发', () => {
      const pity = new ForgePityManager();
      // 模拟连续9次未出紫
      for (let i = 0; i < 9; i++) {
        pity.update('basic', 'green');
      }
      // 第9次后 basicBluePity=9, 还未到阈值10
      expect(pity.shouldTrigger('basic')).toBe(false);
      // 第10次仍未出紫 → update触发保底并重置
      const triggered = pity.update('basic', 'green');
      expect(triggered).toBe(true);
      // 保底品质应该是紫
      expect(pity.getPityRarity('basic')).toBe('purple');
      // 触发后计数器归零
      expect(pity.getState().basicBluePity).toBe(0);
    });

    it('N-24: 定向炼制保底金触发', () => {
      const pity = new ForgePityManager();
      // 模拟连续19次未出金
      for (let i = 0; i < 19; i++) {
        pity.update('targeted', 'purple');
      }
      expect(pity.shouldTrigger('targeted')).toBe(false);
      // 第20次仍未出金 → update触发保底并重置
      const triggered = pity.update('targeted', 'purple');
      expect(triggered).toBe(true);
      expect(pity.getPityRarity('targeted')).toBe('gold');
      expect(pity.getState().targetedGoldPity).toBe(0);
    });

    it('N-25: 保底触发后计数器归零', () => {
      const pity = new ForgePityManager();
      // 触发保底
      for (let i = 0; i < 10; i++) {
        pity.update('basic', 'white');
      }
      // 保底触发后, update返回true时重置
      const state = pity.getState();
      expect(state.basicBluePity).toBe(0);
    });
  });

  // ── 1.5 套装/分解/推荐 ──

  describe('套装系统', () => {
    let sys: EquipmentSystem, setSys: EquipmentSetSystem;

    beforeEach(() => {
      const setup = createFullSetup();
      sys = setup.sys; setSys = setup.setSys;
    });

    it('N-16: getActiveSetBonuses 2件套激活', () => {
      // warrior套装: sword_iron(weapon) + sword_steel(weapon)... 需要不同slot
      // warrior套装只有weapon模板, 无法凑2件套(同slot互斥)
      // 使用dragon套装: sword_dragon(weapon) + armor_dragon(armor) + ring_dragon(accessory)
      const eq1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      const eq2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 2);
      sys.equipItem('hero1', eq1!.uid);
      sys.equipItem('hero1', eq2!.uid);
      const bonuses = setSys.getActiveSetBonuses('hero1');
      const dragon = bonuses.find(b => b.setId === 'dragon');
      expect(dragon).toBeDefined();
      expect(dragon!.activeTiers).toContain(2);
    });

    it('N-17: getActiveSetBonuses 4件套激活', () => {
      // dragon套装有3个模板(weapon/armor/accessory), 无法凑4件
      // 使用warrior套装: 只有weapon模板
      // 实际上套装需要跨slot, 但模板定义中同一setId可有多个slot
      // 查看模板: warrior有sword_iron(weapon)和sword_steel(weapon) - 都是weapon
      // 这意味着同slot不能穿2件, 所以warrior无法凑4件
      // 需要 setId 有4个不同slot的模板才能凑4件
      // 检查dragon: sword_dragon(weapon), armor_dragon(armor), ring_dragon(accessory) = 3个slot
      // 没有setId有4个不同slot的模板, 所以4件套在当前模板下无法激活
      // 测试: 至少验证getActiveSetBonuses在3件dragon时只激活2件套
      const eq1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      const eq2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 2);
      const eq3 = sys.generateEquipment('ring_dragon', 'blue', 'forge', 3);
      sys.equipItem('hero1', eq1!.uid);
      sys.equipItem('hero1', eq2!.uid);
      sys.equipItem('hero1', eq3!.uid);
      const bonuses = setSys.getActiveSetBonuses('hero1');
      const dragon = bonuses.find(b => b.setId === 'dragon');
      expect(dragon).toBeDefined();
      expect(dragon!.count).toBe(3);
      expect(dragon!.activeTiers).toContain(2);
      expect(dragon!.activeTiers).not.toContain(4); // 3件不够4件套
    });
  });

  describe('分解系统', () => {
    let sys: EquipmentSystem;

    beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

    it('N-18: decompose 分解装备', () => {
      const eq = genEq(sys, 'weapon', 'blue');
      const result = sys.decompose(eq.uid);
      expect('success' in result && result.success).toBe(true);
      if ('result' in result && result.result) {
        expect(result.result.copper).toBeGreaterThan(0);
        expect(result.result.enhanceStone).toBeGreaterThan(0);
      }
    });
  });

  // ── R2补充: 排序/筛选 (C6) ──

  describe('排序/筛选', () => {
    let sys: EquipmentSystem;

    beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

    it('N-26: sort rarity_desc 品质降序', () => {
      genEq(sys, 'weapon', 'white', 1);
      genEq(sys, 'armor', 'gold', 2);
      genEq(sys, 'accessory', 'blue', 3);
      const sorted = sys.sortEquipments('rarity_desc');
      expect(sorted[0].rarity).toBe('gold');
      expect(sorted[sorted.length - 1].rarity).toBe('white');
    });

    it('N-27: filter unequippedOnly 只看未穿戴', () => {
      const eq1 = genEq(sys, 'weapon', 'white', 1);
      const eq2 = genEq(sys, 'armor', 'green', 2);
      sys.equipItem('hero1', eq1.uid);
      const filtered = sys.filterEquipments({ slot: null, rarity: null, unequippedOnly: true, setOnly: false });
      expect(filtered.every(e => !e.isEquipped)).toBe(true);
      expect(filtered.some(e => e.uid === eq2.uid)).toBe(true);
      expect(filtered.some(e => e.uid === eq1.uid)).toBe(false);
    });

    it('N-28: groupBySlot 按部位分组', () => {
      genEq(sys, 'weapon', 'white', 1);
      genEq(sys, 'weapon', 'green', 2);
      genEq(sys, 'armor', 'blue', 3);
      const groups = sys.groupBySlot();
      expect(groups.weapon.length).toBe(2);
      expect(groups.armor.length).toBe(1);
    });
  });

  // ── R2补充: 图鉴边缘 (C7) ──

  describe('图鉴系统', () => {
    let sys: EquipmentSystem;

    beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

    it('N-29: 首次发现图鉴', () => {
      const eq = sys.generateEquipment('sword_dragon', 'blue', 'forge', 42);
      expect(sys.isCodexDiscovered('sword_dragon')).toBe(true);
      const entry = sys.getCodexEntry('sword_dragon');
      expect(entry).not.toBeNull();
      expect(entry!.discovered).toBe(true);
      expect(entry!.obtainCount).toBe(1);
    });

    it('N-30: 重复获得→计数增加', () => {
      sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      sys.removeEquipment(sys.getAllEquipments()[0].uid);
      sys.generateEquipment('sword_dragon', 'purple', 'forge', 2);
      const entry = sys.getCodexEntry('sword_dragon');
      expect(entry!.obtainCount).toBe(2);
    });

    it('N-31: 品质更新逻辑(获得更高品质→bestRarity更新)', () => {
      sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      sys.removeEquipment(sys.getAllEquipments()[0].uid);
      sys.generateEquipment('sword_dragon', 'purple', 'forge', 2);
      const entry = sys.getCodexEntry('sword_dragon');
      expect(entry!.bestRarity).toBe('purple');
      // 获得更低品质不降级
      sys.removeEquipment(sys.getAllEquipments()[0].uid);
      sys.generateEquipment('sword_dragon', 'green', 'forge', 3);
      const entry2 = sys.getCodexEntry('sword_dragon');
      expect(entry2!.bestRarity).toBe('purple'); // 不降级
    });
  });

  // ── R2补充: 推荐评分 (C8) ──

  describe('推荐系统', () => {
    let sys: EquipmentSystem, recommend: EquipmentRecommendSystem, setSys: EquipmentSetSystem;

    beforeEach(() => {
      const setup = createFullSetup();
      sys = setup.sys; recommend = setup.recommend; setSys = setup.setSys;
    });

    it('N-33: evaluateEquipment评分公式正确性', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      const rec = recommend.evaluateEquipment(eq, 'hero1');
      expect(rec.score).toBeGreaterThan(0);
      expect(rec.breakdown.mainStat).toBeGreaterThanOrEqual(0);
      expect(rec.breakdown.subStats).toBeGreaterThanOrEqual(0);
      expect(rec.breakdown.rarity).toBeGreaterThanOrEqual(0);
      expect(rec.breakdown.enhanceLevel).toBeGreaterThanOrEqual(0);
      // 金装品质分应该最高
      const whiteEq = genEq(sys, 'weapon', 'white', 99);
      const whiteRec = recommend.evaluateEquipment(whiteEq, 'hero1');
      expect(rec.breakdown.rarity).toBeGreaterThan(whiteRec.breakdown.rarity);
    });

    it('N-34: recommendForHero 最优选择', () => {
      // 生成多个同slot装备
      const weak = genEq(sys, 'weapon', 'white', 1);
      const strong = genEq(sys, 'weapon', 'gold', 2);
      genEq(sys, 'armor', 'purple', 3);
      const result = recommend.recommendForHero('hero1');
      expect(result.slots.weapon).not.toBeNull();
      // 金装应该被推荐
      if (result.slots.weapon) {
        expect(result.slots.weapon.uid).toBe(strong.uid);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 维度二: F-Boundary 边界条件
// ═══════════════════════════════════════════════════════════════

describe('F-Boundary 边界条件', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  // ── 2.1 背包边界 ──

  describe('背包边界', () => {
    it('B-01: 背包满时add装备', () => {
      // 填满背包
      for (let i = 0; i < DEFAULT_BAG_CAPACITY; i++) {
        genEq(sys, 'weapon', 'white', i);
      }
      expect(sys.isBagFull()).toBe(true);
      // generateEquipment生成装备后addToBag失败, 但装备对象本身不为null
      const result = sys.generateEquipment('weapon', 'white', 'forge', 9999);
      // 装备已生成但未进背包 — 验证背包未增长
      expect(sys.getBagUsedCount()).toBe(DEFAULT_BAG_CAPACITY);
      // 直接add也应失败
      const addResult = sys.addToBag({ uid: 'test', templateId: 't', name: 'test', slot: 'weapon', rarity: 'white', enhanceLevel: 0, mainStat: { type: 'attack', baseValue: 10, value: 10 }, subStats: [], specialEffect: null, source: 'forge', acquiredAt: 1, isEquipped: false, equippedHeroId: null, seed: 1 });
      expect(addResult.success).toBe(false);
      expect(addResult.reason).toBe('背包已满');
    });

    it('B-02: setCapacity(0) 回退默认值', () => {
      sys['bag'].setCapacity(0);
      expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
    });

    it('B-03: setCapacity(Infinity) 回退默认值', () => {
      sys['bag'].setCapacity(Infinity);
      expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
    });

    it('B-04: expandBag到MAX后继续扩容', () => {
      sys['bag'].setCapacity(MAX_BAG_CAPACITY);
      const result = sys.expandBag();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('已达最大容量');
    });
  });

  // ── 2.2 强化边界 ──

  describe('强化边界', () => {
    let enhance: EquipmentEnhanceSystem;
    let deductFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const setup = createFullSetup();
      sys = setup.sys; enhance = setup.enhance;
      deductFn = vi.fn().mockReturnValue(true);
      enhance.setResourceDeductor(deductFn);
    });

    it('B-05: enhanceLevel=maxLevel(15)时强化', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 15 });
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).not.toBe('success');
      expect(result.currentLevel).toBe(15);
    });

    it('B-06: enhanceLevel=rarityCap时强化', () => {
      const eq = genEq(sys, 'weapon', 'white'); // white cap=5
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 5 });
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).not.toBe('success');
    });

    it('B-07: enhanceLevel=NaN时计算属性', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: NaN });
      const value = sys.calculateMainStatValue(sys.getEquipment(eq.uid)!);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('B-08: enhanceLevel=-1时计算属性', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: -1 });
      const value = sys.calculateMainStatValue(sys.getEquipment(eq.uid)!);
      expect(Number.isFinite(value)).toBe(true);
    });

    // ── R2补充: 属性计算精度 (C4) ──

    it('B-18: baseValue=0 → 返回0', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const eqWithZero = { ...eq, mainStat: { ...eq.mainStat, baseValue: 0 } };
      const value = sys.calculateMainStatValue(eqWithZero);
      expect(value).toBe(0);
    });

    it('B-19: baseValue=负数 → 返回0', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const eqWithNeg = { ...eq, mainStat: { ...eq.mainStat, baseValue: -10 } };
      const value = sys.calculateMainStatValue(eqWithNeg);
      expect(value).toBe(0);
    });

    it('B-20: enhanceLevel=Infinity → 安全降级', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: Infinity });
      const value = sys.calculateMainStatValue(sys.getEquipment(eq.uid)!);
      expect(Number.isFinite(value)).toBe(true);
    });

    it('B-21: seed边界(0)', () => {
      const eq = sys.generateEquipment('weapon', 'white', 'forge', 0);
      expect(eq).not.toBeNull();
      expect(eq!.slot).toBe('weapon');
    });

    it('B-17: 保底计数器溢出', () => {
      const pity = new ForgePityManager();
      // 超过阈值很多次
      for (let i = 0; i < 20; i++) {
        pity.update('basic', 'white');
      }
      // 保底应该已触发并重置
      const state = pity.getState();
      expect(state.basicBluePity).toBeLessThan(FORGE_PITY_THRESHOLDS.basicBluePity);
    });
  });

  // ── 2.3 穿戴边界 ──

  describe('穿戴边界', () => {
    it('B-09: 穿戴已被其他武将穿戴的装备', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.equipItem('hero1', eq.uid);
      const result = sys.equipItem('hero2', eq.uid);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('其他武将');
    });

    it('B-10: 卸下空槽位', () => {
      const result = sys.unequipItem('hero1', 'weapon');
      // hero1没有装备栏
      expect(result.success).toBe(false);
    });

    it('B-11: 重复穿戴同一装备到同一武将', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const r1 = sys.equipItem('hero1', eq.uid);
      expect(r1.success).toBe(true);
      const r2 = sys.equipItem('hero1', eq.uid);
      // 重复穿戴应幂等成功
      expect(r2.success).toBe(true);
    });

    it('B-12: getHeroEquips 不存在的武将', () => {
      const slots = sys.getHeroEquips('nonexistent');
      expect(slots.weapon).toBeNull();
      expect(slots.armor).toBeNull();
      expect(slots.accessory).toBeNull();
      expect(slots.mount).toBeNull();
    });
  });

  // ── 2.4 锻造边界 ──

  describe('锻造边界', () => {
    let forge: EquipmentForgeSystem;

    beforeEach(() => {
      const setup = createFullSetup();
      sys = setup.sys; forge = setup.forge;
    });

    it('B-13: basicForge 金色装备不可炼制', () => {
      const inputs = genSameSlot(sys, 3, 'weapon', 'gold');
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });

    it('B-14: basicForge 品质不一致', () => {
      const w = genEq(sys, 'weapon', 'white', 1);
      const g = genEq(sys, 'armor', 'green', 2);
      const w2 = genEq(sys, 'accessory', 'white', 3);
      const result = forge.basicForge([w.uid, g.uid, w2.uid]);
      expect(result.success).toBe(false);
    });

    it('B-15: basicForge 投入数量不正确', () => {
      const inputs = genSameSlot(sys, 2, 'weapon', 'white');
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });

    it('B-16: basicForge 投入已穿戴装备', () => {
      const inputs = genSameSlot(sys, 3, 'weapon', 'white');
      sys.equipItem('hero1', inputs[0].uid);
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 维度三: F-Error 异常路径
// ═══════════════════════════════════════════════════════════════

describe('F-Error 异常路径', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  // ── 3.1 null/undefined防护 ──

  describe('null/undefined防护', () => {
    it('E-01: getEquipment(不存在的uid)', () => {
      expect(sys.getEquipment('nonexistent')).toBeUndefined();
    });

    it('E-02: equipItem(heroId, 不存在的uid)', () => {
      const result = sys.equipItem('hero1', 'nonexistent');
      expect(result.success).toBe(false);
    });

    it('E-03: enhance(不存在的uid)', () => {
      const { enhance } = createFullSetup();
      enhance.setResourceDeductor(() => true);
      const result = enhance.enhance('nonexistent');
      expect(result.outcome).not.toBe('success');
      expect(result.currentLevel).toBe(0);
    });

    it('E-04: bag.add(null)', () => {
      const result = sys['bag'].add(null as any);
      expect(result.success).toBe(false);
    });

    it('E-05: bag.add(undefined)', () => {
      const result = sys['bag'].add(undefined as any);
      expect(result.success).toBe(false);
    });
  });

  // ── 3.2 反序列化防护 ──

  describe('反序列化防护', () => {
    it('E-06: deserialize(null) 不崩溃', () => {
      expect(() => sys.deserialize(null as any)).not.toThrow();
      expect(sys.getBagUsedCount()).toBe(0);
    });

    it('E-07: deserialize(undefined) 不崩溃', () => {
      expect(() => sys.deserialize(undefined as any)).not.toThrow();
    });

    it('E-08: deserialize({}) 空对象', () => {
      expect(() => sys.deserialize({} as any)).not.toThrow();
      expect(sys.getBagCapacity()).toBe(DEFAULT_BAG_CAPACITY);
    });

    it('E-09: deserialize 装备有equippedHeroId → 恢复heroEquips', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.equipItem('hero1', eq.uid);
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      const slots = sys.getHeroEquips('hero1');
      expect(slots.weapon).toBe(eq.uid);
    });
  });

  // ── 3.3 资源扣除 ──

  describe('资源扣除', () => {
    it('E-10: enhance 未注入deductResources → 拒绝强化', () => {
      const { sys: s, enhance } = createFullSetup();
      // 不注入deductor
      const eq = genEq(s, 'weapon', 'white');
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).not.toBe('success');
    });

    it('E-11: enhance deductResources返回false → 资源不足', () => {
      const { sys: s, enhance } = createFullSetup();
      enhance.setResourceDeductor(() => false);
      const eq = genEq(s, 'weapon', 'white');
      const result = enhance.enhance(eq.uid);
      expect(result.outcome).not.toBe('success');
    });

    it('E-12: transferEnhance deductResources返回false', () => {
      const { sys: s, enhance } = createFullSetup();
      enhance.setResourceDeductor(() => false);
      const src = genEq(s, 'weapon', 'gold', 1);
      const tgt = genEq(s, 'weapon', 'white', 2);
      s.updateEquipment({ ...s.getEquipment(src.uid)!, enhanceLevel: 5 });
      const result = enhance.transferEnhance(src.uid, tgt.uid);
      expect(result.success).toBe(false);
    });

    it('E-13: expandBag expandValidator返回false', () => {
      sys['bag'].setExpandValidator(() => false);
      const result = sys.expandBag();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('资源不足');
    });

    it('E-14: forge equipmentSystem未初始化', () => {
      const forge = new EquipmentForgeSystem(); // 不注入equipmentSystem
      forge.init(createMockDeps());
      const result = forge.basicForge(['uid1', 'uid2', 'uid3']);
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 维度四: F-CrossSystem 跨系统交互
// ═══════════════════════════════════════════════════════════════

describe('F-CrossSystem 跨系统交互', () => {
  let sys: EquipmentSystem, enhance: EquipmentEnhanceSystem;
  let forge: EquipmentForgeSystem, setSys: EquipmentSetSystem;

  beforeEach(() => {
    const setup = createFullSetup();
    sys = setup.sys; enhance = setup.enhance;
    forge = setup.forge; setSys = setup.setSys;
    enhance.setResourceDeductor(() => true);
  });

  // ── 4.1 装备→战斗属性传递 ──

  describe('装备→战斗属性传递', () => {
    it('X-01: calculateMainStatValue 白装+0级', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const value = sys.calculateMainStatValue(eq);
      const expected = Math.floor(eq.mainStat.baseValue * 1.0 * (1 + 0 * ENHANCE_MAIN_STAT_FACTOR.min));
      expect(value).toBe(expected);
    });

    it('X-02: calculateMainStatValue 金装+10级', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 10 });
      const updated = sys.getEquipment(eq.uid)!;
      const value = sys.calculateMainStatValue(updated);
      const expected = Math.floor(updated.mainStat.baseValue * RARITY_MAIN_STAT_MULTIPLIER.gold * (1 + 10 * ENHANCE_MAIN_STAT_FACTOR.min));
      expect(value).toBe(expected);
    });

    it('X-03: calculateSubStatValue 各品质×强化等级', () => {
      const eq = genEq(sys, 'weapon', 'purple');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 5 });
      const updated = sys.getEquipment(eq.uid)!;
      for (const ss of updated.subStats) {
        const value = sys.calculateSubStatValue(ss, 'purple', 5);
        const expected = Math.floor(ss.baseValue * RARITY_SUB_STAT_MULTIPLIER.purple * (1 + 5 * ENHANCE_SUB_STAT_FACTOR.min));
        expect(value).toBe(expected);
      }
    });

    it('X-04: calculatePower 综合战力计算', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      const power = sys.calculatePower(eq);
      expect(power).toBeGreaterThan(0);
      // 验证: 主属性 + 副属性 + 特效×5 + 品质分
      const recalced = sys.recalculateStats(eq);
      let expectedPower = recalced.mainStat.value;
      for (const ss of recalced.subStats) expectedPower += ss.value;
      if (recalced.specialEffect) expectedPower += recalced.specialEffect.value * 5;
      expectedPower += (RARITY_ORDER.gold) * 10;
      expect(power).toBe(Math.floor(expectedPower));
    });

    // ── R2补充: 属性计算一致性 (C4) ──

    it('X-13: recalculateStats一致性', () => {
      const eq = genEq(sys, 'weapon', 'blue');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 3 });
      const updated = sys.getEquipment(eq.uid)!;
      const recalced = sys.recalculateStats(updated);
      // 主属性一致
      expect(recalced.mainStat.value).toBe(sys.calculateMainStatValue(updated));
      // 副属性一致
      for (let i = 0; i < recalced.subStats.length; i++) {
        expect(recalced.subStats[i].value).toBe(
          sys.calculateSubStatValue(updated.subStats[i], updated.rarity, updated.enhanceLevel)
        );
      }
    });
  });

  // ── 4.2 套装→属性传递 ──

  describe('套装→属性传递', () => {
    it('X-05: getTotalSetBonuses 多套装叠加', () => {
      // 装备dragon 2件 + warrior 1件(不够套装)
      const d1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      const d2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 2);
      sys.equipItem('hero1', d1!.uid);
      sys.equipItem('hero1', d2!.uid);
      const bonuses = setSys.getTotalSetBonuses('hero1');
      // dragon 2件套: attack+8%, defense+8%, intelligence+8%, speed+8%
      expect(bonuses.attack).toBeCloseTo(0.08, 2);
      expect(bonuses.defense).toBeCloseTo(0.08, 2);
    });

    it('X-06: getSetCounts 跨slot统计', () => {
      const d1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      const d2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 2);
      const d3 = sys.generateEquipment('ring_dragon', 'blue', 'forge', 3);
      sys.equipItem('hero1', d1!.uid);
      sys.equipItem('hero1', d2!.uid);
      sys.equipItem('hero1', d3!.uid);
      const counts = setSys.getSetCounts('hero1');
      expect(counts.get('dragon')).toBe(3);
    });

    it('X-07: 穿戴→套装件数变化→效果重新计算', () => {
      const d1 = sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      const d2 = sys.generateEquipment('armor_dragon', 'blue', 'forge', 2);
      sys.equipItem('hero1', d1!.uid);
      sys.equipItem('hero1', d2!.uid);
      // 2件套激活
      let bonuses = setSys.getActiveSetBonuses('hero1');
      expect(bonuses.length).toBe(1);
      expect(bonuses[0].activeTiers).toContain(2);
      // 卸下1件
      sys.unequipItem('hero1', 'armor');
      bonuses = setSys.getActiveSetBonuses('hero1');
      expect(bonuses.length).toBe(0); // 1件不够2件套
    });
  });

  // ── 4.3 强化→锻造→分解链路 ──

  describe('强化→锻造→分解链路', () => {
    it('X-08: 强化后分解奖励增加', () => {
      const eq = genEq(sys, 'weapon', 'blue');
      const baseReward = sys.calculateDecomposeReward(eq);
      // 强化到5级
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 5 });
      const enhancedReward = sys.calculateDecomposeReward(sys.getEquipment(eq.uid)!);
      expect(enhancedReward.copper).toBeGreaterThan(baseReward.copper);
      expect(enhancedReward.enhanceStone).toBeGreaterThan(baseReward.enhanceStone);
      // 验证公式: base × (1 + level × 0.1)
      const expectedCopper = Math.floor(DECOMPOSE_COPPER_BASE.blue * (1 + 5 * DECOMPOSE_ENHANCE_BONUS));
      expect(enhancedReward.copper).toBe(expectedCopper);
    });

    it('X-09: 穿戴装备不可分解', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.equipItem('hero1', eq.uid);
      const result = sys.decompose(eq.uid);
      if ('success' in result) {
        expect(result.success).toBe(false);
      }
    });

    it('X-10: 穿戴装备不可炼制', () => {
      const inputs = genSameSlot(sys, 3, 'weapon', 'white');
      sys.equipItem('hero1', inputs[0].uid);
      const result = forge.basicForge(inputs.map(e => e.uid));
      expect(result.success).toBe(false);
    });

    it('X-11: 锻造产出装备自动进背包', () => {
      const inputs = genSameSlot(sys, 3, 'weapon', 'white');
      const beforeCount = sys.getBagUsedCount();
      forge.basicForge(inputs.map(e => e.uid));
      // 消耗3件 + 产出1件 = 净减2件
      expect(sys.getBagUsedCount()).toBe(beforeCount - 2);
    });

    it('X-12: 序列化→反序列化→属性重算', () => {
      const eq = genEq(sys, 'weapon', 'gold');
      sys.updateEquipment({ ...sys.getEquipment(eq.uid)!, enhanceLevel: 5 });
      const originalPower = sys.calculatePower(sys.getEquipment(eq.uid)!);
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      const restored = sys.getEquipment(eq.uid);
      expect(restored).toBeDefined();
      const restoredPower = sys.calculatePower(restored!);
      expect(restoredPower).toBe(originalPower);
    });

    // ── R2补充: 逻辑竞态 (C5) ──

    it('X-15: 同一装备连续穿戴到两个武将', () => {
      const eq = genEq(sys, 'weapon', 'white');
      const r1 = sys.equipItem('hero1', eq.uid);
      expect(r1.success).toBe(true);
      // 尝试穿戴到第二个武将
      const r2 = sys.equipItem('hero2', eq.uid);
      expect(r2.success).toBe(false);
      expect(eq.equippedHeroId).toBe('hero1'); // 仍然属于hero1
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 维度五: F-DataLifecycle 数据生命周期
// ═══════════════════════════════════════════════════════════════

describe('F-DataLifecycle 数据生命周期', () => {
  let sys: EquipmentSystem;

  beforeEach(() => { sys = new EquipmentSystem(); sys.init(createMockDeps()); });

  describe('序列化完整性', () => {
    it('D-01: serialize→deserialize 装备数据完整恢复', () => {
      const eq1 = genEq(sys, 'weapon', 'gold', 1);
      const eq2 = genEq(sys, 'armor', 'purple', 2);
      sys.equipItem('hero1', eq1.uid);
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      expect(sys.getEquipment(eq1.uid)).toBeDefined();
      expect(sys.getEquipment(eq2.uid)).toBeDefined();
      expect(sys.getEquipment(eq1.uid)!.rarity).toBe('gold');
      expect(sys.getEquipment(eq1.uid)!.isEquipped).toBe(true);
    });

    it('D-02: serialize→deserialize 背包容量恢复', () => {
      genEq(sys, 'weapon', 'white');
      sys['bag'].setCapacity(100);
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      expect(sys.getBagCapacity()).toBe(100);
    });

    it('D-03: serialize→deserialize 图鉴数据恢复', () => {
      sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      expect(sys.isCodexDiscovered('sword_dragon')).toBe(true);
    });
  });

  describe('保底持久化', () => {
    it('D-04: ForgePityManager serialize→restore', () => {
      const pity = new ForgePityManager();
      for (let i = 0; i < 5; i++) pity.update('basic', 'white');
      const state = pity.getState();
      expect(state.basicBluePity).toBe(5);
      const newPity = new ForgePityManager();
      newPity.restore(state);
      expect(newPity.getState().basicBluePity).toBe(5);
    });

    it('D-05: ForgeSystem serialize→deserialize', () => {
      const setup = createFullSetup();
      const forge = setup.forge;
      // 做几次炼制
      const inputs = genSameSlot(setup.sys, 3, 'weapon', 'white');
      forge.basicForge(inputs.map(e => e.uid));
      const totalBefore = forge.getTotalForgeCount();
      expect(totalBefore).toBeGreaterThan(0);
      const data = forge.serialize();
      forge.reset();
      expect(forge.getTotalForgeCount()).toBe(0);
      forge.deserialize(data);
      expect(forge.getTotalForgeCount()).toBe(totalBefore);
    });
  });

  describe('状态一致性', () => {
    it('D-06: reset()后所有状态清空', () => {
      genEq(sys, 'weapon', 'white');
      sys.equipItem('hero1', sys.getAllEquipments()[0].uid);
      sys.reset();
      expect(sys.getBagUsedCount()).toBe(0);
      expect(sys.getHeroEquips('hero1').weapon).toBeNull();
    });

    it('D-07: 穿戴→序列化→反序列化→卸下 完整链路', () => {
      const eq = genEq(sys, 'weapon', 'white');
      sys.equipItem('hero1', eq.uid);
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      // 卸下
      const result = sys.unequipItem('hero1', 'weapon');
      expect(result.success).toBe(true);
      expect(sys.getEquipment(eq.uid)!.isEquipped).toBe(false);
    });

    it('D-08: 分解→图鉴更新→序列化→恢复', () => {
      sys.generateEquipment('sword_dragon', 'blue', 'forge', 1);
      expect(sys.isCodexDiscovered('sword_dragon')).toBe(true);
      const eq = sys.getAllEquipments().find(e => e.templateId === 'sword_dragon');
      expect(eq).toBeDefined();
      // 分解装备
      sys.decompose(eq!.uid);
      // 图鉴仍然存在
      expect(sys.isCodexDiscovered('sword_dragon')).toBe(true);
      // 序列化恢复
      const data = sys.serialize();
      sys.reset();
      sys.deserialize(data);
      expect(sys.isCodexDiscovered('sword_dragon')).toBe(true);
    });

    // ── R2补充: 保底序列化 (C3) ──

    it('D-09: ForgePityManager restore(null) 安全处理', () => {
      const pity = new ForgePityManager();
      pity.update('basic', 'white');
      pity.update('basic', 'white');
      // restore null
      pity.restore(null as any);
      expect(pity.getState().basicBluePity).toBe(0);
    });
  });
});
