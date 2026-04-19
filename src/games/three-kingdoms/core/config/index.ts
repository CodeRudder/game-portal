/**
 * 配置模块 — 统一导出
 *
 * L1 内核层配置子模块的入口文件。
 * 导出 ConfigRegistry（配置注册表）和 ConstantsLoader（常量加载器）。
 *
 * @module core/config
 *
 * @example
 * ```ts
 * import { ConfigRegistry, ConstantsLoader } from '../config';
 *
 * const config = new ConfigRegistry();
 * const loader = new ConstantsLoader();
 * loader.loadAll(config);
 * ```
 */

export { ConfigRegistry, ConfigError } from './ConfigRegistry';
export { ConstantsLoader } from './ConstantsLoader';
