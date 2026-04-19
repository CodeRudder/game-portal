/**
 * 各职业的预设对话和行为模板
 *
 * 为 7 种 NPC 职业提供完整的默认日程、对话、闲聊话题、
 * 动画名称、配色方案和图标等配置。
 *
 * 使用方式：
 *   import { PROFESSION_TEMPLATES } from './ProfessionTemplates';
 *   const farmer = PROFESSION_TEMPLATES[NPCProfession.FARMER];
 *
 * @module engine/npc/ProfessionTemplates
 */

import { NPCProfession, NPCState } from './types';
import type { ScheduleItem, NPCDialogue } from './types';

// ---------------------------------------------------------------------------
// 模板类型
// ---------------------------------------------------------------------------

/** 职业模板结构 */
export interface ProfessionTemplate {
  /** 默认日程表 */
  defaultSchedule: ScheduleItem[];
  /** 预设对话列表 */
  dialogues: NPCDialogue[];
  /** 闲聊话题池 */
  chatTopics: string[];
  /** 工作动画名称 */
  workAnimation: string;
  /** 待机动画名称 */
  idleAnimation: string;
  /** 主色与副色 */
  colors: { primary: string; secondary: string };
  /** Emoji 图标 */
  iconEmoji: string;
}

// ---------------------------------------------------------------------------
// 7 种职业模板
// ---------------------------------------------------------------------------

export const PROFESSION_TEMPLATES: Record<NPCProfession, ProfessionTemplate> = {
  // =========================================================================
  // 农民
  // =========================================================================
  [NPCProfession.FARMER]: {
    defaultSchedule: [
      { hour: 6, state: NPCState.WALKING, targetBuildingId: 'farm' },
      { hour: 7, state: NPCState.WORKING, targetBuildingId: 'farm' },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.WORKING, targetBuildingId: 'farm' },
      { hour: 18, state: NPCState.WALKING, targetX: 5, targetY: 5 },
      { hour: 19, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'farmer_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '客官好！今年的收成不错啊。' },
          {
            speaker: 'npc',
            text: '需要些什么粮食吗？',
            choices: [
              { text: '购买粮食', nextLineIndex: 2, action: 'open_shop' },
              { text: '聊聊收成', nextLineIndex: 3 },
              { text: '告辞', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '好的，请看看这些粮食。' },
          { speaker: 'npc', text: '今年风调雨顺，小麦和稻子都长得好！' },
        ],
      },
      {
        id: 'farmer_weather',
        trigger: 'proximity',
        lines: [
          { speaker: 'npc', text: '看这天色，怕是要下雨了。' },
          { speaker: 'npc', text: '得赶紧把晒的粮食收起来。' },
        ],
      },
    ],
    chatTopics: ['天气', '收成', '种子', '牲畜', '节日'],
    workAnimation: 'farming',
    idleAnimation: 'standing',
    colors: { primary: '#4CAF50', secondary: '#8BC34A' },
    iconEmoji: '👨‍🌾',
  },

  // =========================================================================
  // 士兵
  // =========================================================================
  [NPCProfession.SOLDIER]: {
    defaultSchedule: [
      { hour: 5, state: NPCState.WORKING, targetBuildingId: 'barracks' },
      { hour: 8, state: NPCState.PATROLLING },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.PATROLLING },
      { hour: 18, state: NPCState.WORKING, targetBuildingId: 'barracks' },
      { hour: 20, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'soldier_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '站住！请出示通行证。' },
          {
            speaker: 'npc',
            text: '……哦，是您啊，请进。',
            choices: [
              { text: '最近有什么情况？', nextLineIndex: 2 },
              { text: '辛苦了', nextLineIndex: 3 },
              { text: '告辞', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '最近边境有些小动静，不过一切尽在掌握。' },
          { speaker: 'npc', text: '多谢关心，保家卫国是我们的职责。' },
        ],
      },
    ],
    chatTopics: ['训练', '巡逻', '武器', '边境', '战报'],
    workAnimation: 'training',
    idleAnimation: 'guard_standing',
    colors: { primary: '#F44336', secondary: '#E57373' },
    iconEmoji: '🗡️',
  },

  // =========================================================================
  // 商人
  // =========================================================================
  [NPCProfession.MERCHANT]: {
    defaultSchedule: [
      { hour: 7, state: NPCState.WALKING, targetBuildingId: 'market' },
      { hour: 8, state: NPCState.TRADING, targetBuildingId: 'market' },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.TRADING, targetBuildingId: 'market' },
      { hour: 18, state: NPCState.WALKING, targetX: 10, targetY: 8 },
      { hour: 19, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'merchant_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '欢迎光临！小店有不少好东西。' },
          {
            speaker: 'npc',
            text: '您需要些什么？',
            choices: [
              { text: '看看商品', nextLineIndex: 2, action: 'open_shop' },
              { text: '打听消息', nextLineIndex: 3 },
              { text: '改天再来', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '请随意挑选，价格公道！' },
          { speaker: 'npc', text: '听说最近有一批稀有货物要运来。' },
        ],
      },
    ],
    chatTopics: ['价格', '货物', '商路', '利润', '稀有物品'],
    workAnimation: 'trading',
    idleAnimation: 'standing',
    colors: { primary: '#FF9800', secondary: '#FFB74D' },
    iconEmoji: '💰',
  },

  // =========================================================================
  // 武将
  // =========================================================================
  [NPCProfession.GENERAL]: {
    defaultSchedule: [
      { hour: 6, state: NPCState.WORKING, targetBuildingId: 'headquarters' },
      { hour: 9, state: NPCState.PATROLLING },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.WORKING, targetBuildingId: 'training_ground' },
      { hour: 18, state: NPCState.WALKING, targetBuildingId: 'headquarters' },
      { hour: 20, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'general_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '嗯？有何要事？' },
          {
            speaker: 'npc',
            text: '军务繁忙，请简明扼要。',
            choices: [
              { text: '汇报军情', nextLineIndex: 2 },
              { text: '请求增援', nextLineIndex: 3 },
              { text: '打扰了', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '知道了，我会安排人手处理。' },
          { speaker: 'npc', text: '兵力紧张，容我从长计议。' },
        ],
      },
    ],
    chatTopics: ['战略', '练兵', '粮草', '士气', '布阵'],
    workAnimation: 'commanding',
    idleAnimation: 'standing_proud',
    colors: { primary: '#9C27B0', secondary: '#CE93D8' },
    iconEmoji: '⚔️',
  },

  // =========================================================================
  // 工匠
  // =========================================================================
  [NPCProfession.CRAFTSMAN]: {
    defaultSchedule: [
      { hour: 7, state: NPCState.WALKING, targetBuildingId: 'workshop' },
      { hour: 8, state: NPCState.WORKING, targetBuildingId: 'workshop' },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.WORKING, targetBuildingId: 'workshop' },
      { hour: 18, state: NPCState.WALKING, targetX: 8, targetY: 6 },
      { hour: 19, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'craftsman_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '叮叮当当……哦，你好！' },
          {
            speaker: 'npc',
            text: '需要打造什么吗？',
            choices: [
              { text: '打造武器', nextLineIndex: 2, action: 'open_shop' },
              { text: '修理装备', nextLineIndex: 3 },
              { text: '下次再来', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '好铁配好匠，包您满意！' },
          { speaker: 'npc', text: '放这儿吧，明天就能修好。' },
        ],
      },
    ],
    chatTopics: ['锻造', '材料', '图纸', '新工艺', '工具'],
    workAnimation: 'forging',
    idleAnimation: 'standing',
    colors: { primary: '#795548', secondary: '#A1887F' },
    iconEmoji: '🔨',
  },

  // =========================================================================
  // 书生
  // =========================================================================
  [NPCProfession.SCHOLAR]: {
    defaultSchedule: [
      { hour: 8, state: NPCState.WALKING, targetBuildingId: 'academy' },
      { hour: 9, state: NPCState.WORKING, targetBuildingId: 'academy' },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.WORKING, targetBuildingId: 'academy' },
      { hour: 17, state: NPCState.WALKING, targetX: 15, targetY: 10 },
      { hour: 19, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'scholar_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '子曰：有朋自远方来，不亦乐乎。' },
          {
            speaker: 'npc',
            text: '阁下有何赐教？',
            choices: [
              { text: '请教问题', nextLineIndex: 2 },
              { text: '借阅书籍', nextLineIndex: 3 },
              { text: '告辞', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '这个问题嘛……让我想想。' },
          { speaker: 'npc', text: '书架在那边，请自便。' },
        ],
      },
    ],
    chatTopics: ['读书', '诗词', '历史', '哲学', '时事'],
    workAnimation: 'reading',
    idleAnimation: 'standing',
    colors: { primary: '#2196F3', secondary: '#64B5F6' },
    iconEmoji: '📚',
  },

  // =========================================================================
  // 村民
  // =========================================================================
  [NPCProfession.VILLAGER]: {
    defaultSchedule: [
      { hour: 7, state: NPCState.WALKING, targetX: 12, targetY: 8 },
      { hour: 8, state: NPCState.IDLE },
      { hour: 10, state: NPCState.WORKING, targetBuildingId: 'village_center' },
      { hour: 12, state: NPCState.RESTING },
      { hour: 14, state: NPCState.WALKING, targetX: 8, targetY: 12 },
      { hour: 16, state: NPCState.IDLE },
      { hour: 19, state: NPCState.RESTING },
    ],
    dialogues: [
      {
        id: 'villager_greeting',
        trigger: 'click',
        lines: [
          { speaker: 'npc', text: '你好呀！今天天气真好。' },
          {
            speaker: 'npc',
            text: '有什么可以帮忙的吗？',
            choices: [
              { text: '打听消息', nextLineIndex: 2 },
              { text: '闲聊', nextLineIndex: 3 },
              { text: '再见', action: 'end_dialogue' },
            ],
          },
          { speaker: 'npc', text: '最近村里挺太平的，没什么大事。' },
          { speaker: 'npc', text: '听说隔壁村要办庙会，热闹着呢！' },
        ],
      },
    ],
    chatTopics: ['天气', '邻居家事', '庙会', '家常', '美食'],
    workAnimation: 'working',
    idleAnimation: 'standing',
    colors: { primary: '#607D8B', secondary: '#90A4AE' },
    iconEmoji: '🏘️',
  },
};
