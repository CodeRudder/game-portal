/**
 * NPC 管理器
 *
 * 管理所有 NPC 实例的生命周期，包括注册定义、生成实例、
 * 每帧更新、对话管理、组队协作、序列化等。
 *
 * @module engine/npc/NPCManager
 */

import type {
  NPCDef,
  NPCInstance,
  NPCState,
  NPCDirection,
  NPCTask,
  NPCDialogue,
  DialogueLine,
  DialogueChoice,
  NPCTeam,
  PathFinder,
} from './types';
import { NPCState as NPCStateEnum } from './types';
import { NPCAI } from './NPCAI';
import { NPCEventBus } from './NPCEventBus';

/** NPC ID 自增计数器 */
let npcIdCounter = 0;

/** 团队 ID 自增计数器 */
let teamIdCounter = 0;

/** 生成唯一 NPC ID */
function generateNPCId(): string {
  return `npc_${++npcIdCounter}`;
}

/** 生成唯一团队 ID */
function generateTeamId(): string {
  return `team_${++teamIdCounter}`;
}

export class NPCManager {
  /** NPC 定义模板 */
  private defs: Map<string, NPCDef> = new Map();
  /** NPC 运行时实例 */
  private npcs: Map<string, NPCInstance> = new Map();
  /** NPC AI 控制器 */
  private ais: Map<string, NPCAI> = new Map();
  /** NPC 团队 */
  private teams: Map<string, NPCTeam> = new Map();
  /** 事件总线 */
  private eventBus: NPCEventBus;
  /** 寻路器（可选，由外部注入） */
  private pathFinder: PathFinder | null = null;

  constructor() {
    this.eventBus = new NPCEventBus();
  }

  // -----------------------------------------------------------------------
  // 定义管理
  // -----------------------------------------------------------------------

  /**
   * 注册 NPC 定义模板
   * @param def - NPC 定义
   */
  registerDef(def: NPCDef): void {
    this.defs.set(def.id, def);
  }

  /**
   * 获取 NPC 定义
   * @param defId - 定义 ID
   */
  getDef(defId: string): NPCDef | undefined {
    return this.defs.get(defId);
  }

  // -----------------------------------------------------------------------
  // NPC 生成
  // -----------------------------------------------------------------------

  /**
   * 生成单个 NPC 实例
   * @param defId - NPC 定义 ID
   * @param x - 初始 X 坐标
   * @param y - 初始 Y 坐标
   * @param name - 可选自定义名称
   * @returns NPC 实例
   */
  spawnNPC(defId: string, x: number, y: number, name?: string): NPCInstance {
    const def = this.defs.get(defId);
    if (!def) {
      throw new Error(`[NPCManager] NPC definition not found: ${defId}`);
    }

    const id = generateNPCId();
    const instance: NPCInstance = {
      id,
      defId,
      name: name ?? def.name,
      x,
      y,
      state: NPCStateEnum.IDLE,
      direction: 'down' as NPCDirection,
      profession: def.profession,
      level: 1,
      health: 100,
      maxHealth: 100,
      currentTask: null,
      path: [],
      pathIndex: 0,
      targetId: null,
      friends: [],
      teamId: null,
      activeDialogueId: null,
      dialogueCooldown: 0,
      animFrame: 0,
      animTimer: 0,
    };

    this.npcs.set(id, instance);
    this.ais.set(id, new NPCAI(instance, def, this.eventBus));

    return instance;
  }

  /**
   * 批量生成 NPC 实例
   * @param configs - 生成配置列表
   * @returns NPC 实例数组
   */
  spawnNPCs(configs: { defId: string; x: number; y: number; name?: string }[]): NPCInstance[] {
    return configs.map((c) => this.spawnNPC(c.defId, c.x, c.y, c.name));
  }

  // -----------------------------------------------------------------------
  // 更新循环
  // -----------------------------------------------------------------------

  /**
   * 每帧更新所有 NPC
   * @param deltaTime - 帧间隔（秒）
   * @param gameTime - 游戏内时间（小时，0~24 浮点数）
   */
  update(deltaTime: number, gameTime: number): void {
    for (const [id, ai] of this.ais) {
      const npc = this.npcs.get(id);
      if (!npc) continue;

      // 获取附近 NPC
      const nearby = this.getNearbyNPCs(npc.x, npc.y, 3);

      // 更新 AI
      ai.update(deltaTime, gameTime, nearby);

      // 处理移动
      if (npc.currentTask && (npc.currentTask.targetX !== undefined || npc.currentTask.targetY !== undefined)) {
        this.updateMovement(npc, deltaTime);
      }
    }
  }

  /** 更新 NPC 移动（沿路径或直线） */
  private updateMovement(npc: NPCInstance, dt: number): void {
    const task = npc.currentTask!;
    const targetX = task.targetX ?? npc.x;
    const targetY = task.targetY ?? npc.y;

    // 如果有寻路器，使用寻路
    if (this.pathFinder && npc.path.length === 0) {
      const path = this.pathFinder.findPath(npc.x, npc.y, targetX, targetY);
      if (path.length > 0) {
        npc.path = path;
        npc.pathIndex = 0;
      }
    }

    // 沿路径移动
    if (npc.path.length > 0 && npc.pathIndex < npc.path.length) {
      const nextPoint = npc.path[npc.pathIndex];
      const dx = nextPoint.x - npc.x;
      const dy = nextPoint.y - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        npc.x = nextPoint.x;
        npc.y = nextPoint.y;
        npc.pathIndex++;
      } else {
        const speed = 2; // 格/秒
        const step = Math.min(speed * dt, dist);
        npc.x += (dx / dist) * step;
        npc.y += (dy / dist) * step;
        this.updateDirection(npc, dx, dy);
      }
    } else {
      // 直线移动
      const dx = targetX - npc.x;
      const dy = targetY - npc.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        npc.x = targetX;
        npc.y = targetY;
      } else {
        const speed = 2;
        const step = Math.min(speed * dt, dist);
        npc.x += (dx / dist) * step;
        npc.y += (dy / dist) * step;
        this.updateDirection(npc, dx, dy);
      }
    }
  }

  /** 根据移动方向更新朝向 */
  private updateDirection(npc: NPCInstance, dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      npc.direction = dx > 0 ? 'right' : 'left';
    } else {
      npc.direction = dy > 0 ? 'down' : 'up';
    }
  }

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  /**
   * 获取指定范围内的 NPC
   * @param x - 中心 X 坐标
   * @param y - 中心 Y 坐标
   * @param range - 搜索半径（格）
   * @returns 范围内的 NPC 列表
   */
  getNearbyNPCs(x: number, y: number, range: number): NPCInstance[] {
    const result: NPCInstance[] = [];
    for (const npc of this.npcs.values()) {
      const dx = npc.x - x;
      const dy = npc.y - y;
      if (dx * dx + dy * dy <= range * range) {
        result.push(npc);
      }
    }
    return result;
  }

  /** 获取所有 NPC 实例 */
  getAllNPCs(): NPCInstance[] {
    return Array.from(this.npcs.values());
  }

  /** 获取指定 NPC */
  getNPC(id: string): NPCInstance | undefined {
    return this.npcs.get(id);
  }

  // -----------------------------------------------------------------------
  // 寻路器
  // -----------------------------------------------------------------------

  /** 设置寻路器 */
  setPathFinder(pathFinder: PathFinder): void {
    this.pathFinder = pathFinder;
  }

  // -----------------------------------------------------------------------
  // 对话系统
  // -----------------------------------------------------------------------

  /**
   * 开始 NPC 对话
   * @param npcId - NPC ID
   * @param trigger - 触发方式
   * @returns 匹配的对话定义，或 null
   */
  startDialogue(npcId: string, trigger: string): NPCDialogue | null {
    const npc = this.npcs.get(npcId);
    if (!npc) return null;
    if (npc.dialogueCooldown > 0) return null;

    const def = this.defs.get(npc.defId);
    if (!def) return null;

    // 查找匹配触发条件的对话
    const dialogue = def.dialogues.find((d) => d.trigger === trigger);
    if (!dialogue) return null;

    npc.activeDialogueId = dialogue.id;
    npc.state = NPCStateEnum.TALKING;

    this.eventBus.emit('npcDialogue', npc, dialogue);
    return dialogue;
  }

  /**
   * 选择对话选项
   * @param npcId - NPC ID
   * @param choiceIndex - 选项索引
   * @returns 下一行对话，或 null 表示对话结束
   */
  makeDialogueChoice(npcId: string, choiceIndex: number): DialogueLine | null {
    const npc = this.npcs.get(npcId);
    if (!npc || !npc.activeDialogueId) return null;

    const def = this.defs.get(npc.defId);
    if (!def) return null;

    const dialogue = def.dialogues.find((d) => d.id === npc.activeDialogueId);
    if (!dialogue || dialogue.lines.length === 0) return null;

    // 简化：取第一行的选项
    const firstLine = dialogue.lines[0];
    if (!firstLine?.choices || choiceIndex >= firstLine.choices.length) {
      // 结束对话
      npc.activeDialogueId = null;
      npc.dialogueCooldown = 5;
      npc.state = NPCStateEnum.IDLE;
      return null;
    }

    const choice: DialogueChoice = firstLine.choices[choiceIndex];

    // 执行选项效果
    if (choice.action) {
      this.eventBus.emit('dialogueAction', npc, choice.action);
    }

    // 跳转到指定行或结束
    if (choice.nextLineIndex !== undefined && choice.nextLineIndex < dialogue.lines.length) {
      return dialogue.lines[choice.nextLineIndex];
    }

    // 结束对话
    npc.activeDialogueId = null;
    npc.dialogueCooldown = 5;
    npc.state = NPCStateEnum.IDLE;
    return null;
  }

  // -----------------------------------------------------------------------
  // 组队系统
  // -----------------------------------------------------------------------

  /**
   * 组建 NPC 团队
   * @param leaderId - 队长 NPC ID
   * @param memberIds - 成员 NPC ID 列表
   * @param task - 团队任务
   * @returns 团队实例
   */
  formTeam(leaderId: string, memberIds: string[], task: NPCTask): NPCTeam {
    const teamId = generateTeamId();
    const allMemberIds = [leaderId, ...memberIds];

    const team: NPCTeam = {
      id: teamId,
      leaderId,
      memberIds: allMemberIds,
      task,
      formed: true,
    };

    // 为每个成员设置 teamId
    for (const memberId of allMemberIds) {
      const npc = this.npcs.get(memberId);
      if (npc) {
        npc.teamId = teamId;
      }
    }

    // 更新任务为协作类型
    task.type = 'collaborate';
    task.collaborationNpcIds = allMemberIds;

    this.teams.set(teamId, team);
    this.eventBus.emit('npcCollaborate', allMemberIds.map((id) => this.npcs.get(id)).filter(Boolean) as NPCInstance[], task);

    return team;
  }

  /**
   * 解散团队
   * @param teamId - 团队 ID
   */
  disbandTeam(teamId: string): void {
    const team = this.teams.get(teamId);
    if (!team) return;

    // 清除成员的 teamId
    for (const memberId of team.memberIds) {
      const npc = this.npcs.get(memberId);
      if (npc) {
        npc.teamId = null;
      }
    }

    this.teams.delete(teamId);
  }

  // -----------------------------------------------------------------------
  // NPC 间交谈
  // -----------------------------------------------------------------------

  /** 尝试让两个 NPC 交谈 */
  private tryNPCChat(npc1: NPCInstance, npc2: NPCInstance): void {
    if (npc1.state === NPCStateEnum.TALKING || npc2.state === NPCStateEnum.TALKING) return;
    if (npc1.dialogueCooldown > 0 || npc2.dialogueCooldown > 0) return;

    const topics = ['天气', '工作', '生活', '新闻'];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    this.eventBus.emit('npcChat', npc1, npc2, topic);
  }

  // -----------------------------------------------------------------------
  // 事件监听
  // -----------------------------------------------------------------------

  /**
   * 注册事件监听
   * @param event - 事件名称
   * @param callback - 回调函数
   */
  on(event: string, callback: Function): void {
    this.eventBus.on(event, callback);
  }

  // -----------------------------------------------------------------------
  // 序列化 / 反序列化
  // -----------------------------------------------------------------------

  /** 序列化所有 NPC 状态 */
  serialize(): object {
    return {
      npcs: Array.from(this.npcs.entries()).map(([id, npc]) => [id, { ...npc }]),
      teams: Array.from(this.teams.entries()).map(([id, team]) => [id, { ...team }]),
      npcIdCounter,
      teamIdCounter,
    };
  }

  /** 反序列化恢复 NPC 状态 */
  deserialize(data: Record<string, unknown>): void {
    const d = data as {
      npcs: [string, NPCInstance][];
      teams: [string, NPCTeam][];
      npcIdCounter: number;
      teamIdCounter: number;
    };

    // 恢复 NPC 实例
    this.npcs.clear();
    this.ais.clear();
    for (const [id, npcData] of d.npcs) {
      const npc = npcData as NPCInstance;
      this.npcs.set(id, npc);

      // 重建 AI
      const def = this.defs.get(npc.defId);
      if (def) {
        const ai = new NPCAI(npc, def, this.eventBus);
        this.ais.set(id, ai);
      }
    }

    // 恢复团队
    this.teams.clear();
    for (const [id, teamData] of d.teams) {
      this.teams.set(id, teamData as NPCTeam);
    }

    // 恢复计数器
    if (typeof d.npcIdCounter === 'number') {
      npcIdCounter = d.npcIdCounter;
    }
    if (typeof d.teamIdCounter === 'number') {
      teamIdCounter = d.teamIdCounter;
    }
  }

  // -----------------------------------------------------------------------
  // 清理
  // -----------------------------------------------------------------------

  /** 移除指定 NPC */
  removeNPC(id: string): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;

    // 如果在团队中，解散团队
    if (npc.teamId) {
      this.disbandTeam(npc.teamId);
    }

    this.npcs.delete(id);
    this.ais.delete(id);
    return true;
  }

  /** 清空所有 NPC */
  clear(): void {
    this.npcs.clear();
    this.ais.clear();
    this.teams.clear();
    this.eventBus.clear();
  }
}
