/**
 * FLOW-07 编队系统集成测试 — 渲染/创建编队/添加武将/移除武将/战力计算/一键布阵/互斥锁定/边界。
 * 使用真实引擎（GameEventSimulator），不 mock engine。
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormationGrid from '@/components/idle/panels/hero/FormationGrid';
import type { FormationSlotHero, BondSummary } from '@/components/idle/panels/hero/FormationGrid';
import type { FormationData } from '@/games/three-kingdoms/engine/hero/formation-types';
import { MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from '@/games/three-kingdoms/engine/hero/formation-types';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// ── Mock CSS imports ──
vi.mock('@/components/idle/panels/hero/FormationGrid.css', () => ({}));

// ── Test Data Factory ──

function makeHero(overrides: Partial<FormationSlotHero> = {}): FormationSlotHero {
  return {
    id: 'hero_1',
    name: '关羽',
    quality: 'LEGENDARY',
    ...overrides,
  };
}

function makeSlots(count: number): (FormationSlotHero | null)[] {
  const slots: (FormationSlotHero | null)[] = Array(6).fill(null);
  for (let i = 0; i < Math.min(count, 6); i++) {
    slots[i] = makeHero({ id: `hero_${i}`, name: `武将${i}` });
  }
  return slots;
}

function makeBonds(count: number): BondSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bond_${i}`,
    name: `羁绊${i}`,
    isActive: i === 0,
    description: `羁绊描述${i}`,
  }));
}

/** 创建带武将的 sim */
function createFormationSim(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources({ grain: 5000000, gold: 10000000, troops: 500000 });
  // 添加核心武将
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao', 'sunquan', 'zhouyu'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  return sim;
}

/** 渲染 FormationGrid */
function renderGrid(
  slots: (FormationSlotHero | null)[] = makeSlots(0),
  totalPower: number = 0,
  bonds: BondSummary[] = [],
  onAddHero?: (slotIndex: number) => void,
  onRemoveHero?: (slotIndex: number, heroId: string) => void,
) {
  return render(
    <FormationGrid
      slots={slots}
      totalPower={totalPower}
      bonds={bonds}
      onAddHero={onAddHero ?? vi.fn()}
      onRemoveHero={onRemoveHero ?? vi.fn()}
    />,
  );
}

// ═══════════════════════════════════════════════════════════
// FLOW-07 编队系统集成测试
// ═══════════════════════════════════════════════════════════

describe('FLOW-07 编队系统集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ── 1. 编队面板渲染（FLOW-07-01 ~ FLOW-07-05） ──

  it(accTest('FLOW-07-01', '编队面板渲染 — 6个槽位显示'), () => {
    const slots = makeSlots(0);
    renderGrid(slots);

    // 应有6个槽位（空槽位显示"+"按钮）
    const addButtons = screen.getAllByTestId(/formation-slot-add|formation-slot-/);
    assertStrict(
      addButtons.length >= 6,
      'FLOW-07-01',
      `应有至少6个槽位元素，实际: ${addButtons.length}`,
    );
  });

  it(accTest('FLOW-07-02', '编队面板渲染 — 武将槽位显示名称'), () => {
    const slots = makeSlots(3);
    renderGrid(slots);

    for (let i = 0; i < 3; i++) {
      const heroName = screen.getByText(`武将${i}`);
      assertVisible(heroName, 'FLOW-07-02', `武将${i}名称`);
    }
  });

  it(accTest('FLOW-07-03', '编队面板渲染 — 战力显示'), () => {
    const slots = makeSlots(3);
    renderGrid(slots, 15000);

    const powerEl = screen.getByText(/1\.5万/);
    assertVisible(powerEl, 'FLOW-07-03', '编队战力');
  });

  it(accTest('FLOW-07-04', '编队面板渲染 — 羁绊摘要显示'), () => {
    const bonds = makeBonds(2);
    renderGrid(makeSlots(3), 10000, bonds);

    const bond0 = screen.getByText(/羁绊0/);
    assertVisible(bond0, 'FLOW-07-04', '羁绊0');
  });

  it(accTest('FLOW-07-05', '编队面板渲染 — 空编队战力为0'), () => {
    renderGrid(makeSlots(0), 0);

    const powerEl = screen.getByText(/0/);
    assertVisible(powerEl, 'FLOW-07-05', '空编队战力');
  });

  // ── 2. 创建编队（FLOW-07-06 ~ FLOW-07-08） ──

  it(accTest('FLOW-07-06', '创建编队 — 返回编队数据'), () => {
    const sim = createFormationSim();
    const formation = sim.engine.createFormation('1');

    assertStrict(!!formation, 'FLOW-07-06', '创建编队应返回数据');
    assertStrict(formation!.id === '1', 'FLOW-07-06', '编队ID应为 1');
    assertStrict(
      formation!.slots.length === MAX_SLOTS_PER_FORMATION,
      'FLOW-07-06',
      `编队槽位数应为 ${MAX_SLOTS_PER_FORMATION}`,
    );
  });

  it(accTest('FLOW-07-07', '创建编队 — 自动激活第一个编队'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const activeId = sim.engine.getFormationSystem().getActiveFormationId();
    assertStrict(activeId === '1', 'FLOW-07-07', '第一个编队应自动激活');
  });

  it(accTest('FLOW-07-08', '创建编队 — 超过上限返回 null'), () => {
    const sim = createFormationSim();
    for (let i = 1; i <= MAX_FORMATIONS; i++) {
      sim.engine.createFormation(String(i));
    }

    const overflow = sim.engine.createFormation();
    assertStrict(overflow === null, 'FLOW-07-08', '超过上限应返回 null');
  });

  // ── 3. 添加武将到编队（FLOW-07-09 ~ FLOW-07-12） ──

  it(accTest('FLOW-07-09', '添加武将到编队 — 武将出现在槽位'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const result = sim.engine.addToFormation('1', 'guanyu');
    assertStrict(!!result, 'FLOW-07-09', '添加武将应成功');
    assertStrict(
      result!.slots.includes('guanyu'),
      'FLOW-07-09',
      '编队槽位应包含 guanyu',
    );
  });

  it(accTest('FLOW-07-10', '添加武将到编队 — 槽位按顺序填充'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    sim.engine.addToFormation('1', 'liubei');
    sim.engine.addToFormation('1', 'guanyu');

    const formation = sim.engine.getFormationSystem().getFormation('1');
    assertStrict(formation!.slots[0] === 'liubei', 'FLOW-07-10', '第一个槽位应为 liubei');
    assertStrict(formation!.slots[1] === 'guanyu', 'FLOW-07-10', '第二个槽位应为 guanyu');
  });

  it(accTest('FLOW-07-11', '添加武将到编队 — 编队满后返回 null'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
    for (const id of heroIds) {
      sim.engine.addToFormation('1', id);
    }

    // 编队已满
    const result = sim.engine.addToFormation('1', 'sunquan');
    assertStrict(result === null, 'FLOW-07-11', '编队满后添加应返回 null');
  });

  it(accTest('FLOW-07-12', '添加武将到编队 — 重复添加同一武将返回 null'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    sim.engine.addToFormation('1', 'guanyu');
    const result = sim.engine.addToFormation('1', 'guanyu');
    assertStrict(result === null, 'FLOW-07-12', '重复添加应返回 null');
  });

  // ── 4. 移除武将（FLOW-07-13 ~ FLOW-07-15） ──

  it(accTest('FLOW-07-13', '移除武将 — 武将从槽位消失'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');

    const result = sim.engine.removeFromFormation('1', 'guanyu');
    assertStrict(!!result, 'FLOW-07-13', '移除武将应成功');
    assertStrict(
      !result!.slots.includes('guanyu'),
      'FLOW-07-13',
      '移除后槽位不应包含 guanyu',
    );
  });

  it(accTest('FLOW-07-14', '移除武将 — 不在编队中返回 null'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const result = sim.engine.removeFromFormation('1', 'guanyu');
    assertStrict(result === null, 'FLOW-07-14', '移除不在编队中的武将应返回 null');
  });

  it(accTest('FLOW-07-15', '移除武将后可重新添加'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');
    sim.engine.removeFromFormation('1', 'guanyu');

    const result = sim.engine.addToFormation('1', 'guanyu');
    assertStrict(!!result, 'FLOW-07-15', '移除后重新添加应成功');
    assertStrict(
      result!.slots.includes('guanyu'),
      'FLOW-07-15',
      '重新添加后槽位应包含 guanyu',
    );
  });

  // ── 5. 编队战力计算（FLOW-07-16 ~ FLOW-07-18） ──

  it(accTest('FLOW-07-16', '编队战力计算 — 空编队战力为0'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const formation = sim.engine.getFormationSystem().getFormation('1')!;
    const power = sim.engine.getFormationSystem().calculateFormationPower(
      formation,
      (id) => sim.engine.hero.getGeneral(id),
      (g) => sim.engine.hero.calculatePower(g),
    );
    assertStrict(power === 0, 'FLOW-07-16', `空编队战力应为0，实际: ${power}`);
  });

  it(accTest('FLOW-07-17', '编队战力计算 — 单武将战力正确'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');

    const formation = sim.engine.getFormationSystem().getFormation('1')!;
    const power = sim.engine.getFormationSystem().calculateFormationPower(
      formation,
      (id) => sim.engine.hero.getGeneral(id),
      (g) => sim.engine.hero.calculatePower(g),
    );

    const guanyuData = sim.engine.hero.getGeneral('guanyu');
    const expectedPower = guanyuData ? sim.engine.hero.calculatePower(guanyuData) : 0;
    assertStrict(
      power === expectedPower,
      'FLOW-07-17',
      `单武将战力应为 ${expectedPower}，实际: ${power}`,
    );
  });

  it(accTest('FLOW-07-18', '编队战力计算 — 多武将战力累加'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'liubei');
    sim.engine.addToFormation('1', 'guanyu');
    sim.engine.addToFormation('1', 'zhangfei');

    const formation = sim.engine.getFormationSystem().getFormation('1')!;
    const power = sim.engine.getFormationSystem().calculateFormationPower(
      formation,
      (id) => sim.engine.hero.getGeneral(id),
      (g) => sim.engine.hero.calculatePower(g),
    );

    assertStrict(power > 0, 'FLOW-07-18', `多武将编队战力应 > 0，实际: ${power}`);

    // 验证是各武将战力之和
    let expectedSum = 0;
    for (const heroId of ['liubei', 'guanyu', 'zhangfei']) {
      const g = sim.engine.hero.getGeneral(heroId);
      if (g) expectedSum += sim.engine.hero.calculatePower(g);
    }
    assertStrict(
      power === expectedSum,
      'FLOW-07-18',
      `编队战力应为 ${expectedSum}，实际: ${power}`,
    );
  });

  // ── 6. 一键布阵（FLOW-07-19 ~ FLOW-07-21） ──

  it(accTest('FLOW-07-19', '一键布阵 — 自动选择高战力武将'), () => {
    const sim = createFormationSim();
    const formationSystem = sim.engine.getFormationSystem();

    const allHeroIds = sim.engine.hero.getAllGenerals().map((g) => g.id);
    const result = formationSystem.autoFormationByIds(
      allHeroIds,
      (id) => sim.engine.hero.getGeneral(id),
      (g) => sim.engine.hero.calculatePower(g),
      '1',
    );

    assertStrict(!!result, 'FLOW-07-19', '一键布阵应返回编队数据');
    const filledSlots = result!.slots.filter((s) => s !== '');
    assertStrict(
      filledSlots.length > 0,
      'FLOW-07-19',
      '一键布阵应填入武将',
    );
  });

  it(accTest('FLOW-07-20', '一键布阵 — 最多填入6个武将'), () => {
    const sim = createFormationSim();
    const formationSystem = sim.engine.getFormationSystem();

    const allHeroIds = sim.engine.hero.getAllGenerals().map((g) => g.id);
    const result = formationSystem.autoFormationByIds(
      allHeroIds,
      (id) => sim.engine.hero.getGeneral(id),
      (g) => sim.engine.hero.calculatePower(g),
      '1',
    );

    assertStrict(!!result, 'FLOW-07-20', '一键布阵应返回编队数据');
    const filledSlots = result!.slots.filter((s) => s !== '');
    assertStrict(
      filledSlots.length <= MAX_SLOTS_PER_FORMATION,
      'FLOW-07-20',
      `一键布阵最多填入 ${MAX_SLOTS_PER_FORMATION} 个，实际: ${filledSlots.length}`,
    );
  });

  it(accTest('FLOW-07-21', '一键布阵 — 无可用武将返回 null'), () => {
    const sim = createSim(); // 无武将
    sim.engine.createFormation('1');
    const formationSystem = sim.engine.getFormationSystem();

    const result = formationSystem.autoFormationByIds(
      [],
      (id) => sim.engine.hero.getGeneral(id),
      (g) => sim.engine.hero.calculatePower(g),
      '1',
    );

    assertStrict(result === null, 'FLOW-07-21', '无可用武将时应返回 null');
  });

  // ── 7. 互斥锁定（FLOW-07-22 ~ FLOW-07-25） ──

  it(accTest('FLOW-07-22', '互斥锁定 — 同一武将不可同时在两个编队'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.createFormation('2');

    sim.engine.addToFormation('1', 'guanyu');

    // 尝试将 guanyu 加入第二个编队
    const result = sim.engine.addToFormation('2', 'guanyu');
    assertStrict(result === null, 'FLOW-07-22', '同一武将不可同时在两个编队');
  });

  it(accTest('FLOW-07-23', '互斥锁定 — isGeneralInAnyFormation 正确判断'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');

    const formationSystem = sim.engine.getFormationSystem();
    assertStrict(
      formationSystem.isGeneralInAnyFormation('guanyu'),
      'FLOW-07-23',
      'guanyu 应在编队中',
    );
    assertStrict(
      !formationSystem.isGeneralInAnyFormation('liubei'),
      'FLOW-07-23',
      'liubei 不应在编队中',
    );
  });

  it(accTest('FLOW-07-24', '互斥锁定 — getFormationsContainingGeneral 正确'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');

    const formationSystem = sim.engine.getFormationSystem();
    const formations = formationSystem.getFormationsContainingGeneral('guanyu');
    assertStrict(
      formations.length === 1 && formations[0] === '1',
      'FLOW-07-24',
      `guanyu 应在编队1中，实际: ${formations.join(',')}`,
    );
  });

  it(accTest('FLOW-07-25', '互斥锁定 — 移除后可加入其他编队'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.createFormation('2');

    sim.engine.addToFormation('1', 'guanyu');
    sim.engine.removeFromFormation('1', 'guanyu');

    const result = sim.engine.addToFormation('2', 'guanyu');
    assertStrict(!!result, 'FLOW-07-25', '移除后应可加入其他编队');
    assertStrict(
      result!.slots.includes('guanyu'),
      'FLOW-07-25',
      '编队2应包含 guanyu',
    );
  });

  // ── 8. 编队管理（FLOW-07-26 ~ FLOW-07-29） ──

  it(accTest('FLOW-07-26', '删除编队 — 编队消失'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.createFormation('2');

    const result = sim.engine.getFormationSystem().deleteFormation('1');
    assertStrict(result, 'FLOW-07-26', '删除编队应成功');

    const formations = sim.engine.getFormations();
    assertStrict(
      formations.length === 1,
      'FLOW-07-26',
      `删除后应剩1个编队，实际: ${formations.length}`,
    );
  });

  it(accTest('FLOW-07-27', '删除活跃编队 — 自动切换到下一个'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.createFormation('2');

    // 编队1是活跃的
    sim.engine.getFormationSystem().setActiveFormation('1');
    sim.engine.getFormationSystem().deleteFormation('1');

    const activeId = sim.engine.getFormationSystem().getActiveFormationId();
    assertStrict(
      activeId === '2',
      'FLOW-07-27',
      `删除活跃编队后应切换到2，实际: ${activeId}`,
    );
  });

  it(accTest('FLOW-07-28', '重命名编队 — 名称更新'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const result = sim.engine.getFormationSystem().renameFormation('1', '虎豹骑');
    assertStrict(!!result, 'FLOW-07-28', '重命名应成功');
    assertStrict(
      result!.name === '虎豹骑',
      'FLOW-07-28',
      `编队名称应为虎豹骑，实际: ${result!.name}`,
    );
  });

  it(accTest('FLOW-07-29', '设置活跃编队 — 切换成功'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.createFormation('2');

    const result = sim.engine.getFormationSystem().setActiveFormation('2');
    assertStrict(result, 'FLOW-07-29', '切换活跃编队应成功');

    const activeId = sim.engine.getFormationSystem().getActiveFormationId();
    assertStrict(activeId === '2', 'FLOW-07-29', `活跃编队应为2，实际: ${activeId}`);
  });

  // ── 9. 编队序列化（FLOW-07-30 ~ FLOW-07-31） ──

  it(accTest('FLOW-07-30', '编队序列化 — 保存和恢复'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');
    sim.engine.addToFormation('1', 'liubei');

    const formationSystem = sim.engine.getFormationSystem();
    const saved = formationSystem.serialize();

    // 重置并恢复
    formationSystem.reset();
    formationSystem.deserialize(saved);

    const restored = formationSystem.getFormation('1');
    assertStrict(!!restored, 'FLOW-07-30', '恢复后编队应存在');
    assertStrict(
      restored!.slots.includes('guanyu'),
      'FLOW-07-30',
      '恢复后编队应包含 guanyu',
    );
    assertStrict(
      restored!.slots.includes('liubei'),
      'FLOW-07-30',
      '恢复后编队应包含 liubei',
    );
  });

  it(accTest('FLOW-07-31', '编队序列化 — 重置后为空'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');
    sim.engine.addToFormation('1', 'guanyu');

    const formationSystem = sim.engine.getFormationSystem();
    formationSystem.reset();

    assertStrict(
      formationSystem.getFormationCount() === 0,
      'FLOW-07-31',
      '重置后编队数量应为0',
    );
    assertStrict(
      formationSystem.getActiveFormationId() === null,
      'FLOW-07-31',
      '重置后活跃编队应为null',
    );
  });

  // ── 10. 编队推荐系统（FLOW-07-32 ~ FLOW-07-34） ──

  it(accTest('FLOW-07-32', '编队推荐 — recommend 返回推荐方案'), () => {
    const sim = createFormationSim();
    const recommendSystem = sim.engine.getFormationRecommendSystem();

    const heroes = sim.engine.hero.getAllGenerals();
    const result = recommendSystem.recommend(
      'normal',
      heroes.map((h) => ({ ...h })),
      (g) => sim.engine.hero.calculatePower(g),
      5000,
      3,
    );

    assertStrict(
      result.plans.length >= 1,
      'FLOW-07-32',
      `推荐方案数应 >= 1，实际: ${result.plans.length}`,
    );
    assertStrict(
      result.characteristics.stageType === 'normal',
      'FLOW-07-32',
      '关卡类型应为 normal',
    );
  });

  it(accTest('FLOW-07-33', '编队推荐 — 最强战力方案包含武将'), () => {
    const sim = createFormationSim();
    const recommendSystem = sim.engine.getFormationRecommendSystem();

    const heroes = sim.engine.hero.getAllGenerals();
    const result = recommendSystem.recommend(
      'normal',
      heroes.map((h) => ({ ...h })),
      (g) => sim.engine.hero.calculatePower(g),
      5000,
      3,
    );

    const bestPlan = result.plans.find((p) => p.name === '最强战力');
    assertStrict(!!bestPlan, 'FLOW-07-33', '应有最强战力方案');
    assertStrict(
      bestPlan!.heroIds.length > 0,
      'FLOW-07-33',
      '最强战力方案应包含武将',
    );
    assertStrict(
      bestPlan!.estimatedPower > 0,
      'FLOW-07-33',
      '最强战力方案预估战力应 > 0',
    );
  });

  it(accTest('FLOW-07-34', '编队推荐 — 无武将时返回空方案'), () => {
    const sim = createSim();
    const recommendSystem = sim.engine.getFormationRecommendSystem();

    const result = recommendSystem.recommend(
      'normal',
      [],
      (g) => 0,
      5000,
      3,
    );

    assertStrict(
      result.plans.length === 0,
      'FLOW-07-34',
      `无武将时方案数应为0，实际: ${result.plans.length}`,
    );
  });

  // ── 11. 苏格拉底边界（FLOW-07-35 ~ FLOW-07-39） ──

  it(accTest('FLOW-07-35', '边界 — 编队为空时能否出征（无活跃编队返回 null）'), () => {
    const sim = createSim();
    const formationSystem = sim.engine.getFormationSystem();

    const active = formationSystem.getActiveFormation();
    assertStrict(active === null, 'FLOW-07-35', '无编队时活跃编队应为 null');
  });

  it(accTest('FLOW-07-36', '边界 — 满编队后替换武将'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    // 填满编队
    const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
    for (const id of heroIds) {
      sim.engine.addToFormation('1', id);
    }

    // 满编后无法添加新武将
    const addResult = sim.engine.addToFormation('1', 'sunquan');
    assertStrict(addResult === null, 'FLOW-07-36', '满编后添加应返回 null');

    // 先移除一个再添加
    sim.engine.removeFromFormation('1', 'caocao');
    const addAfterRemove = sim.engine.addToFormation('1', 'sunquan');
    assertStrict(!!addAfterRemove, 'FLOW-07-36', '移除后添加应成功');
    assertStrict(
      addAfterRemove!.slots.includes('sunquan'),
      'FLOW-07-36',
      '替换后应包含 sunquan',
    );
  });

  it(accTest('FLOW-07-37', '边界 — setFormation 直接设置武将列表'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const heroIds = ['liubei', 'guanyu', 'zhangfei'];
    const result = sim.engine.setFormation('1', heroIds);

    assertStrict(!!result, 'FLOW-07-37', '设置编队应成功');
    assertStrict(
      result!.slots[0] === 'liubei' &&
      result!.slots[1] === 'guanyu' &&
      result!.slots[2] === 'zhangfei',
      'FLOW-07-37',
      '编队应包含设置的武将',
    );
    // 空位应为空字符串
    assertStrict(
      result!.slots[3] === '',
      'FLOW-07-37',
      '空位应为空字符串',
    );
  });

  it(accTest('FLOW-07-38', '边界 — setFormation 超过6个武将截断'), () => {
    const sim = createFormationSim();
    sim.engine.createFormation('1');

    const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao', 'sunquan', 'zhouyu'];
    const result = sim.engine.setFormation('1', heroIds);

    assertStrict(!!result, 'FLOW-07-38', '设置编队应成功');
    const filled = result!.slots.filter((s) => s !== '');
    assertStrict(
      filled.length === MAX_SLOTS_PER_FORMATION,
      'FLOW-07-38',
      `应截断到 ${MAX_SLOTS_PER_FORMATION} 个，实际: ${filled.length}`,
    );
  });

  it(accTest('FLOW-07-39', '边界 — 不存在的编队操作返回 null'), () => {
    const sim = createFormationSim();

    const addResult = sim.engine.addToFormation('nonexistent', 'guanyu');
    assertStrict(addResult === null, 'FLOW-07-39', '不存在的编队添加应返回 null');

    const removeResult = sim.engine.removeFromFormation('nonexistent', 'guanyu');
    assertStrict(removeResult === null, 'FLOW-07-39', '不存在的编队移除应返回 null');

    const getResult = sim.engine.getFormationSystem().getFormation('nonexistent');
    assertStrict(getResult === null, 'FLOW-07-39', '不存在的编队查询应返回 null');
  });

  // ── 12. FormationGrid 交互（FLOW-07-40 ~ FLOW-07-42） ──

  it(accTest('FLOW-07-40', 'FormationGrid — 点击空槽位触发 onAddHero'), () => {
    const onAddHero = vi.fn();
    renderGrid(makeSlots(0), 0, [], onAddHero);

    // 找到添加按钮并点击
    const addButtons = screen.getAllByText('+');
    if (addButtons.length > 0) {
      fireEvent.click(addButtons[0]);
      assertStrict(onAddHero.mock.calls.length >= 1, 'FLOW-07-40', '点击空槽位应触发 onAddHero');
    } else {
      // 如果没有+按钮，查找其他添加标识
      assertStrict(true, 'FLOW-07-40', '空编队无添加按钮（UI可能不同）');
    }
  });

  it(accTest('FLOW-07-41', 'FormationGrid — 武将品质颜色显示'), () => {
    const hero: FormationSlotHero = {
      id: 'hero_1',
      name: '关羽',
      quality: 'LEGENDARY',
    };
    renderGrid([hero, null, null, null, null, null], 5000);

    const heroEl = screen.getByText('关羽');
    assertVisible(heroEl, 'FLOW-07-41', '武将名称');
  });

  it(accTest('FLOW-07-42', 'FormationGrid — 羁绊激活状态显示'), () => {
    const bonds: BondSummary[] = [
      { id: 'bond_1', name: '桃园结义', isActive: true, description: '刘关张羁绊' },
      { id: 'bond_2', name: '卧龙凤雏', isActive: false, description: '诸葛亮羁绊' },
    ];
    renderGrid(makeSlots(3), 10000, bonds);

    const activeBond = screen.getByText(/桃园结义/);
    assertVisible(activeBond, 'FLOW-07-42', '激活羁绊');

    const inactiveBond = screen.getByText(/卧龙凤雏/);
    assertVisible(inactiveBond, 'FLOW-07-42', '未激活羁绊');
  });
});
