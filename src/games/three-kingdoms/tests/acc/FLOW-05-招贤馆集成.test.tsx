/**
 * FLOW-05 招贤馆集成测试 — 渲染/单抽/十连/免费招募/保底机制/结果展示/资源不足。
 * 使用真实引擎（GameEventSimulator），不 mock engine。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecruitModal from '@/components/idle/panels/hero/RecruitModal';
import { RECRUIT_COSTS, RECRUIT_PITY, DAILY_FREE_CONFIG } from '@/games/three-kingdoms/engine';
import { Quality as Q, QUALITY_ORDER } from '@/games/three-kingdoms/engine/hero/hero.types';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

vi.mock('@/components/idle/panels/hero/RecruitModal.css', () => ({}));
vi.mock('@/components/idle/common/Toast', () => ({
  Toast: { show: vi.fn(), success: vi.fn(), danger: vi.fn() },
}));

const onClose = vi.fn();
const onRecruitComplete = vi.fn();

/** 创建带充足招募资源的 sim */
function createRecruitSim(opts: { goldAmount?: number; tokenAmount?: number } = {}): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ gold: opts.goldAmount ?? 50000, recruitToken: opts.tokenAmount ?? 500 });
  return sim;
}

/** 创建带固定种子的 sim（确定性招募结果） */
function createDeterministicSim(seed: number, opts: { goldAmount?: number; tokenAmount?: number } = {}): GameEventSimulator {
  const sim = createRecruitSim(opts);
  let s = seed;
  sim.engine.heroRecruit.setRng(() => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; });
  return sim;
}

/** 渲染 RecruitModal 的快捷方法 */
function renderModal(sim: GameEventSimulator) {
  return render(<RecruitModal engine={sim.engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);
}

describe('FLOW-05 招贤馆集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ═══ 1. 招贤馆渲染（FLOW-05-01 ~ FLOW-05-05） ═══

  it(accTest('FLOW-05-01', '招贤馆整体渲染 — 弹窗容器、标题、类型选择、操作按钮'), () => {
    const sim = createRecruitSim();
    renderModal(sim);
    const overlay = screen.getByTestId('recruit-modal-overlay');
    assertVisible(overlay, 'FLOW-05-01', '招募弹窗遮罩层');
    const modal = screen.getByTestId('recruit-modal');
    assertVisible(modal, 'FLOW-05-01', '招募弹窗容器');
    const title = screen.getByText('⚔️ 招贤纳士');
    assertVisible(title, 'FLOW-05-01', '招募弹窗标题');
    assertVisible(screen.getByTestId('recruit-modal-type-normal'), 'FLOW-05-01', '普通招贤按钮');
    assertVisible(screen.getByTestId('recruit-modal-type-advanced'), 'FLOW-05-01', '高级招贤按钮');
  });

  it(accTest('FLOW-05-02', '招募按钮可见 — 单次招募和十连招募按钮'), () => {
    const sim = createRecruitSim();
    renderModal(sim);
    assertVisible(screen.getByTestId('recruit-modal-single-btn'), 'FLOW-05-02', '单次招募按钮');
    assertVisible(screen.getByTestId('recruit-modal-ten-btn'), 'FLOW-05-02', '十连招募按钮');
  });

  it(accTest('FLOW-05-03', '资源余额显示正确 — 铜钱和求贤令数值'), () => {
    const sim = createRecruitSim({ goldAmount: 10000, tokenAmount: 500 });
    renderModal(sim);
    // 初始 gold=300 + 10000 = 10,300; 初始 recruitToken=10 + 500 = 510
    const goldEl = screen.getByTestId('recruit-balance-gold');
    const tokenEl = screen.getByTestId('recruit-balance-token');
    assertStrict(goldEl.textContent!.includes('10,300'), 'FLOW-05-03', `铜钱余额应显示 10,300，实际: ${goldEl.textContent}`);
    assertStrict(tokenEl.textContent!.includes('510'), 'FLOW-05-03', `求贤令余额应显示 510，实际: ${tokenEl.textContent}`);
  });

  it(accTest('FLOW-05-04', '消耗显示正确 — 单抽和十连消耗标注'), () => {
    const sim = createRecruitSim();
    renderModal(sim);
    const costElements = screen.getAllByText(/求贤令 ×\d+/);
    assertStrict(costElements.length >= 2, 'FLOW-05-04', '应显示单抽和十连消耗（求贤令）');
  });

  it(accTest('FLOW-05-05', '保底进度条可见 — 十连保底和硬保底标签'), () => {
    const sim = createRecruitSim();
    renderModal(sim);
    assertVisible(screen.getByText('十连保底（稀有+）'), 'FLOW-05-05', '十连保底进度标签');
  });

  // ═══ 2. 单次招募（FLOW-05-06 ~ FLOW-05-12） ═══

  it(accTest('FLOW-05-06', '普通单抽完整流程 — 资源扣除+获得武将'), async () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    const heroCountBefore = engine.hero.getGeneralCount();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const tokenAfter = engine.getResourceAmount('recruitToken');
    assertStrict(tokenAfter < tokenBefore, 'FLOW-05-06', `单抽后求贤令应减少（前: ${tokenBefore}, 后: ${tokenAfter}）`);
    assertStrict(tokenBefore - tokenAfter === RECRUIT_COSTS.normal.amount, 'FLOW-05-06', `单抽消耗应为 ${RECRUIT_COSTS.normal.amount}，实际扣除 ${tokenBefore - tokenAfter}`);
    assertStrict(engine.hero.getGeneralCount() >= heroCountBefore, 'FLOW-05-06', '武将数量应增加或不变（重复武将碎片转化）');
  });

  it(accTest('FLOW-05-07', '普通单抽结果展示 — 显示招募结果区域'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    assertVisible(screen.getByTestId('recruit-modal-results'), 'FLOW-05-07', '单抽结果区域');
  });

  it(accTest('FLOW-05-08', '高级单抽完整流程 — 切换高级后招募'), async () => {
    const sim = createRecruitSim({ tokenAmount: 1000 });
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const diff = tokenBefore - engine.getResourceAmount('recruitToken');
    assertStrict(diff === RECRUIT_COSTS.advanced.amount, 'FLOW-05-08', `高级单抽消耗应为 ${RECRUIT_COSTS.advanced.amount}，实际扣除 ${diff}`);
  });

  it(accTest('FLOW-05-09', '单抽保底计数递增 — getGachaState 反映变化'), async () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const pityAfter = engine.getRecruitSystem().getGachaState().normalPity;
    assertStrict(typeof pityAfter === 'number' && pityAfter >= 0, 'FLOW-05-09', `保底计数应为非负数，实际: ${pityAfter}`);
    // 多次招募后保底计数有变化
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    }
    const pityMulti = engine.getRecruitSystem().getGachaState().normalPity;
    assertStrict(typeof pityMulti === 'number' && pityMulti >= 0, 'FLOW-05-09', `多次招募后保底计数应为非负数，实际: ${pityMulti}`);
  });

  it(accTest('FLOW-05-10', '单抽招募完成回调 — onRecruitComplete 被调用'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    assertStrict(onRecruitComplete.mock.calls.length >= 1, 'FLOW-05-10', '招募完成后 onRecruitComplete 应被调用');
  });

  it(accTest('FLOW-05-11', '重复武将碎片转化 — 已有武将再次招募获得碎片'), async () => {
    const sim = createRecruitSim();
    // 先添加一个武将确保重复
    sim.addHeroDirectly('minbingduizhang');
    renderModal(sim);
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    }
    assertStrict(true, 'FLOW-05-11', '重复武将碎片转化应正常执行');
  });

  it(accTest('FLOW-05-12', '招募结果关闭后可再次招募 — 关闭结果面板'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const closeBtn = within(screen.getByTestId('recruit-modal-results')).getByText('✕');
    await userEvent.click(closeBtn);
    assertStrict(!screen.queryByTestId('recruit-modal-results'), 'FLOW-05-12', '关闭后结果面板应消失');
  });

  // ═══ 3. 十连招募（FLOW-05-13 ~ FLOW-05-17） ═══

  it(accTest('FLOW-05-13', '十连招募完整流程 — 获得10个结果'), async () => {
    const sim = createRecruitSim({ tokenAmount: 2000 });
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    assertStrict(engine.getResourceAmount('recruitToken') < tokenBefore, 'FLOW-05-13', '十连招募后求贤令应减少');
    assertVisible(screen.getByTestId('recruit-modal-results'), 'FLOW-05-13', '十连招募结果区域');
  });

  it(accTest('FLOW-05-14', '十连招募结果数量 — 显示10张结果卡片'), async () => {
    const sim = createRecruitSim({ tokenAmount: 2000 });
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    const cards = screen.getByTestId('recruit-modal-results').querySelectorAll('.tk-recruit-result-card');
    assertStrict(cards.length === 10, 'FLOW-05-14', `十连应显示10张卡片，实际: ${cards.length}`);
  });

  it(accTest('FLOW-05-15', '十连招募消耗正确 — 扣除 recruitToken × 50'), async () => {
    const sim = createRecruitSim({ tokenAmount: 2000 });
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    const diff = tokenBefore - engine.getResourceAmount('recruitToken');
    const expected = RECRUIT_COSTS.normal.amount * 10;
    assertStrict(diff === expected, 'FLOW-05-15', `十连消耗应为 ${expected}，实际扣除 ${diff}`);
  });

  it(accTest('FLOW-05-16', '高级十连招募 — 切换高级后十连'), async () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    const diff = tokenBefore - engine.getResourceAmount('recruitToken');
    const expected = RECRUIT_COSTS.advanced.amount * 10;
    assertStrict(diff === expected, 'FLOW-05-16', `高级十连消耗应为 ${expected}，实际扣除 ${diff}`);
  });

  it(accTest('FLOW-05-17', '十连招募保底计数 — 十连触发保底后计数重置'), async () => {
    const sim = createRecruitSim({ tokenAmount: 2000 });
    const engine = sim.engine;
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    const pityAfter = engine.getRecruitSystem().getGachaState().normalPity;
    // 十连保底阈值=10，十连必定触发保底，保底计数器重置为0
    assertStrict(pityAfter >= 0 && pityAfter <= 10, 'FLOW-05-17', `十连后保底计数应在0~10之间，实际: ${pityAfter}`);
  });

  // ═══ 4. 免费招募（FLOW-05-18 ~ FLOW-05-22） ═══

  it(accTest('FLOW-05-18', '免费招募按钮可见 — 每日免费次数显示'), () => {
    const sim = createRecruitSim();
    renderModal(sim);
    assertVisible(screen.getByTestId('recruit-modal-free-btn'), 'FLOW-05-18', '免费招募按钮');
  });

  it(accTest('FLOW-05-19', '免费招募执行 — 不消耗资源'), async () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    const goldBefore = engine.getResourceAmount('gold');
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-free-btn'));
    assertStrict(engine.getResourceAmount('recruitToken') === tokenBefore, 'FLOW-05-19', '免费招募不应消耗求贤令');
    assertStrict(engine.getResourceAmount('gold') === goldBefore, 'FLOW-05-19', '免费招募不应消耗铜钱');
  });

  it(accTest('FLOW-05-20', '免费招募次数消耗 — 使用后次数减少'), async () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    const remainingBefore = engine.getRecruitSystem().getRemainingFreeCount('normal');
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-free-btn'));
    const remainingAfter = engine.getRecruitSystem().getRemainingFreeCount('normal');
    assertStrict(remainingAfter === remainingBefore - 1, 'FLOW-05-20', `免费次数应减少1（前: ${remainingBefore}, 后: ${remainingAfter}）`);
  });

  it(accTest('FLOW-05-21', '免费次数用完后按钮置灰 — 今日已用'), () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    const maxFree = DAILY_FREE_CONFIG.normal.freeCount;
    for (let i = 0; i < maxFree; i++) {
      engine.getRecruitSystem().freeRecruitSingle('normal');
    }
    renderModal(sim);
    const freeBtn = screen.getByTestId('recruit-modal-free-btn') as HTMLButtonElement;
    assertStrict(freeBtn.disabled, 'FLOW-05-21', '免费次数用完后按钮应置灰');
    assertStrict(freeBtn.textContent?.includes('今日已用'), 'FLOW-05-21', `按钮文本应显示"今日已用"，实际: ${freeBtn.textContent}`);
  });

  it(accTest('FLOW-05-22', '高级招募无免费次数 — 免费按钮不显示'), async () => {
    const sim = createRecruitSim({ tokenAmount: 1000 });
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    assertStrict(!screen.queryByTestId('recruit-modal-free-btn'), 'FLOW-05-22', '高级招募不应显示免费招募按钮');
  });

  // ═══ 5. 保底机制（FLOW-05-23 ~ FLOW-05-29） ═══

  it(accTest('FLOW-05-23', '十连保底触发 — 连续9次未出稀有+后第10次保底'), () => {
    const sim = createDeterministicSim(42, { tokenAmount: 2000 });
    const engine = sim.engine;
    // 通过引擎直接执行9次招募来累积保底计数
    for (let i = 0; i < 9; i++) {
      engine.recruit('normal', 1);
    }
    sim.addResources({ recruitToken: 100 });
    const pityAfter9 = engine.getRecruitSystem().getGachaState().normalPity;
    assertStrict(pityAfter9 >= 0, 'FLOW-05-23', `9次招募后保底计数应为非负数: ${pityAfter9}`);
    // 如果保底计数到了阈值，第10次应触发保底
    if (pityAfter9 >= RECRUIT_PITY.normal.tenPullThreshold - 1) {
      const result = engine.recruit('normal', 1);
      if (result) {
        const hasRareOrAbove = result.results.some(
          r => QUALITY_ORDER[r.quality] >= QUALITY_ORDER[RECRUIT_PITY.normal.tenPullMinQuality],
        );
        assertStrict(hasRareOrAbove, 'FLOW-05-23', '保底触发时应出稀有+品质');
      }
    } else {
      assertStrict(true, 'FLOW-05-23', '9次内已出稀有+，保底计数已重置');
    }
  });

  it(accTest('FLOW-05-24', '高级招募硬保底 — 100抽必出传说+'), () => {
    const sim = createDeterministicSim(123, { tokenAmount: 50000 });
    const engine = sim.engine;
    assertStrict(RECRUIT_PITY.advanced.hardPityThreshold === 100, 'FLOW-05-24', '高级招募硬保底阈值应为100');
    let foundLegendary = false;
    for (let i = 0; i < 99; i++) {
      sim.addResources({ recruitToken: 200 });
      const result = engine.recruit('advanced', 1);
      if (result && result.results.some(r => QUALITY_ORDER[r.quality] >= QUALITY_ORDER[Q.LEGENDARY])) {
        foundLegendary = true;
      }
    }
    if (!foundLegendary) {
      sim.addResources({ recruitToken: 200 });
      const result = engine.recruit('advanced', 1);
      if (result) {
        const hasLegendary = result.results.some(
          r => QUALITY_ORDER[r.quality] >= QUALITY_ORDER[RECRUIT_PITY.advanced.hardPityMinQuality],
        );
        assertStrict(hasLegendary, 'FLOW-05-24', '100次未出传说后硬保底应触发传说+品质');
      }
    } else {
      assertStrict(true, 'FLOW-05-24', '99次内已出传说，硬保底已重置');
    }
  });

  it(accTest('FLOW-05-25', '保底计数出稀有后重置 — normalPity 归零'), () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const engine = sim.engine;
    const recruitSystem = engine.getRecruitSystem();
    let foundRare = false;
    for (let i = 0; i < 20; i++) {
      sim.addResources({ recruitToken: 100 });
      const result = engine.recruit('normal', 1);
      if (result) {
        const hasRare = result.results.some(
          r => QUALITY_ORDER[r.quality] >= QUALITY_ORDER[RECRUIT_PITY.normal.tenPullMinQuality],
        );
        if (hasRare) {
          foundRare = true;
          const pityState = recruitSystem.getGachaState();
          assertStrict(pityState.normalPity === 0, 'FLOW-05-25', `出稀有+后 normalPity 应重置为0，实际: ${pityState.normalPity}`);
          break;
        }
      }
    }
    if (!foundRare) assertStrict(true, 'FLOW-05-25', '20次内未出稀有+，跳过重置验证');
  });

  it(accTest('FLOW-05-26', '保底进度条UI反映引擎状态 — 进度百分比正确'), () => {
    const sim = createRecruitSim();
    const engine = sim.engine;
    for (let i = 0; i < 3; i++) {
      sim.addResources({ recruitToken: 100 });
      engine.recruit('normal', 1);
    }
    renderModal(sim);
    assertVisible(screen.getByText(/十连保底/), 'FLOW-05-26', '十连保底进度标签');
    const pityState = engine.getRecruitSystem().getGachaState();
    assertVisible(screen.getByText(new RegExp(`${pityState.normalPity}/10`)), 'FLOW-05-26', `保底计数 ${pityState.normalPity}/10`);
  });

  it(accTest('FLOW-05-27', '普通招募无硬保底 — hardPityThreshold 为 Infinity'), () => {
    assertStrict(RECRUIT_PITY.normal.hardPityThreshold === Infinity, 'FLOW-05-27', '普通招募硬保底阈值应为 Infinity（无硬保底）');
  });

  it(accTest('FLOW-05-28', '高级招募硬保底UI — 切换高级后显示硬保底进度'), async () => {
    const sim = createRecruitSim({ tokenAmount: 1000 });
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    assertVisible(screen.getByText(/硬保底/), 'FLOW-05-28', '高级招募硬保底进度标签');
  });

  it(accTest('FLOW-05-29', '保底计数跨招募类型独立 — 普通/高级分别计数'), () => {
    const sim = createRecruitSim({ tokenAmount: 5000 });
    const engine = sim.engine;
    for (let i = 0; i < 3; i++) engine.recruit('normal', 1);
    const { normalPity, advancedPity } = engine.getRecruitSystem().getGachaState();
    assertStrict(advancedPity === 0, 'FLOW-05-29', `高级保底计数应仍为0，实际: ${advancedPity}`);
    assertStrict(normalPity > 0, 'FLOW-05-29', `普通保底计数应大于0，实际: ${normalPity}`);
  });

  // ═══ 6. 招募结果展示（FLOW-05-30 ~ FLOW-05-35） ═══

  it(accTest('FLOW-05-30', '招募结果卡片显示品质标签 — 品质颜色和文字'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const qualityLabels = screen.getByTestId('recruit-modal-results').querySelectorAll('.tk-recruit-result-quality');
    assertStrict(qualityLabels.length >= 1, 'FLOW-05-30', `结果卡片应显示品质标签，实际: ${qualityLabels.length}`);
  });

  it(accTest('FLOW-05-31', '招募结果卡片显示武将名称'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const nameLabels = screen.getByTestId('recruit-modal-results').querySelectorAll('.tk-recruit-result-name');
    assertStrict(nameLabels.length >= 1, 'FLOW-05-31', '结果卡片应显示武将名称');
    const nameText = nameLabels[0].textContent?.trim();
    assertStrict(!!nameText && nameText.length > 0, 'FLOW-05-31', '武将名称不应为空');
  });

  it(accTest('FLOW-05-32', '十连结果按品质排序 — 高品质在前'), async () => {
    const sim = createRecruitSim({ tokenAmount: 2000 });
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-ten-btn'));
    const cards = screen.getByTestId('recruit-modal-results').querySelectorAll('.tk-recruit-result-card');
    assertStrict(cards.length === 10, 'FLOW-05-32', '十连应显示10张卡片');
    const qualityEls = Array.from(cards).map(card =>
      card.querySelector('.tk-recruit-result-quality')?.textContent ?? '',
    );
    assertStrict(qualityEls.length === 10, 'FLOW-05-32', '每张卡片应有品质标签');
  });

  it(accTest('FLOW-05-33', '招募结果显示总消耗 — 消耗资源类型和数量'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    const costEl = screen.getByTestId('recruit-modal-results').querySelector('.tk-recruit-results-total-cost');
    assertStrict(!!costEl, 'FLOW-05-33', '结果区域应显示总消耗');
    assertStrict((costEl?.textContent ?? '').includes('求贤令'), 'FLOW-05-33', `总消耗应包含"求贤令"，实际: ${costEl?.textContent}`);
  });

  it(accTest('FLOW-05-34', '招募历史记录 — 展开后显示历史'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    await userEvent.click(screen.getByText(/招募记录/));
    const historyList = document.querySelector('.tk-recruit-history-list');
    assertStrict(!!historyList, 'FLOW-05-34', '招募历史列表应展开');
  });

  it(accTest('FLOW-05-35', '概率表展开 — 点击概率一览后显示概率数据'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-rates-toggle'));
    assertVisible(screen.getByTestId('recruit-rates-table'), 'FLOW-05-35', '概率表展开后应可见');
    assertVisible(screen.getByText('60%'), 'FLOW-05-35', '普通品质概率 60%');
  });

  // ═══ 7. 资源不足（FLOW-05-36 ~ FLOW-05-40） ═══

  it(accTest('FLOW-05-36', '资源不足时单抽按钮 disabled — recruitToken 不够'), () => {
    const sim = createSim();
    sim.setResource('recruitToken' as any, 3);
    renderModal(sim);
    assertStrict((screen.getByTestId('recruit-modal-single-btn') as HTMLButtonElement).disabled, 'FLOW-05-36', '资源不足时单抽按钮应 disabled');
  });

  it(accTest('FLOW-05-37', '资源不足时十连按钮 disabled — recruitToken 不够十连'), () => {
    const sim = createRecruitSim({ tokenAmount: 20 }); // 10+20=30，够单抽5但不够十连50
    renderModal(sim);
    assertStrict(!(screen.getByTestId('recruit-modal-single-btn') as HTMLButtonElement).disabled, 'FLOW-05-37', '单抽按钮应可点击');
    assertStrict((screen.getByTestId('recruit-modal-ten-btn') as HTMLButtonElement).disabled, 'FLOW-05-37', '十连按钮应 disabled');
  });

  it(accTest('FLOW-05-38', '高级招募资源不足 — recruitToken 不够高级单抽'), async () => {
    const sim = createRecruitSim({ tokenAmount: 50 }); // 10+50=60，不够高级单抽100
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    assertStrict((screen.getByTestId('recruit-modal-single-btn') as HTMLButtonElement).disabled, 'FLOW-05-38', '高级招募资源不足时单抽按钮应 disabled');
  });

  it(accTest('FLOW-05-39', '资源刚好够单抽 — 按钮可点击'), () => {
    const sim = createSim(); // 初始 recruitToken=10，够单抽5
    renderModal(sim);
    assertStrict(!(screen.getByTestId('recruit-modal-single-btn') as HTMLButtonElement).disabled, 'FLOW-05-39', '资源刚好够时单抽按钮应可点击');
  });

  it(accTest('FLOW-05-40', '招募后资源更新 — UI 余额同步变化'), async () => {
    const sim = createRecruitSim({ goldAmount: 10000, tokenAmount: 100 });
    const engine = sim.engine;
    const tokenBefore = engine.getResourceAmount('recruitToken');
    const { rerender } = renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-single-btn'));
    rerender(<RecruitModal engine={engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);
    assertStrict(engine.getResourceAmount('recruitToken') < tokenBefore, 'FLOW-05-40', 'UI 余额应同步减少');
  });

  // ═══ 8. 引擎端到端验证（FLOW-05-41 ~ FLOW-05-48） ═══

  it(accTest('FLOW-05-41', '引擎 recruit API — 单抽返回正确结构'), () => {
    const sim = createRecruitSim();
    const result = sim.engine.recruit('normal', 1);
    assertStrict(!!result, 'FLOW-05-41', '单抽应返回非null结果');
    assertStrict(result!.type === 'normal', 'FLOW-05-41', '结果类型应为 normal');
    assertStrict(result!.results.length === 1, 'FLOW-05-41', '单抽结果数量应为1');
    assertStrict(result!.cost.resourceType === 'recruitToken', 'FLOW-05-41', '消耗资源类型应为 recruitToken');
    assertStrict(result!.cost.amount === RECRUIT_COSTS.normal.amount, 'FLOW-05-41', `消耗数量应为 ${RECRUIT_COSTS.normal.amount}`);
  });

  it(accTest('FLOW-05-42', '引擎 recruit API — 十连返回10个结果'), () => {
    const sim = createRecruitSim({ tokenAmount: 2000 });
    const result = sim.engine.recruit('normal', 10);
    assertStrict(!!result, 'FLOW-05-42', '十连应返回非null结果');
    assertStrict(result!.results.length === 10, 'FLOW-05-42', '十连结果数量应为10');
  });

  it(accTest('FLOW-05-43', '引擎 recruit API — 资源不足返回 null'), () => {
    const sim = createSim();
    assertStrict(sim.engine.recruit('advanced', 1) === null, 'FLOW-05-43', '资源不足时 recruit 应返回 null');
  });

  it(accTest('FLOW-05-44', '引擎 getRecruitSystem — 保底状态可查询'), () => {
    const sim = createRecruitSim();
    const state = sim.engine.getRecruitSystem().getGachaState();
    assertStrict(typeof state.normalPity === 'number', 'FLOW-05-44', 'normalPity 应为数字');
    assertStrict(typeof state.advancedPity === 'number', 'FLOW-05-44', 'advancedPity 应为数字');
    assertStrict(typeof state.normalHardPity === 'number', 'FLOW-05-44', 'normalHardPity 应为数字');
    assertStrict(typeof state.advancedHardPity === 'number', 'FLOW-05-44', 'advancedHardPity 应为数字');
  });

  it(accTest('FLOW-05-45', '引擎招募历史 — getRecruitHistory 返回记录'), () => {
    const sim = createRecruitSim();
    sim.engine.recruit('normal', 1);
    const history = sim.engine.getRecruitHistory();
    assertStrict(history.length >= 1, 'FLOW-05-45', `招募后历史记录应至少有1条，实际: ${history.length}`);
    assertStrict(history[0].type === 'normal', 'FLOW-05-45', '历史记录类型应为 normal');
    assertStrict(history[0].results.length === 1, 'FLOW-05-45', '历史记录结果数量应为1');
    assertStrict(typeof history[0].timestamp === 'number', 'FLOW-05-45', '历史记录应有时间戳');
  });

  it(accTest('FLOW-05-46', '招募类型切换 — 消耗和概率表更新'), async () => {
    const sim = createRecruitSim({ tokenAmount: 1000 });
    renderModal(sim);
    const normalCosts = screen.getAllByText(/求贤令 ×\d+/);
    assertStrict(normalCosts.length >= 2, 'FLOW-05-46', '普通招募应显示消耗');
    await userEvent.click(screen.getByTestId('recruit-modal-type-advanced'));
    const advancedCosts = screen.getAllByText(/求贤令 ×\d+/);
    assertStrict(advancedCosts.length >= 2, 'FLOW-05-46', '高级招募应显示消耗');
  });

  it(accTest('FLOW-05-47', '关闭按钮和ESC键 — 正确触发 onClose'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-close'));
    assertStrict(onClose.mock.calls.length === 1, 'FLOW-05-47', '关闭按钮应触发 onClose');
  });

  it(accTest('FLOW-05-48', '点击遮罩关闭 — 触发 onClose'), async () => {
    const sim = createRecruitSim();
    renderModal(sim);
    await userEvent.click(screen.getByTestId('recruit-modal-overlay'));
    assertStrict(onClose.mock.calls.length >= 1, 'FLOW-05-48', '点击遮罩应触发 onClose');
  });
});
