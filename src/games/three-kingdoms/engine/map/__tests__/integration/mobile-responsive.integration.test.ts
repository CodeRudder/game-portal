/**
 * 集成测试 — 手机端适配 + 响应式布局
 *
 * 覆盖 Play 文档流程：
 *   §1.7  手机端战斗布局（375×667触摸优化）
 *   §11.1 地图系统手机端（双指缩放/Bottom Sheet/无小地图）
 *   §11.2 战斗系统手机端（全屏布局/技能按钮≥44px）
 *
 * 引擎层验证，不依赖 UI。
 * 本测试验证引擎层对手机端适配的数据支持能力。
 *
 * @module engine/map/__tests__/integration/mobile-responsive
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../WorldMapSystem';
import { MapDataRenderer } from '../../MapDataRenderer';
import { TerritorySystem } from '../../TerritorySystem';
import { SiegeSystem } from '../../SiegeSystem';
import { SiegeEnhancer } from '../../SiegeEnhancer';
import { GarrisonSystem } from '../../GarrisonSystem';
import {
  VIEWPORT_CONFIG,
  GRID_CONFIG,
  MAP_SIZE,
} from '../../../../core/map';
import type { ViewportState } from '../../../../core/map';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createFullDeps(): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('worldMap', mapSys);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);

  return deps;
}

/** 手机端视口尺寸 (375×667) */
const MOBILE_VIEWPORT: ViewportState = {
  offsetX: 0,
  offsetY: 0,
  zoom: 1.0,
};

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('集成测试: 手机端适配 (Play §1.7, §11.1-11.2)', () => {
  let deps: ISystemDeps;
  let sys: {
    map: WorldMapSystem;
    territory: TerritorySystem;
    siege: SiegeSystem;
    enhancer: SiegeEnhancer;
    garrison: GarrisonSystem;
  };

  beforeEach(() => {
    deps = createFullDeps();
    sys = {
      map: deps.registry.get<WorldMapSystem>('worldMap')!,
      territory: deps.registry.get<TerritorySystem>('territory')!,
      siege: deps.registry.get<SiegeSystem>('siege')!,
      enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
      garrison: deps.registry.get<GarrisonSystem>('garrison')!,
    };
  });

  // ── §11.1 地图系统手机端 ──────────────────────

  describe('§11.1 地图系统手机端', () => {
    it('视口缩放范围支持50%~200%', () => {
      const minZoom = VIEWPORT_CONFIG.minZoom;
      const maxZoom = VIEWPORT_CONFIG.maxZoom;

      expect(minZoom).toBeLessThanOrEqual(0.5);
      expect(maxZoom).toBeGreaterThanOrEqual(2.0);
    });

    it('手机端视口可设置缩放', () => {
      // 设置50%缩放
      sys.map.setZoom(0.5);
      expect(sys.map.getViewport().zoom).toBe(0.5);

      // 设置200%缩放
      sys.map.setZoom(2.0);
      expect(sys.map.getViewport().zoom).toBe(2.0);
    });

    it('缩放范围被正确约束', () => {
      sys.map.setZoom(0.1); // 低于最小值
      expect(sys.map.getViewport().zoom).toBeGreaterThanOrEqual(VIEWPORT_CONFIG.minZoom);

      sys.map.setZoom(5.0); // 高于最大值
      expect(sys.map.getViewport().zoom).toBeLessThanOrEqual(VIEWPORT_CONFIG.maxZoom);
    });

    it('视口平移支持拖拽操作', () => {
      sys.map.setViewportOffset(100, 200);
      const vp = sys.map.getViewport();
      expect(vp.offsetX).toBe(100);
      expect(vp.offsetY).toBe(200);

      // 拖拽偏移
      sys.map.panViewport(50, -30);
      const vp2 = sys.map.getViewport();
      expect(vp2.offsetX).toBe(150);
      expect(vp2.offsetY).toBe(170);
    });

    it('手机端视口渲染数据可正确计算', () => {
      const renderer = new MapDataRenderer();
      const tiles = sys.map.getAllTiles();
      const mobileViewport: ViewportState = {
        offsetX: 0,
        offsetY: 0,
        zoom: 1.0,
        width: 375,
        height: 667,
      };

      const renderData = renderer.computeViewportRenderData(tiles, mobileViewport);
      expect(renderData).toBeDefined();
      expect(renderData.tiles.length).toBeGreaterThan(0);
      expect(renderData.visibleRange).toBeDefined();
    });

    it('手机端缩小后可见范围更大', () => {
      const renderer = new MapDataRenderer();
      const tiles = sys.map.getAllTiles();

      const zoomIn: ViewportState = { offsetX: 0, offsetY: 0, zoom: 2.0, width: 375, height: 667 };
      const zoomOut: ViewportState = { offsetX: 0, offsetY: 0, zoom: 0.5, width: 375, height: 667 };

      const zoomInData = renderer.computeViewportRenderData(tiles, zoomIn);
      const zoomOutData = renderer.computeViewportRenderData(tiles, zoomOut);

      // 缩小后应看到更多格子
      expect(zoomOutData.tiles.length).toBeGreaterThan(zoomInData.tiles.length);
    });

    it('缩放<60%时视口数据仍可计算（产出气泡隐藏阈值）', () => {
      const renderer = new MapDataRenderer();
      const tiles = sys.map.getAllTiles();
      const lowZoom: ViewportState = { offsetX: 0, offsetY: 0, zoom: 0.5, width: 375, height: 667 };

      // 不应抛出异常
      const renderData = renderer.computeViewportRenderData(tiles, lowZoom);
      expect(renderData).toBeDefined();
      expect(renderData.tiles.length).toBeGreaterThan(0);
    });

    it('视口中心定位功能正常', () => {
      const renderer = new MapDataRenderer();
      const centered = renderer.centerOnPosition({ x: 10, y: 10 }, 1.0);
      expect(centered.zoom).toBe(1.0);
      expect(centered.offsetX).toBeDefined();
      expect(centered.offsetY).toBeDefined();
    });
  });

  // ── §11.2 战斗系统手机端 ──────────────────────

  describe('§11.2 战斗系统手机端', () => {
    it.skip('技能按钮尺寸≥44×44px（UI层验证，引擎无此概念）', () => {
      // TODO: 此为 UI 层验证，引擎层无按钮尺寸概念
      // 需在 UI 测试中验证
    });

    it.skip('大招时停期间按钮突出显示（UI层验证）', () => {
      // TODO: UI 层验证
    });

    it.skip('倍速切换按钮易触达（UI层验证）', () => {
      // TODO: UI 层验证
    });
  });

  // ── §1.7 手机端战斗布局 ──────────────────────

  describe('§1.7 手机端战斗布局', () => {
    it.skip('战斗全屏布局（UI层验证）', () => {
      // TODO: UI 层验证
    });

    it.skip('触摸优化（UI层验证）', () => {
      // TODO: UI 层验证
    });
  });

  // ── 手机端攻城确认弹窗 ──────────────────────

  describe('手机端攻城确认', () => {
    it('攻城条件在手机端同样可检查', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const result = sys.siege.checkSiegeConditions('city-xuchang', 'player', 10000, 10000);
      expect(result.canSiege).toBe(true);
    });

    it('胜率预估在手机端同样可计算', () => {
      const estimate = sys.enhancer.estimateWinRate(5000, 'city-xuchang');
      expect(estimate).not.toBeNull();
      expect(estimate!.winRate).toBeGreaterThanOrEqual(0);
      expect(estimate!.winRate).toBeLessThanOrEqual(1);
    });

    it('攻城消耗明细可在手机端显示', () => {
      const cost = sys.siege.getSiegeCostById('city-xuchang');
      expect(cost).not.toBeNull();
      expect(cost!.troops).toBeGreaterThan(0);
      expect(cost!.grain).toBe(500);
    });
  });

  // ── 手机端地图统计面板 ──────────────────────

  describe('手机端地图统计面板', () => {
    it('领土统计可查询', () => {
      sys.territory.captureTerritory('city-ye', 'player');
      const summary = sys.territory.getPlayerProductionSummary();
      expect(summary.totalTerritories).toBeGreaterThanOrEqual(1);
      expect(summary.totalProduction).toBeDefined();
    });

    it('攻城统计可查询', () => {
      const state = sys.siege.getState();
      expect(state.totalSieges).toBeDefined();
      expect(state.victories).toBeDefined();
      expect(state.defeats).toBeDefined();
    });
  });
});
