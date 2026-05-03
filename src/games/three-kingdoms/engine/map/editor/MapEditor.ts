/**
 * 地图编辑器引擎
 *
 * 多层地图编辑器，支持地形/建筑/道路等图层的独立编辑。
 * 使用与游戏相同的渲染器，表现效果一致。
 *
 * @module engine/map/editor/MapEditor
 */

import type { ParsedMap } from '../../../core/map/ASCIIMapParser';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 图层类型 */
export type LayerType = 'terrain' | 'building' | 'road' | 'decoration' | 'event';

/** 图层数据 */
export interface EditorLayer {
  /** 图层ID */
  id: string;
  /** 图层名称 */
  name: string;
  /** 图层类型 */
  type: LayerType;
  /** 是否可见 */
  visible: boolean;
  /** 是否锁定(不可编辑) */
  locked: boolean;
  /** 不透明度(0~1) */
  opacity: number;
  /** 图层数据 [y][x] = 字符 */
  data: string[][];
}

/** 画笔工具 */
export type BrushTool = 'view' | 'paint' | 'erase' | 'fill' | 'pick' | 'select';

/** 实体类型 */
export type EntityType = 'building' | 'npc' | 'event' | 'resource';

/** 地图实体(建筑/NPC/事件点等独立对象) */
export interface MapEntity {
  /** 唯一ID */
  id: string;
  /** 实体类型 */
  type: EntityType;
  /** 显示名称 */
  name: string;
  /** 网格X坐标 */
  x: number;
  /** 网格Y坐标 */
  y: number;
  /** 宽度(格) */
  width: number;
  /** 高度(格) */
  height: number;
  /** 阵营(faction) */
  faction: string;
  /** 关联符号(在图层数据中的字符) */
  symbol: string;
  /** 扩展数据 */
  data: Record<string, unknown>;
}

/** 编辑器状态 */
export interface EditorState {
  /** 地图宽度 */
  width: number;
  /** 地图高度 */
  height: number;
  /** 图层列表 */
  layers: EditorLayer[];
  /** 实体列表 */
  entities: MapEntity[];
  /** 当前选中图层ID */
  activeLayerId: string;
  /** 当前选中实体ID */
  selectedEntityId: string | null;
  /** 当前画笔工具 */
  brushTool: BrushTool;
  /** 当前画笔符号 */
  brushSymbol: string;
  /** 画笔大小(1~5) */
  brushSize: number;
  /** 网格显示 */
  showGrid: boolean;
  /** 缩放 */
  zoom: number;
  /** 视口偏移 */
  offsetX: number;
  offsetY: number;
}

/** 操作历史记录(整体快照) */
interface HistoryEntry {
  /** 所有图层数据快照 */
  layerSnapshots: Array<{ layerId: string; data: string[][] }>;
  /** 实体列表快照 */
  entitySnapshot: MapEntity[];
  description: string;
}

/** 地图元信息 */
export interface MapMetadata {
  name: string;
  description: string;
  tileSize: number;
  cities: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    faction: string;
    level: number;
  }>;
  npcs: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    type: string;
  }>;
  events: Array<{
    id: string;
    x: number;
    y: number;
    type: string;
    data: Record<string, unknown>;
  }>;
}

// ─────────────────────────────────────────────
// 符号定义
// ─────────────────────────────────────────────

/** 地形符号 */
export const TERRAIN_SYMBOLS: Array<{ symbol: string; name: string; category: string }> = [
  { symbol: '.', name: '平原', category: '地形' },
  { symbol: '^', name: '山地', category: '地形' },
  { symbol: '~', name: '水域', category: '地形' },
  { symbol: '#', name: '森林', category: '地形' },
  { symbol: ',', name: '草地', category: '地形' },
  { symbol: '*', name: '沙漠', category: '地形' },
  { symbol: '_', name: '泥地', category: '地形' },
  { symbol: ' ', name: '空地', category: '地形' },
];

/** 道路符号 */
export const ROAD_SYMBOLS: Array<{ symbol: string; name: string; category: string }> = [
  { symbol: '░', name: '道路', category: '道路' },
];

/** 建筑符号 */
export const BUILDING_SYMBOLS: Array<{ symbol: string; name: string; category: string }> = [
  { symbol: '┌', name: '墙(左上)', category: '建筑' },
  { symbol: '┐', name: '墙(右上)', category: '建筑' },
  { symbol: '└', name: '墙(左下)', category: '建筑' },
  { symbol: '┘', name: '墙(右下)', category: '建筑' },
  { symbol: '─', name: '墙(横)', category: '建筑' },
  { symbol: '│', name: '墙(竖)', category: '建筑' },
  { symbol: '▒', name: '填充', category: '建筑' },
];

/** 装饰符号 */
export const DECORATION_SYMBOLS: Array<{ symbol: string; name: string; category: string }> = [
  { symbol: '!', name: '事件点', category: '装饰' },
  { symbol: '?', name: '未知', category: '装饰' },
  { symbol: '%', name: '废墟', category: '装饰' },
  { symbol: '&', name: '宝箱', category: '装饰' },
  { symbol: '$', name: '商队', category: '装饰' },
  { symbol: '@', name: '玩家', category: '装饰' },
];

/** 所有符号 */
export const ALL_SYMBOLS = [
  ...TERRAIN_SYMBOLS,
  ...ROAD_SYMBOLS,
  ...BUILDING_SYMBOLS,
  ...DECORATION_SYMBOLS,
];

// ─────────────────────────────────────────────
// MapEditor
// ─────────────────────────────────────────────

/**
 * 地图编辑器引擎
 */
export class MapEditor {
  private state: EditorState;
  private metadata: MapMetadata;
  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private maxHistory = 50;
  private listeners: Set<() => void> = new Set();

  constructor(width = 100, height = 60) {
    this.state = {
      width,
      height,
      layers: [
        this.createLayer('terrain', '地形层', 'terrain', true, width, height),
        this.createLayer('road', '道路层', 'road', true, width, height),
        this.createLayer('building', '建筑层', 'building', true, width, height),
        this.createLayer('decoration', '装饰层', 'decoration', true, width, height),
        this.createLayer('event', '事件层', 'event', true, width, height),
      ],
      entities: [],
      activeLayerId: 'terrain',
      selectedEntityId: null,
      brushTool: 'view',
      brushSymbol: '.',
      brushSize: 1,
      showGrid: true,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };

    this.metadata = {
      name: '新地图',
      description: '',
      tileSize: 8,
      cities: [],
      npcs: [],
      events: [],
    };

    this.saveHistory('初始化');
  }

  // ── 图层管理 ─────────────────────────────────

  private createLayer(id: string, name: string, type: LayerType, visible: boolean, w?: number, h?: number): EditorLayer {
    const width = w || this.state?.width || 100;
    const height = h || this.state?.height || 60;
    const data: string[][] = [];
    for (let y = 0; y < height; y++) {
      data[y] = [];
      for (let x = 0; x < width; x++) {
        data[y][x] = type === 'terrain' ? '.' : ' ';
      }
    }
    return { id, name, type, visible, locked: false, opacity: 1, data };
  }

  /** 获取所有图层 */
  getLayers(): EditorLayer[] {
    return this.state.layers;
  }

  /** 获取当前活动图层 */
  getActiveLayer(): EditorLayer {
    return this.state.layers.find(l => l.id === this.state.activeLayerId) || this.state.layers[0];
  }

  /** 设置活动图层 */
  setActiveLayer(layerId: string): void {
    this.state.activeLayerId = layerId;
    this.notify();
  }

  /** 切换图层可见性 */
  toggleLayerVisibility(layerId: string): void {
    const layer = this.state.layers.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      this.notify();
    }
  }

  /** 切换图层锁定 */
  toggleLayerLock(layerId: string): void {
    const layer = this.state.layers.find(l => l.id === layerId);
    if (layer) {
      layer.locked = !layer.locked;
      this.notify();
    }
  }

  /** 设置图层不透明度 */
  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.state.layers.find(l => l.id === layerId);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
      this.notify();
    }
  }

  /** 添加新图层 */
  addLayer(name: string, type: LayerType): void {
    const id = `layer_${Date.now()}`;
    this.state.layers.push(this.createLayer(id, name, type, true));
    this.state.activeLayerId = id;
    this.notify();
  }

  /** 删除图层 */
  removeLayer(layerId: string): void {
    if (this.state.layers.length <= 1) return; // 至少保留一个图层
    this.state.layers = this.state.layers.filter(l => l.id !== layerId);
    if (this.state.activeLayerId === layerId) {
      this.state.activeLayerId = this.state.layers[0].id;
    }
    this.notify();
  }

  /** 移动图层顺序 */
  moveLayer(layerId: string, direction: 'up' | 'down'): void {
    const idx = this.state.layers.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= this.state.layers.length) return;
    const temp = this.state.layers[idx];
    this.state.layers[idx] = this.state.layers[targetIdx];
    this.state.layers[targetIdx] = temp;
    this.notify();
  }

  // ── 实体管理 ─────────────────────────────────

  /** 添加实体 */
  addEntity(entity: Omit<MapEntity, 'id'>): MapEntity {
    const id = `entity_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEntity: MapEntity = { ...entity, id };
    this.state.entities.push(newEntity);
    this.saveHistory('添加实体');
    this.notify();
    return newEntity;
  }

  /** 删除实体 */
  removeEntity(entityId: string): void {
    this.state.entities = this.state.entities.filter(e => e.id !== entityId);
    if (this.state.selectedEntityId === entityId) {
      this.state.selectedEntityId = null;
    }
    this.saveHistory('删除实体');
    this.notify();
  }

  /** 选择实体 */
  selectEntity(entityId: string | null): void {
    this.state.selectedEntityId = entityId;
    this.notify();
  }

  /** 获取选中的实体 */
  getSelectedEntity(): MapEntity | null {
    if (!this.state.selectedEntityId) return null;
    return this.state.entities.find(e => e.id === this.state.selectedEntityId) || null;
  }

  /** 移动实体到新位置 */
  moveEntity(entityId: string, x: number, y: number): void {
    const entity = this.state.entities.find(e => e.id === entityId);
    if (entity) {
      entity.x = Math.max(0, Math.min(this.state.width - entity.width, x));
      entity.y = Math.max(0, Math.min(this.state.height - entity.height, y));
      this.notify();
    }
  }

  /** 重命名实体 */
  renameEntity(entityId: string, name: string): void {
    const entity = this.state.entities.find(e => e.id === entityId);
    if (entity) {
      entity.name = name;
      this.saveHistory('重命名实体');
      this.notify();
    }
  }

  /** 更新实体属性 */
  updateEntity(entityId: string, updates: Partial<Omit<MapEntity, 'id'>>): void {
    const entity = this.state.entities.find(e => e.id === entityId);
    if (entity) {
      Object.assign(entity, updates);
      this.notify();
    }
  }

  /** 获取所有实体 */
  getEntities(): MapEntity[] {
    return this.state.entities;
  }

  /** 按类型获取实体 */
  getEntitiesByType(type: EntityType): MapEntity[] {
    return this.state.entities.filter(e => e.type === type);
  }

  /** 获取指定位置的实体 */
  getEntityAt(gridX: number, gridY: number): MapEntity | null {
    // 从后向前遍历(后添加的在上层)
    for (let i = this.state.entities.length - 1; i >= 0; i--) {
      const e = this.state.entities[i];
      if (gridX >= e.x && gridX < e.x + e.width && gridY >= e.y && gridY < e.y + e.height) {
        return e;
      }
    }
    return null;
  }

  // ── 画笔工具 ─────────────────────────────────

  /** 设置画笔工具 */
  setBrushTool(tool: BrushTool): void {
    this.state.brushTool = tool;
    this.notify();
  }

  /** 设置画笔符号 */
  setBrushSymbol(symbol: string): void {
    this.state.brushSymbol = symbol;
    this.notify();
  }

  /** 设置画笔大小 */
  setBrushSize(size: number): void {
    this.state.brushSize = Math.max(1, Math.min(5, size));
    this.notify();
  }

  /** 获取当前画笔信息 */
  getBrush(): { tool: BrushTool; symbol: string; size: number } {
    return {
      tool: this.state.brushTool,
      symbol: this.state.brushSymbol,
      size: this.state.brushSize,
    };
  }

  // ── 绘制操作 ─────────────────────────────────

  /** 在指定位置绘制 */
  paint(gridX: number, gridY: number): void {
    const layer = this.getActiveLayer();
    if (layer.locked) return;

    const size = this.state.brushSize;
    const half = Math.floor(size / 2);

    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const x = gridX + dx;
        const y = gridY + dy;
        if (x >= 0 && x < this.state.width && y >= 0 && y < this.state.height) {
          if (this.state.brushTool === 'erase') {
            layer.data[y][x] = layer.type === 'terrain' ? '.' : ' ';
          } else {
            layer.data[y][x] = this.state.brushSymbol;
          }
        }
      }
    }

    this.notify();
  }

  /** 填充(油漆桶) */
  floodFill(gridX: number, gridY: number): void {
    const layer = this.getActiveLayer();
    if (layer.locked) return;
    if (gridX < 0 || gridX >= this.state.width || gridY < 0 || gridY >= this.state.height) return;

    const targetChar = layer.data[gridY][gridX];
    const fillChar = this.state.brushSymbol;
    if (targetChar === fillChar) return;

    const stack: Array<[number, number]> = [[gridX, gridY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      if (x < 0 || x >= this.state.width || y < 0 || y >= this.state.height) continue;
      if (layer.data[y][x] !== targetChar) continue;

      visited.add(key);
      layer.data[y][x] = fillChar;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    this.saveHistory('填充');
    this.notify();
  }

  /** 吸取颜色(拾取器) */
  pickSymbol(gridX: number, gridY: number): void {
    const layer = this.getActiveLayer();
    if (gridX >= 0 && gridX < this.state.width && gridY >= 0 && gridY < this.state.height) {
      this.state.brushSymbol = layer.data[gridY][gridX];
      this.notify();
    }
  }

  // ── 视口控制 ─────────────────────────────────

  /** 设置缩放 */
  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.25, Math.min(4, zoom));
    this.notify();
  }

  /** 设置视口偏移 */
  setOffset(x: number, y: number): void {
    this.state.offsetX = x;
    this.state.offsetY = y;
    this.notify();
  }

  /** 切换网格显示 */
  toggleGrid(): void {
    this.state.showGrid = !this.state.showGrid;
    this.notify();
  }

  // ── 历史记录 ─────────────────────────────────

  /** 保存历史(绘制前调用) — 整体快照 */
  saveHistory(description: string): void {
    // 截断后续历史(撤销后又绘制，丢弃被覆盖的未来)
    this.history = this.history.slice(0, this.historyIndex + 1);

    // 保存所有图层数据+实体的完整快照
    const entry: HistoryEntry = {
      layerSnapshots: this.state.layers.map(l => ({
        layerId: l.id,
        data: l.data.map(row => [...row]),
      })),
      entitySnapshot: this.state.entities.map(e => ({ ...e, data: { ...e.data } })),
      description,
    };

    this.history.push(entry);

    // 限制历史步数
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  /** 撤销 */
  undo(): void {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.restoreFromHistory();
  }

  /** 重做 */
  redo(): void {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.restoreFromHistory();
  }

  /** 获取历史信息(用于UI显示) */
  getHistoryInfo(): { current: number; total: number; canUndo: boolean; canRedo: boolean } {
    return {
      current: this.historyIndex,
      total: this.history.length,
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1,
    };
  }

  private restoreFromHistory(): void {
    const entry = this.history[this.historyIndex];
    if (!entry) return;

    // 从快照恢复所有图层数据
    for (const snapshot of entry.layerSnapshots) {
      const layer = this.state.layers.find(l => l.id === snapshot.layerId);
      if (layer) {
        layer.data = snapshot.data.map(row => [...row]);
      }
    }

    // 从快照恢复实体
    if (entry.entitySnapshot) {
      this.state.entities = entry.entitySnapshot.map(e => ({ ...e, data: { ...e.data } }));
    }

    this.notify();
  }

  // ── 元信息管理 ───────────────────────────────

  /** 获取元信息 */
  getMetadata(): MapMetadata {
    return { ...this.metadata };
  }

  /** 设置地图名称 */
  setMapName(name: string): void {
    this.metadata.name = name;
    this.notify();
  }

  /** 设置地图描述 */
  setMapDescription(desc: string): void {
    this.metadata.description = desc;
    this.notify();
  }

  /** 添加城市 */
  addCity(city: MapMetadata['cities'][0]): void {
    this.metadata.cities.push(city);
    this.notify();
  }

  /** 删除城市 */
  removeCity(id: string): void {
    this.metadata.cities = this.metadata.cities.filter(c => c.id !== id);
    this.notify();
  }

  /** 添加NPC */
  addNpc(npc: MapMetadata['npcs'][0]): void {
    this.metadata.npcs.push(npc);
    this.notify();
  }

  /** 添加事件点 */
  addEvent(event: MapMetadata['events'][0]): void {
    this.metadata.events.push(event);
    this.notify();
  }

  // ── 导出 ─────────────────────────────────────

  /** 合并所有可见图层为ASCII地图 */
  mergeToASCII(): string {
    const lines: string[] = [];

    // 头部
    lines.push(`# ${this.metadata.name}`);
    lines.push(`# ${this.metadata.description}`);
    lines.push(`MAP:${this.metadata.name}`);
    lines.push(`SIZE:${this.state.width}x${this.state.height}`);
    lines.push(`TILE:${this.metadata.tileSize}`);
    lines.push('');

    // 城市映射
    if (this.metadata.cities.length > 0) {
      const cityEntries = this.metadata.cities.map(c => `${c.id}=${c.name}`).join(',');
      lines.push(`CITY: ${cityEntries}`);
      lines.push('');
    }

    // 合并图层(从底到顶)
    const merged: string[][] = [];
    for (let y = 0; y < this.state.height; y++) {
      merged[y] = [];
      for (let x = 0; x < this.state.width; x++) {
        merged[y][x] = ' ';
      }
    }

    for (const layer of this.state.layers) {
      if (!layer.visible) continue;
      for (let y = 0; y < this.state.height; y++) {
        for (let x = 0; x < this.state.width; x++) {
          const ch = layer.data[y]?.[x];
          if (ch && ch !== ' ') {
            merged[y][x] = ch;
          }
        }
      }
    }

    // 输出
    for (let y = 0; y < this.state.height; y++) {
      lines.push(merged[y].join(''));
    }

    return lines.join('\n');
  }

  /** 导出元信息JSON */
  exportMetadata(): string {
    return JSON.stringify(this.metadata, null, 2);
  }

  /** 导出完整地图包(ASCII + 元信息) */
  exportMapPackage(): { ascii: string; metadata: string; combined: string } {
    const ascii = this.mergeToASCII();
    const metadata = this.exportMetadata();

    const combined = [
      '=== MAP_DATA_START ===',
      ascii,
      '=== MAP_DATA_END ===',
      '',
      '=== METADATA_START ===',
      metadata,
      '=== METADATA_END ===',
    ].join('\n');

    return { ascii, metadata, combined };
  }

  /** 下载地图文件 */
  downloadMap(): void {
    const { combined } = this.exportMapPackage();
    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.metadata.name || 'map'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── 状态访问 ─────────────────────────────────

  /** 获取编辑器状态(只读) */
  getState(): Readonly<EditorState> {
    return this.state;
  }

  /** 获取地图尺寸 */
  getSize(): { width: number; height: number } {
    return { width: this.state.width, height: this.state.height };
  }

  /** 获取网格坐标(从屏幕坐标) */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    const ts = 8 * this.state.zoom;
    const x = Math.floor((screenX + this.state.offsetX) / ts);
    const y = Math.floor((screenY + this.state.offsetY) / ts);
    if (x >= 0 && x < this.state.width && y >= 0 && y < this.state.height) {
      return { x, y };
    }
    return null;
  }

  // ── 监听器 ───────────────────────────────────

  /** 注册变更监听 */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
    // 自动保存到localStorage
    this.saveToLocalStorage();
  }

  // ── 持久化 ───────────────────────────────────

  private static readonly STORAGE_KEY = 'map-editor-data';

  /** 保存到localStorage */
  saveToLocalStorage(): void {
    try {
      const data = this.exportStateJSON();
      localStorage.setItem(MapEditor.STORAGE_KEY, data);
    } catch {
      // localStorage不可用时静默处理
    }
  }

  /** 从localStorage加载 */
  loadFromLocalStorage(): boolean {
    try {
      const data = localStorage.getItem(MapEditor.STORAGE_KEY);
      if (data) {
        this.importStateJSON(data);
        return true;
      }
    } catch {
      // 数据损坏时静默处理
    }
    return false;
  }

  /** 清除localStorage */
  clearLocalStorage(): void {
    try {
      localStorage.removeItem(MapEditor.STORAGE_KEY);
    } catch {
      // 静默处理
    }
  }

  // ── JSON导入/导出 ────────────────────────────

  /** 导出完整状态为JSON字符串 */
  exportStateJSON(): string {
    const exportData = {
      version: 2,
      state: {
        width: this.state.width,
        height: this.state.height,
        layers: this.state.layers.map(l => ({
          id: l.id,
          name: l.name,
          type: l.type,
          visible: l.visible,
          locked: l.locked,
          opacity: l.opacity,
          data: l.data,
        })),
        entities: this.state.entities,
        activeLayerId: this.state.activeLayerId,
        brushTool: this.state.brushTool,
        brushSymbol: this.state.brushSymbol,
        brushSize: this.state.brushSize,
        showGrid: this.state.showGrid,
      },
      metadata: this.metadata,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }

  /** 从JSON字符串导入状态 */
  importStateJSON(json: string): void {
    const data = JSON.parse(json);

    if (data.state) {
      this.state.width = data.state.width || 100;
      this.state.height = data.state.height || 60;
      this.state.layers = data.state.layers || [];
      this.state.entities = data.state.entities || [];
      this.state.activeLayerId = data.state.activeLayerId || 'terrain';
      this.state.selectedEntityId = null;
      this.state.brushTool = data.state.brushTool || 'paint';
      this.state.brushSymbol = data.state.brushSymbol || '.';
      this.state.brushSize = data.state.brushSize || 1;
      this.state.showGrid = data.state.showGrid ?? true;
    }

    if (data.metadata) {
      this.metadata = data.metadata;
    }

    this.notify();
  }

  /** 下载JSON文件 */
  downloadJSON(): void {
    const json = this.exportStateJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.metadata.name || 'map'}-editor.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 从文件导入JSON */
  importFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          this.importStateJSON(json);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ── ASCII地图导入 ────────────────────────────

  /** 从ParsedMap导入地图数据(ASCII文件导入) */
  importFromParsedMap(parsed: ParsedMap, fileName?: string): void {
    // 调整地图尺寸
    this.state.width = parsed.width;
    this.state.height = parsed.height;

    // 重建图层
    this.state.layers = [
      this.createLayer('terrain', '地形层', 'terrain', true),
      this.createLayer('road', '道路层', 'road', true),
      this.createLayer('building', '建筑层', 'building', true),
      this.createLayer('decoration', '装饰层', 'decoration', true),
      this.createLayer('event', '事件层', 'event', true),
    ];

    const terrainLayer = this.state.layers.find(l => l.type === 'terrain')!;
    const roadLayer = this.state.layers.find(l => l.type === 'road')!;
    const buildingLayer = this.state.layers.find(l => l.type === 'building')!;
    const eventLayer = this.state.layers.find(l => l.type === 'event')!;

    // ASCII符号→编辑器图层的映射
    const terrainChars: Record<string, string> = {
      plain: '.', mountain: '^', water: '~', forest: '#',
      grass: ',', desert: '*', mud: '_',
    };
    const roadChars = new Set(['road_h', 'road_v', 'road_cross', 'road_diag', 'path']);
    const buildingChars = new Set([
      'wall_h', 'wall_v', 'wall_tl', 'wall_tr', 'wall_bl', 'wall_br',
      'wall_t', 'wall_t_r', 'wall_t_d', 'wall_t_u', 'wall_cross',
      'city', 'resource', 'outpost',
    ]);

    // 遍历解析后的地图矩阵，分配到各图层
    for (let y = 0; y < parsed.height; y++) {
      for (let x = 0; x < parsed.width; x++) {
        const cell = parsed.cells[y]?.[x];
        if (!cell) continue;

        const { terrain, char } = cell;

        if (terrainChars[terrain]) {
          terrainLayer.data[y][x] = terrainChars[terrain];
        } else if (roadChars.has(terrain)) {
          roadLayer.data[y][x] = char || '░';
        } else if (buildingChars.has(terrain)) {
          buildingLayer.data[y][x] = char;
        } else if (terrain === 'event') {
          eventLayer.data[y][x] = char;
        } else if (terrain === 'player') {
          eventLayer.data[y][x] = '@';
        } else if (terrain === 'ruins' || terrain === 'chest' || terrain === 'caravan' || terrain === 'unknown') {
          eventLayer.data[y][x] = char;
        } else if (char && char !== ' ') {
          // 其他非空字符放入地形层
          terrainLayer.data[y][x] = char;
        }
      }
    }

    // 更新元信息
    this.metadata.name = parsed.name || fileName || '导入地图';
    this.metadata.tileSize = parsed.tileSize;

    // 从cityMap提取城市信息
    this.metadata.cities = parsed.cities.map(c => ({
      id: c.id,
      name: parsed.cityMap[c.char] || c.id,
      x: c.x,
      y: c.y,
      faction: 'neutral',
      level: 1,
    }));

    // 重置视口和实体
    this.state.activeLayerId = 'terrain';
    this.state.entities = [];
    this.state.selectedEntityId = null;
    this.state.offsetX = 0;
    this.state.offsetY = 0;
    this.state.zoom = 1;

    // 重置历史
    this.history = [];
    this.historyIndex = -1;
    this.saveHistory('导入地图');
    this.notify();
  }

  // ── 新建地图 ─────────────────────────────────

  /** 新建空白地图 */
  newMap(width = 100, height = 60, name = '新地图'): void {
    this.state.width = width;
    this.state.height = height;
    this.state.layers = [
      this.createLayer('terrain', '地形层', 'terrain', true),
      this.createLayer('road', '道路层', 'road', true),
      this.createLayer('building', '建筑层', 'building', true),
      this.createLayer('decoration', '装饰层', 'decoration', true),
      this.createLayer('event', '事件层', 'event', true),
    ];
    this.state.activeLayerId = 'terrain';
    this.state.entities = [];
    this.state.selectedEntityId = null;
    this.state.offsetX = 0;
    this.state.offsetY = 0;
    this.state.zoom = 1;
    this.metadata = {
      name,
      description: '',
      tileSize: 8,
      cities: [],
      npcs: [],
      events: [],
    };
    this.history = [];
    this.historyIndex = -1;
    this.notify();
  }
}
