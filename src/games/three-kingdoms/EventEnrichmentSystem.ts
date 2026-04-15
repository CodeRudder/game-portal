/**
 * 三国霸业 — 丰富事件系统
 *
 * 提供 10 大类、33 种事件模板，覆盖历史/季节/随机/贸易/军事/
 * 外交/灾害/吉祥/NPC/节日等维度。支持触发条件检查、冷却机制、
 * 唯一事件标记、玩家选择分支和序列化持久化。
 *
 * @module games/three-kingdoms/EventEnrichmentSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 事件分类 */
export type EventCategory =
  | 'historical'    // 历史事件
  | 'seasonal'      // 季节事件
  | 'random'        // 随机事件
  | 'trade'         // 贸易事件
  | 'military'      // 军事事件
  | 'diplomatic'    // 外交事件
  | 'disaster'      // 灾害事件
  | 'blessing'      // 吉祥事件
  | 'npc'           // NPC事件
  | 'festival';     // 节日事件

/** 游戏事件定义 */
export interface GameEvent {
  id: string;
  category: EventCategory;
  name: string;
  description: string;
  triggerCondition: string;    // 触发条件描述
  effects: {
    resources?: Record<string, number>;
    morale?: number;
    reputation?: number;
    unlockFeature?: string;
  };
  choices?: {
    text: string;
    effects: Record<string, number>;
  }[];
  cooldown: number;            // 冷却时间（游戏分钟）
  lastTriggered: number;
  isUnique: boolean;           // 是否一次性事件
  hasTriggered: boolean;
}

/** 触发检查上下文 */
export interface EventContext {
  currentMinute: number;
  season: string;
  ownedTerritories: string[];
  resources: Record<string, number>;
  heroCount: number;
  armySize: number;
}

// ═══════════════════════════════════════════════════════════════
// 系统实现
// ═══════════════════════════════════════════════════════════════

export class EventEnrichmentSystem {
  private events: Map<string, GameEvent>;
  private activeEvents: GameEvent[];
  private eventHistory: { event: string; time: number; choice?: number }[];

  constructor() {
    this.events = new Map();
    this.activeEvents = [];
    this.eventHistory = [];
    this.initializeEvents();
  }

  /** 初始化全部事件模板（33 种） */
  initializeEvents(): void {
    const allEvents: GameEvent[] = [
      // ── 历史事件（5种） ──────────────────────────────
      { id: 'evt_h_01', category: 'historical', name: '黄巾之乱',
        description: '张角率黄巾军揭竿而起，天下大乱，各地豪强纷纷起兵。',
        triggerCondition: 'territoryCount >= 1', cooldown: 0, lastTriggered: 0, isUnique: true, hasTriggered: false,
        effects: { resources: { gold: -200 }, morale: -10 },
        choices: [
          { text: '招募义军镇压', effects: { gold: -300, troops: 100, reputation: 20 } },
          { text: '固守城池观望', effects: { grain: -100, reputation: -5 } },
        ] },
      { id: 'evt_h_02', category: 'historical', name: '董卓进京',
        description: '董卓率西凉铁骑入京，把持朝政，废帝另立，天下震动。',
        triggerCondition: 'territoryCount >= 3', cooldown: 0, lastTriggered: 0, isUnique: true, hasTriggered: false,
        effects: { resources: { gold: -500 }, morale: -15 },
        choices: [
          { text: '联合诸侯讨伐', effects: { gold: -500, reputation: 30, troops: 200 } },
          { text: '保持中立', effects: { reputation: -10 } },
        ] },
      { id: 'evt_h_03', category: 'historical', name: '官渡之战',
        description: '曹操与袁绍对峙官渡，以少胜多的关键战役。',
        triggerCondition: 'armySize >= 500 && heroCount >= 2', cooldown: 0, lastTriggered: 0, isUnique: true, hasTriggered: false,
        effects: { resources: { grain: -300 } },
        choices: [
          { text: '奇袭乌巢', effects: { grain: -200, reputation: 40, gold: 800 } },
          { text: '正面决战', effects: { troops: -300, reputation: 10 } },
        ] },
      { id: 'evt_h_04', category: 'historical', name: '赤壁之战',
        description: '孙刘联军火烧赤壁，大破曹军百万，三分天下之势初成。',
        triggerCondition: 'armySize >= 1000 && territoryCount >= 5', cooldown: 0, lastTriggered: 0, isUnique: true, hasTriggered: false,
        effects: { resources: { gold: -1000 } },
        choices: [
          { text: '火攻破敌', effects: { gold: -500, reputation: 50, troops: 500 } },
          { text: '铁索连环', effects: { troops: -200, gold: 1500 } },
        ] },
      { id: 'evt_h_05', category: 'historical', name: '五虎上将',
        description: '五虎上将齐聚，威震天下，军心大振！',
        triggerCondition: 'heroCount >= 5', cooldown: 0, lastTriggered: 0, isUnique: true, hasTriggered: false,
        effects: { morale: 30, reputation: 25 },
        choices: [
          { text: '设宴庆贺', effects: { gold: -200, morale: 20 } },
          { text: '加紧操练', effects: { grain: -300, troops: 200 } },
        ] },

      // ── 季节事件（4种） ──────────────────────────────
      { id: 'evt_s_01', category: 'seasonal', name: '春耕',
        description: '春回大地，百姓忙于耕种，粮草产量提升。',
        triggerCondition: 'season == spring', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: 500 } },
        choices: [
          { text: '大力扶持农耕', effects: { grain: 800, gold: -200 } },
          { text: '顺其自然', effects: { grain: 300 } },
        ] },
      { id: 'evt_s_02', category: 'seasonal', name: '夏收',
        description: '夏日炎炎，庄稼丰收在望，但需防范蝗灾。',
        triggerCondition: 'season == summer', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: 600 } },
        choices: [
          { text: '组织抢收', effects: { grain: 1000, gold: -100 } },
          { text: '放任自流', effects: { grain: 200 } },
        ] },
      { id: 'evt_s_03', category: 'seasonal', name: '秋猎',
        description: '秋高气爽，正是练兵狩猎的好时节。',
        triggerCondition: 'season == autumn', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 5 },
        choices: [
          { text: '皇家围猎', effects: { morale: 15, grain: -100, reputation: 10 } },
          { text: '军中演武', effects: { troops: 50, grain: -200 } },
        ] },
      { id: 'evt_s_04', category: 'seasonal', name: '冬祭',
        description: '寒冬腊月，百姓祭祀祖先，祈求来年风调雨顺。',
        triggerCondition: 'season == winter', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 5 },
        choices: [
          { text: '隆重祭祀', effects: { gold: -300, morale: 20, reputation: 15 } },
          { text: '简朴从事', effects: { gold: -50, morale: 5 } },
        ] },

      // ── 随机事件（5种） ──────────────────────────────
      { id: 'evt_r_01', category: 'random', name: '商队到访',
        description: '一支远方商队途经此地，带来各种珍奇货物。',
        triggerCondition: 'random', cooldown: 480, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { gold: 200 } },
        choices: [
          { text: '热情招待', effects: { gold: 300, grain: -100 } },
          { text: '征收商税', effects: { gold: 500, reputation: -10 } },
        ] },
      { id: 'evt_r_02', category: 'random', name: '流民归附',
        description: '大批流民涌入，可补充人口但消耗粮草。',
        triggerCondition: 'random && grain > 500', cooldown: 600, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: -200 } },
        choices: [
          { text: '悉数接纳', effects: { grain: -400, troops: 100, reputation: 15 } },
          { text: '挑选精壮', effects: { grain: -100, troops: 30 } },
        ] },
      { id: 'evt_r_03', category: 'random', name: '矿脉发现',
        description: '探子在领地内发现了一处富矿脉！',
        triggerCondition: 'random && territoryCount >= 2', cooldown: 720, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { gold: 300 } },
        choices: [
          { text: '立即开采', effects: { gold: 800, troops: -50 } },
          { text: '封存待用', effects: { gold: 100, reputation: 5 } },
        ] },
      { id: 'evt_r_04', category: 'random', name: '古墓出土',
        description: '施工时意外掘出一座古墓，内藏大量珍宝。',
        triggerCondition: 'random', cooldown: 960, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { gold: 100 } },
        choices: [
          { text: '探索古墓', effects: { gold: 600, troops: -30, reputation: 10 } },
          { text: '上报朝廷', effects: { gold: 200, reputation: 20 } },
        ] },
      { id: 'evt_r_05', category: 'random', name: '祥瑞降临',
        description: '天现五彩祥云，百姓称颂，民心大振！',
        triggerCondition: 'random', cooldown: 1200, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 10, reputation: 10 },
        choices: [
          { text: '昭告天下', effects: { gold: -100, morale: 20, reputation: 25 } },
          { text: '低调处理', effects: { morale: 5 } },
        ] },

      // ── 贸易事件（3种） ──────────────────────────────
      { id: 'evt_t_01', category: 'trade', name: '丝绸之路',
        description: '西域商人开辟丝绸之路，可大量贸易获利。',
        triggerCondition: 'territoryCount >= 4', cooldown: 960, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { gold: 500 } },
        choices: [
          { text: '全力开拓', effects: { gold: 1500, grain: -500 } },
          { text: '适度经营', effects: { gold: 600, grain: -100 } },
        ] },
      { id: 'evt_t_02', category: 'trade', name: '海外贸易',
        description: '海外番邦遣使通商，带来奇珍异宝。',
        triggerCondition: 'territoryCount >= 3 && gold > 1000', cooldown: 960, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { gold: 300 } },
        choices: [
          { text: '大举进口', effects: { gold: -800, reputation: 30, morale: 15 } },
          { text: '以物易物', effects: { grain: -300, gold: 500 } },
        ] },
      { id: 'evt_t_03', category: 'trade', name: '黑市交易',
        description: '地下黑市商人兜售稀有军械，价格诱人但风险不小。',
        triggerCondition: 'random', cooldown: 720, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { gold: -200 } },
        choices: [
          { text: '冒险交易', effects: { gold: -500, troops: 200, reputation: -15 } },
          { text: '拒绝合作', effects: { reputation: 5 } },
        ] },

      // ── 军事事件（3种） ──────────────────────────────
      { id: 'evt_m_01', category: 'military', name: '边境冲突',
        description: '边境守军与敌国巡逻队发生冲突，局势紧张。',
        triggerCondition: 'armySize >= 200', cooldown: 360, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: -5 },
        choices: [
          { text: '增兵边境', effects: { troops: -100, reputation: 10, gold: -200 } },
          { text: '外交斡旋', effects: { gold: -300, reputation: 5 } },
        ] },
      { id: 'evt_m_02', category: 'military', name: '叛军作乱',
        description: '领地内叛军揭竿而起，必须尽快平叛！',
        triggerCondition: 'territoryCount >= 3 && morale < 50', cooldown: 600, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: -200 }, morale: -10 },
        choices: [
          { text: '出兵镇压', effects: { troops: -150, grain: -100, reputation: 15 } },
          { text: '招安安抚', effects: { gold: -400, troops: 50 } },
        ] },
      { id: 'evt_m_03', category: 'military', name: '武将挑战',
        description: '敌方猛将阵前搦战，若不应战则士气受损。',
        triggerCondition: 'heroCount >= 1 && armySize >= 300', cooldown: 480, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: -5 },
        choices: [
          { text: '应战', effects: { reputation: 20, troops: -50 } },
          { text: '坚守不出', effects: { morale: -15 } },
        ] },

      // ── 外交事件（3种） ──────────────────────────────
      { id: 'evt_d_01', category: 'diplomatic', name: '联姻提议',
        description: '邻国遣使求婚，联姻可巩固两国关系。',
        triggerCondition: 'territoryCount >= 2', cooldown: 960, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { reputation: 5 },
        choices: [
          { text: '欣然应允', effects: { gold: -500, reputation: 25, morale: 10 } },
          { text: '婉言谢绝', effects: { reputation: -5 } },
        ] },
      { id: 'evt_d_02', category: 'diplomatic', name: '结盟邀请',
        description: '一方诸侯遣使结盟，共抗强敌。',
        triggerCondition: 'territoryCount >= 3', cooldown: 960, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { reputation: 5 },
        choices: [
          { text: '歃血为盟', effects: { gold: -300, reputation: 30, troops: 100 } },
          { text: '虚与委蛇', effects: { reputation: -10 } },
        ] },
      { id: 'evt_d_03', category: 'diplomatic', name: '投降谈判',
        description: '战败的敌方使者前来乞降，如何处置？',
        triggerCondition: 'armySize >= 500 && territoryCount >= 4', cooldown: 720, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { reputation: 5 },
        choices: [
          { text: '宽厚接纳', effects: { troops: 200, grain: -200, reputation: 20 } },
          { text: '严惩不贷', effects: { reputation: -10, morale: 10 } },
        ] },

      // ── 灾害事件（3种） ──────────────────────────────
      { id: 'evt_x_01', category: 'disaster', name: '旱灾',
        description: '久旱不雨，庄稼枯萎，粮草大幅减产。',
        triggerCondition: 'season == summer && random', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: -500 }, morale: -10 },
        choices: [
          { text: '开仓放粮', effects: { grain: -800, morale: 15, reputation: 10 } },
          { text: '祈雨祭祀', effects: { gold: -200, grain: -200 } },
        ] },
      { id: 'evt_x_02', category: 'disaster', name: '洪灾',
        description: '连日暴雨引发洪水，冲毁农田和建筑。',
        triggerCondition: 'season == autumn && random', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: -400, gold: -200 }, morale: -15 },
        choices: [
          { text: '全力救灾', effects: { gold: -500, grain: -200, morale: 10, reputation: 15 } },
          { text: '自求多福', effects: { grain: -600, morale: -10 } },
        ] },
      { id: 'evt_x_03', category: 'disaster', name: '瘟疫',
        description: '一场瘟疫在领地蔓延，百姓死伤无数。',
        triggerCondition: 'random && population > 500', cooldown: 1920, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: -300 }, morale: -20 },
        choices: [
          { text: '封城隔离', effects: { gold: -400, grain: -300, morale: -5 } },
          { text: '求医问药', effects: { gold: -600, morale: 5, reputation: 10 } },
        ] },

      // ── 吉祥事件（2种） ──────────────────────────────
      { id: 'evt_b_01', category: 'blessing', name: '丰收年',
        description: '风调雨顺，五谷丰登，百姓安居乐业！',
        triggerCondition: 'season == autumn && random', cooldown: 2880, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { resources: { grain: 1000 }, morale: 15 },
        choices: [
          { text: '减税惠民', effects: { grain: 500, gold: -200, reputation: 20 } },
          { text: '充实军粮', effects: { grain: 1500, troops: 100 } },
        ] },
      { id: 'evt_b_02', category: 'blessing', name: '龙凤呈祥',
        description: '龙凤齐现，天降祥瑞，国运昌盛！',
        triggerCondition: 'reputation > 80 && random', cooldown: 4320, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 20, reputation: 15 },
        choices: [
          { text: '大赦天下', effects: { gold: -500, reputation: 30, morale: 25 } },
          { text: '设坛祭天', effects: { gold: -300, reputation: 15 } },
        ] },

      // ── NPC事件（2种） ───────────────────────────────
      { id: 'evt_n_01', category: 'npc', name: '隐士出山',
        description: '一位隐居多年的高人愿出山辅佐，才华横溢。',
        triggerCondition: 'heroCount < 8 && random', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 5 },
        choices: [
          { text: '以礼相聘', effects: { gold: -800, reputation: 20, morale: 10 } },
          { text: '三顾茅庐', effects: { gold: -300, reputation: 30 } },
        ] },
      { id: 'evt_n_02', category: 'npc', name: '名医到访',
        description: '神医华佗云游至此，可救治伤兵、提升军力。',
        triggerCondition: 'armySize >= 200 && random', cooldown: 1440, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 5 },
        choices: [
          { text: '重金礼聘', effects: { gold: -600, troops: 150, morale: 10 } },
          { text: '虚心请教', effects: { gold: -200, troops: 50 } },
        ] },

      // ── 节日事件（3种） ──────────────────────────────
      { id: 'evt_f_01', category: 'festival', name: '春节',
        description: '新春佳节，万象更新，百姓欢庆，士气高涨。',
        triggerCondition: 'season == spring', cooldown: 2880, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 10 },
        choices: [
          { text: '大摆筵席', effects: { gold: -400, grain: -200, morale: 25, reputation: 10 } },
          { text: '发放赏钱', effects: { gold: -200, morale: 15 } },
        ] },
      { id: 'evt_f_02', category: 'festival', name: '中秋',
        description: '中秋月圆，团圆之夜，将士思乡之情涌上心头。',
        triggerCondition: 'season == autumn', cooldown: 2880, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 5 },
        choices: [
          { text: '赏月联欢', effects: { gold: -200, grain: -100, morale: 20 } },
          { text: '加急训练', effects: { grain: -150, troops: 50, morale: -5 } },
        ] },
      { id: 'evt_f_03', category: 'festival', name: '重阳',
        description: '重阳登高，饮菊花酒，祈求长寿安康。',
        triggerCondition: 'season == autumn', cooldown: 2880, lastTriggered: 0, isUnique: false, hasTriggered: false,
        effects: { morale: 5 },
        choices: [
          { text: '登高望远', effects: { morale: 15, reputation: 5 } },
          { text: '犒赏三军', effects: { gold: -300, grain: -100, morale: 20, troops: 50 } },
        ] },
    ];

    this.events.clear();
    allEvents.forEach((evt) => this.events.set(evt.id, evt));
  }

  /** 检查触发条件（简化表达式解析） */
  private checkCondition(condition: string, ctx: EventContext): boolean {
    // 纯随机事件
    if (condition === 'random') return Math.random() < 0.3;

    const territoryCount = ctx.ownedTerritories.length;
    const grain = ctx.resources.grain ?? ctx.resources.粮草 ?? 0;
    const gold = ctx.resources.gold ?? ctx.resources.铜钱 ?? 0;
    const morale = ctx.resources.morale ?? 50;
    const reputation = ctx.resources.reputation ?? ctx.resources.reputation ?? 50;

    // 构建变量映射
    const vars: Record<string, number> = {
      territoryCount, heroCount: ctx.heroCount, armySize: ctx.armySize,
      grain, gold, morale, reputation, population: ctx.resources.population ?? 1000,
    };

    // 检查季节条件
    if (condition.includes('season')) {
      const seasonMatch = condition.match(/season\s*==\s*(\w+)/);
      if (seasonMatch && seasonMatch[1] !== ctx.season) return false;
    }

    // 检查 random 附加条件
    if (condition.includes('random')) {
      if (Math.random() > 0.3) return false;
    }

    // 解析数值比较条件
    const comparisons = condition.match(/(\w+)\s*(>=|<=|>|<|==)\s*(\d+)/g);
    if (comparisons) {
      for (const cmp of comparisons) {
        const m = cmp.match(/(\w+)\s*(>=|<=|>|<|==)\s*(\d+)/);
        if (!m) continue;
        const [, varName, op, valStr] = m;
        const left = vars[varName] ?? 0;
        const right = parseInt(valStr, 10);
        let pass = false;
        switch (op) {
          case '>=': pass = left >= right; break;
          case '<=': pass = left <= right; break;
          case '>':  pass = left > right; break;
          case '<':  pass = left < right; break;
          case '==': pass = left === right; break;
        }
        if (!pass) return false;
      }
    }

    return true;
  }

  /** 检查并触发事件 */
  checkTriggers(context: EventContext): GameEvent[] {
    const triggered: GameEvent[] = [];

    for (const event of this.events.values()) {
      // 唯一事件已触发则跳过
      if (event.isUnique && event.hasTriggered) continue;

      // 冷却检查
      if (event.cooldown > 0 && event.lastTriggered > 0) {
        const elapsed = context.currentMinute - event.lastTriggered;
        if (elapsed < event.cooldown) continue;
      }

      // 条件检查
      if (!this.checkCondition(event.triggerCondition, context)) continue;

      // 触发成功
      event.lastTriggered = context.currentMinute;
      event.hasTriggered = true;
      this.activeEvents.push({ ...event });
      this.eventHistory.push({ event: event.id, time: context.currentMinute });
      triggered.push(event);
    }

    return triggered;
  }

  /** 对活跃事件做出选择 */
  makeChoice(eventId: string, choiceIndex: number): Record<string, number> {
    const idx = this.activeEvents.findIndex((e) => e.id === eventId);
    if (idx === -1) return {};

    const event = this.activeEvents[idx];
    if (!event.choices || choiceIndex < 0 || choiceIndex >= event.choices.length) return {};

    const choice = event.choices[choiceIndex];
    this.activeEvents.splice(idx, 1);

    // 记录历史中的选择
    const histEntry = this.eventHistory.find((h) => h.event === eventId && h.choice === undefined);
    if (histEntry) histEntry.choice = choiceIndex;

    return { ...choice.effects };
  }

  /** 获取活跃事件 */
  getActiveEvents(): GameEvent[] {
    return [...this.activeEvents];
  }

  /** 获取事件历史 */
  getEventHistory(): { event: string; time: number; choice?: number }[] {
    return [...this.eventHistory];
  }

  /** 获取事件总数 */
  getEventCount(): number {
    return this.events.size;
  }

  /** 按分类获取事件 */
  getEventsByCategory(category: EventCategory): GameEvent[] {
    const result: GameEvent[] = [];
    for (const evt of this.events.values()) {
      if (evt.category === category) result.push(evt);
    }
    return result;
  }

  // ── 序列化 / 反序列化 ────────────────────────────────────

  serialize(): object {
    return {
      events: Array.from(this.events.entries()).map(([id, evt]) => [id, {
        ...evt,
        lastTriggered: evt.lastTriggered,
        hasTriggered: evt.hasTriggered,
      }]),
      activeEvents: this.activeEvents,
      eventHistory: this.eventHistory,
    };
  }

  deserialize(data: object): void {
    const d = data as {
      events?: [string, GameEvent][];
      activeEvents?: GameEvent[];
      eventHistory?: { event: string; time: number; choice?: number }[];
    };
    if (d.events) {
      this.events = new Map();
      // 先初始化模板，再覆盖状态
      this.initializeEvents();
      for (const [id, evt] of d.events) {
        const existing = this.events.get(id);
        if (existing) {
          existing.lastTriggered = evt.lastTriggered;
          existing.hasTriggered = evt.hasTriggered;
        }
      }
    }
    if (d.activeEvents) this.activeEvents = d.activeEvents;
    if (d.eventHistory) this.eventHistory = d.eventHistory;
  }
}
