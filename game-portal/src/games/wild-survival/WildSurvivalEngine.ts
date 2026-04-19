/**
 * 野外求生 (Wild Survival) — 放置类游戏引擎
 *
 * 继承 IdleGameEngine，实现：
 * - 三资源系统（石头/食物/毛皮）
 * - 建筑升级系统（8种建筑）
 * - 季节系统（春夏秋冬循环影响产出）
 * - 生存技能树（6种技能）
 * - 声望重置系统（远古智慧）
 * - Canvas 荒野风格渲染
 * - 离线收益
 * - 自动存档
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import type { Resource, Upgrade, SaveData } from '@/types/idle';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  STONE_PER_CLICK,
  WISDOM_BONUS_MULTIPLIER,
  PRESTIGE_BASE_WISDOM,
  MIN_PRESTIGE_STONE,
  BUILDINGS,
  SKILLS,
  COLORS,
  CAMP_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  SEASON_PANEL,
  SEASON_ORDER,
  SEASON_NAMES,
  SEASON_ICONS,
  SEASON_MULTIPLIERS,
  SEASON_DURATION,
  type Season,
  type BuildingDef,
  type SkillDef,
} from './constants';

/** 技能状态 */
export interface SkillState {
  id: string;
  level: number;
}

/** 游戏统计 */
export interface WildSurvivalStatistics {
  totalStoneEarned: number;
  totalClicks: number;
  totalFoodEarned: number;
  totalFurEarned: number;
  totalPrestigeCount: number;
  totalSkillsLearned: number;
  totalSeasonsSurvived: number;
}

/** 野外求生游戏状态 */
export interface WildSurvivalState {
  [key: string]: unknown;
  resources: Record<string, { amount: number; perSecond: number; unlocked: boolean }>;
  buildings: Record<string, number>;
  skills: SkillState[];
  prestige: { currency: number; count: number };
  statistics: WildSurvivalStatistics;
  selectedIndex: number;
  season: Season;
  seasonProgress: number;
}

export class WildSurvivalEngine extends IdleGameEngine {
  // ========== 游戏状态 ==========

  protected _gameId = 'wild-survival';

  constructor() {
    super();
    Object.defineProperty(this, 'statistics', {
      get: () => ({ ...this._stats }) as WildSurvivalStatistics,
      set: (_val: Record<string, number>) => { /* base class writes are no-ops */ },
      configurable: true,
      enumerable: true,
    });
  }

  /** 技能状态 */
  private _skills: SkillState[] = SKILLS.map((s) => ({
    id: s.id,
    level: 0,
  }));

  /** 当前选中的建筑索引 */
  private _selectedIndex: number = 0;

  /** 当前季节 */
  private _season: Season = 'spring';

  /** 季节进度（0-1） */
  private _seasonProgress: number = 0;

  /** 季节计时器 */
  private _seasonTimer: number = 0;

  /** 统计数据 */
  private _stats: WildSurvivalStatistics = {
    totalStoneEarned: 0,
    totalClicks: 0,
    totalFoodEarned: 0,
    totalFurEarned: 0,
    totalPrestigeCount: 0,
    totalSkillsLearned: 0,
    totalSeasonsSurvived: 0,
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

  /** 火焰粒子 */
  private _fireParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
  }> = [];

  /** 营火动画计时器 */
  private _fireAnimTimer: number = 0;
  /** 营火闪烁 */
  private _fireFlicker: number = 0;
  /** 点击缩放效果 */
  private _clickScale: number = 1;
  private _clickAnimTimer: number = 0;
  /** 树木摇摆 */
  private _treeSway: number = 0;
  /** 雪花粒子（冬季） */
  private _snowParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
  }> = [];

  // ========== 公开属性 ==========

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get skills(): SkillState[] {
    return this._skills.map((s) => ({ ...s }));
  }

  get season(): Season {
    return this._season;
  }

  get seasonProgress(): number {
    return this._seasonProgress;
  }

  get totalStoneEarned(): number {
    return this._stats.totalStoneEarned;
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
        id: 'stone',
        name: '石头',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e15,
        unlocked: true,
      },
      {
        id: 'food',
        name: '食物',
        amount: 0,
        perSecond: 0,
        maxAmount: 1e12,
        unlocked: false,
      },
      {
        id: 'fur',
        name: '毛皮',
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
        unlocked: b.id === 'campfire',
        requires: b.requires,
        icon: b.icon,
      }))
    );

    // 重置状态
    this._skills = SKILLS.map((s) => ({
      id: s.id,
      level: 0,
    }));
    this._selectedIndex = 0;
    this._season = 'spring';
    this._seasonProgress = 0;
    this._seasonTimer = 0;
    this._stats = {
      totalStoneEarned: 0,
      totalClicks: 0,
      totalFoodEarned: 0,
      totalFurEarned: 0,
      totalPrestigeCount: 0,
      totalSkillsLearned: 0,
      totalSeasonsSurvived: 0,
    };
    this._floatingTexts = [];
    this._fireParticles = [];
    this._fireAnimTimer = 0;
    this._fireFlicker = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._treeSway = 0;
    this._snowParticles = [];
  }

  protected onUpdate(deltaTime: number): void {
    // 营火动画
    this._fireAnimTimer += deltaTime;
    this._fireFlicker = Math.sin(this._fireAnimTimer * 0.01) * 3;

    // 树木摇摆
    this._treeSway = Math.sin(this._fireAnimTimer * 0.002) * 2;

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

    // 火焰粒子更新
    this._fireParticles = this._fireParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0;
    });

    // 随机产生火焰粒子
    if (Math.random() < 0.05) {
      this._fireParticles.push({
        x: CAMP_DRAW.centerX + (Math.random() - 0.5) * 10,
        y: CAMP_DRAW.centerY + 20,
        vx: (Math.random() - 0.5) * 10,
        vy: -15 - Math.random() * 20,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
      });
    }

    // 冬季雪花粒子
    if (this._season === 'winter') {
      if (Math.random() < 0.1) {
        this._snowParticles.push({
          x: Math.random() * CANVAS_WIDTH,
          y: -5,
          vx: (Math.random() - 0.5) * 20,
          vy: 30 + Math.random() * 30,
          life: 5000,
        });
      }
    }
    this._snowParticles = this._snowParticles.filter((p) => {
      p.life -= deltaTime;
      p.x += p.vx * (deltaTime / 1000);
      p.y += p.vy * (deltaTime / 1000);
      return p.life > 0 && p.y < CANVAS_HEIGHT;
    });

    // 季节更新
    this._seasonTimer += deltaTime;
    this._seasonProgress = this._seasonTimer / SEASON_DURATION;
    if (this._seasonTimer >= SEASON_DURATION) {
      this._seasonTimer = 0;
      this._seasonProgress = 0;
      const currentIdx = SEASON_ORDER.indexOf(this._season);
      const nextIdx = (currentIdx + 1) % SEASON_ORDER.length;
      this._season = SEASON_ORDER[nextIdx];
      this._stats.totalSeasonsSurvived++;
      this.emit('seasonChange', this._season);
    }

    // 统计资源产出
    const stone = this.getResource('stone');
    if (stone && stone.perSecond > 0) {
      this._stats.totalStoneEarned += stone.perSecond * (deltaTime / 1000);
    }
    const food = this.getResource('food');
    if (food && food.perSecond > 0) {
      this._stats.totalFoodEarned += food.perSecond * (deltaTime / 1000);
    }
    const fur = this.getResource('fur');
    if (fur && fur.perSecond > 0) {
      this._stats.totalFurEarned += fur.perSecond * (deltaTime / 1000);
    }

    // 检查建筑解锁条件
    this.checkBuildingUnlocks();
    // 检查资源解锁条件
    this.checkResourceUnlocks();
  }

  // ========== 核心玩法 ==========

  /**
   * 点击获得石头
   */
  click(): number {
    if (this._status !== 'playing') return 0;

    let gained = STONE_PER_CLICK;

    // 技能点击加成
    gained *= this.getClickMultiplier();

    // 声望加成
    gained *= this.getPrestigeMultiplier();

    gained = Math.floor(gained * 100) / 100;

    this.addResource('stone', gained);
    this._stats.totalStoneEarned += gained;
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
      x: CAMP_DRAW.centerX + Math.cos(angle) * dist,
      y: CAMP_DRAW.centerY + Math.sin(angle) * dist - 30,
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
   * 学习技能
   */
  learnSkill(skillId: string): boolean {
    const skillDef = SKILLS.find((s) => s.id === skillId);
    if (!skillDef) return false;

    const skillState = this._skills.find((s) => s.id === skillId);
    if (!skillState) return false;

    if (skillState.level >= skillDef.maxLevel) return false;

    // 检查前置技能
    if (skillDef.requires) {
      for (const reqId of skillDef.requires) {
        const req = this._skills.find((s) => s.id === reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    // 计算费用
    const cost = this.getSkillCost(skillId);
    if (!this.hasResource('stone', cost)) return false;

    this.spendResource('stone', cost);
    skillState.level++;
    this._stats.totalSkillsLearned++;

    // 重新计算产出
    this.recalculateProduction();

    this.emit('skillLearned', skillId, skillState.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取技能费用
   */
  getSkillCost(skillId: string): number {
    const skillDef = SKILLS.find((s) => s.id === skillId);
    const skillState = this._skills.find((s) => s.id === skillId);
    if (!skillDef || !skillState) return Infinity;
    return Math.floor(skillDef.cost * Math.pow(skillDef.costMultiplier, skillState.level));
  }

  /**
   * 获取技能等级
   */
  getSkillLevel(skillId: string): number {
    const skill = this._skills.find((s) => s.id === skillId);
    return skill ? skill.level : 0;
  }

  /**
   * 声望重置
   */
  doPrestige(): number {
    if (this._stats.totalStoneEarned < MIN_PRESTIGE_STONE) return 0;

    // 计算获得的远古智慧
    const wisdomGained = Math.floor(
      PRESTIGE_BASE_WISDOM * Math.sqrt(this._stats.totalStoneEarned / MIN_PRESTIGE_STONE)
    );

    if (wisdomGained <= 0) return 0;

    // 保存远古智慧
    this.prestige.currency += wisdomGained;
    this.prestige.count++;
    this._stats.totalPrestigeCount++;

    // 保存技能等级（声望保留技能）
    const savedSkills = this._skills.map((s) => ({
      id: s.id,
      level: s.level,
    }));

    // 保存声望和部分统计
    const savedPrestige = { ...this.prestige };
    const savedStats = {
      ...this._stats,
      totalStoneEarned: 0,
      totalClicks: 0,
      totalFoodEarned: 0,
      totalFurEarned: 0,
    };

    // 重置
    this.onInit();

    // 恢复声望和部分统计
    this.prestige = savedPrestige;
    this._stats = savedStats as WildSurvivalStatistics;

    // 恢复技能等级
    for (const saved of savedSkills) {
      const skill = this._skills.find((s) => s.id === saved.id);
      if (skill) {
        skill.level = saved.level;
      }
    }

    this.emit('prestige', wisdomGained);
    this.emit('stateChange');
    return wisdomGained;
  }

  /**
   * 获取声望加成倍率
   */
  getPrestigeMultiplier(): number {
    return 1 + this.prestige.currency * WISDOM_BONUS_MULTIPLIER;
  }

  /**
   * 获取点击加成倍率
   */
  getClickMultiplier(): number {
    let multiplier = 1;
    for (const skill of this._skills) {
      if (skill.level <= 0) continue;
      const def = SKILLS.find((s) => s.id === skill.id);
      if (!def) continue;
      if (def.type === 'click' || def.type === 'all') {
        multiplier += def.bonusPerLevel * skill.level;
      }
    }
    return multiplier;
  }

  /**
   * 获取生产加成倍率
   */
  getProductionMultiplier(): number {
    let multiplier = 1;
    for (const skill of this._skills) {
      if (skill.level <= 0) continue;
      const def = SKILLS.find((s) => s.id === skill.id);
      if (!def) continue;
      if (def.type === 'production' || def.type === 'all') {
        multiplier += def.bonusPerLevel * skill.level;
      }
    }
    // 声望加成
    multiplier *= this.getPrestigeMultiplier();
    return multiplier;
  }

  /**
   * 获取季节产出倍率
   */
  getSeasonMultiplier(): number {
    let multiplier = SEASON_MULTIPLIERS[this._season];

    // 冬季减免技能
    if (this._season === 'winter') {
      const winterCraft = this._skills.find((s) => s.id === 'winter_craft');
      if (winterCraft && winterCraft.level > 0) {
        const def = SKILLS.find((s) => s.id === 'winter_craft')!;
        const reduction = def.bonusPerLevel * winterCraft.level;
        // 冬季惩罚从 0.6 提升到 0.6 + reduction（但不超过1.0）
        multiplier = Math.min(1.0, multiplier + reduction);
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
   * 获取预览声望远古智慧数
   */
  getPrestigePreview(): number {
    if (this._stats.totalStoneEarned < MIN_PRESTIGE_STONE) return 0;
    return Math.floor(
      PRESTIGE_BASE_WISDOM * Math.sqrt(this._stats.totalStoneEarned / MIN_PRESTIGE_STONE)
    );
  }

  /**
   * 检查是否可以声望
   */
  canPrestige(): boolean {
    return this._stats.totalStoneEarned >= MIN_PRESTIGE_STONE;
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
      if (building.productionResource === 'stone') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'food') {
        production *= this.getProductionMultiplier();
      } else if (building.productionResource === 'fur') {
        production *= this.getProductionMultiplier();
      }

      // 季节加成
      production *= this.getSeasonMultiplier();

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
    // 食物：庇护所等级 >= 1 时解锁
    const shelter = this.upgrades.get('shelter');
    if (shelter && shelter.level >= 1) {
      const food = this.resources.get('food');
      if (food && !food.unlocked) {
        food.unlocked = true;
        this.emit('resourceUnlocked', 'food');
      }
    }

    // 毛皮：陷阱等级 >= 1 时解锁
    const trap = this.upgrades.get('trap');
    if (trap && trap.level >= 1) {
      const fur = this.resources.get('fur');
      if (fur && !fur.unlocked) {
        fur.unlocked = true;
        this.emit('resourceUnlocked', 'fur');
      }
    }
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawFireParticles(ctx);
    this.drawCampsite(ctx);
    this.drawFloatingTexts(ctx);
    this.drawSeasonPanel(ctx, w);
    this.drawResourcePanel(ctx, w);
    this.drawBuildingList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变（根据季节变化）
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    if (this._season === 'winter') {
      skyGradient.addColorStop(0, '#4A5568');
      skyGradient.addColorStop(1, '#718096');
    } else if (this._season === 'autumn') {
      skyGradient.addColorStop(0, '#5D4037');
      skyGradient.addColorStop(1, '#8D6E63');
    } else if (this._season === 'summer') {
      skyGradient.addColorStop(0, '#1565C0');
      skyGradient.addColorStop(1, '#42A5F5');
    } else {
      skyGradient.addColorStop(0, COLORS.skyTop);
      skyGradient.addColorStop(1, COLORS.skyBottom);
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h * 0.5);

    // 地面渐变
    const groundGradient = ctx.createLinearGradient(0, h * 0.45, 0, h);
    groundGradient.addColorStop(0, COLORS.groundLight);
    groundGradient.addColorStop(1, COLORS.groundDark);
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);

    // 地面纹理
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = h * 0.45 + ((i * 47 + 23) % (h * 0.55));
      ctx.fillStyle = '#1B3A2D';
      ctx.fillRect(x, y, 3, 2);
    }
    ctx.globalAlpha = 1;

    // 远处的山
    ctx.fillStyle = COLORS.mountainColor;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.quadraticCurveTo(80, h * 0.32, 160, h * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(200, h * 0.5);
    ctx.quadraticCurveTo(300, h * 0.28, 380, h * 0.5);
    ctx.fill();

    // 树木
    this.drawTree(ctx, 50, h * 0.44);
    this.drawTree(ctx, 130, h * 0.46);
    this.drawTree(ctx, 350, h * 0.43);
    this.drawTree(ctx, 420, h * 0.45);

    // 太阳/月亮
    if (this._season === 'winter') {
      // 冬季月亮
      ctx.beginPath();
      ctx.arc(60, 50, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#CFD8DC';
      ctx.fill();
    } else {
      // 太阳
      ctx.beginPath();
      ctx.arc(60, 50, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF176';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(60, 50, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 241, 118, 0.15)';
      ctx.fill();
    }

    // 冬季雪花
    if (this._season === 'winter') {
      for (const p of this._snowParticles) {
        ctx.globalAlpha = Math.min(1, p.life / 2000);
        ctx.fillStyle = COLORS.snowColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const sway = this._treeSway;

    // 树干
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(x - 3, y, 6, 20);

    // 树冠
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway * 0.01);

    if (this._season === 'winter') {
      ctx.fillStyle = '#78909C';
    } else if (this._season === 'autumn') {
      ctx.fillStyle = '#E65100';
    } else {
      ctx.fillStyle = COLORS.treeGreen;
    }
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(0, -30);
    ctx.lineTo(15, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-12, -12);
    ctx.lineTo(0, -40);
    ctx.lineTo(12, -12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawFireParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._fireParticles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.fireColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCampsite(ctx: CanvasRenderingContext2D): void {
    const cx = CAMP_DRAW.centerX;
    const cy = CAMP_DRAW.centerY;
    const scale = this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 帐篷阴影
    ctx.beginPath();
    ctx.ellipse(4, CAMP_DRAW.tentHeight * 0.6 + 4, CAMP_DRAW.tentWidth * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // 帐篷
    ctx.beginPath();
    ctx.moveTo(-CAMP_DRAW.tentWidth * 0.5, CAMP_DRAW.tentHeight * 0.5);
    ctx.lineTo(0, -CAMP_DRAW.tentHeight * 0.5);
    ctx.lineTo(CAMP_DRAW.tentWidth * 0.5, CAMP_DRAW.tentHeight * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#8D6E63';
    ctx.fill();
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 帐篷门
    ctx.beginPath();
    ctx.moveTo(-8, CAMP_DRAW.tentHeight * 0.5);
    ctx.lineTo(0, CAMP_DRAW.tentHeight * 0.1);
    ctx.lineTo(8, CAMP_DRAW.tentHeight * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#5D4037';
    ctx.fill();

    // 营火（帐篷下方）
    const fireY = CAMP_DRAW.tentHeight * 0.5 + 25 + this._fireFlicker;

    // 营火光晕
    ctx.beginPath();
    ctx.arc(0, fireY, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 111, 0, 0.15)';
    ctx.fill();

    // 营火火焰
    ctx.beginPath();
    ctx.moveTo(-CAMP_DRAW.fireRadius, fireY + 5);
    ctx.quadraticCurveTo(-CAMP_DRAW.fireRadius * 0.5, fireY - 15, 0, fireY - 20);
    ctx.quadraticCurveTo(CAMP_DRAW.fireRadius * 0.5, fireY - 15, CAMP_DRAW.fireRadius, fireY + 5);
    ctx.fillStyle = '#FF6F00';
    ctx.fill();

    // 内焰
    ctx.beginPath();
    ctx.moveTo(-CAMP_DRAW.fireRadius * 0.5, fireY + 3);
    ctx.quadraticCurveTo(-CAMP_DRAW.fireRadius * 0.2, fireY - 8, 0, fireY - 12);
    ctx.quadraticCurveTo(CAMP_DRAW.fireRadius * 0.2, fireY - 8, CAMP_DRAW.fireRadius * 0.5, fireY + 3);
    ctx.fillStyle = '#FFB300';
    ctx.fill();

    // 木柴
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(-12, fireY + 3, 24, 4);
    ctx.save();
    ctx.rotate(0.3);
    ctx.fillRect(-8, fireY + 1, 16, 3);
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

  private drawSeasonPanel(ctx: CanvasRenderingContext2D, w: number): void {
    const panel = SEASON_PANEL;

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.roundRect(ctx, panel.x, panel.y, panel.width, panel.height, 6);
    ctx.fill();

    // 季节图标和名称
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(`${SEASON_ICONS[this._season]} ${SEASON_NAMES[this._season]}`, panel.x + 8, panel.y + 19);

    // 进度条
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(panel.x + 8, panel.y + 22, panel.width - 16, 3);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(panel.x + 8, panel.y + 22, (panel.width - 16) * this._seasonProgress, 3);
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
      const icon = res.id === 'stone' ? '🪨' : res.id === 'food' ? '🍖' : '🦊';

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
            const icon = id === 'stone' ? '🪨' : id === 'food' ? '🍖' : '🦊';
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
    ctx.fillText('空格 点击 · ↑↓ 选择 · Enter 购买 · S 技能 · P 声望', w / 2, h - 10);
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
      case 's':
      case 'S':
        // 学习第一个可学习的技能
        {
          for (const skill of this._skills) {
            const def = SKILLS.find((s) => s.id === skill.id);
            if (!def) continue;
            if (skill.level >= def.maxLevel) continue;
            // 检查前置
            if (def.requires) {
              const met = def.requires.every((reqId) => {
                const req = this._skills.find((s) => s.id === reqId);
                return req && req.level > 0;
              });
              if (!met) continue;
            }
            const cost = this.getSkillCost(skill.id);
            if (this.hasResource('stone', cost)) {
              this.learnSkill(skill.id);
              break;
            }
          }
        }
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

  getState(): WildSurvivalState {
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
      skills: this.skills,
      prestige: { ...this.prestige },
      statistics: { ...this._stats },
      selectedIndex: this._selectedIndex,
      season: this._season,
      seasonProgress: this._seasonProgress,
    };
  }

  /**
   * 从状态恢复
   */
  loadState(state: WildSurvivalState): void {
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

    // 恢复技能
    if (state.skills) {
      for (const skillState of state.skills) {
        const mySkill = this._skills.find((s) => s.id === skillState.id);
        if (mySkill) {
          mySkill.level = skillState.level;
        }
      }
    }

    // 恢复声望
    if (state.prestige) {
      this.prestige = { ...state.prestige };
    }

    // 恢复统计
    if (state.statistics) {
      this._stats = { ...state.statistics } as WildSurvivalStatistics;
    }

    // 恢复选中
    if (state.selectedIndex !== undefined) {
      this._selectedIndex = state.selectedIndex;
    }

    // 恢复季节
    if (state.season) {
      this._season = state.season;
    }

    // 恢复季节进度
    if (state.seasonProgress !== undefined) {
      this._seasonProgress = state.seasonProgress;
    }

    // 重新计算产出
    this.recalculateProduction();

    this.emit('stateChange');
  }

  // ========== 存档覆盖 ==========

  save(): SaveData {
    const data = super.save();
    data.settings = {
      skills: this._skills,
      stats: this._stats,
      selectedIndex: this._selectedIndex,
      season: this._season,
      seasonProgress: this._seasonProgress,
      seasonTimer: this._seasonTimer,
    };
    return data;
  }

  load(data: SaveData): void {
    super.load(data);

    // 恢复附加数据
    if (data.settings) {
      const settings = data.settings as any;
      if (settings.skills) {
        for (const skillState of settings.skills) {
          const mySkill = this._skills.find((s) => s.id === skillState.id);
          if (mySkill) {
            mySkill.level = skillState.level;
          }
        }
      }
      if (settings.stats) {
        this._stats = { ...this._stats, ...settings.stats };
      }
      if (settings.selectedIndex !== undefined) {
        this._selectedIndex = settings.selectedIndex;
      }
      if (settings.season) {
        this._season = settings.season;
      }
      if (settings.seasonProgress !== undefined) {
        this._seasonProgress = settings.seasonProgress;
      }
      if (settings.seasonTimer !== undefined) {
        this._seasonTimer = settings.seasonTimer;
      }
    }

    this.recalculateProduction();
  }
}
