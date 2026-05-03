/**
 * 地图编辑器面板
 *
 * 多层地图编辑器，支持地形/建筑/道路等图层的独立编辑。
 * 使用与游戏相同的 PixelMapRenderer 渲染，表现效果一致。
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapEditor, ALL_SYMBOLS, type BrushTool, type EditorLayer, type LayerType } from '../../../../../games/three-kingdoms/engine/map/editor/MapEditor';
import { ASCIIMapParser } from '../../../../../games/three-kingdoms/core/map/ASCIIMapParser';
import { PixelMapRenderer } from '../../../../../games/three-kingdoms/engine/map/PixelMapRenderer';
import './MapEditorPanel.css';

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

export const MapEditorPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<MapEditor | null>(null);
  const rendererRef = useRef<PixelMapRenderer | null>(null);

  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('terrain');
  const [brush, setBrush] = useState({ tool: 'paint' as BrushTool, symbol: '.', size: 1 });
  const [showGrid, setShowGrid] = useState(true);
  const [mapName, setMapName] = useState('新地图');
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  // 初始化编辑器和渲染器
  useEffect(() => {
    if (!canvasRef.current) return;

    const editor = new MapEditor(100, 60);
    editorRef.current = editor;

    const parser = new ASCIIMapParser();
    const renderer = new PixelMapRenderer(canvasRef.current, {
      tileSize: 8,
      scale: 1,
      showCityNames: true,
      showGrid: true,
    });
    rendererRef.current = renderer;

    // 监听编辑器变更
    editor.onChange(() => {
      setLayers([...editor.getLayers()]);
      setActiveLayerId(editor.getState().activeLayerId);
      setBrush(editor.getBrush());
      setShowGrid(editor.getState().showGrid);
      renderMap(editor, renderer, parser);
    });

    // 初始渲染
    setLayers(editor.getLayers());
    renderMap(editor, renderer, parser);

    // 渲染循环
    let animId: number;
    const animate = () => {
      renderMap(editor, renderer, parser);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // 渲染地图
  const renderMap = useCallback((editor: MapEditor, renderer: PixelMapRenderer, parser: ASCIIMapParser) => {
    const ascii = editor.mergeToASCII();
    try {
      const map = parser.parse(ascii);
      renderer.loadMap(map);
      renderer.render();
    } catch {
      // 解析失败时静默处理
    }
  }, []);

  // ── 鼠标事件 ─────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 右键或中键: 平移
    if (e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // 左键: 绘制
    const grid = editor.screenToGrid(x, y);
    if (!grid) return;

    const currentBrush = editor.getBrush();

    if (currentBrush.tool === 'fill') {
      editor.floodFill(grid.x, grid.y);
    } else if (currentBrush.tool === 'pick') {
      editor.pickSymbol(grid.x, grid.y);
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

    // 平移
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const state = editor.getState();
      editor.setOffset(state.offsetX - dx, state.offsetY - dy);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 绘制
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
    setIsDragging(false);
    setLastPos(null);
    setIsPanning(false);
    setPanStart(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    editor.setZoom(editor.getState().zoom + delta);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // ── 工具栏操作 ───────────────────────────────

  const handleToolChange = (tool: BrushTool) => {
    editorRef.current?.setBrushTool(tool);
  };

  const handleSymbolSelect = (symbol: string) => {
    editorRef.current?.setBrushSymbol(symbol);
    editorRef.current?.setBrushTool('paint');
  };

  const handleBrushSizeChange = (size: number) => {
    editorRef.current?.setBrushSize(size);
  };

  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();
  const handleToggleGrid = () => editorRef.current?.toggleGrid();
  const handleDownload = () => editorRef.current?.downloadMap();

  const handleLayerSelect = (layerId: string) => {
    editorRef.current?.setActiveLayer(layerId);
  };

  const handleLayerVisibility = (layerId: string) => {
    editorRef.current?.toggleLayerVisibility(layerId);
  };

  const handleLayerLock = (layerId: string) => {
    editorRef.current?.toggleLayerLock(layerId);
  };

  const handleLayerMove = (layerId: string, dir: 'up' | 'down') => {
    editorRef.current?.moveLayer(layerId, dir);
  };

  const handleAddLayer = () => {
    const name = prompt('图层名称:');
    if (name) {
      editorRef.current?.addLayer(name, 'decoration');
    }
  };

  const handleRemoveLayer = (layerId: string) => {
    if (confirm('确定删除此图层?')) {
      editorRef.current?.removeLayer(layerId);
    }
  };

  const handleMapNameChange = (name: string) => {
    setMapName(name);
    editorRef.current?.setMapName(name);
  };

  // ── 按符号分类 ───────────────────────────────

  const symbolCategories = ALL_SYMBOLS.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, typeof ALL_SYMBOLS>);

  return (
    <div className="map-editor">
      {/* 工具栏 */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <label>地图名:</label>
          <input
            type="text"
            value={mapName}
            onChange={e => handleMapNameChange(e.target.value)}
            className="map-name-input"
          />
        </div>

        <div className="toolbar-group">
          <label>工具:</label>
          <button className={brush.tool === 'paint' ? 'active' : ''} onClick={() => handleToolChange('paint')} title="画笔">✏️</button>
          <button className={brush.tool === 'erase' ? 'active' : ''} onClick={() => handleToolChange('erase')} title="橡皮">🧹</button>
          <button className={brush.tool === 'fill' ? 'active' : ''} onClick={() => handleToolChange('fill')} title="填充">🪣</button>
          <button className={brush.tool === 'pick' ? 'active' : ''} onClick={() => handleToolChange('pick')} title="拾取">💉</button>
        </div>

        <div className="toolbar-group">
          <label>大小:</label>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} className={brush.size === s ? 'active' : ''} onClick={() => handleBrushSizeChange(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <button onClick={handleUndo} title="撤销(Ctrl+Z)">↩️</button>
          <button onClick={handleRedo} title="重做(Ctrl+Y)">↪️</button>
          <button onClick={handleToggleGrid} title="网格">{showGrid ? '🔲' : '⬜'}</button>
        </div>

        <div className="toolbar-group">
          <button onClick={handleDownload} className="download-btn" title="下载地图文件">💾 下载</button>
        </div>
      </div>

      <div className="editor-body">
        {/* 左侧: 符号面板 */}
        <div className="symbol-panel">
          <h4>图块</h4>
          {Object.entries(symbolCategories).map(([category, symbols]) => (
            <div key={category} className="symbol-category">
              <div className="category-title">{category}</div>
              <div className="symbol-grid">
                {symbols.map(s => (
                  <button
                    key={s.symbol}
                    className={`symbol-btn ${brush.symbol === s.symbol ? 'active' : ''}`}
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
            当前: <span className="symbol-preview">{brush.symbol === ' ' ? '␣' : brush.symbol}</span>
            <span className="symbol-name">
              {ALL_SYMBOLS.find(s => s.symbol === brush.symbol)?.name || '自定义'}
            </span>
          </div>
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
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            className="editor-canvas"
          />
        </div>

        {/* 右侧: 图层面板 */}
        <div className="layer-panel">
          <h4>图层</h4>
          <div className="layer-list">
            {[...layers].reverse().map(layer => (
              <div
                key={layer.id}
                className={`layer-item ${layer.id === activeLayerId ? 'active' : ''}`}
                onClick={() => handleLayerSelect(layer.id)}
              >
                <button
                  className="layer-visibility"
                  onClick={e => { e.stopPropagation(); handleLayerVisibility(layer.id); }}
                  title={layer.visible ? '隐藏' : '显示'}
                >
                  {layer.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <button
                  className="layer-lock"
                  onClick={e => { e.stopPropagation(); handleLayerLock(layer.id); }}
                  title={layer.locked ? '解锁' : '锁定'}
                >
                  {layer.locked ? '🔒' : '🔓'}
                </button>
                <span className="layer-name">{layer.name}</span>
                <span className="layer-type">{layer.type}</span>
                <div className="layer-actions">
                  <button onClick={e => { e.stopPropagation(); handleLayerMove(layer.id, 'up'); }} title="上移">↑</button>
                  <button onClick={e => { e.stopPropagation(); handleLayerMove(layer.id, 'down'); }} title="下移">↓</button>
                  <button onClick={e => { e.stopPropagation(); handleRemoveLayer(layer.id); }} title="删除">×</button>
                </div>
              </div>
            ))}
          </div>
          <button className="add-layer-btn" onClick={handleAddLayer}>+ 添加图层</button>

          <div className="layer-opacity">
            <label>不透明度:</label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100)}
              onChange={e => {
                const layer = layers.find(l => l.id === activeLayerId);
                if (layer) {
                  editorRef.current?.setLayerOpacity(layer.id, parseInt(e.target.value) / 100);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="editor-statusbar">
        <span>图层: {layers.find(l => l.id === activeLayerId)?.name}</span>
        <span>工具: {brush.tool}</span>
        <span>符号: {brush.symbol === ' ' ? '␣' : brush.symbol}</span>
        <span>大小: {brush.size}</span>
        <span>缩放: {Math.round((editorRef.current?.getState().zoom || 1) * 100)}%</span>
      </div>
    </div>
  );
};

export default MapEditorPanel;
