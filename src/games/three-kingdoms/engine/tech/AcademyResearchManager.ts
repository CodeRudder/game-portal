/**
 * 科技域 — 书院研究管理器
 *
 * Sprint 3 核心集成层：
 * - 协调建筑系统（书院等级）与科技系统的交互
 * - XI-005: 书院等级 → 可研究科技上限 / 研究速度加成
 * - XI-016: 科技完成 → 建筑产出加成 / 资源产出加成 / 战斗属性加成
 * - 提供统一的科技加成回流接口
 *
 * @module engine/tech/AcademyResearchManager
 */

import type { TechTreeSystem } from './TechTreeSystem';
import type { TechResearchSystem } from './TechResearchSystem';
import type { TechLinkSystem } from './TechLinkSystem';
import type { TechEffectApplier } from './TechEffectApplier';
import {
  getMaxResearchableTechCount,
  getAcademyResearchSpeedMultiplier,
  TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL,
  TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL,
  TECH_BATTLE_STAT_BONUS_PER_LEVEL,
} from './tech-config';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 科技加成回流快照 */
export interface TechBonusSnapshot {
  /** 建筑产出加成百分比（%/级） */
  buildingProductionBonus: number;
  /** 资源产出加成百分比（%/级） */
  resourceProductionBonus: number;
  /** 战斗属性加成百分比（%/级） */
  battleStatBonus: number;
  /** 已完成科技总数 */
  completedTechCount: number;
  /** 可研究科技上限 */
  maxResearchableCount: number;
  /** 书院研究速度加成倍率 */
  academySpeedMultiplier: number;
  /** 研究队列大小 */
  queueSize: number;
}

/** 书院状态快照 */
export interface AcademyStateSnapshot {
  /** 书院等级 */
  academyLevel: number;
  /** 可研究科技上限 */
  maxTechCount: number;
  /** 研究速度倍率 */
  researchSpeedMultiplier: number;
  /** 研究队列大小 */
  queueSize: number;
  /** 当前队列使用数 */
  queueUsed: number;
}

// ─────────────────────────────────────────────
// AcademyResearchManager
// ─────────────────────────────────────────────

export class AcademyResearchManager {
  private techTree: TechTreeSystem | null = null;
  private techResearch: TechResearchSystem | null = null;
  private techLink: TechLinkSystem | null = null;
  private techEffectApplier: TechEffectApplier | null = null;
  private getAcademyLevel: () => number;

  constructor(getAcademyLevel: () => number = () => 0) {
    this.getAcademyLevel = getAcademyLevel;
  }

  // ── 依赖注入 ──

  setTechTree(tree: TechTreeSystem): void {
    this.techTree = tree;
  }

  setTechResearch(research: TechResearchSystem): void {
    this.techResearch = research;
  }

  setTechLink(link: TechLinkSystem): void {
    this.techLink = link;
  }

  setTechEffectApplier(applier: TechEffectApplier): void {
    this.techEffectApplier = applier;
  }

  // ── XI-005: 书院等级 → 科技系统影响 ──

  /**
   * 获取可研究科技上限
   * 公式：书院等级 × 2
   */
  getMaxResearchableTechCount(): number {
    return getMaxResearchableTechCount(this.getAcademyLevel());
  }

  /**
   * 获取书院研究速度加成倍率
   * 公式：1 + 书院等级 × 0.1
   */
  getAcademyResearchSpeedMultiplier(): number {
    return getAcademyResearchSpeedMultiplier(this.getAcademyLevel());
  }

  /**
   * 获取研究队列大小
   */
  getQueueSize(): number {
    return this.techResearch?.getMaxQueueSize() ?? 1;
  }

  /**
   * 获取书院状态快照
   */
  getAcademyState(): AcademyStateSnapshot {
    const level = this.getAcademyLevel();
    return {
      academyLevel: level,
      maxTechCount: this.getMaxResearchableTechCount(),
      researchSpeedMultiplier: this.getAcademyResearchSpeedMultiplier(),
      queueSize: this.getQueueSize(),
      queueUsed: this.techResearch?.getQueue().length ?? 0,
    };
  }

  // ── XI-016: 科技完成 → 加成回流 ──

  /**
   * 获取科技加成回流快照
   *
   * 科技完成后，按已完成科技数量计算回流加成：
   * - 建筑产出：+5%/级
   * - 资源产出：+3%/级
   * - 战斗属性：+2%/级
   */
  getTechBonusSnapshot(): TechBonusSnapshot {
    const completedCount = this.getCompletedTechCount();
    return {
      buildingProductionBonus: completedCount * TECH_BUILDING_PRODUCTION_BONUS_PER_LEVEL,
      resourceProductionBonus: completedCount * TECH_RESOURCE_PRODUCTION_BONUS_PER_LEVEL,
      battleStatBonus: completedCount * TECH_BATTLE_STAT_BONUS_PER_LEVEL,
      completedTechCount: completedCount,
      maxResearchableCount: this.getMaxResearchableTechCount(),
      academySpeedMultiplier: this.getAcademyResearchSpeedMultiplier(),
      queueSize: this.getQueueSize(),
    };
  }

  /**
   * 获取建筑产出加成乘数
   * @returns 乘数（如 1.05 表示 +5%）
   */
  getBuildingProductionMultiplier(): number {
    const bonus = this.getTechBonusSnapshot().buildingProductionBonus;
    return 1 + bonus / 100;
  }

  /**
   * 获取资源产出加成乘数
   * @returns 乘数（如 1.03 表示 +3%）
   */
  getResourceProductionMultiplier(): number {
    const bonus = this.getTechBonusSnapshot().resourceProductionBonus;
    return 1 + bonus / 100;
  }

  /**
   * 获取战斗属性加成乘数
   * @returns 乘数（如 1.02 表示 +2%）
   */
  getBattleStatMultiplier(): number {
    const bonus = this.getTechBonusSnapshot().battleStatBonus;
    return 1 + bonus / 100;
  }

  /**
   * 检查书院等级是否足够研究指定科技
   * @param techTier - 科技层级
   */
  canResearchAtTier(techTier: number): boolean {
    const level = this.getAcademyLevel();
    // 科技层级要求：tier ≤ 书院等级
    return techTier <= level;
  }

  // ── 内部方法 ──

  /** 获取已完成科技数量 */
  private getCompletedTechCount(): number {
    if (!this.techTree) return 0;
    return this.techTree.getAllNodeDefs().filter(
      (nd) => this.techTree!.getNodeState(nd.id)?.status === 'completed'
    ).length;
  }
}
