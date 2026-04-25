/**
 * 三国霸业 — 引擎主类（应用层/编排层）
 * 职责：编排各子系统，协调业务流程。不包含具体业务逻辑。
 * 拆分：engine-tick/save/hero-deps/campaign-deps/building-ops/getters/r11-deps
 */

import { ResourceSystem } from './resource/ResourceSystem';
import { BuildingSystem } from './building/BuildingSystem';
import { CalendarSystem } from './calendar/CalendarSystem';
import { HeroSystem } from './hero/HeroSystem';
import { HeroRecruitSystem } from './hero/HeroRecruitSystem';
import { HeroLevelSystem } from './hero/HeroLevelSystem';
import { HeroFormation } from './hero/HeroFormation';
import { HeroStarSystem } from './hero/HeroStarSystem';
import { SkillUpgradeSystem } from './hero/SkillUpgradeSystem';
import { BondSystem } from './bond/BondSystem';
import { FormationRecommendSystem } from './hero/FormationRecommendSystem';
import { HeroDispatchSystem } from './hero/HeroDispatchSystem';
import type { CapWarning, OfflineEarnings } from './resource/resource.types';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from './building/building.types';
import type { EngineEventType, EngineEventMap, EngineSnapshot } from '../shared/types';
import { AUTO_SAVE_INTERVAL_SECONDS, SAVE_KEY, ENGINE_SAVE_VERSION } from '../shared/constants';
import type { IGameState } from '../core/types/state';
import type { ISystemDeps } from '../core/types/subsystem';
import { EventBus } from '../core/events/EventBus';
import { gameLog } from '../core/logger';
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
import { SweepSystem } from './campaign/SweepSystem';
import { VIPSystem } from './campaign/VIPSystem';
import { ChallengeStageSystem } from './campaign/ChallengeStageSystem';
import { campaignDataProvider } from './campaign/campaign-config';
import {
  checkBuildingUpgrade, getBuildingUpgradeCost,
  executeBuildingUpgrade, cancelBuildingUpgrade,
  type BuildingOpsContext,
} from './engine-building-ops';
import { createTechSystems, initTechSystems, type TechSystems } from './engine-tech-deps';
import { createMapSystems, initMapSystems, type MapSystems } from './engine-map-deps';
import { createEventSystems, initEventSystems, type EventSystems } from './engine-event-deps';
import {
  createR11Systems, registerR11Systems, initR11Systems, resetR11Systems,
  type R11Systems,
} from './engine-extended-deps';
import {
  createOfflineSystems, registerOfflineSystems, initOfflineSystems, resetOfflineSystems,
  type OfflineSystems,
} from './engine-offline-deps';
import {
  createGuideSystems, registerGuideSystems, initGuideSystems, resetGuideSystems,
  type GuideSystems,
} from './engine-guide-deps';
import { applyGetters } from './engine-getters';
import type { EngineGettersMixin } from './engine-getters-types';

/**
 * 通过 interface 合并将 Mixin 方法类型注入 ThreeKingdomsEngine。
 * 实际实现由 engine-getters.ts 中的 applyGetters() 挂载到原型。
 */
export interface ThreeKingdomsEngine extends EngineGettersMixin {} // eslint-disable-line @typescript-eslint/no-empty-object-type

export class ThreeKingdomsEngine {
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;
  readonly calendar: CalendarSystem;
  readonly hero: HeroSystem;
  readonly heroRecruit: HeroRecruitSystem;
  readonly heroLevel: HeroLevelSystem;
  private readonly heroFormation: HeroFormation;
  private readonly heroStarSystem: HeroStarSystem;
  private readonly skillUpgradeSystem: SkillUpgradeSystem;
  private readonly bondSystem: BondSystem;
  private readonly formationRecommendSystem: FormationRecommendSystem;
  private readonly heroDispatchSystem: HeroDispatchSystem;
  private readonly campaignSystems: CampaignSystems;
  private readonly sweepSystem: SweepSystem;
  private readonly vipSystem: VIPSystem;
  private readonly challengeStageSystem: ChallengeStageSystem;
  private readonly techSystems: TechSystems;
  private readonly mapSystems: MapSystems;
  private readonly eventSystems: EventSystems;
  private readonly r11: R11Systems;
  private readonly offline: OfflineSystems;
  private readonly guide: GuideSystems;
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
    this.resource = new ResourceSystem(); this.building = new BuildingSystem();
    this.calendar = new CalendarSystem(); this.hero = new HeroSystem();
    this.heroRecruit = new HeroRecruitSystem();
    this.heroLevel = new HeroLevelSystem();
    this.heroFormation = new HeroFormation();
    this.heroStarSystem = new HeroStarSystem(this.hero);
    this.skillUpgradeSystem = new SkillUpgradeSystem();
    this.bondSystem = new BondSystem();
    this.formationRecommendSystem = new FormationRecommendSystem();
    this.heroDispatchSystem = new HeroDispatchSystem();
    this.campaignSystems = createCampaignSystems(this.resource, this.hero);
    const self = this;
    this.sweepSystem = new SweepSystem(
      campaignDataProvider,
      {
        addResource: (type: string, amount: number) => self.resource.addResource(type as import('../shared/types').ResourceType, amount),
        addFragment: (id: string, count: number) => self.hero.addFragment(id, count),
        addExp: (exp: number) => {
          const gs = self.hero.getAllGenerals();
          if (!gs.length) return;
          const per = Math.floor(exp / gs.length);
          if (per <= 0) return;
          for (const g of gs) self.hero.addExp(g.id, per);
        },
      },
      {
        simulateBattle: (stageId: string) => {
          try {
            const r = self.campaignSystems.battleEngine.runFullBattle(
              buildAllyTeam(self.heroFormation, self.hero),
              buildEnemyTeam(campaignDataProvider.getStage(stageId)!),
            );
            return { victory: r.outcome === 'VICTORY' as const, stars: r.stars as number };
          } catch { return { victory: false, stars: 0 }; }
        },
        getStageStars: (stageId: string) => self.campaignSystems.campaignSystem.getStageStars(stageId),
        canChallenge: (stageId: string) => self.campaignSystems.campaignSystem.canChallenge(stageId),
        getFarthestStageId: () => {
          const progress = self.campaignSystems.campaignSystem.getProgress();
          const stages = campaignDataProvider.getChapters().flatMap(c => c.stages);
          let farthest: string | null = null;
          for (const s of stages) {
            if (progress.stageStates[s.id]?.firstCleared) farthest = s.id; else break;
          }
          return farthest;
        },
        completeStage: (stageId: string, stars: number) => self.campaignSystems.campaignSystem.completeStage(stageId, stars),
      },
    );
    this.vipSystem = new VIPSystem();
    this.challengeStageSystem = new ChallengeStageSystem({
      getResourceAmount: (type: string) => self.resource.getAmount(type as import('../shared/types').ResourceType),
      consumeResource: (type: string, amount: number) => {
        try { self.resource.consumeResource(type as import('../shared/types').ResourceType, amount); return true; } catch { return false; }
      },
      addResource: (type: string, amount: number) => self.resource.addResource(type as import('../shared/types').ResourceType, amount),
      addFragment: (id: string, count: number) => self.hero.addFragment(id, count),
      addExp: (exp: number) => {
        const gs = self.hero.getAllGenerals();
        if (!gs.length) return;
        const per = Math.floor(exp / gs.length);
        if (per <= 0) return;
        for (const g of gs) self.hero.addExp(g.id, per);
      },
    });
    this.techSystems = createTechSystems(this.building);
    this.mapSystems = createMapSystems();
    this.eventSystems = createEventSystems();
    this.r11 = createR11Systems();
    this.offline = createOfflineSystems();
    this.guide = createGuideSystems();
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
    r.register('heroStarSystem', this.heroStarSystem);
    r.register('skillUpgradeSystem', this.skillUpgradeSystem);
    r.register('bond', this.bondSystem);
    r.register('formationRecommend', this.formationRecommendSystem);
    r.register('heroDispatch', this.heroDispatchSystem);
    r.register('battleEngine', this.campaignSystems.battleEngine);
    r.register('campaignSystem', this.campaignSystems.campaignSystem);
    r.register('rewardDistributor', this.campaignSystems.rewardDistributor);
    r.register('sweepSystem', this.sweepSystem);
    r.register('vipSystem', this.vipSystem);
    r.register('challengeStageSystem', this.challengeStageSystem);
    r.register('techTree', this.techSystems.treeSystem);
    r.register('techPoint', this.techSystems.pointSystem);
    r.register('techResearch', this.techSystems.researchSystem);
    r.register('fusionTech', this.techSystems.fusionSystem);
    r.register('techLink', this.techSystems.linkSystem);
    r.register('techOffline', this.techSystems.offlineSystem);
    r.register('worldMap', this.mapSystems.worldMap);
    r.register('territory', this.mapSystems.territory);
    r.register('siege', this.mapSystems.siege);
    r.register('garrison', this.mapSystems.garrison);
    r.register('siegeEnhancer', this.mapSystems.siegeEnhancer);
    r.register('eventTrigger', this.eventSystems.trigger);
    r.register('eventNotification', this.eventSystems.notification);
    r.register('eventUI', this.eventSystems.uiNotification);
    r.register('eventChain', this.eventSystems.chain);
    r.register('eventLog', this.eventSystems.log);
    r.register('offlineEvent', this.eventSystems.offline);
    registerR11Systems(r, this.r11);
    registerOfflineSystems(r, this.offline);
    registerGuideSystems(r, this.guide);
  }

  // ── 初始化 ──

  init(): void {
    if (this.initialized) return;
    syncBuildingToResource(this.buildTickCtx());
    const deps = this.buildDeps();
    this.calendar.init(deps); this.initHeroSystems(deps); this.bondSystem.init(deps);
    this.formationRecommendSystem.init(deps);
    this.heroDispatchSystem.init(deps);
    this.heroDispatchSystem.setGetGeneral((id) => this.hero.getGeneral(id));
    initCampaignSystems(this.campaignSystems, deps); initTechSystems(this.techSystems, deps);
    initMapSystems(this.mapSystems, deps); initEventSystems(this.eventSystems, deps);
    initR11Systems(this.r11, deps);
    this.initResourceTradeDeps();
    initOfflineSystems(this.offline, deps);
    initGuideSystems(this.guide, deps);
    this.initialized = true; this.lastTickTime = Date.now();
    this.onlineSeconds = 0; this.autoSaveAccumulator = 0;
    this.bus.emit('game:initialized', { isNewGame: true });
  }

  // ── 游戏循环 ──

  tick(deltaMs?: number): void {
    if (!this.initialized) return;
    const now = Date.now();
    const dt = deltaMs ?? (now - this.lastTickTime);
    this.lastTickTime = now;
    const dtSec = Math.max(0, dt / 1000);
    const ctx = this.buildTickCtx();
    executeTick(ctx, dtSec);
    this.syncTickCtx(ctx); this.autoSaveAccumulator += dtSec;
    if (this.autoSaveAccumulator >= AUTO_SAVE_INTERVAL_SECONDS) {
      this.autoSaveAccumulator = 0; this.save();
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
    if (ok) { this.resource.touchSaveTime(); this.bus.emit('game:saved', { timestamp: data.saveTime }); }
    else { gameLog.error('ThreeKingdomsEngine.save 失败'); }
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
    const deps = this.buildDeps();
    this.initHeroSystems(deps); this.bondSystem.init(deps);
    this.formationRecommendSystem.init(deps);
    this.heroDispatchSystem.init(deps);
    this.heroDispatchSystem.setGetGeneral((id) => this.hero.getGeneral(id));
    initCampaignSystems(this.campaignSystems, deps); initTechSystems(this.techSystems, deps);
    initMapSystems(this.mapSystems, deps); initEventSystems(this.eventSystems, deps);
    initR11Systems(this.r11, deps);
    initOfflineSystems(this.offline, deps);
    initGuideSystems(this.guide, deps);
    this.initialized = true; this.lastTickTime = Date.now();
  }

  hasSaveData(): boolean { return this.saveManager.hasSaveData(); }

  reset(): void {
    this.resource.reset(); this.building.reset(); this.calendar.reset();
    this.hero.reset(); this.heroRecruit.reset(); this.heroLevel.reset();
    this.heroFormation.reset(); this.heroStarSystem.reset(); this.skillUpgradeSystem.reset(); this.bondSystem.reset();
    this.formationRecommendSystem.reset(); this.heroDispatchSystem.reset();
    this.campaignSystems.campaignSystem.reset(); this.sweepSystem.reset();
    this.vipSystem.reset(); this.challengeStageSystem.reset();
    this.techSystems.treeSystem.reset(); this.techSystems.pointSystem.reset();
    this.techSystems.researchSystem.reset(); this.techSystems.fusionSystem.reset();
    this.techSystems.linkSystem.reset(); this.techSystems.offlineSystem.reset();
    this.mapSystems.worldMap.reset(); this.mapSystems.territory.reset();
    this.mapSystems.siege.reset(); this.mapSystems.garrison.reset(); this.mapSystems.siegeEnhancer.reset();
    this.eventSystems.trigger.reset(); this.eventSystems.notification.reset();
    this.eventSystems.uiNotification.reset(); this.eventSystems.chain.reset();
    this.eventSystems.log.reset(); this.eventSystems.offline.reset();
    resetR11Systems(this.r11);
    resetOfflineSystems(this.offline);
    resetGuideSystems(this.guide);
    this.initialized = false; this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0; this.prevResourcesJson = ''; this.prevRatesJson = '';
    this.saveManager.deleteSave(); this.bus.removeAllListeners();
  }

  // ── 事件系统 ──

  on<T extends EngineEventType>(event: T, listener: import('../shared/types').EventListener<EngineEventMap[T]>): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: string, listener: (...args: any[]) => void): void { this.bus.on(event, listener); }
  once<T extends EngineEventType>(event: T, listener: import('../shared/types').EventListener<EngineEventMap[T]>): void { this.bus.once(event, listener); }
  off<T extends EngineEventType>(event: T, listener: import('../shared/types').EventListener<EngineEventMap[T]>): void { this.bus.off(event, listener); }

  // ── 状态查询 ──

  getSnapshot(): EngineSnapshot {
    return {
      resources: this.resource.getResources(),
      productionRates: this.resource.getProductionRates(),
      caps: this.resource.getCaps(),
      buildings: this.building.getAllBuildings(), onlineSeconds: this.onlineSeconds,
      calendar: this.calendar.getState(), heroes: this.hero?.getAllGenerals() ?? [],
      heroFragments: this.hero?.getAllFragments() ?? {}, totalPower: this.hero?.calculateTotalPower() ?? 0,
      formations: this.heroFormation?.getAllFormations() ?? [],
      activeFormationId: this.heroFormation?.getActiveFormationId() ?? null,
      campaignProgress: this.campaignSystems?.campaignSystem?.getProgress() ?? { currentChapterId: '', stageStates: {}, lastClearTime: 0 },
      techState: this.getTechState(),
      mapState: this.mapSystems?.worldMap?.getState(),
      territoryState: this.mapSystems?.territory?.getState(),
      siegeState: this.mapSystems?.siege?.getState(),
    };
  }

  getOnlineSeconds(): number { return this.onlineSeconds; }
  isInitialized(): boolean { return this.initialized; }
  getCapWarnings(): CapWarning[] { return this.resource.getCapWarnings(); }
  getUpgradeProgress(type: BuildingType): number { return this.building.getUpgradeProgress(type); }
  getUpgradeRemainingTime(type: BuildingType): number { return this.building.getUpgradeRemainingTime(type); }

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

  getSubsystemRegistry(): SubsystemRegistry { return this.registry; }

  // ── 私有方法 ──

  private get heroSystems(): HeroSystems {
    return { hero: this.hero, heroRecruit: this.heroRecruit, heroLevel: this.heroLevel };
  }
  private initHeroSystems(deps: ISystemDeps): void {
    initHeroSystems(this.heroSystems, this.resource, deps);
    this.heroStarSystem.init(deps);
    this.heroStarSystem.setDeps({
      spendFragments: (generalId: string, count: number) => this.hero.useFragments(generalId, count),
      getFragments: (generalId: string) => this.hero.getFragments(generalId),
      spendResource: (type: string, amount: number) => {
        try { this.resource.consumeResource(type as import('../shared/types').ResourceType, amount); return true; } catch { return false; }
      },
      canAffordResource: (type: string, amount: number) => {
        const current = this.resource.getAmount(type as import('../shared/types').ResourceType);
        return current >= amount;
      },
      getResourceAmount: (type: string) => this.resource.getAmount(type as import('../shared/types').ResourceType),
    });
    this.skillUpgradeSystem.init(deps);
    this.skillUpgradeSystem.setSkillUpgradeDeps({
      heroSystem: this.hero,
      heroStarSystem: this.heroStarSystem,
      spendResource: (type: string, amount: number) => {
        try { this.resource.consumeResource(type as import('../shared/types').ResourceType, amount); return true; } catch { return false; }
      },
      canAffordResource: (type: string, amount: number) => {
        const current = this.resource.getAmount(type as import('../shared/types').ResourceType);
        return current >= amount;
      },
      getResourceAmount: (type: string) => this.resource.getAmount(type as import('../shared/types').ResourceType),
    });
    this.sweepSystem.init(deps);
  }
  private buildDeps(): ISystemDeps { return { eventBus: this.bus, config: this.configRegistry, registry: this.registry }; }
  private buildTickCtx(): TickContext {
    return {
      resource: this.resource, building: this.building, calendar: this.calendar,
      hero: this.hero, campaign: this.campaignSystems.campaignSystem,
      techTree: this.techSystems.treeSystem, techPoint: this.techSystems.pointSystem,
      techResearch: this.techSystems.researchSystem,
      eventTrigger: this.eventSystems.trigger,
      eventNotification: this.eventSystems.notification,
      eventUI: this.eventSystems.uiNotification,
      eventChain: this.eventSystems.chain,
      eventLog: this.eventSystems.log,
      offlineEvent: this.eventSystems.offline,
      bus: this.bus, prevResourcesJson: this.prevResourcesJson, prevRatesJson: this.prevRatesJson,
    };
  }
  private syncTickCtx(ctx: TickContext): void { this.prevResourcesJson = ctx.prevResourcesJson; this.prevRatesJson = ctx.prevRatesJson; }
  private buildingCtx(): BuildingOpsContext { return { resource: this.resource, building: this.building, bus: this.bus }; }
  /** 注入 ResourceTradeEngine 的资源操作依赖 */
  private initResourceTradeDeps(): void {
    this.r11.resourceTradeEngine.setDeps({
      getResourceAmount: (type) => this.resource.getAmount(type),
      consumeResource: (type, amount) => this.resource.consumeResource(type, amount),
      addResource: (type, amount) => this.resource.addResource(type, amount),
      getMarketLevel: () => this.building.getLevel('market'),
    });
  }
  private buildSaveCtx(): SaveContext {
    return {
      resource: this.resource, building: this.building, calendar: this.calendar,
      hero: this.hero, recruit: this.heroRecruit, formation: this.heroFormation,
      campaign: this.campaignSystems.campaignSystem,
      techTree: this.techSystems.treeSystem, techPoint: this.techSystems.pointSystem,
      techResearch: this.techSystems.researchSystem,
      bus: this.bus, registry: this.registry, configRegistry: this.configRegistry,
      equipment: this.r11.equipmentSystem,
      equipmentForge: this.r11.equipmentForgeSystem,
      equipmentEnhance: this.r11.equipmentEnhanceSystem,
      arena: this.r11.arenaSystem,
      arenaShop: this.r11.arenaShopSystem,
      ranking: this.r11.rankingSystem,
      eventTrigger: this.eventSystems.trigger,
      eventNotification: this.eventSystems.notification,
      eventUI: this.eventSystems.uiNotification,
      eventChain: this.eventSystems.chain,
      eventLog: this.eventSystems.log,
      offlineEvent: this.eventSystems.offline,
      onlineSeconds: this.onlineSeconds,
    };
  }
  private finalizeLoad(): void {
    const deps = this.buildDeps();
    this.initHeroSystems(deps); this.bondSystem.init(deps);
    this.formationRecommendSystem.init(deps);
    this.heroDispatchSystem.init(deps);
    this.heroDispatchSystem.setGetGeneral((id) => this.hero.getGeneral(id));
    initCampaignSystems(this.campaignSystems, deps); initTechSystems(this.techSystems, deps);
    initMapSystems(this.mapSystems, deps); initEventSystems(this.eventSystems, deps);
    initR11Systems(this.r11, deps);
    this.initResourceTradeDeps();
    initOfflineSystems(this.offline, deps);
    initGuideSystems(this.guide, deps);
    this.initialized = true; this.lastTickTime = Date.now(); this.onlineSeconds = 0; this.autoSaveAccumulator = 0;
  }
}

// 将 engine-getters.ts 中定义的 getter / API 方法混入原型
applyGetters(ThreeKingdomsEngine);
