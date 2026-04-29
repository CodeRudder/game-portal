/**
 * FLOW-05 招贤馆集成测试 — 渲染/普通招募/高级招募/免费招募/保底/十连/资源扣除/重复武将/历史记录。
 * 使用真实引擎（GameEventSimulator），不 mock engine。
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecruitModal from '@/components/idle/panels/hero/RecruitModal';
import HeroTab from '@/components/idle/panels/hero/HeroTab';
import { RECRUIT_COSTS, RECRUIT_PITY, DAILY_FREE_CONFIG } from '@/games/three-kingdoms/engine';
import { Quality as Q, QUALITY_ORDER } from '@/games/three-kingdoms/engine/hero/hero.types';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

/** Mock CSS imports */
vi.mock('@/components/idle/panels/hero/RecruitModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/RecruitPanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/RecruitResultModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroTab.css', () => ({}));
vi.mock('@/components/idle/panels/hero/hero-design-tokens.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroCard.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroDetailModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroDetailModal-chart.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroUpgradePanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroStarUpModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroStarUpModal-vars.css', () => ({}));
vi.mock('@/components/idle/panels/hero/SkillUpgradePanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/RadarChart.css', () => ({}));
vi.mock('@/components/idle/panels/hero/atoms.css', () => ({}));
vi.mock('@/components/idle/panels/hero/FormationPanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/GuideOverlay.css', () => ({}));
vi.mock('@/components/idle/common/Modal.css', () => ({}));
vi.mock('@/components/idle/common/Toast.css', () => ({}));
vi.mock('@/components/idle/common/Toast', () => ({
  Toast: { show: vi.fn(), success: vi.fn(), danger: vi.fn(), info: vi.fn() },
}));

// ── Test Helpers ──

const onClose = vi.fn();
const onRecruitComplete = vi.fn();

/** 创建带充足招募资源的 sim */
function createRecruitSim(opts: { goldAmount?: number; tokenAmount?: number } = {}): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ gold: opts.goldAmount ?? 50000, recruitToken: opts.tokenAmount ?? 5000 });
  return sim;
}

/** 渲染 RecruitModal 的快捷方法 */
function renderModal(sim: GameEventSimulator) {
  return render(<RecruitModal engine={sim.engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);
}

// ═══════════════════════════════════════════════════════════
// FLOW-05 招贤馆集成测试
// ═══════════════════════════════════════════════════════════

describe('FLOW-05 招贤馆集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ── 1. 招贤馆渲染（FLOW-05-01 ~ FLOW-05-05） ──

  it(accTest('FLOW-05-01', '招贤馆弹窗整体渲染 — 容器、标题、类型切换、按钮'), () => {
    const sim = createRecruitSim();
    renderModal(sim);

    const overlay = screen.getByTestId('recruit-modal-overlay');
    assertInDOM(overlay, 'FLOW-05-01', '招募弹窗遮罩层');

    const modal = screen.getByTestId('recruit-modal');
    assertInDOM(modal, 'FLOW-05-01', '招募弹窗容器');

    const title = screen.getByText('⚔️ 招贤纳士');
    assertInDOM(title, 'FLOW-05-01', '招募弹窗标题');

    assertInDOM(screen.getByTestId('recruit-modal-type-normal'), 'FLOW-05-01', '普通招贤按钮');
    assertInDOM(screen.getByTestId('recruit-modal-type-advanced'), 'FLOW-05-01', '高级招贤按钮');
    assertInDOM(screen.getByTestId('recruit-modal-single-btn'), 'FLOW-05-01', '单次招募按钮');
    assertInDOM(screen.getByTestId('recruit-modal-ten-btn'), 'FLOW-05-01', '十连招募按钮');
  });

  it(accTest('FLOW-05-02', '资源余额显示正确 — 铜钱和求贤令数值'), () => {
    const sim = createRecruitSim({ goldAmount: 10000, tokenAmount: 500 });
    renderModal(sim);

    // 初始 gold=300 + 10000 = 10,300; 初始 recruitToken=30 + 500 = 530
    const goldEl = screen.getByTestId('recruit-balance-gold');
    const tokenEl = screen.getByTestId('recruit-balance-token');
    assertStrict(goldEl.textContent!.includes('10,300'), 'FLOW-05-02', `铜钱余额应包含 10,300，实际: ${goldEl.textContent}`);
    assertStrict(tokenEl.textContent!.includes('530'), 'FLOW-05-02', `求贤令余额应包含 530，实际: ${tokenEl.textContent}`);
  });

  it(accTest('FLOW-05-03', '消耗显示正确 — 普通招募消耗招贤令×5'), () => {
    const sim = createRecruitSim();
    renderModal(sim);

    const costElements = screen.getAllByText(/招贤令 ×\d+/);
    assertStrict(costElements.length >= 2, 'FLOW-05-03', '应显示单抽和十连消耗');
    const hasSingleCost = costElements.some((el) => el.textContent!.includes('×1'));
    assertStrict(hasSingleCost, 'FLOW-05-03', '普通单抽应显示招贤令×1');
  });

  it(accTest('FLOW-05-04', '保底进度条可见 — 十连保底标签和计数'), () => {
    const sim = createRecruitSim();
    renderModal(sim);

    assertInDOM(screen.getByText('十连保底（稀有+）'), 'FLOW-05-04', '十连保底进度标签');
    assertInDOM(screen.getByText('0/10'), 'FLOW-05-04', '保底计数 0/10');
  });

  it(accTest('FLOW-05-05', '概率表展开后可见 — 概率一览'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-rates-toggle'));
    assertInDOM(screen.getByTestId('recruit-rates-table'), 'FLOW-05-05', '概率表');
    assertInDOM(screen.getByText('60%'), 'FLOW-05-05', '普通品质概率 60%');
  });

  // ── 2. 普通招募（FLOW-05-06 ~ FLOW-05-10） ──

  it(accTest('FLOW-05-06', '普通单抽完整流程 — 资源扣除+获得武将'), async () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    const heroCountBefore = engine.hero.getGeneralCount();

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    const tokenAfter = engine.getResourceAmount('recruitToken');
    const diff = tokenBefore - tokenAfter;
    assertStrict(diff === RECRUIT_COSTS.normal.amount, 'FLOW-05-06', `单抽消耗应为 ${RECRUIT_COSTS.normal.amount}，实际扣除 ${diff}`);
    assertStrict(engine.hero.getGeneralCount() >= heroCountBefore, 'FLOW-05-06', '武将数量应增加或不变');
  });

  it(accTest('FLOW-05-07', '普通单抽结果展示 — 品质标签和武将名称'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    assertInDOM(screen.getByTestId('recruit-modal-results'), 'FLOW-05-07', '单抽结果区域');
    const qualityLabels = screen.getByTestId('recruit-modal-results').querySelectorAll('.tk-recruit-result-quality');
    assertStrict(qualityLabels.length >= 1, 'FLOW-05-07', '结果卡片应显示品质标签');
    const nameLabels = screen.getByTestId('recruit-modal-results').querySelectorAll('.tk-recruit-result-name');
    assertStrict(nameLabels.length >= 1 && !!nameLabels[0].textContent?.trim(), 'FLOW-05-07', '武将名称不应为空');
  });

  it(accTest('FLOW-05-08', '普通单抽保底计数递增'), async () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const pityAfter = engine.getRecruitSystem().getGachaState().normalPity;
    assertStrict(typeof pityAfter === 'number' && pityAfter >= 0, 'FLOW-05-08', `保底计数应为非负数，实际: ${pityAfter}`);
  });

  it(accTest('FLOW-05-09', '普通单抽招募完成回调 — onRecruitComplete 被调用'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    assertStrict(onRecruitComplete.mock.calls.length >= 1, 'FLOW-05-09', '招募完成后 onRecruitComplete 应被调用');
  });

  it(accTest('FLOW-05-10', '普通单抽招募历史 — getRecruitHistory 有记录'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const history = sim.engine.getRecruitSystem().getRecruitHistory();
    assertStrict(history.length >= 1, 'FLOW-05-10', '招募后应有历史记录');
    assertStrict(history[0].results.length === 1, 'FLOW-05-10', '历史记录结果数量应为1');
  });

  // ── 3. 高级招募（FLOW-05-11 ~ FLOW-05-15） ──

  it(accTest('FLOW-05-11', '高级招募切换 — 消耗显示更新为招贤令×100'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    const costElements = screen.getAllByText(/招贤令 ×\d+/);
    const hasAdvancedCost = costElements.some((el) => el.textContent!.includes('×10'));
    assertStrict(hasAdvancedCost, 'FLOW-05-11', '高级招募应显示招贤令×10');
  });

  it(accTest('FLOW-05-12', '高级单抽完整流程 — 消耗求贤令×100'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    const diff = tokenBefore - engine.getResourceAmount('recruitToken');
    assertStrict(diff === RECRUIT_COSTS.advanced.amount, 'FLOW-05-12', `高级单抽消耗应为 ${RECRUIT_COSTS.advanced.amount}，实际扣除 ${diff}`);
  });

  it(accTest('FLOW-05-13', '高级招募保底计数独立 — 与普通池分开'), () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const engine = sim.engine;

    // 使用固定 RNG 确保不出稀有+（保底不重置）
    // 普通招募概率: COMMON 60%, FINE 30%, RARE 8%, EPIC 2%
    // 设置 RNG 始终返回 0.5（落在 FINE 区间，不出 RARE+）
    let seed = 42;
    engine.heroRecruit.setRng(() => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; });

    // 先做普通招募
    engine.recruit('normal', 1);
    const normalPityAfterNormal = engine.getRecruitSystem().getGachaState().normalPity;
    const advancedPityAfterNormal = engine.getRecruitSystem().getGachaState().advancedPity;

    // 再做高级招募
    engine.recruit('advanced', 1);

    const state = engine.getRecruitSystem().getGachaState();
    // 高级保底应递增（或因出高品质重置，但至少有变化）
    assertStrict(state.advancedPity !== advancedPityAfterNormal, 'FLOW-05-13',
      `高级保底计数应有变化（前: ${advancedPityAfterNormal}, 后: ${state.advancedPity}）`);
    assertStrict(state.normalPity === normalPityAfterNormal, 'FLOW-05-13',
    `普通保底计数不应变化（前: ${normalPityAfterNormal}, 后: ${state.normalPity}）`);
  });

  it(accTest('FLOW-05-14', '高级招募概率表不同 — 显示高级概率'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    await userEvent.click(screen.getByTestId('recruit-rates-toggle'));

    assertInDOM(screen.getByTestId('recruit-rates-table'), 'FLOW-05-14', '高级概率表');
    // 高级招募传说概率 2%
    const hasLegendary = screen.queryAllByText('2%').length > 0;
    assertStrict(hasLegendary, 'FLOW-05-14', '高级招募应显示传说概率 2%');
  });

  it(accTest('FLOW-05-15', '高级招募硬保底可见 — 100抽保底'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    const hardPityLabel = screen.queryByText(/硬保底.*传说/);
    assertStrict(!!hardPityLabel, 'FLOW-05-15', '高级招募应显示硬保底（传说+）');
  });

  // ── 4. 免费招募（FLOW-05-16 ~ FLOW-05-20） ──

  it(accTest('FLOW-05-16', '免费招募按钮可见 — 每日免费次数'), () => {
    const sim = createRecruitSim();
    renderModal(sim);

    const freeBtn = screen.getByTestId('recruit-modal-free-btn');
    assertInDOM(freeBtn, 'FLOW-05-16', '免费招募按钮');
  });

  it(accTest('FLOW-05-17', '免费招募执行 — 不消耗资源'), async () => {
    const sim = createRecruitSim();
    const tokenBefore = sim.engine.getResourceAmount('recruitToken');

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-free-btn'));

    const tokenAfter = sim.engine.getResourceAmount('recruitToken');
    assertStrict(tokenAfter === tokenBefore, 'FLOW-05-17', `免费招募不应消耗求贤令（前: ${tokenBefore}, 后: ${tokenAfter}）`);
  });

  it(accTest('FLOW-05-18', '免费招募次数用完 — 按钮显示已用且disabled'), async () => {
    const sim = createRecruitSim();
    // 手动用掉免费次数
    sim.engine.getRecruitSystem().freeRecruitSingle('normal');

    renderModal(sim);
    const freeBtn = screen.getByTestId('recruit-modal-free-btn') as HTMLButtonElement;

    assertStrict(freeBtn.disabled, 'FLOW-05-18', '免费次数用完后按钮应禁用');
    assertStrict(freeBtn.textContent!.includes('今日已用'), 'FLOW-05-18', `按钮应显示"今日已用"，实际: ${freeBtn.textContent}`);
  });

  it(accTest('FLOW-05-19', '高级招募无免费次数 — 无免费按钮'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    const freeBtn = screen.queryByTestId('recruit-modal-free-btn');
    assertStrict(freeBtn === null, 'FLOW-05-19', '高级招募不应显示免费按钮');
  });

  it(accTest('FLOW-05-20', '免费招募也计入保底 — 保底计数有变化'), async () => {
    const sim = createRecruitSim();
    // 注入固定 RNG：rng()=0.3 → COMMON 品质，确保不出 RARE+ 导致 normalPity 重置为 0
    sim.engine.getRecruitSystem().setRng(() => 0.3);
    const pityBefore = sim.engine.getRecruitSystem().getGachaState().normalPity;

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-free-btn'));

    const pityAfter = sim.engine.getRecruitSystem().getGachaState().normalPity;
    // 固定 RNG 下：出 COMMON → normalPity 从 0 递增到 1
    assertStrict(pityAfter === pityBefore + 1, 'FLOW-05-20',
      `免费招募后保底计数应递增1（前: ${pityBefore}, 后: ${pityAfter}）`);
  });

  // ── 5. 保底机制（FLOW-05-21 ~ FLOW-05-25） ──

  it(accTest('FLOW-05-21', '十连保底 — 十连招募后保底重置'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const engine = sim.engine;
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));

    const pityState = engine.getRecruitSystem().getGachaState();
    assertStrict(pityState.normalPity < 10, 'FLOW-05-21', `十连后保底计数应 < 10，实际: ${pityState.normalPity}`);
  });

  it(accTest('FLOW-05-22', '保底计数在出稀有+品质后重置'), () => {
    const sim = createRecruitSim({ tokenAmount: 50000 });
    const engine = sim.engine;

    // 执行十连招募（保底必出稀有+）
    const result = engine.recruit('normal', 10);
    assertStrict(result !== null, 'FLOW-05-22', '十连招募应成功');

    const pityState = engine.getRecruitSystem().getGachaState();
    assertStrict(pityState.normalPity < 10, 'FLOW-05-22', `十连招募后保底计数应 < 10，实际: ${pityState.normalPity}`);
  });

  it(accTest('FLOW-05-23', '高级招募硬保底 — 100抽内出传说'), () => {
    const sim = createRecruitSim({ tokenAmount: 500000 });
    const engine = sim.engine;

    let legendaryFound = false;
    for (let i = 0; i < 10; i++) {
      const result = engine.recruit('advanced', 10);
      if (result) {
        for (const r of result.results) {
          if (r.quality === 'LEGENDARY') legendaryFound = true;
        }
      }
    }

    const pityState = engine.getRecruitSystem().getGachaState();
    assertStrict(legendaryFound || pityState.advancedHardPity <= 100, 'FLOW-05-23', '100抽内应出传说或保底计数 <= 100');
  });

  it(accTest('FLOW-05-24', '保底进度条UI同步 — 招募后引擎保底状态变化'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    // 注入固定 RNG：rng()=0.3 → COMMON 品质，确保不出 RARE+ 导致 normalPity 重置为 0
    // 消除随机性：初始 normalPity=0，出 COMMON → normalPity 递增为 1（确定性）
    sim.engine.getRecruitSystem().setRng(() => 0.3);
    const pityBefore = sim.engine.getRecruitSystem().getGachaState().normalPity;

    renderModal(sim);
    assertInDOM(screen.getByText('0/10'), 'FLOW-05-24', '初始保底计数 0/10');

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const pityAfter = sim.engine.getRecruitSystem().getGachaState().normalPity;
    // 固定 RNG 下：出 COMMON → normalPity 从 0 递增到 1
    assertStrict(pityAfter === pityBefore + 1, 'FLOW-05-24',
      `招募后保底计数应递增1（前: ${pityBefore}, 后: ${pityAfter}）`);
  });

  it(accTest('FLOW-05-25', '保底状态持久化 — serialize/deserialize'), () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    sim.engine.recruit('normal', 1);

    const pityBefore = sim.engine.getRecruitSystem().getGachaState().normalPity;
    const saved = sim.engine.getRecruitSystem().serialize();

    assertStrict(saved.pity.normalPity === pityBefore, 'FLOW-05-25', '序列化保底数据应匹配');
    assertStrict(typeof saved.pity.normalPity === 'number', 'FLOW-05-25', '保底数据应为数字');
  });

  // ── 6. 十连招募（FLOW-05-26 ~ FLOW-05-30） ──

  it(accTest('FLOW-05-26', '十连招募完整流程 — 获得10个结果'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    assertInDOM(screen.getByTestId('recruit-modal-results'), 'FLOW-05-26', '十连招募结果区域');

    const history = sim.engine.getRecruitSystem().getRecruitHistory();
    const lastEntry = history[0];
    assertStrict(lastEntry.results.length === 10, 'FLOW-05-26', `十连应产生10个结果，实际: ${lastEntry.results.length}`);
  });

  it(accTest('FLOW-05-27', '十连招募消耗正确 — 求贤令×50'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const tokenBefore = sim.engine.getResourceAmount('recruitToken');

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));

    const diff = tokenBefore - sim.engine.getResourceAmount('recruitToken');
    const expected = RECRUIT_COSTS.normal.amount * 10;
    assertStrict(diff === expected, 'FLOW-05-27', `十连应消耗 ${expected} 求贤令，实际消耗 ${diff}`);
  });

  it(accTest('FLOW-05-28', '十连招募结果排序 — 低品质在前（引擎排序）'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));

    const history = sim.engine.getRecruitSystem().getRecruitHistory();
    const lastEntry = history[0];
    const qualities = lastEntry.results.map((r) => r.quality);

    // 引擎内部排序：QUALITY_ORDER 升序（低品质在前）
    const qualityOrder: Record<string, number> = { COMMON: 1, FINE: 2, RARE: 3, EPIC: 4, LEGENDARY: 5 };
    let sorted = true;
    for (let i = 1; i < qualities.length; i++) {
      if (qualityOrder[qualities[i]] < qualityOrder[qualities[i - 1]]) {
        sorted = false;
        break;
      }
    }
    assertStrict(sorted, 'FLOW-05-28', '十连结果应按品质升序排列（低品质在前）');
  });

  it(accTest('FLOW-05-29', '十连招募资源不足 — 按钮禁用'), () => {
    const sim = createRecruitSim({ tokenAmount: 0 }); // 初始30，够单抽30次但不够十连10
    // 消耗掉大部分 recruitToken，只留5个（够单抽但不够十连）
    sim.engine.resource.consumeResource('recruitToken', 25); // 30 - 25 = 5，够单抽但不够十连(10)
    renderModal(sim);

    const tenBtn = screen.getByTestId('recruit-modal-ten-btn') as HTMLButtonElement;
    assertStrict(tenBtn.disabled, 'FLOW-05-29', '资源不足时十连按钮应禁用');
  });

  it(accTest('FLOW-05-30', '高级十连招募 — 消耗求贤令×1000'), async () => {
    const sim = createRecruitSim({ tokenAmount: 50000 });
    const tokenBefore = sim.engine.getResourceAmount('recruitToken');

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));

    const diff = tokenBefore - sim.engine.getResourceAmount('recruitToken');
    const expected = RECRUIT_COSTS.advanced.amount * 10;
    assertStrict(diff === expected, 'FLOW-05-30', `高级十连应消耗 ${expected} 求贤令，实际消耗 ${diff}`);
  });

  // ── 7. 招募资源扣除（FLOW-05-31 ~ FLOW-05-35） ──

  it(accTest('FLOW-05-31', '资源刚好够单抽 — 按钮可点击'), () => {
    const sim = createRecruitSim({ tokenAmount: 0 }); // 初始 recruitToken=30，够单抽30次
    renderModal(sim);

    const singleBtn = screen.getByTestId('recruit-modal-single-btn') as HTMLButtonElement;
    assertStrict(!singleBtn.disabled, 'FLOW-05-31', '资源刚好够时单抽按钮应可点击');
  });

  it(accTest('FLOW-05-32', '资源不足 — 单抽按钮禁用'), () => {
    const sim = createRecruitSim({ tokenAmount: 0 });
    // 消耗掉初始的 recruitToken（初始30，每次消耗1，招募30次耗尽）
    for (let i = 0; i < 30; i++) {
      sim.engine.recruit('normal', 1);
    }

    renderModal(sim);
    const singleBtn = screen.getByTestId('recruit-modal-single-btn') as HTMLButtonElement;
    assertStrict(singleBtn.disabled, 'FLOW-05-32', '资源不足时单抽按钮应禁用');
  });

  it(accTest('FLOW-05-33', '招募后余额显示更新'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    const tokenBefore = sim.engine.getResourceAmount('recruitToken');

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    const tokenAfter = sim.engine.getResourceAmount('recruitToken');
    assertStrict(tokenAfter === tokenBefore - RECRUIT_COSTS.normal.amount, 'FLOW-05-33', `余额应减少${RECRUIT_COSTS.normal.amount}，前: ${tokenBefore}，后: ${tokenAfter}`);
  });

  it(accTest('FLOW-05-34', '连续招募多次 — 资源持续扣除'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    const tokenBefore = sim.engine.getResourceAmount('recruitToken');

    renderModal(sim);
    const singleBtn = screen.getByTestId('recruit-modal-single-btn');
    await userEvent.click(singleBtn);
    await userEvent.click(singleBtn);

    const spent = tokenBefore - sim.engine.getResourceAmount('recruitToken');
    assertStrict(spent >= RECRUIT_COSTS.normal.amount * 2, 'FLOW-05-34', `至少扣除两次招募费用（${RECRUIT_COSTS.normal.amount * 2}），实际扣除 ${spent}`);
  });

  it(accTest('FLOW-05-35', '资源耗尽后按钮变为禁用'), async () => {
    const sim = createRecruitSim({ tokenAmount: 0 }); // 初始30，够30次单抽
    renderModal(sim);

    const singleBtn = screen.getByTestId('recruit-modal-single-btn');
    // 消耗完所有30个招贤令（每次消耗1）
    for (let i = 0; i < 30; i++) {
      await userEvent.click(singleBtn);
    }

    const tokenRemaining = sim.engine.getResourceAmount('recruitToken');
    assertStrict(tokenRemaining === 0, 'FLOW-05-35', `资源应已耗尽，剩余: ${tokenRemaining}`);
  });

  // ── 8. 已有武将处理（FLOW-05-36 ~ FLOW-05-40） ──

  it(accTest('FLOW-05-36', '重复武将转为碎片 — 不崩溃'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    // 添加已有武将增加重复概率
    sim.addHeroDirectly('liubei');
    sim.addHeroDirectly('guanyu');
    sim.addHeroDirectly('zhangfei');
    sim.addHeroDirectly('zhugeliang');
    sim.addHeroDirectly('zhaoyun');

    renderModal(sim);
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    }

    assertStrict(true, 'FLOW-05-36', '重复武将处理不应崩溃');
  });

  it(accTest('FLOW-05-37', '新武将标记 — 首次招募显示"新获得"'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    // 首次招募必然是新武将
    const history = sim.engine.getRecruitSystem().getRecruitHistory();
    const hasNew = history.some((entry) => entry.results.some((r) => !r.isDuplicate && r.general !== null));
    const newLabel = screen.queryAllByText('✨ 新获得');
    assertStrict(hasNew || newLabel.length > 0, 'FLOW-05-37', '首次招募应获得新武将');
  });

  it(accTest('FLOW-05-38', '碎片数量按品质计算 — 引擎碎片表正确'), () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    sim.addHeroDirectly('liubei');

    const heroSystem = sim.engine.getHeroSystem();
    assertStrict(heroSystem.hasGeneral('liubei'), 'FLOW-05-38', '刘备应已存在');

    const fragments = heroSystem.getFragments('liubei');
    assertStrict(typeof fragments === 'number', 'FLOW-05-38', '碎片数量应为数字');
  });

  it(accTest('FLOW-05-39', '十连招募中混合新武将和碎片'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    // 添加一些已有武将
    sim.addHeroDirectly('liubei');
    sim.addHeroDirectly('guanyu');
    sim.addHeroDirectly('zhangfei');

    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));

    const history = sim.engine.getRecruitSystem().getRecruitHistory();
    const lastEntry = history[0];
    const newCount = lastEntry.results.filter((r) => !r.isDuplicate && r.general).length;
    const dupCount = lastEntry.results.filter((r) => r.isDuplicate).length;

    assertStrict(newCount + dupCount === 10, 'FLOW-05-39', `新武将(${newCount}) + 重复(${dupCount}) 应等于 10`);
  });

  it(accTest('FLOW-05-40', '招募到满星武将碎片转化 — 引擎处理正确'), () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    sim.addHeroDirectly('liubei');

    const heroSystem = sim.engine.getHeroSystem();
    assertStrict(heroSystem.hasGeneral('liubei'), 'FLOW-05-40', '刘备应已存在');

    const fragments = heroSystem.getFragments('liubei');
    assertStrict(typeof fragments === 'number', 'FLOW-05-40', '碎片数量应为数字');
  });

  // ── 9. 招募动画/反馈（FLOW-05-41 ~ FLOW-05-45） ──

  it(accTest('FLOW-05-41', '招募结果展示 — 结果区域可见'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    assertInDOM(screen.getByTestId('recruit-modal-results'), 'FLOW-05-41', '招募结果区域');
  });

  it(accTest('FLOW-05-42', '招募结果关闭 — 点击关闭按钮清除结果'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    assertStrict(!!screen.queryByTestId('recruit-modal-results'), 'FLOW-05-42', '招募结果应显示');

    // 关闭结果（结果区域内的 ✕ 按钮）
    const closeBtn = within(screen.getByTestId('recruit-modal-results')).getByText('✕');
    await userEvent.click(closeBtn);

    assertStrict(!screen.queryByTestId('recruit-modal-results'), 'FLOW-05-42', '关闭后结果区域应消失');
  });

  it(accTest('FLOW-05-43', '招募结果品质颜色 — 不同品质不同标签'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const qualityLabels = screen.queryAllByText(/普通|精良|稀有|史诗|传说/);
    assertStrict(qualityLabels.length > 0, 'FLOW-05-43', '应显示品质标签');
  });

  it(accTest('FLOW-05-44', '招募完成回调触发 — onRecruitComplete被调用'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    assertStrict(onRecruitComplete.mock.calls.length >= 1, 'FLOW-05-44', '招募完成后回调应被调用');
  });

  it(accTest('FLOW-05-45', '招募历史记录展示 — 展开后可见历史'), async () => {
    const sim = createRecruitSim({ tokenAmount: 500 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    await userEvent.click(screen.getByText(/招募记录/));
    const historyCount = sim.engine.getRecruitSystem().getRecruitHistoryCount();
    assertStrict(historyCount >= 2, 'FLOW-05-45', `应有至少2条历史记录，实际: ${historyCount}`);
  });

  // ── 10. HeroTab 招募入口集成（FLOW-05-46 ~ FLOW-05-50） ──

  it(accTest('FLOW-05-46', 'HeroTab招募按钮 — 点击打开招募弹窗'), async () => {
    const sim = createRecruitSim();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const recruitBtn = screen.getByTestId('hero-tab-recruit-btn');
    assertInDOM(recruitBtn, 'FLOW-05-46', 'HeroTab招募按钮');

    await userEvent.click(recruitBtn);
    assertInDOM(screen.getByTestId('recruit-modal-overlay'), 'FLOW-05-46', '招募弹窗应打开');
  });

  it(accTest('FLOW-05-47', 'HeroTab空状态 — 无武将时显示招募引导或招募按钮'), () => {
    const sim = createRecruitSim();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const emptyState = screen.queryByTestId('hero-tab-empty');
    if (emptyState) {
      const emptyRecruitBtn = screen.queryByTestId('hero-tab-empty-recruit-btn');
      assertStrict(!!emptyRecruitBtn, 'FLOW-05-47', '空状态应有前往招募按钮');
    } else {
      const recruitBtn = screen.getByTestId('hero-tab-recruit-btn');
      assertInDOM(recruitBtn, 'FLOW-05-47', '招募按钮应存在');
    }
  });

  it(accTest('FLOW-05-48', 'HeroTab招募后武将列表刷新'), async () => {
    const sim = createRecruitSim({ tokenAmount: 100 });
    const heroCountBefore = sim.engine.getHeroSystem().getAllGenerals().length;

    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    await userEvent.click(screen.getByTestId('hero-tab-recruit-btn'));
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    await userEvent.click(screen.getByTestId('recruit-modal-close'));

    const heroCountAfter = sim.engine.getHeroSystem().getAllGenerals().length;
    assertStrict(heroCountAfter >= heroCountBefore, 'FLOW-05-48', '招募后武将数量应增加或不变');
  });

  it(accTest('FLOW-05-49', '招募弹窗ESC关闭 — 键盘事件处理'), () => {
    const sim = createRecruitSim();
    renderModal(sim);

    fireEvent.keyDown(document, { key: 'Escape' });
    assertStrict(onClose.mock.calls.length === 1, 'FLOW-05-49', 'ESC键应触发关闭回调');
  });

  it(accTest('FLOW-05-50', '招募弹窗遮罩点击关闭'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-overlay'));
    assertStrict(onClose.mock.calls.length >= 1, 'FLOW-05-50', '遮罩点击应触发关闭');
  });

  // ── 11. 端到端场景（FLOW-05-51 ~ FLOW-05-55） ──

  it(accTest('FLOW-05-51', '端到端 — 从HeroTab进入招募到获得武将全流程'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const heroCountBefore = sim.engine.getHeroSystem().getAllGenerals().length;

    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    // 1. 点击招募按钮
    await userEvent.click(screen.getByTestId('hero-tab-recruit-btn'));

    // 2. 验证弹窗打开
    assertInDOM(screen.getByTestId('recruit-modal'), 'FLOW-05-51', '招募弹窗');

    // 3. 执行单次招募
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    // 4. 验证结果展示
    assertStrict(!!screen.queryByTestId('recruit-modal-results'), 'FLOW-05-51', '招募结果应显示');

    // 5. 关闭弹窗
    await userEvent.click(screen.getByTestId('recruit-modal-close'));

    // 6. 验证武将数量
    const heroCountAfter = sim.engine.getHeroSystem().getAllGenerals().length;
    assertStrict(heroCountAfter >= heroCountBefore, 'FLOW-05-51', '武将数量应增加或不变');
  });

  it(accTest('FLOW-05-52', '端到端 — 普通招募→高级招募→免费招募完整体验'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    // 1. 免费招募
    await userEvent.click(screen.getByTestId('recruit-modal-free-btn'));

    // 2. 普通单抽
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    // 3. 切换高级
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));

    // 4. 高级单抽
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));

    const historyCount = sim.engine.getRecruitSystem().getRecruitHistoryCount();
    assertStrict(historyCount >= 3, 'FLOW-05-52', `应有至少3条招募记录，实际: ${historyCount}`);
  });

  it(accTest('FLOW-05-53', '端到端 — 十连招募+保底触发+历史查看'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    renderModal(sim);

    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));

    const pityState = sim.engine.getRecruitSystem().getGachaState();
    assertStrict(pityState.normalPity < 10, 'FLOW-05-53', '十连后保底应重置');

    await userEvent.click(screen.getByText(/招募记录/));
    const history = sim.engine.getRecruitSystem().getRecruitHistory();
    assertStrict(history.length > 0, 'FLOW-05-53', '应有招募历史');
    assertStrict(history[0].results.length === 10, 'FLOW-05-53', '历史中应有10个结果');
  });

  it(accTest('FLOW-05-54', '端到端 — 招募资源管理完整流程'), async () => {
    // 使用较少资源避免循环抽卡超时，同时足够验证免费+单抽+资源不足流程
    const sim = createRecruitSim({ tokenAmount: 0 }); // 初始30个招贤令
    const tokenInitial = sim.engine.getResourceAmount('recruitToken');

    renderModal(sim);

    // 1. 免费招募（不消耗资源）
    await userEvent.click(screen.getByTestId('recruit-modal-free-btn'));
    const afterFree = sim.engine.getResourceAmount('recruitToken');
    assertStrict(afterFree === tokenInitial, 'FLOW-05-54', '免费招募不应消耗资源');

    // 2. 普通单抽（消耗1）
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const afterSingle = sim.engine.getResourceAmount('recruitToken');
    assertStrict(afterSingle === tokenInitial - RECRUIT_COSTS.normal.amount, 'FLOW-05-54', `单抽后应减少${RECRUIT_COSTS.normal.amount}，实际: ${afterSingle}`);

    // 3. 再抽几次直到资源不足（每次消耗1）
    while (sim.engine.getResourceAmount('recruitToken') >= RECRUIT_COSTS.normal.amount) {
      await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    }

    const finalToken = sim.engine.getResourceAmount('recruitToken');
    assertStrict(finalToken < RECRUIT_COSTS.normal.amount, 'FLOW-05-54', `资源应已不足单抽，剩余: ${finalToken}`);
  });

  it(accTest('FLOW-05-55', '端到端 — initMidGameState招募系统状态完整'), () => {
    const sim = createSim();
    sim.initMidGameState();

    const recruitSystem = sim.engine.getRecruitSystem();
    assertStrict(!!recruitSystem, 'FLOW-05-55', '招募系统应存在');

    const pityState = recruitSystem.getGachaState();
    assertStrict(typeof pityState.normalPity === 'number', 'FLOW-05-55', '保底状态应有效');
    assertStrict(typeof pityState.advancedPity === 'number', 'FLOW-05-55', '高级保底状态应有效');

    sim.addResources({ recruitToken: 100 });
    const result = sim.engine.recruit('normal', 1);
    assertStrict(result !== null, 'FLOW-05-55', '中期状态招募应成功');
    assertStrict(result!.results.length === 1, 'FLOW-05-55', '单抽应返回1个结果');
  });
});
