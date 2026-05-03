/**
 * PixelWorldMap — 像素风格世界地图组件
 *
 * 在Canvas上渲染ASCII地图数据，叠加游戏领土信息:
 * - 地形渲染(像素风格)
 * - 城市标记(阵营色+名称)
 * - 点击选中城市
 * - 鸟瞰小地图
 * - 自动适配缩放并居中
 *
 * @module components/idle/panels/map/PixelWorldMap
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ASCIIMapParser } from '@/games/three-kingdoms/core/map/ASCIIMapParser';
import { PixelMapRenderer, type CityRenderData } from '@/games/three-kingdoms/engine/map/PixelMapRenderer';
import { ConquestAnimationSystem } from '@/games/three-kingdoms/engine/map/ConquestAnimation';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';
import type { MarchRoute, MarchUnit } from '@/games/three-kingdoms/engine/map/MarchingSystem';
import { LANDMARK_POSITIONS, DEFAULT_LANDMARKS } from '@/games/three-kingdoms/core/map/map-config';
import worldMapText from '@/games/three-kingdoms/core/map/maps/world-map.txt?raw';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface PixelWorldMapProps {
  /** 领土数据(用于城市标记) */
  territories: TerritoryData[];
  /** 选中领土回调 */
  onSelectTerritory?: (id: string) => void;
  /** 选中的领土ID */
  selectedId?: string | null;
  /** 攻城动画系统(用于在地图上渲染攻城动画) */
  conquestAnimationSystem?: ConquestAnimationSystem;
  /** 行军路线(用于在地图上叠加绘制行军路线) */
  marchRoute?: MarchRoute | null;
  /** 活跃行军单位列表(用于在地图上渲染行军精灵) */
  activeMarches?: MarchUnit[];
}

// ─────────────────────────────────────────────
// 阵营颜色
// ─────────────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  player: '#7EC850',
  enemy: '#e74c3c',
  neutral: 'rgba(255,255,255,0.15)',
  wei: '#2E5090',
  shu: '#8B2500',
  wu: '#2E6B3E',
};

// ─────────────────────────────────────────────
// 城市ID映射(地图字母→领土ID)
// ─────────────────────────────────────────────

/** CITY映射中的字母→领土ID */
const CITY_CHAR_TO_ID: Record<string, string> = {
  Y: 'city-ye',
  X: 'city-xuchang',
  P: 'city-puyang',
  E: 'city-beihai',
  L: 'city-luoyang',
  C: 'city-changan',
  G: 'city-chengdu',
  H: 'city-hanzhong',
  A: 'city-yongan',
  N: 'city-nanzhong',
  J: 'city-jianye',
  K: 'city-kuaiji',
  S: 'city-chaisang',
  B: 'city-lujiang',
  Q: 'city-xiangyang',
  '0': 'pass-hulao',
  '1': 'pass-tong',
  '2': 'pass-jian',
  '3': 'pass-yangping',
};

// ─────────────────────────────────────────────
// 行军精灵渲染常量
// ─────────────────────────────────────────────

/** 阵营精灵颜色 */
const MARCH_SPRITE_COLORS: Record<string, string> = {
  wei: '#4A90D9',
  shu: '#D94A4A',
  wu: '#4AD94A',
  neutral: '#888888',
};

/** 行走动画帧间隔(ms) — 8fps = 125ms per frame */
const WALK_FRAME_INTERVAL = 125;

/** 准备阶段闪烁间隔(ms) */
const PREPARE_BLINK_INTERVAL = 400;

// ─────────────────────────────────────────────
// Minimap 常量
// ─────────────────────────────────────────────

/** Minimap Canvas 尺寸(px)，保持100:60比例 */
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 108;

/** Minimap 像素/瓦片比率(用于坐标转换) */
const MINIMAP_PX_PER_TILE_X = MINIMAP_WIDTH / 100;   // 1.8
const MINIMAP_PX_PER_TILE_Y = MINIMAP_HEIGHT / 60;    // 1.8

/**
 * 渲染单个行军精灵
 *
 * 根据行军状态渲染不同动画效果:
 * - preparing: 在出发城市闪烁
 * - marching: 沿路径移动，左右腿交替行走动画
 * - arrived: 到达目标城市，攻城闪烁效果
 * - retreating: 撤退状态，灰色半透明
 *
 * @param ctx - Canvas 2D 上下文
 * @param march - 行军单位数据
 * @param ts - 瓦片像素尺寸 (tileSize * scale)
 * @param offsetX - 视口X偏移
 * @param offsetY - 视口Y偏移
 */
function renderSingleMarch(
  ctx: CanvasRenderingContext2D,
  march: MarchUnit,
  ts: number,
  offsetX: number,
  offsetY: number,
): void {
  // 计算屏幕坐标
  const px = march.x * ts - offsetX + ts / 2;
  const py = march.y * ts - offsetY + ts / 2;

  // 阵营颜色
  const color = MARCH_SPRITE_COLORS[march.faction] || MARCH_SPRITE_COLORS.neutral;

  // 根据兵力决定精灵数量
  const spriteCount = march.troops > 1000 ? 5 : march.troops > 500 ? 3 : 1;

  // 精灵尺寸(3px基础，随缩放)
  const size = Math.max(2, 3 * (ts / 8));

  // 间距
  const spacing = size * 2.5;

  // 当前时间
  const now = Date.now();

  // 状态特殊处理
  if (march.state === 'preparing') {
    // 准备阶段: 闪烁效果
    const blinkPhase = Math.floor(now / PREPARE_BLINK_INTERVAL) % 2;
    if (blinkPhase === 0) return; // 闪烁: 每隔一帧不绘制
  }

  // 行走动画帧判断 (左腿/右腿交替)
  const walkFrame = Math.floor(now / WALK_FRAME_INTERVAL) % 2;

  for (let i = 0; i < spriteCount; i++) {
    const ox = px + (i - (spriteCount - 1) / 2) * spacing;

    // 行走偏移: 两帧交替上下微动
    let legOffset = 0;
    if (march.state === 'marching') {
      legOffset = walkFrame === 0 ? -size * 0.3 : size * 0.3;
    }

    // 撤退状态: 灰色半透明
    if (march.state === 'retreating') {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#666666';
    } else {
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = color;
    }

    // 精灵身体(矩形)
    ctx.fillRect(ox - size / 2, py - size + legOffset, size, size * 2);

    // 精灵头部(小方块)
    if (march.state !== 'retreating') {
      ctx.fillStyle = '#F0D0B0';
    }
    ctx.fillRect(ox - size * 0.3, py - size * 1.4 + legOffset, size * 0.6, size * 0.6);

    // 旗帜(第一人携带)
    if (i === 0 && march.state !== 'retreating') {
      ctx.fillStyle = color;
      ctx.fillRect(ox + size * 0.5, py - size * 2.0 + legOffset, size * 1.2, size * 0.6);
    }
  }

  // 恢复透明度
  ctx.globalAlpha = 1.0;

  // arrived状态: 攻城闪烁边框效果
  if (march.state === 'arrived') {
    const siegeBlink = Math.floor(now / 300) % 2;
    if (siegeBlink === 0) {
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = Math.max(1, ts * 0.15);
      const ringRadius = ts * 0.6;
      ctx.beginPath();
      ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 武器图标(交叉双剑)
    const swordLen = size * 1.5;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(1, size * 0.3);
    ctx.beginPath();
    ctx.moveTo(px - swordLen, py - size * 2.5);
    ctx.lineTo(px + swordLen, py - size * 4.0);
    ctx.moveTo(px + swordLen, py - size * 2.5);
    ctx.lineTo(px - swordLen, py - size * 4.0);
    ctx.stroke();
  }

  // preparing状态: 集结标识(向上的箭头)
  if (march.state === 'preparing') {
    ctx.fillStyle = '#FFD700';
    const arrowY = py - size * 3;
    const arrowSize = size * 0.8;
    ctx.beginPath();
    ctx.moveTo(px, arrowY - arrowSize);
    ctx.lineTo(px - arrowSize, arrowY);
    ctx.lineTo(px + arrowSize, arrowY);
    ctx.closePath();
    ctx.fill();
  }
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

export const PixelWorldMap: React.FC<PixelWorldMapProps> = ({
  territories,
  onSelectTerritory,
  selectedId,
  conquestAnimationSystem,
  marchRoute,
  activeMarches,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixelMapRenderer | null>(null);
  const minimapRendererRef = useRef<PixelMapRenderer | null>(null);
  const offscreenMinimapRef = useRef<HTMLCanvasElement | null>(null);
  const routeRef = useRef<MarchRoute | null>(null);
  const marchesRef = useRef<MarchUnit[]>([]);
  const selectedIdRef = useRef<string | null | undefined>(selectedId);
  const markDirtyRef = useRef<() => void>(() => {});
  const territoriesRef = useRef<TerritoryData[]>(territories);
  territoriesRef.current = territories;
  const [isDragging, setIsDragging] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);

  // ── 初始化 ─────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // 根据父容器尺寸动态设置Canvas像素尺寸
    const parent = containerRef.current || canvas.parentElement;
    if (parent) {
      const { width, height } = parent.getBoundingClientRect();
      if (width > 0 && height > 0) {
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
      }
    }

    const parser = new ASCIIMapParser();
    const map = parser.parse(worldMapText);

    const renderer = new PixelMapRenderer(canvas, {
      tileSize: 8,
      scale: 1,
      showCityNames: true,
      showGrid: false,
      factionColors: FACTION_COLORS,
    });
    renderer.loadMap(map);

    // 自动适配缩放并居中地图
    renderer.autoFit(canvas.width, canvas.height);

    rendererRef.current = renderer;

    // 创建Minimap离屏渲染器(用于鸟瞰图全局缩略)
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.floor(100 * 8 * 0.5);   // 400px (地图宽×tileSize×scale)
    offscreen.height = Math.floor(60 * 8 * 0.5);    // 240px
    offscreenMinimapRef.current = offscreen;

    const mmRenderer = new PixelMapRenderer(offscreen, {
      tileSize: 8,
      scale: 0.5,
      showCityNames: false,
      showGrid: false,
      factionColors: FACTION_COLORS,
    });
    mmRenderer.loadMap(map);
    mmRenderer.setViewport(0, 0);
    mmRenderer.render(); // 预渲染一次(地形不变)
    minimapRendererRef.current = mmRenderer;

    // 原生wheel事件(React的onWheel是passive，无法preventDefault)
    // 支持触摸板双指缩放/平移，同时阻止页面滚动
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 触摸板双指张开/合拢 → 缩放(ctrlKey或大幅deltaY)
      if (e.ctrlKey || Math.abs(e.deltaY) > 50) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const state = renderer as any;
        const newScale = Math.max(1.0, Math.min(4.0, state.config.scale + delta));
        renderer.setScale(newScale);
        markDirtyRef.current();
        return;
      }

      // 平移(双指拖拽或普通滚轮)
      const damping = 0.5;
      const state = renderer as any;
      renderer.setViewport(
        state.offsetX + e.deltaX * damping,
        state.offsetY + e.deltaY * damping,
      );
      markDirtyRef.current();
    };
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

    // D1-2/D1-3: 键盘快捷键事件监听
    const handleMapPan = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const state = renderer as any;
        renderer.setViewport(
          state.offsetX + detail.dx,
          state.offsetY + detail.dy,
        );
        markDirtyRef.current();
      }
    };

    const handleMapZoom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const state = renderer as any;
        const newScale = Math.max(1.0, Math.min(4.0, state.config.scale + detail.delta));
        renderer.setScale(newScale);
        markDirtyRef.current();
      }
    };

    const handleMapCenter = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.territoryId) {
        // 找到领土位置并居中
        const territory = territoriesRef.current?.find((t: any) => t.id === detail.territoryId);
        if (territory) {
          const state = renderer as any;
          const ts = state.config.tileSize * state.config.scale;
          renderer.setViewport(
            territory.position.x * ts - canvas.width / 2,
            territory.position.y * ts - canvas.height / 2,
          );
          markDirtyRef.current();
        }
      }
    };

    window.addEventListener('map-pan', handleMapPan);
    window.addEventListener('map-zoom', handleMapZoom);
    window.addEventListener('map-center', handleMapCenter);

    // 渲染循环(脏标记)
    let animId: number;
    let dirty = true;

    const markDirty = () => { dirty = true; };
    markDirtyRef.current = markDirty;

    // 监听攻城动画变更，触发重绘
    let unsubConquest: (() => void) | undefined;
    if (conquestAnimationSystem) {
      unsubConquest = conquestAnimationSystem.onChange(markDirty);
    }

    const animate = () => {
      const hasActiveConquest = conquestAnimationSystem?.getActive().length ?? 0;
      const hasActiveMarches = marchesRef.current.length > 0;
      if (dirty || hasActiveConquest || hasActiveMarches) {
        dirty = false;
        renderer.render();

        // 渲染攻城动画叠加层
        if (conquestAnimationSystem) {
          conquestAnimationSystem.update();
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const state = renderer as any;
              const ts = state.config.tileSize * state.config.scale;
              conquestAnimationSystem.render(ctx, ts, state.offsetX, state.offsetY);
            }
          }
        }

        // 渲染行军路线叠加层
        renderMarchRouteOverlay();

        // 渲染行军精灵叠加层(在路线之上)
        renderMarchSpritesOverlay();

        // 渲染选中城市高亮边框(最上层)
        renderSelectionHighlight();

        renderMinimap();
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('wheel', handleNativeWheel);
      window.removeEventListener('map-pan', handleMapPan);
      window.removeEventListener('map-zoom', handleMapZoom);
      window.removeEventListener('map-center', handleMapCenter);
      unsubConquest?.();
    };
  }, [conquestAnimationSystem]);

  // ── 窗口尺寸变化时重新适配 ─────────────────

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      const parent = containerRef.current || canvas?.parentElement;
      if (!canvas || !renderer || !parent) return;

      const { width, height } = parent.getBoundingClientRect();
      const newW = Math.floor(width);
      const newH = Math.floor(height);

      // 仅在尺寸真正变化时重新适配
      if (newW > 0 && newH > 0 && (newW !== canvas.width || newH !== canvas.height)) {
        canvas.width = newW;
        canvas.height = newH;
        renderer.autoFit(newW, newH);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── 更新城市数据 ───────────────────────────

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // 资源类型→图标映射(用于res-spawn-*等不在DEFAULT_LANDMARKS中的资源点)
    const RESOURCE_TYPE_ICONS: Record<string, string> = {
      grain: '🌾', gold: '💰', troops: '⚔️', mandate: '🌟',
    };

    const cities: CityRenderData[] = territories.map(t => {
      const lm = DEFAULT_LANDMARKS.find(l => l.id === t.id);
      // 对于res-spawn-*类型的资源点，从ID中提取资源类型并映射图标
      let icon = lm?.icon;
      if (!icon && t.id.startsWith('res-spawn-')) {
        const resType = t.id.replace('res-spawn-', '');
        icon = RESOURCE_TYPE_ICONS[resType] || '🌾';
      }
      return {
        id: t.id,
        name: t.name,
        x: t.position.x,
        y: t.position.y,
        faction: t.ownership,
        level: t.level,
        icon: icon || '🏰',
        type: lm?.type || (t.id.startsWith('res-') ? 'resource' : 'city'),
      };
    });
    renderer.setCityData(cities);

    // 同步更新minimap的城市数据并重绘离屏
    const mmRenderer = minimapRendererRef.current;
    if (mmRenderer) {
      mmRenderer.setCityData(cities);
      mmRenderer.render();
      markDirtyRef.current();
    }
  }, [territories]);

  // ── 行军路线数据同步 ───────────────────────

  useEffect(() => {
    routeRef.current = marchRoute ?? null;
    markDirtyRef.current();
  }, [marchRoute]);

  // ── 行军精灵数据同步 ───────────────────────

  useEffect(() => {
    marchesRef.current = activeMarches ?? [];
    if (activeMarches && activeMarches.length > 0) {
      markDirtyRef.current();
    }
  }, [activeMarches]);

  // ── 渲染行军路线 ──────────────────────────

  const renderMarchRouteOverlay = useCallback(() => {
    const route = routeRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!route || !renderer || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 从 renderer 获取渲染参数
    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const offsetX: number = state.offsetX;
    const offsetY: number = state.offsetY;

    // ── 绘制黄色虚线路径 ──
    if (route.path.length < 2) return;

    ctx.save();

    // 路径外发光(半透明宽线)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.25)';
    ctx.lineWidth = ts * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(
      route.path[0].x * ts - offsetX + ts / 2,
      route.path[0].y * ts - offsetY + ts / 2,
    );
    for (let i = 1; i < route.path.length; i++) {
      ctx.lineTo(
        route.path[i].x * ts - offsetX + ts / 2,
        route.path[i].y * ts - offsetY + ts / 2,
      );
    }
    ctx.stroke();

    // 路径主线(黄色虚线)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = Math.max(2, ts * 0.25);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([ts * 0.6, ts * 0.4]);
    ctx.beginPath();
    ctx.moveTo(
      route.path[0].x * ts - offsetX + ts / 2,
      route.path[0].y * ts - offsetY + ts / 2,
    );
    for (let i = 1; i < route.path.length; i++) {
      ctx.lineTo(
        route.path[i].x * ts - offsetX + ts / 2,
        route.path[i].y * ts - offsetY + ts / 2,
      );
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // ── 绘制转折点圆点标记 ──
    for (const wp of route.waypoints) {
      const px = wp.x * ts - offsetX + ts / 2;
      const py = wp.y * ts - offsetY + ts / 2;
      const radius = Math.max(3, ts * 0.35);

      // 外圈(白色描边)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, radius + 1, 0, Math.PI * 2);
      ctx.fill();

      // 内圈(金色填充)
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 绘制途径城市名称标签 ──
    // 构建坐标→城市名映射(仅 city-* 类型)
    const posToCityName = new Map<string, string>();
    for (const landmark of DEFAULT_LANDMARKS) {
      if (landmark.id.startsWith('city-')) {
        const pos = LANDMARK_POSITIONS[landmark.id];
        if (pos) {
          posToCityName.set(`${pos.x},${pos.y}`, landmark.name);
        }
      }
    }

    const fontSize = Math.max(9, ts * 1.0);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // 在途径城市位置绘制标签
    for (const cityId of route.waypointCities) {
      const pos = LANDMARK_POSITIONS[cityId];
      if (!pos) continue;

      const cityName = posToCityName.get(`${pos.x},${pos.y}`) || cityId;
      const px = pos.x * ts - offsetX + ts / 2;
      const py = pos.y * ts - offsetY - ts * 0.3;

      // 背景框
      const metrics = ctx.measureText(cityName);
      const pad = 3;
      const bgX = px - metrics.width / 2 - pad;
      const bgY = py - fontSize - pad;
      const bgW = metrics.width + pad * 2;
      const bgH = fontSize + pad * 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgW, bgH, 3);
      ctx.fill();

      // 白色文字
      ctx.fillStyle = '#FFD700';
      ctx.fillText(cityName, px, py);
    }

    ctx.restore();
  }, []);

  // ── 渲染行军精灵叠加层 ─────────────────────

  const renderMarchSpritesOverlay = useCallback(() => {
    const marches = marchesRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!marches.length || !renderer || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 从 renderer 获取渲染参数
    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const offsetX: number = state.offsetX;
    const offsetY: number = state.offsetY;

    ctx.save();

    for (const march of marches) {
      renderSingleMarch(ctx, march, ts, offsetX, offsetY);
    }

    ctx.restore();
  }, []);

  // ── 渲染选中城市高亮边框 ─────────────────

  const renderSelectionHighlight = useCallback(() => {
    const sid = selectedIdRef.current;
    if (!sid) return;

    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const territory = territories.find(t => t.id === sid);
    if (!territory) return;

    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;

    // 计算城市在Canvas上的像素位置
    const px = territory.position.x * ts - state.offsetX;
    const py = territory.position.y * ts - state.offsetY;

    // 高亮色块: 覆盖城市位置的3x3区域
    const blockSize = ts * 3;
    const bx = px - ts;
    const by = py - ts;

    // 金色高亮边框(#d4a574)
    ctx.save();
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = Math.max(2, ts * 0.3);
    ctx.setLineDash([ts * 0.5, ts * 0.3]);
    ctx.beginPath();
    ctx.roundRect(bx, by, blockSize, blockSize, ts * 0.3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, [territories]);

  // ── 渲染小地图 ────────────────────────────

  const renderMinimap = useCallback(() => {
    const minimap = minimapRef.current;
    const offscreen = offscreenMinimapRef.current;
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!minimap || !offscreen || !renderer || !canvas) return;

    const ctx = minimap.getContext('2d');
    if (!ctx) return;

    // 将离屏全局地图缩放绘制到minimap
    ctx.clearRect(0, 0, minimap.width, minimap.height);
    ctx.drawImage(offscreen, 0, 0, minimap.width, minimap.height);

    // 绘制白色半透明视口矩形
    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;
    const vx = (state.offsetX / ts) * MINIMAP_PX_PER_TILE_X;
    const vy = (state.offsetY / ts) * MINIMAP_PX_PER_TILE_Y;
    const vw = (canvas.width / ts) * MINIMAP_PX_PER_TILE_X;
    const vh = (canvas.height / ts) * MINIMAP_PX_PER_TILE_Y;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
  }, []);

  // ── 鼠标交互（支持左键拖拽平移）──────────

  /** 记录鼠标按下位置，用于区分拖拽与点击 */
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  /** 是否处于拖拽平移状态（鼠标移动超过阈值后激活） */
  const isPanningRef = useRef(false);
  const DRAG_THRESHOLD = 5; // 像素阈值，超过则视为拖拽

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2) {
      // 中键/右键: 立即平移
      setIsDragging(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      isPanningRef.current = true;
      e.preventDefault();
      return;
    }

    // 左键: 记录按下位置，等待判断是拖拽还是点击
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    isPanningRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 中键/右键拖拽
    if (isDragging && panStart) {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      renderer.setViewport(
        (renderer as any).offsetX - dx,
        (renderer as any).offsetY - dy,
      );
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 左键拖拽检测
    if (mouseDownPosRef.current) {
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      if (!isPanningRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        // 超过阈值，进入拖拽平移模式
        isPanningRef.current = true;
        setIsDragging(true);
        setPanStart({ x: mouseDownPosRef.current.x, y: mouseDownPosRef.current.y });
      }
      if (isPanningRef.current && panStart) {
        const renderer = rendererRef.current;
        if (!renderer) return;
        const mdx = e.clientX - panStart.x;
        const mdy = e.clientY - panStart.y;
        renderer.setViewport(
          (renderer as any).offsetX - mdx,
          (renderer as any).offsetY - mdy,
        );
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 如果没有拖拽，视为点击（选择城市）
    if (!isPanningRef.current && mouseDownPosRef.current && e.button === 0) {
      const renderer = rendererRef.current;
      if (renderer) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const grid = renderer.screenToGrid(x, y);
        if (grid) {
          const clickedCity = findCityAt(grid.x, grid.y);
          if (clickedCity) {
            onSelectTerritory?.(clickedCity.id);
          } else {
            onSelectTerritory?.('');
          }
        }
      }
    }

    mouseDownPosRef.current = null;
    isPanningRef.current = false;
    setIsDragging(false);
    setPanStart(null);
  };

  /** 查找网格坐标附近的领土 */
  const findCityAt = (gx: number, gy: number): TerritoryData | null => {
    // 在3x3范围内查找
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = gx + dx;
        const checkY = gy + dy;
        // 遍历领土，检查位置匹配
        for (const t of territories) {
          if (Math.abs(t.position.x - checkX) <= 1 && Math.abs(t.position.y - checkY) <= 1) {
            return t;
          }
        }
      }
    }
    return null;
  };

  // ── 小地图交互(点击跳转 + 拖拽移动) ──────

  /** 将minimap上的鼠标位置转换为主视窗偏移 */
  const jumpToMinimapPosition = useCallback((clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const minimap = minimapRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !minimap || !canvas) return;

    const rect = minimap.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const state = renderer as any;
    const ts: number = state.config.tileSize * state.config.scale;

    // minimap坐标 → 瓦片坐标 → 主视窗偏移(居中)
    const tileX = mx / MINIMAP_PX_PER_TILE_X;
    const tileY = my / MINIMAP_PX_PER_TILE_Y;
    renderer.setViewport(
      tileX * ts - canvas.width / 2,
      tileY * ts - canvas.height / 2,
    );
  }, []);

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsMinimapDragging(true);
    jumpToMinimapPosition(e.clientX, e.clientY);
  };

  const handleMinimapMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMinimapDragging) return;
    e.preventDefault();
    jumpToMinimapPosition(e.clientX, e.clientY);
  };

  const handleMinimapMouseUp = () => {
    setIsMinimapDragging(false);
  };

  // ── 选中城市高亮（仅重绘，不自动居中）─────

  // ── 选中ID同步(驱动高亮重绘) ─────────────

  useEffect(() => {
    selectedIdRef.current = selectedId;
    markDirtyRef.current();
  }, [selectedId]);

  // ── D2-3/D2-4: 触摸手势支持 ─────────────────

  /** 触摸状态 */
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDistanceRef = useRef<number>(0);
  const touchPanStartRef = useRef<{ x: number; y: number } | null>(null);

  /** 计算两点间距离 */
  const getTouchDistance = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /** 触摸开始 */
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // 单指: 记录起始位置
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchPanStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // 双指: 记录初始距离（用于缩放）
      touchDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      touchStartRef.current = null;
    }
    e.preventDefault();
  };

  /** 触摸移动 */
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (e.touches.length === 1 && touchPanStartRef.current) {
      // 单指拖拽: 平移视窗
      const dx = e.touches[0].clientX - touchPanStartRef.current.x;
      const dy = e.touches[0].clientY - touchPanStartRef.current.y;
      renderer.setViewport(
        (renderer as any).offsetX - dx,
        (renderer as any).offsetY - dy,
      );
      touchPanStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      markDirtyRef.current();
    } else if (e.touches.length === 2) {
      // 双指: 缩放
      const newDistance = getTouchDistance(e.touches[0], e.touches[1]);
      const scaleDiff = (newDistance - touchDistanceRef.current) * 0.005;
      const state = renderer as any;
      const newScale = Math.max(1.0, Math.min(4.0, state.config.scale + scaleDiff));
      renderer.setScale(newScale);
      touchDistanceRef.current = newDistance;
      markDirtyRef.current();
    }
    e.preventDefault();
  };

  /** 触摸结束 */
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      // 所有手指抬起: 判断是点击还是拖拽
      if (touchStartRef.current && touchPanStartRef.current) {
        const dx = touchPanStartRef.current.x - touchStartRef.current.x;
        const dy = touchPanStartRef.current.y - touchStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < DRAG_THRESHOLD) {
          // 点击: 选择城市
          const renderer = rendererRef.current;
          if (renderer) {
            const rect = canvasRef.current!.getBoundingClientRect();
            const x = touchStartRef.current.x - rect.left;
            const y = touchStartRef.current.y - rect.top;
            const grid = renderer.screenToGrid(x, y);
            if (grid) {
              const clickedCity = findCityAt(grid.x, grid.y);
              if (clickedCity) {
                onSelectTerritory?.(clickedCity.id);
              } else {
                onSelectTerritory?.('');
              }
            }
          }
        }
      }
      touchStartRef.current = null;
      touchPanStartRef.current = null;
    }
  };

  return (
    <div className="pixel-worldmap" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={800}
        height={480}
        className="pixel-worldmap-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={e => e.preventDefault()}
      />
      <canvas
        ref={minimapRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        className="pixel-worldmap-minimap"
        onMouseDown={handleMinimapMouseDown}
        onMouseMove={handleMinimapMouseMove}
        onMouseUp={handleMinimapMouseUp}
        onMouseLeave={handleMinimapMouseUp}
      />
    </div>
  );
};

export default PixelWorldMap;
