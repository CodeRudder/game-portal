/**
 * 三国霸业 — NPC 需求驱动行为系统
 *
 * 让 NPC 根据自身状态（饥饿/疲劳/士气/社交）自主选择活动，
 * 取代固定脚本循环，赋予 NPC 自主决策能力。
 *
 * 核心机制：
 * - 需求随时间衰减（不同职业衰减速率不同）
 * - 决策引擎根据需求优先级选择最优动作
 * - 动作执行后产生需求变化反馈
 * - 支持中断判断，紧急需求可打断当前活动
 *
 * @module games/three-kingdoms/NPCNeedSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** NPC 需求状态 */
export interface NPCNeeds {
  /** 饥饿值 0-100，0=饱，100=饿死 */
  hunger: number;
  /** 疲劳值 0-100，0=精力充沛，100=精疲力竭 */
  fatigue: number;
  /** 士气值 0-100 */
  morale: number;
  /** 社交需求 0-100，0=满足，100=极度渴望社交 */
  social: number;
}

/** 需求驱动的动作类型 */
export type NeedAction =
  | 'work'      // 工作（消耗精力，降低士气）
  | 'eat'       // 吃饭（降低饥饿）
  | 'rest'      // 休息（降低疲劳）
  | 'socialize' // 社交（提高士气和社交满足）
  | 'patrol'    // 巡逻（消耗精力，提高士气）
  | 'trade'     // 交易（消耗精力，满足社交）
  | 'study'     // 学习（消耗精力，降低疲劳感）
  | 'scout';    // 侦察（消耗精力，提高士气）

/** 需求决策结果 */
export interface NeedDecision {
  /** 选择的动作 */
  action: NeedAction;
  /** 决策原因描述（用于 UI 显示） */
  reason: string;
  /** 紧急程度 0-1 */
  urgency: number;
  /** 目标位置（可选） */
  targetLocation?: { x: number; y: number };
}

// ═══════════════════════════════════════════════════════════════
// 常量配置
// ═══════════════════════════════════════════════════════════════

/** 各职业需求衰减速率（每分钟） */
const PROFESSION_DECAY_RATES: Record<string, NPCNeeds> = {
  farmer:   { hunger: 0.5, fatigue: 0.3, morale: 0.1, social: 0.2 },
  soldier:  { hunger: 0.4, fatigue: 0.5, morale: 0.3, social: 0.1 },
  merchant: { hunger: 0.3, fatigue: 0.2, morale: 0.2, social: 0.4 },
  scholar:  { hunger: 0.3, fatigue: 0.4, morale: 0.1, social: 0.3 },
  scout:    { hunger: 0.5, fatigue: 0.5, morale: 0.2, social: 0.1 },
};

/** 各职业默认活动 */
const PROFESSION_DEFAULT_ACTION: Record<string, NeedAction> = {
  farmer:   'work',
  soldier:  'patrol',
  merchant: 'trade',
  scholar:  'study',
  scout:    'scout',
};

/** 动作对需求的影响量 */
const ACTION_EFFECTS: Record<NeedAction, NPCNeeds> = {
  work:      { hunger: +10, fatigue: +15, morale: -5,  social: -5  },
  eat:       { hunger: -40, fatigue: -5,  morale: +5,  social: +10 },
  rest:      { hunger: +5,  fatigue: -40, morale: +10, social: -5  },
  socialize: { hunger: +5,  fatigue: -5,  morale: +20, social: -30 },
  patrol:    { hunger: +10, fatigue: +20, morale: +10, social: -10 },
  trade:     { hunger: +5,  fatigue: +10, morale: +5,  social: +15 },
  study:     { hunger: +5,  fatigue: +20, morale: +5,  social: +10 },
  scout:     { hunger: +15, fatigue: +25, morale: +15, social: -10 },
};

/** 初始需求值 */
const DEFAULT_NEEDS: NPCNeeds = { hunger: 30, fatigue: 20, morale: 70, social: 30 };

/** 需求值上下限 */
const NEED_MIN = 0;
const NEED_MAX = 100;

// ═══════════════════════════════════════════════════════════════
// NPCNeedSystem 类
// ═══════════════════════════════════════════════════════════════

export class NPCNeedSystem {
  /** NPC 需求状态表 */
  private npcNeeds: Map<string, NPCNeeds>;
  /** NPC 职业衰减速率表 */
  private decayRates: Map<string, NPCNeeds>;

  constructor() {
    this.npcNeeds = new Map();
    this.decayRates = new Map();
  }

  // ── 初始化 ──────────────────────────────────────

  /** 初始化 NPC 需求，根据职业设置衰减速率 */
  initNeeds(npcId: string, profession: string): void {
    const rates = PROFESSION_DECAY_RATES[profession] ?? PROFESSION_DECAY_RATES['farmer'];
    this.npcNeeds.set(npcId, { ...DEFAULT_NEEDS });
    this.decayRates.set(npcId, { ...rates });
  }

  // ── 需求更新 ────────────────────────────────────

  /** 更新需求（每帧调用，deltaTime 单位为秒） */
  updateNeeds(npcId: string, deltaTime: number): NPCNeeds {
    const needs = this.npcNeeds.get(npcId);
    const rates = this.decayRates.get(npcId);
    if (!needs || !rates) return { ...DEFAULT_NEEDS };

    // deltaTime 秒 → 分钟
    const minutes = deltaTime / 60;

    needs.hunger  = clamp(needs.hunger  + rates.hunger  * minutes);
    needs.fatigue = clamp(needs.fatigue + rates.fatigue * minutes);
    // 士气是衰减（降低），社交是增长
    needs.morale  = clamp(needs.morale  - rates.morale  * minutes);
    needs.social  = clamp(needs.social  + rates.social  * minutes);

    return { ...needs };
  }

  // ── 决策引擎 ────────────────────────────────────

  /** 根据当前需求做出决策 */
  decideAction(npcId: string, profession: string): NeedDecision {
    const needs = this.npcNeeds.get(npcId);
    if (!needs) {
      return { action: 'work', reason: '无需求数据，默认工作', urgency: 0 };
    }

    // 优先级决策链
    if (needs.hunger > 80) {
      return {
        action: 'eat',
        reason: '太饿了，需要吃饭',
        urgency: (needs.hunger - 80) / 20,
      };
    }

    if (needs.fatigue > 80) {
      return {
        action: 'rest',
        reason: '太累了，需要休息',
        urgency: (needs.fatigue - 80) / 20,
      };
    }

    if (needs.morale < 20) {
      return {
        action: 'socialize',
        reason: '士气低落，需要社交',
        urgency: (20 - needs.morale) / 20,
      };
    }

    if (needs.hunger > 50 && needs.fatigue < 50) {
      return {
        action: 'work',
        reason: '肚子有点饿但还能工作',
        urgency: (needs.hunger - 50) / 50,
      };
    }

    if (needs.fatigue > 50) {
      return {
        action: 'rest',
        reason: '有些疲惫，休息一下',
        urgency: (needs.fatigue - 50) / 50,
      };
    }

    // 默认按职业选择活动
    const defaultAction = PROFESSION_DEFAULT_ACTION[profession] ?? 'work';
    return {
      action: defaultAction,
      reason: `执行${profession}日常活动`,
      urgency: 0.1,
    };
  }

  // ── 动作执行 ────────────────────────────────────

  /** 执行动作后的需求变化 */
  applyAction(npcId: string, action: NeedAction): NPCNeeds {
    const needs = this.npcNeeds.get(npcId);
    if (!needs) return { ...DEFAULT_NEEDS };

    const effects = ACTION_EFFECTS[action];
    needs.hunger  = clamp(needs.hunger  + effects.hunger);
    needs.fatigue = clamp(needs.fatigue + effects.fatigue);
    needs.morale  = clamp(needs.morale  + effects.morale);
    needs.social  = clamp(needs.social  + effects.social);

    return { ...needs };
  }

  // ── 查询接口 ────────────────────────────────────

  /** 获取 NPC 需求状态 */
  getNeeds(npcId: string): NPCNeeds {
    const needs = this.npcNeeds.get(npcId);
    return needs ? { ...needs } : { ...DEFAULT_NEEDS };
  }

  /** 直接设置 NPC 需求状态（用于测试和调试） */
  setNeeds(npcId: string, needs: NPCNeeds): void {
    this.npcNeeds.set(npcId, { ...needs });
  }

  /** 获取需求状态描述（用于 UI 显示） */
  getNeedsDescription(npcId: string): string {
    const needs = this.npcNeeds.get(npcId);
    if (!needs) return '状态未知';

    const parts: string[] = [];
    if (needs.hunger > 70) parts.push('非常饥饿');
    else if (needs.hunger > 40) parts.push('有些饥饿');
    else parts.push('饱腹');

    if (needs.fatigue > 70) parts.push('精疲力竭');
    else if (needs.fatigue > 40) parts.push('有些疲惫');
    else parts.push('精力充沛');

    if (needs.morale > 60) parts.push('士气高昂');
    else if (needs.morale > 30) parts.push('士气一般');
    else parts.push('士气低落');

    return parts.join('，');
  }

  /** 检查是否需要中断当前活动 */
  shouldInterrupt(npcId: string): { interrupt: boolean; reason: string } {
    const needs = this.npcNeeds.get(npcId);
    if (!needs) return { interrupt: false, reason: '' };

    if (needs.hunger > 80) {
      return { interrupt: true, reason: '太饿了，必须吃饭！' };
    }
    if (needs.fatigue > 80) {
      return { interrupt: true, reason: '太累了，必须休息！' };
    }
    if (needs.morale < 10) {
      return { interrupt: true, reason: '士气崩溃，需要社交！' };
    }

    return { interrupt: false, reason: '' };
  }

  // ── 序列化 ──────────────────────────────────────

  /** 序列化为可存储对象 */
  serialize(): object {
    const needsData: Record<string, NPCNeeds> = {};
    const ratesData: Record<string, NPCNeeds> = {};
    this.npcNeeds.forEach((v, k) => { needsData[k] = { ...v }; });
    this.decayRates.forEach((v, k) => { ratesData[k] = { ...v }; });
    return { npcNeeds: needsData, decayRates: ratesData };
  }

  /** 从序列化数据恢复 */
  deserialize(data: Record<string, unknown>): void {
    const d = data as { npcNeeds: Record<string, NPCNeeds>; decayRates: Record<string, NPCNeeds> };
    this.npcNeeds = new Map(Object.entries(d.npcNeeds));
    this.decayRates = new Map(Object.entries(d.decayRates));
  }
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 将需求值限制在 [0, 100] 范围内 */
function clamp(value: number): number {
  return Math.max(NEED_MIN, Math.min(NEED_MAX, value));
}
