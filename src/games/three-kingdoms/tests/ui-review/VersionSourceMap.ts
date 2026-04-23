/**
 * UI评测框架 — 版本源码映射配置
 *
 * 从 UIReviewOrchestrator 中提取的版本映射表和类型。
 *
 * @module ui-review/VersionSourceMap
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 版本到源码目录的映射条目 */
export interface VersionSourceMapping {
  /** 版本号，如 "v1.0" */
  version: string;
  /** engine 下的子目录名 */
  engineDir: string;
  /** core 下的子目录名 */
  coreDir: string;
  /** 对应的 PRD 模块代码列表 */
  prdModuleCodes: string[];
}

// ---------------------------------------------------------------------------
// 版本到源码的映射表
// ---------------------------------------------------------------------------

/**
 * 版本 → 源码目录映射
 *
 * 每个版本对应 engine/ 和 core/ 下的一个子目录，
 * 以及零到多个 PRD 模块代码。
 */
export const VERSION_SOURCE_MAP: VersionSourceMapping[] = [
  { version: 'v1.0',  engineDir: 'building',    coreDir: 'building',    prdModuleCodes: ['BLD', 'RES'] },
  { version: 'v2.0',  engineDir: 'hero',        coreDir: 'hero',        prdModuleCodes: ['HER'] },
  { version: 'v3.0',  engineDir: 'campaign',    coreDir: 'campaign',    prdModuleCodes: ['CBT'] },
  { version: 'v4.0',  engineDir: 'campaign',    coreDir: 'campaign',    prdModuleCodes: ['CBT'] },
  { version: 'v5.0',  engineDir: 'tech',        coreDir: 'tech',        prdModuleCodes: ['TECH'] },
  { version: 'v6.0',  engineDir: 'map',         coreDir: 'map',         prdModuleCodes: ['MAP'] },
  { version: 'v7.0',  engineDir: 'battle',      coreDir: 'battle',      prdModuleCodes: ['CBT'] },
  { version: 'v8.0',  engineDir: 'trade',       coreDir: 'trade',       prdModuleCodes: ['SHP'] },
  { version: 'v9.0',  engineDir: 'offline',     coreDir: 'offline',     prdModuleCodes: ['RES'] },
  { version: 'v10.0', engineDir: 'army',        coreDir: 'army',        prdModuleCodes: ['CBT'] },
  { version: 'v11.0', engineDir: 'arena',       coreDir: 'pvp',         prdModuleCodes: ['PVP'] },
  { version: 'v12.0', engineDir: 'expedition',  coreDir: 'expedition',  prdModuleCodes: ['EXP'] },
  { version: 'v13.0', engineDir: 'alliance',    coreDir: 'alliance',    prdModuleCodes: ['SOC'] },
  { version: 'v14.0', engineDir: 'prestige',    coreDir: 'prestige',    prdModuleCodes: ['PRS'] },
  { version: 'v15.0', engineDir: 'event',       coreDir: 'event',       prdModuleCodes: ['EVT'] },
  { version: 'v16.0', engineDir: 'legacy',      coreDir: 'heritage',    prdModuleCodes: ['ITR'] },
  { version: 'v17.0', engineDir: 'responsive',  coreDir: 'responsive',  prdModuleCodes: ['SPEC'] },
  { version: 'v18.0', engineDir: 'guide',       coreDir: 'guide',       prdModuleCodes: ['NAV'] },
  { version: 'v19.0', engineDir: 'settings',    coreDir: 'settings',    prdModuleCodes: ['SET'] },
  { version: 'v20.0', engineDir: 'unification', coreDir: 'unification', prdModuleCodes: ['NAV'] },
];
