/**
 * 核心层 — NPC 数据配置（聚合导出）
 *
 * 包含 NPC 职业定义、默认 NPC 数据、对话树配置等静态数据。
 * 所有配置为只读常量，运行时不可修改。
 *
 * 子模块：
 *   - npc-config-professions — 职业定义、好感度工具、默认NPC、地图配置
 *   - npc-config-dialogs — 对话树配置
 *
 * @module core/npc/npc-config
 */

// 从职业配置子模块导出
export {
  NPC_PROFESSION_DEFS,
  NPC_PROFESSIONS,
  NPC_PROFESSION_LABELS,
  DEFAULT_NPCS,
  DEFAULT_CLUSTER_CONFIG,
  DEFAULT_CROWD_CONFIG,
  AFFINITY_LEVEL_LABELS,
  getAffinityLevel,
  getAffinityProgress,
  clampAffinity,
} from './npc-config-professions';

// 从对话树子模块导出
export {
  DIALOG_TREE_MERCHANT,
  DIALOG_TREE_STRATEGIST,
  DIALOG_TREE_WARRIOR,
  DIALOG_TREE_ARTISAN,
  DIALOG_TREE_TRAVELER,
  DIALOG_TREES,
  DIALOG_MERCHANT_DEFAULT,
  DIALOG_STRATEGIST_DEFAULT,
  DIALOG_WARRIOR_DEFAULT,
  DIALOG_ARTISAN_DEFAULT,
  DIALOG_TRAVELER_DEFAULT,
} from './npc-config-dialogs';

// 导入类型和依赖用于本地函数
import type { NPCProfession, NPCAction } from './npc.types';
import { NPC_PROFESSION_DEFS } from './npc-config-professions';

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
