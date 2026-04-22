/**
 * 引擎层 — NPC 切磋/结盟/离线行为系统
 *
 * 管理 NPC 高级交互：
 *   - 切磋系统：与NPC武将切磋获得经验/道具
 *   - 结盟系统：好感度满后结盟获得永久加成
 *   - 离线行为：离线期间NPC自动交互/交易
 *   - 对话历史回看：查看历史对话
 *
 * @module engine/npc/NPCTrainingSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { NPCProfession } from '../../core/npc';
import type { NPCSystem } from './NPCSystem';
import type {
  TrainingOutcome,
  TrainingReward,
  TrainingResult,
  TrainingRecord,
  AllianceBonus,
  AllianceData,
  OfflineAction,
  OfflineSummary,
  OfflineActionType,
  DialogueHistoryEntry,
  NPCInteractionSaveData,
} from './NPCTrainingTypes';
import {
  TRAINING_SAVE_VERSION,
  TRAINING_COOLDOWN,
  TRAINING_EXP_RANGE,
  ALLIANCE_REQUIRED_AFFINITY,
  OFFLINE_ACTION_INTERVAL,
  MAX_OFFLINE_ACTIONS,
  MAX_DIALOGUE_HISTORY,
  DIALOGUE_TRIM_TO,
  MAX_TRAINING_RECORDS,
  DIALOGUE_SERIALIZE_LIMIT,
  PROFESSION_ACTION_MAP,
  OFFLINE_DESCRIPTIONS,
  OFFLINE_RESOURCE_MAP,
  TRAINING_DROP_TABLE,
  TRAINING_DROP_CHANCE,
  TRAINING_MESSAGES,
  ALLIANCE_BONUSES_BY_PROFESSION,
} from './NPCTrainingTypes';

// Re-export types for backward compatibility
export type {
  TrainingOutcome,
  TrainingReward,
  TrainingResult,
  TrainingRecord,
  AllianceBonusType,
  AllianceBonus,
  AllianceData,
  OfflineActionType,
  OfflineAction,
  OfflineSummary,
  DialogueHistoryEntry,
  NPCInteractionSaveData,
} from './NPCTrainingTypes';

// ─────────────────────────────────────────────
// NPC 切磋/结盟/离线行为系统
// ─────────────────────────────────────────────

/**
 * NPC 高级交互系统
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

  setAffinityCallback(cb: (npcId: string, change: number, reason: string) => void): void {
    this.affinityCallback = cb;
  }

  setResourceCallback(cb: (changes: Record<string, number>) => void): void {
    this.resourceCallback = cb;
  }

  // ─── 切磋系统 ──────────────────────────────

  training(npcId: string, playerLevel: number, npcLevel: number): TrainingResult {
    if (this.trainingCooldowns.has(npcId)) {
      return { npcId, outcome: 'draw', rewards: null, message: '切磋冷却中，请稍后再试' };
    }

    const outcome = this.resolveTrainingOutcome(playerLevel, npcLevel);
    this.trainingCooldowns.set(npcId, TRAINING_COOLDOWN);
    const rewards = this.calculateTrainingRewards(npcId, outcome, npcLevel);

    this.trainingRecords.push({
      npcId, outcome, experience: rewards?.experience ?? 0, timestamp: Date.now(),
    });

    return { npcId, outcome, rewards, message: TRAINING_MESSAGES[outcome] };
  }

  canTraining(npcId: string): boolean {
    return !this.trainingCooldowns.has(npcId);
  }

  getTrainingCooldown(npcId: string): number {
    return this.trainingCooldowns.get(npcId) ?? 0;
  }

  getTrainingRecords(npcId?: string): TrainingRecord[] {
    if (npcId) return this.trainingRecords.filter((r) => r.npcId === npcId);
    return [...this.trainingRecords];
  }

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

  formAlliance(
    npcId: string, defId: string, currentAffinity: number, bonuses?: AllianceBonus[],
  ): { success: boolean; reason?: string } {
    if (this.alliances.has(npcId)) return { success: false, reason: '已经与此NPC结盟' };
    if (currentAffinity < ALLIANCE_REQUIRED_AFFINITY) {
      return { success: false, reason: `好感度不足，需要${ALLIANCE_REQUIRED_AFFINITY}点，当前${currentAffinity}点` };
    }

    const finalBonuses = bonuses ?? this.getDefaultAllianceBonuses(npcId);
    const alliance: AllianceData = { npcId, defId, alliedAt: Date.now(), bonuses: finalBonuses };
    this.alliances.set(npcId, alliance);
    this.deps?.eventBus.emit('npc:allianceFormed', { npcId, defId, bonuses: finalBonuses });
    return { success: true };
  }

  isAllied(npcId: string): boolean { return this.alliances.has(npcId); }
  getAlliance(npcId: string): AllianceData | undefined { return this.alliances.get(npcId); }
  getAllAlliances(): AllianceData[] { return Array.from(this.alliances.values()); }
  getAllianceCount(): number { return this.alliances.size; }

  getAllAllianceBonuses(): Record<string, number> {
    const totals: Record<string, number> = { attack: 0, defense: 0, resource: 0, recruit: 0, tech: 0 };
    for (const alliance of this.alliances.values()) {
      for (const bonus of alliance.bonuses) { totals[bonus.type] += bonus.value; }
    }
    return totals;
  }

  breakAlliance(npcId: string): boolean {
    const removed = this.alliances.delete(npcId);
    if (removed) this.deps?.eventBus.emit('npc:allianceBroken', { npcId });
    return removed;
  }

  // ─── 离线行为 ──────────────────────────────

  calculateOfflineActions(
    offlineDuration: number,
    npcs: Array<{ id: string; name: string; profession: string }>,
  ): OfflineSummary {
    if (npcs.length === 0 || offlineDuration <= 0) {
      this.offlineSummary = { offlineDuration, actions: [], totalResourceChanges: {}, totalAffinityChanges: {} };
      return this.offlineSummary;
    }

    const actions: OfflineAction[] = [];
    const totalResources: Record<string, number> = {};
    const totalAffinity: Record<string, number> = {};
    const actionCount = Math.min(Math.floor(offlineDuration / OFFLINE_ACTION_INTERVAL), MAX_OFFLINE_ACTIONS);

    for (let i = 0; i < actionCount && i < npcs.length * 3; i++) {
      const npc = npcs[i % npcs.length];
      const action = this.generateOfflineAction(npc);
      actions.push(action);

      if (action.resourceChanges) {
        for (const [res, val] of Object.entries(action.resourceChanges)) {
          totalResources[res] = (totalResources[res] ?? 0) + val;
        }
      }
      if (action.affinityChange) {
        totalAffinity[npc.id] = (totalAffinity[npc.id] ?? 0) + action.affinityChange;
      }
    }

    if (Object.keys(totalResources).length > 0) this.resourceCallback?.(totalResources);

    this.offlineSummary = { offlineDuration, actions, totalResourceChanges: totalResources, totalAffinityChanges: totalAffinity };
    return this.offlineSummary;
  }

  getOfflineSummary(): OfflineSummary | null { return this.offlineSummary; }
  clearOfflineSummary(): void { this.offlineSummary = null; }

  // ─── 对话历史 ──────────────────────────────

  recordDialogue(npcId: string, npcName: string, summary: string, lineCount: number, playerChoice?: string): void {
    this.dialogueHistory.push({ npcId, npcName, summary, lineCount, timestamp: Date.now(), playerChoice });
    if (this.dialogueHistory.length > MAX_DIALOGUE_HISTORY) {
      this.dialogueHistory = this.dialogueHistory.slice(-DIALOGUE_TRIM_TO);
    }
  }

  getDialogueHistory(npcId?: string, limit?: number): DialogueHistoryEntry[] {
    let history = npcId ? this.dialogueHistory.filter((h) => h.npcId === npcId) : [...this.dialogueHistory];
    if (limit) history = history.slice(-limit);
    return history;
  }

  getRecentDialogues(count: number = 10): DialogueHistoryEntry[] { return this.dialogueHistory.slice(-count); }

  getDialogueCount(npcId?: string): number {
    return npcId ? this.dialogueHistory.filter((h) => h.npcId === npcId).length : this.dialogueHistory.length;
  }

  clearDialogueHistory(npcId?: string): void {
    this.dialogueHistory = npcId ? this.dialogueHistory.filter((h) => h.npcId !== npcId) : [];
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): NPCInteractionSaveData {
    return {
      version: TRAINING_SAVE_VERSION,
      trainingRecords: this.trainingRecords.slice(-MAX_TRAINING_RECORDS),
      alliances: Array.from(this.alliances.values()).map((a) => ({
        npcId: a.npcId, defId: a.defId, alliedAt: a.alliedAt, bonuses: a.bonuses,
      })),
      offlineSummary: this.offlineSummary,
      dialogueHistory: this.dialogueHistory.slice(-DIALOGUE_SERIALIZE_LIMIT),
    };
  }

  deserialize(data: NPCInteractionSaveData): void {
    this.trainingRecords = data.trainingRecords ?? [];
    this.alliances.clear();
    for (const a of data.alliances ?? []) {
      this.alliances.set(a.npcId, { npcId: a.npcId, defId: a.defId, alliedAt: a.alliedAt, bonuses: a.bonuses });
    }
    this.offlineSummary = data.offlineSummary ?? null;
    this.dialogueHistory = data.dialogueHistory ?? [];
  }

  // ─── 内部方法 ──────────────────────────────

  private updateCooldowns(dt: number): void {
    for (const [npcId, cd] of this.trainingCooldowns) {
      const newCd = cd - dt;
      if (newCd <= 0) this.trainingCooldowns.delete(npcId);
      else this.trainingCooldowns.set(npcId, newCd);
    }
  }

  private resolveTrainingOutcome(playerLevel: number, npcLevel: number): TrainingOutcome {
    const levelDiff = playerLevel - npcLevel;
    const roll = Math.random() * 100;
    const threshold = 50 + levelDiff * 5;
    if (roll >= threshold + 20) return 'lose';
    if (roll >= threshold) return 'draw';
    return 'win';
  }

  private calculateTrainingRewards(npcId: string, outcome: TrainingOutcome, npcLevel: number): TrainingReward | null {
    if (outcome === 'win') {
      const exp = TRAINING_EXP_RANGE.min + Math.floor(Math.random() * (TRAINING_EXP_RANGE.max - TRAINING_EXP_RANGE.min));
      const rewards: TrainingReward = { experience: exp, items: this.rollTrainingDrops(), affinityChange: 5 };
      this.affinityCallback?.(npcId, 5, 'training');
      this.deps?.eventBus.emit('npc:trainingWin', { npcId, experience: exp });
      return rewards;
    }
    if (outcome === 'draw') {
      this.affinityCallback?.(npcId, 2, 'training');
      return { experience: 5, items: [], affinityChange: 2 };
    }
    return null;
  }

  private rollTrainingDrops(): Array<{ itemId: string; count: number }> {
    if (Math.random() >= TRAINING_DROP_CHANCE) return [];
    const itemId = TRAINING_DROP_TABLE[Math.floor(Math.random() * TRAINING_DROP_TABLE.length)];
    return [{ itemId, count: 1 }];
  }

  private getDefaultAllianceBonuses(npcId: string): AllianceBonus[] {
    const profession = this.getNPCProfession(npcId);
    return ALLIANCE_BONUSES_BY_PROFESSION[profession] ?? ALLIANCE_BONUSES_BY_PROFESSION.traveler;
  }

  private getNPCProfession(npcId: string): NPCProfession {
    try {
      const npcSys = this.deps?.registry?.get<NPCSystem>('npc');
      const npc = npcSys?.getNPCById(npcId);
      return npc?.profession ?? 'traveler';
    } catch { return 'traveler'; }
  }

  private generateOfflineAction(npc: { id: string; name: string; profession: string }): OfflineAction {
    const availableActions = PROFESSION_ACTION_MAP[npc.profession] ?? ['social'];
    const actionType = availableActions[Math.floor(Math.random() * availableActions.length)] as OfflineActionType;
    return {
      npcId: npc.id, npcName: npc.name, actionType,
      description: OFFLINE_DESCRIPTIONS[actionType](npc.name),
      resourceChanges: OFFLINE_RESOURCE_MAP[actionType](),
      affinityChange: actionType === 'social' ? 1 : 0,
      timestamp: Date.now() - Math.floor(Math.random() * 3600),
    };
  }
}
