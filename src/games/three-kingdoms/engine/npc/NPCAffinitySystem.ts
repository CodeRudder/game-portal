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
 * @module engine/npc/NPCAffinitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { NPCId, NPCData, NPCProfession, AffinityLevel } from '../../core/npc';
import {
  getAffinityLevel, getAffinityProgress, clampAffinity, AFFINITY_THRESHOLDS,
} from '../../core/npc';
import type {
  AffinityLevelEffect, AffinitySource, AffinityChangeRecord, AffinityGainConfig,
  BondSkillDef, BondSkillEffect, AffinityVisualization, FavorabilityState, FavorabilitySaveData,
} from '../../core/npc';
import { AFFINITY_LEVEL_EFFECTS, DEFAULT_AFFINITY_GAIN_CONFIG, BOND_SKILLS } from '../../core/npc';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const AFFINITY_SYSTEM_SAVE_VERSION = 1;
const MAX_HISTORY_SIZE = 200;

/** 礼物类型 */
export type GiftType = 'preferred' | 'normal' | 'rare';

const GIFT_AFFINITY_VALUES: Record<GiftType, number> = { normal: 5, preferred: 15, rare: 30 };

// ─────────────────────────────────────────────
// NPC 好感度系统
// ─────────────────────────────────────────────

export class NPCAffinitySystem implements ISubsystem {
  readonly name = 'npcAffinity';

  private deps!: ISystemDeps;
  private config: AffinityGainConfig;
  private changeHistory: AffinityChangeRecord[] = [];
  private bondSkillCooldowns: Map<NPCId, number> = new Map();
  private currentTurn = 0;

  constructor(config?: Partial<AffinityGainConfig>) {
    this.config = { ...DEFAULT_AFFINITY_GAIN_CONFIG, ...config };
  }

  // ─── ISubsystem 生命周期 ────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留：好感度衰减等定时逻辑 */ }

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
  }

  // ─── #17 好感度等级与效果 ───────────────────

  getLevelEffect(affinity: number): AffinityLevelEffect {
    const level = getAffinityLevel(affinity);
    return { ...AFFINITY_LEVEL_EFFECTS[level] };
  }

  getNPCLevelEffect(npc: NPCData): AffinityLevelEffect { return this.getLevelEffect(npc.affinity); }

  getLevelNumber(affinity: number): number { return this.getLevelEffect(affinity).levelNumber; }

  isInteractionUnlocked(affinity: number, interaction: string): boolean {
    return this.getLevelEffect(affinity).unlockedInteractions.includes(interaction);
  }

  getUnlockedInteractions(affinity: number): string[] { return [...this.getLevelEffect(affinity).unlockedInteractions]; }
  getTradeDiscount(affinity: number): number { return this.getLevelEffect(affinity).tradeDiscount; }
  getIntelAccuracy(affinity: number): number { return this.getLevelEffect(affinity).intelAccuracy; }
  getQuestRewardMultiplier(affinity: number): number { return this.getLevelEffect(affinity).questRewardMultiplier; }

  isBondSkillUnlocked(affinity: number): boolean { return getAffinityLevel(affinity) === 'bonded'; }

  // ─── #18 好感度获取途径 ────────────────────

  gainFromDialog(npcId: NPCId, npc: NPCData, bonus = 0): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.dialogBase + bonus, 'dialog', '与NPC对话');
  }

  gainFromGift(npcId: NPCId, npc: NPCData, giftType: GiftType): AffinityChangeRecord {
    const baseValue = GIFT_AFFINITY_VALUES[giftType];
    const multiplier = giftType === 'preferred' ? this.config.giftPreferredMultiplier : this.config.giftNormalMultiplier;
    const delta = Math.floor(baseValue * multiplier);
    const desc = giftType === 'preferred' ? '赠送偏好物品' : giftType === 'rare' ? '赠送稀有物品' : '赠送普通物品';
    return this.recordChange(npcId, npc, delta, 'gift', desc);
  }

  gainFromQuest(npcId: NPCId, npc: NPCData, bonus = 0): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.questComplete + bonus, 'quest_complete', '完成任务');
  }

  gainFromTrade(npcId: NPCId, npc: NPCData): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.tradeBase, 'trade', '完成交易');
  }

  gainFromBattleAssist(npcId: NPCId, npc: NPCData): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.battleAssist, 'battle_assist', '战斗协助');
  }

  applyDecay(npcId: NPCId, npc: NPCData): AffinityChangeRecord | null {
    if (this.config.decayPerTurn <= 0) return null;
    return this.recordChange(npcId, npc, -this.config.decayPerTurn, 'time_decay', '好感度自然衰减');
  }

  applyAffinityChange(npcId: NPCId, npc: NPCData, delta: number, source: AffinitySource, description: string): AffinityChangeRecord {
    return this.recordChange(npcId, npc, delta, source, description);
  }

  // ─── #20 羁绊技能 ─────────────────────────

  getBondSkill(profession: NPCProfession): BondSkillDef { return { ...BOND_SKILLS[profession] }; }

  canUseBondSkill(npcId: NPCId, npc: NPCData): boolean {
    if (!this.isBondSkillUnlocked(npc.affinity)) return false;
    return this.currentTurn >= (this.bondSkillCooldowns.get(npcId) ?? 0);
  }

  useBondSkill(npcId: NPCId, npc: NPCData): BondSkillEffect[] | null {
    if (!this.canUseBondSkill(npcId, npc)) return null;
    const skill = BOND_SKILLS[npc.profession];
    this.bondSkillCooldowns.set(npcId, this.currentTurn + skill.cooldownTurns);
    this.deps?.eventBus.emit('npc:bond_skill_used', { npcId, skillId: skill.id, skillName: skill.name, effects: skill.effects });
    return skill.effects.map(e => ({ ...e }));
  }

  getBondSkillCooldown(npcId: NPCId): number {
    return Math.max(0, (this.bondSkillCooldowns.get(npcId) ?? 0) - this.currentTurn);
  }

  // ─── #19 好感度进度可视化 ──────────────────

  getVisualization(npcId: NPCId, npc: NPCData): AffinityVisualization {
    const currentLevel = getAffinityLevel(npc.affinity);
    const levelEffect = AFFINITY_LEVEL_EFFECTS[currentLevel];
    const levelProgress = getAffinityProgress(npc.affinity);
    const threshold = AFFINITY_THRESHOLDS[currentLevel];
    const toNextLevel = currentLevel === 'bonded' ? 0 : threshold.max + 1 - npc.affinity;

    const levelOrder: AffinityLevel[] = ['hostile', 'neutral', 'friendly', 'trusted', 'bonded'];
    const currentIndex = levelOrder.indexOf(currentLevel);
    const nextLevel = currentIndex < levelOrder.length - 1 ? levelOrder[currentIndex + 1] : null;

    const bondSkillUnlocked = this.isBondSkillUnlocked(npc.affinity);
    const bondSkill = BOND_SKILLS[npc.profession];

    return {
      npcId, currentAffinity: npc.affinity, currentLevel,
      levelNumber: levelEffect.levelNumber, levelLabel: levelEffect.label,
      levelProgress, toNextLevel, nextLevel, bondSkillUnlocked,
      bondSkillName: bondSkillUnlocked ? bondSkill.name : null,
    };
  }

  // ─── 回合管理 ──────────────────────────────

  setCurrentTurn(turn: number): void { this.currentTurn = turn; }
  getCurrentTurn(): number { return this.currentTurn; }

  // ─── 历史记录查询 ──────────────────────────

  getHistory(npcId?: NPCId, limit = 50): AffinityChangeRecord[] {
    const records = npcId ? this.changeHistory.filter(r => r.npcId === npcId) : this.changeHistory;
    return records.slice(-limit);
  }

  getLastChange(npcId: NPCId): AffinityChangeRecord | null {
    for (let i = this.changeHistory.length - 1; i >= 0; i--) {
      if (this.changeHistory[i].npcId === npcId) return { ...this.changeHistory[i] };
    }
    return null;
  }

  getChangeStats(npcId: NPCId): Record<AffinitySource, number> {
    const stats: Record<AffinitySource, number> = { dialog: 0, gift: 0, quest_complete: 0, trade: 0, battle_assist: 0, time_decay: 0 };
    for (const record of this.changeHistory) {
      if (record.npcId === npcId) stats[record.source] += record.delta;
    }
    return stats;
  }

  // ─── 配置访问 ──────────────────────────────

  getConfig(): AffinityGainConfig { return { ...this.config }; }
  updateConfig(partial: Partial<AffinityGainConfig>): void { this.config = { ...this.config, ...partial }; }

  // ─── 序列化 ────────────────────────────────

  exportSaveData(): FavorabilitySaveData {
    return {
      changeHistory: this.changeHistory.slice(-MAX_HISTORY_SIZE),
      bondSkillCooldowns: Object.fromEntries(this.bondSkillCooldowns),
      version: AFFINITY_SYSTEM_SAVE_VERSION,
    };
  }

  importSaveData(data: FavorabilitySaveData): void {
    this.changeHistory = data.changeHistory ?? [];
    this.bondSkillCooldowns.clear();
    if (data.bondSkillCooldowns) {
      for (const [id, turn] of Object.entries(data.bondSkillCooldowns)) {
        this.bondSkillCooldowns.set(id, turn);
      }
    }
  }

  // ─── 内部方法 ──────────────────────────────

  private recordChange(
    npcId: NPCId, npc: NPCData, delta: number, source: AffinitySource, description: string,
  ): AffinityChangeRecord {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    const actualDelta = newAffinity - previousAffinity;
    npc.affinity = newAffinity;

    const record: AffinityChangeRecord = { npcId, source, delta: actualDelta, previousAffinity, newAffinity, description, turn: this.currentTurn };
    this.changeHistory.push(record);
    if (this.changeHistory.length > MAX_HISTORY_SIZE) this.changeHistory = this.changeHistory.slice(-MAX_HISTORY_SIZE);

    const oldLevel = getAffinityLevel(previousAffinity);
    const newLevel = getAffinityLevel(newAffinity);
    if (oldLevel !== newLevel) {
      this.deps?.eventBus.emit('npc:affinity_level_changed', { npcId, oldLevel, newLevel, affinity: newAffinity });
    }
    this.deps?.eventBus.emit('npc:affinity_changed', { npcId, delta: actualDelta, affinity: newAffinity, source });
    return { ...record };
  }
}
