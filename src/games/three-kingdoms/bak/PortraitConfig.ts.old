/**
 * games/three-kingdoms/PortraitConfig.ts — 武将/NPC 立绘配置
 *
 * 定义武将和 NPC 的程序化立绘参数，用于在对话系统、
 * NPC 渲染等场景中生成人物立绘。
 *
 * @module games/three-kingdoms/PortraitConfig
 */

// ═══════════════════════════════════════════════════════════════
// 武将立绘配置
// ═══════════════════════════════════════════════════════════════

/** 武将立绘参数（程序化生成用） */
export interface PortraitConfig {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 主色调（十六进制字符串） */
  primaryColor: string;
  /** 辅助色（十六进制字符串） */
  secondaryColor: string;
  /** 帽子样式 */
  hatStyle: 'crown' | 'helmet' | 'scholar' | 'band' | 'none';
  /** 脸型 */
  faceStyle: 'square' | 'round' | 'angular';
  /** 是否有胡须 */
  hasBeard: boolean;
  /** 武器类型 */
  weaponType: 'sword' | 'spear' | 'fan' | 'bow' | 'none';
}

/** 武将立绘配置表 */
export const HERO_PORTRAITS: Record<string, PortraitConfig> = {
  liubei: {
    id: 'liubei', name: '刘备',
    primaryColor: '#8B4513', secondaryColor: '#FFD700',
    hatStyle: 'crown', faceStyle: 'round',
    hasBeard: true, weaponType: 'sword',
  },
  guanyu: {
    id: 'guanyu', name: '关羽',
    primaryColor: '#228B22', secondaryColor: '#8B0000',
    hatStyle: 'band', faceStyle: 'angular',
    hasBeard: true, weaponType: 'spear',
  },
  zhangfei: {
    id: 'zhangfei', name: '张飞',
    primaryColor: '#2F4F4F', secondaryColor: '#696969',
    hatStyle: 'helmet', faceStyle: 'square',
    hasBeard: true, weaponType: 'spear',
  },
  zhugeliang: {
    id: 'zhugeliang', name: '诸葛亮',
    primaryColor: '#4169E1', secondaryColor: '#FFFFFF',
    hatStyle: 'scholar', faceStyle: 'angular',
    hasBeard: false, weaponType: 'fan',
  },
  caocao: {
    id: 'caocao', name: '曹操',
    primaryColor: '#800020', secondaryColor: '#FFD700',
    hatStyle: 'crown', faceStyle: 'angular',
    hasBeard: true, weaponType: 'sword',
  },
  simayi: {
    id: 'simayi', name: '司马懿',
    primaryColor: '#4B0082', secondaryColor: '#C0C0C0',
    hatStyle: 'scholar', faceStyle: 'angular',
    hasBeard: true, weaponType: 'fan',
  },
  zhaoyun: {
    id: 'zhaoyun', name: '赵云',
    primaryColor: '#F5F5F5', secondaryColor: '#4169E1',
    hatStyle: 'helmet', faceStyle: 'round',
    hasBeard: false, weaponType: 'spear',
  },
  lvbu: {
    id: 'lvbu', name: '吕布',
    primaryColor: '#8B0000', secondaryColor: '#FFD700',
    hatStyle: 'helmet', faceStyle: 'square',
    hasBeard: false, weaponType: 'spear',
  },
};

// ═══════════════════════════════════════════════════════════════
// NPC 职业立绘配置
// ═══════════════════════════════════════════════════════════════

/** NPC 职业立绘参数 */
export interface NPCPortraitConfig {
  /** 主题颜色（十六进制字符串） */
  color: string;
  /** 代表图标（Emoji） */
  icon: string;
  /** 中文标签 */
  label: string;
}

/** NPC 职业立绘配置表 */
export const NPC_PORTRAITS: Record<string, NPCPortraitConfig> = {
  farmer:   { color: '#4CAF50', icon: '🌾', label: '农民' },
  soldier:  { color: '#F44336', icon: '⚔️', label: '士兵' },
  merchant: { color: '#FFC107', icon: '💰', label: '商人' },
  scholar:  { color: '#2196F3', icon: '📚', label: '学者' },
  scout:    { color: '#9C27B0', icon: '🔍', label: '斥候' },
};

// ═══════════════════════════════════════════════════════════════
// 建筑立绘配置
// ═══════════════════════════════════════════════════════════════

/** 建筑立绘参数 */
export interface BuildingPortraitConfig {
  /** 屋顶样式 */
  roof: 'triangle' | 'flat' | 'curved';
  /** 主体样式 */
  body: 'rect';
  /** 主题颜色（十六进制数字） */
  color: number;
  /** 中文标签 */
  label: string;
}

/** 建筑立绘配置表 */
export const BUILDING_PORTRAITS: Record<string, BuildingPortraitConfig> = {
  yamen:     { roof: 'triangle', body: 'rect', color: 0xFFD700, label: '衙门' },
  residence: { roof: 'triangle', body: 'rect', color: 0xDEB887, label: '民居' },
  shop:      { roof: 'triangle', body: 'rect', color: 0xFF8C00, label: '商铺' },
  barracks:  { roof: 'flat',     body: 'rect', color: 0x4169E1, label: '兵营' },
  market:    { roof: 'curved',   body: 'rect', color: 0xFF6347, label: '市场' },
  smithy:    { roof: 'triangle', body: 'rect', color: 0x808080, label: '铁匠铺' },
  tavern:    { roof: 'triangle', body: 'rect', color: 0x8B4513, label: '酒馆' },
  academy:   { roof: 'curved',   body: 'rect', color: 0x800080, label: '书院' },
  wall:      { roof: 'flat',     body: 'rect', color: 0xA0A0A0, label: '城墙' },
};
