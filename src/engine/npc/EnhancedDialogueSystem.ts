/**
 * 增强对话系统
 *
 * 在现有 DialogueSystem 基础上添加上下文感知对话和分支对话树。
 * 根据时间、天气、好感度、玩家进度等条件动态选择对话内容。
 *
 * 核心功能：
 * - 上下文感知：根据游戏环境条件选择合适的对话
 * - 分支对话树：玩家选择不同选项有不同结果
 * - NPC 闲聊：路过时互相打招呼
 * - 条件对话：基于好感度等级解锁特殊对话
 *
 * @module engine/npc/EnhancedDialogueSystem
 */

import type { NPCInstance, NPCProfession } from './types';
import { NPCProfession as NPCProfessionEnum } from './types';
import type { NPCEventBus } from './NPCEventBus';
import { RelationshipLevel } from './RelationshipSystem';

// ---------------------------------------------------------------------------
// 增强对话数据结构
// ---------------------------------------------------------------------------

/** 对话上下文条件 */
export interface DialogueCondition {
  /** 时间段: 'morning' | 'afternoon' | 'evening' | 'night' */
  timeOfDay?: string;
  /** 天气: 'sunny' | 'rainy' | 'snowy' | 'cloudy' */
  weather?: string;
  /** 最低好感度等级 */
  minRelationshipLevel?: RelationshipLevel;
  /** 最高好感度等级 */
  maxRelationshipLevel?: RelationshipLevel;
  /** 玩家进度标记（如已完成的任务 ID） */
  playerProgress?: string[];
  /** 自定义条件函数名 */
  customCondition?: string;
}

/** 增强对话节点 */
export interface EnhancedDialogueNode {
  /** 节点唯一 ID */
  id: string;
  /** NPC 说话文本 */
  text: string;
  /** 说话者表情 */
  emotion?: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'thinking';
  /** 玩家选项（空表示 NPC 独白后自动推进） */
  choices?: EnhancedDialogueChoice[];
  /** 无选项时的下一个节点 ID */
  nextNodeId?: string;
  /** 触发的动作 */
  action?: string;
  /** 触发的效果 */
  effects?: Record<string, number>;
}

/** 增强对话选项 */
export interface EnhancedDialogueChoice {
  /** 选项文本 */
  text: string;
  /** 目标节点 ID */
  nextNodeId: string;
  /** 选项显示条件 */
  condition?: DialogueCondition;
  /** 触发动作 */
  action?: string;
  /** 好感度变动 */
  relationshipChange?: number;
}

/** 增强对话树 */
export interface EnhancedDialogueTree {
  /** 对话树 ID */
  id: string;
  /** 关联职业 */
  profession: NPCProfession;
  /** 触发方式 */
  trigger: 'click' | 'proximity' | 'event' | 'greeting';
  /** 进入条件 */
  condition?: DialogueCondition;
  /** 对话节点列表 */
  nodes: EnhancedDialogueNode[];
  /** 优先级（数字越大越优先） */
  priority: number;
}

/** NPC 闲聊打招呼模板 */
export interface GreetingTemplate {
  /** 发起者职业 */
  fromProfession: NPCProfession;
  /** 接收者职业 */
  toProfession: NPCProfession;
  /** 打招呼文本 */
  text: string;
}

/** 对话上下文 */
export interface DialogueContext {
  /** 游戏内小时 */
  gameTime: number;
  /** 天气 */
  weather: string;
  /** NPC 对玩家的好感度等级 */
  relationshipLevel: RelationshipLevel;
  /** 玩家等级 */
  playerLevel: number;
  /** 已完成的任务 ID 列表 */
  completedQuests: string[];
  /** 自定义条件判断函数 */
  customConditionChecker?: (name: string) => boolean;
}

/** 对话会话 */
export interface EnhancedDialogueSession {
  /** 对话树 ID */
  treeId: string;
  /** NPC 实例 ID */
  npcId: string;
  /** 当前节点 ID */
  currentNodeId: string;
  /** 访问历史 */
  history: { nodeId: string; chosenIndex?: number }[];
  /** 累计好感度变动 */
  totalRelationshipChange: number;
}

// ---------------------------------------------------------------------------
// 默认打招呼模板
// ---------------------------------------------------------------------------

const DEFAULT_GREETINGS: GreetingTemplate[] = [
  { fromProfession: NPCProfessionEnum.FARMER, toProfession: NPCProfessionEnum.FARMER, text: '老伙计，庄稼怎么样？' },
  { fromProfession: NPCProfessionEnum.FARMER, toProfession: NPCProfessionEnum.MERCHANT, text: '商人，今年的种子有新货吗？' },
  { fromProfession: NPCProfessionEnum.FARMER, toProfession: NPCProfessionEnum.VILLAGER, text: '你好啊，今天天气不错！' },
  { fromProfession: NPCProfessionEnum.SOLDIER, toProfession: NPCProfessionEnum.SOLDIER, text: '注意警戒！' },
  { fromProfession: NPCProfessionEnum.SOLDIER, toProfession: NPCProfessionEnum.GENERAL, text: '将军，一切正常！' },
  { fromProfession: NPCProfessionEnum.SOLDIER, toProfession: NPCProfessionEnum.VILLAGER, text: '注意安全。' },
  { fromProfession: NPCProfessionEnum.MERCHANT, toProfession: NPCProfessionEnum.MERCHANT, text: '生意兴隆！' },
  { fromProfession: NPCProfessionEnum.MERCHANT, toProfession: NPCProfessionEnum.VILLAGER, text: '来看看好东西吧！' },
  { fromProfession: NPCProfessionEnum.MERCHANT, toProfession: NPCProfessionEnum.CRAFTSMAN, text: '有好货记得留给我。' },
  { fromProfession: NPCProfessionEnum.GENERAL, toProfession: NPCProfessionEnum.SOLDIER, text: '保持警惕！' },
  { fromProfession: NPCProfessionEnum.GENERAL, toProfession: NPCProfessionEnum.CRAFTSMAN, text: '武器打造得如何了？' },
  { fromProfession: NPCProfessionEnum.CRAFTSMAN, toProfession: NPCProfessionEnum.CRAFTSMAN, text: '新图纸看了吗？' },
  { fromProfession: NPCProfessionEnum.CRAFTSMAN, toProfession: NPCProfessionEnum.MERCHANT, text: '这批货质量上乘。' },
  { fromProfession: NPCProfessionEnum.SCHOLAR, toProfession: NPCProfessionEnum.SCHOLAR, text: '学而时习之，不亦说乎。' },
  { fromProfession: NPCProfessionEnum.SCHOLAR, toProfession: NPCProfessionEnum.VILLAGER, text: '有闲暇来书院坐坐。' },
  { fromProfession: NPCProfessionEnum.VILLAGER, toProfession: NPCProfessionEnum.VILLAGER, text: '你好呀！' },
  { fromProfession: NPCProfessionEnum.VILLAGER, toProfession: NPCProfessionEnum.FARMER, text: '收成好吗？' },
];

// ---------------------------------------------------------------------------
// EnhancedDialogueSystem
// ---------------------------------------------------------------------------

/**
 * 增强对话系统
 *
 * 提供上下文感知对话选择、分支对话树管理、NPC 闲聊等功能。
 * 与现有 DialogueSystem 兼容，可以共存。
 */
export class EnhancedDialogueSystem {
  /** 已注册的增强对话树 */
  private trees: Map<string, EnhancedDialogueTree> = new Map();

  /** 当前活跃的对话会话 */
  private activeSession: EnhancedDialogueSession | null = null;

  /** 打招呼模板 */
  private greetings: GreetingTemplate[];

  /** 事件总线 */
  private eventBus: NPCEventBus;

  constructor(eventBus: NPCEventBus) {
    this.eventBus = eventBus;
    this.greetings = [...DEFAULT_GREETINGS];
  }

  // -----------------------------------------------------------------------
  // 对话树管理
  // -----------------------------------------------------------------------

  /**
   * 注册增强对话树
   * @param tree - 对话树
   */
  registerTree(tree: EnhancedDialogueTree): void {
    this.trees.set(tree.id, tree);
  }

  /**
   * 批量注册对话树
   * @param trees - 对话树数组
   */
  registerTrees(trees: EnhancedDialogueTree[]): void {
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
   * 获取对话树
   * @param treeId - 对话树 ID
   */
  getTree(treeId: string): EnhancedDialogueTree | undefined {
    return this.trees.get(treeId);
  }

  /**
   * 添加打招呼模板
   * @param greeting - 打招呼模板
   */
  addGreeting(greeting: GreetingTemplate): void {
    this.greetings.push(greeting);
  }

  // -----------------------------------------------------------------------
  // 上下文感知对话选择
  // -----------------------------------------------------------------------

  /**
   * 根据上下文选择最合适的对话树
   * @param profession - NPC 职业
   * @param trigger - 触发方式
   * @param context - 对话上下文
   * @returns 最匹配的对话树，若无匹配返回 null
   */
  selectDialogue(
    profession: NPCProfession,
    trigger: string,
    context: DialogueContext,
  ): EnhancedDialogueTree | null {
    const candidates: { tree: EnhancedDialogueTree; score: number }[] = [];

    for (const tree of this.trees.values()) {
      if (tree.profession !== profession) continue;
      if (tree.trigger !== trigger) continue;

      // 检查对话树条件
      if (tree.condition && !this.checkCondition(tree.condition, context)) continue;

      // 计算匹配分数
      let score = tree.priority;
      if (tree.condition?.weather && tree.condition.weather === context.weather) score += 10;
      if (tree.condition?.timeOfDay && tree.condition.timeOfDay === this.getTimeOfDay(context.gameTime)) score += 5;
      if (tree.condition?.minRelationshipLevel) score += 20;

      candidates.push({ tree, score });
    }

    if (candidates.length === 0) return null;

    // 按分数降序排列，取最高分
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].tree;
  }

  /**
   * 开始上下文感知对话
   * @param npcId - NPC 实例 ID
   * @param profession - NPC 职业
   * @param trigger - 触发方式
   * @param context - 对话上下文
   * @returns 第一个对话节点
   */
  startContextDialogue(
    npcId: string,
    profession: NPCProfession,
    trigger: string,
    context: DialogueContext,
  ): EnhancedDialogueNode | null {
    const tree = this.selectDialogue(profession, trigger, context);
    if (!tree || tree.nodes.length === 0) return null;

    const firstNode = tree.nodes[0];
    this.activeSession = {
      treeId: tree.id,
      npcId,
      currentNodeId: firstNode.id,
      history: [{ nodeId: firstNode.id }],
      totalRelationshipChange: 0,
    };

    this.eventBus.emit('enhancedDialogueStarted', {
      treeId: tree.id,
      npcId,
      context,
    });

    return firstNode;
  }

  // -----------------------------------------------------------------------
  // 对话会话控制
  // -----------------------------------------------------------------------

  /**
   * 直接开始对话（通过对话树 ID）
   * @param treeId - 对话树 ID
   * @param npcId - NPC 实例 ID
   * @returns 第一个对话节点
   */
  startDialogue(treeId: string, npcId: string): EnhancedDialogueNode | null {
    const tree = this.trees.get(treeId);
    if (!tree || tree.nodes.length === 0) return null;

    const firstNode = tree.nodes[0];
    this.activeSession = {
      treeId,
      npcId,
      currentNodeId: firstNode.id,
      history: [{ nodeId: firstNode.id }],
      totalRelationshipChange: 0,
    };

    return firstNode;
  }

  /**
   * 选择对话选项
   * @param choiceIndex - 选项索引
   * @returns 下一个对话节点
   */
  makeChoice(choiceIndex: number): EnhancedDialogueNode | null {
    if (!this.activeSession) return null;

    const currentNode = this.findNode(this.activeSession.currentNodeId);
    if (!currentNode?.choices || choiceIndex < 0 || choiceIndex >= currentNode.choices.length) {
      return null;
    }

    const choice = currentNode.choices[choiceIndex];

    // 累计好感度变动
    if (choice.relationshipChange) {
      this.activeSession.totalRelationshipChange += choice.relationshipChange;
    }

    // 触发动作
    if (choice.action) {
      this.eventBus.emit('enhancedDialogueAction', {
        npcId: this.activeSession.npcId,
        action: choice.action,
        relationshipChange: choice.relationshipChange,
      });
    }

    // 记录历史
    this.activeSession.history.push({
      nodeId: currentNode.id,
      chosenIndex: choiceIndex,
    });

    // 跳转
    return this.navigateTo(choice.nextNodeId);
  }

  /**
   * 推进到下一个节点（无选项时）
   */
  advance(): EnhancedDialogueNode | null {
    if (!this.activeSession) return null;

    const currentNode = this.findNode(this.activeSession.currentNodeId);
    if (!currentNode) return null;

    // 有选项时不能直接推进
    if (currentNode.choices && currentNode.choices.length > 0) {
      return currentNode;
    }

    // 触发动作
    if (currentNode.action) {
      this.eventBus.emit('enhancedDialogueAction', {
        npcId: this.activeSession.npcId,
        action: currentNode.action,
      });
    }

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

    this.eventBus.emit('enhancedDialogueEnded', {
      treeId: session.treeId,
      npcId: session.npcId,
      totalRelationshipChange: session.totalRelationshipChange,
      historyLength: session.history.length,
    });
  }

  /**
   * 获取当前会话
   */
  getActiveSession(): EnhancedDialogueSession | null {
    return this.activeSession;
  }

  /**
   * 获取当前节点
   */
  getCurrentNode(): EnhancedDialogueNode | null {
    if (!this.activeSession) return null;
    return this.findNode(this.activeSession.currentNodeId);
  }

  /**
   * 获取当前节点的可用选项（过滤条件不满足的）
   * @param context - 对话上下文
   * @returns 可用选项列表
   */
  getAvailableChoices(context: DialogueContext): EnhancedDialogueChoice[] {
    const node = this.getCurrentNode();
    if (!node?.choices) return [];

    return node.choices.filter((choice) => {
      if (!choice.condition) return true;
      return this.checkCondition(choice.condition, context);
    });
  }

  // -----------------------------------------------------------------------
  // NPC 闲聊
  // -----------------------------------------------------------------------

  /**
   * 生成两个 NPC 之间的打招呼文本
   * @param npc1 - 第一个 NPC
   * @param npc2 - 第二个 NPC
   * @returns 打招呼文本，无匹配返回通用打招呼
   */
  generateGreeting(npc1: NPCInstance, npc2: NPCInstance): string {
    // 查找精确匹配
    const match = this.greetings.find(
      (g) => g.fromProfession === npc1.profession && g.toProfession === npc2.profession,
    );

    if (match) return match.text;

    // 查找反向匹配
    const reverseMatch = this.greetings.find(
      (g) => g.fromProfession === npc2.profession && g.toProfession === npc1.profession,
    );

    if (reverseMatch) return `你好！`;

    // 通用打招呼
    return `${npc1.name}向${npc2.name}点了点头。`;
  }

  /**
   * 生成上下文感知的闲聊内容
   * @param npc1 - 第一个 NPC
   * @param npc2 - 第二个 NPC
   * @param context - 对话上下文
   * @returns 闲聊文本行
   */
  generateContextChat(npc1: NPCInstance, npc2: NPCInstance, context: DialogueContext): string[] {
    const lines: string[] = [];

    // 打招呼
    lines.push(`${npc1.name}：${this.generateGreeting(npc1, npc2)}`);

    // 根据时间添加话题
    const timeOfDay = this.getTimeOfDay(context.gameTime);
    switch (timeOfDay) {
      case 'morning':
        lines.push(`${npc2.name}：早上好！新的一天开始了。`);
        break;
      case 'afternoon':
        lines.push(`${npc2.name}：下午好，忙什么呢？`);
        break;
      case 'evening':
        lines.push(`${npc2.name}：傍晚了，准备收工吧。`);
        break;
      case 'night':
        lines.push(`${npc2.name}：夜深了，注意安全。`);
        break;
    }

    // 根据天气添加话题
    if (context.weather === 'rainy') {
      lines.push(`${npc1.name}：下雨了，记得带伞。`);
    } else if (context.weather === 'snowy') {
      lines.push(`${npc1.name}：下雪了，真美啊。`);
    }

    return lines;
  }

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  /** 序列化（对话树是静态配置，只需序列化会话状态） */
  serialize(): object {
    return {
      activeSession: this.activeSession ? { ...this.activeSession } : null,
    };
  }

  /** 反序列化 */
  deserialize(data: Record<string, unknown>): void {
    const d = data as { activeSession: EnhancedDialogueSession | null };
    this.activeSession = d.activeSession;
  }

  // -----------------------------------------------------------------------
  // 内部辅助
  // -----------------------------------------------------------------------

  /** 在当前对话树中查找节点 */
  private findNode(nodeId: string): EnhancedDialogueNode | null {
    if (!this.activeSession) return null;
    const tree = this.trees.get(this.activeSession.treeId);
    if (!tree) return null;
    return tree.nodes.find((n) => n.id === nodeId) ?? null;
  }

  /** 导航到指定节点 */
  private navigateTo(nodeId: string): EnhancedDialogueNode | null {
    const node = this.findNode(nodeId);
    if (!node) {
      this.endDialogue();
      return null;
    }

    this.activeSession!.currentNodeId = nodeId;
    this.activeSession!.history.push({ nodeId });

    return node;
  }

  /** 检查对话条件 */
  private checkCondition(condition: DialogueCondition, context: DialogueContext): boolean {
    // 时间段检查
    if (condition.timeOfDay) {
      const currentTime = this.getTimeOfDay(context.gameTime);
      if (currentTime !== condition.timeOfDay) return false;
    }

    // 天气检查
    if (condition.weather && condition.weather !== context.weather) return false;

    // 好感度检查
    if (condition.minRelationshipLevel) {
      const levels = [
        RelationshipLevel.STRANGER,
        RelationshipLevel.ACQUAINTANCE,
        RelationshipLevel.FRIEND,
        RelationshipLevel.CLOSE_FRIEND,
        RelationshipLevel.CONFIDANT,
      ];
      const minIdx = levels.indexOf(condition.minRelationshipLevel);
      const currentIdx = levels.indexOf(context.relationshipLevel);
      if (currentIdx < minIdx) return false;
    }

    if (condition.maxRelationshipLevel) {
      const levels = [
        RelationshipLevel.STRANGER,
        RelationshipLevel.ACQUAINTANCE,
        RelationshipLevel.FRIEND,
        RelationshipLevel.CLOSE_FRIEND,
        RelationshipLevel.CONFIDANT,
      ];
      const maxIdx = levels.indexOf(condition.maxRelationshipLevel);
      const currentIdx = levels.indexOf(context.relationshipLevel);
      if (currentIdx > maxIdx) return false;
    }

    // 玩家进度检查
    if (condition.playerProgress) {
      for (const required of condition.playerProgress) {
        if (!context.completedQuests.includes(required)) return false;
      }
    }

    // 自定义条件
    if (condition.customCondition && context.customConditionChecker) {
      if (!context.customConditionChecker(condition.customCondition)) return false;
    }

    return true;
  }

  /** 将游戏小时转换为时间段 */
  private getTimeOfDay(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 21) return 'evening';
    return 'night';
  }
}
