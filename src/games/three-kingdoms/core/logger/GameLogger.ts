/**
 * 游戏日志工具 — 生产环境可控的日志输出
 *
 * 设计原则：
 * - 生产构建自动静默 info/warn 级别
 * - error 级别始终输出（错误处理必需）
 * - 通过环境变量或运行时开关控制日志级别
 * - 零依赖，纯 TypeScript 实现
 *
 * @module core/logger
 *
 * @example
 * ```ts
 * import { gameLog } from '../logger';
 *
 * gameLog.info('[Save] 存档迁移完成');      // 仅开发环境输出
 * gameLog.warn('[GameState] 版本不匹配');    // 仅开发环境输出
 * gameLog.error('[Engine] 加载失败', err);   // 始终输出
 * ```
 */

// ─── 日志级别 ─────────────────────────────────────────────────────
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

// ─── 日志级别映射 ──────────────────────────────────────────────────
const ENV_LEVEL_MAP: Record<string, LogLevel> = {
  production: LogLevel.ERROR,
  test: LogLevel.ERROR,
  development: LogLevel.DEBUG,
};

// ─── 默认日志级别 ──────────────────────────────────────────────────
function resolveDefaultLevel(): LogLevel {
  const env = typeof process !== 'undefined'
    ? process.env?.NODE_ENV ?? 'production'
    : 'production';
  return ENV_LEVEL_MAP[env] ?? LogLevel.ERROR;
}

// ─── GameLogger 类 ────────────────────────────────────────────────
export class GameLogger {
  private level: LogLevel;

  constructor(level?: LogLevel) {
    this.level = level ?? resolveDefaultLevel();
  }

  /** 设置日志级别 */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /** 获取当前日志级别 */
  getLevel(): LogLevel {
    return this.level;
  }

  /** 调试信息（仅开发环境） */
  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /** 信息日志（开发/测试环境） */
  info(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /** 警告日志（开发/测试环境） */
  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /** 错误日志（始终输出） */
  error(message: string, ...args: unknown[]): void {
    // error 级别始终输出——这是生产环境错误处理的基础设施
    console.error(`[ERROR] ${message}`, ...args);
  }
}

// ─── 全局单例 ──────────────────────────────────────────────────────
export const gameLog = new GameLogger();
