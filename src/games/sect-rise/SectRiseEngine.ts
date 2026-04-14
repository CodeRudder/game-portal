/**
 * 宗门崛起 (Sect Rise) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（灵石/仙草/法器/声望）
 * - 宗门建筑升级系统
 * - 弟子招募与加成系统
 * - 声望重置系统（宗门气运）
 * - Canvas 水墨国风渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_STONE_PER_CLICK,
  PRESTIGE_MULTIPLIER,
  PRESTIGE_BASE_FORTUNE,
  MIN_PRESTIGE_STONES,
  DISCIPLES,
  BUILDINGS,
  COLORS,
  SECT_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type DiscipleDef,
  type BuildingDef,
} from './constants';

/** 弟子状态 */
export interface DiscipleState {
  id: string;
  unlocked: boolean;
}

/** 游戏统计 */
export interface SectRiseStatistics {
  totalSpiritStonesEarned: number;
  totalClicks: number;
  totalHerbsEarned: number;
  totalArtifactsEarned: number;
  totalReputationEarned: number;
  totalPrestigeCount: number;
  totalDisciplesUnlocked: number;
}

/** 宗门崛起游戏状态 */
export interface SectRiseState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  disciples: DiscipleState[];
  prestige: { currency: number; count: number };
  statistics: SectRiseStatistics;
  selectedIndex: number;
}

export class SectRiseEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'sect-rise';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as SectRiseStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 弟子状态 */
  private _disciples: DiscipleState[] = DISCIPLES.map((d) => ({
    id: d.id,
    unlocked: d.id === 'outer-disciple', // 外门弟子初始解锁
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: SectRiseStatistics = {
    totalSpiritStonesEarned: 0,
    totalClicks: 0,
    totalHerbsEarned: 0,
    totalArtifactsEarned: 0,
    totalReputationEarned: 0,
    totalPrestigeCount: 0,
    totalDisciplesUnlocked: 1,
  };

  /** 飘字效果列表 */
  private _floatingTexts: Array<{
    text: string;
    x: number;
    y: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];

  /** 动画计时器 */
  private _animTimer: number = 0;
  /** 云雾飘动偏移 */
  private _cloudOffset: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 灵气粒子 */
  private _spiritParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get disciples(): DiscipleState[] {
    return this._disciples.map((d) => ({ ...d }));
  }

  get totalSpiritStonesEarned(): number {
    return this._stats.totalSpiritStonesEarned;
  }

  get totalClicks(): number {
    return this._stats.totalClicks;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: 'spirit-stone',
        name: '灵石',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'herb',
        name: '仙草',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'artifact',
        name: '法器',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e9,
        unlocked: false,
      },
      {
        id: 'reputation',
        name: '声望',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e6,
        unlocked: false,
      },
    ]);

    // 初始化建筑（作为升级）
    this.initializeUpgrades(
      BUILDINGS.map((b) => ({
        id: b.id,
        name: b.name,
        description: `产出 ${b.productionResource}`,
        baseCost: { ...b.baseCost },
        costMultiplier: b.costMultiplier,
        level: 0,
        maxLevel: b.maxLevel,
        effect: {
          type: 'add_production',
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.id === 'main-hall', // 主殿初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._disciples = DISCIPLES.map((d) => ({
      id: d.id,
      unlocked: d.id === 'outer-disciple',
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalSpiritStonesEarned: 0,
      totalClicks: 0,
      totalHerbsEarned: 0,
      totalArtifactsEarned: 0,
      totalReputationEarned: 0,
      totalPrestigeCount: 0,
      totalDisciplesUnlocked: 1,
    };
    this._floatingTexts = [];
    this._animTimer = 0;
    this._cloudOffset = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._spiritParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 动画更新
    this._animTimer += deltaTime;
    this._cloudOffset = Math.sin(this._animTimer * 0.0003) * 30;

    // 点击动画衰减
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        this._clickScale = 1 + 0.12 * (this._clickAnimTimer / 150);
      }
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.04;
      return ft.life > 0;
    });

    // 灵气粒子更新
    this._spiritParticles = this._spiritParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生灵气粒子
    if (Math.random() < 0.03) {
      this._spiritParticles.push({
        x: SECT_DRAW.centerX + (Math.random() - 0.5) * 200,
        y: 120 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 10,
        vy: -8 - Math.random() * 12,
        life: 2000 + Math.random() * 1500,
        maxLife: 3500,
        size: 1 + Math.random() * 2,
      });
    }

    // 统计资源产出
    const stones = this.getResource('spirit-stone');
    if (stones && stones.perSecond > 0) {
      this._stats.totalSpiritStonesEarned += stones.perSecond * (deltaTime / 1000);
    }
    const herbs = this.getResource('herb');
    if (herbs && herbs.perSecond > 0) {
      this._stats.totalHerbsEarned += herbs.perSecond * (deltaTime / 1000);
    }
    const artifacts = this.getResource('artifact');
    if (artifacts && artifacts.perSecond > 0) {
      this._stats.totalArtifactsEarned += artifacts.perSecond * (deltaTime / 1000);
    }
    const rep = this.getResource('reputation');
    if (rep && rep.perSecond > 0) {
      this._stats.totalReputationEarned += rep.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得灵石
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = SPIRIT_STONE_PER_CLICK;

    // 弟子点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('spirit-stone', gained);
    this._stats.totalSpiritStonesEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.12;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: SECT_DRAW.centerX + Math.cos(angle) * dist,
      y: SECT_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.accentGold,
    });

    this.emit('stateChange');
    return gained;
  }

  /**
   * 购买建筑升级
   */
  purchaseBuilding(index: number): boolean {
    if (index < 0 || index >= BUILDINGS.length) return false;

    const building = BUILDINGS[index];
    const upgradeId = building.id;
    const upgrade = this.upgrades.get(upgradeId);

    if (!upgrade || !upgrade.unlocked) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    // 检查前置
    if (upgrade.requires) {
      for (const reqId of upgrade.requires) {
        const req = this.upgrades.get(reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    const cost = this.getUpgradeCost(upgradeId);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    upgrade.level++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 招募弟子
   */
  recruitDisciple(discipleId: string): boolean {
    const discipleDef = DISCIPLES.find((d) => d.id === discipleId);
    if (!discipleDef) return false;

    const discipleState = this._disciples.find((d) => d.id === discipleId);
    if (!discipleState || discipleState.unlocked) return false;

    if (!this.hasResource('spirit-stone', discipleDef.unlockCost)) return false;

    this.spendResource('spirit-stone', discipleDef.unlockCost);
    discipleState.unlocked = true;
    this._stats.totalDisciplesUnlocked++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('discipleRecruited', discipleId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取弟子是否已解锁
   */
  isDiscipleUnlocked(discipleId: string): boolean {
    const d = this._disciples.find((ds) => ds.id === discipleId);
    return d ? d.unlocked : false;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalSpiritStonesEarned < MIN_PRESTIGE_STONES) return 0;

    // 计算获得的宗门气运
    const fortuneGained = Math.floor(
      PRESTIGE_BASE_FORTUNE * Math.sqrt(this._stats.totalSpiritStonesEarned / MIN_PRESTIGE_STONES)
    );

    if (fortuneGained <= 0) return 0;

    // 保存声望和弟子状态
    const savedPrestige = { ...this.prestige };
    const savedDisciples = this._disciples.map((d) => ({ ...d }));

    // 重置
    this.onInit();

    // 恢复声望
    this.prestige = savedPrestige;
    this.prestige.currency += fortuneGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 恢复弟子解锁状态（声望保留弟子）
    for (const saved of savedDisciples) {
      const disciple = this._disciples.find((d) => d.id === saved.id);
      if (disciple) {
        disciple.unlocked = saved.unlocked;
      }
    }

    this.recalculateProduction();

    this.emit('prestige', fortuneGained);
    this.emit('stateChange');
    return fortuneGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * PRESTIGE_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const disciple of this._disciples) {
      if (!disciple.unlocked) continue;
      const def = DISCIPLES.find((d) => d.id === disciple.id);
      if (!def) continue;
      if (def.bonusType === 'spirit_stone' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取灵石产出加成倍率
   */
  getSpiritStoneMultiplier(): number {
    let multiplier = 1;
    for (const disciple of this._disciples) {
      if (!disciple.unlocked) continue;
      const def = DISCIPLES.find((d) => d.id === disciple.id);
      if (!def) continue;
      if (def.bonusType === 'spirit_stone' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取仙草产出加成倍率
   */
  getHerbMultiplier(): number {
    let multiplier = 1;
    for (const disciple of this._disciples) {
      if (!disciple.unlocked) continue;
      const def = DISCIPLES.find((d) => d.id === disciple.id);
      if (!def) continue;
      if (def.bonusType === 'herb' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取法器产出加成倍率
   */
  getArtifactMultiplier(): number {
    let multiplier = 1;
    for (const disciple of this._disciples) {
      if (!disciple.unlocked) continue;
      const def = DISCIPLES.find((d) => d.id === disciple.id);
      if (!def) continue;
      if (def.bonusType === 'artifact' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取声望产出加成倍率
   */
  getReputationMultiplier(): number {
    let multiplier = 1;
    for (const disciple of this._disciples) {
      if (!disciple.unlocked) continue;
      const def = DISCIPLES.find((d) => d.id === disciple.id);
      if (!def) continue;
      if (def.bonusType === 'reputation' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取建筑当前费用
   */
  getBuildingCost(index: number): Record<string, number> {
    if (index < 0 || index >= BUILDINGS.length) return {};
    return this.getUpgradeCost(BUILDINGS[index].id);
  }

  /**
   * 获取建筑等级
   */
  getBuildingLevel(index: number): number {
    if (index < 0 || index >= BUILDINGS.length) return 0;
    const upgrade = this.upgrades.get(BUILDINGS[index].id);
    return upgrade ? upgrade.level : 0;
  }

  /**
   * 获取预览声望宗门气运数
   */
  getPrestigePreview(): number {
    if (this._stats.totalSpiritStonesEarned < MIN_PRESTIGE_STONES) return 0;
    return Math.floor(
      PRESTIGE_BASE_FORTUNE * Math.sqrt(this._stats.totalSpiritStonesEarned / MIN_PRESTIGE_STONES)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalSpiritStonesEarned >= MIN_PRESTIGE_STONES;
  }

  // ========== 内部方法 ==========

  /**
   * 重写产出计算，加入弟子加成
   */
  protected recalculateProduction(): void {
    // 先重置
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 基础产出 + 弟子加成
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      // 应用对应弟子加成
      if (building.productionResource === 'spirit-stone') {
        production *= this.getSpiritStoneMultiplier();
      } else if (building.productionResource === 'herb') {
        production *= this.getHerbMultiplier();
      } else if (building.productionResource === 'artifact') {
        production *= this.getArtifactMultiplier();
      } else if (building.productionResource === 'reputation') {
        production *= this.getReputationMultiplier();
      }

      const resource = this.resources.get(building.productionResource);
      if (resource) {
        resource.perSecond += production;
      }
    }
  }

  /**
   * 检查建筑解锁条件
   */
  private checkBuildingUnlocks(): void {
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.unlocked) continue;

      if (building.requires) {
        const allReqsMet = building.requires.every((reqId) => {
          const req = this.upgrades.get(reqId);
          return req && req.level > 0;
        });
        if (allReqsMet) {
          upgrade.unlocked = true;
        }
      }
    }
  }

  /**
   * 检查资源解锁条件
   */
  private checkResourceUnlocks(): void {
    // 仙草：主殿等级 >= 5 时解锁
    const mainHall = this.upgrades.get('main-hall');
    if (mainHall && mainHall.level >= 5) {
      const herb = this.resources.get('herb');
      if (herb && !herb.unlocked) {
        herb.unlocked = true;
        this.emit('resourceUnlocked', 'herb');
      }
    }

    // 法器：锻造坊等级 >= 1 时解锁
    const forge = this.upgrades.get('forge');
    if (forge && forge.level >= 1) {
      const artifact = this.resources.get('artifact');
      if (artifact && !artifact.unlocked) {
        artifact.unlocked = true;
        this.emit('resourceUnlocked', 'artifact');
      }
    }

    // 声望：护宗大阵等级 >= 1 时解锁
    const sectArray = this.upgrades.get('sect-array');
    if (sectArray && sectArray.level >= 1) {
      const rep = this.resources.get('reputation');
      if (rep && !rep.unlocked) {
        rep.unlocked = true;
        this.emit('resourceUnlocked', 'reputation');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawSpiritParticles(ctx);
    this.drawPagoda(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（水墨夜色）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.mountainNear);
    groundGradient.addColorStop(1, COLORS.bgGradient2);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 远山（水墨层次）
    this.drawMountainLayer(ctx, w, h, 0.42, COLORS.mountainFar, 0.6);
    this.drawMountainLayer(ctx, w, h, 0.46, COLORS.mountainMid, 0.8);

    // 云雾
    this.drawClouds(ctx, w, h);

    // 月亮
    ctx.beginPath();
    ctx.arc(80, 55, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240, 230, 211, 0.9)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(80, 55, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240, 230, 211, 0.08)';
    ctx.fill();

    // 星星点缀
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 15; i++) {
      const sx = ((i * 97 + 31) % w);
      const sy = ((i * 53 + 17) % (h * 0.35));
      const twinkle = Math.sin(this._animTimer * 0.002 + i) * 0.3 + 0.7;
      ctx.globalAlpha = 0.3 * twinkle;
      ctx.fillStyle = COLORS.textPrimary;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawMountainLayer(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    baseY: number, color: string, opacity: number
  ): void {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h * baseY + 20);
    // 水墨山峰曲线
    const peaks = [
      [0, baseY + 0.05], [0.1, baseY - 0.08], [0.2, baseY - 0.02],
      [0.3, baseY - 0.12], [0.4, baseY - 0.04], [0.5, baseY - 0.1],
      [0.6, baseY - 0.03], [0.7, baseY - 0.09], [0.8, baseY - 0.01],
      [0.9, baseY - 0.07], [1.0, baseY + 0.02],
    ];
    for (let i = 0; i < peaks.length; i++) {
      const px = peaks[i][0] * w;
      const py = peaks[i][1] * h;
      if (i === 0) {
        ctx.lineTo(px, py);
      } else {
        const prevX = peaks[i - 1][0] * w;
        const cpx = (prevX + px) / 2;
        ctx.quadraticCurveTo(cpx, py - 10, px, py);
      }
    }
    ctx.lineTo(w, h * baseY + 20);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawClouds(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const offset = this._cloudOffset;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = COLORS.cloudWhite;

    // 三朵云
    const clouds = [
      { x: 60 + offset, y: h * 0.35, rx: 50, ry: 12 },
      { x: 250 + offset * 0.7, y: h * 0.28, rx: 60, ry: 14 },
      { x: 400 + offset * 0.5, y: h * 0.38, rx: 45, ry: 10 },
    ];
    for (const c of clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + 20, c.y - 5, c.rx * 0.6, c.ry * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSpiritParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._spiritParticles) {
      const alpha = (p.life / p.maxLife) * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.accentGold;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // 灵气光晕
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 160, 23, ${alpha * 0.2})`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPagoda(ctx: CanvasRenderingContext2D): void {
    const cx = SECT_DRAW.centerX;
    const cy = SECT_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 塔影
    ctx.beginPath();
    ctx.ellipse(3, 50, 50, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // 塔身三层
    const floors = [
      { y: 20, w: 70, h: 28 },
      { y: -8, w: 55, h: 26 },
      { y: -34, w: 40, h: 24 },
    ];

    for (let i = 0; i < floors.length; i++) {
      const f = floors[i];
      // 屋檐
      ctx.fillStyle = COLORS.pagodaRed;
      ctx.beginPath();
      ctx.moveTo(-f.w / 2 - 8, f.y);
      ctx.lineTo(0, f.y - 8);
      ctx.lineTo(f.w / 2 + 8, f.y);
      ctx.closePath();
      ctx.fill();

      // 墙体
      ctx.fillStyle = COLORS.textPrimary;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(-f.w / 2, f.y, f.w, f.h);
      ctx.globalAlpha = 1;

      // 墙框
      ctx.strokeStyle = COLORS.pagodaRed;
      ctx.lineWidth = 1;
      ctx.strokeRect(-f.w / 2, f.y, f.w, f.h);

      // 门/窗
      if (i === 2) {
        // 顶尖
        ctx.fillStyle = COLORS.pagodaGold;
        ctx.beginPath();
        ctx.moveTo(0, f.y - 14);
        ctx.lineTo(-6, f.y - 4);
        ctx.lineTo(6, f.y - 4);
        ctx.closePath();
        ctx.fill();
      } else {
        // 门
        ctx.fillStyle = COLORS.pagodaGold;
        ctx.globalAlpha = 0.5;
        const doorW = 8;
        const doorH = f.h * 0.6;
        ctx.fillRect(-doorW / 2, f.y + f.h - doorH, doorW, doorH);
        ctx.globalAlpha = 1;
      }
    }

    // 底座
    ctx.fillStyle = COLORS.mountainNear;
    ctx.fillRect(-45, 48, 90, 6);

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

  private drawResourcePanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panel = RESOURCE_PANEL;
    const resources = this.getUnlockedResources();

    // 背景条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === 'spirit-stone' ? '💎'
        : res.id === 'herb' ? '🌿'
        : res.id === 'artifact' ? '⚒️'
        : '🏆';

      // 图标
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(icon, panel.padding + 8, y + 16);

      // 数量
      ctx.font = 'bold 13px "Segoe UI", monospace';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(this.formatNumber(res.amount), panel.padding + 30, y + 16);

      // 每秒产出
      if (res.perSecond > 0) {
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.accentGreen;
        ctx.fillText(`+${this.formatNumber(res.perSecond)}/s`, panel.padding + 120, y + 16);
      }

      y += panel.itemHeight + panel.itemPadding;
    }
  }

  private drawBuildingList(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panel = BUILDING_PANEL;

    // 标题
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— 宗门建筑 —', w / 2, panel.startY - 8);

    for (let i = 0; i < BUILDINGS.length; i++) {
      const building = BUILDINGS[i];
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || !upgrade.unlocked) continue;

      const level = upgrade.level;
      const cost = this.getUpgradeCost(building.id);
      const affordable = this.canAfford(cost);
      const selected = i === this._selectedIndex;

      const y = panel.startY + this.getVisibleIndex(i) * (panel.itemHeight + panel.itemPadding);
      const x = panel.itemMarginX;

      // 选中高亮
      if (selected) {
        ctx.fillStyle = COLORS.selectedBg;
        ctx.strokeStyle = COLORS.selectedBorder;
        ctx.lineWidth = 2;
        this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.panelBg;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 6);
        ctx.fill();
        ctx.stroke();
      }

      // 图标
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(building.icon, x + 8, y + 27);

      // 名称 + 等级
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${building.name} Lv.${level}`, x + 36, y + 18);

      // 产出
      if (level > 0) {
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`产出 +${this.formatNumber(building.baseProduction * level)}/s`, x + 36, y + 34);
      }

      // 费用
      if (level < building.maxLevel) {
        const costStr = Object.entries(cost)
          .map(([id, amount]) => {
            const icon = id === 'spirit-stone' ? '💎'
              : id === 'herb' ? '🌿'
              : id === 'artifact' ? '⚒️'
              : '🏆';
            return `${icon}${this.formatNumber(amount)}`;
          })
          .join(' ');
        ctx.font = 'bold 11px "Segoe UI", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
        ctx.fillText(costStr, x + panel.itemWidth - 8, y + 27);
      } else {
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.accentGold;
        ctx.fillText('MAX', x + panel.itemWidth - 8, y + 27);
      }
    }

    // 底部提示
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · D 招募弟子 · P 声望', w / 2, h - 10);
  }

  /** 获取可见索引（跳过未解锁的建筑） */
  private getVisibleIndex(buildingIndex: number): number {
    let visible = 0;
    for (let i = 0; i < buildingIndex; i++) {
      const upgrade = this.upgrades.get(BUILDINGS[i].id);
      if (upgrade && upgrade.unlocked) visible++;
    }
    return visible;
  }

  /** 圆角矩形辅助 */
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
        this._selectedIndex = Math.max(0, this._selectedIndex - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown':
        this._selectedIndex = Math.min(BUILDINGS.length - 1, this._selectedIndex + 1);
        this.emit('stateChange');
        break;
      case 'Enter':
        this.purchaseBuilding(this._selectedIndex);
        break;
      case 'd':
      case 'D': {
        // 招募下一个未解锁的弟子
        const nextDisciple = this._disciples.find((d) => !d.unlocked);
        if (nextDisciple) this.recruitDisciple(nextDisciple.id);
        break;
      }
      case 'p':
      case 'P':
        this.doPrestige();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  // ========== 状态序列化 ==========

  getState(): SectRiseState {
    const resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }> = {};
    for (const [id, r] of this.resources) {
      resources[id] = { amount: r.amount, perSecond: r.perSecond, unlocked: r.unlocked };
    }

    const buildings: Record<string, number> = {};
    for (const [id, u] of this.upgrades) {
      if (u.level > 0) buildings[id] = u.level;
    }

    return {
      resources,
      buildings,
      disciples: this.disciples,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: SectRiseState): void {
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
    if (state.buildings) {
      for (const [id, level] of Object.entries(state.buildings)) {
        const upgrade = this.upgrades.get(id);
        if (upgrade) {
          upgrade.level = level;
          upgrade.unlocked = true;
        }
      }
    }

    // 恢复弟子
    if (state.disciples) {
      for (const ds of state.disciples) {
        const myDisciple = this._disciples.find((d) => d.id === ds.id);
        if (myDisciple) {
          myDisciple.unlocked = ds.unlocked;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as SectRiseStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    data.settings = {
      disciples: this._disciples,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as Record<string, unknown>;
      const discData = settings.disciples as DiscipleState[] | undefined;
      if (discData) {
        for (const ds of discData) {
          const myDisciple = this._disciples.find((d) => d.id === ds.id);
          if (myDisciple) {
            myDisciple.unlocked = ds.unlocked;
          }
        }
      }
      const statsData = settings.stats as SectRiseStatistics | undefined;
      if (statsData) {
        this._stats = { ...this._stats, ...statsData };
      }
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex as number;
      }
    }

    this.recalculateProduction();
  }
}
