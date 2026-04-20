/**
 * 引擎层 — NPC 好感度系统
 *
 * 管理 NPC 好感度的完整生命周期：
 *   - 好感度获取（对话/赠送/任务/交易/战斗协助）
 *   - 好感度等级效果查询
 *   - 羁绊技能解锁与激活
 *   - 好感度进度可视化数据生成
 *   - 好感度时间衰减
 *   - 存档序列化/反序列化
 *
 * 功能覆盖：
 *   #17 好感度等级与效果
 *   #18 好感度获取途径
 *   #19 好感度进度可视化
 *   #20 NPC专属羁绊技能
 *
 * @module engine/npc/NPCFavorabilitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  NPCId,
  NPCData,
  AffinityLevel,
} from '../../core/npc';
import {
  getAffinityLevel,
  getAffinityProgress,
  AFFINITY_LEVEL_LABELS,
  AFFINITY_THRESHOLDS,
} from '../../core/npc';
import type {
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
// 存档版本
// ─────────────────────────────────────────────

const FAVORABILITY_SAVE_VERSION = 1;

/** 最大历史记录条数 */
const MAX_HISTORY_SIZE = 200;

// ─────────────────────────────────────────────
// NPC 好感度系统
// ─────────────────────────────────────────────

/**
 * NPC 好感度系统
 *
 * 管理 NPC 好感度的获取、效果和可视化。
 * 依赖 NPCSystem 进行 NPC 数据查询和好感度修改。
 */
export class NPCFavorabilitySystem implements ISubsystem {
  readonly name = 'npcFavorability';

  private deps!: ISystemDeps;
  private gainConfig: AffinityGainConfig = { ...DEFAULT_AFFINITY_GAIN_CONFIG };
  private changeHistory: AffinityChangeRecord[] = [];
  private bondSkillCooldowns: Map<NPCId, number> = new Map();
  private activeBondEffects: Map<NPCId, BondSkillEffect[]> = new Map();

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.changeHistory = [];
    this.bondSkillCooldowns.clear();
    this.activeBondEffects.clear();
  }

  update(dt: number): void {
    // 预留：好感度衰减处理在 tick 中执行
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
    this.activeBondEffects.clear();
    this.gainConfig = { ...DEFAULT_AFFINITY_GAIN_CONFIG };
  }

  // ─── 好感度获取途径（#18）──────────────────────

  /**
   * 通过对话增加好感度
   *
   * @param npcId - NPC ID
   * @param turn - 当前回合
   * @returns 变化后的好感度值，NPC不存在返回null
   */
  addDialogAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.dialogBase, 'dialog', '对话', turn);
  }

  /**
   * 通过赠送礼物增加好感度
   *
   * @param npcId - NPC ID
   * @param isPreferred - 是否为NPC偏好物品
   * @param baseValue - 礼物基础好感度
   * @param turn - 当前回合
   * @returns 变化后的好感度值
   */
  addGiftAffinity(npcId: NPCId, isPreferred: boolean, baseValue: number, turn: number): number | null {
    const multiplier = isPreferred
      ? this.gainConfig.giftPreferredMultiplier
      : this.gainConfig.giftNormalMultiplier;
    const delta = Math.round(baseValue * multiplier);
    const desc = isPreferred ? '赠送偏好物品' : '赠送礼物';
    return this.addAffinity(npcId, delta, 'gift', desc, turn);
  }

  /**
   * 通过完成任务增加好感度
   *
   * @param npcId - NPC ID
   * @param turn - 当前回合
   * @returns 变化后的好感度值
   */
  addQuestCompleteAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.questComplete, 'quest_complete', '完成任务', turn);
  }

  /**
   * 通过交易增加好感度
   *
   * @param npcId - NPC ID
   * @param turn - 当前回合
   * @returns 变化后的好感度值
   */
  addTradeAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.tradeBase, 'trade', '交易', turn);
  }

  /**
   * 通过战斗协助增加好感度
   *
   * @param npcId - NPC ID
   * @param turn - 当前回合
   * @returns 变化后的好感度值
   */
  addBattleAssistAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.battleAssist, 'battle_assist', '战斗协助', turn);
  }

  /**
   * 处理好感度时间衰减
   *
   * 每回合调用，对长时间未交互的NPC好感度进行衰减。
   *
   * @param npcIds - 需要处理的NPC ID列表
   * @param currentTurn - 当前回合
   */
  processDecay(npcIds: NPCId[], currentTurn: number): void {
    const npcSys = this.getNPCSystem();
    if (!npcSys) return;

    for (const npcId of npcIds) {
      const npc = npcSys.getNPCById(npcId);
      if (!npc) continue;

      // 超过10回合未交互才衰减
      if (currentTurn - npc.lastInteractedAt > 10) {
        const delta = -this.gainConfig.decayPerTurn;
        npcSys.changeAffinity(npcId, delta);
        this.recordChange(npcId, delta, 'time_decay', '好感度自然衰减', npc.affinity + delta, npc.affinity, currentTurn);
      }
    }
  }

  // ─── 好感度等级与效果（#17）──────────────────────

  /**
   * 获取好感度等级效果
   *
   * @param level - 好感度等级
   * @returns 等级效果定义
   */
  getLevelEffect(level: AffinityLevel) {
    return AFFINITY_LEVEL_EFFECTS[level];
  }

  /**
   * 获取NPC当前等级效果
   *
   * @param npcId - NPC ID
   * @returns 等级效果，NPC不存在返回null
   */
  getNPCLevelEffect(npcId: NPCId) {
    const npcSys = this.getNPCSystem();
    if (!npcSys) return null;

    const npc = npcSys.getNPCById(npcId);
    if (!npc) return null;

    const level = getAffinityLevel(npc.affinity);
    return AFFINITY_LEVEL_EFFECTS[level];
  }

  /**
   * 检查NPC是否解锁指定交互
   *
   * @param npcId - NPC ID
   * @param interaction - 交互类型
   * @returns 是否已解锁
   */
  isInteractionUnlocked(npcId: NPCId, interaction: string): boolean {
    const effect = this.getNPCLevelEffect(npcId);
    if (!effect) return false;
    return effect.unlockedInteractions.includes(interaction);
  }

  /**
   * 获取交易折扣
   *
   * @param npcId - NPC ID
   * @returns 折扣率（0-1），NPC不存在返回1.0
   */
  getTradeDiscount(npcId: NPCId): number {
    const effect = this.getNPCLevelEffect(npcId);
    return effect?.tradeDiscount ?? 1.0;
  }

  /**
   * 获取任务奖励倍率
   *
   * @param npcId - NPC ID
   * @returns 奖励倍率，NPC不存在返回1.0
   */
  getQuestRewardMultiplier(npcId: NPCId): number {
    const effect = this.getNPCLevelEffect(npcId);
    return effect?.questRewardMultiplier ?? 1.0;
  }

  // ─── 好感度进度可视化（#19）──────────────────────

  /**
   * 生成好感度可视化数据
   *
   * @param npcId - NPC ID
   * @returns 可视化数据，NPC不存在返回null
   */
  getVisualization(npcId: NPCId): AffinityVisualization | null {
    const npcSys = this.getNPCSystem();
    if (!npcSys) return null;

    const npc = npcSys.getNPCById(npcId);
    if (!npc) return null;

    const currentLevel = getAffinityLevel(npc.affinity);
    const levelEffect = AFFINITY_LEVEL_EFFECTS[currentLevel];
    const levelProgress = getAffinityProgress(npc.affinity);
    const threshold = AFFINITY_THRESHOLDS[currentLevel];

    // 计算到下一等级所需好感度
    const levels: AffinityLevel[] = ['hostile', 'neutral', 'friendly', 'trusted', 'bonded'];
    const currentIndex = levels.indexOf(currentLevel);
    const nextLevel: AffinityLevel | null = currentIndex < levels.length - 1
      ? levels[currentIndex + 1]
      : null;

    const toNextLevel = nextLevel
      ? AFFINITY_THRESHOLDS[nextLevel].min - npc.affinity
      : 0;

    // 羁绊技能
    const bondSkill = BOND_SKILLS[npc.profession];
    const bondSkillUnlocked = currentLevel === 'bonded';

    return {
      npcId,
      currentAffinity: npc.affinity,
      currentLevel,
      levelNumber: levelEffect.levelNumber,
      levelLabel: levelEffect.label,
      levelProgress: Math.round(levelProgress * 1000) / 1000,
      toNextLevel: Math.max(0, toNextLevel),
      nextLevel,
      bondSkillUnlocked,
      bondSkillName: bondSkillUnlocked ? bondSkill.name : null,
    };
  }

  /**
   * 批量获取可视化数据
   *
   * @param npcIds - NPC ID列表
   * @returns 可视化数据列表
   */
  getVisualizations(npcIds: NPCId[]): AffinityVisualization[] {
    const results: AffinityVisualization[] = [];
    for (const id of npcIds) {
      const vis = this.getVisualization(id);
      if (vis) results.push(vis);
    }
    return results;
  }

  // ─── 羁绊技能（#20）────────────────────────────

  /**
   * 获取NPC的羁绊技能定义
   *
   * @param profession - NPC职业
   * @returns 羁绊技能定义
   */
  getBondSkill(profession: string): BondSkillDef | null {
    return BOND_SKILLS[profession as keyof typeof BOND_SKILLS] ?? null;
  }

  /**
   * 激活羁绊技能
   *
   * @param npcId - NPC ID
   * @param currentTurn - 当前回合
   * @returns 激活结果（成功返回技能定义，失败返回null）
   */
  activateBondSkill(npcId: NPCId, currentTurn: number): BondSkillDef | null {
    const npcSys = this.getNPCSystem();
    if (!npcSys) return null;

    const npc = npcSys.getNPCById(npcId);
    if (!npc) return null;

    // 检查好感度等级
    const level = getAffinityLevel(npc.affinity);
    if (level !== 'bonded') return null;

    // 检查冷却
    const cooldownEnd = this.bondSkillCooldowns.get(npcId) ?? 0;
    if (currentTurn < cooldownEnd) return null;

    // 获取技能
    const skill = BOND_SKILLS[npc.profession];
    if (!skill) return null;

    // 设置冷却
    this.bondSkillCooldowns.set(npcId, currentTurn + skill.cooldownTurns);

    // 激活效果
    this.activeBondEffects.set(npcId, [...skill.effects]);

    // 发出事件
    this.deps?.eventBus.emit('npc:bond_skill_activated', {
      npcId,
      skillId: skill.id,
      skillName: skill.name,
      effects: skill.effects,
    });

    return skill;
  }

  /**
   * 获取NPC羁绊技能冷却剩余回合
   *
   * @param npcId - NPC ID
   * @param currentTurn - 当前回合
   * @returns 剩余回合数（0表示可用）
   */
  getBondSkillCooldown(npcId: NPCId, currentTurn: number): number {
    const cooldownEnd = this.bondSkillCooldowns.get(npcId) ?? 0;
    return Math.max(0, cooldownEnd - currentTurn);
  }

  /**
   * 获取所有活跃羁绊效果
   *
   * @returns NPC ID → 效果列表映射
   */
  getActiveBondEffects(): Map<NPCId, BondSkillEffect[]> {
    return new Map(this.activeBondEffects);
  }

  /**
   * 更新羁绊效果持续回合
   *
   * @param currentTurn - 当前回合
   * @returns 过期的NPC ID列表
   */
  tickBondEffects(currentTurn: number): NPCId[] {
    const expired: NPCId[] = [];
    for (const [npcId, effects] of this.activeBondEffects) {
      const remaining = effects.filter(e => {
        if (e.duration > 0) {
          e.duration--;
          return e.duration > 0;
        }
        return false;
      });

      if (remaining.length === 0) {
        expired.push(npcId);
        this.activeBondEffects.delete(npcId);
      } else {
        this.activeBondEffects.set(npcId, remaining);
      }
    }
    return expired;
  }

  // ─── 查询方法 ──────────────────────────────

  /** 获取好感度变化历史 */
  getChangeHistory(limit?: number): AffinityChangeRecord[] {
    const history = [...this.changeHistory];
    return limit ? history.slice(-limit) : history;
  }

  /** 获取指定NPC的好感度变化历史 */
  getNPCChangeHistory(npcId: NPCId, limit?: number): AffinityChangeRecord[] {
    const filtered = this.changeHistory.filter(r => r.npcId === npcId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /** 获取好感度配置 */
  getGainConfig(): AffinityGainConfig {
    return { ...this.gainConfig };
  }

  /** 更新好感度配置 */
  setGainConfig(config: Partial<AffinityGainConfig>): void {
    this.gainConfig = { ...this.gainConfig, ...config };
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): FavorabilitySaveData {
    return {
      changeHistory: this.changeHistory.slice(-MAX_HISTORY_SIZE),
      bondSkillCooldowns: Object.fromEntries(this.bondSkillCooldowns),
      version: FAVORABILITY_SAVE_VERSION,
    };
  }

  deserialize(data: FavorabilitySaveData): void {
    this.changeHistory = data.changeHistory ?? [];
    this.bondSkillCooldowns.clear();
    if (data.bondSkillCooldowns) {
      for (const [npcId, turn] of Object.entries(data.bondSkillCooldowns)) {
        this.bondSkillCooldowns.set(npcId, turn);
      }
    }
    this.activeBondEffects.clear();
  }

  // ─── 内部方法 ──────────────────────────────

  /** 通用好感度增加方法 */
  private addAffinity(
    npcId: NPCId,
    delta: number,
    source: AffinitySource,
    description: string,
    turn: number,
  ): number | null {
    const npcSys = this.getNPCSystem();
    if (!npcSys) return null;

    const npc = npcSys.getNPCById(npcId);
    if (!npc) return null;

    const previousAffinity = npc.affinity;
    const result = npcSys.changeAffinity(npcId, delta);
    if (result === null) return null;

    this.recordChange(npcId, delta, source, description, previousAffinity, result, turn);

    // 更新交互时间
    npcSys.updateLastInteracted(npcId, turn);

    return result;
  }

  /** 记录好感度变化 */
  private recordChange(
    npcId: NPCId,
    delta: number,
    source: AffinitySource,
    description: string,
    previousAffinity: number,
    newAffinity: number,
    turn: number,
  ): void {
    const record: AffinityChangeRecord = {
      npcId,
      source,
      delta,
      previousAffinity,
      newAffinity,
      description,
      turn,
    };

    this.changeHistory.push(record);

    // 保持历史记录不超过上限
    if (this.changeHistory.length > MAX_HISTORY_SIZE) {
      this.changeHistory = this.changeHistory.slice(-MAX_HISTORY_SIZE);
    }
  }

  /** 获取 NPCSystem 子系统 */
  private getNPCSystem(): import('./NPCSystem').NPCSystem | null {
    try {
      return this.deps?.registry?.get<import('./NPCSystem').NPCSystem>('npc') ?? null;
    } catch {
      return null;
    }
  }
}
