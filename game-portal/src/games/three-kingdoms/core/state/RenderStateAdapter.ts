/**
 * 渲染状态适配器
 *
 * L1 内核层与 L4 渲染层之间的桥接模块。
 * 将 IGameState 转换为渲染器可消费的 IRenderState，
 * 实现渲染逻辑与游戏逻辑的完全隔离。
 *
 * 设计原则：
 *   - L1 层不依赖任何上层（不 import engine/, ui/, rendering/）
 *   - 脏检查机制避免不必要的渲染更新
 *   - 订阅/通知模式支持多个渲染器同时监听
 *
 * @module core/state/RenderStateAdapter
 */

import type { IGameState } from '../types/state';
import type { Unsubscribe } from '../types/events';

// ─────────────────────────────────────────────
// 渲染状态接口
// ─────────────────────────────────────────────

/** 建筑渲染数据 */
export interface IBuildingRenderData {
  level: number;
  state: string;
  progress: number;
}

/** 资源渲染数据 */
export interface IResourceRenderData {
  amount: number;
  cap: number;
  rate: number;
}

/** 渲染特效数据 */
export interface IRenderEffect {
  type: string;
  data: unknown;
}

/** 渲染层消费的标准化状态快照 */
export interface IRenderState {
  buildings: Map<string, IBuildingRenderData>;
  resources: Map<string, IResourceRenderData>;
  effects: IRenderEffect[];
  timestamp: number;
}

/** L4 渲染层与 L1 内核层的交互协议 */
export interface IRenderStateAdapter {
  getRenderState(): IRenderState;
  subscribe(callback: (state: IRenderState) => void): Unsubscribe;
  markDirty(): void;
}

// ─────────────────────────────────────────────
// 状态提取器
// ─────────────────────────────────────────────

export type BuildingExtractor = (subsystemState: unknown) => Map<string, IBuildingRenderData>;
export type ResourceExtractor = (subsystemState: unknown) => Map<string, IResourceRenderData>;
export type EffectExtractor = (subsystemState: unknown) => IRenderEffect[];

interface ExtractorEntry {
  building?: BuildingExtractor;
  resource?: ResourceExtractor;
  effect?: EffectExtractor;
}

/** 默认建筑提取器：从 buildings 数组中读取 */
const defaultBuildingExtractor: BuildingExtractor = (state) => {
  const result = new Map<string, IBuildingRenderData>();
  if (typeof state === 'object' && state !== null && 'buildings' in state) {
    const buildings = (state as { buildings: unknown[] }).buildings;
    if (Array.isArray(buildings)) {
      for (const b of buildings) {
        if (b && typeof b === 'object' && 'id' in b) {
          const o = b as Record<string, unknown>;
          result.set(String(o.id), {
            level: typeof o.level === 'number' ? o.level : 0,
            state: typeof o.state === 'string' ? o.state : 'idle',
            progress: typeof o.progress === 'number' ? o.progress : 0,
          });
        }
      }
    }
  }
  return result;
};

/** 默认资源提取器：从 resources 对象中读取 */
const defaultResourceExtractor: ResourceExtractor = (state) => {
  const result = new Map<string, IResourceRenderData>();
  if (typeof state === 'object' && state !== null && 'resources' in state) {
    const resources = (state as { resources: Record<string, unknown> }).resources;
    if (resources && typeof resources === 'object') {
      for (const [key, val] of Object.entries(resources)) {
        if (val && typeof val === 'object') {
          const o = val as Record<string, unknown>;
          result.set(key, {
            amount: typeof o.amount === 'number' ? o.amount : 0,
            cap: typeof o.cap === 'number' ? o.cap : 0,
            rate: typeof o.rate === 'number' ? o.rate : 0,
          });
        }
      }
    }
  }
  return result;
};

/** 默认特效提取器：从 effects 数组中读取 */
const defaultEffectExtractor: EffectExtractor = (state) => {
  if (typeof state === 'object' && state !== null && 'effects' in state) {
    const effects = (state as { effects: unknown }).effects;
    if (Array.isArray(effects)) {
      return effects.filter(
        (e): e is IRenderEffect =>
          e !== null && typeof e === 'object' && 'type' in e,
      );
    }
  }
  return [];
};

// ─────────────────────────────────────────────
// 脏检查
// ─────────────────────────────────────────────

/** 浅层比较两个 IRenderState */
function isEqualRenderState(a: IRenderState, b: IRenderState): boolean {
  if (a === b) return true;
  if (a.timestamp !== b.timestamp) return false;
  if (a.effects.length !== b.effects.length) return false;
  for (let i = 0; i < a.effects.length; i++) {
    if (a.effects[i].type !== b.effects[i].type || a.effects[i].data !== b.effects[i].data) return false;
  }
  if (a.buildings.size !== b.buildings.size) return false;
  for (const [key, val] of a.buildings) {
    const o = b.buildings.get(key);
    if (!o || val.level !== o.level || val.state !== o.state || val.progress !== o.progress) return false;
  }
  if (a.resources.size !== b.resources.size) return false;
  for (const [key, val] of a.resources) {
    const o = b.resources.get(key);
    if (!o || val.amount !== o.amount || val.cap !== o.cap || val.rate !== o.rate) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// RenderStateAdapter
// ─────────────────────────────────────────────

/**
 * 渲染状态适配器
 *
 * 将 IGameState 转换为渲染层可消费的 IRenderState。
 * 支持自定义提取器注册、脏检查和订阅/通知模式。
 */
export class RenderStateAdapter implements IRenderStateAdapter {
  private readonly gameState: IGameState;
  private readonly extractors = new Map<string, ExtractorEntry>();
  private readonly listeners = new Set<(state: IRenderState) => void>();
  private lastRenderState: IRenderState | null = null;
  private notifying = false;

  constructor(gameState: IGameState) {
    this.gameState = gameState;
  }

  /** 注册子系统状态提取器 */
  registerExtractors(name: string, entry: ExtractorEntry): void {
    this.extractors.set(name, { ...entry });
  }

  /** 移除子系统状态提取器 */
  removeExtractors(name: string): void {
    this.extractors.delete(name);
  }

  /** 获取当前渲染状态 */
  getRenderState(): IRenderState {
    const buildings = new Map<string, IBuildingRenderData>();
    const resources = new Map<string, IResourceRenderData>();
    const effects: IRenderEffect[] = [];

    // 已注册提取器的子系统
    for (const [name, entry] of this.extractors) {
      const ss = this.gameState.subsystems[name];
      if (ss === undefined) continue;
      if (entry.building) for (const [k, v] of entry.building(ss)) buildings.set(k, v);
      if (entry.resource) for (const [k, v] of entry.resource(ss)) resources.set(k, v);
      if (entry.effect) effects.push(...entry.effect(ss));
    }

    // 未注册提取器的子系统使用默认提取器
    for (const [name, ss] of Object.entries(this.gameState.subsystems)) {
      if (this.extractors.has(name) || ss === undefined) continue;
      for (const [k, v] of defaultBuildingExtractor(ss)) buildings.set(k, v);
      for (const [k, v] of defaultResourceExtractor(ss)) resources.set(k, v);
      effects.push(...defaultEffectExtractor(ss));
    }

    return { buildings, resources, effects, timestamp: this.gameState.timestamp };
  }

  /** 订阅渲染状态变更 */
  subscribe(callback: (state: IRenderState) => void): Unsubscribe {
    this.listeners.add(callback);
    let done = false;
    return () => { if (!done) { done = true; this.listeners.delete(callback); } };
  }

  /** 标记脏，执行脏检查后通知监听器 */
  markDirty(): void {
    if (this.notifying) return;
    const newState = this.getRenderState();
    if (this.lastRenderState && isEqualRenderState(this.lastRenderState, newState)) return;
    this.lastRenderState = newState;
    this.notifyListeners(newState);
  }

  /** 清理所有监听器、缓存和提取器 */
  dispose(): void {
    this.listeners.clear();
    this.lastRenderState = null;
    this.extractors.clear();
    this.notifying = false;
  }

  /** 通知所有监听器，异常隔离 */
  private notifyListeners(state: IRenderState): void {
    this.notifying = true;
    try {
      for (const fn of this.listeners) {
        try { fn(state); } catch (e) { console.warn('[RenderStateAdapter] Listener error:', e); }
      }
    } finally { this.notifying = false; }
  }
}

/** 创建渲染状态适配器 */
export function createRenderStateAdapter(gameState: IGameState): RenderStateAdapter {
  return new RenderStateAdapter(gameState);
}
