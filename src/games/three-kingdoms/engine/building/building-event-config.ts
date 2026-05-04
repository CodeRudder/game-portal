/**
 * 建筑域 — 建筑事件配置（21种事件定义）
 *
 * 7类建筑 × 3种事件类型(immediate/sustained/special)
 * 独立于 BuildingEventSystem，便于热更新和配置管理
 *
 * @module engine/building/building-event-config
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 事件类型分类 */
export type BuildingEventType = 'immediate' | 'sustained' | 'special';

/** 事件选项的奖励 — 即时资源 或 持续buff */
export type EventReward =
  | { resource: string; amount: number }
  | { buffType: string; multiplier: number; durationMs: number };

/** 事件选项 */
export interface BuildingEventOption {
  id: string;
  label: string;
  reward: EventReward;
}

/** 事件定义 */
export interface BuildingEventDef {
  id: string;
  buildingType: string;
  eventType: BuildingEventType;
  title: string;
  description: string;
  options: BuildingEventOption[];
  cooldownHours: number;
}

// ─────────────────────────────────────────────
// 7类建筑 × 3种事件 = 21种事件
// ─────────────────────────────────────────────

export const BUILDING_EVENT_DEFS: BuildingEventDef[] = [
  // ═══ castle（主城）═══
  {
    id: 'castle_immediate_01',
    buildingType: 'castle',
    eventType: 'immediate',
    title: '城主嘉奖',
    description: '城主下令赏赐有功之臣，大量资源涌入国库',
    options: [
      { id: 'opt_grain', label: '领取粮草', reward: { resource: 'grain', amount: 500 } },
      { id: 'opt_gold', label: '领取金币', reward: { resource: 'gold', amount: 300 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'castle_sustained_01',
    buildingType: 'castle',
    eventType: 'sustained',
    title: '民心所向',
    description: '百姓安居乐业，全城产出提升',
    options: [
      { id: 'opt_celebrate', label: '举办庆典', reward: { buffType: 'productionBonus', multiplier: 0.10, durationMs: 7200000 } },
      { id: 'opt_restock', label: '补充储备', reward: { buffType: 'productionBonus', multiplier: 0.05, durationMs: 14400000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'castle_special_01',
    buildingType: 'castle',
    eventType: 'special',
    title: '天降祥瑞',
    description: '祥瑞之兆降临，所有建筑升级加速',
    options: [
      { id: 'opt_speedup', label: '加速升级', reward: { buffType: 'upgradeSpeed', multiplier: 0.5, durationMs: 3600000 } },
      { id: 'opt_free', label: '免费修复', reward: { resource: 'gold', amount: 200 } },
    ],
    cooldownHours: 24,
  },

  // ═══ farmland（农田）═══
  {
    id: 'farmland_immediate_01',
    buildingType: 'farmland',
    eventType: 'immediate',
    title: '甘霖普降',
    description: '久旱逢甘霖，庄稼喜获滋润',
    options: [
      { id: 'opt_store', label: '储备水源', reward: { resource: 'grain', amount: 400 } },
      { id: 'opt_sell', label: '出售余粮', reward: { resource: 'gold', amount: 200 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'farmland_sustained_01',
    buildingType: 'farmland',
    eventType: 'sustained',
    title: '风调雨顺',
    description: '气候宜人，农田产出提升',
    options: [
      { id: 'opt_expand', label: '扩大耕种', reward: { buffType: 'grainBonus', multiplier: 0.10, durationMs: 7200000 } },
      { id: 'opt_conserve', label: '精耕细作', reward: { buffType: 'grainBonus', multiplier: 0.06, durationMs: 10800000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'farmland_special_01',
    buildingType: 'farmland',
    eventType: 'special',
    title: '丰收祭典',
    description: '百年一遇的大丰收，百姓欢庆',
    options: [
      { id: 'opt_feast', label: '举办盛宴', reward: { resource: 'grain', amount: 800 } },
      { id: 'opt_buff', label: '祈福增产', reward: { buffType: 'grainBonus', multiplier: 0.15, durationMs: 3600000 } },
    ],
    cooldownHours: 24,
  },

  // ═══ market（市集）═══
  {
    id: 'market_immediate_01',
    buildingType: 'market',
    eventType: 'immediate',
    title: '商队来访',
    description: '远方商队带来珍稀货物',
    options: [
      { id: 'opt_trade', label: '以物易物', reward: { resource: 'gold', amount: 350 } },
      { id: 'opt_buy_wood', label: '采购木材', reward: { resource: 'wood', amount: 300 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'market_sustained_01',
    buildingType: 'market',
    eventType: 'sustained',
    title: '税收调整',
    description: '朝廷调整商税政策，贸易繁荣',
    options: [
      { id: 'opt_low_tax', label: '减税惠民', reward: { buffType: 'tradeBonus', multiplier: 0.12, durationMs: 7200000 } },
      { id: 'opt_fair', label: '举办集市', reward: { buffType: 'tradeBonus', multiplier: 0.08, durationMs: 10800000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'market_special_01',
    buildingType: 'market',
    eventType: 'special',
    title: '商路开辟',
    description: '发现新的商路，贸易量激增',
    options: [
      { id: 'opt_gold_rush', label: '大量交易', reward: { resource: 'gold', amount: 600 } },
      { id: 'opt_trade_buff', label: '长期合作', reward: { buffType: 'tradeBonus', multiplier: 0.20, durationMs: 3600000 } },
    ],
    cooldownHours: 24,
  },

  // ═══ barracks（兵营）═══
  {
    id: 'barracks_immediate_01',
    buildingType: 'barracks',
    eventType: 'immediate',
    title: '征兵令',
    description: '战事吃紧，紧急征召新兵',
    options: [
      { id: 'opt_volunteer', label: '志愿从军', reward: { resource: 'troops', amount: 200 } },
      { id: 'opt_conscript', label: '强制征兵', reward: { resource: 'troops', amount: 500 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'barracks_sustained_01',
    buildingType: 'barracks',
    eventType: 'sustained',
    title: '军事演习',
    description: '将军提议进行军事演习',
    options: [
      { id: 'opt_intensive', label: '高强度训练', reward: { buffType: 'attackBonus', multiplier: 0.12, durationMs: 7200000 } },
      { id: 'opt_light', label: '轻度操练', reward: { buffType: 'attackBonus', multiplier: 0.06, durationMs: 10800000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'barracks_special_01',
    buildingType: 'barracks',
    eventType: 'special',
    title: '名将降临',
    description: '一位传奇名将到访兵营',
    options: [
      { id: 'opt_train', label: '请教兵法', reward: { buffType: 'attackBonus', multiplier: 0.20, durationMs: 3600000 } },
      { id: 'opt_recruit', label: '招募入伍', reward: { resource: 'troops', amount: 400 } },
    ],
    cooldownHours: 24,
  },

  // ═══ workshop（工坊）═══
  {
    id: 'workshop_immediate_01',
    buildingType: 'workshop',
    eventType: 'immediate',
    title: '矿脉发现',
    description: '工坊附近发现新矿脉',
    options: [
      { id: 'opt_mine', label: '立即开采', reward: { resource: 'ore', amount: 500 } },
      { id: 'opt_sell_ore', label: '出售矿石', reward: { resource: 'gold', amount: 250 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'workshop_sustained_01',
    buildingType: 'workshop',
    eventType: 'sustained',
    title: '图纸残片',
    description: '获得古代锻造图纸残片',
    options: [
      { id: 'opt_restore', label: '修复图纸', reward: { buffType: 'forgeBonus', multiplier: 0.15, durationMs: 7200000 } },
      { id: 'opt_improve', label: '改良工艺', reward: { buffType: 'forgeBonus', multiplier: 0.08, durationMs: 10800000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'workshop_special_01',
    buildingType: 'workshop',
    eventType: 'special',
    title: '天工开物',
    description: '工坊大师完成传世之作',
    options: [
      { id: 'opt_equip', label: '打造装备', reward: { resource: 'ore', amount: 800 } },
      { id: 'opt_forge_buff', label: '锻造加速', reward: { buffType: 'forgeBonus', multiplier: 0.25, durationMs: 3600000 } },
    ],
    cooldownHours: 24,
  },

  // ═══ academy（书院）═══
  {
    id: 'academy_immediate_01',
    buildingType: 'academy',
    eventType: 'immediate',
    title: '学者来访',
    description: '著名学者到访书院',
    options: [
      { id: 'opt_lecture', label: '举办讲座', reward: { resource: 'techPoint', amount: 150 } },
      { id: 'opt_exchange', label: '学术交流', reward: { resource: 'techPoint', amount: 100 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'academy_sustained_01',
    buildingType: 'academy',
    eventType: 'sustained',
    title: '百家争鸣',
    description: '各学派展开激烈辩论',
    options: [
      { id: 'opt_moderate', label: '兼容并蓄', reward: { buffType: 'researchBonus', multiplier: 0.12, durationMs: 7200000 } },
      { id: 'opt_focus', label: '专注研究', reward: { buffType: 'researchBonus', multiplier: 0.08, durationMs: 10800000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'academy_special_01',
    buildingType: 'academy',
    eventType: 'special',
    title: '学术突破',
    description: '书院取得重大学术突破',
    options: [
      { id: 'opt_publish', label: '公开发表', reward: { resource: 'techPoint', amount: 300 } },
      { id: 'opt_secret', label: '秘而不宣', reward: { buffType: 'researchBonus', multiplier: 0.25, durationMs: 3600000 } },
    ],
    cooldownHours: 24,
  },

  // ═══ clinic（医馆）═══
  {
    id: 'clinic_immediate_01',
    buildingType: 'clinic',
    eventType: 'immediate',
    title: '医馆捐赠',
    description: '善心人士捐赠药材',
    options: [
      { id: 'opt_accept', label: '接受捐赠', reward: { resource: 'grain', amount: 200 } },
      { id: 'opt_sell_herbs', label: '出售药材', reward: { resource: 'gold', amount: 150 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'clinic_sustained_01',
    buildingType: 'clinic',
    eventType: 'sustained',
    title: '名医坐诊',
    description: '著名神医在医馆坐诊',
    options: [
      { id: 'opt_learn', label: '请教医术', reward: { buffType: 'healBonus', multiplier: 0.15, durationMs: 7200000 } },
      { id: 'opt_herbal', label: '草药治疗', reward: { buffType: 'healBonus', multiplier: 0.08, durationMs: 10800000 } },
    ],
    cooldownHours: 24,
  },
  {
    id: 'clinic_special_01',
    buildingType: 'clinic',
    eventType: 'special',
    title: '瘟疫控制',
    description: '成功控制了一场瘟疫',
    options: [
      { id: 'opt_quarantine', label: '隔离封锁', reward: { resource: 'troops', amount: 100 } },
      { id: 'opt_heal_buff', label: '全民免疫', reward: { buffType: 'healBonus', multiplier: 0.20, durationMs: 3600000 } },
    ],
    cooldownHours: 24,
  },
];

/** 默认冷却时间（小时） */
export const DEFAULT_COOLDOWN_HOURS = 24;

/** 按建筑类型分组的事件映射 */
export function getEventsByBuildingType(buildingType: string): BuildingEventDef[] {
  return BUILDING_EVENT_DEFS.filter((e) => e.buildingType === buildingType);
}

/** 获取所有支持事件的建筑类型 */
export function getEventBuildingTypes(): string[] {
  const types = new Set(BUILDING_EVENT_DEFS.map((e) => e.buildingType));
  return Array.from(types);
}
