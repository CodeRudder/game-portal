/**
 * 三国霸业 — 引擎主类（应用层/编排层）
 *
 * 职责：编排各子系统，协调业务流程
 * 规则：不包含具体业务逻辑，只做编排
 *
 * 基础设施依赖（core/ 层）：
 *   - EventBus：事件总线，替代内嵌实现
 *   - SubsystemRegistry：子系统注册/查找
 *   - SaveManager：存档管理器
 *
 * 拆分：
 *   - engine-tick.ts — tick 内部逻辑
 *   - engine-save.ts — 存档相关逻辑
 */

import { ResourceSystem } from './resource/ResourceSystem';
import { BuildingSystem } from './building/BuildingSystem';
import { CalendarSystem } from './calendar/CalendarSystem';
import { HeroSystem } from './hero/HeroSystem';
import { HeroRecruitSystem, type RecruitOutput } from './hero/HeroRecruitSystem';
import { HeroLevelSystem, type LevelUpResult, type BatchEnhanceResult, type EnhancePreview } from './hero/HeroLevelSystem';
import { HeroFormation, type FormationData, type FormationSaveData } from './hero/HeroFormation';
import type { Bonuses, CapWarning, OfflineEarnings } from './resource/resource.types';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from './building/building.types';
import type {
  EngineEventType, EngineEventMap, EventListener, GameSaveData, EngineSnapshot,
} from '../shared/types';
import type { GeneralData } from './hero/hero.types';
import type { RecruitType } from './hero/hero-recruit-config';
import { AUTO_SAVE_INTERVAL_SECONDS, SAVE_KEY, ENGINE_SAVE_VERSION } from '../shared/constants';

import type { IGameState } from '../core/types/state';
import type { ISystemDeps } from '../core/types/subsystem';
import { EventBus } from '../core/events/EventBus';
import { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import { SaveManager } from '../core/save/SaveManager';
import { ConfigRegistry } from '../core/config/ConfigRegistry';

// 拆分模块
import { executeTick, syncBuildingToResource, type TickContext } from './engine-tick';
import {
  buildSaveData, toIGameState, applyLoadedState,
  tryLoadLegacyFormat, applyLegacyState, applyDeserialize,
  type SaveContext,
} from './engine-save';
import { initHeroSystems, type HeroSystems } from './engine-hero-deps';

// ─────────────────────────────────────────────
// ThreeKingdomsEngine
// ─────────────────────────────────────────────

export class ThreeKingdomsEngine {
  // ── 子系统 ──
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;
  readonly calendar: CalendarSystem;
  readonly hero: HeroSystem;
  readonly heroRecruit: HeroRecruitSystem;
  readonly heroLevel: HeroLevelSystem;
  private readonly heroFormation: HeroFormation;

  // ── core/ 基础设施 ──
  private readonly bus: EventBus;
  private readonly registry: SubsystemRegistry;
  private readonly saveManager: SaveManager;
  private readonly configRegistry: ConfigRegistry;

  // ── 时间管理 ──
  private initialized = false;
  private onlineSeconds = 0;
  private lastTickTime = 0;
  private autoSaveAccumulator = 0;

  // ── 变化检测缓存 ──
  private prevResourcesJson = '';
  private prevRatesJson = '';

  constructor() {
    this.resource = new ResourceSystem();
    this.building = new BuildingSystem();
    this.calendar = new CalendarSystem();
    this.hero = new HeroSystem();
    this.heroRecruit = new HeroRecruitSystem();
    this.heroLevel = new HeroLevelSystem();
    this.heroFormation = new HeroFormation();

    // 初始化 core/ 基础设施
    this.bus = new EventBus();
    this.registry = new SubsystemRegistry();
    this.configRegistry = new ConfigRegistry();

    this.configRegistry.set('SAVE_KEY', SAVE_KEY);
    this.configRegistry.set('SAVE_VERSION', String(ENGINE_SAVE_VERSION));

    this.saveManager = new SaveManager(this.configRegistry);

    // 注册子系统
    this.registry.register('resource', this.resource as any);
    this.registry.register('building', this.building as any);
    this.registry.register('calendar', this.calendar as any);
    this.registry.register('hero', this.hero as any);
    this.registry.register('heroRecruit', this.heroRecruit as any);
    this.registry.register('heroLevel', this.heroLevel as any);
    this.registry.register('heroFormation', this.heroFormation as any);
  }

  // ── 初始化 ──

  /** 初始化引擎（新游戏） */
  init(): void {
    if (this.initialized) return;

    syncBuildingToResource(this.buildTickCtx());

    // 初始化子系统依赖
    const deps: ISystemDeps = {
      eventBus: this.bus,
      config: this.configRegistry,
      registry: this.registry,
    };
    this.calendar.init(deps);

    // 初始化武将子系统（含资源回调注入）
    this.initHeroSystems(deps);

    this.initialized = true;
    this.lastTickTime = Date.now();
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;

    this.bus.emit('game:initialized', { isNewGame: true });
  }

  // ── 游戏循环 ──

  /** 驱动所有子系统更新 */
  tick(deltaMs?: number): void {
    if (!this.initialized) return;

    const now = Date.now();
    const dt = deltaMs ?? (now - this.lastTickTime);
    this.lastTickTime = now;
    const dtSec = dt / 1000;

    // 委托给 engine-tick
    const ctx = this.buildTickCtx();
    executeTick(ctx, dtSec);
    this.syncTickCtx(ctx);

    // 自动保存累加
    this.autoSaveAccumulator += dtSec;
    if (this.autoSaveAccumulator >= AUTO_SAVE_INTERVAL_SECONDS) {
      this.autoSaveAccumulator = 0;
      this.save();
    }

    // 在线时长
    this.onlineSeconds += dtSec;
  }

  // ── 建筑升级 ──

  /** 检查建筑是否可升级 */
  checkUpgrade(type: BuildingType): UpgradeCheckResult {
    return this.building.checkUpgrade(type, this.resource.getResources());
  }

  /** 获取升级费用 */
  getUpgradeCost(type: BuildingType): UpgradeCost | null {
    return this.building.getUpgradeCost(type);
  }

  /** 执行建筑升级 */
  upgradeBuilding(type: BuildingType): void {
    const resources = this.resource.getResources();
    const check = this.building.checkUpgrade(type, resources);
    if (!check.canUpgrade) {
      throw new Error(`无法升级 ${type}：${check.reasons.join('；')}`);
    }
    const cost = this.building.getUpgradeCost(type);
    if (!cost) throw new Error(`无法获取 ${type} 的升级费用`);

    this.resource.consumeBatch({
      grain: cost.grain,
      gold: cost.gold,
      troops: cost.troops,
    });
    this.building.startUpgrade(type, resources);

    this.bus.emit('building:upgrade-start', { type, cost });
    this.bus.emit('resource:changed', { resources: this.resource.getResources() });
  }

  /** 取消建筑升级，返还80%费用 */
  cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const refund = this.building.cancelUpgrade(type);
    if (!refund) return null;

    if (refund.grain > 0) this.resource.addResource('grain', refund.grain);
    if (refund.gold > 0) this.resource.addResource('gold', refund.gold);
    if (refund.troops > 0) this.resource.addResource('troops', refund.troops);

    this.bus.emit('resource:changed', { resources: this.resource.getResources() });
    return refund;
  }

  // ── 存档 / 读档 ──

  /** 保存游戏 */
  save(): void {
    const data = buildSaveData(this.buildSaveCtx());
    const state: IGameState = toIGameState(data, this.onlineSeconds);
    const ok = this.saveManager.save(state);

    if (ok) {
      this.resource.touchSaveTime();
      this.bus.emit('game:saved', { timestamp: data.saveTime });
    } else {
      console.error('ThreeKingdomsEngine.save 失败: SaveManager.save 返回 false');
    }
  }

  /** 从存档加载，计算离线收益 */
  load(): OfflineEarnings | null {
    const ctx = this.buildSaveCtx();

    // 优先尝试 SaveManager 新格式
    const state = this.saveManager.load();
    if (state) {
      const result = applyLoadedState(ctx, state);
      this.finalizeLoad();
      return result;
    }

    // 向后兼容旧格式
    const legacyData = tryLoadLegacyFormat();
    if (legacyData) {
      const result = applyLegacyState(ctx, legacyData);
      this.finalizeLoad();
      return result;
    }

    return null;
  }

  /** 序列化为 JSON 字符串（不写入 localStorage） */
  serialize(): string {
    return JSON.stringify(buildSaveData(this.buildSaveCtx()));
  }

  /** 从 JSON 字符串反序列化 */
  deserialize(json: string): void {
    applyDeserialize(this.buildSaveCtx(), json);
    const deps: ISystemDeps = {
      eventBus: this.bus,
      config: this.configRegistry,
      registry: this.registry,
    };
    this.initHeroSystems(deps);
    this.initialized = true;
    this.lastTickTime = Date.now();
  }

  /** 检查是否存在存档 */
  hasSaveData(): boolean {
    return this.saveManager.hasSaveData();
  }

  /** 清除存档并重置引擎 */
  reset(): void {
    this.resource.reset();
    this.building.reset();
    this.calendar.reset();
    this.hero.reset();
    this.heroRecruit.reset();
    this.heroLevel.reset();
    this.heroFormation.reset();
    this.initialized = false;
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;
    this.prevResourcesJson = '';
    this.prevRatesJson = '';
    this.saveManager.deleteSave();
    this.bus.removeAllListeners();
  }

  // ── 事件系统 ──

  on<T extends EngineEventType>(event: T, listener: EventListener<EngineEventMap[T]>): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: string, listener: (...args: any[]) => void): void {
    this.bus.on(event, listener);
  }

  once<T extends EngineEventType>(event: T, listener: EventListener<EngineEventMap[T]>): void {
    this.bus.once(event, listener);
  }

  off<T extends EngineEventType>(event: T, listener: EventListener<EngineEventMap[T]>): void {
    this.bus.off(event, listener);
  }

  // ── 状态查询 ──

  /** 获取引擎状态快照 */
  getSnapshot(): EngineSnapshot {
    return {
      resources: this.resource.getResources(),
      productionRates: this.resource.getProductionRates(),
      caps: this.resource.getCaps(),
      buildings: this.building.getAllBuildings(),
      onlineSeconds: this.onlineSeconds,
      calendar: this.calendar.getState(),
      heroes: this.hero.getAllGenerals(),
      heroFragments: this.hero.getAllFragments(),
      totalPower: this.hero.calculateTotalPower(),
      formations: this.heroFormation.getAllFormations(),
      activeFormationId: this.heroFormation.getActiveFormationId(),
    };
  }

  getOnlineSeconds(): number { return this.onlineSeconds; }
  isInitialized(): boolean { return this.initialized; }
  getCapWarnings(): CapWarning[] { return this.resource.getCapWarnings(); }
  getUpgradeProgress(type: BuildingType): number { return this.building.getUpgradeProgress(type); }
  getUpgradeRemainingTime(type: BuildingType): number { return this.building.getUpgradeRemainingTime(type); }

  // ── 武将系统 API ──

  /** 获取武将系统实例 */
  getHeroSystem(): HeroSystem { return this.hero; }

  /** 获取招募系统实例 */
  getRecruitSystem(): HeroRecruitSystem { return this.heroRecruit; }
  /** 获取升级系统实例 */
  getLevelSystem(): HeroLevelSystem { return this.heroLevel; }
  /** 获取编队系统实例 */
  getFormationSystem(): HeroFormation { return this.heroFormation; }

  /** 获取所有编队 */
  getFormations(): FormationData[] { return this.heroFormation.getAllFormations(); }
  /** 获取当前激活编队 */
  getActiveFormation(): FormationData | null { return this.heroFormation.getActiveFormation(); }
  /** 创建新编队 */
  createFormation(id?: string): FormationData | null { return this.heroFormation.createFormation(id); }

  /** 设置编队武将列表 */
  setFormation(id: string, generalIds: string[]): FormationData | null {
    return this.heroFormation.setFormation(id, generalIds);
  }

  /** 向编队添加武将 */
  addToFormation(formationId: string, generalId: string): FormationData | null {
    return this.heroFormation.addToFormation(formationId, generalId);
  }

  /** 从编队移除武将 */
  removeFromFormation(formationId: string, generalId: string): FormationData | null {
    return this.heroFormation.removeFromFormation(formationId, generalId);
  }

  /**
   * 招募武将
   * @param type  - 招募类型 ('normal' | 'advanced')
   * @param count - 招募次数（1 或 10）
   */
  recruit(type: RecruitType, count: 1 | 10 = 1): RecruitOutput | null {
    return count === 10
      ? this.heroRecruit.recruitTen(type)
      : this.heroRecruit.recruitSingle(type);
  }

  /** 一键强化武将到目标等级 */
  enhanceHero(generalId: string, targetLevel?: number): LevelUpResult | null {
    return this.heroLevel.quickEnhance(generalId, targetLevel);
  }

  /** 一键强化全部武将 */
  enhanceAllHeroes(targetLevel?: number): BatchEnhanceResult {
    return this.heroLevel.quickEnhanceAll(targetLevel);
  }

  /** 获取所有已拥有武将 */
  getGenerals(): Readonly<GeneralData>[] {
    return this.hero.getAllGenerals();
  }

  /** 获取单个武将 */
  getGeneral(id: string): Readonly<GeneralData> | undefined {
    return this.hero.getGeneral(id);
  }

  /** 获取招募历史记录 */
  getRecruitHistory() {
    return this.heroRecruit.getRecruitHistory();
  }

  /** 获取碎片合成进度 */
  getSynthesizeProgress(generalId: string): { current: number; required: number } {
    return this.hero.getSynthesizeProgress(generalId);
  }

  /** 获取强化预览 */
  getEnhancePreview(generalId: string, targetLevel: number): EnhancePreview | null {
    return this.heroLevel.getEnhancePreview(generalId, targetLevel);
  }

  // ═══════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════

  /** 获取武将子系统集合 */
  private get heroSystems(): HeroSystems {
    return { hero: this.hero, heroRecruit: this.heroRecruit, heroLevel: this.heroLevel };
  }

  /** 初始化武将子系统（委托给 engine-hero-deps） */
  private initHeroSystems(deps: ISystemDeps): void {
    initHeroSystems(this.heroSystems, this.resource, deps);
  }

  /** 构建 tick 上下文 */
  private buildTickCtx(): TickContext {
    return {
      resource: this.resource,
      building: this.building,
      calendar: this.calendar,
      hero: this.hero,
      bus: this.bus,
      prevResourcesJson: this.prevResourcesJson,
      prevRatesJson: this.prevRatesJson,
    };
  }

  /** 从 tick 上下文同步回缓存字段 */
  private syncTickCtx(ctx: TickContext): void {
    this.prevResourcesJson = ctx.prevResourcesJson;
    this.prevRatesJson = ctx.prevRatesJson;
  }

  /** 构建存档上下文 */
  private buildSaveCtx(): SaveContext {
    return {
      resource: this.resource,
      building: this.building,
      calendar: this.calendar,
      hero: this.hero,
      recruit: this.heroRecruit,
      formation: this.heroFormation,
      bus: this.bus,
      registry: this.registry,
      configRegistry: this.configRegistry,
      onlineSeconds: this.onlineSeconds,
    };
  }

  /** 加载完成后的公共收尾逻辑 */
  private finalizeLoad(): void {
    const deps: ISystemDeps = {
      eventBus: this.bus,
      config: this.configRegistry,
      registry: this.registry,
    };
    this.initHeroSystems(deps);

    this.initialized = true;
    this.lastTickTime = Date.now();
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;
  }

  // ═══════════════════════════════════════════
  // IGameEngine 兼容存根
  // ═══════════════════════════════════════════

  get score(): number { return 0; }
  get level(): number { return 1; }
  get elapsedTime(): number { return this.onlineSeconds; }
  get status(): string { return this.initialized ? 'playing' : 'idle'; }
  setCanvas(_canvas: HTMLCanvasElement): void { /* no-op */ }
  getState(): Record<string, unknown> { return this.getSnapshot() as unknown as Record<string, unknown>; }
  start(): void { this.init(); }
  pause(): void { /* no-op */ }
  resume(): void { /* no-op */ }
  destroy(): void { this.reset(); }
  handleKeyDown(_key: string): void { /* no-op */ }
  handleKeyUp(_key: string): void { /* no-op */ }
  handleClick(_x: number, _y: number): void { /* no-op */ }
  handleMouseDown(_x: number, _y: number): void { /* no-op */ }
  handleMouseUp(_x: number, _y: number): void { /* no-op */ }
  handleMouseMove(_x: number, _y: number): void { /* no-op */ }
  handleRightClick(_x: number, _y: number): void { /* no-op */ }
  handleDoubleClick(_x: number, _y: number): void { /* no-op */ }
}
