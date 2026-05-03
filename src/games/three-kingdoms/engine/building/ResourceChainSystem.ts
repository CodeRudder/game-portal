/**
 * BLD-F28 资源链循环显式系统
 *
 * 6 条链路的显式定义、验证和瓶颈检测。
 * 本系统不替代现有的隐式链路，而是在其之上提供可视化诊断能力。
 */

import type { BuildingType } from '../../shared/types';
import type { BuildingSystem } from './BuildingSystem';

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 链路节点：描述一个建筑在链路中的角色 */
export interface ChainNode {
  buildingType: BuildingType;
  /** 该节点消耗的资源类型 */
  resourceIn: string[];
  /** 该节点产出的资源类型 */
  resourceOut: string[];
  /** 产出速率（由建筑等级动态计算，定义中为 0） */
  rate: number;
}

/** 一条资源链路 */
export interface ResourceChain {
  id: string;           // F28-01 ~ F28-06
  name: string;
  nodes: ChainNode[];
  bottlenecks: string[];
}

/** 链路验证结果 */
export interface ChainValidationResult {
  valid: boolean;
  bottlenecks: string[];
  throughput: number;
}

/** 全链路验证结果 */
export type AllChainsValidation = Record<string, {
  valid: boolean;
  bottlenecks: string[];
}>;

/** 瓶颈报告 */
export interface BottleneckReport {
  chainId: string;
  bottleneck: string;
  suggestion: string;
}

// ─────────────────────────────────────────────
// 2. 6 条链路静态定义
// ─────────────────────────────────────────────

const CHAIN_DEFINITIONS: ResourceChain[] = [
  {
    id: 'F28-01',
    name: '粮草→兵力→战斗链',
    nodes: [
      { buildingType: 'farmland', resourceIn: [], resourceOut: ['grain'], rate: 0 },
      { buildingType: 'barracks', resourceIn: ['grain'], resourceOut: ['troops'], rate: 0 },
    ],
    bottlenecks: [],
  },
  {
    id: 'F28-02',
    name: '矿石+木材→装备→英雄链',
    nodes: [
      { buildingType: 'mine', resourceIn: [], resourceOut: ['ore'], rate: 0 },
      { buildingType: 'lumberMill', resourceIn: [], resourceOut: ['wood'], rate: 0 },
      { buildingType: 'workshop', resourceIn: ['ore', 'wood', 'gold'], resourceOut: ['equipment'], rate: 0 },
    ],
    bottlenecks: [],
  },
  {
    id: 'F28-03',
    name: '铜钱→贸易→折扣链',
    nodes: [
      { buildingType: 'market', resourceIn: [], resourceOut: ['gold'], rate: 0 },
      { buildingType: 'port', resourceIn: ['gold'], resourceOut: ['prosperity', 'tradeDiscount'], rate: 0 },
    ],
    bottlenecks: [],
  },
  {
    id: 'F28-04',
    name: '科技点→科技→加成链',
    nodes: [
      { buildingType: 'academy', resourceIn: [], resourceOut: ['techPoint'], rate: 0 },
    ],
    bottlenecks: [],
  },
  {
    id: 'F28-05',
    name: '铜钱+粮草→招募→英雄链',
    nodes: [
      { buildingType: 'farmland', resourceIn: [], resourceOut: ['grain'], rate: 0 },
      { buildingType: 'market', resourceIn: [], resourceOut: ['gold'], rate: 0 },
      { buildingType: 'tavern', resourceIn: ['grain', 'gold'], resourceOut: ['hero'], rate: 0 },
    ],
    bottlenecks: [],
  },
  {
    id: 'F28-06',
    name: '矿石+木材→城防链',
    nodes: [
      { buildingType: 'mine', resourceIn: [], resourceOut: ['ore'], rate: 0 },
      { buildingType: 'lumberMill', resourceIn: [], resourceOut: ['wood'], rate: 0 },
      { buildingType: 'wall', resourceIn: ['ore', 'wood'], resourceOut: ['defense'], rate: 0 },
    ],
    bottlenecks: [],
  },
];

// ─────────────────────────────────────────────
// 3. ResourceChainSystem
// ─────────────────────────────────────────────

export class ResourceChainSystem {
  private chains: Map<string, ResourceChain>;
  private buildingSystem: BuildingSystem | null = null;
  private resourceSystem: unknown | null = null;

  constructor() {
    this.chains = new Map();
    for (const def of CHAIN_DEFINITIONS) {
      this.chains.set(def.id, {
        ...def,
        nodes: def.nodes.map(n => ({ ...n })),
        bottlenecks: [],
      });
    }
  }

  // ── 依赖注入 ──

  /** 注入建筑系统，用于读取建筑等级和产出 */
  setBuildingSystem(bs: BuildingSystem): void {
    this.buildingSystem = bs;
  }

  /** 注入资源系统（预留扩展） */
  setResourceSystem(rs: unknown): void {
    this.resourceSystem = rs;
  }

  // ── 链路定义读取 ──

  /** 获取 6 条链路定义（含当前动态速率） */
  getChainDefinitions(): ResourceChain[] {
    const result: ResourceChain[] = [];
    for (const chain of this.chains.values()) {
      result.push({
        ...chain,
        nodes: chain.nodes.map(n => {
          const rate = this.resolveNodeRate(n);
          return { ...n, rate };
        }),
      });
    }
    return result;
  }

  /** 根据 ID 获取单条链路定义 */
  getChain(chainId: string): ResourceChain | undefined {
    const chain = this.chains.get(chainId);
    if (!chain) return undefined;
    return {
      ...chain,
      nodes: chain.nodes.map(n => ({ ...n, rate: this.resolveNodeRate(n) })),
    };
  }

  // ── 验证 ──

  /** 验证单条链路是否畅通 */
  validateChain(chainId: string): ChainValidationResult {
    const chain = this.chains.get(chainId);
    if (!chain) {
      return { valid: false, bottlenecks: [`链路 ${chainId} 不存在`], throughput: 0 };
    }

    const bottlenecks: string[] = [];
    let throughput = Infinity;

    for (const node of chain.nodes) {
      const level = this.getNodeLevel(node.buildingType);
      const rate = this.resolveNodeRate(node);

      // 建筑未建造（等级 0）
      if (level <= 0) {
        bottlenecks.push(`${node.buildingType} 未建造`);
        throughput = 0;
        continue;
      }

      // 产出节点：检查速率
      if (node.resourceOut.length > 0 && node.resourceIn.length === 0) {
        // 源头产出节点
        if (rate <= 0) {
          bottlenecks.push(`${node.buildingType} 产出为 0`);
        }
        throughput = Math.min(throughput, rate);
      } else if (node.resourceIn.length > 0) {
        // 消耗节点：检查上游产出是否满足消耗
        const upstreamOk = this.checkUpstreamSupply(chain, node);
        if (!upstreamOk) {
          bottlenecks.push(`${node.buildingType} 上游资源不足`);
        }
        // 消耗节点的吞吐受限于自身等级
        throughput = Math.min(throughput, rate || level);
      }
    }

    if (throughput === Infinity) throughput = 0;

    return {
      valid: bottlenecks.length === 0,
      bottlenecks,
      throughput,
    };
  }

  /** 验证所有链路 */
  validateAllChains(): AllChainsValidation {
    const result: AllChainsValidation = {};
    for (const chainId of this.chains.keys()) {
      const v = this.validateChain(chainId);
      result[chainId] = {
        valid: v.valid,
        bottlenecks: v.bottlenecks,
      };
    }
    return result;
  }

  // ── 瓶颈检测 ──

  /** 检测所有链路瓶颈并给出建议 */
  detectBottlenecks(): BottleneckReport[] {
    const reports: BottleneckReport[] = [];

    for (const [chainId, chain] of this.chains) {
      // 收集所有节点等级
      const nodeLevels = chain.nodes.map(n => ({
        type: n.buildingType,
        level: this.getNodeLevel(n.buildingType),
        isSource: n.resourceIn.length === 0,
      }));

      // 策略 1：源头节点等级远高于消耗节点 → 资源过剩
      const sources = nodeLevels.filter(n => n.isSource && n.level > 0);
      const consumers = nodeLevels.filter(n => !n.isSource);

      for (const consumer of consumers) {
        for (const source of sources) {
          if (source.level > consumer.level * 2 && consumer.level > 0) {
            reports.push({
              chainId,
              bottleneck: `${source.type} Lv${source.level} 远高于 ${consumer.type} Lv${consumer.level}，资源过剩`,
              suggestion: `升级 ${consumer.type} 以消耗过剩资源`,
            });
          }
        }
      }

      // 策略 2：消耗节点存在但源头节点过低 → 供给不足
      for (const consumer of consumers) {
        if (consumer.level <= 0) continue;
        for (const source of sources) {
          if (source.level <= 0) {
            reports.push({
              chainId,
              bottleneck: `${source.type} 未建造，${consumer.type} 缺少上游供给`,
              suggestion: `建造或升级 ${source.type}`,
            });
          } else if (consumer.level > source.level * 2) {
            reports.push({
              chainId,
              bottleneck: `${consumer.type} Lv${consumer.level} 远高于 ${source.type} Lv${source.level}，供给不足`,
              suggestion: `升级 ${source.type} 以提高上游产出`,
            });
          }
        }
      }

      // 策略 3：所有节点等级 0 → 链路完全未启动
      if (nodeLevels.every(n => n.level <= 0)) {
        reports.push({
          chainId,
          bottleneck: `链路 ${chainId}（${chain.name}）完全未启动`,
          suggestion: `优先建造 ${chain.nodes[0].buildingType} 启动链路`,
        });
      }
    }

    return reports;
  }

  // ── 吞吐量计算 ──

  /** 计算单条链路吞吐量（取瓶颈节点的产出） */
  calculateThroughput(chainId: string): number {
    return this.validateChain(chainId).throughput;
  }

  // ── 序列化 ──

  serialize(): string {
    const data: Record<string, { bottlenecks: string[] }> = {};
    for (const [id, chain] of this.chains) {
      data[id] = { bottlenecks: chain.bottlenecks };
    }
    return JSON.stringify(data);
  }

  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data) as Record<string, { bottlenecks: string[] }>;
      for (const [id, val] of Object.entries(parsed)) {
        const chain = this.chains.get(id);
        if (chain) {
          chain.bottlenecks = val.bottlenecks ?? [];
        }
      }
    } catch {
      // 反序列化失败时保持当前状态
    }
  }

  /** 重置为初始状态 */
  reset(): void {
    for (const chain of this.chains.values()) {
      chain.bottlenecks = [];
    }
  }

  // ── 内部辅助 ──

  /** 获取建筑等级 */
  private getNodeLevel(buildingType: BuildingType): number {
    if (!this.buildingSystem) return 0;
    return this.buildingSystem.getLevel(buildingType);
  }

  /** 解析节点产出速率 */
  private resolveNodeRate(node: ChainNode): number {
    if (!this.buildingSystem) return 0;
    const level = this.getNodeLevel(node.buildingType);
    if (level <= 0) return 0;
    // 使用 BuildingSystem 的 getProduction 获取产出值
    return this.buildingSystem.getProduction(node.buildingType, level);
  }

  /** 检查上游产出是否满足当前节点消耗 */
  private checkUpstreamSupply(chain: ResourceChain, node: ChainNode): boolean {
    const nodeIndex = chain.nodes.indexOf(node);
    if (nodeIndex < 0) return false;

    // 收集上游所有产出
    const upstreamOutputs = new Map<string, number>();
    for (let i = 0; i < nodeIndex; i++) {
      const upstream = chain.nodes[i];
      const rate = this.resolveNodeRate(upstream);
      for (const res of upstream.resourceOut) {
        upstreamOutputs.set(res, (upstreamOutputs.get(res) ?? 0) + rate);
      }
    }

    // 检查每个消耗的资源是否有上游供给
    for (const needed of node.resourceIn) {
      const supply = upstreamOutputs.get(needed) ?? 0;
      if (supply <= 0) {
        // 某些资源可能来自链路外部（如 gold 由 market 产出但可能不在同一上游节点）
        // 只要建筑存在且等级 > 0 就算通过
        const level = this.getNodeLevel(node.buildingType);
        if (level <= 0) return false;
      }
    }

    return true;
  }
}
