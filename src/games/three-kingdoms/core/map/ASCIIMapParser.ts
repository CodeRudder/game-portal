/**
 * ASCII 地图解析器
 *
 * 将ASCII文本地图数据解析为结构化的地图矩阵。
 * 支持多种地图类型(天下/城池/副本)，通用解析。
 *
 * @module core/map/ASCIIMapParser
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 地形类型(与ASCII符号对应) */
export type ASCIITerrain =
  | 'plain'      // . 平原
  | 'mountain'   // ^ 山地
  | 'water'      // ~ 水域
  | 'forest'     // # 森林
  | 'road_h'     // - 道路(横)
  | 'road_v'     // | 道路(竖)
  | 'road_cross' // + 道路(交叉)
  | 'road_diag'  // / 道路(斜)
  | 'path'       // : 小路
  | 'pass'       // = 关隘
  | 'desert'     // * 沙漠
  | 'grass'      // , 草地
  | 'mud'        // _ 泥地
  | 'wall_h'     // ─ 城墙(横)
  | 'wall_v'     // │ 城墙(竖)
  | 'wall_tl'    // ┌ 城墙(左上角)
  | 'wall_tr'    // ┐ 城墙(右上角)
  | 'wall_bl'    // └ 城墙(左下角)
  | 'wall_br'    // ┘ 城墙(右下角)
  | 'wall_t'     // ├ 城墙(T型)
  | 'wall_t_r'   // ┤ 城墙(T型右)
  | 'wall_t_d'   // ┬ 城墙(T型下)
  | 'wall_t_u'   // ┴ 城墙(T型上)
  | 'wall_cross' // ┼ 城墙(十字)
  | 'city'       // A-Z 城市
  | 'resource'   // a-z 资源点
  | 'outpost'    // 0-9 关卡/哨站
  | 'player'     // @ 玩家位置
  | 'event'      // ! 事件点
  | 'unknown'    // ? 未知区域
  | 'ruins'      // % 废墟
  | 'chest'      // & 宝箱
  | 'caravan'    // $ 商队
  | 'empty';     // (空格) 空地

/** 地图单元格 */
export interface MapCell {
  /** 列坐标 */
  x: number;
  /** 行坐标 */
  y: number;
  /** 原始ASCII字符 */
  char: string;
  /** 解析后的地形类型 */
  terrain: ASCIITerrain;
  /** 城市/资源点ID(仅当terrain为city/resource/outpost时) */
  entityId?: string;
}

/** 解析后的地图数据 */
export interface ParsedMap {
  /** 地图名称 */
  name: string;
  /** 地图宽度(列数) */
  width: number;
  /** 地图高度(行数) */
  height: number;
  /** 色块尺寸(px) */
  tileSize: number;
  /** 地图矩阵 [y][x] */
  cells: MapCell[][];
  /** 城市映射 (字母 → 城市ID) */
  cityMap: Record<string, string>;
  /** 发现的城市列表 */
  cities: Array<{ id: string; char: string; x: number; y: number }>;
  /** 发现的道路段 */
  roads: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
}

// ─────────────────────────────────────────────
// 符号→地形映射
// ─────────────────────────────────────────────

const CHAR_TO_TERRAIN: Record<string, ASCIITerrain> = {
  '.': 'plain',
  '^': 'mountain',
  '~': 'water',
  '#': 'forest',
  '-': 'road_h',
  '|': 'road_v',
  '+': 'road_cross',
  '/': 'road_diag',
  ':': 'path',
  '=': 'pass',
  '░': 'road_h',  // 统一道路符号
  '▒': 'road_h',  // 建筑内部填充（可通行）
  '═': 'road_h',
  '║': 'road_v',
  '*': 'desert',
  ',': 'grass',
  '_': 'mud',
  '─': 'wall_h',
  '│': 'wall_v',
  '┌': 'wall_tl',
  '┐': 'wall_tr',
  '└': 'wall_bl',
  '┘': 'wall_br',
  '├': 'wall_t',
  '┤': 'wall_t_r',
  '┬': 'wall_t_d',
  '┴': 'wall_t_u',
  '┼': 'wall_cross',
  '@': 'player',
  '!': 'event',
  '?': 'unknown',
  '%': 'ruins',
  '&': 'chest',
  '$': 'caravan',
  ' ': 'empty',
};

// ─────────────────────────────────────────────
// ASCIIMapParser
// ─────────────────────────────────────────────

/**
 * ASCII地图解析器
 *
 * 将ASCII文本解析为结构化地图数据。
 *
 * @example
 * ```ts
 * const parser = new ASCIIMapParser();
 * const map = parser.parse(asciiText);
 * console.log(map.width, map.height, map.cities.length);
 * ```
 */
export class ASCIIMapParser {

  /**
   * 解析ASCII地图文本
   */
  parse(text: string): ParsedMap {
    const lines = text.split('\n');

    // 解析头部信息
    const header = this.parseHeader(lines);

    // 解析城市映射
    const cityMap = this.parseCityMap(lines);

    // 提取地图数据行
    const dataLines = this.extractDataLines(lines, header.width);

    // 自动检测尺寸(如果未指定)
    if (header.width === 0 && dataLines.length > 0) {
      header.width = Math.max(...dataLines.map(l => l.length));
    }
    if (header.height === 0) {
      header.height = dataLines.length;
    }

    // 解析地图矩阵
    const { cells, cities } = this.parseCells(dataLines, header.width, header.height, cityMap);

    // 提取道路连接
    const roads = this.extractRoads(cells);

    return {
      name: header.name,
      width: header.width,
      height: header.height,
      tileSize: header.tileSize,
      cells,
      cityMap,
      cities,
      roads,
    };
  }

  // ── 头部解析 ─────────────────────────────────

  private parseHeader(lines: string[]): {
    name: string;
    width: number;
    height: number;
    tileSize: number;
  } {
    let name = '未命名地图';
    let width = 0;
    let height = 0;
    let tileSize = 8;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('MAP:')) {
        name = trimmed.substring(4).trim();
      } else if (trimmed.startsWith('SIZE:')) {
        const sizeStr = trimmed.substring(5).trim();
        const [w, h] = sizeStr.split('x').map(Number);
        if (w > 0) width = w;
        if (h > 0) height = h;
      } else if (trimmed.startsWith('TILE:')) {
        const tileStr = trimmed.substring(5).trim();
        const t = parseInt(tileStr, 10);
        if (t > 0) tileSize = t;
      }
    }

    return { name, width, height, tileSize };
  }

  // ── 城市映射解析 ─────────────────────────────

  private parseCityMap(lines: string[]): Record<string, string> {
    const cityMap: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('CITY:')) {
        const cityStr = trimmed.substring(5).trim();
        const pairs = cityStr.split(',');
        for (const pair of pairs) {
          const [char, name] = pair.split('=').map(s => s.trim());
          if (char && name) {
            cityMap[char] = name;
          }
        }
      }
    }

    return cityMap;
  }

  // ── 数据行提取 ───────────────────────────────

  private extractDataLines(lines: string[], expectedWidth: number): string[] {
    const dataLines: string[] = [];
    let foundFirstData = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // 头部行(MAP/SIZE/TILE/CITY)始终跳过
      if (trimmed.startsWith('MAP:') || trimmed.startsWith('SIZE:') ||
          trimmed.startsWith('TILE:') || trimmed.startsWith('CITY:')) {
        continue;
      }

      // 空行跳过
      if (trimmed === '') {
        continue;
      }

      // 注释行: 仅在找到第一个数据行之前，且以"# "开头或纯注释文本的行视为注释
      if (!foundFirstData && trimmed.startsWith('#')) {
        // 如果行只包含#字符(如"###")，可能是森林地形数据
        if (/^#+$/.test(trimmed) && trimmed.length >= 3) {
          // 可能是数据行，继续检查
        } else {
          continue; // 头部注释
        }
      }

      // 检查是否是数据行(包含已知地形字符)
      if (!foundFirstData && this.looksLikeDataLine(trimmed)) {
        foundFirstData = true;
      }

      if (foundFirstData) {
        dataLines.push(trimmed);
      }
    }

    return dataLines;
  }

  /**
   * 判断一行是否看起来像地图数据行
   */
  private looksLikeDataLine(line: string): boolean {
    // 包含已知地形字符的行视为数据行
    const terrainChars = '.^~#-|+=/:*=, _─│┌┐└┘├┤┬┴┼@!?%&$';
    for (const char of line) {
      if (terrainChars.includes(char) || /[A-Za-z0-9]/.test(char)) {
        return true;
      }
    }
    return false;
  }

  // ── 地图矩阵解析 ─────────────────────────────

  private parseCells(
    dataLines: string[],
    width: number,
    height: number,
    cityMap: Record<string, string>,
  ): { cells: MapCell[][]; cities: ParsedMap['cities'] } {
    const cells: MapCell[][] = [];
    const cities: ParsedMap['cities'] = [];

    const actualHeight = height || dataLines.length;
    const actualWidth = width || (dataLines[0]?.length || 0);

    // 构建反向映射: 城市名 → 城市ID
    const nameToId: Record<string, string> = {};
    for (const [char, name] of Object.entries(cityMap)) {
      nameToId[name] = name; // 使用名称本身作为ID
    }

    // 第一遍: 基础字符解析
    for (let y = 0; y < actualHeight; y++) {
      const row: MapCell[] = [];
      const line = dataLines[y] || '';

      for (let x = 0; x < actualWidth; x++) {
        const char = line[x] || ' ';
        const terrain = this.charToTerrain(char, cityMap);
        const entityId = this.getEntityId(char, cityMap);

        row.push({ x, y, char, terrain, entityId });

        // 记录单字母城市位置(旧格式兼容)
        if (terrain === 'city' || terrain === 'resource' || terrain === 'outpost') {
          const id = entityId || char;
          cities.push({ id, char, x, y });
        }
      }

      cells.push(row);
    }

    // 第二遍: 检测建筑框架，提取内部名称(新格式)
    this.detectBuildings(cells, actualWidth, actualHeight, nameToId, cities);

    // 去重: 同一城市可能在第一遍(单字母)和第二遍(建筑框架)各添加一次
    // 保留建筑框架条目(中文名ID)，移除单字母条目
    const seenIds = new Set<string>();
    const dedupedCities: typeof cities = [];
    // 优先保留建筑框架条目(在第二遍添加，排在后面)
    for (let i = cities.length - 1; i >= 0; i--) {
      const city = cities[i];
      if (!seenIds.has(city.id)) {
        seenIds.add(city.id);
        dedupedCities.unshift(city);
      }
    }
    cities.length = 0;
    cities.push(...dedupedCities);

    return { cells, cities };
  }

  // ── 建筑检测(从框架中提取名称) ──────────────

  private detectBuildings(
    cells: MapCell[][],
    width: number,
    height: number,
    nameToId: Record<string, string>,
    cities: ParsedMap['cities'],
  ): void {
    const visited = new Set<string>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = cells[y][x];
        // 寻找建筑左上角 ┌
        if (cell.char === '┌' && !visited.has(`${x},${y}`)) {
          const building = this.extractBuilding(cells, x, y, width, height);
          if (building) {
            // 标记所有建筑单元格为已访问
            for (const pos of building.positions) {
              visited.add(`${pos.x},${pos.y}`);
            }

            // 从名称查找城市ID
            const cityName = building.name;
            const cityId = nameToId[cityName] || cityName;

            // 更新建筑内部单元格
            for (const pos of building.positions) {
              const c = cells[pos.y][pos.x];
              if (c.char === ' ' || this.isChineseChar(c.char)) {
                c.terrain = 'city';
                c.entityId = cityId;
              }
            }

            // 记录城市位置(使用建筑中心)
            cities.push({
              id: cityId,
              char: '┌',
              x: building.x,
              y: building.y,
            });
          }
        }
      }
    }
  }

  /**
   * 从┌位置提取建筑信息
   */
  private extractBuilding(
    cells: MapCell[][],
    startX: number,
    startY: number,
    width: number,
    height: number,
  ): { x: number; y: number; name: string; positions: Array<{ x: number; y: number }> } | null {
    // 找到右边界 ┐
    let endX = -1;
    for (let x = startX + 1; x < width; x++) {
      if (cells[startY][x].char === '┐') {
        endX = x;
        break;
      }
      if (cells[startY][x].char !== '─') return null; // 不是建筑
    }
    if (endX < 0) return null;

    // 找到下边界 └
    let endY = -1;
    for (let y = startY + 1; y < height; y++) {
      if (cells[y][startX].char === '└') {
        endY = y;
        break;
      }
      if (cells[y][startX].char !== '│' && cells[y][startX].char !== ' ') return null;
    }
    if (endY < 0) return null;

    // 验证右下角 ┘
    if (cells[endY][endX].char !== '┘') return null;

    // 提取内部名称(去除边框)
    let name = '';
    for (let y = startY + 1; y < endY; y++) {
      let rowName = '';
      for (let x = startX + 1; x < endX; x++) {
        const ch = cells[y][x].char;
        if (ch !== ' ' && ch !== '▒') {
          rowName += ch;
        }
      }
      if (rowName.length > name.length) {
        name = rowName;
      }
    }

    // 收集所有建筑位置
    const positions: Array<{ x: number; y: number }> = [];
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        positions.push({ x, y });
      }
    }

    return {
      x: startX,
      y: startY,
      name: name.trim(),
      positions,
    };
  }

  /**
   * 判断是否为中文字符
   */
  private isChineseChar(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0x4e00 && code <= 0x9fff;
  }

  // ── 字符→地形转换 ────────────────────────────

  private charToTerrain(char: string, cityMap: Record<string, string>): ASCIITerrain {
    // 城市字母
    if (/[A-Z]/.test(char) && cityMap[char]) {
      return 'city';
    }
    // 资源点小写字母
    if (/[a-z]/.test(char) && cityMap[char]) {
      return 'resource';
    }
    // 关卡数字
    if (/[0-9]/.test(char) && cityMap[char]) {
      return 'outpost';
    }
    // 符号映射
    return CHAR_TO_TERRAIN[char] || 'empty';
  }

  // ── 获取实体ID ───────────────────────────────

  private getEntityId(char: string, cityMap: Record<string, string>): string | undefined {
    if (cityMap[char]) {
      return cityMap[char];
    }
    return undefined;
  }

  // ── 道路提取 ─────────────────────────────────

  private extractRoads(cells: MapCell[][]): ParsedMap['roads'] {
    const roads: ParsedMap['roads'] = [];
    const visited = new Set<string>();

    for (let y = 0; y < cells.length; y++) {
      for (let x = 0; x < cells[y].length; x++) {
        const cell = cells[y][x];
        if (this.isRoad(cell.terrain)) {
          // 检查右侧和下方是否有道路连接
          const key = `${x},${y}`;
          if (visited.has(key)) continue;

          // 横向道路段
          if (cell.terrain === 'road_h' || cell.terrain === 'road_cross') {
            let endX = x;
            while (endX + 1 < cells[y].length && this.isRoad(cells[y][endX + 1].terrain)) {
              endX++;
            }
            if (endX > x) {
              roads.push({ from: { x, y }, to: { x: endX, y } });
              for (let rx = x; rx <= endX; rx++) {
                visited.add(`${rx},${y}`);
              }
            }
          }

          // 纵向道路段
          if (cell.terrain === 'road_v' || cell.terrain === 'road_cross') {
            let endY = y;
            while (endY + 1 < cells.length && this.isRoad(cells[endY + 1][x].terrain)) {
              endY++;
            }
            if (endY > y) {
              roads.push({ from: { x, y }, to: { x, y: endY } });
              for (let ry = y; ry <= endY; ry++) {
                visited.add(`${x},${ry}`);
              }
            }
          }
        }
      }
    }

    return roads;
  }

  private isRoad(terrain: ASCIITerrain): boolean {
    return terrain === 'road_h' || terrain === 'road_v' ||
           terrain === 'road_cross' || terrain === 'road_diag' ||
           terrain === 'path';
  }
}
