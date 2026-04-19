/**
 * Penguin Empire（企鹅帝国）放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/空格键产生冰块
 * - 建筑系统（冰屋、鱼塘、冰晶矿场、企鹅学校、冰雕工坊、企鹅皇宫）
 * - 声望系统（重置获得极光之力，永久加成）
 * - 离线收益
 * - 自动存档/读档
 * - 场景动画：企鹅在冰面上行走
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData, OfflineReport } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ICE_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_ICE,
  NUMBER_SUFFIXES,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  MAX_VISIBLE_PENGUINS,
  PENGUIN_WALK_SPEED,
  FLOATING_TEXT_DURATION,
  type BuildingDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 场景中的企鹅（动画用） */
interface ScenePenguin {
  x: number;
  y: number;
  targetX: number;
  direction: number; // 1=右, -1=左
  walkTimer: number;
  idle: boolean;
  scale: number; // 0.8~1.2 随机大小
}

/** 飘字效果 */
interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

/** 雪花粒子 */
interface Snowflake {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
}

/** 游戏完整状态 */
export interface PenguinEmpireState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  totalIceEarned: number;
  totalClicks: number;
  selectedBuildingIndex: number;
}

export class PenguinEmpireEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'penguin-empire';

  /** 累计冰块获得 */
  private _totalIceEarned: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 当前选中建筑索引 */
  private _selectedBuildingIndex: number = 0;

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 场景企鹅列表 */
  private _scenePenguins: ScenePenguin[] = [];
  /** 雪花粒子 */
  private _snowflakes: Snowflake[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 极光动画计时 */
  private _auroraTimer: number = 0;

  // ========== 公开属性 ==========

  get totalIceEarned(): number {
    return this._totalIceEarned;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get selectedBuildingIndex(): number {
    return this._selectedBuildingIndex;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.ICE,
        name: '冰块',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.FISH,
        name: '鱼',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.COINS,
        name: '企鹅币',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.CRYSTAL,
        name: '冰晶石',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
    ]);

    // 初始化建筑（升级）
    this.initializeUpgrades(
      BUILDINGS.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        baseCost: b.baseCost,
        costMultiplier: b.costMultiplier,
        level: 0,
        maxLevel: b.maxLevel,
        effect: {
          type: 'add_production',
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: !b.unlockCondition,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._totalIceEarned = 0;
    this._totalClicks = 0;
    this._selectedBuildingIndex = 0;
    this._floatingTexts = [];
    this._scenePenguins = [];
    this._snowflakes = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._auroraTimer = 0;

    // 初始化场景企鹅
    this.initScenePenguins();

    // 初始化雪花
    this.initSnowflakes();
  }

  protected onStart(): void {
    // 尝试加载存档
    this.loadFromStorage();
  }

  protected onUpdate(deltaTime: number): void {
    // 更新动画
    this.updateAnimations(deltaTime);

    // 检查建筑解锁
    this.checkBuildingUnlocks();

    // 检查资源解锁
    this.checkResourceUnlocks();
  }

  // ========== 核心逻辑 ==========

  /**
   * 点击产生冰块
   * @returns 本次获得的冰块数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.ICE, clickPower);
    this._totalIceEarned += clickPower;
    this._totalClicks++;
    this.addScore(clickPower);

    // 触发点击动画
    this._clickScale = 1.2;
    this._clickAnimTimer = 200;

    // 飘字效果
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 30;
    this._floatingTexts.push({
      text: `+${this.formatNumber(clickPower)}`,
      x: 240 + Math.cos(angle) * dist,
      y: 180 + Math.sin(angle) * dist,
      life: FLOATING_TEXT_DURATION,
      maxLife: FLOATING_TEXT_DURATION,
      color: COLORS.iceColor,
    });

    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = ICE_PER_CLICK;

    // 企鹅学校加成点击
    const schoolLevel = this.getBuildingLevel(BUILDING_IDS.PENGUIN_SCHOOL);
    power += schoolLevel * 0.5;

    // 声望加成
    power *= 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;

    return power;
  }

  /**
   * 获取建筑当前费用
   */
  getBuildingCost(buildingId: string): Record<string, number> {
    return this.getUpgradeCost(buildingId);
  }

  /**
   * 购买建筑
   */
  purchaseBuilding(buildingId: string): boolean {
    return this.purchaseUpgrade(buildingId);
  }

  /**
   * 通过索引购买建筑
   */
  buyBuildingByIndex(index: number): boolean {
    if (index < 0 || index >= BUILDINGS.length) return false;
    return this.purchaseBuilding(BUILDINGS[index].id);
  }

  /**
   * 获取建筑等级
   */
  getBuildingLevel(buildingId: string): number {
    const upgrade = this.upgrades.get(buildingId);
    return upgrade ? upgrade.level : 0;
  }

  /**
   * 计算总产出倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 企鹅学校加成
    const schoolLevel = this.getBuildingLevel(BUILDING_IDS.PENGUIN_SCHOOL);
    multiplier += schoolLevel * 0.05;

    // 声望加成
    multiplier += this.prestige.currency * PRESTIGE_MULTIPLIER;

    return multiplier;
  }

  /**
   * 获取指定资源的产出倍率
   */
  getResourceMultiplier(resourceId: string): number {
    return this.getProductionMultiplier();
  }

  /**
   * 获取实际每秒产出（含加成）
   */
  getEffectiveProduction(resourceId: string): number {
    const resource = this.getResource(resourceId);
    if (!resource) return 0;
    const baseProd = resource.perSecond;
    const multiplier = this.getResourceMultiplier(resourceId);
    return baseProd * multiplier;
  }

  // ========== 声望系统 ==========

  /**
   * 计算声望重置可获得的极光之力数
   */
  calculatePrestigeAurora(): number {
    const ice = this.getResource(RESOURCE_IDS.ICE);
    if (!ice || ice.amount < MIN_PRESTIGE_ICE) return 0;
    return Math.floor(Math.sqrt(ice.amount / MIN_PRESTIGE_ICE));
  }

  /**
   * 执行声望重置
   */
  prestigeReset(): boolean {
    const aurora = this.calculatePrestigeAurora();
    if (aurora <= 0) return false;

    // 保存声望数据
    this.prestige.currency += aurora;
    this.prestige.count++;

    // 保留统计信息
    const stats = { ...this.statistics };
    const prestigeData = { ...this.prestige };

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;
    this.statistics = stats;

    // 重新计算产出
    this.recalculateProduction();

    // 给予极光之力（以冰晶石体现）
    this.addResource(RESOURCE_IDS.CRYSTAL, aurora);

    this.emit('prestigeReset', aurora);
    this.emit('stateChange');
    return true;
  }

  // ========== 重新计算产出 ==========

  protected recalculateProduction(): void {
    // 先重置所有 perSecond 为 0
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 根据建筑等级重新计算基础产出
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (upgrade && upgrade.level > 0) {
        const resource = this.resources.get(building.productionResource);
        if (resource) {
          resource.perSecond += building.baseProduction * upgrade.level;
        }
      }
    }
  }

  // ========== 存档系统 ==========

  save(): SaveData {
    const data = super.save();

    // 附加统计数据
    data.statistics = {
      ...this.statistics,
      totalIceEarned: this._totalIceEarned,
      totalClicks: this._totalClicks,
    };

    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复统计
    this._totalIceEarned = (data.statistics?.totalIceEarned as number) || 0;
    this._totalClicks = (data.statistics?.totalClicks as number) || 0;

    // 重新计算产出
    this.recalculateProduction();
  }

  getState(): PenguinEmpireState {
    const baseState = super.getState();

    return {
      resources: baseState.resources as Record<string, { amount: number; unlocked: boolean }>,
      upgrades: baseState.upgrades as Record<string, number>,
      statistics: baseState.statistics as Record<string, number>,
      totalIceEarned: this._totalIceEarned,
      totalClicks: this._totalClicks,
      selectedBuildingIndex: this._selectedBuildingIndex,
      prestige: { ...this.prestige },
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: PenguinEmpireState): void {
    // 恢复资源
    if (state.resources) {
      for (const [id, data] of Object.entries(state.resources)) {
        const resource = this.resources.get(id);
        if (resource) {
          resource.amount = data.amount;
          resource.unlocked = data.unlocked;
        }
      }
    }

    // 恢复建筑等级
    if (state.upgrades) {
      for (const [id, level] of Object.entries(state.upgrades)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) {
          upgrade.level = level;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    this._totalIceEarned = state.totalIceEarned || 0;
    this._totalClicks = state.totalClicks || 0;
    this._selectedBuildingIndex = state.selectedBuildingIndex || 0;

    this.recalculateProduction();
    this.emit('stateChange');
  }

  // ========== 自动检查 ==========

  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      if (building.unlockCondition) {
        const upgrade = this.upgrades.get(building.id);
        if (upgrade && !upgrade.unlocked) {
          let met = true;
          for (const [resId, amount] of Object.entries(building.unlockCondition)) {
            const resource = this.resources.get(resId);
            if (!resource || resource.amount < amount) {
              met = false;
              break;
            }
          }
          if (met) {
            upgrade.unlocked = true;
            this.emit('buildingUnlocked', building.id);
          }
        }
      }
    }
  }

  private checkResourceUnlocks(): void {
    // 鱼：有冰块超过 50 时解锁
    const ice = this.getResource(RESOURCE_IDS.ICE);
    if (ice && ice.amount >= 50) {
      const fish = this.getResource(RESOURCE_IDS.FISH);
      if (fish && !fish.unlocked) {
        fish.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.FISH);
      }
    }

    // 企鹅币：有鱼超过 100 时解锁
    const fish = this.getResource(RESOURCE_IDS.FISH);
    if (fish && fish.amount >= 100) {
      const coins = this.getResource(RESOURCE_IDS.COINS);
      if (coins && !coins.unlocked) {
        coins.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.COINS);
      }
    }

    // 冰晶石：声望重置后或冰晶矿场解锁后
    if (this.prestige.count > 0) {
      const crystal = this.getResource(RESOURCE_IDS.CRYSTAL);
      if (crystal && !crystal.unlocked) {
        crystal.unlocked = true;
      }
    }

    // 冰晶石也可以通过拥有冰晶矿场建筑解锁
    const crystalMine = this.upgrades.get(BUILDING_IDS.CRYSTAL_MINE);
    if (crystalMine && crystalMine.unlocked) {
      const crystal = this.getResource(RESOURCE_IDS.CRYSTAL);
      if (crystal && !crystal.unlocked) {
        crystal.unlocked = true;
      }
    }
  }

  // ========== 动画系统 ==========

  private initScenePenguins(): void {
    // 初始2只企鹅
    for (let i = 0; i < 2; i++) {
      this.addScenePenguin();
    }
  }

  private addScenePenguin(): void {
    if (this._scenePenguins.length >= MAX_VISIBLE_PENGUINS) return;

    this._scenePenguins.push({
      x: 80 + Math.random() * 320,
      y: 200 + Math.random() * 60,
      targetX: 80 + Math.random() * 320,
      direction: Math.random() > 0.5 ? 1 : -1,
      walkTimer: 0,
      idle: Math.random() > 0.5,
      scale: 0.8 + Math.random() * 0.4,
    });
  }

  private initSnowflakes(): void {
    this._snowflakes = [];
    for (let i = 0; i < 30; i++) {
      this._snowflakes.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 15 + Math.random() * 25,
        size: 1 + Math.random() * 3,
        opacity: 0.3 + Math.random() * 0.5,
      });
    }
  }

  private updateAnimations(deltaTime: number): void {
    // 点击动画
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        this._clickScale = 1 + 0.2 * (this._clickAnimTimer / 200);
      }
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.03;
      return ft.life > 0;
    });

    // 企鹅行走
    for (const penguin of this._scenePenguins) {
      penguin.walkTimer += deltaTime;

      if (penguin.idle) {
        // 空闲一段时间后开始走
        if (penguin.walkTimer > 2000 + Math.random() * 3000) {
          penguin.idle = false;
          penguin.walkTimer = 0;
          penguin.targetX = 60 + Math.random() * 360;
          penguin.direction = penguin.targetX > penguin.x ? 1 : -1;
        }
      } else {
        // 走向目标
        const dx = penguin.targetX - penguin.x;
        const step = (PENGUIN_WALK_SPEED * deltaTime) / 1000;
        if (Math.abs(dx) < step) {
          penguin.x = penguin.targetX;
          penguin.idle = true;
          penguin.walkTimer = 0;
        } else {
          penguin.x += Math.sign(dx) * step;
        }
      }
    }

    // 雪花飘落
    for (const snow of this._snowflakes) {
      snow.y += (snow.speed * deltaTime) / 1000;
      snow.x += Math.sin(snow.y * 0.01) * 0.3;
      if (snow.y > CANVAS_HEIGHT) {
        snow.y = -5;
        snow.x = Math.random() * CANVAS_WIDTH;
      }
    }

    // 极光动画
    this._auroraTimer += deltaTime;
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawAurora(ctx, w);
    this.drawSnowflakes(ctx);
    this.drawIceSurface(ctx, w, h);
    this.drawScenePenguins(ctx);
    this.drawFloatingTexts(ctx);
    this.drawInfoPanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawBottomHint(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.bgGradient1);
    gradient.addColorStop(1, COLORS.bgGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 星星装饰
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 25; i++) {
      const x = ((i * 73 + 17) % w);
      const y = ((i * 47 + 13) % 180);
      const r = 1 + (i % 3);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawAurora(ctx: CanvasRenderingContext2D, w: number): void {
    if (this.prestige.count <= 0) return;

    // 极光效果（声望后出现）
    const t = this._auroraTimer / 1000;
    ctx.globalAlpha = 0.15;

    for (let i = 0; i < 3; i++) {
      const y = 30 + i * 20 + Math.sin(t + i) * 10;
      const gradient = ctx.createLinearGradient(0, y, w, y);
      gradient.addColorStop(0, 'rgba(0, 230, 118, 0)');
      gradient.addColorStop(0.3, COLORS.auroraGreen);
      gradient.addColorStop(0.5, COLORS.auroraBlue);
      gradient.addColorStop(0.7, COLORS.auroraPurple);
      gradient.addColorStop(1, 'rgba(179, 136, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, w, 12);
    }
    ctx.globalAlpha = 1;
  }

  private drawSnowflakes(ctx: CanvasRenderingContext2D): void {
    for (const snow of this._snowflakes) {
      ctx.globalAlpha = snow.opacity;
      ctx.fillStyle = COLORS.snowColor;
      ctx.beginPath();
      ctx.arc(snow.x, snow.y, snow.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawIceSurface(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 冰面
    ctx.fillStyle = COLORS.iceSurface;
    ctx.fillRect(0, 250, w, h - 250);

    // 冰面高光
    ctx.fillStyle = COLORS.iceHighlight;
    ctx.fillRect(0, 248, w, 6);

    // 冰面裂纹装饰
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x1 = 50 + i * 90;
      const y1 = 270 + (i % 3) * 30;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + 30, y1 + 15);
      ctx.lineTo(x1 + 50, y1 + 5);
      ctx.stroke();
    }
  }

  private drawScenePenguins(ctx: CanvasRenderingContext2D): void {
    for (const penguin of this._scenePenguins) {
      this.drawPixelPenguin(ctx, penguin.x, penguin.y, penguin.direction, penguin.idle, penguin.scale);
    }
  }

  private drawPixelPenguin(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: number,
    idle: boolean,
    scale: number = 1
  ): void {
    const size = 20 * scale;
    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) {
      ctx.scale(-1, 1);
    }

    // 身体（黑色）
    ctx.fillStyle = COLORS.penguinBody;
    ctx.fillRect(-size / 2, -size, size, size);

    // 肚子（白色）
    ctx.fillStyle = COLORS.penguinBelly;
    ctx.fillRect(-size / 2 + 3, -size + 4, size - 6, size - 6);

    // 头（黑色）
    ctx.fillStyle = COLORS.penguinBody;
    ctx.fillRect(-size / 2 - 2, -size - 8, size + 4, 10);

    // 眼睛
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, -size - 6, 4, 4);
    ctx.fillRect(2, -size - 6, 4, 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(-4, -size - 5, 2, 2);
    ctx.fillRect(3, -size - 5, 2, 2);

    // 嘴巴
    ctx.fillStyle = COLORS.penguinBeak;
    ctx.fillRect(-2, -size - 2, 5, 3);

    // 脚
    ctx.fillStyle = COLORS.penguinFeet;
    ctx.fillRect(-size / 2 + 1, 0, 5, 3);
    ctx.fillRect(size / 2 - 6, 0, 5, 3);

    // 翅膀（非空闲时摆动）
    ctx.fillStyle = COLORS.penguinBody;
    if (!idle) {
      ctx.fillRect(-size / 2 - 4, -size + 3, 4, 10);
      ctx.fillRect(size / 2, -size + 3, 4, 10);
    } else {
      ctx.fillRect(-size / 2 - 3, -size + 5, 3, 8);
      ctx.fillRect(size / 2, -size + 5, 3, 8);
    }

    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this._floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px "Segoe UI", sans-serif';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawInfoPanel(ctx: CanvasRenderingContext2D, w: number): void {
    // 游戏标题
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentCyan;
    ctx.textAlign = 'center';
    ctx.fillText('🐧 企鹅帝国', w / 2, 28);

    // 资源显示
    const resources = this.getUnlockedResources();
    const startX = 20;
    let rx = startX;

    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    for (const resource of resources) {
      const icon = RESOURCE_ICONS[resource.id] || '';
      const amount = this.formatNumber(resource.amount);
      const effectiveProd = this.getEffectiveProduction(resource.id);

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${icon} ${amount}`, rx, 52);

      if (effectiveProd > 0) {
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(effectiveProd)}/s`, rx, 66);
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
      }

      rx += 120;
    }

    // 点击力量
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(`点击力量: ${this.formatNumber(this.getClickPower())} 🧊`, w / 2, 82);

    // 总产出倍率
    ctx.fillText(`产出倍率: x${this.getProductionMultiplier().toFixed(2)}`, w / 2, 96);

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.crystalColor;
      ctx.fillText(`💎 ${this.formatNumber(this.prestige.currency)} 极光之力 x${this.prestige.count}`, w / 2, 110);
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panel = UPGRADE_PANEL;

    // 标题
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 建筑 —', w / 2, panel.startY - 10);

    let visibleIndex = 0;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const building = BUILDINGS[i];
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || !upgrade.unlocked) continue;

      const selected = visibleIndex === this._selectedBuildingIndex;
      const cost = this.getBuildingCost(building.id);
      const affordable = this.canAfford(cost);
      const level = upgrade.level;

      const y = panel.startY + visibleIndex * (panel.itemHeight + panel.itemPadding);
      const x = panel.itemMarginX;

      // 背景
      if (selected) {
        ctx.fillStyle = COLORS.selectedBg;
        ctx.strokeStyle = COLORS.selectedBorder;
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = COLORS.panelBg;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
      }
      this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 8);
      ctx.fill();
      ctx.stroke();

      // 图标
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(building.icon, x + 10, y + 30);

      // 名称 + 等级
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${building.name}`, x + 40, y + 20);

      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textDim;
      const prodText = building.baseProduction > 0
        ? `Lv.${level} (+${this.formatNumber(building.baseProduction * level)}/s)`
        : `Lv.${level} (+${(level * 5)}%效率)`;
      ctx.fillText(prodText, x + 40, y + 36);

      // 费用
      ctx.font = 'bold 12px "Segoe UI", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
      const costText = Object.entries(cost)
        .map(([id, amount]) => `${RESOURCE_ICONS[id] || ''}${this.formatNumber(amount)}`)
        .join(' ');
      ctx.fillText(costText, x + panel.itemWidth - 10, y + 30);

      visibleIndex++;
    }
  }

  private drawBottomHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买', w / 2, h - 8);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case ' ':
        this.click();
        break;
      case 'ArrowUp':
        this._selectedBuildingIndex = Math.max(0, this._selectedBuildingIndex - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown': {
        // 计算可见建筑数量
        const visibleCount = BUILDINGS.filter((b) => {
          const u = this.upgrades.get(b.id);
          return u && u.unlocked;
        }).length;
        this._selectedBuildingIndex = Math.min(visibleCount - 1, this._selectedBuildingIndex + 1);
        this.emit('stateChange');
        break;
      }
      case 'Enter': {
        // 购买选中的可见建筑
        const visibleBuildings = BUILDINGS.filter((b) => {
          const u = this.upgrades.get(b.id);
          return u && u.unlocked;
        });
        if (this._selectedBuildingIndex < visibleBuildings.length) {
          this.buyBuildingByIndex(
            BUILDINGS.indexOf(visibleBuildings[this._selectedBuildingIndex])
          );
        }
        break;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }
}
