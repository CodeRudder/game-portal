/**
 * SpritePOC.tsx — PixiJS v8 + Kenney 精灵资源渲染 POC
 *
 * 1. PixiJS v8 Application 初始化
 * 2. 10×8 瓦片地图渲染（Kenney spritesheet）
 * 3. 鼠标/触摸拖拽平移
 * 4. 鼠标滚轮缩放（0.5x ~ 3x）
 * 5. 建筑放置（点击 grass 格子 → GSAP 建造动画 → 等级标记）
 * 6. 单位移动（沿 road 路径点平滑移动 → GSAP timeline）
 * 7. 资源系统（金币 / 木材 / 石料，自动产出 + 建筑消耗）
 * 8. 战斗效果（塔自动攻击 + 攻击线 + 伤害飘字 + 血条 + 死亡动画）
 * 9. 波次系统（每30秒一波，敌人数量递增，波次提示动画）
 * 10. 底部信息栏（波次 / 击杀 / 建筑数 / FPS）
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Application, Container, Graphics, Sprite, Texture,
  Text, TextStyle, FederatedPointerEvent, Spritesheet,
} from 'pixi.js';
import gsap from 'gsap';

// ---------------------------------------------------------------------------
// Constants & Map Data
// ---------------------------------------------------------------------------

const TILE = 64;
const COLS = 10;
const ROWS = 8;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

/** Tower attack range in tiles */
const TOWER_RANGE = 3;
/** Tower damage per hit */
const TOWER_DAMAGE = 25;
/** Tower attack cooldown in seconds */
const TOWER_COOLDOWN = 1.0;
/** Attack line duration in seconds */
const ATTACK_LINE_DURATION = 0.3;
/** Wave interval in seconds */
const WAVE_INTERVAL = 30;

/** terrainId → spritesheet frame name */
const FRAME: Record<number, string> = {
  0: 'terrain_grass', 1: 'terrain_road_straight',
  2: 'terrain_water', 3: 'terrain_road_straight',
};
/** Fallback colors when spritesheet unavailable */
const FALLBACK: Record<number, number> = {
  0: 0x4a7c59, 1: 0xc4a882, 2: 0x3498db, 3: 0xb8976a,
};

/** 0=grass 1=road_h 2=water 3=road_v */
const MAP: number[][] = [
  [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 3, 0, 0, 0, 2, 2, 0],
  [0, 1, 1, 3, 0, 0, 0, 2, 0, 0],
  [0, 3, 0, 3, 0, 0, 0, 0, 0, 0],
  [0, 3, 0, 3, 1, 1, 1, 1, 0, 0],
  [0, 3, 0, 0, 0, 0, 0, 3, 0, 0],
  [0, 3, 1, 1, 1, 1, 1, 3, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// ---------------------------------------------------------------------------
// Building Definitions
// ---------------------------------------------------------------------------

interface BuildingDef {
  id: string;
  label: string;
  frame: string;
  cost: { gold: number; wood: number; stone: number };
  color: number;
}

const BUILDINGS: BuildingDef[] = [
  { id: 'archer', label: '弓箭塔', frame: 'tower_archer', cost: { gold: 20, wood: 10, stone: 5 }, color: 0x27ae60 },
  { id: 'cannon', label: '炮塔',   frame: 'tower_cannon', cost: { gold: 40, wood: 15, stone: 20 }, color: 0xe67e22 },
  { id: 'magic',  label: '魔法塔', frame: 'tower_magic',  cost: { gold: 60, wood: 20, stone: 15 }, color: 0x8e44ad },
  { id: 'fire',   label: '火焰塔', frame: 'tower_fire',   cost: { gold: 50, wood: 25, stone: 10 }, color: 0xe74c3c },
];

// ---------------------------------------------------------------------------
// Enemy Definitions
// ---------------------------------------------------------------------------

interface EnemyDef {
  id: string;
  frame: string;
  speed: number;
  color: number;
  hp: number;
}

const ENEMIES: EnemyDef[] = [
  { id: 'knight',   frame: 'enemy_knight',   speed: 0.6, color: 0xc0392b, hp: 100 },
  { id: 'slime',    frame: 'enemy_slime',     speed: 0.4, color: 0x2ecc71, hp: 80 },
  { id: 'skeleton', frame: 'enemy_skeleton',  speed: 0.8, color: 0x95a5a6, hp: 60 },
];

// ---------------------------------------------------------------------------
// Runtime Enemy Instance
// ---------------------------------------------------------------------------

interface EnemyInstance {
  sprite: Sprite;
  hpBar: Graphics;
  hp: number;
  maxHp: number;
  dead: boolean;
}

// ---------------------------------------------------------------------------
// Runtime Tower Instance
// ---------------------------------------------------------------------------

interface TowerInstance {
  sprite: Sprite;
  col: number;
  row: number;
  cooldown: number; // seconds remaining until next attack
}

// ---------------------------------------------------------------------------
// Road Path — pre-computed pixel-center waypoints through road tiles
// ---------------------------------------------------------------------------

const ROAD_PATH: { x: number; y: number }[] = [
  // col 1 vertical going up: rows 6→2
  { x: 1 * TILE + TILE / 2, y: 6 * TILE + TILE / 2 },
  { x: 1 * TILE + TILE / 2, y: 5 * TILE + TILE / 2 },
  { x: 1 * TILE + TILE / 2, y: 4 * TILE + TILE / 2 },
  { x: 1 * TILE + TILE / 2, y: 3 * TILE + TILE / 2 },
  { x: 1 * TILE + TILE + TILE / 2, y: 2 * TILE + TILE / 2 },
  // row 2 horizontal: col 1→2
  { x: 2 * TILE + TILE / 2, y: 2 * TILE + TILE / 2 },
  // col 3 vertical going up: rows 2→0
  { x: 3 * TILE + TILE / 2, y: 2 * TILE + TILE / 2 },
  { x: 3 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 },
  { x: 3 * TILE + TILE / 2, y: 0 * TILE + TILE / 2 },
  // row 0 horizontal: col 3→5
  { x: 4 * TILE + TILE / 2, y: 0 * TILE + TILE / 2 },
  { x: 5 * TILE + TILE / 2, y: 0 * TILE + TILE / 2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpritePOC() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fps, setFps] = useState(0);
  const [zoom, setZoom] = useState(1);

  // ── Resource state ────────────────────────────────────────────────
  const [resources, setResources] = useState({ gold: 100, wood: 50, stone: 30 });

  // ── Building selection state ──────────────────────────────────────
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  // ── Combat / Wave stats ───────────────────────────────────────────
  const [wave, setWave] = useState(0);
  const [kills, setKills] = useState(0);
  const [buildingCount, setBuildingCount] = useState(0);

  // ── Refs shared between React and PixiJS (avoid stale closures) ──
  const selectedRef = useRef<string | null>(null);
  const buildingsMapRef = useRef<Map<string, number>>(new Map()); // key → level

  // Callback ref: PixiJS calls this when a building is successfully placed
  // React side deducts resources. Returns true if placement is allowed.
  const tryPlaceRef = useRef<(buildingId: string) => boolean>(() => false);

  // Keep selectedRef in sync
  useEffect(() => { selectedRef.current = selectedBuilding; }, [selectedBuilding]);

  // ── Update tryPlaceRef whenever resources or selection changes ────
  tryPlaceRef.current = useCallback((buildingId: string): boolean => {
    const def = BUILDINGS.find(b => b.id === buildingId);
    if (!def) return false;
    const cost = def.cost;
    // Read latest resources via setter functional form
    let allowed = false;
    setResources(prev => {
      if (prev.gold >= cost.gold && prev.wood >= cost.wood && prev.stone >= cost.stone) {
        allowed = true;
        return {
          gold: prev.gold - cost.gold,
          wood: prev.wood - cost.wood,
          stone: prev.stone - cost.stone,
        };
      }
      return prev;
    });
    return allowed;
  }, []);

  // ── Resource auto-generation ──────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setResources(prev => ({ gold: prev.gold + 2, wood: prev.wood + 1, stone: prev.stone + 1 }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Check affordability (for UI button disabled state) ────────────
  const isAffordable = useCallback((id: string) => {
    const def = BUILDINGS.find(b => b.id === id);
    if (!def) return false;
    return resources.gold >= def.cost.gold && resources.wood >= def.cost.wood && resources.stone >= def.cost.stone;
  }, [resources]);

  // ── Toggle building selection ─────────────────────────────────────
  const handleSelectBuilding = useCallback((id: string) => {
    setSelectedBuilding(prev => prev === id ? null : id);
  }, []);

  // ── Main PixiJS setup ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let dead = false;

    (async () => {
      const el = containerRef.current!;
      const dpr = window.devicePixelRatio || 1;

      // ── 1. Application ──────────────────────────────────────────
      const app = new Application();
      await app.init({
        width: el.clientWidth, height: el.clientHeight,
        background: '#1a1a2e', resolution: dpr,
        autoDensity: true, antialias: true,
      });
      if (dead) { app.destroy(true); return; }

      const cvs = app.canvas as HTMLCanvasElement;
      cvs.style.width = '100%'; cvs.style.height = '100%'; cvs.style.display = 'block';
      el.appendChild(cvs);
      pixiRef.current = app;

      // ── 2. Load spritesheet ─────────────────────────────────────
      let tex: Record<string, Texture> | null = null;
      try {
        const data = await fetch('/assets/kenney-tower-defense/spritesheet.json').then(r => r.json());
        const sheet = new Spritesheet(
          Texture.from('/assets/kenney-tower-defense/Tilesheet/towerDefense_tilesheet.png'),
          data,
        );
        await sheet.parse();
        tex = sheet.textures;
      } catch (e) { console.warn('[SpritePOC] spritesheet fallback:', e); }

      // ── 3. World container ──────────────────────────────────────
      const world = new Container();
      app.stage.addChild(world);
      const mapContainer = new Container();
      world.addChild(mapContainer);

      // ── 4. Render tiles ─────────────────────────────────────────
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const id = MAP[r][c];
          const fn = FRAME[id];
          const x = c * TILE, y = r * TILE;

          if (tex && fn && tex[fn]) {
            const sp = new Sprite(tex[fn]);
            if (id === 3) {
              sp.anchor.set(0.5);
              sp.position.set(x + TILE / 2, y + TILE / 2);
              sp.rotation = Math.PI / 2;
            } else {
              sp.position.set(x, y);
            }
            mapContainer.addChild(sp);
          } else {
            const g = new Graphics();
            g.rect(0, 0, TILE, TILE).fill({ color: FALLBACK[id] ?? 0x333333 });
            g.rect(0, 0, TILE, TILE).stroke({ color: 0x000000, width: 1 });
            g.position.set(x, y);
            mapContainer.addChild(g);
          }
        }
      }

      // Grid overlay
      const grid = new Graphics();
      const mapW = COLS * TILE, mapH = ROWS * TILE;
      for (let c = 0; c <= COLS; c++) {
        grid.moveTo(c * TILE, 0); grid.lineTo(c * TILE, mapH);
        grid.stroke({ width: 0.5, color: 0xffffff, alpha: 0.12 });
      }
      for (let r = 0; r <= ROWS; r++) {
        grid.moveTo(0, r * TILE); grid.lineTo(mapW, r * TILE);
        grid.stroke({ width: 0.5, color: 0xffffff, alpha: 0.12 });
      }
      mapContainer.addChild(grid);

      // ── Building & Enemy layers ─────────────────────────────────
      const buildingLayer = new Container();
      world.addChild(buildingLayer);
      const enemyLayer = new Container();
      world.addChild(enemyLayer);

      // ── Attack effect layer (on top of enemies) ─────────────────
      const effectLayer = new Container();
      world.addChild(effectLayer);

      // ── Runtime collections ─────────────────────────────────────
      const towers: TowerInstance[] = [];
      const enemies: EnemyInstance[] = [];

      // ── 5. Center map ───────────────────────────────────────────
      const vw = el.clientWidth, vh = el.clientHeight;
      const s0 = Math.min((vw * 0.85) / mapW, (vh * 0.85) / mapH, ZOOM_MAX);
      world.scale.set(s0);
      world.x = (vw - mapW * s0) / 2;
      world.y = (vh - mapH * s0) / 2;
      setZoom(s0);

      // ── Helper: create level indicator dots ─────────────────────
      const createLevelDots = (level: number): Graphics => {
        const dots = new Graphics();
        const dotR = 3, spacing = 10;
        const startX = TILE / 2 - ((level - 1) * spacing) / 2;
        const dotY = TILE - 8;
        const dotColor = level === 1 ? 0x2ecc71 : level === 2 ? 0xf1c40f : 0xe74c3c;
        for (let i = 0; i < level; i++) {
          dots.circle(startX + i * spacing, dotY, dotR).fill({ color: dotColor });
        }
        return dots;
      };

      // ── Helper: create HP bar for an enemy ──────────────────────
      const createHpBar = (): Graphics => {
        const bar = new Graphics();
        // Background (dark)
        bar.rect(-15, -TILE * 0.45, 30, 4).fill({ color: 0x333333 });
        // Foreground (red)
        bar.rect(-15, -TILE * 0.45, 30, 4).fill({ color: 0xe74c3c });
        return bar;
      };

      // ── Helper: update HP bar fill ──────────────────────────────
      const updateHpBar = (bar: Graphics, ratio: number) => {
        bar.clear();
        // Background
        bar.rect(-15, -TILE * 0.45, 30, 4).fill({ color: 0x333333 });
        // Foreground (clamped)
        const w = Math.max(0, 30 * ratio);
        if (w > 0) {
          bar.rect(-15, -TILE * 0.45, w, 4).fill({ color: ratio > 0.5 ? 0x2ecc71 : ratio > 0.25 ? 0xf1c40f : 0xe74c3c });
        }
      };

      // ── Helper: show damage floating text ───────────────────────
      const showDamageText = (x: number, y: number, damage: number) => {
        const txt = new Text({
          text: `-${damage}`,
          style: new TextStyle({
            fontSize: 16,
            fill: '#ffffff',
            fontWeight: 'bold',
            stroke: { color: '#000000', width: 2 },
          }),
        });
        txt.anchor.set(0.5);
        txt.position.set(x, y - TILE * 0.5);
        effectLayer.addChild(txt);

        // GSAP: float up + fade out
        gsap.to(txt, {
          y: txt.y - 30,
          alpha: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => {
            effectLayer.removeChild(txt);
            txt.destroy();
          },
        });
      };

      // ── Helper: draw attack line from tower to enemy ────────────
      const drawAttackLine = (fromX: number, fromY: number, toX: number, toY: number) => {
        const line = new Graphics();
        line.moveTo(fromX, fromY);
        line.lineTo(toX, toY);
        line.stroke({ width: 2, color: 0xff3333, alpha: 0.9 });
        effectLayer.addChild(line);

        // GSAP: fade out and remove
        gsap.to(line, {
          alpha: 0,
          duration: ATTACK_LINE_DURATION,
          ease: 'power2.out',
          onComplete: () => {
            effectLayer.removeChild(line);
            line.destroy();
          },
        });
      };

      // ── Helper: kill enemy with death animation ─────────────────
      const killEnemy = (enemy: EnemyInstance) => {
        if (enemy.dead) return;
        enemy.dead = true;
        setKills(prev => prev + 1);

        gsap.to(enemy.sprite.scale, {
          x: 0, y: 0,
          duration: 0.4,
          ease: 'back.in(2)',
          onComplete: () => {
            enemyLayer.removeChild(enemy.sprite);
            enemy.sprite.destroy();
            if (enemy.hpBar.parent) {
              enemy.hpBar.parent.removeChild(enemy.hpBar);
            }
            enemy.hpBar.destroy();
          },
        });

        // Fade out hp bar too
        gsap.to(enemy.hpBar, { alpha: 0, duration: 0.3 });
      };

      // ── Helper: place building sprite on map ────────────────────
      const placeBuildingSprite = (col: number, row: number, def: BuildingDef) => {
        const px = col * TILE, py = row * TILE;
        let sp: Sprite;
        if (tex && tex[def.frame]) {
          sp = new Sprite(tex[def.frame]);
          sp.width = TILE; sp.height = TILE;
        } else {
          // Fallback: colored rectangle with initial letter
          const g = new Graphics();
          g.rect(4, 4, TILE - 8, TILE - 8).fill({ color: def.color });
          g.rect(4, 4, TILE - 8, TILE - 8).stroke({ color: 0xffffff, width: 1 });
          const lbl = new Text({
            text: def.label[0],
            style: new TextStyle({ fontSize: 18, fill: '#ffffff', fontWeight: 'bold' }),
          });
          lbl.anchor.set(0.5);
          lbl.position.set(TILE / 2, TILE / 2);
          g.addChild(lbl);
          sp = g as unknown as Sprite;
        }
        sp.position.set(px, py);
        sp.alpha = 0.3;

        // Level dots
        const dots = createLevelDots(1);
        sp.addChild(dots);

        buildingLayer.addChild(sp);

        // Build animation: fade in + scale bounce via GSAP
        sp.scale.set(0.8);
        gsap.to(sp, {
          alpha: 1.0,
          duration: 0.5,
          ease: 'power2.out',
        });
        gsap.to(sp.scale, {
          x: 1, y: 1,
          duration: 0.5,
          ease: 'back.out(1.7)',
        });

        buildingsMapRef.current.set(`${col},${row}`, 1);

        // Register as combat tower
        towers.push({ sprite: sp, col, row, cooldown: 0 });
        setBuildingCount(prev => prev + 1);
      };

      // ── Helper: spawn enemy and animate along road path ─────────
      const spawnEnemy = () => {
        if (dead || ROAD_PATH.length < 2) return;
        const def = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];

        let sp: Sprite;
        if (tex && tex[def.frame]) {
          sp = new Sprite(tex[def.frame]);
          sp.width = TILE * 0.6;
          sp.height = TILE * 0.6;
          sp.anchor.set(0.5);
        } else {
          const g = new Graphics();
          g.circle(0, 0, TILE * 0.25).fill({ color: def.color });
          g.circle(0, 0, TILE * 0.25).stroke({ color: 0xffffff, width: 1.5 });
          sp = g as unknown as Sprite;
        }
        sp.position.set(ROAD_PATH[0].x, ROAD_PATH[0].y);
        enemyLayer.addChild(sp);

        // HP bar
        const hpBar = createHpBar();
        sp.addChild(hpBar);

        const enemy: EnemyInstance = {
          sprite: sp,
          hpBar,
          hp: def.hp,
          maxHp: def.hp,
          dead: false,
        };
        enemies.push(enemy);

        // GSAP timeline: move through each waypoint
        const tl = gsap.timeline({
          onComplete: () => {
            // Remove from enemies array
            const idx = enemies.indexOf(enemy);
            if (idx !== -1) enemies.splice(idx, 1);
            // Only remove if not already killed
            if (!enemy.dead) {
              enemyLayer.removeChild(sp);
              sp.destroy();
            }
          },
        });

        for (let i = 1; i < ROAD_PATH.length; i++) {
          tl.to(sp, {
            x: ROAD_PATH[i].x,
            y: ROAD_PATH[i].y,
            duration: def.speed,
            ease: 'none',
          });
        }
      };

      // ── Wave system ─────────────────────────────────────────────
      let currentWave = 0;
      let waveTimer = 0;
      let enemiesToSpawn = 0;
      let spawnInterval: ReturnType<typeof setInterval> | null = null;

      // Wave announcement text (PixiJS Text at top of screen)
      const waveText = new Text({
        text: '',
        style: new TextStyle({
          fontSize: 36,
          fill: '#f1c40f',
          fontWeight: 'bold',
          stroke: { color: '#000000', width: 4 },
          dropShadow: {
            alpha: 0.5,
            angle: Math.PI / 4,
            blur: 4,
            color: '#000000',
            distance: 3,
          },
        }),
      });
      waveText.anchor.set(0.5);
      waveText.position.set(mapW / 2, mapH / 2);
      waveText.alpha = 0;
      world.addChild(waveText);

      const startWave = () => {
        if (dead) return;
        currentWave++;
        setWave(currentWave);
        enemiesToSpawn = currentWave * 2;

        // Show wave announcement with GSAP animation
        waveText.text = `⚔️ Wave ${currentWave} ⚔️`;
        waveText.alpha = 0;
        waveText.scale.set(0.5);
        gsap.to(waveText, {
          alpha: 1,
          duration: 0.4,
          ease: 'power2.out',
        });
        gsap.to(waveText.scale, {
          x: 1.2, y: 1.2,
          duration: 0.4,
          ease: 'back.out(1.7)',
        });
        gsap.to(waveText, {
          alpha: 0,
          delay: 1.5,
          duration: 0.6,
          ease: 'power2.in',
        });
        gsap.to(waveText.scale, {
          x: 1.5, y: 1.5,
          delay: 1.5,
          duration: 0.6,
          ease: 'power2.in',
        });

        // Spawn enemies staggered over time
        let spawned = 0;
        if (spawnInterval) clearInterval(spawnInterval);
        spawnInterval = setInterval(() => {
          if (dead || spawned >= enemiesToSpawn) {
            if (spawnInterval) clearInterval(spawnInterval);
            return;
          }
          spawnEnemy();
          spawned++;
        }, 800);
      };

      // ── Combat tick: towers attack enemies ──────────────────────
      const combatTick = (dt: number) => {
        for (const tower of towers) {
          // Reduce cooldown
          tower.cooldown = Math.max(0, tower.cooldown - dt);
          if (tower.cooldown > 0) continue;

          // Tower center in pixel coords
          const tx = tower.col * TILE + TILE / 2;
          const ty = tower.row * TILE + TILE / 2;
          const rangePx = TOWER_RANGE * TILE;

          // Find closest alive enemy in range
          let closest: EnemyInstance | null = null;
          let closestDist = Infinity;

          for (const enemy of enemies) {
            if (enemy.dead) continue;
            const dx = enemy.sprite.x - tx;
            const dy = enemy.sprite.y - ty;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= rangePx && dist < closestDist) {
              closest = enemy;
              closestDist = dist;
            }
          }

          if (closest) {
            // Fire!
            tower.cooldown = TOWER_COOLDOWN;

            // Attack line
            drawAttackLine(tx, ty, closest.sprite.x, closest.sprite.y);

            // Deal damage
            closest.hp -= TOWER_DAMAGE;

            // Damage floating text
            showDamageText(closest.sprite.x, closest.sprite.y, TOWER_DAMAGE);

            // Update HP bar
            const ratio = Math.max(0, closest.hp / closest.maxHp);
            updateHpBar(closest.hpBar, ratio);

            // Check death
            if (closest.hp <= 0) {
              killEnemy(closest);
            }
          }
        }
      };

      // ── Wave timer tick ─────────────────────────────────────────
      const waveTick = (dt: number) => {
        waveTimer += dt;
        if (waveTimer >= WAVE_INTERVAL) {
          waveTimer = 0;
          startWave();
        }
      };

      // ── Auto-spawn enemies every 3 seconds (ambient, non-wave) ──
      const ambientSpawnTimer = setInterval(() => { if (!dead) spawnEnemy(); }, 3000);

      // ── 6. Drag pan + Click to place building ───────────────────
      let dragging = false;
      let dragMoved = false;
      let dragStartX = 0, dragStartY = 0;
      let worldStartX = 0, worldStartY = 0;

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
        dragging = true;
        dragMoved = false;
        dragStartX = e.globalX; dragStartY = e.globalY;
        worldStartX = world.x; worldStartY = world.y;
      });

      app.stage.on('pointermove', (e: FederatedPointerEvent) => {
        if (!dragging) return;
        const dx = e.globalX - dragStartX;
        const dy = e.globalY - dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
        world.x = worldStartX + dx;
        world.y = worldStartY + dy;
      });

      const onPointerUp = (e: FederatedPointerEvent) => {
        if (dragging && !dragMoved) {
          // This was a click, not a drag — try to place a building
          const selId = selectedRef.current;
          if (selId) {
            const def = BUILDINGS.find(b => b.id === selId);
            if (def) {
              // Convert screen coords → world coords
              const worldPos = world.toLocal({ x: e.globalX, y: e.globalY });
              const col = Math.floor(worldPos.x / TILE);
              const row = Math.floor(worldPos.y / TILE);

              // Validate: must be within map, must be grass, must not have building
              if (col >= 0 && col < COLS && row >= 0 && row < ROWS
                  && MAP[row][col] === 0
                  && !buildingsMapRef.current.has(`${col},${row}`)) {
                // Check resources via React callback ref (atomic check + deduct)
                if (tryPlaceRef.current(selId)) {
                  placeBuildingSprite(col, row, def);
                }
              }
            }
          }
        }
        dragging = false;
      };

      app.stage.on('pointerup', onPointerUp);
      app.stage.on('pointerupoutside', () => { dragging = false; });

      // ── 7. Wheel zoom (centered on cursor) ──────────────────────
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const f = e.deltaY > 0 ? 0.92 : 1.08;
        const cur = world.scale.x;
        const ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cur * f));
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const bx = (mx - world.x) / cur, by = (my - world.y) / cur;
        world.scale.set(ns);
        world.x = mx - bx * ns;
        world.y = my - by * ns;
        setZoom(ns);
      };
      cvs.addEventListener('wheel', onWheel, { passive: false });

      // ── 8. Responsive resize ────────────────────────────────────
      const onResize = () => {
        if (!containerRef.current) return;
        app.renderer.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        app.stage.hitArea = app.screen;
      };
      window.addEventListener('resize', onResize);

      // ── 9. FPS counter + Combat + Wave ticker ───────────────────
      let frames = 0, t0 = performance.now();
      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000; // seconds

        // FPS
        frames++;
        const now = performance.now();
        if (now - t0 >= 1000) {
          setFps(Math.round(frames * 1000 / (now - t0)));
          frames = 0; t0 = now;
        }

        // Combat tick
        combatTick(dt);

        // Wave tick
        waveTick(dt);
      });

      setLoaded(true);

      // Start first wave after a short delay
      setTimeout(() => { if (!dead) startWave(); }, 2000);

      // ── Cleanup ─────────────────────────────────────────────────
      (app as any)._cleanup = () => {
        cvs.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', onResize);
        clearInterval(ambientSpawnTimer);
        if (spawnInterval) clearInterval(spawnInterval);
        gsap.killTweensOf('*');
      };
    })();

    return () => {
      dead = true;
      const app = pixiRef.current;
      if (app) {
        (app as any)._cleanup?.();
        app.destroy(true, { children: true, texture: true });
        pixiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0f0f1a' }}>
      {/* PixiJS canvas container */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Loading overlay */}
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(15,15,26,0.92)', color: '#fff',
          fontFamily: 'Arial', fontSize: 18, zIndex: 20,
        }}>
          🗺️ 加载 Kenney 精灵资源…
        </div>
      )}

      {/* ── Top Bar: Resources + Info ─────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 20px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85), transparent)',
        color: '#fff', fontFamily: 'Arial', fontSize: 13, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>💰 {resources.gold}</span>
          <span style={{ color: '#e67e22', fontWeight: 'bold' }}>🪵 {resources.wood}</span>
          <span style={{ color: '#95a5a6', fontWeight: 'bold' }}>🪨 {resources.stone}</span>
        </div>
        <span>🗺️ Sprite POC — {COLS}×{ROWS} · 缩放 {zoom.toFixed(2)}x</span>
        <span>
          <span style={{ color: fps >= 55 ? '#2ecc71' : '#e74c3c' }}>FPS: {fps}</span>
          &nbsp;&nbsp;
          <a href="/" style={{ color: '#74b9ff', textDecoration: 'none', pointerEvents: 'auto' }}>← 首页</a>
        </span>
      </div>

      {/* ── Right Panel: Building Selection ───────────────────────── */}
      <div style={{
        position: 'absolute', top: 60, right: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'auto',
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.8)', borderRadius: 10, padding: '10px 12px',
          color: '#fff', fontFamily: 'Arial', fontSize: 12,
          backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)',
          minWidth: 140,
        }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
            🏗️ 建筑面板
          </div>
          {BUILDINGS.map(b => {
            const affordable = isAffordable(b.id);
            const selected = selectedBuilding === b.id;
            return (
              <button
                key={b.id}
                onClick={() => handleSelectBuilding(b.id)}
                disabled={!affordable}
                style={{
                  display: 'block', width: '100%', marginBottom: 6, padding: '8px 10px',
                  background: selected
                    ? 'rgba(46,204,113,0.3)'
                    : affordable ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: selected ? '2px solid #2ecc71' : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, color: affordable ? '#fff' : '#555',
                  cursor: affordable ? 'pointer' : 'not-allowed',
                  fontFamily: 'Arial', fontSize: 12, textAlign: 'left',
                  transition: 'all 0.2s', outline: 'none',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{b.label}</div>
                <div style={{ fontSize: 10, color: affordable ? '#aaa' : '#444', marginTop: 2 }}>
                  💰{b.cost.gold} 🪵{b.cost.wood} 🪨{b.cost.stone}
                </div>
              </button>
            );
          })}
          {selectedBuilding && (
            <div style={{
              marginTop: 4, padding: '6px 8px',
              background: 'rgba(46,204,113,0.15)', borderRadius: 6,
              fontSize: 11, color: '#2ecc71', textAlign: 'center',
            }}>
              ✅ 点击草地放置
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Info Bar ───────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 20px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85), transparent)',
        color: '#ccc', fontFamily: 'Arial', fontSize: 13, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>⚔️ 波次: {wave}</span>
          <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>💀 击杀: {kills}</span>
          <span style={{ color: '#3498db', fontWeight: 'bold' }}>🏗️ 建筑: {buildingCount}</span>
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          🖱️ 拖拽平移 &nbsp;|&nbsp; 🔄 滚轮缩放 &nbsp;|&nbsp; 🏗️ 右侧选建筑 → 点击草地放置
        </div>
        <div>
          <span style={{ color: fps >= 55 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
            🎮 FPS: {fps}
          </span>
        </div>
      </div>
    </div>
  );
}
