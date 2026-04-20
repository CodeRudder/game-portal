/**
 * 引擎层 — NPC 好感度系统
 *
 * 管理 NPC 好感度的完整生命周期：
 *   - 好感度等级计算与效果解锁（#17）
 *   - 好感度获取途径：对话/赠送/完成任务（#18）
 *   - 羁绊技能管理与冷却（#20）
 *   - 好感度进度可视化数据生成（#19）
 *   - 好感度变化历史记录
 *
 * 依赖：
 *   - core/npc/npc.types（NPCData, AffinityLevel）
 *   - core/npc/favorability.types（等级效果、羁绊技能）
 *   - core/npc/npc-config（getAffinityLevel, getAffinityProgress）
 *
 * @module engine/npc/NPCAffinitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  NPCId,
  NPCData,
  NPCProfession,
  AffinityLevel,
} from '../../core/npc';
import {
  getAffinityLevel,
  getAffinityProgress,
  clampAffinity,
  AFFINITY_THRESHOLDS,
} from '../../core/npc';
import type {
  AffinityLevelEffect,
  AffinitySource,
  AffinityChangeRecord,
  AffinityGainConfig,
  BondSkillDef,
  BondSkillEffect,
  AffinityVisualization,
  FavorabilityState,
  FavorabilitySaveData,
} from '../../core/npc';
import {
  AFFINITY_LEVEL_EFFECTS,
  DEFAULT_AFFINITY_GAIN_CONFIG,
  BOND_SKILLS,
} from '../../core/npc';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 好感度系统存档版本 */
const AFFINITY_SYSTEM_SAVE_VERSION = 1;

/** 最大历史记录条数 */
const MAX_HISTORY_SIZE = 200;

/** 礼物类型 */
export type GiftType = 'preferred' | 'normal' | 'rare';

/** 礼物好感度值 */
const GIFT_AFFINITY_VALUES: Record<GiftType, number> = {
  normal: 5,
  preferred: 15,
  rare: 30,
} as const;

// ─────────────────────────────────────────────
// NPC 好感度系统
// ─────────────────────────────────────────────

/**
 * NPC 好感度系统
 *
 * 管理 NPC 好感度的获取、等级计算、效果解锁和羁绊技能。
 * 通过 NPCSystem 获取 NPC 数据，本系统负责好感度逻辑。
 *
 * @example
 * ```ts
 * const affinitySys = new NPCAffinitySystem();
 * affinitySys.init(deps);
 *
 * // 对话增加好感度
 * affinitySys.gainFromDialog('npc-merchant-01', npcData, 5);
 *
 * // 赠送礼物
 * affinitySys.gainFromGift('npc-merchant-01', npcData, 'preferred');
 *
 * // 完成任务
 * affinitySys.gainFromQuest('npc-merchant-01', npcData);
 *
 * // 获取可视化数据
 * const viz = affinitySys.getVisualization('npc-merchant-01', npcData);
 * ```
 */
export class NPCAffinitySystem implements ISubsystem {
  readonly name = 'npcAffinity';

  private deps!: ISystemDeps;
  private config: AffinityGainConfig;
  private changeHistory: AffinityChangeRecord[] = [];
  private bondSkillCooldowns: Map<NPCId, number> = new Map();
  private currentTurn = 0;
  private instanceCounter = 0;

  constructor(config?: Partial<AffinityGainConfig>) {
    this.config = { ...DEFAULT_AFFINITY_GAIN_CONFIG, ...config };
  }

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 预留：好感度衰减等定时逻辑
  }

  getState(): FavorabilityState {
    return {
      changeHistory: [...this.changeHistory],
      bondSkillCooldowns: Object.fromEntries(this.bondSkillCooldowns),
    };
  }

  reset(): void {
    this.changeHistory = [];
    this.bondSkillCooldowns.clear();
    this.currentTurn = 0;
    this.instanceCounter = 0;
  }

  // ─────────────────────────────────────────
  // #17 好感度等级与效果
  // ─────────────────────────────────────────

  /**
   * 获取好感度等级效果
   *
   * @param affinity - 好感度值 (0-100)
   * @returns 等级效果定义
   */
  getLevelEffect(affinity: number): AffinityLevelEffect {
    const level = getAffinityLevel(affinity);
    return { ...AFFINITY_LEVEL_EFFECTS[level] };
  }

  /**
   * 获取指定 NPC 的等级效果
   *
   * @param npc - NPC 数据
   * @returns 等级效果定义
   */
  getNPCLevelEffect(npc: NPCData): AffinityLevelEffect {
    return this.getLevelEffect(npc.affinity);
  }

  /**
   * 获取好感度等级序号 (1-5)
   *
   * @param affinity - 好感度值
   * @returns 等级序号
   */
  getLevelNumber(affinity: number): number {
    return this.getLevelEffect(affinity).levelNumber;
  }

  /**
   * 检查交互是否已解锁
   *
   * @param affinity - 好感度值
   * @param interaction - 交互类型
   * @returns 是否已解锁
   */
  isInteractionUnlocked(affinity: number, interaction: string): boolean {
    const effect = this.getLevelEffect(affinity);
    return effect.unlockedInteractions.includes(interaction);
  }

  /**
   * 获取所有已解锁的交互
   *
   * @param affinity - 好感度值
   * @returns 已解锁交互列表
   */
  getUnlockedInteractions(affinity: number): string[] {
    const effect = this.getLevelEffect(affinity);
    return [...effect.unlockedInteractions];
  }

  /**
   * 获取交易折扣
   *
   * @param affinity - 好感度值
   * @returns 折扣率 (0-1)
   */
  getTradeDiscount(affinity: number): number {
    return this.getLevelEffect(affinity).tradeDiscount;
  }

  /**
   * 获取情报准确度
   *
   * @param affinity - 好感度值
   * @returns 准确度 (0-1)
   */
  getIntelAccuracy(affinity: number): number {
    return this.getLevelEffect(affinity).intelAccuracy;
  }

  /**
   * 获取任务奖励倍率
   *
   * @param affinity - 好感度值
   * @returns 倍率
   */
  getQuestRewardMultiplier(affinity: number): number {
    return this.getLevelEffect(affinity).questRewardMultiplier;
  }

  /**
   * 检查羁绊技能是否已解锁
   *
   * @param affinity - 好感度值
   * @returns 是否已解锁
   */
  isBondSkillUnlocked(affinity: number): boolean {
    const level = getAffinityLevel(affinity);
    return level === 'bonded';
  }

  // ─────────────────────────────────────────
  // #18 好感度获取途径
  // ─────────────────────────────────────────

  /**
   * 通过对话获取好感度
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据（用于获取当前好感度）
   * @param bonus - 额外加成（可选）
   * @returns 好感度变化记录
   */
  gainFromDialog(npcId: NPCId, npc: NPCData, bonus = 0): AffinityChangeRecord {
    const delta = this.config.dialogBase + bonus;
    return this.recordChange(npcId, npc, delta, 'dialog', '与NPC对话');
  }

  /**
   * 通过赠送礼物获取好感度
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @param giftType - 礼物类型
   * @returns 好感度变化记录
   */
  gainFromGift(npcId: NPCId, npc: NPCData, giftType: GiftType): AffinityChangeRecord {
    const baseValue = GIFT_AFFINITY_VALUES[giftType];
    const multiplier = giftType === 'preferred'
      ? this.config.giftPreferredMultiplier
      : this.config.giftNormalMultiplier;
    const delta = Math.floor(baseValue * multiplier);
    const desc = giftType === 'preferred'
      ? '赠送偏好物品'
      : giftType === 'rare'
        ? '赠送稀有物品'
        : '赠送普通物品';
    return this.recordChange(npcId, npc, delta, 'gift', desc);
  }

  /**
   * 通过完成任务获取好感度
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @param bonus - 额外加成（可选）
   * @returns 好感度变化记录
   */
  gainFromQuest(npcId: NPCId, npc: NPCData, bonus = 0): AffinityChangeRecord {
    const delta = this.config.questComplete + bonus;
    return this.recordChange(npcId, npc, delta, 'quest_complete', '完成任务');
  }

  /**
   * 通过交易获取好感度
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @returns 好感度变化记录
   */
  gainFromTrade(npcId: NPCId, npc: NPCData): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.tradeBase, 'trade', '完成交易');
  }

  /**
   * 通过战斗协助获取好感度
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @returns 好感度变化记录
   */
  gainFromBattleAssist(npcId: NPCId, npc: NPCData): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.battleAssist, 'battle_assist', '战斗协助');
  }

  /**
   * 好感度衰减（每回合调用）
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @returns 好感度变化记录（如果衰减量为0则返回null）
   */
  applyDecay(npcId: NPCId, npc: NPCData): AffinityChangeRecord | null {
    if (this.config.decayPerTurn <= 0) return null;
    const delta = -this.config.decayPerTurn;
    return this.recordChange(npcId, npc, delta, 'time_decay', '好感度自然衰减');
  }

  /**
   * 手动设置好感度（用于特殊事件效果）
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @param delta - 变化量（正负均可）
   * @param source - 来源
   * @param description - 描述
   * @returns 好感度变化记录
   */
  applyAffinityChange(
    npcId: NPCId,
    npc: NPCData,
    delta: number,
    source: AffinitySource,
    description: string,
  ): AffinityChangeRecord {
    return this.recordChange(npcId, npc, delta, source, description);
  }

  // ─────────────────────────────────────────
  // #20 羁绊技能
  // ─────────────────────────────────────────

  /**
   * 获取 NPC 职业的羁绊技能
   *
   * @param profession - NPC 职业
   * @returns 羁绊技能定义
   */
  getBondSkill(profession: NPCProfession): BondSkillDef {
    return { ...BOND_SKILLS[profession] };
  }

  /**
   * 检查羁绊技能是否可用
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @returns 是否可用
   */
  canUseBondSkill(npcId: NPCId, npc: NPCData): boolean {
    if (!this.isBondSkillUnlocked(npc.affinity)) return false;
    const cooldownEnd = this.bondSkillCooldowns.get(npcId) ?? 0;
    return this.currentTurn >= cooldownEnd;
  }

  /**
   * 使用羁绊技能
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @returns 技能效果列表，不可用时返回 null
   */
  useBondSkill(npcId: NPCId, npc: NPCData): BondSkillEffect[] | null {
    if (!this.canUseBondSkill(npcId, npc)) return null;

    const skill = BOND_SKILLS[npc.profession];
    // 设置冷却
    this.bondSkillCooldowns.set(npcId, this.currentTurn + skill.cooldownTurns);

    // 发出事件
    this.deps?.eventBus.emit('npc:bond_skill_used', {
      npcId,
      skillId: skill.id,
      skillName: skill.name,
      effects: skill.effects,
    });

    return skill.effects.map(e => ({ ...e }));
  }

  /**
   * 获取羁绊技能冷却剩余回合
   *
   * @param npcId - NPC ID
   * @returns 剩余回合数（0表示可用）
   */
  getBondSkillCooldown(npcId: NPCId): number {
    const cooldownEnd = this.bondSkillCooldowns.get(npcId) ?? 0;
    return Math.max(0, cooldownEnd - this.currentTurn);
  }

  // ─────────────────────────────────────────
  // #19 好感度进度可视化
  // ─────────────────────────────────────────

  /**
   * 生成好感度可视化数据
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @returns 可视化数据
   */
  getVisualization(npcId: NPCId, npc: NPCData): AffinityVisualization {
    const currentLevel = getAffinityLevel(npc.affinity);
    const levelEffect = AFFINITY_LEVEL_EFFECTS[currentLevel];
    const levelProgress = getAffinityProgress(npc.affinity);
    const threshold = AFFINITY_THRESHOLDS[currentLevel];
    const toNextLevel = currentLevel === 'bonded'
      ? 0
      : threshold.max + 1 - npc.affinity;

    // 下一等级
    const levelOrder: AffinityLevel[] = ['hostile', 'neutral', 'friendly', 'trusted', 'bonded'];
    const currentIndex = levelOrder.indexOf(currentLevel);
    const nextLevel = currentIndex < levelOrder.length - 1
      ? levelOrder[currentIndex + 1]
      : null;

    // 羁绊技能
    const bondSkillUnlocked = this.isBondSkillUnlocked(npc.affinity);
    const bondSkill = BOND_SKILLS[npc.profession];

    return {
      npcId,
      currentAffinity: npc.affinity,
      currentLevel,
      levelNumber: levelEffect.levelNumber,
      levelLabel: levelEffect.label,
      levelProgress,
      toNextLevel,
      nextLevel,
      bondSkillUnlocked,
      bondSkillName: bondSkillUnlocked ? bondSkill.name : null,
    };
  }

  // ─────────────────────────────────────────
  // 回合管理
  // ─────────────────────────────────────────

  /**
   * 设置当前回合数
   *
   * @param turn - 回合数
   */
  setCurrentTurn(turn: number): void {
    this.currentTurn = turn;
  }

  /**
   * 获取当前回合数
   */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  // ─────────────────────────────────────────
  // 历史记录查询
  // ─────────────────────────────────────────

  /**
   * 获取好感度变化历史
   *
   * @param npcId - NPC ID（可选，不传则返回全部）
   * @param limit - 返回条数上限
   * @returns 变化记录列表
   */
  getHistory(npcId?: NPCId, limit = 50): AffinityChangeRecord[] {
    let records = npcId
      ? this.changeHistory.filter(r => r.npcId === npcId)
      : this.changeHistory;
    return records.slice(-limit);
  }

  /**
   * 获取指定 NPC 最近一次好感度变化
   *
   * @param npcId - NPC ID
   * @returns 最近变化记录，无则 null
   */
  getLastChange(npcId: NPCId): AffinityChangeRecord | null {
    for (let i = this.changeHistory.length - 1; i >= 0; i--) {
      if (this.changeHistory[i].npcId === npcId) {
        return { ...this.changeHistory[i] };
      }
    }
    return null;
  }

  /**
   * 获取指定 NPC 的好感度变化统计
   *
   * @param npcId - NPC ID
   * @returns 各来源的总变化量
   */
  getChangeStats(npcId: NPCId): Record<AffinitySource, number> {
    const stats: Record<AffinitySource, number> = {
      dialog: 0,
      gift: 0,
      quest_complete: 0,
      trade: 0,
      battle_assist: 0,
      time_decay: 0,
    };
    for (const record of this.changeHistory) {
      if (record.npcId === npcId) {
        stats[record.source] += record.delta;
      }
    }
    return stats;
  }

  // ─────────────────────────────────────────
  // 配置访问
  // ─────────────────────────────────────────

  /** 获取当前配置 */
  getConfig(): AffinityGainConfig {
    return { ...this.config };
  }

  /** 更新配置 */
  updateConfig(partial: Partial<AffinityGainConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 导出存档数据 */
  exportSaveData(): FavorabilitySaveData {
    return {
      changeHistory: this.changeHistory.slice(-MAX_HISTORY_SIZE),
      bondSkillCooldowns: Object.fromEntries(this.bondSkillCooldowns),
      version: AFFINITY_SYSTEM_SAVE_VERSION,
    };
  }

  /** 导入存档数据 */
  importSaveData(data: FavorabilitySaveData): void {
    this.changeHistory = data.changeHistory ?? [];
    this.bondSkillCooldowns.clear();
    if (data.bondSkillCooldowns) {
      for (const [id, turn] of Object.entries(data.bondSkillCooldowns)) {
        this.bondSkillCooldowns.set(id, turn);
      }
    }
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 记录好感度变化
   *
   * @param npcId - NPC ID
   * @param npc - NPC 数据
   * @param delta - 变化量
   * @param source - 来源
   * @param description - 描述
   * @returns 变化记录
   */
  private recordChange(
    npcId: NPCId,
    npc: NPCData,
    delta: number,
    source: AffinitySource,
    description: string,
  ): AffinityChangeRecord {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    const actualDelta = newAffinity - previousAffinity;

    // 更新 NPC 数据（直接修改引用）
    npc.affinity = newAffinity;

    const record: AffinityChangeRecord = {
      npcId,
      source,
      delta: actualDelta,
      previousAffinity,
      newAffinity,
      description,
      turn: this.currentTurn,
    };

    // 记录历史
    this.changeHistory.push(record);
    if (this.changeHistory.length > MAX_HISTORY_SIZE) {
      this.changeHistory = this.changeHistory.slice(-MAX_HISTORY_SIZE);
    }

    // 检查等级变化
    const oldLevel = getAffinityLevel(previousAffinity);
    const newLevel = getAffinityLevel(newAffinity);
    if (oldLevel !== newLevel) {
      this.deps?.eventBus.emit('npc:affinity_level_changed', {
        npcId,
        oldLevel,
        newLevel,
        affinity: newAffinity,
      });
    }

    // 发出好感度变化事件
    this.deps?.eventBus.emit('npc:affinity_changed', {
      npcId,
      delta: actualDelta,
      affinity: newAffinity,
      source,
    });

    return { ...record };
  }
}
