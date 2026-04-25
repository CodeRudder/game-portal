/**
 * 测试语义化常量
 *
 * 将测试中使用的魔法数字提取为语义化常量，提升可读性和可维护性。
 * 与 test-helpers.ts 配合使用。
 */

// ── 资源容量常量 ──

/** 初始粮草上限（农田 Lv1） */
export const INITIAL_GRAIN_CAP = 2000;

/** 初始兵力上限（兵营未解锁时） */
export const INITIAL_TROOPS_CAP = 500;

/** 容量警告阈值（安全级别：< 90%） */
export const CAP_SAFE_PERCENT = 0.7;

/** 容量警告阈值（注意级别：90%~95%） */
export const CAP_NOTICE_PERCENT = 0.9;

/** 容量警告阈值（警告级别：95%~100%） */
export const CAP_WARNING_PERCENT = 0.95;

/** 容量警告阈值（满仓级别：100%） */
export const CAP_FULL_PERCENT = 1.0;

// ── 时间常量 ──

/** 离线收益最短触发时间（秒） */
export const OFFLINE_MIN_SECONDS = 300; // 5 分钟

/** 离线收益上限时间（秒） */
export const OFFLINE_MAX_SECONDS = 72 * 3600; // 72 小时

/** 自动保存间隔（秒） */
export const AUTO_SAVE_INTERVAL_SECONDS = 30;

// ── 建筑等级常量 ──

/** 主城初始等级 */
export const CASTLE_INITIAL_LEVEL = 1;

/** 主城解锁市集/兵营等级 */
export const CASTLE_UNLOCK_MARKET = 2;

/** 主城解锁铁匠铺/书院等级 */
export const CASTLE_UNLOCK_SMITHY = 3;

/** 主城解锁医馆等级 */
export const CASTLE_UNLOCK_CLINIC = 4;

/** 主城解锁城墙等级 */
export const CASTLE_UNLOCK_WALL = 5;

/** 主城双队列等级 */
export const CASTLE_DUAL_QUEUE = 6;

// ── 账号系统常量 ──

/** 首次绑定奖励（元宝） */
export const FIRST_BIND_REWARD = 50;

/** 账号绑定冷却期（天） */
export const BIND_COOLDOWN_DAYS = 7;

/** 存档槽位数（3 免费 + 1 付费） */
export const SAVE_SLOT_COUNT = 4;

// ── 军师建议常量 ──

/** 军师建议每日上限 */
export const ADVISOR_DAILY_LIMIT = 15;

/** 军师建议最大显示数 */
export const ADVISOR_MAX_DISPLAY = 3;
