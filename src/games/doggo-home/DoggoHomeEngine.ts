/**
 * 狗狗家园 (Doggo Home) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（饼干/爱心/奖牌/星星）
 * - 建筑升级系统
 * - 狗狗品种解锁
 * - 声望重置系统
 * - Canvas Q版卡通渲染
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TREATS_PER_CLICK,
  STAR_BONUS_MULTIPLIER,
  PRESTIGE_BASE_STARS,
  PRESTIGE_MIN_TOTAL_TREATS,
  DOG_BREEDS,
  BUILDINGS,
  COLORS,
  DOG_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type DogBreedDef,
  type BuildingDef,
} from './constants';

/** 狗狗品种状态 */
export interface DogBreedState {
  id: string;
  unlocked: boolean;
}

/** 游戏统计 */
export interface DoggoStatistics {
  totalTreatsEarned: number;
  totalClicks: number;
  totalLoveEarned: number;
  totalMedalsEarned: number;
  totalPrestigeCount: number;
  totalDogsUnlocked: number;
}

/** 狗狗家园游戏状态 */
export interface DoggoHomeState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  dogs: DogBreedState[];
  prestige: { currency: number; count: number };
  statistics: DoggoStatistics;
  selectedIndex: number;
}

export class DoggoHomeEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'doggo-home';

  /** 狗狗品种状态 */
  private _dogs: DogBreedState[] = DOG_BREEDS.map((d) => ({
    id: d.id,
    unlocked: d.id === 'shiba', // 柴犬初始解锁
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: DoggoStatistics = {
    totalTreatsEarned: 0,
    totalClicks: 0,
    totalLoveEarned: 0,
    totalMedalsEarned: 0,
    totalPrestigeCount: 0,
    totalDogsUnlocked: 1,
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

  /** 狗狗动画计时器 */
  private _dogAnimTimer: number = 0;
  /** 狗狗尾巴摆动角度 */
  private _tailAngle: number = 0;
  /** 狗狗跳跃偏移 */
  private _dogBounce: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get dogs(): DogBreedState[] {
    return this._dogs.map((d) => ({ ...d }));
  }

  /** 获取游戏统计数据（公共访问） */
  get gameStatistics(): DoggoStatistics {
    return { ...this._stats };
  }

  get totalTreatsEarned(): number {
    return this._stats.totalTreatsEarned;
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
        id: 'treats',
        name: '骨头饼干',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'love',
        name: '爱心',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'medals',
        name: '奖牌',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e9,
        unlocked: false,
      },
      {
        id: 'stars',
        name: '星星',
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
        unlocked: b.id === 'kennel', // 狗窝初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._dogs = DOG_BREEDS.map((d) => ({
      id: d.id,
      unlocked: d.id === 'shiba',
    }));
    this._selectedIndex = 0;
    this._stats = {
      totalTreatsEarned: 0,
      totalClicks: 0,
      totalLoveEarned: 0,
      totalMedalsEarned: 0,
      totalPrestigeCount: 0,
      totalDogsUnlocked: 1,
    };
    this._floatingTexts = [];
    this._dogAnimTimer = 0;
    this._tailAngle = 0;
    this._dogBounce = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this.statistics.totalTreatsEarned = 0;
    this.statistics.totalClicks = 0;
  }

  protected onUpdate(deltaTime: number): void {
    // 狗狗动画
    this._dogAnimTimer += deltaTime;
    this._tailAngle = Math.sin(this._dogAnimTimer * 0.005) * 0.4;
    this._dogBounce = Math.sin(this._dogAnimTimer * 0.003) * 3;

    // 点击动画衰减
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        this._clickScale = 1 + 0.15 * (this._clickAnimTimer / 150);
      }
    }

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.04;
      return ft.life > 0;
    });

    // 统计资源产出
    const treats = this.getResource('treats');
    if (treats && treats.perSecond > 0) {
      this._stats.totalTreatsEarned += treats.perSecond * (deltaTime / 1000);
    }
    const love = this.getResource('love');
    if (love && love.perSecond > 0) {
      this._stats.totalLoveEarned += love.perSecond * (deltaTime / 1000);
    }
    const medals = this.getResource('medals');
    if (medals && medals.perSecond > 0) {
      this._stats.totalMedalsEarned += medals.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得饼干
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = TREATS_PER_CLICK;

    // 狗狗点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('treats', gained);
    this._stats.totalTreatsEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: DOG_DRAW.centerX + Math.cos(angle) * dist,
      y: DOG_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.accent,
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
   * 解锁狗狗品种
   */
  unlockDog(breedId: string): boolean {
    const breedDef = DOG_BREEDS.find((b) => b.id === breedId);
    if (!breedDef) return false;

    const dogState = this._dogs.find((d) => d.id === breedId);
    if (!dogState || dogState.unlocked) return false;

    if (!this.hasResource('treats', breedDef.unlockCost)) return false;

    this.spendResource('treats', breedDef.unlockCost);
    dogState.unlocked = true;
    this._stats.totalDogsUnlocked++;

    // 重新计算产出（狗狗加成可能影响产出）
    this.recalculateProduction();

    this.emit('dogUnlocked', breedId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 声望重置
   */
  performPrestige(): number {
    const treats = this.getResource('treats');
    if (!treats || this._stats.totalTreatsEarned < PRESTIGE_MIN_TOTAL_TREATS) return 0;

    // 计算获得的星星
    const starsGained = Math.floor(
      PRESTIGE_BASE_STARS * Math.sqrt(this._stats.totalTreatsEarned / PRESTIGE_MIN_TOTAL_TREATS)
    );

    if (starsGained <= 0) return 0;

    // 保存星星
    const prevStars = this.prestige.currency;
    this.prestige.currency += starsGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 重置资源和建筑（保留星星和声望数据）
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalTreatsEarned: 0,
      totalClicks: 0,
      totalLoveEarned: 0,
      totalMedalsEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as DoggoStatistics;

    // 给予声望星星
    this.addResource('stars', this.prestige.currency);

    this.emit('prestige', starsGained);
    this.emit('stateChange');
    return starsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * STAR_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const dog of this._dogs) {
      if (!dog.unlocked) continue;
      const def = DOG_BREEDS.find((b) => b.id === dog.id);
      if (!def) continue;
      if (def.bonusType === 'click' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const dog of this._dogs) {
      if (!dog.unlocked) continue;
      const def = DOG_BREEDS.find((b) => b.id === dog.id);
      if (!def) continue;
      if (def.bonusType === 'production' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取爱心加成倍率
   */
  getLoveMultiplier(): number {
    let multiplier = 1;
    for (const dog of this._dogs) {
      if (!dog.unlocked) continue;
      const def = DOG_BREEDS.find((b) => b.id === dog.id);
      if (!def) continue;
      if (def.bonusType === 'love' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
    return multiplier;
  }

  /**
   * 获取奖牌加成倍率
   */
  getMedalMultiplier(): number {
    let multiplier = 1;
    for (const dog of this._dogs) {
      if (!dog.unlocked) continue;
      const def = DOG_BREEDS.find((b) => b.id === dog.id);
      if (!def) continue;
      if (def.bonusType === 'medal' || def.bonusType === 'all') {
        multiplier += def.bonusValue;
      }
    }
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
   * 获取预览声望星星数
   */
  getPrestigePreview(): number {
    if (this._stats.totalTreatsEarned < PRESTIGE_MIN_TOTAL_TREATS) return 0;
    return Math.floor(
      PRESTIGE_BASE_STARS * Math.sqrt(this._stats.totalTreatsEarned / PRESTIGE_MIN_TOTAL_TREATS)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalTreatsEarned >= PRESTIGE_MIN_TOTAL_TREATS;
  }

  // ========== 内部方法 ==========

  /**
   * 重写产出计算，加入加成
   */
  protected recalculateProduction(): void {
    // 先重置
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }

    // 基础产出
    for (const building of BUILDINGS) {
      const upgrade = this.upgrades.get(building.id);
      if (!upgrade || upgrade.level <= 0) continue;

      let production = building.baseProduction * upgrade.level;

      // 应用对应加成
      if (building.productionResource === 'treats') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'love') {
        production *= this.getLoveMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'medals') {
        production *= this.getMedalMultiplier() * this.getPrestigeMultiplier();
      } else if (building.productionResource === 'stars') {
        production *= this.getPrestigeMultiplier();
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

      // 检查前置建筑
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
    // 爱心：狗窝等级 >= 5 时解锁
    const kennel = this.upgrades.get('kennel');
    if (kennel && kennel.level >= 5) {
      const love = this.resources.get('love');
      if (love && !love.unlocked) {
        love.unlocked = true;
        this.emit('resourceUnlocked', 'love');
      }
    }

    // 奖牌：训练场等级 >= 3 时解锁
    const training = this.upgrades.get('training_ground');
    if (training && training.level >= 3) {
      const medals = this.resources.get('medals');
      if (medals && !medals.unlocked) {
        medals.unlocked = true;
        this.emit('resourceUnlocked', 'medals');
      }
    }

    // 星星：通过声望获得
    if (this.prestige.currency > 0) {
      const stars = this.resources.get('stars');
      if (stars && !stars.unlocked) {
        stars.unlocked = true;
        this.addResource('stars', this.prestige.currency);
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawDog(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 草地渐变
    const grassGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    grassGradient.addColorStop(0, COLORS.grassLight);
    grassGradient.addColorStop(1, COLORS.grassDark);
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 草地纹理
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 40; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y - 8);
      ctx.lineTo(x + 2, y - 6);
      ctx.fillStyle = '#2E7D32';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 太阳
    ctx.beginPath();
    ctx.arc(w - 60, 40, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w - 60, 40, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.fill();

    // 云朵
    this.drawCloud(ctx, 80, 30, 0.8);
    this.drawCloud(ctx, 300, 50, 0.6);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 15 * scale, 0, Math.PI * 2);
    ctx.arc(x + 15 * scale, y - 5 * scale, 20 * scale, 0, Math.PI * 2);
    ctx.arc(x + 35 * scale, y, 15 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawDog(ctx: CanvasRenderingContext2D): void {
    const cx = DOG_DRAW.centerX;
    const cy = DOG_DRAW.centerY + this._dogBounce;
    const scale = this._clickScale;

    // 获取第一个已解锁的狗狗
    const unlockedDog = this._dogs.find((d) => d.unlocked);
    const breedDef = unlockedDog
      ? DOG_BREEDS.find((b) => b.id === unlockedDog.id)!
      : DOG_BREEDS[0];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 身体阴影
    ctx.beginPath();
    ctx.ellipse(4, DOG_DRAW.bodyRadius * 0.6 + 4, DOG_DRAW.bodyRadius * 0.9, DOG_DRAW.bodyRadius * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.dogShadow;
    ctx.fill();

    // 身体
    ctx.beginPath();
    ctx.ellipse(0, DOG_DRAW.bodyRadius * 0.3, DOG_DRAW.bodyRadius * 0.8, DOG_DRAW.bodyRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 头
    ctx.beginPath();
    ctx.arc(0, -DOG_DRAW.headRadius * 0.5, DOG_DRAW.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.color;
    ctx.fill();

    // 耳朵
    ctx.save();
    ctx.translate(-DOG_DRAW.headRadius * 0.7, -DOG_DRAW.headRadius * 1.0);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, DOG_DRAW.earWidth * 0.6, DOG_DRAW.earHeight * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.earColor;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(DOG_DRAW.headRadius * 0.7, -DOG_DRAW.headRadius * 1.0);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, DOG_DRAW.earWidth * 0.6, DOG_DRAW.earHeight * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = breedDef.earColor;
    ctx.fill();
    ctx.restore();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-DOG_DRAW.headRadius * 0.3, -DOG_DRAW.headRadius * 0.6, DOG_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(DOG_DRAW.headRadius * 0.3, -DOG_DRAW.headRadius * 0.6, DOG_DRAW.eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 眼睛高光
    ctx.beginPath();
    ctx.arc(-DOG_DRAW.headRadius * 0.3 + 2, -DOG_DRAW.headRadius * 0.6 - 2, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(DOG_DRAW.headRadius * 0.3 + 2, -DOG_DRAW.headRadius * 0.6 - 2, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 鼻子
    ctx.beginPath();
    ctx.ellipse(0, -DOG_DRAW.headRadius * 0.2, DOG_DRAW.noseRadius, DOG_DRAW.noseRadius * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2C2C2C';
    ctx.fill();

    // 嘴巴
    ctx.beginPath();
    ctx.arc(0, -DOG_DRAW.headRadius * 0.1, DOG_DRAW.noseRadius * 1.2, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#2C2C2C';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 尾巴
    ctx.save();
    ctx.translate(DOG_DRAW.bodyRadius * 0.6, DOG_DRAW.bodyRadius * 0.1);
    ctx.rotate(this._tailAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(DOG_DRAW.tailLength * 0.5, -DOG_DRAW.tailLength, DOG_DRAW.tailLength, -DOG_DRAW.tailLength * 0.5);
    ctx.strokeStyle = breedDef.color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === 'treats' ? '🦴' : res.id === 'love' ? '❤️' : res.id === 'medals' ? '🏅' : '⭐';

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
    ctx.fillText('— 建筑 —', w / 2, panel.startY - 8);

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
        const resource = this.resources.get(building.productionResource);
        const pps = resource ? resource.perSecond : 0;
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`产出 +${this.formatNumber(building.baseProduction * level)}/s`, x + 36, y + 34);
      }

      // 费用
      if (level < building.maxLevel) {
        const costStr = Object.entries(cost)
          .map(([id, amount]) => {
            const icon = id === 'treats' ? '🦴' : id === 'love' ? '❤️' : id === 'medals' ? '🏅' : '⭐';
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
        ctx.fillStyle = COLORS.accent;
        ctx.fillText('MAX', x + panel.itemWidth - 8, y + 27);
      }
    }

    // 底部提示
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · P 声望', w / 2, h - 10);
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
      case 'p':
      case 'P':
        this.performPrestige();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  // ========== 状态序列化 ==========

  getState(): DoggoHomeState {
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
      dogs: this.dogs,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: DoggoHomeState): void {
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

    // 恢复狗狗
    if (state.dogs) {
      for (const dogState of state.dogs) {
        const myDog = this._dogs.find((d) => d.id === dogState.id);
        if (myDog) {
          myDog.unlocked = dogState.unlocked;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as DoggoStatistics;
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
    // 附加狗狗和统计信息到 settings
    data.settings = {
      dogs: this._dogs,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as any;
      if (settings.dogs) {
        for (const dogState of settings.dogs) {
          const myDog = this._dogs.find((d) => d.id === dogState.id);
          if (myDog) {
            myDog.unlocked = dogState.unlocked;
          }
        }
      }
      if (settings.stats) {
        this._stats = { ...this._stats, ...settings.stats };
      }
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex;
      }
    }

    this.recalculateProduction();
  }
}
