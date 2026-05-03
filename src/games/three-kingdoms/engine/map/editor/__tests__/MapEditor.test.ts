/**
 * MapEditor 实体管理 + 撤销/重做 + ASCII导入 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapEditor, type MapEntity, type EntityType } from '../MapEditor';

describe('MapEditor', () => {
  let editor: MapEditor;

  beforeEach(() => {
    editor = new MapEditor(20, 15);
  });

  // ── 基础状态 ─────────────────────────────────

  describe('基础状态', () => {
    it('初始化地图尺寸', () => {
      const size = editor.getSize();
      expect(size.width).toBe(20);
      expect(size.height).toBe(15);
    });

    it('初始化5个图层', () => {
      const layers = editor.getLayers();
      expect(layers.length).toBe(5);
      expect(layers.map(l => l.type)).toEqual(['terrain', 'road', 'building', 'decoration', 'event']);
    });

    it('默认活动图层为terrain', () => {
      expect(editor.getActiveLayer().id).toBe('terrain');
    });

    it('初始无实体', () => {
      expect(editor.getEntities()).toEqual([]);
    });
  });

  // ── 实体管理 ─────────────────────────────────

  describe('实体管理', () => {
    it('添加实体', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5,
        y: 5,
        width: 3,
        height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      expect(entity.id).toBeTruthy();
      expect(entity.name).toBe('洛阳');
      expect(editor.getEntities().length).toBe(1);
    });

    it('删除实体', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.removeEntity(entity.id);
      expect(editor.getEntities().length).toBe(0);
    });

    it('选择实体', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.selectEntity(entity.id);
      expect(editor.getSelectedEntity()?.id).toBe(entity.id);
    });

    it('取消选择', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.selectEntity(entity.id);
      editor.selectEntity(null);
      expect(editor.getSelectedEntity()).toBeNull();
    });

    it('移动实体', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.moveEntity(entity.id, 10, 8);
      const moved = editor.getEntities().find(e => e.id === entity.id);
      expect(moved?.x).toBe(10);
      expect(moved?.y).toBe(8);
    });

    it('移动实体限制在地图范围内', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.moveEntity(entity.id, -5, 100);
      const moved = editor.getEntities().find(e => e.id === entity.id);
      expect(moved?.x).toBe(0);
      expect(moved?.y).toBe(12); // 15 - 3 = 12
    });

    it('重命名实体', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.renameEntity(entity.id, '长安');
      expect(editor.getEntities()[0].name).toBe('长安');
    });

    it('更新实体属性', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.updateEntity(entity.id, { faction: 'wei', level: 2 });
      const updated = editor.getEntities()[0];
      expect(updated.faction).toBe('wei');
      expect((updated.data as Record<string, unknown>).level).toBeUndefined(); // data not updated by updateEntity
    });

    it('按类型获取实体', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });
      editor.addEntity({ type: 'npc', name: '商人', x: 10, y: 10, width: 1, height: 1, faction: 'neutral', symbol: '$', data: {} });
      editor.addEntity({ type: 'building', name: '长安', x: 15, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'C', data: {} });

      expect(editor.getEntitiesByType('building').length).toBe(2);
      expect(editor.getEntitiesByType('npc').length).toBe(1);
      expect(editor.getEntitiesByType('event').length).toBe(0);
    });

    it('获取指定位置的实体', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });

      // 位置在实体范围内
      expect(editor.getEntityAt(6, 6)?.name).toBe('洛阳');

      // 位置在实体范围外
      expect(editor.getEntityAt(0, 0)).toBeNull();
    });

    it('删除选中的实体时清除选择', () => {
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      editor.selectEntity(entity.id);
      editor.removeEntity(entity.id);
      expect(editor.getSelectedEntity()).toBeNull();
    });
  });

  // ── 撤销/重做 ────────────────────────────────

  describe('撤销/重做', () => {
    it('撤销绘制操作', () => {
      editor.setBrushSymbol('^');
      editor.saveHistory('绘制');
      editor.paint(0, 0);

      const layer = editor.getActiveLayer();
      expect(layer.data[0][0]).toBe('^');

      // undo恢复到saveHistory时的快照
      editor.undo();
      // 初始历史(初始化) + 绘制 = 2步, undo后index=0, canUndo=false
      expect(layer.data[0][0]).toBe('.'); // 恢复为默认平原
    });

    it('重做操作', () => {
      editor.saveHistory('绘制');
      editor.paint(0, 0);

      const info1 = editor.getHistoryInfo();
      editor.undo();

      const info2 = editor.getHistoryInfo();
      expect(info2.canRedo).toBe(true);

      editor.redo();
      const info3 = editor.getHistoryInfo();
      expect(info3.current).toBe(info1.current);
    });

    it('撤销实体添加', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });
      expect(editor.getEntities().length).toBe(1);

      editor.undo();
      expect(editor.getEntities().length).toBe(0);
    });

    it('重做实体添加', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });
      editor.undo();
      expect(editor.getEntities().length).toBe(0);

      editor.redo();
      expect(editor.getEntities().length).toBe(1);
      expect(editor.getEntities()[0].name).toBe('洛阳');
    });

    it('历史步数限制', () => {
      // 添加超过maxHistory步操作
      for (let i = 0; i < 60; i++) {
        editor.saveHistory(`step ${i}`);
        editor.paint(i % 20, 0);
      }

      const info = editor.getHistoryInfo();
      expect(info.total).toBeLessThanOrEqual(50);
    });

    it('getHistoryInfo返回正确信息', () => {
      const info = editor.getHistoryInfo();
      expect(info.total).toBeGreaterThan(0); // 初始saveHistory('初始化')
      expect(info.current).toBeGreaterThanOrEqual(0);
      expect(typeof info.canUndo).toBe('boolean');
      expect(typeof info.canRedo).toBe('boolean');
    });
  });

  // ── 画笔工具 ─────────────────────────────────

  describe('画笔工具', () => {
    it('设置画笔工具', () => {
      editor.setBrushTool('erase');
      expect(editor.getBrush().tool).toBe('erase');
    });

    it('设置画笔符号', () => {
      editor.setBrushSymbol('^');
      expect(editor.getBrush().symbol).toBe('^');
    });

    it('设置画笔大小', () => {
      editor.setBrushSize(3);
      expect(editor.getBrush().size).toBe(3);
    });

    it('画笔大小限制在1~5', () => {
      editor.setBrushSize(0);
      expect(editor.getBrush().size).toBe(1);

      editor.setBrushSize(10);
      expect(editor.getBrush().size).toBe(5);
    });

    it('paint绘制到活动图层', () => {
      editor.setBrushSymbol('^');
      editor.paint(3, 4);

      const layer = editor.getActiveLayer();
      expect(layer.data[4][3]).toBe('^');
    });

    it('paint限制在地图范围内', () => {
      editor.setBrushSymbol('^');
      editor.paint(-1, -1); // 不应崩溃
      editor.paint(100, 100); // 不应崩溃
    });

    it('floodFill填充', () => {
      editor.setBrushSymbol('^');
      editor.floodFill(0, 0);

      // 平原(.)被替换为(^)
      const layer = editor.getActiveLayer();
      expect(layer.data[0][0]).toBe('^');
    });

    it('pickSymbol拾取符号', () => {
      const layer = editor.getActiveLayer();
      layer.data[3][3] = '#';

      editor.pickSymbol(3, 3);
      expect(editor.getBrush().symbol).toBe('#');
    });
  });

  // ── 图层管理 ─────────────────────────────────

  describe('图层管理', () => {
    it('切换活动图层', () => {
      editor.setActiveLayer('road');
      expect(editor.getActiveLayer().id).toBe('road');
    });

    it('切换图层可见性', () => {
      editor.toggleLayerVisibility('road');
      const road = editor.getLayers().find(l => l.id === 'road');
      expect(road?.visible).toBe(false);

      editor.toggleLayerVisibility('road');
      expect(road?.visible).toBe(true);
    });

    it('切换图层锁定', () => {
      editor.toggleLayerLock('terrain');
      const terrain = editor.getLayers().find(l => l.id === 'terrain');
      expect(terrain?.locked).toBe(true);
    });

    it('锁定图层不能绘制', () => {
      editor.toggleLayerLock('terrain');
      editor.setBrushSymbol('^');
      editor.paint(0, 0);

      const layer = editor.getActiveLayer();
      expect(layer.data[0][0]).toBe('.'); // 未改变
    });

    it('添加图层', () => {
      const countBefore = editor.getLayers().length;
      editor.addLayer('测试层', 'decoration');
      expect(editor.getLayers().length).toBe(countBefore + 1);
    });

    it('删除图层', () => {
      editor.addLayer('测试层', 'decoration');
      const countBefore = editor.getLayers().length;
      const testLayer = editor.getLayers().find(l => l.name === '测试层')!;
      editor.removeLayer(testLayer.id);
      expect(editor.getLayers().length).toBe(countBefore - 1);
    });

    it('至少保留一个图层', () => {
      // 尝试删除所有图层
      const layers = editor.getLayers();
      for (let i = 0; i < layers.length; i++) {
        editor.removeLayer(layers[i].id);
      }
      // 应该至少还有一个图层
      expect(editor.getLayers().length).toBeGreaterThanOrEqual(1);
    });

    it('移动图层顺序', () => {
      const layers = editor.getLayers();
      const secondId = layers[1].id;
      editor.moveLayer(secondId, 'up');

      const newLayers = editor.getLayers();
      expect(newLayers[2].id).toBe(secondId);
    });
  });

  // ── 视口控制 ─────────────────────────────────

  describe('视口控制', () => {
    it('设置缩放', () => {
      editor.setZoom(2);
      expect(editor.getState().zoom).toBe(2);
    });

    it('缩放限制在0.25~4', () => {
      editor.setZoom(0.1);
      expect(editor.getState().zoom).toBe(0.25);

      editor.setZoom(10);
      expect(editor.getState().zoom).toBe(4);
    });

    it('设置视口偏移', () => {
      editor.setOffset(100, 200);
      expect(editor.getState().offsetX).toBe(100);
      expect(editor.getState().offsetY).toBe(200);
    });

    it('切换网格显示', () => {
      const initial = editor.getState().showGrid;
      editor.toggleGrid();
      expect(editor.getState().showGrid).toBe(!initial);
    });

    it('screenToGrid坐标转换', () => {
      const grid = editor.screenToGrid(4, 4);
      expect(grid).toEqual({ x: 0, y: 0 });
    });

    it('screenToGrid超出范围返回null', () => {
      const grid = editor.screenToGrid(-1, -1);
      expect(grid).toBeNull();
    });
  });

  // ── 元信息 ───────────────────────────────────

  describe('元信息管理', () => {
    it('获取元信息', () => {
      const meta = editor.getMetadata();
      expect(meta.name).toBe('新地图');
    });

    it('设置地图名称', () => {
      editor.setMapName('天下大地图');
      expect(editor.getMetadata().name).toBe('天下大地图');
    });

    it('设置地图描述', () => {
      editor.setMapDescription('三国世界');
      expect(editor.getMetadata().description).toBe('三国世界');
    });

    it('添加城市', () => {
      editor.addCity({ id: 'luoyang', name: '洛阳', x: 5, y: 5, faction: 'neutral', level: 1 });
      expect(editor.getMetadata().cities.length).toBe(1);
    });

    it('删除城市', () => {
      editor.addCity({ id: 'luoyang', name: '洛阳', x: 5, y: 5, faction: 'neutral', level: 1 });
      editor.removeCity('luoyang');
      expect(editor.getMetadata().cities.length).toBe(0);
    });
  });

  // ── 导入/导出 ────────────────────────────────

  describe('导入/导出', () => {
    it('导出JSON包含实体', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });

      const json = editor.exportStateJSON();
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(2);
      expect(parsed.state.entities.length).toBe(1);
      expect(parsed.state.entities[0].name).toBe('洛阳');
    });

    it('导入JSON恢复实体', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });

      const json = editor.exportStateJSON();

      const editor2 = new MapEditor(20, 15);
      editor2.importStateJSON(json);

      expect(editor2.getEntities().length).toBe(1);
      expect(editor2.getEntities()[0].name).toBe('洛阳');
    });

    it('mergeToASCII生成ASCII地图', () => {
      editor.setBrushSymbol('^');
      editor.paint(0, 0);

      const ascii = editor.mergeToASCII();
      expect(ascii).toContain('MAP:新地图');
      expect(ascii).toContain('SIZE:20x15');
    });

    it('导出地图包', () => {
      const pkg = editor.exportMapPackage();
      expect(pkg.ascii).toBeTruthy();
      expect(pkg.metadata).toBeTruthy();
      expect(pkg.combined).toContain('MAP_DATA_START');
      expect(pkg.combined).toContain('METADATA_START');
    });
  });

  // ── 新建地图 ─────────────────────────────────

  describe('新建地图', () => {
    it('newMap重置所有状态', () => {
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });
      editor.setBrushSymbol('^');
      editor.paint(0, 0);

      editor.newMap(30, 20, '新世界');

      expect(editor.getSize()).toEqual({ width: 30, height: 20 });
      expect(editor.getEntities().length).toBe(0);
      expect(editor.getMetadata().name).toBe('新世界');
    });
  });

  // ── 监听器 ───────────────────────────────────

  describe('监听器', () => {
    it('onChange回调触发', () => {
      let called = false;
      editor.onChange(() => { called = true; });

      editor.setBrushTool('erase');
      expect(called).toBe(true);
    });

    it('取消监听', () => {
      let count = 0;
      const unsubscribe = editor.onChange(() => { count++; });

      editor.setBrushTool('erase');
      expect(count).toBe(1);

      unsubscribe();
      editor.setBrushTool('paint');
      expect(count).toBe(1); // 不再增加
    });
  });
});
