/**
 * 联盟任务系统 — 引擎层
 *
 * 职责：每日联盟任务管理、个人贡献、联盟经验奖励
 * 规则：
 *   - 每日3个联盟任务（全员共享进度）
 *   - 个人贡献：参与即获得贡献值
 *   - 完成奖励：联盟经验 + 个人公会币
 *
 * @module engine/alliance/AllianceTaskSystem
 */

import type {
  AllianceTaskDef,
  AllianceTaskInstance,
  AllianceTaskConfig,
  AllianceData,
  AlliancePlayerState,
} from '../../core/alliance/alliance.types';
import { AllianceTaskStatus, AllianceTaskType } from '../../core/alliance/alliance.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认任务配置 */
export const DEFAULT_TASK_CONFIG: AllianceTaskConfig = {
  dailyTaskCount: 3,
  resetHour: 0,
};

/** 预定义联盟任务池 */
export const ALLIANCE_TASK_POOL: AllianceTaskDef[] = [
  {
    id: 'at_1', name: '全员集结', description: '联盟成员累计登录10次',
    taskType: AllianceTaskType.SHARED, targetCount: 10,
    allianceExpReward: 100, guildCoinReward: 15,
  },
  {
    id: 'at_2', name: '资源援助', description: '联盟成员累计捐献资源1000单位',
    taskType: AllianceTaskType.SHARED, targetCount: 1000,
    allianceExpReward: 150, guildCoinReward: 20,
  },
  {
    id: 'at_3', name: 'Boss猎人', description: '联盟成员累计对Boss造成50000伤害',
    taskType: AllianceTaskType.SHARED, targetCount: 50000,
    allianceExpReward: 200, guildCoinReward: 25,
  },
  {
    id: 'at_4', name: '竞技高手', description: '联盟成员累计竞技胜利20次',
    taskType: AllianceTaskType.SHARED, targetCount: 20,
    allianceExpReward: 120, guildCoinReward: 18,
  },
  {
    id: 'at_5', name: '远征先锋', description: '联盟成员累计完成远征15次',
    taskType: AllianceTaskType.SHARED, targetCount: 15,
    allianceExpReward: 130, guildCoinReward: 20,
  },
  {
    id: 'at_6', name: '建设达人', description: '联盟成员累计升级建筑10次',
    taskType: AllianceTaskType.PERSONAL, targetCount: 10,
    allianceExpReward: 80, guildCoinReward: 12,
  },
  {
    id: 'at_7', name: '科技研究', description: '联盟成员累计研究科技5次',
    taskType: AllianceTaskType.PERSONAL, targetCount: 5,
    allianceExpReward: 100, guildCoinReward: 15,
  },
  {
    id: 'at_8', name: '招募英才', description: '联盟成员累计招募武将8次',
    taskType: AllianceTaskType.PERSONAL, targetCount: 8,
    allianceExpReward: 90, guildCoinReward: 14,
  },
];

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 从任务池中随机抽取N个任务 */
function pickRandomTasks(pool: AllianceTaskDef[], count: number): AllianceTaskDef[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** 创建任务实例 */
function createTaskInstance(def: AllianceTaskDef): AllianceTaskInstance {
  return {
    defId: def.id,
    currentProgress: 0,
    status: AllianceTaskStatus.ACTIVE,
    claimedPlayers: new Set<string>(),
  };
}

// ─────────────────────────────────────────────
// AllianceTaskSystem 类
// ─────────────────────────────────────────────

/**
 * 联盟任务系统
 *
 * 管理每日联盟任务的生成、进度更新、完成奖励
 */
export class AllianceTaskSystem {
  private config: AllianceTaskConfig;
  private taskPool: AllianceTaskDef[];
  private activeTasks: AllianceTaskInstance[];

  constructor(
    config?: Partial<AllianceTaskConfig>,
    taskPool?: AllianceTaskDef[],
  ) {
    this.config = { ...DEFAULT_TASK_CONFIG, ...config };
    this.taskPool = taskPool ?? [...ALLIANCE_TASK_POOL];
    this.activeTasks = [];
  }

  // ── 任务生成 ──────────────────────────────

  /**
   * 每日刷新任务
   */
  dailyRefresh(): AllianceTaskInstance[] {
    const selected = pickRandomTasks(this.taskPool, this.config.dailyTaskCount);
    this.activeTasks = selected.map(createTaskInstance);
    return [...this.activeTasks];
  }

  // ── 任务进度 ──────────────────────────────

  /**
   * 更新任务进度
   */
  updateProgress(taskDefId: string, progress: number): AllianceTaskInstance | null {
    const task = this.activeTasks.find(t => t.defId === taskDefId);
    if (!task) return null;
    if (task.status !== AllianceTaskStatus.ACTIVE) return task;

    task.currentProgress += progress;

    // 检查是否完成
    const def = this.taskPool.find(d => d.id === taskDefId);
    if (def && task.currentProgress >= def.targetCount) {
      task.status = AllianceTaskStatus.COMPLETED;
      task.currentProgress = def.targetCount;
    }

    return { ...task };
  }

  /**
   * 记录个人贡献
   */
  recordContribution(
    alliance: AllianceData,
    playerState: AlliancePlayerState,
    playerId: string,
    contribution: number,
  ): { alliance: AllianceData; playerState: AlliancePlayerState } {
    const member = alliance.members[playerId];
    if (!member) throw new Error('不是联盟成员');

    const updatedMembers = {
      ...alliance.members,
      [playerId]: {
        ...member,
        dailyContribution: member.dailyContribution + contribution,
        totalContribution: member.totalContribution + contribution,
      },
    };

    return {
      alliance: { ...alliance, members: updatedMembers },
      playerState: {
        ...playerState,
        guildCoins: playerState.guildCoins + contribution,
        dailyContribution: playerState.dailyContribution + contribution,
      },
    };
  }

  // ── 任务奖励 ──────────────────────────────

  /**
   * 领取任务奖励
   */
  claimTaskReward(
    taskDefId: string,
    alliance: AllianceData,
    playerState: AlliancePlayerState,
    playerId: string,
  ): { alliance: AllianceData; playerState: AlliancePlayerState; expGained: number; coinGained: number } {
    const task = this.activeTasks.find(t => t.defId === taskDefId);
    if (!task) throw new Error('任务不存在');
    if (task.status !== AllianceTaskStatus.COMPLETED) throw new Error('任务未完成');
    if (task.claimedPlayers.has(playerId)) throw new Error('已领取奖励');

    const def = this.taskPool.find(d => d.id === taskDefId);
    if (!def) throw new Error('任务定义不存在');

    task.claimedPlayers.add(playerId);

    return {
      alliance: {
        ...alliance,
        experience: alliance.experience + def.allianceExpReward,
      },
      playerState: {
        ...playerState,
        guildCoins: playerState.guildCoins + def.guildCoinReward,
      },
      expGained: def.allianceExpReward,
      coinGained: def.guildCoinReward,
    };
  }

  // ── 查询 ──────────────────────────────

  /**
   * 获取当前任务列表
   */
  getActiveTasks(): AllianceTaskInstance[] {
    return [...this.activeTasks];
  }

  /**
   * 序列化任务列表为 JSON 安全格式
   * 将 claimedPlayers (Set<string>) 转为 string[]
   */
  serializeTasks(): Array<Omit<AllianceTaskInstance, 'claimedPlayers'> & { claimedPlayers: string[] }> {
    return this.activeTasks.map(task => ({
      defId: task.defId,
      currentProgress: task.currentProgress,
      status: task.status,
      claimedPlayers: Array.from(task.claimedPlayers),
    }));
  }

  /**
   * 从 JSON 数据恢复任务列表
   * 将 claimedPlayers (string[]) 转回 Set<string>
   */
  deserializeTasks(data: Array<{ defId: string; currentProgress: number; status: AllianceTaskStatus; claimedPlayers: string[] }>): void {
    this.activeTasks = data.map(item => ({
      defId: item.defId,
      currentProgress: item.currentProgress,
      status: item.status,
      claimedPlayers: new Set(item.claimedPlayers),
    }));
  }

  /**
   * 获取任务定义
   */
  getTaskDef(defId: string): AllianceTaskDef | undefined {
    return this.taskPool.find(d => d.id === defId);
  }

  /**
   * 获取任务进度信息
   */
  getTaskProgress(taskDefId: string): {
    current: number;
    target: number;
    percent: number;
    status: AllianceTaskStatus;
  } | null {
    const task = this.activeTasks.find(t => t.defId === taskDefId);
    if (!task) return null;

    const def = this.taskPool.find(d => d.id === taskDefId);
    const target = def?.targetCount ?? 0;

    return {
      current: task.currentProgress,
      target,
      percent: target > 0 ? Math.min(100, (task.currentProgress / target) * 100) : 0,
      status: task.status,
    };
  }

  /**
   * 获取已完成任务数
   */
  getCompletedCount(): number {
    return this.activeTasks.filter(t => t.status === AllianceTaskStatus.COMPLETED).length;
  }

  /**
   * 获取配置
   */
  getConfig(): AllianceTaskConfig {
    return { ...this.config };
  }

  /**
   * 获取任务池
   */
  getTaskPool(): AllianceTaskDef[] {
    return [...this.taskPool];
  }
}
