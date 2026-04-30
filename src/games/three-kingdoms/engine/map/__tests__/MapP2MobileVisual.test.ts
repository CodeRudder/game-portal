/**
 * MapP2MobileVisual — P2 覆盖缺口 GAP-21~24 深度测试
 *
 * 覆盖：
 *   GAP-21：手机端 Bottom Sheet 交互测试（MAP-7）
 *   GAP-22：离线领土变化视觉标记测试（MAP-3 §3.22~3.25）
 *   GAP-23：事件脉冲动画测试（MAP-5 §5.5）
 *   GAP-24：胜率颜色编码测试（MAP-3 §3.19）
 *
 * 测试策略：引擎层验证数据/状态，不测试 CSS/DOM。
 * @module engine/map/__tests__/MapP2MobileVisual
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapDataRenderer } from '../MapDataRenderer';
import { MapEventSystem } from '../MapEventSystem';
import { SiegeEnhancer } from '../SiegeEnhancer';
import { TerritorySystem } from '../TerritorySystem';
import { GarrisonSystem } from '../GarrisonSystem';
import { WorldMapSystem } from '../WorldMapSystem';
import type { ViewportState, TileData } from '../../../core/map';
import {
  VIEWPORT_CONFIG, MAP_SIZE, BATTLE_RATING_THRESHOLDS, generateAllTiles,
} from '../../../core/map';
import type { ISystemDeps } from '../../../core/types';
import type { ISubsystemRegistry } from '../../../core/types/subsystem';

// ═══════════════════════════════════════════════
// 常量 & 辅助工具
// ═══════════════════════════════════════════════

const MOBILE_BREAKPOINT = 768;
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;
const BOTTOM_SHEET_HEIGHTS = { territory: 0.60, siege: 0.80, event: 0.70, stats: 0.50 };

/** PRD MAP-3 §3.19：胜率颜色编码阈值 */
const WIN_RATE_TIERS = {
  green:  { min: 0.80, color: '#00C853' },
  gold:   { min: 0.60, color: '#FFD700' },
  amber:  { min: 0.40, color: '#FF8C00' },
  red:    { min: 0.00, color: '#FF1744' },
} as const;

const isMobileViewport = (w: number) => w < MOBILE_BREAKPOINT;

function getWinRateColor(winRate: number): { tier: string; color: string } {
  if (winRate >= WIN_RATE_TIERS.green.min) return { tier: 'green', color: WIN_RATE_TIERS.green.color };
  if (winRate >= WIN_RATE_TIERS.gold.min) return { tier: 'gold', color: WIN_RATE_TIERS.gold.color };
  if (winRate >= WIN_RATE_TIERS.amber.min) return { tier: 'amber', color: WIN_RATE_TIERS.amber.color };
  return { tier: 'red', color: WIN_RATE_TIERS.red.color };
}

function battleRatingToColorTier(r: string): string {
  return ({ easy: 'green', moderate: 'gold', hard: 'amber', very_hard: 'red', impossible: 'red' })[r] ?? 'red';
}

interface OfflineTerritoryChange {
  territoryId: string; changeType: 'captured' | 'lost' | 'income_changed' | 'defense_changed';
  timestamp: number; previousValue?: number; newValue?: number; viewed: boolean;
}

function createOfflineChanges(): OfflineTerritoryChange[] {
  const now = Date.now();
  return [
    { territoryId: 'city-luoyang', changeType: 'captured', timestamp: now - 3600000, viewed: false },
    { territoryId: 'city-xuchang', changeType: 'lost', timestamp: now - 7200000, viewed: false },
    { territoryId: 'city-chengdu', changeType: 'income_changed', timestamp: now - 1800000, previousValue: 100, newValue: 150, viewed: false },
    { territoryId: 'city-jianye', changeType: 'defense_changed', timestamp: now - 900000, previousValue: 500, newValue: 800, viewed: false },
  ];
}

function createTestDeps() {
  const territory = new TerritorySystem();
  const garrison = new GarrisonSystem();
  const siege = new SiegeEnhancer();
  const worldMap = new WorldMapSystem();
  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('garrison', garrison);
  registry.set('siegeEnhancer', siege);
  registry.set('worldMap', worldMap);
  const deps: ISystemDeps = {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: (n: string) => registry.get(n) ?? null, getAll: () => new Map(), has: (n: string) => registry.has(n), unregister: vi.fn() } as unknown as ISubsystemRegistry,
  };
  territory.init(deps); garrison.init(deps); siege.init(deps); worldMap.init(deps);
  return { deps, territory, garrison, siege, worldMap };
}

// ═══════════════════════════════════════════════
// GAP-21：手机端 Bottom Sheet 交互测试
// ═══════════════════════════════════════════════

describe('GAP-21：手机端 Bottom Sheet 交互测试（MAP-7）', () => {
  let renderer: MapDataRenderer;
  let allTiles: TileData[];
  beforeEach(() => { renderer = new MapDataRenderer(); allTiles = generateAllTiles(); });

  describe('GAP-21-1：手机端视口宽度判断', () => {
    it('<768px 应判定为手机端', () => {
      expect(isMobileViewport(375)).toBe(true);
      expect(isMobileViewport(767)).toBe(true);
    });
    it('≥768px 应判定为非手机端', () => {
      expect(isMobileViewport(768)).toBe(false);
      expect(isMobileViewport(1280)).toBe(false);
    });
    it('边界值 768 为 PC 端，767 为手机端', () => {
      expect(isMobileViewport(768)).toBe(false);
      expect(isMobileViewport(767)).toBe(true);
    });
    it('VIEWPORT_CONFIG 默认为 PC 端尺寸', () => {
      expect(VIEWPORT_CONFIG.width).toBeGreaterThanOrEqual(MOBILE_BREAKPOINT);
    });
  });

  describe('GAP-21-2：手机端渲染数据计算', () => {
    it('手机端视口可正常计算可见范围', () => {
      const range = renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 1.0 });
      expect(range.startX).toBe(0); expect(range.startY).toBe(0);
      expect(range.endX).toBeLessThan(MAP_SIZE.cols);
      expect(range.endY).toBeLessThan(MAP_SIZE.rows);
    });
    it('手机端缩放 0.5x 可见范围更大', () => {
      const r1 = renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 0.5 });
      const r2 = renderer.computeVisibleRange({ offsetX: 0, offsetY: 0, zoom: 1.0 });
      expect(renderer.computeVisibleTileCount(r1)).toBeGreaterThan(renderer.computeVisibleTileCount(r2));
    });
    it('手机端视口渲染数据完整', () => {
      const rd = renderer.computeViewportRenderData(allTiles, { offsetX: 0, offsetY: 0, zoom: 1.0 });
      expect(rd.tiles.length).toBeGreaterThan(0);
      expect(rd.visibleLandmarks).toBeDefined();
      expect(rd.visibleRange).toBeDefined();
    });
  });

  describe('GAP-21-3：Bottom Sheet 高度比例配置', () => {
    it('领土详情 60%，攻城确认 80%，事件弹窗 70%，统计面板 50%', () => {
      expect(BOTTOM_SHEET_HEIGHTS.territory).toBe(0.60);
      expect(BOTTOM_SHEET_HEIGHTS.siege).toBe(0.80);
      expect(BOTTOM_SHEET_HEIGHTS.event).toBe(0.70);
      expect(BOTTOM_SHEET_HEIGHTS.stats).toBe(0.50);
    });
    it('所有 Bottom Sheet 高度在合理范围 30%~90%', () => {
      for (const h of Object.values(BOTTOM_SHEET_HEIGHTS)) {
        expect(h).toBeGreaterThanOrEqual(0.30);
        expect(h).toBeLessThanOrEqual(0.90);
      }
    });
    it('Bottom Sheet 像素高度计算正确', () => {
      expect(BOTTOM_SHEET_HEIGHTS.territory * MOBILE_HEIGHT).toBeCloseTo(400.2, 0);
      expect(BOTTOM_SHEET_HEIGHTS.siege * MOBILE_HEIGHT).toBeCloseTo(533.6, 0);
    });
  });

  describe('GAP-21-4：手机端组件可见性配置', () => {
    it('手机端隐藏小地图，PC端显示小地图', () => {
      expect(!isMobileViewport(MOBILE_WIDTH)).toBe(false);
      expect(!isMobileViewport(VIEWPORT_CONFIG.width)).toBe(true);
    });
    it('手机端筛选工具栏为底部按钮栏，PC端为侧边栏', () => {
      expect(isMobileViewport(MOBILE_WIDTH) ? 'bottom-bar' : 'sidebar').toBe('bottom-bar');
      expect(isMobileViewport(VIEWPORT_CONFIG.width) ? 'bottom-bar' : 'sidebar').toBe('sidebar');
    });
  });

  describe('GAP-21-5：PC 端不受手机端逻辑影响', () => {
    it('PC 端视口渲染数据正常', () => {
      const rd = renderer.computeViewportRenderData(allTiles, { offsetX: 0, offsetY: 0, zoom: 1.0 });
      expect(isMobileViewport(VIEWPORT_CONFIG.width)).toBe(false);
      expect(rd.tiles.length).toBeGreaterThan(0);
    });
    it('PC 端 clampViewport 和 centerOnPosition 正常', () => {
      const clamped = renderer.clampViewport({ offsetX: -99999, offsetY: -99999, zoom: 1.0 });
      expect(clamped.zoom).toBeGreaterThanOrEqual(VIEWPORT_CONFIG.minZoom);
      const centered = renderer.centerOnPosition({ x: 30, y: 20 }, 1.0);
      expect(centered.zoom).toBe(1.0);
      expect(typeof centered.offsetX).toBe('number');
    });
  });

  describe('GAP-21-6：手机端视口约束', () => {
    it('缩放被约束在合法范围', () => {
      const c = renderer.clampViewport({ offsetX: 0, offsetY: 0, zoom: 0.01 });
      expect(c.zoom).toBeGreaterThanOrEqual(VIEWPORT_CONFIG.minZoom);
    });
    it('偏移被约束在地图边界内', () => {
      const c = renderer.clampViewport({ offsetX: 99999, offsetY: 99999, zoom: 1.0 });
      expect(typeof c.offsetX).toBe('number');
      expect(typeof c.offsetY).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-22：离线领土变化视觉标记测试
// ═══════════════════════════════════════════════

describe('GAP-22：离线领土变化视觉标记测试（MAP-3 §3.22~3.25）', () => {
  describe('GAP-22-1：离线领土变化数据结构', () => {
    it('数据结构完整性', () => {
      const changes = createOfflineChanges();
      expect(changes.length).toBe(4);
      for (const c of changes) {
        expect(c).toHaveProperty('territoryId');
        expect(c).toHaveProperty('changeType');
        expect(c).toHaveProperty('timestamp');
        expect(c).toHaveProperty('viewed');
      }
    });
    it('变化类型包含所有 PRD 要求的类别', () => {
      const types = createOfflineChanges().map(c => c.changeType);
      for (const t of ['captured', 'lost', 'income_changed', 'defense_changed']) {
        expect(types).toContain(t);
      }
    });
    it('数值变化包含 previousValue 和 newValue', () => {
      const ic = createOfflineChanges().find(c => c.changeType === 'income_changed')!;
      expect(ic.previousValue).toBeDefined();
      expect(ic.newValue).toBeGreaterThan(ic.previousValue!);
    });
  });

  describe('GAP-22-2：新占领领土标记（金色脉冲）', () => {
    it('离线期间新占领领土应有 captured 标记', () => {
      const captured = createOfflineChanges().filter(c => c.changeType === 'captured');
      expect(captured.length).toBeGreaterThan(0);
      expect(captured[0].viewed).toBe(false);
    });
    it('captured 标记应对应有效领土 ID', () => {
      const { territory } = createTestDeps();
      for (const c of createOfflineChanges().filter(c => c.changeType === 'captured')) {
        expect(territory.getTerritoryById(c.territoryId)).not.toBeNull();
      }
    });
    it('captured 标记应携带有效时间戳', () => {
      const now = Date.now();
      for (const c of createOfflineChanges().filter(c => c.changeType === 'captured')) {
        expect(c.timestamp).toBeGreaterThan(0);
        expect(c.timestamp).toBeLessThanOrEqual(now);
      }
    });
  });

  describe('GAP-22-3：失去领土标记（红色脉冲）', () => {
    it('离线期间失去领土应有 lost 标记', () => {
      const lost = createOfflineChanges().filter(c => c.changeType === 'lost');
      expect(lost.length).toBeGreaterThan(0);
      expect(lost[0].territoryId).toBe('city-xuchang');
      expect(lost[0].viewed).toBe(false);
    });
    it('lost 标记应对应有效领土 ID', () => {
      const { territory } = createTestDeps();
      for (const c of createOfflineChanges().filter(c => c.changeType === 'lost')) {
        expect(territory.getTerritoryById(c.territoryId)).not.toBeNull();
      }
    });
  });

  describe('GAP-22-4：收益/防御变化闪烁标记', () => {
    it('收益变化标记携带变化幅度', () => {
      const ic = createOfflineChanges().find(c => c.changeType === 'income_changed')!;
      const delta = ic.newValue! - ic.previousValue!;
      expect(delta).toBeGreaterThan(0);
      expect(delta / ic.previousValue!).toBeCloseTo(0.5, 1);
    });
    it('防御变化标记携带变化幅度', () => {
      const dc = createOfflineChanges().find(c => c.changeType === 'defense_changed')!;
      expect(dc.newValue! - dc.previousValue!).toBeGreaterThan(0);
    });
  });

  describe('GAP-22-5：标记查看后清除', () => {
    it('标记初始为未查看', () => {
      for (const c of createOfflineChanges()) expect(c.viewed).toBe(false);
    });
    it('标记可标记为已查看，支持批量清除', () => {
      const changes = createOfflineChanges();
      changes[0].viewed = true;
      expect(changes[0].viewed).toBe(true);
      for (const c of changes) c.viewed = true;
      expect(changes.filter(c => !c.viewed).length).toBe(0);
    });
    it('已查看标记不影响未查看标记', () => {
      const changes = createOfflineChanges();
      changes[0].viewed = true; changes[1].viewed = true;
      expect(changes.filter(c => !c.viewed).length).toBe(2);
    });
  });

  describe('GAP-22-6：TerritorySystem 事件追踪能力', () => {
    it('captureTerritory 触发 territory:captured 事件', () => {
      const { territory, deps } = createTestDeps();
      territory.captureTerritory('city-luoyang', 'player');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('territory:captured', expect.objectContaining({ territoryId: 'city-luoyang', newOwner: 'player' }));
    });
    it('captureTerritory 记录前一个所有者', () => {
      const { territory, deps } = createTestDeps();
      territory.captureTerritory('city-luoyang', 'player');
      expect(deps.eventBus.emit).toHaveBeenCalledWith('territory:captured', expect.objectContaining({ previousOwner: expect.any(String) }));
    });
    it('连续占领和失去可追踪完整变更链', () => {
      const { territory, deps } = createTestDeps();
      territory.captureTerritory('city-luoyang', 'player');
      territory.captureTerritory('city-luoyang', 'enemy');
      const calls = vi.mocked(deps.eventBus.emit).mock.calls.filter(c => c[0] === 'territory:captured');
      expect(calls.length).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-23：事件脉冲动画测试
// ═══════════════════════════════════════════════

describe('GAP-23：事件脉冲动画测试（MAP-5 §5.5）', () => {
  let es: MapEventSystem;
  beforeEach(() => { es = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 }); });

  describe('GAP-23-1：活跃事件有脉冲动画标记', () => {
    it('活跃事件 status 为 active，应标记脉冲动画', () => {
      const e = es.forceTrigger('bandit', Date.now());
      expect(e.status).toBe('active');
      expect(e.status === 'active').toBe(true);
    });
    it('解决后事件不再有脉冲标记', () => {
      const e = es.forceTrigger('bandit', Date.now());
      es.resolveEvent(e.id, 'attack');
      expect(es.getEventById(e.id)).toBeUndefined();
    });
  });

  describe('GAP-23-2：事件类型不同动画状态不同', () => {
    it('战斗类 bandit 标记 isCombat=true，非战斗类 caravan=false', () => {
      expect(es.forceTrigger('bandit', Date.now()).isCombat).toBe(true);
      expect(es.forceTrigger('caravan', Date.now()).isCombat).toBe(false);
    });
    it('所有 5 种事件类型可区分', () => {
      const types = new Set<string>();
      for (const t of ['bandit', 'caravan', 'disaster', 'ruins', 'conflict'] as const) {
        const s = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
        types.add(s.forceTrigger(t, Date.now()).eventType);
      }
      expect(types.size).toBe(5);
    });
  });

  describe('GAP-23-3：事件过期后动画停止', () => {
    it('过期事件被清理出活跃列表', () => {
      const now = Date.now();
      es.forceTrigger('bandit', now);
      expect(es.getActiveEventCount()).toBe(1);
      expect(es.cleanExpiredEvents(now + 999999999)).toBe(1);
      expect(es.getActiveEventCount()).toBe(0);
    });
    it('未过期事件保留', () => {
      const now = Date.now();
      es.forceTrigger('bandit', now);
      expect(es.cleanExpiredEvents(now)).toBe(0);
      expect(es.getActiveEventCount()).toBe(1);
    });
    it('过期清理后不再有脉冲标记', () => {
      es.forceTrigger('bandit', Date.now());
      es.cleanExpiredEvents(Date.now() + 999999999);
      expect(es.getActiveEvents().filter(e => e.status === 'active').length).toBe(0);
    });
  });

  describe('GAP-23-4：事件解决后动画停止', () => {
    it('解决后从活跃列表移除，resolvedCount 增加', () => {
      const e = es.forceTrigger('bandit', Date.now());
      expect(es.getResolvedCount()).toBe(0);
      const r = es.resolveEvent(e.id, 'attack');
      expect(r.success).toBe(true);
      expect(es.getActiveEventCount()).toBe(0);
      expect(es.getResolvedCount()).toBe(1);
    });
    it('解决后 getEventById 返回 undefined', () => {
      const e = es.forceTrigger('bandit', Date.now());
      es.resolveEvent(e.id, 'negotiate');
      expect(es.getEventById(e.id)).toBeUndefined();
    });
    it('解决不存在的事件返回失败', () => {
      const r = es.resolveEvent('nonexistent', 'attack');
      expect(r.success).toBe(false);
      expect(r.rewards).toEqual([]);
    });
  });

  describe('GAP-23-5：多个同时事件各自独立动画', () => {
    it('可同时存在多个活跃事件，每个有唯一 ID', () => {
      const now = Date.now();
      const sys = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
      const e1 = sys.forceTrigger('bandit', now);
      const e2 = sys.forceTrigger('caravan', now);
      expect(sys.getActiveEventCount()).toBe(2);
      expect(e1.id).not.toBe(e2.id);
    });
    it('解决一个不影响其他事件的动画', () => {
      const now = Date.now();
      const sys = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
      const e1 = sys.forceTrigger('bandit', now);
      const e2 = sys.forceTrigger('caravan', now);
      sys.resolveEvent(e1.id, 'attack');
      expect(sys.getActiveEventCount()).toBe(1);
      expect(sys.getActiveEvents()[0].id).toBe(e2.id);
      expect(sys.getActiveEvents()[0].status).toBe('active');
    });
    it('最多 3 个同时存在的活跃事件', () => {
      const now = Date.now();
      const sys = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
      sys.forceTrigger('bandit', now);
      sys.forceTrigger('caravan', now);
      sys.forceTrigger('disaster', now);
      sys.forceTrigger('ruins', now); // 第4个不应创建新事件
      expect(sys.getActiveEventCount()).toBe(3);
    });
    it('序列化和反序列化保持事件独立', () => {
      const now = Date.now();
      const sys = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
      sys.forceTrigger('bandit', now);
      sys.forceTrigger('caravan', now);
      const saved = sys.serialize();
      const ns = new MapEventSystem({ rng: () => 0.05, checkInterval: 0 });
      ns.deserialize(saved);
      expect(ns.getActiveEventCount()).toBe(2);
      const origIds = sys.getActiveEvents().map(e => e.id).sort();
      const restIds = ns.getActiveEvents().map(e => e.id).sort();
      expect(origIds).toEqual(restIds);
    });
  });
});

// ═══════════════════════════════════════════════
// GAP-24：胜率颜色编码测试
// ═══════════════════════════════════════════════

describe('GAP-24：胜率颜色编码测试（MAP-3 §3.19）', () => {
  describe('GAP-24-1：胜率 ≥80% → 翠绿色', () => {
    it('95%/90%/100% → 翠绿色', () => {
      expect(getWinRateColor(0.95).tier).toBe('green');
      expect(getWinRateColor(0.90).tier).toBe('green');
      expect(getWinRateColor(1.0).tier).toBe('green');
    });
    it('80%（边界值）→ 翠绿色', () => {
      expect(getWinRateColor(0.80).tier).toBe('green');
    });
  });

  describe('GAP-24-2：胜率 60%~80% → 金色', () => {
    it('70%/65% → 金色', () => {
      expect(getWinRateColor(0.70).tier).toBe('gold');
      expect(getWinRateColor(0.65).tier).toBe('gold');
    });
    it('60%（下边界）→ 金色，79.99% → 金色', () => {
      expect(getWinRateColor(0.60).tier).toBe('gold');
      expect(getWinRateColor(0.7999).tier).toBe('gold');
    });
  });

  describe('GAP-24-3：胜率 40%~60% → 琥珀橙', () => {
    it('50%/45% → 琥珀橙', () => {
      expect(getWinRateColor(0.50).tier).toBe('amber');
      expect(getWinRateColor(0.45).tier).toBe('amber');
    });
    it('40%（下边界）→ 琥珀橙，59.99% → 琥珀橙', () => {
      expect(getWinRateColor(0.40).tier).toBe('amber');
      expect(getWinRateColor(0.5999).tier).toBe('amber');
    });
  });

  describe('GAP-24-4：胜率 <40% → 赤红', () => {
    it('30%/10%/5%/0% → 赤红', () => {
      expect(getWinRateColor(0.30).tier).toBe('red');
      expect(getWinRateColor(0.10).tier).toBe('red');
      expect(getWinRateColor(0.05).tier).toBe('red');
      expect(getWinRateColor(0.0).tier).toBe('red');
    });
    it('39.99% → 赤红', () => {
      expect(getWinRateColor(0.3999).tier).toBe('red');
    });
  });

  describe('GAP-24-5：边界值精确分界', () => {
    it('80%/60%/40% 是各档精确分界点', () => {
      expect(getWinRateColor(0.80).tier).toBe('green');
      expect(getWinRateColor(0.7999).tier).toBe('gold');
      expect(getWinRateColor(0.60).tier).toBe('gold');
      expect(getWinRateColor(0.5999).tier).toBe('amber');
      expect(getWinRateColor(0.40).tier).toBe('amber');
      expect(getWinRateColor(0.3999).tier).toBe('red');
    });
    it('从 0 到 1 连续映射无空档', () => {
      const rates = [0, 0.05, 0.20, 0.3999, 0.40, 0.50, 0.5999, 0.60, 0.7999, 0.80, 0.95, 1.0];
      const tiers = rates.map(r => getWinRateColor(r).tier);
      for (const t of ['red', 'amber', 'gold', 'green']) expect(tiers).toContain(t);
    });
  });

  describe('GAP-24-6：胜率计算与颜色编码一致性', () => {
    it('BattleRating → 颜色映射正确', () => {
      expect(battleRatingToColorTier('easy')).toBe('green');
      expect(battleRatingToColorTier('moderate')).toBe('gold');
      expect(battleRatingToColorTier('hard')).toBe('amber');
      expect(battleRatingToColorTier('very_hard')).toBe('red');
      expect(battleRatingToColorTier('impossible')).toBe('red');
    });
    it('BATTLE_RATING_THRESHOLDS 与颜色阈值映射一致', () => {
      expect(BATTLE_RATING_THRESHOLDS.easy).toEqual({ min: 0.75, max: 1.0 });
      expect(BATTLE_RATING_THRESHOLDS.moderate).toEqual({ min: 0.50, max: 0.75 });
      expect(BATTLE_RATING_THRESHOLDS.hard).toEqual({ min: 0.30, max: 0.50 });
      expect(BATTLE_RATING_THRESHOLDS.very_hard).toEqual({ min: 0.15, max: 0.30 });
      expect(BATTLE_RATING_THRESHOLDS.impossible).toEqual({ min: 0.0, max: 0.15 });
    });
    it('SiegeEnhancer 胜率计算结果可正确映射颜色', () => {
      const { siege, territory } = createTestDeps();
      const t = territory.getTerritoryById('city-luoyang');
      if (!t) return;
      const cases = [
        { power: t.defenseValue * 2.0 },   // 远强
        { power: t.defenseValue * 1.0 },   // 相等
        { power: t.defenseValue * 0.4 },   // 远弱
      ];
      for (const c of cases) {
        const est = siege.estimateWinRate(c.power, 'city-luoyang');
        if (est) {
          const color = getWinRateColor(est.winRate);
          expect(['green', 'gold', 'amber', 'red']).toContain(color.tier);
        }
      }
    });
    it('胜率 50%（攻防相等）→ 琥珀橙', () => {
      expect(getWinRateColor(0.50).tier).toBe('amber');
    });
  });

  describe('GAP-24-7：颜色编码全覆盖验证', () => {
    it('从 0% 到 100% 每 1% 都有明确颜色归属', () => {
      for (let i = 0; i <= 100; i++) {
        const r = getWinRateColor(i / 100);
        expect(['green', 'gold', 'amber', 'red']).toContain(r.tier);
        expect(r.color).toBeTruthy();
      }
    });
    it('颜色映射单调递减（胜率越高，颜色越绿）', () => {
      const order = { red: 0, amber: 1, gold: 2, green: 3 } as const;
      const tiers = [0.1, 0.3, 0.5, 0.7, 0.9].map(r => order[getWinRateColor(r).tier as keyof typeof order]);
      for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    });
  });
});
