/**
 * ThreeKingdomsPixiGame — 三国霸业 PixiJS 渲染页面组件（增强版）
 *
 * 整合增强后的 PixiJS 渲染器（MapScene + CombatScene + AnimationManager + AssetManager），
 * 并通过 React DOM overlay 提供完整的 UI 层。
 *
 * 架构：
 *   Engine → RenderStateAdapter → GameRenderState → PixiGameCanvas → PixiJS Renderer
 *                                                            ↕
 *                                                    React UI Overlay
 *
 * 功能：
 * - 资源预加载（AssetManager.loadKenneySpritesheet）
 * - 地图场景集成（MapScene：魏蜀吴领土、城市/关卡、拖拽缩放）
 * - 战斗场景集成（CombatScene：武将对战、技能特效、战斗日志）
 * - UI 层：资源栏、建筑面板、武将面板、操作按钮
 *
 * @module components/idle/ThreeKingdomsPixiGame
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import type { CampaignSystem } from '@/games/three-kingdoms/CampaignSystem';
import { CAMPAIGN_STAGE_DEFINITIONS, ERA_COLORS, DIFFICULTY_DISPLAY } from '@/games/three-kingdoms/ThreeKingdomsCampaign';
import { ThreeKingdomsRenderStateAdapter } from '@/games/three-kingdoms/ThreeKingdomsRenderStateAdapter';
import { ThreeKingdomsEventSystem, type ActiveEvent, type EventChoice } from '@/games/three-kingdoms/ThreeKingdomsEventSystem';
import { MapGenerator, type GameMap } from '@/games/three-kingdoms/MapGenerator';
import {
  BUILDINGS,
  GENERALS,
  BATTLES,
  COLOR_THEME,
  RARITY_COLORS,
  RESOURCES,
  TECHS,
} from '@/games/three-kingdoms/constants';
import PixiGameCanvas from '@/renderer/components/PixiGameCanvas';
import type { GameRenderState, SceneType, HeroRenderData } from '@/renderer/types';
import { AudioManager } from '@/games/idle-subsystems/AudioManager';
import { TKParticleSystem } from '@/games/three-kingdoms/ParticleSystem';
import { drawGeneralPortrait, GENERAL_PORTRAITS } from '@/games/three-kingdoms/GeneralPortraitRenderer';
import { getGeneralById } from '@/games/three-kingdoms/GeneralData';
import type { DialogueEvent } from '@/games/three-kingdoms/ThreeKingdomsEngine';
import type { ActiveStoryEvent, StoryLine } from '@/games/three-kingdoms/GeneralStoryEventSystem';
import type { GeneralRequest } from '@/games/three-kingdoms/GeneralBondSystem';
import { BuildingIcon, ResourceIcon, BuildingProgressBar, TechIcon, TechLockedIcon, TechResearchingIcon, SkillIcon, EquipSlotIcon } from './ThreeKingdomsSVGIcons';
import './ThreeKingdomsPixiGame.css';
import './ThreeKingdomsPixiGame-r16.css';

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 格式化大数字 */
function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n < 10 ? n.toFixed(1) : Math.floor(n).toString();
}

/**
 * 场景标签配置
 *
 * 精简为 4 个核心 Tab：
 * - 🗺️ 地图（默认）：包含建筑/领土子视图 + 声望浮层入口
 * - ⚔️ 武将：武将详情
 * - 📜 科技：科技树
 * - 🏆 关卡：关卡信息 + 战斗入口
 *
 * 战斗场景由引擎事件自动触发切换，不作为独立 Tab。
 * 声望功能通过地图场景的浮层按钮进入。
 */
const SCENE_TABS: { scene: SceneType; label: string; icon: string; subScene?: string; key: string }[] = [
  { scene: 'map',        label: '地图', icon: '🗺️', subScene: 'building', key: 'Escape' },
  { scene: 'hero-detail', label: '武将', icon: '⚔️', key: 'u' },
  { scene: 'tech-tree',  label: '科技', icon: '📜', key: 't' },
  { scene: 'stage-info', label: '关卡', icon: '🏆', key: 's' },
];

// ═══════════════════════════════════════════════════════════════
// 新手引导步骤
// ═══════════════════════════════════════════════════════════════

const GUIDE_STEPS = [
  { title: '欢迎来到三国霸业！', text: '建造农田开始你的征程。点击左侧"农田"建筑卡片来建造。', target: 'building' as const },
  { title: '招募武将', text: '有了资源后，在右侧面板招募武将为你效力！', target: 'hero' as const },
  { title: '发起战斗', text: '准备好后，点击底部"关卡"按钮，开始征战！', target: 'combat' as const },
];

/** Toast 提示数据 */
interface ToastData {
  id: number;
  text: string;
  type: 'success' | 'error';
}

/** 任务数据 */
interface QuestData {
  id: string;
  title: string;
  description: string;
  progress: number;
  maxProgress: number;
  isComplete: boolean;
  reward: Record<string, number>;
}

/** NPC 对话数据 */
interface NPCDialogue {
  npcName: string;
  npcType: string;
  lines: string[];
  currentLine: number;
}

// ═══════════════════════════════════════════════════════════════
// NPC 详细信息数据
// ═══════════════════════════════════════════════════════════════

/** NPC 属性数据（武将专属） */
interface NPCAttributes {
  force: number;      // 武力
  intelligence: number; // 智力
  command: number;    // 统帅
  defense: number;    // 防御
}

/** NPC 可购买物品（商人专属） */
interface NPCShopItem {
  name: string;
  price: number;
  description: string;
}

/** NPC 详细信息 */
interface NPCInfoData {
  name: string;
  title: string;
  description: string;
  profession: string;
  /** 武将属性（仅武将） */
  attributes?: NPCAttributes;
  /** 可购买物品（仅商人） */
  shopItems?: NPCShopItem[];
  /** 士兵职责（仅士兵） */
  duty?: string;
}

/**
 * NPC 详细信息映射表
 *
 * 根据 NPC defId 或 NPC ID 前缀匹配，提供丰富的角色信息。
 * 包含武将属性、商人商品、士兵职责等职业特有数据。
 */
const NPC_INFO_MAP: Record<string, NPCInfoData> = {
  // ── 武将 ──────────────────────────────────────────────
  general_guan: {
    name: '关铁柱',
    title: '忠义武将',
    description: '自幼习武，忠心耿耿。传闻乃关羽后裔，使一口青龙偃月刀，威震四方。',
    profession: 'general',
    attributes: { force: 92, intelligence: 65, command: 78, defense: 80 },
  },
  general_zhang: {
    name: '张豹胆',
    title: '猛将先锋',
    description: '天生神力，性格豪爽。据说一声怒吼可退千军，军中无人不知其勇。',
    profession: 'general',
    attributes: { force: 96, intelligence: 45, command: 60, defense: 72 },
  },
  // ── 士兵 ──────────────────────────────────────────────
  soldier_wang: {
    name: '王守义',
    title: '城门守卫',
    description: '忠于职守，保卫城池。十年如一日守卫城门，从未擅离职守。',
    profession: 'soldier',
    duty: '城门守卫 — 负责北城门安全，盘查来往行人',
  },
  soldier_li: {
    name: '李铁枪',
    title: '巡逻兵',
    description: '巡逻城内各处，维护治安。百姓称赞其公正严明。',
    profession: 'soldier',
    duty: '城内巡逻 — 日夜轮值，维护城内治安',
  },
  // ── 商人 ──────────────────────────────────────────────
  merchant_chen: {
    name: '陈富贵',
    title: '行商',
    description: '四处行商，贩卖各地特产。从西域到东吴，无处不有其足迹。',
    profession: 'merchant',
    shopItems: [
      { name: '精铁矿石', price: 50, description: '打造兵器的上好材料' },
      { name: '蜀锦', price: 80, description: '益州特产，质地细腻' },
      { name: '西域香料', price: 120, description: '稀有香料，可入药' },
    ],
  },
  merchant_zhao: {
    name: '赵聚宝',
    title: '古董商',
    description: '经营古玩珍宝，据说手中常有稀世之物。眼光独到，鲜有走眼。',
    profession: 'merchant',
    shopItems: [
      { name: '青铜剑', price: 200, description: '上古名剑，锋利无比' },
      { name: '玉佩', price: 150, description: '温润如脂，可辟邪' },
      { name: '兵法残卷', price: 300, description: '疑似孙子兵法残篇' },
    ],
  },
  // ── 学者 ──────────────────────────────────────────────
  scholar_sun: {
    name: '孙明理',
    title: '大儒',
    description: '饱读诗书，学富五车。常为官府出谋划策，深受百姓敬仰。',
    profession: 'scholar',
  },
  scholar_zhou: {
    name: '周文远',
    title: '书生',
    description: '年轻有为，才华横溢。正在研习经史子集，志在科举入仕。',
    profession: 'scholar',
  },
  // ── 农民 ──────────────────────────────────────────────
  farmer_liu: {
    name: '刘老根',
    title: '老农',
    description: '种了一辈子地，经验丰富。今年收成不错，乐得合不拢嘴。',
    profession: 'farmer',
  },
  farmer_zhang: {
    name: '张稻穗',
    title: '佃农',
    description: '勤劳朴实，日出而作日落而息。是村里最勤快的庄稼人。',
    profession: 'farmer',
  },
  // ── 工匠 ──────────────────────────────────────────────
  craftsman_tie: {
    name: '铁锤',
    title: '铁匠',
    description: '锻造技术精湛，打造过无数利器。军中许多兵器皆出自其手。',
    profession: 'craftsman',
  },
  craftsman_mu: {
    name: '木巧',
    title: '木匠',
    description: '擅长建筑与机关术，城中不少建筑由其设计建造。',
    profession: 'craftsman',
  },
};

/**
 * 根据 NPC ID 获取 NPC 详细信息
 *
 * 先精确匹配 NPC ID，再尝试按 defId 匹配，
 * 最后按职业前缀匹配兜底。
 */
function getNPCInfoById(npcId: string, npcType: string): NPCInfoData | null {
  // 精确匹配
  if (NPC_INFO_MAP[npcId]) return NPC_INFO_MAP[npcId];
  // 按 defId 前缀匹配
  const prefix = npcType || '';
  for (const key of Object.keys(NPC_INFO_MAP)) {
    if (npcId.startsWith(key) || key.startsWith(npcId)) return NPC_INFO_MAP[key];
  }
  // 按职业匹配兜底
  const professionPrefixes: Record<string, string[]> = {
    general: ['general_guan', 'general_zhang'],
    soldier: ['soldier_wang', 'soldier_li'],
    merchant: ['merchant_chen', 'merchant_zhao'],
    scholar: ['scholar_sun', 'scholar_zhou'],
    farmer: ['farmer_liu', 'farmer_zhang'],
    craftsman: ['craftsman_tie', 'craftsman_mu'],
  };
  const fallbacks = professionPrefixes[prefix];
  if (fallbacks && fallbacks.length > 0) {
    return NPC_INFO_MAP[fallbacks[npcId.charCodeAt(0) % fallbacks.length]];
  }
  return null;
}

/** 存档槽位 */
interface SaveSlot {
  id: string;
  name: string;
  time: number;
  preview: string;
}

// ═══════════════════════════════════════════════════════════════
// 成就定义
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENTS = [
  { id: 'first_territory', name: '初出茅庐', desc: '占领第一块领土', check: (s: Record<string, number>) => s.territories >= 1, icon: '🏰' },
  { id: 'five_territories', name: '小有成就', desc: '占领5块领土', check: (s: Record<string, number>) => s.territories >= 5, icon: '⚔️' },
  { id: 'all_territories', name: '一统天下', desc: '占领所有领土', check: (s: Record<string, number>) => s.territories >= 15, icon: '👑' },
  { id: 'first_hero', name: '招贤纳士', desc: '招募第一位武将', check: (s: Record<string, number>) => s.heroes >= 1, icon: '🦸' },
  { id: 'all_heroes', name: '群英荟萃', desc: '招募所有武将', check: (s: Record<string, number>) => s.heroes >= 12, icon: '🌟' },
  { id: 'first_tech', name: '科技创新', desc: '研究第一项科技', check: (s: Record<string, number>) => s.techs >= 1, icon: '🔬' },
  { id: 'all_techs', name: '科技强国', desc: '研究所有科技', check: (s: Record<string, number>) => s.techs >= 12, icon: '📚' },
  { id: 'first_battle', name: '初战告捷', desc: '完成第一场战斗', check: (s: Record<string, number>) => s.battles >= 1, icon: '🗡️' },
  { id: 'veteran', name: '身经百战', desc: '完成10场战斗', check: (s: Record<string, number>) => s.battles >= 10, icon: '⚔️' },
  { id: 'first_prestige', name: '声望初成', desc: '完成第一次声望转生', check: (s: Record<string, number>) => s.prestige >= 1, icon: '✨' },
  { id: 'gold_10k', name: '富甲一方', desc: '累计获得10000铜钱', check: (s: Record<string, number>) => s.totalGold >= 10000, icon: '💰' },
  { id: 'grain_10k', name: '粮食满仓', desc: '累计获得10000粮草', check: (s: Record<string, number>) => s.totalGrain >= 10000, icon: '🌾' },
];

// ═══════════════════════════════════════════════════════════════
// 征战关卡面板组件
// ═══════════════════════════════════════════════════════════════

/** 关卡状态对应的显示文本和颜色 */
const STAGE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  locked: { label: '🔒', color: '#666' },
  available: { label: '⚔️', color: '#6b8e5a' },
  in_progress: { label: '⚔️', color: '#d4a030' },
  victory: { label: '✅', color: '#4a6fa5' },
  defeated: { label: '💀', color: '#a85241' },
};

/** 难度对应的颜色和标签 */
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: '简单', color: '#6b8e5a', bg: 'rgba(107,142,90,0.15)' },
  normal: { label: '普通', color: '#d4a030', bg: 'rgba(212,160,48,0.15)' },
  hard: { label: '困难', color: '#b87333', bg: 'rgba(184,115,51,0.15)' },
  legendary: { label: '传奇', color: '#c62828', bg: 'rgba(198,40,40,0.15)' },
};

/** 兵种图标映射 */
const TROOP_ICONS: Record<string, string> = {
  infantry: '🗡️',
  cavalry: '🐎',
  archers: '🏹',
};

/** 关卡类型图标映射 */
const STAGE_TYPE_ICONS: Record<string, { icon: string; label: string }> = {
  '黄巾之乱': { icon: '⚔️', label: '战斗' },
  '讨伐董卓': { icon: '⚔️', label: '战斗' },
  '群雄割据': { icon: '🤝', label: '外交' },
  '官渡之战': { icon: '⚔️', label: '战斗' },
  '赤壁之战': { icon: '🛡️', label: '防守' },
  '三分天下': { icon: '🌾', label: '资源' },
};

/** 关卡悬停策略提示 */
const STAGE_STRATEGY_TIPS: Record<string, string> = {
  '黄巾之乱': '🔥 火攻克制黄巾军 +20%',
  '讨伐董卓': '🏰 虎牢关城防 +15%',
  '群雄割据': '🤝 外交联盟兵力 +25%',
  '官渡之战': '⚔️ 奇袭乌巢伤害 +30%',
  '赤壁之战': '🌊 水战火攻 +35%',
  '三分天下': '🌾 终局资源产出 +50%',
};

/** 关卡场景预览渐变映射 */
const STAGE_PREVIEW_GRADIENTS: Record<string, string> = {
  '黄巾': 'linear-gradient(180deg, #5c1a0a 0%, #a83210 60%, #ff6600 100%)',
  '董卓': 'linear-gradient(180deg, #4a3a2a 0%, #6b5a48 60%, #8a7a6a 100%)',
  '群雄': 'linear-gradient(180deg, #3a2a3a 0%, #5a4a5a 60%, #7a6a7a 100%)',
  '官渡': 'linear-gradient(180deg, #3a4a5a 0%, #5a6a7a 60%, #3a5a7a 100%)',
  '赤壁': 'linear-gradient(180deg, #1a2040 0%, #3a2050 60%, #ff4400 100%)',
  '三国': 'linear-gradient(180deg, #3a2a10 0%, #6a5a30 60%, #d4a030 100%)',
};

/** 城防星级显示（满星10） */
function fortLevelStars(level: number): string {
  return '★'.repeat(level) + '☆'.repeat(Math.max(0, 10 - level));
}

/**

/**
 * 关卡场景插画 —— 根据时代名称返回对应的 SVG 场景
 * 使用 CSS 渐变 + SVG 简笔画实现，不需要外部图片
 */
function StageSceneIllustration({ era, name }: { era: string; name: string }) {
  const scenes: Record<string, () => React.ReactElement> = {
    '黄巾': () => (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky-hj" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c1a0a" />
            <stop offset="100%" stopColor="#a83210" />
          </linearGradient>
          <radialGradient id="fire-hj" cx="50%" cy="80%" r="40%">
            <stop offset="0%" stopColor="#ff6600" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff3300" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="120" fill="url(#sky-hj)" />
        <ellipse cx="60" cy="90" rx="50" ry="30" fill="url(#fire-hj)" />
        <ellipse cx="150" cy="85" rx="40" ry="25" fill="url(#fire-hj)" />
        <path d="M50,75 Q55,55 60,70 Q65,50 70,68 Q72,52 75,72 Q78,58 80,75" fill="#ff6600" opacity="0.7" />
        <path d="M140,70 Q145,50 150,65 Q155,45 160,63 Q162,48 165,70" fill="#ff4400" opacity="0.7" />
        <ellipse cx="100" cy="40" rx="60" ry="15" fill="#8B7355" opacity="0.3" />
        <ellipse cx="80" cy="30" rx="40" ry="10" fill="#8B7355" opacity="0.2" />
        <rect x="0" y="95" width="200" height="25" fill="#3a2010" opacity="0.8" />
        <circle cx="90" cy="88" r="3" fill="#1a0a00" />
        <rect x="88" y="91" width="4" height="6" fill="#1a0a00" />
        <circle cx="110" cy="86" r="3" fill="#1a0a00" />
        <rect x="108" y="89" width="4" height="6" fill="#1a0a00" />
      </svg>
    ),
    '董卓': () => (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky-dz" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a3a2a" />
            <stop offset="100%" stopColor="#6b5a48" />
          </linearGradient>
        </defs>
        <rect width="200" height="120" fill="url(#sky-dz)" />
        <rect x="60" y="40" width="80" height="55" fill="#7a6a5a" />
        <rect x="55" y="35" width="90" height="10" fill="#8a7a6a" />
        <path d="M88,95 L88,70 Q100,60 112,70 L112,95" fill="#3a2a1a" />
        {[62,72,82,92,102,112,122,132].map((x,i) => (
          <rect key={i} x={x} y="28" width="6" height="10" fill="#8a7a6a" />
        ))}
        <line x1="70" y1="28" x2="70" y2="15" stroke="#6b5a48" strokeWidth="1" />
        <polygon points="70,15 85,18 70,22" fill="#c62828" opacity="0.8" />
        {[30,38,46,150,158,166].map((x,i) => (
          <g key={i}>
            <circle cx={x} cy="88" r="2.5" fill="#2a1a0a" />
            <rect x={x-2} y="90.5" width="4" height="5" fill="#2a1a0a" />
          </g>
        ))}
        <rect x="0" y="95" width="200" height="25" fill="#4a3a2a" opacity="0.6" />
      </svg>
    ),
    '群雄': () => (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky-qx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a3a" />
            <stop offset="100%" stopColor="#5a4a5a" />
          </linearGradient>
        </defs>
        <rect width="200" height="120" fill="url(#sky-qx)" />
        <path d="M0,90 Q30,65 60,80 Q90,60 120,75 Q150,55 180,70 Q200,65 200,90 L200,120 L0,120" fill="#4a3a2a" opacity="0.5" />
        {[
          { x: 30, color: '#c62828' }, { x: 70, color: '#4a6fa5' }, { x: 110, color: '#2e7d32' },
          { x: 150, color: '#d4a030' }, { x: 180, color: '#8a2be2' },
        ].map((f, i) => (
          <g key={i}>
            <line x1={f.x} y1={85} x2={f.x} y2={55 + i * 3} stroke="#8B7355" strokeWidth="1" />
            <polygon points={`${f.x},${55 + i * 3} ${f.x + 15},${58 + i * 3} ${f.x},${62 + i * 3}`} fill={f.color} opacity="0.7" />
          </g>
        ))}
        <rect x="0" y="95" width="200" height="25" fill="#3a2a1a" opacity="0.6" />
      </svg>
    ),
    '官渡': () => (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky-gd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4a5a" />
            <stop offset="100%" stopColor="#5a6a7a" />
          </linearGradient>
        </defs>
        <rect width="200" height="120" fill="url(#sky-gd)" />
        <path d="M0,65 Q50,55 100,65 Q150,75 200,60 L200,80 Q150,90 100,80 Q50,70 0,80 Z" fill="#3a5a7a" opacity="0.6" />
        <path d="M20,70 Q40,67 60,72" stroke="#5a8aaa" strokeWidth="0.5" fill="none" opacity="0.5" />
        <path d="M120,68 Q140,65 160,70" stroke="#5a8aaa" strokeWidth="0.5" fill="none" opacity="0.5" />
        {[30,40,50,60,70,80].map((x,i) => (
          <g key={`n${i}`}>
            <circle cx={x} cy={50 - (i % 2) * 2} r="2" fill="#1a1a2a" />
            <rect x={x-1.5} y={52 - (i % 2) * 2} width="3" height="4" fill="#1a1a2a" />
          </g>
        ))}
        {[120,130,140,150,160,170].map((x,i) => (
          <g key={`s${i}`}>
            <circle cx={x} cy={85 - (i % 2) * 2} r="2" fill="#2a1a1a" />
            <rect x={x-1.5} y={87 - (i % 2) * 2} width="3" height="4" fill="#2a1a1a" />
          </g>
        ))}
        <path d="M0,55 Q50,48 100,55 Q150,62 200,52 L200,60 Q150,70 100,62 Q50,55 0,65 Z" fill="#5a4a3a" opacity="0.4" />
        <rect x="0" y="95" width="200" height="25" fill="#3a2a1a" opacity="0.4" />
      </svg>
    ),
    '赤壁': () => (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky-cb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2040" />
            <stop offset="100%" stopColor="#3a2050" />
          </linearGradient>
          <radialGradient id="fire-cb" cx="50%" cy="60%" r="35%">
            <stop offset="0%" stopColor="#ff4400" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff2200" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="120" fill="url(#sky-cb)" />
        <rect x="0" y="55" width="200" height="40" fill="#2a3a5a" opacity="0.5" />
        <ellipse cx="100" cy="70" rx="70" ry="20" fill="url(#fire-cb)" />
        {[50, 80, 120, 150].map((x, i) => (
          <g key={i}>
            <ellipse cx={x} cy={68 + (i % 2) * 4} rx="8" ry="3" fill="#5a3a1a" />
            <path d={`M${x-3},${65 + (i % 2) * 4} Q${x},${50 + i * 2} ${x+3},${65 + (i % 2) * 4}`} fill="#ff4400" opacity="0.8" />
            <path d={`M${x-1},${63 + (i % 2) * 4} Q${x},${48 + i * 2} ${x+1},${63 + (i % 2) * 4}`} fill="#ffaa00" opacity="0.6" />
          </g>
        ))}
        <path d="M0,75 Q25,72 50,76 Q75,73 100,77 Q125,74 150,78 Q175,75 200,76" stroke="#5a7aaa" strokeWidth="0.5" fill="none" opacity="0.3" />
        <rect x="0" y="95" width="200" height="25" fill="#1a1020" opacity="0.5" />
      </svg>
    ),
    '三国': () => (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky-sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a10" />
            <stop offset="100%" stopColor="#6a5a30" />
          </linearGradient>
        </defs>
        <rect width="200" height="120" fill="url(#sky-sg)" />
        <path d="M85,75 L80,90 L120,90 L115,75 Z" fill="#b87333" />
        <rect x="82" y="70" width="36" height="8" rx="2" fill="#d4a030" />
        <rect x="90" y="90" width="4" height="10" fill="#b87333" />
        <rect x="106" y="90" width="4" height="10" fill="#b87333" />
        <g>
          <line x1="40" y1="85" x2="40" y2="40" stroke="#8B7355" strokeWidth="1.5" />
          <polygon points="40,40 60,45 40,52" fill="#c62828" opacity="0.8" />
          <text x="44" y="48" fontSize="6" fill="#fff" opacity="0.8">蜀</text>
        </g>
        <g>
          <line x1="100" y1="65" x2="100" y2="20" stroke="#8B7355" strokeWidth="1.5" />
          <polygon points="100,20 120,25 100,32" fill="#4a6fa5" opacity="0.8" />
          <text x="104" y="28" fontSize="6" fill="#fff" opacity="0.8">魏</text>
        </g>
        <g>
          <line x1="160" y1="85" x2="160" y2="40" stroke="#8B7355" strokeWidth="1.5" />
          <polygon points="160,40 180,45 160,52" fill="#2e7d32" opacity="0.8" />
          <text x="164" y="48" fontSize="6" fill="#fff" opacity="0.8">吴</text>
        </g>
        <rect x="0" y="100" width="200" height="20" fill="#3a2a10" opacity="0.5" />
      </svg>
    ),
  };

  const SceneFn = scenes[era];
  if (!SceneFn) {
    return (
      <div className="tk-stage-scene" style={{ background: 'linear-gradient(180deg, #3a2a1a, #5a4a3a)' }}>
        <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="120" fill="#3a2a1a" />
          <text x="100" y="65" textAnchor="middle" fontSize="14" fill="#8B7355">{name}</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="tk-stage-scene">
      <SceneFn />
    </div>
  );
}

/**
 * 关卡详情弹窗 —— 展示关卡完整信息（守将、兵力、城防、奖励）
 * 点击关卡列表项时弹出此弹窗。
 */
function LevelDetailModal({
  detail,
  statusInfo,
  canAttack,
  era,
  onBattleStart,
  onClose,
  COLOR_THEME: CT,
}: {
  detail: NonNullable<ReturnType<CampaignSystem['getLevelDetail']>>;
  statusInfo: { canAttack: boolean; reason?: string };
  canAttack: boolean;
  era?: string;
  onBattleStart: () => void;
  onClose: () => void;
  COLOR_THEME: typeof COLOR_THEME;
}) {
  const diff = DIFFICULTY_CONFIG[detail.battleConfig.difficulty] ?? DIFFICULTY_CONFIG.normal;
  const totalTroops = detail.defender.troops.infantry + detail.defender.troops.cavalry + detail.defender.troops.archers;

  return (
    <div className="tk-r16-modal-overlay">
      <div className="tk-r16-modal-scroll">
        {/* 上卷轴装饰 */}
        <div className="tk-r16-scroll-decor tk-r16-scroll-decor--top">
          <svg viewBox="0 0 400 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="0" cy="10" rx="16" ry="10" fill="#8B7355" />
            <ellipse cx="400" cy="10" rx="16" ry="10" fill="#8B7355" />
            <rect x="14" y="6" width="372" height="8" rx="2" fill="#6a5a3a" />
            <rect x="14" y="8" width="372" height="1" fill="#d4a030" opacity="0.4" />
          </svg>
        </div>

        {/* 标题行 */}
        <div className="tk-r16-modal-header">
          <h2 className="tk-r16-modal-title">◆ {detail.name}</h2>
          <span className="tk-r16-modal-diff" style={{ color: diff.color, background: diff.bg }}>{diff.label}</span>
          <button className="tk-r16-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 场景插画 */}
        <StageSceneIllustration era={era ?? ''} name={detail.name} />

        {/* ── 战力对比条（红蓝对比） ── */}
        <div className="tk-r16-power-compare">
          <div className="tk-r16-power-compare__title">⚔️ 兵力对比</div>
          <div className="tk-r16-power-compare__bar-wrap">
            <div className="tk-r16-power-compare__ally">
              <span className="tk-r16-power-compare__label">我方</span>
            </div>
            <div className="tk-r16-power-compare__bar">
              <div className="tk-r16-power-compare__bar-ally" style={{ width: '55%' }} />
              <div className="tk-r16-power-compare__bar-enemy" style={{ width: '45%' }} />
            </div>
            <div className="tk-r16-power-compare__enemy">
              <span className="tk-r16-power-compare__label">敌方</span>
            </div>
          </div>
        </div>

        {/* ── 守将头像 + 兵力可视化 ── */}
        <div className="tk-r16-defender-card">
          <div className="tk-r16-defender-avatar">
            <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id={`def-bg-${detail.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3a1a1a" />
                  <stop offset="100%" stopColor="#5a2a2a" />
                </linearGradient>
              </defs>
              <rect width="48" height="48" rx="6" fill={`url(#def-bg-${detail.id})`} />
              <circle cx="24" cy="16" r="8" fill="#deb887" />
              <path d="M16,14 Q24,4 32,14" fill="#333" />
              <rect x="16" y="24" width="16" height="18" rx="3" fill="#8b1a1a" />
              <line x1="24" y1="24" x2="24" y2="42" stroke="#d4a030" strokeWidth="1" />
              <text x="24" y="35" textAnchor="middle" fontSize="8" fill="#d4a030">将</text>
            </svg>
          </div>
          <div className="tk-r16-defender-info">
            <div className="tk-r16-defender-lord">🏴 {detail.defender.lord}</div>
            <div className="tk-r16-troop-bar-wrap">
              <div className="tk-r16-troop-bar">
                {detail.defender.troops.infantry > 0 && (
                  <div className="tk-r16-troop-seg tk-r16-troop-seg--infantry"
                    style={{ flex: detail.defender.troops.infantry }}
                    title={`步兵 ${detail.defender.troops.infantry}`} />
                )}
                {detail.defender.troops.cavalry > 0 && (
                  <div className="tk-r16-troop-seg tk-r16-troop-seg--cavalry"
                    style={{ flex: detail.defender.troops.cavalry }}
                    title={`骑兵 ${detail.defender.troops.cavalry}`} />
                )}
                {detail.defender.troops.archers > 0 && (
                  <div className="tk-r16-troop-seg tk-r16-troop-seg--archers"
                    style={{ flex: detail.defender.troops.archers }}
                    title={`弓兵 ${detail.defender.troops.archers}`} />
                )}
              </div>
              <div className="tk-r16-troop-legend">
                <span><span style={{ color: '#4a6fa5' }}>■</span> 步{detail.defender.troops.infantry}</span>
                <span><span style={{ color: '#c62828' }}>■</span> 骑{detail.defender.troops.cavalry}</span>
                <span><span style={{ color: '#2e7d32' }}>■</span> 弓{detail.defender.troops.archers}</span>
              </div>
            </div>
            <div className="tk-r16-troop-total">总兵力：<strong>{totalTroops}</strong></div>
          </div>
        </div>

        {/* 历史叙事描述 */}
        <div className="tk-r16-modal-desc">
          <p>{detail.description}</p>
        </div>

        {/* 推荐武将提示 */}
        <RecommendedGeneralsTip stageName={detail.name} CT={CT} />

        {/* 城防 */}
        <div className="tk-r16-fort-info">
          <span className="tk-r16-fort-label">🏰 城防</span>
          <span className="tk-r16-fort-stars">{fortLevelStars(detail.defender.fortLevel)}</span>
          <span className="tk-r16-fort-level">Lv.{detail.defender.fortLevel}</span>
        </div>

        {/* 战利品预览 */}
        {detail.rewards && <LootPreview rewards={detail.rewards} />}

        {/* 无法攻打原因 */}
        {!canAttack && statusInfo.reason && (
          <div className="tk-r16-cannot-attack">{statusInfo.reason}</div>
        )}

        {/* 操作按钮 */}
        <div className="tk-r16-modal-actions">
          <button className="tk-r16-btn tk-r16-btn--back" onClick={onClose}>返回</button>
          {canAttack && (
            <button className="tk-r16-btn tk-r16-btn--attack" onClick={onBattleStart}>⚔️ 进攻</button>
          )}
        </div>

        {/* 下卷轴装饰 */}
        <div className="tk-r16-scroll-decor tk-r16-scroll-decor--bottom">
          <svg viewBox="0 0 400 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="0" cy="10" rx="16" ry="10" fill="#8B7355" />
            <ellipse cx="400" cy="10" rx="16" ry="10" fill="#8B7355" />
            <rect x="14" y="6" width="372" height="8" rx="2" fill="#6a5a3a" />
            <rect x="14" y="11" width="372" height="1" fill="#d4a030" opacity="0.4" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// R16 关卡视觉增强 — 古风圆章序号 + 战斗预览面板 + 路径连接
// ═══════════════════════════════════════════════════════════════

/** 古风圆章序号 SVG —— 关卡序号用印章样式 */
function StageSealNumber({ number, status }: { number: number; status: string }) {
  const isLocked = status === 'locked';
  const isVictory = status === 'victory';
  const isActive = status === 'available' || status === 'in_progress';
  const sealColor = isLocked ? '#555' : isVictory ? '#d4a030' : isActive ? '#c62828' : '#8a7a6a';
  const bgColor = isLocked ? 'rgba(40,40,40,0.8)' : isVictory ? 'rgba(50,40,20,0.9)' : isActive ? 'rgba(60,20,20,0.9)' : 'rgba(50,40,30,0.8)';

  return (
    <div className="tk-stage-seal" style={{ background: bgColor, borderColor: sealColor }}>
      <svg viewBox="0 0 36 36" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="15" fill="none" stroke={sealColor} strokeWidth="1.5" opacity="0.6" />
        <circle cx="18" cy="18" r="12" fill="none" stroke={sealColor} strokeWidth="0.5" opacity="0.4" />
        <text x="18" y="22" textAnchor="middle" fontSize="14" fill={sealColor}
          fontFamily="'KaiTi','STKaiti','Noto Serif SC',serif" fontWeight="bold">
          {number}
        </text>
      </svg>
    </div>
  );
}

/** 关卡路径连接线 SVG —— 关卡之间的古道连接 */
function StagePathConnector({ fromVictory, isLast }: { fromVictory: boolean; isLast: boolean }) {
  if (isLast) return null;
  return (
    <div className={`tk-stage-path-connector ${fromVictory ? 'tk-stage-path-connector--victory' : ''}`}>
      <svg viewBox="0 0 24 20" width="24" height="20" xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="0" x2="12" y2="14" stroke={fromVictory ? '#d4a030' : '#5a4a3a'} strokeWidth="1.5" strokeDasharray="3,2" />
        {fromVictory && <polygon points="8,12 12,18 16,12" fill="#d4a030" opacity="0.7" />}
        {!fromVictory && <polygon points="9,13 12,17 15,13" fill="#5a4a3a" opacity="0.5" />}
      </svg>
    </div>
  );
}

/** 章节横幅标题 —— 古风横幅样式 */
function ChapterBanner({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div className="tk-chapter-banner" style={{ '--banner-color': color } as React.CSSProperties}>
      <div className="tk-chapter-banner__bg">
        <svg viewBox="0 0 400 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,8 L15,0 L385,0 L400,8 L400,32 L385,40 L15,40 L0,32 Z" fill="currentColor" opacity="0.12" />
          <path d="M0,8 L15,0 L385,0 L400,8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <path d="M0,32 L15,40 L385,40 L400,32" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          {/* 横幅两端装饰 */}
          <circle cx="20" cy="20" r="4" fill="currentColor" opacity="0.2" />
          <circle cx="380" cy="20" r="4" fill="currentColor" opacity="0.2" />
          <path d="M8,12 L12,20 L8,28" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
          <path d="M392,12 L388,20 L392,28" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        </svg>
      </div>
      <div className="tk-chapter-banner__content">
        <span className="tk-chapter-banner__title">{title}</span>
        {subtitle && <span className="tk-chapter-banner__subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}

/** 战斗预览面板 —— 攻击前显示战力对比 */
function BattlePreviewPanel({
  battlePreview,
  defenderPower,
  defenderLord,
  CT,
}: {
  battlePreview: NonNullable<GameRenderState['campaign']>['battlePreview'];
  defenderPower: number;
  defenderLord: string;
  CT: typeof COLOR_THEME;
}) {
  if (!battlePreview) return null;

  const { attackerPower, defenderPower: previewDefenderPower, winProbability } = battlePreview;
  const totalPower = attackerPower + (previewDefenderPower || defenderPower);
  const attackerRatio = totalPower > 0 ? attackerPower / totalPower : 0.5;

  // 胜率等级
  let winLevel: 'high' | 'medium' | 'low';
  let winColor: string;
  let winLabel: string;
  if (winProbability >= 0.7) {
    winLevel = 'high'; winColor = '#4ade80'; winLabel = '高';
  } else if (winProbability >= 0.4) {
    winLevel = 'medium'; winColor = '#facc15'; winLabel = '中';
  } else {
    winLevel = 'low'; winColor = '#ef4444'; winLabel = '低';
  }

  return (
    <div className="tk-battle-preview">
      <div className="tk-battle-preview__title">⚔️ 战力对比</div>
      {/* 战力对比条 */}
      <div className="tk-battle-preview__bar">
        <div className="tk-battle-preview__bar-fill tk-battle-preview__bar-fill--ally" style={{ width: `${attackerRatio * 100}%` }}>
          <span className="tk-battle-preview__bar-label">{Math.floor(attackerPower).toLocaleString()}</span>
        </div>
        <div className="tk-battle-preview__bar-fill tk-battle-preview__bar-fill--enemy" style={{ width: `${(1 - attackerRatio) * 100}%` }}>
          <span className="tk-battle-preview__bar-label">{Math.floor(previewDefenderPower || defenderPower).toLocaleString()}</span>
        </div>
      </div>
      <div className="tk-battle-preview__labels">
        <span className="tk-battle-preview__ally">我方</span>
        <span className="tk-battle-preview__enemy">🏴 {defenderLord}</span>
      </div>
      {/* 胜率预估 */}
      <div className="tk-battle-preview__winrate">
        <span className="tk-battle-preview__winrate-label">胜率预估</span>
        <span className={`tk-battle-preview__winrate-badge tk-battle-preview__winrate-badge--${winLevel}`}>
          {winLabel} {Math.round(winProbability * 100)}%
        </span>
      </div>
    </div>
  );
}

/** 推荐武将提示 */
function RecommendedGeneralsTip({ stageName, CT }: { stageName: string; CT: typeof COLOR_THEME }) {
  const recommendations: Record<string, Array<{ name: string; reason: string; icon: string }>> = {
    '黄巾之乱': [
      { name: '刘备', reason: '仁德克制暴乱', icon: '🟢' },
      { name: '关羽', reason: '武圣斩将', icon: '🔴' },
      { name: '张飞', reason: '猛将冲锋', icon: '🟡' },
    ],
    '讨伐董卓': [
      { name: '吕布', reason: '虎牢关破阵', icon: '🔴' },
      { name: '关羽', reason: '温酒斩华雄', icon: '🟢' },
      { name: '张飞', reason: '三英战吕布', icon: '🟡' },
    ],
    '群雄割据': [
      { name: '曹操', reason: '挟天子令诸侯', icon: '🔵' },
      { name: '荀彧', reason: '王佐之才', icon: '🟣' },
      { name: '郭嘉', reason: '奇谋制胜', icon: '🟢' },
    ],
    '官渡之战': [
      { name: '曹操', reason: '奇袭乌巢', icon: '🔵' },
      { name: '许攸', reason: '献计破袁', icon: '🟡' },
      { name: '张辽', reason: '突袭先锋', icon: '🔴' },
    ],
    '赤壁之战': [
      { name: '诸葛亮', reason: '借东风火攻', icon: '🟢' },
      { name: '周瑜', reason: '大都督统军', icon: '🔴' },
      { name: '黄盖', reason: '苦肉计诈降', icon: '🟡' },
    ],
    '三分天下': [
      { name: '诸葛亮', reason: '六出祁山', icon: '🟢' },
      { name: '司马懿', reason: '深谋远虑', icon: '🔵' },
      { name: '姜维', reason: '九伐中原', icon: '🔴' },
    ],
  };

  const recs = recommendations[stageName];
  if (!recs) return null;

  return (
    <div className="tk-recommended-generals">
      <div className="tk-recommended-generals__title">💡 推荐武将</div>
      <div className="tk-recommended-generals__list">
        {recs.map((rec, i) => (
          <div key={i} className="tk-recommended-generals__item">
            <span className="tk-recommended-generals__icon">{rec.icon}</span>
            <span className="tk-recommended-generals__name">{rec.name}</span>
            <span className="tk-recommended-generals__reason">{rec.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 战利品预览 —— 可能获得的资源/武将 */
function LootPreview({ rewards }: { rewards: { gold?: number; food?: number; materials?: number; recruitHero?: string; unlockBuilding?: string } }) {
  if (!rewards) return null;
  const items: Array<{ icon: string; label: string; value: string; rare?: boolean }> = [];
  if (rewards.gold && rewards.gold > 0) items.push({ icon: '💰', label: '金', value: fmt(rewards.gold) });
  if (rewards.food && rewards.food > 0) items.push({ icon: '🌾', label: '粮', value: fmt(rewards.food) });
  if (rewards.materials && rewards.materials > 0) items.push({ icon: '📦', label: '材', value: fmt(rewards.materials) });
  if (rewards.recruitHero) items.push({ icon: '🧑‍✈️', label: '武将', value: rewards.recruitHero, rare: true });
  if (rewards.unlockBuilding) items.push({ icon: '🏗️', label: '建筑', value: rewards.unlockBuilding, rare: true });

  if (items.length === 0) return null;

  return (
    <div className="tk-loot-preview">
      <div className="tk-loot-preview__title">🎁 战利品预览</div>
      <div className="tk-loot-preview__grid">
        {items.map((item, i) => (
          <div key={i} className={`tk-loot-preview__item ${item.rare ? 'tk-loot-preview__item--rare' : ''}`}>
            <span className="tk-loot-preview__item-icon">{item.icon}</span>
            <span className="tk-loot-preview__item-value">{item.value}</span>
            <span className="tk-loot-preview__item-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 关卡历史场景名称映射 */
const STAGE_HISTORICAL_NAMES: Record<string, string> = {
  '黄巾之乱': '黄巾之乱',
  '讨伐董卓': '虎牢关之战',
  '群雄割据': '群雄割据',
  '官渡之战': '官渡之战',
  '赤壁之战': '赤壁之战',
  '三分天下': '三分天下',
};

/** 关卡背景故事 */
const STAGE_LORE: Record<string, string> = {
  '黄巾之乱': '东汉末年，张角率黄巾军起义，天下大乱。刘备、关羽、张飞桃园结义，共讨黄巾。',
  '讨伐董卓': '董卓把持朝政，残暴不仁。十八路诸侯联合讨伐，虎牢关前三英战吕布。',
  '群雄割据': '董卓伏诛后，群雄并起。曹操迎天子，袁绍据河北，天下纷争不断。',
  '官渡之战': '曹操与袁绍决战于官渡，以少胜多，奇袭乌巢，奠定北方霸业。',
  '赤壁之战': '孙刘联军以火攻大破曹军于赤壁，天下三分之势初成。',
  '三分天下': '魏蜀吴三足鼎立，诸葛亮六出祁山，司马懿深谋远虑，天下归一之势渐显。',
};

/** 关卡敌方武将展示 */
const STAGE_ENEMY_GENERALS: Record<string, Array<{ name: string; title: string; icon: string }>> = {
  '黄巾之乱': [
    { name: '张角', title: '天公将军', icon: '🧙' },
    { name: '张宝', title: '地公将军', icon: '🧙' },
    { name: '张梁', title: '人公将军', icon: '🧙' },
  ],
  '讨伐董卓': [
    { name: '董卓', title: '太师', icon: '👹' },
    { name: '吕布', title: '飞将', icon: '⚔️' },
    { name: '华雄', title: '骁将', icon: '🗡️' },
  ],
  '群雄割据': [
    { name: '袁绍', title: '大将军', icon: '👑' },
    { name: '袁术', title: '仲家帝', icon: '👑' },
    { name: '刘表', title: '荆州牧', icon: '🏰' },
  ],
  '官渡之战': [
    { name: '袁绍', title: '河北霸主', icon: '👑' },
    { name: '颜良', title: '河北名将', icon: '⚔️' },
    { name: '文丑', title: '河北名将', icon: '⚔️' },
  ],
  '赤壁之战': [
    { name: '曹操', title: '丞相', icon: '🐉' },
    { name: '张辽', title: '合肥战神', icon: '⚔️' },
    { name: '蔡瑁', title: '水军都督', icon: '⚓' },
  ],
  '三分天下': [
    { name: '司马懿', title: '冢虎', icon: '🐅' },
    { name: '曹丕', title: '魏文帝', icon: '👑' },
    { name: '孙权', title: '吴大帝', icon: '🐉' },
  ],
};

/** 关卡推荐战力 */
const STAGE_RECOMMENDED_POWER: Record<string, string> = {
  '黄巾之乱': '500+',
  '讨伐董卓': '1,500+',
  '群雄割据': '3,000+',
  '官渡之战': '6,000+',
  '赤壁之战': '12,000+',
  '三分天下': '25,000+',
};

/** 征战关卡面板 — 增强版（R17: 关卡图标升级+弹窗优化） */
function CampaignPanel({
  engine,
  renderState,
  onClose,
  onBattleStart,
  COLOR_THEME: CT,
}: {
  engine: ThreeKingdomsEngine | null;
  renderState: GameRenderState | undefined;
  onClose: () => void;
  onBattleStart: (stageId: string) => void;
  addToast: (text: string, type: 'success' | 'error') => void;
  COLOR_THEME: typeof COLOR_THEME;
}) {
  const [detailStageId, setDetailStageId] = useState<string | null>(null);
  const campaignData = renderState?.campaign;

  // 获取关卡列表
  const stages = useMemo(() => campaignData?.stageStatuses ?? [], [campaignData]);

  // 获取详情弹窗所需数据
  const detailData = useMemo(() => {
    if (!detailStageId || !engine) return null;
    const campaignSys = engine.getCampaignSystem();
    const detail = campaignSys.getLevelDetail(detailStageId);
    if (!detail) return null;
    const statusInfo = campaignSys.getLevelStatus(detailStageId);
    return { detail, statusInfo, canAttack: statusInfo.canAttack };
  }, [detailStageId, engine]);

  // 关卡元数据（时代、难度、战力）
  const stageMeta = useMemo(() => {
    const map = new Map<string, typeof CAMPAIGN_STAGE_DEFINITIONS[number]>();
    for (const def of CAMPAIGN_STAGE_DEFINITIONS) {
      map.set(def.id, def);
    }
    return map;
  }, []);

  // 关卡 ID 到元数据定义的映射（基于顺序）
  const stageDefMap = useMemo(() => {
    const map = new Map<string, typeof CAMPAIGN_STAGE_DEFINITIONS[number]>();
    stages.forEach((stage, idx) => {
      if (idx < CAMPAIGN_STAGE_DEFINITIONS.length) {
        map.set(stage.id, CAMPAIGN_STAGE_DEFINITIONS[idx]);
      }
    });
    return map;
  }, [stages]);

  // 按章节分组关卡
  const chapterGroups = useMemo(() => {
    const chapters: Array<{ era: string; stages: typeof stages; color: string }> = [];
    let currentEra = '';
    for (let i = 0; i < stages.length; i++) {
      const def = stageDefMap.get(stages[i].id);
      const era = def?.era ?? '未知';
      if (era !== currentEra) {
        chapters.push({ era, stages: [stages[i]], color: ERA_COLORS[era as keyof typeof ERA_COLORS] ?? '#888' });
        currentEra = era;
      } else {
        chapters[chapters.length - 1].stages.push(stages[i]);
      }
    }
    return chapters;
  }, [stages, stageDefMap]);

  return (
    <div className="tk-r16-campaign-panel">
      {/* 卷轴顶部装饰 */}
      <div className="tk-r16-scroll-top">
        <svg viewBox="0 0 440 24" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="8" width="440" height="16" rx="2" fill="#5a4a30" opacity="0.6" />
          <ellipse cx="0" cy="16" rx="12" ry="12" fill="#8B7355" opacity="0.5" />
          <ellipse cx="440" cy="16" rx="12" ry="12" fill="#8B7355" opacity="0.5" />
          <rect x="10" y="12" width="420" height="2" fill="#d4a030" opacity="0.3" />
        </svg>
      </div>

      {/* 标题栏 */}
      <div className="tk-r16-campaign-header">
        <h2 className="tk-r16-campaign-title">🏆 征战天下</h2>
        <button onClick={onClose} className="tk-r16-close-btn">✕</button>
      </div>

      {/* 关卡进度条 */}
      <div className="tk-r16-progress-bar">
        <div className="tk-r16-progress-bar__fill" style={{
          width: `${stages.length > 0 ? ((campaignData?.completedStages?.length ?? 0) / stages.length) * 100 : 0}%`,
        }} />
        <span className="tk-r16-progress-bar__text">
          {campaignData?.completedStages?.length ?? 0} / {stages.length}
          {campaignData?.totalStars != null && ` · ⭐${campaignData.totalStars}/${campaignData.maxStars}`}
        </span>
      </div>

      {/* 章节分组关卡列表 */}
      <div className="tk-r16-stage-list">
        {chapterGroups.map((chapter, chapterIdx) => (
          <div key={chapter.era} className="tk-r16-chapter-group">
            {/* 章节横幅 */}
            <ChapterBanner
              title={chapter.era === '黄巾' ? '第一章' : chapter.era === '董卓' ? '第二章' : chapter.era === '群雄' ? '第三章' : chapter.era === '官渡' ? '第四章' : chapter.era === '赤壁' ? '第五章' : '终章'}
              subtitle={chapter.era}
              color={chapter.color}
            />

            {/* 关卡卡片 */}
            {chapter.stages.map((stage, idx) => {
              const globalIdx = stages.indexOf(stage);
              const statusInfo = STAGE_STATUS_MAP[stage.status] ?? STAGE_STATUS_MAP.locked;
              const isLocked = stage.status === 'locked';
              const isVictory = stage.status === 'victory';
              const isAvailable = stage.status === 'available' || stage.status === 'in_progress';
              const isCurrent = stage.status === 'available' || stage.status === 'in_progress';
              const def = stageDefMap.get(stage.id);
              const eraColor = def ? (ERA_COLORS[def.era] ?? '#888') : '#888';
              const diffDisplay = def ? (DIFFICULTY_DISPLAY[def.difficulty] ?? DIFFICULTY_DISPLAY[1]) : null;
              const powerStr = def ? Math.floor(def.requiredPower).toLocaleString() : '';
              const typeInfo = STAGE_TYPE_ICONS[stage.name] ?? { icon: '⚔️', label: '战斗' };
              const strategyTip = STAGE_STRATEGY_TIPS[stage.name] ?? '⚔️ 提升战力再进攻';
              const previewGradient = def ? (STAGE_PREVIEW_GRADIENTS[def.era] ?? 'linear-gradient(180deg, #3a2a1a, #5a4a3a)') : 'linear-gradient(180deg, #3a2a1a, #5a4a3a)';
              const prevStage = globalIdx > 0 ? stages[globalIdx - 1] : null;
              const prevVictory = prevStage?.status === 'victory';

              // 星级评定（金色 ★）
              const starRating = isVictory && stage.stars > 0
                ? <span className="tk-stage-star-rating">{'★'.repeat(stage.stars)}{'☆'.repeat(3 - stage.stars)}</span>
                : null;

              // CSS 类名
              const cardClass = [
                'tk-stage-card',
                'tk-r16-stage-card',
                isLocked ? 'tk-stage-card--locked' : '',
                isVictory ? 'tk-stage-card--victory tk-r16-stage-card--victory' : '',
                isAvailable ? 'tk-stage-card--available tk-r16-stage-card--available' : '',
                isCurrent && !isVictory ? 'tk-stage-card--current tk-r16-stage-card--current' : '',
              ].filter(Boolean).join(' ');

              return (
                <div key={stage.id} className="tk-r17-stage-wrapper">
                  {/* 路径连接线 */}
                  {globalIdx > 0 && <StagePathConnector fromVictory={prevVictory} isLast={false} />}

                  <div
                    className={cardClass}
                    onClick={() => !isLocked && setDetailStageId(stage.id)}
                  >
                    {/* 古风圆章序号 */}
                    <StageSealNumber number={globalIdx + 1} status={stage.status} />

                    {/* 场景预览缩略图 80x60 — 增强版 */}
                    <div className="tk-r17-stage-preview-wrap">
                      <div className="tk-stage-preview tk-r16-stage-preview" style={{ background: previewGradient }}>
                        <svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                          <rect width="80" height="60" fill="none" />
                          {def?.era === '黄巾' && (
                            <>
                              <circle cx="20" cy="15" r="6" fill="#ff6600" opacity="0.6" />
                              <circle cx="60" cy="12" r="5" fill="#ff4400" opacity="0.5" />
                              <path d="M15,40 Q20,25 25,38 Q30,22 35,36" fill="#ff6600" opacity="0.5" />
                              <path d="M50,35 Q55,20 60,33 Q63,18 67,32" fill="#ff4400" opacity="0.5" />
                              <rect x="0" y="48" width="80" height="12" fill="#3a2010" opacity="0.7" />
                            </>
                          )}
                          {def?.era === '董卓' && (
                            <>
                              <rect x="25" y="20" width="30" height="22" fill="#7a6a5a" opacity="0.8" />
                              <rect x="22" y="17" width="36" height="5" fill="#8a7a6a" opacity="0.8" />
                              <path d="M38,42 L38,32 Q40,28 42,32 L42,42" fill="#3a2a1a" opacity="0.7" />
                              <rect x="0" y="48" width="80" height="12" fill="#4a3a2a" opacity="0.5" />
                            </>
                          )}
                          {def?.era === '群雄' && (
                            <>
                              {[10, 25, 40, 55, 70].map((x, i) => (
                                <g key={i}>
                                  <line x1={x} y1="42" x2={x} y2={20 + i * 2} stroke="#8B7355" strokeWidth="0.8" opacity="0.6" />
                                  <polygon points={`${x},${20 + i * 2} ${x + 8},${22 + i * 2} ${x},${25 + i * 2}`} fill={['#c62828','#4a6fa5','#2e7d32','#d4a030','#8a2be2'][i]} opacity="0.6" />
                                </g>
                              ))}
                              <rect x="0" y="48" width="80" height="12" fill="#3a2a1a" opacity="0.5" />
                            </>
                          )}
                          {def?.era === '官渡' && (
                            <>
                              <path d="M0,30 Q20,25 40,30 Q60,35 80,28" fill="#3a5a7a" opacity="0.5" />
                              <path d="M0,32 Q20,28 40,33 Q60,38 80,30" stroke="#5a8aaa" strokeWidth="0.5" fill="none" opacity="0.4" />
                              {[10, 18, 26].map((x, i) => (
                                <g key={`n${i}`}>
                                  <circle cx={x} cy={22 - i} r="1.5" fill="#1a1a2a" />
                                  <rect x={x - 1} y={23.5 - i} width="2" height="3" fill="#1a1a2a" />
                                </g>
                              ))}
                              {[54, 62, 70].map((x, i) => (
                                <g key={`s${i}`}>
                                  <circle cx={x} cy={38 - i} r="1.5" fill="#2a1a1a" />
                                  <rect x={x - 1} y={39.5 - i} width="2" height="3" fill="#2a1a1a" />
                                </g>
                              ))}
                              <rect x="0" y="48" width="80" height="12" fill="#3a2a1a" opacity="0.4" />
                            </>
                          )}
                          {def?.era === '赤壁' && (
                            <>
                              <rect x="0" y="28" width="80" height="20" fill="#2a3a5a" opacity="0.4" />
                              <ellipse cx="40" cy="35" rx="30" ry="10" fill="#ff4400" opacity="0.3" />
                              {[20, 35, 50, 65].map((x, i) => (
                                <g key={i}>
                                  <ellipse cx={x} cy={34 + (i % 2) * 3} rx="4" ry="1.5" fill="#5a3a1a" opacity="0.7" />
                                  <path d={`M${x - 1.5},${32 + (i % 2) * 3} Q${x},${24 + i} ${x + 1.5},${32 + (i % 2) * 3}`} fill="#ff4400" opacity="0.6" />
                                </g>
                              ))}
                              <rect x="0" y="48" width="80" height="12" fill="#1a1020" opacity="0.5" />
                            </>
                          )}
                          {def?.era === '三国' && (
                            <>
                              <path d="M35,38 L33,45 L47,45 L45,38 Z" fill="#b87333" opacity="0.8" />
                              <rect x="34" y="35" width="12" height="4" rx="1" fill="#d4a030" opacity="0.8" />
                              {[15, 40, 65].map((x, i) => (
                                <g key={i}>
                                  <line x1={x} y1="40" x2={x} y2={18 + i * 2} stroke="#8B7355" strokeWidth="1" opacity="0.6" />
                                  <polygon points={`${x},${18 + i * 2} ${x + 8},${20 + i * 2} ${x},${23 + i * 2}`} fill={['#c62828','#4a6fa5','#2e7d32'][i]} opacity="0.7" />
                                </g>
                              ))}
                              <rect x="0" y="48" width="80" height="12" fill="#3a2a10" opacity="0.5" />
                            </>
                          )}
                        </svg>
                        {/* 锁定蒙版 */}
                        {isLocked && <div className="tk-r16-stage-lock-overlay"><span>🔒</span></div>}
                        {/* 可攻击脉冲指引 */}
                        {isAvailable && <div className="tk-r16-stage-available-indicator"><span>▸</span></div>}
                      </div>
                      {/* 历史场景名称标签 */}
                      <div className="tk-r17-scene-name" style={{ color: eraColor }}>
                        {STAGE_HISTORICAL_NAMES[stage.name] ?? stage.name}
                      </div>
                    </div>

                    {/* 关卡信息 — 增强版 */}
                    <div className="tk-stage-info tk-r17-stage-info">
                      <div className="tk-stage-title-row">
                        <span className="tk-stage-type-icon">{typeInfo.icon}</span>
                        <span className="tk-stage-name" style={{ color: isLocked ? CT.textDim : CT.textPrimary }}>
                          {stage.name}
                        </span>
                        {starRating}
                      </div>
                      <div className="tk-stage-meta-row">
                        {def && (
                          <span className="tk-r16-era-tag" style={{ color: eraColor, borderColor: eraColor }}>
                            {def.era}
                          </span>
                        )}
                        {diffDisplay && (
                          <span className="tk-r17-diff-stars" style={{ color: diffDisplay.color }}>
                            {diffDisplay.stars}
                          </span>
                        )}
                        {powerStr && (
                          <span className="tk-r17-power-text" style={{ color: CT.textDim }}>
                            ⚔️{powerStr}
                          </span>
                        )}
                      </div>
                      {/* 战力对比条（我方vs敌方） */}
                      {isAvailable && def && (
                        <div className="tk-r17-power-compare-mini">
                          <div className="tk-r17-power-compare-mini__bar">
                            <div className="tk-r17-power-compare-mini__ally" style={{ width: '55%', background: `linear-gradient(90deg, #2e7d32, #66bb6a)` }} />
                            <div className="tk-r17-power-compare-mini__enemy" style={{ width: '45%', background: `linear-gradient(90deg, #c62828, #ef5350)` }} />
                          </div>
                          <div className="tk-r17-power-compare-mini__labels">
                            <span>我方</span>
                            <span>敌方</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 右侧状态标签 — 增强版 */}
                    <div className="tk-r17-status-area">
                      {!isLocked && !isVictory && (
                        <button className="tk-r17-attack-btn tk-r17-attack-btn--pulse">
                          <span className="tk-r17-attack-btn__icon">⚔️</span>
                          <span className="tk-r17-attack-btn__text">可攻</span>
                        </button>
                      )}
                      {isVictory && (
                        <div className="tk-r17-victory-badge">
                          <span className="tk-r17-victory-stars">{'★'.repeat(stage.stars || 3)}</span>
                          <span className="tk-r17-victory-label">已攻克</span>
                        </div>
                      )}
                      {isLocked && (
                        <div className="tk-r17-locked-badge">
                          <span className="tk-r17-locked-icon">🔒</span>
                          <span className="tk-r17-locked-text">未解锁</span>
                        </div>
                      )}
                    </div>

                    {/* 悬停策略提示 */}
                    {!isLocked && (
                      <span className="tk-stage-tooltip tk-r16-tooltip">{strategyTip}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 关卡详情弹窗 */}
      {detailData && (
        <LevelDetailModal
          detail={detailData.detail}
          statusInfo={detailData.statusInfo}
          canAttack={detailData.canAttack}
          era={stageDefMap.get(detailStageId!)?.era}
          onBattleStart={() => {
            const id = detailStageId!;
            setDetailStageId(null);
            onBattleStart(id);
          }}
          onClose={() => setDetailStageId(null)}
          COLOR_THEME={CT}
        />
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 征战战斗报告弹窗组件
// ═══════════════════════════════════════════════════════════════

/** 征战战斗报告弹窗 */
function CampaignBattleReport({
  result,
  onClose,
  COLOR_THEME: CT,
}: {
  result: {
    victory?: boolean;
    stageId?: string;
    summary?: string;
    stars?: number;
    totalAttackerLosses?: number;
    totalDefenderLosses?: number;
    troopsRemaining?: number;
    troopsRemainingPercent?: number;
    rewards?: { territory?: string; resources?: Record<string, number>; unlockHero?: string };
    rounds?: Array<{ summary?: string }>;
  };
  onClose: () => void;
  COLOR_THEME: typeof COLOR_THEME;
}) {
  const isVictory = result.victory === true;
  const attackerLosses = result.totalAttackerLosses ?? 0;
  const defenderLosses = result.totalDefenderLosses ?? 0;
  const totalLosses = attackerLosses + defenderLosses || 1;
  const attackerRatio = attackerLosses / totalLosses;
  const troopsPct = Math.round((result.troopsRemainingPercent ?? 0) * 100);

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.80)', borderRadius: 12, padding: 20,
      width: 420, maxHeight: '85vh', overflowY: 'auto',
      border: `2px solid ${isVictory ? '#6b8e5a' : '#a85241'}`,
      color: CT.textPrimary, zIndex: 120,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>{isVictory ? '🎉' : '💀'}</div>
        <h2 style={{ margin: 0, fontSize: 18, color: isVictory ? '#6b8e5a' : '#a85241', fontFamily: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif", textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          {isVictory ? '◆ 大获全胜！' : '◆ 兵败如山倒'}
        </h2>
        {result.stars != null && result.stars > 0 && (
          <div style={{ fontSize: 18, marginTop: 4, color: '#d4a030' }}>{'⭐'.repeat(result.stars)}</div>
        )}
      </div>

      {/* ── 战斗场景图示（两军对峙） ── */}
      <div style={{
        borderRadius: 8, overflow: 'hidden', marginBottom: 12,
        border: `1px solid ${isVictory ? 'rgba(107,142,90,0.3)' : 'rgba(168,82,65,0.3)'}`,
      }}>
        <svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
          <defs>
            <linearGradient id="battle-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isVictory ? '#2a3a1a' : '#3a1a1a'} />
              <stop offset="100%" stopColor={isVictory ? '#4a5a2a' : '#5a2a1a'} />
            </linearGradient>
          </defs>
          <rect width="400" height="140" fill="url(#battle-sky)" />
          <rect x="0" y="100" width="400" height="40" fill="#3a2a1a" opacity="0.8" />
          <line x1="0" y1="100" x2="400" y2="100" stroke="#5a4a3a" strokeWidth="1" />
          {[0,1,2,3,4].map(i => (
            <g key={`a${i}`} opacity={i < 3 || isVictory ? 0.9 : 0.4}>
              <rect x={30 + i * 18} y={75 - (i % 2) * 5} width="12" height="20" rx="2" fill="#4a6fa5" />
              <circle cx={36 + i * 18} cy={70 - (i % 2) * 5} r="5" fill="#deb887" />
              <path d={`M${31 + i * 18},${67 - (i % 2) * 5} L${36 + i * 18},${60 - (i % 2) * 5} L${41 + i * 18},${67 - (i % 2) * 5}`} fill="#d4a030" />
              <line x1={44 + i * 18} y1={78 - (i % 2) * 5} x2={44 + i * 18} y2={62 - (i % 2) * 5} stroke="#c0c0c0" strokeWidth="1.5" />
            </g>
          ))}
          <line x1="60" y1="95" x2="60" y2="40" stroke="#8B7355" strokeWidth="2" />
          <polygon points="60,40 85,47 60,54" fill="#d4a030" opacity="0.9" />
          <text x="65" y="50" fontSize="8" fill="#3a2a1a" fontWeight="bold">我军</text>
          {[0,1,2,3,4].map(i => (
            <g key={`e${i}`} opacity={isVictory ? 0.4 : (i < 3 ? 0.9 : 0.7)}>
              <rect x={310 + i * 18} y={75 - (i % 2) * 5} width="12" height="20" rx="2" fill="#8b1a1a" />
              <circle cx={316 + i * 18} cy={70 - (i % 2) * 5} r="5" fill="#deb887" />
              <path d={`M${311 + i * 18},${67 - (i % 2) * 5} L${316 + i * 18},${60 - (i % 2) * 5} L${321 + i * 18},${67 - (i % 2) * 5}`} fill="#333" />
              <line x1={308 + i * 18} y1={78 - (i % 2) * 5} x2={308 + i * 18} y2={62 - (i % 2) * 5} stroke="#c0c0c0" strokeWidth="1.5" />
            </g>
          ))}
          <line x1="340" y1="95" x2="340" y2="40" stroke="#8B7355" strokeWidth="2" />
          <polygon points="340,40 365,47 340,54" fill="#8b1a1a" opacity="0.9" />
          <text x="345" y="50" fontSize="8" fill="#fff" fontWeight="bold">敌军</text>
          {isVictory ? (
            <><circle cx="200" cy="50" r="25" fill="#d4a030" opacity="0.15" /><text x="200" y="55" textAnchor="middle" fontSize="16" fill="#d4a030" opacity="0.9">⚔️ 胜</text></>
          ) : (
            <><circle cx="200" cy="60" r="30" fill="#333" opacity="0.2" /><text x="200" y="65" textAnchor="middle" fontSize="16" fill="#a85241" opacity="0.9">⚔️ 败</text></>
          )}
          <ellipse cx="200" cy="95" rx="60" ry="8" fill="#8a8a7a" opacity="0.25" />
        </svg>
      </div>

      {/* 战斗摘要 */}
      {result.summary && (
        <p style={{ textAlign: 'center', fontSize: 13, color: CT.textDim, margin: '0 0 12px' }}>
          {result.summary}
        </p>
      )}

      {/* ── 兵力损失对比条 ── */}
      <div style={{
        padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
        marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: CT.accentGold, marginBottom: 8, textAlign: 'center' }}>
          ⚔️ 兵力损失对比
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: CT.textDim, marginBottom: 2 }}>
            <span>🗡️ 我方损失</span>
            <span style={{ color: '#a85241', fontWeight: 'bold' }}>{attackerLosses}</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${attackerRatio * 100}%`, background: 'linear-gradient(90deg, #a85241, #c62828)', borderRadius: 5 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: CT.textDim, marginBottom: 2 }}>
            <span>🗡️ 敌方损失</span>
            <span style={{ color: '#6b8e5a', fontWeight: 'bold' }}>{defenderLosses}</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(1 - attackerRatio) * 100}%`, background: 'linear-gradient(90deg, #6b8e5a, #4caf50)', borderRadius: 5 }} />
          </div>
        </div>
      </div>

      {/* 剩余兵力（增强版） */}
      {result.troopsRemaining != null && (
        <div style={{
          textAlign: 'center', fontSize: 12, color: CT.textDim, marginBottom: 12,
          padding: '8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)',
        }}>
          <span style={{ color: CT.accentGold, fontWeight: 'bold' }}>🏰 剩余兵力：</span>
          <span style={{ color: troopsPct > 50 ? '#6b8e5a' : troopsPct > 25 ? '#d4a030' : '#a85241', fontWeight: 'bold' }}>
            {result.troopsRemaining}
          </span>
          <span> ({troopsPct}%)</span>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${troopsPct}%`, background: troopsPct > 50 ? 'linear-gradient(90deg, #4caf50, #6b8e5a)' : troopsPct > 25 ? 'linear-gradient(90deg, #d4a030, #f9a825)' : 'linear-gradient(90deg, #a85241, #c62828)', borderRadius: 3 }} />
          </div>
        </div>
      )}

      {/* 战斗日志 */}
      {Array.isArray(result.rounds) && result.rounds.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: CT.accentGold }}>
            📜 战斗经过
          </div>
          <div style={{
            maxHeight: 120, overflowY: 'auto', fontSize: 11,
            color: CT.textDim, lineHeight: 1.8,
            padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.3)',
          }}>
            {result.rounds.map((round, i) => (
              <div key={i} style={{ padding: '2px 6px', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: 3 }}>
                <span style={{ color: CT.accentGold, fontWeight: 'bold' }}>第{i + 1}回合</span>：{round.summary ?? '...'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 双方损失概览 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
        marginBottom: 12,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: CT.textDim, marginBottom: 2 }}>我方损失</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#a85241' }}>
            {result.totalAttackerLosses ?? 0}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: CT.textDim, marginBottom: 2 }}>敌方损失</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#6b8e5a' }}>
            {result.totalDefenderLosses ?? 0}
          </div>
        </div>
      </div>

      {/* 获得奖励 */}
      {isVictory && result.rewards && (
        <div style={{
          padding: 10, borderRadius: 8, background: 'rgba(74,222,128,0.06)',
          border: '1px solid rgba(74,222,128,0.15)', marginBottom: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6b8e5a', marginBottom: 6 }}>🎁 战利品</div>
          <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.rewards.territory && <span>🏰 {result.rewards.territory}</span>}
            {result.rewards.resources && Object.entries(result.rewards.resources).map(([key, val]) => (
              <span key={key}>{key}: {val}</span>
            ))}
            {result.rewards.unlockHero && (
              <span style={{ color: '#d4a030' }}>🧑‍✈️ 解锁英雄</span>
            )}
          </div>
        </div>
      )}

      {/* 确认按钮 */}
      <button onClick={onClose} style={{
        display: 'block', margin: '0 auto',
        padding: '10px 32px', fontSize: 14,
        cursor: 'pointer', borderRadius: 8, border: 'none',
        background: isVictory ? '#6b8e5a' : '#a85241',
        color: '#000', fontWeight: 'bold',
      }}>
        {isVictory ? '确认' : '返回'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 武将立绘组件（SVG 简笔画风格 — R16 特征化升级版）
// ═══════════════════════════════════════════════════════════════

/** 阵营色映射（R16 统一） */
const FACTION_COLORS_R16: Record<string, string> = {
  wei: '#1E6FBE',
  shu: '#C41E3A',
  wu: '#2E8B57',
  other: '#8B7355',
};

/** 稀有度 → 星级映射（1-5星） */
const RARITY_STARS: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 5,
};

/**
 * GeneralPortrait — 武将特征化 SVG 头像（R16 深度升级）
 *
 * 为6+核心武将创建高度特征化的 SVG 头像：
 * - 刘备: 双耳垂肩 + 仁者风范 + 双剑
 * - 关羽: 红脸 + 长须 + 青龙偃月刀
 * - 张飞: 黑脸 + 虎须 + 丈八蛇矛
 * - 诸葛亮: 羽扇纶巾 + 仙风道骨
 * - 赵云: 白马银枪 + 英姿飒爽
 * - 曹操: 挟天子霸气 + 倚天剑
 * 其他武将回退到确定性种子生成。
 */
const GeneralPortrait = ({ name, faction, size = 60 }: { name: string; faction: string; size?: number }) => {
  const color = FACTION_COLORS_R16[faction] || FACTION_COLORS_R16.other;
  const h = Math.floor(size * 80 / 60);

  // ── 特征化武将 SVG ──
  if (name === '刘备') return <LiuBeiPortrait color={color} size={size} h={h} />;
  if (name === '关羽') return <GuanYuPortrait color={color} size={size} h={h} />;
  if (name === '张飞') return <ZhangFeiPortrait color={color} size={size} h={h} />;
  if (name === '诸葛亮') return <ZhuGeLiangPortrait color={color} size={size} h={h} />;
  if (name === '赵云') return <ZhaoYunPortrait color={color} size={size} h={h} />;
  if (name === '曹操') return <CaoCaoPortrait color={color} size={size} h={h} />;
  if (name === '孙权') return <SunQuanPortrait color={color} size={size} h={h} />;
  if (name === '周瑜') return <ZhouYuPortrait color={color} size={size} h={h} />;
  if (name === '吕布') return <LuBuPortrait color={color} size={size} h={h} />;
  if (name === '貂蝉') return <DiaoChanPortrait color={color} size={size} h={h} />;
  if (name === '许褚') return <XuChuPortrait color={color} size={size} h={h} />;
  if (name === '司马懿') return <SiMaYiPortrait color={color} size={size} h={h} />;

  // ── 通用确定性头像（回退） ──
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const specialGenerals: Record<string, { helmet: number; beard: number; extra?: string }> = {
    '夏侯惇': { helmet: 1, beard: 1 },
    '司马懿': { helmet: 2, beard: 1 },
    '许褚': { helmet: 1, beard: 3 },
    '周瑜': { helmet: 2, beard: 0 },
    '甘宁': { helmet: 1, beard: 0 },
    '陆逊': { helmet: 2, beard: 0 },
    '孙权': { helmet: 2, beard: 1 },
  };
  const special = specialGenerals[name];
  const helmetType = special ? special.helmet : (seed % 3);
  const beardType = special ? special.beard : (seed % 4);
  const faceWidth = 28 + (seed % 8);

  return (
    <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
      <rect width="60" height="80" rx="4" fill="#2a1f0e" />
      <rect width="60" height="80" rx="4" fill={color} opacity="0.12" />
      <circle cx="30" cy="25" r={faceWidth / 2} fill="#f5deb3" stroke={color} strokeWidth="2" />
      {helmetType === 0 && <path d="M15,20 Q30,5 45,20" fill={color} opacity="0.9" />}
      {helmetType === 1 && (<><path d="M10,22 L30,8 L50,22" fill={color} stroke="#ffd700" strokeWidth="1" /><circle cx="30" cy="8" r="2.5" fill="#ffd700" /></>)}
      {helmetType === 2 && <rect x="15" y="12" width="30" height="8" rx="2" fill={color} stroke="#ffd700" strokeWidth="0.5" />}
      <circle cx="24" cy="24" r="2" fill="#1a1a1a" />
      <circle cx="36" cy="24" r="2" fill="#1a1a1a" />
      {beardType === 1 && <path d="M26,30 Q30,35 34,30" fill="none" stroke="#1a1a1a" strokeWidth="1" />}
      {beardType === 2 && (<><path d="M26,30 Q30,35 34,30" fill="none" stroke="#1a1a1a" strokeWidth="1" /><path d="M28,31 Q30,40 32,31" fill="none" stroke="#1a1a1a" strokeWidth="0.8" /></>)}
      {beardType === 3 && (<><path d="M20,28 Q18,35 20,38" fill="none" stroke="#1a1a1a" strokeWidth="1" /><path d="M40,28 Q42,35 40,38" fill="none" stroke="#1a1a1a" strokeWidth="1" /><path d="M26,30 Q30,35 34,30" fill="none" stroke="#1a1a1a" strokeWidth="0.8" /></>)}
      <rect x="15" y="38" width="30" height="30" rx="3" fill={color} />
      <rect x="15" y="52" width="30" height="4" fill="#ffd700" opacity="0.8" />
      <path d="M25,38 L30,45 L35,38" fill="none" stroke="#ffd700" strokeWidth="0.8" opacity="0.6" />
      <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">{name.length > 3 ? name.slice(0, 3) : name}</text>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// R16 特征化武将 SVG 头像（6位核心武将）
// ═══════════════════════════════════════════════════════════════

/** 刘备 — 双耳垂肩 + 仁者风范 + 双剑 */
const LiuBeiPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 双耳垂肩 — 大耳 */}
    <ellipse cx="12" cy="24" rx="6" ry="9" fill="#f5deb3" stroke="#d4a96a" strokeWidth="0.5" />
    <ellipse cx="48" cy="24" rx="6" ry="9" fill="#f5deb3" stroke="#d4a96a" strokeWidth="0.5" />
    {/* 头部 — 仁者面容 */}
    <circle cx="30" cy="22" r="14" fill="#f5deb3" stroke={color} strokeWidth="1.5" />
    {/* 皇帝冠 */}
    <rect x="18" y="8" width="24" height="6" rx="2" fill="#ffd700" stroke="#b8860b" strokeWidth="0.5" />
    <rect x="22" y="5" width="4" height="5" rx="1" fill="#ffd700" />
    <rect x="28" y="4" width="4" height="6" rx="1" fill="#ffd700" />
    <rect x="34" y="5" width="4" height="5" rx="1" fill="#ffd700" />
    {/* 慈眉善目 */}
    <path d="M22,20 Q25,18 28,20" fill="none" stroke="#3d2b1f" strokeWidth="1" />
    <path d="M32,20 Q35,18 38,20" fill="none" stroke="#3d2b1f" strokeWidth="1" />
    <circle cx="25" cy="22" r="1.5" fill="#3d2b1f" />
    <circle cx="35" cy="22" r="1.5" fill="#3d2b1f" />
    {/* 仁和微笑 */}
    <path d="M26,28 Q30,31 34,28" fill="none" stroke="#8b4513" strokeWidth="0.8" />
    {/* 短须 */}
    <path d="M27,29 Q30,33 33,29" fill="none" stroke="#3d2b1f" strokeWidth="0.6" />
    {/* 身体 — 皇袍 */}
    <rect x="14" y="36" width="32" height="32" rx="3" fill={color} opacity="0.9" />
    <path d="M24,36 L30,44 L36,36" fill="none" stroke="#ffd700" strokeWidth="1" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.7" />
    {/* 双剑 — 左右手各一把 */}
    <line x1="10" y1="42" x2="6" y2="58" stroke="#c0c0c0" strokeWidth="1.5" />
    <line x1="8" y1="42" x2="12" y2="58" stroke="#c0c0c0" strokeWidth="1.5" />
    <rect x="5" y="41" width="8" height="2" rx="1" fill="#8b4513" />
    <line x1="50" y1="42" x2="54" y2="58" stroke="#c0c0c0" strokeWidth="1.5" />
    <line x1="52" y1="42" x2="48" y2="58" stroke="#c0c0c0" strokeWidth="1.5" />
    <rect x="47" y="41" width="8" height="2" rx="1" fill="#8b4513" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">刘备</text>
  </svg>
);

/** 关羽 — 红脸 + 长须 + 青龙偃月刀 */
const GuanYuPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 头部 — 红脸 */}
    <circle cx="30" cy="22" r="14" fill="#c0392b" stroke="#8b0000" strokeWidth="1" />
    <circle cx="30" cy="22" r="14" fill="#e74c3c" opacity="0.5" />
    {/* 绿色头巾 */}
    <path d="M16,18 Q30,8 44,18" fill="#228b22" stroke="#006400" strokeWidth="0.5" />
    <rect x="18" y="12" width="24" height="6" rx="2" fill="#228b22" />
    {/* 丹凤眼 — 半闭细长 */}
    <line x1="20" y1="21" x2="28" y2="20" stroke="#1a1a1a" strokeWidth="1.5" />
    <line x1="32" y1="20" x2="40" y2="21" stroke="#1a1a1a" strokeWidth="1.5" />
    <circle cx="24" cy="21" r="1" fill="#1a1a1a" />
    <circle cx="36" cy="21" r="1" fill="#1a1a1a" />
    {/* 卧蚕眉 */}
    <path d="M19,17 Q24,14 29,17" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
    <path d="M31,17 Q36,14 41,17" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
    {/* 长须飘逸 — 二尺美髯 */}
    <path d="M24,28 Q22,40 20,50" fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
    <path d="M27,29 Q26,42 25,52" fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
    <path d="M30,30 Q30,44 30,55" fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
    <path d="M33,29 Q34,42 35,52" fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
    <path d="M36,28 Q38,40 40,50" fill="none" stroke="#1a1a1a" strokeWidth="0.8" />
    {/* 身体 — 绿战袍 */}
    <rect x="14" y="36" width="32" height="32" rx="3" fill="#228b22" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.7" />
    <path d="M24,36 L30,44 L36,36" fill="none" stroke="#ffd700" strokeWidth="0.8" />
    {/* 青龙偃月刀 — 右侧 */}
    <line x1="50" y1="20" x2="52" y2="65" stroke="#8b8682" strokeWidth="2" />
    <path d="M48,20 Q52,14 56,18 Q54,22 50,22" fill="#4682b4" stroke="#2c5f8a" strokeWidth="0.5" />
    <circle cx="52" cy="20" r="1.5" fill="#ffd700" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">关羽</text>
  </svg>
);

/** 张飞 — 黑脸 + 虎须 + 丈八蛇矛 */
const ZhangFeiPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 头部 — 黑脸 */}
    <circle cx="30" cy="22" r="14" fill="#3d3d3d" stroke="#1a1a1a" strokeWidth="1" />
    <circle cx="30" cy="22" r="14" fill="#4a4a4a" opacity="0.4" />
    {/* 铁盔 */}
    <path d="M14,20 L30,6 L46,20" fill="#2f4f4f" stroke="#696969" strokeWidth="0.8" />
    <circle cx="30" cy="6" r="2" fill="#c0392b" />
    {/* 豹头环眼 — 大圆眼 */}
    <circle cx="24" cy="20" r="3" fill="#fff" stroke="#1a1a1a" strokeWidth="0.5" />
    <circle cx="36" cy="20" r="3" fill="#fff" stroke="#1a1a1a" strokeWidth="0.5" />
    <circle cx="24" cy="20" r="1.5" fill="#1a1a1a" />
    <circle cx="36" cy="20" r="1.5" fill="#1a1a1a" />
    {/* 粗眉 */}
    <rect x="20" y="15" width="10" height="2.5" rx="1" fill="#1a1a1a" />
    <rect x="32" y="15" width="10" height="2.5" rx="1" fill="#1a1a1a" />
    {/* 大嘴 */}
    <path d="M24,28 Q30,32 36,28" fill="none" stroke="#1a1a1a" strokeWidth="1" />
    {/* 虎须 — 向两侧炸开 */}
    <line x1="16" y1="24" x2="10" y2="20" stroke="#1a1a1a" strokeWidth="0.7" />
    <line x1="16" y1="26" x2="9" y2="25" stroke="#1a1a1a" strokeWidth="0.7" />
    <line x1="16" y1="28" x2="10" y2="30" stroke="#1a1a1a" strokeWidth="0.7" />
    <line x1="44" y1="24" x2="50" y2="20" stroke="#1a1a1a" strokeWidth="0.7" />
    <line x1="44" y1="26" x2="51" y2="25" stroke="#1a1a1a" strokeWidth="0.7" />
    <line x1="44" y1="28" x2="50" y2="30" stroke="#1a1a1a" strokeWidth="0.7" />
    {/* 身体 — 黑甲 */}
    <rect x="14" y="36" width="32" height="32" rx="3" fill="#2f4f4f" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.6" />
    {/* 丈八蛇矛 — 左侧 */}
    <line x1="10" y1="18" x2="8" y2="65" stroke="#8b8682" strokeWidth="2" />
    <path d="M8,16 L10,10 L12,16" fill="#c0392b" stroke="#8b0000" strokeWidth="0.5" />
    <path d="M7,16 Q10,12 13,16" fill="none" stroke="#ffd700" strokeWidth="0.5" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">张飞</text>
  </svg>
);

/** 诸葛亮 — 羽扇纶巾 + 仙风道骨 */
const ZhuGeLiangPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill="#4169e1" opacity="0.08" />
    {/* 头部 — 清秀面容 */}
    <circle cx="30" cy="22" r="13" fill="#ffe0bd" stroke="#4169e1" strokeWidth="1.5" />
    {/* 纶巾（头巾） */}
    <path d="M17,16 Q30,6 43,16" fill="#f5f5dc" stroke="#8b7355" strokeWidth="0.8" />
    <rect x="20" y="10" width="20" height="6" rx="2" fill="#f5f5dc" stroke="#8b7355" strokeWidth="0.5" />
    {/* 纶巾飘带 */}
    <path d="M17,16 Q14,20 16,24" fill="none" stroke="#f5f5dc" strokeWidth="1" />
    <path d="M43,16 Q46,20 44,24" fill="none" stroke="#f5f5dc" strokeWidth="1" />
    {/* 智慧之眼 — 明亮有神 */}
    <path d="M22,20 Q25,18 28,20" fill="none" stroke="#2c1810" strokeWidth="0.8" />
    <path d="M32,20 Q35,18 38,20" fill="none" stroke="#2c1810" strokeWidth="0.8" />
    <circle cx="25" cy="20.5" r="1.5" fill="#2c1810" />
    <circle cx="35" cy="20.5" r="1.5" fill="#2c1810" />
    {/* 仙风微笑 */}
    <path d="M27,27 Q30,29 33,27" fill="none" stroke="#8b4513" strokeWidth="0.6" />
    {/* 飘逸短须 */}
    <path d="M28,28 Q30,32 32,28" fill="none" stroke="#2c1810" strokeWidth="0.5" />
    {/* 智慧光环 */}
    <circle cx="30" cy="22" r="16" fill="none" stroke="#ffd700" strokeWidth="0.3" strokeDasharray="2,2" opacity="0.5" />
    {/* 身体 — 鹤氅 */}
    <rect x="14" y="35" width="32" height="34" rx="4" fill="#f5f5dc" opacity="0.9" />
    <rect x="14" y="35" width="32" height="34" rx="4" fill="#4169e1" opacity="0.15" />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke="#4169e1" strokeWidth="0.8" />
    <rect x="14" y="52" width="32" height="3" fill="#4169e1" opacity="0.4" />
    {/* 羽扇 — 右手持 */}
    <ellipse cx="50" cy="48" rx="7" ry="10" fill="#fff8dc" stroke="#8b7355" strokeWidth="0.5" opacity="0.9" />
    <line x1="50" y1="38" x2="50" y2="58" stroke="#8b7355" strokeWidth="0.8" />
    <line x1="46" y1="42" x2="54" y2="42" stroke="#8b7355" strokeWidth="0.4" />
    <line x1="45" y1="46" x2="55" y2="46" stroke="#8b7355" strokeWidth="0.4" />
    <line x1="46" y1="50" x2="54" y2="50" stroke="#8b7355" strokeWidth="0.4" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">诸葛亮</text>
  </svg>
);

/** 赵云 — 白马银枪 + 英姿飒爽 */
const ZhaoYunPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill="#4169e1" opacity="0.08" />
    {/* 头部 — 英俊面庞 */}
    <circle cx="30" cy="22" r="13" fill="#ffdbac" stroke="#c0c0c0" strokeWidth="1.5" />
    {/* 银盔 */}
    <path d="M15,20 L30,7 L45,20" fill="#c0c0c0" stroke="#808080" strokeWidth="0.8" />
    <circle cx="30" cy="7" r="2" fill="#4169e1" />
    <line x1="30" y1="7" x2="30" y2="4" stroke="#ffd700" strokeWidth="0.8" />
    <circle cx="30" cy="3.5" r="1" fill="#ffd700" />
    {/* 英气剑眉 */}
    <path d="M19,17 Q24,13 29,17" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
    <path d="M31,17 Q36,13 41,17" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
    {/* 星目 */}
    <circle cx="24" cy="20" r="1.8" fill="#1a1a1a" />
    <circle cx="36" cy="20" r="1.8" fill="#1a1a1a" />
    <circle cx="24.5" cy="19.5" r="0.5" fill="#fff" />
    <circle cx="36.5" cy="19.5" r="0.5" fill="#fff" />
    {/* 坚毅嘴角 */}
    <line x1="26" y1="28" x2="34" y2="28" stroke="#8b4513" strokeWidth="0.8" />
    {/* 身体 — 银甲 */}
    <rect x="14" y="35" width="32" height="34" rx="3" fill="#c0c0c0" />
    <rect x="14" y="35" width="32" height="34" rx="3" fill="#4169e1" opacity="0.1" />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke="#4169e1" strokeWidth="0.8" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.6" />
    {/* 龙胆枪 — 右手 */}
    <line x1="52" y1="12" x2="52" y2="68" stroke="#b8860b" strokeWidth="2" />
    <path d="M49,12 L52,6 L55,12" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
    <circle cx="52" cy="6" r="1.5" fill="#ffd700" />
    {/* 白马暗示 — 底部白色弧形 */}
    <path d="M10,68 Q30,62 50,68" fill="none" stroke="#f0f0f0" strokeWidth="1.5" opacity="0.4" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">赵云</text>
  </svg>
);

/** 曹操 — 挟天子霸气 + 倚天剑 */
const CaoCaoPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 头部 — 白净面容 */}
    <circle cx="30" cy="22" r="13" fill="#fff8dc" stroke={color} strokeWidth="1.5" />
    {/* 丞相冠/冕旒 */}
    <rect x="17" y="8" width="26" height="7" rx="2" fill="#191970" stroke="#ffd700" strokeWidth="0.8" />
    <rect x="20" y="5" width="3" height="5" fill="#ffd700" />
    <rect x="25" y="4" width="3" height="6" fill="#ffd700" />
    <rect x="30" y="3" width="3" height="7" fill="#ffd700" />
    <rect x="35" y="4" width="3" height="6" fill="#ffd700" />
    <rect x="40" y="5" width="3" height="5" fill="#ffd700" />
    {/* 冕旒珠帘 */}
    <circle cx="22" cy="13" r="0.8" fill="#ffd700" opacity="0.6" />
    <circle cx="27" cy="13" r="0.8" fill="#ffd700" opacity="0.6" />
    <circle cx="33" cy="13" r="0.8" fill="#ffd700" opacity="0.6" />
    <circle cx="38" cy="13" r="0.8" fill="#ffd700" opacity="0.6" />
    {/* 锐利眼神 — 枭雄之目 */}
    <path d="M20,20 Q24,18 28,21" fill="none" stroke="#1a1a1a" strokeWidth="1" />
    <path d="M32,21 Q36,18 40,20" fill="none" stroke="#1a1a1a" strokeWidth="1" />
    <circle cx="24" cy="21" r="1.8" fill="#1a1a1a" />
    <circle cx="36" cy="21" r="1.8" fill="#1a1a1a" />
    {/* 威严嘴角 — 似笑非笑 */}
    <path d="M25,28 Q30,30 35,28" fill="none" stroke="#5d4037" strokeWidth="0.8" />
    {/* 短须 */}
    <path d="M27,29 Q30,32 33,29" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
    {/* 身体 — 深蓝紫袍 */}
    <rect x="14" y="35" width="32" height="34" rx="3" fill="#191970" />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke="#ffd700" strokeWidth="1" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.7" />
    {/* 倚天剑 — 右侧 */}
    <line x1="50" y1="25" x2="50" y2="65" stroke="#c0c0c0" strokeWidth="1.8" />
    <path d="M48,25 L50,18 L52,25" fill="#ffd700" stroke="#b8860b" strokeWidth="0.5" />
    <rect x="46" y="24" width="8" height="2" rx="1" fill="#8b4513" />
    {/* 霸气气场 */}
    <circle cx="30" cy="22" r="17" fill="none" stroke="#ffd700" strokeWidth="0.3" strokeDasharray="3,3" opacity="0.4" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">曹操</text>
  </svg>
);

/** 孙权 — 碧眼紫髯 + 吴钩 */
const SunQuanPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 头部 — 方正面庞 */}
    <circle cx="30" cy="22" r="13" fill="#ffe0bd" stroke={color} strokeWidth="1.5" />
    {/* 紫髯 */}
    <path d="M22,28 Q26,34 30,32 Q34,34 38,28" fill="none" stroke="#6a1b9a" strokeWidth="1" />
    <path d="M24,30 Q27,36 30,34 Q33,36 36,30" fill="none" stroke="#6a1b9a" strokeWidth="0.7" />
    {/* 碧眼 — 绿色瞳孔 */}
    <circle cx="24" cy="21" r="2.5" fill="#1b5e20" />
    <circle cx="36" cy="21" r="2.5" fill="#1b5e20" />
    <circle cx="24" cy="21" r="1.2" fill="#000" />
    <circle cx="36" cy="21" r="1.2" fill="#000" />
    {/* 皇冠 */}
    <path d="M16,16 Q30,4 44,16" fill="#ffd700" stroke="#b8860b" strokeWidth="0.8" />
    <rect x="22" y="8" width="4" height="6" rx="1" fill="#ffd700" />
    <rect x="28" y="6" width="4" height="8" rx="1" fill="#ffd700" />
    <rect x="34" y="8" width="4" height="6" rx="1" fill="#ffd700" />
    {/* 紫色发髻 */}
    <ellipse cx="30" cy="12" rx="10" ry="5" fill="#4a148c" opacity="0.6" />
    {/* 身体 — 绿袍 */}
    <rect x="14" y="35" width="32" height="34" rx="3" fill={color} />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke="#ffd700" strokeWidth="1" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.7" />
    {/* 吴钩 — 右侧 */}
    <path d="M48,30 Q52,40 50,55" fill="none" stroke="#c0c0c0" strokeWidth="2" />
    <path d="M48,28 Q54,32 52,38" fill="none" stroke="#c0c0c0" strokeWidth="1.5" />
    <circle cx="49" cy="28" r="1.5" fill="#ffd700" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">孙权</text>
  </svg>
);

/** 周瑜 — 英俊儒雅 + 古琴 */
const ZhouYuPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.08" />
    {/* 头部 — 英俊面庞 */}
    <circle cx="30" cy="22" r="13" fill="#ffdbac" stroke={color} strokeWidth="1.5" />
    {/* 束发冠 */}
    <path d="M17,16 Q30,6 43,16" fill="#f5f5dc" stroke="#8b7355" strokeWidth="0.6" />
    <rect x="22" y="9" width="16" height="5" rx="2" fill="#f5f5dc" stroke="#8b7355" strokeWidth="0.4" />
    {/* 英俊剑眉 */}
    <path d="M20,18 Q24,15 28,18" fill="none" stroke="#2c1810" strokeWidth="1" />
    <path d="M32,18 Q36,15 40,18" fill="none" stroke="#2c1810" strokeWidth="1" />
    {/* 明亮双目 */}
    <circle cx="24" cy="21" r="2" fill="#2c1810" />
    <circle cx="36" cy="21" r="2" fill="#2c1810" />
    <circle cx="24.5" cy="20.5" r="0.6" fill="#fff" />
    <circle cx="36.5" cy="20.5" r="0.6" fill="#fff" />
    {/* 微笑 */}
    <path d="M26,27 Q30,30 34,27" fill="none" stroke="#8b4513" strokeWidth="0.7" />
    {/* 身体 — 白衣儒袍 */}
    <rect x="14" y="35" width="32" height="34" rx="3" fill="#f5f5f0" opacity="0.9" />
    <rect x="14" y="35" width="32" height="34" rx="3" fill={color} opacity="0.15" />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke={color} strokeWidth="0.8" />
    <rect x="14" y="52" width="32" height="3" fill={color} opacity="0.4" />
    {/* 古琴 — 右侧 */}
    <rect x="46" y="38" width="8" height="20" rx="3" fill="#8B6914" stroke="#6b4226" strokeWidth="0.5" />
    <line x1="48" y1="40" x2="48" y2="56" stroke="#d4a96a" strokeWidth="0.3" />
    <line x1="50" y1="40" x2="50" y2="56" stroke="#d4a96a" strokeWidth="0.3" />
    <line x1="52" y1="40" x2="52" y2="56" stroke="#d4a96a" strokeWidth="0.3" />
    {/* 火焰暗示 */}
    <path d="M42,36 Q44,30 42,26" fill="none" stroke="#ff6600" strokeWidth="0.8" opacity="0.5" />
    <path d="M44,34 Q46,28 44,24" fill="none" stroke="#ff4400" strokeWidth="0.6" opacity="0.4" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">周瑜</text>
  </svg>
);

/** 吕布 — 方天画戟 + 赤兔马 */
const LuBuPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill="#8B0000" opacity="0.08" />
    {/* 头部 — 威猛面庞 */}
    <circle cx="30" cy="22" r="13" fill="#ffe0bd" stroke="#8B0000" strokeWidth="1.5" />
    {/* 双翎盔 */}
    <path d="M14,18 L30,6 L46,18" fill="#8B0000" stroke="#ffd700" strokeWidth="0.8" />
    <circle cx="30" cy="6" r="2" fill="#ffd700" />
    {/* 双翎 */}
    <path d="M18,10 Q12,2 8,6" fill="none" stroke="#ff4444" strokeWidth="1.5" />
    <path d="M42,10 Q48,2 52,6" fill="none" stroke="#ff4444" strokeWidth="1.5" />
    {/* 虎目 */}
    <circle cx="24" cy="20" r="2.5" fill="#fff" stroke="#1a1a1a" strokeWidth="0.5" />
    <circle cx="36" cy="20" r="2.5" fill="#fff" stroke="#1a1a1a" strokeWidth="0.5" />
    <circle cx="24" cy="20" r="1.2" fill="#8B0000" />
    <circle cx="36" cy="20" r="1.2" fill="#8B0000" />
    {/* 粗眉 */}
    <rect x="19" y="15" width="11" height="2.5" rx="1" fill="#1a1a1a" />
    <rect x="31" y="15" width="11" height="2.5" rx="1" fill="#1a1a1a" />
    {/* 威严嘴角 */}
    <line x1="25" y1="28" x2="35" y2="28" stroke="#5d4037" strokeWidth="1" />
    {/* 身体 — 暗红战甲 */}
    <rect x="14" y="35" width="32" height="34" rx="3" fill="#8B0000" />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke="#ffd700" strokeWidth="1" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.7" />
    {/* 方天画戟 — 右侧 */}
    <line x1="52" y1="10" x2="52" y2="65" stroke="#8b8682" strokeWidth="2.5" />
    <path d="M48,10 L52,4 L56,10" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
    <path d="M48,10 Q44,8 46,14" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
    <path d="M56,10 Q60,8 58,14" fill="#c0c0c0" stroke="#808080" strokeWidth="0.5" />
    <circle cx="52" cy="4" r="1.5" fill="#ffd700" />
    {/* 赤兔马暗示 — 底部红色弧形 */}
    <path d="M8,68 Q30,60 52,68" fill="none" stroke="#ff4444" strokeWidth="2" opacity="0.4" />
    <path d="M12,70 Q30,64 48,70" fill="none" stroke="#ff2200" strokeWidth="1.5" opacity="0.3" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">吕布</text>
  </svg>
);

/** 貂蝉 — 闭月之容 + 团扇 */
const DiaoChanPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill="#ff69b4" opacity="0.06" />
    {/* 头部 — 绝美面容 */}
    <circle cx="30" cy="22" r="12" fill="#fff0e6" stroke="#ff69b4" strokeWidth="1" />
    {/* 发髻 — 高髻 */}
    <ellipse cx="30" cy="12" rx="10" ry="7" fill="#1a1a1a" />
    <path d="M20,16 Q30,8 40,16" fill="#1a1a1a" />
    {/* 金钗 */}
    <line x1="26" y1="8" x2="34" y2="8" stroke="#ffd700" strokeWidth="1" />
    <circle cx="30" cy="7" r="2" fill="#ffd700" />
    <circle cx="26" cy="8" r="1" fill="#ff69b4" />
    <circle cx="34" cy="8" r="1" fill="#ff69b4" />
    {/* 柳眉杏眼 */}
    <path d="M22,19 Q25,17 28,19" fill="none" stroke="#2c1810" strokeWidth="0.8" />
    <path d="M32,19 Q35,17 38,19" fill="none" stroke="#2c1810" strokeWidth="0.8" />
    <ellipse cx="25" cy="20.5" rx="2" ry="1.5" fill="#2c1810" />
    <ellipse cx="35" cy="20.5" rx="2" ry="1.5" fill="#2c1810" />
    {/* 樱唇 */}
    <path d="M27,26 Q30,28 33,26" fill="#e57373" stroke="#c62828" strokeWidth="0.3" />
    {/* 腮红 */}
    <circle cx="21" cy="23" r="2.5" fill="#ff8a80" opacity="0.2" />
    <circle cx="39" cy="23" r="2.5" fill="#ff8a80" opacity="0.2" />
    {/* 身体 — 粉色罗裙 */}
    <rect x="16" y="34" width="28" height="35" rx="4" fill="#ff69b4" opacity="0.7" />
    <path d="M24,34 L30,42 L36,34" fill="none" stroke="#ffd700" strokeWidth="0.6" />
    <rect x="16" y="52" width="28" height="3" fill="#ffd700" opacity="0.5" />
    {/* 团扇 — 右手 */}
    <circle cx="50" cy="42" r="8" fill="#fff8dc" stroke="#ff69b4" strokeWidth="0.8" opacity="0.9" />
    <line x1="50" y1="50" x2="50" y2="60" stroke="#8B6914" strokeWidth="1.5" />
    {/* 团扇花纹 */}
    <path d="M46,38 Q50,36 54,38" fill="none" stroke="#ff69b4" strokeWidth="0.4" />
    <path d="M45,42 Q50,40 55,42" fill="none" stroke="#ff69b4" strokeWidth="0.4" />
    <circle cx="50" cy="42" r="2" fill="#ff69b4" opacity="0.3" />
    {/* 月亮暗示 */}
    <circle cx="12" cy="14" r="4" fill="#fff8dc" opacity="0.15" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">貂蝉</text>
  </svg>
);

/** 许褚 — 虎痴 + 铁锤 */
const XuChuPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 头部 — 粗犷面庞 */}
    <circle cx="30" cy="22" r="14" fill="#d4a96a" stroke={color} strokeWidth="1.5" />
    {/* 光头 */}
    <ellipse cx="30" cy="14" rx="13" ry="6" fill="#d4a96a" />
    <path d="M17,18 Q30,8 43,18" fill="#d4a96a" stroke="#b8860b" strokeWidth="0.5" />
    {/* 虎纹额带 */}
    <rect x="17" y="13" width="26" height="4" rx="1" fill="#ff8f00" stroke="#e65100" strokeWidth="0.5" />
    <line x1="22" y1="13" x2="24" y2="17" stroke="#1a1a1a" strokeWidth="0.6" />
    <line x1="28" y1="13" x2="30" y2="17" stroke="#1a1a1a" strokeWidth="0.6" />
    <line x1="34" y1="13" x2="36" y2="17" stroke="#1a1a1a" strokeWidth="0.6" />
    {/* 圆瞪虎目 */}
    <circle cx="24" cy="21" r="3" fill="#fff" stroke="#1a1a1a" strokeWidth="0.8" />
    <circle cx="36" cy="21" r="3" fill="#fff" stroke="#1a1a1a" strokeWidth="0.8" />
    <circle cx="24" cy="21" r="1.5" fill="#1a1a1a" />
    <circle cx="36" cy="21" r="1.5" fill="#1a1a1a" />
    {/* 大鼻 */}
    <circle cx="30" cy="26" r="2" fill="#c49a6c" stroke="#8b6914" strokeWidth="0.4" />
    {/* 厚唇 */}
    <path d="M25,29 Q30,31 35,29" fill="none" stroke="#5d4037" strokeWidth="1" />
    {/* 虎须 */}
    <line x1="16" y1="24" x2="12" y2="22" stroke="#1a1a1a" strokeWidth="0.6" />
    <line x1="16" y1="26" x2="11" y2="26" stroke="#1a1a1a" strokeWidth="0.6" />
    <line x1="44" y1="24" x2="48" y2="22" stroke="#1a1a1a" strokeWidth="0.6" />
    <line x1="44" y1="26" x2="49" y2="26" stroke="#1a1a1a" strokeWidth="0.6" />
    {/* 身体 — 褐色甲 */}
    <rect x="14" y="36" width="32" height="32" rx="3" fill="#6d4c41" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.6" />
    {/* 铁锤 — 右侧 */}
    <line x1="50" y1="28" x2="50" y2="55" stroke="#6d4c41" strokeWidth="2.5" />
    <rect x="44" y="22" width="12" height="10" rx="2" fill="#757575" stroke="#424242" strokeWidth="1" />
    <rect x="45" y="23" width="10" height="3" rx="1" fill="#9e9e9e" opacity="0.5" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">许褚</text>
  </svg>
);

/** 司马懿 — 鹰视狼顾 + 黑扇 */
const SiMaYiPortrait = ({ color, size, h }: { color: string; size: number; h: number }) => (
  <svg width={size} height={h} viewBox="0 0 60 80" style={{ flexShrink: 0 }}>
    <rect width="60" height="80" rx="4" fill="#2a1f0e" />
    <rect width="60" height="80" rx="4" fill={color} opacity="0.1" />
    {/* 头部 — 阴沉面庞 */}
    <circle cx="30" cy="22" r="13" fill="#ffe0c0" stroke={color} strokeWidth="1.5" />
    {/* 黑冠 */}
    <rect x="18" y="8" width="24" height="8" rx="2" fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
    <rect x="22" y="5" width="4" height="5" rx="1" fill="#333" />
    <rect x="28" y="4" width="4" height="6" rx="1" fill="#333" />
    <rect x="34" y="5" width="4" height="5" rx="1" fill="#333" />
    {/* 鹰眼 — 锐利狭长 */}
    <path d="M20,20 Q24,18 28,21" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
    <path d="M32,21 Q36,18 40,20" fill="none" stroke="#1a1a1a" strokeWidth="1.2" />
    <ellipse cx="24" cy="21" rx="2" ry="1.5" fill="#1a1a1a" />
    <ellipse cx="36" cy="21" rx="2" ry="1.5" fill="#1a1a1a" />
    <circle cx="24" cy="21" r="0.8" fill="#c62828" />
    <circle cx="36" cy="21" r="0.8" fill="#c62828" />
    {/* 狼顾之相 — 侧目 */}
    <path d="M22,24 Q24,25 26,24" fill="none" stroke="#5d4037" strokeWidth="0.5" />
    <path d="M34,24 Q36,25 38,24" fill="none" stroke="#5d4037" strokeWidth="0.5" />
    {/* 阴沉嘴角 */}
    <path d="M26,28 Q30,27 34,28" fill="none" stroke="#3d2b1f" strokeWidth="0.8" />
    {/* 短须 */}
    <path d="M27,29 Q30,32 33,29" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
    {/* 身体 — 深紫袍 */}
    <rect x="14" y="35" width="32" height="34" rx="3" fill="#1a1a2e" />
    <rect x="14" y="35" width="32" height="34" rx="3" fill={color} opacity="0.2" />
    <path d="M24,35 L30,43 L36,35" fill="none" stroke="#ffd700" strokeWidth="0.8" />
    <rect x="14" y="52" width="32" height="3" fill="#ffd700" opacity="0.5" />
    {/* 黑扇 — 右手 */}
    <path d="M46,36 Q52,32 54,40 Q52,48 46,50" fill="#1a1a1a" stroke="#333" strokeWidth="0.5" />
    <line x1="46" y1="36" x2="46" y2="50" stroke="#8b6914" strokeWidth="1" />
    <line x1="48" y1="38" x2="52" y2="40" stroke="#333" strokeWidth="0.3" />
    <line x1="48" y1="42" x2="53" y2="44" stroke="#333" strokeWidth="0.3" />
    {/* 鹰暗示 */}
    <path d="M10,14 Q12,10 14,14 Q12,12 10,14" fill="#424242" opacity="0.3" />
    {/* 名字 */}
    <text x="30" y="78" textAnchor="middle" fill="#ffd700" fontSize="8" fontFamily="'Noto Serif SC', serif">司马懿</text>
  </svg>
);

// ═══════════════════════════════════════════════════════════════
// 武将程序化立绘组件（基于 Canvas）
// ═══════════════════════════════════════════════════════════════

/**
 * GeneralCanvasPortrait — 使用 GeneralPortraitRenderer 的程序化立绘
 *
 * 通过 canvas 元素渲染高质量的武将全身立绘。
 * 如果武将 ID 在 GENERAL_PORTRAITS 中有定义，则渲染程序化立绘；
 * 否则回退到简单的 SVG 占位图。
 *
 * @param generalId 武将 ID（如 'liubei', 'guanyu'）
 * @param size 渲染尺寸（正方形边长），默认 60
 * @param showName 是否显示名字标签，默认 false
 */
const GeneralCanvasPortrait = ({
  generalId,
  size = 60,
  showName = false,
}: {
  generalId: string;
  size?: number;
  showName?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 设置高 DPI 渲染
    const dpr = window.devicePixelRatio || 1;
    const w = size;
    const h = Math.floor(size * 1.33); // 3:4 比例（全身立绘）
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.clearRect(0, 0, w, h);

    // 绘制程序化立绘
    drawGeneralPortrait({ ctx, x: 0, y: 0, width: w, height: h }, generalId);
  }, [generalId, size]);

  // 如果没有对应的立绘定义，回退到 SVG 简笔头像
  if (!GENERAL_PORTRAITS[generalId]) {
    const general = getGeneralById(generalId);
    return (
      <GeneralPortrait
        name={general?.name ?? generalId}
        faction={general?.faction ?? 'other'}
        size={size}
      />
    );
  }

  const h = Math.floor(size * 1.33);

  return (
    <div style={{ position: 'relative', width: size, height: h, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: h,
          borderRadius: 4,
          imageRendering: 'auto',
        }}
      />
      {showName && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          textAlign: 'center',
          fontSize: Math.max(8, size * 0.14),
          color: '#ffd700',
          fontFamily: "'KaiTi', 'STKaiti', serif",
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          padding: '2px 0',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
        }}>
          {getGeneralById(generalId)?.name ?? generalId}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 武将卡片组件
// ═══════════════════════════════════════════════════════════════

/** 属性条组件 — 可视化武将属性 */
const StatBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <div className="tk-stat-bar">
    <span className="tk-stat-label">{label}</span>
    <div className="tk-stat-track">
      <div className="tk-stat-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
    <span className="tk-stat-value">{value}</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 武将增强数据（技能 / 背景 / 装备）
// ═══════════════════════════════════════════════════════════════

/** 武将技能数据 */
interface GeneralSkillData {
  name: string;
  type: string;   // SVG 图标类型 key
  description: string;
  effect?: string;       // 技能效果文字说明
  cooldown?: number;     // 冷却时间（秒）
  damageType?: 'physical' | 'magic' | 'support';  // 伤害类型
}

/** 武将装备数据 */
interface GeneralEquipmentData {
  weapon: string | null;
  armor: string | null;
  mount: string | null;
}

/** 武将增强数据 */
interface GeneralEnhancedData {
  bio: string;
  skills: GeneralSkillData[];
  equipment: GeneralEquipmentData;
  historyEvents?: string[];         // 历史事件标签
  relatedGenerals?: Array<{ name: string; relation: string }>;  // 关联武将
  factionDesc?: string;             // 势力归属说明
  biography?: string;               // 历史传记（2-3句话）
}

/**
 * 武将增强数据映射表
 *
 * 根据 GENERALS 常量中的武将 ID 提供技能、背景故事和装备信息。
 * 技能图标类型对应 ThreeKingdomsSVGIcons 中的 SKILL_ICON_MAP。
 */
const GENERAL_ENHANCED_DATA: Record<string, GeneralEnhancedData> = {
  liubei: {
    bio: '蜀汉开国皇帝，汉室宗亲。仁德布四方，以德服人，桃园三结义传颂千古。',
    skills: [
      { name: '仁德', type: 'heal', description: '治疗己方全体，恢复兵力', effect: '仁德：恢复己方全体30%最大兵力', cooldown: 8, damageType: 'support' },
      { name: '激励', type: 'buff', description: '提升全军攻击力，鼓舞士气', effect: '激励：提升全军攻击力25%，持续10秒', cooldown: 12, damageType: 'support' },
    ],
    equipment: { weapon: null, armor: null, mount: null },
    historyEvents: ['桃园结义', '三顾茅庐', '白帝城托孤'],
    relatedGenerals: [{ name: '关羽', relation: '桃园兄弟' }, { name: '张飞', relation: '桃园兄弟' }, { name: '诸葛亮', relation: '君臣' }],
    factionDesc: '蜀汉开国皇帝，汉室宗亲，仁德之主',
    biography: '刘备，字玄德，涿郡涿县人，西汉中山靖王刘胜之后。以仁德著称，桃园三结义、三顾茅庐传为佳话。历经数十年征战，终成帝业，建立蜀汉政权。',
  },
  guanyu: {
    bio: '蜀汉五虎上将之首，义薄云天。温酒斩华雄，过五关斩六将，忠义千秋。',
    skills: [
      { name: '武圣', type: 'sword', description: '暴击攻击，造成巨额伤害', effect: '武圣：暴击攻击，对单体造成200%伤害', cooldown: 6, damageType: 'physical' },
      { name: '青龙斩', type: 'charge', description: '范围横扫，攻击前方多排敌军', effect: '青龙斩：横扫千军，对前方3格敌人造成150%伤害', cooldown: 10, damageType: 'physical' },
    ],
    equipment: { weapon: '青龙偃月刀', armor: null, mount: '赤兔马' },
    historyEvents: ['桃园结义', '温酒斩华雄', '过五关斩六将', '水淹七军', '败走麦城'],
    relatedGenerals: [{ name: '刘备', relation: '桃园兄弟' }, { name: '张飞', relation: '桃园兄弟' }],
    factionDesc: '蜀汉五虎上将之首，忠义武圣',
    biography: '关羽，字云长，河东解良人。与刘备、张飞桃园结义，情同手足。温酒斩华雄、过五关斩六将、水淹七军，威震华夏。后世尊为"武圣"，与文圣孔子齐名。',
  },
  zhangfei: {
    bio: '蜀汉猛将，万人敌。长坂坡一声怒吼，吓退曹操百万大军，威震天下。',
    skills: [
      { name: '怒吼', type: 'roar', description: '震慑敌军，降低敌方防御力', effect: '怒吼：震慑前方5格内敌军，降低防御40%', cooldown: 8, damageType: 'physical' },
      { name: '猛进', type: 'charge', description: '勇猛冲锋，突破敌阵', effect: '猛进：冲锋突破，对路径上敌人造成180%伤害', cooldown: 10, damageType: 'physical' },
    ],
    equipment: { weapon: '丈八蛇矛', armor: null, mount: null },
    historyEvents: ['桃园结义', '长坂坡断后', '义释严颜'],
    relatedGenerals: [{ name: '刘备', relation: '桃园兄弟' }, { name: '关羽', relation: '桃园兄弟' }],
    factionDesc: '蜀汉五虎上将之一，万人敌',
    biography: '张飞，字翼德，涿郡人。与刘备、关羽桃园结义，勇猛无双。长坂坡一声怒吼，吓退曹军百万，义释严颜传为美谈。虽性烈如火，却粗中有细。',
  },
  zhugeliang: {
    bio: '蜀汉丞相，号卧龙。未出茅庐已知三分天下，草船借箭、空城退敌，千古智者。',
    skills: [
      { name: '火计', type: 'fire', description: '范围火攻，灼烧大片敌军', effect: '火计：对3x3范围敌军造成160%法术灼烧伤害', cooldown: 12, damageType: 'magic' },
      { name: '八阵图', type: 'shield', description: '布阵防御，大幅提升己方防御', effect: '八阵图：布下奇阵，提升己方全体防御50%', cooldown: 15, damageType: 'support' },
    ],
    equipment: { weapon: null, armor: '鹤氅', mount: null },
    historyEvents: ['三顾茅庐', '草船借箭', '借东风', '空城计', '七擒孟获'],
    relatedGenerals: [{ name: '刘备', relation: '君臣' }, { name: '周瑜', relation: '亦敌亦友' }],
    factionDesc: '蜀汉丞相，卧龙先生，千古智者',
    biography: '诸葛亮，字孔明，号卧龙，琅琊阳都人。未出茅庐已知三分天下，辅佐刘备建立蜀汉。草船借箭、空城退敌、七擒孟获，被誉为"千古智者"。',
  },
  caocao: {
    bio: '魏武帝，乱世枭雄。挟天子以令诸侯，统一北方，文武兼备的一代霸主。',
    skills: [
      { name: '奸雄', type: 'drain', description: '吸血攻击，将伤害转化为兵力', effect: '奸雄：攻击并吸取50%伤害值恢复自身兵力', cooldown: 8, damageType: 'physical' },
      { name: '号令', type: 'roar', description: '全军出击，提升全体武将属性', effect: '号令：提升全体武将攻击和防御各20%', cooldown: 15, damageType: 'support' },
    ],
    equipment: { weapon: '倚天剑', armor: null, mount: '绝影' },
    historyEvents: ['挟天子以令诸侯', '官渡之战', '赤壁之战', '煮酒论英雄'],
    relatedGenerals: [{ name: '夏侯惇', relation: '宗族' }, { name: '许褚', relation: '亲卫' }, { name: '司马懿', relation: '谋臣' }],
    factionDesc: '魏武帝，乱世枭雄，统一北方',
    biography: '曹操，字孟德，沛国谯县人。挟天子以令诸侯，统一北方。文武兼备，治世之能臣，乱世之枭雄。官渡以少胜多，赤壁虽败，仍不失一代雄主。',
  },
  xiahoudun: {
    bio: '曹魏名将，独目将军。拔矢啖睛，忠勇无双，为曹操最信赖的将领之一。',
    skills: [
      { name: '刚烈', type: 'sword', description: '以伤换伤，受击时反弹伤害', effect: '刚烈：受击时反弹80%伤害给攻击者', cooldown: 6, damageType: 'physical' },
      { name: '冲锋', type: 'charge', description: '率先进攻，突破敌军防线', effect: '冲锋：率先突击，对前方敌人造成170%伤害', cooldown: 8, damageType: 'physical' },
    ],
    equipment: { weapon: null, armor: '铁甲', mount: null },
    historyEvents: ['拔矢啖睛', '濮阳之战'],
    relatedGenerals: [{ name: '曹操', relation: '宗族' }, { name: '许褚', relation: '同僚' }],
    factionDesc: '曹魏宗族名将，独目将军',
    biography: '夏侯惇，字元让，沛国谯县人，曹操从弟。拔矢啖睛，忠勇无双。随曹操征战四方，为曹魏基业立下赫赫战功。',
  },
  simayi: {
    bio: '魏国谋臣，号冢虎。隐忍数十年，最终司马代魏，奠定晋朝基业。',
    skills: [
      { name: '隐忍', type: 'chargeup', description: '蓄力待发，积蓄力量后爆发', effect: '隐忍：蓄力5秒后爆发，造成250%法术伤害', cooldown: 15, damageType: 'magic' },
      { name: '鬼谋', type: 'scroll', description: '奇策妙计，随机削弱敌军', effect: '鬼谋：随机降低敌方2名武将30%攻击力', cooldown: 10, damageType: 'magic' },
    ],
    equipment: { weapon: null, armor: null, mount: null },
    historyEvents: ['空城计对峙', '高平陵之变'],
    relatedGenerals: [{ name: '曹操', relation: '谋臣' }, { name: '诸葛亮', relation: '宿敌' }],
    factionDesc: '魏国冢虎，隐忍谋臣，晋朝奠基者',
    biography: '司马懿，字仲达，河内温县人。号冢虎，隐忍数十年。与诸葛亮多次交锋，最终发动高平陵之变，奠定司马氏代魏基础。',
  },
  xuchu: {
    bio: '曹魏虎将，号虎痴。裸衣斗马超，力大无穷，忠心护主，勇冠三军。',
    skills: [
      { name: '虎威', type: 'sword', description: '猛力一击，造成高额伤害', effect: '虎威：猛力一击，对单体造成190%物理伤害', cooldown: 7, damageType: 'physical' },
      { name: '铁壁', type: 'shield', description: '坚守不动，提升自身防御', effect: '铁壁：坚守不动，提升自身防御60%持续8秒', cooldown: 10, damageType: 'support' },
    ],
    equipment: { weapon: '大锤', armor: null, mount: null },
    historyEvents: ['裸衣斗马超', '渭桥护主'],
    relatedGenerals: [{ name: '曹操', relation: '亲卫' }, { name: '夏侯惇', relation: '同僚' }],
    factionDesc: '曹魏虎痴，忠心护主之猛将',
    biography: '许褚，字仲康，谯国谯人。号虎痴，力大无穷。裸衣斗马超，渭桥六战护曹操，忠心耿耿，勇冠三军。',
  },
  sunquan: {
    bio: '东吴大帝，据守江东六郡。知人善任，联刘抗曹，赤壁一战奠定三国鼎立。',
    skills: [
      { name: '制衡', type: 'buff', description: '平衡势力，提升全属性', effect: '制衡：提升己方全体全属性15%', cooldown: 12, damageType: 'support' },
      { name: '坚守', type: 'shield', description: '固守城池，大幅提升防御', effect: '坚守：固守城池，提升己方全体防御45%', cooldown: 10, damageType: 'support' },
    ],
    equipment: { weapon: null, armor: '金甲', mount: null },
    historyEvents: ['赤壁联刘', '夷陵之战', '称帝建吴'],
    relatedGenerals: [{ name: '周瑜', relation: '君臣' }, { name: '陆逊', relation: '君臣' }],
    factionDesc: '东吴大帝，据守江东六郡',
    biography: '孙权，字仲谋，吴郡富春人。继承父兄基业，据守江东六郡。知人善任，联刘抗曹，赤壁一战奠定三国鼎立之势，后称帝建立东吴。',
  },
  zhouyu: {
    bio: '东吴大都督，号美周郎。赤壁火攻破曹军百万，文武双全，雅量高致。',
    skills: [
      { name: '火攻', type: 'fire', description: '烈焰焚天，范围灼烧敌军', effect: '火攻：烈焰焚天，对4x3范围造成170%法术灼烧', cooldown: 12, damageType: 'magic' },
      { name: '反间', type: 'charm', description: '离间敌将，使其混乱自攻', effect: '反间：离间1名敌将，使其攻击友军持续6秒', cooldown: 15, damageType: 'magic' },
    ],
    equipment: { weapon: null, armor: null, mount: null },
    historyEvents: ['赤壁火攻', '群英会', '苦肉计'],
    relatedGenerals: [{ name: '孙权', relation: '君臣' }, { name: '诸葛亮', relation: '亦敌亦友' }],
    factionDesc: '东吴大都督，美周郎',
    biography: '周瑜，字公瑾，庐江舒城人。号美周郎，文武双全。赤壁一战，火攻破曹军百万，奠定三国鼎立之局。雅量高致，曲有误周郎顾。',
  },
  ganning: {
    bio: '东吴名将，号锦帆贼。百骑劫魏营，不折一人一骑，勇悍无比。',
    skills: [
      { name: '锦帆', type: 'charge', description: '水上突袭，快速切入敌阵', effect: '锦帆：水上突袭，瞬间切入后排造成160%伤害', cooldown: 8, damageType: 'physical' },
      { name: '夜袭', type: 'sword', description: '暗夜偷袭，暴击伤害', effect: '夜袭：暗夜偷袭，必定暴击造成220%伤害', cooldown: 10, damageType: 'physical' },
    ],
    equipment: { weapon: '铁锁', armor: null, mount: null },
    historyEvents: ['百骑劫魏营', '夷陵之战'],
    relatedGenerals: [{ name: '孙权', relation: '君臣' }, { name: '周瑜', relation: '同僚' }],
    factionDesc: '东吴名将，锦帆贼',
    biography: '甘宁，字兴霸，巴郡临江人。号锦帆贼，少为游侠。百骑劫魏营，不折一人一骑，孙权赞曰"孟德有张辽，孤有甘兴霸"。',
  },
  luxun: {
    bio: '东吴名将，火烧连营七百里，大破蜀军。年轻有为，智谋过人。',
    skills: [
      { name: '火攻', type: 'fire', description: '火烧连营，范围持续灼烧', effect: '火攻：火烧连营，对5格范围造成持续灼烧伤害', cooldown: 14, damageType: 'magic' },
      { name: '韬略', type: 'scroll', description: '运筹帷幄，提升全队智力', effect: '韬略：运筹帷幄，提升己方全体智力35%', cooldown: 10, damageType: 'support' },
    ],
    equipment: { weapon: null, armor: null, mount: null },
    historyEvents: ['火烧连营', '石亭之战'],
    relatedGenerals: [{ name: '孙权', relation: '君臣' }, { name: '周瑜', relation: '后继者' }],
    factionDesc: '东吴名将，火烧连营七百里',
    biography: '陆逊，字伯言，吴郡吴县人。年轻有为，智谋过人。夷陵之战火烧连营七百里，大破蜀军，一战成名。后任丞相，为东吴栋梁。',
  },
};

/** 获取武将增强数据（带回退） */
function getGeneralEnhanced(id: string): GeneralEnhancedData {
  return GENERAL_ENHANCED_DATA[id] ?? {
    bio: '此人身世成谜，据传有非凡之能。',
    skills: [{ name: '本能', type: 'sword', description: '普通攻击', effect: '本能：普通攻击造成100%伤害', cooldown: 3, damageType: 'physical' as const }],
    equipment: { weapon: null, armor: null, mount: null },
    historyEvents: [],
    relatedGenerals: [],
    factionDesc: '身份不详',
    biography: '此人身世成谜，据传有非凡之能，来历不明，却有一身好武艺。',
  };
}

/** 武将卡片组件 — R16 深度升级 v2：星级 + 阵营色条 + 属性简览 + 技能 + 状态 + 详情弹窗 */
const GeneralCard = ({
  general,
  isSelected,
  onSelect,
  onRecruit,
  onDoubleClick,
  index = 0,
}: {
  general: HeroRenderData;
  isSelected?: boolean;
  onSelect: () => void;
  onRecruit?: () => void;
  onDoubleClick?: () => void;
  /** 卡片在列表中的索引，用于交错动画 */
  index?: number;
}) => {
  const factionLabels: Record<string, string> = { wei: '魏', shu: '蜀', wu: '吴', other: '群' };
  const factionColors: Record<string, string> = { wei: '#1E6FBE', shu: '#C41E3A', wu: '#2E8B57', other: '#8B7355' };
  const color = factionColors[general.faction] || factionColors.other;
  const rarityColor = RARITY_COLORS[general.rarity] || '#c9a96e';
  const enhanced = getGeneralEnhanced(general.id);

  // 稀有度中文标签
  const rarityLabels: Record<string, string> = {
    common: '普通', uncommon: '精良', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
  };

  // 稀有度对应的边框粗细
  const rarityBorderWidth: Record<string, number> = {
    common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3,
  };
  const portraitBorderWidth = rarityBorderWidth[general.rarity] ?? 1;

  // 星级（1-5星，基于稀有度）
  const stars = RARITY_STARS[general.rarity] ?? 1;

  // 计算魅力值（四维均值）
  const charisma = Math.round((general.stats.attack + general.stats.intelligence + general.stats.command + general.stats.defense) / 4);

  // 综合战力
  const power = general.stats.attack + general.stats.intelligence + general.stats.command + general.stats.defense + charisma;

  // 一句话简介映射
  const generalTagline: Record<string, string> = {
    liubei: '蜀汉开国皇帝',
    guanyu: '蜀汉五虎上将',
    zhangfei: '蜀汉五虎上将',
    zhugeliang: '卧龙先生',
    caocao: '魏武帝',
    xiahoudun: '独目将军',
    simayi: '冢虎',
    xuchu: '虎痴',
    sunquan: '东吴大帝',
    zhouyu: '美周郎',
    ganning: '锦帆贼',
    luxun: '火烧连营',
  };

  // 技能伤害类型颜色
  const damageTypeColors: Record<string, string> = {
    physical: '#e53935',
    magic: '#7c4dff',
    support: '#43a047',
  };

  return (
    <div
      className={`tk-general-card tk-general-card-enter ${!general.unlocked ? 'tk-general-card-locked' : ''} ${isSelected ? 'tk-general-card--selected' : ''} ${general.unlocked ? `tk-general-card--rarity-${general.rarity}` : ''} ${general.unlocked ? `tk-general-card--faction-${general.faction}` : ''}`}
      style={{
        borderColor: general.unlocked ? color : 'rgba(139,115,85,0.2)',
        '--faction-color': color,
        '--rarity-color': rarityColor,
        '--card-enter-delay': `${index * 60}ms`,
      } as React.CSSProperties}
      onClick={() => general.unlocked && onSelect()}
      onDoubleClick={() => general.unlocked && onDoubleClick?.()}
    >
      {/* 左侧阵营色竖条 */}
      <div className="tk-general-card-faction-stripe" style={{ background: general.unlocked ? `linear-gradient(180deg, ${color}, ${color}88)` : 'rgba(139,115,85,0.15)' }} />

      {/* 稀有度标签 — 右上角 */}
      {general.unlocked && (
        <span
          className="tk-general-card-rarity-badge"
          style={{
            color: rarityColor,
            background: `${rarityColor}18`,
            border: `1px solid ${rarityColor}40`,
          }}
        >
          {rarityLabels[general.rarity] || general.rarity}
        </span>
      )}

      {/* 头像 — 势力色圆形边框 + 外圈光晕 */}
      <div
        className="tk-general-card-portrait"
        style={{
          '--portrait-border-width': `${portraitBorderWidth}px`,
          '--faction-color': color,
        } as React.CSSProperties}
      >
        <GeneralCanvasPortrait generalId={general.id} size={48} />
        {/* 出战状态标识 */}
        {general.unlocked && (
          <span className="tk-general-status-badge tk-general-status-badge--standby">待命</span>
        )}
      </div>

      {/* 名称 + 信息区 */}
      <div className="tk-general-card-info">
        <div className="tk-general-card-header">
          <span className="tk-general-card-name" style={{ color: general.unlocked ? rarityColor : '#888' }}>
            {general.name}
          </span>
          {general.unlocked ? (
            <span className="tk-general-card-level">Lv.{general.level}</span>
          ) : (
            <span className="tk-general-card-rarity">[{rarityLabels[general.rarity] || general.rarity}]</span>
          )}
        </div>

        {/* 阵营标签 + 星级显示 */}
        {general.unlocked && (
          <div className="tk-general-card-faction-row">
            <div className="tk-general-card-faction-badge" style={{
              background: `${color}20`,
              color: color,
              borderColor: `${color}50`,
            }}>
              {factionLabels[general.faction] || general.faction.toUpperCase()}
            </div>
            <span className="tk-general-card-stars" style={{ color: rarityColor }}>
              {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
            </span>
          </div>
        )}
        {!general.unlocked && (
          <div className="tk-general-card-faction" style={{ color: '#666' }}>
            {factionLabels[general.faction] || general.faction.toUpperCase()}·武将
          </div>
        )}

        {/* 核心属性简览（武力/智力/统率 — 彩色进度条） */}
        {general.unlocked && (
          <div className="tk-general-card-attr-preview">
            <div className="tk-attr-mini" title="武力">
              <span className="tk-attr-mini-label" style={{ color: '#e53935' }}>武</span>
              <div className="tk-attr-mini-bar">
                <div className="tk-attr-mini-fill" style={{ width: `${general.stats.attack}%`, background: `linear-gradient(90deg, #b71c1c, #e53935)` }} />
              </div>
              <span className="tk-attr-mini-val">{general.stats.attack}</span>
            </div>
            <div className="tk-attr-mini" title="智力">
              <span className="tk-attr-mini-label" style={{ color: '#1e88e5' }}>智</span>
              <div className="tk-attr-mini-bar">
                <div className="tk-attr-mini-fill" style={{ width: `${general.stats.intelligence}%`, background: `linear-gradient(90deg, #0d47a1, #1e88e5)` }} />
              </div>
              <span className="tk-attr-mini-val">{general.stats.intelligence}</span>
            </div>
            <div className="tk-attr-mini" title="统率">
              <span className="tk-attr-mini-label" style={{ color: '#43a047' }}>统</span>
              <div className="tk-attr-mini-bar">
                <div className="tk-attr-mini-fill" style={{ width: `${general.stats.command}%`, background: `linear-gradient(90deg, #1b5e20, #43a047)` }} />
              </div>
              <span className="tk-attr-mini-val">{general.stats.command}</span>
            </div>
          </div>
        )}

        {/* 一句话简介 */}
        {general.unlocked && generalTagline[general.id] && (
          <div className="tk-general-card-tagline">{generalTagline[general.id]}</div>
        )}

        {/* 核心技能名称（显示1-2个，含伤害类型色标） */}
        {general.unlocked && enhanced.skills.length > 0 && (
          <div className="tk-general-card-skills-preview">
            {enhanced.skills.slice(0, 2).map((skill, i) => (
              <span
                key={i}
                className="tk-general-card-skill-chip"
                style={{
                  borderLeftColor: damageTypeColors[skill.damageType ?? 'physical'] || '#c9a96e',
                }}
              >
                <span className="tk-skill-chip-icon">
                  <SkillIcon skillType={skill.type} size={9} />
                </span>
                {skill.name}
                {skill.cooldown && (
                  <span className="tk-skill-chip-cd">{skill.cooldown}s</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* 历史标签 */}
        {general.unlocked && enhanced.historyEvents && enhanced.historyEvents.length > 0 && (
          <div className="tk-general-card-history-tag">
            📜 {enhanced.historyEvents[0]}
          </div>
        )}

        {/* 悬停展开详情区域（卡片内 — 5维属性 + 战力） */}
        {general.unlocked && (
          <div className="tk-general-card-hover-info">
            <div className="tk-hover-stat-row">
              <span className="tk-hover-stat-label">武</span>
              <div className="tk-hover-stat-track">
                <div className="tk-hover-stat-fill" style={{ width: `${general.stats.attack}%`, background: '#e53935' }} />
              </div>
              <span className="tk-hover-stat-value">{general.stats.attack}</span>
            </div>
            <div className="tk-hover-stat-row">
              <span className="tk-hover-stat-label">智</span>
              <div className="tk-hover-stat-track">
                <div className="tk-hover-stat-fill" style={{ width: `${general.stats.intelligence}%`, background: '#1e88e5' }} />
              </div>
              <span className="tk-hover-stat-value">{general.stats.intelligence}</span>
            </div>
            <div className="tk-hover-stat-row">
              <span className="tk-hover-stat-label">统</span>
              <div className="tk-hover-stat-track">
                <div className="tk-hover-stat-fill" style={{ width: `${general.stats.command}%`, background: '#43a047' }} />
              </div>
              <span className="tk-hover-stat-value">{general.stats.command}</span>
            </div>
            <div className="tk-hover-stat-row">
              <span className="tk-hover-stat-label">政</span>
              <div className="tk-hover-stat-track">
                <div className="tk-hover-stat-fill" style={{ width: `${general.stats.defense}%`, background: '#ff9800' }} />
              </div>
              <span className="tk-hover-stat-value">{general.stats.defense}</span>
            </div>
            <div className="tk-hover-stat-row">
              <span className="tk-hover-stat-label">魅</span>
              <div className="tk-hover-stat-track">
                <div className="tk-hover-stat-fill" style={{ width: `${charisma}%`, background: '#ab47bc' }} />
              </div>
              <span className="tk-hover-stat-value">{charisma}</span>
            </div>
            {/* 战力值 */}
            <div className="tk-hover-power-row">
              <span className="tk-hover-power-label">⚔️ 战力</span>
              <span className="tk-hover-power-value" style={{ color: rarityColor }}>{power}</span>
            </div>
            {enhanced.skills.length > 0 && (
              <div className="tk-hover-skills">
                {enhanced.skills.map((skill, i) => (
                  <span key={i} className="tk-hover-skill-icon" title={skill.name}>
                    <SkillIcon skillType={skill.type} size={12} />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 悬停浮层详情卡（Tooltip 风格 — R16 v2：含魅力属性 + 装备概览 + 羁绊） ── */}
        {general.unlocked && (
          <div className="tk-general-hover-tooltip">
            <div className="tk-general-hover-tooltip-inner">
              <div className="tk-general-tooltip-title" style={{ color: rarityColor }}>
                {general.name}
                <span className="tk-general-tooltip-level">Lv.{general.level}</span>
                <span className="tk-general-tooltip-rarity" style={{ color: rarityColor }}>
                  [{rarityLabels[general.rarity] || general.rarity}]
                </span>
              </div>
              <div className="tk-general-tooltip-faction" style={{ color }}>
                {factionLabels[general.faction] || general.faction.toUpperCase()} · {generalTagline[general.id] || '武将'}
              </div>
              {/* 星级显示 */}
              <div className="tk-tooltip-stars" style={{ color: rarityColor }}>
                {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
              </div>
              <div className="tk-general-tooltip-stats">
                <div className="tk-tooltip-stat-row">
                  <span className="tk-tooltip-stat-label">武力</span>
                  <div className="tk-tooltip-stat-track">
                    <div className="tk-tooltip-stat-fill" style={{ width: `${general.stats.attack}%`, background: 'linear-gradient(90deg, #b71c1c, #e53935)' }} />
                  </div>
                  <span className="tk-tooltip-stat-value">{general.stats.attack}</span>
                </div>
                <div className="tk-tooltip-stat-row">
                  <span className="tk-tooltip-stat-label">智力</span>
                  <div className="tk-tooltip-stat-track">
                    <div className="tk-tooltip-stat-fill" style={{ width: `${general.stats.intelligence}%`, background: 'linear-gradient(90deg, #0d47a1, #1e88e5)' }} />
                  </div>
                  <span className="tk-tooltip-stat-value">{general.stats.intelligence}</span>
                </div>
                <div className="tk-tooltip-stat-row">
                  <span className="tk-tooltip-stat-label">统率</span>
                  <div className="tk-tooltip-stat-track">
                    <div className="tk-tooltip-stat-fill" style={{ width: `${general.stats.command}%`, background: 'linear-gradient(90deg, #1b5e20, #43a047)' }} />
                  </div>
                  <span className="tk-tooltip-stat-value">{general.stats.command}</span>
                </div>
                <div className="tk-tooltip-stat-row">
                  <span className="tk-tooltip-stat-label">政治</span>
                  <div className="tk-tooltip-stat-track">
                    <div className="tk-tooltip-stat-fill" style={{ width: `${general.stats.defense}%`, background: 'linear-gradient(90deg, #e65100, #ff9800)' }} />
                  </div>
                  <span className="tk-tooltip-stat-value">{general.stats.defense}</span>
                </div>
                <div className="tk-tooltip-stat-row">
                  <span className="tk-tooltip-stat-label">魅力</span>
                  <div className="tk-tooltip-stat-track">
                    <div className="tk-tooltip-stat-fill" style={{ width: `${charisma}%`, background: 'linear-gradient(90deg, #6a1b9a, #ab47bc)' }} />
                  </div>
                  <span className="tk-tooltip-stat-value">{charisma}</span>
                </div>
              </div>
              {/* 战力值 */}
              <div className="tk-tooltip-power">
                <span className="tk-tooltip-power-label">⚔️ 综合战力</span>
                <span className="tk-tooltip-power-value" style={{ color: rarityColor }}>{power}</span>
              </div>
              {enhanced.skills.length > 0 && (
                <div className="tk-general-tooltip-skills">
                  <div className="tk-general-tooltip-skills-title">◆ 技能</div>
                  {enhanced.skills.slice(0, 2).map((skill, i) => (
                    <div key={i} className="tk-general-tooltip-skill">
                      <SkillIcon skillType={skill.type} size={14} />
                      <span className="tk-general-tooltip-skill-name">{skill.name}</span>
                      <span className="tk-general-tooltip-skill-effect">{skill.effect || skill.description}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* 装备概览 */}
              {(() => {
                const eq = enhanced.equipment;
                const hasEquip = eq.weapon || eq.armor || eq.mount;
                if (!hasEquip) return null;
                return (
                  <div className="tk-tooltip-equip-preview">
                    {eq.weapon && <span className="tk-tooltip-equip-item">⚔️{eq.weapon}</span>}
                    {eq.armor && <span className="tk-tooltip-equip-item">🛡️{eq.armor}</span>}
                    {eq.mount && <span className="tk-tooltip-equip-item">🐎{eq.mount}</span>}
                  </div>
                );
              })()}
              {/* 羁绊关系预览 */}
              {enhanced.relatedGenerals && enhanced.relatedGenerals.length > 0 && (
                <div className="tk-tooltip-bonds-preview">
                  {enhanced.relatedGenerals.slice(0, 3).map((rel, i) => (
                    <span key={i} className="tk-tooltip-bond-chip">
                      {rel.name}·{rel.relation}
                    </span>
                  ))}
                </div>
              )}
              {/* 历史典故一句话 */}
              {enhanced.bio && (
                <div className="tk-tooltip-bio-one">{enhanced.bio.slice(0, 30)}…</div>
              )}
            </div>
          </div>
        )}

        {/* 招募按钮 */}
        {!general.unlocked && general.canRecruit && onRecruit && (
          <button className="tk-general-card-recruit-btn tk-recruit-btn-effect" onClick={(e) => { e.stopPropagation(); onRecruit(); }}>
            招募
          </button>
        )}
      </div>

      {/* 底部阵营色渐变 */}
      {general.unlocked && (
        <div className="tk-general-card-bottom-gradient" style={{ background: `linear-gradient(0deg, ${color}30, transparent)` }} />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// R16 v2: 武将详情弹窗组件（Modal）— 深度升级版
// ═══════════════════════════════════════════════════════════════

/**
 * GeneralDetailModal — 武将详情弹窗（R16 v2 深度升级）
 *
 * 点击武将卡片展开的详情弹窗，包含：
 * - 大头像 + 阵营背景 + 势力装饰纹样
 * - 完整属性面板（武力/智力/统帅/政治/魅力）+ 综合战力
 * - 技能列表 + 伤害类型 + 冷却 + 效果描述
 * - 装备槽位展示
 * - 历史典故 + 生平大事时间线
 * - 羁绊/人物关系（带势力色标识）
 */
const GeneralDetailModal = ({
  general,
  onClose,
}: {
  general: HeroRenderData;
  onClose: () => void;
}) => {
  const factionLabels: Record<string, string> = { wei: '魏', shu: '蜀', wu: '吴', other: '群' };
  const factionColors: Record<string, string> = { wei: '#1E6FBE', shu: '#C41E3A', wu: '#2E8B57', other: '#8B7355' };
  const color = factionColors[general.faction] || factionColors.other;
  const rarityColor = RARITY_COLORS[general.rarity] || '#c9a96e';
  const enhanced = getGeneralEnhanced(general.id);
  const stars = RARITY_STARS[general.rarity] ?? 1;

  const rarityLabels: Record<string, string> = {
    common: '普通', uncommon: '精良', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话',
  };

  // 完整5维属性
  const charisma = Math.round((general.stats.attack + general.stats.intelligence + general.stats.command + general.stats.defense) / 4);
  const power = general.stats.attack + general.stats.intelligence + general.stats.command + general.stats.defense + charisma;

  const allStats = [
    { label: '武力', value: general.stats.attack, color: '#e53935', icon: '⚔️', desc: '影响物理攻击伤害' },
    { label: '智力', value: general.stats.intelligence, color: '#1e88e5', icon: '📖', desc: '影响法术攻击效果' },
    { label: '统帅', value: general.stats.command, color: '#43a047', icon: '🚩', desc: '影响部队整体战力' },
    { label: '政治', value: general.stats.defense, color: '#ff9800', icon: '📜', desc: '影响内政与防御' },
    { label: '魅力', value: charisma, color: '#ab47bc', icon: '✨', desc: '影响招募与外交' },
  ];

  // 羁绊关系分组（按关系类型）
  const bonds = enhanced.relatedGenerals ?? [];

  return (
    <div className="tk-general-modal-overlay" onClick={onClose}>
      <div className="tk-general-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 — 阵营色背景 + 大头像 + 装饰纹样 */}
        <div className="tk-modal-header" style={{ '--faction-color': color } as React.CSSProperties}>
          {/* 阵营色背景层 */}
          <div className="tk-modal-header-bg" style={{ background: `linear-gradient(135deg, ${color}18, ${color}08, transparent)`, position: 'absolute', inset: 0, borderRadius: '8px 8px 0 0', pointerEvents: 'none' } as React.CSSProperties} />
          {/* 势力装饰纹样 */}
          <div className="tk-modal-header-pattern" style={{ '--faction-color': color } as React.CSSProperties} />
          <div className="tk-modal-portrait">
            <GeneralCanvasPortrait generalId={general.id} size={80} />
          </div>
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <h3 className="tk-modal-name" style={{ color: rarityColor }}>{general.name}</h3>
            <div className="tk-modal-subtitle">
              <span className={`tk-faction-badge tk-faction-badge--${general.faction}`}>
                {factionLabels[general.faction] || '群'}
              </span>
              <span className="tk-modal-rarity-text" style={{ color: rarityColor }}>
                {rarityLabels[general.rarity] || general.rarity}
              </span>
              <span className="tk-modal-level-text">Lv.{general.level}</span>
            </div>
            {/* 星级 */}
            <div className="tk-modal-stars" style={{ color: rarityColor }}>
              {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
            </div>
            {enhanced.factionDesc && (
              <div className="tk-modal-faction-desc">{enhanced.factionDesc}</div>
            )}
            {/* 综合战力 */}
            <div className="tk-modal-power">
              <span className="tk-modal-power-label">⚔️ 战力</span>
              <span className="tk-modal-power-value" style={{ color: rarityColor }}>{power}</span>
            </div>
          </div>
          <button className="tk-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* 内容区 */}
        <div className="tk-modal-body">
          {/* 完整属性面板 — 5维雷达风格 */}
          <div className="tk-modal-section-title">◆ 属性面板</div>
          <div className="tk-modal-stats-grid">
            {allStats.map((stat) => (
              <div key={stat.label} className="tk-modal-stat-item" title={stat.desc}>
                <span className="tk-modal-stat-icon">{stat.icon}</span>
                <span className="tk-modal-stat-label">{stat.label}</span>
                <div className="tk-modal-stat-bar">
                  <div className="tk-modal-stat-bar-fill" style={{ width: `${stat.value}%`, background: `linear-gradient(90deg, ${stat.color}88, ${stat.color})` }} />
                </div>
                <span className="tk-modal-stat-value" style={{ color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>

          <hr className="tk-modal-divider" />

          {/* 技能列表 — 增强版 */}
          {enhanced.skills.length > 0 && (
            <>
              <div className="tk-modal-section-title">◆ 技能</div>
              {enhanced.skills.map((skill, i) => (
                <div key={i} className="tk-modal-skill-card">
                  <div className="tk-modal-skill-icon-wrap">
                    <SkillIcon skillType={skill.type} size={20} />
                  </div>
                  <div className="tk-modal-skill-info">
                    <div className="tk-modal-skill-name">
                      {skill.name}
                      {skill.damageType && (
                        <span className={`tk-skill-type-badge tk-skill-type-badge--${skill.damageType}`}>
                          {skill.damageType === 'physical' ? '物理' : skill.damageType === 'magic' ? '法术' : '辅助'}
                        </span>
                      )}
                      {skill.cooldown && <span className="tk-skill-cooldown">⏱ {skill.cooldown}s</span>}
                    </div>
                    <div className="tk-modal-skill-desc">{skill.effect || skill.description}</div>
                  </div>
                </div>
              ))}
              <hr className="tk-modal-divider" />
            </>
          )}

          {/* 装备槽位 */}
          <div className="tk-modal-section-title">◆ 装备</div>
          <div className="tk-modal-equip-slots">
            {(['weapon', 'armor', 'mount'] as const).map((slot) => {
              const equipped = enhanced.equipment[slot];
              const slotLabels: Record<string, { label: string; icon: string }> = {
                weapon: { label: '武器', icon: '⚔️' },
                armor: { label: '防具', icon: '🛡️' },
                mount: { label: '坐骑', icon: '🐎' },
              };
              return (
                <div key={slot} className={`tk-modal-equip-slot ${equipped ? 'tk-modal-equip-slot--filled' : ''}`}>
                  <span style={{ fontSize: 18 }}>{slotLabels[slot].icon}</span>
                  {equipped ? (
                    <span className="tk-modal-equip-slot-name">{equipped}</span>
                  ) : (
                    <>
                      <span className="tk-modal-equip-slot-label">{slotLabels[slot].label}</span>
                      <span className="tk-modal-equip-slot-empty">未装备</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <hr className="tk-modal-divider" />

          {/* 历史典故 */}
          <div className="tk-modal-section-title">◆ 典故</div>
          <div className="tk-modal-bio">「{enhanced.bio}」</div>

          {/* 历史事件 — 时间线风格 */}
          {enhanced.historyEvents && enhanced.historyEvents.length > 0 && (
            <div className="tk-modal-timeline">
              {enhanced.historyEvents.map((evt, i) => (
                <div key={i} className="tk-modal-timeline-item">
                  <span className="tk-modal-timeline-dot" style={{ borderColor: color }} />
                  <span className="tk-modal-timeline-text">📜 {evt}</span>
                </div>
              ))}
            </div>
          )}

          {/* 羁绊/人物关系 — 增强版 */}
          {bonds.length > 0 && (
            <>
              <div className="tk-modal-section-title" style={{ marginTop: 12 }}>◆ 羁绊</div>
              <div className="tk-modal-bonds">
                {bonds.map((rel, i) => (
                  <div key={i} className="tk-modal-bond-card">
                    <span className="tk-modal-bond-avatar">
                      <GeneralCanvasPortrait generalId={rel.name === '关羽' ? 'guanyu' : rel.name === '张飞' ? 'zhangfei' : rel.name === '刘备' ? 'liubei' : rel.name === '诸葛亮' ? 'zhugeliang' : rel.name === '曹操' ? 'caocao' : rel.name === '夏侯惇' ? 'xiahoudun' : rel.name === '许褚' ? 'xuchu' : rel.name === '司马懿' ? 'simayi' : rel.name === '孙权' ? 'sunquan' : rel.name === '周瑜' ? 'zhouyu' : rel.name === '甘宁' ? 'ganning' : rel.name === '陆逊' ? 'luxun' : 'unknown'} size={28} />
                    </span>
                    <div className="tk-modal-bond-info">
                      <span className="tk-modal-bond-name">{rel.name}</span>
                      <span className="tk-modal-bond-relation">{rel.relation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export default function ThreeKingdomsPixiGame() {
  // ─── Refs ─────────────────────────────────────────────────

  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const adapterRef = useRef<ThreeKingdomsRenderStateAdapter | null>(null);
  const toastIdRef = useRef(0);
  const audioManagerRef = useRef<AudioManager | null>(null);
  const particleSystemRef = useRef<TKParticleSystem | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleAnimFrameRef = useRef<number>(0);

  // ─── State ────────────────────────────────────────────────

  const [renderState, setRenderState] = useState<GameRenderState | undefined>();
  const [scene, setScene] = useState<SceneType>('map');
  const [activeTab, setActiveTab] = useState<string>('building'); // 跟踪当前激活的 tab key
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [combatLog, setCombatLog] = useState<string[]>([]);

  // ─── 战斗自动切换 + 武将面板 + 响应式 ──────────────────

  const [battleMode, setBattleMode] = useState(false);
  const [previousTab, setPreviousTab] = useState<string>('building');
  const [selectedHero, setSelectedHero] = useState<typeof heroes[number] | null>(null);
  const [detailModalHero, setDetailModalHero] = useState<typeof heroes[number] | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  // ─── 新手引导 + Toast ────────────────────────────────────

  const [showGuide, setShowGuide] = useState(true);
  const [guideStep, setGuideStep] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [activeMapSubTab, setActiveMapSubTab] = useState<'building' | 'cities' | 'resources'>('building');

  // ─── 事件系统 / 任务 / NPC 对话 / 瓦片地图 ──────────────

  const eventSystemRef = useRef<ThreeKingdomsEventSystem | null>(null);
  const tileMapRef = useRef<GameMap | null>(null);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<ActiveEvent | null>(null);
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [showNPCDialogue, setShowNPCDialogue] = useState(false);
  const [npcDialogue, setNPCDialogue] = useState<NPCDialogue | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);

  // ─── 武将对话气泡 / 剧情事件 / 羁绊 ──────────────────────
  const [dialogueBubble, setDialogueBubble] = useState<DialogueEvent | null>(null);
  const [dialogueBubbleQueue, setDialogueBubbleQueue] = useState<DialogueEvent[]>([]);
  const [showStoryEvent, setShowStoryEvent] = useState(false);
  const [activeStoryEvent, setActiveStoryEvent] = useState<ActiveStoryEvent | null>(null);
  const [showBondPanel, setShowBondPanel] = useState(false);
  const [generalRequest, setGeneralRequest] = useState<GeneralRequest | null>(null);
  const [showGeneralRequest, setShowGeneralRequest] = useState(false);

  // 自动存档 + 成就 + Tooltip
  const [lastAutoSave, setLastAutoSave] = useState(0);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [tooltip, setTooltip] = useState<{text:string;x:number;y:number}|null>(null);
  const [audioMuted, setAudioMuted] = useState(false);

  // ─── 科技树 Tooltip 悬停状态 ──────────────────────────────
  const [hoveredTechNode, setHoveredTechNode] = useState<string | null>(null);

  // ─── 季节系统 ──────────────────────────────────────────────
  const [currentSeason, setCurrentSeason] = useState<'spring' | 'summer' | 'autumn' | 'winter'>('spring');

  // ─── 武将详情 Tab ──────────────────────────────────────────
  const [heroDetailTab, setHeroDetailTab] = useState<'info' | 'biography'>('info');

  // ─── 武将面板筛选/排序 ─────────────────────────────────────
  const [generalFactionFilter, setGeneralFactionFilter] = useState<string>('all');
  const [generalRarityFilter, setGeneralRarityFilter] = useState<string>('all');
  const [generalSortKey, setGeneralSortKey] = useState<'level' | 'attack' | 'defense'>('level');

  // ─── 日夜循环 ──────────────────────────────────────────────
  const [isNight, setIsNight] = useState(false);

  // 征战关卡战斗报告
  const [showCampaignBattleReport, setShowCampaignBattleReport] = useState(false);
  const [campaignBattleResult, setCampaignBattleResult] = useState<any>(null);

  // ─── 资源飘字 + 建筑闪光动画 ──────────────────────────────
  const floatIdRef = useRef(0);
  const [floatTexts, setFloatTexts] = useState<Array<{ id: number; text: string; x: number; y: number }>>([]);
  const [flashBuildingId, setFlashBuildingId] = useState<string | null>(null);

  /** 显示资源飘字 */
  const showFloatText = useCallback((text: string, x: number, y: number) => {
    const id = ++floatIdRef.current;
    setFloatTexts(prev => [...prev, { id, text, x, y }]);
    setTimeout(() => {
      setFloatTexts(prev => prev.filter(f => f.id !== id));
    }, 1200);
  }, []);

  /** 触发建筑升级闪光 */
  const triggerBuildingFlash = useCallback((buildingId: string) => {
    setFlashBuildingId(buildingId);
    setTimeout(() => setFlashBuildingId(null), 500);
  }, []);

  /** 添加 toast 提示，2 秒后自动消失 */
  const addToast = useCallback((text: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2000);
  }, []);

  // ─── 派生数据 ─────────────────────────────────────────────

  /** 当前资源数据 */
  const resources = useMemo(() => renderState?.resources.resources ?? [], [renderState]);

  /** 当前阶段 */
  const currentStage = useMemo(() => renderState?.currentStage, [renderState]);

  /** 建筑列表 */
  const buildings = useMemo(() => renderState?.buildings ?? renderState?.map?.buildings ?? [], [renderState]);

  /** 武将列表 */
  const heroes = useMemo(() => renderState?.heroes ?? [], [renderState]);

  /** 战斗数据 */
  const combatData = useMemo(() => renderState?.combat, [renderState]);

  /** 声望数据 */
  const prestigeData = useMemo(() => renderState?.prestige, [renderState]);

  /** 城市列表 */
  const cities = useMemo(() => renderState?.cities ?? [], [renderState]);

  /** 资源点列表 */
  const resourcePoints = useMemo(() => renderState?.resourcePoints ?? [], [renderState]);

  // ─── 定时资源飘字动画（每隔3-5秒随机显示） ──────────────────
  const periodicFloatIdRef = useRef(0);
  const [periodicFloats, setPeriodicFloats] = useState<Array<{
    id: number;
    text: string;
    colorClass: string;
    left: number;
  }>>([]);

  /** 定时资源飘字：每隔3-5秒在资源区域随机显示 */
  useEffect(() => {
    if (resources.length === 0) return;

    const RESOURCE_FLOAT_CONFIG = [
      { id: 'grain', label: '粮草', icon: '🌾', minAmt: 5, maxAmt: 20, colorClass: 'tk-resource-float--grain' },
      { id: 'gold', label: '铜钱', icon: '💰', minAmt: 3, maxAmt: 15, colorClass: 'tk-resource-float--gold' },
      { id: 'iron', label: '铁矿', icon: '⛏️', minAmt: 2, maxAmt: 10, colorClass: 'tk-resource-float--iron' },
      { id: 'wood', label: '木材', icon: '🪵', minAmt: 3, maxAmt: 12, colorClass: 'tk-resource-float--wood' },
      { id: 'troops', label: '兵力', icon: '⚔️', minAmt: 2, maxAmt: 10, colorClass: 'tk-resource-float--troops' },
      { id: 'morale', label: '民心', icon: '🏮', minAmt: 1, maxAmt: 8, colorClass: 'tk-resource-float--morale' },
    ];

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 2000; // 3-5秒随机间隔
      timeoutId = setTimeout(() => {
        // 随机选择一种资源类型
        const config = RESOURCE_FLOAT_CONFIG[Math.floor(Math.random() * RESOURCE_FLOAT_CONFIG.length)];
        const amount = config.minAmt + Math.floor(Math.random() * (config.maxAmt - config.minAmt + 1));
        const id = ++periodicFloatIdRef.current;
        const left = 20 + Math.random() * 60; // 在资源区域20%-80%范围内随机位置

        setPeriodicFloats(prev => [...prev, {
          id,
          text: `${config.icon} +${amount} ${config.label}`,
          colorClass: config.colorClass,
          left,
        }]);

        // 1.5秒后移除
        setTimeout(() => {
          setPeriodicFloats(prev => prev.filter(f => f.id !== id));
        }, 1500);

        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => clearTimeout(timeoutId);
  }, [resources]);

  // ─── 资源飘字追踪 ─────────────────────────────────────────
  const prevResourcesRef = useRef<Record<string, number>>({});
  const [changedResources, setChangedResources] = useState<Set<string>>(new Set());
  const [resourceFloats, setResourceFloats] = useState<Array<{
    id: number; text: string; colorClass: string; resourceIndex: number;
  }>>([]);
  const resourceFloatIdRef = useRef(0);

  /** 资源类型 → 飘字颜色 class 映射 */
  const RESOURCE_FLOAT_COLOR_MAP: Record<string, string> = {
    gold: 'tk-r16-resource-float-text--gold',
    grain: 'tk-r16-resource-float-text--grain',
    troops: 'tk-r16-resource-float-text--troops',
    iron: 'tk-r16-resource-float-text--iron',
    wood: 'tk-r16-resource-float-text--wood',
    morale: 'tk-r16-resource-float-text--morale',
  };

  useEffect(() => {
    const prev = prevResourcesRef.current;
    const curr: Record<string, number> = {};
    const changed = new Set<string>();
    for (const r of resources) {
      curr[r.id] = r.amount;
      const prevAmt = prev[r.id] ?? 0;
      const diff = r.amount - prevAmt;
      if (diff > 0 && prevAmt > 0) {
        // 资源增加了，显示飘字（在资源栏对应位置附近）
        showFloatText(`${r.icon}+${fmt(diff)}`, 0, 0);
        changed.add(r.id);

        // R16: 资源专属飘字动画
        const rIndex = resources.indexOf(r);
        const floatId = ++resourceFloatIdRef.current;
        const colorClass = RESOURCE_FLOAT_COLOR_MAP[r.id] || 'tk-r16-resource-float-text--gold';
        setResourceFloats(prev => [...prev, {
          id: floatId,
          text: `+${fmt(diff)}`,
          colorClass,
          resourceIndex: rIndex,
        }]);
        setTimeout(() => {
          setResourceFloats(prev => prev.filter(f => f.id !== floatId));
        }, 1800);
      }
    }
    prevResourcesRef.current = curr;
    if (changed.size > 0) {
      setChangedResources(changed);
      // 600ms后清除动画class
      setTimeout(() => setChangedResources(new Set()), 600);
    }
  }, [resources, showFloatText]);

  /** 根据场景决定侧边栏显隐 */
  const showBuildingPanel = scene === 'map';
  const showHeroPanel = scene === 'map' || scene === 'hero-detail';

  // ─── 初始化引擎 ─────────────────────────────────────────

  useEffect(() => {
    const engine = new ThreeKingdomsEngine();

    // 离屏 canvas 供引擎启动游戏循环
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1;
    offscreenCanvas.height = 1;
    engine.init(offscreenCanvas);

    engineRef.current = engine;
    adapterRef.current = new ThreeKingdomsRenderStateAdapter(engine);

    // 监听引擎状态变化
    engine.on('stateChange', () => {
      if (adapterRef.current) {
        const state = adapterRef.current.toRenderState();
        setRenderState(state);

        // 战斗日志更新
        if (state.combat && state.combat.state === 'fighting') {
          const dmg = state.combat.damageNumbers;
          if (dmg.length > 0) {
            setCombatLog(prev => {
              const newEntries = dmg
                .filter(d => d.type === 'critical' || d.value > 50)
                .map(d => `${d.type === 'critical' ? '💥暴击' : '⚔️攻击'} -${d.value}`);
              if (newEntries.length === 0) return prev;
              return [...prev, ...newEntries].slice(-20);
            });
          }
        }
      }
    });

    // 初始渲染
    setRenderState(adapterRef.current.toRenderState());

    // ── 初始化音频管理器 ──────────────────────────────────
    const audioManager = new AudioManager();
    audioManagerRef.current = audioManager;

    // 监听引擎事件，播放对应音效
    engine.on('buildingPurchased', () => {
      audioManager.playUpgrade();
    });
    engine.on('buildingUpgraded', () => {
      audioManager.playUpgrade();
    });
    engine.on('generalRecruited', () => {
      audioManager.playRecruit();
    });
    engine.on('battleStarted', () => {
      audioManager.playBattle();
    });
    engine.on('territoryConquered', () => {
      audioManager.playConquer();
    });
    engine.on('techResearched', () => {
      audioManager.playTechResearch();
    });

    // ── 武将对话事件处理 ──────────────────────────────────
    engine.onDialogueEvent = (event: DialogueEvent) => {
      setDialogueBubbleQueue(prev => [...prev, event]);
    };

    engine.onStoryEvent = (event: ActiveStoryEvent) => {
      setActiveStoryEvent(event);
      setShowStoryEvent(true);
    };

    engine.onGeneralRequest = (request: GeneralRequest) => {
      setGeneralRequest(request);
      setShowGeneralRequest(true);
    };

    // ── 初始化事件系统 ─────────────────────────────────────
    const eventSystem = new ThreeKingdomsEventSystem();
    eventSystemRef.current = eventSystem;

    // ── 生成瓦片地图数据 ───────────────────────────────────
    try {
      const mapGen = new MapGenerator();
      tileMapRef.current = mapGen.generate();
    } catch (err) {
      console.warn('[ThreeKingdomsPixiGame] MapGenerator not available:', err);
    }

    // ── 初始化任务列表 ─────────────────────────────────────
    setQuests([
      { id: 'q1', title: '建造第一座农田', description: '建造一座农田开始资源生产', progress: 0, maxProgress: 1, isComplete: false, reward: { gold: 50 } },
      { id: 'q2', title: '招募第一位武将', description: '招募一位武将加入麾下', progress: 0, maxProgress: 1, isComplete: false, reward: { gold: 100 } },
      { id: 'q3', title: '征服第一块领土', description: '征服一块敌方领土', progress: 0, maxProgress: 1, isComplete: false, reward: { food: 200, gold: 200 } },
    ]);

    // 启动游戏循环
    engine.start();

    // ── 初始化粒子系统 ──────────────────────────────────────
    const ps = new TKParticleSystem();
    particleSystemRef.current = ps;

    // 注册背景氛围自动发射器（花瓣飘落）
    ps.registerAutoEmitter('bg-petal', 'petal', 1.5, 400, -10, 400);

    // 粒子动画循环
    let lastTime = performance.now();
    const particleLoop = () => {
      const canvas = particleCanvasRef.current;
      if (!canvas || !particleSystemRef.current) return;

      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particleSystemRef.current.update(dt);
        particleSystemRef.current.render(ctx);
      }

      particleAnimFrameRef.current = requestAnimationFrame(particleLoop);
    };

    // 等待粒子 canvas 挂载后启动
    const waitForCanvas = setInterval(() => {
      if (particleCanvasRef.current) {
        clearInterval(waitForCanvas);
        // 设置画布尺寸
        const rect = particleCanvasRef.current.parentElement?.getBoundingClientRect();
        if (rect) {
          particleCanvasRef.current.width = rect.width;
          particleCanvasRef.current.height = rect.height;
          ps.setCanvasSize(rect.width, rect.height);
        }
        lastTime = performance.now();
        particleAnimFrameRef.current = requestAnimationFrame(particleLoop);
      }
    }, 100);

    // ── 定期检查事件系统 ───────────────────────────────────
    const eventCheckTimer = setInterval(() => {
      if (!eventSystemRef.current) return;
      const events = eventSystemRef.current.getActiveEvents();
      if (events.length > 0) {
        setActiveEvents(events);
        if (!currentEvent && events.some(e => !e.resolved)) {
          const unresolved = events.find(e => !e.resolved);
          if (unresolved) {
            setCurrentEvent(unresolved);
            setShowEventDialog(true);
          }
        }
      }
    }, 3000);

    // 模拟资源预加载进度
    let progress = 0;
    const loadTimer = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(loadTimer);
        setLoading(false);
      }
      setLoadingProgress(Math.min(progress, 100));
    }, 200);

    return () => {
      clearInterval(loadTimer);
      clearInterval(eventCheckTimer);
      clearInterval(waitForCanvas);
      if (particleAnimFrameRef.current) {
        cancelAnimationFrame(particleAnimFrameRef.current);
      }
      engine.pause();
      engine.destroy();
      audioManager.destroy();
      engineRef.current = null;
      adapterRef.current = null;
      eventSystemRef.current = null;
      audioManagerRef.current = null;
      particleSystemRef.current = null;
      particleCanvasRef.current = null;
    };
  }, []);

  // ─── 键盘输入 ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyDown(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── 响应式：监听窗口大小 ──────────────────────────────

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── 季节系统（60秒自动切换） ──────────────────────────
  useEffect(() => {
    const seasons: Array<'spring' | 'summer' | 'autumn' | 'winter'> = ['spring', 'summer', 'autumn', 'winter'];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % seasons.length;
      setCurrentSeason(seasons[idx]);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─── 日夜循环（30秒切换一次） ──────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setIsNight(prev => !prev);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── 自动存档（60秒间隔） ─────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (engine) {
        try {
          const data = engine.serialize();
          localStorage.setItem('tk_autosave', JSON.stringify({ time: Date.now(), data }));
          setLastAutoSave(Date.now());
        } catch { /* ignore */ }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─── 启动时自动加载存档 ────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    if (engine) {
      try {
        const saved = localStorage.getItem('tk_autosave');
        if (saved) {
          const { data } = JSON.parse(saved);
          engine.deserialize(data);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading === false]);

  // ─── 战斗自动切换（事件驱动） ────────────────────────────

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    /** 引擎发起战斗时，自动切换到战斗场景 */
    const handleBattleStart = () => {
      setPreviousTab(activeTab);
      setBattleMode(true);
      setScene('combat');
    };

    /** 引擎战斗结束时，自动切回地图场景 */
    const handleBattleEnd = () => {
      setBattleMode(false);
      setScene('map');
      setActiveTab(previousTab);
    };

    engine.on('battleStarted', handleBattleStart);

    // 监听 stateChange 检测战斗结束
    const handleStateChange = () => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      const state = adapter.toRenderState();
      if (state.combat && (state.combat.state === 'victory' || state.combat.state === 'defeat')) {
        // 延迟切回地图，让玩家看到结果
        setTimeout(() => {
          setBattleMode(false);
          setScene('map');
          setActiveTab(previousTab);
        }, 2000);
      }
    };

    engine.on('stateChange', handleStateChange);

    return () => {
      engine.off('battleStarted', handleBattleStart);
      engine.off('stateChange', handleStateChange);
    };
  }, [activeTab, previousTab]);

  // ─── 引擎操作 ───────────────────────────────────────────

  /** 触发引擎面板切换 */
  const triggerPanelSwitch = useCallback((tabKey: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    // 利用引擎已有的键盘绑定来切换面板
    engine.handleKeyDown(tabKey);
  }, []);

  /** 底部标签栏点击处理：切换场景 + 更新 activeTab */
  const handleTabClick = useCallback((tab: typeof SCENE_TABS[number]) => {
    audioManagerRef.current?.playClick();
    setActiveTab(tab.key);
    setScene(tab.scene);
    triggerPanelSwitch(tab.key);
  }, [triggerPanelSwitch]);

  /** 进入战斗模式（从关卡面板等触发） */
  const enterBattle = useCallback(() => {
    setPreviousTab(activeTab);
    setBattleMode(true);
  }, [activeTab]);

  /** 退出战斗模式（撤退/战斗结束） */
  const exitBattle = useCallback(() => {
    setBattleMode(false);
    setScene('map');
    setActiveTab(previousTab);
    triggerPanelSwitch(previousTab);
  }, [previousTab, triggerPanelSwitch]);

  // ─── 事件处理 ───────────────────────────────────────────

  const handleBuildingClick = useCallback((id: string) => {
    console.log('[ThreeKingdomsPixiGame] Building click:', id);
    const engine = engineRef.current;
    if (!engine) return;

    const currentLevel = engine.getBuildingLevel(id);
    let success = false;

    if (currentLevel < 1) {
      // 建造（等级0→1）
      success = engine.buyBuildingById(id);
      if (success) {
        const bld = BUILDINGS.find(b => b.id === id);
        addToast(`建造成功！${bld?.name ?? id} Lv.1`, 'success');
      }
    } else {
      // 升级（等级1→2→...）
      success = engine.upgradeBuilding(id);
      if (success) {
        const bld = BUILDINGS.find(b => b.id === id);
        const newLevel = engine.getBuildingLevel(id);
        addToast(`升级成功！${bld?.name ?? id} Lv.${newLevel}`, 'success');
      }
    }

    if (success) {
      audioManagerRef.current?.playUpgrade();
      triggerBuildingFlash(id);
      particleSystemRef.current?.emit(120, 200, 'spark', 12);
    } else {
      // 构建详细错误信息
      const res = engine.getResources();
      const bs = (engine as any).bldg;
      const cost = bs?.getCost(id) || {};
      const missing = Object.entries(cost)
        .filter(([, amt]) => amt as number > 0)
        .map(([rid, amt]) => {
          const have = res[rid] || 0;
          return have < (amt as number) ? `${rid}: ${have}/${amt}` : null;
        })
        .filter(Boolean)
        .join(', ');
      addToast(missing ? `资源不足！缺少: ${missing}` : '无法建造/升级', 'error');
      audioManagerRef.current?.playError();
    }
  }, [addToast, triggerBuildingFlash]);

  const handleTerritoryClick = useCallback((id: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    const terr = (engine as any).terr;
    if (!terr) {
      console.warn('[ThreeKingdomsPixiGame] Territory system not available');
      return;
    }

    // 已征服的领土无需再次征服
    if (terr.isConquered(id)) {
      addToast('该领土已征服', 'success');
      return;
    }

    // 检查是否可攻击（相邻已征服）
    if (!terr.canAttack(id)) {
      addToast('无法攻击：需要先征服相邻领土', 'error');
      audioManagerRef.current?.playError();
      return;
    }

    // 尝试征服
    const power = Object.values(engine.getResources()).reduce((s, v) => s + v, 0);
    const result = terr.tryAttack(id, power);
    if (result) {
      // 攻击成功 → 征服
      const conquerResult = terr.conquer(id);
      for (const [r, a] of Object.entries(conquerResult.rewards || {})) {
        (engine as any).giveRes?.(r, a);
      }
      addToast(`征服成功！获得领土`, 'success');
      audioManagerRef.current?.playConquer();
      // 征服火花粒子效果
      particleSystemRef.current?.emit(300, 200, 'spark', 20);
      engine.handleKeyDown(' '); // 触发 stateChange
    } else {
      addToast('兵力不足，无法征服！', 'error');
      audioManagerRef.current?.playError();
    }
  }, [addToast]);

  const handleCombatAction = useCallback((action: string, targetId?: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (action === 'attack' || action === 'start_battle') {
      const battles = (engine as any).battles;
      if (!battles) {
        console.warn('[ThreeKingdomsPixiGame] Battle system not available');
        return;
      }

      // 获取当前阶段的战斗
      const stage = (engine as any).stages?.getCurrent();
      const stageBattles = BATTLES.filter((b) => b.stageId === (stage?.id || 'yellow_turban'));

      if (stageBattles.length === 0) {
        addToast('当前阶段没有可用战斗', 'error');
        return;
      }

      // 使用 targetId 或第一个可用战斗
      const battleId = targetId || stageBattles[0]?.id;
      if (!battleId) return;

      const success = battles.startWave(battleId);
      if (success) {
        setCombatLog(prev => [...prev, `⚔️ 发起攻击 → ${targetId ?? '敌人'}`].slice(-20));
        enterBattle();
        setScene('combat');
        addToast('战斗开始！', 'success');
        audioManagerRef.current?.playBattle();
      } else {
        addToast('无法开始战斗', 'error');
        audioManagerRef.current?.playError();
      }
    }
  }, [addToast]);

  const handleSceneChange = useCallback((newScene: SceneType) => {
    setScene(newScene);
  }, []);

  // ─── 事件系统处理 ───────────────────────────────────────

  /** 处理事件选择 */
  const handleEventChoice = useCallback((choice: EventChoice) => {
    if (!currentEvent || !eventSystemRef.current) return;

    // 应用奖励/惩罚
    if (choice.reward) {
      const engine = engineRef.current;
      if (engine) {
        const payMethod = (engine as any).giveRes;
        if (payMethod) {
          for (const [res, amount] of Object.entries(choice.reward)) {
            payMethod.call(engine, res, amount);
          }
        }
      }
      const rewardStr = Object.entries(choice.reward).map(([k, v]) => `${k}+${v}`).join(' ');
      addToast(`事件奖励：${rewardStr}`, 'success');
      audioManagerRef.current?.playReward();
    }

    if (choice.penalty) {
      const penaltyStr = Object.entries(choice.penalty).map(([k, v]) => `${k}${v}`).join(' ');
      addToast(`事件惩罚：${penaltyStr}`, 'error');
      audioManagerRef.current?.playError();
    }

    // 标记事件已解决
    currentEvent.resolved = true;
    setActiveEvents(prev => prev.filter(e => !e.resolved));
    setCurrentEvent(null);
    setShowEventDialog(false);

    // 触发引擎状态更新
    engineRef.current?.handleKeyDown(' ');
  }, [currentEvent, addToast]);

  /** 处理 NPC 点击 → 显示对话（从引擎获取真实 NPC 信息） */
  const handleNPCClick = useCallback((npcId: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    // 设置选中的 NPC ID（用于信息面板高亮）
    setSelectedNpcId(npcId);

    // 从引擎获取 NPC 详细信息和对话
    const npcInfo = engine.getNPCInfo(npcId);
    const clickLines = engine.getNPCClickDialogue(npcId);

    if (npcInfo) {
      setNPCDialogue({
        npcName: npcInfo.name,
        npcType: npcInfo.profession,
        lines: clickLines.map(l => l.text),
        currentLine: 0,
      });
    } else {
      // 兜底：使用默认对话
      const dialogues: Record<string, string[]> = {
        farmer: ['大人，今年的收成不错！', '需要更多农田才能养活百姓。'],
        soldier: ['末将誓死守卫城池！', '请加强军备，敌军蠢蠢欲动。'],
        merchant: ['大人，有些好货要不要看看？', '最近从西域运来了一批宝物。'],
        scholar: ['书中自有黄金屋。', '大人应该多注重文教。'],
        scout: ['前方发现敌军动向！', '需要加强斥候侦察。'],
      };
      const npcTypes = ['farmer', 'soldier', 'merchant', 'scholar', 'scout'];
      const typeIndex = npcId.charCodeAt(0) % npcTypes.length;
      const npcType = npcTypes[typeIndex];
      const lines = dialogues[npcType] ?? ['你好，大人！'];

      setNPCDialogue({
        npcName: npcId,
        npcType,
        lines,
        currentLine: 0,
      });
    }
    setShowNPCDialogue(true);
  }, []);

  /** 推进 NPC 对话 */
  const handleNPCDialogueNext = useCallback(() => {
    if (!npcDialogue) return;
    if (npcDialogue.currentLine < npcDialogue.lines.length - 1) {
      setNPCDialogue({
        ...npcDialogue,
        currentLine: npcDialogue.currentLine + 1,
      });
    } else {
      setShowNPCDialogue(false);
      setNPCDialogue(null);
      // 不立即清除 selectedNpcId，让信息面板保持显示
    }
  }, [npcDialogue]);

  /** 更新任务进度 */
  const updateQuestProgress = useCallback((questId: string, delta: number) => {
    setQuests(prev => prev.map(q => {
      if (q.id !== questId) return q;
      const newProgress = Math.min(q.progress + delta, q.maxProgress);
      return { ...q, progress: newProgress, isComplete: newProgress >= q.maxProgress };
    }));
  }, []);

  /** 占领资源点 */
  const handleOccupyResourcePoint = useCallback((rpId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rpSys = engine.getResourcePointSystem();
    const rp = rpSys.getResourcePoint(rpId);
    if (!rp || rp.isOccupied) return;
    const ok = rpSys.occupyResourcePoint(rpId, 'player');
    if (ok) {
      addToast(`占领成功：${rp.name}`, 'success');
      audioManagerRef.current?.playReward();
      engine.handleKeyDown(' ');
    } else {
      addToast('占领失败', 'error');
      audioManagerRef.current?.playError();
    }
  }, [addToast]);

  /** 为资源点分配工人 */
  const handleAssignWorkers = useCallback((rpId: string, count: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rpSys = engine.getResourcePointSystem();
    const ok = rpSys.assignWorkers(rpId, count);
    if (ok) {
      addToast(`已分配 ${count} 名工人`, 'success');
      audioManagerRef.current?.playClick();
      engine.handleKeyDown(' ');
    } else {
      addToast('分配工人失败', 'error');
    }
  }, [addToast]);

  /** 升级资源点 */
  const handleUpgradeResourcePoint = useCallback((rpId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rpSys = engine.getResourcePointSystem();
    const ok = rpSys.upgradeResourcePoint(rpId);
    if (ok) {
      addToast('资源点升级成功！', 'success');
      audioManagerRef.current?.playUpgrade();
      engine.handleKeyDown(' ');
    } else {
      addToast('升级失败（可能已达上限）', 'error');
      audioManagerRef.current?.playError();
    }
  }, [addToast]);

  if (loading) {
    return (
      <div style={{
        width: '100%',
        maxWidth: 1280,
        height: '100%',
        maxHeight: 800,
        minHeight: 480,
        aspectRatio: '16 / 10',
        margin: '0 auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${COLOR_THEME.bgGradient1}, ${COLOR_THEME.bgGradient2})`,
        color: COLOR_THEME.textPrimary,
        fontFamily: '"Noto Serif SC", serif',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 8,
        boxSizing: 'border-box',
      }}>
        <h1 style={{ fontSize: 36, color: COLOR_THEME.accentGold, marginBottom: 4 }}>
          三国霸业
        </h1>
        <p style={{ color: COLOR_THEME.accentGold, marginBottom: 2, fontSize: 14, opacity: 0.6, letterSpacing: 8 }}>
          ◆ 魏 · 蜀 · 吳 ◆
        </p>
        <p style={{ color: COLOR_THEME.textSecondary, marginBottom: 24, fontSize: 14 }}>
          加载资源中...
        </p>
        <div style={{
          width: 280, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${loadingProgress}%`, height: '100%',
            background: `linear-gradient(90deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
            borderRadius: 3, transition: 'width 0.3s ease',
          }} />
        </div>
        <p style={{ color: COLOR_THEME.textDim, marginTop: 12, fontSize: 12 }}>
          {Math.floor(loadingProgress)}%
        </p>
      </div>
    );
  }

  return (
    <div
      className={`tk-game-root tk-game-root--season-${currentSeason} ${isNight ? 'tk-game-root--night' : 'tk-game-root--day'}`}
      style={{
      width: '100%',
      maxWidth: 1280,
      height: '100%',
      maxHeight: 800,
      minHeight: 480,
      aspectRatio: '16 / 10',
      margin: '0 auto',
      display: 'flex', flexDirection: 'column',
      background: COLOR_THEME.bgGradient1,
      color: COLOR_THEME.textPrimary,
      fontFamily: '"Noto Serif SC", serif',
      overflow: 'hidden',
      position: 'relative',
      borderRadius: 8,
      boxSizing: 'border-box',
      border: '2px solid #8B7355',
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 0 0 15px rgba(139,115,85,0.2)',
    }}>
      {/* ═══════════ 顶部：资源栏 + 当前阶段 ═══════════ */}
      <header className="tk-header-ancient" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '4px 8px' : '6px 16px',
        zIndex: 10, flexShrink: 0,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: isMobile ? 4 : 0,
      }}>
        {/* 游戏标题 + 阶段 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
          <span className="tk-title-ancient" style={{
            fontSize: isMobile ? 14 : 18, fontWeight: 'bold',
            color: COLOR_THEME.accentGold,
            fontFamily: '"Noto Serif SC", serif',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            letterSpacing: 2,
          }}>
            ⚔ 三国霸业
          </span>
          {/* 年号 · 季节 沉浸式显示 */}
          <span className="tk-era-display">
            <span className="tk-era-display-text">
              {renderState?.calendar?.dateStr || '建安元年'} · {currentSeason === 'spring' ? '春' : currentSeason === 'summer' ? '夏' : currentSeason === 'autumn' ? '秋' : '冬'}
            </span>
          </span>
          {/* 季节指示器 */}
          <span className={`tk-season-indicator tk-season-indicator--${currentSeason}`}>
            <span className="tk-season-icon">
              {currentSeason === 'spring' ? '🌸' : currentSeason === 'summer' ? '☀️' : currentSeason === 'autumn' ? '🍂' : '❄️'}
            </span>
            {currentSeason === 'spring' ? '春季' : currentSeason === 'summer' ? '夏季' : currentSeason === 'autumn' ? '秋季' : '冬季'}
          </span>
          {currentStage && !isMobile && (
            <span style={{
              fontSize: 12, color: currentStage.themeColor,
              background: 'rgba(139,115,85,0.12)',
              padding: '2px 10px', borderRadius: 10,
              border: '1px solid rgba(139,115,85,0.25)',
            }}>
              {currentStage.name} — {currentStage.description}
            </span>
          )}
        </div>

        {/* 资源栏 */}
        <div className="tk-resource-panel-gold" style={{
          display: 'flex', gap: isMobile ? 8 : 16,
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          fontSize: isMobile ? 11 : 13,
          padding: isMobile ? '3px 8px' : '4px 12px',
        }}>
          {resources.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13, color: COLOR_THEME.textPrimary, cursor: 'default',
            }}
              onMouseEnter={e => setTooltip({text:`${r.name}: ${fmt(r.amount)}${r.perSecond > 0 ? ` (+${fmt(r.perSecond)}/秒)` : ''}`,x:e.clientX,y:e.clientY})}
              onMouseLeave={() => setTooltip(null)}
            >
              <span className={r.perSecond > 0 ? 'tk-r16-resource-icon-active' : undefined}>
                <ResourceIcon resourceId={r.id} size={18} />
              </span>
              <span className={`tk-resource-value-pulse ${changedResources.has(r.id) ? 'tk-resource-value-updated tk-r16-value-updated' : ''}`} style={{ fontWeight: 'bold' }}>{fmt(r.amount)}</span>
              {r.perSecond > 0 && (
                <span style={{ fontSize: 10, color: COLOR_THEME.accentGreen }}>
                  +{fmt(r.perSecond)}/s
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 日历时间显示 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: COLOR_THEME.accentGold, fontFamily: '"Noto Serif SC", serif' }}>
            {renderState?.calendar?.dateStr}
          </span>
          {/* R15 — 日夜时间指示器 */}
          <div className={`tk-time-indicator ${isNight ? 'tk-time-indicator--night' : 'tk-time-indicator--day'}`}>
            <span className="tk-time-indicator-icon">{isNight ? '🌙' : '☀️'}</span>
            <span className="tk-time-indicator-label">{isNight ? '夜' : '昼'}</span>
          </div>
          <span style={{
            color: COLOR_THEME.accentGold,
            background: 'rgba(139,115,85,0.12)',
            padding: '1px 8px', borderRadius: 8,
            fontSize: 11,
            border: '1px solid rgba(139,115,85,0.2)',
          }}>
            {renderState?.calendar?.season}季 · {renderState?.calendar?.shichen}时
          </span>
          {renderState?.calendar?.isPaused && (
            <span style={{ color: '#e74c3c', fontSize: 10 }}>⏸ 已暂停</span>
          )}
          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 5].map(speed => (
              <button
                key={speed}
                onClick={() => engineRef.current?.getCalendar().setTimeScale(speed)}
                style={{
                  padding: '2px 8px', fontSize: 10,
                  borderRadius: 3, border: 'none', cursor: 'pointer',
                  background: renderState?.calendar?.timeScale === speed
                    ? COLOR_THEME.accentGold
                    : 'rgba(255,255,255,0.1)',
                  color: renderState?.calendar?.timeScale === speed
                    ? '#1a0a0a'
                    : COLOR_THEME.textSecondary,
                  fontWeight: renderState?.calendar?.timeScale === speed ? 'bold' : 'normal',
                }}
              >
                {speed}x
              </button>
            ))}
            <button
              onClick={() => {
                const cal = engineRef.current?.getCalendar();
                if (!cal) return;
                cal.isPaused() ? cal.resume() : cal.pause();
              }}
              style={{
                padding: '2px 8px', fontSize: 10,
                borderRadius: 3, border: 'none', cursor: 'pointer',
                background: 'rgba(255,255,255,0.1)',
                color: COLOR_THEME.textSecondary,
              }}
            >
              {renderState?.calendar?.isPaused ? '▶' : '⏸'}
            </button>
          </div>
          {/* 存档 + 成就 + 音频按钮 */}
          <button onClick={() => setShowSavePanel(true)} title="存档管理" style={{background:'transparent',border:'none',cursor:'pointer',fontSize:14,color:COLOR_THEME.textSecondary}}>📜</button>
          <button onClick={() => setShowAchievements(true)} title="成就" style={{background:'transparent',border:'none',cursor:'pointer',fontSize:14,color:COLOR_THEME.textSecondary}}>🏆</button>
          {/* ── 音频控制按钮（增强可见性） ── */}
          <button
            onClick={() => {
              const am = audioManagerRef.current;
              if (!am) return;
              // 首次点击时初始化（需要用户交互触发 AudioContext）
              if (!am.isInitialized()) {
                am.init();
                am.playBGM();
              }
              const newMuted = am.toggleMute();
              setAudioMuted(newMuted);
            }}
            title={audioMuted ? '取消静音 - 点击开启音效' : '静音 - 点击关闭音效'}
            style={{
              background: audioMuted ? 'rgba(231,76,60,0.15)' : 'rgba(212,160,48,0.12)',
              border: `1.5px solid ${audioMuted ? '#e74c3c' : 'rgba(212,160,48,0.4)'}`,
              cursor: 'pointer',
              fontSize: 15,
              color: audioMuted ? '#e74c3c' : '#d4a030',
              borderRadius: 6,
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s ease',
            }}
          >
            {audioMuted ? '🔇' : '🔊'}
            <span style={{ fontSize: 10, fontWeight: 'bold' }}>{audioMuted ? '静音' : '音效'}</span>
          </button>
          {lastAutoSave > 0 && <span style={{fontSize:9,color:'#555'}}>已存档</span>}
        </div>

        {/* 资源飘字动画 */}
        {floatTexts.map(ft => (
          <div key={ft.id} className="tk-float-text" style={{ left: ft.x, top: ft.y }}>
            {ft.text}
          </div>
        ))}

        {/* R16: 资源专属飘字 — 资源变化时在对应图标上方显示 */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 25 }}>
          {resourceFloats.map(rf => (
            <div
              key={rf.id}
              className={`tk-r16-resource-float-text ${rf.colorClass}`}
              style={{
                left: `${Math.min(10 + rf.resourceIndex * 80, 85)}%`,
                top: '28px',
              }}
            >
              {rf.text}
            </div>
          ))}
        </div>

        {/* 定时资源飘字动画（每隔3-5秒随机显示） */}
        <div className="tk-resource-float-container">
          {periodicFloats.map(pf => (
            <div
              key={pf.id}
              className={`tk-resource-float ${pf.colorClass}`}
              style={{ left: `${pf.left}%`, bottom: '2px' }}
            >
              {pf.text}
            </div>
          ))}
        </div>

        {/* ── 音频状态指示器（左下角常驻显示） ── */}
        {!audioMuted && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 12,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(212,160,48,0.3)',
            fontSize: 10, color: '#d4a030',
            pointerEvents: 'none',
            zIndex: 50,
          }}>
            <span style={{ animation: 'tk-audio-pulse 1.5s infinite' }}>🎵</span>
            <span>♪ BGM播放中</span>
          </div>
        )}
      </header>

      {/* ═══════════ 中间区域：左面板 + PixiJS Canvas + 右面板 ═══════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ─── 环境氛围层：远山 + 花瓣/落叶 + 炊烟 + 旗帜 ─── */}
        <div className="tk-atmosphere-layer">
          {/* 远山轮廓 */}
          <div className="tk-mountain-layer" />
          {/* 炊烟效果（增强版 — 5个粒子 + 更大更明显） */}
          <div className="tk-smoke-layer">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="tk-smoke"
                style={{
                  left: `${12 + i * 20}%`,
                  bottom: `${10 + (i % 3) * 5}%`,
                  animationDuration: `${3.5 + i * 1.2}s`,
                  animationDelay: `${i * 1.8}s`,
                  width: 24 + (i % 3) * 6,
                  height: 24 + (i % 3) * 6,
                }}
              />
            ))}
          </div>
          {/* 城池旗帜飘动 */}
          <div className="tk-flag-layer">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`tk-flag tk-flag--${['shu', 'wei', 'wu'][i]}`}
                style={{
                  left: `${20 + i * 30}%`,
                  bottom: `${15 + i * 8}%`,
                  animationDelay: `${i * 0.7}s`,
                  animationDuration: `${2.5 + i * 0.3}s`,
                }}
              >
                <div className="tk-flag-pole" />
                <div className="tk-flag-cloth" />
              </div>
            ))}
          </div>
          {/* 城池呼吸脉冲 */}
          <div className="tk-city-pulse" style={{ left: '50%', bottom: '12%', transform: 'translateX(-50%)' }} />
        </div>
        {/* R15 — 飘动云雾氛围层 */}
        <div className="tk-ambience-clouds">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`tk-ambience-cloud tk-ambience-cloud--${i}`} />
          ))}
        </div>
        {/* 飘落花瓣/落叶层（增强版 — 18个粒子更密集） */}
        <div className="tk-petal-layer">
          {Array.from({ length: 18 }, (_, i) => (
            <div
              key={i}
              className={`tk-petal tk-petal--${currentSeason}`}
              style={{
                left: `${2 + i * 5.5}%`,
                animationDuration: `${4 + (i % 5) * 1.5}s`,
                animationDelay: `${i * 0.8}s`,
                width: currentSeason === 'winter' ? (4 + (i % 3) * 2) : (6 + (i % 3) * 3),
                height: currentSeason === 'winter' ? (4 + (i % 3) * 2) : (6 + (i % 3) * 3),
                opacity: 0.5 + (i % 4) * 0.12,
              }}
            />
          ))}
        </div>

        {/* ─── 左侧面板：建筑/城市/资源点（仅地图场景显示，移动端隐藏） ─── */}
        {showBuildingPanel && !isMobile && (
        <aside className="tk-chinese-border" style={{
          width: 240, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(45,27,10,0.9) 0%, rgba(26,14,5,0.95) 100%)',
          borderRight: '2px solid rgba(212,160,48,0.4)',
          overflowY: 'auto', padding: 8,
          zIndex: 5,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 面板标题装饰 */}
          <div className="tk-panel-title-ancient">城池建设</div>
          {/* 子标签栏 */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 8, borderBottom: '1px solid rgba(139,115,85,0.2)', paddingBottom: 6 }}>
            {[
              { key: 'building' as const, label: '🏗️建筑' },
              { key: 'cities' as const, label: '🏰城市' },
              { key: 'resources' as const, label: '⛏️资源' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveMapSubTab(tab.key)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: 10,
                  borderRadius: 4, border: '1px solid transparent', cursor: 'pointer',
                  background: activeMapSubTab === tab.key
                    ? 'rgba(201,169,110,0.18)'
                    : 'rgba(139,115,85,0.06)',
                  color: activeMapSubTab === tab.key
                    ? COLOR_THEME.accentGold
                    : COLOR_THEME.textSecondary,
                  fontWeight: activeMapSubTab === tab.key ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                  borderBottom: activeMapSubTab === tab.key
                    ? '2px solid #c9a96e'
                    : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── 建筑列表（卡片式布局） ── */}
          {activeMapSubTab === 'building' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {buildings.map(b => {
                // 计算升级进度（简化：使用等级%10作为进度模拟）
                const levelProgress = b.level > 0 ? Math.min(1, (b.level % 10) / 10) : 0;
                return (
                  <div
                    key={b.id}
                    className={`${flashBuildingId === b.id ? 'tk-r16-building-upgrading tk-r16-building-levelup' : ''} tk-r16-building-card tk-building-card-dynamic ${b.canUpgrade ? 'tk-building-can-upgrade' : ''}`}
                    onClick={() => handleBuildingClick(b.id)}
                    style={{
                      padding: '8px 10px', marginBottom: 6,
                      borderRadius: 6, cursor: 'pointer',
                      background: b.state === 'locked'
                        ? 'rgba(255,255,255,0.02)'
                        : 'linear-gradient(135deg, rgba(212,165,116,0.08) 0%, rgba(139,115,85,0.06) 100%)',
                      border: `1px solid ${
                        b.canUpgrade
                          ? 'rgba(212,160,48,0.6)'
                          : b.state === 'producing'
                            ? 'rgba(76,175,80,0.3)'
                            : b.state === 'locked'
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(139,115,85,0.2)'
                      }`,
                      opacity: b.state === 'locked' ? 0.5 : 1,
                      transition: 'background 0.2s, border-color 0.3s',
                      boxShadow: b.canUpgrade ? '0 0 8px rgba(212,160,48,0.15)' : 'none',
                      animation: b.canUpgrade ? 'tk-gold-pulse 2s ease-in-out infinite' : 'none',
                    }}
                  >
                    {/* 卡片上部：图标 + 名称/等级 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* SVG 建筑图标 */}
                      <div style={{
                        width: 40, height: 40, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.2)', borderRadius: 4,
                        border: '1px solid rgba(139,115,85,0.15)',
                      }}>
                        <BuildingIcon buildingId={b.id} size={36} />
                      </div>
                      {/* 名称 + 等级 + 产出 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 'bold',
                            color: b.state === 'locked' ? COLOR_THEME.textDim : COLOR_THEME.textPrimary,
                          }}>
                            {b.name}
                          </span>
                          <span style={{
                            fontSize: 10,
                            color: b.level > 0 ? COLOR_THEME.accentGold : COLOR_THEME.textDim,
                            fontWeight: b.level > 0 ? 'bold' : 'normal',
                          }}>
                            Lv.{b.level}
                          </span>
                        </div>
                        {b.level > 0 && (b.productionRate ?? 0) > 0 && (
                          <div style={{ fontSize: 10, color: COLOR_THEME.accentGreen, marginTop: 2 }}>
                            +{fmt(b.productionRate ?? 0)}/s {b.productionResource}
                          </div>
                        )}
                        {b.canUpgrade && (
                          <div style={{ fontSize: 9, color: COLOR_THEME.affordable, marginTop: 2 }}>
                            ▲ 可升级
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 升级进度条 */}
                    {b.level > 0 && (
                      <div style={{ marginTop: 6, paddingLeft: 48 }}>
                        <BuildingProgressBar
                          currentLevel={b.level}
                          progress={levelProgress}
                          width={120}
                          height={3}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 城市列表 ── */}
          {activeMapSubTab === 'cities' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cities.length === 0 ? (
                <div style={{
                  fontSize: 11, color: COLOR_THEME.textDim,
                  textAlign: 'center', padding: '20px 0',
                }}>
                  暂无城市<br />
                  <span style={{ fontSize: 10 }}>征服领土后将自动生成城市</span>
                </div>
              ) : (
                cities.map(city => (
                  <div
                    key={city.cityId}
                    style={{
                      padding: '8px 10px', marginBottom: 4,
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,215,0,0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: COLOR_THEME.accentGold }}>
                        🏰 {city.cityName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: COLOR_THEME.textSecondary }}>
                        🏛️ 繁荣 {city.prosperity.toFixed(1)}
                      </span>
                      <span style={{ fontSize: 10, color: COLOR_THEME.textSecondary }}>
                        👥 {fmt(city.population)}
                      </span>
                      <span style={{ fontSize: 10, color: COLOR_THEME.textSecondary }}>
                        🏗️ {city.buildingCount}建筑
                      </span>
                    </div>
                    {/* 繁荣度进度条 */}
                    <div style={{
                      height: 3, borderRadius: 2, marginTop: 4,
                      background: 'rgba(255,255,255,0.1)',
                    }}>
                      <div style={{
                        width: `${city.prosperity}%`, height: '100%',
                        borderRadius: 2,
                        background: city.prosperity > 60
                          ? COLOR_THEME.accentGreen
                          : city.prosperity > 30
                            ? COLOR_THEME.accentGold
                            : '#e74c3c',
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── 资源点列表 ── */}
          {activeMapSubTab === 'resources' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {resourcePoints.length === 0 ? (
                <div style={{
                  fontSize: 11, color: COLOR_THEME.textDim,
                  textAlign: 'center', padding: '20px 0',
                }}>
                  暂无资源点<br />
                  <span style={{ fontSize: 10 }}>地图生成后将出现资源点</span>
                </div>
              ) : (
                resourcePoints.map(rp => {
                  const typeIcons: Record<string, string> = {
                    farm: '🌾', mine: '⛏️', lumber: '🪓', fishery: '🐟', herb: '🌿',
                  };
                  const icon = typeIcons[rp.type] || '📦';
                  return (
                    <div
                      key={rp.id}
                      style={{
                        padding: '8px 10px', marginBottom: 4,
                        borderRadius: 4,
                        background: rp.isOccupied
                          ? 'rgba(76,175,80,0.08)'
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${rp.isOccupied ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.06)'}`,
                        opacity: rp.isOccupied ? 1 : 0.7,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 'bold' }}>
                          {icon} {rp.name}
                        </span>
                        <span style={{
                          fontSize: 9,
                          color: rp.isOccupied ? COLOR_THEME.accentGreen : COLOR_THEME.textDim,
                          background: rp.isOccupied ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
                          padding: '1px 6px', borderRadius: 3,
                        }}>
                          Lv.{rp.level} {rp.isOccupied ? '✅' : '空闲'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: COLOR_THEME.textSecondary, marginTop: 3 }}>
                        位置: ({rp.position.tileX}, {rp.position.tileY})
                      </div>
                      {rp.isOccupied && (
                        <div style={{ fontSize: 10, color: COLOR_THEME.textSecondary, marginTop: 2 }}>
                          👷 {rp.workerCount}/{rp.maxWorkers} 工人
                        </div>
                      )}
                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {!rp.isOccupied && (
                          <button
                            onClick={() => handleOccupyResourcePoint(rp.id)}
                            style={{
                              padding: '2px 8px', fontSize: 9,
                              borderRadius: 3, border: 'none', cursor: 'pointer',
                              background: 'rgba(76,175,80,0.3)',
                              color: COLOR_THEME.accentGreen,
                            }}
                          >
                            占领
                          </button>
                        )}
                        {rp.isOccupied && (
                          <>
                            <button
                              onClick={() => handleAssignWorkers(rp.id, Math.min(rp.workerCount + 1, rp.maxWorkers))}
                              disabled={rp.workerCount >= rp.maxWorkers}
                              style={{
                                padding: '2px 6px', fontSize: 9,
                                borderRadius: 3, border: 'none', cursor: 'pointer',
                                background: rp.workerCount >= rp.maxWorkers
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(255,215,0,0.2)',
                                color: rp.workerCount >= rp.maxWorkers
                                  ? COLOR_THEME.textDim
                                  : COLOR_THEME.accentGold,
                              }}
                            >
                              +工人
                            </button>
                            <button
                              onClick={() => handleAssignWorkers(rp.id, Math.max(rp.workerCount - 1, 0))}
                              disabled={rp.workerCount <= 0}
                              style={{
                                padding: '2px 6px', fontSize: 9,
                                borderRadius: 3, border: 'none', cursor: 'pointer',
                                background: rp.workerCount <= 0
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(231,76,60,0.2)',
                                color: rp.workerCount <= 0
                                  ? COLOR_THEME.textDim
                                  : '#e74c3c',
                              }}
                            >
                              -工人
                            </button>
                            <button
                              onClick={() => handleUpgradeResourcePoint(rp.id)}
                              disabled={rp.level >= 5}
                              style={{
                                padding: '2px 6px', fontSize: 9,
                                borderRadius: 3, border: 'none', cursor: 'pointer',
                                background: rp.level >= 5
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(76,175,80,0.2)',
                                color: rp.level >= 5
                                  ? COLOR_THEME.textDim
                                  : COLOR_THEME.accentGreen,
                              }}
                            >
                              ▲升级
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ─── 武将快速列表（左侧面板2列网格） ─── */}
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(139,115,85,0.2)', paddingTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#d4b36a', marginBottom: 6, fontFamily: "'KaiTi', 'STKaiti', serif" }}>
              ◆ 武将
            </div>
            <div className="tk-hero-quick-list">
              {heroes.filter(h => h.unlocked).slice(0, 6).map(h => (
                <div
                  key={h.id}
                  className="tk-hero-quick-item"
                  onClick={() => { setScene('hero-detail'); setSelectedHero(h); }}
                >
                  <GeneralCanvasPortrait generalId={h.id} size={24} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <span className="tk-hero-quick-name">{h.name}</span>
                    <span className="tk-hero-quick-level">Lv.{h.level}</span>
                  </div>
                </div>
              ))}
              {heroes.filter(h => h.unlocked).length === 0 && (
                <div style={{ fontSize: 10, color: '#888', gridColumn: '1 / -1', textAlign: 'center', padding: 8 }}>
                  尚未招募武将
                </div>
              )}
            </div>
          </div>
        </aside>
        )}

        {/* ─── 中央：PixiJS 渲染区域 ─── */}
        <div style={{ flex: 1, position: 'relative' }}>
          <PixiGameCanvas
            renderState={renderState}
            config={{
              backgroundColor: '#1a0e05',
              designWidth: 1920,
              designHeight: 1080,
            }}
            onBuildingClick={handleBuildingClick}
            onTerritoryClick={handleTerritoryClick}
            onCombatAction={handleCombatAction}
            onSceneChange={handleSceneChange}
            onNPCClick={handleNPCClick}
            onRendererReady={() => console.log('[ThreeKingdomsPixiGame] PixiJS renderer ready')}
          />

          {/* ═══════════ 粒子效果 Canvas 覆盖层 ═══════════ */}
          <canvas
            ref={particleCanvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />

          {/* ═══════════ 城池场景背景（Canvas 上层，仅地图场景显示） ═══════════ */}
          {scene === 'map' && (
            <div className="tk-city-scene-bg">
              {/* 云雾飘动层（增强版） */}
              <div className="tk-cloud-layer">
                <div className="tk-cloud-mist tk-cloud-mist--1" />
                <div className="tk-cloud-mist tk-cloud-mist--2" />
                <div className="tk-cloud-mist tk-cloud-mist--3" />
              </div>
              {/* 原有云朵 */}
              <div className="tk-scene-cloud" />
              <div className="tk-scene-cloud" />
              <div className="tk-scene-cloud" />
              {/* NPC 巡逻小人 */}
              <div className="tk-scene-npc" />
              <div className="tk-scene-npc" />
              <div className="tk-scene-npc" />
              {/* 城池 SVG 场景（带呼吸动画） */}
              <svg className="tk-city-scene-svg tk-city-breathe" viewBox="0 0 700 300" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
                {/* 农田（左侧绿色方块网格） */}
                <g fill="#3a5a2a" opacity="0.7">
                  <rect x="30" y="230" width="22" height="16" rx="1" />
                  <rect x="56" y="230" width="22" height="16" rx="1" />
                  <rect x="82" y="230" width="22" height="16" rx="1" />
                  <rect x="30" y="250" width="22" height="16" rx="1" />
                  <rect x="56" y="250" width="22" height="16" rx="1" />
                  <rect x="82" y="250" width="22" height="16" rx="1" />
                  <rect x="30" y="270" width="22" height="16" rx="1" />
                  <rect x="56" y="270" width="22" height="16" rx="1" />
                  <rect x="82" y="270" width="22" height="16" rx="1" />
                </g>
                {/* 森林（右侧三角形树） */}
                <g fill="#2e5a1e" opacity="0.6">
                  {/* 树1 */}
                  <polygon points="560,265 570,230 580,265" />
                  <rect x="567" y="265" width="6" height="8" fill="#5a3a20" />
                  {/* 树2 */}
                  <polygon points="590,265 602,220 614,265" />
                  <rect x="599" y="265" width="6" height="8" fill="#5a3a20" />
                  {/* 树3 */}
                  <polygon points="625,265 634,235 643,265" />
                  <rect x="631" y="265" width="6" height="8" fill="#5a3a20" />
                  {/* 树4 */}
                  <polygon points="650,265 660,228 670,265" />
                  <rect x="656" y="265" width="6" height="8" fill="#5a3a20" />
                </g>
                {/* 城墙主体 */}
                <g fill="#8a7a5a" stroke="#6a5a3a" strokeWidth="1">
                  {/* 左城墙 */}
                  <rect x="200" y="200" width="80" height="60" rx="2" />
                  {/* 右城墙 */}
                  <rect x="420" y="200" width="80" height="60" rx="2" />
                  {/* 中间主墙体 */}
                  <rect x="275" y="190" width="150" height="70" rx="2" />
                  {/* 城墙垛口 */}
                  <g fill="#9a8a6a">
                    <rect x="205" y="193" width="8" height="10" rx="1" />
                    <rect x="218" y="193" width="8" height="10" rx="1" />
                    <rect x="231" y="193" width="8" height="10" rx="1" />
                    <rect x="244" y="193" width="8" height="10" rx="1" />
                    <rect x="257" y="193" width="8" height="10" rx="1" />
                    <rect x="425" y="193" width="8" height="10" rx="1" />
                    <rect x="438" y="193" width="8" height="10" rx="1" />
                    <rect x="451" y="193" width="8" height="10" rx="1" />
                    <rect x="464" y="193" width="8" height="10" rx="1" />
                    <rect x="477" y="193" width="8" height="10" rx="1" />
                  </g>
                </g>
                {/* 城门（拱形） */}
                <path d="M320,260 L320,230 A30,30 0 0,1 380,230 L380,260 Z" fill="#4a3a20" stroke="#6a5a3a" strokeWidth="1" />
                <circle cx="372" cy="245" r="3" fill="#b8860b" opacity="0.6" />
                {/* 城楼（中间主楼） */}
                <rect x="310" y="165" width="80" height="28" rx="2" fill="#7a6a4a" stroke="#5a4a2a" strokeWidth="1" />
                {/* 城楼屋顶（三角形） */}
                <polygon points="300,167 350,130 400,167" fill="#a85241" stroke="#8a3a2a" strokeWidth="1" />
                {/* 屋顶装饰 */}
                <line x1="350" y1="130" x2="350" y2="122" stroke="#d4a030" strokeWidth="2" />
                <circle cx="350" cy="120" r="3" fill="#d4a030" opacity="0.5" />
                {/* 左城楼 */}
                <rect x="215" y="180" width="50" height="22" rx="2" fill="#7a6a4a" stroke="#5a4a2a" strokeWidth="1" />
                <polygon points="210,182 240,155 270,182" fill="#a85241" stroke="#8a3a2a" strokeWidth="1" />
                {/* 右城楼 */}
                <rect x="435" y="180" width="50" height="22" rx="2" fill="#7a6a4a" stroke="#5a4a2a" strokeWidth="1" />
                <polygon points="430,182 460,155 490,182" fill="#a85241" stroke="#8a3a2a" strokeWidth="1" />
                {/* 旗帜 */}
                <line x1="350" y1="130" x2="350" y2="100" stroke="#8a7a5a" strokeWidth="1.5" />
                <polygon points="350,100 370,108 350,116" fill="#c62828" opacity="0.5">
                  <animateTransform attributeName="transform" type="rotate" values="-2,350,108;2,350,108;-2,350,108" dur="3s" repeatCount="indefinite" />
                </polygon>
                {/* 地面 */}
                <rect x="0" y="275" width="700" height="25" fill="#3a2a18" opacity="0.3" rx="0" />
              </svg>
            </div>
          )}

          {/* ═══════════ 主界面场景面板（地图场景中央概览） ═══════════ */}
          {scene === 'map' && (
            <div className="tk-scene-panel tk-panel-animate-in tk-r16-panel-enter" key={`panel-map-${activeTab}`}>
              {/* 城池概览（带呼吸动画） */}
              <div className="tk-scene-city tk-scene-city--breathe">
                <div className="tk-scene-city-icon">🏰</div>
                <div className="tk-scene-city-info">
                  <div className="tk-scene-city-name">
                    {cities.length > 0 ? cities[0].cityName : '主城'}
                    <span className="tk-scene-city-level">Lv.{cities.length > 0 ? Math.max(1, Math.floor(cities[0].prosperity / 100)) : 1}</span>
                  </div>
                  <div className="tk-scene-city-stats">
                    领地 {cities.length} · 繁荣 {cities.length > 0 ? Math.floor(cities[0].prosperity) : 0}
                  </div>
                </div>
              </div>

              {/* 资源产出动画 */}
              <div className="tk-scene-production">
                <div className="tk-scene-section-title">◆ 资源产出</div>
                {resources.map(r => (
                  <div key={r.id} className="tk-scene-prod-row">
                    <span className="tk-scene-prod-icon"><ResourceIcon resourceId={r.id} size={16} /></span>
                    <span className="tk-scene-prod-name">{r.name}</span>
                    <span className="tk-scene-prod-rate">+{fmt(r.perSecond)}/秒</span>
                  </div>
                ))}
              </div>

              {/* 当前任务进度 */}
              <div className="tk-scene-quests">
                <div className="tk-scene-section-title">◆ 当前任务</div>
                {quests.filter(q => !q.isComplete).slice(0, 3).map(q => (
                  <div key={q.id} className="tk-scene-quest-item">
                    <div className="tk-scene-quest-title">{q.title}</div>
                    <div className="tk-scene-quest-bar">
                      <div className="tk-scene-quest-fill" style={{ width: `${(q.progress / q.maxProgress) * 100}%` }} />
                    </div>
                    <div className="tk-scene-quest-progress">{q.progress}/{q.maxProgress}</div>
                  </div>
                ))}
                {quests.filter(q => !q.isComplete).length === 0 && (
                  <div className="tk-scene-quest-empty">暂无进行中的任务</div>
                )}
              </div>

              {/* 武将概览 */}
              <div className="tk-scene-heroes">
                <div className="tk-scene-section-title">◆ 武将</div>
                <div className="tk-scene-hero-count">
                  已招募 <span className="tk-scene-hero-num">{heroes.filter(h => h.unlocked).length}</span> / {heroes.length}
                </div>
                <div className="tk-scene-hero-avatars">
                  {heroes.filter(h => h.unlocked).slice(0, 6).map(h => (
                    <div key={h.id} className="tk-scene-hero-avatar" title={h.name}>
                      <GeneralCanvasPortrait generalId={h.id} size={32} showName />
                    </div>
                  ))}
                </div>
              </div>

              {/* 声望入口按钮 */}
              <button
                onClick={() => setScene('prestige')}
                className="tk-scene-prestige-btn"
              >
                ◆ 声望
              </button>
            </div>
          )}

          {/* 战斗日志浮层（仅战斗场景显示） */}
          {scene === 'combat' && combatLog.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 80, left: 12,
              width: 260, maxHeight: 180,
              background: 'rgba(0,0,0,0.75)',
              borderRadius: 6, padding: 8,
              overflowY: 'auto', fontSize: 11,
              color: COLOR_THEME.textSecondary,
              border: '1px solid rgba(255,255,255,0.1)',
              pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: 10, color: COLOR_THEME.accentGold,
                marginBottom: 4, fontWeight: 'bold',
              }}>
                战斗日志
              </div>
              {combatLog.map((log, i) => (
                <div key={i} style={{
                  padding: '1px 0',
                  color: log.includes('暴击') ? '#ff6b6b' : log.includes('胜利') ? COLOR_THEME.accentGreen : COLOR_THEME.textSecondary,
                }}>
                  {log}
                </div>
              ))}
            </div>
          )}

          {/* 战斗状态浮层（含撤退按钮） */}
          {scene === 'combat' && combatData && (
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '6px 20px',
              display: 'flex', gap: 20, alignItems: 'center',
              border: `1px solid ${combatData.state === 'victory' ? 'rgba(76,175,80,0.5)' : 'rgba(255,215,0,0.3)'}`,
            }}>
              <span style={{ fontSize: 13, color: COLOR_THEME.accentGold, fontWeight: 'bold' }}>
                {combatData.state === 'preparing' && '⚔️ 准备战斗'}
                {combatData.state === 'fighting' && '🔥 战斗中'}
                {combatData.state === 'victory' && '🎉 胜利！'}
                {combatData.state === 'defeat' && '💀 战败'}
              </span>
              <span style={{ fontSize: 11, color: COLOR_THEME.textSecondary }}>
                波次 {combatData.currentWave}/{combatData.totalWaves}
              </span>
              {(combatData.state === 'fighting' || combatData.state === 'preparing') && (
                <button
                  onClick={exitBattle}
                  style={{
                    padding: '3px 14px', fontSize: 11,
                    borderRadius: 4, border: '1px solid #c9a96e',
                    background: '#8B4513', color: '#fff',
                    cursor: 'pointer', fontWeight: 'bold',
                  }}
                >
                  🏳️ 撤退
                </button>
              )}
            </div>
          )}

          {/* 声望转生浮层 */}
          {scene === 'prestige' && prestigeData && (
            <div className="tk-panel-animate-in tk-r16-panel-enter" key="panel-prestige" style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.75)',
              borderRadius: 12, padding: 20,
              width: 320, textAlign: 'center',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              <h2 style={{
                fontSize: 20, color: COLOR_THEME.accentGold,
                marginBottom: 14, fontFamily: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif",
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}>
                ◆ 👑 声望转生
              </h2>
              <div style={{ fontSize: 13, lineHeight: 2, color: COLOR_THEME.textPrimary }}>
                <div>天命: <b style={{ color: COLOR_THEME.accentGold }}>{fmt(prestigeData.currency)}</b> | 转生: {prestigeData.count}次</div>
                <div>当前倍率: <b>×{prestigeData.multiplier.toFixed(2)}</b></div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 8 }}>
                  本次获得: <b style={{ color: COLOR_THEME.accentGold }}>{fmt(prestigeData.previewGain)}</b> 天命
                </div>
                <div>新倍率: <b>×{prestigeData.previewNewMultiplier.toFixed(2)}</b></div>
                <div>资源保留: <b>{(prestigeData.retentionRate * 100).toFixed(0)}%</b></div>
              </div>
              {prestigeData.warning && (
                <p style={{ fontSize: 11, color: COLOR_THEME.textDim, marginTop: 8 }}>
                  {prestigeData.warning}
                </p>
              )}
              <button
                onClick={() => engineRef.current?.doPrestige()}
                disabled={!prestigeData.canPrestige}
                style={{
                  marginTop: 16, padding: '8px 32px',
                  fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
                  borderRadius: 6, border: 'none',
                  background: prestigeData.canPrestige
                    ? `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`
                    : 'rgba(255,255,255,0.1)',
                  color: prestigeData.canPrestige ? '#1a0a0a' : COLOR_THEME.textDim,
                }}
              >
                {prestigeData.canPrestige ? '执行转生' : '资源不足'}
              </button>
              <button
                onClick={() => { setScene('map'); setActiveTab('Escape'); }}
                style={{
                  marginTop: 10, padding: '6px 20px',
                  fontSize: 12, cursor: 'pointer',
                  borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: COLOR_THEME.textDim,
                  display: 'block', marginLeft: 'auto', marginRight: 'auto',
                }}
              >
                ← 返回地图
              </button>
            </div>
          )}

          {/* ═══════════ 征战关卡面板 ═══════════ */}
          {scene === 'stage-info' && (
            <div className="tk-panel-animate-in tk-r16-panel-enter" key="panel-stage-info">
            <CampaignPanel
              engine={engineRef.current}
              renderState={renderState}
              onClose={() => setScene('map')}
              onBattleStart={(stageId: string) => {
                const engine = engineRef.current;
                if (!engine) return;
                const result = engine.startCampaignBattle(stageId);
                setCampaignBattleResult(result);
                setShowCampaignBattleReport(true);
              }}
              addToast={addToast}
              COLOR_THEME={COLOR_THEME}
            />
            </div>
          )}
          {showCampaignBattleReport && campaignBattleResult && (
            <CampaignBattleReport
              result={campaignBattleResult}
              onClose={() => { setShowCampaignBattleReport(false); setCampaignBattleResult(null); }}
              COLOR_THEME={COLOR_THEME}
            />
          )}

          {/* ═══════════ 科技研究浮层（树形可视化 — 视觉增强版） ═══════════ */}
          {scene === 'tech-tree' && renderState?.techTree && (() => {
            const nodes = renderState.techTree.nodes;
            const connections = renderState.techTree.connections;

            // 按分支分组
            const branchOrder = ['military', 'economy', 'culture'] as const;
            const branchLabels: Record<string, string> = { military: '⚔️ 军事', economy: '💰 经济', culture: '📜 文化' };
            const branchColors: Record<string, { border: string; bg: string; text: string; glow: string; accent: string }> = {
              military: { border: '#a85241', bg: 'rgba(168,82,65,0.08)', text: '#c62828', glow: 'rgba(168,82,65,0.25)', accent: '#e53935' },
              economy:  { border: '#4a7a3a', bg: 'rgba(74,122,58,0.08)', text: '#2e7d32', glow: 'rgba(74,122,58,0.25)', accent: '#66bb6a' },
              culture:  { border: '#4a6fa5', bg: 'rgba(74,111,165,0.08)', text: '#1565c0', glow: 'rgba(74,111,165,0.25)', accent: '#42a5f5' },
            };

            function getBranch(nodeId: string): string {
              if (nodeId.startsWith('mil_')) return 'military';
              if (nodeId.startsWith('eco_')) return 'economy';
              if (nodeId.startsWith('cul_')) return 'culture';
              return 'military';
            }

            const nodeMap = new Map(nodes.map(n => [n.id, n]));

            // 跨分支连接定义（某些科技需要跨路线前置）
            const crossBranchConnections: Array<{ from: string; to: string; label: string }> = [
              { from: 'mil_2', to: 'eco_3', label: '军→经' },
              { from: 'eco_2', to: 'cul_3', label: '经→文' },
              { from: 'cul_2', to: 'mil_3', label: '文→军' },
            ];

            // 统计已研究/可研究数量
            const researchedCount = nodes.filter(n => n.state === 'completed').length;
            const totalNodes = nodes.length;

            return (
              <div className="tk-tech-overlay tk-panel-animate-in tk-r16-panel-enter" key="panel-tech-tree" style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(35, 22, 10, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: 12, padding: 16,
                width: 620, maxHeight: '82vh',
                overflowY: 'auto',
                border: `1px solid ${COLOR_THEME.selectedBorder}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(212,160,48,0.08)',
              }}>
                {/* 标题 + 进度 */}
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <h2 style={{
                    fontSize: 18, color: COLOR_THEME.accentGold,
                    margin: '0 0 4px', fontFamily: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif",
                    textShadow: '0 0 12px rgba(212,160,48,0.3)',
                    letterSpacing: 4,
                  }}>
                    ◆ 科技研究 ◆
                  </h2>
                  {/* 装饰线 */}
                  <div className="tk-tech-title-line" style={{ margin: '6px auto', width: '60%' }} />
                  {/* 总进度条 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                    <div style={{
                      width: 240, height: 6, borderRadius: 3,
                      background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                    }}>
                      <div style={{
                        width: `${totalNodes > 0 ? (researchedCount / totalNodes * 100) : 0}%`,
                        height: '100%', borderRadius: 3,
                        background: `linear-gradient(90deg, ${COLOR_THEME.accentGold}, #ff8c00, ${COLOR_THEME.accentGold})`,
                        backgroundSize: '200% 100%',
                        transition: 'width 0.5s ease',
                        boxShadow: '0 0 8px rgba(212,160,48,0.4)',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: COLOR_THEME.accentGold, fontWeight: 'bold' }}>
                      {researchedCount}/{totalNodes}
                    </span>
                  </div>
                </div>

                {/* 三列树形布局 + 跨分支连接 */}
                <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  {/* 跨分支连接线（SVG 叠加层 — 增强版） */}
                  <svg style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    pointerEvents: 'none', zIndex: 0,
                  }}>
                    <defs>
                      {/* 渐变箭头标记 */}
                      <marker id="arrowCrossGold" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0,0 8,3 0,6" fill="rgba(212,160,48,0.5)" />
                      </marker>
                      <marker id="arrowCrossDim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0,0 8,3 0,6" fill="rgba(255,255,255,0.08)" />
                      </marker>
                      {/* 流动渐变 */}
                      <linearGradient id="flowGradMilEco" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a85241" stopOpacity="0.6" />
                        <stop offset="50%" stopColor="#d4a030" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#4a7a3a" stopOpacity="0.6" />
                      </linearGradient>
                      <linearGradient id="flowGradEcoCul" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4a7a3a" stopOpacity="0.6" />
                        <stop offset="50%" stopColor="#d4a030" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#4a6fa5" stopOpacity="0.6" />
                      </linearGradient>
                      <linearGradient id="flowGradCulMil" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4a6fa5" stopOpacity="0.6" />
                        <stop offset="50%" stopColor="#d4a030" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#a85241" stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                    {crossBranchConnections.map((conn, ci) => {
                      const fromBranch = getBranch(conn.from);
                      const toBranch = getBranch(conn.to);
                      const fromBranchIdx = branchOrder.indexOf(fromBranch as any);
                      const toBranchIdx = branchOrder.indexOf(toBranch as any);
                      const fromNode = nodeMap.get(conn.from);
                      const toNode = nodeMap.get(conn.to);
                      if (!fromNode || !toNode) return null;
                      // 计算近似位置
                      const colWidth = 100 / 3;
                      const fromX = `${colWidth * fromBranchIdx + colWidth / 2}%`;
                      const fromTier = fromNode.tier;
                      const toTier = toNode.tier;
                      const tierStartY = 70; // px from top of content area
                      const tierSpacing = 92;
                      const fromY = tierStartY + (fromTier - 1) * tierSpacing + 20;
                      const toY = tierStartY + (toTier - 1) * tierSpacing + 20;
                      const fromCompleted = fromNode.state === 'completed';
                      const toCompleted = toNode.state === 'completed';
                      const active = fromCompleted;
                      // 选择渐变
                      const gradId = ci === 0 ? 'flowGradMilEco' : ci === 1 ? 'flowGradEcoCul' : 'flowGradCulMil';
                      return (
                        <line key={ci}
                          x1={fromX} y1={fromY} x2={`${colWidth * toBranchIdx + colWidth / 2}%`} y2={toY}
                          stroke={active ? `url(#${gradId})` : 'rgba(255,255,255,0.06)'}
                          strokeWidth={active ? 1.8 : 1}
                          strokeDasharray={active ? '6,4' : '3,4'}
                          markerEnd={active ? 'url(#arrowCrossGold)' : 'url(#arrowCrossDim)'}
                          className={active ? 'tk-tech-cross-connector--active' : undefined}
                          opacity={active ? 1 : 0.5}
                        />
                      );
                    })}
                  </svg>

                  {branchOrder.map(branch => {
                    const branchNodes = nodes.filter(n => getBranch(n.id) === branch).sort((a, b) => a.tier - b.tier);
                    const colors = branchColors[branch];
                    const branchCompleted = branchNodes.filter(n => n.state === 'completed').length;

                    return (
                      <div key={branch} style={{
                        flex: 1, display: 'flex', flexDirection: 'column', gap: 0,
                        position: 'relative', zIndex: 1,
                      }}>
                        {/* 分支颜色标记条 — 渐变增强 */}
                        <div style={{
                          position: 'absolute', top: 0, bottom: 0, left: 0,
                          width: 3, borderRadius: 2,
                          background: `linear-gradient(180deg, ${colors.accent}, ${colors.border}, transparent)`,
                          opacity: 0.6,
                          boxShadow: `0 0 6px ${colors.glow}`,
                        }} />

                        {/* 分支标题 — 增强版 */}
                        <div style={{
                          textAlign: 'center', fontSize: 13, fontWeight: 'bold',
                          color: colors.text, marginBottom: 8,
                          padding: '6px 0',
                          borderBottom: `2px solid ${colors.border}`,
                          textShadow: `0 0 10px ${colors.glow}`,
                          position: 'relative',
                        }}>
                          {branchLabels[branch]}
                          <span style={{
                            fontSize: 9, color: COLOR_THEME.textDim,
                            marginLeft: 6, fontWeight: 'normal',
                          }}>
                            {branchCompleted}/{branchNodes.length}
                          </span>
                        </div>

                        {/* 科技节点（层级排列 + 增强连接线） */}
                        {branchNodes.map((node, idx) => {
                          const isCompleted = node.state === 'completed';
                          const isAvailable = node.state === 'available';
                          const isResearching = node.state === 'researching';
                          const isLocked = node.state === 'locked';
                          const hasConnector = idx > 0;

                          // 跨分支前置检查
                          const crossPrereqs = node.prerequisites.filter(pid => getBranch(pid) !== branch);
                          const crossPrereqMet = crossPrereqs.every(pid => {
                            const pn = nodeMap.get(pid);
                            return pn && pn.state === 'completed';
                          });

                          return (
                            <div key={node.id} className="tk-tech-node--appear" style={{ animationDelay: `${idx * 0.05}s` }}>
                              {/* 层级连接线 — 渐变 + 流动 */}
                              {hasConnector && (
                                <div style={{
                                  display: 'flex', justifyContent: 'center',
                                  height: 16, position: 'relative',
                                }}>
                                  <svg width="40" height="16" style={{ overflow: 'visible' }}>
                                    <line
                                      x1="20" y1="0" x2="20" y2="16"
                                      stroke={isCompleted
                                        ? colors.accent
                                        : isResearching
                                          ? colors.border
                                          : 'rgba(255,255,255,0.12)'}
                                      strokeWidth={isCompleted ? 2.5 : 2}
                                      strokeDasharray={isCompleted ? '6,4' : '3,3'}
                                      className={isCompleted ? `tk-tech-connector--completed tk-tech-connector--${getBranch(node.id)}` : undefined}
                                      opacity={isCompleted ? 0.8 : 0.5}
                                    />
                                    {/* 流动粒子点 */}
                                    {isCompleted && (
                                      <>
                                        <circle r="2" fill={colors.accent} opacity="0.8">
                                          <animateMotion dur="1.5s" repeatCount="indefinite" path="M20,0 L20,16" />
                                        </circle>
                                      </>
                                    )}
                                  </svg>
                                  {isCompleted && (
                                    <div style={{
                                      position: 'absolute', top: '50%', left: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      width: 8, height: 8, borderRadius: '50%',
                                      background: `radial-gradient(circle, ${colors.accent}, ${colors.border})`,
                                      boxShadow: `0 0 6px ${colors.glow}, 0 0 12px ${colors.glow}`,
                                    }} />
                                  )}
                                </div>
                              )}

                              {/* 科技节点 — 增强版 */}
                              <div
                                className={`tk-tech-node ${isCompleted ? 'tk-tech-node--completed' : ''} ${isAvailable ? 'tk-tech-node--available' : ''} ${isResearching ? 'tk-tech-node--researching' : ''} tk-tech-branch--${getBranch(node.id)}`}
                                onMouseEnter={() => setHoveredTechNode(node.id)}
                                onMouseLeave={() => setHoveredTechNode(null)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  background: isCompleted
                                    ? `linear-gradient(135deg, rgba(212,160,48,0.15), ${colors.bg}, rgba(212,160,48,0.08))`
                                    : isResearching
                                      ? `linear-gradient(135deg, ${colors.bg}, rgba(212,160,48,0.05))`
                                      : isAvailable
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'rgba(255,255,255,0.01)',
                                  border: `1.5px solid ${
                                    isCompleted ? COLOR_THEME.accentGold
                                      : isResearching ? colors.border
                                        : isAvailable ? `${colors.border}88`
                                          : 'rgba(255,255,255,0.06)'
                                  }`,
                                  opacity: isLocked ? 0.45 : 1,
                                  position: 'relative',
                                  overflow: 'hidden',
                                  boxShadow: isCompleted
                                    ? `0 0 8px ${colors.glow}, inset 0 0 8px rgba(212,160,48,0.05)`
                                    : isResearching
                                      ? `0 0 6px rgba(212,160,48,0.15)`
                                      : 'none',
                                  transition: 'box-shadow 0.3s, border-color 0.3s',
                                }}
                              >
                                {/* 已解锁 — 金色标记 + 粒子环绕 */}
                                {isCompleted && (
                                  <>
                                    <div style={{
                                      position: 'absolute', top: -4, right: -4,
                                      width: 16, height: 16, borderRadius: '50%',
                                      background: `radial-gradient(circle, ${COLOR_THEME.accentGold}, #b8943e)`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, color: '#1a0a0a', fontWeight: 'bold',
                                      boxShadow: '0 0 8px rgba(212,160,48,0.6)',
                                      zIndex: 2,
                                    }}>✓</div>
                                    {/* 粒子环绕 */}
                                    <div className="tk-tech-particles">
                                      <div className="tk-tech-particle" />
                                      <div className="tk-tech-particle" />
                                      <div className="tk-tech-particle" />
                                    </div>
                                  </>
                                )}

                                {/* 跨分支前置标记 */}
                                {crossPrereqs.length > 0 && !isCompleted && (
                                  <div style={{
                                    position: 'absolute', top: -4, left: -4,
                                    width: 12, height: 12, borderRadius: '50%',
                                    background: crossPrereqMet ? '#4a7a3a' : '#666',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    fontSize: 7, color: '#fff', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    zIndex: 2,
                                  }}>↗</div>
                                )}

                                {/* 科技图标 + 名称行 */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                    {/* 分支专属 SVG 图标替代通用 emoji */}
                                    <div style={{
                                      flexShrink: 0,
                                      width: 28, height: 28,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      opacity: isLocked ? 0.5 : 1,
                                      filter: isLocked ? 'grayscale(0.8)' : 'none',
                                    }}>
                                      {isLocked
                                        ? <TechLockedIcon size={24} />
                                        : isResearching
                                          ? <TechIcon techId={node.id} size={24} />
                                          : <TechIcon techId={node.id} size={24} />
                                      }
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        <span style={{
                                          fontSize: 12, fontWeight: 'bold',
                                          color: isCompleted ? COLOR_THEME.accentGold
                                            : isResearching ? colors.text
                                              : isAvailable ? COLOR_THEME.textPrimary
                                                : COLOR_THEME.textDim,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}>
                                          {node.name}
                                        </span>
                                        <span style={{
                                          fontSize: 9, color: isCompleted ? 'rgba(212,160,48,0.6)' : COLOR_THEME.textDim,
                                        }}>
                                          T{node.tier}
                                        </span>
                                      </div>
                                      <div style={{
                                        fontSize: 9, color: isCompleted
                                          ? 'rgba(240,230,211,0.6)'
                                          : COLOR_THEME.textSecondary,
                                        marginTop: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {node.description}
                                      </div>
                                    </div>
                                  </div>
                                  {isAvailable && (
                                    <button
                                      onClick={() => {
                                        const engine = engineRef.current;
                                        if (!engine) return;
                                        const techs = (engine as any).techs;
                                        if (!techs) return;
                                        const res = engine.getResources();
                                        const success = techs.research(node.id, res);
                                        if (success) {
                                          const payMethod = (engine as any).pay;
                                          if (payMethod) payMethod.call(engine, node.cost);
                                          addToast(`开始研究：${node.name}`, 'success');
                                          (engine as any).emit?.('stateChange');
                                        } else {
                                          addToast('研究失败：资源不足或前置未完成', 'error');
                                        }
                                      }}
                                      className="tk-btn-dynamic"
                                      style={{
                                        padding: '3px 12px', fontSize: 9,
                                        borderRadius: 4, border: 'none', cursor: 'pointer',
                                        background: `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
                                        color: '#1a0a0a', fontWeight: 'bold',
                                        boxShadow: '0 2px 6px rgba(212,160,48,0.3)',
                                        flexShrink: 0,
                                        transition: 'transform 0.15s, box-shadow 0.15s',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 3px 10px rgba(212,160,48,0.5)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(212,160,48,0.3)';
                                      }}
                                    >
                                      研究
                                    </button>
                                  )}
                                </div>

                                {/* 研究中 — 旋转进度指示器 + 平滑进度条 */}
                                {isResearching && (
                                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div className="tk-tech-research-spinner">
                                      <svg viewBox="0 0 16 16" fill="none">
                                        <circle cx="8" cy="8" r="6" stroke="rgba(212,160,48,0.25)" strokeWidth="2" />
                                        <circle cx="8" cy="8" r="6" stroke={colors.accent} strokeWidth="2" strokeLinecap="round"
                                          strokeDasharray="28 10" transform="rotate(-90 8 8)" />
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{
                                        height: 4, borderRadius: 2,
                                        background: 'rgba(255,255,255,0.08)',
                                        overflow: 'hidden',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                                      }}>
                                        <div
                                          className="tk-r16-tech-progress-researching"
                                          style={{
                                            width: `${(node.progress * 100).toFixed(0)}%`,
                                            height: '100%', borderRadius: 2,
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <span style={{
                                      fontSize: 9, color: colors.text,
                                      fontWeight: 'bold', minWidth: 32, textAlign: 'right',
                                    }}>
                                      {(node.progress * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                                {isAvailable && Object.keys(node.cost).length > 0 && (
                                  <div style={{ fontSize: 8, color: COLOR_THEME.textDim, marginTop: 2 }}>
                                    费用: {Object.entries(node.cost).map(([k, v]) => `${v} ${k}`).join('  ')}
                                  </div>
                                )}

                                {/* ── 加成预览 Tooltip（悬停显示 — 增强版含数值加成） ── */}
                                {hoveredTechNode === node.id && (
                                  <div className="tk-tech-tooltip">
                                    <div className="tk-tech-tooltip-name">{node.name}</div>
                                    <div className="tk-tech-tooltip-desc">{node.description}</div>
                                    {/* 数值加成预览 */}
                                    {(() => {
                                      // 从 TECHS 常量中获取具体效果
                                      const techDef = TECHS.find(t => t.id === node.id);
                                      if (techDef && techDef.effects.length > 0) {
                                        return (
                                          <div className="tk-tech-tooltip-effects">
                                            <div className="tk-tech-tooltip-effects-title">◆ 效果预览</div>
                                            {techDef.effects.map((eff, ei) => (
                                              <div key={ei} className="tk-tech-tooltip-effect-item">
                                                <span className="tk-tech-tooltip-effect-icon">
                                                  {eff.type === 'multiplier' ? '📈' : eff.type === 'modifier' ? '⚡' : eff.type === 'unlock' ? '🔓' : '✨'}
                                                </span>
                                                <span className="tk-tech-tooltip-effect-text">{eff.description}</span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {node.prerequisites.length > 0 && (
                                      <div className="tk-tech-tooltip-prereqs">
                                        前置：{node.prerequisites.map(pid => {
                                          const pn = nodeMap.get(pid);
                                          const met = pn?.state === 'completed';
                                          return (
                                            <span key={pid} className={met ? 'tk-prereq-met' : 'tk-prereq-unmet'}>
                                              {pn?.name ?? pid} {met ? '✓' : '✗'}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* 跨分支连接说明 */}
                <div style={{
                  marginTop: 14, paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', justifyContent: 'center', gap: 16,
                  fontSize: 10, color: COLOR_THEME.textDim,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR_THEME.accentGold, display: 'inline-block', boxShadow: '0 0 4px rgba(212,160,48,0.5)' }} />
                    已研究
                  </span>
                  <span>↗ = 跨路线前置</span>
                  <span style={{ color: 'rgba(212,160,48,0.6)' }}>--- = 跨路线加成</span>
                  <span>🔬 = 研究中</span>
                  <span style={{ opacity: 0.5 }}>🔒 = 未解锁</span>
                </div>
              </div>
            );
          })()}

          {/* ═══════════ 战斗发起浮层 ═══════════ */}
          {scene === 'combat' && combatData && combatData.state === 'preparing' && (
            <div style={{
              position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <button
                onClick={() => handleCombatAction('start_battle', combatData.battleId)}
                style={{
                  padding: '10px 32px', fontSize: 15, fontWeight: 'bold',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, #e74c3c, #c0392b)`,
                  color: '#fff',
                  boxShadow: '0 2px 12px rgba(231,76,60,0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ⚔️ 开始战斗
              </button>
            </div>
          )}

          {/* ═══════════ 战斗模式全屏遮罩 ═══════════ */}
          {battleMode && scene === 'combat' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: combatData?.state === 'fighting' ? 'none' : 'auto',
            }}>
              <div style={{
                color: '#c9a96e', fontSize: 28, marginBottom: 8,
                fontFamily: '"Noto Serif SC", serif',
                textShadow: '0 0 20px rgba(255,215,0,0.5), 0 2px 4px rgba(0,0,0,0.5)',
              }}>
                ⚔️ 战 斗 中 ⚔️
              </div>
              {combatData && (
                <div style={{ color: '#aaa', fontSize: 14, marginBottom: 20 }}>
                  波次 {combatData.currentWave}/{combatData.totalWaves}
                  {combatData.state === 'victory' && ' — 🎉 胜利！'}
                  {combatData.state === 'defeat' && ' — 💀 战败'}
                </div>
              )}
              {(combatData?.state === 'preparing' || combatData?.state === 'fighting') && (
                <button
                  onClick={exitBattle}
                  style={{
                    background: '#8B4513', color: '#fff',
                    padding: '10px 32px', fontSize: 16,
                    border: '1px solid #c9a96e', cursor: 'pointer',
                    borderRadius: 6, fontWeight: 'bold',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  🏳️ 撤退
                </button>
              )}
              {(combatData?.state === 'victory' || combatData?.state === 'defeat') && (
                <button
                  onClick={exitBattle}
                  style={{
                    background: `linear-gradient(135deg, #c9a96e, #ff8c00)`,
                    color: '#1a0a0a',
                    padding: '10px 32px', fontSize: 16,
                    border: 'none', cursor: 'pointer',
                    borderRadius: 6, fontWeight: 'bold',
                  }}
                >
                  返回地图
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── 右侧面板：武将列表 + 详情面板 ─── */}
        {showHeroPanel && !isMobile && (
        <aside className="tk-scroll-hero-panel" style={{
          width: selectedHero ? 340 : 220, flexShrink: 0,
          overflowY: 'auto', padding: 8,
          zIndex: 5,
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.3s ease',
        }}>
          {/* 面板标题装饰 */}
          <div className="tk-panel-title-ancient">武将名册</div>
          {/* 武将详情面板（选中时显示 — 卷轴风格） */}
          {selectedHero ? (
            <div style={{ flex: 1 }}>
              {/* 关闭按钮 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <button
                  onClick={() => setSelectedHero(null)}
                  style={{
                    background: 'transparent', color: '#c9a96e',
                    border: 'none', cursor: 'pointer', fontSize: 18,
                    padding: '2px 6px',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* 卷轴面板 */}
              <div className="tk-scroll-panel" style={{ marginTop: 8 }}>
                {/* 卷轴轴头端部装饰 */}
                <div className="tk-scroll-endcap-left tk-scroll-endcap-top" />
                <div className="tk-scroll-endcap-right tk-scroll-scroll-top" />
                <div className="tk-scroll-endcap-left tk-scroll-endcap-bottom" />
                <div className="tk-scroll-endcap-right tk-scroll-endcap-bottom" />

                {/* 头像 + 名称 + 势力标识 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <GeneralCanvasPortrait generalId={selectedHero.id} size={56} />
                  <div style={{ flex: 1 }}>
                    <h3 className="tk-scroll-title" style={{ fontSize: 16, margin: 0 }}>
                      {selectedHero.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span className={`tk-faction-badge tk-faction-badge--${selectedHero.faction}`}>
                        {selectedHero.faction === 'wei' ? '魏' : selectedHero.faction === 'shu' ? '蜀' : '吴'}
                      </span>
                      <span className="tk-scroll-text-dim" style={{ fontSize: 10 }}>
                        {selectedHero.rarity} · Lv.{selectedHero.level}
                      </span>
                    </div>
                    {/* 势力归属说明 */}
                    {getGeneralEnhanced(selectedHero.id).factionDesc && (
                      <div className="tk-faction-desc" style={{ marginTop: 4 }}>
                        {getGeneralEnhanced(selectedHero.id).factionDesc}
                      </div>
                    )}
                  </div>
                </div>

                {/* 历史事件标签 */}
                {getGeneralEnhanced(selectedHero.id).historyEvents && getGeneralEnhanced(selectedHero.id).historyEvents!.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {getGeneralEnhanced(selectedHero.id).historyEvents!.map((evt, i) => (
                      <span key={i} className="tk-history-tag">📜 {evt}</span>
                    ))}
                  </div>
                )}

                {/* 关联武将提示 */}
                {getGeneralEnhanced(selectedHero.id).relatedGenerals && getGeneralEnhanced(selectedHero.id).relatedGenerals!.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {getGeneralEnhanced(selectedHero.id).relatedGenerals!.map((rel, i) => (
                      <span key={i} className="tk-related-general-tag">
                        {rel.name} <span style={{ color: '#b87333', fontSize: 8 }}>「{rel.relation}」</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* 背景故事 */}
                <div className="tk-bio-text" style={{ marginBottom: 8 }}>
                  「{getGeneralEnhanced(selectedHero.id).bio}」
                </div>

                <hr className="tk-scroll-divider" />

                {/* 详情 Tab 切换 */}
                <div className="tk-detail-tabs">
                  <button
                    className={`tk-detail-tab-btn ${heroDetailTab === 'info' ? 'tk-detail-tab-btn--active' : ''}`}
                    onClick={() => setHeroDetailTab('info')}
                  >
                    ◆ 属性
                  </button>
                  <button
                    className={`tk-detail-tab-btn ${heroDetailTab === 'biography' ? 'tk-detail-tab-btn--active' : ''}`}
                    onClick={() => setHeroDetailTab('biography')}
                  >
                    ◆ 传记
                  </button>
                </div>

                {heroDetailTab === 'info' ? (
                  <>
                    {/* 属性面板 */}
                    {selectedHero.unlocked && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                        {[
                          { label: '攻击', value: selectedHero.stats.attack, color: '#c62828' },
                          { label: '防御', value: selectedHero.stats.defense, color: '#2e4a7a' },
                          { label: '智力', value: selectedHero.stats.intelligence, color: '#7b1fa2' },
                          { label: '统率', value: selectedHero.stats.command, color: '#e65100' },
                        ].map(stat => (
                          <div key={stat.label} style={{
                            background: 'rgba(139,115,85,0.1)', borderRadius: 4, padding: '4px 8px',
                            display: 'flex', justifyContent: 'space-between',
                          }}>
                            <span className="tk-scroll-text-dim" style={{ fontSize: 10 }}>{stat.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 'bold', color: stat.color }}>{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <hr className="tk-scroll-divider" />

                    {/* 技能列表（增强：效果说明 + 冷却 + 伤害类型） */}
                    {selectedHero.unlocked && (
                      <div style={{ marginBottom: 8 }}>
                        <div className="tk-scroll-title" style={{ fontSize: 11, marginBottom: 4 }}>
                          ◆ 技能
                        </div>
                        {getGeneralEnhanced(selectedHero.id).skills.map((skill, i) => (
                          <div key={i} className="tk-skill-detail">
                            <div className="tk-skill-detail-name">
                              <SkillIcon skillType={skill.type} size={16} />
                              {skill.name}
                              {skill.damageType && (
                                <span className={`tk-skill-type-badge tk-skill-type-badge--${skill.damageType}`}>
                                  {skill.damageType === 'physical' ? '物理' : skill.damageType === 'magic' ? '法术' : '辅助'}
                                </span>
                              )}
                              {skill.cooldown && (
                                <span className="tk-skill-cooldown">⏱ {skill.cooldown}s</span>
                              )}
                            </div>
                            <div className="tk-skill-detail-desc">
                              {skill.effect || skill.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <hr className="tk-scroll-divider" />

                    {/* 装备槽位 */}
                    {selectedHero.unlocked && (
                      <div>
                        <div className="tk-scroll-title" style={{ fontSize: 11, marginBottom: 6 }}>
                          ◆ 装备
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(['weapon', 'armor', 'mount'] as const).map(slot => {
                            const equipData = getGeneralEnhanced(selectedHero.id).equipment;
                            const equipped = equipData[slot];
                            const slotLabels: Record<string, string> = { weapon: '武器', armor: '防具', mount: '坐骑' };
                            return (
                              <div
                                key={slot}
                                className={`tk-equip-slot ${equipped ? 'tk-equip-slot--equipped' : ''}`}
                              >
                                {equipped ? (
                                  <>
                                    <EquipSlotIcon slotType={slot} size={18} />
                                    <span className="tk-equip-slot-name">{equipped}</span>
                                  </>
                                ) : (
                                  <>
                                    <EquipSlotIcon slotType={slot} size={18} />
                                    <span className="tk-equip-slot-label">{slotLabels[slot]}</span>
                                    <span className="tk-equip-slot-label" style={{ color: '#aaa', fontSize: 8 }}>未装备</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* 传记 Tab 内容 — 增强版 */
                  <div style={{ marginTop: 4 }}>
                    {/* 传记正文 — 古风卷轴样式 */}
                    <div className="tk-biography-text">
                      {getGeneralEnhanced(selectedHero.id).biography || '此人传记尚在编撰之中……'}
                    </div>
                    {/* 历史事件时间线 */}
                    {getGeneralEnhanced(selectedHero.id).historyEvents && getGeneralEnhanced(selectedHero.id).historyEvents!.length > 0 && (
                      <div className="tk-biography-events">
                        <div className="tk-biography-events-title">◆ 生平大事</div>
                        {getGeneralEnhanced(selectedHero.id).historyEvents!.map((evt, i) => (
                          <div key={i} className="tk-biography-event-item">
                            <span className="tk-biography-event-dot" />
                            <span className="tk-biography-event-text">{evt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 关联武将 */}
                    {getGeneralEnhanced(selectedHero.id).relatedGenerals && getGeneralEnhanced(selectedHero.id).relatedGenerals!.length > 0 && (
                      <div className="tk-biography-relations">
                        <div className="tk-biography-relations-title">◆ 人物关系</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {getGeneralEnhanced(selectedHero.id).relatedGenerals!.map((rel, i) => (
                            <span key={i} className="tk-biography-relation-tag">
                              {rel.name} <span style={{ color: '#b87333', fontSize: 8 }}>「{rel.relation}」</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <h3 className="tk-general-cards-title">◆ ⚔️ 武将</h3>
              {/* ── 阵营筛选按钮 ── */}
              <div className="tk-general-filter-row">
                {(['all', 'shu', 'wei', 'wu', 'other'] as const).map(f => {
                  const factionLabels: Record<string, string> = { all: '全部', wei: '魏', shu: '蜀', wu: '吴', other: '群' };
                  const factionColors: Record<string, string> = { all: '#c9a96e', wei: '#1E6FBE', shu: '#C41E3A', wu: '#2E8B57', other: '#8B7355' };
                  const isActive = generalFactionFilter === f;
                  return (
                    <button
                      key={f}
                      className={`tk-general-filter-btn ${isActive ? 'tk-general-filter-btn--active' : ''}`}
                      style={{
                        borderColor: isActive ? factionColors[f] : 'rgba(139,115,85,0.3)',
                        color: isActive ? factionColors[f] : '#8b7355',
                        background: isActive ? `${factionColors[f]}18` : 'transparent',
                      }}
                      onClick={() => setGeneralFactionFilter(f)}
                    >
                      {factionLabels[f]}
                    </button>
                  );
                })}
              </div>
              {/* ── 品质筛选 + 排序 ── */}
              <div className="tk-general-filter-row">
                {(['all', 'legendary', 'epic', 'rare', 'uncommon'] as const).map(r => {
                  const rarityLabels: Record<string, string> = { all: '全部品质', legendary: '传说', epic: '史诗', rare: '稀有', uncommon: '精良' };
                  const rarityColors: Record<string, string> = { all: '#c9a96e', legendary: '#ffa726', epic: '#ab47bc', rare: '#42a5f5', uncommon: '#5cbf60' };
                  const isActive = generalRarityFilter === r;
                  return (
                    <button
                      key={r}
                      className={`tk-general-filter-btn tk-general-filter-btn--sm ${isActive ? 'tk-general-filter-btn--active' : ''}`}
                      style={{
                        borderColor: isActive ? rarityColors[r] : 'rgba(139,115,85,0.2)',
                        color: isActive ? rarityColors[r] : '#8b7355',
                        background: isActive ? `${rarityColors[r]}15` : 'transparent',
                      }}
                      onClick={() => setGeneralRarityFilter(r)}
                    >
                      {rarityLabels[r]}
                    </button>
                  );
                })}
                <select
                  className="tk-general-sort-select"
                  value={generalSortKey}
                  onChange={e => setGeneralSortKey(e.target.value as 'level' | 'attack' | 'defense')}
                >
                  <option value="level">按等级</option>
                  <option value="attack">按攻击</option>
                  <option value="defense">按防御</option>
                </select>
              </div>
              <div className="tk-general-cards">
                {heroes
                  .filter(h => generalFactionFilter === 'all' || h.faction === generalFactionFilter)
                  .filter(h => generalRarityFilter === 'all' || h.rarity === generalRarityFilter)
                  .sort((a, b) => {
                    if (generalSortKey === 'attack') return b.stats.attack - a.stats.attack;
                    if (generalSortKey === 'defense') return b.stats.defense - a.stats.defense;
                    return b.level - a.level;
                  })
                  .map((h, idx) => (
                  <GeneralCard
                    key={h.id}
                    general={h}
                    index={idx}
                    isSelected={(selectedHero as typeof heroes[number] | null)?.id === h.id}
                    onSelect={() => setSelectedHero(h)}
                    onDoubleClick={() => setDetailModalHero(h)}
                    onRecruit={h.canRecruit && !h.unlocked ? () => {
                      const engine = engineRef.current;
                      if (!engine) return;

                      // 尝试通过引擎的 UnitSystem 招募武将
                      const units = (engine as any).units;
                      if (!units) {
                        console.warn('[ThreeKingdomsPixiGame] Unit system not available');
                        addToast('招募系统未就绪', 'error');
                        return;
                      }

                      // 检查资源是否足够
                      const res = engine.getResources();
                      const cost = h.recruitCost || {};
                      const canAfford = Object.entries(cost).every(([rid, amt]: [string, number]) => (res[rid] || 0) >= amt);

                      if (!canAfford) {
                        addToast('招募失败：资源不足', 'error');
                        return;
                      }

                      // 扣除资源并招募
                      const payMethod = (engine as any).pay;
                      if (payMethod) {
                        payMethod.call(engine, cost);
                      }
                      const result = units.unlock(h.id);
                      if (result.success) {
                        addToast(`招募成功！${h.name} 加入麾下`, 'success');
                        // 招募火花粒子效果
                        particleSystemRef.current?.emit(350, 200, 'spark', 15);
                        // 触发状态更新
                        (engine as any).emit?.('stateChange');
                      } else {
                        addToast('招募失败：条件不满足', 'error');
                      }
                    } : undefined}
                  />
                ))}
              </div>
              {/* 选中武将提示 */}
              {!selectedHero && (
                <div className="tk-hero-select-hint">
                  点击武将卡片查看详细信息
                </div>
              )}
            </>
          )}
        </aside>
        )}

        {/* ─── 移动端武将详情面板（全宽浮层 — 卷轴风格） ─── */}
        {isMobile && selectedHero && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '100%', background: 'rgba(30,20,10,0.97)',
            borderLeft: '2px solid #8B7355',
            overflow: 'auto', zIndex: 40, padding: 16,
          }}>
            {/* 关闭按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button
                onClick={() => setSelectedHero(null)}
                style={{
                  background: 'transparent', color: '#c9a96e',
                  border: 'none', cursor: 'pointer', fontSize: 22,
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* 卷轴面板 */}
            <div className="tk-scroll-panel" style={{ marginTop: 8 }}>
              {/* 卷轴轴头端部装饰 */}
              <div className="tk-scroll-endcap-left tk-scroll-endcap-top" />
              <div className="tk-scroll-endcap-right tk-scroll-endcap-top" />
              <div className="tk-scroll-endcap-left tk-scroll-endcap-bottom" />
              <div className="tk-scroll-endcap-right tk-scroll-endcap-bottom" />

              {/* 头像 + 名称 + 势力标识 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <GeneralCanvasPortrait generalId={selectedHero.id} size={56} />
                <div>
                  <h3 className="tk-scroll-title" style={{ fontSize: 18, margin: 0 }}>
                    {selectedHero.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span className={`tk-faction-badge tk-faction-badge--${selectedHero.faction}`}>
                      {selectedHero.faction === 'wei' ? '魏' : selectedHero.faction === 'shu' ? '蜀' : '吴'}
                    </span>
                    <span className="tk-scroll-text-dim" style={{ fontSize: 11 }}>
                      {selectedHero.rarity} · Lv.{selectedHero.level}
                    </span>
                  </div>
                  {/* 势力归属说明 */}
                  {getGeneralEnhanced(selectedHero.id).factionDesc && (
                    <div className="tk-faction-desc" style={{ marginTop: 4 }}>
                      {getGeneralEnhanced(selectedHero.id).factionDesc}
                    </div>
                  )}
                </div>
              </div>

              {/* 历史事件标签 */}
              {getGeneralEnhanced(selectedHero.id).historyEvents && getGeneralEnhanced(selectedHero.id).historyEvents!.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {getGeneralEnhanced(selectedHero.id).historyEvents!.map((evt, i) => (
                    <span key={i} className="tk-history-tag">📜 {evt}</span>
                  ))}
                </div>
              )}

              {/* 关联武将提示 */}
              {getGeneralEnhanced(selectedHero.id).relatedGenerals && getGeneralEnhanced(selectedHero.id).relatedGenerals!.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {getGeneralEnhanced(selectedHero.id).relatedGenerals!.map((rel, i) => (
                    <span key={i} className="tk-related-general-tag">
                      {rel.name} <span style={{ color: '#b87333', fontSize: 8 }}>「{rel.relation}」</span>
                    </span>
                  ))}
                </div>
              )}

              {/* 背景故事 */}
              <div className="tk-bio-text" style={{ marginBottom: 10 }}>
                「{getGeneralEnhanced(selectedHero.id).bio}」
              </div>

              <hr className="tk-scroll-divider" />

              {/* 详情 Tab 切换 */}
              <div className="tk-detail-tabs">
                <button
                  className={`tk-detail-tab-btn ${heroDetailTab === 'info' ? 'tk-detail-tab-btn--active' : ''}`}
                  onClick={() => setHeroDetailTab('info')}
                >
                  ◆ 属性
                </button>
                <button
                  className={`tk-detail-tab-btn ${heroDetailTab === 'biography' ? 'tk-detail-tab-btn--active' : ''}`}
                  onClick={() => setHeroDetailTab('biography')}
                >
                  ◆ 传记
                </button>
              </div>

              {heroDetailTab === 'info' ? (
                <>
                  {/* 属性面板 */}
                  {selectedHero.unlocked && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      {[
                        { label: '攻击', value: selectedHero.stats.attack, color: '#c62828' },
                        { label: '防御', value: selectedHero.stats.defense, color: '#2e4a7a' },
                        { label: '智力', value: selectedHero.stats.intelligence, color: '#7b1fa2' },
                        { label: '统率', value: selectedHero.stats.command, color: '#e65100' },
                      ].map(stat => (
                        <div key={stat.label} style={{
                          background: 'rgba(139,115,85,0.1)', borderRadius: 4, padding: '6px 10px',
                          display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span className="tk-scroll-text-dim" style={{ fontSize: 11 }}>{stat.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 'bold', color: stat.color }}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <hr className="tk-scroll-divider" />

                  {/* 技能列表（增强） */}
                  {selectedHero.unlocked && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="tk-scroll-title" style={{ fontSize: 12, marginBottom: 6 }}>
                        ◆ 技能
                      </div>
                      {getGeneralEnhanced(selectedHero.id).skills.map((skill, i) => (
                        <div key={i} className="tk-skill-detail">
                          <div className="tk-skill-detail-name">
                            <SkillIcon skillType={skill.type} size={18} />
                            {skill.name}
                            {skill.damageType && (
                              <span className={`tk-skill-type-badge tk-skill-type-badge--${skill.damageType}`}>
                                {skill.damageType === 'physical' ? '物理' : skill.damageType === 'magic' ? '法术' : '辅助'}
                              </span>
                            )}
                            {skill.cooldown && (
                              <span className="tk-skill-cooldown">⏱ {skill.cooldown}s</span>
                            )}
                          </div>
                          <div className="tk-skill-detail-desc">
                            {skill.effect || skill.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <hr className="tk-scroll-divider" />

                  {/* 装备槽位 */}
                  {selectedHero.unlocked && (
                    <div>
                      <div className="tk-scroll-title" style={{ fontSize: 12, marginBottom: 8 }}>
                        ◆ 装备
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['weapon', 'armor', 'mount'] as const).map(slot => {
                          const equipData = getGeneralEnhanced(selectedHero.id).equipment;
                          const equipped = equipData[slot];
                          const slotLabels: Record<string, string> = { weapon: '武器', armor: '防具', mount: '坐骑' };
                          return (
                            <div
                              key={slot}
                              className={`tk-equip-slot ${equipped ? 'tk-equip-slot--equipped' : ''}`}
                              style={{ minWidth: 70, padding: '8px 6px' }}
                            >
                              {equipped ? (
                                <>
                                  <EquipSlotIcon slotType={slot} size={20} />
                                  <span className="tk-equip-slot-name" style={{ fontSize: 10 }}>{equipped}</span>
                                </>
                              ) : (
                                <>
                                  <EquipSlotIcon slotType={slot} size={20} />
                                  <span className="tk-equip-slot-label">{slotLabels[slot]}</span>
                                  <span className="tk-equip-slot-label" style={{ color: '#aaa', fontSize: 8 }}>未装备</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                  </div>
                </div>
              )}
            </>
              ) : (
                /* 传记 Tab 内容 — 增强版 */
                <div style={{ marginTop: 4 }}>
                  <div className="tk-biography-text">
                    {getGeneralEnhanced(selectedHero.id).biography || '此人传记尚在编撰之中……'}
                  </div>
                  {getGeneralEnhanced(selectedHero.id).historyEvents && getGeneralEnhanced(selectedHero.id).historyEvents!.length > 0 && (
                    <div className="tk-biography-events">
                      <div className="tk-biography-events-title">◆ 生平大事</div>
                      {getGeneralEnhanced(selectedHero.id).historyEvents!.map((evt, i) => (
                        <div key={i} className="tk-biography-event-item">
                          <span className="tk-biography-event-dot" />
                          <span className="tk-biography-event-text">{evt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ 底部：操作按钮栏 ═══════════ */}
      <footer className="tk-tab-bar-ancient" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: isMobile ? 4 : 8,
        padding: isMobile ? '4px 8px' : '6px 16px',
        zIndex: 10, flexShrink: 0,
        position: isMobile ? 'sticky' : 'static',
        bottom: 0,
      }}>
        {SCENE_TABS.map((tab, idx) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab)}
              className={`tk-tab-btn-ancient ${isActive ? 'active' : ''}`}
              style={{
                padding: isMobile ? '4px 10px' : '5px 16px',
                fontSize: isMobile ? 10 : 12,
                borderRadius: 4,
                border: isActive ? '1px solid #c9a96e' : '1px solid transparent',
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(180deg, rgba(201,169,110,0.2) 0%, rgba(139,115,85,0.1) 100%)'
                  : 'rgba(139,115,85,0.06)',
                color: isActive ? COLOR_THEME.accentGold : COLOR_THEME.textSecondary,
                fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.2s',
                position: 'relative',
                boxShadow: isActive ? '0 0 8px rgba(201,169,110,0.15)' : 'none',
                letterSpacing: 1,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}

        {/* 快捷键提示（仅桌面端显示） */}
        {!isMobile && (
        <span style={{
          marginLeft: 16, fontSize: 9,
          color: COLOR_THEME.textDim,
        }}>
          [Space]点击 [Enter]购买 [T]科技 [U]武将 [S]关卡
        </span>
        )}
      </footer>

      {/* ═══════════ Toast 提示浮层 ═══════════ */}
      <div style={{
        position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        zIndex: 100, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '8px 20px', borderRadius: 6,
            fontSize: 13, fontWeight: 'bold',
            background: t.type === 'success' ? 'rgba(76,175,80,0.9)' : 'rgba(244,67,54,0.9)',
            color: '#fff', whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {t.type === 'success' ? '✅ ' : '❌ '}{t.text}
          </div>
        ))}
      </div>

      {/* ═══════════ 新手引导侧边面板 ═══════════ */}
      {showGuide && (() => {
        const step = GUIDE_STEPS[guideStep];
        const isLast = guideStep >= GUIDE_STEPS.length - 1;
        const starterName = engineRef.current?.getStarterGeneralName();
        return (
          <div className="tk-guide-overlay" onClick={() => setShowGuide(false)}>
            <div className="tk-guide-panel" onClick={e => e.stopPropagation()}>
              <button className="tk-guide-panel-close" onClick={() => setShowGuide(false)}>✕</button>
              <h2>◆ {step.title}</h2>
              <p>{step.text}</p>
              {guideStep === 0 && starterName && (
                <p className="tk-guide-starter">🎉 恭喜获得武将 {starterName}！</p>
              )}
              <div className="tk-guide-actions">
                <button
                  className="tk-guide-skip-btn"
                  onClick={() => setShowGuide(false)}
                >
                  跳过
                </button>
                <button
                  className="tk-guide-next-btn"
                  onClick={() => {
                    if (isLast) {
                      setShowGuide(false);
                    } else {
                      setGuideStep(guideStep + 1);
                    }
                  }}
                >
                  {isLast ? '开始游戏' : '下一步'}
                </button>
              </div>
              {/* 步骤指示器 */}
              <div className="tk-guide-dots">
                {GUIDE_STEPS.map((_, i) => (
                  <div key={i} className={`tk-guide-dot ${i === guideStep ? 'tk-guide-dot--active' : ''}`} />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ 存档管理面板 ═══════════ */}
      {showSavePanel && (
        <div style={{position:'absolute',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}>
          <div style={{background:'rgba(42,31,20,0.85)',border:'2px solid #8B7355',borderRadius:12,padding:20,minWidth:340,maxHeight:'75vh',overflow:'auto',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{color:'#c9a96e',margin:0,fontFamily:"'KaiTi','STKaiti','Noto Serif SC', serif",textShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>◆ 📜 存档管理</h3>
              <button onClick={() => setShowSavePanel(false)} style={{background:'transparent',color:'#c9a96e',border:'none',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <button onClick={() => {
              const engine = engineRef.current;
              if (engine) {
                try {
                  const data = engine.serialize();
                  const saves = JSON.parse(localStorage.getItem('tk_saves') || '[]');
                  saves.push({ id: Date.now().toString(), name: `存档 ${saves.length + 1}`, time: Date.now() });
                  localStorage.setItem('tk_saves', JSON.stringify(saves));
                  localStorage.setItem('tk_last_save_data', JSON.stringify(data));
                  addToast('存档成功！', 'success');
                } catch { addToast('存档失败', 'error'); }
              }
            }} style={{background:'#4a3520',color:'#c9a96e',border:'1px solid #8B7355',padding:'8px 16px',cursor:'pointer',width:'100%',marginTop:16,borderRadius:4,fontSize:13}}>💾 保存当前进度</button>
            <div style={{marginTop:12,fontSize:12,color:'#8a7a6a'}}>
              自动存档每60秒执行一次，关闭游戏后下次打开自动恢复。
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ 成就面板 ═══════════ */}
      {showAchievements && (() => {
        const ACHS = [
          { name:'初出茅庐', desc:'占领第一块领土', icon:'🏰', ok: ((renderState as any)?.conqueredTerritories?.length ?? (renderState as any)?.territories?.filter((t:any)=>t.conquered).length ?? 0) >= 1 },
          { name:'小有成就', desc:'占领5块领土', icon:'⚔️', ok: ((renderState as any)?.conqueredTerritories?.length ?? (renderState as any)?.territories?.filter((t:any)=>t.conquered).length ?? 0) >= 5 },
          { name:'一统天下', desc:'占领所有领土', icon:'👑', ok: ((renderState as any)?.conqueredTerritories?.length ?? (renderState as any)?.territories?.filter((t:any)=>t.conquered).length ?? 0) >= 15 },
          { name:'招贤纳士', desc:'招募第一位武将', icon:'🦸', ok: (renderState?.heroes?.length ?? 0) >= 1 },
          { name:'群英荟萃', desc:'招募所有武将', icon:'🌟', ok: (renderState?.heroes?.length ?? 0) >= 12 },
          { name:'科技创新', desc:'研究第一项科技', icon:'🔬', ok: ((renderState?.techTree as any)?.researchedCount ?? 0) >= 1 },
          { name:'富甲一方', desc:'铜钱达到1000', icon:'💰', ok: ((renderState?.resources?.resources?.find((r:any)=>r.id==='gold')?.amount) ?? 0) >= 1000 },
          { name:'粮食满仓', desc:'粮草达到1000', icon:'🌾', ok: ((renderState?.resources?.resources?.find((r:any)=>r.id==='grain')?.amount) ?? 0) >= 1000 },
          { name:'兵强马壮', desc:'兵力达到500', icon:'🗡️', ok: ((renderState?.resources?.resources?.find((r:any)=>r.id==='troops')?.amount) ?? 0) >= 500 },
          { name:'声望初成', desc:'完成一次转生', icon:'✨', ok: (renderState?.prestige?.count ?? 0) >= 1 },
          { name:'征战四方', desc:'完成第3个关卡', icon:'🏆', ok: ((renderState?.currentStage as any)?.order ?? 0) >= 3 },
          { name:'天下霸业', desc:'完成最终关卡', icon:'🎯', ok: ((renderState?.currentStage as any)?.order ?? 0) >= 6 },
        ];
        const unlocked = ACHS.filter(a => a.ok).length;
        return (
          <div style={{position:'absolute',inset:0,zIndex:60,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}}>
            <div style={{background:'rgba(42,31,20,0.85)',border:'2px solid #8B7355',borderRadius:12,padding:20,minWidth:400,maxHeight:'75vh',overflow:'auto',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{color:'#c9a96e',margin:0,fontFamily:"'KaiTi','STKaiti','Noto Serif SC', serif",textShadow:'0 1px 3px rgba(0,0,0,0.5)'}}>◆ 🏆 成就 ({unlocked}/{ACHS.length})</h3>
                <button onClick={() => setShowAchievements(false)} style={{background:'transparent',color:'#c9a96e',border:'none',cursor:'pointer',fontSize:18}}>✕</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginTop:16}}>
                {ACHS.map((a,i) => (
                  <div key={i} style={{background:a.ok?'#3a4a2a':'#2a2a2a',border:`1px solid ${a.ok?'#6a8a4a':'#4a4a4a'}`,padding:10,borderRadius:4,opacity:a.ok?1:0.6}}>
                    <div style={{fontSize:20}}>{a.ok?a.icon:'🔒'}</div>
                    <div style={{color:a.ok?'#c9a96e':'#666',fontWeight:'bold',fontSize:13}}>{a.name}</div>
                    <div style={{color:'#8a7a6a',fontSize:11}}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ Tooltip ═══════════ */}
      {tooltip && (
        <div style={{position:'fixed',left:tooltip.x+12,top:tooltip.y+12,background:'rgba(42,31,20,0.95)',border:'1px solid #8B7355',color:'#c9a96e',padding:'6px 10px',borderRadius:4,fontSize:12,zIndex:9999,pointerEvents:'none',maxWidth:220,boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
          {tooltip.text}
        </div>
      )}

      {/* ═══════════ NPC 信息面板（选中 NPC 时显示） ═══════════ */}
      {selectedNpcId && !showNPCDialogue && (() => {
        const engine = engineRef.current;
        const npcInfo = engine?.getNPCInfo(selectedNpcId);
        const npcType = npcInfo?.profession ?? '';
        const infoData = getNPCInfoById(selectedNpcId, npcType);
        if (!infoData) return null;

        const professionEmoji = infoData.profession === 'farmer' ? '🌾' :
          infoData.profession === 'soldier' ? '⚔️' :
          infoData.profession === 'merchant' ? '💰' :
          infoData.profession === 'scholar' ? '📚' :
          infoData.profession === 'scout' ? '🔍' :
          infoData.profession === 'general' ? '🗡️' :
          infoData.profession === 'craftsman' ? '🔨' : '👤';
        const professionLabel = infoData.profession === 'farmer' ? '农民' :
          infoData.profession === 'soldier' ? '士兵' :
          infoData.profession === 'merchant' ? '商人' :
          infoData.profession === 'scholar' ? '学者' :
          infoData.profession === 'scout' ? '斥候' :
          infoData.profession === 'general' ? '武将' :
          infoData.profession === 'craftsman' ? '工匠' : '村民';

        return (
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.75)', borderRadius: 12, padding: 16,
              width: 420, maxHeight: '75vh', overflowY: 'auto',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
              color: COLOR_THEME.textPrimary, zIndex: 60,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 40px rgba(139,115,85,0.15)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            {/* 关闭按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: COLOR_THEME.accentGold, fontFamily: "'KaiTi', 'STKaiti', 'Noto Serif SC', serif", textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>◆ 📋 NPC 信息</h2>
              <button
                onClick={() => setSelectedNpcId(null)}
                style={{
                  background: 'transparent', border: `1px solid ${COLOR_THEME.selectedBorder}`,
                  color: COLOR_THEME.textDim, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                }}
              >✕ 关闭</button>
            </div>

            {/* NPC 头部信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4a3520, #6a5030)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, border: '2px solid #8B7355',
                boxShadow: '0 0 12px rgba(201,169,110,0.3)',
              }}>
                {professionEmoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#c9a96e', fontWeight: 'bold', fontSize: 18 }}>
                  {infoData.name}
                </div>
                <div style={{ color: '#8a7a6a', fontSize: 13, marginTop: 2 }}>
                  {infoData.title} · {professionLabel}
                </div>
              </div>
            </div>

            {/* 描述 */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 14,
            }}>
              <div style={{ color: '#e0d0c0', fontSize: 13, lineHeight: 1.6 }}>
                {infoData.description}
              </div>
            </div>

            {/* 武将属性 */}
            {infoData.attributes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                  ⚔️ 武将属性
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: '武力', value: infoData.attributes.force, color: '#ef4444', icon: '💪' },
                    { label: '智力', value: infoData.attributes.intelligence, color: '#3b82f6', icon: '🧠' },
                    { label: '统帅', value: infoData.attributes.command, color: '#f59e0b', icon: '🚩' },
                    { label: '防御', value: infoData.attributes.defense, color: '#22c55e', icon: '🛡️' },
                  ].map(attr => (
                    <div key={attr.label} style={{
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 6, padding: '8px 12px',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#a0a0a0' }}>{attr.icon} {attr.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 'bold', color: attr.color }}>{attr.value}</span>
                      </div>
                      <div style={{
                        height: 4, borderRadius: 2,
                        background: 'rgba(255,255,255,0.1)',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${attr.value}%`,
                          background: attr.color,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 商人商品 */}
            {infoData.shopItems && infoData.shopItems.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                  🛒 可购买物品
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {infoData.shopItems.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 6, padding: '8px 12px',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div>
                        <span style={{ fontSize: 13, color: '#e0d0c0', fontWeight: 'bold' }}>{item.name}</span>
                        <div style={{ fontSize: 11, color: '#8a7a6a', marginTop: 2 }}>{item.description}</div>
                      </div>
                      <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        💰 {item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 士兵职责 */}
            {infoData.duty && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: '#c9a96e', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                  📋 职责
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6, padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e0d0c0', fontSize: 13,
                }}>
                  {infoData.duty}
                </div>
              </div>
            )}

            {/* 位置信息 */}
            {npcInfo && (
              <div style={{
                fontSize: 11, color: '#6a6a6a', borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 10, marginTop: 4,
              }}>
                📍 位置：({npcInfo.x}, {npcInfo.y}) · 状态：{npcInfo.state === 'idle' ? '待命' :
                  npcInfo.state === 'walking' ? '行走中' :
                  npcInfo.state === 'working' ? '工作中' :
                  npcInfo.state === 'patrolling' ? '巡逻中' :
                  npcInfo.state === 'resting' ? '休息中' : npcInfo.state}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => {
                  // 重新打开对话
                  handleNPCClick(selectedNpcId);
                }}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 'bold',
                  borderRadius: 6, border: '1px solid #8B7355', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #4a3520, #6a5030)',
                  color: '#c9a96e',
                }}
              >
                💬 对话
              </button>
              <button
                onClick={() => setSelectedNpcId(null)}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 'bold',
                  borderRadius: 6, border: `1px solid ${COLOR_THEME.selectedBorder}`,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: COLOR_THEME.textDim,
                }}
              >
                关闭
              </button>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ NPC 对话面板 ═══════════ */}
      {showNPCDialogue && npcDialogue && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 70,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            paddingBottom: '15vh',
          }}
          onClick={() => { setShowNPCDialogue(false); setNPCDialogue(null); }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #2a1f14 0%, #1a1410 100%)',
              border: '2px solid #8B7355',
              borderRadius: 12,
              padding: '20px 28px',
              minWidth: 420,
              maxWidth: 560,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 40px rgba(139,115,85,0.15)',
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* NPC 头部信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {(() => {
                // 武将类 NPC：尝试通过名字匹配武将立绘
                const generalNameToId: Record<string, string> = {
                  '刘备': 'liubei', '关羽': 'guanyu', '张飞': 'zhangfei',
                  '诸葛亮': 'zhugeliang', '赵云': 'zhaoyun', '黄忠': 'huangzhong',
                  '马超': 'machao', '曹操': 'caocao', '许褚': 'xuchu',
                  '孙权': 'sunquan', '周瑜': 'zhouyu', '吕布': 'lvbu',
                };
                const matchedGeneralId = generalNameToId[npcDialogue.npcName];
                if (npcDialogue.npcType === 'general' && matchedGeneralId) {
                  return (
                    <div style={{
                      borderRadius: 6, overflow: 'hidden',
                      border: '2px solid #8B7355',
                      boxShadow: '0 0 12px rgba(139,115,85,0.3)',
                    }}>
                      <GeneralCanvasPortrait generalId={matchedGeneralId} size={48} />
                    </div>
                  );
                }
                // 非 武将 NPC：显示职业 emoji 头像
                return (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4a3520, #6a5030)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, border: '2px solid #8B7355',
                  }}>
                    {npcDialogue.npcType === 'farmer' ? '🌾' :
                     npcDialogue.npcType === 'soldier' ? '⚔️' :
                     npcDialogue.npcType === 'merchant' ? '💰' :
                     npcDialogue.npcType === 'scholar' ? '📚' :
                     npcDialogue.npcType === 'scout' ? '🔍' :
                     npcDialogue.npcType === 'general' ? '🗡️' :
                     npcDialogue.npcType === 'craftsman' ? '🔨' : '👤'}
                  </div>
                );
              })()}
              <div>
                <div style={{ color: '#c9a96e', fontWeight: 'bold', fontSize: 16 }}>
                  {npcDialogue.npcName}
                </div>
                <div style={{ color: '#8a7a6a', fontSize: 12 }}>
                  {npcDialogue.npcType === 'farmer' ? '农民' :
                   npcDialogue.npcType === 'soldier' ? '士兵' :
                   npcDialogue.npcType === 'merchant' ? '商人' :
                   npcDialogue.npcType === 'scholar' ? '学者' :
                   npcDialogue.npcType === 'scout' ? '斥候' :
                   npcDialogue.npcType === 'general' ? '将军' :
                   npcDialogue.npcType === 'craftsman' ? '工匠' : '村民'}
                </div>
              </div>
              <button
                onClick={() => { setShowNPCDialogue(false); setNPCDialogue(null); }}
                style={{
                  marginLeft: 'auto', background: 'transparent', border: 'none',
                  color: '#8a7a6a', cursor: 'pointer', fontSize: 18, padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* 对话内容 */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: '14px 18px',
              marginBottom: 16,
              minHeight: 60,
            }}>
              <div style={{ color: '#e0d0c0', fontSize: 14, lineHeight: 1.6 }}>
                「{npcDialogue.lines[npcDialogue.currentLine]}」
              </div>
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {npcDialogue.currentLine < npcDialogue.lines.length - 1 ? (
                <button
                  onClick={handleNPCDialogueNext}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 'bold',
                    borderRadius: 6, border: '1px solid #8B7355', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #4a3520, #6a5030)',
                    color: '#c9a96e',
                  }}
                >
                  继续 ▶
                </button>
              ) : (
                <button
                  onClick={() => { setShowNPCDialogue(false); setNPCDialogue(null); }}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 'bold',
                    borderRadius: 6, border: '1px solid #8B7355', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #4a3520, #6a5030)',
                    color: '#c9a96e',
                  }}
                >
                  告别
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 武将详情弹窗 ── */}
      {detailModalHero && (
        <GeneralDetailModal
          general={detailModalHero}
          onClose={() => setDetailModalHero(null)}
        />
      )}
    </div>
  );
}
