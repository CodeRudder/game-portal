/**
 * 核心层 — NPC 数据配置
 *
 * 包含 NPC 职业定义、默认 NPC 数据、对话树配置等静态数据。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/npc/npc-config
 */

import type {
  NPCProfession,
  NPCProfessionDef,
  NPCData,
  AffinityLevel,
  DialogTree,
  NPCClusterConfig,
  CrowdManagementConfig,
  NPCAction,
} from './npc.types';
import { AFFINITY_THRESHOLDS } from './npc.types';
import type { RegionId, GridPosition } from '../map';
import { REGION_IDS } from '../map';

// ─────────────────────────────────────────────
// 1. 职业定义（#9）
// ─────────────────────────────────────────────

/** NPC 职业定义表 */
export const NPC_PROFESSION_DEFS: Record<NPCProfession, NPCProfessionDef> = {
  merchant: {
    profession: 'merchant',
    label: '商人',
    description: '行走天下的商贾，善于交易买卖',
    icon: '🏪',
    defaultAffinity: 30,
    affinityDecayRate: -0.5,
    interactionType: 'trade',
  },
  strategist: {
    profession: 'strategist',
    label: '谋士',
    description: '运筹帷幄的智者，提供情报与计策',
    icon: '📜',
    defaultAffinity: 25,
    affinityDecayRate: -0.3,
    interactionType: 'intel',
  },
  warrior: {
    profession: 'warrior',
    label: '武将',
    description: '身经百战的猛将，可进行比武挑战',
    icon: '⚔️',
    defaultAffinity: 20,
    affinityDecayRate: -0.2,
    interactionType: 'challenge',
  },
  artisan: {
    profession: 'artisan',
    label: '工匠',
    description: '技艺精湛的匠人，可锻造升级装备',
    icon: '🔨',
    defaultAffinity: 30,
    affinityDecayRate: -0.4,
    interactionType: 'craft',
  },
  traveler: {
    profession: 'traveler',
    label: '旅人',
    description: '云游四方的行者，讲述奇闻轶事',
    icon: '🗺️',
    defaultAffinity: 35,
    affinityDecayRate: -0.1,
    interactionType: 'story',
  },
} as const;

/** 职业列表 */
export const NPC_PROFESSIONS: readonly NPCProfession[] = [
  'merchant', 'strategist', 'warrior', 'artisan', 'traveler',
] as const;

/** 职业中文名映射 */
export const NPC_PROFESSION_LABELS: Record<NPCProfession, string> = {
  merchant: '商人',
  strategist: '谋士',
  warrior: '武将',
  artisan: '工匠',
  traveler: '旅人',
} as const;

// ─────────────────────────────────────────────
// 2. 好感度工具函数（#10, #17）
// ─────────────────────────────────────────────

/** 根据好感度值获取等级 */
export function getAffinityLevel(affinity: number): AffinityLevel {
  const clamped = Math.max(0, Math.min(100, affinity));
  if (clamped >= AFFINITY_THRESHOLDS.bonded.min) return 'bonded';
  if (clamped >= AFFINITY_THRESHOLDS.trusted.min) return 'trusted';
  if (clamped >= AFFINITY_THRESHOLDS.friendly.min) return 'friendly';
  if (clamped >= AFFINITY_THRESHOLDS.neutral.min) return 'neutral';
  return 'hostile';
}

/** 获取当前等级内的进度 (0-1) */
export function getAffinityProgress(affinity: number): number {
  const clamped = Math.max(0, Math.min(100, affinity));
  const level = getAffinityLevel(clamped);
  const threshold = AFFINITY_THRESHOLDS[level];
  const range = threshold.max - threshold.min;
  if (range === 0) return 1;
  return (clamped - threshold.min) / range;
}

/** 将好感度限制在 0-100 范围 */
export function clampAffinity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** 好感度等级中文名 */
export const AFFINITY_LEVEL_LABELS: Record<AffinityLevel, string> = {
  hostile: '敌意',
  neutral: '中立',
  friendly: '友善',
  trusted: '信赖',
  bonded: '羁绊',
} as const;

// ─────────────────────────────────────────────
// 3. 默认 NPC 数据（#10）
// ─────────────────────────────────────────────

/** 默认 NPC 列表 */
export const DEFAULT_NPCS: NPCData[] = [
  {
    id: 'npc-merchant-01',
    name: '甄商',
    profession: 'merchant',
    affinity: 30,
    position: { x: 32, y: 10 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-01',
    name: '荀策',
    profession: 'strategist',
    affinity: 25,
    position: { x: 35, y: 8 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-01',
    name: '赵锋',
    profession: 'warrior',
    affinity: 20,
    position: { x: 40, y: 15 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-artisan-01',
    name: '鲁匠',
    profession: 'artisan',
    affinity: 30,
    position: { x: 20, y: 25 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-artisan-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-traveler-01',
    name: '司马行',
    profession: 'traveler',
    affinity: 35,
    position: { x: 45, y: 28 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-traveler-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-merchant-02',
    name: '糜商',
    profession: 'merchant',
    affinity: 40,
    position: { x: 50, y: 32 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-merchant-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-strategist-02',
    name: '庞策',
    profession: 'strategist',
    affinity: 45,
    position: { x: 15, y: 28 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-strategist-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-warrior-02',
    name: '黄武',
    profession: 'warrior',
    affinity: 50,
    position: { x: 38, y: 12 },
    region: 'central_plains',
    visible: true,
    dialogId: 'dialog-warrior-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-artisan-02',
    name: '陈匠',
    profession: 'artisan',
    affinity: 40,
    position: { x: 46, y: 30 },
    region: 'jiangnan',
    visible: true,
    dialogId: 'dialog-artisan-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
  {
    id: 'npc-traveler-02',
    name: '孙游',
    profession: 'traveler',
    affinity: 35,
    position: { x: 14, y: 32 },
    region: 'western_shu',
    visible: true,
    dialogId: 'dialog-traveler-default',
    createdAt: 0,
    lastInteractedAt: 0,
  },
] as const;

// ─────────────────────────────────────────────
// 4. 地图展示配置（#11）
// ─────────────────────────────────────────────

/** 默认聚合配置 */
export const DEFAULT_CLUSTER_CONFIG: NPCClusterConfig = {
  clusterDistance: 48,
  maxDisplayPerRegion: 5,
  minClusterSize: 2,
  enabled: true,
} as const;

/** 默认拥挤管理配置 */
export const DEFAULT_CROWD_CONFIG: CrowdManagementConfig = {
  maxNPCsPerTile: 3,
  minSpacing: 1,
  jitterRadius: 12,
} as const;

// ─────────────────────────────────────────────
// 5. 对话树配置（#15）
// ─────────────────────────────────────────────

/** 商人默认对话树 */
export const DIALOG_TREE_MERCHANT: DialogTree = {
  id: 'dialog-merchant-default',
  profession: 'merchant',
  startNodeId: 'merchant-start',
  nodes: {
    'merchant-start': {
      id: 'merchant-start',
      speaker: '商人',
      text: '客官，远道而来辛苦了！我这里有上好的货物，不知客官是否有兴趣？',
      options: [
        {
          id: 'merchant-buy',
          text: '看看你有什么好东西',
          nextNodeId: 'merchant-buy-response',
          requiredAffinity: 20,
        },
        {
          id: 'merchant-rumor',
          text: '最近有什么消息吗？',
          nextNodeId: 'merchant-rumor-response',
          requiredAffinity: 40,
        },
        {
          id: 'merchant-bye',
          text: '下次再来',
          nextNodeId: null,
          isDefault: true,
        },
      ],
    },
    'merchant-buy-response': {
      id: 'merchant-buy-response',
      speaker: '商人',
      text: '好眼光！这批丝绸和茶叶都是上等货色，价格公道。',
      options: [
        {
          id: 'merchant-buy-confirm',
          text: '买了！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'grant_resource', value: 'gold', params: { amount: -100 } },
          ],
        },
        {
          id: 'merchant-buy-decline',
          text: '太贵了，下次吧',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: -2 },
          ],
        },
      ],
    },
    'merchant-rumor-response': {
      id: 'merchant-rumor-response',
      speaker: '商人',
      text: '听说北方的曹操正在大规模征兵，南方孙权也在加固城防……这天下怕是要大变了。',
      options: [
        {
          id: 'merchant-rumor-thanks',
          text: '多谢消息',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 3 },
            { type: 'unlock_info', value: 'north_military_movement' },
          ],
        },
      ],
    },
  },
};

/** 谋士默认对话树 */
export const DIALOG_TREE_STRATEGIST: DialogTree = {
  id: 'dialog-strategist-default',
  profession: 'strategist',
  startNodeId: 'strategist-start',
  nodes: {
    'strategist-start': {
      id: 'strategist-start',
      speaker: '谋士',
      text: '主公，天下大势，合久必分，分久必合。不知主公有何打算？',
      options: [
        {
          id: 'strategist-ask-plan',
          text: '先生有何高见？',
          nextNodeId: 'strategist-plan-response',
          requiredAffinity: 25,
        },
        {
          id: 'strategist-ask-intel',
          text: '打探一下各方势力的情报',
          nextNodeId: 'strategist-intel-response',
          requiredAffinity: 45,
        },
        {
          id: 'strategist-bye',
          text: '容后再议',
          nextNodeId: null,
          isDefault: true,
        },
      ],
    },
    'strategist-plan-response': {
      id: 'strategist-plan-response',
      speaker: '谋士',
      text: '依我之见，当先稳固根基，广积粮草，高筑城墙，待时机成熟再图大业。',
      options: [
        {
          id: 'strategist-accept',
          text: '先生所言极是',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 8 },
            { type: 'unlock_info', value: 'strategy_consolidate' },
          ],
        },
        {
          id: 'strategist-decline',
          text: '兵贵神速，我意已决',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: -5 },
          ],
        },
      ],
    },
    'strategist-intel-response': {
      id: 'strategist-intel-response',
      speaker: '谋士',
      text: '据我打探，曹操麾下谋士如云，刘备仁德广布，孙权据江东之险。三方势力各有优劣。',
      options: [
        {
          id: 'strategist-intel-thanks',
          text: '多谢先生',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'unlock_info', value: 'faction_intel_report' },
          ],
        },
      ],
    },
  },
};

/** 武将默认对话树 */
export const DIALOG_TREE_WARRIOR: DialogTree = {
  id: 'dialog-warrior-default',
  profession: 'warrior',
  startNodeId: 'warrior-start',
  nodes: {
    'warrior-start': {
      id: 'warrior-start',
      speaker: '武将',
      text: '哼，看你的样子，也是习武之人？可敢与我比试比试？',
      options: [
        {
          id: 'warrior-challenge',
          text: '来吧！一决高下！',
          nextNodeId: 'warrior-challenge-response',
          requiredAffinity: 20,
        },
        {
          id: 'warrior-train',
          text: '请教几招武艺',
          nextNodeId: 'warrior-train-response',
          requiredAffinity: 40,
        },
        {
          id: 'warrior-bye',
          text: '告辞',
          nextNodeId: null,
          isDefault: true,
        },
      ],
    },
    'warrior-challenge-response': {
      id: 'warrior-challenge-response',
      speaker: '武将',
      text: '好！痛快！且看谁更胜一筹！',
      options: [
        {
          id: 'warrior-fight',
          text: '开始比武',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 10 },
            { type: 'trigger_event', value: 'npc_challenge' },
          ],
        },
      ],
    },
    'warrior-train-response': {
      id: 'warrior-train-response',
      speaker: '武将',
      text: '好吧，看在你虚心求教的份上，我就教你几招实用的招式。',
      options: [
        {
          id: 'warrior-learn',
          text: '多谢指教！',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 6 },
            { type: 'unlock_item', value: 'combat_technique_basic' },
          ],
        },
      ],
    },
  },
};

/** 工匠默认对话树 */
export const DIALOG_TREE_ARTISAN: DialogTree = {
  id: 'dialog-artisan-default',
  profession: 'artisan',
  startNodeId: 'artisan-start',
  nodes: {
    'artisan-start': {
      id: 'artisan-start',
      speaker: '工匠',
      text: '我的手艺可是祖传的！不管是武器还是防具，我都能打造。需要什么？',
      options: [
        {
          id: 'artisan-craft',
          text: '帮我打造一件装备',
          nextNodeId: 'artisan-craft-response',
          requiredAffinity: 30,
        },
        {
          id: 'artisan-upgrade',
          text: '升级我的装备',
          nextNodeId: 'artisan-upgrade-response',
          requiredAffinity: 50,
        },
        {
          id: 'artisan-bye',
          text: '暂时不需要',
          nextNodeId: null,
          isDefault: true,
        },
      ],
    },
    'artisan-craft-response': {
      id: 'artisan-craft-response',
      speaker: '工匠',
      text: '好嘞！给我一些材料和时间，保证给你打造出上等货色！',
      options: [
        {
          id: 'artisan-craft-confirm',
          text: '就拜托你了',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'trigger_event', value: 'crafting_start' },
          ],
        },
      ],
    },
    'artisan-upgrade-response': {
      id: 'artisan-upgrade-response',
      speaker: '工匠',
      text: '升级装备需要稀有材料，不过放心，交给我准没错！',
      options: [
        {
          id: 'artisan-upgrade-confirm',
          text: '相信你的手艺',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 7 },
            { type: 'trigger_event', value: 'upgrade_start' },
          ],
        },
      ],
    },
  },
};

/** 旅人默认对话树 */
export const DIALOG_TREE_TRAVELER: DialogTree = {
  id: 'dialog-traveler-default',
  profession: 'traveler',
  startNodeId: 'traveler-start',
  nodes: {
    'traveler-start': {
      id: 'traveler-start',
      speaker: '旅人',
      text: '啊，又遇到一位旅途中的人。我走遍天下，见过许多奇闻异事，想听听吗？',
      options: [
        {
          id: 'traveler-story',
          text: '说说你的故事',
          nextNodeId: 'traveler-story-response',
        },
        {
          id: 'traveler-legend',
          text: '有什么传说吗？',
          nextNodeId: 'traveler-legend-response',
          requiredAffinity: 35,
        },
        {
          id: 'traveler-bye',
          text: '后会有期',
          nextNodeId: null,
          isDefault: true,
        },
      ],
    },
    'traveler-story-response': {
      id: 'traveler-story-response',
      speaker: '旅人',
      text: '有一次我在深山中发现了一座古墓，里面藏着上古的兵法和宝物……不过那地方危险重重。',
      options: [
        {
          id: 'traveler-story-interested',
          text: '古墓在哪里？',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 4 },
            { type: 'unlock_info', value: 'ancient_tomb_location' },
          ],
        },
        {
          id: 'traveler-story-cautious',
          text: '听起来很危险',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 2 },
          ],
        },
      ],
    },
    'traveler-legend-response': {
      id: 'traveler-legend-response',
      speaker: '旅人',
      text: '传说在极西之地，有一座通天塔，登顶者可得天命……不过至今无人成功。',
      options: [
        {
          id: 'traveler-legend-thanks',
          text: '有意思的传说',
          nextNodeId: null,
          effects: [
            { type: 'affinity_change', value: 5 },
            { type: 'unlock_info', value: 'legend_sky_tower' },
          ],
        },
      ],
    },
  },
};

/** 所有对话树映射 */
export const DIALOG_TREES: Record<string, DialogTree> = {
  'dialog-merchant-default': DIALOG_TREE_MERCHANT,
  'dialog-strategist-default': DIALOG_TREE_STRATEGIST,
  'dialog-warrior-default': DIALOG_TREE_WARRIOR,
  'dialog-artisan-default': DIALOG_TREE_ARTISAN,
  'dialog-traveler-default': DIALOG_TREE_TRAVELER,
} as const;

/** 对话树别名（按测试约定命名） */
export const DIALOG_MERCHANT_DEFAULT = DIALOG_TREE_MERCHANT;
export const DIALOG_STRATEGIST_DEFAULT = DIALOG_TREE_STRATEGIST;
export const DIALOG_WARRIOR_DEFAULT = DIALOG_TREE_WARRIOR;
export const DIALOG_ARTISAN_DEFAULT = DIALOG_TREE_ARTISAN;
export const DIALOG_TRAVELER_DEFAULT = DIALOG_TREE_TRAVELER;

// ─────────────────────────────────────────────
// 6. NPC 操作定义（#14）
// ─────────────────────────────────────────────

/** 根据职业和好感度获取可用操作 */
export function getAvailableActions(
  profession: NPCProfession,
  affinity: number,
): NPCAction[] {
  const def = NPC_PROFESSION_DEFS[profession];
  const actions: NPCAction[] = [
    {
      id: 'talk',
      label: '对话',
      icon: '💬',
      enabled: true,
      requiredAffinity: 0,
    },
    {
      id: def.interactionType,
      label: getInteractionLabel(def.interactionType),
      icon: def.icon,
      enabled: affinity >= def.defaultAffinity,
      disabledReason: affinity < def.defaultAffinity
        ? `需要好感度达到${def.defaultAffinity}`
        : undefined,
      requiredAffinity: def.defaultAffinity,
    },
    {
      id: 'gift',
      label: '赠送',
      icon: '🎁',
      enabled: affinity >= 30,
      disabledReason: affinity < 30 ? '需要好感度达到30' : undefined,
      requiredAffinity: 30,
    },
    {
      id: 'quest',
      label: '任务',
      icon: '📋',
      enabled: affinity >= 50,
      disabledReason: affinity < 50 ? '需要好感度达到50' : undefined,
      requiredAffinity: 50,
    },
  ];
  return actions;
}

/** 获取交互类型中文名 */
function getInteractionLabel(type: string): string {
  const labels: Record<string, string> = {
    trade: '交易',
    intel: '情报',
    challenge: '比武',
    craft: '锻造',
    story: '故事',
  };
  return labels[type] ?? '交互';
}

// ─────────────────────────────────────────────
// 7. 存档版本
// ─────────────────────────────────────────────

/** NPC 存档版本号 */
export const NPC_SAVE_VERSION = 1;
