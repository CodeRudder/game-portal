/**
 * 独立地图编辑器页面
 *
 * 可单独运行，不依赖游戏主程序。
 * 支持 localStorage 持久化 + JSON/ASCII 导入导出 + 实体管理。
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapEditor, ALL_SYMBOLS, type BrushTool, type EditorLayer, type MapEntity, type EntityType } from '../../../../../games/three-kingdoms/engine/map/editor/MapEditor';
import { ASCIIMapParser } from '../../../../../games/three-kingdoms/core/map/ASCIIMapParser';
import { PixelMapRenderer } from '../../../../../games/three-kingdoms/engine/map/PixelMapRenderer';
import './MapEditorPanel.css';

/** 实体类型预设 */
const ENTITY_PRESETS: Array<{ type: EntityType; name: string; symbol: string; icon: string }> = [
  { type: 'building', name: '城池', symbol: 'C', icon: '🏰' },
  { type: 'building', name: '关隘', symbol: 'G', icon: '⛩️' },
  { type: 'building', name: '村落', symbol: 'V', icon: '🏘️' },
  { type: 'npc', name: '商人', symbol: '$', icon: '💰' },
  { type: 'npc', name: '将领', symbol: '@', icon: '⚔️' },
  { type: 'event', name: '事件', symbol: '!', icon: '❗' },
  { type: 'event', name: '宝箱', symbol: '&', icon: '📦' },
  { type: 'resource', name: '矿脉', symbol: 'm', icon: '⛏️' },
  { type: 'resource', name: '农田', symbol: 'f', icon: '🌾' },
];

export const MapEditorStandalone: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<MapEditor | null>(null);
  const rendererRef = useRef<PixelMapRenderer | null>(null);
  const parserRef = useRef<ASCIIMapParser | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const asciiFileInputRef = useRef<HTMLInputElement>(null);

  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('terrain');
  const [brush, setBrush] = useState({ tool: 'view' as BrushTool, symbol: '.', size: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [mapName, setMapName] = useState('新地图');
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [historyInfo, setHistoryInfo] = useState({ current: 0, total: 0, canUndo: false, canRedo: false });
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 实体相关状态
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [entityPlacementPreset, setEntityPlacementPreset] = useState<typeof ENTITY_PRESETS[0] | null>(null);
  const [isDraggingEntity, setIsDraggingEntity] = useState(false);
  const [entityDragStart, setEntityDragStart] = useState<{ x: number; y: number } | null>(null);

  // 初始化
  useEffect(() => {
    if (!canvasRef.current) return;

    const editor = new MapEditor(100, 60);
    editorRef.current = editor;

    const loaded = editor.loadFromLocalStorage();
    if (loaded) {
      setStatusMsg('已从本地恢复上次编辑');
      setMapName(editor.getMetadata().name);
    }

    const parser = new ASCIIMapParser();
    parserRef.current = parser;
    const renderer = new PixelMapRenderer(canvasRef.current, {
      tileSize: 8,
      scale: 1,
      showCityNames: false,
      showGrid: true,
    });
    rendererRef.current = renderer;

    editor.onChange(() => {
      setLayers([...editor.getLayers()]);
      setActiveLayerId(editor.getState().activeLayerId);
      setBrush(editor.getBrush());
      setShowGrid(editor.getState().showGrid);
      setZoom(editor.getState().zoom);
      setHistoryInfo(editor.getHistoryInfo());
      setEntities([...editor.getEntities()]);
      setSelectedEntityId(editor.getState().selectedEntityId);
    });

    setLayers(editor.getLayers());
    setEntities(editor.getEntities());
    setHistoryInfo(editor.getHistoryInfo());
    renderMap(editor, renderer, parser);
    renderEntities(editor, canvasRef.current);

    // 原生wheel事件(React的onWheel是passive，无法preventDefault)
    const canvas = canvasRef.current;
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const state = editor.getState();

      // 触摸板双指张开/合拢 → 缩放(deltaY + ctrlKey)
      if (e.ctrlKey || Math.abs(e.deltaY) > 50) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        editor.setZoom(state.zoom + delta);
        return;
      }

      // 平滑平移(浮点偏移，0.5阻尼系数降低速度)
      const damping = 0.5;
      panTo(editor, canvas, state.offsetX + e.deltaX * damping, state.offsetY + e.deltaY * damping);
      // 停止后对齐到色块边界
      scheduleSnap(editor);
    };

    /** 延迟对齐到色块网格 */
    const scheduleSnap = (ed: MapEditor) => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(() => {
        const st = ed.getState();
        const ts = 8 * st.zoom;
        const snappedX = Math.round(st.offsetX / ts) * ts;
        const snappedY = Math.round(st.offsetY / ts) * ts;
        panTo(ed, canvas, snappedX, snappedY);
      }, 150);
    };
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

    let animId: number;
    let dirty = true;
    editor.onChange(() => { dirty = true; });

    const animate = () => {
      if (dirty) {
        dirty = false;
        const state = editor.getState();
        renderer.setScale(state.zoom);
        renderer.setViewport(state.offsetX, state.offsetY);
        renderMap(editor, renderer, parser);
        renderEntities(editor, canvasRef.current);
        renderMinimap(editor, minimapRef.current, canvasRef.current);
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // ── 键盘快捷键 ─────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const editor = editorRef.current;
      if (!editor) return;

      // Delete: 删除选中实体
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEntityId && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          editor.removeEntity(selectedEntityId);
          setStatusMsg('已删除实体');
          return;
        }
      }

      // 方向键: 移动选中实体
      if (selectedEntityId && !(e.target instanceof HTMLInputElement)) {
        const entity = editor.getEntities().find(e2 => e2.id === selectedEntityId);
        if (entity) {
          const step = (e.ctrlKey || e.metaKey) ? 5 : 1;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          else if (e.key === 'ArrowRight') dx = step;
          else if (e.key === 'ArrowUp') dy = -step;
          else if (e.key === 'ArrowDown') dy = step;
          if (dx !== 0 || dy !== 0) {
            e.preventDefault();
            editor.saveHistory('移动实体');
            editor.moveEntity(selectedEntityId, entity.x + dx, entity.y + dy);
            setStatusMsg(`移动 (${entity.x + dx}, ${entity.y + dy})`);
            return;
          }
        }
      }

      // Ctrl+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
        setStatusMsg('撤销');
      }
      // Ctrl+Y 或 Ctrl+Shift+Z: 重做
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        editor.redo();
        setStatusMsg('重做');
      }
      // Escape: 取消实体放置模式
      else if (e.key === 'Escape') {
        setEntityPlacementPreset(null);
        editor.selectEntity(null);
      }
      // V: 查看
      else if (e.key === 'v' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.setBrushTool('view');
        setEntityPlacementPreset(null);
      }
      // B: 画笔
      else if (e.key === 'b' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.setBrushTool('paint');
        setEntityPlacementPreset(null);
      }
      // E: 橡皮
      else if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.setBrushTool('erase');
        setEntityPlacementPreset(null);
      }
      // F: 填充
      else if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.setBrushTool('fill');
        setEntityPlacementPreset(null);
      }
      // I: 拾取
      else if (e.key === 'i' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.setBrushTool('pick');
        setEntityPlacementPreset(null);
      }
      // G: 网格
      else if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.toggleGrid();
      }
      // 1~5: 画笔大小
      else if (['1', '2', '3', '4', '5'].includes(e.key) && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        editor.setBrushSize(parseInt(e.key));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntityId]);

  // 渲染
  /** 平滑平移并限制边界 */
  const panTo = useCallback((editor: MapEditor, canvas: HTMLCanvasElement, x: number, y: number) => {
    const state = editor.getState();
    const ts = 8 * state.zoom;
    const mapW = state.width * ts;
    const mapH = state.height * ts;
    const cW = canvas.width;
    const cH = canvas.height;

    // 允许地图边缘最多露出视口30%的黑色区域
    const margin = 0.3;
    const minX = -(mapW * margin);
    const maxX = mapW - cW * (1 - margin);
    const minY = -(mapH * margin);
    const maxY = mapH - cH * (1 - margin);

    const cx = mapW <= cW ? (mapW - cW) / 2 : Math.max(minX, Math.min(maxX, x));
    const cy = mapH <= cH ? (mapH - cH) / 2 : Math.max(minY, Math.min(maxY, y));

    editor.setOffset(cx, cy);
  }, []);

  const renderMap = useCallback((editor: MapEditor, renderer: PixelMapRenderer, parser: ASCIIMapParser) => {
    const ascii = editor.mergeToASCII();
    try {
      const map = parser.parse(ascii);
      renderer.loadMap(map);
      renderer.render();
    } catch { /* 忽略解析错误 */ }
  }, []);

  /** 在Canvas上渲染实体标记和选中高亮 */
  const renderEntities = useCallback((editor: MapEditor, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = editor.getState();
    const ts = 8 * state.zoom;
    const entities = editor.getEntities();
    const selectedId = state.selectedEntityId;

    for (const entity of entities) {
      const px = entity.x * ts - state.offsetX;
      const py = entity.y * ts - state.offsetY;
      const w = entity.width * ts;
      const h = entity.height * ts;

      // 跳过不在视口内的实体
      if (px + w < 0 || px > canvas.width || py + h < 0 || py > canvas.height) continue;

      // 阵营颜色
      const factionColors: Record<string, string> = {
        wei: '#2E5090', shu: '#8B2500', wu: '#2E6B3E', neutral: '#6B5B3E',
      };
      const color = factionColors[entity.faction] || factionColors.neutral;

      // 实体填充(纯色块，无轮廓)
      ctx.fillStyle = color;
      ctx.fillRect(px, py, w, h);

      // 实体名称
      const fontSize = Math.max(8, ts * 0.9);
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 文字阴影
      ctx.fillStyle = '#000000';
      ctx.fillText(entity.name, px + w / 2 + 1, py + h / 2 + 1);
      // 文字
      ctx.fillStyle = '#ffffff';
      ctx.fillText(entity.name, px + w / 2, py + h / 2);

      // 选中高亮(红色虚线边框)
      if (entity.id === selectedId) {
        ctx.save();
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(px - 2, py - 2, w + 4, h + 4);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }, []);

  /** 渲染鸟瞰小地图 */
  const renderMinimap = useCallback((editor: MapEditor, minimap: HTMLCanvasElement | null, mainCanvas: HTMLCanvasElement | null) => {
    if (!minimap || !mainCanvas) return;
    const ctx = minimap.getContext('2d');
    if (!ctx) return;

    const state = editor.getState();
    const ts = 8 * state.zoom;
    const mapW = state.width * ts;
    const mapH = state.height * ts;

    // 小地图固定尺寸
    const mmW = minimap.width;
    const mmH = minimap.height;
    const scale = Math.min(mmW / mapW, mmH / mapH);

    ctx.clearRect(0, 0, mmW, mmH);

    // 背景
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, mmW, mmH);

    // 地图缩略(简化绘制：按图层颜色块)
    const layers = editor.getLayers();
    const terrainColors: Record<string, string> = {
      '.': '#7ec850', '^': '#8b7355', '~': '#2d6b8a', '#': '#2e5a2e',
      ',': '#a8d88a', '*': '#d4b896', '_': '#6b5b3e', '░': '#b8a07a',
      '▒': '#8b6914',
    };
    const pixelScale = scale * ts;
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          const ch = layer.data[y]?.[x];
          if (!ch || ch === ' ') continue;
          const color = terrainColors[ch];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * pixelScale, y * pixelScale, Math.max(1, pixelScale), Math.max(1, pixelScale));
          }
        }
      }
    }

    // 实体标记
    for (const entity of editor.getEntities()) {
      const ex = entity.x * pixelScale;
      const ey = entity.y * pixelScale;
      const ew = entity.width * pixelScale;
      const eh = entity.height * pixelScale;
      ctx.fillStyle = '#e94560';
      ctx.fillRect(ex, ey, ew, eh);
    }

    // 视口矩形
    const vx = state.offsetX * scale;
    const vy = state.offsetY * scale;
    const vw = mainCanvas.width * scale;
    const vh = mainCanvas.height * scale;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
  }, []);

  /** 小地图点击/拖拽 → 移动主视窗 */
  const handleMinimapNav = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const editor = editorRef.current;
    const minimap = minimapRef.current;
    const mainCanvas = canvasRef.current;
    if (!editor || !minimap || !mainCanvas) return;

    const state = editor.getState();
    const ts = 8 * state.zoom;
    const mapW = state.width * ts;
    const mapH = state.height * ts;
    const scale = Math.min(minimap.width / mapW, minimap.height / mapH);

    const rect = minimap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 点击位置对应的地图坐标(居中)
    const targetOffsetX = mx / scale - mainCanvas.width / 2;
    const targetOffsetY = my / scale - mainCanvas.height / 2;

    panTo(editor, mainCanvas, targetOffsetX, targetOffsetY);
  }, [panTo]);

  // ── 鼠标事件 ─────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 右键/中键: 平移
    if (e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    const grid = editor.screenToGrid(x, y);
    if (!grid) return;

    // 实体放置模式
    if (entityPlacementPreset) {
      editor.addEntity({
        type: entityPlacementPreset.type,
        name: entityPlacementPreset.name,
        x: grid.x,
        y: grid.y,
        width: 3,
        height: 3,
        faction: 'neutral',
        symbol: entityPlacementPreset.symbol,
        data: {},
      });
      setStatusMsg(`已放置${entityPlacementPreset.name} (${grid.x}, ${grid.y})`);
      return;
    }

    // 检查是否点击了实体
    const clickedEntity = editor.getEntityAt(grid.x, grid.y);
    if (clickedEntity) {
      editor.selectEntity(clickedEntity.id);
      setIsDraggingEntity(true);
      setEntityDragStart({ x: grid.x - clickedEntity.x, y: grid.y - clickedEntity.y });
      setStatusMsg(`选中: ${clickedEntity.name}`);
      return;
    }

    // 点击空白区域取消选择
    if (selectedEntityId) {
      editor.selectEntity(null);
    }

    // 查看模式不执行绘制操作
    const currentBrush = editor.getBrush();
    if (currentBrush.tool === 'view') {
      return;
    }

    // 画笔操作
    if (currentBrush.tool === 'fill') {
      editor.floodFill(grid.x, grid.y);
      setStatusMsg(`填充 (${grid.x}, ${grid.y})`);
    } else if (currentBrush.tool === 'pick') {
      editor.pickSymbol(grid.x, grid.y);
      setStatusMsg(`拾取 (${grid.x}, ${grid.y})`);
    } else {
      editor.saveHistory('绘制');
      editor.paint(grid.x, grid.y);
      setIsDragging(true);
      setLastPos(grid);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (isPanning && panStart && canvasRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const state = editor.getState();
      panTo(editor, canvasRef.current, state.offsetX - dx, state.offsetY - dy);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 实体拖动
    if (isDraggingEntity && selectedEntityId && entityDragStart) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const grid = editor.screenToGrid(x, y);
      if (grid) {
        editor.moveEntity(selectedEntityId, grid.x - entityDragStart.x, grid.y - entityDragStart.y);
      }
      return;
    }

    if (!isDragging) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const grid = editor.screenToGrid(x, y);

    if (grid && (!lastPos || grid.x !== lastPos.x || grid.y !== lastPos.y)) {
      editor.paint(grid.x, grid.y);
      setLastPos(grid);
    }
  };

  const handleMouseUp = () => {
    if (isDraggingEntity) {
      const editor = editorRef.current;
      if (editor && selectedEntityId) {
        editor.saveHistory('移动实体');
      }
    }
    // 鼠标拖拽平移结束后，对齐到色块边界
    if (isPanning) {
      const editor = editorRef.current;
      if (editor && canvasRef.current) {
        const state = editor.getState();
        const ts = 8 * state.zoom;
        const snappedX = Math.round(state.offsetX / ts) * ts;
        const snappedY = Math.round(state.offsetY / ts) * ts;
        panTo(editor, canvasRef.current, snappedX, snappedY);
      }
    }
    setIsDragging(false);
    setLastPos(null);
    setIsPanning(false);
    setPanStart(null);
    setIsDraggingEntity(false);
    setEntityDragStart(null);
  };

  const handleZoomIn = () => editorRef.current?.setZoom(editorRef.current.getState().zoom + 0.25);
  const handleZoomOut = () => editorRef.current?.setZoom(editorRef.current.getState().zoom - 0.25);
  const handleZoomReset = () => editorRef.current?.setZoom(1);

  /** 自动缩放居中 — 地图完整显示在画布中 */
  const handleZoomFit = () => {
    const editor = editorRef.current;
    const canvas = canvasRef.current;
    if (!editor || !canvas) return;
    const state = editor.getState();
    const ts = 8; // 基础tileSize
    // 计算适配缩放比例
    const scaleX = canvas.width / (state.width * ts);
    const scaleY = canvas.height / (state.height * ts);
    const fitZoom = Math.min(scaleX, scaleY);
    // 限制在合理范围，步进到0.25的倍数
    const zoom = Math.max(0.25, Math.min(4, Math.round(fitZoom * 4) / 4));
    editor.setZoom(zoom);
    // 居中偏移
    const scaledTs = ts * zoom;
    const offsetX = (state.width * scaledTs - canvas.width) / 2;
    const offsetY = (state.height * scaledTs - canvas.height) / 2;
    editor.setOffset(offsetX, offsetY);
  };

  // ── 工具栏操作 ───────────────────────────────

  const handleToolChange = (tool: BrushTool) => {
    setEntityPlacementPreset(null);
    editorRef.current?.setBrushTool(tool);
  };
  const handleSymbolSelect = (symbol: string) => {
    setEntityPlacementPreset(null);
    editorRef.current?.setBrushSymbol(symbol);
    editorRef.current?.setBrushTool('paint');
  };
  const handleBrushSizeChange = (size: number) => editorRef.current?.setBrushSize(size);
  const handleUndo = () => { editorRef.current?.undo(); setStatusMsg('撤销'); };
  const handleRedo = () => { editorRef.current?.redo(); setStatusMsg('重做'); };
  const handleToggleGrid = () => editorRef.current?.toggleGrid();

  // ── 实体操作 ─────────────────────────────────

  const handleEntityPresetSelect = (preset: typeof ENTITY_PRESETS[0]) => {
    setEntityPlacementPreset(preset);
    setStatusMsg(`放置模式: ${preset.name} (点击画布放置, Esc取消)`);
  };

  const handleEntitySelect = (id: string) => {
    editorRef.current?.selectEntity(id);
  };

  const handleEntityDelete = (id: string) => {
    if (confirm('确定删除此实体?')) {
      editorRef.current?.removeEntity(id);
      setStatusMsg('已删除实体');
    }
  };

  const handleEntityRename = (id: string) => {
    const entity = entities.find(e => e.id === id);
    if (!entity) return;
    const newName = prompt('实体名称:', entity.name);
    if (newName && newName !== entity.name) {
      editorRef.current?.renameEntity(id, newName);
      setStatusMsg(`已重命名为: ${newName}`);
    }
  };

  // ── 图层操作 ─────────────────────────────────

  const handleLayerSelect = (id: string) => editorRef.current?.setActiveLayer(id);
  const handleLayerVisibility = (id: string) => editorRef.current?.toggleLayerVisibility(id);
  const handleLayerLock = (id: string) => editorRef.current?.toggleLayerLock(id);
  const handleLayerMove = (id: string, dir: 'up' | 'down') => editorRef.current?.moveLayer(id, dir);
  const handleAddLayer = () => { const name = prompt('图层名称:'); if (name) editorRef.current?.addLayer(name, 'decoration'); };
  const handleRemoveLayer = (id: string) => { if (confirm('确定删除?')) editorRef.current?.removeLayer(id); };

  // ── 文件操作 ─────────────────────────────────

  const handleNewMap = () => {
    const w = parseInt(prompt('地图宽度:', '100') || '100');
    const h = parseInt(prompt('地图高度:', '60') || '60');
    const name = prompt('地图名称:', '新地图') || '新地图';
    editorRef.current?.newMap(w, h, name);
    setMapName(name);
    setStatusMsg('已创建新地图');
  };

  const handleSaveJSON = () => {
    editorRef.current?.downloadJSON();
    setStatusMsg('JSON已下载');
  };

  const handleExportASCII = () => {
    editorRef.current?.downloadMap();
    setStatusMsg('ASCII地图已下载');
  };

  const handleImportJSON = () => jsonFileInputRef.current?.click();

  const handleJSONFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await editorRef.current?.importFromFile(file);
      setMapName(editorRef.current?.getMetadata().name || '导入地图');
      setStatusMsg(`已导入JSON: ${file.name}`);
    } catch {
      setStatusMsg('导入失败: JSON格式错误');
    }
    e.target.value = '';
  };

  const handleImportASCII = () => asciiFileInputRef.current?.click();

  const handleASCIIFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parser = parserRef.current;
      const editor = editorRef.current;
      if (!parser || !editor) return;

      const parsed = parser.parse(text);
      const confirmed = confirm(
        `导入地图: ${parsed.name}\n` +
        `尺寸: ${parsed.width}x${parsed.height}\n` +
        `城市: ${parsed.cities.length}个\n` +
        `道路: ${parsed.roads.length}段\n\n` +
        `确定导入? (将替换当前地图)`
      );
      if (!confirmed) return;

      editor.importFromParsedMap(parsed, file.name);
      setMapName(parsed.name);
      setStatusMsg(`已导入ASCII地图: ${parsed.name} (${parsed.width}x${parsed.height})`);
    } catch (err) {
      setStatusMsg(`导入失败: ${err instanceof Error ? err.message : '格式错误'}`);
    }
    e.target.value = '';
  };

  const handleMapNameChange = (name: string) => {
    setMapName(name);
    editorRef.current?.setMapName(name);
  };

  // ── 符号分类 ─────────────────────────────────

  const symbolCategories = ALL_SYMBOLS.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof ALL_SYMBOLS>);

  // ── 实体按类型分组 ─────────────────────────

  const entityGroups = entities.reduce((acc, e) => {
    if (!acc[e.type]) acc[e.type] = [];
    acc[e.type].push(e);
    return acc;
  }, {} as Record<string, MapEntity[]>);

  const selectedEntity = selectedEntityId ? entities.find(e => e.id === selectedEntityId) : null;

  return (
    <div className="map-editor">
      {/* 隐藏文件输入 */}
      <input ref={jsonFileInputRef} type="file" accept=".json" onChange={handleJSONFileChange} style={{ display: 'none' }} />
      <input ref={asciiFileInputRef} type="file" accept=".txt,.ascii,.map" onChange={handleASCIIFileChange} style={{ display: 'none' }} />

      {/* 工具栏 */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button onClick={handleNewMap} title="新建地图">📄 新建</button>
          <button onClick={handleImportJSON} title="导入JSON编辑数据">📂 导入JSON</button>
          <button onClick={handleImportASCII} title="导入ASCII地图文件">🗺️ 导入地图</button>
          <button onClick={handleSaveJSON} title="保存JSON">💾 保存</button>
          <button onClick={handleExportASCII} title="导出ASCII">📝 导出</button>
        </div>

        <div className="toolbar-group">
          <label>名称:</label>
          <input type="text" value={mapName} onChange={e => handleMapNameChange(e.target.value)} className="map-name-input" />
        </div>

        <div className="toolbar-group">
          <label>工具:</label>
          <button className={brush.tool === 'view' && !entityPlacementPreset ? 'active' : ''} onClick={() => handleToolChange('view')} title="查看(V)">👁️</button>
          <button className={brush.tool === 'paint' && !entityPlacementPreset ? 'active' : ''} onClick={() => handleToolChange('paint')} title="画笔(B)">✏️</button>
          <button className={brush.tool === 'erase' ? 'active' : ''} onClick={() => handleToolChange('erase')} title="橡皮(E)">🧹</button>
          <button className={brush.tool === 'fill' ? 'active' : ''} onClick={() => handleToolChange('fill')} title="填充(F)">🪣</button>
          <button className={brush.tool === 'pick' ? 'active' : ''} onClick={() => handleToolChange('pick')} title="拾取(I)">💉</button>
        </div>

        <div className="toolbar-group">
          <label>大小:</label>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} className={brush.size === s ? 'active' : ''} onClick={() => handleBrushSizeChange(s)}>{s}</button>
          ))}
        </div>

        <div className="toolbar-group">
          <button onClick={handleUndo} title="撤销(Ctrl+Z)" disabled={!historyInfo.canUndo}>↩️</button>
          <button onClick={handleRedo} title="重做(Ctrl+Y)" disabled={!historyInfo.canRedo}>↪️</button>
          <button onClick={handleToggleGrid} title="网格(G)">{showGrid ? '🔲' : '⬜'}</button>
        </div>

        <div className="toolbar-group">
          <label>缩放:</label>
          <button onClick={handleZoomOut} title="缩小">−</button>
          <span className="zoom-display" onClick={handleZoomReset} title="点击重置">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} title="放大">+</button>
          <button onClick={handleZoomFit} title="适配视窗">⊞</button>
        </div>
      </div>

      <div className="editor-body">
        {/* 左侧: 符号面板 + 实体放置 */}
        <div className="symbol-panel">
          <h4>图块</h4>
          {Object.entries(symbolCategories).map(([category, symbols]) => (
            <div key={category} className="symbol-category">
              <div className="category-title">{category}</div>
              <div className="symbol-grid">
                {symbols.map(s => (
                  <button
                    key={s.symbol}
                    className={`symbol-btn ${brush.symbol === s.symbol && !entityPlacementPreset ? 'active' : ''}`}
                    onClick={() => handleSymbolSelect(s.symbol)}
                    title={s.name}
                  >
                    {s.symbol === ' ' ? '␣' : s.symbol}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="current-symbol">
            当前: <span className="symbol-preview">{entityPlacementPreset ? entityPlacementPreset.icon : (brush.symbol === ' ' ? '␣' : brush.symbol)}</span>
            <span className="symbol-name">{entityPlacementPreset ? `放置: ${entityPlacementPreset.name}` : (ALL_SYMBOLS.find(s => s.symbol === brush.symbol)?.name || '')}</span>
          </div>

          {/* 实体放置面板 */}
          <h4 style={{ marginTop: 16 }}>放置实体</h4>
          <div className="entity-presets">
            {ENTITY_PRESETS.map((preset, i) => (
              <button
                key={i}
                className={`entity-preset-btn ${entityPlacementPreset === preset ? 'active' : ''}`}
                onClick={() => handleEntityPresetSelect(preset)}
                title={preset.name}
              >
                {preset.icon}
              </button>
            ))}
          </div>
          {entityPlacementPreset && (
            <div className="placement-hint">
              点击画布放置 | Esc取消
            </div>
          )}
        </div>

        {/* 中间: 画布 */}
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={480}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={e => e.preventDefault()}
            className="editor-canvas"
          />
          {/* 鸟瞰小地图 */}
          {showMinimap && (
            <canvas
              ref={minimapRef}
              width={180}
              height={120}
              className="minimap"
              onMouseDown={handleMinimapNav}
              onMouseMove={e => { if (e.buttons === 1) handleMinimapNav(e); }}
            />
          )}
        </div>

        {/* 右侧: 图层 + 实体面板 */}
        <div className="layer-panel">
          <h4>图层</h4>
          <div className="layer-list">
            {[...layers].reverse().map(layer => (
              <div
                key={layer.id}
                className={`layer-item ${layer.id === activeLayerId ? 'active' : ''}`}
                onClick={() => handleLayerSelect(layer.id)}
              >
                <button className="layer-visibility" onClick={e => { e.stopPropagation(); handleLayerVisibility(layer.id); }}>
                  {layer.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <button className="layer-lock" onClick={e => { e.stopPropagation(); handleLayerLock(layer.id); }}>
                  {layer.locked ? '🔒' : '🔓'}
                </button>
                <span className="layer-name">{layer.name}</span>
                <div className="layer-actions">
                  <button onClick={e => { e.stopPropagation(); handleLayerMove(layer.id, 'up'); }}>↑</button>
                  <button onClick={e => { e.stopPropagation(); handleLayerMove(layer.id, 'down'); }}>↓</button>
                  <button onClick={e => { e.stopPropagation(); handleRemoveLayer(layer.id); }}>×</button>
                </div>
              </div>
            ))}
          </div>
          <button className="add-layer-btn" onClick={handleAddLayer}>+ 添加图层</button>

          {/* 实体列表 */}
          <h4 style={{ marginTop: 16 }}>实体 ({entities.length})</h4>
          <div className="entity-list">
            {entities.length === 0 && (
              <div className="entity-empty">无实体，使用左侧放置</div>
            )}
            {Object.entries(entityGroups).map(([type, group]) => (
              <div key={type} className="entity-group">
                <div className="entity-group-title">{type} ({group.length})</div>
                {group.map(entity => (
                  <div
                    key={entity.id}
                    className={`entity-item ${entity.id === selectedEntityId ? 'active' : ''}`}
                    onClick={() => handleEntitySelect(entity.id)}
                  >
                    <span className="entity-icon">{ENTITY_PRESETS.find(p => p.symbol === entity.symbol)?.icon || '📍'}</span>
                    <span className="entity-name">{entity.name}</span>
                    <span className="entity-pos">({entity.x},{entity.y})</span>
                    <div className="entity-actions">
                      <button onClick={e => { e.stopPropagation(); handleEntityRename(entity.id); }} title="重命名">✏️</button>
                      <button onClick={e => { e.stopPropagation(); handleEntityDelete(entity.id); }} title="删除">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* 选中实体信息 */}
          {selectedEntity && (
            <div className="selected-entity-info">
              <div className="info-row"><label>名称:</label> {selectedEntity.name}</div>
              <div className="info-row"><label>类型:</label> {selectedEntity.type}</div>
              <div className="info-row"><label>位置:</label> ({selectedEntity.x}, {selectedEntity.y})</div>
              <div className="info-row"><label>大小:</label> {selectedEntity.width}x{selectedEntity.height}</div>
              <div className="info-row"><label>阵营:</label> {selectedEntity.faction}</div>
            </div>
          )}
        </div>
      </div>

      {/* 状态栏 */}
      <div className="editor-statusbar">
        <span>图层: {layers.find(l => l.id === activeLayerId)?.name}</span>
        <span>工具: {entityPlacementPreset ? `放置${entityPlacementPreset.name}` : brush.tool}</span>
        <span>符号: {brush.symbol === ' ' ? '␣' : brush.symbol}</span>
        <span>大小: {brush.size}</span>
        <span>实体: {entities.length}</span>
        <span>历史: {historyInfo.current}/{historyInfo.total}</span>
        <span className="status-msg">{statusMsg}</span>
        <span className="auto-save">双指拖动 | Ctrl+Z/Y | Del | Esc</span>
      </div>
    </div>
  );
};

export default MapEditorStandalone;
