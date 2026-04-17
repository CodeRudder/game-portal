# 三国霸业技术调研报告 (Round 1)

> **调研日期**：2025-07
> **调研范围**：地图生成方案 + 精灵动画方案
> **技术栈**：PixiJS v8 + TypeScript
> **项目背景**：三国霸业放置策略游戏，当前地图存在拼接错乱、元素单一、缺乏三国主题感等问题

---

## 1. 地图生成方案

### 1.1 主流方案对比

| 方案 | 描述 | 性能 | 开发成本 | 灵活性 | 适用场景 | 推荐指数 |
|------|------|:----:|:-------:|:------:|---------|:--------:|
| **@pixi/tilemap** | PixiJS 官方瓦片地图插件，基于 CompositeTilemap 批量渲染 | ★★★★★ | 中 | 中 | 大规模重复瓦片背景 | ★★★★☆ |
| **Tiled + pixi-tiledmap** | 用 Tiled 编辑器设计地图，pixi-tiledmap 插件加载渲染 | ★★★★☆ | 低 | ★★★★★ | 复杂多层地图、关卡设计 | ★★★★★ |
| **图片背景 + 透明叠加层** | 预渲染整张背景图，交互元素用独立 Sprite 叠加 | ★★★★★ | 低 | 低 | 固定布局、小地图 | ★★★☆☆ |
| **程序化生成 (Perlin/Simplex Noise)** | 用噪声算法生成地形高度图，自动分配瓦片类型 | ★★★☆☆ | 高 | ★★★★★ | 无限地图、随机地图 | ★★☆☆☆ |
| **Canvas 2D 离屏预渲染** | 用 Canvas API 预渲染地图到离屏 Canvas，作为纹理贴到 PixiJS | ★★★★☆ | 中 | 中 | 复杂自定义渲染 | ★★★☆☆ |
| **Hex Grid + 自定义渲染** | 六边形网格 + 自定义绘制逻辑 | ★★★★☆ | 高 | ★★★★★ | 策略游戏六边形地图 | ★★★★☆ |

#### 各方案详细说明

**方案 A：@pixi/tilemap（PixiJS 官方瓦片方案）**
- **原理**：使用 `CompositeTilemap` 将大量瓦片合批渲染，单次 draw call 可渲染数千个瓦片
- **优势**：性能极高（16K tiles/tilemap，超过自动拆分），与 PixiJS 深度集成，Canvas fallback
- **劣势**：仅支持矩形瓦片，不支持等距/六边形；需要手动管理瓦片数据
- **代码示例**：
  ```typescript
  import { CompositeTilemap } from '@pixi/tilemap';
  
  const tilemap = new CompositeTilemap();
  // 添加瓦片：纹理、x、y、可选缩放
  tilemap.tile(texture, x, y, { uvs, animX, animY });
  ```
- **限制**：默认 16 个 base-texture，超过自动创建新 tilemap；16K tiles/tilemap

**方案 B：Tiled Map Editor + pixi-tiledmap（推荐）**
- **原理**：使用 Tiled 编辑器可视化设计地图（支持 JSON/TMX 格式），通过 pixi-tiledmap v2 加载渲染
- **优势**：所见即所得编辑，支持多图层、对象层、碰撞层，支持六边形/等距/正交地图
- **pixi-tiledmap v2 特性**：完全重写支持 PixiJS v8，自带 JSON/TMX 解析器（无外部依赖），ESM/CJS 双输出
- **工作流**：Tiled 编辑 → 导出 JSON → pixi-tiledmap 加载 → PixiJS 渲染
- **仓库**：https://github.com/riebel/pixi-tiledmap

**方案 C：图片背景 + 透明叠加层**
- **原理**：预渲染一张完整的背景图（如水墨山水画），交互元素（城池、NPC）用独立 Sprite 叠加
- **优势**：渲染性能最好（仅 1 张纹理），美术自由度最高
- **劣势**：不可动态修改地形，内存占用大（大图），缩放后可能模糊

**方案 D：程序化生成**
- **原理**：使用 Perlin Noise / Simplex Noise 生成高度图，根据高度值分配地形类型（平原/山地/水域/森林）
- **工具库**：`simplex-noise`（npm 包，轻量高效）
- **适用**：每次进入游戏随机生成新地图，增加可玩性
- **不适合当前项目**：三国霸业的地图是固定的中国地理格局，不需要随机生成

**方案 E：Hex Grid 自定义渲染**
- **原理**：六边形网格数学计算 + 自定义 PixiJS Graphics/Sprite 渲染
- **库推荐**：`honeycomb-grid`（npm 包，提供六边形网格数据结构）
- **适合**：当前项目的六边形领土设计（15块领土，六边形网格）

### 1.2 推荐方案

#### 🏆 主推荐：混合方案（Tiled + @pixi/tilemap + Hex Grid 叠加）

**推荐理由**：

1. **底图层（地形/装饰）**：使用 **Tiled 编辑器** + **pixi-tiledmap** 渲染
   - 美术可以在 Tiled 中可视化编辑地形底纹（平原、山地、水域、森林、关隘）
   - 支持多图层（地形层、装饰层、碰撞层）
   - 导出 JSON 格式，pixi-tiledmap v2 直接加载

2. **领土层（六边形网格）**：使用 **honeycomb-grid** + 自定义渲染
   - 15块领土用六边形网格管理
   - 每个六边形可独立设置颜色（势力色）、等级、产出
   - 支持点击交互、hover 高亮

3. **交互层（城池/NPC/特效）**：使用标准 PixiJS Sprite/Container
   - 城池建筑用 Sprite + AnimatedSprite
   - NPC 用 Sprite + 行走动画
   - 特效用 Particle Container

**架构图**：
```
┌─────────────────────────────────────────┐
│  pixi-viewport（视口控制：拖拽/缩放/边界限制）  │
│  ┌───────────────────────────────────┐  │
│  │ Layer 0: 地形底图（Tiled + tilemap）│  │
│  │   - 平原/山地/水域/森林瓦片         │  │
│  │   - 装饰元素（树木/石头/道路）       │  │
│  ├───────────────────────────────────┤  │
│  │ Layer 1: 六边形领土网格             │  │
│  │   - honeycomb-grid 数据结构        │  │
│  │   - 势力色填充 + 边框              │  │
│  │   - 产出气泡                       │  │
│  ├───────────────────────────────────┤  │
│  │ Layer 2: 城池/建筑 Sprite          │  │
│  │   - 城池图标 + 等级标识             │  │
│  │   - 建筑动画 Sprite                │  │
│  ├───────────────────────────────────┤  │
│  │ Layer 3: NPC/角色 Sprite           │  │
│  │   - NPC 行走动画                   │  │
│  │   - 武将立绘                       │  │
│  ├───────────────────────────────────┤  │
│  │ Layer 4: UI 叠加层                 │  │
│  │   - 产出气泡                       │  │
│  │   - 筛选栏/小地图                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**性能预估**：
- 地形底图：~300 个瓦片 → 1-2 次 draw call（CompositeTilemap 合批）
- 六边形领土：15 个 → 1 次 draw call
- 建筑/NPC：~50 个 Sprite → 5-10 次 draw call
- **总计**：< 15 次 draw call，远低于性能瓶颈

### 1.3 免费素材资源

#### 三国/中国风瓦片素材

| 资源名 | 链接 | 类型 | 价格 | 说明 |
|--------|------|------|:----:|------|
| **KR Spirit of Asia Tileset v2** | [itch.io](https://kokororeflections.itch.io/kr-spirit-of-asia) | Tileset | $17.99 | 最佳亚洲风格瓦片集，含寺庙、村庄、神社、水车动画 |
| **Mythic Chinese Buildings** | [itch.io](https://itch.io/game-assets/tag-chinese/tag-tileset) | 建筑 Sprite | 免费起 | 中国神话风格建筑素材 |
| **Chinese Garden Tileset** | [itch.io](https://itch.io/game-assets/tag-chinese/tag-tileset) | Tileset | 免费起 | 中国园林风格瓦片 |
| **RPG Asset: Medieval Chinese Buildings** | [itch.io](https://itch.io/game-assets/tag-chinese/tag-tileset) | 建筑 Tileset | 免费起 | 中式古建筑瓦片包 |
| **反三国志地图素材** | [爱给网](https://www.aigei.com/game2d/lib/san_guo_zh_31/) | 地图背景 | 免费 | 经典三国游戏远景地图素材包（239张） |

#### 通用瓦片素材（可改色为三国风）

| 资源名 | 链接 | 类型 | 价格 | 说明 |
|--------|------|------|:----:|------|
| **Tiny Swords** | [itch.io](https://itch.io/game-assets/free/tag-tileset) | 完整素材包 | 免费 | 高质量像素风，含地形/建筑/角色 |
| **Sprout Lands** | [itch.io](https://itch.io/game-assets/free/tag-tileset) | 完整素材包 | 免费 | 田园风格瓦片，适合农田/药圃 |
| **Tiny Farm RPG** | [itch.io](https://itch.io/game-assets/free/tag-tileset) | 农场素材 | 免费 | 16x16 农场瓦片，适合农田系统 |
| **Modern Interiors** | [itch.io](https://itch.io/game-assets/free/tag-tileset) | 室内瓦片 | 免费 | 可参考建筑内部布局 |
| **OpenGameArt 2D Assets** | [opengameart.org](https://opengameart.org/content/2d-assets) | 综合 | 免费 | 大量开源 2D 素材，CC 协议 |

#### AI 生成方案（补充素材不足）

| 工具 | 链接 | 说明 |
|------|------|------|
| **Stable Diffusion + img2img** | 本地部署 | 用现有瓦片素材 + 中国风提示词生成变体 |
| **Galaxy AI Portrait** | [image.galaxy.ai](https://image.galaxy.ai/ai-character-portrait-generator) | 免费角色立绘生成 |
| **Perchance AI Character** | [perchance.org](https://perchance.org/ai-character-generator) | 免费、无需登录、无限使用 |
| **OpenArt** | [openart.ai](https://openart.ai/generator/character-portrait) | 角色立绘生成，质量较高 |

### 1.4 拼接问题解决方案

#### 问题分析

Tile 拼接错乱通常由以下原因导致：
1. **纹理渗色（Texture Bleeding）**：GPU 纹理采样时，相邻瓦片的像素互相渗透
2. **亚像素渲染（Sub-pixel Rendering）**：瓦片坐标为浮点数时，渲染在像素之间产生缝隙
3. **纹理过滤（Texture Filtering）**：线性过滤导致边缘像素混合
4. **缩放导致的不对齐**：非整数倍缩放时瓦片边缘不重合

#### 解决方案（按优先级排列）

**方案 1：瓦片边缘扩展（Tile Extrusion）—— 最推荐**
```typescript
// 使用 TexturePacker 或 tile-extruder 工具
// 在每个瓦片边缘向外扩展 1-2px，复制边缘像素
// 这样即使采样到相邻区域，也是同色像素

// 工具：tile-extruder (npm)
// npx tile-extruder --tileWidth 120 --tileHeight 120 --input ./tileset.png --output ./tileset-extruded.png
```

**方案 2：半像素偏移（Half-pixel Offset）**
```typescript
// 渲染时将瓦片坐标向内偏移 0.5px
const HALF_PIXEL = 0.5;

function renderTile(tilemap: CompositeTilemap, texture: Texture, col: number, row: number, tileSize: number) {
    const x = col * tileSize + HALF_PIXEL;
    const y = row * tileSize + HALF_PIXEL;
    tilemap.tile(texture, x, y);
}
```

**方案 3：禁用纹理过滤（Point Filtering）**
```typescript
// 像素风格游戏必须使用最近邻采样
const texture = Texture.from('tileset.png');
texture.source.scaleMode = 'nearest'; // PixiJS v8 语法
```

**方案 4：确保整数坐标**
```typescript
// 所有瓦片位置取整
function snapToPixel(value: number): number {
    return Math.round(value);
}

// 在 pixi-viewport 的 moveCallback 中
viewport.on('moved', () => {
    viewport.position.set(
        Math.round(viewport.position.x),
        Math.round(viewport.position.y)
    );
});
```

**方案 5：使用 @pixi/tilemap 内置的间隙补偿**
```typescript
// @pixi/tilemap 的 tile() 方法支持缩放参数
// 可以略微放大每个瓦片（如 0.5%）来覆盖间隙
tilemap.tile(texture, x, y, { 
    // 略微放大覆盖间隙
    tileWidth: tileSize + 1,
    tileHeight: tileSize + 1
});
```

**综合最佳实践**：
```typescript
// 1. 素材阶段：使用 tile-extruder 扩展瓦片边缘
// 2. 加载阶段：设置 scaleMode = 'nearest'
// 3. 渲染阶段：使用 @pixi/tilemap 合批渲染
// 4. 坐标阶段：确保整数坐标 + 半像素偏移
// 5. 视口阶段：pixi-viewport 移动时 snap 到整数像素
```

### 1.5 边缘滚动实现

#### 推荐方案：pixi-viewport 插件

**pixi-viewport** 是 PixiJS 官方生态的视口插件，v6.0.3 已支持 PixiJS v8。

**核心功能**：
- 拖拽平移（drag）
- 鼠标滚轮/双指缩放（pinch-to-zoom）
- 边界限制（clamp）
- 弹性回弹（bounce）
- 跟随目标（follow）
- 边缘滚动（mouse-edges）
- 减速惯性（decelerate）

**安装**：
```bash
npm install pixi-viewport
```

**基础配置**：
```typescript
import { Viewport } from 'pixi-viewport';

// 创建视口
const viewport = new Viewport({
    screenWidth: 1280,            // 屏幕宽度
    screenHeight: 696,            // 屏幕高度（减去顶部UI）
    worldWidth: 2400,             // 地图世界宽度（20×120）
    worldHeight: 1800,            // 地图世界高度（15×120）
    events: app.renderer.events,  // PixiJS v8 事件系统
});

// 启用插件
viewport
    .drag()                        // 拖拽平移
    .pinch()                       // 双指缩放
    .wheel()                       // 滚轮缩放
    .decelerate()                  // 惯性减速
    .clamp({                       // 边界限制
        direction: 'all',
        underflow: 'center',       // 地图小于屏幕时居中
    })
    .clampZoom({                   // 缩放限制
        minScale: 0.5,             // 最小 50%
        maxScale: 2.0,             // 最大 200%
    })
    .bounce({                      // 弹性回弹
        ease: 'easeInOutCubic',
        time: 300,
    });

app.stage.addChild(viewport);

// 将所有地图层添加到 viewport
viewport.addChild(terrainLayer);
viewport.addChild(territoryLayer);
viewport.addChild(buildingLayer);
viewport.addChild(npcLayer);
```

**边缘滚动（鼠标移到屏幕边缘自动滚动地图）**：
```typescript
viewport.mouseEdges({
    radius: 50,           // 边缘触发区域（px）
    speed: 8,             // 滚动速度
    opposite: true,       // 反向也触发
});

// 手机端不需要边缘滚动（用拖拽替代）
if (isMobile()) {
    viewport.mouseEdges(false); // 禁用
}
```

**边界 Clamp 实现原理**：
```typescript
// pixi-viewport 内部 clamp 实现（简化版）
function clampViewport(viewport: Viewport) {
    const { x, y, scaleX, scaleY } = viewport;
    const { screenWidth, screenHeight, worldWidth, worldHeight } = viewport;
    
    // 计算可见世界范围
    const visibleWidth = screenWidth / scaleX;
    const visibleHeight = screenHeight / scaleY;
    
    // 限制 x 方向
    const minX = -(visibleWidth - worldWidth);
    const maxX = 0;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    
    // 限制 y 方向
    const minY = -(visibleHeight - worldHeight);
    const maxY = 0;
    const clampedY = Math.max(minY, Math.min(maxY, y));
    
    viewport.position.set(clampedX, clampedY);
}
```

**性能优化**：
```typescript
// 只渲染视口内的瓦片（视口裁剪）
function getVisibleTiles(viewport: Viewport, tileSize: number): { col: number, row: number }[] {
    const bounds = viewport.getVisibleBounds();
    const startCol = Math.max(0, Math.floor(bounds.left / tileSize));
    const endCol = Math.min(MAP_COLS - 1, Math.ceil(bounds.right / tileSize));
    const startRow = Math.max(0, Math.floor(bounds.top / tileSize));
    const endRow = Math.min(MAP_ROWS - 1, Math.ceil(bounds.bottom / tileSize));
    
    const tiles = [];
    for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
            tiles.push({ col, row });
        }
    }
    return tiles;
}
```

---

## 2. 精灵动画方案

### 2.1 PixiJS v8 精灵动画

#### 核心 API：AnimatedSprite

PixiJS v8 提供了 `AnimatedSprite` 类用于帧动画：

```typescript
import { AnimatedSprite, Texture, Spritesheet, Assets } from 'pixi.js';

// 方式 1：从纹理数组创建
const walkFrames: Texture[] = [
    Texture.from('walk_0.png'),
    Texture.from('walk_1.png'),
    // ...
];
const walkAnim = new AnimatedSprite(walkFrames);
walkAnim.animationSpeed = 0.1;  // 每帧速度（1 = 每tick一帧）
walkAnim.play();

// 方式 2：从 Spritesheet 创建（推荐）
const spritesheetData = {
    frames: {
        'walk_0': { frame: { x: 0, y: 0, w: 48, h: 64 } },
        'walk_1': { frame: { x: 48, y: 0, w: 48, h: 64 } },
        // ...
    },
    animations: {
        walk: ['walk_0', 'walk_1', 'walk_2', 'walk_3'],
        idle: ['idle_0', 'idle_1', 'idle_2'],
    },
    meta: {
        image: 'character.png',
        size: { w: 192, h: 64 },
    },
};

const sheet = new Spritesheet(Texture.from('character.png'), spritesheetData);
await sheet.parse();

const walkAnim = new AnimatedSprite(sheet.animations.walk);
walkAnim.animationSpeed = 0.15;
walkAnim.play();
```

#### 动画状态机实现

```typescript
interface AnimationState {
    name: string;
    frames: Texture[];
    speed: number;
    loop: boolean;
}

class CharacterAnimator {
    private sprite: AnimatedSprite;
    private states: Map<string, AnimationState> = new Map();
    private currentState: string = 'idle';
    
    constructor(spriteSheet: Spritesheet) {
        this.sprite = new AnimatedSprite(spriteSheet.animations.idle);
        this.sprite.anchor.set(0.5, 0.5);
    }
    
    addState(name: string, frames: Texture[], speed: number, loop: boolean = true): void {
        this.states.set(name, { name, frames, speed, loop });
    }
    
    play(name: string): void {
        if (this.currentState === name) return;
        const state = this.states.get(name);
        if (!state) return;
        
        this.currentState = name;
        this.sprite.textures = state.frames;
        this.sprite.animationSpeed = state.speed;
        this.sprite.loop = state.loop;
        this.sprite.gotoAndPlay(0);
    }
    
    update(delta: number): void {
        // 可在此添加状态转换逻辑
        this.sprite.update(delta);
    }
}
```

#### Sprite Sheet 制作工具

| 工具 | 链接 | 价格 | 说明 |
|------|------|:----:|------|
| **TexturePacker** | [codeandweb.com](https://www.codeandweb.com/texturepacker) | 免费/付费 | 最流行，直接导出 PixiJS 格式 |
| **Aseprite** | [aseprite.org](https://www.aseprite.org/) | $20 | 像素画编辑器，内置动画功能 |
| **ShoeBox** | [renderhjs.net](http://renderhjs.net/shoebox/) | 免费 | 瓦片提取/精灵打包 |
| **FreeTexPacker** | [freetexpacker.com](http://free-tex-packer.com/) | 免费 | 开源在线打包工具 |
| **spritesheet.js** | [github.com](https://github.com/krzysztof-o/spritesheet.js) | 免费 | 命令行工具 |

### 2.2 免费角色素材

#### 中国风/三国角色素材

| 资源名 | 链接 | 类型 | 价格 | 说明 |
|--------|------|------|:----:|------|
| **仙侠/武侠角色立绘** | [itch.io/chinese](https://itch.io/game-assets/tag-chinese) | 半身立绘 PNG | 免费起 | 古风仙侠角色，含男性/女性/老人 |
| **XXWX Mob Village Children** | [itch.io](https://itch.io/game-assets/free/tag-2d/tag-chinese) | 角色 Sprite | 免费 | 古风儿童角色 |
| **Warrior Free Animation Set V1.3** | [itch.io](https://itch.io/game-assets/tag-warrior) | 角色 Sprite Sheet | 免费 | 战士角色，含多方向行走/攻击动画 |
| **Swordswoman** | [itch.io](https://itch.io/game-assets/tag-warrior) | 角色 Sprite | 免费 | 女剑客，含动画帧 |
| **NightBorne Warrior** | [itch.io](https://itch.io/game-assets/tag-warrior) | 角色 Sprite | 免费 | 暗黑风战士，高质量像素动画 |

#### 通用角色素材（可改色为三国风）

| 资源名 | 链接 | 说明 |
|--------|------|------|
| **Tiny Swords** | [itch.io](https://pixel-poison.itch.io/tiny-swords) | 完整像素风素材包，含多种角色/建筑/地形 |
| **Sprout Lands** | [itch.io](https://cupnooble.itch.io/sprout-lands-asset-pack) | 田园风角色+建筑，适合农民/商贩 NPC |
| **CraftPix Freebies** | [craftpix.net](https://craftpix.net/freebies/) | 大量免费 2D 角色/建筑/瓦片素材 |
| **OpenGameArt Characters** | [opengameart.org](https://opengameart.org/art-search-advanced?keys=character&field_art_type_tid%5B%5D=9) | 开源角色素材，CC 协议 |

#### AI 精灵生成工具

| 工具 | 链接 | 说明 |
|------|------|------|
| **SpriteGenerator.online** | [spritegenerator.online](https://www.spritegenerator.online/) | AI 生成角色精灵表，支持 idle/walk/run/attack |
| **SpriteFlow** | [spriteflow.io](https://spriteflow.io/) | AI 精灵动画生成，10x 速度提升 |
| **AutoSprite** | [autosprite.io](https://www.autosprite.io/ai-sprite-sheet-generator) | 单张图片生成精灵表，支持多引擎导出 |
| **SpriteSheets.ai** | [spritesheets.ai](https://www.spritesheets.ai/) | AI 精灵表生成，支持 Unity/Godot/PixiJS |

### 2.3 武将立绘方案

#### 方案对比

| 方案 | 效果 | 成本 | 灵活性 | 推荐指数 |
|------|:----:|:----:|:------:|:--------:|
| **AI 生成 + 后期处理** | ★★★★☆ | 低 | ★★★★★ | ★★★★★ |
| **免费素材改色** | ★★★☆☆ | 低 | ★★☆☆☆ | ★★★☆☆ |
| **委托美术绘制** | ★★★★★ | 高 | ★★★★★ | ★★☆☆☆ |
| **像素风头像** | ★★★☆☆ | 中 | ★★★★☆ | ★★★★☆ |
| **照片转绘** | ★★★☆☆ | 中 | ★★★☆☆ | ★★☆☆☆ |

#### 🏆 推荐：AI 生成 + 统一后期处理

**工作流**：
```
1. 编写武将描述词（外貌/服饰/武器/气质）
   → "三国武将关羽，红脸长须，青龙偃月刀，绿色战袍，威武霸气，中国古风立绘"

2. 使用 AI 工具批量生成
   → Perchance AI（免费无限）或 Stable Diffusion（本地部署）

3. 统一后期处理
   → 背景去除（rembg 工具）
   → 尺寸统一（256×512 对话立绘 / 96×96 头像）
   → 风格统一滤镜（水墨风/铜版画风）

4. 品质边框叠加
   → 根据武将品质（白/绿/蓝/紫/橙）叠加不同边框
   → 高品质武将添加光效粒子
```

**头像裁切方案**：
```typescript
// 从立绘自动裁切圆形头像
function cropAvatar(portraitTexture: Texture, quality: 'normal' | 'rare' | 'epic' | 'legendary'): Container {
    const container = new Container();
    
    // 创建圆形遮罩
    const mask = new Graphics();
    mask.circle(48, 48, 44);  // 96x96 头像
    mask.fill(0xFFFFFF);
    
    // 裁切立绘上半部分
    const avatarSprite = new Sprite(portraitTexture);
    avatarSprite.anchor.set(0.5, 0.3);  // 偏上裁切（取脸部）
    avatarSprite.width = 96;
    avatarSprite.height = 96;
    avatarSprite.mask = mask;
    
    container.addChild(avatarSprite);
    
    // 添加品质边框
    const borderColors = {
        normal: 0xCCCCCC,
        rare: 0x4CAF50,
        epic: 0x9C27B0,
        legendary: 0xFF9800,
    };
    const border = new Graphics();
    border.circle(48, 48, 46);
    border.stroke({ width: 2, color: borderColors[quality] });
    container.addChild(border);
    
    return container;
}
```

### 2.4 建筑动画

#### 实现方案

**方案：Sprite Sheet 帧动画 + 状态机**

```typescript
// 建筑动画配置
interface BuildingAnimConfig {
    idle: { frames: number; interval: number };      // 空闲动画
    produce: { frames: number; interval: number };    // 产出动画
    upgrading: { frames: number; interval: number };  // 升级中动画
    done: { frames: number; interval: number };       // 升级完成动画
}

const BUILDING_ANIMS: Record<string, BuildingAnimConfig> = {
    farm: {
        idle: { frames: 8, interval: 100 },    // 稻穗摇曳
        produce: { frames: 16, interval: 80 },  // 收获动画
        upgrading: { frames: 8, interval: 120 },// 建造中
        done: { frames: 24, interval: 60 },     // 建造完成
    },
    barracks: {
        idle: { frames: 8, interval: 100 },    // 旗帜飘扬
        produce: { frames: 16, interval: 80 },  // 训练动画
        upgrading: { frames: 8, interval: 120 },
        done: { frames: 24, interval: 60 },
    },
    // ... 其他建筑
};

// 建筑动画控制器
class BuildingAnimator {
    private sprite: AnimatedSprite;
    private config: BuildingAnimConfig;
    private currentAnim: string = 'idle';
    
    constructor(buildingType: string, spriteSheet: Spritesheet) {
        this.config = BUILDING_ANIMS[buildingType];
        this.sprite = new AnimatedSprite(spriteSheet.animations[`${buildingType}_idle`]);
        this.sprite.anchor.set(0.5, 0.5);
        this.play('idle');
    }
    
    play(animName: string): void {
        if (this.currentAnim === animName) return;
        this.currentAnim = animName;
        
        const animKey = `${this.sprite.name}_${animName}`;
        this.sprite.textures = this.sprite.textures; // 切换纹理
        this.sprite.animationSpeed = this.config[animName].interval / 1000 * 60;
        this.sprite.loop = animName !== 'done' && animName !== 'produce';
        this.sprite.gotoAndPlay(0);
        
        if (!this.sprite.loop) {
            this.sprite.onComplete = () => this.play('idle');
        }
    }
    
    // 建筑等级视觉变化
    setLevel(level: number): void {
        const scales = [1.0, 1.125, 1.25, 1.375, 1.5]; // Lv1-5
        this.sprite.scale.set(scales[Math.min(level - 1, 4)]);
        
        // Lv5 添加金色光效
        if (level >= 5) {
            this.addGoldenGlow();
        }
    }
    
    private addGoldenGlow(): void {
        // 使用 PixiJS Filter 添加金色光晕
        // this.sprite.filters = [new GlowFilter({ color: 0xC9A84C, distance: 5 })];
    }
}
```

**资源产出飞行动画**：
```typescript
class ResourceFlyAnimation {
    // 资源图标从建筑飞向资源栏
    play(from: Point, to: Point, resourceType: 'food' | 'gold' | 'wood' | 'iron'): void {
        const sprite = Sprite.from(`icon_${resourceType}.png`);
        sprite.position.copyFrom(from);
        
        // 贝塞尔曲线路径
        const controlPoint = new Point(
            (from.x + to.x) / 2,
            Math.min(from.y, to.y) - 50  // 上抛弧线
        );
        
        let t = 0;
        const animate = () => {
            t += 0.02;
            if (t >= 1) {
                sprite.destroy();
                return;
            }
            
            // 二次贝塞尔曲线
            sprite.x = (1-t)**2 * from.x + 2*(1-t)*t * controlPoint.x + t**2 * to.x;
            sprite.y = (1-t)**2 * from.y + 2*(1-t)*t * controlPoint.y + t**2 * to.y;
            sprite.alpha = t > 0.8 ? (1 - t) * 5 : 1;
            sprite.scale.set(1 - t * 0.3);
            
            requestAnimationFrame(animate);
        };
        animate();
    }
}
```

### 2.5 NPC 动画

#### NPC 巡逻系统

```typescript
interface PatrolPoint {
    x: number;
    y: number;
    waitTime: number;  // 到达后等待时间（ms）
}

class NPCController {
    private animator: CharacterAnimator;
    private patrolPoints: PatrolPoint[];
    private currentTarget: number = 0;
    private speed: number = 1;  // 像素/帧
    private state: 'idle' | 'walking' | 'working' | 'talking' = 'idle';
    private waitTimer: number = 0;
    
    constructor(spriteSheet: Spritesheet, patrolPoints: PatrolPoint[]) {
        this.animator = new CharacterAnimator(spriteSheet);
        this.patrolPoints = patrolPoints;
        
        // 注册动画状态
        this.animator.addState('idle', spriteSheet.animations.idle, 0.05);
        this.animator.addState('walk_down', spriteSheet.animations.walk_down, 0.15);
        this.animator.addState('walk_up', spriteSheet.animations.walk_up, 0.15);
        this.animator.addState('walk_left', spriteSheet.animations.walk_left, 0.15);
        this.animator.addState('walk_right', spriteSheet.animations.walk_right, 0.15);
        this.animator.addState('work', spriteSheet.animations.work, 0.1);
        this.animator.addState('talk', spriteSheet.animations.talk, 0.08);
        
        this.animator.play('idle');
    }
    
    update(delta: number): void {
        switch (this.state) {
            case 'idle':
                this.waitTimer += delta;
                if (this.waitTimer >= this.patrolPoints[this.currentTarget].waitTime) {
                    this.state = 'walking';
                    this.waitTimer = 0;
                }
                break;
                
            case 'walking':
                this.moveToTarget(delta);
                break;
                
            case 'working':
                // 劳作一段时间后返回 idle
                this.waitTimer += delta;
                if (this.waitTimer > 120) { // ~2秒
                    this.state = 'idle';
                    this.waitTimer = 0;
                    this.animator.play('idle');
                }
                break;
        }
    }
    
    private moveToTarget(delta: number): void {
        const target = this.patrolPoints[this.currentTarget];
        const sprite = this.animator.sprite;
        
        const dx = target.x - sprite.x;
        const dy = target.y - sprite.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 2) {
            // 到达目标点
            sprite.position.set(target.x, target.y);
            this.currentTarget = (this.currentTarget + 1) % this.patrolPoints.length;
            this.state = 'working';
            this.animator.play('work');
            this.waitTimer = 0;
            return;
        }
        
        // 计算移动方向
        const moveX = (dx / distance) * this.speed * delta;
        const moveY = (dy / distance) * this.speed * delta;
        sprite.x += moveX;
        sprite.y += moveY;
        
        // 根据移动方向切换动画
        if (Math.abs(dx) > Math.abs(dy)) {
            this.animator.play(dx > 0 ? 'walk_right' : 'walk_left');
        } else {
            this.animator.play(dy > 0 ? 'walk_down' : 'walk_up');
        }
        
        // 翻转精灵（如果只有左右一个方向的动画）
        // sprite.scale.x = dx < 0 ? -1 : 1;
    }
    
    // 玩家点击 NPC 触发对话
    interact(): void {
        if (this.state === 'talking') return;
        this.state = 'talking';
        this.animator.play('talk');
        
        // 3秒后结束对话
        setTimeout(() => {
            this.state = 'idle';
            this.animator.play('idle');
        }, 3000);
    }
    
    get container(): Container {
        return this.animator.sprite;
    }
}
```

#### NPC 碰撞与避障

```typescript
// 简单的 NPC 之间碰撞避让
class NPCManager {
    private npcs: NPCController[] = [];
    
    update(delta: number): void {
        for (const npc of this.npcs) {
            npc.update(delta);
        }
        
        // 简单碰撞检测：NPC 之间保持距离
        for (let i = 0; i < this.npcs.length; i++) {
            for (let j = i + 1; j < this.npcs.length; j++) {
                const a = this.npcs[i].container;
                const b = this.npcs[j].container;
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = 40; // 最小间距
                
                if (dist < minDist && dist > 0) {
                    const pushX = (dx / dist) * (minDist - dist) * 0.5;
                    const pushY = (dy / dist) * (minDist - dist) * 0.5;
                    a.x += pushX;
                    a.y += pushY;
                    b.x -= pushX;
                    b.y -= pushY;
                }
            }
        }
    }
}
```

---

## 3. 实施优先级建议

### Phase 1：地图基础重构（优先级：🔴 最高）

**目标**：修复地图拼接错乱，建立可扩展的地图渲染管线

| 步骤 | 任务 | 预计工时 | 依赖 |
|:----:|------|:-------:|------|
| 1.1 | 集成 `pixi-viewport`，实现拖拽/缩放/边界限制 | 2h | 无 |
| 1.2 | 使用 `@pixi/tilemap` 重构地形渲染层 | 4h | 1.1 |
| 1.3 | 实现瓦片边缘扩展（tile-extruder）修复拼接问题 | 2h | 1.2 |
| 1.4 | 实现六边形领土网格渲染（honeycomb-grid） | 4h | 1.1 |
| 1.5 | 添加 6 种地形底纹素材（平原/山地/水域/城池/森林/关隘） | 3h | 1.2 |
| 1.6 | 实现视口裁剪优化 | 2h | 1.2 |
| **合计** | | **17h** | |

### Phase 2：建筑精灵动画（优先级：🟡 高）

**目标**：替换当前静态建筑图标为动画精灵

| 步骤 | 任务 | 预计工时 | 依赖 |
|:----:|------|:-------:|------|
| 2.1 | 制作/获取 8 种建筑的 Sprite Sheet（idle + produce） | 6h | 无 |
| 2.2 | 实现 BuildingAnimator 状态机 | 3h | 2.1 |
| 2.3 | 实现建筑等级视觉变化（Lv1-5） | 2h | 2.2 |
| 2.4 | 实现资源产出飞行动画 | 3h | 2.2 |
| 2.5 | 实现升级中/升级完成动画 | 2h | 2.2 |
| **合计** | | **16h** | |

### Phase 3：NPC 精灵系统（优先级：🟢 中）

**目标**：为地图添加有生命力的 NPC

| 步骤 | 任务 | 预计工时 | 依赖 |
|:----:|------|:-------:|------|
| 3.1 | 制作/获取 4-6 种 NPC Sprite Sheet（idle/walk/work） | 6h | 无 |
| 3.2 | 实现 CharacterAnimator 状态机 | 3h | 3.1 |
| 3.3 | 实现 NPCController 巡逻系统 | 4h | 3.2 |
| 3.4 | 实现 NPC 碰撞避让 | 2h | 3.3 |
| 3.5 | 实现 NPC 点击交互（对话触发） | 2h | 3.3 |
| **合计** | | **17h** | |

### Phase 4：武将立绘系统（优先级：🔵 中低）

**目标**：为武将对话/详情页添加人物形象

| 步骤 | 任务 | 预计工时 | 依赖 |
|:----:|------|:-------:|------|
| 4.1 | AI 生成 10+ 武将立绘（核心武将） | 4h | 无 |
| 4.2 | 统一后期处理（去背景/裁切/风格统一） | 3h | 4.1 |
| 4.3 | 实现头像裁切系统（圆形/品质边框） | 2h | 4.2 |
| 4.4 | 实现对话立绘显示（淡入/淡出动画） | 2h | 4.2 |
| 4.5 | 实现品质光效（紫/橙品质武将） | 2h | 4.3 |
| **合计** | | **13h** | |

### Phase 5：高级特效（优先级：⚪ 低）

**目标**：提升视觉品质

| 步骤 | 任务 | 预计工时 |
|:----:|------|:-------:|
| 5.1 | 水域波纹动画 | 3h |
| 5.2 | 粒子系统（烟雾/火花/落叶） | 4h |
| 5.3 | 天气系统（雨/雪/雾） | 4h |
| 5.4 | 昼夜光照变化 | 3h |
| **合计** | | **14h** |

---

## 4. 技术依赖清单

### npm 包

| 包名 | 版本 | 用途 |
|------|------|------|
| `pixi.js` | ^8.x | 核心渲染引擎 |
| `@pixi/tilemap` | latest | 瓦片地图渲染 |
| `pixi-viewport` | ^6.0.3 | 视口控制（拖拽/缩放/边界） |
| `pixi-tiledmap` | ^2.0.0 | Tiled 地图加载渲染 |
| `honeycomb-grid` | ^4.x | 六边形网格数据结构 |
| `simplex-noise` | ^4.x | 程序化地形生成（可选） |

### 开发工具

| 工具 | 用途 |
|------|------|
| Tiled Map Editor | 地图可视化编辑 |
| TexturePacker | Sprite Sheet 打包 |
| Aseprite | 像素画/动画编辑 |
| tile-extruder | 瓦片边缘扩展（修复拼接） |

---

## 5. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| pixi-viewport 与 PixiJS v8 兼容性 | 中 | v6.0.3 已更新类型支持 v8，需测试 |
| pixi-tiledmap v2 稳定性 | 中 | v2 是完全重写，需充分测试 |
| 三国风格素材不足 | 高 | AI 生成 + 免费素材改色组合方案 |
| 移动端性能 | 中 | 严格控制粒子数、视口裁剪、降帧策略 |
| Sprite Sheet 内存占用 | 低 | 按需加载、离屏释放、纹理压缩 |

---

> **下一步行动**：按 Phase 1 开始实施，优先解决地图拼接错乱问题，集成 pixi-viewport 实现边缘滚动。
