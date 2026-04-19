/**
 * 基础设施层 — 全局常量
 *
 * 引擎级常量，供 Engine 编排层使用
 */

// ─────────────────────────────────────────────
// 1. 游戏循环
// ─────────────────────────────────────────────

/** 游戏主循环 tick 间隔（ms） */
export const TICK_INTERVAL_MS = 100;

/** 自动保存间隔（秒） */
export const AUTO_SAVE_INTERVAL_SECONDS = 30;

// ─────────────────────────────────────────────
// 2. 存档
// ─────────────────────────────────────────────

/** localStorage 存档 key */
export const SAVE_KEY = 'three-kingdoms-save';

/** 引擎存档版本号 */
export const ENGINE_SAVE_VERSION = 1;
