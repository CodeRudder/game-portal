/**
 * 三国霸业 — NPC 交互系统
 *
 * 处理玩家与 NPC 之间的交互（交易、任务、信息、赠送、挑战），
 * 以及 NPC 之间的自动对话生成。为每种职业提供丰富的交互选项，
 * 使 NPC 感觉更加真实和有深度。
 *
 * @module games/three-kingdoms/NPCInteractionSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** NPC 交互定义 */
export interface NPCInteraction {
  /** 关联的 NPC ID */
  npcId: string;
  /** NPC 名称 */
  npcName: string;
  /** 交互类型 */
  type: 'trade' | 'quest' | 'info' | 'gift' | 'challenge';
  /** 交互标题 */
  title: string;
  /** 交互描述 */
  description: string;
  /** 交互选项 */
  options: NPCInteractionOption[];
}

/** 交互选项 */
export interface NPCInteractionOption {
  /** 选项文本 */
  text: string;
  /** 结果描述 */
  outcome: string;
  /** 获得的奖励（可选） */
  reward?: Record<string, number>;
  /** 需要花费的资源（可选） */
  cost?: Record<string, number>;
}

/** executeInteraction 返回结果 */
export interface InteractionResult {
  /** 结果描述文本 */
  result: string;
  /** 获得的奖励 */
  reward?: Record<string, number>;
  /** 受到的惩罚/花费 */
  penalty?: Record<string, number>;
  /** NPC 的对话回应 */
  dialogueResponse: string;
}

/** NPC 间对话结果 */
export interface NPCChatResult {
  /** 话题 */
  topic: string;
  /** 对话内容（轮流发言） */
  dialogue: { speaker: string; text: string }[];
}

// ═══════════════════════════════════════════════════════════════
// NPC 间对话模板库
// ═══════════════════════════════════════════════════════════════

/** 单个对话模板 */
interface ChatTemplate {
  topic: string;
  lines: [string, string, string, string];
}

/** 职业 → 职业 对话模板 */
const CHAT_TEMPLATES: Record<string, ChatTemplate[]> = {
  'farmer->soldier': [
    {
      topic: '边境安全与收成',
      lines: [
        '今年收成不错，多亏了将士们守卫边境安宁。',
        '保家卫国是我们的本分，你们安心种地就好。',
        '最近有盗匪出没吗？粮草运输路上有些担心。',
        '放心，我们加强了巡逻，保证粮道畅通无阻。',
      ],
    },
    {
      topic: '征兵与农忙',
      lines: [
        '大人，农忙时节能否暂缓征兵？田里缺人手啊。',
        '军情紧急，容不得迟缓。不过我会向上级反映。',
        '若是壮丁都走了，今年的粮草可就不够了。',
        '嗯，我尽量协调，安排轮换值守吧。',
      ],
    },
  ],
  'farmer->merchant': [
    {
      topic: '粮价与收成',
      lines: [
        '商人兄弟，今年粮价如何？',
        '托您的福，今年风调雨顺，粮价稳定，百姓都买得起。',
        '那好，我这儿新收了一批上等稻米，你看看？',
        '好说好说，咱们长期合作，价格公道。',
      ],
    },
  ],
  'soldier->merchant': [
    {
      topic: '军需物资采购',
      lines: [
        '商人，最近有没有好的铁料？兵器需要修补。',
        '有的有的，刚从外地进了一批上等镔铁。',
        '价格如何？军费有限，得精打细算。',
        '给军队的价格自然优惠，咱们长期合作嘛。',
      ],
    },
  ],
  'soldier->scholar': [
    {
      topic: '兵法与实战',
      lines: [
        '先生，兵法云「知己知彼」，可实际战场千变万化啊。',
        '正因为如此，才更需要研习兵法，以不变应万变。',
        '说得有理。您看最近边境局势如何？',
        '依我之见，应当以守为主，积蓄力量再图进取。',
      ],
    },
  ],
  'merchant->scholar': [
    {
      topic: '商业与学问',
      lines: [
        '先生，我最近得了几本古籍，您可有兴趣？',
        '哦？什么古籍？若是兵书或史册，在下极感兴趣。',
        '是一部《孙子兵法》的注释本，从蜀地带来的。',
        '太好了！我愿以十两银子购之，如何？',
      ],
    },
  ],
  'scholar->farmer': [
    {
      topic: '农学与天时',
      lines: [
        '老伯，今年的节气似乎比往年早了些？',
        '可不是嘛，春耕提前了半个月，老天爷的脾气难捉摸。',
        '我正在研究历法，希望能更准确地预测节气。',
        '那敢情好！能预知天时，种地就安心多了。',
      ],
    },
  ],
  'farmer->farmer': [
    {
      topic: '农事交流',
      lines: [
        '老伙计，你家田里的稻子长得如何？',
        '还不错，今年雨水充沛，长势喜人。',
        '我家那边有些虫害，正在想办法治理。',
        '我有些草木灰可以给你，撒在田里能防虫。',
      ],
    },
  ],
  'soldier->soldier': [
    {
      topic: '军务交流',
      lines: [
        '兄弟，昨晚值夜有什么异常吗？',
        '一切正常，就是北边有些狼嚎，不太安宁。',
        '加强巡逻吧，最近斥候说有敌军探子在附近。',
        '明白，今晚我会多带几个人手值守。',
      ],
    },
  ],
  'merchant->merchant': [
    {
      topic: '商路信息',
      lines: [
        '听说蜀道的商路最近通了，运费降了不少。',
        '是啊，我也听说了。正好有一批丝绸要运过去。',
        '要不要合伙？分摊运费，利润更高。',
        '好主意！咱们分头准备，三日后出发。',
      ],
    },
  ],
  'scholar->scholar': [
    {
      topic: '学术讨论',
      lines: [
        '仁兄，近日研读何书？',
        '正在研习《六韬》，其中「文韬」一篇颇有深意。',
        '妙哉！我亦对「龙韬」中用人之道有所感悟。',
        '不如改日一同品茗论道，互相切磋？',
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// NPC 交互系统
// ═══════════════════════════════════════════════════════════════

/**
 * NPC 交互系统
 *
 * 根据 NPC 职业和当前状态动态生成交互选项，
 * 并处理交互执行后的结果。
 */
export class NPCInteractionSystem {
  /** 已生成的交互缓存（按 NPC ID 索引） */
  private interactions: Map<string, NPCInteraction[]> = new Map();

  constructor() {}

  // ─── 生成交互选项 ───────────────────────────────────────

  /**
   * 根据 NPC 类型和状态生成可用的交互选项
   *
   * @param npcId - NPC 唯一标识
   * @param npcProfession - NPC 职业类型
   * @param npcState - NPC 当前活动状态
   * @param playerResources - 玩家当前资源
   * @returns 可用的交互列表
   */
  getInteractions(
    npcId: string,
    npcProfession: string,
    npcState: string,
    playerResources: Record<string, number>,
  ): NPCInteraction[] {
    const interactions = this.generateInteractionsForProfession(npcId, npcProfession, npcState, playerResources);
    this.interactions.set(npcId, interactions);
    return interactions;
  }

  /**
   * 根据职业生成交互选项
   */
  private generateInteractionsForProfession(
    npcId: string,
    profession: string,
    _state: string,
    resources: Record<string, number>,
  ): NPCInteraction[] {
    const npcName = this.getNPCName(npcId, profession);

    switch (profession) {
      case 'farmer':
        return [
          {
            npcId,
            npcName,
            type: 'trade',
            title: '购买粮草',
            description: '向农民购买粮草补给',
            options: [
              {
                text: '购买粮草（花费10铜钱）',
                outcome: '获得了粮草补给',
                reward: { grain: 20 },
                cost: { coins: 10 },
              },
              {
                text: '大量采购（花费50铜钱）',
                outcome: '获得了大量粮草',
                reward: { grain: 120 },
                cost: { coins: 50 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'info',
            title: '询问收成',
            description: '了解今年的粮草产出情况',
            options: [
              {
                text: '今年收成如何？',
                outcome: '获得了粮草产出加成信息',
                reward: { grain: 5 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'gift',
            title: '赠送种子',
            description: '赠送优质种子，提升农民产出',
            options: [
              {
                text: '赠送种子（花费20铜钱）',
                outcome: '农民产出提升20%，持续1小时',
                reward: { grainBonus: 20 },
                cost: { coins: 20 },
              },
            ],
          },
        ];

      case 'soldier':
        return [
          {
            npcId,
            npcName,
            type: 'quest',
            title: '委派巡逻',
            description: '派遣士兵加强巡逻，提升治安',
            options: [
              {
                text: '委派巡逻（花费15铜钱）',
                outcome: '治安提升了10%',
                reward: { security: 10 },
                cost: { coins: 15 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'challenge',
            title: '切磋武艺',
            description: '与士兵切磋，提升战斗经验',
            options: [
              {
                text: '开始切磋（花费50兵力）',
                outcome: '获得了宝贵的战斗经验',
                reward: { battleExp: 30 },
                cost: { troops: 50 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'trade',
            title: '购买武器',
            description: '从军需处购买武器装备',
            options: [
              {
                text: '购买武器（花费30铜钱）',
                outcome: '兵力增加了50',
                reward: { troops: 50 },
                cost: { coins: 30 },
              },
            ],
          },
        ];

      case 'merchant':
        return [
          {
            npcId,
            npcName,
            type: 'trade',
            title: '购买商品',
            description: '从商人处购买各类商品',
            options: [
              {
                text: '购买随机商品（花费20铜钱）',
                outcome: '获得了随机资源',
                reward: { randomResource: 1 },
                cost: { coins: 20 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'trade',
            title: '出售资源',
            description: '将多余资源卖给商人换取铜钱',
            options: [
              {
                text: '出售粮草（消耗10粮草）',
                outcome: '获得了铜钱',
                reward: { coins: 15 },
                cost: { grain: 10 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'gift',
            title: '投资商铺',
            description: '投资商人商铺，获得长期收益',
            options: [
              {
                text: '投资商铺（花费100铜钱）',
                outcome: '铜钱收入永久提升5%',
                reward: { coinsIncomeBonus: 5 },
                cost: { coins: 100 },
              },
            ],
          },
        ];

      case 'scholar':
        return [
          {
            npcId,
            npcName,
            type: 'info',
            title: '请教学问',
            description: '向学者请教学问，加速科技研究',
            options: [
              {
                text: '请教（花费20铜钱）',
                outcome: '科技研究速度提升',
                reward: { techSpeed: 10 },
                cost: { coins: 20 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'challenge',
            title: '答题挑战',
            description: '接受三国知识问答挑战',
            options: [
              {
                text: '开始答题（免费）',
                outcome: '回答正确可获得奖励',
                reward: { techPoints: 10 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'gift',
            title: '赠送书卷',
            description: '赠送书卷给学者',
            options: [
              {
                text: '赠送书卷（花费25铜钱）',
                outcome: '获得了20科技点',
                reward: { techPoints: 20 },
                cost: { coins: 25 },
              },
            ],
          },
        ];

      case 'scout':
        return [
          {
            npcId,
            npcName,
            type: 'info',
            title: '购买情报',
            description: '从斥候处购买领土情报',
            options: [
              {
                text: '购买情报（花费30铜钱）',
                outcome: '显示了附近领土信息',
                reward: { intel: 1 },
                cost: { coins: 30 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'quest',
            title: '委派侦察',
            description: '派遣斥候侦察隐藏事件',
            options: [
              {
                text: '委派侦察（花费20铜钱）',
                outcome: '发现了隐藏事件',
                reward: { hiddenEvent: 1 },
                cost: { coins: 20 },
              },
            ],
          },
          {
            npcId,
            npcName,
            type: 'trade',
            title: '交换地图',
            description: '与斥候交换地图信息',
            options: [
              {
                text: '交换地图（花费40铜钱）',
                outcome: '解锁了新领土',
                reward: { newTerritory: 1 },
                cost: { coins: 40 },
              },
            ],
          },
        ];

      default:
        return [];
    }
  }

  /**
   * 获取 NPC 名称（根据 ID 或职业生成默认名）
   */
  private getNPCName(npcId: string, profession: string): string {
    const nameMap: Record<string, string> = {
      farmer_wang: '农夫老王',
      farmer_li: '农夫老李',
      soldier_zhao: '士兵赵勇',
      soldier_sun: '士兵孙猛',
      merchant_chen: '商人陈富贵',
      merchant_zhou: '商人周聚宝',
      scholar_kong: '书生孔明远',
      scholar_liu: '书生刘博学',
    };
    return nameMap[npcId] || `${profession}NPC`;
  }

  // ─── 执行交互 ───────────────────────────────────────────

  /**
   * 执行指定的交互选项
   *
   * @param npcId - NPC 唯一标识
   * @param interactionIndex - 交互索引
   * @param optionIndex - 选项索引
   * @returns 交互执行结果
   */
  executeInteraction(npcId: string, interactionIndex: number, optionIndex: number): InteractionResult {
    const interactions = this.interactions.get(npcId);
    if (!interactions || !interactions[interactionIndex]) {
      return { result: '交互不可用', dialogueResponse: '……' };
    }

    const interaction = interactions[interactionIndex];
    const option = interaction.options[optionIndex];
    if (!option) {
      return { result: '选项无效', dialogueResponse: '……' };
    }

    // 生成 NPC 对话回应
    const dialogueResponse = this.generateDialogueResponse(interaction.type, option);

    const result: InteractionResult = {
      result: option.outcome,
      dialogueResponse,
    };

    if (option.reward) {
      result.reward = { ...option.reward };
    }
    if (option.cost) {
      result.penalty = { ...option.cost };
    }

    return result;
  }

  /**
   * 根据交互类型和选项生成 NPC 对话回应
   */
  private generateDialogueResponse(type: string, option: NPCInteractionOption): string {
    const responses: Record<string, string[]> = {
      trade: [
        `好嘞！${option.outcome}，包您满意！`,
        `成交！${option.outcome}，欢迎下次光临。`,
        `多谢惠顾！${option.outcome}。`,
      ],
      quest: [
        `遵命！${option.outcome}，属下这就去办。`,
        `是！保证完成任务，${option.outcome}。`,
      ],
      info: [
        `${option.outcome}，大人请知悉。`,
        `据我所知，${option.outcome}。`,
      ],
      gift: [
        `多谢大人赏赐！${option.outcome}。`,
        `大人的恩情，在下铭记于心！${option.outcome}。`,
      ],
      challenge: [
        `${option.outcome}，大人果然武艺高强！`,
        `佩服佩服！${option.outcome}。`,
      ],
    };

    const pool = responses[type] || ['好的。'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ─── NPC 间对话生成 ─────────────────────────────────────

  /**
   * 生成两个 NPC 之间的对话
   *
   * 根据两个 NPC 的职业组合选择合适的对话模板，
   * 生成包含话题和轮流发言的完整对话。
   *
   * @param npc1 - 第一个 NPC 的信息
   * @param npc2 - 第二个 NPC 的信息
   * @returns 对话结果，包含话题和对话内容
   */
  generateNPCChat(
    npc1: { name: string; profession: string },
    npc2: { name: string; profession: string },
  ): NPCChatResult {
    // 查找匹配的对话模板
    const key1 = `${npc1.profession}->${npc2.profession}`;
    const templates = CHAT_TEMPLATES[key1];

    if (!templates || templates.length === 0) {
      // 使用通用对话模板
      return {
        topic: '日常闲聊',
        dialogue: [
          { speaker: npc1.name, text: '今天天气不错啊。' },
          { speaker: npc2.name, text: '是啊，适合干活。' },
          { speaker: npc1.name, text: '听说最近城里来了不少商人。' },
          { speaker: npc2.name, text: '嗯，热闹了不少。' },
        ],
      };
    }

    // 随机选择一个模板
    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      topic: template.topic,
      dialogue: [
        { speaker: npc1.name, text: template.lines[0] },
        { speaker: npc2.name, text: template.lines[1] },
        { speaker: npc1.name, text: template.lines[2] },
        { speaker: npc2.name, text: template.lines[3] },
      ],
    };
  }
}
