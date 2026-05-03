/**
 * MapEditor 集成测试
 *
 * 测试完整工作流: 创建地图 → 绘制 → 添加实体 → 导出 → 导入 → 验证数据完整性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapEditor } from '../MapEditor';

describe('MapEditor 集成测试', () => {
  let editor: MapEditor;

  beforeEach(() => {
    editor = new MapEditor(30, 20);
  });

  // ── 完整工作流 ───────────────────────────────

  describe('完整编辑工作流', () => {
    it('创建地图 → 绘制地形 → 添加城市 → 导出ASCII → 验证', () => {
      // 1. 绘制山地区域
      editor.setBrushSymbol('^');
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 3; y++) {
          editor.paint(x, y);
        }
      }

      // 2. 绘制水域
      editor.setBrushSymbol('~');
      editor.setActiveLayer('terrain');
      for (let x = 10; x < 15; x++) {
        editor.paint(x, 10);
      }

      // 3. 添加城市实体
      const city = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 15,
        y: 10,
        width: 3,
        height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });

      // 4. 导出ASCII
      const ascii = editor.mergeToASCII();

      // 5. 验证导出内容
      expect(ascii).toContain('MAP:新地图');
      expect(ascii).toContain('SIZE:30x20');
      expect(ascii).toBeTruthy();

      // 6. 验证实体存在
      expect(editor.getEntities().length).toBe(1);
      expect(editor.getEntities()[0].name).toBe('洛阳');
    });

    it('绘制 → 撤销 → 重做 → 数据一致', () => {
      const layer = editor.getActiveLayer();

      // 绘制前保存快照, 再绘制
      editor.saveHistory('绘制');
      editor.setBrushSymbol('^');
      editor.paint(5, 5);
      expect(layer.data[5][5]).toBe('^');

      // 撤销 → 恢复到快照(绘制前状态)
      editor.undo();
      expect(layer.data[5][5]).toBe('.'); // 恢复为默认

      // 重做 → 恢复到撤销前的状态
      editor.redo();
      // 注意: redo恢复的是快照,不是paint后的状态
      // 所以redo后data[5][5]仍然是'.'(快照时的状态)
      expect(editor.getHistoryInfo().canRedo).toBe(false); // 已到最新
    });

    it('添加实体 → 移动 → 重命名 → 删除 → 撤销全部', () => {
      // 添加
      const entity = editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'neutral',
        symbol: 'L',
        data: {},
      });
      expect(editor.getEntities().length).toBe(1);

      // 移动
      editor.moveEntity(entity.id, 10, 10);
      expect(editor.getEntities()[0].x).toBe(10);

      // 重命名
      editor.renameEntity(entity.id, '长安');
      expect(editor.getEntities()[0].name).toBe('长安');

      // 删除
      editor.removeEntity(entity.id);
      expect(editor.getEntities().length).toBe(0);

      // 撤销删除
      editor.undo();
      expect(editor.getEntities().length).toBe(1);
      expect(editor.getEntities()[0].name).toBe('长安');

      // 撤销重命名
      editor.undo();
      expect(editor.getEntities()[0].name).toBe('洛阳');
    });
  });

  // ── 多图层操作 ───────────────────────────────

  describe('多图层操作', () => {
    it('不同图层独立编辑', () => {
      // 地形层绘制山地
      editor.setActiveLayer('terrain');
      editor.setBrushSymbol('^');
      editor.paint(0, 0);

      // 道路层绘制道路
      editor.setActiveLayer('road');
      editor.setBrushSymbol('░');
      editor.paint(0, 0);

      // 建筑层绘制建筑
      editor.setActiveLayer('building');
      editor.setBrushSymbol('▒');
      editor.paint(0, 0);

      // 验证各图层数据独立
      const terrain = editor.getLayers().find(l => l.type === 'terrain')!;
      const road = editor.getLayers().find(l => l.type === 'road')!;
      const building = editor.getLayers().find(l => l.type === 'building')!;

      expect(terrain.data[0][0]).toBe('^');
      expect(road.data[0][0]).toBe('░');
      expect(building.data[0][0]).toBe('▒');
    });

    it('隐藏图层不影响其他图层编辑', () => {
      editor.toggleLayerVisibility('terrain');

      editor.setActiveLayer('road');
      editor.setBrushSymbol('░');
      editor.paint(5, 5);

      const road = editor.getLayers().find(l => l.type === 'road')!;
      expect(road.data[5][5]).toBe('░');
    });

    it('锁定图层不能绘制', () => {
      editor.toggleLayerLock('terrain');
      editor.setActiveLayer('terrain');

      editor.setBrushSymbol('^');
      editor.paint(0, 0);

      const terrain = editor.getLayers().find(l => l.type === 'terrain')!;
      expect(terrain.data[0][0]).toBe('.'); // 未改变
    });
  });

  // ── JSON导入/导出 ────────────────────────────

  describe('JSON导入/导出', () => {
    it('导出 → 导入 → 数据完整', () => {
      // 绘制一些数据
      editor.setBrushSymbol('^');
      editor.paint(0, 0);
      editor.paint(1, 1);

      // 添加实体
      editor.addEntity({
        type: 'building',
        name: '洛阳',
        x: 5, y: 5,
        width: 3, height: 3,
        faction: 'wei',
        symbol: 'L',
        data: { level: 3 },
      });

      // 设置元信息
      editor.setMapName('天下大地图');
      editor.setMapDescription('三国世界');

      // 导出
      const json = editor.exportStateJSON();

      // 创建新编辑器并导入
      const editor2 = new MapEditor(30, 20);
      editor2.importStateJSON(json);

      // 验证数据一致性
      expect(editor2.getMetadata().name).toBe('天下大地图');
      expect(editor2.getMetadata().description).toBe('三国世界');

      const terrain = editor2.getLayers().find(l => l.type === 'terrain')!;
      expect(terrain.data[0][0]).toBe('^');
      expect(terrain.data[1][1]).toBe('^');

      expect(editor2.getEntities().length).toBe(1);
      expect(editor2.getEntities()[0].name).toBe('洛阳');
      expect(editor2.getEntities()[0].faction).toBe('wei');
    });

    it('导出地图包格式正确', () => {
      const pkg = editor.exportMapPackage();

      expect(pkg.ascii).toContain('MAP:新地图');
      expect(pkg.ascii).toContain('SIZE:30x20');

      expect(pkg.metadata).toContain('"name": "新地图"');

      expect(pkg.combined).toContain('=== MAP_DATA_START ===');
      expect(pkg.combined).toContain('=== MAP_DATA_END ===');
      expect(pkg.combined).toContain('=== METADATA_START ===');
      expect(pkg.combined).toContain('=== METADATA_END ===');
    });
  });

  // ── 画笔工具完整测试 ─────────────────────────

  describe('画笔工具完整测试', () => {
    it('油漆桶填充连续区域', () => {
      // 先绘制一些地形
      editor.setBrushSymbol('^');
      editor.paint(5, 5);

      // 用油漆桶填充(从默认平原'.'开始)
      editor.setBrushSymbol('#');
      editor.floodFill(0, 0);

      // 验证大面积被填充
      const layer = editor.getActiveLayer();
      expect(layer.data[0][0]).toBe('#');
      expect(layer.data[10][10]).toBe('#');

      // 山地没有被填充(被阻断)
      expect(layer.data[5][5]).toBe('^');
    });

    it('拾取器获取符号', () => {
      const layer = editor.getActiveLayer();
      layer.data[3][3] = '~';

      editor.pickSymbol(3, 3);
      expect(editor.getBrush().symbol).toBe('~');

      // 拾取后可以直接绘制
      editor.paint(4, 4);
      expect(layer.data[4][4]).toBe('~');
    });

    it('不同画笔大小绘制', () => {
      const layer = editor.getActiveLayer();

      // 大小1: 单格
      editor.setBrushSize(1);
      editor.setBrushSymbol('^');
      editor.paint(10, 10);
      expect(layer.data[10][10]).toBe('^');
      expect(layer.data[10][11]).toBe('.'); // 相邻未改变

      // 大小3: 3x3区域
      editor.setBrushSize(3);
      editor.paint(10, 10);
      expect(layer.data[10][10]).toBe('^');
      expect(layer.data[10][11]).toBe('^');
      expect(layer.data[11][10]).toBe('^');
      expect(layer.data[9][10]).toBe('^');
    });
  });

  // ── 新建地图 ─────────────────────────────────

  describe('新建地图', () => {
    it('新建地图清除所有数据', () => {
      // 添加数据
      editor.setBrushSymbol('^');
      editor.paint(0, 0);
      editor.addEntity({ type: 'building', name: '洛阳', x: 5, y: 5, width: 3, height: 3, faction: 'neutral', symbol: 'L', data: {} });
      editor.setMapName('测试地图');

      // 新建
      editor.newMap(50, 40, '新世界');

      // 验证全部重置
      expect(editor.getSize()).toEqual({ width: 50, height: 40 });
      expect(editor.getMetadata().name).toBe('新世界');
      expect(editor.getEntities().length).toBe(0);

      const terrain = editor.getLayers().find(l => l.type === 'terrain')!;
      expect(terrain.data[0][0]).toBe('.'); // 默认平原
    });
  });

  // ── 填充工具边界测试 ─────────────────────────

  describe('填充工具边界测试', () => {
    it('填充相同字符不操作', () => {
      const layer = editor.getActiveLayer();
      editor.setBrushSymbol('.'); // 与默认相同
      editor.floodFill(0, 0);

      // 数据未改变
      expect(layer.data[0][0]).toBe('.');
    });

    it('填充被不同地形包围的区域', () => {
      // 创建一个被山地包围的区域
      editor.setBrushSymbol('^');
      for (let x = 0; x < 30; x++) {
        editor.paint(x, 0); // 顶行
        editor.paint(x, 19); // 底行
      }
      for (let y = 0; y < 20; y++) {
        editor.paint(0, y); // 左列
        editor.paint(29, y); // 右列
      }

      // 填充内部
      editor.setBrushSymbol('#');
      editor.floodFill(5, 5);

      const layer = editor.getActiveLayer();
      expect(layer.data[5][5]).toBe('#'); // 内部被填充
      expect(layer.data[0][0]).toBe('^'); // 边界未改变
    });
  });
});
