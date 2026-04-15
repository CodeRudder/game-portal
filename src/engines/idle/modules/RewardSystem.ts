/**
 * RewardSystem — 放置游戏奖励系统核心模块
 *
 * 提供奖励类型管理、奖励弹出展示、累计登录奖励、
 * 等级奖励、邮件系统等完整功能。
 *
 * @module engines/idle/modules/RewardSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 奖励类型 */
export type RewardType = 'resource' | 'item' | 'building' | 'character' | 'skin';

/** 奖励条目 */
export interface RewardItem {
  type: RewardType;
  id: string;
  amount: number;
  icon?: string;
  name?: string;
}

/** 邮件 */
export interface Mail {
  id: string;
  title: string;
  content: string;
  sender: string;
  rewards: RewardItem[];
  read: boolean;
  claimed: boolean;
  sentAt: number;
  expiresAt: number;
}

/** 登录奖励配置 */
export interface LoginBonusDef {
  day: number;
  rewards: RewardItem[];
  icon: string;
}

/** 等级奖励配置 */
export interface LevelRewardDef {
  level: number;
  rewards: RewardItem[];
}

/** 奖励系统事件 */
export type RewardEvent =
  | { type: 'reward_granted'; rewards: RewardItem[] }
  | { type: 'mail_received'; mailId: string }
  | { type: 'mail_claimed'; mailId: string }
  | { type: 'login_bonus_claimed'; day: number }
  | { type: 'level_reward_claimed'; level: number };

/** 事件监听器类型 */
export type RewardEventListener = (event: RewardEvent) => void;

// ============================================================
// RewardSystem 实现
// ============================================================

/**
 * 奖励系统 — 管理奖励发放、邮件、登录奖励、等级奖励
 *
 * @example
 * ```typescript
 * const rewardSys = new RewardSystem();
 * rewardSys.setLoginBonuses([
 *   { day: 1, rewards: [{ type: 'resource', id: 'gold', amount: 100 }], icon: '🪙' },
 *   { day: 2, rewards: [{ type: 'resource', id: 'gem', amount: 10 }], icon: '💎' },
 * ]);
 * rewardSys.grantReward([{ type: 'resource', id: 'gold', amount: 50 }]);
 * ```
 */
export class RewardSystem {

  // ========== 内部数据 ==========

  /** 待领取的奖励队列 */
  private readonly _pendingRewards: RewardItem[] = [];

  /** 邮箱 */
  private readonly _mailBox: Map<string, Mail> = new Map();

  /** 登录奖励配置 */
  private loginBonuses: LoginBonusDef[] = [];

  /** 等级奖励配置 */
  private levelRewards: LevelRewardDef[] = [];

  /** 当前连续登录天数 */
  private consecutiveLoginDays: number = 0;

  /** 上次登录日期 */
  private lastLoginDate: string = '';

  /** 已领取的登录奖励天数集合 */
  private claimedLoginDays: Set<number> = new Set();

  /** 已领取的等级奖励集合 */
  private claimedLevelRewards: Set<number> = new Set();

  /** 邮件自增 ID */
  private mailIdCounter: number = 0;

  /** 事件监听器 */
  private readonly listeners: RewardEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 设置登录奖励配置
   */
  setLoginBonuses(bonuses: LoginBonusDef[]): void {
    this.loginBonuses = bonuses.sort((a, b) => a.day - b.day);
  }

  /**
   * 设置等级奖励配置
   */
  setLevelRewards(rewards: LevelRewardDef[]): void {
    this.levelRewards = rewards.sort((a, b) => a.level - b.level);
  }

  /**
   * 从存档恢复
   */
  loadState(data: {
    consecutiveLoginDays?: number;
    lastLoginDate?: string;
    claimedLoginDays?: number[];
    claimedLevelRewards?: number[];
    mails?: Mail[];
  }): void {
    this.consecutiveLoginDays = data.consecutiveLoginDays ?? 0;
    this.lastLoginDate = data.lastLoginDate ?? '';
    this.claimedLoginDays = new Set(data.claimedLoginDays ?? []);
    this.claimedLevelRewards = new Set(data.claimedLevelRewards ?? []);
    if (data.mails) {
      for (const mail of data.mails) {
        this._mailBox.set(mail.id, mail);
      }
    }
  }

  /**
   * 导出状态
   */
  saveState(): {
    consecutiveLoginDays: number;
    lastLoginDate: string;
    claimedLoginDays: number[];
    claimedLevelRewards: number[];
    mails: Mail[];
  } {
    return {
      consecutiveLoginDays: this.consecutiveLoginDays,
      lastLoginDate: this.lastLoginDate,
      claimedLoginDays: Array.from(this.claimedLoginDays),
      claimedLevelRewards: Array.from(this.claimedLevelRewards),
      mails: Array.from(this._mailBox.values()),
    };
  }

  // ============================================================
  // 查询
  // ============================================================

  /** 待领取奖励 */
  get pendingRewards(): RewardItem[] {
    return [...this._pendingRewards];
  }

  /** 邮箱列表 */
  get mailBox(): Mail[] {
    return Array.from(this._mailBox.values()).sort((a, b) => b.sentAt - a.sentAt);
  }

  /** 未读邮件数量 */
  get unreadCount(): number {
    let count = 0;
    for (const mail of this._mailBox.values()) {
      if (!mail.read) count++;
    }
    return count;
  }

  /**
   * 获取当前登录奖励信息
   */
  getLoginBonus(): { day: number; rewards: RewardItem[]; claimed: boolean } | null {
    if (this.loginBonuses.length === 0) return null;
    const day = this.consecutiveLoginDays;
    const bonus = this.loginBonuses.find((b) => b.day === day);
    if (!bonus) return null;
    return { day: bonus.day, rewards: [...bonus.rewards], claimed: this.claimedLoginDays.has(day) };
  }

  /**
   * 获取所有登录奖励配置
   */
  getAllLoginBonuses(): LoginBonusDef[] {
    return [...this.loginBonuses];
  }

  /**
   * 获取指定等级奖励
   */
  getLevelReward(level: number): LevelRewardDef | undefined {
    return this.levelRewards.find((r) => r.level === level);
  }

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 发放奖励（加入待领取队列）
   */
  grantReward(rewards: RewardItem[]): void {
    this._pendingRewards.push(...rewards);
    this.emitEvent({ type: 'reward_granted', rewards });
  }

  /**
   * 领取指定待领取奖励
   */
  claimReward(index: number): RewardItem[] | null {
    if (index < 0 || index >= this._pendingRewards.length) return null;
    return this._pendingRewards.splice(index, 1);
  }

  /**
   * 领取所有待领取奖励
   */
  claimAll(): RewardItem[] {
    const all = [...this._pendingRewards];
    this._pendingRewards.length = 0;
    return all;
  }

  /**
   * 发送邮件
   */
  sendMail(options: { title: string; content: string; sender: string; rewards?: RewardItem[]; expiresIn?: number }): string {
    const id = `mail_${++this.mailIdCounter}_${Date.now()}`;
    const now = Date.now();
    const mail: Mail = {
      id,
      title: options.title,
      content: options.content,
      sender: options.sender,
      rewards: options.rewards ?? [],
      read: false,
      claimed: false,
      sentAt: now,
      expiresAt: now + (options.expiresIn ?? 7 * 86400000),
    };
    this._mailBox.set(id, mail);
    this.emitEvent({ type: 'mail_received', mailId: id });
    return id;
  }

  /**
   * 打开/阅读邮件
   */
  openMail(id: string): Mail | null {
    const mail = this._mailBox.get(id);
    if (!mail) return null;
    mail.read = true;
    return { ...mail };
  }

  /**
   * 领取邮件中的奖励
   */
  claimMailReward(id: string): RewardItem[] | null {
    const mail = this._mailBox.get(id);
    if (!mail || mail.claimed || mail.rewards.length === 0) return null;
    mail.claimed = true;
    this.emitEvent({ type: 'mail_claimed', mailId: id });
    return [...mail.rewards];
  }

  /**
   * 删除邮件
   */
  deleteMail(id: string): boolean {
    return this._mailBox.delete(id);
  }

  /**
   * 检查并处理每日登录
   *
   * @returns 是否是新的一天
   */
  checkDailyLogin(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastLoginDate === today) return false;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (this.lastLoginDate === yesterday) {
      this.consecutiveLoginDays++;
    } else {
      this.consecutiveLoginDays = 1;
    }
    this.lastLoginDate = today;
    return true;
  }

  /**
   * 领取登录奖励
   */
  claimLoginBonus(): RewardItem[] | null {
    const bonus = this.getLoginBonus();
    if (!bonus || bonus.claimed) return null;

    this.claimedLoginDays.add(bonus.day);
    this.emitEvent({ type: 'login_bonus_claimed', day: bonus.day });
    return [...bonus.rewards];
  }

  /**
   * 领取等级奖励
   */
  claimLevelReward(level: number): RewardItem[] | null {
    const def = this.levelRewards.find((r) => r.level === level);
    if (!def) return null;
    if (this.claimedLevelRewards.has(level)) return null;

    this.claimedLevelRewards.add(level);
    this.emitEvent({ type: 'level_reward_claimed', level });
    return [...def.rewards];
  }

  /**
   * 清理过期邮件
   */
  cleanExpiredMails(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, mail] of this._mailBox) {
      if (mail.expiresAt > 0 && mail.expiresAt < now) {
        this._mailBox.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  // ============================================================
  // 事件
  // ============================================================

  onEvent(listener: RewardEventListener): void {
    this.listeners.push(listener);
  }

  offEvent(listener: RewardEventListener): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  // ============================================================
  // 重置
  // ============================================================

  reset(): void {
    this._pendingRewards.length = 0;
    this._mailBox.clear();
    this.consecutiveLoginDays = 0;
    this.lastLoginDate = '';
    this.claimedLoginDays.clear();
    this.claimedLevelRewards.clear();
    this.mailIdCounter = 0;
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private emitEvent(event: RewardEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (_error) {
        // 忽略
      }
    }
  }
}
