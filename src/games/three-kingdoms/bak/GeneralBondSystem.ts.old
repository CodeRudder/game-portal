/**
 * 武将羁绊系统 — 三国特色羁绊与互动事件
 *
 * 定义武将之间的羁绊关系（如桃园三结义、五虎上将等），
 * 当特定武将同时在场时触发特殊对话和加成效果。
 *
 * @module games/three-kingdoms/GeneralBondSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 羁绊等级 */
export type BondTier = 'sworn' | 'comrade' | 'rival' | 'mentor';

/** 羁绊定义 */
export interface BondDef {
  /** 羁绊 ID */
  id: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊描述 */
  description: string;
  /** 羁绊等级 */
  tier: BondTier;
  /** 涉及的武将 ID 列表 */
  generalIds: string[];
  /** 羁绊加成效果 */
  bonus: Record<string, number>;
  /** 羁绊触发对话 */
  dialogue: BondDialogue[];
}

/** 羁绊对话 */
export interface BondDialogue {
  /** 触发场景 */
  trigger: 'idle' | 'battle' | 'recruit' | 'bond_activate' | 'bond_chat';
  /** 对话内容（轮流发言） */
  lines: Array<{ speaker: string; text: string }>;
}

/** 羁绊激活结果 */
export interface BondActivationResult {
  /** 羁绊 ID */
  bondId: string;
  /** 羁绊名称 */
  bondName: string;
  /** 是否为新激活 */
  newlyActivated: boolean;
  /** 触发的对话 */
  dialogue: BondDialogue | null;
  /** 加成效果 */
  bonus: Record<string, number>;
}

/** 武将互动请求 */
export interface GeneralRequest {
  /** 请求 ID */
  id: string;
  /** 发起请求的武将 ID */
  generalId: string;
  /** 武将名称 */
  generalName: string;
  /** 请求类型 */
  type: 'battle' | 'resource' | 'recruit' | 'explore';
  /** 请求标题 */
  title: string;
  /** 请求内容 */
  content: string;
  /** 请求奖励 */
  reward?: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// 羁绊数据
// ═══════════════════════════════════════════════════════════════

/** 所有羁绊定义 */
export const BOND_DEFINITIONS: BondDef[] = [
  // ─── 蜀国羁绊 ────────────────────────────────────────
  {
    id: 'peach_garden_oath',
    name: '桃园三结义',
    description: '刘备、关羽、张飞桃园结义，义薄云天',
    tier: 'sworn',
    generalIds: ['liubei', 'guanyu', 'zhangfei'],
    bonus: { leadership: 15, charisma: 10 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '刘备', text: '备与二弟三弟，虽非同生，愿同死！桃园之义，永世不忘！' },
          { speaker: '关羽', text: '关某此生，唯兄长之命是从。忠义二字，重于泰山！' },
          { speaker: '张飞', text: '俺张飞虽然粗鲁，但大哥二哥的话，俺句句听！谁敢欺负俺兄弟，俺跟他拼命！' },
        ],
      },
      {
        trigger: 'bond_chat',
        lines: [
          { speaker: '刘备', text: '回想当年桃园结义，恍如昨日。二弟三弟，备有你们，是此生最大的幸运。' },
          { speaker: '关羽', text: '兄长言重了。能追随兄长，才是关某的福分。' },
          { speaker: '张飞', text: '嘿嘿，俺不会说好听的话，但俺知道——兄弟在一起，比什么都强！' },
        ],
      },
      {
        trigger: 'battle',
        lines: [
          { speaker: '刘备', text: '兄弟们！随我冲锋！今日之战，为天下苍生而战！' },
          { speaker: '关羽', text: '青龙偃月刀在手，关某愿为先锋！' },
          { speaker: '张飞', text: '哈哈哈！俺等这一天很久了！杀啊！' },
        ],
      },
    ],
  },
  {
    id: 'five_tiger_generals',
    name: '五虎上将',
    description: '关羽、张飞、赵云、马超、黄忠——蜀汉五虎上将',
    tier: 'comrade',
    generalIds: ['guanyu', 'zhangfei', 'zhaoyun', 'machao', 'huangzhong'],
    bonus: { strength: 20, leadership: 10 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '关羽', text: '五位虎将齐聚，天下谁人能敌！' },
          { speaker: '赵云', text: '子龙愿与众位将军并肩作战，共保汉室！' },
          { speaker: '马超', text: '西凉马超，能与诸位英雄共事，三生有幸！' },
          { speaker: '黄忠', text: '老夫虽年迈，箭术不输当年！五虎之名，当之无愧！' },
          { speaker: '张飞', text: '哈哈哈！五个打一个，谁敢来战！' },
        ],
      },
      {
        trigger: 'bond_chat',
        lines: [
          { speaker: '赵云', text: '关将军武艺超群，子龙佩服。改日可否切磋一二？' },
          { speaker: '关羽', text: '子龙过谦了。长坂坡七进七出，关某也自叹不如。' },
          { speaker: '黄忠', text: '你们年轻人互相谦让，老夫可不服老！百步穿杨可不是吹的。' },
          { speaker: '马超', text: '黄老将军神射天下闻名，超在西北亦有耳闻。' },
        ],
      },
    ],
  },
  {
    id: 'zhuge_liang_liubei',
    name: '如鱼得水',
    description: '刘备三顾茅庐，得诸葛亮如鱼得水',
    tier: 'mentor',
    generalIds: ['liubei', 'zhugeliang'],
    bonus: { intelligence: 20, charisma: 5 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '刘备', text: '孤得先生，如鱼得水！有先生辅佐，汉室复兴有望！' },
          { speaker: '诸葛亮', text: '亮蒙主公三顾之恩，敢不竭尽心力以报？鞠躬尽瘁，死而后已！' },
        ],
      },
      {
        trigger: 'bond_chat',
        lines: [
          { speaker: '刘备', text: '先生，近日军务繁忙，还请保重身体。' },
          { speaker: '诸葛亮', text: '多谢主公关心。亮观天象，近日或有变局，需早做准备。' },
          { speaker: '刘备', text: '一切但凭先生做主。备对先生，言听计从。' },
        ],
      },
      {
        trigger: 'battle',
        lines: [
          { speaker: '诸葛亮', text: '主公勿忧，亮已有破敌之策。八阵图已成，只待敌军入瓮。' },
          { speaker: '刘备', text: '有先生在此，备安心矣！全军听令，依军师之计行事！' },
        ],
      },
    ],
  },
  {
    id: 'zhaooyun_protect',
    name: '忠心护主',
    description: '赵云对刘备忠心耿耿，万死不辞',
    tier: 'sworn',
    generalIds: ['liubei', 'zhaoyun'],
    bonus: { strength: 10, leadership: 10 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '赵云', text: '主公以国士待云，云必以国士报之！赴汤蹈火，万死不辞！' },
          { speaker: '刘备', text: '子龙忠义，备深知之。有子龙在侧，备高枕无忧。' },
        ],
      },
      {
        trigger: 'battle',
        lines: [
          { speaker: '赵云', text: '主公先行，子龙断后！纵有千军万马，休想伤主公分毫！' },
          { speaker: '刘备', text: '子龙小心！备等你平安归来！' },
        ],
      },
    ],
  },

  // ─── 魏国羁绊 ────────────────────────────────────────
  {
    id: 'caocao_xuchu',
    name: '虎卫忠心',
    description: '许褚忠心护卫曹操，形影不离',
    tier: 'sworn',
    generalIds: ['caocao', 'xuchu'],
    bonus: { strength: 10, leadership: 5 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '曹操', text: '仲康忠勇，操深知之。有你在侧，操安如泰山。' },
          { speaker: '许褚', text: '主公放心！只要俺许褚还有一口气在，谁也别想伤害主公！' },
        ],
      },
      {
        trigger: 'bond_chat',
        lines: [
          { speaker: '曹操', text: '仲康，今日可有异常？' },
          { speaker: '许褚', text: '回主公，一切正常！俺把守卫都安排好了，苍蝇都飞不进来！' },
          { speaker: '曹操', text: '好。有你守卫，操可以安心谋划大事了。' },
        ],
      },
      {
        trigger: 'battle',
        lines: [
          { speaker: '许褚', text: '主公退后！让俺来对付这些家伙！' },
          { speaker: '曹操', text: '仲康小心！今日破敌，论功行赏！' },
        ],
      },
    ],
  },

  // ─── 吴国羁绊 ────────────────────────────────────────
  {
    id: 'sunquan_zhouyu',
    name: '江东双璧',
    description: '孙权与周瑜，君臣相得，共保江东',
    tier: 'mentor',
    generalIds: ['sunquan', 'zhouyu'],
    bonus: { intelligence: 15, leadership: 10 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '孙权', text: '公瑾之才，天下皆知。有公瑾辅佐，江东无忧矣。' },
          { speaker: '周瑜', text: '主公知遇之恩，瑜没齿难忘。愿为江东基业，竭尽所能。' },
        ],
      },
      {
        trigger: 'bond_chat',
        lines: [
          { speaker: '孙权', text: '公瑾，近日曹操在北方蠢蠢欲动，你有何良策？' },
          { speaker: '周瑜', text: '主公勿虑。瑜已有一计，只需东风一起，便可火烧赤壁，大破曹军！' },
          { speaker: '孙权', text: '好！就依公瑾之计！江东的将来，全赖你了。' },
        ],
      },
      {
        trigger: 'battle',
        lines: [
          { speaker: '周瑜', text: '众将听令！今日赤壁之战，以火攻破敌！谈笑间，樯橹灰飞烟灭！' },
          { speaker: '孙权', text: '江东儿郎们，随孤迎战！保我东吴基业！' },
        ],
      },
    ],
  },

  // ─── 跨阵营羁绊 ──────────────────────────────────────
  {
    id: 'rival_heros',
    name: '天下英雄',
    description: '刘备与曹操，英雄惜英雄',
    tier: 'rival',
    generalIds: ['liubei', 'caocao'],
    bonus: { intelligence: 10, charisma: 10 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '曹操', text: '天下英雄，唯使君与操耳！今日得见，果然名不虚传。' },
          { speaker: '刘备', text: '丞相过奖了。备虽不才，但匡扶汉室之心，矢志不渝。' },
          { speaker: '曹操', text: '哈哈！好一个匡扶汉室！你我各为其主，终有一战。但今日，且共饮此杯。' },
        ],
      },
      {
        trigger: 'bond_chat',
        lines: [
          { speaker: '曹操', text: '玄德，你说天下大势，将走向何方？' },
          { speaker: '刘备', text: '天下大势，分久必合，合久必分。但无论何时，百姓安乐才是根本。' },
          { speaker: '曹操', text: '说得好。你我虽是对手，但你这份仁心，操是佩服的。' },
        ],
      },
    ],
  },
  {
    id: 'god_of_war',
    name: '武神之争',
    description: '吕布与关羽，当世两大武神的对决',
    tier: 'rival',
    generalIds: ['lvbu', 'guanyu'],
    bonus: { strength: 15 },
    dialogue: [
      {
        trigger: 'bond_activate',
        lines: [
          { speaker: '吕布', text: '关羽！听说你是天下义士？俺吕布倒要看看，你的刀有多快！' },
          { speaker: '关羽', text: '吕布，你虽有万夫不当之勇，但忠义二字，你远远不及。' },
          { speaker: '吕布', text: '哼！忠义？实力才是硬道理！来吧，让俺看看你的本事！' },
        ],
      },
      {
        trigger: 'battle',
        lines: [
          { speaker: '吕布', text: '关羽！今日便让你见识天下第一武将的厉害！' },
          { speaker: '关羽', text: '吕布，关某的青龙偃月刀早已饥渴难耐了！' },
        ],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 武将互动请求数据
// ═══════════════════════════════════════════════════════════════

/** 武将互动请求模板 */
export const GENERAL_REQUEST_TEMPLATES: Omit<GeneralRequest, 'id'>[] = [
  {
    generalId: 'zhangfei',
    generalName: '张飞',
    type: 'battle',
    title: '请战出征',
    content: '主公！俺老张手痒得很，前方有敌军出没，让俺去收拾他们吧！',
    reward: { troops: 100 },
  },
  {
    generalId: 'guanyu',
    generalName: '关羽',
    type: 'explore',
    title: '巡查边境',
    content: '关某愿前往边境巡查，以防敌军偷袭。请主公恩准。',
    reward: { intel: 5 },
  },
  {
    generalId: 'zhugeliang',
    generalName: '诸葛亮',
    type: 'resource',
    title: '筹集军资',
    content: '亮观天时，近日宜积蓄力量。请主公加紧筹集粮草军资，以备不时之需。',
    reward: { grain: 200 },
  },
  {
    generalId: 'zhaoyun',
    generalName: '赵云',
    type: 'explore',
    title: '侦察敌情',
    content: '主公，子龙愿率斥候前往敌营侦察，获取军情以助决策。',
    reward: { intel: 10 },
  },
  {
    generalId: 'caocao',
    generalName: '曹操',
    type: 'resource',
    title: '招揽人才',
    content: '天下英才何其多！孟德愿亲自出马，招揽四方贤才为我所用。',
    reward: { gold: 150 },
  },
  {
    generalId: 'lvbu',
    generalName: '吕布',
    type: 'battle',
    title: '挑战强敌',
    content: '哼！天下英雄都是废物！俺吕布要去前方找真正的对手！谁敢拦我？',
    reward: { troops: 150 },
  },
  {
    generalId: 'sunquan',
    generalName: '孙权',
    type: 'resource',
    title: '发展水军',
    content: '江东水军天下无敌，但还需加强训练。请拨些资源，仲谋定不负所托。',
    reward: { gold: 100 },
  },
  {
    generalId: 'zhouyu',
    generalName: '周瑜',
    type: 'battle',
    title: '火攻之策',
    content: '瑜有一计，可大破敌军。只需主公一声令下，瑜便着手准备火攻之事。',
    reward: { troops: 80 },
  },
  {
    generalId: 'machao',
    generalName: '马超',
    type: 'battle',
    title: '骑兵突击',
    content: '主公！西凉铁骑已蓄势待发，超请求率骑兵突击敌阵，一雪前耻！',
    reward: { troops: 120 },
  },
  {
    generalId: 'huangzhong',
    generalName: '黄忠',
    type: 'explore',
    title: '老将请缨',
    content: '老夫虽然年迈，但百步穿杨的本事还在！请主公给老夫一个机会，定不辱使命！',
    reward: { intel: 8 },
  },
  {
    generalId: 'xuchu',
    generalName: '许褚',
    type: 'battle',
    title: '护卫请战',
    content: '主公！俺许褚天天守在这里都快发霉了！让俺出去打一架吧！求您了！',
    reward: { troops: 60 },
  },
  {
    generalId: 'liubei',
    generalName: '刘备',
    type: 'recruit',
    title: '寻访贤才',
    content: '备闻附近有贤才隐居，愿亲自前往寻访。求贤若渴，望天助我也。',
    reward: { gold: 80 },
  },
];

// ═══════════════════════════════════════════════════════════════
// 武将羁绊系统类
// ═══════════════════════════════════════════════════════════════

/**
 * 武将羁绊系统
 *
 * 管理武将之间的羁绊关系，检测羁绊激活条件，
 * 并生成羁绊对话和互动请求。
 */
export class GeneralBondSystem {
  /** 已激活的羁绊 ID 集合 */
  private activatedBonds: Set<string> = new Set();
  /** 羁绊定义缓存 */
  private bonds: Map<string, BondDef> = new Map();
  /** 上次闲聊时间戳 */
  private lastBondChatTime: number = 0;
  /** 请求计数器 */
  private requestCounter: number = 0;

  constructor() {
    for (const bond of BOND_DEFINITIONS) {
      this.bonds.set(bond.id, bond);
    }
  }

  /**
   * 检查并激活符合条件的羁绊
   *
   * @param recruitedGeneralIds - 已招募的武将 ID 列表
   * @returns 新激活的羁绊结果列表
   */
  checkAndActivateBonds(recruitedGeneralIds: string[]): BondActivationResult[] {
    const results: BondActivationResult[] = [];
    const recruitedSet = new Set(recruitedGeneralIds);

    for (const [id, bond] of this.bonds) {
      const allPresent = bond.generalIds.every(gid => recruitedSet.has(gid));
      const wasActivated = this.activatedBonds.has(id);

      if (allPresent && !wasActivated) {
        // 新激活羁绊
        this.activatedBonds.add(id);
        const dialogue = bond.dialogue.find(d => d.trigger === 'bond_activate') ?? null;
        results.push({
          bondId: id,
          bondName: bond.name,
          newlyActivated: true,
          dialogue,
          bonus: { ...bond.bonus },
        });
      } else if (allPresent && wasActivated) {
        // 已激活，不重复触发
        results.push({
          bondId: id,
          bondName: bond.name,
          newlyActivated: false,
          dialogue: null,
          bonus: { ...bond.bonus },
        });
      }
    }

    return results;
  }

  /**
   * 获取所有已激活羁绊的总加成
   */
  getTotalBondBonus(): Record<string, number> {
    const total: Record<string, number> = {};
    for (const bondId of this.activatedBonds) {
      const bond = this.bonds.get(bondId);
      if (bond) {
        for (const [key, value] of Object.entries(bond.bonus)) {
          total[key] = (total[key] || 0) + value;
        }
      }
    }
    return total;
  }

  /**
   * 获取已激活羁绊的战斗对话
   */
  getBattleDialogue(recruitedGeneralIds: string[]): BondDialogue | null {
    const recruitedSet = new Set(recruitedGeneralIds);
    const candidates: BondDialogue[] = [];

    for (const bondId of this.activatedBonds) {
      const bond = this.bonds.get(bondId);
      if (!bond) continue;
      const allPresent = bond.generalIds.every(gid => recruitedSet.has(gid));
      if (allPresent) {
        const battleDlg = bond.dialogue.find(d => d.trigger === 'battle');
        if (battleDlg) candidates.push(battleDlg);
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 获取羁绊闲聊对话（带冷却时间）
   *
   * @param currentTime - 当前时间戳（秒）
   * @param cooldown - 冷却时间（秒），默认 60
   */
  getBondChatDialogue(
    recruitedGeneralIds: string[],
    currentTime: number,
    cooldown: number = 60,
  ): BondDialogue | null {
    if (currentTime - this.lastBondChatTime < cooldown) return null;

    const recruitedSet = new Set(recruitedGeneralIds);
    const candidates: BondDialogue[] = [];

    for (const bondId of this.activatedBonds) {
      const bond = this.bonds.get(bondId);
      if (!bond) continue;
      const allPresent = bond.generalIds.every(gid => recruitedSet.has(gid));
      if (allPresent) {
        const chatDlg = bond.dialogue.find(d => d.trigger === 'bond_chat');
        if (chatDlg) candidates.push(chatDlg);
      }
    }

    if (candidates.length === 0) return null;
    this.lastBondChatTime = currentTime;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 生成随机武将请求
   *
   * @param recruitedGeneralIds - 已招募的武将 ID 列表
   * @returns 武将请求，或 null
   */
  generateRandomRequest(recruitedGeneralIds: string[]): GeneralRequest | null {
    const recruitedSet = new Set(recruitedGeneralIds);
    const available = GENERAL_REQUEST_TEMPLATES.filter(t => recruitedSet.has(t.generalId));
    if (available.length === 0) return null;

    const template = available[Math.floor(Math.random() * available.length)];
    this.requestCounter++;
    return {
      ...template,
      id: `request_${this.requestCounter}_${Date.now()}`,
    };
  }

  /**
   * 获取所有已激活的羁绊信息
   */
  getActivatedBonds(): BondDef[] {
    return Array.from(this.activatedBonds)
      .map(id => this.bonds.get(id))
      .filter((b): b is BondDef => b !== undefined);
  }

  /**
   * 获取指定武将相关的所有羁绊
   */
  getBondsForGeneral(generalId: string): BondDef[] {
    return BOND_DEFINITIONS.filter(b => b.generalIds.includes(generalId));
  }

  /**
   * 检查羁绊是否已激活
   */
  isBondActivated(bondId: string): boolean {
    return this.activatedBonds.has(bondId);
  }

  /**
   * 序列化状态
   */
  serialize(): { activatedBonds: string[]; requestCounter: number } {
    return {
      activatedBonds: Array.from(this.activatedBonds),
      requestCounter: this.requestCounter,
    };
  }

  /**
   * 反序列化状态
   */
  deserialize(data: { activatedBonds: string[]; requestCounter: number }): void {
    this.activatedBonds = new Set(data.activatedBonds);
    this.requestCounter = data.requestCounter ?? 0;
  }
}

/**
 * 创建武将羁绊系统实例
 */
export function createGeneralBondSystem(): GeneralBondSystem {
  return new GeneralBondSystem();
}
