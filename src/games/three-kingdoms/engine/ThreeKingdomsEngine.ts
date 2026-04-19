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
 */

import { ResourceSystem } from './resource/ResourceSystem';
import { BuildingSystem } from './building/BuildingSystem';
import type { CapWarning, OfflineEarnings } from './resource/resource.types';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from './building/building.types';
import type {
  EngineEventType, EngineEventMap, EventListener, GameSaveData, EngineSnapshot,
} from '../shared/types';
import { AUTO_SAVE_INTERVAL_SECONDS, SAVE_KEY, ENGINE_SAVE_VERSION } from '../shared/constants';

import type { IGameState } from '../core/types/state';
import { EventBus } from '../core/events/EventBus';
import { SubsystemRegistry } from '../core/engine/SubsystemRegistry';
import { SaveManager } from '../core/save/SaveManager';
import { ConfigRegistry } from '../core/config/ConfigRegistry';

// ─────────────────────────────────────────────
// ThreeKingdomsEngine
// ─────────────────────────────────────────────

export class ThreeKingdomsEngine {
  // ── 子系统 ──
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;

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

  // ── 上次快照（用于变化检测，避免无变化时频繁 emit） ──
  private prevResourcesJson = '';
  private prevRatesJson = '';

  constructor() {
    this.resource = new ResourceSystem();
    this.building = new BuildingSystem();

    // 初始化 core/ 基础设施
    this.bus = new EventBus();
    this.registry = new SubsystemRegistry();
    this.configRegistry = new ConfigRegistry();

    // 将 Engine 常量注入 ConfigRegistry，供 SaveManager 使用
    this.configRegistry.set('SAVE_KEY', SAVE_KEY);
    this.configRegistry.set('SAVE_VERSION', String(ENGINE_SAVE_VERSION));

    this.saveManager = new SaveManager(this.configRegistry);

    // 注册子系统到 Registry
    this.registry.register('resource', this.resource as any);
    this.registry.register('building', this.building as any);
  }

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════

  /** 初始化引擎（新游戏）：建立联动、发出初始化事件 */
  init(): void {
    if (this.initialized) return;

    this.syncBuildingToResource();

    this.initialized = true;
    this.lastTickTime = Date.now();
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;

    this.bus.emit('game:initialized', { isNewGame: true });
  }

  // ═══════════════════════════════════════════
  // 2. 游戏循环
  // ═══════════════════════════════════════════

  /** 驱动所有子系统更新，建议以 100ms 间隔调用 */
  tick(deltaMs?: number): void {
    if (!this.initialized) return;

    const now = Date.now();
    const dt = deltaMs ?? (now - this.lastTickTime);
    this.lastTickTime = now;

    // 2a. 建筑升级计时 → 返回本帧完成的建筑
    const completed = this.building.tick();

    // 2b. 处理升级完成的建筑（联动更新产出/上限）
    if (completed.length > 0) {
      this.syncBuildingToResource();
      for (const type of completed) {
        const level = this.building.getLevel(type);
        this.bus.emit('building:upgraded', { type, level });
      }
    }

    // 2c. 资源产出（含主城加成）
    const castleMultiplier = this.building.getCastleBonusMultiplier();
    const bonuses = { castle: castleMultiplier - 1 };
    this.resource.tick(dt, bonuses);

    // 2d. 变化检测 → 发出事件
    this.detectAndEmitChanges();

    // 2e. 自动保存累加
    this.autoSaveAccumulator += dt / 1000;
    if (this.autoSaveAccumulator >= AUTO_SAVE_INTERVAL_SECONDS) {
      this.autoSaveAccumulator = 0;
      this.save();
    }

    // 2f. 在线时长
    this.onlineSeconds += dt / 1000;
  }

  // ═══════════════════════════════════════════
  // 3. 建筑升级（编排流程）
  // ═══════════════════════════════════════════

  /** 检查建筑是否可升级（不消耗资源） */
  checkUpgrade(type: BuildingType): UpgradeCheckResult {
    return this.building.checkUpgrade(type, this.resource.getResources());
  }

  /** 获取升级费用 */
  getUpgradeCost(type: BuildingType): UpgradeCost | null {
    return this.building.getUpgradeCost(type);
  }

  /**
   * 执行建筑升级
   * 编排流程：前置检查 → 扣除资源 → 开始升级 → 发出事件
   * @throws 资源不足或条件不满足时抛错
   */
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

  /** 取消建筑升级，返还资源费用（80%），null 表示该建筑未在升级 */
  cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const refund = this.building.cancelUpgrade(type);
    if (!refund) return null;

    if (refund.grain > 0) this.resource.addResource('grain', refund.grain);
    if (refund.gold > 0) this.resource.addResource('gold', refund.gold);
    if (refund.troops > 0) this.resource.addResource('troops', refund.troops);

    this.bus.emit('resource:changed', { resources: this.resource.getResources() });
    return refund;
  }

  // ═══════════════════════════════════════════
  // 4. 存档 / 读档
  // ═══════════════════════════════════════════

  /** 保存游戏（委托给 SaveManager，保持 GameSaveData 格式兼容） */
  save(): void {
    const data: GameSaveData = {
      version: ENGINE_SAVE_VERSION,
      saveTime: Date.now(),
      resource: this.resource.serialize(),
      building: this.building.serialize(),
    };

    // 转换为 IGameState 格式，委托给 SaveManager
    const state: IGameState = this.toIGameState(data);
    const ok = this.saveManager.save(state);

    if (ok) {
      this.resource.touchSaveTime();
      this.bus.emit('game:saved', { timestamp: data.saveTime });
    } else {
      console.error('ThreeKingdomsEngine.save 失败: SaveManager.save 返回 false');
    }
  }

  /** 从 SaveManager 加载存档，自动计算并应用离线收益。无存档返回 null */
  load(): OfflineEarnings | null {
    // 优先尝试 SaveManager 新格式
    const state = this.saveManager.load();

    if (state) {
      return this.applyLoadedState(state);
    }

    // 向后兼容：尝试加载旧格式（直接 JSON，无 checksum 包装）
    const legacyData = this.tryLoadLegacyFormat();
    if (legacyData) {
      return this.applyLegacyState(legacyData);
    }

    return null;
  }

  /** 序列化为 JSON 字符串（不写入 localStorage） */
  serialize(): string {
    const data: GameSaveData = {
      version: ENGINE_SAVE_VERSION,
      saveTime: Date.now(),
      resource: this.resource.serialize(),
      building: this.building.serialize(),
    };
    return JSON.stringify(data);
  }

  /** 从 JSON 字符串反序列化（不从 localStorage 读取） */
  deserialize(json: string): void {
    const data: GameSaveData = JSON.parse(json);
    this.building.deserialize(data.building);
    this.resource.deserialize(data.resource);
    this.syncBuildingToResource();
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
    this.initialized = false;
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;
    this.prevResourcesJson = '';
    this.prevRatesJson = '';
    this.saveManager.deleteSave();
    this.bus.removeAllListeners();
  }

  // ═══════════════════════════════════════════
  // 5. 事件系统
  // ═══════════════════════════════════════════

  /** 订阅事件（强类型） */
  on<T extends EngineEventType>(
    event: T,
    listener: EventListener<EngineEventMap[T]>,
  ): void;
  /** 订阅事件（兼容 IGameEngine 字符串事件名） */
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: string, listener: (...args: any[]) => void): void {
    this.bus.on(event, listener);
  }

  /** 订阅事件（仅触发一次） */
  once<T extends EngineEventType>(
    event: T,
    listener: EventListener<EngineEventMap[T]>,
  ): void {
    this.bus.once(event, listener);
  }

  /** 取消订阅事件 */
  off<T extends EngineEventType>(
    event: T,
    listener: EventListener<EngineEventMap[T]>,
  ): void {
    this.bus.off(event, listener);
  }

  // ═══════════════════════════════════════════
  // 6. 状态查询（供 UI 消费）
  // ═══════════════════════════════════════════

  /** 获取引擎状态快照 */
  getSnapshot(): EngineSnapshot {
    return {
      resources: this.resource.getResources(),
      productionRates: this.resource.getProductionRates(),
      caps: this.resource.getCaps(),
      buildings: this.building.getAllBuildings(),
      onlineSeconds: this.onlineSeconds,
    };
  }

  getOnlineSeconds(): number { return this.onlineSeconds; }
  isInitialized(): boolean { return this.initialized; }
  getCapWarnings(): CapWarning[] { return this.resource.getCapWarnings(); }
  getUpgradeProgress(type: BuildingType): number { return this.building.getUpgradeProgress(type); }
  getUpgradeRemainingTime(type: BuildingType): number { return this.building.getUpgradeRemainingTime(type); }

  // ═══════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════

  /** 将 GameSaveData 转换为 IGameState 格式 */
  private toIGameState(data: GameSaveData): IGameState {
    return {
      version: String(data.version),
      timestamp: data.saveTime,
      subsystems: {
        resource: data.resource,
        building: data.building,
      },
      metadata: {
        totalPlayTime: this.onlineSeconds,
        saveCount: 0,
        lastVersion: String(data.version),
      },
    };
  }

  /** 从 IGameState 提取 GameSaveData */
  private fromIGameState(state: IGameState): GameSaveData {
    return {
      version: Number(state.version),
      saveTime: state.timestamp,
      resource: state.subsystems.resource as any,
      building: state.subsystems.building as any,
    };
  }

  /** 应用从 SaveManager 加载的 IGameState */
  private applyLoadedState(state: IGameState): OfflineEarnings | null {
    try {
      const data = this.fromIGameState(state);

      if (data.version !== ENGINE_SAVE_VERSION) {
        console.warn(
          `Engine: 存档版本不匹配 (期望 ${ENGINE_SAVE_VERSION}，实际 ${data.version})，尝试兼容加载`,
        );
      }

      this.building.deserialize(data.building);
      this.resource.deserialize(data.resource);
      this.syncBuildingToResource();

      return this.computeOfflineAndFinalize();
    } catch (e) {
      console.error('ThreeKingdomsEngine.load 失败:', e);
      return null;
    }
  }

  /** 尝试加载旧格式存档（直接 JSON，无 checksum 包装） */
  private tryLoadLegacyFormat(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      // 旧格式特征：直接是 GameSaveData（有 version/saveTime/resource/building）
      // 新格式特征：外层有 v/checksum/data 字段（StateSerializer 包装）
      if (parsed.v !== undefined && parsed.checksum !== undefined && parsed.data !== undefined) {
        return null; // 这是新格式，不应在这里处理
      }

      // 校验旧格式基本结构
      if (typeof parsed.version === 'number' && parsed.resource && parsed.building) {
        return parsed as GameSaveData;
      }

      return null;
    } catch {
      return null;
    }
  }

  /** 应用旧格式存档 */
  private applyLegacyState(data: GameSaveData): OfflineEarnings | null {
    try {
      this.building.deserialize(data.building);
      this.resource.deserialize(data.resource);
      this.syncBuildingToResource();

      return this.computeOfflineAndFinalize();
    } catch (e) {
      console.error('ThreeKingdomsEngine.load 旧格式加载失败:', e);
      return null;
    }
  }

  /** 计算离线收益并完成加载 */
  private computeOfflineAndFinalize(): OfflineEarnings | null {
    const lastSaveTime = this.resource.getLastSaveTime();
    const offlineMs = Date.now() - lastSaveTime;
    let offlineEarnings: OfflineEarnings | undefined;

    if (offlineMs > 0) {
      const offlineSeconds = offlineMs / 1000;
      offlineEarnings = this.resource.applyOfflineEarnings(offlineSeconds);

      if (offlineEarnings.earned.grain > 0 ||
          offlineEarnings.earned.gold > 0 ||
          offlineEarnings.earned.troops > 0 ||
          offlineEarnings.earned.mandate > 0) {
        this.bus.emit('game:offline-earnings', offlineEarnings);
      }
    }

    this.initialized = true;
    this.lastTickTime = Date.now();
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;

    this.bus.emit('game:loaded', { offlineEarnings });
    return offlineEarnings ?? null;
  }

  /** 将建筑系统状态同步到资源系统（产出速率 + 资源上限） */
  private syncBuildingToResource(): void {
    const levels = this.building.getProductionBuildingLevels();
    this.resource.recalculateProduction(levels);
    this.resource.updateCaps(
      levels['farmland'] ?? 0,  // PRD: 粮仓容量由农田等级决定（06-building-system）
      levels['barracks'] ?? 0,
    );
  }

  /** 检测资源和产出速率变化，发出对应事件（JSON 浅比较避免无变化时频繁 emit） */
  private detectAndEmitChanges(): void {
    const resources = this.resource.getResources();
    const rates = this.resource.getProductionRates();

    const resJson = JSON.stringify(resources);
    if (resJson !== this.prevResourcesJson) {
      this.prevResourcesJson = resJson;
      this.bus.emit('resource:changed', { resources });
    }

    const ratesJson = JSON.stringify(rates);
    if (ratesJson !== this.prevRatesJson) {
      this.prevRatesJson = ratesJson;
      this.bus.emit('resource:rate-changed', { rates });
    }
  }

  // ═══════════════════════════════════════════
  // IGameEngine 兼容存根（供 GameContainer 统一调度）
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
