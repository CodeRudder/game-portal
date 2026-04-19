/**
 * DialogueSystem 单元测试
 *
 * 覆盖：注册对话树、开始/推进/结束对话、选择分支、
 * NPC 间对话生成。
 *
 * @module engine/npc/__tests__/DialogueSystem.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NPCEventBus } from '../NPCEventBus';
import { DialogueSystem } from '../DialogueSystem';
import type { DialogueTree, DialogueNode } from '../DialogueSystem';
import { NPCProfession, NPCState } from '../types';
import type { NPCInstance } from '../types';

// ---------------------------------------------------------------------------
// 测试辅助：创建示例对话树
// ---------------------------------------------------------------------------

function createTestTree(): DialogueTree {
  return {
    id: 'test_tree',
    npcProfession: NPCProfession.FARMER,
    triggerType: 'click',
    nodes: [
      {
        id: 'start',
        speaker: 'npc',
        text: '你好，欢迎来到我的农场！',
        emotion: 'happy',
        nextNodeId: 'choice_node',
      },
      {
        id: 'choice_node',
        speaker: 'npc',
        text: '你需要什么？',
        choices: [
          { text: '购买粮食', nextNodeId: 'buy', action: { type: 'open_shop', params: { category: 'grain' } } },
          { text: '聊聊收成', nextNodeId: 'chat' },
          { text: '告辞', nextNodeId: 'goodbye' },
        ],
      },
      {
        id: 'buy',
        speaker: 'npc',
        text: '好的，请看看这些粮食。',
        emotion: 'happy',
        nextNodeId: 'goodbye',
      },
      {
        id: 'chat',
        speaker: 'npc',
        text: '今年风调雨顺，收成很好！',
        emotion: 'happy',
        nextNodeId: 'goodbye',
      },
      {
        id: 'goodbye',
        speaker: 'npc',
        text: '再见，欢迎再来！',
        emotion: 'neutral',
      },
    ],
  };
}

function createNPCInstance(id: string, profession: NPCProfession): NPCInstance {
  return {
    id,
    defId: `${profession}_def`,
    name: id === 'npc1' ? '张三' : '李四',
    x: 5,
    y: 5,
    state: NPCState.IDLE,
    direction: 'down',
    profession,
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
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('DialogueSystem', () => {
  let eventBus: NPCEventBus;
  let system: DialogueSystem;

  beforeEach(() => {
    eventBus = new NPCEventBus();
    system = new DialogueSystem(eventBus);
  });

  describe('registerTree', () => {
    it('should register a dialogue tree', () => {
      const tree = createTestTree();
      system.registerTree(tree);
      expect(system.getTree('test_tree')).toBe(tree);
    });

    it('should register multiple trees', () => {
      const tree1 = { ...createTestTree(), id: 'tree_1' };
      const tree2 = { ...createTestTree(), id: 'tree_2' };
      system.registerTrees([tree1, tree2]);
      expect(system.getTree('tree_1')).toBe(tree1);
      expect(system.getTree('tree_2')).toBe(tree2);
    });

    it('should unregister a tree', () => {
      const tree = createTestTree();
      system.registerTree(tree);
      expect(system.unregisterTree('test_tree')).toBe(true);
      expect(system.getTree('test_tree')).toBeUndefined();
    });
  });

  describe('startDialogue', () => {
    it('should start a dialogue and return the first node', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      const node = system.startDialogue('test_tree', 'npc_1');
      expect(node).not.toBeNull();
      expect(node!.id).toBe('start');
      expect(node!.text).toBe('你好，欢迎来到我的农场！');

      const session = system.getActiveSession();
      expect(session).not.toBeNull();
      expect(session!.treeId).toBe('test_tree');
      expect(session!.npcId).toBe('npc_1');
    });

    it('should return null for non-existent tree', () => {
      const node = system.startDialogue('missing_tree', 'npc_1');
      expect(node).toBeNull();
    });

    it('should emit dialogueStarted event', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      const events: any[] = [];
      eventBus.on('dialogueStarted', (data: any) => events.push(data));

      system.startDialogue('test_tree', 'npc_1');
      expect(events).toHaveLength(1);
      expect(events[0].treeId).toBe('test_tree');
    });
  });

  describe('advance', () => {
    it('should advance to the next node when no choices', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      const nextNode = system.advance();

      expect(nextNode).not.toBeNull();
      expect(nextNode!.id).toBe('choice_node');
    });

    it('should not advance when node has choices', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start -> choice_node

      // choice_node has choices, advance should return the same node
      const node = system.advance();
      expect(node).not.toBeNull();
      expect(node!.id).toBe('choice_node');
    });

    it('should end dialogue when reaching a terminal node', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start -> choice_node
      system.makeChoice(2); // choice_node -> goodbye (no nextNodeId)

      // goodbye has no nextNodeId, advance ends dialogue
      const node = system.advance();
      expect(node).toBeNull();
      expect(system.getActiveSession()).toBeNull();
    });
  });

  describe('makeChoice', () => {
    it('should navigate to the correct choice node', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start -> choice_node

      const buyNode = system.makeChoice(0); // "购买粮食"
      expect(buyNode).not.toBeNull();
      expect(buyNode!.id).toBe('buy');
    });

    it('should execute choice action', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      const actions: any[] = [];
      eventBus.on('dialogueAction', (data: any) => actions.push(data));

      system.startDialogue('test_tree', 'npc_1');
      system.advance();
      system.makeChoice(0); // has action: open_shop

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('open_shop');
    });

    it('should return null when no active session', () => {
      expect(system.makeChoice(0)).toBeNull();
    });

    it('should return null for invalid choice index', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      system.advance();

      expect(system.makeChoice(-1)).toBeNull();
      expect(system.makeChoice(99)).toBeNull();
    });
  });

  describe('endDialogue', () => {
    it('should clear the active session', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      expect(system.getActiveSession()).not.toBeNull();

      system.endDialogue();
      expect(system.getActiveSession()).toBeNull();
    });

    it('should emit dialogueEnded event', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      const events: any[] = [];
      eventBus.on('dialogueEnded', (data: any) => events.push(data));

      system.startDialogue('test_tree', 'npc_1');
      system.endDialogue();

      expect(events).toHaveLength(1);
      expect(events[0].treeId).toBe('test_tree');
    });
  });

  describe('generateNPCChat', () => {
    it('should generate chat lines between two NPCs', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.MERCHANT);

      const lines = system.generateNPCChat(npc1, npc2);

      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]).toContain('张三');
      expect(lines[1]).toContain('李四');
    });

    it('should use villager topics as fallback for unknown professions', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.VILLAGER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateNPCChat(npc1, npc2);
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getCurrentNode', () => {
    it('should return null when no active session', () => {
      expect(system.getCurrentNode()).toBeNull();
    });

    it('should return the current node', () => {
      const tree = createTestTree();
      system.registerTree(tree);

      system.startDialogue('test_tree', 'npc_1');
      const node = system.getCurrentNode();

      expect(node).not.toBeNull();
      expect(node!.id).toBe('start');
    });
  });
});
