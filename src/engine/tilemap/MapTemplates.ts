/**
 * 地图预设模板
 *
 * 预定义 4 种古代文明地图模板：
 *   - 中国古都（Chinese Ancient Capital）
 *   - 埃及沙漠（Egyptian Desert）
 *   - 巴比伦城邦（Babylonian City-State）
 *   - 印度丛林（Indian Jungle）
 *
 * 每种模板定义了地形分布、建筑风格、装饰主题等。
 *
 * @module engine/tilemap/MapTemplates
 */

import { BiomeType } from './BiomeConfig';
import { TerrainType } from './types';
import type { MapDecoration, BuildingDef } from './types';

// ---------------------------------------------------------------------------
// 模板配置
// ---------------------------------------------------------------------------

/** 地形分布权重 */
export interface BiomeWeights {
  [BiomeType.PLAINS]?: number;
  [BiomeType.FOREST]?: number;
  [BiomeType.DESERT]?: number;
  [BiomeType.MOUNTAIN]?: number;
  [BiomeType.WATER]?: number;
  [BiomeType.SWAMP]?: number;
  [BiomeType.SNOW]?: number;
  [BiomeType.VOLCANIC]?: number;
}

/** 建筑风格配置 */
export interface BuildingStyle {
  /** 建筑定义 ID 列表 */
  buildingIds: string[];
  /** 建筑密度（0~1） */
  density: number;
  /** 默认建筑尺寸 */
  defaultSize: { w: number; h: number };
}

/** 装饰主题配置 */
export interface DecoTemplateConfig {
  /** 全局装饰密度 */
  density: number;
  /** 额外的装饰物类型 */
  extraDecoTypes: string[];
  /** 额外装饰物颜色 */
  extraDecoColors: Record<string, string>;
}

/** 地图模板完整配置 */
export interface MapTemplate {
  /** 模板唯一 ID */
  id: string;
  /** 可读名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 地形分布权重 */
  biomeWeights: BiomeWeights;
  /** 噪声缩放（影响地形块大小） */
  noiseScale: number;
  /** 河流数量 */
  riverCount: number;
  /** 建筑风格 */
  buildingStyle: BuildingStyle;
  /** 装饰主题 */
  decoConfig: DecoTemplateConfig;
  /** 地图推荐尺寸 */
  recommendedSize: { width: number; height: number };
  /** 主题色 */
  themeColor: string;
  /** 背景音乐 key（可选） */
  musicKey?: string;
}

// ---------------------------------------------------------------------------
// 预定义模板
// ---------------------------------------------------------------------------

/** 中国古都模板 */
export const TEMPLATE_CHINESE_CAPITAL: MapTemplate = {
  id: 'chinese_capital',
  name: '中国古都',
  description: '以中原平原为核心，四周环山，河流穿城而过的古代都城布局。',
  biomeWeights: {
    [BiomeType.PLAINS]: 0.45,
    [BiomeType.FOREST]: 0.15,
    [BiomeType.MOUNTAIN]: 0.15,
    [BiomeType.WATER]: 0.15,
    [BiomeType.SNOW]: 0.10,
  },
  noiseScale: 0.04,
  riverCount: 2,
  buildingStyle: {
    buildingIds: ['palace', 'pagoda', 'temple', 'house', 'market', 'barracks', 'wall', 'tower'],
    density: 0.15,
    defaultSize: { w: 1, h: 1 },
  },
  decoConfig: {
    density: 0.25,
    extraDecoTypes: ['chinese_lantern', 'stone_lion', 'bamboo', 'willow'],
    extraDecoColors: {
      chinese_lantern: '#ff2020',
      stone_lion: '#a0a0a0',
      bamboo: '#3a8a2a',
      willow: '#5aaa4a',
    },
  },
  recommendedSize: { width: 40, height: 40 },
  themeColor: '#c41e3a',
  musicKey: 'chinese_ancient',
};

/** 埃及沙漠模板 */
export const TEMPLATE_EGYPTIAN_DESERT: MapTemplate = {
  id: 'egyptian_desert',
  name: '埃及沙漠',
  description: '广袤沙漠中的尼罗河绿洲文明，金字塔与神殿矗立其间。',
  biomeWeights: {
    [BiomeType.DESERT]: 0.60,
    [BiomeType.WATER]: 0.10,
    [BiomeType.PLAINS]: 0.10,
    [BiomeType.MOUNTAIN]: 0.15,
    [BiomeType.VOLCANIC]: 0.05,
  },
  noiseScale: 0.03,
  riverCount: 1,
  buildingStyle: {
    buildingIds: ['pyramid', 'temple', 'market', 'house', 'tower', 'wall'],
    density: 0.08,
    defaultSize: { w: 1, h: 1 },
  },
  decoConfig: {
    density: 0.12,
    extraDecoTypes: ['obelisk', 'palm', 'sphinx', 'sand_dune'],
    extraDecoColors: {
      obelisk: '#d4b96a',
      palm: '#4a8a2a',
      sphinx: '#c4a060',
      sand_dune: '#e0c880',
    },
  },
  recommendedSize: { width: 50, height: 50 },
  themeColor: '#d4a017',
  musicKey: 'egyptian_mystic',
};

/** 巴比伦城邦模板 */
export const TEMPLATE_BABYLONIAN_CITY: MapTemplate = {
  id: 'babylonian_city',
  name: '巴比伦城邦',
  description: '两河流域的古代城邦，平原沃土与沙漠交汇，空中花园之城。',
  biomeWeights: {
    [BiomeType.PLAINS]: 0.35,
    [BiomeType.DESERT]: 0.25,
    [BiomeType.WATER]: 0.20,
    [BiomeType.MOUNTAIN]: 0.10,
    [BiomeType.SWAMP]: 0.10,
  },
  noiseScale: 0.045,
  riverCount: 2,
  buildingStyle: {
    buildingIds: ['ziggurat', 'temple', 'palace', 'market', 'house', 'wall', 'tower'],
    density: 0.12,
    defaultSize: { w: 1, h: 1 },
  },
  decoConfig: {
    density: 0.20,
    extraDecoTypes: ['hanging_garden', 'clay_tablet', 'cypress', 'canal'],
    extraDecoColors: {
      hanging_garden: '#3a8a3a',
      clay_tablet: '#b0a080',
      cypress: '#2a6a2a',
      canal: '#4a8edf',
    },
  },
  recommendedSize: { width: 35, height: 35 },
  themeColor: '#1a6b4a',
  musicKey: 'babylonian_anthem',
};

/** 印度丛林模板 */
export const TEMPLATE_INDIAN_JUNGLE: MapTemplate = {
  id: 'indian_jungle',
  name: '印度丛林',
  description: '热带丛林中的古代印度文明，茂密森林与河流交织。',
  biomeWeights: {
    [BiomeType.FOREST]: 0.40,
    [BiomeType.PLAINS]: 0.20,
    [BiomeType.WATER]: 0.15,
    [BiomeType.MOUNTAIN]: 0.10,
    [BiomeType.SWAMP]: 0.10,
    [BiomeType.VOLCANIC]: 0.05,
  },
  noiseScale: 0.05,
  riverCount: 3,
  buildingStyle: {
    buildingIds: ['temple', 'shrine', 'palace', 'house', 'market', 'barracks'],
    density: 0.10,
    defaultSize: { w: 1, h: 1 },
  },
  decoConfig: {
    density: 0.35,
    extraDecoTypes: ['banyan', 'lotus', 'elephant_statue', 'spice_bush'],
    extraDecoColors: {
      banyan: '#2a6a1a',
      lotus: '#ff80c0',
      elephant_statue: '#a0a0a0',
      spice_bush: '#8a6a2a',
    },
  },
  recommendedSize: { width: 45, height: 45 },
  themeColor: '#ff6b35',
  musicKey: 'indian_jungle',
};

// ---------------------------------------------------------------------------
// 模板注册表
// ---------------------------------------------------------------------------

/** 所有预定义模板 */
export const MAP_TEMPLATES: Record<string, MapTemplate> = {
  [TEMPLATE_CHINESE_CAPITAL.id]: TEMPLATE_CHINESE_CAPITAL,
  [TEMPLATE_EGYPTIAN_DESERT.id]: TEMPLATE_EGYPTIAN_DESERT,
  [TEMPLATE_BABYLONIAN_CITY.id]: TEMPLATE_BABYLONIAN_CITY,
  [TEMPLATE_INDIAN_JUNGLE.id]: TEMPLATE_INDIAN_JUNGLE,
};

/**
 * 获取模板
 *
 * @param id 模板 ID
 * @returns 模板配置或 undefined
 */
export function getTemplate(id: string): MapTemplate | undefined {
  return MAP_TEMPLATES[id];
}

/**
 * 获取所有模板 ID
 */
export function getTemplateIds(): string[] {
  return Object.keys(MAP_TEMPLATES);
}

/**
 * 获取所有模板
 */
export function getAllTemplates(): MapTemplate[] {
  return Object.values(MAP_TEMPLATES);
}

// ---------------------------------------------------------------------------
// 模板建筑定义生成
// ---------------------------------------------------------------------------

/**
 * 根据模板生成建筑定义列表
 *
 * @param template 地图模板
 * @returns 建筑定义数组
 */
export function generateBuildingDefsFromTemplate(template: MapTemplate): BuildingDef[] {
  const defs: BuildingDef[] = [];

  // 通用建筑定义
  const commonDefs: Record<string, BuildingDef> = {
    house: {
      id: 'house', name: '民居', type: 'house',
      size: { w: 1, h: 1 }, color: '#8B8682', iconEmoji: '🏠',
      clickable: true, description: '普通民居', levels: 3,
    },
    market: {
      id: 'market', name: '市场', type: 'market',
      size: { w: 2, h: 2 }, color: '#DAA520', iconEmoji: '🏪',
      clickable: true, description: '贸易市场', levels: 3,
    },
    temple: {
      id: 'temple', name: '神殿', type: 'temple',
      size: { w: 2, h: 2 }, color: '#9370DB', iconEmoji: '⛩️',
      clickable: true, description: '宗教神殿', levels: 5,
    },
    palace: {
      id: 'palace', name: '宫殿', type: 'palace',
      size: { w: 3, h: 3 }, color: '#FFD700', iconEmoji: '🏯',
      clickable: true, description: '王族宫殿', levels: 5,
    },
    barracks: {
      id: 'barracks', name: '兵营', type: 'barracks',
      size: { w: 2, h: 2 }, color: '#B22222', iconEmoji: '⚔️',
      clickable: true, description: '军事兵营', levels: 3,
    },
    tower: {
      id: 'tower', name: '塔楼', type: 'tower',
      size: { w: 1, h: 1 }, color: '#708090', iconEmoji: '🗼',
      clickable: true, description: '防御塔楼', levels: 3,
    },
    wall: {
      id: 'wall', name: '城墙', type: 'wall',
      size: { w: 1, h: 1 }, color: '#696969', iconEmoji: '🧱',
      clickable: false, description: '防御城墙', levels: 3,
    },
    farm: {
      id: 'farm', name: '农田', type: 'farm',
      size: { w: 2, h: 2 }, color: '#90EE90', iconEmoji: '🌾',
      clickable: true, description: '食物产地', levels: 3,
    },
    shrine: {
      id: 'shrine', name: '神龛', type: 'shrine',
      size: { w: 1, h: 1 }, color: '#DDA0DD', iconEmoji: '🙏',
      clickable: true, description: '小型神龛', levels: 3,
    },
  };

  // 模板特有建筑
  const specialDefs: Record<string, BuildingDef> = {
    pagoda: {
      id: 'pagoda', name: '宝塔', type: 'pagoda',
      size: { w: 2, h: 2 }, color: '#DC143C', iconEmoji: '🗼',
      clickable: true, description: '中式宝塔', levels: 5,
    },
    pyramid: {
      id: 'pyramid', name: '金字塔', type: 'pyramid',
      size: { w: 3, h: 3 }, color: '#DAA520', iconEmoji: '🔺',
      clickable: true, description: '法老金字塔', levels: 5,
    },
    ziggurat: {
      id: 'ziggurat', name: '金字形神塔', type: 'ziggurat',
      size: { w: 3, h: 3 }, color: '#8B7355', iconEmoji: '🏛️',
      clickable: true, description: '巴比伦阶梯神塔', levels: 5,
    },
  };

  // 收集模板需要的建筑
  for (const id of template.buildingStyle.buildingIds) {
    const def = commonDefs[id] ?? specialDefs[id];
    if (def) {
      defs.push(def);
    }
  }

  return defs;
}
