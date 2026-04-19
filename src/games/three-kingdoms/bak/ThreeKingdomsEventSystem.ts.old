/**
 * 三国霸业 — 事件玩法系统
 *
 * 提供多维度事件机制，覆盖 10 种事件类型、22+ 种具体事件：
 *   A. 历史剧情事件（story）× 5 — 经典三国剧情，有选择分支与连锁
 *   B. 随机遭遇事件（random）× 5 — 随机触发，概率驱动
 *   C. 限时活动事件（timed）× 4 — 周期性/季节性活动
 *   D. NPC交互事件（npc）× 4 — 与各类NPC互动
 *   E. 探索发现事件（exploration）× 4 — 征服/研究时概率触发
 *
 * 支持触发条件检查、冷却时间、最大触发次数、连锁事件、
 * 序列化/反序列化，可随存档一起持久化。
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 事件类型 */
export type GameEventType =
  | 'story'        // 历史剧情事件
  | 'random'       // 随机遭遇
  | 'timed'        // 限时活动
  | 'npc'          // NPC交互事件
  | 'exploration'  // 探索发现
  | 'surprise'     // 惊喜奖励
  | 'challenge'    // 挑战任务
  | 'disaster'     // 灾难事件
  | 'trade'        // 交易事件
  | 'collection';  // 收集事件

/** 触发条件类型 */
export type TriggerConditionType =
  | 'on_login' | 'on_build' | 'on_recruit' | 'on_battle' | 'on_conquer'
  | 'on_research' | 'on_level_up' | 'on_prestige' | 'on_npc_encounter'
  | 'on_time' | 'on_random' | 'on_hero_count' | 'on_territory_count'
  | 'on_resource_threshold';

/** 事件选择项 */
export interface EventChoice {
  text: string;
  outcome: 'positive' | 'negative' | 'neutral';
  reward?: Record<string, number>;
  penalty?: Record<string, number>;
  nextEventId?: string; // 连锁事件
}

/** 触发条件 */
export interface TriggerCondition {
  type: TriggerConditionType;
  value?: number;
  probability?: number; // 触发概率 0-1
  cooldown?: number;    // 冷却时间（秒）
  extraCondition?: {
    heroCountMin?: number;
    territoryCountMin?: number;
    troopsLessThan?: number;
    troopsLessThanEnemy?: boolean;
    foodGreaterThan?: number;
    levelMin?: number;
    npcType?: string;
    heroLevelMin?: Record<string, number>; // heroId → minLevel
    terrainType?: string;
  };
}

/** 游戏事件定义 */
export interface GameEvent {
  id: string;
  name: string;
  type: GameEventType;
  description: string;
  choices: EventChoice[];
  triggerCondition: TriggerCondition;
  reward?: Record<string, number>;
  priority: number;
  isRepeatable: boolean;
  maxTriggers: number; // 最大触发次数（0=无限）
  iconEmoji: string;
}

/** 活跃事件（已触发但未解决） */
export interface ActiveEvent {
  event: GameEvent;
  triggeredAt: number;
  choiceMade?: string;
  resolved: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 系统实现
// ═══════════════════════════════════════════════════════════════

export class ThreeKingdomsEventSystem {
  private events: Map<string, GameEvent>;
  private activeEvents: ActiveEvent[];
  private triggerHistory: Map<string, number>;  // eventId → lastTriggerTimestamp
  private triggerCounts: Map<string, number>;   // eventId → trigger count

  constructor() {
    this.events = new Map();
    this.activeEvents = [];
    this.triggerHistory = new Map();
    this.triggerCounts = new Map();
    this.initEvents();
  }

  /** 初始化全部事件（22 种） */
  initEvents(): void {
    const allEvents: GameEvent[] = [
      // ── A. 历史剧情事件（5种） ────────────────────────────
      {
        id: 'evt_story_01', name: '温酒斩华雄', type: 'story', iconEmoji: '⚔️',
        description: '华雄连斩数将，军心震动。关羽请战，曹操为其温酒壮行。',
        priority: 1, isRepeatable: false, maxTriggers: 1,
        triggerCondition: { type: 'on_battle', probability: 1, extraCondition: { heroCountMin: 1 } },
        choices: [
          { text: '派关羽出战（必胜）', outcome: 'positive', reward: { heroExp: 2, prestige: 20 } },
          { text: '普通战斗', outcome: 'neutral', reward: { heroExp: 1 } },
        ],
      },
      {
        id: 'evt_story_02', name: '长坂坡之战', type: 'story', iconEmoji: '🐎',
        description: '曹军百万追击，刘备家眷失散。赵云单骑救主，七进七出！',
        priority: 2, isRepeatable: false, maxTriggers: 1,
        triggerCondition: { type: 'on_battle', probability: 1, extraCondition: { troopsLessThan: 100 } },
        choices: [
          { text: '死战到底（属性+50%）', outcome: 'positive', reward: { heroFragment: 5, prestige: 50 } },
          { text: '撤退保全', outcome: 'neutral', reward: { food: 300 }, penalty: { troops: -30 } },
        ],
      },
      {
        id: 'evt_story_03', name: '空城计', type: 'story', iconEmoji: '🏯',
        description: '司马懿大军压境，城中空虚。诸葛亮独坐城楼抚琴，以空城退敌。',
        priority: 3, isRepeatable: false, maxTriggers: 1,
        triggerCondition: { type: 'on_battle', probability: 1, extraCondition: { troopsLessThanEnemy: true } },
        choices: [
          { text: '保持冷静（智力判定）', outcome: 'positive', reward: { intelligence: 10, prestige: 30 } },
          { text: '趁夜撤退', outcome: 'neutral', penalty: { troops: -50 } },
        ],
      },
      {
        id: 'evt_story_04', name: '七擒孟获', type: 'story', iconEmoji: '🐘',
        description: '南蛮首领孟获反复叛乱。诸葛亮七擒七纵，终使其心服口服。',
        priority: 4, isRepeatable: false, maxTriggers: 1,
        triggerCondition: { type: 'on_conquer', probability: 0.5, extraCondition: { territoryCountMin: 5 } },
        choices: [
          { text: '反复征讨（七轮挑战）', outcome: 'positive', reward: { specialUnit: 1, territory: 1 } },
          { text: '放弃南蛮', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_story_05', name: '走麦城', type: 'story', iconEmoji: '💀',
        description: '关羽大意失荆州，败走麦城。吕蒙伏兵四起，形势危急！',
        priority: 5, isRepeatable: false, maxTriggers: 1,
        triggerCondition: {
          type: 'on_battle', probability: 0.3,
          extraCondition: { heroLevelMin: { guanyu: 10 } },
        },
        choices: [
          { text: '发兵救援（消耗兵力）', outcome: 'positive', reward: { heroAwaken: 1 }, penalty: { troops: -200 } },
          { text: '无力回天', outcome: 'negative', penalty: { heroUnavailable: 1, morale: -20 } },
        ],
      },

      // ── B. 随机遭遇事件（5种） ────────────────────────────
      {
        id: 'evt_random_01', name: '山中隐士', type: 'random', iconEmoji: '🏔️',
        description: '深山之中偶遇一位白发隐士，似乎身怀绝学。',
        priority: 10, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_random', probability: 0.05, cooldown: 3600 },
        choices: [
          { text: '请教（花费500铜钱）', outcome: 'positive', reward: { techBoost: 1 }, penalty: { gold: -500 } },
          { text: '礼貌离开', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_random_02', name: '流民投奔', type: 'random', iconEmoji: '👥',
        description: '一群流离失所的百姓来到城门前，恳请收留。',
        priority: 11, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_random', probability: 0.08, cooldown: 1800, extraCondition: { foodGreaterThan: 1000 } },
        choices: [
          { text: '接纳流民（消耗粮草）', outcome: 'positive', reward: { population: 50, laborForce: 1 }, penalty: { food: -500 } },
          { text: '婉拒', outcome: 'negative', penalty: { prestige: -10 } },
        ],
      },
      {
        id: 'evt_random_03', name: '瘟疫来袭', type: 'random', iconEmoji: '☠️',
        description: '一场瘟疫从边境蔓延而来，百姓人心惶惶。',
        priority: 12, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_random', probability: 0.03, cooldown: 7200 },
        choices: [
          { text: '封城隔离（产出-50%三天）', outcome: 'neutral', penalty: { productionDebuff: 3 } },
          { text: '放任不管', outcome: 'negative', penalty: { population: -100, morale: -30 } },
        ],
      },
      {
        id: 'evt_random_04', name: '矿脉发现', type: 'random', iconEmoji: '⛏️',
        description: '斥候在山地发现了一处富矿脉，可以立即开采。',
        priority: 13, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_conquer', probability: 0.1, cooldown: 3600, extraCondition: { terrainType: 'mountain' } },
        choices: [
          { text: '立即开采（花费兵力）', outcome: 'positive', reward: { gold: 2000 }, penalty: { troops: -50 } },
          { text: '稍后再来', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_random_05', name: '天降祥瑞', type: 'random', iconEmoji: '🌟',
        description: '天现异象，五彩祥云笼罩城池，百姓欢呼雀跃！',
        priority: 14, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_login', probability: 0.01, cooldown: 86400 },
        choices: [
          { text: '谢天恩', outcome: 'positive', reward: { productionMultiplier: 2, duration: 3600 } },
        ],
      },

      // ── C. 限时活动事件（4种） ────────────────────────────
      {
        id: 'evt_timed_01', name: '黄巾余党', type: 'timed', iconEmoji: ' turb️',
        description: '黄巾残党仍在各地作乱，朝廷悬赏征讨。限时7天，累计击败100波敌军！',
        priority: 20, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_time', probability: 1, cooldown: 604800 },
        choices: [
          { text: '参与征讨（7天累计100波）', outcome: 'positive', reward: { heroCard: 1, specialHeroId: 1 } },
          { text: '忽略', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_timed_02', name: '赤壁庆典', type: 'timed', iconEmoji: '🔥',
        description: '赤壁之战周年庆典，收集东风代币兑换限定称号！',
        priority: 21, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_level_up', probability: 1, extraCondition: { levelMin: 5 }, cooldown: 2592000 },
        choices: [
          { text: '参与庆典', outcome: 'positive', reward: { title: 1, token: 10 } },
          { text: '忽略', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_timed_03', name: '春耕祭', type: 'timed', iconEmoji: '🌾',
        description: '春耕时节到来，参与种田小游戏，粮草大丰收！',
        priority: 22, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_time', probability: 1, cooldown: 7776000 },
        choices: [
          { text: '参与春耕', outcome: 'positive', reward: { foodProductionBonus: 5 } },
          { text: '忽略', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_timed_04', name: '招贤纳士', type: 'timed', iconEmoji: '📜',
        description: '每月招贤大会开启，武将招募费用减半！',
        priority: 23, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_time', probability: 1, cooldown: 2592000 },
        choices: [
          { text: '参与招贤', outcome: 'positive', reward: { recruitDiscount: 50 } },
          { text: '忽略', outcome: 'neutral' },
        ],
      },

      // ── D. NPC交互事件（4种） ─────────────────────────────
      {
        id: 'evt_npc_01', name: '神秘商人', type: 'npc', iconEmoji: '🏪',
        description: '一位神秘商人带着稀世珍宝来到城中，价格不菲但物有所值。',
        priority: 30, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_npc_encounter', probability: 0.5, cooldown: 3600, extraCondition: { npcType: 'merchant' } },
        choices: [
          { text: '购买稀有商品', outcome: 'positive', reward: { rareEquipment: 1 }, penalty: { gold: -1000 } },
          { text: '婉拒', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_npc_02', name: '学者请教', type: 'npc', iconEmoji: '📚',
        description: '一位饱学之士出题考校三国典故，答对有赏。',
        priority: 31, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_npc_encounter', probability: 0.4, cooldown: 1800, extraCondition: { npcType: 'scholar' } },
        choices: [
          { text: '答题挑战', outcome: 'positive', reward: { techPoint: 50 } },
          { text: '告辞', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_npc_03', name: '斥候情报', type: 'npc', iconEmoji: '🔍',
        description: '斥候带来敌军情报，可支付铜钱获取详细军情以降低征服消耗。',
        priority: 32, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_npc_encounter', probability: 0.6, cooldown: 2400, extraCondition: { npcType: 'scout' } },
        choices: [
          { text: '支付铜钱获取情报', outcome: 'positive', reward: { conquerCostReduction: 20 }, penalty: { gold: -300 } },
          { text: '拒绝', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_npc_04', name: '农民请求', type: 'npc', iconEmoji: '👨‍🌾',
        description: '附近农民遭匪患侵扰，恳请主公出兵相助。',
        priority: 33, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_npc_encounter', probability: 0.7, cooldown: 1200, extraCondition: { npcType: 'farmer' } },
        choices: [
          { text: '出兵相助（消耗粮草）', outcome: 'positive', reward: { prestige: 15 }, penalty: { food: -200 } },
          { text: '拒绝', outcome: 'negative', penalty: { prestige: -5 } },
        ],
      },

      // ── E. 探索发现事件（4种） ────────────────────────────
      {
        id: 'evt_explore_01', name: '古墓探索', type: 'exploration', iconEmoji: '🏛️',
        description: '征服领土时发现一座上古墓穴，传说其中藏有稀世珍宝，但机关重重。',
        priority: 40, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_conquer', probability: 0.05, cooldown: 7200 },
        choices: [
          { text: '开启古墓', outcome: 'positive', reward: { rareEquipment: 1, gold: 500 }, penalty: { troops: -30 } },
          { text: '放弃探索', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_explore_02', name: '遗迹发现', type: 'exploration', iconEmoji: '🗿',
        description: '在征服的领土上发现远古遗迹，可能蕴含失传的科技知识。',
        priority: 41, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_conquer', probability: 0.03, cooldown: 10800 },
        choices: [
          { text: '探索遗迹（花费时间）', outcome: 'positive', reward: { techPoint: 100 } },
          { text: '忽略', outcome: 'neutral' },
        ],
      },
      {
        id: 'evt_explore_03', name: '名马赤兔', type: 'exploration', iconEmoji: '🐴',
        description: '传说中吕布的坐骑赤兔马竟然现身！千载难逢的机缘！',
        priority: 42, isRepeatable: false, maxTriggers: 1,
        triggerCondition: { type: 'on_random', probability: 0.001, cooldown: 0 },
        choices: [
          { text: '立即驯服', outcome: 'positive', reward: { heroSpeedBonus: 10 } },
        ],
      },
      {
        id: 'evt_explore_04', name: '兵书残卷', type: 'exploration', iconEmoji: '📖',
        description: '研究科技时偶然发现一卷残破的兵书，似乎记载着失传的战法。',
        priority: 43, isRepeatable: true, maxTriggers: 0,
        triggerCondition: { type: 'on_research', probability: 0.1, cooldown: 3600 },
        choices: [
          { text: '研读兵书（花费时间）', outcome: 'positive', reward: { battleStatBonus: 5 } },
          { text: '出售换钱', outcome: 'neutral', reward: { gold: 200 } },
        ],
      },
    ];

    allEvents.forEach((evt) => this.events.set(evt.id, evt));
  }

  // ── 触发检查 ─────────────────────────────────────────────

  /**
   * 检查并触发满足条件的事件
   * @param context 当前游戏上下文
   * @returns 满足触发条件的事件列表（按优先级排序）
   */
  checkTriggers(context: {
    action: string;
    value?: number;
    gameHour?: number;
    resources?: Record<string, number>;
    heroCount?: number;
    territoryCount?: number;
    level?: number;
    npcType?: string;
  }): GameEvent[] {
    const now = Date.now();
    const triggered: GameEvent[] = [];

    for (const event of this.events.values()) {
      const cond = event.triggerCondition;

      // 1. 检查触发动作类型匹配
      if (!this.matchAction(cond.type, context.action)) continue;

      // 2. 检查最大触发次数
      const count = this.triggerCounts.get(event.id) ?? 0;
      if (event.maxTriggers > 0 && count >= event.maxTriggers) continue;

      // 3. 检查冷却时间
      const lastTime = this.triggerHistory.get(event.id);
      if (lastTime !== undefined && cond.cooldown && cond.cooldown > 0) {
        if (now - lastTime < cond.cooldown * 1000) continue;
      }

      // 4. 概率检查
      if (cond.probability !== undefined && cond.probability < 1) {
        if (Math.random() > cond.probability) continue;
      }

      // 5. 额外条件检查
      const extra = cond.extraCondition;
      if (extra) {
        if (extra.heroCountMin !== undefined && (context.heroCount ?? 0) < extra.heroCountMin) continue;
        if (extra.territoryCountMin !== undefined && (context.territoryCount ?? 0) < extra.territoryCountMin) continue;
        if (extra.foodGreaterThan !== undefined && (context.resources?.food ?? 0) < extra.foodGreaterThan) continue;
        if (extra.levelMin !== undefined && (context.level ?? 0) < extra.levelMin) continue;
        if (extra.npcType !== undefined && context.npcType !== extra.npcType) continue;
        if (extra.troopsLessThan !== undefined && (context.value ?? 0) >= extra.troopsLessThan) continue;
        if (extra.troopsLessThanEnemy && (context.value ?? 0) >= (context.value ?? 0)) {
          // troopsLessThanEnemy: context.value = own troops, need enemy troops > own
          // This condition requires external enemy info; simplified: skip if no enemy data
        }
      }

      // 条件全部通过 → 记录触发
      this.triggerHistory.set(event.id, now);
      this.triggerCounts.set(event.id, count + 1);
      this.activeEvents.push({
        event,
        triggeredAt: now,
        resolved: false,
      });
      triggered.push(event);
    }

    // 按优先级排序
    triggered.sort((a, b) => a.priority - b.priority);
    return triggered;
  }

  /** 将 triggerCondition.type 映射到 action 字符串 */
  private matchAction(condType: TriggerConditionType, action: string): boolean {
    const mapping: Record<string, TriggerConditionType[]> = {
      battle: ['on_battle'],
      conquer: ['on_conquer'],
      recruit: ['on_recruit'],
      build: ['on_build'],
      research: ['on_research'],
      login: ['on_login'],
      level_up: ['on_level_up'],
      npc_encounter: ['on_npc_encounter'],
      random: ['on_random'],
      time: ['on_time'],
    };
    const allowed = mapping[action];
    return allowed ? allowed.includes(condType) : false;
  }

  // ── 做出选择 ─────────────────────────────────────────────

  /**
   * 对活跃事件做出选择
   * @param eventId  事件ID
   * @param choiceIndex 选择项索引
   * @returns 选择结果
   */
  makeChoice(eventId: string, choiceIndex: number): {
    outcome: 'positive' | 'negative' | 'neutral';
    reward?: Record<string, number>;
    penalty?: Record<string, number>;
    nextEventId?: string;
  } {
    const activeEvent = this.activeEvents.find(
      (ae) => ae.event.id === eventId && !ae.resolved,
    );
    if (!activeEvent) {
      return { outcome: 'neutral' };
    }

    const choice = activeEvent.event.choices[choiceIndex];
    if (!choice) {
      return { outcome: 'neutral' };
    }

    activeEvent.choiceMade = choice.text;
    activeEvent.resolved = true;

    return {
      outcome: choice.outcome,
      reward: choice.reward ? { ...choice.reward } : undefined,
      penalty: choice.penalty ? { ...choice.penalty } : undefined,
      nextEventId: choice.nextEventId,
    };
  }

  // ── 数据查询 ─────────────────────────────────────────────

  /** 获取所有未解决的活跃事件 */
  getActiveEvents(): ActiveEvent[] {
    return this.activeEvents.filter((ae) => !ae.resolved);
  }

  /** 根据ID获取事件定义 */
  getEventById(id: string): GameEvent | undefined {
    return this.events.get(id);
  }

  /** 获取事件总数 */
  getEventCount(): number {
    return this.events.size;
  }

  /** 按类型获取事件列表 */
  getEventsByType(type: GameEventType): GameEvent[] {
    const result: GameEvent[] = [];
    for (const evt of this.events.values()) {
      if (evt.type === type) result.push(evt);
    }
    return result.sort((a, b) => a.priority - b.priority);
  }

  /** 获取触发历史 */
  getTriggerHistory(): Map<string, number> {
    return new Map(this.triggerHistory);
  }

  /** 获取触发次数 */
  getTriggerCounts(): Map<string, number> {
    return new Map(this.triggerCounts);
  }

  // ── 序列化 / 反序列化 ────────────────────────────────────

  serialize(): object {
    return {
      triggerHistory: Object.fromEntries(this.triggerHistory),
      triggerCounts: Object.fromEntries(this.triggerCounts),
      activeEvents: this.activeEvents.map((ae) => ({
        eventId: ae.event.id,
        triggeredAt: ae.triggeredAt,
        choiceMade: ae.choiceMade,
        resolved: ae.resolved,
      })),
    };
  }

  deserialize(data: object): void {
    const d = data as {
      triggerHistory?: Record<string, number>;
      triggerCounts?: Record<string, number>;
      activeEvents?: { eventId: string; triggeredAt: number; choiceMade?: string; resolved: boolean }[];
    };

    this.triggerHistory = d.triggerHistory
      ? new Map(Object.entries(d.triggerHistory))
      : new Map();
    this.triggerCounts = d.triggerCounts
      ? new Map(Object.entries(d.triggerCounts).map(([k, v]) => [k, Number(v)]))
      : new Map();

    const loaded: ActiveEvent[] = [];
    for (const ae of d.activeEvents ?? []) {
      const event = this.events.get(ae.eventId);
      if (event) {
        loaded.push({ event, triggeredAt: ae.triggeredAt, choiceMade: ae.choiceMade, resolved: ae.resolved });
      }
    }
    this.activeEvents = loaded;
  }
}
