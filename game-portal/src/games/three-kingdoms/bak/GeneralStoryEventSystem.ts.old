/**
 * 武将剧情事件系统 — 三国历史剧情对话
 *
 * 提供基于游戏进度和武将状态触发的剧情事件，
 * 包含多轮对话、分支选项和历史感强的叙事内容。
 *
 * @module games/three-kingdoms/GeneralStoryEventSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 剧情事件触发条件 */
export interface StoryTrigger {
  /** 触发类型 */
  type: 'recruit' | 'battle_win' | 'territory' | 'time' | 'bond';
  /** 目标 ID（如武将 ID、领土 ID） */
  targetId?: string;
  /** 数量阈值 */
  threshold?: number;
}

/** 剧情对话行 */
export interface StoryLine {
  /** 发言者 */
  speaker: string;
  /** 对话文本 */
  text: string;
  /** 背景描述（可选） */
  narration?: string;
}

/** 剧情事件定义 */
export interface StoryEventDef {
  /** 事件 ID */
  id: string;
  /** 事件标题 */
  title: string;
  /** 事件描述 */
  description: string;
  /** 触发条件 */
  trigger: StoryTrigger;
  /** 对话内容 */
  lines: StoryLine[];
  /** 是否一次性事件 */
  oneTime: boolean;
  /** 事件奖励 */
  reward?: Record<string, number>;
}

/** 活跃剧情事件 */
export interface ActiveStoryEvent {
  /** 事件 ID */
  id: string;
  /** 事件定义 */
  def: StoryEventDef;
  /** 当前行索引 */
  currentLine: number;
  /** 是否已完成 */
  completed: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 剧情事件数据
// ═══════════════════════════════════════════════════════════════

/** 所有剧情事件定义 */
export const STORY_EVENT_DEFINITIONS: StoryEventDef[] = [
  // ─── 招募触发剧情 ────────────────────────────────────
  {
    id: 'story_zhugeliang_recruit',
    title: '三顾茅庐',
    description: '刘备三顾茅庐请诸葛亮出山',
    trigger: { type: 'recruit', targetId: 'zhugeliang' },
    oneTime: true,
    reward: { intelligence: 5 },
    lines: [
      { speaker: '旁白', text: '刘备三次前往隆中拜访，终于见到了卧龙先生。', narration: '隆中草庐，竹林掩映，清幽雅致。' },
      { speaker: '刘备', text: '先生！备三顾茅庐，只为求先生出山相助！天下苍生苦乱久矣，恳请先生怜悯！' },
      { speaker: '诸葛亮', text: '……', narration: '诸葛亮轻摇羽扇，目光深邃。' },
      { speaker: '诸葛亮', text: '亮久居隆中，本欲苟全性命于乱世。但主公三顾之恩，亮若再辞，便是不识抬举了。' },
      { speaker: '诸葛亮', text: '亮愿献隆中对之策——北让曹操，东和孙权，南据荆益，待机而动，则霸业可成！' },
      { speaker: '刘备', text: '先生大才！备得先生，如鱼得水！从此以后，备与先生共图大业！' },
      { speaker: '旁白', text: '自此，诸葛亮出山辅佐刘备，开始了波澜壮阔的三国征程。', narration: '隆中对策，千古传颂。' },
    ],
  },
  {
    id: 'story_guanyu_recruit',
    title: '桃园结义',
    description: '刘关张桃园三结义，共图大业',
    trigger: { type: 'recruit', targetId: 'guanyu' },
    oneTime: true,
    reward: { charisma: 5 },
    lines: [
      { speaker: '旁白', text: '春日桃花盛开，刘备、关羽、张飞三人于桃园中结为异姓兄弟。', narration: '桃花如雪飘落，三人跪拜天地。' },
      { speaker: '刘备', text: '我三人虽然异姓，既结为兄弟，则同心协力，救困扶危，上报国家，下安黎庶。' },
      { speaker: '关羽', text: '关某誓愿追随兄长，不避艰险，终生不渝！' },
      { speaker: '张飞', text: '俺张飞虽然粗鲁，但忠义之心不输任何人！大哥二哥，俺这条命就是你们的了！' },
      { speaker: '三人', text: '不求同年同月同日生，但愿同年同月同日死！皇天后土，实鉴此心！' },
      { speaker: '旁白', text: '桃园三结义，成为千古佳话。三兄弟从此患难与共，开创了蜀汉基业。' },
    ],
  },
  {
    id: 'story_zhaoyun_recruit',
    title: '子龙来投',
    description: '赵云投奔刘备，忠心耿耿',
    trigger: { type: 'recruit', targetId: 'zhaoyun' },
    oneTime: true,
    reward: { strength: 5 },
    lines: [
      { speaker: '旁白', text: '常山赵子龙，一身是胆，闻名天下。今日前来投奔刘备。', narration: '赵云一身银甲，英姿飒爽。' },
      { speaker: '赵云', text: '常山赵子龙，久仰皇叔仁德之名，特来投奔。愿为皇叔效犬马之劳，万死不辞！' },
      { speaker: '刘备', text: '子龙将军！备早闻将军威名，今日得见，三生有幸！请受备一拜！' },
      { speaker: '赵云', text: '皇叔折煞子龙了。子龙此来，只愿追随明主，为天下太平尽一份力。' },
      { speaker: '刘备', text: '有子龙相助，如虎添翼！来人，设宴款待子龙将军！' },
    ],
  },
  {
    id: 'story_caocao_recruit',
    title: '孟德之志',
    description: '曹操展现其雄心壮志',
    trigger: { type: 'recruit', targetId: 'caocao' },
    oneTime: true,
    reward: { leadership: 5 },
    lines: [
      { speaker: '旁白', text: '曹操，字孟德，沛国谯县人。少时机警过人，被誉为"治世之能臣，乱世之奸雄"。', narration: '曹操目光如炬，气度不凡。' },
      { speaker: '曹操', text: '对酒当歌，人生几何？譬如朝露，去日苦多。然则，正因人生苦短，更当做一番大事业！' },
      { speaker: '曹操', text: '吾任天下之智力，以道御之，无所不可。天下英才，皆为我所用！' },
      { speaker: '曹操', text: '设使国家无有孤，不知当几人称帝，几人称王。这天下，终需有人来收拾。' },
      { speaker: '旁白', text: '曹操的雄心壮志，如同烈火般燃烧。乱世之中，他将成为最强大的诸侯之一。' },
    ],
  },
  {
    id: 'story_lvbu_recruit',
    title: '飞将来降',
    description: '吕布归降，天下震动',
    trigger: { type: 'recruit', targetId: 'lvbu' },
    oneTime: true,
    reward: { strength: 5 },
    lines: [
      { speaker: '旁白', text: '人中吕布，马中赤兔。天下第一武将前来归降！', narration: '吕布骑赤兔马，持方天画戟，威风凛凛。' },
      { speaker: '吕布', text: '俺吕布天下无敌！但天下之大，也不能一直四处漂泊。你若有诚意，俺便为你效力。' },
      { speaker: '吕布', text: '不过丑话说在前头——俺只认实力。若你不能让俺心服口服，俺随时会走。' },
      { speaker: '旁白', text: '吕布虽勇冠三军，但反复无常。如何驾驭这位天下第一武将，考验着主公的智慧。' },
    ],
  },

  // ─── 领土触发剧情 ────────────────────────────────────
  {
    id: 'story_first_territory',
    title: '立业之基',
    description: '征服第一块领土，建立基业',
    trigger: { type: 'territory', threshold: 1 },
    oneTime: true,
    reward: { gold: 200 },
    lines: [
      { speaker: '旁白', text: '经过艰苦奋战，终于征服了第一块领土！这是霸业的起点。', narration: '旌旗飘扬，将士欢呼。' },
      { speaker: '众将', text: '恭喜主公！基业已成，从此有了立足之地！' },
      { speaker: '旁白', text: '这只是开始。天下十三州，等待着英雄去征服。路漫漫其修远兮，吾将上下而求索。' },
    ],
  },
  {
    id: 'story_five_territories',
    title: '割据一方',
    description: '征服五块领土，成为一方诸侯',
    trigger: { type: 'territory', threshold: 5 },
    oneTime: true,
    reward: { gold: 500, troops: 200 },
    lines: [
      { speaker: '旁白', text: '五块领土已下，主公之名，传遍四方。天下诸侯，再不敢小觑。', narration: '版图日扩，百姓安居。' },
      { speaker: '谋士', text: '主公如今已割据一方，兵精粮足。当趁势而起，图谋更大基业！' },
      { speaker: '旁白', text: '然而，树大招风。其他诸侯也已虎视眈眈，更大的挑战正在前方等待。' },
    ],
  },

  // ─── 战斗胜利触发 ────────────────────────────────────
  {
    id: 'story_first_battle_win',
    title: '初战告捷',
    description: '赢得第一场战斗胜利',
    trigger: { type: 'battle_win', threshold: 1 },
    oneTime: true,
    reward: { troops: 50 },
    lines: [
      { speaker: '旁白', text: '首战告捷！将士们士气大振。', narration: '战场上硝烟弥漫，胜利的号角响彻云霄。' },
      { speaker: '武将', text: '主公威武！敌军已被击溃，我军大获全胜！' },
      { speaker: '旁白', text: '这只是万里长征的第一步。前方还有更多强敌等着你去征服。' },
    ],
  },
  {
    id: 'story_ten_battles',
    title: '百战之师',
    description: '赢得十场战斗胜利',
    trigger: { type: 'battle_win', threshold: 10 },
    oneTime: true,
    reward: { troops: 200, gold: 300 },
    lines: [
      { speaker: '旁白', text: '十战十胜！主公的军队已是百战精锐，天下闻名。', narration: '将士们身经百战，气势如虹。' },
      { speaker: '老将', text: '末将跟随主公征战四方，从未败绩。主公用兵如神，末将佩服！' },
      { speaker: '旁白', text: '然而真正的考验还在后面。北有曹操百万雄兵，东有孙权水军虎视。统一天下，任重道远。' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 剧情事件系统类
// ═══════════════════════════════════════════════════════════════

/**
 * 武将剧情事件系统
 *
 * 管理剧情事件的触发、播放和完成状态。
 */
export class GeneralStoryEventSystem {
  /** 已触发的一次性事件 ID */
  private triggeredEvents: Set<string> = new Set();
  /** 当前活跃的剧情事件 */
  private activeEvent: ActiveStoryEvent | null = null;
  /** 待显示的剧情事件队列 */
  private eventQueue: StoryEventDef[] = [];

  constructor() {}

  /**
   * 检查是否有符合条件的剧情事件
   *
   * @param trigger - 触发条件
   * @param value - 当前值（如已招募武将数、领土数等）
   */
  checkTriggers(trigger: Partial<StoryTrigger>, value?: number): void {
    for (const def of STORY_EVENT_DEFINITIONS) {
      // 跳过已触发的一次性事件
      if (def.oneTime && this.triggeredEvents.has(def.id)) continue;
      // 跳过当前正在播放或已在队列中的事件
      if (this.activeEvent?.id === def.id) continue;
      if (this.eventQueue.some(e => e.id === def.id)) continue;

      let matched = false;
      if (def.trigger.type === trigger.type) {
        switch (trigger.type) {
          case 'recruit':
            matched = def.trigger.targetId === trigger.targetId;
            break;
          case 'battle_win':
          case 'territory':
            matched = (value ?? 0) >= (def.trigger.threshold ?? Infinity);
            break;
          case 'bond':
            matched = def.trigger.targetId === trigger.targetId;
            break;
          case 'time':
            matched = (value ?? 0) >= (def.trigger.threshold ?? Infinity);
            break;
        }
      }

      if (matched) {
        this.eventQueue.push(def);
        if (def.oneTime) {
          this.triggeredEvents.add(def.id);
        }
      }
    }
  }

  /**
   * 获取下一个待播放的剧情事件
   */
  getNextEvent(): ActiveStoryEvent | null {
    if (this.activeEvent && !this.activeEvent.completed) {
      return this.activeEvent;
    }

    if (this.eventQueue.length === 0) return null;

    const def = this.eventQueue.shift()!;
    this.activeEvent = {
      id: def.id,
      def,
      currentLine: 0,
      completed: false,
    };
    return this.activeEvent;
  }

  /**
   * 推进当前剧情事件到下一行
   *
   * @returns 是否还有下一行
   */
  advanceLine(): boolean {
    if (!this.activeEvent || this.activeEvent.completed) return false;

    this.activeEvent.currentLine++;
    if (this.activeEvent.currentLine >= this.activeEvent.def.lines.length) {
      this.activeEvent.completed = true;
      return false;
    }
    return true;
  }

  /**
   * 获取当前对话行
   */
  getCurrentLine(): StoryLine | null {
    if (!this.activeEvent || this.activeEvent.completed) return null;
    return this.activeEvent.def.lines[this.activeEvent.currentLine] ?? null;
  }

  /**
   * 完成当前事件并获取奖励
   */
  completeCurrentEvent(): Record<string, number> | null {
    if (!this.activeEvent) return null;
    const reward = this.activeEvent.def.reward ?? null;
    this.activeEvent = null;
    return reward;
  }

  /**
   * 跳过当前事件
   */
  skipCurrentEvent(): void {
    this.activeEvent = null;
  }

  /**
   * 是否有活跃的剧情事件
   */
  hasActiveEvent(): boolean {
    return this.activeEvent !== null && !this.activeEvent.completed;
  }

  /**
   * 是否有待播放的事件
   */
  hasQueuedEvents(): boolean {
    return this.eventQueue.length > 0 || this.hasActiveEvent();
  }

  /**
   * 序列化状态
   */
  serialize(): { triggeredEvents: string[] } {
    return {
      triggeredEvents: Array.from(this.triggeredEvents),
    };
  }

  /**
   * 反序列化状态
   */
  deserialize(data: { triggeredEvents: string[] }): void {
    this.triggeredEvents = new Set(data.triggeredEvents ?? []);
  }
}

/**
 * 创建剧情事件系统实例
 */
export function createGeneralStoryEventSystem(): GeneralStoryEventSystem {
  return new GeneralStoryEventSystem();
}
