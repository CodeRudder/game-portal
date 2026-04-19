/**
 * 三国霸业 — 新手引导与剧情触发系统
 *
 * 提供两套并行机制：
 *   1. Tutorial（新手引导）— 6 步线性引导，帮助玩家上手核心玩法
 *   2. Story（剧情事件）— 8 个经典三国剧情，按触发条件自动弹出
 * 支持序列化/反序列化，可随存档一起持久化。
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export type TriggerType =
  | 'first_building' | 'first_recruit' | 'first_battle' | 'first_conquer'
  | 'first_research' | 'level_up' | 'hero_count' | 'territory_count';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  highlightTarget?: string;
  action?: string;
  isCompleted: boolean;
}

export interface StoryEvent {
  id: string;
  title: string;
  dialogue: { speaker: string; text: string; portrait?: string }[];
  trigger: TriggerType;
  triggerValue?: number;
  reward?: { food?: number; gold?: number; troops?: number; heroId?: string };
  isTriggered: boolean;
  priority: number;
}

// ═══════════════════════════════════════════════════════════════
// 系统实现
// ═══════════════════════════════════════════════════════════════

export class TutorialStorySystem {
  private tutorialSteps: TutorialStep[];
  private storyEvents: StoryEvent[];
  private completedTutorial: boolean;
  private triggeredStories: Set<string>;

  constructor() {
    this.tutorialSteps = [];
    this.storyEvents = [];
    this.completedTutorial = false;
    this.triggeredStories = new Set();
    this.initTutorial();
    this.initStoryEvents();
  }

  /** 初始化 6 步新手引导 */
  initTutorial(): void {
    this.tutorialSteps = [
      { id: 't01', title: '欢迎来到三国', description: '主公，乱世已至，请建造第一座农田以稳固根基', highlightTarget: 'btn-build-farm', action: 'build:farm', isCompleted: false },
      { id: 't02', title: '招募武将', description: '有了粮草，便可招募武将助阵', highlightTarget: 'btn-recruit', action: 'recruit', isCompleted: false },
      { id: 't03', title: '首次出征', description: '武将已就位，发起第一场战斗吧！', highlightTarget: 'btn-battle', action: 'battle', isCompleted: false },
      { id: 't04', title: '征服领土', description: '战斗胜利！尝试征服新的领土', highlightTarget: 'btn-conquer', action: 'conquer', isCompleted: false },
      { id: 't05', title: '科技研究', description: '研发科技可以增强国力', highlightTarget: 'btn-research', action: 'research', isCompleted: false },
      { id: 't06', title: '继续扩张', description: '主公已掌握基本操作，继续扩张版图吧！', isCompleted: false },
    ];
  }

  /** 初始化 8 个经典剧情事件 */
  initStoryEvents(): void {
    this.storyEvents = [
      {
        id: 's01', title: '桃园结义', trigger: 'first_recruit', reward: { heroId: 'guanyu' }, isTriggered: false, priority: 1,
        dialogue: [
          { speaker: '刘备', text: '我虽力薄，愿与二位同心协力，上报国家，下安黎庶。', portrait: 'liubei' },
          { speaker: '关羽', text: '关某之愿也！自此以后，生死相随！', portrait: 'guanyu' },
          { speaker: '张飞', text: '俺也一样！今日结为兄弟，永不反悔！', portrait: 'zhangfei' },
        ],
      },
      {
        id: 's02', title: '黄巾起义', trigger: 'first_battle', reward: { food: 200, gold: 100 }, isTriggered: false, priority: 2,
        dialogue: [
          { speaker: '张角', text: '苍天已死，黄天当立！天下百姓苦汉室久矣！', portrait: 'zhangjiao' },
          { speaker: '旁白', text: '黄巾军四处作乱，百姓流离失所，正是英雄用武之时。' },
        ],
      },
      {
        id: 's03', title: '三顾茅庐', trigger: 'hero_count', triggerValue: 3, reward: { heroId: 'zhugeliang' }, isTriggered: false, priority: 3,
        dialogue: [
          { speaker: '刘备', text: '备虽名微德薄，愿先生不弃鄙贱，出山相助。', portrait: 'liubei' },
          { speaker: '诸葛亮', text: '将军既不嫌弃，亮愿效犬马之劳。', portrait: 'zhugeliang' },
          { speaker: '旁白', text: '自此，卧龙出山，三分天下之势渐成。' },
        ],
      },
      {
        id: 's04', title: '挟天子', trigger: 'territory_count', triggerValue: 3, reward: { gold: 500 }, isTriggered: false, priority: 4,
        dialogue: [
          { speaker: '曹操', text: '吾挟天子以令诸侯，此乃霸业之基也。', portrait: 'caocao' },
          { speaker: '旁白', text: '曹操迎献帝于许都，自此号令天下，莫敢不从。' },
        ],
      },
      {
        id: 's05', title: '赤壁风云', trigger: 'level_up', triggerValue: 5, reward: { troops: 200 }, isTriggered: false, priority: 5,
        dialogue: [
          { speaker: '周瑜', text: '万事俱备，只欠东风！', portrait: 'zhouyu' },
          { speaker: '诸葛亮', text: '亮已借得东风，都督可下令火攻！', portrait: 'zhugeliang' },
          { speaker: '旁白', text: '赤壁一把大火，烧尽曹军百万雄师，三分之势已成。' },
        ],
      },
      {
        id: 's06', title: '草船借箭', trigger: 'first_research', reward: { gold: 300 }, isTriggered: false, priority: 6,
        dialogue: [
          { speaker: '诸葛亮', text: '只需三日，亮便可得十万支箭。', portrait: 'zhugeliang' },
          { speaker: '鲁肃', text: '先生此计当真妙不可言！', portrait: 'lushu' },
          { speaker: '旁白', text: '大雾弥漫，草船满载而归，曹操白送十万支箭。' },
        ],
      },
      {
        id: 's07', title: '过五关斩六将', trigger: 'hero_count', triggerValue: 5, reward: { heroId: 'zhaoyun' }, isTriggered: false, priority: 7,
        dialogue: [
          { speaker: '关羽', text: '关某虽千里之遥，终当归还兄长身边！', portrait: 'guanyu' },
          { speaker: '旁白', text: '关羽挂印封金，过五关斩六将，忠义之名传遍天下。' },
        ],
      },
      {
        id: 's08', title: '天下大势', trigger: 'territory_count', triggerValue: 10, reward: { food: 1000, gold: 1000, troops: 500 }, isTriggered: false, priority: 8,
        dialogue: [
          { speaker: '旁白', text: '天下大势，分久必合，合久必分。' },
          { speaker: '刘备', text: '汉室虽衰，吾辈当竭力恢复！', portrait: 'liubei' },
          { speaker: '旁白', text: '三国鼎立，群雄逐鹿，最终的胜者尚未可知……' },
        ],
      },
    ];
  }

  // ── 触发检查 ─────────────────────────────────────────────

  /**
   * 检查是否有剧情事件满足触发条件
   * @param type  触发类型
   * @param value 当前值（如英雄数量、领土数量）
   * @returns 优先级最高且满足条件的未触发事件，若无则返回 null
   */
  checkTrigger(type: TriggerType, value: number): StoryEvent | null {
    const candidates = this.storyEvents.filter(
      (e) => e.trigger === type && !e.isTriggered && (e.triggerValue === undefined || value >= e.triggerValue),
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.priority - b.priority);
    const triggered = candidates[0];
    triggered.isTriggered = true;
    this.triggeredStories.add(triggered.id);
    return triggered;
  }

  // ── 引导步骤管理 ─────────────────────────────────────────

  /** 完成指定引导步骤，返回已完成的步骤；若不存在或已完成则返回 null */
  completeStep(stepId: string): TutorialStep | null {
    const step = this.tutorialSteps.find((s) => s.id === stepId);
    if (!step || step.isCompleted) return null;
    step.isCompleted = true;
    if (this.tutorialSteps.every((s) => s.isCompleted)) {
      this.completedTutorial = true;
    }
    return step;
  }

  /** 获取当前未完成的第一个引导步骤 */
  getCurrentStep(): TutorialStep | null {
    return this.tutorialSteps.find((s) => !s.isCompleted) ?? null;
  }

  /** 引导是否全部完成 */
  isTutorialComplete(): boolean {
    return this.completedTutorial;
  }

  // ── 数据查询 ─────────────────────────────────────────────

  getTutorialSteps(): TutorialStep[] { return this.tutorialSteps; }
  getStoryEvents(): StoryEvent[] { return this.storyEvents; }
  getUntriggeredStories(): StoryEvent[] { return this.storyEvents.filter((e) => !e.isTriggered); }

  // ── 序列化 / 反序列化 ────────────────────────────────────

  serialize(): object {
    return {
      tutorialSteps: this.tutorialSteps.map((s) => ({ ...s })),
      storyEvents: this.storyEvents.map((e) => ({ ...e, dialogue: [...e.dialogue] })),
      completedTutorial: this.completedTutorial,
      triggeredStories: [...this.triggeredStories],
    };
  }

  deserialize(data: object): void {
    const d = data as {
      tutorialSteps?: TutorialStep[];
      storyEvents?: StoryEvent[];
      completedTutorial?: boolean;
      triggeredStories?: string[];
    };
    if (d.tutorialSteps) this.tutorialSteps = d.tutorialSteps.map((s) => ({ ...s }));
    if (d.storyEvents) {
      this.storyEvents = d.storyEvents.map((e) => ({
        ...e, dialogue: e.dialogue.map((line) => ({ ...line })),
      }));
    }
    if (typeof d.completedTutorial === 'boolean') this.completedTutorial = d.completedTutorial;
    if (d.triggeredStories) this.triggeredStories = new Set(d.triggeredStories);
  }
}
