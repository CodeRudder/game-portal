/**
 * 存档模块 — 统一导出
 *
 * L1 内核层存档子模块的入口文件。
 * 导出 SaveManager（存档管理器）和 StateSerializer（状态序列化器）。
 *
 * @module core/save
 */

export { SaveManager } from './SaveManager';
export { StateSerializer, SerializationError } from './StateSerializer';
