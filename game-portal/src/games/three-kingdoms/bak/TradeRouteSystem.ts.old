/**
 * 三国霸业 — 贸易路线系统
 *
 * 管理城市间贸易路线的创建、商队分配、利润计算与贸易建议。
 * 贸易商品：粮草、铜钱、铁矿、木材、药材、丝绸、陶瓷
 * 利润 = (目的地需求 - 出发地供给) × 距离系数 × 商队数量
 *
 * @module games/three-kingdoms/TradeRouteSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 贸易路线 */
export interface TradeRoute {
  id: string;
  fromCityId: string;
  toCityId: string;
  goods: string[];          // 贸易商品类型
  profit: number;           // 利润率
  isActive: boolean;
  caravanCount: number;     // 商队数量
  maxCaravans: number;
  travelTime: number;       // 旅行时间（游戏分钟）
  lastTradeTime: number;
}

/** 城市贸易信息 */
export interface CityTradeInfo {
  id: string;
  name: string;
  specialties: string[];    // 特产（供给充足）
  demands: string[];        // 需求（价格高）
  position: { x: number; y: number };
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

const ALL_GOODS = ['粮草', '铜钱', '铁矿', '木材', '药材', '丝绸', '陶瓷'];

const DEFAULT_CITIES: CityTradeInfo[] = [
  { id: 'luoyang',  name: '洛阳', specialties: ['铜钱', '陶瓷'], demands: ['药材', '木材'], position: { x: 50, y: 40 } },
  { id: 'changan',  name: '长安', specialties: ['丝绸', '粮草'], demands: ['铁矿', '药材'], position: { x: 20, y: 35 } },
  { id: 'chengdu',  name: '成都', specialties: ['粮草', '药材'], demands: ['铜钱', '陶瓷'], position: { x: 15, y: 65 } },
  { id: 'jianye',   name: '建业', specialties: ['木材', '丝绸'], demands: ['铁矿', '粮草'], position: { x: 75, y: 55 } },
  { id: 'ye',       name: '邺城', specialties: ['铁矿', '粮草'], demands: ['丝绸', '药材'], position: { x: 55, y: 25 } },
  { id: 'xiangyang',name: '襄阳', specialties: ['木材', '药材'], demands: ['铜钱', '丝绸'], position: { x: 45, y: 55 } },
  { id: 'xuchang',  name: '许昌', specialties: ['陶瓷', '粮草'], demands: ['木材', '铁矿'], position: { x: 55, y: 42 } },
  { id: 'nanyang',  name: '南阳', specialties: ['铁矿', '药材'], demands: ['丝绸', '陶瓷'], position: { x: 38, y: 50 } },
];

// ═══════════════════════════════════════════════════════════════
// 系统实现
// ═══════════════════════════════════════════════════════════════

export class TradeRouteSystem {
  private routes: Map<string, TradeRoute>;
  private cities: Map<string, CityTradeInfo>;

  constructor() {
    this.routes = new Map();
    this.cities = new Map();
    // 初始化默认城市
    for (const city of DEFAULT_CITIES) {
      this.cities.set(city.id, city);
    }
  }

  /** 计算两城之间的欧氏距离 */
  private getDistance(a: string, b: string): number {
    const cityA = this.cities.get(a);
    const cityB = this.cities.get(b);
    if (!cityA || !cityB) return 999;
    const dx = cityA.position.x - cityB.position.x;
    const dy = cityA.position.y - cityB.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 计算两城之间的贸易商品（出发地特产 ∩ 目的地需求） */
  private computeGoods(fromId: string, toId: string): string[] {
    const from = this.cities.get(fromId);
    const to = this.cities.get(toId);
    if (!from || !to) return [];
    return from.specialties.filter((g) => to.demands.includes(g));
  }

  /** 计算利润率：基础利润 × 距离系数 */
  private computeProfit(fromId: string, toId: string): number {
    const goods = this.computeGoods(fromId, toId);
    const dist = this.getDistance(fromId, toId);
    // 距离系数：越远利润越高，但有上限
    const distFactor = Math.min(dist / 20, 3.0);
    // 基础利润：匹配商品越多利润越高，即使无匹配也有基础贸易利润
    const baseProfit = goods.length > 0 ? goods.length * 15 : 5;
    return Math.round(baseProfit * distFactor);
  }

  /** 创建贸易路线（两个城市之间） */
  createRoute(fromCityId: string, toCityId: string): TradeRoute | null {
    if (fromCityId === toCityId) return null;
    if (!this.cities.has(fromCityId) || !this.cities.has(toCityId)) return null;

    // 检查是否已存在同方向路线
    const existingKey = `${fromCityId}->${toCityId}`;
    for (const route of this.routes.values()) {
      const key = `${route.fromCityId}->${route.toCityId}`;
      if (key === existingKey) return null;
    }

    const dist = this.getDistance(fromCityId, toCityId);
    const goods = this.computeGoods(fromCityId, toCityId);
    const profit = this.computeProfit(fromCityId, toCityId);

    const route: TradeRoute = {
      id: `route_${fromCityId}_${toCityId}_${Date.now()}`,
      fromCityId,
      toCityId,
      goods: goods.length > 0 ? goods : [ALL_GOODS[Math.floor(Math.random() * ALL_GOODS.length)]],
      profit,
      isActive: true,
      caravanCount: 0,
      maxCaravans: 5,
      travelTime: Math.round(dist * 2), // 距离 × 2 = 游戏分钟
      lastTradeTime: 0,
    };

    this.routes.set(route.id, route);
    return route;
  }

  /** 获取所有路线 */
  getAllRoutes(): TradeRoute[] {
    return Array.from(this.routes.values());
  }

  /** 获取城市间的路线（双向查找） */
  getRoutesBetween(cityA: string, cityB: string): TradeRoute[] {
    const result: TradeRoute[] = [];
    for (const route of this.routes.values()) {
      if (
        (route.fromCityId === cityA && route.toCityId === cityB) ||
        (route.fromCityId === cityB && route.toCityId === cityA)
      ) {
        result.push(route);
      }
    }
    return result;
  }

  /** 分配商队到指定路线 */
  assignCaravan(routeId: string): boolean {
    const route = this.routes.get(routeId);
    if (!route || !route.isActive) return false;
    if (route.caravanCount >= route.maxCaravans) return false;
    route.caravanCount++;
    return true;
  }

  /** 更新贸易（每 tick 调用） */
  updateTrade(currentTime: number, deltaTime: number): {
    totalProfit: number;
    completedTrades: number;
    details: { routeId: string; profit: number }[];
  } {
    let totalProfit = 0;
    let completedTrades = 0;
    const details: { routeId: string; profit: number }[] = [];

    for (const route of this.routes.values()) {
      if (!route.isActive || route.caravanCount === 0) continue;

      // 检查是否到达交易时间
      const elapsed = currentTime - route.lastTradeTime;
      if (elapsed >= route.travelTime && route.travelTime > 0) {
        // 计算利润 = 利润率 × 商队数量 × 时间倍率
        const tradeProfit = route.profit * route.caravanCount;
        totalProfit += tradeProfit;
        completedTrades++;
        details.push({ routeId: route.id, profit: tradeProfit });
        route.lastTradeTime = currentTime;
      }
    }

    return { totalProfit, completedTrades, details };
  }

  /** 获取贸易建议（哪些城市适合建立路线） */
  getTradeSuggestions(ownedCityIds: string[]): { from: string; to: string; estimatedProfit: number }[] {
    const suggestions: { from: string; to: string; estimatedProfit: number }[] = [];

    for (const fromId of ownedCityIds) {
      for (const [toId] of this.cities) {
        if (fromId === toId) continue;
        // 检查是否已有路线
        const existing = this.getRoutesBetween(fromId, toId);
        if (existing.length > 0) continue;

        const profit = this.computeProfit(fromId, toId);
        if (profit > 0) {
          suggestions.push({ from: fromId, to: toId, estimatedProfit: profit });
        }
      }
    }

    // 按预估利润降序排列
    suggestions.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
    return suggestions;
  }

  // ── 序列化 / 反序列化 ────────────────────────────────────

  serialize(): object {
    return {
      routes: Array.from(this.routes.entries()),
      cities: Array.from(this.cities.entries()),
    };
  }

  deserialize(data: object): void {
    const d = data as {
      routes?: [string, TradeRoute][];
      cities?: [string, CityTradeInfo][];
    };
    if (d.routes) this.routes = new Map(d.routes);
    if (d.cities) this.cities = new Map(d.cities);
  }
}
