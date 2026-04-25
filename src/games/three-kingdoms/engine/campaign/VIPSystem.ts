/**
 * VIP等级系统 — 引擎层核心逻辑
 *
 * 管理VIP等级、经验累积、特权校验。
 * 覆盖PRD §9.4/§9.6 的引擎层功能：
 * - VIP经验获取与等级判定
 * - VIP特权解锁校验（倍速/免费扫荡/离线时长等）
 * - GM命令支持（测试环境）
 *
 * @module engine/campaign/VIPSystem
 */

import type { ISubsystem, ISystemDeps } from '../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** VIP等级配置 */
export interface VIPLevelConfig {
  /** VIP等级 */
  level: number;
  /** 所需累计经验 */
  requiredExp: number;
  /** 解锁特权列表 */
  privileges: VIPPrivilege[];
}

/** VIP特权类型 */
export type VIPPrivilege =
  | 'speed_3x'          // 3×倍速解锁 (VIP3+)
  | 'speed_instant'     // 极速模式解锁 (VIP5+)
  | 'free_sweep'        // 免费扫荡3次/日 (VIP5+)
  | 'extra_sweep_ticket_1' // 每日额外扫荡令×1 (VIP1+)
  | 'extra_sweep_ticket_2' // 每日额外扫荡令×2 (VIP4+)
  | 'offline_hours_2'   // 离线挂机上限+2小时 (VIP2+)
  | 'offline_hours_4';  // 离线挂机上限+4小时 (VIP6+)

/** VIP系统状态 */
export interface VIPState {
  /** 当前VIP经验（累计值） */
  vipExp: number;
  /** 当前VIP等级 */
  vipLevel: number;
  /** 今日已使用免费扫荡次数 */
  freeSweepUsedToday: number;
  /** 上次重置免费扫荡的日期 */
  lastFreeSweepResetDate: string | null;
  /** 是否为GM模式（测试用） */
  gmMode: boolean;
  /** GM模式下的临时VIP等级 */
  gmLevel: number | null;
}

/** VIP系统存档数据 */
export interface VIPSaveData {
  version: number;
  vipExp: number;
  freeSweepUsedToday: number;
  lastFreeSweepResetDate: string | null;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** VIP等级配置表（与PRD §9.6一致） */
const VIP_LEVEL_TABLE: VIPLevelConfig[] = [
  { level: 0, requiredExp: 0,     privileges: [] },
  { level: 1, requiredExp: 100,   privileges: ['extra_sweep_ticket_1'] },
  { level: 2, requiredExp: 300,   privileges: ['offline_hours_2'] },
  { level: 3, requiredExp: 600,   privileges: ['speed_3x'] },
  { level: 4, requiredExp: 1000,  privileges: ['extra_sweep_ticket_2'] },
  { level: 5, requiredExp: 1500,  privileges: ['speed_instant', 'free_sweep'] },
  { level: 6, requiredExp: 2500,  privileges: ['offline_hours_4'] },
];

/** 免费扫荡每日上限 */
const FREE_SWEEP_DAILY_LIMIT = 3;

/** 存档版本号 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 获取今日日期字符串 (YYYY-MM-DD) */
function getTodayString(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 根据经验值计算VIP等级 */
function calcLevelFromExp(exp: number): number {
  let level = 0;
  for (const cfg of VIP_LEVEL_TABLE) {
    if (exp >= cfg.requiredExp) level = cfg.level;
    else break;
  }
  return level;
}

// ─────────────────────────────────────────────
// VIPSystem
// ─────────────────────────────────────────────

/**
 * VIP等级系统
 *
 * 管理VIP经验累积、等级判定和特权校验。
 * VIP等级不降级，已解锁功能永久可用。
 *
 * @example
 * ```ts
 * const vip = new VIPSystem();
 * vip.init(deps);
 * vip.addExp(100); // 充值获得100VIP经验
 * vip.hasPrivilege('speed_3x'); // false (需要VIP3)
 * vip.getEffectiveLevel(); // 1
 * ```
 */
export class VIPSystem implements ISubsystem {
  readonly name = 'vipSystem' as const;
  private sysDeps: ISystemDeps | null = null;

  /** VIP经验（累计值，不消耗） */
  private vipExp: number;
  /** 今日已使用免费扫荡次数 */
  private freeSweepUsedToday: number;
  /** 上次重置免费扫荡的日期 */
  private lastFreeSweepResetDate: string | null;
  /** GM模式标记 */
  private gmMode: boolean;
  /** GM临时等级 */
  private gmLevel: number | null;

  constructor() {
    this.vipExp = 0;
    this.freeSweepUsedToday = 0;
    this.lastFreeSweepResetDate = null;
    this.gmMode = false;
    this.gmLevel = null;
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void { this.sysDeps = deps; }
  update(_dt: number): void { /* 事件驱动 */ }

  getState(): VIPState {
    return {
      vipExp: this.vipExp,
      vipLevel: this.getEffectiveLevel(),
      freeSweepUsedToday: this.freeSweepUsedToday,
      lastFreeSweepResetDate: this.lastFreeSweepResetDate,
      gmMode: this.gmMode,
      gmLevel: this.gmLevel,
    };
  }

  reset(): void {
    this.vipExp = 0;
    this.freeSweepUsedToday = 0;
    this.lastFreeSweepResetDate = null;
    this.gmMode = false;
    this.gmLevel = null;
  }

  // ── 经验与等级 ──

  /**
   * 增加VIP经验（充值/活动/成就奖励）
   * 1元 = 10 VIP经验
   */
  addExp(amount: number): void {
    if (amount <= 0) return;
    this.vipExp += amount;
  }

  /** 获取当前VIP经验 */
  getExp(): number { return this.vipExp; }

  /** 获取基础VIP等级（基于经验） */
  getBaseLevel(): number { return calcLevelFromExp(this.vipExp); }

  /** 获取有效VIP等级（GM模式下可覆盖） */
  getEffectiveLevel(): number {
    if (this.gmMode && this.gmLevel !== null) return this.gmLevel;
    return this.getBaseLevel();
  }

  /** 获取下一等级所需经验，满级返回null */
  getNextLevelExp(): number | null {
    const currentLevel = this.getBaseLevel();
    const nextLevel = VIP_LEVEL_TABLE.find(c => c.level === currentLevel + 1);
    return nextLevel ? nextLevel.requiredExp : null;
  }

  /** 获取当前等级的进度百分比 (0~1) */
  getLevelProgress(): number {
    const level = this.getBaseLevel();
    const current = VIP_LEVEL_TABLE.find(c => c.level === level)!;
    const next = VIP_LEVEL_TABLE.find(c => c.level === level + 1);
    if (!next) return 1; // 满级
    const range = next.requiredExp - current.requiredExp;
    const progress = this.vipExp - current.requiredExp;
    return Math.min(1, Math.max(0, progress / range));
  }

  // ── 特权校验 ──

  /** 检查是否拥有某项特权 */
  hasPrivilege(privilege: VIPPrivilege): boolean {
    const level = this.getEffectiveLevel();
    // 查找该特权所需的最低VIP等级
    for (const cfg of VIP_LEVEL_TABLE) {
      if (cfg.privileges.includes(privilege) && level >= cfg.level) {
        return true;
      }
    }
    return false;
  }

  /** 检查是否可以使用3×倍速 (VIP3+) */
  canUseSpeed3x(): boolean { return this.hasPrivilege('speed_3x'); }

  /** 检查是否可以使用极速模式 (VIP5+) */
  canUseSpeedInstant(): boolean { return this.hasPrivilege('speed_instant'); }

  /** 检查是否可以使用免费扫荡 (VIP5+) */
  canUseFreeSweep(): boolean { return this.hasPrivilege('free_sweep'); }

  /** 获取每日额外扫荡令数量 */
  getExtraDailyTickets(): number {
    let extra = 0;
    if (this.hasPrivilege('extra_sweep_ticket_1')) extra += 1;
    if (this.hasPrivilege('extra_sweep_ticket_2')) extra += 2;
    return extra;
  }

  /** 获取离线挂机时长加成（小时） */
  getOfflineHoursBonus(): number {
    let bonus = 0;
    if (this.hasPrivilege('offline_hours_2')) bonus += 2;
    if (this.hasPrivilege('offline_hours_4')) bonus += 4;
    return bonus;
  }

  /** 获取离线挂机总上限（基础12小时 + VIP加成） */
  getOfflineHoursLimit(): number {
    return 12 + this.getOfflineHoursBonus();
  }

  // ── 免费扫荡 ──

  /** 获取今日剩余免费扫荡次数 */
  getFreeSweepRemaining(now: number = Date.now()): number {
    this.resetDailyIfNeeded(now);
    if (!this.canUseFreeSweep()) return 0;
    return Math.max(0, FREE_SWEEP_DAILY_LIMIT - this.freeSweepUsedToday);
  }

  /** 使用一次免费扫荡 */
  useFreeSweep(now: number = Date.now()): boolean {
    this.resetDailyIfNeeded(now);
    if (!this.canUseFreeSweep()) return false;
    if (this.freeSweepUsedToday >= FREE_SWEEP_DAILY_LIMIT) return false;
    this.freeSweepUsedToday++;
    return true;
  }

  /** 每日重置免费扫荡计数 */
  private resetDailyIfNeeded(now: number = Date.now()): void {
    const today = getTodayString(now);
    if (this.lastFreeSweepResetDate !== today) {
      this.freeSweepUsedToday = 0;
      this.lastFreeSweepResetDate = today;
    }
  }

  // ── GM命令（测试用） ──

  /**
   * GM命令：设置VIP等级（仅测试环境）
   * /setvip <level>
   */
  gmSetLevel(level: number): void {
    if (level < 0) level = 0;
    if (level > 6) level = 6;
    this.gmMode = true;
    this.gmLevel = level;
  }

  /**
   * GM命令：重置VIP等级为真实等级
   * /resetvip
   */
  gmResetLevel(): void {
    this.gmMode = false;
    this.gmLevel = null;
  }

  /** 检查是否处于GM模式 */
  isGMMode(): boolean { return this.gmMode; }

  // ── 存档 ──

  /** 序列化为存档数据 */
  serialize(): VIPSaveData {
    return {
      version: SAVE_VERSION,
      vipExp: this.vipExp,
      freeSweepUsedToday: this.freeSweepUsedToday,
      lastFreeSweepResetDate: this.lastFreeSweepResetDate,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: VIPSaveData): void {
    if (!data || data.version !== SAVE_VERSION) return;
    this.vipExp = data.vipExp;
    this.freeSweepUsedToday = data.freeSweepUsedToday;
    this.lastFreeSweepResetDate = data.lastFreeSweepResetDate;
    this.gmMode = false;
    this.gmLevel = null;
  }

  // ── 查询 ──

  /** 获取VIP等级配置表 */
  static getLevelTable(): ReadonlyArray<VIPLevelConfig> {
    return VIP_LEVEL_TABLE;
  }

  /** 获取指定等级的配置 */
  static getLevelConfig(level: number): VIPLevelConfig | undefined {
    return VIP_LEVEL_TABLE.find(c => c.level === level);
  }
}
