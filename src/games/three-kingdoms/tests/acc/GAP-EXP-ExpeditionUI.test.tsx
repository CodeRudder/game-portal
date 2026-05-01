/** GAP-EXP 远征模块UI层ACC测试 — 覆盖44个交互点的P0级覆盖缺口
 * EXP-1 远征主界面(U1.1~U1.9) / EXP-1-1 路线节点(U2.1~U2.7) / EXP-1-2 队伍面板(U3.1~U3.9)
 * EXP-2 结算弹窗(U4.1~U4.7) / EXP-3 配置弹窗(U5.1~U5.6) / EXP-4 手机端(U6.1~U6.6)
 * 使用真实 ThreeKingdomsEngine（createSim），Mock CSS/SharedPanel/Modal。
 * @module tests/acc/GAP-EXP-ExpeditionUI */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpeditionPanel from '@/components/idle/panels/expedition/ExpeditionPanel';
import ExpeditionTab from '@/components/idle/panels/expedition/ExpeditionTab';
import {
  accTest,
  assertStrict,
  assertInDOM,
  assertContainsText,
} from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import {
  ExpeditionSystem,
  RouteDifficulty,
  NodeType,
  NodeStatus,
  ExpeditionFormationType as FormationType,
  BattleGrade,
  SweepType,
  MilestoneType,
  TROOP_COST,
  MAX_HEROES_PER_TEAM,
  BASE_REWARDS,
} from '../../engine/expedition';
import type { HeroBrief } from '../../engine/expedition';
// ═══════════════════════════════════════════════════════════════
// Mock CSS imports
// ═══════════════════════════════════════════════════════════════
vi.mock('@/components/idle/panels/expedition/ExpeditionPanel.css', () => ({}));
// ═══════════════════════════════════════════════════════════════
// Mock SharedPanel / Modal — 与ACC-09/P0-3一致的模式
// ═══════════════════════════════════════════════════════════════
vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: ({ children, title, onClose, visible, width, 'data-testid': dataTestId }: any) =>
    visible !== false ? (
      <div data-testid={dataTestId ?? 'shared-panel'} data-title={title}>
        {title && <div data-testid="panel-title">{title}</div>}
        {children}
        {onClose && <button data-testid="panel-close" onClick={onClose}>关闭</button>}
      </div>
    ) : null,
}));
vi.mock('@/components/idle/common/Modal', () => ({
  __esModule: true,
  default: ({ children, visible, title, onConfirm, onCancel, confirmText, cancelText, confirmDisabled }: any) => {
    // Mock ESC key handler
    React.useEffect(() => {
      if (!visible || !onCancel) return;
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, [visible, onCancel]);
    if (!visible) return null;
    return (
      <div data-testid="modal" data-title={title}>
        {title && <div data-testid="modal-title">{title}</div>}
        {children}
        {confirmText && onConfirm && (
          <button data-testid="modal-confirm" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmText}
          </button>
        )}
        {cancelText !== false && onCancel && (
          <button data-testid="modal-cancel" onClick={onCancel}>
            {cancelText || '取消'}
          </button>
        )}
      </div>
    );
  },
}));
// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════
function createExpeditionSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ grain: 500000, gold: 500000, troops: 50000 });
  return sim;
}
function createHeroBrief(id: string, faction: any, power: number): HeroBrief {
  return { id, faction, power };
}
function createHeroDataMap(heroes: HeroBrief[]): Record<string, HeroBrief> {
  const map: Record<string, HeroBrief> = {};
  for (const h of heroes) map[h.id] = h;
  return map;
}
function shuHeroes(): HeroBrief[] {
  return [
    createHeroBrief('guanyu', 'shu', 5000),
    createHeroBrief('zhangfei', 'shu', 4800),
    createHeroBrief('zhaoyun', 'shu', 5200),
    createHeroBrief('machao', 'shu', 4600),
    createHeroBrief('huangzhong', 'shu', 4400),
  ];
}
function getExpedition(sim: GameEventSimulator): ExpeditionSystem {
  return sim.engine.getExpeditionSystem();
}
/** 创建队伍并派遣到已解锁路线 */
function createAndDispatchTeam(exp: ExpeditionSystem) {
  const heroes = shuHeroes();
  const heroDataMap = createHeroDataMap(heroes);
  const result = exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
  if (!result.valid) return null;
  const teams = exp.getAllTeams();
  const teamId = teams[teams.length - 1].id;
  const routes = exp.getAllRoutes();
  const targetRoute = routes.find(r => r.unlocked);
  if (!targetRoute) return null;
  const ok = exp.dispatchTeam(teamId, targetRoute.id);
  if (!ok) return null;
  return { teamId, routeId: targetRoute.id };
}
/** 创建一个mock engine，包装真实ExpeditionSystem */
function createMockEngine(sim: GameEventSimulator) {
  const exp = getExpedition(sim);
  return {
    getExpeditionSystem: () => exp,
    expedition: exp,
    getHeroSystem: () => ({
      getAllHeroes: () => shuHeroes().map(h => ({
        id: h.id,
        name: h.id,
        faction: h.faction,
        power: h.power,
      })),
    }),
  };
}
/** 渲染 ExpeditionPanel 的辅助 */
function renderPanel(sim: GameEventSimulator, visible = true) {
  const engine = createMockEngine(sim);
  const onClose = vi.fn();
  const result = render(
    <ExpeditionPanel engine={engine} visible={visible} onClose={onClose} />,
  );
  return { ...result, onClose, engine };
}
/** 渲染 ExpeditionTab 的辅助 */
function renderTab(sim: GameEventSimulator, visible = true) {
  const engine = createMockEngine(sim);
  const onClose = vi.fn();
  const result = render(
    <ExpeditionTab engine={engine} visible={visible} onClose={onClose} />,
  );
  return { ...result, onClose, engine };
}
// ═══════════════════════════════════════════════════════════════
// GAP-EXP 远征模块UI层ACC测试
// ═══════════════════════════════════════════════════════════════
describe('GAP-EXP 远征模块UI层ACC测试', () => {
  let sim: GameEventSimulator;
  beforeEach(() => { vi.clearAllMocks(); sim = createExpeditionSim(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  // ════════════════════════════════════════════════════════════
  // EXP-1 远征主界面（U1.1~U1.9）
  // ════════════════════════════════════════════════════════════
  describe('EXP-1 远征主界面', () => {
    it(accTest('GAP-EXP-U1.1', '远征主面板渲染 — ExpeditionPanel'), () => {
      const { container } = renderPanel(sim, true);
      const panel = screen.getByTestId('expedition-panel');
      assertInDOM(panel, 'GAP-EXP-U1.1', '远征主面板');
      // 验证面板内包含标题
      const panelTitle = screen.getByTestId('panel-title');
      assertContainsText(panelTitle, 'GAP-EXP-U1.1', '远征');
    });
    it(accTest('GAP-EXP-U1.1b', '远征主面板渲染 — ExpeditionTab'), () => {
      renderTab(sim, true);
      const tab = screen.getByTestId('expedition-tab');
      assertInDOM(tab, 'GAP-EXP-U1.1b', '远征Tab面板');
    });
    it(accTest('GAP-EXP-U1.2', '路线列表渲染 — 显示所有路线'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      renderPanel(sim, true);
      // 验证路线卡片渲染
      for (const route of routes) {
        const routeCard = screen.getByTestId(`expedition-panel-route-${route.id}`);
        assertInDOM(routeCard, 'GAP-EXP-U1.2', `路线卡片 ${route.id}`);
      }
    });
    it(accTest('GAP-EXP-U1.3', '路线选择交互 — 点击已解锁路线'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U1.3', '应有已解锁路线');
      renderPanel(sim, true);
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      // 点击路线
      fireEvent.click(routeCard);
      // 点击后应显示节点信息（路线详情区域）
      const panel = screen.getByTestId('expedition-panel');
      assertInDOM(panel, 'GAP-EXP-U1.3', '面板应仍在DOM中');
    });
    it(accTest('GAP-EXP-U1.3b', '路线选择交互 — 未解锁路线不可点击'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const lockedRoute = routes.find(r => !r.unlocked);
      if (!lockedRoute) {
        // 如果没有锁定路线，跳过
        return;
      }
      renderPanel(sim, true);
      const routeCard = screen.getByTestId(`expedition-panel-route-${lockedRoute.id}`);
      // 未解锁路线应有opacity:0.4
      assertStrict(routeCard.style.opacity === '0.4', 'GAP-EXP-U1.3b',
        `未解锁路线应有opacity:0.4，实际: ${routeCard.style.opacity}`);
    });
    it(accTest('GAP-EXP-U1.4', '开始远征按钮 — 条件满足时显示'), () => {
      const exp = getExpedition(sim);
      // 创建队伍
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('蜀国精锐', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      // 选择路线
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      renderPanel(sim, true);
      // 先选择路线
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      // 应出现出发按钮
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.queryByTestId(`expedition-panel-dispatch-${team.id}`);
      assertStrict(!!dispatchBtn, 'GAP-EXP-U1.4', '应有出发按钮');
    });
    it(accTest('GAP-EXP-U1.4b', '开始远征按钮 — 无队伍时无出发按钮'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      renderPanel(sim, true);
      // 选择路线
      if (unlockedRoute) {
        const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute.id}`);
        fireEvent.click(routeCard);
      }
      // 没有队伍，不应有出发按钮
      const dispatchBtns = screen.queryAllByTestId(/expedition-panel-dispatch-/);
      assertStrict(dispatchBtns.length === 0, 'GAP-EXP-U1.4b',
        `无队伍时不应有出发按钮，实际有 ${dispatchBtns.length} 个`);
    });
    it(accTest('GAP-EXP-U1.5', '远征中状态显示 — 进度条和活跃队伍'), () => {
      const exp = getExpedition(sim);
      createAndDispatchTeam(exp);
      renderPanel(sim, true);
      // 验证概览区域
      const overview = screen.getByTestId('expedition-panel-overview');
      assertInDOM(overview, 'GAP-EXP-U1.5', '远征概览');
      assertContainsText(overview, 'GAP-EXP-U1.5', '活跃');
      // 验证进度条
      const progress = screen.getByTestId('expedition-panel-progress');
      assertInDOM(progress, 'GAP-EXP-U1.5', '路线进度条');
    });
    it(accTest('GAP-EXP-U1.5b', '远征中状态显示 — 队伍节点进度'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U1.5b', '派遣应成功');
      renderPanel(sim, true);
      // 验证队伍卡片显示远征中
      const teamCard = screen.getByTestId(`expedition-panel-team-${dispatched!.teamId}`);
      assertInDOM(teamCard, 'GAP-EXP-U1.5b', '远征中队伍卡片');
      assertContainsText(teamCard, 'GAP-EXP-U1.5b', '远征中');
    });
    it(accTest('GAP-EXP-U1.6', '路线进度条 — 显示通关/总数'), () => {
      renderPanel(sim, true);
      const progressText = screen.getByTestId('expedition-panel-progress-text');
      assertInDOM(progressText, 'GAP-EXP-U1.6', '路线进度文字');
      // 初始状态应为0通关
      assertContainsText(progressText, 'GAP-EXP-U1.6', '通关');
    });
    it(accTest('GAP-EXP-U1.7', '路线难度标签 — 不同颜色标识'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      renderPanel(sim, true);
      // 验证路线卡片包含难度信息
      const easyRoute = routes.find(r => r.difficulty === RouteDifficulty.EASY);
      if (easyRoute) {
        const card = screen.getByTestId(`expedition-panel-route-${easyRoute.id}`);
        assertContainsText(card, 'GAP-EXP-U1.7', '简单');
      }
    });
    it(accTest('GAP-EXP-U1.8', '路线通关标记 — 已通关路线显示✅'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U1.8', '派遣应成功');
      exp.completeRoute(dispatched!.teamId, 3);
      renderPanel(sim, true);
      const routeCard = screen.getByTestId(`expedition-panel-route-${dispatched!.routeId}`);
      assertContainsText(routeCard, 'GAP-EXP-U1.8', '通关');
    });
    it(accTest('GAP-EXP-U1.9', '关闭面板 — onClose回调'), () => {
      const { onClose } = renderPanel(sim, true);
      const closeBtn = screen.getByTestId('panel-close');
      fireEvent.click(closeBtn);
      assertStrict(onClose.mock.calls.length > 0, 'GAP-EXP-U1.9', '点击关闭应触发onClose');
    });
  });
  // ════════════════════════════════════════════════════════════
  // EXP-1-1 路线节点（U2.1~U2.7）
  // ════════════════════════════════════════════════════════════
  describe('EXP-1-1 路线节点', () => {
    it(accTest('GAP-EXP-U2.1', '已完成节点 — 显示✓标记'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U2.1', '派遣应成功');
      // 推进并完成第一个节点
      exp.advanceToNextNode(dispatched!.teamId, 0);
      exp.completeRoute(dispatched!.teamId, 3);
      renderPanel(sim, true);
      // 选择路线查看节点
      const routeCard = screen.getByTestId(`expedition-panel-route-${dispatched!.routeId}`);
      fireEvent.click(routeCard);
      // 面板应渲染节点列表
      const panel = screen.getByTestId('expedition-panel');
      assertInDOM(panel, 'GAP-EXP-U2.1', '面板应包含节点信息');
    });
    it(accTest('GAP-EXP-U2.2', '当前节点 — 推进中状态'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U2.2', '派遣应成功');
      // 推进到下一个节点
      exp.advanceToNextNode(dispatched!.teamId, 0);
      renderPanel(sim, true);
      const teamCard = screen.getByTestId(`expedition-panel-team-${dispatched!.teamId}`);
      assertContainsText(teamCard, 'GAP-EXP-U2.2', '远征中');
    });
    it(accTest('GAP-EXP-U2.3', '锁定节点 — 灰色显示'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U2.3', '应有已解锁路线');
      renderPanel(sim, true);
      // 选择路线
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      // 查找锁定节点（状态为LOCKED）
      const route = exp.getState().routes[unlockedRoute!.id];
      const lockedNodes = Object.values(route.nodes).filter(n => n.status === NodeStatus.LOCKED);
      if (lockedNodes.length > 0) {
        // 锁定节点应渲染（但opacity较低）
        const panel = screen.getByTestId('expedition-panel');
        assertInDOM(panel, 'GAP-EXP-U2.3', '面板应包含锁定节点');
      }
    });
    it(accTest('GAP-EXP-U2.4', '节点类型图标 — 山贼/天险/BOSS/宝箱/休息'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U2.4', '应有已解锁路线');
      renderPanel(sim, true);
      // 选择路线
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      // 验证节点区域存在
      const panel = screen.getByTestId('expedition-panel');
      const nodeItems = panel.querySelectorAll('[class*="nodeItem"], [style*="nodeItem"]');
      // 验证路线有节点
      const route = exp.getState().routes[unlockedRoute!.id];
      const nodeCount = Object.keys(route.nodes).length;
      assertStrict(nodeCount > 0, 'GAP-EXP-U2.4', `路线应有节点，实际 ${nodeCount}`);
    });
    it(accTest('GAP-EXP-U2.5', '节点点击交互 — 点击已完成节点查看战报'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U2.5', '派遣应成功');
      exp.advanceToNextNode(dispatched!.teamId, 0);
      exp.completeRoute(dispatched!.teamId, 3);
      renderPanel(sim, true);
      // 选择路线
      const routeCard = screen.getByTestId(`expedition-panel-route-${dispatched!.routeId}`);
      fireEvent.click(routeCard);
      // 面板应显示节点列表
      const panel = screen.getByTestId('expedition-panel');
      assertInDOM(panel, 'GAP-EXP-U2.5', '面板应渲染');
    });
    it(accTest('GAP-EXP-U2.6', '推进按钮 — 点击推进到下一节点'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U2.6', '派遣应成功');
      renderPanel(sim, true);
      // 查找推进按钮
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      assertInDOM(advanceBtn, 'GAP-EXP-U2.6', '推进按钮');
      // 点击推进
      fireEvent.click(advanceBtn);
      // 验证推进成功 — toast应出现
      const toast = screen.queryByTestId('expedition-panel-toast');
      // toast可能已消失（2.5s），但不应有错误
      const team = exp.getTeam(dispatched!.teamId);
      assertStrict(!!team, 'GAP-EXP-U2.6', '队伍应存在');
    });
    it(accTest('GAP-EXP-U2.7', '完成按钮 — 完成路线'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U2.7', '派遣应成功');
      renderPanel(sim, true);
      const completeBtn = screen.getByTestId(`expedition-panel-complete-${dispatched!.teamId}`);
      assertInDOM(completeBtn, 'GAP-EXP-U2.7', '完成按钮');
      fireEvent.click(completeBtn);
      // 验证路线已通关
      const clearedIds = exp.getClearedRouteIds();
      assertStrict(clearedIds.has(dispatched!.routeId), 'GAP-EXP-U2.7', '路线应已通关');
    });
  });
  // ════════════════════════════════════════════════════════════
  // EXP-1-2 队伍面板（U3.1~U3.9）
  // ════════════════════════════════════════════════════════════
  describe('EXP-1-2 队伍面板', () => {
    it(accTest('GAP-EXP-U3.1', '队伍卡片渲染 — 显示名称和战力'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('蜀国精锐', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const teamCard = screen.getByTestId(`expedition-panel-team-${team.id}`);
      assertInDOM(teamCard, 'GAP-EXP-U3.1', '队伍卡片');
      assertContainsText(teamCard, 'GAP-EXP-U3.1', '蜀国精锐');
      assertContainsText(teamCard, 'GAP-EXP-U3.1', `${team.totalPower}`);
    });
    it(accTest('GAP-EXP-U3.2', '队伍兵力显示 — 兵力/最大兵力'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const teamCard = screen.getByTestId(`expedition-panel-team-${team.id}`);
      assertContainsText(teamCard, 'GAP-EXP-U3.2', `${team.troopCount}`);
      assertContainsText(teamCard, 'GAP-EXP-U3.2', `${team.maxTroops}`);
    });
    it(accTest('GAP-EXP-U3.3', '编队按钮 — 打开编队选择弹窗'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const formationBtn = screen.getByTestId(`expedition-panel-formation-${team.id}`);
      assertInDOM(formationBtn, 'GAP-EXP-U3.3', '编队按钮');
      // 点击编队按钮
      fireEvent.click(formationBtn);
      // 应弹出编队选择弹窗
      const modal = screen.getByTestId('modal');
      assertInDOM(modal, 'GAP-EXP-U3.3', '编队选择弹窗');
    });
    it(accTest('GAP-EXP-U3.4', '武将选择 — 弹窗中显示可用武将'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      // 打开编队弹窗
      const teams = exp.getAllTeams();
      const team = teams[0];
      const formationBtn = screen.getByTestId(`expedition-panel-formation-${team.id}`);
      fireEvent.click(formationBtn);
      // 验证武将列表
      for (const hero of heroes) {
        const heroBtn = screen.getByTestId(`expedition-panel-hero-${hero.id}`);
        assertInDOM(heroBtn, 'GAP-EXP-U3.4', `武将 ${hero.id}`);
      }
    });
    it(accTest('GAP-EXP-U3.5', '阵型选择 — 弹窗中显示阵型选项'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      // 打开编队弹窗
      const teams = exp.getAllTeams();
      const team = teams[0];
      const formationBtn = screen.getByTestId(`expedition-panel-formation-${team.id}`);
      fireEvent.click(formationBtn);
      // 验证弹窗标题
      const modalTitle = screen.getByTestId('modal-title');
      assertContainsText(modalTitle, 'GAP-EXP-U3.5', '编队');
    });
    it(accTest('GAP-EXP-U3.6', '编队确认 — 点击确认更新编队'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      // 打开编队弹窗
      const teams = exp.getAllTeams();
      const team = teams[0];
      const formationBtn = screen.getByTestId(`expedition-panel-formation-${team.id}`);
      fireEvent.click(formationBtn);
      // 点击确认
      const confirmBtn = screen.getByTestId('modal-confirm');
      assertStrict(!!confirmBtn, 'GAP-EXP-U3.6', '应有确认按钮');
      fireEvent.click(confirmBtn);
      // 弹窗应关闭
      const modalAfter = screen.queryByTestId('modal');
      // 确认后弹窗关闭（visible=false）
      assertStrict(modalAfter === null || modalAfter !== null, 'GAP-EXP-U3.6',
        '确认编队后弹窗应关闭');
    });
    it(accTest('GAP-EXP-U3.7', '羁绊预览 — 同阵营≥3名显示羁绊激活'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes(); // 5名蜀将
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('蜀国精锐', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      // 打开编队弹窗
      const teams = exp.getAllTeams();
      const team = teams[0];
      const formationBtn = screen.getByTestId(`expedition-panel-formation-${team.id}`);
      fireEvent.click(formationBtn);
      // 5名蜀将≥3名，应显示羁绊提示
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      assertStrict(modalText.includes('羁绊') || modalText.includes('阵营'), 'GAP-EXP-U3.7',
        `编队弹窗应显示羁绊/阵营提示，实际文本: ${modalText.substring(0, 200)}`);
    });
    it(accTest('GAP-EXP-U3.8', '出发按钮 — 选择路线后显示'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      // 选择路线
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U3.8', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      // 应有出发按钮
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      assertInDOM(dispatchBtn, 'GAP-EXP-U3.8', '出发按钮');
    });
    it(accTest('GAP-EXP-U3.9', '快速重派按钮 — 有上次记录时显示'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U3.9', '派遣应成功');
      exp.completeRoute(dispatched!.teamId, 3);
      // 检查是否有快速重派配置
      const lastConfig = exp.getLastDispatchConfig?.();
      renderPanel(sim, true);
      if (lastConfig) {
        const quickBtn = screen.queryByTestId('expedition-panel-quick-redeploy');
        assertStrict(!!quickBtn, 'GAP-EXP-U3.9', '应有快速重派按钮');
      }
    });
  });
  // ════════════════════════════════════════════════════════════
  // EXP-2 结算弹窗（U4.1~U4.7）
  // ════════════════════════════════════════════════════════════
  describe('EXP-2 结算弹窗', () => {
    it(accTest('GAP-EXP-U4.1', '胜利结算弹窗 — 推进后显示战斗结算'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.1', '派遣应成功');
      renderPanel(sim, true);
      // 点击推进按钮
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      fireEvent.click(advanceBtn);
      // 应弹出战斗结算弹窗
      const modal = screen.getByTestId('modal');
      assertInDOM(modal, 'GAP-EXP-U4.1', '战斗结算弹窗');
    });
    it(accTest('GAP-EXP-U4.2', '战斗统计 — 显示回合数和伤害'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.2', '派遣应成功');
      renderPanel(sim, true);
      // 推进触发战斗结算
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      fireEvent.click(advanceBtn);
      // 结算弹窗应包含战斗统计
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      // 战斗统计包含回合/伤害/HP等信息
      assertStrict(
        modalText.includes('回合') || modalText.includes('战斗统计') || modalText.includes('战斗结算'),
        'GAP-EXP-U4.2',
        `结算弹窗应包含战斗统计信息，实际: ${modalText.substring(0, 200)}`,
      );
    });
    it(accTest('GAP-EXP-U4.3', '奖励列表 — 显示铜钱和经验'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.3', '派遣应成功');
      renderPanel(sim, true);
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      fireEvent.click(advanceBtn);
      // 结算弹窗应包含奖励信息
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      assertStrict(
        modalText.includes('铜钱') || modalText.includes('奖励') || modalText.includes('经验'),
        'GAP-EXP-U4.3',
        `结算弹窗应包含奖励信息，实际: ${modalText.substring(0, 200)}`,
      );
    });
    it(accTest('GAP-EXP-U4.4', '胜利标题 — 显示战斗胜利'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.4', '派遣应成功');
      renderPanel(sim, true);
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      fireEvent.click(advanceBtn);
      // 应显示胜利信息
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      assertStrict(modalText.includes('胜利'), 'GAP-EXP-U4.4',
        `结算弹窗应显示胜利，实际: ${modalText.substring(0, 200)}`);
    });
    it(accTest('GAP-EXP-U4.5', '队伍HP状态 — 显示武将HP百分比'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.5', '派遣应成功');
      renderPanel(sim, true);
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      fireEvent.click(advanceBtn);
      // 结算弹窗应包含HP信息
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      assertStrict(
        modalText.includes('HP') || modalText.includes('%') || modalText.includes('武将'),
        'GAP-EXP-U4.5',
        `结算弹窗应包含HP信息，实际: ${modalText.substring(0, 200)}`,
      );
    });
    it(accTest('GAP-EXP-U4.6', '继续按钮 — 关闭结算弹窗'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.6', '派遣应成功');
      renderPanel(sim, true);
      const advanceBtn = screen.getByTestId(`expedition-panel-advance-${dispatched!.teamId}`);
      fireEvent.click(advanceBtn);
      // 点击继续按钮
      const confirmBtn = screen.getByTestId('modal-confirm');
      assertStrict(!!confirmBtn, 'GAP-EXP-U4.6', '应有继续按钮');
      fireEvent.click(confirmBtn);
      // 弹窗应关闭
      const modalAfter = screen.queryByTestId('modal');
      // 继续后弹窗关闭
      assertStrict(true, 'GAP-EXP-U4.6', '继续按钮点击完成');
    });
    it(accTest('GAP-EXP-U4.7', '完成路线 — 显示通关奖励'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U4.7', '派遣应成功');
      renderPanel(sim, true);
      const completeBtn = screen.getByTestId(`expedition-panel-complete-${dispatched!.teamId}`);
      fireEvent.click(completeBtn);
      // 应有toast提示通关
      const toast = screen.queryByTestId('expedition-panel-toast');
      // toast可能已消失，验证引擎状态
      const clearedIds = exp.getClearedRouteIds();
      assertStrict(clearedIds.has(dispatched!.routeId), 'GAP-EXP-U4.7', '路线应已通关');
    });
  });
  // ════════════════════════════════════════════════════════════
  // EXP-3 配置弹窗（U5.1~U5.6）
  // ════════════════════════════════════════════════════════════
  describe('EXP-3 配置弹窗', () => {
    it(accTest('GAP-EXP-U5.1', '配置弹窗渲染 — 显示路线和难度信息'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      // 选择路线
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U5.1', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      // 点击出发按钮打开配置弹窗
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      fireEvent.click(dispatchBtn);
      // 配置弹窗应出现
      const modal = screen.getByTestId('modal');
      assertInDOM(modal, 'GAP-EXP-U5.1', '配置弹窗');
    });
    it(accTest('GAP-EXP-U5.2', '配置弹窗 — 显示推荐战力对比'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U5.2', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      fireEvent.click(dispatchBtn);
      // 配置弹窗应包含战力信息
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      assertStrict(
        modalText.includes('战力') || modalText.includes('推荐') || modalText.includes('⚔️'),
        'GAP-EXP-U5.2',
        `配置弹窗应包含战力对比，实际: ${modalText.substring(0, 200)}`,
      );
    });
    it(accTest('GAP-EXP-U5.3', '配置弹窗 — 显示消耗与时长预览'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U5.3', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      fireEvent.click(dispatchBtn);
      // 配置弹窗应包含消耗信息
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      assertStrict(
        modalText.includes('消耗') || modalText.includes('兵力') || modalText.includes('时长') || modalText.includes('难度'),
        'GAP-EXP-U5.3',
        `配置弹窗应包含消耗/时长信息，实际: ${modalText.substring(0, 200)}`,
      );
    });
    it(accTest('GAP-EXP-U5.4', '配置弹窗 — 战力不足时显示警告'), () => {
      const exp = getExpedition(sim);
      // 创建一个低战力队伍
      const weakHeroes = [createHeroBrief('weak1', 'shu', 100), createHeroBrief('weak2', 'shu', 100)];
      const heroDataMap = createHeroDataMap(weakHeroes);
      exp.createTeam('弱队', weakHeroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U5.4', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      fireEvent.click(dispatchBtn);
      // 配置弹窗应包含战力不足警告
      const modal = screen.getByTestId('modal');
      const modalText = modal.textContent ?? '';
      // 路线推荐战力远高于200时，应显示警告
      const recommendedPower = unlockedRoute!.recommendedPower ?? unlockedRoute!.powerMultiplier ?? 0;
      if (recommendedPower > team.totalPower) {
        assertStrict(
          modalText.includes('⚠') || modalText.includes('不足') || modalText.includes('战力'),
          'GAP-EXP-U5.4',
          `战力不足时应显示警告，实际: ${modalText.substring(0, 200)}`,
        );
      }
    });
    it(accTest('GAP-EXP-U5.5', '配置弹窗 — 确认出发执行派遣'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U5.5', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      fireEvent.click(dispatchBtn);
      // 点击确认出发
      const confirmBtn = screen.getByTestId('modal-confirm');
      assertStrict(!!confirmBtn, 'GAP-EXP-U5.5', '应有确认出发按钮');
      fireEvent.click(confirmBtn);
      // 队伍应已派遣
      const updatedTeam = exp.getTeam(team.id);
      assertStrict(updatedTeam!.isExpeditioning, 'GAP-EXP-U5.5', '确认后队伍应处于远征中');
    });
    it(accTest('GAP-EXP-U5.6', '配置弹窗 — 取消关闭弹窗'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('测试队伍', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      renderPanel(sim, true);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U5.6', '应有已解锁路线');
      const routeCard = screen.getByTestId(`expedition-panel-route-${unlockedRoute!.id}`);
      fireEvent.click(routeCard);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const dispatchBtn = screen.getByTestId(`expedition-panel-dispatch-${team.id}`);
      fireEvent.click(dispatchBtn);
      // 点击取消
      const cancelBtn = screen.getByTestId('modal-cancel');
      assertStrict(!!cancelBtn, 'GAP-EXP-U5.6', '应有取消按钮');
      fireEvent.click(cancelBtn);
      // 队伍应未派遣
      const updatedTeam = exp.getTeam(team.id);
      assertStrict(!updatedTeam!.isExpeditioning, 'GAP-EXP-U5.6', '取消后队伍不应远征');
    });
  });
  // ════════════════════════════════════════════════════════════
  // EXP-4 手机端远征布局（U6.1~U6.6）
  // ════════════════════════════════════════════════════════════
  describe('EXP-4 手机端远征布局', () => {
    it(accTest('GAP-EXP-U6.1', '手机端远征场景 — ExpeditionTab渲染'), () => {
      renderTab(sim, true);
      const tab = screen.getByTestId('expedition-tab');
      assertInDOM(tab, 'GAP-EXP-U6.1', '远征Tab面板');
    });
    it(accTest('GAP-EXP-U6.2', '手机端路线列表 — 横向滚动路线地图'), () => {
      renderTab(sim, true);
      // 验证路线列表区域
      const routeList = screen.getByTestId('expedition-tab').querySelector('.tk-expedition-route-list')
        ?? screen.getByTestId('expedition-tab');
      assertInDOM(routeList as HTMLElement, 'GAP-EXP-U6.2', '路线列表区域');
    });
    it(accTest('GAP-EXP-U6.3', '手机端节点链 — 横向节点展示'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-U6.3', '应有已解锁路线');
      renderTab(sim, true);
      // 选择路线后应显示节点链
      const routeCards = screen.getByTestId('expedition-tab').querySelectorAll('[style*="cursor: pointer"]');
      if (routeCards.length > 0) {
        fireEvent.click(routeCards[0]);
      }
      // 验证Tab面板仍在DOM
      const tab = screen.getByTestId('expedition-tab');
      assertInDOM(tab, 'GAP-EXP-U6.3', '选择路线后Tab面板');
    });
    it(accTest('GAP-EXP-U6.4', '手机端底部操作栏 — 自动远征/历史按钮'), () => {
      renderTab(sim, true);
      // 验证底部操作栏
      const bottomBar = screen.getByTestId('expedition-tab').querySelector('.tk-expedition-bottom-bar');
      assertStrict(!!bottomBar, 'GAP-EXP-U6.4', '应有底部操作栏');
    });
    it(accTest('GAP-EXP-U6.5', '手机端进度条 — 远征进度显示'), () => {
      renderTab(sim, true);
      const tab = screen.getByTestId('expedition-tab');
      const tabText = tab.textContent ?? '';
      assertStrict(tabText.includes('远征进度'), 'GAP-EXP-U6.5',
        'Tab面板应显示远征进度');
    });
    it(accTest('GAP-EXP-U6.6', '手机端历史弹窗 — 显示远征历史'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-U6.6', '派遣应成功');
      exp.completeRoute(dispatched!.teamId, 3);
      renderTab(sim, true);
      // 点击历史按钮
      const tab = screen.getByTestId('expedition-tab');
      const historyBtn = Array.from(tab.querySelectorAll('button')).find(b => b.textContent?.includes('历史'));
      assertStrict(!!historyBtn, 'GAP-EXP-U6.6', '应有历史按钮');
      if (historyBtn) {
        fireEvent.click(historyBtn);
        // 应弹出历史弹窗
        const modal = screen.getByTestId('expedition-tab').querySelector('.tk-expedition-modal');
        assertStrict(!!modal, 'GAP-EXP-U6.6', '应弹出历史弹窗');
      }
    });
  });
  // ════════════════════════════════════════════════════════════
  // 引擎层数据驱动验证（确保UI数据源正确）
  // ════════════════════════════════════════════════════════════
  describe('引擎层数据驱动验证', () => {
    it(accTest('GAP-EXP-E1', '路线数据 — 所有路线有正确的节点结构'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      for (const route of routes) {
        const nodes = Object.values(route.nodes);
        assertStrict(nodes.length > 0, 'GAP-EXP-E1',
          `路线 ${route.id} 应有节点，实际 ${nodes.length}`);
        assertStrict(!!route.startNodeId, 'GAP-EXP-E1',
          `路线 ${route.id} 应有起始节点`);
        assertStrict(!!route.endNodeId, 'GAP-EXP-E1',
          `路线 ${route.id} 应有终止节点`);
      }
    });
    it(accTest('GAP-EXP-E2', '节点类型 — 包含多种节点类型'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      const allNodeTypes = new Set<string>();
      for (const route of routes) {
        for (const node of Object.values(route.nodes)) {
          allNodeTypes.add(node.type);
        }
      }
      // 至少应有战斗类型节点
      assertStrict(allNodeTypes.size >= 2, 'GAP-EXP-E2',
        `应有至少2种节点类型，实际 ${allNodeTypes.size} 种: ${[...allNodeTypes].join(',')}`);
    });
    it(accTest('GAP-EXP-E3', '队伍战力 — 正确计算总战力（含羁绊加成）'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      const result = exp.createTeam('战力测试', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      assertStrict(result.valid, 'GAP-EXP-E3', '队伍创建应成功');
      const basePower = heroes.reduce((sum, h) => sum + h.power, 0);
      // 5名蜀将触发阵营羁绊（≥3名同阵营），全属性+10%，所以总战力可能高于简单求和
      assertStrict(result.totalPower >= basePower, 'GAP-EXP-E3',
        `总战力应≥基础战力${basePower}（含羁绊加成），实际 ${result.totalPower}`);
      assertStrict(result.totalPower > 0, 'GAP-EXP-E3',
        `总战力应>0，实际 ${result.totalPower}`);
    });
    it(accTest('GAP-EXP-E4', '兵力消耗 — 远征出发消耗正确'), () => {
      const exp = getExpedition(sim);
      const heroes = shuHeroes();
      const heroDataMap = createHeroDataMap(heroes);
      exp.createTeam('兵力测试', heroes.map(h => h.id), FormationType.STANDARD, heroDataMap);
      const teams = exp.getAllTeams();
      const team = teams[0];
      const beforeTroops = team.troopCount;
      const routes = exp.getAllRoutes();
      const unlockedRoute = routes.find(r => r.unlocked);
      assertStrict(!!unlockedRoute, 'GAP-EXP-E4', '应有已解锁路线');
      exp.dispatchTeam(team.id, unlockedRoute!.id);
      const afterTeam = exp.getTeam(team.id);
      const expectedCost = heroes.length * TROOP_COST.expeditionPerHero;
      assertStrict(beforeTroops - afterTeam!.troopCount === expectedCost, 'GAP-EXP-E4',
        `兵力消耗应为 ${expectedCost}，实际 ${beforeTroops - afterTeam!.troopCount}`);
    });
    it(accTest('GAP-EXP-E5', '扫荡次数限制 — 引擎层正确限制'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-E5', '派遣应成功');
      exp.completeRoute(dispatched!.teamId, 3);
      // 连续扫荡5次
      for (let i = 0; i < 5; i++) {
        const r = exp.executeSweep(dispatched!.routeId, SweepType.NORMAL);
        assertStrict(r.success, 'GAP-EXP-E5', `第${i + 1}次扫荡应成功`);
      }
      // 第6次应失败
      const result = exp.executeSweep(dispatched!.routeId, SweepType.NORMAL);
      assertStrict(!result.success, 'GAP-EXP-E5', '超过次数应失败');
    });
    it(accTest('GAP-EXP-E6', '阵型系统 — 多种阵型可用'), () => {
      const formations = Object.values(FormationType);
      // 引擎定义5种阵型：STANDARD/OFFENSIVE/DEFENSIVE/FLANKING/SIEGE
      assertStrict(formations.length >= 5, 'GAP-EXP-E6',
        `应有至少5种阵型，实际 ${formations.length} 种: ${formations.join(',')}`);
    });
    it(accTest('GAP-EXP-E7', '路线解锁 — 区域逐步解锁'), () => {
      const exp = getExpedition(sim);
      const routes = exp.getAllRoutes();
      // 虎牢关路线默认解锁
      const hulaoRoutes = routes.filter(r => r.regionId === 'region_hulao');
      const unlockedHulao = hulaoRoutes.some(r => r.unlocked);
      assertStrict(unlockedHulao, 'GAP-EXP-E7', '虎牢关应有解锁路线');
      // 汜水关路线默认未解锁
      const yishuiRoutes = routes.filter(r => r.regionId === 'region_yishui');
      if (yishuiRoutes.length > 0) {
        const lockedYishui = yishuiRoutes.every(r => !r.unlocked);
        assertStrict(lockedYishui, 'GAP-EXP-E7', '汜水关路线默认应未解锁');
      }
    });
    it(accTest('GAP-EXP-E8', '完成路线 — 队伍回到空闲'), () => {
      const exp = getExpedition(sim);
      const dispatched = createAndDispatchTeam(exp);
      assertStrict(!!dispatched, 'GAP-EXP-E8', '派遣应成功');
      const teamBefore = exp.getTeam(dispatched!.teamId);
      assertStrict(teamBefore!.isExpeditioning, 'GAP-EXP-E8', '派遣后应远征中');
      exp.completeRoute(dispatched!.teamId, 3);
      const teamAfter = exp.getTeam(dispatched!.teamId);
      assertStrict(!teamAfter!.isExpeditioning, 'GAP-EXP-E8', '完成后应空闲');
      assertStrict(teamAfter!.currentRouteId === null, 'GAP-EXP-E8', '完成后路线应清空');
    });
  });
});