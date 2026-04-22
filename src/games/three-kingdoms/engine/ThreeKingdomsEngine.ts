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
import { HeroStarSystem } from './hero/HeroStarSystem';
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
import { SweepSystem } from './campaign/SweepSystem';
import { campaignDataProvider } from './campaign/campaign-config';
import {
  checkBuildingUpgrade, getBuildingUpgradeCost,
  executeBuildingUpgrade, cancelBuildingUpgrade,
  type BuildingOpsContext,
} from './engine-building-ops';
import { createTechSystems, initTechSystems, type TechSystems } from './engine-tech-deps';
import { createMapSystems, initMapSystems, type MapSystems } from './engine-map-deps';

// R11: 注册13个缺失子系统
import { MailSystem } from './mail/MailSystem';
import { ShopSystem } from './shop/ShopSystem';
import { CurrencySystem } from './currency/CurrencySystem';
import { NPCSystem } from './npc/NPCSystem';
import { EquipmentSystem } from './equipment/EquipmentSystem';
import { EquipmentForgeSystem } from './equipment/EquipmentForgeSystem';
import { EquipmentEnhanceSystem } from './equipment/EquipmentEnhanceSystem';
import { ArenaSystem } from './pvp/ArenaSystem';
import { ArenaSeasonSystem } from './pvp/ArenaSeasonSystem';
import { RankingSystem } from './pvp/RankingSystem';
import { ExpeditionSystem } from './expedition/ExpeditionSystem';
import { AllianceSystem } from './alliance/AllianceSystem';
import { AllianceTaskSystem } from './alliance/AllianceTaskSystem';
import { PrestigeSystem } from './prestige/PrestigeSystem';
import { QuestSystem } from './quest/QuestSystem';
import { AchievementSystem } from './achievement/AchievementSystem';
import { FriendSystem } from './social/FriendSystem';
import { HeritageSystem } from './heritage/HeritageSystem';
import { ActivitySystem } from './activity/ActivitySystem';
import { TradeSystem } from './trade/TradeSystem';
import { SettingsManager } from './settings/SettingsManager';
import { AccountSystem } from './settings/AccountSystem';

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
  private readonly heroStarSystem: HeroStarSystem;
  private readonly campaignSystems: CampaignSystems;
  private readonly sweepSystem: SweepSystem;
  private readonly techSystems: TechSystems;
  private readonly mapSystems: MapSystems;
  // R11: 13个缺失子系统
  private readonly mailSystem: MailSystem;
  private readonly shopSystem: ShopSystem;
  private readonly currencySystem: CurrencySystem;
  private readonly npcSystem: NPCSystem;
  private readonly equipmentSystem: EquipmentSystem;
  private readonly equipmentForgeSystem: EquipmentForgeSystem;
  private readonly equipmentEnhanceSystem: EquipmentEnhanceSystem;
  private readonly arenaSystem: ArenaSystem;
  private readonly arenaSeasonSystem: ArenaSeasonSystem;
  private readonly rankingSystem: RankingSystem;
  private readonly expeditionSystem: ExpeditionSystem;
  private readonly allianceSystem: AllianceSystem;
  private readonly allianceTaskSystem: AllianceTaskSystem;
  private readonly prestigeSystem: PrestigeSystem;
  private readonly questSystem: QuestSystem;
  private readonly achievementSystem: AchievementSystem;
  private readonly friendSystem: FriendSystem;
  private readonly heritageSystem: HeritageSystem;
  private readonly activitySystem: ActivitySystem;
  private readonly tradeSystem: TradeSystem;
  private readonly settingsManager: SettingsManager;
  private readonly accountSystem: AccountSystem;
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
    this.heroStarSystem = new HeroStarSystem(this.hero);
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
          } catch {
            return { victory: false, stars: 0 };
          }
        },
        getStageStars: (stageId: string) => self.campaignSystems.campaignSystem.getStageStars(stageId),
        canChallenge: (stageId: string) => self.campaignSystems.campaignSystem.canChallenge(stageId),
        getFarthestStageId: () => {
          const progress = self.campaignSystems.campaignSystem.getProgress();
          const stages = campaignDataProvider.getChapters().flatMap(c => c.stages);
          let farthest: string | null = null;
          for (const s of stages) {
            if (progress.stageStates[s.id]?.firstCleared) farthest = s.id;
            else break;
          }
          return farthest;
        },
        completeStage: (stageId: string, stars: number) => self.campaignSystems.campaignSystem.completeStage(stageId, stars),
      },
    );
    this.techSystems = createTechSystems(this.building);
    this.mapSystems = createMapSystems();
    // R11: 初始化13个缺失子系统
    this.mailSystem = new MailSystem();
    this.shopSystem = new ShopSystem();
    this.currencySystem = new CurrencySystem();
    this.npcSystem = new NPCSystem();
    this.equipmentSystem = new EquipmentSystem();
    this.equipmentForgeSystem = new EquipmentForgeSystem(this.equipmentSystem);
    this.equipmentEnhanceSystem = new EquipmentEnhanceSystem(this.equipmentSystem);
    this.arenaSystem = new ArenaSystem();
    this.arenaSeasonSystem = new ArenaSeasonSystem();
    this.rankingSystem = new RankingSystem();
    this.expeditionSystem = new ExpeditionSystem();
    this.allianceSystem = new AllianceSystem();
    this.allianceTaskSystem = new AllianceTaskSystem();
    this.prestigeSystem = new PrestigeSystem();
    this.questSystem = new QuestSystem();
    this.achievementSystem = new AchievementSystem();
    this.friendSystem = new FriendSystem();
    this.heritageSystem = new HeritageSystem();
    this.activitySystem = new ActivitySystem();
    this.tradeSystem = new TradeSystem();
    this.settingsManager = new SettingsManager();
    this.accountSystem = new AccountSystem();
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
    r.register('battleEngine', this.campaignSystems.battleEngine);
    r.register('campaignSystem', this.campaignSystems.campaignSystem);
    r.register('rewardDistributor', this.campaignSystems.rewardDistributor);
    r.register('sweepSystem', this.sweepSystem);
    r.register('techTree', this.techSystems.treeSystem);
    r.register('techPoint', this.techSystems.pointSystem);
    r.register('techResearch', this.techSystems.researchSystem);
    // v5.0: 科技新子系统
    r.register('fusionTech', this.techSystems.fusionSystem);
    r.register('techLink', this.techSystems.linkSystem);
    r.register('techOffline', this.techSystems.offlineSystem);
    // v5.0: 地图子系统
    r.register('worldMap', this.mapSystems.worldMap);
    r.register('territory', this.mapSystems.territory);
    r.register('siege', this.mapSystems.siege);
    r.register('garrison', this.mapSystems.garrison);
    r.register('siegeEnhancer', this.mapSystems.siegeEnhancer);
    // R11: 注册13个缺失子系统
    r.register('mail', this.mailSystem);
    r.register('shop', this.shopSystem);
    r.register('currency', this.currencySystem);
    r.register('npc', this.npcSystem);
    r.register('equipment', this.equipmentSystem);
    r.register('equipmentForge', this.equipmentForgeSystem);
    r.register('equipmentEnhance', this.equipmentEnhanceSystem);
    r.register('arena', this.arenaSystem);
    r.register('arenaSeason', this.arenaSeasonSystem);
    r.register('ranking', this.rankingSystem);
    r.register('expedition', this.expeditionSystem);
    r.register('alliance', this.allianceSystem);
    r.register('allianceTask', this.allianceTaskSystem);
    r.register('prestige', this.prestigeSystem);
    r.register('quest', this.questSystem);
    r.register('achievement', this.achievementSystem);
    r.register('friend', this.friendSystem);
    r.register('heritage', this.heritageSystem);
    r.register('activity', this.activitySystem);
    r.register('trade', this.tradeSystem);
    r.register('settings', this.settingsManager);
    r.register('account', this.accountSystem);
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
    initMapSystems(this.mapSystems, deps);
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
    const dtSec = Math.max(0, dt / 1000);
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
    this.heroFormation.reset(); this.heroStarSystem.reset();
    this.campaignSystems.campaignSystem.reset(); this.sweepSystem.reset();
    this.techSystems.treeSystem.reset(); this.techSystems.pointSystem.reset();
    this.techSystems.researchSystem.reset();
    this.techSystems.fusionSystem.reset(); this.techSystems.linkSystem.reset();
    this.techSystems.offlineSystem.reset();
    this.mapSystems.worldMap.reset(); this.mapSystems.territory.reset();
    this.mapSystems.siege.reset(); this.mapSystems.garrison.reset();
    this.mapSystems.siegeEnhancer.reset();
    // R11: 重置13个缺失子系统
    this.mailSystem.reset(); this.shopSystem.reset(); this.currencySystem.reset();
    this.npcSystem.reset(); this.equipmentSystem.reset();
    this.equipmentForgeSystem.reset(); this.equipmentEnhanceSystem.reset();
    this.prestigeSystem.reset(); this.questSystem.reset();
    this.achievementSystem.reset(); this.heritageSystem.reset();
    this.accountSystem.reset();
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
      heroes: this.hero?.getAllGenerals() ?? [],
      heroFragments: this.hero?.getAllFragments() ?? {},
      totalPower: this.hero?.calculateTotalPower() ?? 0,
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

  // ── 武将系统 API ──

  getHeroSystem(): HeroSystem { return this.hero; }
  getRecruitSystem(): HeroRecruitSystem { return this.heroRecruit; }
  getLevelSystem(): HeroLevelSystem { return this.heroLevel; }
  getFormationSystem(): HeroFormation { return this.heroFormation; }
  getFormations(): FormationData[] { return this.heroFormation.getAllFormations(); }
  getActiveFormation(): FormationData | null { return this.heroFormation.getActiveFormation(); }

  /** 获取升星系统 */
  getHeroStarSystem(): HeroStarSystem { return this.heroStarSystem; }

  /** 获取指定资源数量 */
  getResourceAmount(type: string): number {
    return this.resource.getAmount(type as import('../shared/types').ResourceType);
  }

  /** 获取扫荡系统 */
  getSweepSystem(): SweepSystem { return this.sweepSystem; }

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

  /** 根据关卡构建双方队伍（供 UI 层使用，避免直接依赖 engine-campaign-deps） */
  buildTeamsForStage(stage: Stage) {
    const allyTeam = buildAllyTeam(this.heroFormation, this.hero);
    const enemyTeam = buildEnemyTeam(stage);
    return { allyTeam, enemyTeam };
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

  // ── 地图系统 API ──

  getWorldMapSystem() { return this.mapSystems.worldMap; }
  getTerritorySystem() { return this.mapSystems.territory; }
  getSiegeSystem() { return this.mapSystems.siege; }
  getGarrisonSystem() { return this.mapSystems.garrison; }
  getSiegeEnhancer() { return this.mapSystems.siegeEnhancer; }

  /** 获取融合科技系统 */
  getFusionTechSystem() { return this.techSystems.fusionSystem; }
  /** 获取科技联动系统 */
  getTechLinkSystem() { return this.techSystems.linkSystem; }
  /** 获取离线研究系统 */
  getTechOfflineSystem() { return this.techSystems.offlineSystem; }
  /** 获取科技详情数据提供者 */
  getTechDetailProvider() { return this.techSystems.detailProvider; }

  // ── R11: 13个缺失子系统 getter ──

  /** 获取邮件系统 */
  getMailSystem(): MailSystem { return this.mailSystem; }
  /** 获取商店系统 */
  getShopSystem(): ShopSystem { return this.shopSystem; }
  /** 获取货币系统 */
  getCurrencySystem(): CurrencySystem { return this.currencySystem; }
  /** 获取NPC系统 */
  getNPCSystem(): NPCSystem { return this.npcSystem; }
  /** 获取装备系统 */
  getEquipmentSystem(): EquipmentSystem { return this.equipmentSystem; }
  /** 获取装备锻造系统 */
  getEquipmentForgeSystem(): EquipmentForgeSystem { return this.equipmentForgeSystem; }
  /** 获取装备强化系统 */
  getEquipmentEnhanceSystem(): EquipmentEnhanceSystem { return this.equipmentEnhanceSystem; }
  /** 获取竞技场系统 */
  getArenaSystem(): ArenaSystem { return this.arenaSystem; }
  /** 获取赛季系统 */
  getSeasonSystem(): ArenaSeasonSystem { return this.arenaSeasonSystem; }
  /** 获取排名系统 */
  getRankingSystem(): RankingSystem { return this.rankingSystem; }
  /** 获取远征系统 */
  getExpeditionSystem(): ExpeditionSystem { return this.expeditionSystem; }
  /** 获取联盟系统 */
  getAllianceSystem(): AllianceSystem { return this.allianceSystem; }
  /** 获取联盟任务系统 */
  getAllianceTaskSystem(): AllianceTaskSystem { return this.allianceTaskSystem; }
  /** 获取声望系统 */
  getPrestigeSystem(): PrestigeSystem { return this.prestigeSystem; }
  /** 获取任务系统 */
  getQuestSystem(): QuestSystem { return this.questSystem; }
  /** 获取成就系统 */
  getAchievementSystem(): AchievementSystem { return this.achievementSystem; }
  /** 获取好友系统（社交） */
  getFriendSystem(): FriendSystem { return this.friendSystem; }
  /** 获取传承系统 */
  getHeritageSystem(): HeritageSystem { return this.heritageSystem; }
  /** 获取活动系统 */
  getActivitySystem(): ActivitySystem { return this.activitySystem; }
  /** 获取贸易系统 */
  getTradeSystem(): TradeSystem { return this.tradeSystem; }
  /** 获取设置管理器 */
  getSettingsManager(): SettingsManager { return this.settingsManager; }
  /** 获取账号系统 */
  getAccountSystem(): AccountSystem { return this.accountSystem; }

  // ═══════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════

  private get heroSystems(): HeroSystems {
    return { hero: this.hero, heroRecruit: this.heroRecruit, heroLevel: this.heroLevel };
  }
  private initHeroSystems(deps: ISystemDeps): void {
    initHeroSystems(this.heroSystems, this.resource, deps);
    // 初始化升星系统
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
    // 初始化扫荡系统
    this.sweepSystem.init(deps);
  }
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
    initMapSystems(this.mapSystems, deps);
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

  /** 暴露子系统注册表，供外部面板查询子系统实例 */
  getSubsystemRegistry(): SubsystemRegistry {
    return this.registry;
  }
}
