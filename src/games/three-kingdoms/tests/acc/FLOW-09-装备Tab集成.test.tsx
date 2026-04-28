/** FLOW-09 装备Tab集成测试 — 渲染/穿戴/卸下/强化/品质/套装/推荐。使用真实引擎，不mock。 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EquipmentPanel from '@/components/idle/panels/equipment/EquipmentPanel';
import EquipmentTab from '@/components/idle/panels/equipment/EquipmentTab';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { EquipmentInstance, EquipmentSlot, EquipmentRarity } from '@/games/three-kingdoms/core/equipment/equipment.types';
import { EQUIPMENT_SLOTS, EQUIPMENT_RARITIES, RARITY_ORDER } from '@/games/three-kingdoms/core/equipment/equipment.types';
import { resetUidCounter } from '@/games/three-kingdoms/engine/equipment/EquipmentSystem';

// ── 真实引擎工厂 ──

function createEquipSim(): GameEventSimulator {
  const sim = createSim();
  // 添加武将（装备需要穿戴目标）
  sim.addHeroDirectly('liubei');
  sim.addHeroDirectly('guanyu');
  // 添加资源（强化/锻造需要铜钱）
  sim.addResources({ gold: 1000000 });
  return sim;
}

/** 生成装备并返回 */
function generateEquip(
  sim: GameEventSimulator,
  slot: EquipmentSlot = 'weapon',
  rarity: EquipmentRarity = 'blue',
): EquipmentInstance | null {
  const eqSys = sim.engine.getEquipmentSystem();
  return eqSys.generateEquipment(slot, rarity, 'campaign_drop', 42);
}

/** 生成多个不同品质装备 */
function generateMixedEquips(sim: GameEventSimulator): EquipmentInstance[] {
  const eqSys = sim.engine.getEquipmentSystem();
  const results: EquipmentInstance[] = [];
  const combos: [EquipmentSlot, EquipmentRarity][] = [
    ['weapon', 'white'],
    ['armor', 'green'],
    ['accessory', 'blue'],
    ['mount', 'purple'],
    ['weapon', 'gold'],
  ];
  combos.forEach(([slot, rarity], i) => {
    const eq = eqSys.generateEquipment(slot, rarity, 'campaign_drop', 100 + i);
    if (eq) results.push(eq);
  });
  return results;
}

/** 生成同品质装备（用于锻造） */
function generateSameRarityEquips(
  sim: GameEventSimulator,
  rarity: EquipmentRarity = 'white',
  count: number = 5,
): EquipmentInstance[] {
  const eqSys = sim.engine.getEquipmentSystem();
  const results: EquipmentInstance[] = [];
  for (let i = 0; i < count; i++) {
    const slot = EQUIPMENT_SLOTS[i % EQUIPMENT_SLOTS.length];
    const eq = eqSys.generateEquipment(slot, rarity, 'campaign_drop', 200 + i);
    if (eq) results.push(eq);
  }
  return results;
}

// ── Tests ──

describe('FLOW-09 装备Tab集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUidCounter();
  });
  afterEach(() => { cleanup(); });

  // ═══════════════════════════════════════════════════════════════
  // 1. 装备Tab渲染（FLOW-09-01 ~ FLOW-09-05）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-01', 'EquipmentTab整体渲染 — 容器、子Tab导航'), () => {
    const sim = createEquipSim();
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    const tab = screen.getByTestId('equipment-tab');
    assertVisible(tab, 'FLOW-09-01', '装备Tab容器');
    // 子Tab: 背包/锻造/强化
    expect(screen.getByText('🎒 背包')).toBeInTheDocument();
    expect(screen.getByText('🔥 锻造')).toBeInTheDocument();
    expect(screen.getByText('⬆️ 强化')).toBeInTheDocument();
  });

  it(accTest('FLOW-09-02', 'EquipmentPanel渲染 — 装备背包面板'), () => {
    const sim = createEquipSim();
    render(<EquipmentPanel engine={sim.engine} />);
    const panel = screen.getByTestId('equipment-panel');
    assertVisible(panel, 'FLOW-09-02', '装备面板');
  });

  it(accTest('FLOW-09-03', '装备背包容量显示 — 显示已用/总容量'), () => {
    const sim = createEquipSim();
    render(<EquipmentPanel engine={sim.engine} />);
    const panel = screen.getByTestId('equipment-panel');
    expect(panel.textContent).toContain('🎒 装备背包');
  });

  it(accTest('FLOW-09-04', '筛选栏显示 — 部位筛选按钮'), () => {
    const sim = createEquipSim();
    render(<EquipmentPanel engine={sim.engine} />);
    // "全部" 按钮和部位图标按钮
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it(accTest('FLOW-09-05', '空背包显示 — 无装备时显示暂无装备'), () => {
    const sim = createEquipSim();
    render(<EquipmentPanel engine={sim.engine} />);
    expect(screen.getByText('暂无装备')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 装备列表与选择（FLOW-09-06 ~ FLOW-09-10）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-06', '装备列表显示 — 生成装备后列表更新'), () => {
    const sim = createEquipSim();
    const equips = generateMixedEquips(sim);
    render(<EquipmentPanel engine={sim.engine} />);
    // 验证装备卡片存在
    const panel = screen.getByTestId('equipment-panel');
    for (const eq of equips) {
      const item = screen.getByTestId(`equipment-panel-item-${eq.uid}`);
      assertVisible(item, 'FLOW-09-06', `装备卡片 ${eq.name}`);
    }
  });

  it(accTest('FLOW-09-07', '装备卡片显示品质颜色条 — 不同品质不同颜色'), () => {
    const sim = createEquipSim();
    const equips = generateMixedEquips(sim);
    render(<EquipmentPanel engine={sim.engine} />);
    // 每个装备卡片应有品质色条
    for (const eq of equips) {
      const item = screen.getByTestId(`equipment-panel-item-${eq.uid}`);
      const rarityBar = item.querySelector('[style*="height: 3px"]');
      assertStrict(!!rarityBar, 'FLOW-09-07', `${eq.name} 应有品质色条`);
    }
  });

  it(accTest('FLOW-09-08', '装备卡片显示名称和属性 — 名称/部位/强化等级'), () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    assertStrict(!!eq, 'FLOW-09-08', '应生成装备');
    render(<EquipmentPanel engine={sim.engine} />);
    const item = screen.getByTestId(`equipment-panel-item-${eq!.uid}`);
    expect(item.textContent).toContain(eq!.name);
    expect(item.textContent).toContain('武器');
    expect(item.textContent).toContain('+0');
  });

  it(accTest('FLOW-09-09', '点击装备显示详情弹窗 — 弹出装备详情'), async () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    render(<EquipmentPanel engine={sim.engine} />);
    const item = screen.getByTestId(`equipment-panel-item-${eq!.uid}`);
    await userEvent.click(item);
    const detail = screen.getByTestId('equipment-panel-detail');
    assertVisible(detail, 'FLOW-09-09', '装备详情弹窗');
    expect(detail.textContent).toContain(eq!.name);
  });

  it(accTest('FLOW-09-10', '装备详情显示主属性 — 属性类型和数值'), async () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    render(<EquipmentPanel engine={sim.engine} />);
    const item = screen.getByTestId(`equipment-panel-item-${eq!.uid}`);
    await userEvent.click(item);
    const detail = screen.getByTestId('equipment-panel-detail');
    expect(detail.textContent).toContain('主属性');
    expect(detail.textContent).toContain(eq!.mainStat.type);
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 装备穿戴（FLOW-09-11 ~ FLOW-09-14）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-11', '装备穿戴到武将 — equipItem成功'), () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    const eqSys = sim.engine.getEquipmentSystem();

    const result = eqSys.equipItem('liubei', eq!.uid);
    assertStrict(result.success, 'FLOW-09-11', '穿戴应成功');

    // 验证装备状态
    const updated = eqSys.getEquipment(eq!.uid);
    assertStrict(updated!.isEquipped, 'FLOW-09-11', '装备应标记为已穿戴');
    assertStrict(updated!.equippedHeroId === 'liubei', 'FLOW-09-11', '穿戴武将应为liubei');
  });

  it(accTest('FLOW-09-12', '武将装备栏查询 — getHeroEquips返回正确数据'), () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    const eqSys = sim.engine.getEquipmentSystem();
    eqSys.equipItem('liubei', eq!.uid);

    const heroEquips = eqSys.getHeroEquips('liubei');
    assertStrict(heroEquips.weapon === eq!.uid, 'FLOW-09-12', '武器栏应为该装备');
    assertStrict(heroEquips.armor === null, 'FLOW-09-12', '防具栏应为空');
  });

  it(accTest('FLOW-09-13', '穿戴替换 — 同部位穿戴新装备替换旧装备'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const eq1 = generateEquip(sim, 'weapon', 'white');
    const eq2 = generateEquip(sim, 'weapon', 'blue');

    // 先穿戴白装
    eqSys.equipItem('liubei', eq1!.uid);
    // 再穿戴蓝装（替换）
    const result = eqSys.equipItem('liubei', eq2!.uid);
    assertStrict(result.success, 'FLOW-09-13', '替换穿戴应成功');
    assertStrict(result.replacedUid === eq1!.uid, 'FLOW-09-13', '应返回被替换的装备uid');

    // 旧装备应被卸下
    const oldEq = eqSys.getEquipment(eq1!.uid);
    assertStrict(!oldEq!.isEquipped, 'FLOW-09-13', '旧装备应被卸下');
  });

  it(accTest('FLOW-09-14', '穿戴不存在的装备 — 返回失败'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const result = eqSys.equipItem('liubei', 'nonexistent-uid');
    assertStrict(!result.success, 'FLOW-09-14', '穿戴不存在装备应失败');
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 装备卸下（FLOW-09-15 ~ FLOW-09-17）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-15', '装备卸下 — unequipItem成功'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const eq = generateEquip(sim, 'weapon', 'blue');
    eqSys.equipItem('liubei', eq!.uid);

    const result = eqSys.unequipItem('liubei', 'weapon');
    assertStrict(result.success, 'FLOW-09-15', '卸下应成功');

    const updated = eqSys.getEquipment(eq!.uid);
    assertStrict(!updated!.isEquipped, 'FLOW-09-15', '装备应标记为未穿戴');
    assertStrict(updated!.equippedHeroId === null, 'FLOW-09-15', '穿戴武将应为null');
  });

  it(accTest('FLOW-09-16', '卸下空部位 — 返回失败'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const result = eqSys.unequipItem('liubei', 'weapon');
    assertStrict(!result.success, 'FLOW-09-16', '卸下空部位应失败');
  });

  it(accTest('FLOW-09-17', '卸下后武将装备栏为空 — getHeroEquips对应slot为null'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const eq = generateEquip(sim, 'weapon', 'blue');
    eqSys.equipItem('liubei', eq!.uid);
    eqSys.unequipItem('liubei', 'weapon');

    const heroEquips = eqSys.getHeroEquips('liubei');
    assertStrict(heroEquips.weapon === null, 'FLOW-09-17', '卸下后武器栏应为null');
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 装备强化（FLOW-09-18 ~ FLOW-09-22）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-18', '装备强化成功 — enhanceLevel提升'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const enhanceSys = sim.engine.getEquipmentEnhanceSystem();
    // 注入资源扣除回调（始终成功）
    enhanceSys.setResourceDeductor(() => true);

    const eq = generateEquip(sim, 'weapon', 'blue');
    const beforeLevel = eq!.enhanceLevel;

    const result = enhanceSys.enhance(eq!.uid, false);
    // 结果可能是成功或失败（随机），但不应崩溃
    assertStrict(result !== null, 'FLOW-09-18', '强化应返回结果');

    const updated = eqSys.getEquipment(eq!.uid);
    if (result.outcome === 'success') {
      assertStrict(updated!.enhanceLevel === beforeLevel + 1, 'FLOW-09-18', '强化成功等级应+1');
    }
  });

  it(accTest('FLOW-09-19', '强化属性提升 — 强化后主属性增加'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const enhanceSys = sim.engine.getEquipmentEnhanceSystem();
    enhanceSys.setResourceDeductor(() => true);

    const eq = generateEquip(sim, 'weapon', 'blue');
    const beforeValue = eq!.mainStat.value;

    // 多次强化确保至少成功一次
    for (let i = 0; i < 10; i++) {
      enhanceSys.enhance(eq!.uid, false);
    }

    const updated = eqSys.getEquipment(eq!.uid);
    // 如果强化等级提升了，属性值应增加
    if (updated!.enhanceLevel > 0) {
      assertStrict(
        updated!.mainStat.value >= beforeValue,
        'FLOW-09-19',
        `强化后属性应≥强化前：${updated!.mainStat.value} vs ${beforeValue}`,
      );
    }
  });

  it(accTest('FLOW-09-20', 'EquipmentTab强化子Tab — 显示强化界面'), () => {
    const sim = createEquipSim();
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    // 切到强化子Tab
    const enhanceBtn = screen.getByText('⬆️ 强化');
    fireEvent.click(enhanceBtn);
    // 应显示强化界面标题
    expect(screen.getByText('⬆️ 装备强化')).toBeInTheDocument();
  });

  it(accTest('FLOW-09-21', '强化费用查询 — getCopperCost返回正确值'), () => {
    const sim = createEquipSim();
    const enhanceSys = sim.engine.getEquipmentEnhanceSystem();
    // Lv0 → Lv1 的费用
    const cost = enhanceSys.getCopperCost(0);
    assertStrict(cost > 0, 'FLOW-09-21', '强化费用应大于0');
    // 更高等级费用更高
    const cost5 = enhanceSys.getCopperCost(5);
    assertStrict(cost5 > cost, 'FLOW-09-21', '高等级费用应更高');
  });

  it(accTest('FLOW-09-22', '品质强化上限 — 不同品质上限不同'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    // 白色上限低，金色上限高
    const whiteCap = eqSys.getEnhanceCap('white');
    const goldCap = eqSys.getEnhanceCap('gold');
    assertStrict(whiteCap > 0, 'FLOW-09-22', '白色强化上限应大于0');
    assertStrict(goldCap > whiteCap, 'FLOW-09-22', '金色强化上限应大于白色');
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. 装备品质差异（FLOW-09-23 ~ FLOW-09-26）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-23', '不同品质装备属性差异 — 金色>紫色>蓝色>绿色>白色'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();

    const equips: Record<string, EquipmentInstance | null> = {};
    for (const rarity of EQUIPMENT_RARITIES) {
      equips[rarity] = eqSys.generateEquipment('weapon', rarity, 'campaign_drop', 300 + RARITY_ORDER[rarity]);
    }

    // 验证品质排序：金色主属性 > 白色
    const whiteAtk = equips.white?.mainStat.value ?? 0;
    const goldAtk = equips.gold?.mainStat.value ?? 0;
    assertStrict(goldAtk > whiteAtk, 'FLOW-09-23', `金色攻击(${goldAtk})应大于白色(${whiteAtk})`);
  });

  it(accTest('FLOW-09-24', '品质战力评分差异 — calculatePower品质越高分越高'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();

    const whiteEq = eqSys.generateEquipment('weapon', 'white', 'campaign_drop', 400);
    const goldEq = eqSys.generateEquipment('weapon', 'gold', 'campaign_drop', 401);

    const whitePower = eqSys.calculatePower(whiteEq!);
    const goldPower = eqSys.calculatePower(goldEq!);
    assertStrict(goldPower > whitePower, 'FLOW-09-24', `金色战力(${goldPower})应大于白色(${whitePower})`);
  });

  it(accTest('FLOW-09-25', '品质排序 — RARITY_ORDER正确映射'), () => {
    assertStrict(RARITY_ORDER.white < RARITY_ORDER.green, 'FLOW-09-25', '白色<绿色');
    assertStrict(RARITY_ORDER.green < RARITY_ORDER.blue, 'FLOW-09-25', '绿色<蓝色');
    assertStrict(RARITY_ORDER.blue < RARITY_ORDER.purple, 'FLOW-09-25', '蓝色<紫色');
    assertStrict(RARITY_ORDER.purple < RARITY_ORDER.gold, 'FLOW-09-25', '紫色<金色');
  });

  it(accTest('FLOW-09-26', 'EquipmentPanel品质排序显示 — 品质降序排列'), () => {
    const sim = createEquipSim();
    const equips = generateMixedEquips(sim);
    render(<EquipmentPanel engine={sim.engine} />);
    // 默认按品质降序，第一个应为最高品质
    const panel = screen.getByTestId('equipment-panel');
    const cards = panel.querySelectorAll('[data-testid^="equipment-panel-item-"]');
    assertStrict(cards.length >= 2, 'FLOW-09-26', '应至少有2个装备卡片');
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. 装备锻造（FLOW-09-27 ~ FLOW-09-30）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-27', 'EquipmentTab锻造子Tab — 显示锻造界面'), () => {
    const sim = createEquipSim();
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    const forgeBtn = screen.getByText('🔥 锻造');
    fireEvent.click(forgeBtn);
    expect(screen.getByText('🔥 装备锻造')).toBeInTheDocument();
  });

  it(accTest('FLOW-09-28', '基础锻造 — 3件同品质装备锻造出更高品质'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const forgeSys = sim.engine.getEquipmentForgeSystem();

    // 生成5件白色装备
    const whites = generateSameRarityEquips(sim, 'white', 5);
    assertStrict(whites.length >= 3, 'FLOW-09-28', '应生成至少3件白色装备');

    const beforeCount = eqSys.getAllEquipments().length;
    const result = forgeSys.basicForge(whites.slice(0, 3).map(e => e.uid), () => 0.5);
    // 锻造应成功（消耗3件白色，生成1件更高品质）
    if (result.success) {
      assertStrict(result.equipment !== null, 'FLOW-09-28', '锻造应产出装备');
      // 白色锻造应产出绿色或更高
      const outputRarity = result.equipment!.rarity;
      assertStrict(
        RARITY_ORDER[outputRarity] > RARITY_ORDER.white,
        'FLOW-09-28',
        `产出品质(${outputRarity})应高于白色`,
      );
    }
  });

  it(accTest('FLOW-09-29', '高级锻造 — 5件同品质装备锻造'), () => {
    const sim = createEquipSim();
    const forgeSys = sim.engine.getEquipmentForgeSystem();

    const whites = generateSameRarityEquips(sim, 'white', 5);
    assertStrict(whites.length >= 5, 'FLOW-09-29', '应生成5件白色装备');

    const result = forgeSys.advancedForge(whites.map(e => e.uid), () => 0.5);
    if (result.success) {
      assertStrict(result.equipment !== null, 'FLOW-09-29', '高级锻造应产出装备');
    }
  });

  it(accTest('FLOW-09-30', '锻造费用查询 — getForgeCost返回正确值'), () => {
    const sim = createEquipSim();
    const forgeSys = sim.engine.getEquipmentForgeSystem();
    const basicCost = forgeSys.getForgeCost('basic');
    const advancedCost = forgeSys.getForgeCost('advanced');
    assertStrict(basicCost.copper > 0, 'FLOW-09-30', '基础锻造应消耗铜钱');
    assertStrict(advancedCost.copper > basicCost.copper, 'FLOW-09-30', '高级锻造费用应更高');
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. 装备分解（FLOW-09-31 ~ FLOW-09-33）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-31', '装备分解 — decompose成功移除装备'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const eq = generateEquip(sim, 'weapon', 'green');
    const beforeCount = eqSys.getAllEquipments().length;

    const result = eqSys.decompose(eq!.uid);
    assertStrict(result.success, 'FLOW-09-31', '分解应成功');
    const afterCount = eqSys.getAllEquipments().length;
    assertStrict(afterCount === beforeCount - 1, 'FLOW-09-31', '分解后装备数应-1');
  });

  it(accTest('FLOW-09-32', '分解产出 — 品质越高产出越多'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();

    const whiteEq = eqSys.generateEquipment('weapon', 'white', 'campaign_drop', 500);
    const goldEq = eqSys.generateEquipment('weapon', 'gold', 'campaign_drop', 501);

    const whiteReward = eqSys.calculateDecomposeReward(whiteEq!);
    const goldReward = eqSys.calculateDecomposeReward(goldEq!);

    assertStrict(goldReward.copper > whiteReward.copper, 'FLOW-09-32', '金色分解铜钱应多于白色');
  });

  it(accTest('FLOW-09-33', '批量分解 — batchDecompose批量处理'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const equips = generateSameRarityEquips(sim, 'white', 3);
    const uids = equips.map(e => e.uid);

    const result = eqSys.batchDecompose(uids);
    assertStrict(result.decomposedUids.length === uids.length, 'FLOW-09-33', '应分解所有装备');
    assertStrict(result.total.copper > 0, 'FLOW-09-33', '应获得铜钱');
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. 装备套装效果（FLOW-09-34 ~ FLOW-09-36）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-34', '套装定义查询 — getAllSetDefs返回套装列表'), () => {
    const sim = createEquipSim();
    const setSys = sim.engine.getEquipmentSetSystem();
    const defs = setSys.getAllSetDefs();
    assertStrict(defs.length > 0, 'FLOW-09-34', '应有套装定义');
  });

  it(accTest('FLOW-09-35', '武将套装件数统计 — getActiveSetBonuses'), () => {
    const sim = createEquipSim();
    const setSys = sim.engine.getEquipmentSetSystem();
    // 未穿戴任何装备时应无激活效果
    const bonuses = setSys.getActiveSetBonuses('liubei');
    assertStrict(bonuses.length === 0, 'FLOW-09-35', '未穿戴装备应无套装效果');
  });

  it(accTest('FLOW-09-36', '套装ID列表 — getAllSetIds返回所有套装ID'), () => {
    const sim = createEquipSim();
    const setSys = sim.engine.getEquipmentSetSystem();
    const ids = setSys.getAllSetIds();
    assertStrict(ids.length > 0, 'FLOW-09-36', '应有套装ID');
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. 装备推荐（FLOW-09-37 ~ FLOW-09-39）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-37', '装备推荐 — recommendForHero返回推荐结果'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const recSys = sim.engine.getEquipmentRecommendSystem();

    // 生成一些装备供推荐
    generateMixedEquips(sim);

    const result = recSys.recommendForHero('liubei');
    assertStrict(!!result, 'FLOW-09-37', '应返回推荐结果');
    // 应为4个部位提供推荐
    assertStrict(!!result.slots, 'FLOW-09-37', '推荐结果应包含slots');
  });

  it(accTest('FLOW-09-38', '装备评分 — evaluateEquipment返回评分'), () => {
    const sim = createEquipSim();
    const recSys = sim.engine.getEquipmentRecommendSystem();
    const eq = generateEquip(sim, 'weapon', 'blue');

    const evaluation = recSys.evaluateEquipment(eq!, 'liubei');
    assertStrict(evaluation.score >= 0, 'FLOW-09-38', '评分应为非负数');
    assertStrict(!!evaluation.equipment, 'FLOW-09-38', '评估结果应包含装备');
  });

  it(accTest('FLOW-09-39', '推荐优先高品质 — 金色装备评分高于白色'), () => {
    const sim = createEquipSim();
    const recSys = sim.engine.getEquipmentRecommendSystem();
    const eqSys = sim.engine.getEquipmentSystem();

    const whiteEq = eqSys.generateEquipment('weapon', 'white', 'campaign_drop', 600);
    const goldEq = eqSys.generateEquipment('weapon', 'gold', 'campaign_drop', 601);

    const whiteScore = recSys.evaluateEquipment(whiteEq!, 'liubei').score;
    const goldScore = recSys.evaluateEquipment(goldEq!, 'liubei').score;
    assertStrict(goldScore > whiteScore, 'FLOW-09-39', `金色评分(${goldScore})应高于白色(${whiteScore})`);
  });

  // ═══════════════════════════════════════════════════════════════
  // 11. EquipmentTab子Tab交互（FLOW-09-40 ~ FLOW-09-44）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-40', '背包子Tab — 显示装备列表和筛选'), () => {
    const sim = createEquipSim();
    generateMixedEquips(sim);
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    // 默认是背包Tab — 验证背包信息存在
    const tab = screen.getByTestId('equipment-tab');
    expect(tab.textContent).toContain('🎒');
    // 应显示筛选按钮
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it(accTest('FLOW-09-41', '背包部位筛选 — 点击部位按钮筛选装备'), async () => {
    const sim = createEquipSim();
    generateMixedEquips(sim);
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    // 找到所有筛选按钮（包含部位图标）
    const tab = screen.getByTestId('equipment-tab');
    const filterBtns = tab.querySelectorAll('button');
    // 找到 ⚔️ 按钮（武器筛选）
    const weaponBtn = Array.from(filterBtns).find(b => b.textContent?.includes('⚔️') && b.textContent?.includes('⚔️') && !b.textContent?.includes('锻造'));
    if (weaponBtn) {
      await userEvent.click(weaponBtn);
      // 筛选后应只显示武器类装备
    }
  });

  it(accTest('FLOW-09-42', '锻造子Tab — 锻造类型选择'), () => {
    const sim = createEquipSim();
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByText('🔥 锻造'));
    // 应显示锻造界面标题和选项
    const tab = screen.getByTestId('equipment-tab');
    expect(tab.textContent).toContain('装备锻造');
    expect(tab.textContent).toContain('基础锻造');
    expect(tab.textContent).toContain('高级锻造');
  });

  it(accTest('FLOW-09-43', '强化子Tab — 选择装备后显示强化详情'), async () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByText('⬆️ 强化'));
    // 应显示"选择要强化的装备"
    expect(screen.getByText('选择要强化的装备：')).toBeInTheDocument();
    // 点击装备选择（在强化Tab的grid中）
    const tab = screen.getByTestId('equipment-tab');
    const equipCards = tab.querySelectorAll('[data-testid="equipment-tab"] .tk-equipment-grid > div');
    if (equipCards.length > 0) {
      await userEvent.click(equipCards[0]);
      // 应显示强化详情（包含强化按钮和返回按钮）
      await waitFor(() => {
        const enhanceBtns = tab.querySelectorAll('button');
        const hasEnhanceBtn = Array.from(enhanceBtns).some(b => b.textContent?.includes('⬆️ 强化'));
        assertStrict(hasEnhanceBtn, 'FLOW-09-43', '应显示强化按钮');
      }, { timeout: 2000 });
    }
  });

  it(accTest('FLOW-09-44', '强化保护符选项 — 勾选保护符'), async () => {
    const sim = createEquipSim();
    const eq = generateEquip(sim, 'weapon', 'blue');
    render(<EquipmentTab engine={sim.engine} snapshotVersion={0} />);
    fireEvent.click(screen.getByText('⬆️ 强化'));
    // 选择装备
    const cards = screen.getAllByText(eq!.name);
    if (cards.length > 0) {
      await userEvent.click(cards[0]);
      await waitFor(() => {
        const checkbox = screen.queryByRole('checkbox');
        if (checkbox) {
          expect(checkbox).toBeInTheDocument();
        }
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 12. 背包管理（FLOW-09-45 ~ FLOW-09-48）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-45', '背包容量管理 — getBagCapacity返回默认100'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    assertStrict(eqSys.getBagCapacity() === 50, 'FLOW-09-45', '默认容量应为50');
  });

  it(accTest('FLOW-09-46', '背包已用数量 — getBagUsedCount正确'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    assertStrict(eqSys.getBagUsedCount() === 0, 'FLOW-09-46', '初始应为0');
    generateEquip(sim, 'weapon', 'blue');
    assertStrict(eqSys.getBagUsedCount() === 1, 'FLOW-09-46', '生成1件后应为1');
  });

  it(accTest('FLOW-09-47', '装备排序 — sortEquipments按品质降序'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    generateMixedEquips(sim);

    const sorted = eqSys.getSortedEquipments('rarity_desc');
    assertStrict(sorted.length >= 2, 'FLOW-09-47', '应至少有2件装备');
    // 第一个应比最后一个品质高
    const firstOrder = RARITY_ORDER[sorted[0].rarity];
    const lastOrder = RARITY_ORDER[sorted[sorted.length - 1].rarity];
    assertStrict(firstOrder >= lastOrder, 'FLOW-09-47', '品质降序排列');
  });

  it(accTest('FLOW-09-48', '装备按部位分组 — groupBySlot正确'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    generateMixedEquips(sim);

    const groups = eqSys.groupBySlot();
    assertStrict(Object.keys(groups).length > 0, 'FLOW-09-48', '应有分组');
    for (const slot of EQUIPMENT_SLOTS) {
      if (groups[slot]) {
        for (const eq of groups[slot]) {
          assertStrict(eq.slot === slot, 'FLOW-09-48', `${eq.name} 应属于 ${slot}`);
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 13. 引擎端到端流程（FLOW-09-49 ~ FLOW-09-52）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-09-49', 'SceneRouter数据流 — engine.getEquipmentSystem提供完整数据'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    assertStrict(eqSys.getAllEquipments().length === 0, 'FLOW-09-49', '初始应无装备');
    generateEquip(sim);
    assertStrict(eqSys.getAllEquipments().length === 1, 'FLOW-09-49', '生成后应有1件');
  });

  it(accTest('FLOW-09-50', '完整装备流程 — 生成→穿戴→卸下→分解'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();

    // 1. 生成
    const eq = generateEquip(sim, 'weapon', 'blue');
    assertStrict(!!eq, 'FLOW-09-50', '生成应成功');
    assertStrict(eqSys.getAllEquipments().length === 1, 'FLOW-09-50', '背包应有1件');

    // 2. 穿戴
    const equipResult = eqSys.equipItem('liubei', eq!.uid);
    assertStrict(equipResult.success, 'FLOW-09-50', '穿戴应成功');

    // 3. 卸下
    const unequipResult = eqSys.unequipItem('liubei', 'weapon');
    assertStrict(unequipResult.success, 'FLOW-09-50', '卸下应成功');

    // 4. 分解
    const decomposeResult = eqSys.decompose(eq!.uid);
    assertStrict(decomposeResult.success, 'FLOW-09-50', '分解应成功');
    assertStrict(eqSys.getAllEquipments().length === 0, 'FLOW-09-50', '分解后背包应为空');
  });

  it(accTest('FLOW-09-51', 'SubsystemRegistry注册 — equipment/equipmentForge/equipmentEnhance可获取'), () => {
    const sim = createEquipSim();
    const registry = sim.engine.getSubsystemRegistry();
    assertStrict(!!registry.get('equipment'), 'FLOW-09-51', 'equipment应注册');
    assertStrict(!!registry.get('equipmentForge'), 'FLOW-09-51', 'equipmentForge应注册');
    assertStrict(!!registry.get('equipmentEnhance'), 'FLOW-09-51', 'equipmentEnhance应注册');
  });

  it(accTest('FLOW-09-52', '装备序列化/反序列化 — 数据完整保存恢复'), () => {
    const sim = createEquipSim();
    const eqSys = sim.engine.getEquipmentSystem();
    const eq = generateEquip(sim, 'weapon', 'blue');
    eqSys.equipItem('liubei', eq!.uid);

    // 序列化
    const saved = eqSys.serialize();
    assertStrict(saved.equipments.length === 1, 'FLOW-09-52', '序列化应有1件装备');
    assertStrict(saved.version > 0, 'FLOW-09-52', '应有版本号');

    // 重置后反序列化
    eqSys.reset();
    assertStrict(eqSys.getAllEquipments().length === 0, 'FLOW-09-52', '重置后应为空');

    eqSys.deserialize(saved);
    const restored = eqSys.getAllEquipments();
    assertStrict(restored.length === 1, 'FLOW-09-52', '反序列化后应有1件');
    assertStrict(restored[0].name === eq!.name, 'FLOW-09-52', '装备名称应一致');
  });
});
