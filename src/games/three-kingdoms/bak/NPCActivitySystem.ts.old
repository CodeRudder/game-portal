/**
 * 三国霸业 — NPC 职业活动系统
 *
 * 为每种职业定义详细的活动循环，包括资源生产/消耗、
 * 动画状态切换和位置需求。NPC 按步骤循环执行活动，
 * 模拟真实的三国时代职业生活。
 *
 * 支持的职业循环：
 * - farmer（农民）：起床→耕种→吃饭→收割→休息
 * - soldier（士兵）：集合→巡逻→训练→换岗→巡逻
 * - merchant（商人）：开店→叫卖→交易→收摊→休息
 * - scholar（学者）：晨读→讲学→研究→休息→讨论
 * - scout（斥候）：准备→出发→侦察→返回→休息
 *
 * @module games/three-kingdoms/NPCActivitySystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 活动步骤定义 */
export interface ActivityStep {
  /** 步骤名称 */
  name: string;
  /** 持续时间（游戏分钟） */
  duration: number;
  /** 动画状态 */
  animationState: string;
  /** 生产资源（可选） */
  producesResource?: { type: string; amount: number };
  /** 消耗资源（可选） */
  consumesResource?: { type: string; amount: number };
  /** 需要到达的位置（可选） */
  requiredLocation?: { x: number; y: number };
  /** 触发对话 ID（可选） */
  dialogueTrigger?: string;
}

/** 职业循环定义 */
export interface ProfessionCycle {
  /** 职业名称 */
  profession: string;
  /** 活动步骤列表 */
  steps: ActivityStep[];
  /** 完成后是否循环 */
  loopAfterComplete: boolean;
}

/** NPC 活动运行时状态 */
interface NPCActivityState {
  /** 当前步骤索引 */
  currentStep: number;
  /** 当前步骤进度（0 ~ duration） */
  stepProgress: number;
  /** 已完成的循环次数 */
  totalCycles: number;
}

/** updateNPC 返回结果 */
export interface NPCUpdateResult {
  /** 当前活动名称 */
  activity: string;
  /** 当前步骤进度 (0~1) */
  progress: number;
  /** 生产的资源 */
  produced?: { type: string; amount: number };
  /** 消耗的资源 */
  consumed?: { type: string; amount: number };
  /** 状态是否发生变化 */
  stateChanged: boolean;
}

// ═══════════════════════════════════════════════════════════════
// NPC 职业活动系统
// ═══════════════════════════════════════════════════════════════

/**
 * NPC 职业活动系统
 *
 * 管理所有 NPC 的职业活动循环。每个 NPC 按照其职业
 * 对应的步骤序列循环执行活动，产出或消耗资源。
 */
export class NPCActivitySystem {
  /** 职业循环定义表 */
  private cycles: Map<string, ProfessionCycle> = new Map();
  /** NPC 运行时活动状态 */
  private npcStates: Map<string, NPCActivityState> = new Map();

  constructor() {
    this.initCycles();
  }

  // ─── 初始化职业循环 ─────────────────────────────────────

  /**
   * 初始化所有职业的活动循环定义
   *
   * 每个职业包含 5 个步骤，涵盖从准备到休息的完整工作周期。
   */
  initCycles(): void {
    // ── 农民：起床→耕种→吃饭→收割→休息 ──
    this.cycles.set('farmer', {
      profession: 'farmer',
      loopAfterComplete: true,
      steps: [
        {
          name: '起床准备农具',
          duration: 30,
          animationState: 'idle',
          dialogueTrigger: 'dlg_farmer_morning',
        },
        {
          name: '耕种田地',
          duration: 60,
          animationState: 'farming',
          producesResource: { type: 'grain', amount: 5 },
          requiredLocation: { x: 3, y: 8 },
        },
        {
          name: '吃午饭',
          duration: 30,
          animationState: 'eating',
          consumesResource: { type: 'grain', amount: 1 },
        },
        {
          name: '收割庄稼',
          duration: 60,
          animationState: 'farming',
          producesResource: { type: 'grain', amount: 8 },
          requiredLocation: { x: 4, y: 9 },
        },
        {
          name: '回家休息',
          duration: 30,
          animationState: 'resting',
        },
      ],
    });

    // ── 士兵：集合→巡逻A→训练→换岗→巡逻B ──
    this.cycles.set('soldier', {
      profession: 'soldier',
      loopAfterComplete: true,
      steps: [
        {
          name: '集合点名',
          duration: 15,
          animationState: 'idle',
          dialogueTrigger: 'dlg_soldier_assembly',
        },
        {
          name: '巡逻路线A — 检查城门',
          duration: 30,
          animationState: 'patrolling',
          requiredLocation: { x: 12, y: 6 },
        },
        {
          name: '操练演武',
          duration: 45,
          animationState: 'training',
          requiredLocation: { x: 10, y: 5 },
        },
        {
          name: '换岗休息',
          duration: 30,
          animationState: 'resting',
        },
        {
          name: '巡逻路线B — 检查城墙',
          duration: 30,
          animationState: 'patrolling',
          requiredLocation: { x: 8, y: 4 },
        },
      ],
    });

    // ── 商人：开店→叫卖→交易→收摊→休息 ──
    this.cycles.set('merchant', {
      profession: 'merchant',
      loopAfterComplete: true,
      steps: [
        {
          name: '开店摆摊',
          duration: 15,
          animationState: 'idle',
          dialogueTrigger: 'dlg_merchant_open',
        },
        {
          name: '叫卖等待顾客',
          duration: 45,
          animationState: 'trading',
          producesResource: { type: 'coins', amount: 10 },
          requiredLocation: { x: 8, y: 6 },
        },
        {
          name: '与顾客交易',
          duration: 30,
          animationState: 'trading',
          producesResource: { type: 'coins', amount: 15 },
        },
        {
          name: '收摊盘点',
          duration: 15,
          animationState: 'idle',
        },
        {
          name: '休息吃饭',
          duration: 30,
          animationState: 'eating',
          consumesResource: { type: 'coins', amount: 5 },
        },
      ],
    });

    // ── 学者：晨读→讲学→研究→休息→讨论 ──
    this.cycles.set('scholar', {
      profession: 'scholar',
      loopAfterComplete: true,
      steps: [
        {
          name: '晨读研习经典',
          duration: 45,
          animationState: 'studying',
          dialogueTrigger: 'dlg_scholar_morning',
        },
        {
          name: '讲学教授学生',
          duration: 30,
          animationState: 'teaching',
          producesResource: { type: 'techPoints', amount: 3 },
          requiredLocation: { x: 15, y: 10 },
        },
        {
          name: '撰写文章',
          duration: 45,
          animationState: 'researching',
          producesResource: { type: 'techPoints', amount: 5 },
        },
        {
          name: '品茶休息',
          duration: 30,
          animationState: 'resting',
        },
        {
          name: '与学者交流讨论',
          duration: 30,
          animationState: 'discussing',
          dialogueTrigger: 'dlg_scholar_discuss',
        },
      ],
    });

    // ── 斥候：准备→出发→侦察→返回→休息 ──
    this.cycles.set('scout', {
      profession: 'scout',
      loopAfterComplete: true,
      steps: [
        {
          name: '整理装备',
          duration: 15,
          animationState: 'idle',
          dialogueTrigger: 'dlg_scout_prepare',
        },
        {
          name: '前往目标区域',
          duration: 30,
          animationState: 'scouting',
        },
        {
          name: '收集情报',
          duration: 45,
          animationState: 'scouting',
          producesResource: { type: 'intel', amount: 1 },
        },
        {
          name: '返回汇报',
          duration: 30,
          animationState: 'reporting',
        },
        {
          name: '补充体力',
          duration: 30,
          animationState: 'resting',
        },
      ],
    });
  }

  // ─── 更新 NPC 活动 ─────────────────────────────────────

  /**
   * 更新指定 NPC 的活动进度
   *
   * @param npcId - NPC 唯一标识
   * @param profession - NPC 职业类型
   * @param deltaTime - 距上次更新的时间（游戏分钟）
   * @returns 活动更新结果，包含产出/消耗资源
   */
  updateNPC(npcId: string, profession: string, deltaTime: number): NPCUpdateResult {
    const cycle = this.cycles.get(profession);
    if (!cycle) {
      return { activity: '未知活动', progress: 0, stateChanged: false };
    }

    // 获取或初始化 NPC 状态
    let state = this.npcStates.get(npcId);
    if (!state) {
      state = { currentStep: 0, stepProgress: 0, totalCycles: 0 };
      this.npcStates.set(npcId, state);
    }

    const step = cycle.steps[state.currentStep];
    const oldStep = state.currentStep;

    // 推进进度
    state.stepProgress += deltaTime;

    // 检查是否完成当前步骤
    let produced: { type: string; amount: number } | undefined;
    let consumed: { type: string; amount: number } | undefined;

    if (state.stepProgress >= step.duration) {
      // 步骤完成，结算资源
      if (step.producesResource) {
        produced = { ...step.producesResource };
      }
      if (step.consumesResource) {
        consumed = { ...step.consumesResource };
      }

      // 推进到下一步
      state.stepProgress = 0;
      state.currentStep++;

      // 检查是否完成一轮循环
      if (state.currentStep >= cycle.steps.length) {
        if (cycle.loopAfterComplete) {
          state.currentStep = 0;
          state.totalCycles++;
        } else {
          state.currentStep = cycle.steps.length - 1;
          state.stepProgress = step.duration;
        }
      }
    }

    const currentStep = cycle.steps[state.currentStep];
    const stateChanged = oldStep !== state.currentStep;

    return {
      activity: currentStep.name,
      progress: Math.min(state.stepProgress / currentStep.duration, 1),
      produced,
      consumed,
      stateChanged,
    };
  }

  // ─── 查询接口 ───────────────────────────────────────────

  /**
   * 获取 NPC 当前活动描述文本
   *
   * @param npcId - NPC 唯一标识
   * @returns 活动描述字符串
   */
  getActivityDescription(npcId: string): string {
    const state = this.npcStates.get(npcId);
    if (!state) return '空闲中';

    // 遍历所有职业循环查找 NPC 所在步骤
    for (const cycle of this.cycles.values()) {
      if (state.currentStep < cycle.steps.length) {
        const step = cycle.steps[state.currentStep];
        return step.name;
      }
    }

    return '空闲中';
  }

  /**
   * 获取 NPC 当前动画状态
   *
   * @param npcId - NPC 唯一标识
   * @returns 动画状态字符串
   */
  getAnimationState(npcId: string): string {
    const state = this.npcStates.get(npcId);
    if (!state) return 'idle';

    for (const cycle of this.cycles.values()) {
      if (state.currentStep < cycle.steps.length) {
        return cycle.steps[state.currentStep].animationState;
      }
    }

    return 'idle';
  }

  /**
   * 获取指定职业的循环定义
   *
   * @param profession - 职业名称
   * @returns 职业循环定义，不存在则返回 undefined
   */
  getCycle(profession: string): ProfessionCycle | undefined {
    return this.cycles.get(profession);
  }

  /**
   * 获取所有已注册的职业类型
   */
  getProfessions(): string[] {
    return Array.from(this.cycles.keys());
  }

  /**
   * 获取指定 NPC 的运行时状态
   */
  getNPCState(npcId: string): NPCActivityState | undefined {
    return this.npcStates.get(npcId);
  }

  // ─── 序列化 ─────────────────────────────────────────────

  /**
   * 序列化活动系统状态
   */
  serialize(): object {
    const npcStatesObj: Record<string, NPCActivityState> = {};
    for (const [id, state] of this.npcStates.entries()) {
      npcStatesObj[id] = { ...state };
    }

    const cyclesObj: Record<string, ProfessionCycle> = {};
    for (const [key, cycle] of this.cycles.entries()) {
      cyclesObj[key] = { ...cycle, steps: cycle.steps.map(s => ({ ...s })) };
    }

    return { npcStates: npcStatesObj, cycles: cyclesObj };
  }

  /**
   * 反序列化恢复活动系统状态
   */
  deserialize(data: Record<string, unknown>): void {
    const npcStatesData = data.npcStates as Record<string, NPCActivityState> | undefined;
    if (npcStatesData) {
      this.npcStates.clear();
      for (const [id, state] of Object.entries(npcStatesData)) {
        this.npcStates.set(id, { ...state });
      }
    }

    const cyclesData = data.cycles as Record<string, ProfessionCycle> | undefined;
    if (cyclesData) {
      this.cycles.clear();
      for (const [key, cycle] of Object.entries(cyclesData)) {
        this.cycles.set(key, cycle);
      }
    }
  }
}
