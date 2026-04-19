/**
 * 末日生存 (Doomsday) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 多资源系统（物资/弹药/电力）
 * - 建筑升级系统（8种建筑）
 * - 丧尸防御系统（波次战斗）
 * - 声望重置系统（末日芯片）
 * - Canvas 废土风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SUPPLY_PER_CLICK,
  CHIP_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CHIPS,
  MIN_PRESTIGE_SUPPLY,
  ZOMBIE_WAVES,
  BUILDINGS,
  COLORS,
  SCENE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type BuildingDef,
  type ZombieWaveDef,
} from './constants';

/** 丧尸战斗状态 */
export interface ZombieBattleState {
  /** 当前波次（0=无战斗） */
  currentWave: number;
  /** 剩余丧尸数 */
  zombiesRemaining: number;
  /** 当前丧尸 HP */
  currentZombieHp: number;
  /** 最大丧尸 HP */
  maxZombieHp: number;
  /** 是否在战斗中 */
  inBattle: boolean;
}

/** 游戏统计 */
export interface DoomsdayStatistics {
  totalSupplyEarned: number;
  totalClicks: number;
  totalAmmoEarned: number;
  totalPowerEarned: number;
  totalPrestigeCount: number;
  totalZombiesKilled: number;
  totalWavesCleared: number;
  totalBuildingsBuilt: number;
}

/** 末日生存游戏状态 */
export interface DoomsdayState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  prestige: { currency: number; count: number };
  statistics: DoomsdayStatistics;
  selectedIndex: number;
  zombieBattle: ZombieBattleState;
  highestWave: number;
  defensePower: number;
}

/** 丧尸波次最大编号 */
const MAX_WAVE = ZOMBIE_WAVES.length;

export class DoomsdayEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'doomsday';

  constructor() {
    super();
    // Override base class `statistics` instance field with a getter/setter,
    // because class fields shadow prototype accessors.
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as DoomsdayStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 统计数据 */
  private _stats: DoomsdayStatistics = {
    totalSupplyEarned: 0,
    totalClicks: 0,
    totalAmmoEarned: 0,
    totalPowerEarned: 0,
    totalPrestigeCount: 0,
    totalZombiesKilled: 0,
    totalWavesCleared: 0,
    totalBuildingsBuilt: 0,
  };

  /** 丧尸战斗状态 */
  private _zombieBattle: ZombieBattleState = {
    currentWave: 0,
    zombiesRemaining: 0,
    currentZombieHp: 0,
    maxZombieHp: 0,
    inBattle: false,
  };

  /** 最高通关波次 */
  private _highestWave: number = 0;

  /** 防御力（来自防御塔、军械库和堡垒） */
  private _defensePower: number = 0;

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
  /** 避难所灯光闪烁 */
  private _lightFlicker: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 丧尸动画 */
  private _zombieAnimOffset: number = 0;
  /** 灰尘粒子 */
  private _dustParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get zombieBattle(): ZombieBattleState {
    return { ...this._zombieBattle };
  }

  get highestWave(): number {
    return this._highestWave;
  }

  get defensePower(): number {
    return this._defensePower;
  }

  get totalSupplyEarned(): number {
    return this._stats.totalSupplyEarned;
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
        id: 'supply',
        name: '物资',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'ammo',
        name: '弹药',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'power',
        name: '电力',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e9,
        unlocked: false,
      },
    ]);

    // 初始化建筑（作为升级）
    this.initializeUpgrades(
      BUILDINGS.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        baseCost: { ...b.baseCost },
        costMultiplier: b.costMultiplier,
        level: 0,
        maxLevel: b.maxLevel,
        effect: {
          type: 'add_production',
          target: b.productionResource,
          value: b.baseProduction,
        },
        unlocked: b.id === 'shelter', // 避难所初始解锁
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._selectedIndex = 0;
    this._stats = {
      totalSupplyEarned: 0,
      totalClicks: 0,
      totalAmmoEarned: 0,
      totalPowerEarned: 0,
      totalPrestigeCount: 0,
      totalZombiesKilled: 0,
      totalWavesCleared: 0,
      totalBuildingsBuilt: 0,
    };
    this._zombieBattle = {
      currentWave: 0,
      zombiesRemaining: 0,
      currentZombieHp: 0,
      maxZombieHp: 0,
      inBattle: false,
    };
    this._highestWave = 0;
    this._defensePower = 0;
    this._floatingTexts = [];
    this._animTimer = 0;
    this._lightFlicker = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._zombieAnimOffset = 0;
    this._dustParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 动画更新
    this._animTimer += deltaTime;
    this._lightFlicker = Math.sin(this._animTimer * 0.005) * 0.3 + 0.7;
    this._zombieAnimOffset = Math.sin(this._animTimer * 0.003) * 3;

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

    // 灰尘粒子更新
    this._dustParticles = this._dustParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生灰尘粒子
    if (Math.random() < 0.03) {
      this._dustParticles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: CANVAS_HEIGHT * 0.45 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 10,
        vy: -2 - Math.random() * 5,
        life: 2000 + Math.random() * 1500,
        maxLife: 3500,
      });
    }

    // 统计资源产出
    const supply = this.getResource('supply');
    if (supply && supply.perSecond > 0) {
      this._stats.totalSupplyEarned += supply.perSecond * (deltaTime / 1000);
    }
    const ammo = this.getResource('ammo');
    if (ammo && ammo.perSecond > 0) {
      this._stats.totalAmmoEarned += ammo.perSecond * (deltaTime / 1000);
    }
    const power = this.getResource('power');
    if (power && power.perSecond > 0) {
      this._stats.totalPowerEarned += power.perSecond * (deltaTime / 1000);
    }

    // 自动防御丧尸
    if (this._zombieBattle.inBattle) {
      this.autoDefendZombies(deltaTime);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
    // 更新防御力
    this.updateDefensePower();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击收集物资
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = SUPPLY_PER_CLICK;

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('supply', gained);
    this._stats.totalSupplyEarned += gained;
    this._stats.totalClicks++;
    this.addScore(gained);

    // 点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${this.formatNumber(gained)}`,
      x: SCENE_DRAW.centerX + Math.cos(angle) * dist,
      y: SCENE_DRAW.centerY + Math.sin(angle) * dist - 30,
      life: 800,
      maxLife: 800,
      color: COLORS.accentYellow,
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
    this._stats.totalBuildingsBuilt++;
    this.recalculateProduction();
    this.emit('upgradePurchased', upgradeId, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  // ========== 丧尸防御系统 ==========

  /**
   * 开始丧尸波次
   */
  startZombieWave(waveNumber: number): boolean {
    if (waveNumber < 1 || waveNumber > MAX_WAVE) return false;
    if (this._zombieBattle.inBattle) return false;

    // 只能打下一波或重打已通过的波次
    if (waveNumber > this._highestWave + 1) return false;

    const waveDef = ZOMBIE_WAVES.find((w) => w.wave === waveNumber);
    if (!waveDef) return false;

    this._zombieBattle = {
      currentWave: waveNumber,
      zombiesRemaining: waveDef.count,
      currentZombieHp: waveDef.hp,
      maxZombieHp: waveDef.hp,
      inBattle: true,
    };

    this.emit('zombieWaveStarted', waveNumber);
    this.emit('stateChange');
    return true;
  }

  /**
   * 攻击丧尸（手动点击攻击）
   */
  attackZombie(): number {
    if (!this._zombieBattle.inBattle) return 0;

    // 攻击力 = 基础1 + 防御力加成
    const damage = 1 + Math.floor(this._defensePower * 0.1);
    this._zombieBattle.currentZombieHp -= damage;

    if (this._zombieBattle.currentZombieHp <= 0) {
      this._zombieBattle.zombiesRemaining--;
      this._stats.totalZombiesKilled++;

      if (this._zombieBattle.zombiesRemaining <= 0) {
        this.completeZombieWave();
      } else {
        // 下一只丧尸
        this._zombieBattle.currentZombieHp = this._zombieBattle.maxZombieHp;
      }
    }

    this.emit('stateChange');
    return damage;
  }

  /**
   * 自动防御丧尸（每帧调用）
   */
  private autoDefendZombies(deltaTime: number): void {
    if (!this._zombieBattle.inBattle) return;

    // 每秒自动伤害 = 防御力
    const dps = this._defensePower;
    if (dps <= 0) return;

    const damage = dps * (deltaTime / 1000);
    this._zombieBattle.currentZombieHp -= damage;

    while (this._zombieBattle.currentZombieHp <= 0 && this._zombieBattle.inBattle) {
      this._zombieBattle.zombiesRemaining--;
      this._stats.totalZombiesKilled++;

      if (this._zombieBattle.zombiesRemaining <= 0) {
        this.completeZombieWave();
        break;
      } else {
        this._zombieBattle.currentZombieHp += this._zombieBattle.maxZombieHp;
      }
    }
  }

  /**
   * 完成丧尸波次
   */
  private completeZombieWave(): void {
    const wave = this._zombieBattle.currentWave;
    const waveDef = ZOMBIE_WAVES.find((w) => w.wave === wave);
    if (!waveDef) return;

    // 发放奖励
    for (const [resId, amount] of Object.entries(waveDef.reward)) {
      this.addResource(resId, amount);
    }

    // 更新最高波次
    if (wave > this._highestWave) {
      this._highestWave = wave;
    }
    this._stats.totalWavesCleared++;

    // 重置战斗状态
    this._zombieBattle = {
      currentWave: 0,
      zombiesRemaining: 0,
      currentZombieHp: 0,
      maxZombieHp: 0,
      inBattle: false,
    };

    this.emit('zombieWaveCleared', wave, waveDef.reward);
    this.emit('stateChange');
  }

  /**
   * 获取当前可挑战的波次
   */
  getNextWave(): number {
    return Math.min(this._highestWave + 1, MAX_WAVE);
  }

  /**
   * 获取丧尸波次定义
   */
  getWaveDefinition(waveNumber: number): ZombieWaveDef | undefined {
    return ZOMBIE_WAVES.find((w) => w.wave === waveNumber);
  }

  // ========== 声望系统 ==========

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalSupplyEarned < MIN_PRESTIGE_SUPPLY) return 0;

    // 计算获得的末日芯片
    const chipsGained = Math.floor(
      PRESTIGE_BASE_CHIPS * Math.sqrt(this._stats.totalSupplyEarned / MIN_PRESTIGE_SUPPLY)
    );

    if (chipsGained <= 0) return 0;

    // 保存末日芯片
    this.prestige.currency += chipsGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存需要保留的数据
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalSupplyEarned: 0,
      totalClicks: 0,
      totalAmmoEarned: 0,
      totalPowerEarned: 0,
    };

    // 保存最高波次
    const savedHighestWave = this._highestWave;

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as DoomsdayStatistics;

    // 恢复最高波次
    this._highestWave = savedHighestWave;

    this.emit('prestige', chipsGained);
    this.emit('stateChange');
    return chipsGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * CHIP_BONUS_MULTIPLIER;
  }

  /**
   * 获取预览声望末日芯片数
   */
  getPrestigePreview(): number {
    if (this._stats.totalSupplyEarned < MIN_PRESTIGE_SUPPLY) return 0;
    return Math.floor(
      PRESTIGE_BASE_CHIPS * Math.sqrt(this._stats.totalSupplyEarned / MIN_PRESTIGE_SUPPLY)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalSupplyEarned >= MIN_PRESTIGE_SUPPLY;
  }

  // ========== 建筑查询 ==========

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

      // 声望加成
      production *= this.getPrestigeMultiplier();

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
    // 弹药：避难所等级 >= 3 时解锁
    const shelter = this.upgrades.get('shelter');
    if (shelter && shelter.level >= 3) {
      const ammo = this.resources.get('ammo');
      if (ammo && !ammo.unlocked) {
        ammo.unlocked = true;
        this.emit('resourceUnlocked', 'ammo');
      }
    }

    // 电力：发电站有等级时解锁
    const generator = this.upgrades.get('generator');
    if (generator && generator.level >= 1) {
      const power = this.resources.get('power');
      if (power && !power.unlocked) {
        power.unlocked = true;
        this.emit('resourceUnlocked', 'power');
      }
    }
  }

  /**
   * 更新防御力
   */
  private updateDefensePower(): void {
    let defense = 0;

    // 防御塔提供防御
    const turret = this.upgrades.get('turret');
    if (turret && turret.level > 0) {
      defense += turret.level * 3;
    }

    // 军械库提供防御
    const armory = this.upgrades.get('armory');
    if (armory && armory.level > 0) {
      defense += armory.level * 5;
    }

    // 堡垒提供防御
    const fortress = this.upgrades.get('fortress');
    if (fortress && fortress.level > 0) {
      defense += fortress.level * 20;
    }

    // 声望加成
    defense *= this.getPrestigeMultiplier();

    this._defensePower = Math.floor(defense);
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawDustParticles(ctx);
    this.drawBunker(ctx);
    this.drawFloatingTexts(ctx);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
    this.drawZombieInfo(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（末日灰暗色调）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGradient.addColorStop(0, COLORS.skyTop);
    skyGradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理（废墟碎石）
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#4A4A5A';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远处废墟建筑
    this.drawRuins(ctx, w);

    // 月亮（血月效果）
    ctx.beginPath();
    ctx.arc(60, 50, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#FF8A80';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(60, 50, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 138, 128, 0.15)';
    ctx.fill();
  }

  private drawRuins(ctx: CanvasRenderingContext2D, w: number): void {
    // 远处废墟建筑剪影
    ctx.fillStyle = COLORS.ruinColor;
    // 废墟1
    ctx.fillRect(30, 160, 25, 40);
    ctx.fillRect(35, 140, 15, 20);
    // 废墟2
    ctx.fillRect(350, 150, 30, 50);
    ctx.fillRect(355, 130, 20, 20);
    // 废墟3
    ctx.fillRect(420, 165, 20, 35);
  }

  private drawDustParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._dustParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = '#8D8D9D';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawBunker(ctx: CanvasRenderingContext2D): void {
    const cx = SCENE_DRAW.centerX;
    const cy = SCENE_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const bw = SCENE_DRAW.bunkerWidth;
    const bh = SCENE_DRAW.bunkerHeight;

    // 阴影
    ctx.beginPath();
    ctx.ellipse(4, bh * 0.6 + 4, bw * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shadowColor;
    ctx.fill();

    // 主体（混凝土色）
    ctx.fillStyle = '#5A5A6A';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

    // 屋顶
    ctx.fillStyle = '#4A4A5A';
    ctx.beginPath();
    ctx.moveTo(-bw / 2 - 5, -bh / 2);
    ctx.lineTo(0, -bh / 2 - 15);
    ctx.lineTo(bw / 2 + 5, -bh / 2);
    ctx.closePath();
    ctx.fill();

    // 门
    ctx.fillStyle = '#3A3A4A';
    ctx.fillRect(-SCENE_DRAW.doorWidth / 2, bh / 2 - SCENE_DRAW.doorHeight, SCENE_DRAW.doorWidth, SCENE_DRAW.doorHeight);

    // 门把手
    ctx.fillStyle = COLORS.accentYellow;
    ctx.beginPath();
    ctx.arc(SCENE_DRAW.doorWidth / 2 - 4, bh / 2 - SCENE_DRAW.doorHeight / 2, 2, 0, Math.PI * 2);
    ctx.fill();

    // 窗户（带灯光闪烁）
    const lightAlpha = 0.5 + this._lightFlicker * 0.5;
    ctx.fillStyle = `rgba(255, 193, 7, ${lightAlpha})`;
    ctx.fillRect(-bw / 2 + 8, -bh / 2 + 8, 12, 10);
    ctx.fillRect(bw / 2 - 20, -bh / 2 + 8, 12, 10);

    // 窗户框
    ctx.strokeStyle = '#4A4A5A';
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2 + 8, -bh / 2 + 8, 12, 10);
    ctx.strokeRect(bw / 2 - 20, -bh / 2 + 8, 12, 10);

    // 危险标志（辐射/生化）
    ctx.fillStyle = COLORS.accent;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☢', 0, -bh / 2 - 20);

    // 防御力指示
    if (this._defensePower > 0) {
      ctx.fillStyle = COLORS.accentGreen;
      ctx.font = '10px sans-serif';
      ctx.fillText(`🛡️ ${this._defensePower}`, 0, bh / 2 + 15);
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

  private drawResourcePanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panel = RESOURCE_PANEL;
    const resources = this.getUnlockedResources();

    // 背景条
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, panel.padding, panel.startY, w - panel.padding * 2, resources.length * (panel.itemHeight + panel.itemPadding) + panel.padding, 8);
    ctx.fill();

    let y = panel.startY + panel.padding;
    for (const res of resources) {
      const icon = res.id === 'supply' ? '📦' : res.id === 'ammo' ? '🔫' : '⚡';

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
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(`产出 +${this.formatNumber(building.baseProduction * level)}/s`, x + 36, y + 34);
      }

      // 费用
      if (level < building.maxLevel) {
        const costStr = Object.entries(cost)
          .map(([id, amount]) => {
            const icon = id === 'supply' ? '📦' : id === 'ammo' ? '🔫' : '⚡';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · Z 丧尸 · P 声望', w / 2, h - 10);
  }

  /** 丧尸信息显示 */
  private drawZombieInfo(ctx: CanvasRenderingContext2D, w: number): void {
    if (!this._zombieBattle.inBattle) return;

    const battle = this._zombieBattle;
    const y = 290;

    // 战斗状态背景
    ctx.fillStyle = 'rgba(183, 28, 28, 0.3)';
    this.roundRect(ctx, 10, y, w - 20, 50, 6);
    ctx.fill();

    // 丧尸图标
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🧟', 20, y + 30);

    // 波次信息
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(`波次 ${battle.currentWave} · 剩余 ${battle.zombiesRemaining}`, 50, y + 18);

    // HP 条
    const hpRatio = Math.max(0, battle.currentZombieHp / battle.maxZombieHp);
    ctx.fillStyle = '#333';
    ctx.fillRect(50, y + 25, w - 80, 8);
    ctx.fillStyle = COLORS.zombieGreen;
    ctx.fillRect(50, y + 25, (w - 80) * hpRatio, 8);
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
      case 'z':
      case 'Z':
        // 开始下一波丧尸
        this.startZombieWave(this.getNextWave());
        break;
      case 'x':
      case 'X':
        // 攻击丧尸
        this.attackZombie();
        break;
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

  getState(): DoomsdayState {
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
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
      zombieBattle: { ...this._zombieBattle },
      highestWave: this._highestWave,
      defensePower: this._defensePower,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: DoomsdayState): void {
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

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as DoomsdayStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 恢复丧尸战斗
    if (state.zombieBattle) {
      this._zombieBattle = { ...state.zombieBattle };
    }

    // 恢复最高波次
    if (state.highestWave !== undefined) {
      this._highestWave = state.highestWave;
    }

    // 重新计算产出
    this.recalculateProduction();
    this.updateDefensePower();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    // 附加末日特有数据到 settings
    data.settings = {
      stats: this._stats,
      selectedIndex: this._selectedIndex,
      zombieBattle: this._zombieBattle,
      highestWave: this._highestWave,
      defensePower: this._defensePower,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as any;
      if (settings.stats) {
        this._stats = { ...settings.stats } as DoomsdayStatistics;
      }
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex;
      }
      if (settings.zombieBattle) {
        this._zombieBattle = { ...settings.zombieBattle };
      }
      if (settings.highestWave !== undefined) {
        this._highestWave = settings.highestWave;
      }
      if (settings.defensePower !== undefined) {
        this._defensePower = settings.defensePower;
      }
    }

    // 重新计算
    this.recalculateProduction();
    this.updateDefensePower();
  }
}
