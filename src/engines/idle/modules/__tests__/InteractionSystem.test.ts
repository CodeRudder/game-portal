/**
 * InteractionSystem 互动系统 — 单元测试
 *
 * 覆盖范围：
 * - 添加 / 接受 / 删除 / 屏蔽好友
 * - 赠送礼物（含冷却时间检查）
 * - 发送 / 阅读消息
 * - 获取未读消息
 * - 创建 / 加入 / 离开公会
 * - 事件触发
 * - 序列化 / 反序列化
 *
 * @module engines/idle/modules/__tests__/InteractionSystem.test
 */

import {
  InteractionSystem,
  type InteractionEvent,
  type Friend,
  type ChatMessage,
  type Guild,
} from '../InteractionSystem';

// ============================================================
// 测试套件
// ============================================================

describe('InteractionSystem', () => {
  let system: InteractionSystem;

  beforeEach(() => {
    system = new InteractionSystem();
  });

  // ----------------------------------------------------------
  // 好友管理
  // ----------------------------------------------------------
  describe('好友管理', () => {
    it('应成功添加好友（状态为 pending）', () => {
      expect(system.addFriend('f001', 'Alice')).toBe(true);
      const friends = system.getFriends();
      expect(friends).toHaveLength(1);
      expect(friends[0].status).toBe('pending');
      expect(friends[0].name).toBe('Alice');
    });

    it('重复添加同一好友应返回 false', () => {
      system.addFriend('f001', 'Alice');
      expect(system.addFriend('f001', 'Alice')).toBe(false);
    });

    it('应成功接受好友请求', () => {
      system.addFriend('f001', 'Alice');
      expect(system.acceptFriend('f001')).toBe(true);
      expect(system.getFriends()[0].status).toBe('accepted');
    });

    it('接受不存在的好友应返回 false', () => {
      expect(system.acceptFriend('nonexistent')).toBe(false);
    });

    it('应成功删除好友', () => {
      system.addFriend('f001', 'Alice');
      expect(system.removeFriend('f001')).toBe(true);
      expect(system.getFriends()).toHaveLength(0);
    });

    it('删除不存在的好友应返回 false', () => {
      expect(system.removeFriend('nonexistent')).toBe(false);
    });

    it('应成功屏蔽好友', () => {
      system.addFriend('f001', 'Alice');
      expect(system.blockFriend('f001')).toBe(true);
      expect(system.getFriends()[0].status).toBe('blocked');
    });

    it('屏蔽不存在的好友应返回 false', () => {
      expect(system.blockFriend('nonexistent')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 赠送礼物
  // ----------------------------------------------------------
  describe('赠送礼物', () => {
    it('应向已接受的好友赠送礼物', () => {
      system.addFriend('f001', 'Alice');
      system.acceptFriend('f001');
      expect(system.sendGift('f001', 'coin', 100)).toBe(true);
    });

    it('不应向 pending 状态的好友赠送礼物', () => {
      system.addFriend('f001', 'Alice');
      expect(system.sendGift('f001', 'coin', 100)).toBe(false);
    });

    it('不应向 blocked 状态的好友赠送礼物', () => {
      system.addFriend('f001', 'Alice');
      system.blockFriend('f001');
      expect(system.sendGift('f001', 'coin', 100)).toBe(false);
    });

    it('冷却时间内不可重复赠送', () => {
      system.addFriend('f001', 'Alice');
      system.acceptFriend('f001');
      expect(system.sendGift('f001', 'coin', 100)).toBe(true);
      // 立即再次赠送应失败（冷却中）
      expect(system.sendGift('f001', 'gem', 10)).toBe(false);
    });

    it('不存在的好友赠送应返回 false', () => {
      expect(system.sendGift('nonexistent', 'coin', 100)).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 聊天消息
  // ----------------------------------------------------------
  describe('聊天消息', () => {
    it('应成功发送消息', () => {
      const msg = system.sendMessage('f001', '你好！');
      expect(msg.content).toBe('你好！');
      expect(msg.fromId).toBe('player');
      expect(msg.read).toBe(false);
      expect(msg.id).toBeTruthy();
    });

    it('应正确标记消息为已读', () => {
      const msg = system.sendMessage('f001', 'Hello');
      system.readMessage(msg.id);
      expect(system.getUnreadMessages()).toHaveLength(0);
    });

    it('应返回所有未读消息', () => {
      system.sendMessage('f001', 'msg1');
      system.sendMessage('f002', 'msg2');
      expect(system.getUnreadMessages()).toHaveLength(2);
    });

    it('已读后未读列表应减少', () => {
      const msg = system.sendMessage('f001', 'msg1');
      system.sendMessage('f002', 'msg2');
      system.readMessage(msg.id);
      expect(system.getUnreadMessages()).toHaveLength(1);
    });

    it('读取不存在的消息 ID 应静默忽略', () => {
      expect(() => system.readMessage('nonexistent')).not.toThrow();
    });

    it('应返回与指定好友的聊天记录', () => {
      system.sendMessage('f001', 'Hello Alice');
      system.sendMessage('f002', 'Hello Bob');
      const history = system.getChatHistory('f001');
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Hello Alice');
    });
  });

  // ----------------------------------------------------------
  // 公会系统
  // ----------------------------------------------------------
  describe('公会系统', () => {
    it('应成功创建公会', () => {
      const guild = system.createGuild('TestGuild');
      expect(guild.name).toBe('TestGuild');
      expect(guild.level).toBe(1);
      expect(guild.members).toContain('player');
      expect(system.getGuild()).toBe(guild);
    });

    it('已加入公会时不可再次加入', () => {
      system.createGuild('MyGuild');
      expect(system.joinGuild('other_guild')).toBe(false);
    });

    it('应成功加入公会', () => {
      expect(system.joinGuild('guild_123')).toBe(true);
      const guild = system.getGuild();
      expect(guild).not.toBeNull();
      expect(guild!.id).toBe('guild_123');
    });

    it('应成功离开公会', () => {
      system.createGuild('MyGuild');
      expect(system.leaveGuild()).toBe(true);
      expect(system.getGuild()).toBeNull();
    });

    it('未加入公会时离开应返回 false', () => {
      expect(system.leaveGuild()).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 事件系统
  // ----------------------------------------------------------
  describe('事件系统', () => {
    it('添加好友应触发 friend_added 事件', () => {
      const events: InteractionEvent[] = [];
      system.on('friend_added', (e) => events.push(e));
      system.addFriend('f001', 'Alice');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('friend_added');
    });

    it('发送礼物应触发 gift_sent 事件', () => {
      const events: InteractionEvent[] = [];
      system.addFriend('f001', 'Alice');
      system.acceptFriend('f001');
      system.on('gift_sent', (e) => events.push(e));
      system.sendGift('f001', 'coin', 50);
      expect(events).toHaveLength(1);
      if (events[0].type === 'gift_sent') {
        expect(events[0].giftType).toBe('coin');
        expect(events[0].amount).toBe(50);
      }
    });

    it('创建公会应触发 guild_created 事件', () => {
      const events: InteractionEvent[] = [];
      system.on('guild_created', (e) => events.push(e));
      system.createGuild('NewGuild');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('guild_created');
    });
  });

  // ----------------------------------------------------------
  // 序列化 / 反序列化
  // ----------------------------------------------------------
  describe('序列化与反序列化', () => {
    it('serialize 应导出完整状态', () => {
      system.addFriend('f001', 'Alice');
      system.acceptFriend('f001');
      system.sendMessage('f001', 'Hello');
      system.createGuild('TestGuild');

      const data = system.serialize() as Record<string, unknown>;
      expect((data.friends as [string, Friend][]).length).toBe(1);
      expect((data.messages as ChatMessage[]).length).toBe(1);
      expect((data.guild as Guild).name).toBe('TestGuild');
    });

    it('deserialize 应恢复完整状态', () => {
      system.addFriend('f001', 'Alice');
      system.acceptFriend('f001');
      system.sendGift('f001', 'coin', 100);
      system.sendMessage('f001', 'Hello');
      system.createGuild('MyGuild');
      const saved = system.serialize();

      const fresh = new InteractionSystem();
      fresh.deserialize(saved as Record<string, unknown>);

      const friends = fresh.getFriends();
      expect(friends).toHaveLength(1);
      expect(friends[0].name).toBe('Alice');
      expect(friends[0].status).toBe('accepted');

      const guild = fresh.getGuild();
      expect(guild).not.toBeNull();
      expect(guild!.name).toBe('MyGuild');
    });

    it('序列化结果为深拷贝，修改不影响原系统', () => {
      system.addFriend('f001', 'Alice');
      const saved = system.serialize() as Record<string, unknown>;
      const friendsArr = saved.friends as [string, Friend][];
      friendsArr[0][1].name = 'Hacked';

      expect(system.getFriends()[0].name).toBe('Alice');
    });
  });
});
