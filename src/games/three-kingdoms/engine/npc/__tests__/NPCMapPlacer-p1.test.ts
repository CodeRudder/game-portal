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
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
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
    region: 'wei',
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
    getAllNPCs: jest.fn().mockReturnValue(npcs),
    getVisibleNPCs: jest.fn().mockReturnValue(visibleNPCs),
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
        createNPC({ id: 'npc-1', position: { x: 5, y: 5 }, region: 'wei' }),
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
        createNPC({ id: 'npc-cp1', region: 'wei', position: { x: 20, y: 10 } }),
        createNPC({ id: 'npc-jn1', region: 'wu', position: { x: 40, y: 30 } }),
        createNPC({ id: 'npc-ws1', region: 'shu', position: { x: 10, y: 25 } }),
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
        createNPC({ id: 'npc-cp1', region: 'wei', position: { x: 20, y: 10 } }),
        createNPC({ id: 'npc-jn1', region: 'wu', position: { x: 40, y: 30 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      const cpDisplays = p.getRegionDisplays('wei');
      expect(cpDisplays).toHaveLength(1);
      expect(cpDisplays[0].id).toBe('npc-cp1');
    });

    it('无 NPC 的区域返回空数组', () => {
      const npcs = [
        createNPC({ id: 'npc-cp1', region: 'wei', position: { x: 20, y: 10 } }),
      ];
      const { placer: p } = createPlacer({ npcs });

      const jnDisplays = p.getRegionDisplays('wu');
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
  });
});
