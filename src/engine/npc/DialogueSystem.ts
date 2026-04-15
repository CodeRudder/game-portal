/**
 * 对话系统管理器
 *
 * 管理所有 NPC 对话树，处理玩家-NPC 对话流程（开始、推进、
 * 选择分支、结束），以及 NPC 间闲聊内容的生成。
 *
 * 核心概念：
 * - DialogueTree：一棵完整的对话树，按触发类型绑定到职业
 * - DialogueNode：对话树中的单个节点，包含文本、表情、选项
 * - DialogueSession：一次正在进行的对话会话
 * - DialogueAction：对话节点可触发的副作用动作
 *
 * @module engine/npc/DialogueSystem
 */

import type { NPCInstance, NPCProfession } from './types';
import type { NPCEventBus } from './NPCEventBus';

// ---------------------------------------------------------------------------
// 对话数据结构
// ---------------------------------------------------------------------------

/** 对话动作类型 */
export interface DialogueAction {
  type: 'give_resource' | 'start_quest' | 'open_shop' | 'trigger_event' | 'change_relationship';
  params: Record<string, any>;
}

/** 对话选项 */
export interface DialogueChoice {
  text: string;
  nextNodeId: string;
  condition?: string;
  action?: DialogueAction;
}

/** 对话节点 */
export interface DialogueNode {
  id: string;
  speaker: 'npc' | 'player' | 'narrator';
  text: string;
  portrait?: string;
  emotion?: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral';
  choices?: DialogueChoice[];
  nextNodeId?: string;
  action?: DialogueAction;
}

/** 对话树触发方式 */
export type DialogueTriggerType = 'click' | 'proximity' | 'event' | 'schedule';

/** 完整的对话树 */
export interface DialogueTree {
  id: string;
  npcProfession: NPCProfession;
  triggerType: DialogueTriggerType;
  nodes: DialogueNode[];
}

/** 正在进行的对话会话 */
export interface DialogueSession {
  treeId: string;
  npcId: string;
  currentNodeId: string;
  history: { nodeId: string; chosenIndex?: number }[];
  startedAt: number;
}

// ---------------------------------------------------------------------------
// NPC 间闲聊话题池（按职业）
// ---------------------------------------------------------------------------

const NPC_CHAT_TOPICS: Record<string, string[]> = {
  farmer: ['今年的庄稼长得不错', '希望能有个好收成', '需要更多水源', '最近天气不错'],
  soldier: ['最近边境不太平', '要加强训练', '注意巡逻路线', '武器该磨了'],
  merchant: ['最近生意怎么样', '这批货不错', '价格可以商量', '下批货什么时候到'],
  general: ['兵马未动粮草先行', '士气很重要', '要制定新策略', '练兵不可松懈'],
  craftsman: ['这把武器快打造好了', '需要更好的材料', '工艺需要精益求精', '新图纸不错'],
  scholar: ['最近在读一本好书', '这个问题值得讨论', '学无止境', '又有了新见解'],
  villager: ['今天天气不错', '听说有新鲜事', '日子过得真快', '邻里之间要互助'],
};

// ---------------------------------------------------------------------------
// DialogueSystem
// ---------------------------------------------------------------------------

/**
 * 对话系统管理器
 *
 * 负责对话树的注册、会话管理、选项选择、自动推进，
 * 以及 NPC 间闲聊内容的随机生成。
 */
export class DialogueSystem {
  /** 已注册的对话树（按 treeId 索引） */
  private trees: Map<string, DialogueTree> = new Map();

  /** 当前活跃的对话会话 */
  private activeSession: DialogueSession | null = null;

  /** NPC 事件总线，用于广播对话事件 */
  private eventBus: NPCEventBus;

  constructor(eventBus: NPCEventBus) {
    this.eventBus = eventBus;
  }

  // -----------------------------------------------------------------------
  // 对话树管理
  // -----------------------------------------------------------------------

  /**
   * 注册一棵对话树
   * @param tree - 对话树定义
   */
  registerTree(tree: DialogueTree): void {
    this.trees.set(tree.id, tree);
  }

  /**
   * 批量注册对话树
   * @param trees - 对话树数组
   */
  registerTrees(trees: DialogueTree[]): void {
    for (const tree of trees) {
      this.registerTree(tree);
    }
  }

  /**
   * 移除对话树
   * @param treeId - 对话树 ID
   */
  unregisterTree(treeId: string): boolean {
    return this.trees.delete(treeId);
  }

  /**
   * 获取已注册的对话树
   * @param treeId - 对话树 ID
   */
  getTree(treeId: string): DialogueTree | undefined {
    return this.trees.get(treeId);
  }

  // -----------------------------------------------------------------------
  // 对话会话控制
  // -----------------------------------------------------------------------

  /**
   * 开始一次对话
   * @param treeId - 对话树 ID
   * @param npcId  - NPC 实例 ID
   * @returns 首个对话节点，若树不存在或无节点则返回 null
   */
  startDialogue(treeId: string, npcId: string): DialogueNode | null {
    const tree = this.trees.get(treeId);
    if (!tree || tree.nodes.length === 0) {
      return null;
    }

    const firstNode = tree.nodes[0];
    this.activeSession = {
      treeId,
      npcId,
      currentNodeId: firstNode.id,
      history: [{ nodeId: firstNode.id }],
      startedAt: Date.now(),
    };

    this.eventBus.emit('dialogueStarted', { treeId, npcId, firstNode });
    return firstNode;
  }

  /**
   * 选择一个对话选项
   * @param choiceIndex - 选项索引（基于当前节点的 choices 数组）
   * @returns 选择后跳转到的对话节点，若对话结束则返回 null
   */
  makeChoice(choiceIndex: number): DialogueNode | null {
    if (!this.activeSession) return null;

    const currentNode = this.findNode(this.activeSession.currentNodeId);
    if (!currentNode?.choices || choiceIndex < 0 || choiceIndex >= currentNode.choices.length) {
      return null;
    }

    const choice = currentNode.choices[choiceIndex];

    // 执行选项动作
    if (choice.action) {
      this.executeAction(choice.action);
    }

    // 记录历史
    this.activeSession.history.push({
      nodeId: currentNode.id,
      chosenIndex: choiceIndex,
    });

    // 跳转到目标节点
    return this.navigateTo(choice.nextNodeId);
  }

  /**
   * 推进到下一个节点（无选项时使用）
   * @returns 下一个对话节点，若对话结束则返回 null
   */
  advance(): DialogueNode | null {
    if (!this.activeSession) return null;

    const currentNode = this.findNode(this.activeSession.currentNodeId);
    if (!currentNode) return null;

    // 如果有选项，不允许直接推进
    if (currentNode.choices && currentNode.choices.length > 0) {
      return currentNode;
    }

    // 执行当前节点动作
    if (currentNode.action) {
      this.executeAction(currentNode.action);
    }

    // 跳转到 nextNodeId
    if (!currentNode.nextNodeId) {
      this.endDialogue();
      return null;
    }

    return this.navigateTo(currentNode.nextNodeId);
  }

  /**
   * 结束当前对话
   */
  endDialogue(): void {
    if (!this.activeSession) return;

    const session = this.activeSession;
    this.activeSession = null;
    this.eventBus.emit('dialogueEnded', {
      treeId: session.treeId,
      npcId: session.npcId,
      duration: Date.now() - session.startedAt,
    });
  }

  /**
   * 获取当前活跃的对话会话
   */
  getActiveSession(): DialogueSession | null {
    return this.activeSession;
  }

  /**
   * 获取当前对话节点
   */
  getCurrentNode(): DialogueNode | null {
    if (!this.activeSession) return null;
    return this.findNode(this.activeSession.currentNodeId);
  }

  // -----------------------------------------------------------------------
  // NPC 间对话生成
  // -----------------------------------------------------------------------

  /**
   * 生成两个 NPC 之间的闲聊内容
   * @param npc1 - 第一个 NPC 实例
   * @param npc2 - 第二个 NPC 实例
   * @returns 闲聊文本行数组
   */
  generateNPCChat(npc1: NPCInstance, npc2: NPCInstance): string[] {
    const topics1 = NPC_CHAT_TOPICS[npc1.profession] ?? NPC_CHAT_TOPICS.villager;
    const topics2 = NPC_CHAT_TOPICS[npc2.profession] ?? NPC_CHAT_TOPICS.villager;

    // 从双方话题池中各选一个话题
    const topic1 = topics1[Math.floor(Math.random() * topics1.length)];
    const topic2 = topics2[Math.floor(Math.random() * topics2.length)];

    // 生成 3~5 行对话
    const lines: string[] = [
      `${npc1.name}：${topic1}`,
      `${npc2.name}：${topic2}`,
    ];

    // 随机添加额外对话
    if (Math.random() > 0.3) {
      lines.push(`${npc1.name}：说得有道理。`);
    }
    if (Math.random() > 0.5) {
      lines.push(`${npc2.name}：改天再聊。`);
    }

    return lines;
  }

  // -----------------------------------------------------------------------
  // 内部辅助
  // -----------------------------------------------------------------------

  /**
   * 在当前对话树中查找节点
   */
  private findNode(nodeId: string): DialogueNode | null {
    if (!this.activeSession) return null;
    const tree = this.trees.get(this.activeSession.treeId);
    if (!tree) return null;
    return tree.nodes.find((n) => n.id === nodeId) ?? null;
  }

  /**
   * 导航到指定节点
   */
  private navigateTo(nodeId: string): DialogueNode | null {
    const node = this.findNode(nodeId);
    if (!node) {
      this.endDialogue();
      return null;
    }

    this.activeSession!.currentNodeId = nodeId;
    this.activeSession!.history.push({ nodeId });
    this.eventBus.emit('dialogueNodeChanged', {
      treeId: this.activeSession!.treeId,
      npcId: this.activeSession!.npcId,
      node,
    });

    return node;
  }

  /**
   * 执行对话动作，通过事件总线广播
   */
  private executeAction(action: DialogueAction): void {
    this.eventBus.emit('dialogueAction', {
      type: action.type,
      params: action.params,
    });
  }
}
