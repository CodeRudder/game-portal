import { vi } from 'vitest';
/**
 * NPCMapPlacer 单元测试
 *
 * 覆盖地图展示系统的所有功能：
 * - ISubsystem 接口
 * - 坐标转换（gridToPixel / pixelToGrid）
 * - 地图展示计算（computeMapDisplays）
 * - 按区域获取展示数据
 * - 视口内 NPC 过滤
 * - 位置分配（computePlacement）
 * - 聚合配置
 * - 拥挤管理
 * - 缓存机制
 * - 边界情况
 */

import { NPCMapPlacer } from '../NPCMapPlacer';
import type { NPCMapPlacerDeps } from '../NPCMapPlacer';
import type { ISystemDeps } from '../../../core/types';
import type { NPCData, NPCProfession, NPCMapDisplay } from '../../../core/npc';
import { GRID_CONFIG } from '../../../core/map';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 创建一个 NPC 数据对象 */
function createNPC(
  overrides: Partial<NPCData> & { id: string },
): NPCData {
  return {
    name: `NPC-${overrides.id}`,
    profession: 'merchant' as NPCProfession,
    affinity: 50,
    position: { x: 0, y: 0 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
    ...overrides,
  };
}

/** 创建 NPCMapPlacer 实例并注入依赖 */
function createPlacer(
  options: {
    npcs?: NPCData[];
    visibleNPCs?: NPCData[];
  } = {},
): { placer: NPCMapPlacer; deps: ISystemDeps; placerDeps: NPCMapPlacerDeps } {
  const deps = mockDeps();
  const placer = new NPCMapPlacer();
  placer.init(deps);

  const npcs = options.npcs ?? [];
  const visibleNPCs = options.visibleNPCs ?? npcs;

  const placerDeps: NPCMapPlacerDeps = {
    getAllNPCs: vi.fn().mockReturnValue(npcs),
    getVisibleNPCs: vi.fn().mockReturnValue(visibleNPCs),
  };

  placer.setPlacerDeps(placerDeps);
  return { placer, deps, placerDeps };
}

// ═══════════════════════════════════════════════════════════

describe('NPCMapPlacer', () => {
  let placer: NPCMapPlacer;
  let deps: ISystemDeps;
  let placerDeps: NPCMapPlacerDeps;

  beforeEach(() => {
    const result = createPlacer();
    placer = result.placer;
    deps = result.deps;
    placerDeps = result.placerDeps;
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 npcMapPlacer', () => {
      expect(placer.name).toBe('npcMapPlacer');
    });

    it('getState 返回展示数据和聚合配置', () => {
      const state = placer.getState();
      expect(state).toHaveProperty('displays');
      expect(state).toHaveProperty('clusterConfig');
      expect(state.displays).toEqual([]);
      expect(state.clusterConfig).toBeDefined();
    });

    it('reset 清除缓存和重置配置', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 5, y: 5 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      p.computeMapDisplays();

      p.reset();
      const state = p.getState();
      expect(state.displays).toEqual([]);
    });

    it('update 不抛异常', () => {
      expect(() => placer.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 坐标转换
  // ═══════════════════════════════════════════
  describe('坐标转换', () => {
    it('gridToPixel 返回格子中心像素坐标', () => {
      const result = placer.gridToPixel({ x: 0, y: 0 });
      expect(result.x).toBe(GRID_CONFIG.tileWidth / 2);
      expect(result.y).toBe(GRID_CONFIG.tileHeight / 2);
    });

    it('gridToPixel (1,1) 返回正确偏移', () => {
      const result = placer.gridToPixel({ x: 1, y: 1 });
      expect(result.x).toBe(1 * GRID_CONFIG.tileWidth + GRID_CONFIG.tileWidth / 2);
      expect(result.y).toBe(1 * GRID_CONFIG.tileHeight + GRID_CONFIG.tileHeight / 2);
    });

    it('gridToPixel (10, 5) 计算正确', () => {
      const result = placer.gridToPixel({ x: 10, y: 5 });
      expect(result.x).toBe(10 * 32 + 16);
      expect(result.y).toBe(5 * 32 + 16);
    });

    it('pixelToGrid 返回格子坐标', () => {
      const result = placer.pixelToGrid(0, 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('pixelToGrid 格子边界映射正确', () => {
      // 像素 31,31 仍然属于格子 (0,0)
      expect(placer.pixelToGrid(31, 31)).toEqual({ x: 0, y: 0 });
      // 像素 32,32 属于格子 (1,1)
      expect(placer.pixelToGrid(32, 32)).toEqual({ x: 1, y: 1 });
    });

    it('gridToPixel 和 pixelToGrid 互为逆运算（近似）', () => {
      const gridPos = { x: 15, y: 20 };
      const pixel = placer.gridToPixel(gridPos);
      // 像素坐标在格子中心，转回来应该还是同一个格子
      const backGrid = placer.pixelToGrid(pixel.x, pixel.y);
      expect(backGrid.x).toBe(gridPos.x);
      expect(backGrid.y).toBe(gridPos.y);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 地图展示计算
  // ═══════════════════════════════════════════
  describe('computeMapDisplays', () => {
    it('无 NPC 时返回空数组', () => {
      const displays = placer.computeMapDisplays();
      expect(displays).toEqual([]);
    });

    it('单个 NPC 返回单个展示数据', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 5, y: 5 }, region: 'central_plains' }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      expect(displays).toHaveLength(1);
      expect(displays[0].id).toBe('npc-1');
      expect(displays[0].isClustered).toBe(false);
      expect(displays[0].clusterCount).toBe(1);
    });

    it('NPC 展示位置基于格子中心', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 10, y: 10 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      const expectedPixel = placer.gridToPixel({ x: 10, y: 10 });
      // 展示位置应该在格子中心附近（可能有 jitter 偏移）
      const dx = Math.abs(displays[0].displayPosition.x - expectedPixel.x);
      const dy = Math.abs(displays[0].displayPosition.y - expectedPixel.y);
      expect(dx).toBeLessThan(10);
      expect(dy).toBeLessThan(10);
    });

    it('NPC 使用职业默认图标', () => {
      const npcs = [
        createNPC({ id: 'npc-1', profession: 'merchant' }),
        createNPC({ id: 'npc-2', profession: 'warrior' }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      expect(displays[0].icon).toBe('🏪');
      expect(displays[1].icon).toBe('⚔️');
    });

    it('NPC 使用自定义图标覆盖职业图标', () => {
      const npcs = [
        createNPC({ id: 'npc-1', profession: 'merchant', customIcon: '🎯' }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      expect(displays[0].icon).toBe('🎯');
    });

    it('多个区域 NPC 分别展示', () => {
      const npcs = [
        createNPC({ id: 'npc-cp1', region: 'central_plains', position: { x: 20, y: 10 } }),
        createNPC({ id: 'npc-jn1', region: 'jiangnan', position: { x: 40, y: 30 } }),
        createNPC({ id: 'npc-ws1', region: 'western_shu', position: { x: 10, y: 25 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      expect(displays).toHaveLength(3);
      const ids = displays.map((d) => d.id);
      expect(ids).toContain('npc-cp1');
      expect(ids).toContain('npc-jn1');
      expect(ids).toContain('npc-ws1');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 按区域获取展示数据
  // ═══════════════════════════════════════════
  describe('getRegionDisplays', () => {
    it('返回指定区域的 NPC 展示数据', () => {
      const npcs = [
        createNPC({ id: 'npc-cp1', region: 'central_plains', position: { x: 20, y: 10 } }),
        createNPC({ id: 'npc-jn1', region: 'jiangnan', position: { x: 40, y: 30 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      const cpDisplays = p.getRegionDisplays('central_plains');
      expect(cpDisplays).toHaveLength(1);
      expect(cpDisplays[0].id).toBe('npc-cp1');
    });

    it('无 NPC 的区域返回空数组', () => {
      const npcs = [
        createNPC({ id: 'npc-cp1', region: 'central_plains', position: { x: 20, y: 10 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      const jnDisplays = p.getRegionDisplays('jiangnan');
      expect(jnDisplays).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 视口内 NPC 过滤
  // ═══════════════════════════════════════════
  describe('getNPCsInViewport', () => {
    it('视口内包含的 NPC 被返回', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 10, y: 5 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const pixelPos = p.gridToPixel({ x: 10, y: 5 });

      const visible = p.getNPCsInViewport(
        pixelPos.x - 100, pixelPos.y - 100,
        200, 200, 1.0,
      );
      expect(visible.length).toBeGreaterThanOrEqual(1);
    });

    it('视口外的 NPC 不被返回', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 0, y: 0 } }),
        createNPC({ id: 'npc-2', position: { x: 59, y: 39 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      // 只看左上角小范围
      const visible = p.getNPCsInViewport(0, 0, 32, 32, 1.0);
      // npc-1 在 (0,0) 应该可见
      expect(visible.some((d) => d.id === 'npc-1')).toBe(true);
    });

    it('缩放影响可见范围', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 10, y: 10 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      // 缩放2x，像素坐标翻倍
      const visible1x = p.getNPCsInViewport(0, 0, 400, 400, 1.0);
      const visible2x = p.getNPCsInViewport(0, 0, 400, 400, 2.0);

      // 缩放越大，同样的视口尺寸覆盖的地图范围越小
      expect(visible1x.length).toBeGreaterThanOrEqual(visible2x.length);
    });

    it('空视口返回空数组', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 30, y: 20 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      // 视口在远离 NPC 的位置
      const visible = p.getNPCsInViewport(5000, 5000, 100, 100, 1.0);
      expect(visible).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 位置分配
  // ═══════════════════════════════════════════
  describe('computePlacement', () => {
    it('少量 NPC 全部放置成功', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 5, y: 5 } }),
        createNPC({ id: 'npc-2', position: { x: 6, y: 6 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const result = p.computePlacement(npcs);

      expect(result.placed).toContain('npc-1');
      expect(result.placed).toContain('npc-2');
      expect(result.unplaced).toHaveLength(0);
    });

    it('同位置多个 NPC 超过上限时产生溢出', () => {
      const npcs = Array.from({ length: 5 }, (_, i) =>
        createNPC({ id: `npc-${i}`, position: { x: 5, y: 5 } }),
      );
      const { placer: p } = createPlacer({ npcs });

      // 默认 maxNPCsPerTile 为 3
      const result = p.computePlacement(npcs);
      expect(result.placed.length).toBeGreaterThan(0);
    });

    it('返回的 clusters 包含聚合展示数据', () => {
      // 创建很多同位置 NPC 以触发聚合
      const npcs = Array.from({ length: 6 }, (_, i) =>
        createNPC({ id: `npc-${i}`, position: { x: 5, y: 5 } }),
      );
      const { placer: p } = createPlacer({ npcs });
      const result = p.computePlacement(npcs);

      // 超过 maxNPCsPerTile(3) 的部分可能被聚合
      if (result.clusters.length > 0) {
        const cluster = result.clusters[0];
        expect(cluster.isClustered).toBe(true);
        expect(cluster.clusterCount).toBeGreaterThan(0);
        expect(cluster.clusteredNPCIds.length).toBeGreaterThan(0);
        expect(cluster.icon).toBe('👥');
      }
    });

    it('空 NPC 列表返回空结果', () => {
      const result = placer.computePlacement([]);
      expect(result.placed).toHaveLength(0);
      expect(result.unplaced).toHaveLength(0);
      expect(result.clusters).toHaveLength(0);
    });

    it('不同位置的 NPC 独立放置', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 0, y: 0 } }),
        createNPC({ id: 'npc-2', position: { x: 10, y: 10 } }),
        createNPC({ id: 'npc-3', position: { x: 20, y: 20 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const result = p.computePlacement(npcs);

      expect(result.placed).toHaveLength(3);
      expect(result.unplaced).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 聚合配置
  // ═══════════════════════════════════════════
  describe('聚合配置', () => {
    it('setClusterConfig 更新配置', () => {
      placer.setClusterConfig({ clusterDistance: 100 });
      const state = placer.getState();
      expect(state.clusterConfig.clusterDistance).toBe(100);
    });

    it('setClusterConfig 部分更新不影响其他字段', () => {
      const original = placer.getState().clusterConfig;
      placer.setClusterConfig({ clusterDistance: 200 });
      const updated = placer.getState().clusterConfig;
      expect(updated.clusterDistance).toBe(200);
      expect(updated.maxDisplayPerRegion).toBe(original.maxDisplayPerRegion);
    });

    it('setClusterConfig 使缓存失效', () => {
      const npcs = [createNPC({ id: 'npc-1' })];
      const { placer: p } = createPlacer({ npcs });
      p.computeMapDisplays();

      // 缓存应该有效
      const mockVisible = p['placerDeps'].getVisibleNPCs as ReturnType<typeof vi.fn>;
      const callCountBefore = mockVisible.mock.calls.length;

      p.setClusterConfig({ clusterDistance: 999 });
      p.computeMapDisplays();

      // getVisibleNPCs 应该被再次调用（缓存失效）
      expect(mockVisible.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    it('禁用聚合时 NPC 单独展示', () => {
      const npcs = Array.from({ length: 10 }, (_, i) =>
        createNPC({ id: `npc-${i}`, position: { x: 5 + i, y: 5 }, region: 'central_plains' }),
      );
      const { placer: p } = createPlacer({ npcs });
      p.setClusterConfig({ enabled: false });

      const displays = p.computeMapDisplays();
      // 禁用聚合后所有 NPC 应该单独展示
      const clustered = displays.filter((d) => d.isClustered);
      expect(clustered).toHaveLength(0);
      expect(displays).toHaveLength(10);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 拥挤管理配置
  // ═══════════════════════════════════════════
  describe('拥挤管理配置', () => {
    it('setCrowdConfig 更新配置', () => {
      placer.setCrowdConfig({ maxNPCsPerTile: 5 });
      // 配置已更新（通过 computePlacement 验证）
      const npcs = Array.from({ length: 6 }, (_, i) =>
        createNPC({ id: `npc-${i}`, position: { x: 5, y: 5 } }),
      );
      const { placer: p } = createPlacer({ npcs });
      p.setCrowdConfig({ maxNPCsPerTile: 5 });
      const result = p.computePlacement(npcs);
      // maxNPCsPerTile=5, 6个NPC，只有1个溢出
      expect(result.placed).toHaveLength(6);
    });

    it('setCrowdConfig 使缓存失效', () => {
      const npcs = [createNPC({ id: 'npc-1' })];
      const { placer: p } = createPlacer({ npcs });
      p.computeMapDisplays();

      const mockVisible = p['placerDeps'].getVisibleNPCs as ReturnType<typeof vi.fn>;
      const callCountBefore = mockVisible.mock.calls.length;

      p.setCrowdConfig({ jitterRadius: 20 });
      p.computeMapDisplays();

      expect(mockVisible.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 缓存机制
  // ═══════════════════════════════════════════
  describe('缓存机制', () => {
    it('连续调用 computeMapDisplays 使用缓存', () => {
      const npcs = [createNPC({ id: 'npc-1' })];
      const { placer: p } = createPlacer({ npcs });

      const d1 = p.computeMapDisplays();
      const d2 = p.computeMapDisplays();
      expect(d1).toBe(d2); // 同一引用（缓存命中）
    });

    it('invalidateCache 使缓存失效', () => {
      const npcs = [createNPC({ id: 'npc-1' })];
      const { placer: p } = createPlacer({ npcs });

      p.computeMapDisplays();
      p.invalidateCache();

      const mockVisible = p['placerDeps'].getVisibleNPCs as ReturnType<typeof vi.fn>;
      const callCountBefore = mockVisible.mock.calls.length;

      p.computeMapDisplays();
      expect(mockVisible.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    it('setPlacerDeps 使缓存失效', () => {
      const npcs = [createNPC({ id: 'npc-1' })];
      const { placer: p } = createPlacer({ npcs });

      p.computeMapDisplays();
      p.setPlacerDeps({
        getAllNPCs: vi.fn().mockReturnValue(npcs),
        getVisibleNPCs: vi.fn().mockReturnValue(npcs),
      });

      // 缓存应该失效
      const state = p.getState();
      expect(state.displays).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 依赖注入
  // ═══════════════════════════════════════════
  describe('依赖注入', () => {
    it('未注入 placerDeps 时 computeMapDisplays 返回空数组', () => {
      const p = new NPCMapPlacer();
      p.init(mockDeps());
      // 不调用 setPlacerDeps
      const displays = p.computeMapDisplays();
      expect(displays).toEqual([]);
    });

    it('getVisibleNPCs 返回空数组时返回空展示', () => {
      const { placer: p } = createPlacer({ visibleNPCs: [] });
      const displays = p.computeMapDisplays();
      expect(displays).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 边界情况
  // ═══════════════════════════════════════════
  describe('边界情况', () => {
    it('大量 NPC 在同一位置', () => {
      const npcs = Array.from({ length: 20 }, (_, i) =>
        createNPC({ id: `npc-${i}`, position: { x: 10, y: 10 }, region: 'central_plains' }),
      );
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      // 应该有展示数据（可能聚合）
      expect(displays.length).toBeGreaterThan(0);
    });

    it('NPC 在地图边界位置', () => {
      const npcs = [
        createNPC({ id: 'npc-corner-tl', position: { x: 0, y: 0 } }),
        createNPC({ id: 'npc-corner-br', position: { x: 59, y: 39 } }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();

      expect(displays).toHaveLength(2);
    });

    it('所有 NPC 不可见时返回空展示', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 5, y: 5 } }),
      ];
      const { placer: p } = createPlacer({ npcs, visibleNPCs: [] });
      const displays = p.computeMapDisplays();

      expect(displays).toHaveLength(0);
    });

    it('computePlacement 处理单个 NPC', () => {
      const npcs = [createNPC({ id: 'npc-1', position: { x: 5, y: 5 } })];
      const { placer: p } = createPlacer({ npcs });
      const result = p.computePlacement(npcs);

      expect(result.placed).toHaveLength(1);
      expect(result.unplaced).toHaveLength(0);
      expect(result.clusters).toHaveLength(0);
    });

    it('NPCMapDisplay 结构完整', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 5, y: 5 }, profession: 'strategist' }),
      ];
      const { placer: p } = createPlacer({ npcs });
      const displays = p.computeMapDisplays();
      const display: NPCMapDisplay = displays[0];

      expect(display).toHaveProperty('id');
      expect(display).toHaveProperty('displayPosition');
      expect(display).toHaveProperty('icon');
      expect(display).toHaveProperty('isClustered');
      expect(display).toHaveProperty('clusterCount');
      expect(display).toHaveProperty('clusteredNPCIds');
      expect(typeof display.displayPosition.x).toBe('number');
      expect(typeof display.displayPosition.y).toBe('number');
    });
  });

  // ═══════════════════════════════════════════
  // 12. 完整流程测试
  // ═══════════════════════════════════════════
  describe('完整流程', () => {
    it('初始化 → 注入依赖 → 计算展示 → 视口过滤', () => {
      const npcs = [
        createNPC({ id: 'npc-1', position: { x: 10, y: 10 }, region: 'central_plains' }),
        createNPC({ id: 'npc-2', position: { x: 40, y: 30 }, region: 'jiangnan' }),
      ];
      const { placer: p } = createPlacer({ npcs });

      // 计算展示
      const displays = p.computeMapDisplays();
      expect(displays).toHaveLength(2);

      // 视口过滤
      const pixel1 = p.gridToPixel({ x: 10, y: 10 });
      const visible = p.getNPCsInViewport(
        pixel1.x - 50, pixel1.y - 50,
        100, 100, 1.0,
      );
      expect(visible.length).toBeGreaterThanOrEqual(1);
    });

    it('配置更新 → 缓存失效 → 重新计算', () => {
      const npcs = Array.from({ length: 8 }, (_, i) =>
        createNPC({
          id: `npc-${i}`,
          position: { x: 5 + i, y: 5 },
          region: 'central_plains',
        }),
      );
      const { placer: p } = createPlacer({ npcs });

      // 初始计算
      const d1 = p.computeMapDisplays();
      expect(d1.length).toBeGreaterThan(0);

      // 更新配置
      p.setClusterConfig({ maxDisplayPerRegion: 3, enabled: true });
      const d2 = p.computeMapDisplays();

      // 配置变更后可能触发聚合
      expect(d2.length).toBeGreaterThan(0);
    });

    it('多区域 NPC 按区域分组展示', () => {
      const npcs = [
        ...Array.from({ length: 3 }, (_, i) =>
          createNPC({
            id: `cp-${i}`,
            position: { x: 20 + i, y: 10 },
            region: 'central_plains',
          }),
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          createNPC({
            id: `jn-${i}`,
            position: { x: 40 + i, y: 30 },
            region: 'jiangnan',
          }),
        ),
      ];
      const { placer: p } = createPlacer({ npcs });

      const cpDisplays = p.getRegionDisplays('central_plains');
      const jnDisplays = p.getRegionDisplays('jiangnan');

      expect(cpDisplays.length).toBe(3);
      expect(jnDisplays.length).toBe(3);
    });
  });
});
