/**
 * 三国霸业 — 引擎主类（应用层/编排层）
 *
 * 职责：编排各子系统，协调业务流程
 * 规则：不包含具体业务逻辑，只做编排
 *
 * 基础设施依赖（core/ 层）：EventBus / SubsystemRegistry / SaveManager
 *
 * 拆分：
 *   - engine-tick.ts — tick 内部逻辑
 *   - engine-save.ts — 存档相关逻辑
 *   - engine-hero-deps.ts — 武将系统依赖注入
 *   - engine-campaign-deps.ts — 关卡/战斗系统依赖注入
 *   - engine-building-ops.ts — 建筑升级操作
 */

import { ResourceSystem } from './resource/ResourceSystem';
import { BuildingSystem } from './building/BuildingSystem';
import { CalendarSystem } from './calendar/CalendarSystem';
import { HeroSystem } from './hero/HeroSystem';
import { HeroRecruitSystem, type RecruitOutput } from './hero/HeroRecruitSystem';
import { HeroLevelSystem, type LevelUpResult, type BatchEnhanceResult, type EnhancePreview } from './hero/HeroLevelSystem';
import { HeroFormation, type FormationData } from './hero/HeroFormation';
import type { CapWarning, OfflineEarnings } from './resource/resource.types';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from './building/building.types';
import type {
  EngineEventType, EngineEventMap, EventListener, EngineSnapshot,
} from '../shared/types';
import type { GeneralData } from './hero/hero.types';
import type { RecruitType } from './hero/hero-recruit-config';
import type { BattleResult } from './battle/battle.types';
import type { Stage, Chapter, CampaignProgress } from './campaign/campaign.types';
import { AUTO_SAVE_INTERVAL_SECONDS, SAVE_KEY, ENGINE_SAVE_VERSION } from '../shared/constants';
import type { IGameState } from '../core/types/state';
import type { ISystemDeps } from '../core/types/subsystem';
import { EventBus } from '../core/events/EventBus';
import { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import { SaveManager } from '../core/save/SaveManager';
import { ConfigRegistry } from '../core/config/ConfigRegistry';
import { executeTick, syncBuildingToResource, type TickContext } from './engine-tick';
import {
  buildSaveData, toIGameState, applyLoadedState,
  tryLoadLegacyFormat, applyLegacyState, applyDeserialize,
  type SaveContext,
} from './engine-save';
import { initHeroSystems, type HeroSystems } from './engine-hero-deps';
import {
  createCampaignSystems, initCampaignSystems, buildAllyTeam, buildEnemyTeam,
  type CampaignSystems,
} from './engine-campaign-deps';
import { campaignDataProvider } from './campaign/campaign-config';
import {
  checkBuildingUpgrade, getBuildingUpgradeCost,
  executeBuildingUpgrade, cancelBuildingUpgrade,
  type BuildingOpsContext,
} from './engine-building-ops';
import { createTechSystems, initTechSystems, type TechSystems } from './engine-tech-deps';

// ─────────────────────────────────────────────
// ThreeKingdomsEngine
// ─────────────────────────────────────────────

export class ThreeKingdomsEngine {
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;
  readonly calendar: CalendarSystem;
  readonly hero: HeroSystem;
  readonly heroRecruit: HeroRecruitSystem;
  readonly heroLevel: HeroLevelSystem;
  private readonly heroFormation: HeroFormation;
  private readonly campaignSystems: CampaignSystems;
  private readonly techSystems: TechSystems;
  private readonly bus: EventBus;
  private readonly registry: SubsystemRegistry;
  private readonly saveManager: SaveManager;
  private readonly configRegistry: ConfigRegistry;
  private initialized = false;
  private onlineSeconds = 0;
  private lastTickTime = 0;
  private autoSaveAccumulator = 0;
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
    this.campaignSystems = createCampaignSystems(this.resource, this.hero);
    this.techSystems = createTechSystems(this.building);
    this.bus = new EventBus();
    this.registry = new SubsystemRegistry();
    this.configRegistry = new ConfigRegistry();
    this.configRegistry.set('SAVE_KEY', SAVE_KEY);
    this.configRegistry.set('SAVE_VERSION', String(ENGINE_SAVE_VERSION));
    this.saveManager = new SaveManager(this.configRegistry);
    this.registerSubsystems();
  }

  private registerSubsystems(): void {
    const r = this.registry;
    r.register('resource', this.resource);
    r.register('building', this.building);
    r.register('calendar', this.calendar);
    r.register('hero', this.hero);
    r.register('heroRecruit', this.heroRecruit);
    r.register('heroLevel', this.heroLevel);
    r.register('heroFormation', this.heroFormation);
    r.register('battleEngine', this.campaignSystems.battleEngine);
    r.register('campaignSystem', this.campaignSystems.campaignSystem);
    r.register('rewardDistributor', this.campaignSystems.rewardDistributor);
    r.register('techTree', this.techSystems.treeSystem);
    r.register('techPoint', this.techSystems.pointSystem);
    r.register('techResearch', this.techSystems.researchSystem);
  }

  // ── 初始化 ──

  init(): void {
    if (this.initialized) return;
    syncBuildingToResource(this.buildTickCtx());
    const deps = this.buildDeps();
    this.calendar.init(deps);
    this.initHeroSystems(deps);
    initCampaignSystems(this.campaignSystems, deps);
    initTechSystems(this.techSystems, deps);
    this.initialized = true;
    this.lastTickTime = Date.now();
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;
    this.bus.emit('game:initialized', { isNewGame: true });
  }

  // ── 游戏循环 ──

  tick(deltaMs?: number): void {
    if (!this.initialized) return;
    const now = Date.now();
    const dt = deltaMs ?? (now - this.lastTickTime);
    this.lastTickTime = now;
    const dtSec = dt / 1000;
    const ctx = this.buildTickCtx();
    executeTick(ctx, dtSec);
    this.syncTickCtx(ctx);
    this.autoSaveAccumulator += dtSec;
    if (this.autoSaveAccumulator >= AUTO_SAVE_INTERVAL_SECONDS) {
      this.autoSaveAccumulator = 0;
      this.save();
    }
    this.onlineSeconds += dtSec;
  }

  // ── 建筑升级 ──

  checkUpgrade(type: BuildingType): UpgradeCheckResult {
    return checkBuildingUpgrade(this.buildingCtx(), type);
  }
  getUpgradeCost(type: BuildingType): UpgradeCost | null {
    return getBuildingUpgradeCost(this.buildingCtx(), type);
  }
  upgradeBuilding(type: BuildingType): void {
    executeBuildingUpgrade(this.buildingCtx(), type);
  }
  cancelUpgrade(type: BuildingType): UpgradeCost | null {
    return cancelBuildingUpgrade(this.buildingCtx(), type);
  }

  // ── 存档 / 读档 ──

  save(): void {
    const data = buildSaveData(this.buildSaveCtx());
    const state: IGameState = toIGameState(data, this.onlineSeconds);
    const ok = this.saveManager.save(state);
    if (ok) {
      this.resource.touchSaveTime();
      this.bus.emit('game:saved', { timestamp: data.saveTime });
    } else {
      console.error('ThreeKingdomsEngine.save 失败');
    }
  }

  load(): OfflineEarnings | null {
    const ctx = this.buildSaveCtx();
    const state = this.saveManager.load();
    if (state) { const r = applyLoadedState(ctx, state); this.finalizeLoad(); return r; }
    const legacy = tryLoadLegacyFormat();
    if (legacy) { const r = applyLegacyState(ctx, legacy); this.finalizeLoad(); return r; }
    return null;
  }

  serialize(): string { return JSON.stringify(buildSaveData(this.buildSaveCtx())); }

  deserialize(json: string): void {
    applyDeserialize(this.buildSaveCtx(), json);
    this.initHeroSystems(this.buildDeps());
    this.initialized = true;
    this.lastTickTime = Date.now();
  }

  hasSaveData(): boolean { return this.saveManager.hasSaveData(); }

  reset(): void {
    this.resource.reset(); this.building.reset(); this.calendar.reset();
    this.hero.reset(); this.heroRecruit.reset(); this.heroLevel.reset();
    this.heroFormation.reset(); this.campaignSystems.campaignSystem.reset();
    this.techSystems.treeSystem.reset(); this.techSystems.pointSystem.reset();
    this.techSystems.researchSystem.reset();
    this.initialized = false; this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0; this.prevResourcesJson = ''; this.prevRatesJson = '';
    this.saveManager.deleteSave(); this.bus.removeAllListeners();
  }

  // ── 事件系统 ──

  on<T extends EngineEventType>(event: T, listener: EventListener<EngineEventMap[T]>): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: string, listener: (...args: any[]) => void): void { this.bus.on(event, listener); }
  once<T extends EngineEventType>(event: T, listener: EventListener<EngineEventMap[T]>): void { this.bus.once(event, listener); }
  off<T extends EngineEventType>(event: T, listener: EventListener<EngineEventMap[T]>): void { this.bus.off(event, listener); }

  // ── 状态查询 ──

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
      campaignProgress: this.campaignSystems.campaignSystem.getProgress(),
      techState: this.getTechState(),
    };
  }

  getOnlineSeconds(): number { return this.onlineSeconds; }
  isInitialized(): boolean { return this.initialized; }
  getCapWarnings(): CapWarning[] { return this.resource.getCapWarnings(); }
  getUpgradeProgress(type: BuildingType): number { return this.building.getUpgradeProgress(type); }
  getUpgradeRemainingTime(type: BuildingType): number { return this.building.getUpgradeRemainingTime(type); }

  // ── 武将系统 API ──

  getHeroSystem(): HeroSystem { return this.hero; }
  getRecruitSystem(): HeroRecruitSystem { return this.heroRecruit; }
  getLevelSystem(): HeroLevelSystem { return this.heroLevel; }
  getFormationSystem(): HeroFormation { return this.heroFormation; }
  getFormations(): FormationData[] { return this.heroFormation.getAllFormations(); }
  getActiveFormation(): FormationData | null { return this.heroFormation.getActiveFormation(); }
  createFormation(id?: string): FormationData | null { return this.heroFormation.createFormation(id); }
  setFormation(id: string, generalIds: string[]): FormationData | null { return this.heroFormation.setFormation(id, generalIds); }
  addToFormation(formationId: string, generalId: string): FormationData | null { return this.heroFormation.addToFormation(formationId, generalId); }
  removeFromFormation(formationId: string, generalId: string): FormationData | null { return this.heroFormation.removeFromFormation(formationId, generalId); }
  recruit(type: RecruitType, count: 1 | 10 = 1): RecruitOutput | null { return count === 10 ? this.heroRecruit.recruitTen(type) : this.heroRecruit.recruitSingle(type); }
  enhanceHero(id: string, lvl?: number): LevelUpResult | null { return this.heroLevel.quickEnhance(id, lvl); }
  enhanceAllHeroes(lvl?: number): BatchEnhanceResult { return this.heroLevel.quickEnhanceAll(lvl); }
  getGenerals(): Readonly<GeneralData>[] { return this.hero.getAllGenerals(); }
  getGeneral(id: string): Readonly<GeneralData> | undefined { return this.hero.getGeneral(id); }
  getRecruitHistory() { return this.heroRecruit.getRecruitHistory(); }
  getSynthesizeProgress(id: string) { return this.hero.getSynthesizeProgress(id); }
  getEnhancePreview(id: string, lvl: number): EnhancePreview | null { return this.heroLevel.getEnhancePreview(id, lvl); }

  // ── 战斗/关卡系统 API ──

  getBattleEngine() { return this.campaignSystems.battleEngine; }
  getCampaignSystem() { return this.campaignSystems.campaignSystem; }
  getRewardDistributor() { return this.campaignSystems.rewardDistributor; }

  /** 发起战斗：布阵→战斗→返回结果（胜利时由UI调用 completeBattle 发放奖励） */
  startBattle(stageId: string): BattleResult {
    const stage = campaignDataProvider.getStage(stageId);
    if (!stage) throw new Error(`关卡不存在: ${stageId}`);
    if (!this.campaignSystems.campaignSystem.canChallenge(stageId)) throw new Error(`关卡未解锁: ${stageId}`);
    const allyTeam = buildAllyTeam(this.heroFormation, this.hero);
    const enemyTeam = buildEnemyTeam(stage);
    return this.campaignSystems.battleEngine.runFullBattle(allyTeam, enemyTeam);
  }

  /** 通关处理：奖励发放 + 进度更新 */
  completeBattle(stageId: string, stars: number): void {
    const isFirst = !this.campaignSystems.campaignSystem.isFirstCleared(stageId);
    this.campaignSystems.rewardDistributor.calculateAndDistribute(stageId, stars, isFirst);
    this.campaignSystems.campaignSystem.completeStage(stageId, stars);
  }

  getStageList(): Stage[] { return campaignDataProvider.getChapters().flatMap(c => c.stages); }
  getStageInfo(stageId: string): Stage | undefined { return campaignDataProvider.getStage(stageId); }
  getChapters(): Chapter[] { return campaignDataProvider.getChapters(); }
  getCampaignProgress(): CampaignProgress { return this.campaignSystems.campaignSystem.getProgress(); }

  // ── 科技系统 API ──

  getTechTreeSystem() { return this.techSystems.treeSystem; }
  getTechPointSystem() { return this.techSystems.pointSystem; }
  getTechResearchSystem() { return this.techSystems.researchSystem; }

  /** 获取科技系统完整状态 */
  getTechState() {
    const tree = this.techSystems.treeSystem;
    const point = this.techSystems.pointSystem;
    const research = this.techSystems.researchSystem;
    return {
      ...tree.getState(),
      researchQueue: research.getQueue(),
      techPoints: point.getTechPointState(),
    };
  }

  /** 开始科技研究 */
  startTechResearch(techId: string) {
    return this.techSystems.researchSystem.startResearch(techId);
  }

  /** 取消科技研究 */
  cancelTechResearch(techId: string) {
    return this.techSystems.researchSystem.cancelResearch(techId);
  }

  /** 加速科技研究 */
  speedUpTechResearch(techId: string, method: 'mandate' | 'ingot', amount: number) {
    return this.techSystems.researchSystem.speedUp(techId, method, amount);
  }

  // ═══════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════

  private get heroSystems(): HeroSystems {
    return { hero: this.hero, heroRecruit: this.heroRecruit, heroLevel: this.heroLevel };
  }
  private initHeroSystems(deps: ISystemDeps): void { initHeroSystems(this.heroSystems, this.resource, deps); }
  private buildDeps(): ISystemDeps { return { eventBus: this.bus, config: this.configRegistry, registry: this.registry }; }
  private buildTickCtx(): TickContext {
    return {
      resource: this.resource, building: this.building, calendar: this.calendar,
      hero: this.hero, campaign: this.campaignSystems.campaignSystem,
      techTree: this.techSystems.treeSystem, techPoint: this.techSystems.pointSystem,
      techResearch: this.techSystems.researchSystem,
      bus: this.bus, prevResourcesJson: this.prevResourcesJson, prevRatesJson: this.prevRatesJson,
    };
  }
  private syncTickCtx(ctx: TickContext): void { this.prevResourcesJson = ctx.prevResourcesJson; this.prevRatesJson = ctx.prevRatesJson; }
  private buildingCtx(): BuildingOpsContext { return { resource: this.resource, building: this.building, bus: this.bus }; }
  private buildSaveCtx(): SaveContext {
    return {
      resource: this.resource, building: this.building, calendar: this.calendar,
      hero: this.hero, recruit: this.heroRecruit, formation: this.heroFormation,
      campaign: this.campaignSystems.campaignSystem,
      techTree: this.techSystems.treeSystem, techPoint: this.techSystems.pointSystem,
      techResearch: this.techSystems.researchSystem,
      bus: this.bus, registry: this.registry, configRegistry: this.configRegistry,
      onlineSeconds: this.onlineSeconds,
    };
  }
  private finalizeLoad(): void {
    const deps = this.buildDeps();
    this.initHeroSystems(deps);
    initCampaignSystems(this.campaignSystems, deps);
    initTechSystems(this.techSystems, deps);
    this.initialized = true; this.lastTickTime = Date.now(); this.onlineSeconds = 0; this.autoSaveAccumulator = 0;
  }

  // ── IGameEngine 兼容存根 ──
  get score(): number { return 0; }
  get level(): number { return 1; }
  get elapsedTime(): number { return this.onlineSeconds; }
  get status(): string { return this.initialized ? 'playing' : 'idle'; }
  setCanvas(_c: HTMLCanvasElement): void { /* no-op */ }
  getState(): Record<string, unknown> { return this.getSnapshot() as unknown as Record<string, unknown>; }
  start(): void { this.init(); }
  pause(): void { /* no-op */ }
  resume(): void { /* no-op */ }
  destroy(): void { this.reset(); }
  handleKeyDown(_k: string): void { /* no-op */ }
  handleKeyUp(_k: string): void { /* no-op */ }
  handleClick(_x: number, _y: number): void { /* no-op */ }
  handleMouseDown(_x: number, _y: number): void { /* no-op */ }
  handleMouseUp(_x: number, _y: number): void { /* no-op */ }
  handleMouseMove(_x: number, _y: number): void { /* no-op */ }
  handleRightClick(_x: number, _y: number): void { /* no-op */ }
  handleDoubleClick(_x: number, _y: number): void { /* no-op */ }
}
