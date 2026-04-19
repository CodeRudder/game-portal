/**
 * 三国霸业 — NPC 定义集合
 *
 * 使用通用 NPC 引擎的 NPCDef 接口定义三国主题 NPC。
 * 每种职业至少 2 个 NPC，每个 NPC 包含完整的日程和对话。
 *
 * @module games/three-kingdoms/ThreeKingdomsNPCDefs
 */

import { NPCProfession, NPCState } from '../../engine/npc/types';
import type { NPCDef } from '../../engine/npc/types';

// ═══════════════════════════════════════════════════════════════
// 农民 (FARMER) — 种田→收割→吃饭→休息循环
// ═══════════════════════════════════════════════════════════════

const farmerWang: NPCDef = {
  id: 'farmer_wang',
  profession: NPCProfession.FARMER,
  name: '农夫老王',
  color: '#4caf50',
  iconEmoji: '👨‍🌾',
  speed: 1.2,
  workCycleMinutes: 10,
  dialogues: [
    {
      id: 'dlg_farmer_wang_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人，今年收成不错！粮草充足，可以安心备战。',
          choices: [
            { text: '辛苦了，继续努力', nextLineIndex: 1 },
            { text: '有什么困难吗？', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '谢大人关心！小人一定竭尽全力。' },
        {
          speaker: 'npc',
          text: '最近盗匪猖獗，希望能加强巡逻。',
          choices: [
            { text: '我会安排士兵巡逻的', action: 'quest_update' },
          ],
        },
      ],
    },
    {
      id: 'dlg_farmer_wang_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '看这天色，怕是要下雨了，得赶紧收粮食。' },
      ],
    },
  ],
  schedule: [
    { hour: 6, state: NPCState.WORKING, targetX: 3, targetY: 8 },
    { hour: 10, state: NPCState.WORKING, targetX: 4, targetY: 9 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 13, state: NPCState.WORKING, targetX: 3, targetY: 9 },
    { hour: 18, state: NPCState.RESTING, targetX: 2, targetY: 7 },
  ],
};

const farmerLi: NPCDef = {
  id: 'farmer_li',
  profession: NPCProfession.FARMER,
  name: '农夫老李',
  color: '#66bb6a',
  iconEmoji: '👨‍🌾',
  speed: 1.0,
  workCycleMinutes: 12,
  dialogues: [
    {
      id: 'dlg_farmer_li_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人好！小人种的稻子今年长势喜人。',
          choices: [
            { text: '很好，继续努力', nextLineIndex: 1 },
            { text: '需要什么支援？', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '谢大人鼓励！' },
        { speaker: 'npc', text: '若是能修一条水渠就更好了，灌溉方便许多。' },
      ],
    },
    {
      id: 'dlg_farmer_li_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '哎，今年的蝗虫有点多啊……' },
      ],
    },
  ],
  schedule: [
    { hour: 5, state: NPCState.WORKING, targetX: 6, targetY: 10 },
    { hour: 9, state: NPCState.WORKING, targetX: 7, targetY: 11 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.WORKING, targetX: 6, targetY: 10 },
    { hour: 18, state: NPCState.RESTING, targetX: 5, targetY: 7 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 士兵 (SOLDIER) — 巡逻→训练→休息→换岗循环
// ═══════════════════════════════════════════════════════════════

const soldierZhao: NPCDef = {
  id: 'soldier_zhao',
  profession: NPCProfession.SOLDIER,
  name: '士兵赵勇',
  color: '#f44336',
  iconEmoji: '🗡️',
  speed: 1.8,
  workCycleMinutes: 8,
  dialogues: [
    {
      id: 'dlg_soldier_zhao_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '站住！……哦，是大人。属下正在巡逻。',
          choices: [
            { text: '有什么异常吗？', nextLineIndex: 1 },
            { text: '辛苦了，注意安全', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '最近边境有些小动静，不过一切尽在掌握。' },
        { speaker: 'npc', text: '谢大人关心！保家卫国是属下的职责。' },
      ],
    },
    {
      id: 'dlg_soldier_zhao_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '前方正在巡逻，请绕行。' },
      ],
    },
  ],
  schedule: [
    { hour: 5, state: NPCState.WORKING, targetX: 10, targetY: 5 },
    { hour: 8, state: NPCState.PATROLLING, targetX: 12, targetY: 6 },
    { hour: 10, state: NPCState.PATROLLING, targetX: 14, targetY: 8 },
    { hour: 12, state: NPCState.RESTING, targetX: 10, targetY: 5 },
    { hour: 14, state: NPCState.PATROLLING, targetX: 8, targetY: 4 },
    { hour: 18, state: NPCState.RESTING, targetX: 10, targetY: 3 },
  ],
};

const soldierSun: NPCDef = {
  id: 'soldier_sun',
  profession: NPCProfession.SOLDIER,
  name: '士兵孙猛',
  color: '#e57373',
  iconEmoji: '🗡️',
  speed: 2.0,
  workCycleMinutes: 8,
  dialogues: [
    {
      id: 'dlg_soldier_sun_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '报告大人！城门守卫孙猛，一切正常！',
          choices: [
            { text: '很好，保持警惕', nextLineIndex: 1 },
            { text: '武器够用吗？', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '是！属下定当日夜坚守岗位！' },
        { speaker: 'npc', text: '回禀大人，兵器略有磨损，若能找工匠修整就好了。' },
      ],
    },
    {
      id: 'dlg_soldier_sun_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '夜间巡逻要小心，大人注意脚下。' },
      ],
    },
  ],
  schedule: [
    { hour: 6, state: NPCState.PATROLLING, targetX: 15, targetY: 5 },
    { hour: 9, state: NPCState.WORKING, targetX: 10, targetY: 5 },
    { hour: 12, state: NPCState.RESTING, targetX: 10, targetY: 5 },
    { hour: 14, state: NPCState.PATROLLING, targetX: 13, targetY: 7 },
    { hour: 18, state: NPCState.RESTING, targetX: 11, targetY: 3 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 商人 (MERCHANT) — 进货→摆摊→交易→收摊循环
// ═══════════════════════════════════════════════════════════════

const merchantChen: NPCDef = {
  id: 'merchant_chen',
  profession: NPCProfession.MERCHANT,
  name: '商人陈富贵',
  color: '#ff9800',
  iconEmoji: '💰',
  speed: 1.5,
  workCycleMinutes: 10,
  dialogues: [
    {
      id: 'dlg_merchant_chen_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人好！小店新到一批上等丝绸和铁器，您看看？',
          choices: [
            { text: '让我看看商品', action: 'open_shop' },
            { text: '最近生意如何？', nextLineIndex: 1 },
            { text: '改天再来', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '托大人的福，商路畅通，生意兴隆！' },
        { speaker: 'npc', text: '好的大人，随时恭候！' },
      ],
    },
    {
      id: 'dlg_merchant_chen_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '走过路过不要错过！上等好货！' },
      ],
    },
  ],
  schedule: [
    { hour: 7, state: NPCState.WALKING, targetX: 8, targetY: 6 },
    { hour: 8, state: NPCState.TRADING, targetX: 8, targetY: 6 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.TRADING, targetX: 8, targetY: 6 },
    { hour: 18, state: NPCState.WALKING, targetX: 9, targetY: 7 },
    { hour: 19, state: NPCState.RESTING, targetX: 9, targetY: 7 },
  ],
};

const merchantZhou: NPCDef = {
  id: 'merchant_zhou',
  profession: NPCProfession.MERCHANT,
  name: '商人周聚宝',
  color: '#ffb74d',
  iconEmoji: '💰',
  speed: 1.3,
  workCycleMinutes: 10,
  dialogues: [
    {
      id: 'dlg_merchant_zhou_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人，听说西凉那边有稀有马匹，要不要帮您留意？',
          choices: [
            { text: '好，帮我留意', nextLineIndex: 1 },
            { text: '不用了，谢谢', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '好嘞！一有消息我就来禀报大人。' },
        { speaker: 'npc', text: '好的大人，那您先忙。' },
      ],
    },
    {
      id: 'dlg_merchant_zhou_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '这批货从蜀地运来，品质上乘！' },
      ],
    },
  ],
  schedule: [
    { hour: 7, state: NPCState.WALKING, targetX: 9, targetY: 8 },
    { hour: 8, state: NPCState.TRADING, targetX: 9, targetY: 8 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.TRADING, targetX: 9, targetY: 8 },
    { hour: 17, state: NPCState.WALKING, targetX: 10, targetY: 9 },
    { hour: 19, state: NPCState.RESTING, targetX: 10, targetY: 9 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 学者 (SCHOLAR) — 读书→讲学→研究→休息循环
// ═══════════════════════════════════════════════════════════════

const scholarKong: NPCDef = {
  id: 'scholar_kong',
  profession: NPCProfession.SCHOLAR,
  name: '书生孔明远',
  color: '#2196f3',
  iconEmoji: '📚',
  speed: 1.0,
  workCycleMinutes: 15,
  dialogues: [
    {
      id: 'dlg_scholar_kong_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '子曰：有朋自远方来，不亦乐乎。大人有何赐教？',
          choices: [
            { text: '请教兵法', nextLineIndex: 1 },
            { text: '借阅书籍', nextLineIndex: 2 },
            { text: '告辞', nextLineIndex: 3 },
          ],
        },
        { speaker: 'npc', text: '孙子曰：知己知彼，百战不殆。大人可从此处着手。' },
        { speaker: 'npc', text: '书架在那边，竹简和帛书都有，请自便。' },
        { speaker: 'npc', text: '大人慢走，改日再来探讨学问。' },
      ],
    },
    {
      id: 'dlg_scholar_kong_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '学而时习之，不亦说乎……' },
      ],
    },
  ],
  schedule: [
    { hour: 7, state: NPCState.WALKING, targetX: 15, targetY: 10 },
    { hour: 8, state: NPCState.WORKING, targetX: 15, targetY: 10 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.WORKING, targetX: 15, targetY: 10 },
    { hour: 18, state: NPCState.RESTING, targetX: 14, targetY: 9 },
  ],
};

const scholarLiu: NPCDef = {
  id: 'scholar_liu',
  profession: NPCProfession.SCHOLAR,
  name: '书生刘博学',
  color: '#64b5f6',
  iconEmoji: '📚',
  speed: 0.9,
  workCycleMinutes: 14,
  dialogues: [
    {
      id: 'dlg_scholar_liu_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人，小生正在研究历法，发现了一些有趣的天象。',
          choices: [
            { text: '说来听听', nextLineIndex: 1 },
            { text: '改天再聊', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '依小生推算，下月将有吉星高照，宜出兵征讨！' },
        { speaker: 'npc', text: '好的大人，小生继续研读。' },
      ],
    },
    {
      id: 'dlg_scholar_liu_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '这段经文颇有深意，值得反复品味……' },
      ],
    },
  ],
  schedule: [
    { hour: 8, state: NPCState.WORKING, targetX: 16, targetY: 11 },
    { hour: 11, state: NPCState.WALKING, targetX: 15, targetY: 10 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.WORKING, targetX: 16, targetY: 11 },
    { hour: 18, state: NPCState.RESTING, targetX: 15, targetY: 12 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 武将 (GENERAL) — 训练→巡视→议事→休息循环
// ═══════════════════════════════════════════════════════════════

const generalGuan: NPCDef = {
  id: 'general_guan',
  profession: NPCProfession.GENERAL,
  name: '武将关铁柱',
  color: '#9c27b0',
  iconEmoji: '⚔️',
  speed: 1.6,
  workCycleMinutes: 8,
  dialogues: [
    {
      id: 'dlg_general_guan_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '嗯？有何要事？军务繁忙，请简明扼要。',
          choices: [
            { text: '汇报军情', nextLineIndex: 1 },
            { text: '请求增援', nextLineIndex: 2 },
            { text: '打扰了', nextLineIndex: 3 },
          ],
        },
        { speaker: 'npc', text: '知道了，我会安排斥候前去打探。' },
        { speaker: 'npc', text: '兵力紧张，容我从长计议，先调拨一部分。' },
        { speaker: 'npc', text: '嗯，去忙吧。' },
      ],
    },
    {
      id: 'dlg_general_guan_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '兵马未动，粮草先行。后勤不可忽视。' },
      ],
    },
  ],
  schedule: [
    { hour: 6, state: NPCState.WORKING, targetX: 10, targetY: 2 },
    { hour: 9, state: NPCState.PATROLLING, targetX: 12, targetY: 4 },
    { hour: 12, state: NPCState.RESTING, targetX: 10, targetY: 5 },
    { hour: 14, state: NPCState.WORKING, targetX: 11, targetY: 3 },
    { hour: 18, state: NPCState.RESTING, targetX: 10, targetY: 1 },
  ],
};

const generalZhang: NPCDef = {
  id: 'general_zhang',
  profession: NPCProfession.GENERAL,
  name: '武将张豹胆',
  color: '#ce93d8',
  iconEmoji: '⚔️',
  speed: 1.7,
  workCycleMinutes: 7,
  dialogues: [
    {
      id: 'dlg_general_zhang_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '哈哈哈！大人来得正好，刚操练完兵马！',
          choices: [
            { text: '士气如何？', nextLineIndex: 1 },
            { text: '加强训练', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '士气高昂！弟兄们都等着建功立业呢！' },
        { speaker: 'npc', text: '好！属下这就加操，保证个个以一当十！' },
      ],
    },
    {
      id: 'dlg_general_zhang_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '练兵不可松懈！再来一组！' },
      ],
    },
  ],
  schedule: [
    { hour: 5, state: NPCState.WORKING, targetX: 11, targetY: 3 },
    { hour: 8, state: NPCState.PATROLLING, targetX: 13, targetY: 5 },
    { hour: 12, state: NPCState.RESTING, targetX: 10, targetY: 5 },
    { hour: 14, state: NPCState.WORKING, targetX: 11, targetY: 4 },
    { hour: 19, state: NPCState.RESTING, targetX: 10, targetY: 1 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 工匠 (CRAFTSMAN) — 锻造→交付→修理→休息循环
// ═══════════════════════════════════════════════════════════════

const craftsmanTie: NPCDef = {
  id: 'craftsman_tie',
  profession: NPCProfession.CRAFTSMAN,
  name: '工匠铁锤',
  color: '#795548',
  iconEmoji: '🔨',
  speed: 1.1,
  workCycleMinutes: 12,
  dialogues: [
    {
      id: 'dlg_craftsman_tie_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '叮叮当当……哦，大人好！需要打造什么吗？',
          choices: [
            { text: '打造武器', action: 'open_shop' },
            { text: '修理装备', nextLineIndex: 1 },
            { text: '下次再来', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '放这儿吧，明天就能修好，保证锋利如初！' },
        { speaker: 'npc', text: '好的大人，随时欢迎！' },
      ],
    },
    {
      id: 'dlg_craftsman_tie_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '好铁配好匠，这把刀快成了！' },
      ],
    },
  ],
  schedule: [
    { hour: 7, state: NPCState.WALKING, targetX: 7, targetY: 5 },
    { hour: 8, state: NPCState.WORKING, targetX: 7, targetY: 5 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.WORKING, targetX: 7, targetY: 5 },
    { hour: 18, state: NPCState.RESTING, targetX: 6, targetY: 4 },
  ],
};

const craftsmanMu: NPCDef = {
  id: 'craftsman_mu',
  profession: NPCProfession.CRAFTSMAN,
  name: '工匠木匠李',
  color: '#a1887f',
  iconEmoji: '🔨',
  speed: 1.0,
  workCycleMinutes: 14,
  dialogues: [
    {
      id: 'dlg_craftsman_mu_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人，攻城云梯和投石车都在赶制中。',
          choices: [
            { text: '进度如何？', nextLineIndex: 1 },
            { text: '需要什么材料？', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '云梯已完成七成，投石车还需三日。' },
        { speaker: 'npc', text: '缺一些上等木材和铁钉，若能补充就更快了。' },
      ],
    },
    {
      id: 'dlg_craftsman_mu_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '这根梁柱得刨平才行……' },
      ],
    },
  ],
  schedule: [
    { hour: 6, state: NPCState.WORKING, targetX: 8, targetY: 4 },
    { hour: 10, state: NPCState.WORKING, targetX: 7, targetY: 5 },
    { hour: 12, state: NPCState.RESTING, targetX: 5, targetY: 8 },
    { hour: 14, state: NPCState.WORKING, targetX: 8, targetY: 4 },
    { hour: 18, state: NPCState.RESTING, targetX: 7, targetY: 3 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 村民 (VILLAGER) — 闲逛→家务→聊天→休息循环
// ═══════════════════════════════════════════════════════════════

const villagerAuntieWang: NPCDef = {
  id: 'villager_auntie_wang',
  profession: NPCProfession.VILLAGER,
  name: '王大娘',
  color: '#607d8b',
  iconEmoji: '🏘️',
  speed: 0.8,
  workCycleMinutes: 16,
  dialogues: [
    {
      id: 'dlg_villager_wang_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '哎呀，大人来了！快进来坐坐，喝碗热汤。',
          choices: [
            { text: '谢谢大娘', nextLineIndex: 1 },
            { text: '村里最近怎么样？', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '大人客气了！来来来，刚煮的。' },
        { speaker: 'npc', text: '挺好的，就是隔壁老张家的小子又调皮了，哈哈。' },
      ],
    },
    {
      id: 'dlg_villager_wang_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '今天天气真好，适合晒被子呢。' },
      ],
    },
  ],
  schedule: [
    { hour: 7, state: NPCState.WALKING, targetX: 4, targetY: 7 },
    { hour: 9, state: NPCState.WORKING, targetX: 4, targetY: 8 },
    { hour: 12, state: NPCState.RESTING, targetX: 4, targetY: 7 },
    { hour: 14, state: NPCState.WALKING, targetX: 5, targetY: 9 },
    { hour: 17, state: NPCState.WALKING, targetX: 4, targetY: 7 },
    { hour: 19, state: NPCState.RESTING, targetX: 3, targetY: 7 },
  ],
};

const villagerOldZhang: NPCDef = {
  id: 'villager_old_zhang',
  profession: NPCProfession.VILLAGER,
  name: '张老伯',
  color: '#90a4ae',
  iconEmoji: '🏘️',
  speed: 0.7,
  workCycleMinutes: 18,
  dialogues: [
    {
      id: 'dlg_villager_zhang_greet',
      trigger: 'click',
      lines: [
        {
          speaker: 'npc',
          text: '大人，老朽在这住了几十年了，有什么想问的尽管说。',
          choices: [
            { text: '附近有什么好去处？', nextLineIndex: 1 },
            { text: '您身体还好吗？', nextLineIndex: 2 },
          ],
        },
        { speaker: 'npc', text: '东边有个温泉，西边有片竹林，都是好地方。' },
        { speaker: 'npc', text: '托大人的福，老朽身子骨还硬朗着呢！' },
      ],
    },
    {
      id: 'dlg_villager_zhang_proximity',
      trigger: 'proximity',
      lines: [
        { speaker: 'npc', text: '年轻真好啊……老朽当年也是一员猛将呢。' },
      ],
    },
  ],
  schedule: [
    { hour: 8, state: NPCState.WALKING, targetX: 3, targetY: 9 },
    { hour: 10, state: NPCState.IDLE, targetX: 5, targetY: 8 },
    { hour: 12, state: NPCState.RESTING, targetX: 4, targetY: 7 },
    { hour: 14, state: NPCState.WALKING, targetX: 6, targetY: 10 },
    { hour: 17, state: NPCState.WALKING, targetX: 3, targetY: 8 },
    { hour: 19, state: NPCState.RESTING, targetX: 3, targetY: 7 },
  ],
};

// ═══════════════════════════════════════════════════════════════
// NPC 定义集合（按 spawn 配置分组）
// ═══════════════════════════════════════════════════════════════

/** 所有三国 NPC 定义 */
export const THREE_KINGDOMS_NPC_DEFS: NPCDef[] = [
  farmerWang,
  farmerLi,
  soldierZhao,
  soldierSun,
  merchantChen,
  merchantZhou,
  scholarKong,
  scholarLiu,
  generalGuan,
  generalZhang,
  craftsmanTie,
  craftsmanMu,
  villagerAuntieWang,
  villagerOldZhang,
];

/**
 * NPC 生成位置配置
 *
 * 每个 NPC 的初始 spawn 位置，取其日程第一项的坐标。
 * key 是 NPCDef.id，value 是 {x, y}。
 */
export const THREE_KINGDOMS_SPAWN_CONFIG: Record<string, { x: number; y: number }> = {
  farmer_wang: { x: 3, y: 8 },
  farmer_li: { x: 6, y: 10 },
  soldier_zhao: { x: 10, y: 5 },
  soldier_sun: { x: 15, y: 5 },
  merchant_chen: { x: 8, y: 6 },
  merchant_zhou: { x: 9, y: 8 },
  scholar_kong: { x: 15, y: 10 },
  scholar_liu: { x: 16, y: 11 },
  general_guan: { x: 10, y: 2 },
  general_zhang: { x: 11, y: 3 },
  craftsman_tie: { x: 7, y: 5 },
  craftsman_mu: { x: 8, y: 4 },
  villager_auntie_wang: { x: 4, y: 7 },
  villager_old_zhang: { x: 3, y: 9 },
};
