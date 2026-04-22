/**
 * 核心层 — NPC 对话树配置
 *
 * 包含 5 种职业的默认对话树、对话树映射和别名。
 *
 * @module core/npc/npc-config-dialogs
 */

import type { DialogTree } from './npc.types';

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
