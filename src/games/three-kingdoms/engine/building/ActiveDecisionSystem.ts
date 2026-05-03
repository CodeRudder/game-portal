/**
 * 建筑域 — 主动决策系统
 *
 * 职责：管理三大主动决策子系统
 * 1. 建筑焦点：标记1座→+15%产出→切换冷却6h
 * 2. 每日挑战：3选1任务，完成后获得奖励
 * 3. 建筑巡查：随机发现问题，3种处理方式
 *
 * @module engine/building/ActiveDecisionSystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 每日挑战 */
export interface DailyChallenge {
  /** 挑战ID */
  id: string;
  /** 挑战描述 */
  description: string;
  /** 挑战目标类型 */
  targetType: 'upgrade' | 'train' | 'research';
  /** 目标数量 */
  targetCount: number;
  /** 当前进度 */
  progress: number;
  /** 奖励 */
  reward: Record<string, number>;
  /** 是否已接受 */
  accepted: boolean;
  /** 是否已完成 */
  completed: boolean;
}

/** 巡查结果 */
export interface InspectionResult {
  /** 巡查ID */
  id: string;
  /** 建筑类型 */
  buildingType: string;
  /** 问题类型 */
  problemType: 'production_drop' | 'safety_hazard' | 'efficiency_bottleneck';
  /** 问题描述 */
  description: string;
}

/** 巡查处理结果 */
export interface ResolveResult {
  success: boolean;
  reward?: Record<string, number>;
}

/** 主动决策系统序列化数据 */
export interface ActiveDecisionSaveData {
  version: number;
  focus: {
    buildingType: string | null;
    setAt: number | null;
    cooldownEnd: number | null;
  };
  challenges: DailyChallenge[];
  inspections: Record<string, InspectionResult>;
  completedInspections: string[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 焦点加成：+15% */
const FOCUS_BONUS = 0.15;

/** 焦点切换冷却：6小时 (ms) */
const FOCUS_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** 每日挑战数量 */
const DAILY_CHALLENGE_COUNT = 3;

/** 巡查问题类型 */
const INSPECTION_PROBLEMS = [
  { type: 'production_drop' as const, description: '产出下降' },
  { type: 'safety_hazard' as const, description: '安全隐患' },
  { type: 'efficiency_bottleneck' as const, description: '效率瓶颈' },
];

/** 巡查处理方式对应的效果系数 */
const INSPECTION_EFFECTS = {
  free: { successRate: 0.5, rewardMultiplier: 1 },
  invest: { successRate: 1, rewardMultiplier: 3 },
  auto: { successRate: 1, rewardMultiplier: 1 },
};

/** 巡查基础奖励 */
const INSPECTION_BASE_REWARD: Record<string, number> = {
  gold: 1000,
  ore: 500,
  wood: 500,
};

/** 挑战模板 */
const CHALLENGE_TEMPLATES: Array<{
  targetType: 'upgrade' | 'train' | 'research';
  description: string;
  targetCount: number;
  reward: Record<string, number>;
}> = [
  {
    targetType: 'upgrade' as const,
    description: '升级任意建筑1次',
    targetCount: 1,
    reward: { grain: 5000 },
  },
  {
    targetType: 'train' as const,
    description: '完成1次训练',
    targetCount: 1,
    reward: { gold: 3000 },
  },
  {
    targetType: 'research' as const,
    description: '研究1项科技',
    targetCount: 1,
    reward: { techPoint: 100 },
  },
  {
    targetType: 'upgrade' as const,
    description: '升级任意建筑3次',
    targetCount: 3,
    reward: { gold: 8000 },
  },
  {
    targetType: 'train' as const,
    description: '完成3次训练',
    targetCount: 3,
    reward: { ore: 3000 },
  },
];

// ─────────────────────────────────────────────
// 主动决策系统类
// ─────────────────────────────────────────────

/**
 * 主动决策系统
 */
export class ActiveDecisionSystem {
  // 建筑焦点状态
  private focusBuilding: string | null = null;
  private focusSetAt: number | null = null;
  private focusCooldownEnd: number | null = null;

  // 每日挑战状态
  private challenges: DailyChallenge[] = [];

  // 建筑巡查状态
  private inspections: Record<string, InspectionResult> = {};
  private completedInspections: Set<string> = new Set();

  // 随机种子（便于测试）
  private seed: number = 42;
  private seedCounter: number = 0;

  // 可注入的当前时间
  private _now: (() => number) | null = null;

  // ─────────────────────────────────────────
  // 1. 建筑焦点
  // ─────────────────────────────────────────

  /**
   * 设置建筑焦点
   * 标记1座建筑→+15%产出→切换冷却6h
   */
  setFocus(buildingType: string): { success: boolean; reason?: string } {
    const now = this.now();

    // 检查冷却
    if (this.focusCooldownEnd && now < this.focusCooldownEnd) {
      return { success: false, reason: '焦点切换冷却中' };
    }

    this.focusBuilding = buildingType;
    this.focusSetAt = now;
    this.focusCooldownEnd = now + FOCUS_COOLDOWN_MS;

    return { success: true };
  }

  /**
   * 获取当前焦点建筑
   */
  getFocus(): string | null {
    return this.focusBuilding;
  }

  /**
   * 获取建筑焦点加成
   */
  getFocusBonus(buildingType: string): number {
    if (this.focusBuilding === buildingType) {
      return FOCUS_BONUS;
    }
    return 0;
  }

  /**
   * 获取焦点冷却剩余时间 (ms)
   */
  getFocusCooldownRemaining(): number {
    if (!this.focusCooldownEnd) return 0;
    const remaining = this.focusCooldownEnd - this.now();
    return Math.max(0, remaining);
  }

  // ─────────────────────────────────────────
  // 2. 每日挑战
  // ─────────────────────────────────────────

  /**
   * 生成每日挑战（3选1）
   */
  generateDailyChallenges(): DailyChallenge[] {
    this.challenges = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < DAILY_CHALLENGE_COUNT; i++) {
      // 使用种子随机选择模板
      let templateIndex: number;
      do {
        templateIndex = this.seededRandom() % CHALLENGE_TEMPLATES.length;
      } while (usedIndices.has(templateIndex) && usedIndices.size < CHALLENGE_TEMPLATES.length);
      usedIndices.add(templateIndex);

      const template = CHALLENGE_TEMPLATES[templateIndex];
      this.challenges.push({
        id: `challenge_${Date.now()}_${i}`,
        description: template.description,
        targetType: template.targetType,
        targetCount: template.targetCount,
        progress: 0,
        reward: { ...template.reward },
        accepted: false,
        completed: false,
      });
    }

    return [...this.challenges];
  }

  /**
   * 接受挑战
   */
  acceptChallenge(challengeId: string): boolean {
    const challenge = this.challenges.find(c => c.id === challengeId);
    if (!challenge) return false;
    if (challenge.accepted) return false;
    if (challenge.completed) return false;

    challenge.accepted = true;
    return true;
  }

  /**
   * 完成挑战
   */
  completeChallenge(challengeId: string): { success: boolean; reward: Record<string, number> } {
    const challenge = this.challenges.find(c => c.id === challengeId);
    if (!challenge) {
      return { success: false, reward: {} };
    }
    if (!challenge.accepted) {
      return { success: false, reward: {} };
    }
    if (challenge.completed) {
      return { success: false, reward: {} };
    }

    // 检查进度是否达标
    if (challenge.progress < challenge.targetCount) {
      return { success: false, reward: {} };
    }

    challenge.completed = true;
    return { success: true, reward: { ...challenge.reward } };
  }

  /**
   * 更新挑战进度
   */
  updateChallengeProgress(targetType: string, count: number = 1): void {
    for (const challenge of this.challenges) {
      if (challenge.accepted && !challenge.completed && challenge.targetType === targetType) {
        challenge.progress = Math.min(challenge.progress + count, challenge.targetCount);
      }
    }
  }

  /**
   * 获取当前每日挑战列表
   */
  getDailyChallenges(): DailyChallenge[] {
    return [...this.challenges];
  }

  // ─────────────────────────────────────────
  // 3. 建筑巡查
  // ─────────────────────────────────────────

  /**
   * 开始建筑巡查
   * 随机发现问题
   */
  startInspection(buildingType: string): InspectionResult | null {
    // 随机选择问题类型
    const problemIndex = this.seededRandom() % INSPECTION_PROBLEMS.length;
    const problem = INSPECTION_PROBLEMS[problemIndex];

    const inspection: InspectionResult = {
      id: `inspection_${Date.now()}_${this.seededRandom()}`,
      buildingType,
      problemType: problem.type,
      description: problem.description,
    };

    this.inspections[inspection.id] = inspection;
    return inspection;
  }

  /**
   * 处理巡查问题
   * @param inspectionId 巡查ID
   * @param method 处理方式：free(50%效果) / invest(3x回报) / auto(100%效果)
   */
  resolveInspection(
    inspectionId: string,
    method: 'free' | 'invest' | 'auto',
  ): ResolveResult {
    const inspection = this.inspections[inspectionId];
    if (!inspection) {
      return { success: false };
    }

    if (this.completedInspections.has(inspectionId)) {
      return { success: false };
    }

    const effect = INSPECTION_EFFECTS[method];

    // free 方式有50%几率失败
    if (method === 'free' && this.seededRandom() % 2 === 0) {
      return { success: false };
    }

    this.completedInspections.add(inspectionId);

    // 计算奖励
    const reward: Record<string, number> = {};
    for (const [resource, baseAmount] of Object.entries(INSPECTION_BASE_REWARD)) {
      reward[resource] = Math.floor(baseAmount * effect.rewardMultiplier);
    }

    return { success: true, reward };
  }

  // ─────────────────────────────────────────
  // 序列化 / 反序列化
  // ─────────────────────────────────────────

  serialize(): ActiveDecisionSaveData {
    return {
      version: 1,
      focus: {
        buildingType: this.focusBuilding,
        setAt: this.focusSetAt,
        cooldownEnd: this.focusCooldownEnd,
      },
      challenges: JSON.parse(JSON.stringify(this.challenges)),
      inspections: JSON.parse(JSON.stringify(this.inspections)),
      completedInspections: Array.from(this.completedInspections),
    };
  }

  deserialize(data: ActiveDecisionSaveData): void {
    if (!data) return;

    if (data.focus) {
      this.focusBuilding = data.focus.buildingType ?? null;
      this.focusSetAt = data.focus.setAt ?? null;
      this.focusCooldownEnd = data.focus.cooldownEnd ?? null;
    }

    if (data.challenges) {
      this.challenges = JSON.parse(JSON.stringify(data.challenges));
    }

    if (data.inspections) {
      this.inspections = JSON.parse(JSON.stringify(data.inspections));
    }

    if (data.completedInspections) {
      this.completedInspections = new Set(data.completedInspections);
    }
  }

  reset(): void {
    this.focusBuilding = null;
    this.focusSetAt = null;
    this.focusCooldownEnd = null;
    this.challenges = [];
    this.inspections = {};
    this.completedInspections = new Set();
    this.seed = 42;
    this.seedCounter = 0;
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 种子随机数生成器（确保可测试）
   */
  private seededRandom(): number {
    // 简单的线性同余生成器
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff;
    this.seedCounter++;
    return this.seed;
  }

  /**
   * 获取当前时间戳
   */
  private now(): number {
    return this._now ? this._now() : Date.now();
  }

  /**
   * 注入时间函数（测试用）
   */
  _setNow(fn: () => number): void {
    this._now = fn;
  }

  /**
   * 设置随机种子（测试用）
   */
  _setSeed(seed: number): void {
    this.seed = seed;
    this.seedCounter = 0;
  }
}
