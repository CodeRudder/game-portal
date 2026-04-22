/**
 * 贸易域 — 商队子系统
 *
 * 职责：商队属性/状态/派遣/护卫/自动运输
 * 规则：可引用 trade-config 和 trade.types，通过回调访问 HeroSystem
 */

import type {
  TradeRouteId,
  Caravan,
  CaravanAttributes,
  CaravanStatus,
  CaravanDispatchRequest,
  CaravanDispatchResult,
  GuardMutexCheck,
  GuardDispatchResult,
} from '../../core/trade/trade.types';
import {
  CARAVAN_STATUS_LABELS,
} from '../../core/trade/trade.types';
import {
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
  BASE_CARAVAN_ATTRIBUTES,
  GUARD_RISK_REDUCTION,
  TRADE_SAVE_VERSION,
} from '../../core/trade/trade-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 生成唯一ID */
function generateId(): string {
  return `caravan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 创建默认商队属性 */
function createDefaultAttributes(): CaravanAttributes {
  return { ...BASE_CARAVAN_ATTRIBUTES, currentLoad: 0 };
}

/** 创建初始商队 */
function createCaravan(index: number): Caravan {
  return {
    id: generateId(),
    name: `商队${index + 1}`,
    level: 1,
    attributes: createDefaultAttributes(),
    status: 'idle',
    currentRouteId: null,
    cargo: {},
    guardHeroId: null,
    departTime: 0,
    arrivalTime: 0,
  };
}

// ─────────────────────────────────────────────
// 商路信息回调（解耦 TradeSystem）
// ─────────────────────────────────────────────

export interface RouteInfoProvider {
  /** 获取商路定义 */
  getRouteDef: (routeId: TradeRouteId) => {
    opened: boolean;
    baseTravelTime: number;
    baseProfitRate: number;
    from: string;
    to: string;
  } | null;
  /** 获取商品价格 */
  getPrice: (goodsId: string) => number;
  /** 完成贸易回调 */
  completeTrade: (routeId: TradeRouteId) => void;
}

// ─────────────────────────────────────────────
// CaravanSystem
// ─────────────────────────────────────────────

export class CaravanSystem implements ISubsystem {
  readonly name = 'Caravan' as const;
  private deps: ISystemDeps | null = null;

  /** 商队列表 */
  private caravans: Map<string, Caravan>;
  /** 护卫互斥表：heroId -> caravanId */
  private guardAssignments: Map<string, string>;
  /** 商路信息提供者 */
  private routeProvider: RouteInfoProvider | null = null;

  constructor() {
    this.caravans = new Map();
    this.guardAssignments = new Map();
    // 初始化商队
    for (let i = 0; i < INITIAL_CARAVAN_COUNT; i++) {
      const caravan = createCaravan(i);
      this.caravans.set(caravan.id, caravan);
    }
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    const now = Date.now();
    for (const caravan of this.caravans.values()) {
      if (caravan.status === 'traveling' || caravan.status === 'returning') {
        if (now >= caravan.arrivalTime) {
          if (caravan.status === 'traveling') {
            caravan.status = 'trading';
            // 交易完成 -> 转入返回
            this.completeCaravanTrade(caravan);
          } else {
            // 返回完成
            caravan.status = 'idle';
            caravan.currentRouteId = null;
            caravan.cargo = {};
            caravan.departTime = 0;
            caravan.arrivalTime = 0;
          }
        }
      }
    }
  }

  getState(): Caravan[] {
    return Array.from(this.caravans.values()).map(c => ({ ...c, attributes: { ...c.attributes }, cargo: { ...c.cargo } }));
  }

  reset(): void {
    this.caravans.clear();
    this.guardAssignments.clear();
    for (let i = 0; i < INITIAL_CARAVAN_COUNT; i++) {
      const caravan = createCaravan(i);
      this.caravans.set(caravan.id, caravan);
    }
  }

  /** 注入商路信息提供者 */
  setRouteProvider(provider: RouteInfoProvider): void {
    this.routeProvider = provider;
  }

  // ─────────────────────────────────────────────
  // 商队查询
  // ─────────────────────────────────────────────

  /** 获取所有商队 */
  getCaravans(): Caravan[] {
    return this.getState();
  }

  /** 获取指定商队 */
  getCaravan(id: string): Caravan | undefined {
    const c = this.caravans.get(id);
    return c ? { ...c, attributes: { ...c.attributes }, cargo: { ...c.cargo } } : undefined;
  }

  /** 获取空闲商队 */
  getIdleCaravans(): Caravan[] {
    return Array.from(this.caravans.values())
      .filter(c => c.status === 'idle')
      .map(c => ({ ...c, attributes: { ...c.attributes }, cargo: { ...c.cargo } }));
  }

  /** 获取商队数量 */
  getCaravanCount(): number {
    return this.caravans.size;
  }

  /** 是否可以新增商队 */
  canAddCaravan(): boolean {
    return this.caravans.size < MAX_CARAVAN_COUNT;
  }

  // ─────────────────────────────────────────────
  // 商队派遣 (TRD-2)
  // ─────────────────────────────────────────────

  /** 派遣商队 */
  dispatch(request: CaravanDispatchRequest): CaravanDispatchResult {
    const caravan = this.caravans.get(request.caravanId);
    if (!caravan) {
      return { success: false, reason: '商队不存在' };
    }
    if (caravan.status !== 'idle') {
      return { success: false, reason: '商队不在待命状态' };
    }

    // 检查商路
    if (!this.routeProvider) {
      return { success: false, reason: '商路信息未初始化' };
    }
    const routeDef = this.routeProvider.getRouteDef(request.routeId);
    if (!routeDef) {
      return { success: false, reason: '商路不存在' };
    }
    if (!routeDef.opened) {
      return { success: false, reason: '商路未开通' };
    }

    // 检查载重
    let totalWeight = 0;
    for (const [goodsId, qty] of Object.entries(request.cargo)) {
      // 简单重量计算（每单位重量1）
      totalWeight += qty;
    }
    if (totalWeight > caravan.attributes.capacity) {
      return { success: false, reason: `超出载重上限${caravan.attributes.capacity}` };
    }

    // 检查护卫互斥
    if (request.guardHeroId) {
      const mutex = this.checkGuardMutex(request.guardHeroId, request.caravanId);
      if (!mutex.available) {
        return { success: false, reason: '该武将已在其他商队担任护卫' };
      }
    }

    // 计算运输时间
    const travelTime = routeDef.baseTravelTime * 1000 / caravan.attributes.speedMultiplier;
    const now = Date.now();

    // 更新商队状态
    caravan.status = 'traveling';
    caravan.currentRouteId = request.routeId;
    caravan.cargo = { ...request.cargo };
    caravan.attributes.currentLoad = totalWeight;
    caravan.departTime = now;
    caravan.arrivalTime = now + travelTime;

    // 指派护卫
    if (request.guardHeroId) {
      this.assignGuard(request.caravanId, request.guardHeroId);
    }

    // 估算利润
    let estimatedProfit = 0;
    for (const [goodsId, qty] of Object.entries(request.cargo)) {
      const price = this.routeProvider.getPrice(goodsId);
      estimatedProfit += price * qty * routeDef.baseProfitRate;
    }

    return {
      success: true,
      estimatedArrival: caravan.arrivalTime,
      estimatedProfit: Math.floor(estimatedProfit),
    };
  }

  /** 完成商队交易 */
  private completeCaravanTrade(caravan: Caravan): void {
    if (!this.routeProvider || !caravan.currentRouteId) return;

    // 通知完成贸易
    this.routeProvider.completeTrade(caravan.currentRouteId);

    // 清空货物，设置返回
    caravan.cargo = {};
    caravan.attributes.currentLoad = 0;
    caravan.status = 'returning';

    // 返回时间 = 去程的一半
    const routeDef = this.routeProvider.getRouteDef(caravan.currentRouteId);
    if (routeDef) {
      const returnTime = routeDef.baseTravelTime * 500 / caravan.attributes.speedMultiplier;
      caravan.arrivalTime = Date.now() + returnTime;
    }
  }

  // ─────────────────────────────────────────────
  // 护卫系统 (TRD-2)
  // ─────────────────────────────────────────────

  /** 检查护卫互斥 */
  checkGuardMutex(heroId: string, excludeCaravanId?: string): GuardMutexCheck {
    const assignedCaravanId = this.guardAssignments.get(heroId);
    if (assignedCaravanId && assignedCaravanId !== excludeCaravanId) {
      return { available: false, conflictCaravanId: assignedCaravanId };
    }
    return { available: true };
  }

  /** 指派护卫 */
  assignGuard(caravanId: string, heroId: string): GuardDispatchResult {
    const caravan = this.caravans.get(caravanId);
    if (!caravan) return { success: false, reason: '商队不存在' };

    // 检查互斥
    const mutex = this.checkGuardMutex(heroId, caravanId);
    if (!mutex.available) {
      return { success: false, reason: '该武将已在其他商队担任护卫' };
    }

    // 移除旧护卫
    if (caravan.guardHeroId) {
      this.guardAssignments.delete(caravan.guardHeroId);
    }

    // 指派新护卫
    caravan.guardHeroId = heroId;
    this.guardAssignments.set(heroId, caravanId);

    return { success: true, riskReduction: GUARD_RISK_REDUCTION };
  }

  /** 移除护卫 */
  removeGuard(caravanId: string): boolean {
    const caravan = this.caravans.get(caravanId);
    if (!caravan || !caravan.guardHeroId) return false;

    this.guardAssignments.delete(caravan.guardHeroId);
    caravan.guardHeroId = null;
    return true;
  }

  /** 获取护卫武将ID */
  getGuardHeroId(caravanId: string): string | null {
    return this.caravans.get(caravanId)?.guardHeroId ?? null;
  }

  /** 商队是否有护卫 */
  hasGuard(caravanId: string): boolean {
    return this.caravans.get(caravanId)?.guardHeroId !== null;
  }

  // ─────────────────────────────────────────────
  // 商队管理
  // ─────────────────────────────────────────────

  /** 新增商队 */
  addCaravan(): { success: boolean; caravan?: Caravan; reason?: string } {
    if (!this.canAddCaravan()) {
      return { success: false, reason: `商队数量已达上限${MAX_CARAVAN_COUNT}` };
    }
    const caravan = createCaravan(this.caravans.size);
    this.caravans.set(caravan.id, caravan);
    return { success: true, caravan: { ...caravan, attributes: { ...caravan.attributes } } };
  }

  /** 升级商队属性 */
  upgradeCaravan(caravanId: string, attribute: keyof CaravanAttributes, value: number): boolean {
    const caravan = this.caravans.get(caravanId);
    if (!caravan) return false;
    if (attribute === 'currentLoad') return false; // currentLoad 不可直接升级
    caravan.attributes[attribute] += value;
    return true;
  }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): { caravans: Caravan[]; version: number } {
    return {
      caravans: this.getState(),
      version: TRADE_SAVE_VERSION,
    };
  }

  deserialize(data: { caravans: Caravan[]; version: number }): void {
    if (data.version !== TRADE_SAVE_VERSION) {
      throw new Error(`[CaravanSystem] 存档版本不匹配: ${data.version}`);
    }
    this.caravans.clear();
    this.guardAssignments.clear();
    for (const c of data.caravans) {
      this.caravans.set(c.id, { ...c, attributes: { ...c.attributes }, cargo: { ...c.cargo } });
      if (c.guardHeroId) {
        this.guardAssignments.set(c.guardHeroId, c.id);
      }
    }
  }
}
