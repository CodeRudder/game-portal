/**
 * 军师推荐域 — 触发检测辅助模块
 *
 * 从 AdvisorSystem.ts 拆分出的触发检测逻辑：
 *   - 9种触发条件检测
 *   - 资源溢出/告急检测
 *   - 建议生成辅助方法
 *
 * @module engine/advisor/AdvisorTriggerDetector
 */

import type { AdvisorSuggestion, AdvisorTriggerType } from '../../core/advisor/advisor.types';
import type { GameStateSnapshot } from './AdvisorSystem';

/** 建议冷却时间（毫秒） */
const COOLDOWN_MS: Record<AdvisorTriggerType, number> = {
  resource_overflow: 30 * 60 * 1000,
  resource_shortage: 30 * 60 * 1000,
  building_idle: 60 * 60 * 1000,
  hero_upgradeable: 30 * 60 * 1000,
  tech_idle: 60 * 60 * 1000,
  army_full: 60 * 60 * 1000,
  npc_leaving: 15 * 60 * 1000,
  new_feature_unlock: 24 * 60 * 60 * 1000,
  offline_overflow: 60 * 60 * 1000,
};

interface TriggerState {
  cooldowns: Record<string, number>;
}

/**
 * 检查触发类型是否在冷却中
 */
export function isInCooldown(state: TriggerState, triggerType: AdvisorTriggerType): boolean {
  const lastTime = state.cooldowns[triggerType] ?? 0;
  return Date.now() - lastTime < (COOLDOWN_MS[triggerType] ?? 0);
}

/**
 * 设置触发冷却
 */
export function setCooldown(state: TriggerState, triggerType: AdvisorTriggerType): void {
  state.cooldowns[triggerType] = Date.now();
}

/**
 * 查找溢出资源
 */
export function findOverflowResource(snapshot: GameStateSnapshot): string | null {
  if (!snapshot.resources) return null;
  const caps = snapshot.resourceCaps as unknown as Record<string, number>;
  for (const [key, value] of Object.entries(snapshot.resources)) {
    const cap = caps[key] ?? 0;
    if (cap > 0 && value / cap > 0.8) return key;
  }
  return null;
}

/**
 * 查找告急资源
 */
export function findShortageResource(snapshot: GameStateSnapshot): string | null {
  if (!snapshot.resources) return null;
  const caps = snapshot.resourceCaps as unknown as Record<string, number>;
  for (const [key, value] of Object.entries(snapshot.resources)) {
    const cap = caps[key] ?? 0;
    if (cap > 0 && value / cap < 0.1) return key;
  }
  return null;
}

/**
 * 检测所有触发条件，返回候选建议列表
 */
export function detectAllTriggers(
  snapshot: GameStateSnapshot,
  state: TriggerState,
  createSuggestion: (trigger: AdvisorTriggerType, title: string, desc: string, priority: string, action: string, target: string, targetId?: string) => AdvisorSuggestion,
): AdvisorSuggestion[] {
  const suggestions: AdvisorSuggestion[] = [];

  // 资源溢出检测
  const overflowResource = findOverflowResource(snapshot);
  if (overflowResource && !isInCooldown(state, 'resource_overflow')) {
    suggestions.push(createSuggestion('resource_overflow', '资源满仓，建议升级', '资源已满仓，建议升级仓库或消耗资源', 'high', '前往升级', 'building'));
  }

  // 资源告急检测
  const shortageResource = findShortageResource(snapshot);
  if (shortageResource && !isInCooldown(state, 'resource_shortage')) {
    suggestions.push(createSuggestion('resource_shortage', '粮草告急，建议建造农田', '资源严重不足，建议立即建造或升级资源建筑', 'high', '前往建造', 'building'));
  }

  // 建筑队列空闲
  if (snapshot.buildingQueueIdle && !isInCooldown(state, 'building_idle')) {
    suggestions.push(createSuggestion('building_idle', '建造队列空闲，建议升级', '有建造队列空闲，建议安排建筑升级', 'medium', '前往建造', 'building'));
  }

  // 武将可升级
  if (snapshot.upgradeableHeroes.length > 0 && !isInCooldown(state, 'hero_upgradeable')) {
    const heroId = snapshot.upgradeableHeroes[0];
    suggestions.push(createSuggestion('hero_upgradeable', `武将${heroId}可升级`, `${heroId}已满足升级条件，建议立即升级`, 'high', '前往升级', 'hero', heroId));
  }

  // 科技队列空闲
  if (snapshot.techQueueIdle && !isInCooldown(state, 'tech_idle')) {
    suggestions.push(createSuggestion('tech_idle', '科技研究空闲', '科技研究队列空闲，建议安排新的研究', 'medium', '前往研究', 'tech'));
  }

  // 兵力满值
  if (snapshot.armyFull && !isInCooldown(state, 'army_full')) {
    suggestions.push(createSuggestion('army_full', '兵力已满，建议出征', '兵力已达上限，建议出征或扩充兵营', 'medium', '前往出征', 'campaign'));
  }

  // 限时NPC即将离开
  for (const npc of snapshot.leavingNpcs) {
    if (!isInCooldown(state, 'npc_leaving')) {
      suggestions.push(createSuggestion('npc_leaving', `${npc.name}即将离开`, `限时NPC${npc.name}即将离开，请尽快交互`, 'high', '前往查看', 'npc', npc.id));
    }
  }

  // 新功能解锁
  for (const feature of snapshot.newFeatures) {
    if (!isInCooldown(state, 'new_feature_unlock')) {
      suggestions.push(createSuggestion('new_feature_unlock', `点击了解${feature.name}`, `新功能${feature.name}已解锁，点击了解详情`, 'low', '了解更多', 'feature', feature.id));
    }
  }

  // 离线溢出
  if (snapshot.offlineOverflowPercent > 50 && !isInCooldown(state, 'offline_overflow')) {
    suggestions.push(createSuggestion('offline_overflow', '建议升级仓库', '离线收益溢出较多，建议升级仓库容量', 'medium', '前往升级', 'building'));
  }

  return suggestions;
}
