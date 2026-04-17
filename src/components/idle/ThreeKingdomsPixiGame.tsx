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
} from '@/games/three-kingdoms/constants';
import PixiGameCanvas from '@/renderer/components/PixiGameCanvas';
import type { GameRenderState, SceneType } from '@/renderer/types';

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
  available: { label: '⚔️', color: '#4ade80' },
  in_progress: { label: '⚔️', color: '#facc15' },
  victory: { label: '✅', color: '#60a5fa' },
  defeated: { label: '💀', color: '#f87171' },
};

/** 难度对应的颜色和标签 */
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: '简单', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
  normal: { label: '普通', color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
  hard: { label: '困难', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  legendary: { label: '传奇', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

/** 兵种图标映射 */
const TROOP_ICONS: Record<string, string> = {
  infantry: '🗡️',
  cavalry: '🐎',
  archers: '🏹',
};

/** 城防星级显示（满星10） */
function fortLevelStars(level: number): string {
  return '★'.repeat(level) + '☆'.repeat(Math.max(0, 10 - level));
}

/**
 * 关卡详情弹窗 —— 展示关卡完整信息（守将、兵力、城防、奖励）
 * 点击关卡列表项时弹出此弹窗。
 */
function LevelDetailModal({
  detail,
  statusInfo,
  canAttack,
  onBattleStart,
  onClose,
  COLOR_THEME: CT,
}: {
  detail: NonNullable<ReturnType<CampaignSystem['getLevelDetail']>>;
  statusInfo: { canAttack: boolean; reason?: string };
  canAttack: boolean;
  onBattleStart: () => void;
  onClose: () => void;
  COLOR_THEME: typeof COLOR_THEME;
}) {
  const diff = DIFFICULTY_CONFIG[detail.battleConfig.difficulty] ?? DIFFICULTY_CONFIG.normal;
  const totalTroops = detail.defender.troops.infantry + detail.defender.troops.cavalry + detail.defender.troops.archers;

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.95)', borderRadius: 12, padding: 20,
      width: 440, maxHeight: '85vh', overflowY: 'auto',
      border: `1px solid ${CT.selectedBorder}`,
      color: CT.textPrimary, zIndex: 110,
    }}>
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: CT.accentGold }}>{detail.name}</h2>
        <span style={{
          fontSize: 12, padding: '2px 10px', borderRadius: 4,
          color: diff.color, background: diff.bg, fontWeight: 'bold',
        }}>{diff.label}</span>
      </div>

      {/* 描述 */}
      <p style={{ margin: '0 0 12px', fontSize: 12, color: CT.textDim, lineHeight: 1.6,
        padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6,
      }}>
        {detail.description}
      </p>

      {/* 守将信息 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: CT.accentGold, marginBottom: 4 }}>🏴 守军</div>
        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
          <div>主将：<span style={{ color: '#f87171', fontWeight: 'bold' }}>{detail.defender.lord}</span></div>
          {detail.defender.officers.length > 0 && (
            <div>副将：{detail.defender.officers.map((o, i) => (
              <span key={i} style={{ color: CT.textDim }}>{o}{i < detail.defender.officers.length - 1 ? '、' : ''}</span>
            ))}</div>
          )}
        </div>
      </div>

      {/* 兵力明细 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: CT.accentGold, marginBottom: 4 }}>
          ⚔️ 兵力 <span style={{ color: CT.textDim, fontWeight: 'normal' }}>(总计 {totalTroops})</span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          <span>{TROOP_ICONS.infantry} 步兵 {detail.defender.troops.infantry}</span>
          <span>{TROOP_ICONS.cavalry} 骑兵 {detail.defender.troops.cavalry}</span>
          <span>{TROOP_ICONS.archers} 弓兵 {detail.defender.troops.archers}</span>
        </div>
      </div>

      {/* 城防 */}
      <div style={{ marginBottom: 10, fontSize: 12 }}>
        <span style={{ color: CT.accentGold, fontWeight: 'bold' }}>🏰 城防：</span>
        <span style={{ color: '#facc15' }}>{fortLevelStars(detail.defender.fortLevel)}</span>
        <span style={{ color: CT.textDim, marginLeft: 6 }}>Lv.{detail.defender.fortLevel}</span>
      </div>

      {/* 奖励 */}
      {detail.rewards && (
        <div style={{
          marginBottom: 12, padding: '10px 12px',
          background: 'rgba(74,222,128,0.06)', borderRadius: 6,
          border: '1px solid rgba(74,222,128,0.15)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#4ade80', marginBottom: 6 }}>🎁 攻克奖励</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: CT.textPrimary }}>
            {detail.rewards.gold > 0 && <span>💰 金 {detail.rewards.gold}</span>}
            {detail.rewards.food > 0 && <span>🌾 粮 {detail.rewards.food}</span>}
            {detail.rewards.materials > 0 && <span>📦 材料 {detail.rewards.materials}</span>}
            {detail.rewards.recruitHero && <span style={{ color: '#facc15' }}>🧑‍✈️ 可招募英雄</span>}
            {detail.rewards.unlockBuilding && <span style={{ color: '#60a5fa' }}>🏗️ 解锁建筑</span>}
          </div>
        </div>
      )}

      {/* 无法攻打原因 */}
      {!canAttack && statusInfo.reason && (
        <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10, textAlign: 'center' }}>
          {statusInfo.reason}
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={{
          flex: 1, padding: '10px 0', fontSize: 14, cursor: 'pointer',
          borderRadius: 6, border: `1px solid ${CT.selectedBorder}`,
          background: 'transparent', color: CT.textDim,
        }}>返回</button>
        {canAttack && (
          <button onClick={onBattleStart} style={{
            flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 'bold',
            cursor: 'pointer', borderRadius: 6, border: 'none',
            background: `linear-gradient(135deg, ${CT.accentGold}, #b91c1c)`, color: '#fff',
          }}>⚔️ 进攻</button>
        )}
      </div>
    </div>
  );
}

/** 征战关卡面板 */
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

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.92)', borderRadius: 12, padding: 20,
      width: 520, maxHeight: '80vh', overflowY: 'auto',
      border: `1px solid ${CT.selectedBorder}`,
      color: CT.textPrimary,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: CT.accentGold }}>🏆 征战天下</h2>
        <button onClick={onClose} style={{
          background: 'transparent', border: `1px solid ${CT.selectedBorder}`,
          color: CT.textDim, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
        }}>✕ 关闭</button>
      </div>

      {/* 关卡进度 */}
      <div style={{ fontSize: 12, color: CT.textDim, marginBottom: 12 }}>
        进度：{campaignData?.completedStages?.length ?? 0} / {stages.length} 关卡
        {campaignData?.totalStars != null && ` | ⭐ ${campaignData.totalStars} / ${campaignData.maxStars}`}
      </div>

      {/* 关卡列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stages.map((stage, idx) => {
          const statusInfo = STAGE_STATUS_MAP[stage.status] ?? STAGE_STATUS_MAP.locked;
          const isLocked = stage.status === 'locked';
          const isVictory = stage.status === 'victory';
          const def = stageDefMap.get(stage.id);
          const eraColor = def ? (ERA_COLORS[def.era] ?? '#888') : '#888';
          const diffDisplay = def ? (DIFFICULTY_DISPLAY[def.difficulty] ?? DIFFICULTY_DISPLAY[1]) : null;
          const powerStr = def ? Math.floor(def.requiredPower).toLocaleString() : '';

          return (
            <div key={stage.id}
              onClick={() => !isLocked && setDetailStageId(stage.id)}
              style={{
                padding: '10px 14px', borderRadius: 8,
                border: `1px solid ${isLocked ? 'rgba(255,255,255,0.05)' : isVictory ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.1)'}`,
                background: isLocked ? 'rgba(255,255,255,0.01)' : isVictory ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                opacity: isLocked ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                {/* 第一行：状态图标 + 名称 + 星级 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{statusInfo.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 'bold', color: isLocked ? CT.textDim : CT.textPrimary }}>
                    {stage.name}
                  </span>
                  {stage.stars > 0 && (
                    <span style={{ fontSize: 11, color: '#facc15' }}>{'⭐'.repeat(stage.stars)}</span>
                  )}
                </div>
                {/* 第二行：时代标签 + 难度 + 战力 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  {def && (
                    <span style={{
                      color: eraColor, background: `${eraColor}18`,
                      padding: '1px 6px', borderRadius: 3, fontWeight: 'bold',
                    }}>
                      {def.era}
                    </span>
                  )}
                  {diffDisplay && (
                    <span style={{ color: diffDisplay.color, fontSize: 10 }}>
                      {diffDisplay.stars}
                    </span>
                  )}
                  {powerStr && (
                    <span style={{ color: CT.textDim }}>
                      ⚔️{powerStr}
                    </span>
                  )}
                </div>
              </div>
              {!isLocked && stage.status !== 'victory' && (
                <span style={{ fontSize: 11, color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)',
                  padding: '1px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                }}>可攻</span>
              )}
              {isVictory && (
                <span style={{ fontSize: 11, color: '#60a5fa', whiteSpace: 'nowrap' }}>已攻克</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 关卡详情弹窗 */}
      {detailData && (
        <LevelDetailModal
          detail={detailData.detail}
          statusInfo={detailData.statusInfo}
          canAttack={detailData.canAttack}
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

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.95)', borderRadius: 12, padding: 24,
      width: 420, maxHeight: '85vh', overflowY: 'auto',
      border: `2px solid ${isVictory ? '#4ade80' : '#ef4444'}`,
      color: CT.textPrimary, zIndex: 120,
    }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>{isVictory ? '🎉' : '💀'}</div>
        <h2 style={{ margin: 0, fontSize: 20, color: isVictory ? '#4ade80' : '#ef4444' }}>
          {isVictory ? '大获全胜！' : '兵败如山倒'}
        </h2>
        {result.stars != null && result.stars > 0 && (
          <div style={{ fontSize: 18, marginTop: 4, color: '#facc15' }}>{'⭐'.repeat(result.stars)}</div>
        )}
      </div>

      {/* 战斗摘要 */}
      {result.summary && (
        <p style={{ textAlign: 'center', fontSize: 13, color: CT.textDim, margin: '0 0 14px' }}>
          {result.summary}
        </p>
      )}

      {/* 战斗日志 */}
      {Array.isArray(result.rounds) && result.rounds.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: CT.accentGold }}>
            📜 战斗经过
          </div>
          <div style={{
            maxHeight: 140, overflowY: 'auto', fontSize: 11,
            color: CT.textDim, lineHeight: 1.8,
            padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.3)',
          }}>
            {result.rounds.map((round, i) => (
              <div key={i}>第{i + 1}回合：{round.summary ?? '...'}</div>
            ))}
          </div>
        </div>
      )}

      {/* 双方损失 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
        marginBottom: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: CT.textDim, marginBottom: 2 }}>我方损失</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#f87171' }}>
            {result.totalAttackerLosses ?? 0}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: CT.textDim, marginBottom: 2 }}>敌方损失</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#4ade80' }}>
            {result.totalDefenderLosses ?? 0}
          </div>
        </div>
      </div>

      {/* 剩余兵力 */}
      {result.troopsRemaining != null && (
        <div style={{ textAlign: 'center', fontSize: 12, color: CT.textDim, marginBottom: 14 }}>
          剩余兵力：{result.troopsRemaining} ({((result.troopsRemainingPercent ?? 0) * 100).toFixed(0)}%)
        </div>
      )}

      {/* 获得奖励 */}
      {isVictory && result.rewards && (
        <div style={{
          padding: 10, borderRadius: 8, background: 'rgba(74,222,128,0.06)',
          border: '1px solid rgba(74,222,128,0.15)', marginBottom: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#4ade80', marginBottom: 6 }}>🎁 战利品</div>
          <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {result.rewards.territory && <span>🏰 {result.rewards.territory}</span>}
            {result.rewards.resources && Object.entries(result.rewards.resources).map(([key, val]) => (
              <span key={key}>{key}: {val}</span>
            ))}
            {result.rewards.unlockHero && (
              <span style={{ color: '#facc15' }}>🧑‍✈️ 解锁英雄</span>
            )}
          </div>
        </div>
      )}

      {/* 确认按钮 */}
      <button onClick={onClose} style={{
        display: 'block', margin: '0 auto',
        padding: '10px 32px', fontSize: 14,
        cursor: 'pointer', borderRadius: 8, border: 'none',
        background: isVictory ? '#4ade80' : '#ef4444',
        color: '#000', fontWeight: 'bold',
      }}>
        {isVictory ? '确认' : '返回'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export default function ThreeKingdomsPixiGame() {
  // ─── Refs ─────────────────────────────────────────────────

  const engineRef = useRef<ThreeKingdomsEngine | null>(null);
  const adapterRef = useRef<ThreeKingdomsRenderStateAdapter | null>(null);
  const toastIdRef = useRef(0);

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

  // 自动存档 + 成就 + Tooltip
  const [lastAutoSave, setLastAutoSave] = useState(0);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [tooltip, setTooltip] = useState<{text:string;x:number;y:number}|null>(null);

  // 征战关卡战斗报告
  const [showCampaignBattleReport, setShowCampaignBattleReport] = useState(false);
  const [campaignBattleResult, setCampaignBattleResult] = useState<any>(null);

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
      engine.pause();
      engine.destroy();
      engineRef.current = null;
      adapterRef.current = null;
      eventSystemRef.current = null;
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

    // 查找当前选中建筑
    const res = engine.getResources();
    const bs = (engine as any).bldg;
    if (!bs) return;
    const cost = bs.getCost(id);
    const canAfford = Object.entries(cost || {}).every(([rid, amt]) => (res[rid] || 0) >= (amt as number));

    if (canAfford) {
      (engine as any).buyBuilding();
      const bld = BUILDINGS.find(b => b.id === id);
      addToast(`建造成功！${bld?.name ?? id} Lv.1`, 'success');
    } else {
      addToast('资源不足！', 'error');
    }
  }, [addToast]);

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
      engine.handleKeyDown(' '); // 触发 stateChange
    } else {
      addToast('兵力不足，无法征服！', 'error');
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
      } else {
        addToast('无法开始战斗', 'error');
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
    }

    if (choice.penalty) {
      const penaltyStr = Object.entries(choice.penalty).map(([k, v]) => `${k}${v}`).join(' ');
      addToast(`事件惩罚：${penaltyStr}`, 'error');
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
      engine.handleKeyDown(' ');
    } else {
      addToast('占领失败', 'error');
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
      engine.handleKeyDown(' ');
    } else {
      addToast('升级失败（可能已达上限）', 'error');
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
        <h1 style={{ fontSize: 36, color: COLOR_THEME.accentGold, marginBottom: 8 }}>
          三国霸业
        </h1>
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
    <div style={{
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
      fontFamily: '"Noto Serif SC", sans-serif',
      overflow: 'hidden',
      position: 'relative',
      borderRadius: 8,
      boxSizing: 'border-box',
    }}>
      {/* ═══════════ 顶部：资源栏 + 当前阶段 ═══════════ */}
      <header style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '4px 8px' : '6px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderBottom: `1px solid ${COLOR_THEME.selectedBorder}`,
        zIndex: 10, flexShrink: 0,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        gap: isMobile ? 4 : 0,
      }}>
        {/* 游戏标题 + 阶段 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
          <span style={{
            fontSize: isMobile ? 14 : 18, fontWeight: 'bold',
            color: COLOR_THEME.accentGold,
            fontFamily: '"Noto Serif SC", serif',
          }}>
            三国霸业
          </span>
          {currentStage && !isMobile && (
            <span style={{
              fontSize: 12, color: currentStage.themeColor,
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 10px', borderRadius: 10,
            }}>
              {currentStage.name} — {currentStage.description}
            </span>
          )}
        </div>

        {/* 资源栏 */}
        <div style={{
          display: 'flex', gap: isMobile ? 8 : 16,
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          fontSize: isMobile ? 11 : 13,
        }}>
          {resources.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13, color: COLOR_THEME.textPrimary, cursor: 'default',
            }}
              onMouseEnter={e => setTooltip({text:`${r.icon} ${r.name}: ${fmt(r.amount)}${r.perSecond > 0 ? ` (+${fmt(r.perSecond)}/秒)` : ''}`,x:e.clientX,y:e.clientY})}
              onMouseLeave={() => setTooltip(null)}
            >
              <span>{r.icon}</span>
              <span style={{ fontWeight: 'bold' }}>{fmt(r.amount)}</span>
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
          <span style={{
            color: COLOR_THEME.accentGold,
            background: 'rgba(255,215,0,0.1)',
            padding: '1px 8px', borderRadius: 8,
            fontSize: 11,
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
          {/* 存档 + 成就按钮 */}
          <button onClick={() => setShowSavePanel(true)} title="存档管理" style={{background:'transparent',border:'none',cursor:'pointer',fontSize:14,color:COLOR_THEME.textSecondary}}>📜</button>
          <button onClick={() => setShowAchievements(true)} title="成就" style={{background:'transparent',border:'none',cursor:'pointer',fontSize:14,color:COLOR_THEME.textSecondary}}>🏆</button>
          {lastAutoSave > 0 && <span style={{fontSize:9,color:'#555'}}>已存档</span>}
        </div>
      </header>

      {/* ═══════════ 中间区域：左面板 + PixiJS Canvas + 右面板 ═══════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ─── 左侧面板：建筑/城市/资源点（仅地图场景显示，移动端隐藏） ─── */}
        {showBuildingPanel && !isMobile && (
        <aside style={{
          width: 240, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(45,27,10,0.85), rgba(26,14,5,0.9))',
          borderRight: '1px solid rgba(212,160,48,0.15)',
          overflowY: 'auto', padding: 8,
          zIndex: 5,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 子标签栏 */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
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
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: activeMapSubTab === tab.key
                    ? 'rgba(255,215,0,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  color: activeMapSubTab === tab.key
                    ? COLOR_THEME.accentGold
                    : COLOR_THEME.textSecondary,
                  fontWeight: activeMapSubTab === tab.key ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── 建筑列表 ── */}
          {activeMapSubTab === 'building' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {buildings.map(b => (
                <div
                  key={b.id}
                  onClick={() => handleBuildingClick(b.id)}
                  style={{
                    padding: '6px 8px', marginBottom: 4,
                    borderRadius: 4, cursor: 'pointer',
                    background: b.state === 'locked'
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${b.state === 'producing' ? 'rgba(76,175,80,0.3)' : 'transparent'}`,
                    opacity: b.state === 'locked' ? 0.5 : 1,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 'bold' }}>
                      {b.iconAsset} {b.name}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: b.level > 0 ? COLOR_THEME.accentGold : COLOR_THEME.textDim,
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
              ))}
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

          {/* 声望入口按钮（仅地图场景显示） */}
          {scene === 'map' && (
            <button
              onClick={() => setScene('prestige')}
              style={{
                position: 'absolute', top: 12, right: 12,
                padding: '6px 14px', fontSize: 12, fontWeight: 'bold',
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
                color: '#1a0a0a',
                boxShadow: '0 2px 8px rgba(255,215,0,0.3)',
                zIndex: 10,
              }}
            >
              👑 声望
            </button>
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
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.85)',
              borderRadius: 12, padding: 24,
              width: 340, textAlign: 'center',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
            }}>
              <h2 style={{
                fontSize: 22, color: COLOR_THEME.accentGold,
                marginBottom: 16, fontFamily: '"Noto Serif SC", serif',
              }}>
                👑 声望转生
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
          )}

          {/* ═══════════ 征战战斗报告弹窗 ═══════════ */}
          {showCampaignBattleReport && campaignBattleResult && (
            <CampaignBattleReport
              result={campaignBattleResult}
              onClose={() => { setShowCampaignBattleReport(false); setCampaignBattleResult(null); }}
              COLOR_THEME={COLOR_THEME}
            />
          )}

          {/* ═══════════ 科技研究浮层 ═══════════ */}
          {scene === 'tech-tree' && renderState?.techTree && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.85)',
              borderRadius: 12, padding: 20,
              width: 500, maxHeight: '80vh',
              overflowY: 'auto',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
            }}>
              <h2 style={{
                fontSize: 20, color: COLOR_THEME.accentGold,
                marginBottom: 16, fontFamily: '"Noto Serif SC", serif',
                textAlign: 'center',
              }}>
                📜 科技研究
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {renderState.techTree.nodes.map(node => {
                  const isCompleted = node.state === 'completed';
                  const isAvailable = node.state === 'available';
                  const isResearching = node.state === 'researching';
                  const isLocked = node.state === 'locked';

                  return (
                    <div
                      key={node.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: isCompleted
                          ? 'rgba(76,175,80,0.15)'
                          : isResearching
                            ? 'rgba(255,215,0,0.1)'
                            : isAvailable
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${
                          isCompleted ? 'rgba(76,175,80,0.3)'
                            : isResearching ? 'rgba(255,215,0,0.3)'
                              : isAvailable ? 'rgba(255,255,255,0.1)'
                                : 'transparent'
                        }`,
                        opacity: isLocked ? 0.4 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{
                            fontSize: 13, fontWeight: 'bold',
                            color: isCompleted ? COLOR_THEME.accentGreen
                              : isResearching ? COLOR_THEME.accentGold
                                : COLOR_THEME.textPrimary,
                          }}>
                            {isCompleted ? '✅ ' : isResearching ? '🔬 ' : isLocked ? '🔒 ' : '📖 '}
                            {node.name}
                          </span>
                          <span style={{
                            fontSize: 10, color: COLOR_THEME.textDim, marginLeft: 8,
                          }}>
                            Tier {node.tier}
                          </span>
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
                                // 扣除费用
                                const payMethod = (engine as any).pay;
                                if (payMethod) payMethod.call(engine, node.cost);
                                addToast(`开始研究：${node.name}`, 'success');
                                (engine as any).emit?.('stateChange');
                              } else {
                                addToast('研究失败：资源不足或前置未完成', 'error');
                              }
                            }}
                            style={{
                              padding: '3px 12px', fontSize: 10,
                              borderRadius: 4, border: 'none', cursor: 'pointer',
                              background: `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
                              color: '#1a0a0a', fontWeight: 'bold',
                            }}
                          >
                            研究
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: COLOR_THEME.textSecondary, marginTop: 4 }}>
                        {node.description}
                      </div>
                      {isResearching && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{
                            height: 4, borderRadius: 2,
                            background: 'rgba(255,255,255,0.1)',
                          }}>
                            <div style={{
                              width: `${(node.progress * 100).toFixed(0)}%`,
                              height: '100%', borderRadius: 2,
                              background: COLOR_THEME.accentGold,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <span style={{ fontSize: 9, color: COLOR_THEME.accentGold }}>
                            研究进度: {(node.progress * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {isAvailable && Object.keys(node.cost).length > 0 && (
                        <div style={{ fontSize: 9, color: COLOR_THEME.textDim, marginTop: 2 }}>
                          费用: {Object.entries(node.cost).map(([k, v]) => `${v} ${k}`).join('  ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                textShadow: '0 0 20px rgba(255,215,0,0.5)',
              }}>
                ⚔️ 战斗中
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
        <aside style={{
          width: selectedHero ? 320 : 220, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(45,27,10,0.85), rgba(26,14,5,0.9))',
          borderLeft: '1px solid rgba(212,160,48,0.15)',
          overflowY: 'auto', padding: 8,
          zIndex: 5,
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.3s ease',
        }}>
          {/* 武将详情面板（选中时显示） */}
          {selectedHero ? (
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `1px solid ${COLOR_THEME.selectedBorder}`,
              }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 'bold', margin: 0,
                  color: RARITY_COLORS[selectedHero.rarity] || COLOR_THEME.accentGold,
                  fontFamily: '"Noto Serif SC", serif',
                }}>
                  {selectedHero.name}
                </h3>
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

              {/* 基本信息 */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 6, padding: 10, marginBottom: 10,
              }}>
                <div style={{ fontSize: 12, color: COLOR_THEME.textSecondary, marginBottom: 6 }}>
                  {selectedHero.faction.toUpperCase()} · {selectedHero.rarity} · Lv.{selectedHero.level}
                </div>
                {selectedHero.unlocked && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      { label: '攻击', value: selectedHero.stats.attack, color: '#e74c3c' },
                      { label: '防御', value: selectedHero.stats.defense, color: '#3498db' },
                      { label: '智力', value: selectedHero.stats.intelligence, color: '#9b59b6' },
                      { label: '统率', value: selectedHero.stats.command, color: '#e67e22' },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '4px 8px',
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 10, color: COLOR_THEME.textDim }}>{stat.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 'bold', color: stat.color }}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 技能列表 */}
              {'skills' in selectedHero && (selectedHero as any).skills?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: COLOR_THEME.accentGold, marginBottom: 4, fontWeight: 'bold' }}>
                    🎯 技能
                  </div>
                  {(selectedHero as any).skills.map((skill: any, i: number) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.04)', borderRadius: 4,
                      padding: '6px 8px', marginBottom: 3,
                    }}>
                      <span style={{ fontSize: 11, color: COLOR_THEME.textPrimary }}>{skill.name || `技能${i + 1}`}</span>
                      {skill.description && (
                        <div style={{ fontSize: 9, color: COLOR_THEME.textDim, marginTop: 2 }}>
                          {skill.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 装备列表 */}
              {'equipment' in selectedHero && (selectedHero as any).equipment && Object.keys((selectedHero as any).equipment).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: COLOR_THEME.accentGold, marginBottom: 4, fontWeight: 'bold' }}>
                    🛡️ 装备
                  </div>
                  {Object.entries((selectedHero as any).equipment).map(([slot, item]: [string, any]) => (
                    <div key={slot} style={{
                      fontSize: 10, color: COLOR_THEME.textSecondary,
                      padding: '2px 0',
                    }}>
                      {slot}: {item?.name || item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <h3 style={{
                fontSize: 14, fontWeight: 'bold',
                color: COLOR_THEME.accentGold,
                marginBottom: 8, paddingBottom: 4,
                borderBottom: `1px solid ${COLOR_THEME.selectedBorder}`,
              }}>
                ⚔️ 武将
              </h3>
              {heroes.map(h => {
                const rarityColor = RARITY_COLORS[h.rarity] || COLOR_THEME.textPrimary;
                return (
                  <div
                    key={h.id}
                    onClick={() => h.unlocked && setSelectedHero(h)}
                    style={{
                      padding: '6px 8px', marginBottom: 4,
                      borderRadius: 4,
                      background: h.unlocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                      borderLeft: `3px solid ${rarityColor}`,
                      opacity: h.unlocked ? 1 : 0.5,
                      cursor: h.unlocked ? 'pointer' : 'default',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => h.unlocked && (e.currentTarget.style.background = 'rgba(255,215,0,0.08)')}
                    onMouseLeave={e => h.unlocked && (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: rarityColor }}>
                        {h.name}
                      </span>
                      {h.unlocked ? (
                        <span style={{ fontSize: 10, color: COLOR_THEME.accentGold }}>
                          Lv.{h.level}
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, color: COLOR_THEME.textDim }}>
                          [{h.rarity}]
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: COLOR_THEME.textDim, marginTop: 2 }}>
                      {h.faction.toUpperCase()} · {h.rarity}
                    </div>
                    {h.unlocked && (
                      <div style={{ fontSize: 9, color: COLOR_THEME.textSecondary, marginTop: 2 }}>
                        攻{h.stats.attack} 防{h.stats.defense} 智{h.stats.intelligence} 统{h.stats.command}
                      </div>
                    )}
                    {!h.unlocked && h.canRecruit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                            // 触发状态更新
                            (engine as any).emit?.('stateChange');
                          } else {
                            addToast('招募失败：条件不满足', 'error');
                          }
                        }}
                        style={{
                          marginTop: 4, padding: '2px 8px',
                          fontSize: 9, cursor: 'pointer',
                          borderRadius: 3, border: 'none',
                          background: 'rgba(76,175,80,0.3)',
                          color: COLOR_THEME.accentGreen,
                        }}
                      >
                        招募
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </aside>
        )}

        {/* ─── 移动端武将详情面板（全宽浮层） ─── */}
        {isMobile && selectedHero && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '100%', background: 'rgba(30,20,10,0.97)',
            borderLeft: '2px solid #8B7355',
            overflow: 'auto', zIndex: 40, padding: 16,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 12,
            }}>
              <h3 style={{
                fontSize: 18, margin: 0,
                color: RARITY_COLORS[selectedHero.rarity] || '#c9a96e',
                fontFamily: '"Noto Serif SC", serif',
              }}>
                {selectedHero.name}
              </h3>
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
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
              {selectedHero.faction.toUpperCase()} · {selectedHero.rarity} · Lv.{selectedHero.level}
            </div>
            {selectedHero.unlocked && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: '攻击', value: selectedHero.stats.attack, color: '#e74c3c' },
                  { label: '防御', value: selectedHero.stats.defense, color: '#3498db' },
                  { label: '智力', value: selectedHero.stats.intelligence, color: '#9b59b6' },
                  { label: '统率', value: selectedHero.stats.command, color: '#e67e22' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: '6px 10px',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 11, color: '#888' }}>{stat.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 'bold', color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ 底部：操作按钮栏 ═══════════ */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: isMobile ? 4 : 8,
        padding: isMobile ? '4px 8px' : '6px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderTop: `1px solid rgba(255,255,255,0.08)`,
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
              style={{
                padding: isMobile ? '4px 10px' : '5px 16px',
                fontSize: isMobile ? 10 : 12,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: isActive
                  ? 'rgba(255,215,0,0.15)'
                  : 'rgba(255,255,255,0.05)',
                color: isActive ? COLOR_THEME.accentGold : COLOR_THEME.textSecondary,
                borderLeft: isActive ? `2px solid ${COLOR_THEME.accentGold}` : '2px solid transparent',
                fontWeight: isActive ? 'bold' : 'normal',
                transition: 'all 0.2s',
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

      {/* ═══════════ 新手引导浮层 ═══════════ */}
      {showGuide && (() => {
        const step = GUIDE_STEPS[guideStep];
        const isLast = guideStep >= GUIDE_STEPS.length - 1;
        const starterName = engineRef.current?.getStarterGeneralName();
        return (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 200,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: 'rgba(30,20,10,0.95)',
              borderRadius: 12, padding: '32px 40px',
              maxWidth: 420, width: '90%',
              textAlign: 'center',
              border: `1px solid ${COLOR_THEME.accentGold}`,
              boxShadow: `0 0 30px rgba(255,215,0,0.15)`,
            }}>
              <h2 style={{
                fontSize: 22, color: COLOR_THEME.accentGold,
                marginBottom: 12, fontFamily: '"Noto Serif SC", serif',
              }}>
                {step.title}
              </h2>
              <p style={{
                fontSize: 14, color: COLOR_THEME.textPrimary,
                lineHeight: 1.8, marginBottom: 8,
              }}>
                {step.text}
              </p>
              {guideStep === 0 && starterName && (
                <p style={{
                  fontSize: 15, color: '#4caf50',
                  fontWeight: 'bold', marginTop: 12, marginBottom: 4,
                }}>
                  🎉 恭喜获得武将 {starterName}！
                </p>
              )}
              <div style={{
                display: 'flex', justifyContent: 'center',
                gap: 12, marginTop: 24,
              }}>
                <button
                  onClick={() => setShowGuide(false)}
                  style={{
                    padding: '8px 20px', fontSize: 13,
                    borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent', color: COLOR_THEME.textDim,
                    cursor: 'pointer',
                  }}
                >
                  跳过
                </button>
                <button
                  onClick={() => {
                    if (isLast) {
                      setShowGuide(false);
                    } else {
                      setGuideStep(guideStep + 1);
                    }
                  }}
                  style={{
                    padding: '8px 28px', fontSize: 13, fontWeight: 'bold',
                    borderRadius: 6, border: 'none',
                    background: `linear-gradient(135deg, ${COLOR_THEME.accentGold}, #ff8c00)`,
                    color: '#1a0a0a', cursor: 'pointer',
                  }}
                >
                  {isLast ? '开始游戏' : '下一步'}
                </button>
              </div>
              {/* 步骤指示器 */}
              <div style={{
                display: 'flex', justifyContent: 'center',
                gap: 6, marginTop: 16,
              }}>
                {GUIDE_STEPS.map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === guideStep
                      ? COLOR_THEME.accentGold
                      : 'rgba(255,255,255,0.2)',
                  }} />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ 存档管理面板 ═══════════ */}
      {showSavePanel && (
        <div style={{position:'absolute',inset:0,zIndex:60,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#2a1f14',border:'2px solid #8B7355',borderRadius:8,padding:24,minWidth:360,maxHeight:'80vh',overflow:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{color:'#c9a96e',margin:0}}>📜 存档管理</h3>
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
          <div style={{position:'absolute',inset:0,zIndex:60,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'#2a1f14',border:'2px solid #8B7355',borderRadius:8,padding:24,minWidth:440,maxHeight:'80vh',overflow:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h3 style={{color:'#c9a96e',margin:0}}>🏆 成就 ({unlocked}/{ACHS.length})</h3>
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
              background: 'rgba(0,0,0,0.92)', borderRadius: 12, padding: 20,
              width: 480, maxHeight: '80vh', overflowY: 'auto',
              border: `1px solid ${COLOR_THEME.selectedBorder}`,
              color: COLOR_THEME.textPrimary, zIndex: 60,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 40px rgba(139,115,85,0.15)',
            }}
          >
            {/* 关闭按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: COLOR_THEME.accentGold }}>📋 NPC 信息</h2>
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
    </div>
  );
}
