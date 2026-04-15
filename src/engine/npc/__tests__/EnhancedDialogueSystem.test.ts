/**
 * EnhancedDialogueSystem 单元测试
 *
 * 覆盖：上下文感知对话选择、分支对话树、条件过滤、
 * NPC 闲聊打招呼、对话会话控制。
 *
 * @module engine/npc/__tests__/EnhancedDialogueSystem.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NPCEventBus } from '../NPCEventBus';
import { EnhancedDialogueSystem } from '../EnhancedDialogueSystem';
import type {
  EnhancedDialogueTree,
  EnhancedDialogueNode,
  DialogueContext,
  GreetingTemplate,
} from '../EnhancedDialogueSystem';
import { NPCProfession, NPCState } from '../types';
import type { NPCInstance } from '../types';
import { RelationshipLevel } from '../RelationshipSystem';

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function createTestTree(overrides?: Partial<EnhancedDialogueTree>): EnhancedDialogueTree {
  return {
    id: 'test_tree',
    profession: NPCProfession.FARMER,
    trigger: 'click',
    nodes: [
      {
        id: 'start',
        text: '你好，欢迎来到农场！',
        emotion: 'happy',
        nextNodeId: 'choice',
      },
      {
        id: 'choice',
        text: '你需要什么？',
        choices: [
          { text: '购买粮食', nextNodeId: 'buy', relationshipChange: 2 },
          { text: '聊聊收成', nextNodeId: 'chat', relationshipChange: 1 },
          { text: '告辞', nextNodeId: 'goodbye', relationshipChange: -1 },
        ],
      },
      {
        id: 'buy',
        text: '好的，请看看这些粮食。',
        action: 'open_shop',
        nextNodeId: 'goodbye',
      },
      {
        id: 'chat',
        text: '今年收成不错！',
        nextNodeId: 'goodbye',
      },
      {
        id: 'goodbye',
        text: '再见！',
      },
    ],
    priority: 1,
    ...overrides,
  };
}

function createWeatherTree(): EnhancedDialogueTree {
  return {
    id: 'rain_tree',
    profession: NPCProfession.FARMER,
    trigger: 'click',
    condition: { weather: 'rainy' },
    nodes: [
      { id: 'rain_start', text: '下雨了，庄稼有救了！' },
    ],
    priority: 5,
  };
}

function createRelationshipTree(): EnhancedDialogueTree {
  return {
    id: 'friend_tree',
    profession: NPCProfession.FARMER,
    trigger: 'click',
    condition: { minRelationshipLevel: RelationshipLevel.FRIEND },
    nodes: [
      { id: 'friend_start', text: '老朋友，好久不见！' },
    ],
    priority: 10,
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

function createContext(overrides?: Partial<DialogueContext>): DialogueContext {
  return {
    gameTime: 10,
    weather: 'sunny',
    relationshipLevel: RelationshipLevel.STRANGER,
    playerLevel: 1,
    completedQuests: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('EnhancedDialogueSystem', () => {
  let eventBus: NPCEventBus;
  let system: EnhancedDialogueSystem;

  beforeEach(() => {
    eventBus = new NPCEventBus();
    system = new EnhancedDialogueSystem(eventBus);
  });

  // -----------------------------------------------------------------------
  // 对话树管理
  // -----------------------------------------------------------------------

  describe('registerTree', () => {
    it('应能注册对话树', () => {
      const tree = createTestTree();
      system.registerTree(tree);
      expect(system.getTree('test_tree')).toBe(tree);
    });

    it('应能批量注册对话树', () => {
      system.registerTrees([
        { ...createTestTree(), id: 'tree_1' },
        { ...createTestTree(), id: 'tree_2' },
      ]);
      expect(system.getTree('tree_1')).toBeDefined();
      expect(system.getTree('tree_2')).toBeDefined();
    });

    it('应能移除对话树', () => {
      system.registerTree(createTestTree());
      expect(system.unregisterTree('test_tree')).toBe(true);
      expect(system.getTree('test_tree')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 上下文感知对话选择
  // -----------------------------------------------------------------------

  describe('selectDialogue', () => {
    beforeEach(() => {
      system.registerTree(createTestTree());
      system.registerTree(createWeatherTree());
      system.registerTree(createRelationshipTree());
    });

    it('晴天应选择普通对话树', () => {
      const tree = system.selectDialogue(
        NPCProfession.FARMER,
        'click',
        createContext({ weather: 'sunny' }),
      );
      expect(tree).not.toBeNull();
      expect(tree!.id).toBe('test_tree');
    });

    it('雨天应选择雨天对话树（优先级更高）', () => {
      const tree = system.selectDialogue(
        NPCProfession.FARMER,
        'click',
        createContext({ weather: 'rainy' }),
      );
      expect(tree).not.toBeNull();
      expect(tree!.id).toBe('rain_tree');
    });

    it('朋友等级应选择友好对话树（优先级最高）', () => {
      const tree = system.selectDialogue(
        NPCProfession.FARMER,
        'click',
        createContext({
          weather: 'rainy',
          relationshipLevel: RelationshipLevel.FRIEND,
        }),
      );
      expect(tree).not.toBeNull();
      expect(tree!.id).toBe('friend_tree');
    });

    it('不匹配的职业应返回 null', () => {
      const tree = system.selectDialogue(
        NPCProfession.SOLDIER,
        'click',
        createContext(),
      );
      expect(tree).toBeNull();
    });

    it('不匹配的触发方式应返回 null', () => {
      const tree = system.selectDialogue(
        NPCProfession.FARMER,
        'proximity',
        createContext(),
      );
      expect(tree).toBeNull();
    });
  });

  describe('startContextDialogue', () => {
    it('应能开始上下文感知对话', () => {
      system.registerTree(createTestTree());

      const node = system.startContextDialogue(
        'npc_1',
        NPCProfession.FARMER,
        'click',
        createContext(),
      );

      expect(node).not.toBeNull();
      expect(node!.id).toBe('start');
      expect(node!.text).toBe('你好，欢迎来到农场！');

      const session = system.getActiveSession();
      expect(session).not.toBeNull();
      expect(session!.npcId).toBe('npc_1');
    });

    it('无匹配对话树应返回 null', () => {
      const node = system.startContextDialogue(
        'npc_1',
        NPCProfession.SOLDIER,
        'click',
        createContext(),
      );
      expect(node).toBeNull();
    });

    it('应触发 enhancedDialogueStarted 事件', () => {
      system.registerTree(createTestTree());

      const events: any[] = [];
      eventBus.on('enhancedDialogueStarted', (data: any) => events.push(data));

      system.startContextDialogue(
        'npc_1',
        NPCProfession.FARMER,
        'click',
        createContext(),
      );

      expect(events).toHaveLength(1);
      expect(events[0].treeId).toBe('test_tree');
    });
  });

  // -----------------------------------------------------------------------
  // 分支对话树
  // -----------------------------------------------------------------------

  describe('分支对话树', () => {
    beforeEach(() => {
      system.registerTree(createTestTree());
    });

    it('应能开始对话并推进', () => {
      system.startDialogue('test_tree', 'npc_1');
      const nextNode = system.advance();

      expect(nextNode).not.toBeNull();
      expect(nextNode!.id).toBe('choice');
    });

    it('有选项时不能直接推进', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start -> choice

      const node = system.advance();
      expect(node!.id).toBe('choice'); // 仍停留在选项节点
    });

    it('应能选择分支选项', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start -> choice

      const buyNode = system.makeChoice(0); // "购买粮食"
      expect(buyNode).not.toBeNull();
      expect(buyNode!.id).toBe('buy');
    });

    it('应能选择不同分支', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance();

      const chatNode = system.makeChoice(1); // "聊聊收成"
      expect(chatNode!.id).toBe('chat');
    });

    it('选项应累计好感度变动', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance();
      system.makeChoice(0); // +2

      const session = system.getActiveSession();
      expect(session!.totalRelationshipChange).toBe(2);
    });

    it('负好感度选项应正确累计', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance();
      system.makeChoice(2); // -1

      const session = system.getActiveSession();
      expect(session!.totalRelationshipChange).toBe(-1);
    });

    it('应触发 enhancedDialogueAction 事件', () => {
      const events: any[] = [];
      eventBus.on('enhancedDialogueAction', (data: any) => events.push(data));

      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start → choice
      system.makeChoice(0); // choice → buy
      system.advance(); // buy node has action: 'open_shop'

      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('open_shop');
    });

    it('无选项节点推进应触发动作', () => {
      const events: any[] = [];
      eventBus.on('enhancedDialogueAction', (data: any) => events.push(data));

      system.startDialogue('test_tree', 'npc_1');
      system.advance(); // start -> choice
      system.makeChoice(0); // choice -> buy (has action)
      system.advance(); // buy -> goodbye (triggers buy's action on advance)

      // buy node's action should fire on advance
      expect(events.some((e) => e.action === 'open_shop')).toBe(true);
    });

    it('到达终端节点应结束对话', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance();
      system.makeChoice(2); // -> goodbye
      system.advance(); // goodbye has no nextNodeId

      expect(system.getActiveSession()).toBeNull();
    });

    it('结束对话应触发 enhancedDialogueEnded 事件', () => {
      const events: any[] = [];
      eventBus.on('enhancedDialogueEnded', (data: any) => events.push(data));

      system.startDialogue('test_tree', 'npc_1');
      system.endDialogue();

      expect(events).toHaveLength(1);
      expect(events[0].treeId).toBe('test_tree');
      expect(events[0].totalRelationshipChange).toBe(0);
    });

    it('无效选项索引应返回 null', () => {
      system.startDialogue('test_tree', 'npc_1');
      system.advance();
      expect(system.makeChoice(-1)).toBeNull();
      expect(system.makeChoice(99)).toBeNull();
    });

    it('无活跃会话时 makeChoice 应返回 null', () => {
      expect(system.makeChoice(0)).toBeNull();
    });

    it('无活跃会话时 advance 应返回 null', () => {
      expect(system.advance()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 条件过滤选项
  // -----------------------------------------------------------------------

  describe('getAvailableChoices', () => {
    it('应过滤不满足条件的选项', () => {
      const tree: EnhancedDialogueTree = {
        id: 'cond_tree',
        profession: NPCProfession.FARMER,
        trigger: 'click',
        nodes: [
          {
            id: 'start',
            text: '你好',
            choices: [
              { text: '普通选项', nextNodeId: 'end' },
              {
                text: '朋友专属',
                nextNodeId: 'end',
                condition: { minRelationshipLevel: RelationshipLevel.FRIEND },
              },
            ],
          },
          { id: 'end', text: '结束' },
        ],
        priority: 1,
      };

      system.registerTree(tree);
      system.startDialogue('cond_tree', 'npc_1');

      // 陌生人等级
      const choices = system.getAvailableChoices(
        createContext({ relationshipLevel: RelationshipLevel.STRANGER }),
      );
      expect(choices).toHaveLength(1);
      expect(choices[0].text).toBe('普通选项');
    });

    it('满足条件时显示所有选项', () => {
      const tree: EnhancedDialogueTree = {
        id: 'cond_tree',
        profession: NPCProfession.FARMER,
        trigger: 'click',
        nodes: [
          {
            id: 'start',
            text: '你好',
            choices: [
              { text: '普通选项', nextNodeId: 'end' },
              {
                text: '朋友专属',
                nextNodeId: 'end',
                condition: { minRelationshipLevel: RelationshipLevel.FRIEND },
              },
            ],
          },
          { id: 'end', text: '结束' },
        ],
        priority: 1,
      };

      system.registerTree(tree);
      system.startDialogue('cond_tree', 'npc_1');

      const choices = system.getAvailableChoices(
        createContext({ relationshipLevel: RelationshipLevel.FRIEND }),
      );
      expect(choices).toHaveLength(2);
    });

    it('无活跃会话应返回空数组', () => {
      const choices = system.getAvailableChoices(createContext());
      expect(choices).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // NPC 闲聊
  // -----------------------------------------------------------------------

  describe('generateGreeting', () => {
    it('农民向商人打招呼', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.MERCHANT);

      const greeting = system.generateGreeting(npc1, npc2);
      expect(greeting).toBeTruthy();
    });

    it('士兵向将军打招呼', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.SOLDIER);
      const npc2 = createNPCInstance('npc2', NPCProfession.GENERAL);

      const greeting = system.generateGreeting(npc1, npc2);
      expect(greeting).toContain('将军');
    });

    it('应能添加自定义打招呼模板', () => {
      system.addGreeting({
        fromProfession: NPCProfession.FARMER,
        toProfession: NPCProfession.SCHOLAR,
        text: '先生，请指教！',
      });

      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.SCHOLAR);

      const greeting = system.generateGreeting(npc1, npc2);
      expect(greeting).toBe('先生，请指教！');
    });

    it('无匹配模板应返回通用打招呼', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.VILLAGER);
      const npc2 = createNPCInstance('npc2', NPCProfession.SCHOLAR);

      const greeting = system.generateGreeting(npc1, npc2);
      expect(greeting).toBeTruthy();
    });
  });

  describe('generateContextChat', () => {
    it('应生成包含打招呼的闲聊', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.MERCHANT);

      const lines = system.generateContextChat(npc1, npc2, createContext());
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]).toContain('张三');
      expect(lines[1]).toContain('李四');
    });

    it('早上应包含早安话题', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateContextChat(npc1, npc2, createContext({ gameTime: 8 }));
      expect(lines.some((l) => l.includes('早上好'))).toBe(true);
    });

    it('下午应包含下午好话题', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateContextChat(npc1, npc2, createContext({ gameTime: 14 }));
      expect(lines.some((l) => l.includes('下午好'))).toBe(true);
    });

    it('傍晚应包含收工话题', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateContextChat(npc1, npc2, createContext({ gameTime: 19 }));
      expect(lines.some((l) => l.includes('傍晚') || l.includes('收工'))).toBe(true);
    });

    it('晚上应包含安全话题', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateContextChat(npc1, npc2, createContext({ gameTime: 22 }));
      expect(lines.some((l) => l.includes('夜深') || l.includes('安全'))).toBe(true);
    });

    it('雨天应包含下雨话题', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateContextChat(npc1, npc2, createContext({ weather: 'rainy' }));
      expect(lines.some((l) => l.includes('下雨'))).toBe(true);
    });

    it('雪天应包含下雪话题', () => {
      const npc1 = createNPCInstance('npc1', NPCProfession.FARMER);
      const npc2 = createNPCInstance('npc2', NPCProfession.VILLAGER);

      const lines = system.generateContextChat(npc1, npc2, createContext({ weather: 'snowy' }));
      expect(lines.some((l) => l.includes('下雪'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getCurrentNode
  // -----------------------------------------------------------------------

  describe('getCurrentNode', () => {
    it('无活跃会话应返回 null', () => {
      expect(system.getCurrentNode()).toBeNull();
    });

    it('应返回当前节点', () => {
      system.registerTree(createTestTree());
      system.startDialogue('test_tree', 'npc_1');

      const node = system.getCurrentNode();
      expect(node).not.toBeNull();
      expect(node!.id).toBe('start');
    });
  });

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('应能序列化会话状态', () => {
      system.registerTree(createTestTree());
      system.startDialogue('test_tree', 'npc_1');

      const data = system.serialize();
      const parsed = JSON.parse(JSON.stringify(data));
      expect(parsed.activeSession).not.toBeNull();
      expect(parsed.activeSession.treeId).toBe('test_tree');
    });

    it('应能反序列化会话状态', () => {
      system.registerTree(createTestTree());
      system.startDialogue('test_tree', 'npc_1');

      const data = system.serialize();
      const newSystem = new EnhancedDialogueSystem(eventBus);
      newSystem.registerTree(createTestTree());
      newSystem.deserialize(data as Record<string, unknown>);

      const session = newSystem.getActiveSession();
      expect(session).not.toBeNull();
      expect(session!.treeId).toBe('test_tree');
    });
  });
});
