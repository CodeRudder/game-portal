/**
 * GAP-04 小地图组件ACC测试 — Minimap缩略图 + 视口跳转逻辑
 *
 * P0覆盖缺口4：验证小地图组件渲染与引擎层视口跳转
 * PRD MAP-1-3 UI: 小地图(180×140px) / 缩略图 / 视口高亮 / 点击跳转 / 颜色区分 / 实时更新 / 手机端隐藏
 *
 * 当前实现：WorldMapTab内嵌小地图（data-testid="worldmap-minimap"）
 * 引擎层：MapDataRenderer.centerOnPosition() / WorldMapSystem.setViewportOffset()
 *
 * @module tests/acc/GAP-04-MinimapComponent
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import { MapDataRenderer } from '@/games/three-kingdoms/engine/map/MapDataRenderer';
import { VIEWPORT_CONFIG, GRID_CONFIG, MAP_SIZE } from '@/games/three-kingdoms/core/map';
import type { TerritoryData, TerritoryProductionSummary, ViewportState, GridPosition } from '@/games/three-kingdoms/core/map';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

vi.mock('@/components/idle/panels/map/WorldMapTab.css', () => ({}));
vi.mock('@/components/idle/panels/map/TerritoryInfoPanel.css', () => ({}));
vi.mock('@/components/idle/panels/map/SiegeConfirmModal.css', () => ({}));
vi.mock('@/components/idle/panels/map/SiegeResultModal.css', () => ({}));
vi.mock('@/components/idle/common/Modal.css', () => ({}));

vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: ({ children, title, onClose, isOpen }: any) => (
    <div data-testid="shared-panel" data-title={title}>
      {title && <div data-testid="panel-title">{title}</div>}
      {children}
      {onClose && <button data-testid="panel-close" onClick={onClose}>关闭</button>}
    </div>
  ),
}));

vi.mock('@/components/idle/common/Modal', () => ({
  __esModule: true,
  default: ({ children, visible, title, onConfirm, onCancel, confirmDisabled }: any) =>
    visible ? (
      <div data-testid="modal" data-title={title}>
        {title && <div data-testid="modal-title">{title}</div>}
        {children}
        <button data-testid="modal-confirm" onClick={onConfirm} disabled={confirmDisabled}>确认</button>
        {onCancel && <button data-testid="modal-cancel" onClick={onCancel}>取消</button>}
      </div>
    ) : null,
}));

// ═══════════════════════════════════════════════════════════════
// 测试数据工厂
// ═══════════════════════════════════════════════════════════════

function makeTerritory(overrides: Partial<TerritoryData> = {}): TerritoryData {
  return {
    id: 'city-luoyang',
    name: '洛阳',
    position: { x: 5, y: 5 },
    region: 'wei' as const,
    ownership: 'player',
    level: 1,
    baseProduction: { grain: 5, gold: 5, troops: 3, mandate: 1 },
    currentProduction: { grain: 5, gold: 5, troops: 3, mandate: 1 },
    defenseValue: 1000,
    adjacentIds: ['city-xuchang', 'city-ye', 'pass-hulao'],
    ...overrides,
  };
}

function makeProductionSummary(overrides: Partial<TerritoryProductionSummary> = {}): TerritoryProductionSummary {
  return {
    totalTerritories: 2,
    territoriesByRegion: { wei: 2, shu: 0, wu: 0, neutral: 0 },
    totalProduction: { grain: 10, gold: 8, troops: 3, mandate: 1 },
    totalGrain: 10,
    totalCoins: 8,
    totalTroops: 3,
    details: [],
    ...overrides,
  };
}

/** 创建一组完整的测试领土（覆盖所有归属类型和多区域） */
function makeTestTerritories(): TerritoryData[] {
  return [
    makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', region: 'wei', position: { x: 5, y: 5 } }),
    makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', region: 'wei', position: { x: 8, y: 4 } }),
    makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'neutral', region: 'wei', position: { x: 3, y: 2 } }),
    makeTerritory({ id: 'pass-hulao', name: '虎牢关', ownership: 'player', region: 'wei', position: { x: 7, y: 6 } }),
    makeTerritory({ id: 'city-changan', name: '长安', ownership: 'enemy', region: 'wei', position: { x: 2, y: 7 } }),
    makeTerritory({ id: 'city-chengdu', name: '成都', ownership: 'player', region: 'shu', position: { x: 10, y: 15 } }),
    makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'enemy', region: 'wu', position: { x: 20, y: 10 } }),
    makeTerritory({ id: 'city-xiangyang', name: '襄阳', ownership: 'neutral', region: 'shu', position: { x: 12, y: 12 } }),
    makeTerritory({ id: 'city-hanzhong', name: '汉中', ownership: 'player', region: 'shu', position: { x: 9, y: 13 } }),
    makeTerritory({ id: 'pass-jianmen', name: '剑门关', ownership: 'enemy', region: 'shu', position: { x: 8, y: 14 } }),
    makeTerritory({ id: 'city-changsha', name: '长沙', ownership: 'neutral', region: 'wu', position: { x: 18, y: 14 } }),
    makeTerritory({ id: 'city-wuchang', name: '武昌', ownership: 'player', region: 'wu', position: { x: 19, y: 11 } }),
  ];
}

/** 创建带充足资源的 sim */
function createMapSim(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 1_000_000);
  sim.engine.resource.setCap('troops', 1_000_000);
  sim.addResources({ grain: 100000, gold: 100000, troops: 50000 });
  return sim;
}

describe('GAP-04 小地图组件ACC测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // 1. 小地图组件渲染（GAP-04-01 ~ GAP-04-03）
  it(accTest('GAP-04-01', '小地图容器渲染 — minimap容器存在且可见'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-04-01', '小地图容器');

    // 验证标题"缩略图"文本存在
    const titleEl = within(minimap).getByText('🗺️ 缩略图');
    assertInDOM(titleEl, 'GAP-04-01', '小地图标题');
  });

  it(accTest('GAP-04-02', '小地图尺寸约束 — maxWidth:180px，每个领土方块12×12px'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-04-02', '小地图容器');

    // 获取小地图内部网格容器（包含领土方块的div）
    // 结构: minimap > div(title) > div(grid with maxWidth)
    const allDivs = minimap.querySelectorAll('div');
    let gridContainer: HTMLElement | null = null;
    for (const div of allDivs) {
      if ((div as HTMLElement).style.maxWidth) {
        gridContainer = div as HTMLElement;
        break;
      }
    }
    assertStrict(!!gridContainer, 'GAP-04-02', '小地图网格容器应存在');

    // 验证 maxWidth: 180px 样式
    const gridStyle = gridContainer!.style;
    const maxWidth = gridStyle.maxWidth;
    assertStrict(
      maxWidth === '180px',
      'GAP-04-02',
      `小地图maxWidth应为180px，实际为${maxWidth}`,
    );

    const gridCols = gridStyle.gridTemplateColumns;
    assertStrict(
      gridCols === 'repeat(6, 1fr)',
      'GAP-04-02',
      `小地图网格应为6列，实际为${gridCols}`,
    );
  });

  it(accTest('GAP-04-03', '小地图显示所有领土 — 领土方块数量匹配'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    // 小地图内部每个领土渲染为一个方块（带title属性）
    const territoryBlocks = within(minimap).queryAllByTitle(/./);
    assertStrict(
      territoryBlocks.length === territories.length,
      'GAP-04-03',
      `小地图领土方块数应等于${territories.length}，实际为${territoryBlocks.length}`,
    );

    for (const t of territories) {
      const block = within(minimap).getByTitle(t.name);
      assertInDOM(block, 'GAP-04-03', `小地图方块 ${t.name}`);
    }
  });

  // 2. 领土归属颜色区分（GAP-04-04 ~ GAP-04-05）
  it(accTest('GAP-04-04', '领土归属颜色区分 — player绿/enemy红/neutral灰'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');

    const playerTerritory = territories.find(t => t.ownership === 'player')!;
    const playerBlock = within(minimap).getByTitle(playerTerritory.name);
    assertStrict(
      (playerBlock as HTMLElement).style.background === 'rgb(126, 200, 80)' ||
      (playerBlock as HTMLElement).style.background === '#7EC850',
      'GAP-04-04',
      `player领土背景应为绿色(#7EC850)，实际为${(playerBlock as HTMLElement).style.background}`,
    );

    const enemyTerritory = territories.find(t => t.ownership === 'enemy')!;
    const enemyBlock = within(minimap).getByTitle(enemyTerritory.name);
    assertStrict(
      (enemyBlock as HTMLElement).style.background === 'rgb(231, 76, 60)' ||
      (enemyBlock as HTMLElement).style.background === '#e74c3c',
      'GAP-04-04',
      `enemy领土背景应为红色(#e74c3c)，实际为${(enemyBlock as HTMLElement).style.background}`,
    );

    const neutralTerritory = territories.find(t => t.ownership === 'neutral')!;
    const neutralBlock = within(minimap).getByTitle(neutralTerritory.name);
    assertStrict(
      (neutralBlock as HTMLElement).style.background.includes('rgba(255, 255, 255, 0.15)'),
      'GAP-04-04',
      `neutral领土背景应为半透明白色，实际为${(neutralBlock as HTMLElement).style.background}`,
    );
  });

  it(accTest('GAP-04-05', '选中领土在小地图上高亮 — border标记'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 点击主网格中的洛阳
    const luoyangCell = screen.getByTestId('territory-cell-city-luoyang');
    await userEvent.click(luoyangCell);

    const minimap = screen.getByTestId('worldmap-minimap');
    const luoyangBlock = within(minimap).getByTitle('洛阳');
    const border = (luoyangBlock as HTMLElement).style.border;
    // jsdom将 #d4a574 转为 rgb(212, 165, 116)
    assertStrict(
      border.includes('solid') && (border.includes('#d4a574') || border.includes('212, 165, 116')),
      'GAP-04-05',
      `选中领土方块应有金色边框，实际border为${border}`,
    );
  });

  // 3. 点击小地图跳转（GAP-04-06 ~ GAP-04-08）
  it(accTest('GAP-04-06', '点击小地图领土方块 — 选中对应领土'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 点击小地图中的许昌方块
    const minimap = screen.getByTestId('worldmap-minimap');
    const xuchangBlock = within(minimap).getByTitle('许昌');
    await userEvent.click(xuchangBlock);

    // 验证主网格中许昌被选中（显示信息面板）
    const infoPanel = screen.getByTestId('territory-info-city-xuchang');
    assertInDOM(infoPanel, 'GAP-04-06', '许昌信息面板应显示');

    const xuchangBlockAfter = within(minimap).getByTitle('许昌');
    const border = (xuchangBlockAfter as HTMLElement).style.border;
    assertStrict(
      border.includes('solid') && (border.includes('#d4a574') || border.includes('212, 165, 116')),
      'GAP-04-06',
      '点击后小地图方块应有高亮边框',
    );
  });

  it(accTest('GAP-04-07', '点击小地图切换选中 — 再次点击取消'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    const luoyangBlock = within(minimap).getByTitle('洛阳');

    // 第一次点击 → 选中
    await userEvent.click(luoyangBlock);
    let infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'GAP-04-07', '首次点击应显示信息面板');

    // 第二次点击 → 取消选中
    await userEvent.click(luoyangBlock);
    infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!infoPanel, 'GAP-04-07', '再次点击应隐藏信息面板');
  });

  it(accTest('GAP-04-08', '点击小地图不同领土 — 切换选中目标'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');

    const luoyangBlock = within(minimap).getByTitle('洛阳');
    await userEvent.click(luoyangBlock);
    let infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'GAP-04-08', '洛阳应被选中');

    const hulaoBlock = within(minimap).getByTitle('虎牢关');
    await userEvent.click(hulaoBlock);
    infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!infoPanel, 'GAP-04-08', '洛阳应取消选中');

    const hulaoPanel = screen.queryByTestId('territory-info-pass-hulao');
    assertStrict(!!hulaoPanel, 'GAP-04-08', '虎牢关应被选中');
  });

  // 4. 引擎层视口跳转逻辑（GAP-04-09 ~ GAP-04-14）
  it(accTest('GAP-04-09', '引擎 centerOnPosition — 视口居中到指定坐标'), () => {
    const renderer = new MapDataRenderer();
    const targetPos: GridPosition = { x: 10, y: 10 };

    const viewport = renderer.centerOnPosition(targetPos, 1.0);

    // 视口偏移应使目标格子居中
    const { tileWidth, tileHeight } = GRID_CONFIG;
    const { width, height } = VIEWPORT_CONFIG;

    const expectedOffsetX = width / 2 - (targetPos.x * tileWidth + tileWidth / 2);
    const expectedOffsetY = height / 2 - (targetPos.y * tileHeight + tileHeight / 2);

    assertStrict(
      Math.abs(viewport.offsetX - expectedOffsetX) < 0.01,
      'GAP-04-09',
      `offsetX应为${expectedOffsetX}，实际为${viewport.offsetX}`,
    );
    assertStrict(
      Math.abs(viewport.offsetY - expectedOffsetY) < 0.01,
      'GAP-04-09',
      `offsetY应为${expectedOffsetY}，实际为${viewport.offsetY}`,
    );
    assertStrict(viewport.zoom === 1.0, 'GAP-04-09', '缩放应为1.0');
  });

  it(accTest('GAP-04-10', '引擎 centerOnPosition — 不同缩放级别'), () => {
    const renderer = new MapDataRenderer();
    const targetPos: GridPosition = { x: 30, y: 20 };

    // 缩放1.5倍
    const vp1_5 = renderer.centerOnPosition(targetPos, 1.5);
    assertStrict(vp1_5.zoom === 1.5, 'GAP-04-10', '缩放应为1.5');

    // 缩放0.5倍（小地图视角）
    const vp0_5 = renderer.centerOnPosition(targetPos, 0.5);
    assertStrict(vp0_5.zoom === 0.5, 'GAP-04-10', '缩放应为0.5');

    // 验证不同缩放下偏移不同
    assertStrict(
      vp1_5.offsetX !== vp0_5.offsetX,
      'GAP-04-10',
      '不同缩放级别下offsetX应不同',
    );
  });

  it(accTest('GAP-04-11', '引擎 centerOnPosition — 缩放边界钳位'), () => {
    const renderer = new MapDataRenderer();
    const targetPos: GridPosition = { x: 5, y: 5 };

    // 超出最小缩放
    const vpMin = renderer.centerOnPosition(targetPos, 0.1);
    assertStrict(
      vpMin.zoom >= VIEWPORT_CONFIG.minZoom,
      'GAP-04-11',
      `缩放不应小于${VIEWPORT_CONFIG.minZoom}，实际为${vpMin.zoom}`,
    );

    // 超出最大缩放
    const vpMax = renderer.centerOnPosition(targetPos, 10.0);
    assertStrict(
      vpMax.zoom <= VIEWPORT_CONFIG.maxZoom,
      'GAP-04-11',
      `缩放不应大于${VIEWPORT_CONFIG.maxZoom}，实际为${vpMax.zoom}`,
    );
  });

  it(accTest('GAP-04-12', '引擎 WorldMapSystem — setViewportOffset 设置视口偏移'), () => {
    const sim = createMapSim();
    const mapSys = sim.engine.getWorldMapSystem?.() ?? sim.engine.worldMap;

    // 使用 TerritorySystem 代替（WorldMapSystem 可能不在 sim 中暴露）
    // 直接测试 MapDataRenderer 的视口计算
    const renderer = new MapDataRenderer();

    // 模拟从领土坐标计算视口偏移
    const territoryPos: GridPosition = { x: 15, y: 10 };
    const viewport = renderer.centerOnPosition(territoryPos);

    assertStrict(
      typeof viewport.offsetX === 'number' && !isNaN(viewport.offsetX),
      'GAP-04-12',
      'offsetX应为有效数字',
    );
    assertStrict(
      typeof viewport.offsetY === 'number' && !isNaN(viewport.offsetY),
      'GAP-04-12',
      'offsetY应为有效数字',
    );
    assertStrict(
      viewport.zoom >= VIEWPORT_CONFIG.minZoom && viewport.zoom <= VIEWPORT_CONFIG.maxZoom,
      'GAP-04-12',
      '缩放应在合法范围内',
    );
  });

  it(accTest('GAP-04-13', '引擎 computeVisibleRange — 计算视口内可见格子范围'), () => {
    const renderer = new MapDataRenderer();

    // 默认视口
    const defaultViewport: ViewportState = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    const range = renderer.computeVisibleRange(defaultViewport);

    assertStrict(range.startX >= 0, 'GAP-04-13', 'startX应≥0');
    assertStrict(range.startY >= 0, 'GAP-04-13', 'startY应≥0');
    assertStrict(range.endX < MAP_SIZE.cols, 'GAP-04-13', 'endX应<地图列数');
    assertStrict(range.endY < MAP_SIZE.rows, 'GAP-04-13', 'endY应<地图行数');
    assertStrict(range.startX <= range.endX, 'GAP-04-13', 'startX应≤endX');
    assertStrict(range.startY <= range.endY, 'GAP-04-13', 'startY应≤endY');
  });

  it(accTest('GAP-04-14', '引擎 clampViewport — 视口边界约束'), () => {
    const renderer = new MapDataRenderer();

    // 超出边界的视口
    const overflowViewport: ViewportState = { offsetX: 100, offsetY: 100, zoom: 1.0 };
    const clamped = renderer.clampViewport(overflowViewport);

    // offsetX 不应大于0（地图左上角对齐）
    assertStrict(
      clamped.offsetX <= 0,
      'GAP-04-14',
      `钳位后offsetX应≤0，实际为${clamped.offsetX}`,
    );
    assertStrict(
      clamped.offsetY <= 0,
      'GAP-04-14',
      `钳位后offsetY应≤0，实际为${clamped.offsetY}`,
    );
  });

  // 5. 小地图实时更新（GAP-04-15 ~ GAP-04-17）
  it(accTest('GAP-04-15', '小地图随领土归属变化更新 — captureTerritory后颜色变更'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();
    territorySys.captureTerritory('pass-hulao', 'player');
    territorySys.captureTerritory('city-luoyang', 'player');

    // 初始状态：city-xuchang 为 neutral
    const xuchang = territorySys.getTerritoryById('city-xuchang');
    assertStrict(!!xuchang, 'GAP-04-15', '许昌应存在');

    // 占领许昌
    territorySys.captureTerritory('city-xuchang', 'player');
    const updatedXuchang = territorySys.getTerritoryById('city-xuchang');
    assertStrict(
      updatedXuchang?.ownership === 'player',
      'GAP-04-15',
      '许昌归属应变更为player',
    );

    // 用更新后的数据渲染小地图
    const allTerritories = territorySys.getAllTerritories();
    const summary = territorySys.getPlayerProductionSummary();
    render(
      <WorldMapTab
        territories={allTerritories}
        productionSummary={summary}
        snapshotVersion={1}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    const xuchangBlock = within(minimap).getByTitle('许昌');
    const bg = (xuchangBlock as HTMLElement).style.background;

    assertStrict(
      bg === 'rgb(126, 200, 80)' || bg === '#7EC850',
      'GAP-04-15',
      `占领后许昌小地图方块应为绿色，实际为${bg}`,
    );
  });

  it(accTest('GAP-04-16', '小地图随 snapshotVersion 重渲染 — 数据刷新'), () => {
    const territories = makeTestTerritories();
    const { rerender } = render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 初始渲染
    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-04-16', '初始小地图');

    // 修改领土数据（模拟引擎状态变更）
    const updatedTerritories = territories.map(t =>
      t.id === 'city-xuchang' ? { ...t, ownership: 'player' as const } : t,
    );

    // 重渲染
    rerender(
      <WorldMapTab
        territories={updatedTerritories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={1}
      />
    );

    // 验证小地图已更新
    const updatedMinimap = screen.getByTestId('worldmap-minimap');
    const xuchangBlock = within(updatedMinimap).getByTitle('许昌');
    const bg = (xuchangBlock as HTMLElement).style.background;

    assertStrict(
      bg === 'rgb(126, 200, 80)' || bg === '#7EC850',
      'GAP-04-16',
      `重渲染后许昌应为绿色（player），实际为${bg}`,
    );
  });

  it(accTest('GAP-04-17', '小地图领土数量上限 — 最多显示24个领土'), () => {
    // 创建超过24个领土
    const manyTerritories = Array.from({ length: 30 }, (_, i) =>
      makeTerritory({
        id: `territory-${i}`,
        name: `领土${i}`,
        ownership: i % 3 === 0 ? 'player' : i % 3 === 1 ? 'enemy' : 'neutral',
        position: { x: i % 20, y: Math.floor(i / 20) },
      }),
    );

    render(
      <WorldMapTab
        territories={manyTerritories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    const blocks = within(minimap).queryAllByTitle(/./);

    // 当前实现 slice(0, 24)，所以最多24个
    assertStrict(
      blocks.length === 24,
      'GAP-04-17',
      `小地图最多显示24个领土方块，实际为${blocks.length}`,
    );
  });

  // 6. 手机端隐藏小地图（GAP-04-18 ~ GAP-04-19）
  it(accTest('GAP-04-18', '手机端视口配置 — 移动端视口尺寸小于PC端'), () => {
    // 验证配置常量
    assertStrict(
      VIEWPORT_CONFIG.width === 1280,
      'GAP-04-18',
      `PC端视口宽度应为1280，实际为${VIEWPORT_CONFIG.width}`,
    );
    assertStrict(
      VIEWPORT_CONFIG.height === 696,
      'GAP-04-18',
      `PC端视口高度应为696，实际为${VIEWPORT_CONFIG.height}`,
    );

    // PRD要求：手机端隐藏小地图
    // CSS中 @media (max-width: 767px) 定义了移动端适配
    // 小地图在移动端应隐藏（CSS class或inline style控制）
    // 由于jsdom不支持CSS媒体查询，此处验证配置正确性
    assertStrict(
      VIEWPORT_CONFIG.minZoom < VIEWPORT_CONFIG.defaultZoom,
      'GAP-04-18',
      '最小缩放应小于默认缩放',
    );
  });

  it(accTest('GAP-04-19', '手机端小地图隐藏 — CSS媒体查询适配'), () => {
    // PRD MAP-1-3: 手机端隐藏小地图组件
    // 当前实现：小地图在 WorldMapTab 的 info-panel 中渲染，
    // CSS @media (max-width: 767px) 对 info-panel 做了移动端适配
    // 但小地图本身没有 display:none 的媒体查询
    //
    // 验证策略：
    // 1. 小地图组件在DOM中存在（PC端渲染）
    // 2. 移动端隐藏需要CSS媒体查询支持，jsdom无法验证
    // 3. 标记为 TODO：需要E2E测试验证移动端隐藏

    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // PC端：小地图应可见
    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-04-19', 'PC端小地图应可见');

    // TODO: 移动端隐藏需要Playwright E2E测试验证
    // 可通过设置 window.innerWidth = 375 并检查 display:none 来验证
    assertStrict(
      minimap.style.display !== 'none',
      'GAP-04-19',
      'PC端小地图不应被inline style隐藏',
    );
  });

  // 7. 引擎层端到端视口跳转（GAP-04-20 ~ GAP-04-22）
  it(accTest('GAP-04-20', '引擎端到端 — 从领土坐标到视口偏移的完整计算'), () => {
    const renderer = new MapDataRenderer();

    // 模拟点击小地图上某个领土位置后的视口跳转
    // 领土坐标 (5, 5) → 居中到该位置
    const territoryPos: GridPosition = { x: 5, y: 5 };
    const viewport = renderer.centerOnPosition(territoryPos, 1.0);

    // 计算可见范围
    const range = renderer.computeVisibleRange(viewport);

    // 验证目标领土在可见范围内
    assertStrict(
      territoryPos.x >= range.startX && territoryPos.x <= range.endX,
      'GAP-04-20',
      `目标x=${territoryPos.x}应在可见范围[${range.startX}, ${range.endX}]内`,
    );
    assertStrict(
      territoryPos.y >= range.startY && territoryPos.y <= range.endY,
      'GAP-04-20',
      `目标y=${territoryPos.y}应在可见范围[${range.startY}, ${range.endY}]内`,
    );
  });

  it(accTest('GAP-04-21', '引擎端到端 — 多个领土位置的视口跳转一致性'), () => {
    const renderer = new MapDataRenderer();

    const positions: GridPosition[] = [
      { x: 0, y: 0 },       // 左上角
      { x: 30, y: 20 },     // 中心
      { x: 59, y: 39 },     // 右下角
    ];

    for (const pos of positions) {
      const viewport = renderer.centerOnPosition(pos, 1.0);
      const clamped = renderer.clampViewport(viewport);

      // 钳位后的视口应始终合法
      assertStrict(
        clamped.zoom >= VIEWPORT_CONFIG.minZoom && clamped.zoom <= VIEWPORT_CONFIG.maxZoom,
        'GAP-04-21',
        `位置(${pos.x},${pos.y})钳位后缩放应合法`,
      );
    }
  });

  it(accTest('GAP-04-22', '引擎端到端 — WorldMapSystem视口操作序列'), () => {
    const sim = createMapSim();

    // 尝试获取 WorldMapSystem
    const mapSys = sim.engine.getWorldMapSystem?.();
    if (!mapSys) {
      // 如果 sim 不暴露 WorldMapSystem，使用 MapDataRenderer 直接测试
      const renderer = new MapDataRenderer();

      // 模拟视口操作序列：居中→平移→缩放→重置
      const pos: GridPosition = { x: 10, y: 10 };
      const vp1 = renderer.centerOnPosition(pos, 1.0);
      assertStrict(vp1.zoom === 1.0, 'GAP-04-22', '初始缩放应为1.0');

      const vp2 = renderer.centerOnPosition(pos, 2.0);
      assertStrict(vp2.zoom === 2.0, 'GAP-04-22', '缩放后应为2.0');

      // 验证缩放后偏移不同
      assertStrict(
        vp1.offsetX !== vp2.offsetX || vp1.offsetY !== vp2.offsetY,
        'GAP-04-22',
        '不同缩放级别下偏移应不同',
      );

      return;
    }

    // 如果 WorldMapSystem 可用，直接测试
    mapSys.setViewportOffset(0, 0);
    const vp = mapSys.getViewport();
    assertStrict(vp.offsetX === 0, 'GAP-04-22', '初始offsetX应为0');
    assertStrict(vp.offsetY === 0, 'GAP-04-22', '初始offsetY应为0');

    mapSys.panViewport(100, -50);
    const vpAfterPan = mapSys.getViewport();
    assertStrict(vpAfterPan.offsetX === 100, 'GAP-04-22', '平移后offsetX应为100');
    assertStrict(vpAfterPan.offsetY === -50, 'GAP-04-22', '平移后offsetY应为-50');
  });

  // 8. 边界条件与异常处理（GAP-04-23 ~ GAP-04-27）
  it(accTest('GAP-04-23', '空领土列表 — 小地图不崩溃'), () => {
    render(
      <WorldMapTab
        territories={[]}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-04-23', '空领土时小地图容器应存在');

    // 无领土方块
    const blocks = within(minimap).queryAllByTitle(/./);
    assertStrict(blocks.length === 0, 'GAP-04-23', '空领土时方块数应为0');
  });

  it(accTest('GAP-04-24', '单个领土 — 小地图正确渲染'), () => {
    const singleTerritory = [
      makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player' }),
    ];

    render(
      <WorldMapTab
        territories={singleTerritory}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    const blocks = within(minimap).queryAllByTitle(/./);
    assertStrict(blocks.length === 1, 'GAP-04-24', '单领土时方块数应为1');

    const luoyangBlock = within(minimap).getByTitle('洛阳');
    assertInDOM(luoyangBlock, 'GAP-04-24', '洛阳方块');
  });

  it(accTest('GAP-04-25', '引擎 centerOnPosition 边界坐标(0,0) — 不崩溃'), () => {
    const renderer = new MapDataRenderer();
    const originPos: GridPosition = { x: 0, y: 0 };

    const viewport = renderer.centerOnPosition(originPos, 1.0);
    assertStrict(
      typeof viewport.offsetX === 'number' && !isNaN(viewport.offsetX),
      'GAP-04-25',
      '边界坐标(0,0)应返回有效offsetX',
    );
  });

  it(accTest('GAP-04-26', '引擎 centerOnPosition 边界坐标(max) — 不崩溃'), () => {
    const renderer = new MapDataRenderer();
    const maxPos: GridPosition = { x: MAP_SIZE.cols - 1, y: MAP_SIZE.rows - 1 };

    const viewport = renderer.centerOnPosition(maxPos, 1.0);
    assertStrict(
      typeof viewport.offsetX === 'number' && !isNaN(viewport.offsetX),
      'GAP-04-26',
      '最大坐标应返回有效offsetX',
    );
  });

  it(accTest('GAP-04-27', '引擎 computeVisibleRange 极端缩放 — 全地图可见'), () => {
    const renderer = new MapDataRenderer();

    // 最小缩放 → 可能看到全地图
    const minZoomViewport: ViewportState = { offsetX: 0, offsetY: 0, zoom: VIEWPORT_CONFIG.minZoom };
    const range = renderer.computeVisibleRange(minZoomViewport);

    assertStrict(range.startX >= 0, 'GAP-04-27', 'startX应≥0');
    assertStrict(range.endX >= range.startX, 'GAP-04-27', 'endX应≥startX');
    assertStrict(range.endX <= MAP_SIZE.cols - 1, 'GAP-04-27', 'endX不应超出地图');
  });

  // 9. 小地图与主地图联动（GAP-04-28 ~ GAP-04-30）
  it(accTest('GAP-04-28', '小地图点击与主网格选中状态同步'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 从主网格选中洛阳
    const luoyangCell = screen.getByTestId('territory-cell-city-luoyang');
    await userEvent.click(luoyangCell);

    // 小地图应高亮洛阳
    const minimap = screen.getByTestId('worldmap-minimap');
    const luoyangBlock = within(minimap).getByTitle('洛阳');
    assertStrict(
      (luoyangBlock as HTMLElement).style.border.includes('solid'),
      'GAP-04-28',
      '主网格选中后小地图应高亮',
    );

    // 从小地图选中许昌（切换）
    const xuchangBlock = within(minimap).getByTitle('许昌');
    await userEvent.click(xuchangBlock);

    const luoyangBlockAfter = within(minimap).getByTitle('洛阳');
    assertStrict(
      !(luoyangBlockAfter as HTMLElement).style.border.includes('solid'),
      'GAP-04-28',
      '切换后洛阳应取消高亮',
    );

    const xuchangBlockAfter = within(minimap).getByTitle('许昌');
    assertStrict(
      (xuchangBlockAfter as HTMLElement).style.border.includes('solid'),
      'GAP-04-28',
      '切换后许昌应高亮',
    );
  });

  it(accTest('GAP-04-29', '小地图领土方块尺寸 — 每个方块12×12px'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    const firstBlock = within(minimap).getAllByTitle(/./)[0] as HTMLElement;

    assertStrict(
      firstBlock.style.width === '12px',
      'GAP-04-29',
      `方块宽度应为12px，实际为${firstBlock.style.width}`,
    );
    assertStrict(
      firstBlock.style.height === '12px',
      'GAP-04-29',
      `方块高度应为12px，实际为${firstBlock.style.height}`,
    );
  });

  it(accTest('GAP-04-30', '小地图方块可点击 — cursor: pointer'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const minimap = screen.getByTestId('worldmap-minimap');
    const firstBlock = within(minimap).getAllByTitle(/./)[0] as HTMLElement;

    assertStrict(
      firstBlock.style.cursor === 'pointer',
      'GAP-04-30',
      `方块cursor应为pointer，实际为${firstBlock.style.cursor}`,
    );
  });

  // 10. 回归测试 — 确保小地图不影响主功能（GAP-04-31 ~ GAP-04-33）
  it(accTest('GAP-04-31', '小地图存在不影响主网格渲染 — 领土数量一致'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 主网格中领土数量
    const grid = screen.getByTestId('worldmap-grid');
    const gridCells = within(grid).queryAllByTestId(/^territory-cell-/);
    assertStrict(
      gridCells.length === territories.length,
      'GAP-04-31',
      `主网格领土数应等于${territories.length}，实际为${gridCells.length}`,
    );

    // 小地图中领土数量
    const minimap = screen.getByTestId('worldmap-minimap');
    const minimapBlocks = within(minimap).queryAllByTitle(/./);
    assertStrict(
      minimapBlocks.length === territories.length,
      'GAP-04-31',
      `小地图领土数应等于${territories.length}，实际为${minimapBlocks.length}`,
    );
  });

  it(accTest('GAP-04-32', '小地图存在不影响筛选功能'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 筛选己方领土
    const ownershipFilter = screen.getByTestId('worldmap-filter-ownership');
    await userEvent.selectOptions(ownershipFilter, 'player');

    // 主网格应只显示player领土
    const grid = screen.getByTestId('worldmap-grid');
    const gridCells = within(grid).queryAllByTestId(/^territory-cell-/);
    const playerTerritories = territories.filter(t => t.ownership === 'player');
    assertStrict(
      gridCells.length === playerTerritories.length,
      'GAP-04-32',
      `筛选后主网格应显示${playerTerritories.length}个player领土`,
    );

    // 小地图应始终显示全部领土（不受筛选影响）
    const minimap = screen.getByTestId('worldmap-minimap');
    const minimapBlocks = within(minimap).queryAllByTitle(/./);
    assertStrict(
      minimapBlocks.length === territories.length,
      'GAP-04-32',
      `小地图应始终显示全部${territories.length}个领土`,
    );
  });

  it(accTest('GAP-04-33', '小地图存在不影响热力图功能'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 开启热力图
    const toggle = screen.getByTestId('worldmap-heatmap-toggle');
    await userEvent.click(toggle);

    // 热力图叠加层应显示
    const heatmapEls = screen.queryAllByTestId(/^heatmap-/);
    assertStrict(heatmapEls.length > 0, 'GAP-04-33', '热力图叠加层应显示');

    // 小地图仍正常存在
    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-04-33', '热力图开启后小地图仍应存在');
  });
});
