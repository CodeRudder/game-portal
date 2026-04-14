/**
 * Kittens Kingdom（猫咪王国）放置类游戏引擎
 *
 * 继承 IdleGameEngine，核心玩法：
 * - 点击/空格键产生鱼干
 * - 建筑系统（猫窝、鱼塘、猫薄荷田、编织坊、猫咪学校、猫咪神殿）
 * - 猫咪品种解锁系统（8 种猫咪，各有不同加成）
 * - 声望系统（重置获得猫宝石，永久加成）
 * - 离线收益
 * - 自动存档/读档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData, OfflineReport } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FISH_PER_CLICK,
  RESOURCE_IDS,
  BUILDING_IDS,
  CAT_BREEDS,
  BUILDINGS,
  PRESTIGE_MULTIPLIER,
  MIN_PRESTIGE_FISH,
  NUMBER_SUFFIXES,
  COLORS,
  UPGRADE_PANEL,
  RESOURCE_ICONS,
  RESOURCE_NAMES,
  MAX_VISIBLE_CATS,
  CAT_WALK_SPEED,
  FLOATING_TEXT_DURATION,
  type CatBreedDef,
  type BuildingDef,
} from './constants';

// ========== 游戏状态接口 ==========

/** 猫咪品种状态 */
export interface BreedState {
  id: string;
  unlocked: boolean;
}

/** 场景中的猫咪（动画用） */
interface SceneCat {
  x: number;
  y: number;
  targetX: number;
  direction: number; // 1=右, -1=左
  breedIndex: number;
  walkTimer: number;
  idle: boolean;
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

/** 游戏完整状态 */
export interface KittensKingdomState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; unlocked: boolean }>;
  upgrades: Record<string, number>;
  breeds: BreedState[];
  prestige: { currency: number; count: number };
  statistics: Record<string, number>;
  totalFishEarned: number;
  totalClicks: number;
  selectedBuildingIndex: number;
}

export class KittensKingdomEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'kittens-kingdom';

  /** 猫咪品种解锁状态 */
  private _breeds: BreedState[] = [];

  /** 累计鱼干获得 */
  private _totalFishEarned: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 当前选中建筑索引 */
  private _selectedBuildingIndex: number = 0;

  // ========== 动画状态 ==========

  /** 飘字效果列表 */
  private _floatingTexts: FloatingText[] = [];
  /** 场景猫咪列表 */
  private _sceneCats: SceneCat[] = [];
  /** 点击缩放动画 */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 猫咪动画帧计时 */
  private _catAnimTimer: number = 0;

  // ========== 公开属性 ==========

  get totalFishEarned(): number {
    return this._totalFishEarned;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get selectedBuildingIndex(): number {
    return this._selectedBuildingIndex;
  }

  get breeds(): BreedState[] {
    return this._breeds.map((b) => ({ ...b }));
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    super.onInit();

    // 初始化资源
    this.initializeResources([
      {
        id: RESOURCE_IDS.FISH,
        name: '鱼干',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: true,
      },
      {
        id: RESOURCE_IDS.CATNIP,
        name: '猫薄荷',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.YARN,
        name: '毛线',
        amount: 0,
        perSecond: 0,
        maxAmount: Infinity,
        unlocked: false,
      },
      {
        id: RESOURCE_IDS.GEMS,
        name: '猫宝石',
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

    // 初始化猫咪品种
    this._breeds = CAT_BREEDS.map((b) => ({
      id: b.id,
      unlocked: b.id === 'orange', // 橘猫初始解锁
    }));

    // 重置状态
    this._totalFishEarned = 0;
    this._totalClicks = 0;
    this._selectedBuildingIndex = 0;
    this._floatingTexts = [];
    this._sceneCats = [];
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._catAnimTimer = 0;

    // 初始化场景猫咪
    this.initSceneCats();
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

    // 检查猫咪品种解锁
    this.checkBreedUnlocks();
  }

  // ========== 核心逻辑 ==========

  /**
   * 点击产生鱼干
   * @returns 本次获得的鱼干数
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    const clickPower = this.getClickPower();
    this.addResource(RESOURCE_IDS.FISH, clickPower);
    this._totalFishEarned += clickPower;
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
      color: COLORS.fishColor,
    });

    this.emit('stateChange');
    return clickPower;
  }

  /**
   * 获取当前点击力量
   */
  getClickPower(): number {
    let power = FISH_PER_CLICK;

    // 猫咪品种加成
    for (const breed of this._breeds) {
      if (breed.unlocked) {
        const def = CAT_BREEDS.find((b) => b.id === breed.id);
        if (def && def.bonusType === 'click_power') {
          power += def.bonusValue;
        }
      }
    }

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
   * 解锁猫咪品种
   */
  unlockBreed(breedId: string): boolean {
    const breedIndex = this._breeds.findIndex((b) => b.id === breedId);
    if (breedIndex === -1) return false;
    if (this._breeds[breedIndex].unlocked) return false;

    const def = CAT_BREEDS.find((b) => b.id === breedId);
    if (!def) return false;

    // 检查费用
    if (!this.canAfford(def.unlockCost)) return false;

    // 扣除费用
    for (const [resId, amount] of Object.entries(def.unlockCost)) {
      this.spendResource(resId, amount);
    }

    this._breeds[breedIndex].unlocked = true;

    // 添加场景猫咪
    this.addSceneCat(breedIndex);

    this.emit('breedUnlocked', breedId);
    this.emit('stateChange');
    return true;
  }

  /**
   * 检查品种是否已解锁
   */
  isBreedUnlocked(breedId: string): boolean {
    const breed = this._breeds.find((b) => b.id === breedId);
    return !!breed && breed.unlocked;
  }

  /**
   * 获取所有品种状态
   */
  getBreeds(): BreedState[] {
    return this._breeds.map((b) => ({ ...b }));
  }

  /**
   * 计算总产出倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;

    // 猫咪品种加成
    for (const breed of this._breeds) {
      if (breed.unlocked) {
        const def = CAT_BREEDS.find((b) => b.id === breed.id);
        if (def && def.bonusType === 'all_production') {
          multiplier += def.bonusValue;
        }
      }
    }

    // 猫咪学校加成
    const schoolLevel = this.getBuildingLevel(BUILDING_IDS.CAT_SCHOOL);
    multiplier += schoolLevel * 0.05;

    // 声望加成
    multiplier += this.prestige.currency * PRESTIGE_MULTIPLIER;

    return multiplier;
  }

  /**
   * 获取指定资源的产出倍率
   */
  getResourceMultiplier(resourceId: string): number {
    let multiplier = this.getProductionMultiplier();

    // 猫咪品种对特定资源的加成
    for (const breed of this._breeds) {
      if (breed.unlocked) {
        const def = CAT_BREEDS.find((b) => b.id === breed.id);
        if (def) {
          if (def.bonusType === 'fish_production' && resourceId === RESOURCE_IDS.FISH) {
            multiplier += def.bonusValue;
          } else if (def.bonusType === 'catnip_production' && resourceId === RESOURCE_IDS.CATNIP) {
            multiplier += def.bonusValue;
          } else if (def.bonusType === 'yarn_production' && resourceId === RESOURCE_IDS.YARN) {
            multiplier += def.bonusValue;
          }
        }
      }
    }

    return multiplier;
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
   * 计算声望重置可获得的猫宝石数
   */
  calculatePrestigeGems(): number {
    const fish = this.getResource(RESOURCE_IDS.FISH);
    if (!fish || fish.amount < MIN_PRESTIGE_FISH) return 0;
    return Math.floor(Math.sqrt(fish.amount / MIN_PRESTIGE_FISH));
  }

  /**
   * 执行声望重置
   */
  prestigeReset(): boolean {
    const gems = this.calculatePrestigeGems();
    if (gems <= 0) return false;

    // 保存声望数据
    this.prestige.currency += gems;
    this.prestige.count++;

    // 保留统计信息
    const stats = { ...this.statistics };
    const prestigeData = { ...this.prestige };
    const breeds = this._breeds.map((b) => ({ ...b }));

    // 重置游戏
    this.onInit();

    // 恢复声望数据
    this.prestige = prestigeData;
    this.statistics = stats;

    // 恢复已解锁的猫咪品种
    for (let i = 0; i < this._breeds.length && i < breeds.length; i++) {
      if (breeds[i].unlocked) {
        this._breeds[i].unlocked = true;
      }
    }

    // 重新计算产出
    this.recalculateProduction();

    // 给予声望宝石
    this.addResource(RESOURCE_IDS.GEMS, gems);

    this.emit('prestigeReset', gems);
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

    // 附加猫咪品种状态
    data.statistics = {
      ...this.statistics,
      totalFishEarned: this._totalFishEarned,
      totalClicks: this._totalClicks,
      breeds: this._breeds.map((b) => (b.unlocked ? 1 : 0)) as any,
    };

    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复猫咪品种
    if (data.statistics?.breeds && Array.isArray(data.statistics.breeds)) {
      const savedBreeds = data.statistics.breeds as number[];
      for (let i = 0; i < this._breeds.length && i < savedBreeds.length; i++) {
        this._breeds[i].unlocked = savedBreeds[i] === 1;
      }
    }

    // 恢复统计
    this._totalFishEarned = (data.statistics?.totalFishEarned as number) || 0;
    this._totalClicks = (data.statistics?.totalClicks as number) || 0;

    // 重新计算产出
    this.recalculateProduction();
  }

  getState(): KittensKingdomState {
    const baseState = super.getState();

    return {
      ...baseState,
      breeds: this._breeds.map((b) => ({ ...b })),
      totalFishEarned: this._totalFishEarned,
      totalClicks: this._totalClicks,
      selectedBuildingIndex: this._selectedBuildingIndex,
      prestige: { ...this.prestige },
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: KittensKingdomState): void {
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

    // 恢复品种
    if (state.breeds) {
      for (let i = 0; i < this._breeds.length && i < state.breeds.length; i++) {
        this._breeds[i].unlocked = state.breeds[i].unlocked;
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    this._totalFishEarned = state.totalFishEarned || 0;
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
    // 猫薄荷：有鱼干超过 100 时解锁
    const fish = this.getResource(RESOURCE_IDS.FISH);
    if (fish && fish.amount >= 100) {
      const catnip = this.getResource(RESOURCE_IDS.CATNIP);
      if (catnip && !catnip.unlocked) {
        catnip.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.CATNIP);
      }
    }

    // 毛线：有猫薄荷超过 20 时解锁
    const catnip = this.getResource(RESOURCE_IDS.CATNIP);
    if (catnip && catnip.amount >= 20) {
      const yarn = this.getResource(RESOURCE_IDS.YARN);
      if (yarn && !yarn.unlocked) {
        yarn.unlocked = true;
        this.emit('resourceUnlocked', RESOURCE_IDS.YARN);
      }
    }

    // 猫宝石：声望重置后解锁
    if (this.prestige.count > 0) {
      const gems = this.getResource(RESOURCE_IDS.GEMS);
      if (gems && !gems.unlocked) {
        gems.unlocked = true;
      }
    }
  }

  private checkBreedUnlocks(): void {
    // 自动检查可解锁的品种（仅标记可解锁，不自动解锁）
    // 解锁需要玩家主动操作
  }

  // ========== 动画系统 ==========

  private initSceneCats(): void {
    // 初始橘猫
    this.addSceneCat(0);
  }

  private addSceneCat(breedIndex: number): void {
    if (this._sceneCats.length >= MAX_VISIBLE_CATS) return;

    this._sceneCats.push({
      x: 100 + Math.random() * 280,
      y: 200 + Math.random() * 60,
      targetX: 100 + Math.random() * 280,
      direction: Math.random() > 0.5 ? 1 : -1,
      breedIndex,
      walkTimer: 0,
      idle: Math.random() > 0.5,
    });
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

    // 猫咪行走
    this._catAnimTimer += deltaTime;
    for (const cat of this._sceneCats) {
      cat.walkTimer += deltaTime;

      if (cat.idle) {
        // 空闲一段时间后开始走
        if (cat.walkTimer > 2000 + Math.random() * 3000) {
          cat.idle = false;
          cat.walkTimer = 0;
          cat.targetX = 60 + Math.random() * 360;
          cat.direction = cat.targetX > cat.x ? 1 : -1;
        }
      } else {
        // 走向目标
        const dx = cat.targetX - cat.x;
        const step = (CAT_WALK_SPEED * deltaTime) / 1000;
        if (Math.abs(dx) < step) {
          cat.x = cat.targetX;
          cat.idle = true;
          cat.walkTimer = 0;
        } else {
          cat.x += Math.sign(dx) * step;
        }
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawGround(ctx, w, h);
    this.drawSceneCats(ctx);
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
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 20; i++) {
      const x = ((i * 73 + 17) % w);
      const y = ((i * 47 + 13) % 200);
      const r = 1 + (i % 3);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 地面
    ctx.fillStyle = COLORS.groundColor;
    ctx.fillRect(0, 250, w, h - 250);

    // 草地
    ctx.fillStyle = COLORS.grassColor;
    ctx.fillRect(0, 245, w, 12);

    // 小花装饰
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 80;
      const y = 258;
      ctx.fillStyle = i % 2 === 0 ? '#ff69b4' : '#ffff00';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSceneCats(ctx: CanvasRenderingContext2D): void {
    for (const cat of this._sceneCats) {
      this.drawPixelCat(ctx, cat.x, cat.y, cat.breedIndex, cat.direction, cat.idle);
    }
  }

  private drawPixelCat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    breedIndex: number,
    direction: number,
    idle: boolean
  ): void {
    const size = 20;
    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) {
      ctx.scale(-1, 1);
    }

    // 猫身体颜色
    const breed = CAT_BREEDS[breedIndex];
    let bodyColor = COLORS.catOrange;
    if (breed) {
      switch (breed.id) {
        case 'orange': bodyColor = COLORS.catOrange; break;
        case 'british-shorthair': bodyColor = '#5c6bc0'; break;
        case 'ragdoll': bodyColor = '#efebe9'; break;
        case 'siamese': bodyColor = '#d7ccc8'; break;
        case 'persian': bodyColor = '#ffcc80'; break;
        case 'maine-coon': bodyColor = '#8d6e63'; break;
        case 'sphynx': bodyColor = '#ffab91'; break;
        case 'scottish-fold': bodyColor = '#b0bec5'; break;
      }
    }

    // 身体
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-size / 2, -size, size, size);

    // 头
    ctx.fillRect(-size / 2 - 2, -size - 8, size + 4, 10);

    // 耳朵
    ctx.beginPath();
    ctx.moveTo(-size / 2 - 2, -size - 8);
    ctx.lineTo(-size / 2 + 2, -size - 16);
    ctx.lineTo(-size / 2 + 6, -size - 8);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(size / 2 + 2, -size - 8);
    ctx.lineTo(size / 2 - 2, -size - 16);
    ctx.lineTo(size / 2 - 6, -size - 8);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#000000';
    ctx.fillRect(-5, -size - 5, 3, 3);
    ctx.fillRect(3, -size - 5, 3, 3);

    // 尾巴（非空闲时摆动）
    if (!idle) {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(size / 2, -size + 2, 8, 3);
    } else {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(size / 2, -size + 4, 6, 3);
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
    ctx.fillStyle = COLORS.accentGold;
    ctx.textAlign = 'center';
    ctx.fillText('🐱 猫咪王国', w / 2, 28);

    // 资源显示
    const resources = this.getUnlockedResources();
    const startX = 20;
    let rx = startX;

    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    for (const resource of resources) {
      const icon = RESOURCE_ICONS[resource.id] || '';
      const name = RESOURCE_NAMES[resource.id] || resource.id;
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
    ctx.fillText(`点击力量: ${this.formatNumber(this.getClickPower())} 🐟`, w / 2, 82);

    // 总产出倍率
    ctx.fillText(`产出倍率: x${this.getProductionMultiplier().toFixed(2)}`, w / 2, 96);

    // 声望信息
    if (this.prestige.count > 0) {
      ctx.fillStyle = COLORS.gemColor;
      ctx.fillText(`💎 ${this.formatNumber(this.prestige.currency)} 声望 x${this.prestige.count}`, w / 2, 110);
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
