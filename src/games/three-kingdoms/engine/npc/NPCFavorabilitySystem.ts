/**
 * 引擎层 — NPC 好感度系统
 *
 * 管理 NPC 好感度的获取、效果和可视化。
 * 功能覆盖：#17 好感度等级与效果、#18 好感度获取途径、
 *           #19 好感度进度可视化、#20 NPC专属羁绊技能
 *
 * @module engine/npc/NPCFavorabilitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { NPCId, NPCData, AffinityLevel } from '../../core/npc';
import { getAffinityLevel, getAffinityProgress, AFFINITY_LEVEL_LABELS, AFFINITY_THRESHOLDS } from '../../core/npc';
import type {
  AffinitySource, AffinityChangeRecord, AffinityGainConfig, BondSkillDef,
  BondSkillEffect, AffinityVisualization, FavorabilityState, FavorabilitySaveData,
} from '../../core/npc';
import { AFFINITY_LEVEL_EFFECTS, DEFAULT_AFFINITY_GAIN_CONFIG, BOND_SKILLS } from '../../core/npc';

const FAVORABILITY_SAVE_VERSION = 1;
const MAX_HISTORY_SIZE = 200;

// ─────────────────────────────────────────────
// NPC 好感度系统
// ─────────────────────────────────────────────

export class NPCFavorabilitySystem implements ISubsystem {
  readonly name = 'npcFavorability';
  private deps!: ISystemDeps;
  private gainConfig: AffinityGainConfig = { ...DEFAULT_AFFINITY_GAIN_CONFIG };
  private changeHistory: AffinityChangeRecord[] = [];
  private bondSkillCooldowns: Map<NPCId, number> = new Map();
  private activeBondEffects: Map<NPCId, BondSkillEffect[]> = new Map();

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; this.changeHistory = []; this.bondSkillCooldowns.clear(); this.activeBondEffects.clear(); }
  update(dt: number): void { /* 预留 */ }
  getState(): FavorabilityState { return { changeHistory: [...this.changeHistory], bondSkillCooldowns: Object.fromEntries(this.bondSkillCooldowns) }; }
  reset(): void { this.changeHistory = []; this.bondSkillCooldowns.clear(); this.activeBondEffects.clear(); }

  // ─── 好感度获取途径 (#18) ──────────────────

  addDialogAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.dialogBase, 'dialog', '与NPC对话', turn);
  }

  addGiftAffinity(npcId: NPCId, isPreferred: boolean, baseValue: number, turn: number): number | null {
    const multiplier = isPreferred ? this.gainConfig.giftPreferredMultiplier : this.gainConfig.giftNormalMultiplier;
    return this.addAffinity(npcId, Math.floor(baseValue * multiplier), 'gift', isPreferred ? '赠送偏好物品' : '赠送普通物品', turn);
  }

  addQuestCompleteAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.questComplete, 'quest_complete', '完成任务', turn);
  }

  addTradeAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.tradeBase, 'trade', '完成交易', turn);
  }

  addBattleAssistAffinity(npcId: NPCId, turn: number): number | null {
    return this.addAffinity(npcId, this.gainConfig.battleAssist, 'battle_assist', '战斗协助', turn);
  }

  processDecay(npcIds: NPCId[], currentTurn: number): void {
    if (this.gainConfig.decayPerTurn <= 0) return;
    for (const npcId of npcIds) {
      const npcSys = this.getNPCSystem();
      if (!npcSys) continue;
      const npc = npcSys.getNPCById(npcId);
      if (!npc || npc.affinity <= 0) continue;
      // 超过10回合未交互才触发衰减
      const turnsSinceLastInteract = currentTurn - (npc.lastInteractedAt ?? 0);
      if (turnsSinceLastInteract <= 10) continue;
      this.addAffinity(npcId, -this.gainConfig.decayPerTurn, 'time_decay', '好感度自然衰减', currentTurn);
    }
  }

  // ─── 好感度等级与效果 (#17) ────────────────

  getLevelEffect(level: AffinityLevel) { return { ...AFFINITY_LEVEL_EFFECTS[level] }; }

  getNPCLevelEffect(npcId: NPCId) {
    const npc = this.getNPCData(npcId);
    if (!npc) return null;
    return this.getLevelEffect(getAffinityLevel(npc.affinity));
  }

  isInteractionUnlocked(npcId: NPCId, interaction: string): boolean {
    const npc = this.getNPCData(npcId);
    if (!npc) return false;
    return AFFINITY_LEVEL_EFFECTS[getAffinityLevel(npc.affinity)].unlockedInteractions.includes(interaction);
  }

  getTradeDiscount(npcId: NPCId): number {
    const npc = this.getNPCData(npcId);
    return npc ? AFFINITY_LEVEL_EFFECTS[getAffinityLevel(npc.affinity)].tradeDiscount : 0;
  }

  getQuestRewardMultiplier(npcId: NPCId): number {
    const npc = this.getNPCData(npcId);
    return npc ? AFFINITY_LEVEL_EFFECTS[getAffinityLevel(npc.affinity)].questRewardMultiplier : 1;
  }

  // ─── 好感度进度可视化 (#19) ────────────────

  getVisualization(npcId: NPCId): AffinityVisualization | null {
    const npc = this.getNPCData(npcId);
    if (!npc) return null;
    const currentLevel = getAffinityLevel(npc.affinity);
    const levelEffect = AFFINITY_LEVEL_EFFECTS[currentLevel];
    const levelProgress = getAffinityProgress(npc.affinity);
    const threshold = AFFINITY_THRESHOLDS[currentLevel];
    const toNextLevel = currentLevel === 'bonded' ? 0 : threshold.max + 1 - npc.affinity;
    const levelOrder: AffinityLevel[] = ['hostile', 'neutral', 'friendly', 'trusted', 'bonded'];
    const currentIndex = levelOrder.indexOf(currentLevel);
    const nextLevel = currentIndex < levelOrder.length - 1 ? levelOrder[currentIndex + 1] : null;
    const bondSkillUnlocked = currentLevel === 'bonded';
    const bondSkill = BOND_SKILLS[npc.profession];
    return {
      npcId, currentAffinity: npc.affinity, currentLevel, levelNumber: levelEffect.levelNumber,
      levelLabel: levelEffect.label, levelProgress, toNextLevel, nextLevel, bondSkillUnlocked,
      bondSkillName: bondSkillUnlocked ? bondSkill.name : null,
    };
  }

  getVisualizations(npcIds: NPCId[]): AffinityVisualization[] {
    return npcIds.map(id => this.getVisualization(id)).filter((v): v is AffinityVisualization => v !== null);
  }

  // ─── NPC专属羁绊技能 (#20) ─────────────────

  getBondSkill(profession: string): BondSkillDef | null { return BOND_SKILLS[profession as keyof typeof BOND_SKILLS] ?? null; }

  activateBondSkill(npcId: NPCId, currentTurn: number): BondSkillDef | null {
    const npc = this.getNPCData(npcId);
    if (!npc || getAffinityLevel(npc.affinity) !== 'bonded') return null;
    const skill = BOND_SKILLS[npc.profession];
    if (!skill) return null;
    const cooldownEnd = this.bondSkillCooldowns.get(npcId) ?? 0;
    if (currentTurn < cooldownEnd) return null;
    this.bondSkillCooldowns.set(npcId, currentTurn + skill.cooldownTurns);
    this.activeBondEffects.set(npcId, skill.effects.map(e => ({ ...e })));
    this.deps?.eventBus.emit('npc:bondSkillActivated', { npcId, skillId: skill.id, effects: skill.effects });
    return { ...skill };
  }

  getBondSkillCooldown(npcId: NPCId, currentTurn: number): number {
    const cooldownEnd = this.bondSkillCooldowns.get(npcId) ?? 0;
    return Math.max(0, cooldownEnd - currentTurn);
  }

  getActiveBondEffects(): Map<NPCId, BondSkillEffect[]> { return new Map(this.activeBondEffects); }

  tickBondEffects(currentTurn: number): NPCId[] {
    const expired: NPCId[] = [];
    for (const [npcId, cooldownEnd] of this.bondSkillCooldowns) {
      if (currentTurn >= cooldownEnd && this.activeBondEffects.has(npcId)) {
        this.activeBondEffects.delete(npcId);
        expired.push(npcId);
      }
    }
    return expired;
  }

  // ─── 历史记录 ──────────────────────────────

  getChangeHistory(limit?: number): AffinityChangeRecord[] { return this.changeHistory.slice(-(limit ?? 50)); }
  getNPCChangeHistory(npcId: NPCId, limit?: number): AffinityChangeRecord[] { return this.changeHistory.filter(r => r.npcId === npcId).slice(-(limit ?? 50)); }

  getGainConfig(): AffinityGainConfig { return { ...this.gainConfig }; }
  setGainConfig(config: Partial<AffinityGainConfig>): void { this.gainConfig = { ...this.gainConfig, ...config }; }

  // ─── 序列化 ────────────────────────────────

  serialize(): FavorabilitySaveData {
    return {
      version: FAVORABILITY_SAVE_VERSION,
      changeHistory: this.changeHistory.slice(-MAX_HISTORY_SIZE),
      bondSkillCooldowns: Object.fromEntries(this.bondSkillCooldowns),
    };
  }

  deserialize(data: FavorabilitySaveData): void {
    // FIX-006: null/undefined输入防护 [BR-10]
    if (!data) { this.changeHistory = []; this.bondSkillCooldowns.clear(); this.activeBondEffects.clear(); return; }
    this.changeHistory = data.changeHistory ?? [];
    this.bondSkillCooldowns.clear();
    if (data.bondSkillCooldowns) {
      for (const [id, turn] of Object.entries(data.bondSkillCooldowns)) this.bondSkillCooldowns.set(id, turn);
    }
  }

  // ─── 内部方法 ──────────────────────────────

  private addAffinity(npcId: NPCId, delta: number, source: AffinitySource, description: string, turn: number): number | null {
    const npcSys = this.getNPCSystem();
    const npc = npcSys?.getNPCById(npcId);
    if (!npc || !npcSys) return null;
    const prev = npc.affinity;
    const newVal = Math.max(0, Math.min(100, prev + delta));
    const actualDelta = newVal - prev;
    // 使用 NPCSystem.setAffinity 修改原始数据（getNPCById 返回副本）
    npcSys.setAffinity(npcId, newVal);
    this.recordChange(npcId, actualDelta, prev, newVal, source, description, turn);
    return actualDelta;
  }

  private recordChange(npcId: NPCId, delta: number, prev: number, newVal: number, source: AffinitySource, description: string, turn: number): void {
    this.changeHistory.push({ npcId, source, delta, previousAffinity: prev, newAffinity: newVal, description, turn });
    if (this.changeHistory.length > MAX_HISTORY_SIZE) this.changeHistory = this.changeHistory.slice(-MAX_HISTORY_SIZE);
    const oldLevel = getAffinityLevel(prev);
    const newLevel = getAffinityLevel(newVal);
    if (oldLevel !== newLevel) this.deps?.eventBus.emit('npc:affinityLevelChanged', { npcId, oldLevel, newLevel, affinity: newVal });
    this.deps?.eventBus.emit('npc:affinityChanged', { npcId, delta, affinity: newVal, source });
  }

  private getNPCData(npcId: NPCId): NPCData | null {
    const npcSys = this.getNPCSystem();
    return npcSys?.getNPCById(npcId) ?? null;
  }

  private getNPCSystem(): import('./NPCSystem').NPCSystem | null {
    try { return this.deps?.registry?.get<import('./NPCSystem').NPCSystem>('npc') ?? null; }
    catch { return null; }
  }
}
