/**
 * 远征奖励系统 — 引擎层
 *
 * 职责：基础奖励计算、掉落表、首通奖励、里程碑奖励、扫荡奖励
 * 规则：
 *   - 基础奖励：粮草+铜钱+铁矿+装备碎片+经验（按难度）
 *   - 掉落：装备碎片30~80%/武将碎片5~25%/技能书2~20%
 *   - 首通：稀有武将碎片×1+元宝×50+声望+20
 *   - 里程碑：初出茅庐→百战之师→远征名将→天下布武
 *   - 扫荡：普通(×100%)/高级(×150%+保底)/免费(×50%)
 *
 * @module engine/expedition/ExpeditionRewardSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ExpeditionReward,
  DropItem,
  BattleGrade,
  RouteDifficulty,
  SweepType,
  MilestoneType,
  OfflineExpeditionResult,
} from '../../core/expedition/expedition.types';
import {
  NodeType,
  MilestoneType as MT,
} from '../../core/expedition/expedition.types';
import {
  BASE_REWARDS,
  FIRST_CLEAR_REWARD,
  DROP_RATES,
  MILESTONE_CONFIGS,
} from './expedition-config';

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 奖励计算参数 */
export interface RewardParams {
  difficulty: RouteDifficulty;
  nodeType: NodeType;
  grade: BattleGrade;
  isFirstClear: boolean;
  isRouteComplete: boolean;
}

/** 扫荡奖励参数 */
export interface SweepRewardParams {
  difficulty: RouteDifficulty;
  sweepType: SweepType;
  heroCount: number;
}

/** 掉落物品定义 */
interface DropTableEntry {
  type: DropItem['type'];
  id: string;
  name: string;
  minCount: number;
  maxCount: number;
  rate: number;
}

// ─────────────────────────────────────────────
// 掉落表定义
// ─────────────────────────────────────────────

const DROP_TABLES: Record<string, DropTableEntry[]> = {
  normal: [
    { type: 'equip_fragment', id: 'ef_001', name: '铁剑碎片', minCount: 1, maxCount: 3, rate: 0.30 },
    { type: 'hero_fragment', id: 'hf_001', name: '普通武将碎片', minCount: 1, maxCount: 1, rate: 0.05 },
    { type: 'skill_book', id: 'sb_001', name: '初级技能书', minCount: 1, maxCount: 1, rate: 0.02 },
  ],
  boss: [
    { type: 'equip_fragment', id: 'ef_002', name: '精良装备碎片', minCount: 2, maxCount: 5, rate: 0.60 },
    { type: 'hero_fragment', id: 'hf_002', name: '稀有武将碎片', minCount: 1, maxCount: 2, rate: 0.15 },
    { type: 'skill_book', id: 'sb_002', name: '中级技能书', minCount: 1, maxCount: 1, rate: 0.10 },
    { type: 'rare_material', id: 'rm_001', name: '稀有材料', minCount: 1, maxCount: 1, rate: 0.08 },
    { type: 'legendary_equip', id: 'le_001', name: '传说装备碎片', minCount: 1, maxCount: 1, rate: 0.01 },
  ],
  ambushBoss: [
    { type: 'equip_fragment', id: 'ef_003', name: '史诗装备碎片', minCount: 3, maxCount: 8, rate: 0.80 },
    { type: 'hero_fragment', id: 'hf_003', name: '史诗武将碎片', minCount: 1, maxCount: 3, rate: 0.25 },
    { type: 'skill_book', id: 'sb_003', name: '高级技能书', minCount: 1, maxCount: 2, rate: 0.20 },
    { type: 'rare_material', id: 'rm_002', name: '珍稀材料', minCount: 1, maxCount: 2, rate: 0.15 },
    { type: 'legendary_equip', id: 'le_002', name: '传说装备', minCount: 1, maxCount: 1, rate: 0.03 },
  ],
};

// ─────────────────────────────────────────────
// ExpeditionRewardSystem 类
// ─────────────────────────────────────────────

export class ExpeditionRewardSystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  readonly name = 'expeditionReward' as const;
  private deps: ISystemDeps | null = null;

  /** 随机数生成器（可注入用于测试） */
  private rng: () => number;

  constructor(rng?: () => number) {
    this.rng = rng ?? Math.random;
  }

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 奖励系统无需帧更新 */
  update(_dt: number): void {
    // 奖励系统由事件驱动，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): Record<string, unknown> {
    return { name: this.name };
  }

  /** 重置系统状态 */
  reset(): void {
    // 奖励系统无持久状态，无需重置
  }

  /**
   * 计算节点战斗奖励
   */
  calculateNodeReward(params: RewardParams): ExpeditionReward {
    const baseReward = this.getBaseReward(params.difficulty, params.nodeType);
    const gradeMultiplier = this.getGradeMultiplier(params.grade);
    const drops = this.rollDrops(params.nodeType, params.difficulty);

    const reward: ExpeditionReward = {
      grain: Math.round(baseReward.grain * gradeMultiplier),
      gold: Math.round(baseReward.gold * gradeMultiplier),
      iron: Math.round(baseReward.iron * gradeMultiplier),
      equipFragments: Math.round(baseReward.equipFragments * gradeMultiplier),
      exp: Math.round(baseReward.exp * gradeMultiplier),
      drops,
    };

    // 首通额外奖励
    if (params.isFirstClear) {
      reward.drops.push({
        type: 'hero_fragment',
        id: 'hf_first_clear',
        name: '稀有武将碎片',
        count: FIRST_CLEAR_REWARD.heroFragment,
      });
    }

    return reward;
  }

  /**
   * 计算路线完成奖励（汇总所有节点）
   */
  calculateRouteReward(
    difficulty: RouteDifficulty,
    nodeResults: Array<{ nodeType: NodeType; grade: BattleGrade }>,
    isFirstClear: boolean,
  ): ExpeditionReward {
    let totalReward = this.createEmptyReward();

    for (const result of nodeResults) {
      if (result.nodeType === NodeType.TREASURE) {
        totalReward = this.mergeRewards(totalReward, this.getTreasureReward(difficulty));
        continue;
      }
      if (result.nodeType === NodeType.REST) continue;

      const nodeReward = this.calculateNodeReward({
        difficulty,
        nodeType: result.nodeType,
        grade: result.grade,
        isFirstClear: false,
        isRouteComplete: false,
      });
      totalReward = this.mergeRewards(totalReward, nodeReward);
    }

    // 首通奖励
    if (isFirstClear) {
      totalReward.gold += FIRST_CLEAR_REWARD.gems * 10; // 元宝折算铜钱
      totalReward.drops.push({
        type: 'hero_fragment',
        id: 'hf_first_clear',
        name: '稀有武将碎片',
        count: FIRST_CLEAR_REWARD.heroFragment,
      });
    }

    return totalReward;
  }

  /**
   * 计算扫荡奖励
   */
  calculateSweepReward(params: SweepRewardParams): ExpeditionReward {
    const base = BASE_REWARDS[params.difficulty];
    const sweepMultiplier = this.getSweepMultiplier(params.sweepType);
    const guaranteedRare = params.sweepType === 'ADVANCED';

    const drops = this.rollDrops(NodeType.BOSS, params.difficulty);
    if (guaranteedRare && drops.length === 0) {
      drops.push({
        type: 'rare_material',
        id: 'rm_guaranteed',
        name: '保底稀有材料',
        count: 1,
      });
    }

    return {
      grain: Math.round(base.grain * sweepMultiplier),
      gold: Math.round(base.gold * sweepMultiplier),
      iron: Math.round(base.iron * sweepMultiplier),
      equipFragments: Math.round(base.equipFragments * sweepMultiplier),
      exp: Math.round(base.exp * sweepMultiplier),
      drops,
    };
  }

  /**
   * 获取里程碑奖励
   */
  getMilestoneReward(milestone: MilestoneType): ExpeditionReward | null {
    const config = MILESTONE_CONFIGS.find(c => c.type === milestone);
    return config?.reward ?? null;
  }

  /**
   * 计算离线远征奖励
   */
  calculateOfflineReward(
    baseReward: ExpeditionReward,
    offlineSeconds: number,
    completedRuns: number,
  ): OfflineExpeditionResult {
    const maxOfflineSeconds = 72 * 3600;
    const cappedSeconds = Math.min(offlineSeconds, maxOfflineSeconds);
    const isTimeCapped = offlineSeconds > maxOfflineSeconds;

    const efficiency = 0.85;
    const totalReward = this.scaleReward(baseReward, completedRuns * efficiency);

    return {
      offlineSeconds: cappedSeconds,
      completedRuns,
      totalReward,
      efficiency,
      isTimeCapped,
    };
  }

  // ─── 内部方法 ─────────────────────────────

  /** 获取基础奖励（按难度和节点类型） */
  private getBaseReward(difficulty: RouteDifficulty, nodeType: NodeType): ExpeditionReward {
    const base = BASE_REWARDS[difficulty];
    const nodeMultiplier = this.getNodeRewardMultiplier(nodeType);
    return {
      grain: Math.round(base.grain * nodeMultiplier),
      gold: Math.round(base.gold * nodeMultiplier),
      iron: Math.round(base.iron * nodeMultiplier),
      equipFragments: Math.max(1, Math.round(base.equipFragments * nodeMultiplier)),
      exp: Math.round(base.exp * nodeMultiplier),
      drops: [],
    };
  }

  /** 节点奖励倍率 */
  private getNodeRewardMultiplier(nodeType: NodeType): number {
    switch (nodeType) {
      case NodeType.BANDIT: return 0.3;
      case NodeType.HAZARD: return 0.5;
      case NodeType.BOSS: return 1.0;
      case NodeType.TREASURE: return 0.8;
      case NodeType.REST: return 0;
      default: return 0.3;
    }
  }

  /** 评级奖励倍率 */
  private getGradeMultiplier(grade: BattleGrade): number {
    switch (grade) {
      case 'GREAT_VICTORY': return 1.5;
      case 'MINOR_VICTORY': return 1.0;
      case 'PYRRHIC_VICTORY': return 0.7;
      case 'NARROW_DEFEAT': return 0.3;
      default: return 1.0;
    }
  }

  /** 扫荡奖励倍率 */
  private getSweepMultiplier(sweepType: SweepType): number {
    switch (sweepType) {
      case 'NORMAL': return 1.0;
      case 'ADVANCED': return 1.5;
      case 'FREE': return 0.5;
      default: return 1.0;
    }
  }

  /** 掉落判定 */
  private rollDrops(nodeType: NodeType, difficulty: RouteDifficulty): DropItem[] {
    const drops: DropItem[] = [];
    let tableName: string;

    if (nodeType === NodeType.BOSS && difficulty === 'AMBUSH') {
      tableName = 'ambushBoss';
    } else if (nodeType === NodeType.BOSS) {
      tableName = 'boss';
    } else {
      tableName = 'normal';
    }

    const table = DROP_TABLES[tableName] ?? DROP_TABLES.normal;
    for (const entry of table) {
      if (this.rng() < entry.rate) {
        const count = entry.minCount + Math.floor(this.rng() * (entry.maxCount - entry.minCount + 1));
        drops.push({
          type: entry.type,
          id: entry.id,
          name: entry.name,
          count,
        });
      }
    }

    return drops;
  }

  /** 宝箱奖励 */
  private getTreasureReward(difficulty: RouteDifficulty): ExpeditionReward {
    const base = BASE_REWARDS[difficulty];
    return {
      grain: Math.round(base.grain * 0.5),
      gold: Math.round(base.gold * 0.8),
      iron: Math.round(base.iron * 0.3),
      equipFragments: Math.round(base.equipFragments * 2),
      exp: Math.round(base.exp * 0.3),
      drops: [],
    };
  }

  /** 创建空奖励 */
  private createEmptyReward(): ExpeditionReward {
    return { grain: 0, gold: 0, iron: 0, equipFragments: 0, exp: 0, drops: [] };
  }

  /** 合并奖励 */
  private mergeRewards(a: ExpeditionReward, b: ExpeditionReward): ExpeditionReward {
    return {
      grain: a.grain + b.grain,
      gold: a.gold + b.gold,
      iron: a.iron + b.iron,
      equipFragments: a.equipFragments + b.equipFragments,
      exp: a.exp + b.exp,
      drops: [...a.drops, ...b.drops],
    };
  }

  /** 缩放奖励 */
  private scaleReward(reward: ExpeditionReward, multiplier: number): ExpeditionReward {
    return {
      grain: Math.round(reward.grain * multiplier),
      gold: Math.round(reward.gold * multiplier),
      iron: Math.round(reward.iron * multiplier),
      equipFragments: Math.round(reward.equipFragments * multiplier),
      exp: Math.round(reward.exp * multiplier),
      drops: reward.drops.map(d => ({ ...d, count: Math.round(d.count * multiplier) })),
    };
  }
}
