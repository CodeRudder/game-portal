/**
 * RewardSystem 奖励系统 — 单元测试
 *
 * 覆盖范围：
 * - 奖励发放与领取（单个/批量）
 * - 邮件发送、打开、领取奖励、删除
 * - 连续登录天数追踪
 * - 登录奖励领取
 * - 等级奖励领取
 * - 邮件过期清理
 * - 序列化（saveState）与反序列化（loadState）
 * - 事件监听
 * - 重置
 *
 * @module engines/idle/modules/__tests__/RewardSystem.test
 */

import {
  RewardSystem,
  type RewardItem,
  type Mail,
  type RewardEvent,
} from '../RewardSystem';

// ============================================================
// 测试数据工厂
// ============================================================

/** 创建示例奖励 */
function makeReward(overrides: Partial<RewardItem> = {}): RewardItem {
  return {
    type: 'resource',
    id: 'gold',
    amount: 100,
    ...overrides,
  };
}

/** 创建一组登录奖励配置 */
function makeLoginBonuses() {
  return [
    { day: 1, rewards: [makeReward({ id: 'gold', amount: 100 })], icon: '🪙' },
    { day: 2, rewards: [makeReward({ id: 'gem', amount: 10 })], icon: '💎' },
    { day: 3, rewards: [makeReward({ id: 'gem', amount: 50 }), makeReward({ type: 'item', id: 'scroll', amount: 1 })], icon: '🎁' },
  ];
}

/** 创建一组等级奖励配置 */
function makeLevelRewards() {
  return [
    { level: 5, rewards: [makeReward({ id: 'gold', amount: 500 })] },
    { level: 10, rewards: [makeReward({ id: 'gem', amount: 100 })] },
  ];
}

/** 创建带完整配置的 RewardSystem 实例 */
function createSystem(): RewardSystem {
  const sys = new RewardSystem();
  sys.setLoginBonuses(makeLoginBonuses());
  sys.setLevelRewards(makeLevelRewards());
  return sys;
}

// ============================================================
// 测试套件
// ============================================================

describe('RewardSystem', () => {
  let system: RewardSystem;

  beforeEach(() => {
    system = createSystem();
  });

  // ----------------------------------------------------------
  // 奖励发放与领取
  // ----------------------------------------------------------
  describe('奖励发放与领取', () => {
    it('grantReward 应将奖励加入待领取队列', () => {
      const rewards = [makeReward(), makeReward({ id: 'gem', amount: 50 })];
      system.grantReward(rewards);

      expect(system.pendingRewards).toHaveLength(2);
      expect(system.pendingRewards[0].id).toBe('gold');
      expect(system.pendingRewards[1].id).toBe('gem');
    });

    it('claimReward 应按索引领取指定奖励', () => {
      system.grantReward([makeReward(), makeReward({ id: 'gem', amount: 50 })]);

      const claimed = system.claimReward(1);
      expect(claimed).toHaveLength(1);
      expect(claimed![0].id).toBe('gem');
      expect(system.pendingRewards).toHaveLength(1);
    });

    it('claimReward 索引越界时返回 null', () => {
      system.grantReward([makeReward()]);
      expect(system.claimReward(-1)).toBeNull();
      expect(system.claimReward(5)).toBeNull();
    });

    it('claimAll 应领取全部待领取奖励并清空队列', () => {
      system.grantReward([makeReward(), makeReward({ id: 'gem', amount: 50 })]);
      const all = system.claimAll();

      expect(all).toHaveLength(2);
      expect(system.pendingRewards).toHaveLength(0);
    });

    it('空队列调用 claimAll 返回空数组', () => {
      expect(system.claimAll()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 邮件系统
  // ----------------------------------------------------------
  describe('邮件系统', () => {
    it('sendMail 应创建邮件并返回 ID', () => {
      const mailId = system.sendMail({
        title: '系统奖励',
        content: '恭喜你！',
        sender: '系统',
        rewards: [makeReward()],
      });

      expect(mailId).toBeTruthy();
      expect(system.mailBox).toHaveLength(1);
      expect(system.unreadCount).toBe(1);
    });

    it('openMail 应标记为已读并返回邮件副本', () => {
      const mailId = system.sendMail({
        title: '测试邮件',
        content: '内容',
        sender: '系统',
      });

      const mail = system.openMail(mailId);
      expect(mail).not.toBeNull();
      expect(mail!.read).toBe(true);
      expect(mail!.title).toBe('测试邮件');
      expect(system.unreadCount).toBe(0);
    });

    it('openMail 不存在的 ID 返回 null', () => {
      expect(system.openMail('nonexistent')).toBeNull();
    });

    it('claimMailReward 应领取邮件中的奖励', () => {
      const mailId = system.sendMail({
        title: '奖励邮件',
        content: '领取奖励',
        sender: '系统',
        rewards: [makeReward(), makeReward({ id: 'gem', amount: 20 })],
      });

      const rewards = system.claimMailReward(mailId);
      expect(rewards).toHaveLength(2);
      expect(rewards![0].id).toBe('gold');
      expect(rewards![1].id).toBe('gem');
    });

    it('claimMailReward 不能重复领取', () => {
      const mailId = system.sendMail({
        title: '奖励邮件',
        content: '领取奖励',
        sender: '系统',
        rewards: [makeReward()],
      });

      system.claimMailReward(mailId);
      expect(system.claimMailReward(mailId)).toBeNull();
    });

    it('claimMailReward 无奖励邮件返回 null', () => {
      const mailId = system.sendMail({
        title: '无奖励邮件',
        content: '纯文本',
        sender: '系统',
      });
      expect(system.claimMailReward(mailId)).toBeNull();
    });

    it('deleteMail 应删除指定邮件', () => {
      const mailId = system.sendMail({
        title: '待删除',
        content: '将被删除',
        sender: '系统',
      });

      expect(system.deleteMail(mailId)).toBe(true);
      expect(system.mailBox).toHaveLength(0);
    });

    it('deleteMail 不存在的 ID 返回 false', () => {
      expect(system.deleteMail('nonexistent')).toBe(false);
    });

    it('邮箱列表应包含所有邮件', () => {
      system.sendMail({ title: '第一封', content: '', sender: '系统' });
      system.sendMail({ title: '第二封', content: '', sender: '系统' });
      system.sendMail({ title: '第三封', content: '', sender: '系统' });

      const mails = system.mailBox;
      expect(mails).toHaveLength(3);
      // 验证所有邮件标题都存在
      const titles = mails.map((m) => m.title);
      expect(titles).toContain('第一封');
      expect(titles).toContain('第二封');
      expect(titles).toContain('第三封');
    });
  });

  // ----------------------------------------------------------
  // 连续登录与登录奖励
  // ----------------------------------------------------------
  describe('连续登录与登录奖励', () => {
    it('首次登录应设置连续天数为 1', () => {
      const isNew = system.checkDailyLogin();
      expect(isNew).toBe(true);

      const bonus = system.getLoginBonus();
      expect(bonus).not.toBeNull();
      expect(bonus!.day).toBe(1);
      expect(bonus!.claimed).toBe(false);
    });

    it('同一天重复调用 checkDailyLogin 返回 false', () => {
      system.checkDailyLogin();
      expect(system.checkDailyLogin()).toBe(false);
    });

    it('claimLoginBonus 应领取当日奖励并标记为已领取', () => {
      system.checkDailyLogin();
      const rewards = system.claimLoginBonus();

      expect(rewards).toHaveLength(1);
      expect(rewards![0].id).toBe('gold');
      expect(rewards![0].amount).toBe(100);

      const bonus = system.getLoginBonus();
      expect(bonus!.claimed).toBe(true);
    });

    it('claimLoginBonus 不能重复领取', () => {
      system.checkDailyLogin();
      system.claimLoginBonus();
      expect(system.claimLoginBonus()).toBeNull();
    });

    it('未登录时 claimLoginBonus 返回 null', () => {
      // 没有调用 checkDailyLogin，连续天数为 0
      expect(system.claimLoginBonus()).toBeNull();
    });

    it('getAllLoginBonuses 应返回全部配置', () => {
      const bonuses = system.getAllLoginBonuses();
      expect(bonuses).toHaveLength(3);
      expect(bonuses[0].day).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 等级奖励
  // ----------------------------------------------------------
  describe('等级奖励', () => {
    it('claimLevelReward 应领取指定等级奖励', () => {
      const rewards = system.claimLevelReward(5);
      expect(rewards).toHaveLength(1);
      expect(rewards![0].id).toBe('gold');
      expect(rewards![0].amount).toBe(500);
    });

    it('claimLevelReward 不能重复领取', () => {
      system.claimLevelReward(5);
      expect(system.claimLevelReward(5)).toBeNull();
    });

    it('claimLevelReward 不存在的等级返回 null', () => {
      expect(system.claimLevelReward(999)).toBeNull();
    });

    it('getLevelReward 应返回指定等级配置', () => {
      const def = system.getLevelReward(10);
      expect(def).toBeDefined();
      expect(def!.level).toBe(10);
    });
  });

  // ----------------------------------------------------------
  // 邮件过期清理
  // ----------------------------------------------------------
  describe('邮件过期清理', () => {
    it('cleanExpiredMails 应清理过期邮件', () => {
      // 发送一封已过期的邮件（expiresIn = -1 使 expiresAt < sentAt）
      system.sendMail({
        title: '过期邮件',
        content: '已过期',
        sender: '系统',
        expiresIn: -1,
      });

      // 发送一封正常邮件（默认 7 天过期）
      system.sendMail({
        title: '正常邮件',
        content: '未过期',
        sender: '系统',
      });

      const cleaned = system.cleanExpiredMails();
      expect(cleaned).toBe(1);
      expect(system.mailBox).toHaveLength(1);
      expect(system.mailBox[0].title).toBe('正常邮件');
    });

    it('没有过期邮件时返回 0', () => {
      system.sendMail({ title: '正常', content: '', sender: '系统' });
      expect(system.cleanExpiredMails()).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // 序列化与反序列化
  // ----------------------------------------------------------
  describe('序列化与反序列化', () => {
    it('saveState 应正确导出状态', () => {
      system.checkDailyLogin();
      system.claimLoginBonus();
      system.grantReward([makeReward()]);
      const mailId = system.sendMail({
        title: '测试',
        content: '内容',
        sender: '系统',
        rewards: [makeReward({ id: 'gem', amount: 10 })],
      });

      const saved = system.saveState();
      expect(saved.consecutiveLoginDays).toBe(1);
      expect(saved.claimedLoginDays).toContain(1);
      expect(saved.mails).toHaveLength(1);
      expect(saved.mails[0].id).toBe(mailId);
    });

    it('loadState 应正确恢复状态', () => {
      system.checkDailyLogin();
      system.claimLoginBonus();
      system.sendMail({ title: '持久化邮件', content: '测试', sender: '系统' });

      const saved = system.saveState();

      // 新实例恢复
      const sys2 = createSystem();
      sys2.loadState(saved);

      expect(sys2.unreadCount).toBe(1);
      expect(sys2.mailBox[0].title).toBe('持久化邮件');

      // 登录奖励已领取
      const bonus = sys2.getLoginBonus();
      expect(bonus!.claimed).toBe(true);
    });

    it('loadState 空数据不报错', () => {
      const sys2 = new RewardSystem();
      expect(() => sys2.loadState({})).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // 事件监听
  // ----------------------------------------------------------
  describe('事件监听', () => {
    it('grantReward 应触发 reward_granted 事件', () => {
      const events: RewardEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.grantReward([makeReward()]);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('reward_granted');
    });

    it('sendMail 应触发 mail_received 事件', () => {
      const events: RewardEvent[] = [];
      system.onEvent((e) => events.push(e));

      const mailId = system.sendMail({ title: '测试', content: '', sender: '系统' });
      expect(events).toHaveLength(1);
      if (events[0].type === 'mail_received') {
        expect(events[0].mailId).toBe(mailId);
      }
    });

    it('claimMailReward 应触发 mail_claimed 事件', () => {
      const events: RewardEvent[] = [];
      system.onEvent((e) => events.push(e));

      const mailId = system.sendMail({
        title: '奖励',
        content: '',
        sender: '系统',
        rewards: [makeReward()],
      });
      system.claimMailReward(mailId);

      const claimedEvent = events.find((e) => e.type === 'mail_claimed');
      expect(claimedEvent).toBeDefined();
    });

    it('claimLoginBonus 应触发 login_bonus_claimed 事件', () => {
      const events: RewardEvent[] = [];
      system.onEvent((e) => events.push(e));

      system.checkDailyLogin();
      system.claimLoginBonus();

      const loginEvent = events.find((e) => e.type === 'login_bonus_claimed');
      expect(loginEvent).toBeDefined();
      if (loginEvent?.type === 'login_bonus_claimed') {
        expect(loginEvent.day).toBe(1);
      }
    });

    it('offEvent 应移除监听器', () => {
      const events: RewardEvent[] = [];
      const listener = (e: RewardEvent) => events.push(e);
      system.onEvent(listener);
      system.offEvent(listener);

      system.grantReward([makeReward()]);
      expect(events).toHaveLength(0);
    });

    it('监听器抛异常不应中断流程', () => {
      system.onEvent(() => {
        throw new Error('listener error');
      });

      expect(() => system.grantReward([makeReward()])).not.toThrow();
      expect(system.pendingRewards).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------
  describe('重置', () => {
    it('reset 应恢复到初始状态', () => {
      system.grantReward([makeReward()]);
      system.sendMail({ title: '测试', content: '', sender: '系统' });
      system.checkDailyLogin();
      system.claimLoginBonus();

      system.reset();

      expect(system.pendingRewards).toHaveLength(0);
      expect(system.mailBox).toHaveLength(0);
      expect(system.unreadCount).toBe(0);
    });
  });
});
