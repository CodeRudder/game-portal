/**
 * icons barrel export - re-exports all SVG icon components
 *
 * Maintains backward compatibility with original ThreeKingdomsSVGIcons module.
 *
 * @module components/idle/icons
 */

// 建筑图标
export { BuildingIcon } from './BuildingIcons';
export {
  TavernIcon,
  BeaconTowerIcon,
  MintIcon,
  ForgeIcon,
  TeahouseIcon,
  GranaryIcon,
} from './BuildingExtraIcons';

// 资源图标
export { ResourceIcon } from './ResourceIcons';

// 科技树图标
export { TechIcon, TechLockedIcon, TechResearchingIcon } from './TechIcons';

// 武将技能 + 装备 + 进度条
export { SkillIcon, EquipSlotIcon, BuildingProgressBar } from './CombatIcons';
