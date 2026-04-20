/**
 * 科技域 — 离线研究系统
 *
 * 职责：离线期间研究继续进展，效率随时间衰减；回归时计算离线进度并生成回归面板数据
 * 规则：可引用 TechTreeSystem、TechResearchSystem、TechPointSystem 和 tech.types
 *
 * 效率衰减分段：
 *   0 ~ 2h   → 100% 效率
 *   2 ~ 8h   →  70% 效率
 *   8 ~ 24h  →  40% 效率
 *  > 24h     →  20% 效率
 *  封顶 72h
 *
 * @module engine/tech/TechOfflineSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { ResearchSlot } from './tech.types';
import type {
  OfflineTechProgress,
  OfflineResearchPanel,
  OfflineResearchSaveData,
  ResearchSnapshotItem,
  OfflineResearchState,
  EfficiencyCurvePoint,
} from '../../core/tech/offline-research.types';
import {
  OFFLINE_RESEARCH_DECAY_TIERS,
  MAX_OFFLINE_RESEARCH_SECONDS,
} from '../../core/tech/offline-research.types';
import type { TechTreeSystem } from './TechTreeSystem';
import type { TechResearchSystem } from './TechResearchSystem';
import { TECH_NODE_MAP } from './tech-config';

// ─────────────────────────────────────────────
// TechOfflineSystem
// ─────────────────────────────────────────────

export class TechOfflineSystem implements ISubsystem {
  readonly name = 'tech-offline' as const;
  private deps: ISystemDeps | null = null;

  /** 离线开始时间戳（ms） */
  private offlineStartTime: number | null = null;
  /** 离线开始时的研究队列快照 */
  private researchSnapshot: ResearchSnapshotItem[] = [];
  /** 上次回归面板数据 */
  private lastPanelData: OfflineResearchPanel | null = null;

  /** 依赖的科技树系统 */
  private readonly treeSystem: TechTreeSystem;
  /** 依赖的研究系统 */
  private readonly researchSystem: TechResearchSystem;

  constructor(
    treeSystem: TechTreeSystem,
    researchSystem: TechResearchSystem,
  ) {
    this.treeSystem = treeSystem;
    this.researchSystem = researchSystem;
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 离线研究系统不需要每帧更新
    // 离线进度在 onGoOffline / onComeBackOnline 时一次性计算
  }

  getState(): OfflineResearchState {
    return {
      isOffline: this.offlineStartTime !== null,
      offlineStartTime: this.offlineStartTime,
      researchSnapshot: [...this.researchSnapshot],
      lastPanelData: this.lastPanelData,
    };
  }

  reset(): void {
    this.offlineStartTime = null;
    this.researchSnapshot = [];
    this.lastPanelData = null;
  }

  // ─────────────────────────────────────────
  // 离线/上线生命周期
  // ─────────────────────────────────────────

  /**
   * 玩家离线时调用
   *
   * 记录当前时间戳和研究队列快照，用于后续离线进度计算。
   * 应在游戏暂停/保存时调用。
   *
   * @param timestamp - 离线时间戳（ms），默认 Date.now()
   */
  onGoOffline(timestamp: number = Date.now()): void {
    this.offlineStartTime = timestamp;
    this.researchSnapshot = this.captureResearchSnapshot();
  }

  /**
   * 玩家回归时调用
   *
   * 计算离线期间的研究进度，应用效率衰减，完成已结束的科技，
   * 并生成回归面板数据。
   *
   * @param timestamp - 回归时间戳（ms），默认 Date.now()
   * @returns 回归面板数据，如果没有活跃研究则返回 null
   */
  onComeBackOnline(timestamp: number = Date.now()): OfflineResearchPanel | null {
    if (this.offlineStartTime === null || this.researchSnapshot.length === 0) {
      this.offlineStartTime = null;
      this.researchSnapshot = [];
      return null;
    }

    const offlineMs = timestamp - this.offlineStartTime;
    const offlineSeconds = Math.min(
      Math.max(0, Math.floor(offlineMs / 1000)),
      MAX_OFFLINE_RESEARCH_SECONDS,
    );

    if (offlineSeconds <= 0) {
      this.offlineStartTime = null;
      this.researchSnapshot = [];
      return null;
    }

    // 计算各科技的离线进度
    const techProgressList = this.calculateOfflineProgress(
      this.researchSnapshot,
      offlineSeconds,
    );

    // 应用进度到研究系统
    this.applyOfflineProgress(techProgressList);

    // 生成效率曲线
    const efficiencyCurve = this.generateEfficiencyCurve(offlineSeconds);

    // 计算综合效率
    const overallEfficiency = this.calculateOverallEfficiency(offlineSeconds);

    // 收集完成的科技 ID
    const completedTechIds = techProgressList
      .filter((p) => p.completed)
      .map((p) => p.techId);

    // 生成回归面板
    const panel: OfflineResearchPanel = {
      offlineSeconds,
      offlineTimeText: this.formatOfflineTime(offlineSeconds),
      overallEfficiency,
      techProgressList,
      completedTechIds,
      efficiencyCurve,
    };

    // 保存面板数据并清除离线状态
    this.lastPanelData = panel;
    this.offlineStartTime = null;
    this.researchSnapshot = [];

    // 发出事件
    this.deps?.eventBus.emit('tech:offlineResearchCompleted', {
      offlineSeconds,
      completedCount: completedTechIds.length,
      completedTechIds,
    });

    return panel;
  }

  // ─────────────────────────────────────────
  // 离线进度计算（纯函数风格）
  // ─────────────────────────────────────────

  /**
   * 计算有效研究秒数（应用效率衰减）
   *
   * 根据分段衰减表，逐段计算有效研究时间。
   * 每段有效时间 = 实际时间 × 该段效率。
   *
   * @param offlineSeconds - 离线秒数
   * @returns 有效研究秒数
   */
  calculateEffectiveSeconds(offlineSeconds: number): number {
    const clamped = Math.min(Math.max(0, offlineSeconds), MAX_OFFLINE_RESEARCH_SECONDS);
    if (clamped <= 0) return 0;

    let remaining = clamped;
    let prevTierEnd = 0;
    let effectiveSeconds = 0;

    for (const tier of OFFLINE_RESEARCH_DECAY_TIERS) {
      if (remaining <= 0) break;

      const tierDuration = Math.min(remaining, tier.endSeconds - prevTierEnd);
      effectiveSeconds += tierDuration * tier.efficiency;
      remaining -= tierDuration;
      prevTierEnd = tier.endSeconds;
    }

    return effectiveSeconds;
  }

  /**
   * 计算综合效率
   *
   * 综合效率 = 有效秒数 / 实际秒数。
   *
   * @param offlineSeconds - 离线秒数
   * @returns 综合效率（0~1），保留4位小数
   */
  calculateOverallEfficiency(offlineSeconds: number): number {
    const clamped = Math.min(Math.max(0, offlineSeconds), MAX_OFFLINE_RESEARCH_SECONDS);
    if (clamped <= 0) return 0;

    const effective = this.calculateEffectiveSeconds(clamped);
    return Math.round((effective / clamped) * 10000) / 10000;
  }

  /**
   * 计算各科技的离线进度
   *
   * 对每个快照中的研究项，根据有效研究秒数计算进度增量。
   *
   * @param snapshot - 研究队列快照
   * @param offlineSeconds - 离线秒数
   * @returns 各科技的离线进度列表
   */
  calculateOfflineProgress(
    snapshot: ResearchSnapshotItem[],
    offlineSeconds: number,
  ): OfflineTechProgress[] {
    const effectiveSeconds = this.calculateEffectiveSeconds(offlineSeconds);
    const results: OfflineTechProgress[] = [];

    for (const item of snapshot) {
      const def = TECH_NODE_MAP.get(item.techId);
      if (!def) continue;

      const totalDurationMs = item.endTime - item.startTime;
      if (totalDurationMs <= 0) continue;

      const totalDurationSec = totalDurationMs / 1000;

      // 离线前的进度
      const elapsedBeforeOffline = Math.max(0, (this.offlineStartTime ?? item.startTime) - item.startTime) / 1000;
      const progressBefore = Math.min(1, elapsedBeforeOffline / totalDurationSec);

      // 离线期间的有效进度增量
      const progressDelta = effectiveSeconds / totalDurationSec;
      const progressAfter = Math.min(1, progressBefore + progressDelta);
      const actualDelta = progressAfter - progressBefore;

      const completed = progressAfter >= 1;
      const remainingSeconds = completed
        ? 0
        : Math.max(0, totalDurationSec * (1 - progressAfter));

      results.push({
        techId: item.techId,
        techName: def.name,
        progressBefore,
        progressAfter,
        progressDelta: actualDelta,
        completed,
        remainingSeconds,
      });
    }

    return results;
  }

  // ─────────────────────────────────────────
  // 效率曲线生成
  // ─────────────────────────────────────────

  /**
   * 生成效率曲线采样点
   *
   * 用于回归面板的效率衰减图表渲染。
   * 在每个分段边界生成采样点，边界处效率跳变为下一段的效率。
   *
   * @param offlineSeconds - 离线秒数
   * @returns 效率曲线采样点列表
   */
  generateEfficiencyCurve(offlineSeconds: number): EfficiencyCurvePoint[] {
    const clamped = Math.min(Math.max(0, offlineSeconds), MAX_OFFLINE_RESEARCH_SECONDS);
    const points: EfficiencyCurvePoint[] = [{ seconds: 0, efficiency: 1.0 }];

    if (clamped <= 0) return points;

    for (let i = 0; i < OFFLINE_RESEARCH_DECAY_TIERS.length; i++) {
      const tier = OFFLINE_RESEARCH_DECAY_TIERS[i];
      const tierEnd = Math.min(tier.endSeconds, clamped);

      // 分段内的终点：如果恰好到达此分段终点，显示下一段效率（效率衰减）
      if (tierEnd >= clamped) {
        // 离线时长在此分段内或恰好在边界
        const nextTier = OFFLINE_RESEARCH_DECAY_TIERS[i + 1];
        if (tierEnd === tier.endSeconds && nextTier) {
          // 恰好在分段边界，显示跳变到下一段
          points.push({ seconds: tierEnd, efficiency: nextTier.efficiency });
        } else {
          // 在分段中间结束
          points.push({ seconds: clamped, efficiency: tier.efficiency });
        }
      } else {
        // 添加分段边界点（显示跳变到下一段效率）
        const nextTier = OFFLINE_RESEARCH_DECAY_TIERS[i + 1];
        points.push({ seconds: tierEnd, efficiency: nextTier?.efficiency ?? tier.efficiency });
      }

      // 如果已经到达离线时长，停止
      if (tierEnd >= clamped) break;
    }

    return points;
  }

  /**
   * 获取指定离线时刻的效率
   *
   * @param seconds - 离线秒数
   * @returns 效率百分比（0~1）
   */
  getEfficiencyAtTime(seconds: number): number {
    for (const tier of OFFLINE_RESEARCH_DECAY_TIERS) {
      if (seconds <= tier.endSeconds) {
        return tier.efficiency;
      }
    }
    // 超过最后一段（72h），使用最后一段的效率
    return OFFLINE_RESEARCH_DECAY_TIERS[OFFLINE_RESEARCH_DECAY_TIERS.length - 1].efficiency;
  }

  // ─────────────────────────────────────────
  // 进度应用
  // ─────────────────────────────────────────

  /**
   * 将离线进度应用到研究系统
   *
   * 完成已结束的科技，更新未完成科技的 endTime。
   *
   * @param progressList - 离线进度列表
   */
  private applyOfflineProgress(progressList: OfflineTechProgress[]): void {
    for (const progress of progressList) {
      if (progress.completed) {
        // 科技研究完成：通知科技树
        this.treeSystem.completeNode(progress.techId);
      }
      // 未完成的科技：研究系统会在下次 update 时自动更新进度
      // endTime 不变，Date.now() 已经推进，进度自然增长
    }
  }

  // ─────────────────────────────────────────
  // 快照
  // ─────────────────────────────────────────

  /**
   * 捕获当前研究队列快照
   *
   * @returns 研究队列快照列表
   */
  private captureResearchSnapshot(): ResearchSnapshotItem[] {
    const queue: ResearchSlot[] = this.researchSystem.getQueue();
    return queue.map((slot) => ({
      techId: slot.techId,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  }

  // ─────────────────────────────────────────
  // 工具方法
  // ─────────────────────────────────────────

  /**
   * 格式化离线时间为可读字符串
   *
   * @param seconds - 离线秒数
   * @returns 格式化后的时间字符串
   */
  formatOfflineTime(seconds: number): string {
    if (seconds <= 0) return '刚刚';
    if (seconds < 60) return `${Math.floor(seconds)}秒`;

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remainHours = hours % 24;
      return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`;
    }

    if (hours > 0) {
      const remainMinutes = minutes % 60;
      return remainMinutes > 0 ? `${hours}小时${remainMinutes}分钟` : `${hours}小时`;
    }

    return `${minutes}分钟`;
  }

  // ─────────────────────────────────────────
  // 查询
  // ─────────────────────────────────────────

  /** 是否处于离线状态 */
  isOffline(): boolean {
    return this.offlineStartTime !== null;
  }

  /** 获取离线开始时间 */
  getOfflineStartTime(): number | null {
    return this.offlineStartTime;
  }

  /** 获取上次回归面板数据 */
  getLastPanelData(): OfflineResearchPanel | null {
    return this.lastPanelData;
  }

  /** 获取效率百分比（0~100） */
  getEfficiencyPercent(offlineSeconds: number): number {
    return Math.round(this.calculateOverallEfficiency(offlineSeconds) * 100);
  }

  // ─────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────

  /** 序列化 */
  serialize(): OfflineResearchSaveData {
    return {
      offlineStartTime: this.offlineStartTime,
      researchSnapshot: [...this.researchSnapshot],
    };
  }

  /** 反序列化 */
  deserialize(data: OfflineResearchSaveData): void {
    this.offlineStartTime = data.offlineStartTime ?? null;
    this.researchSnapshot = data.researchSnapshot?.map((s) => ({ ...s })) ?? [];
    this.lastPanelData = null;
  }
}
