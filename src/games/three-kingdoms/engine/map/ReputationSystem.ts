/**
 * 声望衰减系统 (R7/R8/R9/R10)
 *
 * 管理阵营声望的获取、衰减和效果:
 * - 声望数据: per-faction(魏/蜀/吴), 范围0~100
 * - 每日衰减: 00:00服务器时间, -1/阵营
 * - 豁免条件: 昨日活跃 / 当日声望事件(含快速处理) / 声望为0
 * - 声望效果: 商店折扣 / NPC好感度
 *
 * @module engine/map/ReputationSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 阵营ID */
export type FactionId = 'wei' | 'shu' | 'wu';

/** 声望等级 */
export type ReputationLevel = 'revered' | 'friendly' | 'neutral' | 'cold' | 'hostile';

/** 声望数据(per-faction) */
export type FactionReputation = Record<FactionId, number>;

/** 声望系统状态 */
export interface ReputationState {
  /** 各阵营声望 */
  reputation: FactionReputation;
  /** 声望等级 */
  levels: Record<FactionId, ReputationLevel>;
}

/** 声望系统存档数据 */
export interface ReputationSaveData {
  /** 各阵营声望 */
  reputation: FactionReputation;
  /** 最后活跃日期(YYYY-MM-DD) */
  lastActiveDate: string;
  /** 今日声望事件标记(per-faction, 位掩码) */
  factionEventToday: number;
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 声望初始值 */
const INITIAL_REPUTATION = 50;

/** 声望下限 */
const MIN_REPUTATION = 0;

/** 声望上限 */
const MAX_REPUTATION = 100;

/** 每日衰减幅度 */
const DAILY_DECAY = 1;

/** 存档版本 */
const SAVE_VERSION = 1;

/** 声望等级阈值 */
const LEVEL_THRESHOLDS: Array<{ level: ReputationLevel; min: number; max: number }> = [
  { level: 'revered', min: 80, max: 100 },
  { level: 'friendly', min: 60, max: 79 },
  { level: 'neutral', min: 40, max: 59 },
  { level: 'cold', min: 20, max: 39 },
  { level: 'hostile', min: 0, max: 19 },
];

/** 声望等级效果 */
export const REPUTATION_EFFECTS: Record<ReputationLevel, { shopDiscount: number; npcFavorBonus: number }> = {
  revered: { shopDiscount: -0.20, npcFavorBonus: 0.10 },
  friendly: { shopDiscount: -0.10, npcFavorBonus: 0.05 },
  neutral: { shopDiscount: 0, npcFavorBonus: 0 },
  cold: { shopDiscount: 0.10, npcFavorBonus: -0.05 },
  hostile: { shopDiscount: 0.20, npcFavorBonus: 0 },
};

/** 阵营位掩码 */
const FACTION_MASKS: Record<FactionId, number> = {
  wei: 0b001,
  shu: 0b010,
  wu: 0b100,
};

// ─────────────────────────────────────────────
// ReputationSystem
// ─────────────────────────────────────────────

/**
 * 声望衰减系统
 */
export class ReputationSystem implements ISubsystem {
  readonly name = 'reputation';

  private deps!: ISystemDeps;
  private reputation: FactionReputation = { wei: INITIAL_REPUTATION, shu: INITIAL_REPUTATION, wu: INITIAL_REPUTATION };
  private lastActiveDate = '';
  private factionEventToday = 0; // 位掩码

  // ── ISubsystem 接口 ──────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.reputation = { wei: INITIAL_REPUTATION, shu: INITIAL_REPUTATION, wu: INITIAL_REPUTATION };
    this.lastActiveDate = '';
    this.factionEventToday = 0;
  }

  update(_dt: number): void {
    // 事件驱动，不需要每帧更新
  }

  getState(): ReputationState {
    return {
      reputation: { ...this.reputation },
      levels: {
        wei: this.getLevel('wei'),
        shu: this.getLevel('shu'),
        wu: this.getLevel('wu'),
      },
    };
  }

  reset(): void {
    this.reputation = { wei: INITIAL_REPUTATION, shu: INITIAL_REPUTATION, wu: INITIAL_REPUTATION };
    this.lastActiveDate = '';
    this.factionEventToday = 0;
  }

  // ── 查询 ─────────────────────────────────────

  /** 获取指定阵营声望 */
  getReputation(faction: FactionId): number {
    return this.reputation[faction];
  }

  /** 获取所有阵营声望 */
  getAllReputation(): FactionReputation {
    return { ...this.reputation };
  }

  /** 获取声望等级 */
  getLevel(faction: FactionId): ReputationLevel {
    const rep = this.reputation[faction];
    for (const threshold of LEVEL_THRESHOLDS) {
      if (rep >= threshold.min && rep <= threshold.max) {
        return threshold.level;
      }
    }
    return 'neutral';
  }

  /** 获取声望效果 */
  getEffects(faction: FactionId): { shopDiscount: number; npcFavorBonus: number } {
    return REPUTATION_EFFECTS[this.getLevel(faction)];
  }

  // ── 声望变更 ─────────────────────────────────

  /**
   * 增加声望
   */
  addReputation(faction: FactionId, amount: number, source: string): void {
    const oldRep = this.reputation[faction];
    this.reputation[faction] = Math.min(MAX_REPUTATION, this.reputation[faction] + amount);
    const newRep = this.reputation[faction];

    // 标记今日有声望事件
    this.factionEventToday |= FACTION_MASKS[faction];

    this.deps?.eventBus.emit('reputation:changed', {
      faction,
      oldRep,
      newRep,
      amount,
      source,
    });
  }

  /**
   * 减少声望
   */
  reduceReputation(faction: FactionId, amount: number, source: string): void {
    const oldRep = this.reputation[faction];
    this.reputation[faction] = Math.max(MIN_REPUTATION, this.reputation[faction] - amount);
    const newRep = this.reputation[faction];

    this.deps?.eventBus.emit('reputation:changed', {
      faction,
      oldRep,
      newRep,
      amount: -amount,
      source,
    });
  }

  // ── 活跃标记 ─────────────────────────────────

  /** 标记玩家今日活跃 */
  markActive(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.lastActiveDate = today;
  }

  /** 标记今日有声望事件 */
  markFactionEvent(faction: FactionId): void {
    this.factionEventToday |= FACTION_MASKS[faction];
  }

  /** 检查今日是否有指定阵营声望事件 */
  hasFactionEventToday(faction: FactionId): boolean {
    return (this.factionEventToday & FACTION_MASKS[faction]) !== 0;
  }

  // ── 每日衰减 ─────────────────────────────────

  /**
   * 执行每日声望衰减
   *
   * 豁免条件(满足任一则不衰减):
   * 1. 昨日活跃(lastActiveDate >= yesterday)
   * 2. 当日声望事件(含快速处理, per-faction)
   * 3. 声望为0
   */
  executeDailyDecay(now: number = Date.now()): void {
    const today = new Date(now).toISOString().slice(0, 10);
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const factions: FactionId[] = ['wei', 'shu', 'wu'];
    const decayResults: Array<{ faction: FactionId; exempt: boolean; newRep: number }> = [];

    for (const faction of factions) {
      const currentRep = this.reputation[faction];

      // 条件3: 声望为0
      if (currentRep <= MIN_REPUTATION) {
        decayResults.push({ faction, exempt: true, newRep: currentRep });
        continue;
      }

      // 条件1: 昨日活跃
      if (this.lastActiveDate >= yesterday) {
        decayResults.push({ faction, exempt: true, newRep: currentRep });
        continue;
      }

      // 条件2: 当日声望事件(per-faction)
      if (this.hasFactionEventToday(faction)) {
        decayResults.push({ faction, exempt: true, newRep: currentRep });
        continue;
      }

      // 无豁免，执行衰减
      const oldRep = currentRep;
      this.reputation[faction] = Math.max(MIN_REPUTATION, currentRep - DAILY_DECAY);
      decayResults.push({ faction, exempt: false, newRep: this.reputation[faction] });

      this.deps?.eventBus.emit('reputation:decayed', {
        faction,
        oldRep,
        newRep: this.reputation[faction],
        amount: DAILY_DECAY,
      });
    }

    // 重置今日声望事件标记
    this.factionEventToday = 0;

    this.deps?.eventBus.emit('reputation:dailyDecayComplete', {
      date: today,
      results: decayResults,
    });
  }

  // ── 序列化 ───────────────────────────────────

  serialize(): ReputationSaveData {
    return {
      reputation: { ...this.reputation },
      lastActiveDate: this.lastActiveDate,
      factionEventToday: this.factionEventToday,
      version: SAVE_VERSION,
    };
  }

  deserialize(data: ReputationSaveData): void {
    if (!data) {
      this.reputation = { wei: INITIAL_REPUTATION, shu: INITIAL_REPUTATION, wu: INITIAL_REPUTATION };
      this.lastActiveDate = '';
      this.factionEventToday = 0;
      return;
    }
    this.reputation = data.reputation ?? { wei: INITIAL_REPUTATION, shu: INITIAL_REPUTATION, wu: INITIAL_REPUTATION };
    this.lastActiveDate = data.lastActiveDate ?? '';
    this.factionEventToday = data.factionEventToday ?? 0;
  }
}
