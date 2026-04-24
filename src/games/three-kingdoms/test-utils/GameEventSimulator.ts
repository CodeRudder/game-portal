/**
 * GameEventSimulator — 三国霸业测试基础设施
 *
 * 封装 ThreeKingdomsEngine，提供高层 API 用于测试场景模拟。
 * 所有方法直接调用真实引擎 API，确保测试与生产行为一致。
 *
 * 用法:
 *   const sim = new GameEventSimulator();
 *   sim.initBeginnerState();
 *   sim.addResources({ gold: 5000 });
 *   sim.upgradeBuilding('farmland');
 */

import { ThreeKingdomsEngine } from '../engine/ThreeKingdomsEngine';
import type { ResourceType, BuildingType } from '../shared/types';
import type { RecruitType } from '../engine/hero/hero-recruit-config';
import type { GeneralData } from '../engine/hero/hero.types';
import type { BattleResult } from '../engine/battle/battle.types';
import type { CampaignProgress } from '../engine/campaign/campaign.types';

// ── 类型别名 ──

/** 资源映射表 */
export type ResourceMap = Partial<Record<ResourceType, number>>;

/** 模拟器快照（用于断言） */
export interface SimulatorSnapshot {
  resources: Record<ResourceType, number>;
  productionRates: Record<string, number>;
  buildingLevels: Record<string, number>;
  generalCount: number;
  totalPower: number;
  campaignProgress: CampaignProgress;
  onlineSeconds: number;
}

/** 事件日志条目 */
export interface EventLogEntry {
  timestamp: number;
  event: string;
  detail: string;
}

// ── GameEventSimulator ──

export class GameEventSimulator {
  readonly engine: ThreeKingdomsEngine;
  private readonly eventLog: EventLogEntry[] = [];

  constructor() {
    this.engine = new ThreeKingdomsEngine();
  }

  // ─────────────────────────────────────────
  // 生命周期
  // ─────────────────────────────────────────

  /** 初始化引擎（等同于新游戏） */
  init(): this {
    this.engine.init();
    this.log('init', '引擎初始化完成');
    return this;
  }

  /** 重置引擎到初始状态 */
  reset(): this {
    this.engine.reset();
    this.eventLog.length = 0;
    this.log('reset', '引擎重置');
    return this;
  }

  // ─────────────────────────────────────────
  // 资源操作
  // ─────────────────────────────────────────

  /** 添加指定资源 */
  addResources(resources: ResourceMap): this {
    for (const [type, amount] of Object.entries(resources)) {
      if (amount && amount > 0) {
        this.engine.resource.addResource(type as ResourceType, amount);
      }
    }
    this.log('addResources', JSON.stringify(resources));
    return this;
  }

  /** 消耗指定资源 */
  consumeResources(resources: ResourceMap): this {
    for (const [type, amount] of Object.entries(resources)) {
      if (amount && amount > 0) {
        this.engine.resource.consumeResource(type as ResourceType, amount);
      }
    }
    this.log('consumeResources', JSON.stringify(resources));
    return this;
  }

  /** 设置指定资源为精确值 */
  setResource(type: ResourceType, amount: number): this {
    this.engine.resource.setResource(type, amount);
    this.log('setResource', `${type}=${amount}`);
    return this;
  }

  /** 获取指定资源数量 */
  getResource(type: ResourceType): number {
    return this.engine.resource.getAmount(type);
  }

  /** 获取全部资源 */
  getAllResources(): Record<ResourceType, number> {
    return { ...this.engine.resource.getResources() };
  }

  // ─────────────────────────────────────────
  // 建筑操作
  // ─────────────────────────────────────────

  /** 升级建筑（扣费 → 即时完成升级） */
  upgradeBuilding(type: BuildingType): this {
    this.engine.upgradeBuilding(type);
    // 建筑升级基于真实时间（Date.now()），测试中需要即时完成
    this.completePendingUpgrades();
    this.log('upgradeBuilding', type);
    return this;
  }

  /** 批量升级建筑到指定等级 */
  upgradeBuildingTo(type: BuildingType, targetLevel: number): this {
    const currentLevel = this.engine.building.getLevel(type);
    for (let i = currentLevel; i < targetLevel; i++) {
      this.engine.upgradeBuilding(type);
      this.completePendingUpgrades();
    }
    this.log('upgradeBuildingTo', `${type} → Lv${targetLevel}`);
    return this;
  }

  /**
   * 批量升级建筑到指定等级，每次升级后重新设置高资源上限。
   * 用于 initMidGameState 等需要大量资源的场景，
   * 因为 completePendingUpgrades 会根据建筑等级重置上限。
   */
  private upgradeBuildingToWithHighCaps(type: BuildingType, targetLevel: number): this {
    const currentLevel = this.engine.building.getLevel(type);
    for (let i = currentLevel; i < targetLevel; i++) {
      // 确保资源上限和资源量充足（升级消耗可能很大）
      this.engine.resource.setCap('grain', 50_000_000);
      this.engine.resource.setCap('troops', 10_000_000);
      this.addResources({ grain: 10000000, gold: 20000000, troops: 5000000 });
      this.engine.upgradeBuilding(type);
      this.completePendingUpgrades();
      // completePendingUpgrades 会重置上限，需要恢复高上限
      this.engine.resource.setCap('grain', 50_000_000);
      this.engine.resource.setCap('troops', 10_000_000);
    }
    this.log('upgradeBuildingTo', `${type} → Lv${targetLevel}`);
    return this;
  }

  /**
   * 即时完成所有待处理的建筑升级。
   * 委托 BuildingSystem.forceCompleteUpgrades()，避免直接操作内部状态。
   */
  private completePendingUpgrades(): void {
    const building = this.engine.building;
    const completed = building.forceCompleteUpgrades();

    // 同步建筑产出到资源系统
    this.engine.resource.recalculateProduction(
      building.calculateTotalProduction() as Record<string, number>,
    );

    // 更新资源上限（粮仓等级 → 粮草上限，兵营等级 → 兵力上限）
    const granaryLevel = building.getLevel('farmland' as BuildingType);
    const barracksLevel = building.getLevel('barracks' as BuildingType);
    this.engine.resource.updateCaps(granaryLevel, barracksLevel);
  }

  /** 获取建筑等级 */
  getBuildingLevel(type: BuildingType): number {
    return this.engine.building.getLevel(type);
  }

  /** 获取所有建筑等级 */
  getAllBuildingLevels(): Record<BuildingType, number> {
    return this.engine.building.getBuildingLevels();
  }

  // ─────────────────────────────────────────
  // 武将操作
  // ─────────────────────────────────────────

  /** 招募武将（通过招募系统） */
  recruitHero(type: RecruitType = 'normal', count: 1 | 10 = 1): this {
    this.engine.recruit(type, count);
    this.log('recruitHero', `${type} x${count}`);
    return this;
  }

  /** 直接添加武将（绕过招募，用于测试） */
  addHeroDirectly(generalId: string): GeneralData | null {
    const result = this.engine.hero.addGeneral(generalId);
    if (result) {
      this.log('addHeroDirectly', generalId);
    }
    return result;
  }

  /** 获取所有武将 */
  getGenerals(): Readonly<GeneralData>[] {
    return this.engine.hero.getAllGenerals();
  }

  /** 获取武将数量 */
  getGeneralCount(): number {
    return this.engine.hero.getGeneralCount();
  }

  /** 获取总战力 */
  getTotalPower(): number {
    return this.engine.hero.calculateTotalPower();
  }

  /** 增加武将碎片 */
  addHeroFragments(generalId: string, count: number): this {
    this.engine.hero.addFragment(generalId, count);
    this.log('addHeroFragments', `${generalId} x${count}`);
    return this;
  }

  // ─────────────────────────────────────────
  // 战斗/关卡
  // ─────────────────────────────────────────

  /** 战斗胜利（执行战斗并完成关卡） */
  winBattle(stageId: string, stars: number = 3): BattleResult {
    const result = this.engine.startBattle(stageId);
    this.engine.completeBattle(stageId, stars);
    this.log('winBattle', `${stageId} ★${stars}`);
    return result;
  }

  /** 获取关卡进度 */
  getCampaignProgress(): CampaignProgress {
    return this.engine.getCampaignProgress();
  }

  /** 获取关卡列表 */
  getStageList() {
    return this.engine.getStageList();
  }

  // ─────────────────────────────────────────
  // 时间快进
  // ─────────────────────────────────────────

  /** 快进指定毫秒（模拟 tick 循环） */
  fastForward(deltaMs: number): this {
    this.engine.tick(deltaMs);
    this.log('fastForward', `${deltaMs}ms`);
    return this;
  }

  /** 快进指定秒 */
  fastForwardSeconds(seconds: number): this {
    return this.fastForward(seconds * 1000);
  }

  /** 快进指定分钟 */
  fastForwardMinutes(minutes: number): this {
    return this.fastForward(minutes * 60 * 1000);
  }

  /** 快进指定小时 */
  fastForwardHours(hours: number): this {
    return this.fastForward(hours * 3600 * 1000);
  }

  /** 获取在线秒数 */
  getOnlineSeconds(): number {
    return this.engine.getOnlineSeconds();
  }

  // ─────────────────────────────────────────
  // 快捷状态初始化
  // ─────────────────────────────────────────

  /** 初始化新手状态：基础资源 + 建筑升级 + 初始关卡 */
  initBeginnerState(): this {
    this.engine.init();
    this.addResources({
      grain: 10000,
      gold: 20000,
      troops: 5000,
      mandate: 500,
    });
    // 先升级主城（其他建筑等级不能超过主城）
    this.upgradeBuilding('castle');
    this.upgradeBuilding('farmland');
    this.upgradeBuilding('market');
    this.upgradeBuilding('barracks');
    this.log('initBeginnerState', '新手状态初始化完成');
    return this;
  }

  /** 初始化中期状态：充足资源 + 高级建筑 + 多名武将 + 关卡进度 */
  initMidGameState(): this {
    this.engine.init();
    // 大量资源（建筑升级消耗很大，需要足够）
    // 直接设置资源值绕过上限限制
    const res = this.engine.resource;
    res.setCap('grain', 50_000_000);
    res.setCap('troops', 10_000_000);
    this.addResources({
      grain: 10000000,
      gold: 20000000,
      troops: 5000000,
      mandate: 1000000,
    });
    // 交错升级：先升主城到4，再升一个建筑到4，然后主城到5，最后其余建筑到5
    // 城堡 Lv5 需要：至少一座其他建筑达到 Lv4
    // 注意：completePendingUpgrades 会根据农田等级重置粮草上限，
    // 所以每次升级后需要重新设置上限，避免资源被截断
    this.upgradeBuildingToWithHighCaps('castle', 4);
    this.upgradeBuildingToWithHighCaps('farmland', 4);
    this.upgradeBuildingToWithHighCaps('castle', 5);
    // 其余建筑升级到5
    const midBuildings: BuildingType[] = ['market', 'barracks', 'smithy', 'academy'];
    for (const bt of midBuildings) {
      this.upgradeBuildingToWithHighCaps(bt, 5);
    }
    this.upgradeBuildingToWithHighCaps('farmland', 5);
    // 添加核心武将
    const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun'];
    for (const id of heroIds) {
      this.addHeroDirectly(id);
    }
    // 创建阵容并设置
    this.engine.createFormation('main');
    this.engine.setFormation('main', heroIds);
    // 推进关卡
    const stages = this.engine.getStageList();
    const clearedCount = Math.min(stages.length, 6);
    for (let i = 0; i < clearedCount; i++) {
      try {
        this.engine.startBattle(stages[i].id);
        this.engine.completeBattle(stages[i].id, 3);
      } catch {
        // 跳过无法挑战的关卡
        break;
      }
    }
    this.log('initMidGameState', '中期状态初始化完成');
    return this;
  }

  // ─────────────────────────────────────────
  // 快照与断言
  // ─────────────────────────────────────────

  /** 获取当前完整快照 */
  getSnapshot(): SimulatorSnapshot {
    const resources = this.getAllResources();
    const productionRates = { ...this.engine.resource.getProductionRates() };
    const buildingLevels = this.getAllBuildingLevels();
    const generalCount = this.getGeneralCount();
    const totalPower = this.getTotalPower();
    const campaignProgress = this.getCampaignProgress();
    const onlineSeconds = this.getOnlineSeconds();

    return {
      resources,
      productionRates,
      buildingLevels,
      generalCount,
      totalPower,
      campaignProgress,
      onlineSeconds,
    };
  }

  /** 获取事件日志 */
  getEventLog(): ReadonlyArray<EventLogEntry> {
    return this.eventLog;
  }

  /** 清空事件日志 */
  clearEventLog(): this {
    this.eventLog.length = 0;
    return this;
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /** 监听引擎事件 */
  on(event: string, listener: (...args: unknown[]) => void): this {
    this.engine.on(event, listener as (...args: any[]) => void);
    return this;
  }

  // ─────────────────────────────────────────
  // 内部工具
  // ─────────────────────────────────────────

  private log(event: string, detail: string): void {
    this.eventLog.push({
      timestamp: Date.now(),
      event,
      detail,
    });
  }
}
