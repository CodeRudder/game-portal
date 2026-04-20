/**
 * 引擎层 — NPC 对话系统
 *
 * 管理对话树的加载、会话创建、选项选择和效果执行。
 * 实现 ISubsystem 接口，可注册到引擎子系统中统一管理。
 *
 * 职责：
 *   - 对话树管理（加载、查询）
 *   - 对话会话创建与销毁
 *   - 选项过滤（按好感度/职业）
 *   - 对话效果执行
 *   - 对话历史记录
 *
 * @module engine/npc/NPCDialogSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  NPCId,
  NPCProfession,
  DialogNodeId,
  DialogNode,
  DialogOption,
  DialogEffect,
  DialogTree,
  DialogSession,
  DialogHistoryEntry,
} from '../../core/npc';
import { DIALOG_TREES } from '../../core/npc';

// ─────────────────────────────────────────────
// 对话系统
// ─────────────────────────────────────────────

/** 会话ID类型 */
type SessionId = string;

/** 对话系统依赖（外部注入） */
export interface NPCDialogDeps {
  /** 获取 NPC 好感度 */
  getAffinity: (npcId: NPCId) => number;
  /** 获取 NPC 职业 */
  getProfession: (npcId: NPCId) => NPCProfession | null;
  /** 修改好感度（返回修改后的值） */
  changeAffinity: (npcId: NPCId, delta: number) => number | null;
  /** 获取当前回合数 */
  getCurrentTurn: () => number;
}

/**
 * NPC 对话系统
 *
 * 管理对话会话的完整生命周期：创建会话、展示对话、选择选项、执行效果。
 *
 * @example
 * ```ts
 * const dialogSystem = new NPCDialogSystem();
 * dialogSystem.init(deps);
 * dialogSystem.setDialogDeps({ getAffinity, getProfession, changeAffinity, getCurrentTurn });
 *
 * // 开始对话
 * const session = dialogSystem.startDialog('npc-merchant-01', 'dialog-merchant-default');
 *
 * // 获取当前对话
 * const node = dialogSystem.getCurrentNode(session.id);
 *
 * // 选择选项
 * const result = dialogSystem.selectOption(session.id, 'merchant-buy');
 * ```
 */
export class NPCDialogSystem implements ISubsystem {
  readonly name = 'npcDialog';

  private deps!: ISystemDeps;
  private dialogDeps!: NPCDialogDeps;
  private dialogTrees: Map<string, DialogTree> = new Map();
  private sessions: Map<SessionId, DialogSession> = new Map();
  private sessionCounter = 0;

  // ─────────────────────────────────────────
  // ISubsystem 生命周期
  // ─────────────────────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadDefaultDialogTrees();
  }

  update(_dt: number): void {
    // 对话系统不需要帧更新
  }

  getState(): { activeSessions: DialogSession[] } {
    return {
      activeSessions: Array.from(this.sessions.values()).map((s) => ({ ...s })),
    };
  }

  reset(): void {
    this.sessions.clear();
    this.sessionCounter = 0;
  }

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入对话系统外部依赖 */
  setDialogDeps(dialogDeps: NPCDialogDeps): void {
    this.dialogDeps = dialogDeps;
  }

  // ─────────────────────────────────────────
  // 对话树管理
  // ─────────────────────────────────────────

  /** 加载默认对话树 */
  private loadDefaultDialogTrees(): void {
    for (const [id, tree] of Object.entries(DIALOG_TREES)) {
      this.dialogTrees.set(id, tree);
    }
  }

  /** 注册自定义对话树 */
  registerDialogTree(tree: DialogTree): void {
    this.dialogTrees.set(tree.id, tree);
  }

  /** 获取对话树 */
  getDialogTree(treeId: string): DialogTree | undefined {
    return this.dialogTrees.get(treeId);
  }

  /** 获取所有对话树 ID */
  getDialogTreeIds(): string[] {
    return Array.from(this.dialogTrees.keys());
  }

  // ─────────────────────────────────────────
  // 对话会话管理
  // ─────────────────────────────────────────

  /** 生成唯一会话 ID */
  private generateSessionId(): SessionId {
    this.sessionCounter++;
    return `session-${this.sessionCounter}`;
  }

  /**
   * 开始对话
   *
   * @param npcId - NPC ID
   * @param dialogTreeId - 对话树 ID
   * @returns 对话会话，如果对话树不存在返回 null
   */
  startDialog(npcId: NPCId, dialogTreeId: string): DialogSession | null {
    const tree = this.dialogTrees.get(dialogTreeId);
    if (!tree) return null;

    const session: DialogSession = {
      id: this.generateSessionId(),
      npcId,
      dialogTreeId,
      currentNodeId: tree.startNodeId,
      history: [],
      ended: false,
      accumulatedEffects: [],
    };

    this.sessions.set(session.id, session);

    // 记录进入起始节点
    this.recordHistoryEntry(session, null);

    // 执行起始节点的 onEnter 效果
    const startNode = tree.nodes[tree.startNodeId];
    if (startNode?.onEnter) {
      this.executeEffects(startNode.onEnter, session);
    }

    this.deps.eventBus.emit('npc:dialog_started', {
      sessionId: session.id,
      npcId,
      dialogTreeId,
    });

    return { ...session };
  }

  /**
   * 获取当前对话节点
   *
   * @param sessionId - 会话 ID
   * @returns 当前对话节点，会话不存在或已结束返回 null
   */
  getCurrentNode(sessionId: SessionId): DialogNode | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.ended) return null;

    const tree = this.dialogTrees.get(session.dialogTreeId);
    if (!tree) return null;

    return tree.nodes[session.currentNodeId] ?? null;
  }

  /**
   * 获取当前可用选项
   *
   * 根据好感度和职业过滤不可用的选项。
   *
   * @param sessionId - 会话 ID
   * @returns 可用选项列表
   */
  getAvailableOptions(sessionId: SessionId): DialogOption[] {
    const session = this.sessions.get(sessionId);
    if (!session || session.ended) return [];

    const node = this.getCurrentNode(sessionId);
    if (!node) return [];

    const affinity = this.dialogDeps.getAffinity(session.npcId);
    const profession = this.dialogDeps.getProfession(session.npcId);

    return this.filterOptions(node.options, affinity, profession);
  }

  /**
   * 选择对话选项
   *
   * @param sessionId - 会话 ID
   * @param optionId - 选项 ID
   * @returns 选择结果
   */
  selectOption(sessionId: SessionId, optionId: string): DialogSelectResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, reason: 'session_not_found', effects: [] };
    }
    if (session.ended) {
      return { success: false, reason: 'session_ended', effects: [] };
    }

    const node = this.getCurrentNode(sessionId);
    if (!node) {
      return { success: false, reason: 'node_not_found', effects: [] };
    }

    // 查找选项
    const option = node.options.find((o) => o.id === optionId);
    if (!option) {
      return { success: false, reason: 'option_not_found', effects: [] };
    }

    // 检查选项是否可用
    const affinity = this.dialogDeps.getAffinity(session.npcId);
    const profession = this.dialogDeps.getProfession(session.npcId);
    const available = this.filterOptions(node.options, affinity, profession);
    if (!available.find((o) => o.id === optionId)) {
      return { success: false, reason: 'option_not_available', effects: [] };
    }

    // 执行选项效果
    if (option.effects) {
      this.executeEffects(option.effects, session);
      // 同步好感度变化
      for (const effect of option.effects) {
        if (effect.type === 'affinity_change') {
          this.dialogDeps.changeAffinity(session.npcId, effect.value as number);
        }
      }
    }

    // 跳转到下一节点或结束对话
    if (option.nextNodeId === null) {
      session.ended = true;
      this.deps.eventBus.emit('npc:dialog_ended', {
        sessionId,
        npcId: session.npcId,
      });
      return { success: true, ended: true, effects: option.effects ?? [] };
    }

    session.currentNodeId = option.nextNodeId;

    // 记录历史（在跳转之后，记录目标节点）
    this.recordHistoryEntry(session, optionId);

    // 执行新节点的 onEnter 效果
    const tree = this.dialogTrees.get(session.dialogTreeId);
    const nextNode = tree?.nodes[option.nextNodeId];
    if (nextNode?.onEnter) {
      this.executeEffects(nextNode.onEnter, session);
    }

    return { success: true, ended: false, effects: option.effects ?? [] };
  }

  /**
   * 结束对话
   *
   * @param sessionId - 会话 ID
   * @returns 是否成功结束
   */
  endDialog(sessionId: SessionId): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.ended = true;
    this.deps.eventBus.emit('npc:dialog_ended', {
      sessionId,
      npcId: session.npcId,
    });
    return true;
  }

  /**
   * 获取对话会话
   *
   * @param sessionId - 会话 ID
   * @returns 对话会话快照
   */
  getSession(sessionId: SessionId): DialogSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? { ...session, history: [...session.history] } : undefined;
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): DialogSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => !s.ended)
      .map((s) => ({ ...s, history: [...s.history] }));
  }

  /**
   * 销毁会话
   *
   * @param sessionId - 会话 ID
   */
  destroySession(sessionId: SessionId): void {
    this.sessions.delete(sessionId);
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 根据好感度和职业过滤选项 */
  private filterOptions(
    options: DialogOption[],
    affinity: number,
    profession: NPCProfession | null,
  ): DialogOption[] {
    const filtered = options.filter((opt) => {
      // 好感度检查
      if (opt.requiredAffinity !== undefined && affinity < opt.requiredAffinity) {
        return false;
      }
      // 职业检查
      if (opt.requiredProfession !== undefined && profession !== opt.requiredProfession) {
        return false;
      }
      return true;
    });

    // 如果所有选项都被过滤掉，返回默认选项
    if (filtered.length === 0) {
      const defaults = options.filter((o) => o.isDefault);
      if (defaults.length > 0) return defaults;
    }

    return filtered;
  }

  /** 记录对话历史 */
  private recordHistoryEntry(
    session: DialogSession,
    selectedOptionId: string | null,
  ): void {
    const tree = this.dialogTrees.get(session.dialogTreeId);
    const node = tree?.nodes[session.currentNodeId];
    if (!node) return;

    const turn = this.dialogDeps?.getCurrentTurn?.() ?? 0;

    const entry: DialogHistoryEntry = {
      nodeId: node.id,
      speaker: node.speaker,
      text: node.text,
      selectedOptionId,
      timestamp: turn,
    };

    session.history.push(entry);
  }

  /** 执行对话效果 */
  private executeEffects(
    effects: DialogEffect[],
    session: DialogSession,
  ): void {
    for (const effect of effects) {
      session.accumulatedEffects.push(effect);
    }
  }
}

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 选项选择结果 */
export interface DialogSelectResult {
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  reason?: 'session_not_found' | 'session_ended' | 'node_not_found' | 'option_not_found' | 'option_not_available';
  /** 对话是否已结束 */
  ended?: boolean;
  /** 触发的效果列表 */
  effects: DialogEffect[];
}
