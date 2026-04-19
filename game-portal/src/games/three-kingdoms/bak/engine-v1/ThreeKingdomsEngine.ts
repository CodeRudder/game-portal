/**
 * 三国霸业 — 引擎主类（应用层/编排层）
 *
 * 职责：编排各子系统，协调业务流程
 * 规则：不包含具体业务逻辑，只做编排
 *
 * v1.0 范围：
 *   - 初始化 ResourceSystem + BuildingSystem，建立联动
 *   - 游戏循环 tick：驱动资源产出（building→resource 联动）
 *   - 建筑升级编排（检查→扣费→开始→完成回调）
 *   - 存档/读档序列化
 *   - 事件通知（供 UI 订阅）
 *   - 游戏时间管理（在线时长、离线收益）
 */

import { ResourceSystem } from './resource/ResourceSystem';
import { BuildingSystem } from './building/BuildingSystem';
import type { Resources, CapWarning, OfflineEarnings } from './resource/resource.types';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from './building/building.types';
import type {
  EngineEventType, EngineEventMap, EventListener, GameSaveData, EngineSnapshot,
} from '../shared/types';
import { AUTO_SAVE_INTERVAL_SECONDS, SAVE_KEY, ENGINE_SAVE_VERSION } from '../shared/constants';

// ─────────────────────────────────────────────
// 事件总线（内部实现）
// ─────────────────────────────────────────────

type ListenerEntry = { once: boolean; fn: EventListener<unknown> };

class EventBus {
  private listeners = new Map<EngineEventType, ListenerEntry[]>();

  on<T extends EngineEventType>(
    event: T,
    fn: EventListener<EngineEventMap[T]>,
  ): void {
    this.add(event, fn as EventListener<never>, false);
  }

  once<T extends EngineEventType>(
    event: T,
    fn: EventListener<EngineEventMap[T]>,
  ): void {
    this.add(event, fn as EventListener<never>, true);
  }

  off<T extends EngineEventType>(
    event: T,
    fn: EventListener<EngineEventMap[T]>,
  ): void {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(
      event,
      list.filter((e) => e.fn !== (fn as EventListener<never>)),
    );
  }

  emit<T extends EngineEventType>(
    event: T,
    payload: EngineEventMap[T],
  ): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const keep: ListenerEntry[] = [];
    for (const entry of list) {
      (entry.fn as EventListener<EngineEventMap[T]>)(payload);
      if (!entry.once) keep.push(entry);
    }
    this.listeners.set(event, keep);
  }

  removeAll(): void {
    this.listeners.clear();
  }

  private add(event: EngineEventType, fn: EventListener<never>, once: boolean): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push({ once, fn: fn as EventListener<unknown> });
  }
}

// ─────────────────────────────────────────────
// ThreeKingdomsEngine
// ─────────────────────────────────────────────

export class ThreeKingdomsEngine {
  // ── 子系统 ──
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;

  // ── 事件总线 ──
  private readonly bus: EventBus;

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
    this.bus = new EventBus();
  }

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════

  /**
   * 初始化引擎（新游戏）
   * 创建子系统、建立联动、发出初始化事件
   */
  init(): void {
    if (this.initialized) return;

    // 建立联动：根据建筑等级计算产出和上限
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

  /**
   * 驱动所有子系统更新
   * 建议以 100ms 间隔调用（TICK_INTERVAL_MS）
   *
   * @param deltaMs 距上次 tick 的毫秒数（若不传则自动计算）
   */
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
    const bonuses = { castle: castleMultiplier - 1 }; // castle bonus: e.g. 0.08 = +8%
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

  /**
   * 检查建筑是否可升级（不消耗资源）
   */
  checkUpgrade(type: BuildingType): UpgradeCheckResult {
    return this.building.checkUpgrade(type, this.resource.getResources());
  }

  /**
   * 获取升级费用
   */
  getUpgradeCost(type: BuildingType): UpgradeCost | null {
    return this.building.getUpgradeCost(type);
  }

  /**
   * 执行建筑升级
   * 编排流程：前置检查 → 扣除资源 → 开始升级 → 发出事件
   *
   * @throws 资源不足或条件不满足时抛错
   */
  upgradeBuilding(type: BuildingType): void {
    const resources = this.resource.getResources();

    // 3a. 前置条件检查（含资源检查）
    const check = this.building.checkUpgrade(type, resources);
    if (!check.canUpgrade) {
      throw new Error(`无法升级 ${type}：${check.reasons.join('；')}`);
    }

    // 3b. 获取费用
    const cost = this.building.getUpgradeCost(type);
    if (!cost) throw new Error(`无法获取 ${type} 的升级费用`);

    // 3c. 扣除资源（原子操作）
    this.resource.consumeBatch({
      grain: cost.grain,
      gold: cost.gold,
      troops: cost.troops,
    });

    // 3d. 开始升级（BuildingSystem 内部设置计时）
    this.building.startUpgrade(type, resources);

    // 3e. 发出事件
    this.bus.emit('building:upgrade-start', { type, cost });

    // 3f. 资源变化通知
    this.bus.emit('resource:changed', { resources: this.resource.getResources() });
  }

  /**
   * 取消建筑升级
   * @returns 返还的资源费用（80%），null 表示该建筑未在升级
   */
  cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const refund = this.building.cancelUpgrade(type);
    if (!refund) return null;

    // 返还资源
    if (refund.grain > 0) this.resource.addResource('grain', refund.grain);
    if (refund.gold > 0) this.resource.addResource('gold', refund.gold);
    if (refund.troops > 0) this.resource.addResource('troops', refund.troops);

    this.bus.emit('resource:changed', { resources: this.resource.getResources() });
    return refund;
  }

  // ═══════════════════════════════════════════
  // 4. 存档 / 读档
  // ═══════════════════════════════════════════

  /**
   * 保存游戏到 localStorage
   */
  save(): void {
    const data: GameSaveData = {
      version: ENGINE_SAVE_VERSION,
      saveTime: Date.now(),
      resource: this.resource.serialize(),
      building: this.building.serialize(),
    };

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.resource.touchSaveTime();
      this.bus.emit('game:saved', { timestamp: data.saveTime });
    } catch (e) {
      console.error('ThreeKingdomsEngine.save 失败:', e);
    }
  }

  /**
   * 从 localStorage 加载存档
   * 自动计算并应用离线收益
   *
   * @returns 离线收益信息（如果有的话），null 表示无存档
   */
  load(): OfflineEarnings | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    try {
      const data: GameSaveData = JSON.parse(raw);

      // 版本检查
      if (data.version !== ENGINE_SAVE_VERSION) {
        console.warn(
          `Engine: 存档版本不匹配 (期望 ${ENGINE_SAVE_VERSION}，实际 ${data.version})，尝试兼容加载`,
        );
      }

      // 4a. 恢复子系统
      this.building.deserialize(data.building);
      this.resource.deserialize(data.resource);

      // 4b. 建立联动
      this.syncBuildingToResource();

      // 4c. 计算离线收益
      const lastSaveTime = this.resource.getLastSaveTime();
      const offlineMs = Date.now() - lastSaveTime;
      let offlineEarnings: OfflineEarnings | undefined;

      if (offlineMs > 0) {
        const offlineSeconds = offlineMs / 1000;
        offlineEarnings = this.resource.applyOfflineEarnings(offlineSeconds);

        // 离线收益事件
        if (offlineEarnings.earned.grain > 0 ||
            offlineEarnings.earned.gold > 0 ||
            offlineEarnings.earned.troops > 0 ||
            offlineEarnings.earned.mandate > 0) {
          this.bus.emit('game:offline-earnings', offlineEarnings);
        }
      }

      // 4d. 标记已初始化
      this.initialized = true;
      this.lastTickTime = Date.now();
      this.onlineSeconds = 0;
      this.autoSaveAccumulator = 0;

      this.bus.emit('game:loaded', { offlineEarnings });
      return offlineEarnings ?? null;
    } catch (e) {
      console.error('ThreeKingdomsEngine.load 失败:', e);
      return null;
    }
  }

  /**
   * 序列化为 JSON 字符串（不写入 localStorage）
   */
  serialize(): string {
    const data: GameSaveData = {
      version: ENGINE_SAVE_VERSION,
      saveTime: Date.now(),
      resource: this.resource.serialize(),
      building: this.building.serialize(),
    };
    return JSON.stringify(data);
  }

  /**
   * 从 JSON 字符串反序列化（不从 localStorage 读取）
   */
  deserialize(json: string): void {
    const data: GameSaveData = JSON.parse(json);
    this.building.deserialize(data.building);
    this.resource.deserialize(data.resource);
    this.syncBuildingToResource();
    this.initialized = true;
    this.lastTickTime = Date.now();
  }

  /**
   * 检查是否存在存档
   */
  hasSaveData(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  /**
   * 清除存档并重置引擎
   */
  reset(): void {
    this.resource.reset();
    this.building.reset();
    this.initialized = false;
    this.onlineSeconds = 0;
    this.autoSaveAccumulator = 0;
    this.prevResourcesJson = '';
    this.prevRatesJson = '';
    localStorage.removeItem(SAVE_KEY);
    this.bus.removeAll();
  }

  // ═══════════════════════════════════════════
  // 5. 事件系统
  // ═══════════════════════════════════════════

  /** 订阅事件 */
  on<T extends EngineEventType>(
    event: T,
    listener: EventListener<EngineEventMap[T]>,
  ): void {
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

  /** 在线时长（秒） */
  getOnlineSeconds(): number {
    return this.onlineSeconds;
  }

  /** 是否已初始化 */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** 获取容量警告列表 */
  getCapWarnings(): CapWarning[] {
    return this.resource.getCapWarnings();
  }

  /** 获取建筑升级进度 0~1 */
  getUpgradeProgress(type: BuildingType): number {
    return this.building.getUpgradeProgress(type);
  }

  /** 获取建筑升级剩余时间（秒） */
  getUpgradeRemainingTime(type: BuildingType): number {
    return this.building.getUpgradeRemainingTime(type);
  }

  // ═══════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════

  /**
   * 将建筑系统的状态同步到资源系统
   * 1. 根据建筑等级重算产出速率
   * 2. 根据建筑等级更新资源上限
   */
  private syncBuildingToResource(): void {
    const levels = this.building.getProductionBuildingLevels();
    this.resource.recalculateProduction(levels);
    this.resource.updateCaps(
      levels['smithy'] ?? 0,  // 铁匠铺等级 → 粮仓容量（smithy暂代，实际由granary建筑负责）
      levels['barracks'] ?? 0,
    );
  }

  /**
   * 检测资源和产出速率变化，发出对应事件
   * 使用 JSON 序列化做浅比较，避免无变化时频繁 emit
   */
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
}
