/**
 * NPC 系统通用类型定义
 *
 * 定义 NPC 系统的所有核心数据结构，包括职业、状态、
 * 任务、对话、日程、事件等。不依赖具体游戏逻辑。
 *
 * @module engine/npc/types
 */

// ---------------------------------------------------------------------------
// NPC 职业（Profession）
// ---------------------------------------------------------------------------

/** NPC 职业枚举，决定 AI 行为模式 */
export enum NPCProfession {
  FARMER = 'farmer',
  SOLDIER = 'soldier',
  MERCHANT = 'merchant',
  GENERAL = 'general',
  CRAFTSMAN = 'craftsman',
  SCHOLAR = 'scholar',
  VILLAGER = 'villager',
}

// ---------------------------------------------------------------------------
// NPC 状态（State）
// ---------------------------------------------------------------------------

/** NPC 当前行为状态 */
export enum NPCState {
  IDLE = 'idle',
  WALKING = 'walking',
  WORKING = 'working',
  TALKING = 'talking',
  TRADING = 'trading',
  PATROLLING = 'patrolling',
  FIGHTING = 'fighting',
  RESTING = 'resting',
  GATHERING = 'gathering',
  MOVING_TO_TARGET = 'moving_to_target',
}

// ---------------------------------------------------------------------------
// NPC 方向
// ---------------------------------------------------------------------------

/** NPC 朝向 */
export type NPCDirection = 'up' | 'down' | 'left' | 'right';

// ---------------------------------------------------------------------------
// NPC 定义（NPCDef）— 模板
// ---------------------------------------------------------------------------

/** NPC 定义（模板），描述一种 NPC 的所有静态属性 */
export interface NPCDef {
  /** NPC 类型唯一 ID */
  id: string;
  /** 职业 */
  profession: NPCProfession;
  /** 可读名称 */
  name: string;
  /** 渲染颜色（无纹理时 fallback） */
  color: string;
  /** emoji 图标 */
  iconEmoji: string;
  /** 移动速度（格/秒） */
  speed: number;
  /** 工作周期（游戏分钟） */
  workCycleMinutes: number;
  /** 对话列表 */
  dialogues: NPCDialogue[];
  /** 日程表 */
  schedule: ScheduleItem[];
}

// ---------------------------------------------------------------------------
// NPC 实例（NPCInstance）— 运行时
// ---------------------------------------------------------------------------

/** NPC 运行时实例，包含所有动态状态 */
export interface NPCInstance {
  /** 实例唯一 ID */
  id: string;
  /** 对应 NPCDef.id */
  defId: string;
  /** 显示名称 */
  name: string;
  /** 当前 tile X 坐标 */
  x: number;
  /** 当前 tile Y 坐标 */
  y: number;
  /** 当前状态 */
  state: NPCState;
  /** 朝向 */
  direction: NPCDirection;
  /** 职业 */
  profession: NPCProfession;
  /** 等级 */
  level: number;
  /** 当前生命值 */
  health: number;
  /** 最大生命值 */
  maxHealth: number;

  // AI 状态
  /** 当前任务 */
  currentTask: NPCTask | null;
  /** 寻路路径 */
  path: { x: number; y: number }[];
  /** 路径当前索引 */
  pathIndex: number;
  /** 目标 ID（NPC/建筑/位置） */
  targetId: string | null;

  // 社交
  /** 好友 NPC ID 列表 */
  friends: string[];
  /** 组队 ID */
  teamId: string | null;

  // 对话
  /** 激活的对话 ID */
  activeDialogueId: string | null;
  /** 对话冷却时间（秒） */
  dialogueCooldown: number;

  // 动画
  /** 动画帧索引 */
  animFrame: number;
  /** 动画计时器 */
  animTimer: number;
}

// ---------------------------------------------------------------------------
// 日程（Schedule）
// ---------------------------------------------------------------------------

/** 日程项，定义特定时间的行为 */
export interface ScheduleItem {
  /** 游戏内小时 (0-23) */
  hour: number;
  /** 切换到的状态 */
  state: NPCState;
  /** 目标 X 坐标 */
  targetX?: number;
  /** 目标 Y 坐标 */
  targetY?: number;
  /** 目标建筑 ID */
  targetBuildingId?: string;
}

// ---------------------------------------------------------------------------
// NPC 任务（Task）
// ---------------------------------------------------------------------------

/** NPC 任务 */
export interface NPCTask {
  /** 任务唯一 ID */
  id: string;
  /** 任务类型 */
  type: 'move' | 'work' | 'talk' | 'trade' | 'patrol' | 'rest' | 'gather' | 'fight' | 'collaborate';
  /** 目标 X */
  targetX?: number;
  /** 目标 Y */
  targetY?: number;
  /** 目标 NPC ID */
  targetNpcId?: string;
  /** 目标建筑 ID */
  targetBuildingId?: string;
  /** 进度 0~1 */
  progress: number;
  /** 持续时间（秒） */
  duration: number;
  /** 协作 NPC ID 列表 */
  collaborationNpcIds?: string[];
}

// ---------------------------------------------------------------------------
// 对话（Dialogue）
// ---------------------------------------------------------------------------

/** NPC 对话定义 */
export interface NPCDialogue {
  /** 对话唯一 ID */
  id: string;
  /** 触发方式 */
  trigger: 'click' | 'proximity' | 'schedule' | 'event';
  /** 条件表达式（可选） */
  condition?: string;
  /** 对话行列表 */
  lines: DialogueLine[];
}

/** 单行对话 */
export interface DialogueLine {
  /** 说话者: 'npc' | 'player' | 'system' */
  speaker: string;
  /** 对话文本 */
  text: string;
  /** 玩家选项（可选） */
  choices?: DialogueChoice[];
}

/** 对话选项 */
export interface DialogueChoice {
  /** 选项文本 */
  text: string;
  /** 跳转到指定行索引 */
  nextLineIndex?: number;
  /** 触发动作 */
  action?: string;
  /** 效果（资源变化等） */
  effect?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// NPC 事件
// ---------------------------------------------------------------------------

/** NPC 事件联合类型 */
export type NPCEvent =
  | { type: 'npcClick'; npc: NPCInstance }
  | { type: 'npcStateChange'; npc: NPCInstance; oldState: NPCState; newState: NPCState }
  | { type: 'npcDialogue'; npc: NPCInstance; dialogue: NPCDialogue }
  | { type: 'npcCollaborate'; npcs: NPCInstance[]; task: NPCTask }
  | { type: 'npcChat'; npc1: NPCInstance; npc2: NPCInstance; topic: string };

// ---------------------------------------------------------------------------
// NPC 团队
// ---------------------------------------------------------------------------

/** NPC 组队 */
export interface NPCTeam {
  /** 团队唯一 ID */
  id: string;
  /** 队长 NPC ID */
  leaderId: string;
  /** 成员 NPC ID 列表 */
  memberIds: string[];
  /** 团队任务 */
  task: NPCTask;
  /** 是否已组建完成 */
  formed: boolean;
}

// ---------------------------------------------------------------------------
// 寻路接口
// ---------------------------------------------------------------------------

/** 通用寻路器接口，由外部注入 */
export interface PathFinder {
  /** 查找从 (sx,sy) 到 (ex,ey) 的路径 */
  findPath(sx: number, sy: number, ex: number, ey: number): { x: number; y: number }[];
}
