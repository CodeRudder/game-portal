/**
 * IdleGameEngine — 放置游戏引擎基类
 *
 * 继承自 GameEngine，提供放置游戏通用系统：
 * - 资源管理（增加、消耗、每秒产出）
 * - 升级系统（购买、费用递增、效果应用）
 * - 存档系统（保存/加载/导入/导出、自动存档）
 * - 离线收益计算
 * - 大数格式化
 * - 声望系统基础
 */
import { GameEngine } from '@/core/GameEngine';
import type { Resource, Upgrade, SaveData, OfflineReport, PrestigeData } from '@/types/idle';

/** 自动存档间隔（毫秒） */
const AUTO_SAVE_INTERVAL = 30_000;

/** 存档版本号 */
const SAVE_VERSION = '1.0.0';

/** 数字格式化后缀 */
const NUMBER_SUFFIXES: [number, string][] = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export abstract class IdleGameEngine extends GameEngine {
  // ========== 资源与升级 ==========

  protected resources: Map<string, Resource> = new Map();
  protected upgrades: Map<string, Upgrade> = new Map();
  protected prestige: PrestigeData = { currency: 0, count: 0 };
  protected statistics: Record<string, number> = {};
  protected settings: Record<string, unknown> = {};

  // ========== 内部计时 ==========

  private autoSaveTimer: number = 0;
  protected _lastSaveTime: number = 0;
  protected _gameId: string = 'idle-game';

  // ========== 公开属性 ==========

  get gameId(): string {
    return this._gameId;
  }

  get lastSaveTime(): number {
    return this._lastSaveTime;
  }

  // ========== 资源系统 ==========

  /**
   * 初始化资源列表
   */
  initializeResources(resources: Resource[]): void {
    this.resources.clear();
    for (const r of resources) {
      this.resources.set(r.id, { ...r });
    }
  }

  /**
   * 初始化升级列表
   */
  initializeUpgrades(upgrades: Upgrade[]): void {
    this.upgrades.clear();
    for (const u of upgrades) {
      this.upgrades.set(u.id, { ...u });
    }
  }

  /**
   * 获取资源
   */
  getResource(id: string): Resource | undefined {
    return this.resources.get(id);
  }

  /**
   * 获取所有已解锁资源
   */
  getUnlockedResources(): Resource[] {
    const result: Resource[] = [];
    for (const r of this.resources.values()) {
      if (r.unlocked) result.push(r);
    }
    return result;
  }

  /**
   * 增加资源
   */
  addResource(id: string, amount: number): void {
    const resource = this.resources.get(id);
    if (!resource) return;
    resource.amount = Math.min(resource.amount + amount, resource.maxAmount);
    if (amount > 0 && !resource.unlocked) {
      resource.unlocked = true;
    }
    this.emit('resourceChange', id, resource.amount);
  }

  /**
   * 消耗资源，成功返回 true
   */
  spendResource(id: string, amount: number): boolean {
    const resource = this.resources.get(id);
    if (!resource || resource.amount < amount) return false;
    resource.amount -= amount;
    this.emit('resourceChange', id, resource.amount);
    return true;
  }

  /**
   * 检查是否有足够资源
   */
  hasResource(id: string, amount: number): boolean {
    const resource = this.resources.get(id);
    return !!resource && resource.amount >= amount;
  }

  /**
   * 检查是否满足费用（多资源）
   */
  canAfford(cost: Record<string, number>): boolean {
    for (const [id, amount] of Object.entries(cost)) {
      if (!this.hasResource(id, amount)) return false;
    }
    return true;
  }

  // ========== 升级系统 ==========

  /**
   * 获取升级当前费用（含倍率递增）
   */
  getUpgradeCost(id: string): Record<string, number> {
    const upgrade = this.upgrades.get(id);
    if (!upgrade) return {};
    const cost: Record<string, number> = {};
    for (const [resId, base] of Object.entries(upgrade.baseCost)) {
      cost[resId] = Math.floor(base * Math.pow(upgrade.costMultiplier, upgrade.level));
    }
    return cost;
  }

  /**
   * 购买升级
   */
  purchaseUpgrade(id: string): boolean {
    const upgrade = this.upgrades.get(id);
    if (!upgrade || !upgrade.unlocked) return false;
    if (upgrade.level >= upgrade.maxLevel) return false;

    // 检查前置条件
    if (upgrade.requires) {
      for (const reqId of upgrade.requires) {
        const req = this.upgrades.get(reqId);
        if (!req || req.level <= 0) return false;
      }
    }

    const cost = this.getUpgradeCost(id);
    if (!this.canAfford(cost)) return false;

    // 扣除资源
    for (const [resId, amount] of Object.entries(cost)) {
      this.spendResource(resId, amount);
    }

    upgrade.level++;
    this.applyUpgradeEffect(upgrade);
    this.emit('upgradePurchased', id, upgrade.level);
    this.emit('stateChange');
    return true;
  }

  /**
   * 获取所有可购买的升级
   */
  getAvailableUpgrades(): Upgrade[] {
    const result: Upgrade[] = [];
    for (const u of this.upgrades.values()) {
      if (u.unlocked && u.level < u.maxLevel) {
        result.push(u);
      }
    }
    return result;
  }

  /**
   * 应用升级效果（子类可覆盖以实现自定义效果）
   */
  protected applyUpgradeEffect(upgrade: Upgrade): void {
    const { type, target, value } = upgrade.effect;
    const resource = this.resources.get(target);
    if (!resource) return;

    switch (type) {
      case 'add_production':
        resource.perSecond += value;
        break;
      case 'multiply_production':
        resource.perSecond *= value;
        break;
      case 'add_max':
        resource.maxAmount += value;
        break;
      case 'unlock':
        if (resource) resource.unlocked = true;
        break;
    }
  }

  // ========== 离线收益 ==========

  /**
   * 计算离线收益
   */
  calculateOfflineEarnings(offlineMs: number): OfflineReport {
    const earnedResources: Record<string, number> = {};
    const seconds = offlineMs / 1000;

    for (const resource of this.resources.values()) {
      if (resource.unlocked && resource.perSecond > 0) {
        const earned = resource.perSecond * seconds;
        earnedResources[resource.id] = earned;
      }
    }

    return {
      offlineMs,
      earnedResources,
      timestamp: Date.now(),
    };
  }

  /**
   * 应用离线收益
   */
  applyOfflineEarnings(report: OfflineReport): void {
    for (const [id, amount] of Object.entries(report.earnedResources)) {
      this.addResource(id, amount);
    }
  }

  // ========== 存档系统 ==========

  /**
   * 生成存档数据
   */
  save(): SaveData {
    const resources: Record<string, { amount: number; unlocked: boolean }> = {};
    for (const [id, r] of this.resources) {
      resources[id] = { amount: r.amount, unlocked: r.unlocked };
    }

    const upgrades: Record<string, number> = {};
    for (const [id, u] of this.upgrades) {
      if (u.level > 0) upgrades[id] = u.level;
    }

    this._lastSaveTime = Date.now();

    return {
      version: SAVE_VERSION,
      gameId: this._gameId,
      timestamp: this._lastSaveTime,
      resources,
      upgrades,
      prestige: { ...this.prestige },
      statistics: { ...this.statistics },
      settings: { ...this.settings },
    };
  }

  /**
   * 加载存档
   */
  load(data: SaveData): void {
    if (data.gameId !== this._gameId) return;

    // 恢复资源
    for (const [id, saved] of Object.entries(data.resources)) {
      const resource = this.resources.get(id);
      if (resource) {
        resource.amount = saved.amount;
        resource.unlocked = saved.unlocked;
      }
    }

    // 恢复升级
    for (const [id, level] of Object.entries(data.upgrades)) {
      const upgrade = this.upgrades.get(id);
      if (upgrade) {
        upgrade.level = level;
        // 重新应用效果
        this.recalculateProduction();
      }
    }

    // 恢复声望
    this.prestige = { ...data.prestige };

    // 恢复统计
    this.statistics = { ...data.statistics };

    // 恢复设置
    this.settings = { ...data.settings };

    // 计算离线收益
    const offlineMs = Date.now() - data.timestamp;
    if (offlineMs > 5000) {
      const report = this.calculateOfflineEarnings(offlineMs);
      this.applyOfflineEarnings(report);
      this.emit('offlineEarnings', report);
    }

    this._lastSaveTime = Date.now();
    this.emit('saveLoaded');
    this.emit('stateChange');
  }

  /**
   * 导出存档为 Base64
   */
  exportSave(): string {
    const data = this.save();
    const json = JSON.stringify(data);
    try {
      return btoa(encodeURIComponent(json));
    } catch {
      return btoa(json);
    }
  }

  /**
   * 导入存档
   */
  importSave(encoded: string): boolean {
    try {
      const json = decodeURIComponent(atob(encoded));
      const data = JSON.parse(json) as SaveData;
      if (!data.version || !data.gameId || data.gameId !== this._gameId) {
        return false;
      }
      this.load(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从 localStorage 加载自动存档
   */
  loadFromStorage(): boolean {
    try {
      const key = `idle-save-${this._gameId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const data = JSON.parse(raw) as SaveData;
      this.load(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 保存到 localStorage
   */
  saveToStorage(): void {
    try {
      const key = `idle-save-${this._gameId}`;
      const data = this.save();
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // localStorage 可能不可用
    }
  }

  // ========== 重新计算产出 ==========

  /**
   * 重新计算所有资源的每秒产出（子类可覆盖）
   */
  protected recalculateProduction(): void {
    // 先重置所有 perSecond 为 0
    for (const r of this.resources.values()) {
      r.perSecond = 0;
    }
    // 然后重新应用所有升级效果
    for (const u of this.upgrades.values()) {
      if (u.level > 0) {
        for (let i = 0; i < u.level; i++) {
          this.applyUpgradeEffect(u);
        }
      }
    }
  }

  // ========== 数字格式化 ==========

  /**
   * 格式化大数 (K/M/B/T/Qa/Qi/...)
   */
  formatNumber(value: number, decimals: number = 1): string {
    if (value < 0) return '-' + this.formatNumber(-value, decimals);
    if (!isFinite(value)) return '∞';

    for (const [threshold, suffix] of NUMBER_SUFFIXES) {
      if (value >= threshold) {
        const formatted = value / threshold;
        if (Math.abs(formatted - Math.round(formatted)) < 1e-9) {
          return `${Math.round(formatted)}${suffix}`;
        }
        return `${formatted.toFixed(decimals)}${suffix}`;
      }
    }

    if (value === Math.floor(value)) {
      return Math.floor(value).toString();
    }

    return value.toFixed(decimals);
  }

  // ========== 游戏循环 ==========

  protected onInit(): void {
    this.resources.clear();
    this.upgrades.clear();
    this.prestige = { currency: 0, count: 0 };
    this.statistics = {};
    this.settings = {};
    this.autoSaveTimer = 0;
    this._lastSaveTime = 0;
  }

  protected onStart(): void {
    // 尝试加载存档
    this.loadFromStorage();
  }

  protected onPause(): void {
    // 暂停时自动保存
    this.saveToStorage();
  }

  protected onResume(): void {
    // 恢复时无需特殊处理
  }

  protected onReset(): void {
    // 重置时清除存档
    try {
      const key = `idle-save-${this._gameId}`;
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    this.onInit();
  }

  protected onDestroy(): void {
    // 销毁时保存
    this.saveToStorage();
  }

  /**
   * 每帧更新 — 放置游戏核心：资源产出 + 自动存档
   */
  update(deltaTime: number): void {
    if (this._status !== 'playing') return;

    const secondsDelta = deltaTime / 1000;

    // 更新资源产出
    for (const resource of this.resources.values()) {
      if (resource.unlocked && resource.perSecond > 0) {
        const produced = resource.perSecond * secondsDelta;
        resource.amount = Math.min(resource.amount + produced, resource.maxAmount);
      }
    }

    // 自动存档
    this.autoSaveTimer += deltaTime;
    if (this.autoSaveTimer >= AUTO_SAVE_INTERVAL) {
      this.autoSaveTimer = 0;
      this.saveToStorage();
    }

    // 子类更新
    this.onUpdate(deltaTime);

    this.emit('stateChange');
  }

  /**
   * 子类实现每帧更新逻辑
   */
  protected abstract onUpdate(deltaTime: number): void;

  // ========== 输入处理（放置游戏通常不需要键盘） ==========

  handleKeyDown(_key: string): void {
    // 放置游戏默认不处理键盘
  }

  handleKeyUp(_key: string): void {
    // 放置游戏默认不处理键盘
  }

  /**
   * 获取游戏状态
   */
  getState(): Record<string, unknown> {
    return {
      gameId: this._gameId,
      resources: Object.fromEntries(
        Array.from(this.resources.entries()).map(([id, r]) => [id, { amount: r.amount, perSecond: r.perSecond, unlocked: r.unlocked }])
      ),
      upgrades: Object.fromEntries(
        Array.from(this.upgrades.entries()).map(([id, u]) => [id, { level: u.level, unlocked: u.unlocked }])
      ),
      prestige: this.prestige,
      statistics: this.statistics,
    };
  }
}
