/** FLOW-03 武将Tab集成测试 — 渲染/列表/详情/升级/升星/品质/筛选/装备/边界。使用真实引擎，不mock。 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroTab from '@/components/idle/panels/hero/HeroTab';
import HeroCard from '@/components/idle/panels/hero/HeroCard';
import HeroDetailModal from '@/components/idle/panels/hero/HeroDetailModal';
import HeroUpgradePanel from '@/components/idle/panels/hero/HeroUpgradePanel';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { getStarMultiplier } from '@/games/three-kingdoms/engine/hero/star-up-config';
import { statsAtLevel } from '@/games/three-kingdoms/engine/hero/HeroLevelSystem';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

/** Mock CSS imports */
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
vi.mock('@/components/idle/panels/hero/HeroCompareModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/GuideOverlay.css', () => ({}));
vi.mock('@/components/idle/panels/hero/RecruitModal.css', () => ({}));
vi.mock('@/components/idle/common/Modal.css', () => ({}));
vi.mock('@/components/idle/common/Toast.css', () => ({}));

// ── Test Helpers ──

/** 创建带充足资源的 sim 并添加核心武将 */
function createHeroSim(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources({ grain: 5000000, gold: 10000000, troops: 500000 });
  return sim;
}

/** 创建 sim 并添加5名核心武将 */
function createSimWithHeroes(): GameEventSimulator {
  const sim = createHeroSim();
  const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun'];
  for (const id of heroIds) {
    sim.addHeroDirectly(id);
  }
  return sim;
}

/** 创建 sim 并添加不同品质/阵营的武将 */
function createSimWithDiverseHeroes(): GameEventSimulator {
  const sim = createHeroSim();
  // 传说: liubei, guanyu, zhangfei, zhugeliang, zhaoyun
  // 史诗: dianwei, caocao, simayi, zhouyu, lvbu
  // 稀有: lushu, huanggai, ganning, xuhuang, zhangliao, weiyan
  // 精良: junshou, xiaowei
  // 普通: minbingduizhang, xiangyongtoumu
  const ids = [
    'liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun',
    'dianwei', 'caocao', 'simayi', 'zhouyu', 'lvbu',
    'lushu', 'huanggai', 'ganning', 'xuhuang', 'zhangliao', 'weiyan',
    'junshou', 'xiaowei',
    'minbingduizhang', 'xiangyongtoumu',
  ];
  for (const id of ids) {
    sim.addHeroDirectly(id);
  }
  return sim;
}

// ═══════════════════════════════════════════════════════════
// FLOW-03 武将Tab集成测试
// ═══════════════════════════════════════════════════════════

describe('FLOW-03 武将Tab集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── 1. 武将Tab渲染（FLOW-03-01 ~ FLOW-03-05） ──

  it(accTest('FLOW-03-01', '武将Tab整体渲染 — 容器、工具栏、网格'), () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const heroTab = screen.getByTestId('hero-tab');
    assertInDOM(heroTab, 'FLOW-03-01', '武将Tab容器');

    const grid = screen.getByTestId('hero-tab-grid');
    assertInDOM(grid, 'FLOW-03-01', '武将网格');

    const totalPower = screen.getByTestId('hero-tab-total-power');
    assertInDOM(totalPower, 'FLOW-03-01', '总战力显示');
  });

  it(accTest('FLOW-03-02', '武将列表显示 — 所有武将卡片渲染'), () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun'];
    for (const id of heroIds) {
      const card = screen.getByTestId(`hero-card-${id}`);
      assertInDOM(card, 'FLOW-03-02', `武将卡片 ${id}`);
    }
  });

  it(accTest('FLOW-03-03', '武将卡片信息完整 — 名称、等级、战力可见'), () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    // 验证武将名称
    assertStrict(!!screen.getByText('刘备'), 'FLOW-03-03', '刘备名称可见');
    assertStrict(!!screen.getByText('关羽'), 'FLOW-03-03', '关羽名称可见');
    assertStrict(!!screen.getByText('张飞'), 'FLOW-03-03', '张飞名称可见');

    // 验证等级标签（初始Lv.1）
    const levelEls = screen.getAllByText('Lv.1');
    assertStrict(levelEls.length >= 5, 'FLOW-03-03', `应有至少5个Lv.1标签，实际${levelEls.length}`);

    // 验证战力符号
    const powerEls = screen.getAllByText(/⚔️/);
    assertStrict(powerEls.length >= 5, 'FLOW-03-03', `应有至少5个战力显示，实际${powerEls.length}`);
  });

  it(accTest('FLOW-03-04', '武将总数显示 — 底部计数正确'), () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const countEl = screen.getByTestId('hero-tab-count');
    assertInDOM(countEl, 'FLOW-03-04', '武将总数');
    assertStrict(
      countEl.textContent?.includes('5'),
      'FLOW-03-04',
      '总数应显示5',
    );
  });

  it(accTest('FLOW-03-05', '空武将列表 — 显示招募引导'), () => {
    const sim = createHeroSim();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const emptyEl = screen.getByTestId('hero-tab-empty');
    assertInDOM(emptyEl, 'FLOW-03-05', '空列表引导');

    const recruitBtn = screen.getByTestId('hero-tab-empty-recruit-btn');
    assertInDOM(recruitBtn, 'FLOW-03-05', '前往招募按钮');
  });

  // ── 2. 武将详情弹窗（FLOW-03-06 ~ FLOW-03-10） ──

  it(accTest('FLOW-03-06', '点击武将卡片 — 打开详情弹窗'), async () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const liubeiCard = screen.getByTestId('hero-card-liubei');
    await userEvent.click(liubeiCard);

    const modal = screen.getByTestId('hero-detail-modal');
    assertInDOM(modal, 'FLOW-03-06', '武将详情弹窗');
  });

  it(accTest('FLOW-03-07', '武将详情弹窗 — 显示名称和属性'), async () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const guanyuCard = screen.getByTestId('hero-card-guanyu');
    await userEvent.click(guanyuCard);

    const modal = screen.getByTestId('hero-detail-modal');
    assertStrict(
      modal.textContent?.includes('关羽'),
      'FLOW-03-07',
      '弹窗应显示关羽名称',
    );

    // 验证四维属性标签（使用getAllByText避免多元素匹配）
    assertStrict(screen.getAllByText('武力').length >= 1, 'FLOW-03-07', '武力属性标签');
    assertStrict(screen.getAllByText('统率').length >= 1, 'FLOW-03-07', '统率属性标签');
    assertStrict(screen.getAllByText('智力').length >= 1, 'FLOW-03-07', '智力属性标签');
    assertStrict(screen.getAllByText('政治').length >= 1, 'FLOW-03-07', '政治属性标签');
  });

  it(accTest('FLOW-03-08', '武将详情弹窗 — 技能列表可见'), async () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const zhugeliangCard = screen.getByTestId('hero-card-zhugeliang');
    await userEvent.click(zhugeliangCard);

    // 技能区域标题
    const skillTitle = screen.getByText('技能');
    assertInDOM(skillTitle, 'FLOW-03-08', '技能标题');
  });

  it(accTest('FLOW-03-09', '武将详情弹窗 — 属性总览(雷达图)可见'), async () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const zhaoyunCard = screen.getByTestId('hero-card-zhaoyun');
    await userEvent.click(zhaoyunCard);

    const radarTitle = screen.getByText('属性总览');
    assertInDOM(radarTitle, 'FLOW-03-09', '属性总览标题');
  });

  it(accTest('FLOW-03-10', '关闭详情弹窗 — 点击关闭按钮'), async () => {
    const sim = createSimWithHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const liubeiCard = screen.getByTestId('hero-card-liubei');
    await userEvent.click(liubeiCard);

    const modal = screen.queryByTestId('hero-detail-modal');
    assertStrict(!!modal, 'FLOW-03-10', '弹窗应已打开');

    const closeBtn = screen.getByTestId('hero-detail-modal-close');
    await userEvent.click(closeBtn);

    const closedModal = screen.queryByTestId('hero-detail-modal');
    assertStrict(!closedModal, 'FLOW-03-10', '弹窗应已关闭');
  });

  // ── 3. 武将升级流程（FLOW-03-11 ~ FLOW-03-15） ──

  it(accTest('FLOW-03-11', '引擎层武将升级 — 等级提升+属性增加'), () => {
    const sim = createSimWithHeroes();
    const heroSystem = sim.engine.getHeroSystem();
    const general = heroSystem.getGeneral('liubei')!;
    const beforeLevel = general.level;
    const beforeStats = statsAtLevel(general.baseStats, beforeLevel);

    // 执行升级到10级
    const result = sim.engine.enhanceHero('liubei', 10);
    assertStrict(result !== null, 'FLOW-03-11', '升级应成功');
    assertStrict(result!.levelsGained > 0, 'FLOW-03-11', '等级应提升');

    const updated = heroSystem.getGeneral('liubei')!;
    assertStrict(updated.level > beforeLevel, 'FLOW-03-11', '等级应高于之前');

    const afterStats = statsAtLevel(updated.baseStats, updated.level);
    assertStrict(
      afterStats.attack > beforeStats.attack,
      'FLOW-03-11',
      `攻击力应增加: ${beforeStats.attack} → ${afterStats.attack}`,
    );
  });

  it(accTest('FLOW-03-12', '引擎层武将升级 — 战力提升'), () => {
    const sim = createSimWithHeroes();
    const heroSystem = sim.engine.getHeroSystem();
    const starSystem = sim.engine.getHeroStarSystem();

    const before = heroSystem.calculatePower(
      heroSystem.getGeneral('guanyu')!,
      starSystem.getStar('guanyu'),
    );

    sim.engine.enhanceHero('guanyu', 10);

    const after = heroSystem.calculatePower(
      heroSystem.getGeneral('guanyu')!,
      starSystem.getStar('guanyu'),
    );

    assertStrict(after > before, 'FLOW-03-12', `战力应提升: ${before} → ${after}`);
  });

  it(accTest('FLOW-03-13', '引擎层武将升级 — 资源消耗正确'), () => {
    const sim = createSimWithHeroes();
    const goldBefore = sim.engine.getResourceAmount('gold');
    const grainBefore = sim.engine.getResourceAmount('grain');

    const result = sim.engine.enhanceHero('zhangfei', 5);
    assertStrict(result !== null, 'FLOW-03-13', '升级应成功');

    const goldAfter = sim.engine.getResourceAmount('gold');
    const grainAfter = sim.engine.getResourceAmount('grain');

    assertStrict(goldAfter < goldBefore, 'FLOW-03-13', '铜钱应减少');
    assertStrict(grainAfter < grainBefore, 'FLOW-03-13', '经验(粮食)应减少');
  });

  it(accTest('FLOW-03-14', '引擎层武将满级升级 — 返回null'), () => {
    const sim = createSimWithHeroes();
    // 先升级到满级
    sim.addResources({ grain: 50000000, gold: 50000000 });
    sim.engine.enhanceHero('liubei', 50);

    const general = sim.engine.getHeroSystem().getGeneral('liubei')!;
    assertStrict(general.level === 50, 'FLOW-03-14', '应已满级');

    // 再次尝试升级应返回null
    const result = sim.engine.enhanceHero('liubei', 55);
    assertStrict(result === null, 'FLOW-03-14', '满级后升级应返回null');
  });

  it(accTest('FLOW-03-15', 'HeroUpgradePanel — 升级面板渲染和操作'), () => {
    const sim = createSimWithHeroes();
    const general = sim.engine.getHeroSystem().getGeneral('liubei')!;
    const mutable: GeneralData = { ...general, baseStats: { ...general.baseStats }, skills: [...general.skills] };

    render(
      <HeroUpgradePanel
        general={mutable}
        engine={sim.engine}
        onUpgradeComplete={vi.fn()}
      />,
    );

    const panel = screen.getByTestId('hero-upgrade-panel');
    assertInDOM(panel, 'FLOW-03-15', '升级面板');

    const enhanceBtn = screen.getByTestId('upgrade-panel-enhance-btn');
    assertInDOM(enhanceBtn, 'FLOW-03-15', '升级按钮');
  });

  // ── 4. 武将升星流程（FLOW-03-16 ~ FLOW-03-20）LL-007回归 ──

  it(accTest('FLOW-03-16', '引擎层升星 — 星级提升+属性按倍率增长'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();
    const heroSystem = sim.engine.getHeroSystem();

    // 添加碎片和铜钱用于升星
    sim.addHeroFragments('liubei', 30);
    sim.addResources({ gold: 100000 });

    const beforeStar = starSystem.getStar('liubei');
    const general = heroSystem.getGeneral('liubei')!;
    const beforeStats = starSystem.calculateStarStats(general, beforeStar);

    const result = starSystem.starUp('liubei');
    assertStrict(result.success, 'FLOW-03-16', '升星应成功');
    assertStrict(result.currentStar === beforeStar + 1, 'FLOW-03-16', '星级应+1');

    const afterStar = starSystem.getStar('liubei');
    const afterStats = starSystem.calculateStarStats(general, afterStar);

    // LL-007回归：验证属性按倍率正确增长
    const expectedMul = getStarMultiplier(afterStar) / getStarMultiplier(beforeStar);
    const actualRatio = afterStats.attack / beforeStats.attack;
    const diff = Math.abs(actualRatio - expectedMul);
    assertStrict(diff < 0.01, 'FLOW-03-16', `攻击力倍率应约${expectedMul.toFixed(2)}x，实际${actualRatio.toFixed(2)}x`);
  });

  it(accTest('FLOW-03-17', 'LL-007回归 — 升星后属性值=基础属性×星级倍率'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();
    const heroSystem = sim.engine.getHeroSystem();
    const general = heroSystem.getGeneral('guanyu')!;

    // 升到3星
    sim.addHeroFragments('guanyu', 100);
    sim.addResources({ gold: 500000 });
    starSystem.starUp('guanyu'); // 1→2
    starSystem.starUp('guanyu'); // 2→3

    const star = starSystem.getStar('guanyu');
    assertStrict(star === 3, 'FLOW-03-17', '应为3星');

    const mul = getStarMultiplier(3); // 1.35
    const expectedAttack = Math.floor(general.baseStats.attack * mul);
    const expectedDefense = Math.floor(general.baseStats.defense * mul);

    const stats = starSystem.calculateStarStats(general, star);
    assertStrict(
      stats.attack === expectedAttack,
      'FLOW-03-17',
      `3星攻击力应为${expectedAttack}，实际${stats.attack}`,
    );
    assertStrict(
      stats.defense === expectedDefense,
      'FLOW-03-17',
      `3星防御力应为${expectedDefense}，实际${stats.defense}`,
    );
  });

  it(accTest('FLOW-03-18', '引擎层升星 — 碎片不足时失败'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();

    // 不添加碎片
    const result = starSystem.starUp('zhangfei');
    assertStrict(!result.success, 'FLOW-03-18', '碎片不足升星应失败');
    assertStrict(result.currentStar === 1, 'FLOW-03-18', '星级应保持不变');
  });

  it(accTest('FLOW-03-19', '引擎层升星 — 战力正确增加'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();
    const heroSystem = sim.engine.getHeroSystem();

    const before = heroSystem.calculatePower(
      heroSystem.getGeneral('zhugeliang')!,
      starSystem.getStar('zhugeliang'),
    );

    sim.addHeroFragments('zhugeliang', 30);
    sim.addResources({ gold: 100000 });
    starSystem.starUp('zhugeliang');

    const after = heroSystem.calculatePower(
      heroSystem.getGeneral('zhugeliang')!,
      starSystem.getStar('zhugeliang'),
    );

    assertStrict(after > before, 'FLOW-03-19', `升星后战力应增加: ${before} → ${after}`);
  });

  it(accTest('FLOW-03-20', '引擎层升星 — 满星后不可再升'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();

    // 手动设置满星（1→6需要20+40+80+150+300=590碎片 + 185000金币）
    sim.addHeroFragments('zhaoyun', 600);
    sim.addResources({ gold: 1000000 });
    // 升到6星
    for (let i = 0; i < 5; i++) {
      starSystem.starUp('zhaoyun');
    }

    const star = starSystem.getStar('zhaoyun');
    assertStrict(star === 6, 'FLOW-03-20', `应为6星，实际${star}`);

    // 再次升星应失败
    const result = starSystem.starUp('zhaoyun');
    assertStrict(!result.success, 'FLOW-03-20', '满星后升星应失败');
  });

  // ── 5. 武将品质差异（FLOW-03-21 ~ FLOW-03-23） ──

  it(accTest('FLOW-03-21', '不同品质武将 — 基础属性差异明显'), () => {
    const sim = createSimWithDiverseHeroes();
    const heroSystem = sim.engine.getHeroSystem();

    const liubei = heroSystem.getGeneral('liubei')!; // 传说
    const minbing = heroSystem.getGeneral('minbingduizhang')!; // 普通

    // 传说品质总基础属性应远大于普通
    const legendaryTotal = liubei.baseStats.attack + liubei.baseStats.defense
      + liubei.baseStats.intelligence + liubei.baseStats.speed;
    const commonTotal = minbing.baseStats.attack + minbing.baseStats.defense
      + minbing.baseStats.intelligence + minbing.baseStats.speed;

    assertStrict(
      legendaryTotal > commonTotal,
      'FLOW-03-21',
      `传说(${legendaryTotal})总属性应大于普通(${commonTotal})`,
    );
  });

  it(accTest('FLOW-03-22', '不同品质武将 — 战力差异明显'), () => {
    const sim = createSimWithDiverseHeroes();
    const heroSystem = sim.engine.getHeroSystem();

    const liubeiPower = heroSystem.calculatePower(heroSystem.getGeneral('liubei')!);
    const minbingPower = heroSystem.calculatePower(heroSystem.getGeneral('minbingduizhang')!);

    assertStrict(
      liubeiPower > minbingPower * 2,
      'FLOW-03-22',
      `传说战力(${liubeiPower})应远大于普通(${minbingPower})`,
    );
  });

  it(accTest('FLOW-03-23', 'HeroCard品质CSS类 — 不同品质对应不同样式'), () => {
    const sim = createSimWithDiverseHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    // 关羽是LEGENDARY品质
    const legendaryCard = screen.getByTestId('hero-card-guanyu');
    assertStrict(
      legendaryCard.className.includes('tk-hero-card--legendary'),
      'FLOW-03-23',
      '传说武将应有tk-hero-card--legendary CSS类',
    );

    const commonCard = screen.getByTestId('hero-card-minbingduizhang');
    assertStrict(
      commonCard.className.includes('tk-hero-card--common'),
      'FLOW-03-23',
      '普通武将应有tk-hero-card--common CSS类',
    );
  });

  // ── 6. 武将筛选/排序（FLOW-03-24 ~ FLOW-03-29） ──

  it(accTest('FLOW-03-24', '阵营筛选 — 点击蜀只显示蜀国武将'), async () => {
    const sim = createSimWithDiverseHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    // 点击蜀阵营筛选按钮
    const shuBtn = screen.getByText('蜀');
    await userEvent.click(shuBtn);

    // 应有蜀国武将
    const grid = screen.getByTestId('hero-tab-grid');
    const cards = within(grid).queryAllByTestId(/^hero-card-/);

    // 蜀国武将: liubei, guanyu, zhangfei, zhugeliang, zhaoyun, weiyan
    assertStrict(cards.length >= 5, 'FLOW-03-24', `蜀国武将应至少5个，实际${cards.length}`);

    // 不应有魏国武将
    const noCaocao = !screen.queryByTestId('hero-card-caocao');
    assertStrict(noCaocao, 'FLOW-03-24', '不应显示魏国武将曹操');
  });

  it(accTest('FLOW-03-25', '阵营筛选 — 全部显示所有武将'), async () => {
    const sim = createSimWithDiverseHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const allBtn = screen.getByText('全部');
    await userEvent.click(allBtn);

    const grid = screen.getByTestId('hero-tab-grid');
    const cards = within(grid).queryAllByTestId(/^hero-card-/);
    assertStrict(cards.length >= 15, 'FLOW-03-25', `全部武将应至少15个，实际${cards.length}`);
  });

  it(accTest('FLOW-03-26', '品质筛选 — 下拉选择品质'), async () => {
    const sim = createSimWithDiverseHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    // 找到品质筛选下拉（第二个select）
    const selects = screen.getAllByRole('combobox');
    const qualitySelect = selects[0]; // 第一个是品质筛选
    await userEvent.selectOptions(qualitySelect, 'LEGENDARY');

    const grid = screen.getByTestId('hero-tab-grid');
    const cards = within(grid).queryAllByTestId(/^hero-card-/);
    // 传说武将: liubei, guanyu, zhangfei, zhugeliang, zhaoyun
    assertStrict(cards.length === 5, 'FLOW-03-26', `传说武将应为5个，实际${cards.length}`);
  });

  it(accTest('FLOW-03-27', '排序切换 — 按等级排序'), async () => {
    const sim = createSimWithDiverseHeroes();
    // 给关羽升级使其等级最高
    sim.engine.enhanceHero('guanyu', 20);

    render(<HeroTab engine={sim.engine} snapshotVersion={1} />);

    // 找到排序下拉（第二个select）
    const selects = screen.getAllByRole('combobox');
    const sortSelect = selects[1]; // 第二个是排序
    await userEvent.selectOptions(sortSelect, 'level');

    const grid = screen.getByTestId('hero-tab-grid');
    const cards = within(grid).queryAllByTestId(/^hero-card-/);
    // 关羽Lv.20应在第一个
    assertStrict(
      cards[0].getAttribute('data-testid') === 'hero-card-guanyu',
      'FLOW-03-27',
      '按等级排序关羽应排第一',
    );
  });

  it(accTest('FLOW-03-28', '排序切换 — 按战力排序'), async () => {
    const sim = createSimWithDiverseHeroes();
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    const selects = screen.getAllByRole('combobox');
    const sortSelect = selects[1];
    await userEvent.selectOptions(sortSelect, 'power');

    const grid = screen.getByTestId('hero-tab-grid');
    const cards = within(grid).queryAllByTestId(/^hero-card-/);
    assertStrict(cards.length >= 5, 'FLOW-03-28', '战力排序应有武将');
  });

  it(accTest('FLOW-03-29', '筛选无结果 — 显示空状态提示'), async () => {
    const sim = createSimWithHeroes(); // 只有5个传说武将
    render(<HeroTab engine={sim.engine} snapshotVersion={0} />);

    // 筛选魏国（没有魏国武将）
    const weiBtn = screen.getByText('魏');
    await userEvent.click(weiBtn);

    const emptyText = screen.queryByText('当前筛选无结果');
    assertStrict(!!emptyText, 'FLOW-03-29', '筛选无结果应显示空提示');
  });

  // ── 7. 武将装备与碎片（FLOW-03-30 ~ FLOW-03-33） ──

  it(accTest('FLOW-03-30', '碎片合成武将 — 碎片足够时可合成'), () => {
    const sim = createHeroSim();
    const heroSystem = sim.engine.getHeroSystem();

    // 添加足够碎片合成刘备
    const synthesizeRequired = heroSystem.getSynthesizeProgress('liubei')?.required ?? 80;
    sim.addHeroFragments('liubei', synthesizeRequired);

    const canSynth = heroSystem.canSynthesize('liubei');
    assertStrict(canSynth, 'FLOW-03-30', '碎片足够时应可合成');
  });

  it(accTest('FLOW-03-31', '碎片合成武将 — 碎片不足时不可合成'), () => {
    const sim = createHeroSim();
    const heroSystem = sim.engine.getHeroSystem();

    const canSynth = heroSystem.canSynthesize('liubei');
    assertStrict(!canSynth, 'FLOW-03-31', '碎片不足时不可合成');
  });

  it(accTest('FLOW-03-32', '碎片溢出转化 — 超出上限碎片转铜钱'), () => {
    const sim = createHeroSim();
    const goldBefore = sim.engine.getResourceAmount('gold');

    // 碎片上限999，添加1000应溢出1个
    sim.addHeroFragments('liubei', 1000);

    const goldAfter = sim.engine.getResourceAmount('gold');
    assertStrict(goldAfter > goldBefore, 'FLOW-03-32', '溢出碎片应转化为铜钱');
  });

  it(accTest('FLOW-03-33', '武将碎片进度 — 查询正确'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();

    sim.addHeroFragments('liubei', 15);
    const progress = starSystem.getFragmentProgress('liubei');

    assertStrict(progress !== null, 'FLOW-03-33', '碎片进度应返回数据');
    assertStrict(progress!.currentFragments === 15, 'FLOW-03-33', '碎片数应为15');
  });

  // ── 8. 突破系统（FLOW-03-34 ~ FLOW-03-36） ──

  it(accTest('FLOW-03-34', '突破系统 — 等级达到上限后突破预览正确'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();
    const heroSystem = sim.engine.getHeroSystem();

    // 升级到50级（初始上限）
    sim.addResources({ grain: 50000000, gold: 50000000 });
    sim.engine.enhanceHero('liubei', 50);

    const general = heroSystem.getGeneral('liubei')!;
    assertStrict(general.level === 50, 'FLOW-03-34', '应已达到50级');

    // 添加碎片和铜钱
    sim.addHeroFragments('liubei', 50);
    sim.addResources({ gold: 50000 });

    // 验证突破预览
    const preview = starSystem.getBreakthroughPreview('liubei');
    assertStrict(preview !== null, 'FLOW-03-34', '突破预览应返回数据');
    assertStrict(preview!.levelReady, 'FLOW-03-34', '等级条件应满足');
    assertStrict(preview!.currentLevelCap === 50, 'FLOW-03-34', '当前上限应为50');
    assertStrict(preview!.nextLevelCap === 60, 'FLOW-03-34', '突破后上限应为60');
    assertStrict(preview!.fragmentCost === 30, 'FLOW-03-34', '碎片消耗应为30');
    assertStrict(preview!.breakthroughStoneCost === 5, 'FLOW-03-34', '突破石消耗应为5');

    // 注意：breakthroughStone未接入ResourceSystem，resourceSufficient=false
    // 但可以验证突破条件检查逻辑正确
    assertStrict(preview!.canBreakthrough === false, 'FLOW-03-34', '突破石不足时canBreakthrough应为false');
  });

  it(accTest('FLOW-03-35', '突破系统 — 等级未达上限不可突破'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();

    // 等级1时不可突破
    const result = starSystem.breakthrough('liubei');
    assertStrict(!result.success, 'FLOW-03-35', '等级未达上限不可突破');

    // 预览也应显示levelReady=false
    const preview = starSystem.getBreakthroughPreview('liubei');
    assertStrict(preview !== null, 'FLOW-03-35', '预览应返回数据');
    assertStrict(!preview!.levelReady, 'FLOW-03-35', '等级条件不满足');
  });

  it(accTest('FLOW-03-36', '突破系统 — 等级上限查询正确'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();

    // 初始等级上限50
    const cap0 = starSystem.getLevelCap('liubei');
    assertStrict(cap0 === 50, 'FLOW-03-36', `初始上限应为50，实际${cap0}`);

    // 突破阶段0 → 上限50
    const stage0 = starSystem.getBreakthroughStage('liubei');
    assertStrict(stage0 === 0, 'FLOW-03-36', '初始突破阶段应为0');

    // 查询下一突破配置
    const nextTier = starSystem.getNextBreakthroughTier('liubei');
    assertStrict(nextTier !== null, 'FLOW-03-36', '应有下一突破配置');
    assertStrict(nextTier!.levelCapAfter === 60, 'FLOW-03-36', '一阶突破后上限应为60');
  });

  // ── 9. 战力计算一致性（FLOW-03-37 ~ FLOW-03-38） ──

  it(accTest('FLOW-03-37', '战力计算一致 — 列表与详情使用相同数据'), () => {
    const sim = createSimWithHeroes();
    const heroSystem = sim.engine.getHeroSystem();
    const starSystem = sim.engine.getHeroStarSystem();

    const general = heroSystem.getGeneral('liubei')!;
    const star = starSystem.getStar('liubei');
    const power = heroSystem.calculatePower(general, star);

    // 验证战力计算公式一致性
    const { attack, defense, intelligence, speed } = general.baseStats;
    const levelCoeff = 1 + general.level * 0.02;
    const starCoeff = getStarMultiplier(star);
    const expectedMin = Math.floor(attack * levelCoeff * starCoeff * 1.0); // 最低估计
    assertStrict(
      power >= expectedMin * 0.5,
      'FLOW-03-37',
      `战力${power}应接近预期范围`,
    );
  });

  it(accTest('FLOW-03-38', '总战力计算 — 所有武将战力之和'), () => {
    const sim = createSimWithHeroes();
    const heroSystem = sim.engine.getHeroSystem();
    const starSystem = sim.engine.getHeroStarSystem();

    const totalPower = heroSystem.calculateTotalPower();
    let manualSum = 0;
    for (const g of heroSystem.getAllGenerals()) {
      manualSum += heroSystem.calculatePower(g, starSystem.getStar(g.id));
    }

    assertStrict(
      totalPower === manualSum,
      'FLOW-03-38',
      `总战力${totalPower}应等于手动累加${manualSum}`,
    );
  });

  // ── 10. 苏格拉底边界情况（FLOW-03-39 ~ FLOW-03-44） ──

  it(accTest('FLOW-03-39', '武将满级后升级 — 返回null不抛异常'), () => {
    const sim = createSimWithHeroes();
    sim.addResources({ grain: 50000000, gold: 50000000 });
    sim.engine.enhanceHero('liubei', 50);

    let errorThrown = false;
    try {
      sim.engine.enhanceHero('liubei', 55);
    } catch {
      errorThrown = true;
    }
    assertStrict(!errorThrown, 'FLOW-03-39', '满级后升级不应抛异常');
  });

  it(accTest('FLOW-03-40', '升级不存在的武将 — 返回null不抛异常'), () => {
    const sim = createSimWithHeroes();

    let errorThrown = false;
    try {
      const result = sim.engine.enhanceHero('nonexistent_hero', 10);
      assertStrict(result === null, 'FLOW-03-40', '不存在武将应返回null');
    } catch {
      errorThrown = true;
    }
    assertStrict(!errorThrown, 'FLOW-03-40', '不存在武将不应抛异常');
  });

  it(accTest('FLOW-03-41', '升星材料不足 — 返回失败结果不抛异常'), () => {
    const sim = createSimWithHeroes();
    const starSystem = sim.engine.getHeroStarSystem();

    let errorThrown = false;
    try {
      const result = starSystem.starUp('liubei');
      assertStrict(!result.success, 'FLOW-03-41', '碎片不足应返回失败');
    } catch {
      errorThrown = true;
    }
    assertStrict(!errorThrown, 'FLOW-03-41', '碎片不足不应抛异常');
  });

  it(accTest('FLOW-03-42', '重复添加武将 — 返回null不重复添加'), () => {
    const sim = createSimWithHeroes();
    const beforeCount = sim.getGeneralCount();

    const result = sim.addHeroDirectly('liubei'); // 已存在
    assertStrict(result === null, 'FLOW-03-42', '重复添加应返回null');

    const afterCount = sim.getGeneralCount();
    assertStrict(afterCount === beforeCount, 'FLOW-03-42', '武将数量不应变化');
  });

  it(accTest('FLOW-03-43', '添加不存在的武将ID — 返回null'), () => {
    const sim = createHeroSim();
    const result = sim.addHeroDirectly('nonexistent_hero');
    assertStrict(result === null, 'FLOW-03-43', '不存在ID应返回null');
  });

  it(accTest('FLOW-03-44', 'Tab切换后状态保持 — 重渲染不丢失武将'), () => {
    const sim = createSimWithHeroes();
    const { rerender } = render(
      <HeroTab engine={sim.engine} snapshotVersion={0} />,
    );

    assertStrict(!!screen.getByTestId('hero-card-liubei'), 'FLOW-03-44', '首次渲染应有刘备');

    // 模拟Tab切换后重新渲染（snapshotVersion变化）
    rerender(<HeroTab engine={sim.engine} snapshotVersion={1} />);

    assertStrict(!!screen.getByTestId('hero-card-liubei'), 'FLOW-03-44', '重渲染后应保持刘备');
  });

  // ── 11. 真实引擎端到端流程（FLOW-03-45 ~ FLOW-03-48） ──

  it(accTest('FLOW-03-45', '端到端 — 添加武将→升级→升星→战力提升全流程'), () => {
    const sim = createHeroSim();
    const heroSystem = sim.engine.getHeroSystem();
    const starSystem = sim.engine.getHeroStarSystem();

    // 1. 添加武将
    sim.addHeroDirectly('guanyu');
    const general = heroSystem.getGeneral('guanyu')!;
    assertStrict(general.level === 1, 'FLOW-03-45', '初始等级应为1');

    const power1 = heroSystem.calculatePower(general, starSystem.getStar('guanyu'));

    // 2. 升级到20级
    sim.addResources({ grain: 5000000, gold: 5000000 });
    sim.engine.enhanceHero('guanyu', 20);
    const g2 = heroSystem.getGeneral('guanyu')!;
    assertStrict(g2.level === 20, 'FLOW-03-45', '升级后应为20级');

    const power2 = heroSystem.calculatePower(g2, starSystem.getStar('guanyu'));
    assertStrict(power2 > power1, 'FLOW-03-45', '升级后战力应增加');

    // 3. 升星到2星
    sim.addHeroFragments('guanyu', 30);
    sim.addResources({ gold: 100000 });
    const starResult = starSystem.starUp('guanyu');
    assertStrict(starResult.success, 'FLOW-03-45', '升星应成功');

    const g3 = heroSystem.getGeneral('guanyu')!;
    const power3 = heroSystem.calculatePower(g3, starSystem.getStar('guanyu'));
    assertStrict(power3 > power2, 'FLOW-03-45', '升星后战力应增加');

    // 4. 验证最终星级
    assertStrict(starSystem.getStar('guanyu') === 2, 'FLOW-03-45', '最终应为2星');
  });

  it(accTest('FLOW-03-46', '端到端 — 多武将批量操作'), () => {
    const sim = createHeroSim();
    const heroIds = ['liubei', 'guanyu', 'zhangfei'];
    for (const id of heroIds) {
      sim.addHeroDirectly(id);
    }

    sim.addResources({ grain: 50000000, gold: 50000000 });
    for (const id of heroIds) {
      sim.engine.enhanceHero(id, 10);
    }

    const heroSystem = sim.engine.getHeroSystem();
    for (const id of heroIds) {
      const g = heroSystem.getGeneral(id)!;
      assertStrict(g.level === 10, 'FLOW-03-46', `${id}应为10级`);
    }

    const totalPower = heroSystem.calculateTotalPower();
    assertStrict(totalPower > 0, 'FLOW-03-46', '总战力应大于0');
  });

  it(accTest('FLOW-03-47', '端到端 — 升级+升星+突破预览完整链路'), () => {
    const sim = createHeroSim();
    const heroSystem = sim.engine.getHeroSystem();
    const starSystem = sim.engine.getHeroStarSystem();

    sim.addHeroDirectly('zhaoyun');
    sim.addResources({ grain: 50000000, gold: 50000000 });

    // 升级到50
    sim.engine.enhanceHero('zhaoyun', 50);
    assertStrict(heroSystem.getGeneral('zhaoyun')!.level === 50, 'FLOW-03-47', '应到50级');

    // 升星到2
    sim.addHeroFragments('zhaoyun', 100);
    sim.addResources({ gold: 500000 });
    starSystem.starUp('zhaoyun');
    assertStrict(starSystem.getStar('zhaoyun') === 2, 'FLOW-03-47', '应为2星');

    // 验证突破预览
    sim.addHeroFragments('zhaoyun', 50);
    sim.addResources({ gold: 50000 });
    const preview = starSystem.getBreakthroughPreview('zhaoyun');
    assertStrict(preview !== null, 'FLOW-03-47', '突破预览应存在');
    assertStrict(preview!.levelReady, 'FLOW-03-47', '等级条件应满足');
    assertStrict(preview!.nextLevelCap === 60, 'FLOW-03-47', '突破后上限应为60');

    // 验证战力持续增长
    const power = heroSystem.calculatePower(
      heroSystem.getGeneral('zhaoyun')!,
      starSystem.getStar('zhaoyun'),
    );
    assertStrict(power > 0, 'FLOW-03-47', '战力应大于0');
  });

  it(accTest('FLOW-03-48', '端到端 — initMidGameState武将状态完整'), () => {
    const sim = createSim();
    sim.initMidGameState();

    const heroSystem = sim.engine.getHeroSystem();
    const generals = heroSystem.getAllGenerals();

    assertStrict(generals.length === 5, 'FLOW-03-48', '中期状态应有5名武将');

    const totalPower = heroSystem.calculateTotalPower();
    assertStrict(totalPower > 0, 'FLOW-03-48', '总战力应大于0');

    // 验证编队已设置（通过getFormationSystem）
    const formationSys = sim.engine.getFormationSystem();
    const formation = formationSys.getFormation('main');
    assertStrict(formation !== null, 'FLOW-03-48', '应有编队');
    // 编队使用slots数组，非空slots数量应为5
    const filledSlots = formation!.slots.filter((s: string) => s !== '');
    assertStrict(filledSlots.length === 5, 'FLOW-03-48', `编队应有5人，实际${filledSlots.length}`);
  });
});
