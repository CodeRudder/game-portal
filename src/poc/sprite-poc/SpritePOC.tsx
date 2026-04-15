/**
 * SpritePOC.tsx — Kenney Tower Defense 精灵渲染 POC
 *
 * 使用真实 Kenney 精灵资源 + PixiJS v8 + GSAP 展示：
 *  - 8×8 策略地图（草地/道路/水域/山地）
 *  - 防御塔放置（建造动画 + 等级系统）
 *  - 敌人沿路径移动（帧动画脉冲）
 *  - 战斗效果（攻击线 + 飘字 + 爆炸）
 *  - React DOM UI 覆盖层（资源栏/建筑面板/信息栏）
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
  Text,
  TextStyle,
  FederatedPointerEvent,
  Spritesheet,
  BlurFilter,
} from 'pixi.js';
import gsap from 'gsap';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 64;
const MAP_COLS = 8;
const MAP_ROWS = 8;

/** 地形类型 */
type TerrainType = 'grass' | 'road' | 'water' | 'sand';

/** 建筑类型 */
type TowerType = 'archer' | 'magic' | 'cannon' | 'ice';

/** 建筑等级 */
type TowerLevel = 1 | 2 | 3;

/** 资源状态 */
interface Resources {
  gold: number;
  wood: number;
  stone: number;
}

/** 已放置的建筑 */
interface PlacedTower {
  col: number;
  row: number;
  type: TowerType;
  level: TowerLevel;
  sprite: Sprite;
  levelBadge: Text;
}

/** 移动中的敌人 */
interface MovingEnemy {
  sprite: Sprite;
  pathIndex: number;
  progress: number; // 0-1 between current and next path point
  hp: number;
  maxHp: number;
  hpBar: Graphics;
  active: boolean;
}

/** 飘字效果 */
interface FloatingText {
  text: Text;
  lifetime: number;
}

// ---------------------------------------------------------------------------
// Spritesheet frame name mappings
// ---------------------------------------------------------------------------

const TERRAIN_FRAMES: Record<TerrainType, string> = {
  grass: 'terrain_grass',
  road: 'terrain_road_straight',
  water: 'terrain_water',
  sand: 'terrain_sand',
};

const TOWER_FRAMES: Record<TowerType, Record<TowerLevel, string>> = {
  archer: { 1: 'tower_archer', 2: 'tower_archer', 3: 'tower_archer' },
  magic: { 1: 'tower_magic', 2: 'tower_magic', 3: 'tower_magic' },
  cannon: { 1: 'tower_cannon', 2: 'tower_cannon', 3: 'tower_cannon' },
  ice: { 1: 'tower_ice', 2: 'tower_ice', 3: 'tower_ice' },
};

const ENEMY_FRAMES = [
  'enemy_skeleton',
  'enemy_knight',
  'enemy_mage',
  'enemy_dragon',
  'enemy_slime',
];

/** 建筑造价 */
const TOWER_COSTS: Record<TowerType, Resources> = {
  archer: { gold: 50, wood: 20, stone: 0 },
  magic: { gold: 80, wood: 0, stone: 30 },
  cannon: { gold: 100, wood: 40, stone: 40 },
  ice: { gold: 70, wood: 10, stone: 20 },
};

const TOWER_NAMES: Record<TowerType, string> = {
  archer: '🏹 弓箭塔',
  magic: '🔮 魔法塔',
  cannon: '💣 投石塔',
  ice: '❄️ 冰冻塔',
};

// ---------------------------------------------------------------------------
// Map layout — 8×8 grid
// ---------------------------------------------------------------------------

const MAP_LAYOUT: TerrainType[][] = [
  ['grass', 'grass', 'road',  'road',  'road',  'grass', 'grass', 'grass'],
  ['grass', 'grass', 'road',  'grass', 'grass', 'grass', 'sand',  'grass'],
  ['water', 'grass', 'road',  'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'grass', 'road',  'road',  'road',  'road',  'road',  'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'road',  'grass'],
  ['grass', 'sand',  'grass', 'grass', 'grass', 'grass', 'road',  'grass'],
  ['grass', 'grass', 'grass', 'grass', 'sand',  'grass', 'road',  'road'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
];

/** 敌人移动路径（网格坐标） */
const ENEMY_PATH = [
  { col: 2, row: 0 },
  { col: 2, row: 1 },
  { col: 2, row: 2 },
  { col: 2, row: 3 },
  { col: 3, row: 3 },
  { col: 4, row: 3 },
  { col: 5, row: 3 },
  { col: 6, row: 3 },
  { col: 6, row: 4 },
  { col: 6, row: 5 },
  { col: 6, row: 6 },
  { col: 7, row: 6 },
];

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

export default function SpritePOC() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const texturesRef = useRef<Record<string, Texture> | null>(null);

  // Game state containers (PixiJS objects, not React state for perf)
  const mapContainerRef = useRef<Container | null>(null);
  const towerContainerRef = useRef<Container | null>(null);
  const enemyContainerRef = useRef<Container | null>(null);
  const fxContainerRef = useRef<Container | null>(null);

  // Game state
  const towersRef = useRef<PlacedTower[]>([]);
  const enemiesRef = useRef<MovingEnemy[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const selectedTowerRef = useRef<TowerType>('archer');

  // React state for UI overlay
  const [resources, setResources] = useState<Resources>({
    gold: 500,
    wood: 200,
    stone: 200,
  });
  const [selectedTower, setSelectedTower] = useState<TowerType>('archer');
  const [towerCount, setTowerCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('点击地图空地放置防御塔');
  const [fps, setFps] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Sync ref with state for PixiJS callbacks
  selectedTowerRef.current = selectedTower;

  // -----------------------------------------------------------------------
  // Helper: get tile center position in world coords
  // -----------------------------------------------------------------------
  const tileCenter = useCallback((col: number, row: number) => ({
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  }), []);

  // -----------------------------------------------------------------------
  // Helper: check if a cell is occupied by a tower
  // -----------------------------------------------------------------------
  const isCellOccupied = useCallback((col: number, row: number) => {
    return towersRef.current.some((t) => t.col === col && t.row === row);
  }, []);

  // -----------------------------------------------------------------------
  // Helper: check if cell is buildable (not road, not water, not occupied)
  // -----------------------------------------------------------------------
  const isBuildable = useCallback((col: number, row: number) => {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
    const terrain = MAP_LAYOUT[row][col];
    if (terrain === 'road' || terrain === 'water') return false;
    return !isCellOccupied(col, row);
  }, [isCellOccupied]);

  // -----------------------------------------------------------------------
  // Place a tower on the map
  // -----------------------------------------------------------------------
  const placeTower = useCallback(
    (col: number, row: number) => {
      const textures = texturesRef.current;
      const towerContainer = towerContainerRef.current;
      if (!textures || !towerContainer) return;

      const type = selectedTowerRef.current;
      const cost = TOWER_COSTS[type];

      // Check resources
      setResources((prev) => {
        if (prev.gold < cost.gold || prev.wood < cost.wood || prev.stone < cost.stone) {
          setStatusMessage('❌ 资源不足！');
          return prev;
        }

        // Create tower sprite
        const frameName = TOWER_FRAMES[type][1];
        const tex = textures[frameName];
        if (!tex) return prev;

        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        const pos = tileCenter(col, row);
        sprite.position.set(pos.x, pos.y);
        sprite.alpha = 0;
        sprite.scale.set(0.3);

        // Level badge
        const levelBadge = new Text({
          text: 'Lv1',
          style: new TextStyle({
            fontSize: 10,
            fill: '#ffffff',
            fontFamily: 'Arial',
            stroke: { color: '#000000', width: 2 },
          }),
        });
        levelBadge.anchor.set(0.5, 0);
        levelBadge.position.set(0, -TILE_SIZE / 2 - 2);
        sprite.addChild(levelBadge);

        towerContainer.addChild(sprite);

        // Build animation: scale up + fade in
        gsap.to(sprite, {
          alpha: 1,
          duration: 0.6,
          ease: 'power2.out',
        });
        gsap.to(sprite.scale, {
          x: 1,
          y: 1,
          duration: 0.6,
          ease: 'back.out(1.7)',
        });

        const tower: PlacedTower = {
          col,
          row,
          type,
          level: 1,
          sprite,
          levelBadge,
        };
        towersRef.current.push(tower);

        // Deduct resources
        const newResources = {
          gold: prev.gold - cost.gold,
          wood: prev.wood - cost.wood,
          stone: prev.stone - cost.stone,
        };

        setTowerCount((c) => c + 1);
        setStatusMessage(`✅ ${TOWER_NAMES[type]} 已放置 (${col}, ${row})`);

        return newResources;
      });
    },
    [tileCenter],
  );

  // -----------------------------------------------------------------------
  // Upgrade a tower
  // -----------------------------------------------------------------------
  const upgradeTower = useCallback((col: number, row: number) => {
    const tower = towersRef.current.find(
      (t) => t.col === col && t.row === row,
    );
    if (!tower || tower.level >= 3) return;

    const newLevel = (tower.level + 1) as TowerLevel;
    tower.level = newLevel;
    tower.levelBadge.text = `Lv${newLevel}`;

    // Upgrade animation
    gsap.to(tower.sprite.scale, {
      x: 1.3,
      y: 1.3,
      duration: 0.2,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
    });

    setStatusMessage(`⬆️ ${TOWER_NAMES[tower.type]} 升级到 Lv${newLevel}`);
  }, []);

  // -----------------------------------------------------------------------
  // Create floating damage text
  // -----------------------------------------------------------------------
  const createFloatingText = useCallback(
    (x: number, y: number, text: string, color: string) => {
      const fxContainer = fxContainerRef.current;
      if (!fxContainer) return;

      const dmgText = new Text({
        text,
        style: new TextStyle({
          fontSize: 18,
          fill: color,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          stroke: { color: '#000000', width: 3 },
        }),
      });
      dmgText.anchor.set(0.5);
      dmgText.position.set(x, y - 20);
      fxContainer.addChild(dmgText);

      floatingTextsRef.current.push({
        text: dmgText,
        lifetime: 1.0,
      });

      // GSAP animation: float up + fade
      gsap.to(dmgText, {
        y: y - 70,
        alpha: 0,
        duration: 1.0,
        ease: 'power2.out',
        onComplete: () => {
          fxContainer.removeChild(dmgText);
          dmgText.destroy();
          floatingTextsRef.current = floatingTextsRef.current.filter(
            (ft) => ft.text !== dmgText,
          );
        },
      });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Create attack line effect
  // -----------------------------------------------------------------------
  const createAttackLine = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      const fxContainer = fxContainerRef.current;
      if (!fxContainer) return;

      const line = new Graphics();
      line.moveTo(fromX, fromY);
      line.lineTo(toX, toY);
      line.stroke({ width: 2, color: 0xffaa00 });
      fxContainer.addChild(line);

      gsap.to(line, {
        alpha: 0,
        duration: 0.3,
        ease: 'power2.out',
        onComplete: () => {
          fxContainer.removeChild(line);
          line.destroy();
        },
      });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Create explosion effect
  // -----------------------------------------------------------------------
  const createExplosion = useCallback(
    (x: number, y: number) => {
      const textures = texturesRef.current;
      const fxContainer = fxContainerRef.current;
      if (!textures || !fxContainer) return;

      const explosionTex = textures['fx_explosion'];
      if (!explosionTex) return;

      const explosion = new Sprite(explosionTex);
      explosion.anchor.set(0.5);
      explosion.position.set(x, y);
      explosion.scale.set(0.1);
      explosion.alpha = 1;
      fxContainer.addChild(explosion);

      gsap.to(explosion.scale, {
        x: 1.2,
        y: 1.2,
        duration: 0.4,
        ease: 'back.out(2)',
      });
      gsap.to(explosion, {
        alpha: 0,
        duration: 0.5,
        ease: 'power2.out',
        onComplete: () => {
          fxContainer.removeChild(explosion);
          explosion.destroy();
        },
      });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Spawn an enemy
  // -----------------------------------------------------------------------
  const spawnEnemy = useCallback(() => {
    const textures = texturesRef.current;
    const enemyContainer = enemyContainerRef.current;
    if (!textures || !enemyContainer) return;

    const frameName = ENEMY_FRAMES[Math.floor(Math.random() * ENEMY_FRAMES.length)];
    const tex = textures[frameName];
    if (!tex) return;

    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const startPos = tileCenter(ENEMY_PATH[0].col, ENEMY_PATH[0].row);
    sprite.position.set(startPos.x, startPos.y);
    sprite.scale.set(0.8);
    enemyContainer.addChild(sprite);

    // HP bar
    const hpBar = new Graphics();
    sprite.addChild(hpBar);

    const enemy: MovingEnemy = {
      sprite,
      pathIndex: 0,
      progress: 0,
      hp: 100,
      maxHp: 100,
      hpBar,
      active: true,
    };
    enemiesRef.current.push(enemy);

    // Pulse animation
    gsap.to(sprite.scale, {
      x: 0.9,
      y: 0.9,
      duration: 0.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    // Rotation wobble
    gsap.to(sprite, {
      rotation: 0.1,
      duration: 0.3,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }, [tileCenter]);

  // -----------------------------------------------------------------------
  // Main init effect
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    let destroyed = false;
    const dpr = window.devicePixelRatio || 1;
    let fpsFrames = 0;
    let fpsTime = 0;

    const init = async () => {
      // ============================================================
      // 1. Create PixiJS Application
      // ============================================================
      const app = new Application();
      await app.init({
        width: canvasContainerRef.current!.clientWidth,
        height: canvasContainerRef.current!.clientHeight,
        background: '#1a1a2e',
        resolution: dpr,
        autoDensity: true,
        antialias: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvasContainerRef.current!.appendChild(canvas);
      appRef.current = app;

      // ============================================================
      // 2. Load Kenney Spritesheet
      // ============================================================
      const spritesheet = new Spritesheet(
        Texture.from('/assets/kenney-tower-defense/Tilesheet/towerDefense_tilesheet.png'),
        (await fetch('/assets/kenney-tower-defense/spritesheet.json').then((r) =>
          r.json(),
        )) as any,
      );
      await spritesheet.parse();
      texturesRef.current = spritesheet.textures;

      // ============================================================
      // 3. Create map container with pan/zoom
      // ============================================================
      const worldContainer = new Container();
      worldContainer.sortableChildren = true;
      app.stage.addChild(worldContainer);

      // Map layer
      const mapContainer = new Container();
      mapContainerRef.current = mapContainer;
      worldContainer.addChild(mapContainer);

      // Tower layer (above map)
      const towerContainer = new Container();
      towerContainerRef.current = towerContainer;
      worldContainer.addChild(towerContainer);

      // Enemy layer (above towers)
      const enemyContainer = new Container();
      enemyContainerRef.current = enemyContainer;
      worldContainer.addChild(enemyContainer);

      // Effects layer (topmost)
      const fxContainer = new Container();
      fxContainerRef.current = fxContainer;
      worldContainer.addChild(fxContainer);

      // ============================================================
      // 4. Render map tiles
      // ============================================================
      const textures = texturesRef.current!;

      for (let row = 0; row < MAP_ROWS; row++) {
        for (let col = 0; col < MAP_COLS; col++) {
          const terrain = MAP_LAYOUT[row][col];
          const frameName = TERRAIN_FRAMES[terrain];
          const tex = textures[frameName];

          if (tex) {
            const tile = new Sprite(tex);
            tile.position.set(col * TILE_SIZE, row * TILE_SIZE);
            mapContainer.addChild(tile);
          } else {
            // Fallback: colored rectangle
            const g = new Graphics();
            const colors: Record<TerrainType, number> = {
              grass: 0x4a7c59,
              road: 0xc4a882,
              water: 0x3498db,
              sand: 0xd4a843,
            };
            g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color: colors[terrain] });
            g.position.set(col * TILE_SIZE, row * TILE_SIZE);
            mapContainer.addChild(g);
          }
        }
      }

      // ============================================================
      // 5. Grid overlay (subtle lines)
      // ============================================================
      const gridOverlay = new Graphics();
      gridOverlay.zIndex = 100;
      for (let col = 0; col <= MAP_COLS; col++) {
        gridOverlay.moveTo(col * TILE_SIZE, 0);
        gridOverlay.lineTo(col * TILE_SIZE, MAP_ROWS * TILE_SIZE);
        gridOverlay.stroke({ width: 0.5, color: 0xffffff, alpha: 0.1 });
      }
      for (let row = 0; row <= MAP_ROWS; row++) {
        gridOverlay.moveTo(0, row * TILE_SIZE);
        gridOverlay.lineTo(MAP_COLS * TILE_SIZE, row * TILE_SIZE);
        gridOverlay.stroke({ width: 0.5, color: 0xffffff, alpha: 0.1 });
      }
      mapContainer.addChild(gridOverlay);

      // ============================================================
      // 6. Center the map in the viewport
      // ============================================================
      const viewW = canvasContainerRef.current!.clientWidth;
      const viewH = canvasContainerRef.current!.clientHeight;
      const mapW = MAP_COLS * TILE_SIZE;
      const mapH = MAP_ROWS * TILE_SIZE;

      // Initial scale to fit
      const scaleX = (viewW * 0.7) / mapW;
      const scaleY = (viewH * 0.85) / mapH;
      const initialScale = Math.min(scaleX, scaleY, 2);

      worldContainer.scale.set(initialScale);
      worldContainer.x = (viewW - mapW * initialScale) / 2;
      worldContainer.y = (viewH - mapH * initialScale) / 2;

      // ============================================================
      // 7. Pan & Zoom
      // ============================================================
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let worldStartX = 0;
      let worldStartY = 0;

      const stage = app.stage;
      stage.eventMode = 'static';
      stage.hitArea = app.screen;

      stage.on('pointerdown', (e: FederatedPointerEvent) => {
        isDragging = true;
        dragStartX = e.globalX;
        dragStartY = e.globalY;
        worldStartX = worldContainer.x;
        worldStartY = worldContainer.y;
      });

      stage.on('pointermove', (e: FederatedPointerEvent) => {
        if (!isDragging) return;
        const dx = e.globalX - dragStartX;
        const dy = e.globalY - dragStartY;
        worldContainer.x = worldStartX + dx;
        worldContainer.y = worldStartY + dy;
      });

      stage.on('pointerup', () => {
        isDragging = false;
      });

      stage.on('pointerupoutside', () => {
        isDragging = false;
      });

      // Zoom with wheel
      const canvasEl = app.canvas as HTMLCanvasElement;
      canvasEl.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(
          0.3,
          Math.min(4, worldContainer.scale.x * zoomFactor),
        );

        // Zoom towards mouse position
        const rect = canvasEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - worldContainer.x) / worldContainer.scale.x;
        const worldY = (mouseY - worldContainer.y) / worldContainer.scale.y;

        worldContainer.scale.set(newScale);
        worldContainer.x = mouseX - worldX * newScale;
        worldContainer.y = mouseY - worldY * newScale;
      });

      // ============================================================
      // 8. Click to place tower
      // ============================================================
      mapContainer.eventMode = 'static';
      mapContainer.hitArea = {
        contains: (x: number, y: number) =>
          x >= 0 && x <= mapW && y >= 0 && y <= mapH,
      };

      mapContainer.on('click', (e: FederatedPointerEvent) => {
        if (isDragging) return;

        // Convert global position to local map coords
        const localPos = mapContainer.toLocal(e.global);
        const col = Math.floor(localPos.x / TILE_SIZE);
        const row = Math.floor(localPos.y / TILE_SIZE);

        if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return;

        // Check if clicking an existing tower (upgrade)
        const existingTower = towersRef.current.find(
          (t) => t.col === col && t.row === row,
        );
        if (existingTower) {
          upgradeTower(col, row);
          return;
        }

        // Try to place a new tower
        if (isBuildable(col, row)) {
          placeTower(col, row);
        } else {
          const terrain = MAP_LAYOUT[row][col];
          if (terrain === 'road') {
            setStatusMessage('🚫 不能在道路上建造');
          } else if (terrain === 'water') {
            setStatusMessage('🚫 不能在水域上建造');
          } else if (isCellOccupied(col, row)) {
            setStatusMessage('🚫 此位置已有建筑');
          }
        }
      });

      // ============================================================
      // 9. Game ticker — enemy movement + tower attacks
      // ============================================================
      const SPAWN_INTERVAL = 3.0; // seconds between spawns
      let spawnTimer = SPAWN_INTERVAL;
      const ENEMY_SPEED = 1.5; // tiles per second

      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60; // seconds

        // --- FPS counter ---
        fpsFrames++;
        fpsTime += dt;
        if (fpsTime >= 1.0) {
          setFps(Math.round(fpsFrames / fpsTime));
          fpsFrames = 0;
          fpsTime = 0;
        }

        // --- Spawn enemies ---
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnEnemy();
          spawnTimer = SPAWN_INTERVAL;
        }

        // --- Move enemies ---
        const enemies = enemiesRef.current;
        for (const enemy of enemies) {
          if (!enemy.active) continue;

          enemy.progress += ENEMY_SPEED * dt;

          while (enemy.progress >= 1 && enemy.pathIndex < ENEMY_PATH.length - 1) {
            enemy.progress -= 1;
            enemy.pathIndex++;
          }

          if (enemy.pathIndex >= ENEMY_PATH.length - 1) {
            // Enemy reached the end
            enemy.active = false;
            gsap.killTweensOf(enemy.sprite);
            gsap.killTweensOf(enemy.sprite.scale);
            enemyContainer.removeChild(enemy.sprite);
            enemy.sprite.destroy();
            setStatusMessage('⚠️ 敌人突破了防线！');
            continue;
          }

          const curr = ENEMY_PATH[enemy.pathIndex];
          const next = ENEMY_PATH[Math.min(enemy.pathIndex + 1, ENEMY_PATH.length - 1)];
          const t = Math.min(enemy.progress, 1);

          const cx = (curr.col + (next.col - curr.col) * t) * TILE_SIZE + TILE_SIZE / 2;
          const cy = (curr.row + (next.row - curr.row) * t) * TILE_SIZE + TILE_SIZE / 2;
          enemy.sprite.position.set(cx, cy);

          // Update HP bar
          enemy.hpBar.clear();
          const hpRatio = enemy.hp / enemy.maxHp;
          const barW = 40;
          const barH = 4;
          enemy.hpBar.rect(-barW / 2, -TILE_SIZE / 2 - 8, barW, barH).fill({ color: 0x333333 });
          enemy.hpBar
            .rect(-barW / 2, -TILE_SIZE / 2 - 8, barW * hpRatio, barH)
            .fill({ color: hpRatio > 0.5 ? 0x2ecc71 : hpRatio > 0.25 ? 0xf39c12 : 0xe74c3c });
        }

        // Clean up inactive enemies
        enemiesRef.current = enemiesRef.current.filter((e) => e.active);

        // --- Tower attacks ---
        const towers = towersRef.current;
        for (const tower of towers) {
          const towerPos = tileCenter(tower.col, tower.row);
          const attackRange = (1.5 + tower.level * 0.5) * TILE_SIZE;
          const attackDamage = 10 + tower.level * 5;

          for (const enemy of enemiesRef.current) {
            if (!enemy.active) continue;

            const dx = enemy.sprite.x - towerPos.x;
            const dy = enemy.sprite.y - towerPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < attackRange) {
              // Random chance to attack (avoid every-frame attacks)
              if (Math.random() < dt * 2) {
                enemy.hp -= attackDamage;

                // Attack line
                createAttackLine(
                  towerPos.x,
                  towerPos.y,
                  enemy.sprite.x,
                  enemy.sprite.y,
                );

                // Floating damage text
                createFloatingText(
                  enemy.sprite.x,
                  enemy.sprite.y,
                  `-${attackDamage}`,
                  '#ff6b6b',
                );

                // Check if enemy died
                if (enemy.hp <= 0) {
                  enemy.active = false;
                  createExplosion(enemy.sprite.x, enemy.sprite.y);
                  createFloatingText(
                    enemy.sprite.x,
                    enemy.sprite.y - 20,
                    '💀 击杀!',
                    '#f1c40f',
                  );
                  gsap.killTweensOf(enemy.sprite);
                  gsap.killTweensOf(enemy.sprite.scale);

                  // Death animation
                  gsap.to(enemy.sprite, {
                    alpha: 0,
                    duration: 0.3,
                    onComplete: () => {
                      enemyContainer.removeChild(enemy.sprite);
                      enemy.sprite.destroy();
                    },
                  });

                  // Reward
                  setResources((prev) => ({
                    ...prev,
                    gold: prev.gold + 25,
                  }));
                }
              }
              break; // One target per tower per frame
            }
          }
        }
      });

      setLoaded(true);
      setStatusMessage('🎮 地图已加载！点击空地放置防御塔');
    };

    init();

    // ---- cleanup -----------------------------------------------------------
    return () => {
      destroyed = true;
      gsap.killTweensOf('*');
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
      texturesRef.current = null;
      mapContainerRef.current = null;
      towerContainerRef.current = null;
      enemyContainerRef.current = null;
      fxContainerRef.current = null;
      towersRef.current = [];
      enemiesRef.current = [];
      floatingTextsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Tower selection handler
  // -----------------------------------------------------------------------
  const handleSelectTower = useCallback((type: TowerType) => {
    setSelectedTower(type);
    selectedTowerRef.current = type;
    setStatusMessage(`已选择 ${TOWER_NAMES[type]}`);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0f0f1a',
      }}
    >
      {/* PixiJS Canvas */}
      <div
        ref={canvasContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* ===== UI Overlay ===== */}

      {/* Top bar — Resources */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
          <span style={{ color: '#f1c40f' }}>💰 {resources.gold}</span>
          <span style={{ color: '#2ecc71' }}>🪵 {resources.wood}</span>
          <span style={{ color: '#95a5a6' }}>🪨 {resources.stone}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          FPS: {fps} | 塔: {towerCount}
        </div>
      </div>

      {/* Right panel — Tower selection */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: '12px',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10,
        }}
      >
        {(
          Object.entries(TOWER_NAMES) as [TowerType, string][]
        ).map(([type, name]) => {
          const cost = TOWER_COSTS[type];
          const isSelected = selectedTower === type;
          const canAfford =
            resources.gold >= cost.gold &&
            resources.wood >= cost.wood &&
            resources.stone >= cost.stone;

          return (
            <button
              key={type}
              onClick={() => handleSelectTower(type)}
              disabled={!canAfford}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '90px',
                padding: '8px 4px',
                background: isSelected
                  ? 'rgba(116, 185, 255, 0.3)'
                  : 'rgba(30, 30, 50, 0.85)',
                border: isSelected
                  ? '2px solid #74b9ff'
                  : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: canAfford ? '#fff' : '#666',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                fontSize: '11px',
                fontFamily: 'Arial, sans-serif',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '13px', marginBottom: '4px' }}>
                {name}
              </span>
              <span style={{ fontSize: '9px', color: '#aaa' }}>
                💰{cost.gold} 🪵{cost.wood} 🪨{cost.stone}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom bar — Status */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background:
            'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: '13px' }}>{statusMessage}</div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <a
            href="/"
            style={{
              color: '#74b9ff',
              textDecoration: 'none',
              pointerEvents: 'auto',
            }}
          >
            ← 返回首页
          </a>
          <a
            href="/poc/pixi"
            style={{
              color: '#a29bfe',
              textDecoration: 'none',
              pointerEvents: 'auto',
            }}
          >
            PixiJS POC →
          </a>
        </div>
      </div>

      {/* Loading overlay */}
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 15, 26, 0.9)',
            color: '#fff',
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            zIndex: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏰</div>
            <div>加载 Kenney 精灵资源中...</div>
          </div>
        </div>
      )}
    </div>
  );
}
