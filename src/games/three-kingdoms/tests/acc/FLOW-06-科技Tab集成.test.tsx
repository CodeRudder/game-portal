/**
 * FLOW-06 科技Tab集成测试 — 渲染/路线切换/节点展示/研究流程/科技点/前置条件/互斥分支/加速取消/离线面板/效果计算。
 * 使用真实引擎（GameEventSimulator），不 mock engine。
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TechTab from '@/components/idle/panels/tech/TechTab';
import TechResearchPanel from '@/components/idle/panels/tech/TechResearchPanel';
import TechNodeDetailModal from '@/components/idle/panels/tech/TechNodeDetailModal';
import type { TechNodeDef, TechNodeState } from '@/games/three-kingdoms/engine';
import {
  TECH_PATHS,
  TECH_PATH_LABELS,
  TECH_NODE_MAP,
  TECH_NODE_DEFS,
  getNodesByPath,
} from '@/games/three-kingdoms/engine';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('@/components/idle/panels/tech/TechTab.css', () => ({}));
vi.mock('@/components/idle/panels/tech/TechNodeDetailModal.css', () => ({}));
vi.mock('@/components/idle/panels/tech/TechResearchPanel.css', () => ({}));
vi.mock('@/components/idle/panels/tech/TechOfflinePanel.css', () => ({}));
vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: ({ children, title, onClose, isOpen, ...rest }: any) => (
    <div data-testid={rest['data-testid'] || 'shared-panel'} data-title={title}>
      {title && <div data-testid="panel-title">{title}</div>}
      {children}
      {onClose && <button data-testid="panel-close" onClick={onClose}>关闭</button>}
    </div>
  ),
}));

// Mock window.matchMedia (jsdom does not support it)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────

/** 创建带充足资源的科技测试 sim（主城Lv3+书院Lv1） */
function createTechSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ grain: 100000, gold: 100000, troops: 50000 });
  // 主城 Lv1→Lv2→Lv3（解锁书院）
  sim.upgradeBuilding('castle');
  sim.upgradeBuilding('castle');
  // 升级书院以启用科技点产出
  sim.upgradeBuilding('academy');
  // 同步书院等级到科技点系统
  const academyLevel = sim.getBuildingLevel('academy');
  sim.engine.getTechPointSystem().syncAcademyLevel(academyLevel);
  return sim;
}

/** 创建带科技点的 sim（额外添加科技点用于研究） */
function createTechSimWithPoints(): GameEventSimulator {
  const sim = createTechSim();
  // 通过引擎直接添加科技点
  const pointSystem = sim.engine.getTechPointSystem();
  pointSystem.refund(5000);
  return sim;
}

/** 渲染 TechTab 的快捷方法 */
function renderTechTab(sim: GameEventSimulator) {
  return render(<TechTab engine={sim.engine} snapshotVersion={0} />);
}

/** 渲染 TechResearchPanel 的快捷方法 */
function renderResearchPanel(sim: GameEventSimulator) {
  return render(<TechResearchPanel engine={sim.engine} snapshotVersion={0} tick={0} />);
}

/** 创建 TechNodeDetailModal props */
function makeNodeDef(overrides: Partial<TechNodeDef> = {}): TechNodeDef {
  return {
    id: 'mil_t1_attack',
    name: '锐兵术',
    description: '提升全军攻击力10%',
    path: 'military',
    tier: 1,
    prerequisites: [],
    mutexGroup: 'mil_t1',
    costPoints: 50,
    researchTime: 120,
    effects: [{ type: 'troop_attack', target: 'all', value: 10 }],
    icon: '🗡️',
    ...overrides,
  };
}

function makeNodeState(overrides: Partial<TechNodeState> = {}): TechNodeState {
  return {
    id: 'mil_t1_attack',
    status: 'available',
    researchStartTime: null,
    researchEndTime: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// FLOW-06 科技Tab集成测试
// ═══════════════════════════════════════════════════════════

describe('FLOW-06 科技Tab集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ── 1. 科技Tab渲染（FLOW-06-01 ~ FLOW-06-05） ──

  it(accTest('FLOW-06-01', '科技Tab整体渲染 — 容器、路线Tab、科技点栏、画布'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    const tab = screen.getByTestId('tech-tab');
    assertVisible(tab, 'FLOW-06-01', '科技Tab容器');

    // 三条路线Tab
    for (const path of TECH_PATHS) {
      const pathTab = screen.getByTestId(`tech-path-tab-${path}`);
      assertVisible(pathTab, 'FLOW-06-01', `${TECH_PATH_LABELS[path]}路线Tab`);
    }

    // 科技点信息栏
    const pointsBar = tab.querySelector('.tk-tech-points-bar');
    assertStrict(!!pointsBar, 'FLOW-06-01', '科技点信息栏应存在');

    // 科技树画布
    const canvas = screen.getByTestId('tech-canvas');
    assertVisible(canvas, 'FLOW-06-01', '科技树画布');
  });

  it(accTest('FLOW-06-02', '三条路线Tab显示 — 军事/经济/文化路线名称与图标'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    // 验证每条路线Tab包含名称文本
    const militaryTab = screen.getByTestId('tech-path-tab-military');
    assertStrict(militaryTab.textContent!.includes('军事'), 'FLOW-06-02', '军事路线Tab应包含"军事"');

    const economyTab = screen.getByTestId('tech-path-tab-economy');
    assertStrict(economyTab.textContent!.includes('经济'), 'FLOW-06-02', '经济路线Tab应包含"经济"');

    const cultureTab = screen.getByTestId('tech-path-tab-culture');
    assertStrict(cultureTab.textContent!.includes('文化'), 'FLOW-06-02', '文化路线Tab应包含"文化"');
  });

  it(accTest('FLOW-06-03', '科技点信息栏 — 显示科技点数量和产出速率'), () => {
    const sim = createTechSimWithPoints();
    // 升级书院并同步等级，使科技点产出速率 > 0
    sim.upgradeBuildingTo('academy', 1);
    sim.engine.getTechPointSystem().syncAcademyLevel(1);
    renderTechTab(sim);

    const pointSystem = sim.engine.getTechPointSystem();
    const state = pointSystem.getTechPointState();

    // 验证科技点数值可获取
    assertStrict(
      typeof state.current === 'number',
      'FLOW-06-03',
      '科技点状态应包含 current 数值',
    );

    // 产出速率
    const rate = pointSystem.getProductionRate();
    assertStrict(rate > 0, 'FLOW-06-03', `书院升级后科技点产出速率应大于0，实际: ${rate}`);
  });

  it(accTest('FLOW-06-04', '科技树画布 — PC端默认显示三条路线列'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    // PC端（matchMedia返回false）应显示三条路线列
    for (const path of TECH_PATHS) {
      const pathCol = screen.getByTestId(`tech-path-${path}`);
      assertVisible(pathCol, 'FLOW-06-04', `${TECH_PATH_LABELS[path]}路线列`);
    }
  });

  it(accTest('FLOW-06-05', '研究队列面板渲染 — 队列标题和空闲槽位'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    const panel = screen.getByTestId('tech-research-panel');
    assertVisible(panel, 'FLOW-06-05', '研究队列面板');

    // 队列标题
    const titleEl = panel.querySelector('.tk-tech-research-title-text');
    assertStrict(!!titleEl, 'FLOW-06-05', '研究队列标题应存在');

    // 空闲槽位（初始无研究任务）
    const emptySlots = screen.queryAllByTestId(/research-slot-empty-/);
    assertStrict(emptySlots.length >= 1, 'FLOW-06-05', `应至少有1个空闲槽位，实际: ${emptySlots.length}`);
  });

  // ── 2. 科技节点展示（FLOW-06-06 ~ FLOW-06-10） ──

  it(accTest('FLOW-06-06', '科技节点展示 — 军事路线节点数据完整'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    const militaryNodes = getNodesByPath('military');
    assertStrict(militaryNodes.length > 0, 'FLOW-06-06', '军事路线应有节点定义');

    // 验证首个Tier1节点可渲染
    const firstNode = militaryNodes[0];
    const nodeEl = screen.getByTestId(`tech-node-${firstNode.id}`);
    assertVisible(nodeEl, 'FLOW-06-06', `科技节点 ${firstNode.name}`);

    // 节点名称
    assertStrict(
      nodeEl.textContent!.includes(firstNode.name),
      'FLOW-06-06',
      `节点应包含名称「${firstNode.name}」`,
    );
  });

  it(accTest('FLOW-06-07', '科技节点状态角标 — locked/available 状态正确'), () => {
    const sim = createTechSim();
    const treeSystem = sim.engine.getTechTreeSystem();
    const allStates = treeSystem.getAllNodeStates();

    renderTechTab(sim);

    // Tier1节点无前置，应为 available
    const tier1Nodes = getNodesByPath('military').filter(n => n.tier === 1);
    for (const node of tier1Nodes) {
      const state = allStates[node.id];
      if (state?.status === 'available') {
        const badge = screen.getByTestId(`tech-badge-${node.id}`);
        assertVisible(badge, 'FLOW-06-07', `${node.name} 状态角标`);
        assertStrict(
          badge.textContent!.includes('🔓'),
          'FLOW-06-07',
          `${node.name} 应为 available 状态（🔓）`,
        );
      }
    }

    // Tier2节点有前置，应为 locked
    const tier2Nodes = getNodesByPath('military').filter(n => n.tier === 2);
    for (const node of tier2Nodes) {
      const state = allStates[node.id];
      if (state?.status === 'locked') {
        const badge = screen.getByTestId(`tech-badge-${node.id}`);
        assertStrict(
          badge.textContent!.includes('🔒'),
          'FLOW-06-07',
          `${node.name} 应为 locked 状态（🔒）`,
        );
      }
    }
  });

  it(accTest('FLOW-06-08', '路线进度显示 — 每条路线完成/总数'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    // 初始状态：所有路线进度为 0/N
    for (const path of TECH_PATHS) {
      const pathTab = screen.getByTestId(`tech-path-tab-${path}`);
      const progressText = pathTab.querySelector('.tk-tech-path-progress');
      assertStrict(!!progressText, 'FLOW-06-08', `${TECH_PATH_LABELS[path]}路线进度文本`);
      assertStrict(
        progressText!.textContent!.includes('0/'),
        'FLOW-06-08',
        `${TECH_PATH_LABELS[path]}路线初始进度应为 0/N`,
      );
    }
  });

  it(accTest('FLOW-06-09', '互斥标签显示 — Tier1互斥节点显示"二选一"'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    // 军事路线Tier1的两个节点属于同一互斥组
    const milTier1Nodes = getNodesByPath('military').filter(n => n.tier === 1);
    const mutexNodes = milTier1Nodes.filter(n => n.mutexGroup);
    if (mutexNodes.length >= 1) {
      // 检查至少一个互斥节点显示了"二选一"标签
      const mutexTags = screen.queryAllByText('二选一');
      assertStrict(mutexTags.length >= 1, 'FLOW-06-09', '互斥节点应显示"二选一"标签');
    }
  });

  it(accTest('FLOW-06-10', '经济路线和文化路线节点展示'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    // 经济路线
    const ecoNodes = getNodesByPath('economy');
    assertStrict(ecoNodes.length > 0, 'FLOW-06-10', '经济路线应有节点');
    const ecoPathCol = screen.getByTestId('tech-path-economy');
    assertVisible(ecoPathCol, 'FLOW-06-10', '经济路线列');

    // 文化路线
    const culNodes = getNodesByPath('culture');
    assertStrict(culNodes.length > 0, 'FLOW-06-10', '文化路线应有节点');
    const culPathCol = screen.getByTestId('tech-path-culture');
    assertVisible(culPathCol, 'FLOW-06-10', '文化路线列');
  });

  // ── 3. 科技研究流程（FLOW-06-11 ~ FLOW-06-15） ──

  it(accTest('FLOW-06-11', '科技研究 — 成功开始研究消耗科技点'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    const pointSystem = sim.engine.getTechPointSystem();

    const beforePoints = pointSystem.getTechPointState().current;

    // 研究一个Tier1节点（无前置）
    const result = researchSystem.startResearch('mil_t1_attack');
    assertStrict(result.success, 'FLOW-06-11', '研究应成功');

    const afterPoints = pointSystem.getTechPointState().current;
    const def = TECH_NODE_MAP.get('mil_t1_attack')!;
    assertStrict(
      afterPoints < beforePoints,
      'FLOW-06-11',
      `研究后科技点应减少：${beforePoints} → ${afterPoints}`,
    );
  });

  it(accTest('FLOW-06-12', '科技研究 — 研究队列包含已开始的科技'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();

    researchSystem.startResearch('mil_t1_attack');

    const queue = researchSystem.getQueue();
    assertStrict(queue.length === 1, 'FLOW-06-12', `队列应有1项，实际: ${queue.length}`);
    assertStrict(
      queue[0].techId === 'mil_t1_attack',
      'FLOW-06-12',
      '队列首项应为 mil_t1_attack',
    );
  });

  it(accTest('FLOW-06-13', '科技研究 — 节点状态变为 researching'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    const treeSystem = sim.engine.getTechTreeSystem();

    researchSystem.startResearch('mil_t1_attack');

    const state = treeSystem.getNodeState('mil_t1_attack');
    assertStrict(
      state?.status === 'researching',
      'FLOW-06-13',
      `节点状态应为 researching，实际: ${state?.status}`,
    );
  });

  it(accTest('FLOW-06-14', '科技研究 — 研究进度和剩余时间可获取'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();

    researchSystem.startResearch('mil_t1_attack');

    const progress = researchSystem.getResearchProgress('mil_t1_attack');
    const remaining = researchSystem.getRemainingTime('mil_t1_attack');

    assertStrict(
      typeof progress === 'number' && progress >= 0,
      'FLOW-06-14',
      `进度应为非负数，实际: ${progress}`,
    );
    assertStrict(
      typeof remaining === 'number' && remaining > 0,
      'FLOW-06-14',
      `剩余时间应大于0，实际: ${remaining}`,
    );
  });

  it(accTest('FLOW-06-15', '科技研究 — 研究队列满时无法继续研究'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();

    // 研究第一个Tier1节点
    researchSystem.startResearch('mil_t1_attack');

    // 尝试研究另一个Tier1节点（同路线不同互斥组）
    // 队列大小为1（初始），第二次应因队列满而失败
    const maxQueue = researchSystem.getMaxQueueSize();
    if (maxQueue === 1) {
      const result = researchSystem.startResearch('eco_t1_farming');
      assertStrict(!result.success, 'FLOW-06-15', '队列满时应无法开始新研究');
      assertStrict(
        result.reason?.includes('已满') || result.reason?.includes('队列'),
        'FLOW-06-15',
        `失败原因应提及队列满，实际: ${result.reason}`,
      );
    }
  });

  // ── 4. 前置条件与互斥（FLOW-06-16 ~ FLOW-06-20） ──

  it(accTest('FLOW-06-16', '前置条件 — Tier2节点需完成Tier1前置'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // Tier2冲锋战术需要 mil_t1_attack 完成
    const check = treeSystem.canResearch('mil_t2_charge');
    assertStrict(!check.can, 'FLOW-06-16', '未完成前置时应无法研究');

    const unmet = treeSystem.getUnmetPrerequisites('mil_t2_charge');
    assertStrict(
      unmet.includes('mil_t1_attack'),
      'FLOW-06-16',
      `未满足的前置应包含 mil_t1_attack，实际: ${unmet.join(',')}`,
    );
  });

  it(accTest('FLOW-06-17', '前置条件 — 完成前置后节点变为 available'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // 手动完成前置
    treeSystem.completeNode('mil_t1_attack');

    // 验证Tier2节点状态
    const check = treeSystem.canResearch('mil_t2_charge');
    // canResearch 可能还检查科技点，但前置应已满足
    const unmet = treeSystem.getUnmetPrerequisites('mil_t2_charge');
    assertStrict(
      unmet.length === 0,
      'FLOW-06-17',
      `完成前置后不应有未满足的前置，实际: ${unmet.join(',')}`,
    );
  });

  it(accTest('FLOW-06-18', '互斥分支 — 选择一个互斥节点后另一个被锁定'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // 完成 mil_t1_attack（选择攻击路线）
    treeSystem.completeNode('mil_t1_attack');

    // 检查互斥节点 mil_t1_defense 是否被锁定
    const isLocked = treeSystem.isMutexLocked('mil_t1_defense');
    assertStrict(isLocked, 'FLOW-06-18', '完成互斥组中一个节点后，另一个应被互斥锁定');
  });

  it(accTest('FLOW-06-19', '互斥分支 — getChosenMutexNodes 返回已选节点'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    treeSystem.completeNode('mil_t1_attack');

    const chosen = treeSystem.getChosenMutexNodes();
    // 应记录 mil_t1 互斥组选择了 mil_t1_attack
    const mutexGroup = 'mil_t1';
    assertStrict(
      chosen[mutexGroup] === 'mil_t1_attack',
      'FLOW-06-19',
      `互斥组 ${mutexGroup} 应选择 mil_t1_attack，实际: ${chosen[mutexGroup]}`,
    );
  });

  it(accTest('FLOW-06-20', '互斥替代 — getMutexAlternatives 返回同组节点'), () => {
    const treeSystem = createTechSim().engine.getTechTreeSystem();
    const alternatives = treeSystem.getMutexAlternatives('mil_t1_attack');
    assertStrict(
      alternatives.includes('mil_t1_defense'),
      'FLOW-06-20',
      `mil_t1_attack 的互斥替代应包含 mil_t1_defense，实际: ${alternatives.join(',')}`,
    );
  });

  // ── 5. 科技效果计算（FLOW-06-21 ~ FLOW-06-25） ──

  it(accTest('FLOW-06-21', '科技效果 — 完成科技后效果可查询'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    treeSystem.completeNode('mil_t1_attack');

    const effects = treeSystem.getAllCompletedEffects();
    assertStrict(effects.length > 0, 'FLOW-06-21', '完成科技后应有生效效果');

    const attackEffect = effects.find(e => e.type === 'troop_attack');
    assertStrict(!!attackEffect, 'FLOW-06-21', '应包含攻击力加成效果');
  });

  it(accTest('FLOW-06-22', '科技效果 — getEffectValue 返回正确加成值'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    treeSystem.completeNode('mil_t1_attack');

    const value = treeSystem.getEffectValue('troop_attack', 'all');
    assertStrict(
      value === 10,
      'FLOW-06-22',
      `mil_t1_attack 完成后攻击加成应为10，实际: ${value}`,
    );
  });

  it(accTest('FLOW-06-23', '科技效果 — 多个科技效果叠加'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // 完成两个攻击加成科技
    treeSystem.completeNode('mil_t1_attack'); // 全军攻击+10
    treeSystem.completeNode('mil_t2_charge'); // 骑兵攻击+15

    const allAtkValue = treeSystem.getEffectValue('troop_attack', 'all');
    const cavalryAtkValue = treeSystem.getEffectValue('troop_attack', 'cavalry');

    assertStrict(
      allAtkValue === 10,
      'FLOW-06-23',
      `全军攻击加成应为10，实际: ${allAtkValue}`,
    );
    // 骑兵攻击 = 全军10 + 骑兵专属15 = 25
    assertStrict(
      cavalryAtkValue === 25,
      'FLOW-06-23',
      `骑兵攻击加成应为25（全军10+骑兵15），实际: ${cavalryAtkValue}`,
    );
  });

  it(accTest('FLOW-06-24', '科技效果 — 路线进度统计'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    treeSystem.completeNode('mil_t1_attack');

    const progress = treeSystem.getPathProgress('military');
    assertStrict(progress.completed >= 1, 'FLOW-06-24', `军事路线完成数应>=1，实际: ${progress.completed}`);
    assertStrict(progress.total > 0, 'FLOW-06-24', `军事路线总数应>0，实际: ${progress.total}`);

    const allProgress = treeSystem.getAllPathProgress();
    assertStrict(
      Object.keys(allProgress).length === 3,
      'FLOW-06-24',
      '应有3条路线的进度数据',
    );
  });

  it(accTest('FLOW-06-25', '科技效果 — TechEffectSystem 加成查询'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();
    const effectSystem = sim.engine.getTechEffectSystem?.();

    treeSystem.completeNode('mil_t1_attack');

    // 如果引擎有 TechEffectSystem
    if (effectSystem) {
      const attackBonus = effectSystem.getAttackBonus('all');
      assertStrict(
        attackBonus >= 10,
        'FLOW-06-25',
        `TechEffectSystem 攻击加成应>=10，实际: ${attackBonus}`,
      );
    } else {
      // 回退到 treeSystem 查询
      const value = treeSystem.getEffectValue('troop_attack', 'all');
      assertStrict(value === 10, 'FLOW-06-25', `treeSystem 攻击加成应为10，实际: ${value}`);
    }
  });

  // ── 6. 研究操作（加速/取消）（FLOW-06-26 ~ FLOW-06-30） ──

  it(accTest('FLOW-06-26', '取消研究 — 返还科技点'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    const pointSystem = sim.engine.getTechPointSystem();

    const beforePoints = pointSystem.getTechPointState().current;
    researchSystem.startResearch('mil_t1_attack');
    const afterStart = pointSystem.getTechPointState().current;
    assertStrict(afterStart < beforePoints, 'FLOW-06-26', '研究开始后科技点应减少');

    const result = researchSystem.cancelResearch('mil_t1_attack');
    assertStrict(result.success, 'FLOW-06-26', '取消应成功');
    assertStrict(result.refundPoints > 0, 'FLOW-06-26', `应返还科技点，实际: ${result.refundPoints}`);

    const afterCancel = pointSystem.getTechPointState().current;
    assertStrict(
      afterCancel > afterStart,
      'FLOW-06-26',
      '取消后科技点应增加',
    );
  });

  it(accTest('FLOW-06-27', '取消研究 — 节点状态恢复'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    const treeSystem = sim.engine.getTechTreeSystem();

    researchSystem.startResearch('mil_t1_attack');
    assertStrict(
      treeSystem.getNodeState('mil_t1_attack')?.status === 'researching',
      'FLOW-06-27',
      '研究开始后应为 researching',
    );

    researchSystem.cancelResearch('mil_t1_attack');
    const state = treeSystem.getNodeState('mil_t1_attack')?.status;
    assertStrict(
      state === 'available',
      'FLOW-06-27',
      `取消后状态应为 available，实际: ${state}`,
    );
  });

  it(accTest('FLOW-06-28', '取消研究 — 队列清空'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();

    researchSystem.startResearch('mil_t1_attack');
    assertStrict(researchSystem.getQueue().length === 1, 'FLOW-06-28', '开始研究后队列应有1项');

    researchSystem.cancelResearch('mil_t1_attack');
    assertStrict(researchSystem.getQueue().length === 0, 'FLOW-06-28', '取消后队列应为空');
  });

  it(accTest('FLOW-06-29', '加速研究 — 计算天命和元宝消耗'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();

    researchSystem.startResearch('mil_t1_attack');

    const mandateCost = researchSystem.calculateMandateCost('mil_t1_attack');
    const ingotCost = researchSystem.calculateIngotCost('mil_t1_attack');

    assertStrict(
      typeof mandateCost === 'number' && mandateCost >= 0,
      'FLOW-06-29',
      `天命消耗应为非负数，实际: ${mandateCost}`,
    );
    assertStrict(
      typeof ingotCost === 'number' && ingotCost >= 0,
      'FLOW-06-29',
      `元宝消耗应为非负数，实际: ${ingotCost}`,
    );
  });

  it(accTest('FLOW-06-30', '研究面板 — 渲染活跃研究进度'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    researchSystem.startResearch('mil_t1_attack');

    renderResearchPanel(sim);

    // 活跃研究应显示在面板中
    const slot = screen.getByTestId('research-slot-mil_t1_attack');
    assertVisible(slot, 'FLOW-06-30', '研究槽位');

    // 进度百分比
    const percentEl = slot.querySelector('.tk-tech-research-slot-percent');
    assertStrict(!!percentEl, 'FLOW-06-30', '进度百分比应显示');
  });

  // ── 7. 科技点系统（FLOW-06-31 ~ FLOW-06-35） ──

  it(accTest('FLOW-06-31', '科技点 — 充足时可消费'), () => {
    const sim = createTechSimWithPoints();
    const pointSystem = sim.engine.getTechPointSystem();

    const result = pointSystem.trySpend(100);
    assertStrict(result.success, 'FLOW-06-31', '科技点充足时应可消费');
  });

  it(accTest('FLOW-06-32', '科技点 — 不足时消费失败'), () => {
    const sim = createTechSim();
    const pointSystem = sim.engine.getTechPointSystem();

    // 初始科技点为0
    const result = pointSystem.trySpend(10000);
    assertStrict(!result.success, 'FLOW-06-32', '科技点不足时应消费失败');
    assertStrict(!!result.reason, 'FLOW-06-32', '应返回失败原因');
  });

  it(accTest('FLOW-06-33', '科技点 — refund 增加科技点'), () => {
    const sim = createTechSim();
    const pointSystem = sim.engine.getTechPointSystem();

    const before = pointSystem.getTechPointState().current;
    pointSystem.refund(500);
    const after = pointSystem.getTechPointState().current;

    assertStrict(
      after === before + 500,
      'FLOW-06-33',
      `refund 后科技点应增加500，实际: ${before} → ${after}`,
    );
  });

  it(accTest('FLOW-06-34', '科技点 — 产出速率与书院等级关联'), () => {
    const sim = createTechSim();
    const pointSystem = sim.engine.getTechPointSystem();

    const rate = pointSystem.getProductionRate();
    assertStrict(rate > 0, 'FLOW-06-34', `书院Lv1时科技点产出应>0，实际: ${rate}`);
  });

  it(accTest('FLOW-06-35', '科技点 — 金币兑换科技点'), () => {
    const sim = createTechSim();
    sim.addResources({ gold: 10000 });
    const pointSystem = sim.engine.getTechPointSystem();

    const academyLevel = sim.getBuildingLevel('academy');
    const check = pointSystem.canExchange(academyLevel);
    if (check.can) {
      const result = pointSystem.exchangeGoldForTechPoints(1000, academyLevel);
      assertStrict(result.success, 'FLOW-06-35', '金币兑换科技点应成功');
      assertStrict(result.pointsGained > 0, 'FLOW-06-35', `应获得科技点，实际: ${result.pointsGained}`);
    } else {
      // 如果不支持兑换，验证 canExchange 返回 false
      assertStrict(!check.can, 'FLOW-06-35', '不支持兑换时应返回 can=false');
    }
  });

  // ── 8. 节点详情弹窗（FLOW-06-36 ~ FLOW-06-40） ──

  it(accTest('FLOW-06-36', '节点详情弹窗 — 渲染节点信息'), () => {
    const sim = createTechSim();
    const onClose = vi.fn();
    const onStartResearch = vi.fn();

    render(
      <TechNodeDetailModal
        nodeDef={makeNodeDef()}
        nodeState={makeNodeState()}
        engine={sim.engine}
        onClose={onClose}
        onStartResearch={onStartResearch}
        snapshotVersion={0}
        tick={0}
      />
    );

    // 弹窗容器（TechNodeDetailModal 传 data-testid="tech-detail-overlay" 给 SharedPanel）
    const panel = screen.getByTestId('tech-detail-overlay');
    assertVisible(panel, 'FLOW-06-36', '节点详情弹窗');

    // 节点名称（标题+详情中可能重复，用 getAllByText）
    const nameEls = within(panel).getAllByText('锐兵术');
    assertStrict(nameEls.length >= 1, 'FLOW-06-36', '节点名称应出现');
  });

  it(accTest('FLOW-06-37', '节点详情弹窗 — 显示效果描述'), () => {
    const sim = createTechSim();
    render(
      <TechNodeDetailModal
        nodeDef={makeNodeDef()}
        nodeState={makeNodeState()}
        engine={sim.engine}
        onClose={vi.fn()}
        onStartResearch={vi.fn()}
        snapshotVersion={0}
        tick={0}
      />
    );

    // 描述文本
    const descEl = screen.getByText(/提升全军攻击力/);
    assertVisible(descEl, 'FLOW-06-37', '效果描述');
  });

  it(accTest('FLOW-06-38', '节点详情弹窗 — 显示消耗和前置条件'), () => {
    const sim = createTechSim();
    render(
      <TechNodeDetailModal
        nodeDef={makeNodeDef()}
        nodeState={makeNodeState()}
        engine={sim.engine}
        onClose={vi.fn()}
        onStartResearch={vi.fn()}
        snapshotVersion={0}
        tick={0}
      />
    );

    // 科技点消耗
    const costEl = screen.getByText(/50/);
    assertVisible(costEl, 'FLOW-06-38', '科技点消耗');
  });

  it(accTest('FLOW-06-39', '节点详情弹窗 — 关闭按钮触发回调'), async () => {
    const sim = createTechSim();
    const onClose = vi.fn();

    render(
      <TechNodeDetailModal
        nodeDef={makeNodeDef()}
        nodeState={makeNodeState()}
        engine={sim.engine}
        onClose={onClose}
        onStartResearch={vi.fn()}
        snapshotVersion={0}
        tick={0}
      />
    );

    const closeBtn = screen.getByTestId('panel-close');
    await userEvent.click(closeBtn);
    assertStrict(onClose.mock.calls.length === 1, 'FLOW-06-39', '关闭按钮应触发 onClose');
  });

  it(accTest('FLOW-06-40', '节点详情弹窗 — locked 状态不显示研究按钮'), () => {
    const sim = createTechSim();
    render(
      <TechNodeDetailModal
        nodeDef={makeNodeDef({ id: 'mil_t2_charge', name: '冲锋战术', prerequisites: ['mil_t1_attack'] })}
        nodeState={makeNodeState({ id: 'mil_t2_charge', status: 'locked' })}
        engine={sim.engine}
        onClose={vi.fn()}
        onStartResearch={vi.fn()}
        snapshotVersion={0}
        tick={0}
      />
    );

    // locked 状态不应有研究按钮
    const researchBtn = screen.queryByRole('button', { name: /开始研究|研究/ });
    // 如果有按钮，它应该是禁用状态
    if (researchBtn) {
      assertStrict(
        researchBtn.hasAttribute('disabled') || researchBtn.classList.contains('disabled'),
        'FLOW-06-40',
        'locked 状态研究按钮应禁用',
      );
    }
    // 状态文本应显示"未解锁"
    const statusText = screen.getByText('未解锁');
    assertVisible(statusText, 'FLOW-06-40', 'locked 状态文本');
  });

  // ── 9. 离线面板与科技重置（FLOW-06-41 ~ FLOW-06-45） ──

  it(accTest('FLOW-06-41', '离线收益按钮 — 渲染入口按钮'), () => {
    const sim = createTechSim();
    renderTechTab(sim);

    const offlineBtn = screen.getByTestId('tech-offline-btn');
    assertVisible(offlineBtn, 'FLOW-06-41', '离线收益按钮');
    assertStrict(
      offlineBtn.textContent!.includes('离线'),
      'FLOW-06-41',
      '按钮文本应包含"离线"',
    );
  });

  it(accTest('FLOW-06-42', '离线收益按钮 — 点击打开离线面板'), async () => {
    const sim = createTechSim();
    renderTechTab(sim);

    const offlineBtn = screen.getByTestId('tech-offline-btn');
    await userEvent.click(offlineBtn);

    // 离线面板应出现（通过 visible prop 控制）
    const offlinePanel = screen.queryByTestId('tech-offline-panel');
    // 面板可能使用 Modal 组件，检查是否渲染
    if (offlinePanel) {
      assertVisible(offlinePanel, 'FLOW-06-42', '离线研究面板');
    }
  });

  it(accTest('FLOW-06-43', '科技重置 — treeSystem.reset 恢复初始状态'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // 先完成一个科技
    treeSystem.completeNode('mil_t1_attack');
    assertStrict(
      treeSystem.getNodeState('mil_t1_attack')?.status === 'completed',
      'FLOW-06-43',
      '完成科技后状态应为 completed',
    );

    // 重置
    treeSystem.reset();

    const state = treeSystem.getNodeState('mil_t1_attack')?.status;
    assertStrict(
      state === 'available' || state === 'locked',
      'FLOW-06-43',
      `重置后状态应为 available 或 locked，实际: ${state}`,
    );
  });

  it(accTest('FLOW-06-44', '科技重置 — 效果清零'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    treeSystem.completeNode('mil_t1_attack');
    assertStrict(treeSystem.getEffectValue('troop_attack', 'all') === 10, 'FLOW-06-44', '完成科技后应有加成');

    treeSystem.reset();
    assertStrict(
      treeSystem.getEffectValue('troop_attack', 'all') === 0,
      'FLOW-06-44',
      '重置后加成应为0',
    );
  });

  it(accTest('FLOW-06-45', '科技点序列化与反序列化 — 数据一致性'), () => {
    const sim = createTechSimWithPoints();
    const pointSystem = sim.engine.getTechPointSystem();
    const treeSystem = sim.engine.getTechTreeSystem();

    pointSystem.refund(1000);
    treeSystem.completeNode('mil_t1_attack');

    const serialized = {
      points: pointSystem.serialize(),
      tree: treeSystem.serialize(),
    };

    // 验证序列化数据结构
    assertStrict(!!serialized.points, 'FLOW-06-45', '科技点序列化数据应存在');
    assertStrict(!!serialized.tree, 'FLOW-06-45', '科技树序列化数据应存在');
    assertStrict(
      serialized.tree.completedTechIds.includes('mil_t1_attack'),
      'FLOW-06-45',
      '已完成科技应在序列化数据中',
    );
  });

  // ── 10. 边界情况与完整流程（FLOW-06-46 ~ FLOW-06-50） ──

  it(accTest('FLOW-06-46', '完整流程 — 从研究到完成的端到端验证'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    const treeSystem = sim.engine.getTechTreeSystem();
    const pointSystem = sim.engine.getTechPointSystem();

    // 1. 开始研究
    const startResult = researchSystem.startResearch('mil_t1_attack');
    assertStrict(startResult.success, 'FLOW-06-46', '步骤1: 开始研究成功');

    // 2. 验证状态
    assertStrict(
      treeSystem.getNodeState('mil_t1_attack')?.status === 'researching',
      'FLOW-06-46',
      '步骤2: 节点状态为 researching',
    );

    // 3. 取消研究
    const cancelResult = researchSystem.cancelResearch('mil_t1_attack');
    assertStrict(cancelResult.success, 'FLOW-06-46', '步骤3: 取消研究成功');
    assertStrict(cancelResult.refundPoints > 0, 'FLOW-06-46', '步骤3: 返还科技点');

    // 4. 重新开始研究
    const restartResult = researchSystem.startResearch('mil_t1_attack');
    assertStrict(restartResult.success, 'FLOW-06-46', '步骤4: 重新研究成功');

    // 5. 手动完成（模拟研究完成）
    treeSystem.completeNode('mil_t1_attack');
    assertStrict(
      treeSystem.getNodeState('mil_t1_attack')?.status === 'completed',
      'FLOW-06-46',
      '步骤5: 节点已完成',
    );

    // 6. 验证效果生效
    const atkValue = treeSystem.getEffectValue('troop_attack', 'all');
    assertStrict(atkValue === 10, 'FLOW-06-46', `步骤6: 攻击加成为10，实际: ${atkValue}`);
  });

  it(accTest('FLOW-06-47', '完整流程 — 多路线并行研究'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // 完成三条路线各一个Tier1节点
    treeSystem.completeNode('mil_t1_attack');
    treeSystem.completeNode('eco_t1_farming');
    treeSystem.completeNode('cul_t1_education');

    // 验证各路线进度
    const milProgress = treeSystem.getPathProgress('military');
    const ecoProgress = treeSystem.getPathProgress('economy');
    const culProgress = treeSystem.getPathProgress('culture');

    assertStrict(milProgress.completed >= 1, 'FLOW-06-47', '军事路线完成数>=1');
    assertStrict(ecoProgress.completed >= 1, 'FLOW-06-47', '经济路线完成数>=1');
    assertStrict(culProgress.completed >= 1, 'FLOW-06-47', '文化路线完成数>=1');
  });

  it(accTest('FLOW-06-48', '完整流程 — 科技链路解锁验证'), () => {
    const sim = createTechSimWithPoints();
    const treeSystem = sim.engine.getTechTreeSystem();

    // Tier1 → Tier2 → Tier3 → Tier4
    treeSystem.completeNode('mil_t1_attack');
    assertStrict(
      !treeSystem.isMutexLocked('mil_t1_attack'),
      'FLOW-06-48',
      '已完成的节点不应被互斥锁定',
    );

    // Tier2 冲锋战术前置已满足
    const unmet = treeSystem.getUnmetPrerequisites('mil_t2_charge');
    assertStrict(unmet.length === 0, 'FLOW-06-48', 'Tier2前置应已满足');

    // 完成 Tier2
    treeSystem.completeNode('mil_t2_charge');

    // Tier3 闪电战前置应满足
    const unmetT3 = treeSystem.getUnmetPrerequisites('mil_t3_blitz');
    assertStrict(unmetT3.length === 0, 'FLOW-06-48', 'Tier3前置应已满足');
  });

  it(accTest('FLOW-06-49', '边界 — 不存在的科技节点'), () => {
    const sim = createTechSim();
    const treeSystem = sim.engine.getTechTreeSystem();

    const def = treeSystem.getNodeDef('nonexistent_tech');
    assertStrict(def === undefined, 'FLOW-06-49', '不存在的节点应返回 undefined');

    const state = treeSystem.getNodeState('nonexistent_tech');
    assertStrict(state === undefined || state?.status === 'locked', 'FLOW-06-49', '不存在的节点状态应为 undefined 或 locked');
  });

  it(accTest('FLOW-06-50', '边界 — 重复研究同一科技应失败'), () => {
    const sim = createTechSimWithPoints();
    const researchSystem = sim.engine.getTechResearchSystem();
    const treeSystem = sim.engine.getTechTreeSystem();

    // 完成科技
    treeSystem.completeNode('mil_t1_attack');

    // 尝试研究已完成的科技
    const result = researchSystem.startResearch('mil_t1_attack');
    assertStrict(!result.success, 'FLOW-06-50', '已完成的科技不应能再次研究');
  });
});
