/**
 * 引擎层 — 结局系统 (EndingSystem)
 *
 * v20.0 天下一统(下) 核心子系统。
 * 负责结局类型管理、条件评估、结局触发与序列化。
 *
 * 评定公式（PRD §2.2）：
 *   总评分 = 战力分×0.30 + 收集分×0.25 + 声望分×0.25 + 领土分×0.20
 *   S级≥90 / A级≥75 / B级≥60 / C级<60
 *
 * @module engine/unification/EndingSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 结局等级 */
export type EndingGrade = 'S' | 'A' | 'B' | 'C';

/** 结局类型完整描述 */
export interface EndingType {
  /** 等级标识 */
  grade: EndingGrade;
  /** 结局名称 */
  name: string;
  /** 结局描述 */
  description: string;
  /** 最低评分阈值 */
  minScore: number;
}

/** 四维评分明细 */
export interface EndingScore {
  /** 战力分 (0~100) */
  powerScore: number;
  /** 收集分 (0~100) */
  collectionScore: number;
  /** 声望分 (0~100) */
  prestigeScore: number;
  /** 领土分 (0~100) */
  territoryScore: number;
  /** 加权总评分 */
  totalScore: number;
}

/** 结局评估上下文（外部注入的游戏状态） */
export interface EndingContext {
  /** 全体武将总战力 */
  totalPower: number;
  /** 战力上限参考值（用于归一化） */
  powerCap: number;
  /** 已拥有武将数 */
  heroCount: number;
  /** 武将总数（用于收集率） */
  heroTotal: number;
  /** 声望等级 */
  prestigeLevel: number;
  /** 声望等级上限（用于归一化） */
  prestigeCap: number;
  /** 已占领领土数 */
  territoryOwned: number;
  /** 领土总数 */
  territoryTotal: number;
}

/** 结局触发结果 */
export interface EndingResult {
  /** 是否成功触发 */
  triggered: boolean;
  /** 结局等级（触发后有效） */
  grade?: EndingGrade;
  /** 评分明细 */
  score?: EndingScore;
  /** 结局类型描述 */
  endingType?: EndingType;
}

/** 结局系统序列化数据 */
export interface EndingSaveData {
  /** 是否已触发统一结局 */
  unified: boolean;
  /** 最终结局等级 */
  finalGrade: EndingGrade | null;
  /** 最终评分 */
  finalScore: EndingScore | null;
  /** 结局触发时间戳（毫秒） */
  triggeredAt: number | null;
}

/** 结局系统内部状态 */
interface EndingState {
  unified: boolean;
  finalGrade: EndingGrade | null;
  finalScore: EndingScore | null;
  triggeredAt: number | null;
}

// ─────────────────────────────────────────────
// 2. 常量
// ─────────────────────────────────────────────

/** 结局类型定义表（按分数降序） */
const ENDING_TYPES: readonly EndingType[] = [
  { grade: 'S', name: '千古一帝', description: '水墨长卷+金光万丈2000ms', minScore: 90 },
  { grade: 'A', name: '雄霸天下', description: '水墨长卷+祥云1500ms', minScore: 75 },
  { grade: 'B', name: '割据一方', description: '水墨长卷1000ms', minScore: 60 },
  { grade: 'C', name: '草莽英雄', description: '简笔水墨800ms', minScore: 0 },
] as const;

/** 四维权重 */
const WEIGHTS = { power: 0.30, collection: 0.25, prestige: 0.25, territory: 0.20 } as const;

// ─────────────────────────────────────────────
// 3. EndingSystem 实现
// ─────────────────────────────────────────────

/**
 * 结局系统
 *
 * 管理 v20.0 天下一统的结局评定、触发和持久化。
 */
export class EndingSystem implements ISubsystem {
  readonly name = 'endingSystem';

  private deps!: ISystemDeps;
  private state: EndingState = this.createInitialState();

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 结局系统不依赖帧更新
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 公开 API ───────────────────────────

  /**
   * 获取所有可用结局类型
   *
   * 返回 S/A/B/C 四级结局的完整描述列表。
   */
  getEndingTypes(): EndingType[] {
    return ENDING_TYPES.map(t => ({ ...t }));
  }

  /**
   * 评估当前游戏状态的结局条件
   *
   * 根据四维公式计算加权总评分。
   *
   * @param context - 游戏状态上下文
   * @returns 四维评分明细
   */
  evaluateConditions(context?: EndingContext): EndingScore {
    const ctx = context ?? this.buildContextFromDeps();
    return this.calculateScore(ctx);
  }

  /**
   * 获取当前主结局
   *
   * 根据最新评分确定最高满足条件的结局。
   * 如果尚未统一，基于当前游戏状态实时评估。
   */
  getPrimaryEnding(): EndingType | null {
    if (this.state.unified && this.state.finalGrade) {
      return this.findEndingType(this.state.finalGrade);
    }
    // 未统一时基于当前状态实时评估
    const ctx = this.buildContextFromDeps();
    const score = this.calculateScore(ctx);
    const grade = this.determineGrade(score.totalScore);
    return this.findEndingType(grade);
  }

  /**
   * 检查是否满足统一触发条件
   *
   * 条件：所有领土被玩家占领。
   *
   * @returns 是否满足触发条件
   */
  checkTrigger(): boolean {
    const ctx = this.buildContextFromDeps();
    return ctx.territoryOwned >= ctx.territoryTotal && ctx.territoryTotal > 0;
  }

  /**
   * 触发统一结局
   *
   * 当所有领土被征服时调用，评估结局并锁定最终等级。
   *
   * @returns 结局触发结果
   */
  triggerUnification(): EndingResult {
    if (this.state.unified) {
      // 已触发过，返回缓存结果
      return {
        triggered: true,
        grade: this.state.finalGrade ?? undefined,
        score: this.state.finalScore ?? undefined,
        endingType: this.state.finalGrade ? this.findEndingType(this.state.finalGrade) ?? undefined : undefined,
      };
    }

    const ctx = this.buildContextFromDeps();
    const score = this.calculateScore(ctx);
    const grade = this.determineGrade(score.totalScore);
    const endingType = this.findEndingType(grade);

    this.state.unified = true;
    this.state.finalGrade = grade;
    this.state.finalScore = score;
    this.state.triggeredAt = Date.now();

    // 发射统一事件
    this.deps.eventBus.emit('ending:unified', {
      grade,
      score,
      endingType,
    });

    return {
      triggered: true,
      grade,
      score,
      endingType: endingType ?? undefined,
    };
  }

  /**
   * 序列化结局状态（用于存档）
   */
  serialize(): EndingSaveData {
    return {
      unified: this.state.unified,
      finalGrade: this.state.finalGrade,
      finalScore: this.state.finalScore,
      triggeredAt: this.state.triggeredAt,
    };
  }

  /**
   * 反序列化结局状态（用于读档）
   */
  deserialize(data: EndingSaveData): void {
    this.state = {
      unified: data.unified,
      finalGrade: data.finalGrade,
      finalScore: data.finalScore,
      triggeredAt: data.triggeredAt,
    };
  }

  /** 获取内部状态快照 */
  getState(): EndingSaveData {
    return this.serialize();
  }

  // ─── 内部方法 ───────────────────────────

  private createInitialState(): EndingState {
    return {
      unified: false,
      finalGrade: null,
      finalScore: null,
      triggeredAt: null,
    };
  }

  /**
   * 根据上下文计算四维评分
   */
  private calculateScore(ctx: EndingContext): EndingScore {
    const powerScore = ctx.powerCap > 0
      ? Math.min(100, Math.round((ctx.totalPower / ctx.powerCap) * 100))
      : 0;
    const collectionScore = ctx.heroTotal > 0
      ? Math.min(100, Math.round((ctx.heroCount / ctx.heroTotal) * 100))
      : 0;
    const prestigeScore = ctx.prestigeCap > 0
      ? Math.min(100, Math.round((ctx.prestigeLevel / ctx.prestigeCap) * 100))
      : 0;
    const territoryScore = ctx.territoryTotal > 0
      ? Math.min(100, Math.round((ctx.territoryOwned / ctx.territoryTotal) * 100))
      : 0;

    const totalScore = Math.round(
      powerScore * WEIGHTS.power
      + collectionScore * WEIGHTS.collection
      + prestigeScore * WEIGHTS.prestige
      + territoryScore * WEIGHTS.territory,
    );

    return { powerScore, collectionScore, prestigeScore, territoryScore, totalScore };
  }

  /**
   * 根据总评分确定结局等级
   */
  private determineGrade(totalScore: number): EndingGrade {
    if (totalScore >= 90) return 'S';
    if (totalScore >= 75) return 'A';
    if (totalScore >= 60) return 'B';
    return 'C';
  }

  /**
   * 根据等级查找结局类型
   */
  private findEndingType(grade: EndingGrade): EndingType | null {
    return ENDING_TYPES.find(t => t.grade === grade) ?? null;
  }

  /**
   * 从子系统注册表构建评估上下文
   *
   * 安全地查询各子系统状态，缺失时使用默认值。
   */
  private buildContextFromDeps(): EndingContext {
    // 默认上下文
    let ctx: EndingContext = {
      totalPower: 0,
      powerCap: 100000,
      heroCount: 0,
      heroTotal: 40,
      prestigeLevel: 1,
      prestigeCap: 30,
      territoryOwned: 0,
      territoryTotal: 15,
    };

    try {
      const registry = this.deps?.registry;
      if (!registry) return ctx;

      // 从英雄系统获取战力和收集数据
      const hero = registry.get('hero') as {
        calculateTotalPower?: () => number;
        getAllGenerals?: () => { id: string }[];
      } | null;
      if (hero) {
        if (typeof hero.calculateTotalPower === 'function') {
          ctx.totalPower = hero.calculateTotalPower();
        }
        if (typeof hero.getAllGenerals === 'function') {
          ctx.heroCount = hero.getAllGenerals().length;
        }
      }

      // 从领土系统获取领土数据
      const territory = registry.get('territory') as {
        getPlayerTerritoryCount?: () => number;
        getTotalTerritoryCount?: () => number;
      } | null;
      if (territory) {
        if (typeof territory.getPlayerTerritoryCount === 'function') {
          ctx.territoryOwned = territory.getPlayerTerritoryCount();
        }
        if (typeof territory.getTotalTerritoryCount === 'function') {
          ctx.territoryTotal = territory.getTotalTerritoryCount();
        }
      }

      // 从声望系统获取声望等级
      const prestige = registry.get('prestige') as {
        getState?: () => { level?: number };
      } | null;
      if (prestige && typeof prestige.getState === 'function') {
        const pState = prestige.getState();
        if (pState?.level !== undefined) {
          ctx.prestigeLevel = pState.level;
        }
      }
    } catch {
      // 查询失败时使用默认值
    }

    return ctx;
  }
}
