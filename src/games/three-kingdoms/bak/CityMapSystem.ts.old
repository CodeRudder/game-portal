/**
 * 三国霸业 — 城市内地图系统
 *
 * 管理城市内部建筑布局、NPC 分配、繁荣度、人口和税收。
 * 不同领土类型（都城/城市/城镇/关卡/村庄）拥有不同的建筑组合。
 *
 * @module games/three-kingdoms/CityMapSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 城市建筑类型 */
export type CityBuildingType =
  | 'yamen'     // 衙门
  | 'residence' // 民居
  | 'shop'      // 商铺
  | 'barracks'  // 兵营
  | 'market'    // 市场
  | 'smithy'    // 铁匠铺
  | 'tavern'    // 酒馆
  | 'academy'   // 书院
  | 'clinic'    // 医馆
  | 'wall';     // 城墙

/** 城市建筑 */
export interface CityBuilding {
  id: string;
  type: CityBuildingType;
  name: string;
  level: number;
  position: { x: number; y: number };
  size: { w: number; h: number };
  npcIds: string[];
  productionPerHour: Record<string, number>;
}

/** 城市街道 */
export interface CityStreet {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** 城市地图 */
export interface CityMap {
  cityId: string;
  cityName: string;
  buildings: CityBuilding[];
  streets: CityStreet[];
  prosperity: number;  // 繁荣度 0-100
  population: number;
  taxRate: number;
}

// ═══════════════════════════════════════════════════════════════
// 建筑模板
// ═══════════════════════════════════════════════════════════════

interface BuildingTemplate {
  type: CityBuildingType;
  name: string;
  size: { w: number; h: number };
  production: Record<string, number>;
}

const BUILDING_TEMPLATES: Record<CityBuildingType, BuildingTemplate> = {
  yamen:     { type: 'yamen',     name: '衙门', size: { w: 3, h: 3 }, production: { gold: 5 } },
  residence: { type: 'residence', name: '民居', size: { w: 2, h: 2 }, production: { grain: 2 } },
  shop:      { type: 'shop',      name: '商铺', size: { w: 2, h: 2 }, production: { gold: 4 } },
  barracks:  { type: 'barracks',  name: '兵营', size: { w: 3, h: 2 }, production: { troops: 3 } },
  market:    { type: 'market',    name: '市场', size: { w: 3, h: 3 }, production: { gold: 6 } },
  smithy:    { type: 'smithy',    name: '铁匠铺', size: { w: 2, h: 2 }, production: { troops: 2 } },
  tavern:    { type: 'tavern',    name: '酒馆', size: { w: 2, h: 2 }, production: { gold: 3 } },
  academy:   { type: 'academy',   name: '书院', size: { w: 3, h: 2 }, production: { gold: 4 } },
  clinic:    { type: 'clinic',    name: '医馆', size: { w: 2, h: 2 }, production: { grain: 1 } },
  wall:      { type: 'wall',      name: '城墙', size: { w: 4, h: 1 }, production: { troops: 1 } },
};

/** 领土类型对应的建筑组合 */
const TERRITORY_BUILDINGS: Record<string, CityBuildingType[]> = {
  capital: ['yamen', 'residence', 'residence', 'residence', 'shop', 'shop', 'barracks', 'market', 'academy', 'tavern'],
  city:    ['yamen', 'residence', 'residence', 'shop', 'barracks', 'market', 'smithy'],
  town:    ['yamen', 'residence', 'shop', 'market'],
  pass:    ['barracks', 'barracks', 'wall', 'smithy'],
  village: ['residence', 'residence', 'clinic', 'market'],
};

/** 将 constants.ts 的领土 type 映射为内部类型 */
function mapTerritoryType(rawType: string): string {
  if (rawType === 'capital') return 'capital';
  if (rawType === 'desert') return 'town';
  if (rawType === 'coastal' || rawType === 'forest') return 'city';
  if (rawType === 'plains') return 'city';
  if (rawType === 'mountain') return 'pass';
  return 'town';
}

/** 领土类型对应的初始繁荣度 */
const BASE_PROSPERITY: Record<string, number> = {
  capital: 80, city: 60, town: 40, pass: 20, village: 30,
};

/** 领土类型对应的初始人口 */
const BASE_POPULATION: Record<string, number> = {
  capital: 50000, city: 30000, town: 10000, pass: 5000, village: 8000,
};

// ═══════════════════════════════════════════════════════════════
// 城市地图系统
// ═══════════════════════════════════════════════════════════════

export class CityMapSystem {
  private cityMaps: Map<string, CityMap>;

  constructor() {
    this.cityMaps = new Map();
  }

  /**
   * 根据领土信息生成城市内地图
   * @param territoryId - 领土 ID（如 'luoyang'）
   * @param territoryName - 领土名称（如 '洛阳'）
   * @param territoryType - 领土类型（如 'capital'）
   */
  generateCityMap(territoryId: string, territoryName: string, territoryType: string): CityMap {
    const type = mapTerritoryType(territoryType);
    const buildingTypes = TERRITORY_BUILDINGS[type] ?? TERRITORY_BUILDINGS['town'];
    const buildings: CityBuilding[] = [];
    const streets: CityStreet[] = [];

    // 按网格布局放置建筑：每行最多 3 栋，间距 1 格
    const colSpacing = 5;
    const rowSpacing = 4;
    let col = 0;
    let row = 0;

    buildingTypes.forEach((bType, i) => {
      const tpl = BUILDING_TEMPLATES[bType];
      const posX = col * colSpacing;
      const posY = row * rowSpacing;

      buildings.push({
        id: `${territoryId}_${bType}_${i}`,
        type: tpl.type,
        name: tpl.name,
        level: 1,
        position: { x: posX, y: posY },
        size: { ...tpl.size },
        npcIds: [],
        productionPerHour: { ...tpl.production },
      });

      // 生成连接街道（到下一栋建筑）
      if (i < buildingTypes.length - 1) {
        const nextCol = (col + 1) % 3;
        const nextRow = nextCol === 0 ? row + 1 : row;
        streets.push({
          from: { x: posX + tpl.size.w, y: posY + Math.floor(tpl.size.h / 2) },
          to: { x: nextCol * colSpacing, y: nextRow * rowSpacing + 1 },
        });
      }

      col++;
      if (col >= 3) { col = 0; row++; }
    });

    const cityMap: CityMap = {
      cityId: territoryId,
      cityName: territoryName,
      buildings,
      streets,
      prosperity: BASE_PROSPERITY[type] ?? 40,
      population: BASE_POPULATION[type] ?? 10000,
      taxRate: 0.1,
    };

    this.cityMaps.set(territoryId, cityMap);
    return cityMap;
  }

  /** 获取指定城市地图 */
  getCityMap(territoryId: string): CityMap | undefined {
    return this.cityMaps.get(territoryId);
  }

  /** 获取所有城市 */
  getAllCities(): CityMap[] {
    return Array.from(this.cityMaps.values());
  }

  /**
   * 更新城市状态（繁荣度增长、人口增长、税收累积）
   * @param deltaTime - 经过的现实秒数
   */
  updateCity(cityId: string, deltaTime: number): void {
    const city = this.cityMaps.get(cityId);
    if (!city) return;

    // 繁荣度缓慢增长（每小时 +0.5，上限 100）
    const hoursElapsed = deltaTime / 3600;
    const buildingBonus = city.buildings.length * 0.1;
    city.prosperity = Math.min(100, city.prosperity + (0.5 + buildingBonus) * hoursElapsed);

    // 人口随繁荣度增长
    const growthRate = (city.prosperity / 100) * 0.02; // 每小时 0-2%
    city.population = Math.floor(city.population * (1 + growthRate * hoursElapsed));
  }

  /**
   * 计算城市每小时税收
   * 税收 = 人口 × 税率 × 繁荣度系数
   */
  getCityTax(cityId: string): Record<string, number> {
    const city = this.cityMaps.get(cityId);
    if (!city) return {};

    const prosperityFactor = city.prosperity / 100;
    const baseGold = Math.floor(city.population * city.taxRate * prosperityFactor);
    const baseGrain = Math.floor(baseGold * 0.5);

    // 建筑额外产出
    const extraGold = city.buildings.reduce((sum, b) => sum + (b.productionPerHour.gold ?? 0) * b.level, 0);
    const extraGrain = city.buildings.reduce((sum, b) => sum + (b.productionPerHour.grain ?? 0) * b.level, 0);
    const extraTroops = city.buildings.reduce((sum, b) => sum + (b.productionPerHour.troops ?? 0) * b.level, 0);

    return {
      gold: baseGold + extraGold,
      grain: baseGrain + extraGrain,
      troops: extraTroops,
    };
  }

  /** 序列化 */
  serialize(): object {
    const entries: Record<string, CityMap> = {};
    this.cityMaps.forEach((v, k) => { entries[k] = v; });
    return { cityMaps: entries };
  }

  /** 反序列化 */
  deserialize(data: object): void {
    const d = data as { cityMaps?: Record<string, CityMap> };
    this.cityMaps.clear();
    if (d.cityMaps) {
      Object.entries(d.cityMaps).forEach(([k, v]) => {
        this.cityMaps.set(k, v);
      });
    }
  }
}
