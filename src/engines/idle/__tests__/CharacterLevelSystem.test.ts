/**
 * CharacterLevelSystem 单元测试
 */
import {
  CharacterLevelSystem,
  type LevelTable,
} from '../modules/CharacterLevelSystem';

// ============================================================
// 测试用等级表
// ============================================================

const TEST_TABLE: LevelTable[] = [
  { level: 1, expRequired: 0,    statBonus: { atk: 5, hp: 50 },  unlockSkills: ['basic_attack'],       title: '新手' },
  { level: 2, expRequired: 100,  statBonus: { atk: 8, hp: 70 },  unlockSkills: ['power_slash'],        title: '学徒' },
  { level: 3, expRequired: 300,  statBonus: { atk: 12, hp: 100 }, unlockSkills: ['shield_bash'],       title: '战士' },
  { level: 4, expRequired: 600,  statBonus: { atk: 18, hp: 150 }, unlockSkills: ['whirlwind'],         title: '精英战士' },
  { level: 5, expRequired: 1000, statBonus: { atk: 25, hp: 200 }, unlockSkills: ['berserker_rage'],    title: '勇者' },
];

// ============================================================
// 测试
// ============================================================

describe('CharacterLevelSystem', () => {

  // ----------------------------------------------------------
  // 初始化
  // ----------------------------------------------------------

  describe('constructor', () => {
    it('应正确初始化为 1 级', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.getLevel()).toBe(1);
      expect(cls.getTitle()).toBe('新手');
      expect(cls.getMaxLevel()).toBe(5);
    });

    it('应解锁 1 级的初始技能', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.isSkillUnlocked('basic_attack')).toBe(true);
      expect(cls.isSkillUnlocked('power_slash')).toBe(false);
    });

    it('应支持自定义每级属性点', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE, 5);
      cls.addExp(100); // 升到 2 级
      expect(cls.getState().availablePoints).toBe(5);
    });

    it('默认每级 3 属性点', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);
      expect(cls.getState().availablePoints).toBe(3);
    });

    it('空等级表应抛出错误', () => {
      expect(() => new CharacterLevelSystem([])).toThrow();
    });

    it('应处理乱序的等级表', () => {
      const shuffled = [...TEST_TABLE].reverse();
      const cls = new CharacterLevelSystem(shuffled);
      expect(cls.getLevel()).toBe(1);
      expect(cls.getMaxLevel()).toBe(5);
    });
  });

  // ----------------------------------------------------------
  // 经验与升级
  // ----------------------------------------------------------

  describe('addExp', () => {
    it('增加经验不升级', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const result = cls.addExp(50);
      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(1);
      expect(result.levelsGained).toBe(0);
      expect(cls.getLevel()).toBe(1);
    });

    it('增加经验刚好升级', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const result = cls.addExp(100);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.levelsGained).toBe(1);
    });

    it('一次经验跨越多级', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const result = cls.addExp(600); // 直接到 4 级
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(4);
      expect(result.levelsGained).toBe(3);
    });

    it('经验超过满级时停在最高级', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const result = cls.addExp(9999);
      expect(cls.getLevel()).toBe(5);
      expect(result.newLevel).toBe(5);
    });

    it('零或负经验应被忽略', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.addExp(0).leveledUp).toBe(false);
      expect(cls.addExp(-10).leveledUp).toBe(false);
      expect(cls.getLevel()).toBe(1);
    });

    it('升级应发放属性点', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100); // 升到 2 级
      expect(cls.getState().availablePoints).toBe(3);
      cls.addExp(200); // 升到 3 级
      expect(cls.getState().availablePoints).toBe(6);
    });

    it('升级应解锁对应技能', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);
      expect(cls.isSkillUnlocked('power_slash')).toBe(true);
      cls.addExp(200);
      expect(cls.isSkillUnlocked('shield_bash')).toBe(true);
    });

    it('totalExp 应累计所有经验', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(50);
      cls.addExp(30);
      expect(cls.getState().totalExp).toBe(80);
    });
  });

  // ----------------------------------------------------------
  // 等级进度
  // ----------------------------------------------------------

  describe('getLevelProgress', () => {
    it('初始进度为 0', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.getLevelProgress()).toBe(0);
    });

    it('半程进度约 0.5', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(50); // 需要 100 升级，已有 50
      expect(cls.getLevelProgress()).toBeCloseTo(0.5);
    });

    it('满级时进度为 1', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(9999);
      expect(cls.getLevelProgress()).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 经验计算
  // ----------------------------------------------------------

  describe('getExpToNextLevel', () => {
    it('1 级到 2 级需要 100 经验', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.getExpToNextLevel()).toBe(100);
    });

    it('满级时返回 0', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(9999);
      expect(cls.getExpToNextLevel()).toBe(0);
    });

    it('升级后经验需求更新', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100); // 升到 2 级
      expect(cls.getExpToNextLevel()).toBe(200); // 2→3 需要 300-100=200
    });
  });

  // ----------------------------------------------------------
  // 属性点分配
  // ----------------------------------------------------------

  describe('allocateStat', () => {
    it('正常分配属性点', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100); // 获得 3 点
      expect(cls.allocateStat('def', 2)).toBe(true);
      expect(cls.getState().allocatedStats.def).toBe(2);
      expect(cls.getState().availablePoints).toBe(1);
    });

    it('分配超过可用点数应失败', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100); // 3 点
      expect(cls.allocateStat('def', 5)).toBe(false);
      expect(cls.getState().availablePoints).toBe(3);
    });

    it('零或负数分配应失败', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);
      expect(cls.allocateStat('def', 0)).toBe(false);
      expect(cls.allocateStat('def', -1)).toBe(false);
    });

    it('空属性 ID 应失败', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);
      expect(cls.allocateStat('', 1)).toBe(false);
    });

    it('多次分配同一属性应累加', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(300); // 升到 3 级，获得 6 点
      cls.allocateStat('def', 2);
      cls.allocateStat('def', 3);
      expect(cls.getState().allocatedStats.def).toBe(5);
      expect(cls.getState().availablePoints).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 总属性计算
  // ----------------------------------------------------------

  describe('getTotalStats', () => {
    it('1 级基础属性', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const stats = cls.getTotalStats();
      expect(stats.atk).toBe(5);
      expect(stats.hp).toBe(50);
    });

    it('升级后基础属性累加', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100); // 2 级
      const stats = cls.getTotalStats();
      expect(stats.atk).toBe(5 + 8); // 1 级 + 2 级
      expect(stats.hp).toBe(50 + 70);
    });

    it('基础属性 + 分配属性', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100); // 2 级
      cls.allocateStat('atk', 2);
      cls.allocateStat('def', 1);
      const stats = cls.getTotalStats();
      expect(stats.atk).toBe(5 + 8 + 2); // 基础 + 分配
      expect(stats.def).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // 技能检查
  // ----------------------------------------------------------

  describe('isSkillUnlocked', () => {
    it('未解锁技能返回 false', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.isSkillUnlocked('nonexistent')).toBe(false);
    });

    it('1 级技能默认解锁', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.isSkillUnlocked('basic_attack')).toBe(true);
    });

    it('升级后解锁新技能', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(1000); // 升到 5 级
      expect(cls.isSkillUnlocked('berserker_rage')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 称号
  // ----------------------------------------------------------

  describe('getTitle', () => {
    it('初始称号', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      expect(cls.getTitle()).toBe('新手');
    });

    it('升级后称号变化', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(300);
      expect(cls.getTitle()).toBe('战士');
    });
  });

  // ----------------------------------------------------------
  // 事件系统
  // ----------------------------------------------------------

  describe('onEvent', () => {
    it('exp_gained 事件', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const events: string[] = [];
      cls.onEvent((e) => events.push(e.type));

      cls.addExp(10);
      expect(events).toContain('exp_gained');
    });

    it('level_up 事件', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const events: string[] = [];
      cls.onEvent((e) => events.push(e.type));

      cls.addExp(100);
      expect(events).toContain('level_up');
    });

    it('skill_unlocked 事件包含技能名', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      let unlockedSkill = '';
      cls.onEvent((e) => {
        if (e.type === 'skill_unlocked') unlockedSkill = e.skill ?? '';
      });

      cls.addExp(100);
      expect(unlockedSkill).toBe('power_slash');
    });

    it('stat_allocated 事件包含属性名', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      let allocatedStat = '';
      cls.onEvent((e) => {
        if (e.type === 'stat_allocated') allocatedStat = e.stat ?? '';
      });

      cls.addExp(100);
      cls.allocateStat('def', 1);
      expect(allocatedStat).toBe('def');
    });

    it('取消监听后不再接收事件', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      let count = 0;
      const unsub = cls.onEvent(() => count++);

      cls.addExp(10);
      expect(count).toBe(1);

      unsub();
      cls.addExp(10);
      expect(count).toBe(1); // 不再增加
    });

    it('连续升级触发多个事件', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      const levelUps: number[] = [];
      cls.onEvent((e) => {
        if (e.type === 'level_up') levelUps.push(e.level ?? 0);
      });

      cls.addExp(600); // 1→4，跨 3 级
      expect(levelUps).toEqual([2, 3, 4]);
    });
  });

  // ----------------------------------------------------------
  // 存档/读档
  // ----------------------------------------------------------

  describe('saveState / loadState', () => {
    it('保存后恢复状态一致', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(300); // 升到 3 级
      cls.allocateStat('def', 2);
      cls.allocateStat('atk', 1);

      const saved = cls.saveState();
      const cls2 = new CharacterLevelSystem(TEST_TABLE);
      cls2.loadState(saved);

      expect(cls2.getLevel()).toBe(3);
      expect(cls2.getState().totalExp).toBe(300);
      expect(cls2.getState().availablePoints).toBe(3); // 6 - 2 - 1 = 3
      expect(cls2.getState().allocatedStats.def).toBe(2);
      expect(cls2.getState().allocatedStats.atk).toBe(1);
      expect(cls2.isSkillUnlocked('shield_bash')).toBe(true);
      expect(cls2.getTitle()).toBe('战士');
    });

    it('loadState 处理无效数据', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);
      cls.loadState({}); // 全部缺失
      expect(cls.getLevel()).toBe(1);
      expect(cls.getState().totalExp).toBe(0);
    });

    it('loadState 后 addExp 正常工作', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);
      const saved = cls.saveState();

      const cls2 = new CharacterLevelSystem(TEST_TABLE);
      cls2.loadState(saved);
      const result = cls2.addExp(200); // 2→3
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // 重置
  // ----------------------------------------------------------

  describe('reset', () => {
    it('重置后回到初始状态', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(500);
      cls.allocateStat('def', 2);
      cls.reset();

      expect(cls.getLevel()).toBe(1);
      expect(cls.getState().totalExp).toBe(0);
      expect(cls.getState().availablePoints).toBe(0);
      expect(cls.getState().allocatedStats).toEqual({});
      expect(cls.isSkillUnlocked('basic_attack')).toBe(true);
      expect(cls.isSkillUnlocked('power_slash')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // getState 深拷贝验证
  // ----------------------------------------------------------

  describe('getState', () => {
    it('返回的快照不影响内部状态', () => {
      const cls = new CharacterLevelSystem(TEST_TABLE);
      cls.addExp(100);

      const snapshot = cls.getState();
      snapshot.level = 99;
      snapshot.allocatedStats['hack'] = 999;

      expect(cls.getLevel()).toBe(2);
      expect(cls.getState().allocatedStats['hack']).toBeUndefined();
    });
  });
});
