/**
 * NPC AI 有限状态机
 *
 * 为每个 NPC 实例提供独立的 AI 决策逻辑。
 * 根据职业、日程、周围环境做出行为决策。
 *
 * AI 行为规则（按职业）：
 * - 农民:  早上去农田 → 中午休息 → 下午继续 → 傍晚回家 → 夜间休息
 * - 士兵:  沿城墙巡逻 → 检查可疑目标 → 训练 → 休息
 * - 商人:  在市场摆摊 → 与顾客交谈 → 补货 → 收摊回家
 * - 武将:  训练士兵 → 巡视领地 → 制定策略 → 休息
 * - 工匠:  在工坊锻造 → 交付产品 → 休息
 * - 书生:  在书院读书 → 与其他书生讨论 → 散步
 * - 村民:  闲逛 → 与邻居聊天 → 做家务 → 休息
 *
 * @module engine/npc/NPCAI
 */

import type {
  NPCInstance,
  NPCDef,
  NPCTask,
  NPCDirection,
} from './types';
import { NPCState } from './types';
import type { NPCEventBus } from './NPCEventBus';

/** 各职业闲聊话题池 */
const CHAT_TOPICS: Record<string, string[]> = {
  farmer: ['今天的庄稼长得不错', '希望能有个好收成', '需要更多水源'],
  soldier: ['最近边境不太平', '要加强训练', '注意巡逻路线'],
  merchant: ['最近生意怎么样', '这批货不错', '价格可以商量'],
  general: ['兵马未动粮草先行', '士气很重要', '要制定新策略'],
  craftsman: ['这把武器快打造好了', '需要更好的材料', '工艺需要精益求精'],
  scholar: ['最近在读一本好书', '这个问题值得讨论', '学无止境'],
  villager: ['今天天气不错', '听说有新鲜事', '日子过得真快'],
};

/** NPC 交互概率（每秒） */
const INTERACTION_PROBABILITY = 0.02;

export class NPCAI {
  private npc: NPCInstance;
  private def: NPCDef;
  private stateTimer: number;
  private eventBus: NPCEventBus;

  /** 闲聊冷却计时器 */
  private chatCooldown: number;

  constructor(npc: NPCInstance, def: NPCDef, eventBus: NPCEventBus) {
    this.npc = npc;
    this.def = def;
    this.stateTimer = 0;
    this.chatCooldown = 0;
    this.eventBus = eventBus;
  }

  /**
   * 每帧更新 NPC AI
   * @param deltaTime - 帧间隔（秒）
   * @param gameTime - 游戏内时间（小时，0~24 浮点数）
   * @param nearbyNPCs - 附近的 NPC 实例列表
   */
  update(deltaTime: number, gameTime: number, nearbyNPCs: NPCInstance[]): void {
    // 更新计时器
    this.stateTimer += deltaTime;
    this.chatCooldown = Math.max(0, this.chatCooldown - deltaTime);
    this.npc.dialogueCooldown = Math.max(0, this.npc.dialogueCooldown - deltaTime);
    this.npc.animTimer += deltaTime;

    // 动画帧切换（每 0.3 秒）
    if (this.npc.animTimer > 0.3) {
      this.npc.animTimer = 0;
      this.npc.animFrame = (this.npc.animFrame + 1) % 4;
    }

    // 检查日程（高优先级）
    const scheduledTask = this.checkSchedule(gameTime);
    if (scheduledTask && !this.npc.currentTask) {
      this.npc.currentTask = scheduledTask;
      if (scheduledTask.type === 'move') {
        this.transitionTo(NPCState.MOVING_TO_TARGET);
      } else if (scheduledTask.type === 'work') {
        this.transitionTo(NPCState.WORKING);
      } else if (scheduledTask.type === 'patrol') {
        this.transitionTo(NPCState.PATROLLING);
      } else if (scheduledTask.type === 'rest') {
        this.transitionTo(NPCState.RESTING);
      } else {
        this.transitionTo(NPCState.IDLE);
      }
    }

    // 处理当前任务
    if (this.npc.currentTask) {
      this.processTask(deltaTime);
    }

    // 根据当前状态处理行为
    switch (this.npc.state) {
      case NPCState.IDLE:
        this.handleIdle(deltaTime, nearbyNPCs);
        break;
      case NPCState.WALKING:
      case NPCState.MOVING_TO_TARGET:
        this.handleWalking(deltaTime);
        break;
      case NPCState.WORKING:
        this.handleWorking(deltaTime);
        break;
      case NPCState.PATROLLING:
        this.handlePatrolling(deltaTime);
        break;
      case NPCState.TALKING:
        this.handleTalking(deltaTime);
        break;
      case NPCState.RESTING:
        // 休息状态：等待日程变更
        break;
    }

    // 尝试与附近 NPC 交互
    if (this.chatCooldown <= 0 && nearbyNPCs.length > 0) {
      const interaction = this.decideInteraction(nearbyNPCs);
      if (interaction) {
        this.npc.currentTask = interaction;
      }
    }
  }

  /** 状态转换，触发事件 */
  private transitionTo(newState: NPCState): void {
    const oldState = this.npc.state;
    if (oldState === newState) return;
    this.npc.state = newState;
    this.stateTimer = 0;
    this.eventBus.emit('npcStateChange', this.npc, oldState, newState);
  }

  /** 处理待机状态 */
  private handleIdle(_dt: number, nearby: NPCInstance[]): void {
    // 待机超过 3 秒后尝试寻找事情做
    if (this.stateTimer > 3) {
      // 优先与附近 NPC 交谈
      if (nearby.length > 0 && Math.random() < INTERACTION_PROBABILITY * 50) {
        const target = nearby[Math.floor(Math.random() * nearby.length)];
        this.npc.currentTask = {
          id: `talk_${this.npc.id}_${Date.now()}`,
          type: 'talk',
          targetNpcId: target.id,
          progress: 0,
          duration: 3,
        };
        this.transitionTo(NPCState.TALKING);
        return;
      }
      // 否则随机走动
      const dx = Math.floor(Math.random() * 5) - 2;
      const dy = Math.floor(Math.random() * 5) - 2;
      if (dx !== 0 || dy !== 0) {
        this.npc.currentTask = {
          id: `walk_${this.npc.id}_${Date.now()}`,
          type: 'move',
          targetX: this.npc.x + dx,
          targetY: this.npc.y + dy,
          progress: 0,
          duration: Math.sqrt(dx * dx + dy * dy) / this.def.speed,
        };
        this.transitionTo(NPCState.WALKING);
      }
    }
  }

  /** 处理行走状态 */
  private handleWalking(_dt: number): void {
    if (!this.npc.currentTask) {
      this.transitionTo(NPCState.IDLE);
      return;
    }
    // 移动逻辑由 NPCManager 统一处理 path following
    // AI 只负责状态判断
  }

  /** 处理工作状态 */
  private handleWorking(_dt: number): void {
    // 工作动画由 animFrame 驱动
  }

  /** 处理巡逻状态 */
  private handlePatrolling(_dt: number): void {
    // 巡逻路径由任务指定
  }

  /** 处理对话状态 */
  private handleTalking(dt: number): void {
    if (this.stateTimer > 5) {
      // 对话超时，回到待机
      this.npc.currentTask = null;
      this.transitionTo(NPCState.IDLE);
    }
  }

  /** 处理当前任务进度 */
  private processTask(dt: number): void {
    const task = this.npc.currentTask!;
    task.progress += dt / task.duration;

    if (task.progress >= 1) {
      // 任务完成
      this.npc.currentTask = null;
      this.transitionTo(NPCState.IDLE);
    }
  }

  /** 根据日程决定行为 */
  private checkSchedule(gameTime: number): NPCTask | null {
    const hour = Math.floor(gameTime) % 24;

    // 找到当前时间对应的日程项
    let bestItem = this.def.schedule[0] ?? null;
    for (const item of this.def.schedule) {
      if (item.hour <= hour) {
        bestItem = item;
      }
    }

    if (!bestItem) return null;

    // 如果已经在对应状态，不重复创建任务
    if (this.npc.state === bestItem.state) return null;

    const task: NPCTask = {
      id: `sched_${this.npc.id}_${hour}`,
      type: bestItem.state === 'working' ? 'work' :
            bestItem.state === 'patrolling' ? 'patrol' :
            bestItem.state === 'resting' ? 'rest' : 'move',
      progress: 0,
      duration: this.def.workCycleMinutes * 60,
    };

    if (bestItem.targetX !== undefined) {
      task.targetX = bestItem.targetX;
    }
    if (bestItem.targetY !== undefined) {
      task.targetY = bestItem.targetY;
    }
    if (bestItem.targetBuildingId) {
      task.targetBuildingId = bestItem.targetBuildingId;
    }

    return task;
  }

  /** NPC 间交互决策 */
  private decideInteraction(nearby: NPCInstance[]): NPCTask | null {
    if (Math.random() > INTERACTION_PROBABILITY) return null;

    const target = nearby[Math.floor(Math.random() * nearby.length)];

    // 触发 NPC 间交谈事件
    const profession = this.def.profession;
    const topics = CHAT_TOPICS[profession] ?? CHAT_TOPICS.villager;
    const topic = topics[Math.floor(Math.random() * topics.length)];

    this.chatCooldown = 10; // 10 秒冷却
    this.eventBus.emit('npcChat', this.npc, target, topic);

    return {
      id: `chat_${this.npc.id}_${target.id}`,
      type: 'talk',
      targetNpcId: target.id,
      progress: 0,
      duration: 3,
    };
  }

  /** 获取当前状态 */
  getState(): NPCState {
    return this.npc.state;
  }

  /** 获取当前任务 */
  getCurrentTask(): NPCTask | null {
    return this.npc.currentTask;
  }

  /** 更新 NPC 实例引用（用于反序列化后重新绑定） */
  bindInstance(npc: NPCInstance): void {
    this.npc = npc;
  }
}
