/**
 * 核心层 — v15.0 事件引擎共享基础类型
 *
 * 提取自 event-v15.types.ts，供子模块（activity/chain/offline）直接引用，
 * 避免子模块反向导入 event-v15.types.ts 造成循环依赖。
 *
 * 包含：
 *   - EventCategory — 事件分类（5类）
 *   - EventCategoryMeta — 分类元数据
 *   - EVENT_CATEGORY_META — 分类常量
 *   - OptionConsequence — 选项后果
 *   - OptionSelectionResult — 选择结果
 *
 * @module core/event/event-v15-shared.types
 */

// ─────────────────────────────────────────────
// 事件分类（5类）
// ─────────────────────────────────────────────

/** 事件分类（5类：剧情/随机/触发/连锁/世界） */
export type EventCategory = 'story' | 'random' | 'triggered' | 'chain' | 'world';

/** 事件分类元数据 */
export interface EventCategoryMeta {
  /** 分类名称 */
  label: string;
  /** 默认权重 */
  defaultWeight: number;
  /** 描述 */
  description: string;
}

/** 事件分类元数据常量 */
export const EVENT_CATEGORY_META: Record<EventCategory, EventCategoryMeta> = {
  story: { label: '剧情事件', defaultWeight: 80, description: '主线/支线剧情事件' },
  random: { label: '随机事件', defaultWeight: 50, description: '随机触发的事件' },
  triggered: { label: '触发事件', defaultWeight: 70, description: '满足条件触发的事件' },
  chain: { label: '连锁事件', defaultWeight: 60, description: '多步骤连锁事件' },
  world: { label: '世界事件', defaultWeight: 40, description: '全服世界事件' },
};

// ─────────────────────────────────────────────
// 选项后果与选择结果
// ─────────────────────────────────────────────

/** 选项后果（与 EventConsequence 对齐） */
export interface OptionConsequence {
  /** 描述 */
  description?: string;
  /** 资源变化 */
  resourceChanges?: Record<string, number>;
  /** 好感度变化 */
  affinityChanges?: Record<string, number>;
  /** 触发后续事件ID */
  triggerEventId?: string;
  /** 解锁ID列表 */
  unlockIds?: string[];
}

/** 选项选择结果 */
export interface OptionSelectionResult {
  /** 选择的选项ID */
  optionId: string;
  /** 是否自动选择 */
  isAuto: boolean;
  /** 后果 */
  consequences: OptionConsequence;
  /** 下一个事件ID */
  nextEventId?: string;
}
