// ========== 涂鸦上帝 Doodle God — 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 元素类别 */
export enum ElementCategory {
  BASIC = '基础',
  NATURE = '自然',
  MATTER = '物质',
  LIFE = '生命',
  TOOL = '工具',
  FOOD = '食物',
  WEATHER = '天气',
  ENERGY = '能量',
  HUMAN = '人类',
  BUILDING = '建筑',
  TRANSPORT = '交通',
  TECH = '科技',
}

/** 元素定义 */
export interface ElementDef {
  id: string;
  name: string;
  emoji: string;
  category: ElementCategory;
  isBasic: boolean;
}

/** 组合规则：两个元素 ID → 新元素 ID */
export interface CombinationRule {
  a: string;
  b: string;
  result: string;
}

/** 选择槽位 */
export enum SlotType {
  FIRST = 'first',
  SECOND = 'second',
}

/** UI 布局常量 */
export const HUD_HEIGHT = 50;
export const SLOT_AREA_HEIGHT = 100;
export const ELEMENT_GRID_PADDING = 10;
export const ELEMENT_ITEM_SIZE = 60;
export const ELEMENT_ITEM_GAP = 6;
export const ELEMENTS_PER_ROW = 6;
export const GRID_TOP_OFFSET = HUD_HEIGHT + SLOT_AREA_HEIGHT + 20;
export const DISCOVERY_ANIMATION_DURATION = 1500;

/** 颜色主题 */
export const COLORS = {
  bg: '#0d0d20',
  hudBg: '#1a1a3e',
  slotBg: '#151535',
  slotActive: '#2a2a5e',
  slotBorder: '#4a4a8e',
  elementBg: '#1e1e4a',
  elementHover: '#2e2e6a',
  elementSelected: '#3a3a8e',
  elementLocked: '#0e0e2a',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0c0',
  textLocked: '#404060',
  accent: '#6c5ce7',
  neon: '#00ff88',
  gold: '#ffd700',
  categoryColors: {
    [ElementCategory.BASIC]: '#6c5ce7',
    [ElementCategory.NATURE]: '#00b894',
    [ElementCategory.MATTER]: '#e17055',
    [ElementCategory.LIFE]: '#fd79a8',
    [ElementCategory.TOOL]: '#0984e3',
    [ElementCategory.FOOD]: '#fdcb6e',
    [ElementCategory.WEATHER]: '#74b9ff',
    [ElementCategory.ENERGY]: '#ffeaa7',
    [ElementCategory.HUMAN]: '#fab1a0',
    [ElementCategory.BUILDING]: '#b2bec3',
    [ElementCategory.TRANSPORT]: '#55efc4',
    [ElementCategory.TECH]: '#a29bfe',
  },
} as const;

// ========== 全部元素定义 ==========

export const ALL_ELEMENTS: ElementDef[] = [
  // 基础元素 (4)
  { id: 'water', name: '水', emoji: '💧', category: ElementCategory.BASIC, isBasic: true },
  { id: 'fire', name: '火', emoji: '🔥', category: ElementCategory.BASIC, isBasic: true },
  { id: 'earth', name: '土', emoji: '🌍', category: ElementCategory.BASIC, isBasic: true },
  { id: 'air', name: '空气', emoji: '💨', category: ElementCategory.BASIC, isBasic: true },

  // 自然
  { id: 'steam', name: '蒸汽', emoji: '♨️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'mud', name: '泥', emoji: '🟤', category: ElementCategory.NATURE, isBasic: false },
  { id: 'lava', name: '岩浆', emoji: '🌋', category: ElementCategory.NATURE, isBasic: false },
  { id: 'dust', name: '尘土', emoji: '🌫️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'rain', name: '雨', emoji: '🌧️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'cloud', name: '云', emoji: '☁️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'snow', name: '雪', emoji: '❄️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'stone', name: '石头', emoji: '🪨', category: ElementCategory.NATURE, isBasic: false },
  { id: 'sand', name: '沙', emoji: '🏖️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'ice', name: '冰', emoji: '🧊', category: ElementCategory.NATURE, isBasic: false },
  { id: 'swamp', name: '沼泽', emoji: '🐊', category: ElementCategory.NATURE, isBasic: false },
  { id: 'mountain', name: '山', emoji: '⛰️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'volcano', name: '火山', emoji: '🌋', category: ElementCategory.NATURE, isBasic: false },
  { id: 'lightning', name: '闪电', emoji: '⚡', category: ElementCategory.NATURE, isBasic: false },
  { id: 'rainbow', name: '彩虹', emoji: '🌈', category: ElementCategory.NATURE, isBasic: false },
  { id: 'sea', name: '海', emoji: '🌊', category: ElementCategory.NATURE, isBasic: false },
  { id: 'sky', name: '天空', emoji: '🌌', category: ElementCategory.NATURE, isBasic: false },
  { id: 'wind', name: '风', emoji: '🌬️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'island', name: '岛屿', emoji: '🏝️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'cold', name: '冷', emoji: '🥶', category: ElementCategory.NATURE, isBasic: false },
  { id: 'glacier', name: '冰川', emoji: '🧊', category: ElementCategory.NATURE, isBasic: false },
  { id: 'geyser', name: '间歇泉', emoji: '⛲', category: ElementCategory.NATURE, isBasic: false },
  { id: 'storm', name: '暴风雨', emoji: '⛈️', category: ElementCategory.NATURE, isBasic: false },
  { id: 'wave', name: '波浪', emoji: '🏄', category: ElementCategory.NATURE, isBasic: false },
  { id: 'star', name: '星星', emoji: '⭐', category: ElementCategory.NATURE, isBasic: false },
  { id: 'forest', name: '森林', emoji: '🌲', category: ElementCategory.NATURE, isBasic: false },
  { id: 'garden', name: '花园', emoji: '🌷', category: ElementCategory.NATURE, isBasic: false },
  { id: 'wood', name: '木头', emoji: '🪵', category: ElementCategory.NATURE, isBasic: false },
  { id: 'charcoal', name: '木炭', emoji: '⚫', category: ElementCategory.NATURE, isBasic: false },
  { id: 'fruit', name: '水果', emoji: '🍎', category: ElementCategory.NATURE, isBasic: false },
  { id: 'honey', name: '蜂蜜', emoji: '🍯', category: ElementCategory.NATURE, isBasic: false },

  // 物质
  { id: 'brick', name: '砖', emoji: '🧱', category: ElementCategory.MATTER, isBasic: false },
  { id: 'glass', name: '玻璃', emoji: '🪟', category: ElementCategory.MATTER, isBasic: false },
  { id: 'metal', name: '金属', emoji: '⚙️', category: ElementCategory.MATTER, isBasic: false },
  { id: 'salt', name: '盐', emoji: '🧂', category: ElementCategory.MATTER, isBasic: false },
  { id: 'clay', name: '黏土', emoji: '🏺', category: ElementCategory.MATTER, isBasic: false },
  { id: 'diamond', name: '钻石', emoji: '💎', category: ElementCategory.MATTER, isBasic: false },

  // 能量
  { id: 'energy', name: '能量', emoji: '✨', category: ElementCategory.ENERGY, isBasic: false },
  { id: 'electricity', name: '电', emoji: '🔌', category: ElementCategory.ENERGY, isBasic: false },
  { id: 'light', name: '光', emoji: '💡', category: ElementCategory.ENERGY, isBasic: false },
  { id: 'plasma', name: '等离子', emoji: '🔮', category: ElementCategory.ENERGY, isBasic: false },
  { id: 'sun', name: '太阳', emoji: '☀️', category: ElementCategory.ENERGY, isBasic: false },

  // 生命 (5)
  { id: 'plant', name: '植物', emoji: '🌱', category: ElementCategory.LIFE, isBasic: false },
  { id: 'tree', name: '树', emoji: '🌳', category: ElementCategory.LIFE, isBasic: false },
  { id: 'flower', name: '花', emoji: '🌸', category: ElementCategory.LIFE, isBasic: false },
  { id: 'animal', name: '动物', emoji: '🐾', category: ElementCategory.LIFE, isBasic: false },
  { id: 'fish', name: '鱼', emoji: '🐟', category: ElementCategory.LIFE, isBasic: false },
  { id: 'bird', name: '鸟', emoji: '🐦', category: ElementCategory.LIFE, isBasic: false },
  { id: 'egg', name: '蛋', emoji: '🥚', category: ElementCategory.LIFE, isBasic: false },
  { id: 'dinosaur', name: '恐龙', emoji: '🦕', category: ElementCategory.LIFE, isBasic: false },
  { id: 'dragon', name: '龙', emoji: '🐉', category: ElementCategory.LIFE, isBasic: false },
  { id: 'bacteria', name: '细菌', emoji: '🦠', category: ElementCategory.LIFE, isBasic: false },
  { id: 'seed', name: '种子', emoji: '🫘', category: ElementCategory.LIFE, isBasic: false },
  { id: 'life', name: '生命', emoji: '❤️', category: ElementCategory.LIFE, isBasic: false },

  // 食物 (4)
  { id: 'bread', name: '面包', emoji: '🍞', category: ElementCategory.FOOD, isBasic: false },
  { id: 'beer', name: '啤酒', emoji: '🍺', category: ElementCategory.FOOD, isBasic: false },
  { id: 'wine', name: '酒', emoji: '🍷', category: ElementCategory.FOOD, isBasic: false },
  { id: 'milk', name: '牛奶', emoji: '🥛', category: ElementCategory.FOOD, isBasic: false },
  { id: 'cheese', name: '奶酪', emoji: '🧀', category: ElementCategory.FOOD, isBasic: false },

  // 人类 (3)
  { id: 'human', name: '人类', emoji: '🧑', category: ElementCategory.HUMAN, isBasic: false },
  { id: 'warrior', name: '战士', emoji: '⚔️', category: ElementCategory.HUMAN, isBasic: false },
  { id: 'wizard', name: '法师', emoji: '🧙', category: ElementCategory.HUMAN, isBasic: false },
  { id: 'love', name: '爱', emoji: '💕', category: ElementCategory.HUMAN, isBasic: false },

  // 工具 (5)
  { id: 'wheel', name: '轮子', emoji: '☸️', category: ElementCategory.TOOL, isBasic: false },
  { id: 'sword', name: '剑', emoji: '🗡️', category: ElementCategory.TOOL, isBasic: false },
  { id: 'axe', name: '斧头', emoji: '🪓', category: ElementCategory.TOOL, isBasic: false },
  { id: 'tool', name: '工具', emoji: '🔨', category: ElementCategory.TOOL, isBasic: false },
  { id: 'weapon', name: '武器', emoji: '⚔️', category: ElementCategory.TOOL, isBasic: false },
  { id: 'pottery', name: '陶器', emoji: '🏺', category: ElementCategory.TOOL, isBasic: false },
  { id: 'paper', name: '纸', emoji: '📄', category: ElementCategory.TOOL, isBasic: false },

  // 建筑 (3)
  { id: 'house', name: '房子', emoji: '🏠', category: ElementCategory.BUILDING, isBasic: false },
  { id: 'castle', name: '城堡', emoji: '🏰', category: ElementCategory.BUILDING, isBasic: false },
  { id: 'wall', name: '墙', emoji: '🏗️', category: ElementCategory.BUILDING, isBasic: false },
  { id: 'city', name: '城市', emoji: '🏙️', category: ElementCategory.BUILDING, isBasic: false },
  { id: 'temple', name: '神殿', emoji: '⛩️', category: ElementCategory.BUILDING, isBasic: false },

  // 交通 (3)
  { id: 'car', name: '汽车', emoji: '🚗', category: ElementCategory.TRANSPORT, isBasic: false },
  { id: 'boat', name: '船', emoji: '⛵', category: ElementCategory.TRANSPORT, isBasic: false },
  { id: 'airplane', name: '飞机', emoji: '✈️', category: ElementCategory.TRANSPORT, isBasic: false },

  // 科技
  { id: 'computer', name: '电脑', emoji: '💻', category: ElementCategory.TECH, isBasic: false },
  { id: 'rocket', name: '火箭', emoji: '🚀', category: ElementCategory.TECH, isBasic: false },
  { id: 'robot', name: '机器人', emoji: '🤖', category: ElementCategory.TECH, isBasic: false },
  { id: 'telescope', name: '望远镜', emoji: '🔭', category: ElementCategory.TECH, isBasic: false },
  { id: 'gunpowder', name: '火药', emoji: '💥', category: ElementCategory.TECH, isBasic: false },
  { id: 'engine', name: '引擎', emoji: '🔧', category: ElementCategory.TECH, isBasic: false },
  { id: 'explosion', name: '爆炸', emoji: '💣', category: ElementCategory.TECH, isBasic: false },
];

// ========== 组合规则 ==========

export const COMBINATION_RULES: CombinationRule[] = [
  // 基础 × 基础
  { a: 'water', b: 'fire', result: 'steam' },
  { a: 'earth', b: 'water', result: 'mud' },
  { a: 'fire', b: 'earth', result: 'lava' },
  { a: 'earth', b: 'air', result: 'dust' },
  { a: 'water', b: 'air', result: 'rain' },
  { a: 'air', b: 'fire', result: 'energy' },
  { a: 'water', b: 'water', result: 'sea' },
  { a: 'air', b: 'air', result: 'wind' },
  { a: 'rain', b: 'wind', result: 'cold' },

  // 自然衍生
  { a: 'rain', b: 'air', result: 'cloud' },
  { a: 'cloud', b: 'air', result: 'sky' },
  { a: 'cloud', b: 'water', result: 'rain' },
  { a: 'cloud', b: 'fire', result: 'lightning' },
  { a: 'rain', b: 'cold', result: 'snow' },
  { a: 'water', b: 'cold', result: 'ice' },
  { a: 'steam', b: 'earth', result: 'geyser' },
  { a: 'mud', b: 'plant', result: 'swamp' },
  { a: 'lava', b: 'water', result: 'stone' },
  { a: 'lava', b: 'air', result: 'stone' },
  { a: 'stone', b: 'stone', result: 'wall' },
  { a: 'stone', b: 'fire', result: 'metal' },
  { a: 'stone', b: 'air', result: 'sand' },
  { a: 'sand', b: 'fire', result: 'glass' },
  { a: 'sand', b: 'water', result: 'clay' },
  { a: 'stone', b: 'water', result: 'sand' },
  { a: 'stone', b: 'lightning', result: 'diamond' },
  { a: 'lava', b: 'lava', result: 'volcano' },
  { a: 'volcano', b: 'earth', result: 'mountain' },
  { a: 'rain', b: 'sun', result: 'rainbow' },
  { a: 'snow', b: 'snow', result: 'glacier' },
  { a: 'dust', b: 'water', result: 'mud' },
  { a: 'dust', b: 'fire', result: 'gunpowder' },
  { a: 'mud', b: 'fire', result: 'brick' },
  { a: 'mud', b: 'sand', result: 'clay' },
  { a: 'earth', b: 'earth', result: 'mountain' },
  { a: 'sea', b: 'wind', result: 'wave' },
  { a: 'sea', b: 'earth', result: 'island' },
  { a: 'sea', b: 'fire', result: 'salt' },

  // 能量
  { a: 'lightning', b: 'metal', result: 'electricity' },
  { a: 'energy', b: 'air', result: 'light' },
  { a: 'energy', b: 'fire', result: 'plasma' },
  { a: 'energy', b: 'energy', result: 'sun' },
  { a: 'fire', b: 'sun', result: 'star' },
  { a: 'sun', b: 'water', result: 'rainbow' },
  { a: 'lightning', b: 'lightning', result: 'storm' },
  { a: 'light', b: 'light', result: 'sun' },

  // 生命
  { a: 'energy', b: 'water', result: 'life' },
  { a: 'life', b: 'earth', result: 'bacteria' },
  { a: 'life', b: 'water', result: 'fish' },
  { a: 'life', b: 'air', result: 'bird' },
  { a: 'bacteria', b: 'water', result: 'plant' },
  { a: 'bacteria', b: 'earth', result: 'plant' },
  { a: 'plant', b: 'earth', result: 'tree' },
  { a: 'plant', b: 'sun', result: 'flower' },
  { a: 'plant', b: 'plant', result: 'seed' },
  { a: 'seed', b: 'earth', result: 'tree' },
  { a: 'seed', b: 'sun', result: 'plant' },
  { a: 'tree', b: 'fire', result: 'charcoal' },
  { a: 'tree', b: 'tool', result: 'wood' },
  { a: 'tree', b: 'life', result: 'animal' },
  { a: 'animal', b: 'air', result: 'bird' },
  { a: 'animal', b: 'water', result: 'fish' },
  { a: 'animal', b: 'animal', result: 'egg' },
  { a: 'egg', b: 'earth', result: 'dinosaur' },
  { a: 'egg', b: 'fire', result: 'dragon' },
  { a: 'dinosaur', b: 'fire', result: 'dragon' },
  { a: 'life', b: 'life', result: 'love' },
  { a: 'life', b: 'clay', result: 'human' },
  { a: 'life', b: 'mud', result: 'bacteria' },
  { a: 'tree', b: 'sun', result: 'fruit' },

  // 食物
  { a: 'plant', b: 'fire', result: 'bread' },
  { a: 'ice', b: 'water', result: 'milk' },
  { a: 'milk', b: 'bacteria', result: 'cheese' },
  { a: 'seed', b: 'fire', result: 'beer' },
  { a: 'fruit', b: 'water', result: 'wine' },
  { a: 'flower', b: 'water', result: 'honey' },
  { a: 'tree', b: 'tree', result: 'forest' },
  { a: 'plant', b: 'tree', result: 'forest' },
  { a: 'flower', b: 'flower', result: 'garden' },

  // 人类
  { a: 'human', b: 'human', result: 'love' },
  { a: 'human', b: 'weapon', result: 'warrior' },
  { a: 'human', b: 'energy', result: 'wizard' },
  { a: 'human', b: 'metal', result: 'tool' },
  { a: 'human', b: 'stone', result: 'tool' },
  { a: 'human', b: 'tree', result: 'house' },

  // 工具
  { a: 'metal', b: 'tool', result: 'weapon' },
  { a: 'metal', b: 'metal', result: 'sword' },
  { a: 'stone', b: 'tool', result: 'axe' },
  { a: 'clay', b: 'fire', result: 'pottery' },
  { a: 'wood', b: 'tool', result: 'paper' },
  { a: 'wood', b: 'wheel', result: 'car' },
  { a: 'metal', b: 'wheel', result: 'car' },
  { a: 'stone', b: 'wood', result: 'wheel' },

  // 建筑
  { a: 'brick', b: 'brick', result: 'wall' },
  { a: 'wall', b: 'wall', result: 'house' },
  { a: 'house', b: 'house', result: 'city' },
  { a: 'stone', b: 'house', result: 'castle' },
  { a: 'human', b: 'house', result: 'city' },
  { a: 'human', b: 'castle', result: 'temple' },
  { a: 'wall', b: 'brick', result: 'house' },

  // 交通
  { a: 'wood', b: 'water', result: 'boat' },
  { a: 'tree', b: 'water', result: 'boat' },
  { a: 'car', b: 'air', result: 'airplane' },
  { a: 'metal', b: 'air', result: 'airplane' },
  { a: 'metal', b: 'fire', result: 'engine' },
  { a: 'engine', b: 'wheel', result: 'car' },

  // 科技
  { a: 'electricity', b: 'metal', result: 'computer' },
  { a: 'fire', b: 'airplane', result: 'rocket' },
  { a: 'computer', b: 'human', result: 'robot' },
  { a: 'glass', b: 'metal', result: 'telescope' },
  { a: 'gunpowder', b: 'metal', result: 'weapon' },
  { a: 'gunpowder', b: 'fire', result: 'explosion' },
];

// ========== 辅助函数 ==========

/** 获取基础元素列表 */
export function getBasicElements(): ElementDef[] {
  return ALL_ELEMENTS.filter((e) => e.isBasic);
}

/** 获取基础元素 ID 列表 */
export function getBasicElementIds(): string[] {
  return getBasicElements().map((e) => e.id);
}

/** 根据 ID 获取元素定义 */
export function getElementById(id: string): ElementDef | undefined {
  return ALL_ELEMENTS.find((e) => e.id === id);
}

/** 查找两个元素的组合结果 */
export function findCombination(a: string, b: string): string | null {
  const rule = COMBINATION_RULES.find(
    (r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)
  );
  return rule?.result ?? null;
}

/** 获取所有元素总数 */
export function getTotalElementCount(): number {
  return ALL_ELEMENTS.length;
}

/** 获取所有元素 ID 列表 */
export function getAllElementIds(): string[] {
  return ALL_ELEMENTS.map((e) => e.id);
}
