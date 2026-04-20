/**
 * 引擎层 — NPC 切磋/结盟/离线行为系统
 *
 * 管理 NPC 高级交互：
 *   - 切磋系统：与NPC武将切磋获得经验/道具
 *   - 结盟系统：好感度满后结盟获得永久加成
 *   - 离线行为：离线期间NPC自动交互/交易
 *   - 对话历史回看：查看历史对话
 *
 * 功能覆盖：
 *   #5 NPC切磋系统（P0）
 *   #6 NPC结盟系统（P0）
 *   #7 NPC离线行为（P1）
 *   #9 NPC对话历史回看（P1）
 *
 * @module engine/npc/NPCTrainingSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { NPCId, NPCData, NPCProfession } from '../../core/npc';
import { getAffinityLevel } from '../../core/npc';
import type { NPCSystem } from './NPCSystem';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 切磋结果 */
export type TrainingOutcome = 'win' | 'lose' | 'draw';

/** 切磋奖励 */
export interface TrainingReward {
  /** 获得经验 */
  experience: number;
  /** 获得道具列表 */
  items: Array<{ itemId: string; count: number }>;
  /** 好感度变化 */
  affinityChange: number;
}

/** 切磋结果数据 */
export interface TrainingResult {
  /** NPC 实例 ID */
  npcId: string;
  /** 结果 */
  outcome: TrainingOutcome;
  /** 奖励（胜利时有效） */
  rewards: TrainingReward | null;
  /** 提示信息 */
  message: string;
}

/** 切磋记录 */
export interface TrainingRecord {
  /** NPC 实例 ID */
  npcId: string;
  /** 结果 */
  outcome: TrainingOutcome;
  /** 获得经验 */
  experience: number;
  /** 时间戳 */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 结盟系统类型
// ─────────────────────────────────────────────

/** 结盟加成类型 */
export type AllianceBonusType = 'attack' | 'defense' | 'resource' | 'recruit' | 'tech';

/** 结盟加成 */
export interface AllianceBonus {
  /** 加成类型 */
  type: AllianceBonusType;
  /** 加成数值 */
  value: number;
  /** 描述 */
  description: string;
}

/** 结盟数据 */
export interface AllianceData {
  /** NPC 实例 ID */
  npcId: string;
  /** NPC 定义 ID */
  defId: string;
  /** 结盟时间戳 */
  alliedAt: number;
  /** 加成列表 */
  bonuses: AllianceBonus[];
}

// ─────────────────────────────────────────────
// 离线行为类型
// ─────────────────────────────────────────────

/** 离线行为类型 */
export type OfflineActionType = 'trade' | 'patrol' | 'advise' | 'gather' | 'social';

/** 单条离线行为记录 */
export interface OfflineAction {
  /** NPC 实例 ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 行为类型 */
  actionType: OfflineActionType;
  /** 描述文本 */
  description: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 好感度变化 */
  affinityChange?: number;
  /** 发生时间戳 */
  timestamp: number;
}

/** 离线行为摘要 */
export interface OfflineSummary {
  /** 离线时长（秒） */
  offlineDuration: number;
  /** 行为列表 */
  actions: OfflineAction[];
  /** 总资源变化 */
  totalResourceChanges: Record<string, number>;
  /** 总好感度变化（npcId → 变化值） */
  totalAffinityChanges: Record<string, number>;
}

// ─────────────────────────────────────────────
// 对话历史类型
// ─────────────────────────────────────────────

/** 对话历史记录 */
export interface DialogueHistoryEntry {
  /** NPC 实例 ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 对话内容摘要 */
  summary: string;
  /** 对话行数 */
  lineCount: number;
  /** 对话时间戳 */
  timestamp: number;
  /** 玩家选择（如有） */
  playerChoice?: string;
}

// ─────────────────────────────────────────────
// 存档数据
// ─────────────────────────────────────────────

/** NPC高级交互系统存档 */
export interface NPCInteractionSaveData {
  /** 存档版本 */
  version: number;
  /** 切磋记录 */
  trainingRecords: TrainingRecord[];
  /** 结盟数据 */
  alliances: Array<{
    npcId: string;
    defId: string;
    alliedAt: number;
    bonuses: AllianceBonus[];
  }>;
  /** 离线摘要 */
  offlineSummary: OfflineSummary | null;
  /** 对话历史 */
  dialogueHistory: DialogueHistoryEntry[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 存档版本号 */
const TRAINING_SAVE_VERSION = 1;

/** 切磋冷却时间（秒） */
const TRAINING_COOLDOWN = 60;

/** 结盟所需好感度 */
const ALLIANCE_REQUIRED_AFFINITY = 80;

/** 切磋经验奖励范围 */
const TRAINING_EXP_RANGE = { min: 20, max: 50 };

/** 离线行为间隔（秒） */
const OFFLINE_ACTION_INTERVAL = 300;

/** 最大离线行为条数 */
const MAX_OFFLINE_ACTIONS = 50;

/** 对话历史最大条数 */
const MAX_DIALOGUE_HISTORY = 200;

/** 对话历史裁剪后保留条数 */
const DIALOGUE_TRIM_TO = 100;

/** 切磋记录最大条数 */
const MAX_TRAINING_RECORDS = 50;

/** 对话历史序列化保留条数 */
const DIALOGUE_SERIALIZE_LIMIT = 100;

/** 各职业离线行为偏好 */
const PROFESSION_ACTION_MAP: Record<string, OfflineActionType[]> = {
  merchant: ['trade', 'gather'],
  warrior: ['patrol', 'gather'],
  strategist: ['advise', 'social'],
  artisan: ['gather', 'trade'],
  traveler: ['social', 'gather'],
};

/** 离线行为描述模板 */
const OFFLINE_DESCRIPTIONS: Record<OfflineActionType, (name: string) => string> = {
  trade: (name) => `${name}在离线期间完成了一笔交易`,
  patrol: (name) => `${name}在离线期间巡逻发现了资源点`,
  advise: (name) => `${name}在离线期间提供了战略建议`,
  gather: (name) => `${name}在离线期间收集了一些资源`,
  social: (name) => `${name}在离线期间与其他NPC进行了交流`,
};

/** 离线行为资源变化模板 */
const OFFLINE_RESOURCE_MAP: Record<OfflineActionType, () => Record<string, number>> = {
  trade: () => ({ gold: Math.floor(Math.random() * 50) + 10 }),
  patrol: () => ({}),
  advise: () => ({}),
  gather: () => ({ grain: Math.floor(Math.random() * 30) + 10 }),
  social: () => ({}),
};

/** 切磋掉落物品表 */
const TRAINING_DROP_TABLE = ['item_exp_scroll', 'item_hp_potion', 'item_gold_pouch'];

/** 切磋掉落概率 */
const TRAINING_DROP_CHANCE = 0.3;

/** 切磋结果消息 */
const TRAINING_MESSAGES: Record<TrainingOutcome, string> = {
  win: '切磋胜利！获得了经验和道具奖励',
  lose: '切磋失败，下次再来挑战吧',
  draw: '不分胜负，双方势均力敌',
};

/** 结盟加成模板（按职业） */
const ALLIANCE_BONUSES_BY_PROFESSION: Record<NPCProfession, AllianceBonus[]> = {
  merchant: [
    { type: 'resource', value: 10, description: '商人结盟：资源产出+10%' },
    { type: 'recruit', value: 5, description: '商人结盟：招募折扣+5%' },
  ],
  strategist: [
    { type: 'tech', value: 10, description: '谋士结盟：科技速度+10%' },
    { type: 'defense', value: 5, description: '谋士结盟：防御+5%' },
  ],
  warrior: [
    { type: 'attack', value: 10, description: '武将结盟：攻击+10%' },
    { type: 'defense', value: 5, description: '武将结盟：防御+5%' },
  ],
  artisan: [
    { type: 'tech', value: 8, description: '工匠结盟：锻造效率+8%' },
    { type: 'resource', value: 5, description: '工匠结盟：资源产出+5%' },
  ],
  traveler: [
    { type: 'recruit', value: 8, description: '旅人结盟：探索奖励+8%' },
    { type: 'resource', value: 5, description: '旅人结盟：资源产出+5%' },
  ],
};

// ─────────────────────────────────────────────
// NPC 切磋/结盟/离线行为系统
// ─────────────────────────────────────────────

/**
 * NPC 高级交互系统
 *
 * 整合切磋、结盟、离线行为和对话历史功能。
 *
 * @example
 * ```ts
 * const trainingSys = new NPCTrainingSystem();
 * trainingSys.init(deps);
 *
 * // 切磋
 * const result = trainingSys.training('npc-warrior-01', 10, 8);
 * if (result.outcome === 'win') {
 *   console.log(`获得 ${result.rewards!.experience} 经验`);
 * }
 *
 * // 结盟
 * const alliance = trainingSys.formAlliance('npc-01', 'def-warrior', 85);
 * if (alliance.success) {
 *   console.log('结盟成功！');
 * }
 *
 * // 离线行为
 * const summary = trainingSys.calculateOfflineActions(3600, npcs);
 * ```
 */
export class NPCTrainingSystem implements ISubsystem {
  readonly name = 'npcTraining';

  private deps!: ISystemDeps;

  /** 切磋记录 */
  private trainingRecords: TrainingRecord[] = [];

  /** 结盟数据（npcId → AllianceData） */
  private alliances: Map<string, AllianceData> = new Map();

  /** 切磋冷却（npcId → 剩余秒数） */
  private trainingCooldowns: Map<string, number> = new Map();

  /** 离线行为摘要 */
  private offlineSummary: OfflineSummary | null = null;

  /** 对话历史 */
  private dialogueHistory: DialogueHistoryEntry[] = [];

  // ─── 外部回调 ──────────────────────────────

  /** 好感度变化回调 */
  private affinityCallback?: (npcId: string, change: number, reason: string) => void;

  /** 资源变化回调 */
  private resourceCallback?: (changes: Record<string, number>) => void;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    this.updateCooldowns(dt);
  }

  getState() {
    return {
      trainingRecords: [...this.trainingRecords],
      alliances: new Map(this.alliances),
      offlineSummary: this.offlineSummary,
      dialogueHistory: [...this.dialogueHistory],
    };
  }

  reset(): void {
    this.trainingRecords = [];
    this.alliances.clear();
    this.trainingCooldowns.clear();
    this.offlineSummary = null;
    this.dialogueHistory = [];
  }

  // ─── 回调注入 ──────────────────────────────

  /** 设置好感度变化回调 */
  setAffinityCallback(cb: (npcId: string, change: number, reason: string) => void): void {
    this.affinityCallback = cb;
  }

  /** 设置资源变化回调 */
  setResourceCallback(cb: (changes: Record<string, number>) => void): void {
    this.resourceCallback = cb;
  }

  // ─── 切磋系统 ──────────────────────────────

  /**
   * 与 NPC 切磋
   *
   * 简化战斗，根据等级差和随机因素判定胜负。
   * 胜利获得经验和随机道具，失败无惩罚。
   *
   * @param npcId - NPC 实例 ID
   * @param playerLevel - 玩家等级
   * @param npcLevel - NPC 等级
   * @returns 切磋结果
   */
  training(npcId: string, playerLevel: number, npcLevel: number): TrainingResult {
    // 冷却检查
    if (this.trainingCooldowns.has(npcId)) {
      return {
        npcId,
        outcome: 'draw',
        rewards: null,
        message: '切磋冷却中，请稍后再试',
      };
    }

    // 判定胜负：等级差 + 随机因素
    const outcome = this.resolveTrainingOutcome(playerLevel, npcLevel);

    // 设置冷却
    this.trainingCooldowns.set(npcId, TRAINING_COOLDOWN);

    // 计算奖励
    const rewards = this.calculateTrainingRewards(npcId, outcome, npcLevel);

    // 记录
    this.trainingRecords.push({
      npcId,
      outcome,
      experience: rewards?.experience ?? 0,
      timestamp: Date.now(),
    });

    return { npcId, outcome, rewards, message: TRAINING_MESSAGES[outcome] };
  }

  /** 检查是否可以切磋（不在冷却中） */
  canTraining(npcId: string): boolean {
    return !this.trainingCooldowns.has(npcId);
  }

  /** 获取切磋冷却剩余时间（秒） */
  getTrainingCooldown(npcId: string): number {
    return this.trainingCooldowns.get(npcId) ?? 0;
  }

  /** 获取切磋记录 */
  getTrainingRecords(npcId?: string): TrainingRecord[] {
    if (npcId) return this.trainingRecords.filter((r) => r.npcId === npcId);
    return [...this.trainingRecords];
  }

  /** 获取与指定NPC的切磋统计 */
  getTrainingStats(npcId: string): { wins: number; losses: number; draws: number; total: number } {
    const records = this.trainingRecords.filter((r) => r.npcId === npcId);
    return {
      wins: records.filter((r) => r.outcome === 'win').length,
      losses: records.filter((r) => r.outcome === 'lose').length,
      draws: records.filter((r) => r.outcome === 'draw').length,
      total: records.length,
    };
  }

  // ─── 结盟系统 ──────────────────────────────

  /**
   * 与 NPC 结盟
   *
   * 需要好感度达到 80（知己等级）。
   * 结盟后获得永久加成。
   *
   * @param npcId - NPC 实例 ID
   * @param defId - NPC 定义 ID
   * @param currentAffinity - 当前好感度
   * @param bonuses - 结盟加成列表（可选，不传则使用职业默认加成）
   * @returns 结盟结果
   */
  formAlliance(
    npcId: string,
    defId: string,
    currentAffinity: number,
    bonuses?: AllianceBonus[],
  ): { success: boolean; reason?: string } {
    // 已结盟检查
    if (this.alliances.has(npcId)) {
      return { success: false, reason: '已经与此NPC结盟' };
    }

    // 好感度检查
    if (currentAffinity < ALLIANCE_REQUIRED_AFFINITY) {
      return {
        success: false,
        reason: `好感度不足，需要${ALLIANCE_REQUIRED_AFFINITY}点，当前${currentAffinity}点`,
      };
    }

    // 获取加成（优先使用传入的，否则根据NPC职业生成）
    const finalBonuses = bonuses ?? this.getDefaultAllianceBonuses(npcId);

    const alliance: AllianceData = {
      npcId,
      defId,
      alliedAt: Date.now(),
      bonuses: finalBonuses,
    };

    this.alliances.set(npcId, alliance);

    this.deps?.eventBus.emit('npc:allianceFormed', {
      npcId,
      defId,
      bonuses: finalBonuses,
    });

    return { success: true };
  }

  /** 检查是否已与NPC结盟 */
  isAllied(npcId: string): boolean {
    return this.alliances.has(npcId);
  }

  /** 获取与NPC的结盟数据 */
  getAlliance(npcId: string): AllianceData | undefined {
    return this.alliances.get(npcId);
  }

  /** 获取所有结盟数据 */
  getAllAlliances(): AllianceData[] {
    return Array.from(this.alliances.values());
  }

  /** 获取结盟数量 */
  getAllianceCount(): number {
    return this.alliances.size;
  }

  /** 获取所有结盟的总加成 */
  getAllAllianceBonuses(): Record<AllianceBonusType, number> {
    const totals: Record<AllianceBonusType, number> = {
      attack: 0,
      defense: 0,
      resource: 0,
      recruit: 0,
      tech: 0,
    };
    for (const alliance of this.alliances.values()) {
      for (const bonus of alliance.bonuses) {
        totals[bonus.type] += bonus.value;
      }
    }
    return totals;
  }

  /** 解除结盟 */
  breakAlliance(npcId: string): boolean {
    const removed = this.alliances.delete(npcId);
    if (removed) {
      this.deps?.eventBus.emit('npc:allianceBroken', { npcId });
    }
    return removed;
  }

  // ─── 离线行为 ──────────────────────────────

  /**
   * 计算离线行为
   *
   * 根据离线时长和 NPC 数量，生成离线行为列表。
   *
   * @param offlineDuration - 离线时长（秒）
   * @param npcs - NPC 信息列表
   * @returns 离线行为摘要
   */
  calculateOfflineActions(
    offlineDuration: number,
    npcs: Array<{ id: string; name: string; profession: string }>,
  ): OfflineSummary {
    if (npcs.length === 0 || offlineDuration <= 0) {
      this.offlineSummary = {
        offlineDuration,
        actions: [],
        totalResourceChanges: {},
        totalAffinityChanges: {},
      };
      return this.offlineSummary;
    }

    const actions: OfflineAction[] = [];
    const totalResources: Record<string, number> = {};
    const totalAffinity: Record<string, number> = {};

    // 计算行为次数
    const actionCount = Math.min(
      Math.floor(offlineDuration / OFFLINE_ACTION_INTERVAL),
      MAX_OFFLINE_ACTIONS,
    );

    for (let i = 0; i < actionCount && i < npcs.length * 3; i++) {
      const npc = npcs[i % npcs.length];
      const action = this.generateOfflineAction(npc, offlineDuration);
      actions.push(action);

      // 汇总资源
      if (action.resourceChanges) {
        for (const [res, val] of Object.entries(action.resourceChanges)) {
          totalResources[res] = (totalResources[res] ?? 0) + val;
        }
      }

      // 汇总好感度
      if (action.affinityChange) {
        totalAffinity[npc.id] = (totalAffinity[npc.id] ?? 0) + action.affinityChange;
      }
    }

    // 触发资源回调
    if (Object.keys(totalResources).length > 0) {
      this.resourceCallback?.(totalResources);
    }

    this.offlineSummary = {
      offlineDuration,
      actions,
      totalResourceChanges: totalResources,
      totalAffinityChanges: totalAffinity,
    };

    return this.offlineSummary;
  }

  /** 获取离线摘要 */
  getOfflineSummary(): OfflineSummary | null {
    return this.offlineSummary;
  }

  /** 清除离线摘要 */
  clearOfflineSummary(): void {
    this.offlineSummary = null;
  }

  // ─── 对话历史 ──────────────────────────────

  /**
   * 记录对话
   *
   * @param npcId - NPC 实例 ID
   * @param npcName - NPC 名称
   * @param summary - 对话内容摘要
   * @param lineCount - 对话行数
   * @param playerChoice - 玩家选择（可选）
   */
  recordDialogue(
    npcId: string,
    npcName: string,
    summary: string,
    lineCount: number,
    playerChoice?: string,
  ): void {
    this.dialogueHistory.push({
      npcId,
      npcName,
      summary,
      lineCount,
      timestamp: Date.now(),
      playerChoice,
    });

    // 限制历史记录数量
    if (this.dialogueHistory.length > MAX_DIALOGUE_HISTORY) {
      this.dialogueHistory = this.dialogueHistory.slice(-DIALOGUE_TRIM_TO);
    }
  }

  /** 获取对话历史 */
  getDialogueHistory(npcId?: string, limit?: number): DialogueHistoryEntry[] {
    let history = npcId
      ? this.dialogueHistory.filter((h) => h.npcId === npcId)
      : [...this.dialogueHistory];

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /** 获取最近对话 */
  getRecentDialogues(count: number = 10): DialogueHistoryEntry[] {
    return this.dialogueHistory.slice(-count);
  }

  /** 获取对话历史数量 */
  getDialogueCount(npcId?: string): number {
    if (npcId) {
      return this.dialogueHistory.filter((h) => h.npcId === npcId).length;
    }
    return this.dialogueHistory.length;
  }

  /** 清除指定NPC的对话历史 */
  clearDialogueHistory(npcId?: string): void {
    if (npcId) {
      this.dialogueHistory = this.dialogueHistory.filter((h) => h.npcId !== npcId);
    } else {
      this.dialogueHistory = [];
    }
  }

  // ─── 序列化 ────────────────────────────────

  /** 导出存档数据 */
  serialize(): NPCInteractionSaveData {
    return {
      version: TRAINING_SAVE_VERSION,
      trainingRecords: this.trainingRecords.slice(-MAX_TRAINING_RECORDS),
      alliances: Array.from(this.alliances.values()).map((a) => ({
        npcId: a.npcId,
        defId: a.defId,
        alliedAt: a.alliedAt,
        bonuses: a.bonuses,
      })),
      offlineSummary: this.offlineSummary,
      dialogueHistory: this.dialogueHistory.slice(-DIALOGUE_SERIALIZE_LIMIT),
    };
  }

  /** 导入存档数据 */
  deserialize(data: NPCInteractionSaveData): void {
    this.trainingRecords = data.trainingRecords ?? [];
    this.alliances.clear();
    for (const a of data.alliances ?? []) {
      this.alliances.set(a.npcId, {
        npcId: a.npcId,
        defId: a.defId,
        alliedAt: a.alliedAt,
        bonuses: a.bonuses,
      });
    }
    this.offlineSummary = data.offlineSummary ?? null;
    this.dialogueHistory = data.dialogueHistory ?? [];
  }

  // ─── 内部方法 ──────────────────────────────

  /** 更新切磋冷却 */
  private updateCooldowns(dt: number): void {
    for (const [npcId, cd] of this.trainingCooldowns) {
      const newCd = cd - dt;
      if (newCd <= 0) {
        this.trainingCooldowns.delete(npcId);
      } else {
        this.trainingCooldowns.set(npcId, newCd);
      }
    }
  }

  /** 判定切磋胜负 */
  private resolveTrainingOutcome(
    playerLevel: number,
    npcLevel: number,
  ): TrainingOutcome {
    const levelDiff = playerLevel - npcLevel;
    const roll = Math.random() * 100;
    const threshold = 50 + levelDiff * 5; // 每级差5%

    if (roll >= threshold + 20) {
      return 'lose';
    } else if (roll >= threshold) {
      return 'draw';
    } else {
      return 'win';
    }
  }

  /** 计算切磋奖励 */
  private calculateTrainingRewards(
    npcId: string,
    outcome: TrainingOutcome,
    npcLevel: number,
  ): TrainingReward | null {
    if (outcome === 'win') {
      const exp =
        TRAINING_EXP_RANGE.min +
        Math.floor(Math.random() * (TRAINING_EXP_RANGE.max - TRAINING_EXP_RANGE.min));
      const rewards: TrainingReward = {
        experience: exp,
        items: this.rollTrainingDrops(),
        affinityChange: 5,
      };

      // 好感度变化
      this.affinityCallback?.(npcId, 5, 'training');
      this.deps?.eventBus.emit('npc:trainingWin', { npcId, experience: exp });

      return rewards;
    }

    if (outcome === 'draw') {
      // 平局也给少量经验和好感度
      this.affinityCallback?.(npcId, 2, 'training');
      return { experience: 5, items: [], affinityChange: 2 };
    }

    // 失败无奖励
    return null;
  }

  /** 生成切磋掉落物品 */
  private rollTrainingDrops(): Array<{ itemId: string; count: number }> {
    if (Math.random() >= TRAINING_DROP_CHANCE) return [];

    const itemId = TRAINING_DROP_TABLE[Math.floor(Math.random() * TRAINING_DROP_TABLE.length)];
    return [{ itemId, count: 1 }];
  }

  /** 根据NPC职业获取默认结盟加成 */
  private getDefaultAllianceBonuses(npcId: string): AllianceBonus[] {
    // 尝试获取NPC职业
    const profession = this.getNPCProfession(npcId);
    return ALLIANCE_BONUSES_BY_PROFESSION[profession] ?? ALLIANCE_BONUSES_BY_PROFESSION.traveler;
  }

  /** 通过注册表获取NPC职业 */
  private getNPCProfession(npcId: string): NPCProfession {
    try {
      const npcSys = this.deps?.registry?.get<NPCSystem>('npc');
      const npc = npcSys?.getNPCById(npcId);
      return npc?.profession ?? 'traveler';
    } catch {
      return 'traveler';
    }
  }

  /** 生成单条离线行为 */
  private generateOfflineAction(
    npc: { id: string; name: string; profession: string },
    _offlineDuration: number,
  ): OfflineAction {
    const availableActions = PROFESSION_ACTION_MAP[npc.profession] ?? ['social'];
    const actionType = availableActions[Math.floor(Math.random() * availableActions.length)];

    return {
      npcId: npc.id,
      npcName: npc.name,
      actionType,
      description: OFFLINE_DESCRIPTIONS[actionType](npc.name),
      resourceChanges: OFFLINE_RESOURCE_MAP[actionType](),
      affinityChange: actionType === 'social' ? 1 : 0,
      timestamp: Date.now() - Math.floor(Math.random() * 3600),
    };
  }
}
