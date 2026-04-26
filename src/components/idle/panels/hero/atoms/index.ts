/**
 * atoms — 武将系统原子组件统一导出
 *
 * 原子组件是最基础的 UI 积木，不直接依赖 ThreeKingdomsEngine，
 * 只依赖纯数据类型（Props 接口）。
 */

export { default as QualityBadge } from './QualityBadge';
export type { QualityBadgeProps } from './QualityBadge';

export { default as StarDisplay } from './StarDisplay';
export type { StarDisplayProps } from './StarDisplay';

export { default as AttributeBar } from './AttributeBar';
export type { AttributeBarProps } from './AttributeBar';

export { default as ResourceCost } from './ResourceCost';
export type { ResourceCostProps, ResourceCostItem } from './ResourceCost';
