/**
 * ASCIIMapParser 单元测试
 *
 * 测试ASCII地图文本解析为结构化数据
 */

import { ASCIIMapParser } from '../ASCIIMapParser';

describe('ASCIIMapParser', () => {
  const parser = new ASCIIMapParser();

  describe('头部解析', () => {
    it('解析MAP名称', () => {
      const text = `MAP:测试地图\nSIZE:10x8\nTILE:8x8\n..........\n..........\n..........\n..........\n..........\n..........\n..........\n..........`;
      const map = parser.parse(text);
      expect(map.name).toBe('测试地图');
    });

    it('解析SIZE尺寸', () => {
      const text = `MAP:测试\nSIZE:10x8\nTILE:8x8\n..........\n..........\n..........\n..........\n..........\n..........\n..........\n..........`;
      const map = parser.parse(text);
      expect(map.width).toBe(10);
      expect(map.height).toBe(8);
    });

    it('解析TILE尺寸', () => {
      const text = `MAP:测试\nSIZE:10x8\nTILE:16\n..........\n..........\n..........\n..........\n..........\n..........\n..........\n..........`;
      const map = parser.parse(text);
      expect(map.tileSize).toBe(16);
    });

    it('默认tileSize=8', () => {
      const text = `MAP:测试\nSIZE:10x5\n..........\n..........\n..........\n..........\n..........`;
      const map = parser.parse(text);
      expect(map.tileSize).toBe(8);
    });
  });

  describe('城市映射解析', () => {
    it('解析CITY映射', () => {
      const text = `MAP:测试\nSIZE:3x3\nCITY: L=洛阳,X=许昌\n.L.\nX..\n...`;
      const map = parser.parse(text);
      expect(map.cityMap['L']).toBe('洛阳');
      expect(map.cityMap['X']).toBe('许昌');
    });

    it('多行CITY映射', () => {
      const text = `MAP:测试\nSIZE:3x3\nCITY: L=洛阳\nCITY: X=许昌\n.L.\nX..\n...`;
      const map = parser.parse(text);
      expect(map.cityMap['L']).toBe('洛阳');
      expect(map.cityMap['X']).toBe('许昌');
    });
  });

  describe('地形解析', () => {
    it('解析平原(.)', () => {
      const text = `MAP:测试\nSIZE:3x3\n...\n...\n...`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('plain');
    });

    it('解析山地(^)', () => {
      const text = `MAP:测试\nSIZE:3x3\n^^^\n^^^\n^^^`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('mountain');
    });

    it('解析水域(~)', () => {
      const text = `MAP:测试\nSIZE:3x3\n~~~\n~~~\n~~~`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('water');
    });

    it('解析森林(#)', () => {
      const text = `MAP:测试\nSIZE:3x3\n###\n###\n###`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('forest');
    });

    it('解析道路(-)', () => {
      const text = `MAP:测试\nSIZE:3x3\n---\n---\n---`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('road_h');
    });

    it('解析道路(|)', () => {
      const text = `MAP:测试\nSIZE:3x3\n|||\n|||\n|||`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('road_v');
    });

    it('解析道路交叉(+)', () => {
      const text = `MAP:测试\nSIZE:3x3\n+++\n+++\n+++`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('road_cross');
    });

    it('解析草地(,)', () => {
      const text = `MAP:测试\nSIZE:3x3\n,,,\n,,,\n,,,`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('grass');
    });

    it('解析空格为空地', () => {
      const text = `MAP:测试\nSIZE:3x3\n   \n   \n   `;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('empty');
    });
  });

  describe('城市解析', () => {
    it('识别城市字符', () => {
      const text = `MAP:测试\nSIZE:3x3\nCITY: L=洛阳\nL..\n...\n...`;
      const map = parser.parse(text);
      expect(map.cities).toHaveLength(1);
      expect(map.cities[0].id).toBe('洛阳');
      expect(map.cities[0].x).toBe(0);
      expect(map.cities[0].y).toBe(0);
    });

    it('识别多个城市', () => {
      const text = `MAP:测试\nSIZE:3x3\nCITY: L=洛阳,X=许昌\nL.X\n...\n...`;
      const map = parser.parse(text);
      expect(map.cities).toHaveLength(2);
    });

    it('城市terrain类型', () => {
      const text = `MAP:测试\nSIZE:3x3\nCITY: L=洛阳\nL..\n...\n...`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('city');
      expect(map.cells[0][0].entityId).toBe('洛阳');
    });
  });

  describe('道路提取', () => {
    it('提取横向道路段', () => {
      const text = `MAP:测试\nSIZE:5x3\nCITY: A=甲,B=乙\nA---B\n.....\n.....`;
      const map = parser.parse(text);
      expect(map.roads.length).toBeGreaterThan(0);
    });

    it('提取纵向道路段', () => {
      const text = `MAP:测试\nSIZE:3x5\nCITY: A=甲,B=乙\nA..\n|..\n|..\n|..\nB..`;
      const map = parser.parse(text);
      expect(map.roads.length).toBeGreaterThan(0);
    });
  });

  describe('混合地图', () => {
    it('解析包含多种地形的地图', () => {
      const text = `MAP:测试\nSIZE:5x5\nCITY: L=洛阳\n^^^^^\n^...^\n^.-L^\n^...^\n^^^^^`;
      const map = parser.parse(text);
      expect(map.cells[0][0].terrain).toBe('mountain');
      expect(map.cells[1][1].terrain).toBe('plain');
      expect(map.cells[2][2].terrain).toBe('road_h');
      expect(map.cells[2][3].terrain).toBe('city');
      expect(map.cities).toHaveLength(1);
    });

    it('地图尺寸自动检测', () => {
      const text = `MAP:测试\n...\n...\n...\n...\n...`;
      const map = parser.parse(text);
      expect(map.width).toBe(3);
      expect(map.height).toBe(5);
    });
  });

  describe('建筑框架格式(新)', () => {
    it('从建筑框架中提取城市名称', () => {
      const text = `MAP:测试\nSIZE:8x5\nCITY: 邺城=邺城\n^^^^^^^^\n^^┌──┐^^\n^^│邺城│^^\n^^└──┘^^\n^^^^^^^^`;
      const map = parser.parse(text);
      // 应该检测到建筑框架中的城市
      const cityCells = map.cities.filter(c => c.id === '邺城');
      expect(cityCells.length).toBeGreaterThan(0);
    });

    it('建筑框架内的单元格标记为city', () => {
      const text = `MAP:测试\nSIZE:8x5\nCITY: 邺城=邺城\n^^^^^^^^\n^^┌──┐^^\n^^│邺城│^^\n^^└──┘^^\n^^^^^^^^`;
      const map = parser.parse(text);
      // 建筑内部应该是city类型
      expect(map.cells[2][3].terrain).toBe('city');
      expect(map.cells[2][3].entityId).toBe('邺城');
    });

    it('建筑框架边框正确识别', () => {
      const text = `MAP:测试\nSIZE:8x5\nCITY: 邺城=邺城\n^^^^^^^^\n^^┌──┐^^\n^^│邺城│^^\n^^└──┘^^\n^^^^^^^^`;
      const map = parser.parse(text);
      expect(map.cells[1][2].terrain).toBe('wall_tl');
      expect(map.cells[1][5].terrain).toBe('wall_tr');
      expect(map.cells[3][2].terrain).toBe('wall_bl');
      expect(map.cells[3][5].terrain).toBe('wall_br');
    });
  });
});
