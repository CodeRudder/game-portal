/**
 * 核心层 — NPC 数据配置
 *
 * 包含 NPC 职业定义、初始 NPC 列表、对话树配置、地图展示参数等静态配置。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/npc/npc-config
 */

import type {
  NPCProfession,
  NPCProfessionDef,
  NPCData,
  NPCId,
  AffinityLevel,
  DialogTree,
  NPCClusterConfig,
  CrowdManagementConfig,
} from './npc.types';
import { AFFINITY_THRESHOLDS } from './npc.types';

// ─────────────────────────────────────────────
// 1. NPC 职业定义（#9）
// ─────────────────────────────────────────────

/** NPC 职业定义表 */
export const NPC_PROFESSION_DEFS: Record<NPCProfession, NPCProfessionDef> = {
  merchant: {
    profession: 'merchant',
    label: '商人',
    description: '行走各地的商人，出售稀有物品和资源',
    icon: '🏪',
    defaultAffinity: 30,
    affinityDecayRate: -0.5,
    interactionType: 'trade',
  },
  strategist: {
    profession: 'strategist',
    label: '谋士',
    description: '隐居山林的谋士，提供情报和计策',
    icon: '📜',
    defaultAffinity: 25,
    affinityDecayRate: -0.3,
    interactionType: 'intel',
  },
  warrior: {
    profession: 'warrior',
    label: '武将',
    description: '游历四方的武将，可切磋武艺',
    icon: '⚔️',
    defaultAffinity: 20,
    affinityDecayRate: -0.2,
    interactionType: 'challenge',
  },
  artisan: {
    profession: 'artisan',
    label: '工匠',
    description: '精通锻造的工匠，可强化装备',
    icon: '🔨',
    defaultAffinity: 35,
    affinityDecayRate: -0.4,
    interactionType: 'craft',
  },
  traveler: {
    profession: 'traveler',
    label: '旅人',
    description: '云游四方的旅人，讲述各地见闻',
    icon: '🗺️',
    defaultAffinity: 40,
    affinityDecayRate: -0.1,
    interactionType: 'story',
  },
} as const;

/** NPC 职业列表 */
export const NPC_PROFESSIONS: readonly NPCProfession[] = [
  'merchant', 'strategist', 'warrior', 'artisan', 'traveler',
] as const;

// ─────────────────────────────────────────────
// 2. 初始 NPC 数据（#10）
// ─────────────────────────────────────────────

/** 默认 NPC 列表 */
export const DEFAULT_NPCS: readonly NPCData[] = [
  // ── 中原 NPC ──
  {
    id: 'npc-merchant-01',
    name: '吕不韦',
    profession: 'merchant',
    affinity: 30,
    position: { x: 32, y: 9 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-01',
    name: '水镜先生',
    profession: 'strategist',
    affinity: 25,
    position: { x: 28, y: 14 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-01',
    name: '赵云',
    profession: 'warrior',
    affinity: 20,
    position: { x: 35, y: 12 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-artisan-01',
    name: '蒲元',
    profession: 'artisan',
    affinity: 35,
    position: { x: 25, y: 15 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-artisan-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-traveler-01',
    name: '徐庶',
    profession: 'traveler',
    affinity: 40,
    position: { x: 30, y: 7 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-traveler-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  // ── 江南 NPC ──
  {
    id: 'npc-merchant-02',
    name: '陆逊',
    profession: 'merchant',
    affinity: 30,
    position: { x: 48, y: 30 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-02',
    name: '鲁肃',
    profession: 'strategist',
    affinity: 28,
    position: { x: 44, y: 33 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-02',
    name: '甘宁',
    profession: 'warrior',
    affinity: 22,
    position: { x: 50, y: 35 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-traveler-02',
    name: '步骘',
    profession: 'traveler',
    affinity: 38,
    position: { x: 42, y: 28 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-traveler-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  // ── 西蜀 NPC ──
  {
    id: 'npc-artisan-02',
    name: '马钧',
    profession: 'artisan',
    affinity: 32,
    position: { x: 10, y: 28 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-artisan-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-03',
    name: '法正',
    profession: 'strategist',
    affinity: 26,
    position: { x: 14, y: 32 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-03',
    name: '魏延',
    profession: 'warrior',
    affinity: 18,
    position: { x: 8, y: 25 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
] as const;

// ─────────────────────────────────────────────
// 3. 对话树配置（#15）
// ─────────────────────────────────────────────

/** 商人默认对话树 */
export const DIALOG_MERCHANT_DEFAULT: DialogTree = {
  id: 'dialog-merchant-default',
  profession: 'merchant',
  startNodeId: 'merchant-start',
  nodes: {
    'merchant-start': {
      id: 'merchant-start',
      speaker: '商人',
      text: '客官，远道而来辛苦了！在下有些稀罕物件，不知客官可有兴趣？',
      options: [
        {
          id: 'opt-browse',
          text: '看看你有什么好东西',
          nextNodeId: 'merchant-browse',
          requiredAffinity: 20,
        },
        {
          id: 'opt-bargain',
          text: '能不能便宜点？',
          nextNodeId: 'merchant-bargain',
          requiredAffinity: 50,
          effects: [{ type: 'affinity_change', value: -5 }],
        },
        {
          id: 'opt-rumor',
          text: '听说最近有什么新鲜事？',
          nextNodeId: 'merchant-rumor',
          requiredAffinity: 40,
        },
        {
          id: 'opt-leave',
          text: '下次再说吧',
          nextNodeId: null,
        },
      ],
    },
    'merchant-browse': {
      id: 'merchant-browse',
      speaker: '商人',
      text: '这些都是从西域带来的好货，品质上乘！',
      options: [
        {
          id: 'opt-buy',
          text: '买下这件商品',
          nextNodeId: 'merchant-thanks',
          effects: [{ type: 'affinity_change', value: 10 }],
        },
        {
          id: 'opt-back',
          text: '再看看',
          nextNodeId: 'merchant-start',
        },
      ],
    },
    'merchant-bargain': {
      id: 'merchant-bargain',
      speaker: '商人',
      text: '客官真是会做生意……好吧，看在老交情的份上，给你个实惠价！',
      options: [
        {
          id: 'opt-accept',
          text: '成交！',
          nextNodeId: 'merchant-thanks',
          effects: [{ type: 'affinity_change', value: 5 }],
        },
        {
          id: 'opt-refuse',
          text: '还是太贵了',
          nextNodeId: null,
        },
      ],
    },
    'merchant-rumor': {
      id: 'merchant-rumor',
      speaker: '商人',
      text: '听说北边最近不太平，各路诸侯都在招兵买马……多加小心啊客官。',
      options: [
        {
          id: 'opt-thanks',
          text: '多谢提醒',
          nextNodeId: null,
          effects: [{ type: 'affinity_change', value: 3 }],
        },
      ],
    },
    'merchant-thanks': {
      id: 'merchant-thanks',
      speaker: '商人',
      text: '多谢客官惠顾！下次有好货一定给您留着。',
      options: [
        {
          id: 'opt-goodbye',
          text: '后会有期',
          nextNodeId: null,
          effects: [{ type: 'affinity_change', value: 2 }],
        },
      ],
    },
  },
};

/** 谋士默认对话树 */
export const DIALOG_STRATEGIST_DEFAULT: DialogTree = {
  id: 'dialog-strategist-default',
  profession: 'strategist',
  startNodeId: 'strategist-start',
  nodes: {
    'strategist-start': {
      id: 'strategist-start',
      speaker: '谋士',
      text: '阁下气度不凡，想必是干大事之人。在下虽不才，但对天下大势略知一二。',
      options: [
        {
          id: 'opt-ask-intel',
          text: '请先生指点天下大势',
          nextNodeId: 'strategist-intel',
          requiredAffinity: 30,
        },
        {
          id: 'opt-recruit',
          text: '先生可愿出山相助？',
          nextNodeId: 'strategist-recruit',
          requiredAffinity: 65,
        },
        {
          id: 'opt-leave',
          text: '打扰了',
          nextNodeId: null,
        },
      ],
    },
    'strategist-intel': {
      id: 'strategist-intel',
      speaker: '谋士',
      text: '据我观察，曹操雄踞北方，孙权虎踞江东，刘备寄居荆州。三方势力此消彼长……',
      options: [
        {
          id: 'opt-detail',
          text: '请继续说',
          nextNodeId: 'strategist-detail',
          effects: [{ type: 'affinity_change', value: 5 }],
        },
        {
          id: 'opt-back',
          text: '多谢先生',
          nextNodeId: null,
        },
      ],
    },
    'strategist-detail': {
      id: 'strategist-detail',
      speaker: '谋士',
      text: '若要成就霸业，需得天时地利人和。中原虽好，但四面受敌；西蜀险要，可图长远。',
      options: [
        {
          id: 'opt-thanks',
          text: '受教了',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'unlock_info', value: 'strategic_overview' },
          ],
        },
      ],
    },
    'strategist-recruit': {
      id: 'strategist-recruit',
      speaker: '谋士',
      text: '阁下诚意可鉴，在下愿效犬马之劳！',
      options: [
        {
          id: 'opt-accept',
          text: '太好了！欢迎加入！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 20 },
            { type: 'trigger_event', value: 'npc_recruited' },
          ],
        },
      ],
    },
  },
};

/** 武将默认对话树 */
export const DIALOG_WARRIOR_DEFAULT: DialogTree = {
  id: 'dialog-warrior-default',
  profession: 'warrior',
  startNodeId: 'warrior-start',
  nodes: {
    'warrior-start': {
      id: 'warrior-start',
      speaker: '武将',
      text: '来者何人？看你身手不错，可敢与我一战？',
      options: [
        {
          id: 'opt-challenge',
          text: '正想讨教！',
          nextNodeId: 'warrior-challenge',
          requiredAffinity: 20,
        },
        {
          id: 'opt-spar',
          text: '切磋一下也无妨',
          nextNodeId: 'warrior-spar',
          requiredAffinity: 40,
        },
        {
          id: 'opt-friendship',
          text: '英雄相惜，不如交个朋友',
          nextNodeId: 'warrior-friendship',
          requiredAffinity: 60,
        },
        {
          id: 'opt-decline',
          text: '改日再战',
          nextNodeId: null,
        },
      ],
    },
    'warrior-challenge': {
      id: 'warrior-challenge',
      speaker: '武将',
      text: '好！有胆量！来吧，让我看看你的本事！',
      options: [
        {
          id: 'opt-fight',
          text: '迎战！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 10 },
            { type: 'trigger_event', value: 'npc_challenge' },
          ],
        },
      ],
    },
    'warrior-spar': {
      id: 'warrior-spar',
      speaker: '武将',
      text: '你的身手确实了得！我甘拜下风。',
      options: [
        {
          id: 'opt-respect',
          text: '承让！你的武艺也令人敬佩',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 15 },
            { type: 'grant_resource', value: 'troops', params: { amount: 50 } },
          ],
        },
      ],
    },
    'warrior-friendship': {
      id: 'warrior-friendship',
      speaker: '武将',
      text: '好！你是个值得结交的朋友！日后若有需要，尽管来找我。',
      options: [
        {
          id: 'opt-promise',
          text: '一言为定！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 25 },
            { type: 'trigger_event', value: 'npc_bonded' },
          ],
        },
      ],
    },
  },
};

/** 工匠默认对话树 */
export const DIALOG_ARTISAN_DEFAULT: DialogTree = {
  id: 'dialog-artisan-default',
  profession: 'artisan',
  startNodeId: 'artisan-start',
  nodes: {
    'artisan-start': {
      id: 'artisan-start',
      speaker: '工匠',
      text: '欢迎光临！在下是这里的铁匠，精工细作，童叟无欺。',
      options: [
        {
          id: 'opt-craft',
          text: '帮我打造一件装备',
          nextNodeId: 'artisan-craft',
          requiredAffinity: 25,
        },
        {
          id: 'opt-upgrade',
          text: '强化我的装备',
          nextNodeId: 'artisan-upgrade',
          requiredAffinity: 45,
        },
        {
          id: 'opt-legendary',
          text: '我听说你能锻造神器？',
          nextNodeId: 'artisan-legendary',
          requiredAffinity: 80,
        },
        {
          id: 'opt-leave',
          text: '下次再来',
          nextNodeId: null,
        },
      ],
    },
    'artisan-craft': {
      id: 'artisan-craft',
      speaker: '工匠',
      text: '好！让我看看……嗯，这些材料品质不错，一定能打造出上等货色！',
      options: [
        {
          id: 'opt-confirm',
          text: '拜托了！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 8 },
            { type: 'trigger_event', value: 'npc_craft' },
          ],
        },
      ],
    },
    'artisan-upgrade': {
      id: 'artisan-upgrade',
      speaker: '工匠',
      text: '强化装备需要格外小心……不过你放心，我的手艺绝对可靠！',
      options: [
        {
          id: 'opt-confirm',
          text: '相信你的手艺',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 10 },
            { type: 'trigger_event', value: 'npc_upgrade' },
          ],
        },
      ],
    },
    'artisan-legendary': {
      id: 'artisan-legendary',
      speaker: '工匠',
      text: '嘿嘿，你消息灵通啊！确实，我祖上曾传下一门绝技……不过锻造神器需要稀世材料。',
      options: [
        {
          id: 'opt-ask',
          text: '需要什么材料？',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 15 },
            { type: 'unlock_info', value: 'legendary_materials' },
          ],
        },
      ],
    },
  },
};

/** 旅人默认对话树 */
export const DIALOG_TRAVELER_DEFAULT: DialogTree = {
  id: 'dialog-traveler-default',
  profession: 'traveler',
  startNodeId: 'traveler-start',
  nodes: {
    'traveler-start': {
      id: 'traveler-start',
      speaker: '旅人',
      text: '你好啊！我从远方来，走过很多地方，见过很多有趣的事。想听听吗？',
      options: [
        {
          id: 'opt-story',
          text: '说说你的见闻吧',
          nextNodeId: 'traveler-story',
        },
        {
          id: 'opt-direction',
          text: '附近有什么值得去的地方？',
          nextNodeId: 'traveler-direction',
          requiredAffinity: 30,
        },
        {
          id: 'opt-secret',
          text: '有什么秘密可以告诉我吗？',
          nextNodeId: 'traveler-secret',
          requiredAffinity: 70,
        },
        {
          id: 'opt-leave',
          text: '有缘再见',
          nextNodeId: null,
        },
      ],
    },
    'traveler-story': {
      id: 'traveler-story',
      speaker: '旅人',
      text: '我曾到过西域，那里有大漠孤烟，也有绿洲明珠。最难忘的是一次在月下听老者讲述古战场的传说……',
      options: [
        {
          id: 'opt-more',
          text: '继续说',
          nextNodeId: 'traveler-story2',
          effects: [{ type: 'affinity_change', value: 3 }],
        },
        {
          id: 'opt-back',
          text: '真是有趣',
          nextNodeId: null,
          effects: [{ type: 'affinity_change', value: 2 }],
        },
      ],
    },
    'traveler-story2': {
      id: 'traveler-story2',
      speaker: '旅人',
      text: '据说在那片古战场上，至今还能听到战鼓声……有人在那里找到了一把锈迹斑斑的古剑。',
      options: [
        {
          id: 'opt-thanks',
          text: '多谢分享，记下了',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'unlock_info', value: 'ancient_battlefield' },
          ],
        },
      ],
    },
    'traveler-direction': {
      id: 'traveler-direction',
      speaker: '旅人',
      text: '往东走有一座古城遗址，据说藏有宝物。不过那里机关重重，需要小心行事。',
      options: [
        {
          id: 'opt-thanks',
          text: '多谢指引！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'unlock_info', value: 'ancient_ruins_location' },
          ],
        },
      ],
    },
    'traveler-secret': {
      id: 'traveler-secret',
      speaker: '旅人',
      text: '既然你如此信任我……我告诉你一个秘密。在剑阁附近的山洞中，藏着一位隐士留下的兵法残卷。',
      options: [
        {
          id: 'opt-gratitude',
          text: '太感谢了！我一定去找',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 15 },
            { type: 'unlock_item', value: 'scroll_fragment_location' },
          ],
        },
      ],
    },
  },
};

/** 所有对话树映射 */
export const DIALOG_TREES: Record<string, DialogTree> = {
  'dialog-merchant-default': DIALOG_MERCHANT_DEFAULT,
  'dialog-strategist-default': DIALOG_STRATEGIST_DEFAULT,
  'dialog-warrior-default': DIALOG_WARRIOR_DEFAULT,
  'dialog-artisan-default': DIALOG_ARTISAN_DEFAULT,
  'dialog-traveler-default': DIALOG_TRAVELER_DEFAULT,
} as const;

// ─────────────────────────────────────────────
// 4. 地图展示配置（#11）
// ─────────────────────────────────────────────

/** 默认聚合配置 */
export const DEFAULT_CLUSTER_CONFIG: NPCClusterConfig = {
  clusterDistance: 48,
  maxDisplayPerRegion: 8,
  minClusterSize: 2,
  enabled: true,
} as const;

/** 默认拥挤管理配置 */
export const DEFAULT_CROWD_CONFIG: CrowdManagementConfig = {
  maxNPCsPerTile: 3,
  minSpacing: 2,
  jitterRadius: 12,
} as const;

// ─────────────────────────────────────────────
// 5. 辅助函数
// ─────────────────────────────────────────────

/** NPC 存档版本号 */
export const NPC_SAVE_VERSION = 1;

/**
 * 根据好感度值获取好感度等级
 *
 * @param affinity - 好感度值 (0-100)
 * @returns 好感度等级
 */
export function getAffinityLevel(affinity: number): AffinityLevel {
  const clamped = Math.max(0, Math.min(100, affinity));
  const levels: AffinityLevel[] = ['hostile', 'neutral', 'friendly', 'trusted', 'bonded'];
  for (const level of levels) {
    const threshold = AFFINITY_THRESHOLDS[level];
    if (clamped >= threshold.min && clamped <= threshold.max) {
      return level;
    }
  }
  return 'neutral';
}

/**
 * 获取好感度在当前等级内的进度 (0-1)
 *
 * @param affinity - 好感度值
 * @returns 进度百分比
 */
export function getAffinityProgress(affinity: number): number {
  const clamped = Math.max(0, Math.min(100, affinity));
  const level = getAffinityLevel(clamped);
  const threshold = AFFINITY_THRESHOLDS[level];
  const range = threshold.max - threshold.min;
  if (range === 0) return 0;
  return (clamped - threshold.min) / range;
}

/**
 * 限制好感度在有效范围内
 *
 * @param affinity - 好感度值
 * @returns 钳位后的好感度
 */
export function clampAffinity(affinity: number): number {
  return Math.max(0, Math.min(100, affinity));
}
