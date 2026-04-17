/**
 * 三国霸业 — 放置游戏引擎 v3.0
 *
 * 基于统一子系统架构，继承 IdleGameEngine 基类。
 * 使用 13 个可复用子系统模块：BuildingSystem, PrestigeSystem, UnitSystem,
 * StageSystem, BattleSystem, TechTreeSystem, TerritorySystem,
 * FloatingTextSystem, ParticleSystem, StatisticsTracker, UnlockChecker, InputHandler。
 */
import { IdleGameEngine } from '@/engines/idle/IdleGameEngine';
import { BuildingSystem } from '@/engines/idle/modules/BuildingSystem';
import { PrestigeSystem } from '@/engines/idle/modules/PrestigeSystem';
import { UnitSystem, UnitRarity } from '@/engines/idle/modules/UnitSystem';
import { StageSystem } from '@/engines/idle/modules/StageSystem';
import { BattleSystem } from '@/engines/idle/modules/BattleSystem';
import { TechTreeSystem } from '@/engines/idle/modules/TechTreeSystem';
import { TerritorySystem } from '@/engines/idle/modules/TerritorySystem';
import { FloatingTextSystem } from '@/engines/idle/modules/FloatingTextSystem';
import { ParticleSystem } from '@/engines/idle/modules/ParticleSystem';
import { StatisticsTracker } from '@/engines/idle/modules/StatisticsTracker';
import { UnlockChecker } from '@/engines/idle/modules/UnlockChecker';
import { InputHandler } from '@/engines/idle/modules/InputHandler';
import { BattleChallengeSystem } from './BattleChallengeSystem';
import { TutorialStorySystem } from './TutorialStorySystem';
import { MapGenerator } from './MapGenerator';
import { NPCSystem } from './NPCSystem';
import { NPCManager } from '../../engine/npc/NPCManager';
import { THREE_KINGDOMS_NPC_DEFS, THREE_KINGDOMS_SPAWN_CONFIG } from './ThreeKingdomsNPCDefs';
import { QuestSystem, type QuestDef } from '@/engines/idle/modules/QuestSystem';
import { EventSystem, type GameEvent } from '@/engines/idle/modules/EventSystem';
import { RewardSystem } from '@/engines/idle/modules/RewardSystem';
import { DayNightWeatherSystem } from './DayNightWeatherSystem';
import { WeatherSystem } from './WeatherSystem';
import { NPCActivitySystem } from './NPCActivitySystem';
import { GameCalendarSystem } from './GameCalendarSystem';
import { CityMapSystem } from './CityMapSystem';
import { ResourcePointSystem } from './ResourcePointSystem';
import { OfflineRewardSystem } from './OfflineRewardSystem';
import { TradeRouteSystem } from './TradeRouteSystem';
import { EventEnrichmentSystem } from './EventEnrichmentSystem';
import { CampaignSystem } from './CampaignSystem';
import { CampaignBattleSystem, type AttackerArmy, type BattleResult } from './CampaignBattleSystem';
import { AudioManager } from './AudioManager';
import { GeneralDialogueSystem, type DialogueScene, type DialogueMode, type DialogueResult } from './GeneralDialogueSystem';
import { GeneralBondSystem, type BondActivationResult, type GeneralRequest, type BondDialogue } from './GeneralBondSystem';
import { GeneralStoryEventSystem, type ActiveStoryEvent, type StoryLine } from './GeneralStoryEventSystem';
import {
  GAME_ID, GAME_TITLE, BUILDINGS, GENERALS, TERRITORIES, TECHS, BATTLES,
  STAGES, PRESTIGE_CONFIG, COLOR_THEME, RARITY_COLORS, RESOURCES,
  INITIAL_RESOURCES, INITIALLY_UNLOCKED, CLICK_REWARD, FREE_STARTER_HERO,
  type BuildingDef, type GeneralDef, type TerritoryDef, type TechDef,
  type BattleDef, type StageDef,
} from './constants';

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

type ActivePanel = 'none' | 'prestige' | 'tech' | 'territory' | 'battle' | 'generals';

/** 对话事件（用于 UI 显示对话气泡） */
export interface DialogueEvent {
  /** 事件类型 */
  type: 'idle_chat' | 'battle_dialogue' | 'recruit_dialogue' | 'bond_chat' | 'bond_activate' | 'general_request';
  /** 发言者名称 */
  speaker: string;
  /** 对话文本 */
  text: string;
  /** 关联武将 ID */
  generalId?: string;
  /** 羁绊名称（如果是羁绊对话） */
  bondName?: string;
  /** 是否有多行对话 */
  multiLine?: Array<{ speaker: string; text: string }>;
  /** 时间戳 */
  timestamp: number;
}

export interface ThreeKingdomsSaveState {
  resources: Record<string, number>;
  buildings: Record<string, number>;
  generals: Record<string, { level: number; exp: number }>;
  conqueredTerritories: string[];
  completedBattles: string[];
  researchedTechs: string[];
  currentStage: string;
  prestigeState: { currency: number; count: number };
  gameStats: string;
  totalPlayTime: number;
  cityMaps?: object;
  resourcePoints?: object;
  offlineReward?: object;
  tradeRoutes?: object;
  eventEnrichment?: object;
  campaign?: object;
  campaignBattle?: object;
  audio?: { muted: boolean; volume: number };
  weather?: any;
  bondSystem?: { activatedBonds: string[]; requestCounter: number };
  storyEvents?: { triggeredEvents: string[] };
  battlesWonCount?: number;
}

// ═══════════════════════════════════════════════════════════════
// 引擎
// ═══════════════════════════════════════════════════════════════

export class ThreeKingdomsEngine extends IdleGameEngine {
  protected _gameId = GAME_ID;

  // 子系统
  private bldg!: BuildingSystem<BuildingDef>;
  private prest!: PrestigeSystem;
  private units!: UnitSystem;
  private stages!: StageSystem<StageDef>;
  private battles!: BattleSystem<BattleDef>;
  private techs!: TechTreeSystem<TechDef>;
  private terr!: TerritorySystem<TerritoryDef>;
  private ftSys!: FloatingTextSystem;
  private ptSys!: ParticleSystem;
  private stats!: StatisticsTracker;
  private unlock!: UnlockChecker;
  private input!: InputHandler;
  private battleChallenges!: BattleChallengeSystem;
  private tutorialStory!: TutorialStorySystem;
  private mapGen!: MapGenerator;
  private npcSys!: NPCSystem;
  private npcManager!: NPCManager;
  private questSys!: QuestSystem;
  private eventSys!: EventSystem;
  private rewardSys!: RewardSystem;
  private dayNightWeather!: DayNightWeatherSystem;
  private npcActivitySys!: NPCActivitySystem;
  private calendar!: GameCalendarSystem;
  private cityMapSys!: CityMapSystem;
  private resourcePointSys!: ResourcePointSystem;
  private offlineRewardSys!: OfflineRewardSystem;
  private tradeRouteSys!: TradeRouteSystem;
  private eventEnrichSys!: EventEnrichmentSystem;

  /** 程序化音频管理器 */
  public audioManager: AudioManager = new AudioManager();

  /** 天气系统 */
  public weatherSystem = new WeatherSystem();

  /** 武将对话系统 */
  public dialogueSystem = new GeneralDialogueSystem();

  /** 武将羁绊系统 */
  public bondSystem = new GeneralBondSystem();

  /** 武将剧情事件系统 */
  public storyEventSystem = new GeneralStoryEventSystem();

  /** 对话事件回调（由 UI 层设置，用于显示对话气泡） */
  public onDialogueEvent?: (event: DialogueEvent) => void;

  /** 剧情事件回调（由 UI 层设置，用于显示剧情面板） */
  public onStoryEvent?: (event: ActiveStoryEvent) => void;

  /** 武将请求回调 */
  public onGeneralRequest?: (request: GeneralRequest) => void;

  /** 对话自动触发计时器（秒） */
  private dialogueTimer: number = 0;

  /** 对话自动触发间隔（30-60秒随机） */
  private dialogueInterval: number = 45;

  /** 武将请求触发计时器 */
  private requestTimer: number = 0;

  /** 武将请求触发间隔（90-180秒随机） */
  private requestInterval: number = 120;

  /** 羁绊闲聊计时器 */
  private bondChatTimer: number = 0;

  /** 羁绊闲聊间隔（60-120秒随机） */
  private bondChatInterval: number = 90;

  /** 已完成的战斗数（用于触发剧情） */
  private battlesWonCount: number = 0;

  /** 征战关卡系统 */
  private campaignSys!: CampaignSystem;

  /** 征战关卡战斗系统 */
  private campaignBattleSys!: CampaignBattleSystem;

  // 状态
  private res: Record<string, number> = {};
  private psCache: Record<string, number> = {};
  private panel: ActivePanel = 'none';
  private selIdx = 0;
  private scroll = 0;
  private playTime = 0;

  /** 当前选中的 NPC ID */
  private selectedNPC: string | null = null;

  /** NPC 点击回调（由 UI 层设置） */
  public onNPCClicked?: (npcId: string) => void;

  // ─── 生命周期 ───────────────────────────────────────────

  protected onInit(): void {
    super.onInit();
    this.res = { ...INITIAL_RESOURCES };

    this.bldg = new BuildingSystem<BuildingDef>({ initiallyUnlocked: INITIALLY_UNLOCKED });
    this.bldg.register(BUILDINGS);

    this.prest = new PrestigeSystem(PRESTIGE_CONFIG);
    this.units = new UnitSystem(this.toUnitDefs());
    this.stages = new StageSystem<StageDef>(STAGES, 'yellow_turban');
    this.battles = new BattleSystem<BattleDef>(BATTLES);
    this.techs = new TechTreeSystem<TechDef>(TECHS);
    this.terr = new TerritorySystem<TerritoryDef>(TERRITORIES);
    this.ftSys = new FloatingTextSystem();
    this.ptSys = new ParticleSystem();
    this.stats = new StatisticsTracker(this.makeStatDefs());
    this.unlock = new UnlockChecker();
    this.input = new InputHandler({
      bindings: [
        { key: 't', action: 'custom', actionId: 'toggle_tech' },
        { key: 'T', action: 'custom', actionId: 'toggle_tech' },
        { key: 'm', action: 'custom', actionId: 'toggle_territory' },
        { key: 'M', action: 'custom', actionId: 'toggle_territory' },
        { key: 'b', action: 'custom', actionId: 'toggle_battle' },
        { key: 'B', action: 'custom', actionId: 'toggle_battle' },
        { key: 'u', action: 'custom', actionId: 'toggle_generals' },
        { key: 'U', action: 'custom', actionId: 'toggle_generals' },
      ],
    });
    this.bindInput();

    // ── Phase 6.1 新系统 ──
    this.battleChallenges = new BattleChallengeSystem();
    this.tutorialStory = new TutorialStorySystem();
    this.mapGen = new MapGenerator(42);
    this.npcSys = new NPCSystem();

    // ── 通用 NPC 引擎集成 ──
    this.npcManager = new NPCManager();
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      this.npcManager.registerDef(def);
    }
    // 在地图城市/村庄位置 spawn 所有 NPC
    for (const def of THREE_KINGDOMS_NPC_DEFS) {
      const spawn = THREE_KINGDOMS_SPAWN_CONFIG[def.id];
      if (spawn) {
        this.npcManager.spawnNPC(def.id, spawn.x, spawn.y);
      }
    }

    // ── 通用引擎系统集成 ──
    this.questSys = new QuestSystem({ dailyRefreshHour: 0, weeklyRefreshDay: 1 });
    this.eventSys = new EventSystem();
    this.rewardSys = new RewardSystem();
    this.registerThreeKingdomsQuests();
    this.registerThreeKingdomsEvents();

    // ── 昼夜天气系统 ──
    this.dayNightWeather = new DayNightWeatherSystem();

    // ── NPC 职业活动系统 ──
    this.npcActivitySys = new NPCActivitySystem();

    // ── 游戏日历系统 ──
    this.calendar = new GameCalendarSystem();

    // ── 城市地图系统 ──
    this.cityMapSys = new CityMapSystem();

    // ── 野外资源点系统 ──
    this.resourcePointSys = new ResourcePointSystem();

    // ── 离线收益系统 ──
    this.offlineRewardSys = new OfflineRewardSystem();

    // ── 贸易路线系统 ──
    this.tradeRouteSys = new TradeRouteSystem();

    // ── 丰富事件系统 ──
    this.eventEnrichSys = new EventEnrichmentSystem();

    // ── 征战关卡系统 ──
    this.campaignSys = new CampaignSystem();
    this.campaignBattleSys = new CampaignBattleSystem();

    this.panel = 'none';
    this.selIdx = 0;
    this.scroll = 0;
    this.playTime = 0;
    this.psCache = {};

    // ── 新手福利：免费赠送一个 uncommon 武将 ──
    this.grantFreeStarterGeneral();

    // ── 为已有领土生成城市地图 ──
    this.generateCityMapsForConqueredTerritories();

    // ── 为地图生成资源点 ──
    this.generateResourcePointsFromMap();

    // ── 程序化音频系统 ──
    this.audioManager.init();

    this.emit('stateChange');
  }

  /**
   * 新手福利：赠送 FREE_STARTER_HERO 指定的 uncommon 武将（免费抽卡）。
   * 不消耗任何资源，直接解锁招募。
   */
  private grantFreeStarterGeneral(): void {
    const chosen = GENERALS.find(g => g.id === FREE_STARTER_HERO);
    if (!chosen) return;
    const result = this.units.unlock(chosen.id);
    if (result.ok) {
      this.stats.increment('totalGeneralsRecruited');
      this.ftSys.add(`🎉 免费武将：${chosen.name}！`, 0.5, 0.3, {
        style: { color: '#4caf50', fontSize: 20 },
      });
    }
  }

  /** 获取免费赠送的初始武将名称（供 UI 引导使用） */
  public getStarterGeneralName(): string | null {
    const chosen = GENERALS.find(g => g.id === FREE_STARTER_HERO);
    if (!chosen) return null;
    return this.units.isUnlocked(chosen.id) ? chosen.name : null;
  }

  /**
   * 为所有已征服领土生成城市地图
   * 在 onInit 和 load 时调用
   */
  private generateCityMapsForConqueredTerritories(): void {
    const conquered = this.terr.getConqueredIds();
    for (const tId of conquered) {
      const def = TERRITORIES.find(t => t.id === tId);
      if (def && !this.cityMapSys.getCityMap(tId)) {
        this.cityMapSys.generateCityMap(tId, def.name, def.type);
      }
    }
  }

  /**
   * 从地图生成器瓦片数据生成资源点
   */
  private generateResourcePointsFromMap(): void {
    try {
      const gameMap = this.mapGen.generate();
      if (gameMap && gameMap.tiles) {
        this.resourcePointSys.generateResourcePoints(gameMap.tiles);
      }
    } catch {
      // MapGenerator 可能未初始化，静默忽略
    }
  }

  // ─── 更新 ───────────────────────────────────────────────

  protected onUpdate(dt: number): void {
    const sec = dt / 1000;
    this.playTime += sec;

    // 全局倍率
    const sMult = this.stages.getMultiplier('production');
    const pMult = this.prest.getMultiplier();
    const tMult = this.techMult();
    const gMult = sMult * pMult * tMult;

    // 建筑产出
    const prod = this.bldg.getTotalProduction();
    this.psCache = {};
    for (const [r, rate] of Object.entries(prod)) {
      if (rate > 0) {
        const adj = rate * gMult;
        this.psCache[r] = adj;
        this.giveRes(r, adj * sec);
      }
    }

    // 领土收益
    const inc = this.terr.getIncomePerSecond();
    for (const [r, amt] of Object.entries(inc)) {
      if (amt > 0) this.giveRes(r, amt * sec);
    }

    // 子系统更新
    this.battles.update(dt);
    this.techs.update(dt);
    this.terr.update(dt);
    this.ftSys.update(dt);
    this.ptSys.update(dt);
    this.calendar.update(sec);

    // 城市地图更新（繁荣度/人口增长）
    this.cityMapSys.getAllCities().forEach(city => {
      this.cityMapSys.updateCity(city.cityId, dt);
    });

    // 资源点产出累加到引擎资源
    const resourceOutput = this.resourcePointSys.calculateOutput(dt);
    for (const [resId, amount] of Object.entries(resourceOutput)) {
      if (amount > 0) this.giveRes(resId, amount);
    }

    // 通用 NPC 引擎更新（以游戏内时间驱动）
    const gameHour = (this.playTime / 60) % 24; // 简化：60 秒 = 1 游戏小时
    this.npcManager.update(sec, gameHour);

    // 昼夜天气系统更新
    this.dayNightWeather.update(sec, gameHour);

    // 天气系统更新
    this.weatherSystem.update(sec);

    // NPC 职业活动 — 资源产出/消耗接入引擎资源系统
    const allNpcs = this.npcManager.getAllNPCs();
    for (const npc of allNpcs) {
      const profession = npc.profession as string;
      const result = this.npcActivitySys.updateNPC(npc.id, profession, sec);
      if (result.produced) {
        const { type, amount } = result.produced;
        // 将 NPC 产出资源映射到引擎资源 ID
        if (type === 'food' || type === 'grain') this.giveRes('grain', amount);
        else if (type === 'gold' || type === 'coins') this.giveRes('gold', amount);
        else if (type === 'tech' || type === 'techPoints') this.giveRes('techPoints', amount);
        else if (type === 'intel') this.giveRes('intel', amount);
        else this.giveRes(type, amount); // 兜底：直接使用产出资源类型
      }
      if (result.consumed) {
        const { type, amount } = result.consumed;
        if (type === 'food' || type === 'grain') this.giveRes('grain', -amount);
        else if (type === 'gold' || type === 'coins') this.giveRes('gold', -amount);
        else if (type === 'tech' || type === 'techPoints') this.giveRes('techPoints', -amount);
        else if (type === 'intel') this.giveRes('intel', -amount);
        else this.giveRes(type, -amount);
      }
    }

    // 战斗结算
    const bState = this.battles.getCurrentState();
    if (bState.currentWave && bState.aliveEnemies.length === 0) {
      this.onWaveClear();
    }

    // 阶段检查
    this.checkStage();
    this.checkUnlocks();

    // 通用引擎系统更新
    this.eventSys.updateEventStatuses(Date.now());

    // ── 贸易路线系统更新 ──
    const currentDate = this.calendar.getCurrentDate();
    const currentMinute = Math.floor(currentDate.year * 525600 + currentDate.day * 1440 + currentDate.hour * 60 + currentDate.minute);
    const tradeResult = this.tradeRouteSys.updateTrade(currentMinute, sec);
    if (tradeResult.totalProfit > 0) {
      this.giveRes('gold', Math.floor(tradeResult.totalProfit));
    }

    // ── 丰富事件系统触发检查 ──
    this.eventEnrichSys.checkTriggers({
      currentMinute,
      season: currentDate.season,
      ownedTerritories: this.terr.getConqueredIds(),
      resources: this.res,
      heroCount: this.units.getUnits().length,
      armySize: Math.floor(this.res.troops || 0),
    });

    // ── 武将对话自动触发 ──
    this.updateDialogueTriggers(sec);
  }

  // ─── 渲染 ───────────────────────────────────────────────

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBg(ctx, w, h);
    this.drawHeader(ctx, w);
    this.drawResBar(ctx, w);

    const cy = 100, ch = h - 145;
    switch (this.panel) {
      case 'none': this.drawBuildings(ctx, w, cy, ch); break;
      case 'prestige': this.drawPrestige(ctx, w, cy, ch); break;
      case 'tech': this.drawTech(ctx, w, cy, ch); break;
      case 'territory': this.drawTerritory(ctx, w, cy, ch); break;
      case 'battle': this.drawBattle(ctx, w, cy, ch); break;
      case 'generals': this.drawGenerals(ctx, w, cy, ch); break;
    }

    this.drawFooter(ctx, w, h);
    this.ftSys.render(ctx);
    this.ptSys.render(ctx);
  }

  // ─── 输入 ───────────────────────────────────────────────

  public handleKeyDown(key: string): void {
    this.input.handleKeyDown(key);
  }

  private bindInput(): void {
    this.input.on('click', () => this.doClick());
    this.input.on('select_down', () => {
      const n = this.bldg.getUnlockedBuildings().length;
      this.selIdx = Math.min(this.selIdx + 1, n - 1);
    });
    this.input.on('select_up', () => {
      this.selIdx = Math.max(this.selIdx - 1, 0);
    });
    this.input.on('confirm', () => this.buyBuilding());
    this.input.on('prestige', () => this.toggle('prestige'));
    this.input.on('cancel', () => { this.panel = 'none'; });
    this.input.on('custom', (e) => {
      const map: Record<string, ActivePanel> = {
        toggle_tech: 'tech', toggle_territory: 'territory',
        toggle_battle: 'battle', toggle_generals: 'generals',
      };
      const p = map[e.actionId || ''];
      if (p) this.toggle(p);
    });
  }

  // ─── 序列化 ─────────────────────────────────────────────

  public serialize(): ThreeKingdomsSaveState {
    const gens: Record<string, { level: number; exp: number }> = {};
    for (const g of GENERALS) {
      const s = this.units.getState(g.id);
      if (s?.unlocked) gens[g.id] = { level: s.level, exp: s.exp };
    }
    return {
      resources: { ...this.res },
      buildings: this.bldg.saveState(),
      generals: gens,
      conqueredTerritories: this.terr.getConqueredIds(),
      completedBattles: [], // derived from battle state
      researchedTechs: (this.techs.saveState().researched as string[]) || [],
      currentStage: this.stages.getCurrentId(),
      prestigeState: { currency: this.prest.getState().currency, count: this.prest.getState().count },
      gameStats: this.stats.serialize(),
      totalPlayTime: this.playTime,
      cityMaps: this.cityMapSys.serialize(),
      resourcePoints: this.resourcePointSys.serialize(),
      offlineReward: this.offlineRewardSys.serialize(),
      tradeRoutes: this.tradeRouteSys.serialize(),
      eventEnrichment: this.eventEnrichSys.serialize(),
      campaign: this.campaignSys.serialize(),
      campaignBattle: this.campaignBattleSys.serialize(),
      audio: this.audioManager.serialize(),
      weather: this.weatherSystem.serialize(),
      bondSystem: this.bondSystem.serialize(),
      storyEvents: this.storyEventSystem.serialize(),
      battlesWonCount: this.battlesWonCount,
    };
  }

  public deserialize(d: ThreeKingdomsSaveState): void {
    this.res = { ...d.resources };
    this.bldg.loadState(d.buildings);
    for (const [id, g] of Object.entries(d.generals)) {
      this.units.loadState({ [id]: { defId: id, level: g.level, exp: g.exp, unlocked: true,
        currentEvolutionBranch: null, evolutionStartTime: null, equippedIds: [] } });
    }
    for (const tId of d.conqueredTerritories) this.terr.conquer(tId);
    this.techs.loadState({ researched: d.researchedTechs, current: null, queue: [], totalInvestment: {} });
    this.stages.loadState({ currentStageId: d.currentStage });
    const ps = d.prestigeState;
    this.prest.loadState({ currency: ps.currency, count: ps.count });
    if (d.gameStats) this.stats.deserialize(d.gameStats);
    this.playTime = d.totalPlayTime || 0;

    // 反序列化新系统
    if (d.cityMaps) this.cityMapSys.deserialize(d.cityMaps);
    if (d.resourcePoints) this.resourcePointSys.deserialize(d.resourcePoints);
    if (d.offlineReward) this.offlineRewardSys.deserialize(d.offlineReward as Record<string, unknown>);
    if (d.tradeRoutes) this.tradeRouteSys.deserialize(d.tradeRoutes);
    if (d.eventEnrichment) this.eventEnrichSys.deserialize(d.eventEnrichment);
    if (d.campaign) this.campaignSys.deserialize(d.campaign);
    if (d.campaignBattle) this.campaignBattleSys.deserialize(d.campaignBattle);
    if (d.audio) this.audioManager.deserialize(d.audio);
    if (d.weather) this.weatherSystem.deserialize(d.weather);
    if (d.bondSystem) this.bondSystem.deserialize(d.bondSystem);
    if (d.storyEvents) this.storyEventSystem.deserialize(d.storyEvents);
    this.battlesWonCount = d.battlesWonCount ?? 0;

    // 重新检查已激活羁绊
    const recruitedIds = this.getRecruitedGeneralIds();
    this.bondSystem.checkAndActivateBonds(recruitedIds);

    this.emit('stateChange');
  }

  // ─── 武将对话触发系统 ─────────────────────────────────

  /**
   * 更新对话触发计时器，自动触发闲聊/羁绊/请求
   */
  private updateDialogueTriggers(sec: number): void {
    const recruitedIds = this.getRecruitedGeneralIds();
    if (recruitedIds.length === 0) return;

    // ── 随机闲聊触发 ──
    this.dialogueTimer += sec;
    if (this.dialogueTimer >= this.dialogueInterval) {
      this.dialogueTimer = 0;
      this.dialogueInterval = 30 + Math.random() * 30; // 30-60秒
      this.triggerRandomIdleChat(recruitedIds);
    }

    // ── 羁绊闲聊触发 ──
    this.bondChatTimer += sec;
    if (this.bondChatTimer >= this.bondChatInterval) {
      this.bondChatTimer = 0;
      this.bondChatInterval = 60 + Math.random() * 60; // 60-120秒
      this.triggerBondChat(recruitedIds);
    }

    // ── 武将请求触发 ──
    this.requestTimer += sec;
    if (this.requestTimer >= this.requestInterval) {
      this.requestTimer = 0;
      this.requestInterval = 90 + Math.random() * 90; // 90-180秒
      this.triggerGeneralRequest(recruitedIds);
    }
  }

  /**
   * 触发随机武将闲聊
   */
  private triggerRandomIdleChat(recruitedIds: string[]): void {
    const generalId = recruitedIds[Math.floor(Math.random() * recruitedIds.length)];
    const dialogue = this.dialogueSystem.getDialogue(generalId, 'idle', 'chat');
    const name = this.dialogueSystem.getGeneralName(generalId);

    this.onDialogueEvent?.({
      type: 'idle_chat',
      speaker: name,
      text: dialogue.text,
      generalId,
      timestamp: Date.now(),
    });
  }

  /**
   * 触发羁绊闲聊
   */
  private triggerBondChat(recruitedIds: string[]): void {
    const dialogue = this.bondSystem.getBondChatDialogue(recruitedIds, this.playTime, 60);
    if (!dialogue) return;

    this.onDialogueEvent?.({
      type: 'bond_chat',
      speaker: dialogue.lines[0]?.speaker ?? '众将',
      text: dialogue.lines[0]?.text ?? '',
      multiLine: dialogue.lines,
      timestamp: Date.now(),
    });
  }

  /**
   * 触发武将请求
   */
  private triggerGeneralRequest(recruitedIds: string[]): void {
    const request = this.bondSystem.generateRandomRequest(recruitedIds);
    if (!request) return;

    this.onGeneralRequest?.(request);

    this.onDialogueEvent?.({
      type: 'general_request',
      speaker: request.generalName,
      text: request.content,
      generalId: request.generalId,
      timestamp: Date.now(),
    });
  }

  /**
   * 触发战斗对话（战斗开始时调用）
   */
  public triggerBattleDialogue(): void {
    const recruitedIds = this.getRecruitedGeneralIds();
    if (recruitedIds.length === 0) return;

    // 先检查羁绊战斗对话
    const bondDialogue = this.bondSystem.getBattleDialogue(recruitedIds);
    if (bondDialogue) {
      this.onDialogueEvent?.({
        type: 'battle_dialogue',
        speaker: bondDialogue.lines[0]?.speaker ?? '武将',
        text: bondDialogue.lines[0]?.text ?? '',
        multiLine: bondDialogue.lines,
        timestamp: Date.now(),
      });
      return;
    }

    // 否则使用普通战斗对话
    const generalId = recruitedIds[Math.floor(Math.random() * recruitedIds.length)];
    const dialogue = this.dialogueSystem.getDialogue(generalId, 'battle', 'chat');
    const name = this.dialogueSystem.getGeneralName(generalId);

    this.onDialogueEvent?.({
      type: 'battle_dialogue',
      speaker: name,
      text: dialogue.text,
      generalId,
      timestamp: Date.now(),
    });
  }

  /**
   * 触发招募对话
   */
  public triggerRecruitDialogue(generalId: string): void {
    const dialogue = this.dialogueSystem.getDialogue(generalId, 'recruit', 'chat');
    const name = this.dialogueSystem.getGeneralName(generalId);

    this.onDialogueEvent?.({
      type: 'recruit_dialogue',
      speaker: name,
      text: dialogue.text,
      generalId,
      timestamp: Date.now(),
    });

    // 检查羁绊激活
    const recruitedIds = this.getRecruitedGeneralIds();
    const activations = this.bondSystem.checkAndActivateBonds(recruitedIds);
    for (const activation of activations) {
      if (activation.newlyActivated && activation.dialogue) {
        this.onDialogueEvent?.({
          type: 'bond_activate',
          speaker: activation.dialogue.lines[0]?.speaker ?? '众将',
          text: activation.dialogue.lines[0]?.text ?? '',
          bondName: activation.bondName,
          multiLine: activation.dialogue.lines,
          timestamp: Date.now(),
        });
      }
    }

    // 检查剧情事件
    this.storyEventSystem.checkTriggers({ type: 'recruit', targetId: generalId });
    this.checkAndShowStoryEvent();
  }

  /**
   * 获取已招募武将 ID 列表
   */
  public getRecruitedGeneralIds(): string[] {
    const ids: string[] = [];
    for (const g of GENERALS) {
      if (this.units.isUnlocked(g.id)) {
        ids.push(g.id);
      }
    }
    return ids;
  }

  /**
   * 获取武将对话（供 UI 调用）
   */
  public getGeneralDialogue(generalId: string, scene: DialogueScene, mode: DialogueMode = 'chat'): DialogueResult {
    return this.dialogueSystem.getDialogue(generalId, scene, mode);
  }

  /**
   * 获取武将羁绊信息（供 UI 调用）
   */
  public getGeneralBonds(generalId: string) {
    return this.bondSystem.getBondsForGeneral(generalId);
  }

  /**
   * 获取所有已激活羁绊（供 UI 调用）
   */
  public getActivatedBonds() {
    return this.bondSystem.getActivatedBonds();
  }

  /**
   * 获取羁绊总加成（供 UI 调用）
   */
  public getBondBonus() {
    return this.bondSystem.getTotalBondBonus();
  }

  /**
   * 获取当前剧情事件（供 UI 调用）
   */
  public getCurrentStoryEvent(): ActiveStoryEvent | null {
    return this.storyEventSystem.getNextEvent();
  }

  /**
   * 推进剧情事件（供 UI 调用）
   */
  public advanceStoryEvent(): boolean {
    return this.storyEventSystem.advanceLine();
  }

  /**
   * 完成当前剧情事件并获取奖励
   */
  public completeStoryEvent(): Record<string, number> | null {
    const reward = this.storyEventSystem.completeCurrentEvent();
    if (reward) {
      for (const [key, value] of Object.entries(reward)) {
        this.giveRes(key, value);
      }
    }
    return reward;
  }

  /**
   * 跳过当前剧情事件
   */
  public skipStoryEvent(): void {
    this.storyEventSystem.skipCurrentEvent();
  }

  /**
   * 检查并显示剧情事件
   */
  private checkAndShowStoryEvent(): void {
    const event = this.storyEventSystem.getNextEvent();
    if (event) {
      this.onStoryEvent?.(event);
    }
  }

  // ─── 声望转生 ───────────────────────────────────────────

  public doPrestige(): void {
    const total = (this.res.grain || 0) + (this.res.gold || 0) + (this.res.troops || 0);
    const preview = this.prest.getPreview(total);
    if (!preview.canPrestige) return;

    const result = this.prest.doPrestige(total);
    if (!result) return;

    const ret = PRESTIGE_CONFIG.retention;
    this.res.grain = (this.res.grain || 0) * ret;
    this.res.gold = (this.res.gold || 0) * ret;
    this.res.troops = (this.res.troops || 0) * ret;

    // 重置建筑和阶段
    this.bldg.reset(true); // keep unlocked, reset levels
    this.stages.loadState({ currentStageId: 'yellow_turban' });
    // 保留：武将、声望、领土、科技

    this.stats.increment('totalPrestiges');
    this.ftSys.add('声望转生！天命加持！', 0.5, 0.4, { style: { color: COLOR_THEME.accentGold, fontSize: 24 } });
    this.emit('stateChange');
  }

  // ═══════════════════════════════════════════════════════════
  // 核心操作
  // ═══════════════════════════════════════════════════════════

  private doClick(): void {
    if (this._status !== 'playing') return;
    this.audioManager.playSFX('click');
    for (const [r, a] of Object.entries(CLICK_REWARD)) this.giveRes(r, a);
    for (const [r, rate] of Object.entries(this.psCache)) {
      if (rate > 0) this.giveRes(r, rate * 0.1);
    }
    this.stats.increment('totalClicks');
    this.emit('stateChange');
  }

  private buyBuilding(): void {
    const bs = this.bldg.getUnlockedBuildings();
    if (this.selIdx >= bs.length) return;
    const b = bs[this.selIdx];
    const cost = this.bldg.getCost(b.id);
    if (!this.canPay(cost)) return;
    this.pay(cost);
    this.bldg.purchase(b.id, (id, a) => this.has(id, a), () => {});
    this.audioManager.playSFX('build');
    this.ftSys.add(`+1 ${b.name}`, 0.5, 0.5, { style: { color: COLOR_THEME.accentGreen, fontSize: 14 } });
    this.emit('stateChange');
  }

  private onWaveClear(): void {
    const rewards = this.battles.settleWave();
    for (const [r, a] of Object.entries(rewards.rewards)) this.giveRes(r, a);
    this.stats.increment('totalBattlesWon');
    this.battlesWonCount++;
    this.audioManager.playSFX('battle');
    this.ftSys.add('战斗胜利！', 0.5, 0.5, { style: { color: COLOR_THEME.accentGreen, fontSize: 18 } });

    // 触发战斗胜利对话
    this.triggerBattleDialogue();

    // 检查战斗胜利剧情事件
    this.storyEventSystem.checkTriggers({ type: 'battle_win' }, this.battlesWonCount);
    this.checkAndShowStoryEvent();
  }

  // ═══════════════════════════════════════════════════════════
  // 资源
  // ═══════════════════════════════════════════════════════════

  private giveRes(id: string, amt: number): void {
    this.res[id] = Math.max(0, (this.res[id] || 0) + amt);
    if (amt > 0) {
      const k = `total${id[0].toUpperCase()}${id.slice(1)}`;
      this.stats.increment(k, amt);
    }
  }
  private canPay(cost: Record<string, number>): boolean {
    return Object.entries(cost).every(([id, a]) => (this.res[id] || 0) >= a);
  }
  private pay(cost: Record<string, number>): void {
    for (const [id, a] of Object.entries(cost)) this.res[id] = Math.max(0, (this.res[id] || 0) - a);
  }
  private has(id: string, a: number): boolean { return (this.res[id] || 0) >= a; }

  // ═══════════════════════════════════════════════════════════
  // 辅助
  // ═══════════════════════════════════════════════════════════

  private techMult(): number {
    let m = 1;
    for (const t of TECHS) {
      if (this.techs.isResearched(t.id)) {
        for (const e of t.effects) {
          if (e.type === 'multiplier' && (e.target === 'all_resources' || e.target === 'all')) m *= e.value;
        }
      }
    }
    return m;
  }

  private checkStage(): void {
    const next = this.stages.getNextStage();
    if (!next) return;
    const can = Object.entries(next.requiredResources).every(([id, a]) => (this.res[id] || 0) >= a);
    if (can) {
      this.stages.advance(this.res, (_type: string, targetId: string) => this.res[targetId] || 0);
      this.ftSys.add(`阶段解锁：${next.name}`, 0.5, 0.3, { style: { color: COLOR_THEME.accentGold, fontSize: 22 } });
    }
  }

  private checkUnlocks(): void {
    for (const b of BUILDINGS) {
      if (this.bldg.isUnlocked(b.id) || !b.requires?.length) continue;
      if (b.requires.every(r => this.bldg.getLevel(r) > 0)) this.bldg.forceUnlock(b.id);
    }
  }

  private toggle(p: ActivePanel): void {
    this.panel = this.panel === p ? 'none' : p;
    this.scroll = 0;
  }

  private toUnitDefs() {
    const rMap: Record<string, number> = { uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    return GENERALS.map(g => ({
      id: g.id, name: g.name, description: g.evolution,
      rarity: rMap[g.rarity] ?? 0,
      baseStats: { ...g.baseStats }, growthRates: { ...g.growthRates },
      evolutions: [],
      recruitCost: Object.entries(g.recruitCost).map(([materialId, quantity]) => ({ materialId, quantity })),
      maxLevel: 50, tags: [g.faction, g.rarity], passiveSkillIds: [],
    }));
  }

  private makeStatDefs() {
    const ids = [
      'totalGrain', 'totalGold', 'totalTroops', 'totalDestiny',
      'totalClicks', 'totalBattlesWon', 'totalTerritoriesConquered',
      'totalPrestiges', 'totalGeneralsRecruited', 'totalTechsResearched', 'totalPlayTime',
    ];
    return ids.map(id => ({
      id, displayName: id, category: 'game',
      valueType: 'number' as const, aggregation: 'sum' as const,
      initialValue: 0, linkedAchievementIds: [], persistent: true,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════

  private drawBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, COLOR_THEME.bgGradient1);
    g.addColorStop(1, COLOR_THEME.bgGradient2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawHeader(ctx: CanvasRenderingContext2D, w: number): void {
    const stage = this.stages.getCurrent();
    ctx.fillStyle = COLOR_THEME.accentGold;
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(GAME_TITLE, w / 2, 22);
    ctx.textAlign = 'left';
    if (stage) {
      ctx.fillStyle = stage.themeColor || COLOR_THEME.textSecondary;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${stage.iconAsset} ${stage.name} — ${stage.description}`, 10, 42);
    }
    // 面板标签
    const tabs = [
      { id: 'none' as ActivePanel, label: '🏗️建筑' },
      { id: 'generals' as ActivePanel, label: '⚔️武将' },
      { id: 'territory' as ActivePanel, label: '🗺️领土' },
      { id: 'tech' as ActivePanel, label: '📜科技' },
      { id: 'battle' as ActivePanel, label: '🔥战斗' },
      { id: 'prestige' as ActivePanel, label: '👑声望' },
    ];
    const tw = (w - 20) / tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      const active = this.panel === tabs[i].id;
      ctx.fillStyle = active ? COLOR_THEME.selectedBg : COLOR_THEME.panelBg;
      rr(ctx, 10 + i * tw, 50, tw - 2, 28, 4); ctx.fill();
      if (active) { ctx.strokeStyle = COLOR_THEME.selectedBorder; ctx.lineWidth = 1; rr(ctx, 10 + i * tw, 50, tw - 2, 28, 4); ctx.stroke(); }
      ctx.fillStyle = active ? COLOR_THEME.accentGold : COLOR_THEME.textSecondary;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tabs[i].label, 10 + i * tw + (tw - 2) / 2, 68);
      ctx.textAlign = 'left';
    }
  }

  private drawResBar(ctx: CanvasRenderingContext2D, w: number): void {
    const y = 88;
    ctx.fillStyle = COLOR_THEME.panelBg;
    rr(ctx, 5, y - 10, w - 10, 18, 3); ctx.fill();
    const cw = (w - 10) / RESOURCES.length;
    for (let i = 0; i < RESOURCES.length; i++) {
      const r = RESOURCES[i];
      const v = fmt(this.res[r.id] || 0);
      const ps = this.psCache[r.id];
      const psT = ps > 0 ? `+${fmt(ps)}/s` : '';
      ctx.fillStyle = COLOR_THEME.textPrimary;
      ctx.font = '11px sans-serif';
      ctx.fillText(`${r.icon}${v}`, 10 + i * cw, y);
      if (psT) { ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '9px sans-serif'; ctx.fillText(psT, 10 + i * cw, y + 10); }
    }
  }

  private drawBuildings(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const bs = this.bldg.getUnlockedBuildings();
    const ih = 55, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(bs.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= bs.length) break;
      const d = bs[idx], lv = this.bldg.getLevel(d.id), cost = this.bldg.getCost(d.id);
      const ok = this.canPay(cost), sel = idx === this.selIdx, iy = sy + i * ih;
      ctx.fillStyle = sel ? COLOR_THEME.selectedBg : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      if (sel) { ctx.strokeStyle = COLOR_THEME.selectedBorder; ctx.lineWidth = 1; rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.stroke(); }
      ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '13px sans-serif';
      ctx.fillText(`${d.icon} ${d.name} Lv.${lv}`, 18, iy + 18);
      const pr = lv > 0 ? (this.psCache[d.productionResource] || 0) : 0;
      ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '10px sans-serif';
      ctx.fillText(`产出: ${fmt(pr)}/s`, 18, iy + 35);
      const cs = Object.entries(cost).map(([, c]) => fmt(c)).join('+');
      ctx.fillStyle = ok ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
      ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`升级: ${cs}`, w - 18, iy + 26);
      ctx.textAlign = 'left';
    }
  }

  private drawPrestige(ctx: CanvasRenderingContext2D, w: number, sy: number, _h: number): void {
    const st = this.prest.getState();
    const total = (this.res.grain || 0) + (this.res.gold || 0) + (this.res.troops || 0);
    const pv = this.prest.getPreview(total);
    ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('👑 声望转生', 18, sy + 22);
    ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '12px sans-serif';
    let y = sy + 44;
    const lines = [
      `天命: ${fmt(st.currency)} | 转生: ${st.count}次`,
      `当前倍率: ×${st.multiplier.toFixed(2)}`,
      `本次获得: ${pv.gain} 天命`,
      `新倍率: ×${pv.newMultiplier.toFixed(2)}`,
      `资源保留: ${(pv.retentionRate * 100).toFixed(0)}%`,
    ];
    for (const l of lines) { ctx.fillText(l, 18, y); y += 20; }
    if (pv.warning) { ctx.fillStyle = COLOR_THEME.textDim; ctx.fillText(pv.warning, 18, y); }
    y += 30;
    ctx.fillStyle = pv.canPrestige ? 'rgba(255,215,0,0.2)' : COLOR_THEME.panelBg;
    rr(ctx, w / 2 - 70, y, 140, 32, 6); ctx.fill();
    ctx.fillStyle = pv.canPrestige ? COLOR_THEME.accentGold : COLOR_THEME.textDim;
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pv.canPrestige ? '执行转生 (R)' : '资源不足', w / 2, y + 20);
    ctx.textAlign = 'left';
  }

  private drawTech(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 50, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(TECHS.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= TECHS.length) break;
      const t = TECHS[idx], iy = sy + i * ih;
      const done = this.techs.isResearched(t.id);
      const cur = this.techs.getCurrentResearch();
      const active = cur?.techId === t.id;
      const can = !done && !active && this.techs.canResearch(t.id, this.res);
      ctx.fillStyle = done ? 'rgba(76,175,80,0.1)' : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = done ? COLOR_THEME.accentGreen : COLOR_THEME.textPrimary;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${done ? '✅' : t.icon} ${t.name} (T${t.tier})`, 18, iy + 18);
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(t.description, 18, iy + 34);
      if (active && cur) {
        ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(`${(cur.progress * 100).toFixed(0)}%`, w - 18, iy + 24);
      } else if (!done) {
        const cs = Object.values(t.cost).map(c => fmt(c)).join('+');
        ctx.fillStyle = can ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
        ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(cs, w - 18, iy + 24);
      }
      ctx.textAlign = 'left';
    }
  }

  private drawTerritory(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 48, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(TERRITORIES.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= TERRITORIES.length) break;
      const t = TERRITORIES[idx], iy = sy + i * ih;
      const own = this.terr.isConquered(t.id);
      ctx.fillStyle = own ? 'rgba(76,175,80,0.1)' : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = own ? COLOR_THEME.accentGreen : COLOR_THEME.textPrimary;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${own ? '✅' : '🔒'} ${t.name} (${t.type})`, 18, iy + 18);
      const rs = Object.entries(t.rewards).map(([, a]) => `${a}/s`).join(' ');
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(`收益: ${rs} | 需兵力: ${fmt(t.powerRequired)}`, 18, iy + 34);
    }
  }

  private drawBattle(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const stage = this.stages.getCurrent();
    if (stage) {
      ctx.fillStyle = COLOR_THEME.accentGold; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${stage.iconAsset} ${stage.name}`, 18, sy + 18);
    }
    const sbs = BATTLES.filter(b => b.stageId === (stage?.id || 'yellow_turban'));
    const ih = 60, by = sy + 30;
    for (let i = 0; i < sbs.length; i++) {
      const b = sbs[i], iy = by + i * ih;
      if (iy + ih > sy + h) break;
      const bs = this.battles.getCurrentState();
      const active = bs.currentWave === b.id;
      ctx.fillStyle = active ? 'rgba(255,215,0,0.1)' : COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      const e = b.enemies[0];
      ctx.fillStyle = COLOR_THEME.textPrimary; ctx.font = '12px sans-serif';
      ctx.fillText(`第${b.wave}波: ${e?.name || '?'}${e?.isBoss ? ' 👑' : ''}`, 18, iy + 18);
      if (active) {
        const hp = bs.aliveEnemies[0]?.currentHp || 0;
        const mhp = e?.hp || 1;
        this.drawBar(ctx, 18, iy + 30, w - 50, 10, hp / mhp);
      } else {
        const rs = Object.entries(b.rewards).map(([r, a]) => `${a}${r}`).join(' ');
        ctx.fillStyle = COLOR_THEME.textSecondary; ctx.font = '10px sans-serif';
        ctx.fillText(`奖励: ${rs}`, 18, iy + 40);
      }
    }
  }

  private drawGenerals(ctx: CanvasRenderingContext2D, w: number, sy: number, h: number): void {
    const ih = 65, vis = Math.floor(h / ih);
    for (let i = 0; i < Math.min(GENERALS.length, vis); i++) {
      const idx = i + this.scroll;
      if (idx >= GENERALS.length) break;
      const g = GENERALS[idx], iy = sy + i * ih;
      const own = this.units.isUnlocked(g.id);
      const rc = RARITY_COLORS[g.rarity] || COLOR_THEME.textPrimary;
      ctx.fillStyle = COLOR_THEME.panelBg;
      rr(ctx, 10, iy, w - 20, ih - 4, 4); ctx.fill();
      ctx.fillStyle = rc; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(g.name, 18, iy + 18);
      ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif';
      ctx.fillText(`[${g.rarity}] ${g.faction.toUpperCase()}`, 18, iy + 33);
      const s = g.baseStats;
      ctx.fillStyle = COLOR_THEME.textSecondary; ctx.font = '10px sans-serif';
      ctx.fillText(`攻${s.attack} 防${s.defense} 智${s.intelligence} 统${s.command}`, 18, iy + 50);
      ctx.textAlign = 'right';
      if (!own) {
        const ok = this.canPay(g.recruitCost);
        ctx.fillStyle = ok ? COLOR_THEME.affordable : COLOR_THEME.unaffordable;
        ctx.font = '11px sans-serif';
        ctx.fillText(`招募: ${g.recruitCost.gold}💰`, w - 18, iy + 30);
      } else {
        ctx.fillStyle = COLOR_THEME.accentGreen; ctx.font = '11px sans-serif';
        ctx.fillText('✅ 已招募', w - 18, iy + 30);
      }
      ctx.textAlign = 'left';
    }
  }

  private drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLOR_THEME.textDim; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('[Space]点击 [↑↓]选择 [Enter]购买 [R]声望 [T]科技 [M]领土 [B]战斗 [U]武将 [Esc]返回', w / 2, h - 12);
    ctx.textAlign = 'left';
  }

  private drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.fillStyle = COLOR_THEME.unaffordable; rr(ctx, x, y, w, h, 3); ctx.fill();
    const fw = Math.max(0, w * Math.min(1, r));
    if (fw > 0) { ctx.fillStyle = COLOR_THEME.accentGold; rr(ctx, x, y, fw, h, 3); ctx.fill(); }
  }

  // ─── 公共接口 ───────────────────────────────────────────

  public getResources(): Record<string, number> { return { ...this.res }; }
  public getActivePanel(): ActivePanel { return this.panel; }
  public getPrestigeState() { return this.prest.getState(); }
  public getStageInfo() { return this.stages.getCurrent(); }

  // ─── Phase 6.1 子系统 getter（供渲染适配器使用） ─────────

  /** 获取资源映射（直接引用，仅供内部读取） */
  public getResourcesMap(): Readonly<Record<string, number>> { return this.res; }

  /** 获取每秒产出缓存 */
  public getProductionCache(): Readonly<Record<string, number>> { return this.psCache; }

  /** 获取建筑子系统 */
  public getBuildingSystem(): BuildingSystem<BuildingDef> { return this.bldg; }

  /** 获取领土子系统 */
  public getTerritorySystem(): TerritorySystem<TerritoryDef> { return this.terr; }

  /** 获取战斗子系统 */
  public getBattleSystem(): BattleSystem<BattleDef> { return this.battles; }

  /** 获取武将子系统 */
  public getUnitSystem(): UnitSystem { return this.units; }

  /** 获取科技子系统 */
  public getTechTreeSystem(): TechTreeSystem<TechDef> { return this.techs; }

  /** 获取声望子系统 */
  public getPrestigeSystem(): PrestigeSystem { return this.prest; }

  /** 获取阶段子系统 */
  public getStageSystem(): StageSystem<StageDef> { return this.stages; }

  /** 获取战斗关卡挑战系统 */
  public getBattleChallenges(): BattleChallengeSystem { return this.battleChallenges; }

  /** 获取新手引导与剧情系统 */
  public getTutorialStory(): TutorialStorySystem { return this.tutorialStory; }

  /** 获取瓦片地图数据 */
  public getMapData(): MapGenerator { return this.mapGen; }

  /** 获取 NPC 活动系统 */
  public getNPCSystem(): NPCSystem { return this.npcSys; }

  /** 获取通用 NPC 管理器（AI 状态机/对话/协作） */
  public getNPCManager(): NPCManager { return this.npcManager; }

  /** 获取昼夜天气系统 */
  public getDayNightWeather(): DayNightWeatherSystem { return this.dayNightWeather; }

  /** 获取 NPC 职业活动系统 */
  public getNPCActivitySystem(): NPCActivitySystem { return this.npcActivitySys; }

  /** 获取游戏日历系统 */
  public getCalendar(): GameCalendarSystem { return this.calendar; }

  /** 获取城市地图系统 */
  public getCityMapSystem(): CityMapSystem { return this.cityMapSys; }

  /** 获取野外资源点系统 */
  public getResourcePointSystem(): ResourcePointSystem { return this.resourcePointSys; }

  /** 获取离线收益系统 */
  public getOfflineRewardSystem(): OfflineRewardSystem { return this.offlineRewardSys; }

  /** 获取贸易路线系统 */
  public getTradeRouteSystem(): TradeRouteSystem { return this.tradeRouteSys; }

  /** 获取丰富事件系统 */
  public getEventEnrichmentSystem(): EventEnrichmentSystem { return this.eventEnrichSys; }

  /** 获取征战关卡系统 */
  public getCampaignSystem(): CampaignSystem { return this.campaignSys; }

  /** 获取征战关卡战斗系统 */
  public getCampaignBattleSystem(): CampaignBattleSystem { return this.campaignBattleSys; }

  /**
   * 发起征战关卡攻城战斗
   *
   * @param stageId - 关卡 ID
   * @returns 战斗结果
   */
  public startCampaignBattle(stageId: string): BattleResult {
    // 检查关卡是否已解锁
    if (!this.campaignSys.isStageUnlocked(stageId)) {
      return {
        victory: false, stageId, rounds: [],
        totalAttackerLosses: 0, totalDefenderLosses: 0,
        troopsRemaining: 0, troopsRemainingPercent: 0, stars: 0,
        rewards: { territory: '', resources: {} },
        summary: '关卡未解锁',
      };
    }

    // 检查是否已通关（不允许重复攻打已通关关卡）
    if (this.campaignSys.isStageCompleted(stageId)) {
      return {
        victory: false, stageId, rounds: [],
        totalAttackerLosses: 0, totalDefenderLosses: 0,
        troopsRemaining: 0, troopsRemainingPercent: 0, stars: 0,
        rewards: { territory: '', resources: {} },
        summary: '该关卡已攻克',
      };
    }

    // 检查冷却
    const cooldown = this.campaignBattleSys.getCooldown(stageId);
    if (!cooldown.canFight) {
      return {
        victory: false, stageId, rounds: [],
        totalAttackerLosses: 0, totalDefenderLosses: 0,
        troopsRemaining: 0, troopsRemainingPercent: 0, stars: 0,
        rewards: { territory: '', resources: {} },
        summary: `冷却中，还需等待 ${cooldown.remainingSeconds} 秒`,
      };
    }

    // 构建攻方兵力
    const attackerArmy = this.buildAttackerArmy();

    // 模拟战斗
    const result = this.campaignBattleSys.simulateBattle(stageId, attackerArmy);

    // 处理战斗结果
    if (result.victory) {
      // 扣除损失的兵力
      if (result.totalAttackerLosses > 0) {
        this.res.troops = Math.max(0, (this.res.troops || 0) - result.totalAttackerLosses);
      }

      // 发放奖励
      for (const [resId, amount] of Object.entries(result.rewards.resources)) {
        this.giveRes(resId, amount);
      }

      // 解锁武将
      if (result.rewards.unlockHero) {
        const genDef = GENERALS.find(g => g.id === result.rewards.unlockHero);
        if (genDef && !this.units.isUnlocked(result.rewards.unlockHero)) {
          this.units.unlock(result.rewards.unlockHero);
          this.stats.increment('totalGeneralsRecruited');
          this.ftSys.add(`🎉 获得武将：${genDef.name}！`, 0.5, 0.3, {
            style: { color: '#4caf50', fontSize: 20 },
          });
        }
      }

      // 标记关卡完成
      this.campaignSys.completeStage(stageId, result.troopsRemainingPercent);

      this.ftSys.add(`⚔️ 攻克城池！`, 0.5, 0.4, {
        style: { color: COLOR_THEME.accentGold, fontSize: 22 },
      });
    } else {
      // 失败也损失部分兵力
      const lossAmount = Math.floor(result.totalAttackerLosses * 0.5);
      if (lossAmount > 0) {
        this.res.troops = Math.max(0, (this.res.troops || 0) - lossAmount);
      }
    }

    this.emit('stateChange');
    return result;
  }

  /**
   * 构建攻方兵力配置
   *
   * 从当前资源、已招募武将中提取战斗数据。
   */
  private buildAttackerArmy(): AttackerArmy {
    const generals: AttackerArmy['generals'] = [];

    for (const g of GENERALS) {
      if (this.units.isUnlocked(g.id)) {
        const state = this.units.getState(g.id);
        const level = state?.level || 1;
        generals.push({
          id: g.id,
          name: g.name,
          level,
          attack: g.baseStats.attack * level,
          defense: g.baseStats.defense * level,
          intelligence: g.baseStats.intelligence * level,
          command: g.baseStats.command * level,
        });
      }
    }

    return {
      generals,
      totalTroops: Math.floor(this.res.troops || 0),
      grain: Math.floor(this.res.grain || 0),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 核心玩法公共 API
  // ═══════════════════════════════════════════════════════════

  /**
   * 招募武将
   *
   * 检查武将是否已招募、资源是否足够，扣除招募费用并解锁武将。
   *
   * @param id - 武将 ID（如 'liubei', 'guanyu'）
   * @returns 是否招募成功
   */
  public recruitGeneral(id: string): boolean {
    // 查找武将定义
    const def = GENERALS.find(g => g.id === id);
    if (!def) return false;

    // 检查是否已招募
    if (this.units.isUnlocked(id)) return false;

    // 检查招募费用是否足够
    const cost = def.recruitCost;
    if (!this.canPay(cost)) return false;

    // 扣除招募费用
    this.pay(cost);

    // 解锁武将
    const result = this.units.unlock(id);
    if (!result.ok) return false;

    this.stats.increment('totalGeneralsRecruited');
    this.emit('generalRecruited', { generalId: id, name: def.name });
    this.audioManager.playSFX('recruit');
    this.emit('stateChange');

    // 触发招募对话和羁绊/剧情检查
    this.triggerRecruitDialogue(id);

    return true;
  }

  /**
   * 征服领土
   *
   * 检查领土是否已征服、是否与已征服领土相邻、兵力是否足够。
   * 消耗兵力后征服领土，获得奖励。
   *
   * @param id - 领土 ID（如 'chengdu', 'luoyang'）
   * @returns 是否征服成功
   */
  public conquerTerritory(id: string): boolean {
    // 查找领土定义
    const def = TERRITORIES.find(t => t.id === id);
    if (!def) return false;

    // 检查是否已征服
    if (this.terr.isConquered(id)) return false;

    // 检查是否与已征服领土相邻（首块领土或已有相邻领土）
    if (!this.terr.canAttack(id) && this.terr.getConqueredIds().length > 0) return false;

    // 检查兵力是否足够
    const troopsNeeded = def.powerRequired;
    if ((this.res.troops || 0) < troopsNeeded) return false;

    // 消耗兵力
    this.res.troops = Math.max(0, (this.res.troops || 0) - troopsNeeded);

    // 征服领土
    const result = this.terr.conquer(id);

    // 发放征服奖励
    for (const [r, a] of Object.entries(result.rewards)) this.giveRes(r, a);
    for (const [r, a] of Object.entries(result.bonus)) this.giveRes(r, a);

    this.stats.increment('totalTerritoriesConquered');
    this.emit('territoryConquered', { territoryId: id, name: def.name });

    // 自动为新征服领土生成城市地图
    if (!this.cityMapSys.getCityMap(id)) {
      this.cityMapSys.generateCityMap(id, def.name, def.type);
    }

    // 检查领土剧情事件
    const conqueredCount = this.terr.getConqueredIds().length;
    this.storyEventSystem.checkTriggers({ type: 'territory' }, conqueredCount);
    this.checkAndShowStoryEvent();

    this.emit('stateChange');
    return true;
  }

  /**
   * 研究科技
   *
   * 检查科技是否已研究、前置科技是否完成、资源是否足够。
   * 扣除研究费用并启动研究流程。
   *
   * @param id - 科技 ID（如 'mil_1', 'eco_2'）
   * @returns 是否成功开始研究
   */
  public researchTech(id: string): boolean {
    // 查找科技定义
    const def = TECHS.find(t => t.id === id);
    if (!def) return false;

    // 检查是否已研究
    if (this.techs.isResearched(id)) return false;

    // 检查前置科技是否完成
    if (!def.requires.every(r => this.techs.isResearched(r))) return false;

    // 检查资源是否足够
    if (!this.canPay(def.cost)) return false;

    // 扣除资源并启动研究
    this.pay(def.cost);
    const ok = this.techs.research(id, this.res);
    if (!ok) return false;

    this.stats.increment('totalTechsResearched');
    this.emit('techResearched', { techId: id, name: def.name });
    this.emit('stateChange');
    return true;
  }

  /**
   * 开始战斗
   *
   * 检查战斗是否已解锁（属于当前阶段）、是否已完成，
   * 以及是否有已招募武将参与。
   *
   * @param battleId - 战斗波次 ID（如 'yellow_1', 'chibi_3'）
   * @returns 是否成功开始战斗
   */
  public startBattle(battleId: string): boolean {
    // 查找战斗定义
    const def = BATTLES.find(b => b.id === battleId);
    if (!def) return false;

    // 检查战斗是否属于当前阶段（是否已解锁）
    const currentStage = this.stages.getCurrent();
    if (!currentStage || def.stageId !== currentStage.id) return false;

    // 检查是否有已招募武将
    const hasGeneral = GENERALS.some(g => this.units.isUnlocked(g.id));
    if (!hasGeneral) return false;

    // 初始化战斗状态
    const ok = this.battles.startWave(battleId);
    if (!ok) return false;

    this.emit('battleStarted', { battleId, stageId: def.stageId, wave: def.wave });
    this.emit('stateChange');
    return true;
  }

  /**
   * 通过 ID 购买建筑
   *
   * 根据建筑 ID 找到建筑，检查是否已解锁、资源是否足够，
   * 执行购买并升级建筑等级。
   *
   * @param id - 建筑 ID（如 'farm', 'market', 'barracks'）
   * @returns 是否购买成功
   */
  public buyBuildingById(id: string): boolean {
    // 检查建筑是否已注册
    if (!this.bldg.isUnlocked(id)) return false;

    // 检查资源是否足够
    const cost = this.bldg.getCost(id);
    if (!this.canPay(cost)) return false;

    // 执行购买
    const ok = this.bldg.purchase(id, (rId, amt) => this.has(rId, amt), () => {});
    if (!ok) return false;

    // 手动扣除资源（purchase 的 spendResource 回调为空，由 pay 统一处理）
    this.pay(cost);

    const def = BUILDINGS.find(b => b.id === id);
    this.audioManager.playSFX('build');
    this.emit('buildingPurchased', { buildingId: id, name: def?.name || id });
    this.emit('stateChange');
    return true;
  }

  /**
   * 升级建筑
   *
   * 检查建筑当前等级、资源是否足够，执行升级操作。
   * 本质上与 buyBuildingById 相同（每次购买即升一级），
   * 但提供语义化的升级接口。
   *
   * @param id - 建筑 ID
   * @returns 是否升级成功
   */
  public upgradeBuilding(id: string): boolean {
    // 检查建筑是否已解锁且已拥有（等级 >= 1 才能升级）
    if (!this.bldg.isUnlocked(id)) return false;
    if (this.bldg.getLevel(id) < 1) return false;

    // 检查资源是否足够
    const cost = this.bldg.getCost(id);
    if (!this.canPay(cost)) return false;

    // 执行升级
    const ok = this.bldg.purchase(id, (rId, amt) => this.has(rId, amt), () => {});
    if (!ok) return false;

    // 扣除资源
    this.pay(cost);

    const newLevel = this.bldg.getLevel(id);
    const def = BUILDINGS.find(b => b.id === id);
    this.audioManager.playSFX('levelup');
    this.emit('buildingUpgraded', { buildingId: id, name: def?.name || id, level: newLevel });
    this.emit('stateChange');
    return true;
  }

  // ─── 公共 getter 方法 ───────────────────────────────────

  /** 获取指定建筑的当前等级 */
  public getBuildingLevel(id: string): number {
    return this.bldg.getLevel(id);
  }

  /** 检查指定武将是否已招募 */
  public isGeneralRecruited(id: string): boolean {
    return this.units.isUnlocked(id);
  }

  /** 检查指定科技是否已研究完成 */
  public isTechResearched(id: string): boolean {
    return this.techs.isResearched(id);
  }

  /** 检查指定领土是否已征服 */
  public isTerritoryConquered(id: string): boolean {
    return this.terr.isConquered(id);
  }

  /** 获取指定类型资源的当前数量 */
  public getResourceAmount(type: string): number {
    return this.res[type] || 0;
  }

  // ─── 通用引擎系统集成 ─────────────────────────────────────

  /** 获取任务系统实例 */
  public get questSystem(): QuestSystem { return this.questSys; }

  /** 获取事件系统实例 */
  public get eventSystem(): EventSystem { return this.eventSys; }

  /** 获取奖励系统实例 */
  public get rewardSystem(): RewardSystem { return this.rewardSys; }

  // ─── 三国主题任务注册 ──────────────────────────────────────

  /** 注册三国主题任务（主线 / 日常 / 周常） */
  private registerThreeKingdomsQuests(): void {
    const quests: QuestDef[] = [
      // ── 主线任务 ──
      {
        id: 'q01', name: '初入乱世', description: '建造第一座农田',
        type: 'main',
        conditions: [{ type: 'build', targetId: 'farm', requiredCount: 1 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 100 }],
        autoAccept: true, priority: 100,
      },
      {
        id: 'q02', name: '招兵买马', description: '招募第一位武将',
        type: 'main',
        conditions: [{ type: 'custom', targetId: 'recruit_general', requiredCount: 1 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 200 }],
        prerequisiteQuest: 'q01', autoAccept: true, priority: 90,
      },
      {
        id: 'q03', name: '初试锋芒', description: '完成第一场战斗',
        type: 'main',
        conditions: [{ type: 'defeat', targetId: 'any', requiredCount: 1 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 300 }],
        prerequisiteQuest: 'q02', autoAccept: true, priority: 80,
      },
      {
        id: 'q04', name: '开疆拓土', description: '征服第一块领土',
        type: 'main',
        conditions: [{ type: 'custom', targetId: 'conquer_territory', requiredCount: 1 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 500 }],
        prerequisiteQuest: 'q03', autoAccept: true, priority: 70,
      },
      {
        id: 'q05', name: '百废待兴', description: '建造 3 座建筑',
        type: 'main',
        conditions: [{ type: 'build', targetId: 'any', requiredCount: 3 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 800 }],
        prerequisiteQuest: 'q04', autoAccept: true, priority: 60,
      },
      {
        id: 'q06', name: '猛将如云', description: '拥有 3 名武将',
        type: 'main',
        conditions: [{ type: 'custom', targetId: 'recruit_general', requiredCount: 3 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 1000 }],
        prerequisiteQuest: 'q05', autoAccept: true, priority: 50,
      },
      // ── 日常任务 ──
      {
        id: 'dq01', name: '日积月累', description: '生产 500 粮草',
        type: 'daily',
        conditions: [{ type: 'collect', targetId: 'food', requiredCount: 500 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 50 }],
        autoAccept: true, priority: 30,
      },
      {
        id: 'dq02', name: '勤政爱民', description: '升级 2 座建筑',
        type: 'daily',
        conditions: [{ type: 'upgrade', targetId: 'any', requiredCount: 2 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 80 }],
        autoAccept: true, priority: 20,
      },
      {
        id: 'dq03', name: '操练兵马', description: '完成 3 场战斗',
        type: 'daily',
        conditions: [{ type: 'defeat', targetId: 'any', requiredCount: 3 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 100 }],
        autoAccept: true, priority: 10,
      },
      // ── 周常任务 ──
      {
        id: 'wq01', name: '周末征伐', description: '征服 5 块领土',
        type: 'weekly',
        conditions: [{ type: 'custom', targetId: 'conquer_territory', requiredCount: 5 }],
        rewards: [{ type: 'resource', id: 'gold', amount: 500 }],
        autoAccept: true, priority: 40,
      },
    ];
    this.questSys.register(quests);
  }

  // ─── 三国主题活动注册 ──────────────────────────────────────

  /** 注册三国主题限时活动 */
  private registerThreeKingdomsEvents(): void {
    const now = Date.now();
    const DAY = 86400000;

    const events: GameEvent[] = [
      {
        id: 'ev01', name: '黄巾之乱讨伐战',
        description: '限时活动：击败黄巾军获取积分，积分可兑换丰厚奖励',
        status: 'active',
        startsAt: now - DAY, endsAt: now + DAY * 7,
        rewards: [
          { id: 'ev01_r1', name: '青铜奖', resources: { gold: 500 }, tier: 'bronze' },
          { id: 'ev01_r2', name: '白银奖', resources: { gold: 2000 }, tier: 'silver' },
          { id: 'ev01_r3', name: '黄金奖', resources: { gold: 5000 }, tier: 'gold' },
        ],
        shop: [
          { id: 'ev01_s1', name: '黄巾宝箱', cost: 100, reward: { gold: 1000 }, stock: 5, purchased: 0 },
          { id: 'ev01_s2', name: '稀有将令', cost: 300, reward: { gem: 50 }, stock: 2, purchased: 0 },
        ],
        milestones: [
          { points: 100, reward: { gold: 200 }, claimed: false },
          { points: 500, reward: { gold: 1000 }, claimed: false },
          { points: 1000, reward: { gem: 100 }, claimed: false },
        ],
        playerPoints: 0, playerTokens: 0,
      },
      {
        id: 'ev02', name: '赤壁庆典',
        description: '收集东风代币，兑换限定奖励',
        status: 'active',
        startsAt: now - DAY, endsAt: now + DAY * 5,
        rewards: [
          { id: 'ev02_r1', name: '东风之力', resources: { gem: 200 }, tier: 'gold' },
        ],
        shop: [
          { id: 'ev02_s1', name: '赤壁令', cost: 50, reward: { gold: 500 }, stock: -1, purchased: 0 },
          { id: 'ev02_s2', name: '火攻秘卷', cost: 200, reward: { gem: 30 }, stock: 3, purchased: 0 },
        ],
        milestones: [
          { points: 200, reward: { gold: 500 }, claimed: false },
          { points: 800, reward: { gem: 50 }, claimed: false },
        ],
        playerPoints: 0, playerTokens: 0,
      },
      {
        id: 'ev03', name: '春耕祭',
        description: '粮草产出翻倍，限时丰收活动',
        status: 'upcoming',
        startsAt: now + DAY * 3, endsAt: now + DAY * 10,
        rewards: [],
        shop: [],
        milestones: [
          { points: 300, reward: { food: 5000 }, claimed: false },
        ],
        playerPoints: 0, playerTokens: 0,
      },
      {
        id: 'ev04', name: '招贤纳士',
        description: '武将招募折扣活动，招贤榜半价',
        status: 'upcoming',
        startsAt: now + DAY * 5, endsAt: now + DAY * 12,
        rewards: [
          { id: 'ev04_r1', name: '贤才礼', resources: { gem: 100 }, tier: 'silver' },
        ],
        shop: [
          { id: 'ev04_s1', name: '招贤令', cost: 80, reward: { gold: 800 }, stock: 5, purchased: 0 },
        ],
        milestones: [
          { points: 150, reward: { gold: 300 }, claimed: false },
        ],
        playerPoints: 0, playerTokens: 0,
      },
      {
        id: 'ev05', name: '天下第一武道会',
        description: '战斗挑战排行，争夺天下第一',
        status: 'active',
        startsAt: now - DAY * 2, endsAt: now + DAY * 5,
        rewards: [
          { id: 'ev05_r1', name: '武道冠军', resources: { gem: 500, gold: 10000 }, tier: 'diamond' },
          { id: 'ev05_r2', name: '武道亚军', resources: { gem: 200, gold: 5000 }, tier: 'gold' },
        ],
        shop: [
          { id: 'ev05_s1', name: '武道宝箱', cost: 150, reward: { gold: 2000 }, stock: 3, purchased: 0 },
        ],
        milestones: [
          { points: 300, reward: { gold: 1000 }, claimed: false },
          { points: 700, reward: { gem: 80 }, claimed: false },
          { points: 1500, reward: { gem: 200 }, claimed: false },
        ],
        playerPoints: 0, playerTokens: 0,
      },
    ];

    for (const ev of events) {
      this.eventSys.registerEvent(ev);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // NPC 走动动画 & 点击交互
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新所有 NPC 的位置（走动动画）
   *
   * 由引擎 onUpdate 每帧调用，驱动 NPCManager 的 AI 和移动系统。
   * NPC 会根据日程表在地图上巡逻/漫游，到达目标后短暂停留再选择新目标。
   *
   * 巡逻行为（无日程任务时）：
   * - idle 状态：停留 2~5 秒后选择巡逻范围内的新目标
   * - walking 状态：以配置速度向目标移动，到达后回到 idle
   * - 不同职业有不同巡逻半径和速度
   *
   * @param dt - 帧间隔时间（毫秒）
   */
  public updateNPCPositions(dt: number): void {
    const sec = dt / 1000;
    const gameHour = (this.playTime / 60) % 24;
    this.npcManager.update(sec, gameHour);
  }

  /**
   * 获取指定 NPC 的详细信息（用于点击交互弹窗）
   *
   * @param npcId - NPC 实例 ID
   * @returns NPC 详细信息，或 null
   */
  public getNPCInfo(npcId: string): {
    id: string;
    name: string;
    type: string;
    profession: string;
    x: number;
    y: number;
    state: string;
    direction: string;
    iconEmoji: string;
    dialogues: Array<{ id: string; trigger: string; lines: Array<{ speaker: string; text: string }> }>;
  } | null {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return null;

    const def = this.npcManager.getDef(npc.defId);
    const dialogues = def?.dialogues.map(d => ({
      id: d.id,
      trigger: d.trigger,
      lines: d.lines.map(l => ({ speaker: l.speaker, text: l.text })),
    })) ?? [];

    return {
      id: npc.id,
      name: npc.name,
      type: npc.defId,
      profession: npc.profession as string,
      x: npc.x,
      y: npc.y,
      state: npc.state,
      direction: npc.direction,
      iconEmoji: def?.iconEmoji ?? '👤',
      dialogues,
    };
  }

  /**
   * 获取指定 NPC 的点击对话内容
   *
   * 根据 NPC 定义中的 click 触发对话返回对话行列表。
   * 如果没有 click 触发的对话，返回默认问候语。
   *
   * @param npcId - NPC 实例 ID
   * @returns 对话行列表
   */
  public getNPCClickDialogue(npcId: string): Array<{ speaker: string; text: string }> {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return [{ speaker: 'system', text: '此人似乎不愿与你交谈。' }];

    const def = this.npcManager.getDef(npc.defId);
    if (!def) return [{ speaker: 'npc', text: '你好，大人！' }];

    // 查找 click 触发的对话
    const clickDialogue = def.dialogues.find(d => d.trigger === 'click');
    if (clickDialogue && clickDialogue.lines.length > 0) {
      return clickDialogue.lines.map(l => ({ speaker: l.speaker, text: l.text }));
    }

    // 兜底：使用第一个对话
    const firstDialogue = def.dialogues[0];
    if (firstDialogue && firstDialogue.lines.length > 0) {
      return firstDialogue.lines.map(l => ({ speaker: l.speaker, text: l.text }));
    }

    return [{ speaker: 'npc', text: `${npc.name}向你点了点头。` }];
  }

  // ─────────────────────────────────────────────────────────────
  // NPC 选中 / 交互
  // ─────────────────────────────────────────────────────────────

  /**
   * 选中指定 NPC
   *
   * @param npcId - NPC 实例 ID
   */
  public selectNPC(npcId: string): void {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return;
    this.selectedNPC = npcId;
  }

  /**
   * 取消选中 NPC
   */
  public deselectNPC(): void {
    this.selectedNPC = null;
  }

  /**
   * 获取当前选中的 NPC ID
   *
   * @returns 选中的 NPC ID，或 null
   */
  public getSelectedNPC(): string | null {
    return this.selectedNPC;
  }
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
}
